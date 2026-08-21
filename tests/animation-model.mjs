import assert from 'node:assert/strict';
import {
  addClipContact,
  addClipEvent,
  addPoseSnapshotKey,
  computeTransportRawTime,
  computeTransportTime,
  compressAnimationClip,
  copyTrackKeyframes,
  createEmptyClip,
  createWaveRightClip,
  deleteTrackKeyframes,
  getActiveClip,
  getEventsBetween,
  importMotionClip,
  mirrorAnimationClip,
  moveTrackKeyframes,
  normalizeAnimationState,
  removeNearestPoseSnapshotKey,
  resolveTransportPlaybackStart,
  resolveClipPhase,
  resolveClipTime,
  sampleAnimationClip,
  samplePoseSnapshotClip,
  serializeMotionClip,
  setActiveClip,
  setAnimationLayer,
  setTransport,
  upsertTrackKeyframe,
  validateAnimationClip,
} from '../src/modules/animation/model.js';
import {
  ensureQuaternionContinuity,
  normalizeQuaternion,
  quaternionDot,
  quaternionLength,
  slerpQuaternion,
} from '../src/modules/animation/quaternion.js';

const identity = [0, 0, 0, 1];
const legacyState = {
  clip: 'idle-breathe',
  playing: false,
  time: 0.5,
  duration: 3.2,
  speed: 1,
  loop: true,
  keyframes: [{
    id: 'legacy-key-1',
    time: 0.5,
    poseName: 'Legacy A Pose',
    pose: { hips: { x: 0, y: 0.5 } },
    sourcePoseVersion: 'pose@0.3.1',
  }],
};

const migrated = normalizeAnimationState(legacyState, {
  compatibleRig: 'rig@0.4.0',
  sourcePoseVersion: 'pose@0.3.1',
  targetProportionRevision: 3,
});
assert.equal(migrated.schema, 'humanoid_rig/animation_session@0.4');
assert.equal(migrated.clips.length, 7);
assert.equal(migrated.layers.length, 3);
assert.equal(migrated.graph.states.length, 4);
assert.equal(migrated.runtime.mode, 'exact');
assert.equal(migrated.retarget.targetProportionRevision, 3);
assert.equal(migrated.activeClipId, 'idle-breathe');
assert.equal(getActiveClip(migrated).poseKeys.length, 1);
assert.equal(getActiveClip(migrated).poseSnapshots[0].format, 'preview-2d@1');
assert.equal(legacyState.keyframes[0].snapshotId, undefined, 'normalization must not mutate legacy input');
for (const clip of migrated.clips) {
  const report = validateAnimationClip(clip);
  assert.equal(report.valid, true, `${clip.clipId}: ${report.errors.join(', ')}`);
}

const wave = createWaveRightClip({ compatibleRig: 'rig@0.4.0' });
const waveReport = validateAnimationClip(wave);
assert.equal(waveReport.valid, true, waveReport.errors.join(', '));
assert.equal(waveReport.stats.tracks, 3);
assert.equal(waveReport.stats.keyframes, 18);
assert.equal(wave.events.length, 4);
assert.ok(wave.tracks.every((track) => track.space === 'local'));
assert.ok(wave.tracks.every((track) => track.interpolation === 'slerp'));

const midWave = sampleAnimationClip(wave, 0.8);
assert.ok(midWave.joints.rightUpperArm);
assert.ok(midWave.joints.rightLowerArm);
assert.ok(midWave.joints.rightHand);
assert.ok(Math.abs(quaternionLength(midWave.joints.rightHand.rotation) - 1) < 1e-10);

const serializedWave = serializeMotionClip(wave);
assert.equal(serializedWave.schema, 'humanoid_rig/motion_clip@1.0');
assert.equal(serializedWave.tracks[0].joint_id, 'rightUpperArm');
assert.equal(serializedWave.tracks[0].channel, 'rotation');
assert.equal(serializedWave.events.length, 4);
const importedWave = importMotionClip(serializedWave);
assert.equal(validateAnimationClip(importedWave).valid, true);
assert.deepEqual(sampleAnimationClip(importedWave, 0.8), midWave);

const q = normalizeQuaternion([0, 0, 0, 2]);
assert.deepEqual(q, identity);
const halfway = slerpQuaternion(identity, [0, 1, 0, 0], 0.5);
assert.ok(Math.abs(quaternionLength(halfway) - 1) < 1e-12);
assert.ok(Math.abs(halfway[1] - Math.SQRT1_2) < 1e-6);
assert.ok(Math.abs(halfway[3] - Math.SQRT1_2) < 1e-6);
const shortest = slerpQuaternion(identity, [0, 0, 0, -1], 0.5);
assert.ok(Math.abs(Math.abs(shortest[3]) - 1) < 1e-12);
const continuous = ensureQuaternionContinuity([identity, [0, 0, 0, -1], [0, 1, 0, 0]]);
assert.ok(quaternionDot(continuous[0], continuous[1]) >= 0);
assert.ok(quaternionDot(continuous[1], continuous[2]) >= 0);

