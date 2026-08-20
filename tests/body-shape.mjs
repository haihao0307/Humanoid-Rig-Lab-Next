import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BodyShapeEditor,
  BodyShapeRevisionConflictError,
  createBodyShapeProfile,
  createBodyShapeState,
  createSkinShapeResponse,
  deformSkinPositions,
} from '../packages/body-shape/index.js';
import { CharacterManager, appendOperationEvent } from '../packages/character-core/index.js';
import { createDefaultState } from '../src/default-state.js';
import { applyModulePatch, createModulePatch, normalizeProjectState } from '../src/state-schema.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const editor = new BodyShapeEditor();
const characterManager = new CharacterManager();
const initialProfile = createBodyShapeProfile({ body_shape_id: 'shape_test', name: 'Shape Test' });
const initialState = createBodyShapeState(initialProfile);

const edited = editor.update(initialState, {
  muscle: 0.6,
  fat: 0.3,
  shoulder_volume: 0.7,
  chest_volume: 0.65,
  waist_volume: 0.4,
  hip_volume: 0.62,
  arm_volume: 0.58,
  leg_volume: 0.56,
}, {
  expected_revision: 1,
  at: '2026-08-20T02:00:00.000Z',
});
assert.equal(edited.revision, 2);
assert.equal(edited.dirty, true);
assert.equal(edited.profiles.shape_test.version, 1);
assert.equal(edited.profiles.shape_test.muscle, 0.6);
assert.equal(initialState.profiles.shape_test.muscle, 0.5);

const saved = editor.saveVersion(edited, {
  expected_revision: 2,
  at: '2026-08-20T02:01:00.000Z',
});
assert.equal(saved.revision, 3);
assert.equal(saved.dirty, false);
assert.equal(saved.profiles.shape_test.version, 2);
assert.equal(saved.versions.shape_test.length, 2);
assert.equal(editor.loadVersion(saved, 2).waist_volume, 0.4);

const restored = editor.restoreVersion(saved, 1, {
  expected_revision: 3,
  at: '2026-08-20T02:02:00.000Z',
});
assert.equal(restored.revision, 4);
assert.equal(restored.profiles.shape_test.version, 3);
assert.equal(restored.profiles.shape_test.muscle, 0.5);
assert.equal(restored.profiles.shape_test.waist_volume, 0.5);
assert.equal(restored.versions.shape_test.length, 3);
assert.throws(
  () => editor.update(restored, { fat: 0.7 }, { expected_revision: 3 }),
  BodyShapeRevisionConflictError,
);
assert.throws(() => editor.update(restored, { height: 1.9 }), /not a BodyShape parameter/);
assert.throws(() => editor.update(restored, { waist_volume: 1.2 }), /between 0 and 1/);

const restPositions = new Float32Array([
  -0.3, 0.0, -0.15,
   0.3, 0.0,  0.15,
  -0.4, 0.9, -0.2,
   0.4, 0.9,  0.2,
  -0.25, 1.2, -0.18,
   0.25, 1.2, 0.18,
  -0.5, 1.5, -0.12,
   0.5, 1.5, 0.12,
]);
const sourceCopy = new Float32Array(restPositions);
const neutral = deformSkinPositions(restPositions, initialProfile);
assert.deepEqual(neutral, restPositions);
const shapedProfile = createBodyShapeProfile({
  body_shape_id: 'shape_runtime',
  muscle: 0.8,
  fat: 0.7,
  shoulder_volume: 0.9,
  chest_volume: 0.85,
  waist_volume: 0.75,
  hip_volume: 0.8,
  arm_volume: 0.85,
  leg_volume: 0.8,
});
const response = createSkinShapeResponse(shapedProfile);
const shaped = deformSkinPositions(restPositions, shapedProfile);
assert.equal(response.target, 'skin.vertex_positions');
assert.deepEqual(response.writes, ['skin.vertex_positions', 'skin.vertex_normals', 'skin.bounds']);
assert.ok(response.preserves.includes('rig'));
assert.ok(response.preserves.includes('pose'));
assert.ok(response.preserves.includes('animation_tracks'));
assert.notDeepEqual(shaped, restPositions);
assert.deepEqual(restPositions, sourceCopy);
for (let index = 1; index < shaped.length; index += 3) assert.equal(shaped[index], restPositions[index]);

const project = createDefaultState();
const activeCharacter = project.characterCore.profiles.character_001;
assert.equal(project.schemaVersion, 11);
assert.equal(project.bodyShape.schema, 'humanoid_rig/body_shape_state@1.0');
assert.equal(activeCharacter.body_shape_revision, project.bodyShape.profiles.body_shape_001.version);
assert.equal(activeCharacter.body_shape.revision, activeCharacter.body_shape_revision);

