// Capture actual worker field buffers before renderer upload; no production
// worker or field values are changed by this verification hook.
window.__R26_FIELD_DIGESTS__=[];
const RealFieldWorkerR26=window.Worker;
window.Worker=class extends RealFieldWorkerR26{
 constructor(...args){super(...args);this.addEventListener('message',event=>{
  const value=event.data;if(value.type!=='field'||value.exactOnly)return;
  const jobs=[],seen=new WeakMap();
  function visit(x,path){if(ArrayBuffer.isView(x)){let entries=seen.get(x.buffer);if(!entries){entries=new Map();seen.set(x.buffer,entries);}const key=x.byteOffset+':'+x.byteLength;let promise=entries.get(key);if(!promise){const copy=new Uint8Array(x.buffer,x.byteOffset,x.byteLength).slice();promise=crypto.subtle.digest('SHA-256',copy).then(hash=>Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join(''));entries.set(key,promise);}jobs.push(promise.then(sha256=>({path,type:x.constructor.name,bytes:x.byteLength,sha256})));return;}if(x&&typeof x==='object')for(const[k,v]of Object.entries(x))visit(v,path+'.'+k);}
  for(const key of ['field','normalField','locals','intervalCache','paging','samples','normals','joints','neckCentre'])visit(value[key],key);
  const record={state:structuredClone(value.state),bounds:value.bounds,dimensions:value.dimensions,sourceNeck:value.stats.sourceNeck,cache:value.stats.cache,ready:Promise.all(jobs).then(buffers=>buffers.sort((a,b)=>a.path.localeCompare(b.path)))};__R26_FIELD_DIGESTS__.push(record);
 });}
};
