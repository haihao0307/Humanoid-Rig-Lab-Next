/* Retain the last committed complete person across an interrupted WebGL view.
 * Recovery stays in this tab's local session; no remote storage is used. */
(()=>{'use strict';
function create({canvas,key,snapshot,restore,locked}){
 const storageKey='body-source-r23/recovery/'+key,historyKey=storageKey+'/attempts',status=document.querySelector('#status'),reload=document.querySelector('#restore-view'),save=document.querySelector('#recover-person');let retained=null,interrupted=false;
 function download(){if(!retained?.archive)return;const url=URL.createObjectURL(new Blob([JSON.stringify(retained.archive,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='人物身体_R23_画面恢复前的完整档案.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function reloadView(){if(retained)try{sessionStorage.setItem(storageKey,JSON.stringify(retained));}catch(error){status.textContent='人物仍保留在当前页，请先下载暂存人物，再刷新画面。';return;}location.reload();}
 reload.addEventListener('click',reloadView);save.addEventListener('click',download);
 canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();if(interrupted)return;interrupted=true;retained={schema:'body-source-view-recovery/1',savedUTC:new Date().toISOString(),...snapshot()};locked();reload.hidden=false;save.hidden=false;status.textContent='三维画面暂时中断，人物设置已保留，正在恢复…';
  let saved=false,attempts=[];try{sessionStorage.setItem(storageKey,JSON.stringify(retained));saved=true;attempts=JSON.parse(sessionStorage.getItem(historyKey)||'[]').filter(t=>typeof t==='number'&&Date.now()-t<60000);sessionStorage.setItem(historyKey,JSON.stringify([...attempts,Date.now()]));}catch(error){status.textContent='三维画面暂时中断，请先下载暂存人物，再刷新画面。';}
  if(saved&&attempts.length===0)setTimeout(()=>location.reload(),250);else if(saved)status.textContent='画面再次中断，人物已暂存。可以下载人物或重新建立画面。';
 });
 async function resume(){let record;try{const raw=sessionStorage.getItem(storageKey);if(!raw)return{restored:false};record=JSON.parse(raw);if(record.schema!=='body-source-view-recovery/1'||!record.archive)throw Error('暂存人物格式不匹配');retained=record;await restore(record);sessionStorage.removeItem(storageKey);retained=null;reload.hidden=true;save.hidden=true;status.textContent='三维画面已恢复，完整人物、身体表面和观察位置已还原。';return{restored:true,savedUTC:record.savedUTC};}catch(error){retained=record;reload.hidden=false;save.hidden=!retained?.archive;status.textContent='画面已重新建立，暂存人物未能自动载入。请下载暂存人物，在参数工作页打开。';return{restored:false,error:error.message};}}
 return{resume,report:()=>({interrupted,hasRetainedPerson:!!retained,storage:'tab session only'})};
}
globalThis.BodyRecoveryR23={create};
})();
