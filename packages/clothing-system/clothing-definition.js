export const CLOTHING_DEFINITION_SCHEMA = 'humanoid_rig/clothing_definition@1.0';

const DEFINITION_FIELDS = new Set([
  'definitionId',
  'clothingId',
  'attachmentBones',
  'bindingTarget',
  'metadata',
]);

export function createClothingDefinition(input = {}) {
  assertClothingDefinitionInput(input, { partial: true });
  const clothingId = identifierOr(input.clothingId, 'clothing_001');
  const definition = {
    definitionId: identifierOr(input.definitionId, `${clothingId}.binding`),
    clothingId,
    attachmentBones: uniqueIdentifiers(input.attachmentBones),
    bindingTarget: 'simulationRig',
    metadata: normalizeMetadata(input.metadata),
  };
  assertClothingDefinition(definition);
  return structuredClone(definition);
}

export function normalizeClothingDefinition(input = {}) {
  return createClothingDefinition(input);
}

export function assertClothingDefinition(definition) {
  assertClothingDefinitionInput(definition, { partial: false });
  if (definition.attachmentBones.length === 0) {
    throw new TypeError('ClothingDefinition attachmentBones must contain at least one bone.');
  }
  return true;
}

export function assertClothingDefinitionInput(input, { partial = true } = {}) {
  if (!isPlainObject(input)) throw new TypeError('ClothingDefinition must be an object.');
  assertAllowedKeys(input, DEFINITION_FIELDS, 'ClothingDefinition');
  if (!partial) {
    for (const key of DEFINITION_FIELDS) {
      if (!(key in input)) throw new TypeError(`ClothingDefinition is missing ${key}.`);
    }
  }
  if ('definitionId' in input) assertIdentifier(input.definitionId, 'definitionId');
  if ('clothingId' in input) assertIdentifier(input.clothingId, 'clothingId');
  if ('attachmentBones' in input) {
    if (!Array.isArray(input.attachmentBones)) throw new TypeError('attachmentBones must be an array.');
    input.attachmentBones.forEach((bone, index) => assertIdentifier(bone, `attachmentBones[${index}]`));
  }
  if ('bindingTarget' in input && input.bindingTarget !== 'simulationRig') {
    throw new TypeError('bindingTarget must be simulationRig.');
  }
  if ('metadata' in input) assertJsonSafe(input.metadata, 'ClothingDefinition.metadata');
  return true;
}

function normalizeMetadata(value) {
  const source = isPlainObject(value) ? value : {};
  assertJsonSafe(source, 'ClothingDefinition.metadata');
  return structuredClone(source);
}

function uniqueIdentifiers(value) {
  const result = [...new Set((Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean))];
  result.forEach((bone, index) => assertIdentifier(bone, `attachmentBones[${index}]`));
  return result;
}

function identifierOr(value, fallback) {
  const result = String(value ?? '').trim() || fallback;
  assertIdentifier(result, 'identifier');
  return result;
}

function assertIdentifier(value, label) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(value || ''))) {
    throw new TypeError(`${label} must use letters, numbers, dot, underscore, or hyphen.`);
  }
}

function assertAllowedKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${label}.${key} is not part of the Clothing contract.`);
  }
}

function assertJsonSafe(value, path, seen = new Set()) {
  if (value == null || ['string', 'boolean'].includes(typeof value)) return true;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} must contain finite numbers only.`);
    return true;
  }
  if (typeof value !== 'object' || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    throw new TypeError(`${path} must contain JSON-safe values only.`);
  }
  if (seen.has(value)) throw new TypeError(`${path} must not contain circular references.`);
  seen.add(value);
  if (Array.isArray(value)) value.forEach((item, index) => assertJsonSafe(item, `${path}[${index}]`, seen));
  else {
    if (!isPlainObject(value)) throw new TypeError(`${path} must contain plain objects only.`);
    for (const [key, child] of Object.entries(value)) assertJsonSafe(child, `${path}.${key}`, seen);
  }
  seen.delete(value);
  return true;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
