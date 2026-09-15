from pathlib import Path

path = Path('body/NaturalLocomotion.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        "const TRAFFIC_AVOIDANCE=Object.freeze({horizonS:1.8,sampleS:.15,planCooldownS:.22,sideMarginM:.14,slotGapM:.16});",
        "const TRAFFIC_AVOIDANCE=Object.freeze({horizonS:1.8,sampleS:.15,planCooldownS:.22,sideMarginM:.14,slotGapM:.16,corridorLeaseS:6,corridorProbeM:.12});",
    ),
    (
        "if(!runtime){runtime={slots:new Map()};trafficRuntimeByPopulation.set(population,runtime);}return runtime;",
        "if(!runtime){runtime={slots:new Map(),corridors:new Map()};trafficRuntimeByPopulation.set(population,runtime);}return runtime;",
    ),
    (
        "if(this.traffic?.slotKey)trafficReleaseTargetSlot(this);",
        "if(this.traffic?.slotKey)trafficReleaseTargetSlot(this);if(this.traffic?.corridorKey)trafficReleaseCorridor(this);",
    ),
    (
        "slotPoint:null,slotIndex:null,advancePoint:null,advanceRouteIndex:-1};this.sync();",
        "slotPoint:null,slotIndex:null,advancePoint:null,advanceRouteIndex:-1,corridorKey:null,corridorTaskKey:null,corridorOwner:null,corridorDirection:0,corridorClaims:0,corridorYields:0};this.sync();",
    ),
]
for old, new in replacements:
    if text.count(old) != 1:
        raise SystemExit(f'expected exactly one source site: {old[:90]}')
    text = text.replace(old, new)

marker = """function trafficTaskKey(agent){
 const s=agent.skill;if(!s)return null;return [agent.index,s.type,s.targetId||'',s.objectId||'',agent.phase].join('|');
}"""
insert = marker + """
function trafficCorridorLocal(agent,point,direction,context){
 const right=[direction[2],0,-direction[0]],probe=context.radius*2+TRAFFIC_AVOIDANCE.sideMarginM+TRAFFIC_AVOIDANCE.corridorProbeM,left=add(point,mul(right,probe)),rightPoint=add(point,mul(right,-probe));
 left[1]=0;rightPoint[1]=0;
 const leftBlocked=motionWorldSweep(agent.w,point,left,context.radius,context.ignore).fraction<1-1e-6,rightBlocked=motionWorldSweep(agent.w,point,rightPoint,context.radius,context.ignore).fraction<1-1e-6;
 return{narrow:leftBlocked&&rightBlocked,leftBlocked,rightBlocked,probe,right};
}
function trafficCorridorDescriptor(agent,start,end,context){
 let direction=sub(end,start);direction[1]=0;if(len(direction)<.35)return null;direction=norm(direction);
 const midpoint=mix(start,end,.5),local=trafficCorridorLocal(agent,midpoint,direction,context);if(!local.narrow)return null;
 const near=(agent.w.objects||[]).filter(o=>o.collidable!==false&&!context.ignore.includes(o.id)&&pointToObjectClearance(midpoint,o)<local.probe+context.radius+.45).map(o=>String(o.id)).sort();
 if(near.length<2)return null;
 const axis=Math.abs(direction[0])>=Math.abs(direction[2])?'x':'z',sign=(axis==='x'?direction[0]:direction[2])>=0?1:-1;
 return{key:'corridor:'+axis+':'+near.join(','),direction,sign,midpoint,obstacleIds:near};
}
function trafficPruneCorridors(population,runtime,now){
 const live=new Map([...population.values()].filter(actor=>!actor.disposed).map(actor=>[actor.id,actor]));
 for(const [key,lease]of runtime.corridors){const actor=live.get(lease.ownerId),a=actor?.agent;if(!a||lease.expiresAtS<=now||trafficTaskKey(a)!==lease.taskKey)runtime.corridors.delete(key);}
}
function trafficReleaseCorridor(locomotion){
 const a=locomotion.a,t=locomotion.traffic,population=a.w.population,key=t?.corridorKey;
 if(key&&population){const runtime=trafficRuntime(population),lease=runtime?.corridors.get(key);if(lease?.ownerId===a.npcId)runtime.corridors.delete(key);}
 if(t)Object.assign(t,{corridorKey:null,corridorTaskKey:null,corridorOwner:null,corridorDirection:0});
}
function trafficCorridorPriority(agent,other,descriptor){
 const root=agent.locomotion?.engine?.state?.root||agent.pos,ownDistance=horizontal(root,descriptor.midpoint),otherDistance=horizontal(other.agent.pos,descriptor.midpoint);
 if(ownDistance+.25<otherDistance)return agent.npcId;if(otherDistance+.25<ownDistance)return other.id;
 return[String(agent.npcId),String(other.id)].sort()[0];
}"""
if text.count(marker) != 1:
    raise SystemExit('expected one task-key marker')
