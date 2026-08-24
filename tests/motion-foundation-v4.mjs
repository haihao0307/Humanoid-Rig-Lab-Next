import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  AnimationRigRuntime,
  MOTION_CLIP_V4_SCHEMA,
  adaptLegacyMotionClipV1,
  createMotionFoundationAssetsV4,
  createMotionRetargetProfile,
  importMotionClipV4,
  sampleMotionClipV4,
  serializeMotionClipV4,
  validateMotionClipV4,
} from '../src/modules/animation/motion-foundation-v4.js';
import { createWalkPreset, LEGACY_PROCEDURAL_MOTION_STATUS } from '../src/modules/animation/presets.js';
import { serializeMotionClip } from '../src/modules/animation/model.js';
import { quaternionAngularDistance, quaternionLength } from '../src/modules/animation/quaternion.js';

const assets = createMotionFoundationAssetsV4({ sourceProportionRevision: 2 });
assert.equal(assets.length, 7);
for (const clip of assets) {
  assert.equal(clip.schema, MOTION_CLIP_V4_SCHEMA);
  const report = validateMotionClipV4(clip);
  assert.equal(report.valid, true, `${clip.clipId}: ${report.errors.join(', ')}`);
  for (const track of clip.tracks) {
    assert.equal(track.type, 'joint_local_quaternion');
    assert.equal(track.space, 'local');
    for (const key of track.keyframes) assert.ok(Math.abs(quaternionLength(key.value) - 1) < 1e-6);
  }
  for (const key of clip.rootMotion.rotationTrack.keyframes) assert.ok(Math.abs(quaternionLength(key.value) - 1) < 1e-6);
}

const walk = assets.find((clip) => clip.clipId === 'foundation-walk-v4');
const walkBeforeSampling = structuredClone(walk);
const roundTrip = importMotionClipV4(serializeMotionClipV4(walk));
assert.deepEqual(roundTrip, walk);

const forbidden = structuredClone(walk);
forbidden.boneLength = 1;
assert.equal(validateMotionClipV4(forbidden).valid, false);
const nonRootPosition = structuredClone(walk);
nonRootPosition.tracks[0].type = 'joint_position';
assert.equal(validateMotionClipV4(nonRootPosition).valid, false);
const nonUnit = structuredClone(walk);
nonUnit.tracks[0].keyframes[0].value = [1, 1, 1, 1];
assert.equal(validateMotionClipV4(nonUnit).valid, false);

const legacyAsset = serializeMotionClip(createWalkPreset({ rootMotion: true }));
const legacyBefore = structuredClone(legacyAsset);
const legacyView = adaptLegacyMotionClipV1(legacyAsset);
assert.equal(legacyView.schema, MOTION_CLIP_V4_SCHEMA);
assert.equal(legacyView.quality.status, 'legacy-compatibility');
assert.deepEqual(legacyAsset, legacyBefore, 'V1 adapter mutated its source asset.');
assert.equal(LEGACY_PROCEDURAL_MOTION_STATUS.status, 'frozen-legacy-test-only');

const leftStance = sampleMotionClipV4(walk, 0.1);
const rightStance = sampleMotionClipV4(walk, 0.5);
const nextLeftStance = sampleMotionClipV4(walk, 1.0);
assert.deepEqual(walk, walkBeforeSampling, 'Motion sampling mutated its source asset.');
assert.deepEqual(leftStance.contacts.map((contact) => contact.jointId), ['leftFoot']);
assert.deepEqual(rightStance.contacts.map((contact) => contact.jointId), ['rightFoot']);
assert.deepEqual(nextLeftStance.contacts.map((contact) => contact.jointId), ['leftFoot']);
assert.equal(leftStance.phase.leftFootState, 'stance');
assert.equal(rightStance.phase.rightFootState, 'stance');
assert.ok(['left', 'right', 'double_support'].includes(sampleMotionClipV4(walk, 0.33).phase.supportState));

