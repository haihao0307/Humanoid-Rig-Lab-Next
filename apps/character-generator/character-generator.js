import { createSkinShapeResponse, createBodyShapeState } from '../../packages/body-shape/index.js';
import {
  CharacterManager,
  appendOperationEvent,
  createCharacterProfile,
} from '../../packages/character-core/index.js';
import {
  clothingAttachmentReferences,
  createClothingRuntimeDescriptor,
  createClothingState,
} from '../../packages/clothing-system/index.js';
import { createFaceRuntimeDescriptor, createFaceState } from '../../packages/face-system/index.js';
import { normalizeImagePoseLibrary } from '../../src/modules/pose/image-pose-retarget.js';
import { CHARACTER_IMAGE_ANALYSIS_SCHEMA } from './image-analysis.js';

export const CHARACTER_GENERATOR_STATE_SCHEMA = 'humanoid_rig/character_generator_state@1.0';
export const CHARACTER_GENERATOR_SESSION_SCHEMA = 'humanoid_rig/character_generator_session@1.0';
export const CHARACTER_GENERATOR_VERSION = 'character-generator@0.1.0';

const characterManager = new CharacterManager();

export function createCharacterGeneratorState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const sessions = {};
  for (const [id, value] of Object.entries(isPlainObject(source.sessions) ? source.sessions : {})) {
    try {
      const session = normalizeGeneratorSession({ ...value, session_id: value?.session_id || id });
      sessions[session.session_id] = session;
    } catch (_) {}
  }
  const requested = String(source.active_session_id || '');
  const activeId = sessions[requested] ? requested : Object.keys(sessions)[0] || null;
  const versions = {};
  const incomingVersions = isPlainObject(source.versions) ? source.versions : {};
  for (const session of Object.values(sessions)) {
    const items = Array.isArray(incomingVersions[session.session_id])
      ? incomingVersions[session.session_id].map((item) => {
          try { return normalizeGeneratorSession({ ...item, session_id: session.session_id }); }
          catch (_) { return null; }
        }).filter(Boolean)
      : [];
    versions[session.session_id] = dedupeVersions(items.length ? items : [session]);
  }
  return {
    schema: CHARACTER_GENERATOR_STATE_SCHEMA,
    revision: nonNegativeInteger(source.revision, 1),
    updated_at: validIso(source.updated_at) ? source.updated_at : new Date().toISOString(),
    active_session_id: activeId,
    sessions,
    versions,
  };
}

export function normalizeCharacterGeneratorState(input) {
  return createCharacterGeneratorState(input);
}

