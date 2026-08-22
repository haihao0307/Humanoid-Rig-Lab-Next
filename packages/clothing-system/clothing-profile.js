import { createLegacyClothingAsset } from './clothing-asset.js';
import { createClothingReference, createEmptyClothingReferences } from './clothing-reference.js';

export const CLOTHING_PROFILE_SCHEMA = 'humanoid_rig/clothing_profile@1.0';
const PROFILE_FIELDS = new Set(['clothing_profile_id', 'character_id', 'version', 'assets']);

export function createClothingProfile(input = {}) {
  assertClothingProfileInput(input, { partial: true });
  const assets = (Array.isArray(input.assets) ? input.assets : []).map(createLegacyClothingAsset);
  assertUniqueAssets(assets);
  const profile = {
    clothing_profile_id: stringOr(input.clothing_profile_id, 'clothing_profile_001'),
    character_id: nullableString(input.character_id),
    version: positiveInteger(input.version, 1),
    assets,
  };
  assertClothingProfile(profile);
  return structuredClone(profile);
}

export function normalizeClothingProfile(input = {}) {
  return createClothingProfile(input);
}

export function assertClothingProfile(profile) {
  assertClothingProfileInput(profile, { partial: false });
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(profile.clothing_profile_id)) {
    throw new TypeError('clothing_profile_id must use letters, numbers, dot, underscore, or hyphen.');
  }
  assertUniqueAssets(profile.assets);
  return true;
}

export function assertClothingProfileInput(input, { partial = true } = {}) {
  if (!isPlainObject(input)) throw new TypeError('ClothingProfile must be an object.');
  for (const key of Object.keys(input)) {
    if (!PROFILE_FIELDS.has(key)) throw new TypeError(`ClothingProfile.${key} is not part of the Clothing contract.`);
  }
  if (!partial) for (const key of PROFILE_FIELDS) if (!(key in input)) throw new TypeError(`ClothingProfile is missing ${key}.`);
  if ('assets' in input && !Array.isArray(input.assets)) throw new TypeError('ClothingProfile.assets must be an array.');
  return true;
}

export function clothingAttachmentReferences(profileInput) {
  const profile = createClothingProfile(profileInput);
  return profile.assets.map((asset) => ({ clothing_id: asset.clothing_id, revision: asset.revision }));
}

export function clothingSlotReferences(profileInput) {
  const profile = createClothingProfile(profileInput);
  const references = createEmptyClothingReferences();
  for (const asset of profile.assets) {
    const slot = asset.type === 'top' ? 'upper' : asset.type === 'pants' ? 'lower' : 'shoes';
    references[slot] = createClothingReference({
      clothingId: asset.clothing_id,
      revision: asset.revision,
    });
  }
  return references;
}

function assertUniqueAssets(assets) {
  const ids = new Set();
  for (const asset of assets) {
    if (ids.has(asset.clothing_id)) throw new Error(`Duplicate ClothingAsset ${asset.clothing_id}.`);
    ids.add(asset.clothing_id);
  }
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : fallback;
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
