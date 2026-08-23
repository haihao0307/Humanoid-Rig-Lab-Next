import { compileActionPlan } from '../../modules/animation/text-motion/compiler.js';
import { createDefaultMotionSkillRegistry } from '../skills/motion-skill-registry.js';
import { createMotionGoalAdapter } from './motion-goal-adapter.js';

/**
 * Contract for the execution boundary. Implementations receive semantic plans;
 * they never receive arbitrary text-derived joint rotations.
 */
export class MotionExecutionAdapter {
  prepare() { throw new Error('MotionExecutionAdapter.prepare() must be implemented.'); }
  start() { throw new Error('MotionExecutionAdapter.start() must be implemented.'); }
  update() { throw new Error('MotionExecutionAdapter.update() must be implemented.'); }
  pause() { return this.getResult(); }
  resume() { return this.getResult(); }
  cancel() { return this.getResult(); }
  getProgress() { return 0; }
  getCurrentNode() { return null; }
  getResult() { return { status: 'idle' }; }
  dispose() {}
}

/**
 * Compatibility bridge for the pre-existing AnimationClip pipeline. It invokes
 * the established compiler and exposes timeline progress only; it does not
 * reimplement animation sampling, graph evaluation, or the simulation rig.
 */
export class LegacyAnimationExecutionAdapter extends MotionExecutionAdapter {
  constructor({
    compiler = compileActionPlan,
    registry = createDefaultMotionSkillRegistry(),
    onClipReady = null,
  } = {}) {
    super();
    this.compiler = compiler;
    this.registry = registry;
    this.onClipReady = typeof onClipReady === 'function' ? onClipReady : null;
    this.reset();
  }

  prepare(plan, context = {}) {
    this.reset();
    this.plan = clone(plan);
    this.context = clone(context);
    const solverSkills = requiredSolverSkills(plan);
    if (solverSkills.length) {
      this.state = createState('requires_solver', {
        warnings: [`REQUIRES_SOLVER:${solverSkills.join(',')}`],
        error: createError('REQUIRES_SOLVER', 'The selected plan needs a Whole Body Solver.', { skills: solverSkills }),
      });
      return this.getResult();
    }
    try {
      const compiled = this.compiler(plan, {
        animationInput: context.animationInput || {},
        bodyProfile: context.bodyProfile || {},
        rigVersion: context.rigVersion || 'rig@0.4.0',
        sourceText: context.sourceText || plan?.sourceText || '',
        registry: context.registry || this.registry,
        targetProportionRevision: context.targetProportionRevision || 0,
      });
      if (compiled.status !== 'ready' || !compiled.clip) {
        this.state = createState('failed', {
          warnings: clone(compiled.warnings || []),
          error: createError('LEGACY_CLIP_COMPILE_FAILED', 'The existing AnimationClip compiler did not produce a legal clip.'),
          report: clone(compiled.report),
        });
        return this.getResult();
      }
      this.clip = clone(compiled.clip);
      this.state = createState('prepared', {
        duration: positive(this.clip.duration, estimatedDuration(plan)),
        warnings: clone(compiled.warnings || []),
        report: clone(compiled.report),
      });
    } catch (error) {
      this.state = createState('failed', {
        error: createError('LEGACY_CLIP_COMPILE_EXCEPTION', String(error?.message || error)),
      });
    }
    return this.getResult();
  }

  start() {
    if (this.state.status !== 'prepared') return this.getResult();
    this.state.status = 'running';
    this.state.started = true;
    if (this.clip && this.onClipReady) this.onClipReady({ clip: clone(this.clip), plan: clone(this.plan), context: clone(this.context) });
    return this.getResult();
  }

  update(deltaTime = 0) {
    const delta = nonNegative(deltaTime);
    if (this.state.status === 'running') {
      this.state.elapsed = Math.min(this.state.duration, this.state.elapsed + delta);
      updateTimelineState(this.state, this.plan);
      if (this.state.elapsed >= this.state.duration - 1e-8) {
        this.state.status = 'completed';
        this.state.completedNodeIds = timelineNodes(this.plan).map((node) => node.nodeId);
        this.state.currentNodeId = null;
        this.state.progress = 1;
      }
    } else if (this.state.status === 'recovering') {
      this.state.recovery.elapsed = Math.min(this.state.recovery.duration, this.state.recovery.elapsed + delta);
      if (this.state.recovery.elapsed >= this.state.recovery.duration - 1e-8) {
        this.state.recovery.status = 'completed';
        this.state.status = 'recovered';
      }
    }
    return this.getResult();
  }

  pause() {
    if (this.state.status === 'running') this.state.status = 'paused';
    return this.getResult();
  }

  resume() {
    if (this.state.status === 'paused') this.state.status = 'running';
    return this.getResult();
  }

