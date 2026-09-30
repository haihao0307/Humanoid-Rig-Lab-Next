/* Single-character foundation activities R1.
 * Adds executable run and jump commands without replacing the existing
 * contact-checked walk, pickup/carry and physics pipeline. */
const FOUNDATION_ACTIVITIES_R1=Object.freeze({
 version:'foundation-activities-r1',
 run:{minimumDistanceM:.5,maximumDistanceM:100,targetSpeedMps:2.25,minimumTempo:1,maximumTempo:4.2,accelerationS:1.05,decelerationDistanceM:1.25},
 jump:{minimumDistanceM:0,maximumDistanceM:1.2,compressionS:.28,extensionS:.14,flightS:.54,landingS:.24,recoveryS:.34,heightM:.34}
});
function foundationNumber(value,fallback){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function foundationSmooth01(value){const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);}
function foundationDirectionVector(yaw,direction='forward'){
 const forward=[Math.sin(yaw),0,Math.cos(yaw)],right=[Math.cos(yaw),0,-Math.sin(yaw)];
 return direction==='backward'?[-forward[0],0,-forward[2]]:direction==='left'?[-right[0],0,-right[2]]:direction==='right'?right:forward;
}
function foundationParseCommand(text){
 const raw=String(text||'').trim().replace(/\s+/g,'');
 let match=raw.match(/^(?:向)?(前|后|左|右)?(?:跑|跑步|奔跑)(?:([0-9]+(?:\.[0-9]+)?)米)?$/);
 if(match){const map={前:'forward',后:'backward',左:'left',右:'right'};return{type:'run',direction:map[match[1]]||'forward',distanceM:foundationNumber(match[2],5)};}
 match=raw.match(/^(?:向)?(前|后)?(?:跳|跳跃)(?:([0-9]+(?:\.[0-9]+)?)米)?$/);
 if(match){const map={前:'forward',后:'backward'};return{type:'jump',direction:map[match[1]]||'forward',distanceM:foundationNumber(match[2],0)};}
 match=raw.match(/^(?:原地)(?:跳|跳跃)$/);if(match)return{type:'jump',direction:'forward',distanceM:0};
 match=raw.match(/^(?:捡起|拾取|拿起)(.+?)(?:并|然后)?(?:搬到|拿到|送到)(.+)$/);
 if(match)return{type:'carryAlias',object:match[1],target:match[2]};
 return null;
}
function foundationRunTempo(state,dt,remainingM){
 const cfg=FOUNDATION_ACTIVITIES_R1.run,target=cfg.maximumTempo;
 const desired=remainingM<cfg.decelerationDistanceM?Math.max(cfg.minimumTempo,target*Math.max(.22,remainingM/cfg.decelerationDistanceM)):target;
 const tau=desired<state.tempo?.22:cfg.accelerationS;
 state.tempo=(state.tempo??cfg.minimumTempo)+(desired-(state.tempo??cfg.minimumTempo))*(1-Math.exp(-Math.max(0,dt)/Math.max(.01,tau)));
 return Math.max(cfg.minimumTempo,Math.min(cfg.maximumTempo,state.tempo));
}
function foundationJumpProfile(elapsed,distanceM=0){
 const cfg=FOUNDATION_ACTIVITIES_R1.jump,a=cfg.compressionS,b=a+cfg.extensionS,c=b+cfg.flightS,d=c+cfg.landingS,e=d+cfg.recoveryS;
 const total=e;let phase='compression',crouch=0,height=0,travel=0;
 if(elapsed<a){const u=foundationSmooth01(elapsed/a);crouch=u;travel=0;}
 else if(elapsed<b){const u=foundationSmooth01((elapsed-a)/cfg.extensionS);phase='extension';crouch=1-u;height=.06*u;travel=.06*u;}
 else if(elapsed<c){const u=Math.max(0,Math.min(1,(elapsed-b)/cfg.flightS));phase='flight';crouch=0;height=.06*(1-u)+cfg.heightM*4*u*(1-u);travel=.06+.84*foundationSmooth01(u);}
 else if(elapsed<d){const u=foundationSmooth01((elapsed-c)/cfg.landingS);phase='landing';crouch=Math.sin(Math.PI*u)*.82;height=0;travel=.90+.10*u;}
 else if(elapsed<e){const u=foundationSmooth01((elapsed-d)/cfg.recoveryS);phase='recovery';crouch=(1-u)*.22;height=0;travel=1;}
 else{phase='complete';crouch=0;height=0;travel=1;}
 return{phase,crouch,heightM:height,travelM:distanceM*Math.max(0,Math.min(1,travel)),complete:elapsed>=total,totalS:total};
}
function foundationRouteRemaining(agent){
 const root=agent.locomotion?.engine?.state?.root||agent.pos;let remaining=0,from=root;
 for(let i=agent.routeIndex;i<agent.route.length;i++){const to=agent.route[i];remaining+=Math.hypot(to[0]-from[0],to[2]-from[2]);from=to;}
 return remaining;
}
function foundationMarkRunPlan(agent,plan){
 for(const step of plan?.steps||[])if(step.type==='walk'){step.foundationMode='run';step.foundationVersion=FOUNDATION_ACTIVITIES_R1.version;}
 if(agent.plan&&agent.plan!==plan)for(const step of agent.plan.steps||[])if(step.type==='walk'){step.foundationMode='run';step.foundationVersion=FOUNDATION_ACTIVITIES_R1.version;}
 return plan;
}
function foundationBeginJump(agent,command){
 if(agent.characterEditInProgress)throw Error('人物正在更新，请等待完成后再跳跃');
 if(agent.held||agent.skill||agent.plan||agent.preflightWaiting||agent.basic?.busy)throw Error('人物仍在执行任务或持物，不能开始跳跃');
 const distanceM=Math.max(FOUNDATION_ACTIVITIES_R1.jump.minimumDistanceM,Math.min(FOUNDATION_ACTIVITIES_R1.jump.maximumDistanceM,foundationNumber(command.distanceM,0)));
 const direction=foundationDirectionVector(agent.yaw,command.direction),start=[...agent.pos],end=[start[0]+direction[0]*distanceM,start[1],start[2]+direction[2]*distanceM];
 const radius=bodyPhysicalProfile(agent.h).bodyRadiusM,scan=motionWorldSweep(agent.w,start,end,radius,[]);
 if(scan.blocked||scan.fraction<.999)throw Error('跳跃落点或腾空路径被环境阻挡');
 agent.cancelPreflight();agent.error=null;agent.paused=false;agent.foundationJump={version:FOUNDATION_ACTIVITIES_R1.version,elapsed:0,started:false,start,end,direction,distanceM,startYaw:agent.yaw,flightReference:null,landingFeet:null};
 agent.locomotion.stop();agent.log(distanceM>0?'开始向前跳跃':'开始原地跳跃');return{type:'jump',distanceM,direction:command.direction};
}
function foundationJumpFeet(agent,state){
 if(state.landingFeet)return state.landingFeet;
 const dx=state.end[0]-state.start[0],dz=state.end[2]-state.start[2];
 state.landingFeet=Object.fromEntries(['left','right'].map(side=>[side,{p:[agent.feet[side].p[0]+dx,agent.feet[side].p[1],agent.feet[side].p[2]+dz],yaw:state.startYaw,contact:true}]));
 return state.landingFeet;
}
function foundationTickJump(agent,dt,originalTick){
 const state=agent.foundationJump;
 if(!state.started){
  originalTick.call(agent,dt);
  if(!agent.locomotion.isSettled())return;
  state.started=true;state.elapsed=0;state.start=[...agent.pos];state.end[1]=state.start[1];foundationJumpFeet(agent,state);agent.saveSafe();
 }
 try{
  agent.w.physics.syncScene();agent.time+=dt;state.elapsed+=dt;
  const profile=foundationJumpProfile(state.elapsed,state.distanceM),root=[state.start[0]+state.direction[0]*profile.travelM,state.start[1]+profile.heightM,state.start[2]+state.direction[2]*profile.travelM];
  let descriptor;
  if(profile.phase==='flight'){
   if(!state.flightReference)state.flightReference=r2CaptureMotion(agent.h,agent.yaw);
   const neutral=r2NeutralMotion(agent.h),airProgress=Math.max(0,Math.min(1,(state.elapsed-FOUNDATION_ACTIVITIES_R1.jump.compressionS-FOUNDATION_ACTIVITIES_R1.jump.extensionS)/FOUNDATION_ACTIVITIES_R1.jump.flightS));
   descriptor={position:root,reference:r2BlendMotion(state.flightReference,neutral,foundationSmooth01(Math.min(1,airProgress*1.35))),controlledFeet:false,floorMode:false,kind:'foundationJump',motionSource:{kind:'procedural-ballistic',version:FOUNDATION_ACTIVITIES_R1.version,phase:profile.phase}};
  }else{
   const feet=profile.phase==='landing'||profile.phase==='recovery'||profile.phase==='complete'?foundationJumpFeet(agent,state):agent.feet;
   descriptor={...motionContactDescriptor(agent,null,profile.crouch,'foundationJump'),position:root,controlledFeet:true,feet,floorMode:true,kind:'foundationJump',motionSource:{kind:'procedural-contact',version:FOUNDATION_ACTIVITIES_R1.version,phase:profile.phase}};
  }
  agent.pos=[...root];agent.h.pose({...descriptor,time:agent.time,deltaTime:dt});agent.stepPhysics(dt);
  if(profile.complete){
   agent.pos=[state.end[0],agent.h.bodyMetrics.restHipHeightM,state.end[2]];agent.feet=foundationJumpFeet(agent,state);agent.foundationJump=null;
   agent.locomotion.resetFromPose({preservePoseContacts:true});agent.evidence.push({type:'jump',completion:'verified',distanceM:state.distanceM,time:agent.time});agent.stats.completed++;agent.log('完成：跳跃并稳定落地');
  }
 }catch(error){agent.foundationJump=null;agent.fail('跳跃失败：'+error.message);}
}
function foundationInstall(){
 if(typeof Agent!=='function'||Agent.prototype.__foundationActivitiesR1)return;
 Object.defineProperty(Agent.prototype,'__foundationActivitiesR1',{value:true});
 const originalReset=Agent.prototype.reset,originalSubmit=Agent.prototype.submit,originalMoveAlong=Agent.prototype.moveAlong,originalTickFixed=Agent.prototype.tickFixed,originalCancel=Agent.prototype.cancel,originalFinish=Agent.prototype.finish;
 Agent.prototype.reset=function(options){const answer=originalReset.call(this,options);this.foundationRun={tempo:1};this.foundationJump=null;return answer;};
 Agent.prototype.cancel=function(){this.foundationJump=null;this.foundationRun={tempo:1};this.foundationMotionMode=null;return originalCancel.call(this);};
 Agent.prototype.submit=function(text,options){
  const command=foundationParseCommand(text);
  if(command?.type==='jump')return foundationBeginJump(this,command);
  if(command?.type==='carryAlias')return originalSubmit.call(this,'把'+command.object+'搬到'+command.target,options);
  if(command?.type==='run'){
   const map={forward:'向前',backward:'向后',left:'向左',right:'向右'},rewritten=map[command.direction]+'走'+Math.max(FOUNDATION_ACTIVITIES_R1.run.minimumDistanceM,Math.min(FOUNDATION_ACTIVITIES_R1.run.maximumDistanceM,command.distanceM))+'米';
   return foundationMarkRunPlan(this,originalSubmit.call(this,rewritten,options));
  }
  const plan=originalSubmit.call(this,text,options);if(plan?.steps?.some(step=>step.foundationMode==='run'))foundationMarkRunPlan(this,plan);return plan;
 };
 Agent.prototype.moveAlong=function(dt,speed=.48){
  const running=this.skill?.foundationMode==='run'&&!this.held;
  if(!running){this.foundationMotionMode=null;if(this.foundationRun)this.foundationRun.tempo+=(1-this.foundationRun.tempo)*(1-Math.exp(-dt/.18));return originalMoveAlong.call(this,dt,speed);}
  this.foundationMotionMode='run';const moving=originalMoveAlong.call(this,dt,FOUNDATION_ACTIVITIES_R1.run.targetSpeedMps),remaining=foundationRouteRemaining(this),tempo=foundationRunTempo(this.foundationRun??={tempo:1},dt,remaining);
  this.locomotion.tempo=tempo;return moving;
 };
 Agent.prototype.tickFixed=function(dt){if(this.foundationJump)return foundationTickJump(this,dt,originalTickFixed);return originalTickFixed.call(this,dt);};
 Agent.prototype.finish=function(){const wasRun=this.skill?.foundationMode==='run',answer=originalFinish.call(this);if(wasRun){this.foundationRun={tempo:1};this.foundationMotionMode=null;this.log('完成：奔跑到达并减速站稳');}return answer;};
}
foundationInstall();
if(globalThis.__FOUNDATION_ACTIVITY_TEST__)globalThis.__FOUNDATION_ACTIVITY_TEST_API__={FOUNDATION_ACTIVITIES_R1,foundationParseCommand,foundationRunTempo,foundationJumpProfile,foundationDirectionVector};
