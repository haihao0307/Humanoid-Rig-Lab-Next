import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {MotionController} from '../motion/vendor/controller.mjs';
import {rigFromSource} from '../motion/vendor/rig.mjs';
import {FlatWorld} from '../motion/vendor/world.mjs';
import {solveTwoBone} from '../motion/vendor/math.mjs';
import {createCharacterShapeField,CHARACTER_DEFORMATION_RULES} from '../reconstruction/shape-deform.mjs';
import {normalizeCharacterShape,characterShapeParameterKey,SHAPE_SCHEMA,SHAPE_REVISION} from '../reconstruction/shape-contract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const rig=JSON.parse(read('reconstruction/rig-reference.json')),motion=read('reconstruction/motion-reference.json'),turn=read('reconstruction/turn-reference.json');
const fullBody=read('motion/vendor/full-body.mjs').replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL('../motion/vendor/'+path,import.meta.url).href));
const {FullBodyMotion,blend,relaxedHandRotation}=await import('data:text/javascript;base64,'+Buffer.from(fullBody+'\nexport {blend,relaxedHandRotation};').toString('base64'));
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const stub='function motionContactDescriptor(){return{controlledFeet:true,motionSource:{kind:"test"}}}\n';
const code=math+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(rig)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+
 read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',motion)+'\n'+read('body/ContactHandPose.js')+'\n'+
 read('body/MotionLabPose.js')+'\n'+read('body/NaturalLocomotion.js')+'\n'+stub+read('body/TurnMotion.js').replace('/*__TURN_MOTION_JSON__*/',turn);
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,NaturalLocomotion,dist,qy,rotate})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'turn-motion-r1-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff,bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}
});
function create(){
 const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 const a={h,pos:[0,0,0],yaw:0,time:0,route:[],routeIndex:0,manipulationPace:()=>1,strength:{movementFactor:()=>1},w:{objects:[],bounds:{xMin:-100,xMax:100,zMin:-100,zMax:100},collision:()=>false,get:()=>null}};
 const locomotion=new api.NaturalLocomotion(a);a.locomotion=locomotion;return locomotion;
}
const cases=[Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI,-Math.PI];
const results=[];let globalMaxSpeed=0,globalMaxAcceleration=0,globalMaxJerk=0;
for(const target of cases){
 const locomotion=create();let previousYaw=locomotion.engine.state.yaw,previousSpeed=0,previousAcceleration=0,complete=false,sawCapture=false,sawOverlay=false,maxFootOrderingError=0,frames=0;
 for(let i=0;i<6000;i++){
  const moving=locomotion.turnInPlace(target,1/120),turnState=locomotion.turnMotionR1;
  if(turnState?.clip)sawCapture=true;
  if(turnState?.active&&turnState.progress>.18&&turnState.progress<.82){const base=locomotion.pose.frameData(locomotion.engine.state,null),overlay=turnState.overlay(base);if(overlay){sawOverlay=true;assert.equal(overlay.motionSource.kind,'capture-turn-overlay');}}
  locomotion.update(1/120);frames++;
  const state=locomotion.engine.state,speed=angleDiff(state.yaw,previousYaw)*120,acceleration=(speed-previousSpeed)*120,jerk=(acceleration-previousAcceleration)*120;
  globalMaxSpeed=Math.max(globalMaxSpeed,Math.abs(speed));globalMaxAcceleration=Math.max(globalMaxAcceleration,Math.abs(acceleration));globalMaxJerk=Math.max(globalMaxJerk,Math.abs(jerk));
  const localLeft=api.rotate(api.qy(-state.yaw),[state.feet.left.position[0]-state.root[0],0,state.feet.left.position[2]-state.root[2]]),localRight=api.rotate(api.qy(-state.yaw),[state.feet.right.position[0]-state.root[0],0,state.feet.right.position[2]-state.root[2]]);
  maxFootOrderingError=Math.max(maxFootOrderingError,localLeft[0]-localRight[0]);
  assert(maxFootOrderingError<.08,'turning feet must not deeply cross');
  previousYaw=state.yaw;previousSpeed=speed;previousAcceleration=acceleration;
  if(!moving&&locomotion.isSettled()){complete=true;break;}
 }
 assert(complete,'turn must complete: '+target);assert(sawCapture,'turn must select a CMU capture');assert(sawOverlay,'turn must emit a captured upper-body overlay');
 assert(Math.abs(angleDiff(target,locomotion.engine.state.yaw))<.016,'final yaw mismatch');assert(frames<5000,'turn took too long');
 const report=locomotion.report().turnMotion;assert.equal(report.finishReason,'completed');assert.equal(report.visualAcceptance,false);
 results.push({targetRad:target,frames,clip:report.clip,sourceTrial:report.sourceTrial,durationS:report.durationS,timelineHeldFrames:report.timelineHeldFrames,maxFootOrderingError});
}
assert(globalMaxSpeed<=1.101,'committed root speed exceeds pinned controller');
assert(globalMaxAcceleration<=10.01,'committed root acceleration exceeds guarded bound');
assert(Number.isFinite(globalMaxJerk));
console.log(JSON.stringify({schema:'human/turn_motion_runtime_test@1',cases:results,maxRootAngularSpeedRadS:globalMaxSpeed,maxRootAngularAccelerationRadS2:globalMaxAcceleration,maxRootAngularJerkRadS3:globalMaxJerk,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
