import assert from 'node:assert/strict';
import {
  addClipContact,
  addClipEvent,
  addPoseSnapshotKey,
  compressAnimationClip,
  copyTrackKeyframes,
  createEmptyClip,
  deleteTrackKeyframes,
  importMotionClip,
  mirrorAnimationClip,
  moveTrackKeyframes,
  normalizeAnimationState,
  removeClipContact,
  removeClipEvent,
  samplePoseSnapshotClip,
  scaleClipTimeRange,
  serializeMotionClip,
  setAnimationLayer,
  setGraphParameter,
  upsertTrackKeyframe,
  validateAnimationClip,
} from '../src/modules/animation/model.js';
import {
  quaternionAngularDistance,
  quaternionFromEuler,
  quaternionLength,
} from '../src/modules/animation/quaternion.js';

let clip = createEmptyClip({ clipId: 'timeline-edit', duration: 2, compatibleRig: 'rig@0.4.0' });
clip = upsertTrackKeyframe(clip, {
  jointId: 'leftUpperArm', time: 0, value: quaternionFromEuler([0, 0, 0]), keyframeId: 'key-a',
});
clip = upsertTrackKeyframe(clip, {
  jointId: 'leftUpperArm', time: 1, value: quaternionFromEuler([0.2, 0.1, -0.3]), keyframeId: 'key-b',
});
clip = upsertTrackKeyframe(clip, {
  jointId: 'leftUpperArm', time: 2, value: quaternionFromEuler([0.4, 0.2, -0.6]), keyframeId: 'key-c',
});
clip = copyTrackKeyframes(clip, { trackId: 'leftUpperArm:rotation', keyframeIds: ['key-b'], deltaTime: 0.25 });
assert.deepEqual(clip.tracks[0].keyframes.map((key) => key.time), [0, 1, 1.25, 2]);
const copied = clip.tracks[0].keyframes.find((key) => key.time === 1.25);
clip = moveTrackKeyframes(clip, { trackId: 'leftUpperArm:rotation', keyframeIds: [copied.id], deltaTime: 0.25 });
assert.ok(clip.tracks[0].keyframes.some((key) => key.time === 1.5));
clip = deleteTrackKeyframes(clip, { trackId: 'leftUpperArm:rotation', keyframeIds: [copied.id] });
assert.deepEqual(clip.tracks[0].keyframes.map((key) => key.time), [0, 1, 2]);
assert.ok(clip.tracks[0].keyframes.every((key) => Math.abs(quaternionLength(key.value) - 1) < 1e-10));

clip = addClipEvent(clip, { time: 0.5, type: 'marker', payload: { side: 'left', jointId: 'leftHand' }, eventId: 'event-left' });
clip = addClipContact(clip, { id: 'contact-left', jointId: 'leftFoot', start: 0.2, end: 1.4 });
assert.equal(clip.events.length, 1);
assert.equal(clip.contacts.length, 1);
let asset = serializeMotionClip(clip);
let roundTrip = importMotionClip(asset);
assert.equal(roundTrip.contacts[0].jointId, 'leftFoot');
assert.equal(roundTrip.events[0].payload.jointId, 'leftHand');
assert.equal(validateAnimationClip(roundTrip).valid, true);
roundTrip = removeClipEvent(roundTrip, 'event-left');
roundTrip = removeClipContact(roundTrip, 'contact-left');
assert.equal(roundTrip.events.length, 0);
assert.equal(roundTrip.contacts.length, 0);

const mirrored = mirrorAnimationClip(clip, { clipId: 'timeline-edit-right', name: 'Right Mirrored' });
assert.equal(mirrored.tracks[0].jointId, 'rightUpperArm');
assert.equal(mirrored.contacts[0].jointId, 'rightFoot');
assert.equal(mirrored.events[0].payload.side, 'right');
assert.equal(mirrored.events[0].payload.jointId, 'rightHand');
const mirroredTwice = mirrorAnimationClip(mirrored, { clipId: 'timeline-edit-double' });
for (let index = 0; index < clip.tracks[0].keyframes.length; index += 1) {
  assert.ok(quaternionAngularDistance(
    clip.tracks[0].keyframes[index].value,
    mirroredTwice.tracks[0].keyframes[index].value,
  ) < 1e-7);
}

