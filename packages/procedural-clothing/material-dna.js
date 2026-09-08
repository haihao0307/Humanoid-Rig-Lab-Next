import { MATERIAL_FAMILIES, MATERIAL_SCHEMA } from './constants.js';
import {
  TAU,
  assertRange,
  canonicalStringify,
  clamp,
  hashString32,
  hex32,
  normalize3,
  saturate,
} from './math.js';

const PRESETS = Object.freeze({
  cotton_jersey: Object.freeze({
    id: 'cotton_jersey_v1',
    name: 'Cotton jersey',
    family: MATERIAL_FAMILIES.KNIT,
    mechanics: {
      thickness: 0.00085,
      arealDensity: 0.185,
      warpStretch: 0.075,
      weftStretch: 0.105,
      shearCompliance: 0.13,
      bendCompliance: 0.24,
      damping: 0.16,
      bodyFriction: 0.42,
      selfFriction: 0.34,
      airDrag: 0.022,
    },
    optics: {
      baseColorLinear: [0.13, 0.31, 0.56],
      roughness: 0.82,
      fiberSheen: 0.24,
      anisotropy: 0.10,
      opacity: 1,
    },
    microstructure: {
      repeatUPerMeter: 340,
      repeatVPerMeter: 510,
      amplitude: 0.055,
      phase: 0.37,
      skew: 0.08,
    },
  }),
  wool_twill: Object.freeze({
    id: 'wool_twill_v1',
    name: 'Wool twill',
    family: MATERIAL_FAMILIES.WOVEN,
    mechanics: {
      thickness: 0.00125,
      arealDensity: 0.285,
      warpStretch: 0.028,
      weftStretch: 0.042,
      shearCompliance: 0.085,
      bendCompliance: 0.12,
      damping: 0.21,
      bodyFriction: 0.48,
      selfFriction: 0.43,
      airDrag: 0.028,
    },
    optics: {
      baseColorLinear: [0.20, 0.23, 0.18],
      roughness: 0.91,
      fiberSheen: 0.33,
      anisotropy: 0.18,
      opacity: 1,
    },
    microstructure: {
      repeatUPerMeter: 420,
      repeatVPerMeter: 420,
      amplitude: 0.045,
      phase: 0.13,
      skew: 0.34,
    },
  }),
  silk_satin: Object.freeze({
    id: 'silk_satin_v1',
    name: 'Silk satin',
    family: MATERIAL_FAMILIES.WOVEN,
    mechanics: {
      thickness: 0.00045,
      arealDensity: 0.095,
      warpStretch: 0.035,
      weftStretch: 0.052,
      shearCompliance: 0.16,
      bendCompliance: 0.42,
      damping: 0.11,
      bodyFriction: 0.22,
      selfFriction: 0.18,
      airDrag: 0.015,
    },
    optics: {
      baseColorLinear: [0.55, 0.12, 0.14],
      roughness: 0.28,
      fiberSheen: 0.72,
      anisotropy: 0.68,
      opacity: 1,
    },
    microstructure: {
      repeatUPerMeter: 720,
      repeatVPerMeter: 390,
      amplitude: 0.022,
      phase: 0.61,
      skew: 0.12,
    },
  }),
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeNested(base, overrides = {}) {
  const output = clone(base);
  for (const [key, value] of Object.entries(overrides)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === 'object'
    ) {
      Object.assign(output[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

export function createMaterialDNA(preset = 'cotton_jersey', overrides = {}) {
  const base = PRESETS[preset];
  if (!base) throw new RangeError(`Unknown material preset: ${preset}`);
  const material = mergeNested(base, overrides);
  material.schema = MATERIAL_SCHEMA;
  material.revision = Number.isInteger(overrides.revision) ? overrides.revision : 1;
  material.units = 'SI';
  validateMaterialDNA(material);
  const withoutHash = { ...material };
  delete withoutHash.contentHash;
  material.contentHash = `fnv1a32:${hex32(hashString32(canonicalStringify(withoutHash)))}`;
  return material;
}

export function validateMaterialDNA(material) {
  if (!material || typeof material !== 'object') throw new TypeError('material must be an object');
  if (!Object.values(MATERIAL_FAMILIES).includes(material.family)) {
    throw new RangeError(`Unsupported material family: ${material.family}`);
  }
  const mechanics = material.mechanics ?? {};
  assertRange(mechanics.thickness, 0.00005, 0.02, 'mechanics.thickness');
  assertRange(mechanics.arealDensity, 0.01, 3, 'mechanics.arealDensity');
  assertRange(mechanics.warpStretch, 0.0001, 1, 'mechanics.warpStretch');
  assertRange(mechanics.weftStretch, 0.0001, 1, 'mechanics.weftStretch');
  assertRange(mechanics.shearCompliance, 0.0001, 1, 'mechanics.shearCompliance');
  assertRange(mechanics.bendCompliance, 0.0001, 1, 'mechanics.bendCompliance');
  assertRange(mechanics.damping, 0, 1, 'mechanics.damping');
  assertRange(mechanics.bodyFriction, 0, 2, 'mechanics.bodyFriction');
  assertRange(mechanics.selfFriction, 0, 2, 'mechanics.selfFriction');
  assertRange(mechanics.airDrag, 0, 1, 'mechanics.airDrag');

  const optics = material.optics ?? {};
  if (!Array.isArray(optics.baseColorLinear) || optics.baseColorLinear.length !== 3) {
    throw new TypeError('optics.baseColorLinear must contain three channels');
  }
  optics.baseColorLinear.forEach((value, index) =>
    assertRange(value, 0, 1, `optics.baseColorLinear[${index}]`),
  );
  assertRange(optics.roughness, 0, 1, 'optics.roughness');
  assertRange(optics.fiberSheen, 0, 1, 'optics.fiberSheen');
  assertRange(optics.anisotropy, 0, 1, 'optics.anisotropy');
  assertRange(optics.opacity, 0, 1, 'optics.opacity');

  const micro = material.microstructure ?? {};
  assertRange(micro.repeatUPerMeter, 1, 100000, 'microstructure.repeatUPerMeter');
  assertRange(micro.repeatVPerMeter, 1, 100000, 'microstructure.repeatVPerMeter');
  assertRange(micro.amplitude, 0, 0.5, 'microstructure.amplitude');
  assertRange(micro.phase, -1000, 1000, 'microstructure.phase');
  assertRange(micro.skew, -1, 1, 'microstructure.skew');
  return true;
}

/**
 * Analytic material sample. Coordinates are metric pattern coordinates, so the
 * weave remains stable after fitting and does not depend on bitmap UV data.
 */
export function evaluateMaterialAppearance(material, coordinate, frame = 0) {
  validateMaterialDNA(material);
  const u = Number(coordinate?.[0] ?? coordinate?.u ?? 0);
  const v = Number(coordinate?.[1] ?? coordinate?.v ?? 0);
  const micro = material.microstructure;
  const familyPhase = material.family === MATERIAL_FAMILIES.KNIT ? Math.PI * 0.5 : 0;
  const phaseU = TAU * (u * micro.repeatUPerMeter + v * micro.skew) + micro.phase + frame * 0.001;
  const phaseV = TAU * v * micro.repeatVPerMeter + familyPhase;

  const fiberU = Math.sin(phaseU);
  const fiberV = Math.sin(phaseV);
  const crossing = fiberU * fiberV;
  const knitLoop = Math.sin(phaseU + 0.45 * Math.sin(phaseV));
  const structure = material.family === MATERIAL_FAMILIES.KNIT
    ? 0.58 * knitLoop + 0.42 * crossing
    : 0.72 * crossing + 0.28 * Math.sin(phaseU + phaseV);
  const modulation = 1 + structure * micro.amplitude;
  const color = material.optics.baseColorLinear.map((channel) => clamp(channel * modulation, 0, 1));

  const slopeU = micro.amplitude * Math.cos(phaseU) * micro.repeatUPerMeter * 0.0004;
  const slopeV = micro.amplitude * Math.cos(phaseV) * micro.repeatVPerMeter * 0.0004;
  const microNormal = normalize3(-slopeU, 1, -slopeV);

  return {
    colorLinear: color,
    roughness: clamp(material.optics.roughness - Math.abs(structure) * 0.045, 0, 1),
    fiberSheen: saturate(material.optics.fiberSheen * (0.75 + Math.abs(fiberU) * 0.25)),
    anisotropy: material.optics.anisotropy,
    opacity: material.optics.opacity,
    microNormal,
    structure,
  };
}

export function compileMaterialUniformBlock(material) {
  validateMaterialDNA(material);
  const { mechanics, optics, microstructure } = material;
  return new Float32Array([
    ...optics.baseColorLinear,
    optics.opacity,
    optics.roughness,
    optics.fiberSheen,
    optics.anisotropy,
    mechanics.thickness,
    mechanics.arealDensity,
    mechanics.warpStretch,
    mechanics.weftStretch,
    mechanics.shearCompliance,
    mechanics.bendCompliance,
    mechanics.damping,
    mechanics.bodyFriction,
    mechanics.selfFriction,
    mechanics.airDrag,
    microstructure.repeatUPerMeter,
    microstructure.repeatVPerMeter,
    microstructure.amplitude,
    microstructure.phase,
    microstructure.skew,
  ]);
}

export function listMaterialPresets() {
  return Object.keys(PRESETS);
}
