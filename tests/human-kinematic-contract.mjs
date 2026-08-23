import assert from 'node:assert/strict';
import {
  CORE_MOTION_JOINT_IDS,
  HUMAN_COORDINATE_SYSTEM,
  buildIncomingBoneLocalRotations,
  createHumanKinematicContext,
  createIdentityOutgoingPose,
  forwardKinematicsOutgoingPose,
  getHumanJointTier,
  listHumanJointsByTier,
  measureFkBoneLengthError,
  rotationFromAnatomicalChannels,
  validateHumanKinematicContext,
} from '../src/human-motion/kinematic-contract.js';
import {
  buildIncomingBoneLocalRotations as buildRuntimeIncomingBoneLocalRotations,
  createIdentityAnimationPose,
  createRigContext,
  forwardKinematics,
} from '../src/modules/animation/runtime.js';

const AXIS_EPSILON = 1e-6;
const POSITION_EPSILON = 1e-12;
const MIRROR_PAIRS = [
  ['leftShoulder', 'rightShoulder'],
  ['leftUpperArm', 'rightUpperArm'],
  ['leftLowerArm', 'rightLowerArm'],
  ['leftHand', 'rightHand'],
  ['leftUpperLeg', 'rightUpperLeg'],
  ['leftLowerLeg', 'rightLowerLeg'],
  ['leftFoot', 'rightFoot'],
  ['leftToes', 'rightToes'],
];

assert.deepEqual(HUMAN_COORDINATE_SYSTEM, {
  handedness: 'right',
  upAxis: '+Y',
  forwardAxis: '+Z',
  rightAxis: '+X',
  leftJointSign: -1,
  rightJointSign: 1,
});

const context = createHumanKinematicContext();
const validation = validateHumanKinematicContext(context);
assert.equal(validation.valid, true, validation.errors.join('\n'));
assert.deepEqual(validation.warnings, []);
assert.equal(context.jointAxes.runtimeApplied, true);
assert.equal(context.jointAxes.runtimeConsumer, 'human-motion-canonical-foundation@3');
assert.equal(context.joints.length, 89);

const hips = context.restPositions.get('hips');
const leftShoulder = context.restPositions.get('leftShoulder');
const rightShoulder = context.restPositions.get('rightShoulder');
assert.ok(leftShoulder[0] < hips[0], 'Left joints must occupy negative X relative to the center line.');
assert.ok(rightShoulder[0] > hips[0], 'Right joints must occupy positive X relative to the center line.');

for (const jointId of CORE_MOTION_JOINT_IDS) {
  assert.equal(getHumanJointTier(context, jointId), 'core', `${jointId} left the Core Rig tier.`);
  const axes = context.jointAxisMap.get(jointId);
  assert.ok(axes, `${jointId} has no bind-local jointAxes entry.`);
  const twist = axes.twistAxisLocal;
  const bend = axes.bendAxisLocal;
  const side = axes.sideAxisLocal;
  assert.ok(Math.abs(length(twist) - 1) < AXIS_EPSILON, `${jointId} twist axis is not unit length.`);
  assert.ok(Math.abs(length(bend) - 1) < AXIS_EPSILON, `${jointId} bend axis is not unit length.`);
  assert.ok(Math.abs(length(side) - 1) < AXIS_EPSILON, `${jointId} side axis is not unit length.`);
  assert.ok(Math.abs(dot(twist, bend)) < AXIS_EPSILON, `${jointId} twist/bend axes are not orthogonal.`);
  assert.ok(Math.abs(dot(twist, side)) < AXIS_EPSILON, `${jointId} twist/side axes are not orthogonal.`);
  assert.ok(Math.abs(dot(bend, side)) < AXIS_EPSILON, `${jointId} bend/side axes are not orthogonal.`);
  assert.ok(distance(normalize(cross(twist, bend)), side) < AXIS_EPSILON, `${jointId} axes are not right handed.`);
  assert.equal(axes.runtimeApplied, true, `${jointId} jointAxes are still marked declaration-only.`);
}

for (const [leftId, rightId] of MIRROR_PAIRS) {
  const left = context.jointAxisMap.get(leftId);
  const right = context.jointAxisMap.get(rightId);
  assertMirrored(left.twistAxisLocal, right.twistAxisLocal, [-1, 1, 1], `${leftId}/twist`);
  assertMirrored(left.bendAxisLocal, right.bendAxisLocal, [1, -1, 1], `${leftId}/bend`);
  assertMirrored(left.sideAxisLocal, right.sideAxisLocal, [-1, 1, 1], `${leftId}/side`);
}

for (const jointId of ['leftShoulder', 'rightShoulder', 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm', 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot']) {
  const rotation = rotationFromAnatomicalChannels(context, jointId, {
    twist: 0.07,
    bend: -0.11,
    side: 0.05,
  });
  assert.ok(Math.abs(length(rotation) - 1) < 1e-10, `${jointId} anatomical rotation is not normalized.`);
  assert.ok(rotation.every(Number.isFinite), `${jointId} anatomical rotation contains a non-finite value.`);
}

const identityPose = createIdentityOutgoingPose({ context });
const sharedFk = forwardKinematicsOutgoingPose(identityPose, context);
assert.ok(measureFkBoneLengthError(sharedFk) < POSITION_EPSILON);

const runtimeContext = createRigContext();
const runtimeFk = forwardKinematics(createIdentityAnimationPose(), runtimeContext);
for (const jointId of context.jointMap.keys()) {
  assert.ok(
    distance(sharedFk.positions.get(jointId), runtimeFk.positions.get(jointId)) < POSITION_EPSILON,
    `${jointId} differs between shared and Animation Runtime FK.`,
  );
}
assert.deepEqual(
  buildRuntimeIncomingBoneLocalRotations(runtimeFk),
  buildIncomingBoneLocalRotations(runtimeFk),
  'Animation Runtime no longer delegates to the canonical incoming bridge.',
);

for (const tier of ['core', 'performance', 'derived', 'control', 'marker']) {
  assert.ok(listHumanJointsByTier(context, tier).length > 0, `${tier} tier is empty or unavailable.`);
}

console.log('PASS human kinematic coordinate contract, bind-local jointAxes, mirrored axes, tier boundaries, shared FK, and canonical incoming bridge');

function assertMirrored(left, right, signs, label) {
  for (let index = 0; index < 3; index += 1) {
    assert.ok(
      Math.abs(left[index] - right[index] * signs[index]) < AXIS_EPSILON,
      `${label} mirror component ${index} differs: ${left[index]} vs ${right[index]}.`,
    );
  }
}

function length(value) {
  return Math.hypot(...value);
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(value) {
  const magnitude = length(value);
  return magnitude > 0 ? value.map((component) => component / magnitude) : [0, 0, 0];
}

function distance(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot(...a.map((component, index) => component - b[index]));
}
