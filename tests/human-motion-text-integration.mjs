import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createDefaultState } from '../src/default-state.js';
import {
  importMotionClip,
  normalizeAnimationState,
  sampleAnimationClip,
  serializeMotionClip,
  validateAnimationClip,
} from '../src/modules/animation/model.js';
import {
  buildAnimationPoseSnapshot,
} from '../src/modules/animation/index.js';
import {
  buildIncomingBoneLocalRotations,
  createRigContext,
  deriveLocalPoseFromV8Payload,
  forwardKinematics,
  sampleAnimationRuntime,
} from '../src/modules/animation/runtime.js';
import { quaternionAngularDistance } from '../src/modules/animation/quaternion.js';
import {
  commitTextMotion,
  parseMotionText,
  previewTextMotion,
} from '../src/modules/animation/text-motion/index.js';
import {
  applyPosePresetToDefinition,
  createStandardHumanoidPreset,
  diagnoseShoulderPose,
  normalizeSkeletonDefinition,
} from '../legacy/v8/src/skeleton-presets.js';
import {
  computePoseWorldPositions,
  getBoneLength,
} from '../legacy/v8/src/skeleton-model.js';
import { PhysicsRig } from '../legacy/v8/src/physics-rig.js';

const RIG_VERSION = 'rig@0.4.0';
const IDENTITY = [0, 0, 0, 1];
const LEG_JOINTS = [
  'leftUpperLeg', 'rightUpperLeg',
  'leftLowerLeg', 'rightLowerLeg',
  'leftFoot', 'rightFoot',
  'leftToes', 'rightToes',
];

function point(value) {
  if (!value) return null;
  return Array.isArray(value) ? [...value] : [Number(value.x), Number(value.y), Number(value.z)];
}

function distance(left, right) {
  const a = point(left);
  const b = point(right);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function range(values) {
  return Math.max(...values) - Math.min(...values);
}

function kneeFlexion(positions, hipId, kneeId, ankleId) {
  const hip = point(positions.get(hipId));
  const knee = point(positions.get(kneeId));
  const ankle = point(positions.get(ankleId));
  const toHip = [hip[0] - knee[0], hip[1] - knee[1], hip[2] - knee[2]];
  const toAnkle = [ankle[0] - knee[0], ankle[1] - knee[1], ankle[2] - knee[2]];
  const leftLength = Math.hypot(...toHip);
  const rightLength = Math.hypot(...toAnkle);
  const cosine = (toHip[0] * toAnkle[0] + toHip[1] * toAnkle[1] + toHip[2] * toAnkle[2])
    / Math.max(1e-12, leftLength * rightLength);
  return Math.PI - Math.acos(Math.max(-1, Math.min(1, cosine)));
}

function snapshotDefinition(definition) {
  return new Map(definition.joints.map((joint) => [joint.id, point(joint.poseWorldPosition)]));
}

function topology(definition) {
  return definition.joints.map(({ id, parentId }) => ({ id, parentId }));
}

function maximumSnapshotError(left, right) {
  return Math.max(...[...left.entries()].map(([jointId, value]) => distance(value, right.get(jointId))));
}

function assertBoneLengths(definition, expectedLengths) {
  const world = computePoseWorldPositions(definition);
  let maximum = 0;
  for (const joint of definition.joints) {
    if (!joint.parentId || joint.physicalBone === false) continue;
    maximum = Math.max(
      maximum,
      Math.abs(distance(world.get(joint.parentId), world.get(joint.id)) - expectedLengths.get(joint.id)),
    );
  }
  assert.ok(maximum < 1e-8, `integrated pose changed bone length by ${maximum} m`);
}

function poseRotation(frame, jointId) {
  return jointId === 'hips'
    ? frame.finalPose.root.rotation
    : frame.finalPose.joints[jointId]?.rotation || IDENTITY;
}

function contactFor(frame, jointId) {
  return frame.contacts.find((contact) => contact.jointId === jointId) || null;
}

function maxSupportDrift(frames, jointId) {
  const byCycle = new Map();
  for (const frame of frames) {
    const contact = contactFor(frame, jointId);
    if (!contact) continue;
    const samples = byCycle.get(contact.cycle ?? 0) || [];
    samples.push(frame.simulationRig.fk.positions.get(jointId));
    byCycle.set(contact.cycle ?? 0, samples);
  }
  return Math.max(0, ...[...byCycle.values()].map((samples) => {
    const anchor = samples[0];
    return Math.max(...samples.map((sample) => distance(anchor, sample)));
  }));
}

function assertTextPlan(result, expectedSkills) {
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.plan.steps.map((step) => step.skillId), expectedSkills);
  assert.ok(result.clip, 'text action plan did not compile an AnimationClip');
  assert.equal(validateAnimationClip(result.clip).valid, true);
}

