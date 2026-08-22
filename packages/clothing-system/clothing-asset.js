export const CLOTHING_TYPES = Object.freeze({
  TOP: 'top',
  PANTS: 'pants',
  SHOES: 'shoes',
});

export const CLOTHING_TYPE_PRESETS = Object.freeze({
  [CLOTHING_TYPES.TOP]: Object.freeze({
    attachment_points: Object.freeze(['spine', 'chest', 'upperChest', 'leftUpperArm', 'rightUpperArm']),
    color: '#526d9e',
  }),
  [CLOTHING_TYPES.PANTS]: Object.freeze({
    attachment_points: Object.freeze(['hips', 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg']),
    color: '#28364f',
  }),
  [CLOTHING_TYPES.SHOES]: Object.freeze({
    attachment_points: Object.freeze(['leftFoot', 'leftToes', 'rightFoot', 'rightToes']),
    color: '#20242d',
  }),
});

const TOP_LEVEL_FIELDS = new Set([
  'clothing_id', 'revision', 'type', 'rig_profile', 'material', 'physics_profile', 'size_profile', 'render_profile',
]);
const RIG_PROFILE_FIELDS = new Set(['target', 'rig_revision', 'attachment_points']);
const MATERIAL_FIELDS = new Set(['base_color', 'roughness', 'metalness', 'opacity']);
const PHYSICS_PROFILE_FIELDS = new Set([
  'mode', 'enabled', 'collision', 'physicsMode', 'collisionGroup', 'materialProperties',
]);
const MATERIAL_PROPERTIES_FIELDS = new Set(['density', 'friction', 'damping']);
const SIZE_PROFILE_FIELDS = new Set(['size', 'scale', 'length', 'offset', 'body_shape_revision']);
const OFFSET_FIELDS = new Set(['x', 'y', 'z']);
const RENDER_PROFILE_FIELDS = new Set(['layer']);
const SIZE_SET = new Set(['XS', 'S', 'M', 'L', 'XL', 'custom']);
const PHYSICS_MODE_SET = new Set(['static-follow', 'cloth-simulation']);

export function createClothingAsset(input = {}) {
  assertClothingAssetInput(input, { partial: true });
  const type = normalizeType(input.type);
  const preset = CLOTHING_TYPE_PRESETS[type];
  const asset = {
    clothing_id: stringOr(input.clothing_id, `${type}_001`),
    revision: positiveInteger(input.revision, 1),
    type,
    rig_profile: normalizeRigProfile(input.rig_profile, preset),
    material: normalizeMaterial(input.material, preset),
    physics_profile: normalizePhysicsProfile(input.physics_profile),
    size_profile: normalizeSizeProfile(input.size_profile),
    render_profile: normalizeRenderProfile(input.render_profile),
  };
  assertClothingAsset(asset);
  return structuredClone(asset);
}

export function normalizeClothingAsset(input = {}) {
  return createClothingAsset(input);
}

export function assertClothingAsset(asset) {
  assertClothingAssetInput(asset, { partial: false });
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(asset.clothing_id)) {
    throw new TypeError('clothing_id must use letters, numbers, dot, underscore, or hyphen.');
  }
  return true;
}

export function assertClothingAssetInput(input, { partial = true } = {}) {
  if (!isPlainObject(input)) throw new TypeError('ClothingAsset must be an object.');
  assertAllowedKeys(input, TOP_LEVEL_FIELDS, 'ClothingAsset');
  if (!partial) {
    for (const key of TOP_LEVEL_FIELDS) if (!(key in input)) throw new TypeError(`ClothingAsset is missing ${key}.`);
  }
  if ('type' in input && !Object.values(CLOTHING_TYPES).includes(String(input.type))) {
    throw new TypeError('ClothingAsset type must be top, pants, or shoes.');
  }
  if ('revision' in input && (!Number.isInteger(Number(input.revision)) || Number(input.revision) < 1)) {
    throw new TypeError('ClothingAsset revision must be a positive integer.');
  }
  validateRigProfile(input.rig_profile);
  validateMaterial(input.material);
  validatePhysicsProfile(input.physics_profile);
  validateSizeProfile(input.size_profile);
  validateRenderProfile(input.render_profile);
  return true;
}

function normalizeRigProfile(value, preset) {
  const source = isPlainObject(value) ? value : {};
  return {
    target: 'simulationRig',
    rig_revision: stringOr(source.rig_revision, 'rig@0.4.0'),
    attachment_points: uniqueStrings(source.attachment_points, preset.attachment_points),
  };
}

function normalizeMaterial(value, preset) {
  const source = isPlainObject(value) ? value : {};
  return {
    base_color: colorOr(source.base_color, preset.color),
    roughness: unit(source.roughness, 0.78),
    metalness: unit(source.metalness, 0.02),
    opacity: unit(source.opacity, 1),
  };
}

function normalizePhysicsProfile(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    mode: 'static-follow',
    enabled: false,
    collision: source.collision === 'body-readonly' ? 'body-readonly' : 'none',
    physicsMode: PHYSICS_MODE_SET.has(String(source.physicsMode)) ? String(source.physicsMode) : 'static-follow',
    collisionGroup: nullableString(source.collisionGroup),
    materialProperties: normalizeMaterialProperties(source.materialProperties),
  };
}

