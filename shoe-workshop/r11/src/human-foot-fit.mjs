/**
 * Shoe R11 Human Foot Fit Adapter
 *
 * Purpose:
 * - Keep humanoid rig data untouched.
 * - Convert foot measurements into wearable shoe adjustment parameters.
 * - Provide a bounded adapter between Human Core and Shoe Last.
 *
 * This is an appearance/fit adapter, not a biomechanical pressure solver.
 */

export const FOOT_FIT_PRESETS = {
  standard: {
    name: '标准脚',
    footLengthScale: 1,
    forefootWidthScale: 1,
    instepScale: 1,
    heelVolumeScale: 1
  },
  wide: {
    name: '宽脚',
    footLengthScale: 1,
    forefootWidthScale: 1.08,
    instepScale: 1.03,
    heelVolumeScale: 1.04
  },
  narrow: {
    name: '窄脚',
    footLengthScale: 1,
    forefootWidthScale: 0.94,
    instepScale: 0.97,
    heelVolumeScale: 0.96
  },
  highInstep: {
    name: '高脚背',
    footLengthScale: 1,
    forefootWidthScale: 1.02,
    instepScale: 1.1,
    heelVolumeScale: 1.02
  }
};

export function createFootProfile(input = {}) {
  return {
    footLength: Number(input.footLength || 0.265),
    forefootWidth: Number(input.forefootWidth || 0.102),
    instepHeight: Number(input.instepHeight || 0.062),
    heelWidth: Number(input.heelWidth || 0.064),
    ankleHeight: Number(input.ankleHeight || 0.09)
  };
}

export function solveWearableFit(footProfile, presetId = 'standard') {
  const preset = FOOT_FIT_PRESETS[presetId] || FOOT_FIT_PRESETS.standard;

  return {
    preset: presetId,
    shoeScale: {
      length: preset.footLengthScale,
      width: preset.forefootWidthScale,
      volume: preset.instepScale
    },
    offsets: {
      heel: (footProfile.heelWidth - 0.064) * 0.35,
      instep: (footProfile.instepHeight - 0.062) * 0.5,
      toeClearance: Math.max(0.003, footProfile.footLength * 0.015)
    },
    diagnostics: {
      biomechanicalPressureSolver: false,
      deformationSolver: false,
      appearanceFitOnly: true
    }
  };
}

export function applyWearableFitTransform(object, fitResult) {
  if (!object || !fitResult) return;

  const s = fitResult.shoeScale;
  object.scale.x *= s.width;
  object.scale.y *= s.volume;
  object.scale.z *= s.length;

  object.position.y += fitResult.offsets.instep;
  object.userData = {
    ...(object.userData || {}),
    wearableFit: fitResult
  };
}
