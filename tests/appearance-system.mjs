import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AppearanceManager,
  AppearanceRevisionConflictError,
  createAppearanceRuntimeDescriptor,
  createAppearanceState,
  followAppearanceAttachments,
  getAppearanceCharacterReferences,
} from '../packages/appearance-system/index.js';
import { CharacterManager, appendOperationEvent } from '../packages/character-core/index.js';
import { createDefaultState } from '../src/default-state.js';
import { normalizeAnimationState } from '../src/modules/animation/model.js';
import { sampleAnimationRuntime } from '../src/modules/animation/runtime.js';
import { applyModulePatch, createModulePatch, normalizeProjectState } from '../src/state-schema.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manager = new AppearanceManager();
const characterManager = new CharacterManager();
const initial = createAppearanceState({ character_id: 'character_test' });

const withShort = manager.addHair(initial, {
  hair_id: 'hair_short_test',
  style: 'short',
}, { expected_revision: 1, at: '2026-08-20T06:00:00.000Z' });
const withLong = manager.addHair(withShort, {
  hair_id: 'hair_long_test',
  style: 'long',
}, { expected_revision: 2, at: '2026-08-20T06:00:01.000Z' });
const withPonytail = manager.addHair(withLong, {
  hair_id: 'hair_ponytail_test',
  style: 'ponytail',
}, { expected_revision: 3, at: '2026-08-20T06:00:02.000Z' });
assert.deepEqual(Object.values(withPonytail.hair_profiles).map((item) => item.style), ['short', 'long', 'ponytail']);
assert.equal(withPonytail.active_hair_id, 'hair_ponytail_test');
assert.equal(withPonytail.hair_profiles.hair_long_test.rig_profile.target, 'simulationRig');
assert.equal(initial.active_hair_id, null);

const switched = manager.switchHair(withPonytail, 'hair_long_test', {
  expected_revision: 4,
  at: '2026-08-20T06:00:03.000Z',
});
assert.equal(switched.active_hair_id, 'hair_long_test');

const withHat = manager.addAccessory(switched, {
  accessory_id: 'hat_test',
  type: 'hat',
}, { expected_revision: 5, at: '2026-08-20T06:00:04.000Z' });
const withGlasses = manager.addAccessory(withHat, {
  accessory_id: 'glasses_test',
  type: 'glasses',
}, { expected_revision: 6, at: '2026-08-20T06:00:05.000Z' });
const withAccessories = manager.addAccessory(withGlasses, {
  accessory_id: 'ornament_test',
  type: 'ornament',
  rig_profile: { attachment_point: 'rightHand' },
}, { expected_revision: 7, at: '2026-08-20T06:00:06.000Z' });
assert.deepEqual(Object.values(withAccessories.accessories).map((item) => item.type), ['hat', 'glasses', 'ornament']);
assert.equal(withAccessories.accessories.hat_test.rig_profile.target, 'simulationRig');

const saved = manager.saveVersion(withAccessories, {
  expected_revision: 8,
  at: '2026-08-20T06:01:00.000Z',
});
assert.equal(saved.version, 2);
assert.equal(saved.dirty, false);
assert.equal(saved.versions.length, 2);
assert.equal(manager.loadVersion(saved, 2).active_hair_id, 'hair_long_test');

const shortAgain = manager.switchHair(saved, 'hair_short_test', {
  expected_revision: 9,
  at: '2026-08-20T06:02:00.000Z',
});
const withoutGlasses = manager.removeAccessory(shortAgain, 'glasses_test', {
  expected_revision: 10,
  at: '2026-08-20T06:02:01.000Z',
});
const savedChanged = manager.saveVersion(withoutGlasses, {
  expected_revision: 11,
  at: '2026-08-20T06:03:00.000Z',
});
assert.equal(savedChanged.version, 3);
assert.equal(manager.loadVersion(savedChanged, 3).active_hair_id, 'hair_short_test');
assert.equal('glasses_test' in manager.loadVersion(savedChanged, 3).accessories, false);

const restored = manager.restoreVersion(savedChanged, 2, {
  expected_revision: 12,
  at: '2026-08-20T06:04:00.000Z',
});
assert.equal(restored.version, 4);
assert.equal(restored.active_hair_id, 'hair_long_test');
assert.equal('glasses_test' in restored.accessories, true);
assert.equal(restored.versions.length, 4);
assert.throws(
  () => manager.switchHair(restored, 'hair_short_test', { expected_revision: 12 }),
  AppearanceRevisionConflictError,
);
assert.throws(() => manager.addHair(restored, { hair_id: 'hair_bad', style: 'curly' }), /not supported/);
assert.throws(() => manager.addAccessory(restored, { accessory_id: 'bag_bad', type: 'bag' }), /not supported/);
assert.throws(
  () => manager.addHair(restored, { hair_id: 'hair_sim', style: 'short', simulation: true }),
  /not supported/,
);

