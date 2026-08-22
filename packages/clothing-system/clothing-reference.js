export const CLOTHING_REFERENCE_SCHEMA = 'humanoid_rig/clothing_reference@1.0';
export const CLOTHING_REFERENCE_SLOTS = Object.freeze(['upper', 'lower', 'shoes', 'accessory']);

const REFERENCE_FIELDS = new Set(['clothingId', 'definitionId', 'revision']);

export function createClothingReference(input = {}) {
  assertClothingReferenceInput(input, { partial: true });
  const reference = {
    clothingId: identifierOr(input.clothingId, 'clothing_001'),
    definitionId: nullableIdentifier(input.definitionId),
    revision: positiveInteger(input.revision, 1),
  };
  assertClothingReference(reference);
  return structuredClone(reference);
}

export function assertClothingReference(reference) {
  assertClothingReferenceInput(reference, { partial: false });
  return true;
}

export function assertClothingReferenceInput(input, { partial = true } = {}) {
  if (!isPlainObject(input)) throw new TypeError('ClothingReference must be an object.');
  for (const key of Object.keys(input)) {
    if (!REFERENCE_FIELDS.has(key)) throw new TypeError(`ClothingReference.${key} is not part of the Clothing contract.`);
  }
  if (!partial) {
    for (const key of REFERENCE_FIELDS) if (!(key in input)) throw new TypeError(`ClothingReference is missing ${key}.`);
  }
  if ('clothingId' in input) assertIdentifier(input.clothingId, 'clothingId');
  if ('definitionId' in input && input.definitionId !== null) assertIdentifier(input.definitionId, 'definitionId');
  if ('revision' in input && (!Number.isInteger(Number(input.revision)) || Number(input.revision) < 1)) {
    throw new TypeError('ClothingReference revision must be a positive integer.');
  }
  return true;
}

export function createEmptyClothingReferences() {
  return { upper: null, lower: null, shoes: null, accessory: null };
}

export function normalizeClothingReferences(input) {
  const source = isPlainObject(input) ? input : {};
  for (const key of Object.keys(source)) {
    if (!CLOTHING_REFERENCE_SLOTS.includes(key)) {
      throw new TypeError(`clothing_references.${key} is not a supported clothing slot.`);
    }
  }
  const result = createEmptyClothingReferences();
  for (const slot of CLOTHING_REFERENCE_SLOTS) {
    result[slot] = source[slot] == null ? null : createClothingReference(source[slot]);
  }
  return result;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : fallback;
}

function nullableIdentifier(value) {
  if (value == null || String(value).trim() === '') return null;
  const result = String(value).trim();
  assertIdentifier(result, 'definitionId');
  return result;
}

function identifierOr(value, fallback) {
  const result = String(value ?? '').trim() || fallback;
  assertIdentifier(result, 'clothingId');
  return result;
}

function assertIdentifier(value, label) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(value || ''))) {
    throw new TypeError(`${label} must use letters, numbers, dot, underscore, or hyphen.`);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
