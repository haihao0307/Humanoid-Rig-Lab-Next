import {
  FACE_EXPRESSION_CHANNELS,
  FACE_EXPRESSION_SCHEMA,
  normalizeFaceExpression,
} from './face-expression.js';

export const FACE_EXPRESSION_RUNTIME_DESCRIPTOR_SCHEMA = 'humanoid_rig/face_expression_runtime_descriptor@1.0';
export const FACE_EXPRESSION_DEFORMATION_MODES = Object.freeze([
  'interface-only',
  'morph-target',
  'vertex-corrective',
  'shader-corrective',
]);

export function createFaceExpressionRuntimeDescriptor(expressionInput = {}, options = {}) {
  const expression = normalizeFaceExpression(expressionInput);
  const deformationMode = FACE_EXPRESSION_DEFORMATION_MODES.includes(options.deformationMode)
    ? options.deformationMode
    : 'interface-only';
  return {
    expressionSchema: FACE_EXPRESSION_SCHEMA,
    channels: Object.fromEntries(
      FACE_EXPRESSION_CHANNELS.map((channel) => [channel, expression.channels[channel]]),
    ),
    deformationMode,
    meshReference: options.meshReference == null ? null : structuredClone(options.meshReference),
    morphTargets: Array.isArray(options.morphTargets) ? structuredClone(options.morphTargets) : [],
    correctiveTargets: Array.isArray(options.correctiveTargets) ? structuredClone(options.correctiveTargets) : [],
  };
}

export function validateFaceExpressionRuntimeDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new TypeError('Face expression runtime descriptor must be an object.');
  }
  if (descriptor.expressionSchema !== FACE_EXPRESSION_SCHEMA) {
    throw new TypeError(`expressionSchema must be ${FACE_EXPRESSION_SCHEMA}.`);
  }
  if (!FACE_EXPRESSION_DEFORMATION_MODES.includes(descriptor.deformationMode)) {
    throw new TypeError(`Unsupported face expression deformation mode: ${descriptor.deformationMode}.`);
  }
  if (!descriptor.channels || typeof descriptor.channels !== 'object' || Array.isArray(descriptor.channels)) {
    throw new TypeError('Face expression runtime descriptor channels must be an object.');
  }
  const expression = normalizeFaceExpression({ channels: descriptor.channels });
  if (JSON.stringify(expression.channels) !== JSON.stringify(descriptor.channels)) {
    throw new RangeError('Face expression runtime descriptor channels must be normalized 0-1 values.');
  }
  if (descriptor.meshReference !== null && descriptor.meshReference === undefined) {
    throw new TypeError('meshReference must be null or a reference value.');
  }
  if (!Array.isArray(descriptor.morphTargets) || !Array.isArray(descriptor.correctiveTargets)) {
    throw new TypeError('morphTargets and correctiveTargets must be arrays.');
  }
  return true;
}
