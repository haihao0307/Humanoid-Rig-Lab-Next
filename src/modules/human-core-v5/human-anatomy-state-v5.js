import {
  assertBodyDNAV5,
  cloneBodyDNAV5,
  createBodyDNA,
} from './body-dna-v5.js';
import {
  assertHumanRigCoreV5,
  cloneHumanRigCoreV5,
} from './human-rig-core-v5.js';
import {
  assertMassDistributionModelV5,
  cloneMassDistributionModelV5,
  createMassDistributionModelV5,
} from './mass-distribution-model-v5.js';
import {
  assertMuscleSemanticProfileV5,
  createMuscleSemanticProfileV5,
} from './muscle-semantic-profile-v5.js';
import {
  assertHumanBalanceStateV5,
  createHumanBalanceStateV5,
} from './human-balance-state-v5.js';
import {
  assertAnatomyDeformationSignalV5,
  createAnatomyDeformationSignalV5,
} from './anatomy-deformation-signal-v5.js';
import { assertPoseFrameV4, clonePoseFrameV4 } from '../pose/pose-frame-v4.js';
import { assertNoForbiddenKeys, cloneValue, finiteNumber } from './core-utils.js';

export const HUMAN_ANATOMY_STATE_V5_SCHEMA = 'humanoid_rig/human_anatomy_state@5.0';
export const HUMAN_ANATOMY_STATE_V5_SCHEMA_VERSION = 5;

const ANATOMY_FORBIDDEN_KEYS = new Set([
  'mesh', 'meshReference', 'glb', 'glbReference', 'texture', 'textureReference',
  'vertices', 'indices', 'skinWeights', 'inverseBindMatrices', 'tracks', 'animationBinary',
]);

/**
 * Renderer-neutral human anatomy state. Its numbers are semantic inputs for
 * future deformation/solver adapters, not a replacement for V4 skin or mesh.
 */
export function createHumanAnatomyStateV5({
  bodyDNA = {},
  rigCore,
  poseFrame = null,
  massDistribution = null,
  muscleProfile = null,
  muscleState = null,
  jointLoad = null,
  balanceState = null,
  bodyVolumeState = null,
  postureState = null,
  deformationSignal = null,
  timestamp = Date.now(),
} = {}) {
  assertNoForbiddenKeys(arguments[0], ANATOMY_FORBIDDEN_KEYS, 'HumanAnatomyState V5 input');
  const dna = createBodyDNA(bodyDNA);
  const core = cloneHumanRigCoreV5(rigCore);
  assertBodyDNAV5(dna);
  assertHumanRigCoreV5(core);
  if (poseFrame) assertPoseFrameV4(poseFrame);
  const massModel = massDistribution
    ? cloneMassDistributionModelV5(massDistribution)
    : createMassDistributionModelV5(dna);
  assertMassDistributionModelV5(massModel);
  const profile = muscleProfile ?? createMuscleSemanticProfileV5(core);
  assertMuscleSemanticProfileV5(profile);
  const normalizedMuscleState = normalizeMuscleState(muscleState, profile);
  const normalizedPosture = normalizePostureState(postureState, poseFrame);
  const normalizedBalance = balanceState
    ? cloneValue(balanceState)
    : createHumanBalanceStateV5({ massDistribution: massModel, rigCore: core, poseFrame, posture: normalizedPosture });
  assertHumanBalanceStateV5(normalizedBalance);
  const normalizedVolume = normalizeBodyVolumeState(bodyVolumeState, dna);
  const normalizedLoad = normalizeJointLoad(jointLoad, core, normalizedMuscleState);
  const normalizedSignal = deformationSignal
    ? cloneValue(deformationSignal)
    : createAnatomyDeformationSignalV5({
      humanId: dna.identity.humanId,
      bodyDNAId: dna.bodyDNAId,
      proportionRevision: dna.proportionRevision,
      armVolume: normalizedVolume.regions.arm,
      legVolume: normalizedVolume.regions.leg,
    });
  assertAnatomyDeformationSignalV5(normalizedSignal);
  const state = {
    schema: HUMAN_ANATOMY_STATE_V5_SCHEMA,
    schemaVersion: HUMAN_ANATOMY_STATE_V5_SCHEMA_VERSION,
    type: 'HumanAnatomyState',
    humanId: dna.identity.humanId,
    bodyDNAId: dna.bodyDNAId,
    rigId: core.rigId,
    proportionRevision: dna.proportionRevision,
    source: {
      poseFrame: poseFrame ? clonePoseFrameV4(poseFrame) : null,
      poseAuthority: poseFrame ? 'local-quaternion-v4' : 'neutral-body-dna',
      usesWorldPositions: false,
    },
    muscleState: normalizedMuscleState,
    massDistribution: massModel,
    jointLoad: normalizedLoad,
    balanceState: normalizedBalance,
    bodyVolumeState: normalizedVolume,
    postureState: normalizedPosture,
    deformationSignal: normalizedSignal,
    lifecycle: {
      timestamp: finiteTimestamp(timestamp),
      persistent: false,
      rendererOwned: false,
      writesMesh: false,
    },
  };
  assertHumanAnatomyStateV5(state);
  return state;
}

