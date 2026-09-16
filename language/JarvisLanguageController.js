/* Mounted in the parent workbench. Only semantic steps cross the embodiment boundary. */
const Scene=window.JarvisSceneGrounding;
const Lang=window.JarvisLanguage,planner=new Lang.Planner(),Reasoning=window.JarvisReasoning,reasoner=new Reasoning.Reasoner();
const languageState={submitting:0,engine:'hybrid-symbolic-geometric-closed-loop',generation:0,inputEpoch:0,preview:null,pending:null,confirmation:null,tasks:[],current:null,queue:[],waiters:new Map(),tickets:new Map(),paused:false,draining:false,history:[],lastResult:null,modelConnected:false,modelAbort:null,reasoningEnabled:true,physicalPreflight:true,autoReplan:true,reasoningStatus:'waiting',reasoningTrace:null,reasoningDraft:null,reasoningCandidates:[],reasoningSimulations:[],reasoningDecision:null,replanLimit:2};
state.language=languageState;
const commandArbiter=new window.JarvisCommandArbiter.Arbiter(),inflightInputs=new Map();
let confirmationFlight=null,confirmationInput=null;
function assertInput(token){token?.assert();}
async function awaitInput(promise,token){if(token?.wait)return await token.wait(promise);const value=await promise;assertInput(token);return value;}