  cancel(reason = 'cancelled') {
    if (['running', 'paused', 'prepared', 'recovering'].includes(this.state.status)) {
      this.state.status = 'cancelled';
      this.state.error = createError('CANCELLED', String(reason));
    }
    return this.getResult();
  }

  recover(skillId = 'return_to_idle') {
    this.state.status = 'recovering';
    this.state.recovery = { skillId: String(skillId), status: 'running', elapsed: 0, duration: 0.35 };
    return this.getResult();
  }

  getProgress() { return this.state.progress; }
  getCurrentNode() { return this.state.currentNodeId; }

  getResult() {
    return {
      status: this.state.status,
      clip: clone(this.clip),
      report: clone(this.state.report),
      warnings: clone(this.state.warnings),
      lastError: clone(this.state.error),
      elapsed: this.state.elapsed,
      duration: this.state.duration,
      progress: this.state.progress,
      currentNodeId: this.state.currentNodeId,
      completedNodeIds: clone(this.state.completedNodeIds),
      failedNodeIds: clone(this.state.failedNodeIds),
      recovery: clone(this.state.recovery),
    };
  }

  dispose() { this.reset(); }

  reset() {
    this.plan = null;
    this.context = null;
    this.clip = null;
    this.state = createState('idle');
  }
}

/** Deterministic semantic executor for scheduler tests and future solver integration tests. */
export class MockWholeBodyExecutionAdapter extends MotionExecutionAdapter {
  constructor({ failureNodeId = null, failureAt = null, recoveryDuration = 0.2 } = {}) {
    super();
    this.failureNodeId = failureNodeId == null ? null : String(failureNodeId);
    this.failureAt = failureAt == null ? null : Math.max(0, Number(failureAt) || 0);
    this.recoveryDuration = positive(recoveryDuration, 0.2);
    this.reset();
  }

  prepare(plan) {
    this.reset();
    this.plan = clone(plan);
    this.state = createState('prepared', { duration: estimatedDuration(plan) });
    return this.getResult();
  }

  start() {
    if (this.state.status === 'prepared') this.state.status = 'running';
    return this.getResult();
  }

  update(deltaTime = 0) {
    const delta = nonNegative(deltaTime);
    if (this.state.status === 'running') {
      this.state.elapsed = Math.min(this.state.duration, this.state.elapsed + delta);
      updateTimelineState(this.state, this.plan);
      const target = this.failureNodeId && timelineNodes(this.plan).find((node) => node.nodeId === this.failureNodeId);
      const failAt = this.failureAt == null ? target?.startTime ?? null : this.failureAt;
      if (target && failAt != null && this.state.elapsed >= failAt && !this.state.failedNodeIds.includes(target.nodeId)) {
        this.state.failedNodeIds = [target.nodeId];
        this.state.currentNodeId = target.nodeId;
        this.state.status = 'failed';
        this.state.error = createError('MOCK_NODE_FAILURE', `Mock solver failed ${target.nodeId}.`, { nodeId: target.nodeId });
      } else if (this.state.elapsed >= this.state.duration - 1e-8) {
        this.state.status = 'completed';
        this.state.completedNodeIds = timelineNodes(this.plan).map((node) => node.nodeId);
        this.state.currentNodeId = null;
        this.state.progress = 1;
      }
    } else if (this.state.status === 'recovering') {
      this.state.recovery.elapsed = Math.min(this.state.recovery.duration, this.state.recovery.elapsed + delta);
      if (this.state.recovery.elapsed >= this.state.recovery.duration - 1e-8) {
        this.state.recovery.status = 'completed';
        this.state.status = 'recovered';
      }
    }
    return this.getResult();
  }

  pause() { if (this.state.status === 'running') this.state.status = 'paused'; return this.getResult(); }
  resume() { if (this.state.status === 'paused') this.state.status = 'running'; return this.getResult(); }
  cancel(reason = 'cancelled') { this.state.status = 'cancelled'; this.state.error = createError('CANCELLED', String(reason)); return this.getResult(); }
  recover(skillId = 'return_to_idle') {
    this.state.status = 'recovering';
    this.state.recovery = { skillId: String(skillId), status: 'running', elapsed: 0, duration: this.recoveryDuration };
    return this.getResult();
  }
  getProgress() { return this.state.progress; }
  getCurrentNode() { return this.state.currentNodeId; }
  getResult() { return clone(this.state); }
  dispose() { this.reset(); }
  reset() { this.plan = null; this.state = createState('idle'); }
}

/**
 * Dependency-injected integration point for the parallel Whole Body Solver
 * branch. No solver module is imported from this branch.
 */
