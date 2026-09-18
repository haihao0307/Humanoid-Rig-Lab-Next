/* Open intersections are coordinated as one shared traffic resource.
 * A single actor crosses while all other members keep moving on deterministic
 * outside lanes. This module does not own tasks, bodies, poses or step timing. */
const TRAFFIC_INTERSECTION=Object.freeze({clusterRadiusM:2.7,mergeRadiusM:1.20,enterRadiusM:.72,releaseRadiusM:1.08,ownerLeaseS:10,blockedRotationS:1.5,maximumRotations:16,baseOrbitM:1.08,laneGapM:.24});
// Actor clocks stop independently on pause. All leases use the population clock.
function trafficIntersectionNow(agent){
 return trafficPopulationNow(agent.w.population);
}
function trafficIntersectionKey(center){return'intersection:'+Math.round(center[0]*2)/2+','+Math.round(center[2]*2)/2;}
function trafficIntersectionActive(actor){
 const a=actor?.agent;return!!a&&!actor.disposed&&!a.paused&&!a.error&&!a.characterEditInProgress&&a.skill?.type==='walk'&&Array.isArray(a.route)&&a.routeIndex<a.route.length;
}
function trafficIntersectionDirection(actor){
 const a=actor.agent,root=a.locomotion?.engine?.state?.root||a.pos,target=a.route?.[a.routeIndex];if(!target)return null;
 const value=[target[0]-root[0],0,target[2]-root[2]];return len(value)>.08?norm(value):null;
}
function trafficIntersectionCandidates(agent,center){
 const population=agent.w.population;if(!population)return[];
 return[...population.values()].filter(actor=>{
  if(!trafficIntersectionActive(actor))return false;const a=actor.agent,root=a.locomotion?.engine?.state?.root||a.pos,distance=horizontal(root,center);if(distance>TRAFFIC_INTERSECTION.clusterRadiusM)return false;
  const direction=trafficIntersectionDirection(actor);if(!direction)return false;if(distance<1.05)return true;
  const toward=[center[0]-root[0],0,center[2]-root[2]];return len(toward)>.08&&dot(direction,norm(toward))>.12;
 });
}
function trafficIntersectionClearState(traffic){
 Object.assign(traffic,{active:false,mode:'clear',reason:null,blockers:[],detourEndIndex:-1,intersectionKey:null,intersectionTaskKey:null,intersectionOwner:null,intersectionCenter:null,intersectionOrbitDirection:0,intersectionOrbitLane:-1,intersectionOrbitAngle:null,advancePoint:null,advanceRouteIndex:-1,intersectionClaims:traffic.intersectionClaims||0,intersectionYields:traffic.intersectionYields||0,intersectionLaps:traffic.intersectionLaps||0,intersectionRotations:traffic.intersectionRotations||0});
}
function trafficIntersectionAssignOwner(lease,population,now){
 const live=new Map([...population.values()].filter(trafficIntersectionActive).map(actor=>[actor.id,actor]));
 const owner=live.get(lease.ownerId),member=lease.members.get(lease.ownerId);
 if(owner&&member&&trafficTaskKey(owner.agent)===member.taskKey)return lease.ownerId;
 const candidates=[...lease.members.entries()].map(([id,member])=>({id,member,actor:live.get(id)})).filter(row=>row.actor&&trafficTaskKey(row.actor.agent)===row.member.taskKey).sort((a,b)=>a.member.order-b.member.order||a.member.joinedAtS-b.member.joinedAtS||String(a.id).localeCompare(String(b.id)));
 if(!candidates.length){lease.ownerId=null;return null;}
 const chosen=candidates[0],root=chosen.actor.agent.locomotion?.engine?.state?.root||chosen.actor.agent.pos,offset=[root[0]-lease.center[0],0,root[2]-lease.center[2]];
 lease.ownerId=chosen.id;lease.ownerEntry=len(offset)>.08?norm(offset):[0,0,1];lease.ownerEntered=false;lease.ownerMinDistance=horizontal(root,lease.center);lease.expiresAtS=now+TRAFFIC_INTERSECTION.ownerLeaseS;lease.blockedSinceS=null;
 return lease.ownerId;
}
function trafficIntersectionSyncMembers(lease,population){
 const ordered=[...lease.members.keys()].sort();
 for(const actor of population.values()){
  const member=lease.members.get(actor.id),locomotion=actor.agent?.locomotion;if(!member||!locomotion?.traffic)continue;
  const traffic=locomotion.traffic,owner=lease.ownerId,first=traffic.intersectionKey!==lease.key||traffic.intersectionOwner!==owner,lane=ordered.filter(id=>id!==owner).indexOf(actor.id);
  Object.assign(traffic,{intersectionKey:lease.key,intersectionTaskKey:member.taskKey,intersectionOwner:owner,intersectionCenter:[...lease.center],intersectionOrbitDirection:lease.direction,intersectionOrbitLane:lane,originalTarget:[...member.goal]});
  if(actor.id===owner){traffic.active=false;traffic.mode='intersection-owner';traffic.reason='open-intersection-owner';if(first)traffic.intersectionClaims++;}
  // active/detourEndIndex belong to route-spliced pairwise detours. Circulation
  // is a temporary motion target and must not trigger clearTrafficIfPassed.
  else{traffic.active=false;traffic.mode='intersection-circulation';traffic.reason='open-intersection-circulation';if(first)traffic.intersectionYields++;}
 }
}
function trafficIntersectionHasExited(actor,member,lease){
 const a=actor.agent,root=a.locomotion?.engine?.state?.root||a.pos,distance=horizontal(root,lease.center);if(distance>TRAFFIC_INTERSECTION.clusterRadiusM)return true;
 if(member?.goal&&horizontal(root,member.goal)<.62)return true;
 if(distance<TRAFFIC_INTERSECTION.releaseRadiusM+.48)return false;
 const direction=trafficIntersectionDirection(actor),outward=sub(root,lease.center);return!!direction&&len(outward)>.08&&dot(direction,norm(outward))>.32;
}
function trafficPruneIntersections(population,runtime,now){
 if(!runtime?.intersections)return;
 const actors=new Map([...population.values()].map(actor=>[actor.id,actor]));
 for(const [key,lease]of runtime.intersections){
  for(const [id,member]of lease.members){
   const actor=actors.get(id),stale=!trafficIntersectionActive(actor)||trafficTaskKey(actor.agent)!==member.taskKey,exited=!stale&&trafficIntersectionHasExited(actor,member,lease);if(!stale&&!exited)continue;
   lease.members.delete(id);const traffic=actor?.agent.locomotion?.traffic;if(traffic?.intersectionKey===key)trafficIntersectionClearState(traffic);if(exited)actor.agent.log?.('已离开开放交叉区域，继续原任务路线');
  }
  if(!lease.members.size){runtime.intersections.delete(key);continue;}
  if(!lease.members.has(lease.ownerId))lease.ownerId=null;
  trafficIntersectionAssignOwner(lease,population,now);trafficIntersectionSyncMembers(lease,population);
 }
}
function trafficReleaseIntersection(locomotion){
 const a=locomotion.a,population=a.w.population,traffic=locomotion.traffic,key=traffic?.intersectionKey;
 if(key&&population){const runtime=trafficRuntime(population),lease=runtime?.intersections?.get(key);if(lease){lease.members.delete(a.npcId);if(lease.ownerId===a.npcId)lease.ownerId=null;if(!lease.members.size)runtime.intersections.delete(key);else{trafficIntersectionAssignOwner(lease,population,trafficIntersectionNow(a));trafficIntersectionSyncMembers(lease,population);}}}
 if(traffic)trafficIntersectionClearState(traffic);
}
function trafficResolveOpenIntersection(locomotion,conflict,context){
 const a=locomotion.a,population=a.w.population,other=conflict?.actor,target=a.route?.[a.routeIndex];if(!population||!other||!target||!trafficIntersectionActive({agent:a})||locomotion.traffic.corridorKey)return null;
 const root=locomotion.engine.state.root,ownDirection=trafficIntersectionDirection({agent:a}),otherDirection=trafficIntersectionDirection(other);if(!ownDirection||!otherDirection||dot(ownDirection,otherDirection)>.68)return null;
 if(trafficCorridorDescriptor(a,root,target,context))return null;
 const center=mix(conflict.selfPoint||root,conflict.otherPoint||other.agent.pos,.5),candidates=trafficIntersectionCandidates(a,center);
 const runtime=trafficRuntime(population);runtime.intersections??=new Map();trafficPruneIntersections(population,runtime,trafficIntersectionNow(a));
 let lease=[...runtime.intersections.values()].find(row=>horizontal(row.center,center)<=TRAFFIC_INTERSECTION.mergeRadiusM);
 const available=candidates.filter(actor=>{const traffic=actor.agent.locomotion?.traffic;return traffic&&!traffic.corridorKey&&(!traffic.intersectionKey||traffic.intersectionKey===lease?.key);});
 if(!available.some(actor=>actor.agent===a)||(!lease&&available.length<3))return null;
 if(!lease){const key=trafficIntersectionKey(center);lease={key,center:[center[0],0,center[2]],direction:trafficHash(key)&1?1:-1,ownerId:null,ownerEntry:null,ownerEntered:false,ownerMinDistance:Infinity,expiresAtS:trafficIntersectionNow(a)+TRAFFIC_INTERSECTION.ownerLeaseS,rotations:0,nextOrder:0,members:new Map()};runtime.intersections.set(key,lease);}
 for(const actor of available){const member=lease.members.get(actor.id),goal=actor.agent.locomotion?.traffic?.slotPoint||actor.agent.route.at(-1);if(!goal)continue;if(member)continue;lease.members.set(actor.id,{taskKey:trafficTaskKey(actor.agent),goal:[...goal],joinedAtS:trafficIntersectionNow(a),order:lease.nextOrder++});}
 trafficIntersectionAssignOwner(lease,population,trafficIntersectionNow(a));trafficIntersectionSyncMembers(lease,population);return lease;
}
function trafficIntersectionOrbitTarget(locomotion,lease,context,{ownerFallback=false}={}){
 const a=locomotion.a,traffic=locomotion.traffic,root=locomotion.engine.state.root,center=lease.center,waiting=[...lease.members.keys()].filter(id=>id!==lease.ownerId).sort(),lane=ownerFallback?0:Math.max(0,waiting.indexOf(a.npcId)),radius=TRAFFIC_INTERSECTION.baseOrbitM+lane*TRAFFIC_INTERSECTION.laneGapM+(ownerFallback?0.12:0),offset=[root[0]-center[0],0,root[2]-center[2]],distance=len(offset);
 const angle=distance>.06?Math.atan2(offset[0],offset[2]):((trafficHash(String(a.npcId||''))%360)/180*Math.PI),candidates=[];
 if(distance<radius-.10||distance>radius+.42)candidates.push([center[0]+Math.sin(angle)*radius,0,center[2]+Math.cos(angle)*radius]);
 for(const step of [.28,.42,.58,.76,1.0,1.22])for(const radial of [radius,radius+.16,Math.max(.92,radius-.12)]){const next=angle+lease.direction*step;candidates.push([center[0]+Math.sin(next)*radial,0,center[2]+Math.cos(next)*radial]);}
 for(const point of candidates){
  const radial=sub(point,center),axisClear=ownerFallback||!lease.ownerEntry||len(radial)<.08||Math.abs(dot(norm(radial),lease.ownerEntry))<.78;
  if(!axisClear||!locomotion.world.free(point,.23)||!trafficSegmentClear(a,root,point,context))continue;
  const nextAngle=Math.atan2(point[0]-center[0],point[2]-center[2]);if(Number.isFinite(traffic.intersectionOrbitAngle)){const delta=angleDiff(nextAngle,traffic.intersectionOrbitAngle)*lease.direction;if(delta<-.8)traffic.intersectionLaps++;}traffic.intersectionOrbitAngle=nextAngle;return point;
 }
 return null;
}
function trafficIntersectionMobileEscape(locomotion,lease,context,{ownerFallback=false}={}){
 const a=locomotion.a,population=a.w.population,traffic=locomotion.traffic,root=locomotion.engine.state.root,center=lease.center;if(!population)return null;
 const waiting=[...lease.members.keys()].filter(id=>id!==lease.ownerId).sort(),lane=ownerFallback?0:Math.max(0,waiting.indexOf(a.npcId)),desiredRadius=TRAFFIC_INTERSECTION.baseOrbitM+lane*TRAFFIC_INTERSECTION.laneGapM+(ownerFallback?.12:0),neighbours=[...population.values()].filter(actor=>actor.agent!==a&&!actor.disposed).map(actor=>{
  const radius=bodyPhysicalProfile(actor.human).bodyRadiusM,threshold=context.radius+radius+.06,distance=horizontal(root,actor.agent.pos);return{actor,threshold,distance,clearance:distance-threshold};
 }).filter(row=>row.distance<2.8);
 let repel=[0,0,0];for(const row of neighbours){let away=sub(root,row.actor.agent.pos);away[1]=0;if(len(away)<1e-6)away=[trafficPairSide(a.npcId,row.actor.id),0,1];repel=add(repel,mul(norm(away),1/Math.max(.15,row.clearance+.38)**2));}
 let radial=sub(root,center);radial[1]=0;if(len(radial)<.06)radial=[trafficPairSide(a.npcId,lease.key),0,1];const radialDirection=norm(radial),tangent=mul(norm([radialDirection[2],0,-radialDirection[0]]),lease.direction);
 const base=ownerFallback?add(repel,mul(radialDirection,.35)):add(add(repel,mul(radialDirection,.70)),mul(tangent,.35)),baseDirection=len(base)>.06?norm(base):radialDirection,baseAngle=Math.atan2(baseDirection[0],baseDirection[2]),currentRadius=horizontal(root,center),angles=[0,.28,-.28,.56,-.56,.88,-.88,1.20,-1.20,Math.PI/2,-Math.PI/2,2,-2,2.5,-2.5,Math.PI],distances=[.08,.12,.16,.24,.34,.46,.62,.82];let best=null;
 for(const distance of distances)for(const delta of angles){const angle=baseAngle+delta,direction=[Math.sin(angle),0,Math.cos(angle)],point=add(root,mul(direction,distance));point[1]=0;const nextRadial=sub(point,center),nextRadius=len(nextRadial),axisAlignment=lease.ownerEntry&&nextRadius>.08?Math.abs(dot(norm(nextRadial),lease.ownerEntry)):0;
  // A new owner can turn the reserved axis underneath an existing member.
  // Permit swept steps that move it progressively out of that cone, rather
  // than requiring one short step to clear the whole cone immediately.
  const axisClear=ownerFallback||!lease.ownerEntry||axisAlignment<.78||axisAlignment<Math.abs(dot(radialDirection,lease.ownerEntry))-.01;
  if(!axisClear||!ownerFallback&&nextRadius<TRAFFIC_INTERSECTION.enterRadiusM+.16||!locomotion.world.free(point,.23)||!trafficSegmentClear(a,root,point,context))continue;
  const minimum=neighbours.length?Math.min(...neighbours.map(row=>horizontal(point,row.actor.agent.pos)-row.threshold)):2,laneError=Math.abs(nextRadius-desiredRadius),outward=nextRadius-currentRadius,tangentProgress=dot(direction,tangent),score=minimum*5-laneError*.72+outward*.22+tangentProgress*.16-distance*.025;
  if(!best||score>best.score)best={point,score};
 }
 if(!best)return null;traffic.intersectionOrbitAngle=Math.atan2(best.point[0]-center[0],best.point[2]-center[2]);traffic.mode=ownerFallback?'intersection-owner-escape':'intersection-circulation';traffic.reason=ownerFallback?'open-intersection-owner-mobile-escape':'open-intersection-mobile-escape';return best.point;
}
function trafficIntersectionOwnerAdvanceTarget(locomotion,lease,context,target){
 const a=locomotion.a,root=locomotion.engine.state.root;let direction=target?sub(target,root):lease.ownerEntry?mul(lease.ownerEntry,-1):[0,0,1];direction[1]=0;if(len(direction)<.08)direction=lease.ownerEntry?mul(lease.ownerEntry,-1):[0,0,1];direction=norm(direction);
 const right=[direction[2],0,-direction[0]],preferred=trafficPairSide(a.npcId,lease.key),laterals=[0,preferred*.22,-preferred*.22,preferred*.36,-preferred*.36,preferred*.52,-preferred*.52];
 for(const forward of [.16,.24,.34,.46,.62,.82])for(const lateral of laterals){
  const point=add(add(root,mul(direction,forward)),mul(right,lateral));point[1]=0;
  if(!locomotion.world.free(point,.23)||!trafficSegmentClear(a,root,point,context))continue;
  return point;
 }
 return null;
}
function trafficMaintainOpenIntersection(locomotion,context,target){
 const a=locomotion.a,population=a.w.population,traffic=locomotion.traffic,key=traffic.intersectionKey;if(!population||!key)return null;
 const runtime=trafficRuntime(population);runtime.intersections??=new Map();trafficPruneIntersections(population,runtime,trafficIntersectionNow(a));const lease=runtime.intersections.get(key),member=lease?.members.get(a.npcId),goal=traffic.slotPoint||member?.goal||traffic.originalTarget||a.route.at(-1);
 if(!lease||!member){trafficIntersectionClearState(traffic);return null;}
 if(traffic.slotPoint)member.goal=[...traffic.slotPoint];
 if(lease.members.size===1){runtime.intersections.delete(lease.key);trafficIntersectionClearState(traffic);if(goal&&!locomotion.normalizeCorridorRoute(context,goal))throw Error('离开交叉区域后无法恢复任务路线');return a.route[a.routeIndex]||null;}
 trafficIntersectionAssignOwner(lease,population,trafficIntersectionNow(a));trafficIntersectionSyncMembers(lease,population);
 if(lease.ownerId!==a.npcId){const orbit=trafficIntersectionOrbitTarget(locomotion,lease,context)||trafficIntersectionMobileEscape(locomotion,lease,context);if(!orbit)throw Error('开放交叉区域没有可用的持续机动路线');return orbit;}
 const root=locomotion.engine.state.root,distance=horizontal(root,lease.center);lease.ownerMinDistance=Math.min(lease.ownerMinDistance,distance);if(distance<=TRAFFIC_INTERSECTION.enterRadiusM)lease.ownerEntered=true;
 const offset=[root[0]-lease.center[0],0,root[2]-lease.center[2]],passed=lease.ownerEntered&&distance>=TRAFFIC_INTERSECTION.releaseRadiusM&&len(offset)>.08&&dot(norm(offset),lease.ownerEntry)<-.12;
 if(passed){lease.members.delete(a.npcId);lease.ownerId=null;if(!lease.members.size)runtime.intersections.delete(lease.key);else{trafficIntersectionAssignOwner(lease,population,trafficIntersectionNow(a));trafficIntersectionSyncMembers(lease,population);}trafficIntersectionClearState(traffic);if(goal&&!locomotion.normalizeCorridorRoute(context,goal))throw Error('穿过交叉区域后无法恢复任务路线');a.log?.('已穿过开放交叉区域并释放通行权');return null;}
 if(trafficIntersectionNow(a)>=lease.expiresAtS){const current=lease.members.get(a.npcId);if(current)current.order=lease.nextOrder++;lease.ownerId=null;lease.rotations++;if(lease.rotations>TRAFFIC_INTERSECTION.maximumRotations)throw Error('开放交叉区域完成 16 次主动轮换后仍未形成可通行顺序');trafficIntersectionAssignOwner(lease,population,trafficIntersectionNow(a));trafficIntersectionSyncMembers(lease,population);traffic.intersectionRotations++;if(lease.ownerId!==a.npcId){a.log?.('开放交叉区域本轮未通过，已继续外侧循环并把通行权交给下一人物');const orbit=trafficIntersectionOrbitTarget(locomotion,lease,context)||trafficIntersectionMobileEscape(locomotion,lease,context);if(!orbit)throw Error('开放交叉区域轮换后没有可用机动路线');return orbit;}}
 traffic.active=false;traffic.mode='intersection-owner';traffic.reason='open-intersection-owner';traffic.intersectionOwner=a.npcId;
 if(target&&locomotion.world.free(target,.23)&&trafficSegmentClear(a,root,target,context)){lease.blockedSinceS=null;return target;}
 const advance=trafficIntersectionOwnerAdvanceTarget(locomotion,lease,context,target);if(advance){lease.blockedSinceS=null;return advance;}
 // A blocked sample is not a completed attempt. Give the current owner time
 // to move away before rotating; subsequent actors in this tick cannot churn.
 const now=trafficIntersectionNow(a);lease.blockedSinceS??=now;
 const current=lease.members.get(a.npcId);if(current&&lease.members.size>1&&now-lease.blockedSinceS>=TRAFFIC_INTERSECTION.blockedRotationS){
  current.order=lease.nextOrder++;lease.ownerId=null;lease.rotations++;if(lease.rotations>TRAFFIC_INTERSECTION.maximumRotations)throw Error('开放交叉区域完成 16 次主动轮换后仍未形成可通行顺序');
  trafficIntersectionAssignOwner(lease,population,trafficIntersectionNow(a));trafficIntersectionSyncMembers(lease,population);traffic.intersectionRotations++;a.log?.('开放交叉区域当前出口受阻，已主动让出通行权并继续外侧机动');
  if(lease.ownerId!==a.npcId){const orbit=trafficIntersectionOrbitTarget(locomotion,lease,context)||trafficIntersectionMobileEscape(locomotion,lease,context);if(!orbit)throw Error('开放交叉区域让出通行权后没有可用的外侧机动路线');return orbit;}
 }
 const orbit=trafficIntersectionOrbitTarget(locomotion,lease,context,{ownerFallback:true})||trafficIntersectionMobileEscape(locomotion,lease,context,{ownerFallback:true});if(!orbit)throw Error('开放交叉区域所有者暂时没有可行的前进或机动路线');return orbit;
}
