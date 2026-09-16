/* Task extensions compose the lab's pose and contact primitives.
 * Capture-derived crouch + bounded forward flexion + task-space hand IK is an
 * adaptation, not a recording of manipulation. Object transfer stays in Agent.
 */
const MOTION_ACTIONS=Object.freeze({
 walk:{basis:'Human-Motion-Lab R2.2 controlled gait'},turn:{basis:'Human-Motion-Lab R2.2 placement-step turn'},
 sit:{basis:'CMU 113_08, shared pose adapter'},lie:{basis:'CMU 113_08, shared pose adapter'},
 stand:{basis:'CMU 113_08 then blend to lab stance'},greet:{basis:'CMU 113_27'},wave:{basis:'CMU 113_27'},
 salute:{basis:'published drill specification and anatomical hand target'},
 carry:{basis:'lab gait, CMU-derived crouch and bilateral contact IK',motionCaptured:false},
 push:{basis:'lab gait, CMU-derived crouch and bilateral contact IK',motionCaptured:false}
});
const motionContactCandidates=new WeakMap();
const motionContactAdapters=new WeakMap();
const motionCarryStates=new WeakMap(),motionCarryConfigurations=new WeakMap();
const motionPreflightModels=new WeakMap();
function motionDrainPreflight(iterator){let step;do{step=iterator.next();}while(!step.done);return step.value;}
function motionAdvancePreflight(job,budgetMs=3){
 if(job.done)return job;
 const start=performance.now();
 try{do{const step=job.iterator.next();job.steps=(job.steps||0)+1;if(step.done){job.done=true;job.result=step.value;break;}}while(performance.now()-start<budgetMs);}
 catch(error){job.done=true;job.error=error;}
 job.lastSliceMs=performance.now()-start;job.sliceCpuMs=(job.sliceCpuMs||0)+job.lastSliceMs;job.maximumSliceMs=Math.max(job.maximumSliceMs||0,job.lastSliceMs);return job;
}
function motionPreflightModel(h){
 const signature=JSON.stringify([typeof CONTACT_HAND_POSE_REVISION==='undefined'?null:CONTACT_HAND_POSE_REVISION,h.resolvedRig,h.bodyMetrics,[...h.sourceBind],['left','right'].map(s=>[h.arms[s].s,h.arms[s].L1,h.arms[s].L2])]);
 let model=motionPreflightModels.get(h);
 if(!model||model.signature!==signature){
  if(typeof contactHandRecipes!=='undefined')contactHandRecipes.delete(h);
  model={signature,certificates:new Map(),handCertificates:new Map()};motionPreflightModels.set(h,model);
  motionContactCandidates.delete(h);motionContactAdapters.delete(h);motionCarryStates.delete(h);motionCarryConfigurations.delete(h);
 }
 return model;
}
function motionLocalCertificate(h,adapter,position,yaw,world,objectId,kind,parameters){
 const model=motionPreflightModel(h),origin=[position[0],0,position[2]],q=qy(yaw),iq=inv(q);
 const point=p=>rotate(iq,sub(p,origin)),rotation=v=>qm(iq,v),localFrame=f=>({p:point(f.p),q:rotation(f.q)}),s=adapter.engine.state;
 const body=world.physics.bodies.get(objectId)?.body;
 if(!body)throw Error('接触证书缺少实际物体几何');
 const shapeKey=motionObjectShapeKey(body);
 const feet=['left','right'].map(side=>[point(s.feet[side].position),angleDiff(s.feet[side].yaw,yaw),s.feet[side].contact,s.feet[side].adoptedOrientation?rotation(s.feet[side].adoptedOrientation):null]);
 const legs=['left','right'].map(side=>{const l=s.pose.legs[side];return[point(l.root),point(l.knee),point(l.end),l.residual,l.lengthError];});
 const inputs=[kind,shapeKey,point(s.root),angleDiff(s.yaw,yaw),feet,legs,adapter.pose.frameData(s,null),adapter.pose.balanceInput?.()||null,parameters({point,rotation,frame:localFrame})];
 // Quotient out a common world translation/yaw. The 1 pm serialization bin
 // only removes round-off introduced by that coordinate change. Reuse needs
 // an extra 0.1 mm clearance reserve; boundary passes are never cached.
 const key=JSON.stringify(inputs,(_,v)=>typeof v==='number'?Math.round(v*1e12)/1e12:v),cached=model.certificates.get(key);
 return{cached,point,worldPoint:p=>add(origin,rotate(q,p)),save(result,environment=[]){
  if(result.minimumClearanceM<.0081||result.maximumPalmErrorM>.0009||result.minimumHandClearanceM<.0006||result.minimumHingeReserveDegrees<.001||result.maximumFootErrorM>.0119||result.maximumBoneErrorM>.00009||result.maximumAttachmentErrorM>.00009)return;
  if(model.certificates.size>=64)model.certificates.delete(model.certificates.keys().next().value);
  model.certificates.set(key,{result:Object.freeze({...result}),environment});
 }};
}
function motionObjectShapeKey(body){return body.shapes.map((v,i)=>[v.type,v.radius,v.halfExtents&&[v.halfExtents.x,v.halfExtents.y,v.halfExtents.z],
 v.vertices?.map(p=>[p.x,p.y,p.z]),v.faces,v.faceNormals?.map(p=>[p.x,p.y,p.z]),body.shapeOffsets[i].toArray(),body.shapeOrientations[i].toArray()]);}
