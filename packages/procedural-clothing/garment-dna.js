import {
  FIT_MODES,
  FIT_MODE_EASE,
  GARMENT_SCHEMA,
  GARMENT_TYPES,
} from './constants.js';
import {
  assertRange,
  canonicalStringify,
  hashString32,
  hex32,
} from './math.js';
import { createMaterialDNA, validateMaterialDNA } from './material-dna.js';

export function createStandardCrewShirtDNA(options = {}) {
  const fitMode = options.fitMode ?? FIT_MODES.REGULAR;
  if (!Object.values(FIT_MODES).includes(fitMode)) {
    throw new RangeError(`Unsupported fitMode: ${fitMode}`);
  }
  const baseEase = FIT_MODE_EASE[fitMode];
  const materialDNA = options.materialDNA ?? createMaterialDNA('cotton_jersey');

  const garment = {
    schema: GARMENT_SCHEMA,
    garmentId: String(options.garmentId ?? 'standard_crew_shirt_v1'),
    revision: Number.isInteger(options.revision) ? options.revision : 1,
    garmentType: GARMENT_TYPES.CREW_SHIRT,
    fitMode,
    units: 'meter',
    coordinateSystem: {
      handedness: 'right',
      upAxis: 'Y',
      forwardAxis: 'Z',
    },
    pattern: {
      bodyLengthRatio: options.bodyLengthRatio ?? 0.315,
      sleeveLengthRatio: options.sleeveLengthRatio ?? 0.145,
      necklineWidthRatio: options.necklineWidthRatio ?? 0.245,
      frontNeckDropRatio: options.frontNeckDropRatio ?? 0.055,
      backNeckDropRatio: options.backNeckDropRatio ?? 0.018,
      shoulderDropRatio: options.shoulderDropRatio ?? 0.018,
      hemShape: options.hemShape ?? 'straight',
      sleevePitchRadians: options.sleevePitchRadians ?? -0.16,
    },
    ease: {
      chest: options.chestEase ?? baseEase.chest,
      waist: options.waistEase ?? baseEase.waist,
      hem: options.hemEase ?? baseEase.hem,
      upperArm: options.upperArmEase ?? baseEase.upperArm,
      surfaceClearance: options.surfaceClearance ?? 0.0045,
    },
    topology: {
      torsoCircumferenceSegments: options.torsoCircumferenceSegments ?? 40,
      torsoLengthSegments: options.torsoLengthSegments ?? 24,
      sleeveCircumferenceSegments: options.sleeveCircumferenceSegments ?? 18,
      sleeveLengthSegments: options.sleeveLengthSegments ?? 10,
      collarSegments: options.collarSegments ?? 36,
      collarRadialSegments: options.collarRadialSegments ?? 2,
    },
    construction: {
      seamAllowance: options.seamAllowance ?? 0.008,
      collarBandWidth: options.collarBandWidth ?? 0.018,
      hemAllowance: options.hemAllowance ?? 0.022,
      sleeveHemAllowance: options.sleeveHemAllowance ?? 0.016,
      grainDirection: options.grainDirection ?? [0, 1],
    },
    adaptation: {
      preserveTopologyAcrossBodies: true,
      regenerateFromMeasurements: true,
      allowWholeGarmentScale: false,
      bodyRevisionRequired: true,
      collisionSource: 'body_surface_sampler_or_sdf',
      finalPoseAuthority: 'simulationRig',
    },
    materialDNA,
  };

  validateGarmentDNA(garment);
  const withoutHash = { ...garment };
  delete withoutHash.contentHash;
  garment.contentHash = `fnv1a32:${hex32(hashString32(canonicalStringify(withoutHash)))}`;
  return garment;
}

export function validateGarmentDNA(garment) {
  if (!garment || typeof garment !== 'object') throw new TypeError('garment must be an object');
  if (garment.schema !== GARMENT_SCHEMA) throw new RangeError(`Unsupported garment schema: ${garment.schema}`);
  if (!Object.values(GARMENT_TYPES).includes(garment.garmentType)) {
    throw new RangeError(`Unsupported garmentType: ${garment.garmentType}`);
  }
  if (!Object.values(FIT_MODES).includes(garment.fitMode)) {
    throw new RangeError(`Unsupported fitMode: ${garment.fitMode}`);
  }
  const pattern = garment.pattern ?? {};
  assertRange(pattern.bodyLengthRatio, 0.18, 0.65, 'pattern.bodyLengthRatio');
  assertRange(pattern.sleeveLengthRatio, 0.04, 0.55, 'pattern.sleeveLengthRatio');
  assertRange(pattern.necklineWidthRatio, 0.10, 0.55, 'pattern.necklineWidthRatio');
  assertRange(pattern.frontNeckDropRatio, 0.005, 0.25, 'pattern.frontNeckDropRatio');
  assertRange(pattern.backNeckDropRatio, 0.002, 0.12, 'pattern.backNeckDropRatio');
  assertRange(pattern.shoulderDropRatio, 0, 0.08, 'pattern.shoulderDropRatio');
  assertRange(pattern.sleevePitchRadians, -1.2, 0.45, 'pattern.sleevePitchRadians');

  const ease = garment.ease ?? {};
  assertRange(ease.chest, -0.08, 0.5, 'ease.chest');
  assertRange(ease.waist, -0.08, 0.6, 'ease.waist');
  assertRange(ease.hem, -0.08, 0.7, 'ease.hem');
  assertRange(ease.upperArm, -0.05, 0.4, 'ease.upperArm');
  assertRange(ease.surfaceClearance, 0.0005, 0.05, 'ease.surfaceClearance');

  const topology = garment.topology ?? {};
  assertRange(topology.torsoCircumferenceSegments, 12, 256, 'topology.torsoCircumferenceSegments');
  assertRange(topology.torsoLengthSegments, 6, 256, 'topology.torsoLengthSegments');
  assertRange(topology.sleeveCircumferenceSegments, 8, 128, 'topology.sleeveCircumferenceSegments');
  assertRange(topology.sleeveLengthSegments, 2, 128, 'topology.sleeveLengthSegments');
  assertRange(topology.collarSegments, 12, 256, 'topology.collarSegments');
  assertRange(topology.collarRadialSegments, 1, 8, 'topology.collarRadialSegments');

  const construction = garment.construction ?? {};
  assertRange(construction.seamAllowance, 0, 0.05, 'construction.seamAllowance');
  assertRange(construction.collarBandWidth, 0.003, 0.08, 'construction.collarBandWidth');
  assertRange(construction.hemAllowance, 0, 0.08, 'construction.hemAllowance');
  assertRange(construction.sleeveHemAllowance, 0, 0.08, 'construction.sleeveHemAllowance');
  if (!Array.isArray(construction.grainDirection) || construction.grainDirection.length !== 2) {
    throw new TypeError('construction.grainDirection must contain two values');
  }
  validateMaterialDNA(garment.materialDNA);
  return true;
}
