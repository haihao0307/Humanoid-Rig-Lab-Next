(()=>{
'use strict';
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('脚本载入失败：'+src));document.body.appendChild(s)});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const decode=async b64=>{const raw=atob(b64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return await new Response(stream).text()};
(async()=>{
 await load('./runtime/contract-ui-r013.js');
 for(let i=0;i<2600;i++){
  if(window.__BIRD_QA?.ready===true&&window.__BIRD_R013_QA?.ready===true&&window.__BIRD_R013_API)break;
  if(i===2599)throw new Error('R0.13 冻结重放语料未就绪');
  await sleep(25);
 }
 const contractResponse=await fetch('./topology-contract.json',{cache:'no-store'});
 if(!contractResponse.ok)throw new Error('R0.14 合同载入失败 HTTP '+contractResponse.status);
 window.__BIRD_R014_CONTRACT=await contractResponse.json();
 window.__BIRD_R014_ATLAS_PAYLOAD='';
 for(const src of ['./data/topology-atlas-00.js','./data/topology-atlas-01.js','./data/topology-atlas-02.js','./data/topology-atlas-03.js'])await load(src);
 const payload=window.__BIRD_R014_ATLAS_PAYLOAD;
 if(typeof payload!=='string'||payload.length!==window.__BIRD_R014_CONTRACT.topology.atlasBase64Chars)throw new Error('R0.14 组件账载荷长度不符');
 window.__BIRD_R014_ATLAS=JSON.parse(await decode(payload));
 await load('./runtime/component-atlas-ui.js');
 window.__BIRD_R014_LOADER_QA={ready:true,version:'R0.14',payloadChars:payload.length};
})().catch(error=>{console.error(error);const s=document.getElementById('status');if(s){s.textContent='R0.14 打开失败：'+error.message;s.className='status error'}window.__BIRD_R014_LOADER_QA={ready:false,error:error.message};window.__BIRD_R014_QA={ready:false,error:error.message}});
})();