function motionCheckCertificateEnvironment(certificate,world,h,ignore,environment){
 for(const [id,p]of environment)if(world.collision(certificate.worldPoint(p),motionBodyPartRadius(h,id),ignore))throw Error('抬放路径的头肩净空不足');
}
function motionProofMargins(){return{minimumHingeReserveDegrees:Infinity,maximumFootErrorM:0,maximumBoneErrorM:0,maximumAttachmentErrorM:0};}
function motionAccumulateProofMargins(margins,report){
 margins.minimumHingeReserveDegrees=Math.min(margins.minimumHingeReserveDegrees,report.hingeReserveDegrees);
 margins.maximumFootErrorM=Math.max(margins.maximumFootErrorM,report.footErrorM);margins.maximumBoneErrorM=Math.max(margins.maximumBoneErrorM,report.boneErrorM);margins.maximumAttachmentErrorM=Math.max(margins.maximumAttachmentErrorM,report.attachmentErrorM);
}
function motionCarrySamples(h){return motionDrainPreflight(motionCarrySamplesSteps(h));}
function* motionCarrySamplesSteps(h){
 motionPreflightModel(h);
 if(motionCarryStates.has(h))return motionCarryStates.get(h);
 // Generate the character's own fixed-foot walking parameters once. This is
 // a private controller, with no writes to live joints, objects or GPU buffers.
 const human={...h},agent={h:human,pos:[0,0,0],yaw:0,time:0,phase:'travel',route:[[0,0,2]],routeIndex:0,
  manipulationPace:()=>1,strength:{movementFactor:()=>1},w:{objects:[],bounds:{xMin:-10,xMax:10,zMin:-10,zMax:10},collision:()=>false}};
 const locomotion=new NaturalLocomotion(agent),states=[structuredClone(locomotion.engine.state)];
 for(let i=1;i<=360;i++){yield;agent.time+=1/120;locomotion.move(1/120,.43);locomotion.update(1/120);states.push(structuredClone(locomotion.engine.state));}
 const result={states,pose:locomotion.pose.forPreflight(),engine:locomotion.engine};result.pose.sourceHuman=h;motionCarryStates.set(h,result);return result;
}
function motionChooseCarryConfiguration(h,object,grips,relativeQ,world){return motionDrainPreflight(motionChooseCarryConfigurationSteps(h,object,grips,relativeQ,world));}
function* motionChooseCarryConfigurationSteps(h,object,grips,relativeQ,world){
 motionPreflightModel(h);
 let cache=motionCarryConfigurations.get(h);if(!cache){cache=new Map();motionCarryConfigurations.set(h,cache);}
 const rounded=v=>Math.round(v*1e12)/1e12,key=JSON.stringify([motionObjectShapeKey(world.physics.bodies.get(object.id).body),object.shape,object.templateId,object.w,object.h,object.d,object.r,relativeQ.map(rounded),Object.values(grips).map(g=>[g.p.map(rounded),g.q.map(rounded)]),h.motionDriver?.balanceInput?.()||null]);
 if(cache.has(key))return cache.get(key);
 const samples=yield* motionCarrySamplesSteps(h),m=h.bodyMetrics,reach=r2Mean(side=>m.armReachM[side]),contactHand=motionContactHand(object);
 const rear=object.shape==='box'?Math.abs(rotate(relativeQ,[object.w/2,0,0])[2])+Math.abs(rotate(relativeQ,[0,0,object.d/2])[2]):object.r;
 const minForward=m.torsoRadiusM+rear+.025;
 const gripHeight=r2Mean(side=>rotate(relativeQ,grips[side].p)[1]),shoulderHeight=motionStandingHipHeight(h)+r2Mean(side=>h.resolvedRig.nodes[side+'_upperArm'].positionM[1]-h.resolvedRig.nodes.hips.positionM[1]);
 const failures=[];
 for(const [dropRatio,baseForward,poleLateralM] of [[.45,.44,.60],[.425,.44,.60],[.475,.44,.60],[.45,.42,.60],[.45,.46,.60],[.45,.44,.45],[.45,.44,.30],[.50,.44,.60],[.40,.44,.60]]){
  const forwardM=Math.max(minForward,motionForwardDistance(h,baseForward)),heightM=shoulderHeight-dropRatio*reach-gripHeight;
  if(heightM<object.h/2+.08)continue;
  try{let minimumClearanceM=Infinity,minimumHandClearanceM=Infinity;
   const order=[...samples.states.filter((_,i)=>i%30===0),...samples.states.filter((_,i)=>i%30!==0)];
   for(const state of order){
    yield;
    samples.engine.state=structuredClone(state);const goal=frame(add([state.root[0],heightM,state.root[2]],rotate(qy(state.yaw),[0,0,forwardM])),qm(qy(state.yaw),relativeQ));
    const hands=Object.fromEntries(['left','right'].map(side=>[side,compose(goal,grips[side])])),candidate=samples.pose.build({hands,armPoleLateralM:poleLateralM,contactHand}),report=samples.pose.validate(candidate);
    if(report.handErrorM>.001)throw Error('携物配置没有保留足够的手部可达余量');
    minimumClearanceM=Math.min(minimumClearanceM,motionRequireObjectClearance(h,world,object.id,candidate.frames,goal,.008));
    minimumHandClearanceM=Math.min(minimumHandClearanceM,motionRequireContactHandClearance(h,world,object.id,candidate.frames,goal,contactHand));
   }
   const chosen=Object.freeze({heightM,forwardM,poleLateralM,minimumClearanceM,minimumHandClearanceM,contactHandMode:contactHand?.mode,standingAndWalkingSamples:samples.states.length,method:'body-and-object-checked-carry/v1'});
   if(minimumClearanceM>=.0081&&minimumHandClearanceM>=.0006){if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(key,chosen);}return chosen;
  }catch(error){failures.push(error.message);}
 }
 throw Error('没有同时满足臂长与全身物体净空的携物配置：'+[...new Set(failures)].slice(0,3).join('；'));
}
function motionContactAdapter(h,position,yaw){
 motionPreflightModel(h);
 let adapter=motionContactAdapters.get(h);
 if(!adapter){
  const rig=MotionLab.rigFromSource(h.resolvedRig);
  rig.ankleHeight=Math.max(...['left','right'].map(s=>h.resolvedRig.nodes[s+'_foot'].positionM[1]-h.resolvedRig.sourceFloorM));
  rig.hipHeight=h.bodyMetrics.standingHipHeightM;
  const engine=new MotionLab.MotionController(rig);adapter={engine,pose:new MotionLabPose(h,engine).forPreflight()};motionContactAdapters.set(h,adapter);
 }
 const e=adapter.engine,current=h.motionDriver?.engine?.state;
 if(current&&Math.hypot(current.root[0]-position[0],current.root[2]-position[2])<.02&&Math.abs(Math.atan2(Math.sin(current.yaw-yaw),Math.cos(current.yaw-yaw)))<.02)e.state=structuredClone(current);
 else{
  e.reset();e.state.root=[position[0],h.bodyMetrics.standingHipHeightM,position[2]];e.state.yaw=yaw;
  for(const side of ['left','right'])e.state.feet[side]={position:e.stance(e.state,side),yaw,contact:true};e.state.pose=e.solve(e.state);
 }
 return adapter;
}
function motionRequireObjectClearance(h,world,objectId,frames,objectPose=null,minimumM=.008){
 const clearance=world.physics.bodyObjectClearance(objectId,h,frames,objectPose),worst=clearance.rows.reduce((a,b)=>a.clearanceM<b.clearanceM?a:b);
 if(worst.clearanceM<minimumM)throw Error('非接触身体进入物体净空：'+worst.id+' '+Math.round(worst.clearanceM*1000)+' mm');
 return clearance.minimumClearanceM;
}
function motionRequireContactHandClearance(h,world,objectId,frames,objectPose,contactHand){
 if(!contactHand)return Infinity;
 // Every caller has just built/validated this fixed-length finger recipe.
 // Its hand-local FK depends only on the recipe and amount; world motion of
 // an object with fixed palms cannot change those segments' box distances.
 // Key the actual solved hand transforms, retaining residuals (not goals).
 const model=motionPreflightModels.get(h)||motionPreflightModel(h),body=world.physics.bodies.get(objectId).body;
 const object=objectPose||frame(world.physics.array(body.position),[body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w]),inverseObject=inverse(object);
 const key=JSON.stringify([motionObjectShapeKey(body),contactHand,['left','right'].map(side=>compose(inverseObject,frames.get(side+'_hand')))],(_,v)=>typeof v==='number'?Math.round(v*1e12)/1e12:v);
 if(model.handCertificates.has(key))return model.handCertificates.get(key);
 const clearance=contactHandObjectClearance(h,frames,world.physics,objectId,objectPose);
 if(clearance.minimumClearanceM<.0005)throw Error('手指骨段进入箱体净空：'+clearance.worstSegment+' '+Math.round(clearance.minimumClearanceM*10000)/10+' mm');
 if(clearance.minimumClearanceM>=.0006){if(model.handCertificates.size>=512)model.handCertificates.delete(model.handCertificates.keys().next().value);model.handCertificates.set(key,clearance.minimumClearanceM);}
 return clearance.minimumClearanceM;
}
function contactCandidates(h){return motionDrainPreflight(contactCandidatesSteps(h));}
function* contactCandidatesSteps(h){
 motionPreflightModel(h);
 if(motionContactCandidates.has(h))return motionContactCandidates.get(h);
 const source=new MotionLab.FullBodyMotion(motionContactAdapters.get(h)?.pose.h.resolvedRig.nodes||h.resolvedRig.nodes),hip=h.bodyMetrics.restHipHeightM;
 const lowHip=h.bodyMetrics.crouchLowHipM,candidates=[];
 const hipAxis=norm(sub(h.resolvedRig.nodes.right_femur.positionM,h.resolvedRig.nodes.left_femur.positionM));
 for(const captured of r2MotionClips.get('standToSit').samples){
  const heightM=captured.rootHeightRatio*hip;
  if(captured.t>.55||heightM<lowHip||heightM>motionStandingHipHeight(h))continue;
  for(const forwardFlexionDegrees of [0,7.5,15,22.5,30,37.5,45]){
   yield;
   // The sitting capture folds the knees while keeping the upper body rather
   // upright. Lowering that same capture further made the knees enter the
   // floor. Keep its safe pelvis height and search a bounded forward hip
   // hinge instead. This is an authored contact fit, not another capture.
   let rootQ=qm(qx(radians(forwardFlexionDegrees)),captured.rootQ);
   // Match MotionLabPose.controlledPelvisRotation: controlled leg roots own
   // the pelvis axis. Preview reach must use the same axis as the committed
   // fixed-foot candidate, not the capture's sideways pelvis tilt.
   rootQ=qnorm(qm(fromTo(rotate(rootQ,hipAxis),[1,0,0]),rootQ));
   const reference={...captured,rootQ},positions=source.positions({root:[0,heightM,0],yaw:0,motion:{frame:reference,weight:1}});
   candidates.push({reference,heightM,progress:captured.t,shoulders:Object.fromEntries(['left','right'].map(s=>[s,positions.get(s+'_upperArm')])),
    head:positions.get('head'),source:{kind:'contact-adaptation',clip:'standToSit',trial:'113_08',
     method:'bounded-forward-contact-fit/v1',forwardFlexionDegrees,minimumHipHeightM:lowHip,measuredManipulation:false}});
  }
 }
 // Prefer the smallest added bend that works, then the highest available
 // pelvis. Otherwise source-time ordering would pick a 45-degree bend while
 // almost standing even when a modest bend and safe squat can reach.
 candidates.sort((a,b)=>a.source.forwardFlexionDegrees-b.source.forwardFlexionDegrees||b.heightM-a.heightM);
 motionContactCandidates.set(h,candidates);return candidates;
}
function motionChooseContact(h,position,yaw,hands,world=null,ignore=[],options={}){return motionDrainPreflight(motionChooseContactSteps(h,position,yaw,hands,world,ignore,options));}
function* motionChooseContactSteps(h,position,yaw,hands,world=null,ignore=[],options={}){
 const inverseYaw=qy(-yaw),origin=[position[0],0,position[2]];
 const wrists=Object.fromEntries(['left','right'].map(side=>[side,rotate(inverseYaw,sub(sub(hands[side].p,rotate(hands[side].q,h.bodyMetrics.palmContact)),origin))]));
 const objectId=ignore[0],object=world?.objects?.find(o=>o.id===objectId),checked=object&&world?.physics?.bodyObjectClearance;
 const adapter=checked?motionContactAdapter(h,position,yaw):null,failures=[],contactHand=motionContactHand(object);
 const objectPose=options.objectPose||(object?frame(object.p,object.q):null),carryConfiguration=options.carryConfiguration||(options.grips&&checked?(yield* motionChooseCarryConfigurationSteps(h,object,options.grips,qm(inv(qy(yaw)),objectPose.q),world)):null);
 const choice=checked?motionLocalCertificate(h,adapter,position,yaw,world,objectId,'contact-choice',local=>[
  local.frame(objectPose),Object.fromEntries(['left','right'].map(s=>[s,local.frame(hands[s])])),options.grips,carryConfiguration,contactHand]):null;
 // A prior successful local fit is only a search hint. Its environment and
 // the complete transfer/reach certificates are checked again below.
 const hint=choice?.cached?.result.contact?structuredClone(choice.cached.result.contact):null,candidates=yield* contactCandidatesSteps(h),ordered=hint?[hint,...candidates.filter(c=>c.heightM!==hint.heightM||c.source.forwardFlexionDegrees!==hint.source.forwardFlexionDegrees)]:candidates;
 for(const candidate of ordered){
  yield;
  const reachable=['left','right'].every(side=>{
   const {L1:l1,L2:l2}=h.arms[side],distance=dist(wrists[side],candidate.shoulders[side]);
   return distance<l1+l2-.008&&distance>Math.abs(l1-l2)+.025;
  });
  if(!reachable)continue;
  if(world&&[['head',candidate.head],...Object.entries(candidate.shoulders).map(([side,p])=>[side+'_upperArm',p])].some(([id,p])=>world.collision(add(origin,rotate(qy(yaw),p)),motionBodyPartRadius(h,id),ignore)))continue;
  try{
   let selected={...candidate,carryConfiguration,contactHandMode:contactHand?.mode};
   if(checked){
    const pose=adapter.pose.build({reference:candidate.reference,position:[position[0],candidate.heightM,position[2]],yaw,controlledFeet:true,hands,armPoleLateralM:carryConfiguration?.poleLateralM,contactHand});adapter.pose.validate(pose);
    const minimumClearanceM=motionRequireObjectClearance(h,world,objectId,pose.frames,options.objectPose||frame(object.p,object.q));
    const minimumHandClearanceM=motionRequireContactHandClearance(h,world,objectId,pose.frames,objectPose,contactHand);
    selected={...selected,bodyClearance:{minimumClearanceM,allowedContactEffectors:['leftPalm','rightPalm'],excludedBodyProxies:[]},handClearance:{minimumHandClearanceM,scope:'all metacarpal/finger bone segments including tips; not skin volume'}};
   }
   if(options.grips)yield* motionValidateTransferContactsSteps(h,position,yaw,options.grips,objectPose,selected,world,ignore,16);
   if(checked)yield* motionValidateContactReachSteps(h,position,yaw,hands,selected,world,ignore,20,objectPose);
   // Sparse passes only reject candidates. Acceptance uses every fixed-step
   // parameter interval of the authored reach and two-second transfer paths.
   if(options.grips)yield* motionValidateTransferContactsSteps(h,position,yaw,options.grips,objectPose,selected,world,ignore,252);
   if(checked)yield* motionValidateContactReachSteps(h,position,yaw,hands,selected,world,ignore,204,objectPose);
   choice?.save({contact:structuredClone(selected),minimumClearanceM:selected.bodyClearance.minimumClearanceM,minimumHandClearanceM:selected.handClearance.minimumHandClearanceM,maximumPalmErrorM:0});
   return selected;
  }catch(error){failures.push(error.message);}
 }
 throw Error('下蹲参考范围内没有找到双手均可到达且具有净空的接触姿态'+(failures.length?'：'+[...new Set(failures)].slice(0,3).join('；'):''));
}
function motionCarryHeight(h){const p=id=>h.resolvedRig.nodes[id].positionM;return motionStandingHipHeight(h)+r2Mean(s=>p(s+'_upperArm')[1]-p('hips')[1])-
 .65*r2Mean(s=>h.arms[s].L1+h.arms[s].L2);}
