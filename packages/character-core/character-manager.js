import {
  CHARACTER_REVISION_FIELDS,
  assertCharacterProfileInput,
  createCharacterProfile,
} from './character-profile.js';
import { normalizeCharacterState } from './character-state.js';
import { createCharacterVersion } from './character-version.js';

export const OPERATION_EVENT_SCHEMA = 'humanoid_rig/operation_event@1.0';

export class CharacterRevisionConflictError extends Error {
  constructor(expected, actual) {
    super(`Character revision conflict: expected ${expected}, current ${actual}.`);
    this.name = 'CharacterRevisionConflictError';
    this.expected_revision = expected;
    this.actual_revision = actual;
  }
}

export class CharacterManager {
  create(stateInput, profileInput, options = {}) {
    const state = normalizeCharacterState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const profile = createCharacterProfile({ ...profileInput, version: 1 }, options.module_revisions);
    if (state.profiles[profile.character_id]) throw new Error(`Character ${profile.character_id} already exists.`);
    const now = operationTime(options.at);
    const next = structuredClone(state);
    next.revision += 1;
    next.updated_at = now;
    next.active_character_id = profile.character_id;
    next.profiles[profile.character_id] = profile;
    next.versions[profile.character_id] = [createCharacterVersion(profile, now)];
    return buildResult(state, next, profile, 'character.create', options, { created: true });
  }

  save(stateInput, profilePatch, options = {}) {
    const state = normalizeCharacterState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    assertCharacterProfileInput(profilePatch, { partial: true });
    const characterId = String(profilePatch.character_id || '');
    const existing = state.profiles[characterId];
    if (!existing) throw new Error(`Character ${characterId || '(missing id)'} does not exist.`);
    const profile = createCharacterProfile({
      ...existing,
      ...profilePatch,
      identity: { ...existing.identity, ...(profilePatch.identity || {}) },
      body_shape: { ...existing.body_shape, ...(profilePatch.body_shape || {}) },
      face_identity: { ...existing.face_identity, ...(profilePatch.face_identity || {}) },
      hair: { ...existing.hair, ...(profilePatch.hair || {}) },
      version: existing.version + 1,
    });
    const now = operationTime(options.at);
    const next = structuredClone(state);
    next.revision += 1;
    next.updated_at = now;
    next.active_character_id = characterId;
    next.profiles[characterId] = profile;
    next.versions[characterId] = [
      ...(next.versions[characterId] || []),
      createCharacterVersion(profile, now),
    ].slice(-100);
    return buildResult(state, next, profile, 'character.save', options, {
      module_revision_changes: revisionChanges(existing, profile),
    });
  }

  activate(stateInput, characterId, options = {}) {
    const state = normalizeCharacterState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const id = String(characterId || '').trim();
    const profile = state.profiles[id];
    if (!profile) throw new Error(`Character ${id || '(missing id)'} does not exist.`);
    const now = operationTime(options.at);
    const next = structuredClone(state);
    next.revision += 1;
    next.updated_at = now;
    next.active_character_id = id;
    return buildResult(state, next, profile, 'character.load', options, {
      active_character_id: id,
      profile_version: profile.version,
    });
  }

  restore(stateInput, characterId, version, options = {}) {
    const state = normalizeCharacterState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const id = String(characterId || state.active_character_id || '').trim();
    const current = state.profiles[id];
    if (!current) throw new Error(`Character ${id || '(missing id)'} does not exist.`);
    const restoredVersion = Number(version);
    const snapshot = (state.versions[id] || []).find((item) => item.version === restoredVersion);
    if (!snapshot) throw new Error(`Character ${id} version ${version} does not exist.`);
    const nextProfileVersion = Math.max(
      current.version,
      ...(state.versions[id] || []).map((item) => Number(item.version) || 0),
    ) + 1;
    const profile = createCharacterProfile({
      ...snapshot.profile,
      character_id: id,
      version: nextProfileVersion,
    });
    const now = operationTime(options.at);
    const next = structuredClone(state);
    next.revision += 1;
    next.updated_at = now;
    next.active_character_id = id;
    next.profiles[id] = profile;
    next.versions[id] = [
      ...(next.versions[id] || []),
      createCharacterVersion(profile, now),
    ].slice(-100);
    return buildResult(state, next, profile, 'character.restore', options, {
      restored_from_version: restoredVersion,
      replaced_profile_version: current.version,
    });
  }

  updateReferences(state, characterId, references, options = {}) {
    const allowed = new Set(CHARACTER_REVISION_FIELDS);
    for (const key of Object.keys(references || {})) {
      if (!allowed.has(key)) throw new TypeError(`${key} is not a Character module revision reference.`);
    }
    return this.save(state, { character_id: characterId, ...(references || {}) }, options);
  }

  load(stateInput, characterId, { version = null } = {}) {
    const state = normalizeCharacterState(stateInput);
    const id = String(characterId || state.active_character_id || '');
    if (version == null) {
      const profile = state.profiles[id];
      if (!profile) throw new Error(`Character ${id || '(missing id)'} does not exist.`);
      return structuredClone(profile);
    }
    const snapshot = (state.versions[id] || []).find((item) => item.version === Number(version));
    if (!snapshot) throw new Error(`Character ${id} version ${version} does not exist.`);
    return structuredClone(snapshot.profile);
  }
}

export function appendOperationEvent(events, event) {
  if (!event?.event_id) return Array.isArray(events) ? structuredClone(events) : [];
  const incoming = Array.isArray(events) ? events : [];
  return [structuredClone(event), ...incoming.filter((item) => item?.event_id !== event.event_id)].slice(0, 200);
}

function buildResult(previous, state, profile, operation, options, changes) {
  return {
    state,
    profile: structuredClone(profile),
    event: {
      schema: OPERATION_EVENT_SCHEMA,
      event_id: String(options.event_id || createId()),
      operation,
      character_id: profile.character_id,
      base_revision: previous.revision,
      revision: state.revision,
      actor: String(options.actor || 'character-core'),
      at: state.updated_at,
      changes: structuredClone(changes),
    },
  };
}

function revisionChanges(before, after) {
  const result = {};
  for (const key of CHARACTER_REVISION_FIELDS) {
    if (before[key] !== after[key]) result[key] = { from: before[key], to: after[key] };
  }
  return result;
}

function assertExpectedRevision(state, expected) {
  if (expected == null) return;
  const value = Number(expected);
  if (!Number.isInteger(value) || value !== state.revision) {
    throw new CharacterRevisionConflictError(expected, state.revision);
  }
}

function operationTime(value) {
  return Number.isFinite(Date.parse(value || '')) ? value : new Date().toISOString();
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `operation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
