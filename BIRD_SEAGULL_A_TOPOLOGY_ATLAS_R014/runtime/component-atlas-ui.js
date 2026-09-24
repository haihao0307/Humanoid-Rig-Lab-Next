(()=>{
'use strict';
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('R0.14 UI载入失败：'+src));document.body.appendChild(s)});
const decode=async b64=>{const raw=atob(b64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return await new Response(stream).text()};
(async()=>{
 window.__BIRD_R014_UI_PAYLOAD='';
 for(const src of ['./runtime/component-atlas-chunk-00.js','./runtime/component-atlas-chunk-01.js'])await load(src);
 const payload=window.__BIRD_R014_UI_PAYLOAD;
 if(typeof payload!=='string'||payload.length!==10672)throw new Error('R0.14 UI载荷长度不符');
 const source=await decode(payload);if(new TextEncoder().encode(source).length!==21501)throw new Error('R0.14 UI源码长度不符');
 (0,eval)(source);
 window.__BIRD_R014_UI_LOADER_QA={ready:true,payloadChars:payload.length,sourceBytes:21501};
})().catch(error=>{console.error(error);window.__BIRD_R014_QA={ready:false,error:error.message};const s=document.getElementById('status');if(s){s.textContent='R0.14 UI打开失败：'+error.message;s.className='status error'}});
})();
