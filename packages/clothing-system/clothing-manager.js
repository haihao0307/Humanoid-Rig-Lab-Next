import { createLegacyClothingAsset } from './clothing-asset.js';
import { createClothingProfile } from './clothing-profile.js';
import { createClothingRuntimeDescriptor } from './clothing-runtime.js';

export const CLOTHING_STATE_SCHEMA = 'humanoid_rig/clothing_state@1.0';

export class ClothingRevisionConflictError extends Error {
  constructor(expected, actual) {
    super(`Clothing revision conflict: expected ${expected}, current ${actual}.`);
    this.name = 'ClothingRevisionConflictError';
    this.expected_revision = expected;
    this.actual_revision = actual;
  }
}

export function createClothingState(profileInput = {}) {
  const profile = createClothingProfile(profileInput);
  const now = new Date().toISOString();
  return {
    schema: CLOTHING_STATE_SCHEMA,
    revision: 1,
    updated_at: now,
    active_profile_id: profile.clothing_profile_id,
    dirty: false,
    profiles: { [profile.clothing_profile_id]: profile },
    versions: { [profile.clothing_profile_id]: [structuredClone(profile)] },
    runtime_descriptor: createClothingRuntimeDescriptor(profile),
  };
}

export function normalizeClothingState(input, { fallbackProfile = {} } = {}) {
  const source = isPlainObject(input) ? input : {};
  const profiles = {};
  for (const [id, value] of Object.entries(isPlainObject(source.profiles) ? source.profiles : {})) {
    try {
      const profile = createClothingProfile({ ...value, clothing_profile_id: value?.clothing_profile_id || id });
      profiles[profile.clothing_profile_id] = profile;
    } catch (_) {}
  }
  if (Object.keys(profiles).length === 0) {
    const fallback = createClothingProfile(fallbackProfile);
    profiles[fallback.clothing_profile_id] = fallback;
  }
  const requested = String(source.active_profile_id || '');
  const activeId = profiles[requested] ? requested : Object.keys(profiles)[0];
  const versions = {};
  const incomingVersions = isPlainObject(source.versions) ? source.versions : {};
  for (const profile of Object.values(profiles)) {
    const snapshots = Array.isArray(incomingVersions[profile.clothing_profile_id])
      ? incomingVersions[profile.clothing_profile_id].map((item) => {
          try { return createClothingProfile({ ...item, clothing_profile_id: profile.clothing_profile_id }); }
          catch (_) { return null; }
        }).filter(Boolean)
      : [];
    versions[profile.clothing_profile_id] = dedupeVersions(snapshots.length ? snapshots : [structuredClone(profile)]);
  }
  const active = profiles[activeId];
  return {
    schema: CLOTHING_STATE_SCHEMA,
    revision: nonNegativeInteger(source.revision, 1),
    updated_at: validIso(source.updated_at) ? source.updated_at : new Date().toISOString(),
    active_profile_id: activeId,
    dirty: Boolean(source.dirty),
    profiles,
    versions,
    runtime_descriptor: createClothingRuntimeDescriptor(active),
  };
}

export class ClothingManager {
  add(stateInput, assetInput, options = {}) {
    const state = normalizeClothingState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const current = activeProfile(state);
    const asset = createLegacyClothingAsset({ ...assetInput, revision: 1 });
    if (current.assets.some((item) => item.clothing_id === asset.clothing_id)) {
      throw new Error(`ClothingAsset ${asset.clothing_id} already exists.`);
    }
    return commit(state, createClothingProfile({ ...current, assets: [...current.assets, asset] }), true, options.at);
  }

  remove(stateInput, clothingId, options = {}) {
    const state = normalizeClothingState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const current = activeProfile(state);
    const id = String(clothingId || '');
    if (!current.assets.some((item) => item.clothing_id === id)) throw new Error(`ClothingAsset ${id} does not exist.`);
    return commit(state, createClothingProfile({
      ...current,
      assets: current.assets.filter((item) => item.clothing_id !== id),
    }), true, options.at);
  }

  update(stateInput, clothingId, patch = {}, options = {}) {
    const state = normalizeClothingState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const current = activeProfile(state);
    const id = String(clothingId || '');
    const currentAsset = current.assets.find((item) => item.clothing_id === id);
    if (!currentAsset) throw new Error(`ClothingAsset ${id} does not exist.`);
    const asset = createLegacyClothingAsset(mergeAssetInput(currentAsset, patch, {
      clothing_id: currentAsset.clothing_id,
      type: currentAsset.type,
      revision: currentAsset.revision + 1,
    }));
    return commit(state, createClothingProfile({
      ...current,
      assets: current.assets.map((item) => item.clothing_id === id ? asset : item),
    }), true, options.at);
  }

