import {
  conjugateQuaternion,
  multiplyQuaternions,
  quaternionFromTo,
  slerpQuaternion,
} from '../../modules/animation/quaternion.js';
import {
  IDENTITY,
  addVectors,
  clamp,
  crossVectors,
  distance,
  dotVectors,
  lerpVector,
  normalizeOutgoingPose,
  normalizeQuaternion,
  normalizeVector3,
  rotateVectorByQuaternion,
  scaleVector,
  subtractVectors,
  unit,
  vectorLength,
} from '../solver/motion-math.js';

export const END_EFFECTOR_CHAINS = Object.freeze({
  leftHand: Object.freeze({ assist: 'leftShoulder', upper: 'leftUpperArm', middle: 'leftLowerArm', end: 'leftHand', type: 'arm' }),
  rightHand: Object.freeze({ assist: 'rightShoulder', upper: 'rightUpperArm', middle: 'rightLowerArm', end: 'rightHand', type: 'arm' }),
  leftFoot: Object.freeze({ assist: 'hips', upper: 'leftUpperLeg', middle: 'leftLowerLeg', end: 'leftFoot', type: 'leg' }),
  rightFoot: Object.freeze({ assist: 'hips', upper: 'rightUpperLeg', middle: 'rightLowerLeg', end: 'rightFoot', type: 'leg' }),
});

export class EndEffectorController {
  constructor({ kinematicAdapter } = {}) {
    if (!kinematicAdapter) throw new TypeError('EndEffectorController requires kinematicAdapter.');
    this.kinematic = kinematicAdapter;
  }

  solve(poseInput, targets = [], { iterations = 2 } = {}) {
    let pose = normalizeOutgoingPose(poseInput, this.kinematic.context.rigVersion);
    const reports = [];
    const ordered = [...targets].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
    for (const target of ordered) {
      const chain = END_EFFECTOR_CHAINS[target.jointId];
      if (!chain) {
        reports.push(this.solveDirectTarget(pose, target));
        continue;
      }
      let result = null;
      for (let iteration = 0; iteration < Math.max(1, iterations); iteration += 1) {
        result = solveTwoBoneTarget(pose, target, chain, this.kinematic);
        pose = result.pose;
      }
      reports.push({ ...result.report, iterations: Math.max(1, iterations) });
    }
    return { pose, reports, fk: this.kinematic.forwardKinematics(pose) };
  }

  solveDirectTarget(pose, target) {
    const fk = this.kinematic.forwardKinematics(pose);
    const current = fk.positions.get(target.jointId);
    return {
      task: 'end_effector',
      id: target.id,
      jointId: target.jointId,
      supported: false,
      clamped: false,
      targetPosition: [...target.targetPosition],
      solvedPosition: current ? [...current] : null,
      reachError: current ? distance(current, target.targetPosition) : Infinity,
      directionDot: null,
    };
  }
}

