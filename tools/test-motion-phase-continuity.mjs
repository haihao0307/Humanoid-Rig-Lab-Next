// Continuous upper-body phase must advance across foot switches and double
// support without the old swing-event reassignment jump.
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
let previous=locomotion.phaseController.report().phaseUnwrapped,maxObservedStep=0,maxSwitchStep=0,doubleSupportAdvances=0,sideSwitches=0,lastSide=null,frames=0,completedWalks=0,restartStep=0;
const walk=end=>{
 a.route=[end];a.routeIndex=0;let completed=false,firstActiveStep=null;
 for(let i=0;i<6000;i++){
  const moving=locomotion.move(1/120);locomotion.update(1/120);frames++;
  const report=locomotion.phaseController.report(),step=report.phaseUnwrapped-previous;
  assert(step>=-1e-12,'unwrapped gait phase cannot reverse');
  maxObservedStep=Math.max(maxObservedStep,step);
  const side=locomotion.engine.state.swing?.side||null;
  if(side&&firstActiveStep===null)firstActiveStep=step;
  if(side&&lastSide&&side!==lastSide){sideSwitches++;maxSwitchStep=Math.max(maxSwitchStep,step);}
  if(side)lastSide=side;
  if(!side&&locomotion.engine.state.speed>.05&&step>1e-7)doubleSupportAdvances++;
  previous=report.phaseUnwrapped;
  if(!moving&&locomotion.isSettled()){completed=true;break;}
 }
 assert(completed,'walk must complete');completedWalks++;return firstActiveStep??0;
};
walk([0,0,2.2]);restartStep=walk([0,0,3.5]);
assert(completedWalks===2,'test must include a stop and restart');
assert(sideSwitches>=4,'test must cover repeated left/right contact events');
assert(doubleSupportAdvances>0,'phase must continue through moving double support');
const report=locomotion.phaseController.report();
assert(maxObservedStep<.025,'phase acquisition and all later fixed steps must remain bounded');
assert(restartStep<.025,'a new walk after standing must recalibrate without a phase jump');
assert(report.maximumStep<.025,'fixed-step phase increment must remain bounded');
assert(maxSwitchStep<.025,'foot switches must not reset the upper-body phase');
assert(report.contactCorrections>=sideSwitches,'contact events must inform the continuous phase controller');
console.log(JSON.stringify({schema:'human/motion_phase_continuity@1',frames,completedWalks,restartStep,sideSwitches,doubleSupportAdvances,maxObservedStepIncludingAcquisition:maxObservedStep,maxPhaseStep:report.maximumStep,maxSwitchPhaseStep:maxSwitchStep,report,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
