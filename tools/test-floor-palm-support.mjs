// Plant/release and preparation use the real pose commit and fixed-length IK.
// The support query is a synthetic bone-envelope fixture; browser QA uses skin.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {MotionController} from '../motion/vendor/controller.mjs';
import {rigFromSource} from '../motion/vendor/rig.mjs';
import {solveTwoBone} from '../motion/vendor/math.mjs';
import {createCharacterShapeField,CHARACTER_DEFORMATION_RULES} from '../reconstruction/shape-deform.mjs';
import {normalizeCharacterShape,characterShapeParameterKey,SHAPE_SCHEMA,SHAPE_REVISION} from '../reconstruction/shape-contract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const fullBody=read('motion/vendor/full-body.mjs').replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL('../motion/vendor/'+p,import.meta.url).href));
const {blend,relaxedHandRotation}=await import('data:text/javascript;base64,'+Buffer.from(fullBody+'\nexport {blend,relaxedHandRotation};').toString('base64'));
const runtime=read('source/runtime.template.js'),math=runtime.split('// MODULE math')[1].split('function matrix')[0]+'\n'+runtime.match(/^const (?:canonical|relativeToBind)=.*$/gm).join('\n');
const code=math+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',read('reconstruction/rig-reference.json')).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js');
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,MotionLabPose,r2SampleMotion,r2CaptureMotion,r2BlendMotion,r2StandingGestureDescriptor,r2ReferenceDescriptor,r2SeatedPreparationDescriptor,r2ReferenceOriginForPosition,r2FloorPalmWeight,r2MotionTracking,R2_MOTION,R2_SEATED_PREPARATION,contactHandPose,CONTACT_HAND_POSE_REVISION,qm,inv,rotate,sub,add,dist,qangle,compose,inverse,frame})',{
 structuredClone,Map,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'floor-palm-test',degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],MotionLab:{blend,relaxedHandRotation,solveTwoBone}});
