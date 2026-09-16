/* Skin adapter for the pinned Human-Motion-Lab R2.2 core.
 * The lab's committed state is authoritative. Renderers never solve a pose.
 * Additional reference/contact actions use the SAME pose builder and commit.
 */
class MotionLabPose {
 constructor(human,engine){
  this.h=human;this.engine=engine;this.lastReport=null;
  this.rows=Object.entries(human.resolvedRig.nodes);this.regionCounts={};
  for(const [,n]of this.rows)if(n.region)this.regionCounts[n.region]=(this.regionCounts[n.region]||0)+1;
  this.descendantRows=new Map();
  for(const side of ['left','right'])for(const part of ['hand','foot']){
   const active=new Set([side+'_'+part]),rows=[];
   for(const [id,n]of this.rows)if(active.has(n.parent)){active.add(id);rows.push([id,n.parent,sub(n.positionM,human.resolvedRig.nodes[n.parent].positionM)]);}
   this.descendantRows.set(side+'_'+part,rows);
  }
  // Immutable bind offsets make it possible to check the skinning pivots,
  // independently of the already checked lengths, without per-step arrays.
  this.attachments=this.rows.filter(([,n])=>n.parent).map(([id,n])=>{
   const parent=human.sourceBind.get(n.parent);
   return {id,parent:n.parent,length:dist(n.positionM,parent.p),local:rotate(inv(parent.q),sub(n.positionM,parent.p))};
  });
 }
 source(id){return this.h.resolvedRig.nodes[id].positionM;}
 forPreflight(){
  // Omitted leaves have no motion channel: toes/ribs follow one
  // already checked parent rigid transform. Keep all channel-bearing nodes,
  // every IK pivot and every ancestor, including the anatomical palm basis.
  // This projection cannot commit a rendered pose.
  if(this.preflightOnly)return this;
  const h=this.h,nodes=h.resolvedRig.nodes,keep=new Set(['hips','head','neck',h.spine?.at(-1)?.id].filter(id=>nodes[id]));
  for(const [id,n]of this.rows)if(n.region||/_(?:metacarpal_|finger_)/.test(id))keep.add(id);
  for(const side of ['left','right'])for(const part of ['SC','AC','upperArm','forearm','radiusRotation','hand','finger_2_1','finger_3_1','finger_5_1','femur','tibia','patella','foot'])keep.add(side+'_'+part);
  for(const id of [...keep]){let n=nodes[id];if(!n)throw Error('预检骨架缺少控制点：'+id);while(n.parent){keep.add(n.parent);n=nodes[n.parent];}}
  // A full-hierarchy witness checks the source bind attachments before using
  // rigid-transform invariance for the unanimated descendant edges.
  this.validate(this.build({reference:this.engine.motion.neutral,controlledFeet:true}));
  const projectedNodes=Object.fromEntries(this.rows.filter(([id])=>keep.has(id))),human={...h,resolvedRig:{...h.resolvedRig,nodes:projectedNodes},joints:h.joints.filter(j=>keep.has(j.id))};
  const engine=Object.create(this.engine);engine.motion=new MotionLab.FullBodyMotion(projectedNodes);
  const pose=new MotionLabPose(human,engine);pose.preflightOnly=true;pose.sourceHuman=this.sourceHuman||h;
  pose.rigidBranchProof={fullJoints:this.rows.length,checkedJoints:keep.size,rigidEdges:this.rows.length-keep.size,method:'unchanneled-rigid-descendants/v1'};
  return pose;
 }
 regionalRotation(q,count){
  // FullBodyMotion.positions distributes each regional channel with nlerp.
  // Using slerp only for skin frames gives the same joint two different axes.
  const t=1/count,sign=q[3]<0?-1:1;
  return qnorm([q[0]*t*sign,q[1]*t*sign,q[2]*t*sign,1-t+q[3]*t*sign]);
 }
 controlledPelvisRotation(state,rotation,yaw){
  // The locomotion solver owns the hip centres as well as the foot anchors.
  // Preserve captured twist about their axis, but do not rotate pelvis skin
  // away from the hip centres that this same candidate is about to commit.
  const sourceAxis=norm(sub(this.source('right_femur'),this.source('left_femur')));
  const targetAxis=norm(sub(state.pose.legs.right.root,state.pose.legs.left.root));
  const world=qm(qy(yaw),rotation);
  return qnorm(qm(inv(qy(yaw)),qm(fromTo(rotate(world,sourceAxis),targetAxis),world)));
 }
 solveControlledState(state,data){
  if(!state.articulatedPelvis)return this.engine.solve(state);
  // A recorded pelvis is a rigid body, not a horizontal bar. Rotate the real
  // source hip offsets first, then solve each fixed-length leg to its contact.
  // Keep the navigation proxy separate from the complete committed skeleton.
  const world=qm(qy(state.yaw),data.rootQ),offsets={},legs={};let ceiling=Infinity;
  for(const side of ['left','right']){
   const offset=rotate(world,sub(this.source(side+'_femur'),this.source('hips')));offsets[side]=offset;
   const hip=add(state.root,offset),foot=state.feet[side].position,{upper,lower}=this.engine.rig.legs[side];
   const horizontal2=(hip[0]-foot[0])**2+(hip[2]-foot[2])**2,reach=upper+lower-.0005*this.h.bodyMetrics.statureScale;
   ceiling=Math.min(ceiling,foot[1]+Math.sqrt(Math.max(0,reach*reach-horizontal2))-offset[1]);
  }
  state.root[1]=Math.min(state.root[1],ceiling);
  for(const side of ['left','right']){
   const hip=add(state.root,offsets[side]),pole=add(hip,rotate(world,[0,-.2,1])),{upper,lower}=this.engine.rig.legs[side];
   legs[side]=MotionLab.solveTwoBone(hip,state.feet[side].position,pole,upper,lower);
  }
  return{root:[...state.root],yaw:state.yaw,legs};
 }
 radialRotation(side,positions,palm){
  // Radius/ulna twist at the elbow. Wrist flexion belongs to the hand pivot:
  // using palm directly here rotates the distal forearm away from the wrist.
  const rest=norm(sub(this.source(side+'_hand'),this.source(side+'_forearm')));
  const direction=norm(sub(positions.get(side+'_hand'),positions.get(side+'_forearm')));
  return qm(fromTo(rotate(palm,rest),direction),palm);
 }
 descendants(positions,rotations,id,rotation){
  rotations.set(id,rotation);
  for(const [child,parent,offset]of this.descendantRows.get(id)){
   positions.set(child,add(positions.get(parent),rotate(rotation,offset)));
   rotations.set(child,rotation);
  }
 }
 refreshEffectorErrors(frames,errors){
  for(const error of errors){
   const f=frames.get(error.id);
   if(!f||error.target?.length!==3||!error.target.every(Number.isFinite)||!['world','body'].includes(error.targetSpace))throw Error('动作候选包含无效接触目标');
   const actual=add(f.p,rotate(f.q,error.effectorLocal||[0,0,0]));
   error.error=dist(actual,error.target);error.orientationErrorRad=error.targetOrientation?qangle(f.q,error.targetOrientation):0;
   if(!Number.isFinite(error.error)||!Number.isFinite(error.orientationErrorRad))throw Error('动作候选接触误差无效');
  }
 }
 controlledFootOrientation(state,side){
  const foot=state.feet[side],bind=this.h.sourceBind.get(side+'_foot').q;
  if(!foot.adoptedOrientation)return qm(qy(foot.yaw),qm(qx(foot.rocker?.pitch??(foot.contact?0:foot.swingPitch||0)),bind));
  const swing=state.swing;
  if(swing?.side!==side)return [...foot.adoptedOrientation];
  const u=smooth(clamp(swing.elapsed/Math.max(1e-8,swing.duration),0,1));
  return qslerp(foot.adoptedOrientation,qm(qy(swing.yaw),bind),u);
 }
 reprojectControlledLegs(frames,state,yaw,from,target,u){
  const h=this.h,positions=new Map([...frames].map(([id,f])=>[id,[...f.p]]));
  for(const side of ['left','right']){
   const femur=side+'_femur',tibia=side+'_tibia',foot=side+'_foot',patella=side+'_patella';
   const hip=positions.get(femur),pole=mix(from.get(tibia).p,target.get(tibia).p,u);
   const L1=dist(this.source(femur),this.source(tibia)),L2=dist(this.source(tibia),this.source(foot));
   const solved=MotionLab.solveTwoBone(hip,state.feet[side].position,pole,L1,L2);
   positions.set(tibia,solved.knee);positions.set(foot,solved.end);
   const alignFinal=(id,child,preferred)=>{
    const bind=h.sourceBind.get(id),sourceDirection=norm(sub(this.source(child),this.source(id)));
    const localDirection=rotate(inv(bind.q),sourceDirection),currentDirection=rotate(preferred.q,localDirection);
    const desiredDirection=norm(sub(positions.get(child),positions.get(id)));
    return qnorm(qm(fromTo(currentDirection,desiredDirection),preferred.q));
   };
   const previousFemur=frames.get(femur),previousTibia=frames.get(tibia),previousPatella=frames.get(patella);
   const femurFrame=frame(hip,alignFinal(femur,tibia,previousFemur));
   const tibiaFrame=frame(solved.knee,alignFinal(tibia,foot,previousTibia));
   const footFrame=frame(solved.end,state.feet[side].adoptedOrientation?this.controlledFootOrientation(state,side):qslerp(from.get(foot).q,target.get(foot).q,u));
   frames.set(femur,femurFrame);frames.set(tibia,tibiaFrame);frames.set(foot,footFrame);
   // Preserve the already blended patella's local transform. Rebuilding it
   // from the bind frame on the first contact-preserving sample caused an
   // otherwise stationary kneecap to jump before the preparation began.
   if(previousPatella)frames.set(patella,compose(tibiaFrame,compose(inverse(previousTibia),previousPatella)));
   const footRigid=compose(footFrame,inverse(h.sourceBind.get(foot)));
   for(const [child]of this.descendantRows.get(foot))frames.set(child,compose(footRigid,h.sourceBind.get(child)));
  }
 }
 segmentRotation(a,b,positions,yaw,preferred=null){
  const h=this.h,source=h.sourceBind.get(a),direction=norm(sub(positions.get(b),positions.get(a)));
  if(preferred){
   const world=qm(qy(yaw),preferred),aligned=qm(fromTo(rotate(world,DOWN),direction),world);
   return qm(aligned,inv(source.q));
  }
  // Preserve body yaw even when a vertical limb direction cannot encode twist.
  const base=qy(yaw),u=rotate(base,norm(sub(this.source(b),this.source(a))));
  return qm(fromTo(u,direction),base);
 }
 frameData(state,reference){return reference||MotionLab.blend(this.engine.motion.neutral,state.motion.frame||this.engine.motion.neutral,state.motion.weight);}
 prepare(options){
  const e=this.engine,reference=options.reference||null;
  const state=structuredClone(e.state),yaw=options.yaw??state.yaw;
  state.yaw=yaw;if(options.position)state.root=[...options.position];
  if(options.feet)for(const side of ['left','right']){
   const input=options.feet[side],position=input?.p||input?.position;
   if(!position||position.length!==3||!position.every(Number.isFinite))throw Error('支撑转换缺少有效脚锚：'+side);
   const footYaw=Number.isFinite(input.yaw)?input.yaw:yaw;
   state.feet[side]={...state.feet[side],position:[...position],yaw:footYaw,contact:true};
   delete state.feet[side].rocker;
   // Explicit support anchors (including seated preparation) own the whole
   // sole frame. Flattening it around a fixed ankle drives toes into ground.
   if(input.q)state.feet[side].adoptedOrientation=[...input.q];
  }
  if(reference)state.motion={...state.motion,frame:reference,weight:1};
  const controlled=!reference||options.controlledFeet===true;
  const rockerFeet=controlled&&!options.feet&&Object.values(state.feet).some(foot=>foot.rocker);
  if(rockerFeet&&!options.position)state.root=add(state.root,rotate(qy(yaw),[state.pelvisSupportXM||0,state.pelvisSupportLiftM||0,0]));
  if(rockerFeet)for(const foot of Object.values(state.feet))if(foot.rocker&&!foot.adoptedOrientation)foot.position=[...foot.rocker.ankle];
  if(controlled&&(options.position||options.feet||rockerFeet)){
   // Contact extensions lower the pelvis, then use the lab's fixed-length IK
   // against its independent foot anchors. They never scale a bone.
   state.pose=e.solve(state);
  }
  let data=this.frameData(state,reference);
  if(controlled){
   // Only the production free-gait mode opts into articulated hip centres.
   // Raw kernel clients without a support mode retain their existing contract.
   state.articulatedPelvis=!reference&&!options.position&&!options.feet&&!options.hands&&state.flatFootSupport===false&&!Object.values(state.feet).some(foot=>foot.adoptedOrientation);
   if(state.articulatedPelvis)state.pose=this.solveControlledState(state,data);
   else data={...data,rootQ:this.controlledPelvisRotation(state,data.rootQ,yaw)};
   state.motion={...state.motion,frame:data,weight:1};
  }
  return{state,yaw,controlled,data};
 }
 reachShoulders(options){
  if(!this.preflightOnly)throw Error('肩部投影只用于预检');
  const {state}=this.prepare(options),positions=this.engine.motion.positions(state);
  return new Map(['left','right'].map(side=>[side+'_upperArm',{p:positions.get(side+'_upperArm')}]));
 }
 build(options={}){
  const h=this.h,e=this.engine,reference=options.reference||null;
  if(options.lockedFrames)return {frames:new Map([...options.lockedFrames].map(([id,f])=>[id,frame(f.p,f.q)])),errors:[],controlled:false,
   source:options.motionSource,state:structuredClone(e.state)};
  const {state,yaw,controlled,data}=this.prepare(options);
  const positions=e.motion.positions(state),rotations=new Map();
  const counts=this.regionCounts;
  for(const [id,n]of this.rows){
   let q=n.parent?rotations.get(n.parent):qm(qy(yaw),data.rootQ);
   if(n.region)q=qm(q,this.regionalRotation(data[{L:'lumbarQ',T:'thoraxQ',C:'cervicalQ'}[n.region]],counts[n.region]));
   if(id==='head')q=qm(q,data.headQ);
   const side=id.startsWith('left_')?'left':id.startsWith('right_')?'right':null;
   if(side&&id===side+'_SC')q=qm(q,data[side+'ClavicleQ']);
   rotations.set(id,q);
  }
  if(controlled){
   e.motion.applyControlledLegs(positions,state);
  }
  const errors=[];
  for(const side of ['left','right']){
   for(const [a,b,key]of [['upperArm','forearm','UpperArm'],['forearm','hand','Forearm'],['femur','tibia','Thigh'],['tibia','foot','Shank']]){
    if(options.hands?.[side]&&(a==='upperArm'||a==='forearm'))continue;
    const id=side+'_'+a,preferred=reference&&(!controlled||a==='upperArm'||a==='forearm')?data[side+key+'Q']:null;
    rotations.set(id,this.segmentRotation(id,side+'_'+b,positions,yaw,preferred));
   }
   const hand=side+'_hand',radius=side+'_radiusRotation',foot=side+'_foot';
   if(!options.hands?.[side]){
    const inward=rotate(data.rootQ,[side==='left'?1:-1,0,0]);
    const palm=reference&&data[side+'HandQ']?qm(qy(yaw),qm(data[side+'HandQ'],inv(h.sourceBind.get(hand).q))):
     qm(qy(yaw),MotionLab.relaxedHandRotation(h.resolvedRig.nodes,side,data[side+'Forearm'],inward));
    rotations.set(radius,this.radialRotation(side,positions,palm));this.descendants(positions,rotations,hand,palm);
   }
   const footQ=controlled?qm(this.controlledFootOrientation(state,side),inv(h.sourceBind.get(foot).q)):data[side+'FootQ']?qm(qy(yaw),qm(data[side+'FootQ'],inv(h.sourceBind.get(foot).q))):rotations.get(side+'_tibia');
   this.descendants(positions,rotations,foot,footQ);
   const patella=side+'_patella',shank=rotations.get(side+'_tibia');
   positions.set(patella,add(positions.get(side+'_tibia'),rotate(shank,sub(this.source(patella),this.source(side+'_tibia')))));rotations.set(patella,shank);
   if(controlled)errors.push({id:foot,error:dist(positions.get(foot),state.feet[side].position),target:[...state.feet[side].position],targetSpace:'world',effectorLocal:[0,0,0],targetOrientation:this.controlledFootOrientation(state,side),orientationErrorRad:0});
   const rocker=state.feet[side].rocker;
   if(controlled&&state.feet[side].contact&&rocker&&rocker.pitch){
    const local=rotate(inv(h.sourceBind.get(foot).q),rocker.pivot),orientation=this.controlledFootOrientation(state,side);
    errors.push({id:foot,kind:rocker.kind+'-support',target:[...rocker.world],targetSpace:'world',effectorLocal:local,
     error:dist(add(positions.get(foot),rotate(orientation,local)),rocker.world),targetOrientation:orientation,orientationErrorRad:0});
   }
  }
  if(options.hands)for(const side of ['left','right']){
   const goal=options.hands[side];if(!goal)continue;
   const arm=h.arms[side],upper=side+'_upperArm',forearm=side+'_forearm',hand=side+'_hand',radial=side+'_radiusRotation';
   const start=positions.get(upper),target=sub(goal.p,rotate(goal.q,h.bodyMetrics.palmContact));
   const reachRatio=h.bodyMetrics.armReachM[side]/h.bodyMetrics.reference.armReachM[side];
   const pole=options.armPoles?.[side]||add(start,rotate(qy(yaw),mul([arm.s*(options.armPoleLateralM??.30),-.35,-.10],reachRatio)));
   const solved=MotionLab.solveTwoBone(start,target,pole,arm.L1,arm.L2);
   positions.set(forearm,solved.knee);positions.set(radial,solved.knee);positions.set(hand,solved.end);
   rotations.set(upper,this.segmentRotation(upper,forearm,positions,yaw));
   rotations.set(forearm,this.segmentRotation(forearm,hand,positions,yaw));
   const palm=qm(goal.q,inv(h.sourceBind.get(hand).q));rotations.set(radial,this.radialRotation(side,positions,palm));this.descendants(positions,rotations,hand,palm);
   errors.push({id:hand,error:solved.residual,target:[...goal.p],targetSpace:goal.space||'world',effectorLocal:[...h.bodyMetrics.palmContact],targetOrientation:[...goal.q],orientationErrorRad:0});
  }
  let frames=new Map();
  for(const [id,n]of this.rows)frames.set(id,frame(positions.get(id),qnorm(qm(rotations.get(id),h.sourceBind.get(id).q))));
  if(options.contactHand)frames=contactHandPose(h,frames,options.contactHand);
  if(options.blendFrom&&options.blendAmount<1){
   const target=frames,blended=new Map(),u=clamp(options.blendAmount,0,1),from=options.blendFrom;
   for(const [id,n]of this.rows){
    const a=from.get(id),b=target.get(id),ap=n.parent&&from.get(n.parent),bp=n.parent&&target.get(n.parent);
    const A=ap?compose(inverse(ap),a):a,B=bp?compose(inverse(bp),b):b;
    const length=n.parent?dist(n.positionM,this.source(n.parent)):null;
    let p=mix(A.p,B.p,u);if(length!==null)p=length<1e-9?[0,0,0]:mul(norm(p),length);
    const local=frame(p,qslerp(A.q,B.q,u));blended.set(id,n.parent?compose(blended.get(n.parent),local):local);
   }
   frames=blended;
   // A visual blend is not permission to drop contact evidence. Re-solve the
   // controlled legs against their existing world anchors, then measure the
   // same errors that will be validated after floor clearance.
   if(controlled&&options.preserveFootContactsOnBlend!==false)this.reprojectControlledLegs(frames,state,yaw,from,target,u);
   this.refreshEffectorErrors(frames,errors);
  }
  return {frames,errors,controlled,source:options.motionSource||{kind:'motion-lab',revision:MotionLab.revision,trial:'08_01'},state};
 }
 validate(candidate){
  let boneErrorM=0,radialAttachmentErrorM=0,attachmentErrorM=0,attachmentJoint=null;
  if(candidate.frames.size!==this.h.joints.length||this.h.joints.some(j=>!candidate.frames.has(j.id)))throw Error('动作候选未包含完整的同源关节集合');
  for(const [id,f]of candidate.frames){
   if(f.p?.length!==3||f.q?.length!==4||!f.p.every(Number.isFinite)||!f.q.every(Number.isFinite)||Math.abs(len(f.q)-1)>1e-5)throw Error('动作候选包含无效变换：'+id);
  }
  for(const {id,parent,length}of this.attachments)boneErrorM=Math.max(boneErrorM,Math.abs(dist(candidate.frames.get(id).p,candidate.frames.get(parent).p)-length));
  if(candidate.frames.size!==this.h.joints.length||boneErrorM>.0001)throw Error('动作候选未保持完整骨架与固定骨长');
  // A fixed bone length does not prove that its deformation reaches its child.
  // Check every attachment, including torso/clavicle and pelvis/hip seams.
  for(const {id,parent,local:[vx,vy,vz]}of this.attachments){
   const f=candidate.frames.get(parent),child=candidate.frames.get(id),[x,y,z,w]=f.q;
   const tx=2*(y*vz-z*vy),ty=2*(z*vx-x*vz),tz=2*(x*vy-y*vx);
   const error=Math.hypot(f.p[0]+vx+w*tx+y*tz-z*ty-child.p[0],f.p[1]+vy+w*ty+z*tx-x*tz-child.p[1],f.p[2]+vz+w*tz+x*ty-y*tx-child.p[2]);
   if(error>attachmentErrorM){attachmentErrorM=error;attachmentJoint=id;}
   if(parent.endsWith('_radiusRotation')&&id.endsWith('_hand'))radialAttachmentErrorM=Math.max(radialAttachmentErrorM,error);
  }
  if(radialAttachmentErrorM>.0001)throw Error('前臂蒙皮轴未连接到手腕，姿态未提交');
  if(attachmentErrorM>.0001)throw Error('蒙皮变换未连接到子关节：'+attachmentJoint+'，姿态未提交');
  const ranges=r2CaptureConstraintProfile(this.h,candidate.source);let hingeReserveDegrees=Infinity;
  for(const side of ['left','right'])for(const [a,b,c,limit]of [['upperArm','forearm','hand',170],['femur','tibia','foot',160]]){
   const p=id=>candidate.frames.get(side+'_'+id).p;
   const angle=degrees(Math.acos(clamp(dot(norm(sub(p(b),p(a))),norm(sub(p(c),p(b)))),-1,1)));
   const maximum=candidate.controlled&&b==='tibia'?limit:ranges?.hingeDegrees[side+'_'+b]??limit;
   hingeReserveDegrees=Math.min(hingeReserveDegrees,maximum+.5-angle);
   if(angle>maximum+.5)throw Error('关节弯曲超过动作来源或接触适配范围：'+side+'_'+b);
  }
  const footErrorM=Math.max(0,...candidate.errors.filter(e=>/_foot$/.test(e.id)).map(e=>e.error));
  if(footErrorM>.012)throw Error('落脚目标超出可达范围，姿态未提交');
  const handErrorM=Math.max(0,...candidate.errors.filter(e=>/_hand$/.test(e.id)).map(e=>e.error));
  if(handErrorM>.012)throw Error('手掌目标超出可达范围，姿态未提交');
  return {boneErrorM,radialAttachmentErrorM,attachmentErrorM,attachmentJoint,footErrorM,handErrorM,hingeReserveDegrees,kinematicOnly:true};
 }
 measureEffectors(candidate){
  this.refreshEffectorErrors(candidate.frames,candidate.errors);
 }
 resolveGroundClearance(candidate,options){
  let ground=null,groundCorrectionM=0;
  if(!options.groundClearance)return{ground,groundCorrectionM};
  const anchored=candidate.controlled&&!options.hands;let previous=null;
  // These non-airborne floor clips have a different source body height.
  // Fit their retargeted support surface in BOTH directions. Clearance-only
  // lifting allowed an entire crouched/seated body to hover above the floor.
  // Explicit world contacts always retain ownership of height instead.
  const fitFloor=options.groundSupport==='continuous-floor'&&options.floorMode&&
   !candidate.controlled&&!options.hands&&candidate.source?.kind==='capture'&&
   !candidate.errors.some(error=>error.targetSpace==='world');
  for(let pass=0;pass<(anchored?8:1);pass++){
   ground=this.h.minimumBoneY(candidate.frames);
   if(!Number.isFinite(ground.y))throw Error('动作候选缺少有效支撑采样');
   let correction=fitFloor?.0005-ground.y:Math.max(0,.0005-ground.y);
   if(Math.abs(correction)<1e-7)return{ground,groundCorrectionM};
   // A planted shin can rise much less than the pelvis. Estimate that local
   // response only while the same support probe is limiting the pose; keep
   // the accelerated step small and re-query the actual surface afterwards.
   if(anchored&&previous&&previous.boneId===ground.boneId){
    const response=(ground.y-previous.y)/previous.correction;
    if(response>.02&&response<.8)correction=Math.min(.025,correction/response*1.05);
   }
   previous={y:ground.y,boneId:ground.boneId,correction};
   const before=anchored?new Map([...candidate.frames].map(([id,f])=>[id,frame([...f.p],[...f.q])])):null;
   for(const f of candidate.frames.values())f.p[1]+=correction;
   for(const error of candidate.errors)if(error.targetSpace==='body')error.target[1]+=correction;
   // Raise the pelvis/body out of the floor, then bend the fixed-length legs
   // back to the existing world contacts. Translating the feet as well made
   // a valid seated support fail the contact gate during preparation.
   if(anchored)this.reprojectControlledLegs(candidate.frames,candidate.state,candidate.state.yaw,before,before,1);
   groundCorrectionM+=correction;
  }
  ground=this.h.minimumBoneY(candidate.frames);
  if(!Number.isFinite(ground.y)||ground.y<.0005-1e-6)throw Error('地面净空与脚掌支撑无法同时满足：'+ground.boneId+' '+(ground.y*1000).toFixed(3)+' mm，姿态未提交');
  return{ground,groundCorrectionM};
 }
 apply(options={}){
  if(this.preflightOnly)throw Error('预检骨架不能提交人物姿态');
  const h=this.h,candidate=this.build(options);this.validate(candidate);
  // Floor queries read candidate frames. Failure cannot partially change the
  // live skeleton, even when this adapter is called outside Agent.tickFixed.
  const {ground,groundCorrectionM}=this.resolveGroundClearance(candidate,options);
  this.measureEffectors(candidate);const report=this.validate(candidate);
  const localFrames=h.joints.map(j=>{const f=candidate.frames.get(j.id),parent=j.parent&&candidate.frames.get(j.parent.id);return parent?compose(inverse(parent),f):frame(f.p,f.q);});
  for(let i=0;i<h.joints.length;i++){const j=h.joints[i],f=localFrames[i];j.p=f.p;j.q=f.q;}
  h.fk();h.lastErrors=candidate.errors;h.lastMotionSource=candidate.source;h.phase=options.floorMode?'floor':options.hands?'manipulation':this.engine.state.status;
  this.lastReport={...report,ground,groundCorrectionM,source:candidate.source,contactHand:options.contactHand?{...options.contactHand,measuredMotion:false}:null,poseAuthority:'MotionLabPose.commit',completeHierarchy:true,validatedAfterClearance:true,worldContactTargetsPreserved:true,measuredSoftTissue:false,visualAcceptance:false};
  return h.lastErrors;
 }
 report(){return this.lastReport||{poseAuthority:'MotionLabPose.commit',visualAcceptance:false};}
 snapshot(){const h=this.h;return structuredClone({joints:h.joints.map(j=>({p:j.p,q:j.q})),errors:h.lastErrors,source:h.lastMotionSource,phase:h.phase,report:this.lastReport});}
 restore(saved){const h=this.h;
  for(let i=0;i<h.joints.length;i++){h.joints[i].p=[...saved.joints[i].p];h.joints[i].q=[...saved.joints[i].q];}
  h.lastErrors=structuredClone(saved.errors);h.lastMotionSource=structuredClone(saved.source);h.phase=saved.phase;this.lastReport=structuredClone(saved.report);h.fk();
 }
}
