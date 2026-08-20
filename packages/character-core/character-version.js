import { CHARACTER_REVISION_FIELDS, assertCharacterProfile } from './character-profile.js';

export const CHARACTER_VERSION_SCHEMA = 'humanoid_rig/character_version@1.0';

export function createCharacterVersion(profile, savedAt = new Date().toISOString()) {
  assertCharacterProfile(profile);
  return {
    schema: CHARACTER_VERSION_SCHEMA,
    character_id: profile.character_id,
    version: profile.version,
    saved_at: validIso(savedAt) ? savedAt : new Date().toISOString(),
    module_revisions: Object.fromEntries(
      CHARACTER_REVISION_FIELDS.map((field) => [field, profile[field]]),
    ),
    profile: structuredClone(profile),
  };
}

export function compareCharacterVersions(left, right) {
  if (left.character_id !== right.character_id) {
    return String(left.character_id).localeCompare(String(right.character_id));
  }
  return Number(left.version || 0) - Number(right.version || 0);
}

function validIso(value) {
  return Number.isFinite(Date.parse(value || ''));
}
