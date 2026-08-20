export const CHARACTER_PROFILE_SCHEMA = 'humanoid_rig/character_profile@1.4';

export const CHARACTER_REVISION_FIELDS = Object.freeze([
  'proportion_revision',
  'body_shape_revision',
  'skin_revision',
  'face_revision',
  'clothing_revision',
  'hair_revision',
  'accessory_revision',
  'pose_revision',
  'animation_revision',
]);

const PROFILE_FIELDS = new Set([
  'character_id',
  'name',
  'version',
  'identity',
  'body_shape',
  'face_identity',
  'clothing_attachments',
  'hair',
  'accessory_attachments',
  ...CHARACTER_REVISION_FIELDS,
]);
const IDENTITY_FIELDS = new Set(['identity_id', 'revision', 'tags']);
const BODY_SHAPE_FIELDS = new Set(['profile_id', 'revision']);
const FACE_IDENTITY_FIELDS = new Set(['face_id', 'revision']);
const CLOTHING_ATTACHMENT_FIELDS = new Set(['clothing_id', 'revision']);
const HAIR_REFERENCE_FIELDS = new Set(['hair_id', 'revision']);
const ACCESSORY_ATTACHMENT_FIELDS = new Set(['accessory_id', 'revision']);
const FORBIDDEN_KEYS = new Set([
  'skeleton', 'rig_definition', 'rigDefinition', 'joints', 'bones',
  'bone_length', 'boneLength', 'bone_lengths', 'boneLengths',
  'parent', 'parent_id', 'parentId', 'children', 'hierarchy',
  'tracks', 'animation_tracks', 'animationTracks', 'keyframes',
  'bind_pose', 'bindPose', 'local_position', 'localPosition',
]);

export function createCharacterProfile(input = {}, moduleRevisions = {}) {
  assertCharacterProfileInput(input, { partial: true });
  const characterId = stringOr(input.character_id, 'character_001');
  const bodyShape = normalizeBodyShape(input.body_shape);
  const bodyShapeRevision = revision(
    input.body_shape_revision,
    input.body_shape?.revision ?? moduleRevisions.bodyShape,
  );
  bodyShape.revision = bodyShapeRevision;
  const faceIdentity = normalizeFaceIdentityReference(input.face_identity);
  const faceRevision = revision(
    input.face_revision,
    input.face_identity?.revision ?? moduleRevisions.face,
  );
  faceIdentity.revision = faceRevision;
  const clothingAttachments = normalizeClothingAttachments(input.clothing_attachments);
  const hair = normalizeHairReference(input.hair);
  const hairRevision = revision(input.hair_revision, input.hair?.revision ?? moduleRevisions.hair);
  hair.revision = hair.hair_id ? Math.max(1, hairRevision) : 0;
  const accessoryAttachments = normalizeAccessoryAttachments(input.accessory_attachments);
  const profile = {
    character_id: characterId,
    name: stringOr(input.name, characterId),
    version: positiveInteger(input.version, 1),
    identity: normalizeIdentity(input.identity),
    body_shape: bodyShape,
    face_identity: faceIdentity,
    clothing_attachments: clothingAttachments,
    hair,
    accessory_attachments: accessoryAttachments,
    proportion_revision: revision(input.proportion_revision, moduleRevisions.proportion),
    body_shape_revision: bodyShapeRevision,
    skin_revision: revision(input.skin_revision, moduleRevisions.skin),
    face_revision: faceRevision,
    clothing_revision: revision(input.clothing_revision, moduleRevisions.clothing),
    hair_revision: hair.revision,
    accessory_revision: revision(input.accessory_revision, moduleRevisions.accessory),
    pose_revision: revision(input.pose_revision, moduleRevisions.pose),
    animation_revision: revision(input.animation_revision, moduleRevisions.animation),
  };
  assertCharacterProfile(profile);
  return structuredClone(profile);
}

export function normalizeCharacterProfile(input, moduleRevisions = {}) {
  return createCharacterProfile(input, moduleRevisions);
}

export function assertCharacterProfile(profile) {
  assertCharacterProfileInput(profile, { partial: false });
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(profile.character_id)) {
    throw new TypeError('character_id must use letters, numbers, dot, underscore, or hyphen.');
  }
  if (!String(profile.name || '').trim()) throw new TypeError('Character name is required.');
  if (!Number.isInteger(profile.version) || profile.version < 1) {
    throw new TypeError('Character version must be a positive integer.');
  }
  for (const key of CHARACTER_REVISION_FIELDS) {
    if (!Number.isInteger(profile[key]) || profile[key] < 0) {
      throw new TypeError(`${key} must be a non-negative integer reference.`);
    }
  }
  if (profile.body_shape.revision !== profile.body_shape_revision) {
    throw new TypeError('body_shape.revision must match body_shape_revision.');
  }
  if (profile.face_identity.revision !== profile.face_revision) {
    throw new TypeError('face_identity.revision must match face_revision.');
  }
  if (new Set(profile.clothing_attachments.map((item) => item.clothing_id)).size !== profile.clothing_attachments.length) {
    throw new TypeError('clothing_attachments must not contain duplicate clothing_id values.');
  }
  if (profile.hair.revision !== profile.hair_revision) {
    throw new TypeError('hair.revision must match hair_revision.');
  }
  if (new Set(profile.accessory_attachments.map((item) => item.accessory_id)).size !== profile.accessory_attachments.length) {
    throw new TypeError('accessory_attachments must not contain duplicate accessory_id values.');
  }
  return true;
}

