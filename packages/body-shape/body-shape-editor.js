import {
  BODY_SHAPE_PARAMETER_KEYS,
  assertBodyShapeParameterPatch,
  createBodyShapeProfile,
} from './body-shape-profile.js';
import { createSkinShapeResponse } from './body-shape-runtime.js';

export const BODY_SHAPE_STATE_SCHEMA = 'humanoid_rig/body_shape_state@1.0';

export class BodyShapeRevisionConflictError extends Error {
  constructor(expected, actual) {
    super(`BodyShape revision conflict: expected ${expected}, current ${actual}.`);
    this.name = 'BodyShapeRevisionConflictError';
    this.expected_revision = expected;
    this.actual_revision = actual;
  }
}

export function createBodyShapeState(profileInput = {}) {
  const profile = createBodyShapeProfile(profileInput);
  const now = new Date().toISOString();
  return {
    schema: BODY_SHAPE_STATE_SCHEMA,
    revision: 1,
    updated_at: now,
    active_profile_id: profile.body_shape_id,
    dirty: false,
    profiles: { [profile.body_shape_id]: profile },
    versions: { [profile.body_shape_id]: [structuredClone(profile)] },
    skin_response: createSkinShapeResponse(profile),
  };
}

export function normalizeBodyShapeState(input, { fallbackProfile = {} } = {}) {
  const source = isPlainObject(input) ? input : {};
  const profiles = {};
  for (const [id, value] of Object.entries(isPlainObject(source.profiles) ? source.profiles : {})) {
    try {
      const profile = createBodyShapeProfile({ ...value, body_shape_id: value?.body_shape_id || id });
      profiles[profile.body_shape_id] = profile;
    } catch (_) {}
  }
  if (Object.keys(profiles).length === 0) {
    const profile = createBodyShapeProfile(fallbackProfile);
    profiles[profile.body_shape_id] = profile;
  }
  const requested = String(source.active_profile_id || '');
  const activeId = profiles[requested] ? requested : Object.keys(profiles)[0];
  const versions = {};
  const incomingVersions = isPlainObject(source.versions) ? source.versions : {};
  for (const profile of Object.values(profiles)) {
    const snapshots = Array.isArray(incomingVersions[profile.body_shape_id])
      ? incomingVersions[profile.body_shape_id].map((item) => {
          try { return createBodyShapeProfile(item); } catch (_) { return null; }
        }).filter(Boolean)
      : [];
    versions[profile.body_shape_id] = dedupeVersions(
      snapshots.length ? snapshots : [structuredClone(profile)],
    );
  }
  const active = profiles[activeId];
  return {
    schema: BODY_SHAPE_STATE_SCHEMA,
    revision: nonNegativeInteger(source.revision, 1),
    updated_at: validIso(source.updated_at) ? source.updated_at : new Date().toISOString(),
    active_profile_id: activeId,
    dirty: Boolean(source.dirty),
    profiles,
    versions,
    skin_response: createSkinShapeResponse(active),
  };
}

export class BodyShapeEditor {
  update(stateInput, parameterPatch, options = {}) {
    const state = normalizeBodyShapeState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    assertBodyShapeParameterPatch(parameterPatch);
    const current = activeProfile(state);
    const profile = createBodyShapeProfile({ ...current, ...parameterPatch, version: current.version });
    return commitDraft(state, profile, true, options.at);
  }

  saveVersion(stateInput, options = {}) {
    const state = normalizeBodyShapeState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const current = activeProfile(state);
    const profile = createBodyShapeProfile({ ...current, version: current.version + 1 });
    const next = commitDraft(state, profile, false, options.at);
    next.versions[profile.body_shape_id] = [
      ...(next.versions[profile.body_shape_id] || []),
      structuredClone(profile),
    ].slice(-100);
    return next;
  }

  restoreVersion(stateInput, version, options = {}) {
    const state = normalizeBodyShapeState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const current = activeProfile(state);
    const snapshot = (state.versions[current.body_shape_id] || [])
      .find((item) => item.version === Number(version));
    if (!snapshot) throw new Error(`BodyShape ${current.body_shape_id} version ${version} does not exist.`);
    const parameters = Object.fromEntries(BODY_SHAPE_PARAMETER_KEYS.map((key) => [key, snapshot[key]]));
    const restored = createBodyShapeProfile({
      ...current,
      ...parameters,
      name: `${current.name} (restored v${snapshot.version})`,
      version: current.version + 1,
    });
    const next = commitDraft(state, restored, false, options.at);
    next.versions[restored.body_shape_id] = [
      ...(next.versions[restored.body_shape_id] || []),
      structuredClone(restored),
    ].slice(-100);
    return next;
  }

  loadVersion(stateInput, version = null) {
    const state = normalizeBodyShapeState(stateInput);
    const current = activeProfile(state);
    if (version == null) return structuredClone(current);
    const snapshot = (state.versions[current.body_shape_id] || [])
      .find((item) => item.version === Number(version));
    if (!snapshot) throw new Error(`BodyShape ${current.body_shape_id} version ${version} does not exist.`);
    return structuredClone(snapshot);
  }
}

export function getActiveBodyShapeProfile(stateInput) {
  return structuredClone(activeProfile(normalizeBodyShapeState(stateInput)));
}

function commitDraft(state, profile, dirty, at) {
  const next = structuredClone(state);
  next.revision += 1;
  next.updated_at = validIso(at) ? at : new Date().toISOString();
  next.dirty = dirty;
  next.profiles[profile.body_shape_id] = profile;
  next.active_profile_id = profile.body_shape_id;
  next.skin_response = createSkinShapeResponse(profile);
  return next;
}

function activeProfile(state) {
  const profile = state.profiles[state.active_profile_id];
  if (!profile) throw new Error('BodyShape state has no active profile.');
  return profile;
}

function assertExpectedRevision(state, expected) {
  if (expected == null) return;
  const value = Number(expected);
  if (!Number.isInteger(value) || value !== state.revision) {
    throw new BodyShapeRevisionConflictError(expected, state.revision);
  }
}

function dedupeVersions(items) {
  const byVersion = new Map();
  for (const item of items) byVersion.set(item.version, item);
  return [...byVersion.values()].sort((left, right) => left.version - right.version).slice(-100);
}

function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function validIso(value) {
  return Number.isFinite(Date.parse(value || ''));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
