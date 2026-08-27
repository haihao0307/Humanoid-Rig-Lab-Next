export const MOTION_INTENT_V1_SCHEMA = 'humanoid_rig/motion_intent@1.0';

const INTENT_TYPES = new Set(['idle', 'turn_in_place', 'walk_to_target', 'stop_and_settle']);

export function createMotionIntentV1(input = {}) {
  const startFacing = finite(input.startFacing, 0);
  const intent = {
    schema: MOTION_INTENT_V1_SCHEMA,
    type: 'MotionIntent',
    intentType: INTENT_TYPES.has(input.intentType) ? input.intentType : 'idle',
    startPosition: vector3(input.startPosition),
    startFacing,
    targetPosition: vector3(input.targetPosition ?? input.startPosition),
    targetFacing: finite(input.targetFacing, startFacing),
    preferredSpeed: positive(input.preferredSpeed, 0.9),
    stopRadius: positive(input.stopRadius, 0.03),
    groundNormal: normalizedVector3(input.groundNormal, [0, 1, 0]),
    collisionPolicy: String(input.collisionPolicy || 'clear-straight-path-development-only'),
    turnDirection: ['left', 'right'].includes(input.turnDirection) ? input.turnDirection : null,
    turnAngleDegrees: Math.max(0, finite(input.turnAngleDegrees, 0)),
    targetId: input.targetId == null ? null : String(input.targetId),
  };
  assertMotionIntentV1(intent);
  return intent;
}

export function validateMotionIntentV1(value) {
  const errors = [];
  if (!value || value.schema !== MOTION_INTENT_V1_SCHEMA || value.type !== 'MotionIntent') {
    errors.push(`schema must be ${MOTION_INTENT_V1_SCHEMA} and type must be MotionIntent.`);
    return { valid: false, errors };
  }
  if (!INTENT_TYPES.has(value.intentType)) errors.push('intentType is unsupported.');
  for (const key of ['startPosition', 'targetPosition', 'groundNormal']) {
    if (!Array.isArray(value[key]) || value[key].length !== 3 || value[key].some((item) => !Number.isFinite(item))) {
      errors.push(`${key} must be a finite vec3.`);
    }
  }
  for (const key of ['startFacing', 'targetFacing', 'preferredSpeed', 'stopRadius']) {
    if (!Number.isFinite(Number(value[key]))) errors.push(`${key} must be finite.`);
  }
  if (value.intentType === 'turn_in_place') {
    if (!['left', 'right'].includes(value.turnDirection)) errors.push('turnDirection is required for turn_in_place.');
    if (![90, 180].includes(value.turnAngleDegrees)) errors.push('turnAngleDegrees must be 90 or 180.');
  }
  return { valid: errors.length === 0, errors };
}

export function assertMotionIntentV1(value) {
  const result = validateMotionIntentV1(value);
  if (!result.valid) throw new Error(`Invalid MotionIntentV1: ${result.errors.join(' ')}`);
  return value;
}

function vector3(value) {
  return [0, 1, 2].map((index) => finite(value?.[index], 0));
}

function normalizedVector3(value, fallback) {
  const result = vector3(value ?? fallback);
  const length = Math.hypot(...result);
  return length > 1e-8 ? result.map((component) => component / length) : [...fallback];
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