function languageStorageGet(key,fallback=null){try{const value=localStorage.getItem(key);return value==null?fallback:value}catch{return fallback}}
function languageStorageSet(key,value){try{localStorage.setItem(key,value)}catch{}}
function semanticContext(){return{...planner.context,lastMotion:state.snapshot?.jointMotion?.status==='native'?null:planner.context.lastMotion,resident:residentContext(),activitySpace:state.snapshot?.world?.activitySpace||null,position:state.snapshot?.actor?.position||state.heartbeat?.position||state.snapshot?.body?.root||[0,0,1.75],yaw:state.snapshot?.actor?.yaw??state.heartbeat?.yaw??0,posture:state.snapshot?.basic?.posture||'standing',jointMotion:state.snapshot?.jointMotion||null,taskStatus:languageState.current?.status||state.heartbeat?.status||'idle'}}
function openLanguage(){cleanBeforeOverlay('language');closeSceneEditor();$('languageDrawer').hidden=false;renderLanguage();$('languageClose').focus()}
function closeLanguage(){$('languageDrawer').hidden=true}
function renderLanguage(){
 const p=languageState.preview,task=languageState.current,trace=languageState.reasoningTrace;
 $('languageBadge').textContent=p?.groundedIntent?.capabilityGaps?.length?'已理解 · 身体待接入':p?.questions?.some(q=>q.code==='NO_FEASIBLE_REASONED_PLAN')?'已理解 · 执行受阻':p?({ready:'已形成计划',clarify:'需要你补充',control:'控制指令',chat:'交流',query:'环境问答',noop:'无需动作',blocked:'已阻止'}[p.status]||p.status):'推理规划';
 $('languageBrief').textContent=task?`当前：${task.status} · ${task.finished}/${task.preflight?.selectedNodeIds?.length??Lang.flatten(task.plan.nodes).length} 步${task.replanAttempt?` · 重规划 ${task.replanAttempt}`:''}`:(p?.summary?.join(' → ')||p?.response||'输入目标，查看世界事实、候选方案与身体物理推演。');
 renderCleanSummary();if(!cleanVisible('languageDrawer'))return;cleanStats.languageDetailRenders++;
 $('languageEngine').textContent=p?.requiresConfirmation?'MODEL PROPOSAL · LOCAL VALIDATION':p?.groundedIntent?'LOCAL · SCENE QUERY + CAPABILITY CHECK':trace?'LOCAL · GOAL SEARCH + BODY SIMULATION':'LOCAL · 组合语义解析';
 $('languagePlan').textContent=p?JSON.stringify({schema:p.schema,id:p.id,engine:p.engine,status:p.status,mode:p.mode,worldRevision:p.worldRevision,reasoningTraceId:p.reasoningTraceId,grounding:p.grounding,interpretation:p.interpretation,assumptions:p.assumptions,groundedIntent:p.groundedIntent,requiredEffects:p.requiredEffects,requiresConfirmation:p.requiresConfirmation,constraints:p.constraints,nodes:p.nodes,questions:p.questions,validation:p.validation,preflight:p.preflight},null,2):'尚无理解结果';
 $('languageSummary').replaceChildren();
 const lines=p?.summary||[];if(p?.interpretation?.rules?.length){const e=document.createElement('div');e.className='semantic-step';e.textContent='理解为：'+p.interpretation.canonical;$('languageSummary').append(e)}for(const a of p?.assumptions||[]){const e=document.createElement('div');e.className='semantic-step';e.textContent=a;$('languageSummary').append(e)}for(let i=0;i<lines.length;i++){const e=document.createElement('div');e.className='semantic-step';e.textContent=`${i+1}. ${lines[i]}`;$('languageSummary').append(e)}
 if(p?.questions?.length)for(const q of p.questions){const e=document.createElement('div');e.className='semantic-question';e.textContent=q.message;$('languageSummary').append(e)}
 $('clarifyChoices').replaceChildren();for(const c of [...(p?.questions?.[0]?.candidates||[]),...(p?.questions?.[0]?.choices||[])]){const b=document.createElement('button');b.className='soft-btn';b.textContent=`${c.name} · ${c.id}`;b.onclick=()=>submit(c.text||c.id,state.mode,{inputId:uid('choice')}).catch(()=>{});$('clarifyChoices').append(b)}
 $('executePlanBtn').disabled=!languageState.confirmation;
 $('languageTasks').textContent=languageState.tasks.slice(-12).map(t=>`${t.plan.sourceText}\n${t.status} · 完成 ${t.finished} 步${t.replanAttempt?` · 重规划 ${t.replanAttempt}`:''}${t.error?' · '+t.error:''}\n${(t.events||[]).slice(-4).map(e=>`${e.kind}${e.reason?'：'+e.reason:''}`).join(' → ')}`).reverse().join('\n\n')||'没有已下发的任务';
 renderSceneGrounding(p);
 const goals=trace?.goals||p?.groundedIntent?.goals||[],candidates=trace?.candidates||[],feasible=candidates.filter(c=>c.feasible);
 $('reasoningStatus').textContent=(languageState.reasoningStatus||'waiting').toUpperCase();$('reasoningGoalCount').textContent=String(goals.length);$('reasoningCandidateCount').textContent=String(candidates.length);$('reasoningFeasibleCount').textContent=String(feasible.length);
 $('reasoningGoals').replaceChildren();if(!goals.length){const e=document.createElement('div');e.className='empty';e.textContent='等待目标。';$('reasoningGoals').append(e)}else for(const item of goals){const e=document.createElement('div');e.className='reasoning-item';const b=document.createElement('b'),span=document.createElement('span');b.textContent=item.goal?.type||item.action||'goal';span.textContent=JSON.stringify(item.goal||item);e.append(b,span);$('reasoningGoals').append(e)}
 $('reasoningFacts').replaceChildren();const facts=[...(trace?.worldFacts||[])];for(const a of trace?.affordances||[])facts.push(`${a.name}（${a.id}）：${a.movable?'可移动':'固定'}，${a.carryable?'可搬运':'搬运受限'}，${a.pushable?'可推动':'推动受限'}，质量 ${Number(a.massKg||0).toFixed(1)} kg`);if(!facts.length){const e=document.createElement('div');e.className='empty';e.textContent='等待世界状态。';$('reasoningFacts').append(e)}else for(const fact of facts){const e=document.createElement('div');e.className='reasoning-item';const b=document.createElement('b');b.textContent=fact;e.append(b);$('reasoningFacts').append(e)}
 $('reasoningCandidates').replaceChildren();if(!candidates.length){const e=document.createElement('div');e.className='empty';e.textContent='等待候选方案。';$('reasoningCandidates').append(e)}else for(const c of candidates){const e=document.createElement('article');e.className='candidate-card '+(trace?.decision?.candidateId===c.id?'chosen':c.feasible?'':'failed');const h=document.createElement('header'),b=document.createElement('b'),em=document.createElement('em');b.textContent=c.id;em.textContent=c.feasible?(trace?.decision?.candidateId===c.id?'SELECTED':'FEASIBLE'):'REJECTED';h.append(b,em);const ol=document.createElement('ol');for(const step of c.summary||[]){const li=document.createElement('li');li.textContent=step;ol.append(li)}const sim=document.createElement('p');sim.textContent=c.simulation;const why=document.createElement('p');why.textContent=(c.rationale||[]).join('；');const scores=document.createElement('div');scores.className='candidate-score';const score=document.createElement('span');score.textContent=`SCORE ${c.score==null?'∞':Number(c.score).toFixed(2)}`;scores.append(score);for(const reason of c.reasons||[]){const r=document.createElement('span');r.textContent=reason;scores.append(r)}e.append(h,ol,sim,why,scores);$('reasoningCandidates').append(e)}
 $('reasoningDecision').replaceChildren();if(!trace?.decision){const e=document.createElement('div');e.className='empty';e.textContent='等待决策。';$('reasoningDecision').append(e)}else{const b=document.createElement('b'),p0=document.createElement('p'),ul=document.createElement('ul');b.textContent=trace.decision.candidateId?`选择 ${trace.decision.candidateId}`:'当前没有可行计划';p0.textContent=trace.decision.candidateId?`目标函数：${trace.objective}，综合得分 ${Number(trace.decision.score||0).toFixed(2)}`:(trace.uncertainty||[]).join('；');for(const reason of trace.decision.reasons||[]){const li=document.createElement('li');li.textContent=reason;ul.append(li)}$('reasoningDecision').append(b,p0,ul)}
 $('reasoningTrace').textContent=trace?JSON.stringify(trace,null,2):'尚无推理记录';
}
function renderSceneGrounding(p){
 const el=$('sceneGroundingSummary'),detail=$('sceneGroundingEvidence');if(!el||!detail)return;
 const intent=p?.groundedIntent,groups=p?.grounding?.filter(g=>g.query)||[];
 if(!intent&&!groups.length){el.textContent='等待需要场景关系或对象集合的输入。';detail.textContent='尚无场景查询证据';return;}
 const ids=intent?.selectedIds||[...new Set(groups.flatMap(g=>g.ids||[]))];
 el.textContent=`已绑定 ${ids.length} 件对象：${ids.join('、')||'空集合'}。${intent?.capabilityGaps?.length?'语言目标已保留，身体能力尚未支持。':p.status==='query'?'仅查询，没有下发动作。':p.status==='clarify'?'目标已保留，执行条件仍未满足。':intent?.skippedIds?.length?`其中 ${intent.skippedIds.length} 件已满足目标。`:'逐件执行，并在结束后核对目标集合。'}`;
 detail.textContent=JSON.stringify({selection:ids,groups,intent,context:planner.context},null,2);
}
function showUnderstanding(p){languageState.preview=p;state.currentPlan=p;renderLanguage()}
function taskEvent(kind,task,detail={}){task.events.push({kind,at:new Date().toISOString(),...safe(detail)});renderLanguage()}
async function freshWorld(token=null){assertInput(token);const snapshot=await awaitInput(requestBody('snapshot',{},12000),token);state.snapshot=snapshot;renderSnapshot();return snapshot.world}
function physicalProfile(){return state.capabilities?.physicalReasoning?.profile||state.capabilities?.source?.native?.physicalReasoning?.profile||{}}
function reasoningActor(){const c=semanticContext();return{position:c.position,yaw:c.yaw,posture:c.posture,heldObject:state.snapshot?.heldObject||null}}
function resetReasoningEvidence(status='waiting'){languageState.reasoningStatus=status;languageState.reasoningTrace=null;languageState.reasoningDraft=null;languageState.reasoningCandidates=[];languageState.reasoningSimulations=[];languageState.reasoningDecision=null;renderLanguage()}
async function simulateReasoningCandidate(candidate,text,token=null){assertInput(token);const nodes=safe(candidate.plan.nodes);try{return await awaitInput(requestBody('reasoning.simulate',{plan:{schema:'knowledge_human/checked_semantic_plan@1.0',sourceText:text,nodes},actor:reasoningActor()},30000),token)}catch(error){assertInput(token);return{schema:'knowledge_human/physical_plan_simulation@1.0',feasible:false,reasons:['身体物理推演接口失败：'+error.message],analyses:[],score:null,totalDurationS:null,minClearanceM:null}}}
async function reasonAbout(text,basePlan,context=semanticContext(),token=null){assertInput(token);
 if(basePlan.status==='clarify'&&basePlan.questions?.some(q=>/^(?:JOINT_|BODY_GOAL_|GESTURE_SIDE_|STYLE_NEEDS_|DESTINATION_REQUIRED|TARGET_CONTEXT_REQUIRED|STALE_CONTEXT)/.test(q.code||''))){resetReasoningEvidence('clarification_required');return basePlan;}
 if(!languageState.reasoningEnabled){resetReasoningEvidence('disabled');return basePlan}
 if(basePlan.status==='ready'&&(basePlan.nodes.some(n=>n.kind==='condition')||basePlan.mode==='append'&&(languageState.current||languageState.queue.length))){resetReasoningEvidence('whole_plan_pending');return basePlan}
 if(basePlan.status==='ready'&&Lang.flatten(basePlan.nodes).some(n=>n.step.type==='joint_pose')){
  const sim=await simulateReasoningCandidate({plan:basePlan},text,token);resetReasoningEvidence(sim.feasible?'joint_kinematic_checked':'joint_goal_blocked');
  if(sim.feasible)return{...basePlan,assumptions:[...(basePlan.assumptions||[]),'肩肘目标已通过当前身体的运动学预检；全身自碰撞与动力学仍未验收']};
  return{...basePlan,status:'clarify',nodes:[],summary:[],questions:[{code:'JOINT_PREFLIGHT',message:(sim.reasons||[]).join('；')}],response:'已理解目标，当前身体尚不能安全完成：'+(sim.reasons||[]).join('；')};
 }

 reasoner.setProfile(physicalProfile());languageState.reasoningStatus='grounding';renderLanguage();
 const draft=reasoner.draft(text,basePlan,state.snapshot,context);languageState.reasoningDraft=safe(draft);
 if(draft.kind==='unresolved'){resetReasoningEvidence(basePlan.groundedIntent?.capabilityGaps?.length?'capability_gap':'unresolved');return basePlan}
 let candidates=reasoner.candidates(draft,state.snapshot,context).slice(0,12);languageState.reasoningCandidates=safe(candidates);languageState.reasoningStatus='simulating';renderLanguage();
 let simulations=[];for(const candidate of candidates)simulations.push(await simulateReasoningCandidate(candidate,text,token));
 if(!simulations.some(sim=>sim?.feasible)){const repaired=reasoner.repair(candidates,simulations,state.snapshot,context).slice(0,8);if(repaired.length){const repairedSimulations=[];for(const candidate of repaired)repairedSimulations.push(await simulateReasoningCandidate(candidate,text,token));candidates=[...candidates,...repaired];simulations=[...simulations,...repairedSimulations]}}
 languageState.reasoningCandidates=safe(candidates);languageState.reasoningSimulations=safe(simulations);languageState.reasoningStatus='deciding';renderLanguage();
 const decision=reasoner.decide({text,draft,candidates,simulations,world:state.snapshot,context});languageState.reasoningTrace=safe(decision.trace);languageState.reasoningDecision=safe(decision.trace?.decision);languageState.reasoningStatus=decision.plan?'selected':'no_feasible_plan';renderLanguage();
 if(decision.plan){decision.plan.requiresConfirmation=basePlan.requiresConfirmation===true;const check=Lang.validatePlan(decision.plan,state.snapshot,state.capabilities);if(!check.ok)throw Error('推理方案未通过行为边界校验：'+check.errors.join('；'));decision.plan.validation=check;decision.plan.summary=Lang.renderSummary(decision.plan.nodes,state.snapshot);decision.plan.reasoningTraceId=decision.trace.id;return decision.plan}
 const reason=(decision.trace?.uncertainty||[]).slice(0,4).join('；')||'当前场景与身体能力没有形成可行方案';return{...basePlan,engine:'reasoned-no-feasible',status:'clarify',nodes:[],summary:[],response:'我已经比较候选行为并完成物理推演，但当前没有安全可行的方案：'+reason+'。请调整目标、物体属性或训练场。',questions:[{code:'NO_FEASIBLE_REASONED_PLAN',message:'没有候选方案通过当前身体与场景的物理推演。',reasons:decision.trace?.uncertainty||[]}],validation:{ok:false,errors:[reason]}}
}
function rememberVerifiedTask(task){try{brainApp()?.memoryStore.addMemory(`已验证身体任务：${task.plan.sourceText}。完成 ${task.finished} 个语义步骤。`,{type:'episodic',tags:['身体执行','已验证'],salience:.78,consent:true})}catch{}renderMemory()}
function semanticFeedback(d){
 const ticket=d.detail?.ticketId,entry=languageState.tickets.get(ticket),waiter=languageState.waiters.get(ticket);
 const f={schema:'world_human/execution_feedback@1.0',feedbackId:uid('fb'),intentId:entry?.intentId||d.detail?.intentId||null,planId:entry?.taskId||d.detail?.planId||null,ticketId:ticket||null,status:d.event,eventSeq:d.seq,summary:d.detail?.summary||d.detail?.error||d.event,evidence:safe(d.detail),observedAt:new Date(d.timestamp).toISOString()};
 state.feedback.push(f);if(state.feedback.length>300)state.feedback.splice(0,state.feedback.length-300);renderEvents();
 if(entry&&['step_completed','completed'].includes(d.event)){
  const count=Math.min(entry.nodes.length,Number(d.detail?.completedCount)||0);
  if(count>entry.completed){for(const node of entry.nodes.slice(entry.completed,count)){if(node.step.objectId){planner.context.lastObject=node.step.objectId;planner.context.completedObjectIds=[...new Set([...(planner.context.completedObjectIds||[]),node.step.objectId])]}if(node.step.targetId)planner.context.lastTarget=node.step.targetId}entry.completed=count;entry.task.finished=entry.baseFinished+count;entry.task.currentStep=entry.nodes[Math.min(count,entry.nodes.length-1)];if(waiter){waiter.elapsed=0;waiter.deadline=waiter.timeoutFor(count)}renderLanguage()}
 }
 if(waiter&&['completed','failed','cancelled'].includes(d.event)){clearInterval(waiter.timer);languageState.waiters.delete(ticket);d.event==='completed'?waiter.resolve(d.detail):waiter.reject(Error(d.detail?.error||'任务已经取消'))}
 pulse('receiving',500);return f;
}

