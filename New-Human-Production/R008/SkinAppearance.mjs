// Adapted from our SkinAppearance/TissueShaders: authored art controls, not UV physiology.
// Only compact state is persisted; colour fields are evaluated at runtime.
export const SKIN_SCHEMA='human-r008/skin@1';
export const SKIN_REFERENCE_COLOR='#d0ac91';
export const SKIN_DEFAULT=Object.freeze({baseColor:SKIN_REFERENCE_COLOR,undertone:.02,redness:.13,variation:.30,sunExposure:0,weathering:0,roughness:.52,oil:.25});
export const SKIN_PRESETS=Object.freeze({
 reference:{label:'当前原始肤色',baseColor:SKIN_REFERENCE_COLOR,sunExposure:0},
 arrival:{label:'初到岛上 · 较浅',baseColor:'#e3c7af',sunExposure:0},
 week:{label:'户外一周',baseColor:'#e3c7af',days:7,equivalentSunHours:42},
 month:{label:'长期日晒 · 30 天',baseColor:'#e3c7af',days:30,equivalentSunHours:180}
});
export const SKIN_CONTROLS=Object.freeze([
 {key:'sunExposure',label:'日晒变深',min:0,max:1,step:.01},
 {key:'undertone',label:'冷暖底调',min:-1,max:1,step:.01},
 {key:'redness',label:'红润变化',min:0,max:1,step:.01},
 {key:'variation',label:'肤色细微变化',min:0,max:1,step:.01},
 {key:'weathering',label:'户外粗糙感',min:0,max:1,step:.01},
 {key:'roughness',label:'皮肤粗糙度',min:.30,max:.85,step:.01},
 {key:'oil',label:'油光',min:0,max:1,step:.01}
]);
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
function object(v,label){if(!v||typeof v!=='object'||Array.isArray(v))throw Error(label+'必须是对象');return v;}
function number(v,a,b,label){if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)throw Error(label+'超出范围');return v;}
function keys(v,allowed,label){if(Object.keys(v).some(k=>!allowed.includes(k)))throw Error(label+'包含未知字段');}
export function validateSkinAppearance(input={}){
 object(input,'肤色参数');keys(input,Object.keys(SKIN_DEFAULT),'肤色参数');const p={...SKIN_DEFAULT,...input};
 if(typeof p.baseColor!=='string'||!/^#[0-9a-f]{6}$/i.test(p.baseColor))throw Error('基础肤色应为 #RRGGBB');p.baseColor=p.baseColor.toLowerCase();
 for(const c of SKIN_CONTROLS)number(p[c.key],c.min,c.max,c.label);return p;
}
export function skinHexToLinear(hex){return [1,3,5].map(i=>{const v=parseInt(hex.slice(i,i+2),16)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});}
export function resolveSkinChannels(input){
 const p=validateSkinAppearance(input),ref=skinHexToLinear(SKIN_REFERENCE_COLOR),base=skinHexToLinear(p.baseColor);
 return {gain:base.map((v,i)=>clamp(v/ref[i],.12,2.6)),tone:p.undertone-SKIN_DEFAULT.undertone,redness:p.redness-SKIN_DEFAULT.redness,variation:p.variation-SKIN_DEFAULT.variation,roughness:p.roughness-SKIN_DEFAULT.roughness,oil:p.oil-SKIN_DEFAULT.oil,tan:p.sunExposure,weathering:p.weathering};
}
// Testable reference for pigment application. Normals and geometry are untouched.
export function applySkinPigment(rgb,input,exposure=1,mask=1){
 const c=resolveSkinChannels(input),weight=clamp(mask);return rgb.map((v,i)=>v*(1-weight+weight*c.gain[i]*(1+c.tone*[.055,.012,-.075][i])*Math.exp(-c.tan*clamp(exposure)*[.85,1.06,1.25][i])));
}
const PROGRESSION_DEFAULT=Object.freeze({elapsedHours:0,equivalentSunHours:0,halfTanSunHours:48});
export class SkinExposure {
 constructor(input={}){this.appearance=validateSkinAppearance(input);this.progression={...PROGRESSION_DEFAULT};}
 setAppearance(patch){this.appearance=validateSkinAppearance({...this.appearance,...object(patch,'肤色参数')});return this.export();}
 preset(id){if(!Object.hasOwn(SKIN_PRESETS,id))throw Error('未知肤色预设');const p=SKIN_PRESETS[id];this.progression={...PROGRESSION_DEFAULT,elapsedHours:(p.days||0)*24,equivalentSunHours:p.equivalentSunHours||0};this.appearance=validateSkinAppearance({...SKIN_DEFAULT,baseColor:p.baseColor,sunExposure:p.sunExposure??1-Math.exp(-Math.LN2*this.progression.equivalentSunHours/this.progression.halfTanSunHours)});return this.export();}
 advance(gameHours,environment={}){
  number(gameHours,0,1e7,'游戏小时');object(environment,'日晒环境');keys(environment,['uv','shade','coveredFraction'],'日晒环境');
  const uv=number(environment.uv??1,0,4,'日晒强度'),shade=number(environment.shade??0,0,1,'遮阴'),covered=number(environment.coveredFraction??0,0,1,'遮盖');
  const dose=gameHours*uv*(1-shade)*(1-covered),next={...this.progression,elapsedHours:this.progression.elapsedHours+gameHours,equivalentSunHours:this.progression.equivalentSunHours+dose};
  number(next.elapsedHours,0,1e9,'累计时间');number(next.equivalentSunHours,0,4e9,'累计日晒');
  // Exact bounded integration: independent of render FPS and partition size.
  this.appearance={...this.appearance,sunExposure:1-(1-this.appearance.sunExposure)*Math.exp(-Math.LN2*dose/next.halfTanSunHours)};this.progression=next;return this.export();
 }
 export(){return {schema:SKIN_SCHEMA,appearance:{...this.appearance},progression:{...this.progression}};}
 restore(recipe){
  object(recipe,'肤色存档');keys(recipe,['schema','appearance','progression'],'肤色存档');if(recipe.schema!==SKIN_SCHEMA)throw Error('肤色存档版本不匹配');
  const a=validateSkinAppearance(object(recipe.appearance,'肤色参数')),p=object(recipe.progression,'日晒进度');keys(p,Object.keys(PROGRESSION_DEFAULT),'日晒进度');
  const next={...PROGRESSION_DEFAULT,...p};number(next.elapsedHours,0,1e9,'累计时间');number(next.equivalentSunHours,0,4e9,'累计日晒');number(next.halfTanSunHours,.1,10000,'日晒速度');
  this.appearance=a;this.progression=next;return this.export();
 }
}
