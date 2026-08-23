import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applyPosePresetToDefinition,
  createStandardHumanoidPreset,
  diagnoseShoulderPose,
  normalizeSkeletonDefinition,
} from '../src/skeleton-presets.js';
import {
  computePoseWorldPositions,
  computeRestWorldPositions,
  getBoneLength,
  vectorDistance,
} from '../src/skeleton-model.js';
import { PhysicsRig } from '../src/physics-rig.js';

const SYMMETRY_TOLERANCE = 0.005;
const EXACT_LENGTH_TOLERANCE = 1e-8;
const EXPECTED_SMPL24_JOINT_IDS = Object.freeze([
  'hips',
  'leftUpperLeg',
  'rightUpperLeg',
  'spine',
  'leftLowerLeg',
  'rightLowerLeg',
  'chest',
  'leftFoot',
  'rightFoot',
  'upperChest',
  'leftToes',
  'rightToes',
  'neck',
  'leftShoulder',
  'rightShoulder',
  'head',
  'leftUpperArm',
  'rightUpperArm',
  'leftLowerArm',
  'rightLowerArm',
  'leftHand',
  'rightHand',
  'leftHandEnd',
  'rightHandEnd',
]);

function createDefinition(pose = 'A') {
  return normalizeSkeletonDefinition(createStandardHumanoidPreset(pose));
}

function poseSnapshot(definition) {
  return new Map(definition.joints.map((joint) => [
    joint.id,
    [...joint.poseWorldPosition],
  ]));
}

function topologySnapshot(definition) {
  return definition.joints.map(({ id, parentId }) => ({ id, parentId }));
}

function maxSnapshotError(left, right) {
  let maximum = 0;
  for (const [jointId, leftPoint] of left) {
    const rightPoint = right.get(jointId);
    assert.ok(rightPoint, `Pose snapshot is missing ${jointId}.`);
    maximum = Math.max(
      maximum,
      Math.hypot(
        leftPoint[0] - rightPoint[0],
        leftPoint[1] - rightPoint[1],
        leftPoint[2] - rightPoint[2],
      ),
    );
  }
  return maximum;
}

function assertCoreBoneLengths(definition, label) {
  const poseWorld = computePoseWorldPositions(definition);
  let maximum = 0;
  for (const joint of definition.joints) {
    if (joint.rigTier !== 'core' || !joint.parentId || joint.physicalBone === false) {
      continue;
    }
    const error = Math.abs(
      vectorDistance(poseWorld.get(joint.parentId), poseWorld.get(joint.id))
      - getBoneLength(definition, joint.id)
    );
    maximum = Math.max(maximum, error);
  }
  assert.ok(
    maximum < EXACT_LENGTH_TOLERANCE,
    `${label}: maximum core bone-length error ${maximum} m.`,
  );
  return maximum;
}

function assertFinitePerformancePose(definition, label) {
  for (const joint of definition.joints) {
    if (joint.rigTier === 'core') continue;
    assert.ok(
      Array.isArray(joint.poseWorldPosition)
        && joint.poseWorldPosition.length === 3
        && joint.poseWorldPosition.every(Number.isFinite),
      `${label}: derived node ${joint.id} has a non-finite pose position.`,
    );
  }
}

function assertTPoseSymmetry(definition, label) {
  const diagnostics = diagnoseShoulderPose(definition);
  assert.ok(
    diagnostics.upperArmHeightDifference < SYMMETRY_TOLERANCE,
    `${label}: upper-arm height difference ${diagnostics.upperArmHeightDifference} m.`,
  );
  assert.ok(
    diagnostics.upperArmDepthDifference < SYMMETRY_TOLERANCE,
    `${label}: upper-arm depth difference ${diagnostics.upperArmDepthDifference} m.`,
  );

  const byId = new Map(definition.joints.map((joint) => [joint.id, joint.poseWorldPosition]));
  const center = byId.get('upperChest');
  const leftHand = byId.get('leftHandEnd');
  const rightHand = byId.get('rightHandEnd');
  const handMirrorXError = Math.abs(
    (leftHand[0] - center[0]) + (rightHand[0] - center[0]),
  );
  const handHeightError = Math.abs(leftHand[1] - rightHand[1]);
  const handDepthError = Math.abs(leftHand[2] - rightHand[2]);
  assert.ok(handMirrorXError < SYMMETRY_TOLERANCE, `${label}: hand X mirror error ${handMirrorXError} m.`);
  assert.ok(handHeightError < SYMMETRY_TOLERANCE, `${label}: hand Y error ${handHeightError} m.`);
  assert.ok(handDepthError < SYMMETRY_TOLERANCE, `${label}: hand Z error ${handDepthError} m.`);
  return diagnostics;
}

const skinMetadata = JSON.parse(await readFile(
  new URL('../assets/smpl/SKIN_BINDING_METADATA.json', import.meta.url),
  'utf8',
));
assert.deepEqual(
  skinMetadata.jointIds,
  EXPECTED_SMPL24_JOINT_IDS,
  'The fixed SMPL 24 skin-joint mapping order changed.',
);

