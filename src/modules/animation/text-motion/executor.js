import {
  addClip,
  normalizeAnimationState,
  replaceClip,
  syncLegacyAnimationFields,
} from '../model.js';
import { createActorMotionContext } from '../../../human-motion/intelligence/actor-motion-context.js';
import { createMotionGoalAdapter } from '../../../human-motion/intelligence/motion-goal-adapter.js';
import { createMotionIntelligenceDiagnostics, executionDisplayStatus } from '../../../human-motion/intelligence/motion-intelligence-diagnostics.js';
import { LegacyAnimationExecutionAdapter, WholeBodyMotionExecutionAdapter } from '../../../human-motion/intelligence/motion-execution-adapter.js';
import { MotionExecutionScheduler } from '../../../human-motion/intelligence/motion-execution-scheduler.js';
import { planMotionIntent } from '../../../human-motion/intelligence/motion-planner.js';
import { RelativeWorldContextAdapter } from '../../../human-motion/world/world-context.js';
import { compileActionPlan } from './compiler.js';
import { parseMotionText } from './parser.js';
import { createDefaultMotionSkillRegistry } from './skill-registry.js';

const integrations = {
  motionGoalFactory: null,
  wholeBodySolverFactory: null,
  worldContextAdapter: null,
  motionExecutionAdapter: null,
};

/** Dependency injection hooks for the future Canonical/Solver integration branch. */
export function setMotionGoalFactory(factory = null) { integrations.motionGoalFactory = typeof factory === 'function' ? factory : null; }
export function setWholeBodySolverFactory(factory = null) { integrations.wholeBodySolverFactory = typeof factory === 'function' ? factory : null; }
export function setWorldContextAdapter(adapter = null) { integrations.worldContextAdapter = adapter || null; }
export function setMotionExecutionAdapter(adapterOrFactory = null) { integrations.motionExecutionAdapter = adapterOrFactory || null; }

export function parseAndPlanTextMotion(text, options = {}) {
  const {
    parser = parseMotionText,
    registry = createDefaultMotionSkillRegistry(),
    state = null,
  } = options;
  const actorContext = resolveActorContext(options, state);
  const worldContext = resolveWorldContext(options.worldContext, actorContext);
  const parserContext = {
    actorContext,
    occupationHint: options.occupationHint || actorContext.occupation?.id,
    dominantSide: options.dominantSide || actorContext.dominantSide,
    equipment: options.equipment || actorContext.equipment,
  };
  const parsed = typeof parser === 'function' ? parser(text, parserContext) : parser.parse(text, parserContext);
  const planned = planMotionIntent(parsed, {
    registry,
    worldContext,
    actorContext,
    defaultSide: options.defaultSide || null,
  });
  return {
    intent: planned.intent,
    plan: planned.plan,
    skillGraph: planned.skillGraph,
    actorContext: planned.actorContext,
    style: planned.style,
    worldContext,
  };
}

/** Pure preview: no ProjectHub transaction and no permanent AnimationSession mutation. */
export function previewTextMotion(text, {
  state = null,
  animationInput = state?.character?.animation || {},
  bodyProfile = state?.character?.bodyProfile || {},
  rigVersion = state?.activeVersions?.rig || 'rig@0.4.0',
  targetProportionRevision = state?.moduleRevisions?.proportion || 0,
  parser = parseMotionText,
  registry = createDefaultMotionSkillRegistry(),
  worldContext,
  actorContext,
  occupationHint,
  dominantSide,
  equipment,
  defaultSide,
} = {}) {
  const planned = parseAndPlanTextMotion(text, {
    parser, registry, state, worldContext, actorContext, occupationHint, dominantSide, equipment, defaultSide,
  });
  if (planned.plan.requiresSolverCapabilities?.length) {
    return {
      status: 'requires_solver',
      ...planned,
      clip: null,
      report: null,
      warnings: uniqueStrings([...planned.intent.warnings, ...planned.plan.warnings, 'REQUIRES_SOLVER']),
      compiledSkills: [],
      diagnostics: createMotionIntelligenceDiagnostics(planned),
    };
  }
  const compiled = compileActionPlan(planned.plan, {
    animationInput,
    bodyProfile,
    rigVersion,
    sourceText: planned.intent.sourceText,
    registry,
    targetProportionRevision,
  });
  const status = compiled.status === 'ready' ? planned.plan.status : compiled.status;
  return {
    status,
    ...planned,
    clip: compiled.clip,
    report: compiled.report,
    warnings: uniqueStrings([...(planned.intent.warnings || []), ...(planned.plan.warnings || []), ...(compiled.warnings || [])]),
    compiledSkills: compiled.compiledSkills || [],
    diagnostics: createMotionIntelligenceDiagnostics(planned),
  };
}

