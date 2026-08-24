export const SKIN_BINDING_PROFILE_V4_SCHEMA = 'humanoid_rig/skin_binding_profile@4.0';

export const CORE_SKIN_JOINT_IDS = Object.freeze([
  'hips',
  'spine',
  'chest',
  'upperChest',
  'neck',
  'head',
  'leftUpperArm',
  'rightUpperArm',
  'leftLowerArm',
  'rightLowerArm',
  'leftHand',
  'rightHand',
  'leftUpperLeg',
  'rightUpperLeg',
  'leftLowerLeg',
  'rightLowerLeg',
  'leftFoot',
  'rightFoot',
]);

const CORE_JOINT_MAP = Object.freeze(Object.fromEntries(
  CORE_SKIN_JOINT_IDS.map((jointId) => [jointId, jointId]),
));

const DEFORM_JOINT_MAP = Object.freeze({
  leftShoulder: Object.freeze({ sourceJointId: 'leftShoulder', mode: 'direct', optional: true }),
  rightShoulder: Object.freeze({ sourceJointId: 'rightShoulder', mode: 'direct', optional: true }),
  leftToes: Object.freeze({ sourceJointId: 'leftToes', mode: 'direct', optional: true }),
  rightToes: Object.freeze({ sourceJointId: 'rightToes', mode: 'direct', optional: true }),
  leftHandEnd: Object.freeze({ sourceJointId: 'leftHandEnd', mode: 'direct', optional: true }),
  rightHandEnd: Object.freeze({ sourceJointId: 'rightHandEnd', mode: 'direct', optional: true }),
  leftUpperArmTwist: Object.freeze({ sourceJointId: 'leftUpperArm', mode: 'fractional', weight: 0.5, optional: true }),
  rightUpperArmTwist: Object.freeze({ sourceJointId: 'rightUpperArm', mode: 'fractional', weight: 0.5, optional: true }),
  leftForearmTwist: Object.freeze({ sourceJointId: 'leftLowerArm', mode: 'fractional', weight: 0.5, optional: true }),
  rightForearmTwist: Object.freeze({ sourceJointId: 'rightLowerArm', mode: 'fractional', weight: 0.5, optional: true }),
  leftThighTwist: Object.freeze({ sourceJointId: 'leftUpperLeg', mode: 'fractional', weight: 0.5, optional: true }),
  rightThighTwist: Object.freeze({ sourceJointId: 'rightUpperLeg', mode: 'fractional', weight: 0.5, optional: true }),
  leftCalfTwist: Object.freeze({ sourceJointId: 'leftLowerLeg', mode: 'fractional', weight: 0.5, optional: true }),
  rightCalfTwist: Object.freeze({ sourceJointId: 'rightLowerLeg', mode: 'fractional', weight: 0.5, optional: true }),
});

const CORRECTIVE_MAP = Object.freeze({
  leftShoulderVolume: Object.freeze({ region: 'shoulder', driverJointId: 'leftUpperArm', startAngle: 0.20, fullAngle: 1.25 }),
  rightShoulderVolume: Object.freeze({ region: 'shoulder', driverJointId: 'rightUpperArm', startAngle: 0.20, fullAngle: 1.25 }),
  leftElbowVolume: Object.freeze({ region: 'elbow', driverJointId: 'leftLowerArm', startAngle: 0.32, fullAngle: 1.75 }),
  rightElbowVolume: Object.freeze({ region: 'elbow', driverJointId: 'rightLowerArm', startAngle: 0.32, fullAngle: 1.75 }),
  leftWristVolume: Object.freeze({ region: 'wrist', driverJointId: 'leftHand', startAngle: 0.20, fullAngle: 1.15 }),
  rightWristVolume: Object.freeze({ region: 'wrist', driverJointId: 'rightHand', startAngle: 0.20, fullAngle: 1.15 }),
  leftHipVolume: Object.freeze({ region: 'hip', driverJointId: 'leftUpperLeg', startAngle: 0.24, fullAngle: 1.30 }),
  rightHipVolume: Object.freeze({ region: 'hip', driverJointId: 'rightUpperLeg', startAngle: 0.24, fullAngle: 1.30 }),
  leftKneeVolume: Object.freeze({ region: 'knee', driverJointId: 'leftLowerLeg', startAngle: 0.28, fullAngle: 1.80 }),
  rightKneeVolume: Object.freeze({ region: 'knee', driverJointId: 'rightLowerLeg', startAngle: 0.28, fullAngle: 1.80 }),
});

