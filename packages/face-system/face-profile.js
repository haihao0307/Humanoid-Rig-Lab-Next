export const FACE_PROFILE_SCHEMA = 'humanoid_rig/face_profile@1.0';

export const FACE_SHAPE_FIELDS = Object.freeze(['width', 'height', 'jaw_width', 'cheekbone']);
export const EYE_SHAPE_FIELDS = Object.freeze(['size', 'spacing', 'tilt']);
export const NOSE_SHAPE_FIELDS = Object.freeze(['width', 'length', 'bridge_height']);
export const MOUTH_SHAPE_FIELDS = Object.freeze(['width', 'fullness', 'corner_curve']);
export const EXPRESSION_PROFILE_FIELDS = Object.freeze(['profile_id', 'revision', 'default_expression']);

const TOP_LEVEL_FIELDS = new Set([
  'face_id', 'version', 'age', 'face_shape', 'eye_shape', 'nose_shape', 'mouth_shape', 'expression_profile',
]);
const DEFAULT_EXPRESSION_SET = new Set(['neutral', 'smile', 'frown', 'surprise']);

export function createFaceIdentity(input = {}) {
  assertFaceIdentityInput(input, { partial: true });
  const profile = {
    face_id: stringOr(input.face_id, 'face_001'),
    version: positiveInteger(input.version, 1),
    age: age(input.age, 30),
    face_shape: normalizeShape(input.face_shape, FACE_SHAPE_FIELDS),
    eye_shape: normalizeShape(input.eye_shape, EYE_SHAPE_FIELDS),
    nose_shape: normalizeShape(input.nose_shape, NOSE_SHAPE_FIELDS),
    mouth_shape: normalizeShape(input.mouth_shape, MOUTH_SHAPE_FIELDS),
    expression_profile: normalizeExpressionProfile(input.expression_profile),
  };
  assertFaceIdentity(profile);
  return structuredClone(profile);
}

export function normalizeFaceIdentity(input = {}) {
  return createFaceIdentity(input);
}

export function mergeFaceIdentity(current, patch) {
  assertFaceIdentity(current);
  assertFaceIdentityInput(patch, { partial: true });
  return createFaceIdentity({
    ...current,
    ...patch,
    face_shape: { ...current.face_shape, ...(patch.face_shape || {}) },
    eye_shape: { ...current.eye_shape, ...(patch.eye_shape || {}) },
    nose_shape: { ...current.nose_shape, ...(patch.nose_shape || {}) },
    mouth_shape: { ...current.mouth_shape, ...(patch.mouth_shape || {}) },
    expression_profile: { ...current.expression_profile, ...(patch.expression_profile || {}) },
  });
}

export function assertFaceIdentity(profile) {
  assertFaceIdentityInput(profile, { partial: false });
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(profile.face_id)) {
    throw new TypeError('face_id must use letters, numbers, dot, underscore, or hyphen.');
  }
  if (!Number.isInteger(profile.version) || profile.version < 1) {
    throw new TypeError('FaceIdentity version must be a positive integer.');
  }
  return true;
}

export function assertFaceIdentityInput(input, { partial = true } = {}) {
  if (!isPlainObject(input)) throw new TypeError('FaceIdentity must be an object.');
  assertAllowedKeys(input, TOP_LEVEL_FIELDS, 'FaceIdentity');
  if (!partial) {
    for (const key of TOP_LEVEL_FIELDS) {
      if (!(key in input)) throw new TypeError(`FaceIdentity is missing ${key}.`);
    }
  }
  if ('face_id' in input && !String(input.face_id || '').trim()) throw new TypeError('face_id is required.');
  if ('version' in input && (!Number.isInteger(Number(input.version)) || Number(input.version) < 1)) {
    throw new TypeError('FaceIdentity version must be a positive integer.');
  }
  if ('age' in input && (!Number.isInteger(Number(input.age)) || Number(input.age) < 0 || Number(input.age) > 120)) {
    throw new RangeError('age must be an integer between 0 and 120.');
  }
  assertShapeInput(input.face_shape, FACE_SHAPE_FIELDS, 'face_shape');
  assertShapeInput(input.eye_shape, EYE_SHAPE_FIELDS, 'eye_shape');
  assertShapeInput(input.nose_shape, NOSE_SHAPE_FIELDS, 'nose_shape');
  assertShapeInput(input.mouth_shape, MOUTH_SHAPE_FIELDS, 'mouth_shape');
  if ('expression_profile' in input) {
    if (!isPlainObject(input.expression_profile)) throw new TypeError('expression_profile must be an object.');
    assertAllowedKeys(input.expression_profile, new Set(EXPRESSION_PROFILE_FIELDS), 'expression_profile');
    const expression = input.expression_profile;
    if ('revision' in expression && (!Number.isInteger(Number(expression.revision)) || Number(expression.revision) < 0)) {
      throw new RangeError('expression_profile.revision must be a non-negative integer.');
    }
    if ('default_expression' in expression && !DEFAULT_EXPRESSION_SET.has(String(expression.default_expression))) {
      throw new TypeError('default_expression must be neutral, smile, frown, or surprise.');
    }
  }
  return true;
}

export function faceProfileKey(input) {
  const profile = normalizeFaceIdentity(input);
  return JSON.stringify({
    age: profile.age,
    face_shape: profile.face_shape,
    eye_shape: profile.eye_shape,
    nose_shape: profile.nose_shape,
    mouth_shape: profile.mouth_shape,
    expression_profile: profile.expression_profile,
  });
}

function normalizeShape(value, fields) {
  const source = isPlainObject(value) ? value : {};
  return Object.fromEntries(fields.map((key) => [key, parameter(source[key], 0.5)]));
}

function normalizeExpressionProfile(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    profile_id: stringOr(source.profile_id, 'expression_neutral'),
    revision: nonNegativeInteger(source.revision, 1),
    default_expression: DEFAULT_EXPRESSION_SET.has(String(source.default_expression))
      ? String(source.default_expression)
      : 'neutral',
  };
}

function assertShapeInput(value, fields, label) {
  if (value === undefined) return;
  if (!isPlainObject(value)) throw new TypeError(`${label} must be an object.`);
  assertAllowedKeys(value, new Set(fields), label);
  for (const [key, parameterValue] of Object.entries(value)) {
    if (!Number.isFinite(Number(parameterValue)) || Number(parameterValue) < 0 || Number(parameterValue) > 1) {
      throw new RangeError(`${label}.${key} must be between 0 and 1.`);
    }
  }
}

function assertAllowedKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${label}.${key} is not part of the Face Identity contract.`);
  }
}

function parameter(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}

function age(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 120 ? number : fallback;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : fallback;
}

function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function stringOr(value, fallback) {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