export function applyTextMotionToAnimation(animationInput, result, {
  compatibleRig = 'rig@0.4.0',
  targetProportionRevision = 0,
} = {}) {
  if (!result?.clip) throw new Error('Text motion result does not contain a generated AnimationClip.');
  const animation = normalizeAnimationState(animationInput, {
    compatibleRig,
    targetProportionRevision,
  });
  return replaceClip(animation, result.clip);
}

/** Saves only a plan/graph summary in one existing Animation module revision. */
export function saveTextMotionPlan(hub, text, options = {}) {
  assertHub(hub, 'saveTextMotionPlan');
  const before = hub.getState();
  const result = parseAndPlanTextMotion(text, { ...options, state: before });
  if (!result.plan || result.plan.status === 'empty') return { status: result.plan?.status || 'empty', ...result };
  hub.transaction((next) => {
    const animation = normalizeAnimationState(next.character.animation, {
      compatibleRig: next.activeVersions?.rig || 'rig@0.4.0',
      targetProportionRevision: next.moduleRevisions?.proportion || 0,
    });
    animation.textMotion = buildTextMotionState(animation.textMotion, {
      ...result,
      status: result.plan.status,
      warnings: uniqueStrings([...(result.intent.warnings || []), ...(result.plan.warnings || [])]),
    }, { generatedClipId: null });
    next.character.animation = syncLegacyAnimationFields(animation);
    next.modules.animation.status = 'developing';
    next.modules.animation.statusLabel = '文字动作计划已保存';
    next.modules.animation.currentTask = '已保存 MotionIntent、ActionPlan 与 MotionSkillGraph；执行进度保持为临时状态。';
  }, { module: 'animation', summary: `保存文字动作计划：${result.intent.sourceText}` });
  return { status: result.plan.status, ...result, state: hub.getState() };
}

/**
 * Commits exactly one Animation module transaction. Preview remains pure and
 * can be sent over the existing transient bus by the caller.
 */
export function commitTextMotion(hub, text, options = {}) {
  assertHub(hub, 'commitTextMotion');
  const before = hub.getState();
  const result = previewTextMotion(text, { ...options, state: before });
  if (!result.clip || ['unsupported', 'empty', 'requires_solver'].includes(result.status)) return result;
  hub.transaction((next) => {
    const animation = applyTextMotionToAnimation(next.character.animation, result, {
      compatibleRig: next.activeVersions?.rig || 'rig@0.4.0',
      targetProportionRevision: next.moduleRevisions?.proportion || 0,
    });
    animation.textMotion = buildTextMotionState(animation.textMotion, result, { generatedClipId: result.clip.clipId });
    next.character.animation = syncLegacyAnimationFields(animation);
    next.modules.animation.status = 'developing';
    next.modules.animation.statusLabel = '文字动作生成';
    next.modules.animation.progress = Math.max(Number(next.modules.animation.progress || 0), 82);
    next.modules.animation.currentTask = '验证文字动作解析、技能编排、合法 AnimationClip 编译与 simulationRig 交接';
  }, { module: 'animation', summary: `从文字生成并保存动作：${result.intent.sourceText}` });
  return { ...result, state: hub.getState() };
}

/** Creates and starts a transient scheduler; progress is intentionally not persisted per frame. */
export function executeTextMotion(text, {
  state = null,
  registry = createDefaultMotionSkillRegistry(),
  parser = parseMotionText,
  worldContext,
  actorContext,
  occupationHint,
  dominantSide,
  equipment,
  defaultSide,
  adapter = null,
  onClipReady = null,
  onSummary = () => {},
  summaryHz = 8,
} = {}) {
  const planned = parseAndPlanTextMotion(text, {
    state, registry, parser, worldContext, actorContext, occupationHint, dominantSide, equipment, defaultSide,
  });
  const executionAdapter = adapter || createConfiguredExecutionAdapter({ registry, onClipReady });
  const scheduler = new MotionExecutionScheduler({ adapter: executionAdapter, onSummary, summaryHz });
  let snapshot = scheduler.prepare({ ...planned }, executionContextFromState(state, planned, registry));
  if (snapshot.session.status === 'prepared') snapshot = scheduler.start();
  const status = executionDisplayStatus(snapshot.session);
  return {
    status,
    ...planned,
    ...snapshot,
    clip: snapshot.adapter?.clip || null,
    warnings: uniqueStrings([...(planned.intent.warnings || []), ...(planned.plan.warnings || []), ...(snapshot.session.warnings || [])]),
    diagnostics: createMotionIntelligenceDiagnostics({ ...planned, executionSession: snapshot.session }),
    scheduler,
  };
}

