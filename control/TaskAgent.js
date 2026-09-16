const agentPreflights=new WeakMap();
class Agent{
 cancelPreflight(){const job=agentPreflights.get(this);if(job){job.iterator?.return?.();agentPreflights.delete(this);}this.preflightWaiting=false;this.preflight=null;}
 pausePreflight(){const job=agentPreflights.get(this);if(job){job.iterator?.return?.();Object.assign(job,{iterator:null,done:false,result:null,error:null,nextSliceAt:0});}}
 preflightTarget(){const s=this.skill,target=s?.targetId&&this.w?.get?this.w.get(s.targetId):s?.target;return JSON.stringify(target?[target.id,target.p,target.q,target.yaw,target.w,target.h,target.d,target.r,target.shape]:null);}
 preflightInput(ignoreOwnedPose=false){
  const state=this.locomotion.engine.state,s=this.skill;
  const geometry=ignoreOwnedPose?{...this.w,objects:this.w.objects.map(o=>o===s?.o?{...o,p:[0,0,0],q:qi(),yaw:0}:o)}:this.w;
  return JSON.stringify([motionPreflightModel(this.h).signature,this.pos,this.yaw,state.root,state.feet,state.pose,state.motion,this.locomotion.pose?.balanceInput?.()||null,
   s?.o&&[s.o.id,ignoreOwnedPose?null:s.o.p,ignoreOwnedPose?null:s.o.q,s.o.heldOwner],s?.target&&[s.target.id,s.target.p,s.target.q,s.target.w,s.target.h,s.target.d],this.grips,s?.reachStart,s?.releaseWrists,
   navigationGeometryKey(geometry),s?.o&&motionObjectShapeKey(this.w.physics.bodies.get(s.o.id).body)]);
 }
 startPreflight(kind,factory,commit){
  this.cancelPreflight();const job={kind,factory,commit,skill:this.skill,plan:this.plan,index:this.index,phase:this.phase,target:this.preflightTarget(),retries:0,started:performance.now(),nextSliceAt:0};
  agentPreflights.set(this,job);this.preflightWaiting=true;this.preflight={kind,status:'checking',steps:0,retries:0,maximumSliceMs:0};
 }
 advancePreflight(dt){
  const job=agentPreflights.get(this);if(!job)return;
  if(job.skill!==this.skill||job.plan!==this.plan||job.index!==this.index||job.phase!==this.phase){this.cancelPreflight();return;}
  this.time+=dt;
  try{
   if(performance.now()<job.nextSliceAt)return;
   if(!['transport','submission'].includes(job.kind)&&job.target!==this.preflightTarget())throw Error('接触预检期间目标位置或范围已改变，保持当前安全状态');
   if(this.skill?.o&&this.w.get&&this.w.get(this.skill.objectId)!==this.skill.o)throw Error('预检期间操作物体已移除或被替换');
   if(!job.iterator){job.iterator=job.factory();job.input=this.preflightInput();}
   if(job.input!==this.preflightInput()){const error=Error('预检期间场景或接触输入发生变化');error.code='PREFLIGHT_WORLD_CHANGED';throw error;}
   motionAdvancePreflight(job,3);job.nextSliceAt=performance.now()+10;
   Object.assign(this.preflight,{steps:job.steps||0,retries:job.retries,maximumSliceMs:job.maximumSliceMs||0,sliceCpuMs:job.sliceCpuMs||0,wallMs:performance.now()-job.started});
   if(job.error)throw job.error;
   if(!job.done)return;
   if(job.input!==this.preflightInput()){const error=Error('预检提交前场景或接触输入发生变化');error.code='PREFLIGHT_WORLD_CHANGED';throw error;}
   const result=job.result;agentPreflights.delete(this);this.preflightWaiting=false;this.preflight={...this.preflight,status:'verified'};job.commit(result);
  }catch(error){
   if(error.code==='PREFLIGHT_WORLD_CHANGED'&&job.retries<6){job.iterator?.return?.();Object.assign(job,{iterator:null,done:false,result:null,error:null,nextSliceAt:performance.now()+25,retries:job.retries+1});return;}
   this.cancelPreflight();this.fail(error.message);
  }
 }
 constructor(human,world,log=()=>{},options={}){this.h=human;this.w=world;this.log=log;this.strength=human.strength;this.reset(options);this.h.reconstructionNeutral={rootPosition:[...this.h.root.p],frames:new Map(this.h.joints.map(j=>[j.id,{p:[...j.world.p],q:[...j.world.q]}]))};}
 reset({staged=false,spawnPosition=null,spawnYaw=0}={}){
  if(typeof staged!=='boolean')throw Error('人物暂存选项无效');
  if(staged&&this.locomotion)throw Error('暂存选项只用于创建新人物');
  if(staged&&(!Array.isArray(spawnPosition)||spawnPosition.length!==3||!spawnPosition.every(Number.isFinite)||!Number.isFinite(spawnYaw)))throw Error('暂存人物需要有效的站位和朝向');
  if(this.locomotion)requireCharacterIdle(this,'重置人物');
  if(this.npcId)this.w.population?.guardReset(this);this.cancelPreflight();
  this.strengthLastLengths=null;this.strengthLastObjectVelocity=null;
  // Candidate creation shares the world read-only. It neither recreates rigid
  // bodies nor releases live contact constraints before the character commit.
  if(!staged){this.w.physics.syncScene();this.clearOwnedManipulation();this.w.population?.releaseObjects(this);}
  const spawn=staged?[...spawnPosition]:findHumanSpawn(this.w,this.h);
  if(staged&&this.w.collision(spawn,bodyPhysicalProfile(this.h).bodyRadiusM+.06))throw Error('当前位置不能容纳暂存人物');
  this.pos=[spawn[0],this.h.bodyMetrics.restHipHeightM,spawn[2]];this.yaw=staged?spawnYaw:0;this.time=0;this.pendingPhysicsFinish=false;this.plan=null;this.index=0;this.skill=null;this.walkHandoff=false;this.phase='idle';this.phaseT=0;this.phaseWallT=0;this.paused=false;this.held=null;this.grips=null;this.lastObject=null;this.error=null;this.route=[];this.routeIndex=0;this.feet={left:{p:[spawn[0]-this.h.bodyMetrics.stance.footHalfSpacingM,this.h.bodyMetrics.skinSoleHeightM,spawn[2]+this.h.bodyMetrics.stance.ankleForwardM],yaw:0},right:{p:[spawn[0]+this.h.bodyMetrics.stance.footHalfSpacingM,this.h.bodyMetrics.skinSoleHeightM,spawn[2]+this.h.bodyMetrics.stance.ankleForwardM],yaw:0}};this.swing=null;this.nextFoot='left';this.sinceStep=0;this.evidence=[];this.stats={completed:0,failed:0,graspEstablished:0,heldFrames:0,maxGripDisagreementM:0,maxPalmResidualM:0,maxBoneLengthErrorM:0,maxFootPositionErrorM:0,objectMovesWithoutContact:0,physicsSteps:0,physicsObjectMotionFrames:0,maxPhysicalGripErrorM:0,placementSettledChecks:0};this.lastSafe=null;this.gaitSignal=0;this.gaitBlend=0;this.walkSpeed=0;this.pelvisDrop=0;this.locomotion=new NaturalLocomotion(this);this.clock=new MotionLab.FixedClock();this.h.pose();this.basic=new BasicController(this);this.saveSafe();}
 cancel(){this.cancelPreflight();this.w.population?.releaseObjects(this);if(this.held){if(this.plan)this.plan.steps=this.plan.steps.slice(0,this.index+1);this.error=null;this.paused=true;this.log('当前仍保持物体抓握。请先完成放置，再编辑训练场景');return{stopped:false,paused:true,heldObject:this.held.id,requiresRelease:true}}this.plan=null;this.index=0;this.skill=null;this.route=[];this.routeIndex=0;this.error=null;this.paused=false;this.locomotion.stop();this.walkHandoff=false;this.basic?.requestCancel();this.phase=this.basic?.posture==='sitting'?'groundSit':this.basic?.posture==='lying'?'groundLie':'idle';this.phaseT=0;this.phaseWallT=0;this.log(this.basic?.busy?'后续任务已取消，正在完成当前支撑转换':'后续任务已取消，正在减速收脚');return{stopped:true,settling:!this.locomotion.isSettled()||this.basic?.busy,paused:false,heldObject:null}}
 submit(text,{cooperative=false}={}){
  if(this.characterEditInProgress)throw Error('人物正在更新，请等待完成后再提交任务');
  if(/^暂停$/.test(text.trim())){this.pausePreflight();this.paused=true;this.log('已暂停，现有接触与身体姿态保留');return{paused:true};}
  if(/^(停止|停下)$/.test(text.trim()))return this.cancel();
  if(/^(继续|恢复)$/.test(text.trim())){if(this.error)throw Error('请先停止并确认当前失败状态，再继续重试');this.paused=false;this.log('继续执行');return;}
  const p=parse(text,this.w,this.lastObject);
  if(cooperative){
   if(!this.activity().readyForTask)throw Error('身体仍在执行任务、验证或收脚');
   this.saveSafe();this.error=null;this.paused=false;
   this.startPreflight('submission',()=>simulateSemanticPlanSteps(this.w,this,p),forecast=>{
    if(!forecast.feasible)throw Error('整串指令预推演未通过：'+forecast.reasons.join('；'));
    this.plan=p;this.index=0;this.lastObject=p.lastObject;this.error=null;this.paused=false;this.log('已解析并验证 '+p.steps.length+' 项任务');
   });return p;
  }
  const forecast=simulateSemanticPlan(this.w,this,p);if(!forecast.feasible)throw Error('整串指令预推演未通过：'+forecast.reasons.join('；'));
  if(this.basic.busy){this.basic.replacePending(p);this.paused=false;return p;}
  if(this.skill||this.held)throw Error('当前移动或持物任务尚未结束，请等待完成或暂停检查；现有抓握保持不变');
  this.cancelPreflight();this.plan=p;this.index=0;this.lastObject=p.lastObject;this.error=null;this.paused=false;
  this.log('已解析 '+p.steps.length+' 项任务');return p;
 }

