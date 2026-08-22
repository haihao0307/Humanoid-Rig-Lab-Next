import {
  EYE_SHAPE_FIELDS,
  FACE_SHAPE_FIELDS,
  MOUTH_SHAPE_FIELDS,
  createFaceIdentity,
} from './face-profile.js';
import { createFaceExpressionState, validateFaceExpression } from './face-expression.js';

export const FACE_FEATURE_DESCRIPTOR_SCHEMA = 'humanoid_rig/face_feature_descriptor@1.0';
export const FACE_IMAGE_INPUT_SCHEMA = 'humanoid_rig/face_image_input@1.0';

export function createFaceImageInput(input = {}) {
  if (typeof input === 'string') {
    return {
      schema: FACE_IMAGE_INPUT_SCHEMA,
      type: 'image',
      reference: input,
      mediaType: null,
      width: null,
      height: null,
    };
  }
  const source = isPlainObject(input) ? input : {};
  return {
    schema: FACE_IMAGE_INPUT_SCHEMA,
    type: 'image',
    reference: stringOr(source.reference ?? source.imageReference, null),
    mediaType: stringOr(source.mediaType, null),
    width: positiveIntegerOrNull(source.width),
    height: positiveIntegerOrNull(source.height),
  };
}

export function createFaceFeatureDescriptor(input = {}, options = {}) {
  const source = isPlainObject(input) ? input : {};
  const identity = createFaceIdentity({
    face_shape: source.face_shape || source.faceShape,
    eye_shape: source.eye_shape || source.eyeShape,
    mouth_shape: source.mouth_shape || source.mouthShape,
  });
  const expression = createFaceExpressionState(
    source.expression || source.expressionState || (source.channels ? { channels: source.channels } : {}),
  );
  const descriptor = {
    schema: FACE_FEATURE_DESCRIPTOR_SCHEMA,
    descriptorRevision: positiveInteger(source.descriptorRevision, options.descriptorRevision || 1),
    source: createFaceImageInput(source.source || source.image || options.source),
    face_shape: structuredClone(identity.face_shape),
    eye_shape: structuredClone(identity.eye_shape),
    mouth_shape: structuredClone(identity.mouth_shape),
    expression,
  };
  validateFaceFeatureDescriptor(descriptor);
  return structuredClone(descriptor);
}

export function validateFaceFeatureDescriptor(input) {
  if (!isPlainObject(input)) throw new TypeError('FaceFeatureDescriptor must be an object.');
  if (input.schema !== FACE_FEATURE_DESCRIPTOR_SCHEMA) {
    throw new TypeError(`FaceFeatureDescriptor.schema must be ${FACE_FEATURE_DESCRIPTOR_SCHEMA}.`);
  }
  if (!Number.isInteger(input.descriptorRevision) || input.descriptorRevision < 1) {
    throw new TypeError('FaceFeatureDescriptor.descriptorRevision must be a positive integer.');
  }
  validateImageInput(input.source);
  validateShape(input.face_shape, FACE_SHAPE_FIELDS, 'face_shape');
  validateShape(input.eye_shape, EYE_SHAPE_FIELDS, 'eye_shape');
  validateShape(input.mouth_shape, MOUTH_SHAPE_FIELDS, 'mouth_shape');
  validateFaceExpression(input.expression);
  return true;
}

function validateImageInput(input) {
  if (!isPlainObject(input) || input.schema !== FACE_IMAGE_INPUT_SCHEMA || input.type !== 'image') {
    throw new TypeError('FaceFeatureDescriptor.source must be a FaceImageInput.');
  }
  if (input.reference !== null && typeof input.reference !== 'string') {
    throw new TypeError('FaceImageInput.reference must be a string or null.');
  }
  if (input.mediaType !== null && typeof input.mediaType !== 'string') {
    throw new TypeError('FaceImageInput.mediaType must be a string or null.');
  }
  for (const key of ['width', 'height']) {
    if (input[key] !== null && (!Number.isInteger(input[key]) || input[key] < 1)) {
      throw new RangeError(`FaceImageInput.${key} must be a positive integer or null.`);
    }
  }
}

function validateShape(value, fields, label) {
  if (!isPlainObject(value)) throw new TypeError(`${label} must be an object.`);
  for (const field of fields) {
    const number = Number(value[field]);
    if (!Number.isFinite(number) || number < 0 || number > 1) {
      throw new RangeError(`${label}.${field} must be between 0 and 1.`);
    }
  }
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : fallback;
}

function positiveIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : null;
}

function stringOr(value, fallback) {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
