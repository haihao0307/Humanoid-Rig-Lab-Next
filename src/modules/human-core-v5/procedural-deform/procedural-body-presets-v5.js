export const PROCEDURAL_BODY_DNA_PRESETS_V5 = deepFreeze({
  Reference: {},
  Lean: {
    bodyType: { category: 'ectomorph' },
    mass: { weightKg: 58 },
    fitnessProfile: {
      muscle: 0.35,
      fat: 0.16,
      distribution: { upperBody: 0.40, lowerBody: 0.42 },
    },
    proportion: { bodyThickness: { chest: 0.19, waist: 0.15, hip: 0.19 } },
  },
  Muscular: {
    bodyType: { category: 'mesomorph' },
    mass: { weightKg: 92 },
    fitnessProfile: {
      muscle: 0.88,
      fat: 0.16,
      distribution: { upperBody: 0.82, lowerBody: 0.75 },
    },
    proportion: {
      shoulderWidth: 0.49,
      bodyThickness: { chest: 0.31, waist: 0.22, hip: 0.27 },
    },
  },
  Heavy: {
    bodyType: { category: 'endomorph' },
    mass: { weightKg: 112 },
    fitnessProfile: {
      muscle: 0.42,
      fat: 0.84,
      distribution: { upperBody: 0.52, lowerBody: 0.62 },
    },
    proportion: {
      bodyThickness: { chest: 0.35, waist: 0.34, hip: 0.38 },
      hipWidth: 0.25,
    },
  },
  Tall: {
    proportion: {
      height: 2.02,
      shoulderWidth: 0.46,
      hipWidth: 0.21,
      headToBodyRatio: 8.1,
      limbLengths: {
        upperArm: 0.34,
        forearm: 0.30,
        handControl: 0.085,
        thigh: 0.52,
        lowerLeg: 0.49,
      },
    },
  },
  Short: {
    proportion: {
      height: 1.55,
      shoulderWidth: 0.36,
      hipWidth: 0.19,
      headToBodyRatio: 6.8,
      limbLengths: {
        upperArm: 0.24,
        forearm: 0.21,
        handControl: 0.065,
        thigh: 0.36,
        lowerLeg: 0.34,
      },
    },
  },
  Asymmetric: {
    asymmetry: {
      mode: 'authored',
      leftRightScale: {
        shoulder: 1.10,
        arm: 1.08,
        hand: 1.05,
        hip: 1.06,
        leg: 1.08,
        foot: 1.04,
      },
    },
  },
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
