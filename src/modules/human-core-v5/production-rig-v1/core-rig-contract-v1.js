import { assertHumanRigCoreV5 } from '../human-rig-core-v5.js';
import { createBodyDNA } from '../body-dna-v5.js';
import { adaptHumanRigCoreToExistingRig } from '../v4-adapter.js';
import { cloneValue, stableFingerprint } from '../core-utils.js';
import { axisBasisMetrics, distance3 } from './rig-quality-metrics-v1.js';

export const CORE_RIG_CONTRACT_V1_SCHEMA = 'humanoid_rig/core_rig_contract@1.0';
export const CORE_RIG_CONTRACT_V1_VERSION = 'human-core-v5-production-rig-detail-v1';

export function createCoreRigContractV1({ rigCore, bodyDNA = {} } = {}) {
  assertHumanRigCoreV5(rigCore);
  const dna = createBodyDNA(bodyDNA);
  const definition = adaptHumanRigCoreToExistingRig(rigCore, { bodyDNA: dna, pose: 'T' }).definition;
  const sourceById = new Map(definition.joints.map((joint) => [joint.id, joint]));
  const jointIds = rigCore.joints.map((joint) => joint.jointId);
  const parentByJointId = Object.fromEntries(rigCore.joints.map((joint) => [joint.jointId, joint.parentId ?? null]));
  const bindLocalPositions = Object.fromEntries(jointIds.map((jointId) => [
    jointId,
    [...(sourceById.get(jointId)?.localPosition ?? [0, 0, 0])].map(Number),
  ]));
  const bindWorldPositions = Object.fromEntries(jointIds.map((jointId) => [
    jointId,
    [...(sourceById.get(jointId)?.poseWorldPosition ?? [0, 0, 0])].map(Number),
  ]));
  const boneLengths = Object.fromEntries(jointIds.map((jointId) => [
    jointId,
    parentByJointId[jointId] == null ? 0 : Math.hypot(...bindLocalPositions[jointId]),
  ]));
  const jointAxes = Object.fromEntries(rigCore.joints.map((joint) => [joint.jointId, cloneValue(joint.axisReference)]));
  const jointLimits = Object.fromEntries(rigCore.joints.map((joint) => [joint.jointId, cloneValue(joint.limitProfile)]));
  const topologyPayload = { jointIds, parentByJointId };
  const bindPayload = { bindLocalPositions, bindWorldPositions, boneLengths };
  const contract = {
    schema: CORE_RIG_CONTRACT_V1_SCHEMA,
    rigVersion: CORE_RIG_CONTRACT_V1_VERSION,
    authority: 'HumanRigCore+V4Adapter(T)',
    projectionOnly: true,
    writesHumanRigCore: false,
    writesFinalPose: false,
    jointIds,
    parentByJointId,
    bindLocalPositions,
    bindWorldPositions,
    boneLengths,
    jointAxes,
    jointLimits,
    topologyFingerprint: stableFingerprint(topologyPayload),
    bindFingerprint: stableFingerprint(bindPayload),
    axisFingerprint: stableFingerprint(jointAxes),
    limitFingerprint: stableFingerprint(jointLimits),
  };
  assertCoreRigContractV1(contract, { rigCore, bodyDNA: dna });
  return contract;
}

