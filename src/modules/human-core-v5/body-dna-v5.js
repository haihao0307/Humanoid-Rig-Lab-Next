import {
  REFERENCE_BODY_PROFILE,
  normalizeBodyProfile,
} from '../../../legacy/v8/src/body-profile.js';
import {
  assertNoForbiddenKeys,
  cloneValue,
  finiteNumber,
  normalizeId,
  normalizeRevision,
  stableFingerprint,
} from './core-utils.js';

export const BODY_DNA_V5_SCHEMA = 'humanoid_rig/body_dna@5.0';
export const BODY_DNA_V5_SCHEMA_VERSION = 5;

const BODY_DNA_FORBIDDEN_KEYS = new Set([
  'mesh',
  'meshReference',
  'glb',
  'glbReference',
  'vertices',
  'indices',
  'skinWeights',
  'joints',
  'bones',
  'tracks',
  'animation',
  'animations',
  'animationFile',
  'inverseBindMatrices',
]);

const DEFAULT_MASS_DISTRIBUTION = Object.freeze({
  torso: 0.50,
  upperLimbs: 0.15,
  lowerLimbs: 0.35,
});

const DEFAULT_ASYMMETRY = Object.freeze({
  mode: 'symmetric',
  leftRightScale: {
    shoulder: 1,
    arm: 1,
    hand: 1,
    hip: 1,
    leg: 1,
    foot: 1,
  },
});

/**
 * Creates the non-rendering anthropometric identity used by Human Core V5.
 * It intentionally contains no mesh, GLB, bind hierarchy, or animation data.
 */
export function createBodyDNA(input = {}) {
  assertNoForbiddenKeys(input, BODY_DNA_FORBIDDEN_KEYS, 'BodyDNA V5');
  const source = input && typeof input === 'object' ? input : {};
  const profile = normalizeExistingProportion(source);
  const identity = normalizeIdentity(source.identity, source);
  const proportionRevision = normalizeRevision(
    source.proportionRevision ?? source.proportion_revision ?? source.revision,
  );
  const bodyDNA = {
    schema: BODY_DNA_V5_SCHEMA,
    schemaVersion: BODY_DNA_V5_SCHEMA_VERSION,
    type: 'BodyDNA',
    bodyDNAId: normalizeId(source.bodyDNAId ?? source.id, `body-dna-${identity.humanId}`),
    identity,
    topologyFamily: String(source.topologyFamily ?? 'humanoid-core-v5'),
    proportion: {
      preset: String(profile.preset ?? 'custom'),
      height: profile.height,
      shoulderWidth: profile.shoulderWidth,
      hipWidth: profile.hipWidth,
      headToBodyRatio: finiteNumber(source.proportion?.headToBodyRatio ?? source.headToBodyRatio, 7.5, 4.5, 10),
      limbLengths: {
        upperArm: profile.upperArmLength,
        forearm: profile.forearmLength,
        handControl: profile.handControlLength,
        thigh: profile.thighLength,
        lowerLeg: profile.lowerLegLength,
      },
      bodyThickness: normalizeBodyThickness(source.proportion?.bodyThickness ?? source.bodyThickness),
    },
    mass: {
      weightKg: finiteNumber(source.mass?.weightKg ?? source.weightKg, 75, 25, 300),
      distribution: normalizeMassDistribution(source.mass?.distribution ?? source.massDistribution),
    },
    bodyType: normalizeBodyType(source.bodyType),
    asymmetry: normalizeAsymmetry(source.asymmetry),
    ageProfile: normalizeAgeProfile(source.ageProfile),
    genderProfile: normalizeGenderProfile(source.genderProfile),
    fitnessProfile: normalizeFitnessProfile(source.fitnessProfile),
    proportionRevision,
  };
  assertBodyDNAV5(bodyDNA);
  return bodyDNA;
}

export function normalizeBodyDNA(input = {}) {
  return createBodyDNA(input);
}

export function isBodyDNAV5(value) {
  return Boolean(value && value.schema === BODY_DNA_V5_SCHEMA && value.type === 'BodyDNA');
}