async function controlSemantic(action,{invalidateInput=true,routineInternal=false}={}){
 if(action==='stop'&&!routineInternal&&window.JarvisNPCRoutines?.active)await window.JarvisNPCRoutines.takeover('已停止持续日常，本轮未验收部分不计完成。');
 if(invalidateInput&&action!=='resume'){commandArbiter.invalidate(action==='pause'?'用户暂停':'用户停止');languageState.inputEpoch++;languageState.modelAbort?.abort();}

 if(action==='pause'){languageState.paused=true;const r=await requestBody('pause');if(languageState.current)languageState.current.status='paused';renderLanguage();return r}
 if(action==='resume'){await requestBody('resume');languageState.paused=false;if(languageState.current)languageState.current.status='running';renderLanguage();return{resumed:true}}
 languageState.confirmation=null;languageState.pending=null;
 for(const t of languageState.queue)t.status='cancelled';languageState.queue=[];
 const active=languageState.current,previousGeneration=languageState.generation;const next=previousGeneration+1;languageState.generation=next;if(active)active.status='cancelling';const result=await requestBody('stop',{generation:next});
 if(result.requiresRelease){languageState.generation=previousGeneration;if(active){active.cancelAfterStep=true;active.status='paused_with_grip'}languageState.paused=true;addMessage('brain','已暂停并保留抓握。继续时只完成当前物体的放置，后续步骤已取消。');renderLanguage();return result}
 languageState.generation=result.generation??next;languageState.paused=false;if(active)active.status='cancelled';
 for(const[k,w]of languageState.waiters){clearInterval(w.timer);w.reject(Error('任务取消'));languageState.waiters.delete(k)}
 await requestBody('semantic.release',{owner:active?.id});renderLanguage();return result;
}
function forecastSceneSignature(w){return JSON.stringify({sceneId:w.sceneId,bounds:w.bounds,zones:w.zones,objects:w.objects.map(o=>({id:o.id,shape:o.shape,w:o.w,d:o.d,h:o.h,r:o.r,mass:o.mass,movable:o.movable,collidable:o.collidable,yaw:o.movable===false?o.yaw:null,p:o.movable===false?o.p:null,friction:o.friction,gripFriction:o.gripFriction}))})}
async function forecastSemantic(plan,{token=null,queued=false,world=null}={}){
 assertInput(token);const w=world||await freshWorld(token);
 const pendingTail=languageState.queue.at(-1)||languageState.current;
 const tail=queued&&plan.mode==='append'&&pendingTail&&!['completed','cancelled','failed','failed_replanned'].includes(pendingTail.status)?pendingTail:null;
 if(tail?.cancelAfterStep)throw Error('当前正在取消并保留抓握，请先完成安全放置后再追加任务');
 const initialForecast=tail?.preflight;
 if(tail&&(!initialForecast?.complete||initialForecast.sceneSignature!==forecastSceneSignature(w)))throw Error('前序任务的预测已失效，请待当前任务结束后重新提交');
 languageState.reasoningStatus='whole_plan_preflight';renderLanguage();
 const forecast=await awaitInput(requestBody('reasoning.simulate',{plan:{schema:'knowledge_human/checked_semantic_plan@1.0',sourceText:plan.sourceText,nodes:safe(plan.nodes),...(initialForecast?{initialForecast:{predictedWorld:initialForecast.predictedWorld,predictedActor:initialForecast.predictedActor}}:{})},actor:reasoningActor()},30000),token);
 if(forecast.feasible&&plan.requiredEffects?.length){const a=forecast.predictedActor,check=Scene.verifyEffects(plan,forecast.predictedWorld,{...semanticContext(),position:a.pos,yaw:a.yaw,posture:a.posture});forecast.goalVerification=check;if(!check.ok){forecast.feasible=false;forecast.complete=false;forecast.reasons.push('整串动作结束后仍无法满足目标：'+check.checks.filter(c=>!c.satisfied).map(c=>c.objectId+' → '+c.targetId).join('、'))}}
 if(forecast.feasible&&plan.routine&&plan.routine.kind!=='rest'){const check=window.JarvisNPCRoutineCatalog.verify(plan.routine.routineId,forecast.predictedWorld,forecast.predictedActor);forecast.routineVerification=check;if(!check.ok){forecast.feasible=false;forecast.complete=false;forecast.reasons.push('日常闭环预检未通过：'+check.reasons.join('；'));}}
 forecast.sceneSignature=forecastSceneSignature(w);forecast.checkedAt=Date.now();
 plan.preflight={feasible:forecast.feasible,complete:forecast.complete,failedStep:forecast.failedStep,reasons:forecast.reasons,steps:forecast.analyses.map(a=>({nodeId:a.nodeId,stepNumber:a.stepNumber,type:a.step.type,feasible:a.feasible,reasons:a.reasons})),branches:forecast.branches,totalDurationS:forecast.totalDurationS,basis:forecast.basis};
 languageState.reasoningStatus=forecast.feasible?'whole_plan_passed':'whole_plan_blocked';
 if(!forecast.feasible||!forecast.complete){languageState.confirmation=null;showUnderstanding({...plan,status:'clarify',questions:[{code:'WHOLE_PLAN_PREFLIGHT',message:'整串指令预推演未通过：'+forecast.reasons.join('；')}],response:'整串指令预推演未通过：'+forecast.reasons.join('；')});throw Error('整串指令预推演未通过：'+forecast.reasons.join('；'))}
 renderLanguage();return forecast;
}

