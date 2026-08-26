import assert from 'node:assert/strict';
import {
  HumanCoreRuntime,
  ProceduralDeformRuntimeV5,
  PROCEDURAL_DEFORM_VALIDATION_POSE_IDS_V5,
  compareProceduralRigSurfaceAnchorsV5,
  createBodyDNA,
  createMirroredProceduralDeformValidationPoseV5,
  createProceduralDeformValidationPoseV5,
  createProceduralSimulationRigFrameV5,
  getHumanRigJointV5,
  measureProceduralDeformValidationPoseV5,
  resolveProceduralSimulationRigJointV5,
} from '../src/modules/human-core-v5/index.js';

const dna = createBodyDNA({
  bodyDNAId: 'procedural-deform-validation',
  identity: { humanId: 'procedural-deform-validation' },
  proportionRevision: 14,
});
const human = new HumanCoreRuntime();
human.createHuman(dna);
const rigCore = human.getRigCore();
const topologyFingerprint = rigCore.topology.fingerprint;
const runtime = new ProceduralDeformRuntimeV5();
runtime.compileHuman({ bodyDNA: dna, rigCore });
await runtime.generateCanonicalSurface({ resolution: 28, worker: false });

let maximumSymmetricRegionDimensionDifference = 0;
for (const [leftName, rightName] of [
  ['leftUpperArm', 'rightUpperArm'], ['leftForearm', 'rightForearm'], ['leftPalm', 'rightPalm'],
  ['leftThigh', 'rightThigh'], ['leftCalf', 'rightCalf'], ['leftFoot', 'rightFoot'],
]) {
  const leftDimensions = regionDimensions(runtime.surface, leftName);
  const rightDimensions = regionDimensions(runtime.surface, rightName);
  for (let axis = 0; axis < 3; axis += 1) {
    const difference = Math.abs(leftDimensions[axis] - rightDimensions[axis]) / Math.max(leftDimensions[axis], rightDimensions[axis], 1e-9);
    maximumSymmetricRegionDimensionDifference = Math.max(maximumSymmetricRegionDimensionDifference, difference);
    assert.ok(difference <= 0.02, `${leftName}/${rightName} axis ${axis} differed by ${(difference * 100).toFixed(3)}%.`);
  }
}

const focusPose = createProceduralDeformValidationPoseV5({ poseId: 't-pose', rigCore, bodyDNA: dna, timestamp: 99 });
const focusSimulationRig = createProceduralSimulationRigFrameV5({ finalPose: focusPose, rigCore, bodyDNA: dna });
for (const [requestedJointId, expectedJointId] of [
  ['leftShoulder', 'leftShoulder'],
  ['leftLowerArm', 'leftLowerArm'],
  ['leftHip', 'leftUpperLeg'],
  ['leftKnee', 'leftLowerLeg'],
]) {
  const resolved = resolveProceduralSimulationRigJointV5(focusSimulationRig, requestedJointId);
  assert.equal(resolved?.resolvedJointId, expectedJointId, `${requestedJointId} did not resolve to a concrete SimulationRig joint.`);
  assert.equal(resolved?.joint, focusSimulationRig.joints[expectedJointId]);
}
assert.equal(resolveProceduralSimulationRigJointV5(focusSimulationRig, 'missingJoint'), null);

const results = {};
let referenceLengths = null;
for (const poseId of PROCEDURAL_DEFORM_VALIDATION_POSE_IDS_V5) {
  const pose = createProceduralDeformValidationPoseV5({ poseId, rigCore, bodyDNA: dna, timestamp: 100 });
  for (const record of pose.constraintState.validationPose.requestedAngles) {
    const source = getHumanRigJointV5(rigCore, record.jointId).axisReference[axisKey(record.anatomicalChannel)];
    assert.deepEqual(record.sourceLocalAxis, source, `${poseId}/${record.jointId} did not retain HumanRigCore as the axis source.`);
    assert.ok(Math.abs(Math.hypot(...record.resolvedLocalAxis) - 1) < 1e-6, `${poseId}/${record.jointId} resolved axis is not normalized.`);
    assert.ok(Math.abs(Math.hypot(...record.resultQuaternion) - 1) < 1e-8, `${poseId}/${record.jointId} quaternion is not normalized.`);
  }
  human.updatePose(pose);
  const deformFrame = runtime.update({ finalPose: pose, anatomyState: human.getAnatomyState(), deltaTime: 1 / 60 });
  const simulationRig = createProceduralSimulationRigFrameV5({ finalPose: pose, rigCore, bodyDNA: dna });
  const measurements = measureProceduralDeformValidationPoseV5({ finalPose: pose, simulationRigFrame: simulationRig });
  const anchorAudit = compareProceduralRigSurfaceAnchorsV5(simulationRig, deformFrame.regionDiagnostics);
  assert.equal(simulationRig.poseAuthority, 'finalPose.localRotations');
  assert.match(simulationRig.source, /V4Adapter\(T Pose RigDefinition\) forward kinematics/);
  assert.equal(anchorAudit.passed, true, `${poseId} Rig-to-surface anchors exceeded the fixed 2 cm/1 cm gates.`);
  const lengths = Object.fromEntries(Object.values(simulationRig.joints).filter((joint) => joint.parentId).map((joint) => [joint.jointId, Math.hypot(...joint.bindLocalPosition)]));
  if (!referenceLengths) referenceLengths = lengths;
  else for (const [jointId, length] of Object.entries(referenceLengths)) assert.ok(Math.abs(lengths[jointId] - length) < 1e-10, `${poseId} changed ${jointId} bind length.`);
  results[poseId] = { measurements, anchorAudit };
}

