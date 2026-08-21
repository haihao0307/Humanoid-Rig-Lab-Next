export const FACE_EXPRESSION_SCHEMA = 'humanoid_rig/face_expression@1.0';

export const FACE_EXPRESSION_CHANNELS = Object.freeze([
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeWideLeft',
  'eyeWideRight',
  'browDownLeft',
  'browDownRight',
  'browInnerUp',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthFrownLeft',
  'mouthFrownRight',
  'jawOpen',
  'jawLeft',
  'jawRight',
  'cheekPuff',
  'cheekSquintLeft',
  'cheekSquintRight',
]);

export const FACE_EXPRESSION_MIRROR_PAIRS = Object.freeze([
  Object.freeze(['eyeBlinkLeft', 'eyeBlinkRight']),
  Object.freeze(['eyeWideLeft', 'eyeWideRight']),
  Object.freeze(['browDownLeft', 'browDownRight']),
  Object.freeze(['mouthSmileLeft', 'mouthSmileRight']),
  Object.freeze(['mouthFrownLeft', 'mouthFrownRight']),
  Object.freeze(['jawLeft', 'jawRight']),
  Object.freeze(['cheekSquintLeft', 'cheekSquintRight']),
]);

const TOP_LEVEL_FIELDS = new Set(['schema', 'expressionRevision', 'channels']);
const CHANNEL_SET = new Set(FACE_EXPRESSION_CHANNELS);

export function createFaceExpressionState(input = {}) {
  return normalizeFaceExpression(input);
}

export function normalizeFaceExpression(input = {}) {
  const source = isPlainObject(input) ? input : {};
  assertAllowedKeys(source, TOP_LEVEL_FIELDS, 'FaceExpressionState');
  const rawChannels = isPlainObject(source.channels) ? source.channels : {};
  assertAllowedKeys(rawChannels, CHANNEL_SET, 'FaceExpressionState.channels');
  const state = {
    schema: FACE_EXPRESSION_SCHEMA,
    expressionRevision: positiveInteger(source.expressionRevision, 1),
    channels: Object.fromEntries(
      FACE_EXPRESSION_CHANNELS.map((channel) => [channel, parameter(rawChannels[channel], 0)]),
    ),
  };
  validateFaceExpression(state);
  return structuredClone(state);
}

export function validateFaceExpression(input) {
  if (!isPlainObject(input)) throw new TypeError('FaceExpressionState must be an object.');
  assertAllowedKeys(input, TOP_LEVEL_FIELDS, 'FaceExpressionState');
  if (input.schema !== FACE_EXPRESSION_SCHEMA) {
    throw new TypeError(`FaceExpressionState.schema must be ${FACE_EXPRESSION_SCHEMA}.`);
  }
  if (!Number.isInteger(input.expressionRevision) || input.expressionRevision < 1) {
    throw new TypeError('FaceExpressionState.expressionRevision must be a positive integer.');
  }
  if (!isPlainObject(input.channels)) throw new TypeError('FaceExpressionState.channels must be an object.');
  assertAllowedKeys(input.channels, CHANNEL_SET, 'FaceExpressionState.channels');
  for (const channel of FACE_EXPRESSION_CHANNELS) {
    if (!(channel in input.channels)) throw new TypeError(`FaceExpressionState.channels is missing ${channel}.`);
    const value = input.channels[channel];
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`FaceExpressionState.channels.${channel} must be between 0 and 1.`);
    }
  }
  return true;
}

export function mergeFaceExpression(currentInput, patch = {}) {
  const current = normalizeFaceExpression(currentInput);
  const source = isPlainObject(patch) ? patch : {};
  const patchChannels = isPlainObject(source.channels) ? source.channels : source;
  assertAllowedKeys(patchChannels, CHANNEL_SET, 'FaceExpressionState.channels');
  return normalizeFaceExpression({
    expressionRevision: source.expressionRevision ?? current.expressionRevision,
    channels: { ...current.channels, ...patchChannels },
  });
}

export function updateFaceExpression(currentInput, patch = {}) {
  const current = normalizeFaceExpression(currentInput);
  const next = mergeFaceExpression(current, patch);
  return normalizeFaceExpression({
    ...next,
    expressionRevision: current.expressionRevision + 1,
  });
}

export function mirrorFaceExpression(input) {
  const state = normalizeFaceExpression(input);
  const channels = { ...state.channels };
  for (const [left, right] of FACE_EXPRESSION_MIRROR_PAIRS) {
    [channels[left], channels[right]] = [channels[right], channels[left]];
  }
  return normalizeFaceExpression({ ...state, channels });
}

function assertAllowedKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${label}.${key} is not part of the Face Expression contract.`);
  }
}

function parameter(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : fallback;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