export function solveTwoBoneTarget(poseInput, target, chain, kinematicAdapter) {
  let pose = normalizeOutgoingPose(poseInput, kinematicAdapter.context.rigVersion);
  const positionWeight = unit(target.positionWeight, 1);
  if (chain.type === 'arm' && unit(target.spineParticipation, 0) > 0) {
    pose = applyAssistAim(pose, 'upperChest', 'neck', target.targetPosition, unit(target.spineParticipation, 0) * 0.18, kinematicAdapter);
  }
  if (chain.type === 'arm' && unit(target.shoulderParticipation, 0) > 0) {
    pose = applyAssistAim(pose, chain.assist, chain.upper, target.targetPosition, unit(target.shoulderParticipation, 0) * 0.35, kinematicAdapter);
  }
  let fk = kinematicAdapter.forwardKinematics(pose);
  const start = fk.positions.get(chain.upper);
  const currentMiddle = fk.positions.get(chain.middle);
  const currentEnd = fk.positions.get(chain.end);
  const middleJoint = fk.rig.jointMap.get(chain.middle);
  const endJoint = fk.rig.jointMap.get(chain.end);
  if (!start || !currentMiddle || !currentEnd || !middleJoint || !endJoint) {
    return {
      pose,
      report: {
        task: 'end_effector', id: target.id, jointId: target.jointId, supported: false,
        clamped: false, reachError: Infinity, directionDot: null,
      },
    };
  }

  const desired = lerpVector(currentEnd, target.targetPosition, positionWeight);
  const upperLength = vectorLength(middleJoint.localPosition);
  const lowerLength = vectorLength(endJoint.localPosition);
  const rawDelta = subtractVectors(desired, start);
  const rawDistance = vectorLength(rawDelta);
  const direction = normalizeVector3(rawDelta, chain.type === 'leg' ? [0, -1, 0] : [chain.upper.startsWith('left') ? -1 : 1, 0, 0]);
  const minimum = Math.abs(upperLength - lowerLength) + 1e-6;
  const maximum = upperLength + lowerLength - 1e-6;
  const solvedDistance = clamp(rawDistance, minimum, maximum);
  const projectedTarget = addVectors(start, scaleVector(direction, solvedDistance));
  const pole = resolvePoleDirection(target.poleTarget, start, currentMiddle, direction, chain);
  const along = (upperLength ** 2 + solvedDistance ** 2 - lowerLength ** 2) / (2 * solvedDistance);
  const height = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
  const middleTarget = addVectors(addVectors(start, scaleVector(direction, along)), scaleVector(pole, height));

  pose = aimJointAt(pose, chain.upper, chain.middle, middleTarget, kinematicAdapter, 1);
  pose = aimJointAt(pose, chain.middle, chain.end, projectedTarget, kinematicAdapter, 1);
  fk = kinematicAdapter.forwardKinematics(pose);

  if (target.targetRotation != null && unit(target.rotationWeight, 0) > 0) {
    const endDefinition = fk.rig.jointMap.get(chain.end);
    const parentWorld = fk.rotations.get(endDefinition.parentId) || IDENTITY;
    const desiredLocal = multiplyQuaternions(conjugateQuaternion(parentWorld), target.targetRotation);
    setJointRotation(pose, chain.end, slerpQuaternion(getJointRotation(pose, chain.end), desiredLocal, unit(target.rotationWeight, 0)));
    fk = kinematicAdapter.forwardKinematics(pose);
  }

  const solvedEnd = fk.positions.get(chain.end);
  const solvedMiddle = fk.positions.get(chain.middle);
  const bendVector = normalizeVector3(subtractVectors(solvedMiddle, addVectors(start, scaleVector(direction, along))), pole);
  return {
    pose,
    report: {
      task: 'end_effector',
      id: target.id,
      jointId: target.jointId,
      supported: true,
      clamped: Math.abs(rawDistance - solvedDistance) > 1e-6,
      targetPosition: [...target.targetPosition],
      projectedTarget: [...projectedTarget],
      solvedPosition: [...solvedEnd],
      reachError: distance(solvedEnd, projectedTarget),
      requestedError: distance(solvedEnd, target.targetPosition),
      directionDot: dotVectors(bendVector, pole),
      upperLength,
      lowerLength,
    },
  };
}

function applyAssistAim(pose, assistId, childId, target, weight, adapter) {
  if (!assistId || assistId === 'hips') return pose;
  return aimJointAt(pose, assistId, childId, target, adapter, weight);
}

function aimJointAt(poseInput, jointId, childId, target, adapter, weight) {
  const pose = normalizeOutgoingPose(poseInput, adapter.context.rigVersion);
  const fk = adapter.forwardKinematics(pose);
  const joint = fk.rig.jointMap.get(jointId);
  const child = fk.rig.jointMap.get(childId);
  const jointPosition = fk.positions.get(jointId);
  if (!joint || !child || !jointPosition) return pose;
  const parentWorld = joint.parentId ? (fk.rotations.get(joint.parentId) || IDENTITY) : IDENTITY;
  const desiredWorld = subtractVectors(target, jointPosition);
  const desiredParentLocal = rotateVectorByQuaternion(desiredWorld, conjugateQuaternion(parentWorld));
  const desiredLocal = quaternionFromTo(child.localPosition, desiredParentLocal);
  const current = getJointRotation(pose, jointId);
  setJointRotation(pose, jointId, slerpQuaternion(current, desiredLocal, unit(weight, 1)));
  return pose;
}

function resolvePoleDirection(poleTarget, start, currentMiddle, direction, chain) {
  const rawPole = poleTarget
    ? subtractVectors(poleTarget, start)
    : chain.type === 'leg'
      ? [0, 0.12, 1]
      : subtractVectors(currentMiddle, start);
  const projected = subtractVectors(rawPole, scaleVector(direction, dotVectors(rawPole, direction)));
  if (vectorLength(projected) > 1e-7) return normalizeVector3(projected, [0, 0, 1]);
  const fallback = crossVectors(direction, Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  return normalizeVector3(fallback, [0, 0, 1]);
}

function getJointRotation(pose, jointId) {
  if (jointId === 'hips') return normalizeQuaternion(pose.root.rotation);
  return normalizeQuaternion(pose.joints[jointId]?.rotation || IDENTITY);
}

function setJointRotation(pose, jointId, rotation) {
  if (jointId === 'hips') pose.root.rotation = normalizeQuaternion(rotation);
  else pose.joints[jointId] = { rotation: normalizeQuaternion(rotation) };
}
