// Exact compact storage: never quantize a producer's values to save memory.
export const numericSequence=v=>Array.isArray(v)||(ArrayBuffer.isView(v)&&!(v instanceof DataView));
export function compactNumbers(values,kind='float'){
 if(!values)return values;
 if(kind==='byte')return values instanceof Uint8Array?values:new Uint8Array(values);
 if(kind==='index')return values instanceof Uint32Array?values:new Uint32Array(values);
 if(values instanceof Float32Array||values instanceof Float64Array)return values;
 // Legacy JSON may contain genuine doubles; preserve them exactly.
 const Type=values.every(v=>Math.fround(v)===v)?Float32Array:Float64Array;
 return new Type(values);
}
export function compactBake(bake){return {...bake,meshes:bake.meshes.map(m=>({...m,positions:compactNumbers(m.positions),indices:compactNumbers(m.indices,'index'),...(m.colors?{colors:compactNumbers(m.colors)}:{}),...(m.uv?{uv:compactNumbers(m.uv)}:{}),...(m.texture?{texture:compactNumbers(m.texture,'byte')}:{})}))};}
export function portableBake(bake){return {...bake,meshes:bake.meshes.map(m=>({...m,...Object.fromEntries(['positions','indices','colors','uv','texture'].filter(k=>m[k]).map(k=>[k,Array.isArray(m[k])?m[k]:Array.from(m[k])]))}))};}
export function someNumber(sequence,predicate){for(let i=0;i<sequence.length;i++)if(predicate(sequence[i]))return true;return false;}
// Keep the established portable JSON contract. Typed arrays are an internal optimization.
export function stringifyData(value,space){return JSON.stringify(value,(_,v)=>numericSequence(v)&&!Array.isArray(v)?Array.from(v):v,space);}
