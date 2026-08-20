import assert from 'node:assert/strict';
import {
  CURRENT_RIG_PROFILE,
  JOINT_EXPORT_POLICIES,
  JOINT_ROLES,
  JOINT_SOLVER_PARTICIPATION,
  JOINT_VISIBILITY_LAYERS,
  MIRROR_PAIRS,
  createStandardHumanoidPreset,
  normalizeSkeletonDefinition,
  summarizeRigDefinition,
} from '../src/skeleton-presets.js';
import {
  PRODUCTION_RIG_BLUEPRINT,
  buildRigCapabilityReport,
} from '../../../src/modules/proportion/rig-system.js';
import {
  calculateRigHeight,
  computePoseWorldPositions,
  computeRestWorldPositions,
  getBoneLength,
  vectorDistance,
} from '../src/skeleton-model.js';

const EPSILON = 1e-8;
const expectedHeight = 1.795672;
const definitions = new Map();

function close(actual, expected, tolerance = EPSILON, label = 'value') {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`);
}

for (const pose of ['A', 'T']) {
  const definition = normalizeSkeletonDefinition(createStandardHumanoidPreset(pose));
  definitions.set(pose, definition);

  assert.equal(definition.schemaVersion, 7);
  assert.equal(definition.pose, pose);
  assert.equal(definition.unit, 'meter');
  assert.equal(definition.dimensionsLocked, true);
  assert.equal(definition.bindPose, 'A');
  assert.equal(definition.standard.family, 'SMPL');
  assert.equal(definition.standard.jointLayout, 'SMPL 24');
  assert.equal(definition.standard.license, 'CC BY 4.0');
  assert.equal(definition.surface.asset, 'assets/smpl/smpl-male-surface.glb');
  assert.match(definition.surface.weighting, /region-isolated.*dual-quaternion.*bind-pose/i);
  assert.equal(definition.anthropometry.profile, 'smpl-male-surface-fit-1796-v3');
  assert.equal(definition.physics.solverIterations, 64);
  assert.equal(definition.physics.poseStiffness, 0.20);
  assert.equal(definition.physics.anatomyEnabled, true);
  assert.equal(definition.biomechanics.enabled, true);
  assert.equal(definition.biomechanics.hardLimits, true);
  assert.equal(definition.joints.length, 89);
  assert.equal(definition.joints.filter((joint) => !joint.isControl).length, 76);
  assert.equal(definition.rigProfile.id, CURRENT_RIG_PROFILE.id);
  assert.equal(definition.rigProfile.nativeRig, 'rig@0.6.0');
  assert.equal(definition.rigProfile.compatibleRig, 'rig@0.4.0');
  assert.equal(definition.rigProfile.topologyPolicy, 'append-only');
  assert.deepEqual(definition.rigProfile.roleIds.control, [
    'root',
    ...PRODUCTION_RIG_BLUEPRINT.bodyProduction.additiveControls,
  ]);
  assert.deepEqual(definition.rigProfile.roleIds.marker, [
    'headTop',
    'leftToesEnd',
    'rightToesEnd',
    ...PRODUCTION_RIG_BLUEPRINT.bodyProduction.additiveContactMarkers,
  ]);
  assert.deepEqual(definition.rigProfile.roleIds.corrective, ['leftScapulaCorrective', 'rightScapulaCorrective']);
  assert.deepEqual(definition.rigProfile.roleIds.hiddenDeform, ['leftShoulder', 'rightShoulder']);
  assert.equal(definition.rigProfile.visibilityPolicy.clavicleBonesVisibleWithJointHandlesHidden, true);

  const rigSummary = summarizeRigDefinition(definition);
  assert.equal(rigSummary.countMatchesProfile, true);
  assert.deepEqual(rigSummary.counts, {
    total: 89,
    deform: 65,
    control: 13,
    marker: 9,
    corrective: 2,
    socket: 0,
    visibleJoints: 83,
    visibleBones: 64,
    physicalBones: 57,
    deformInfluences: 67,
  });
  assert.deepEqual(rigSummary.hiddenJointIds, [
    'root',
    'headTop',
    'leftShoulder',
    'rightShoulder',
    'leftToesEnd',
    'rightToesEnd',
  ]);
  assert.equal(rigSummary.axisAudit.complete, true);
  assert.equal(rigSummary.axisAudit.orthonormal, true);
  assert.equal(rigSummary.axisAudit.requiredEntryCount, 89);
  assert.equal(rigSummary.axisAudit.presentEntryCount, 89);
  assert.equal(rigSummary.axisAudit.runtimeApplied, false);

  const capability = buildRigCapabilityReport(rigSummary);
  assert.equal(capability.current.totalNodes, 89);
  assert.equal(capability.current.deformJoints, 65);
  assert.equal(capability.capability.proportionReconstruction, 'ready');
  assert.equal(capability.capability.basicBodyPose, 'ready');
  assert.equal(capability.capability.detailedBodyMotion, 'ready');
  assert.equal(capability.capability.footGrounding, 'ready-controls-and-contacts');
  assert.equal(capability.capability.handPerformance, 'ready');
  assert.equal(capability.capability.facePerformance, 'ready');
  assert.equal(capability.capability.legacyClipCompatibility, 'ready-append-only');
  assert.deepEqual(capability.missing, []);
  assert.equal(PRODUCTION_RIG_BLUEPRINT.schema, 'humanoid_rig/production_rig_blueprint@2.0');
  assert.equal(PRODUCTION_RIG_BLUEPRINT.bodyProduction.deformJointTarget, 32);
  assert.equal(PRODUCTION_RIG_BLUEPRINT.bodyProduction.additiveDeformJoints.length, 8);
  assert.equal(PRODUCTION_RIG_BLUEPRINT.bodyProduction.additiveControls.length, 12);
  assert.equal(PRODUCTION_RIG_BLUEPRINT.bodyProduction.additiveContactMarkers.length, 6);
  assert.equal(PRODUCTION_RIG_BLUEPRINT.bodyProduction.nodeDefinitions.length, 26);
  assert.equal(PRODUCTION_RIG_BLUEPRINT.bodyProduction.optionalCorrectiveNodeDefinitions.length, 2);
  assert.equal(PRODUCTION_RIG_BLUEPRINT.fullPerformance.deformJointTarget, 65);
  assert.equal(PRODUCTION_RIG_BLUEPRINT.fullPerformance.nodeDefinitions.length, 33);
  assert.equal(PRODUCTION_RIG_BLUEPRINT.fullPerformance.additiveDeformJoints.length, 33);

  const byId = new Map(definition.joints.map((joint) => [joint.id, joint]));
  const currentIds = new Set(byId.keys());
  const compatibilityCoreIds = new Set(definition.joints.slice(0, 28).map((joint) => joint.id));
  const productionNodes = PRODUCTION_RIG_BLUEPRINT.bodyProduction.nodeDefinitions;
  const productionIds = productionNodes.map((node) => node.id);
  assert.equal(new Set(productionIds).size, productionIds.length, 'Production node IDs must be unique.');
  const availableProductionParents = new Set(compatibilityCoreIds);
  for (const node of productionNodes) {
    const activeNode = byId.get(node.id);
    assert.ok(activeNode, `Active rig is missing production node ${node.id}.`);
    assert.ok(availableProductionParents.has(node.parentId), `Production parent ${node.parentId} must exist before ${node.id}.`);
    assert.ok(['deform', 'control', 'marker'].includes(node.role));
    assert.ok(node.placement && typeof node.placement.mode === 'string');
    assert.equal(activeNode.parentId, node.parentId);
    assert.equal(activeNode.role, node.role);
    assert.equal(activeNode.rigTier, node.rigTier);
    availableProductionParents.add(node.id);
  }
  for (const node of PRODUCTION_RIG_BLUEPRINT.bodyProduction.optionalCorrectiveNodeDefinitions) {
    const activeNode = byId.get(node.id);
    assert.ok(activeNode, `Active rig is missing corrective node ${node.id}.`);
    assert.equal(activeNode.parentId, node.parentId);
    assert.equal(activeNode.role, 'corrective');
    availableProductionParents.add(node.id);
  }
  for (const twistId of PRODUCTION_RIG_BLUEPRINT.bodyProduction.additiveDeformJoints) {
    const node = productionNodes.find((item) => item.id === twistId);
    assert.ok(node, `Missing twist definition ${twistId}.`);
    assert.equal(node.role, 'deform');
    assert.equal(node.solverParticipation, 'derived');
    assert.equal(node.deformInfluence, true);
    assert.equal(node.driver.mode, 'swing-twist-distribution');
    assert.equal(node.placement.fraction, 0.5);
  }

  const performanceNodes = PRODUCTION_RIG_BLUEPRINT.fullPerformance.nodeDefinitions;
  const performanceIds = performanceNodes.map((node) => node.id);
  assert.equal(new Set(performanceIds).size, performanceIds.length, 'Performance node IDs must be unique.');
  assert.equal(performanceIds.filter((id) => /^(?:left|right)(?:Thumb(?:Metacarpal|Proximal|Distal)|(?:Index|Middle|Ring|Little)(?:Proximal|Intermediate|Distal))$/.test(id)).length, 30);
  assert.deepEqual(performanceIds.slice(-3), ['leftEye', 'rightEye', 'jaw']);
  const availablePerformanceParents = new Set(availableProductionParents);
  for (const node of performanceNodes) {
    const activeNode = byId.get(node.id);
    assert.ok(activeNode, `Active rig is missing performance node ${node.id}.`);
    assert.ok(availablePerformanceParents.has(node.parentId), `Performance parent ${node.parentId} must already exist before ${node.id}.`);
    assert.equal(activeNode.parentId, node.parentId);
    assert.equal(activeNode.role, node.role);
    assert.equal(activeNode.retargetSemantic, node.retargetSemantic);
    availablePerformanceParents.add(node.id);
  }
  assert.equal(byId.size, definition.joints.length, 'Joint IDs must be unique.');
  assert.equal(byId.get('root')?.parentId, null);
  assert.equal(byId.get('root')?.isControl, true);
  assert.equal(byId.get('root')?.visualJoint, false);
  assert.equal(byId.get('root')?.physicalBone, false);
  assert.equal(byId.get('hips')?.parentId, 'root');
  assert.equal(byId.get('hips')?.visualBone, false);
  assert.equal(byId.get('hips')?.physicalBone, false);
  assert.equal(byId.get('leftUpperLeg')?.visualBone, false);
  assert.equal(byId.get('rightUpperLeg')?.visualBone, false);
  assert.equal(byId.get('leftUpperLeg')?.physicalBone, true);
  assert.equal(byId.get('rightUpperLeg')?.physicalBone, true);
  assert.equal(byId.get('root')?.role, JOINT_ROLES.CONTROL);
  assert.equal(byId.get('root')?.visibilityLayer, JOINT_VISIBILITY_LAYERS.CONTROLS);
  assert.equal(byId.get('root')?.solverParticipation, JOINT_SOLVER_PARTICIPATION.GLOBAL_ROOT);
  assert.equal(byId.get('root')?.exportPolicy, JOINT_EXPORT_POLICIES.RIG);
  assert.equal(byId.get('headTop')?.role, JOINT_ROLES.MARKER);
  assert.equal(byId.get('headTop')?.visualJoint, false);
  assert.equal(byId.get('headTop')?.visualBone, false);
  assert.equal(byId.get('headTop')?.visibilityLayer, JOINT_VISIBILITY_LAYERS.MEASUREMENTS);
  assert.equal(byId.get('headTop')?.solverParticipation, JOINT_SOLVER_PARTICIPATION.PASSIVE_ENDPOINT);
  assert.equal(byId.get('headTop')?.exportPolicy, JOINT_EXPORT_POLICIES.EDITOR);
  assert.equal(byId.get('leftToesEnd')?.visualJoint, false);
  assert.equal(byId.get('leftToesEnd')?.visualBone, false);
  assert.equal(byId.get('rightToesEnd')?.visualJoint, false);
  assert.equal(byId.get('rightToesEnd')?.visualBone, false);
  assert.equal(byId.get('leftShoulder')?.role, JOINT_ROLES.DEFORM);
  assert.equal(byId.get('leftShoulder')?.visibilityLayer, JOINT_VISIBILITY_LAYERS.DEFORM_HIDDEN);
  assert.equal(byId.get('leftShoulder')?.deformInfluence, true);
  assert.equal(byId.get('leftHandEnd')?.label, '左掌中心');
  assert.equal(byId.get('rightHandEnd')?.label, '右掌中心');
  close(calculateRigHeight(definition), expectedHeight, EPSILON, 'rig height');

  const standardJoints = definition.joints.filter((joint) => joint.standard?.family === 'SMPL');
  assert.equal(standardJoints.length, 24, 'SMPL mapping must contain exactly 24 joints.');
  const smplIndices = standardJoints.map((joint) => joint.standard.index).sort((a, b) => a - b);
  assert.deepEqual(smplIndices, Array.from({ length: 24 }, (_, index) => index));
  assert.equal(definition.joints.filter((joint) => joint.standard?.helper).length, 22);

  const rest = computeRestWorldPositions(definition);
  const currentPose = computePoseWorldPositions(definition);
  for (const joint of definition.joints) {
    assert.equal(joint.localPosition.length, 3);
    assert.equal(joint.poseWorldPosition.length, 3);
    if (joint.parentId && joint.physicalBone !== false) {
      const expected = getBoneLength(definition, joint.id);
      const actual = vectorDistance(currentPose.get(joint.parentId), currentPose.get(joint.id));
      close(actual, expected, EPSILON, `${pose} ${joint.id} fixed length`);
    }
    if (!joint.parentId) assert.deepEqual(rest.get(joint.id), currentPose.get(joint.id));
  }

  for (const [sourceId, targetId] of Object.entries(MIRROR_PAIRS)) {
    const source = byId.get(sourceId);
    const target = byId.get(targetId);
    assert.ok(source, `Missing source mirror joint ${sourceId}.`);
    assert.ok(target, `Missing target mirror joint ${targetId}.`);
    close(source.localPosition[0], -target.localPosition[0], EPSILON, `${sourceId}/${targetId} mirrored X`);
    close(source.localPosition[1], target.localPosition[1], EPSILON, `${sourceId}/${targetId} mirrored Y`);
    close(source.localPosition[2], target.localPosition[2], EPSILON, `${sourceId}/${targetId} mirrored Z`);
  }
}

const aDefinition = definitions.get('A');
const tDefinition = definitions.get('T');
const tPose = computePoseWorldPositions(tDefinition);
close(vectorDistance(tPose.get('leftHandEnd'), tPose.get('rightHandEnd')), 1.598789537441861, EPSILON, 'T-pose hand-control span');
close(vectorDistance(tPose.get('leftUpperLeg'), tPose.get('rightUpperLeg')), 0.2, EPSILON, 'hip joint width');

close(getBoneLength(tDefinition, 'leftUpperArm'), 0.12864680330268607, EPSILON, 'clavicle to shoulder');
close(getBoneLength(tDefinition, 'leftLowerArm'), 0.27721832551258224, EPSILON, 'upper arm');
close(getBoneLength(tDefinition, 'leftHand'), 0.2414021540914662, EPSILON, 'forearm');
close(getBoneLength(tDefinition, 'leftHandEnd'), 0.070774289116882, EPSILON, 'wrist to hand node');
close(getBoneLength(tDefinition, 'leftLowerLeg'), 0.4253480927428734, EPSILON, 'thigh');
close(getBoneLength(tDefinition, 'leftFoot'), 0.4031327324839798, EPSILON, 'shank');
close(getBoneLength(tDefinition, 'leftToes'), 0.13915818337417316, EPSILON, 'ankle to forefoot node');

const upperArmToForearm = getBoneLength(tDefinition, 'leftLowerArm') / getBoneLength(tDefinition, 'leftHand');
close(upperArmToForearm, 1.1483672403666518, 1e-6, 'upper arm to forearm ratio');
assert.ok(getBoneLength(tDefinition, 'leftHandEnd') < 0.08, 'The hand control remains too far from the wrist.');
assert.ok(getBoneLength(tDefinition, 'leftFoot') < getBoneLength(tDefinition, 'leftLowerLeg'), 'The shank must remain shorter than the thigh in this fitted profile.');

const restA = computeRestWorldPositions(aDefinition);
const expectedFit = {
  hips: [0, 0.925, 0.016],
  leftUpperArm: [-0.210, 1.340, -0.020],
  leftLowerArm: [-0.350, 1.105, 0.025],
  leftHand: [-0.435, 0.900, 0.120],
  leftLowerLeg: [-0.110, 0.500, 0.002],
  leftFoot: [-0.160, 0.100, -0.002],
  leftToes: [-0.176, 0.035, 0.120],
};
for (const [id, expected] of Object.entries(expectedFit)) {
  const point = restA.get(id);
  close(point.x, expected[0], EPSILON, `${id} fitted X`);
  close(point.y, expected[1], EPSILON, `${id} fitted Y`);
  close(point.z, expected[2], EPSILON, `${id} fitted Z`);
}

for (const joint of aDefinition.joints) {
  const counterpart = tDefinition.joints.find((item) => item.id === joint.id);
  assert.ok(counterpart);
  assert.deepEqual(joint.localPosition, counterpart.localPosition, `${joint.id} bind data differs by pose.`);
  close(getBoneLength(aDefinition, joint.id), getBoneLength(tDefinition, joint.id), 1e-12, `${joint.id} pose-independent length`);
}

console.log('V8.5 SMPL-compatible 89-node performance rig, role taxonomy, VRM finger chains, retarget chains, complete bind-axis contract, and fixed segment validation passed.');
