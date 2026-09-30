/* Natural whole-body turn adapter R27.
 *
 * The pinned Motion-Lab core only owns fixed-foot locomotion and a straight
 * walking source clip. This adapter adds a stable step-turn policy, variable
 * foot placement, anticipatory axial reorientation and a bounded weight shift
 * without changing the locked vendor sources. The values are motion-informed
 * authoring bounds, not a subject-specific biomechanical calibration. */
const NATURAL_TURN_R27=Object.freeze({
 revision:'natural-turn-r27',
 minimumSteppedAngleRad:.18,
 freeMaximumStepYawRad:.56,
 carriedMaximumStepYawRad:.44,
 freeAngularPace:.80,
 carriedAngularPace:.64,
 anticipationS:.10,
 onSpotHeadLeadS:.16,
 onSpotThoraxLeadS:.06,
 releaseS:.34,
 triggerTwistRad:.060,
 correctiveYawRad:.050,
 correctivePositionM:.038,
 maximumPlacementLeadRad:.56,
 maximumHeadLeadRad:.38,
 maximumThoraxLeadRad:.21,
 maximumLumbarLeadRad:.10,
 maximumCervicalLocalRad:.20,
 maximumHeadLocalRad:.20,
 freeWeightShiftM:.009,
 carriedWeightShiftM:.006,
 maximumPelvisDropM:.004,
 maximumExtraSteps:2
});
const naturalTurnEase=value=>{const t=clamp(value,0,1);return t*t*t*(10+t*(-15+6*t));};
const naturalTurnDirection=turn=>Math.sign(turn.deltaRad||1);
const naturalTurnSideSign=side=>side==='left'?-1:1;
function naturalTurnPlan(locomotion,targetYaw){
 const state=locomotion.engine.state,deltaRad=angleDiff(targetYaw,state.yaw),magnitude=Math.abs(deltaRad),carried=!!locomotion.a.held;
 const maximumStepYawRad=carried?NATURAL_TURN_R27.carriedMaximumStepYawRad:NATURAL_TURN_R27.freeMaximumStepYawRad;
 const plannedSteps=magnitude<NATURAL_TURN_R27.minimumSteppedAngleRad?0:Math.max(2,Math.ceil(magnitude/maximumStepYawRad)+1);
 const durationS=(.52+magnitude*.64)*(carried?1.18:1);
 const direction=Math.sign(deltaRad||1),firstFoot=direction>0?'left':'right';
 return{
  revision:NATURAL_TURN_R27.revision,active:true,phase:'turning',startYaw:state.yaw,targetYaw:angleDiff(targetYaw,0),deltaRad,
  magnitudeRad:magnitude,direction,carried,strategy:magnitude<.45?'small-step-turn':magnitude<1.95?'step-turn':'multi-step-turn',
  durationS,elapsedS:0,releaseElapsedS:0,plannedSteps,extraSteps:0,stepsCompleted:0,firstFoot,nextFoot:firstFoot,
  priorYaw:state.yaw,priorYawSpeed:0,priorYawAcceleration:0,maximumYawSpeedRadS:0,maximumYawAccelerationRadS2:0,
  maximumYawJerkRadS3:0,currentHardPauseS:0,maximumHardPauseS:0,rootProgress:0,placementHistory:[],
  axial:{headGlobalLeadRad:0,thoraxGlobalLeadRad:0,lumbarGlobalLeadRad:0,headLocalRad:0,cervicalLocalRad:0,thoraxLocalRad:0,lumbarLocalRad:0},
  maximumObservedHeadLeadRad:0,maximumObservedThoraxLeadRad:0,maximumObservedLumbarLeadRad:0,
  sourceProfile:'CMU subject 69 turn-in-place / HDM05 locomotion turns; procedural retarget envelope',rawClipImported:false,
  visualAcceptance:false
 };
}
function naturalTurnProgress(turn,yaw){
 if(turn.magnitudeRad<1e-8)return 1;
 const travelled=naturalTurnDirection(turn)*angleDiff(yaw,turn.startYaw);
 return clamp(travelled/turn.magnitudeRad,0,1);
}
function naturalTurnPlacementFraction(turn,index){
 if(turn.plannedSteps<=1)return 1;
 return clamp((index+1)/(turn.plannedSteps-1),0,1);
}
function naturalTurnPlacementYaw(turn,index,currentYaw){
 const desired=angleDiff(turn.startYaw+turn.deltaRad*naturalTurnPlacementFraction(turn,index),0),difference=angleDiff(desired,currentYaw);
 return angleDiff(currentYaw+clamp(difference,-NATURAL_TURN_R27.maximumPlacementLeadRad,NATURAL_TURN_R27.maximumPlacementLeadRad),0);
}
function naturalTurnAxial(turn,rootYaw){
 const release=turn.phase==='release'?1-naturalTurnEase(turn.releaseElapsedS/NATURAL_TURN_R27.releaseS):1;
 const headProgress=naturalTurnEase((turn.elapsedS+NATURAL_TURN_R27.onSpotHeadLeadS)/Math.max(.25,turn.durationS));
 const thoraxProgress=naturalTurnEase((turn.elapsedS+NATURAL_TURN_R27.onSpotThoraxLeadS)/Math.max(.25,turn.durationS));
 const lumbarProgress=naturalTurnEase(turn.elapsedS/Math.max(.25,turn.durationS));
 const headYaw=angleDiff(turn.startYaw+turn.deltaRad*headProgress,0),thoraxYaw=angleDiff(turn.startYaw+turn.deltaRad*thoraxProgress,0),lumbarYaw=angleDiff(turn.startYaw+turn.deltaRad*lumbarProgress,0);
 const lumbarGlobal=clamp(angleDiff(lumbarYaw,rootYaw),-NATURAL_TURN_R27.maximumLumbarLeadRad,NATURAL_TURN_R27.maximumLumbarLeadRad)*release;
 const thoraxGlobal=clamp(angleDiff(thoraxYaw,rootYaw),-NATURAL_TURN_R27.maximumThoraxLeadRad,NATURAL_TURN_R27.maximumThoraxLeadRad)*release;
 const headGlobal=clamp(angleDiff(headYaw,rootYaw),-NATURAL_TURN_R27.maximumHeadLeadRad,NATURAL_TURN_R27.maximumHeadLeadRad)*release;
 const lumbarLocal=lumbarGlobal,thoraxLocal=clamp(thoraxGlobal-lumbarGlobal,-NATURAL_TURN_R27.maximumThoraxLeadRad,NATURAL_TURN_R27.maximumThoraxLeadRad);
 const headDifference=clamp(headGlobal-thoraxGlobal,-(NATURAL_TURN_R27.maximumCervicalLocalRad+NATURAL_TURN_R27.maximumHeadLocalRad),NATURAL_TURN_R27.maximumCervicalLocalRad+NATURAL_TURN_R27.maximumHeadLocalRad);
 const cervicalLocal=clamp(headDifference*.62,-NATURAL_TURN_R27.maximumCervicalLocalRad,NATURAL_TURN_R27.maximumCervicalLocalRad),headLocal=clamp(headDifference-cervicalLocal,-NATURAL_TURN_R27.maximumHeadLocalRad,NATURAL_TURN_R27.maximumHeadLocalRad);
 return{headGlobalLeadRad:headGlobal,thoraxGlobalLeadRad:thoraxGlobal,lumbarGlobalLeadRad:lumbarGlobal,headLocalRad:headLocal,cervicalLocalRad:cervicalLocal,thoraxLocalRad:thoraxLocal,lumbarLocalRad:lumbarLocal};
}
function naturalTurnReport(turn){
 if(!turn)return null;
 return{
  revision:turn.revision,active:turn.active,phase:turn.phase,strategy:turn.strategy,carried:turn.carried,
  startYaw:turn.startYaw,targetYaw:turn.targetYaw,magnitudeRad:turn.magnitudeRad,rootProgress:turn.rootProgress,
  durationS:turn.durationS,elapsedS:turn.elapsedS,plannedSteps:turn.plannedSteps,stepsCompleted:turn.stepsCompleted,extraSteps:turn.extraSteps,
  maximumYawSpeedRadS:turn.maximumYawSpeedRadS,maximumYawAccelerationRadS2:turn.maximumYawAccelerationRadS2,
  maximumYawJerkRadS3:turn.maximumYawJerkRadS3,maximumHardPauseS:turn.maximumHardPauseS,
  maximumObservedHeadLeadRad:turn.maximumObservedHeadLeadRad,maximumObservedThoraxLeadRad:turn.maximumObservedThoraxLeadRad,
  maximumObservedLumbarLeadRad:turn.maximumObservedLumbarLeadRad,axial:{...turn.axial},placementHistory:turn.placementHistory.slice(-12),
  sourceProfile:turn.sourceProfile,rawClipImported:turn.rawClipImported,visualAcceptance:false
 };
}
(function installNaturalTurnR27(){
 if(NaturalLocomotion.prototype.__naturalTurnR27)return;
 const filterUpdate=TurnCommandFilter.prototype.update;
 TurnCommandFilter.prototype.update=function(targetYaw,state,dt,pace=1){return filterUpdate.call(this,targetYaw,state,dt,pace*(this.naturalTurnPaceScale??1));};
 const turnInPlace=NaturalLocomotion.prototype.turnInPlace,update=NaturalLocomotion.prototype.update,move=NaturalLocomotion.prototype.move,
  resetFromPose=NaturalLocomotion.prototype.resetFromPose,report=NaturalLocomotion.prototype.report,stop=NaturalLocomotion.prototype.stop;
 NaturalLocomotion.prototype.beginNaturalTurn=function(targetYaw){
  const plan=naturalTurnPlan(this,targetYaw);this.naturalTurn=plan;this.engine.__naturalTurnR27=plan;this.turnFilter.naturalTurnPaceScale=plan.carried?NATURAL_TURN_R27.carriedAngularPace:NATURAL_TURN_R27.freeAngularPace;
  if(plan.plannedSteps)this.engine.state.nextFoot=plan.firstFoot;this.a.h.__naturalTurnR27=plan;return plan;
 };
 NaturalLocomotion.prototype.turnInPlace=function(targetYaw,dt){
  let turn=this.naturalTurn;
  if(!turn||turn.phase==='release'||Math.abs(angleDiff(turn.targetYaw,targetYaw))>.012)turn=this.beginNaturalTurn(targetYaw);
  turn.active=true;this.engine.__naturalTurnR27=turn;this.a.h.__naturalTurnR27=turn;
  const moving=turnInPlace.call(this,targetYaw,dt);
  if(!moving&&this.isSettled()&&turn.phase==='turning'){
   turn.phase='release';turn.releaseElapsedS=0;turn.active=false;this.lastNaturalTurn=structuredClone(naturalTurnReport(turn));
  }
  return moving;
 };
 NaturalLocomotion.prototype.update=function(dt){
  const turn=this.naturalTurn;
  if(turn){
   const scaledDt=dt*(this.tempo||1);if(turn.phase==='turning')turn.elapsedS+=scaledDt;else if(turn.phase==='release')turn.releaseElapsedS+=scaledDt;
   this.engine.__naturalTurnR27=turn;this.a.h.__naturalTurnR27=turn;
   if(turn.phase==='turning'&&!this.engine.state.swing&&turn.stepsCompleted===0)this.engine.state.nextFoot=turn.firstFoot;
  }
  const beforeYaw=this.engine.state.yaw,value=update.call(this,dt);
  if(turn){
   const step=Math.max(1e-8,dt*(this.tempo||1)),yawSpeed=angleDiff(this.engine.state.yaw,beforeYaw)/step,yawAcceleration=(yawSpeed-turn.priorYawSpeed)/step,yawJerk=(yawAcceleration-turn.priorYawAcceleration)/step;
   turn.priorYaw=this.engine.state.yaw;turn.priorYawSpeed=yawSpeed;turn.priorYawAcceleration=yawAcceleration;
   turn.maximumYawSpeedRadS=Math.max(turn.maximumYawSpeedRadS,Math.abs(yawSpeed));turn.maximumYawAccelerationRadS2=Math.max(turn.maximumYawAccelerationRadS2,Math.abs(yawAcceleration));turn.maximumYawJerkRadS3=Math.max(turn.maximumYawJerkRadS3,Math.abs(yawJerk));
   turn.rootProgress=naturalTurnProgress(turn,this.engine.state.yaw);
   const remaining=Math.abs(angleDiff(turn.targetYaw,this.engine.state.yaw));
   if(turn.phase==='turning'&&remaining>.05&&!this.engine.state.swing&&Math.abs(yawSpeed)<.01)turn.currentHardPauseS+=step;else turn.currentHardPauseS=0;
   turn.maximumHardPauseS=Math.max(turn.maximumHardPauseS,turn.currentHardPauseS);
   if(turn.phase==='release'&&turn.releaseElapsedS>=NATURAL_TURN_R27.releaseS&&!this.engine.state.swing){
    this.lastNaturalTurn=structuredClone(naturalTurnReport(turn));this.naturalTurn=null;this.engine.__naturalTurnR27=null;this.a.h.__naturalTurnR27=null;this.turnFilter.naturalTurnPaceScale=1;
   }
  }
  return value;
 };
 NaturalLocomotion.prototype.move=function(dt,speed=.48){if(this.naturalTurn){this.lastNaturalTurn=structuredClone(naturalTurnReport(this.naturalTurn));this.naturalTurn=null;this.engine.__naturalTurnR27=null;this.a.h.__naturalTurnR27=null;this.turnFilter.naturalTurnPaceScale=1;}return move.call(this,dt,speed);};
 NaturalLocomotion.prototype.stop=function(){if(this.naturalTurn?.phase==='turning'){this.naturalTurn.phase='release';this.naturalTurn.releaseElapsedS=0;this.naturalTurn.active=false;}return stop.call(this);};
 NaturalLocomotion.prototype.resetFromPose=function(options){const value=resetFromPose.call(this,options);this.naturalTurn=null;this.engine.__naturalTurnR27=null;this.a.h.__naturalTurnR27=null;this.turnFilter.naturalTurnPaceScale=1;return value;};
 NaturalLocomotion.prototype.report=function(){return{...report.call(this),naturalTurn:naturalTurnReport(this.naturalTurn),lastNaturalTurn:this.lastNaturalTurn||null};};
 NaturalLocomotion.prototype.__naturalTurnR27=true;

 const stepFeet=MotionLab.MotionController.prototype.stepFeet;
 MotionLab.MotionController.prototype.stepFeet=function(state,dt){
  const turn=this.__naturalTurnR27;
  if(!turn||turn.phase!=='turning')return stepFeet.call(this,state,dt);
  const sides=['left','right'];
  const chooseCorrection=()=>sides.map(side=>({side,yaw:Math.abs(angle(turn.targetYaw-state.feet[side].yaw)),position:distance(state.feet[side].position,this.stance({...state,yaw:turn.targetYaw},side))})).sort((a,b)=>(b.yaw+b.position*2)-(a.yaw+a.position*2))[0];
  if(!state.swing){
   let side=turn.nextFoot,corrective=null;
   if(turn.stepsCompleted>=turn.plannedSteps){corrective=chooseCorrection();if((corrective.yaw<NATURAL_TURN_R27.correctiveYawRad&&corrective.position<NATURAL_TURN_R27.correctivePositionM)||turn.extraSteps>=NATURAL_TURN_R27.maximumExtraSteps)return;side=corrective.side;turn.extraSteps++;}
   const foot=state.feet[side],twist=Math.abs(angle(state.yaw-foot.yaw)),scheduledProgress=turn.plannedSteps?naturalTurnPlacementFraction(turn,Math.min(turn.stepsCompleted,turn.plannedSteps-1)):1;
   const scheduled=turn.elapsedS>=NATURAL_TURN_R27.anticipationS&&(twist>NATURAL_TURN_R27.triggerTwistRad||turn.rootProgress+.08>=scheduledProgress||turn.rootProgress>.94);
   if(!scheduled&&!corrective)return;
   const index=Math.min(turn.stepsCompleted,Math.max(0,turn.plannedSteps-1)),placementYaw=turn.stepsCompleted<turn.plannedSteps?naturalTurnPlacementYaw(turn,index,state.yaw):turn.targetYaw;
   const stepAngle=Math.abs(angle(placementYaw-foot.yaw)),angleRatio=clamp(stepAngle/NATURAL_TURN_R27.freeMaximumStepYawRad,0,1),lead=turn.stepsCompleted===0?.012:0;
   const target=this.stance({...state,yaw:placementYaw},side,lead),path=this.world.sweep(foot.position,target,.045);
   if(path.blocked||!this.world.free(target,.045))throw Error('自然转身落脚路径受阻，保持最后安全支撑');
   const duration=clamp(.27+angleRatio*.11+(turn.carried?.08:0),.27,turn.carried?.49:.40),lift=clamp(.014+angleRatio*.022,turn.carried?.012:.014,turn.carried?.029:.038);
   state.swing={side,from:[...foot.position],target,fromYaw:foot.yaw,yaw:placementYaw,elapsed:0,duration,lift,motionKind:'natural-turn-r27',turnPlacementTarget:placementYaw};foot.contact=false;
   turn.placementHistory.push({side,index:turn.stepsCompleted,corrective:!!corrective,placementYaw,target:[...target],durationS:duration,liftM:lift});
  }
  if(state.swing?.motionKind==='natural-turn-r27'){
   const swing=state.swing;swing.elapsed=Math.min(swing.duration,swing.elapsed+dt);const t=swing.elapsed/swing.duration,u=naturalTurnEase(t),foot=state.feet[swing.side];
   foot.position=mix(swing.from,swing.target,u);foot.position[1]+=swing.lift*16*t*t*(1-t)*(1-t);foot.yaw=angle(swing.fromYaw+angle(swing.yaw-swing.fromYaw)*u);
   if(t>=1){foot.position=[...swing.target];foot.contact=true;foot.yaw=swing.yaw;turn.stepsCompleted++;turn.nextFoot=swing.side==='left'?'right':'left';state.nextFoot=turn.nextFoot;state.swing=null;state.metrics.steps++;}
   return;
  }
  return stepFeet.call(this,state,dt);
 };

 const prepare=MotionLabPose.prototype.prepare,build=MotionLabPose.prototype.build;
 MotionLabPose.prototype.prepare=function(options={}){
  const result=prepare.call(this,options),turn=this.engine.__naturalTurnR27;
  if(this.preflightOnly||!turn||!['turning','release'].includes(turn.phase)||options.floorMode||options.lockedFrames)return result;
  const axial=naturalTurnAxial(turn,result.yaw);turn.axial=axial;turn.maximumObservedHeadLeadRad=Math.max(turn.maximumObservedHeadLeadRad,Math.abs(axial.headGlobalLeadRad));turn.maximumObservedThoraxLeadRad=Math.max(turn.maximumObservedThoraxLeadRad,Math.abs(axial.thoraxGlobalLeadRad));turn.maximumObservedLumbarLeadRad=Math.max(turn.maximumObservedLumbarLeadRad,Math.abs(axial.lumbarGlobalLeadRad));
  const data={...result.data};data.lumbarQ=qnorm(qm(qy(axial.lumbarLocalRad),data.lumbarQ));data.thoraxQ=qnorm(qm(qy(axial.thoraxLocalRad),data.thoraxQ));data.cervicalQ=qnorm(qm(qy(axial.cervicalLocalRad),data.cervicalQ));data.headQ=qnorm(qm(qy(axial.headLocalRad),data.headQ));
  if(!options.hands){
   const neutral=this.engine.motion.neutral,damping=turn.carried?.90:.76;
   for(const key of ['leftUpperArm','rightUpperArm','leftForearm','rightForearm'])if(Array.isArray(data[key])&&Array.isArray(neutral[key]))data[key]=norm(mix(data[key],neutral[key],damping));
  }
  const swing=result.state.swing;
  if(result.controlled&&swing?.motionKind==='natural-turn-r27'){
   const t=clamp(swing.elapsed/Math.max(1e-8,swing.duration),0,1),support=swing.side==='left'?'right':'left',amplitude=turn.carried?NATURAL_TURN_R27.carriedWeightShiftM:NATURAL_TURN_R27.freeWeightShiftM,
    local=[naturalTurnSideSign(support)*amplitude*Math.sin(Math.PI*t),-NATURAL_TURN_R27.maximumPelvisDropM*Math.sin(Math.PI*t),0];
   result.state.root=add(result.state.root,rotate(qy(result.yaw),local));result.state.pose=this.engine.solve(result.state);
  }
  result.data=data;result.state.motion={...result.state.motion,frame:data,weight:1};return result;
 };
 MotionLabPose.prototype.build=function(options={}){
  const value=build.call(this,options),turn=this.engine.__naturalTurnR27,swing=this.engine.state.swing;
  if(!turn||swing?.motionKind!=='natural-turn-r27'||!value?.frames)return value;
  const t=clamp(swing.elapsed/Math.max(1e-8,swing.duration),0,1),pitch=-.075*Math.sin(Math.PI*t),footId=swing.side+'_foot',current=value.frames.get(footId);
  if(!current)return value;
  const adjusted=frame(current.p,qnorm(qm(current.q,qx(pitch))));value.frames.set(footId,adjusted);
  const rigid=compose(adjusted,inverse(this.h.sourceBind.get(footId)));for(const [child]of this.descendantRows.get(footId))value.frames.set(child,compose(rigid,this.h.sourceBind.get(child)));
  return value;
 };
})();