export function assertCharacterProfileInput(input, { partial = true } = {}) {
  if (!isPlainObject(input)) throw new TypeError('CharacterProfile must be an object.');
  assertNoForbiddenCharacterData(input);
  assertAllowedKeys(input, PROFILE_FIELDS, 'CharacterProfile');
  if (!partial) {
    for (const key of PROFILE_FIELDS) {
      if (!(key in input)) throw new TypeError(`CharacterProfile is missing ${key}.`);
    }
  }
  if ('identity' in input) {
    if (!isPlainObject(input.identity)) throw new TypeError('identity must be a reference object.');
    assertAllowedKeys(input.identity, IDENTITY_FIELDS, 'identity');
  }
  if ('body_shape' in input) {
    if (!isPlainObject(input.body_shape)) throw new TypeError('body_shape must be a reference object.');
    assertAllowedKeys(input.body_shape, BODY_SHAPE_FIELDS, 'body_shape');
  }
  if ('face_identity' in input) {
    if (!isPlainObject(input.face_identity)) throw new TypeError('face_identity must be a reference object.');
    assertAllowedKeys(input.face_identity, FACE_IDENTITY_FIELDS, 'face_identity');
  }
  if ('clothing_attachments' in input) {
    if (!Array.isArray(input.clothing_attachments)) throw new TypeError('clothing_attachments must be an array of references.');
    for (const [index, attachment] of input.clothing_attachments.entries()) {
      if (!isPlainObject(attachment)) throw new TypeError(`clothing_attachments[${index}] must be a reference object.`);
      assertAllowedKeys(attachment, CLOTHING_ATTACHMENT_FIELDS, `clothing_attachments[${index}]`);
      if (!String(attachment.clothing_id || '').trim()) throw new TypeError(`clothing_attachments[${index}].clothing_id is required.`);
      if (!Number.isInteger(Number(attachment.revision)) || Number(attachment.revision) < 1) {
        throw new TypeError(`clothing_attachments[${index}].revision must be a positive integer reference.`);
      }
    }
  }
  if ('hair' in input) {
    if (!isPlainObject(input.hair)) throw new TypeError('hair must be a reference object.');
    assertAllowedKeys(input.hair, HAIR_REFERENCE_FIELDS, 'hair');
    if (input.hair.hair_id != null && !String(input.hair.hair_id).trim()) throw new TypeError('hair.hair_id must be null or a valid id.');
    const minimum = input.hair.hair_id == null ? 0 : 1;
    if (!Number.isInteger(Number(input.hair.revision)) || Number(input.hair.revision) < minimum) {
      throw new TypeError(`hair.revision must be an integer greater than or equal to ${minimum}.`);
    }
  }
  if ('accessory_attachments' in input) {
    if (!Array.isArray(input.accessory_attachments)) throw new TypeError('accessory_attachments must be an array of references.');
    for (const [index, attachment] of input.accessory_attachments.entries()) {
      if (!isPlainObject(attachment)) throw new TypeError(`accessory_attachments[${index}] must be a reference object.`);
      assertAllowedKeys(attachment, ACCESSORY_ATTACHMENT_FIELDS, `accessory_attachments[${index}]`);
      if (!String(attachment.accessory_id || '').trim()) throw new TypeError(`accessory_attachments[${index}].accessory_id is required.`);
      if (!Number.isInteger(Number(attachment.revision)) || Number(attachment.revision) < 1) {
        throw new TypeError(`accessory_attachments[${index}].revision must be a positive integer reference.`);
      }
    }
  }
  return true;
}

export function assertNoForbiddenCharacterData(value, path = 'CharacterProfile') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenCharacterData(item, `${path}[${index}]`));
    return true;
  }
  if (!isPlainObject(value)) return true;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new TypeError(`${path}.${key} is module-owned data and cannot be stored in CharacterProfile.`);
    }
    assertNoForbiddenCharacterData(child, `${path}.${key}`);
  }
  return true;
}

function normalizeIdentity(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    identity_id: nullableString(source.identity_id),
    revision: revision(source.revision, 0),
    tags: [...new Set((Array.isArray(source.tags) ? source.tags : []).map((tag) => String(tag).trim()).filter(Boolean))],
  };
}

function normalizeBodyShape(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    profile_id: nullableString(source.profile_id),
    revision: revision(source.revision, 0),
  };
}

function normalizeFaceIdentityReference(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    face_id: nullableString(source.face_id),
    revision: revision(source.revision, 0),
  };
}

function normalizeClothingAttachments(value) {
  const items = Array.isArray(value) ? value : [];
  return items.map((item) => ({
    clothing_id: String(item.clothing_id).trim(),
    revision: Math.max(1, Number(item.revision) || 1),
  }));
}

function normalizeHairReference(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    hair_id: nullableString(source.hair_id),
    revision: revision(source.revision, 0),
  };
}

function normalizeAccessoryAttachments(value) {
  const items = Array.isArray(value) ? value : [];
  return items.map((item) => ({
    accessory_id: String(item.accessory_id).trim(),
    revision: Math.max(1, Number(item.revision) || 1),
  }));
}

function assertAllowedKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${label}.${key} is not part of the Character Core contract.`);
  }
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : fallback;
}

function revision(value, fallback = 0) {
  const number = Number(value ?? fallback ?? 0);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function nullableString(value) {
  if (value == null || String(value).trim() === '') return null;
  return String(value).trim();
}

function stringOr(value, fallback) {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