export const SMPL24_COMPATIBILITY_BINDING_PROFILE_V4 = deepFreeze({
  schema: SKIN_BINDING_PROFILE_V4_SCHEMA,
  schemaVersion: 4,
  bindingVersion: 'skin-binding-v4-smpl24-compat@1',
  name: 'SMPL24 Compatibility Binding V4',
  assetReference: 'assets/smpl/smpl-male-surface-skinned.glb',
  assetClass: 'compatibility',
  productionReady: false,
  compatibleRig: 'rig@0.4.0',
  expectedJointCount: 24,
  requiredAttributes: ['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0'],
  optionalProductionAttributes: ['TEXCOORD_0', 'TANGENT'],
  weightSource: 'asset-prebound',
  inverseBindSource: 'asset-prebound',
  runtimeWeightGeneration: false,
  proportionPolicy: 'lock-on-first-final-pose',
  boundProportionRevision: null,
  deformationMode: 'gpu-lbs-bone-corrective',
  coreJointMap: CORE_JOINT_MAP,
  deformJointMap: DEFORM_JOINT_MAP,
  correctiveMap: CORRECTIVE_MAP,
  quality: {
    level: 'compatibility',
    authoredTwistWeights: false,
    authoredScapulaWeights: false,
    authoredFingerWeights: false,
    authoredCorrectiveTargets: false,
    uv: false,
    tangent: false,
  },
});

export function createSkinBindingProfileV4(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    ...structuredClone(SMPL24_COMPATIBILITY_BINDING_PROFILE_V4),
    ...structuredClone(source),
    schema: SKIN_BINDING_PROFILE_V4_SCHEMA,
    schemaVersion: 4,
    coreJointMap: { ...CORE_JOINT_MAP, ...(source.coreJointMap ?? {}) },
    deformJointMap: { ...DEFORM_JOINT_MAP, ...(source.deformJointMap ?? {}) },
    correctiveMap: { ...CORRECTIVE_MAP, ...(source.correctiveMap ?? {}) },
    quality: {
      ...SMPL24_COMPATIBILITY_BINDING_PROFILE_V4.quality,
      ...(source.quality ?? {}),
    },
  };
}

export function validateSkinBindingProfileV4(profileInput, asset = {}) {
  const profile = createSkinBindingProfileV4(profileInput);
  const errors = [];
  const warnings = [];
  const jointIds = new Set(asset.jointIds ?? []);
  const attributes = new Set(asset.attributes ?? []);

  if (!String(profile.bindingVersion ?? '').trim()) errors.push('bindingVersion is required.');
  if (!String(profile.compatibleRig ?? '').trim()) errors.push('compatibleRig is required.');
  if (profile.weightSource !== 'asset-prebound') {
    errors.push('Production Skin V4 requires asset-prebound JOINTS_0 and WEIGHTS_0.');
  }
  if (profile.inverseBindSource !== 'asset-prebound') {
    errors.push('Production Skin V4 requires asset-prebound inverseBindMatrices.');
  }
  if (profile.runtimeWeightGeneration !== false) {
    errors.push('runtimeWeightGeneration must be false on the V4 production path.');
  }
  if (asset.compatibleRig && asset.compatibleRig !== profile.compatibleRig) {
    errors.push(`Rig mismatch: asset ${asset.compatibleRig}, binding ${profile.compatibleRig}.`);
  }
  if (jointIds.size && profile.expectedJointCount !== jointIds.size) {
    errors.push(`Joint count mismatch: expected ${profile.expectedJointCount}, received ${jointIds.size}.`);
  }
  if (Number.isInteger(asset.inverseBindMatrixCount) && asset.inverseBindMatrixCount > 0
    && asset.inverseBindMatrixCount !== jointIds.size) {
    errors.push('inverseBindMatrices count must equal the asset joint count.');
  }
  for (const attribute of profile.requiredAttributes ?? []) {
    if (attributes.size && !attributes.has(attribute)) errors.push(`Missing required attribute ${attribute}.`);
  }
  for (const [sourceJointId, targetJointId] of Object.entries(profile.coreJointMap ?? {})) {
    if (!sourceJointId || !targetJointId) errors.push('coreJointMap contains an empty joint ID.');
    if (jointIds.size && !jointIds.has(targetJointId)) {
      errors.push(`Core target joint ${targetJointId} is absent from the skin asset.`);
    }
  }
  for (const [targetJointId, mapping] of Object.entries(profile.deformJointMap ?? {})) {
    if (!mapping?.sourceJointId) errors.push(`Deform target ${targetJointId} has no sourceJointId.`);
    if (!['direct', 'fractional', 'identity'].includes(mapping?.mode)) {
      errors.push(`Deform target ${targetJointId} has unsupported mode ${mapping?.mode}.`);
    }
    if (jointIds.size && !jointIds.has(targetJointId) && mapping?.optional !== true) {
      errors.push(`Required deform target ${targetJointId} is absent from the skin asset.`);
    }
  }

  if (profile.productionReady === true) {
    for (const attribute of profile.optionalProductionAttributes ?? []) {
      if (!attributes.has(attribute)) errors.push(`Production asset is missing ${attribute}.`);
    }
    for (const field of ['authoredTwistWeights', 'authoredScapulaWeights', 'authoredFingerWeights']) {
      if (profile.quality?.[field] !== true) errors.push(`Production asset requires ${field}.`);
    }
  } else {
    warnings.push('Binding is compatibility-only and must not be reported as productionReady.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    profile,
    assetJointCount: jointIds.size,
    mappedCoreJointCount: Object.keys(profile.coreJointMap ?? {}).length,
    availableDeformJointCount: Object.keys(profile.deformJointMap ?? {})
      .filter((jointId) => jointIds.has(jointId)).length,
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
