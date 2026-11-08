import{SOURCE_SCENE_PROFILE}from'./SourceSceneProfile.mjs';
export const SCENE_DEFAULTS=Object.freeze({lighting:'original',reverse:false,exposure:SOURCE_SCENE_PROFILE.recipe.exposure,contact:1});
export function validateSceneVariables(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(SCENE_DEFAULTS,k)))throw Error('观察场景变量无效');
 const r={...SCENE_DEFAULTS,...input};if(!['original','inspection'].includes(r.lighting)||typeof r.reverse!=='boolean'||!Number.isFinite(r.exposure)||r.exposure<.1||r.exposure>2||!Number.isFinite(r.contact)||r.contact<0||r.contact>1)throw Error('观察场景变量超出范围');return r;
}
