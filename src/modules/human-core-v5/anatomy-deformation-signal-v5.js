import { assertNoForbiddenKeys, cloneValue, finiteNumber } from './core-utils.js';

export const ANATOMY_DEFORMATION_SIGNAL_V5_SCHEMA = 'humanoid_rig/anatomy_deformation_signal@5.0';
export const ANATOMY_DEFORMATION_SIGNAL_V5_SCHEMA_VERSION = 5;

const SIGNAL_FORBIDDEN_KEYS = new Set([
  'mesh', 'meshReference', 'glb', 'glbReference', 'texture', 'textureReference',
  'vertices', 'indices', 'skinWeights', 'inverseBindMatrices',
]);

/**
 * Renderer-neutral signals for a future procedural deform adapter.  These
 * values are intentionally not applied to a mesh in V5 Anatomy phase two.
 */
export function createAnatomyDeformationSignalV5(input = {}) {
  assertNoForbiddenKeys(input, SIGNAL_FORBIDDEN_KEYS, 'AnatomyDeformationSignal V5');
  const source = input && typeof input === 'object' ? input : {};
  const signal = {
    schema: ANATOMY_DEFORMATION_SIGNAL_V5_SCHEMA,
    schemaVersion: ANATOMY_DEFORMATION_SIGNAL_V5_SCHEMA_VERSION,
    type: 'AnatomyDeformationSignal',
    humanId: String(source.humanId ?? 'human-reference-001'),
    bodyDNAId: String(source.bodyDNAId ?? 'body-dna-human-reference-001'),
    proportionRevision: Math.max(0, Math.floor(Number(source.proportionRevision) || 0)),
    shoulderElevation: unit(source.shoulderElevation),
    chestExpansion: unit(source.chestExpansion),
    abdominalCompression: unit(source.abdominalCompression),
    elbowCompression: unit(source.elbowCompression),
    thighCompression: unit(source.thighCompression),
    armVolume: unit(source.armVolume),
    legVolume: unit(source.legVolume),
    regions: normalizeRegions(source.regions),
    application: {
      mode: 'signal-only',
      writesMesh: false,
      writesSkinWeights: false,
      sourcePoseAuthority: String(source.sourcePoseAuthority ?? 'local-quaternion-v4'),
    },
  };
  assertAnatomyDeformationSignalV5(signal);
  return signal;
}

export function validateAnatomyDeformationSignalV5(value) {
  const errors = [];
  if (!value || value.schema !== ANATOMY_DEFORMATION_SIGNAL_V5_SCHEMA || value.type !== 'AnatomyDeformationSignal') {
    errors.push(`schema must be ${ANATOMY_DEFORMATION_SIGNAL_V5_SCHEMA} and type must be AnatomyDeformationSignal.`);
    return { valid: false, errors };
  }
  if (value.schemaVersion !== ANATOMY_DEFORMATION_SIGNAL_V5_SCHEMA_VERSION) errors.push('schemaVersion must be 5.');
  for (const key of ['shoulderElevation', 'chestExpansion', 'abdominalCompression', 'elbowCompression', 'thighCompression', 'armVolume', 'legVolume']) {
    if (!Number.isFinite(Number(value[key])) || Number(value[key]) < 0 || Number(value[key]) > 1) errors.push(`${key} must be normalized to [0, 1].`);
  }
  if (value.application?.writesMesh !== false || value.application?.writesSkinWeights !== false) {
    errors.push('AnatomyDeformationSignal must remain signal-only.');
  }
  return { valid: errors.length === 0, errors };
}

export function assertAnatomyDeformationSignalV5(value) {
  const validation = validateAnatomyDeformationSignalV5(value);
  if (!validation.valid) throw new Error(`Invalid AnatomyDeformationSignal V5: ${validation.errors.join(' ')}`);
  return value;
}

export function cloneAnatomyDeformationSignalV5(value) {
  assertAnatomyDeformationSignalV5(value);
  return cloneValue(value);
}

function normalizeRegions(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    shoulder: unit(source.shoulder),
    chest: unit(source.chest),
    abdomen: unit(source.abdomen),
    arm: unit(source.arm),
    thigh: unit(source.thigh),
    calf: unit(source.calf),
  };
}

function unit(value) {
  return finiteNumber(value, 0, 0, 1);
}
