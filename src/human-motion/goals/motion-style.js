export const MOTION_STYLE_SCHEMA = 'humanoid_rig/motion_style@1.0';

const DEFAULT_STYLE = Object.freeze({
  schema: MOTION_STYLE_SCHEMA,
  energy: 0.5,
  precision: 0.75,
  stiffness: 0.45,
  amplitude: 0.6,
  tempo: 1,
  weight: 0,
  fatigue: 0,
  alertness: 0.5,
});

export function createMotionStyle(input = {}) {
  return normalizeMotionStyle(input);
}

export function normalizeMotionStyle(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    schema: MOTION_STYLE_SCHEMA,
    energy: unit(source.energy, DEFAULT_STYLE.energy),
    precision: unit(source.precision, DEFAULT_STYLE.precision),
    stiffness: unit(source.stiffness, DEFAULT_STYLE.stiffness),
    amplitude: unit(source.amplitude, DEFAULT_STYLE.amplitude),
    tempo: clamp(finite(source.tempo, DEFAULT_STYLE.tempo), 0.25, 2),
    weight: unit(source.weight, DEFAULT_STYLE.weight),
    fatigue: unit(source.fatigue, DEFAULT_STYLE.fatigue),
    alertness: unit(source.alertness, DEFAULT_STYLE.alertness),
  };
}

export function validateMotionStyle(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, errors: ['MotionStyle must be an object.'] };
  }
  if (input.schema != null && input.schema !== MOTION_STYLE_SCHEMA) {
    errors.push(`Unsupported MotionStyle schema: ${String(input.schema)}.`);
  }
  for (const key of ['energy', 'precision', 'stiffness', 'amplitude', 'weight', 'fatigue', 'alertness']) {
    if (input[key] != null && (!Number.isFinite(Number(input[key])) || Number(input[key]) < 0 || Number(input[key]) > 1)) {
      errors.push(`${key} must be a finite value in [0, 1].`);
    }
  }
  if (input.tempo != null && (!Number.isFinite(Number(input.tempo)) || Number(input.tempo) < 0.25 || Number(input.tempo) > 2)) {
    errors.push('tempo must be a finite value in [0.25, 2].');
  }
  return { valid: errors.length === 0, errors };
}

export function mergeMotionStyles(base, override) {
  return normalizeMotionStyle({ ...normalizeMotionStyle(base), ...(override || {}) });
}

function unit(value, fallback) {
  return clamp(finite(value, fallback), 0, 1);
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
