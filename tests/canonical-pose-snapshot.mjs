import assert from 'node:assert/strict';
import { createDefaultState } from '../src/default-state.js';
import {
  HUMAN_COORDINATE_SYSTEM,
  INCOMING_ROTATION_CONVENTION_FULL,
  ROUND_TRIP_JOINT_IDS,
  compareOutgoingAndIncomingPose,
  createHumanKinematicContext,
  validateCanonicalPoseSnapshot,
} from '../src/human-motion/kinematic-contract.js';
import {
  createCanonicalPosePreset,
} from '../src/human-motion/canonical-pose-builder.js';
import { buildCanonicalPresetForState, posePreset } from '../src/modules/pose/index.js';
import { deriveLocalPoseFromV8Payload } from '../src/modules/animation/runtime.js';
import {
  normalizeVector3,
  rotateVectorByQuaternion,
  subtractVectors,
  vectorLength,
} from '../src/modules/animation/quaternion.js';
import { PhysicsRig } from '../legacy/v8/src/physics-rig.js';

const context = createHumanKinematicContext();
const bindSignature = signature(context.definition);
const bundles = {
  a: createCanonicalPosePreset('a', { context, updatedAt: 'test:a' }),
  t: createCanonicalPosePreset('t', { context, updatedAt: 'test:t' }),
  reach: createCanonicalPosePreset('reach', { context, updatedAt: 'test:reach' }),
  step: createCanonicalPosePreset('step', { context, updatedAt: 'test:step' }),
};
assert.equal(signature(context.definition), bindSignature, 'Canonical builders mutated the RigDefinition bind hierarchy.');

for (const [presetId, bundle] of Object.entries(bundles)) {
  const snapshot = bundle.poseSnapshot;
  const validation = validateCanonicalPoseSnapshot(snapshot, context);
  assert.equal(validation.valid, true, `${presetId}: ${validation.errors.join('; ')}`);
  assert.equal(snapshot.schema, 'humanoid_rig/pose_snapshot@1.0');
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.type, 'PoseSnapshot');
  assert.equal(snapshot.compatibleRig, 'rig@0.4.0');
  assert.equal(snapshot.unit, 'meter');
  assert.deepEqual(snapshot.coordinateSystem, HUMAN_COORDINATE_SYSTEM);
  assert.equal(snapshot.sourceRepresentation, 'outgoing_local_quaternion_fk');
  assert.equal(snapshot.rotationSpace, 'local');
  assert.equal(snapshot.rotationConvention, INCOMING_ROTATION_CONVENTION_FULL);
  assert.equal(snapshot.rootJointId, 'hips');
  assert.ok(snapshot.source);
  assert.ok(snapshot.solverVersion);
  assert.ok(snapshot.name);
  assert.ok(snapshot.updatedAt);
  assert.ok(Array.isArray(snapshot.ikTargets));
  assert.ok(snapshot.pinnedJoints && typeof snapshot.pinnedJoints === 'object');
  assert.ok(snapshot.diagnostics && typeof snapshot.diagnostics === 'object');
  assertNoBindMutationFields(snapshot);

  const quaternions = [snapshot.rootRotation, ...Object.values(snapshot.localRotations)];
  for (const quaternion of quaternions) {
    assert.ok(quaternion.every(Number.isFinite), `${presetId} contains NaN or Infinity.`);
    assert.ok(Math.abs(Math.hypot(...quaternion) - 1) < 1e-10, `${presetId} contains a non-normalized quaternion.`);
    assert.ok(quaternion[3] >= -1e-12, `${presetId} quaternion sign is not canonicalized.`);
  }

  const roundTrip = compareOutgoingAndIncomingPose(bundle.outgoingPose, snapshot, context);
  assert.equal(roundTrip.comparedJointCount, ROUND_TRIP_JOINT_IDS.length);
  assert.ok(
    roundTrip.maximumPositionError < 1e-6,
    `${presetId} outgoing/incoming round trip error is ${roundTrip.maximumPositionError} m.`,
  );
  assert.equal(snapshot.diagnostics.worldPositionAuthorityUsed, false);
  assert.equal(snapshot.diagnostics.lossyWorldReconstructionUsed, false);
  assert.equal(snapshot.diagnostics.lossyRotationConversion, false);
  assert.ok(snapshot.diagnostics.maxBoneLengthError < 1e-10);
}

