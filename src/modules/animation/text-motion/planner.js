import { RelativeWorldContextAdapter } from './adapters.js';
import {
  normalizeMotionIntent,
  stableHash,
  stableStringify,
} from './intent.js';
import { createDefaultMotionSkillRegistry } from './skill-registry.js';

export const ACTION_PLAN_SCHEMA = 'humanoid_rig/action_plan@1.0';

export const MOTION_COORDINATE_SYSTEM = Object.freeze({
  handedness: 'right',
  upAxis: '+Y',
  forwardAxis: '+Z',
  rightAxis: '+X',
});

export function createActionPlan(intentInput, {
  registry = createDefaultMotionSkillRegistry(),
  worldContext = new RelativeWorldContextAdapter(),
  defaultSide = 'right',
} = {}) {
  const intent = normalizeMotionIntent(intentInput);
  const warnings = [...intent.warnings];
  const missingSkills = [...intent.missingSkills];
  const steps = [];
  const actionToStep = new Map();
  const requiredSkills = new Set();
  const requiredChains = new Set();
  const unresolvedTargets = new Set();

  for (const [index, action] of intent.actions.entries()) {
    let skillId = action.skillId || action.verb;
    if (skillId === 'walk' && action.direction === 'backward') skillId = 'walk_backward';
    const resolved = registry.resolve(skillId) || registry.resolve(action.verb);
    if (!resolved) {
      missingSkills.push(skillId || action.verb || `action-${index + 1}`);
      warnings.push(`MISSING_SKILL:${skillId || action.verb || 'unknown'}`);
      continue;
    }

    const parameters = normalizeActionParameters(action, resolved, { defaultSide, warnings });
    if (parameters.target) {
      const resolvedTarget = worldContext?.resolveTarget?.(parameters.target, parameters) || null;
      if (resolvedTarget) parameters.resolvedTarget = structuredClone(resolvedTarget);
      else unresolvedTargets.add(parameters.target);
    }
    const duration = resolveDuration(parameters, resolved);
    const step = {
      stepId: `step-${steps.length + 1}`,
      actionId: action.actionId,
      skillId: resolved.skillId,
      mode: resolved.mode,
      parameters,
      startAfter: [],
      startTime: 0,
      duration,
      blendIn: Math.min(0.12, duration * 0.15),
      blendOut: Math.min(0.12, duration * 0.15),
      layer: resolved.layer,
      requiredChains: [...resolved.requiredChains],
    };
    steps.push(step);
    actionToStep.set(action.actionId, step);
    requiredSkills.add(resolved.skillId);
    resolved.requiredChains.forEach((chain) => requiredChains.add(chain));
  }

  for (const relation of intent.sequenceRelations) {
    const before = actionToStep.get(relation.beforeActionId);
    const after = actionToStep.get(relation.afterActionId);
    if (!before || !after) continue;
    after.startAfter = [...new Set([...after.startAfter, before.stepId])];
  }

  const parallelGroups = intent.parallelRelations.map((relation) => ({
    groupId: relation.groupId,
    actionIds: relation.actionIds.filter((actionId) => actionToStep.has(actionId)),
  })).filter((group) => group.actionIds.length > 1);

  scheduleSteps(steps, parallelGroups);
  const estimatedDuration = steps.length ? Math.max(...steps.map((step) => step.startTime + step.duration)) : 0;
  const rootMotionPolicy = steps.some((step) => registry.get(step.skillId)?.rootMotionPolicy === 'root_motion')
    ? 'root_motion'
    : 'in_place';
  const status = missingSkills.length ? 'unsupported' : steps.length ? 'ready' : 'empty';
  const planContent = {
    sourceIntentId: intent.intentId,
    steps,
    parallelGroups,
    requiredSkills: [...requiredSkills].sort(),
    requiredChains: [...requiredChains].sort(),
    estimatedDuration,
    rootMotionPolicy,
    contactPolicy: 'preserve',
    unresolvedTargets: [...unresolvedTargets].sort(),
  };

  return {
    schema: ACTION_PLAN_SCHEMA,
    planId: `action-plan-${stableHash(stableStringify(planContent))}`,
    sourceIntentId: intent.intentId,
    status,
    coordinateSystem: structuredClone(MOTION_COORDINATE_SYSTEM),
    steps,
    parallelGroups,
    requiredSkills: [...requiredSkills].sort(),
    requiredChains: [...requiredChains].sort(),
    estimatedDuration,
    rootMotionPolicy,
    contactPolicy: 'preserve',
    unresolvedTargets: [...unresolvedTargets].sort(),
    warnings: uniqueStrings(warnings),
    missingSkills: uniqueStrings(missingSkills),
  };
}

