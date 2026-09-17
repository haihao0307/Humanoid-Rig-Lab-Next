// Retarget captured intervals through the single Human.pose authority.
class BasicController {
 constructor(agent){this.a=agent;this.posture='standing';this.transition=null;this.gesture=null;this.hold=null;this.supportState=null;this.supportFrames=null;this.pending=null;this.lastGround={y:0,boneId:null};this.automaticStandUps=0;this.floorMin=Infinity;this.maxFloorCorrection=0;this.samples=0;this.phaseLog=[];this.reachProjectionCount=0;this.maxProjectedResidualM=0;this.reachProjectionLog=[];}
 get busy(){return !!(this.transition||this.gesture)}
 capture(){const a=this.a,h=a.h;return {reference:r2CaptureMotion(h,a.yaw),motionSource:h.lastMotionSource,position:[...h.root.p],rootRotation:[...h.root.q],
  spineRotations:Object.fromEntries(h.spine.map(j=>[j.id,[...j.q]])),
  feet:Object.fromEntries(sides.map(s=>[s,{p:[...h.legs[s].wrist.world.p],q:[...h.legs[s].wrist.world.q],yaw:a.yaw}])),
  hands:Object.fromEntries(sides.map(s=>[s,copyFrame(h.palm(s))])),
  legPoles:Object.fromEntries(sides.map(s=>[s,[...h.legs[s].elbow.world.p]])),
  armPoles:Object.fromEntries(sides.map(s=>[s,[...h.arms[s].elbow.world.p]])),floorMode:this.posture!=='standing'};}
 hasFloorRoom(seat,yaw,clips){return floorRoom(this.a.h,this.a.w,seat,yaw,clips)}
 chooseSeat(target){return chooseFloorSeat(this.a.w,actorForReasoning(this.a),target)}