assert.ok(bundles.reach.diagnostics.targetErrorM < 1e-6, 'Reach failed to reach its analytical target.');
assert.ok(bundles.step.diagnostics.targetErrorM < 1e-6, 'Step failed to reach its analytical foot target.');
assert.ok(bundles.step.poseSnapshot.pinnedJoints.rightFoot, 'Step did not preserve the support foot pin.');

const tDiagnostics = bundles.t.diagnostics;
assert.ok(tDiagnostics.shoulderHeightDifference < 0.004);
assert.ok(tDiagnostics.shoulderDepthDifference < 0.004);
assert.ok(tDiagnostics.handHeightDifference < 0.006);
assert.ok(tDiagnostics.handDepthDifference < 0.006);
assert.ok(tDiagnostics.maxBoneLengthError < 1e-10);
assertElbowPlaneMirror(tDiagnostics.leftElbowPlane, tDiagnostics.rightElbowPlane);
assertPalmMirror(bundles.t, 'leftHand', 'rightHand');

const tAgain = createCanonicalPosePreset('t', { context, updatedAt: 'test:t-again' });
const aAgain = createCanonicalPosePreset('a', { context, updatedAt: 'test:a-again' });
assert.ok(maximumPositionDifference(bundles.t.fk.positions, tAgain.fk.positions) < 1e-12, 'T → Reach → T accumulated drift.');
assert.ok(maximumPositionDifference(bundles.a.fk.positions, aAgain.fk.positions) < 1e-8, 'A → T → A failed to restore bind pose.');

const state = createDefaultState();
state.character.pose.pinned = ['rightFoot'];
const buttonBundle = buildCanonicalPresetForState('t', state);
assert.equal(buttonBundle.poseSnapshot.type, 'PoseSnapshot');
assert.equal(buttonBundle.poseSnapshot.rotationConvention, INCOMING_ROTATION_CONVENTION_FULL);
assert.ok(buttonBundle.poseSnapshot.pinnedJoints.rightFoot);
assert.ok(posePreset('t').joints.leftWrist, 'The 2D pose preset compatibility cache was removed.');

const definition = structuredClone(context.definition);
const physicsBindSignature = signature(definition);
const physicsRig = new PhysicsRig(definition, {
  gravityEnabled: false,
  groundEnabled: false,
  jointLimits: false,
  solverIterations: 16,
  exactMaxPasses: 96,
  exactTolerance: 1e-8,
});
const applied = physicsRig.applyPoseSnapshot(bundles.t.poseSnapshot, {
  project: true,
  applyConstraintSettings: true,
  preservePinTargets: false,
});
assert.ok(applied >= ROUND_TRIP_JOINT_IDS.length);
const importStats = physicsRig.getPoseImportStats();
assert.equal(importStats.lossless, true);
assert.equal(importStats.lossyWorldReconstructionUsed, false);
assert.equal(importStats.projectionRequested, true);
assert.equal(importStats.projectionSkipped, true);
assert.equal(importStats.projectionReason, 'exact-lossless-canonical-pose');
assert.ok(importStats.preProjectionBoneErrorM < 1e-8);
assert.equal(signature(definition), physicsBindSignature, 'PhysicsRig canonical import mutated bind data.');

let physicsRoundTripError = 0;
for (const jointId of ROUND_TRIP_JOINT_IDS) {
  const expected = bundles.t.fk.positions.get(jointId);
  const actualPoint = physicsRig.getPoint(jointId);
  const actual = [actualPoint.x, actualPoint.y, actualPoint.z];
  physicsRoundTripError = Math.max(physicsRoundTripError, vectorLength(subtractVectors(expected, actual)));
}
assert.ok(physicsRoundTripError < 1e-6, `PhysicsRig canonical round trip error is ${physicsRoundTripError} m.`);

