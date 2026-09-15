/* Routes belong to Agent/PlanForecast. Root movement, stepping and contact
 * ownership belong exclusively to the pinned MotionController R2.2. */
const NATURAL_GAIT=Object.freeze({version:'motion-lab-r2.2',fixedStepS:1/120,maxSubsteps:24});
const TRAFFIC_AVOIDANCE=Object.freeze({horizonS:1.8,sampleS:.15,planCooldownS:.22,sideMarginM:.14,slotGapM:.16});
const trafficRuntimeByPopulation=new WeakMap();
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
 if(!runtime){runtime={slots:new Map()};trafficRuntimeByPopulation.set(population,runtime);}return runtime;
}
function trafficTaskKey(agent){
 const s=agent.skill;if(!s)return null;return [agent.index,s.type,s.targetId||'',s.objectId||'',agent.phase].join('|');
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
  if(population.collisionFor?.(a,point,context.radius))continue;
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
 resetFromPose(){
  if(this.traffic?.slotKey)trafficReleaseTargetSlot(this);
  const a=this.a,e=this.engine,root=[a.pos[0],this.standingHipHeightM,a.pos[2]],yaw=a.yaw;
  const world=e.world;e.world=new MotionLab.FlatWorld();e.reset();e.world=world;
  e.state.root=root;e.state.yaw=yaw;e.state.time=a.time;
  for(const side of ['left','right'])e.state.feet[side]={position:e.stance(e.state,side),yaw,contact:true};
  e.state.pose=e.solve(e.state);this.requestKey=null;this.requested=false;this.tempo=1;
  this.traffic={active:false,mode:'clear',reason:null,blockers:[],side:0,detours:0,retreats:0,replans:0,recoveries:0,slotReservations:0,lastPlanAtS:-Infinity,nextPlanAtS:0,detourEndIndex:-1,originalTarget:null,lastError:null,slotKey:null,slotTaskKey:null,slotPoint:null,slotIndex:null,advancePoint:null,advanceRouteIndex:-1};this.sync();
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
  const a=this.a,root=this.engine.state.root,current=a.route[a.routeIndex],other=conflict.actor;if(!current||!other)return false;
  let direction=sub(conflict.selfPoint||current,root);direction[1]=0;if(len(direction)<.12){direction=sub(current,root);direction[1]=0;}if(len(direction)<.12)return false;direction=norm(direction);
  const right=[direction[2],0,-direction[0]],preferred=trafficPairSide(a.npcId,other.id),otherRadius=bodyPhysicalProfile(other.human).bodyRadiusM,clearance=context.radius+otherRadius+TRAFFIC_AVOIDANCE.sideMarginM;
  const centre=mix(other.agent.pos,conflict.otherPoint,.65),along=Math.max(.24,dot(sub(centre,root),direction)),entryAlong=Math.max(.20,along-clearance*.85),baseExit=Math.max(entryAlong+.34,along+clearance*.95);
  for(const side of [preferred,-preferred])for(const scale of [1.05,1.30,1.60,2.0]){
   const offset=clearance*scale,entry=add(add(root,mul(direction,entryAlong)),mul(right,side*offset)),exit=add(add(root,mul(direction,baseExit)),mul(right,side*offset));entry[1]=0;exit[1]=0;
   let resumeIndex=a.routeIndex;while(resumeIndex<a.route.length-1&&horizontal(root,a.route[resumeIndex])<baseExit+.18)resumeIndex++;
   let resume=[...a.route[resumeIndex]],terminalShift=false;
   if(horizontal(root,resume)<baseExit+.10){
    if(a.skill?.type!=='walk')continue;
    resume=add(resume,mul(right,side*clearance*1.15));resume[1]=0;terminalShift=true;
   }
   if(!trafficSegmentClear(a,root,entry,context)||!trafficSegmentClear(a,entry,exit,context)||!trafficSegmentClear(a,exit,resume,context))continue;
   const deleteCount=terminalShift?resumeIndex-a.routeIndex+1:resumeIndex-a.routeIndex;
   a.route.splice(a.routeIndex,deleteCount,entry,exit,...(terminalShift?[resume]:[]));
   this.requestKey=null;Object.assign(this.traffic,{active:true,mode:'detour',reason:'predicted-npc-conflict',blockers:[other.id],side,detourEndIndex:a.routeIndex+1,originalTarget:[...current],lastPlanAtS:a.time,nextPlanAtS:a.time+TRAFFIC_AVOIDANCE.planCooldownS,lastError:null,advancePoint:null,advanceRouteIndex:-1});this.traffic.detours++;
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
  if(a.skill?.type==='walk'&&!this.traffic.slotKey){trafficReserveTargetSlot(this,context);target=a.route[a.routeIndex];if(!target)return null;}
  if(motionWorldSweep(a.w,root,target,context.radius,context.ignore).fraction<1-1e-6){
   if(!this.replanStaticRoute(context))throw Error('当前物体阻断路线，且没有可用的重新规划路径');
   target=a.route[a.routeIndex];if(!target)return null;
  }
  if(!a.w.population)return target;
  const rolling=this.rollingTrafficTarget(target,context);if(rolling&&rolling!==target)return rolling;
  if(this.traffic.active&&a.routeIndex<=this.traffic.detourEndIndex&&!force&&this.world.free(target,.23))return target;
  if(!force&&a.time<this.traffic.nextPlanAtS&&this.world.free(target,.23))return target;
  this.traffic.nextPlanAtS=a.time+.10;
  const conflict=predictTrafficConflict(a,speed,context)||[...a.w.population.values()].filter(other=>other.agent!==a&&other.id!==a.npcId&&!other.disposed).map(other=>{const threshold=context.radius+bodyPhysicalProfile(other.human).bodyRadiusM+TRAFFIC_AVOIDANCE.sideMarginM,separation=horizontal(target,other.agent.pos);return{actor:other,timeS:0,selfPoint:target,otherPoint:[...other.agent.pos],separation,threshold,score:separation};}).filter(row=>row.separation<row.threshold).sort((x,y)=>x.score-y.score)[0]||null;
  if(!conflict){this.traffic.blockers=[];return target;}
  if(this.installLocalDetour(conflict,context)||this.installDeterministicRetreat(conflict,context))return a.route[a.routeIndex];
  throw Error('预测到多人路线冲突，但局部偏移和移动让行均无可用净空：'+conflict.actor.id);
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
 move(dt,speed=.48){
  const a=this.a,s=this.engine.state;
  const pace=a.manipulationPace();
  // A blocked load requests normal braking, never a frozen mid-air foot.
  // Route ownership is retained so recovery can resume the same destination.
  if(a.held&&pace<.08){this.tempo=1;this.stop();return a.routeIndex<a.route.length||!this.isSettled();}
  this.tempo=clamp(speed/.48*(a.strength?.movementFactor()??1)*pace,.05,1);
  while(a.routeIndex<a.route.length&&horizontal(s.root,a.route[a.routeIndex])<=.015){
   if(a.routeIndex===a.route.length-1){if(s.command||!this.isSettled()){this.requested=true;return true;}a.routeIndex++;return false;}
   a.routeIndex++;
  }
  if(a.routeIndex>=a.route.length)return false;
  const target=this.prepareTrafficTarget(speed);if(!target)return false;
  this.request({type:'walk',target:[...target]});return true;
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
  const e=this.engine,currentTaskKey=trafficTaskKey(this.a);
  if(this.traffic.slotTaskKey&&this.traffic.slotTaskKey!==currentTaskKey)trafficReleaseTargetSlot(this);
  if(this.traffic.active&&this.traffic.phase!==undefined&&this.traffic.phase!==this.a.phase)Object.assign(this.traffic,{active:false,mode:'clear',reason:null,blockers:[],detourEndIndex:-1});
  if(!this.requested&&e.state.command?.type==='walk')this.stop();
  this.requested=false;
  if(!this.kernelSettled())this.updateHeight(dt*this.tempo,false);
  e.update(dt*this.tempo);
  if(e.state.fault&&!this.recoverNavigationBlock(e.state.fault))throw Error(e.state.fault);
  if(e.state.status==='blocked'&&!this.recoverNavigationBlock('连续碰撞检测发现路线受阻'))throw Error('连续碰撞检测发现路线受阻，局部绕行与重新规划均未找到可用净空');
  // The scheduler may have advanced an independent foot target. Apply its
  // exact reach ceiling once more; do not leave even a small clamped-IK foot
  // hovering above that anchor while the height response catches up.
  this.updateHeight(this.kernelSettled()?dt*this.tempo:0,this.kernelSettled());
  this.sync();
 }
 report(){const s=this.engine.state;return{version:NATURAL_GAIT.version,state:s.status,speedMps:this.speed,timeScale:this.tempo,contacts:{...this.contacts},settled:this.isSettled(),
  source:MotionLab.MOTION_SOURCE,sourcePhase:s.motion.phase,referenceBlend:s.motion.weight,metrics:{...s.metrics},skinFloorOffsetM:this.skinFloorOffsetM,
  height:{standingTargetM:this.standingHipHeightM,walkingTargetM:this.rig.hipHeight,currentM:s.root[1],reachableStandingM:this.standingTarget(),timeConstantS:.18},
  traffic:structuredClone(this.traffic),contactBasis:'Motion-Lab explicit foot anchors',pose:this.pose.report(),visualAcceptance:false};}
}
