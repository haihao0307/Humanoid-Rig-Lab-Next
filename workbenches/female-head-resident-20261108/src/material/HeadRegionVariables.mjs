// Source-authored head appearance controls. These apply only to the isolated
// head research candidate; the original platform's body state is separate.
export const HEAD_REGION_SPECS=Object.freeze({
 regionalColor:['分区血色强度',0,1,'fbRegional'],
 lidWarmth:['眼睑与眼角血色',0,1,'fbLidWarmth'],
 noseWarmth:['鼻翼与鼻尖血色',0,1,'fbNoseWarmth'],
 earBlood:['耳廓与耳垂血色',0,1,'fbEarBlood'],
 earTransmission:['耳缘薄区透光',0,1,'fbTransmission'],
 beardShadow:['鬓边与下巴毛囊色',0,1,'fbBeard'],
 overallColour:['头部整体色彩',0,1.5,'overallColour'],
 overallReflection:['头部整体反光',0,1,'overallReflection'],
 oilFilm:['表面油膜反光',0,1,'personOilFilm'],
 fuzz:['细绒柔光',0,1,'personSoftFuzz'],
 noseBlackheads:['鼻部黑头深浅',0,1,'saBlackheads'],
 noseFilaments:['鼻部皮脂丝',0,1,'saFilaments'],
 noseOil:['分区毛孔与油膜',0,1,'saOil'],
 noseRelief:['鼻部毛孔微浮雕',0,1,'r5NasalRelief']
});
export const HEAD_REGION_TOGGLES=Object.freeze({nasalContents:['鼻部毛孔内容层','r5NasalEnabled']});
export function defaultHeadRegions(recipe){const result={};for(const[k,[,min,max,name]]of Object.entries(HEAD_REGION_SPECS)){const v=recipe?.uniforms?.[name];if(!Number.isFinite(v)||v<min||v>max)throw Error('原版分区默认值无效：'+k);result[k]=v;}for(const[k,[,name]]of Object.entries(HEAD_REGION_TOGGLES)){const v=recipe?.uniforms?.[name];if(v!==0&&v!==1)throw Error('原版分区开关无效：'+k);result[k]=!!v;}return result;}
export function validateHeadRegions(input,recipe){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('头部分区参数无效');const result=defaultHeadRegions(recipe);for(const[k,v]of Object.entries(input)){if(Object.hasOwn(HEAD_REGION_TOGGLES,k)){if(typeof v!=='boolean')throw Error('头部分区开关无效：'+k);}else{const spec=HEAD_REGION_SPECS[k];if(!Object.hasOwn(HEAD_REGION_SPECS,k)||!Number.isFinite(v)||v<spec[1]||v>spec[2])throw Error('头部分区参数超出原范围：'+k);}result[k]=v;}return result;}
export function headRegionUniforms(regions){const result={};for(const[k,[,,,name]]of Object.entries(HEAD_REGION_SPECS))result[name]=regions[k];for(const[k,[,name]]of Object.entries(HEAD_REGION_TOGGLES))result[name]=Number(regions[k]);return result;}
