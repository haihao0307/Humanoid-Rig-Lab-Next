import assert from 'node:assert/strict';
import {
  createStandardHumanoidPreset,
  normalizeSkeletonDefinition,
} from '../src/skeleton-presets.js';
import {
  applyPosePayload,
  buildExportPayload,
  buildPosePayload,
  calculateRigHeight,
  computePoseWorldPositions,
  getBoneLength,
  vectorDistance,
} from '../src/skeleton-model.js';
import { PhysicsRig } from '../src/physics-rig.js';
import {
  buildStandalonePoseExport,
  canonicalPinId,
  inspectPoseContract,
  normalizePinnedJointIds,
  updateLegacyPin,
  updatePoseSnapshotPin,
  validatePoseSnapshot,
} from '../../../src/modules/pose/pose-contract.js';
import {
  createDefinitionForBodyProfile,
  createImagePoseAsset,
  normalizeImagePoseLibrary,
  retargetPoseObservation,
} from '../../../src/modules/pose/image-pose-retarget.js';
import { normalizePoseLandmarkerResult } from '../../../src/modules/pose/image-pose-estimator.js';
import {
  deleteImagePoseSource,
  loadImagePoseSource,
  saveImagePoseSource,
} from '../../../src/modules/pose/image-pose-store.js';

const LENGTH_TOLERANCE = 1e-5;
const PELVIS_TOLERANCE = 1e-4;
const ANGLE_TOLERANCE = 0.05;

function createRig(options = {}) {
  const definition = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
  const rig = new PhysicsRig(definition, {
    solverIterations: 64,
    exactMaxPasses: 960,
    exactTolerance: 1e-8,
    groundEnabled: true,
    gravityEnabled: false,
    poseStiffness: 0.20,
    anatomyEnabled: true,
    ...options,
  });
  return { definition, rig };
}

function bindSnapshot(definition) {
  return JSON.stringify(definition.joints.map((joint) => ({
    id: joint.id,
    parentId: joint.parentId,
    localPosition: [...joint.localPosition],
    jointRadius: joint.jointRadius,
    boneRadius: joint.boneRadius,
    physicalBone: joint.physicalBone,
    visualBone: joint.visualBone,
    visualJoint: joint.visualJoint,
    jointType: joint.jointType,
    limitLabel: joint.limitLabel,
  })));
}

function pointMap(rig, definition) {
  return new Map(definition.joints.map((joint) => [joint.id, rig.getPoint(joint.id)]));
}

function pointMovement(before, after) {
  return vectorDistance(before, after);
}

function assertSolved(rig, message) {
  const lengthError = rig.getMaxBoneError();
  const jointViolation = rig.getMaxJointLimitViolation();
  const pelvisError = rig.getRigidPelvisError();
  assert.ok(lengthError < LENGTH_TOLERANCE, `${message}: maximum bone error ${lengthError} m.`);
  assert.ok(jointViolation < ANGLE_TOLERANCE, `${message}: joint violation ${jointViolation} degrees.`);
  assert.ok(pelvisError < PELVIS_TOLERANCE, `${message}: rigid pelvis error ${pelvisError} m.`);
}

function assertBindUnchanged(definition, snapshot, message) {
  assert.equal(bindSnapshot(definition), snapshot, message);
}

const MEDIAPIPE_RIG_MAP = Object.freeze({
  0: 'head', 1: 'head', 2: 'head', 3: 'head', 4: 'head', 5: 'head', 6: 'head',
  7: 'head', 8: 'head', 9: 'head', 10: 'head',
  11: 'leftUpperArm', 12: 'rightUpperArm',
  13: 'leftLowerArm', 14: 'rightLowerArm',
  15: 'leftHand', 16: 'rightHand',
  17: 'leftHandEnd', 18: 'rightHandEnd',
  19: 'leftHandEnd', 20: 'rightHandEnd',
  21: 'leftHandEnd', 22: 'rightHandEnd',
  23: 'leftUpperLeg', 24: 'rightUpperLeg',
  25: 'leftLowerLeg', 26: 'rightLowerLeg',
  27: 'leftFoot', 28: 'rightFoot',
  29: 'leftFoot', 30: 'rightFoot',
  31: 'leftToesEnd', 32: 'rightToesEnd',
});

function createSyntheticImageObservation(rig) {
  const positions = Object.fromEntries(Object.entries(MEDIAPIPE_RIG_MAP).map(([index, jointId]) => [
    Number(index),
    rig.getPoint(jointId),
  ]));
  const values = Object.values(positions);
  const minimumY = Math.min(...values.map((point) => point.y));
  const maximumY = Math.max(...values.map((point) => point.y));
  const maximumX = Math.max(...values.map((point) => Math.abs(point.x)));
  const bodyHeight = Math.max(0.1, maximumY - minimumY);
  const bodyWidth = Math.max(0.5, maximumX * 2.5);
  const landmarks = Array.from({ length: 33 }, (_, index) => {
    const point = positions[index];
    return {
      index,
      name: `landmark_${index}`,
      x: 0.5 + point.x / bodyWidth,
      y: 0.95 - ((point.y - minimumY) / bodyHeight) * 0.9,
      z: -point.z / bodyWidth,
      visibility: 0.99,
      presence: 0.99,
    };
  });
  const worldLandmarks = Array.from({ length: 33 }, (_, index) => {
    const point = positions[index];
    return {
      index,
      name: `landmark_${index}`,
      x: point.x,
      y: -point.y,
      z: -point.z,
      visibility: 0.99,
      presence: 0.99,
    };
  });
  return {
    schema: 'humanoid_rig/pose_observation@1.0',
    sourceType: 'synthetic_test_image',
    provider: 'deterministic-test-estimator',
    packageVersion: 'test',
    model: 'test-pose-landmarker',
    delegate: 'CPU',
    image: {
      width: 1200,
      height: 1800,
      aspectRatio: bodyWidth / bodyHeight,
    },
    landmarks,
    worldLandmarks,
    confidence: {
      overall: 0.99,
      minimum: 0.99,
      lowConfidenceIndices: [],
      lowConfidenceNames: [],
    },
    inferenceMs: 1,
    createdAt: '2026-08-19T00:00:00.000Z',
  };
}

