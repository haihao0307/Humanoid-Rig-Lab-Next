import { createMotionIntentV1 } from './motion-intent-v1.js';

export const BEHAVIOR_PLAN_V1_SCHEMA = 'humanoid_rig/behavior_plan@1.0';

const STEP_TYPES = new Set(['idle', 'turn_in_place', 'walk_to_target', 'stop_and_settle']);
const PLAN_STATUS = new Set(['planned', 'running', 'completed', 'failed', 'stopped']);

export function createBehaviorPlanV1(input = {}) {
  const steps = Array.isArray(input.steps) ? input.steps.map(normalizeStep) : [];
  if (!steps.length) throw new Error('BehaviorPlanV1 requires at least one step.');
  const plan = {
    schema: BEHAVIOR_PLAN_V1_SCHEMA,
    type: 'BehaviorPlan',
    planId: stableId(input.planId, 'behavior-plan-v1'),
    sourceCommandId: stableId(input.sourceCommandId, 'behavior-command-v1'),
    steps,
    preconditions: Array.isArray(input.preconditions) ? structuredClone(input.preconditions) : [],
    completionCriteria: Array.isArray(input.completionCriteria)
      ? structuredClone(input.completionCriteria)
      : ['all-steps-completed', 'final-double-support', 'settled-for-one-second'],
    failurePolicy: String(input.failurePolicy || 'stop-safe-and-report'),
    currentStep: Math.min(steps.length - 1, Math.max(0, Math.floor(Number(input.currentStep) || 0))),
    status: PLAN_STATUS.has(input.status) ? input.status : 'planned',
    generalNaturalLanguageSupport: false,
    developmentGrammarOnly: true,
  };
  return plan;
}

export function areBehaviorPlansEquivalentV1(left, right) {
  return stableStringify(canonicalPlan(left)) === stableStringify(canonicalPlan(right));
}

export function canonicalBehaviorPlanV1(plan) {
  return canonicalPlan(plan);
}

function normalizeStep(step, index) {
  const stepType = STEP_TYPES.has(step?.stepType) ? step.stepType : 'idle';
  return {
    stepId: stableId(step?.stepId, `step-${index + 1}`),
    stepType,
    intent: createMotionIntentV1({ ...step?.intent, intentType: stepType }),
    completionCriteria: Array.isArray(step?.completionCriteria)
      ? structuredClone(step.completionCriteria)
      : defaultCriteria(stepType),
    status: PLAN_STATUS.has(step?.status) ? step.status : 'planned',
  };
}

function defaultCriteria(stepType) {
  if (stepType === 'turn_in_place') return ['yaw-within-2-degrees', 'double-support'];
  if (stepType === 'walk_to_target') return ['position-within-stop-radius', 'alternating-steps-complete'];
  if (stepType === 'stop_and_settle') return ['root-speed-below-threshold', 'settled-for-one-second'];
  return ['duration-complete'];
}

function canonicalPlan(plan) {
  return {
    steps: (plan?.steps ?? []).map((step) => ({
      stepType: step.stepType,
      intent: {
        intentType: step.intent?.intentType,
        startPosition: step.intent?.startPosition,
        startFacing: step.intent?.startFacing,
        targetPosition: step.intent?.targetPosition,
        targetFacing: step.intent?.targetFacing,
        preferredSpeed: step.intent?.preferredSpeed,
        stopRadius: step.intent?.stopRadius,
        groundNormal: step.intent?.groundNormal,
        collisionPolicy: step.intent?.collisionPolicy,
        turnDirection: step.intent?.turnDirection,
        turnAngleDegrees: step.intent?.turnAngleDegrees,
        targetId: step.intent?.targetId,
      },
      completionCriteria: step.completionCriteria,
    })),
    preconditions: plan?.preconditions ?? [],
    completionCriteria: plan?.completionCriteria ?? [],
    failurePolicy: plan?.failurePolicy,
    generalNaturalLanguageSupport: false,
    developmentGrammarOnly: true,
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableId(value, fallback) {
  const result = String(value || fallback);
  return /^[A-Za-z][A-Za-z0-9._-]*$/.test(result) ? result : fallback;
}
