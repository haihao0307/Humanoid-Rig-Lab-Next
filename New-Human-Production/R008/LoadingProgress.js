// Plain bootstrap: visible before the module graph and heavy generation begin.
(()=>{
 const $=id=>document.getElementById(id),started=performance.now();let value=0,finished=false,lastProgress=started;
 const history=[];
 function tick(){const elapsed=(performance.now()-started)/1000,silence=(performance.now()-lastProgress)/1000;$('loadingElapsed').textContent=`已用 ${elapsed.toFixed(0)} 秒`;
  if(!finished)$('loadingActivity').textContent=silence>30?'当前阶段超过 30 秒未报告新进度；可能仍在计算或等待，可继续等待或重新加载。':'正在加载 / 计算；阶段进度只随实际完成的工作更新。';}
 function set({percent,stage,detail=''}){if(finished)return;value=Math.max(value,Math.min(100,Number(percent)||0));lastProgress=performance.now();history.push({percent:value,stage,detail,elapsedMS:performance.now()-started});$('loadingBar').value=value;$('loadingPercent').textContent=Math.floor(value)+'%';$('loadingStage').textContent=stage;$('loadingDetail').textContent=detail;tick();}
 function fail(error){if(finished)return;finished=true;clearInterval(timer);$('loadingOverlay').classList.add('failed');$('loadingStage').textContent='加载失败';$('loadingDetail').textContent=error?.message||String(error);$('loadingActivity').textContent='已停止加载，请重新加载页面。';$('loadingRetry').hidden=false;tick();}
 function done(){if(finished)return;set({percent:100,stage:'人物加载完成',detail:'工作台已可操作'});finished=true;clearInterval(timer);$('loadingOverlay').hidden=true;}
 const timer=setInterval(tick,500);$('loadingRetry').onclick=()=>location.reload();
 window.HumanLoading={set,fail,done,history,get percent(){return value},get finished(){return finished},get elapsedMS(){return performance.now()-started}};
 addEventListener('error',event=>{if(!finished){const target=event.target;if(target?.tagName==='SCRIPT')fail(Error('工作台脚本加载失败：'+target.src));else if(event.error)fail(event.error);}},true);
 addEventListener('unhandledrejection',event=>{if(!finished)fail(event.reason);});
 set({percent:0,stage:'准备加载人物',detail:'读取工作台程序…'});
})();