text = text.replace(marker, insert)

marker = """ }
 rollingTrafficTarget(target,context){"""
methods = """ }
 installCorridorYield(conflict,context,descriptor){
  const a=this.a,root=this.engine.state.root,goal=this.traffic.slotPoint||a.route.at(-1),other=conflict.actor;if(!goal||!other)return false;
  const direction=descriptor.direction,right=descriptor.direction&&[direction[2],0,-direction[0]],preferred=trafficPairSide(a.npcId,other.id),clearance=context.radius+bodyPhysicalProfile(other.human).bodyRadiusM+TRAFFIC_AVOIDANCE.sideMarginM;
  for(const back of [.48,.72,1.0,1.35,1.75,2.2])for(const side of [preferred,-preferred])for(const lateral of [0,.35,.65,1.0,1.35]){
   const point=add(add(root,mul(direction,-back)),mul(right,side*clearance*lateral));point[1]=0;
   if(!trafficSegmentClear(a,root,point,context)||!this.world.free(point,.23))continue;
   const local=trafficCorridorLocal(a,point,direction,context);if(local.narrow&&back<1.0)continue;
   let continuation;try{continuation=a.w.path(point,goal,context.radius,context.ignore);}catch{continue;}
   if(!Array.isArray(continuation)||!continuation.length)continue;
   a.route.splice(a.routeIndex,a.route.length-a.routeIndex,[...point],...continuation.map(p=>[...p]));this.requestKey=null;
   Object.assign(this.traffic,{active:true,mode:'corridor-yield',reason:'opposing-narrow-corridor',blockers:[other.id],side,detourEndIndex:a.routeIndex,originalTarget:[...goal],lastPlanAtS:a.time,nextPlanAtS:a.time+TRAFFIC_AVOIDANCE.planCooldownS,lastError:null,advancePoint:null,advanceRouteIndex:-1,corridorKey:descriptor.key,corridorTaskKey:trafficTaskKey(a),corridorOwner:other.id,corridorDirection:descriptor.sign});this.traffic.corridorYields++;
   a.log?.('狭窄通道已有相反方向通行者，已主动撤到通道外并保留原任务路线');return true;
  }
  return false;
 }
 corridorAdvanceTarget(target,context){
  const a=this.a,root=this.engine.state.root;let direction=sub(target,root);direction[1]=0;const distance=len(direction);if(distance<.08)return null;direction=norm(direction);
  for(const lookahead of [Math.min(.68,distance-.04),Math.min(.48,distance-.04),Math.min(.30,distance-.04),Math.min(.18,distance-.04)]){
   if(lookahead<.10)continue;const point=add(root,mul(direction,lookahead));point[1]=0;
   if(trafficSegmentClear(a,root,point,context)&&this.world.free(point,.23))return point;
  }
  return null;
 }
 resolveNarrowCorridor(conflict,context){
  const a=this.a,population=a.w.population,root=this.engine.state.root,target=a.route[a.routeIndex],other=conflict?.actor;if(!population||!target||!other)return null;
  const descriptor=trafficCorridorDescriptor(a,root,target,context);if(!descriptor){if(this.traffic.corridorKey)trafficReleaseCorridor(this);return null;}
  const otherTarget=other.agent.route?.[other.agent.routeIndex],otherDirection=otherTarget?norm([otherTarget[0]-other.agent.pos[0],0,otherTarget[2]-other.agent.pos[2]]):trafficActorVelocity(other);
  if(len(otherDirection)<.05||dot(descriptor.direction,otherDirection)>-.25)return null;
  const runtime=trafficRuntime(population),taskKey=trafficTaskKey(a);trafficPruneCorridors(population,runtime,a.time);
  let lease=runtime.corridors.get(descriptor.key);
  if(!lease){const ownerId=trafficCorridorPriority(a,other,descriptor),owner=ownerId===a.npcId?a:other.agent;lease={ownerId,direction:ownerId===a.npcId?descriptor.sign:-descriptor.sign,taskKey:trafficTaskKey(owner),expiresAtS:a.time+TRAFFIC_AVOIDANCE.corridorLeaseS};runtime.corridors.set(descriptor.key,lease);}
  if(lease.ownerId===a.npcId){lease.expiresAtS=a.time+TRAFFIC_AVOIDANCE.corridorLeaseS;lease.taskKey=taskKey;if(this.traffic.corridorKey!==descriptor.key)this.traffic.corridorClaims++;
   Object.assign(this.traffic,{corridorKey:descriptor.key,corridorTaskKey:taskKey,corridorOwner:a.npcId,corridorDirection:descriptor.sign,mode:'corridor-owner',reason:'narrow-corridor-direction-owner'});return'owner';}
  Object.assign(this.traffic,{corridorKey:descriptor.key,corridorTaskKey:taskKey,corridorOwner:lease.ownerId,corridorDirection:descriptor.sign});
  return this.installCorridorYield(conflict,context,descriptor)?'yield':'blocked';
 }
 rollingTrafficTarget(target,context){"""
