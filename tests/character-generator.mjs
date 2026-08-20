import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CHARACTER_GENERATOR_SESSION_SCHEMA,
  CHARACTER_GENERATOR_STATE_SCHEMA,
  analyzeCharacterImage,
  applyCharacterGeneration,
  loadGeneratedCharacter,
  saveCharacterGeneratorVersion,
} from '../apps/character-generator/index.js';
import { createDefaultState } from '../src/default-state.js';
import { applyModulePatch, createModulePatch, normalizeProjectState } from '../src/state-schema.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedAt = '2026-08-20T08:00:00.000Z';
const savedAt = '2026-08-20T08:01:00.000Z';
const contentHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const observation = createImageObservation();
const initial = createDefaultState();
const initialBefore = structuredClone(initial);
const initialRigRules = structuredClone(initial.character.rigRules);
const initialSkin = structuredClone(initial.character.skin);
const initialAnimation = structuredClone(initial.character.animation);
const initialHierarchy = structuredClone(initial.modules.proportion);

const analysis = analyzeCharacterImage({
  observation,
  source_image: {
    file_name: 'person.png',
    mime_type: 'image/png',
    byte_length: 123456,
    width: 1200,
    height: 1800,
    content_hash: contentHash,
  },
  base_state: initial,
  character_name: 'Image Character',
  at: generatedAt,
});

assert.equal(analysis.schema, 'humanoid_rig/character_image_analysis@1.0');
assert.equal(analysis.character_id, 'character_0123456789ab');
assert.equal(analysis.adapters.proportion.id, 'HRL-M01');
assert.equal(analysis.adapters.proportion.contract, 'normalizeBodyProfile');
assert.equal(analysis.adapters.pose.id, 'HRL-M03');
assert.equal(analysis.adapters.pose.contract, 'retargetPoseObservation');
assert.equal(analysis.outputs.proportion_profile.schema, 'humanoid_rig/proportion_profile@1.0');
assert.equal(analysis.outputs.proportion_profile.source_module, 'HRL-M01');
assert.equal(analysis.outputs.body_shape.body_shape_id, 'body_shape_0123456789ab');
assert.equal(analysis.outputs.face_identity.face_id, 'face_0123456789ab');
assert.equal(analysis.outputs.clothing_profile.clothing_profile_id, 'clothing_0123456789ab');
assert.deepEqual(analysis.outputs.clothing_profile.assets.map((asset) => asset.type), ['top', 'pants', 'shoes']);
assert.equal(analysis.outputs.pose_snapshot.schema, 'humanoid_rig/pose_snapshot@1.0');
assert.equal(analysis.outputs.character_profile, null);
assert.equal(analysis.source_image.binary_storage, 'not-in-project-state');
assert.ok(analysis.confidence.pose >= 0 && analysis.confidence.pose <= 1);

const generated = applyCharacterGeneration(initial, analysis, { at: generatedAt });
const sessionId = analysis.session_id;
const generatedProfile = generated.characterCore.profiles[analysis.character_id];
assert.equal(generated.schemaVersion, 11);
assert.equal(generated.activeVersions.generator, 'character-generator@0.1.0');
assert.equal(generated.characterGenerator.schema, CHARACTER_GENERATOR_STATE_SCHEMA);
assert.equal(generated.characterGenerator.active_session_id, sessionId);
assert.equal(generated.characterGenerator.sessions[sessionId].schema, CHARACTER_GENERATOR_SESSION_SCHEMA);
assert.equal(generated.characterGenerator.sessions[sessionId].version, 1);
assert.equal(generated.characterGenerator.versions[sessionId].length, 1);
assert.equal(generatedProfile.body_shape.profile_id, analysis.outputs.body_shape.body_shape_id);
assert.equal(generatedProfile.face_identity.face_id, analysis.outputs.face_identity.face_id);
assert.deepEqual(generatedProfile.clothing_attachments, analysis.outputs.clothing_profile.assets.map((asset) => ({
  clothing_id: asset.clothing_id,
  revision: asset.revision,
})));
assert.equal(generatedProfile.proportion_revision, generated.moduleRevisions.proportion);
assert.equal(generatedProfile.pose_revision, generated.moduleRevisions.pose);
assert.equal(generated.moduleRevisions.skin, initial.moduleRevisions.skin);
assert.equal(generated.moduleRevisions.animation, initial.moduleRevisions.animation);
assert.equal(generatedProfile.skin_revision, initial.moduleRevisions.skin);
assert.equal(generatedProfile.animation_revision, initial.moduleRevisions.animation);
assert.equal(generated.moduleRevisions.proportion, initial.moduleRevisions.proportion + 1);
assert.equal(generated.moduleRevisions.pose, initial.moduleRevisions.pose + 1);
assert.equal(generated.moduleRevisions.clothing, initial.moduleRevisions.clothing + 1);
assert.equal(generated.moduleRevisions.integration, initial.moduleRevisions.integration + 1);
assert.equal(generated.character.bodyProfile.preset, analysis.outputs.proportion_profile.body_profile.preset);
assert.equal(generated.character.pose.poseSnapshot.id, analysis.outputs.pose_snapshot.id);
assert.equal(generated.bodyShape.active_profile_id, analysis.outputs.body_shape.body_shape_id);
assert.equal(generated.faceSystem.active_face_id, analysis.outputs.face_identity.face_id);
assert.equal(generated.clothingSystem.active_profile_id, analysis.outputs.clothing_profile.clothing_profile_id);
assert.deepEqual(generated.character.rigRules, initialRigRules);
assert.deepEqual(generated.character.skin, initialSkin);
assert.deepEqual(generated.character.animation, initialAnimation);
assert.deepEqual(generated.modules.proportion, initialHierarchy);
assert.deepEqual(initial, initialBefore, 'Character generation mutated the input ProjectState.');