let editable = createEmptyClip({ clipId: 'edit-test', duration: 2, compatibleRig: 'rig@0.4.0' });
editable = upsertTrackKeyframe(editable, { jointId: 'rightUpperArm', time: 1, value: [0, 0.5, 0, 0.5] });
editable = upsertTrackKeyframe(editable, { jointId: 'rightUpperArm', time: 0, value: identity });
const firstKeyId = editable.tracks[0].keyframes[1].id;
editable = upsertTrackKeyframe(editable, { jointId: 'rightUpperArm', time: 1, value: [0, 1, 0, 0] });
assert.equal(editable.tracks[0].keyframes.length, 2);
assert.equal(editable.tracks[0].keyframes[1].id, firstKeyId, 'upsert must preserve keyframe identity');
assert.deepEqual(editable.tracks[0].keyframes.map((key) => key.time), [0, 1]);
assert.ok(Math.abs(quaternionLength(editable.tracks[0].keyframes[1].value) - 1) < 1e-12);

editable = copyTrackKeyframes(editable, {
  trackId: 'rightUpperArm:rotation',
  keyframeIds: [editable.tracks[0].keyframes[1].id],
  deltaTime: 0.5,
});
assert.deepEqual(editable.tracks[0].keyframes.map((key) => key.time), [0, 1, 1.5]);
const copiedId = editable.tracks[0].keyframes.at(-1).id;
editable = moveTrackKeyframes(editable, {
  trackId: 'rightUpperArm:rotation',
  keyframeIds: [copiedId],
  deltaTime: 0.25,
});
assert.equal(editable.tracks[0].keyframes.at(-1).time, 1.75);
editable = deleteTrackKeyframes(editable, {
  trackId: 'rightUpperArm:rotation',
  keyframeIds: [copiedId],
});
assert.deepEqual(editable.tracks[0].keyframes.map((key) => key.time), [0, 1]);
assert.equal(validateAnimationClip(editable).valid, true);

const mirrored = mirrorAnimationClip(wave);
assert.equal(mirrored.clipId, 'wave-mirrored');
assert.ok(mirrored.tracks.some((track) => track.jointId === 'leftUpperArm'));
assert.equal(validateAnimationClip(mirrored).valid, true);
const dense = structuredClone(wave);
dense.tracks[0].keyframes.splice(2, 0, {
  id: 'redundant-mid',
  time: 0.8,
  value: slerpQuaternion(dense.tracks[0].keyframes[1].value, dense.tracks[0].keyframes[2].value, 0.5),
  sourceSnapshotId: null,
});
const compressed = compressAnimationClip(dense, { quaternionToleranceDegrees: 0.5 });
assert.ok(compressed.tracks[0].keyframes.length < dense.tracks[0].keyframes.length);

const invalidPosition = structuredClone(editable);
invalidPosition.tracks.push({
  trackId: 'leftHand:position',
  jointId: 'leftHand',
  channel: 'position',
  space: 'local',
  interpolation: 'linear',
  keyframes: [{ id: 'bad-position', time: 0, value: [0, 0, 0] }],
});
const invalidPositionReport = validateAnimationClip(invalidPosition);
assert.equal(invalidPositionReport.valid, false);
assert.ok(invalidPositionReport.errors.some((error) => error.startsWith('NON_ROOT_POSITION_TRACK')));

const invalidScale = structuredClone(editable);
invalidScale.tracks.push({
  trackId: 'hips:scale',
  jointId: 'hips',
  channel: 'scale',
  space: 'local',
  interpolation: 'linear',
  keyframes: [{ id: 'bad-scale', time: 0, value: [1, 1, 1] }],
});
const invalidScaleReport = validateAnimationClip(invalidScale);
assert.equal(invalidScaleReport.valid, false);
assert.ok(invalidScaleReport.errors.some((error) => error.startsWith('CHANNEL_FORBIDDEN')));

const poseA = {
  name: 'Pose A',
  pinned: ['leftFoot'],
  v8Payload: {
    schemaVersion: 1,
    type: 'humanoid-pose',
    rigName: 'Test Rig',
    pose: 'CUSTOM',
    unit: 'meter',
    updatedAt: '2026-08-19T00:00:00.000Z',
    joints: [
      { id: 'hips', poseWorldPosition: { x: 0, y: 1, z: 0 }, pinned: false },
      { id: 'rightHand', poseWorldPosition: { x: 0.4, y: 1.2, z: 0 }, pinned: false },
    ],
  },
};
const poseB = {
  name: 'Pose B',
  pinned: ['leftFoot'],
  v8Payload: {
    schemaVersion: 1,
    type: 'humanoid-pose',
    rigName: 'Test Rig',
    pose: 'CUSTOM',
    unit: 'meter',
    updatedAt: '2026-08-19T00:00:01.000Z',
    joints: [
      { id: 'hips', poseWorldPosition: { x: 0, y: 1, z: 0 }, pinned: false },
      { id: 'rightHand', poseWorldPosition: { x: 0.8, y: 1.6, z: 0.2 }, pinned: false },
    ],
  },
};

