import {
  cancelSkillGraph,
  createMotionSkillGraph,
  getReadySkillNodes,
  markSkillNodeCompleted,
  markSkillNodeFailed,
  markSkillNodeRunning,
  markSkillNodeSkipped,
  normalizeMotionSkillGraph,
  serializeSkillGraph,
  validateMotionSkillGraph,
} from './motion-skill-graph.js';

export const MOTION_EXECUTION_SESSION_SCHEMA = 'humanoid_rig/motion_execution_session@1.0';

const SESSION_STATUSES = new Set(['idle', 'prepared', 'running', 'paused', 'completed', 'failed', 'cancelled', 'recovering']);

export function createMotionExecutionSession(input = {}) {
  return normalizeMotionExecutionSession({
    schema: MOTION_EXECUTION_SESSION_SCHEMA,
    sessionId: createSessionId(),
    planId: null,
    graphId: null,
    actorId: null,
    status: 'idle',
    currentNodeId: null,
    completedNodeIds: [],
    failedNodeIds: [],
    startedAt: null,
    updatedAt: null,
    elapsed: 0,
    progress: 0,
    activeSkills: [],
    warnings: [],
    lastError: null,
    recoveryState: null,
    ...cloneObject(input),
  });
}

export function normalizeMotionExecutionSession(input = {}) {
  const source = cloneObject(input);
  const status = SESSION_STATUSES.has(source.status) ? source.status : 'idle';
  return {
    ...source,
    schema: MOTION_EXECUTION_SESSION_SCHEMA,
    sessionId: text(source.sessionId ?? source.session_id, createSessionId()),
    planId: nullableText(source.planId ?? source.plan_id),
    graphId: nullableText(source.graphId ?? source.graph_id),
    actorId: nullableText(source.actorId ?? source.actor_id),
    status,
    currentNodeId: nullableText(source.currentNodeId ?? source.current_node_id),
    completedNodeIds: uniqueStrings(source.completedNodeIds ?? source.completed_node_ids),
    failedNodeIds: uniqueStrings(source.failedNodeIds ?? source.failed_node_ids),
    startedAt: nullableText(source.startedAt ?? source.started_at),
    updatedAt: nullableText(source.updatedAt ?? source.updated_at),
    elapsed: Math.max(0, finite(source.elapsed, 0)),
    progress: clamp01(source.progress, 0),
    activeSkills: uniqueStrings(source.activeSkills ?? source.active_skills),
    warnings: uniqueStrings(source.warnings),
    lastError: source.lastError == null && source.last_error == null ? null : clone(source.lastError ?? source.last_error),
    recoveryState: source.recoveryState == null && source.recovery_state == null ? null : clone(source.recoveryState ?? source.recovery_state),
  };
}

export function validateMotionExecutionSession(input) {
  const session = normalizeMotionExecutionSession(input);
  const errors = [];
  if (session.schema !== MOTION_EXECUTION_SESSION_SCHEMA) errors.push('MOTION_EXECUTION_SESSION_SCHEMA_INVALID');
  if (!session.sessionId) errors.push('MOTION_EXECUTION_SESSION_ID_MISSING');
  if (!SESSION_STATUSES.has(session.status)) errors.push('MOTION_EXECUTION_SESSION_STATUS_INVALID');
  if (session.progress < 0 || session.progress > 1) errors.push('MOTION_EXECUTION_SESSION_PROGRESS_INVALID');
  return { valid: errors.length === 0, errors, session };
}

/**
 * Runs a semantic Skill Graph against an injected execution adapter. It keeps
 * only an optional low-frequency summary callback; it never mutates ProjectState
 * or creates a second AnimationSession.
 */
export class MotionExecutionScheduler {
  constructor({
    adapter,
    summaryHz = 8,
    onSummary = () => {},
    now = () => Date.now(),
  } = {}) {
    if (!adapter || typeof adapter.prepare !== 'function') throw new TypeError('MotionExecutionScheduler requires a MotionExecutionAdapter.');
    this.adapter = adapter;
    this.summaryHz = Math.min(10, Math.max(5, Number(summaryHz) || 8));
    this.onSummary = typeof onSummary === 'function' ? onSummary : () => {};
    this.now = typeof now === 'function' ? now : () => Date.now();
    this.summaryIntervalMs = 1000 / this.summaryHz;
    this.lastSummaryAt = -Infinity;
    this.plan = null;
    this.graph = null;
    this.actorContext = null;
    this.session = createMotionExecutionSession();
    this.startedAtElapsed = new Map();
  }

