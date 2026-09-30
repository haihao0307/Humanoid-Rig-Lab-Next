// Natural turn R27 checks the complete adapter rather than only the pinned
// controller's yaw clamp. It verifies stable step-turn placement, axial lead,
// planted-foot locks and bounded pauses for both directions and multiple angles.
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
const code=math+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(rig)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js')+'\n'+read('body/NaturalLocomotion.js')+'\n'+read('body/LightBalanceFeedback.js')+'\n'+read('body/NaturalTurnR27.js');
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,NaturalLocomotion,NATURAL_TURN_R27,dist})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'natural-turn-r27-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff,bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),
 MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}
});
function create({carried=false}={}){
 const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 const held=carried?{id:'test-load',mass:8,p:[0,1.05,.35]}:null;
 const a={h,held,pos:[0,0,0],yaw:0,time:0,phase:'turn',route:[],routeIndex:0,manipulationPace:()=>carried?.82:1,strength:{movementFactor:()=>1,bodyMassKg:72},w:{objects:[],bounds:{xMin:-100,xMax:100,zMin:-100,zMax:100},collision:()=>false,get:()=>null}};
 const locomotion=new api.NaturalLocomotion(a);a.locomotion=locomotion;return locomotion;
}
const degrees=[15,30,45,90,135,180],directions=[-1,1],dt=1/120;
let totalFrames=0,maximumHardPauseS=0,maximumYawAccelerationRadS2=0,maximumYawJerkRadS3=0,maximumStepCount=0,minimumHeadAdvantageRad=Infinity,minimumThoraxAdvantageRad=Infinity;
const cases=[];
for(const carried of [false,true])for(const sign of directions)for(const angleDegrees of degrees){
 const target=sign*angleDegrees*Math.PI/180,locomotion=create({carried});let complete=false,earlySamples=0,headAdvantage=Infinity,thoraxAdvantage=Infinity;
 const planted={left:null,right:null};
 for(let i=0;i<5000;i++){
  const moving=locomotion.turnInPlace(target,dt);locomotion.update(dt);locomotion.pose.build({});totalFrames++;
  const state=locomotion.engine.state,turn=locomotion.report().naturalTurn||locomotion.report().lastNaturalTurn;
  for(const side of ['left','right']){
   const foot=state.feet[side];
   if(foot.contact&&planted[side])assert(api.dist(foot.position,planted[side])<1e-8,'planted foot drifted during turn');
   planted[side]=foot.contact?[...foot.position]:null;
  }
  if(turn){
   maximumHardPauseS=Math.max(maximumHardPauseS,turn.maximumHardPauseS||0);maximumYawAccelerationRadS2=Math.max(maximumYawAccelerationRadS2,turn.maximumYawAccelerationRadS2||0);maximumYawJerkRadS3=Math.max(maximumYawJerkRadS3,turn.maximumYawJerkRadS3||0);maximumStepCount=Math.max(maximumStepCount,turn.stepsCompleted||0);
   const axial=turn.axial||{},head=Math.abs(axial.headGlobalLeadRad||0),thorax=Math.abs(axial.thoraxGlobalLeadRad||0),lumbar=Math.abs(axial.lumbarGlobalLeadRad||0);
   if(turn.phase==='turning'&&turn.rootProgress>.03&&turn.rootProgress<.72&&head>.005){earlySamples++;headAdvantage=Math.min(headAdvantage,head-thorax);thoraxAdvantage=Math.min(thoraxAdvantage,thorax-lumbar);}
  }
  if(!moving&&locomotion.isSettled()){complete=true;break;}
 }
 assert(complete,`turn did not complete: ${sign*angleDegrees} degrees carried=${carried}`);
 assert(Math.abs(angleDiff(target,locomotion.engine.state.yaw))<.016,'final yaw must meet the target');
 const final=locomotion.report().naturalTurn||locomotion.report().lastNaturalTurn;
 assert(final,'turn diagnostics missing');
 assert((final.stepsCompleted||0)<=Math.ceil(Math.abs(target)/(carried?.44:.56))+3,'turn used excessive correction steps');
 assert((final.maximumHardPauseS||0)<.24,'turn retained a visible hard support pause');
 if(angleDegrees>=45){assert(earlySamples>0,'axial lead was never sampled');assert(headAdvantage>-1e-4,'head must not lag the thorax during turn initiation');assert(thoraxAdvantage>-.03,'thorax must not collapse into an en-bloc pelvis turn');minimumHeadAdvantageRad=Math.min(minimumHeadAdvantageRad,headAdvantage);minimumThoraxAdvantageRad=Math.min(minimumThoraxAdvantageRad,thoraxAdvantage);}
 cases.push({angleDegrees:sign*angleDegrees,carried,steps:final.stepsCompleted,plannedSteps:final.plannedSteps,maximumHardPauseS:final.maximumHardPauseS,headLeadRad:final.maximumObservedHeadLeadRad,thoraxLeadRad:final.maximumObservedThoraxLeadRad,durationS:final.elapsedS});
}
assert(maximumYawAccelerationRadS2<18,'root angular acceleration is unbounded');
assert(totalFrames<36000,'turn matrix became excessively slow');
console.log(JSON.stringify({schema:'human/natural_turn_r27_test@1',revision:api.NATURAL_TURN_R27.revision,cases,totalFrames,maximumHardPauseS,maximumYawAccelerationRadS2,maximumYawJerkRadS3,maximumStepCount,minimumHeadAdvantageRad,minimumThoraxAdvantageRad,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