export function validateActionPlan(input) {
  const plan = input && typeof input === 'object' ? input : {};
  const errors = [];
  if (plan.schema !== ACTION_PLAN_SCHEMA) errors.push('ACTION_PLAN_SCHEMA_INVALID');
  if (!plan.planId) errors.push('ACTION_PLAN_ID_MISSING');
  if (!plan.coordinateSystem || plan.coordinateSystem.forwardAxis !== '+Z') errors.push('ACTION_PLAN_COORDINATE_SYSTEM_INVALID');
  if (!Array.isArray(plan.steps)) errors.push('ACTION_PLAN_STEPS_INVALID');
  for (const step of plan.steps || []) {
    if (!step.stepId || !step.skillId) errors.push('ACTION_PLAN_STEP_ID_OR_SKILL_MISSING');
    if (!Number.isFinite(Number(step.duration)) || Number(step.duration) <= 0) errors.push(`ACTION_PLAN_STEP_DURATION_INVALID:${step.stepId}`);
    if (!Array.isArray(step.requiredChains)) errors.push(`ACTION_PLAN_STEP_CHAINS_INVALID:${step.stepId}`);
  }
  return { valid: errors.length === 0, errors: uniqueStrings(errors), warnings: uniqueStrings(plan.warnings) };
}

function normalizeActionParameters(action, skill, { defaultSide, warnings }) {
  const parameters = {
    direction: action.direction || null,
    side: action.side || null,
    target: action.target || null,
    distanceMeters: numberOrNull(action.distanceMeters),
    stepCount: integerOrNull(action.stepCount),
    durationSeconds: numberOrNull(action.durationSeconds),
    speed: action.speed || 'normal',
    angleDegrees: numberOrNull(action.angleDegrees),
    repeatCount: integerOrNull(action.repeatCount) || 1,
    modifiers: [...(action.modifiers || [])],
  };
  if ((skill.skillId === 'walk' || skill.skillId === 'walk_backward') && !parameters.direction) {
    parameters.direction = 'forward';
    warnings.push('DEFAULT_DIRECTION_APPLIED');
  }
  if ((skill.skillId === 'walk' || skill.skillId === 'walk_backward') && !parameters.distanceMeters && !parameters.stepCount) {
    parameters.distanceMeters = 0.72;
    warnings.push('DEFAULT_DISTANCE_APPLIED');
  }
  if ((skill.skillId === 'walk' || skill.skillId === 'walk_backward') && !parameters.distanceMeters && parameters.stepCount) {
    parameters.distanceMeters = parameters.stepCount * 0.36;
    warnings.push('STEP_DISTANCE_INFERRED');
  }
  if (['wave', 'salute', 'reach', 'point'].includes(skill.skillId) && !parameters.side) {
    parameters.side = defaultSide;
    warnings.push('DEFAULT_SIDE_APPLIED');
  }
  if (skill.skillId === 'turn' && !parameters.side && parameters.direction) {
    parameters.side = ['left', 'left_forward', 'left_backward'].includes(parameters.direction) ? 'left' : 'right';
  }
  return parameters;
}

function resolveDuration(parameters, skill) {
  const requested = numberOrNull(parameters.durationSeconds);
  const speedScale = parameters.speed === 'slow' ? 1.35 : parameters.speed === 'fast' ? 0.7 : parameters.speed === 'gentle' ? 1.15 : 1;
  let duration = requested || skill.defaultDuration;
  if (['walk', 'walk_backward'].includes(skill.skillId)) {
    const stepCount = parameters.stepCount || Math.max(1, Math.round((parameters.distanceMeters || 0.72) / 0.36));
    duration = requested || stepCount * 0.6;
  }
  duration *= speedScale;
  duration *= Math.max(1, parameters.repeatCount || 1);
  return Math.max(0.05, Number(duration.toFixed(6)));
}

function scheduleSteps(steps, parallelGroups) {
  const byId = new Map(steps.map((step) => [step.stepId, step]));
  const groups = parallelGroups.map((group) => ({
    ...group,
    steps: group.actionIds.map((actionId) => steps.find((step) => step.actionId === actionId)).filter(Boolean),
  }));
  for (let pass = 0; pass < steps.length + groups.length + 2; pass += 1) {
    for (const step of steps) {
      const dependencyEnd = Math.max(0, ...step.startAfter.map((stepId) => {
        const dependency = byId.get(stepId);
        return dependency ? dependency.startTime + dependency.duration : 0;
      }));
      step.startTime = Math.max(step.startTime, dependencyEnd);
    }
    for (const group of groups) {
      const groupStart = Math.max(0, ...group.steps.flatMap((step) => step.startAfter.map((stepId) => {
        const dependency = byId.get(stepId);
        return dependency ? dependency.startTime + dependency.duration : 0;
      })));
      for (const step of group.steps) step.startTime = Math.max(step.startTime, groupStart);
    }
  }
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];
}
