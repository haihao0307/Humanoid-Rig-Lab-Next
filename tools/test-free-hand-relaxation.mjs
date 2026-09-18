// Real fixed-length pose solver and committed-frame capture. Check free hands,
// clip handoffs and explicit palm targets separately from visual acceptance.
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
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,MotionLabPose,r2SampleMotion,r2CaptureMotion,r2BlendMotion,r2StandingGestureDescriptor,contactHandPose,CONTACT_HAND_POSE_REVISION,qm,inv,rotate,sub,add,dist,qangle,compose,inverse,frame})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'free-hand-test',degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],MotionLab:{blend,relaxedHandRotation,solveTwoBone}});
const sides=['left','right'],angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.reduce((s,v,i)=>s+v*b[i],0)/Math.hypot(...a)/Math.hypot(...b))))*180/Math.PI;
const sameRotation=(a,b)=>Math.min(Math.hypot(...a.map((v,i)=>v-b[i])),Math.hypot(...a.map((v,i)=>v+b[i])))<1e-10;
let frames=0,minWrist=Infinity,maxWrist=0,maxOldWrist=0,maxCaptureError=0,maxBlendStep=0;
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
 const committed=c=>{h.root=c.frames.get('hips');for(const j of h.joints){j.world=c.frames.get(j.id);const parent=resolvedRig.nodes[j.id].parent;j.q=parent?api.qm(api.inv(c.frames.get(parent).q),j.world.q):j.world.q;}};
 const checked=options=>{const c=pose.build(options);pose.validate(c);frames++;return c;};
 const local=(c,id)=>api.compose(api.inverse(c.frames.get(resolvedRig.nodes[id].parent)),c.frames.get(id));
 engine.command({type:'walk',target:[0,0,3]});
 for(let i=0;i<300;i++){
  engine.update(1/120);delete engine.state.flatFootSupport;const old=checked();engine.state.flatFootSupport=true;const relaxed=checked();
  for(const side of sides){
   for(const part of ['upperArm','forearm','hand','femur','tibia','foot'])assert(api.dist(old.frames.get(side+'_'+part).p,relaxed.frames.get(side+'_'+part).p)<1e-12,'free-hand retarget must not move body/limb endpoints');
   for(const [c,isOld]of [[old,true],[relaxed,false]]){
    const wrist=c.frames.get(side+'_hand'),forearm=api.sub(wrist.p,c.frames.get(side+'_forearm').p),long=api.sub(c.frames.get(side+'_finger_3_1').p,wrist.p),a=angle(forearm,long);
    if(isOld)maxOldWrist=Math.max(maxOldWrist,a);else{minWrist=Math.min(minWrist,a);maxWrist=Math.max(maxWrist,a);}
   }
   for(const id of [...sourceBind.keys()].filter(id=>id.startsWith(side+'_metacarpal_')||id.startsWith(side+'_finger_1_'))){const a=local(old,id),b=local(relaxed,id);assert(api.dist(a.p,b.p)<1e-12&&sameRotation(a.q,b.q),'preserve metacarpal origins and thumb opposition');}
  }
 }
 engine.reset();engine.state.flatFootSupport=true;
 const relaxed=checked();committed(relaxed);const from=api.r2CaptureMotion(h,0),g={fromMotion:from,origin:[...engine.state.root],base:{position:[...engine.state.root]},duration:3,time:0};
 for(const side of sides)assert(Math.abs(from[side+'HandRelaxation']-1)<1e-7,'capture actual committed free fingers');
 // At zero gesture weight the local hand frames must exactly match the
 // committed free pose. At full weight the source clip has its original shape.
 const handIds=[...sourceBind.keys()].filter(id=>/_(hand|metacarpal_\d|finger_\d_\d)$/.test(id));
 const first=checked(api.r2StandingGestureDescriptor(h,g,0,0));
 for(const id of handIds){assert(api.dist(first.frames.get(id).p,relaxed.frames.get(id).p)<1e-7);assert(sameRotation(first.frames.get(id).q,relaxed.frames.get(id).q));}
 for(const clip of ['wave','standToSit','sitToStand']){
  let previous=null;
  for(let k=0;k<=100;k++){
   const amount=k/100,reference=api.r2BlendMotion(from,api.r2SampleMotion(clip,.4),amount),candidate=checked({reference});committed(candidate);
   const captured=api.r2CaptureMotion(h,0);
   for(const side of sides){const error=Math.abs(captured[side+'HandRelaxation']-(1-amount));maxCaptureError=Math.max(maxCaptureError,error);assert(error<1e-6,'capture tracks committed local articulation through clip fades');}
   if(previous)for(const id of handIds.filter(id=>!id.endsWith('_hand'))){const a=local(previous,id),b=local(candidate,id),step=api.qangle(a.q,b.q);maxBlendStep=Math.max(maxBlendStep,step);assert(step<.02,'no per-frame finger pop: '+JSON.stringify({clip,k,id,step}));}
   previous=candidate;
  }
 }
 // Existing explicit palm/contact targets have priority over relaxation.
 const hands=Object.fromEntries(sides.map(side=>{const f=relaxed.frames.get(side+'_hand');return[side,{p:api.add(f.p,api.rotate(f.q,h.bodyMetrics.palmContact)),q:f.q}];}));
 const constrained=checked({hands});
 for(const side of sides)assert(sameRotation(constrained.frames.get(side+'_hand').q,hands[side].q));
 const contract={mode:api.CONTACT_HAND_POSE_REVISION,amount:1},contact=checked({hands,contactHand:contract}),expected=api.contactHandPose(h,new Map(constrained.frames),contract);
 for(const id of handIds){assert(api.dist(contact.frames.get(id).p,expected.get(id).p)<1e-12);assert(api.dist(contact.frames.get(id).q,expected.get(id).q)<1e-12,'explicit contact solver quaternion parity: '+id);}
 for(const side of sides)for(const joint of [1,2,3]){const id=side+'_finger_3_'+joint;assert(sameRotation(local(constrained,id).q,api.compose(api.inverse(sourceBind.get(resolvedRig.nodes[id].parent)),sourceBind.get(id)).q),'explicit hand goals keep their original finger contract without contactHand');}
 // Return from a captured floor pose to free hands uses the existing FK blend.
 const floor=checked({reference:api.r2SampleMotion('sitToStand',1)});
 for(const amount of [0,.001,.25,.5,.75,.999,1]){const c=checked({blendFrom:floor.frames,blendAmount:amount});committed(c);for(const side of sides)assert(Math.abs(pose.captureHandRelaxation(side)-amount)<1e-6);}
}
assert(maxOldWrist<.00001,'fixture must reproduce the former rigid wrist');assert(minWrist>2&&maxWrist<18,'free wrists bend softly without extreme rotation');
console.log(JSON.stringify({shapes:4,frames,minWristDegrees:minWrist,maxWristDegrees:maxWrist,formerMaxWristDegrees:maxOldWrist,maxCaptureError,maxBlendStepRad:maxBlendStep,explicitContactOverride:true,visualAcceptance:false}));
