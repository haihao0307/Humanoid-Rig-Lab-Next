// Production ledge-grasp paths: real rig, collision geometry and fixed-length IK.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../world/physics/vendor/cannon-es.js';
import {MotionController} from '../motion/vendor/controller.mjs';
import {FlatWorld} from '../motion/vendor/world.mjs';
import {rigFromSource} from '../motion/vendor/rig.mjs';
import {solveTwoBone} from '../motion/vendor/math.mjs';
import {createCharacterShapeField,CHARACTER_DEFORMATION_RULES} from '../reconstruction/shape-deform.mjs';
import {normalizeCharacterShape,characterShapeParameterKey,SHAPE_SCHEMA,SHAPE_REVISION} from '../reconstruction/shape-contract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const reference=JSON.parse(read('reconstruction/rig-reference.json'));
const fullBody=read('motion/vendor/full-body.mjs').replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL('../motion/vendor/'+path,import.meta.url).href));
const {FullBodyMotion,blend,relaxedHandRotation}=await import('data:text/javascript;base64,'+Buffer.from(fullBody+'\nexport {blend,relaxedHandRotation};').toString('base64'));
const runtime=read('source/runtime.template.js'),math=runtime.split('// MODULE math')[1].split('function matrix')[0],grasp=runtime.slice(runtime.indexOf('function rayBoundary'),runtime.indexOf('function graspResidual'));
const code=math+'\n'+grasp+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(reference)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js')+'\n'+read('body/MotionLabActions.js')+'\n'+read('body/BoxHandling.js')+'\n'+read('body/NaturalLocomotion.js')+'\n'+read('world/PhysicsContract.js')+'\n'+read('world/PhysicsWorld.js')+'\n'+read('control/TaskAgent.js');
const api=vm.runInNewContext(code+'\n({motionBoxQueryWorld,motionBoxApproachOffsets,motionBoxAdjustment,motionPlanBoxHandlingSteps,motionDrainPreflight,motionBoxHandlingGeometry,motionBoxGripTransition,motionChooseCarryConfiguration,resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,MotionLabPose,motionChooseContact,motionValidateTransferContacts,motionValidateContactReach,motionCarrySamples,motionApproachDistance,rayBoundary,inv,norm,motionContactDescriptor,contactHandObjectClearance,graspFrames,PhysicsWorld,Agent,frame,qy,qm,compose,sub,add,mul,rotate,dist,qangle})',{
 structuredClone,WorkbenchPhysicsEngine:C,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'release-test',
 degrees:r=>r*180/Math.PI,radians:d=>d*Math.PI/180,r2Mean:f=>(f('left')+f('right'))*.5,DOWN:[0,-1,0],horizontal:(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),angleDiff:(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),MotionLab:{FlatWorld,MotionController,rigFromSource,FullBodyMotion,blend,relaxedHandRotation,solveTwoBone}});
