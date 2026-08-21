import { createAccessoryProfile } from './accessory-profile.js';
import { createHairProfile } from './hair-profile.js';

export const APPEARANCE_STATE_SCHEMA = 'humanoid_rig/appearance_state@1.0';
export const APPEARANCE_VERSION_SCHEMA = 'humanoid_rig/appearance_version@1.0';
export const APPEARANCE_RUNTIME_DESCRIPTOR_SCHEMA = 'humanoid_rig/appearance_runtime_descriptor@1.0';
export const APPEARANCE_ATTACHMENT_FRAME_SCHEMA = 'humanoid_rig/appearance_attachment_frame@1.0';

export class AppearanceRevisionConflictError extends Error {
  constructor(expected, actual) {
    super(`Appearance revision conflict: expected ${expected}, current ${actual}.`);
    this.name = 'AppearanceRevisionConflictError';
    this.expected_revision = expected;
    this.actual_revision = actual;
  }
}

export function createAppearanceState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const now = operationTime(source.updated_at);
  const hairProfiles = normalizeHairProfiles(source.hair_profiles);
  const accessories = normalizeAccessories(source.accessories);
  const requestedHairId = nullableString(source.active_hair_id);
  const activeHairId = requestedHairId && hairProfiles[requestedHairId]
    ? requestedHairId
    : Object.keys(hairProfiles)[0] || null;
  const state = {
    schema: APPEARANCE_STATE_SCHEMA,
    revision: nonNegativeInteger(source.revision, 1),
    updated_at: now,
    character_id: identifier(source.character_id, 'character_001', 'character_id'),
    version: positiveInteger(source.version, 1),
    dirty: Boolean(source.dirty),
    active_hair_id: activeHairId,
    hair_profiles: hairProfiles,
    accessories,
    versions: [],
    runtime_descriptor: null,
  };
  state.versions = normalizeVersions(source.versions, state);
  state.runtime_descriptor = createAppearanceRuntimeDescriptor(state);
  return structuredClone(state);
}

export function normalizeAppearanceState(input, { fallbackCharacterId = 'character_001' } = {}) {
  const source = isPlainObject(input) ? input : {};
  return createAppearanceState({ ...source, character_id: source.character_id || fallbackCharacterId });
}

export function createAppearanceRuntimeDescriptor(stateInput = {}) {
  const view = appearanceView(stateInput);
  const hair = view.active_hair_id ? view.hair_profiles[view.active_hair_id] || null : null;
  return {
    schema: APPEARANCE_RUNTIME_DESCRIPTOR_SCHEMA,
    character_id: view.character_id,
    appearance_version: view.version,
    phase: 'static-attachments',
    render_stack: ['character', 'body_skin', 'clothing_mesh', 'appearance_attachments'],
    binding: 'simulationRig',
    hair: hair ? {
      hair_id: hair.hair_id,
      revision: hair.revision,
      style: hair.style,
      attachment_points: [...hair.rig_profile.attachment_points],
    } : null,
    accessories: Object.values(view.accessories).map((item) => ({
      accessory_id: item.accessory_id,
      revision: item.revision,
      type: item.type,
      attachment_point: item.rig_profile.attachment_point,
    })),
    simulation: { hair: false, cloth: false, gpu_hair: false },
    reads: ['character.reference', 'simulationRig.transforms'],
    writes: ['appearance.mesh.transforms', 'appearance.mesh.material'],
    preserves: ['body_skin', 'body_vertices', 'skin_weights', 'clothing', 'rig', 'bone_lengths', 'hierarchy', 'pose', 'animation_tracks'],
  };
}

export function followAppearanceAttachments(stateInput, simulationRigInput) {
  const state = normalizeAppearanceState(stateInput);
  const source = simulationRigInput?.fk || simulationRigInput || {};
  const positions = source.positions;
  const rotations = source.rotations;
  const hair = state.active_hair_id ? state.hair_profiles[state.active_hair_id] || null : null;
  return {
    schema: APPEARANCE_ATTACHMENT_FRAME_SCHEMA,
    character_id: state.character_id,
    appearance_version: state.version,
    rig_revision: String(simulationRigInput?.rigVersion || 'rig@0.4.0'),
    source: 'simulationRig',
    static_attachments: true,
    hair: hair ? {
      hair_id: hair.hair_id,
      style: hair.style,
      joint_transforms: transformsFor(hair.rig_profile.attachment_points, positions, rotations),
      transform: structuredClone(hair.transform),
    } : null,
    accessories: Object.values(state.accessories).map((item) => ({
      accessory_id: item.accessory_id,
      type: item.type,
      joint_transform: transformsFor([item.rig_profile.attachment_point], positions, rotations)[item.rig_profile.attachment_point],
      transform: structuredClone(item.transform),
    })),
    writes: ['appearance.mesh.transforms'],
    preserves: ['body_skin', 'body_vertices', 'clothing', 'rig', 'pose', 'animation_tracks'],
  };
}

