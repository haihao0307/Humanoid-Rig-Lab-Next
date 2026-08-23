import { multiplyQuaternions, slerpQuaternion } from '../../modules/animation/quaternion.js';
import {
  IDENTITY,
  normalizeOutgoingPose,
  normalizeQuaternion,
  unit,
} from '../solver/motion-math.js';

export class PostureController {
  constructor({ kinematicAdapter } = {}) {
    if (!kinematicAdapter) throw new TypeError('PostureController requires kinematicAdapter.');
    this.kinematic = kinematicAdapter;
  }

  solve(poseInput, posture = {}, style = {}, { protectedJoints = new Set(), endEffectors = [] } = {}) {
    let pose = normalizeOutgoingPose(poseInput, this.kinematic.context.rigVersion);
    pose = applySpineDistribution(pose, posture, this.kinematic, protectedJoints);
    pose = applyPelvisChestCounterRotation(pose, posture, this.kinematic, protectedJoints);
    pose = applyNaturalElbowBend(pose, style, this.kinematic, protectedJoints);
    pose = applyNaturalKneeBend(pose, style, this.kinematic, protectedJoints);
    pose = applyShoulderRhythm(pose, endEffectors, this.kinematic, protectedJoints);
    pose = applyHandRelaxation(pose, style, this.kinematic, protectedJoints);
    pose = applyFootForwardAlignment(pose, this.kinematic, protectedJoints);
    return { pose, report: { task: 'posture', protectedJointCount: protectedJoints.size } };
  }
}

export function applyNaturalElbowBend(poseInput, style, adapter, protectedJoints = new Set()) {
  let pose = normalizeOutgoingPose(poseInput, adapter.context.rigVersion);
  const angle = 0.08 + 0.16 * (1 - unit(style.stiffness, 0.45));
  for (const jointId of ['leftLowerArm', 'rightLowerArm']) pose = addAnatomical(pose, jointId, { bend: angle }, 0.35, adapter, protectedJoints);
  return pose;
}

export function applyNaturalKneeBend(poseInput, style, adapter, protectedJoints = new Set()) {
  let pose = normalizeOutgoingPose(poseInput, adapter.context.rigVersion);
  const angle = 0.025 + 0.055 * (1 - unit(style.stiffness, 0.45));
  for (const jointId of ['leftLowerLeg', 'rightLowerLeg']) pose = addAnatomical(pose, jointId, { bend: angle }, 0.25, adapter, protectedJoints);
  return pose;
}

export function applyShoulderRhythm(poseInput, endEffectors, adapter, protectedJoints = new Set()) {
  let pose = normalizeOutgoingPose(poseInput, adapter.context.rigVersion);
  for (const target of endEffectors || []) {
    if (!/Hand$/.test(target.jointId)) continue;
    const side = target.jointId.startsWith('left') ? 'left' : 'right';
    pose = addAnatomical(pose, `${side}Shoulder`, { side: side === 'left' ? -0.05 : 0.05 }, unit(target.shoulderParticipation, 0.2), adapter, protectedJoints);
  }
  return pose;
}

export function applySpineDistribution(poseInput, posture, adapter, protectedJoints = new Set()) {
  let pose = normalizeOutgoingPose(poseInput, adapter.context.rigVersion);
  const lean = Number(posture.torsoLean) || 0;
  const twist = Number(posture.spineTwist) || 0;
  for (const [jointId, weight] of [['spine', 0.2], ['chest', 0.35], ['upperChest', 0.45]]) {
    pose = addAnatomical(pose, jointId, { bend: lean * weight, twist: twist * weight }, 1, adapter, protectedJoints);
  }
  return pose;
}

export function applyPelvisChestCounterRotation(poseInput, posture, adapter, protectedJoints = new Set()) {
  let pose = normalizeOutgoingPose(poseInput, adapter.context.rigVersion);
  const twist = Number(posture.spineTwist) || 0;
  pose = addAnatomical(pose, 'hips', { twist: -twist * 0.25 }, 1, adapter, protectedJoints, { additive: true });
  pose = addAnatomical(pose, 'upperChest', { twist: twist * 0.2 }, 1, adapter, protectedJoints, { additive: true });
  return pose;
}

export function applyHandRelaxation(poseInput, style, adapter, protectedJoints = new Set()) {
  let pose = normalizeOutgoingPose(poseInput, adapter.context.rigVersion);
  const bend = 0.04 * (1 - unit(style.alertness, 0.5));
  for (const jointId of ['leftHand', 'rightHand']) pose = addAnatomical(pose, jointId, { bend }, 0.25, adapter, protectedJoints);
  return pose;
}

export function applyFootForwardAlignment(poseInput, adapter, protectedJoints = new Set()) {
  let pose = normalizeOutgoingPose(poseInput, adapter.context.rigVersion);
  for (const jointId of ['leftFoot', 'rightFoot']) {
    if (protectedJoints.has(jointId)) continue;
    const current = getJointRotation(pose, jointId);
    setJointRotation(pose, jointId, slerpQuaternion(current, IDENTITY, 0.08));
  }
  return pose;
}

function addAnatomical(poseInput, jointId, channels, weight, adapter, protectedJoints, { additive = false } = {}) {
  const pose = normalizeOutgoingPose(poseInput, adapter.context.rigVersion);
  if (protectedJoints.has(jointId) || !adapter.context.jointAxisMap.has(jointId)) return pose;
  const delta = adapter.resolveAnatomicalRotation(jointId, channels.twist || 0, channels.bend || 0, channels.side || 0);
  const target = additive
    ? multiplyQuaternions(getJointRotation(pose, jointId), delta)
    : delta;
  setJointRotation(pose, jointId, slerpQuaternion(getJointRotation(pose, jointId), target, unit(weight, 1)));
  return pose;
}

function getJointRotation(pose, jointId) {
  if (jointId === 'hips') return normalizeQuaternion(pose.root.rotation);
  return normalizeQuaternion(pose.joints[jointId]?.rotation || IDENTITY);
}

function setJointRotation(pose, jointId, rotation) {
  if (jointId === 'hips') pose.root.rotation = normalizeQuaternion(rotation);
  else pose.joints[jointId] = { rotation: normalizeQuaternion(rotation) };
}
