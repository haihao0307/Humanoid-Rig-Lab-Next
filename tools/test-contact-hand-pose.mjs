// Real atlas phalanges/box collision shapes; no renderer or fabricated hands.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../world/physics/vendor/cannon-es.js';
import {createCharacterShapeField,CHARACTER_DEFORMATION_RULES} from '../reconstruction/shape-deform.mjs';
import {normalizeCharacterShape,characterShapeParameterKey,SHAPE_SCHEMA,SHAPE_REVISION} from '../reconstruction/shape-contract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const runtime=read('source/runtime.template.js'),math=runtime.split('// MODULE math')[1].split('function matrix')[0],grasp=runtime.slice(runtime.indexOf('function rayBoundary'),runtime.indexOf('function graspResidual'));
const code=math+'\n'+grasp+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',read('reconstruction/rig-reference.json')).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ContactHandPose.js')+'\n'+read('world/PhysicsContract.js')+'\n'+read('world/PhysicsWorld.js');
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,contactHandPose,contactHandSegments,contactHandObjectClearance,contactHandBoxSegmentDistance,CONTACT_HAND_POSE_REVISION,graspFrames,PhysicsWorld,frame,qy,qm,compose,inverse,sub,add,mul,rotate,dist,qangle})',{
 structuredClone,WorkbenchPhysicsEngine:C,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'contact-hand-test',DOWN:[0,-1,0]});
let cases=0,minimumClearanceM=Infinity,originalMinimumM=Infinity,maximumLengthErrorM=0,maximumAttachmentErrorM=0;
// Reuse the human wrapper through real shape replacements. A stale recipe
// would violate the next shape's digit lengths and skinning attachments.
const h={};
for(const shape of [{},{statureScale:.94},{statureScale:1.06},{statureScale:.95,legProportion:-.35,shoulderWidth:.7,hipWidth:.35,waistWidth:.65,torsoDepth:.55,armFullness:.75,legFullness:.65}]){
 const resolvedRig=api.resolveCharacterRig(shape),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig);Object.assign(h,{resolvedRig,bodyMetrics,sourceBind});
 for(const spec of [{w:.3,h:.6,d:.3},{w:.32,h:.5,d:.2},{w:.65,h:.82,d:1,push:true},{w:.3,h:.6,d:.3,push:true}])for(const relativeYaw of [0,.34])for(const yaw of [0,.7,-1.8]){
  const object={id:'BOX',shape:'box',...spec,p:[1.3,spec.h/2,-.4],q:api.qy(yaw+relativeYaw),mass:.5,friction:.08,restitution:0,movable:true,collidable:true,v:[0,0,0],angularVelocity:[0,0,0]};
  const world={objects:[object],bounds:{xMin:-13,xMax:13,zMin:-9,zMax:9},physicsSettings:{gravityMps2:9.81,groundFriction:.65},revision:0};world.physics=new api.PhysicsWorld(world);
  const grips=api.graspFrames(object,yaw,!!spec.push),frames=new Map([...sourceBind].map(([id,f])=>[id,api.frame(f.p,f.q)]));
  for(const side of ['left','right']){
   const goal=api.compose(api.frame(object.p,object.q),grips[side]),hand=api.frame(api.sub(goal.p,api.rotate(goal.q,bodyMetrics.palmContact)),goal.q),relative=api.inverse(sourceBind.get(side+'_hand'));
   frames.set(side+'_hand',hand);
   for(const [id,bind]of sourceBind)if(id.startsWith(side+'_metacarpal_')||id.startsWith(side+'_finger_'))frames.set(id,api.compose(hand,api.compose(relative,bind)));
  }
  const before=api.contactHandObjectClearance(h,frames,world.physics,object.id);originalMinimumM=Math.min(originalMinimumM,before.minimumClearanceM);
  const palms=Object.fromEntries(['left','right'].map(side=>[side,api.frame(frames.get(side+'_hand').p,frames.get(side+'_hand').q)]));
  api.contactHandPose(h,frames,{mode:api.CONTACT_HAND_POSE_REVISION,amount:1});
  const result=api.contactHandObjectClearance(h,frames,world.physics,object.id);minimumClearanceM=Math.min(minimumClearanceM,result.minimumClearanceM);assert(result.minimumClearanceM>=.0005,'complete finger segments, tips and palm-bone roots must clear the box: '+JSON.stringify({shape,spec,yaw,relativeYaw,result}));
  for(const side of ['left','right']){assert.equal(api.dist(palms[side].p,frames.get(side+'_hand').p),0);assert(api.qangle(palms[side].q,frames.get(side+'_hand').q)<1e-7);}
  for(const [id,f]of frames)if(/_(?:metacarpal_|finger_)/.test(id)){
   const parent=resolvedRig.nodes[id].parent,a=sourceBind.get(id),b=sourceBind.get(parent),actual=frames.get(parent),local=api.compose(api.inverse(b),a);
   maximumLengthErrorM=Math.max(maximumLengthErrorM,Math.abs(api.dist(f.p,actual.p)-api.dist(a.p,b.p)));
   maximumAttachmentErrorM=Math.max(maximumAttachmentErrorM,api.dist(api.compose(actual,local).p,f.p));
  }
  cases++;
 }
}
assert(maximumLengthErrorM<1e-12);assert(maximumAttachmentErrorM<1e-12);assert(originalMinimumM<-.025,'the fixture must reproduce the original intersecting hand');
assert.equal(api.contactHandBoxSegmentDistance([-2,0,0],[2,0,0],[.5,.5,.5]),-.5);
assert(Math.abs(api.contactHandBoxSegmentDistance([.51,-.2,0],[.51,.2,0],[.5,.5,.5])-.01)<1e-12);
let seed=15342,maxSamplingGapM=0;const random=()=>((seed=Math.imul(1664525,seed)+1013904223>>>0)/4294967296);
for(let i=0;i<600;i++){
 const a=Array.from({length:3},()=>random()*2-1),b=Array.from({length:3},()=>random()*2-1),half=Array.from({length:3},()=>.05+random()*.4),exact=api.contactHandBoxSegmentDistance(a,b,half);let sampled=Infinity;
 for(let k=0;k<=2000;k++){const d=a.map((v,j)=>Math.abs(v+(b[j]-v)*k/2000)-half[j]);sampled=Math.min(sampled,Math.hypot(...d.map(v=>Math.max(0,v)))+Math.min(0,Math.max(...d)));}
 assert(exact<=sampled+1e-12);assert(sampled-exact<=api.dist(a,b)/2000);maxSamplingGapM=Math.max(maxSamplingGapM,sampled-exact);
}
console.log(JSON.stringify({cases,minimumClearanceM,originalMinimumM,maximumLengthErrorM,maximumAttachmentErrorM,randomBoxSegments:600,maxSamplingGapM,source:api.CONTACT_HAND_POSE_REVISION,palmAndWristUnchanged:true,visualAcceptance:false}));
