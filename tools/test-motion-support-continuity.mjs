// Regression for stand-up handoff: the committed feet become the locomotion
// anchors and remain measured throughout the return-to-stance blend.
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
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,r2SampleMotion,NaturalLocomotion,dist,mix,frame,qangle})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'support-continuity-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff:(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}});
const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig);
const h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1],world:api.frame(sourceBind.get(id).p,sourceBind.get(id).q)}));
h.byId=new Map(h.joints.map(j=>[j.id,j]));
for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
h.root=h.byId.get('hips').world;
h.legs=Object.fromEntries(['left','right'].map(side=>[side,{upper:h.byId.get(side+'_femur'),elbow:h.byId.get(side+'_tibia'),wrist:h.byId.get(side+'_foot')}]))
const a={h,pos:[0,0,0],yaw:0,time:0,route:[],routeIndex:0,manipulationPace:()=>1,strength:{movementFactor:()=>1},w:{objects:[],bounds:{xMin:-100,xMax:100,zMin:-100,zMax:100},collision:()=>false}};
const locomotion=new api.NaturalLocomotion(a);a.locomotion=locomotion;
const endCandidate=locomotion.pose.build({reference:api.r2SampleMotion('sitToStand',1),yaw:0}),end=endCandidate.frames;
locomotion.pose.validate(endCandidate);
for(const joint of h.joints){const f=end.get(joint.id);joint.world=api.frame([...f.p],[...f.q]);}
h.root=h.byId.get('hips').world;
const expectedRoot=api.mix(end.get('left_femur').p,end.get('right_femur').p,.5);
const expectedFeet=Object.fromEntries(['left','right'].map(side=>[side,[...end.get(side+'_foot').p]]));
const adoption=locomotion.resetFromPose({preservePoseContacts:true});
assert.equal(adoption.preserved,true);
assert(api.dist(adoption.root,expectedRoot)<1e-12,'locomotion root must adopt the committed hip midpoint');
for(const side of ['left','right'])assert(api.dist(adoption.feet[side],expectedFeet[side])<1e-12,'locomotion must adopt the committed '+side+' foot');
let samples=0,maxFootErrorM=0,maxAnchorDriftM=0,maxPlantedAngleRad=0,maxSwingAngleStepRad=0;
for(const amount of [0,.05,.1,.25,.5,.75,.9,.99,1]){
 const candidate=locomotion.pose.build({blendFrom:end,blendAmount:amount,preserveFootContactsOnBlend:true,motionSource:{kind:'support-continuity-test'}});
 const report=locomotion.pose.validate(candidate),footErrors=candidate.errors.filter(e=>/_foot$/.test(e.id));
 assert.equal(footErrors.length,2,'blend must retain independent foot error evidence');
 maxFootErrorM=Math.max(maxFootErrorM,report.footErrorM);
 for(const side of ['left','right']){
  const anchor=locomotion.engine.state.feet[side].position,drift=api.dist(candidate.frames.get(side+'_foot').p,anchor);
  maxAnchorDriftM=Math.max(maxAnchorDriftM,drift);assert(drift<1e-10,'return-to-stance blend must not drag '+side+' foot');samples++;
  const angle=api.qangle(candidate.frames.get(side+'_foot').q,end.get(side+'_foot').q);
  maxPlantedAngleRad=Math.max(maxPlantedAngleRad,angle);assert(angle<1e-7,'planted foot must retain its full orientation throughout the blend');
 }
}
const previous=Object.fromEntries(['left','right'].map(side=>[side,end.get(side+'_foot').q]));
const released=new Set();let settleFrames=0;
for(;settleFrames<600;settleFrames++){
 locomotion.update(1/120);a.time+=1/120;
 const candidate=locomotion.pose.build();locomotion.pose.validate(candidate);
 for(const side of ['left','right']){
  const q=candidate.frames.get(side+'_foot').q,foot=locomotion.engine.state.feet[side];
  const step=api.qangle(q,previous[side]);maxSwingAngleStepRad=Math.max(maxSwingAngleStepRad,step);
  assert(step<.04,'first stance-recovery step must not snap the sole orientation');previous[side]=q;
  if(!foot.adoptedOrientation)released.add(side);
  else if(foot.contact)assert(api.qangle(q,end.get(side+'_foot').q)<1e-7,'sole remains locked until its own swing');
 }
 if(released.size===2&&locomotion.isSettled())break;
}
assert.equal(released.size,2,'each adopted contact releases through a real swing');assert(settleFrames<600,'stance recovery must settle');
assert(maxFootErrorM<1e-10);
console.log(JSON.stringify({schema:'human/motion_support_continuity@2',samples,maxFootErrorM,maxAnchorDriftM,maxPlantedAngleRad,maxSwingAngleStepRad,settleFrames,poseAdoption:adoption,browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
