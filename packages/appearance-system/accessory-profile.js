export const ACCESSORY_TYPES = Object.freeze({
  HAT: 'hat',
  GLASSES: 'glasses',
  ORNAMENT: 'ornament',
});

const TYPE_SET = new Set(Object.values(ACCESSORY_TYPES));
const PROFILE_FIELDS = new Set(['accessory_id', 'revision', 'name', 'type', 'rig_profile', 'material', 'transform']);
const RIG_FIELDS = new Set(['target', 'attachment_point']);
const MATERIAL_FIELDS = new Set(['base_color', 'roughness', 'metalness', 'opacity']);
const TRANSFORM_FIELDS = new Set(['offset', 'rotation', 'scale']);
const DEFAULT_ATTACHMENTS = Object.freeze({ hat: 'headTop', glasses: 'head', ornament: 'upperChest' });

export function createAccessoryProfile(input = {}) {
  assertPlainObject(input, 'AccessoryProfile');
  assertAllowedKeys(input, PROFILE_FIELDS, 'AccessoryProfile');
  const type = String(input.type || ACCESSORY_TYPES.ORNAMENT);
  if (!TYPE_SET.has(type)) throw new TypeError(`Accessory type ${type} is not supported.`);
  const accessoryId = identifier(input.accessory_id, `accessory_${type}_001`, 'accessory_id');
  return structuredClone({
    accessory_id: accessoryId,
    revision: positiveInteger(input.revision, 1),
    name: stringOr(input.name, accessoryId),
    type,
    rig_profile: normalizeRigProfile(input.rig_profile, type),
    material: normalizeMaterial(input.material),
    transform: normalizeTransform(input.transform),
  });
}

export function assertAccessoryProfile(input) {
  createAccessoryProfile(input);
  return true;
}

function normalizeRigProfile(value, type) {
  const source = value == null ? {} : value;
  assertPlainObject(source, 'AccessoryProfile.rig_profile');
  assertAllowedKeys(source, RIG_FIELDS, 'AccessoryProfile.rig_profile');
  const target = String(source.target || 'simulationRig');
  if (target !== 'simulationRig') throw new TypeError('Accessory must bind to simulationRig.');
  return {
    target,
    attachment_point: identifier(source.attachment_point, DEFAULT_ATTACHMENTS[type], 'attachment point'),
  };
}

function normalizeMaterial(value) {
  const source = value == null ? {} : value;
  assertPlainObject(source, 'AccessoryProfile.material');
  assertAllowedKeys(source, MATERIAL_FIELDS, 'AccessoryProfile.material');
  const baseColor = String(source.base_color || '#8b96a5');
  if (!/^#[0-9a-f]{6}$/i.test(baseColor)) throw new TypeError('Accessory material.base_color must be a six-digit hex color.');
  return {
    base_color: baseColor.toLowerCase(),
    roughness: unitNumber(source.roughness, 0.55, 'material.roughness'),
    metalness: unitNumber(source.metalness, 0.15, 'material.metalness'),
    opacity: unitNumber(source.opacity, 1, 'material.opacity'),
  };
}

function normalizeTransform(value) {
  const source = value == null ? {} : value;
  assertPlainObject(source, 'AccessoryProfile.transform');
  assertAllowedKeys(source, TRANSFORM_FIELDS, 'AccessoryProfile.transform');
  return {
    offset: vector(source.offset, [0, 0, 0], 3, 'transform.offset'),
    rotation: vector(source.rotation, [0, 0, 0, 1], 4, 'transform.rotation'),
    scale: boundedNumber(source.scale, 1, 0.1, 8, 'transform.scale'),
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
  if (!Number.isInteger(number) || number < 1) throw new TypeError('Accessory revision must be a positive integer.');
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
