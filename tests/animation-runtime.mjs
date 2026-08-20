import assert from 'node:assert/strict';
import {
  getActiveClip,
  normalizeAnimationState,
  setActiveClip,
  setAnimationLayer,
  setGraphParameter,
} from '../src/modules/animation/model.js';
import {
  buildV8PosePayload,
  collectAnimationEvents,
  createIdentityAnimationPose,
  createRigContext,
  deriveLocalPoseFromV8Payload,
  diagnoseRetargetCompatibility,
  forwardKinematics,
  measureBoneLengthError,
  retargetAnimationClip,
  sampleAnimationRuntime,
} from '../src/modules/animation/runtime.js';
import { evaluateAnimationGraph } from '../src/modules/animation/graph.js';
import { quaternionAngularDistance } from '../src/modules/animation/quaternion.js';

const profiles = [
  {
    name: 'standard',
    value: {
      height: 1.795672,
      shoulderWidth: 0.42,
      hipWidth: 0.20,
      upperArmLength: 0.277218,
      forearmLength: 0.241402,
      thighLength: 0.425348,
      lowerLegLength: 0.403133,
    },
  },
  {
    name: 'short-arm-long-leg',
    value: {
      height: 1.72,
      shoulderWidth: 0.36,
      hipWidth: 0.23,
      upperArmLength: 0.22,
      forearmLength: 0.19,
      thighLength: 0.47,
      lowerLegLength: 0.44,
    },
  },
  {
    name: 'long-arm-short-leg',
    value: {
      height: 1.9,
      shoulderWidth: 0.50,
      hipWidth: 0.19,
      upperArmLength: 0.35,
      forearmLength: 0.31,
      thighLength: 0.38,
      lowerLegLength: 0.36,
    },
  },
];

const base = normalizeAnimationState({}, {
  compatibleRig: 'rig@0.4.0',
  targetProportionRevision: 7,
});
const playableIds = ['idle-breathe', 'wave', 'head-nod', 'squat', 'walk-in-place', 'walk-forward'];

for (const profile of profiles) {
  for (const clipId of playableIds) {
    const animation = normalizeAnimationState({ ...base, activeClipId: clipId });
    const clip = animation.clips.find((item) => item.clipId === clipId);
    for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
      const frame = sampleAnimationRuntime(animation, {
        rawTime: clip.duration * ratio,
        bodyProfile: profile.value,
        rigVersion: 'rig@0.4.0',
      });
      assert.equal(frame.v8Payload.schemaVersion, 2);
      assert.equal(frame.v8Payload.joints.length, 89, `${profile.name}/${clipId} joint count`);
      assert.equal(Object.keys(frame.v8Payload.localRotations).length, 89);
      assert.equal(frame.animationRig.fk.positions.size, 89);
      assert.equal(frame.simulationRig.fk.positions.size, 89);
      assert.ok(frame.v8Payload.joints.every((joint) => Object.values(joint.poseWorldPosition).every(Number.isFinite)));
      assert.ok(frame.diagnostics.maxBoneLengthError < 1e-9, `${profile.name}/${clipId} bone error ${frame.diagnostics.maxBoneLengthError}`);
    }
  }
}

const standardWave = sampleAnimationRuntime(normalizeAnimationState({ ...base, activeClipId: 'wave' }), {
  rawTime: 0.8,
  bodyProfile: profiles[0].value,
});
const longArmWave = sampleAnimationRuntime(normalizeAnimationState({ ...base, activeClipId: 'wave' }), {
  rawTime: 0.8,
  bodyProfile: profiles[2].value,
});
const standardHand = standardWave.fk.positions.get('rightHand');
const longArmHand = longArmWave.fk.positions.get('rightHand');
assert.ok(distance(standardHand, longArmHand) > 0.08, 'world hand path must follow the target bind proportions');
assert.deepEqual(
  standardWave.finalPose.joints.rightUpperArm.rotation,
  longArmWave.finalPose.joints.rightUpperArm.rotation,
  'the source local quaternion remains reusable across compatible proportions',
);

