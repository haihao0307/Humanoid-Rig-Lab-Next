import {
  assertBodyDNAV5,
  createBodyDNA,
} from './body-dna-v5.js';
import {
  cloneValue,
  finiteNumber,
} from './core-utils.js';

export const MASS_DISTRIBUTION_MODEL_V5_SCHEMA = 'humanoid_rig/mass_distribution_model@5.0';
export const MASS_DISTRIBUTION_MODEL_V5_SCHEMA_VERSION = 5;

/**
 * Anthropometric mass estimate derived from BodyDNA.  This is a semantic
 * state model rather than a physics body or a mesh-derived calculation.
 * Coordinates are expressed relative to the character root, never as world
 * positions, so callers cannot accidentally use it as a second pose system.
 */
export function createMassDistributionModelV5(bodyDNAInput = {}) {
  const bodyDNA = createBodyDNA(bodyDNAInput);
  assertBodyDNAV5(bodyDNA);

  const totalMassKg = finiteNumber(bodyDNA.mass.weightKg, 75, 1, 300);
  const headFraction = clamp(
    0.078 * (7.5 / bodyDNA.proportion.headToBodyRatio) * (1 - bodyDNA.fitnessProfile.muscle * 0.03),
    0.055,
    0.105,
  );
  const remainingFraction = 1 - headFraction;
  const torsoFraction = remainingFraction * bodyDNA.mass.distribution.torso;
  const upperLimbFraction = remainingFraction * bodyDNA.mass.distribution.upperLimbs;
  const lowerLimbFraction = remainingFraction * bodyDNA.mass.distribution.lowerLimbs;
  const headMass = totalMassKg * headFraction;
  const torsoMass = totalMassKg * torsoFraction;
  const armTotal = totalMassKg * upperLimbFraction;
  const legTotal = totalMassKg * lowerLimbFraction;

  const model = {
    schema: MASS_DISTRIBUTION_MODEL_V5_SCHEMA,
    schemaVersion: MASS_DISTRIBUTION_MODEL_V5_SCHEMA_VERSION,
    type: 'MassDistributionModel',
    humanId: bodyDNA.identity.humanId,
    bodyDNAId: bodyDNA.bodyDNAId,
    proportionRevision: bodyDNA.proportionRevision,
    totalMassKg,
    headMass,
    torsoMass,
    armMass: {
      total: armTotal,
      left: armTotal / 2,
      right: armTotal / 2,
    },
    legMass: {
      total: legTotal,
      left: legTotal / 2,
      right: legTotal / 2,
    },
    centerOfMass: {
      position: calculateNeutralCenterOfMass(bodyDNA, { headMass, torsoMass, armTotal, legTotal }),
      space: 'character-root-local',
      provenance: 'body-dna-anthropometric-estimate-v5',
    },
    bodyMeasurements: {
      height: bodyDNA.proportion.height,
      shoulderWidth: bodyDNA.proportion.shoulderWidth,
      hipWidth: bodyDNA.proportion.hipWidth,
      chestThickness: bodyDNA.proportion.bodyThickness.chest,
      waistThickness: bodyDNA.proportion.bodyThickness.waist,
      hipThickness: bodyDNA.proportion.bodyThickness.hip,
    },
    assumptions: {
      mode: 'semantic-anthropometric-v5',
      usesWorldPositions: false,
      solverOwned: false,
      leftRightMassSplit: 'symmetric-until-authored-mass-data-exists',
    },
  };
  assertMassDistributionModelV5(model);
  return model;
}

export function validateMassDistributionModelV5(value) {
  const errors = [];
  if (!value || value.schema !== MASS_DISTRIBUTION_MODEL_V5_SCHEMA || value.type !== 'MassDistributionModel') {
    errors.push(`schema must be ${MASS_DISTRIBUTION_MODEL_V5_SCHEMA} and type must be MassDistributionModel.`);
    return { valid: false, errors };
  }
  if (value.schemaVersion !== MASS_DISTRIBUTION_MODEL_V5_SCHEMA_VERSION) errors.push('schemaVersion must be 5.');
  for (const key of ['humanId', 'bodyDNAId']) {
    if (!stableId(value[key])) errors.push(`${key} must be a stable identifier.`);
  }
  for (const key of ['totalMassKg', 'headMass', 'torsoMass']) {
    if (!Number.isFinite(Number(value[key])) || Number(value[key]) <= 0) errors.push(`${key} must be positive.`);
  }
  for (const side of ['left', 'right']) {
    if (!Number.isFinite(Number(value.armMass?.[side])) || Number(value.armMass[side]) <= 0) errors.push(`armMass.${side} must be positive.`);
    if (!Number.isFinite(Number(value.legMass?.[side])) || Number(value.legMass[side]) <= 0) errors.push(`legMass.${side} must be positive.`);
  }
  const partition = Number(value.headMass) + Number(value.torsoMass)
    + Number(value.armMass?.total) + Number(value.legMass?.total);
  if (!Number.isFinite(partition) || Math.abs(partition - Number(value.totalMassKg)) > 1e-6) {
    errors.push('headMass, torsoMass, armMass, and legMass must sum to totalMassKg.');
  }
  if (!Array.isArray(value.centerOfMass?.position) || value.centerOfMass.position.length !== 3
    || value.centerOfMass.position.some((item) => !Number.isFinite(Number(item)))) {
    errors.push('centerOfMass.position must be a finite vector3.');
  }
  if (value.centerOfMass?.space !== 'character-root-local') errors.push('centerOfMass must remain character-root-local.');
  if (value.assumptions?.usesWorldPositions !== false) errors.push('MassDistributionModel must not own world positions.');
  return { valid: errors.length === 0, errors };
}

export function assertMassDistributionModelV5(value) {
  const validation = validateMassDistributionModelV5(value);
  if (!validation.valid) throw new Error(`Invalid MassDistributionModel V5: ${validation.errors.join(' ')}`);
  return value;
}

export function cloneMassDistributionModelV5(value) {
  assertMassDistributionModelV5(value);
  return cloneValue(value);
}

function calculateNeutralCenterOfMass(bodyDNA, masses) {
  const height = bodyDNA.proportion.height;
  const weightedY = (
    masses.headMass * height * 0.925
    + masses.torsoMass * height * 0.555
    + masses.armTotal * height * 0.565
    + masses.legTotal * height * 0.255
  ) / bodyDNA.mass.weightKg;
  const forwardBias = clamp(
    (bodyDNA.proportion.bodyThickness.chest - bodyDNA.proportion.bodyThickness.hip) * 0.08
      + (bodyDNA.mass.distribution.torso - 0.5) * 0.03,
    -0.06,
    0.06,
  );
  return [0, weightedY, forwardBias];
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function stableId(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9._-]*$/.test(value);
}
