import {
  assertHumanRigCoreV5,
  cloneHumanRigCoreV5,
} from './human-rig-core-v5.js';
import { cloneValue } from './core-utils.js';

export const MUSCLE_SEMANTIC_PROFILE_V5_SCHEMA = 'humanoid_rig/muscle_semantic_profile@5.0';
export const MUSCLE_SEMANTIC_PROFILE_V5_SCHEMA_VERSION = 5;

/**
 * A semantic influence map for the Anatomy Runtime.  It deliberately does
 * not simulate fibres, tissue, forces, or mesh deformation.
 */
export function createMuscleSemanticProfileV5(rigCoreInput) {
  const rigCore = cloneHumanRigCoreV5(rigCoreInput);
  assertHumanRigCoreV5(rigCore);
  const available = new Set(rigCore.joints.map((joint) => joint.jointId));
  const groups = [
    createGroup('trunk-core', 'trunk_core', 'center', ['hips', 'spine', 'chest', 'upperChest'], { chest: 0.52, abdomen: 0.70, hip: 0.35 }, available),
    createGroup('shoulder-complex-left', 'shoulder_complex', 'left', ['leftShoulder', 'leftScapulaCorrective', 'leftUpperArm'], { shoulder: 0.90, chest: 0.28, arm: 0.42 }, available),
    createGroup('shoulder-complex-right', 'shoulder_complex', 'right', ['rightShoulder', 'rightScapulaCorrective', 'rightUpperArm'], { shoulder: 0.90, chest: 0.28, arm: 0.42 }, available),
    createGroup('arm-chain-left', 'arm_chain', 'left', ['leftUpperArm', 'leftLowerArm', 'leftForearmTwist', 'leftHand'], { arm: 0.78, elbow: 0.66, wrist: 0.26 }, available),
    createGroup('arm-chain-right', 'arm_chain', 'right', ['rightUpperArm', 'rightLowerArm', 'rightForearmTwist', 'rightHand'], { arm: 0.78, elbow: 0.66, wrist: 0.26 }, available),
    createGroup('hip-complex-left', 'hip_complex', 'left', ['hips', 'leftUpperLeg', 'leftThighTwist'], { hip: 0.82, thigh: 0.68, abdomen: 0.20 }, available),
    createGroup('hip-complex-right', 'hip_complex', 'right', ['hips', 'rightUpperLeg', 'rightThighTwist'], { hip: 0.82, thigh: 0.68, abdomen: 0.20 }, available),
    createGroup('knee-chain-left', 'knee_chain', 'left', ['leftUpperLeg', 'leftLowerLeg', 'leftCalfTwist', 'leftFoot'], { thigh: 0.66, knee: 0.90, calf: 0.66, foot: 0.26 }, available),
    createGroup('knee-chain-right', 'knee_chain', 'right', ['rightUpperLeg', 'rightLowerLeg', 'rightCalfTwist', 'rightFoot'], { thigh: 0.66, knee: 0.90, calf: 0.66, foot: 0.26 }, available),
  ];
  const profile = {
    schema: MUSCLE_SEMANTIC_PROFILE_V5_SCHEMA,
    schemaVersion: MUSCLE_SEMANTIC_PROFILE_V5_SCHEMA_VERSION,
    type: 'MuscleSemanticProfile',
    rigId: rigCore.rigId,
    compatibleRig: rigCore.sourceRig.compatibleRig,
    mode: 'semantic-motion-influence-only',
    groups,
    diagnostics: {
      groupCount: groups.length,
      usesExistingRigJointsOnly: true,
      producesMeshDeformation: false,
    },
  };
  assertMuscleSemanticProfileV5(profile);
  return profile;
}

export function validateMuscleSemanticProfileV5(value) {
  const errors = [];
  if (!value || value.schema !== MUSCLE_SEMANTIC_PROFILE_V5_SCHEMA || value.type !== 'MuscleSemanticProfile') {
    errors.push(`schema must be ${MUSCLE_SEMANTIC_PROFILE_V5_SCHEMA} and type must be MuscleSemanticProfile.`);
    return { valid: false, errors };
  }
  if (value.schemaVersion !== MUSCLE_SEMANTIC_PROFILE_V5_SCHEMA_VERSION) errors.push('schemaVersion must be 5.');
  if (!stableId(value.rigId)) errors.push('rigId must be a stable identifier.');
  if (!Array.isArray(value.groups) || !value.groups.length) errors.push('groups must be a non-empty array.');
  const ids = new Set();
  for (const group of value.groups ?? []) {
    if (!stableId(group.groupId) || ids.has(group.groupId)) errors.push('Each muscle group requires a unique stable groupId.');
    ids.add(group.groupId);
    if (!String(group.muscleGroup ?? '').trim()) errors.push(`${group.groupId ?? 'group'}.muscleGroup is required.`);
    if (!Array.isArray(group.affectedJoints) || !group.affectedJoints.length) errors.push(`${group.groupId ?? 'group'}.affectedJoints is required.`);
    if (Number(group.activationRange?.minimum) !== 0 || Number(group.activationRange?.maximum) !== 1) {
      errors.push(`${group.groupId ?? 'group'}.activationRange must be normalized to [0, 1].`);
    }
    if (!group.deformationInfluence || typeof group.deformationInfluence !== 'object') {
      errors.push(`${group.groupId ?? 'group'}.deformationInfluence is required.`);
    }
  }
  if (value.diagnostics?.producesMeshDeformation !== false) errors.push('MuscleSemanticProfile must not deform a mesh.');
  return { valid: errors.length === 0, errors };
}

export function assertMuscleSemanticProfileV5(value) {
  const validation = validateMuscleSemanticProfileV5(value);
  if (!validation.valid) throw new Error(`Invalid MuscleSemanticProfile V5: ${validation.errors.join(' ')}`);
  return value;
}

export function cloneMuscleSemanticProfileV5(value) {
  assertMuscleSemanticProfileV5(value);
  return cloneValue(value);
}

function createGroup(groupId, muscleGroup, side, candidates, deformationInfluence, available) {
  const affectedJoints = candidates.filter((jointId) => available.has(jointId));
  return {
    groupId,
    muscleGroup,
    side,
    affectedJoints,
    activationRange: {
      minimum: 0,
      maximum: 1,
      source: 'local-quaternion-semantic-evaluator',
    },
    deformationInfluence: cloneValue(deformationInfluence),
    mode: 'semantic-only',
  };
}

function stableId(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9._-]*$/.test(value);
}
