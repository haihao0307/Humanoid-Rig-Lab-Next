// Full rendered skeleton versus its immutable preflight projection, plus
// local certificate reuse, invalidation and current-environment rejection.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../world/physics/vendor/cannon-es.js';
import {MotionController} from '../motion/vendor/controller.mjs';
import {FlatWorld} from '../motion/vendor/world.mjs';
import {rigFromSource} from '../motion/vendor/rig.mjs';
import {solveTwoBone} from '../motion/vendor/math.mjs';
import {createCharacterShapeField,CHARACTER_DEFORMATION_RULES} from '../reconstruction/shape-deform.mjs';
import {normalizeCharacterShape,characterShapeParameterKey,SHAPE_SCHEMA,SHAPE_REVISION} from '../reconstruction/shape-contract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const reference=JSON.parse(read('reconstruction/rig-reference.json'));
const fullBody=read('motion/vendor/full-body.mjs').replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL('../motion/vendor/'+path,import.meta.url).href));
const {FullBodyMotion,blend,relaxedHandRotation}=await import('data:text/javascript;base64,'+Buffer.from(fullBody+'\nexport {blend,relaxedHandRotation};').toString('base64'));
const runtime=read('source/runtime.template.js'),math=runtime.split('// MODULE math')[1].split('function matrix')[0],grasp=runtime.slice(runtime.indexOf('function rayBoundary'),runtime.indexOf('function graspResidual'));
const code=math+'\n'+grasp+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(reference)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js')+'\n'+read('body/MotionLabActions.js')+'\n'+read('body/NaturalLocomotion.js')+'\n'+read('world/PhysicsContract.js')+'\n'+read('world/PhysicsWorld.js')+'\n'+read('control/TaskAgent.js');
const api=vm.runInNewContext(code+'\n'+read('body/LightBalanceFeedback.js')+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,MotionLabPose,motionChooseContact,motionValidateTransferContacts,motionValidateContactReach,motionCarrySamples,motionRequireContactHandClearance,motionContactAdapter,motionPreflightModel,motionLocalCertificate,motionReachHands,motionFreeHandEndpoints,contactHandSegments,contactHandObjectClearance,motionApproachDistance,rayBoundary,inv,norm,motionContactDescriptor,graspFrames,PhysicsWorld,Agent,frame,qy,qm,compose,sub,add,mul,rotate,dist,qangle})',{
 structuredClone,WorkbenchPhysicsEngine:C,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'release-test',
 degrees:r=>r*180/Math.PI,radians:d=>d*Math.PI/180,r2Mean:f=>(f('left')+f('right'))*.5,DOWN:[0,-1,0],horizontal:(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),angleDiff:(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),MotionLab:{FlatWorld,MotionController,rigFromSource,FullBodyMotion,blend,relaxedHandRotation,solveTwoBone}});