function normalizeSizeProfile(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    size: SIZE_SET.has(String(source.size)) ? String(source.size) : 'M',
    scale: range(source.scale, 0.5, 2, 1),
    length: range(source.length, 0.5, 2, 1),
    offset: normalizeOffset(source.offset),
    body_shape_revision: nonNegativeInteger(source.body_shape_revision, 0),
  };
}

function normalizeRenderProfile(value) {
  const source = isPlainObject(value) ? value : {};
  return { layer: integerInRange(source.layer, 0, 31, 1) };
}

function normalizeOffset(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    x: range(source.x, -1, 1, 0),
    y: range(source.y, -1, 1, 0),
    z: range(source.z, -1, 1, 0),
  };
}

function normalizeMaterialProperties(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    density: range(source.density, 0.01, 10, 1),
    friction: unit(source.friction, 0.5),
    damping: unit(source.damping, 0.5),
  };
}

function validateRigProfile(value) {
  if (value === undefined) return;
  if (!isPlainObject(value)) throw new TypeError('rig_profile must be an object.');
  assertAllowedKeys(value, RIG_PROFILE_FIELDS, 'rig_profile');
  if ('target' in value && value.target !== 'simulationRig') {
    throw new TypeError('rig_profile.target must be simulationRig.');
  }
  if ('attachment_points' in value && (!Array.isArray(value.attachment_points) || value.attachment_points.length === 0)) {
    throw new TypeError('rig_profile.attachment_points must be a non-empty array.');
  }
}

function validateMaterial(value) {
  if (value === undefined) return;
  if (!isPlainObject(value)) throw new TypeError('material must be an object.');
  assertAllowedKeys(value, MATERIAL_FIELDS, 'material');
  if ('base_color' in value && !/^#[0-9a-fA-F]{6}$/.test(String(value.base_color))) {
    throw new TypeError('material.base_color must be a six-digit hex color.');
  }
  for (const key of ['roughness', 'metalness', 'opacity']) {
    if (key in value && (!Number.isFinite(Number(value[key])) || Number(value[key]) < 0 || Number(value[key]) > 1)) {
      throw new RangeError(`material.${key} must be between 0 and 1.`);
    }
  }
}

function validatePhysicsProfile(value) {
  if (value === undefined) return;
  if (!isPlainObject(value)) throw new TypeError('physics_profile must be an object.');
  assertAllowedKeys(value, PHYSICS_PROFILE_FIELDS, 'physics_profile');
  if ('mode' in value && value.mode !== 'static-follow') throw new TypeError('Phase-one clothing mode must be static-follow.');
  if ('enabled' in value && value.enabled !== false) throw new TypeError('Phase-one clothing physics must remain disabled.');
  if ('collision' in value && !['none', 'body-readonly'].includes(value.collision)) {
    throw new TypeError('physics_profile.collision must be none or body-readonly.');
  }
  if ('physicsMode' in value && !PHYSICS_MODE_SET.has(String(value.physicsMode))) {
    throw new TypeError('physics_profile.physicsMode must be static-follow or cloth-simulation.');
  }
  if ('collisionGroup' in value && value.collisionGroup !== null && !String(value.collisionGroup).trim()) {
    throw new TypeError('physics_profile.collisionGroup must be null or a non-empty string.');
  }
  if ('materialProperties' in value) validateMaterialProperties(value.materialProperties);
}