 validateSemanticPlan(p){
  const errors=[],allowed=new Set(['walk','turn','carry','push','sit','lie','stand','greet','wave','salute']);
  if(!p||p.schema!=='knowledge_human/checked_semantic_plan@1.0')errors.push('计划 schema 无效');
  if(!Array.isArray(p?.steps)||p.steps.length<1||p.steps.length>64)errors.push('步骤列表无效');
  for(const st of p?.steps||[]){
   if(!st||typeof st!=='object'){errors.push('步骤无效');continue}
   for(const k of Object.keys(st))if(!['type','objectId','targetId','relation','referenceFrame','duration','direction','distanceM','angleDeg','headingDeg'].includes(k))errors.push('禁止协议外字段：'+k);
   if(R2_UNSOURCED_ACTIONS.includes(st.type))errors.push('该动作尚未接入实测来源：'+st.type);if(!allowed.has(st.type))errors.push('不支持的语义技能：'+st.type);
   if(st.type==='turn'){try{motionTurnYaw(st,this.yaw);if(st.angleDeg!=null&&st.headingDeg!=null)throw Error('转向角度不能同时使用相对和绝对值');}catch(e){errors.push(e.message);}}else if(st.angleDeg!=null||st.headingDeg!=null)errors.push('朝向角度只用于转向');
   const relative=st.type==='walk'&&st.direction!=null;
   if(relative){if(!['forward','backward','left','right'].includes(st.direction)||!Number.isFinite(st.distanceM)||st.distanceM<.1||st.distanceM>100||st.referenceFrame!=='self'||st.targetId||st.objectId||st.relation)errors.push('相对行走参数无效');}
   else if(st.direction!=null||st.distanceM!=null)errors.push('方向和距离只用于相对行走');
   if(['walk','carry','push'].includes(st.type)&&!relative&&!this.w.get(st.targetId))errors.push('目标不存在：'+st.targetId);
   if(['carry','push'].includes(st.type)){const o=this.w.objects.find(o=>o.id===st.objectId);if(!o||o.movable===false)errors.push('物体不可移动：'+st.objectId);if(st.objectId===st.targetId)errors.push('目标与物体相同')}
   if(st.relation&&!['inside','near','left','right','front','behind'].includes(st.relation))errors.push('位置关系无效');
   if(st.referenceFrame&&!['world','self'].includes(st.referenceFrame))errors.push('坐标系无效');
   if(st.duration!=null&&(!Number.isFinite(st.duration)||st.duration<.1||st.duration>30||!['greet','wave','salute'].includes(st.type)))errors.push('时间参数无效');
  }
  return{ok:errors.length===0,errors};
 }
 submitPlan(p){if(this.characterEditInProgress)throw Error('人物正在更新，请等待完成后再提交任务');const check=this.validateSemanticPlan(p);if(!check.ok)throw Error(check.errors.join('；'));if(!this.activity().readyForTask)throw Error('身体仍在执行任务或收脚');const forecast=simulateSemanticPlan(this.w,this,{steps:p.steps});if(!forecast.feasible)throw Error('整串指令预推演未通过：'+forecast.reasons.join('；'));this.plan=JSON.parse(JSON.stringify(p));this.index=0;this.lastObject=p.steps.filter(s=>s.objectId).at(-1)?.objectId||this.lastObject;this.error=null;this.paused=false;this.log('收到大脑结构化计划：'+p.steps.length+' 项');return this.plan;}
 relationDirection(step){return relationDirectionForActor(step,{yaw:this.yaw})}
 enter(p){this.phase=p;this.phaseT=0;this.phaseWallT=0;this.log(({floorAlign:'检查空地并转身调整站位',sitDown:'屈髋屈膝，降到地面坐姿',lieDown:'手臂辅助，逐步躺到地面',standPrepare:'保持脚掌支撑并调整起身准备姿势',standUp:'收腿并起身站稳',greet:'抬臂打招呼',salute:'右手抬至眉侧敬礼',approach:'根据当前物体位置寻路',settle:'站稳并调整朝向',reach:'屈髋屈膝，肩臂腕联合趋近',close:'验证双掌接触位置与朝向',lift:'双掌约束成立，起身抬起',travel:'携物步行，支撑脚锁定',placeSettle:'保持双掌抓握并对齐放置站位',lower:'目标区内下蹲放置',release:'检查落地后解除抓握',rise:'松手并恢复站立',pushTravel:'持续掌面接触推动',wave:'肩带、手臂和手掌联合挥手',walk:'按实时位置走向目标',turn:'换脚转向'})[p]||p)}
 begin(){
  if(!this.plan||this.index>=this.plan.steps.length){this.plan=null;this.phase='idle';return}
  this.skill={...this.plan.steps[this.index]};const s=this.skill;
  if(this.basic.begin(s))return;if(s.type==='wave'){this.enter('wave');return}
  const t=this.w.get(s.targetId);
  if(s.type==='walk'){const actor=actorForReasoning(this),end=walkDestination(this.w,actor,s,t);this.route=walkRoute(this.w,actor,s,end,bodyPhysicalProfile(this.h).bodyRadiusM);s.startPosition=[...this.pos];s.endPosition=[...end];this.routeIndex=0;this.walkHandoff=false;this.enter('walk');return}
  if(s.type==='turn'){s.turnTargets=motionTurnPlan(s,this.yaw);s.turnIndex=0;this.enter('turn');return;}
  if(!t)throw Error('目标已不存在');
  const o=this.w.get(s.objectId);if(!o||o.held||(o.heldOwner&&o.heldOwner!==this.npcId))throw Error('操作物体不可用');if(o.movable===false)throw Error(`${o.name} 是固定环境物体，只能作为导航或避障目标`);
  this.w.population?.claimObject(this,o.id,s.targetId);
  this.requireStableObject(o);
  s.o=o;s.target=t;
  this.startPreflight('transport',()=>physicalAnalyzeStepSteps(this.w,actorForReasoning(this),this.plan.steps[this.index]),capability=>{
   if(!capability.feasible)throw Error(capability.reasons.join('；'));
   const transport=capability.transport,dir=transport.approachDirection;
   s.target=this.w.get(s.targetId);
   s.dest=[...transport.destination];s.strengthPreflight=capability.strength;s.carryConfiguration=transport.carryConfiguration;
   s.approachYaw=Math.atan2(dir[0],dir[2]);s.finalYaw=transport.bodyYaw;s.transferEnd=[...transport.bodyEnd];
   this.route=transport.approach.map(p=>[...p]);this.routeIndex=0;this.enter('approach');
  });
 }
 finish(){this.cancelPreflight();if(this.w.population?.physicsTickActive){this.pendingPhysicsFinish=true;return;}const wasPending=this.pendingPhysicsFinish;this.pendingPhysicsFinish=false;const s=this.skill;if(wasPending&&s.o){const state=this.w.physics.objectState(s.o.id);if(!state?.supported||!state.settled||!this.placementAtTarget(s))return;}this.evidence.push({step:this.index,type:s.type,objectId:s.objectId||null,targetId:s.targetId||null,completion:'verified',time:this.time,objectPosition:s.o?[...s.o.p]:null,objectPhysics:s.o?this.w.physics.objectState(s.o.id):null});this.stats.completed++;this.log('完成：'+({carry:'搬运并放置',push:'推动',walk:'到达目标',turn:'转向完成',wave:'挥手',greet:'打招呼',salute:'敬礼',sit:'坐在地上',lie:'躺在地上',stand:'起身站立'})[s.type]);this.index++;this.walkHandoff=s.type==='walk'&&this.plan?.steps[this.index]?.type==='walk';this.skill=null;this.w.population?.releaseObjects(this);this.phase='idle';this.phaseT=0;this.phaseWallT=0;if(this.plan&&this.index>=this.plan.steps.length){this.log('全部任务已验证完成');this.plan=null}}
 saveSafe(){
  const task=this.skill?{...this.skill,o:undefined,target:undefined}:null;
  const ownedIds=[this.skill?.o?.id,this.held?.id].filter(Boolean);
  this.lastSafe={pose:this.locomotion.pose.snapshot(),kernel:this.locomotion.engine.snapshot(),
   locomotion:this.locomotion.snapshotExecution(),
   state:structuredClone({pos:this.pos,yaw:this.yaw,feet:this.feet,swing:this.swing,time:this.time,pendingPhysicsFinish:this.pendingPhysicsFinish,phase:this.phase,phaseT:this.phaseT,phaseWallT:this.phaseWallT,plan:this.plan,index:this.index,
    skill:task,route:this.route,routeIndex:this.routeIndex,walkHandoff:this.walkHandoff,grips:this.grips,lastObject:this.lastObject,stats:this.stats,strengthLastLengths:this.strengthLastLengths,strengthLastObjectVelocity:this.strengthLastObjectVelocity}),
   heldId:this.held?.id||null,objectId:this.skill?.o?.id||null,targetId:this.skill?.target?.id||null,evidenceLength:this.evidence.length,
   basic:structuredClone(Object.fromEntries(Object.entries(this.basic).filter(([key])=>key!=='a'))),
   objects:this.w.objects.filter(o=>!this.w.population||o===this.skill?.o||o===this.held).map(o=>({id:o.id,p:[...o.p],q:[...o.q],held:o.held,heldOwner:o.heldOwner??null,moveCount:o.moveCount})),worldRevision:this.w.revision,
   physics:this.w.population?this.w.physics.captureObjects(ownedIds,this.npcId):this.w.physics.capture(),strength:structuredClone(this.strength.state),assessment:structuredClone(this.strength.lastAssessment),routine:structuredClone(this.w.routineState)};
 }
 fail(message){this.cancelPreflight();
  const saved=this.lastSafe,population=this.w.population;
  if(saved){
   Object.assign(this,structuredClone(saved.state));this.held=saved.heldId?this.w.get(saved.heldId):null;
   if(this.skill){if(saved.objectId)this.skill.o=this.w.get(saved.objectId);if(saved.targetId)this.skill.target=this.w.get(saved.targetId);}
   const rollbackObjects=saved.objects.filter(before=>{const o=this.w.get(before.id);return o&&(!population||((before.id===saved.objectId||before.id===saved.heldId)&&(!o.heldOwner||o.heldOwner===this.npcId)));});
   const candidateIds=rollbackObjects.map(o=>o.id),restoredIds=population?this.w.physics.restoreObjects(saved.physics,candidateIds,this.npcId):candidateIds;
   for(const before of rollbackObjects)if(restoredIds.includes(before.id))Object.assign(this.w.get(before.id),{p:[...before.p],q:[...before.q],held:before.held,heldOwner:before.heldOwner,moveCount:before.moveCount});
   // One actor's failure must not rewind another actor or the shared environment.
   if(!population){this.w.physics.restore(saved.physics);this.w.revision=saved.worldRevision;this.w.routineState=structuredClone(saved.routine);}
   if(population&&this.held?.heldOwner!==this.npcId){this.held=null;this.grips=null;}
   this.strength.state=structuredClone(saved.strength);this.strength.lastAssessment=structuredClone(saved.assessment);
   Object.assign(this.basic,structuredClone(saved.basic));this.evidence.length=saved.evidenceLength;
   this.locomotion.engine.state=structuredClone(saved.kernel);this.locomotion.restoreExecution(saved.locomotion);this.locomotion.sync();
   // Floor extensions have a different pelvis height from the navigation root.
   this.pos=[...saved.state.pos];this.yaw=saved.state.yaw;this.feet=structuredClone(saved.state.feet);this.swing=structuredClone(saved.state.swing);this.locomotion.pose.restore(saved.pose);
  }
  population?.releaseObjects(this);
  this.error=message;this.stats.failed++;this.paused=true;this.log('执行已阻断：'+message);this.evidence.push({step:this.index,completion:'failed',reason:message,time:this.time});
 }
 moveAlong(dt,speed=.48){return this.locomotion.move(dt,speed);}
 manipulationPace(){return this.held&&!this.skill?.releasing?(this.skill?.coupling?.pace??1):1;}
 manipulationAligned(){const c=this.skill?.coupling;return !c||(c.intentErrorM<.035&&c.angleErrorRad<.10);}
 manipulationProgress(dt){
  // Only the task reference slows down. Physics, fatigue and recovery retain
  // real fixed time, including while the gait brakes to a planted stance.
  return this.held&&['lift','lower'].includes(this.phase)?dt*this.manipulationPace():dt;
 }
 governManipulation(hands,dt){
  const s=this.skill,o=this.held,c=s.coupling??={pace:1,braking:false,blockedS:0};
  const left=compose(hands.left,inverse(this.grips.left)),right=compose(hands.right,inverse(this.grips.right));
  const intent={p:mix(left.p,right.p,.5),q:qslerp(left.q,right.q,.5),positionDisagreement:dist(left.p,right.p),angleDisagreement:qangle(left.q,right.q)};
  c.intent=frame(intent.p,intent.q);
  // Limit spring extension without hiding the original tracking error from
  // feedback. Keep force intention independent of the solved palm pose.
  const lead=s.type==='push'?.035:.05,delta=sub(intent.p,o.p),angle=qangle(o.q,intent.q);
  let p=add(o.p,mul(delta,Math.min(1,lead/Math.max(1e-9,len(delta)))));
  let q=qslerp(o.q,intent.q,Math.min(1,.12/Math.max(1e-9,angle)));
  const previous=s.lastManipulationTarget||frame(o.p,o.q),travel=dist(previous.p,p),turn=qangle(previous.q,q);
  p=mix(previous.p,p,Math.min(1,dt*(s.type==='push'?.45:.8)/Math.max(1e-9,travel)));
  q=qslerp(previous.q,q,Math.min(1,dt/Math.max(1e-9,turn)));
  c.target=frame(p,q);
  return {...intent,p,q};
 }
 requireStableObject(o){
  const state=this.w.physics.objectState(o.id);
  if(!state||!state.supported||state.speedMps>.08||state.angularSpeedRadS>.25)throw Error('物体正在移动、倾倒或没有稳定支撑，请等待它静止后再操作');
  return state;
 }
 stepPhysics(dt){
  if(this.w.population){this.w.population.deferPhysics(this,dt);return;}
  const before=this.w.objects.map(o=>({id:o.id,p:[...o.p]}));
  this.w.physics.step(dt,this);this.stats.physicsSteps++;
  for(const previous of before){const o=this.w.get(previous.id);if(o&&dist(previous.p,o.p)>1e-8)this.stats.physicsObjectMotionFrames++;}
  // Free fall and residual sliding are legitimate motion without palm contact.
  // Keep the legacy anomaly count separate from these solver-driven changes.
 }
 clearOwnedManipulation(){
  const id=this.held?.id||this.skill?.o?.id;
  if(id)this.w.physics.clearManipulation(id);
 }
 assessManipulationFeedback(dt){
  if(!this.held||this.skill?.releasing||this.preflightWaiting||this.skill?.releaseVerified)return;
  const state=this.w.physics.objectState(this.held.id),s=this.skill;
  if(!state)throw Error('操作物体缺少刚体状态');
  const error=Number.isFinite(state.gripErrorM)?state.gripErrorM:0;
  this.stats.maxPhysicalGripErrorM=Math.max(this.stats.maxPhysicalGripErrorM,error);
  const c=s.coupling??={pace:1,braking:false,blockedS:0};
  const intentError=c.intent?dist(c.intent.p,this.held.p):error,angleError=c.intent?qangle(c.intent.q,this.held.q):0;
  const utilization=Math.max(state.forceUtilization||0,state.torqueUtilization||0);
  c.intentErrorM=intentError;c.angleErrorRad=angleError;c.forceUtilization=utilization;c.contactIds=[...state.contactIds];
  // Hysteresis prevents stop/start chatter. Saturation alone slows the action
  // but cannot deadlock a successfully supported heavy load.
  if(intentError>.09||angleError>.28)c.braking=true;
  else if(intentError<.035&&angleError<.10)c.braking=false;
  const trackingPace=Math.min(clamp((.09-intentError)/.065,0,1),clamp((.28-angleError)/.20,0,1));
  const effortPace=utilization>.8?clamp(1-(utilization-.8)*3,.25,1):1;
  const desired=c.braking?0:Math.min(trackingPace,effortPace);
  c.pace=c.braking?0:c.pace+(desired-c.pace)*(1-Math.exp(-dt/(desired<c.pace?.07:.45)));
  const stalled=(intentError>.045&&state.speedMps<.015)||(angleError>.16&&state.angularSpeedRadS<.04);
  c.blockedS=stalled?c.blockedS+dt:Math.max(0,c.blockedS-dt*2);
  c.reason=c.braking?'waiting-for-object':stalled?'contact-resistance':utilization>.8?'force-limit':'tracking';
  if(intentError>.24||angleError>.65||c.blockedS>2.5)throw Error(s.type==='push'?'推动受阻，减速等待后物体仍未跟随':'物理抓握受阻或偏转过大，无法继续搬运');
  const r=graspResidual(this.h,this.held,this.grips);
  const palmError=Math.max(...Object.values(r).map(v=>v.positionM)),palmAngle=Math.max(...Object.values(r).map(v=>v.angleRad));
  this.stats.maxPalmResidualM=Math.max(this.stats.maxPalmResidualM,palmError);
  s.physicalContactErrorS=palmError>.035||palmAngle>.20?(s.physicalContactErrorS||0)+dt:0;
  if(palmError>.10||palmAngle>.5||s.physicalContactErrorS>.4)throw Error('双掌已无法跟随物体的实际接触位置');
 }
 releaseObject(s){
  const state=this.w.physics.objectState(s.o.id);
  if(!state?.supported){if(this.phaseT>3)throw Error('物体没有实际支撑接触，禁止释放');return;}
  if(state.speedMps>.08||state.angularSpeedRadS>.25){if(this.phaseT>3)throw Error('松手前物体仍未稳定，禁止解除接触');return;}
  if(s.releaseVerified){
   const verified=s.releaseVerified;if(verified.input!==this.preflightInput(true)){delete s.releaseVerified;return;}
   const translation=dist(verified.object.p,s.o.p),angle=qangle(verified.object.q,s.o.q),radius=this.w.physics.bodies.get(s.o.id).body.boundingRadius;
   const displacement=translation+2*radius*Math.sin(angle/2);
   // The fresh, unfrozen physics step must independently establish support.
   // Exact signed distances are 1-Lipschitz: this bound rechecks the whole
   // frozen release path against the actual post-resume object transform.
   if(verified.plan.minimumPathClearanceM-displacement<.008||verified.plan.minimumHandClearanceM-displacement<.0005){delete s.releaseVerified;return;}
   s.releaseMotionPlan=verified.plan;delete s.releaseVerified;s.releasing=true;this.w.physics.beginRelease(s.o.id,this.npcId);
   s.placementStableS=0;this.grips=null;this.strengthLastObjectVelocity=null;this.enter('rise');return;
  }
  // The force contact ends now. Its owner-pair collision exclusion ends only
  // after the free arms have withdrawn from the physical object's surface.
  s.releaseClearance=this.w.physics.ownerClearance(s.o.id,this);
  s.releasePalms={left:frame(this.h.palm('left').p,this.h.palm('left').q),right:frame(this.h.palm('right').p,this.h.palm('right').q)};
  s.releaseWrists=Object.fromEntries(['left','right'].map(side=>{const wrist=this.h.byId.get(side+'_hand').world,shoulder=this.h.byId.get(side+'_upperArm').world;return[side,{offset:sub(wrist.p,shoulder.p),q:[...wrist.q]}];}));
  this.startPreflight('release',()=>this.chooseReleaseMotionSteps(s),plan=>{s.releaseVerified={plan,object:frame(s.o.p,s.o.q),input:this.preflightInput(true),waitS:0};});
 }
 releaseMotion(s,elapsed,plan=s.releaseMotionPlan){
  const withdraw=plan.withdrawM,withdrawS=withdraw>0?.6:0,t=smoother(clamp((elapsed-withdrawS)/1.7,0,1)),crouch=1-t;
  const candidate=this.locomotion.pose.build(motionContactDescriptor(this,null,crouch,'rise'));
  const distance=withdraw*smoother(clamp(elapsed/Math.max(withdrawS,.001),0,1));
  const hands=Object.fromEntries(['left','right'].map(side=>{
   const shoulder=candidate.frames.get(side+'_upperArm'),rest=candidate.frames.get(side+'_hand'),start=s.releaseWrists[side];
   // The palm's local -Z points away from its contacted object surface.
   // Withdraw at the contact height before the rising elbow can sweep inward.
   const away=rotate(start.q,[0,0,-distance]),offset=add(start.offset,away);
   const wrist=frame(add(shoulder.p,mix(offset,sub(rest.p,shoulder.p),t)),qslerp(start.q,rest.q,t));
   return[side,compose(wrist,frame(this.h.bodyMetrics.palmContact))];
  }));
  return{crouch,hands};
 }
 chooseReleaseMotion(s){
  return motionDrainPreflight(this.chooseReleaseMotionSteps(s));
 }
 *chooseReleaseMotionSteps(s){
  const failures=[];
  if(s.releaseClearance.minimumClearanceM<0)throw Error('释放起点已有非接触身体穿入物体，保持当前安全状态');
  // Bounded task-time planning uses the exact pose/proxy path executed below.
  // Keeping the existing path first avoids adding a pause to already safe jobs.
  for(const withdrawM of [0,.06,.10,.14,.18]){
   const plan={kind:withdrawM?'surface-normal-then-rise':'rise',withdrawM:withdrawM*this.h.bodyMetrics.statureScale,durationS:1.7+(withdrawM?.6:0),sampleHz:60};
   try{
    const count=Math.ceil(plan.durationS*plan.sampleHz);let minimumClearanceM=Infinity,minimumPathClearanceM=Infinity,minimumHandClearanceM=Infinity;
    for(let i=0;i<=count;i++){
     yield;
     const motion=this.releaseMotion(s,plan.durationS*i/count,plan),candidate=this.locomotion.pose.build({...motionContactDescriptor(this,motion.hands,motion.crouch,'rise'),hands:motion.hands});
     this.locomotion.pose.validate(candidate);
     const clearance=this.w.physics.ownerClearance(s.o.id,this,candidate.frames);
     minimumPathClearanceM=Math.min(minimumPathClearanceM,clearance.minimumClearanceM);
     const crossing=clearance.rows.find(r=>r.clearanceM<.008);
     if(crossing)throw Error(crossing.id+' 撤手路径进入物体');
     if(s.o.shape==='box'){
      const hand=contactHandObjectClearance(this.h,candidate.frames,this.w.physics,s.o.id);
      minimumHandClearanceM=Math.min(minimumHandClearanceM,hand.minimumClearanceM);
      if(hand.minimumClearanceM<.0005)throw Error(hand.worstSegment+' 手指撤离路径进入物体');
     }
     for(const proxy of this.w.physics.actorSpheres(this.h,candidate.frames))if(this.w.collision(proxy.p,proxy.r,[s.o.id]))throw Error(proxy.id+' 撤手路径被环境阻挡');
     if(i===count){minimumClearanceM=clearance.minimumClearanceM;if(minimumClearanceM<.008)throw Error('恢复站姿后仍与物体接触');}
    }
    return{...plan,parameterSamples:count+1,minimumClearanceM,minimumPathClearanceM,minimumHandClearanceM};
   }catch(error){failures.push(error.message);}
  }
  throw Error('未找到安全撤手路径，保持抓握：'+[...new Set(failures)].join('；'));
 }
 verifyPlacement(s,dt){
  if(s.releasing){
   const clearance=this.w.physics.ownerClearance(s.o.id,this,null,true);
   s.releaseMinimumClearanceM=clearance.minimumClearanceM;
   if(this.phaseT>5)throw Error('松手后人物未能安全离开物体，接触所有权保持，等待修复');
   if(this.phaseT<s.releaseMotionPlan.durationS||this.swing||clearance.minimumClearanceM<.008)return;
   this.clearOwnedManipulation();s.o.held=false;if(this.w.population)s.o.heldOwner=null;this.held=null;s.releasing=false;
   s.ownerCollisionRestored=true;s.placementStableS=0;s.collisionRestoredAt=this.time;this.w.revision++;
   return;
  }
  const state=this.w.physics.objectState(s.o.id);
  s.placementStableS=state?.supported&&state.settled?(s.placementStableS||0)+dt:0;
  if(this.phaseT>8)throw Error('放置后物体仍未稳定，任务未完成');
  if(this.phaseT<1.7||this.swing||s.placementStableS<.3)return;
  this.stats.placementSettledChecks++;
  if(!this.placementAtTarget(s))throw Error('物体稳定后的实际位置未通过目标区域验证');
  this.finish();
 }
 placementAtTarget(s){
  return this.relationDirection(s)?horizontal(s.o.p,s.dest)<.08:s.target.id.startsWith('Z')?this.w.inside(s.o,s.target):horizontal(s.o.p,s.target.p)<1.1&&!this.w.collision(s.o.p,s.o.r,[s.o.id]);
 }
 pruneHistory(){if(this.evidence.length>128)this.evidence.splice(0,this.evidence.length-128);if(this.basic.phaseLog.length>32)this.basic.phaseLog.splice(0,this.basic.phaseLog.length-32);}
 advanceStrength(dt,assessment=null){this.strength.advance(dt,assessment);if(!this.w.population)advanceRoutineEnvironment(this.w,dt);if(!this.held){this.strengthLastLengths=null;this.strengthLastObjectVelocity=null;}}
 gait(dt,moving,measuredSpeed=null){this.locomotion.update(dt,moving,measuredSpeed);}
 handsFor(goal){return Object.fromEntries(['left','right'].map(side=>[side,compose(goal,this.grips[side])]))}
 carryingGoal(){const c=this.skill.carryConfiguration;return frame(add([this.pos[0],c?.heightM??motionCarryHeight(this.h),this.pos[2]],rotate(qy(this.yaw),[0,0,c?.forwardM??motionCarryForward(this.h)])),qm(qy(this.yaw),this.skill.qRel))}
 tick(dt){if(this.characterEditInProgress)return 0;return this.clock.advance(dt,step=>this.tickFixed(step),this.paused);}
 tickFixed(dt){if(this.paused)return;if(this.preflightWaiting){try{this.w.physics.syncScene();this.advancePreflight(dt);this.stepPhysics(dt);}catch(error){this.fail(error.message);}return;}if(this.skill?.releaseVerified){try{this.w.physics.syncScene();this.saveSafe();this.time+=dt;this.skill.releaseVerified.waitS+=dt;if(this.skill.releaseVerified.waitS>1.5)throw Error("解除预检暂停后物体未重新获得真实支撑");this.releaseObject(this.skill);this.stepPhysics(dt);}catch(error){this.fail(error.message);}return;}this.w.physics.syncScene();this.saveSafe();this.time+=dt;this.phaseWallT+=dt;this.phaseT+=this.manipulationProgress(dt);if(!this.skill&&this.plan&&(this.basic.posture!=='standing'||this.walkHandoff||this.locomotion.canTransition(this.plan.steps[this.index]?.type))){try{this.begin()}catch(e){this.fail(e.message);return}}if(this.preflightWaiting){try{this.stepPhysics(dt);}catch(error){this.fail(error.message);}return;}if(this.basic.busy||this.basic.posture!=='standing'){try{this.basic.update(dt);this.advanceStrength(dt,strengthFreeActivity(this));this.stepPhysics(dt);}catch(e){this.fail(e.message)}return;}let moving=false,crouch=0,lean=.015,hands=null,manipulationTarget=null,curl=0,wave=0;const s=this.skill;try{
 if(s){if(this.held&&['lift','lower'].includes(this.phase)&&this.phaseWallT>15)throw Error('抬放动作等待物理响应超时');if(this.phase==='turn'&&!this.locomotion.turnInPlace(s.turnTargets[s.turnIndex],dt)){s.turnIndex++;if(s.turnIndex>=s.turnTargets.length)this.finish();}
 if(this.phase==='walk'||this.phase==='approach'){moving=this.moveAlong(dt);if(!moving&&this.routeIndex>=this.route.length){if(s.type==='walk'){if(this.plan?.steps[this.index+1]?.type==='walk'||this.locomotion.canTransition(this.plan?.steps[this.index+1]?.type))this.finish()}else this.enter('settle')}}
 if(this.phase==='settle'){const d=angleDiff(s.approachYaw,this.yaw);this.locomotion.turnInPlace(s.approachYaw,dt);if(Math.abs(d)<.015&&this.locomotion.canTransition('carry')){this.requireStableObject(s.o);this.grips=graspFrames(s.o,this.yaw,s.type==='push');s.initialPalms={left:frame(this.h.palm('left').p,this.h.palm('left').q),right:frame(this.h.palm('right').p,this.h.palm('right').q)};s.reachStart=motionFreeHandEndpoints(this.h,new Map(this.h.joints.map(j=>[j.id,j.world])),s.initialPalms);s.startObject=frame(s.o.p,s.o.q);s.qRel=qm(inv(qy(this.yaw)),s.o.q);this.startPreflight('reach',()=>{this.grips=graspFrames(s.o,this.yaw,s.type==='push');s.startObject=frame(s.o.p,s.o.q);s.qRel=qm(inv(qy(this.yaw)),s.o.q);return motionChooseContactSteps(this.h,this.pos,this.yaw,this.handsFor(s.startObject),this.w,[s.o.id],{objectPose:s.startObject,grips:s.type==='carry'?this.grips:null,carryConfiguration:s.carryConfiguration});},contact=>{s.contactPose=contact;this.enter('reach')})}}
 if(this.phase==='reach'){const t=smoother(this.phaseT/1.7);crouch=t;lean=.91*t;const goal=this.handsFor(s.startObject);hands=goal;if(this.phaseT>=1.7){s.contactWait=0;this.enter('close')}}
 if(this.phase==='close'){this.requireStableObject(s.o);s.startObject=frame(s.o.p,s.o.q);crouch=1;lean=.91;hands=this.handsFor(s.startObject);curl=s.type==='push'?0:clamp(this.phaseT/.50,0,1);}
 if(this.phase==='lift'){const t=smoother(this.phaseT/2.1);crouch=1-t;lean=.91*crouch+.035*t;const carry=this.carryingGoal(),goal=frame(mix(s.startObject.p,carry.p,t),qslerp(s.startObject.q,carry.q,t));hands=this.handsFor(goal);curl=1;if(this.phaseT>=2.1&&this.manipulationAligned()){this.route=this.w.path(this.pos,s.transferEnd,carryRouteRadius(s.o,bodyPhysicalProfile(this.h),s.carryConfiguration),[s.o.id]);this.routeIndex=0;this.enter('travel')}}
 if(this.phase==='travel'){moving=this.moveAlong(dt,.43);hands=this.handsFor(this.carryingGoal());curl=1;lean=.035;if(!moving&&this.routeIndex>=this.route.length&&!this.swing){this.enter('placeSettle')}}
 if(this.phase==='placeSettle'){const d=angleDiff(s.finalYaw,this.yaw);this.locomotion.turnInPlace(s.finalYaw,dt);hands=this.handsFor(this.carryingGoal());curl=1;lean=.035;if(Math.abs(d)<=.016&&this.locomotion.canTransition('carry')){s.lowerStart=frame(s.o.p,s.o.q);this.startPreflight('lower',()=>{s.lowerStart=frame(s.o.p,s.o.q);return motionChooseContactSteps(this.h,this.pos,this.yaw,this.handsFor(frame(s.dest,s.lowerStart.q)),this.w,[s.o.id],{objectPose:frame(s.dest,s.lowerStart.q),grips:this.grips,carryConfiguration:s.carryConfiguration});},contact=>{s.contactPose=contact;this.enter('lower')})}}
 if(this.phase==='lower'){const t=smoother(this.phaseT/2.1);crouch=t;lean=.035*(1-t)+.91*t;const dest=frame(s.dest,s.lowerStart.q);hands=this.handsFor(frame(mix(s.lowerStart.p,dest.p,t),s.lowerStart.q));curl=1;if(this.phaseT>=2.1&&this.manipulationAligned())this.enter('release')}
 if(this.phase==='release'){crouch=1;lean=.91;hands=this.handsFor(frame(s.dest,s.lowerStart.q));curl=1-clamp(this.phaseT/.5,0,1);}
 if(this.phase==='rise'){curl=0;}
 if(this.phase==='pushTravel'){
  crouch=1;moving=this.moveAlong(dt,.22);
  if(!moving&&this.routeIndex>=this.route.length){s.lowerStart=frame(s.o.p,s.o.q);hands=this.handsFor(frame(s.dest,s.o.q));this.enter('release');}
 }
 if(this.phase==='wave'){wave=smoother(Math.min(this.phaseT/.6,(3.0-this.phaseT)/.6));if(this.phaseT>3.0){wave=0;this.finish()}}
 }
 if(this.preflightWaiting){this.stepPhysics(dt);return;}
 // Only the lab controller advances root motion and independent foot anchors.
 this.gait(dt,moving);
 if(s&&this.phase==='reach')hands=motionReachHands(this,this.handsFor(s.startObject),smoother(this.phaseT/1.7));
 // Execute the same checked free-wrist path used by release planning.
 if(s&&this.phase==='rise'){
  const motion=this.releaseMotion(s,this.phaseT);crouch=motion.crouch;hands=motion.hands;
 }
 if(s&&this.phase==='pushTravel'){const delta=sub(this.locomotion.engine.state.root,s.pushStartBody);delta[1]=0;s.pushGoal=frame(add(s.pushStartObject.p,delta),s.pushStartObject.q);hands=this.handsFor(s.pushGoal);}
 // The actuator follows governed intent; IK follows the latest solved body.
 // Feeding the visible palms back as the actuator target would erase the
 // spring extension and stop lifting/pushing as soon as the hands complied.
 if(this.held&&hands&&!s?.releasing){manipulationTarget=this.governManipulation(hands,dt);hands=this.handsFor(frame(this.held.p,this.held.q));}
 const descriptor=hands?motionContactDescriptor(this,hands,crouch):{};
 this.h.pose({...descriptor,hands,time:this.time,deltaTime:dt});
 if(s?.o&&['reach','close','lift','travel','placeSettle','lower','release','rise','pushTravel'].includes(this.phase)){
  motionRequireObjectClearance(this.h,this.w,s.o.id,null,null,0);
  if(s.o.shape==='box'){
   const hand=contactHandObjectClearance(this.h,null,this.w.physics,s.o.id);s.handContactClearance=hand;
   if(hand.minimumClearanceM<0)throw Error('手指骨段进入物体：'+hand.worstSegment+'，保持最后安全姿态');
  }
 }
 if(s?.releasing){
  const current=this.w.physics.ownerClearance(s.o.id,this);
  const crossing=current.rows.find(r=>r.clearanceM<0);
  if(crossing)throw Error('撤手路径进入物体：'+crossing.id+'，保持最后安全姿态');
 }
 if(s&&this.phase==='close'&&this.phaseT>.55){const r=graspResidual(this.h,s.o,this.grips),ok=Object.values(r).every(v=>v.positionM<.012&&v.angleRad<.07);if(ok){this.requireStableObject(s.o);this.w.population?.claimObject(this,s.o.id);this.stats.graspEstablished++;this.held=s.o;s.o.held=true;if(this.w.population)s.o.heldOwner=this.npcId;s.startObject=frame(s.o.p,s.o.q);s.qRel=qm(inv(qy(this.yaw)),s.o.q);this.strengthLastObjectVelocity={id:s.o.id,v:[...s.o.v]};this.grips=Object.fromEntries(['left','right'].map(side=>[side,compose(inverse(frame(s.o.p,s.o.q)),this.h.palm(side))]));if(s.type==='push'){s.pushStartBody=[...this.locomotion.engine.state.root];s.pushStartObject=frame(s.o.p,s.o.q);this.route=[straightPushRoute(this.w,s.o,s.dest,this.pos,bodyPhysicalProfile(this.h))];this.routeIndex=0;}this.enter(s.type==='push'?'pushTravel':'lift')}else if(this.phaseT>1.0)throw Error('双掌接触未成立：'+Math.round(Math.max(...Object.values(r).map(v=>v.positionM))*1000)+' mm')}
 if(this.held&&!s?.releasing){
  this.w.population?.claimObject(this,this.held.id);
  if(this.w.population&&this.held.heldOwner!==this.npcId)throw Error('该物体的抓握归属已变更');
  const measured=inferHeldFrame(this.h,this.grips),candidate=manipulationTarget||measured;
  if(measured.positionDisagreement>.04||measured.angleDisagreement>.16)throw Error('双掌实际姿态不一致，无法维持物理接触');
  if(candidate.positionDisagreement>.04||candidate.angleDisagreement>.16)throw Error('左右掌目标不一致，已保持上一有效姿势');
  if(s.lastManipulationTarget&&dist(candidate.p,s.lastManipulationTarget.p)>Math.max(.035,dt*2))throw Error('双掌目标移动超过接触控制速度上限');
  const effort=strengthRuntimeAssessment(this,candidate,dt);this.strength.lastAssessment=effort;
  if(!effort.feasible)throw Error('力量限制：'+strengthReason(effort));
  if(effort.physicsLimits.maxForceN<=0)throw Error('当前姿态没有剩余手部施力能力');
  this.w.physics.setManipulation(this.held,candidate,s.type,{...effort.physicsLimits,ownerId:this.npcId||null});
  s.lastManipulationTarget=frame(candidate.p,candidate.q);this.advanceStrength(dt,effort);this.strengthLastLengths=effort.request.lengthRatios;
  this.stats.heldFrames++;this.stats.maxGripDisagreementM=Math.max(this.stats.maxGripDisagreementM,measured.positionDisagreement);
 }
 if(!this.held||s?.releasing)this.advanceStrength(dt,strengthFreeActivity(this));
 this.stepPhysics(dt);if(!this.w.population)this.assessManipulationFeedback(dt);
 if(s&&this.phase==='release'&&this.phaseT>.52)this.releaseObject(s);
 if(s&&this.phase==='rise')this.verifyPlacement(s,dt);
 const d=this.h.diagnostics();this.stats.maxBoneLengthErrorM=Math.max(this.stats.maxBoneLengthErrorM,d.maxBoneLengthErrorM);
 for(const side of['left','right'])if(this.swing?.side!==side){
  const actual=this.h.legs[side].wrist.world,foot=this.locomotion.engine.state.feet[side],rocker=foot.rocker;
  // Measure the committed heel/forefoot against its independent world pivot.
  // The ankle is expected to move while that contact remains stationary.
  const local=rocker?.pitch?rotate(inv(this.h.sourceBind.get(side+'_foot').q),rocker.pivot):[0,0,0];
  const point=add(actual.p,rotate(actual.q,local)),target=rocker?.pitch?rocker.world:this.feet[side].p;
  this.stats.maxFootPositionErrorM=Math.max(this.stats.maxFootPositionErrorM,dist(point,target));
 }
 }catch(e){this.fail(e.message)}}
 activity(){return characterActivity(this);}
 diagnostics(){return{activity:this.activity(),strength:this.strength.report(),basic:this.basic.report(),locomotion:this.locomotion.report(),armSwing:{signal:this.gaitSignal,blend:this.gaitBlend,speedMPS:this.walkSpeed,mode:this.held?'grasp-priority':'contralateral-gait-coupling'},phase:this.phase,paused:this.paused,error:this.error,preflight:this.preflight?{...this.preflight}:null,activeStep:this.skill?{type:this.skill.type,objectId:this.skill.objectId,targetId:this.skill.targetId}:null,plan:this.plan?{steps:this.plan.steps,index:this.index}:null,heldObject:this.held?.id||null,stats:{...this.stats},completionEvidence:[...this.evidence],world:this.w.snapshot(),body:this.h.diagnostics(),interactionMode:'feedback-governed-rigid-body-manipulation',physicalCoupling:this.skill?.coupling?structuredClone(this.skill.coupling):null,physics:this.w.physics.snapshot(),forceDynamicsEnabled:true,forceDynamicsValidated:false,humanLocomotionDynamics:false,motionClock:{stepS:this.clock.step,ticks:this.clock.ticks,droppedSeconds:this.clock.droppedSeconds},physicalFeasibilityReasoning:true,physicalProfile:bodyPhysicalProfile(this.h),openLanguageUnderstanding:false,visualAcceptance:false,productionReady:false}}
}





