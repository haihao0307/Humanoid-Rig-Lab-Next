/* Verified original coefficients, fetched only for the requested source state.
 * Source partition provenance is retained. This is not an autonomous mother. */
(()=>{'use strict';
const sha=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),v=>v.toString(16).padStart(2,'0')).join('');
const sessions=new WeakMap();
function session(pack){if(!sessions.has(pack))sessions.set(pack,{cache:new Map(),pending:new Map(),hits:0,requests:0,loadedBytes:0,evictions:0,limit:2});return sessions.get(pack);}
function report(pack){const s=session(pack);return{decodedStates:s.cache.size,pending:s.pending.size,hits:s.hits,requests:s.requests,loadedCompressedBytes:s.loadedBytes,evictions:s.evictions,decodedStateLimit:s.limit,sourceCoefficientsByteExact:true};}
async function decode(pack,id){
 if(pack.schema!=='body-source-affine-atlas-pack/3')throw Error('原貌函数包格式不匹配');
 const profile=pack.profiles.find(p=>p.id===id);if(!profile)throw Error('没有这个来源状态');
 if(profile.report.unresolved.length||profile.report.maxDepth>=30||profile.report.maxProjectedLayers>32)throw Error('这个候选仍有未解决的分区');
 const s=session(pack);if(s.cache.has(id)){const hit=s.cache.get(id);s.cache.delete(id);s.cache.set(id,hit);s.hits++;return hit;}if(s.pending.has(id))return s.pending.get(id);
 const task=(async()=>{const entries=await Promise.all(Object.entries(profile.arrays).map(async([name,index])=>{
  const blob=pack.blobs[index],Type={Float64Array,Uint32Array}[blob?.type];if(!Type||!blob.url||!blob.compressedSHA256)throw Error('函数字段元数据不完整');
  const response=await fetch(blob.url);if(!response.ok)throw Error('原函数字段未能载入：'+response.status);const compressed=await response.arrayBuffer();s.requests++;s.loadedBytes+=compressed.byteLength;
  if(compressed.byteLength!==blob.compressedBytes||await sha(compressed)!==blob.compressedSHA256)throw Error('原函数压缩字段校验失败');
  const inflated=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();let raw=inflated;
  if(blob.encoding==='gzip-byte-shuffle'){const input=new Uint8Array(inflated),output=new Uint8Array(input.length),width=Type.BYTES_PER_ELEMENT,n=input.length/width;for(let b=0;b<width;b++)for(let i=0;i<n;i++)output[i*width+b]=input[b*n+i];raw=output.buffer;}else if(blob.encoding!=='gzip')throw Error('函数字段压缩格式不匹配');
  if(raw.byteLength!==blob.bytes||await sha(raw)!==blob.sha256)throw Error('原函数系数校验失败');const values=new Type(raw);if(values.length!==blob.length)throw Error('函数系数长度不符');return[name,values];
 }));const result={...profile,...Object.fromEntries(entries),material:pack.material,storage:pack.storage,sourceFidelityAccepted:false};s.cache.set(id,result);while(s.cache.size>s.limit){s.cache.delete(s.cache.keys().next().value);s.evictions++;}return result;})();
 s.pending.set(id,task);try{return await task;}finally{s.pending.delete(id);}
}
globalThis.BodyAtlasPackageR23={decode,report};globalThis.BodyAtlasPackageR21=globalThis.BodyAtlasPackageR23;
})();
