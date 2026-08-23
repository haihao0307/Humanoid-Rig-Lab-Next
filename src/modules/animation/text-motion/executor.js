import {
  addClip,
  normalizeAnimationState,
  replaceClip,
  syncLegacyAnimationFields,
} from '../model.js';
import { compileActionPlan } from './compiler.js';
import { parseMotionText } from './parser.js';
import { createActionPlan } from './planner.js';
import { createDefaultMotionSkillRegistry } from './skill-registry.js';

export function parseAndPlanTextMotion(text, {
  parser = parseMotionText,
  registry = createDefaultMotionSkillRegistry(),
  worldContext,
} = {}) {
  const intent = typeof parser === 'function' ? parser(text) : parser.parse(text);
  const plan = createActionPlan(intent, { registry, worldContext });
  return { intent, plan };
}

export function previewTextMotion(text, {
  state = null,
  animationInput = state?.character?.animation || {},
  bodyProfile = state?.character?.bodyProfile || {},
  rigVersion = state?.activeVersions?.rig || 'rig@0.4.0',
  targetProportionRevision = state?.moduleRevisions?.proportion || 0,
  parser = parseMotionText,
  registry = createDefaultMotionSkillRegistry(),
  worldContext,
} = {}) {
  const { intent, plan } = parseAndPlanTextMotion(text, { parser, registry, worldContext });
  const compiled = compileActionPlan(plan, {
    animationInput,
    bodyProfile,
    rigVersion,
    sourceText: intent.sourceText,
    registry,
    targetProportionRevision,
  });
  return {
    status: compiled.status === 'ready' ? plan.status : compiled.status,
    intent,
    plan,
    clip: compiled.clip,
    report: compiled.report,
    warnings: [...new Set([...(intent.warnings || []), ...(plan.warnings || []), ...(compiled.warnings || [])])],
    compiledSkills: compiled.compiledSkills || [],
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

/**
 * Commits exactly one Animation module transaction. Preview remains pure and
 * can be sent over the existing transient bus by the caller.
 */
export function commitTextMotion(hub, text, options = {}) {
  if (!hub || typeof hub.transaction !== 'function' || typeof hub.getState !== 'function') {
    throw new TypeError('commitTextMotion() requires the existing ProjectHubClient.');
  }
  const before = hub.getState();
  const result = previewTextMotion(text, { ...options, state: before });
  if (!result.clip || result.status === 'unsupported' || result.status === 'empty') return result;
  hub.transaction((next) => {
    const animation = applyTextMotionToAnimation(next.character.animation, result, {
      compatibleRig: next.activeVersions?.rig || 'rig@0.4.0',
      targetProportionRevision: next.moduleRevisions?.proportion || 0,
    });
    animation.textMotion = {
      lastCommand: result.intent.sourceText,
      parseStatus: result.status,
      intent: structuredClone(result.intent),
      plan: structuredClone(result.plan),
      generatedClipId: result.clip.clipId,
      warnings: [...result.warnings],
    };
    next.character.animation = syncLegacyAnimationFields(animation);
    next.modules.animation.status = 'developing';
    next.modules.animation.statusLabel = '文字动作生成';
    next.modules.animation.progress = Math.max(Number(next.modules.animation.progress || 0), 82);
    next.modules.animation.currentTask = '验证文字动作解析、技能编排、局部四元数编译与 simulationRig 交接';
  }, { module: 'animation', summary: `从文字生成并保存动作：${result.intent.sourceText}` });
  return { ...result, state: hub.getState() };
}

export function addGeneratedTextMotion(animationInput, result, options = {}) {
  return addClip(
    normalizeAnimationState(animationInput, options),
    result?.clip,
  );
}