export function validateBodyDNAV5(value) {
  const errors = [];
  if (!isBodyDNAV5(value)) {
    errors.push(`schema must be ${BODY_DNA_V5_SCHEMA} and type must be BodyDNA.`);
    return { valid: false, errors };
  }
  if (value.schemaVersion !== BODY_DNA_V5_SCHEMA_VERSION) errors.push('schemaVersion must be 5.');
  if (!validId(value.bodyDNAId)) errors.push('bodyDNAId must be a stable identifier.');
  if (!validId(value.identity?.humanId)) errors.push('identity.humanId must be a stable identifier.');
  if (!Number.isInteger(value.proportionRevision) || value.proportionRevision < 0) {
    errors.push('proportionRevision must be a non-negative integer.');
  }
  const profile = value.proportion;
  if (!profile || typeof profile !== 'object') {
    errors.push('proportion is required.');
  } else {
    for (const key of ['height', 'shoulderWidth', 'hipWidth', 'headToBodyRatio']) {
      if (!Number.isFinite(Number(profile[key]))) errors.push(`proportion.${key} must be finite.`);
    }
    for (const key of ['upperArm', 'forearm', 'handControl', 'thigh', 'lowerLeg']) {
      if (!Number.isFinite(Number(profile.limbLengths?.[key])) || Number(profile.limbLengths[key]) <= 0) {
        errors.push(`proportion.limbLengths.${key} must be positive.`);
      }
    }
    for (const key of ['chest', 'waist', 'hip']) {
      if (!Number.isFinite(Number(profile.bodyThickness?.[key])) || Number(profile.bodyThickness[key]) <= 0) {
        errors.push(`proportion.bodyThickness.${key} must be positive.`);
      }
    }
  }
  if (!Number.isFinite(Number(value.mass?.weightKg)) || Number(value.mass?.weightKg) <= 0) {
    errors.push('mass.weightKg must be positive.');
  }
  const distribution = value.mass?.distribution;
  if (!distribution || ['torso', 'upperLimbs', 'lowerLimbs'].some((key) => !Number.isFinite(Number(distribution[key])))) {
    errors.push('mass.distribution must contain torso, upperLimbs, and lowerLimbs.');
  }
  if (!value.bodyType || typeof value.bodyType !== 'object') errors.push('bodyType is required.');
  if (!value.asymmetry || typeof value.asymmetry !== 'object') errors.push('asymmetry is required.');
  if (!value.ageProfile || typeof value.ageProfile !== 'object') errors.push('ageProfile is required.');
  if (!value.genderProfile || typeof value.genderProfile !== 'object') errors.push('genderProfile is required.');
  if (!value.fitnessProfile || typeof value.fitnessProfile !== 'object') errors.push('fitnessProfile is required.');
  try {
    assertNoForbiddenKeys(value, BODY_DNA_FORBIDDEN_KEYS, 'BodyDNA V5');
  } catch (error) {
    errors.push(error.message);
  }
  return { valid: errors.length === 0, errors };
}

export function assertBodyDNAV5(value) {
  const validation = validateBodyDNAV5(value);
  if (!validation.valid) throw new Error(`Invalid BodyDNA V5: ${validation.errors.join(' ')}`);
  return value;
}

export function cloneBodyDNAV5(value) {
  assertBodyDNAV5(value);
  return cloneValue(value);
}

/**
 * Converts V5 anthropometry into the existing V4 BodyProfile shape. The V4
 * profile remains the only binding-dimension input; its draftRevision mirrors
 * the V5 proportionRevision without replacing project-level revisions.
 */
export function bodyDNAToProportionProfile(bodyDNAInput) {
  const bodyDNA = createBodyDNA(bodyDNAInput);
  return normalizeBodyProfile({
    preset: bodyDNA.proportion.preset,
    height: bodyDNA.proportion.height,
    shoulderWidth: bodyDNA.proportion.shoulderWidth,
    hipWidth: bodyDNA.proportion.hipWidth,
    upperArmLength: bodyDNA.proportion.limbLengths.upperArm,
    forearmLength: bodyDNA.proportion.limbLengths.forearm,
    handControlLength: bodyDNA.proportion.limbLengths.handControl,
    thighLength: bodyDNA.proportion.limbLengths.thigh,
    lowerLegLength: bodyDNA.proportion.limbLengths.lowerLeg,
    draftRevision: Math.max(1, bodyDNA.proportionRevision),
  });
}

export function proportionProfileToBodyDNA(profile, options = {}) {
  const profileRevision = options.proportionRevision
    ?? options.proportion_revision
    ?? profile?.proportionRevision
    ?? profile?.proportion_revision
    ?? Math.max(0, Number(profile?.draftRevision || 1) - 1);
  return createBodyDNA({
    ...cloneValue(options),
    proportionProfile: profile,
    proportionRevision: profileRevision,
  });
}

export function bodyDNAFingerprint(bodyDNAInput) {
  const bodyDNA = createBodyDNA(bodyDNAInput);
  return stableFingerprint({
    topologyFamily: bodyDNA.topologyFamily,
    proportion: bodyDNA.proportion,
    mass: bodyDNA.mass,
    bodyType: bodyDNA.bodyType,
    asymmetry: bodyDNA.asymmetry,
  });
}

