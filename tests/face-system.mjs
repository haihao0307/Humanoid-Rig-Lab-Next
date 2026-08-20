import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FACE_BACKENDS,
  FaceEditor,
  FaceRevisionConflictError,
  FaceRuntime,
  createFaceIdentity,
  createFaceRuntimeDescriptor,
  createFaceState,
} from '../packages/face-system/index.js';
import { CharacterManager, appendOperationEvent } from '../packages/character-core/index.js';
import { createDefaultState } from '../src/default-state.js';
import { applyModulePatch, createModulePatch, normalizeProjectState } from '../src/state-schema.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const editor = new FaceEditor();
const characterManager = new CharacterManager();
const initialProfile = createFaceIdentity({
  face_id: 'face_test',
  age: 28,
  expression_profile: { profile_id: 'expression_test', revision: 1, default_expression: 'neutral' },
});
const initialState = createFaceState(initialProfile);

const edited = editor.update(initialState, {
  age: 35,
  face_shape: { width: 0.72, jaw_width: 0.63 },
  eye_shape: { size: 0.6, spacing: 0.58, tilt: 0.42 },
  nose_shape: { width: 0.46, length: 0.67, bridge_height: 0.61 },
  mouth_shape: { width: 0.64, fullness: 0.7, corner_curve: 0.57 },
  expression_profile: { revision: 2, default_expression: 'smile' },
}, {
  expected_revision: 1,
  at: '2026-08-20T03:00:00.000Z',
});
assert.equal(edited.revision, 2);
assert.equal(edited.dirty, true);
assert.equal(edited.profiles.face_test.version, 1);
assert.equal(edited.profiles.face_test.age, 35);
assert.equal(edited.profiles.face_test.face_shape.width, 0.72);
assert.equal(initialState.profiles.face_test.age, 28);

const saved = editor.saveVersion(edited, {
  expected_revision: 2,
  at: '2026-08-20T03:01:00.000Z',
});
assert.equal(saved.revision, 3);
assert.equal(saved.dirty, false);
assert.equal(saved.profiles.face_test.version, 2);
assert.equal(saved.versions.face_test.length, 2);
assert.equal(editor.loadVersion(saved).age, 35);
assert.equal(editor.loadVersion(saved, 1).age, 28);
assert.equal(editor.loadVersion(saved, 2).mouth_shape.fullness, 0.7);

const restored = editor.restoreVersion(saved, 1, {
  expected_revision: 3,
  at: '2026-08-20T03:02:00.000Z',
});
assert.equal(restored.revision, 4);
assert.equal(restored.profiles.face_test.version, 3);
assert.equal(restored.profiles.face_test.age, 28);
assert.equal(restored.profiles.face_test.face_shape.width, 0.5);
assert.equal(restored.versions.face_test.length, 3);
assert.throws(
  () => editor.update(restored, { age: 36 }, { expected_revision: 3 }),
  FaceRevisionConflictError,
);
assert.throws(() => editor.update(restored, { skin: { opacity: 0.5 } }), /not part of the Face Identity contract/);
assert.throws(() => editor.update(restored, { rig_definition: {} }), /not part of the Face Identity contract/);
assert.throws(() => editor.update(restored, { face_shape: { width: 1.2 } }), /between 0 and 1/);

const descriptor = createFaceRuntimeDescriptor(saved.profiles.face_test);
assert.equal(descriptor.face_id, 'face_test');
assert.equal(descriptor.face_revision, 2);
assert.deepEqual(descriptor.writes, ['face.identity_descriptor']);
for (const preserved of ['skin', 'rig', 'bone_lengths', 'hierarchy', 'pose', 'animation_tracks']) {
  assert.ok(descriptor.preserves.includes(preserved));
}
assert.deepEqual(
  descriptor.backend_interfaces.map((item) => item.backend),
  [FACE_BACKENDS.FLAME, FACE_BACKENDS.THREE_DMM, FACE_BACKENDS.AI_FACE_RECONSTRUCTION],
);

const runtime = new FaceRuntime();
runtime.registerAdapter(FACE_BACKENDS.FLAME, {
  prepare(profile, runtimeDescriptor) {
    return { face_id: profile.face_id, coefficient_count: 100, source: runtimeDescriptor.source };
  },
});
assert.equal(runtime.hasAdapter(FACE_BACKENDS.FLAME), true);
assert.equal(runtime.prepare(saved.profiles.face_test, { backend: FACE_BACKENDS.FLAME }).payload.coefficient_count, 100);
assert.throws(
  () => runtime.prepare(saved.profiles.face_test, { backend: FACE_BACKENDS.THREE_DMM }),
  /not registered/,
);