export function validateCoreRigContractV1(contract, { rigCore, bodyDNA = {} } = {}) {
  const errors = [];
  if (!contract || contract.schema !== CORE_RIG_CONTRACT_V1_SCHEMA) {
    return { valid: false, errors: [`schema must be ${CORE_RIG_CONTRACT_V1_SCHEMA}.`] };
  }
  try { assertHumanRigCoreV5(rigCore); } catch (error) { return { valid: false, errors: [error.message] }; }
  const dna = createBodyDNA(bodyDNA);
  const definition = adaptHumanRigCoreToExistingRig(rigCore, { bodyDNA: dna, pose: 'T' }).definition;
  const currentById = new Map(definition.joints.map((joint) => [joint.id, joint]));
  const contractIds = new Set(contract.jointIds ?? []);
  const currentIds = new Set(rigCore.joints.map((joint) => joint.jointId));
  const unknownJointIds = [...currentIds].filter((jointId) => !contractIds.has(jointId));
  const missingJointIds = [...contractIds].filter((jointId) => !currentIds.has(jointId));
  const parentMismatchIds = [];
  const boneLengthMismatchIds = [];
  const missingAxisJointIds = [];
  const invalidAxisJointIds = [];
  const nonFiniteJointIds = [];
  for (const joint of rigCore.joints) {
    const source = currentById.get(joint.jointId);
    if (contract.parentByJointId?.[joint.jointId] !== (joint.parentId ?? null)) parentMismatchIds.push(joint.jointId);
    const local = source?.localPosition ?? [];
    const currentLength = joint.parentId == null ? 0 : Math.hypot(...local.map(Number));
    if (Math.abs(currentLength - Number(contract.boneLengths?.[joint.jointId])) > 1e-9) boneLengthMismatchIds.push(joint.jointId);
    if (!joint.axisReference?.twistAxisLocal || !joint.axisReference?.bendAxisLocal || !joint.axisReference?.sideAxisLocal) {
      missingAxisJointIds.push(joint.jointId);
    } else {
      const metrics = axisBasisMetrics(joint.axisReference);
      if (metrics.orthogonalityError > 1e-6 || Math.abs(metrics.determinant - 1) > 1e-6) invalidAxisJointIds.push(joint.jointId);
      if (metrics.nonFiniteAxisCount) nonFiniteJointIds.push(joint.jointId);
    }
    if (!source || [...(source.localPosition ?? []), ...(source.poseWorldPosition ?? [])].some((value) => !Number.isFinite(Number(value)))) {
      nonFiniteJointIds.push(joint.jointId);
    }
  }
  const topologyFingerprint = stableFingerprint({ jointIds: contract.jointIds, parentByJointId: contract.parentByJointId });
  const bindFingerprint = stableFingerprint({
    bindLocalPositions: contract.bindLocalPositions,
    bindWorldPositions: contract.bindWorldPositions,
    boneLengths: contract.boneLengths,
  });
  if (contract.topologyFingerprint !== topologyFingerprint) errors.push('topology fingerprint mismatch.');
  if (contract.bindFingerprint !== bindFingerprint) errors.push('bind fingerprint mismatch.');
  if (contract.axisFingerprint !== stableFingerprint(contract.jointAxes)) errors.push('axis fingerprint mismatch.');
  if (contract.limitFingerprint !== stableFingerprint(contract.jointLimits)) errors.push('limit fingerprint mismatch.');
  if (unknownJointIds.length) errors.push(`unknown joints: ${unknownJointIds.join(', ')}.`);
  if (missingJointIds.length) errors.push(`missing joints: ${missingJointIds.join(', ')}.`);
  if (parentMismatchIds.length) errors.push(`parent mismatches: ${parentMismatchIds.join(', ')}.`);
  if (boneLengthMismatchIds.length) errors.push(`bone-length mismatches: ${boneLengthMismatchIds.join(', ')}.`);
  if (missingAxisJointIds.length) errors.push(`missing axes: ${missingAxisJointIds.join(', ')}.`);
  if (invalidAxisJointIds.length) errors.push(`invalid axis bases: ${invalidAxisJointIds.join(', ')}.`);
  if (nonFiniteJointIds.length) errors.push(`non-finite joints: ${[...new Set(nonFiniteJointIds)].join(', ')}.`);
  const maximumBindPositionDifference = Math.max(0, ...rigCore.joints.map((joint) => distance3(
    currentById.get(joint.jointId)?.localPosition ?? [Infinity, 0, 0],
    contract.bindLocalPositions?.[joint.jointId] ?? [-Infinity, 0, 0],
  )));
  if (maximumBindPositionDifference !== 0) errors.push(`bind-local position difference is ${maximumBindPositionDifference}.`);
  return {
    valid: errors.length === 0,
    errors,
    unknownJointIds,
    missingJointIds,
    parentMismatchIds,
    boneLengthMismatchIds,
    missingAxisJointIds,
    invalidAxisJointIds,
    nonFiniteJointIds: [...new Set(nonFiniteJointIds)],
    maximumBindPositionDifference,
  };
}

export function assertCoreRigContractV1(contract, context) {
  const result = validateCoreRigContractV1(contract, context);
  if (!result.valid) throw new Error(`Core Rig Contract V1 fail-closed: ${result.errors.join(' ')}`);
  return contract;
}
