import {
  CURRENT_RIG_PROFILE,
  createStandardHumanoidPreset,
  normalizeSkeletonDefinition,
  summarizeRigDefinition,
} from '../../../legacy/v8/src/skeleton-presets.js';
import { createBodyDNA, assertBodyDNAV5 } from './body-dna-v5.js';
import {
  assertJointSemanticProfileV5,
  createJointSemanticProfileV5,
  validateJointSemanticProfileV5,
} from './joint-semantic-profile-v5.js';
import {
  cloneValue,
  normalizeId,
  stableFingerprint,
} from './core-utils.js';

export const HUMAN_RIG_CORE_V5_SCHEMA = 'humanoid_rig/human_rig_core@5.0';
export const HUMAN_RIG_CORE_V5_SCHEMA_VERSION = 5;

export const CORE_HUMAN_JOINT_IDS_V5 = Object.freeze([
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'rightShoulder',
  'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand',
  'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot',
]);

/**
 * HumanRigCore is a semantic, read-only projection of the current V4
 * RigDefinition. Its hierarchy and axes remain sourced from that definition;
 * it never creates a competing skeleton or bind-pose representation.
 */
export function createHumanRigCoreV5({
  definition = createStandardHumanoidPreset('A'),
  bodyDNA = {},
  rigId = null,
} = {}) {
  const dna = createBodyDNA(bodyDNA);
  assertBodyDNAV5(dna);
  const normalizedDefinition = normalizeSkeletonDefinition(definition);
  const axisContract = normalizedDefinition.jointAxes;
  const childrenByParent = buildChildrenByParent(normalizedDefinition.joints);
  const joints = normalizedDefinition.joints.map((joint) => {
    const semantic = createJointSemanticProfileV5(joint, axisContract);
    return {
      ...semantic,
      childIds: [...(childrenByParent.get(joint.id) ?? [])],
      core: CORE_HUMAN_JOINT_IDS_V5.includes(joint.id),
      optionalDeform: joint.rigTier !== 'core' || joint.role === 'corrective' || joint.category === 'hand',
    };
  });
  const topology = normalizedDefinition.joints.map((joint) => ({
    jointId: joint.id,
    parentId: joint.parentId ?? null,
  }));
  const summary = summarizeRigDefinition(normalizedDefinition);
  const core = {
    schema: HUMAN_RIG_CORE_V5_SCHEMA,
    schemaVersion: HUMAN_RIG_CORE_V5_SCHEMA_VERSION,
    type: 'HumanRigCore',
    rigId: normalizeId(rigId, `human-rig-core-${dna.identity.humanId}`),
    sourceRig: {
      profile: String(normalizedDefinition.rigProfile?.id ?? CURRENT_RIG_PROFILE.id),
      nativeRig: String(normalizedDefinition.rigProfile?.nativeRig ?? CURRENT_RIG_PROFILE.nativeRig),
      compatibleRig: String(normalizedDefinition.rigProfile?.compatibleRig ?? CURRENT_RIG_PROFILE.compatibleRig),
      definitionSchemaVersion: Number(normalizedDefinition.schemaVersion),
      bindPose: String(normalizedDefinition.bindPose),
      topologyPolicy: String(normalizedDefinition.rigProfile?.topologyPolicy ?? 'append-only'),
      jointAxisSchema: axisContract.schema,
      jointAxisSpace: axisContract.space,
    },
    topology: {
      fingerprint: stableFingerprint(topology),
      jointCount: normalizedDefinition.joints.length,
      physicalJointCount: summary.counts.physicalBones,
      rootJointId: normalizedDefinition.joints.some((joint) => joint.id === 'hips')
        ? 'hips'
        : normalizedDefinition.joints.find((joint) => !joint.parentId && !joint.isControl)?.id
          ?? normalizedDefinition.joints.find((joint) => !joint.parentId)?.id
          ?? 'hips',
      relationships: topology,
    },
    coreJointIds: [...CORE_HUMAN_JOINT_IDS_V5],
    optionalDeformJointIds: joints
      .filter((joint) => joint.optionalDeform && !CORE_HUMAN_JOINT_IDS_V5.includes(joint.jointId))
      .map((joint) => joint.jointId),
    joints,
    massDistribution: cloneValue(dna.mass.distribution),
    balanceConstraints: {
      centerOfMassJointId: 'centerOfMass',
      rootJointId: 'hips',
      supportJointIds: ['leftFoot', 'rightFoot', 'leftHeelContact', 'rightHeelContact', 'leftBallContact', 'rightBallContact'],
      uprightJointIds: ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head'],
      policy: 'semantic-constraints-only-v5-phase-1',
    },
    diagnostics: {
      axisContractComplete: summary.axisAudit.complete,
      axisContractOrthonormal: summary.axisAudit.orthonormal,
      sourceJointCount: summary.counts.total,
      projectionOnly: true,
      mutatesSourceDefinition: false,
    },
  };
  assertHumanRigCoreV5(core);
  return core;
}

