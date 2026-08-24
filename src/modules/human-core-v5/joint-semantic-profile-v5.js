import {
  cloneValue,
  compareNumberArrays,
  finiteNumber,
  normalizeUnitVector,
} from './core-utils.js';

export const JOINT_SEMANTIC_PROFILE_V5_SCHEMA = 'humanoid_rig/joint_semantic_profile@5.0';
export const JOINT_SEMANTIC_PROFILE_V5_SCHEMA_VERSION = 5;

const IDENTITY_AXIS = Object.freeze([1, 0, 0]);

/**
 * Projects the existing RigDefinition joint-axis contract into anatomical
 * semantics. It does not create or mutate a second axis schema.
 */
export function createJointSemanticProfileV5(joint, axisContract) {
  if (!joint?.id) throw new Error('JointSemanticProfile V5 requires a source RigDefinition joint.');
  const axisEntry = axisContract?.entries?.[joint.id];
  if (!axisEntry) throw new Error(`RigDefinition jointAxes is missing ${joint.id}.`);
  const semantic = resolveSemanticDefinition(joint);
  const profile = {
    schema: JOINT_SEMANTIC_PROFILE_V5_SCHEMA,
    schemaVersion: JOINT_SEMANTIC_PROFILE_V5_SCHEMA_VERSION,
    type: 'JointSemanticProfile',
    jointId: joint.id,
    parentId: joint.parentId ?? null,
    mobilityProfile: semantic.mobilityProfile,
    limitProfile: semantic.limitProfile,
    massInfluence: semantic.massInfluence,
    motionRole: semantic.motionRole,
    affects: semantic.affects,
    axisReference: {
      schema: axisContract.schema,
      space: axisContract.space,
      handedness: axisContract.handedness,
      quaternionOrder: axisContract.quaternionOrder,
      source: axisEntry.source,
      jointType: axisEntry.jointType,
      twistAxisLocal: normalizeUnitVector(axisEntry.twistAxisLocal, IDENTITY_AXIS),
      bendAxisLocal: normalizeUnitVector(axisEntry.bendAxisLocal, [0, 1, 0]),
      sideAxisLocal: normalizeUnitVector(axisEntry.sideAxisLocal, [0, 0, 1]),
    },
    source: {
      rigJointType: String(joint.jointType ?? 'free'),
      rigTier: String(joint.rigTier ?? 'core'),
      solverParticipation: String(joint.solverParticipation ?? 'full-body'),
      role: String(joint.role ?? 'deform'),
      limitLabel: String(joint.limitLabel ?? ''),
    },
  };
  assertJointSemanticProfileV5(profile);
  return profile;
}

