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
  assertNoForbiddenKeys,
  cloneValue,
  normalizeId,
  normalizeRevision,
} from './core-utils.js';
import {
  assertPoseFrameV4,
  clonePoseFrameV4,
} from '../pose/pose-frame-v4.js';
import {
  assertHumanAnatomyStateV5,
  cloneHumanAnatomyStateV5,
  createHumanAnatomyStateV5,
} from './human-anatomy-state-v5.js';

export const HUMAN_CORE_STATE_V5_SCHEMA = 'humanoid_rig/human_core_state@5.0';
export const HUMAN_CORE_STATE_V5_SCHEMA_VERSION = 5;

const STATE_FORBIDDEN_KEYS = new Set([
  'mesh',
  'meshReference',
  'glb',
  'glbReference',
  'vertices',
  'indices',
  'skinWeights',
  'inverseBindMatrices',
  'animationFile',
  'animationBinary',
  'tracks',
]);

/**
 * This is an in-memory Human Core state. It stores V5 data and a V4 pose
 * reference, never renderer objects, binary assets, or animation tracks.
 */
export function createHumanCoreStateV5({
  bodyDNA = {},
  rigCore,
  poseFrame = null,
  motionState = {},
  appearanceState = {},
  anatomyState = null,
  timestamp = Date.now(),
} = {}) {
  const dna = createBodyDNA(bodyDNA);
  const core = cloneHumanRigCoreV5(rigCore);
  assertBodyDNAV5(dna);
  if (poseFrame) assertPoseFrameV4(poseFrame);
  const anatomy = anatomyState
    ? cloneHumanAnatomyStateV5(anatomyState)
    : createHumanAnatomyStateV5({
      bodyDNA: dna,
      rigCore: core,
      poseFrame,
      timestamp,
    });
  assertHumanAnatomyStateV5(anatomy);
  const state = {
    schema: HUMAN_CORE_STATE_V5_SCHEMA,
    schemaVersion: HUMAN_CORE_STATE_V5_SCHEMA_VERSION,
    type: 'HumanCoreState',
    humanId: dna.identity.humanId,
    bodyDNA: cloneBodyDNAV5(dna),
    rigState: {
      rigId: core.rigId,
      compatibleRig: core.sourceRig.compatibleRig,
      topologyFingerprint: core.topology.fingerprint,
      jointAxisSchema: core.sourceRig.jointAxisSchema,
      jointCount: core.topology.jointCount,
      authority: 'rig-definition-v5-projection',
    },
    poseState: {
      authority: 'local-quaternion-v4',
      currentPose: poseFrame ? clonePoseFrameV4(poseFrame) : null,
      revision: poseFrame ? 1 : 0,
    },
    motionState: normalizeMotionState(motionState),
    balanceState: deriveBalanceState(poseFrame, core),
    anatomyState: anatomy,
    appearanceState: normalizeAppearanceState(appearanceState),
    lifecycle: {
      createdAt: finiteTimestamp(timestamp),
      updatedAt: finiteTimestamp(timestamp),
      persistent: false,
      rendererOwned: false,
    },
  };
  assertHumanCoreStateV5(state);
  return state;
}

export function withHumanCorePoseFrameV5(stateInput, poseFrame, { timestamp = Date.now() } = {}) {
  const state = cloneHumanCoreStateV5(stateInput);
  assertPoseFrameV4(poseFrame);
  if (poseFrame.compatibleRig !== state.rigState.compatibleRig) {
    throw new Error(`PoseFrame rig ${poseFrame.compatibleRig} does not match HumanCoreState rig ${state.rigState.compatibleRig}.`);
  }
  if (poseFrame.proportionRevision !== state.bodyDNA.proportionRevision) {
    throw new Error(`PoseFrame proportion r${poseFrame.proportionRevision} does not match BodyDNA r${state.bodyDNA.proportionRevision}.`);
  }
  state.poseState.currentPose = clonePoseFrameV4(poseFrame);
  state.poseState.revision += 1;
  state.balanceState = deriveBalanceState(poseFrame, state.rigState);
  state.lifecycle.updatedAt = finiteTimestamp(timestamp);
  assertHumanCoreStateV5(state);
  return state;
}