const revisionsBeforeSave = structuredClone(generated.moduleRevisions);
const saved = saveCharacterGeneratorVersion(generated, sessionId, { at: savedAt });
const savedSession = saved.characterGenerator.sessions[sessionId];
assert.deepEqual(saved.moduleRevisions, revisionsBeforeSave, 'Saving a Character version must not invent module revisions.');
assert.equal(savedSession.status, 'saved');
assert.equal(savedSession.version, 2);
assert.equal(savedSession.outputs.character_profile.version, 2);
assert.equal(saved.characterCore.profiles[analysis.character_id].version, 2);
assert.equal(saved.characterGenerator.versions[sessionId].length, 2);
assert.equal(saved.operationEvents.length, 2);

const transactionSaved = structuredClone(saved);
transactionSaved.moduleRevisions.integration += 1;
transactionSaved.moduleUpdatedAt.integration = savedAt;
transactionSaved.revision += 1;
const synchronized = applyModulePatch(generated, createModulePatch(transactionSaved, 'integration'));
assert.equal(synchronized.accepted, true);
assert.equal(synchronized.state.characterGenerator.sessions[sessionId].version, 2);
assert.equal(synchronized.state.characterCore.profiles[analysis.character_id].version, 2);
assert.deepEqual(synchronized.state.character.skin, generated.character.skin);
assert.deepEqual(synchronized.state.character.animation, generated.character.animation);

const historical = loadGeneratedCharacter(saved, sessionId, { version: 1 });
assert.equal(historical.session.version, 1);
assert.equal(historical.character.version, 1);
const serialized = JSON.stringify(saved);
assert.doesNotMatch(serialized, /data:image|base64/i);
const reloaded = normalizeProjectState(JSON.parse(serialized));
const loaded = loadGeneratedCharacter(reloaded, sessionId);
assert.deepEqual(loaded.character, saved.characterCore.profiles[analysis.character_id]);
assert.equal(JSON.stringify(loaded.session), JSON.stringify(savedSession));
assert.equal(loaded.session.source_image.content_hash, contentHash);
assert.deepEqual(loaded.session.outputs.proportion_profile, analysis.outputs.proportion_profile);
assert.deepEqual(loaded.session.outputs.body_shape, analysis.outputs.body_shape);
assert.deepEqual(loaded.session.outputs.face_identity, analysis.outputs.face_identity);
assert.deepEqual(loaded.session.outputs.clothing_profile, analysis.outputs.clothing_profile);
assert.equal(JSON.stringify(loaded.session.outputs.pose_snapshot), JSON.stringify(analysis.outputs.pose_snapshot));

