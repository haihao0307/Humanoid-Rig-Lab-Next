import { cosineEase01, normalizedPhase } from './motion-transition-controller-v1.js';

export const FOOTSTEP_PLAN_V1_SCHEMA = 'humanoid_rig/footstep_plan@1.0';

const DEFAULTS = Object.freeze({
  footSpacing: 0.32,
  footJointHeight: 0.105,
  footForwardOffset: -0.018,
  walkStepAdvance: 0.60,
  walkStepInterval: 0.46,
  walkSwingDelay: 0.06,
  walkSwingDuration: 0.32,
  turnStepInterval: 0.56,
  turnSwingDelay: 0.08,
  turnSwingDuration: 0.36,
  footClearance: 0.085,
  prepareDuration: 0.32,
  settleDuration: 1.2,
});

export function createWalkFootstepPlanV1(input = {}) {
  const startPosition = vector3(input.startPosition);
  const targetPosition = vector3(input.targetPosition);
  const startFacing = finite(input.startFacing, yawTo(startPosition, targetPosition));
  const targetFacing = finite(input.targetFacing, yawTo(startPosition, targetPosition));
  const distance = horizontalDistance(startPosition, targetPosition);
  const stepsPerFoot = Math.max(1, Math.ceil(distance / positive(input.stepAdvance, DEFAULTS.walkStepAdvance)));
  const totalSteps = stepsPerFoot * 2;
  const interval = positive(input.stepInterval, DEFAULTS.walkStepInterval);
  const prepareDuration = positive(input.prepareDuration, DEFAULTS.prepareDuration);
  const settleDuration = positive(input.settleDuration, DEFAULTS.settleDuration);
  const swingDelay = Math.min(interval * 0.3, positive(input.swingDelay, DEFAULTS.walkSwingDelay));
  const swingDuration = Math.min(interval - swingDelay, positive(input.swingDuration, DEFAULTS.walkSwingDuration));
  const footState = {
    left: footAtActor(startPosition, startFacing, 'left', input),
    right: footAtActor(startPosition, startFacing, 'right', input),
  };
  const steps = [];
  const completedBySide = { left: 0, right: 0 };
  for (let index = 0; index < totalSteps; index += 1) {
    const side = index % 2 === 0 ? 'left' : 'right';
    completedBySide[side] += 1;
    const progress = completedBySide[side] / stepsPerFoot;
    const actorPosition = lerp3(startPosition, targetPosition, progress);
    const actorFacing = lerpAngle(startFacing, targetFacing, progress);
    const startTime = prepareDuration + index * interval + swingDelay;
    const endTime = startTime + swingDuration;
    const endPosition = footAtActor(actorPosition, actorFacing, side, input);
    const step = createStep({
      index, side, purpose: index >= totalSteps - 2 ? 'final-placement' : 'walk-progression',
      startTime, endTime, startPosition: footState[side], endPosition,
      startYaw: footState[side].yaw, endYaw: actorFacing,
      clearance: positive(input.footClearance, DEFAULTS.footClearance),
    });
    steps.push(step);
    footState[side] = { position: [...endPosition.position], yaw: actorFacing };
  }
  const walkEndTime = prepareDuration + totalSteps * interval;
  return createPlan({
    planId: input.planId || 'walk-footsteps-v1',
    mode: 'walk_to_target', startPosition, targetPosition, startFacing, targetFacing,
    steps, duration: walkEndTime + settleDuration, prepareDuration, movementEndTime: walkEndTime,
    settleDuration, initialFeet: initialFeet(startPosition, startFacing, input),
    finalFeet: structuredClone(footState), preferredSpeed: positive(input.preferredSpeed, 0.9),
  });
}

