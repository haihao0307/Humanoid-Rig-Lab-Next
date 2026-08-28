import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createHumanRigCoreV5 } from '../src/modules/human-core-v5/human-rig-core-v5.js';
import { adaptHumanRigCoreToExistingRig } from '../src/modules/human-core-v5/v4-adapter.js';
import { PERFORMANCE_DEFORM_NODE_SPECS_V1 } from '../src/modules/human-core-v5/production-rig-v1/performance-deform-rig-layer-v1.js';
import { REQUIRED_INTERACTION_ANCHOR_IDS_V1 } from '../src/modules/human-core-v5/production-rig-v1/interaction-rig-layer-v1.js';
import { axisBasisMetrics } from '../src/modules/human-core-v5/production-rig-v1/rig-quality-metrics-v1.js';
import {
  createCoreRigContractV1,
  validateCoreRigContractV1,
} from '../src/modules/human-core-v5/production-rig-v1/core-rig-contract-v1.js';
import { createTask17A3BodyDNA } from '../apps/human-core-v5-production-rig-detail-v1/scenario.js';

const OUTPUT_DIRECTORY = resolve('artifacts/qa/task17a3-production-rig-detail');
const PROFILE_DIRECTORY = resolve('assets/human/production-rig-v1');
const bodyDNA = createTask17A3BodyDNA();
const rigCore = createHumanRigCoreV5({ bodyDNA, rigId: 'human-rig-core-task17a3-production-rig' });
const definition = adaptHumanRigCoreToExistingRig(rigCore, { bodyDNA, pose: 'T' }).definition;
const definitionById = new Map(definition.joints.map((joint) => [joint.id, joint]));
const contract = createCoreRigContractV1({ rigCore, bodyDNA });
const validation = validateCoreRigContractV1(contract, { rigCore, bodyDNA });
const jointIds = rigCore.joints.map((joint) => joint.jointId);
const formalLimitJointIds = rigCore.joints.filter(isFormalAngularLimit).map((joint) => joint.jointId);
const missingJointLimitIds = rigCore.joints.filter((joint) => !isFormalAngularLimit(joint)).map((joint) => joint.jointId);
const axisRecords = rigCore.joints.map((joint) => ({ jointId: joint.jointId, ...axisBasisMetrics(joint.axisReference) }));
const joints = rigCore.joints.map((joint) => {
  const source = definitionById.get(joint.jointId);
  const axisMetrics = axisBasisMetrics(joint.axisReference);
  return {
    jointId: joint.jointId,
    parentJointId: joint.parentId ?? null,
    bindLocalPosition: contract.bindLocalPositions[joint.jointId],
    bindWorldPosition: contract.bindWorldPositions[joint.jointId],
    boneLength: contract.boneLengths[joint.jointId],
    twistAxisLocal: joint.axisReference.twistAxisLocal,
    bendAxisLocal: joint.axisReference.bendAxisLocal,
    sideAxisLocal: joint.axisReference.sideAxisLocal,
    axisOrthogonalityError: axisMetrics.orthogonalityError,
    basisDeterminant: axisMetrics.determinant,
    jointRange: isFormalAngularLimit(joint) ? joint.limitProfile : null,
    currentLimitSource: isFormalAngularLimit(joint)
      ? `JointSemanticProfileV5:${joint.source.limitLabel || joint.motionRole}`
      : 'LIMIT UNDEFINED',
    core: joint.core,
    optionalDeform: joint.optionalDeform,
    sourceRole: source?.role ?? null,
  };
});

