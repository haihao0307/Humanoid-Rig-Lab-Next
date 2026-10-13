/* Runtime-generated arrays only: no serialized or prebaked fitted hats. */
export function bufferBytes(values){
 const buffers=new Set(),seen=new Set();
 function visit(v){
  if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);
  if(ArrayBuffer.isView(v)){buffers.add(v.buffer);return;}
  if(v instanceof ArrayBuffer){buffers.add(v);return;}
  if(v instanceof Map){for(const x of v.values())visit(x);return;}
  for(const x of Object.values(v))visit(x);
 }
 for(const v of values)visit(v);
 return [...buffers].reduce((n,b)=>n+b.byteLength,0);
}
export class RuntimeGeometryCache{
 constructor({maxEntries=11,maxBytes=64*1024*1024}={}){
  if(!Number.isInteger(maxEntries)||maxEntries<1||!Number.isFinite(maxBytes)||maxBytes<1)throw Error('Invalid geometry cache budget');
  this.entries=new Map();this.maxEntries=maxEntries;this.maxBytes=maxBytes;this.hits=0;this.misses=0;this.evictions=0;
 }
 get(key){const v=this.entries.get(key);if(!v){this.misses++;return null;}this.hits++;this.entries.delete(key);this.entries.set(key,v);return v;}
 set(key,value){
  this.entries.delete(key);if(bufferBytes([value])>this.maxBytes)return false;this.entries.set(key,value);
  while(this.entries.size>this.maxEntries||bufferBytes(this.entries.values())>this.maxBytes){this.entries.delete(this.entries.keys().next().value);this.evictions++;}
  return this.entries.has(key);
 }
 clear(){this.entries.clear();}
 report(){return {entries:this.entries.size,maxEntries:this.maxEntries,retainedArrayBytes:bufferBytes(this.entries.values()),maxBytes:this.maxBytes,hits:this.hits,misses:this.misses,evictions:this.evictions,scope:'runtime array references only; excludes active renderer, source JSON, images and browser overhead'};}
}
