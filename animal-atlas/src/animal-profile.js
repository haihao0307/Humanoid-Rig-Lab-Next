import catalog from './parameter-catalog.json' with {type:'json'};
export const PROFILE_SCHEMA=catalog.warehouse.schema;
export const PROFILE_FIELDS=catalog.warehouse.fields;
const metadata=PROFILE_FIELDS.filter(d=>!d.source);
export function emptyProfile(){return {schema:PROFILE_SCHEMA,...Object.fromEntries(metadata.map(d=>[d.key,null]))};}
export function profileValue(key,value){
 const d=metadata.find(d=>d.key===key);if(!d)throw Error('未知动物档案字段：'+key);
 if(value===null)return null;
 if(d.type==='select'){if(typeof value!=='string'||!d.options.some(o=>o.value&&o.value===value))throw Error('动物档案选项无效：'+key);return value;}
 if(d.type==='color'){if(typeof value!=='string'||!/^#[\da-f]{6}$/i.test(value))throw Error('动物档案颜色无效');return value.toLowerCase();}
 if(typeof value!=='number'||!Number.isFinite(value)||value<d.min||value>d.max)throw Error('动物档案数值超出范围：'+key);return value;
}
export function validateProfile(value){
 if(!value||Array.isArray(value)||typeof value!=='object'||value.schema!==PROFILE_SCHEMA)throw Error('动物档案 schema 无效');
 for(const key of Object.keys(value))if(key!=='schema'&&!metadata.some(d=>d.key===key))throw Error('未知动物档案字段：'+key);
 const result=emptyProfile();for(const d of metadata)if(value[d.key]!==undefined)result[d.key]=profileValue(d.key,value[d.key]);return result;
}
export function colorBinding(controls){return controls.find(d=>d.type==='color'&&d.commonId==='surface.color');}