async function enqueueSemantic(plan,meta={}){
 const token=meta.token;assertInput(token);const currentWorld=await freshWorld(token);if(currentWorld.revision!==plan.worldRevision||currentWorld.sceneId!==plan.sceneId)throw Error('场景已发生变化，请重新理解后确认。');
 const check=Lang.validatePlan(plan,currentWorld,state.capabilities);if(!check.ok)throw Error(check.errors.join('；'));
 const preflight=await forecastSemantic(plan,{token,queued:true,world:currentWorld});
 if(meta.modality!=='npc-routine'&&window.JarvisNPCRoutines?.active)await awaitInput(window.JarvisNPCRoutines.takeover(),token);
 if(plan.mode==='replace'&&!meta.skipStop){
  const held=state.snapshot.heldObject;if(held)throw Error('当前仍抓持 '+held+'，请先继续完成放置，再替换任务。');
  await awaitInput(controlSemantic('stop',{invalidateInput:false}),token);assertInput(token);
 }
 assertInput(token);const task={id:uid('semantic_task'),inputId:meta.inputId||null,modality:meta.modality||'text',plan:safe(plan),preflight,status:'queued',finished:0,generation:languageState.generation,events:[],createdAt:Date.now(),error:null,replanAttempt:Number(meta.replanAttempt)||0,replanReason:meta.reason||null,planSignature:JSON.stringify(Lang.flatten(plan.nodes).map(n=>n.step))};
 languageState.tasks.push(task);if(languageState.tasks.length>200)languageState.tasks.splice(0,languageState.tasks.length-200);languageState.queue.push(task);planner.accept(plan);languageState.confirmation=null;state.currentPlan=plan;
 if(!plan.routine)addMessage('brain',`整串指令已通过预推演。${plan.mode==='append'?'我会在当前任务完成后执行':'我理解的步骤是'}：${plan.summary.join('；')}。`,{speak:true});renderLanguage();drainSemanticQueue();return task;
}
async function runNativeSemantic(task,nodes){
 await waitForBodySettled(task);
 const w=await freshWorld();if(task.generation!==languageState.generation)throw Error('旧任务已失效');
 const check=Lang.validatePlan({...task.plan,nodes},w,state.capabilities);if(!check.ok)throw Error(check.errors.join('；'));
 const first=nodes[0];
 if(nodes.length===1&&task.plan.requiredEffects?.some(e=>e.objectId===first.step.objectId&&e.targetId===first.step.targetId)&&Scene.effectSatisfied({objectId:first.step.objectId,targetId:first.step.targetId,relation:first.step.relation},w)){task.finished++;taskEvent('already_satisfied',task,{step:first.step});return{skipped:true,verified:true}}
 for(const node of nodes){const sourceCheck=Scene.revalidateStep(task.plan,node.step,w,{...planner.context,...semanticContext()});if(!sourceCheck.ok)throw Error(sourceCheck.reason)}
 await waitUnpaused(task);if(task.generation!==languageState.generation)throw Error('旧任务已失效，禁止下发关节目标');
 const intent={schema:'world_human/behavior_intent@1.1',intentId:uid('intent'),inputId:task.inputId,modality:task.modality,agentId:'agent_jarvis_001',embodimentId:EMBODIMENT_ID,bindingId:state.binding?.bindingId,goal:{type:'checked_semantic_sequence',summary:nodes.map(n=>Lang.describeStep(n.step,w)).join('；')},planId:task.plan.id,step:first.step,steps:nodes.map(n=>n.step),generation:task.generation,requiredCapabilities:check.requiredCapabilities,constraints:task.plan.constraints,worldContext:{sceneId:w.sceneId,revision:w.revision},reasoning:{traceId:task.plan.reasoningTraceId||null,physicalForecast:task.plan.preflight},dispatch:{mode:'structured-reasoned',status:'validated',physicalPreflight:'passed'}};
 state.currentIntent=intent;renderIntent(intent,{ok:true,missing:[],mechanicalCommandsPresent:false});
 const ticketId=uid('semantic_ticket');languageState.tickets.set(ticketId,{taskId:task.id,intentId:intent.intentId,nodeId:first.id,nodes,task,baseFinished:task.finished,completed:0});if(languageState.tickets.size>500)languageState.tickets.delete(languageState.tickets.keys().next().value);
 const promise=new Promise((resolve,reject)=>{
  const timeoutFor=index=>Math.max(180000,(task.preflight.analyses.find(a=>a.nodeId===nodes[index]?.id)?.estimates.predictedDurationS||0)*2000+30000);
  const waiter={resolve,reject,elapsed:0,timeoutFor,deadline:timeoutFor(0),lastAt:performance.now(),timer:null};
  waiter.timer=setInterval(()=>{const now=performance.now();if(!languageState.paused&&state.heartbeat?.status!=='paused')waiter.elapsed+=now-waiter.lastAt;waiter.lastAt=now;if(waiter.elapsed>waiter.deadline){clearInterval(waiter.timer);languageState.waiters.delete(ticketId);reject(Error('当前身体步骤超过预留时间，已停止后续步骤'))}},500);
  languageState.waiters.set(ticketId,waiter);
 });promise.catch(()=>{});
 const req={owner:task.id,inputId:task.inputId,plan:{schema:'knowledge_human/checked_semantic_plan@1.0',sourceText:task.plan.sourceText,steps:nodes.map(n=>n.step)},generation:task.generation,sceneId:w.sceneId,expectedWorldRevision:w.revision,ticketId,stepId:first.id,stepIds:nodes.map(n=>n.id),planId:task.plan.id,intentId:intent.intentId,summary:intent.goal.summary};
 taskEvent('dispatch',task,{steps:nodes.map(n=>n.step),ticketId,intentId:intent.intentId,worldRevision:w.revision,physicalPreflight:true});pulse('transmitting',500);setTrace('body','active');
 try{const receipt=await requestBody('semantic.execute',req,20000);state.currentTicket=receipt.ticket;const feedback=await promise;taskEvent('verified',task,{steps:nodes.map(n=>n.step),feedback});task.lastJointControl=feedback.jointControl||null;return feedback}
 catch(e){const waiter=languageState.waiters.get(ticketId);if(waiter){clearInterval(waiter.timer);languageState.waiters.delete(ticketId);waiter.reject(e)}throw e}
}