function validateSizeProfile(value) {
  if (value === undefined) return;
  if (!isPlainObject(value)) throw new TypeError('size_profile must be an object.');
  assertAllowedKeys(value, SIZE_PROFILE_FIELDS, 'size_profile');
  if ('size' in value && !SIZE_SET.has(String(value.size))) throw new TypeError('Unsupported clothing size.');
  if ('scale' in value && (!Number.isFinite(Number(value.scale)) || Number(value.scale) < 0.5 || Number(value.scale) > 2)) {
    throw new RangeError('size_profile.scale must be between 0.5 and 2.');
  }
  if ('length' in value && (!Number.isFinite(Number(value.length)) || Number(value.length) < 0.5 || Number(value.length) > 2)) {
    throw new RangeError('size_profile.length must be between 0.5 and 2.');
  }
  if ('offset' in value) validateOffset(value.offset);
  if ('body_shape_revision' in value && (!Number.isInteger(Number(value.body_shape_revision)) || Number(value.body_shape_revision) < 0)) {
    throw new RangeError('size_profile.body_shape_revision must be a non-negative integer reference.');
  }
}

function validateRenderProfile(value) {
  if (value === undefined) return;
  if (!isPlainObject(value)) throw new TypeError('render_profile must be an object.');
  assertAllowedKeys(value, RENDER_PROFILE_FIELDS, 'render_profile');
  if ('layer' in value && (!Number.isInteger(Number(value.layer)) || Number(value.layer) < 0 || Number(value.layer) > 31)) {
    throw new RangeError('render_profile.layer must be an integer between 0 and 31.');
  }
}

function validateOffset(value) {
  if (!isPlainObject(value)) throw new TypeError('size_profile.offset must be an object.');
  assertAllowedKeys(value, OFFSET_FIELDS, 'size_profile.offset');
  for (const key of OFFSET_FIELDS) {
    if (key in value && (!Number.isFinite(Number(value[key])) || Number(value[key]) < -1 || Number(value[key]) > 1)) {
      throw new RangeError(`size_profile.offset.${key} must be between -1 and 1.`);
    }
  }
}

function validateMaterialProperties(value) {
  if (!isPlainObject(value)) throw new TypeError('physics_profile.materialProperties must be an object.');
  assertAllowedKeys(value, MATERIAL_PROPERTIES_FIELDS, 'physics_profile.materialProperties');
  if ('density' in value && (!Number.isFinite(Number(value.density)) || Number(value.density) < 0.01 || Number(value.density) > 10)) {
    throw new RangeError('physics_profile.materialProperties.density must be between 0.01 and 10.');
  }
  for (const key of ['friction', 'damping']) {
    if (key in value && (!Number.isFinite(Number(value[key])) || Number(value[key]) < 0 || Number(value[key]) > 1)) {
      throw new RangeError(`physics_profile.materialProperties.${key} must be between 0 and 1.`);
    }
  }
}

function normalizeType(value) {
  return Object.values(CLOTHING_TYPES).includes(String(value)) ? String(value) : CLOTHING_TYPES.TOP;
}

function assertAllowedKeys(value, allowed, label) {
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(`${label}.${key} is not part of the Clothing contract.`);
}

function uniqueStrings(value, fallback) {
  const items = Array.isArray(value) ? value : fallback;
  const result = [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
  return result.length ? result : [...fallback];
}

function colorOr(value, fallback) {
  const color = String(value || '');
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
}

function unit(value, fallback) { return range(value, 0, 1, fallback); }
function range(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : fallback;
}
function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}
function integerInRange(value, min, max, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}
function nullableString(value) {
  const result = String(value ?? '').trim();
  return result || null;
}
function stringOr(value, fallback) {
  const result = String(value ?? '').trim();
  return result || fallback;
}
function isPlainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