export function createTurnFootstepPlanV1(input = {}) {
  const startPosition = vector3(input.startPosition);
  const startFacing = finite(input.startFacing, 0);
  const direction = input.direction === 'right' ? 'right' : 'left';
  const angleDegrees = Number(input.angleDegrees) === 90 ? 90 : 180;
  const signedAngle = radians(angleDegrees) * (direction === 'left' ? -1 : 1);
  const targetFacing = normalizeAngle(startFacing + signedAngle);
  const stepsPerFoot = angleDegrees / 90;
  const totalSteps = stepsPerFoot * 2;
  const interval = positive(input.stepInterval, DEFAULTS.turnStepInterval);
  const prepareDuration = positive(input.prepareDuration, 0.38);
  const settleDuration = positive(input.settleDuration, DEFAULTS.settleDuration);
  const swingDelay = Math.min(interval * 0.3, positive(input.swingDelay, DEFAULTS.turnSwingDelay));
  const swingDuration = Math.min(interval - swingDelay, positive(input.swingDuration, DEFAULTS.turnSwingDuration));
  const footState = {
    left: footAtActor(startPosition, startFacing, 'left', input),
    right: footAtActor(startPosition, startFacing, 'right', input),
  };
  const completedBySide = { left: 0, right: 0 };
  const firstSide = direction === 'left' ? 'left' : 'right';
  const steps = [];
  for (let index = 0; index < totalSteps; index += 1) {
    const side = index % 2 === 0 ? firstSide : opposite(firstSide);
    completedBySide[side] += 1;
    const progress = completedBySide[side] / stepsPerFoot;
    const yaw = normalizeAngle(startFacing + signedAngle * progress);
    const endPosition = footAtActor(startPosition, yaw, side, input);
    const startTime = prepareDuration + index * interval + swingDelay;
    const endTime = startTime + swingDuration;
    const step = createStep({
      index, side, purpose: progress === 1 ? 'turn-final-placement' : 'turn-intermediate-placement',
      startTime, endTime, startPosition: footState[side], endPosition,
      startYaw: footState[side].yaw, endYaw: yaw,
      clearance: positive(input.footClearance, DEFAULTS.footClearance),
    });
    steps.push(step);
    footState[side] = { position: [...endPosition.position], yaw };
  }
  const movementEndTime = prepareDuration + totalSteps * interval;
  return createPlan({
    planId: input.planId || `turn-${direction}-${angleDegrees}-footsteps-v1`,
    mode: 'turn_in_place', direction, angleDegrees, startPosition,
    targetPosition: startPosition, startFacing, targetFacing, steps,
    duration: movementEndTime + settleDuration, prepareDuration, movementEndTime,
    settleDuration, initialFeet: initialFeet(startPosition, startFacing, input),
    finalFeet: structuredClone(footState), preferredSpeed: 0,
  });
}

export function createIdleFootstepPlanV1(input = {}) {
  const startPosition = vector3(input.startPosition);
  const startFacing = finite(input.startFacing, 0);
  const duration = positive(input.duration, 4);
  const feet = initialFeet(startPosition, startFacing, input);
  return createPlan({
    planId: input.planId || 'idle-footsteps-v1', mode: 'idle', startPosition,
    targetPosition: startPosition, startFacing, targetFacing: startFacing,
    steps: [], duration, prepareDuration: 0, movementEndTime: 0, settleDuration: duration,
    initialFeet: feet, finalFeet: structuredClone(feet), preferredSpeed: 0,
  });
}

export function createStopFootstepPlanV1(input = {}) {
  const plan = createIdleFootstepPlanV1({ ...input, duration: positive(input.duration, DEFAULTS.settleDuration) });
  return {
    ...plan,
    planId: input.planId || 'stop-and-settle-footsteps-v1',
    mode: 'stop_and_settle',
    settleDuration: plan.duration,
  };
}

export function sampleFootstepPlanV1(plan, rawTime) {
  const time = Math.min(plan.duration, Math.max(0, finite(rawTime, 0)));
  const feet = structuredClone(plan.initialFeet);
  let activeStep = null;
  const completedSteps = [];
  for (const step of plan.steps) {
    if (time >= step.endTime) {
      feet[step.side] = { position: [...step.endPosition], yaw: step.endYaw };
      completedSteps.push(step.stepId);
      continue;
    }
    if (time >= step.startTime && time < step.endTime) {
      const phase = normalizedPhase(time, step.startTime, step.endTime);
      const eased = cosineEase01(phase);
      const position = lerp3(step.startPosition, step.endPosition, eased);
      position[1] += Math.sin(Math.PI * phase) * step.clearance;
      feet[step.side] = { position, yaw: lerpAngle(step.startYaw, step.endYaw, eased) };
      activeStep = { ...step, phase };
    }
  }
  const supportState = activeStep ? opposite(activeStep.side) : 'double_support';
  const leftState = activeStep?.side === 'left' ? 'swing' : 'stance';
  const rightState = activeStep?.side === 'right' ? 'swing' : 'stance';
  const motionPhase = classifyMotionPhase(plan, time, activeStep);
  return {
    time, feet, activeStep,
    completedSteps,
    leftFootState: leftState,
    rightFootState: rightState,
    supportState,
    motionPhase,
    transition: transitionAtTime(plan, time),
  };
}

