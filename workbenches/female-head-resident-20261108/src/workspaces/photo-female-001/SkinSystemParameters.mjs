// Public values are dimensionless appearance controls, not measured biology.
export const SKIN_PARAMETER_RANGES=Object.freeze({
 psTone:[0,1],psWarmth:[0,1],psBlood:[0,1],psPores:[0,1.5],psMicro:[0,1.5],
 psFurrow:[0,1.5],psGrain:[0,1.5],txScale:[.65,1.5],txOil:[0,1],txColour:[0,1],psRoughness:[.32,.85],psLip:[0,1],
 femLipTint:[0,1],femBrow:[0,1],u_photoFitStrength:[0,1],u_photoScalpTexture:[0,1],
 stEyePigment:[-1,1],stNoseBlood:[-1,1],stEarBlood:[-1,1],stPerioral:[-1,1],stLipPigment:[-1,1],stLipBlood:[-1,1],stView:[0,3]
});
export const TISSUE_NEUTRAL=Object.freeze({stEyePigment:0,stNoseBlood:0,stEarBlood:0,stPerioral:0,stLipPigment:0,stLipBlood:0,stView:0});
export const TEXTURE_ARCHIVE_DEFAULTS=Object.freeze({txScale:1,txOil:.025,txColour:.25});
const LEGACY_ARCHIVE_KEYS=['psTone','psWarmth','psBlood','psPores','psMicro','psRoughness','psLip','femLipTint','femBrow','u_photoFitStrength','u_photoScalpTexture'];
export function migrateSkinArchive(old,{strict=false}={}){
 if(!old||typeof old!=='object'||Array.isArray(old)||LEGACY_ARCHIVE_KEYS.some(key=>!Object.hasOwn(old,key)))throw Error('肤色参数文件不完整');
 if(strict&&Object.keys(SKIN_PARAMETER_RANGES).some(key=>!Object.hasOwn(old,key)))throw Error('新版肤色参数文件不完整');
 return {...TISSUE_NEUTRAL,...TEXTURE_ARCHIVE_DEFAULTS,...old};
}
export function initializeSkinControls(state){
 if(!Number.isFinite(state?.psMicro))throw Error('缺少原始微纹参数');
 return {...TEXTURE_ARCHIVE_DEFAULTS,...state,psFurrow:state.psMicro,psGrain:state.psMicro,...TISSUE_NEUTRAL};
}
export function applySkinParameterPatch(state,patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('肤质参数无效');
 for(const [key,value] of Object.entries(patch)){const range=SKIN_PARAMETER_RANGES[key];if(!range||!Number.isFinite(value)||value<range[0]||value>range[1]||(key==='stView'&&!Number.isInteger(value)))throw Error('肤质参数无效：'+key);}
 const next={...state,...patch};
 // Old archives carry only psMicro; separate explicit values always win.
 if('psMicro'in patch){if(!('psFurrow'in patch))next.psFurrow=patch.psMicro;if(!('psGrain'in patch))next.psGrain=patch.psMicro;}
 if('psPores'in patch)next.txPores=patch.psPores*.6;
 if('psMicro'in patch||'psFurrow'in patch||'psGrain'in patch){next.txFurrows=next.psFurrow/.58*.28;next.txGrain=next.psGrain/.58*.25;}
 return next;
}
export function publicSkinControls(state){return Object.fromEntries(Object.keys(SKIN_PARAMETER_RANGES).map(key=>[key,state[key]]));}