export function applyCharacterGeneration(projectStateInput, analysisInput, { at = null } = {}) {
  const project = structuredClone(projectStateInput);
  assertProjectState(project);
  const analysis = normalizeAnalysis(analysisInput);
  const timestamp = validIso(at) ? at : analysis.created_at;
  const targetModuleRevisions = nextGenerationModuleRevisions(project.moduleRevisions);
  const outputs = structuredClone(analysis.outputs);
  const bodyShape = outputs.body_shape;
  const faceIdentity = outputs.face_identity;
  const clothingProfile = outputs.clothing_profile;
  const characterProfile = createCharacterProfile({
    character_id: analysis.character_id,
    name: analysis.character_name,
    version: 1,
    identity: {
      identity_id: `image_identity_${analysis.source_image.content_hash.slice(0, 12)}`,
      revision: 1,
      tags: ['image-generated', 'phase-1'],
    },
    body_shape: { profile_id: bodyShape.body_shape_id, revision: bodyShape.version },
    face_identity: { face_id: faceIdentity.face_id, revision: faceIdentity.version },
    clothing_attachments: clothingAttachmentReferences(clothingProfile),
    hair: { hair_id: null, revision: 0 },
    accessory_attachments: [],
    proportion_revision: targetModuleRevisions.proportion,
    body_shape_revision: bodyShape.version,
    skin_revision: targetModuleRevisions.skin,
    face_revision: faceIdentity.version,
    clothing_revision: clothingProfile.version,
    hair_revision: 0,
    accessory_revision: 0,
    pose_revision: targetModuleRevisions.pose,
    animation_revision: targetModuleRevisions.animation,
  });

  project.moduleRevisions = targetModuleRevisions;
  for (const id of Object.keys(targetModuleRevisions)) project.moduleUpdatedAt[id] = timestamp;
  project.character.bodyProfile = structuredClone(outputs.proportion_profile.body_profile);
  project.character.pose = {
    ...project.character.pose,
    name: outputs.pose_snapshot.name || `${analysis.character_name} Image Pose`,
    poseSnapshot: structuredClone(outputs.pose_snapshot),
    v8Payload: structuredClone(outputs.legacy_world_pose),
    imagePoseAssetId: outputs.image_pose_asset.id,
  };
  const library = normalizeImagePoseLibrary(project.modules?.pose?.imagePose);
  project.modules.pose.imagePose = {
    ...library,
    activeAssetId: outputs.image_pose_asset.id,
    assets: [
      structuredClone(outputs.image_pose_asset),
      ...library.assets.filter((item) => item.id !== outputs.image_pose_asset.id),
    ].slice(0, 24),
  };
  project.bodyShape = mergeBodyShapeState(project.bodyShape, bodyShape, timestamp);
  project.faceSystem = mergeFaceState(project.faceSystem, faceIdentity, timestamp);
  project.clothingSystem = mergeClothingState(project.clothingSystem, clothingProfile, timestamp);

  const existing = project.characterCore.profiles[characterProfile.character_id];
  const characterResult = existing
    ? characterManager.save(project.characterCore, characterProfile, {
        expected_revision: project.characterCore.revision,
        actor: 'character-generator',
        event_id: `operation-${analysis.session_id}-regenerate`,
        at: timestamp,
      })
    : characterManager.create(project.characterCore, characterProfile, {
        expected_revision: project.characterCore.revision,
        actor: 'character-generator',
        event_id: `operation-${analysis.session_id}-create`,
        module_revisions: targetModuleRevisions,
        at: timestamp,
      });
  project.characterCore = characterResult.state;
  project.operationEvents = appendOperationEvent(project.operationEvents, characterResult.event);
  outputs.character_profile = structuredClone(characterResult.profile);

  const generator = normalizeCharacterGeneratorState(project.characterGenerator);
  const session = normalizeGeneratorSession({
    schema: CHARACTER_GENERATOR_SESSION_SCHEMA,
    session_id: analysis.session_id,
    version: existing ? Number(generator.sessions[analysis.session_id]?.version || 0) + 1 : 1,
    status: 'generated',
    character_id: characterResult.profile.character_id,
    source_image: analysis.source_image,
    analysis: {
      schema: analysis.schema,
      analysis_id: analysis.analysis_id,
      adapters: analysis.adapters,
      confidence: analysis.confidence,
      warnings: analysis.warnings,
      created_at: analysis.created_at,
    },
    outputs,
    created_at: generator.sessions[analysis.session_id]?.created_at || timestamp,
    updated_at: timestamp,
  });
  generator.revision += 1;
  generator.updated_at = timestamp;
  generator.active_session_id = session.session_id;
  generator.sessions[session.session_id] = session;
  generator.versions[session.session_id] = appendVersion(
    generator.versions[session.session_id],
    session,
  );
  project.characterGenerator = generator;
  project.activeVersions.generator = CHARACTER_GENERATOR_VERSION;
  project.updatedAt = timestamp;
  return project;
}

export function saveCharacterGeneratorVersion(projectStateInput, sessionId = null, { at = null } = {}) {
  const project = structuredClone(projectStateInput);
  assertProjectState(project);
  const generator = normalizeCharacterGeneratorState(project.characterGenerator);
  const id = String(sessionId || generator.active_session_id || '');
  const current = generator.sessions[id];
  if (!current) throw new Error(`Character Generator session ${id || '(missing id)'} does not exist.`);
  const timestamp = validIso(at) ? at : new Date().toISOString();
  const currentModuleRevisions = structuredClone(project.moduleRevisions);
  const profile = current.outputs.character_profile;
  const characterResult = characterManager.save(project.characterCore, {
    ...profile,
    character_id: current.character_id,
    proportion_revision: currentModuleRevisions.proportion,
    skin_revision: currentModuleRevisions.skin,
    pose_revision: currentModuleRevisions.pose,
    animation_revision: currentModuleRevisions.animation,
  }, {
    expected_revision: project.characterCore.revision,
    actor: 'character-generator',
    event_id: `operation-${id}-save-${current.version + 1}`,
    at: timestamp,
  });
  const nextSession = normalizeGeneratorSession({
    ...current,
    version: current.version + 1,
    status: 'saved',
    outputs: { ...current.outputs, character_profile: characterResult.profile },
    updated_at: timestamp,
  });
  project.characterCore = characterResult.state;
  project.operationEvents = appendOperationEvent(project.operationEvents, characterResult.event);
  generator.revision += 1;
  generator.updated_at = timestamp;
  generator.active_session_id = id;
  generator.sessions[id] = nextSession;
  generator.versions[id] = appendVersion(generator.versions[id], nextSession);
  project.characterGenerator = generator;
  project.activeVersions.generator = CHARACTER_GENERATOR_VERSION;
  project.updatedAt = timestamp;
  return project;
}

export function loadGeneratedCharacter(projectStateInput, sessionId = null, { version = null } = {}) {
  const project = projectStateInput && typeof projectStateInput === 'object' ? projectStateInput : {};
  const generator = normalizeCharacterGeneratorState(project.characterGenerator);
  const id = String(sessionId || generator.active_session_id || '');
  const current = version == null
    ? generator.sessions[id]
    : (generator.versions[id] || []).find((item) => item.version === Number(version));
  if (!current) throw new Error(`Character Generator session ${id || '(missing id)'} version ${version ?? 'current'} does not exist.`);
  const character = version == null
    ? (project.characterCore?.profiles?.[current.character_id] || current.outputs.character_profile)
    : current.outputs.character_profile;
  return {
    session: structuredClone(current),
    character: structuredClone(character),
  };
}

