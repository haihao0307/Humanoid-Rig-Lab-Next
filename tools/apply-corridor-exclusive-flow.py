from pathlib import Path

path = Path('body/NaturalLocomotion.js')
text = path.read_text(encoding='utf-8')


def replace_block(source: str, signature: str, replacement: str) -> str:
    start = source.find(signature)
    if start < 0:
        raise SystemExit(f'missing block: {signature}')
    brace = source.find('{', start)
    if brace < 0:
        raise SystemExit(f'missing opening brace: {signature}')
    depth = 0
    quote = None
    escape = False
    i = brace
    while i < len(source):
        ch = source[i]
        if quote:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == quote:
                quote = None
        elif ch in "'\"`":
            quote = ch
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return source[:start] + replacement + source[i + 1:]
        i += 1
    raise SystemExit(f'unclosed block: {signature}')


text = replace_block(text, 'function trafficCorridorDescriptor(', """function trafficCorridorDescriptor(agent,start,end,context){
 let direction=sub(end,start);direction[1]=0;if(len(direction)<.35)return null;direction=norm(direction);
 const midpoint=mix(start,end,.5),local=trafficCorridorLocal(agent,midpoint,direction,context);if(!local.narrow)return null;
 const obstacles=(agent.w.objects||[]).filter(o=>o.collidable!==false&&!context.ignore.includes(o.id)&&pointToObjectClearance(midpoint,o)<local.probe+context.radius+.45);
 if(obstacles.length<2)return null;
 const obstacleIds=obstacles.map(o=>String(o.id)).sort(),axis=Math.abs(direction[0])>=Math.abs(direction[2])?'x':'z',axisIndex=axis==='x'?0:2,lateralIndex=axis==='x'?2:0,sign=direction[axisIndex]>=0?1:-1;
 let lower=Infinity,upper=-Infinity;
 for(const o of obstacles){const [rx,rz]=objectFootprint(o),extent=axis==='x'?rx:rz;lower=Math.min(lower,o.p[axisIndex]-extent);upper=Math.max(upper,o.p[axisIndex]+extent);}
 if(!Number.isFinite(lower)||!Number.isFinite(upper)||upper-lower<.35)return null;
 return{key:'corridor:'+axis+':'+obstacleIds.join(','),direction,sign,midpoint,obstacleIds,axis,axisIndex,lateralIndex,lower,upper};
}""")

text = replace_block(text, 'function trafficReleaseCorridor(', """function trafficReleaseCorridor(locomotion){
 const a=locomotion.a,t=locomotion.traffic,population=a.w.population,key=t?.corridorKey;
 if(key&&population){const runtime=trafficRuntime(population),lease=runtime?.corridors.get(key);if(lease?.ownerId===a.npcId)runtime.corridors.delete(key);}
 if(t)Object.assign(t,{corridorKey:null,corridorTaskKey:null,corridorOwner:null,corridorDirection:0,corridorDescriptor:null,corridorOrbit:null,corridorOrbitIndex:0,corridorOrbitCycleStart:0,corridorOrbitLaps:0});
}""")

state_old = 'corridorKey:null,corridorTaskKey:null,corridorOwner:null,corridorDirection:0,corridorClaims:0,corridorYields:0'
state_new = 'corridorKey:null,corridorTaskKey:null,corridorOwner:null,corridorDirection:0,corridorDescriptor:null,corridorOrbit:null,corridorOrbitIndex:0,corridorOrbitCycleStart:0,corridorOrbitLaps:0,corridorClaims:0,corridorYields:0'
if text.count(state_old) != 1:
    raise SystemExit('expected one corridor state initializer')
text = text.replace(state_old, state_new)

text = replace_block(text, ' installCorridorYield(', """ installCorridorYield(conflict,context,descriptor,lease){
  const a=this.a,goal=this.traffic.slotPoint||a.route.at(-1),other=conflict.actor;if(!goal||!other)return false;
  const first=this.traffic.corridorKey!==descriptor.key||this.traffic.corridorOwner!==lease.ownerId;
  Object.assign(this.traffic,{corridorKey:descriptor.key,corridorTaskKey:trafficTaskKey(a),corridorOwner:lease.ownerId,corridorDirection:descriptor.sign,corridorDescriptor:descriptor,mode:'corridor-circulation',reason:'opposing-narrow-corridor',blockers:[other.id],originalTarget:[...goal]});
  if(first){this.traffic.corridorOrbit=null;this.traffic.corridorOrbitIndex=0;this.traffic.corridorOrbitLaps=0;this.traffic.corridorYields++;}
  if(!this.normalizeCorridorRoute(context,goal))return false;
  const target=this.corridorOrbitTarget(lease,context);if(!target)return false;
  if(first)a.log?.('狭窄通道已有相反方向通行者，已转入通道外循环路线并保留原任务终点');
  return true;
 }""")

text = replace_block(text, ' corridorAdvanceTarget(', """ corridorAdvanceTarget(target,context){
  const a=this.a,root=this.engine.state.root;let direction=sub(target,root);direction[1]=0;const distance=len(direction);if(distance<.08)return null;direction=norm(direction);
  for(const lookahead of [Math.min(.72,distance-.04),Math.min(.54,distance-.04),Math.min(.38,distance-.04),Math.min(.24,distance-.04),Math.min(.14,distance-.04)]){
   if(lookahead<.08)continue;const point=add(root,mul(direction,lookahead));point[1]=0;
   if(trafficSegmentClear(a,root,point,context)&&this.world.free(point,.23))return point;
  }
  return null;
 }""")

text = replace_block(text, ' resolveNarrowCorridor(', """ resolveNarrowCorridor(conflict,context){
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
 }""")

insert_marker = ' rollingTrafficTarget(target,context){'
insert_at = text.find(insert_marker)
if insert_at < 0:
    raise SystemExit('missing rollingTrafficTarget marker')
new_methods = """ normalizeCorridorRoute(context,goal){
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
"""
text = text[:insert_at] + new_methods + text[insert_at:]

old_sequence = """  if(!a.w.population)return target;
  const predicted=predictTrafficConflict(a,speed,context);
  if(predicted){const corridor=this.resolveNarrowCorridor(predicted,context);if(corridor==='yield')return a.route[a.routeIndex];if(corridor==='owner'){const advance=this.corridorAdvanceTarget(target,context);if(advance)return advance;}if(corridor==='blocked'&&this.installRadialEscape(predicted,context))return a.route[a.routeIndex];}
  const rolling=this.rollingTrafficTarget(target,context);if(rolling&&rolling!==target)return rolling;"""
new_sequence = """  if(!a.w.population)return target;
  const maintained=this.maintainCorridor(context,target);if(maintained)return maintained;
  const predicted=predictTrafficConflict(a,speed,context);
  if(predicted){
   const corridor=this.resolveNarrowCorridor(predicted,context);
   if(corridor==='owner'||corridor==='yield'){const managed=this.maintainCorridor(context,target);if(managed)return managed;throw Error('狭窄通道没有可用的持续移动路线');}
   if(corridor==='blocked')throw Error('狭窄通道没有可用的主动撤离路线');
  }
  const rolling=this.rollingTrafficTarget(target,context);if(rolling&&rolling!==target)return rolling;"""
if text.count(old_sequence) != 1:
    raise SystemExit('expected one corridor planning sequence')
text = text.replace(old_sequence, new_sequence)

path.write_text(text, encoding='utf-8', newline='\n')
print('exclusive corridor flow patch applied')