 begin(skill){
  if(this.a.characterEditInProgress)throw Error('人物正在更新，请等待完成后再开始动作');
  if(skill.type==='sit'||skill.type==='lie'||skill.type==='stand'){
   this.startTransition({sit:'sitting',lie:'lying',stand:'standing'}[skill.type],false);return true;
  }
  r2RequireMotion(skill.type);
  if(skill.type==='greet'||skill.type==='wave'||skill.type==='salute'){
   if(this.posture!=='standing'){this.startTransition('standing',true);return true;}
   this.startGesture(skill.type,skill.duration);return true;
  }
  if(this.posture!=='standing'){this.automaticStandUps++;this.startTransition('standing',true);return true;}
  return false;
 }
 startTransition(target,resume){const a=this.a;
  if(a.characterEditInProgress)throw Error('人物正在更新，请等待完成后再开始动作');
  if(target===this.posture){if(resume){a.skill=null;a.begin()}else a.finish();return;}
  if(a.held)throw Error('双手持物时不能坐躺，请先完成放置');
  let seat=this.seat,yaw=a.yaw,support=null;
  if(this.posture==='standing'){const choice=this.chooseSeat(target);seat=choice.seat;yaw=choice.yaw;this.seat=[...seat];}
  else{
   support=this.supportState?structuredClone(this.supportState):null;
   if(support){seat=[...support.root];yaw=support.yaw;}
   if(!this.hasFloorRoom(a.pos,yaw,r2PostureClips(this.posture,target)))throw Error('身后躺卧范围被占用，请先起身走到空地');
  }
  const t={target,resume,seat,yaw,support,floorSupport:structuredClone(support?.floorSupport||{}),elapsed:0,stage:0,from:null,points:[],align:Math.abs(angleDiff(yaw,a.yaw))>.015};
  this.transition=t;this.gesture=null;
  if(t.align){a.enter('floorAlign');return;}
  this.preparePoints(t);
 }
 preparePoints(t){const a=this.a;t.align=false;t.from=this.capture();
  const clips=r2PostureClips(this.posture,t.target);
  t.points=clips.map(clip=>({clip,duration:R2_MOTION.clips[clip].durationS,kind:clip}));
  t.origin=a.h.root.p.slice();t.fromMotion=r2CaptureMotion(a.h,t.yaw);
  a.swing=null;a.gaitSignal=0;a.gaitBlend=0;t.elapsed=0;
  if(t.points[0]?.clip==='sitToStand')this.startSeatedPreparation(t);
  else a.enter(t.target==='standing'?'standUp':t.target==='lying'?'lieDown':'sitDown');
 }
 startSeatedPreparation(t){const a=this.a;
  const frames=new Map(a.h.joints.map(j=>[j.id,frame(j.world.p,j.world.q)]));
  const feet=Object.fromEntries(sides.map(side=>[side,{p:[...a.h.legs[side].wrist.world.p],q:[...a.h.legs[side].wrist.world.q],yaw:a.feet?.[side]?.yaw??t.yaw}]));
  t.preparation={kind:R2_SEATED_PREPARATION.revision,duration:R2_SEATED_PREPARATION.durationS,elapsed:0,stage:t.stage,frames,feet};
  t.elapsed=0;a.enter('standPrepare');
 }
 startGesture(type,duration){const a=this.a;r2RequireMotion(type);
  if(a.characterEditInProgress)throw Error('人物正在更新，请等待完成后再开始动作');
  this.gesture={type,time:0,duration:clamp(Number(duration)||(type==='salute'?R2_SALUTE_STANDARD.defaultDurationS:R2_MOTION.clips.wave.durationS),1.2,20),
   base:this.capture(),fromMotion:r2CaptureMotion(a.h,a.yaw),origin:a.h.root.p.slice(),releasing:false,
   goal:type==='salute'?r2SaluteGoal(a.h,a.yaw):null,
   quality:{samples:0,outsideTolerance:0,maxHandErrorM:0,maxFootErrorM:0,maxHandOrientationRad:0,maxFingertipErrorM:0}};
  a.enter(type==='salute'?'salute':'greet');
 }
 apply(desc,gesture=null,deltaTime=null){const a=this.a,h=a.h;
  h.pose({...desc,yaw:a.yaw,time:a.time,deltaTime,groundClearance:true});
  const projectedResidual=Math.max(0,...h.lastErrors.map(e=>e.error));
  if(projectedResidual>.018){
   this.reachProjectionCount++;this.maxProjectedResidualM=Math.max(this.maxProjectedResidualM,projectedResidual);
   this.reachProjectionLog.push({time:a.time,phase:gesture?.type||desc.kind||a.phase,residualM:projectedResidual,policy:'fixed-length-contact-IK'});
   if(this.reachProjectionLog.length>48)this.reachProjectionLog.shift();
  }
  const {ground,groundCorrectionM:correction}=h.motionDriver.report();
  this.lastMotionTracking=desc.reference&&desc.motionSource?.kind!=='standard'?r2MotionTracking(h,desc.reference,a.yaw):null;
  const feetResidual=Math.max(0,...h.lastErrors.filter(e=>/_foot$/.test(e.id)).map(e=>e.error));
  a.stats.maxFootPositionErrorM=Math.max(a.stats.maxFootPositionErrorM,feetResidual);
  this.lastGround=ground;this.floorMin=Math.min(this.floorMin,ground.y);this.maxFloorCorrection=Math.max(this.maxFloorCorrection,Math.abs(correction));this.samples++;
  a.pos=[...h.root.p];a.feet=Object.fromEntries(sides.map(s=>[s,{p:[...h.legs[s].wrist.world.p],q:[...h.legs[s].wrist.world.q],yaw:a.yaw}]));
  const d=h.diagnostics();a.stats.maxBoneLengthErrorM=Math.max(a.stats.maxBoneLengthErrorM,d.maxBoneLengthErrorM);
 }
 commitPending(){if(!this.pending)return false;const a=this.a,p=this.pending;this.pending=null;a.plan=p;a.index=0;a.skill=null;a.lastObject=p.lastObject;a.phase=this.posture==='standing'?'idle':this.posture==='sitting'?'groundSit':'groundLie';a.phaseT=0;return true;}
 update(dt){const a=this.a;
  if(this.transition){const t=this.transition;
   if(t.returnToLab){t.elapsed+=dt;this.apply({blendFrom:t.endFrames,blendAmount:smoother(t.elapsed/.4),preserveFootContactsOnBlend:true,motionSource:{kind:'lab-stance-blend',support:'adopted-final-foot-anchors'}},null,dt);if(t.elapsed>=.4)this.completeTransition(t);return;}
   if(t.preparation){const p=t.preparation;p.elapsed+=dt;const u=clamp(p.elapsed/p.duration,0,1);
    this.apply({...r2SeatedPreparationDescriptor(a.h,p.frames,p.feet,t.yaw,u,!!t.floorSupport.right),floorSupport:t.floorSupport,floorPalmWeight:t.floorSupport.right?1:0},null,dt);
    if(u>=1){
     this.lastSeatedPreparation={kind:p.kind,durationS:p.duration,stage:p.stage,tracking:this.lastMotionTracking||null};
     t.preparation=null;t.from=this.capture();t.fromMotion=r2CaptureMotion(a.h,t.yaw);
     t.origin=r2ReferenceOriginForPosition(a.h,'sitToStand',0,a.h.root.p,t.yaw);t.elapsed=0;a.enter('standUp');
    }return;
   }
    if(t.align){a.locomotion.turnInPlace(t.yaw,dt);a.gait(dt,false);a.h.pose({position:a.pos,yaw:a.yaw,feet:a.feet,locomotion:a.locomotion.sample,time:a.time,deltaTime:dt});if(Math.abs(angleDiff(t.yaw,a.yaw))<=.016&&a.locomotion.isSettled()){t.yaw=a.yaw;this.preparePoints(t);};return;}
   const current=t.points[t.stage];t.elapsed+=dt;const u=clamp(t.elapsed/current.duration,0,1);
   const blend=smoother(t.elapsed/Math.min(.25,current.duration*.15));
   this.apply({...r2ReferenceDescriptor(a.h,current.clip,u,t.origin,t.yaw,t.fromMotion,blend),floorSupport:t.floorSupport,floorPalmWeight:r2FloorPalmWeight(current.clip,u)},null,dt);
   if(t.elapsed>=current.duration){
    if(!this.lastMotionTracking?.passed){
     if(t.elapsed<current.duration+.6)return;
     this.lastPostureValidation={...this.lastMotionTracking,clip:current.clip,passed:false};this.transition=null;
     a.fail(`坐卧动作未到达参考姿态，未计为完成（腿部偏差 ${this.lastMotionTracking?.legDegrees.toFixed(1)}°，躯干偏差 ${this.lastMotionTracking?.torsoDegrees.toFixed(1)}°）。`);return;
    }
    this.lastPostureValidation={...this.lastMotionTracking,clip:current.clip,passed:true};
    this.phaseLog.push({time:a.time,kind:current.kind,minBoneY:this.lastGround.y});
    t.from=this.capture();t.fromMotion=r2CaptureMotion(a.h,t.yaw);t.origin=a.h.root.p.slice();t.stage++;t.elapsed=0;
    if(t.stage<t.points.length&&t.points[t.stage].clip==='sitToStand'){this.startSeatedPreparation(t);return;}
    if(t.stage>=t.points.length){
     if(t.target==='standing'){
      t.returnToLab=true;t.elapsed=0;t.endFrames=new Map(a.h.joints.map(j=>[j.id,frame(j.world.p,j.world.q)]));t.poseAdoption=a.locomotion.resetFromPose({preservePoseContacts:true});
     }else this.completeTransition(t);
    }
   }return;
  }
  if(this.gesture){const g=this.gesture;g.time+=dt;const ramp=Math.min(.35,g.duration*.15);let weight=smoother(Math.min(g.time/ramp,(g.duration-g.time)/ramp));
   if(g.releasing){g.releaseTime+=dt;weight=g.releaseWeight*(1-smoother(g.releaseTime/.32));}
   g.weight=weight;const desc=g.type==='salute'?r2SaluteDescriptor(a.h,g,weight):r2StandingGestureDescriptor(a.h,g,a.yaw,weight);
   desc.position=mix(g.base.position,desc.position,weight);this.apply(desc,{type:g.type},dt);
   if(!g.releasing&&weight>.90){
    const hand=a.h.lastErrors.find(e=>e.id==='right_hand'),feet=Math.max(0,...a.h.lastErrors.filter(e=>/_foot$/.test(e.id)).map(e=>e.error));
    const q=g.quality;q.samples++;q.maxHandErrorM=Math.max(q.maxHandErrorM,hand?.error||0);q.maxFootErrorM=Math.max(q.maxFootErrorM,feet);
    q.maxHandOrientationRad=Math.max(q.maxHandOrientationRad,hand?.orientationErrorRad||0);
    let fingertipError=0;
    if(g.type==='salute'){
     const tip=point(a.h.arms.right.wrist.world,g.goal.tipLocal),rise=a.h.root.p[1]-g.base.position[1];
     fingertipError=dist(tip,add(g.goal.temple,[0,rise,0]));q.maxFingertipErrorM=Math.max(q.maxFingertipErrorM,fingertipError);
    }
    if(g.type==='salute'?(!hand||hand.error>.04||feet>.012||hand.orientationErrorRad>.65||fingertipError>.04):!this.lastMotionTracking?.passed)q.outsideTolerance++;
   }
   if(!g.releasing&&g.time>=g.duration){
    const q=g.quality;this.lastGestureValidation={...q,type:g.type,passed:q.samples>0&&q.outsideTolerance/q.samples<=.20,
      tolerance:{handM:.04,footM:.012,handOrientationRad:.65},scope:'kinematic target tracking, not visual acceptance'};
    if(!this.lastGestureValidation.passed){this.gesture=null;a.fail('手势未达到手掌或脚部目标，已停止；请查看身体诊断中的目标误差');return;}
   }
   if((!g.releasing&&g.time>=g.duration)||(g.releasing&&g.releaseTime>=.32)){this.gesture=null;if(a.skill){if(g.releasing){a.evidence.push({step:a.index,type:a.skill.type,completion:'cancelled',reason:'replaced-by-new-command',time:a.time});a.stats.cancelled=(a.stats.cancelled||0)+1;a.skill=null;}else a.finish();}this.commitPending();a.phase=this.posture==='standing'?'idle':this.posture==='sitting'?'groundSit':'groundLie';}
   return;
  }
  if(this.hold){this.apply(this.hold,null,dt);a.phase=this.posture==='sitting'?'groundSit':'groundLie';}
 }
 completeTransition(t){
  const a=this.a;this.posture=t.target;this.hold=this.posture==='standing'?null:{...this.capture(),lockedFrames:new Map(a.h.joints.map(j=>[j.id,frame(j.world.p,j.world.q)]))};
  this.supportFrames=this.posture==='standing'?null:new Map(a.h.joints.map(j=>[j.id,frame(j.world.p,j.world.q)]));
  this.supportState=this.posture==='standing'?null:{kind:this.posture==='sitting'?'seatedStable':'lyingStable',root:[...a.h.root.p],yaw:a.yaw,
   feet:Object.fromEntries(sides.map(side=>[side,{p:[...a.h.legs[side].wrist.world.p],q:[...a.h.legs[side].wrist.world.q],yaw:a.feet?.[side]?.yaw??a.yaw}])),
   hands:Object.fromEntries(sides.map(side=>[side,copyFrame(a.h.palm(side))])),floorSupport:structuredClone(t.floorSupport),source:a.h.lastMotionSource};
  this.lastPoseAdoption=t.poseAdoption||this.lastPoseAdoption||null;this.transition=null;a.swing=null;
  if(this.cancelRequested){this.cancelRequested=false;a.skill=null;this.pending=null;}
  else if(t.resume){a.skill=null;if(!this.commitPending())a.begin();}
  else{if(a.skill)a.finish();this.commitPending();}
  if(!a.skill)a.phase=this.posture==='standing'?'idle':this.posture==='sitting'?'groundSit':'groundLie';
 }
 requestCancel(){
  this.pending=null;this.cancelRequested=!!this.transition;
  if(this.gesture&&!this.gesture.releasing)Object.assign(this.gesture,{releasing:true,releaseTime:0,releaseWeight:this.gesture.weight||0});
 }
 replacePending(plan){this.pending=plan;this.cancelRequested=false;
  if(this.gesture&&!this.gesture.releasing){Object.assign(this.gesture,{releasing:true,releaseTime:0,releaseWeight:this.gesture.weight||0});}
  this.a.log(this.gesture?'收回当前手势后执行新指令':'完成当前支撑转换后执行新指令，尚未开始的旧任务已取消');
 }
 report(){return {posture:this.posture,transition:this.transition?{target:this.transition.target,stage:this.transition.stage,align:this.transition.align,
   support:this.transition.support?.kind||null,preparation:this.transition.preparation?{kind:this.transition.preparation.kind,progress:clamp(this.transition.preparation.elapsed/this.transition.preparation.duration,0,1)}:null}:null,
  gesture:this.gesture?{type:this.gesture.type,weight:this.gesture.weight||0}:null,lastGestureValidation:this.lastGestureValidation||null,pendingReplacement:!!this.pending,
  referenceTracking:this.lastMotionTracking||null,lastPostureValidation:this.lastPostureValidation||null,lastSeatedPreparation:this.lastSeatedPreparation||null,
  supportState:this.supportState?structuredClone(this.supportState):null,lastPoseAdoption:this.lastPoseAdoption?structuredClone(this.lastPoseAdoption):null,
  minimumBoneYM:this.lastGround.y,lowestBone:this.lastGround.boneId,minFloorSampleYM:Number.isFinite(this.floorMin)?this.floorMin:null,
  maxVerticalClearanceCorrectionM:this.maxFloorCorrection,floorSamples:this.samples,automaticStandUps:this.automaticStandUps,
  reachability:{policy:'Motion-Lab candidate validation',projectionCount:this.reachProjectionCount,maxProjectedResidualM:this.maxProjectedResidualM,recent:this.reachProjectionLog.slice(-12)},
  motionReference:r2MotionReport(),contactModel:'source-motion retargeting and sampled deformed-surface clearance; force/friction not measured',phaseLog:[...this.phaseLog]};}
}