export function validateHumanAnatomyStateV5(value) {
  const errors = [];
  if (!value || value.schema !== HUMAN_ANATOMY_STATE_V5_SCHEMA || value.type !== 'HumanAnatomyState') {
    errors.push(`schema must be ${HUMAN_ANATOMY_STATE_V5_SCHEMA} and type must be HumanAnatomyState.`);
    return { valid: false, errors };
  }
  if (value.schemaVersion !== HUMAN_ANATOMY_STATE_V5_SCHEMA_VERSION) errors.push('schemaVersion must be 5.');
  for (const key of ['humanId', 'bodyDNAId', 'rigId']) {
    if (!stableId(value[key])) errors.push(`${key} must be a stable identifier.`);
  }
  try { assertMassDistributionModelV5(value.massDistribution); } catch (error) { errors.push(error.message); }
  if (value.massDistribution?.humanId !== value.humanId) errors.push('massDistribution.humanId must match HumanAnatomyState humanId.');
  if (!Array.isArray(value.muscleState?.activations)) errors.push('muscleState.activations must be an array.');
  for (const activation of value.muscleState?.activations ?? []) {
    if (!stableId(activation.groupId) || !Number.isFinite(Number(activation.activation))
      || Number(activation.activation) < 0 || Number(activation.activation) > 1) {
      errors.push('Each muscle activation must have a stable groupId and normalized activation.');
    }
  }
  if (!Array.isArray(value.jointLoad?.entries)) errors.push('jointLoad.entries must be an array.');
  for (const entry of value.jointLoad?.entries ?? []) {
    if (!stableId(entry.jointId) || !Number.isFinite(Number(entry.load)) || Number(entry.load) < 0 || Number(entry.load) > 1) {
      errors.push('Each jointLoad entry requires a stable jointId and normalized load.');
    }
  }
  try { assertHumanBalanceStateV5(value.balanceState); } catch (error) { errors.push(error.message); }
  if (value.bodyVolumeState?.writesMesh !== false) errors.push('bodyVolumeState must remain semantic and must not write mesh data.');
  if (value.postureState?.usesWorldPositions !== false) errors.push('postureState must remain local-quaternion semantic data.');
  try { assertAnatomyDeformationSignalV5(value.deformationSignal); } catch (error) { errors.push(error.message); }
  if (value.deformationSignal?.application?.writesMesh !== false) errors.push('deformationSignal must not write a mesh.');
  if (value.lifecycle?.persistent !== false || value.lifecycle?.rendererOwned !== false || value.lifecycle?.writesMesh !== false) {
    errors.push('HumanAnatomyState must remain non-persistent, non-renderer, and mesh-free.');
  }
  try { assertNoForbiddenKeys(value, ANATOMY_FORBIDDEN_KEYS, 'HumanAnatomyState V5'); } catch (error) { errors.push(error.message); }
  return { valid: errors.length === 0, errors };
}

export function assertHumanAnatomyStateV5(value) {
  const validation = validateHumanAnatomyStateV5(value);
  if (!validation.valid) throw new Error(`Invalid HumanAnatomyState V5: ${validation.errors.join(' ')}`);
  return value;
}

