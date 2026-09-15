/* Routes belong to Agent/PlanForecast. Root movement, stepping and contact
 * ownership belong exclusively to the pinned MotionController R2.2. */
const NATURAL_GAIT=Object.freeze({version:'motion-lab-r2.2',fixedStepS:1/120,maxSubsteps:24});
function motionCircleSweep(start,end,centre,radius){
 const d=sub(end,start),p=sub(start,centre),a=d[0]*d[0]+d[2]*d[2],c=p[0]*p[0]+p[2]*p[2]-radius*radius;
 if(c<=0)return 0;if(a<1e-16)return 1;
 const b=2*(p[0]*d[0]+p[2]*d[2]),disc=b*b-4*a*c;if(disc<0)return 1;
 const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?Math.max(0,t-1e-5):1;
}
function motionWorldSweep(world,start,end,radius,ignore=[]){
 const r=radius+.06,b=world.bounds,d=sub(end,start);let fraction=1;
 for(const [k,low,high]of [[0,b.xMin+radius,b.xMax-radius],[2,b.zMin+radius,b.zMax-radius]]){
  if(start[k]<low||start[k]>high)return{position:[...start],fraction:0,blocked:true};
  if(d[k]>0&&end[k]>high)fraction=Math.min(fraction,(high-start[k])/d[k]);
  if(d[k]<0&&end[k]<low)fraction=Math.min(fraction,(low-start[k])/d[k]);
 }
 for(const o of world.objects){
  if(ignore.includes(o.id)||o.held||o.collidable===false)continue;
  if(objectTilted(o)){const [rx,rz]=objectFootprint(o);const flat=new MotionLab.FlatWorld([{minX:o.p[0]-rx-r,maxX:o.p[0]+rx+r,minZ:o.p[2]-rz-r,maxZ:o.p[2]+rz+r}]);fraction=Math.min(fraction,flat.sweep(start,end,0).fraction);continue;}
  if(o.shape!=='box'){fraction=Math.min(fraction,motionCircleSweep(start,end,o.p,(o.r||objectRadius(o))+r));continue;}
  const q=qy(-objectYaw(o)),a=rotate(q,sub(start,o.p)),z=rotate(q,sub(end,o.p)),x=o.w/2,y=o.d/2;
  // Swept circle/OBB: two side strips and four rounded corners, sharing
  // World's circle/OBB clearance convention.
  const flat=new MotionLab.FlatWorld([{minX:-x-r,maxX:x+r,minZ:-y,maxZ:y},{minX:-x,maxX:x,minZ:-y-r,maxZ:y+r}]);
  fraction=Math.min(fraction,flat.sweep(a,z,0).fraction);
  for(const sx of [-1,1])for(const sz of [-1,1])fraction=Math.min(fraction,motionCircleSweep(a,z,[sx*x,0,sz*y],r));
 }
 return{position:add(start,mul(d,fraction)),fraction,blocked:fraction<1-1e-9};
}
class MotionLabWorld {
 constructor(agent){this.a=agent;}
 context(radius){const a=this.a,body=radius>.1,profile=bodyPhysicalProfile(a.h),ignore=a.skill?.o?[a.skill.o.id]:[];
  return {radius:body?Math.max(profile.bodyRadiusM,a.held?(a.skill?.type==='carry'?carryRouteRadius(a.held,profile,a.skill?.carryConfiguration):profile.pushClearanceM):0):radius*a.h.bodyMetrics.statureScale,ignore};}
 free(point,radius){const a=this.a,c=this.context(radius);return !a.w.collision(point,c.radius,c.ignore)&&!a.w.population?.collisionFor(a,point,c.radius);}
 sweep(start,end,radius){
  const a=this.a,c=this.context(radius),result=motionWorldSweep(a.w,start,end,c.radius,c.ignore);
  // The population excludes this actor, including when the kernel queries feet.
  const fraction=Math.min(result.fraction,a.w.population?.sweepFor(a,start,end,c.radius)??1);
  return{position:add(start,mul(sub(end,start),fraction)),fraction,blocked:fraction<1-1e-9};
 }
}
class NaturalLocomotion {
 constructor(agent){
  this.a=agent;const source=agent.h.resolvedRig;this.rig=MotionLab.rigFromSource(source);
  // Source left/right ankle heights differ slightly. Use the higher ankle
  // plane so both individually resolved skin soles clear the flat floor.
  this.skinFloorOffsetM=Math.max(...['left','right'].map(s=>source.nodes[s+'_foot'].positionM[1]-source.sourceFloorM))-this.rig.ankleHeight;
  this.rig.ankleHeight+=this.skinFloorOffsetM;this.rig.hipHeight=agent.h.bodyMetrics.walkingHipHeightM;
  this.standingHipHeightM=agent.h.bodyMetrics.standingHipHeightM;
  this.engine=new MotionLab.MotionController(this.rig);
  this.world=new MotionLabWorld(agent);this.engine.world=this.world;
  this.pose=new MotionLabPose(agent.h,this.engine);agent.h.motionDriver=this.pose;
  this.resetFromPose();
 }
 resetFromPose({preservePoseContacts=false}={}){
  const a=this.a,e=this.engine,h=a.h,yaw=a.yaw;
  // A posture clip can end with a valid but non-standard stance. Rebuilding
  // the lab from its authored default used to move both feet before the
  // return-to-stance blend even started. When requested, adopt the committed
  // hip midpoint and ankle joints as the new navigation/contact state.
  const currentHip=side=>h.byId?.get(side+'_femur')?.world?.p||h.legs?.[side]?.upper?.world?.p;
  const currentFoot=side=>h.byId?.get(side+'_foot')?.world?.p||h.legs?.[side]?.wrist?.world?.p;
  const leftHip=preservePoseContacts&&currentHip('left'),rightHip=preservePoseContacts&&currentHip('right');
  const root=leftHip&&rightHip?mix(leftHip,rightHip,.5):[a.pos[0],this.standingHipHeightM,a.pos[2]];
  const world=e.world;e.world=new MotionLab.FlatWorld();e.reset();e.world=world;
  e.state.root=[...root];e.state.yaw=yaw;e.state.time=a.time;
  let maximumAdoptedFootResidualM=0;
  for(const side of ['left','right']){
   const foot=preservePoseContacts&&currentFoot(side),previousYaw=a.feet?.[side]?.yaw;
   e.state.feet[side]={position:foot?[...foot]:e.stance(e.state,side),yaw:Number.isFinite(previousYaw)?previousYaw:yaw,contact:true};
  }
  e.state.pose=e.solve(e.state);
  for(const side of ['left','right']){
   const leg=e.state.pose.legs[side],foot=e.state.feet[side],residual=dist(leg.end,foot.position);
   maximumAdoptedFootResidualM=Math.max(maximumAdoptedFootResidualM,residual);
   if(residual>.012||leg.lengthError>1e-7)throw Error('当前姿势的脚位无法安全交给行走控制器');
  }
  this.lastPoseAdoption={preserved:!!(leftHip&&rightHip),maximumAdoptedFootResidualM,
   root:[...e.state.root],feet:Object.fromEntries(['left','right'].map(side=>[side,[...e.state.feet[side].position]]))};
  this.requestKey=null;this.requested=false;this.tempo=1;this.routePassThroughCount=this.routePassThroughCount||0;
  this.traffic={active:false,waitS:0,totalWaitS:0,blockers:[],nextCheckAtS:0};this.sync();
  return structuredClone(this.lastPoseAdoption);
 }
 sync(){const a=this.a,s=this.engine.state;
  a.pos=[...s.root];a.yaw=s.yaw;a.swing=s.swing?{side:s.swing.side,t:s.swing.elapsed,duration:s.swing.duration}:null;
  a.feet=Object.fromEntries(['left','right'].map(side=>[side,{p:[...s.feet[side].position],yaw:s.feet[side].yaw,contact:s.feet[side].contact}]));
  this.speed=s.speed*this.tempo;this.velocity=this.speed;this.blend=s.motion.weight;this.state=s.status;this.contacts=Object.fromEntries(['left','right'].map(side=>[side,s.feet[side].contact?'planted':'swing']));
  a.gaitBlend=this.blend;a.gaitSignal=s.motion.frame?clamp(s.motion.frame.leftUpperArm[2]-s.motion.frame.rightUpperArm[2],-1,1):0;a.walkSpeed=this.speed;
  this.sample={motionLab:true,sourceClip:'08_01'};
 }
 request(command){
  this.requested=true;const key=JSON.stringify(command);
  if(this.requestKey===key&&this.engine.state.command)return;
  const answer=this.engine.command(command);if(!answer.accepted)throw Error(answer.reason);this.requestKey=key;
 }
 waitForTraffic(dt,target){
  const a=this.a,population=a.w.population,traffic=this.traffic;
  if(!population)return false;
  if(traffic.active&&a.time<traffic.nextCheckAtS){
   traffic.waitS+=dt;traffic.totalWaitS+=dt;this.stop();return true;
  }
  const context=this.world.context(.23);
  // Static route errors still fail through the regular controller. Only a
  // moving actor can turn this check into a bounded, observable wait.
  if(a.w.collision(target,context.radius,context.ignore)){traffic.active=false;return false;}
  if(!population.collisionFor(a,target,context.radius)){traffic.active=false;traffic.waitS=0;traffic.blockers=[];return false;}
  traffic.active=true;traffic.phase=a.phase;traffic.target=[...target];traffic.reason='npc-at-route-target';
  traffic.waitS+=dt;traffic.totalWaitS+=dt;traffic.nextCheckAtS=a.time+.2;
  traffic.blockers=[...population.values()].filter(other=>other.agent!==a&&other.id!==a.npcId&&!other.disposed).filter(other=>{
   const radius=context.radius+bodyPhysicalProfile(other.human).bodyRadiusM+.06;
   return horizontal(target,other.agent.pos)<radius;
  }).map(other=>other.id);
  if(traffic.waitS>30)throw Error('等待其他 NPC 让行超时，保持当前安全支撑：'+traffic.blockers.join('、'));
  this.stop();return true;
 }
 routePassThrough(index){
  const a=this.a,s=this.engine.state,current=a.route[index],next=a.route[index+1];
  if(!current||!next)return false;
  const previous=index>0?a.route[index-1]:s.root,into=sub(current,previous),out=sub(next,current);
  if(horizontal(previous,current)<1e-6||horizontal(current,next)<1e-6)return true;
  const headingIn=Math.atan2(into[0],into[2]),headingOut=Math.atan2(out[0],out[2]),turn=Math.abs(angleDiff(headingOut,headingIn));
  // Only round a shallow, collision-free waypoint. Tight corners retain their
  // explicit target so the controller can brake and place a support foot.
  if(turn>Math.PI/4)return false;
  const pace=clamp(s.speed/.48,0,1),radius=.045+.115*pace*Math.max(.25,Math.cos(turn));
  if(horizontal(s.root,current)>radius)return false;
  const sweep=this.world.sweep(s.root,next,.23);
  return !sweep.blocked;
 }
 atFinalRoutePoint(toleranceM=.02){
  const end=this.a.route.at(-1);return !!end&&horizontal(this.engine.state.root,end)<=toleranceM;
 }
 canContinuousTaskHandoff(){
  const a=this.a,current=a.skill,next=a.plan?.steps[a.index+1],end=a.route.at(-1);
  if(current?.type!=='walk'||next?.type!=='walk'||!end||!this.atFinalRoutePoint())return false;
  const from=a.route.length>1?a.route.at(-2):current.startPosition;
  if(!from||horizontal(from,end)<.02)return false;
  const target=a.w.get(next.targetId),nextEnd=walkDestination(a.w,actorForReasoning(a),next,target);
  if(!nextEnd||horizontal(end,nextEnd)<.05)return false;
  const incoming=Math.atan2(end[0]-from[0],end[2]-from[2]),outgoing=Math.atan2(nextEnd[0]-end[0],nextEnd[2]-end[2]);
  const turnRad=Math.abs(angleDiff(outgoing,incoming));if(turnRad>Math.PI/3)return false;
  this.lastContinuousWalkHandoff={exitSpeedMps:a.walkSpeed,turnRad,endpoint:[...end]};
  current.continuousWalkHandoff=structuredClone(this.lastContinuousWalkHandoff);return true;
 }
 move(dt,speed=.48){
  const a=this.a,s=this.engine.state;
  const pace=a.manipulationPace();
  // A blocked load requests normal braking, never a frozen mid-air foot.
  // Route ownership is retained so recovery can resume the same destination.
  if(a.held&&pace<.08){this.tempo=1;this.stop();return a.routeIndex<a.route.length||!this.isSettled();}
  this.tempo=clamp(speed/.48*(a.strength?.movementFactor()??1)*pace,.05,1);
  if(this.canContinuousTaskHandoff()){
   if(!a.pendingPhysicsFinish)a.finish();
   return true;
  }
  while(a.routeIndex<a.route.length){
   if(a.routeIndex<a.route.length-1&&this.routePassThrough(a.routeIndex)){a.routeIndex++;this.routePassThroughCount++;continue;}
   if(horizontal(s.root,a.route[a.routeIndex])>.015)break;
   if(a.routeIndex===a.route.length-1){if(s.command||!this.isSettled()){this.requested=true;return true;}a.routeIndex++;return false;}
   a.routeIndex++;
  }
  if(a.routeIndex>=a.route.length)return false;
  if(this.waitForTraffic(dt,a.route[a.routeIndex]))return true;
  this.request({type:'walk',target:[...a.route[a.routeIndex]]});return true;
 }
 turnInPlace(yaw,dt){
  const pace=this.a.manipulationPace();
  if(this.a.held&&pace<.08){this.tempo=1;this.stop();return true;}
  this.tempo=clamp(pace,.05,1);
  if(Math.abs(angleDiff(yaw,this.engine.state.yaw))<.015&&this.kernelSettled()){this.requested=true;return !this.isSettled();}
  this.request({type:'turn',yaw});return true;
 }
 stop(){if(this.kernelSettled()){this.requested=true;return;}if(!this.engine.state.fault)this.request({type:'stop'});}
 kernelSettled(){const s=this.engine.state;return !s.fault&&!s.swing&&s.speed<.001&&s.status==='idle';}
 standingTarget(){
  const s=this.engine.state,scale=this.a.h.bodyMetrics.statureScale;let target=this.standingHipHeightM;
  for(const side of ['left','right']){
   const hip=add(s.root,rotate(qy(s.yaw),[this.rig.hipHalf*(side==='left'?-1:1),0,0])),foot=s.feet[side].position;
   const reach=this.rig.legs[side].upper+this.rig.legs[side].lower-.0005*scale,d=horizontal(hip,foot);
   target=Math.min(target,foot[1]+Math.sqrt(Math.max(0,reach*reach-d*d)));
  }
  return target;
 }
 isSettled(){return this.kernelSettled()&&Math.abs(this.engine.state.root[1]-this.standingTarget())<.0003*this.a.h.bodyMetrics.statureScale;}
 updateHeight(dt,standing){
  const e=this.engine;if(e.state.paused||e.state.fault)return;
  const target=standing?this.standingTarget():Math.min(this.rig.hipHeight,this.standingTarget()),before=e.state;
  const y=Math.min(this.standingTarget(),before.root[1]+(target-before.root[1])*(1-Math.exp(-dt/.18)));
  if(Math.abs(y-before.root[1])<1e-10)return;
  const candidate={...before,root:[before.root[0],y,before.root[2]]};candidate.pose=e.solve(candidate);
  for(const side of ['left','right']){
   const leg=candidate.pose.legs[side];
   if(leg.residual>.012||leg.lengthError>1e-7)throw Error('站立高度过渡超出固定脚锚可达范围');
  }
  e.state=candidate;
 }
 canTransition(){return this.isSettled();}
 update(dt){
  const e=this.engine;
  if(this.traffic.active&&this.traffic.phase!==this.a.phase){this.traffic.active=false;this.traffic.waitS=0;this.traffic.blockers=[];}
  if(!this.requested&&e.state.command?.type==='walk')this.stop();
  this.requested=false;
  if(!this.kernelSettled())this.updateHeight(dt*this.tempo,false);
  e.update(dt*this.tempo);
  if(e.state.fault||e.state.status==='blocked')throw Error(e.state.fault||'连续碰撞检测发现路线受阻，目标未完成');
  // The scheduler may have advanced an independent foot target. Apply its
  // exact reach ceiling once more; do not leave even a small clamped-IK foot
  // hovering above that anchor while the height response catches up.
  this.updateHeight(this.kernelSettled()?dt*this.tempo:0,this.kernelSettled());
  this.sync();
 }
 report(){const s=this.engine.state;return{version:NATURAL_GAIT.version,state:s.status,speedMps:this.speed,timeScale:this.tempo,contacts:{...this.contacts},settled:this.isSettled(),
  source:MotionLab.MOTION_SOURCE,sourcePhase:s.motion.phase,referenceBlend:s.motion.weight,metrics:{...s.metrics},skinFloorOffsetM:this.skinFloorOffsetM,
  height:{standingTargetM:this.standingHipHeightM,walkingTargetM:this.rig.hipHeight,currentM:s.root[1],reachableStandingM:this.standingTarget(),timeConstantS:.18},
  traffic:structuredClone(this.traffic),routePassThroughCount:this.routePassThroughCount,poseAdoption:this.lastPoseAdoption?structuredClone(this.lastPoseAdoption):null,
  continuousWalkHandoff:this.lastContinuousWalkHandoff?structuredClone(this.lastContinuousWalkHandoff):null,
  contactBasis:'Motion-Lab explicit foot anchors',pose:this.pose.report(),visualAcceptance:false};}
}