function normalizeExistingProportion(source) {
  const proportion = source.proportion && typeof source.proportion === 'object' ? source.proportion : {};
  const existing = source.proportionProfile && typeof source.proportionProfile === 'object'
    ? source.proportionProfile
    : source;
  return normalizeBodyProfile({
    preset: proportion.preset ?? existing.preset ?? REFERENCE_BODY_PROFILE.preset,
    height: proportion.height ?? existing.height,
    shoulderWidth: proportion.shoulderWidth ?? existing.shoulderWidth,
    hipWidth: proportion.hipWidth ?? existing.hipWidth,
    upperArmLength: proportion.limbLengths?.upperArm ?? existing.upperArmLength,
    forearmLength: proportion.limbLengths?.forearm ?? existing.forearmLength,
    handControlLength: proportion.limbLengths?.handControl ?? existing.handControlLength,
    thighLength: proportion.limbLengths?.thigh ?? existing.thighLength,
    lowerLegLength: proportion.limbLengths?.lowerLeg ?? existing.lowerLegLength,
    draftRevision: existing.draftRevision,
  });
}

function normalizeIdentity(identity, source) {
  const input = identity && typeof identity === 'object' ? identity : {};
  const humanId = normalizeId(input.humanId ?? input.id ?? source.humanId ?? source.characterId, 'human-reference-001');
  return {
    humanId,
    characterId: input.characterId == null ? null : normalizeId(input.characterId, humanId),
    label: String(input.label ?? source.name ?? humanId),
  };
}

function normalizeBodyThickness(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    chest: finiteNumber(source.chest, 0.240, 0.08, 0.60),
    waist: finiteNumber(source.waist, 0.200, 0.06, 0.55),
    hip: finiteNumber(source.hip, 0.240, 0.08, 0.65),
  };
}

function normalizeMassDistribution(value) {
  const source = value && typeof value === 'object' ? value : DEFAULT_MASS_DISTRIBUTION;
  const raw = {
    torso: finiteNumber(source.torso, DEFAULT_MASS_DISTRIBUTION.torso, 0, 1),
    upperLimbs: finiteNumber(source.upperLimbs, DEFAULT_MASS_DISTRIBUTION.upperLimbs, 0, 1),
    lowerLimbs: finiteNumber(source.lowerLimbs, DEFAULT_MASS_DISTRIBUTION.lowerLimbs, 0, 1),
  };
  const total = raw.torso + raw.upperLimbs + raw.lowerLimbs;
  if (total < 1e-8) return cloneValue(DEFAULT_MASS_DISTRIBUTION);
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value / total]));
}

function normalizeBodyType(value) {
  const source = value && typeof value === 'object' ? value : {};
  const category = ['reference', 'ectomorph', 'mesomorph', 'endomorph', 'custom'].includes(source.category)
    ? source.category
    : 'reference';
  return {
    category,
    label: String(source.label ?? category),
    morphology: String(source.morphology ?? 'balanced'),
  };
}

function normalizeAsymmetry(value) {
  const source = value && typeof value === 'object' ? value : DEFAULT_ASYMMETRY;
  const scales = source.leftRightScale && typeof source.leftRightScale === 'object'
    ? source.leftRightScale
    : DEFAULT_ASYMMETRY.leftRightScale;
  return {
    mode: source.mode === 'authored' ? 'authored' : 'symmetric',
    leftRightScale: Object.fromEntries(Object.keys(DEFAULT_ASYMMETRY.leftRightScale).map((key) => [
      key,
      finiteNumber(scales[key], 1, 0.75, 1.25),
    ])),
  };
}

function normalizeAgeProfile(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    stage: String(source.stage ?? 'adult'),
    years: source.years == null ? null : finiteNumber(source.years, null, 0, 130),
  };
}

function normalizeGenderProfile(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    identity: String(source.identity ?? 'unspecified'),
    expression: source.expression == null ? null : String(source.expression),
  };
}

function normalizeFitnessProfile(value) {
  const source = value && typeof value === 'object' ? value : {};
  const distribution = source.distribution && typeof source.distribution === 'object' ? source.distribution : {};
  return {
    muscle: finiteNumber(source.muscle, 0.5, 0, 1),
    fat: finiteNumber(source.fat, 0.5, 0, 1),
    distribution: {
      upperBody: finiteNumber(distribution.upperBody, 0.5, 0, 1),
      lowerBody: finiteNumber(distribution.lowerBody, 0.5, 0, 1),
    },
  };
}

function validId(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9._-]*$/.test(value);
}
