import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACTIVE_VERSIONS,
  BUILD_ID,
  MODULE_BASE_REVISIONS,
  createDefaultState,
} from '../src/default-state.js';
import { normalizeProjectState } from '../src/state-schema.js';
import { normalizeAnimationState } from '../src/modules/animation/model.js';
import { sampleAnimationRuntime } from '../src/modules/animation/runtime.js';
import { POSE_SNAPSHOT_SCHEMA } from '../src/modules/pose/pose-contract.js';
import { PhysicsRig } from '../legacy/v8/src/physics-rig.js';
import { createStandardHumanoidPreset } from '../legacy/v8/src/skeleton-presets.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = createDefaultState();
const projectStateRegressionSignature = JSON.stringify(state);
assert.equal(state.build.id, BUILD_ID);
assert.deepEqual(state.activeVersions, ACTIVE_VERSIONS);
assert.deepEqual(state.moduleRevisions, MODULE_BASE_REVISIONS);
assert.equal(state.character.skin.detailAsset, 'legacy/v8/assets/smpl/smpl-male-surface-skinned.glb');
assert.equal(state.character.skin.pickingSource, 'detailed-smpl-skinned-mesh');
assert.equal(state.character.skin.deformation, 'native-three-skinned-mesh');
assert.equal(state.character.pose.poseSnapshot, null);

const migrated = normalizeProjectState({
  ...state,
  build: { version: '0.5.0', id: 'old-build' },
  activeVersions: {
    rig: 'rig@0.4.0',
    skin: 'skin@0.4.0',
    pose: 'pose@0.3.1',
    animation: 'anim@0.2.0',
    character: 'character@0.5.0',
  },
  moduleRevisions: { proportion: 1, skin: 1, pose: 1, animation: 1, integration: 1 },
  character: {
    ...state.character,
    skin: {
      source: 'detail',
      detailAsset: 'legacy/v8/assets/smpl/smpl-male-surface.glb',
      pickingSource: 'detailed-smpl-mesh',
      deformation: 'region-isolated-dqs',
    },
  },
});
assert.equal(migrated.build.id, BUILD_ID);
assert.deepEqual(migrated.activeVersions, ACTIVE_VERSIONS);
assert.deepEqual(migrated.moduleRevisions, MODULE_BASE_REVISIONS);
assert.equal(migrated.character.skin.detailAsset, state.character.skin.detailAsset);
assert.equal(migrated.modules.animation.version, 'anim@0.4.0');

const animation = normalizeAnimationState(state.character.animation, {
  compatibleRig: state.activeVersions.rig,
  sourcePoseVersion: state.activeVersions.pose,
  targetProportionRevision: state.moduleRevisions.proportion,
});
assert.equal(animation.schema, 'humanoid_rig/animation_session@0.4');
assert.equal(animation.clips.length, 7);
const runtimeFrame = sampleAnimationRuntime(animation, {
  rawTime: 0.8,
  bodyProfile: state.character.bodyProfile,
  rigVersion: state.activeVersions.rig,
});
assert.ok(Object.keys(runtimeFrame.finalPose.joints).length > 0);
assert.ok(runtimeFrame.diagnostics.simulationRigBoneLengthError < 1e-8);

const timestamp = new Date().toISOString();
const snapshot = {
  schema: POSE_SNAPSHOT_SCHEMA,
  schemaVersion: 1,
  type: 'PoseSnapshot',
  compatibleRig: state.activeVersions.rig,
  solverVersion: 'animation-runtime@0.4.0',
  name: 'Integration Animation Sample',
  unit: 'meter',
  coordinateSystem: { handedness: 'right', upAxis: '+Y', forwardAxis: '+Z', rightAxis: '+X' },
  source: 'integration-v002-test',
  sourceRepresentation: 'local_quaternion_animation',
  rotationSpace: 'local',
  rotationConvention: 'incoming_bone_bind_delta_zero_twist',
  rootJointId: 'hips',
  rootTranslation: [...runtimeFrame.finalPose.root.position],
  rootRotation: [...runtimeFrame.finalPose.root.rotation],
  localRotations: structuredClone(runtimeFrame.v8Payload.incomingBoneLocalRotations),
  pinnedJoints: {},
  updatedAt: timestamp,
};
assert.equal(POSE_SNAPSHOT_SCHEMA, 'humanoid_rig/pose_snapshot@1.0');
const definition = createStandardHumanoidPreset('A');
const physicsRig = new PhysicsRig(definition);
const bindSignature = definition.joints.map((joint) => `${joint.id}|${joint.parentId}|${JSON.stringify(joint.localPosition)}`).join('\n');
const applied = physicsRig.applyPoseSnapshot(snapshot, { project: true, applyConstraintSettings: false });
assert.ok(applied >= 24);
assert.ok(physicsRig.getMaxBoneError() < 1e-7);
assert.equal(
  definition.joints.map((joint) => `${joint.id}|${joint.parentId}|${JSON.stringify(joint.localPosition)}`).join('\n'),
  bindSignature,
  'PoseSnapshot application changed bind hierarchy or bind offsets',
);