export class WholeBodyMotionExecutionAdapter extends MotionExecutionAdapter {
  constructor({ motionGoalAdapter = createMotionGoalAdapter(), executionFactory = null } = {}) {
    super();
    this.motionGoalAdapter = motionGoalAdapter;
    this.executionFactory = typeof executionFactory === 'function' ? executionFactory : null;
    this.delegate = null;
    this.result = createState('idle');
  }

  prepare(plan, context = {}) {
    const requests = (plan?.nodes || []).flatMap((node) => node.goalRequests || []);
    if (!this.motionGoalAdapter?.canCreateGoal || !this.motionGoalAdapter?.canCreateSolver || !this.executionFactory) {
      this.result = createState('requires_solver', {
        warnings: ['WHOLE_BODY_SOLVER_UNAVAILABLE'],
        error: createError('REQUIRES_SOLVER', 'A Whole Body Solver factory has not been injected.'),
      });
      return this.getResult();
    }
    const goals = requests.map((request) => this.motionGoalAdapter.createGoal(request, context));
    this.delegate = this.executionFactory({ plan: clone(plan), goals: clone(goals), context: clone(context) });
    if (!this.delegate || typeof this.delegate.prepare !== 'function') {
      this.result = createState('failed', { error: createError('WHOLE_BODY_EXECUTOR_INVALID', 'Injected Whole Body executor is invalid.') });
      return this.getResult();
    }
    this.result = this.delegate.prepare(plan, context) || createState('prepared');
    return this.getResult();
  }

  start() { return this.delegateCall('start'); }
  update(deltaTime) { return this.delegateCall('update', deltaTime); }
  pause() { return this.delegateCall('pause'); }
  resume() { return this.delegateCall('resume'); }
  cancel(reason) { return this.delegateCall('cancel', reason); }
  getProgress() { return Number(this.delegate?.getProgress?.() ?? this.result.progress ?? 0); }
  getCurrentNode() { return this.delegate?.getCurrentNode?.() ?? this.result.currentNodeId ?? null; }
  getResult() { return clone(this.delegate?.getResult?.() || this.result); }
  dispose() { this.delegate?.dispose?.(); this.delegate = null; this.result = createState('idle'); }

  delegateCall(method, value) {
    if (!this.delegate || typeof this.delegate[method] !== 'function') return this.getResult();
    this.result = this.delegate[method](value) || this.delegate.getResult?.() || this.result;
    return this.getResult();
  }
}

function requiredSolverSkills(plan) {
  return [...new Set([
    ...(Array.isArray(plan?.requiresSolverCapabilities) ? plan.requiresSolverCapabilities : []),
    ...(Array.isArray(plan?.nodes) ? plan.nodes.filter((node) => node.requiresSolver).map((node) => node.skillId) : []),
  ].map(String).filter(Boolean))];
}

function timelineNodes(plan) {
  return (Array.isArray(plan?.nodes) ? plan.nodes : []).map((node, index) => ({
    nodeId: String(node.nodeId || `node-${index + 1}`),
    skillId: String(node.skillId || 'idle'),
    startTime: Math.max(0, Number(node.startTime) || 0),
    duration: positive(node.duration, 0.1),
  })).sort((left, right) => left.startTime - right.startTime || left.nodeId.localeCompare(right.nodeId));
}

function updateTimelineState(state, plan) {
  const nodes = timelineNodes(plan);
  state.completedNodeIds = nodes.filter((node) => state.elapsed >= node.startTime + node.duration - 1e-8).map((node) => node.nodeId);
  const active = nodes.filter((node) => state.elapsed >= node.startTime - 1e-8 && state.elapsed < node.startTime + node.duration - 1e-8);
  state.currentNodeId = active[0]?.nodeId || nodes.find((node) => !state.completedNodeIds.includes(node.nodeId))?.nodeId || null;
  state.progress = state.duration > 0 ? Number(Math.min(1, state.elapsed / state.duration).toFixed(6)) : 1;
}

function estimatedDuration(plan) {
  const explicit = Number(plan?.estimatedDuration);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const nodes = timelineNodes(plan);
  return nodes.length ? Math.max(...nodes.map((node) => node.startTime + node.duration)) : 0.1;
}

function createState(status, {
  duration = 0,
  warnings = [],
  error = null,
  report = null,
} = {}) {
  return {
    status,
    elapsed: 0,
    duration: positive(duration, 0),
    progress: 0,
    currentNodeId: null,
    completedNodeIds: [],
    failedNodeIds: [],
    warnings: clone(warnings),
    error: clone(error),
    report: clone(report),
    recovery: null,
    started: false,
  };
}

function createError(code, message, details = null) { return { code, message: String(message), details: details == null ? null : clone(details) }; }
function positive(value, fallback) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : fallback; }
function nonNegative(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 0; }
function clone(value) { return value === undefined ? undefined : structuredClone(value); }
