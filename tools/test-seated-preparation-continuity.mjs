// Sitting and standing recordings start from different support arrangements.
// The explicit preparation phase must bridge them while the committed feet
// remain world-space anchors and every bone keeps its bind length.
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
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,r2ReferenceDescriptor,r2SeatedPreparationDescriptor,r2ReferenceOriginForPosition,R2_SEATED_PREPARATION,NaturalLocomotion,dist,qangle})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'seated-preparation-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff,bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}});
const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
const a={h,pos:[0,0,0],yaw:0,time:0,route:[],routeIndex:0,manipulationPace:()=>1,strength:{movementFactor:()=>1},w:{objects:[],bounds:{xMin:-100,xMax:100,zMin:-100,zMax:100},collision:()=>false,get:()=>null}};
const locomotion=new api.NaturalLocomotion(a),pose=locomotion.pose;
const seated=pose.build(api.r2ReferenceDescriptor(h,'standToSit',1,[0,bodyMetrics.standingHipHeightM,0],0));pose.validate(seated);
const frames=seated.frames,feet=Object.fromEntries(['left','right'].map(side=>[side,{p:[...frames.get(side+'_foot').p],q:[...frames.get(side+'_foot').q],yaw:0}]));
const first=api.r2SeatedPreparationDescriptor(h,frames,feet,0,0),last=api.r2SeatedPreparationDescriptor(h,frames,feet,0,1);
const direct=pose.build({...last,blendFrom:null,blendAmount:1}),initialMismatch=Math.max(...h.joints.map(j=>api.dist(frames.get(j.id).p,direct.frames.get(j.id).p)));
assert(initialMismatch>.05,'the test must contain a real sitting-to-standing source mismatch');
let previous=frames,maxJointStepM=0,maxFootErrorM=0,maxBoneErrorM=0,samples=0,lastCandidate=null;
const count=Math.round(api.R2_SEATED_PREPARATION.durationS*120);
for(let i=0;i<=count;i++){
 const candidate=pose.build(api.r2SeatedPreparationDescriptor(h,frames,feet,0,i/count)),report=pose.validate(candidate);lastCandidate=candidate;samples++;
 maxBoneErrorM=Math.max(maxBoneErrorM,report.boneErrorM);maxFootErrorM=Math.max(maxFootErrorM,report.footErrorM);
 for(const joint of h.joints)maxJointStepM=Math.max(maxJointStepM,api.dist(previous.get(joint.id).p,candidate.frames.get(joint.id).p));
 for(const side of ['left','right']){
  assert(api.dist(candidate.frames.get(side+'_foot').p,feet[side].p)<1e-9,'preparation must preserve '+side+' foot anchor');
  assert(api.qangle(candidate.frames.get(side+'_foot').q,feet[side].q)<1e-7,'preparation must not pivot the planted sole through the floor');
  for(const [id,f]of frames)if(id.startsWith(side+'_')&&/_(?:foot|subtalar|midfoot|metatarsal|toe)/.test(id))assert(api.dist(candidate.frames.get(id).p,f.p)<1e-9,'the complete supported foot hierarchy must remain planted: '+id);
 }
 previous=candidate.frames;
}
assert(maxBoneErrorM<1e-7);assert(maxFootErrorM<1e-8);assert(maxJointStepM<.02,'preparation must not teleport a joint on a fixed step');
// Exercise the same clearance stage as commit. This deliberately isolates
// a pelvis-floor constraint; deformed skin probes are covered in the browser.
const corrected=pose.build(api.r2SeatedPreparationDescriptor(h,frames,feet,0,.5));
const floorHeight=corrected.frames.get('hips').p[1]+.025;
h.minimumBoneY=f=>({y:f.get('hips').p[1]-floorHeight,boneId:'hips',sampled:false});
const clearance=pose.resolveGroundClearance(corrected,{groundClearance:true});pose.measureEffectors(corrected);
assert(clearance.groundCorrectionM>.025);assert(clearance.ground.y>=.0005-1e-6);assert(pose.validate(corrected).footErrorM<1e-9);
for(const side of ['left','right'])assert(api.dist(corrected.frames.get(side+'_foot').p,feet[side].p)<1e-9,'body clearance must not translate foot anchors');
const shin=pose.build(api.r2SeatedPreparationDescriptor(h,frames,feet,0,.7)),startHip=shin.frames.get('hips').p[1];let queries=0;
h.minimumBoneY=f=>{queries++;return{y:-.0001+(f.get('hips').p[1]-startHip)*.065,boneId:'right_tibia',sampled:false};};
const shinClearance=pose.resolveGroundClearance(shin,{groundClearance:true});pose.measureEffectors(shin);
assert(shinClearance.ground.y>=.0005-1e-6);assert(queries<=8,'a weak shin-height response must converge within the bounded query budget');assert(pose.validate(shin).footErrorM<1e-9);
h.minimumBoneY=()=>({y:-.02,boneId:'right_toe_5_3',sampled:false});
assert.throws(()=>pose.resolveGroundClearance(pose.build(first),{groundClearance:true}),/无法同时满足/,'unresolvable ground contact must still reject instead of lifting anchors');
const endRoot=lastCandidate.frames.get('hips').p,origin=api.r2ReferenceOriginForPosition(h,'sitToStand',0,endRoot,0),clipStart=pose.build(api.r2ReferenceDescriptor(h,'sitToStand',0,origin,0));
assert(api.dist(clipStart.frames.get('hips').p,endRoot)<1e-9,'the recorded stand-up clip must start at the prepared root position');
for(const side of ['left','right'])assert(api.dist(lastCandidate.frames.get(side+'_foot').p,feet[side].p)<1e-9);
// An affine surface probe isolates the floor-fitting policy from skin geometry.
// The real deformed support surface is measured separately in browser QA.
let floorFitSamples=0,loweredSamples=0;
h.minimumBoneY=f=>({y:Math.min(...[...f.values()].map(v=>v.p[1]))-.015,boneId:'synthetic-support',sampled:false});
for(const clip of ['standToSit','sitToLie','lieToSit','sitToStand'])for(let i=0;i<=60;i++){
 const desc=api.r2ReferenceDescriptor(h,clip,i/60,[0,0,0],0),candidate=pose.build(desc);
 const before=new Map([...candidate.frames].map(([id,f])=>[id,{p:[...f.p],q:[...f.q]}]));
 const result=pose.resolveGroundClearance(candidate,{...desc,groundClearance:true});
 assert(Math.abs(result.ground.y-.0005)<1e-8,'non-airborne floor motion must stay grounded, not merely avoid penetration');
 for(const [id,f]of candidate.frames){const old=before.get(id);assert(Math.abs(f.p[1]-old.p[1]-result.groundCorrectionM)<1e-8);assert.equal(f.p[0],old.p[0]);assert.equal(f.p[2],old.p[2]);assert.deepEqual([...f.q],old.q);}
 pose.validate(candidate);floorFitSamples++;if(result.groundCorrectionM<-.001)loweredSamples++;
}
assert(loweredSamples>0,'regression must include the former hovering branch');
const unsupported=pose.build(api.r2ReferenceDescriptor(h,'standToSit',.5,[0,0,0],0));
h.minimumBoneY=()=>({y:.12,boneId:'synthetic-support'});
assert.equal(pose.resolveGroundClearance(unsupported,{groundClearance:true,floorMode:true}).groundCorrectionM,0,'unmarked clips retain clearance-only behavior');
const anchoredCandidate=pose.build(last),anchoredBefore=anchoredCandidate.frames.get('left_foot').p.slice();
assert.equal(pose.resolveGroundClearance(anchoredCandidate,{groundClearance:true,floorMode:true,groundSupport:'continuous-floor'}).groundCorrectionM,0,'explicit planted feet override clip height fitting');
assert.deepEqual([...anchoredCandidate.frames.get('left_foot').p],[...anchoredBefore]);
console.log(JSON.stringify({floorFitSamples,loweredSamples,probe:'synthetic-affine-surface',actualSkinProbe:false}));
console.log(JSON.stringify({schema:'human/seated_preparation_continuity@1',samples,durationS:api.R2_SEATED_PREPARATION.durationS,initialMismatchM:initialMismatch,maxJointStepM,maxFootErrorM,maxBoneErrorM,rootJoinErrorM:api.dist(clipStart.frames.get('hips').p,endRoot),browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
