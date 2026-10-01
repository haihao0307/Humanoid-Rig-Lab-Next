import * as THREE from 'three';
import {MOVEMENT} from './CharacterController.mjs';
import {supportAt} from './game-world.mjs';
import {JUMP_STYLES,DEFAULT_JUMP_STYLE,sampleJumpPose,timeToContact} from './JumpProfiles.mjs';
import {NATURAL_RUN} from './NaturalRunData.mjs';
const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion(),clamp=THREE.MathUtils.clamp;
const smooth=x=>{x=clamp(x,0,1);return x*x*x*(10+x*(-15+6*x));};
function rotationVector(q){if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);const n=Math.hypot(q.x,q.y,q.z),angle=2*Math.atan2(n,q.w);return V().set(q.x,q.y,q.z).multiplyScalar(n>1e-8?angle/n:2);}
function rotationQuaternion(v){const angle=v.length();return angle>1e-8?Q().setFromAxisAngle(v.clone().divideScalar(angle),angle):Q();}
// A small procedural pose layer, never a sampled surface or a second model.
// Joint axes are expressed in the character's canonical metre/Y-up frame.
export class GameAnimator {
 constructor(subject,actor){
  this.subject=subject;this.actor=actor;this.poseWeight=0;this.turnLean=0;this.pelvisOffset=0;this.idleTime=0;this.idleBlend=0;this.jumpStyle=DEFAULT_JUMP_STYLE;this.activeJumpStyle=DEFAULT_JUMP_STYLE;this.lastPhase='idle';this.leadSign=1;this.contactWeight=0;this.wasJumping=false;
  this.neutral=new Map(subject.neutral.map(r=>[r.o.name,r]));
  this.basePose=new Map(subject.neutral.map(r=>[r.o.name,{q:r.q.clone(),p:r.p.clone()}]));
  this.visualPose=new Map(subject.neutral.map(r=>[r.o.name,{q:r.q.clone(),p:r.p.clone(),velocity:V(),positionVelocity:V()}]));
  this.axes=new Map();this.ankles=new Map();
  for(const r of subject.neutral){const parentMatrix=subject.bindWorld.get(r.o.parent)||r.o.parent.matrixWorld;const inverse=Q().setFromRotationMatrix(parentMatrix.clone().extractRotation(parentMatrix)).invert();this.axes.set(r.o.name,{x:V().set(1,0,0).applyQuaternion(inverse),y:V().set(0,1,0).applyQuaternion(inverse),z:V().set(0,0,1).applyQuaternion(inverse)});}
  for(const side of ['l','r'])this.ankles.set(side,V().setFromMatrixPosition(subject.bindWorld.get(subject.byName.get('foot_'+side))));
  this.lastFeet=new Map([...this.ankles].map(([side,p])=>[side,p.clone()]));this.prepareFeet=new Map([...this.lastFeet].map(([side,p])=>[side,p.clone()]));this.landingFeet=new Map([...this.lastFeet].map(([side,p])=>[side,p.clone()]));
  this.runHands=new Map();
  this.runPhase=0;this.groundFeet=new Map();this.groundReport=[];
  this.legLength=['l','r'].reduce((sum,side)=>{const p=n=>V().setFromMatrixPosition(subject.bindWorld.get(subject.byName.get(n+'_'+side)));return sum+p('thigh').distanceTo(p('calf'))+p('calf').distanceTo(p('foot'));},0)/2;
  this.bindPelvisHeight=V().setFromMatrixPosition(subject.bindWorld.get(subject.byName.get('pelvis'))).y;
  for(const side of ['l','r']){
   const position=n=>V().setFromMatrixPosition(subject.bindWorld.get(subject.byName.get(n+'_'+side))),long=position('middle_01').sub(position('hand')).normalize(),width=position('index_01').sub(position('pinky_01')).normalize(),normal=long.clone().cross(width).normalize(),sign=side==='l'?1:-1;
   if(normal.x*sign>0)normal.negate();
   const curls=[];
   for(const finger of ['index','middle','ring','pinky'])for(let joint=1;joint<=3;joint++){
    const name=finger+'_0'+joint+'_'+side,bone=subject.byName.get(name),child=subject.byName.get(finger+'_0'+(joint+1)+'_'+side),origin=V().setFromMatrixPosition(subject.bindWorld.get(bone)),direction=child?V().setFromMatrixPosition(subject.bindWorld.get(child)).sub(origin):origin.sub(V().setFromMatrixPosition(subject.bindWorld.get(bone.parent))),parent=subject.bindWorld.get(bone.parent),axis=direction.normalize().cross(normal).normalize().applyQuaternion(Q().setFromRotationMatrix(parent.clone().extractRotation(parent)).invert());
    curls.push({bone,q:Q().setFromAxisAngle(axis,[.38,.55,.30][joint-1]).multiply(this.neutral.get(name).q)});
   }
   this.runHands.set(side,{normal,curls});
  }
 }
 setJumpStyle(id){if(!JUMP_STYLES.some(s=>s.id===id))throw Error('Unknown jump style '+id);this.jumpStyle=id;}
 rotate(name,axis,angle,weight=1,fromNeutral=false){const bone=this.subject.byName.get(name);if(!bone)return;const q=Q().setFromAxisAngle(this.axes.get(name)[axis],angle);if(fromNeutral){q.multiply(this.neutral.get(name).q);bone.quaternion.slerp(q,weight);}else bone.quaternion.premultiply(q);}
 update(c,dt){
  if(dt<=0){this.subject.root.updateMatrixWorld(true);this.subject.skeleton.update();return;}
  const s=this.subject,still=c.grounded&&c.phase==='idle'&&c.speed<.08&&(!c.keys||c.keys.size===0);
  this.idleTime=still?this.idleTime+dt:0;const idleTarget=this.idleTime>=2.8?1:0;this.idleBlend+=(idleTarget-this.idleBlend)*(1-Math.exp(-dt*(idleTarget?6:18)));
  s.locomotion(c.grounded?c.speed:Math.min(c.speed,1.8),dt,this.idleBlend);s.step(dt);
  const jumping=['anticipation','takeoff','flight','fall','landing'].includes(c.phase),targetWeight=c.phase==='landing'?1-smooth((c.phaseTime-.07)/(MOVEMENT.landingDuration-.07)):jumping?1:0;
  this.poseWeight+=(targetWeight-this.poseWeight)*(1-Math.exp(-dt*22));
  const w=this.poseWeight;
  const newJump=jumping&&((c.phase==='anticipation'&&this.lastPhase!=='anticipation')||(c.jumpCount!==this.lastJumpCount&&this.lastPhase!=='anticipation')||!this.wasJumping);
  if(newJump){this.activeJumpStyle=this.jumpStyle;this.leadSign=this.lastFeet.get('l').z>=this.lastFeet.get('r').z?1:-1;for(const side of ['l','r'])this.prepareFeet.get(side).copy(this.lastFeet.get(side));}
  const floor=supportAt(c.x,c.z,c.y,c.world).height,pose=sampleJumpPose(this.activeJumpStyle,c,MOVEMENT,c.y-floor),drop=pose.drop;
  if(w>.0001){
   for(const r of s.neutral){const base=this.basePose.get(r.o.name);base.q.copy(r.o.quaternion);base.p.copy(r.o.position);r.o.quaternion.copy(r.q);r.o.position.copy(r.p);}
   for(const side of ['l','r']){
    const sourceSide=this.activeJumpStyle==='cmu-running'&&this.leadSign<0?(side==='l'?'r':'l'):side,hip=pose['hip_'+sourceSide],knee=pose['knee_'+sourceSide],arm=pose['arm_'+sourceSide];
    this.rotate('thigh_'+side,'x',-hip,1,true);this.rotate('calf_'+side,'x',knee,1,true);this.rotate('foot_'+side,'x',hip-knee+pose['foot_'+sourceSide],1,true);
    this.rotate('upperarm_'+side,'x',-arm,1,true);this.rotate('lowerarm_'+side,'x',-pose['elbow_'+sourceSide],1,true);this.rotate('upperarm_'+side,'z',(side==='l'?1:-1)*pose['spread_'+sourceSide]);
   }
   // Upper-body +Y bends toward forward +Z with a positive canonical X turn.
   this.rotate('pelvis','x',pose.pelvisPitch,1,true);
   this.rotate('spine_01','x',pose.torso*.45,1,true);this.rotate('spine_02','x',pose.torso*.35,1,true);this.rotate('spine_03','x',pose.torso*.20,1,true);
   this.rotate('neck_01','x',pose.neckPitch*.65,1,true);this.rotate('head','x',pose.neckPitch*.35,1,true);
   for(const side of ['l','r']){this.rotate('clavicle_'+side,'z',(side==='l'?-1:1)*pose.clavicleLift,1,true);this.rotate('ball_'+side,'x',-.34*pose.toeOff,1,true);}
   for(const r of s.neutral){const base=this.basePose.get(r.o.name);r.o.quaternion.copy(base.q.clone().slerp(r.o.quaternion,w));r.o.position.copy(base.p.clone().lerp(r.o.position,w));}
  }
  // A firm walking overlay: preserve the source legs and timing, stabilize the
  // chest, keep elbows engaged and wrists aligned with the forearms. The layer
  // fades with the walk weight, so standing, running and idle keep their poses.
  const walkWeight=s.gaitWeights[1]*(1-w);
  if(walkWeight>.001){
   s.root.updateMatrixWorld(true);
   const chest=s.byName.get('spine_03'),reference=Q().setFromRotationMatrix(s.bindWorld.get(chest).clone().extractRotation(s.bindWorld.get(chest))),world=chest.getWorldQuaternion(Q()),delta=this.actor.quaternion.clone().invert().multiply(world).multiply(reference.clone().invert()),euler=new THREE.Euler().setFromQuaternion(delta,'YXZ');
   euler.x=euler.x*.6+.055;euler.y*=.72;euler.z*=.38;
   const targetWorld=this.actor.quaternion.clone().multiply(Q().setFromEuler(euler)).multiply(reference),local=chest.parent.getWorldQuaternion(Q()).invert().multiply(targetWorld);
   chest.quaternion.slerp(local,walkWeight);
   for(const side of ['l','r']){
    const upper=s.byName.get('upperarm_'+side),swingQ=upper.quaternion.clone().multiply(this.neutral.get(upper.name).q.clone().invert()),axis=this.axes.get(upper.name).x,forward=Math.max(0,-2*Math.atan2(swingQ.x*axis.x+swingQ.y*axis.y+swingQ.z*axis.z,swingQ.w));
    this.rotate('upperarm_'+side,'z',(side==='l'?-1:1)*.055*walkWeight);
    this.rotate('lowerarm_'+side,'x',-.28-Math.min(forward,.52)*.22,walkWeight,true);
    const hand=s.byName.get('hand_'+side);hand.quaternion.slerp(this.neutral.get(hand.name).q,.82*walkWeight);
   }
  }
  const runWeight=s.gaitWeights[2]*(1-w);
  if(runWeight>.001){const nativeSpeed=NATURAL_RUN.strideLegLengths*this.legLength/NATURAL_RUN.strideSeconds;this.runStrideScale=clamp(Math.pow(Math.max(.2,c.speed)/nativeSpeed,.35)*1.24,1,1.55);this.runPhase+=dt*Math.max(.2,c.speed)/(NATURAL_RUN.strideLegLengths*this.legLength*this.runStrideScale);this.runningArms(runWeight,dt);}
  // Rebased chest posture must not retain the source's compensating chin lift.
  // Level the gaze only during walking/running; idle looking and jump balance
  // retain their own head motion, and the turn-leading layer follows below.
  const gait=s.gaitWeights,levelWeight=(gait[1]+gait[2])*(1-w)*.85;
  if(levelWeight>.001){s.root.updateMatrixWorld(true);const head=s.byName.get('head'),reference=Q().setFromRotationMatrix(s.bindWorld.get(head).clone().extractRotation(s.bindWorld.get(head))).premultiply(this.actor.quaternion),local=head.parent.getWorldQuaternion(Q()).invert().multiply(reference);head.quaternion.slerp(local,levelWeight);}
  // The head leads the turn, the torso follows, and a running turn banks inward.
  const lean=clamp(-c.turnRate*c.speed*.013,-.20,.20);this.turnLean+=(lean-this.turnLean)*(1-Math.exp(-dt*12));
  this.rotate('spine_01','z',this.turnLean*.5);this.rotate('spine_02','z',this.turnLean*.5);
  const lead=clamp(c.turnError,-.7,.7);this.rotate('spine_03','y',lead*.22);this.rotate('head','y',lead*.35);
  // Offset the pelvis in the armature frame, not along an imported bone axis.
  const pelvis=s.byName.get('pelvis'),offset=V().set(0,-drop*w,0).applyQuaternion(pelvis.parent.getWorldQuaternion(Q()).invert()).divideScalar(s.data.scale);pelvis.position.add(offset);
  const smoothing=jumping||w>.005;
  if(smoothing&&dt>0)this.smoothPose(dt);
  // Jump smoothing used to stop at w=.005 with a one-frame arm catch-up.
  // Bound only the grounded gait handoff; preserve the complete jump pose and
  // its existing velocity filter. Normal running is below this angular budget.
  if(runWeight>.001&&!jumping)for(const side of ['l','r'])for(const part of ['upperarm','lowerarm','hand'])this.limitConstraint(s.byName.get(part+'_'+side),dt*14);
  s.finishPose();
  if(c.grounded&&!jumping&&runWeight>.6)this.plantRunFeet(c,dt,runWeight);else{this.groundFeet.clear();this.groundReport=[];}
  // Bound the complete grounded handoff, including feet after contact IK.
  // Otherwise the jump filter's final threshold can snap a calf into the new
  // full-body run even though the already limited arms remain continuous.
  if(runWeight>.001&&!jumping)for(const name of ['pelvis','spine_03','thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r'])this.limitConstraint(s.byName.get(name),dt*14);
  if(runWeight>.001&&!jumping){const pelvis=s.byName.get('pelvis'),previous=this.visualPose.get('pelvis').p,parent=pelvis.parent.getWorldQuaternion(Q()),delta=pelvis.position.clone().sub(previous).applyQuaternion(parent),limit=dt*2.5/s.data.scale;pelvis.position.add(V().set(0,clamp(delta.y,-limit,limit)-delta.y,0).applyQuaternion(parent.invert()));}
  if(c.phase==='landing'&&this.lastPhase!=='landing')for(const side of ['l','r']){const local=this.ankles.get(side).clone();if(this.activeJumpStyle==='cmu-running')local.z+=(side==='l'?1:-1)*this.leadSign*.065;this.landingFeet.get(side).copy(local.applyMatrix4(this.actor.matrixWorld));}
  const contactTime=timeToContact(c,MOVEMENT,c.y-floor),contactDuration=Math.min(.22,.38/Math.max(1,c.speed)),contactGoal=c.phase==='anticipation'?smooth(c.phaseTime/MOVEMENT.anticipation):!c.grounded?smooth(1-contactTime/.20):c.phase==='landing'?1-smooth(c.phaseTime/contactDuration):0;
  this.contactWeight+=(contactGoal-this.contactWeight)*(1-Math.exp(-dt*32));
  const contact=c.phase==='landing'&&c.phaseTime<.05?1:this.contactWeight;
  if(contact>.001){
   for(const side of ['l','r']){const foot=s.byName.get('foot_'+side),current=foot.getWorldPosition(V()),local=this.ankles.get(side).clone();if(c.phase==='anticipation'){local.copy(this.prepareFeet.get(side));local.y=THREE.MathUtils.lerp(local.y,this.ankles.get(side).y,smooth(c.phaseTime/MOVEMENT.anticipation));}else if(this.activeJumpStyle==='cmu-running'){local.z+=(side==='l'?1:-1)*this.leadSign*.065;}
    if(c.phase!=='landing'){local.y+=.047*pose.toeOff;local.z-=.008*pose.toeOff;}
    const target=c.phase==='landing'?this.landingFeet.get(side):local.applyMatrix4(this.actor.matrixWorld);current.lerp(target,contact);
    if(c.phase!=='landing'){const previous=this.lastFeet.get(side).clone().applyMatrix4(this.actor.matrixWorld),delta=current.clone().sub(previous);current.copy(previous).add(delta.clampLength(0,dt*2.2));}
    this.solveLeg(side,current,contact,c.phase!=='landing'?.34*pose.toeOff:0,c.grounded?dt*14:dt*10.5);}
  }
  s.root.updateMatrixWorld(true);s.skeleton.update();this.pelvisOffset=drop*w;this.lastPhase=c.phase;this.wasJumping=jumping;this.lastJumpCount=c.jumpCount;
  for(const row of this.groundReport){const state=this.groundFeet.get(row.side);if(state)row.error=s.byName.get('foot_'+row.side).getWorldPosition(V()).distanceTo(state.point);}
  for(const r of s.neutral){const state=this.visualPose.get(r.o.name);if(!smoothing&&dt>0){state.velocity.copy(rotationVector(r.o.quaternion.clone().multiply(state.q.clone().invert()))).divideScalar(dt).clampLength(0,12);state.positionVelocity.copy(r.o.position).sub(state.p).divideScalar(dt);}state.q.copy(r.o.quaternion);state.p.copy(r.o.position);}
  for(const side of ['l','r'])this.lastFeet.get(side).copy(this.actor.worldToLocal(s.byName.get('foot_'+side).getWorldPosition(V())));
 }
 runningArms(weight,dt){
  const s=this.subject;
  s.root.updateMatrixWorld(true);
  // All running body fields share one capture phase. Advance by travelled
  // distance divided by the retargeted capture stride, including speed changes.
  const phase=this.runPhase,basis=[1];for(let i=1;i<=NATURAL_RUN.order;i++)basis.push(Math.cos(2*Math.PI*i*phase),Math.sin(2*Math.PI*i*phase));
  const sample=key=>NATURAL_RUN.channels[key].reduce((sum,c,j)=>sum+c*basis[j],0),direction=(key,side)=>{const v=V().set(...[0,1,2].map(i=>sample(key+'_'+side+'_'+i)));if(key==='thigh'||key==='calf')v.z*=this.runStrideScale;return v.normalize().applyQuaternion(this.actor.quaternion);};
  const pelvis=s.byName.get('pelvis'),pelvisReference=Q().setFromRotationMatrix(s.bindWorld.get(pelvis).clone().extractRotation(s.bindWorld.get(pelvis))),pelvisTarget=this.actor.quaternion.clone().multiply(Q().setFromEuler(new THREE.Euler(sample('pelvisPitch'),0,sample('pelvisRoll')*.25,'YXZ'))).multiply(pelvisReference);
  pelvis.quaternion.slerp(pelvis.parent.getWorldQuaternion(Q()).invert().multiply(pelvisTarget),weight);
  const height=clamp(sample('pelvisHeight')*this.legLength,.65,1.1),offset=V().set(0,height-this.bindPelvisHeight,0).applyQuaternion(pelvis.parent.getWorldQuaternion(Q()).invert()).divideScalar(s.data.scale);
  pelvis.position.lerp(this.neutral.get('pelvis').p.clone().add(offset),weight);s.root.updateMatrixWorld(true);
  for(const side of ['l','r']){const thigh=s.byName.get('thigh_'+side),calf=s.byName.get('calf_'+side),foot=s.byName.get('foot_'+side),ball=s.byName.get('ball_'+side);this.aimFromBind(thigh,calf,direction('thigh',side),weight);s.root.updateMatrixWorld(true);this.aimFromBind(calf,foot,direction('calf',side),weight);s.root.updateMatrixWorld(true);this.aimFromBind(foot,ball,direction('foot',side),weight);ball.quaternion.slerp(this.neutral.get(ball.name).q,weight);s.root.updateMatrixWorld(true);}
  // Torso and arms come from the same phase, rather than mixing an old hunched
  // chest with a new arm gesture. The accepted neutral bind remains the origin.
  for(const [name,fraction]of [['spine_01',.35],['spine_02',.7],['spine_03',1]]){
   const bone=s.byName.get(name),reference=Q().setFromRotationMatrix(s.bindWorld.get(bone).clone().extractRotation(s.bindWorld.get(bone))),target=this.actor.quaternion.clone().multiply(Q().setFromEuler(new THREE.Euler(sample('chestPitch')*fraction,sample('chestYaw')*.6*fraction,sample('chestRoll')*.2*fraction,'YXZ'))).multiply(reference);
   bone.quaternion.slerp(bone.parent.getWorldQuaternion(Q()).invert().multiply(target),weight);s.root.updateMatrixWorld(true);
  }
  for(const side of ['l','r']){const clavicle=s.byName.get('clavicle_'+side);clavicle.quaternion.slerp(this.neutral.get(clavicle.name).q,weight);}s.root.updateMatrixWorld(true);
  for(const side of ['l','r']){
   const upper=s.byName.get('upperarm_'+side),lower=s.byName.get('lowerarm_'+side),hand=s.byName.get('hand_'+side),palm=this.runHands.get(side),normal=direction('palm',side).lerp(V().set(side==='l'?-1:1,0,0).applyQuaternion(this.actor.quaternion),.55).normalize();
   // Preserve the capture's coupled three-dimensional shoulder/elbow/wrist
   // motion. No forced 90-degree elbow, fixed arm plane or locked palm normal.
   const sign=side==='l'?1:-1,upperDirection=direction('upper',side).applyQuaternion(this.actor.quaternion.clone().invert()),lowerDirection=direction('lower',side).applyQuaternion(this.actor.quaternion.clone().invert());
   // Enlarge the fore/aft swing about the capture's mean, rotating the entire
   // arm together so the changing captured elbow angle remains coordinated.
   const mean=Math.atan2(NATURAL_RUN.channels['upper_'+side+'_2'][0],-NATURAL_RUN.channels['upper_'+side+'_1'][0]),angle=Math.atan2(upperDirection.z,-upperDirection.y),swing=clamp(Math.atan2(Math.sin(angle-mean),Math.cos(angle-mean))*.30,-.25,.25),armAxis=V().set(1,0,0);
   upperDirection.applyAxisAngle(armAxis,-swing);lowerDirection.applyAxisAngle(armAxis,-swing);normal.applyAxisAngle(armAxis.applyQuaternion(this.actor.quaternion),-swing);
   // Retarget lateral clearance for this broad-shouldered body. Preserve the
   // sampled fore/aft swing and changing elbow angle, with modest inward return.
   upperDirection.x=sign*(.32+.18*Math.max(0,sign*upperDirection.x));upperDirection.normalize().applyQuaternion(this.actor.quaternion);
   lowerDirection.x*=.35;lowerDirection.normalize().applyQuaternion(this.actor.quaternion);
   this.aimFromBind(upper,lower,upperDirection,weight);s.root.updateMatrixWorld(true);
   this.aimFromBind(lower,hand,lowerDirection,weight,palm.normal,normal);s.root.updateMatrixWorld(true);
   // Calibrate the palm's long axis against the actual forearm, rather than
   // inheriting the old rig's bent hand rest. Preserve the captured wrist sway
   // around that anatomical reference, in the moving palm plane.
   const handDirection=lowerDirection.clone(),bendAxis=normal.clone().addScaledVector(handDirection,-normal.dot(handDirection)).normalize(),sideAxis=bendAxis.clone().cross(handDirection).normalize();
   handDirection.applyAxisAngle(bendAxis,sample('wristPitch_'+side)).applyAxisAngle(sideAxis,sample('wristSide_'+side));
   this.aimFromBind(hand,s.byName.get('middle_01_'+side),handDirection,weight,palm.normal,normal);
   for(const {bone,q} of palm.curls)bone.quaternion.slerp(q,weight);
  }
 }
 plantRunFeet(c,dt,weight){
  const s=this.subject;this.groundReport=[];
  for(const side of ['l','r']){
   const foot=s.byName.get('foot_'+side),ball=s.byName.get('ball_'+side),ankle=foot.getWorldPosition(V()),toe=ball.getWorldPosition(V()),height=supportAt(toe.x,toe.z,c.y+.20,c.world).height,local=this.actor.worldToLocal(ankle.clone()),previous=this.groundFeet.get(side),low=Math.min(ankle.y-.075,toe.y-.02),contact=low-height<.026&&local.z>-.35;
   let state=previous;
   if(contact&&!state)state={point:ankle.clone(),time:0,weight:0};
   if(state){state.time+=dt;state.weight+=(Number(contact&&state.time<.22)-state.weight)*(1-Math.exp(-dt*38));if(state.weight<.01&&!contact){this.groundFeet.delete(side);continue;}const target=ankle.clone().lerp(state.point,weight*state.weight);target.y=Math.max(target.y,height+.073);const original=foot.getWorldQuaternion(Q());this.solveLeg(side,target,weight*state.weight,0,Infinity,.015);s.root.updateMatrixWorld(true);foot.quaternion.copy(foot.parent.getWorldQuaternion(Q()).invert().multiply(original));this.groundFeet.set(side,state);this.groundReport.push({side,weight:state.weight,error:foot.getWorldPosition(V()).distanceTo(state.point)});}
   else if(low<height){const target=ankle.clone();target.y+=height-low;const original=foot.getWorldQuaternion(Q());this.solveLeg(side,target,weight,0,Infinity,.015);s.root.updateMatrixWorld(true);foot.quaternion.copy(foot.parent.getWorldQuaternion(Q()).invert().multiply(original));}
  }
 }
 aimFromBind(bone,child,direction,weight,planeNormal=null,targetNormal=null){
  const s=this.subject,bind=s.bindWorld.get(bone),reference=Q().setFromRotationMatrix(bind.clone().extractRotation(bind)),from=V().setFromMatrixPosition(s.bindWorld.get(child)).sub(V().setFromMatrixPosition(bind)).normalize();
  const actorInverse=this.actor.quaternion.clone().invert(),to=direction.clone().applyQuaternion(actorInverse),delta=Q().setFromUnitVectors(from,to);
  if(planeNormal){const a=planeNormal.clone().applyQuaternion(delta);a.addScaledVector(to,-a.dot(to)).normalize();const b=targetNormal.clone().applyQuaternion(actorInverse);b.addScaledVector(to,-b.dot(to)).normalize();const twist=Math.atan2(to.dot(a.clone().cross(b)),clamp(a.dot(b),-1,1));delta.premultiply(Q().setFromAxisAngle(to,twist));}
  const world=this.actor.quaternion.clone().multiply(delta).multiply(reference),local=bone.parent.getWorldQuaternion(Q()).invert().multiply(world);
  bone.quaternion.slerp(local,weight);
 }
 smoothPose(dt){
  // Exact critically damped decay in each joint's parent rotation frame. Keep
  // incoming gait momentum instead of resetting to a static pose at transitions.
  const omega=this.lastPhase==='anticipation'?36:30,decay=Math.exp(-omega*dt);
  for(const r of this.subject.neutral){const state=this.visualPose.get(r.o.name),target=r.o.quaternion.clone(),error=rotationVector(state.q.clone().multiply(target.clone().invert())),j=state.velocity.clone().addScaledVector(error,omega),next=error.addScaledVector(j,dt).multiplyScalar(decay);state.velocity.addScaledVector(j,-omega*dt).multiplyScalar(decay).clampLength(0,12);r.o.quaternion.copy(rotationQuaternion(next).multiply(target));
   const ep=state.p.clone().sub(r.o.position),jp=state.positionVelocity.clone().addScaledVector(ep,omega),position=r.o.position.clone().add(ep.addScaledVector(jp,dt).multiplyScalar(decay));state.positionVelocity.addScaledVector(jp,-omega*dt).multiplyScalar(decay);r.o.position.copy(position);
  }
 }
 solveLeg(side,target,weight=1,footPitch=0,maxAngle=Infinity,reachInset=.001){
  const s=this.subject,a=s.byName.get('thigh_'+side),b=s.byName.get('calf_'+side),foot=s.byName.get('foot_'+side);
  const ap=a.getWorldPosition(V()),bp=b.getWorldPosition(V()),cp=foot.getWorldPosition(V()),l1=ap.distanceTo(bp),l2=bp.distanceTo(cp),direction=target.clone().sub(ap),distance=clamp(direction.length(),Math.abs(l1-l2)+.001,l1+l2-reachInset);direction.normalize();
  const pole=V().set(0,0,1).applyQuaternion(this.actor.quaternion);pole.addScaledVector(direction,-pole.dot(direction)).normalize();
  const along=(l1*l1-l2*l2+distance*distance)/(2*distance),bend=Math.sqrt(Math.max(0,l1*l1-along*along));
  const knee=ap.clone().addScaledVector(direction,along).addScaledVector(pole,bend);
  this.aim(a,bp.clone().sub(ap),knee.clone().sub(ap),maxAngle);s.root.updateMatrixWorld(true);
  this.aim(b,foot.getWorldPosition(V()).sub(b.getWorldPosition(V())),target.clone().sub(b.getWorldPosition(V())),maxAngle);s.root.updateMatrixWorld(true);
  const level=this.actor.quaternion.clone().multiply(Q().setFromAxisAngle(V().set(1,0,0),footPitch)).multiply(Q().setFromRotationMatrix(s.bindWorld.get(foot).clone().extractRotation(s.bindWorld.get(foot))));
  foot.quaternion.slerp(foot.parent.getWorldQuaternion(Q()).invert().multiply(level),weight);
  this.limitConstraint(foot,maxAngle);
 }
 // Airborne IK is a moving pose target, not a planted contact. Limit its
 // correction rate so a nearly straight leg cannot snap at the IK singularity.
 limitConstraint(bone,maxAngle){if(!Number.isFinite(maxAngle))return;const previous=this.visualPose.get(bone.name).q,angle=previous.angleTo(bone.quaternion);if(angle>maxAngle)bone.quaternion.copy(previous.clone().slerp(bone.quaternion,maxAngle/angle));}
 aim(bone,from,to,maxAngle=Infinity){const delta=Q().setFromUnitVectors(from.normalize(),to.normalize()),world=bone.getWorldQuaternion(Q()).premultiply(delta),parent=bone.parent.getWorldQuaternion(Q()).invert();bone.quaternion.copy(parent.multiply(world));this.limitConstraint(bone,maxAngle);}
}