export function withHumanCoreMotionStateV5(stateInput, motionState, { timestamp = Date.now() } = {}) {
  const state = cloneHumanCoreStateV5(stateInput);
  state.motionState = normalizeMotionState(motionState);
  state.lifecycle.updatedAt = finiteTimestamp(timestamp);
  assertHumanCoreStateV5(state);
  return state;
}

/**
 * Adds a derived Anatomy Runtime snapshot without changing V4 PhysicsRig or
 * Pose authority. The parent HumanCoreState remains the only V5 owner.
 */
export function withHumanCoreAnatomyStateV5(stateInput, anatomyState, { timestamp = Date.now() } = {}) {
  const state = cloneHumanCoreStateV5(stateInput);
  const anatomy = cloneHumanAnatomyStateV5(anatomyState);
  if (anatomy.humanId !== state.humanId) {
    throw new Error(`HumanAnatomyState human ${anatomy.humanId} does not match HumanCoreState human ${state.humanId}.`);
  }
  if (anatomy.rigId !== state.rigState.rigId) {
    throw new Error(`HumanAnatomyState rig ${anatomy.rigId} does not match HumanCoreState rig ${state.rigState.rigId}.`);
  }
  if (anatomy.proportionRevision !== state.bodyDNA.proportionRevision) {
    throw new Error(`HumanAnatomyState proportion r${anatomy.proportionRevision} does not match BodyDNA r${state.bodyDNA.proportionRevision}.`);
  }
  state.anatomyState = anatomy;
  state.balanceState = {
    ...state.balanceState,
    anatomy: {
      observer: 'human-anatomy-v5',
      status: anatomy.balanceState.stability.status,
      score: anatomy.balanceState.stability.score,
      supportJointIds: [...anatomy.balanceState.supportArea.supportJointIds],
      writesPose: false,
    },
  };
  state.lifecycle.updatedAt = finiteTimestamp(timestamp);
  assertHumanCoreStateV5(state);
  return state;
}

