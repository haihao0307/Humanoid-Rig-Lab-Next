import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ClothingManager,
  ClothingRevisionConflictError,
  createClothingProfile,
  createClothingRuntimeDescriptor,
  createClothingState,
  followSimulationRig,
} from '../packages/clothing-system/index.js';
import { CharacterManager, appendOperationEvent } from '../packages/character-core/index.js';
import { createDefaultState } from '../src/default-state.js';
import { normalizeAnimationState } from '../src/modules/animation/model.js';
import { sampleAnimationRuntime } from '../src/modules/animation/runtime.js';
import { applyModulePatch, createModulePatch, normalizeProjectState } from '../src/state-schema.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manager = new ClothingManager();
const characterManager = new CharacterManager();
const emptyProfile = createClothingProfile({
  clothing_profile_id: 'clothing_test',
  character_id: 'character_test',
});
const initialState = createClothingState(emptyProfile);

const withTop = manager.add(initialState, {
  clothing_id: 'top_test',
  type: 'top',
  material: { base_color: '#446699' },
}, { expected_revision: 1, at: '2026-08-20T04:00:00.000Z' });
const withPants = manager.add(withTop, {
  clothing_id: 'pants_test',
  type: 'pants',
}, { expected_revision: 2, at: '2026-08-20T04:00:01.000Z' });
const withAll = manager.add(withPants, {
  clothing_id: 'shoes_test',
  type: 'shoes',
}, { expected_revision: 3, at: '2026-08-20T04:00:02.000Z' });
assert.equal(withAll.revision, 4);
assert.equal(withAll.dirty, true);
assert.equal(withAll.profiles.clothing_test.assets.length, 3);
assert.deepEqual(withAll.profiles.clothing_test.assets.map((item) => item.type), ['top', 'pants', 'shoes']);
assert.equal(withAll.profiles.clothing_test.assets[0].rig_profile.target, 'simulationRig');
assert.equal(withAll.profiles.clothing_test.assets[0].physics_profile.mode, 'static-follow');
assert.equal(withAll.profiles.clothing_test.assets[0].physics_profile.enabled, false);
assert.equal(initialState.profiles.clothing_test.assets.length, 0);

const saved = manager.saveVersion(withAll, {
  expected_revision: 4,
  at: '2026-08-20T04:01:00.000Z',
});
assert.equal(saved.profiles.clothing_test.version, 2);
assert.equal(saved.versions.clothing_test.length, 2);
assert.equal(saved.dirty, false);

const removed = manager.remove(saved, 'pants_test', {
  expected_revision: 5,
  at: '2026-08-20T04:02:00.000Z',
});
assert.equal(removed.profiles.clothing_test.assets.length, 2);
assert.equal(removed.profiles.clothing_test.assets.some((item) => item.clothing_id === 'pants_test'), false);
const savedWithoutPants = manager.saveVersion(removed, {
  expected_revision: 6,
  at: '2026-08-20T04:03:00.000Z',
});
assert.equal(savedWithoutPants.profiles.clothing_test.version, 3);
assert.equal(manager.loadVersion(savedWithoutPants, 2).assets.length, 3);
assert.equal(manager.loadVersion(savedWithoutPants, 3).assets.length, 2);

const restored = manager.restoreVersion(savedWithoutPants, 2, {
  expected_revision: 7,
  at: '2026-08-20T04:04:00.000Z',
});
assert.equal(restored.profiles.clothing_test.version, 4);
assert.equal(restored.profiles.clothing_test.assets.length, 3);
assert.equal(restored.versions.clothing_test.length, 4);
assert.throws(
  () => manager.add(restored, { clothing_id: 'coat', type: 'top' }, { expected_revision: 7 }),
  ClothingRevisionConflictError,
);
assert.throws(() => manager.add(restored, { clothing_id: 'dress', type: 'dress' }), /top, pants, or shoes/);
assert.throws(() => manager.add(restored, { clothing_id: 'bad', type: 'top', body_vertices: [] }), /not part of the Clothing contract/);

const descriptor = createClothingRuntimeDescriptor(restored.profiles.clothing_test);
assert.deepEqual(descriptor.render_stack, ['character', 'body_skin', 'clothing_mesh']);
assert.equal(descriptor.binding, 'simulationRig');
assert.deepEqual(descriptor.writes, ['clothing.mesh.transforms', 'clothing.mesh.material']);
for (const preserved of ['body_skin', 'body_vertices', 'skin_weights', 'rig', 'pose', 'animation_tracks']) {
  assert.ok(descriptor.preserves.includes(preserved));
}

const project = createDefaultState();
const animation = normalizeAnimationState(project.character.animation, {
  compatibleRig: project.activeVersions.rig,
  sourcePoseVersion: project.activeVersions.pose,
  targetProportionRevision: project.moduleRevisions.proportion,
});
animation.activeClipId = 'wave';
const frameA = sampleAnimationRuntime(animation, {
  rawTime: 0.15,
  bodyProfile: project.character.bodyProfile,
  rigVersion: project.activeVersions.rig,
});
const frameB = sampleAnimationRuntime(animation, {
  rawTime: 0.85,
  bodyProfile: project.character.bodyProfile,
  rigVersion: project.activeVersions.rig,
});
const bodyBefore = structuredClone(project.character);
const followA = followSimulationRig(restored.profiles.clothing_test, frameA.simulationRig);
const followB = followSimulationRig(restored.profiles.clothing_test, frameB.simulationRig);
const topA = followA.asset_frames.find((item) => item.clothing_id === 'top_test');
const topB = followB.asset_frames.find((item) => item.clothing_id === 'top_test');
assert.equal(followA.source, 'simulationRig');
assert.equal(followA.static_clothing, true);
assert.notDeepEqual(topA.joint_transforms.rightUpperArm.rotation, topB.joint_transforms.rightUpperArm.rotation);
assert.deepEqual(project.character, bodyBefore);

