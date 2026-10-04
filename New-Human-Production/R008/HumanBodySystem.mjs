import {analyzeHumanoid} from './AnatomyAnalysis.mjs';
import {createCompositionProfile,createCompositionFields,solveComposition,compositionPoint,compactComposition} from './BodyComposition.mjs';
import {normalizeBody} from './BodyParameters.mjs';
import {enforceAnatomy,enforceComposition} from './AnatomyContract.mjs';
// Reusable intake for every supported adult-human subject. No renderer, model
// name, world coordinates or asset loader is required. Calibration is explicit.
export function createHumanBodySystem(input,calibration,options={}){
 const anatomy=analyzeHumanoid(input,options);enforceAnatomy(anatomy);
 const fitted=typeof calibration==='function'?calibration(anatomy):calibration;
 const profile=createCompositionProfile(anatomy,fitted),fields=createCompositionFields({positions:input.positions,skinIndex:input.skinIndex,skinWeight:input.skinWeight,anatomy,profile,seamGroups:input.seamGroups,materialIds:input.materialIds,protectedMaterials:fitted.protectedMaterials,samplingExcludedMaterials:fitted.samplingExcludedMaterials});
 let recipe=normalizeBody({age:profile.referenceAge}),solution=solveComposition(profile,recipe);enforceComposition(profile,solution);
 return {anatomy,profile,fields,get solution(){return solution;},get recipe(){return {...recipe};},
  set(patch){const next=normalizeBody({...recipe,...patch}),solved=solveComposition(profile,next);enforceComposition(profile,solved);recipe=next;solution=solved;return {...recipe};},
  context(i){return {...fields.context(i),controls:solution.controls};},
  point(i){return compositionPoint(Array.from(input.positions.subarray(i*3,i*3+3)),fields.context(i),solution.controls);},
  export(){return compactComposition(profile,solution);}
 };
}