export function validateJointSemanticProfileV5(value) {
  const errors = [];
  if (!value || value.schema !== JOINT_SEMANTIC_PROFILE_V5_SCHEMA || value.type !== 'JointSemanticProfile') {
    errors.push(`schema must be ${JOINT_SEMANTIC_PROFILE_V5_SCHEMA} and type must be JointSemanticProfile.`);
    return { valid: false, errors };
  }
  if (value.schemaVersion !== JOINT_SEMANTIC_PROFILE_V5_SCHEMA_VERSION) errors.push('schemaVersion must be 5.');
  if (!stableJointId(value.jointId)) errors.push('jointId must be a stable identifier.');
  if (value.parentId != null && !stableJointId(value.parentId)) errors.push('parentId must be null or a stable identifier.');
  if (!Array.isArray(value.mobilityProfile?.motions) || !value.mobilityProfile.motions.length) {
    errors.push('mobilityProfile.motions must be a non-empty array.');
  }
  if (!value.limitProfile || typeof value.limitProfile !== 'object') errors.push('limitProfile is required.');
  if (!value.massInfluence || !Number.isFinite(Number(value.massInfluence.self))) {
    errors.push('massInfluence.self must be finite.');
  }
  if (!String(value.motionRole ?? '').trim()) errors.push('motionRole is required.');
  if (!Array.isArray(value.affects)) errors.push('affects must be an array.');
  const axes = value.axisReference;
  if (axes?.schema !== 'humanoid_rig/joint_axes@1.0') {
    errors.push('axisReference must reference the existing humanoid_rig/joint_axes@1.0 contract.');
  } else {
    validateAxis(axes.twistAxisLocal, 'twistAxisLocal', errors);
    validateAxis(axes.bendAxisLocal, 'bendAxisLocal', errors);
    validateAxis(axes.sideAxisLocal, 'sideAxisLocal', errors);
    if (Array.isArray(axes.twistAxisLocal) && Array.isArray(axes.bendAxisLocal) && Array.isArray(axes.sideAxisLocal)) {
      const cross = crossAxis(axes.twistAxisLocal, axes.bendAxisLocal);
      if (!compareNumberArrays(normalizeUnitVector(cross, [0, 0, 1]), normalizeUnitVector(axes.sideAxisLocal, [0, 0, 1]), 1e-5)) {
        errors.push('axisReference must preserve the source right-handed axis basis.');
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function assertJointSemanticProfileV5(value) {
  const validation = validateJointSemanticProfileV5(value);
  if (!validation.valid) throw new Error(`Invalid JointSemanticProfile V5: ${validation.errors.join(' ')}`);
  return value;
}

export function cloneJointSemanticProfileV5(value) {
  assertJointSemanticProfileV5(value);
  return cloneValue(value);
}

function resolveSemanticDefinition(joint) {
  const id = String(joint.id);
  if (id === 'hips') return definition('pelvis', ['tilt', 'roll', 'yaw'], ranges({ tilt: [-35, 45], roll: [-25, 25], yaw: [-45, 45] }), 1, 1, ['spine', 'leftUpperLeg', 'rightUpperLeg', 'centerOfMass']);
  if (['spine', 'chest', 'upperChest'].includes(id)) return definition('spine', ['flexion', 'extension', 'lateral_flexion', 'axial_rotation'], ranges({ flexion: [0, 35], extension: [0, 25], lateral_flexion: [0, 25], axial_rotation: [0, 40] }), 0.75, 0.8, [nextSpineJoint(id), 'leftShoulder', 'rightShoulder']);
  if (id === 'neck' || id === 'head') return definition('head-neck', ['flexion', 'extension', 'lateral_flexion', 'axial_rotation'], ranges({ flexion: [0, 55], extension: [0, 55], lateral_flexion: [0, 45], axial_rotation: [0, 70] }), 0.35, 0.25, [id === 'neck' ? 'head' : 'gazeTarget']);
  if (isShoulderGirdle(id)) return definition('shoulder-girdle', ['elevation', 'depression', 'protraction', 'retraction', 'axial_rotation'], ranges({ elevation: [0, 35], depression: [0, 15], protraction: [0, 25], retraction: [0, 25], axial_rotation: [0, 20] }), 0.16, 0.35, shoulderGirdleEffects(id));
  if (isUpperArm(id)) return definition('shoulder-ball', ['flexion', 'extension', 'abduction', 'adduction', 'internal_rotation', 'external_rotation'], ranges({ flexion: [0, 170], extension: [0, 55], abduction: [0, 170], adduction: [0, 45], internal_rotation: [0, 70], external_rotation: [0, 90] }), 0.12, 0.55, shoulderEffects(id));
  if (isLowerArm(id)) return definition('elbow-forearm', ['flexion', 'extension', 'pronation', 'supination'], ranges({ flexion: [0, 145], extension: [0, 5], pronation: [0, 85], supination: [0, 85] }), 0.08, 0.42, [handFor(id), twistFor(id)]);
  if (isHand(id)) return definition('wrist-hand', ['flexion', 'extension', 'radial_deviation', 'ulnar_deviation'], ranges({ flexion: [0, 80], extension: [0, 70], radial_deviation: [0, 20], ulnar_deviation: [0, 30] }), 0.05, 0.25, fingerChildren(id));
  if (isUpperLeg(id)) return definition('hip-ball', ['flexion', 'extension', 'abduction', 'adduction', 'internal_rotation', 'external_rotation'], ranges({ flexion: [0, 130], extension: [0, 18], abduction: [0, 45], adduction: [0, 30], internal_rotation: [0, 45], external_rotation: [0, 60] }), 0.18, 0.75, [lowerLegFor(id), thighTwistFor(id), 'hips']);
  if (isLowerLeg(id)) return definition('knee-hinge', ['flexion', 'extension'], ranges({ flexion: [0, 140], extension: [0, 2] }, { reverseBendBlocked: true }), 0.13, 0.65, [footFor(id), calfTwistFor(id)]);
  if (isFoot(id)) return definition('ankle-foot', ['dorsiflexion', 'plantarflexion', 'inversion', 'eversion'], ranges({ dorsiflexion: [0, 15], plantarflexion: [0, 55], inversion: [0, 20], eversion: [0, 20] }), 0.08, 0.65, [toesFor(id), contactFor(id)]);
  if (isToe(id)) return definition('toe', ['flexion', 'extension'], ranges({ flexion: [0, 35], extension: [0, 45] }), 0.03, 0.2, [contactFor(id)]);
  if (String(joint.role) === 'corrective' || String(joint.rigTier) !== 'core') return definition('optional-deform', ['derived'], ranges({ derived: [0, 1] }), 0, 0, []);
  if (joint.isControl) return definition('control', ['target'], ranges({ target: [0, 1] }), 0, 0, [joint.followJointId].filter(Boolean));
  return definition('structural', ['stabilize'], ranges({ stabilize: [0, 1] }), 0.1, 0.1, []);
}

function definition(motionRole, motions, limitProfile, self, downstream, affects) {
  return {
    motionRole,
    mobilityProfile: {
      kind: motionRole,
      motions,
      axisContractRequired: true,
      space: 'joint-local-at-bind',
    },
    limitProfile,
    massInfluence: {
      self: finiteNumber(self, 0, 0, 1),
      downstream: finiteNumber(downstream, 0, 0, 1),
    },
    affects: [...new Set(affects.filter(Boolean))],
  };
}

function ranges(motions, flags = {}) {
  return { unit: 'degrees', ranges: motions, ...flags };
}

function isShoulderGirdle(id) { return /(?:left|right)Shoulder$/.test(id); }
function isUpperArm(id) { return /(?:left|right)UpperArm$/.test(id); }
function isLowerArm(id) { return /(?:left|right)LowerArm$/.test(id); }
function isHand(id) { return /(?:left|right)Hand$/.test(id); }
function isUpperLeg(id) { return /(?:left|right)UpperLeg$/.test(id); }
function isLowerLeg(id) { return /(?:left|right)LowerLeg$/.test(id); }
function isFoot(id) { return /(?:left|right)Foot$/.test(id); }
function isToe(id) { return /(?:left|right)Toes$/.test(id); }
function sideOf(id) { return String(id).startsWith('left') ? 'left' : 'right'; }
function nextSpineJoint(id) { return ({ spine: 'chest', chest: 'upperChest', upperChest: 'neck' })[id] ?? null; }
function handFor(id) { return `${sideOf(id)}Hand`; }
function lowerLegFor(id) { return `${sideOf(id)}LowerLeg`; }
function footFor(id) { return `${sideOf(id)}Foot`; }
function toesFor(id) { return `${sideOf(id)}Toes`; }
function twistFor(id) { return `${sideOf(id)}ForearmTwist`; }
function thighTwistFor(id) { return `${sideOf(id)}ThighTwist`; }
function calfTwistFor(id) { return `${sideOf(id)}CalfTwist`; }
function contactFor(id) { return `${sideOf(id)}${id.includes('Foot') ? 'HeelContact' : 'BallContact'}`; }
function shoulderGirdleEffects(id) { const side = sideOf(id); return [`${side}UpperArm`, `${side}ScapulaCorrective`, 'upperChest']; }
function shoulderEffects(id) { const side = sideOf(id); return [`${side}Shoulder`, `${side}ScapulaCorrective`, `${side}LowerArm`, 'upperChest']; }
function fingerChildren(id) { const side = sideOf(id); return [`${side}ThumbMetacarpal`, `${side}IndexProximal`, `${side}MiddleProximal`, `${side}RingProximal`, `${side}LittleProximal`]; }

function validateAxis(value, label, errors) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((component) => !Number.isFinite(Number(component)))) {
    errors.push(`axisReference.${label} must be a finite vector3.`);
    return;
  }
  if (Math.abs(Math.hypot(...value.map(Number)) - 1) > 1e-5) errors.push(`axisReference.${label} must be normalized.`);
}

function crossAxis(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function stableJointId(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9._-]*$/.test(value);
}
