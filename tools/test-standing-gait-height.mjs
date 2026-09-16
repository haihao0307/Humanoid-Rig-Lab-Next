// Exercise the unchanged vendor scheduler through the production wrapper.
// Independent foot anchors and fixed lengths are checked on every pose.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {MotionController} from '../motion/vendor/controller.mjs';
import {rigFromSource} from '../motion/vendor/rig.mjs';
import {FlatWorld} from '../motion/vendor/world.mjs';
import {solveTwoBone} from '../motion/vendor/math.mjs';
import {createCharacterShapeField,CHARACTER_DEFORMATION_RULES} from '../reconstruction/shape-deform.mjs';
import {normalizeCharacterShape,characterShapeParameterKey,SHAPE_SCHEMA,SHAPE_REVISION} from '../reconstruction/shape-contract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),rig=JSON.parse(read('reconstruction/rig-reference.json'));
const fullBody=read('motion/vendor/full-body.mjs').replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL('../motion/vendor/'+path,import.meta.url).href));
const {FullBodyMotion,blend,relaxedHandRotation}=await import('data:text/javascript;base64,'+Buffer.from(fullBody+'\nexport {blend,relaxedHandRotation};').toString('base64'));
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const code=math+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(rig)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js')+'\n'+read('body/NaturalLocomotion.js');
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,r2StandingGestureDescriptor,r2SampleMotion,NaturalLocomotion,dist,sub,dot,norm,qangle,qm,qy,rotate,inv,add})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'standing-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff:(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}});
let frames=0,walks=0,turns=0,stops=0,maxHeightStepM=0,maxFootErrorM=0,maxBoneErrorM=0,maxIdleKneeDegrees=0,minWalkKneeDegrees=180,maxWalkKneeDegrees=0;
let stanceKneeSum=0,stanceSamples=0,maxStanceKneeDegrees=0,maxSwingPitch=0,minSwingPitch=0,maxPitchStep=0,maxRenderedFootAngle=0;
let heelSamples=0,forefootSamples=0,maxPivotDriftM=0,maxAnkleLiftM=0,maxRollStep=0;
let maxBodyHeightStepM=0,maxSupportLiftM=0,maxPhysicalFootErrorM=0;
const shapes=[{}, {statureScale:.94},{statureScale:1.06},{legProportion:.7,waistWidth:-.2},{legProportion:-.6,hipWidth:.25},
 {shoulderWidth:.75,waistWidth:.2,torsoDepth:.3,armFullness:.5,legFullness:.3},{shoulderWidth:-.35,hipWidth:-.2,waistWidth:-.65,torsoDepth:-.45,armFullness:-.55,legFullness:-.45},{shoulderWidth:.15,hipWidth:.35,waistWidth:.65,torsoDepth:.65,armFullness:.35,legFullness:.5}];
