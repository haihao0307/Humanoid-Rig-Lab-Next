/* Whole-plan forecast. Only private world/actor/strength data advances here.
 * No Human.pose, live Agent.tick, renderer, geometry generation or world events.
 * The executor shares destinations, floor envelopes and transport clearances.
 * See docs/ACTION_PREFLIGHT_R3.md for scope and references. */
function routeDistance(start,route){let total=0,prev=start;for(const p of route||[]){total+=horizontal(prev,p);prev=p}return total}
function routeEndYaw(start,route,fallback){let prev=start,yaw=fallback;for(const p of route||[]){if(horizontal(prev,p)>.006)yaw=Math.atan2(p[0]-prev[0],p[2]-prev[2]);prev=p}return yaw}
function objectSpan(o){return Math.max(Number(o.w)||Number(o.r)*2||0,Number(o.d)||Number(o.r)*2||0,Number(o.h)||0)}
function objectDirectionalRadius(o,direction){return objectProjectedRadius(o,direction)}
// Keep the live body out of serializable forecast reports and caller overrides.
const reasoningHumans=new WeakMap();
function reasoningHuman(actor){const h=reasoningHumans.get(actor);if(!h)throw Error('推演缺少当前人物的个体体型');return h;}
function bodyPhysicalProfile(h,baseline=PHYSICAL_REASONING_PROFILE){
 const m=h.bodyMetrics,reference=m.reference,reach=r2Mean(s=>m.armReachM[s]),referenceReach=r2Mean(s=>reference.armReachM[s]);
 const span=(m.shoulderWidthM+reach)/(reference.shoulderWidthM+referenceReach),height=m.shoulderHeightM/reference.shoulderHeightM,clearance=m.bodyRadiusM/reference.bodyRadiusM;
 const geometryFactors={maxGripSpanM:span,maxCarryRadiusM:span,maxCarryHeightM:height,maxPushHeightM:height,
  bodyRadiusM:clearance,carryClearanceM:clearance,pushClearanceM:clearance};
 const profile={...baseline,statureScale:m.statureScale,geometryKey:m.geometryKey,carryForwardM:motionCarryForward(h),geometryFactors};
 // Reports may be supplied as an existing profile. Remove their old geometry
 // factors before applying this person's factors, so resolving twice is stable.
 for(const [key,factor]of Object.entries(geometryFactors))profile[key]=(baseline[key]??(key==='maxPushHeightM'?1.35:PHYSICAL_REASONING_PROFILE[key]))/(baseline.geometryFactors?.[key]??baseline.statureScale??1)*factor;
 return profile;
}
function actorForReasoning(agent,override={}){
 const actor={...override,pos:[...(override.pos||override.position||agent.pos)],yaw:override.yaw??agent.yaw,
  posture:override.posture||agent.basic.posture,seat:override.seat||agent.basic.seat&&[...agent.basic.seat]||null,
  heldObject:Object.hasOwn(override,'heldObject')?override.heldObject:agent.held?.id||null,
  environmentFactor:override.environmentFactor??agent.strength.environmentFactor??1,
  strength:override.strength||agent.strength.export(),geometryKey:agent.h.bodyMetrics.geometryKey,statureScale:agent.h.bodyMetrics.statureScale};
 reasoningHumans.set(actor,agent.h);return actor;
}
function relationDirectionForActor(step,actor){const d={left:[-1,0,0],right:[1,0,0],front:[0,0,1],behind:[0,0,-1]}[step?.relation];return d?(step.referenceFrame==='self'?rotate(qy(actor.yaw||0),d):d):null}
function reasoningDestinations(world,actor,step,o,t){
 const candidates=[],directional=relationDirectionForActor(step,actor),radius=objectRadius(o);
 if(directional){for(const gap of[.28,.42,.58]){const p=add(t.p,mul(directional,objectDirectionalRadius(t,directional)+radius+gap));p[1]=o.h/2;candidates.push(p)}}
 else if(t.id.startsWith('Z')){for(const dx of[0,-.38,.38,-.2,.2])for(const dz of[0,-.38,.38,-.2,.2])candidates.push([t.p[0]+dx,o.h/2,t.p[2]+dz])}
 else for(const a of[0,Math.PI/2,Math.PI,-Math.PI/2,Math.PI/4,-Math.PI/4]){const dir=[Math.sin(a),0,Math.cos(a)],distance=radius+objectDirectionalRadius(t,dir)+.25;candidates.push([t.p[0]+dir[0]*distance,o.h/2,t.p[2]+dir[2]*distance])}
 const valid=candidates.filter(p=>!world.collision(p,radius+.045,[o.id])&&(directional||!t.id.startsWith('Z')||world.inside({...o,p,r:radius},t)));
 if(!valid.length)throw Error(directional?'指定侧面没有容纳物体的安全空位':'目标附近没有容纳完整物体的空位');
 return valid;
}
function groundDirection(from,to){const d=[to[0]-from[0],0,to[2]-from[2]];return len(d)<1e-6?[0,0,-1]:norm(d)}
function walkDestination(world,actor,step,t){
 if(step.direction){
  const local={forward:[0,0,1],backward:[0,0,-1],left:[-1,0,0],right:[1,0,0]}[step.direction];
  if(!local||!Number.isFinite(step.distanceM)||step.distanceM<.1||step.distanceM>100||step.referenceFrame!=='self')throw Error('相对行走参数无效');
  const end=add(actor.pos,mul(rotate(qy(actor.yaw),local),step.distanceM));end[1]=0;return end;
 }
 if(!t)throw Error('行走目标已不存在');
 const relation=relationDirectionForActor(step,actor),dir=relation||mul(groundDirection(actor.pos,t.p),-1),standOff=relation?objectDirectionalRadius(t,dir)+.48:t.id.startsWith('Z')?.35:Math.max(.52,objectDirectionalRadius(t,dir)+.38),end=add(t.p,mul(dir,standOff));end[1]=0;return end;
}
function walkRoute(world,actor,step,end,radius){
 if(!step.direction)return world.path(actor.pos,end,radius);
 // A distance command is a straight displacement, resolved at this step's
 // actual starting pose. Never invent a scene object, clamp the distance or
 // silently replace a straight walk by an arbitrarily long detour.
 const count=Math.max(1,Math.ceil(step.distanceM/.05));
 for(let k=1;k<=count;k++)if(world.collision(mix(actor.pos,end,k/count),radius)){
  const free=Math.max(0,(k-1)/count*step.distanceM),direction={forward:'前',backward:'后',left:'左',right:'右'}[step.direction];
  throw Error(`已识别向${direction}走 ${step.distanceM} 米，但约 ${free.toFixed(1)} 米后有障碍或场景边界；请缩短距离或指定可达区域。本轮未执行。`);
 }
 return [[...end]];
}
const motionFloorEnvelopes=new WeakMap();
function floorClipEnvelope(h,id){
 let cache=motionFloorEnvelopes.get(h);if(!cache){cache=new Map();motionFloorEnvelopes.set(h,cache);}if(cache.has(id))return cache.get(id);
 const source=new MotionLab.FullBodyMotion(h.resolvedRig.nodes),clip=r2MotionClips.get(id),m=h.bodyMetrics,legLength=m.rig.femurLengthM+m.rig.tibiaLengthM;
 const bounds=[[Infinity,-Infinity],[Infinity,-Infinity]];
 // Resolve detached skeletons with the same individual lengths and root path
 // as execution. Only the capture's rootOffset is normalized by leg length;
 // arm reach, shoulder width and torso clearance remain independent metrics.
 for(const row of clip.samples){
  const root=[row.rootOffset[0]*legLength,m.restHipHeightM*row.rootHeightRatio,row.rootOffset[2]*legLength];
  const positions=source.positions({root,yaw:0,motion:{frame:row,weight:1}});
  for(const [joint,p]of positions){const radius=motionBodyPartRadius(h,joint);for(const [axis,k]of [[0,0],[1,2]]){bounds[axis][0]=Math.min(bounds[axis][0],p[k]-radius);bounds[axis][1]=Math.max(bounds[axis][1],p[k]+radius);}}
 }
 const envelope={bounds,endOffset:mul(clip.samples.at(-1).rootOffset,legLength)};envelope.endOffset[1]=0;cache.set(id,envelope);return envelope;
}
function floorRoom(h,world,origin,yaw,clips=['standToSit','sitToLie']){
 const base=qy(yaw),margin=.06*h.bodyMetrics.statureScale;let offset=[0,0,0];
 for(const id of clips){
  const {bounds,endOffset}=floorClipEnvelope(h,id),nx=Math.max(1,Math.ceil((bounds[0][1]-bounds[0][0])/margin)),nz=Math.max(1,Math.ceil((bounds[1][1]-bounds[1][0])/margin));
  // The complete planar rectangle and overlapping circles are conservative;
  // this remains a skeletal envelope check, not posed-surface collision QA.
  for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){
   const x=bounds[0][0]+(bounds[0][1]-bounds[0][0])*ix/nx,z=bounds[1][0]+(bounds[1][1]-bounds[1][0])*iz/nz;
   if(world.collision(add(origin,rotate(base,add(offset,[x,0,z]))),margin))return false;
  }
  offset=add(offset,endOffset);
 }return true;
}
function chooseFloorSeat(world,actor,target='lying'){
 const clips=r2PostureClips(actor.posture||'standing',target);
 for(const angle of[0,Math.PI/2,-Math.PI/2,Math.PI]){const yaw=actor.yaw+angle,seat=actor.pos.slice();seat[1]=0;if(floorRoom(reasoningHuman(actor),world,seat,yaw,clips))return{seat,yaw}}
 throw Error('周围没有容纳采集动作范围的净空，请先走到空地');
}
function forecastPosture(world,actor,target){
 if(target===actor.posture)return 0;
 if(actor.heldObject)throw Error('双手持物时不能坐躺，请先完成放置');
 const h=reasoningHuman(actor),from=actor.posture;let seat=actor.seat||[actor.pos[0],0,actor.pos[2]],yaw=actor.yaw;
 if(from==='standing')({seat,yaw}=chooseFloorSeat(world,actor,target));
 else if(!floorRoom(h,world,actor.pos,yaw,r2PostureClips(from,target)))throw Error('身后躺卧范围被占用，请先起身走到空地');
 const angle=Math.abs(angleDiff(yaw,actor.yaw)),turnS=angle/1.1+Math.ceil(angle/.28)*.36;
 actor.seat=[...seat];actor.yaw=yaw;actor.posture=target;
 const clips=r2PostureClips(from,target);actor.pos=r2PostureEnd(h,actor.pos,yaw,clips);
 if(target==='standing'){actor.pos[1]=motionStandingHipHeight(h);if(world.collision(actor.pos,bodyPhysicalProfile(h).bodyRadiusM))throw Error('起身后的站位被占用');}
 return turnS+clips.reduce((sum,id)=>sum+R2_MOTION.clips[id].durationS,0)+(target==='standing'?.4:0);

}
function carryRouteRadius(o,profile=PHYSICAL_REASONING_PROFILE,configuration=null){return Math.max(profile.carryClearanceM,(configuration?.forwardM??profile.carryForwardM??.34)+objectRadius(o)+.025)}
function routeClearance(world,start,route,r,ignore=[]){let min=Infinity,prev=start;for(const end of route||[]){const n=Math.max(1,Math.ceil(horizontal(prev,end)/.07));for(let k=0;k<=n;k++){const p=mix(prev,end,k/n);min=Math.min(min,p[0]-world.bounds.xMin-r,world.bounds.xMax-p[0]-r,p[2]-world.bounds.zMin-r,world.bounds.zMax-p[2]-r);for(const o of world.objects){if(ignore.includes(o.id)||o.collidable===false)continue;min=Math.min(min,pointToObjectClearance(p,o)-r-.06)}}prev=end}return Number.isFinite(min)?min:9}
function blockingObjects(world,start,end,r,ignore=[]){const ids=new Set(),n=Math.max(2,Math.ceil(horizontal(start,end)/.06));for(let k=0;k<=n;k++)for(const o of world.objects){if(!ignore.includes(o.id)&&o.collidable!==false&&pointToObjectClearance(mix(start,end,k/n),o)<r+.06)ids.add(o.id)}return[...ids]}
function straightPushRoute(world,o,dest,bodyStart,profile=PHYSICAL_REASONING_PROFILE){
 const delta=sub(dest,o.p),bodyEnd=add(bodyStart,[delta[0],0,delta[2]]),n=Math.max(1,Math.ceil(horizontal(o.p,dest)/.04));
 for(let k=0;k<=n;k++){
  if(world.collision(mix(o.p,dest,k/n),objectRadius(o)+.05,[o.id]))throw Error('直线推动路线被阻挡；当前推动技能不能绕障转弯');
  if(world.collision(mix(bodyStart,bodyEnd,k/n),profile.pushClearanceM,[o.id]))throw Error('推动时人物经过的位置净空不足');
 }
 return bodyEnd;
}
function planObjectTransfer(world,actor,step,o,target,profile,capacity,postureDurationS=0){
 return navigationQueryBatch(world,()=>planObjectTransferInSnapshot(world,actor,step,o,target,profile,capacity,postureDurationS));
}
function planObjectTransferInSnapshot(world,actor,step,o,target,profile,capacity,postureDurationS=0){
 return motionDrainPreflight(planObjectTransferInSnapshotSteps(world,actor,step,o,target,profile,capacity,postureDurationS));
}
function* planObjectTransferSteps(world,actor,step,o,target,profile,capacity,postureDurationS=0){
 return yield* navigationQueryBatchSteps(world,()=>planObjectTransferInSnapshotSteps(world,actor,step,o,target,profile,capacity,postureDurationS));
}
function transferApproachDirections(actor,step,o,destination){
 const preferred=step.type==='push'?groundDirection(o.p,destination):groundDirection(actor.pos,o.p);
 if(step.type==='push')return[preferred];
 const fallback=[0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI*3/4,-Math.PI*3/4,Math.PI].map(offset=>rotate(qy(offset),preferred));
 if(o.shape!=='box')return fallback;
 // Face-centred pickup avoids corner-sensitive contacts. Prefer facing the
 // delivery direction, rather than immediately reversing with a held box.
 // These are candidates only: all route, contact and strength checks remain.
 const exit=groundDirection(o.p,destination),faces=[[0,0,1],[1,0,0],[0,0,-1],[-1,0,0]].map(axis=>groundDirection([0,0,0],rotate(o.q,axis)));
 faces.sort((a,b)=>dot(b,exit)-dot(a,exit));
 const result=[];for(const direction of [...faces,...fallback])if(!result.some(other=>horizontal(other,direction)<1e-6))result.push(direction);
 return result;
}
function* planObjectTransferInSnapshotSteps(world,actor,step,o,target,profile,capacity,postureDurationS=0){
 const h=reasoningHuman(actor),landings=reasoningDestinations(world,actor,step,o,target),failures=[],approaches=new Map();
 // A reachable object may be beside a wall or shelf. A single approach ray
 // from the actor can put the grasp stance inside that obstacle. Search the
 // same checked grasp from a finite set of sides before rejecting the task.
 // A push retains its required straight line behind the object.
 const candidates=landings.flatMap(destination=>transferApproachDirections(actor,step,o,destination).flatMap(direction=>(step.type==='push'?[0]:[0,-.02,.02,.04,.06,.08]).map(approachExtra=>({destination,direction,approachExtra}))));
 // A landing is accepted only with its approach, loaded route and strength.
 // Failed candidates leave the actor, world and capacity unchanged.
 for(const {destination,direction,approachExtra} of candidates){
  yield {stage:'transport-candidate'};
  try{
   // Push palms contact the rear surface, not the centre. For a one-metre
   // cart, a centre-only 0.46 m standoff put the actor inside the cart before
   // grasping; owner contact filtering then hid that overlap until release.
   const approachYaw=Math.atan2(direction[0],direction[2]),key=JSON.stringify([direction,approachExtra]);
   let entry=approaches.get(key);
   if(!entry){
    entry={};approaches.set(key,entry);
    try{
     const rearReach=rayBoundary(o,rotate(inv(o.q),mul(direction,-1)));
     entry.end=add(o.p,mul(direction,-(motionApproachDistance(h)+rearReach+approachExtra)));entry.end[1]=0;
     entry.route=world.path(actor.pos,entry.end,profile.bodyRadiusM,[o.id]);entry.distance=routeDistance(actor.pos,entry.route);
     entry.grip=graspFrames(o,approachYaw,step.type==='push');
     entry.hands=Object.fromEntries(['left','right'].map(side=>[side,compose(frame(o.p,o.q),entry.grip[side])]));
    }catch(error){entry.error=error;}
   }
   if(entry.error)throw entry.error;
   const approachEnd=entry.end,approach=entry.route,approachD=entry.distance,grip=entry.grip,hands=entry.hands;
   let bodyEnd,bodyYaw,transferD,durationS,transfer,radius,finalQ;
   if(step.type==='carry'){
    // Ground placement needs the same knee clearance as ground pickup. The
    // carried object remains closer to the torso, then moves forward during
    // the validated lowering interpolation instead of landing at the knees.
    const fd=groundDirection(approachEnd,destination);bodyYaw=Math.atan2(fd[0],fd[2]);
    finalQ=qm(qy(bodyYaw),qm(inv(qy(approachYaw)),o.q));
    const rear=rayBoundary(o,rotate(inv(finalQ),mul(fd,-1)));bodyEnd=add(destination,mul(fd,-(motionApproachDistance(h)+rear+approachExtra)));bodyEnd[1]=0;
    // The final route radius can only be larger than this fixed lower bound.
    // An occupied endpoint is therefore a conclusive cheap rejection. Do not
    // treat a failed smaller-radius heuristic path search as a proof instead.
    if(world.collision(bodyEnd,profile.carryClearanceM,[o.id]))throw Error('搬运终点的人物站位被占用');
    if(!Object.hasOwn(entry,'configuration')){
     try{entry.configuration=world.physics?.bodyObjectClearance?yield* motionChooseCarryConfigurationSteps(h,o,grip,qm(inv(qy(approachYaw)),o.q),world):null;}
     catch(error){entry.error=error;throw error;}
    }
    radius=carryRouteRadius(o,profile,entry.configuration);
    transfer=world.path(approachEnd,bodyEnd,radius,[o.id]);transferD=routeDistance(approachEnd,transfer);
    durationS=postureDurationS+approachD/(profile.nominalWalkMps*capacity.movementFactor())+transferD/(profile.nominalCarryMps*capacity.movementFactor())+8.7;
   }else{
    bodyEnd=straightPushRoute(world,o,destination,approachEnd,profile);bodyYaw=Math.atan2(direction[0],direction[2]);transferD=horizontal(o.p,destination);
    durationS=postureDurationS+approachD/(profile.nominalWalkMps*capacity.movementFactor())+transferD/profile.nominalPushMps+4.5;
   }
   const strength=capacity.assess(strengthTaskRequest(step.type,o,{durationS,...strengthWorldParameters(world)}));if(!strength.feasible)throw Error(strengthReason(strength));
   // Only a route/strength-feasible candidate warrants the dense fixed-bone
   // contact checks. Pickup is identical across this call's landings; keep its
   // result (including a failure) locally, never across mutable world states.
   if(!Object.hasOwn(entry,'pickup')){
    try{entry.pickup=yield* motionChooseContactSteps(h,approachEnd,approachYaw,hands,world,[o.id],{objectPose:frame(o.p,o.q),grips:step.type==='carry'?grip:null,carryConfiguration:entry.configuration});}
    catch(error){entry.error=error;throw error;}
   }
   const pickupContact=entry.pickup;
   let minClearanceM=routeClearance(world,actor.pos,approach,profile.bodyRadiusM,[o.id]);
   if(step.type==='carry'){
    const finalHands=Object.fromEntries(['left','right'].map(side=>[side,compose(frame(destination,finalQ),grip[side])]));
    yield* motionChooseContactSteps(h,bodyEnd,bodyYaw,finalHands,world,[o.id],{objectPose:frame(destination,finalQ),grips:grip,carryConfiguration:pickupContact.carryConfiguration});
    minClearanceM=Math.min(minClearanceM,routeClearance(world,approachEnd,transfer,radius,[o.id]));
   }else minClearanceM=Math.min(minClearanceM,routeClearance(world,o.p,[destination],objectRadius(o)+.05,[o.id]),routeClearance(world,approachEnd,[bodyEnd],profile.pushClearanceM,[o.id]));
   return{destination:[...destination],approachDirection:direction,approach,bodyEnd,bodyYaw,carryConfiguration:pickupContact.carryConfiguration||null,routeLengthM:approachD+transferD,transferDistanceM:transferD,durationS,minClearanceM,strength,rejectedCandidates:failures.length};
  }catch(error){failures.push(error.message)}
 }
 throw Error(`已检查 ${candidates.length} 组落点和接近姿态，接近路线、运输空间或持续力量均未通过：${[...new Set(failures)].slice(0,3).join('；')}`);
}
function physicalAnalyzeStep(world,actorInput,step,profile=PHYSICAL_REASONING_PROFILE,strengthModel=null){
 return motionDrainPreflight(physicalAnalyzeStepSteps(world,actorInput,step,profile,strengthModel,false));
}
function* physicalAnalyzeStepSteps(world,actorInput,step,profile=PHYSICAL_REASONING_PROFILE,strengthModel=null,cooperative=true){
 r2RequireMotion(step.type);
 const h=reasoningHuman(actorInput);profile=bodyPhysicalProfile(h,profile);
 const capacity=strengthModel||(actorInput.strength?StrengthModel.fromSnapshot(actorInput.strength):new StrengthModel());capacity.environmentFactor=actorInput.environmentFactor??capacity.environmentFactor??1;
 const actor={...actorInput,pos:[...(actorInput.pos||actorInput.position)],posture:actorInput.posture||'standing',yaw:actorInput.yaw||0},facts=[],reasons=[],alternatives=[];
 reasoningHumans.set(actor,h);
 const est={routeLengthM:0,predictedDurationS:0,minClearanceM:null,effortScore:0};let strengthAssessment=null,transport=null;
 const effects={bodyPosition:[...actor.pos],bodyYaw:actor.yaw,posture:actor.posture,seat:actor.seat||null,heldObject:actor.heldObject||null,objectUpdates:[]};
 const syncActor=()=>Object.assign(effects,{bodyPosition:[...actor.pos],bodyYaw:actor.yaw,posture:actor.posture,seat:actor.seat||null});
 const result=()=>({schema:'knowledge_human/physical_reasoning@1.0',profile,strength:strengthAssessment,transport,step:JSON.parse(JSON.stringify(step)),feasible:!reasons.length,reasons,facts,alternatives,estimates:est,predictedEffects:effects});
 try{
  if(['sit','lie','stand','greet','wave','salute'].includes(step.type)){
   if(['sit','lie','stand'].includes(step.type))est.predictedDurationS=forecastPosture(world,actor,{sit:'sitting',lie:'lying',stand:'standing'}[step.type]);
   else{if(actor.heldObject)throw Error('当前保持抓握，不能开始独立手势');if(actor.posture!=='standing')est.predictedDurationS+=forecastPosture(world,actor,'standing');est.predictedDurationS+=clamp(Number(step.duration)||(step.type==='salute'?R2_SALUTE_STANDARD.defaultDurationS:R2_MOTION.clips.wave.durationS),1.2,20)}
   syncActor();facts.push('坐躺使用与执行器相同的地面包络和站位规则');return result();
  }
  if(step.type==='wait'||step.type==='observe'){est.predictedDurationS=step.type==='wait'?Number(step.duration)||0:0;return result()}
  if(actor.heldObject)throw Error('当前步骤起点仍有未放下的物体：'+actor.heldObject);
  if(actor.posture!=='standing'){est.predictedDurationS+=forecastPosture(world,actor,'standing');facts.push('已推演自动起身后的站位');syncActor()}
  if(step.type==='turn'){
   const yaw=motionTurnYaw(step,actor.yaw),angle=Math.abs(step.angleDeg!=null?radians(step.angleDeg):angleDiff(yaw,actor.yaw));
   if(world.collision(actor.pos,profile.bodyRadiusM+.04))throw Error('当前站位缺少换脚转向的净空');
   effects.bodyYaw=yaw;est.predictedDurationS+=angle/1.1+Math.ceil(angle/.28)*.36+.4;
   facts.push('使用实验室换脚转向，完成后传递朝向');return result();
  }
  const target=world.get(step.targetId);if(!target&&!(step.type==='walk'&&step.direction))throw Error('目标不存在：'+step.targetId);
  if(step.type==='walk'){
   const end=walkDestination(world,actor,step,target),route=walkRoute(world,actor,step,end,profile.bodyRadiusM);
   est.routeLengthM=routeDistance(actor.pos,route);est.minClearanceM=routeClearance(world,actor.pos,route,profile.bodyRadiusM);
   est.predictedDurationS+=est.routeLengthM/(profile.nominalWalkMps*capacity.movementFactor())+Math.max(0,route.length-1)*.35+.6;
   effects.bodyPosition=[end[0],motionStandingHipHeight(h),end[2]];effects.bodyYaw=routeEndYaw(actor.pos,route,actor.yaw);effects.posture='standing';
   facts.push(`找到 ${route.length} 段可达路线，已传递终点和朝向`);return result();
  }
  if(!['carry','push'].includes(step.type))throw Error('物理推演器不认识该语义步骤：'+step.type);
  const o=world.objects.find(x=>x.id===step.objectId);if(!o)throw Error('操作物体不存在：'+step.objectId);
  if(o.movable===false)throw Error(o.name+'被定义为固定环境');
  if(o.p[1]-o.h/2>.025)throw Error('当前抓取只支持地面物体，尚不能从台面拿起 '+o.id);
  const span=objectSpan(o),mass=o.mass,parameters=strengthWorldParameters(world),carryStrength=capacity.assess(strengthTaskRequest('carry',o,parameters)),pushStrength=capacity.assess(strengthTaskRequest('push',o,parameters));
  const carryable=carryStrength.feasible&&span<=profile.maxGripSpanM&&o.r<=profile.maxCarryRadiusM&&o.h<=profile.maxCarryHeightM,pushable=pushStrength.feasible&&o.h<=profile.maxPushHeightM;
  strengthAssessment=step.type==='carry'?carryStrength:pushStrength;
  facts.push(`物体 ${o.id} 质量 ${mass.toFixed(1)} kg，最大包络 ${span.toFixed(2)} m`);
  if(step.type==='carry'&&!carryable){if(pushable)alternatives.push({type:'push',step:{...step,type:'push'},reason:'需另行检查直线推动路径'});throw Error(!carryStrength.feasible?strengthReason(carryStrength):'尺寸超过当前双手抓握或携带范围')}
  if(step.type==='push'&&!pushable){if(carryable)alternatives.push({type:'carry',step:{...step,type:'carry'},reason:'需另行检查搬运路径'});throw Error(!pushStrength.feasible?strengthReason(pushStrength):'物体形态不适合当前地面推动')}
   transport=cooperative?yield* planObjectTransferSteps(world,actor,step,o,target,profile,capacity,est.predictedDurationS):planObjectTransfer(world,actor,step,o,target,profile,capacity,est.predictedDurationS);
   const dest=transport.destination,dir=transport.approachDirection;
   effects.bodyPosition=[transport.bodyEnd[0],motionStandingHipHeight(h),transport.bodyEnd[2]];effects.bodyYaw=transport.bodyYaw;
   est.minClearanceM=transport.minClearanceM;est.predictedDurationS=transport.durationS;est.routeLengthM=transport.routeLengthM;est.effortScore=mass*Math.max(.25,transport.transferDistanceM)*(step.type==='carry'?1:.35);
  const objectQ=step.type==='carry'?qm(qy(effects.bodyYaw),qm(inv(qy(Math.atan2(dir[0],dir[2]))),o.q)):o.q;
   effects.objectUpdates=[{id:o.id,p:[...dest],q:[...objectQ],held:false}];effects.heldObject=null;effects.posture='standing';strengthAssessment=transport.strength;
   if(transport.rejectedCandidates)facts.push(`已跳过 ${transport.rejectedCandidates} 个运输不可行的候选落点`);
  facts.push('目标落点、接近路线、运输包络和持续力量通过估算');
 }catch(error){if(cooperative&&error.code==='PREFLIGHT_WORLD_CHANGED')throw error;reasons.push(error.message);if(step.targetId){const t=world.get(step.targetId);if(t)alternatives.push({type:'clear_path',blockerIds:blockingObjects(world,actor.pos,t.p,profile.bodyRadiusM,[step.objectId]),reason:'调整站位、目标或障碍后重新推演'})}}
 return result();
}
function reasoningWorldClone(world,seed=null){
 const w=Object.assign(Object.create(Object.getPrototypeOf(world)),world,seed||{});w.physics=null;
 w.bounds={...(seed?.bounds||world.bounds)};w.objects=(seed?.objects||world.objects).map(o=>({...o,p:[...o.p],q:o.q?[...o.q]:qy(o.yaw||0)}));w.zones=(seed?.zones||world.zones).map(z=>({...z,p:[...z.p]}));return w;
}
function forecastPredicate(p,world,actor){
 let value;const entities=[...world.objects,...world.zones];
 if(p.type==='exists')value=p.ids.some(id=>entities.some(e=>e.id===id));
 else if(p.type==='inside'){const o=world.get(p.objectId),t=world.get(p.targetId);if(!o||!t)value=false;else{const dx=Math.abs(o.p[0]-t.p[0]),dz=Math.abs(o.p[2]-t.p[2]),r=o.r||0;value=t.shape==='square'?dx+r<=t.r&&dz+r<=t.r:Math.hypot(dx,dz)+r<=t.r*(t.shape==='hexagon'?Math.cos(Math.PI/6):1)}}
 else if(p.type==='movable')value=!!world.objects.find(o=>o.id===p.objectId&&o.movable!==false);
 else if(p.type==='posture')value=actor.posture===p.value;
 else throw Error('无法预判的条件：'+p.type);
 return p.negate?!value:value;
}
function forecastStepLabel(step){return({walk:'行走',carry:'搬运',push:'推动',sit:'坐下',lie:'躺下',stand:'起身',greet:'打招呼',wave:'挥手',salute:'敬礼',wait:'等待',observe:'观察',joint_pose:'关节动作',condition:'条件判断'}[step?.type]||step?.type||'条件判断')+(step?.targetId?' → '+step.targetId:'')}
function simulateSemanticPlan(world,agent,plan,actorOverride={}){
 return motionDrainPreflight(simulateSemanticPlanSteps(world,agent,plan,actorOverride,false));
}
function* simulateSemanticPlanSteps(world,agent,plan,actorOverride={},cooperative=true){
 const seed=plan?.initialForecast,sim=reasoningWorldClone(world,seed?.predictedWorld),actor=actorForReasoning(agent,seed?.predictedActor||actorOverride),capacity=StrengthModel.fromSnapshot(actor.strength);
 capacity.environmentFactor=actor.environmentFactor;actor.forecast=true;
 const analyses=[],reasons=[],branches=[],selectedNodeIds=[];let failedStep=null,totalCost=0,totalDuration=0,minClearance=Infinity,visited=0;
 const fail=(node,message)=>{failedStep={nodeId:node?.id||null,stepNumber:analyses.length+1,type:node?.step?.type||'condition',reasons:[message]};reasons.push(`第 ${failedStep.stepNumber} 步（${forecastStepLabel(node?.step)}）：${message}`)};
 const visit=function*(nodes,depth=0){
  if(depth>12)throw Error('条件嵌套过深');
  for(const node of nodes){if(reasons.length)return;if(++visited>256)throw Error('计划节点过多');
   if(cooperative)yield {stage:'semantic-step',nodeId:node.id};
   if(node.kind==='condition'){try{const value=forecastPredicate(node.predicate,sim,actor);branches.push({nodeId:node.id,label:node.label,value});yield* visit(value?node.then:node.else,depth+1)}catch(error){fail(node,error.message)}continue}
   const step=node.step;if(!step){fail(node,'缺少动作定义');return}
   let a;try{a=step.type==='joint_pose'?window.HumanLab?.jointControl?.analyze(step,actor):cooperative?yield* physicalAnalyzeStepSteps(sim,actor,step,PHYSICAL_REASONING_PROFILE,capacity):physicalAnalyzeStep(sim,actor,step,PHYSICAL_REASONING_PROFILE,capacity)}catch(error){fail(node,error.message);return}
   if(!a){fail(node,'当前身体缺少此步骤的推演器');return}
   a.nodeId=node.id;a.stepNumber=analyses.length+1;analyses.push(a);selectedNodeIds.push(node.id);
   if(!a.feasible){failedStep={nodeId:node.id,stepNumber:a.stepNumber,type:step.type,objectId:step.objectId||null,targetId:step.targetId||null,reasons:a.reasons};reasons.push(`第 ${a.stepNumber} 步（${forecastStepLabel(step)}）：${a.reasons.join('；')}`);return}
   const duration=Math.max(0,a.estimates.predictedDurationS||0);if(!Number.isFinite(duration)||duration>7200){failedStep={nodeId:node.id,stepNumber:a.stepNumber,type:step.type,reasons:['预计耗时超过推演范围']};reasons.push(`第 ${a.stepNumber} 步预计耗时超过两小时`);return}
   if(a.strength)capacity.project(a.strength,duration);
   else if(step.type==='wait'||step.type==='observe')capacity.recover(duration);
   else for(let remaining=duration;remaining>0;remaining-=1){const dt=Math.min(1,remaining);capacity.advance(dt,capacity.activityAssessment(step.type==='walk'?'walk':'basic',step.type==='walk'?PHYSICAL_REASONING_PROFILE.nominalWalkMps:0))}
   actor.strength=capacity.export();totalCost+=a.estimates.routeLengthM+a.estimates.effortScore*.04;totalDuration+=duration;minClearance=Math.min(minClearance,a.estimates.minClearanceM??Infinity);
   const e=a.predictedEffects;actor.pos=[...e.bodyPosition];actor.yaw=e.bodyYaw;actor.posture=e.posture;actor.seat=e.seat||actor.seat;actor.heldObject=e.heldObject??null;
   if(step.type==='joint_pose'){actor.jointAngles={...(actor.jointAngles||{}),...(e.jointAngles||{})};actor.jointQuaternions={...(actor.jointQuaternions||{}),...(e.jointQuaternions||{})}}
   else if(!['wait','observe'].includes(step.type)){actor.jointAngles={};actor.jointQuaternions={};actor.jointAnglesUncertain=true}
   for(const u of e.objectUpdates||[]){const o=sim.get(u.id);if(o){o.p=[...u.p];if(u.q){o.q=[...u.q];o.yaw=2*Math.atan2(o.q[1],o.q[3])}o.held=false;sim.revision++}}
  }
 };
 try{if(seed?.predictedActor?.geometryKey&&seed.predictedActor.geometryKey!==agent.h.bodyMetrics.geometryKey)throw Error('队列预测使用的人物体型已改变，请重新推演');if(seed&&seed.predictedWorld?.sceneId!==world.sceneId)throw Error('队列预测所属场景已改变');const nodes=plan?.nodes||(plan?.steps||[]).map((step,i)=>({kind:'action',id:'step_'+(i+1),step}));if(!nodes.length)throw Error('没有可推演的步骤');yield* visit(nodes)}catch(error){if(!reasons.length)fail(null,error.message)}
 return{schema:'knowledge_human/physical_plan_simulation@1.1',profile:bodyPhysicalProfile(agent.h),feasible:!reasons.length,complete:!reasons.length,reasons,failedStep,analyses,branches,selectedNodeIds,score:totalCost,totalDurationS:totalDuration,minClearanceM:Number.isFinite(minClearance)?minClearance:null,predictedWorld:sim.snapshot(),predictedActor:actor,predictedStrength:capacity.export(),basis:seed?'preceding_task_forecast':'current_world',worldRevision:world.revision,sceneId:world.sceneId,kinematicForecast:true,fullDynamicsValidated:false};
}
