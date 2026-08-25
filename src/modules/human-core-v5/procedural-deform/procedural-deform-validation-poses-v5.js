import { createPoseFrameV4 } from '../../pose/pose-frame-v4.js';
import {
  quaternionFromAnatomicalChannels,
  quaternionAngularDistance,
  quaternionFromTo,
  rotateVectorByQuaternion,
  normalizeVector3,
  dotVectors,
} from '../../animation/quaternion.js';
import { createBodyDNA } from '../body-dna-v5.js';
import { assertHumanRigCoreV5, getHumanRigJointV5 } from '../human-rig-core-v5.js';
import { adaptHumanRigCoreToExistingRig } from '../v4-adapter.js';
import { StaticValidationPoseCompilerV5 } from './static-validation-pose-compiler-v5.js';

export const PROCEDURAL_DEFORM_VALIDATION_POSE_IDS_V5 = Object.freeze([
  'a-pose',
  't-pose',
  'arm-raise-90-left',
  'arm-raise-150-left',
  'forearm-twist-180-left',
  'elbow-bend-140-left',
  'hip-flex-left',
  'knee-bend-left',
  'squat',
  'lunge-left',
]);

export const PROCEDURAL_DEFORM_VALIDATION_POSE_LABELS_V5 = Object.freeze({
  'a-pose': 'A Pose',
  't-pose': 'T Pose',
  'arm-raise-90-left': 'Arm Raise 90',
  'arm-raise-150-left': 'Arm Raise 150',
  'forearm-twist-180-left': 'Forearm Twist 180',
  'elbow-bend-140-left': 'Elbow Bend 140',
  'hip-flex-left': 'Hip Flex',
  'knee-bend-left': 'Knee Bend',
  squat: 'Squat',
  'lunge-left': 'Lunge',
});

/**
 * Canonical procedural surface bind is T Pose. Therefore zero local rotation
 * is both t-pose and arm-raise-90-left relative to the natural down direction.
 * The two IDs retain distinct requested anatomical intent and measurements.
 */
