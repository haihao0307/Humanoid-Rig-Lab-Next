export const HAIR_STYLES = Object.freeze({
  SHORT: 'short',
  LONG: 'long',
  PONYTAIL: 'ponytail',
});

const STYLE_SET = new Set(Object.values(HAIR_STYLES));
const PROFILE_FIELDS = new Set(['hair_id', 'revision', 'name', 'style', 'rig_profile', 'material', 'transform']);
const RIG_FIELDS = new Set(['target', 'attachment_points']);
const MATERIAL_FIELDS = new Set(['base_color', 'roughness', 'metalness', 'opacity']);
const TRANSFORM_FIELDS = new Set(['offset', 'rotation', 'scale']);
const DEFAULT_ATTACHMENTS = Object.freeze({
  short: ['head', 'headTop'],
  long: ['head', 'headTop', 'neck', 'upperChest'],
  ponytail: ['head', 'headTop', 'neck'],
});

export function createHairProfile(input = {}) {
  assertPlainObject(input, 'HairProfile');
  assertAllowedKeys(input, PROFILE_FIELDS, 'HairProfile');
  const style = String(input.style || HAIR_STYLES.SHORT);
  if (!STYLE_SET.has(style)) throw new TypeError(`Hair style ${style} is not supported.`);
  const hairId = identifier(input.hair_id, `hair_${style}_001`, 'hair_id');
  const rig = normalizeRigProfile(input.rig_profile, style);
  const profile = {
    hair_id: hairId,
    revision: positiveInteger(input.revision, 1),
    name: stringOr(input.name, hairId),
    style,
    rig_profile: rig,
    material: normalizeMaterial(input.material),
    transform: normalizeTransform(input.transform),
  };
  return structuredClone(profile);
}

export function assertHairProfile(input) {
  createHairProfile(input);
  return true;
}

function normalizeRigProfile(value, style) {
  const source = value == null ? {} : value;
  assertPlainObject(source, 'HairProfile.rig_profile');
  assertAllowedKeys(source, RIG_FIELDS, 'HairProfile.rig_profile');
  const target = String(source.target || 'simulationRig');
  if (target !== 'simulationRig') throw new TypeError('Hair must bind to simulationRig.');
  const attachmentPoints = Array.isArray(source.attachment_points)
    ? [...new Set(source.attachment_points.map((item) => identifier(item, null, 'attachment point')))]
    : [...DEFAULT_ATTACHMENTS[style]];
  if (attachmentPoints.length === 0) throw new TypeError('Hair requires at least one simulationRig attachment point.');
  return { target, attachment_points: attachmentPoints };
}

function normalizeMaterial(value) {
  const source = value == null ? {} : value;
  assertPlainObject(source, 'HairProfile.material');
  assertAllowedKeys(source, MATERIAL_FIELDS, 'HairProfile.material');
  const baseColor = String(source.base_color || '#2b211d');
  if (!/^#[0-9a-f]{6}$/i.test(baseColor)) throw new TypeError('Hair material.base_color must be a six-digit hex color.');
  return {
    base_color: baseColor.toLowerCase(),
    roughness: unitNumber(source.roughness, 0.72, 'material.roughness'),
    metalness: unitNumber(source.metalness, 0, 'material.metalness'),
    opacity: unitNumber(source.opacity, 1, 'material.opacity'),
  };
}

function normalizeTransform(value) {
  const source = value == null ? {} : value;
  assertPlainObject(source, 'HairProfile.transform');
  assertAllowedKeys(source, TRANSFORM_FIELDS, 'HairProfile.transform');
  return {
    offset: vector(source.offset, [0, 0, 0], 3, 'transform.offset'),
    rotation: vector(source.rotation, [0, 0, 0, 1], 4, 'transform.rotation'),
    scale: boundedNumber(source.scale, 1, 0.25, 4, 'transform.scale'),
  };
}

function identifier(value, fallback, label) {
  const result = String(value ?? fallback ?? '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(result)) {
    throw new TypeError(`${label} must use letters, numbers, dot, underscore, or hyphen.`);
  }
  return result;
}
function stringOr(value, fallback) { return String(value ?? '').trim() || fallback; }
function positiveInteger(value, fallback) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < 1) throw new TypeError('Hair revision must be a positive integer.');
  return number;
}
function unitNumber(value, fallback, label) { return boundedNumber(value, fallback, 0, 1, label); }
function boundedNumber(value, fallback, min, max, label) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number) || number < min || number > max) throw new TypeError(`${label} must be between ${min} and ${max}.`);
  return number;
}
function vector(value, fallback, length, label) {
  const result = value == null ? [...fallback] : Array.from(value, Number);
  if (result.length !== length || !result.every(Number.isFinite)) throw new TypeError(`${label} must contain ${length} finite numbers.`);
  return result;
}
function assertAllowedKeys(value, allowed, label) {
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(`${label}.${key} is not supported.`);
}
function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
}
