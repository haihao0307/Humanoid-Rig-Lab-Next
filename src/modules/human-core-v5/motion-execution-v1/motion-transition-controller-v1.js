export const MOTION_TRANSITION_CONTROLLER_V1_SCHEMA = 'humanoid_rig/motion_transition_controller@1.0';

export function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

export function smoothStep01(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function smootherStep01(value) {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function cosineEase01(value) {
  const t = clamp01(value);
  return (1 - Math.cos(Math.PI * t)) * 0.5;
}

export function normalizedPhase(time, startTime, endTime) {
  const duration = Math.max(1e-8, Number(endTime) - Number(startTime));
  return clamp01((Number(time) - Number(startTime)) / duration);
}

export function finiteDifference(current, previous, deltaTime) {
  const dt = Math.max(1e-8, Number(deltaTime) || 0);
  return current.map((value, index) => (Number(value) - Number(previous[index])) / dt);
}

export function createMotionTransitionControllerV1() {
  return Object.freeze({
    schema: MOTION_TRANSITION_CONTROLLER_V1_SCHEMA,
    positionCurve: 'quintic-smootherstep',
    rotationCurve: 'cosine-ease',
    swingCurve: 'sinusoidal-clearance',
    settleCurve: 'critically-damped-analytic',
    samplePosition: smootherStep01,
    sampleRotation: cosineEase01,
  });
}