const shortWalk = sampleAnimationRuntime(normalizeAnimationState({ ...base, activeClipId: 'walk-forward' }), {
  rawTime: 1.8,
  bodyProfile: { height: 1.6 },
});
const tallWalk = sampleAnimationRuntime(normalizeAnimationState({ ...base, activeClipId: 'walk-forward' }), {
  rawTime: 1.8,
  bodyProfile: { height: 2.0 },
});
assert.ok(shortWalk.finalPose.root.position[2] > 0.5);
assert.ok(Math.abs(tallWalk.finalPose.root.position[2] / shortWalk.finalPose.root.position[2] - 1.25) < 0.02);
const inPlace = sampleAnimationRuntime(normalizeAnimationState({ ...base, activeClipId: 'walk-in-place' }), {
  rawTime: 1.8,
  bodyProfile: { height: 2.0 },
});
assert.ok(Math.abs(inPlace.finalPose.root.position[2]) < 1e-12);

for (const clipId of ['squat', 'walk-in-place', 'walk-forward']) {
  const animation = normalizeAnimationState({ ...base, activeClipId: clipId });
  const clip = animation.clips.find((item) => item.clipId === clipId);
  let maximum = 0;
  for (let index = 0; index <= 60; index += 1) {
    const frame = sampleAnimationRuntime(animation, {
      rawTime: clip.duration * index / 60,
      bodyProfile: profiles[0].value,
    });
    maximum = Math.max(maximum, frame.diagnostics.maxContactError);
  }
  assert.ok(maximum < 0.02, `${clipId} contact error ${maximum}`);
}

const exactAnimation = normalizeAnimationState({ ...base, activeClipId: 'wave' });
const identityPose = createIdentityAnimationPose();
const exact = sampleAnimationRuntime(exactAnimation, { rawTime: 0.8, bodyProfile: profiles[0].value });
const physical = sampleAnimationRuntime({
  ...exactAnimation,
  runtime: { ...exactAnimation.runtime, mode: 'physical_follow', followStiffness: 0.3, followDamping: 0.8 },
}, {
  rawTime: 0.8,
  bodyProfile: profiles[0].value,
  previousFinalPose: identityPose,
  deltaTime: 1 / 60,
});
assert.ok(quaternionAngularDistance(physical.finalPose.joints.rightUpperArm.rotation, exact.finalPose.joints.rightUpperArm.rotation) > 0.01);
const fullPhysics = sampleAnimationRuntime({
  ...exactAnimation,
  runtime: { ...exactAnimation.runtime, mode: 'full_physics' },
}, {
  rawTime: 0.8,
  bodyProfile: profiles[0].value,
  previousFinalPose: identityPose,
});
assert.deepEqual(fullPhysics.finalPose.root, identityPose.root);
assert.equal(fullPhysics.diagnostics.fullPhysicsRequiresPoseSolver, true);

let layered = normalizeAnimationState({ ...base, activeClipId: 'walk-in-place' });
const baseWalk = sampleAnimationRuntime(layered, { rawTime: 0.8, bodyProfile: profiles[0].value });
layered = setAnimationLayer(layered, 'upper-body', { enabled: true, clipId: 'wave', weight: 1 });
layered = setAnimationLayer(layered, 'breathing-additive', { enabled: true, clipId: 'idle-breathe', weight: 0.35 });
const mixed = sampleAnimationRuntime(layered, { rawTime: 0.8, bodyProfile: profiles[0].value });
assert.ok(quaternionAngularDistance(
  baseWalk.finalPose.joints.rightUpperArm.rotation,
  mixed.finalPose.joints.rightUpperArm.rotation,
) > 0.1);
assert.equal(mixed.diagnostics.layers.length, 3);

