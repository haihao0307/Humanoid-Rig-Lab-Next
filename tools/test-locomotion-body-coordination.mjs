// Execute the production gait and full pose builder: speed-dependent arm
// response, contralateral coordination and mirrored head/chest turn response.
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
// Quantify coordination, not only the absence of discontinuities.
const dt=1/120,rows=[];
a.route=[[0,0,3]];a.routeIndex=0;
for(let i=0;i<3000;i++){
 const moving=locomotion.move(dt);locomotion.update(dt);
 const s=locomotion.engine.state,f=s.motion.frame;
 const forward=p=>p[0]*Math.sin(s.yaw)+p[2]*Math.cos(s.yaw);
 const pose=locomotion.pose.build();locomotion.pose.validate(pose);
 const axis=part=>{const L=pose.frames.get('left_'+part).p,R=pose.frames.get('right_'+part).p,d=R.map((v,i)=>v-L[i]);
  const x=d[0]*Math.cos(s.yaw)-d[2]*Math.sin(s.yaw),z=forward(d);
  return{yaw:Math.atan2(-z,x),roll:Math.atan2(d[1],Math.hypot(x,z))};};
 const pelvis=axis('femur'),shoulders=axis('upperArm');
 rows.push({speed:locomotion.speed,drive:locomotion.phaseController.drive,phaseError:locomotion.phaseController.error,
  pelvisYaw:pelvis.yaw,pelvisRoll:pelvis.roll,shoulderYaw:shoulders.yaw,
  foot:forward(s.feet.left.position)-forward(s.feet.right.position),arm:f.leftUpperArm[2]-f.rightUpperArm[2]});
 if(!moving&&locomotion.isSettled())break;
}
const steady=rows.filter(r=>r.speed>.40),cov=steady.reduce((s,r)=>s+r.foot*r.arm,0),mag=Math.sqrt(steady.reduce((s,r)=>s+r.foot*r.foot,0)*steady.reduce((s,r)=>s+r.arm*r.arm,0));
const range=key=>(Math.max(...steady.map(r=>r[key]))-Math.min(...steady.map(r=>r[key])))*180/Math.PI;
assert(range('pelvisYaw')>8&&range('pelvisRoll')>3,'committed hip centres must retain captured pelvic rotation instead of a locked horizontal axis');
assert(range('shoulderYaw')>2,'captured torso response must survive contact retargeting');
console.log(JSON.stringify({frames:rows.length,steady:steady.length,armLegCorrelation:cov/mag,pelvisYawRangeDegrees:range('pelvisYaw'),pelvisRollRangeDegrees:range('pelvisRoll'),shoulderYawRangeDegrees:range('shoulderYaw'),maxDrive:Math.max(...rows.map(r=>r.drive)),meanPhaseError:steady.reduce((s,r)=>s+Math.abs(r.phaseError),0)/steady.length}));
assert(steady.length>300);assert(cov/mag<-.35,'same-side arm and foot must predominantly travel in opposing directions');
assert(Number.isInteger(locomotion.phaseController.phaseOffset),'support calibration must preserve source left/right phase, not erase error with a fractional offset');
assert(locomotion.phaseController.drive<.001,'arm drive must decay after stopping');
const fastDrive=Math.max(...rows.map(r=>r.drive));
a.pos=[0,0,0];a.yaw=0;locomotion.resetFromPose();a.route=[[0,0,.8]];a.routeIndex=0;
let slowDrive=0,slowFrames=0;
for(let i=0;i<3000;i++){
 const moving=locomotion.move(dt,.18);locomotion.update(dt);slowFrames++;
 slowDrive=Math.max(slowDrive,locomotion.phaseController.drive);locomotion.pose.validate(locomotion.pose.build());
 if(!moving&&locomotion.isSettled())break;
}
assert(slowFrames<3000);assert(slowDrive<fastDrive*.5,'slowing world speed must lower arm amplitude even when the kernel speed is unchanged');
const turns=[];
for(const sign of [-1,1]){
 a.pos=[0,0,0];a.yaw=0;locomotion.resetFromPose();let maximumHead=0,maximumChest=0,earlyLead=0,maximumDrive=0,maximumClearance=0,frames=0;
 for(let i=0;i<1800;i++){
  const moving=locomotion.turnInPlace(sign*Math.PI/2,dt);locomotion.update(dt);frames++;
  const c=locomotion.phaseController;
  maximumHead=Math.max(maximumHead,sign*c.headLead);maximumChest=Math.max(maximumChest,sign*c.chestLead);
  if(i<30)earlyLead=Math.max(earlyLead,sign*(c.headLead-c.chestLead));
  maximumDrive=Math.max(maximumDrive,c.drive);locomotion.pose.validate(locomotion.pose.build());
  maximumClearance=Math.max(maximumClearance,locomotion.engine.state.swing?.clearanceHeightM||0);
  if(!moving&&locomotion.isSettled())break;
 }
 assert(frames<1800);assert(earlyLead>.15,'head must orient before the chest, in either turn direction');
 assert(maximumHead<=.551&&maximumChest<=.181,'orientation lead must remain bounded');
 assert(maximumDrive<.001,'stationary placement steps must not activate a walking arm cycle');
 assert(maximumClearance>.018&&maximumClearance<.04,'small turning steps must not use the old 65 mm marching clearance');
 for(let i=0;i<240;i++)locomotion.update(dt);
 assert(Math.abs(locomotion.phaseController.headLead)<.001&&Math.abs(locomotion.phaseController.chestLead)<.001,'turn response must settle instead of leaving a twisted idle pose');
 turns.push({sign,frames,maximumHead,maximumChest,earlyLead,maximumDrive,maximumClearance});
}
assert(Math.abs(turns[0].maximumHead-turns[1].maximumHead)<.002,'mirrored turns must have comparable response');
console.log(JSON.stringify({slowFrames,slowDrive,fastDrive,turns,browserExecuted:false,visualAcceptance:false}));