// Joint dragging propagates through the body while dimensions, pelvis width,
// and all supported anatomical limits remain hard constraints.
{
  const { definition, rig } = createRig();
  const immutableBind = bindSnapshot(definition);
  const before = pointMap(rig, definition);
  const pelvisWidthBefore = vectorDistance(rig.getPoint('leftUpperLeg'), rig.getPoint('rightUpperLeg'));
  const hand = rig.getPoint('leftHand');
  const target = { x: hand.x - 0.4, y: hand.y + 0.25, z: hand.z + 0.15 };

  assert.equal(rig.beginDrag({ jointId: 'leftHand', kind: 'joint', anchorWorld: hand }), true);
  assert.equal(rig.updateDragTarget(target), true);
  assertSolved(rig, 'Joint drag during interaction');

  const movedAnatomical = definition.joints.filter((joint) => (
    !joint.isControl && pointMovement(before.get(joint.id), rig.getPoint(joint.id)) > 1e-5
  ));
  assert.ok(movedAnatomical.length >= 20, `Only ${movedAnatomical.length} anatomical joints reacted.`);
  assert.ok(pointMovement(before.get('leftHand'), rig.getPoint('leftHand')) > 0.25);
  assert.ok(pointMovement(before.get('upperChest'), rig.getPoint('upperChest')) > 0.05);
  assert.ok(pointMovement(before.get('hips'), rig.getPoint('hips')) > 0.001);
  assert.ok(pointMovement(before.get('rightHand'), rig.getPoint('rightHand')) > 0.015);

  assert.equal(rig.endDrag({ keepMomentum: false }), true);
  assertSolved(rig, 'Joint drag after release');
  assertBindUnchanged(definition, immutableBind, 'Joint dragging changed immutable model dimensions.');
  const pelvisWidthAfter = vectorDistance(rig.getPoint('leftUpperLeg'), rig.getPoint('rightUpperLeg'));
  assert.ok(Math.abs(pelvisWidthAfter - pelvisWidthBefore) < PELVIS_TOLERANCE);

  const root = rig.getPoint('root');
  const hips = rig.getPoint('hips');
  const rootDefinition = definition.joints.find((joint) => joint.id === 'root');
  const controlOffset = rootDefinition.controlOffset;
  assert.ok(Math.abs(root.x - (hips.x + controlOffset[0])) < 1e-10);
  assert.ok(Math.abs(root.y - (hips.y + controlOffset[1])) < 1e-10);
  assert.ok(Math.abs(root.z - (hips.z + controlOffset[2])) < 1e-10);
}

// A rendered bone acts as a two-endpoint handle and still obeys joint limits.
{
  const { definition, rig } = createRig();
  const immutableBind = bindSnapshot(definition);
  const before = pointMap(rig, definition);
  const parent = rig.getPoint('leftUpperArm');
  const child = rig.getPoint('leftLowerArm');
  const midpoint = {
    x: (parent.x + child.x) / 2,
    y: (parent.y + child.y) / 2,
    z: (parent.z + child.z) / 2,
  };

  assert.equal(rig.beginDrag({ jointId: 'leftLowerArm', kind: 'bone', anchorWorld: midpoint }), true);
  assert.equal(rig.updateDragTarget({
    x: midpoint.x + 0.35,
    y: midpoint.y + 0.25,
    z: midpoint.z + 0.20,
  }), true);
  assertSolved(rig, 'Bone drag during interaction');
  assert.ok(pointMovement(before.get('leftUpperArm'), rig.getPoint('leftUpperArm')) > 0.15);
  assert.ok(pointMovement(before.get('leftLowerArm'), rig.getPoint('leftLowerArm')) > 0.15);
  assert.ok(pointMovement(before.get('hips'), rig.getPoint('hips')) > 0.001);

  rig.endDrag({ keepMomentum: false });
  assertSolved(rig, 'Bone drag after release');
  assertBindUnchanged(definition, immutableBind, 'Bone dragging changed immutable model dimensions.');
}

// Impossible elbow, knee, wrist and ankle requests are projected back into the
// configured adult range of motion.
{
  const { rig } = createRig({ solverIterations: 96 });
  const hand = rig.getPoint('leftHandEnd');
  rig.moveJointTo('leftHandEnd', { x: hand.x + 1.5, y: hand.y + 1.2, z: hand.z - 1.5 });
  assertSolved(rig, 'Extreme arm target');
  assert.equal(rig.getJointLimitInfo('leftLowerArm').withinLimits, true);
  assert.equal(rig.getJointLimitInfo('leftHand').withinLimits, true);

  const toes = rig.getPoint('leftToesEnd');
  rig.moveJointTo('leftToesEnd', { x: toes.x + 1.2, y: toes.y + 1.5, z: toes.z - 1.2 });
  assertSolved(rig, 'Extreme leg target');
  assert.equal(rig.getJointLimitInfo('leftLowerLeg').withinLimits, true);
  assert.equal(rig.getJointLimitInfo('leftFoot').withinLimits, true);
  assert.equal(rig.getJointLimitInfo('leftToes').withinLimits, true);
}

