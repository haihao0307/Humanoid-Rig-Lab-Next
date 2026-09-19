/* Routes belong to Agent/PlanForecast. Root movement, stepping and contact
 * ownership belong exclusively to the pinned MotionController R2.2. */
const NATURAL_GAIT=Object.freeze({version:'motion-lab-r2.2',fixedStepS:1/120,maxSubsteps:24});
const TRAFFIC_AVOIDANCE=Object.freeze({horizonS:1.8,sampleS:.15,planCooldownS:.22,sideMarginM:.14,slotGapM:.16,corridorLeaseS:6,corridorProbeM:.12});
const trafficRuntimeByPopulation=new WeakMap();
function motionCircleSweep(start,end,centre,radius){
 const d=sub(end,start),p=sub(start,centre),a=d[0]*d[0]+d[2]*d[2],c=p[0]*p[0]+p[2]*p[2]-radius*radius;
 if(c<=0)return p[0]*d[0]+p[2]*d[2]>1e-9?1:0;if(a<1e-16)return 1;
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
function trafficHash(value){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function trafficPairSide(a,b){return trafficHash([String(a||''),String(b||'')].sort().join('|'))&1?1:-1;}
function trafficActorVelocity(actor){
 const a=actor.agent,raw=Number(a.walkSpeed??a.locomotion?.speed??0),speed=a.paused||!Number.isFinite(raw)?0:Math.max(0,Math.min(.75,raw));
 return [Math.sin(a.yaw||0)*speed,0,Math.cos(a.yaw||0)*speed];
}
function trafficRoutePoint(agent,distance){
 let from=agent.locomotion?.engine?.state?.root||agent.pos,remaining=Math.max(0,distance);
 for(let i=agent.routeIndex;i<agent.route.length;i++){
  const to=agent.route[i],segment=horizontal(from,to);
  if(remaining<=segment||i===agent.route.length-1){const t=segment?clamp(remaining/segment,0,1):1;return mix(from,to,t);}
  remaining-=segment;from=to;
 }
 return [...from];
}
function predictTrafficConflict(agent,speed,context){
 const population=agent.w.population;if(!population||!agent.route?.length)return null;
 const ownSpeed=Math.max(.18,Math.min(.65,Number(speed)||.48));let best=null;
 for(const other of population.values()){
  if(other.agent===agent||other.id===agent.npcId||other.disposed)continue;
  const otherRadius=bodyPhysicalProfile(other.human).bodyRadiusM,threshold=context.radius+otherRadius+TRAFFIC_AVOIDANCE.sideMarginM,velocity=trafficActorVelocity(other);
  for(let t=TRAFFIC_AVOIDANCE.sampleS;t<=TRAFFIC_AVOIDANCE.horizonS+1e-9;t+=TRAFFIC_AVOIDANCE.sampleS){
   const selfPoint=trafficRoutePoint(agent,ownSpeed*t),otherPoint=add(other.agent.pos,mul(velocity,t)),separation=horizontal(selfPoint,otherPoint);
   if(separation>=threshold)continue;
   const score=t+separation*.05;
   if(!best||score<best.score)best={actor:other,timeS:t,selfPoint,otherPoint,separation,threshold,score};
   break;
  }
 }
 return best;
}
function trafficSegmentClear(agent,start,end,context,{dynamic=true}={}){
 if(motionWorldSweep(agent.w,start,end,context.radius,context.ignore).fraction<1-1e-6)return false;
 return !dynamic||(agent.w.population?.sweepFor(agent,start,end,context.radius)??1)>=1-1e-6;
}
function trafficRuntime(population){
 if(!population)return null;let runtime=trafficRuntimeByPopulation.get(population);
 if(!runtime){runtime={slots:new Map(),corridors:new Map()};trafficRuntimeByPopulation.set(population,runtime);}return runtime;
}
function trafficTaskKey(agent){
 const s=agent.skill;if(!s)return null;return [agent.index,s.type,s.targetId||'',s.objectId||'',agent.phase].join('|');
}
function trafficCorridorLocal(agent,point,direction,context){
 const right=[direction[2],0,-direction[0]],probe=context.radius*2+TRAFFIC_AVOIDANCE.sideMarginM+TRAFFIC_AVOIDANCE.corridorProbeM,left=add(point,mul(right,probe)),rightPoint=add(point,mul(right,-probe));
 left[1]=0;rightPoint[1]=0;
 const leftBlocked=motionWorldSweep(agent.w,point,left,context.radius,context.ignore).fraction<1-1e-6,rightBlocked=motionWorldSweep(agent.w,point,rightPoint,context.radius,context.ignore).fraction<1-1e-6;
 return{narrow:leftBlocked&&rightBlocked,leftBlocked,rightBlocked,probe,right};
}
function trafficCorridorDescriptor(agent,start,end,context){
 let direction=sub(end,start);direction[1]=0;if(len(direction)<.35)return null;direction=norm(direction);
 const midpoint=mix(start,end,.5),local=trafficCorridorLocal(agent,midpoint,direction,context);if(!local.narrow)return null;
 const obstacles=(agent.w.objects||[]).filter(o=>o.collidable!==false&&!context.ignore.includes(o.id)&&pointToObjectClearance(midpoint,o)<local.probe+context.radius+.45);
 if(obstacles.length<2)return null;
 const obstacleIds=obstacles.map(o=>String(o.id)).sort(),axis=Math.abs(direction[0])>=Math.abs(direction[2])?'x':'z',axisIndex=axis==='x'?0:2,lateralIndex=axis==='x'?2:0,sign=direction[axisIndex]>=0?1:-1;
 let lower=Infinity,upper=-Infinity;
 for(const o of obstacles){const [rx,rz]=objectFootprint(o),extent=axis==='x'?rx:rz;lower=Math.min(lower,o.p[axisIndex]-extent);upper=Math.max(upper,o.p[axisIndex]+extent);}
 if(!Number.isFinite(lower)||!Number.isFinite(upper)||upper-lower<.35)return null;
 return{key:'corridor:'+axis+':'+obstacleIds.join(','),direction,sign,midpoint,obstacleIds,axis,axisIndex,lateralIndex,lower,upper};
}
function trafficPruneCorridors(population,runtime,now){
 const live=new Map([...population.values()].filter(actor=>!actor.disposed).map(actor=>[actor.id,actor]));
 for(const [key,lease]of runtime.corridors){const actor=live.get(lease.ownerId),a=actor?.agent;if(!a||lease.expiresAtS<=now||trafficTaskKey(a)!==lease.taskKey)runtime.corridors.delete(key);}
}
function trafficReleaseCorridor(locomotion){
 const a=locomotion.a,t=locomotion.traffic,population=a.w.population,key=t?.corridorKey;
 if(key&&population){const runtime=trafficRuntime(population),lease=runtime?.corridors.get(key);if(lease?.ownerId===a.npcId)runtime.corridors.delete(key);}
 if(t)Object.assign(t,{corridorKey:null,corridorTaskKey:null,corridorOwner:null,corridorDirection:0,corridorDescriptor:null,corridorOrbit:null,corridorOrbitIndex:0,corridorOrbitCycleStart:0,corridorOrbitLaps:0});
}
function trafficCorridorPriority(agent,other,descriptor){
 const root=agent.locomotion?.engine?.state?.root||agent.pos,ownDistance=horizontal(root,descriptor.midpoint),otherDistance=horizontal(other.agent.pos,descriptor.midpoint);
 if(ownDistance+.25<otherDistance)return agent.npcId;if(otherDistance+.25<ownDistance)return other.id;
 return[String(agent.npcId),String(other.id)].sort()[0];
}
function trafficGoalKey(agent,goal){
 const id=agent.skill?.targetId||agent.skill?.objectId;
 return id?'target:'+id:'point:'+goal.map(v=>Number(v).toFixed(2)).join(',');
}
function trafficPruneSlotClaims(population,runtime){
 const live=new Map([...population.values()].filter(actor=>!actor.disposed).map(actor=>[actor.id,actor]));
 for(const [key,claims]of runtime.slots){
  for(const [id]of claims){const actor=live.get(id),a=actor?.agent;if(!a||a.skill?.type!=='walk')claims.delete(id);}
  if(!claims.size)runtime.slots.delete(key);
 }
}
function trafficReleaseTargetSlot(locomotion){
 const a=locomotion.a,t=locomotion.traffic,key=t?.slotKey,population=a.w.population;
 if(key&&population){const runtime=trafficRuntime(population),claims=runtime?.slots.get(key);claims?.delete(a.npcId);if(claims&&!claims.size)runtime.slots.delete(key);}
 if(t)Object.assign(t,{slotKey:null,slotTaskKey:null,slotPoint:null,slotIndex:null});
}
function trafficSlotCandidates(agent,goal,context){
 const target=agent.skill?.targetId&&agent.w.get?.(agent.skill.targetId),spacing=Math.max(.62,context.radius*2+TRAFFIC_AVOIDANCE.slotGapM),seed=trafficHash(String(agent.npcId||'')),candidates=[[...goal]];
 const zone=target?.id?.startsWith?.('Z'),centre=zone?[target.p[0],0,target.p[2]]:[...goal],maximum=zone?Math.max(0,(target.r||0)-context.radius-.08):spacing*1.7;
 const radii=zone?[Math.min(spacing,maximum),Math.min(spacing*1.65,maximum)]:[spacing,spacing*1.55];
 for(const radius of radii){if(radius<.08)continue;for(let k=0;k<8;k++){const angle=(k+(seed%8))/8*Math.PI*2,p=[centre[0]+Math.sin(angle)*radius,0,centre[2]+Math.cos(angle)*radius];if(zone&&horizontal(p,target.p)>maximum+.001)continue;candidates.push(p);}}
 return candidates;
}
function trafficReserveTargetSlot(locomotion,context){
 const a=locomotion.a,population=a.w.population,goal=a.route?.at(-1),taskKey=trafficTaskKey(a);
 if(!population||a.skill?.type!=='walk'||!goal){if(locomotion.traffic.slotKey)trafficReleaseTargetSlot(locomotion);return null;}
 const key=trafficGoalKey(a,goal);
 if(locomotion.traffic.slotKey===key&&locomotion.traffic.slotTaskKey===taskKey)return locomotion.traffic.slotPoint;
 trafficReleaseTargetSlot(locomotion);const runtime=trafficRuntime(population);trafficPruneSlotClaims(population,runtime);
 const claims=runtime.slots.get(key)||new Map(),minimumGap=Math.max(.58,context.radius*2+TRAFFIC_AVOIDANCE.slotGapM),root=locomotion.engine?.state?.root||a.pos;
 for(const [index,point]of trafficSlotCandidates(a,goal,context).entries()){
  if([...claims.values()].some(claim=>horizontal(claim.point,point)<minimumGap))continue;
  if((index>0||claims.size)&&population.collisionFor?.(a,point,context.radius))continue;
  let route;try{route=a.w.path(root,point,context.radius,context.ignore);}catch{continue;}
  if(!Array.isArray(route)||!route.length)continue;
  claims.set(a.npcId,{point:[...point],index,taskKey});runtime.slots.set(key,claims);
  a.route.splice(a.routeIndex,a.route.length-a.routeIndex,...route.map(p=>[...p]));locomotion.requestKey=null;
  Object.assign(locomotion.traffic,{slotKey:key,slotTaskKey:taskKey,slotPoint:[...point],slotIndex:index,advancePoint:null,advanceRouteIndex:-1});locomotion.traffic.slotReservations++;
  if(index>0)a.log?.('同一目标已有其他人物，已分配独立接近站位');
  return [...point];
 }
 throw Error('目标附近没有可用的独立站位，无法安全分配多人到达位置');
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
class ContinuousMotionPhase {
 constructor(engine){this.engine=engine;this.originalAdvance=engine.motion.advance.bind(engine.motion);this.reset(engine.state.motion.phase||0);engine.motion.advance=(state,dt)=>this.advance(state,dt);}
 snapshot(){const {engine,originalAdvance,...state}=this;return structuredClone(state);}
 restore(state){Object.assign(this,structuredClone(state));}
 reset(phase=0){this.phase=Number.isFinite(phase)?phase:0;this.velocity=0;this.target=null;this.error=0;this.initialized=false;this.lastSide=null;this.phaseOffset=0;this.wasActive=false;this.needsCalibration=true;this.contactCorrections=0;this.maximumStep=0;
  this.sourceFrame=null;this.timeScale=1;this.turnTargetYaw=null;this.drive=0;this.driveVelocity=0;this.headLead=0;this.headLeadVelocity=0;this.chestLead=0;this.chestLeadVelocity=0;}
 response(key,target,dt,frequency){
  // Exact critically damped response: retain velocity through starts/stops
  // without a free-running oscillator or a reset at every foot exchange.
  const velocity=key+'Velocity',offset=this[key]-target,c=this[velocity]+frequency*offset,e=Math.exp(-frequency*dt);
  this[key]=target+(offset+c*dt)*e;this[velocity]=(this[velocity]-frequency*c*dt)*e;
 }
 coordinateBody(state,dt){
  const command=state.command,delta=command?.type==='walk'?sub(command.target,state.root):null;
  const heading=delta?Math.atan2(delta[0],delta[2]):command?.type==='turn'?this.turnTargetYaw:null;
  const error=Number.isFinite(heading)?angleDiff(heading,state.yaw):0;
  // Engineering adaptation of a captured walk, not a measured dynamics model.
  // Translation drives the walk amplitude; placement steps during a turn
  // must not trigger a full-speed arm cycle. Use actual world speed at slow tempo.
  const physicalSpeed=state.speed*this.timeScale;
  this.response('drive',clamp(physicalSpeed/.75,0,.85),dt/Math.max(.05,this.timeScale),8);
  this.response('headLead',clamp(error*.55,-.55,.55),dt/Math.max(.05,this.timeScale),14);
  this.response('chestLead',clamp(error*.20,-.18,.18),dt/Math.max(.05,this.timeScale),7);
  const out=MotionLab.blend(this.engine.motion.neutral,this.sourceFrame,this.drive);
  out.thoraxQ=qm(qy(this.chestLead),out.thoraxQ);
  out.cervicalQ=qm(qy((this.headLead-this.chestLead)*.7),out.cervicalQ);
  out.headQ=qm(qy((this.headLead-this.chestLead)*.3),out.headQ);
  // Captured limb directions are world-relative: explicitly carry the arms
  // with the chest, since rotating the spine alone only moves their origins.
  for(const side of ['left','right'])for(const part of ['UpperArm','Forearm'])out[side+part]=rotate(qy(this.chestLead),out[side+part]);
  state.motion.frame=out;
 }
 advance(state,dt){
  const swing=state.swing,active=state.speed>.02||!!swing;let desiredVelocity=0;
  if(active&&!this.wasActive)this.needsCalibration=true;
  if(swing){
   const progress=clamp(swing.elapsed/Math.max(1e-8,swing.duration),0,1),raw=this.engine.motion.peaks[swing.side]+(progress-.5)*.42;
   desiredVelocity=.42/Math.max(.12,swing.duration);
   // Match the same source foot in the nearest cycle. A fractional offset
   // on every exchange erased the left/right phase relationship entirely.
   // Acquisition stays continuous; only the target changes, never the phase.
   if(this.needsCalibration||!this.initialized||swing.side!==this.lastSide){this.phaseOffset=Math.round(this.phase-raw);this.lastSide=swing.side;this.contactCorrections++;this.initialized=true;this.needsCalibration=false;}
   this.target=raw+this.phaseOffset;this.error=clamp(this.target-this.phase,-.20,.20);
  }else{
   this.target=null;this.error=0;desiredVelocity=active?clamp(this.velocity||.8,.45,1.35):0;
  }
  // Correct phase by changing its rate, not by subtracting this frame's
  // displacement. A negative contact error used to cancel the entire advance
  // and freeze the shoulders while the legs kept moving.
  if(this.target!=null)desiredVelocity+=clamp(this.error*6,-desiredVelocity*.65,desiredVelocity*.65);
  const maximumAcceleration=active?(desiredVelocity<this.velocity?12:5.5):4.0;
  this.velocity+=clamp(desiredVelocity-this.velocity,-maximumAcceleration*dt,maximumAcceleration*dt);
  const previous=this.phase;this.phase+=Math.max(0,this.velocity)*dt;
  this.maximumStep=Math.max(this.maximumStep,this.phase-previous);
  // FullBodyMotion remains the source sampler. Hide the discrete swing event
  // only while it samples, then restore the scheduler-owned contact state.
  const actualSwing=state.swing,actualSpeed=state.speed;state.motion.phase=this.phase;state.swing=null;
  const headingError=state.command?.type==='turn'&&Number.isFinite(this.turnTargetYaw)?angleDiff(this.turnTargetYaw,state.yaw):0;
  if((actualSwing||Math.abs(headingError)>.015)&&state.speed<=.02)state.speed=.020001;
  state.motion.frame=this.sourceFrame;
  this.originalAdvance(state,dt);
  this.sourceFrame=state.motion.frame;
  state.swing=actualSwing;state.speed=actualSpeed;state.motion.phase=this.phase;this.wasActive=active;
  this.coordinateBody(state,dt);
 }
 report(){return{phaseUnwrapped:this.phase,phase:this.phase-Math.floor(this.phase),phaseVelocityCyclesPerS:this.velocity,worldPhaseVelocityCyclesPerS:this.velocity*this.timeScale,contactTarget:this.target,phaseError:this.error,phaseOffset:this.phaseOffset,contactCorrections:this.contactCorrections,maximumStep:this.maximumStep,bodyResponse:{drive:this.drive,headLeadRad:this.headLead,chestLeadRad:this.chestLead},method:'contact-rate-phase/v4'};}
}
class TurnCommandFilter {
 constructor(){this.reset(0);}
 reset(yaw){this.commandYaw=angleDiff(yaw,0);this.velocity=0;this.acceleration=0;this.supportMarginRad=.26;this.initialized=true;this.targetYaw=this.commandYaw;this.placementRetargets=0;}
 supportMargin(state,direction){
  let margin=.26;for(const foot of Object.values(state.feet))if(foot.contact){const twist=angleDiff(state.yaw,foot.yaw),remaining=direction>=0?.26-twist:.26+twist;margin=Math.min(margin,remaining);}
  return Math.max(0,margin);
 }
 update(targetYaw,state,dt,pace=1){
  if(!this.initialized)this.reset(state.yaw);this.targetYaw=angleDiff(targetYaw,0);
  const error=angleDiff(this.targetYaw,state.yaw),direction=Math.sign(error||this.velocity||1),remaining=Math.abs(error);
  const maxSpeed=1.0*pace,maxAcceleration=3.8*pace,maxDeceleration=5.2*pace;
  this.supportMarginRad=this.supportMargin(state,direction);
  const stoppingSpeed=Math.sqrt(Math.max(0,2*maxDeceleration*Math.max(0,remaining-.003)));
  const supportSpeed=Math.sqrt(Math.max(0,2*maxDeceleration*Math.max(0,this.supportMarginRad-.018)));
  const desired=direction*Math.min(maxSpeed,stoppingSpeed,supportSpeed);
  const previousVelocity=this.velocity,slowing=Math.sign(desired)!==Math.sign(this.velocity)||Math.abs(desired)<Math.abs(this.velocity);
  const limit=(slowing?maxDeceleration:maxAcceleration)*dt;
  this.velocity+=clamp(desired-this.velocity,-limit,limit);
  let step=this.velocity*dt;
  if(Math.sign(step)!==direction)step=0;
  if(Math.abs(step)>remaining)step=error;
  // The inner R2.2 controller may clear this short command every fixed step.
  // Reissuing one acceleration-limited angular increment avoids reaching the
  // final target while the outer controller still carries angular velocity.
  this.commandYaw=angleDiff(state.yaw+step,0);
  this.acceleration=(this.velocity-previousVelocity)/Math.max(1e-8,dt);
  return this.commandYaw;
 }
 retargetSwing(engine){
  const state=engine.state,swing=state.swing;if(!swing||swing.turnPlacementTarget!=null)return;
  const error=angleDiff(this.targetYaw,state.yaw);if(Math.abs(error)<.03)return;
  const placementYaw=angleDiff(state.yaw+Math.sign(error)*Math.min(Math.abs(error),.24),0);
  const target=engine.stance({...state,yaw:placementYaw},swing.side);
  const path=engine.world.sweep(state.feet[swing.side].position,target,.045);if(path.blocked||!engine.world.free(target,.045))return;
  swing.target=target;swing.yaw=placementYaw;swing.turnPlacementTarget=placementYaw;this.placementRetargets++;
 }
 stopped(targetYaw,state){return Math.abs(angleDiff(targetYaw,state.yaw))<.015&&Math.abs(this.velocity)<.025;}
 report(){return{targetYaw:this.targetYaw,commandYaw:this.commandYaw,velocityRadS:this.velocity,accelerationRadS2:this.acceleration,supportMarginRad:this.supportMarginRad,placementRetargets:this.placementRetargets,method:'support-aware-angular-increment/v2'};}
}
class NaturalLocomotion {
 constructor(agent,{flatSupport=false}={}){
  this.flatSupport=flatSupport;this.a=agent;const source=agent.h.resolvedRig;this.rig=MotionLab.rigFromSource(source);
  // Source left/right ankle heights differ slightly. Use the higher ankle
  // plane so both individually resolved skin soles clear the flat floor.
  this.skinFloorOffsetM=Math.max(...['left','right'].map(s=>source.nodes[s+'_foot'].positionM[1]-source.sourceFloorM))-this.rig.ankleHeight;
  this.rig.ankleHeight+=this.skinFloorOffsetM;this.rig.hipHeight=agent.h.bodyMetrics.walkingHipHeightM;
  this.standingHipHeightM=agent.h.bodyMetrics.standingHipHeightM;
  this.engine=new MotionLab.MotionController(this.rig);
  // Keep the navigation anchor contract. Forward placement anticipates both
  // the swing travel and a short leading stance, rather than landing under
  // the already advancing pelvis. The kernel still sweeps every target.
  const stance=this.engine.stance.bind(this.engine);
  this.engine.stance=(state,side,lead=0)=>stance(state,side,lead>0&&!this.usesFlatSupport(state)?lead*(.60/.38):lead);
  this.solePivots=Object.fromEntries(['left','right'].map(side=>{
   const ankle=source.nodes[side+'_foot'].positionM,scale=agent.h.bodyMetrics.statureScale;
   const toe=Math.max(...Object.entries(source.nodes).filter(([id])=>id.startsWith(side+'_toe_')).map(([,n])=>n.positionM[2]-ankle[2]));
   return[side,{heel:[0,-this.rig.ankleHeight+.0005,-.045*scale],forefoot:[0,-this.rig.ankleHeight+.0005,toe+.006*scale]}];
  }));
  const stepFeet=this.engine.stepFeet.bind(this.engine);
  this.engine.stepFeet=(state,dt)=>{
   const lowPush=agent.skill?.type==='push'&&agent.phase==='pushTravel';
   const freeWalk=(lowPush||!this.usesFlatSupport(state))&&state.speed>.03&&!Object.values(state.feet).some(foot=>foot.adoptedOrientation);
   if(freeWalk&&!state.swing)this.beginWalkingStep(state);
   // The kernel's absolute stance-distance score also selects a newly landed
   // leading foot. Free gait releases a trailing foot; the kernel still owns
   // interpolation, contact commit and all other support modes.
   if(state.swing||!freeWalk)stepFeet(state,dt);
   this.adaptSwingClearance(state);if(this.usesFlatSupport(state))this.adaptSwingAnkle(state);this.adaptFootRocker(state,dt);
  };
  this.world=new MotionLabWorld(agent);this.engine.world=this.world;
  this.phaseController=new ContinuousMotionPhase(this.engine);this.turnFilter=new TurnCommandFilter();
  this.pose=new MotionLabPose(agent.h,this.engine);agent.h.motionDriver=this.pose;
  this.runtimeState=typeof MotionRuntimeState==='function'?new MotionRuntimeState(agent):null;agent.h.motionRuntimeState=this.runtimeState;
  this.resetFromPose();
 }
 beginWalkingStep(state){
  // Change stride length AND cadence at reduced world speed. Scaling the
  // entire kernel clock alone produced normal-length steps in slow motion.
  // Keep each swing's duration/target fixed once released.
  const strideScale=Math.sqrt(clamp(this.tempo,.05,1)),firstStep=state.metrics.steps===state.walkingStartStep,duration=.36*strideScale;
  const releaseDistance=(firstStep?(this.gaitTransition?.firstReleaseM??.075):.095)*strideScale;
  const candidates=['left','right'].map(side=>{
   const foot=state.feet[side],relative=rotate(inv(qy(state.yaw)),sub(foot.position,this.engine.stance(state,side)));
   return{side,behind:-relative[2],turn:Math.abs(angleDiff(state.yaw,foot.yaw))};
  }).filter(c=>c.behind>releaseDistance||c.turn>.10);
  candidates.sort((a,b)=>(a.side===state.nextFoot?-1:1)-(b.side===state.nextFoot?-1:1)||b.behind-a.behind);
  if(!candidates.length)return;
  const side=candidates[0].side,foot=state.feet[side],command=state.command;
  const heading=command?.type==='walk'?Math.atan2(command.target[0]-state.root[0],command.target[2]-state.root[2]):state.yaw;
  const remaining=command?.type==='walk'?horizontal(state.root,command.target):Infinity;
  const terminalScale=this.gaitTransition&&Number.isFinite(remaining)?clamp(remaining/(this.gaitTransition.terminalDistanceM||.34),this.gaitTransition.minimumTerminalScale||.28,1):1;
  const lead=state.speed*.38*strideScale*terminalScale;
  // Land into the curve, with a bounded preview of the requested heading.
  // Only the free foot changes orientation; planted feet keep their anchors.
  let placementYaw=state.yaw+clamp(angleDiff(heading,state.yaw),-.24,.24);
  let target=this.engine.stance({...state,yaw:placementYaw},side,lead);
  let path=this.engine.world.sweep(foot.position,target,.045);
  if((path.blocked||!this.engine.world.free(target,.045))&&placementYaw!==state.yaw){
   placementYaw=state.yaw;target=this.engine.stance(state,side,lead);
   path=this.engine.world.sweep(foot.position,target,.045);
  }
  if(path.blocked||!this.engine.world.free(target,.045))throw Error('落脚路径受阻，需重新规划');
  state.swing={side,from:[...foot.position],target,fromYaw:foot.yaw,yaw:placementYaw,elapsed:0,duration,walkingStrideScale:strideScale,terminalScale};
  foot.contact=false;
 }
 adaptSwingClearance(state){
  const swing=state.swing;if(!swing||state.feet[swing.side].adoptedOrientation)return;
  // The pinned flat-ground scheduler uses 65 mm even for a tiny placement
  // step. Keep its endpoints/contact timing, but give short turns and final
  // gathering steps a lower, distance-dependent clearance. An adopted tilted
  // sole keeps the original clearance until its first swing has released it.
  const distance=horizontal(swing.from,swing.target),height=clamp(.018+distance*.10,.018,.055);
  const u=clamp(swing.elapsed/swing.duration,0,1),arc=16*u*u*(1-u)*(1-u);
  state.feet[swing.side].position[1]+=(height-.065)*arc;swing.clearanceHeightM=height;
 }
 usesFlatSupport(state=this.engine?.state){return state?.flatFootSupport??(this.flatSupport||!!this.a.held);}
 adaptSwingAnkle(state){
  // Only the airborne foot changes pitch. A planted sole still owns its full
  // world anchor; heel/toe rockers require separate support pivots.
  for(const side of ['left','right']){
   const foot=state.feet[side],swing=state.swing;
   foot.swingPitch=0;
   if(foot.contact||foot.adoptedOrientation||swing?.side!==side)continue;
   const u=clamp(swing.elapsed/swing.duration,0,1),distance=horizontal(swing.from,swing.target);
   const drive=clamp(state.speed*this.tempo/.35,0,1)*clamp(distance/.18,0,1);
   // Smooth lobes have zero angle and angular velocity at release,
   // toe-clearance crossover and landing. Not a stance push-off model.
   const pitch=drive*(u<.4?.18*Math.sin(Math.PI*u/.4)**2:-.12*Math.sin(Math.PI*(u-.4)/.6)**2);
   const clearance=Math.max(0,foot.position[1]-this.rig.ankleHeight);
   // Conservative authored foot envelope: bound pitch by the available
   // clearance as its ankle approaches either endpoint of the swing.
   const extent=.30*this.a.h.bodyMetrics.statureScale;
   foot.swingPitch=clamp(pitch,-Math.atan2(clearance*.8,extent),Math.atan2(clearance*.8,extent));
  }
 }
 adaptFootRocker(state,dt){
  const speed=state.speed*this.tempo,drive=clamp(speed/.35,0,1);
  for(const side of ['left','right']){
   const foot=state.feet[side],swing=state.swing;
   if(foot.adoptedOrientation||this.usesFlatSupport()){delete foot.rocker;continue;}
   let pitch=foot.rocker?.pitch||0;
   if(swing?.side===side){
    if(swing.rockerFrom===undefined){swing.rockerFrom=pitch;swing.rockerLanding=-.10*drive;}
    const u=clamp(swing.elapsed/swing.duration,0,1);
    pitch=u<.5?swing.rockerFrom*(1-smooth(u/.5)):swing.rockerLanding*smooth((u-.5)/.5);
   }else{
    const relative=rotate(inv(qy(foot.yaw)),sub(foot.position,state.root));
    // Leading heel yields to the sole as the pelvis approaches; the trailing
    // forefoot carries a small heel lift before the next explicit release.
    let target=drive*(relative[2]>.025?-.10*smooth(clamp((relative[2]-.025)/.08,0,1)):
     .18*smooth(clamp((-relative[2]-.025)/.06,0,1)));
    // Start on a flat support, then allow its heel to release in the latter
    // half of the first swing. Locking it until landing forces a deep bend
    // in the new support leg because the trailing ankle cannot rise.
    if(state.metrics.steps===(state.rockerStepOrigin||0)&&side!==state.nextFoot&&(!swing||swing.elapsed/swing.duration<.45))target=0;
    pitch+=clamp(target-pitch,-1.2*dt,1.2*dt);
   }
   if(Math.abs(pitch)<1e-8)pitch=0;
   const kind=pitch<0?'heel':pitch>0?'forefoot':'sole';
   const pivot=pitch===0?[0,0,0]:this.solePivots[side][kind],yaw=qy(foot.yaw);
   const world=add(foot.position,rotate(yaw,pivot));
   const ankle=sub(world,rotate(qm(yaw,qx(pitch)),pivot));
   foot.swingPitch=foot.contact?0:pitch;
   foot.rocker={pitch,kind,pivot:[...pivot],world,ankle};
  }
 }
 // Agent's pose transaction must include the filters outside the pinned
 // kernel. Keep the live engine/callback identities and clone only state.
 snapshotExecution(){return structuredClone({requestKey:this.requestKey,requested:this.requested,tempo:this.tempo,traffic:this.traffic,
  phase:this.phaseController.snapshot(),turn:this.turnFilter,lastTurnContinuity:this.lastTurnContinuity,
  lastPoseAdoption:this.lastPoseAdoption,lastContinuousWalkHandoff:this.lastContinuousWalkHandoff,routePassThroughCount:this.routePassThroughCount,runtime:this.runtimeState?.snapshot?.()||null});}
 restoreExecution(saved){
  const {phase,turn,runtime,...state}=structuredClone(saved);Object.assign(this,state);
  this.phaseController.restore(phase);Object.assign(this.turnFilter,turn);
  if(this.runtimeState){if(runtime)this.runtimeState.restore(runtime);else this.runtimeState.reset();}
 }
 resetFromPose({preservePoseContacts=false}={}){
  if(this.traffic?.slotKey)trafficReleaseTargetSlot(this);if(this.traffic?.corridorKey)trafficReleaseCorridor(this);
  const a=this.a,e=this.engine,h=a.h,yaw=a.yaw;
  const currentHip=side=>h.byId?.get(side+'_femur')?.world?.p||h.legs?.[side]?.upper?.world?.p;
  const currentFoot=side=>h.byId?.get(side+'_foot')?.world?.p||h.legs?.[side]?.wrist?.world?.p;
  const leftHip=preservePoseContacts&&currentHip('left'),rightHip=preservePoseContacts&&currentHip('right');
  const root=leftHip&&rightHip?mix(leftHip,rightHip,.5):[a.pos[0],this.standingHipHeightM,a.pos[2]];
  const world=e.world;e.world=new MotionLab.FlatWorld();e.reset();e.world=world;
  e.state.root=[...root];e.state.yaw=yaw;e.state.time=a.time;
  e.state.flatFootSupport=this.flatSupport||!!a.held;
  let maximumAdoptedFootResidualM=0;
  for(const side of ['left','right']){
   const foot=preservePoseContacts&&currentFoot(side),orientation=foot&&(h.byId?.get(side+'_foot')?.world?.q||h.legs?.[side]?.wrist?.world?.q);
   const forward=orientation&&rotate(qm(orientation,inv(h.sourceBind.get(side+'_foot').q)),[0,0,1]);
   const footYaw=forward&&Math.hypot(forward[0],forward[2])>1e-8?Math.atan2(forward[0],forward[2]):yaw;
   e.state.feet[side]={position:foot?[...foot]:e.stance(e.state,side),yaw:footYaw,contact:true};
   if(orientation)e.state.feet[side].adoptedOrientation=[...orientation];
  }
  // The captured pelvis can tilt, so a fully extended planted leg may be
  // reachable from its actual hip but not from the kernel's level hip bar.
  // Fit only the detached handoff target; Basic blends from the unchanged
  // committed skeleton, keeping both existing foot positions/orientations.
  let adoptedRootLoweringM=0;
  if(leftHip&&rightHip){
   let ceiling=e.state.root[1];
   for(const side of ['left','right']){
    const hip=add(e.state.root,rotate(qy(yaw),[side==='left'?-this.rig.hipHalf:this.rig.hipHalf,0,0])),foot=e.state.feet[side].position;
    const {upper,lower}=this.rig.legs[side],reach=upper+lower-.0005*h.bodyMetrics.statureScale,horizontal2=(hip[0]-foot[0])**2+(hip[2]-foot[2])**2;
    if(horizontal2>reach*reach)throw Error('当前姿势的脚位超出行走接管的水平可达范围');
    ceiling=Math.min(ceiling,foot[1]+Math.sqrt(reach*reach-horizontal2));
   }
   adoptedRootLoweringM=e.state.root[1]-ceiling;
   if(adoptedRootLoweringM>.04*h.bodyMetrics.statureScale)throw Error('当前姿势需要过大的行走接管高度调整');
   e.state.root[1]=ceiling;
  }
  e.state.pose=e.solve(e.state);
  for(const side of ['left','right']){
   const leg=e.state.pose.legs[side],foot=e.state.feet[side],residual=dist(leg.end,foot.position);
   maximumAdoptedFootResidualM=Math.max(maximumAdoptedFootResidualM,residual);
   if(residual>.012||leg.lengthError>1e-7)throw Error('当前姿势的脚位无法安全交给行走控制器');
  }
  this.lastPoseAdoption={preserved:!!(leftHip&&rightHip),maximumAdoptedFootResidualM,adoptedRootLoweringM,
   root:[...e.state.root],feet:Object.fromEntries(['left','right'].map(side=>[side,[...e.state.feet[side].position]]))};
  this.phaseController.reset(e.state.motion.phase||0);this.turnFilter.reset(yaw);
  this.requestKey=null;this.requested=false;this.tempo=1;this.routePassThroughCount=this.routePassThroughCount||0;
  this.traffic={active:false,mode:'clear',reason:null,blockers:[],side:0,detours:0,retreats:0,replans:0,recoveries:0,escapes:0,slotReservations:0,lastPlanAtS:-Infinity,nextPlanAtS:0,detourEndIndex:-1,originalTarget:null,lastError:null,slotKey:null,slotTaskKey:null,slotPoint:null,slotIndex:null,advancePoint:null,advanceRouteIndex:-1,corridorKey:null,corridorTaskKey:null,corridorOwner:null,corridorDirection:0,corridorDescriptor:null,corridorOrbit:null,corridorOrbitIndex:0,corridorOrbitCycleStart:0,corridorOrbitLaps:0,corridorClaims:0,corridorYields:0};this.sync();
  this.runtimeState?.reset();this.runtimeState?.observe(this,0);
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
  // Support mode changes at a settled action boundary, never by flattening
  // a rolling sole midway through a step when the held-object state changes.
  if(this.isSettled()){this.engine.state.flatFootSupport=this.flatSupport||!!this.a.held;this.engine.state.rockerStepOrigin=this.engine.state.metrics.steps;}
  this.requested=true;const key=JSON.stringify(command);
  if(this.requestKey===key&&this.engine.state.command){this.runtimeState?.setIntent(command,this.engine.state,this.tempo);return;}
  const answer=this.engine.command(command);if(!answer.accepted)throw Error(answer.reason);this.requestKey=key;this.runtimeState?.setIntent(command,this.engine.state,this.tempo);
 }
 clearTrafficIfPassed(){
  const t=this.traffic;if(t.active&&this.a.routeIndex>t.detourEndIndex){Object.assign(t,{active:false,mode:'clear',reason:null,blockers:[],side:0,detourEndIndex:-1,originalTarget:null});}
 }
 replanStaticRoute(context,reason='static-route-changed'){
  const a=this.a,root=this.engine.state.root,goal=a.route.at(-1);if(!goal)return false;
  try{
   const route=a.w.path(root,goal,context.radius,context.ignore);if(!Array.isArray(route)||!route.length)return false;
   a.route.splice(a.routeIndex,a.route.length-a.routeIndex,...route.map(point=>[...point]));
   this.requestKey=null;Object.assign(this.traffic,{active:false,mode:'replanned',reason,blockers:[],side:0,detourEndIndex:-1,originalTarget:[...goal],lastPlanAtS:a.time,nextPlanAtS:a.time+TRAFFIC_AVOIDANCE.planCooldownS,lastError:null,advancePoint:null,advanceRouteIndex:-1});this.traffic.replans++;
   a.log?.('路线已根据当前物体位置重新规划');return true;
  }catch(error){this.traffic.lastError=error.message;return false;}
 }
 installLocalDetour(conflict,context){
  const a=this.a,root=this.engine.state.root,current=a.route[a.routeIndex],other=conflict.actor,canonicalGoal=this.traffic.slotPoint||a.route.at(-1);if(!current||!other||!canonicalGoal)return false;
  let direction=sub(conflict.selfPoint||current,root);direction[1]=0;if(len(direction)<.12){direction=sub(current,root);direction[1]=0;}if(len(direction)<.12)return false;direction=norm(direction);
  const right=[direction[2],0,-direction[0]],preferred=trafficPairSide(a.npcId,other.id),otherRadius=bodyPhysicalProfile(other.human).bodyRadiusM,clearance=context.radius+otherRadius+TRAFFIC_AVOIDANCE.sideMarginM;
  const centre=mix(other.agent.pos,conflict.otherPoint,.65),along=Math.max(.24,dot(sub(centre,root),direction)),entryAlong=Math.max(.20,along-clearance*.85),baseExit=Math.max(entryAlong+.34,along+clearance*.95);
  for(const side of [preferred,-preferred])for(const scale of [1.05,1.30,1.60,2.0]){
   const offset=clearance*scale,entry=add(add(root,mul(direction,entryAlong)),mul(right,side*offset)),exit=add(add(root,mul(direction,baseExit)),mul(right,side*offset));entry[1]=0;exit[1]=0;
   let resumeIndex=a.routeIndex;while(resumeIndex<a.route.length-1&&horizontal(root,a.route[resumeIndex])<baseExit+.18)resumeIndex++;
   let resume=[...a.route[resumeIndex]],terminalShift=false;
   if(horizontal(root,resume)<baseExit+.10){
    if(a.skill?.type!=='walk')continue;
    resume=add(canonicalGoal,mul(right,side*clearance*1.15));resume[1]=0;terminalShift=true;
   }
   if(!trafficSegmentClear(a,root,entry,context)||!trafficSegmentClear(a,entry,exit,context)||!trafficSegmentClear(a,exit,resume,context))continue;
   if(terminalShift&&!trafficSegmentClear(a,resume,canonicalGoal,context,{dynamic:false}))continue;
   const deleteCount=terminalShift?resumeIndex-a.routeIndex+1:resumeIndex-a.routeIndex,insert=terminalShift?[entry,exit,resume,[...canonicalGoal]]:[entry,exit];
   a.route.splice(a.routeIndex,deleteCount,...insert);
   this.requestKey=null;Object.assign(this.traffic,{active:true,mode:'detour',reason:'predicted-npc-conflict',blockers:[other.id],side,detourEndIndex:a.routeIndex+(terminalShift?2:1),originalTarget:[...canonicalGoal],lastPlanAtS:a.time,nextPlanAtS:a.time+TRAFFIC_AVOIDANCE.planCooldownS,lastError:null,advancePoint:null,advanceRouteIndex:-1});this.traffic.detours++;
   a.log?.('已预测到 '+other.label+' 的路线冲突，采用确定性'+(side>0?'右':'左')+'侧绕行');return true;
  }
  return false;
 }
 installDeterministicRetreat(conflict,context){
  const a=this.a,other=conflict.actor;if(!other)return false;
  const root=this.engine.state.root,target=a.route[a.routeIndex];let direction=sub(target,root);direction[1]=0;if(len(direction)<.12)return false;direction=norm(direction);
  const right=[direction[2],0,-direction[0]],side=trafficPairSide(a.npcId,other.id),clearance=context.radius+bodyPhysicalProfile(other.human).bodyRadiusM+TRAFFIC_AVOIDANCE.sideMarginM;
  for(const back of [.34,.52,.76,1.0])for(const lateral of [.55,.9,1.25,1.6]){
   const point=add(add(root,mul(direction,-back)),mul(right,side*clearance*lateral));point[1]=0;
   if(!trafficSegmentClear(a,root,point,context,{dynamic:false})||!this.world.free(point,.23))continue;
   a.route.splice(a.routeIndex,0,point);this.requestKey=null;Object.assign(this.traffic,{active:true,mode:'retreat',reason:'multi-way-mobile-yield',blockers:[other.id],side,detourEndIndex:a.routeIndex,originalTarget:[...target],lastPlanAtS:a.time,nextPlanAtS:a.time+TRAFFIC_AVOIDANCE.planCooldownS,lastError:null,advancePoint:null,advanceRouteIndex:-1});this.traffic.retreats++;
   a.log?.('交叉路线暂无直接净空，已主动移动到侧后方重新进入路线');return true;
  }
  return false;
 }
 installRadialEscape(conflict,context){
  const a=this.a,population=a.w.population,root=this.engine.state.root,goal=this.traffic.slotPoint||a.route.at(-1);if(!population||!goal)return false;
  const neighbours=[...population.values()].filter(other=>other.agent!==a&&other.id!==a.npcId&&!other.disposed).map(other=>{
   const radius=bodyPhysicalProfile(other.human).bodyRadiusM,threshold=context.radius+radius+.06,distance=horizontal(root,other.agent.pos);
   return{actor:other,radius,threshold,distance,clearance:distance-threshold};
  }).filter(row=>row.distance<3.0);
  if(!neighbours.length)return false;
  let repel=[0,0,0];for(const row of neighbours){let away=sub(root,row.actor.agent.pos);away[1]=0;if(len(away)<1e-6)away=[trafficPairSide(a.npcId,row.actor.id),0,1];const weight=1/Math.max(.12,row.distance-row.threshold+.32)**2;repel=add(repel,mul(norm(away),weight));}
  if(len(repel)<1e-6&&conflict?.actor){repel=sub(root,conflict.actor.agent.pos);repel[1]=0;}if(len(repel)<1e-6)repel=[1,0,0];
  const goalDirection=norm([goal[0]-root[0],0,goal[2]-root[2]]),repelAngle=Math.atan2(repel[0],repel[2]),goalAngle=Math.atan2(goalDirection[0],goalDirection[2]),seed=(trafficHash(String(a.npcId||''))%24)/24*Math.PI*2;
  const angles=[repelAngle,repelAngle+.35,repelAngle-.35,repelAngle+.7,repelAngle-.7,repelAngle+1.1,repelAngle-1.1,goalAngle+.75,goalAngle-.75,...Array.from({length:24},(_,i)=>seed+i*Math.PI*2/24)];
  const currentMinimum=Math.min(...neighbours.map(row=>row.clearance)),seen=new Set();let best=null;
  for(const radius of [.30,.42,.56,.72,.92,1.16])for(const angle of angles){
   const key=Math.round(angle*1000);if(seen.has(radius+':'+key))continue;seen.add(radius+':'+key);
   const direction=[Math.sin(angle),0,Math.cos(angle)],point=add(root,mul(direction,radius));point[1]=0;
   if(!trafficSegmentClear(a,root,point,context)||!this.world.free(point,.23))continue;
   const minimum=Math.min(...neighbours.map(row=>horizontal(point,row.actor.agent.pos)-row.threshold));
   if(minimum<Math.max(.015,currentMinimum+.035))continue;
   let continuation;try{continuation=a.w.path(point,goal,context.radius,context.ignore);}catch{continue;}
   if(!Array.isArray(continuation)||!continuation.length)continue;
   const progress=horizontal(root,goal)-horizontal(point,goal),alignment=dot(direction,goalDirection),score=minimum*5+progress*.45+alignment*.12-radius*.03;
   if(!best||score>best.score)best={point,continuation,minimum,score};
  }
  if(!best)return false;
  a.route.splice(a.routeIndex,a.route.length-a.routeIndex,[...best.point],...best.continuation.map(point=>[...point]));this.requestKey=null;
  Object.assign(this.traffic,{active:true,mode:'escape',reason:'multi-agent-radial-separation',blockers:neighbours.filter(row=>row.clearance<.5).map(row=>row.actor.id),side:0,detourEndIndex:a.routeIndex,originalTarget:[...goal],lastPlanAtS:a.time,nextPlanAtS:a.time+TRAFFIC_AVOIDANCE.planCooldownS,lastError:null,advancePoint:null,advanceRouteIndex:-1});this.traffic.escapes++;
  a.log?.('交叉区域拥堵，已选择净空最大的移动脱困方向并重新接回原路线');return true;
 }
 installCorridorYield(conflict,context,descriptor,lease){
  const a=this.a,goal=this.traffic.slotPoint||a.route.at(-1),other=conflict.actor;if(!goal||!other)return false;
  const first=this.traffic.mode!=='corridor-circulation'||this.traffic.corridorKey!==descriptor.key||this.traffic.corridorOwner!==lease.ownerId;
  Object.assign(this.traffic,{corridorKey:descriptor.key,corridorTaskKey:trafficTaskKey(a),corridorOwner:lease.ownerId,corridorDirection:descriptor.sign,corridorDescriptor:descriptor,mode:'corridor-circulation',reason:'opposing-narrow-corridor',blockers:[other.id],originalTarget:[...goal]});
  if(first){this.traffic.corridorOrbit=null;this.traffic.corridorOrbitIndex=0;this.traffic.corridorOrbitLaps=0;this.traffic.corridorYields++;}
  if(!this.normalizeCorridorRoute(context,goal))return false;
  const target=this.corridorOrbitTarget(lease,context);if(!target)return false;
  if(first)a.log?.('狭窄通道已有相反方向通行者，已转入通道外循环路线并保留原任务终点');
  return true;
 }
 corridorAdvanceTarget(target,context){
  const a=this.a,root=this.engine.state.root;let direction=sub(target,root);direction[1]=0;const distance=len(direction);if(distance<.08)return null;direction=norm(direction);
  for(const lookahead of [Math.min(.72,distance-.04),Math.min(.54,distance-.04),Math.min(.38,distance-.04),Math.min(.24,distance-.04),Math.min(.14,distance-.04)]){
   if(lookahead<.08)continue;const point=add(root,mul(direction,lookahead));point[1]=0;
   if(trafficSegmentClear(a,root,point,context)&&this.world.free(point,.23))return point;
  }
  return null;
 }
 resolveNarrowCorridor(conflict,context){
  const a=this.a,population=a.w.population,root=this.engine.state.root,target=a.route[a.routeIndex],other=conflict?.actor;if(!population||!target||!other)return null;
  const descriptor=trafficCorridorDescriptor(a,root,target,context);if(!descriptor)return null;
  const otherTarget=other.agent.route?.[other.agent.routeIndex],otherDirection=otherTarget?norm([otherTarget[0]-other.agent.pos[0],0,otherTarget[2]-other.agent.pos[2]]):trafficActorVelocity(other);
  if(len(otherDirection)<.05||dot(descriptor.direction,otherDirection)>-.25)return null;
  const runtime=trafficRuntime(population),taskKey=trafficTaskKey(a),goal=this.traffic.slotPoint||a.route.at(-1);trafficPruneCorridors(population,runtime,a.time);
  let lease=runtime.corridors.get(descriptor.key);
  if(!lease){
   const ownerId=trafficCorridorPriority(a,other,descriptor),owner=ownerId===a.npcId?a:other.agent,ownerDirection=ownerId===a.npcId?descriptor.sign:-descriptor.sign;
   lease={ownerId,direction:ownerDirection,taskKey:trafficTaskKey(owner),expiresAtS:a.time+TRAFFIC_AVOIDANCE.corridorLeaseS,descriptor:{...descriptor,direction:[...descriptor.direction],midpoint:[...descriptor.midpoint]}};runtime.corridors.set(descriptor.key,lease);
  }
  const first=this.traffic.corridorKey!==descriptor.key||this.traffic.corridorOwner!==lease.ownerId;
  Object.assign(this.traffic,{corridorKey:descriptor.key,corridorTaskKey:taskKey,corridorOwner:lease.ownerId,corridorDirection:descriptor.sign,corridorDescriptor:lease.descriptor,originalTarget:goal?[...goal]:this.traffic.originalTarget});
  if(lease.ownerId===a.npcId){
   lease.expiresAtS=a.time+TRAFFIC_AVOIDANCE.corridorLeaseS;lease.taskKey=taskKey;if(first)this.traffic.corridorClaims++;
   this.traffic.corridorOrbit=null;this.traffic.mode='corridor-owner';this.traffic.reason='narrow-corridor-direction-owner';
   if(goal&&!this.normalizeCorridorRoute(context,goal))return'blocked';return'owner';
  }
  return this.installCorridorYield(conflict,context,descriptor,lease)?'yield':'blocked';
 }
 normalizeCorridorRoute(context,goal){
  const a=this.a,root=this.engine.state.root;if(!goal)return false;
  try{const route=a.w.path(root,goal,context.radius,context.ignore);if(!Array.isArray(route)||!route.length)return false;a.route.splice(a.routeIndex,a.route.length-a.routeIndex,...route.map(point=>[...point]));this.requestKey=null;this.traffic.advancePoint=null;this.traffic.advanceRouteIndex=-1;return true;}
  catch(error){this.traffic.lastError=error.message;return false;}
 }
 corridorPassed(lease,context){
  const d=lease?.descriptor;if(!d)return false;const coordinate=this.engine.state.root[d.axisIndex],margin=context.radius+.22;
  return lease.direction>0?coordinate>d.upper+margin:coordinate<d.lower-margin;
 }
 buildCorridorOrbit(lease,context){
  const a=this.a,d=lease?.descriptor,root=this.engine.state.root;if(!d)return false;
  const sign=this.traffic.corridorDirection||-lease.direction,axis=d.axisIndex,lateral=d.lateralIndex,margin=context.radius+.52,outside=sign>0?d.lower-margin:d.upper+margin,base=[...d.midpoint];base[axis]=outside;base[1]=0;
  const preferred=trafficPairSide(a.npcId,lease.ownerId),spacing=Math.max(.32,context.radius+.18),candidates=[];
  for(const longitudinal of [0,-sign*.20,-sign*.38])for(const side of [preferred,-preferred])for(const scale of [1,1.45,1.9]){const p=[...base];p[axis]+=longitudinal;p[lateral]+=side*spacing*scale;candidates.push(p);}
  for(const first of candidates){
   if(!this.world.free(first,.23))continue;let approach;try{approach=a.w.path(root,first,context.radius,context.ignore);}catch{continue;}if(!Array.isArray(approach)||!approach.length)continue;
   for(const side of [preferred,-preferred])for(const scale of [1.15,1.65,2.1]){
    const second=[...base],third=[...base];second[lateral]+=side*spacing*scale;third[lateral]-=side*spacing*scale;second[axis]-=sign*.18;third[axis]-=sign*.32;
    if(!this.world.free(second,.23)||!this.world.free(third,.23))continue;
    if(!trafficSegmentClear(a,first,second,context)||!trafficSegmentClear(a,second,third,context)||!trafficSegmentClear(a,third,first,context))continue;
    const points=[...approach.map(point=>[...point]),second,third,first];
    this.traffic.corridorOrbit=points;this.traffic.corridorOrbitIndex=0;this.traffic.corridorOrbitCycleStart=Math.max(0,points.length-3);this.traffic.corridorOrbitLaps=0;this.requestKey=null;return true;
   }
  }
  return false;
 }
 corridorOrbitTarget(lease,context){
  const a=this.a,t=this.traffic,root=this.engine.state.root;
  if(!t.corridorOrbit?.length&&!this.buildCorridorOrbit(lease,context))return null;
  for(let attempts=0;attempts<t.corridorOrbit.length+2;attempts++){
   let point=t.corridorOrbit[t.corridorOrbitIndex];
   if(horizontal(root,point)<=.045){t.corridorOrbitIndex++;if(t.corridorOrbitIndex>=t.corridorOrbit.length){t.corridorOrbitIndex=t.corridorOrbitCycleStart;t.corridorOrbitLaps++;}point=t.corridorOrbit[t.corridorOrbitIndex];}
   if(point&&this.world.free(point,.23)&&trafficSegmentClear(a,root,point,context))return [...point];
   t.corridorOrbitIndex++;if(t.corridorOrbitIndex>=t.corridorOrbit.length){t.corridorOrbitIndex=t.corridorOrbitCycleStart;t.corridorOrbitLaps++;}
  }
  t.corridorOrbit=null;return this.buildCorridorOrbit(lease,context)?[...t.corridorOrbit[0]]:null;
 }
 maintainCorridor(context,target){
  const a=this.a,population=a.w.population,t=this.traffic,key=t.corridorKey;if(!population||!key)return null;
  const runtime=trafficRuntime(population),goal=t.slotPoint||t.originalTarget||a.route.at(-1);trafficPruneCorridors(population,runtime,a.time);const lease=runtime.corridors.get(key);
  if(!lease){trafficReleaseCorridor(this);if(goal)this.normalizeCorridorRoute(context,goal);t.mode='corridor-rejoin';t.reason='corridor-released';a.log?.('狭窄通道方向权已释放，重新接回原任务路线');return null;}
  if(lease.ownerId===a.npcId){
   lease.expiresAtS=a.time+TRAFFIC_AVOIDANCE.corridorLeaseS;lease.taskKey=trafficTaskKey(a);t.corridorOwner=a.npcId;t.mode='corridor-owner';t.reason='narrow-corridor-direction-owner';
   if(this.corridorPassed(lease,context)){runtime.corridors.delete(key);trafficReleaseCorridor(this);if(goal)this.normalizeCorridorRoute(context,goal);a.log?.('已通过狭窄通道并释放方向权');return null;}
   return this.corridorAdvanceTarget(target,context)||this.rollingTrafficTarget(target,context);
  }
  t.corridorOwner=lease.ownerId;t.mode='corridor-circulation';t.reason='opposing-narrow-corridor';
  return this.corridorOrbitTarget(lease,context);
 }
 rollingTrafficTarget(target,context){
  const a=this.a,t=this.traffic,root=this.engine.state.root;
  if(t.advancePoint&&t.advanceRouteIndex===a.routeIndex&&horizontal(root,t.advancePoint)>.025&&this.world.free(t.advancePoint,.23))return [...t.advancePoint];
  t.advancePoint=null;t.advanceRouteIndex=-1;
  if(this.world.free(target,.23))return target;
  let direction=sub(target,root);direction[1]=0;const distance=len(direction);if(distance<.08)return null;direction=norm(direction);
  for(const lookahead of [Math.min(.72,distance-.04),Math.min(.52,distance-.04),Math.min(.34,distance-.04),Math.min(.20,distance-.04)]){
   if(lookahead<.12)continue;const point=add(root,mul(direction,lookahead));point[1]=0;
   if(!trafficSegmentClear(a,root,point,context)||!this.world.free(point,.23))continue;
   t.advancePoint=[...point];t.advanceRouteIndex=a.routeIndex;t.mode='advance';t.reason='occupied-distant-route-target';return point;
  }
  return null;
 }
 prepareTrafficTarget(speed=.48,{force=false}={}){
  const a=this.a;this.clearTrafficIfPassed();let target=a.route[a.routeIndex];if(!target)return null;
  const context=this.world.context(.23),root=this.engine.state.root,currentTaskKey=trafficTaskKey(a);
  if(this.traffic.slotTaskKey&&this.traffic.slotTaskKey!==currentTaskKey)trafficReleaseTargetSlot(this);
  if(this.traffic.corridorTaskKey&&this.traffic.corridorTaskKey!==currentTaskKey)trafficReleaseCorridor(this);
  if(a.skill?.type==='walk'&&!this.traffic.slotKey){trafficReserveTargetSlot(this,context);target=a.route[a.routeIndex];if(!target)return null;}
  if(motionWorldSweep(a.w,root,target,context.radius,context.ignore).fraction<1-1e-6){
   if(!this.replanStaticRoute(context))throw Error('当前物体阻断路线，且没有可用的重新规划路径');
   target=a.route[a.routeIndex];if(!target)return null;
  }
  if(!a.w.population)return target;
  const maintained=this.maintainCorridor(context,target);if(maintained)return maintained;
  const predicted=predictTrafficConflict(a,speed,context);
  if(predicted){
   const corridor=this.resolveNarrowCorridor(predicted,context);
   if(corridor==='owner'||corridor==='yield'){const managed=this.maintainCorridor(context,target);if(managed)return managed;throw Error('狭窄通道没有可用的持续移动路线');}
   if(corridor==='blocked')throw Error('狭窄通道没有可用的主动撤离路线');
  }
  const rolling=this.rollingTrafficTarget(target,context);if(rolling&&rolling!==target)return rolling;
  if(this.traffic.active&&a.routeIndex<=this.traffic.detourEndIndex&&!force&&this.world.free(target,.23))return target;
  if(!force&&a.time<this.traffic.nextPlanAtS&&this.world.free(target,.23))return target;
  this.traffic.nextPlanAtS=a.time+.10;
  const conflict=predicted||[...a.w.population.values()].filter(other=>other.agent!==a&&other.id!==a.npcId&&!other.disposed).map(other=>{const threshold=context.radius+bodyPhysicalProfile(other.human).bodyRadiusM+TRAFFIC_AVOIDANCE.sideMarginM,separation=horizontal(target,other.agent.pos);return{actor:other,timeS:0,selfPoint:target,otherPoint:[...other.agent.pos],separation,threshold,score:separation};}).filter(row=>row.separation<row.threshold).sort((x,y)=>x.score-y.score)[0]||null;
  if(!conflict){this.traffic.blockers=[];return target;}
  if(this.installLocalDetour(conflict,context)||this.installDeterministicRetreat(conflict,context)||this.installRadialEscape(conflict,context))return a.route[a.routeIndex];
  throw Error('预测到多人路线冲突，但局部偏移、移动让行和径向脱困均无可用净空：'+conflict.actor.id);
 }
 recoverNavigationBlock(message){
  if(!/(?:落脚路径受阻|路线受阻|目标无效或与障碍重叠|连续碰撞检测)/.test(String(message||'')))return false;
  const a=this.a,e=this.engine;if(!a.route?.length||a.routeIndex>=a.route.length)return false;
  const saved={fault:e.state.fault,paused:e.state.paused,status:e.state.status,command:e.state.command,speed:e.state.speed};
  Object.assign(e.state,{fault:null,paused:false,status:'idle',command:null,speed:0});this.requestKey=null;this.requested=false;
  try{
   const target=this.prepareTrafficTarget(.48,{force:true});if(!target)throw Error('恢复时没有剩余路线');
   this.request({type:'walk',target:[...target]});this.traffic.recoveries++;this.traffic.reason='recovered-navigation-block';return true;
  }catch(error){Object.assign(e.state,saved);this.traffic.lastError=error.message;return false;}
 }
 routePassThrough(index){
  const a=this.a,state=this.engine.state,current=a.route[index],next=a.route[index+1];
  if(!current||!next)return false;
  const previous=index>0?a.route[index-1]:state.root,into=sub(current,previous),out=sub(next,current);
  if(horizontal(previous,current)<1e-6||horizontal(current,next)<1e-6)return true;
  const headingIn=Math.atan2(into[0],into[2]),headingOut=Math.atan2(out[0],out[2]),turn=Math.abs(angleDiff(headingOut,headingIn));
  if(turn>Math.PI/4)return false;
  const pace=clamp(state.speed/.48,0,1),radius=.045+.115*pace*Math.max(.25,Math.cos(turn));
  if(horizontal(state.root,current)>radius)return false;
  return !this.world.sweep(state.root,next,.23).blocked;
 }
 atFinalRoutePoint(toleranceM=.02){const end=this.a.route.at(-1);return !!end&&horizontal(this.engine.state.root,end)<=toleranceM;}
 canContinuousTaskHandoff(){
  const a=this.a,current=a.skill,next=a.plan?.steps[a.index+1],end=a.route.at(-1);
  if(current?.type!=='walk'||next?.type!=='walk'||!end||!this.atFinalRoutePoint())return false;
  const from=a.route.length>1?a.route.at(-2):current.startPosition;if(!from||horizontal(from,end)<.02)return false;
  const target=a.w.get(next.targetId),nextEnd=walkDestination(a.w,actorForReasoning(a),next,target);
  if(!nextEnd||horizontal(end,nextEnd)<.05)return false;
  const incoming=Math.atan2(end[0]-from[0],end[2]-from[2]),outgoing=Math.atan2(nextEnd[0]-end[0],nextEnd[2]-end[2]);
  const turnRad=Math.abs(angleDiff(outgoing,incoming));if(turnRad>Math.PI/3)return false;
  this.lastContinuousWalkHandoff={exitSpeedMps:a.walkSpeed,turnRad,endpoint:[...end]};current.continuousWalkHandoff=structuredClone(this.lastContinuousWalkHandoff);return true;
 }
 move(dt,speed=.48){
  const a=this.a,state=this.engine.state,pace=a.manipulationPace();this.turnFilter.reset(state.yaw);
  // Release the first foot before the pelvis has travelled a full steady
  // trailing distance. Otherwise its first landing absorbs a deep crouch.
  if(this.kernelSettled())state.walkingStartStep=state.metrics.steps;
  if(a.held&&pace<.08){this.tempo=1;this.stop();return a.routeIndex<a.route.length||!this.isSettled();}
  this.tempo=clamp(speed/.48*(a.strength?.movementFactor()??1)*pace,.05,1);
  if(this.canContinuousTaskHandoff()){if(!a.pendingPhysicsFinish)a.finish();return true;}
  while(a.routeIndex<a.route.length){
   if(a.routeIndex<a.route.length-1&&this.routePassThrough(a.routeIndex)){a.routeIndex++;this.routePassThroughCount++;continue;}
   if(horizontal(state.root,a.route[a.routeIndex])>.015)break;
   if(a.routeIndex===a.route.length-1){if(state.command||!this.isSettled()){this.requested=true;return true;}a.routeIndex++;return false;}
   a.routeIndex++;
  }
  if(a.routeIndex>=a.route.length){if(this.traffic.corridorKey)trafficReleaseCorridor(this);return false;}
  const target=this.prepareTrafficTarget(speed);if(!target)return false;
  this.request({type:'walk',target:[...target]});return true;
 }
 turnInPlace(yaw,dt){
  const pace=this.a.manipulationPace(),state=this.engine.state;
  if(this.a.held&&pace<.08){this.tempo=1;this.stop();return true;}
  this.tempo=clamp(pace,.05,1);
  if(this.turnFilter.stopped(yaw,state)&&this.kernelSettled()){this.requested=true;this.lastTurnContinuity=this.turnFilter.report();this.turnFilter.reset(state.yaw);return !this.isSettled();}
  const commandYaw=this.turnFilter.update(yaw,state,dt*this.tempo,this.tempo);
  this.request({type:'turn',yaw:commandYaw});return true;
 }
 stop(){const command={type:'stop'};if(this.kernelSettled()){this.requested=true;this.runtimeState?.setIntent(command,this.engine.state,this.tempo);return;}if(!this.engine.state.fault)this.request(command);}
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
 isSettled(){return this.kernelSettled()&&!(this.engine.state.pelvisSupportLiftM>0)&&!this.engine.state.pelvisSupportXM&&Object.values(this.engine.state.feet).every(foot=>!foot.rocker?.pitch)&&Math.abs(this.engine.state.root[1]-this.standingTarget())<.0003*this.a.h.bodyMetrics.statureScale;}
 gaitSupportTarget(){
  // Approximate the support-leg vault from this person's lengths and foot
  // separation. The mild bend is an authored IK reserve, not a clinical norm.
  // Keep the all-leg reach ceiling as well, including the airborne leg.
  const s=this.engine.state;let target=this.standingTarget();
  for(const side of ['left','right']){
   const foot=s.feet[side];if(!foot.contact)continue;
   const hip=add(s.root,rotate(qy(s.yaw),[this.rig.hipHalf*(side==='left'?-1:1),0,0]));
   const {upper,lower}=this.rig.legs[side],knee=12*Math.PI/180;
   const reach2=upper*upper+lower*lower+2*upper*lower*Math.cos(knee),d=horizontal(hip,foot.position);
   target=Math.min(target,foot.position[1]+Math.sqrt(Math.max(0,reach2-d*d)));
  }
  return target;
 }
 updateHeight(dt,standing){
  const e=this.engine;if(e.state.paused||e.state.fault)return;
  const target=standing?this.standingTarget():this.gaitSupportTarget(),before=e.state;
  const y=Math.min(this.standingTarget(),before.root[1]+(target-before.root[1])*(1-Math.exp(-dt/.18)));
  if(Math.abs(y-before.root[1])<1e-10)return;
  const candidate={...before,root:[before.root[0],y,before.root[2]]};candidate.pose=e.solve(candidate);
  for(const side of ['left','right']){
   const leg=candidate.pose.legs[side];
   if(leg.residual>.012||leg.lengthError>1e-7)throw Error('站立高度过渡超出固定脚锚可达范围');
  }
  e.state=candidate;
 }
 updateSupportLift(dt){
  const s=this.engine.state,scale=this.a.h.bodyMetrics.statureScale;
  if(s.paused||s.fault)return;
  // The navigation kernel retains its flat-placement IK. The committed body
  // follows the actual rolling ankles; otherwise heel rise becomes knee bend.
  let ceiling=Infinity,target=this.standingHipHeightM+.035*scale;
  const freeSupport=!this.usesFlatSupport(s)&&!Object.values(s.feet).some(f=>f.adoptedOrientation);
  const active=freeSupport&&Object.values(s.feet).some(f=>f.rocker?.pitch);
  // A small contact-driven transfer towards the stance foot, fading at both
  // ends of the swing. Route/root XZ remain the navigation reference.
  let transfer=0;
  if(freeSupport&&s.swing&&s.speed>.03){
   const support=s.feet[s.swing.side==='left'?'right':'left'];
   const u=clamp(s.swing.elapsed/s.swing.duration,0,1),envelope=16*u*u*(1-u)*(1-u);
   const local=rotate(inv(qy(s.yaw)),sub(support.rocker?.world||support.position,s.root));
   transfer=clamp(local[0]*.20,-.018*scale,.018*scale)*envelope*clamp(s.speed*this.tempo/.35,0,1);
  }
  const previousX=s.pelvisSupportXM||0;
  s.pelvisSupportXM=previousX+clamp((transfer-previousX)*(1-Math.exp(-dt/.06)),-.08*scale*dt,.08*scale*dt);
  if(Math.abs(s.pelvisSupportXM)<1e-7)s.pelvisSupportXM=0;
  const bodyRoot=add(s.root,rotate(qy(s.yaw),[s.pelvisSupportXM,0,0]));
  for(const side of ['left','right']){
   const foot=s.feet[side],ankle=foot.rocker?.ankle||foot.position;
   const hip=add(bodyRoot,rotate(qy(s.yaw),[this.rig.hipHalf*(side==='left'?-1:1),0,0]));
   const {upper,lower}=this.rig.legs[side],d=horizontal(hip,ankle),reach=upper+lower-.0005*scale;
   ceiling=Math.min(ceiling,ankle[1]+Math.sqrt(Math.max(0,reach*reach-d*d)));
   if(foot.contact){const knee=12*Math.PI/180,r2=upper*upper+lower*lower+2*upper*lower*Math.cos(knee);
    target=Math.min(target,ankle[1]+Math.sqrt(Math.max(0,r2-d*d)));}
  }
  const desired=active?clamp(Math.min(target,ceiling)-s.root[1],0,.035*scale):0;
  const previous=s.pelvisSupportLiftM||0,step=(desired-previous)*(1-Math.exp(-dt/.08));
  s.pelvisSupportLiftM=Math.min(Math.max(0,ceiling-s.root[1]),Math.max(0,previous+clamp(step,-.15*scale*dt,.15*scale*dt)));
  if(s.pelvisSupportLiftM<1e-7)s.pelvisSupportLiftM=0;
 }
 canTransition(){return this.isSettled();}
 update(dt){
  const e=this.engine,currentTaskKey=trafficTaskKey(this.a);
  if(this.traffic.slotTaskKey&&this.traffic.slotTaskKey!==currentTaskKey)trafficReleaseTargetSlot(this);
  if(this.traffic.corridorTaskKey&&this.traffic.corridorTaskKey!==currentTaskKey)trafficReleaseCorridor(this);
  if(this.traffic.active&&this.traffic.phase!==undefined&&this.traffic.phase!==this.a.phase)Object.assign(this.traffic,{active:false,mode:'clear',reason:null,blockers:[],detourEndIndex:-1});
  if(!this.requested&&e.state.command?.type==='walk')this.stop();
  this.requested=false;
  if(!this.kernelSettled())this.updateHeight(dt*this.tempo,false);
  const previousSwingSide=e.state.swing?.side;
  this.phaseController.timeScale=this.tempo;this.phaseController.turnTargetYaw=this.turnFilter.targetYaw;
  e.update(dt*this.tempo);this.turnFilter.retargetSwing(e);
  // An adopted sole keeps its world orientation while planted. Its first
  // real swing releases pitch/roll and aligns yaw, rather than twisting the
  // support footprint during the return-to-standing blend.
  for(const side of ['left','right'])if(e.state.feet[side].adoptedOrientation&&e.state.feet[side].contact&&e.state.swing?.side!==side){
   if(previousSwingSide===side)delete e.state.feet[side].adoptedOrientation;
  }
  if(e.state.fault&&!this.recoverNavigationBlock(e.state.fault))throw Error(e.state.fault);
  if(e.state.status==='blocked'&&!this.recoverNavigationBlock('连续碰撞检测发现路线受阻'))throw Error('连续碰撞检测发现路线受阻，局部绕行与重新规划均未找到可用净空');
  // The scheduler may have advanced an independent foot target. Apply its
  // exact reach ceiling once more; do not leave even a small clamped-IK foot
  // hovering above that anchor while the height response catches up.
  this.updateHeight(this.kernelSettled()?dt*this.tempo:0,this.kernelSettled());
  this.updateSupportLift(dt*this.tempo);
  this.sync();
  this.runtimeState?.observe(this,dt);
 }
 report(){const s=this.engine.state;return{version:NATURAL_GAIT.version,state:s.status,speedMps:this.speed,timeScale:this.tempo,contacts:{...this.contacts},settled:this.isSettled(),
  source:MotionLab.MOTION_SOURCE,sourcePhase:s.motion.phase,referenceBlend:s.motion.weight,metrics:{...s.metrics},skinFloorOffsetM:this.skinFloorOffsetM,
  height:{standingTargetM:this.standingHipHeightM,walkingTargetM:this.gaitSupportTarget(),legacyWalkingTargetM:this.rig.hipHeight,currentM:s.root[1],reachableStandingM:this.standingTarget(),timeConstantS:.18,
   supportLiftM:s.pelvisSupportLiftM||0,bodyRootM:s.root[1]+(s.pelvisSupportLiftM||0),supportResponseS:.08,method:'rolling-support-reach/v2'},
  weightTransfer:{pelvisLocalXM:s.pelvisSupportXM||0,maximumM:.018*this.a.h.bodyMetrics.statureScale,method:'stance-contact-transfer/v1',dynamicBalanceValidated:false},
  traffic:structuredClone(this.traffic),routePassThroughCount:this.routePassThroughCount,poseAdoption:this.lastPoseAdoption?structuredClone(this.lastPoseAdoption):null,
  continuousWalkHandoff:this.lastContinuousWalkHandoff?structuredClone(this.lastContinuousWalkHandoff):null,
  phaseContinuity:this.phaseController.report(),turnContinuity:this.turnFilter.report(),lastTurnContinuity:this.lastTurnContinuity?structuredClone(this.lastTurnContinuity):null,
  footSupport:{mode:this.usesFlatSupport()?'flat':'heel-sole-forefoot',feet:Object.fromEntries(['left','right'].map(side=>[side,s.feet[side].rocker?structuredClone(s.feet[side].rocker):null]))},
  contactBasis:'flat placement anchors with explicit heel/forefoot support pivots',pose:this.pose.report(),runtimeState:this.runtimeState?.report?.()||null,visualAcceptance:false};}
}