/** Optional explicit persistence boundary for a low-frequency final session summary. */
export function saveTextMotionExecutionSummary(hub, snapshot) {
  assertHub(hub, 'saveTextMotionExecutionSummary');
  const session = snapshot?.session;
  if (!session) throw new TypeError('saveTextMotionExecutionSummary() requires a scheduler snapshot.');
  hub.transaction((next) => {
    const animation = normalizeAnimationState(next.character.animation, {
      compatibleRig: next.activeVersions?.rig || 'rig@0.4.0',
      targetProportionRevision: next.moduleRevisions?.proportion || 0,
    });
    animation.textMotion = buildTextMotionState(animation.textMotion, {
      intent: null,
      plan: snapshot.plan,
      skillGraph: snapshot.skillGraph,
      actorContext: null,
      status: executionDisplayStatus(session),
      warnings: session.warnings || [],
      executionSession: session,
    });
    next.character.animation = syncLegacyAnimationFields(animation);
    next.modules.animation.statusLabel = '文字动作执行摘要已保存';
    next.modules.animation.currentTask = '执行摘要已保存；逐帧执行状态未写入 ProjectState。';
  }, { module: 'animation', summary: `保存文字动作执行摘要：${session.sessionId}` });
  return hub.getState();
}

export function addGeneratedTextMotion(animationInput, result, options = {}) {
  return addClip(
    normalizeAnimationState(animationInput, options),
    result?.clip,
  );
}

function createConfiguredExecutionAdapter({ registry, onClipReady }) {
  const configured = integrations.motionExecutionAdapter;
  if (configured) {
    if (typeof configured === 'function') {
      const instance = configured({
        goalFactory: integrations.motionGoalFactory,
        solverFactory: integrations.wholeBodySolverFactory,
        worldContextAdapter: integrations.worldContextAdapter,
        registry,
        onClipReady,
      });
      if (instance) return instance;
    } else return configured;
  }
  if (integrations.motionGoalFactory && integrations.wholeBodySolverFactory) {
    return new WholeBodyMotionExecutionAdapter({
      motionGoalAdapter: createMotionGoalAdapter({
        goalFactory: integrations.motionGoalFactory,
        solverFactory: integrations.wholeBodySolverFactory,
      }),
    });
  }
  return new LegacyAnimationExecutionAdapter({ registry, onClipReady });
}

function executionContextFromState(state, planned, registry) {
  return {
    animationInput: state?.character?.animation || {},
    bodyProfile: state?.character?.bodyProfile || {},
    rigVersion: state?.activeVersions?.rig || 'rig@0.4.0',
    targetProportionRevision: state?.moduleRevisions?.proportion || 0,
    sourceText: planned.intent?.sourceText || '',
    registry,
    worldContext: planned.worldContext || null,
  };
}

function buildTextMotionState(previous, result, { generatedClipId = undefined } = {}) {
  const prior = previous && typeof previous === 'object' ? structuredClone(previous) : {};
  const intent = result?.intent || null;
  return {
    ...prior,
    lastCommand: intent?.sourceText ?? prior.lastCommand ?? '',
    parseStatus: result?.status ?? prior.parseStatus ?? 'empty',
    actorContext: result?.actorContext ? structuredClone(result.actorContext) : (prior.actorContext ?? null),
    intent: intent ? structuredClone(intent) : (prior.intent ?? null),
    plan: result?.plan ? structuredClone(result.plan) : (prior.plan ?? null),
    skillGraph: result?.skillGraph ? structuredClone(result.skillGraph) : (prior.skillGraph ?? null),
    executionSession: result?.executionSession ? structuredClone(result.executionSession) : (prior.executionSession ?? null),
    generatedClipId: generatedClipId === undefined ? (prior.generatedClipId ?? null) : generatedClipId,
    warnings: uniqueStrings([...(prior.warnings || []), ...(result?.warnings || [])]),
  };
}

function resolveActorContext(options, state) {
  if (options.actorContext) return createActorMotionContext(options.actorContext);
  const stored = state?.character?.animation?.textMotion?.actorContext;
  return createActorMotionContext({
    ...(stored && typeof stored === 'object' ? stored : {}),
    actorId: options.actorId || stored?.actorId || 'actor_default',
    characterId: options.characterId || stored?.characterId || state?.characterCore?.active_character_id || 'character_001',
    occupation: options.occupationHint || options.occupation
      ? { id: options.occupationHint || options.occupation, label: String(options.occupationHint || options.occupation) }
      : stored?.occupation,
    dominantSide: options.dominantSide || stored?.dominantSide || 'right',
    equipment: options.equipment || stored?.equipment || [],
  });
}

function resolveWorldContext(worldContext, actorContext) {
  const selected = worldContext || integrations.worldContextAdapter || null;
  const resolved = typeof selected === 'function' ? selected(actorContext) : selected;
  return resolved || new RelativeWorldContextAdapter();
}

function assertHub(hub, name) {
  if (!hub || typeof hub.transaction !== 'function' || typeof hub.getState !== 'function') {
    throw new TypeError(`${name}() requires the existing ProjectHubClient.`);
  }
}

function uniqueStrings(values) { return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))]; }
