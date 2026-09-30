/* Source-backed turn timing and upper-body overlay.
 * Pelvis yaw and foot contacts remain owned by NaturalLocomotion/Motion-Lab.
 * CMU turn captures contribute only a bounded temporal profile and detrended
 * body-relative residual motion; no captured geometry or saved posed surface. */
const TURN_MOTION=/*__TURN_MOTION_JSON__*/;
const TURN_R1_SCHEMA='human/turn_motion_reference@1';
const TURN_R1_CLIPS=new Map(Object.entries(TURN_MOTION.clips||{}).map(([id,clip])=>[id,{...clip,samples:(clip.sampleBlocks||[]).flat()}]));
const TURN_R1_QUAT_KEYS=Object.freeze(['rootQ','lumbarQ','thoraxQ','cervicalQ','headQ','leftClavicleQ','rightClavicleQ']);
const TURN_R1_ARM_QUAT_KEYS=Object.freeze(['leftUpperArmQ','leftForearmQ','leftHandQ','rightUpperArmQ','rightForearmQ','rightHandQ']);
const TURN_R1_ARM_DIRECTION_KEYS=Object.freeze(['leftUpperArm','leftForearm','rightUpperArm','rightForearm']);
function turnR1Sample(clip,progress){
 const rows=clip?.samples||[];if(!rows.length)return null;
 const t=clamp(progress,0,1);if(t<=rows[0].t)return rows[0];if(t>=rows.at(-1).t)return rows.at(-1);
 let lo=0,hi=rows.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid].t<=t)lo=mid;else hi=mid;}
 const a=rows[lo],b=rows[hi],u=(t-a.t)/Math.max(1e-9,b.t-a.t);return r2BlendMotion(a,b,u);
}
function turnR1SelectClip(angleRad,kind='in-place'){
 const sign=Math.sign(angleRad||1),clips=[...TURN_R1_CLIPS.values()].filter(clip=>clip.kind===kind&&clip.samples.length>1&&Math.sign(clip.sourceTurnAngleRad||0)===sign);
 if(clips.length)return clips.sort((a,b)=>Math.abs(Math.abs(a.sourceTurnAngleRad)-Math.abs(angleRad))-Math.abs(Math.abs(b.sourceTurnAngleRad)-Math.abs(angleRad)))[0];
 return [...TURN_R1_CLIPS.values()].find(clip=>clip.kind===kind&&clip.samples.length>1)||null;
}
function turnR1QuatResidual(base,raw,start,end,t,amount){
 if(!base||!raw||!start||!end)return base;
 const trend=qslerp(start,end,smoother(t)),delta=qnorm(qm(raw,inv(trend))),scaled=qslerp(qi(),delta,clamp(amount,0,1));
 return qnorm(qm(scaled,base));
}
function turnR1DirectionResidual(base,raw,start,end,t,amount){
 if(!base||!raw||!start||!end)return base;
 const trend=norm(mix(start,end,smoother(t))),delta=fromTo(trend,norm(raw)),scaled=qslerp(qi(),delta,clamp(amount,0,1));
 return norm(rotate(scaled,base));
}
function turnR1ScalarResidual(base,raw,start,end,t,amount){
 if(!Number.isFinite(base)||!Number.isFinite(raw)||!Number.isFinite(start)||!Number.isFinite(end))return base;
 const trend=start+(end-start)*smoother(t);return base+(raw-trend)*clamp(amount,0,1);
}
class TurnMotionR1 {
 constructor(locomotion){this.locomotion=locomotion;this.last=null;this.clearLive();}
 clearLive(){
  this.active=false;this.kind=null;this.clip=null;this.startYaw=0;this.previousYaw=0;this.targetYaw=0;this.totalAngleRad=0;this.actualAngleRad=0;
  this.durationS=0;this.elapsedS=0;this.progress=0;this.actualProgress=0;this.commandProgress=0;this.sample=null;this.sourceAmount=0;this.timelineHeldFrames=0;this.startedAtS=null;
 }
 reset(){this.last=null;this.clearLive();}
 cancel(reason='cancelled'){
  if(this.active)this.last={...this.report(),active:false,finishReason:reason,finalYaw:this.locomotion.engine.state.yaw};
  this.clearLive();
 }
 begin(targetYaw,state,kind='in-place'){
  this.clearLive();this.active=true;this.kind=kind;this.startYaw=state.yaw;this.previousYaw=state.yaw;this.targetYaw=angleDiff(targetYaw,0);this.totalAngleRad=angleDiff(this.targetYaw,this.startYaw);this.clip=turnR1SelectClip(this.totalAngleRad,kind);
  const sourceAngle=Math.abs(this.clip?.sourceTurnAngleRad||Math.PI/2),ratio=Math.abs(this.totalAngleRad)/Math.max(sourceAngle,.15),sourceDuration=this.clip?.durationS||1.8;
  this.durationS=clamp(sourceDuration*(.72+.34*clamp(ratio,.35,2.2)),.85,4.8);this.sourceAmount=this.clip?clamp(ratio,.32,1):0;this.startedAtS=state.time??0;this.sample=this.clip?turnR1Sample(this.clip,0):null;
 }
 ensure(targetYaw,state,kind='in-place'){
  const target=angleDiff(targetYaw,0),remaining=Math.abs(angleDiff(target,state.yaw));
  if(remaining<.012&&!this.active)return false;
  const directionChanged=remaining>.05&&Math.sign(angleDiff(target,state.yaw)||1)!==Math.sign(this.totalAngleRad||1);
  if(!this.active||this.kind!==kind||Math.abs(angleDiff(target,this.targetYaw))>.03||directionChanged)this.begin(target,state,kind);
  return true;
 }
 observe(targetYaw,state,dt,kind='in-place'){
  if(!this.ensure(targetYaw,state,kind))return{timelineDone:true,active:false};
  const delta=angleDiff(state.yaw,this.previousYaw);this.previousYaw=state.yaw;this.actualAngleRad+=delta;
  const total=this.totalAngleRad,actual=total===0?1:clamp(this.actualAngleRad/total,0,1),nextElapsed=Math.min(this.durationS,this.elapsedS+Math.max(0,dt));
  const nextT=this.durationS?nextElapsed/this.durationS:1,nextSample=this.clip?turnR1Sample(this.clip,nextT):null,nextProgress=clamp(nextSample?.yawProgress??smoother(nextT),0,1);
  // The capture may lead the pelvis by a small amount so the head and thorax
  // can anticipate. It may never drag the contact-solved root behind a source
  // curve or command the pelvis directly.
  const allowed=nextProgress<=actual+.14||nextT<=.16||actual>=.985;
  if(allowed)this.elapsedS=nextElapsed;else this.timelineHeldFrames++;
  this.progress=this.durationS?clamp(this.elapsedS/this.durationS,0,1):1;this.sample=this.clip?turnR1Sample(this.clip,this.progress):null;
  this.actualProgress=actual;this.commandProgress=clamp(this.sample?.yawProgress??smoother(this.progress),0,1);
  return{timelineDone:this.progress>=1-1e-9,active:true};
 }
 overlay(base,{handsConstrained=false}={}){
  if(!this.active||!this.clip||!this.sample)return null;
  const rows=this.clip.samples,start=rows[0],end=rows.at(-1),t=this.progress,amount=this.sourceAmount*(handsConstrained?.45:1),reference={...base};
  for(const key of TURN_R1_QUAT_KEYS)reference[key]=turnR1QuatResidual(base[key],this.sample[key],start[key],end[key],t,amount);
  reference.rootHeightRatio=turnR1ScalarResidual(base.rootHeightRatio,this.sample.rootHeightRatio,start.rootHeightRatio,end.rootHeightRatio,t,amount*.55);
  if(!handsConstrained){
   for(const key of TURN_R1_ARM_QUAT_KEYS)reference[key]=turnR1QuatResidual(base[key],this.sample[key],start[key],end[key],t,amount);
   for(const key of TURN_R1_ARM_DIRECTION_KEYS)reference[key]=turnR1DirectionResidual(base[key],this.sample[key],start[key],end[key],t,amount);
  }
  return{reference,motionSource:{kind:'capture-turn-overlay',schema:TURN_R1_SCHEMA,revision:TURN_MOTION.revision,clip:this.clip.id,trial:this.clip.sourceTrial,progress:t,
   sourceTurnAngleRad:this.clip.sourceTurnAngleRad,requestedTurnAngleRad:this.totalAngleRad,headLeadS:this.clip.sequence?.headLeadS??null,thoraxLeadS:this.clip.sequence?.thoraxLeadS??null,
   pelvisYawRuntimeOwner:true,capturedPelvisYawApplied:false,controlledFeet:true,handsConstrained,measuredMotion:true,posedSurfaceMeasured:false}};
 }
 complete(state){this.last={...this.report(),active:false,finishReason:'completed',finalYaw:state.yaw};this.clearLive();}
 report(){return{schema:TURN_R1_SCHEMA,revision:TURN_MOTION.revision,active:this.active,kind:this.kind,clip:this.clip?.id||null,sourceTrial:this.clip?.sourceTrial||null,
  startYaw:this.startYaw,targetYaw:this.targetYaw,totalAngleRad:this.totalAngleRad,durationS:this.durationS,elapsedS:this.elapsedS,progress:this.progress,actualProgress:this.actualProgress,
  commandProgress:this.commandProgress,timelineHeldFrames:this.timelineHeldFrames,sourceAmount:this.sourceAmount,pelvisYawOwner:'NaturalLocomotion/TurnCommandFilter',
  method:this.clip?'cmu-turn-capture-detrended-upper-body-over-contact-solved-turn/v1':'minimum-jerk-fallback/v1',runtimeVerified:false,visualAcceptance:false};}
}
const TURN_R1_BASE_TURN=NaturalLocomotion.prototype.turnInPlace;
const TURN_R1_BASE_MOVE=NaturalLocomotion.prototype.move;
const TURN_R1_BASE_STOP=NaturalLocomotion.prototype.stop;
const TURN_R1_BASE_RESET=NaturalLocomotion.prototype.resetFromPose;
const TURN_R1_BASE_REPORT=NaturalLocomotion.prototype.report;
NaturalLocomotion.prototype.turnInPlace=function(yaw,dt){
 const adapter=this.turnMotionR1||(this.turnMotionR1=new TurnMotionR1(this)),tracked=adapter.ensure(yaw,this.engine.state,'in-place');
 // Root yaw, support margins, planted-foot twist and swing-foot placement keep
 // using the previously verified controller. The capture never drives them.
 const moving=TURN_R1_BASE_TURN.call(this,yaw,dt),timeline=tracked?adapter.observe(yaw,this.engine.state,dt,'in-place'):{timelineDone:true,active:false};
 if(moving||!timeline.timelineDone)return true;
 if(adapter.active)adapter.complete(this.engine.state);return false;
};
NaturalLocomotion.prototype.move=function(dt,speed=.48){if(this.turnMotionR1?.active)this.turnMotionR1.cancel('walk-started');return TURN_R1_BASE_MOVE.call(this,dt,speed);};
NaturalLocomotion.prototype.stop=function(){this.turnMotionR1?.cancel('stopped');return TURN_R1_BASE_STOP.call(this);};
NaturalLocomotion.prototype.resetFromPose=function(options={}){const result=TURN_R1_BASE_RESET.call(this,options);this.turnMotionR1?.cancel('pose-reset');return result;};
NaturalLocomotion.prototype.report=function(){const report=TURN_R1_BASE_REPORT.call(this),turn=this.turnMotionR1;report.turnMotion=turn?(turn.active?turn.report():turn.last||turn.report()):{schema:TURN_R1_SCHEMA,revision:TURN_MOTION.revision,active:false};return report;};
const TURN_R1_BASE_CONTACT_DESCRIPTOR=motionContactDescriptor;
motionContactDescriptor=function(agent,hands,crouch,phase=agent.phase){
 const descriptor=TURN_R1_BASE_CONTACT_DESCRIPTOR(agent,hands,crouch,phase),turn=agent.locomotion?.turnMotionR1;
 if(!turn?.active)return descriptor;
 const state=agent.locomotion.engine.state,base=descriptor.reference||agent.h.motionDriver.frameData(state,null),overlay=turn.overlay(base,{handsConstrained:!!hands});
 if(!overlay)return descriptor;
 return{...descriptor,reference:overlay.reference,controlledFeet:true,motionSource:overlay.motionSource};
};