const stop = assets.find((clip) => clip.clipId === 'foundation-stop-v4');
const stopTimes = [0, 0.25, 0.5, 0.75, 1];
const stopPositions = stopTimes.map((time) => sampleMotionClipV4(stop, time).rootPosition[2]);
const stopSpeeds = stopPositions.slice(1).map((position, index) => (position - stopPositions[index]) / 0.25);
for (let index = 1; index < stopSpeeds.length; index += 1) {
  assert.ok(stopSpeeds[index] <= stopSpeeds[index - 1] + 1e-9, 'Stop root speed must not increase.');
}
assert.ok(stopSpeeds.at(-1) < stopSpeeds[0]);

const turn = assets.find((clip) => clip.clipId === 'foundation-turn-v4');
const identity = [0, 0, 0, 1];
const turnAngles = [0, 0.25, 0.5, 0.75, 1].map((time) => quaternionAngularDistance(identity, sampleMotionClipV4(turn, time).rootRotation));
for (let index = 1; index < turnAngles.length; index += 1) {
  assert.ok(turnAngles[index] >= turnAngles[index - 1] - 1e-8, 'Turn root rotation must be continuous and monotonic.');
  assert.ok(turnAngles[index] - turnAngles[index - 1] < Math.PI / 3, 'Turn contains a rotation discontinuity.');
}

const profile = createMotionRetargetProfile({
  profileId: 'tall-character',
  sourceRigVersion: 'rig@0.4.0',
  targetRigVersion: 'rig@0.4.0',
  sourceProportionRevision: 2,
  targetProportionRevision: 9,
  sourceDimensions: { height: 1.8, legLength: 0.9, armLength: 0.7 },
  targetDimensions: { height: 2.0, legLength: 1.1, armLength: 0.8 },
});
const retargetRuntime = new AnimationRigRuntime({ rigVersion: 'rig@0.4.0', proportionRevision: 2 });
const retargeted = retargetRuntime.loadClip(walk, { retargetProfile: profile });
assert.deepEqual(
  retargeted.tracks.map((track) => track.keyframes.map((key) => key.value)),
  walk.tracks.map((track) => track.keyframes.map((key) => key.value)),
  'Retargeting changed authored local quaternions.',
);
assert.ok(retargeted.rootMotion.positionTrack.keyframes.at(-1).value[2] > walk.rootMotion.positionTrack.keyframes.at(-1).value[2]);
const retargetFrame = retargetRuntime.sample(0.6);
assert.equal(retargetFrame.desiredPose.proportionRevision, 9);
assert.equal(retargetFrame.diagnostics.writesSkin, false);
assert.equal(retargetFrame.diagnostics.writesSimulationRig, false);

const topology = {
  parentId: 'hips',
  boneLength: 0.45,
  inverseBindMatrices: [[1, 0, 0, 0]],
};
const topologyBefore = structuredClone(topology);
retargetRuntime.sample(0.8, { ikTargets: [], rigTopology: topology });
assert.deepEqual(topology, topologyBefore);

const layeredRuntime = new AnimationRigRuntime();
const idle = assets.find((clip) => clip.clipId === 'foundation-idle-v4');
const reach = assets.find((clip) => clip.clipId === 'foundation-reach-v4');
layeredRuntime.loadClip(idle);
layeredRuntime.loadClip(reach, { activate: false });
layeredRuntime.setLayer('right-arm-reach', {
  clipId: reach.clipId,
  weight: 1,
  mask: ['rightUpperArm', 'rightLowerArm'],
  blendMode: 'override',
});
const layered = layeredRuntime.sample(0.8);
assert.ok(layered.desiredPose.localRotations.rightUpperArm);
assert.deepEqual(layeredRuntime.getDesiredPose(), layered.desiredPose);

const performanceRuntime = new AnimationRigRuntime();
performanceRuntime.loadClip(walk);
for (let index = 0; index < 100; index += 1) performanceRuntime.sample(index / 60);
const start = performance.now();
for (let index = 0; index < 1000; index += 1) performanceRuntime.sample(index / 60);
const totalMs = performance.now() - start;
const averageMs = totalMs / 1000;
assert.ok(averageMs < 1, `Motion sampling average ${averageMs.toFixed(4)} ms exceeded 1 ms.`);

console.log(`PASS Motion Foundation V4: 7 clips, local quaternion authority, contacts, phase, retarget, layers, and 1000-frame sampling (${averageMs.toFixed(4)} ms/frame)`);
