/* Lightweight support-margin feedback for the kinematic Human Core.
 * This adapter does not claim inverse dynamics, force-plate accuracy or a
 * complete COM model. It adds bounded torso counter-lean, a tiny double-
 * support pelvis recentering and a conservative pace reduction using the
 * already committed feet, root motion and measured payload acceleration. */
const LIGHT_BALANCE_FEEDBACK=Object.freeze({
 revision:'light-balance-r25',gravityMps2:9.81,bodyResponseS:.18,releaseResponseS:.32,
 maximumPitchRad:.045,maximumRollRad:.040,maximumPelvisXM:.008,maximumPelvisZM:.010,
 footHalfWidthM:.050,footHalfLengthM:.110,safeMarginM:.060,minimumPace:0.82
});
class LightBalanceFeedback{
 constructor(agent){this.a=agent;this.enabled=typeof location==='undefined'||!new URLSearchParams(location.search).has('balanceOff');this.reset();}
 snapshot(){const {a,...state}=this;return structuredClone(state);}
 restore(state){Object.assign(this,structuredClone(state));}
 reset(){this.active=false;this.pitchRad=0;this.rollRad=0;this.pelvisLocal=[0,0,0];this.paceScale=1;
  this.rootVelocity=[0,0,0];this.lastRoot=null;this.marginM=Infinity;this.risk=0;this.supportCount=0;
  this.comLocal=[0,0,0];this.accelerationLocal=[0,0,0];this.source='support-proxy';}
 support(state){
  const planted=Object.values(state.feet||{}).filter(foot=>foot.contact!==false&&Array.isArray(foot.position));
  const feet=planted.length?planted:Object.values(state.feet||{}).filter(foot=>Array.isArray(foot.position));
  const centre=feet.length?mul(feet.reduce((sum,foot)=>add(sum,foot.position),[0,0,0]),1/feet.length):[...state.root];
  const local=feet.map(foot=>rotate(inv(qy(state.yaw)),sub(foot.position,centre)));
  const halfX=Math.max(LIGHT_BALANCE_FEEDBACK.footHalfWidthM,...local.map(p=>Math.abs(p[0])+LIGHT_BALANCE_FEEDBACK.footHalfWidthM));
  const halfZ=Math.max(LIGHT_BALANCE_FEEDBACK.footHalfLengthM,...local.map(p=>Math.abs(p[2])+LIGHT_BALANCE_FEEDBACK.footHalfLengthM));
  return{feet,centre,halfX,halfZ};
 }
 update(dt){
  const a=this.a,state=a.locomotion?.engine?.state;if(!state||!Number.isFinite(dt)||dt<=0)return;
  const standing=(!a.basic||a.basic.posture==='standing')&&!a.basic?.busy;
  this.active=this.enabled&&standing&&!['sitDown','lieDown','standUp','groundSit','groundLie'].includes(a.phase);
  const root=[...state.root],velocity=this.lastRoot?mul(sub(root,this.lastRoot),1/dt):[0,0,0];
  const rootAcceleration=mul(sub(velocity,this.rootVelocity),1/dt);this.lastRoot=root;this.rootVelocity=velocity;
  const assessment=a.strength?.lastAssessment,payloadAcceleration=assessment?.measuredAccelerationVectorMps2||assessment?.request?.accelerationVectorMps2||[0,0,0];
  const bodyMass=Math.max(1,a.strength?.bodyMassKg||70),payloadMass=Math.max(0,a.held?.mass||0),total=bodyMass+payloadMass;
  const payloadPoint=payloadMass&&Array.isArray(a.held?.p)?a.held.p:root;
  const com=mul(add(mul(root,bodyMass),mul(payloadPoint,payloadMass)),1/total);
  const acceleration=mul(add(mul(rootAcceleration,bodyMass),mul(payloadAcceleration,payloadMass)),1/total);
  const support=this.support(state),inverseYaw=inv(qy(state.yaw));
  this.comLocal=rotate(inverseYaw,sub(com,support.centre));this.accelerationLocal=rotate(inverseYaw,acceleration);this.supportCount=support.feet.length;
  const marginX=support.halfX-Math.abs(this.comLocal[0]),marginZ=support.halfZ-Math.abs(this.comLocal[2]);
  this.marginM=Math.min(marginX,marginZ);this.risk=clamp((LIGHT_BALANCE_FEEDBACK.safeMarginM-this.marginM)/LIGHT_BALANCE_FEEDBACK.safeMarginM,0,1);
  let targetPitch=0,targetRoll=0,targetPelvis=[0,0,0],targetPace=1;
  if(this.active){
   // Acceleration produces a small anticipatory lean. A carried mass already
   // displaced from the support centre produces a counter-lean instead.
   targetPitch=clamp(this.accelerationLocal[2]/LIGHT_BALANCE_FEEDBACK.gravityMps2*.18-this.comLocal[2]*.10,-LIGHT_BALANCE_FEEDBACK.maximumPitchRad,LIGHT_BALANCE_FEEDBACK.maximumPitchRad);
   targetRoll=clamp(-this.accelerationLocal[0]/LIGHT_BALANCE_FEEDBACK.gravityMps2*.16+this.comLocal[0]*.12,-LIGHT_BALANCE_FEEDBACK.maximumRollRad,LIGHT_BALANCE_FEEDBACK.maximumRollRad);
   if(support.feet.length>1)targetPelvis=[clamp(-this.comLocal[0]*.12,-LIGHT_BALANCE_FEEDBACK.maximumPelvisXM,LIGHT_BALANCE_FEEDBACK.maximumPelvisXM),0,
    clamp(-this.comLocal[2]*.10,-LIGHT_BALANCE_FEEDBACK.maximumPelvisZM,LIGHT_BALANCE_FEEDBACK.maximumPelvisZM)];
   const reduction=this.risk*(a.held?.18:.12);targetPace=clamp(1-reduction,a.held?LIGHT_BALANCE_FEEDBACK.minimumPace:.88,1);
  }
  const response=this.active?LIGHT_BALANCE_FEEDBACK.bodyResponseS:LIGHT_BALANCE_FEEDBACK.releaseResponseS,alpha=1-Math.exp(-dt/response);
  this.pitchRad+=(targetPitch-this.pitchRad)*alpha;this.rollRad+=(targetRoll-this.rollRad)*alpha;
  this.pelvisLocal=mix(this.pelvisLocal,targetPelvis,alpha);this.paceScale+=(targetPace-this.paceScale)*alpha;
  a.h.__lightBalanceFeedback=this;
 }
 report(){return{revision:LIGHT_BALANCE_FEEDBACK.revision,enabled:this.enabled,active:this.active,supportCount:this.supportCount,marginM:this.marginM,risk:this.risk,
  pitchRad:this.pitchRad,rollRad:this.rollRad,pelvisLocalM:[...this.pelvisLocal],paceScale:this.paceScale,
  comLocalM:[...this.comLocal],accelerationLocalMps2:[...this.accelerationLocal],model:'bounded-support-proxy',calibrated:false,fullDynamics:false,visualAcceptance:false};}
}
(function installLightBalanceFeedback(){
 if(NaturalLocomotion.prototype.__lightBalanceR25)return;
 const update=NaturalLocomotion.prototype.update,move=NaturalLocomotion.prototype.move,resetFromPose=NaturalLocomotion.prototype.resetFromPose,report=NaturalLocomotion.prototype.report;
 const snapshotExecution=NaturalLocomotion.prototype.snapshotExecution,restoreExecution=NaturalLocomotion.prototype.restoreExecution;
 NaturalLocomotion.prototype.snapshotExecution=function(){return{...snapshotExecution.call(this),balance:this.balanceFeedback?.snapshot()||null};};
 NaturalLocomotion.prototype.restoreExecution=function(saved){
  const {balance,...state}=saved;restoreExecution.call(this,state);
  if(balance){
   if(!this.balanceFeedback)this.balanceFeedback=new LightBalanceFeedback(this.a);
   this.balanceFeedback.restore(balance);this.a.h.__lightBalanceFeedback=this.balanceFeedback;
  }else{
   // A failed first tick can create feedback after the checkpoint. Remove
   // its pose hook too, so the restored stance has no future-frame lean.
   if(this.a.h.__lightBalanceFeedback===this.balanceFeedback)delete this.a.h.__lightBalanceFeedback;
   this.balanceFeedback=null;
  }
 };
 NaturalLocomotion.prototype.update=function(dt){const value=update.call(this,dt);if(!this.balanceFeedback)this.balanceFeedback=new LightBalanceFeedback(this.a);this.balanceFeedback.update(dt);return value;};
 NaturalLocomotion.prototype.move=function(dt,speed=.48){return move.call(this,dt,speed*(this.balanceFeedback?.paceScale??1));};
 NaturalLocomotion.prototype.resetFromPose=function(options){const value=resetFromPose.call(this,options);this.balanceFeedback?.reset();return value;};
 NaturalLocomotion.prototype.report=function(){return{...report.call(this),lightBalance:this.balanceFeedback?.report()||null};};
 NaturalLocomotion.prototype.__lightBalanceR25=true;
 const prepare=MotionLabPose.prototype.prepare,apply=MotionLabPose.prototype.apply;
 MotionLabPose.prototype.balanceInput=function(){
  const feedback=(this.sourceHuman||this.h).__lightBalanceFeedback;
  return feedback?.active&&!feedback.a?.basic?.busy?{pitchRad:feedback.pitchRad,rollRad:feedback.rollRad,pelvisLocal:[...feedback.pelvisLocal]}:null;
 };
 MotionLabPose.prototype.prepare=function(options={}){
  const result=prepare.call(this,options),feedback=this.balanceInput();
  if(!feedback||options.floorMode||options.lockedFrames)return result;
  const lumbar=qm(qz(feedback.rollRad*.35),qx(feedback.pitchRad*.35)),thorax=qm(qz(feedback.rollRad*.65),qx(feedback.pitchRad*.65));
  result.data={...result.data,lumbarQ:qnorm(qm(lumbar,result.data.lumbarQ)),thoraxQ:qnorm(qm(thorax,result.data.thoraxQ))};
  // Recenter the pelvis only in double support and only when hands are not
  // constrained to a world object. Single support and manipulation receive
  // counter-lean but keep their existing root/contact solution unchanged.
  const doubleSupport=Object.values(result.state.feet||{}).every(foot=>foot.contact!==false);
  if(doubleSupport&&!options.hands&&options.motionSource?.kind!=='contact-adaptation'){
   const worldOffset=rotate(qy(result.yaw),feedback.pelvisLocal);result.state.root=add(result.state.root,worldOffset);
   if(result.controlled)result.state.pose=this.engine.solve(result.state);
  }
  result.state.motion={...result.state.motion,frame:result.data,weight:1};return result;
 };
 MotionLabPose.prototype.apply=function(options={}){const value=apply.call(this,options),feedback=this.h.__lightBalanceFeedback;if(feedback&&this.lastReport)this.lastReport.lightBalance=feedback.report();return value;};
})();