if text.count(marker) != 1:
    raise SystemExit('expected one rolling target insertion marker')
text = text.replace(marker, methods)

old = """  if(!a.w.population)return target;
  const rolling=this.rollingTrafficTarget(target,context);if(rolling&&rolling!==target)return rolling;
  if(this.traffic.active&&a.routeIndex<=this.traffic.detourEndIndex&&!force&&this.world.free(target,.23))return target;
  if(!force&&a.time<this.traffic.nextPlanAtS&&this.world.free(target,.23))return target;
  this.traffic.nextPlanAtS=a.time+.10;
  const conflict=predictTrafficConflict(a,speed,context)||[...a.w.population.values()].filter(other=>other.agent!==a&&other.id!==a.npcId&&!other.disposed).map(other=>{const threshold=context.radius+bodyPhysicalProfile(other.human).bodyRadiusM+TRAFFIC_AVOIDANCE.sideMarginM,separation=horizontal(target,other.agent.pos);return{actor:other,timeS:0,selfPoint:target,otherPoint:[...other.agent.pos],separation,threshold,score:separation};}).filter(row=>row.separation<row.threshold).sort((x,y)=>x.score-y.score)[0]||null;
  if(!conflict){this.traffic.blockers=[];return target;}
  if(this.installLocalDetour(conflict,context)||this.installDeterministicRetreat(conflict,context)||this.installRadialEscape(conflict,context))return a.route[a.routeIndex];"""
new = """  if(!a.w.population)return target;
  const predicted=predictTrafficConflict(a,speed,context);
  if(predicted){const corridor=this.resolveNarrowCorridor(predicted,context);if(corridor==='yield')return a.route[a.routeIndex];if(corridor==='owner'){const advance=this.corridorAdvanceTarget(target,context);if(advance)return advance;}if(corridor==='blocked'&&this.installRadialEscape(predicted,context))return a.route[a.routeIndex];}
  const rolling=this.rollingTrafficTarget(target,context);if(rolling&&rolling!==target)return rolling;
  if(this.traffic.active&&a.routeIndex<=this.traffic.detourEndIndex&&!force&&this.world.free(target,.23))return target;
  if(!force&&a.time<this.traffic.nextPlanAtS&&this.world.free(target,.23))return target;
  this.traffic.nextPlanAtS=a.time+.10;
  const conflict=predicted||[...a.w.population.values()].filter(other=>other.agent!==a&&other.id!==a.npcId&&!other.disposed).map(other=>{const threshold=context.radius+bodyPhysicalProfile(other.human).bodyRadiusM+TRAFFIC_AVOIDANCE.sideMarginM,separation=horizontal(target,other.agent.pos);return{actor:other,timeS:0,selfPoint:target,otherPoint:[...other.agent.pos],separation,threshold,score:separation};}).filter(row=>row.separation<row.threshold).sort((x,y)=>x.score-y.score)[0]||null;
  if(!conflict){this.traffic.blockers=[];return target;}
  if(this.installLocalDetour(conflict,context)||this.installDeterministicRetreat(conflict,context)||this.installRadialEscape(conflict,context))return a.route[a.routeIndex];"""
if text.count(old) != 1:
    raise SystemExit('expected one prepare-traffic sequence')
text = text.replace(old, new)

old = """  if(a.routeIndex>=a.route.length)return false;
  const target=this.prepareTrafficTarget(speed);if(!target)return false;"""
new = """  if(a.routeIndex>=a.route.length){if(this.traffic.corridorKey)trafficReleaseCorridor(this);return false;}
  const target=this.prepareTrafficTarget(speed);if(!target)return false;"""
if text.count(old) != 1:
    raise SystemExit('expected one route completion branch')
text = text.replace(old, new)

old = """  if(this.traffic.slotTaskKey&&this.traffic.slotTaskKey!==currentTaskKey)trafficReleaseTargetSlot(this);"""
new = """  if(this.traffic.slotTaskKey&&this.traffic.slotTaskKey!==currentTaskKey)trafficReleaseTargetSlot(this);
  if(this.traffic.corridorTaskKey&&this.traffic.corridorTaskKey!==currentTaskKey)trafficReleaseCorridor(this);"""
if text.count(old) != 2:
    raise SystemExit('expected two task-change release sites')
text = text.replace(old, new)

path.write_text(text, encoding='utf-8', newline='\n')
print('active narrow-corridor yielding patch applied')
