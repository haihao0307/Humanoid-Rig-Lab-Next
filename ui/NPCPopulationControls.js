/* Task authoring calls the population API. It never writes a pose or advances time. */
function installNPCPopulationControls(lab,population){
 let doc=document,host=document.querySelector('.stage');
 try{const parentHost=window.parent!==window&&window.parent.document.querySelector('.body-pane');if(parentHost){doc=window.parent.document;host=parentHost;}}catch{}
 if(!host)return null;
 const style=doc.createElement('style');style.textContent=`
 .npc-population{position:absolute;z-index:12;top:12px;left:12px;width:min(400px,calc(100% - 24px));max-height:calc(100% - 24px);overflow:auto;border:1px solid #36534f;border-radius:12px;background:#112321f5;color:#e2eee9;box-shadow:0 8px 26px #0003;font:12px/1.5 system-ui,'Microsoft YaHei',sans-serif;padding:11px 13px;box-sizing:border-box}
 .npc-population summary{cursor:pointer;font-weight:650;list-style:revert;color:#d9ece3}.npc-population p{font-size:11px;color:#a8c1b6;margin:7px 0}.npc-population h3{font-size:14px;margin:0}.npc-population label{display:flex;gap:6px;align-items:center}
 .npc-population input,.npc-population textarea,.npc-population select,.npc-population button{font:inherit;color:inherit;border:1px solid #426058;border-radius:6px;background:#203a32;padding:6px 8px;min-width:0;box-sizing:border-box}.npc-population textarea{display:block;width:100%;min-height:132px;resize:vertical;line-height:1.65}.npc-population input[type=text]{flex:1}.npc-population button{cursor:pointer}.npc-population button:hover{background:#34574b}.npc-population button:disabled{opacity:.45;cursor:default}.npc-population .npc-pop-primary{background:#456e4f;border-color:#80ac86;font-weight:650}.npc-population :is(button,input,textarea,select):focus-visible{outline:2px solid #b8e7d4;outline-offset:2px}
 .npc-population .npc-pop-row{display:flex;align-items:center;gap:6px;margin:8px 0;flex-wrap:wrap}.npc-population .npc-pop-row>select{flex:1}.npc-population input[type=number]{width:62px}.npc-population .npc-pop-list{display:grid;gap:6px;margin:10px 0;max-height:250px;overflow:auto}.npc-population .npc-pop-person{display:flex;gap:7px;align-items:flex-start;border:1px solid #344f46;border-radius:7px;padding:8px}.npc-population .npc-pop-person[data-active=true]{border-color:#acd7bc;background:#254234}.npc-population .npc-pop-person>label{flex:1;min-width:0;align-items:flex-start}.npc-population .npc-pop-person input{margin-top:4px}.npc-population .npc-pop-person span{overflow-wrap:anywhere;flex:1}.npc-population .npc-pop-person small{display:block;color:#a9bfb4;font-size:10px;margin-top:3px}.npc-population .npc-pop-person[data-failed=true] small{color:#edb8a2}.npc-population progress{display:block;width:100%;height:5px;margin-top:6px;accent-color:#a6d5a7}.npc-population output{display:block;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere;color:#d3dfae;margin-top:8px}.npc-population .npc-pop-divider{border-top:1px solid #375249;padding-top:10px;margin-top:10px}.npc-population .npc-pop-muted{color:#9ab6a8;font-size:10px}.npc-population [hidden]{display:none!important}@media(max-width:580px){.npc-population{top:8px;left:8px;width:min(360px,calc(100% - 16px));max-height:calc(100% - 16px)}}`;
 doc.head.append(style);
 const panel=doc.createElement('details');panel.className='npc-population';panel.setAttribute('aria-label','NPC 人物与持续任务');
 panel.innerHTML=`<summary data-el="summary">NPC 生成与多人控制</summary>
 <p>选中人物后安排任务。每个人分别执行、计时和记录进度。</p>
 <div class="npc-pop-row"><button data-el="observePair" class="npc-pop-primary" type="button">开始双人长期观察</button><button data-el="overview" type="button">场景全景</button><button data-el="followCurrent" type="button">跟随当前人物</button></div>
 <p>前两人分别循环巡逻与搬箱归还，自动记录性能；发现错误会保留原因，可停止后修改。</p>
 <div data-el="list" class="npc-pop-list"></div>
 <div class="npc-pop-row"><button data-el="viewAll" type="button">查看全体</button><button data-el="selectAll" type="button">全选</button><button data-el="selectNone" type="button">取消选择</button><select data-el="target" aria-label="任务对象"><option value="selected">已选人物</option><option value="all">全体人物</option></select></div>
 <details data-el="editor" class="npc-pop-divider" aria-label="持续任务编辑器" open><summary>持续任务与示例</summary>
 <div class="npc-pop-row"><select data-el="preset" aria-label="任务示例"></select><button data-el="usePreset" type="button">填入示例</button><button data-el="loadTask" type="button">读取当前任务</button></div>
 <div class="npc-pop-row"><input data-el="title" type="text" maxlength="80" aria-label="任务名称" placeholder="任务名称" value="原地值守"></div>
 <textarea data-el="command" rows="6" maxlength="16000" aria-label="持续任务步骤" spellcheck="false" placeholder="每行一个步骤，例如：&#10;走到集合场&#10;等待 15 秒&#10;打招呼&#10;走到门岗交接&#10;等待 30 秒"></textarea>
 <div data-el="preview" class="npc-pop-muted"></div>
 <p>按顺序执行，可写行走、转向、手势、坐卧、搬运和等待。搬运示例包含归还步骤，可反复循环。</p>
 <div class="npc-pop-row"><select data-el="limit" aria-label="持续任务结束条件"><option value="forever">持续到手动停止</option><option value="duration">持续指定时长</option><option value="cycles">执行指定轮数</option></select><label data-el="durationLabel" hidden><input data-el="duration" type="number" min="1" max="1440" value="10" aria-label="持续分钟">分钟</label><label data-el="cyclesLabel" hidden><input data-el="cycles" type="number" min="1" max="10000" value="5" aria-label="执行轮数">轮</label></div>
 <div class="npc-pop-row"><label>每轮间隔<input data-el="interval" type="number" min="1" max="3600" value="5" aria-label="每轮间隔秒">秒</label><button data-el="applyBehavior" class="npc-pop-primary" type="button">开始持续任务</button><button data-el="runOnce" type="button">只执行一轮</button></div>
 </details><div class="npc-pop-row"><button data-el="pause" type="button">暂停</button><button data-el="resume" type="button">继续</button><button data-el="stop" type="button">停止任务</button></div>
 <p>暂停保留当前步骤和剩余等待时间；停止会清空后续步骤。关闭此面板不影响任务，关闭或刷新页面会结束运行。</p>
 <output data-el="status" role="status" aria-live="polite"></output>
 <details class="npc-pop-divider" open><summary>动作与性能记录</summary><output data-el="performance"></output><div class="npc-pop-row"><button data-el="recordStart" type="button">开始新记录</button><button data-el="recordStop" type="button">结束记录</button><button data-el="recordExport" type="button">导出记录</button><button data-el="recordPrevious" type="button">导出上次记录</button></div><p>每秒采样，保留最近 30 分钟；自动保存最近 2 分钟以便刷新后找回。CPU 是主线程耗时，GPU 和内存是全场景读数；不可用项显示“—”。</p></details>
 <details class="npc-pop-divider"><summary>单次指令与追加</summary><div class="npc-pop-row"><input data-el="single" type="text" maxlength="4096" aria-label="单次动作指令" placeholder="例如：向前走 1 米"></div><div class="npc-pop-row"><select data-el="mode" aria-label="单次任务加入方式"><option value="replace">替换任务</option><option value="append">追加任务</option></select><button data-el="dispatch" type="button">执行指令</button></div></details>
 <details class="npc-pop-divider"><summary>生成人物与保存配方</summary><div class="npc-pop-row"><select data-el="definition" aria-label="新增角色定义"></select><label>人数<input data-el="count" type="number" min="1" max="4" value="1"></label><button data-el="spawn" type="button">生成</button></div><div class="npc-pop-row"><button data-el="remove" type="button">移除当前人物</button><button data-el="export" type="button">导出人口配方</button><button data-el="import" type="button">导入并添加</button><input data-el="file" hidden type="file" accept=".json,application/json"></div><p>配方包含每个人的持续任务设置；导入后手动开始，不会自动恢复动作。</p></details>`;
 host.append(panel);const el=name=>panel.querySelector('[data-el="'+name+'"]');let busy=false,definitionSignature='';const cards=new Map();
 const draftKey='humanlab.npc.task-draft@1',fields=['title','command','limit','duration','cycles','interval'];
 const presets=NPC_LONG_TASKS;
 for(const [id,preset]of Object.entries(presets)){const option=doc.createElement('option');option.value=id;option.textContent=preset.title;el('preset').append(option);}
 el('command').value=presets.guard.command;
 try{const saved=JSON.parse(localStorage.getItem(draftKey)||'null');if(saved&&typeof saved.command==='string'&&saved.command.length<=NPC_TASK_TEXT_LIMIT)for(const key of fields)if(typeof saved[key]==='string'&&saved[key].length<=(key==='command'?NPC_TASK_TEXT_LIMIT:80))el(key).value=saved[key];}catch{}
 if(!el('limit').value)el('limit').value='forever';
 function report(message){el('status').textContent=message;}
 function saveDraft(){try{localStorage.setItem(draftKey,JSON.stringify(Object.fromEntries(fields.map(key=>[key,el(key).value]))));}catch{}}
 function preview(){
  el('durationLabel').hidden=el('limit').value!=='duration';el('cyclesLabel').hidden=el('limit').value!=='cycles';
  try{const steps=npcCompileTask(el('command').value,lab.world,population.active.agent.lastObject);el('preview').textContent=steps.length+' 个步骤 · '+el('command').value.length+' / 16000 字';}catch(error){el('preview').textContent=error.message;}
 }
 function targetIds(){return population.list().filter(row=>el('target').value==='all'||row.selected).map(row=>row.id);}
 function outcomes(result){const rows=Array.isArray(result)?result:result?.results;if(!Array.isArray(rows))return result?.message||'操作已提交。';return rows.map(row=>(population.actors.get(row.id)?.label||row.label||row.instanceId||row.id||'人物')+'：'+(row.accepted===false||row.ok===false?row.reason||row.error||'未接收':row.requiresRelease?'已暂停并保留抓握，请继续完成放置':row.reason||'已接收')).join('\n');}
 async function run(action){if(busy)return;busy=true;render();try{await action();}catch(error){report(error.message||String(error));}finally{busy=false;render();}}
 const time=value=>{const seconds=Math.max(0,Math.floor(value||0));return Math.floor(seconds/60)+'分'+String(seconds%60).padStart(2,'0')+'秒';};
 function taskStatus(row){
  const b=row.behavior;if(row.error||b.error)return'已阻断 · '+(row.error||b.error);
  const checking=row.preflight?.status==='checking'?'保持姿态，检查后续动作':null;
  if(b.type!=='repeat'||!b.stepCount)return row.status==='paused'?'已暂停':checking||({idle:'等待任务',running:'正在执行单次任务',failed:'已阻断'})[row.status]||row.status;
  const status=row.status==='paused'?'已暂停':checking||({scheduled:'待开始',resourceWait:'等待搬运通道空闲',running:'执行中',waiting:'等待 '+Math.ceil(b.waitRemainingS)+' 秒',interval:'下轮开始前 '+Math.ceil(b.waitRemainingS)+' 秒',finishing:'到时，等待当前动作收尾',completed:'已完成',stopped:'已停止',idle:'已载入，尚未开始',failed:'已阻断'})[b.status]||b.status;
  return b.title+' · '+status+'\n已完成 '+b.cycles+(b.cycleLimit?'/'+b.cycleLimit:'')+' 轮 · 已运行 '+time(b.elapsedS)+(b.durationS?' / '+time(b.durationS):'')+(b.enabled?'\n第 '+(b.stepIndex+1)+'/'+b.stepCount+' 步：'+b.currentStep:'');
 }
 function render(){
  const rows=population.list(),definitions=lab.npc.list(),nextDefinitions=JSON.stringify(definitions.map(row=>[row.id,row.label]));
  if(nextDefinitions!==definitionSignature){definitionSignature=nextDefinitions;const prior=el('definition').value;el('definition').replaceChildren();for(const row of definitions){const option=doc.createElement('option');option.value=row.id;option.textContent=row.label;el('definition').append(option);}if(definitions.some(row=>row.id===prior))el('definition').value=prior;}
  el('summary').textContent='NPC 生成与多人控制 · '+rows.length+' 人 · 已选 '+rows.filter(row=>row.selected).length;
  for(const [id,card]of cards)if(!rows.some(row=>row.id===id)){card.item.remove();cards.delete(id);}
  for(const row of rows){let card=cards.get(row.id);if(!card){
   const item=doc.createElement('div');item.className='npc-pop-person';const label=doc.createElement('label'),checkbox=doc.createElement('input'),name=doc.createElement('span'),title=doc.createElement('b'),small=doc.createElement('small'),progress=doc.createElement('progress'),activate=doc.createElement('button');
   checkbox.type='checkbox';checkbox.onchange=()=>run(async()=>{population.select(population.list().filter(person=>person.id===row.id?checkbox.checked:person.selected).map(person=>person.id));});small.style.whiteSpace='pre-wrap';name.append(title,small,progress);label.append(checkbox,name);activate.type='button';activate.onclick=()=>run(async()=>{await population.activate(row.id);report('当前人物：'+population.get(row.id).label);});item.append(label,activate);el('list').append(item);card={item,checkbox,title,small,progress,activate};cards.set(row.id,card);
  }
   card.item.dataset.active=String(row.active);card.item.dataset.failed=String(!!(row.error||row.behavior.error));card.checkbox.checked=row.selected;card.checkbox.disabled=busy;card.checkbox.setAttribute('aria-label','选择 '+row.label);card.title.textContent=row.label;card.small.textContent=taskStatus(row);card.activate.textContent=row.active?'当前人物':'设为当前';card.activate.dataset.current=String(row.active);
   card.progress.hidden=!row.behavior.enabled;card.progress.max=row.behavior.stepCount||1;card.progress.value=row.behavior.stepIndex;card.progress.setAttribute('aria-label',row.label+' 的本轮任务进度');
  }
  for(const button of panel.querySelectorAll('button'))button.disabled=busy||button.dataset.current==='true';
  el('spawn').disabled=busy||rows.length+population.pending>=NPC_INSTANCE_LIMIT;el('remove').disabled=busy||rows.length<=1;
  const recorder=population.observation,s=recorder.latest,number=(v,d=1)=>Number.isFinite(v)?v.toFixed(d):'—',mb=v=>Number.isFinite(v)?(v/1048576).toFixed(1)+' MB':'—';
  el('performance').textContent=(recorder.recording?'正在记录':'记录已停止')+' · '+recorder.samples.length+' 个采样 · '+recorder.events.length+' 个事件'+(s?'\nFPS '+number(s.fps)+' · 帧间隔 P95 '+number(s.p95FrameMs)+' ms\n主循环 CPU '+number(s.meanLoopCpuMs)+' ms · 渲染 CPU '+number(s.renderCpuMs)+' ms\nGPU '+number(s.gpuMs)+' ms · JS 堆 '+mb(s.jsHeapBytes)+'\n几何缓冲 '+mb(s.geometryGPUBytes)+' · 绘制 '+number(s.drawCalls,0)+' 次\n'+s.actors.map(a=>a.label+'：CPU '+number(a.cpuMsPerWallSecond)+' ms/秒 · 动作完成 '+a.completedActions+' · '+a.cycles+' 轮').join('\n'):'\n开始任务后自动采样。')+(recorder.storageError?'\n本地保存失败，请导出记录：'+recorder.storageError:'');
  el('recordPrevious').disabled=busy||!recorder.previous;el('recordStart').disabled=busy||recorder.recording;el('recordStop').disabled=busy||!recorder.recording;
 }
 for(const key of fields)el(key).addEventListener('input',()=>{saveDraft();preview();});
 el('usePreset').onclick=()=>{const preset=presets[el('preset').value];el('title').value=preset.title;el('command').value=preset.command;saveDraft();preview();report('示例已填入，可编辑后开始。');};
 el('loadTask').onclick=()=>{const b=population.active.behavior;if(!b.command){report('当前人物尚未保存持续任务。');return;}el('title').value=b.title;el('command').value=b.command;el('interval').value=b.intervalS;el('limit').value=b.durationS?'duration':b.cycleLimit?'cycles':'forever';el('duration').value=b.durationS?b.durationS/60:10;el('cycles').value=b.cycleLimit||5;saveDraft();preview();report('已载入 '+population.active.label+' 的任务设置。');};
 async function start(once=false){const ids=targetIds();if(!ids.length)throw Error('请先选择人物。');const limit=el('limit').value,minutes=Number(el('duration').value),rounds=Number(el('cycles').value);
  if(!once&&limit==='duration'&&(!Number.isFinite(minutes)||minutes<1||minutes>1440))throw Error('持续时长须为 1–1440 分钟');
  if(!once&&limit==='cycles'&&(!Number.isInteger(rounds)||rounds<1||rounds>10000))throw Error('执行轮数须为 1–10000');
  const input={type:'repeat',title:el('title').value,command:el('command').value,intervalS:Number(el('interval').value),cycleLimit:once?1:limit==='cycles'?rounds:0,durationS:!once&&limit==='duration'?minutes*60:0},results=[];
  for(const id of ids){try{await population.setBehavior(id,input);results.push({id,accepted:true,reason:once?'已开始执行一轮':'持续任务已开始'});}catch(error){results.push({id,accepted:false,reason:error.message});}}
  report(outcomes(results));saveDraft();
 }
 el('applyBehavior').onclick=()=>run(()=>start());el('runOnce').onclick=()=>run(()=>start(true));
 el('observePair').onclick=()=>run(async()=>{report(outcomes(population.observation.startPair()));el('target').value='all';el('editor').open=false;});
 el('overview').onclick=()=>{lab.focus('field');lab.render();};
 el('followCurrent').onclick=()=>{population.focus(population.activeId);lab.setCameraFollow(true);lab.render();};
 function downloadRecord(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=doc.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 el('recordStart').onclick=()=>run(async()=>{population.observation.start();report('已开始新的性能记录。');});el('recordStop').onclick=()=>run(async()=>{population.observation.stop();report('记录已保存，人物任务继续执行。');});
 el('recordExport').onclick=()=>run(async()=>{downloadRecord(population.observation.report(),'npc-observation.json');report('已导出性能采样、动作事件、任务配方和起始场景。');});el('recordPrevious').onclick=()=>run(async()=>downloadRecord(population.observation.previous,'npc-observation-previous.json'));
 el('command').onkeydown=event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.isComposing){event.preventDefault();el('applyBehavior').click();}};
 for(const action of ['pause','resume','stop'])el(action).onclick=()=>run(async()=>{report(outcomes(await population.control(action,el('target').value)));});
 el('viewAll').onclick=()=>population.focus('all');el('selectAll').onclick=()=>run(async()=>{population.select(population.list().map(row=>row.id));});el('selectNone').onclick=()=>run(async()=>{population.select([]);});
 el('dispatch').onclick=()=>run(async()=>{const text=el('single').value.trim();if(!text)throw Error('请先填写单次指令。');report(outcomes(await population.dispatch(text,{targets:el('target').value,mode:el('mode').value})));});
 el('single').onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();el('dispatch').click();}};
 el('spawn').onclick=()=>run(async()=>{const count=Number(el('count').value);if(!Number.isInteger(count)||count<1||count>4)throw Error('每次生成 1 至 4 人。');if(population.actors.size+population.pending+count>NPC_INSTANCE_LIMIT)throw Error('当前最多支持 8 人。');let created=0;try{for(let i=0;i<count;i++){await population.spawn(el('definition').value);created++;}report('已生成 '+created+' 人。');}catch(error){throw Error('已生成 '+created+' 人；'+error.message);}});
 el('remove').onclick=()=>run(async()=>{const active=population.active;await population.remove(active.id);report('已移除 '+active.label+'。');});
 el('export').onclick=()=>run(async()=>{const recipe=population.exportScene(),url=URL.createObjectURL(new Blob([JSON.stringify(recipe,null,2)],{type:'application/json'})),link=doc.createElement('a');link.href=url;link.download='npc-population.recipe.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);report('已导出人物、站位与持续任务设置。');});
 el('import').onclick=()=>el('file').click();el('file').onchange=()=>run(async()=>{try{const file=el('file').files?.[0];if(!file)return;if(file.size>2097152)throw Error('人口配方文件不能超过 2 MB。');await population.importScene(JSON.parse(await file.text()));report('已添加人物和任务设置，任务尚未开始。');}finally{el('file').value='';}});
 window.addEventListener('humanlab:population-change',render);const timer=setInterval(()=>{if(panel.open)render();},500);window.addEventListener('beforeunload',()=>clearInterval(timer),{once:true});panel.addEventListener('toggle',render);preview();render();return{panel,render};
}