async function waitUnpaused(task){while((languageState.paused||state.heartbeat?.status==='paused')&&task.generation===languageState.generation&&task.status!=='cancelled')await new Promise(r=>setTimeout(r,80));if(task.generation!==languageState.generation||task.status==='cancelled')throw Error('旧任务已取消')}
async function waitForBodySettled(task){
 let waitingS=0,previousTime=null;
 for(;;){
  await waitUnpaused(task);
  const activity=await requestBody('activity');
  if(task.generation!==languageState.generation||task.status==='cancelled')throw Error('旧任务已取消');
  if(!Number.isFinite(activity.timeS)||typeof activity.readyForTask!=='boolean')throw Error('身体活动状态无效');
  if(activity.error)throw Error(activity.error);
  if(activity.readyForTask&&!activity.paused)return;
  // Only simulation time spent completing a support transition counts here.
  // A user pause or a hidden/stopped body clock does not consume the budget.
  if(previousTime!==null)waitingS+=Math.max(0,activity.timeS-previousTime);
  previousTime=activity.timeS;
  if(waitingS>30)throw Error('当前身体未能结束支撑转换，后续动作未启动');
  await new Promise(resolve=>setTimeout(resolve,120));
 }
}
async function waitSemanticDuration(task,seconds){
 await waitUnpaused(task);
 await waitForBodySettled(task);
 const payload={owner:task.id,generation:task.generation};
 let clock=await requestBody('semantic.waitClock',{...payload,start:true}),remaining=seconds;
 while(remaining>0){
  await waitUnpaused(task);await new Promise(r=>setTimeout(r,120));
  const next=await requestBody('semantic.waitClock',payload),elapsed=next.timeS-clock.timeS;
  if(!Number.isFinite(elapsed)||elapsed<0)throw Error('身体计时发生重置，请重新提交任务');
  remaining-=elapsed;clock=next;
 }
}
async function executeNodes(task,nodes){for(let i=0;i<nodes.length;i++){
 await waitUnpaused(task);if(task.cancelAfterStep)break;const node=nodes[i];
 if(node.kind==='condition'){const w=await freshWorld(),raw=Lang.predicateValue(node.predicate,w,semanticContext()),value=node.predicate.negate?!raw:raw;taskEvent('condition_checked',task,{condition:node.label,value,worldRevision:w.revision});await executeNodes(task,value?node.then:node.else);continue}
 task.currentStep=node;taskEvent('step_started',task,{step:node.step});
 if(node.step.type==='observe'){const w=await freshWorld();addMessage('brain','我从场景数据读到：'+w.objects.map(o=>o.name+'（'+o.id+'）').join('、')+'。');taskEvent('observation',task,{worldRevision:w.revision,entityIds:w.objects.map(o=>o.id)});task.finished++}
 else if(node.step.type==='wait'){await waitSemanticDuration(task,node.step.duration);taskEvent('wait_completed',task,{seconds:node.step.duration,clock:'body_simulation'});task.finished++}
 else{
  const batch=[node],canBatch=n=>n?.kind==='action'&&!['observe','wait','joint_pose'].includes(n.step.type)&&!(task.plan.groundedIntent&&n.step.objectId);
  if(canBatch(node))while(batch.length<64&&canBatch(nodes[i+1]))batch.push(nodes[++i]);
  await runNativeSemantic(task,batch);
 }
 if(task.generation!==languageState.generation)throw Error('旧任务已取消');renderLanguage();
}}

