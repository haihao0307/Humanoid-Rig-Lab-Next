import { assertHumanRigCoreV5, cloneHumanRigCoreV5 } from './human-rig-core-v5.js';
import {
  assertMassDistributionModelV5,
  cloneMassDistributionModelV5,
  createMassDistributionModelV5,
} from './mass-distribution-model-v5.js';
import { assertPoseFrameV4, isPoseFrameV4 } from '../pose/pose-frame-v4.js';
import { cloneValue, finiteNumber } from './core-utils.js';

export const HUMAN_BALANCE_STATE_V5_SCHEMA = 'humanoid_rig/human_balance_state@5.0';
export const HUMAN_BALANCE_STATE_V5_SCHEMA_VERSION = 5;

/**
 * A non-authoritative balance assessment. It reports semantic support and a
 * root-local COM estimate for a future solver; it never changes PhysicsRig.
 */
export function createHumanBalanceStateV5({
  massDistribution = null,
  rigCore,
  poseFrame = null,
  posture = {},
} = {}) {
  const core = cloneHumanRigCoreV5(rigCore);
  assertHumanRigCoreV5(core);
  const massModel = massDistribution
    ? cloneMassDistributionModelV5(massDistribution)
    : createMassDistributionModelV5({ identity: { humanId: core.rigId } });
  assertMassDistributionModelV5(massModel);
  if (poseFrame) assertPoseFrameV4(poseFrame);

  const support = resolveSupport(poseFrame, core, massModel.bodyMeasurements);
  const lean = normalizeLean(posture.lean);
  const stability = resolveStability(support, lean, poseFrame);
  const state = {
    schema: HUMAN_BALANCE_STATE_V5_SCHEMA,
    schemaVersion: HUMAN_BALANCE_STATE_V5_SCHEMA_VERSION,
    type: 'HumanBalanceState',
    humanId: massModel.humanId,
    rigId: core.rigId,
    centerOfMass: {
      position: [
        massModel.centerOfMass.position[0] + lean.lateral * massModel.bodyMeasurements.hipWidth * 0.16,
        massModel.centerOfMass.position[1] - lean.forward * massModel.bodyMeasurements.height * 0.045,
        massModel.centerOfMass.position[2] + lean.forward * massModel.bodyMeasurements.height * 0.035,
      ],
      space: 'character-root-local',
      source: 'mass-distribution-plus-local-quaternion-posture',
    },
    supportArea: support,
    stability,
    lean,
    correctionHint: resolveCorrectionHint(stability, lean, support),
    integration: {
      mode: 'semantic-observer-only',
      usesWorldPositions: false,
      replacesWholeBodySolver: false,
      writesPose: false,
    },
  };
  assertHumanBalanceStateV5(state);
  return state;
}

export function validateHumanBalanceStateV5(value) {
  const errors = [];
  if (!value || value.schema !== HUMAN_BALANCE_STATE_V5_SCHEMA || value.type !== 'HumanBalanceState') {
    errors.push(`schema must be ${HUMAN_BALANCE_STATE_V5_SCHEMA} and type must be HumanBalanceState.`);
    return { valid: false, errors };
  }
  if (value.schemaVersion !== HUMAN_BALANCE_STATE_V5_SCHEMA_VERSION) errors.push('schemaVersion must be 5.');
  if (!Array.isArray(value.centerOfMass?.position) || value.centerOfMass.position.length !== 3
    || value.centerOfMass.position.some((entry) => !Number.isFinite(Number(entry)))) {
    errors.push('centerOfMass.position must be a finite vector3.');
  }
  if (value.centerOfMass?.space !== 'character-root-local') errors.push('centerOfMass must be character-root-local.');
  if (!Array.isArray(value.supportArea?.supportJointIds)) errors.push('supportArea.supportJointIds must be an array.');
  if (!Number.isFinite(Number(value.supportArea?.estimatedArea)) || Number(value.supportArea.estimatedArea) < 0) {
    errors.push('supportArea.estimatedArea must be non-negative.');
  }
  if (!Number.isFinite(Number(value.stability?.score)) || Number(value.stability.score) < 0 || Number(value.stability.score) > 1) {
    errors.push('stability.score must be normalized to [0, 1].');
  }
  if (!Number.isFinite(Number(value.lean?.magnitude)) || Number(value.lean.magnitude) < 0 || Number(value.lean.magnitude) > 1) {
    errors.push('lean.magnitude must be normalized to [0, 1].');
  }
  if (value.integration?.usesWorldPositions !== false || value.integration?.writesPose !== false
    || value.integration?.replacesWholeBodySolver !== false) {
    errors.push('HumanBalanceState V5 must remain a non-authoritative semantic observer.');
  }
  return { valid: errors.length === 0, errors };
}