export function createProceduralDeformValidationPoseV5({
  poseId,
  rigCore,
  bodyDNA,
  timestamp = Date.now(),
} = {}) {
  if (!PROCEDURAL_DEFORM_VALIDATION_POSE_IDS_V5.includes(poseId)) {
    throw new Error(`Unknown Procedural Deform validation pose ${poseId}.`);
  }
  assertHumanRigCoreV5(rigCore);
  const dna = createBodyDNA(bodyDNA);
  const adapted = adaptHumanRigCoreToExistingRig(rigCore, { bodyDNA: dna, pose: 'T' });
  const validationAxes = createCanonicalTValidationAxes(rigCore, adapted.definition);
  const rotations = {};
  const authoredChannels = new Map();
  const requestedAngles = [];
  const apply = (jointId, anatomicalChannel, requestedAngleDegrees, localDeltaDegrees = requestedAngleDegrees) => {
    const joint = getHumanRigJointV5(rigCore, jointId);
    const axisKey = channelAxisKey(anatomicalChannel);
    const resolvedAxisReference = validationAxes.get(jointId) ?? joint.axisReference;
    const resolvedLocalAxis = [...resolvedAxisReference[axisKey]];
    const deltaChannels = { bend: 0, twist: 0, side: 0, [anatomicalChannel]: degreesToRadians(localDeltaDegrees) };
    const channels = authoredChannels.get(jointId) ?? { bend: 0, twist: 0, side: 0 };
    channels[anatomicalChannel] = degreesToRadians(localDeltaDegrees);
    authoredChannels.set(jointId, channels);
    const resultQuaternion = quaternionFromAnatomicalChannels(resolvedAxisReference, deltaChannels);
    requestedAngles.push({
      jointId,
      anatomicalChannel,
      requestedAngleDegrees,
      localDeltaDegrees,
      sourceLocalAxis: [...joint.axisReference[axisKey]],
      resolvedLocalAxis,
      resultQuaternion: [...resultQuaternion],
    });
  };

  if (poseId === 'a-pose') {
    apply('leftUpperArm', 'side', 55, 35);
    apply('rightUpperArm', 'side', 55, -35);
  }
  if (poseId === 't-pose') {
    recordCanonicalIdentity(requestedAngles, rigCore, validationAxes, 'leftUpperArm', 'side', 90);
    recordCanonicalIdentity(requestedAngles, rigCore, validationAxes, 'rightUpperArm', 'side', 90);
  }
  if (poseId === 'arm-raise-90-left') recordCanonicalIdentity(requestedAngles, rigCore, validationAxes, 'leftUpperArm', 'side', 90);
  if (poseId === 'arm-raise-150-left') apply('leftUpperArm', 'side', 150, -60);
  if (poseId === 'forearm-twist-180-left') apply('leftLowerArm', 'twist', 180, 180);
  if (poseId === 'elbow-bend-140-left') {
    apply('leftUpperArm', 'bend', 35, -35);
    apply('leftUpperArm', 'side', 150, -60);
    apply('leftLowerArm', 'bend', 140, 140);
  }
  if (poseId === 'hip-flex-left') {
    apply('leftUpperLeg', 'bend', 55, -55);
  }
  if (poseId === 'knee-bend-left') apply('leftLowerLeg', 'bend', 110, 110);
  if (poseId === 'squat') {
    apply('leftUpperLeg', 'bend', 65, -65);
    apply('rightUpperLeg', 'bend', 65, -65);
    apply('leftLowerLeg', 'bend', 105, 105);
    apply('rightLowerLeg', 'bend', 105, 105);
  }
  if (poseId === 'lunge-left') {
    apply('leftUpperLeg', 'bend', 55, -55);
    apply('leftLowerLeg', 'bend', 80, 80);
    apply('rightUpperLeg', 'bend', 24, 24);
    apply('rightLowerLeg', 'bend', 30, 30);
  }

  for (const [jointId, channels] of authoredChannels) {
    const joint = getHumanRigJointV5(rigCore, jointId);
    rotations[jointId] = quaternionFromAnatomicalChannels(validationAxes.get(jointId) ?? joint.axisReference, channels);
  }

  const rootPosition = adapted.definition.joints.find((joint) => joint.id === 'hips')?.poseWorldPosition ?? [0, 0, 0];
  const pose = createPoseFrameV4({
    compatibleRig: rigCore.sourceRig.compatibleRig,
    rootJointId: 'hips',
    rootPosition,
    rootRotation: [0, 0, 0, 1],
    localRotations: rotations,
    contacts: [],
    ikTargets: [],
    constraintState: {
      fixture: PROCEDURAL_DEFORM_VALIDATION_POSE_LABELS_V5[poseId],
      validationPose: {
        poseId,
        canonicalBindPose: 't-pose',
        canonicalArmAbductionDegrees: 90,
        requestedAngles,
      },
      wholeBodySolverV5: false,
    },
    proportionRevision: dna.proportionRevision,
    timestamp,
  });
  return STATIC_VALIDATION_POSE_IDS.has(poseId)
    ? new StaticValidationPoseCompilerV5().compile({ poseId, pose, rigCore })
    : pose;
}

const STATIC_VALIDATION_POSE_IDS = new Set(['squat', 'lunge-left']);

export function measureProceduralDeformValidationPoseV5({ finalPose, simulationRigFrame } = {}) {
  const poseId = finalPose?.constraintState?.validationPose?.poseId ?? 'unknown';
  const joints = simulationRigFrame?.joints ?? {};
  const result = { poseId };
  const leftArm = angleFromDown(
    joints.leftUpperArm?.worldPosition,
    joints.leftLowerArm?.worldPosition,
  );
  if (Number.isFinite(leftArm)) result.leftArmAbductionDegrees = leftArm;
  const rightArm = angleFromDown(
    joints.rightUpperArm?.worldPosition,
    joints.rightLowerArm?.worldPosition,
  );
  if (Number.isFinite(rightArm)) result.rightArmAbductionDegrees = rightArm;
  const elbow = chainBendDegrees(
    joints.leftUpperArm?.worldPosition,
    joints.leftLowerArm?.worldPosition,
    joints.leftHand?.worldPosition,
  );
  if (Number.isFinite(elbow)) result.leftElbowBendDegrees = elbow;
  const twistRecord = finalPose?.constraintState?.validationPose?.requestedAngles
    ?.find((record) => record.jointId === 'leftLowerArm' && record.anatomicalChannel === 'twist');
  if (twistRecord) {
    result.leftForearmTwistDegrees = radiansToDegrees(quaternionAngularDistance([0, 0, 0, 1], twistRecord.resultQuaternion));
  }
  return result;
}

