// The outer turn target is acceleration-limited and slows before the planted
// foot twist guard, so the pinned R2.2 controller is not fed a 90-degree step.
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
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'turn-continuity-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff,bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}});
function create(){
 const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 const a={h,pos:[0,0,0],yaw:0,time:0,route:[],routeIndex:0,manipulationPace:()=>1,strength:{movementFactor:()=>1},w:{objects:[],bounds:{xMin:-100,xMax:100,zMin:-100,zMax:100},collision:()=>false,get:()=>null}};
 const locomotion=new api.NaturalLocomotion(a);a.locomotion=locomotion;return locomotion;
}
const cases=[Math.PI/2,-Math.PI/2,Math.PI];let frames=0,maxCommandSpeed=0,maxCommandAcceleration=0,maxActualSpeed=0,maxActualAcceleration=0,maxCommandLead=0,minSupportMargin=Infinity,pauses=0,maxPlacementRetargets=0;
for(const target of cases){
 const locomotion=create();let priorYaw=locomotion.engine.state.yaw,priorActualSpeed=0,complete=false;
 for(let i=0;i<4000;i++){
  const beforeYaw=locomotion.engine.state.yaw,moving=locomotion.turnInPlace(target,1/120),command=locomotion.turnFilter.report();
  maxCommandLead=Math.max(maxCommandLead,Math.abs(angleDiff(command.commandYaw,beforeYaw)));
  locomotion.update(1/120);frames++;
  const state=locomotion.engine.state,turn=locomotion.turnFilter.report(),actualSpeed=angleDiff(state.yaw,priorYaw)*120;
  maxCommandSpeed=Math.max(maxCommandSpeed,Math.abs(turn.velocityRadS));maxCommandAcceleration=Math.max(maxCommandAcceleration,Math.abs(turn.accelerationRadS2));
  maxActualSpeed=Math.max(maxActualSpeed,Math.abs(actualSpeed));maxActualAcceleration=Math.max(maxActualAcceleration,Math.abs((actualSpeed-priorActualSpeed)*120));
  minSupportMargin=Math.min(minSupportMargin,turn.supportMarginRad);maxPlacementRetargets=Math.max(maxPlacementRetargets,turn.placementRetargets||0);
  if(Math.abs(actualSpeed)<1e-8&&Math.abs(angleDiff(target,state.yaw))>.05)pauses++;
  assert(maxCommandLead<=1.001/120,'each outer command must stay within one bounded fixed-step increment');
  priorYaw=state.yaw;priorActualSpeed=actualSpeed;
  if(!moving&&locomotion.isSettled()){complete=true;break;}
 }
 if(!complete)console.error('INCOMPLETE',{target,state:locomotion.engine.state,turn:locomotion.turnFilter.report(),settled:locomotion.isSettled()});
 assert(complete,'turn must complete: '+target);
 assert(Math.abs(angleDiff(target,locomotion.engine.state.yaw))<.016);
}
assert(maxCommandSpeed<=1.001,'outer turn speed must remain bounded');
assert(maxCommandAcceleration<=5.201,'outer turn acceleration and deceleration must remain bounded');
assert(maxActualSpeed<=1.101,'pinned controller speed limit remains intact');
assert(maxActualAcceleration<=10.001,'support-aware braking must bound the committed root acceleration outside foot-placement pauses');
assert(pauses>0,'placement steps still create support waits instead of twisting planted feet');
assert(maxPlacementRetargets>0,'swing feet must be retargeted toward the predicted turn landing');
assert(frames<2000,'90/180-degree turn regression must not return to the old excessive placement count');
console.log(JSON.stringify({schema:'human/turn_command_continuity@1',cases:cases.length,frames,maxCommandSpeed,maxCommandAcceleration,maxActualSpeed,maxActualAcceleration,maxCommandLead,minSupportMargin,pausedFrames:pauses,maxPlacementRetargets,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