// Unreachable targets yield while pinned supports, segment lengths and joint
// envelopes remain intact.
{
  const { definition, rig } = createRig({ solverIterations: 96 });
  const immutableBind = bindSnapshot(definition);
  rig.setPinned('leftFoot', true);
  rig.setPinned('rightFoot', true);
  const leftFoot = rig.getPoint('leftFoot');
  const rightFoot = rig.getPoint('rightFoot');
  const hand = rig.getPoint('leftHand');

  rig.beginDrag({ jointId: 'leftHand', kind: 'joint', anchorWorld: hand });
  rig.updateDragTarget({ x: -100, y: 100, z: 50 });
  assert.ok(rig.getMaxBoneError() < 2e-5, 'Extreme drag produced visible bone stretching.');
  assert.ok(rig.getMaxJointLimitViolation() < 4, 'Extreme drag escaped the anatomical envelope.');
  assert.ok(rig.getRigidPelvisError() < 1e-4, 'Extreme drag opened the rigid pelvis.');
  assert.ok(rig.getDragTargetError() > 10, 'An unreachable target incorrectly forced the rig to the mouse.');
  rig.endDrag({ keepMomentum: false });
  for (let frame = 0; frame < 60; frame += 1) rig.step(1 / 60);

  assertSolved(rig, 'Unreachable target after settling');
  assert.ok(vectorDistance(leftFoot, rig.getPoint('leftFoot')) < 1e-10, 'Left pinned foot moved.');
  assert.ok(vectorDistance(rightFoot, rig.getPoint('rightFoot')) < 1e-10, 'Right pinned foot moved.');
  assertBindUnchanged(definition, immutableBind, 'Unreachable target changed immutable model dimensions.');
}

// Conflicting pose JSON is reconciled against the revised fixed rig.
{
  const { definition, rig } = createRig();
  const immutableBind = bindSnapshot(definition);
  const payload = buildPosePayload(definition);
  for (const item of payload.joints) {
    if (item.id === 'leftLowerArm') {
      item.poseWorldPosition = { x: 0, y: 0, z: 0 };
      item.pinned = true;
    }
    if (item.id === 'leftHand') {
      item.poseWorldPosition = { x: 5, y: 5, z: 5 };
      item.pinned = true;
    }
  }
  assert.equal(applyPosePayload(definition, payload), 28);
  rig.resetFromDefinitionPose({ project: true });
  assertSolved(rig, 'Reconciled imported pose');
  assert.equal(definition.joints.find((joint) => joint.id === 'leftLowerArm').pinned, true);
  assert.equal(definition.joints.find((joint) => joint.id === 'leftHand').pinned, true);
  assertBindUnchanged(definition, immutableBind, 'Pose JSON changed immutable model dimensions.');
}

// Export records hidden and physical links separately.
{
  const { definition, rig } = createRig();
  const hand = rig.getPoint('rightHand');
  rig.moveJointTo('rightHand', { x: hand.x + 0.25, y: hand.y + 0.15, z: hand.z + 0.1 });
  const exported = buildExportPayload(definition);
  assert.equal(exported.dimensionsLocked, true);
  assert.equal(exported.schemaVersion, 6);
  assert.ok(exported.joints.every((joint) => 'localPosition' in joint));
  assert.ok(exported.joints.every((joint) => 'poseWorldPosition' in joint));
  assert.equal(exported.joints.find((joint) => joint.id === 'hips').lengthLocked, false);
  assert.equal(exported.joints.find((joint) => joint.id === 'hips').visualBone, false);
  assert.equal(exported.joints.find((joint) => joint.id === 'leftUpperLeg').lengthLocked, true);
  assert.equal(exported.joints.find((joint) => joint.id === 'leftUpperLeg').visualBone, false);
  assert.ok(Math.abs(calculateRigHeight(definition) - 1.795672) < 1e-9);

  const pose = computePoseWorldPositions(definition);
  for (const joint of definition.joints) {
    if (!joint.parentId || joint.physicalBone === false) continue;
    const actualLength = vectorDistance(pose.get(joint.parentId), pose.get(joint.id));
    assert.ok(Math.abs(actualLength - getBoneLength(definition, joint.id)) < LENGTH_TOLERANCE);
  }
}



// The platform-side contract adapter normalizes historical foot aliases and
// never labels a legacy world-position payload as a canonical PoseSnapshot.
{
  assert.equal(canonicalPinId('leftAnkle'), 'leftFoot');
  assert.deepEqual(normalizePinnedJointIds(['leftAnkle', 'leftFoot', 'rightAnkle']), ['leftFoot', 'rightFoot']);
  const legacy = {
    schemaVersion: 1,
    type: 'humanoid-pose',
    pose: 'A',
    updatedAt: '2026-08-19T00:00:00.000Z',
    joints: [
      { id: 'leftFoot', pinned: false, poseWorldPosition: { x: 0, y: 0, z: 0 } },
      { id: 'rightFoot', pinned: false, poseWorldPosition: { x: 0, y: 0, z: 0 } },
    ],
  };
  const pinnedLegacy = updateLegacyPin(legacy, 'leftAnkle', true);
  assert.equal(pinnedLegacy.joints[0].pinned, true);
  assert.equal(legacy.joints[0].pinned, false, 'Legacy pin update mutated the source payload.');

  const state = {
    activeVersions: { rig: 'rig@0.4.0', pose: 'pose@0.3.1' },
    character: {
      pose: { name: 'A Pose', joints: {}, pinned: ['leftAnkle'], v8Payload: pinnedLegacy },
      physics: { bodyCoupling: 0.8, damping: 0.92, jointLimits: true, groundEnabled: true },
    },
  };
  assert.equal(inspectPoseContract(state).status, 'legacy-world-position');
  const exported = buildStandalonePoseExport(state, 5);
  assert.equal(exported.type, 'PoseModuleExport');
  assert.equal(exported.poseSnapshot, null);
  assert.equal(exported.legacyWorldPose.type, 'humanoid-pose');
  assert.deepEqual(exported.pinnedJointIds, ['leftFoot']);
}

