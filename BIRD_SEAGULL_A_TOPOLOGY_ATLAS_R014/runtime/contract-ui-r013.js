(()=>{
'use strict';
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('脚本载入失败：'+src));document.body.appendChild(s)});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await load('./runtime/contract-ui-r012.js');
 for(let i=0;i<2400;i++){
  if(window.__BIRD_QA?.ready===true&&window.__BIRD_R012_QA?.ready===true&&window.__BIRD_R012_API)break;
  if(i===2399)throw new Error('R0.12 精确交接运行时未就绪');
  await sleep(25);
 }
 await load('./data/corpus-contract.js');
 const response=await fetch('./replay-corpus.json',{cache:'no-store'});
 if(!response.ok)throw new Error('R0.13 语料载入失败 HTTP '+response.status);
 window.__BIRD_R013_CORPUS=await response.json();
 await load('./runtime/replay-consumer.js');
 await load('./runtime/replay-corpus-ui.js');
 window.__BIRD_R013_LOADER_QA={ready:true,version:'R0.13'};
})().catch(error=>{console.error(error);const s=document.getElementById('status');if(s){s.textContent='R0.13 打开失败：'+error.message;s.className='status error'}window.__BIRD_R013_LOADER_QA={ready:false,error:error.message};window.__BIRD_R013_QA={ready:false,error:error.message}});
})();