export function assertHumanBalanceStateV5(value) {
  const validation = validateHumanBalanceStateV5(value);
  if (!validation.valid) throw new Error(`Invalid HumanBalanceState V5: ${validation.errors.join(' ')}`);
  return value;
}

export function cloneHumanBalanceStateV5(value) {
  assertHumanBalanceStateV5(value);
  return cloneValue(value);
}

function resolveSupport(poseFrame, rigCore, measurements) {
  const known = new Set(rigCore.balanceConstraints.supportJointIds);
  const contacts = Array.isArray(poseFrame?.contacts) ? poseFrame.contacts : [];
  const supportJointIds = [...new Set(contacts
    .filter((contact) => contact?.active !== false && known.has(contact.jointId))
    .map((contact) => contact.jointId))];
  const left = supportJointIds.some((jointId) => jointId.startsWith('left'));
  const right = supportJointIds.some((jointId) => jointId.startsWith('right'));
  const supportFeet = Number(left) + Number(right);
  const estimatedWidth = supportFeet >= 2
    ? measurements.hipWidth * 1.45
    : supportFeet === 1
      ? measurements.hipWidth * 0.52
      : 0;
  const estimatedDepth = supportFeet ? Math.max(0.08, measurements.hipThickness * 0.85) : 0;
  return {
    mode: 'semantic-footprint',
    supportJointIds,
    supportFeet,
    estimatedWidth,
    estimatedDepth,
    estimatedArea: estimatedWidth * estimatedDepth,
    source: poseFrame ? 'pose-frame-v4-contacts' : 'no-contact-observation',
  };
}

function normalizeLean(value) {
  const source = value && typeof value === 'object' ? value : {};
  const forward = finiteNumber(source.forward, 0, -1, 1);
  const lateral = finiteNumber(source.lateral, 0, -1, 1);
  const magnitude = Math.min(1, Math.hypot(forward, lateral));
  return {
    forward,
    lateral,
    magnitude,
    source: String(source.source ?? 'local-quaternion-semantic-estimate'),
  };
}

function resolveStability(support, lean, poseFrame) {
  const supportScore = support.supportFeet >= 2 ? 0.94 : support.supportFeet === 1 ? 0.60 : poseFrame ? 0.10 : 0.50;
  const score = clamp(supportScore - lean.magnitude * (support.supportFeet >= 2 ? 0.38 : 0.56), 0, 1);
  return {
    status: support.supportFeet >= 2
      ? (score >= 0.62 ? 'stable-double-support' : 'double-support-leaning')
      : support.supportFeet === 1
        ? (score >= 0.42 ? 'single-support-observed' : 'single-support-unstable')
        : poseFrame ? 'unsupported-or-airborne' : 'unassessed-neutral',
    score,
    supportCount: support.supportFeet,
    confidence: poseFrame ? 'semantic-contact-estimate' : 'neutral-anthropometric-estimate',
  };
}

function resolveCorrectionHint(stability, lean, support) {
  if (stability.score >= 0.62) {
    return { mode: 'none', targetJointIds: [], reason: 'semantic-balance-within-range' };
  }
  if (!support.supportFeet) {
    return { mode: 'defer-to-whole-body-solver', targetJointIds: ['hips', 'leftFoot', 'rightFoot'], reason: 'no-support-contact-observed' };
  }
  return {
    mode: Math.abs(lean.lateral) > Math.abs(lean.forward) ? 'shift-root-laterally' : 'shift-root-over-support',
    targetJointIds: ['hips', 'spine', 'leftFoot', 'rightFoot'],
    reason: stability.status,
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}
