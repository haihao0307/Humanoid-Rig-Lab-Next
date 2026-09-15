/* Active-resident routine adapter. The population host stores an independent
 * context and bounded memory for every body instance. No direct pose writes. */
const nrCatalog=window.JarvisNPCRoutineCatalog;
function nrFreshInstance(){return{enabled:false,starting:false,flight:false,owner:null,epoch:0,role:null,identity:null,mode:'auto',taskId:null,kind:null,routineId:null,phases:[],phase:'stopped',stopAfterCycle:false,recovery:null,recovering:false,blocks:{},lastCompleted:{},events:[],message:'按身份选择日常，再启动持续循环。',timer:null,signature:'',memory:{}};}
const nr=nrFreshInstance();
const NR_MEMORY_KEY='jarvis.npc-routine-memory.v1';
function nrInstanceMemoryKey(){return NR_MEMORY_KEY+'.'+(state.activeInstanceId||EMBODIMENT_ID);}
function nrLoadInstanceMemory(){nr.memory={};try{const saved=JSON.parse(localStorage.getItem(nrInstanceMemoryKey())||'null');for(const n of nrCatalog.data.residents){const m=saved?.[n.id];nr.memory[n.id]={cycles:Number.isSafeInteger(m?.cycles)?Math.max(0,Math.min(1e9,m.cycles)):0,lastRoutine:nrCatalog.recipe(m?.lastRoutine)?.role===n.role?m.lastRoutine:null};}}catch{}}
function nrRestoreInstance(saved=null){const timer=nr.timer,epoch=nr.epoch+1;Object.assign(nr,saved||nrFreshInstance(),{timer,epoch,signature:''});if(!saved)nrLoadInstanceMemory();}
nrLoadInstanceMemory();
function nrRemember(){try{localStorage.setItem(nrInstanceMemoryKey(),JSON.stringify(nr.memory));}catch{}}
function nrLog(kind,message,extra={}){nr.events.push({at:Date.now(),kind,message,...extra});if(nr.events.length>48)nr.events.shift();nr.message=message;renderNPCRoutines();}
function nrIdentity(){return JSON.stringify([residentProfile.residentId,residentProfile.role,residentProfile.displayName,residentProfile.revision]);}
function nrWorld(){return campLab()?.routines?.snapshot()||null;}
function nrTime(){return nrWorld()?.elapsedS||0;}
function nrStudio(lab){return ['lowerLimb','headNeck','torso','shoulders','hands'].some(k=>lab?.[k]?.active)||lab?.hair?.demo;}
function nrBusy(){const a=campLab()?.agent;return !!(languageState.current||languageState.queue.length||languageState.draining||languageState.submitting||languageState.confirmation||languageState.pending||a?.activity().physicalBusy);}
function nrRoleRecipes(){return nrCatalog.data.routines.filter(r=>r.role===(nr.role||residentProfile.role));}
function nrMemory(){const npc=nrCatalog.resident(nr.role||residentProfile.role);return npc?(nr.memory[npc.id]||(nr.memory[npc.id]={cycles:0,lastRoutine:null})):null;}
function nrMissing(r,w,kind='cycle'){const ids=new Set([...(w.objects||[]),...(w.zones||[])].map(o=>o.id));return nrCatalog.required(r.id,r.role,kind).filter(id=>!ids.has(id));}
function nrPlan(r,kind,w){
 const built=nrCatalog.build(r?.id,nr.role,kind),finalEffects=new Map();
 for(const s of built.steps)if(s.type==='carry')finalEffects.set(s.objectId,{objectId:s.objectId,targetId:s.targetId,relation:'inside'});
 return{schema:'jarvis/semantic_plan@1.0',id:uid('npc_cycle'),sourceText:built.title,worldRevision:w.revision,sceneId:w.sceneId,engine:'npc-routine@1',status:'ready',mode:'append',
  nodes:built.steps.map((step,i)=>({kind:'action',id:'npc_step_'+(i+1),step})),summary:built.phases.map(p=>p.title),constraints:{protectedIds:w.objects.filter(o=>o.movable===false).map(o=>o.id),collisionAvoidance:true,forbiddenActions:[]},
  grounding:[],assumptions:[],questions:[],contextAfter:null,requiredEffects:[...finalEffects.values()],groundedIntent:{kind:'npc-routine',selectedIds:[...new Set(built.steps.flatMap(s=>[s.objectId,s.targetId].filter(Boolean)))]},
  routine:{owner:nr.owner,routineId:r?.id||null,role:nr.role,kind,home:built.home,phases:built.phases.map(p=>({title:p.title,count:p.steps.length}))}};
}
async function nrDispatch(r,kind,epoch){
 const result=await commandArbiter.schedule('append',async token=>{
  token.assert();if(epoch!==nr.epoch||!nr.enabled)throw new window.JarvisCommandArbiter.StaleCommandError();
  const w=await freshWorld(token);token.assert();
  if(epoch!==nr.epoch||!nr.enabled||nrBusy())throw new window.JarvisCommandArbiter.StaleCommandError('日常调度已让出控制');
  if(w.theme!=='camp'||!w.routines)throw Error('日常环境已改变');
  if(kind!=='rest'){const missing=nrMissing(r,w,kind);if(missing.length)throw Error('缺少工作点或工具：'+missing.join('、'));}
  const plan=nrPlan(r,kind,w),check=Lang.validatePlan(plan,w,state.capabilities);if(!check.ok)throw Error(check.errors.join('；'));
  const task=await enqueueSemantic(plan,{token,inputId:uid('npc_input'),modality:'npc-routine'});
  if(epoch!==nr.epoch||!nr.enabled)return{stale:true};
  nr.taskId=task.id;nr.kind=kind;nr.routineId=r?.id||null;nr.phases=plan.routine.phases;nr.phase=kind==='rest'?'resting':kind==='recovery'?'recovering':'running';
  nrLog('started',plan.sourceText,{taskId:task.id,routineId:nr.routineId,kind});return{dispatched:true,taskId:task.id};
 });return result;
}
function nrBlock(r,error){
 const prior=nr.blocks[r.id],attempts=Math.min(6,(prior?.attempts||0)+1),delay=Math.min(600,30*2**(attempts-1));
 nr.blocks[r.id]={attempts,until:nrTime()+delay,revision:campLab()?.world?.revision,reason:error.message};
 nrLog('blocked',r.title+'暂不可行：'+error.message,{routineId:r.id,retryAfterSeconds:delay});
}
async function nrRelease(message='持续日常已结束'){const owner=nr.owner;nr.enabled=false;nr.owner=null;nr.taskId=null;nr.heldTaskId=null;nr.recovery=null;nr.stopAfterCycle=false;nr.phase='stopped';if(owner)await requestBody('routine.release',{owner});nrRemember();nrLog('stopped',message);}
async function nrTakeover(message='已交给手动任务，本轮不计入完成轮次'){
 ++nr.epoch;nr.taskId=null;nr.recovery=null;return nrRelease(message);
}
async function startNPCRoutines(mode='auto'){
 if(nr.enabled||nr.starting||nr.flight)throw Error('持续日常已开启或正在收尾');
 const npc=nrCatalog.resident(residentProfile.role);if(!npc)throw Error('请先选择士兵、军官或农民身份');
 if(!nrCatalog.data.routines.some(r=>r.role===npc.role&&nrCatalog.motionAvailable(r)))throw Error('该身份的工作动作尚缺实测来源，可先使用步行、坐卧和挥手指令');
 if(mode!=='auto'&&!nrCatalog.motionAvailable(nrCatalog.recipe(mode)))throw Error('这项日常需要尚未接入的实测动作');
 if(mode!=='auto'&&nrCatalog.recipe(mode)?.role!==npc.role)throw Error('所选日常不属于当前身份');
 if(!state.bodyReady||!state.brainReady||nrBusy()||languageState.paused)throw Error('请先完成当前任务、解除暂停，等待人物就绪');
 if(nrStudio(campLab()))throw Error('请先退出部位编辑或毛发展示，再开始日常');
 const epoch=++nr.epoch,owner=uid('npc_session');nr.starting=true;nr.owner=owner;nr.phase='preparing';renderNPCRoutines();
 try{return await commandArbiter.schedule('append',async token=>{
  const w=await freshWorld(token);token.assert();if(epoch!==nr.epoch||nrBusy())throw Error('日常准备已被其他任务打断');
  if(w.theme!=='camp')throw Error('请先切换到军营与邻村');
  if(languageState.paused)throw Error('日常准备期间已暂停');
  await awaitInput(requestBody('routine.prepare'),token);token.assert();
  await awaitInput(requestBody('routine.reserve',{owner,identity:{presetId:npc.id,role:npc.role,displayName:residentProfile.displayName}}),token);token.assert();
  if(epoch!==nr.epoch)throw Error('日常准备已取消');
  nr.enabled=true;nr.role=npc.role;nr.identity=nrIdentity();nr.mode=mode;nr.blocks={};nr.lastCompleted={};nr.stopAfterCycle=false;nr.recovery=null;nr.recovering=false;nr.phase='ready';
  nrLog('enabled',residentProfile.displayName+'的持续日常已开启；每轮完成后验收，再安排下一轮。');return{dispatched:true,loopEnabled:true};
 });}catch(error){if(epoch===nr.epoch){nr.enabled=false;nr.owner=null;nr.phase='stopped';}await requestBody('routine.release',{owner}).catch(()=>{});throw error;
 }finally{nr.starting=false;if(!nr.enabled){await requestBody('routine.release',{owner}).catch(()=>{});if(nr.owner===owner)nr.owner=null;}renderNPCRoutines();}
}
async function stopNPCRoutines(){
 if(!nr.enabled&&!nr.starting)return{stopped:true};
 if(nr.starting)return nrTakeover('日常准备已取消');
 nr.stopAfterCycle=true;nrLog('stop_requested',nr.taskId?'完成当前一轮并归位后结束循环。':'正在结束日常循环。');
 if(!nr.taskId&&!nr.flight)await nrRelease();return{stopAfterCycle:true};
}
async function nrFinishTask(task,epoch){
 const r=nrCatalog.recipe(nr.routineId),kind=nr.kind;nr.taskId=null;
 if(task.status==='completed'){
  if(kind==='cycle'){
   if(task.finished!==task.preflight.selectedNodeIds.length||task.goalVerification?.ok===false||task.routineVerification?.ok!==true)throw Error('本轮步骤或最终目标尚未完整验收');
   const result=await requestBody('routine.complete',{owner:nr.owner,cycleId:task.id,routineId:r.id});
   if(epoch!==nr.epoch||!nr.enabled)return;if(!result.verified)throw Error('日常闭环验收未通过');
   const memory=nrMemory();memory.cycles=Math.min(1e9,memory.cycles+1);memory.lastRoutine=r.id;nr.lastCompleted[r.id]=nrTime();delete nr.blocks[r.id];nrRemember();nrLog('cycle_completed',r.title+'已闭环：物品归位、人物回岗，已更新环境状态。',{routineId:r.id,cycle:memory.cycles});
  }else if(kind==='recovery'){nr.recovery=null;nrLog('recovered','已完成物品归位和休息，本次恢复不计为工作完成。');}
  nr.phase='ready';if(nr.stopAfterCycle)await nrRelease();return;
 }
 if(task.status==='cancelled'){await nrTakeover('任务已取消，持续日常随之结束。');return;}
 const error=Error(task.error||'动作没有通过验收');if(r)nrBlock(r,error);
 const stopped=await controlSemantic('stop',{invalidateInput:false,routineInternal:true});if(epoch!==nr.epoch)return;
 if(stopped.requiresRelease){nr.phase='held';nr.heldTaskId=task.id;nr.recovery=r?{id:r.id,attempted:kind==='recovery'}:null;nrLog('held','持物动作受阻，已保留抓握并暂停。须先处理身体错误和安全放置，本轮不计完成。');return;}
 nr.recovery=r&&kind!=='recovery'?{id:r.id,attempted:false}:null;nr.phase='ready';
 if(nr.stopAfterCycle)await nrRelease('本轮未完成，已停止持续日常。');
}
async function nrTick(){
 if(nr.flight||nr.starting||!nr.enabled)return;nr.flight=true;const epoch=nr.epoch;
 try{
  const lab=campLab(),a=lab?.agent;if(!a||!state.bodyReady)return;
  if(nr.identity!==nrIdentity()||lab.world.theme!=='camp'||lab.routines?.owner!==nr.owner){await nrTakeover('身份、环境或身体连接已改变，持续日常已结束。');await controlSemantic('stop',{routineInternal:true});return;}
  if(nrStudio(lab)){if(!languageState.paused)await controlSemantic('pause',{routineInternal:true});nr.message='日常已暂停，请退出部位编辑或毛发展示后继续。';return;}
  if(nr.taskId){const t=languageState.tasks.find(t=>t.id===nr.taskId);if(!t)throw Error('本轮任务记录已失效');if(['completed','failed','failed_replanned','cancelled'].includes(t.status)&&!languageState.draining)await nrFinishTask(t,epoch);return;}
  if(languageState.paused)return;
  if(nr.phase==='held'){if(!a.activity().readyForTask)return;if(nr.heldTaskId)await requestBody('semantic.release',{owner:nr.heldTaskId});nr.heldTaskId=null;nr.phase='ready';}
  if(nr.stopAfterCycle){await nrRelease();return;}
  if(nrBusy())return;if(a.error){nr.phase='blocked';nr.message='身体存在错误：'+a.error+'。请先停止或处理身体状态。';return;}
  const worldState=nrWorld();if(!worldState)throw Error('当前场景没有日常环境状态');
  const fatigue=campStrengthReading(lab)?.maxFatigue;
  if(!Number.isFinite(fatigue))throw Error('无法读取体力状态，日常调度已停止');
  nr.recovering=fatigue>=.30||nr.recovering&&fatigue>.16;
  if(nr.recovering){await nrDispatch(null,'rest',epoch);return;}
  if(nr.recovery&&!nr.recovery.attempted){const r=nrCatalog.recipe(nr.recovery.id);nr.recovery.attempted=true;try{await nrDispatch(r,'recovery',epoch);}catch(error){nrBlock(r,error);nr.recovery=null;}return;}
  const now=worldState.elapsedS,revision=lab.world.revision;
  const candidates=nrRoleRecipes().filter(nrCatalog.motionAvailable).filter(r=>nr.mode==='auto'||nr.mode===r.id).filter(r=>{const b=nr.blocks[r.id];return !b||b.revision!==revision||now>=b.until;}).filter(r=>now-(nr.lastCompleted[r.id]??-Infinity)>=r.cooldown).sort((x,y)=>worldState.needs[y.id]-worldState.needs[x.id]);
  const selected=candidates.find(r=>nr.mode!=='auto'||worldState.needs[r.id]>=.30);
  if(!selected){nr.phase='waiting';await nrDispatch(null,'rest',epoch);return;}
  try{await nrDispatch(selected,'cycle',epoch);}catch(error){if(epoch!==nr.epoch||!nr.enabled)return;nrBlock(selected,error);nr.phase='waiting';}
 }catch(error){if(epoch===nr.epoch){nrLog('error',error.message);await nrRelease('持续日常已停止：'+error.message).catch(()=>{});}}
 finally{nr.flight=false;renderNPCRoutines();}
}
function nrCommand(text){
 const value=text.trim().replace(/[。！!]/g,'');
 if(/^(开始日常活动|执行身份活动|按身份活动|开始日常循环|开始持续日常|按身份持续活动)$/.test(value)&&nrCatalog.resident(residentProfile.role))return 'start';
 if(/^(停止日常循环|结束日常活动|停止自动日常)$/.test(value))return 'stop';
 if(/^(暂停日常|暂停日常循环)$/.test(value))return 'pause';
 if(/^(继续日常|继续日常循环)$/.test(value))return 'resume';return null;
}
async function nrRunCommand(command,text,meta={}){
 addMessage('user',text,{modality:meta.modality||'text'});
 const result=command==='start'?await startNPCRoutines():command==='stop'?await stopNPCRoutines():await controlSemantic(command==='pause'?'pause':'resume',{routineInternal:true});
 if(result?.stale)return result;
 addMessage('brain',command==='start'?'已开启按身份持续日常，可在任务面板查看每轮验收。':command==='stop'?'已请求当前一轮归位后结束日常。':command==='pause'?'已暂停日常，保留进度。':'已继续日常。',{speak:false});
 return{plan:{schema:'jarvis/semantic_plan@1.0',status:'control',control:'routine.'+command,sourceText:text,nodes:[]},control:result,dispatched:command==='start',loopEnabled:nr.enabled};
}
function nrExport(){const report={schema:'jarvis/npc_routine_report@1',exportedAt:new Date().toISOString(),instanceId:state.activeInstanceId,resident:residentContext(),status:nr.phase,mode:nr.mode,completedMemory:nr.memory,environment:nrWorld(),events:nr.events,instanceCount:campLab()?.population?.list().length||1,geometrySource:'functions-only'};const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='npc-routine-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function renderNPCRoutines(){
 const host=$('npcRoutinePanel');if(!host)return;const lab=campLab(),isCamp=lab?.world?.theme==='camp';host.hidden=!isCamp;if(!isCamp)return;
 const ready=state.bodyReady&&state.brainReady,role=residentProfile.role,npc=nrCatalog.resident(role),recipes=nrCatalog.data.routines.filter(r=>r.role===role),busy=nr.enabled||nr.starting||nrBusy();
 const signature=role;if(signature!==nr.signature){nr.signature=signature;$('npcRoutineMode').replaceChildren();const any=document.createElement('option');any.value='auto';any.textContent='按环境需求轮换';$('npcRoutineMode').append(any);for(const r of recipes){const o=document.createElement('option');o.value=r.id;o.disabled=!nrCatalog.motionAvailable(r);o.textContent=r.title+(o.disabled?'（缺少实测动作）':'');$('npcRoutineMode').append(o);}}
 $('npcRoutinePreset').value=npc?.id||'';$('npcRoutinePreset').disabled=!ready||busy;$('npcRoutineMode').disabled=busy;
 $('npcRoutineStart').disabled=!ready||!npc||busy||!recipes.some(nrCatalog.motionAvailable);$('npcRoutinePause').disabled=!nr.enabled;$('npcRoutineEnd').disabled=!nr.enabled&&!nr.starting;$('npcRoutineStop').disabled=!nr.enabled&&!nr.starting;
 cleanText('npcRoutinePause',languageState.paused?'继续':'暂停');cleanText('npcRoutineIdentity',residentProfile.displayName+' · '+(npc?.title||'请选择职业身份')+' · '+(npc?.responsibilities.join('、')||''));
 const memory=npc?nr.memory[npc.id]:null,t=nr.taskId&&languageState.tasks.find(t=>t.id===nr.taskId);let count=0,phase=null;for(const p of nr.phases){count+=p.count;if(t&&t.finished<count){phase=p.title;break;}}
 cleanText('npcRoutineStatus',(nr.enabled?(languageState.paused?'已暂停':{preparing:'准备中',ready:'安排下一轮',running:'作业中',recovering:'归位恢复',resting:'休息中',waiting:'等待需求',held:'等待安全放置',blocked:'等待处理'}[nr.phase]||'执行中'):'未运行')+' · 已验收 '+(memory?.cycles||0)+' 轮'+(phase?' · '+phase:'')+(nr.stopAfterCycle?' · 本轮结束后停止':''));
 cleanText('npcRoutineMessage',recipes.some(nrCatalog.motionAvailable)?nr.message:'该身份的工作动作缺少实测来源；可先使用步行、坐卧和挥手指令。');const s=nrWorld(),rows=$('npcRoutineNeeds');rows.replaceChildren();
 for(const r of recipes){const li=document.createElement('li'),b=document.createElement('b'),span=document.createElement('span');b.textContent=r.needLabel;const block=nr.blocks[r.id];span.textContent=s?Math.round(s.needs[r.id]*100)+'%'+(block?' · 暂缓：'+block.reason:''):'等待环境';li.append(b,span);rows.append(li);}
 cleanText('npcRoutineLog',nr.events.slice(-4).map(e=>e.message).join('\n'));
}
function setupNPCRoutines(){
 const select=$('npcRoutinePreset');for(const p of nrCatalog.data.residents){const o=document.createElement('option');o.value=p.id;o.textContent=p.name+' · '+p.title;select.append(o);}
 select.onchange=async e=>{const p=nrCatalog.data.residents.find(p=>p.id===e.target.value);if(!p)return;try{await updateResidentProfile({displayName:p.name,role:p.role,residentId:p.id});nr.role=null;nr.signature='';renderCampTasks();}catch(error){toast(error.message,'error');renderNPCRoutines();}};
 const run=fn=>async()=>{try{await fn();}catch(error){nrLog('error',error.message);toast(error.message,'error');}finally{renderNPCRoutines();}};
 $('npcRoutineStart').onclick=run(()=>startNPCRoutines($('npcRoutineMode').value));$('npcRoutinePause').onclick=run(()=>controlSemantic(languageState.paused?'resume':'pause',{routineInternal:true}));$('npcRoutineEnd').onclick=run(stopNPCRoutines);$('npcRoutineStop').onclick=run(()=>controlSemantic('stop'));$('npcRoutineExport').onclick=nrExport;
 window.JarvisNPCRoutines={start:startNPCRoutines,stop:stopNPCRoutines,takeover:nrTakeover,command:nrCommand,runCommand:nrRunCommand,render:renderNPCRoutines,export:nrExport,get active(){return nr.enabled||nr.starting;},get state(){return{enabled:nr.enabled,status:nr.phase,taskId:nr.taskId,routineId:nr.routineId,mode:nr.mode,memory:safe(nr.memory),events:safe(nr.events)};}};
 nr.timer=setInterval(nrTick,250);window.addEventListener('beforeunload',()=>{clearInterval(nr.timer);nrRemember();});renderNPCRoutines();
}
