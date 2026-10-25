/* Exact original head-side INPUT packets, loaded only for explicit archive
 * transitions. This never evaluates or displays a head surface. */
(()=>{'use strict';
function create(descriptor,profiles,gate){
 if(descriptor?.schema!=='body-reference-boundary-inputs/1'||descriptor.headSurfaceGenerated!==false)throw Error('Boundary input package missing');
 const cache=new Map(),pending=new Map();let fetched=0,downloadedBytes=0;
 const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 async function packet(id){
  if(cache.has(id)){const value=cache.get(id);cache.delete(id);cache.set(id,value);return structuredClone(value);}
  if(pending.has(id))return structuredClone(await pending.get(id));
  const promise=(async()=>{const entry=descriptor.profiles.find(p=>p.id===id),state=profiles.find(p=>p.id===id)?.state;if(!entry||!state)throw Error('没有这个身体状态的原边界输入');const url=new URL(entry.url,document.baseURI);if(url.origin!==location.origin||!url.pathname.endsWith('/assets/body-boundary-r26/'+entry.compressedSHA256+'.gz'))throw Error('边界输入来源不匹配');const response=await fetch(url);if(!response.ok)throw Error('原边界输入未能载入：'+response.status);const compressed=await response.arrayBuffer();if(compressed.byteLength!==entry.compressedBytes||await hash(compressed)!==entry.compressedSHA256)throw Error('原边界输入压缩包校验失败');const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();if(raw.byteLength!==entry.rawBytes||await hash(raw)!==entry.rawSHA256)throw Error('原边界输入数值校验失败');const value=JSON.parse(new TextDecoder().decode(raw));await gate.requireCompatible({person:{state,bodyFunctionSystem:{headBoundary:value}}});fetched++;downloadedBytes+=compressed.byteLength;cache.set(id,value);while(cache.size>2)cache.delete(cache.keys().next().value);return value;})();pending.set(id,promise);try{return structuredClone(await promise);}finally{pending.delete(id);}
 }
 return{packet,report:()=>({states:cache.size,pending:pending.size,fetched,downloadedBytes,loadedByDefault:false,headSurfaceGenerated:false,referenceInputOnly:true})};
}
globalThis.BodyBoundaryPackageR26={create};
})();
