export const HRL_REGIONAL_DEFORMATION_PROFILE_V1_SCHEMA = 'humanoid_rig/regional_deformation_profile@1.0';

export const REGIONAL_DEFORMATION_REGION_IDS_V1 = Object.freeze({
  unaffected: 0,
  spineTorso: 1,
  pelvisHipGroin: 2,
  leftElbow: 3,
  rightElbow: 4,
  leftKnee: 5,
  rightKnee: 6,
});

export const SPINE_LATTICE_RING_DEFINITIONS_V1 = Object.freeze([
  { id: 'pelvis-ring', boneId: 'pelvis' },
  { id: 'lower-spine-ring', boneId: 'spineLower' },
  { id: 'waist-ring', boneId: 'spineMiddle' },
  { id: 'lower-chest-ring', boneId: 'spineUpper' },
  { id: 'upper-chest-ring', boneId: 'chest' },
  { id: 'neck-base-ring', boneId: 'neck' },
]);

export const LATTICE_CIRCUMFERENCE_DIRECTIONS_V1 = Object.freeze([
  { id: 'front', angle: Math.PI / 2 },
  { id: 'front-left', angle: Math.PI * 3 / 4 },
  { id: 'left', angle: Math.PI },
  { id: 'back-left', angle: Math.PI * 5 / 4 },
  { id: 'back', angle: Math.PI * 3 / 2 },
  { id: 'back-right', angle: Math.PI * 7 / 4 },
  { id: 'right', angle: 0 },
  { id: 'front-right', angle: Math.PI / 4 },
]);

export const PELVIS_HIP_GROIN_LATTICE_SECTIONS_V1 = Object.freeze([
  { id: 'pelvis-upper-ring', driverIds: ['pelvis'] },
  { id: 'pelvis-lower-ring', driverIds: ['pelvis'] },
  { id: 'left-hip-root-ring', driverIds: ['pelvis', 'leftUpperLeg'] },
  { id: 'right-hip-root-ring', driverIds: ['pelvis', 'rightUpperLeg'] },
  { id: 'left-upper-thigh-proximal-ring', driverIds: ['leftUpperLeg', 'leftThighTwist01', 'leftThighTwist02'] },
  { id: 'right-upper-thigh-proximal-ring', driverIds: ['rightUpperLeg', 'rightThighTwist01', 'rightThighTwist02'] },
  { id: 'groin-front-bridge', driverIds: ['pelvis', 'leftUpperLeg', 'rightUpperLeg'] },
  { id: 'groin-back-bridge', driverIds: ['pelvis', 'leftUpperLeg', 'rightUpperLeg'] },
  { id: 'left-gluteal-control-band', driverIds: ['pelvis', 'leftUpperLeg'] },
  { id: 'right-gluteal-control-band', driverIds: ['pelvis', 'rightUpperLeg'] },
]);

export const ELBOW_CORRECTIVE_CURVE_V1 = Object.freeze([
  { degrees: 0, weight: 0 }, { degrees: 45, weight: 0.30 }, { degrees: 90, weight: 0.68 }, { degrees: 120, weight: 0.90 }, { degrees: 135, weight: 1 },
]);
export const KNEE_CORRECTIVE_CURVE_V1 = Object.freeze([
  { degrees: 0, weight: 0 }, { degrees: 45, weight: 0.28 }, { degrees: 90, weight: 0.66 }, { degrees: 120, weight: 0.91 }, { degrees: 135, weight: 1 },
]);

export function createRegionalDeformationProfileV1(overrides = {}) {
  const profile = {
    schema: HRL_REGIONAL_DEFORMATION_PROFILE_V1_SCHEMA,
    profileId: 'HRLRegionalDeformationLayerV1',
    revision: 1,
    authorityChain: ['BodyDNA', 'HumanRigCore', 'finalPose.localRotations', 'PerformanceDeformRig', 'BaseHybridSkinning', 'HRLRegionalDeformationLayerV1', 'HRLFullBilateralSurfaceV1', 'Renderer'],
    spine: { blendStrength: 0.82, radialPreservation: 0.94, longitudinalFeather: 0.045, latticeRings: SPINE_LATTICE_RING_DEFINITIONS_V1 },
    pelvisHipGroin: { blendStrength: 0.92, bridgePelvisBias: 0.88, thighRootFollow: 0.78, glutealStretch: 0.035, latticeSections: PELVIS_HIP_GROIN_LATTICE_SECTIONS_V1 },
    elbow: { curve: ELBOW_CORRECTIVE_CURVE_V1, compressionScale: 0.945, extensionBulge: 0.022, supportRadius: 0.115 },
    knee: { curve: KNEE_CORRECTIVE_CURVE_V1, compressionScale: 0.94, patellaBulge: 0.018, supportRadius: 0.145 },
    orientationBarrier: { minimumAreaRatio: 0.08, maximumIterations: 5, correctionBlend: 0.52, oneRingBlend: 0.18 },
    collisionBarrier: { maximumIterations: 5, correctionBlend: 0.55, oneRingBlend: 0.16, maximumSingleIterationCorrection: 0.018, cellSize: 0.025, epsilon: 1e-8 },
    allowedSecondRoundFields: ['region blend weight', 'lattice control distribution', 'corrective curve', 'barrier stiffness', 'intentional contact classification'],
    externalCageUsed: false,
    externalWeightsUsed: false,
    topologyRegenerated: false,
    visibleLattice: false,
  };
  return deepMerge(profile, overrides);
}

export function sampleCorrectiveCurveV1(curve, degrees) {
  const value = Math.max(0, Math.abs(Number(degrees) || 0));
  if (value <= curve[0].degrees) return curve[0].weight;
  for (let index = 1; index < curve.length; index += 1) {
    const left = curve[index - 1]; const right = curve[index];
    if (value <= right.degrees) { const t = smoothstep((value - left.degrees) / Math.max(1e-9, right.degrees - left.degrees)); return left.weight * (1 - t) + right.weight * t; }
  }
  return curve[curve.length - 1].weight;
}

function smoothstep(value) { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); }
function deepMerge(base, overrides) { const output = { ...base }; for (const [key, value] of Object.entries(overrides || {})) output[key] = value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' ? deepMerge(base[key], value) : value; return output; }
