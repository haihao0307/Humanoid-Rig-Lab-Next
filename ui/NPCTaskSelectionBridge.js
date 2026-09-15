/* Checkbox selection is the single source of truth for population task targets.
 * This module wraps the existing population panel without creating another
 * queue, active actor, task clock or body authority. Add it to assembly only
 * after the full-source build can be regenerated and checked. */
function npcTaskSelectedRows(population){
 return population.list().filter(row=>row.selected);
}
function npcTaskRecipientText(population){
 const selected=npcTaskSelectedRows(population);
 return selected.length
  ?'任务接收者（'+selected.length+'）：'+selected.map(row=>row.label).join('、')
  :'任务接收者：尚未勾选人物';
}
function installNPCTaskSelectionBridge(baseInstall=installNPCPopulationControls){
 if(typeof baseInstall!=='function')throw Error('NPC 人口控制面板尚未安装');
 return function installTaskSelectionControls(lab,population){
  const installed=baseInstall(lab,population),panel=installed?.panel;
  if(!panel||panel.dataset.taskSelectionBridge==='1')return installed;
  panel.dataset.taskSelectionBridge='1';
  const doc=panel.ownerDocument||document,target=panel.querySelector('[data-el="target"]'),selectNone=panel.querySelector('[data-el="selectNone"]'),row=selectNone?.parentElement;
  // Keep the legacy element for compatibility with the existing event
  // handlers, but remove the second, conflicting task-scope state from UI.
  if(target){target.value='selected';target.hidden=true;target.tabIndex=-1;target.setAttribute('aria-hidden','true');}
  const recipients=doc.createElement('div');recipients.className='npc-pop-muted';recipients.setAttribute('data-el','taskRecipients');
  const onlyCurrent=doc.createElement('button');onlyCurrent.type='button';onlyCurrent.textContent='仅当前人物';onlyCurrent.setAttribute('data-el','selectCurrent');
  const invert=doc.createElement('button');invert.type='button';invert.textContent='反选';invert.setAttribute('data-el','invertSelection');
  if(row){row.append(onlyCurrent,invert);row.insertAdjacentElement('afterend',recipients);}else panel.append(recipients);
  const sync=()=>{if(target)target.value='selected';recipients.textContent=npcTaskRecipientText(population);};
  onlyCurrent.onclick=()=>{population.select([population.activeId]);sync();};
  invert.onclick=()=>{const selected=new Set(npcTaskSelectedRows(population).map(item=>item.id));population.select(population.list().filter(item=>!selected.has(item.id)).map(item=>item.id));sync();};
  panel.addEventListener('change',()=>queueMicrotask(sync));
  panel.addEventListener('click',()=>queueMicrotask(sync));
  window.addEventListener('humanlab:population-change',sync);
  sync();
  return{...installed,syncTaskRecipients:sync};
 };
}

if(typeof globalThis!=='undefined'){
 Object.defineProperties(globalThis,{
  npcTaskSelectedRows:{value:npcTaskSelectedRows,configurable:true},
  npcTaskRecipientText:{value:npcTaskRecipientText,configurable:true},
  installNPCTaskSelectionBridge:{value:installNPCTaskSelectionBridge,configurable:true}
 });
}