// 1. T Pose shoulder symmetry, round trips, topology and bone lengths.
const definition = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
const initialTopology = topology(definition);
const initialAPose = snapshotDefinition(definition);
const initialLengths = new Map(definition.joints.map((joint) => [joint.id, getBoneLength(definition, joint.id)]));
applyPosePresetToDefinition(definition, 'T');
const tPoseDiagnostics = diagnoseShoulderPose(definition);
assert.ok(tPoseDiagnostics.upperArmHeightDifference < 0.005);
assert.ok(tPoseDiagnostics.upperArmDepthDifference < 0.005);
const initialTPose = snapshotDefinition(definition);
assertBoneLengths(definition, initialLengths);
applyPosePresetToDefinition(definition, 'REACH_LEFT');
applyPosePresetToDefinition(definition, 'T');
assert.ok(maximumSnapshotError(initialTPose, snapshotDefinition(definition)) < 1e-8, 'T → Reach → T drifted');
applyPosePresetToDefinition(definition, 'A');
assert.ok(maximumSnapshotError(initialAPose, snapshotDefinition(definition)) < 1e-8, 'A → T → A drifted');
assert.deepEqual(topology(definition), initialTopology, 'T Pose changed the skeleton hierarchy');

// 2. Walk uses both legs, contacts and +Z root motion.
const walkAnimation = normalizeAnimationState({ activeClipId: 'walk-forward' });
const walkClip = walkAnimation.clips.find((clip) => clip.clipId === 'walk-forward');
const walkFrames = Array.from({ length: 49 }, (_, index) => sampleAnimationRuntime(walkAnimation, {
  rawTime: walkClip.duration * index / 48,
  rigVersion: RIG_VERSION,
}));
for (const side of ['left', 'right']) {
  const thighId = `${side}UpperLeg`;
  const shinId = `${side}LowerLeg`;
  const footId = `${side}Foot`;
  const toeId = `${side}Toes`;
  assert.ok(range(walkFrames.map((frame) => quaternionAngularDistance(poseRotation(frame, thighId), IDENTITY))) > 0.15, `${side} thigh did not alternate`);
  assert.ok(range(walkFrames.map((frame) => quaternionAngularDistance(poseRotation(frame, shinId), IDENTITY))) > 0.12, `${side} knee did not flex`);
  assert.ok(walkFrames.some((frame) => Boolean(contactFor(frame, footId))), `${side} foot has no support phase`);
  assert.ok(walkFrames.some((frame) => !contactFor(frame, footId)), `${side} foot has no swing phase`);
  assert.ok(maxSupportDrift(walkFrames, footId) < 0.02, `${side} support foot drifted`);
  assert.ok(Math.min(...walkFrames.map((frame) => {
    const foot = point(frame.simulationRig.fk.positions.get(footId));
    const toes = point(frame.simulationRig.fk.positions.get(toeId));
    const direction = [toes[0] - foot[0], toes[1] - foot[1], toes[2] - foot[2]];
    const length = Math.hypot(...direction);
    return direction[2] / Math.max(1e-12, length);
  })) > 0, `${side} foot is facing backward`);
  assert.ok(range(walkFrames.map((frame) => kneeFlexion(
    frame.simulationRig.fk.positions,
    `${side}UpperLeg`,
    `${side}LowerLeg`,
    footId,
  ))) > 0.15, `${side} knee flexion range is too small`);
}
const rootDeltaZ = walkFrames.at(-1).finalPose.root.position[2] - walkFrames[0].finalPose.root.position[2];
assert.ok(rootDeltaZ > 0.6, 'Walk Forward did not move along +Z');
assert.equal(walkFrames.slice(1).filter((frame, index) => frame.finalPose.root.position[2] < walkFrames[index].finalPose.root.position[2] - 1e-9).length, 0);
assert.ok(Math.abs(rootDeltaZ - Number(walkClip.metadata.strideLength)) < 1e-8, 'Walk cycle stride is not continuous');
for (const jointId of LEG_JOINTS) {
  assert.ok(
    quaternionAngularDistance(poseRotation(walkFrames[0], jointId), poseRotation(walkFrames.at(-1), jointId)) < 1e-6,
    `${jointId} loop rotation is discontinuous`,
  );
}
const inPlaceAnimation = normalizeAnimationState({ activeClipId: 'walk-in-place' });
const inPlaceClip = inPlaceAnimation.clips.find((clip) => clip.clipId === 'walk-in-place');
const inPlaceEnd = sampleAnimationRuntime(inPlaceAnimation, { rawTime: inPlaceClip.duration, rigVersion: RIG_VERSION });
assert.ok(Math.abs(inPlaceEnd.finalPose.root.position[2]) < 1e-8, 'Walk In Place moved the root');