  prepare(planInput, context = {}) {
    const plan = planInput?.plan || planInput;
    const graphInput = planInput?.skillGraph || context.skillGraph || graphFromPlan(plan);
    const actorContext = planInput?.actorContext || context.actorContext || null;
    const graphReport = validateMotionSkillGraph(graphInput);
    if (!graphReport.valid) {
      this.plan = clone(plan);
      this.graph = graphReport.graph;
      this.session = createMotionExecutionSession({
        planId: plan?.planId || null,
        graphId: graphReport.graph.graphId,
        actorId: actorContext?.actorId || plan?.actorContextRef || null,
        status: 'failed',
        warnings: ['MOTION_SKILL_GRAPH_INVALID'],
        lastError: error('MOTION_SKILL_GRAPH_INVALID', graphReport.errors.join(', ')),
        updatedAt: this.nowIso(),
      });
      this.emitSummary(true);
      return this.getSnapshot();
    }
    this.plan = clone(plan);
    this.graph = graphReport.graph;
    this.actorContext = clone(actorContext);
    this.startedAtElapsed.clear();
    const adapterResult = this.adapter.prepare(this.plan, {
      ...context,
      actorContext: this.actorContext,
      sourceText: context.sourceText || planInput?.intent?.sourceText || '',
    }) || {};
    const adapterStatus = String(adapterResult.status || 'prepared');
    const isSolverBlocked = adapterStatus === 'requires_solver';
    const isFailed = adapterStatus === 'failed' || adapterStatus === 'error';
    this.session = createMotionExecutionSession({
      planId: this.plan?.planId || null,
      graphId: this.graph.graphId,
      actorId: this.actorContext?.actorId || this.plan?.actorContextRef || null,
      status: isSolverBlocked || isFailed ? 'failed' : 'prepared',
      currentNodeId: adapterResult.currentNodeId || null,
      elapsed: adapterResult.elapsed || 0,
      progress: adapterResult.progress || 0,
      warnings: uniqueStrings([...(adapterResult.warnings || []), ...(this.plan?.warnings || [])]),
      lastError: isSolverBlocked
        ? adapterResult.lastError || error('REQUIRES_SOLVER', 'This plan requires a Whole Body Solver.')
        : isFailed ? adapterResult.lastError || error('EXECUTION_PREPARE_FAILED', 'Execution adapter preparation failed.') : null,
      updatedAt: this.nowIso(),
    });
    this.syncSessionFromGraph(adapterResult);
    this.emitSummary(true);
    return this.getSnapshot();
  }

  start() {
    if (this.session.status !== 'prepared') return this.getSnapshot();
    const result = this.adapter.start() || {};
    if (String(result.status) === 'requires_solver') return this.failForSolver(result);
    if (String(result.status) === 'failed') return this.failSession(result.lastError || error('EXECUTION_START_FAILED', 'Execution adapter failed to start.'));
    this.session.status = 'running';
    this.session.startedAt = this.nowIso();
    this.session.updatedAt = this.session.startedAt;
    this.activateReadyNodes();
    this.syncSessionFromGraph(result);
    this.emitSummary(true);
    return this.getSnapshot();
  }

  update(deltaTime = 0) {
    const delta = Math.max(0, finite(deltaTime, 0));
    if (this.session.status === 'recovering') return this.updateRecovery(delta);
    if (this.session.status !== 'running') return this.getSnapshot();
    const result = this.adapter.update(delta) || {};
    this.applyAdapterProgress(result);
    const failedNodeIds = uniqueStrings(result.failedNodeIds);
    for (const nodeId of failedNodeIds) this.handleNodeFailure(nodeId, result.lastError || error('SKILL_FAILED', `Skill ${nodeId} failed.`));
    if (this.session.status !== 'running') {
      this.emitSummary();
      return this.getSnapshot();
    }
    this.applyCompletedNodes(result.completedNodeIds);
    this.enforceTimeouts();
    if (this.session.status !== 'running') {
      this.emitSummary();
      return this.getSnapshot();
    }
    if (String(result.status) === 'failed' || String(result.status) === 'error') {
      this.handleNodeFailure(result.currentNodeId || this.session.currentNodeId || firstRunningNode(this.graph)?.nodeId, result.lastError || error('EXECUTION_FAILED', 'Execution adapter reported failure.'));
    } else if (String(result.status) === 'requires_solver') {
      this.failForSolver(result);
    }
    if (this.session.status === 'running') {
      this.activateReadyNodes();
      this.syncSessionFromGraph(result);
      if (this.graph.nodes.length && this.graph.nodes.every((node) => ['completed', 'skipped'].includes(node.status))) {
        this.session.status = 'completed';
        this.session.progress = 1;
        this.session.currentNodeId = null;
      }
    }
    this.session.updatedAt = this.nowIso();
    this.emitSummary();
    return this.getSnapshot();
  }

  pause() {
    if (this.session.status === 'running') {
      this.adapter.pause();
      this.session.status = 'paused';
      this.session.updatedAt = this.nowIso();
      this.emitSummary(true);
    }
    return this.getSnapshot();
  }

