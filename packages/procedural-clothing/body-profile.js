import { CANONICAL_GARMENT_JOINTS } from './constants.js';
import { assertRange, canonicalStringify, hashString32, hex32 } from './math.js';

const DEFAULT_HEIGHT = 1.75;

function optionalMeasurement(source, keys, fallback) {
  for (const key of keys) {
    const value = source?.[key];
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

/**
 * Converts project ProportionProfile-like data into the compact, read-only
 * measurement interface used by the garment compiler.
 */
export function normalizeBodyProfile(input = {}) {
  const measurements = input.measurements ?? input;
  const bodyHeight = optionalMeasurement(
    measurements,
    ['body_height', 'bodyHeight', 'height'],
    DEFAULT_HEIGHT,
  );

  assertRange(bodyHeight, 0.75, 2.8, 'bodyHeight');

  const shoulderWidth = optionalMeasurement(
    measurements,
    ['shoulder_width', 'shoulderWidth'],
    bodyHeight * 0.242,
  );
  const chestCircumference = optionalMeasurement(
    measurements,
    ['chest_circumference', 'chestCircumference', 'chest_girth'],
    bodyHeight * 0.54,
  );
  const waistCircumference = optionalMeasurement(
    measurements,
    ['waist_circumference', 'waistCircumference', 'waist_girth'],
    bodyHeight * 0.46,
  );
  const hipCircumference = optionalMeasurement(
    measurements,
    ['hip_circumference', 'hipCircumference', 'hip_girth'],
    bodyHeight * 0.535,
  );
  const neckCircumference = optionalMeasurement(
    measurements,
    ['neck_circumference', 'neckCircumference'],
    bodyHeight * 0.205,
  );
  const upperArmCircumference = optionalMeasurement(
    measurements,
    ['upper_arm_circumference', 'upperArmCircumference'],
    bodyHeight * 0.17,
  );
  const torsoLength = optionalMeasurement(
    measurements,
    ['torso_length', 'torsoLength'],
    bodyHeight * 0.285,
  );
  const armLength = optionalMeasurement(
    measurements,
    ['arm_length', 'armLength'],
    bodyHeight * 0.335,
  );
  const chestDepth = optionalMeasurement(
    measurements,
    ['chest_depth', 'chestDepth'],
    chestCircumference / Math.PI * 0.39,
  );
  const waistDepth = optionalMeasurement(
    measurements,
    ['waist_depth', 'waistDepth'],
    waistCircumference / Math.PI * 0.37,
  );

  assertRange(shoulderWidth, bodyHeight * 0.14, bodyHeight * 0.38, 'shoulderWidth');
  assertRange(chestCircumference, bodyHeight * 0.30, bodyHeight * 0.95, 'chestCircumference');
  assertRange(waistCircumference, bodyHeight * 0.25, bodyHeight * 0.90, 'waistCircumference');
  assertRange(hipCircumference, bodyHeight * 0.30, bodyHeight * 1.0, 'hipCircumference');
  assertRange(neckCircumference, bodyHeight * 0.10, bodyHeight * 0.35, 'neckCircumference');
  assertRange(upperArmCircumference, bodyHeight * 0.08, bodyHeight * 0.35, 'upperArmCircumference');
  assertRange(torsoLength, bodyHeight * 0.18, bodyHeight * 0.46, 'torsoLength');
  assertRange(armLength, bodyHeight * 0.20, bodyHeight * 0.50, 'armLength');
  assertRange(chestDepth, bodyHeight * 0.07, bodyHeight * 0.28, 'chestDepth');
  assertRange(waistDepth, bodyHeight * 0.06, bodyHeight * 0.25, 'waistDepth');

  const shoulderY = optionalMeasurement(
    measurements,
    ['shoulder_y', 'shoulderY'],
    bodyHeight * 0.815,
  );
  const underarmY = optionalMeasurement(
    measurements,
    ['underarm_y', 'underarmY'],
    shoulderY - bodyHeight * 0.105,
  );
  const waistY = optionalMeasurement(
    measurements,
    ['waist_y', 'waistY'],
    bodyHeight * 0.59,
  );
  const pelvisY = optionalMeasurement(
    measurements,
    ['pelvis_y', 'pelvisY'],
    bodyHeight * 0.53,
  );

  const proportionRevision = Number.isInteger(input.proportion_revision)
    ? input.proportion_revision
    : Number.isInteger(input.proportionRevision)
      ? input.proportionRevision
      : 0;

  const subjectId = String(input.subject_id ?? input.subjectId ?? 'anonymous_subject');
  const jointTable = Array.isArray(input.joint_table)
    ? input.joint_table.map(String)
    : Array.isArray(input.jointTable)
      ? input.jointTable.map(String)
      : [...CANONICAL_GARMENT_JOINTS];

  const profile = {
    schema: 'humanoid_rig/garment_body_profile@1.0',
    subjectId,
    proportionRevision,
    units: 'meter',
    coordinateSystem: {
      handedness: 'right',
      upAxis: 'Y',
      forwardAxis: 'Z',
    },
    measurements: {
      bodyHeight,
      shoulderWidth,
      chestCircumference,
      waistCircumference,
      hipCircumference,
      neckCircumference,
      upperArmCircumference,
      torsoLength,
      armLength,
      chestDepth,
      waistDepth,
      shoulderY,
      underarmY,
      waistY,
      pelvisY,
    },
    jointTable,
  };

  profile.contentHash = `fnv1a32:${hex32(hashString32(canonicalStringify(profile)))}`;
  return profile;
}

export function bodyProfileFromProportionProfile(proportionProfile) {
  if (!proportionProfile || typeof proportionProfile !== 'object') {
    throw new TypeError('proportionProfile must be an object');
  }
  return normalizeBodyProfile(proportionProfile);
}
