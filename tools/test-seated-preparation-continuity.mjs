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
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,r2ReferenceDescriptor,r2SeatedPreparationDescriptor,r2ReferenceOriginForPosition,R2_SEATED_PREPARATION,NaturalLocomotion,dist})',{
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
 for(const side of ['left','right'])assert(api.dist(candidate.frames.get(side+'_foot').p,feet[side].p)<1e-9,'preparation must preserve '+side+' foot anchor');
 previous=candidate.frames;
}
assert(maxBoneErrorM<1e-7);assert(maxFootErrorM<1e-8);assert(maxJointStepM<.02,'preparation must not teleport a joint on a fixed step');
const endRoot=lastCandidate.frames.get('hips').p,origin=api.r2ReferenceOriginForPosition(h,'sitToStand',0,endRoot,0),clipStart=pose.build(api.r2ReferenceDescriptor(h,'sitToStand',0,origin,0));
assert(api.dist(clipStart.frames.get('hips').p,endRoot)<1e-9,'the recorded stand-up clip must start at the prepared root position');
for(const side of ['left','right'])assert(api.dist(lastCandidate.frames.get(side+'_foot').p,feet[side].p)<1e-9);
console.log(JSON.stringify({schema:'human/seated_preparation_continuity@1',samples,durationS:api.R2_SEATED_PREPARATION.durationS,initialMismatchM:initialMismatch,maxJointStepM,maxFootErrorM,maxBoneErrorM,rootJoinErrorM:api.dist(clipStart.frames.get('hips').p,endRoot),browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