  replace(stateInput, clothingId, replacementInput = {}, options = {}) {
    const state = normalizeClothingState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const current = activeProfile(state);
    const id = String(clothingId || '');
    const currentAsset = current.assets.find((item) => item.clothing_id === id);
    if (!currentAsset) throw new Error(`ClothingAsset ${id} does not exist.`);
    const replacementId = String(replacementInput?.clothing_id || '').trim();
    if (!replacementId) throw new TypeError('Replacement clothing_id is required.');
    if (replacementId === id) return structuredClone(state);
    if (current.assets.some((item) => item.clothing_id === replacementId)) {
      throw new Error(`ClothingAsset ${replacementId} already exists.`);
    }
    if (replacementInput?.type != null && String(replacementInput.type) !== currentAsset.type) {
      throw new TypeError('Replacement ClothingAsset must stay in the same clothing type.');
    }
    const asset = createLegacyClothingAsset(mergeAssetInput(currentAsset, replacementInput, {
      clothing_id: replacementId,
      type: currentAsset.type,
      revision: 1,
    }));
    return commit(state, createClothingProfile({
      ...current,
      assets: current.assets.map((item) => item.clothing_id === id ? asset : item),
    }), true, options.at);
  }

  saveVersion(stateInput, options = {}) {
    const state = normalizeClothingState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const current = activeProfile(state);
    const profile = createClothingProfile({ ...current, version: current.version + 1 });
    const next = commit(state, profile, false, options.at);
    next.versions[profile.clothing_profile_id] = [
      ...(next.versions[profile.clothing_profile_id] || []),
      structuredClone(profile),
    ].slice(-100);
    return next;
  }

  restoreVersion(stateInput, version, options = {}) {
    const state = normalizeClothingState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const current = activeProfile(state);
    const snapshot = (state.versions[current.clothing_profile_id] || [])
      .find((item) => item.version === Number(version));
    if (!snapshot) throw new Error(`ClothingProfile ${current.clothing_profile_id} version ${version} does not exist.`);
    const profile = createClothingProfile({ ...snapshot, version: current.version + 1 });
    const next = commit(state, profile, false, options.at);
    next.versions[profile.clothing_profile_id] = [
      ...(next.versions[profile.clothing_profile_id] || []),
      structuredClone(profile),
    ].slice(-100);
    return next;
  }

  loadVersion(stateInput, version = null) {
    const state = normalizeClothingState(stateInput);
    const current = activeProfile(state);
    if (version == null) return structuredClone(current);
    const snapshot = (state.versions[current.clothing_profile_id] || [])
      .find((item) => item.version === Number(version));
    if (!snapshot) throw new Error(`ClothingProfile ${current.clothing_profile_id} version ${version} does not exist.`);
    return structuredClone(snapshot);
  }
}

export function getActiveClothingProfile(stateInput) {
  return structuredClone(activeProfile(normalizeClothingState(stateInput)));
}

function commit(state, profile, dirty, at) {
  const next = structuredClone(state);
  next.revision += 1;
  next.updated_at = operationTime(at);
  next.active_profile_id = profile.clothing_profile_id;
  next.dirty = dirty;
  next.profiles[profile.clothing_profile_id] = profile;
  next.runtime_descriptor = createClothingRuntimeDescriptor(profile);
  return next;
}
function activeProfile(state) {
  const profile = state.profiles[state.active_profile_id];
  if (!profile) throw new Error('Clothing state has no active profile.');
  return profile;
}
function mergeAssetInput(current, patch, identity) {
  const source = isPlainObject(patch) ? patch : {};
  return {
    ...structuredClone(current),
    ...structuredClone(source),
    ...identity,
    rig_profile: { ...structuredClone(current.rig_profile), ...structuredClone(source.rig_profile || {}) },
    material: { ...structuredClone(current.material), ...structuredClone(source.material || {}) },
    physics_profile: {
      ...structuredClone(current.physics_profile),
      ...structuredClone(source.physics_profile || {}),
      materialProperties: {
        ...structuredClone(current.physics_profile?.materialProperties || {}),
        ...structuredClone(source.physics_profile?.materialProperties || {}),
      },
    },
    size_profile: {
      ...structuredClone(current.size_profile),
      ...structuredClone(source.size_profile || {}),
      offset: {
        ...structuredClone(current.size_profile?.offset || {}),
        ...structuredClone(source.size_profile?.offset || {}),
      },
    },
    render_profile: { ...structuredClone(current.render_profile), ...structuredClone(source.render_profile || {}) },
  };
}
function assertExpectedRevision(state, expected) {
  if (expected == null) return;
  const value = Number(expected);
  if (!Number.isInteger(value) || value !== state.revision) throw new ClothingRevisionConflictError(expected, state.revision);
}
function dedupeVersions(items) {
  const byVersion = new Map();
  for (const item of items) byVersion.set(item.version, item);
  return [...byVersion.values()].sort((left, right) => left.version - right.version).slice(-100);
}
function operationTime(value) { return validIso(value) ? value : new Date().toISOString(); }
function validIso(value) { return Number.isFinite(Date.parse(value || '')); }
function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}
function isPlainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
