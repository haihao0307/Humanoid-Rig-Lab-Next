/* Handleless compact boxes: an upper stabilising hand and an opposite
 * bottom ledge hand. A supported tip creates finger clearance before the
 * lower hand moves under the box; placement reverses that sequence.
 * Authored contact adaptation, not captured motion or a grip-force model.
 * Sources: CCOHS MMH Compact Loads / Handholds I; HSE good handling technique.
 */
function motionBoxHandlingGeometry(object,yaw,pose=frame(object.p,object.q),recipe={supportAngle:10,entryAngle:15}){
 if(object.shape!=='box')return null;
 const toward=rotate(inv(pose.q),rotate(qy(yaw),[0,0,-1]));
 const rear=Math.abs(toward[0])>Math.abs(toward[2])?[Math.sign(toward[0]),0,0]:[0,0,Math.sign(toward[2])];
 const up=[0,1,0],right=cross(up,mul(rear,-1));
 const depth=rear[0]?object.w:object.d,width=rear[0]?object.d:object.w;
 const at=(x,y,z)=>add(add(mul(right,x),mul(up,y)),mul(rear,z));
 const palm=(p,long,normal)=>{const y=mul(norm(long),-1),z=norm(normal),x=norm(cross(y,z));return frame(p,qb(x,y,z));};
 const lower=palm(at(-width*.28,-object.h/2,depth/2),mul(rear,-1),up);
 const upper=palm(at(width/2,object.h/2-.025,depth/2),norm(add(mul(rear,-Math.cos(recipe.supportAngle*Math.PI/180)),[0,Math.sin(recipe.supportAngle*Math.PI/180),0])),mul(right,-1));
 const entry=palm(at(-width/2,object.h/2-.025,depth/2-.035),norm(add(mul(rear,-.5),[0,-.8660254,0])),right);
 const angle=20*Math.PI/180,delta=[...mul(right,Math.sin(angle/2)),Math.cos(angle/2)],pivot=at(0,-object.h/2,-depth/2);
 const pivotWorld=add(pose.p,rotate(pose.q,pivot)),q=qm(pose.q,delta),tilted=frame(sub(pivotWorld,rotate(q,pivot)),q);
 return{kind:'diagonal-bottom-ledge/v1',pivot,upright:frame(pose.p,pose.q),tilted,
  entryGrips:{left:entry,right:palm(at(width/2,object.h/2-.025,depth/2),norm(add(mul(rear,-Math.cos(recipe.entryAngle*Math.PI/180)),[0,-Math.sin(recipe.entryAngle*Math.PI/180),0])),mul(right,-1))},supportGrips:{left:lower,right:upper},
  outside:frame(at(-width/2-.07,-object.h/2+.020,depth/2-.035),lower.q),
  minimumFingerSpaceM:depth*Math.sin(angle)-.035*Math.sin(angle),tiltRadians:angle};
}
function motionBoxGripTransition(plan,amount){
 const t=clamp(amount,0,1),a=plan.entryGrips.left,b=plan.outside,c=plan.supportGrips.left;
 // Clear the side before turning the palm upward, then enter the space
 // beneath the raised edge. The other hand remains on its upper corner.
 const blend=(x,y,u)=>frame(mix(x.p,y.p,smoother(u)),qslerp(x.q,y.q,smoother(u)));
 const away=frame([b.p[0],a.p[1],b.p[2]],a.q);
 const left=t<.25?blend(a,away,t/.25):t<.75?blend(away,b,(t-.25)/.5):blend(b,c,(t-.75)/.25);
 if(t>=.75){const u=(t-.75)/.25;left.p[1]=b.p[1]+(c.p[1]-b.p[1])*smoother(clamp(u*2,0,1));}
 return{left,right:blend(plan.entryGrips.right,plan.supportGrips.right,clamp(t*2,0,1))};
}

