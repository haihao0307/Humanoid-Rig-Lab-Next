export const HUMAN_FOOT_PRESETS = {
  standard: { name:'标准脚', toeScale:1, forefootScale:1, instepScale:1, heelScale:1 },
  wide: { name:'宽脚', toeScale:1.04, forefootScale:1.08, instepScale:1.02, heelScale:1 },
  narrow: { name:'窄脚', toeScale:.98, forefootScale:.94, instepScale:.98, heelScale:.97 },
  highInstep: { name:'高脚背', toeScale:1, forefootScale:1.02, instepScale:1.08, heelScale:1 }
};

export function measureFootProfile(foot={}) {
  return {
    lengthMm:Number(foot.lengthMm||250),
    forefootWidthMm:Number(foot.forefootWidthMm||98),
    instepHeightMm:Number(foot.instepHeightMm||62),
    heelWidthMm:Number(foot.heelWidthMm||64),
    source:'human-foot-runtime'
  };
}

export function solveShoeFit(profile,preset='standard') {
  const p=HUMAN_FOOT_PRESETS[preset]||HUMAN_FOOT_PRESETS.standard;
  return {
    lengthScale:profile.lengthMm/250,
    widthScale:p.forefootScale,
    toeScale:p.toeScale,
    instepClearanceScale:p.instepScale,
    heelRetentionScale:p.heelScale,
    preset
  };
}

export function applyWearableTransform(shoe,fit){
  return {
    ...shoe,
    wearableFit:{...fit},
    // Display adaptation only. It does not modify human rig or shoe source pattern.
    transformMode:'wearable-adapter'
  };
}
