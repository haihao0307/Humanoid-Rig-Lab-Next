import assert from 'node:assert/strict';

import {
  buildAnimationPoseSnapshot,
} from '../src/modules/animation/index.js';
import {
  normalizeAnimationState,
} from '../src/modules/animation/model.js';
import {
  buildIncomingBoneLocalRotations,
  createRigContext,
  forwardKinematics,
  sampleAnimationRuntime,
  sampleClipPose,
} from '../src/modules/animation/runtime.js';
import { quaternionAngularDistance } from '../src/modules/animation/quaternion.js';
import { computePoseWorldPositions } from '../legacy/v8/src/skeleton-model.js';
import { createStandardHumanoidPreset, normalizeSkeletonDefinition } from '../legacy/v8/src/skeleton-presets.js';
import { PhysicsRig } from '../legacy/v8/src/physics-rig.js';

const WALK_CLIP_ID = 'walk-forward';
const RIG_VERSION = 'rig@0.4.0';
const BODY_PROFILE = {};
const BODY_PROFILES = [
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
const CHECKPOINT_TIMES = [0, 0.15, 0.30, 0.45, 0.60, 0.75, 0.90, 1.05, 1.20];
const SAMPLE_COUNT = 121;
const LEG_JOINTS = [
  'leftUpperLeg', 'rightUpperLeg',
  'leftLowerLeg', 'rightLowerLeg',
  'leftFoot', 'rightFoot',
  'leftToes', 'rightToes',
];
const LEG_FOOT_PAIRS = [
  ['leftFoot', 'leftToes', 'leftUpperLeg', 'leftLowerLeg'],
  ['rightFoot', 'rightToes', 'rightUpperLeg', 'rightLowerLeg'],
];

const animation = normalizeAnimationState({ activeClipId: WALK_CLIP_ID });
const clip = animation.clips.find((item) => item.clipId === WALK_CLIP_ID);

assert.ok(clip, `Missing ${WALK_CLIP_ID} built-in clip.`);

function pointFromMap(map, jointId) {
  const value = map.get(jointId);
  return value ? [...value] : null;
}

function pointFromPayload(payload, jointId) {
  const joint = payload.joints.find((item) => item.id === jointId);
  return joint
    ? [joint.poseWorldPosition.x, joint.poseWorldPosition.y, joint.poseWorldPosition.z]
    : null;
}

function rotationFromPose(pose, jointId) {
  if (jointId === 'hips') return [...pose.root.rotation];
  return [...(pose.joints[jointId]?.rotation || [0, 0, 0, 1])];
}

function rotationMagnitude(rotation) {
  return quaternionAngularDistance(rotation, [0, 0, 0, 1]);
}

function distance(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function vector(a, b) {
  return [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
}

function length(value) {
  return Math.hypot(value[0], value[1], value[2]);
}

function normalize(value) {
  const magnitude = length(value);
  return magnitude > 1e-12 ? value.map((item) => item / magnitude) : [0, 0, 0];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function range(values) {
  return values.length ? Math.max(...values) - Math.min(...values) : 0;
}

function pathLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += distance(points[index - 1], points[index]);
  return total;
}

function finiteMean(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function finiteMax(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? Math.max(...valid) : 0;
}

function makePoseSnapshot(frame) {
  return buildAnimationPoseSnapshot(
    frame.finalPose,
    { activeVersions: { rig: RIG_VERSION } },
    frame.v8Payload,
  );
}

function applyToV8(frame) {
  const definition = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
  const physicsRig = new PhysicsRig(definition, {
    groundEnabled: false,
    gravityEnabled: false,
  });
  physicsRig.applyPoseSnapshot(makePoseSnapshot(frame), {
    project: false,
    applyConstraintSettings: false,
    preservePinTargets: false,
  });
  const definitionPositions = computePoseWorldPositions(definition);
  return {
    physicsPositions: new Map(LEG_JOINTS.map((jointId) => [jointId, physicsRig.getPoint(jointId)])),
    definitionPositions: new Map(LEG_JOINTS.map((jointId) => [jointId, definitionPositions.get(jointId)])),
  };
}

function kneeFlexion(positions, hipId, kneeId, ankleId) {
  const hip = positions.get(hipId);
  const knee = positions.get(kneeId);
  const ankle = positions.get(ankleId);
  if (!hip || !knee || !ankle) return 0;
  const toHip = normalize(vector(knee, hip));
  const toAnkle = normalize(vector(knee, ankle));
  return Math.PI - Math.acos(Math.max(-1, Math.min(1, dot(toHip, toAnkle))));
}

function contactFor(frame, jointId) {
  return frame.contacts.some((contact) => contact.jointId === jointId);
}

function makeCheckpoint(frame, rawTime, animationFk, incoming, v8Positions, activeClip, context, rootMotionEnabled) {
  const snapshot = makePoseSnapshot(frame);
  const entry = {
    rawTime,
    A_sampleClipLocalRotations: Object.fromEntries(
      LEG_JOINTS.map((jointId) => [jointId, rotationFromPose(sampleClipPose(activeClip, rawTime, {
        targetBodyHeight: context.bodyHeight,
        rootMotionEnabled,
      }), jointId)]),
    ),
    B_animationFk: Object.fromEntries(LEG_JOINTS.map((jointId) => [jointId, pointFromMap(animationFk.positions, jointId)])),
    C_incomingBoneLocalRotations: Object.fromEntries(LEG_JOINTS.map((jointId) => [jointId, incoming[jointId]])),
    D_v8PayloadWorldPositions: Object.fromEntries(LEG_JOINTS.map((jointId) => [jointId, pointFromPayload(frame.v8Payload, jointId)])),
    E_poseSnapshotLocalRotations: Object.fromEntries(LEG_JOINTS.map((jointId) => [jointId, snapshot.localRotations[jointId]])),
    F_physicsRigWorldPositions: Object.fromEntries(LEG_JOINTS.map((jointId) => [jointId, v8Positions.get(jointId)])),
    rotationLossFromSampleToFinal: Object.fromEntries(LEG_JOINTS.map((jointId) => [
      jointId,
      quaternionAngularDistance(
        rotationFromPose(sampleClipPose(activeClip, rawTime, {
          targetBodyHeight: context.bodyHeight,
          rootMotionEnabled,
        }), jointId),
        rotationFromPose(frame.finalPose, jointId),
      ),
    ])),
    activeContacts: frame.contacts.map((contact) => contact.jointId),
  };
  return entry;
}

export function diagnoseLocomotionCycle({
  animationInput = animation,
  clipId = WALK_CLIP_ID,
  bodyProfile = BODY_PROFILE,
  sampleCount = SAMPLE_COUNT,
} = {}) {
  const stateInput = animationInput?.activeClipId === clipId
    ? animationInput
    : { ...animationInput, activeClipId: clipId };
  const state = normalizeAnimationState(stateInput);
  const activeClip = state.clips.find((item) => item.clipId === clipId) || clip;
  const context = createRigContext(bodyProfile, { rigVersion: RIG_VERSION });
  const frames = [];
  const checkpoints = [];
  const checkpointSet = new Set(CHECKPOINT_TIMES.map((time) => time.toFixed(6)));

  for (let index = 0; index < sampleCount; index += 1) {
    const rawTime = activeClip.duration * index / (sampleCount - 1);
    const frame = sampleAnimationRuntime(state, {
      rawTime,
      bodyProfile,
      rigVersion: RIG_VERSION,
    });
    const sampled = sampleClipPose(activeClip, rawTime, {
      targetBodyHeight: context.bodyHeight,
      rootMotionEnabled: state.runtime.rootMotionEnabled,
    });
    const incoming = buildIncomingBoneLocalRotations(frame.fk, {
      rootJointId: 'hips',
      rootRotation: frame.fk.rotations.get('hips'),
    });
    const v8State = applyToV8(frame);
    const v8Positions = v8State.physicsPositions;
    const record = {
      rawTime,
      rootPosition: [...frame.finalPose.root.position],
      hipsPosition: pointFromMap(frame.fk.positions, 'hips'),
      leftUpperLegRotation: rotationFromPose(frame.finalPose, 'leftUpperLeg'),
      rightUpperLegRotation: rotationFromPose(frame.finalPose, 'rightUpperLeg'),
      leftLowerLegRotation: rotationFromPose(frame.finalPose, 'leftLowerLeg'),
      rightLowerLegRotation: rotationFromPose(frame.finalPose, 'rightLowerLeg'),
      leftFootPosition: pointFromMap(frame.fk.positions, 'leftFoot'),
      rightFootPosition: pointFromMap(frame.fk.positions, 'rightFoot'),
      leftToesPosition: pointFromMap(frame.fk.positions, 'leftToes'),
      rightToesPosition: pointFromMap(frame.fk.positions, 'rightToes'),
      leftContact: contactFor(frame, 'leftFoot'),
      rightContact: contactFor(frame, 'rightFoot'),
      leftContactCycle: frame.contacts.find((contact) => contact.jointId === 'leftFoot')?.cycle ?? null,
      rightContactCycle: frame.contacts.find((contact) => contact.jointId === 'rightFoot')?.cycle ?? null,
      leftKneeFlexion: kneeFlexion(frame.fk.positions, 'leftUpperLeg', 'leftLowerLeg', 'leftFoot'),
      rightKneeFlexion: kneeFlexion(frame.fk.positions, 'rightUpperLeg', 'rightLowerLeg', 'rightFoot'),
      leftLegForward: dot(normalize(vector(
        frame.fk.positions.get('leftUpperLeg'),
        frame.fk.positions.get('leftLowerLeg'),
      )), [0, 0, 1]),
      rightLegForward: dot(normalize(vector(
        frame.fk.positions.get('rightUpperLeg'),
        frame.fk.positions.get('rightLowerLeg'),
      )), [0, 0, 1]),
      leftFootForwardDot: dot(normalize(vector(
        frame.fk.positions.get('leftFoot'),
        frame.fk.positions.get('leftToes'),
      )), [0, 0, 1]),
      rightFootForwardDot: dot(normalize(vector(
        frame.fk.positions.get('rightFoot'),
        frame.fk.positions.get('rightToes'),
      )), [0, 0, 1]),
      leftFootVelocity: 0,
      rightFootVelocity: 0,
      sampleClipLocalRotations: Object.fromEntries(LEG_JOINTS.map((jointId) => [jointId, rotationFromPose(sampled, jointId)])),
      animationFkPositions: Object.fromEntries(LEG_JOINTS.map((jointId) => [jointId, pointFromMap(frame.animationRig.fk.positions, jointId)])),
      finalFkPositions: Object.fromEntries(LEG_JOINTS.map((jointId) => [jointId, pointFromMap(frame.fk.positions, jointId)])),
      incomingBoneLocalRotations: Object.fromEntries(LEG_JOINTS.map((jointId) => [jointId, incoming[jointId]])),
      v8PayloadPositions: Object.fromEntries(LEG_JOINTS.map((jointId) => [jointId, pointFromPayload(frame.v8Payload, jointId)])),
      physicsRigPositions: Object.fromEntries(LEG_JOINTS.map((jointId) => [jointId, v8Positions.get(jointId)])),
      definitionPosePositions: Object.fromEntries(LEG_JOINTS.map((jointId) => [jointId, v8State.definitionPositions.get(jointId)])),
      finalPoseRotations: Object.fromEntries(LEG_JOINTS.map((jointId) => [jointId, rotationFromPose(frame.finalPose, jointId)])),
      frame,
    };
    if (frames.length) {
      const previous = frames.at(-1);
      const dt = Math.max(1e-8, rawTime - previous.rawTime);
      record.leftFootVelocity = distance(previous.leftFootPosition, record.leftFootPosition) / dt;
      record.rightFootVelocity = distance(previous.rightFootPosition, record.rightFootPosition) / dt;
    }
    frames.push(record);
    if (checkpointSet.has(rawTime.toFixed(6))) {
      checkpoints.push(makeCheckpoint(
        frame,
        rawTime,
        frame.animationRig.fk,
        incoming,
        v8Positions,
        activeClip,
        context,
        state.runtime.rootMotionEnabled,
      ));
    }
  }

  const positions = (jointId) => frames.map((frame) => frame[`${jointId}Position`]);
  const rotations = (jointId) => frames.map((frame) => frame[`${jointId}Rotation`]);
  const rootZ = frames.map((frame) => frame.rootPosition[2]);
  const rootDeltas = rootZ.slice(1).map((value, index) => value - rootZ[index]);
  const sourceBodyHeight = Number(activeClip.metadata?.sourceBodyHeight) || context.bodyHeight;
  const expectedStride = (Number(activeClip.metadata?.strideLength) || 0)
    * (context.bodyHeight / sourceBodyHeight);
  const metrics = {
    leftLegAngularRange: range(rotations('leftUpperLeg').map(rotationMagnitude)),
    rightLegAngularRange: range(rotations('rightUpperLeg').map(rotationMagnitude)),
    leftLowerLegAngularRange: range(rotations('leftLowerLeg').map(rotationMagnitude)),
    rightLowerLegAngularRange: range(rotations('rightLowerLeg').map(rotationMagnitude)),
    leftFootTravel: pathLength(positions('leftFoot')),
    rightFootTravel: pathLength(positions('rightFoot')),
    leftSwingClearance: Math.max(...frames.filter((frame) => !frame.leftContact).map((frame) => frame.leftFootPosition[1]))
      - Math.min(...frames.filter((frame) => frame.leftContact).map((frame) => frame.leftFootPosition[1])),
    rightSwingClearance: Math.max(...frames.filter((frame) => !frame.rightContact).map((frame) => frame.rightFootPosition[1]))
      - Math.min(...frames.filter((frame) => frame.rightContact).map((frame) => frame.rightFootPosition[1])),
    leftSupportDrift: supportDrift(frames, 'left'),
    rightSupportDrift: supportDrift(frames, 'right'),
    phaseOpposition: phaseOpposition(frames),
    maxSimultaneousContacts: Math.max(...frames.map((frame) => Number(frame.leftContact) + Number(frame.rightContact))),
    loopPositionError: Math.abs((rootZ.at(-1) - rootZ[0]) - expectedStride),
    loopRotationError: Math.max(...LEG_JOINTS.map((jointId) => quaternionAngularDistance(
      rotationFromPose(frames[0].frame.finalPose, jointId),
      rotationFromPose(frames.at(-1).frame.finalPose, jointId),
    ))),
    rootForwardDistance: rootZ.at(-1) - rootZ[0],
    rootBackwardFrameCount: rootDeltas.filter((delta) => delta < -1e-9).length,
    leftKneeFlexionRange: range(frames.map((frame) => frame.leftKneeFlexion)),
    rightKneeFlexionRange: range(frames.map((frame) => frame.rightKneeFlexion)),
    leftFootForwardDotMinimum: Math.min(...frames.map((frame) => frame.leftFootForwardDot)),
    rightFootForwardDotMinimum: Math.min(...frames.map((frame) => frame.rightFootForwardDot)),
    maxAnimationToFinalPositionAdjustment: finiteMax(frames.map((frame) => Math.max(...LEG_JOINTS.map((jointId) => distance(
      frame.animationFkPositions[jointId], frame.finalFkPositions[jointId],
    ))))),
    maxFinalToPayloadPositionError: finiteMax(frames.map((frame) => Math.max(...LEG_JOINTS.map((jointId) => distance(
      frame.finalFkPositions[jointId], frame.v8PayloadPositions[jointId],
    ))))),
    maxPayloadToPhysicsPositionError: finiteMax(frames.map((frame) => Math.max(...LEG_JOINTS.map((jointId) => distance(
      frame.v8PayloadPositions[jointId], frame.physicsRigPositions[jointId],
    ))))),
    maxPayloadToDefinitionPositionError: finiteMax(frames.map((frame) => Math.max(...LEG_JOINTS.map((jointId) => distance(
      frame.v8PayloadPositions[jointId], frame.definitionPosePositions[jointId],
    ))))),
    maxIncomingToSnapshotRotationError: finiteMax(checkpoints.flatMap((checkpoint) => LEG_JOINTS.map((jointId) => (
      quaternionAngularDistance(checkpoint.C_incomingBoneLocalRotations[jointId], checkpoint.E_poseSnapshotLocalRotations[jointId])
    )))),
    maxRawToFinalRotationChange: finiteMax(frames.flatMap((frame) => LEG_JOINTS.map((jointId) => quaternionAngularDistance(
      frame.sampleClipLocalRotations[jointId], frame.finalPoseRotations[jointId],
    )))),
    incomingIdentityCount: frames.reduce((count, frame) => count + LEG_JOINTS.filter((jointId) => (
      quaternionAngularDistance(frame.incomingBoneLocalRotations[jointId], [0, 0, 0, 1]) < 1e-9
    )).length, 0),
    sampleCount,
  };

  return {
    schema: 'humanoid_rig/locomotion_diagnostic@1.0',
    clipId: activeClip.clipId,
    duration: activeClip.duration,
    rigVersion: RIG_VERSION,
    sampleCount,
    checkpoints,
    metrics,
    frames: frames.map(({ frame, ...record }) => record),
  };
}

function supportDrift(frames, side) {
  const byCycle = new Map();
  for (const frame of frames.filter((item) => item[`${side}Contact`])) {
    const cycle = frame[`${side}ContactCycle`] ?? 0;
    const list = byCycle.get(cycle) ?? [];
    list.push(frame);
    byCycle.set(cycle, list);
  }
  return Math.max(0, ...[...byCycle.values()].map((cycleFrames) => {
    const anchor = cycleFrames[0][`${side}FootPosition`];
    return Math.max(...cycleFrames.map((frame) => distance(frame[`${side}FootPosition`], anchor)));
  }));
}

function phaseOpposition(frames) {
  // Thigh directions stay similar while both knees point forward.  The
  // reliable gait signal is each foot's forward position relative to the
  // translating root: one foot advances while the other supports.
  const left = frames.map((frame) => frame.leftFootPosition[2] - frame.rootPosition[2]);
  const right = frames.map((frame) => frame.rightFootPosition[2] - frame.rootPosition[2]);
  const leftMean = finiteMean(left);
  const rightMean = finiteMean(right);
  const numerator = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0);
  const leftNorm = Math.sqrt(left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0));
  const rightNorm = Math.sqrt(right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0));
  return leftNorm > 1e-12 && rightNorm > 1e-12 ? -numerator / (leftNorm * rightNorm) : 0;
}

export function assertLocomotionCycle(report) {
  const { metrics } = report;
  assert.ok(metrics.leftLegAngularRange > 0.15, `left thigh range too small: ${metrics.leftLegAngularRange}`);
  assert.ok(metrics.rightLegAngularRange > 0.15, `right thigh range too small: ${metrics.rightLegAngularRange}`);
  assert.ok(metrics.leftLowerLegAngularRange > 0.12, `left shin range too small: ${metrics.leftLowerLegAngularRange}`);
  assert.ok(metrics.rightLowerLegAngularRange > 0.12, `right shin range too small: ${metrics.rightLowerLegAngularRange}`);
  const travelRatio = Math.min(metrics.leftFootTravel, metrics.rightFootTravel)
    / Math.max(metrics.leftFootTravel, metrics.rightFootTravel);
  assert.ok(travelRatio >= 0.8, `foot travel asymmetry: ${travelRatio}`);
  const minimumPhaseOpposition = report.clipId === 'walk-in-place' ? 0.55 : 0.65;
  assert.ok(metrics.phaseOpposition > minimumPhaseOpposition, `phase opposition is not half-cycle: ${metrics.phaseOpposition}`);
  assert.ok(metrics.leftSwingClearance > 0.03, `left swing clearance too small: ${metrics.leftSwingClearance}`);
  assert.ok(metrics.rightSwingClearance > 0.03, `right swing clearance too small: ${metrics.rightSwingClearance}`);
  assert.ok(metrics.leftSupportDrift < 0.02, `left support drift: ${metrics.leftSupportDrift}`);
  assert.ok(metrics.rightSupportDrift < 0.02, `right support drift: ${metrics.rightSupportDrift}`);
  assert.ok(metrics.maxSimultaneousContacts <= 1, `overlapping support contacts: ${metrics.maxSimultaneousContacts}`);
  assert.ok(metrics.leftKneeFlexionRange > 0.15, `left knee flexion range too small: ${metrics.leftKneeFlexionRange}`);
  assert.ok(metrics.rightKneeFlexionRange > 0.15, `right knee flexion range too small: ${metrics.rightKneeFlexionRange}`);
  assert.ok(metrics.leftFootForwardDotMinimum > 0, `left foot turned backward: ${metrics.leftFootForwardDotMinimum}`);
  assert.ok(metrics.rightFootForwardDotMinimum > 0, `right foot turned backward: ${metrics.rightFootForwardDotMinimum}`);
  if (report.clipId === WALK_CLIP_ID) {
    assert.ok(metrics.rootForwardDistance > 0.6, `root did not move forward: ${metrics.rootForwardDistance}`);
  } else if (report.clipId === 'walk-in-place') {
    assert.ok(Math.abs(metrics.rootForwardDistance) < 1e-8, `in-place root moved: ${metrics.rootForwardDistance}`);
  }
  if (report.clipId !== 'walk-in-place') assert.equal(metrics.rootBackwardFrameCount, 0);
  assert.ok(metrics.loopPositionError < 1e-8, `root loop distance error: ${metrics.loopPositionError}`);
  assert.ok(metrics.loopRotationError < 1e-6, `loop rotation discontinuity: ${metrics.loopRotationError}`);
  assert.ok(metrics.maxFinalToPayloadPositionError < 1e-8, `final FK to payload error: ${metrics.maxFinalToPayloadPositionError}`);
  assert.ok(metrics.maxPayloadToPhysicsPositionError < 1e-6, `payload to V8 error: ${metrics.maxPayloadToPhysicsPositionError}`);
  assert.ok(metrics.maxPayloadToDefinitionPositionError < 1e-6, `payload to render definition error: ${metrics.maxPayloadToDefinitionPositionError}`);
  assert.ok(metrics.maxIncomingToSnapshotRotationError < 1e-6, `incoming to snapshot error: ${metrics.maxIncomingToSnapshotRotationError}`);
}

const selectedClipId = process.argv.includes('--in-place') ? 'walk-in-place' : WALK_CLIP_ID;
const report = diagnoseLocomotionCycle({
  clipId: selectedClipId,
  animationInput: normalizeAnimationState({ activeClipId: selectedClipId }),
});
if (process.argv.includes('--metrics')) {
  console.log(JSON.stringify(report.metrics, null, 2));
} else if (process.argv.includes('--checkpoints')) {
  console.log(JSON.stringify(report.checkpoints, null, 2));
} else if (process.argv.includes('--diagnose')) {
  console.log(JSON.stringify(report, null, 2));
}
assertLocomotionCycle(report);
for (const profile of BODY_PROFILES.slice(1)) {
  const profileReport = diagnoseLocomotionCycle({
    clipId: WALK_CLIP_ID,
    animationInput: normalizeAnimationState({ activeClipId: WALK_CLIP_ID }),
    bodyProfile: profile.value,
    sampleCount: 17,
  });
  assertLocomotionCycle(profileReport);
}
console.log('PASS animation-v8-locomotion end-to-end cycle');
