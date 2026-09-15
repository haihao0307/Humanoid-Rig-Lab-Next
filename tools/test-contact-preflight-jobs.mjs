// Cooperative task lifecycle: no stale commit, pause/restart, cancellation,
// strict changing-input retries and preservation of dense geometry checks.
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
const code=math+'\n'+grasp+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(reference)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js')+'\n'+read('body/MotionLabActions.js')+'\n'+read('body/NaturalLocomotion.js')+'\n'+read('world/PhysicsContract.js')+'\n'+read('world/PhysicsWorld.js')+'\n'+read('world/GridNavigation.js')+'\n'+read('control/TaskAgent.js');
const api=vm.runInNewContext(code+'\n({agentPreflights,motionAdvancePreflight,motionChooseContactSteps,resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,MotionLabPose,motionChooseContact,motionValidateTransferContacts,motionValidateContactReach,motionCarrySamples,motionRequireContactHandClearance,motionContactAdapter,motionPreflightModel,motionLocalCertificate,motionReachHands,motionFreeHandEndpoints,contactHandSegments,contactHandObjectClearance,motionApproachDistance,rayBoundary,inv,norm,motionContactDescriptor,graspFrames,PhysicsWorld,Agent,frame,qy,qm,compose,sub,add,mul,rotate,dist,qangle})',{
 performance,structuredClone,WorkbenchPhysicsEngine:C,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'release-test',
 degrees:r=>r*180/Math.PI,radians:d=>d*Math.PI/180,r2Mean:f=>(f('left')+f('right'))*.5,DOWN:[0,-1,0],horizontal:(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),angleDiff:(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),MotionLab:{FlatWorld,MotionController,rigFromSource,FullBodyMotion,blend,relaxedHandRotation,solveTwoBone}});

