import assert from 'node:assert/strict';
import { BUILD_ID, MODULE_BASE_REVISIONS, createDefaultState } from '../src/default-state.js';
import { applyModulePatch, createModulePatch, normalizeProjectState } from '../src/state-schema.js';

const base = createDefaultState();
const sameOriginA = structuredClone(base);
const sameOriginB = structuredClone(base);

sameOriginA.character.bodyProfile.height = 1.73;
sameOriginA.character.bodyProfile.viewportMode = 'both';
sameOriginA.character.bodyProfile.requiresRebind = true;
sameOriginA.character.rigRules.mirrorEditing = false;
sameOriginA.moduleRevisions.proportion += 1;
sameOriginA.moduleUpdatedAt.proportion = '2026-08-18T10:00:01.000Z';
sameOriginA.revision += 1;
const proportionPatch = createModulePatch(sameOriginA, 'proportion', {
  id: 'activity-proportion', at: sameOriginA.moduleUpdatedAt.proportion, module: 'proportion', summary: '调整身高',
});

sameOriginB.character.skin.source = 'base';
sameOriginB.character.skin.activeSource = 'base';
sameOriginB.character.skin.fallbackAsset = 'legacy-procedural-body';
sameOriginB.character.display.skinOpacity = 0.66;
sameOriginB.moduleRevisions.skin += 1;
sameOriginB.moduleUpdatedAt.skin = '2026-08-18T10:00:01.100Z';
sameOriginB.revision += 1;
const skinPatch = createModulePatch(sameOriginB, 'skin', {
  id: 'activity-skin', at: sameOriginB.moduleUpdatedAt.skin, module: 'skin', summary: '更新表皮透明度',
});

const first = applyModulePatch(base, proportionPatch);
assert.equal(first.accepted, true);
const second = applyModulePatch(first.state, skinPatch);
assert.equal(second.accepted, true);
assert.equal(second.state.character.bodyProfile.height, 1.73);
assert.equal(second.state.character.bodyProfile.viewportMode, 'both');
assert.equal(second.state.character.bodyProfile.requiresRebind, true);
assert.equal(second.state.character.rigRules.mirrorEditing, false);
assert.equal(second.state.character.skin.source, 'detail');
assert.equal(second.state.character.skin.activeSource, 'detail');
assert.equal(second.state.character.skin.singleLayer, true);
assert.equal(second.state.character.skin.pickingSource, 'detailed-smpl-skinned-mesh');
assert.equal(second.state.character.skin.deformation, 'native-three-skinned-mesh');
assert.equal(second.state.character.skin.bindPoseProtection, true);
assert.equal('fallbackAsset' in second.state.character.skin, false);
assert.equal(second.state.character.display.skinOpacity, 0.66);
assert.equal(second.state.moduleRevisions.proportion, MODULE_BASE_REVISIONS.proportion + 1);
assert.equal(second.state.moduleRevisions.skin, MODULE_BASE_REVISIONS.skin + 1);
assert.ok(second.state.activity.some((item) => item.id === 'activity-proportion'));
assert.ok(second.state.activity.some((item) => item.id === 'activity-skin'));

const poseState = structuredClone(second.state);
poseState.character.pose.v8Payload = {
  schemaVersion: 5,
  type: 'humanoid-pose',
  pose: 'CUSTOM',
  updatedAt: '2026-08-18T10:00:01.200Z',
  joints: [{ id: 'hips', poseWorldPosition: { x: 0, y: 0.925, z: 0.016 }, pinned: false }],
};
poseState.moduleRevisions.pose += 1;
poseState.moduleUpdatedAt.pose = '2026-08-18T10:00:01.200Z';
const posePatch = createModulePatch(poseState, 'pose');
const third = applyModulePatch(second.state, posePatch);
assert.equal(third.accepted, true);
assert.equal(third.state.character.pose.v8Payload.pose, 'CUSTOM');
assert.equal(third.state.character.skin.source, 'detail');

const stale = applyModulePatch(third.state, {
  ...proportionPatch,
  moduleRevision: 1,
  bodyProfile: { ...third.state.character.bodyProfile, height: 2.1 },
});
assert.equal(stale.accepted, false);
assert.equal(stale.state.character.bodyProfile.height, 1.73);

const migrated = normalizeProjectState({
  ...base,
  schemaVersion: 1,
  build: { version: '0.1.1' },
  moduleRevisions: undefined,
  moduleUpdatedAt: undefined,
  character: {
    ...base.character,
    skin: { source: 'base', activeSource: 'base', fallbackAsset: 'old-shell' },
    physics: undefined,
    display: { ...base.character.display, mode: 'invalid' },
  },
});
assert.equal(migrated.schemaVersion, 11);
assert.equal(migrated.build.version, '0.5.0');
assert.equal(migrated.build.id, BUILD_ID);
assert.equal(migrated.character.skin.source, 'detail');
assert.equal(migrated.character.skin.activeSource, 'detail');
assert.equal(migrated.character.skin.singleLayer, true);
assert.equal(migrated.character.skin.pickingSource, 'detailed-smpl-skinned-mesh');
assert.equal(migrated.character.skin.deformation, 'native-three-skinned-mesh');
assert.equal(migrated.character.skin.bindPoseProtection, true);
assert.equal('fallbackAsset' in migrated.character.skin, false);
assert.equal(migrated.character.display.mode, 'both');
assert.equal(migrated.moduleRevisions.animation, MODULE_BASE_REVISIONS.animation);

console.log('PASS module-scoped patches merge simultaneous four-window edits without overwriting unrelated modules');
console.log('PASS legacy surface-source fields are forced onto the single detailed surface');
console.log('PASS schema v1 project migration to schema v11');