export function cloneHumanAnatomyStateV5(value) {
  assertHumanAnatomyStateV5(value);
  return cloneValue(value);
}

function normalizeMuscleState(value, profile) {
  const source = value && typeof value === 'object' ? value : {};
  const byId = new Map((source.activations ?? []).map((entry) => [entry.groupId, entry]));
  return {
    mode: 'semantic-activation-only',
    profileSchema: profile.schema,
    activations: profile.groups.map((group) => ({
      groupId: group.groupId,
      muscleGroup: group.muscleGroup,
      side: group.side,
      affectedJoints: [...group.affectedJoints],
      activation: finiteNumber(byId.get(group.groupId)?.activation, 0, 0, 1),
      source: String(byId.get(group.groupId)?.source ?? 'neutral-anatomy-state'),
    })),
  };
}

function normalizeJointLoad(value, rigCore, muscleState) {
  const source = value && typeof value === 'object' ? value : {};
  const byId = new Map((source.entries ?? []).map((entry) => [entry.jointId, entry]));
  return {
    unit: 'relative-load',
    source: String(source.source ?? 'semantic-anatomy-estimate'),
    entries: rigCore.joints
      .filter((joint) => joint.core)
      .map((joint) => ({
        jointId: joint.jointId,
        load: finiteNumber(byId.get(joint.jointId)?.load, 0, 0, 1),
        activationContribution: finiteNumber(byId.get(joint.jointId)?.activationContribution, 0, 0, 1),
        massInfluence: finiteNumber(joint.massInfluence?.self, 0, 0, 1),
      })),
  };
}

function normalizeBodyVolumeState(value, bodyDNA) {
  const source = value && typeof value === 'object' ? value : {};
  const upperFitness = (bodyDNA.fitnessProfile.muscle * 0.70) + (bodyDNA.fitnessProfile.fat * 0.30);
  const lowerFitness = (bodyDNA.fitnessProfile.muscle * 0.65) + (bodyDNA.fitnessProfile.fat * 0.35);
  return {
    mode: 'semantic-volume-only',
    writesMesh: false,
    regions: {
      shoulder: finiteNumber(source.regions?.shoulder, (bodyDNA.proportion.shoulderWidth / bodyDNA.proportion.height) * 2.6, 0, 1),
      chest: finiteNumber(source.regions?.chest, bodyDNA.proportion.bodyThickness.chest * 2.8, 0, 1),
      abdomen: finiteNumber(source.regions?.abdomen, bodyDNA.proportion.bodyThickness.waist * 2.8, 0, 1),
      hip: finiteNumber(source.regions?.hip, bodyDNA.proportion.bodyThickness.hip * 2.8, 0, 1),
      arm: finiteNumber(source.regions?.arm, upperFitness, 0, 1),
      leg: finiteNumber(source.regions?.leg, lowerFitness, 0, 1),
    },
    source: 'body-dna-volume-estimate',
  };
}

function normalizePostureState(value, poseFrame) {
  const source = value && typeof value === 'object' ? value : {};
  const lean = source.lean && typeof source.lean === 'object' ? source.lean : {};
  return {
    mode: 'local-quaternion-semantic-posture',
    source: String(source.source ?? (poseFrame ? 'pose-frame-v4' : 'neutral-body-dna')),
    usesWorldPositions: false,
    stance: String(source.stance ?? (poseFrame ? 'pose-observed' : 'neutral-unobserved')),
    lean: {
      forward: finiteNumber(lean.forward, 0, -1, 1),
      lateral: finiteNumber(lean.lateral, 0, -1, 1),
      magnitude: finiteNumber(lean.magnitude, 0, 0, 1),
      source: String(lean.source ?? 'local-quaternion-semantic-estimate'),
    },
    symmetry: finiteNumber(source.symmetry, 1, 0, 1),
    confidence: finiteNumber(source.confidence, poseFrame ? 0.65 : 0.35, 0, 1),
  };
}

function finiteTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function stableId(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9._-]*$/.test(value);
}