const results=[];let comparedFrames=0,maximumPositionErrorM=0,maximumQuaternionComponentError=0;
const buildOriginal=api.MotionLabPose.prototype.build;let builds=0;
api.MotionLabPose.prototype.build=function(...args){builds++;return buildOriginal.apply(this,args);};
function human(shape){
 const resolvedRig=api.resolveCharacterRig(shape),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));h.spine=[{id:'C1'}];
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 const engine=new MotionController(rigFromSource(resolvedRig)),pose=new api.MotionLabPose(h,engine);h.motionDriver=pose;return{h,engine,pose};
}
function fixture(h,engine,origin=[0,0,0],yaw=0){
 const spec={id:'tall',w:.3,h:.6,d:.3,shape:'box'},q=api.qy(yaw+.34),direction=api.rotate(api.qy(yaw),[0,0,1]);
 const standoff=api.motionApproachDistance(h)+api.rayBoundary(spec,api.rotate(api.inv(q),api.mul(direction,-1)));
 const object={...spec,p:api.add([origin[0],spec.h/2,origin[2]],api.mul(direction,standoff)),q,mass:.5,friction:.08,restitution:0,movable:true,collidable:true,v:[0,0,0],angularVelocity:[0,0,0]};
 const world={objects:[object],bounds:{xMin:-13,xMax:13,zMin:-9,zMax:9},physicsSettings:{gravityMps2:9.81,groundFriction:.65},revision:0,collision:()=>false};world.physics=new api.PhysicsWorld(world);
 engine.reset();engine.state.root=[origin[0],h.bodyMetrics.standingHipHeightM,origin[2]];engine.state.yaw=yaw;
 for(const side of ['left','right'])engine.state.feet[side]={position:engine.stance(engine.state,side),yaw,contact:true};engine.state.pose=engine.solve(engine.state);
 const grips=api.graspFrames(object,yaw,false),ground=api.frame(object.p,object.q),hands=Object.fromEntries(['left','right'].map(side=>[side,api.compose(ground,grips[side])]));
 return{origin,yaw,object,world,grips,ground,hands};
}
function choose(h,f){const begin=performance.now();builds=0;const contact=api.motionChooseContact(h,f.origin,f.yaw,f.hands,f.world,[f.object.id],{objectPose:f.ground,grips:f.grips});return{contact,elapsedMs:performance.now()-begin,builds};}
function compare(h,full,projected,options,world,objectPose=null){
 const a=full.build(options),b=projected.build(options);full.validate(a);projected.validate(b);
 for(const [id,f]of b.frames){const other=a.frames.get(id),position=api.dist(f.p,other.p),sign=f.q.reduce((sum,v,k)=>sum+v*other.q[k],0)<0?-1:1;
  maximumPositionErrorM=Math.max(maximumPositionErrorM,position);maximumQuaternionComponentError=Math.max(maximumQuaternionComponentError,...f.q.map((v,k)=>Math.abs(v-sign*other.q[k])));
 }
 assert(maximumPositionErrorM<1e-11);assert(maximumQuaternionComponentError<1e-11);
 assert.deepEqual(JSON.parse(JSON.stringify(world.physics.actorSpheres(h,a.frames))),JSON.parse(JSON.stringify(world.physics.actorSpheres(h,b.frames))));
 assert.deepEqual(JSON.parse(JSON.stringify(api.contactHandSegments(h,a.frames))),JSON.parse(JSON.stringify(api.contactHandSegments(h,b.frames))));
 if(options.contactHand){const exact=api.contactHandObjectClearance(h,a.frames,world.physics,'tall',objectPose).minimumClearanceM,cached=api.motionRequireContactHandClearance(h,world,'tall',b.frames,objectPose,options.contactHand);assert(Math.abs(exact-cached)<1e-11,'local hand recipe proof equals all 38 directly queried bone segments');}
 comparedFrames++;
}
for(const [shapeIndex,shape]of [{},{statureScale:.95,legProportion:-.35,shoulderWidth:.7,hipWidth:.35,waistWidth:.65,torsoDepth:.55,armFullness:.75,legFullness:.65}].entries()){
 const {h,engine,pose}=human(shape),f=fixture(h,engine),cold=choose(h,f),hot=choose(h,f),contact=hot.contact;
 assert(cold.builds>450,'cold proof retains dense trajectories');assert.equal(hot.builds,1,'hot selected contact only rebuilds its endpoint; dense local certificates are reused');
 const projected=pose.forPreflight();assert(projected.rigidBranchProof.rigidEdges>0);assert.throws(()=>projected.apply(),/不能提交/);
 for(let i=0;i<=60;i++){
  const t=i/60,reference=blend(contact.reference,engine.motion.neutral,t),position=[0,contact.heightM+(h.bodyMetrics.standingHipHeightM-contact.heightM)*t,0];
  const carried=api.frame([0,contact.carryConfiguration.heightM,contact.carryConfiguration.forwardM],f.ground.q),object=api.frame(f.ground.p.map((v,k)=>v+(carried.p[k]-v)*t),f.ground.q);
  const hands=Object.fromEntries(['left','right'].map(s=>[s,api.compose(object,f.grips[s])]));
  compare(h,pose,projected,{reference,position,controlledFeet:true,hands,armPoleLateralM:contact.carryConfiguration.poleLateralM,contactHand:{mode:contact.contactHandMode,amount:1}},f.world,object);
 }
 const initial=pose.build(),startHands=Object.fromEntries(['left','right'].map(s=>[s,api.compose(initial.frames.get(s+'_hand'),api.frame(h.bodyMetrics.palmContact))]));
 const agent={h,phase:'reach',locomotion:{engine,pose},skill:{o:f.object,contactPose:contact,carryConfiguration:contact.carryConfiguration,reachStart:api.motionFreeHandEndpoints(h,initial.frames,startHands)}};
 const projectedAgent={...agent,locomotion:{engine,pose:projected},skill:{...agent.skill}};
 for(let i=0;i<=204;i++){const t=i/204,hands=api.motionReachHands(agent,f.hands,t),projectedHands=api.motionReachHands(projectedAgent,f.hands,t);assert.deepEqual(JSON.parse(JSON.stringify(projectedHands)),JSON.parse(JSON.stringify(hands)));compare(h,pose,projected,{...api.motionContactDescriptor(agent,hands,t),hands},f.world);}
 const gait=api.motionCarrySamples(h),gaitFull=new api.MotionLabPose(gait.pose.h===h?h:{...h},gait.engine);
 for(let i=0;i<=360;i++){
  const state=gait.states[i];gait.engine.state=structuredClone(state);const object=api.frame(api.add([state.root[0],contact.carryConfiguration.heightM,state.root[2]],api.rotate(api.qy(state.yaw),[0,0,contact.carryConfiguration.forwardM])),api.qm(api.qy(state.yaw),f.ground.q));
  const hands=Object.fromEntries(['left','right'].map(s=>[s,api.compose(object,f.grips[s])]));compare(h,gaitFull,gait.pose,{hands,armPoleLateralM:contact.carryConfiguration.poleLateralM,contactHand:{mode:contact.contactHandMode,amount:1}},f.world,object);
 }
 const shifted=fixture(h,engine,[2.125,0,-1.375],.73),transformed=choose(h,shifted);assert.equal(transformed.builds,1,'a common world translation/yaw reuses the local certificate');
 // A dynamic obstacle is queried afresh even though the body's local proof is cached.
 let environmentQueries=0;shifted.world.collision=()=>{environmentQueries++;return true;};
 assert.throws(()=>api.motionValidateTransferContacts(h,shifted.origin,shifted.yaw,shifted.grips,shifted.ground,contact,shifted.world,[shifted.object.id],252),/净空/);assert(environmentQueries>0);shifted.world.collision=()=>false;
 // A changed real foot anchor must produce new 205-frame reach evidence.
 engine.state.feet.left.position[0]+=.00001;engine.state.pose=engine.solve(engine.state);builds=0;
 const footReport=api.motionValidateContactReach(h,shifted.origin,shifted.yaw,shifted.hands,contact,shifted.world,[shifted.object.id],204,shifted.ground);assert(!footReport.certificateReused);assert(builds>204);
 const footBuilds=builds;builds=0;assert(api.motionValidateContactReach(h,shifted.origin,shifted.yaw,shifted.hands,contact,shifted.world,[shifted.object.id],204,shifted.ground).certificateReused);assert.equal(builds,0);
 const adapter=api.motionContactAdapter(h,shifted.origin,shifted.yaw),keyFor=(hands=shifted.hands,object=shifted.ground)=>api.motionLocalCertificate(h,adapter,shifted.origin,shifted.yaw,shifted.world,shifted.object.id,'test-inputs',local=>[local.frame(object),Object.fromEntries(['left','right'].map(s=>[s,local.frame(hands[s])]))]);
 keyFor().save({minimumClearanceM:.02,minimumHandClearanceM:.01,maximumPalmErrorM:0});assert(keyFor().cached);
 const wrist=structuredClone(shifted.hands);wrist.left.q=api.qm(api.qy(.0001),wrist.left.q);assert(!keyFor(wrist).cached,'wrist orientation is part of the proof');
 const moved=api.frame(api.add(shifted.ground.p,[.0001,0,0]),shifted.ground.q);assert(!keyFor(shifted.hands,moved).cached,'relative object position invalidates the proof');
 const physical=shifted.world.physics.bodies.get(shifted.object.id).body.shapes[0],oldHalf=physical.halfExtents.x;physical.halfExtents.x+=.001;assert(!keyFor().cached,'actual collider geometry, not only display dimensions, is keyed');physical.halfExtents.x=oldHalf;
 // A projected model can outlive feedback creation or rollback replacement.
 // Both paths must read current lean and invalidate unbalanced certificates.
 for(const sign of [-1,1]){
  h.__lightBalanceFeedback={active:true,pitchRad:sign*.012,rollRad:sign*.008,pelvisLocal:[sign*.003,0,-.002],a:{basic:{busy:false}}};
  assert(!keyFor().cached,'live balance correction is part of the certificate');
  compare(h,pose,projected,{},shifted.world);
  // Restore the original contact location for the hand-constrained sample.
  fixture(h,engine);
  const balancedContact=choose(h,f).contact,balancedInitial=pose.build(),balancedStart=Object.fromEntries(['left','right'].map(s=>[s,api.compose(balancedInitial.frames.get(s+'_hand'),api.frame(h.bodyMetrics.palmContact))]));
  const balancedAgent={...agent,skill:{...agent.skill,contactPose:balancedContact,carryConfiguration:balancedContact.carryConfiguration,reachStart:api.motionFreeHandEndpoints(h,balancedInitial.frames,balancedStart)}};
  for(let i=0;i<=204;i++){
   const u=i/204,hands=api.motionReachHands(balancedAgent,f.hands,u),options={...api.motionContactDescriptor(balancedAgent,hands,u),hands};
   compare(h,pose,projected,options,f.world);
   const shoulders=projected.reachShoulders(options),full=pose.build(options);
   for(const side of ['left','right'])assert(api.dist(shoulders.get(side+'_upperArm').p,full.frames.get(side+'_upperArm').p)<1e-11);
  }
  h.__lightBalanceFeedback.rollRad+=.003;
  const adjusted=api.motionReachHands(balancedAgent,f.hands,1);
  for(const side of ['left','right'])assert(api.dist(adjusted[side].p,f.hands[side].p)<1e-11,'changing lean during the same reach must still end at the world palm goal');
  h.__lightBalanceFeedback.rollRad-=.003;
  keyFor().save({minimumClearanceM:.02,minimumHandClearanceM:.01,maximumPalmErrorM:0});assert(keyFor().cached);
 }
 delete h.__lightBalanceFeedback;
 h.bodyMetrics={...h.bodyMetrics};let model=api.motionPreflightModel(h);h.bodyMetrics.armRadiusM+=.00001;assert.notEqual(api.motionPreflightModel(h),model,'in-place body metric edits clear old proof');h.bodyMetrics.armRadiusM-=.00001;
 model=api.motionPreflightModel(h);h.resolvedRig={...h.resolvedRig,geometryKey:'updated-version'};assert.notEqual(api.motionPreflightModel(h),model,'same h rig version updates clear old proof');
 model=api.motionPreflightModel(h);const bind=h.sourceBind.get('head');bind.q=api.qm(api.qy(.00001),bind.q);assert.notEqual(api.motionPreflightModel(h),model,'in-place bind quaternion edits clear old proof');
 results.push({shapeIndex,coldMs:cold.elapsedMs,coldBuilds:cold.builds,hotMs:hot.elapsedMs,hotBuilds:hot.builds,transformedMs:transformed.elapsedMs,transformedBuilds:transformed.builds,actualFootAnchorMissBuilds:footBuilds,projection:projected.rigidBranchProof});
}
console.log(JSON.stringify({comparedFrames,maximumPositionErrorM,maximumQuaternionComponentError,results,scope:'full rendered skeleton and all 36 body proxies plus 38 hand segments compared; local caching never stores environment collision conclusions'}));



