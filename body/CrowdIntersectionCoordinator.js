/* Open intersections are coordinated as one shared traffic resource.
 * A single actor crosses while all other members keep moving on deterministic
 * outside lanes. This module does not own tasks, bodies, poses or step timing. */
const TRAFFIC_INTERSECTION=Object.freeze({clusterRadiusM:2.7,mergeRadiusM:1.20,enterRadiusM:.72,releaseRadiusM:1.08,ownerLeaseS:10,maximumRotations:16,baseOrbitM:1.08,laneGapM:.24});
function trafficIntersectionKey(center){return'intersection:'+Math.round(center[0]*2)/2+','+Math.round(center[2]*2)/2;}
function trafficIntersectionActive(actor){
 const a=actor?.agent;return!!a&&!actor.disposed&&!a.paused&&!a.error&&a.skill?.type==='walk'&&Array.isArray(a.route)&&a.routeIndex<a.route.length;
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
 Object.assign(traffic,{intersectionKey:null,intersectionTaskKey:null,intersectionOwner:null,intersectionCenter:null,intersectionOrbitDirection:0,intersectionOrbitLane:-1,intersectionOrbitAngle:null,intersectionClaims:traffic.intersectionClaims||0,intersectionYields:traffic.intersectionYields||0,intersectionLaps:traffic.intersectionLaps||0,intersectionRotations:traffic.intersectionRotations||0});
}
function trafficIntersectionAssignOwner(lease,population,now){
 if(lease.ownerId&&lease.members.has(lease.ownerId))return lease.ownerId;
 const live=new Map([...population.values()].filter(trafficIntersectionActive).map(actor=>[actor.id,actor]));
 const candidates=[...lease.members.entries()].map(([id,member])=>({id,member,actor:live.get(id)})).filter(row=>row.actor&&trafficTaskKey(row.actor.agent)===row.member.taskKey).sort((a,b)=>a.member.order-b.member.order||a.member.joinedAtS-b.member.joinedAtS||String(a.id).localeCompare(String(b.id)));
 if(!candidates.length){lease.ownerId=null;return null;}
 const chosen=candidates[0],root=chosen.actor.agent.locomotion?.engine?.state?.root||chosen.actor.agent.pos,offset=[root[0]-lease.center[0],0,root[2]-lease.center[2]];
 lease.ownerId=chosen.id;lease.ownerEntry=len(offset)>.08?norm(offset):[0,0,1];lease.ownerEntered=false;lease.ownerMinDistance=horizontal(root,lease.center);lease.expiresAtS=now+TRAFFIC_INTERSECTION.ownerLeaseS;
 return lease.ownerId;
}
function trafficIntersectionSyncMembers(lease,population){
 const ordered=[...lease.members.keys()].sort();
 for(const actor of population.values()){
  const member=lease.members.get(actor.id),locomotion=actor.agent?.locomotion;if(!member||!locomotion?.traffic)continue;
  const traffic=locomotion.traffic,owner=lease.ownerId,first=traffic.intersectionKey!==lease.key||traffic.intersectionOwner!==owner,lane=ordered.filter(id=>id!==owner).indexOf(actor.id);
  Object.assign(traffic,{intersectionKey:lease.key,intersectionTaskKey:member.taskKey,intersectionOwner:owner,intersectionCenter:[...lease.center],intersectionOrbitDirection:lease.direction,intersectionOrbitLane:lane,originalTarget:[...member.goal]});
  if(actor.id===owner){traffic.mode='intersection-owner';traffic.reason='open-intersection-owner';if(first)traffic.intersectionClaims++;}
  else{traffic.active=true;traffic.mode='intersection-circulation';traffic.reason='open-intersection-circulation';if(first)traffic.intersectionYields++;}
 }
}
function trafficPruneIntersections(population,runtime,now){
 if(!runtime?.intersections)return;
 const live=new Map([...population.values()].filter(trafficIntersectionActive).map(actor=>[actor.id,actor]));
 for(const [key,lease]of runtime.intersections){
  for(const [id,member]of lease.members){const actor=live.get(id);if(!actor||trafficTaskKey(actor.agent)!==member.taskKey)lease.members.delete(id);}
  if(!lease.members.size){runtime.intersections.delete(key);continue;}
  if(!lease.members.has(lease.ownerId))lease.ownerId=null;
  trafficIntersectionAssignOwner(lease,population,now);trafficIntersectionSyncMembers(lease,population);
 }
}
function trafficReleaseIntersection(locomotion,{completed=false}={}){
 const a=locomotion.a,population=a.w.population,traffic=locomotion.traffic,key=traffic?.intersectionKey;
 if(key&&population){const runtime=trafficRuntime(population),lease=runtime?.intersections?.get(key);if(lease){lease.members.delete(a.npcId);if(lease.ownerId===a.npcId)lease.ownerId=null;if(!lease.members.size)runtime.intersections.delete(key);else{trafficIntersectionAssignOwner(lease,population,a.time);trafficIntersectionSyncMembers(lease,population);}}}
 if(traffic){if(completed)traffic.intersectionLaps+=0;trafficIntersectionClearState(traffic);}
}
function trafficResolveOpenIntersection(locomotion,conflict,context){
 const a=locomotion.a,population=a.w.population,other=conflict?.actor,target=a.route?.[a.routeIndex];if(!population||!other||!target)return null;
 const root=locomotion.engine.state.root,ownDirection=trafficIntersectionDirection({agent:a}),otherDirection=trafficIntersectionDirection(other);if(!ownDirection||!otherDirection||dot(ownDirection,otherDirection)>.68)return null;
 if(trafficCorridorDescriptor(a,root,target,context))return null;
 const center=mix(conflict.selfPoint||root,conflict.otherPoint||other.agent.pos,.5),candidates=trafficIntersectionCandidates(a,center);if(candidates.length<3)return null;
 const runtime=trafficRuntime(population);runtime.intersections??=new Map();trafficPruneIntersections(population,runtime,a.time);
 let lease=[...runtime.intersections.values()].find(row=>horizontal(row.center,center)<=TRAFFIC_INTERSECTION.mergeRadiusM);
 if(!lease){const key=trafficIntersectionKey(center);lease={key,center:[center[0],0,center[2]],direction:trafficHash(key)&1?1:-1,ownerId:null,ownerEntry:null,ownerEntered:false,ownerMinDistance:Infinity,expiresAtS:a.time+TRAFFIC_INTERSECTION.ownerLeaseS,rotations:0,nextOrder:0,members:new Map()};runtime.intersections.set(key,lease);}
 for(const actor of candidates){const member=lease.members.get(actor.id),goal=actor.agent.locomotion?.traffic?.slotPoint||actor.agent.route.at(-1);if(!goal)continue;if(member){member.goal=[...goal];continue;}lease.members.set(actor.id,{taskKey:trafficTaskKey(actor.agent),goal:[...goal],joinedAtS:a.time,order:lease.nextOrder++});}
 trafficIntersectionAssignOwner(lease,population,a.time);trafficIntersectionSyncMembers(lease,population);return lease;
}
function trafficIntersectionOrbitTarget(locomotion,lease,context,{ownerFallback=false}={}){
 const a=locomotion.a,traffic=locomotion.traffic,root=locomotion.engine.state.root,center=lease.center,waiting=[...lease.members.keys()].filter(id=>id!==lease.ownerId).sort(),lane=ownerFallback?0:Math.max(0,waiting.indexOf(a.npcId)),radius=TRAFFIC_INTERSECTION.baseOrbitM+lane*TRAFFIC_INTERSECTION.laneGapM+(ownerFallback?.12:0),offset=[root[0]-center[0],0,root[2]-center[2]],distance=len(offset);
 let angle=distance>.06?Math.atan2(offset[0],offset[2]):((trafficHash(String(a.npcId||''))%360)/180*Math.PI),base=angle;
 const candidates=[];
 if(distance<radius-.10||distance>radius+.42)candidates.push([center[0]+Math.sin(angle)*radius,0,center[2]+Math.cos(angle)*radius]);
 for(const step of [.28,.42,.58,.76,1.0])for(const radial of [radius,radius+.16,Math.max(.92,radius-.12)]){const next=base+lease.direction*step;candidates.push([center[0]+Math.sin(next)*radial,0,center[2]+Math.cos(next)*radial]);}
 for(const point of candidates){if(!locomotion.world.free(point,.23)||!trafficSegmentClear(a,root,point,context))continue;const nextAngle=Math.atan2(point[0]-center[0],point[2]-center[2]);if(Number.isFinite(traffic.intersectionOrbitAngle)){const delta=angleDiff(nextAngle,traffic.intersectionOrbitAngle)*lease.direction;if(delta<-.8)traffic.intersectionLaps++;}traffic.intersectionOrbitAngle=nextAngle;return point;}
 return null;
}
function trafficMaintainOpenIntersection(locomotion,context,target){
 const a=locomotion.a,population=a.w.population,traffic=locomotion.traffic,key=traffic.intersectionKey;if(!population||!key)return null;
 const runtime=trafficRuntime(population);runtime.intersections??=new Map();trafficPruneIntersections(population,runtime,a.time);const lease=runtime.intersections.get(key),member=lease?.members.get(a.npcId),goal=member?.goal||traffic.slotPoint||traffic.originalTarget||a.route.at(-1);
 if(!lease||!member){trafficIntersectionClearState(traffic);return null;}
 trafficIntersectionAssignOwner(lease,population,a.time);trafficIntersectionSyncMembers(lease,population);
 if(lease.ownerId!==a.npcId){const orbit=trafficIntersectionOrbitTarget(locomotion,lease,context);if(!orbit)throw Error('开放交叉区域没有可用的持续循环路线');return orbit;}
 const root=locomotion.engine.state.root,distance=horizontal(root,lease.center);lease.ownerMinDistance=Math.min(lease.ownerMinDistance,distance);if(distance<=TRAFFIC_INTERSECTION.enterRadiusM)lease.ownerEntered=true;
 const offset=[root[0]-lease.center[0],0,root[2]-lease.center[2]],passed=lease.ownerEntered&&distance>=TRAFFIC_INTERSECTION.releaseRadiusM&&len(offset)>.08&&dot(norm(offset),lease.ownerEntry)<-.12;
 if(passed){lease.members.delete(a.npcId);lease.ownerId=null;trafficIntersectionAssignOwner(lease,population,a.time);trafficIntersectionSyncMembers(lease,population);trafficIntersectionClearState(traffic);if(goal)locomotion.normalizeCorridorRoute(context,goal);a.log?.('已穿过开放交叉区域并释放通行权');return null;}
 if(a.time>=lease.expiresAtS){const current=lease.members.get(a.npcId);if(current)current.order=lease.nextOrder++;lease.ownerId=null;lease.rotations++;if(lease.rotations>TRAFFIC_INTERSECTION.maximumRotations)throw Error('开放交叉区域完成 16 次主动轮换后仍未形成可通行顺序');trafficIntersectionAssignOwner(lease,population,a.time);trafficIntersectionSyncMembers(lease,population);traffic.intersectionRotations++;if(lease.ownerId!==a.npcId){a.log?.('开放交叉区域本轮未通过，已继续外侧循环并把通行权交给下一人物');const orbit=trafficIntersectionOrbitTarget(locomotion,lease,context);if(!orbit)throw Error('开放交叉区域轮换后没有可用循环路线');return orbit;}}
 traffic.active=false;traffic.mode='intersection-owner';traffic.reason='open-intersection-owner';traffic.intersectionOwner=a.npcId;
 if(target&&locomotion.world.free(target,.23)&&trafficSegmentClear(a,root,target,context))return target;
 const advance=target&&locomotion.corridorAdvanceTarget(target,context);if(advance)return advance;
 const orbit=trafficIntersectionOrbitTarget(locomotion,lease,context,{ownerFallback:true});if(!orbit)throw Error('开放交叉区域所有者暂时没有可行的前进或循环路线');return orbit;
}