assert.equal(project.schemaVersion, 11);
assert.equal(project.clothingSystem.schema, 'humanoid_rig/clothing_state@1.0');
assert.equal(project.clothingSystem.profiles.clothing_profile_001.assets.length, 0);
assert.deepEqual(project.characterCore.profiles.character_001.clothing_attachments, []);
assert.equal(project.characterCore.profiles.character_001.clothing_revision, 1);

const legacy = structuredClone(project);
legacy.schemaVersion = 8;
delete legacy.clothingSystem;
delete legacy.activeVersions.clothing;
delete legacy.modules.clothing;
delete legacy.moduleRevisions.clothing;
delete legacy.moduleUpdatedAt.clothing;
for (const profile of Object.values(legacy.characterCore.profiles)) {
  delete profile.clothing_attachments;
  profile.clothing_revision = 0;
}
for (const versions of Object.values(legacy.characterCore.versions)) {
  for (const version of versions) {
    delete version.profile.clothing_attachments;
    version.profile.clothing_revision = 0;
  }
}
const migrated = normalizeProjectState(legacy);
assert.equal(migrated.schemaVersion, 11);
assert.equal(migrated.clothingSystem.active_profile_id, 'clothing_profile_001');
assert.deepEqual(migrated.characterCore.profiles.character_001.clothing_attachments, []);
assert.equal(migrated.characterCore.profiles.character_001.clothing_revision, 1);

const projectClothing = manager.add(project.clothingSystem, {
  clothing_id: 'top_character',
  type: 'top',
  rig_profile: { rig_revision: project.activeVersions.rig },
}, {
  expected_revision: project.clothingSystem.revision,
  at: '2026-08-20T04:05:00.000Z',
});
const projectProfile = projectClothing.profiles[projectClothing.active_profile_id];
const characterSave = characterManager.save(project.characterCore, {
  character_id: 'character_001',
  clothing_attachments: projectProfile.assets.map((asset) => ({ clothing_id: asset.clothing_id, revision: asset.revision })),
  clothing_revision: projectProfile.version,
}, {
  expected_revision: project.characterCore.revision,
  event_id: 'operation-clothing-add',
  actor: 'clothing-system-test',
  at: '2026-08-20T04:05:00.000Z',
});
const nextProject = structuredClone(project);
nextProject.clothingSystem = projectClothing;
nextProject.characterCore = characterSave.state;
nextProject.operationEvents = appendOperationEvent(nextProject.operationEvents, characterSave.event);
nextProject.moduleRevisions.clothing += 1;
nextProject.moduleUpdatedAt.clothing = '2026-08-20T04:05:00.000Z';
nextProject.revision += 1;
const originalFourModules = Object.fromEntries(
  ['proportion', 'skin', 'pose', 'animation'].map((id) => [id, structuredClone(project.modules[id])]),
);
const runtimeCharacterBefore = structuredClone(project.character);
const patched = applyModulePatch(project, createModulePatch(nextProject, 'clothing'));
assert.equal(patched.accepted, true);
assert.equal(patched.state.clothingSystem.profiles.clothing_profile_001.assets[0].clothing_id, 'top_character');
assert.deepEqual(patched.state.characterCore.profiles.character_001.clothing_attachments, [
  { clothing_id: 'top_character', revision: 1 },
]);
assert.equal(patched.state.operationEvents[0].event_id, 'operation-clothing-add');
for (const [id, module] of Object.entries(originalFourModules)) assert.deepEqual(patched.state.modules[id], module);
assert.deepEqual(patched.state.character, runtimeCharacterBefore);

for (const file of [
  'packages/clothing-system/clothing-profile.ts',
  'packages/clothing-system/clothing-asset.ts',
  'packages/clothing-system/clothing-runtime.ts',
  'packages/clothing-system/clothing-manager.ts',
  'packages/clothing-system/index.ts',
  'schemas/clothing-profile.schema.json',
  'src/modules/clothing/index.js',
  'legacy/v8/src/clothing-layer.js',
]) await access(join(root, file));
const schema = JSON.parse(await readFile(join(root, 'schemas/clothing-profile.schema.json'), 'utf8'));
assert.equal(schema.additionalProperties, false);
assert.deepEqual(schema.$defs.clothingAsset.properties.type.enum, ['top', 'pants', 'shoes']);
assert.equal(schema.$defs.clothingAsset.properties.rig_profile.properties.target.const, 'simulationRig');
const moduleSource = await readFile(join(root, 'src/modules/clothing/index.js'), 'utf8');
const studioSource = await readFile(join(root, 'src/studio.js'), 'utf8');
const viewSource = await readFile(join(root, 'legacy/v8/src/three-view.js'), 'utf8');
const layerSource = await readFile(join(root, 'legacy/v8/src/clothing-layer.js'), 'utf8');
assert.match(moduleSource, /addClothingAsset/);
assert.match(moduleSource, /removeClothingAsset/);
assert.match(moduleSource, /saveClothingVersion/);
assert.match(moduleSource, /restoreClothingVersion/);
assert.match(studioSource, /state\.clothingSystem/);
assert.match(viewSource, /setClothingProfile/);
assert.match(layerSource, /independentFromSkin:\s*true/);
assert.match(layerSource, /rigTarget = 'simulationRig'/);

console.log('PASS Clothing add, remove, save, load, and historical restore');
console.log('PASS static Clothing Mesh follows real animation simulationRig transforms');
console.log('PASS Character attachment references and schema v8 to v11 migration');
console.log('PASS independent Clothing patch and visual layer preserve Body Skin and the original four modules');