async function attemptAutomaticReplan(task,error){
 const revision=commandArbiter.revision,guard={assert(){if(commandArbiter.revision!==revision)throw new window.JarvisCommandArbiter.StaleCommandError();}};
 if(task.plan.groundedIntent)return false;
 if(!languageState.autoReplan||task.replanAttempt>=languageState.replanLimit||task.finished>0)return false;await refreshBodyEvidence();if(commandArbiter.revision!==revision||state.snapshot?.heldObject)return false;
 taskEvent('replan_started',task,{reason:error.message,attempt:task.replanAttempt+1});languageState.reasoningStatus='replanning';renderLanguage();
 try{const nextGeneration=languageState.generation+1;languageState.generation=nextGeneration;await awaitInput(requestBody('stop',{generation:nextGeneration},12000),guard);languageState.paused=false;await freshWorld(guard);const parsed=compileUtterance(task.plan.sourceText,'replace',{});let plan=parsed.plan;if(['ready','clarify'].includes(plan.status))plan=await reasonAbout(task.plan.sourceText,plan,semanticContext(),guard);if(plan.status!=='ready')throw Error(plan.response||'重规划没有形成可执行方案');const signature=JSON.stringify(Lang.flatten(plan.nodes).map(n=>n.step));if(signature===task.planSignature&&task.replanAttempt>=1)throw Error('重规划仍得到相同失败方案，已停止重复尝试');plan.mode='replace';await enqueueSemantic(plan,{skipStop:true,token:guard,inputId:task.inputId,modality:task.modality,replanAttempt:task.replanAttempt+1,reason:error.message});task.status='failed_replanned';taskEvent('replan_queued',task,{newPlanId:plan.id,attempt:task.replanAttempt+1});addMessage('brain',`执行反馈显示原方案不可行。我已重新读取场景并形成第 ${task.replanAttempt+1} 次替代计划。`,{kind:'success'});return true}catch(replanError){taskEvent('replan_failed',task,{reason:replanError.message});return false}
}
async function drainSemanticQueue(){if(languageState.draining)return;languageState.draining=true;try{while(languageState.queue.length){const task=languageState.queue.shift();if(task.generation!==languageState.generation||task.status==='cancelled')continue;languageState.current=task;
 try{await requestBody('semantic.reserve',{owner:task.id});await waitForBodySettled(task);task.preflight=await forecastSemantic(task.plan);if(task.generation!==languageState.generation||task.status==='cancelled')continue;task.status='running';taskEvent('started',task);await executeNodes(task,task.plan.nodes);if(task.generation!==languageState.generation||task.status==='cancelled')continue;
 if(!task.cancelAfterStep&&task.plan.requiredEffects?.length){const finalWorld=await freshWorld();const verified=Scene.verifyEffects(task.plan,finalWorld,semanticContext());taskEvent('goal_verified',task,verified);task.goalVerification=verified;if(!verified.ok)throw Error('步骤已结束，但目标集合仍未全部满足：'+verified.checks.filter(c=>!c.satisfied).map(c=>c.objectId).join('、'));}
 if(!task.cancelAfterStep&&task.plan.routine&&task.plan.routine.kind!=='rest'){const finalWorld=await freshWorld(),verified=window.JarvisNPCRoutineCatalog.verify(task.plan.routine.routineId,finalWorld,{pos:state.snapshot.body.root,posture:state.snapshot.basic.posture,heldObject:state.snapshot.heldObject});task.routineVerification=verified;taskEvent('routine_return_verified',task,verified);if(!verified.ok)throw Error('日常归位验收未通过：'+verified.reasons.join('；'));}
 task.status=task.cancelAfterStep?'cancelled':'completed';taskEvent(task.status,task);if(task.status==='completed'){if(!task.plan.routine){addMessage('brain',`已验证完成：${task.plan.sourceText}（${task.finished} 个语义步骤）。`,{kind:'success'});rememberVerifiedTask(task);setBrainExpression('joy')}}else addMessage('system','当前安全放置已完成，已取消剩余计划。');setTrace('body','done');setTrace('feedback','done');
 }catch(e){if(task.generation!==languageState.generation||task.status==='cancelled'){task.status='cancelled';taskEvent('cancelled',task)}else{task.status='failed';task.error=e.message;taskEvent('failed',task,{error:e.message});for(const t of languageState.queue)t.status='cancelled';languageState.queue=[];const replanned=await attemptAutomaticReplan(task,e);if(!replanned){await requestBody('pause').catch(()=>{});languageState.paused=true;addMessage('brain','这一步未完成：'+e.message+'。后续步骤已停止，已完成对象与未完成对象分别保留，请根据反馈调整目标或训练场。',{kind:'error'});setBrainExpression('concern')}}}finally{await refreshBodyEvidence();if(!state.snapshot?.heldObject)await requestBody('semantic.release',{owner:task.id}).catch(()=>{});languageState.current=null;await refreshBodyEvidence();renderLanguage()}
 }}finally{languageState.draining=false}}