// Geometry only: physics owns the actual object transform at every live step.
function motionBoxAdjustment(plan,amount){
 const t=clamp(amount,0,1),tip=smoother(clamp(t/.4,0,1)),regrip=clamp((t-.4)/.6,0,1);
 const q=qslerp(plan.upright.q,plan.tilted.q,tip);
 // Rotate about the far bottom edge, retaining its floor support.
 const pivot=add(plan.upright.p,rotate(plan.upright.q,plan.pivot));
 const object=frame(sub(pivot,rotate(q,plan.pivot)),q);
 const grips=motionBoxGripTransition(plan,regrip),body=smoother(clamp((t-.15)/.6,0,1));
 const contact={...plan.supportContact,reference:MotionLab.blend(plan.entryContact.reference,plan.supportContact.reference,body),heightM:plan.entryContact.heightM+(plan.supportContact.heightM-plan.entryContact.heightM)*body};
 return{object,grips,contact,regrip,activeHands:regrip>0&&regrip<1?['right']:['left','right']};
}
function* motionValidateBoxAdjustmentSteps(h,position,yaw,plan,world,objectId,samples=480){
 const adapter=motionContactAdapter(h,position,yaw),contactHand=motionContactHand(world.objects.find(o=>o.id===objectId));
 let minimumClearanceM=Infinity,minimumHandClearanceM=Infinity,minimumFingerHeightM=Infinity,maximumPalmErrorM=0,maximumJointStepM=0,previous=null;
 const margins=motionProofMargins();
 for(let i=0;i<=samples;i++){
  yield;const step=motionBoxAdjustment(plan,i/samples),hands=Object.fromEntries(['left','right'].map(side=>[side,compose(step.object,step.grips[side])]));
  try{
   const candidate=adapter.pose.build({reference:step.contact.reference,position:[position[0],step.contact.heightM,position[2]],yaw,controlledFeet:true,hands,armPoleLateralM:plan.supportContact.carryConfiguration.poleLateralM,contactHand});
   const report=adapter.pose.validate(candidate);motionAccumulateProofMargins(margins,report);maximumPalmErrorM=Math.max(maximumPalmErrorM,report.handErrorM);
   if(report.handErrorM>.001)throw Error('换手目标没有保持可达余量');
   minimumClearanceM=Math.min(minimumClearanceM,motionRequireObjectClearance(h,world,objectId,candidate.frames,step.object));
   minimumHandClearanceM=Math.min(minimumHandClearanceM,motionRequireContactHandClearance(h,world,objectId,candidate.frames,step.object,contactHand));
   for(const segment of contactHandSegments(h,candidate.frames))minimumFingerHeightM=Math.min(minimumFingerHeightM,segment.a[1],segment.b[1]);
   if(minimumFingerHeightM<.012*h.bodyMetrics.statureScale)throw Error('扣底或抽手路径没有手指离地空间');
   if(previous)for(const [id,f]of candidate.frames)maximumJointStepM=Math.max(maximumJointStepM,dist(previous.get(id).p,f.p));
   if(maximumJointStepM>.02)throw Error('换手路径关节跳变超过 2 cm');
   previous=candidate.frames;
  }catch(error){throw Error('箱体倾转/换手 '+(i/samples).toFixed(3)+'：'+error.message);}
 }
 return{...margins,parameterSamples:samples+1,minimumClearanceM,minimumHandClearanceM,minimumFingerHeightM,maximumPalmErrorM,maximumJointStepM};
}
function* motionPlanBoxHandlingSteps(h,object,position,yaw,world,configuration=null,pose=frame(object.p,object.q),recipe={supportAngle:10,entryAngle:15}){
 const plan=motionBoxHandlingGeometry(object,yaw,pose,recipe);if(!plan)return null;
 const relativeQ=qm(inv(qy(yaw)),plan.tilted.q);
 const carryConfiguration=configuration||(yield* motionChooseCarryConfigurationSteps(h,object,plan.supportGrips,relativeQ,world));
 const palms=(object,grips)=>Object.fromEntries(['left','right'].map(side=>[side,compose(object,grips[side])]));
 plan.entryContact=yield* motionChooseContactSteps(h,position,yaw,palms(plan.upright,plan.entryGrips),world,[object.id],{objectPose:plan.upright,carryConfiguration});
 plan.supportContact=yield* motionChooseContactSteps(h,position,yaw,palms(plan.tilted,plan.supportGrips),world,[object.id],{objectPose:plan.tilted,carryConfiguration,grips:plan.supportGrips,contactOnly:true,transferProfile:'ledge',validateTransition:function*(contact){plan.supportContact=contact;
  plan.adjustmentProof=yield* motionValidateBoxAdjustmentSteps(h,position,yaw,plan,world,object.id);}});
 return plan;
}

function motionBoxApproachOffsets(object,preferred){
 const heading=Math.atan2(preferred[0],preferred[2]);
 return [[0,0,1],[1,0,0],[0,0,-1],[-1,0,0]].map(axis=>{
  const direction=rotate(object.q,axis);return angleDiff(Math.atan2(direction[0],direction[2]),heading);
 }).sort((a,b)=>Math.abs(a)-Math.abs(b));
}

// Whole-plan forecasts intentionally have no live physics world. Build a
// private collision-query view; never advance it or mutate the forecast.
function motionBoxQueryWorld(world){
 if(world.physics?.bodyObjectClearance)return world;
 const query=Object.assign(Object.create(Object.getPrototypeOf(world)),world,{
  objects:world.objects.map(o=>({...o,p:[...o.p],q:[...o.q],v:[...(o.v||[0,0,0])],angularVelocity:[...(o.angularVelocity||[0,0,0])]})),
  bounds:{...world.bounds},physicsSettings:{...world.physicsSettings},population:null,collision:(...args)=>world.collision(...args)
 });
 query.physics=new PhysicsWorld(query);return query;
}