for(const shape of shapes){
 const resolvedRig=api.resolveCharacterRig(shape),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 const a={h,pos:[0,0,0],yaw:0,time:0,route:[],routeIndex:0,manipulationPace:()=>1,strength:{movementFactor:()=>1},w:{objects:[],bounds:{xMin:-100,xMax:100,zMin:-100,zMax:100},collision:()=>false}};
 const locomotion=new api.NaturalLocomotion(a);a.locomotion=locomotion;
 let lastBodyHeight=locomotion.pose.build().frames.get('hips').p[1];
 assert.equal(locomotion.rig.hipHeight,bodyMetrics.walkingHipHeightM);
 assert.equal(locomotion.engine.state.root[1],bodyMetrics.standingHipHeightM);
 const step=()=>{
  const before=structuredClone(locomotion.engine.state);locomotion.update(1/120);
  const s=locomotion.engine.state,candidate=locomotion.pose.build();locomotion.pose.validate(candidate);frames++;
  const bodyHeight=candidate.frames.get('hips').p[1],bodyStep=Math.abs(bodyHeight-lastBodyHeight);lastBodyHeight=bodyHeight;
  maxBodyHeightStepM=Math.max(maxBodyHeightStepM,bodyStep);maxSupportLiftM=Math.max(maxSupportLiftM,s.pelvisSupportLiftM||0);
  assert(bodyStep<.004*bodyMetrics.statureScale,'actual pelvis must not pop during support changes');
  for(const error of candidate.errors){maxPhysicalFootErrorM=Math.max(maxPhysicalFootErrorM,error.error);assert(error.error<1e-7,'physical foot targets remain reachable after pelvis lift');}
  assert.equal(s.fault,null);maxHeightStepM=Math.max(maxHeightStepM,Math.abs(s.root[1]-before.root[1]));
  assert(Math.abs(s.root[1]-before.root[1])<.004*bodyMetrics.statureScale,'height cannot snap on a fixed step');
  for(const side of ['left','right']){
   const leg=s.pose.legs[side],foot=s.feet[side],error=api.dist(leg.end,foot.position);
   maxFootErrorM=Math.max(maxFootErrorM,error);maxBoneErrorM=Math.max(maxBoneErrorM,leg.lengthError);
   assert(error<1e-7,'height transition preserves independent foot anchors: '+JSON.stringify({shape,error,status:s.status,speed:s.speed,height:s.root[1],side,swing:s.swing?.side}));
   if(before.feet[side].contact&&foot.contact)assert(api.dist(before.feet[side].position,foot.position)<1e-10,'planted feet cannot slide during height changes');
   const pitch=foot.swingPitch||0;maxSwingPitch=Math.max(maxSwingPitch,pitch);minSwingPitch=Math.min(minSwingPitch,pitch);
   maxPitchStep=Math.max(maxPitchStep,Math.abs(pitch-(before.feet[side].swingPitch||0)));
   if(foot.contact)assert.equal(pitch,0,'airborne ankle motion must not rotate a locked support foot');
   const footAngle=api.qangle(candidate.frames.get(side+'_foot').q,api.qm(api.qy(foot.yaw),sourceBind.get(side+'_foot').q));
   maxRenderedFootAngle=Math.max(maxRenderedFootAngle,footAngle);
   const rocker=foot.rocker,previous=before.feet[side].rocker;
   maxRollStep=Math.max(maxRollStep,Math.abs((rocker?.pitch||0)-(previous?.pitch||0)));
   assert(Math.abs((rocker?.pitch||0)-(previous?.pitch||0))<.04,'physical ankle pitch must stay continuous through contact changes');
   if(foot.contact&&!rocker?.pitch)assert(footAngle<1e-6,'flat support must retain its original orientation');
   if(foot.contact&&rocker?.pitch){
    if(rocker.kind==='heel')heelSamples++;else forefootSamples++;
    const f=candidate.frames.get(side+'_foot'),local=api.rotate(api.inv(sourceBind.get(side+'_foot').q),rocker.pivot);
    const actual=api.add(f.p,api.rotate(f.q,local));
    assert(api.dist(actual,rocker.world)<1e-7,'rendered heel/forefoot must hit its independent world support');
    if(before.feet[side].contact&&previous?.kind===rocker.kind){maxPivotDriftM=Math.max(maxPivotDriftM,api.dist(previous.world,rocker.world));assert(api.dist(previous.world,rocker.world)<1e-9,'active support pivot cannot slide');}
    maxAnkleLiftM=Math.max(maxAnkleLiftM,f.p[1]-foot.position[1]);
   }
   const hipFrame=candidate.frames.get(side+'_femur'),kneeFrame=candidate.frames.get(side+'_tibia'),ankleFrame=candidate.frames.get(side+'_foot');
   const knee=Math.acos(Math.max(-1,Math.min(1,api.dot(api.norm(api.sub(kneeFrame.p,hipFrame.p)),api.norm(api.sub(ankleFrame.p,kneeFrame.p))))))*180/Math.PI;
   if(locomotion.isSettled())maxIdleKneeDegrees=Math.max(maxIdleKneeDegrees,knee);
   if(s.speed>.4){minWalkKneeDegrees=Math.min(minWalkKneeDegrees,knee);maxWalkKneeDegrees=Math.max(maxWalkKneeDegrees,knee);
    assert(s.root[1]<=locomotion.standingTarget()+1e-9,'pelvis must remain within both fixed-length legs reach');
    if(foot.contact){stanceKneeSum+=knee;stanceSamples++;maxStanceKneeDegrees=Math.max(maxStanceKneeDegrees,knee);}}
  }
 };
 const walk=target=>{
  a.route=[target];a.routeIndex=0;let completed=false;
  for(let i=0;i<4000;i++){const moving=locomotion.move(1/120);step();if(!moving&&locomotion.isSettled()){completed=true;break;}}
  assert(completed,'walk must finish including return to standing');assert(horizontal(a.pos,target)<=.016);walks++;
 };
 const turn=yaw=>{let completed=false;for(let i=0;i<2400;i++){const moving=locomotion.turnInPlace(yaw,1/120);step();if(!moving&&locomotion.isSettled()){completed=true;break;}}assert(completed,'turn must finish without endlessly restarting its height transition');turns++;};
 step();walk([0,0,1]);turn(Math.PI/2);walk([1,0,1]);turn(-Math.PI/2);
 a.route=[[-2,0,1]];a.routeIndex=0;for(let i=0;i<80;i++){locomotion.move(1/120);step();}
 let stopped=false;for(let i=0;i<1800;i++){locomotion.stop();step();if(locomotion.isSettled()){stopped=true;break;}}
 assert(stopped,'repeated stop must settle its feet and finish rising');stops++;
 assert(locomotion.canTransition('greet'),'gesture handoff waits for the complete stance');
 const engine=locomotion.engine,start=api.r2SampleMotion('wave',0),origin=engine.state.root.slice(),g={fromMotion:start,origin,base:{position:origin.slice()},duration:3};start.rootQ=[0,0,0,1];start.rootHeightRatio=1;
 for(let i=0;i<=30;i++){g.time=i*.1;const candidate=locomotion.pose.build(api.r2StandingGestureDescriptor(h,g,a.yaw,Math.min(1,i/3,(30-i)/3)));locomotion.pose.validate(candidate);for(const side of ['left','right'])assert(api.dist(candidate.frames.get(side+'_foot').p,engine.state.feet[side].position)<1e-7,'standing wave keeps the newly settled foot anchors');}
}
assert(maxIdleKneeDegrees<15,'idle standing has slight knee flexion instead of the gait crouch');
assert(maxWalkKneeDegrees>30,'walking retains its swing-knee flexion');
assert(stanceSamples>1000&&stanceKneeSum/stanceSamples<17,'rolling support must not be absorbed as the previous 22-degree average knee bend');
assert(maxSwingPitch>.02&&minSwingPitch<-.02,'airborne ankle must release and recover instead of staying flat');
assert(maxRenderedFootAngle>.02,'full pose builder must consume airborne ankle articulation');
assert(heelSamples>100&&forefootSamples>100&&maxAnkleLiftM>.01,'walk must transfer heel/forefoot support and allow the ankle to rise');
console.log(JSON.stringify({schema:'human/standing_gait_height@4',shapes:shapes.length,frames,walks,turns,stops,maxHeightStepM,maxBodyHeightStepM,maxSupportLiftM,maxPhysicalFootErrorM,maxFootErrorM,maxBoneErrorM,maxIdleKneeDegrees,minWalkKneeDegrees,maxWalkKneeDegrees,stanceSamples,meanStanceKneeDegrees:stanceKneeSum/stanceSamples,maxStanceKneeDegrees,maxSwingPitch,minSwingPitch,maxPitchStep,maxRenderedFootAngle,heelSamples,forefootSamples,maxPivotDriftM,maxAnkleLiftM,maxRollStep,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
