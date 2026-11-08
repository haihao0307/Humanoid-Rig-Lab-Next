import{SOURCE_MOTHER_STATE}from'../SourceMotherState.mjs';
export const EYE_FUNCTION_REVISION='20261024-r04-source-eye-1';
const original=SOURCE_MOTHER_STATE.actualFrozenDefaultState.naturalEyes;
export const EYE_RANGES=Object.freeze({source:[0,1],irisScale:[.86,1.13],pupil:[.22,.62],brightness:[.55,1.45],tintAmount:[0,1],innerAmount:[0,1],scleraWhite:[0,1],yellow:[0,1],redness:[0,1],veinAmount:[0,1],veinDensity:[0,1],limbal:[0,1],rotation:[-180,180],contrast:[.65,1.45],wetness:[0,1],corneaRoughness:[.04,.24],scleraRoughness:[.16,.6],parallax:[0,1]});
// Retained native-eye Wl presets; values remain within the original ranges.
export const EYE_COLOR_PRESETS=Object.freeze({darkBrown:{source:0,tint:'#64452f',tintAmount:.94,innerColor:'#765438',innerAmount:.18,brightness:.86},lightBrown:{source:0,tint:'#967343',tintAmount:.9,innerColor:'#977341',innerAmount:.23,brightness:1.08},olive:{source:0,tint:'#64735b',tintAmount:.65,innerColor:'#9c793b',innerAmount:.32,brightness:.95},slate:{source:1,tint:'#607887',tintAmount:.82,innerColor:'#7d7862',innerAmount:.22,brightness:.94,contrast:.82}});
export function defaultEyeVariables(){return{enabled:original.enabled,reference:original.reference,autoPupil:original.autoPupil,illumination:original.illumination,left:{...original.left},right:{...original.right}};}
export function validateEyeVariables(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['enabled','reference','autoPupil','illumination','left','right'].includes(k)))throw Error('眼部变量格式无效');const result=defaultEyeVariables();
 for(const key of['enabled','reference','autoPupil'])if(input[key]!==undefined){if(typeof input[key]!=='boolean')throw Error('眼部开关无效');result[key]=input[key];}if(input.illumination!==undefined){if(!Number.isFinite(input.illumination)||input.illumination<0||input.illumination>1)throw Error('眼部环境明度超出原范围');result.illumination=input.illumination;}
 for(const side of['left','right']){const values=input[side];if(values===undefined)continue;if(!values||typeof values!=='object'||Array.isArray(values))throw Error('单侧眼部变量格式无效');for(const[key,value]of Object.entries(values)){
  if(!Object.hasOwn(result[side],key))throw Error('未知眼部变量：'+key);
  if(key==='tint'||key==='innerColor'){if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw Error('眼部颜色格式无效');}
  else{const range=EYE_RANGES[key];if(!range||!Number.isFinite(value)||value<range[0]||value>range[1]||(key==='source'&&!Number.isInteger(value)))throw Error('眼部变量超出原范围：'+key);}
  result[side][key]=value;
 }}return result;
}
export function patchEyeVariables(current,patch={}){if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!['enabled','reference','autoPupil','illumination','left','right'].includes(k)))throw Error('眼部更新格式无效');return validateEyeVariables({...current,...patch,left:{...current.left,...patch.left},right:{...current.right,...patch.right}});}
const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
export function eyeUniformData(input){const eyes=validateEyeVariables(input),tint=hex=>[1,3,5].map(i=>linear(parseInt(hex.slice(i,i+2),16)/255)),data={enabled:eyes.enabled?1:0,reference:eyes.reference?1:0,iris:[],tint:[],inner:[],sclera:[],misc:[],surface:[]};
 for(const side of['right','left']){const p=eyes[side];const pupil=eyes.autoPupil?.59-.35*(eyes.illumination*eyes.illumination*(3-2*eyes.illumination)):p.pupil;data.iris.push(p.irisScale,pupil,p.brightness,p.source);data.tint.push(...tint(p.tint),p.tintAmount);data.inner.push(...tint(p.innerColor),p.innerAmount);data.sclera.push(p.scleraWhite,p.yellow,p.redness,p.veinAmount);data.misc.push(p.veinDensity,p.limbal,p.rotation*Math.PI/180,p.contrast);data.surface.push(p.wetness,p.corneaRoughness,p.scleraRoughness,p.parallax);}return data;
}
