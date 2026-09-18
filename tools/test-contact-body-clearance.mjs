// Exact controlled-pose and physics-proxy checks for free-hand release paths.
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
const code=math+'\n'+grasp+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(reference)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js')+'\n'+read('body/MotionLabActions.js')+'\n'+read('body/NaturalLocomotion.js')+'\n'+read('world/PhysicsContract.js')+'\n'+read('world/PhysicsWorld.js')+'\n'+read('control/TaskAgent.js');
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,MotionLabPose,motionChooseContact,motionValidateTransferContacts,motionValidateContactReach,motionCarrySamples,motionApproachDistance,rayBoundary,inv,norm,motionContactDescriptor,contactHandObjectClearance,graspFrames,PhysicsWorld,Agent,frame,qy,qm,compose,sub,add,mul,rotate,dist,qangle})',{
 structuredClone,WorkbenchPhysicsEngine:C,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'release-test',
 degrees:r=>r*180/Math.PI,radians:d=>d*Math.PI/180,r2Mean:f=>(f('left')+f('right'))*.5,DOWN:[0,-1,0],horizontal:(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),angleDiff:(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),MotionLab:{FlatWorld,MotionController,rigFromSource,FullBodyMotion,blend,relaxedHandRotation,solveTwoBone}});
let cases=0,minimumBodyClearanceM=Infinity,minimumHandClearanceM=Infinity,maximumPalmErrorM=0;const results=[];
for(const shape of [{},{statureScale:.95,legProportion:-.35,shoulderWidth:.7,hipWidth:.35,waistWidth:.65,torsoDepth:.55,armFullness:.75,legFullness:.65}]){
 const resolvedRig=api.resolveCharacterRig(shape),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),engine=new MotionController(rigFromSource(resolvedRig)),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));h.spine=[{id:'C1'}];
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 const pose=new api.MotionLabPose(h,engine);h.motionDriver=pose;
 for(const spec of [{id:'tall',w:.3,h:.6,d:.3},{id:'OBS',w:.32,h:.5,d:.2},{id:'push',w:.3,h:.6,d:.3,push:true}])for(const relativeYaw of [0,.34])for(const yaw of [0,.7]){
  const q=api.qy(yaw+relativeYaw),direction=api.rotate(api.qy(yaw),[0,0,1]);
  // rayBoundary's authored shape discriminator is required for exact box rays.
  const standoff=api.motionApproachDistance(h)+api.rayBoundary({...spec,shape:'box'},api.rotate(api.inv(q),api.mul(direction,-1))),origin=[1.3,0,-.4];
  const object={...spec,shape:'box',p:api.add([origin[0],spec.h/2,origin[2]],api.mul(direction,standoff)),q,mass:.5,friction:.08,restitution:0,movable:true,collidable:true,v:[0,0,0],angularVelocity:[0,0,0]};
  const world={objects:[object],bounds:{xMin:-13,xMax:13,zMin:-9,zMax:9},physicsSettings:{gravityMps2:9.81,groundFriction:.65},revision:0,collision:()=>false};world.physics=new api.PhysicsWorld(world);
  engine.reset();engine.state.root=[origin[0],bodyMetrics.standingHipHeightM,origin[2]];engine.state.yaw=yaw;for(const side of ['left','right'])engine.state.feet[side]={position:engine.stance(engine.state,side),yaw,contact:true};engine.state.pose=engine.solve(engine.state);
  const grips=api.graspFrames(object,yaw,!!spec.push),ground=api.frame(object.p,object.q),hands=Object.fromEntries(['left','right'].map(side=>[side,api.compose(ground,grips[side])]));
  const started=performance.now(),contact=api.motionChooseContact(h,origin,yaw,hands,world,[object.id],{objectPose:ground,grips:spec.push?null:grips}),planningMs=performance.now()-started;
  const reach=api.motionValidateContactReach(h,origin,yaw,hands,contact,world,[object.id],204,ground),transfer=spec.push?null:api.motionValidateTransferContacts(h,origin,yaw,grips,ground,contact,world,[object.id],252);
  for(const path of [reach,transfer].filter(Boolean)){assert(path.maximumWristFlexionDegrees<=70,'manual handling respects wrist flexion/extension');assert(path.maximumWristRadialDegrees<=20,'radial limit is distinct from ulnar limit');assert(path.maximumWristUlnarDegrees<=40,'ulnar limit remains bounded');}
  maximumPalmErrorM=Math.max(maximumPalmErrorM,reach.maximumPalmErrorM,transfer?.maximumPalmErrorM??0);assert(maximumPalmErrorM<1e-7,'the accepted paths keep the exact fixed-length wrist targets reachable');
  const minimum=Math.min(reach.minimumClearanceM,transfer?.minimumClearanceM??Infinity,contact.carryConfiguration?.minimumClearanceM??Infinity);minimumBodyClearanceM=Math.min(minimumBodyClearanceM,minimum);assert(minimum>=.008,'all 36 non-palm proxies must retain the planned object clearance');
  for(const side of ['left','right']){const palm=hands[side],distance=world.physics.sphereObjectClearance(world.physics.bodies.get(object.id),palm.p,0);assert(Math.abs(distance)<1e-8,'palm effector remains exactly on the box surface');}
  const translated=api.frame(api.add(object.p,[1,0,-.6]),object.q),bodyFrames=pose.build({reference:contact.reference,position:[origin[0],contact.heightM,origin[2]],yaw,controlledFeet:true,hands,armPoleLateralM:contact.carryConfiguration?.poleLateralM,contactHand:contact.contactHandMode?{mode:contact.contactHandMode,amount:1}:null}).frames;
  const before=JSON.stringify(world.physics.capture()),query=world.physics.bodyObjectClearance(object.id,h,bodyFrames,translated);assert(Number.isFinite(query.minimumClearanceM));assert.equal(JSON.stringify(world.physics.capture()),before,'hypothetical clearance queries cannot move the live body');
  for(const joint of h.joints)joint.world=bodyFrames.get(joint.id);
  const releaseAgent=Object.assign(Object.create(api.Agent.prototype),{h,w:world,npcId:'test',phase:'release',locomotion:{engine,pose},skill:{o:object,contactPose:contact,carryConfiguration:contact.carryConfiguration}}),skill=releaseAgent.skill;
  skill.releaseClearance=world.physics.ownerClearance(object.id,releaseAgent);skill.releasePalms=hands;skill.releaseWrists=Object.fromEntries(['left','right'].map(side=>{const wrist=bodyFrames.get(side+'_hand'),shoulder=bodyFrames.get(side+'_upperArm');return[side,{offset:api.sub(wrist.p,shoulder.p),q:wrist.q}];}));
  skill.releaseMotionPlan=releaseAgent.chooseReleaseMotion(skill);releaseAgent.phase='rise';
  for(let i=0;i<=Math.ceil(skill.releaseMotionPlan.durationS*120);i++){const elapsed=Math.min(skill.releaseMotionPlan.durationS,i/120),motion=releaseAgent.releaseMotion(skill,elapsed),candidate=pose.build({...api.motionContactDescriptor(releaseAgent,motion.hands,motion.crouch),hands:motion.hands});pose.validate(candidate);const clearance=world.physics.ownerClearance(object.id,releaseAgent,candidate.frames);assert(clearance.minimumClearanceM>=.008-1e-8,'withdrawal keeps every non-palm body proxy outside the box');const hand=api.contactHandObjectClearance(h,candidate.frames,world.physics,object.id);minimumHandClearanceM=Math.min(minimumHandClearanceM,hand.minimumClearanceM);assert(hand.minimumClearanceM>=.0005,'release must clear all metacarpal/finger segments including tips');}
  const result={shape,id:spec.id,relativeYaw,yaw,standoff,contactHeightM:contact.heightM,forwardFlexionDegrees:contact.source.forwardFlexionDegrees,carry:contact.carryConfiguration,reach,transfer,release:skill.releaseMotionPlan,planningMs};results.push(result);console.log(JSON.stringify(result));cases++;
 }
}
console.log(JSON.stringify({cases,minimumBodyClearanceM,minimumHandClearanceM,maximumPalmErrorM,nonContactProxyExclusions:[],source:'exact production pose and collision helpers',results}));