let compressible = createEmptyClip({ clipId: 'compressible', duration: 1 });
compressible = upsertTrackKeyframe(compressible, { jointId: 'head', time: 0, value: quaternionFromEuler([0, 0, 0]), keyframeId: 'start' });
compressible = upsertTrackKeyframe(compressible, { jointId: 'head', time: 0.5, value: quaternionFromEuler([0.1, 0, 0]), keyframeId: 'middle' });
compressible = upsertTrackKeyframe(compressible, { jointId: 'head', time: 1, value: quaternionFromEuler([0.2, 0, 0]), keyframeId: 'end' });
const compressed = compressAnimationClip(compressible, { quaternionToleranceDegrees: 0.05 });
assert.equal(compressed.tracks[0].keyframes.length, 2);
assert.equal(compressed.metadata.compression.removed, 1);

let scaled = scaleClipTimeRange(clip, { start: 0, end: 2, scale: 1.5, anchor: 0 });
assert.equal(scaled.duration, 3);
assert.equal(scaled.tracks[0].keyframes.at(-1).time, 3);
assert.equal(scaled.events[0].time, 0.75);
assert.ok(Math.abs(scaled.contacts[0].end - 2.1) < 1e-12);

const poseA = {
  name: 'Local A',
  rootPosition: [0, 0, 0],
  localRotations: {
    hips: quaternionFromEuler([0, 0, 0]),
    head: quaternionFromEuler([0, 0, 0]),
  },
};
const poseB = {
  name: 'Local B',
  rootPosition: [0, 0.1, 0.2],
  localRotations: {
    hips: quaternionFromEuler([0.1, 0.2, 0]),
    head: quaternionFromEuler([0.4, 0, 0]),
  },
};
let poseClip = createEmptyClip({ clipId: 'local-pose-snapshots', duration: 1 });
poseClip = addPoseSnapshotKey(poseClip, { time: 0, pose: poseA, sourcePoseVersion: 'pose@0.4.0' });
poseClip = addPoseSnapshotKey(poseClip, { time: 1, pose: poseB, sourcePoseVersion: 'pose@0.4.0' });
assert.equal(poseClip.poseSnapshots[0].format, 'local-quaternion@1');
const localMid = samplePoseSnapshotClip(poseClip, 0.5);
assert.equal(localMid.format, 'local-quaternion@1');
assert.deepEqual(localMid.payload.root.position, [0, 0.05, 0.1]);
assert.ok(Math.abs(quaternionLength(localMid.payload.joints.head.rotation) - 1) < 1e-10);
assert.equal(validateAnimationClip(poseClip).valid, true);

let session = normalizeAnimationState({});
session = setAnimationLayer(session, 'upper-body', { enabled: true, weight: 0.65, mask: ['right_arm'] });
session = setGraphParameter(session, 'speed', 0.8);
assert.equal(session.layers.find((layer) => layer.layerId === 'upper-body').weight, 0.65);
assert.deepEqual(session.layers.find((layer) => layer.layerId === 'upper-body').mask, ['right_arm']);
assert.equal(session.graph.parameters.speed, 0.8);

asset = serializeMotionClip(mirrored);
assert.equal(asset.retarget_policy.mode, 'local_rotation');
assert.equal(asset.contacts[0].joint_id, 'rightFoot');
assert.equal(importMotionClip(asset).schema, 'humanoid_rig/animation_clip@0.4');

console.log('PASS animation keyframe editing, copy, move, delete, time scaling, compression, mirroring, contacts, events, local PoseSnapshot interpolation, layers, and MotionClip round-trip');