function compileUtterance(text,mode,bindings={}){
 const pending=languageState.pending,ctx=semanticContext();
 const q0=pending?.plan?.questions?.[0];
 if(q0?.code==='JOINT_SIDE_REQUIRED'&&/^(?:左手|右手|双手|左|右|两只手|left|right|both)$/.test(text.trim())){const clarifiedSide=/左|left/.test(text)?'left':/右|right/.test(text)?'right':'both';const p=planner.compile(pending.text,state.snapshot,state.capabilities,{mode:pending.mode,context:{...ctx,clarifiedSide}});return{plan:p,original:pending.text,bindings:{}};}
 if(q0?.code==='DESTINATION_REQUIRED'&&!/^(把|将|停止|取消|坐|躺|挥手|敬礼)/.test(text.trim())){try{const target=Lang.resolveReference(text,state.snapshot,ctx,{kind:'any'})[0];const source=q0.source;const relation=state.snapshot.world.zones.some(z=>z.id===target.id)?'里面':target.templateId==='worktable'?'上':'旁边';const combined=`把${source}都搬到${target.id}${relation}`;return{plan:planner.compile(combined,state.snapshot,state.capabilities,{mode:pending.mode,context:ctx}),original:combined,bindings:{}};}catch{}}

 if(pending&&!/^(?:取消|停止|改为|改成|走|把|将|请|先|如果|推|搬|拿|去|坐|躺|起身|敬礼|挥手|记住|观察)/.test(Lang.normalize(text))){const q=pending.plan.questions?.[0];try{const answer=Lang.resolveReference(text,state.snapshot,planner.context,{kind:q?.slot==='object'?'object':q?.slot==='target'?'any':'any'});if(q?.raw&&answer.length===1){const b={...pending.bindings,[q.raw]:answer[0].id};const p=planner.compile(pending.text,state.snapshot,state.capabilities,{mode:pending.mode,context:ctx,bindings:b});return{plan:p,original:pending.text,bindings:b}}}catch{} }
 let compiler=planner;if(languageState.confirmation&&/^(?:改成|改为)/.test(Lang.normalize(text))){compiler=new Lang.Planner();compiler.context={...planner.context};compiler.lastPlan=languageState.confirmation}return{plan:compiler.compile(text,state.snapshot,state.capabilities,{mode,context:ctx,bindings}),original:text,bindings};
}
async function modelProposal(text,epoch){
 if(!$('modelConsent').checked)throw Error('请先确认将本轮文本、近期会话和训练场实体发送给模型服务。');
 const endpoint=$('modelEndpoint').value.trim()||'/api/semantic';const url=new URL(endpoint,location.href);if(!['http:','https:'].includes(url.protocol))throw Error('模型接口需要 HTTP 或 HTTPS 服务');
 languageState.modelAbort?.abort();const controller=new AbortController();languageState.modelAbort=controller;const timeout=setTimeout(()=>controller.abort(),45000);
 try{const r=await fetch(url.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,world:state.snapshot?.world,capabilities:state.capabilities?.semanticSkills,sceneFacts:Scene.facts(state.snapshot),placementRelations:state.capabilities?.placementRelations,context:{...planner.context,...semanticContext()},history:languageState.history.slice(-8),mode:state.mode}),signal:controller.signal});if(!r.ok){let reason='HTTP '+r.status;try{reason=(await r.json()).error||reason}catch{}throw Error(reason)}const data=await r.json();if(epoch!==languageState.inputEpoch)throw Error('模型返回时本轮请求已失效');if(data.error)throw Error(data.error);const p=planner.fromProposal(text,data.proposal||data,state.snapshot,state.capabilities,{context:semanticContext()});languageState.modelConnected=true;return p}finally{clearTimeout(timeout)}
}
async function submitCore(text,mode=state.mode,options={}){
 const token=options._token;assertInput(token);
 text=String(text||'').trim();if(!text)throw Error('请输入内容');const modality=options.modality==='voice'?'voice':'text',inputId=options.inputId||uid(modality);if(state.processedInputIds.has(inputId))return{duplicate:true,inputId};
 const app=brainApp();if(!app||!state.bodyReady)throw Error('大脑与身体仍在初始化');
 if(!options.dryRun){state.processedInputIds.add(inputId);if(state.processedInputIds.size>500)state.processedInputIds.delete(state.processedInputIds.values().next().value);addMessage('user',text,{modality,confidence:options.recognitionConfidence});languageState.history.push({role:'user',content:text,inputId,modality,at:new Date().toISOString()});if(languageState.history.length>100)languageState.history.splice(0,20)}
 languageState.submitting++;
 const epoch=languageState.inputEpoch;setBrainExpression('attentive');const started=performance.now();
 try{
  // Emergency controls do not wait for animated UI or remote interpretation.
  const preliminary=planner.compile(text,state.snapshot,state.capabilities,{mode,context:semanticContext()});
  if(preliminary.status==='control'){showUnderstanding(preliminary);if(options.dryRun)return{plan:preliminary,dispatched:false};const r=await controlSemantic(preliminary.control);addMessage('brain',preliminary.control==='stop'?'已处理停止请求。':preliminary.control==='pause'?'已暂停当前任务，保留任务进度。':'继续当前任务。');return{plan:preliminary,control:r,dispatched:false}}
  if(/^(?:确认执行|执行这个计划|就这样执行)$/.test(text)&&languageState.confirmation&&!options.dryRun)return await confirmSemanticPlan();
  await freshWorld(token);if(epoch!==languageState.inputEpoch)return{stale:true,dispatched:false};
  text=resolveResidentActivity(text,state.snapshot.world);
  const parsed=compileUtterance(text,mode,options.bindings),cognition=(options.dryRun||parsed.plan.status!=='chat')?{risk:$('brainFrame').contentWindow.JarvisCore.detectRisk(text),response:''}:app.cognition.process(text,{interface:'jarvis_semantic_v13',modality,inputId,worldSnapshot:state.snapshot,capabilityManifest:state.capabilities,resident:residentContext()});
  // Retain existing kindness rules. No inferred behavior can bypass their decision.
  if(cognition.risk?.blocked){cognition.response=cognition.response||'这项请求存在伤害或侵犯风险，我会保留安全边界并帮助寻找保护性的做法。';const p={...parsed.plan,status:'blocked',nodes:[],response:cognition.response};showUnderstanding(p);if(!options.dryRun)addMessage('brain',cognition.response,{kind:'error'});return{plan:p,cognition,dispatched:false}}
  let p=parsed.plan;
  if(options.useModel||($('autoModelFallback')?.checked&&$('modelConsent').checked&&p.status==='clarify'&&p.questions?.some(q=>['UNRECOGNIZED','UNKNOWN_DESCRIPTION','JOINT_UNKNOWN_MODIFIER','STYLE_NEEDS_DIMENSION'].includes(q.code)))){p=await awaitInput(modelProposal(text,epoch),token);if(epoch!==languageState.inputEpoch)return{stale:true,dispatched:false}}
  if(['ready','clarify'].includes(p.status)){setTrace('reasoning','active');p=await reasonAbout(text,p,semanticContext(),token);if(epoch!==languageState.inputEpoch)return{stale:true,dispatched:false}}else if(!['control'].includes(p.status))resetReasoningEvidence('not_required');
  if(p.status==='ready'&&(options.dryRun||$('previewBeforeExecute').checked||p.requiresConfirmation||p.engine==='model-proposal-validated'))await forecastSemantic(p,{token,queued:true});
  showUnderstanding(p);languageState.lastResult=p;for(const name of ['sensory_gateway','perception','attention','memory','values','reasoning','decision'])setTrace(name,'done');$('latencyReadout').textContent=`${Math.round(performance.now()-started)} MS`;
  if(options.dryRun)return{plan:p,cognition,dispatched:false};
  if(p.status==='clarify'){if(p.groundedIntent?.selectedIds?.length&&p.questions?.some(q=>q.code==='CAPABILITY_GAP'))planner.accept(p);if(languageState.current&&p.mode==='replace'){await awaitInput(controlSemantic('pause',{invalidateInput:false}),token);addMessage('system','已暂停当前任务，等待这条新指令澄清。')}languageState.pending={plan:p,text:parsed.original,mode,bindings:parsed.bindings};languageState.confirmation=null;addMessage('brain',p.response+(p.questions?.[0]?.candidates?.length?' 你可以点击候选物体，或直接回复它的颜色和编号。':''));renderLanguage();return{plan:p,cognition,dispatched:false}}
  if(['chat','query','noop','blocked'].includes(p.status)){if(p.contextAfter&&['query','noop'].includes(p.status))planner.accept(p);const answer=p.response||cognition.response;addMessage('brain',answer,{kind:p.status==='blocked'?'error':''});languageState.history.push({role:'assistant',content:answer});renderMemory();return{plan:p,cognition,dispatched:false}}
  languageState.pending=null;
  if($('previewBeforeExecute').checked||p.requiresConfirmation||p.engine==='model-proposal-validated'){languageState.confirmation=p;confirmationInput={inputId,modality};renderLanguage();addMessage('brain',`计划已准备：${p.summary.join('；')}。确认后执行。`);return{plan:p,cognition,awaitingConfirmation:true,dispatched:false}}
  const task=await enqueueSemantic(p,{token,inputId,modality});return{plan:p,cognition,taskId:task.id,dispatched:true};
 }catch(error){if(error.name==='StaleCommandError'||epoch!==languageState.inputEpoch)return{stale:true,dispatched:false};state.processedInputIds.delete(inputId);if(!options.dryRun){addMessage('brain','本轮没有新增动作：'+error.message,{kind:'error'});toast(error.message,'error')}throw error}finally{languageState.submitting=Math.max(0,languageState.submitting-1);renderMemory();renderLanguage()}
}

