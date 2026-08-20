import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CharacterManager,
  CharacterRevisionConflictError,
  appendOperationEvent,
  createCharacterState,
} from '../packages/character-core/index.js';
import { createDefaultState } from '../src/default-state.js';
import { applyModulePatch, createModulePatch, normalizeProjectState } from '../src/state-schema.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manager = new CharacterManager();
const empty = createCharacterState();

const created = manager.create(empty, {
  character_id: 'character_test',
  name: 'Character Test',
  identity: { identity_id: 'identity_01', revision: 2, tags: ['hero'] },
  body_shape: { profile_id: 'shape_01', revision: 4 },
  face_identity: { face_id: 'face_01', revision: 1 },
  proportion_revision: 12,
  skin_revision: 5,
  face_revision: 1,
  clothing_revision: 1,
  hair_revision: 1,
  pose_revision: 20,
  animation_revision: 8,
}, {
  expected_revision: 0,
  event_id: 'operation-create-character-test',
  actor: 'test-window-a',
  at: '2026-08-20T01:00:00.000Z',
});
assert.equal(created.state.revision, 1);
assert.equal(created.profile.version, 1);
assert.equal(created.event.operation, 'character.create');
assert.equal(created.event.base_revision, 0);
assert.equal(created.event.revision, 1);

const saved = manager.save(created.state, {
  character_id: 'character_test',
  name: 'Character Test Saved',
  pose_revision: 21,
  animation_revision: 9,
}, {
  expected_revision: 1,
  event_id: 'operation-save-character-test',
  actor: 'test-window-a',
  at: '2026-08-20T01:01:00.000Z',
});
assert.equal(saved.state.revision, 2);
assert.equal(saved.profile.version, 2);
assert.equal(saved.profile.pose_revision, 21);
assert.equal(saved.state.versions.character_test.length, 2);
assert.deepEqual(saved.event.changes.module_revision_changes.pose_revision, { from: 20, to: 21 });

const loadedCurrent = manager.load(saved.state, 'character_test');
const loadedVersionOne = manager.load(saved.state, 'character_test', { version: 1 });
assert.equal(loadedCurrent.version, 2);
assert.equal(loadedCurrent.name, 'Character Test Saved');
assert.equal(loadedVersionOne.version, 1);
assert.equal(loadedVersionOne.pose_revision, 20);
loadedCurrent.name = 'mutated clone';
assert.equal(manager.load(saved.state, 'character_test').name, 'Character Test Saved');

assert.throws(
  () => manager.save(saved.state, { character_id: 'character_test', pose_revision: 22 }, { expected_revision: 1 }),
  CharacterRevisionConflictError,
);
assert.throws(
  () => manager.save(saved.state, { character_id: 'character_test', bones: [{ id: 'hips' }] }),
  /cannot be stored in CharacterProfile/,
);
assert.throws(
  () => manager.save(saved.state, { character_id: 'character_test', tracks: [] }),
  /cannot be stored in CharacterProfile/,
);
assert.throws(
  () => manager.updateReferences(saved.state, 'character_test', { bone_length: 0.4 }),
  /not a Character module revision reference/,
);

const defaultState = createDefaultState();
assert.equal(defaultState.characterCore.active_character_id, 'character_001');
assert.equal(defaultState.characterCore.profiles.character_001.proportion_revision, defaultState.moduleRevisions.proportion);
assert.equal(defaultState.characterCore.profiles.character_001.skin_revision, defaultState.moduleRevisions.skin);

const legacyState = structuredClone(defaultState);
delete legacyState.characterCore;
delete legacyState.operationEvents;
legacyState.schemaVersion = 5;
const migrated = normalizeProjectState(legacyState);
assert.equal(migrated.schemaVersion, 11);
assert.equal(migrated.characterCore.active_character_id, 'character_001');
assert.deepEqual(migrated.operationEvents, []);

const fourModuleSnapshot = {
  modules: structuredClone(defaultState.modules),
  character: structuredClone(defaultState.character),
  revisions: Object.fromEntries(
    ['proportion', 'skin', 'pose', 'animation'].map((id) => [id, defaultState.moduleRevisions[id]]),
  ),
};
const characterSave = manager.updateReferences(
  defaultState.characterCore,
  'character_001',
  { pose_revision: defaultState.moduleRevisions.pose + 1 },
  {
    expected_revision: defaultState.characterCore.revision,
    event_id: 'operation-character-patch',
    at: '2026-08-20T01:02:00.000Z',
  },
);
const integrationState = structuredClone(defaultState);
integrationState.characterCore = characterSave.state;
integrationState.operationEvents = appendOperationEvent(integrationState.operationEvents, characterSave.event);
integrationState.moduleRevisions.integration += 1;
integrationState.moduleUpdatedAt.integration = '2026-08-20T01:02:00.000Z';
integrationState.revision += 1;
const integrationPatch = createModulePatch(integrationState, 'integration');
const patched = applyModulePatch(defaultState, integrationPatch);
assert.equal(patched.accepted, true);
assert.equal(patched.state.characterCore.profiles.character_001.pose_revision, defaultState.moduleRevisions.pose + 1);
assert.equal(patched.state.operationEvents[0].event_id, 'operation-character-patch');
assert.deepEqual(patched.state.modules, fourModuleSnapshot.modules);
assert.deepEqual(patched.state.character, fourModuleSnapshot.character);
for (const [id, revision] of Object.entries(fourModuleSnapshot.revisions)) {
  assert.equal(patched.state.moduleRevisions[id], revision);
}

const proportionState = structuredClone(patched.state);
proportionState.character.bodyProfile.height = 1.82;
proportionState.moduleRevisions.proportion += 1;
proportionState.moduleUpdatedAt.proportion = '2026-08-20T01:03:00.000Z';
const characterCoreBeforeModulePatch = structuredClone(patched.state.characterCore);
const modulePatched = applyModulePatch(patched.state, createModulePatch(proportionState, 'proportion'));
assert.equal(modulePatched.accepted, true);
assert.deepEqual(modulePatched.state.characterCore, characterCoreBeforeModulePatch);

for (const file of [
  'packages/character-core/character-profile.ts',
  'packages/character-core/character-state.ts',
  'packages/character-core/character-version.ts',
  'packages/character-core/character-manager.ts',
  'packages/character-core/index.ts',
  'schemas/character-profile.schema.json',
]) await access(join(root, file));

const schema = JSON.parse(await readFile(join(root, 'schemas/character-profile.schema.json'), 'utf8'));
assert.equal(schema.additionalProperties, false);
assert.ok(schema.required.includes('hair_revision'));
assert.ok(schema.required.includes('body_shape_revision'));
assert.ok(schema.required.includes('face_identity'));
assert.ok(schema.required.includes('clothing_attachments'));
assert.equal(schema.properties.proportion_revision.$ref, '#/$defs/revision');

console.log('PASS Character create, save, current load, and historical version load');
console.log('PASS optimistic Character revision conflict and reference-only write guard');
console.log('PASS ProjectState v5 to v11 Character Core migration and OperationEvent integration');
console.log('PASS Character integration patch leaves Proportion, Skin, Pose, and Animation slices unchanged');