  resume() {
    if (this.session.status === 'paused') {
      this.adapter.resume();
      this.session.status = 'running';
      this.session.updatedAt = this.nowIso();
      this.emitSummary(true);
    }
    return this.getSnapshot();
  }

  cancel(reason = 'operator_stop') {
    if (!['completed', 'cancelled'].includes(this.session.status)) {
      this.adapter.cancel(reason);
      this.graph = cancelSkillGraph(this.graph, reason);
      this.session.status = 'cancelled';
      this.session.lastError = error('CANCELLED', String(reason));
      this.session.updatedAt = this.nowIso();
      this.syncSessionFromGraph();
      this.emitSummary(true);
    }
    return this.getSnapshot();
  }

  getSnapshot() {
    return {
      plan: clone(this.plan),
      skillGraph: serializeSkillGraph(this.graph || createMotionSkillGraph()),
      session: normalizeMotionExecutionSession(this.session),
      adapter: clone(this.adapter.getResult?.() || null),
    };
  }

  dispose() {
    this.adapter.dispose?.();
    this.plan = null;
    this.graph = null;
    this.session = createMotionExecutionSession();
    this.startedAtElapsed.clear();
  }

  applyAdapterProgress(result) {
    const elapsed = finite(result.elapsed, this.session.elapsed);
    const progress = finite(result.progress, this.session.progress);
    this.session.elapsed = Math.max(this.session.elapsed, Math.max(0, elapsed));
    this.session.progress = Math.max(this.session.progress, clamp01(progress, this.session.progress));
    this.session.currentNodeId = nullableText(result.currentNodeId) || this.session.currentNodeId;
    this.session.warnings = uniqueStrings([...this.session.warnings, ...(result.warnings || [])]);
  }

  applyCompletedNodes(nodeIds) {
    for (const nodeId of uniqueStrings(nodeIds)) {
      const node = this.graph.nodes.find((item) => item.nodeId === nodeId);
      if (node && ['running', 'pending'].includes(node.status)) this.graph = markSkillNodeCompleted(this.graph, nodeId);
    }
  }

  activateReadyNodes() {
    for (const node of getReadySkillNodes(this.graph)) {
      const precondition = evaluatePreconditions(node);
      if (!precondition.valid) {
        this.handleNodeFailure(node.nodeId, error('PRECONDITION_FAILED', precondition.message, { condition: precondition.condition }));
        if (this.session.status !== 'running') return;
        continue;
      }
      this.graph = markSkillNodeRunning(this.graph, node.nodeId);
      this.startedAtElapsed.set(node.nodeId, this.session.elapsed);
    }
  }

  enforceTimeouts() {
    for (const node of this.graph.nodes.filter((item) => item.status === 'running' && Number(item.timeout) > 0)) {
      const started = this.startedAtElapsed.get(node.nodeId) ?? this.session.elapsed;
      if (this.session.elapsed - started > Number(node.timeout)) {
        this.handleNodeFailure(node.nodeId, error('SKILL_TIMEOUT', `${node.skillId} timed out.`, { timeout: node.timeout }));
        if (this.session.status !== 'running') return;
      }
    }
  }

  handleNodeFailure(nodeId, details) {
    const node = this.graph?.nodes.find((item) => item.nodeId === String(nodeId));
    if (!node) return this.failSession(details);
    this.graph = markSkillNodeFailed(this.graph, node.nodeId, details?.message || details);
    this.session.failedNodeIds = uniqueStrings([...this.session.failedNodeIds, node.nodeId]);
    this.session.lastError = clone(details);
    const policy = String(node.failurePolicy || 'stop');
    if (policy === 'skip') {
      this.graph = markSkillNodeSkipped(this.graph, node.nodeId, 'failure_policy_skip');
      this.session.warnings = uniqueStrings([...this.session.warnings, `SKILL_SKIPPED:${node.skillId}`]);
      this.graph.status = 'running';
      return;
    }
    if (policy === 'retry' && Number(node.attempts || 0) < 1) {
      this.graph = retryNode(this.graph, node.nodeId);
      this.session.warnings = uniqueStrings([...this.session.warnings, `SKILL_RETRY:${node.skillId}`]);
      return;
    }
    if (policy === 'recover_to_stand') {
      this.session.status = 'recovering';
      this.session.recoveryState = { skillId: 'recover_to_stand', status: 'running', sourceNodeId: node.nodeId, policy };
      this.adapter.recover?.('recover_to_stand');
      this.syncSessionFromGraph();
      return;
    }
    if (policy === 'replan' || policy === 'fallback_skill') {
      this.session.recoveryState = { skillId: policy === 'fallback_skill' ? 'fallback_skill' : null, status: 'needs_replan', sourceNodeId: node.nodeId, policy };
      this.session.warnings = uniqueStrings([...this.session.warnings, `REPLAN_REQUIRED:${node.skillId}`]);
    }
    this.adapter.cancel?.(`failure:${node.nodeId}`);
    this.session.status = 'failed';
    this.syncSessionFromGraph();
  }

