(()=>{
'use strict';
const load=src=>new Promise((resolve,reject)=>{
 const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;
 s.onerror=()=>reject(new Error('脚本载入失败：'+src));document.body.appendChild(s);
});
(async()=>{
 await load('./runtime/contract-ui-r008.js');
 await load('./data/channel-contract.js');
 await load('./runtime/channel-ui.js');
 window.__BIRD_R009_LOADER_QA={ready:true,version:'R0.09'};
})().catch(error=>{
 console.error(error);
 const status=document.getElementById('status');
 if(status){status.textContent='R0.09 打开失败：'+error.message;status.className='status error'}
 window.__BIRD_R009_LOADER_QA={ready:false,error:error.message};
 window.__BIRD_R009_QA={ready:false,error:error.message};
});
})();