// 3. Animation Runtime → V8 payload → PoseSnapshot/PhysicsRig stays canonical.
const bridgeFrame = walkFrames[17];
const bridgeRig = createRigContext({}, { rigVersion: RIG_VERSION });
const decodedPose = deriveLocalPoseFromV8Payload(bridgeFrame.v8Payload, bridgeRig);
assert.ok(decodedPose, 'V8 payload could not be decoded into a local pose');
const decodedFk = forwardKinematics(decodedPose, bridgeRig);
for (const jointId of LEG_JOINTS) {
  assert.ok(
    distance(decodedFk.positions.get(jointId), bridgeFrame.simulationRig.fk.positions.get(jointId)) < 1e-8,
    `${jointId} FK differs after V8 round trip`,
  );
}
const incoming = buildIncomingBoneLocalRotations(bridgeFrame.simulationRig.fk, {
  rootJointId: 'hips',
  rootRotation: bridgeFrame.simulationRig.fk.rotations.get('hips'),
});
assert.equal(
  Object.keys(bridgeFrame.v8Payload.incomingBoneLocalRotations).length,
  Object.keys(incoming).length,
);
assert.ok(Object.keys(incoming).length >= 24, 'incoming bone rotations are unexpectedly sparse');
assert.ok(Object.values(incoming).every((rotation) => Math.abs(Math.hypot(...rotation) - 1) < 1e-8));
assert.ok(LEG_JOINTS.some((jointId) => quaternionAngularDistance(incoming[jointId], IDENTITY) > 1e-6));
const poseSnapshot = buildAnimationPoseSnapshot(
  bridgeFrame.finalPose,
  { activeVersions: { rig: RIG_VERSION } },
  bridgeFrame.v8Payload,
);
assert.equal(poseSnapshot.rotationConvention, 'incoming_bone_bind_delta_full_quaternion');
assert.equal(poseSnapshot.diagnostics.rotationDataCompleteness, 'full_quaternion');
assert.deepEqual(poseSnapshot.localRotations, bridgeFrame.v8Payload.incomingBoneLocalRotations);
const physicsDefinition = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
const physicsRig = new PhysicsRig(physicsDefinition, { groundEnabled: false, gravityEnabled: false });
physicsRig.applyPoseSnapshot(poseSnapshot, { project: false, applyConstraintSettings: false, preservePinTargets: false });
for (const jointId of LEG_JOINTS) {
  assert.ok(
    distance(physicsRig.getPoint(jointId), bridgeFrame.simulationRig.fk.positions.get(jointId)) < 1e-6,
    `${jointId} PoseSnapshot position differs in PhysicsRig`,
  );
}