const skinBytes = await readFile(join(root, 'legacy/v8/assets/smpl/smpl-male-surface-skinned.glb'));
assert.equal(createHash('sha256').update(skinBytes).digest('hex'), '736cb39c828203eae72f5e5d094f1623c0a4465a31b484737a6e8df02a7ec899');
const skinMetadata = JSON.parse(await readFile(join(root, 'legacy/v8/assets/smpl/SKIN_BINDING_METADATA.json'), 'utf8'));
assert.equal(skinMetadata.inverseBindMatrices.count, 24);
assert.equal(skinMetadata.weights.maximumInfluences, 4);
assert.equal(skinMetadata.weights.normalized, true);

for (const module of ['proportion', 'skin', 'pose', 'animation']) {
  const scope = JSON.parse(await readFile(join(root, `control/module-scopes/${module}.json`), 'utf8'));
  const status = JSON.parse(await readFile(join(root, `control/module-status/${module}.json`), 'utf8'));
  assert.equal(scope.module, module);
  assert.equal(status.compatibleRig, 'rig@0.4.0');
  assert.equal(status.moduleRevision, MODULE_BASE_REVISIONS[module]);
  assert.equal(status.failed, 0);
}

const studio = await readFile(join(root, 'src/studio.js'), 'utf8');
const legacyMain = await readFile(join(root, 'legacy/v8/src/main.js'), 'utf8');
const hub = await readFile(join(root, 'src/project-hub.js'), 'utf8');
const worker = await readFile(join(root, 'workers/project-hub.shared.js'), 'utf8');
const animationWorkspace = await readFile(join(root, 'src/modules/animation/index.js'), 'utf8');
assert.match(studio, /poseSnapshot: state\.character\.pose\.poseSnapshot/);
assert.match(studio, /skinBuild/);
assert.match(legacyMain, /physicsRig\.applyPoseSnapshot/);
assert.match(legacyMain, /physicsRig\.buildPoseSnapshot/);
assert.match(hub, /publishTransient/);
assert.match(hub, /humanoid_rig\/transient_bus@1\.0/);
assert.match(worker, /message\.type === 'TRANSIENT'/);
assert.match(animationWorkspace, /motion\.transport\.anchor/);
assert.match(animationWorkspace, /motion\.scrub\.preview/);
assert.match(animationWorkspace, /buildAnimationPoseSnapshot/);

const buildManifest = JSON.parse(await readFile(join(root, 'BUILD_MANIFEST.json'), 'utf8'));
assert.equal(buildManifest.id, BUILD_ID);
assert.deepEqual(buildManifest.activeVersions, ACTIVE_VERSIONS);
assert.deepEqual(buildManifest.moduleRevisions, MODULE_BASE_REVISIONS);
assert.equal(
  JSON.stringify(state),
  projectStateRegressionSignature,
  'Animation sampling, PoseSnapshot application, or asset validation mutated ProjectState.',
);

console.log(`PASS integrated build ${BUILD_ID}`);
console.log('PASS baseline-state migration to all four V002 module versions');
console.log('PASS animation local-quaternion PoseSnapshot applied through fixed-length PhysicsRig');
console.log('PASS native pre-bound single-surface asset hash and binding metadata');
console.log('PASS shared transient transport and scrub message infrastructure');
console.log('PASS archived module scopes and build identity contract');
