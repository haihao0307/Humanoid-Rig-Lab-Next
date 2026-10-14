import {solveFootFit,FOOT_PRESETS} from './HumanFitAdapter.mjs';

export function createHumanShoeBridge({footProfile,shoeProfile,preset='standard'}){
  const fit=solveFootFit(footProfile,shoeProfile,FOOT_PRESETS[preset]||FOOT_PRESETS.standard);
  return {
    preset,
    fit,
    applyTransform(shoe){
      if(!shoe)return shoe;
      shoe.position=fit.position;
      shoe.rotation=fit.rotation;
      shoe.scale=fit.scale;
      return shoe;
    }
  };
}

export function sampleHumanFootState(human){
  const foot=human?.foot||human?.joints?.foot;
  return {
    lengthMm:foot?.lengthMm??250,
    widthMm:foot?.widthMm??98,
    instepMm:foot?.instepMm??62,
    heelWidthMm:foot?.heelWidthMm??58
  };
}
