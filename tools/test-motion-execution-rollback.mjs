// Replay motion after Agent failure using the production rollback boundary.
// Physics and pose commit are stubs; gait, IK and feedback execute on the CPU.
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
const code=math+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(rig)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js')+'\n'+read('body/NaturalLocomotion.js')+'\n'+read('body/LightBalanceFeedback.js')+'\n'+read('control/TaskAgent.js');
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,NaturalLocomotion,Agent,dist})',{
 structuredClone,URLSearchParams,location:{search:''},SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'light-balance-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff:(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}});
const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
const strength={bodyMassKg:70,lastAssessment:null,movementFactor:()=>1},a={h,pos:[0,0,0],yaw:0,time:0,phase:'walk',route:[[0,0,2]],routeIndex:0,manipulationPace:()=>1,strength,w:{objects:[],bounds:{xMin:-10,xMax:10,zMin:-10,zMax:10},collision:()=>false}};
const locomotion=new api.NaturalLocomotion(a);a.locomotion=locomotion;
Object.assign(a,{basic:{posture:'standing'},stats:{failed:0},evidence:[],index:0,log:()=>{},cancelPreflight:()=>{}});
a.w.physics={capture:()=>({}),restore:()=>{}};strength.state={};
// The test uses real Agent save/fail, without constructing a renderer, skin
// or physics world. Visible-pose serialization is independent of this fix.
locomotion.pose.snapshot=()=>({});locomotion.pose.restore=()=>{};
const save=()=>api.Agent.prototype.saveSafe.call(a),fail=()=>api.Agent.prototype.fail.call(a,'injected rejected pose');
const normalize=value=>JSON.parse(JSON.stringify(value));
const equal=(actual,expected,message)=>assert.deepEqual(normalize(actual),normalize(expected),message);
const state=()=>({kernel:locomotion.engine.snapshot(),execution:locomotion.snapshotExecution()});
let cases=0,replayedSteps=0,maxFootErrorM=0;
const tick=kind=>{
 if(kind==='turn')locomotion.turnInPlace(Math.PI/2,1/120);else locomotion.move(1/120);
 locomotion.update(1/120);a.time+=1/120;
 const candidate=locomotion.pose.build(),report=locomotion.pose.validate(candidate);
 maxFootErrorM=Math.max(maxFootErrorM,report.footErrorM);
 return {state:state(),frames:[...candidate.frames]};
};
const replay=kind=>{
 save();const saved=state(),phaseIdentity=locomotion.phaseController,turnIdentity=locomotion.turnFilter;
 const callback=locomotion.engine.motion.advance,originalAdvance=phaseIdentity.originalAdvance;
 const expected=Array.from({length:6},()=>tick(kind));
 assert.notEqual(JSON.stringify(state()),JSON.stringify(saved),'fixture must advance mutable motion history');
 fail();equal(state(),saved,'Agent failure restores kernel AND execution filters');
 assert.equal(locomotion.phaseController,phaseIdentity);assert.equal(locomotion.turnFilter,turnIdentity);
 assert.equal(locomotion.engine.motion.advance,callback);assert.equal(phaseIdentity.originalAdvance,originalAdvance);
 assert.equal(phaseIdentity.engine,locomotion.engine,'restoration retains the live phase engine');
 if(saved.execution.balance){assert.equal(h.__lightBalanceFeedback,locomotion.balanceFeedback);assert.equal(locomotion.balanceFeedback.a,a);}
 else{assert.equal(locomotion.balanceFeedback,null);assert.equal(h.__lightBalanceFeedback,undefined,'failed first tick leaves no feedback hook');}
 for(const expectedStep of expected){equal(tick(kind),expectedStep,'replaying the same command reproduces phase, feet, lean and candidate pose');replayedSteps++;}
 // Restore from the same checkpoint twice: live mutations cannot alias it.
 fail();equal(state(),saved,'reusing a checkpoint must remain deterministic');cases++;
};
replay('walk'); // feedback does not exist at the first checkpoint
for(let i=0;i<90;i++)tick('walk');
assert(locomotion.phaseController.phase>0,'walking fixture advances the unwrapped phase');
assert(locomotion.balanceFeedback.active,'walking fixture includes active feedback');
replay('walk');
a.route=[];a.routeIndex=0;a.phase='turn';locomotion.resetFromPose();
for(let i=0;i<12;i++)tick('turn');
assert(Math.abs(locomotion.turnFilter.velocity)>0,'turn fixture contains angular momentum');
replay('turn');
console.log(JSON.stringify({schema:'human/motion_execution_rollback@1',cases,replayedSteps,maxFootErrorM,
 agentFailureExecuted:true,motionExecuted:true,physicsExecuted:false,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