export function validateHumanRigCoreV5(value) {
  const errors = [];
  if (!value || value.schema !== HUMAN_RIG_CORE_V5_SCHEMA || value.type !== 'HumanRigCore') {
    errors.push(`schema must be ${HUMAN_RIG_CORE_V5_SCHEMA} and type must be HumanRigCore.`);
    return { valid: false, errors };
  }
  if (value.schemaVersion !== HUMAN_RIG_CORE_V5_SCHEMA_VERSION) errors.push('schemaVersion must be 5.');
  if (!stableId(value.rigId)) errors.push('rigId must be a stable identifier.');
  if (value.sourceRig?.jointAxisSchema !== 'humanoid_rig/joint_axes@1.0') {
    errors.push('sourceRig must retain the existing joint axis schema.');
  }
  if (!Array.isArray(value.joints) || !value.joints.length) {
    errors.push('joints must be a non-empty array.');
    return { valid: false, errors };
  }
  const byId = new Map();
  for (const joint of value.joints) {
    const validation = validateJointSemanticProfileV5(joint);
    if (!validation.valid) errors.push(...validation.errors.map((message) => `${joint?.jointId ?? 'unknown'}: ${message}`));
    if (byId.has(joint.jointId)) errors.push(`Duplicate semantic joint ${joint.jointId}.`);
    byId.set(joint.jointId, joint);
    if (!Array.isArray(joint.childIds)) errors.push(`${joint.jointId}.childIds must be an array.`);
  }
  for (const requiredId of CORE_HUMAN_JOINT_IDS_V5) {
    if (!byId.has(requiredId)) errors.push(`Core Human Rig is missing ${requiredId}.`);
  }
  for (const joint of value.joints) {
    if (joint.parentId != null && !byId.has(joint.parentId)) errors.push(`${joint.jointId} parent ${joint.parentId} is missing.`);
    for (const childId of joint.childIds ?? []) {
      if (!byId.has(childId)) errors.push(`${joint.jointId} child ${childId} is missing.`);
      else if (byId.get(childId).parentId !== joint.jointId) errors.push(`${joint.jointId}/${childId} relationship is inconsistent.`);
    }
  }
  const relationshipFingerprint = stableFingerprint((value.topology?.relationships ?? []).map(({ jointId, parentId }) => ({ jointId, parentId })));
  if (value.topology?.fingerprint !== relationshipFingerprint) errors.push('topology fingerprint does not match relationships.');
  if (!Array.isArray(value.balanceConstraints?.supportJointIds) || !value.balanceConstraints.supportJointIds.length) {
    errors.push('balanceConstraints must define supportJointIds.');
  }
  return { valid: errors.length === 0, errors };
}

export function assertHumanRigCoreV5(value) {
  const validation = validateHumanRigCoreV5(value);
  if (!validation.valid) throw new Error(`Invalid HumanRigCore V5: ${validation.errors.join(' ')}`);
  return value;
}

export function cloneHumanRigCoreV5(value) {
  assertHumanRigCoreV5(value);
  return cloneValue(value);
}

export function getHumanRigJointV5(rigCore, jointId) {
  assertHumanRigCoreV5(rigCore);
  const result = rigCore.joints.find((joint) => joint.jointId === jointId);
  return result ? cloneValue(result) : null;
}

function buildChildrenByParent(joints) {
  const result = new Map();
  for (const joint of joints) {
    if (!joint.parentId) continue;
    if (!result.has(joint.parentId)) result.set(joint.parentId, []);
    result.get(joint.parentId).push(joint.id);
  }
  return result;
}

function stableId(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9._-]*$/.test(value);
}