const descriptor = createAppearanceRuntimeDescriptor(restored);
assert.equal(descriptor.binding, 'simulationRig');
assert.equal(descriptor.phase, 'static-attachments');
assert.deepEqual(descriptor.simulation, { hair: false, cloth: false, gpu_hair: false });
assert.deepEqual(descriptor.writes, ['appearance.mesh.transforms', 'appearance.mesh.material']);
for (const preserved of ['body_skin', 'body_vertices', 'skin_weights', 'clothing', 'rig', 'pose', 'animation_tracks']) {
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
const followA = followAppearanceAttachments(restored, frameA.simulationRig);
const followB = followAppearanceAttachments(restored, frameB.simulationRig);
const ornamentA = followA.accessories.find((item) => item.accessory_id === 'ornament_test');
const ornamentB = followB.accessories.find((item) => item.accessory_id === 'ornament_test');
assert.equal(followA.source, 'simulationRig');
assert.equal(followA.static_attachments, true);
assert.notDeepEqual(ornamentA.joint_transform.rotation, ornamentB.joint_transform.rotation);
assert.deepEqual(project.character, bodyBefore);

assert.equal(project.schemaVersion, 11);
assert.equal(project.appearanceSystem.schema, 'humanoid_rig/appearance_state@1.0');
assert.equal(project.appearanceSystem.active_hair_id, null);
assert.deepEqual(project.characterCore.profiles.character_001.hair, { hair_id: null, revision: 0 });
assert.deepEqual(project.characterCore.profiles.character_001.accessory_attachments, []);
assert.equal(project.characterCore.profiles.character_001.accessory_revision, 1);

const legacy = structuredClone(project);
legacy.schemaVersion = 9;
delete legacy.appearanceSystem;
delete legacy.activeVersions.appearance;
for (const profile of Object.values(legacy.characterCore.profiles)) {
  delete profile.hair;
  delete profile.accessory_attachments;
  delete profile.accessory_revision;
}
for (const versions of Object.values(legacy.characterCore.versions)) {
  for (const version of versions) {
    delete version.profile.hair;
    delete version.profile.accessory_attachments;
    delete version.profile.accessory_revision;
    delete version.module_revisions.accessory_revision;
  }
}
const migrated = normalizeProjectState(legacy);
assert.equal(migrated.schemaVersion, 11);
assert.equal(migrated.appearanceSystem.character_id, 'character_001');
assert.deepEqual(migrated.characterCore.profiles.character_001.hair, { hair_id: null, revision: 0 });
assert.deepEqual(migrated.characterCore.profiles.character_001.accessory_attachments, []);
assert.equal(migrated.characterCore.profiles.character_001.accessory_revision, 1);

const references = getAppearanceCharacterReferences(restored);
const characterSave = characterManager.save(project.characterCore, {
  character_id: 'character_001',
  ...references,
}, {
  expected_revision: project.characterCore.revision,
  event_id: 'operation-appearance-save',
  actor: 'appearance-system-test',
  at: '2026-08-20T06:05:00.000Z',
});
const nextProject = structuredClone(project);
nextProject.appearanceSystem = restored;
nextProject.characterCore = characterSave.state;
nextProject.operationEvents = appendOperationEvent(nextProject.operationEvents, characterSave.event);
nextProject.moduleRevisions.integration += 1;
nextProject.moduleUpdatedAt.integration = '2026-08-20T06:05:00.000Z';
nextProject.revision += 1;
const originalModules = structuredClone(project.modules);
const runtimeCharacterBefore = structuredClone(project.character);
const patched = applyModulePatch(project, createModulePatch(nextProject, 'integration'));
assert.equal(patched.accepted, true);
assert.equal(patched.state.appearanceSystem.active_hair_id, 'hair_long_test');
assert.equal(patched.state.characterCore.profiles.character_001.hair.hair_id, 'hair_long_test');
assert.deepEqual(patched.state.characterCore.profiles.character_001.accessory_attachments, [
  { accessory_id: 'hat_test', revision: 1 },
  { accessory_id: 'glasses_test', revision: 1 },
  { accessory_id: 'ornament_test', revision: 1 },
]);
assert.equal(patched.state.operationEvents[0].event_id, 'operation-appearance-save');
assert.deepEqual(patched.state.modules, originalModules);
assert.deepEqual(patched.state.character, runtimeCharacterBefore);

for (const file of [
  'packages/appearance-system/hair-profile.ts',
  'packages/appearance-system/accessory-profile.ts',
  'packages/appearance-system/appearance-runtime.ts',
  'packages/appearance-system/index.ts',
  'schemas/hair-profile.schema.json',
  'schemas/accessory-profile.schema.json',
]) await access(join(root, file));
const hairSchema = JSON.parse(await readFile(join(root, 'schemas/hair-profile.schema.json'), 'utf8'));
const accessorySchema = JSON.parse(await readFile(join(root, 'schemas/accessory-profile.schema.json'), 'utf8'));
assert.deepEqual(hairSchema.properties.style.enum, ['short', 'long', 'ponytail']);
assert.equal(hairSchema.properties.rig_profile.properties.target.const, 'simulationRig');
assert.deepEqual(accessorySchema.properties.type.enum, ['hat', 'glasses', 'ornament']);
assert.equal(accessorySchema.properties.rig_profile.properties.target.const, 'simulationRig');
const hubSource = await readFile(join(root, 'src/project-hub.js'), 'utf8');
for (const method of ['addHair', 'switchHair', 'addAccessory', 'saveAppearanceVersion', 'restoreAppearanceVersion']) {
  assert.match(hubSource, new RegExp(method));
}

console.log('PASS Hair add and short, long, ponytail switching');
console.log('PASS hat, glasses, and ornament attachment management');
console.log('PASS Appearance save, load, restore, revision conflict, and Character references');
console.log('PASS static Appearance attachments follow simulationRig without changing existing modules');