const sides=['left','right'];let frames=0,planted=0,maxDriftM=0,maxStepM=0,maxRootCorrectionM=0,maxTorsoLeanRad=0,preparationSamples=0;
for(const shape of [{},{statureScale:.94},{statureScale:1.06},{statureScale:.95,legProportion:-.35,shoulderWidth:.7,hipWidth:.35,armFullness:.75}]){
 const resolvedRig=api.resolveCharacterRig(shape),sourceBind=api.r2SourceFrames(resolvedRig),engine=new MotionController(rigFromSource(resolvedRig));
 const h={resolvedRig,sourceBind,bodyMetrics:api.resolveCharacterMetrics(resolvedRig),arms:{},legs:{},shoulders:{}};
 h.joints=[...sourceBind].map(([id,f])=>({id,region:resolvedRig.nodes[id].region,bindQ:resolvedRig.nodes[id].parent?api.qm(api.inv(sourceBind.get(resolvedRig.nodes[id].parent).q),f.q):f.q}));h.byId=new Map(h.joints.map(j=>[j.id,j]));h.spine=h.joints.filter(j=>j.region);
 for(const side of sides){
  for(const [limb,parts]of [['arms',['upperArm','forearm','hand']],['legs',['femur','tibia','foot']]]){
   const [upper,elbow,wrist]=parts.map(p=>h.byId.get(side+'_'+p)),length=(a,b)=>api.dist(sourceBind.get(a.id).p,sourceBind.get(b.id).p);
   h[limb][side]={upper,elbow,wrist,s:side==='left'?-1:1,L1:length(upper,elbow),L2:length(elbow,wrist)};
  }
  h.shoulders[side]={sc:h.byId.get(side+'_SC')};
 }
 const pose=new api.MotionLabPose(h,engine);h.motionDriver=pose;

 for(const j of h.joints){const parent=resolvedRig.nodes[j.id].parent;j.parent=parent?h.byId.get(parent):null;const f=parent?api.compose(api.inverse(sourceBind.get(parent)),sourceBind.get(j.id)):sourceBind.get(j.id);j.p=f.p;j.q=f.q;}
 h.fk=()=>{for(const j of h.joints)j.world=j.parent?api.compose(j.parent.world,api.frame(j.p,j.q)):api.frame(j.p,j.q);h.root=h.byId.get('hips').world;};h.fk();
 h.minimumBoneY=(f,ids=null)=>{let y=Infinity,boneId=null;for(const [id,v]of f){if(ids&&!ids.has(id))continue;const n=resolvedRig.nodes[id],points=[v.p];if(n.tipM)points.push(api.add(v.p,api.rotate(v.q,api.rotate(api.inv(sourceBind.get(id).q),api.sub(n.tipM,n.positionM)))));for(const p of points)if(p[1]-.01<y){y=p[1]-.01;boneId=id;}}return{y,boneId,sampled:false};};
 const dt=1/120,context={};let previous=null;
 const step=(desc,weight)=>{
  try{pose.apply({...desc,deltaTime:dt,groundClearance:true,floorSupport:context,floorPalmWeight:weight});}catch(e){console.error(JSON.stringify({clip:desc.kind,progress:desc.motionSource?.progress,weight,context}));throw e;}frames++;
  const report=pose.report(),f=new Map(h.joints.map(j=>[j.id,j.world]));
  assert(report.ground.y>=.0005-1e-6);assert(report.boneErrorM<1e-7);assert(report.attachmentErrorM<1e-7);assert(report.handErrorM<1e-8);
  const point=api.add(f.get('right_hand').p,api.rotate(f.get('right_hand').q,h.bodyMetrics.palmContact));
  if(previous)maxStepM=Math.max(maxStepM,api.dist(previous,point));previous=point;
  if(report.floorSupport?.weight===1){planted++;const drift=api.dist(point,context.right.p);maxDriftM=Math.max(maxDriftM,drift);assert(drift<1e-8);}
  maxRootCorrectionM=Math.max(maxRootCorrectionM,report.floorSupport?.rootCorrectionM||0);
  maxTorsoLeanRad=Math.max(maxTorsoLeanRad,report.floorSupport?.torsoLeanRad||0);
  if(desc.kind==='seatedPrepare'){preparationSamples++;assert(report.floorSupport?.weight===1,'preparation retains the planted hand while moving the legs');}
  return f;
 };
 for(const clip of ['standToSit','sitToLie','lieToSit','sitToStand']){
  let origin=clip==='standToSit'?[0,0,0]:[...h.root.p];
  if(clip==='sitToStand'){
   const from=new Map(h.joints.map(j=>[j.id,api.frame(j.world.p,j.world.q)])),feet=Object.fromEntries(sides.map(side=>[side,{...from.get(side+'_foot'),yaw:0}]));
   for(let i=1;i<=87;i++)step(api.r2SeatedPreparationDescriptor(h,from,feet,0,i/87,true),1);
   origin=api.r2ReferenceOriginForPosition(h,clip,0,h.root.p,0);
  }
  const from=api.r2CaptureMotion(h,0),duration=api.R2_MOTION.clips[clip].durationS,count=Math.ceil(duration/dt);
  for(let i=1;i<=count;i++){const u=Math.min(1,i*dt/duration);step(api.r2ReferenceDescriptor(h,clip,u,origin,0,from,Math.min(1,i*dt/.25)),api.r2FloorPalmWeight(clip,u));}
  if(clip==='standToSit'){
   const saved=pose.snapshot(),savedContext=structuredClone(context),desc=api.r2ReferenceDescriptor(h,clip,1,origin,0);
   step(desc,1);const expected=JSON.stringify(pose.snapshot());pose.restore(saved);for(const k of Object.keys(context))delete context[k];Object.assign(context,structuredClone(savedContext));
   step(desc,1);assert.equal(JSON.stringify(pose.snapshot()),expected,'restored pose and execution-owned anchor reproduce the identical planted frame');
   const reference=api.r2SampleMotion(clip,1),contact=h.lastErrors.find(e=>e.kind==='floor-palm');
   assert(api.r2MotionTracking(h,reference,0).passed,'valid contact adaptation still completes');
   const originalError=contact.error;contact.error=.013;
   assert(!api.r2MotionTracking(h,reference,0).passed,'bad palm position cannot bypass the reference gate');contact.error=originalError;
   const originalAngle=contact.orientationErrorRad;contact.orientationErrorRad=.11;
   assert(!api.r2MotionTracking(h,reference,0).passed,'bad palm orientation cannot bypass the reference gate');contact.orientationErrorRad=originalAngle;
  }
 }
 assert(!context.right,'rising must release the support before standing');
 // An invalid surface query cannot publish anchors or a partial skeleton.
 const before=JSON.stringify(pose.snapshot()),savedQuery=h.minimumBoneY,empty={};
 h.minimumBoneY=(f,ids)=>ids?{y:NaN,boneId:null}:savedQuery(f);
 assert.throws(()=>pose.apply({...api.r2ReferenceDescriptor(h,'standToSit',.8,[0,0,0],0),floorSupport:empty,floorPalmWeight:1,deltaTime:dt,groundClearance:true}),/表面采样/);
 assert.deepEqual(empty,{});assert.equal(JSON.stringify(pose.snapshot()),before);h.minimumBoneY=savedQuery;
}
assert(planted>100);assert(maxDriftM<1e-8);assert(maxStepM<.03);assert(maxTorsoLeanRad<=.45);assert(preparationSamples===348);
console.log(JSON.stringify({shapes:4,frames,planted,preparationSamples,maxDriftM,maxStepM,maxRootCorrectionM,maxTorsoLeanRad,query:'synthetic-bone-envelope',actualSkinTest:false,visualAcceptance:false}));