// The pelvis is a rigid four-point cluster. Its width and both diagonal braces
// survive sequential extreme arm and leg requests without changing bind data.
{
  const { definition, rig } = createRig({ solverIterations: 96 });
  const immutableBind = bindSnapshot(definition);
  const pelvisIds = ['hips', 'spine', 'leftUpperLeg', 'rightUpperLeg'];
  const reference = new Map();
  for (let first = 0; first < pelvisIds.length; first += 1) {
    for (let second = first + 1; second < pelvisIds.length; second += 1) {
      const key = `${pelvisIds[first]}:${pelvisIds[second]}`;
      reference.set(key, vectorDistance(rig.getPoint(pelvisIds[first]), rig.getPoint(pelvisIds[second])));
    }
  }

  const hand = rig.getPoint('leftHandEnd');
  rig.moveJointTo('leftHandEnd', { x: hand.x + 1.5, y: hand.y + 1.2, z: hand.z - 1.5 });
  const toes = rig.getPoint('leftToesEnd');
  rig.moveJointTo('leftToesEnd', { x: toes.x + 1.2, y: toes.y + 1.5, z: toes.z - 1.2 });

  for (const [key, expected] of reference) {
    const [idA, idB] = key.split(':');
    const actual = vectorDistance(rig.getPoint(idA), rig.getPoint(idB));
    assert.ok(Math.abs(actual - expected) < PELVIS_TOLERANCE, `${key} opened by ${Math.abs(actual - expected)} m.`);
  }
  const beforePins = pointMap(rig, definition);
  rig.setPinned('leftFoot', true);
  rig.setPinned('rightFoot', true);
  for (const joint of definition.joints) {
    assert.ok(
      pointMovement(beforePins.get(joint.id), rig.getPoint(joint.id)) < 1e-12,
      `Pinning the current supports moved ${joint.id}.`,
    );
  }
  assertSolved(rig, 'Rigid pelvis cluster after sequential extreme requests');

  const extremeSnapshot = rig.buildPoseSnapshot({ includeWorldPositions: true });
  const restoredDefinition = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
  const restoredBind = bindSnapshot(restoredDefinition);
  const restoredRig = new PhysicsRig(restoredDefinition, {
    solverIterations: 96,
    exactMaxPasses: 960,
    exactTolerance: 1e-8,
    groundEnabled: true,
    gravityEnabled: false,
  });
  assert.ok(restoredRig.applyPoseSnapshot(extremeSnapshot) >= 24);
  const importStats = restoredRig.getPoseImportStats();
  assert.equal(importStats.requestedPins, 2);
  assert.equal(importStats.appliedPins, 2);
  assert.equal(importStats.preservePinTargets, false);
  assert.ok(importStats.maximumPinRemapErrorM < 1e-3);

  let maximumExtremeRoundTripError = 0;
  for (const [jointId, expected] of Object.entries(extremeSnapshot.worldPositions)) {
    const actual = restoredRig.getPoint(jointId);
    maximumExtremeRoundTripError = Math.max(
      maximumExtremeRoundTripError,
      vectorDistance(actual, { x: expected[0], y: expected[1], z: expected[2] }),
    );
  }
  assert.ok(
    maximumExtremeRoundTripError < 1e-3,
    `Extreme PoseSnapshot round trip error ${maximumExtremeRoundTripError} m.`,
  );
  assertSolved(restoredRig, 'Restored extreme rigid-pelvis PoseSnapshot');
  assertBindUnchanged(restoredDefinition, restoredBind, 'Extreme PoseSnapshot import changed target bind dimensions.');
  assertBindUnchanged(definition, immutableBind, 'Rigid pelvis projection changed immutable bind dimensions.');
}

// Shared physics controls map to the solver without silently resetting values.
// The rigid pelvis remains active when the optional anatomical angle layer is off.
{
  const { definition, rig } = createRig();
  const immutableBind = bindSnapshot(definition);
  rig.setOptions({ bodyCoupling: 0.35, damping: 0.81, jointLimits: false });
  assert.equal(rig.getOptions().bodyCoupling, 0.35);
  assert.equal(rig.getOptions().damping, 0.81);
  assert.equal(rig.getOptions().jointLimits, false);
  assert.equal(definition.physics.bodyCoupling, 0.35);
  assert.equal(definition.physics.jointLimits, false);
  assert.equal(definition.biomechanics.hardLimits, false);
  assert.equal(rig.getJointLimitInfo('leftLowerArm').currentLabel, '关节限制已关闭');

  const hand = rig.getPoint('leftHand');
  rig.moveJointTo('leftHand', { x: hand.x - 0.45, y: hand.y + 0.35, z: hand.z + 0.2 });
  assert.ok(rig.getMaxBoneError() < LENGTH_TOLERANCE);
  assert.ok(rig.getRigidPelvisError() < PELVIS_TOLERANCE, 'Disabling angle limits disabled the rigid pelvis.');

  rig.setOptions({ bodyCoupling: undefined, damping: undefined, jointLimits: true });
  assert.equal(rig.getOptions().bodyCoupling, 0.35);
  assert.equal(rig.getOptions().damping, 0.81);
  assert.equal(rig.getOptions().jointLimits, true);
  rig.projectPrimaryExact({ tolerance: 1e-8, maxPasses: 960, includeGround: true });
  assertSolved(rig, 'Re-enabled anatomical limits');
  assertBindUnchanged(definition, immutableBind, 'Physics control changes modified bind dimensions.');
}