function createPlan(input) {
  return {
    schema: FOOTSTEP_PLAN_V1_SCHEMA,
    type: 'FootstepPlan',
    ...input,
    events: input.steps.flatMap((step) => [
      { eventId: `${step.stepId}-toe-off`, eventType: 'toe_off', foot: step.side, time: step.startTime },
      { eventId: `${step.stepId}-heel-strike`, eventType: 'heel_strike', foot: step.side, time: step.endTime },
    ]),
    deterministic: true,
    alternatesFeet: input.steps.every((step, index, steps) => index === 0 || steps[index - 1].side !== step.side),
    nonRootPositionTracks: false,
  };
}

function createStep({ index, side, purpose, startTime, endTime, startPosition, endPosition, startYaw, endYaw, clearance }) {
  return {
    stepId: `footstep-${String(index + 1).padStart(2, '0')}-${side}`,
    index, side, purpose, startTime, endTime,
    startPosition: [...startPosition.position],
    endPosition: [...endPosition.position],
    startYaw, endYaw, clearance,
  };
}

function initialFeet(actorPosition, facing, options) {
  return {
    left: footAtActor(actorPosition, facing, 'left', options),
    right: footAtActor(actorPosition, facing, 'right', options),
  };
}

function footAtActor(actorPosition, facing, side, options) {
  const spacing = positive(options?.footSpacing, DEFAULTS.footSpacing);
  const local = [side === 'left' ? -spacing * 0.5 : spacing * 0.5, 0, finite(options?.footForwardOffset, DEFAULTS.footForwardOffset)];
  const rotated = rotateYaw(local, facing);
  return {
    position: [
      actorPosition[0] + rotated[0],
      actorPosition[1] + positive(options?.footJointHeight, DEFAULTS.footJointHeight),
      actorPosition[2] + rotated[2],
    ],
    yaw: facing,
  };
}

function classifyMotionPhase(plan, time, activeStep) {
  if (time < plan.prepareDuration) return 'prepare';
  if (activeStep) return activeStep.phase < 0.2 ? 'toe_off' : activeStep.phase > 0.8 ? 'heel_strike' : 'swing';
  if (time < plan.movementEndTime) return 'double_support_transfer';
  if (time < plan.duration) return 'stop_and_settle';
  return 'complete';
}

function transitionAtTime(plan, time) {
  const epsilon = 1 / 120;
  return plan.events.find((event) => Math.abs(event.time - time) <= epsilon) ?? null;
}

function opposite(side) { return side === 'left' ? 'right' : 'left'; }
function vector3(value) { return [0, 1, 2].map((index) => finite(value?.[index], 0)); }
function positive(value, fallback) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : fallback; }
function finite(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function radians(value) { return value * Math.PI / 180; }
function horizontalDistance(a, b) { return Math.hypot(b[0] - a[0], b[2] - a[2]); }
function yawTo(a, b) { return Math.atan2(b[0] - a[0], b[2] - a[2]); }
function normalizeAngle(value) { return Math.atan2(Math.sin(value), Math.cos(value)); }
function lerp3(a, b, t) { return a.map((value, index) => value + (b[index] - value) * t); }
function lerpAngle(a, b, t) { return normalizeAngle(a + normalizeAngle(b - a) * t); }
function rotateYaw([x, y, z], yaw) { const c = Math.cos(yaw); const s = Math.sin(yaw); return [x * c + z * s, y, -x * s + z * c]; }