// 4. Text commands compile into the existing AnimationSession and preserve layers.
const baseState = createDefaultState();
const command = '向前走三步，停下，向左转九十度，然后用右手敬礼。';
const intent = parseMotionText(command);
assert.deepEqual(intent.actions.map((action) => action.skillId), ['walk', 'stop', 'turn', 'salute']);
assert.equal(intent.actions[2].side, 'left');
assert.equal(intent.actions[2].angleDegrees, 90);
assert.equal(intent.actions[3].side, 'right');
assert.equal(intent.sequenceRelations.length, 3);
const generated = previewTextMotion(command, { state: baseState });
assertTextPlan(generated, ['walk', 'stop', 'turn', 'salute']);
assert.equal(generated.plan.steps[0].layer, 'base');
assert.equal(generated.plan.steps[2].parameters.side, 'left');
assert.equal(generated.plan.steps[2].parameters.angleDegrees, 90);
assert.equal(generated.plan.steps[3].layer, 'upper-body');
assert.ok(generated.plan.steps[1].startAfter.includes(generated.plan.steps[0].stepId));
assert.ok(generated.plan.steps[3].startAfter.includes(generated.plan.steps[2].stepId));

const parallel = previewTextMotion('慢慢向前走两米，同时向右观察。', { state: baseState });
assertTextPlan(parallel, ['walk', 'look']);
assert.equal(parallel.plan.parallelGroups.length, 1);
assert.equal(parallel.plan.steps[0].layer, 'base');
assert.equal(parallel.plan.steps[1].layer, 'head');
assert.equal(parallel.plan.steps[0].parameters.distanceMeters, 2);
assert.equal(parallel.plan.steps[0].parameters.speed, 'slow');
const unresolved = previewTextMotion('地勤人员弯腰检查左前方的发动机。', { state: baseState });
assertTextPlan(unresolved, ['bend', 'inspect']);
assert.deepEqual(unresolved.plan.unresolvedTargets, ['发动机']);

const originalSchemaVersion = baseState.schemaVersion;
const originalProjectId = baseState.projectId;
let transactionCount = 0;
let committedState = structuredClone(baseState);
const hub = {
  getState: () => structuredClone(committedState),
  transaction(mutator) {
    transactionCount += 1;
    const next = structuredClone(committedState);
    mutator(next);
    next.revision += 1;
    committedState = next;
    return structuredClone(next);
  },
};
const saved = commitTextMotion(hub, command);
assert.equal(transactionCount, 1);
assert.equal(saved.state.schemaVersion, originalSchemaVersion);
assert.equal(saved.state.projectId, originalProjectId);
assert.equal(saved.state.character.animation.textMotion.generatedClipId, saved.clip.clipId);
const importedGenerated = importMotionClip(serializeMotionClip(saved.clip));
assert.equal(validateAnimationClip(importedGenerated).valid, true);

// 5. Existing sessions, MotionClips and built-in skills remain compatible.
const legacySession = normalizeAnimationState({
  schema: 'humanoid_rig/animation_session@0.3',
  clip: 'wave',
  playing: false,
  time: 0.4,
});
assert.equal(legacySession.schema, 'humanoid_rig/animation_session@0.4');
assert.equal(legacySession.activeClipId, 'wave');
const legacyMotionAsset = JSON.parse(await readFile(
  new URL('../assets/animations/wave-right.motion.json', import.meta.url),
  'utf8',
));
assert.equal(validateAnimationClip(importMotionClip(legacyMotionAsset)).valid, true);
for (const clipId of ['wave', 'squat', 'head-nod']) {
  const animation = normalizeAnimationState({ activeClipId: clipId });
  const clip = animation.clips.find((candidate) => candidate.clipId === clipId);
  assert.ok(clip, `missing legacy built-in ${clipId}`);
  assert.equal(validateAnimationClip(clip).valid, true);
  const sample = sampleAnimationClip(clip, clip.duration * 0.5);
  assert.ok(Object.keys(sample.joints).length > 0, `${clipId} did not produce a pose sample`);
  const runtime = sampleAnimationRuntime(animation, { rawTime: clip.duration * 0.5, rigVersion: RIG_VERSION });
  assert.equal(runtime.activeClipId, clipId);
  assert.equal(runtime.simulationRig.fk.positions.size, 89);
}

console.log('PASS human motion and text integration: T Pose, locomotion, V8 bridge, text plans, and legacy compatibility');