function submit(text,mode=state.mode,options={}){
 text=String(text||'').trim();if(!text)return Promise.reject(Error('请输入内容'));
 const inputId=options.inputId||uid(options.modality==='voice'?'voice':'text');
 if(!options.dryRun&&inflightInputs.has(inputId))return inflightInputs.get(inputId).then(value=>({...value,duplicate:true,inputId}));
 if(!options.dryRun&&state.processedInputIds.has(inputId))return Promise.resolve({duplicate:true,inputId});
 const routineCommand=!options.dryRun&&window.JarvisNPCRoutines?.command(text);
 if(routineCommand){
  state.processedInputIds.add(inputId);if(state.processedInputIds.size>500)state.processedInputIds.delete(state.processedInputIds.values().next().value);
  const result=window.JarvisNPCRoutines.runCommand(routineCommand,text,{modality:options.modality}).catch(error=>{state.processedInputIds.delete(inputId);throw error;});
  inflightInputs.set(inputId,result);result.finally(()=>inflightInputs.delete(inputId)).catch(()=>{});return result;
 }
 let preliminary;try{preliminary=planner.compile(text,state.snapshot,state.capabilities,{mode,context:semanticContext()})}catch(error){return Promise.reject(error)}
 if(preliminary.status==='control'&&!options.dryRun)return submitCore(text,mode,{...options,inputId});
 if(/^(?:确认执行|执行这个计划|就这样执行)$/.test(text)&&languageState.confirmation&&!options.dryRun)return confirmSemanticPlan();
 const scheduleMode=options.dryRun||['chat','query','noop'].includes(preliminary.status)?'append':preliminary.mode;
 if(scheduleMode==='replace'){languageState.inputEpoch++;languageState.modelAbort?.abort();}
 const result=commandArbiter.schedule(scheduleMode,token=>submitCore(text,mode,{...options,inputId,_token:token}));
 if(!options.dryRun){inflightInputs.set(inputId,result);result.finally(()=>inflightInputs.delete(inputId)).catch(()=>{});}
 return result;
}

function confirmSemanticPlan(){
 if(confirmationFlight)return confirmationFlight;
 const p=languageState.confirmation;if(!p)return Promise.reject(Error('没有等待确认的计划'));
 const meta=confirmationInput||{inputId:uid('confirmed'),modality:'text'};
 const promise=commandArbiter.schedule('append',async token=>{
  token.assert();if(languageState.confirmation!==p)throw Error('等待确认的计划已被取消或替换');
  const task=await enqueueSemantic(p,{token,...meta});return{plan:p,taskId:task.id,dispatched:true};
 });
 confirmationFlight=promise;promise.finally(()=>{if(confirmationFlight===promise)confirmationFlight=null;}).catch(()=>{});return promise;
}
async function bodyAction(action){try{const r=await controlSemantic(action);toast(action==='stop'?'已处理停止请求':action==='pause'?'任务已暂停':'任务已继续');return r}catch(e){toast(e.message,'error');throw e}}
function setupLanguage(){
 $('languageBtn').onclick=openLanguage;$('languageClose').onclick=closeLanguage;$('showLanguageBtn').onclick=openLanguage;
 const bindToggle=(id,key,storageKey,defaultOn=true)=>{const saved=languageStorageGet(storageKey,null);languageState[key]=saved==null?defaultOn:saved==='true';$(id).checked=languageState[key];$(id).onchange=()=>{languageState[key]=$(id).checked;languageStorageSet(storageKey,String(languageState[key]));if(key==='reasoningEnabled'&&!languageState[key])resetReasoningEvidence('disabled');renderLanguage()}};
 bindToggle('reasoningEnabled','reasoningEnabled','jarvis.reasoning.enabled',true);$('physicalPreflight').checked=true;languageState.physicalPreflight=true;bindToggle('autoReplan','autoReplan','jarvis.reasoning.autoReplan',true);
 $('analyzePlanBtn').onclick=()=>submit($('commandInput').value||languageState.preview?.sourceText,state.mode,{dryRun:true}).then(()=>openLanguage()).catch(e=>toast(e.message,'error'));
 $('executePlanBtn').onclick=()=>confirmSemanticPlan().catch(e=>toast(e.message,'error'));
 $('modelUnderstandBtn').onclick=()=>{const text=$('commandInput').value.trim()||languageState.preview?.sourceText;if(!text)return toast('请先输入指令');$('modelUnderstandBtn').disabled=true;submit(text,state.mode,{useModel:true,inputId:uid('model')}).catch(e=>toast(e.message,'error')).finally(()=>$('modelUnderstandBtn').disabled=false)};
 $('clearContextBtn').onclick=()=>{planner.reset();languageState.pending=null;languageState.confirmation=null;resetReasoningEvidence('waiting');toast('本轮对象指代和推理证据已清空，长期记忆保留');renderLanguage()};
 $('languageExportBtn').onclick=()=>{const value={version:VERSION,engine:languageState.engine,plan:languageState.preview,reasoning:{trace:languageState.reasoningTrace,draft:languageState.reasoningDraft,candidates:languageState.reasoningCandidates,simulations:languageState.reasoningSimulations,profile:physicalProfile()},tasks:languageState.tasks,context:planner.context,mechanicalControlExposed:false};const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='jarvis-reasoning-behavior-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)};
 document.querySelectorAll('[data-language-example]').forEach(b=>b.onclick=()=>{$('commandInput').value=b.dataset.languageExample;$('commandInput').dataset.inputModality='text';$('commandInput').dataset.inputId='';$('commandInput').focus()});renderLanguage();
}
