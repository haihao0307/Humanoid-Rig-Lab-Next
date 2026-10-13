import {guard,aborted,waitWithSignal} from './worker-client.mjs';
const CACHE='kaopu-hat-detail-sha-v1',MAX_BYTES=28*1024*1024,MAX_ENTRIES=8;
const memory=new Map();let writes=Promise.resolve();
const stats={memoryHits:0,diskHits:0,networkRequests:0,networkBytes:0,cacheTimeouts:0,cacheFailures:0,fallbacks:0};
export function detailStats(){return {...stats,memoryEntries:memory.size,memoryBytes:[...memory.values()].reduce((n,b)=>n+b.byteLength,0),maxMemoryBytes:MAX_BYTES,maxEntries:MAX_ENTRIES};}
export function clearDetailMemory(){memory.clear();}
function remember(key,bytes){memory.delete(key);if(bytes.byteLength>MAX_BYTES)return;memory.set(key,bytes);while(memory.size>MAX_ENTRIES||[...memory.values()].reduce((n,b)=>n+b.byteLength,0)>MAX_BYTES)memory.delete(memory.keys().next().value);}
async function disk(p,ms=350){let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>{stats.cacheTimeouts++;reject(Error('Local detail cache timed out'));},ms);})]);}catch(e){stats.cacheFailures++;throw e;}finally{clearTimeout(timer);}}
async function hashBytes(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
async function verify(bytes,info,signal){guard(signal);if(bytes.byteLength!==info.bytes||await hashBytes(bytes)!==info.sha256)throw Error('表面资源完整性校验失败');guard(signal);return bytes;}
async function trim(store){
 const keys=await disk(store.keys());let total=0;const entries=[];
 for(const k of keys){const r=await disk(store.match(k));const n=Number(r?.headers.get('Content-Length'))||MAX_BYTES+1;total+=n;entries.push([k,n]);}
 while(entries.length>MAX_ENTRIES||total>MAX_BYTES){const [key,n]=entries.shift();await disk(store.delete(key));total-=n;}
}
export async function fetchDetail(info,{signal,onProgress,idleMS=7000,totalMS=30000}={}){
 guard(signal);
 if(!info||!Number.isSafeInteger(info.bytes)||info.bytes<=0||info.bytes>MAX_BYTES||!/^[a-f0-9]{64}$/.test(info.sha256)||!info.urls?.length)throw Error('无效的高清表面清单');
 const key=new URL('/__kaopu_hat_detail__/'+info.sha256,globalThis.location.origin==='null'?'https://htmlpreview.github.io':globalThis.location.origin).href;
 const hit=memory.get(key);if(hit){remember(key,hit);stats.memoryHits++;onProgress?.(hit.byteLength,hit.byteLength,'复用已下载原始表面');return hit;}
 let store=null;
 try{if(globalThis.caches)store=await waitWithSignal(disk(caches.open(CACHE)),signal);}catch{guard(signal);}
 if(store){
  try{const response=await waitWithSignal(disk(store.match(key)),signal);if(response){const bytes=await verify(await waitWithSignal(disk(response.arrayBuffer(),750),signal),info,signal);remember(key,bytes);stats.diskHits++;onProgress?.(bytes.byteLength,bytes.byteLength,'浏览器已保存');return bytes;}}
  catch{guard(signal);disk(store.delete(key)).catch(()=>{});}
 }
 let lastError=null,lastProgress=0;
 const progress=(n,stage,force=false)=>{const t=performance.now();if(force||t-lastProgress>=100||n===info.bytes){lastProgress=t;onProgress?.(n,info.bytes,stage);}};
 for(let attempt=0;attempt<info.urls.length;attempt++){
  guard(signal);if(attempt)stats.fallbacks++;
  const controller=new AbortController(),cancel=()=>controller.abort(signal.reason||aborted());signal?.addEventListener('abort',cancel,{once:true});
  let idle,timer,reader,complete=false;
  const arm=()=>{clearTimeout(idle);idle=setTimeout(()=>controller.abort(Error('高清表面等待超时')),idleMS);};
  timer=setTimeout(()=>controller.abort(Error('高清表面下载超时')),totalMS);arm();
  try{
   progress(0,attempt?'备用资源线路':'下载原始高清表面',true);stats.networkRequests++;
   const r=await fetch(info.urls[attempt],{signal:controller.signal,cache:'force-cache'});if(!r.ok)throw Error('表面资源HTTP '+r.status);
   reader=r.body.getReader();const chunks=[];let length=0;
   while(true){const {done,value}=await reader.read();if(done){complete=true;break;}guard(controller.signal);length+=value.byteLength;stats.networkBytes+=value.byteLength;if(length>info.bytes)throw Error('表面资源超出清单长度');chunks.push(value);arm();progress(length,'下载原始高清表面');}
   const result=new Uint8Array(length);let offset=0;for(const b of chunks){result.set(b,offset);offset+=b.byteLength;}
   const bytes=await verify(result.buffer,info,controller.signal);guard(signal);remember(key,bytes);
   if(store)writes=writes.catch(()=>{}).then(async()=>{await disk(store.put(key,new Response(bytes,{headers:{'Content-Type':'image/webp','Content-Length':String(bytes.byteLength)}})),750);await trim(store);}).catch(()=>{});
   return bytes;
  }catch(e){guard(signal);lastError=e;}
  finally{clearTimeout(idle);clearTimeout(timer);signal?.removeEventListener('abort',cancel);if(!complete){controller.abort();reader?.cancel().catch(()=>{});}}
 }
 throw lastError||Error('高清表面暂不可用');
}