export function getAppearanceCharacterReferences(stateInput) {
  const state = normalizeAppearanceState(stateInput);
  const activeHair = state.active_hair_id ? state.hair_profiles[state.active_hair_id] || null : null;
  return {
    hair: {
      hair_id: activeHair?.hair_id || null,
      revision: activeHair?.revision || 0,
    },
    accessory_attachments: Object.values(state.accessories).map((item) => ({
      accessory_id: item.accessory_id,
      revision: item.revision,
    })),
    hair_revision: activeHair?.revision || 0,
    accessory_revision: state.version,
  };
}

export class AppearanceManager {
  addHair(stateInput, profileInput, options = {}) {
    const state = normalizeAppearanceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const profile = createHairProfile({ ...profileInput, revision: 1 });
    if (state.hair_profiles[profile.hair_id]) throw new Error(`HairProfile ${profile.hair_id} already exists.`);
    const next = beginMutation(state, options.at);
    next.hair_profiles[profile.hair_id] = profile;
    if (options.activate !== false || !next.active_hair_id) next.active_hair_id = profile.hair_id;
    return finishMutation(next);
  }

  switchHair(stateInput, hairId, options = {}) {
    const state = normalizeAppearanceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const id = String(hairId || '');
    if (!state.hair_profiles[id]) throw new Error(`HairProfile ${id} does not exist.`);
    if (state.active_hair_id === id) return state;
    const next = beginMutation(state, options.at);
    next.active_hair_id = id;
    return finishMutation(next);
  }

  removeHair(stateInput, hairId, options = {}) {
    const state = normalizeAppearanceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const id = String(hairId || state.active_hair_id || '');
    if (!state.hair_profiles[id]) throw new Error(`HairProfile ${id} does not exist.`);
    const next = beginMutation(state, options.at);
    delete next.hair_profiles[id];
    if (next.active_hair_id === id) next.active_hair_id = Object.keys(next.hair_profiles)[0] || null;
    return finishMutation(next);
  }

  addAccessory(stateInput, profileInput, options = {}) {
    const state = normalizeAppearanceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const profile = createAccessoryProfile({ ...profileInput, revision: 1 });
    if (state.accessories[profile.accessory_id]) throw new Error(`AccessoryProfile ${profile.accessory_id} already exists.`);
    const next = beginMutation(state, options.at);
    next.accessories[profile.accessory_id] = profile;
    return finishMutation(next);
  }

  removeAccessory(stateInput, accessoryId, options = {}) {
    const state = normalizeAppearanceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const id = String(accessoryId || '');
    if (!state.accessories[id]) throw new Error(`AccessoryProfile ${id} does not exist.`);
    const next = beginMutation(state, options.at);
    delete next.accessories[id];
    return finishMutation(next);
  }

  saveVersion(stateInput, options = {}) {
    const state = normalizeAppearanceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const next = structuredClone(state);
    next.revision += 1;
    next.version += 1;
    next.updated_at = operationTime(options.at);
    next.dirty = false;
    next.runtime_descriptor = createAppearanceRuntimeDescriptor(next);
    next.versions = appendVersion(next.versions, snapshot(next, next.updated_at));
    return next;
  }

  restoreVersion(stateInput, version, options = {}) {
    const state = normalizeAppearanceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const saved = state.versions.find((item) => item.version === Number(version));
    if (!saved) throw new Error(`Appearance version ${version} does not exist.`);
    const next = structuredClone(state);
    next.revision += 1;
    next.updated_at = operationTime(options.at);
    next.version += 1;
    next.dirty = false;
    next.active_hair_id = saved.active_hair_id;
    next.hair_profiles = normalizeHairProfiles(saved.hair_profiles);
    next.accessories = normalizeAccessories(saved.accessories);
    next.runtime_descriptor = createAppearanceRuntimeDescriptor(next);
    next.versions = appendVersion(next.versions, snapshot(next, next.updated_at));
    return next;
  }

  loadVersion(stateInput, version = null) {
    const state = normalizeAppearanceState(stateInput);
    if (version == null) return snapshot(state, state.updated_at);
    const saved = state.versions.find((item) => item.version === Number(version));
    if (!saved) throw new Error(`Appearance version ${version} does not exist.`);
    return structuredClone(saved);
  }
}

export class AppearanceRuntime {
  constructor(stateInput = {}) {
    this.state = normalizeAppearanceState(stateInput);
    this.descriptor = createAppearanceRuntimeDescriptor(this.state);
    this.lastFrame = null;
  }

  bind(stateInput) {
    this.state = normalizeAppearanceState(stateInput);
    this.descriptor = createAppearanceRuntimeDescriptor(this.state);
    this.lastFrame = null;
    return structuredClone(this.descriptor);
  }

  update(simulationRigInput) {
    this.lastFrame = followAppearanceAttachments(this.state, simulationRigInput);
    return structuredClone(this.lastFrame);
  }
}

