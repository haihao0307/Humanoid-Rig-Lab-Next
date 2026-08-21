import { createStandardHumanoidPreset } from '../../../legacy/v8/src/skeleton-presets.js';
import {
  conjugateQuaternion,
  multiplyQuaternions,
  normalizeQuaternion,
  normalizeVector3,
  quaternionFromTo,
  rotateVectorByQuaternion,
} from './quaternion.js';

const IDENTITY = Object.freeze([0, 0, 0, 1]);

/**
 * Built-in clips are authored against the fitted A-pose, but store ordinary
 * parent-local joint quaternions.  Directions passed to the solver use the
 * project world basis: +Y up and +Z character-forward.
 */
export const ANATOMICAL_MOTION_BASIS = Object.freeze({
  handedness: 'right',
  upAxis: '+Y',
  forwardAxis: '+Z',
  lateralConvention: 'left-joints-negative-X/right-joints-positive-X',
});

const ORIENTATION_CHILD = Object.freeze({
  hips: 'spine',
  spine: 'chest',
  chest: 'upperChest',
  upperChest: 'neck',
  neck: 'head',
  head: 'headTop',
  leftShoulder: 'leftUpperArm',
  leftUpperArm: 'leftLowerArm',
  leftLowerArm: 'leftHand',
  leftHand: 'leftHandEnd',
  rightShoulder: 'rightUpperArm',
  rightUpperArm: 'rightLowerArm',
  rightLowerArm: 'rightHand',
  rightHand: 'rightHandEnd',
  leftUpperLeg: 'leftLowerLeg',
  leftLowerLeg: 'leftFoot',
  leftFoot: 'leftToes',
  leftToes: 'leftToesEnd',
  rightUpperLeg: 'rightLowerLeg',
  rightLowerLeg: 'rightFoot',
  rightFoot: 'rightToes',
  rightToes: 'rightToesEnd',
});

const REFERENCE_DEFINITION = createStandardHumanoidPreset('A');
const REFERENCE_JOINTS = REFERENCE_DEFINITION.joints;
const REFERENCE_BY_ID = new Map(REFERENCE_JOINTS.map((joint) => [joint.id, joint]));

/**
 * Converts semantic world-space bone directions into the local quaternions
 * consumed by the animation runtime.  Solving parent-first avoids hard-coded
 * Euler signs for mirrored arms and bent chains.
 */
export function solveDirectedLocalRotations(directions = {}, {
  localRotations = {},
} = {}) {
  const solved = {};
  const worldRotations = new Map();

  for (const joint of REFERENCE_JOINTS) {
    const parentWorld = joint.parentId
      ? worldRotations.get(joint.parentId) || IDENTITY
      : IDENTITY;
    let localRotation = normalizeQuaternion(localRotations[joint.id] || IDENTITY);
    const desiredDirection = directions[joint.id];
    const child = REFERENCE_BY_ID.get(ORIENTATION_CHILD[joint.id]);

    if (desiredDirection && child?.parentId === joint.id) {
      const desiredParentLocal = rotateVectorByQuaternion(
        normalizeVector3(desiredDirection),
        conjugateQuaternion(parentWorld),
      );
      localRotation = quaternionFromTo(child.localPosition, desiredParentLocal);
    }

    solved[joint.id] = normalizeQuaternion(localRotation);
    worldRotations.set(joint.id, multiplyQuaternions(parentWorld, localRotation));
  }

  return solved;
}