const legacy = structuredClone(project);
legacy.schemaVersion = 7;
delete legacy.bodyShape;
for (const profile of Object.values(legacy.characterCore.profiles)) delete profile.body_shape_revision;
for (const versions of Object.values(legacy.characterCore.versions)) {
  for (const version of versions) delete version.profile.body_shape_revision;
}
const migrated = normalizeProjectState(legacy);
assert.equal(migrated.schemaVersion, 11);
assert.equal(migrated.bodyShape.profiles.body_shape_001.muscle, 0.5);
assert.equal(migrated.characterCore.profiles.character_001.body_shape_revision, 1);

const editedProjectShape = editor.update(project.bodyShape, { waist_volume: 0.72 }, {
  expected_revision: project.bodyShape.revision,
  at: '2026-08-20T02:03:00.000Z',
});
const savedProjectShape = editor.saveVersion(editedProjectShape, {
  expected_revision: editedProjectShape.revision,
  at: '2026-08-20T02:04:00.000Z',
});
const savedProjectProfile = savedProjectShape.profiles[savedProjectShape.active_profile_id];
const characterSave = characterManager.save(project.characterCore, {
  character_id: 'character_001',
  body_shape: { profile_id: savedProjectProfile.body_shape_id, revision: savedProjectProfile.version },
  body_shape_revision: savedProjectProfile.version,
}, {
  expected_revision: project.characterCore.revision,
  event_id: 'operation-body-shape-save',
  at: '2026-08-20T02:04:00.000Z',
});
const nextProject = structuredClone(project);
nextProject.bodyShape = savedProjectShape;
nextProject.characterCore = characterSave.state;
nextProject.operationEvents = appendOperationEvent(nextProject.operationEvents, characterSave.event);
nextProject.moduleRevisions.integration += 1;
nextProject.moduleUpdatedAt.integration = '2026-08-20T02:04:00.000Z';
nextProject.revision += 1;
const beforeFourModules = structuredClone(project.modules);
const beforeRuntimeCharacter = structuredClone(project.character);
const patched = applyModulePatch(project, createModulePatch(nextProject, 'integration'));
assert.equal(patched.accepted, true);
assert.equal(patched.state.bodyShape.profiles.body_shape_001.waist_volume, 0.72);
assert.equal(patched.state.characterCore.profiles.character_001.body_shape_revision, 2);
assert.deepEqual(patched.state.modules, beforeFourModules);
assert.deepEqual(patched.state.character, beforeRuntimeCharacter);

for (const file of [
  'packages/body-shape/body-shape-profile.ts',
  'packages/body-shape/body-shape-runtime.ts',
  'packages/body-shape/body-shape-editor.ts',
  'packages/body-shape/index.ts',
  'schemas/body-shape-profile.schema.json',
]) await access(join(root, file));
const schema = JSON.parse(await readFile(join(root, 'schemas/body-shape-profile.schema.json'), 'utf8'));
assert.equal(schema.additionalProperties, false);
assert.deepEqual(schema.$defs.parameter, { type: 'number', minimum: 0, maximum: 1 });
const skinRuntime = await readFile(join(root, 'legacy/v8/src/smpl-skin.js'), 'utf8');
const skinWorkspace = await readFile(join(root, 'src/modules/skin/index.js'), 'utf8');
const studioSource = await readFile(join(root, 'src/studio.js'), 'utf8');
const legacyMain = await readFile(join(root, 'legacy/v8/src/main.js'), 'utf8');
assert.match(skinRuntime, /deformSkinPositions/);
assert.match(skinRuntime, /setBodyShape/);
assert.match(skinRuntime, /bodyShapeAppliedToSkinOnly/);
assert.match(skinWorkspace, /BODY_SHAPE_CONTROLS/);
assert.match(skinWorkspace, /saveBodyShapeVersion/);
assert.match(skinWorkspace, /restoreBodyShapeVersion/);
assert.match(studioSource, /bodyShape:\s*structuredClone/);
assert.match(legacyMain, /setBodyShape\(hostState\.bodyShape\)/);

console.log('PASS BodyShape parameter editing, version save, historical restore, and revision conflicts');
console.log('PASS deterministic Skin vertex response preserves Y and does not mutate source geometry');
console.log('PASS CharacterProfile body_shape_revision and schema v7 to v11 migration');
console.log('PASS BodyShape integration patch leaves Rig, Pose, Animation, and existing four-module state unchanged');