function recordCanonicalIdentity(records, rigCore, validationAxes, jointId, anatomicalChannel, requestedAngleDegrees) {
  const joint = getHumanRigJointV5(rigCore, jointId);
  const axisKey = channelAxisKey(anatomicalChannel);
  records.push({
    jointId,
    anatomicalChannel,
    requestedAngleDegrees,
    localDeltaDegrees: 0,
    sourceLocalAxis: [...joint.axisReference[axisKey]],
    resolvedLocalAxis: [...(validationAxes.get(jointId) ?? joint.axisReference)[axisKey]],
    resultQuaternion: [0, 0, 0, 1],
    canonicalBindContributionDegrees: requestedAngleDegrees,
  });
}

function createCanonicalTValidationAxes(rigCore, definition) {
  const jointById = new Map(definition.joints.map((joint) => [joint.id, joint]));
  const preferredChildIds = {
    leftUpperArm: 'leftLowerArm', rightUpperArm: 'rightLowerArm',
    leftLowerArm: 'leftHand', rightLowerArm: 'rightHand',
    leftUpperLeg: 'leftLowerLeg', rightUpperLeg: 'rightLowerLeg',
    leftLowerLeg: 'leftFoot', rightLowerLeg: 'rightFoot',
    leftFoot: 'leftToes', rightFoot: 'rightToes',
  };
  const result = new Map();
  for (const jointId of Object.keys(preferredChildIds)) {
    const semantic = getHumanRigJointV5(rigCore, jointId);
    const joint = jointById.get(jointId);
    const child = jointById.get(preferredChildIds[jointId]);
    if (!semantic || !joint?.poseWorldPosition || !child?.poseWorldPosition) continue;
    const targetTwist = normalizeVector3(
      child.poseWorldPosition.map((value, index) => value - joint.poseWorldPosition[index]),
      semantic.axisReference.twistAxisLocal,
    );
    const alignment = quaternionFromTo(semantic.axisReference.twistAxisLocal, targetTwist);
    result.set(jointId, {
      ...semantic.axisReference,
      source: `${semantic.axisReference.source}+canonical-t-bind-rebase`,
      twistAxisLocal: normalizeVector3(rotateVectorByQuaternion(semantic.axisReference.twistAxisLocal, alignment), targetTwist),
      bendAxisLocal: normalizeVector3(rotateVectorByQuaternion(semantic.axisReference.bendAxisLocal, alignment), semantic.axisReference.bendAxisLocal),
      sideAxisLocal: normalizeVector3(rotateVectorByQuaternion(semantic.axisReference.sideAxisLocal, alignment), semantic.axisReference.sideAxisLocal),
    });
  }
  return result;
}

function angleFromDown(start, end) {
  if (!start || !end) return Number.NaN;
  const direction = normalizeVector3(end.map((value, index) => value - start[index]), [0, -1, 0]);
  return radiansToDegrees(Math.acos(clamp(dotVectors(direction, [0, -1, 0]), -1, 1)));
}
function chainBendDegrees(parent, joint, child) {
  if (!parent || !joint || !child) return Number.NaN;
  const incoming = normalizeVector3(joint.map((value, index) => value - parent[index]), [1, 0, 0]);
  const outgoing = normalizeVector3(child.map((value, index) => value - joint[index]), incoming);
  return radiansToDegrees(Math.acos(clamp(dotVectors(incoming, outgoing), -1, 1)));
}
function channelAxisKey(channel) {
  return ({ bend: 'bendAxisLocal', twist: 'twistAxisLocal', side: 'sideAxisLocal' })[channel];
}
function degreesToRadians(value) { return Number(value) * Math.PI / 180; }
function radiansToDegrees(value) { return Number(value) * 180 / Math.PI; }
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