const legacySnapshot = physicsRig.buildPoseSnapshot({ source: 'canonical-test-legacy-world' });
assert.equal(legacySnapshot.sourceRepresentation, 'world_position_pbd');
assert.equal(legacySnapshot.diagnostics.lossyRotationConversion, true);
assert.equal(legacySnapshot.diagnostics.twistDataAvailable, false);
physicsRig.applyPoseSnapshot(legacySnapshot, { project: false });
const legacyStats = physicsRig.getPoseImportStats();
assert.equal(legacyStats.lossless, false);
assert.equal(legacyStats.lossyWorldReconstructionUsed, true);

const legacyV8Payload = structuredClone(bundles.t.v8Payload);
delete legacyV8Payload.localRotations;
delete legacyV8Payload.incomingBoneLocalRotations;
delete legacyV8Payload.rotationConventions;
const legacyDerived = deriveLocalPoseFromV8Payload(legacyV8Payload, context);
assert.equal(legacyDerived.metadata.source, 'v8-world-position@1');
assert.equal(legacyDerived.metadata.approximation, 'single-child-orientation');

const unsupportedConvention = structuredClone(bundles.t.poseSnapshot);
unsupportedConvention.rotationConvention = 'outgoing_joint_local_quaternion';
assert.throws(
  () => physicsRig.applyPoseSnapshot(unsupportedConvention),
  /rotationConvention must be one of/,
);
const unsupportedCoordinateSystem = structuredClone(bundles.t.poseSnapshot);
unsupportedCoordinateSystem.coordinateSystem.forwardAxis = '-Z';
assert.throws(
  () => physicsRig.applyPoseSnapshot(unsupportedCoordinateSystem),
  /coordinateSystem must be right-handed/,
);

console.log(`PASS canonical A/T/Reach/Step snapshots, T-pose symmetry, lossless incoming bridge, PhysicsRig round trip ${physicsRoundTripError} m, and explicit lossy legacy compatibility`);

function assertNoBindMutationFields(snapshot) {
  const visit = (value, path = '') => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      assert.ok(!['boneLength', 'localPosition', 'parentId', 'jointScale', 'skeletonScale'].includes(key), `${childPath} is forbidden bind data.`);
      visit(child, childPath);
    }
  };
  visit(snapshot);
}

function assertElbowPlaneMirror(left, right) {
  assert.ok(Math.abs(left[0] - right[0]) < 1e-6, 'Elbow plane X components are not mirrored consistently.');
  assert.ok(Math.abs(left[1] + right[1]) < 1e-6, 'Elbow plane Y components are not mirrored consistently.');
  assert.ok(Math.abs(left[2] + right[2]) < 1e-6, 'Elbow plane Z components are not mirrored consistently.');
}

function assertPalmMirror(bundle, leftId, rightId) {
  const leftPalm = rotateVectorByQuaternion([0, 0, 1], bundle.fk.rotations.get(leftId));
  const rightPalm = rotateVectorByQuaternion([0, 0, 1], bundle.fk.rotations.get(rightId));
  assert.ok(Math.abs(leftPalm[0] + rightPalm[0]) < 1e-6, 'Palm X directions are not mirrored.');
  assert.ok(Math.abs(leftPalm[1] - rightPalm[1]) < 1e-6, 'Palm Y directions differ.');
  assert.ok(Math.abs(leftPalm[2] - rightPalm[2]) < 1e-6, 'Palm Z directions differ.');
  assert.ok(normalizeVector3(leftPalm)[2] > 0 && normalizeVector3(rightPalm)[2] > 0, 'Palm forward direction is inconsistent.');
}

function maximumPositionDifference(left, right) {
  let maximum = 0;
  for (const [jointId, value] of left) {
    const other = right.get(jointId);
    if (!other) continue;
    maximum = Math.max(maximum, vectorLength(subtractVectors(value, other)));
  }
  return maximum;
}

function signature(definition) {
  return JSON.stringify(definition.joints.map((joint) => ({
    id: joint.id,
    parentId: joint.parentId,
    localPosition: [...joint.localPosition],
    physicalBone: joint.physicalBone !== false,
  })));
}