let cases=0;
for(const shape of [{},{statureScale:.95,legProportion:-.35,shoulderWidth:.7,hipWidth:.35,waistWidth:.65,torsoDepth:.55,armFullness:.75,legFullness:.65}]){
 const resolvedRig=api.resolveCharacterRig(shape),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),engine=new MotionController(rigFromSource(resolvedRig)),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));h.spine=[{id:'C1'}];
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 const pose=new api.MotionLabPose(h,engine);h.motionDriver=pose;
 for(const spec of [{id:'small',w:.3,h:.28,d:.28}])for(const objectYaw of [0,.34])for(const initialYaw of [0,.7]){
  const relativeYaw=0,yaw=initialYaw+objectYaw;
  const offsets=api.motionBoxApproachOffsets({q:api.qy(yaw)},api.rotate(api.qy(initialYaw),[0,0,1]));
  assert(Math.abs(offsets[0]-objectYaw)<1e-10,'grasp approach aligns with the rotated box face');
  let extra=0;
  const q=api.qy(yaw+relativeYaw),direction=api.rotate(api.qy(yaw),[0,0,1]);
  // rayBoundary's authored shape discriminator is required for exact box rays.
  const standoff=api.motionApproachDistance(h)+extra+api.rayBoundary({...spec,shape:'box'},api.rotate(api.inv(q),api.mul(direction,-1))),origin=[1.3,0,-.4];
  const object={...spec,shape:'box',p:api.add([origin[0],spec.h/2,origin[2]],api.mul(direction,standoff)),q,mass:.5,friction:.08,restitution:0,movable:true,collidable:true,v:[0,0,0],angularVelocity:[0,0,0]};
  const world={objects:[object],bounds:{xMin:-13,xMax:13,zMin:-9,zMax:9},physicsSettings:{gravityMps2:9.81,groundFriction:.65},revision:0,collision:()=>false};world.physics=new api.PhysicsWorld(world);
  engine.reset();engine.state.root=[origin[0],bodyMetrics.standingHipHeightM,origin[2]];engine.state.yaw=yaw;for(const side of ['left','right'])engine.state.feet[side]={position:engine.stance(engine.state,side),yaw,contact:true};engine.state.pose=engine.solve(engine.state);

  let plan=null,lastError;
  for(extra=0;extra<=.08001;extra+=.02){
   object.p=api.add([origin[0],spec.h/2,origin[2]],api.mul(direction,standoff+extra));world.physics.syncScene();
   const before=JSON.stringify(world.physics.capture());
   try{plan=api.motionDrainPreflight(api.motionPlanBoxHandlingSteps(h,object,origin,yaw,world));}catch(error){lastError=error;}
   assert.equal(JSON.stringify(world.physics.capture()),before,'planning never moves live objects');if(plan)break;
  }
  if(!plan)throw lastError;
  const snapshot=JSON.stringify(object),forecast={...world,physics:null};
  const query=api.motionBoxQueryWorld(forecast);assert.notEqual(query.physics,world.physics);assert.equal(forecast.physics,null);assert.equal(query.physics.stepCount,0);assert.equal(JSON.stringify(object),snapshot);
  const proof=plan.adjustmentProof;
  assert(proof.minimumClearanceM>=.008);assert(proof.minimumHandClearanceM>=.0005);
  assert(proof.minimumFingerHeightM>=.012*bodyMetrics.statureScale);
  assert(proof.maximumPalmErrorM<.001);assert(proof.maximumJointStepM<.02);
  assert(proof.maximumWristFlexionDegrees<=70&&proof.maximumWristRadialDegrees<=20&&proof.maximumWristUlnarDegrees<=40);
  // A lower hand really supports the underside; it is not another side clamp.
  const localNormal=api.rotate(plan.supportGrips.left.q,[0,0,1]);assert(localNormal[1]>.99);
  assert(Math.abs(plan.supportGrips.left.p[1]+object.h/2)<1e-10);
  for(const amount of [0,.2,.4,.6,.8,1]){
   const step=api.motionBoxAdjustment(plan,amount),fixed=api.compose(step.object,api.frame(plan.pivot));
   const original=api.compose(plan.upright,api.frame(plan.pivot));assert(api.dist(fixed.p,original.p)<1e-8,'the far bottom edge retains its ground support during the tip');
  }
  const start=api.motionBoxAdjustment(plan,0),end=api.motionBoxAdjustment(plan,1);
  assert(api.dist(start.object.p,plan.upright.p)<1e-10);assert(api.dist(end.object.p,plan.tilted.p)<1e-10);
  assert.equal(JSON.stringify(start.activeHands),JSON.stringify(['left','right']));assert.equal(JSON.stringify(api.motionBoxAdjustment(plan,.7).activeHands),JSON.stringify(['right']));
  console.log(JSON.stringify({shape,yaw,relativeYaw,extra,proof}));cases++;
 }
}
assert.equal(cases,8);console.log(JSON.stringify({cases,source:'production rig, contact planner and collision geometry',visualAcceptance:false}));