let poseClip = createEmptyClip({ clipId: 'pose-ref-test', duration: 1, compatibleRig: 'rig@0.4.0' });
poseClip = addPoseSnapshotKey(poseClip, { time: 1, pose: poseB, sourcePoseVersion: 'pose@0.3.1' });
poseClip = addPoseSnapshotKey(poseClip, { time: 0, pose: poseA, sourcePoseVersion: 'pose@0.3.1' });
assert.deepEqual(poseClip.poseKeys.map((key) => key.time), [0, 1]);
assert.equal(poseClip.poseSnapshots.length, 2);
const poseMid = samplePoseSnapshotClip(poseClip, 0.5);
assert.equal(poseMid.format, 'v8-world-position@1');
const rightHandMid = poseMid.payload.payload.joints.find((joint) => joint.id === 'rightHand');
assert.deepEqual(rightHandMid.poseWorldPosition, { x: 0.6000000000000001, y: 1.4, z: 0.1 });

poseClip = addPoseSnapshotKey(poseClip, { time: 0.5, pose: poseA, sourcePoseVersion: 'pose@0.3.1' });
assert.equal(poseClip.poseSnapshots.length, 2, 'same source snapshot must be de-duplicated');
const poseASnapshotId = poseClip.poseKeys.find((key) => key.time === 0)?.snapshotId;
poseClip = upsertTrackKeyframe(poseClip, {
  jointId: 'rightHand',
  time: 0,
  value: identity,
  sourceSnapshotId: poseASnapshotId,
});
poseClip = removeNearestPoseSnapshotKey(poseClip, 0);
assert.equal(poseClip.poseKeys.some((key) => key.time === 0), false);
assert.equal(poseClip.poseSnapshots.some((snapshot) => snapshot.snapshotId === poseASnapshotId), true);
assert.equal(validateAnimationClip(poseClip).valid, true);

poseClip = addClipEvent(poseClip, { time: 0.2, type: 'gesture_start' });
poseClip = addClipEvent(poseClip, { time: 0.8, type: 'gesture_end' });
poseClip = addClipContact(poseClip, { jointId: 'leftFoot', start: 0.1, end: 0.6 });
assert.equal(poseClip.contacts.length, 1);
assert.equal(getEventsBetween(poseClip, 0.1, 0.5).length, 1);
assert.equal(getEventsBetween(poseClip, 0.7, 0.3, { loopMode: 'repeat' }).length, 2);

assert.equal(resolveClipTime(2.25, 1, 'repeat'), 0.25);
assert.equal(resolveClipTime(1.25, 1, 'pingpong'), 0.75);
assert.deepEqual(resolveClipPhase(2.25, 1, 'repeat'), { time: 0.25, cycles: 2, direction: 1, rawTime: 2.25 });
assert.equal(resolveClipTime(-0.2, 1, 'once'), 0);
assert.equal(resolveClipTime(1.2, 1, 'once'), 1);

let transportState = normalizeAnimationState({
  clips: [createEmptyClip({ clipId: 'transport', duration: 2, loopMode: 'repeat' })],
  activeClipId: 'transport',
  transport: { playing: false, time: 0.25, rawTime: 0.25, speed: 1, loop: true },
});
transportState = setTransport(transportState, {
  playing: true,
  time: 0.25,
  anchorTime: 0.25,
  anchorRawTime: 0.25,
  anchorIssuedAt: 1000,
  speed: 2,
}, 1000);
assert.equal(computeTransportRawTime(transportState, 1500), 1.25);
assert.equal(computeTransportTime(transportState, 1500), 1.25);
assert.equal(computeTransportTime(transportState, 2000), 0.25);
transportState = setTransport(transportState, { playing: false }, 2250);
assert.equal(transportState.transport.playing, false);
assert.equal(transportState.playing, false);

let oneShot = setActiveClip(migrated, 'squat');
assert.equal(oneShot.graph.controlMode, 'clip');
assert.equal(oneShot.graph.activeStateId, 'idle', 'manual clip selection must not overwrite the state-machine state');
assert.equal(oneShot.transport.loop, false);
oneShot = setTransport(oneShot, {
  playing: false,
  time: getActiveClip(oneShot).duration,
  anchorRawTime: getActiveClip(oneShot).duration,
});
assert.deepEqual(resolveTransportPlaybackStart(oneShot), { time: 0, rawTime: 0, restarted: true });
oneShot = setTransport(oneShot, {
  speed: -1,
  time: 0,
  anchorRawTime: 0,
});
assert.deepEqual(resolveTransportPlaybackStart(oneShot), {
  time: getActiveClip(oneShot).duration,
  rawTime: getActiveClip(oneShot).duration,
  restarted: true,
});
const zeroSpeed = setTransport(oneShot, { speed: 0, time: 0.4, anchorRawTime: 0.4 });
assert.equal(zeroSpeed.transport.speed, 0, 'the visible zero-speed control value must not normalize back to 1');

const layered = setAnimationLayer(migrated, 'upper-body', { enabled: true, weight: 0.75, clipId: 'wave' });
assert.equal(layered.layers.find((layer) => layer.layerId === 'upper-body').weight, 0.75);

console.log('PASS animation session 0.4, local quaternion tracks, editing, loops, events, contacts, layers, PoseSnapshot references, and MotionClip round-trip');