near(results['t-pose'].measurements.leftArmAbductionDegrees, 90, 2, 'T Pose left arm');
near(results['t-pose'].measurements.rightArmAbductionDegrees, 90, 2, 'T Pose right arm');
near(results['arm-raise-90-left'].measurements.leftArmAbductionDegrees, 90, 2, 'Arm Raise 90');
near(results['arm-raise-150-left'].measurements.leftArmAbductionDegrees, 150, 3, 'Arm Raise 150');
near(results['elbow-bend-140-left'].measurements.leftElbowBendDegrees, 140, 3, 'Elbow Bend 140');
near(results['forearm-twist-180-left'].measurements.leftForearmTwistDegrees, 180, 3, 'Forearm Twist 180');
near(results['hip-flex-left'].measurements.leftHipFlexDegrees, 55, 1, 'Hip Flex left independent FK');
near(results['knee-bend-left'].measurements.leftKneeBendDegrees, 110, 1, 'Knee Bend left independent FK');
for (const [sourcePoseId, mirroredPoseId, measurementKey, requested] of [
  ['hip-flex-left', 'hip-flex-right', 'rightHipFlexDegrees', 55],
  ['knee-bend-left', 'knee-bend-right', 'rightKneeBendDegrees', 110],
]) {
  const mirroredPose = createMirroredProceduralDeformValidationPoseV5(
    createProceduralDeformValidationPoseV5({ poseId: sourcePoseId, rigCore, bodyDNA: dna, timestamp: 101 }),
    mirroredPoseId,
  );
  const mirroredRig = createProceduralSimulationRigFrameV5({ finalPose: mirroredPose, rigCore, bodyDNA: dna });
  const mirroredMeasurements = measureProceduralDeformValidationPoseV5({ finalPose: mirroredPose, simulationRigFrame: mirroredRig });
  near(mirroredMeasurements[measurementKey], requested, 1, `${mirroredPoseId} independent FK`);
}
assert.equal(rigCore.topology.fingerprint, topologyFingerprint, 'Validation poses changed the authoritative Rig topology.');

const maximumAnchorErrorMeters = Math.max(...Object.values(results).map((entry) => entry.anchorAudit.maximumErrorMeters));
const maximumMeanAnchorErrorMeters = Math.max(...Object.values(results).map((entry) => entry.anchorAudit.meanErrorMeters));
console.log(JSON.stringify({
  poseIds: PROCEDURAL_DEFORM_VALIDATION_POSE_IDS_V5,
  measuredAngles: Object.fromEntries(Object.entries(results).map(([poseId, entry]) => [poseId, entry.measurements])),
  maximumAnchorErrorMeters,
  maximumMeanAnchorErrorMeters,
  maximumSymmetricRegionDimensionDifference,
}));
console.log('Human Core V5 Procedural Deform validation: shared anatomical-axis fixtures, independent SimulationRig FK, angle gates, immutable bind lengths, and Rig-to-surface alignment passed.');

function near(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${label} measured ${actual}; expected ${expected} ± ${tolerance} degrees.`);
}
function axisKey(channel) {
  return ({ bend: 'bendAxisLocal', twist: 'twistAxisLocal', side: 'sideAxisLocal' })[channel];
}
function regionDimensions(surface, regionName) {
  const points = [];
  for (let vertex = 0; vertex < surface.positions.length / 3; vertex += 1) {
    if (surface.regionNames[surface.regionIds[vertex * 4]] !== regionName) continue;
    points.push([surface.positions[vertex * 3], surface.positions[vertex * 3 + 1], surface.positions[vertex * 3 + 2]]);
  }
  assert.ok(points.length > 0, `${regionName} has no primary-owned vertices.`);
  return [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis])) - Math.min(...points.map((point) => point[axis])));
}
