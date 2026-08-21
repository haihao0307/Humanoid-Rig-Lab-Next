import assert from 'node:assert/strict';
import {
  ANIMATION_ASSET_CATEGORIES,
  getActiveClip,
  importMotionClip,
  normalizeClip,
  normalizeAnimationState,
  resolveSemanticMotionChannel,
  sampleAnimationClip,
  serializeMotionClip,
  setActiveClip,
  setAnimationLayer,
  setGraphParameter,
  validateAnimationAssetMetadata,
  validateAnimationClip,
  validateSemanticMotionChannels,
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
import {
  addVectors,
  multiplyQuaternions,
  quaternionAngularDistance,
  rotateVectorByQuaternion,
} from '../src/modules/animation/quaternion.js';

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

assert.deepEqual(ANIMATION_ASSET_CATEGORIES, [
  'idle', 'locomotion', 'jump', 'gesture', 'combat', 'interaction',
]);
const assetWaveClip = base.clips.find((clip) => clip.clipId === 'wave');
assert.equal(assetWaveClip.assetMetadata.type, 'AnimationAssetMetadata');
assert.equal(assetWaveClip.assetMetadata.category, 'gesture');
assert.equal(assetWaveClip.assetMetadata.compatibleRig, assetWaveClip.compatibleRig);
assert.ok(assetWaveClip.assetMetadata.requiredChains.includes('right_arm'));
const metadataClip = normalizeClip({
  ...structuredClone(assetWaveClip),
  assetMetadata: {
    ...structuredClone(assetWaveClip.assetMetadata),
    tags: ['mixamo-style', 'upper-body'],
    mirrorSupport: true,
  },
});
const savedMetadataClip = importMotionClip(serializeMotionClip(metadataClip));
assert.deepEqual(savedMetadataClip.assetMetadata, metadataClip.assetMetadata, 'AnimationAssetMetadata must survive MotionClip save/import');
assert.deepEqual(savedMetadataClip.semanticChannels, metadataClip.semanticChannels, 'semantic channels must survive MotionClip save/import');
assert.deepEqual(savedMetadataClip.assetMetadata.tags, ['mixamo-style', 'upper-body']);
assert.equal(validateAnimationAssetMetadata(savedMetadataClip.assetMetadata, { clip: savedMetadataClip }).valid, true);
assert.equal(validateAnimationClip(savedMetadataClip).valid, true);
assert.equal(validateAnimationAssetMetadata({
  ...savedMetadataClip.assetMetadata,
  category: 'dance',
}).valid, false, 'unsupported asset categories must be rejected');

const rightArmSemantic = resolveSemanticMotionChannel('rightArmSwing', { clip: assetWaveClip });
assert.equal(rightArmSemantic.joints.upper, 'rightUpperArm');
assert.equal(rightArmSemantic.joints.lower, 'rightLowerArm');
assert.equal(rightArmSemantic.joints.hand, 'rightHand');
assert.deepEqual(
  rightArmSemantic.tracks.map((track) => track.trackId),
  ['rightUpperArm:rotation', 'rightLowerArm:rotation', 'rightHand:rotation'],
);
const mappedRightArmSemantic = resolveSemanticMotionChannel('rightArmSwing', {
  jointMap: { rightUpperArm: 'mixamoRightArm', rightLowerArm: 'mixamoRightForeArm' },
});
assert.equal(mappedRightArmSemantic.joints.upper, 'mixamoRightArm');
assert.equal(mappedRightArmSemantic.joints.lower, 'mixamoRightForeArm');
const walkAssetClip = base.clips.find((clip) => clip.clipId === 'walk-forward');
const footContactSemantic = resolveSemanticMotionChannel('footContact', { clip: walkAssetClip });
assert.deepEqual(footContactSemantic.jointIds, ['leftFoot', 'rightFoot']);
assert.equal(footContactSemantic.contacts.length, 2);
assert.equal(resolveSemanticMotionChannel('bodyLean').joints.lower, 'spine');
assert.equal(validateSemanticMotionChannels(assetWaveClip.semanticChannels, { clip: assetWaveClip }).valid, true);
assert.equal(validateSemanticMotionChannels([{ channelId: 'unknown-motion', semantic: 'unknownMotion' }]).valid, false);

const legacyRotationClip = structuredClone(assetWaveClip);
delete legacyRotationClip.assetMetadata;
delete legacyRotationClip.semanticChannels;
const legacyRotationTracks = structuredClone(legacyRotationClip.tracks);
const normalizedLegacyRotationClip = normalizeClip(legacyRotationClip);
assert.deepEqual(normalizedLegacyRotationClip.tracks, legacyRotationTracks, 'legacy rotationTrack data must remain byte-for-byte equivalent after normalization');
assert.deepEqual(
  sampleAnimationClip(normalizedLegacyRotationClip, 0.8),
  sampleAnimationClip(assetWaveClip, 0.8),
  'semantic metadata must not alter legacy rotationTrack sampling',
);

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

const standardRestFk = forwardKinematics(createIdentityAnimationPose(), createRigContext(profiles[0].value));
const restPoint = (jointId) => standardRestFk.positions.get(jointId);
const sampledPoint = (clipId, rawTime, jointId) => sampleAnimationRuntime(
  normalizeAnimationState({ ...base, activeClipId: clipId }),
  { rawTime, bodyProfile: profiles[0].value },
).fk.positions.get(jointId);

const waveRaised = sampleAnimationRuntime(normalizeAnimationState({ ...base, activeClipId: 'wave' }), {
  rawTime: 0.65,
  bodyProfile: profiles[0].value,
});
const waveOutward = sampleAnimationRuntime(normalizeAnimationState({ ...base, activeClipId: 'wave' }), {
  rawTime: 0.95,
  bodyProfile: profiles[0].value,
});
assert.ok(
  waveRaised.fk.positions.get('rightHand')[1] > waveRaised.fk.positions.get('rightUpperArm')[1] + 0.35,
  'right-hand wave must raise the hand above the shoulder instead of driving it downward',
);
assert.ok(
  waveOutward.fk.positions.get('rightHand')[0] > waveRaised.fk.positions.get('rightHand')[0] + 0.08,
  'right-hand wave must contain a visible inward/outward lateral sweep',
);
assert.ok(
  distance(waveRaised.fk.positions.get('leftHand'), restPoint('leftHand')) < 1e-10,
  'right-hand wave must not move the opposite arm',
);

const nodDown = sampledPoint('head-nod', 0.35, 'headTop');
const nodUp = sampledPoint('head-nod', 0.70, 'headTop');
assert.ok(nodDown[2] > restPoint('headTop')[2] + 0.06, 'nod-down must move the head toward +Z forward');
assert.ok(nodUp[2] < restPoint('headTop')[2] - 0.06, 'nod-up rebound must move opposite the forward nod');

const squatBottom = sampleAnimationRuntime(normalizeAnimationState({ ...base, activeClipId: 'squat' }), {
  rawTime: 1.05,
  bodyProfile: profiles[0].value,
});
assert.ok(squatBottom.fk.positions.get('hips')[1] < restPoint('hips')[1] - 0.24, 'squat must lower the pelvis');
assert.ok(squatBottom.fk.positions.get('headTop')[2] > restPoint('headTop')[2] + 0.12, 'squat torso must incline toward +Z forward');
assert.ok(squatBottom.fk.positions.get('leftLowerLeg')[2] > restPoint('leftLowerLeg')[2] + 0.22, 'left knee must bend forward');
assert.ok(squatBottom.fk.positions.get('rightLowerLeg')[2] > restPoint('rightLowerLeg')[2] + 0.22, 'right knee must bend forward');
assert.ok(squatBottom.fk.positions.get('leftHand')[2] > restPoint('leftHand')[2] + 0.35, 'squat left arm must counterbalance forward');
assert.ok(squatBottom.fk.positions.get('rightHand')[2] > restPoint('rightHand')[2] + 0.35, 'squat right arm must counterbalance forward');
assert.ok(distance(squatBottom.fk.positions.get('leftFoot'), restPoint('leftFoot')) < 0.01, 'left support foot must remain planted');
assert.ok(distance(squatBottom.fk.positions.get('rightFoot'), restPoint('rightFoot')) < 0.01, 'right support foot must remain planted');
assert.ok(distance(squatBottom.fk.positions.get('leftToesEnd'), restPoint('leftToesEnd')) < 0.08, 'left planted foot orientation must not reverse');
assert.ok(distance(squatBottom.fk.positions.get('rightToesEnd'), restPoint('rightToesEnd')) < 0.08, 'right planted foot orientation must not reverse');

for (const clipId of ['walk-in-place', 'walk-forward']) {
  const firstStride = sampleAnimationRuntime(normalizeAnimationState({ ...base, activeClipId: clipId }), {
    rawTime: 0,
    bodyProfile: profiles[0].value,
  });
  const oppositeStride = sampleAnimationRuntime(normalizeAnimationState({ ...base, activeClipId: clipId }), {
    rawTime: 0.6,
    bodyProfile: profiles[0].value,
  });
  assert.ok(firstStride.fk.positions.get('leftFoot')[2] > firstStride.fk.positions.get('rightFoot')[2] + 0.5, `${clipId} left-leading phase`);
  assert.ok(oppositeStride.fk.positions.get('rightFoot')[2] > oppositeStride.fk.positions.get('leftFoot')[2] + 0.5, `${clipId} right-leading phase`);
  assert.ok(firstStride.fk.positions.get('rightHand')[2] > firstStride.fk.positions.get('leftHand')[2] + 0.3, `${clipId} counter-swing at left lead`);
  assert.ok(oppositeStride.fk.positions.get('leftHand')[2] > oppositeStride.fk.positions.get('rightHand')[2] + 0.3, `${clipId} counter-swing at right lead`);
  for (const frame of [firstStride, oppositeStride]) {
    assert.ok(frame.fk.positions.get('leftHand')[0] < 0, `${clipId} left arm must remain on the left chain`);
    assert.ok(frame.fk.positions.get('rightHand')[0] > 0, `${clipId} right arm must remain on the right chain`);
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
assert.ok(Object.keys(roundTripPayload.incomingBoneLocalRotations).length >= 50);
assert.equal(
  roundTripPayload.rotationConventions.incomingBoneLocalRotations,
  'incoming_bone_bind_delta_zero_twist',
);
const incomingChildren = new Map();
for (const joint of standardWave.fk.rig.joints) {
  if (!joint.parentId || !joint.physicalBone || joint.isControl) continue;
  const list = incomingChildren.get(joint.parentId) ?? [];
  list.push(joint);
  incomingChildren.set(joint.parentId, list);
}
const incomingPositions = new Map([['hips', standardWave.fk.positions.get('hips')]]);
const incomingWorldRotations = new Map([['hips', standardWave.fk.rotations.get('hips')]]);
const rebuildIncoming = (parentId) => {
  for (const child of incomingChildren.get(parentId) ?? []) {
    const worldRotation = multiplyQuaternions(
      incomingWorldRotations.get(parentId),
      roundTripPayload.incomingBoneLocalRotations[child.id],
    );
    incomingWorldRotations.set(child.id, worldRotation);
    incomingPositions.set(
      child.id,
      addVectors(
        incomingPositions.get(parentId),
        rotateVectorByQuaternion(child.localPosition, worldRotation),
      ),
    );
    rebuildIncoming(child.id);
  }
};
rebuildIncoming('hips');
let maximumIncomingAdapterError = 0;
for (const [jointId, position] of incomingPositions) {
  maximumIncomingAdapterError = Math.max(
    maximumIncomingAdapterError,
    distance(position, standardWave.fk.positions.get(jointId)),
  );
}
assert.ok(maximumIncomingAdapterError < 1e-8, `incoming-bone adapter error ${maximumIncomingAdapterError}`);
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

console.log('PASS AnimationAssetMetadata, semantic motion channels, legacy rotationTrack compatibility, 89-node dual-rig runtime, three target proportions, fixed bone lengths, contacts, layers, graph transitions, and local-pose recording');

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
