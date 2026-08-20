import { createCharacterProfile } from './character-profile.js';
import { createCharacterVersion } from './character-version.js';

export const CHARACTER_STATE_SCHEMA = 'humanoid_rig/character_state@1.0';

export function createCharacterState({
  profiles = [],
  active_character_id = null,
  revision = 0,
  updated_at = new Date().toISOString(),
} = {}) {
  const byId = {};
  const versions = {};
  for (const input of profiles) {
    const profile = createCharacterProfile(input);
    byId[profile.character_id] = profile;
    versions[profile.character_id] = [createCharacterVersion(profile, updated_at)];
  }
  const activeId = active_character_id && byId[active_character_id]
    ? active_character_id
    : Object.keys(byId)[0] || null;
  return {
    schema: CHARACTER_STATE_SCHEMA,
    revision: nonNegativeInteger(revision, Object.keys(byId).length > 0 ? 1 : 0),
    updated_at: validIso(updated_at) ? updated_at : new Date().toISOString(),
    active_character_id: activeId,
    profiles: byId,
    versions,
  };
}

export function normalizeCharacterState(input, { fallbackProfile = null } = {}) {
  const source = isPlainObject(input) ? input : {};
  const profiles = {};
  for (const [id, value] of Object.entries(isPlainObject(source.profiles) ? source.profiles : {})) {
    try {
      const profile = createCharacterProfile({ ...value, character_id: value?.character_id || id });
      profiles[profile.character_id] = profile;
    } catch (_) {}
  }
  if (Object.keys(profiles).length === 0 && fallbackProfile) {
    const profile = createCharacterProfile(fallbackProfile);
    profiles[profile.character_id] = profile;
  }

  const updatedAt = validIso(source.updated_at) ? source.updated_at : new Date().toISOString();
  const versions = {};
  const incomingVersions = isPlainObject(source.versions) ? source.versions : {};
  for (const profile of Object.values(profiles)) {
    const snapshots = Array.isArray(incomingVersions[profile.character_id])
      ? incomingVersions[profile.character_id]
          .filter((item) => isPlainObject(item?.profile))
          .map((item) => {
            try { return createCharacterVersion(createCharacterProfile(item.profile), item.saved_at); }
            catch (_) { return null; }
          })
          .filter(Boolean)
      : [];
    versions[profile.character_id] = dedupeVersions(
      snapshots.length > 0 ? snapshots : [createCharacterVersion(profile, updatedAt)],
    );
  }
  const requestedActive = String(source.active_character_id || '');
  return {
    schema: CHARACTER_STATE_SCHEMA,
    revision: nonNegativeInteger(source.revision, Object.keys(profiles).length > 0 ? 1 : 0),
    updated_at: updatedAt,
    active_character_id: profiles[requestedActive] ? requestedActive : Object.keys(profiles)[0] || null,
    profiles,
    versions,
  };
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
