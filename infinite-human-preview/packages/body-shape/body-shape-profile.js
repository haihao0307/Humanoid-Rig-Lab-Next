export const BODY_SHAPE_PROFILE_SCHEMA = 'humanoid_rig/body_shape_profile@1.0';

export const BODY_SHAPE_PARAMETER_KEYS = Object.freeze([
  'muscle',
  'fat',
  'shoulder_volume',
  'chest_volume',
  'waist_volume',
  'hip_volume',
  'arm_volume',
  'leg_volume',
]);

export const DEFAULT_BODY_SHAPE_PARAMETERS = Object.freeze(
  Object.fromEntries(BODY_SHAPE_PARAMETER_KEYS.map((key) => [key, 0.5])),
);

const PROFILE_KEYS = new Set(['body_shape_id', 'name', 'version', ...BODY_SHAPE_PARAMETER_KEYS]);

export function createBodyShapeProfile(input = {}) {
  assertBodyShapeProfileInput(input, { partial: true });
  const bodyShapeId = stringOr(input.body_shape_id, 'body_shape_001');
  const profile = {
    body_shape_id: bodyShapeId,
    name: stringOr(input.name, 'Neutral Body Shape'),
    version: positiveInteger(input.version, 1),
  };
  for (const key of BODY_SHAPE_PARAMETER_KEYS) {
    profile[key] = normalizedParameter(input[key], DEFAULT_BODY_SHAPE_PARAMETERS[key]);
  }
  assertBodyShapeProfile(profile);
  return structuredClone(profile);
}

export function normalizeBodyShapeProfile(input = {}) {
  return createBodyShapeProfile(input);
}

export function assertBodyShapeProfile(profile) {
  assertBodyShapeProfileInput(profile, { partial: false });
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(profile.body_shape_id)) {
    throw new TypeError('body_shape_id must use letters, numbers, dot, underscore, or hyphen.');
  }
  if (!String(profile.name || '').trim()) throw new TypeError('BodyShape name is required.');
  if (!Number.isInteger(profile.version) || profile.version < 1) {
    throw new TypeError('BodyShape version must be a positive integer.');
  }
  assertBodyShapeParameterPatch(
    Object.fromEntries(BODY_SHAPE_PARAMETER_KEYS.map((key) => [key, profile[key]])),
  );
  return true;
}

export function assertBodyShapeProfileInput(input, { partial = true } = {}) {
  if (!isPlainObject(input)) throw new TypeError('BodyShapeProfile must be an object.');
  for (const key of Object.keys(input)) {
    if (!PROFILE_KEYS.has(key)) throw new TypeError(`BodyShapeProfile.${key} is not part of the BodyShape contract.`);
  }
  if (!partial) {
    for (const key of PROFILE_KEYS) {
      if (!(key in input)) throw new TypeError(`BodyShapeProfile is missing ${key}.`);
    }
  }
  const patch = Object.fromEntries(
    BODY_SHAPE_PARAMETER_KEYS.filter((key) => key in input).map((key) => [key, input[key]]),
  );
  assertBodyShapeParameterPatch(patch);
  return true;
}

export function assertBodyShapeParameterPatch(patch) {
  if (!isPlainObject(patch)) throw new TypeError('BodyShape parameter patch must be an object.');
  const allowed = new Set(BODY_SHAPE_PARAMETER_KEYS);
  for (const [key, value] of Object.entries(patch)) {
    if (!allowed.has(key)) throw new TypeError(`${key} is not a BodyShape parameter.`);
    if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1) {
      throw new RangeError(`${key} must be between 0 and 1.`);
    }
  }
  return true;
}

export function bodyShapeProfileKey(input) {
  const profile = normalizeBodyShapeProfile(input);
  return BODY_SHAPE_PARAMETER_KEYS.map((key) => Number(profile[key]).toFixed(4)).join('|');
}

function normalizedParameter(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : fallback;
}

function stringOr(value, fallback) {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
