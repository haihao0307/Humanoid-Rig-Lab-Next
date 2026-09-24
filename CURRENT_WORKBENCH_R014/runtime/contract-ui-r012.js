(()=>{
'use strict';
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('脚本载入失败：'+src));document.body.appendChild(s)});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await load('./runtime/contract-ui-r011.js');
 for(let i=0;i<2000;i++){
  if(window.__BIRD_QA?.ready===true&&window.__BIRD_R011_QA?.ready===true&&window.__BIRD_R011_API&&window.__BIRD_R010_API)break;
  if(i===1999)throw new Error('R0.11 相位时钟未就绪');
  await sleep(25);
 }
 await load('./data/handoff-contract.js');
 await load('./runtime/handoff-ui.js');
 window.__BIRD_R012_LOADER_QA={ready:true,version:'R0.12'};
})().catch(error=>{console.error(error);const s=document.getElementById('status');if(s){s.textContent='R0.12 打开失败：'+error.message;s.className='status error'}window.__BIRD_R012_LOADER_QA={ready:false,error:error.message};window.__BIRD_R012_QA={ready:false,error:error.message}});
})();
