import catalog from './parameter-catalog.json' with {type:'json'};
export const PARAMETER_SCHEMA=catalog.schema;
export function decorateControl(def,context={}){
 const commonId=def.commonId||catalog.presentation.find(p=>p.key===def.key)?.commonId||catalog.aliases[context.adapter]?.[def.key],semantic=catalog.semantics[commonId];
 return {...def,...(semantic?{commonId,uiLabel:semantic.label,unit:semantic.unit,uiGroup:semantic.group}:{uiLabel:def.label,unit:def.unit||'source-range',uiGroup:def.section==='scene'?'scene':'extensions'})};
}
export function presentationControls(state={}){
 return catalog.presentation.map(d=>decorateControl({...d,label:catalog.semantics[d.commonId].label,section:'studio',value:d.key==='displayStage'?(state.displayStage||d.value):d.value}));
}
export function profileControls(adapter,values={},flags={}){
 return (catalog.profiles[adapter]||[]).filter(d=>!d.when||flags[d.when]).map(({when,...d})=>decorateControl({...d,value:values[d.key]??d.value},{adapter}));
}
// Live adjustment clamps ranges; imported scores reject out-of-range values.
// Both paths share the exact same type, enum and finite-number rules.
export function controlValue(def,input,{clamp=false}={}){
 if(def.type==='range'){
  const value=clamp?Number(input):input;
  if(typeof value!=='number'||!Number.isFinite(value)||!Number.isFinite(def.min)||!Number.isFinite(def.max))throw Error('参数必须为有限数字：'+def.key);
  if(clamp)return Math.max(def.min,Math.min(def.max,value));
  if(value<def.min||value>def.max)throw Error('乐谱参数超出当前乐器范围：'+def.key);return value;
 }
 if(def.type==='select'){
  const value=String(input);if(!def.options?.some(o=>o.value===value))throw Error('参数选项无效：'+def.key);return value;
 }
 if(def.type==='color'){if(typeof input!=='string'||!/^#[\da-f]{6}$/i.test(input))throw Error('颜色格式无效：'+def.key);return input;}
 if(def.type==='checkbox'){if(clamp)return !!input;if(typeof input!=='boolean')throw Error('参数需要布尔值：'+def.key);return input;}
 throw Error('未知参数控件类型：'+def.type);
}
export function decorateControls(defs,context){return defs.map(d=>decorateControl(d,context));}