// bodyCoupling is a real solver input. Identical hand targets produce distinct
// whole-body solutions while both results preserve hard structural constraints.
{
  const solveWithCoupling = (bodyCoupling) => {
    const { rig } = createRig({ bodyCoupling });
    const hand = rig.getPoint('leftHand');
    rig.moveJointTo('leftHand', { x: hand.x - 0.4, y: hand.y + 0.25, z: hand.z + 0.15 });
    assertSolved(rig, `bodyCoupling ${bodyCoupling}`);
    return rig.getPoint('hips');
  };
  const uncoupled = solveWithCoupling(0);
  const coupled = solveWithCoupling(1);
  assert.ok(vectorDistance(uncoupled, coupled) > 0.005, 'bodyCoupling did not change the whole-body solution.');
}

// Canonical PoseSnapshot exports root transform, normalized local quaternions,
// transient IK targets, named pins and constraints. Applying it leaves bind data
// untouched and reconciles the result through fixed-length constraints.
{
  const { definition, rig } = createRig();
  const immutableBind = bindSnapshot(definition);
  rig.setPinned('leftFoot', true);
  rig.setPinned('rightFoot', true);
  const hand = rig.getPoint('leftHand');
  rig.beginDrag({ jointId: 'leftHand', kind: 'joint', anchorWorld: hand });
  rig.updateDragTarget({ x: hand.x - 0.35, y: hand.y + 0.2, z: hand.z + 0.12 });

  const preview = rig.buildPoseSnapshot();
  assert.deepEqual(validatePoseSnapshot(preview), { valid: true, errors: [] });
  assert.equal(preview.schema, 'humanoid_rig/pose_snapshot@1.0');
  assert.equal(preview.type, 'PoseSnapshot');
  assert.equal(preview.compatibleRig, 'rig@0.4.0');
  assert.equal(preview.rotationSpace, 'local');
  assert.equal(preview.rotationConvention, 'incoming_bone_bind_delta_zero_twist');
  assert.equal(preview.sourceRepresentation, 'world_position_pbd');
  assert.equal(preview.rootTranslation.length, 3);
  assert.equal(preview.rootRotation.length, 4);
  assert.ok(Object.keys(preview.localRotations).length >= 24);
  assert.equal(preview.ikTargets.length, 1);
  assert.equal(preview.ikTargets[0].jointId, 'leftHand');
  assert.equal(preview.pinnedJoints.leftFoot.jointId, 'leftFoot');
  assert.equal(preview.pinnedJoints.rightFoot.jointId, 'rightFoot');
  assert.equal('worldPositions' in preview, false, 'Derived world positions entered the canonical snapshot by default.');
  assert.equal(preview.diagnostics.rotationDataCompleteness, 'bone_direction_only');
  assert.equal(preview.diagnostics.twistDataAvailable, false);
  assert.equal(preview.diagnostics.jointAxisAdapterRequiredForStandardAnimation, true);
  assert.equal(preview.diagnostics.lossyRotationConversion, true);
  assert.equal(preview.diagnostics.positionReconstructionLossy, false);
  assert.deepEqual(preview.diagnostics.warningCodes, ['AXIAL_TWIST_UNAVAILABLE_FROM_WORLD_POSITION_SOURCE']);
  assert.ok(preview.diagnostics.rotationReconstructionMaxErrorM < 1e-4);
  assert.ok(!JSON.stringify(preview).includes('boneLength'), 'PoseSnapshot contains bind bone lengths.');
  assert.ok(!JSON.stringify(preview).includes('localPosition'), 'PoseSnapshot contains bind local positions.');
  const canonicalState = {
    activeVersions: { rig: 'rig@0.4.0', pose: 'pose@0.3.2' },
    character: {
      pose: { name: 'Custom Pose', joints: {}, pinned: ['leftFoot', 'rightFoot'], v8Payload: preview },
      physics: { bodyCoupling: 0.8, damping: 0.92, jointLimits: true, groundEnabled: true },
    },
  };
  const canonicalContract = inspectPoseContract(canonicalState);
  assert.equal(canonicalContract.status, 'canonical');
  assert.ok(canonicalContract.detail.includes('轴向扭转'));
  assert.deepEqual(canonicalContract.warningCodes, ['AXIAL_TWIST_UNAVAILABLE_FROM_WORLD_POSITION_SOURCE']);
  assert.deepEqual(
    buildStandalonePoseExport(canonicalState, 5).contract.warningCodes,
    ['AXIAL_TWIST_UNAVAILABLE_FROM_WORLD_POSITION_SOURCE'],
  );

  for (const quaternion of [preview.rootRotation, ...Object.values(preview.localRotations)]) {
    const length = Math.hypot(...quaternion);
    assert.ok(Math.abs(length - 1) < 1e-10, `Non-normalized quaternion length ${length}.`);
  }

  rig.endDrag({ keepMomentum: false });
  const committed = rig.buildPoseSnapshot({ includeWorldPositions: true });
  assert.equal(committed.ikTargets.length, 0);
  assert.ok(committed.worldPositions.leftHand.length === 3);

  const invalidDefinition = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
  const invalidRig = new PhysicsRig(invalidDefinition, {
    solverIterations: 64,
    exactMaxPasses: 960,
    exactTolerance: 1e-8,
    groundEnabled: true,
    gravityEnabled: false,
  });
  const invalidSnapshot = structuredClone(committed);
  invalidSnapshot.localRotations.leftHand = [0, 0, 0, 0];
  assert.throws(
    () => invalidRig.applyPoseSnapshot(invalidSnapshot),
    /localRotations\.leftHand must be a normalized quaternion/,
  );

  const targetDefinition = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
  const targetBind = bindSnapshot(targetDefinition);
  const targetRig = new PhysicsRig(targetDefinition, {
    solverIterations: 64,
    exactMaxPasses: 960,
    exactTolerance: 1e-8,
    groundEnabled: true,
    gravityEnabled: false,
  });
  assert.ok(targetRig.applyPoseSnapshot(committed) >= 24);
  assert.ok(targetRig.getPinnedConstraints().leftFoot);
  assert.ok(targetRig.getPinnedConstraints().rightFoot);
  let maximumRoundTripError = 0;
  for (const [jointId, expected] of Object.entries(committed.worldPositions)) {
    const actual = targetRig.getPoint(jointId);
    maximumRoundTripError = Math.max(
      maximumRoundTripError,
      vectorDistance(actual, { x: expected[0], y: expected[1], z: expected[2] }),
    );
  }
  assert.ok(maximumRoundTripError < 1e-3, `PoseSnapshot round trip error ${maximumRoundTripError} m.`);
  assertSolved(targetRig, 'Applied canonical PoseSnapshot');
  assertBindUnchanged(definition, immutableBind, 'PoseSnapshot export changed source bind dimensions.');
  assertBindUnchanged(targetDefinition, targetBind, 'PoseSnapshot import changed target bind dimensions.');
}