const definition = createDefinition('A');
const initialTopology = topologySnapshot(definition);
const initialAPose = poseSnapshot(definition);
const initialRest = computeRestWorldPositions(definition);
for (const joint of definition.joints) {
  const restPoint = initialRest.get(joint.id);
  const posePoint = joint.poseWorldPosition;
  assert.ok(
    Math.hypot(
      posePoint[0] - restPoint.x,
      posePoint[1] - restPoint.y,
      posePoint[2] - restPoint.z,
    ) < EXACT_LENGTH_TOLERANCE,
    `A Pose is not the bind-space baseline at ${joint.id}.`,
  );
}

applyPosePresetToDefinition(definition, 'T');
const diagnosticsInput = JSON.stringify(definition.joints);
const firstTDiagnostics = assertTPoseSymmetry(definition, 'Raw T Pose');
assert.equal(
  JSON.stringify(definition.joints),
  diagnosticsInput,
  'diagnoseShoulderPose() mutated the RigDefinition.',
);
assert.equal(firstTDiagnostics.shoulderPresetMode, 'socket-driven');
assert.equal(firstTDiagnostics.warnings.length, 0, 'Standard T Pose unexpectedly required reach projection.');
const firstTPose = poseSnapshot(definition);
const rawMaximumLengthError = assertCoreBoneLengths(definition, 'Raw T Pose');
assertFinitePerformancePose(definition, 'Raw T Pose');

assert.deepEqual(topologySnapshot(definition), initialTopology, 'T Pose changed joint IDs or hierarchy.');
assert.equal(definition.joints.find(({ id }) => id === 'leftShoulder')?.parentId, 'upperChest');
assert.equal(definition.joints.find(({ id }) => id === 'rightShoulder')?.parentId, 'upperChest');
assert.equal(definition.joints.find(({ id }) => id === 'leftUpperArm')?.parentId, 'leftShoulder');
assert.equal(definition.joints.find(({ id }) => id === 'rightUpperArm')?.parentId, 'rightShoulder');

applyPosePresetToDefinition(definition, 'REACH_LEFT');
const reachById = new Map(definition.joints.map((joint) => [joint.id, joint.poseWorldPosition]));
const reachSocket = reachById.get('leftUpperArm');
const reachHand = reachById.get('leftHandEnd');
assert.ok(reachHand[0] < reachSocket[0], 'Reach Left hand did not move to the left of its shoulder socket.');
assert.ok(reachHand[1] > reachSocket[1], 'Reach Left hand did not move above its shoulder socket.');
assert.ok(reachHand[2] > reachSocket[2], 'Reach Left hand did not move forward of its shoulder socket.');
assertFinitePerformancePose(definition, 'Reach Left');

applyPosePresetToDefinition(definition, 'T');
const secondTPose = poseSnapshot(definition);
const tReachTRoundTripError = maxSnapshotError(firstTPose, secondTPose);
assert.ok(
  tReachTRoundTripError < EXACT_LENGTH_TOLERANCE,
  `T → Reach → T accumulated ${tReachTRoundTripError} m of drift.`,
);

applyPosePresetToDefinition(definition, 'A');
const restoredAPose = poseSnapshot(definition);
const aTRoundTripError = maxSnapshotError(initialAPose, restoredAPose);
assert.ok(
  aTRoundTripError < EXACT_LENGTH_TOLERANCE,
  `A → T → A failed to restore bind pose by ${aTRoundTripError} m.`,
);
assert.deepEqual(topologySnapshot(definition), initialTopology, 'Pose round trips changed joint IDs or hierarchy.');

applyPosePresetToDefinition(definition, 'T');
const physicsRig = new PhysicsRig(definition, {
  solverIterations: 64,
  exactMaxPasses: 960,
  exactTolerance: EXACT_LENGTH_TOLERANCE,
  groundEnabled: true,
  gravityEnabled: false,
  poseStiffness: 0.20,
  anatomyEnabled: true,
});
physicsRig.resetFromDefinitionPose({ project: true });
const projectedTDiagnostics = assertTPoseSymmetry(definition, 'Physics-projected T Pose');
const projectedMaximumLengthError = assertCoreBoneLengths(definition, 'Physics-projected T Pose');
assertFinitePerformancePose(definition, 'Physics-projected T Pose');

console.log('T Pose shoulder stabilization V3 checks passed.', JSON.stringify({
  raw: {
    upperArmHeightDifference: firstTDiagnostics.upperArmHeightDifference,
    upperArmDepthDifference: firstTDiagnostics.upperArmDepthDifference,
    mirrorError: firstTDiagnostics.mirrorError,
    shoulderSlopeDegrees: firstTDiagnostics.shoulderSlopeDegrees,
    maximumCoreBoneLengthError: rawMaximumLengthError,
  },
  projected: {
    upperArmHeightDifference: projectedTDiagnostics.upperArmHeightDifference,
    upperArmDepthDifference: projectedTDiagnostics.upperArmDepthDifference,
    mirrorError: projectedTDiagnostics.mirrorError,
    shoulderSlopeDegrees: projectedTDiagnostics.shoulderSlopeDegrees,
    maximumCoreBoneLengthError: projectedMaximumLengthError,
  },
  roundTrips: {
    tReachT: tReachTRoundTripError,
    aTA: aTRoundTripError,
  },
}));
