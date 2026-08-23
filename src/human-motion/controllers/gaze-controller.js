import {
  conjugateQuaternion,
  quaternionFromTo,
  slerpQuaternion,
} from '../../modules/animation/quaternion.js';
import {
  IDENTITY,
  clamp,
  dotVectors,
  normalizeOutgoingPose,
  normalizeQuaternion,
  normalizeVector3,
  quaternionAngularDistance,
  rotateVectorByQuaternion,
  subtractVectors,
  unit,
} from '../solver/motion-math.js';

export class GazeController {
  constructor({ kinematicAdapter } = {}) {
    if (!kinematicAdapter) throw new TypeError('GazeController requires kinematicAdapter.');
    this.kinematic = kinematicAdapter;
  }

  solve(poseInput, gaze) {
    let pose = normalizeOutgoingPose(poseInput, this.kinematic.context.rigVersion);
    if (!gaze?.targetPosition) return { pose, report: null, eyeRigOutput: null };
    let fk = this.kinematic.forwardKinematics(pose);
    const headPosition = fk.positions.get('head');
    const headForward = rotateVectorByQuaternion([0, 0, 1], fk.rotations.get('head') || IDENTITY);
    const targetDirection = normalizeVector3(subtractVectors(gaze.targetPosition, headPosition), headForward);
    const behind = dotVectors(headForward, targetDirection) < -0.1;
    const distribution = [
      ['upperChest', unit(gaze.chestWeight, 0.15) * (behind ? 1.6 : 1)],
      ['neck', unit(gaze.neckWeight, 0.35)],
      ['head', unit(gaze.headWeight, 0.65)],
    ];
    for (const [jointId, rawWeight] of distribution) {
      const weight = clamp(rawWeight, 0, jointId === 'head' ? 0.85 : 0.45);
      if (weight <= 0) continue;
      pose = aimForward(pose, jointId, gaze.targetPosition, weight, this.kinematic);
    }
    fk = this.kinematic.forwardKinematics(pose);
    const solvedDirection = normalizeVector3(
      rotateVectorByQuaternion([0, 0, 1], fk.rotations.get('head') || IDENTITY),
      [0, 0, 1],
    );
    const desiredDirection = normalizeVector3(subtractVectors(gaze.targetPosition, fk.positions.get('head')), solvedDirection);
    const error = Math.acos(clamp(dotVectors(solvedDirection, desiredDirection), -1, 1));
    return {
      pose,
      report: {
        task: 'gaze',
        targetPosition: [...gaze.targetPosition],
        gazeError: error,
        targetBehind: behind,
        headRotation: [...getJointRotation(pose, 'head')],
        neckRotation: [...getJointRotation(pose, 'neck')],
        upperChestAdditiveRotation: [...getJointRotation(pose, 'upperChest')],
        flipped: quaternionAngularDistance(getJointRotation(pose, 'head'), IDENTITY) > Math.PI - 1e-4,
      },
      eyeRigOutput: {
        available: false,
        targetDirection: desiredDirection,
        requestedWeight: unit(gaze.eyeWeight, 0),
      },
    };
  }
}

function aimForward(poseInput, jointId, targetPosition, weight, adapter) {
  const pose = normalizeOutgoingPose(poseInput, adapter.context.rigVersion);
  const fk = adapter.forwardKinematics(pose);
  const joint = fk.rig.jointMap.get(jointId);
  const position = fk.positions.get(jointId);
  if (!joint || !position) return pose;
  const parentWorld = joint.parentId ? (fk.rotations.get(joint.parentId) || IDENTITY) : IDENTITY;
  const desiredWorld = normalizeVector3(subtractVectors(targetPosition, position), [0, 0, 1]);
  const desiredParentLocal = rotateVectorByQuaternion(desiredWorld, conjugateQuaternion(parentWorld));
  const desiredLocal = quaternionFromTo([0, 0, 1], desiredParentLocal);
  setJointRotation(pose, jointId, slerpQuaternion(getJointRotation(pose, jointId), desiredLocal, weight));
  return pose;
}

function getJointRotation(pose, jointId) {
  return normalizeQuaternion(pose.joints[jointId]?.rotation || IDENTITY);
}

function setJointRotation(pose, jointId, rotation) {
  pose.joints[jointId] = { rotation: normalizeQuaternion(rotation) };
}
