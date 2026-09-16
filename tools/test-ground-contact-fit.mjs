// Real contact candidates and controlled-foot pose adapter. These tests do
// not claim triangle-level clearance; rendered contact QA remains separate.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {MotionController} from '../motion/vendor/controller.mjs';
import {rigFromSource} from '../motion/vendor/rig.mjs';
import {solveTwoBone} from '../motion/vendor/math.mjs';
import {createCharacterShapeField,CHARACTER_DEFORMATION_RULES} from '../reconstruction/shape-deform.mjs';
import {normalizeCharacterShape,characterShapeParameterKey,SHAPE_SCHEMA,SHAPE_REVISION} from '../reconstruction/shape-contract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const reference=JSON.parse(read('reconstruction/rig-reference.json'));
const fullBody=read('motion/vendor/full-body.mjs').replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL('../motion/vendor/'+path,import.meta.url).href));
const {FullBodyMotion,blend,relaxedHandRotation}=await import('data:text/javascript;base64,'+Buffer.from(fullBody+'\nexport {blend,relaxedHandRotation};').toString('base64'));
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const code=math+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(reference)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js')+'\n'+read('body/MotionLabActions.js');
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,MotionLabPose,contactCandidates,motionChooseContact,motionValidateTransferContacts,motionApproachDistance,motionContactDescriptor,motionFreeHandEndpoints,motionReachHands,frame,qy,qm,compose,sub,add,rotate,dist,qangle})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'contact-test',
 degrees:r=>r*180/Math.PI,radians:d=>d*Math.PI/180,r2Mean:f=>(f('left')+f('right'))*.5,DOWN:[0,-1,0],MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone}});
let scenarios=0,controlledPoses=0,reachSamples=0,minimumKneeProxyClearanceM=Infinity,maximumHandErrorM=0,maximumHeadShoulderForecastErrorM=0;
const chosen=[];
for(const shape of [{},{statureScale:.94},{statureScale:1.06},{shoulderWidth:.75,waistWidth:.2,torsoDepth:.3,armFullness:.5,legFullness:.3}]){
 const resolvedRig=api.resolveCharacterRig(shape),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),engine=new MotionController(rigFromSource(resolvedRig));
 const h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 const pose=new api.MotionLabPose(h,engine),candidates=api.contactCandidates(h);
 assert(candidates.every(c=>c.heightM>=bodyMetrics.crouchLowHipM),'contact fit must not lower the pelvis below its safe crouch floor');
 assert.equal(api.contactCandidates(h),candidates,'fixed candidates are cached per character');
 for(const object of [{height:.30},{height:.50},{height:.82,push:true}])for(const yaw of [0,.8,-1.4]){
  const {height,push=false}=object;
  const origin=[1.5,0,-.7],base=api.qy(yaw),forward=api.motionApproachDistance(h),ground=api.frame(api.add(origin,api.rotate(base,[0,height/2,forward])),base);
  const grips=Object.fromEntries(['left','right'].map(side=>{const s=side==='left'?-1:1;return [side,api.frame(push?[s*.17,0,-.5]:[s*.19,0,0],api.qy(push?0:-s*Math.PI/2))];}));
  const hands=Object.fromEntries(['left','right'].map(side=>[side,api.compose(ground,grips[side])]));
  const contact=api.motionChooseContact(h,origin,yaw,hands);
  if(!push)api.motionValidateTransferContacts(h,origin,yaw,grips,ground,contact,null);
  chosen.push({shape,height,push,yaw,hipM:contact.heightM,forwardFlexionDegrees:contact.source.forwardFlexionDegrees});
  engine.reset();engine.state.root=[origin[0],bodyMetrics.standingHipHeightM,origin[2]];engine.state.yaw=yaw;
  for(const side of ['left','right'])engine.state.feet[side]={position:engine.stance(engine.state,side),yaw,contact:true};engine.state.pose=engine.solve(engine.state);
  const candidate=pose.build({reference:contact.reference,position:[origin[0],contact.heightM,origin[2]],yaw,controlledFeet:true,hands});
  pose.validate(candidate);controlledPoses++;
  for(const side of ['left','right']){
   const knee=candidate.frames.get(side+'_tibia').p,clearance=knee[1]-bodyMetrics.legRadiusM;
   minimumKneeProxyClearanceM=Math.min(minimumKneeProxyClearanceM,clearance);
   assert(clearance>=0,'controlled knees plus their authored radius must stay above the floor');
   const wrist=candidate.frames.get(side+'_hand'),palm=api.add(wrist.p,api.rotate(wrist.q,bodyMetrics.palmContact));
   // The palm local frame includes the anatomical hand bind frame. Compare
   // the exact task-space effector residual already produced by the adapter.
   const error=candidate.errors.find(e=>e.id===side+'_hand').error;maximumHandErrorM=Math.max(maximumHandErrorM,error);
   assert(error<1e-7,'bounded contact fit must keep both wrist IK goals reachable');
  }
  for(const [id,p]of [['head',contact.head],['left_upperArm',contact.shoulders.left],['right_upperArm',contact.shoulders.right]]){
   const error=api.dist(api.add(origin,api.rotate(base,p)),candidate.frames.get(id).p);maximumHeadShoulderForecastErrorM=Math.max(maximumHeadShoulderForecastErrorM,error);
   assert(error<1e-7,'forecast and controlled-foot torso must use the same pelvis axis: '+JSON.stringify({id,error,yaw,shape}));
  }
  assert.throws(()=>api.motionChooseContact(h,origin,yaw,hands,{collision:()=>true}),/净空/,'blocked head or shoulder clearance must remain a failure');
  h.motionDriver=pose;
  const initial=pose.build(),initialPalms=Object.fromEntries(['left','right'].map(side=>[side,api.compose(initial.frames.get(side+'_hand'),api.frame(bodyMetrics.palmContact))]));
  const agent={h,locomotion:{engine,rig:engine.rig,pose},phase:'reach',skill:{contactPose:contact,reachStart:api.motionFreeHandEndpoints(h,initial.frames,initialPalms)}};
  for(let step=0;step<=120;step++){
   const t=step/120,goals=api.motionReachHands(agent,hands,t),candidate=pose.build({...api.motionContactDescriptor(agent,null,t),hands:goals});
   pose.validate(candidate);reachSamples++;
   for(const side of ['left','right']){
    const error=candidate.errors.find(e=>e.id===side+'_hand').error;maximumHandErrorM=Math.max(maximumHandErrorM,error);
    assert(error<1e-7,'moving-shoulder reach path must never stretch an arm');
    if(step===0||step===120){const expected=step===0?initialPalms[side]:hands[side];
     assert(api.dist(goals[side].p,expected.p)<1e-10,'free reach preserves both endpoint palm positions');
     assert(api.qangle(goals[side].q,expected.q)<1e-7,'free reach preserves both endpoint palm orientations');
    }
   }
  }
  scenarios++;
 }
}
console.log(JSON.stringify({schema:'human/ground_contact_fit@1',scenarios,controlledPoses,reachSamples,minimumKneeProxyClearanceM,maximumHandErrorM,maximumHeadShoulderForecastErrorM,chosen,
 browserExecuted:false,gpuExecuted:false,visualAcceptance:false}));
