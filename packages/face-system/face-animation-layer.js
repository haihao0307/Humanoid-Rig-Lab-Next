import { normalizeFaceExpression, validateFaceExpression } from './face-expression.js';

export const FACE_ANIMATION_LAYER_SCHEMA = 'humanoid_rig/face_animation_layer@1.0';
export const FACE_ANIMATION_LAYER_ORDER = Object.freeze([
  'body-animation',
  'face-expression-animation',
]);

export function createFaceAnimationLayer(expressionInput = {}, options = {}) {
  const source = isPlainObject(expressionInput) && expressionInput.expression
    ? expressionInput.expression
    : expressionInput;
  const expression = normalizeFaceExpression(source);
  return {
    schema: FACE_ANIMATION_LAYER_SCHEMA,
    layerId: String(options.layerId || 'face-expression'),
    layerType: 'face-expression',
    source: 'faceSystem.expression',
    enabled: options.enabled !== false,
    weight: parameter(options.weight, 1),
    blendMode: options.blendMode === 'additive' ? 'additive' : 'override',
    bodyAnimationReference: options.bodyAnimationReference == null
      ? 'character.animation'
      : String(options.bodyAnimationReference),
    expression,
  };
}

export function normalizeFaceAnimationLayer(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return createFaceAnimationLayer(source.expression, source);
}

export function validateFaceAnimationLayer(input) {
  if (!isPlainObject(input)) throw new TypeError('Face animation layer must be an object.');
  const layer = input;
  if (layer.schema !== FACE_ANIMATION_LAYER_SCHEMA) {
    throw new TypeError(`Face animation layer schema must be ${FACE_ANIMATION_LAYER_SCHEMA}.`);
  }
  if (layer.layerType !== 'face-expression' || layer.source !== 'faceSystem.expression') {
    throw new TypeError('Face animation layer must reference the existing faceSystem expression state.');
  }
  if (typeof layer.enabled !== 'boolean') throw new TypeError('Face animation layer enabled must be a boolean.');
  if (!['override', 'additive'].includes(layer.blendMode)) {
    throw new TypeError('Face animation layer blendMode must be override or additive.');
  }
  if (typeof layer.bodyAnimationReference !== 'string' || !layer.bodyAnimationReference) {
    throw new TypeError('Face animation layer bodyAnimationReference must be a non-empty string.');
  }
  if (!Number.isFinite(layer.weight) || layer.weight < 0 || layer.weight > 1) {
    throw new RangeError('Face animation layer weight must be between 0 and 1.');
  }
  validateFaceExpression(layer.expression);
  return true;
}

export function composeFaceAnimationLayers(bodyAnimationInput = null, expressionInput = {}, options = {}) {
  return {
    bodyAnimation: bodyAnimationInput == null ? null : structuredClone(bodyAnimationInput),
    faceExpressionAnimation: createFaceAnimationLayer(expressionInput, options),
    layerOrder: [...FACE_ANIMATION_LAYER_ORDER],
  };
}

function parameter(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