let cases=0;
function lifecycle(){
 let input='initial',commits=0,finalized=0,created=0;
 const a=Object.assign(Object.create(api.Agent.prototype),{skill:{type:'carry'},plan:{steps:[{type:'carry'}]},index:0,phase:'settle',time:0,preflightInput:()=>input,fail(message){this.failed=message;}});
 const factory=function*(){created++;try{for(let i=0;i<1000000;i++)yield;return'valid';}finally{finalized++;}};
 const commit=result=>{assert.equal(result,'valid');commits++;};
 const step=()=>{const job=api.agentPreflights.get(a);if(job)job.nextSliceAt=0;a.advancePreflight(1/120);};
 return{a,factory,commit,step,setInput:v=>input=v,get commits(){return commits;},get finalized(){return finalized;},get created(){return created;}};
}
{
 const q=lifecycle();q.a.startPreflight('reach',q.factory,q.commit);q.step();q.a.cancelPreflight();q.step();assert.equal(q.commits,0);assert.equal(q.finalized,1);assert.equal(q.a.preflightWaiting,false);cases++;
}
{
 const q=lifecycle();q.a.startPreflight('lower',q.factory,q.commit);q.step();q.a.skill={type:'carry'};q.step();assert.equal(q.commits,0);assert.equal(q.a.preflightWaiting,false);cases++;
}
{
 const q=lifecycle();q.a.startPreflight('reach',q.factory,q.commit);q.step();q.a.pausePreflight();assert.equal(q.finalized,1);while(q.a.preflightWaiting)q.step();assert.equal(q.created,2);assert.equal(q.commits,1);cases++;
}
{
 const q=lifecycle();q.a.startPreflight('reach',q.factory,q.commit);q.step();q.setInput('changed-foot-and-object');q.step();assert.equal(q.commits,0);while(q.a.preflightWaiting)q.step();assert.equal(q.created,2);assert.equal(q.commits,1);cases++;
}
{
 const q=lifecycle();q.a.startPreflight('reach',function*(){throw Error('geometry rejected');},q.commit);q.step();assert.equal(q.commits,0);assert.equal(q.a.failed,'geometry rejected');assert.equal(q.a.preflightWaiting,false);cases++;
}
{
 const q=lifecycle();q.a.startPreflight('release',q.factory,q.commit);q.step();q.a.plan={steps:[{type:'carry'}]};q.step();assert.equal(q.commits,0);assert.equal(q.a.preflightWaiting,false);cases++;
}
// Actual cold contact, same samples/results as the synchronous public API.
const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),engine=new MotionController(rigFromSource(resolvedRig)),h={resolvedRig,bodyMetrics,sourceBind,arms:{},spine:[{id:'C1'}]};
h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
h.motionDriver=new api.MotionLabPose(h,engine);
const object={id:'tall',shape:'box',w:.3,h:.6,d:.3,p:[0,.3,.62],q:api.qy(.34),mass:.5,friction:.08,restitution:0,movable:true,collidable:true,v:[0,0,0],angularVelocity:[0,0,0]},world={objects:[object],bounds:{xMin:-13,xMax:13,zMin:-9,zMax:9},physicsSettings:{gravityMps2:9.81,groundFriction:.65},revision:0,collision:()=>false};world.physics=new api.PhysicsWorld(world);
engine.reset();engine.state.root=[0,bodyMetrics.standingHipHeightM,0];for(const side of ['left','right'])engine.state.feet[side]={position:engine.stance(engine.state,side),yaw:0,contact:true};engine.state.pose=engine.solve(engine.state);
const grips=api.graspFrames(object,0,false),ground=api.frame(object.p,object.q),hands=Object.fromEntries(['left','right'].map(s=>[s,api.compose(ground,grips[s])]));
const job={iterator:api.motionChooseContactSteps(h,[0,0,0],0,hands,world,[object.id],{objectPose:ground,grips})};let slices=0,totalMs=0;
while(!job.done){const begin=performance.now();api.motionAdvancePreflight(job,2);totalMs+=performance.now()-begin;slices++;}
if(job.error)throw job.error;assert(slices>30,'cold dense proof must span many bounded batches');assert(job.steps>800,'every original cold candidate interval still executes');
const sync=api.motionChooseContact(h,[0,0,0],0,hands,world,[object.id],{objectPose:ground,grips});assert.deepEqual(JSON.parse(JSON.stringify(sync)),JSON.parse(JSON.stringify(job.result)));cases++;
world.zones=[{id:'target',p:[0,0,2],r:.5,shape:'circle'}];
for(const [label,change,restore]of [
 ['zone radius',()=>world.zones[0].r=.25,()=>world.zones[0].r=.5],
 ['zone shape',()=>world.zones[0].shape='square',()=>world.zones[0].shape='circle'],
 ['mass',()=>object.mass=1,()=>object.mass=.5],
 ['friction',()=>object.friction=.5,()=>object.friction=.08],
 ['real foot yaw',()=>engine.state.feet.left.yaw=.001,()=>engine.state.feet.left.yaw=0],
 ['actual collider',()=>world.physics.bodies.get(object.id).body.shapes[0].halfExtents.x=.16,()=>world.physics.bodies.get(object.id).body.shapes[0].halfExtents.x=.15]
]){
 let commits=0;const a=Object.assign(Object.create(api.Agent.prototype),{h,w:world,locomotion:{engine},pos:[0,0,0],yaw:0,skill:{type:'carry',o:object,target:world.zones[0]},plan:{steps:[{type:'carry'}]},index:0,phase:'settle',grips,time:0,fail(message){this.failed=message;}});
 a.startPreflight('reach',function*(){for(let i=0;i<1000000;i++)yield;return true;},()=>commits++);a.advancePreflight(1/120);change();api.agentPreflights.get(a).nextSliceAt=0;a.advancePreflight(1/120);
 assert.equal(commits,0,label+' cannot accept a stale result');if(label.startsWith('zone'))assert.match(a.failed,/目标位置或范围/,'a changed placement target cannot reuse the old fixed destination');else assert.equal(api.agentPreflights.get(a).retries,1,label+' restarts exact geometry validation');a.cancelPreflight();restore();cases++;
}
console.log(JSON.stringify({cases,slices,steps:job.steps,maximumSliceMs:job.maximumSliceMs,totalMs,handClearance:job.result.handClearance,bodyClearance:job.result.bodyClearance,contract:'same dense geometry; cancelled/replaced/failed jobs never commit'}));
// Submission lifecycle is tested separately from the real geometry proof
// above: a queued, parsed plan must not become an executable partial plan.
for(const mode of ['complete','cancel','reject','replace']){
 const proposed={steps:[{type:'walk'},{type:'carry'},{type:'walk'}],lastObject:'box'};let checked=0;
 const submission=vm.runInNewContext(read('control/TaskAgent.js')+'\n({Agent,agentPreflights})',{
  performance,motionAdvancePreflight:api.motionAdvancePreflight,parse:()=>structuredClone(proposed),
  simulateSemanticPlanSteps:function*(){for(let n=0;n<3;n++){for(let i=0;i<300000;i++)yield;checked++;if(mode==='reject'&&n===1)return{feasible:false,reasons:['second step impossible']};}return{feasible:true};}
 });
 const a=Object.assign(Object.create(submission.Agent.prototype),{skill:null,plan:null,index:0,phase:'idle',time:0,w:{},basic:{},held:null,preflightInput:()=> 'unchanged',saveSafe(){},log(){},fail(message){this.failed=message;this.paused=true;}});
 a.activity=()=>({readyForTask:!a.preflightWaiting&&!a.plan});
 a.submit('搬运后返回',{cooperative:true});assert.equal(a.plan,null,'parse does not commit a plan');assert(a.preflightWaiting);assert(!a.activity().readyForTask);
 a.advancePreflight(1/120);assert.equal(a.plan,null,'a partially checked plan cannot execute');
 if(mode==='cancel')a.cancelPreflight();
 if(mode==='replace')a.plan={steps:[{type:'turn'}]};
 while(a.preflightWaiting){const pending=submission.agentPreflights.get(a);pending.nextSliceAt=0;a.advancePreflight(1/120);}
 if(mode==='complete'){assert.equal(checked,3);assert.deepEqual(JSON.parse(JSON.stringify(a.plan)),proposed);}
 else if(mode==='replace')assert.equal(a.plan.steps[0].type,'turn');
 else {assert.equal(a.plan,null);if(mode==='reject')assert.match(a.failed,/second step impossible/);}
 cases++;
}
console.log(JSON.stringify({cases,submissionCases:4,contract:'complete whole-plan validation before commit; no partial, cancelled, rejected or replaced late submission'}));