const existingAudit = {
  schema: 'humanoid_rig/task17a3_existing_core_rig_audit@1.0',
  task: 'Task 17A.3 Human Production Rig and Interaction Skeleton Foundation',
  authorityChain: ['BodyDNA', 'HumanRigCore', 'finalPose', 'Production Rig Detail', 'Performance Deform Rig Contract', 'Interaction Anchors', 'Diagnostic Renderer'],
  jointCount: jointIds.length,
  coreHumanJointCount: rigCore.coreJointIds.length,
  joints,
  semantics: {
    palm: {
      current: ['leftHand', 'rightHand', 'leftHandEnd', 'rightHandEnd'],
      interpretation: 'wrist joint plus virtual hand-end measurement point; never middle-finger proximal',
    },
    sole: { current: ['leftFoot', 'rightFoot', 'leftBallContact', 'rightBallContact'], source: 'V4 RigDefinition' },
    heel: { current: ['leftHeelContact', 'rightHeelContact'], source: 'V4 RigDefinition' },
    toe: { current: ['leftToes', 'rightToes', 'leftToesEnd', 'rightToesEnd'], source: 'V4 RigDefinition' },
    gaze: { current: ['head'], missingDedicatedTarget: true },
    centerOfMass: { source: 'HumanBalanceStateV5 mass-distribution-plus-local-quaternion-posture', writesPose: false },
    supportArea: { source: 'HumanBalanceStateV5 pose-frame-v4-contacts semantic footprint', writesPose: false },
  },
  currentMissingInteractionAnchorIds: REQUIRED_INTERACTION_ANCHOR_IDS_V1.filter((anchorId) => !jointIds.includes(anchorId)),
  currentMissingPerformanceCapabilities: PERFORMANCE_DEFORM_NODE_SPECS_V1.map((node) => node.nodeId),
  coreRigTopologyFingerprint: contract.topologyFingerprint,
  coreRigBindFingerprint: contract.bindFingerprint,
  coreRigAxisFingerprint: contract.axisFingerprint,
  coreRigLimitFingerprint: contract.limitFingerprint,
  axisMetrics: {
    maximumAxisOrthogonalityError: Math.max(...axisRecords.map((record) => record.orthogonalityError)),
    minimumBasisDeterminant: Math.min(...axisRecords.map((record) => record.determinant)),
    maximumBasisDeterminant: Math.max(...axisRecords.map((record) => record.determinant)),
    nonFiniteAxisCount: axisRecords.reduce((sum, record) => sum + record.nonFiniteAxisCount, 0),
  },
  limitAudit: {
    formalLimitJointCount: formalLimitJointIds.length,
    totalJointCount: jointIds.length,
    coreJointCoverage: rigCore.coreJointIds.filter((jointId) => formalLimitJointIds.includes(jointId)).length / rigCore.coreJointIds.length,
    fullRigCoverage: formalLimitJointIds.length / jointIds.length,
    missingJointLimitIds,
  },
};

const contractAudit = {
  schema: 'humanoid_rig/task17a3_core_rig_contract_audit@1.0',
  validation,
  failClosed: true,
  gates: {
    unknownJointCount: validation.unknownJointIds.length,
    missingJointCount: validation.missingJointIds.length,
    parentMismatchCount: validation.parentMismatchIds.length,
    maximumBindPositionDifference: validation.maximumBindPositionDifference,
    maximumBoneLengthDifference: validation.boneLengthMismatchIds.length ? Number.POSITIVE_INFINITY : 0,
    nonFiniteAxisCount: existingAudit.axisMetrics.nonFiniteAxisCount,
    maximumAxisOrthogonalityError: existingAudit.axisMetrics.maximumAxisOrthogonalityError,
    maximumDeterminantDifference: Math.max(
      Math.abs(existingAudit.axisMetrics.minimumBasisDeterminant - 1),
      Math.abs(existingAudit.axisMetrics.maximumBasisDeterminant - 1),
    ),
  },
  passed: validation.valid,
};

assert.equal(validation.valid, true, validation.errors.join(' '));
assert.equal(existingAudit.axisMetrics.nonFiniteAxisCount, 0);
assert.ok(existingAudit.axisMetrics.maximumAxisOrthogonalityError <= 1e-6);
assert.ok(Math.abs(existingAudit.axisMetrics.minimumBasisDeterminant - 1) <= 1e-6);

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
await mkdir(PROFILE_DIRECTORY, { recursive: true });
await Promise.all([
  writeJson(resolve(OUTPUT_DIRECTORY, 'existing-core-rig-audit.json'), existingAudit),
  writeJson(resolve(OUTPUT_DIRECTORY, 'core-rig-contract-audit.json'), contractAudit),
  writeJson(resolve(PROFILE_DIRECTORY, 'core-rig-profile-v1.json'), contract),
  writeJson(resolve(PROFILE_DIRECTORY, 'joint-limit-audit-v1.json'), existingAudit.limitAudit),
]);

console.log(`PASS Task 17A.3 Core Rig Audit: ${jointIds.length} joints; topology ${contract.topologyFingerprint}; bind ${contract.bindFingerprint}.`);

function isFormalAngularLimit(joint) {
  return joint.limitProfile?.unit === 'degrees'
    && !['optional-deform', 'control', 'structural'].includes(joint.motionRole)
    && Object.values(joint.limitProfile.ranges ?? {}).some((range) => Array.isArray(range) && range.length === 2);
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, jsonReplacer, 2)}\n`, 'utf8');
}

function jsonReplacer(key, value) {
  return Number.isFinite(value) || typeof value !== 'number' ? value : String(value);
}