// A single-image observation is retargeted onto the active fixed-dimension rig,
// saved as an image-pose asset, mirrored deterministically, and exposed through
// both the canonical quaternion contract and the current 3D world-pose bridge.
{
  const sourceDefinition = createDefinitionForBodyProfile({});
  const sourceBind = bindSnapshot(sourceDefinition);
  const sourceRig = new PhysicsRig(sourceDefinition, {
    solverIterations: 96,
    exactMaxPasses: 960,
    exactTolerance: 1e-8,
    groundEnabled: true,
    gravityEnabled: false,
    jointLimits: true,
  });
  const sourceHand = sourceRig.getPoint('leftHandEnd');
  sourceRig.moveJointTo('leftHandEnd', {
    x: sourceHand.x - 0.18,
    y: sourceHand.y + 0.48,
    z: sourceHand.z + 0.22,
  });
  const sourceToes = sourceRig.getPoint('rightToesEnd');
  sourceRig.moveJointTo('rightToesEnd', {
    x: sourceToes.x + 0.12,
    y: sourceToes.y + 0.18,
    z: sourceToes.z + 0.16,
  });
  sourceRig.commitCurrentPose();
  assertSolved(sourceRig, 'Synthetic source image pose');
  assertBindUnchanged(sourceDefinition, sourceBind, 'Synthetic source pose changed bind dimensions.');

  const observation = createSyntheticImageObservation(sourceRig);
  const normalizedEstimatorResult = normalizePoseLandmarkerResult({
    landmarks: [observation.landmarks],
    worldLandmarks: [observation.worldLandmarks],
  }, { width: 1200, height: 1800 }, {
    delegate: 'CPU',
    inferenceMs: 2.5,
    createdAt: '2026-08-19T00:00:00.000Z',
  });
  assert.equal(normalizedEstimatorResult.landmarks.length, 33);
  assert.equal(normalizedEstimatorResult.worldLandmarks.length, 33);
  assert.equal(normalizedEstimatorResult.image.aspectRatio, 2 / 3);
  assert.equal(normalizedEstimatorResult.confidence.lowConfidenceIndices.length, 0);
  const coordinatesOnlyLandmarks = observation.landmarks.map(({ index, name, x, y, z }) => ({ index, name, x, y, z }));
  const coordinatesOnlyResult = normalizePoseLandmarkerResult({
    landmarks: [coordinatesOnlyLandmarks],
    worldLandmarks: [],
  }, { width: 1200, height: 1800 });
  assert.equal(coordinatesOnlyResult.confidence.overall, 0);
  assert.equal(coordinatesOnlyResult.confidence.minimum, 0);
  assert.throws(
    () => normalizePoseLandmarkerResult({ landmarks: [] }, { width: 1, height: 1 }),
    /没有检测到完整人物/,
  );

  const targetDefinition = createDefinitionForBodyProfile({
    height: 1.95,
    shoulderWidth: 0.46,
    hipWidth: 0.25,
    upperArmLength: 0.31,
    forearmLength: 0.27,
    thighLength: 0.47,
    lowerLegLength: 0.44,
  });
  const targetBind = bindSnapshot(targetDefinition);
  const candidate = retargetPoseObservation({
    definition: targetDefinition,
    observation,
    compatibleRig: 'rig@0.4.0',
    name: 'Synthetic raised-left-hand pose',
    assetId: 'image-pose-test-001',
    physics: {
      bodyCoupling: 0.8,
      damping: 0.92,
      jointLimits: true,
    },
    settings: {
      mirror: false,
      invertDepth: false,
      depthScale: 1,
      autoPinFeet: true,
      preserveRootPosition: true,
      groundEnabled: true,
      groundY: 0,
    },
  });
  assert.equal(candidate.schema, 'humanoid_rig/image_pose_candidate@1.0');
  assert.equal(candidate.compatibleRig, 'rig@0.4.0');
  assert.equal(candidate.legacyWorldPose.type, 'humanoid-pose');
  assert.equal(candidate.legacyWorldPose.joints.length, 28);
  assert.deepEqual(validatePoseSnapshot(candidate.poseSnapshot), { valid: true, errors: [] });
  assert.ok(Object.keys(candidate.poseSnapshot.localRotations).length >= 24);
  assert.ok(candidate.poseSnapshot.ikTargets.length >= 12);
  assert.ok(candidate.poseSnapshot.ikTargets.every((target) => target.transient === false));
  assert.equal(candidate.poseSnapshot.constraints.fixedBoneLengths, true);
  assert.equal(candidate.poseSnapshot.constraints.rigidPelvis, true);
  assert.ok(candidate.quality.maxBoneErrorM < LENGTH_TOLERANCE);
  assert.ok(candidate.quality.rigidPelvisErrorM < PELVIS_TOLERANCE);
  assert.ok(candidate.quality.maxJointLimitViolationDegrees < ANGLE_TOLERANCE);
  assert.ok(candidate.contacts.some((contact) => contact.jointId === 'leftFoot'));
  assert.equal(candidate.quality.manualReviewRequired, false);
  assert.ok(!JSON.stringify(candidate.poseSnapshot).includes('boneLength'));
  assert.ok(!JSON.stringify(candidate.poseSnapshot).includes('localPosition'));
  for (const quaternion of [candidate.poseSnapshot.rootRotation, ...Object.values(candidate.poseSnapshot.localRotations)]) {
    assert.ok(Math.abs(Math.hypot(...quaternion) - 1) < 1e-10, 'Image pose produced a non-normalized quaternion.');
  }
  const candidateJoints = Object.fromEntries(
    candidate.legacyWorldPose.joints.map((joint) => [joint.id, joint.poseWorldPosition]),
  );
  assert.ok(candidateJoints.leftHand.y > candidateJoints.rightHand.y + 0.25, 'Raised left hand was not reconstructed.');
  assertBindUnchanged(targetDefinition, targetBind, 'Image retargeting changed target bind dimensions.');

  const lowConfidenceObservation = structuredClone(observation);
  lowConfidenceObservation.landmarks.forEach((landmark) => {
    landmark.visibility = 0;
    landmark.presence = 0;
  });
  lowConfidenceObservation.confidence = {
    overall: 0,
    minimum: 0,
    lowConfidenceIndices: Array.from({ length: 33 }, (_, index) => index),
    lowConfidenceNames: [],
  };
  const blockedCandidate = retargetPoseObservation({
    definition: targetDefinition,
    observation: lowConfidenceObservation,
    compatibleRig: 'rig@0.4.0',
    settings: { autoPinFeet: true, groundEnabled: true },
  });
  assert.equal(blockedCandidate.quality.canApply, false);
  assert.equal(blockedCandidate.quality.applyBlocked, true);
  assert.ok(blockedCandidate.quality.applyBlockReasons.includes('INSUFFICIENT_BODY_CONFIDENCE'));
  assert.ok(blockedCandidate.quality.warningCodes.includes('CRITICAL_LANDMARKS_UNRELIABLE'));

  const noisyArmObservation = structuredClone(observation);
  for (const index of [13, 15]) {
    noisyArmObservation.landmarks[index].x = 0.99;
    noisyArmObservation.landmarks[index].y = 0.01;
    noisyArmObservation.landmarks[index].z = -2;
    noisyArmObservation.landmarks[index].visibility = 0;
    noisyArmObservation.landmarks[index].presence = 0;
  }
  const noisyArmCandidate = retargetPoseObservation({
    definition: targetDefinition,
    observation: noisyArmObservation,
    compatibleRig: 'rig@0.4.0',
    settings: { autoPinFeet: true, groundEnabled: true },
  });
  assert.equal(noisyArmCandidate.quality.canApply, true);
  assert.ok(!noisyArmCandidate.poseSnapshot.ikTargets.some((target) => [13, 15].includes(target.sourceLandmarkIndex)));

  const appliedDefinition = createDefinitionForBodyProfile({
    height: 1.95,
    shoulderWidth: 0.46,
    hipWidth: 0.25,
    upperArmLength: 0.31,
    forearmLength: 0.27,
    thighLength: 0.47,
    lowerLegLength: 0.44,
  });
  const appliedBind = bindSnapshot(appliedDefinition);
  const appliedRig = new PhysicsRig(appliedDefinition, {
    solverIterations: 96,
    exactMaxPasses: 960,
    exactTolerance: 1e-8,
    groundEnabled: true,
    gravityEnabled: false,
  });
  assert.ok(appliedRig.applyPoseSnapshot(candidate.poseSnapshot) >= 24);
  assertSolved(appliedRig, 'Applied image PoseSnapshot');
  assertBindUnchanged(appliedDefinition, appliedBind, 'Applying image PoseSnapshot changed bind dimensions.');

  const mirrored = retargetPoseObservation({
    definition: targetDefinition,
    observation,
    compatibleRig: 'rig@0.4.0',
    name: 'Synthetic mirrored pose',
    assetId: 'image-pose-test-mirror',
    physics: { bodyCoupling: 0.8, damping: 0.92, jointLimits: true },
    settings: { mirror: true, autoPinFeet: true, groundEnabled: true },
  });
  const mirroredJoints = Object.fromEntries(
    mirrored.legacyWorldPose.joints.map((joint) => [joint.id, joint.poseWorldPosition]),
  );
  assert.ok(mirroredJoints.rightHand.y > mirroredJoints.leftHand.y + 0.25, 'Mirror correction did not swap the raised arm.');
  assert.ok(mirrored.contacts.some((contact) => contact.jointId === 'rightFoot'));

  const imageOnlyObservation = structuredClone(observation);
  imageOnlyObservation.worldLandmarks = [];
  const imageOnlyCandidate = retargetPoseObservation({
    definition: targetDefinition,
    observation: imageOnlyObservation,
    compatibleRig: 'rig@0.4.0',
    settings: { depthScale: 0.8, autoPinFeet: true, groundEnabled: true },
  });
  assert.equal(imageOnlyCandidate.quality.usesWorldLandmarks, false);
  assert.ok(imageOnlyCandidate.quality.warningCodes.includes('WORLD_LANDMARKS_UNAVAILABLE_USING_IMAGE_DEPTH'));
  assert.equal(imageOnlyCandidate.quality.manualReviewRequired, true);
  assert.equal(imageOnlyCandidate.quality.depthMode, 'image_depth_heuristic');

  const bentImageObservation = structuredClone(imageOnlyObservation);
  for (const index of [0, 7, 8, 11, 12, 13, 14, 15, 16]) {
    bentImageObservation.landmarks[index].y = Math.min(0.98, bentImageObservation.landmarks[index].y + 0.38);
  }
  const bentImageCandidate = retargetPoseObservation({
    definition: targetDefinition,
    observation: bentImageObservation,
    compatibleRig: 'rig@0.4.0',
    settings: { depthScale: 0.8, autoPinFeet: true, groundEnabled: true },
  });
  assert.ok(
    bentImageCandidate.quality.sourceFrame.up.y < 0,
    'Image Y-axis inference flipped a crouched or forward-bent pose upside down.',
  );

  const outlierImageObservation = structuredClone(imageOnlyObservation);
  outlierImageObservation.landmarks[15].z = 4;
  const outlierImageCandidate = retargetPoseObservation({
    definition: targetDefinition,
    observation: outlierImageObservation,
    compatibleRig: 'rig@0.4.0',
    settings: { depthScale: 1, autoPinFeet: true, groundEnabled: true },
  });
  assert.ok(outlierImageCandidate.quality.depthClampCount > 0);
  assert.ok(outlierImageCandidate.quality.warningCodes.includes('IMAGE_DEPTH_OUTLIER_CLAMPED'));

  const asset = createImagePoseAsset(candidate, {
    fileName: 'synthetic-pose.png',
    mimeType: 'image/png',
    byteLength: 1024,
    width: 1200,
    height: 1800,
    contentHash: 'sha256:test',
    storage: 'indexeddb',
  });
  assert.equal(asset.schema, 'humanoid_rig/image_pose_asset@1.0');
  const library = normalizeImagePoseLibrary({ assets: [asset], activeAssetId: asset.id });
  assert.equal(library.schema, 'humanoid_rig/image_pose_library@1.0');
  assert.equal(library.activeAssetId, asset.id);
  assert.equal(library.assets.length, 1);

  const dualState = {
    activeVersions: { rig: 'rig@0.4.0', pose: 'pose@0.4.0' },
    modules: { pose: { imagePose: library } },
    character: {
      pose: {
        name: asset.name,
        joints: candidate.preview2D,
        pinned: candidate.contacts.map((contact) => contact.jointId),
        v8Payload: candidate.legacyWorldPose,
        poseSnapshot: candidate.poseSnapshot,
        imagePoseAssetId: asset.id,
      },
      physics: { bodyCoupling: 0.8, damping: 0.92, jointLimits: true, groundEnabled: true },
    },
  };
  const dualContract = inspectPoseContract(dualState);
  assert.equal(dualContract.status, 'canonical');
  assert.equal(dualContract.bridgeMode, 'canonical-plus-legacy-view-bridge');
  const dualExport = buildStandalonePoseExport(dualState, 5);
  assert.equal(dualExport.poseSnapshot.type, 'PoseSnapshot');
  assert.equal(dualExport.legacyWorldPose.type, 'humanoid-pose');
  assert.equal(dualExport.imagePoseAssetId, asset.id);

  const rightPinnedLegacy = updateLegacyPin(candidate.legacyWorldPose, 'rightFoot', true);
  const rightPinnedSnapshot = updatePoseSnapshotPin(
    candidate.poseSnapshot,
    'rightFoot',
    true,
    rightPinnedLegacy,
  );
  assert.equal(rightPinnedSnapshot.sourceLegacyUpdatedAt, rightPinnedLegacy.updatedAt);
  assert.equal(rightPinnedSnapshot.pinnedJoints.rightFoot.jointId, 'rightFoot');
  assert.equal(validatePoseSnapshot(rightPinnedSnapshot).valid, true);
}


// Source images are retained inside the website storage adapter. The Node test
// exercises its deterministic in-memory fallback used when IndexedDB is absent.
{
  const storageId = 'image-pose-source-test';
  const sourceBlob = new Blob(['image-pose-test-bytes'], { type: 'image/png' });
  assert.equal(await saveImagePoseSource(storageId, sourceBlob), true);
  const restoredBlob = await loadImagePoseSource(storageId);
  assert.ok(restoredBlob instanceof Blob);
  assert.equal(await restoredBlob.text(), 'image-pose-test-bytes');
  assert.equal(await deleteImagePoseSource(storageId), true);
  assert.equal(await loadImagePoseSource(storageId), null);
}

console.log('V8.4 fixed dimensions, whole-body propagation, and anatomical ROM checks passed.');