function mergeBodyShapeState(existingInput, profile, timestamp) {
  const generated = createBodyShapeState(profile);
  const existing = existingInput && typeof existingInput === 'object' ? structuredClone(existingInput) : generated;
  return {
    ...existing,
    revision: Number(existing.revision || 0) + 1,
    updated_at: timestamp,
    active_profile_id: profile.body_shape_id,
    dirty: false,
    profiles: { ...(existing.profiles || {}), [profile.body_shape_id]: structuredClone(profile) },
    versions: { ...(existing.versions || {}), [profile.body_shape_id]: [structuredClone(profile)] },
    skin_response: createSkinShapeResponse(profile),
  };
}
function mergeFaceState(existingInput, profile, timestamp) {
  const generated = createFaceState(profile);
  const existing = existingInput && typeof existingInput === 'object' ? structuredClone(existingInput) : generated;
  return {
    ...existing,
    revision: Number(existing.revision || 0) + 1,
    updated_at: timestamp,
    active_face_id: profile.face_id,
    dirty: false,
    profiles: { ...(existing.profiles || {}), [profile.face_id]: structuredClone(profile) },
    versions: { ...(existing.versions || {}), [profile.face_id]: [structuredClone(profile)] },
    runtime_descriptor: createFaceRuntimeDescriptor(profile),
  };
}
function mergeClothingState(existingInput, profile, timestamp) {
  const generated = createClothingState(profile);
  const existing = existingInput && typeof existingInput === 'object' ? structuredClone(existingInput) : generated;
  return {
    ...existing,
    revision: Number(existing.revision || 0) + 1,
    updated_at: timestamp,
    active_profile_id: profile.clothing_profile_id,
    dirty: false,
    profiles: { ...(existing.profiles || {}), [profile.clothing_profile_id]: structuredClone(profile) },
    versions: { ...(existing.versions || {}), [profile.clothing_profile_id]: [structuredClone(profile)] },
    runtime_descriptor: createClothingRuntimeDescriptor(profile),
  };
}
function normalizeAnalysis(value) {
  if (!value || value.schema !== CHARACTER_IMAGE_ANALYSIS_SCHEMA || !value.session_id || !value.character_id) {
    throw new TypeError(`Expected ${CHARACTER_IMAGE_ANALYSIS_SCHEMA}.`);
  }
  for (const key of ['proportion_profile', 'body_shape', 'face_identity', 'clothing_profile', 'pose_snapshot', 'image_pose_asset', 'legacy_world_pose']) {
    if (!value.outputs?.[key]) throw new TypeError(`Character image analysis is missing outputs.${key}.`);
  }
  return structuredClone(value);
}
function normalizeGeneratorSession(value) {
  if (!isPlainObject(value)) throw new TypeError('Character Generator session must be an object.');
  const id = identifier(value.session_id, 'session_id');
  const status = ['generated', 'saved'].includes(String(value.status)) ? String(value.status) : 'generated';
  if (!value.outputs?.character_profile?.character_id) throw new TypeError('Generator session requires outputs.character_profile.');
  return {
    schema: CHARACTER_GENERATOR_SESSION_SCHEMA,
    session_id: id,
    version: positiveInteger(value.version, 1),
    status,
    character_id: identifier(value.character_id, 'character_id'),
    source_image: structuredClone(value.source_image || {}),
    analysis: structuredClone(value.analysis || {}),
    outputs: structuredClone(value.outputs),
    created_at: validIso(value.created_at) ? value.created_at : new Date().toISOString(),
    updated_at: validIso(value.updated_at) ? value.updated_at : new Date().toISOString(),
  };
}
function nextGenerationModuleRevisions(input) {
  const revisions = Object.fromEntries(
    Object.entries(input || {}).map(([id, value]) => [id, Number(value || 0)]),
  );
  for (const id of ['proportion', 'pose', 'clothing', 'integration']) {
    revisions[id] = Number(revisions[id] || 0) + 1;
  }
  return revisions;
}
function appendVersion(items, session) {
  return dedupeVersions([...(Array.isArray(items) ? items : []), structuredClone(session)]);
}
function dedupeVersions(items) {
  const byVersion = new Map();
  for (const item of items) byVersion.set(Number(item.version), structuredClone(item));
  return [...byVersion.values()].sort((left, right) => left.version - right.version).slice(-50);
}
function assertProjectState(value) {
  if (!value || typeof value !== 'object' || !value.characterCore || !value.moduleRevisions) {
    throw new TypeError('Character Generator requires a complete ProjectState.');
  }
}
function identifier(value, label) {
  const result = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(result)) throw new TypeError(`${label} must be a valid identifier.`);
  return result;
}
function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : fallback;
}
function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}
function validIso(value) { return Number.isFinite(Date.parse(value || '')); }
function isPlainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
