// One serialized shape contract for the authoring page and generation worker.
// These bounds describe authored variants, not a measured population model.
export const SHAPE_SCHEMA='jarvis/human_shape@2';
export const SHAPE_REVISION='r2-regional-shape-r2';
export const SHAPE_PARAMETER_SPECS=Object.freeze([
 Object.freeze({id:'statureScale',label:'整体身高',min:.94,max:1.06,neutral:1}),
 Object.freeze({id:'legProportion',label:'腿身比例',min:-1,max:1,neutral:0}),
 Object.freeze({id:'shoulderWidth',label:'肩宽',min:-1,max:1,neutral:0}),
 Object.freeze({id:'hipWidth',label:'骨盆宽度',min:-1,max:1,neutral:0}),
 Object.freeze({id:'waistWidth',label:'腰部宽度',min:-1,max:1,neutral:0}),
 Object.freeze({id:'torsoDepth',label:'胸腹厚度',min:-1,max:1,neutral:0}),
 Object.freeze({id:'armFullness',label:'手臂丰满度',min:-1,max:1,neutral:0}),
 Object.freeze({id:'legFullness',label:'腿部丰满度',min:-1,max:1,neutral:0})
]);
export function normalizeCharacterShape(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('体型参数必须为对象');
 const legacy=input.schema==='jarvis/human_shape@1'||input.revision==='r2-uniform-stature-r1';
 const expectedSchema=legacy?'jarvis/human_shape@1':SHAPE_SCHEMA,expectedRevision=legacy?'r2-uniform-stature-r1':SHAPE_REVISION;
 if(input.schema!==undefined&&input.schema!==expectedSchema||input.revision!==undefined&&input.revision!==expectedRevision)throw Error('体型参数版本不匹配');
 const allowed=legacy?['schema','revision','statureScale']:['schema','revision',...SHAPE_PARAMETER_SPECS.map(spec=>spec.id)];
 if(Object.keys(input).some(key=>!allowed.includes(key)))throw Error(legacy?'旧版体型只能包含身高，请使用新版局部体型配方':'体型参数含未知字段');
 const result={schema:SHAPE_SCHEMA,revision:SHAPE_REVISION};
 for(const spec of SHAPE_PARAMETER_SPECS){const value=input[spec.id]===undefined?spec.neutral:input[spec.id];
  if(typeof value!=='number'||!Number.isFinite(value)||value<spec.min||value>spec.max)throw Error(spec.label+'应在 '+spec.min+' 至 '+spec.max+' 之间');
  result[spec.id]=Object.is(value,-0)?0:value;
 }
 return result;
}
export function characterShapeParameterKey(input={}){
 const shape=normalizeCharacterShape(input);
 return [shape.schema,shape.revision,...SHAPE_PARAMETER_SPECS.map(spec=>spec.id+'='+String(shape[spec.id]))].join(':');
}
export function sameCharacterShape(a,b){return characterShapeParameterKey(a)===characterShapeParameterKey(b);}
export function isReferenceCharacterShape(input={}){const shape=normalizeCharacterShape(input);return SHAPE_PARAMETER_SPECS.every(spec=>shape[spec.id]===spec.neutral);}
export function hasRegionalCharacterShape(input={}){const shape=normalizeCharacterShape(input);return SHAPE_PARAMETER_SPECS.some(spec=>spec.id!=='statureScale'&&shape[spec.id]!==spec.neutral);}
