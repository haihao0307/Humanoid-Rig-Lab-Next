import {guard,aborted} from './worker-client.mjs';
const CACHE='kaopu-hat-detail-v8';
export async function fetchDetail(info,{signal,onProgress,idleMS=7000,totalMS=30000}={}){
 guard(signal);const key=info.urls[0];
 let store=null;
 try{if(globalThis.caches)store=await caches.open(CACHE);}catch{}
 async function valid(response){const b=await response.arrayBuffer();guard(signal);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==info.sha256)throw Error('表面资源完整性校验失败');return b;}
 if(store){try{const hit=await store.match(key);if(hit){const bytes=await valid(hit);onProgress?.(bytes.byteLength,bytes.byteLength,'浏览器已保存');return bytes;}}catch(e){guard(signal);await store.delete(key).catch(()=>{});}}
 let lastError=null;
 for(let attempt=0;attempt<info.urls.length;attempt++){
  guard(signal);const controller=new AbortController(),cancel=()=>controller.abort(signal.reason||aborted());signal?.addEventListener('abort',cancel,{once:true});
  let idle,timer;const arm=()=>{clearTimeout(idle);idle=setTimeout(()=>controller.abort(new Error('表面资源连续7秒无响应')),idleMS);};
  timer=setTimeout(()=>controller.abort(new Error('表面资源下载超过30秒')),totalMS);arm();
  try{
   onProgress?.(0,info.bytes,attempt?'备用资源线路':'下载原始高清表面');
   const r=await fetch(info.urls[attempt],{signal:controller.signal,cache:'force-cache'});if(!r.ok)throw Error('表面资源HTTP '+r.status);
   const reader=r.body.getReader(),chunks=[];let length=0;
   while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>info.bytes+1024)throw Error('表面资源大小超出清单');chunks.push(value);arm();onProgress?.(length,info.bytes,'下载原始高清表面');}
   const result=new Uint8Array(length);let offset=0;for(const b of chunks){result.set(b,offset);offset+=b.byteLength;}
   const bytes=await valid(new Response(result));
   if(store)store.put(key,new Response(bytes,{headers:{'Content-Type':'image/webp'}})).catch(()=>{});
   return bytes;
  }catch(e){guard(signal);lastError=e;}
  finally{clearTimeout(idle);clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }
 throw lastError||new Error('高清表面暂不可用');
}
