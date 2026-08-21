export const FACE_EXPRESSION_SCHEMA = 'humanoid_rig/face_expression@1.0';

const channelDefinition = (channel, category, label, side = 'center') => Object.freeze({
  channel,
  category,
  label,
  side,
});

export const FACE_EXPRESSION_CHANNEL_DEFINITIONS = Object.freeze([
  channelDefinition('eyeBlinkLeft', 'Eye', 'Blink L', 'left'),
  channelDefinition('eyeBlinkRight', 'Eye', 'Blink R', 'right'),
  channelDefinition('eyeClosureLeft', 'Eye', 'Closure L', 'left'),
  channelDefinition('eyeClosureRight', 'Eye', 'Closure R', 'right'),
  channelDefinition('eyeUpperLidRaiseLeft', 'Eye', 'Upper Lid L', 'left'),
  channelDefinition('eyeUpperLidRaiseRight', 'Eye', 'Upper Lid R', 'right'),
  channelDefinition('eyeLowerLidLeft', 'Eye', 'Lower Lid L', 'left'),
  channelDefinition('eyeLowerLidRight', 'Eye', 'Lower Lid R', 'right'),
  channelDefinition('eyeWideLeft', 'Eye', 'Wide L', 'left'),
  channelDefinition('eyeWideRight', 'Eye', 'Wide R', 'right'),
  channelDefinition('eyeSquintLeft', 'Eye', 'Squint L', 'left'),
  channelDefinition('eyeSquintRight', 'Eye', 'Squint R', 'right'),
  channelDefinition('eyeGlareLeft', 'Eye', 'Glare L', 'left'),
  channelDefinition('eyeGlareRight', 'Eye', 'Glare R', 'right'),

  channelDefinition('browRaiseLeft', 'Brow', 'Raise L', 'left'),
  channelDefinition('browRaiseRight', 'Brow', 'Raise R', 'right'),
  channelDefinition('browDownLeft', 'Brow', 'Down L', 'left'),
  channelDefinition('browDownRight', 'Brow', 'Down R', 'right'),
  channelDefinition('browInnerLeft', 'Brow', 'Inner L', 'left'),
  channelDefinition('browInnerRight', 'Brow', 'Inner R', 'right'),
  channelDefinition('browAngryLeft', 'Brow', 'Angry L', 'left'),
  channelDefinition('browAngryRight', 'Brow', 'Angry R', 'right'),
  channelDefinition('browInnerUp', 'Brow', 'Inner Up'),

  channelDefinition('mouthSmileLeft', 'Mouth', 'Smile L', 'left'),
  channelDefinition('mouthSmileRight', 'Mouth', 'Smile R', 'right'),
  channelDefinition('mouthFrownLeft', 'Mouth', 'Frown L', 'left'),
  channelDefinition('mouthFrownRight', 'Mouth', 'Frown R', 'right'),
  channelDefinition('lipTightenerLeft', 'Mouth', 'Lip Tightener L', 'left'),
  channelDefinition('lipTightenerRight', 'Mouth', 'Lip Tightener R', 'right'),
  channelDefinition('mouthOpen', 'Mouth', 'Open'),
  channelDefinition('mouthPuckerLeft', 'Mouth', 'Pucker L', 'left'),
  channelDefinition('mouthPuckerRight', 'Mouth', 'Pucker R', 'right'),

  channelDefinition('jawOpen', 'Jaw', 'Open'),
  channelDefinition('jawLeft', 'Jaw', 'Left', 'left'),
  channelDefinition('jawRight', 'Jaw', 'Right', 'right'),

  channelDefinition('cheekPuff', 'Cheek', 'Puff'),
  channelDefinition('cheekPuffLeft', 'Cheek', 'Puff L', 'left'),
  channelDefinition('cheekPuffRight', 'Cheek', 'Puff R', 'right'),
  channelDefinition('cheekSquintLeft', 'Cheek', 'Squint L', 'left'),
  channelDefinition('cheekSquintRight', 'Cheek', 'Squint R', 'right'),
]);

export const FACE_EXPRESSION_CHANNELS = Object.freeze(
  FACE_EXPRESSION_CHANNEL_DEFINITIONS.map(({ channel }) => channel),
);

export const FACE_EXPRESSION_MIRROR_PAIRS = Object.freeze([
  Object.freeze(['eyeBlinkLeft', 'eyeBlinkRight']),
  Object.freeze(['eyeClosureLeft', 'eyeClosureRight']),
  Object.freeze(['eyeUpperLidRaiseLeft', 'eyeUpperLidRaiseRight']),
  Object.freeze(['eyeLowerLidLeft', 'eyeLowerLidRight']),
  Object.freeze(['eyeWideLeft', 'eyeWideRight']),
  Object.freeze(['eyeSquintLeft', 'eyeSquintRight']),
  Object.freeze(['eyeGlareLeft', 'eyeGlareRight']),
  Object.freeze(['browRaiseLeft', 'browRaiseRight']),
  Object.freeze(['browDownLeft', 'browDownRight']),
  Object.freeze(['browInnerLeft', 'browInnerRight']),
  Object.freeze(['browAngryLeft', 'browAngryRight']),
  Object.freeze(['mouthSmileLeft', 'mouthSmileRight']),
  Object.freeze(['mouthFrownLeft', 'mouthFrownRight']),
  Object.freeze(['lipTightenerLeft', 'lipTightenerRight']),
  Object.freeze(['mouthPuckerLeft', 'mouthPuckerRight']),
  Object.freeze(['jawLeft', 'jawRight']),
  Object.freeze(['cheekPuffLeft', 'cheekPuffRight']),
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

export function mirrorFaceExpressionPair(input, pair) {
  const state = normalizeFaceExpression(input);
  const [left, right] = normalizeMirrorPair(pair);
  const channels = { ...state.channels };
  [channels[left], channels[right]] = [channels[right], channels[left]];
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

function normalizeMirrorPair(pair) {
  if (!Array.isArray(pair) || pair.length !== 2) {
    throw new TypeError('Face expression mirror pair must contain exactly two channel names.');
  }
  const names = pair.map((channel) => String(channel));
  const isKnownPair = FACE_EXPRESSION_MIRROR_PAIRS.some(([left, right]) => (
    (left === names[0] && right === names[1]) || (left === names[1] && right === names[0])
  ));
  if (!isKnownPair) throw new TypeError('Face expression mirror pair is not part of the semantic channel contract.');
  return names;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
