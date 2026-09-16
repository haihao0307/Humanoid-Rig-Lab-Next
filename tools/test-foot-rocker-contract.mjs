// Explicit support pivots, projected/full pose agreement, corrupted target
// rejection, balance footprint and settled free/carry support-mode handoffs.
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
const api=vm.runInNewContext(code+'\n'+read('body/LightBalanceFeedback.js')+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,NaturalLocomotion,dist,LightBalanceFeedback})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'phase-continuity-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff,bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}});
const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
const a={h,pos:[0,0,0],yaw:0,time:0,route:[],routeIndex:0,manipulationPace:()=>1,strength:{movementFactor:()=>1},w:{objects:[],bounds:{xMin:-100,xMax:100,zMin:-100,zMax:100},collision:()=>false,get:()=>null}};
const locomotion=new api.NaturalLocomotion(a);a.locomotion=locomotion;
let samples=0,heel=0,forefoot=0,projectedSamples=0,corruptionRejected=false,completeTransfers=0;
const supportStages={left:'air',right:'air'};
const dt=1/120,projected=locomotion.pose.forPreflight();
function walk(target,flat,changeHeld){
 a.route=[target];a.routeIndex=0;
 for(let i=0;i<3000;i++){
  if(i===120&&changeHeld){a.held=changeHeld==='pickup'?{mass:0}:null;assert(!locomotion.isSettled());}
  const moving=locomotion.move(dt);locomotion.update(dt);const state=locomotion.engine.state;
  assert.equal(locomotion.usesFlatSupport(),flat,'held-object changes cannot switch support mode mid-stride');
  const full=locomotion.pose.build();locomotion.pose.validate(full);samples++;
  if(flat){
   assert.equal(state.pelvisSupportLiftM||0,0,'loaded flat-support mode cannot inherit a free-walk body lift');
   for(const foot of Object.values(state.feet))assert(!foot.rocker,'carry execution uses the flat-support preflight contract');
  }
  for(const foot of Object.values(state.feet))if(foot.contact&&foot.rocker?.pitch){
   if(foot.rocker.kind==='heel')heel++;else forefoot++;
  }
  if(!flat)for(const side of ['left','right']){
   const foot=state.feet[side],kind=foot.rocker?.kind;
   if(!foot.contact)supportStages[side]='air';
   else if(kind==='heel')supportStages[side]='heel';
   else if(kind==='sole'&&supportStages[side]==='heel')supportStages[side]='sole';
   else if(kind==='forefoot'&&supportStages[side]==='sole'){completeTransfers++;supportStages[side]='forefoot';}
  }
  if(i%40===0){
   projected.engine.state=state;const short=projected.build();projected.validate(short);
   for(const [id,f]of short.frames){assert(api.dist(f.p,full.frames.get(id).p)<1e-10);for(let k=0;k<4;k++)assert(Math.abs(f.q[k]-full.frames.get(id).q[k])<1e-10);}
   projectedSamples++;
  }
  if(!corruptionRejected&&full.errors.some(e=>e.kind?.endsWith('-support'))){
   const contact=full.errors.find(e=>e.kind?.endsWith('-support'));contact.target[0]+=.03;
   locomotion.pose.measureEffectors(full);assert.throws(()=>locomotion.pose.validate(full),/脚|接触|足/);corruptionRejected=true;
   const rolled=Object.values(state.feet).find(f=>f.contact&&f.rocker?.pitch);
   const proxy=locomotion.balanceFeedback.support({...state,feet:{one:rolled}});
   assert(api.dist(proxy.centre,rolled.rocker.world)<1e-10,'balance centre follows the actual heel or forefoot');
   assert(proxy.halfZ<.02,'rolling contact cannot retain a full flat-sole support length');
  }
  if(!moving&&locomotion.isSettled()){
   assert.equal(state.pelvisSupportLiftM||0,0,'next action waits for body support lift to settle');return;
  }
 }
 assert.fail('support mode must settle before its next handoff');
}
walk([0,0,1.6],false,'pickup');walk([0,0,2.6],true,'drop');walk([0,0,3.2],false,null);
assert(heel>50&&forefoot>50&&corruptionRejected);assert(projectedSamples>30);
assert(completeTransfers>=2,'steady walking must pass through heel, flat sole and forefoot in order');
console.log(JSON.stringify({schema:'human/foot_rocker_contract@1',samples,heel,forefoot,completeTransfers,projectedSamples,corruptionRejected,modeHandoffs:2,browserExecuted:false,visualAcceptance:false}));