function motionArmReachRatio(h){const m=h.bodyMetrics;return r2Mean(s=>m.armReachM[s])/r2Mean(s=>m.reference.armReachM[s]);}
function motionForwardDistance(h,referenceM){const m=h.bodyMetrics,reach=motionArmReachRatio(h);return referenceM*reach+(m.torsoDepthM-m.reference.torsoDepthM*reach)/2;}
function motionCarryForward(h){return motionForwardDistance(h,.34);}
function motionApproachDistance(h){return motionForwardDistance(h,.46);}
function motionBodyPartRadius(h,id){
 const m=h.bodyMetrics,s=m.statureScale;
 if(id==='head')return m.headRadiusM+.07*s;
 if(id==='neck'||/^[C]\d+$/.test(id))return m.headRadiusM;
 if(/_(?:upperArm|forearm|radiusRotation|SC|AC)$/.test(id))return m.armRadiusM;
 if(/_(?:femur|tibia|patella)$/.test(id))return m.legRadiusM;
 if(/_(?:hand|finger_)/.test(id))return .04*s;
 if(/_(?:foot|subtalar|midfoot|metatarsal|toe)/.test(id))return .045*s;
 return m.torsoRadiusM;
}
function motionValidateTransferContacts(h,position,yaw,grips,ground,contact,world,ignore=[],samples=252){return motionDrainPreflight(motionValidateTransferContactsSteps(h,position,yaw,grips,ground,contact,world,ignore,samples));}
function* motionValidateTransferContactsSteps(h,position,yaw,grips,ground,contact,world,ignore=[],samples=252){
 const base=qy(yaw);
 const carried=frame(add([position[0],contact.carryConfiguration?.heightM??motionCarryHeight(h),position[2]],rotate(base,[0,0,contact.carryConfiguration?.forwardM??motionCarryForward(h)])),ground.q);
 const checked=world?.physics?.bodyObjectClearance&&ignore[0],adapter=checked?motionContactAdapter(h,position,yaw):null;
 const contactHand=contact.contactHandMode?{mode:contact.contactHandMode,amount:1}:null;
 const certificate=checked?motionLocalCertificate(h,adapter,position,yaw,world,ignore[0],'transfer',local=>[
  samples,local.frame(ground),grips,contact.reference,contact.heightM,contact.carryConfiguration,contactHand]):null;
 if(certificate?.cached){motionCheckCertificateEnvironment(certificate,world,h,ignore,certificate.cached.environment);return{...certificate.cached.result,certificateReused:true};}
 const source=new MotionLab.FullBodyMotion(adapter?.pose.h.resolvedRig.nodes||h.resolvedRig.nodes),environment=[];
 // Shared forecast/execution check of the authored lift/lower interpolation.
 // These are private skeletal parameter candidates, never live joint writes.
 let minimumClearanceM=Infinity,minimumHandClearanceM=Infinity,maximumPalmErrorM=0;const margins=motionProofMargins();
 for(let i=0;i<=samples;i++){
  yield;
  const u=i/samples,reference=MotionLab.blend(contact.reference,source.neutral,u);
  const root=[position[0],contact.heightM+(motionStandingHipHeight(h)-contact.heightM)*u,position[2]];
  const points=source.positions({root,yaw,motion:{frame:reference,weight:1}}),object=frame(mix(ground.p,carried.p,u),ground.q);
  const hands=Object.fromEntries(['left','right'].map(side=>[side,compose(object,grips[side])]));
  for(const side of ['left','right']){
   const palm=compose(object,grips[side]),wrist=sub(palm.p,rotate(palm.q,h.bodyMetrics.palmContact));
   const {L1:l1,L2:l2}=h.arms[side],distance=dist(wrist,points.get(side+'_upperArm'));
   if(distance>l1+l2-.005||distance<Math.abs(l1-l2)+.02)throw Error('抬起或放下的中间路径超出双手可达范围');
  }
  if(checked){const candidate=adapter.pose.build({reference,position:root,yaw,controlledFeet:true,hands,armPoleLateralM:contact.carryConfiguration?.poleLateralM,contactHand}),report=adapter.pose.validate(candidate);motionAccumulateProofMargins(margins,report);maximumPalmErrorM=Math.max(maximumPalmErrorM,report.handErrorM);if(report.handErrorM>.001)throw Error('抬放中间路径未保留手部可达余量');minimumClearanceM=Math.min(minimumClearanceM,motionRequireObjectClearance(h,world,ignore[0],candidate.frames,object));minimumHandClearanceM=Math.min(minimumHandClearanceM,motionRequireContactHandClearance(h,world,ignore[0],candidate.frames,object,contactHand));}
  if(world)for(const id of ['head','left_upperArm','right_upperArm']){
   const p=points.get(id);if(certificate)environment.push([id,certificate.point(p)]);
   if(world.collision(p,motionBodyPartRadius(h,id),ignore))throw Error('抬放路径的头肩净空不足');
  }
 }
 const result={...margins,parameterSamples:samples+1,maximumPalmErrorM,minimumClearanceM:Number.isFinite(minimumClearanceM)?minimumClearanceM:null,minimumHandClearanceM,scope:'fixed bones, palm reach, all non-contact body proxies against the moving object; box contact includes metacarpal/finger segments and tips; environmental head/shoulder clearance; not skin volume',visualAcceptance:false};
 certificate?.save(result,environment);return result;
}
function motionValidateContactReach(h,position,yaw,hands,contact,world,ignore,samples=204,objectPose=null){return motionDrainPreflight(motionValidateContactReachSteps(h,position,yaw,hands,contact,world,ignore,samples,objectPose));}
function* motionValidateContactReachSteps(h,position,yaw,hands,contact,world,ignore,samples=204,objectPose=null){
 const adapter=motionContactAdapter(h,position,yaw),object=world.objects.find(o=>o.id===ignore[0]),actualObject=objectPose||frame(object.p,object.q);
 const certificate=motionLocalCertificate(h,adapter,position,yaw,world,ignore[0],'reach',local=>[
  samples,local.frame(actualObject),Object.fromEntries(['left','right'].map(s=>[s,local.frame(hands[s])])),contact.reference,contact.heightM,contact.carryConfiguration,contact.contactHandMode]);
 if(certificate.cached)return{...certificate.cached.result,certificateReused:true};
 const initial=adapter.pose.build();
 const startHands=Object.fromEntries(['left','right'].map(side=>[side,compose(initial.frames.get(side+'_hand'),frame(h.bodyMetrics.palmContact))]));
 const agent={h,phase:'reach',locomotion:adapter,skill:{o:object,contactPose:contact,carryConfiguration:contact.carryConfiguration,reachStart:motionFreeHandEndpoints(h,initial.frames,startHands)}};
 let minimumClearanceM=Infinity,minimumHandClearanceM=Infinity,maximumPalmErrorM=0;const margins=motionProofMargins();
 for(let i=0;i<=samples;i++){
  yield;
  const t=i/samples,goals=motionReachHands(agent,hands,t),descriptor=motionContactDescriptor(agent,goals,t),candidate=adapter.pose.build({...descriptor,hands:goals}),report=adapter.pose.validate(candidate);
  motionAccumulateProofMargins(margins,report);
  maximumPalmErrorM=Math.max(maximumPalmErrorM,report.handErrorM);if(report.handErrorM>.001)throw Error('伸手中间路径未保留手部可达余量');
  minimumClearanceM=Math.min(minimumClearanceM,motionRequireObjectClearance(h,world,ignore[0],candidate.frames,objectPose));
  minimumHandClearanceM=Math.min(minimumHandClearanceM,motionRequireContactHandClearance(h,world,ignore[0],candidate.frames,objectPose,descriptor.contactHand));
 }
 const result={...margins,parameterSamples:samples+1,minimumClearanceM,minimumHandClearanceM,maximumPalmErrorM};certificate.save(result);return result;
}
function motionContactHand(object,amount=1){return object?.shape==='box'?{mode:CONTACT_HAND_POSE_REVISION,amount}:null;}
function motionContactDescriptor(agent,hands,crouch,phase=agent.phase){
 const e=agent.locomotion.engine,state=e.state,base=agent.h.motionDriver.frameData(state,null);
 const contact=agent.skill?.contactPose,weight=clamp(crouch,0,1);
 if(!contact&&weight>0)throw Error('任务缺少已经预检的双手接触姿态');
 if(!contact)return{controlledFeet:true,motionSource:{kind:'contact-adaptation',phase,weight:0}};
 const free=phase==='reach'||phase==='rise',poleWeight=free?weight:1,handAmount=free?smoother(clamp(weight*3,0,1)):1;
 const contactHand=contact.contactHandMode?{mode:contact.contactHandMode,amount:handAmount}:motionContactHand(agent.skill?.o,handAmount);
 return {reference:MotionLab.blend(base,contact.reference,weight),controlledFeet:true,armPoleLateralM:.30+((agent.skill?.carryConfiguration?.poleLateralM??.30)-.30)*poleWeight,
  position:[state.root[0],state.root[1]+(contact.heightM-state.root[1])*weight,state.root[2]],
  motionSource:{...contact.source,phase,weight},floorMode:false,contactHand};
}
function motionFreeHandEndpoints(h,frames,hands){
 return Object.fromEntries(['left','right'].map(side=>{
  const palm=hands[side],wrist=sub(palm.p,rotate(palm.q,h.bodyMetrics.palmContact));
  return [side,{offset:sub(wrist,frames.get(side+'_upperArm').p),q:[...palm.q]}];
 }));
}
function motionInterpolateFreeHands(h,frames,from,to,amount){
 // Free wrists follow the moving shoulders. A linear interpolation between
 // two reachable shoulder-relative offsets stays inside the reach ball;
 // interpolating world palms while the shoulder moves does not.
 const t=clamp(amount,0,1);
 return Object.fromEntries(['left','right'].map(side=>{
  const p=add(frames.get(side+'_upperArm').p,mix(from[side].offset,to[side].offset,t)),q=qslerp(from[side].q,to[side].q,t);
  return [side,compose(frame(p,q),frame(h.bodyMetrics.palmContact))];
 }));
}
function motionReachHands(agent,targetHands,amount){
 const t=clamp(amount,0,1),start=agent.skill?.reachStart;
 if(!start)throw Error('伸手动作缺少已记录的起点肩腕关系');
 const pose=agent.locomotion.pose,shoulders=u=>{const options=motionContactDescriptor(agent,null,u);return pose.preflightOnly?pose.reachShoulders(options):pose.build(options).frames;},candidate=shoulders(t);
 // The skill freezes this reach's goal, yaw and contact pose. Cache only the
 // two endpoint wrist offsets/quaternions, derived once from the real builder.
 // Every frame uses that builder for moving shoulders. A changed balance
 // input also moves the endpoint shoulders, so invalidate its offsets too.
 const balanceKey=JSON.stringify(pose.balanceInput?.()||null);
 if(!agent.skill.reachTarget||agent.skill.reachBalanceKey!==balanceKey){const end=t===1?candidate:shoulders(1);
  agent.skill.reachTarget=motionFreeHandEndpoints(agent.h,end,targetHands);agent.skill.reachBalanceKey=balanceKey;}
 const target=agent.skill.reachTarget;
 const hands=motionInterpolateFreeHands(agent.h,candidate,start,target,t);
 if(agent.skill.contactPose?.contactHandMode||agent.skill.o?.shape==='box'){
  // The relaxed atlas hand sweeps inward while its palm turns onto the box.
  // A small outward wrist arc follows the final contact-face normal. Both
  // endpoints stay exact, and the same arc is checked by dense pose IK.
  const outsideM=.025*agent.h.bodyMetrics.statureScale*4*t*(1-t);
  for(const side of ['left','right'])hands[side].p=add(hands[side].p,rotate(target[side].q,[0,0,-outsideM]));
 }
 return hands;
}
function motionTurnYaw(step,yaw){
 if(step.type!=='turn')throw Error('不是转向步骤');
 if(Number.isFinite(step.headingDeg)&&step.angleDeg==null&&Math.abs(step.headingDeg)<=360)return radians(step.headingDeg);
 if(Number.isFinite(step.angleDeg)&&Math.abs(step.angleDeg)<=360)return yaw+radians(step.angleDeg);
 throw Error('转向角度必须在 -360 到 360 度之间');
}
function motionStandingHipHeight(h){return h.bodyMetrics.standingHipHeightM;}
function motionTurnPlan(step,yaw){
 const target=motionTurnYaw(step,yaw),delta=step.angleDeg!=null?radians(step.angleDeg):angleDiff(target,yaw),count=Math.max(1,Math.ceil(Math.abs(delta)/(Math.PI/2)));
 return Array.from({length:count},(_,i)=>yaw+delta*(i+1)/count);
}
function parseMotionCommand(text){
 const number=t=>{if(t==='半')return .5;if(/^\d+(?:\.\d+)?$/.test(t))return Number(t);let sum=0,n=0;const digits='零一二三四五六七八九';
  for(const c of t.replace(/两/g,'二')){if(digits.includes(c))n=digits.indexOf(c);else if(c==='十'||c==='百'){sum+=(n||1)*(c==='十'?10:100);n=0;}else return NaN;}return sum+n;};
 const turn=text.match(/^(?:原地)?(?:向|往)?(左|右|后)(?:转|转身|转向)([零一二两三四五六七八九十百\d.]+)?(?:度|°)?$/);
 if(turn){const angle=turn[2]?number(turn[2]):turn[1]==='后'?180:90;return{type:'turn',angleDeg:turn[1]==='左'?-angle:angle};}
 const walk=text.match(/^(?:(?:向|往|朝)(前|后|左|右)(?:方|面|边)?(?:走|行走|移动|前进)?|(?:向)?(前进|后退)|(?:走|行走))(\d+(?:\.\d+)?|[零一二两三四五六七八九十百]+|半)(米|公尺|m|厘米|cm)$/i);
 if(!walk)return null;return{type:'walk',direction:({前:'forward',后:'backward',左:'left',右:'right',前进:'forward',后退:'backward'})[walk[1]||walk[2]]||'forward',distanceM:number(walk[3])*(/^(厘米|cm)$/i.test(walk[4])?.01:1),referenceFrame:'self'};
}