const legacy = structuredClone(initial);
legacy.schemaVersion = 10;
delete legacy.characterGenerator;
delete legacy.activeVersions.generator;
const migrated = normalizeProjectState(legacy);
assert.equal(migrated.schemaVersion, 11);
assert.equal(migrated.characterGenerator.schema, CHARACTER_GENERATOR_STATE_SCHEMA);
assert.equal(migrated.characterGenerator.active_session_id, null);
assert.deepEqual(migrated.characterGenerator.sessions, {});

for (const file of [
  'character.html',
  'apps/character-generator/image-analysis.js',
  'apps/character-generator/character-generator.js',
  'apps/character-generator/index.js',
  'apps/character-generator/page.js',
  'apps/character-generator/character-generator.css',
  'schemas/character-generator-session.schema.json',
]) await access(join(root, file));
const pageHtml = await readFile(join(root, 'character.html'), 'utf8');
const pageSource = await readFile(join(root, 'apps/character-generator/page.js'), 'utf8');
const schema = JSON.parse(await readFile(join(root, 'schemas/character-generator-session.schema.json'), 'utf8'));
assert.match(pageHtml, /id="characterImageInput"/);
assert.match(pageHtml, /id="analyzeCharacterButton"/);
assert.match(pageHtml, /id="generateCharacterButton"/);
assert.match(pageHtml, /id="saveCharacterVersionButton"/);
assert.match(pageSource, /estimatePoseFromImage/);
assert.match(pageSource, /analyzeCharacterImage/);
assert.match(pageSource, /applyCharacterGeneration/);
assert.match(pageSource, /saveCharacterGeneratorVersion/);
assert.match(pageSource, /hub\.replaceState/);
assert.match(pageSource, /hub\.transaction/);
assert.match(pageSource, /changedModules:\s*\['proportion', 'pose', 'clothing', 'integration'\]/);
assert.equal(schema.$id, CHARACTER_GENERATOR_SESSION_SCHEMA);
assert.equal(schema.properties.source_image.properties.binary_storage.const, 'not-in-project-state');

console.log('PASS image observation creates Proportion, BodyShape, Face, Clothing, and Pose data through HRL-M01/HRL-M03 adapters');
console.log('PASS generated Character references existing module versions without mutating Rig, Skin, or Animation data');
console.log('PASS Character Generator save, historical load, serialized reload, and schema v10 to v11 migration');
console.log('PASS character.html upload, analysis, generation, and version-save entry contract');

function createImageObservation() {
  const landmarks = Array.from({ length: 33 }, (_, index) => point(index, 0.5, 0.5));
  const positions = {
    0: [0.5, 0.1], 1: [0.48, 0.095], 2: [0.47, 0.1], 3: [0.46, 0.105],
    4: [0.52, 0.095], 5: [0.53, 0.1], 6: [0.54, 0.105], 7: [0.43, 0.12], 8: [0.57, 0.12],
    9: [0.48, 0.15], 10: [0.52, 0.15], 11: [0.38, 0.25], 12: [0.62, 0.25],
    13: [0.3, 0.42], 14: [0.7, 0.42], 15: [0.25, 0.58], 16: [0.75, 0.58],
    17: [0.24, 0.6], 18: [0.76, 0.6], 19: [0.23, 0.59], 20: [0.77, 0.59],
    21: [0.25, 0.57], 22: [0.75, 0.57], 23: [0.43, 0.52], 24: [0.57, 0.52],
    25: [0.42, 0.72], 26: [0.58, 0.72], 27: [0.42, 0.92], 28: [0.58, 0.92],
    29: [0.41, 0.94], 30: [0.59, 0.94], 31: [0.4, 0.96], 32: [0.6, 0.96],
  };
  for (const [index, [x, y]] of Object.entries(positions)) landmarks[Number(index)] = point(Number(index), x, y);
  return {
    schema: 'humanoid_rig/pose_observation@1.0',
    sourceType: 'synthetic_test_image',
    provider: 'deterministic-test-estimator',
    packageVersion: 'test',
    model: 'test-pose-landmarker',
    delegate: 'CPU',
    image: { width: 1200, height: 1800, aspectRatio: 2 / 3 },
    landmarks,
    worldLandmarks: [],
    confidence: { overall: 0.99, average: 0.99, minimum: 0.99, lowConfidenceIndices: [] },
    inferenceMs: 1,
    createdAt: generatedAt,
  };
}

function point(index, x, y) {
  return { index, name: `landmark_${index}`, x, y, z: 0, visibility: 0.99, presence: 0.99 };
}
