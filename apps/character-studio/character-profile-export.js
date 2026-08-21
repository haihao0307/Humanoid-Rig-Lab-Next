import {
  CHARACTER_PROFILE_SCHEMA,
  assertCharacterProfile,
} from '../../packages/character-core/index.js';
import { assertStructuredDataSafe } from './character-studio-persistence.js';

export const CHARACTER_PROFILE_EXPORT_SCHEMA = 'humanoid_rig/character_profile_export@1.0';

export function createCharacterProfileExport({
  projectState,
  characterProfile,
  persistedResources = [],
  exportedAt = new Date().toISOString(),
} = {}) {
  if (!projectState || typeof projectState !== 'object') throw new TypeError('projectState is required.');
  assertCharacterProfile(characterProfile);
  const profile = structuredClone(characterProfile);
  const resources = collectCharacterResourceReferences(projectState, profile, persistedResources);
  const document = {
    schema: CHARACTER_PROFILE_EXPORT_SCHEMA,
    schema_version: 1,
    exported_at: validIso(exportedAt) ? exportedAt : new Date().toISOString(),
    project: {
      project_id: String(projectState.projectId || ''),
      project_revision: nonNegativeInteger(projectState.revision),
      project_schema_version: nonNegativeInteger(projectState.schemaVersion),
      build_id: String(projectState.build?.id || ''),
      build_version: String(projectState.build?.version || ''),
    },
    schemas: {
      export: CHARACTER_PROFILE_EXPORT_SCHEMA,
      character_profile: CHARACTER_PROFILE_SCHEMA,
      project_state: `humanoid_rig/project_state@${nonNegativeInteger(projectState.schemaVersion)}`,
    },
    version: {
      character_profile: profile.version,
      character_state_revision: nonNegativeInteger(projectState.characterCore?.revision),
      project_revision: nonNegativeInteger(projectState.revision),
    },
    character_profile: profile,
    module_references: createModuleReferences(projectState, profile),
    resource_references: {
      count: resources.length,
      binary_payloads_included: false,
      items: resources,
    },
  };
  assertStructuredDataSafe(document, 'CharacterProfileExport');
  return document;
}

export function serializeCharacterProfileExport(document, { space = 2 } = {}) {
  if (document?.schema !== CHARACTER_PROFILE_EXPORT_SCHEMA) {
    throw new TypeError(`Expected ${CHARACTER_PROFILE_EXPORT_SCHEMA}.`);
  }
  assertStructuredDataSafe(document, 'CharacterProfileExport');
  return `${JSON.stringify(document, null, space)}\n`;
}

export function collectCharacterResourceReferences(projectState, profile, persistedResources = []) {
  const byId = new Map();
  const add = (input) => {
    if (!input?.asset_id) return;
    const normalized = normalizeResourceReference(input);
    const key = `${normalized.kind}:${normalized.asset_id}`;
    byId.set(key, { ...(byId.get(key) || {}), ...normalized });
  };

  const skin = projectState.character?.skin || {};
  if (skin.detailAsset) add({
    asset_id: String(skin.detailAsset),
    kind: 'skin-mesh',
    uri: String(skin.detailAsset),
    revision: profile.skin_revision,
  });
  if (skin.bindingMetadata) add({
    asset_id: String(skin.bindingMetadata),
    kind: 'skin-binding-metadata',
    uri: String(skin.bindingMetadata),
    revision: profile.skin_revision,
  });
  if (projectState.character?.pose?.imagePoseAssetId) add({
    asset_id: String(projectState.character.pose.imagePoseAssetId),
    kind: 'pose-source-image',
    revision: profile.pose_revision,
  });

  for (const attachment of profile.clothing_attachments) add({
    asset_id: attachment.clothing_id,
    kind: 'clothing-attachment',
    revision: attachment.revision,
  });
  if (profile.hair.hair_id) add({
    asset_id: profile.hair.hair_id,
    kind: 'hair-attachment',
    revision: profile.hair.revision,
  });
  for (const attachment of profile.accessory_attachments) add({
    asset_id: attachment.accessory_id,
    kind: 'accessory-attachment',
    revision: attachment.revision,
  });

  for (const session of Object.values(projectState.characterGenerator?.sessions || {})) {
    if (session?.outputs?.character_profile?.character_id !== profile.character_id) continue;
    const source = session.source_image || {};
    if (!source.content_hash) continue;
    add({
      asset_id: `source-image:${source.content_hash}`,
      kind: 'character-source-image',
      storage: source.binary_storage || 'external-reference',
      content_hash: source.content_hash,
      byte_length: source.byte_length,
      mime_type: source.mime_type,
      file_name: source.file_name,
    });
  }

  for (const resource of persistedResources) add(resource);
  return [...byId.values()].sort((left, right) => {
    const kindOrder = left.kind.localeCompare(right.kind);
    return kindOrder || left.asset_id.localeCompare(right.asset_id);
  });
}

function createModuleReferences(projectState, profile) {
  const active = projectState.activeVersions || {};
  return {
    proportion: { revision: profile.proportion_revision, version: String(active.rig || '') },
    body_shape: {
      revision: profile.body_shape_revision,
      profile_id: profile.body_shape.profile_id,
      state_revision: nonNegativeInteger(projectState.bodyShape?.revision),
    },
    skin: { revision: profile.skin_revision, version: String(active.skin || '') },
    face: {
      revision: profile.face_revision,
      face_id: profile.face_identity.face_id,
      state_revision: nonNegativeInteger(projectState.faceSystem?.revision),
    },
    clothing: {
      revision: profile.clothing_revision,
      version: String(active.clothing || ''),
      state_revision: nonNegativeInteger(projectState.clothingSystem?.revision),
    },
    appearance: {
      revision: nonNegativeInteger(projectState.appearanceSystem?.revision),
      version: String(active.appearance || ''),
      hair_revision: profile.hair_revision,
      accessory_revision: profile.accessory_revision,
    },
    pose: { revision: profile.pose_revision, version: String(active.pose || '') },
    animation: { revision: profile.animation_revision, version: String(active.animation || '') },
  };
}

function normalizeResourceReference(input) {
  const reference = {
    asset_id: String(input.asset_id),
    kind: String(input.kind || 'character-resource'),
    revision: input.revision == null ? null : nonNegativeInteger(input.revision),
    storage: input.storage == null ? null : String(input.storage),
    uri: input.uri == null ? null : String(input.uri),
    opfs_path: input.opfs_path == null ? null : String(input.opfs_path),
    content_hash: input.content_hash == null ? null : String(input.content_hash),
    byte_length: input.byte_length == null ? null : nonNegativeInteger(input.byte_length),
    mime_type: input.mime_type == null ? null : String(input.mime_type),
    file_name: input.file_name == null ? null : String(input.file_name),
  };
  assertStructuredDataSafe(reference, `ResourceReference(${reference.asset_id})`);
  return reference;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function validIso(value) {
  return Number.isFinite(Date.parse(value || ''));
}
