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
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,MotionLabPose,motionChooseContact,motionApproachDistance,motionContactDescriptor,graspFrames,PhysicsWorld,Agent,frame,qy,qm,compose,sub,add,mul,rotate,inv,rayBoundary,dist,qangle})',{
 structuredClone,WorkbenchPhysicsEngine:C,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'release-test',
 degrees:r=>r*180/Math.PI,radians:d=>d*Math.PI/180,r2Mean:f=>(f('left')+f('right'))*.5,DOWN:[0,-1,0],horizontal:(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),angleDiff:(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),MotionLab:{FlatWorld,MotionController,rigFromSource,FullBodyMotion,blend,relaxedHandRotation,solveTwoBone}});
let cases=0,samples=0,withdrawals=0,rejectedPenetratingStarts=0,maxResidualM=0;const results=[];
const fixture=process.argv[2]?JSON.parse(readFileSync(process.argv[2],'utf8')):null;
const fixtureShape=fixture?Object.fromEntries([...fixture.bodyMetrics.geometryKey.matchAll(/(\w+)=(-?[\d.]+)/g)].map(m=>[m[1],Number(m[2])])):null;
for(const shape of fixture?[fixtureShape]:[{},{statureScale:.94},{statureScale:1.06},{statureScale:.95,legProportion:-.35,shoulderWidth:.7,hipWidth:.35,waistWidth:.65,torsoDepth:.55,armFullness:.75,legFullness:.65}])for(const spec of fixture?[fixture.object]:[{id:'OBS_BOX',w:.32,h:.50,d:.20},{id:'OBS_SKEW',w:.32,h:.50,d:.20,yawOffset:.34},{id:'tall',w:.3,h:.6,d:.3},{id:'cart',w:.65,h:.82,d:1,push:true}])for(const yaw of fixture?[fixture.agent.yaw]:[0,.6670616468,-1.8]){
 const resolvedRig=api.resolveCharacterRig(shape),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),engine=new MotionController(rigFromSource(resolvedRig)),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));h.spine=[{id:'C1'}];
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 const pose=new api.MotionLabPose(h,engine);h.motionDriver=pose;
 const p=fixture?fixture.agent.pos:[0,0,0],q=api.qy(yaw),objectQ=api.qy(yaw+(spec.yawOffset||0)),forward=api.motionApproachDistance(h)+api.rayBoundary({...spec,shape:'box'},api.rotate(api.inv(objectQ),api.rotate(q,[0,0,-1]))),object=fixture?{...spec}:{...spec,shape:'box',p:api.add([0,spec.h/2,0],api.rotate(q,[0,0,forward])),q:objectQ,mass:.5,friction:.08,restitution:0,movable:true,collidable:true,v:[0,0,0],angularVelocity:[0,0,0]};
 const grips=api.graspFrames(object,yaw,!!spec.push),hands=Object.fromEntries(['left','right'].map(side=>[side,api.compose(api.frame(object.p,object.q),grips[side])]));
 engine.reset();engine.state.root=[0,bodyMetrics.standingHipHeightM,0];engine.state.yaw=yaw;
 for(const side of ['left','right'])engine.state.feet[side]={position:engine.stance(engine.state,side),yaw,contact:true};engine.state.pose=engine.solve(engine.state);
 if(fixture)engine.state=structuredClone(fixture.locomotion);
 const world={objects:[object],bounds:{xMin:-13,xMax:13,zMin:-9,zMax:9},physicsSettings:{gravityMps2:9.81,groundFriction:.65},revision:0,collision:()=>false};world.physics=new api.PhysicsWorld(world);
 const contact=fixture?fixture.skill.contactPose:api.motionChooseContact(h,p,yaw,hands,world,[object.id],{objectPose:api.frame(object.p,object.q),grips:spec.push?null:grips});
 const a=Object.assign(Object.create(api.Agent.prototype),{h,w:world,npcId:'one',pos:p,yaw,phase:'release',locomotion:{engine,pose},skill:{contactPose:contact,carryConfiguration:contact.carryConfiguration,o:object}}),s=a.skill;
 const start=pose.build({...api.motionContactDescriptor(a,null,1),hands});pose.validate(start);
 for(const j of h.joints)j.world=start.frames.get(j.id);
 s.releasePalms=hands;s.releaseWrists=Object.fromEntries(['left','right'].map(side=>{const wrist=start.frames.get(side+'_hand'),shoulder=start.frames.get(side+'_upperArm');return[side,{offset:api.sub(wrist.p,shoulder.p),q:[...wrist.q]}];}));
 s.releaseClearance=world.physics.ownerClearance(object.id,a);if(fixture)Object.assign(s,structuredClone(fixture.skill));
 if(s.releaseClearance.minimumClearanceM<0){assert.throws(()=>a.chooseReleaseMotion(s),/身体.*物体|接触|穿入/);rejectedPenetratingStarts++;continue;}
 s.releaseMotionPlan=a.chooseReleaseMotion(s);if(s.releaseMotionPlan.withdrawM)withdrawals++;
 a.phase='rise';const count=Math.ceil(s.releaseMotionPlan.durationS*120);
 for(let i=0;i<=count;i++){
  const motion=a.releaseMotion(s,s.releaseMotionPlan.durationS*i/count),candidate=pose.build({...api.motionContactDescriptor(a,motion.hands,motion.crouch),hands:motion.hands});const report=pose.validate(candidate);maxResidualM=Math.max(maxResidualM,report.handErrorM,report.footErrorM);
  const clearance=world.physics.ownerClearance(object.id,a,candidate.frames);assert(clearance.minimumClearanceM>=.008-1e-8,'every non-palm proxy must stay outside the object for the full withdrawal');
  if(i===count)assert(clearance.minimumClearanceM>=.008,'all proxies must be clear before collision restoration');
  if(i===0&&!fixture)for(const side of ['left','right']){assert(api.dist(motion.hands[side].p,hands[side].p)<1e-7);assert(api.qangle(motion.hands[side].q,hands[side].q)<1e-7);}
  samples++;
 }
 const original=world.collision;world.collision=()=>true;assert.throws(()=>a.chooseReleaseMotion(s),/安全撤手路径/);world.collision=original;
 // Recreate an invalid grasp with the real collision shape enclosing the
 // knee. It must be rejected before any release trajectory can be accepted.
 const safeClearance=s.releaseClearance,body=world.physics.bodies.get(object.id).body,safePosition=body.position.clone();
 body.position.set(...start.frames.get('right_tibia').p);s.releaseClearance=world.physics.ownerClearance(object.id,a);
 assert(s.releaseClearance.minimumClearanceM<0);assert.throws(()=>a.chooseReleaseMotion(s),/身体.*物体|接触|穿入/);
 body.position.copy(safePosition);s.releaseClearance=safeClearance;rejectedPenetratingStarts++;
 results.push({shape,id:spec.id,yaw,plan:s.releaseMotionPlan});cases++;
}
assert(cases+rejectedPenetratingStarts>0);
console.log(JSON.stringify({cases,samples,withdrawals,rejectedPenetratingStarts,maxResidualM,results,browserExecuted:false,visualAcceptance:false}));