const project = createDefaultState();
const defaultCharacter = project.characterCore.profiles.character_001;
assert.equal(project.schemaVersion, 11);
assert.equal(project.faceSystem.schema, 'humanoid_rig/face_state@1.0');
assert.equal(project.faceSystem.profiles.face_001.age, 30);
assert.equal(defaultCharacter.face_identity.face_id, 'face_001');
assert.equal(defaultCharacter.face_identity.revision, defaultCharacter.face_revision);

const legacy = structuredClone(project);
legacy.schemaVersion = 7;
delete legacy.faceSystem;
for (const profile of Object.values(legacy.characterCore.profiles)) {
  delete profile.face_identity;
  profile.face_revision = 0;
}
for (const versions of Object.values(legacy.characterCore.versions)) {
  for (const version of versions) {
    delete version.profile.face_identity;
    version.profile.face_revision = 0;
  }
}
const migrated = normalizeProjectState(legacy);
assert.equal(migrated.schemaVersion, 11);
assert.equal(migrated.faceSystem.active_face_id, 'face_001');
assert.deepEqual(migrated.characterCore.profiles.character_001.face_identity, { face_id: 'face_001', revision: 1 });
assert.equal(migrated.characterCore.profiles.character_001.face_revision, 1);

const projectFaceDraft = editor.update(project.faceSystem, {
  age: 42,
  face_shape: { cheekbone: 0.73 },
}, {
  expected_revision: project.faceSystem.revision,
  at: '2026-08-20T03:03:00.000Z',
});
const projectFaceSaved = editor.saveVersion(projectFaceDraft, {
  expected_revision: projectFaceDraft.revision,
  at: '2026-08-20T03:04:00.000Z',
});
const projectFaceProfile = projectFaceSaved.profiles[projectFaceSaved.active_face_id];
const characterSave = characterManager.save(project.characterCore, {
  character_id: 'character_001',
  face_identity: { face_id: projectFaceProfile.face_id, revision: projectFaceProfile.version },
  face_revision: projectFaceProfile.version,
}, {
  expected_revision: project.characterCore.revision,
  event_id: 'operation-face-save',
  actor: 'face-system-test',
  at: '2026-08-20T03:04:00.000Z',
});
const nextProject = structuredClone(project);
nextProject.faceSystem = projectFaceSaved;
nextProject.characterCore = characterSave.state;
nextProject.operationEvents = appendOperationEvent(nextProject.operationEvents, characterSave.event);
nextProject.moduleRevisions.integration += 1;
nextProject.moduleUpdatedAt.integration = '2026-08-20T03:04:00.000Z';
nextProject.revision += 1;
const beforeModules = structuredClone(project.modules);
const beforeRuntimeCharacter = structuredClone(project.character);
const beforeBodyShape = structuredClone(project.bodyShape);
const patched = applyModulePatch(project, createModulePatch(nextProject, 'integration'));
assert.equal(patched.accepted, true);
assert.equal(patched.state.faceSystem.profiles.face_001.age, 42);
assert.equal(patched.state.characterCore.profiles.character_001.face_revision, 2);
assert.equal(patched.state.operationEvents[0].event_id, 'operation-face-save');
assert.deepEqual(patched.state.modules, beforeModules);
assert.deepEqual(patched.state.character, beforeRuntimeCharacter);
assert.deepEqual(patched.state.bodyShape, beforeBodyShape);

for (const file of [
  'packages/face-system/face-profile.ts',
  'packages/face-system/face-runtime.ts',
  'packages/face-system/face-editor.ts',
  'packages/face-system/index.ts',
  'schemas/face-profile.schema.json',
  'face.html',
  'face.css',
  'src/face-editor-page.js',
]) await access(join(root, file));

const schema = JSON.parse(await readFile(join(root, 'schemas/face-profile.schema.json'), 'utf8'));
assert.equal(schema.additionalProperties, false);
assert.deepEqual(schema.$defs.parameter, { type: 'number', minimum: 0, maximum: 1 });
assert.ok(schema.required.includes('expression_profile'));
const page = await readFile(join(root, 'face.html'), 'utf8');
const pageSource = await readFile(join(root, 'src/face-editor-page.js'), 'utf8');
assert.match(page, /faceParameterForm/);
assert.match(page, /Face Runtime Descriptor/);
assert.match(pageSource, /createFaceIdentity/);
assert.match(pageSource, /saveFaceVersion/);
assert.match(pageSource, /restoreFaceVersion/);
assert.match(pageSource, /createFaceRuntimeDescriptor/);

console.log('PASS Face Identity create, parameter editing, version save, load, and restore');
console.log('PASS Face Runtime adapter boundary preserves Skin, Rig, Pose, and Animation');
console.log('PASS Character Core Face reference and schema v7 to v11 migration');
console.log('PASS Face integration patch and independent parameter editor file contract');
