/* Checked semantic boundary. The existing HumanLab owns all motion and contact solving. */
(()=>{'use strict';
const ID='humanoid',PROTOCOL='life_agent/runtime@1.0';
let seq=0,generation=0,open=null,lastError='',ready=false;
const api=()=>window.HumanLab;
let jointTelemetry=null;const acceptedTickets=new Map();
const telemetry=()=>jointTelemetry||(jointTelemetry=new window.JarvisJointControl.Telemetry(api));
const safe=x=>JSON.parse(JSON.stringify(x));
const post=x=>parent.postMessage(x,'*');
const emit=(event,detail={})=>post({type:'LIFE_AGENT_EVENT',protocol:PROTOCOL,id:ID,event,seq:++seq,timestamp:Date.now(),detail:{...detail}});
function caps(){const a=api(),env=a.environment.list();return{schema:'life_agent/capability_profile@1.0',agentId:ID,nativeApi:'HumanLab',protocol:PROTOCOL,queueModes:['replace','append'],actions:['control.snapshot','control.contract','anatomy.view','anatomy.snapshot','semantic.execute','semantic.validate','semantic.reserve','semantic.release','reasoning.analyze','reasoning.simulate','pause','resume','stop','snapshot','capabilities','diagnostics','advance','environment.list','environment.add','environment.update','environment.remove','environment.duplicate','environment.preset','environment.randomize','environment.export','environment.import','environment.placement','environment.cancelPlacement'],native:{schema:'knowledge_human/capability_manifest@1.0',semanticPlanSupported:true,placementRelations:['inside','near','left','right','front','behind'],supportPickup:false,jointGoal:{schema:'jarvis/joint_goal@1.1',regions:['shoulder','elbow'],relative:true,kinematicOnly:true},jointControl:telemetry().contractValue,semanticSkills:[{id:'pose_arm',label:'左右肩肘目标与相对微调'},{id:'sit_ground',label:'坐在地上'},{id:'lie_ground',label:'躺下'},{id:'stand_up',label:'起身'},{id:'walk_to_region',label:'走到区域或物体旁'},{id:'greet',label:'打招呼'},{id:'salute',label:'敬礼'},{id:'wave',label:'挥手'},{id:'carry_object',label:'抓取、搬运并放置'},{id:'push_object',label:'接触推动'}],worldEntities:[...env.scene.objects,...env.scene.zones].map(e=>e.id),environmentEditor:{supported:true,...env},motionAuthority:'Human.finalPose',hardJointROM:true,fixedBoneLengths:true,contactValidation:true,physicalReasoning:{supported:true,profile:a.physicalProfile},anatomy:{procedural:true,layers:a.tissue.report().layers,muscleCount:a.tissue.muscles.length,externalMeshes:0,imageMaps:0},mechanicalControlExposed:false}}}
function bodyState(){const a=api(),s=a.report();const running=!!(s.plan||s.activeStep||s.basic.transition||s.basic.gesture);return{status:s.error?'failed':s.paused?'paused':running?'running':'idle',summary:s.phase,position:s.body.root,yaw:a.agent.yaw,activeTask:s.activeStep||null,queueLength:s.plan?Math.max(0,s.plan.steps.length-s.plan.index):0,error:s.error,generation,semanticReserved:!!window.__jarvisSemanticReservation,jointControl:telemetry().sample(false)}}
function checkCompletion(){if(!open)return;const a=api(),s=a.report();if(s.error||s.stats.failed>open.beforeFailed){const o=open;open=null;emit('failed',{...o,error:s.error||'身体步骤失败',evidence:s.completionEvidence.slice(o.evidenceStart)});return}if(s.stats.completed>=open.beforeCompleted+open.stepCount&&!s.plan&&!s.activeStep&&!s.basic.transition&&!s.basic.gesture){const o=open;open=null;emit('completed',{...o,summary:o.summary,evidence:s.completionEvidence.slice(o.evidenceStart),worldRevision:s.world.revision,verified:true,jointControl:telemetry().sample(false)})}}
function heartbeat(){if(!api())return;checkCompletion();post({type:'LIFE_AGENT_HEARTBEAT',protocol:PROTOCOL,id:ID,timestamp:Date.now(),state:bodyState()})}
async function dispatch(action,p={}){const a=api();if(!a)throw Error('身体尚未就绪');
 if(action==='control.snapshot')return telemetry().sample(true);
 if(action==='control.contract')return telemetry().contractValue;
 if(action==='anatomy.view')return a.setAnatomyView(p.mode);
 if(action==='anatomy.snapshot')return a.tissue.report();
 if(action==='semantic.validate')return a.validatePlan(p.plan);
 if(action==='semantic.reserve'){if(window.__jarvisSemanticReservation&&window.__jarvisSemanticReservation!==p.owner)throw Error('身体已有其他认知任务预约');window.__jarvisSemanticReservation=String(p.owner);return{reserved:true}}
 if(action==='semantic.release'){if(!p.owner||window.__jarvisSemanticReservation===p.owner)window.__jarvisSemanticReservation=null;return{released:true}}
 if(action==='reasoning.analyze')return a.analyzeStep(p.step,p.actor||{});
 if(action==='reasoning.simulate')return a.simulatePlan(p.plan,p.actor||{});
 if(action==='semantic.execute'){
  if(!p.ticketId||typeof p.ticketId!=='string')throw Error('缺少执行票据');
  if(acceptedTickets.has(p.ticketId)){const prior=acceptedTickets.get(p.ticketId);if(prior.signature!==JSON.stringify(p))throw Error('票据与载荷不匹配');return{...safe(prior.receipt),duplicate:true};}
  if(window.__jarvisSemanticReservation!==p.owner)throw Error('身体预约身份不匹配');
  if(!p.plan||p.plan.schema!=='knowledge_human/checked_semantic_plan@1.0')throw Error('语义计划版本无效');
  if(!Number.isInteger(p.generation)||p.generation<generation)throw Error('过期任务 generation');
  if(p.expectedWorldRevision!==a.world.revision||p.sceneId!==a.world.sceneId)throw Error('场景已改变，请重新理解当前任务');
  const validation=a.validatePlan(p.plan);if(!validation.ok)throw Error(validation.errors.join('；'));
  if(open)throw Error('当前身体步骤尚未结束');
  const s=a.report();if(s.plan||s.activeStep||s.basic.transition||s.basic.gesture)throw Error('身体正在执行其他任务');
  const result=a.submitPlan(p.plan);generation=p.generation;lastError='';open={ticketId:p.ticketId,inputId:p.inputId||null,generation,planId:p.planId,intentId:p.intentId,stepId:p.stepId,summary:p.summary||p.plan.sourceText,beforeCompleted:s.stats.completed,beforeFailed:s.stats.failed,evidenceStart:s.completionEvidence.length,stepCount:p.plan.steps.length};telemetry().begin(open,p.plan.steps[0]);emit('accepted',open);emit('started',open);const receipt={ticket:safe(open),result};acceptedTickets.set(p.ticketId,{signature:JSON.stringify(p),receipt:safe(receipt)});if(acceptedTickets.size>500)acceptedTickets.delete(acceptedTickets.keys().next().value);return receipt;
 }
 if(action==='pause'){a.agent.paused=true;emit('paused',open||{});return{paused:true}}
 if(action==='resume'){if(a.agent.error)throw Error('身体存在未解除的错误，不能直接继续');a.agent.paused=false;emit('resumed',open||{});return{paused:false}}
 if(action==='stop'){const previous=open;const result=a.agent.cancel();if(result.requiresRelease){emit('held_safe',{...previous,...result,summary:'已暂停并保留抓握，继续后完成当前放置；后续计划已取消'});return{...result,generation}}open=null;generation=Math.max(generation+1,Number(p.generation)||0);emit('cancelled',{...previous,generation,reason:'user_stop'});return{...result,generation}}
 if(action==='snapshot'||action==='diagnostics')return{...a.report(),jointMotion:a.jointControl?.snapshot(),actor:{position:[...a.agent.pos],yaw:a.agent.yaw},jointControl:telemetry().sample(false)};if(action==='capabilities')return caps();
 if(action==='advance'){const seconds=Math.max(0,Math.min(120,Number(p.seconds)||1));const r=a.advance(seconds);checkCompletion();heartbeat();return r}
 if(action.startsWith('environment.')){const method=action.slice(12);if(!['list','add','update','remove','duplicate','preset','randomize','export','import','placement','cancelPlacement'].includes(method))throw Error('未知环境操作');return a.environment[method](p)}
 if(['command','replace','append'].includes(action))throw Error('请通过贾维斯语言入口提交任务，身体只接收已校验的语义计划');
 throw Error('未知接口：'+action);
}
addEventListener('message',async e=>{const d=e.data;if(e.source!==parent||!d||d.protocol!==PROTOCOL||d.id!==ID||d.type!=='LIFE_AGENT_REQUEST')return;try{const r=await dispatch(d.action,d.payload||{});post({type:'LIFE_AGENT_RESPONSE',protocol:PROTOCOL,id:ID,requestId:d.requestId,ok:true,result:safe(r),timestamp:Date.now()})}catch(err){post({type:'LIFE_AGENT_RESPONSE',protocol:PROTOCOL,id:ID,requestId:d.requestId,ok:false,error:err.message,timestamp:Date.now()})}});
addEventListener('humanlab:environment-change',e=>{emit('environment_changed',e.detail);heartbeat()});addEventListener('humanlab:environment-placement',e=>emit('environment_placement',e.detail));
let startupTimer=null,startupFailed=false;
function reportStartupFailure(detail={}){
 if(ready||startupFailed)return;
 startupFailed=true;clearInterval(startupTimer);
 document.documentElement.dataset.lifeAgentReady='false';
 emit('startup_failed',{stage:detail.stage||window.__humanStartup?.stage||'startup',
  message:detail.message||'身体启动失败',error:String(detail.error||window.__startupError||'未知初始化错误')});
}
function reportRuntimeError(error){
 const detail={error:String(error?.message||error)};
 if(ready)emit('runtime_error',detail);else reportStartupFailure(detail);
}
addEventListener('humanlab:startup-progress',e=>{if(!ready&&!startupFailed)emit('startup_progress',e.detail)});
addEventListener('humanlab:startup-failed',e=>reportStartupFailure(e.detail));
addEventListener('error',e=>reportRuntimeError(e.message||e.error));
addEventListener('unhandledrejection',e=>reportRuntimeError(e.reason));
startupTimer=setInterval(()=>{
 if(window.__startupError){reportStartupFailure(window.__humanStartup);return}
 if(!api()||window.__humanStartup?.status!=='ready')return;
 try{
  window.HumanJointControlAdapter.install(api());
  const capabilities=caps();
  clearInterval(startupTimer);
  post({type:'LIFE_AGENT_READY',protocol:PROTOCOL,id:ID,nativeApi:'HumanLab',capabilities,timestamp:Date.now()});
  ready=true;document.documentElement.dataset.lifeAgentReady='true';
 }catch(error){reportStartupFailure({stage:'binding',error:String(error?.message||error)});return}
 heartbeat();setInterval(heartbeat,180);
},50);
})();