let graphAnimation = normalizeAnimationState({});
graphAnimation = setGraphParameter(graphAnimation, 'wave', true);
assert.equal(graphAnimation.graph.controlMode, 'graph');
let graphResult = evaluateAnimationGraph(graphAnimation, { nowMs: 1000, consumeTriggers: true });
assert.equal(graphResult.changed, true);
assert.equal(graphResult.startedTransition.toStateId, 'wave');
assert.equal(graphResult.animation.activeClipId, 'wave');
assert.equal(graphResult.animation.graph.parameters.wave, false);
graphResult = evaluateAnimationGraph(graphResult.animation, { nowMs: 1400, consumeTriggers: true });
assert.equal(graphResult.completedTransition.toStateId, 'wave');

const manualWave = setActiveClip(normalizeAnimationState({}), 'wave');
const manualGraphResult = evaluateAnimationGraph(manualWave, { nowMs: 5000, consumeTriggers: true });
assert.equal(manualGraphResult.changed, false, 'manual clip preview must not be consumed by graph transitions');
assert.equal(manualGraphResult.animation.activeClipId, 'wave');

const waveClip = base.clips.find((clip) => clip.clipId === 'wave');
const waveEvents = collectAnimationEvents(waveClip, 0, 3.3);
assert.ok(waveEvents.length >= 8);
assert.ok(waveEvents.some((event) => event.cycle === 1));

const rig = createRigContext(profiles[2].value, { rigVersion: 'rig@0.4.0' });
const compatibility = diagnoseRetargetCompatibility(waveClip, rig);
assert.equal(compatibility.compatible, true);
assert.equal(compatibility.unknownJoints.length, 0);
assert.ok(compatibility.rootMotionScale > 1);
const retargeted = retargetAnimationClip(base.clips.find((clip) => clip.clipId === 'walk-forward'), {
  targetRig: 'rig@0.4.0',
  targetProportionRevision: 77,
  targetBodyProfile: profiles[2].value,
});
assert.equal(retargeted.sourceProportionRevision, 77);
assert.equal(retargeted.compatibleRig, 'rig@0.4.0');
assert.ok(retargeted.tracks.find((track) => track.channel === 'position').keyframes.at(-1).value[2] > 0.72);

const roundTripPayload = buildV8PosePayload(standardWave.fk);
assert.equal(roundTripPayload.schemaVersion, 2);
assert.equal(Object.keys(roundTripPayload.localRotations).length, 89);
assert.ok(Object.values(roundTripPayload.localRotations).every((rotation) => (
  Math.abs(Math.hypot(...rotation) - 1) < 1e-10
)));
const derived = deriveLocalPoseFromV8Payload(roundTripPayload, createRigContext(profiles[0].value));
const rebuilt = forwardKinematics(derived, createRigContext(profiles[0].value));
assert.ok(measureBoneLengthError(rebuilt) < 1e-9);
let maxRoundTripError = 0;
for (const joint of roundTripPayload.joints) {
  const sourcePoint = [joint.poseWorldPosition.x, joint.poseWorldPosition.y, joint.poseWorldPosition.z];
  maxRoundTripError = Math.max(maxRoundTripError, distance(sourcePoint, rebuilt.positions.get(joint.id)));
}
assert.ok(maxRoundTripError < 1e-8, `world to local recording round trip ${maxRoundTripError}`);

const legacyWorldOnlyPayload = structuredClone(roundTripPayload);
legacyWorldOnlyPayload.schemaVersion = 1;
delete legacyWorldOnlyPayload.localRotations;
const legacyDerived = deriveLocalPoseFromV8Payload(legacyWorldOnlyPayload, createRigContext(profiles[0].value));
assert.ok(legacyDerived, 'Schema 1 world-position payload should retain its compatibility fallback.');
assert.equal(legacyDerived.metadata.approximation, 'single-child-orientation');

console.log('PASS 89-node dual-rig runtime, three target proportions, fixed bone lengths, root scaling, contacts, layers, graph transitions, physics modes, event cycles, and local-pose recording');

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