function beginMutation(state, at) {
  const next = structuredClone(state);
  next.revision += 1;
  next.updated_at = operationTime(at);
  next.dirty = true;
  return next;
}
function finishMutation(next) {
  next.runtime_descriptor = createAppearanceRuntimeDescriptor(next);
  return next;
}
function snapshot(state, savedAt) {
  return {
    schema: APPEARANCE_VERSION_SCHEMA,
    character_id: state.character_id,
    version: state.version,
    saved_at: operationTime(savedAt),
    active_hair_id: state.active_hair_id,
    hair_profiles: structuredClone(state.hair_profiles),
    accessories: structuredClone(state.accessories),
  };
}
function normalizeVersions(value, state) {
  const items = Array.isArray(value) ? value.map((item) => normalizeVersion(item, state.character_id)).filter(Boolean) : [];
  return items.length ? appendVersion([], ...items) : [snapshot(state, state.updated_at)];
}
function normalizeVersion(value, characterId) {
  try {
    if (!isPlainObject(value)) return null;
    const hairProfiles = normalizeHairProfiles(value.hair_profiles);
    const requestedHairId = nullableString(value.active_hair_id);
    return {
      schema: APPEARANCE_VERSION_SCHEMA,
      character_id: identifier(value.character_id, characterId, 'character_id'),
      version: positiveInteger(value.version, 1),
      saved_at: operationTime(value.saved_at),
      active_hair_id: requestedHairId && hairProfiles[requestedHairId] ? requestedHairId : Object.keys(hairProfiles)[0] || null,
      hair_profiles: hairProfiles,
      accessories: normalizeAccessories(value.accessories),
    };
  } catch (_) {
    return null;
  }
}
function appendVersion(items, ...incoming) {
  const byVersion = new Map((items || []).map((item) => [item.version, item]));
  for (const item of incoming) byVersion.set(item.version, structuredClone(item));
  return [...byVersion.values()].sort((left, right) => left.version - right.version).slice(-100);
}
function normalizeHairProfiles(value) {
  const entries = Array.isArray(value)
    ? value.map((item) => [item?.hair_id, item])
    : Object.entries(isPlainObject(value) ? value : {});
  const result = {};
  for (const [id, item] of entries) {
    const profile = createHairProfile({ ...item, hair_id: item?.hair_id || id });
    if (result[profile.hair_id]) throw new TypeError(`Duplicate HairProfile ${profile.hair_id}.`);
    result[profile.hair_id] = profile;
  }
  return result;
}
function normalizeAccessories(value) {
  const entries = Array.isArray(value)
    ? value.map((item) => [item?.accessory_id, item])
    : Object.entries(isPlainObject(value) ? value : {});
  const result = {};
  for (const [id, item] of entries) {
    const profile = createAccessoryProfile({ ...item, accessory_id: item?.accessory_id || id });
    if (result[profile.accessory_id]) throw new TypeError(`Duplicate AccessoryProfile ${profile.accessory_id}.`);
    result[profile.accessory_id] = profile;
  }
  return result;
}
function appearanceView(value) {
  const source = isPlainObject(value) ? value : {};
  const hairProfiles = normalizeHairProfiles(source.hair_profiles);
  const requestedHairId = nullableString(source.active_hair_id);
  return {
    character_id: identifier(source.character_id, 'character_001', 'character_id'),
    version: positiveInteger(source.version, 1),
    active_hair_id: requestedHairId && hairProfiles[requestedHairId] ? requestedHairId : Object.keys(hairProfiles)[0] || null,
    hair_profiles: hairProfiles,
    accessories: normalizeAccessories(source.accessories),
  };
}
function transformsFor(jointIds, positions, rotations) {
  return Object.fromEntries(jointIds.map((jointId) => [jointId, {
    position: vector(readTransform(positions, jointId), [0, 0, 0]),
    rotation: vector(readTransform(rotations, jointId), [0, 0, 0, 1]),
  }]));
}
function readTransform(collection, key) {
  if (collection instanceof Map) return collection.get(key);
  if (collection && typeof collection === 'object') return collection[key];
  return undefined;
}
function vector(value, fallback) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    const result = [...value].map(Number);
    if (result.length === fallback.length && result.every(Number.isFinite)) return result;
  }
  if (value && typeof value === 'object') {
    const keys = fallback.length === 4 ? ['x', 'y', 'z', 'w'] : ['x', 'y', 'z'];
    const result = keys.map((key, index) => Number(value[key] ?? fallback[index]));
    if (result.every(Number.isFinite)) return result;
  }
  return [...fallback];
}
function assertExpectedRevision(state, expected) {
  if (expected == null) return;
  const value = Number(expected);
  if (!Number.isInteger(value) || value !== state.revision) throw new AppearanceRevisionConflictError(expected, state.revision);
}
function identifier(value, fallback, label) {
  const result = String(value ?? fallback ?? '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(result)) throw new TypeError(`${label} must be a valid identifier.`);
  return result;
}
function positiveInteger(value, fallback) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < 1) throw new TypeError('Appearance version must be a positive integer.');
  return number;
}
function nonNegativeInteger(value, fallback) {
  const number = Number(value ?? fallback);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}
function nullableString(value) { return value == null || String(value).trim() === '' ? null : String(value).trim(); }
function operationTime(value) { return Number.isFinite(Date.parse(value || '')) ? value : new Date().toISOString(); }
function isPlainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
