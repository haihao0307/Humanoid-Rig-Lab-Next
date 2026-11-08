import{SOURCE_MOTHER_STATE}from'../SourceMotherState.mjs';
export const NATIVE_LIP_VARIABLE_REVISION='r15-native-lip-variables/20261025-1';
// Exact native R15 ranges (Zd and Yd). Default values are the captured P01
// person, which differs from the original empty-controller defaults.
export const NATIVE_LIP_STRUCTURE_RANGES=Object.freeze({structure:[0,1.5],upperVolume:[0,1.5],lowerVolume:[0,1.5],cupid:[0,1.5],tubercle:[0,1.5],corners:[0,1.5],borderSoftness:[0,1],furrows:[0,1.5],pigment:[0,1],wetness:[0,1],dryRoughness:[.35,.75],eyeSmoothing:[0,1],colorVariation:[0,1],upperShade:[0,1],dryness:[0,1],microRelief:[0,1.5],textureDensity:[.6,1.5],patternSeed:[0,999]});
export const NATIVE_LIP_ANATOMY_RANGES=Object.freeze({upperMelanin:[0,1],lowerMelanin:[0,1],upperBlood:[0,1],lowerBlood:[0,1],oxygenation:[0,1],upperRoughness:[.3,.8],lowerRoughness:[.3,.8],upperWetness:[0,1],lowerWetness:[0,1],tissueDepth:[.5,1.5],microGeometry:[0,1.5],skinRefinement:[0,1]});
export function defaultNativeLipVariables(){return{structure:{...SOURCE_MOTHER_STATE.actualFrozenDefaultState.lipStructure},anatomy:{...SOURCE_MOTHER_STATE.actualFrozenDefaultState.lipAnatomyDNA}};}
function lipObject(input,label){if(!input||typeof input!=='object'||Array.isArray(input))throw Error(label+'格式无效');}
export function validateNativeLipVariables(input={}){
 lipObject(input,'唇部配方');if(Object.keys(input).some(k=>!['structure','anatomy'].includes(k)))throw Error('唇部配方含未知板块');const defaults=defaultNativeLipVariables(),out={};
 for(const group of['structure','anatomy']){
  const patch=input[group]===undefined?{}:input[group];lipObject(patch,'唇部参数');const ranges=group==='structure'?NATIVE_LIP_STRUCTURE_RANGES:NATIVE_LIP_ANATOMY_RANGES;
  if(Object.keys(patch).some(k=>!Object.hasOwn(defaults[group],k)))throw Error('唇部配方含未知参数');
  if(patch.schema&&patch.schema!==defaults[group].schema&&!(group==='structure'&&patch.schema==='kaopu/lip-structure@1'))throw Error('原唇部配方版本不兼容');
  out[group]={...defaults[group],...patch,schema:defaults[group].schema};
  for(const[k,[low,high]]of Object.entries(ranges)){const value=out[group][k];if(!Number.isFinite(value)||value<low||value>high)throw Error('唇部参数越界：'+k);}
 }
 if(typeof out.structure.enabled!=='boolean')throw Error('唇部开关无效');if(!Number.isInteger(out.structure.patternSeed))throw Error('唇纹种子必须是整数');return out;
}
export function patchNativeLipVariables(current,patch={}){lipObject(patch,'唇部更新');if(Object.keys(patch).some(k=>!['structure','anatomy'].includes(k)))throw Error('唇部更新含未知板块');for(const v of Object.values(patch))lipObject(v,'唇部更新');return validateNativeLipVariables({structure:{...current.structure,...patch.structure},anatomy:{...current.anatomy,...patch.anatomy}});}
export function hasNativeLipChange(input){const v=validateNativeLipVariables(input),d=defaultNativeLipVariables();return['structure','anatomy'].some(g=>Object.keys(d[g]).some(k=>v[g][k]!==d[g][k]));}
