// Actual release sequence and body clock, across speeds, curves and stop/start.
// Contact residuals alone do not catch repeated leading-foot steps or freezes.
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
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,NaturalLocomotion,dist})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'phase-continuity-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff,bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}});
const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
const a={h,pos:[0,0,0],yaw:0,time:0,route:[],routeIndex:0,manipulationPace:()=>1,strength:{movementFactor:()=>1},w:{objects:[],bounds:{xMin:-100,xMax:100,zMin:-100,zMax:100},collision:()=>false,get:()=>null}};
const locomotion=new api.NaturalLocomotion(a);a.locomotion=locomotion;

const dt=1/120,mean=v=>v.reduce((a,b)=>a+b,0)/v.length,results=[];
function run(route,speed,{stopAt=null,reset=true,curve=0}={}){
 if(reset){a.pos=[0,0,0];a.yaw=0;locomotion.resetFromPose();}
 a.route=route.map(p=>[...p]);a.routeIndex=0;let lastSide=null,phase=locomotion.phaseController.phase,lastTime=null,frozen=0,steady=0,samples=0,anticipated=0;
 const strides=[],intervals=[];let finished=false,stop=false;
 for(let i=0;i<8000;i++){
  const before=structuredClone(locomotion.engine.state);
  if(stopAt!==null&&i*dt>=stopAt)stop=true;
  const moving=stop?(locomotion.stop(),true):locomotion.move(dt,speed);
  locomotion.update(dt);a.time+=dt;samples++;
  const s=locomotion.engine.state,candidate=locomotion.pose.build();locomotion.pose.validate(candidate);
  const rate=(locomotion.phaseController.phase-phase)/dt;phase=locomotion.phaseController.phase;
  for(const side of ['left','right'])if(before.feet[side].contact&&s.feet[side].contact)
   assert(api.dist(before.feet[side].position,s.feet[side].position)<1e-9,'a planted foot must not move to create the rhythm');
  if(s.speed>.45&&i*dt>2&&!stop){steady++;if(rate<.05)frozen++;}
  if(s.swing&&!before.swing&&s.speed>.40&&!stop&&horizontal(a.pos,route.at(-1))>.35){
   if(!curve&&lastSide)assert.notEqual(s.swing.side,lastSide,'straight walking must alternate, not step twice with the leading foot');
   if(i*dt>2){strides.push(horizontal(s.swing.from,s.swing.target));if(lastTime!==null)intervals.push(a.time-lastTime);}
   lastSide=s.swing.side;lastTime=a.time;
   const preview=angleDiff(s.swing.yaw,s.yaw);assert(Math.abs(preview)<=.240001);
   if(curve&&preview*curve>.02)anticipated++;
  }
  if((!moving||stop)&&locomotion.isSettled()){finished=true;break;}
 }
 assert(finished,'the whole chain must settle');assert(locomotion.canTransition('greet'));
 assert(frozen===0,'steady arm/body phase cannot stall while legs continue');
 if(!stop)assert(horizontal(a.pos,route.at(-1))<=.016);
 if(curve)assert(anticipated>0,'free foot must land into the requested curve');
 const result={speed,curve,stop,samples,steady,frozen,steps:locomotion.engine.state.metrics.steps,meanStrideM:strides.length?mean(strides):null,meanIntervalS:intervals.length?mean(intervals):null,anticipated};
 results.push(result);return result;
}
const fast=run([[0,0,4]],.48),slow=run([[0,0,3]],.18),middle=run([[0,0,3]],.30);
assert(slow.meanStrideM<fast.meanStrideM*.75&&slow.meanStrideM>fast.meanStrideM*.45,'slow walking must shorten its steps');
assert(slow.meanIntervalS>fast.meanIntervalS*1.25&&slow.meanIntervalS<fast.meanIntervalS*2,'slow cadence must change without simply replaying the whole stride in slow motion');
assert(middle.meanStrideM>slow.meanStrideM&&middle.meanStrideM<fast.meanStrideM);
for(const sign of [-1,1]){
 const route=Array.from({length:9},(_,i)=>{const t=(i+1)*Math.PI/20;return[sign*1.6*(1-Math.cos(t)),0,1.6*Math.sin(t)];});
 run(route,.48,{curve:sign});
}
run([[0,0,4]],.48,{stopAt:2.1});
const root=[...a.pos];run([[root[0],0,root[2]+1.2]],.30,{reset:false});
console.log(JSON.stringify({schema:'human/locomotion-step-rhythm@1',results,visualAcceptance:false}));
