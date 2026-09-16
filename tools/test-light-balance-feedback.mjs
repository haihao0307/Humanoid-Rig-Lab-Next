// Lightweight balance feedback must remain bounded, preserve foot anchors and
// stay outside the locked Motion-Lab source modules.
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
const code=math+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(rig)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js')+'\n'+read('body/NaturalLocomotion.js')+'\n'+read('body/LightBalanceFeedback.js');
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,NaturalLocomotion,dist})',{
 structuredClone,URLSearchParams,location:{search:''},SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'light-balance-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff:(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}});
const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
const strength={bodyMassKg:70,lastAssessment:null,movementFactor:()=>1},a={h,pos:[0,0,0],yaw:0,time:0,phase:'walk',route:[[0,0,2]],routeIndex:0,manipulationPace:()=>1,strength,w:{objects:[],bounds:{xMin:-10,xMax:10,zMin:-10,zMax:10},collision:()=>false}};
const locomotion=new api.NaturalLocomotion(a);a.locomotion=locomotion;let maxFootErrorM=0,maxPitchRad=0,maxRollRad=0,minPaceScale=1,samples=0;
for(let i=0;i<1800;i++){
 const moving=locomotion.move(1/120);locomotion.update(1/120);a.time+=1/120;
 const candidate=locomotion.pose.build(),report=locomotion.pose.validate(candidate),balance=locomotion.report().lightBalance;samples++;
 maxFootErrorM=Math.max(maxFootErrorM,report.footErrorM);maxPitchRad=Math.max(maxPitchRad,Math.abs(balance.pitchRad));maxRollRad=Math.max(maxRollRad,Math.abs(balance.rollRad));minPaceScale=Math.min(minPaceScale,balance.paceScale);
 assert(balance.enabled&&balance.active);assert(Math.abs(balance.pitchRad)<=.045+1e-12);assert(Math.abs(balance.rollRad)<=.040+1e-12);assert(balance.paceScale>=.82-1e-12&&balance.paceScale<=1+1e-12);
 if(!moving&&locomotion.isSettled())break;
}
assert(samples>100&&maxPitchRad>0,'root acceleration should produce a bounded torso response');assert(maxFootErrorM<1e-7,'light feedback must preserve independent foot anchors');
a.held={mass:18,p:[a.pos[0],a.pos[1]+.25,a.pos[2]+.35]};strength.lastAssessment={measuredAccelerationVectorMps2:[0,0,2]};
for(let i=0;i<60;i++){locomotion.update(1/120);a.time+=1/120;}
const loaded=locomotion.report().lightBalance;assert(Math.abs(loaded.pitchRad)>0&&loaded.paceScale<=1);
a.basic={posture:'sitting',busy:true};locomotion.update(1/120);const disabled=locomotion.report().lightBalance;assert.equal(disabled.active,false);
console.log(JSON.stringify({schema:'human/light_balance_feedback@1',samples,maxFootErrorM,maxPitchRad,maxRollRad,minPaceScale,loaded,disabled,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
