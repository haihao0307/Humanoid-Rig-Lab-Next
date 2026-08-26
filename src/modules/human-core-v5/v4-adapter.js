import {
  applyBodyProfileToDefinition,
  normalizeBodyProfile,
} from '../../../legacy/v8/src/body-profile.js';
import {
  applyPosePresetToDefinition,
  createStandardHumanoidPreset,
  normalizeSkeletonDefinition,
} from '../../../legacy/v8/src/skeleton-presets.js';
import {
  bodyDNAToProportionProfile,
  bodyDNAFingerprint,
  createBodyDNA,
  proportionProfileToBodyDNA,
} from './body-dna-v5.js';
import {
  assertHumanRigCoreV5,
} from './human-rig-core-v5.js';
import {
  cloneHumanCoreStateV5,
  withHumanCorePoseFrameV5,
} from './human-core-state-v5.js';
import { assertPoseFrameV4, clonePoseFrameV4 } from '../pose/pose-frame-v4.js';
import { cloneValue } from './core-utils.js';

export const HUMAN_CORE_V4_ADAPTER_SCHEMA = 'humanoid_rig/human_core_v4_adapter@5.0';

/**
 * Compatibility bridge only. It compiles V5 anthropometry to the existing
 * V4 BodyProfile/RigDefinition contracts and never owns a second rig state.
 */
export const V4Adapter = Object.freeze({
  schema: HUMAN_CORE_V4_ADAPTER_SCHEMA,
  bodyDNAToProportionProfile: adaptBodyDNAToV4ProportionProfile,
  proportionProfileToBodyDNA: adaptV4ProportionProfileToBodyDNA,
  humanRigCoreToExistingRig: adaptHumanRigCoreToExistingRig,
  poseFrameV4ToHumanCoreState: adaptPoseFrameV4ToHumanCoreState,
  humanCoreStateToPoseFrameV4: adaptHumanCoreStateToPoseFrameV4,
});

export function adaptBodyDNAToV4ProportionProfile(bodyDNAInput) {
  const bodyDNA = createBodyDNA(bodyDNAInput);
  return {
    schema: HUMAN_CORE_V4_ADAPTER_SCHEMA,
    adapterVersion: 1,
    bodyProfile: bodyDNAToProportionProfile(bodyDNA),
    proportionRevision: bodyDNA.proportionRevision,
    sourceBodyDNAId: bodyDNA.bodyDNAId,
  };
}

export function adaptV4ProportionProfileToBodyDNA(profile, options = {}) {
  const normalizedProfile = normalizeBodyProfile(profile);
  return proportionProfileToBodyDNA(normalizedProfile, {
    ...options,
    proportionRevision: options.proportionRevision
      ?? options.proportion_revision
      ?? Math.max(0, Number(normalizedProfile.draftRevision || 1) - 1),
  });
}

export function adaptHumanRigCoreToExistingRig(rigCoreInput, {
  bodyDNA = {},
  pose = 'A',
} = {}) {
  assertHumanRigCoreV5(rigCoreInput);
  const core = rigCoreInput;
  const dna = createBodyDNA(bodyDNA);
  const bodyProfile = bodyDNAToProportionProfile(dna);
  const baseDefinition = createStandardHumanoidPreset(pose);
  const profiledDefinition = applyBodyProfileToDefinition(baseDefinition, bodyProfile, {
    preservePose: false,
  });
  const authoredAsymmetryApplicationCount = applyAuthoredAsymmetryToDefinition(profiledDefinition, dna);
  if (authoredAsymmetryApplicationCount) applyPosePresetToDefinition(profiledDefinition, pose);
  const definition = normalizeSkeletonDefinition(profiledDefinition);
  const actualParents = new Map(definition.joints.map((joint) => [joint.id, joint.parentId ?? null]));
  for (const relationship of core.topology.relationships) {
    if (!actualParents.has(relationship.jointId)) {
      throw new Error(`V4 RigDefinition is missing HumanRigCore joint ${relationship.jointId}.`);
    }
    if (actualParents.get(relationship.jointId) !== relationship.parentId) {
      throw new Error(`V4 RigDefinition parent mismatch for ${relationship.jointId}.`);
    }
  }
  return {
    schema: HUMAN_CORE_V4_ADAPTER_SCHEMA,
    adapterVersion: 1,
    type: 'V4RigAdapterResult',
    definition,
    bodyProfile,
    proportionRevision: dna.proportionRevision,
    sourceBodyDNAId: dna.bodyDNAId,
    bodyDNAFingerprint: bodyDNAFingerprint(dna),
    authoredAsymmetry: cloneValue(dna.asymmetry),
    authoredAsymmetryApplicationCount,
    authoredAsymmetryAuthority: 'BodyDNA -> V4Adapter RigDefinition',
    sourceRigCoreId: core.rigId,
    topologyFingerprint: core.topology.fingerprint,
    authority: 'rig-definition-v4',
  };
}

function applyAuthoredAsymmetryToDefinition(definition, bodyDNA) {
  if (bodyDNA.asymmetry.mode !== 'authored') return 0;
  const joints = new Map(definition.joints.map((joint) => [joint.id, joint]));
  for (const side of ['left', 'right']) {
    const scale = sideScales(bodyDNA, side);
    scaleJointVectors(joints, [`${side}Shoulder`, `${side}UpperArm`], scale.shoulder);
    scaleJointVectors(joints, [
      `${side}LowerArm`, `${side}Hand`, `${side}UpperArmTwist`, `${side}ForearmTwist`,
    ], scale.arm);
    scaleJointVectors(joints, [`${side}HandEnd`, `${side}PalmGrip`], scale.hand);
    scaleJointVectors(joints, [`${side}UpperLeg`], scale.hip);
    scaleJointVectors(joints, [
      `${side}LowerLeg`, `${side}Foot`, `${side}ThighTwist`, `${side}CalfTwist`,
    ], scale.leg);
    scaleJointVectors(joints, [
      `${side}Toes`, `${side}ToesEnd`, `${side}HeelContact`, `${side}BallContact`,
    ], scale.foot);
    for (const joint of definition.joints) {
      if (joint.side === side && joint.category === 'hand') scaleJointVector(joint, scale.hand);
    }
  }
  return 1;
}

function sideScales(bodyDNA, side) {
  return Object.fromEntries(Object.entries(bodyDNA.asymmetry.leftRightScale).map(([key, value]) => [
    key,
    side === 'left' ? value : 2 - value,
  ]));
}

function scaleJointVectors(joints, jointIds, scale) {
  for (const jointId of jointIds) scaleJointVector(joints.get(jointId), scale);
}

function scaleJointVector(joint, scale) {
  if (!joint) return;
  joint.localPosition = joint.localPosition.map((value) => Number(value) * scale);
}

export function adaptPoseFrameV4ToHumanCoreState(stateInput, poseFrame) {
  const state = cloneHumanCoreStateV5(stateInput);
  assertPoseFrameV4(poseFrame);
  return withHumanCorePoseFrameV5(state, poseFrame);
}

export function adaptHumanCoreStateToPoseFrameV4(stateInput) {
  const state = cloneHumanCoreStateV5(stateInput);
  return state.poseState.currentPose ? clonePoseFrameV4(state.poseState.currentPose) : null;
}

export function isV4AdapterResult(value) {
  return Boolean(value && value.schema === HUMAN_CORE_V4_ADAPTER_SCHEMA && value.adapterVersion === 1);
}

export function cloneV4AdapterResult(value) {
  if (!isV4AdapterResult(value)) throw new Error('Invalid Human Core V4 adapter result.');
  return cloneValue(value);
}