  updateRecovery(delta) {
    const result = this.adapter.update(delta) || {};
    this.applyAdapterProgress(result);
    const recovery = this.session.recoveryState || {};
    if (String(result.status) === 'recovered' || result.recovery?.status === 'completed') {
      this.session.recoveryState = { ...recovery, status: 'completed' };
      this.session.status = 'failed';
      this.session.warnings = uniqueStrings([...this.session.warnings, 'RECOVERY_COMPLETED']);
    } else if (String(result.status) === 'failed') {
      this.session.recoveryState = { ...recovery, status: 'failed' };
      this.session.status = 'failed';
    }
    this.session.updatedAt = this.nowIso();
    this.emitSummary();
    return this.getSnapshot();
  }

  failForSolver(result = {}) {
    this.session.status = 'failed';
    this.session.lastError = result.lastError || error('REQUIRES_SOLVER', 'This plan requires a Whole Body Solver.');
    this.session.warnings = uniqueStrings([...this.session.warnings, ...(result.warnings || []), 'REQUIRES_SOLVER']);
    this.session.updatedAt = this.nowIso();
    this.emitSummary(true);
    return this.getSnapshot();
  }

  failSession(details) {
    this.session.status = 'failed';
    this.session.lastError = clone(details);
    this.session.updatedAt = this.nowIso();
    this.emitSummary(true);
    return this.getSnapshot();
  }

  syncSessionFromGraph(adapterResult = {}) {
    const running = this.graph?.nodes.filter((node) => node.status === 'running') || [];
    this.session.currentNodeId = nullableText(adapterResult.currentNodeId) || running[0]?.nodeId || null;
    this.session.completedNodeIds = uniqueStrings(this.graph?.nodes.filter((node) => ['completed', 'skipped'].includes(node.status)).map((node) => node.nodeId));
    this.session.failedNodeIds = uniqueStrings([...this.session.failedNodeIds, ...(this.graph?.nodes.filter((node) => node.status === 'failed').map((node) => node.nodeId) || [])]);
    this.session.activeSkills = uniqueStrings(running.map((node) => node.skillId));
    this.session.warnings = uniqueStrings([...this.session.warnings, ...(this.graph?.warnings || [])]);
  }

  emitSummary(force = false) {
    const now = Number(this.now()) || Date.now();
    if (!force && now - this.lastSummaryAt < this.summaryIntervalMs) return;
    this.lastSummaryAt = now;
    this.onSummary(this.getSnapshot());
  }

  nowIso() { return new Date(Number(this.now()) || Date.now()).toISOString(); }
}

function graphFromPlan(plan) {
  return createMotionSkillGraph({
    graphId: plan?.skillGraphId || `skill-graph-${String(plan?.planId || 'anonymous')}`,
    planId: plan?.planId || null,
    nodes: clone(plan?.nodes || []).map((node) => ({ ...node, status: node.status || 'pending' })),
    edges: clone(plan?.edges || []),
    parallelGroups: clone(plan?.parallelGroups || []),
    warnings: clone(plan?.warnings || []),
  });
}

function retryNode(graphInput, nodeId) {
  const graph = normalizeMotionSkillGraph(graphInput);
  const node = graph.nodes.find((item) => item.nodeId === String(nodeId));
  if (!node) return graph;
  node.status = 'pending';
  node.attempts = Number(node.attempts || 0) + 1;
  node.lastError = null;
  graph.status = 'running';
  return graph;
}

function firstRunningNode(graph) { return graph?.nodes.find((node) => node.status === 'running') || null; }
function evaluatePreconditions(node) {
  for (const condition of node?.preconditions || []) {
    if (condition?.type === 'affordance' && condition.available === false) {
      return { valid: false, condition, message: `Required affordance is unavailable: ${condition.affordance || 'unknown'}.` };
    }
    if (condition?.type === 'target_resolved_or_relative' && !node?.parameters?.resolvedTarget && !node?.parameters?.relativeTarget) {
      return { valid: false, condition, message: `Target is unresolved: ${condition.target || 'unknown'}.` };
    }
  }
  return { valid: true, condition: null, message: null };
}
function error(code, message, details = null) { return { code, message: String(message), details: details == null ? null : clone(details) }; }
function createSessionId() { return `motion-execution-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10)}`; }
function uniqueStrings(values) { return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))]; }
function cloneObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {}; }
function clone(value) { return value === undefined ? undefined : structuredClone(value); }
function text(value, fallback) { const result = String(value ?? '').trim(); return result || fallback; }
function nullableText(value) { const result = String(value ?? '').trim(); return result || null; }
function finite(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function clamp01(value, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback; }