export function validateHumanCoreStateV5(value) {
  const errors = [];
  if (!value || value.schema !== HUMAN_CORE_STATE_V5_SCHEMA || value.type !== 'HumanCoreState') {
    errors.push(`schema must be ${HUMAN_CORE_STATE_V5_SCHEMA} and type must be HumanCoreState.`);
    return { valid: false, errors };
  }
  if (value.schemaVersion !== HUMAN_CORE_STATE_V5_SCHEMA_VERSION) errors.push('schemaVersion must be 5.');
  try {
    assertBodyDNAV5(value.bodyDNA);
  } catch (error) {
    errors.push(error.message);
  }
  if (value.humanId !== value.bodyDNA?.identity?.humanId) errors.push('humanId must match bodyDNA.identity.humanId.');
  if (!value.rigState || !String(value.rigState.rigId ?? '').trim()) errors.push('rigState.rigId is required.');
  if (value.rigState?.authority !== 'rig-definition-v5-projection') errors.push('rigState authority is invalid.');
  if (value.poseState?.authority !== 'local-quaternion-v4') errors.push('poseState authority must remain local-quaternion-v4.');
  if (!Number.isInteger(value.poseState?.revision) || value.poseState.revision < 0) errors.push('poseState.revision must be non-negative.');
  if (value.poseState?.currentPose) {
    try {
      assertPoseFrameV4(value.poseState.currentPose);
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (!value.motionState || typeof value.motionState !== 'object') errors.push('motionState is required.');
  if (!value.balanceState || typeof value.balanceState !== 'object') errors.push('balanceState is required.');
  try {
    assertHumanAnatomyStateV5(value.anatomyState);
    if (value.anatomyState?.humanId !== value.humanId) errors.push('anatomyState.humanId must match HumanCoreState humanId.');
    if (value.anatomyState?.rigId !== value.rigState?.rigId) errors.push('anatomyState.rigId must match HumanCoreState rigState.rigId.');
    if (value.anatomyState?.proportionRevision !== value.bodyDNA?.proportionRevision) {
      errors.push('anatomyState.proportionRevision must match BodyDNA proportionRevision.');
    }
  } catch (error) {
    errors.push(error.message);
  }
  if (!value.appearanceState || typeof value.appearanceState !== 'object') errors.push('appearanceState is required.');
  if (value.lifecycle?.persistent !== false) errors.push('HumanCoreState must remain a non-persistent runtime state.');
  try {
    assertNoForbiddenKeys(value, STATE_FORBIDDEN_KEYS, 'HumanCoreState V5');
  } catch (error) {
    errors.push(error.message);
  }
  return { valid: errors.length === 0, errors };
}

export function assertHumanCoreStateV5(value) {
  const validation = validateHumanCoreStateV5(value);
  if (!validation.valid) throw new Error(`Invalid HumanCoreState V5: ${validation.errors.join(' ')}`);
  return value;
}

export function cloneHumanCoreStateV5(value) {
  assertHumanCoreStateV5(value);
  return cloneValue(value);
}

function normalizeMotionState(value) {
  assertNoForbiddenKeys(value, STATE_FORBIDDEN_KEYS, 'HumanCoreState motionState');
  const source = value && typeof value === 'object' ? value : {};
  const intent = source.intent && typeof source.intent === 'object' ? source.intent : {};
  return {
    intent: {
      intentId: normalizeId(intent.intentId, 'intent-idle'),
      action: String(intent.action ?? 'idle'),
      priority: normalizeRevision(intent.priority),
      constraints: cloneValue(intent.constraints && typeof intent.constraints === 'object' ? intent.constraints : {}),
    },
    sourceClipId: source.sourceClipId == null ? null : normalizeId(source.sourceClipId, 'motion-clip'),
    status: String(source.status ?? 'idle'),
    revision: normalizeRevision(source.revision),
  };
}

function normalizeAppearanceState(value) {
  assertNoForbiddenKeys(value, STATE_FORBIDDEN_KEYS, 'HumanCoreState appearanceState');
  const source = value && typeof value === 'object' ? value : {};
  return {
    skinBindingRef: normalizeReference(source.skinBindingRef),
    faceRef: normalizeReference(source.faceRef),
    clothingRefs: Array.isArray(source.clothingRefs) ? source.clothingRefs.map(normalizeReference).filter(Boolean) : [],
    hairRef: normalizeReference(source.hairRef),
    accessoryRefs: Array.isArray(source.accessoryRefs) ? source.accessoryRefs.map(normalizeReference).filter(Boolean) : [],
  };
}

function normalizeReference(value) {
  if (!value || typeof value !== 'object') return null;
  const id = normalizeId(value.id ?? value.referenceId ?? value.clothingId, '');
  if (!id) return null;
  return {
    id,
    revision: normalizeRevision(value.revision),
    assetClass: value.assetClass == null ? null : String(value.assetClass),
  };
}

function deriveBalanceState(poseFrame, rigCoreOrState) {
  const contacts = Array.isArray(poseFrame?.contacts) ? poseFrame.contacts : [];
  const supportJointIds = (rigCoreOrState?.balanceConstraints?.supportJointIds
    ?? ['leftFoot', 'rightFoot', 'leftHeelContact', 'rightHeelContact', 'leftBallContact', 'rightBallContact']);
  const activeSupportJointIds = contacts
    .filter((contact) => contact?.active !== false && supportJointIds.includes(contact.jointId))
    .map((contact) => contact.jointId);
  return {
    status: activeSupportJointIds.length ? 'contact-observed' : 'unassessed',
    supportJointIds: [...new Set(activeSupportJointIds)],
    centerOfMassPolicy: 'semantic-only-v5-phase-1',
    solverOwned: false,
  };
}

function finiteTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}
