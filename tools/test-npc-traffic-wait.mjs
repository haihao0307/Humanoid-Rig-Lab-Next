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
const gaitSource=read('body/NaturalLocomotion.js');
assert(!gaitSource.includes('waitForTraffic('),'traffic parking wait must not return');
const code=math+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(rig)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js')+'\n'+gaitSource;
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const objectRadius=o=>o.shape==='box'?Math.hypot(o.w,o.d)/2:o.r;
const objectFootprint=o=>o.shape==='box'?[o.w/2,o.d/2]:[o.r,o.r];
const api=vm.runInNewContext(code+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,NaturalLocomotion,motionCircleSweep,trafficPairSide,dist})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'traffic-detour-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff:(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),objectTilted:()=>false,objectYaw:()=>0,objectRadius,objectFootprint,
 bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),carryRouteRadius:()=>.5483321537,MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}});
assert.equal(api.trafficPairSide('npc-a','npc-b'),api.trafficPairSide('npc-b','npc-a'),'pair side must be symmetric and deterministic');

function makeHuman(shape={}){
 const resolvedRig=api.resolveCharacterRig(shape),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 return h;
}
function makeWorld(objects=[],path=null){
 const world={objects,bounds:{xMin:-6,xMax:6,zMin:-6,zMax:6},population:null};
 world.collision=(p,r,ignore=[])=>objects.some(o=>!ignore.includes(o.id)&&o.collidable!==false&&horizontal(p,o.p)<r+objectRadius(o)+.06);
 world.path=path||((start,end)=>[[...end]]);return world;
}
function makeAgent(id,h,world,target){return{npcId:id,h,pos:[0,0,0],yaw:0,time:0,phase:'walk',held:null,skill:{type:'walk'},route:[[...target]],routeIndex:0,manipulationPace:()=>1,strength:{movementFactor:()=>1},walkSpeed:0,w:world,logs:[],log(message){this.logs.push(message);}};}
function run(agent,loc,maxFrames=6000){
 let completed=false,maxFootErrorM=0,travelAfterOneSecond=0;
 for(let i=0;i<maxFrames;i++){
  agent.time+=1/120;const moving=loc.move(1/120,.48);loc.update(1/120);
  const state=loc.engine.state;loc.pose.validate(loc.pose.build());
  for(const side of ['left','right'])maxFootErrorM=Math.max(maxFootErrorM,api.dist(state.pose.legs[side].end,state.feet[side].position));
  if(i===120)travelAfterOneSecond=horizontal(agent.pos,[0,0,0]);
  if(!moving){completed=true;break;}
 }
 return{completed,maxFootErrorM,travelAfterOneSecond};
}

const dynamicHuman=makeHuman(),blockerHuman=makeHuman(),dynamicWorld=makeWorld(),goal=[0,0,3.2];
const dynamicAgent=makeAgent('npc-a',dynamicHuman,dynamicWorld,goal),blocker={id:'npc-b',label:'阻挡人物',human:blockerHuman,agent:{pos:[0,0,1.55],yaw:Math.PI,walkSpeed:0,paused:false},disposed:false};
dynamicWorld.population={
 values:()=>[blocker],
 collisionFor:(agent,p,r)=>horizontal(p,blocker.agent.pos)<r+blockerHuman.bodyMetrics.bodyRadiusM+.06,
 sweepFor:(agent,start,end,r)=>api.motionCircleSweep(start,end,blocker.agent.pos,r+blockerHuman.bodyMetrics.bodyRadiusM+.06)
};
const dynamicLoc=new api.NaturalLocomotion(dynamicAgent);dynamicAgent.locomotion=dynamicLoc;
const dynamicResult=run(dynamicAgent,dynamicLoc);
assert(dynamicResult.completed,'detour must complete the original route without parking');
assert(dynamicLoc.traffic.detours>0,'predicted conflict must create a local detour');
assert(dynamicResult.travelAfterOneSecond>.05,'actor must keep making route progress instead of standing in place');
assert(!Object.hasOwn(dynamicLoc.traffic,'waitS'),'traffic state must not expose a parking-wait timer');
assert(horizontal(dynamicAgent.pos,goal)<.02,'detour must rejoin the original destination');

const obstacle={id:'crate',shape:'sphere',p:[0,0,1.35],r:.32,held:false,collidable:true},staticGoal=[0,0,3.0];
const staticWorld=makeWorld([obstacle],(start,end)=>[[.95,0,.65],[.95,0,2.05],[...end]]),staticHuman=makeHuman(),staticAgent=makeAgent('npc-static',staticHuman,staticWorld,staticGoal),staticLoc=new api.NaturalLocomotion(staticAgent);staticAgent.locomotion=staticLoc;
const staticResult=run(staticAgent,staticLoc);
assert(staticResult.completed,'a moved object must trigger replanning rather than indefinite waiting');
assert(staticLoc.traffic.replans>0,'static route obstruction must run a bounded route replan');
assert(horizontal(staticAgent.pos,staticGoal)<.02);
assert(Math.max(dynamicResult.maxFootErrorM,staticResult.maxFootErrorM)<1e-7);
// Reduced browser failure: a safe westward target next to a crate, while the
// body still faces into its south edge. Reissuing walk used to reject every
// tick until turning happened to finish. Exercise real motion and foot anchors.
const edgeHuman=makeHuman(),edgeRadius=edgeHuman.bodyMetrics.bodyRadiusM,edgeGoal=[-1.2,0,.65];
const edgeBox={id:'edge-crate',shape:'box',p:[0,0,0],w:.4,d:.34,collidable:true};
const edgeWorld=makeWorld([edgeBox]);
edgeWorld.collision=(p,r)=>Math.hypot(Math.max(Math.abs(p[0])-.2,0),Math.max(Math.abs(p[2])-.17,0))<r+.06;
const edgeAgent=makeAgent('npc-edge',edgeHuman,edgeWorld,edgeGoal);
edgeAgent.pos=[-.08,0,.17+edgeRadius+.06+1e-8];edgeAgent.yaw=-1.884;
const edgeLoc=new api.NaturalLocomotion(edgeAgent);edgeAgent.locomotion=edgeLoc;
const edgeResult=run(edgeAgent,edgeLoc,2400);
assert(edgeResult.completed,'recovery must finish the original task after aligning');
assert(edgeLoc.traffic.recoveries>=1&&edgeLoc.traffic.recoveries<=2,'alignment must prevent a burst of repeated CCD rejections');
assert.equal(edgeLoc.engine.state.metrics.rejected,0,'recovery must preserve valid foot anchors');
assert(edgeResult.maxFootErrorM<1e-7);
// A cancelled/replaced task must not continue the old recovery target.
edgeLoc.traffic.recoveryTarget={point:[1,0,1],taskKey:'old-task'};
assert.equal(edgeLoc.continueTrafficRecovery(1/120),false);
assert.equal(edgeLoc.traffic.recoveryTarget,null);
const recoveryFor=loc=>({point:[-1,0,1],goal:[...loc.a.route.at(-1)],taskKey:'|walk|||walk',...Object.fromEntries(['intersectionKey','intersectionOwner','corridorKey','corridorOwner'].map(key=>[key,loc.traffic[key]]))});
edgeLoc.traffic.recoveryTarget=recoveryFor(edgeLoc);edgeAgent.route=[[1,0,1]];
assert.equal(edgeLoc.continueTrafficRecovery(1/120),false,'same-index replacement with a new goal invalidates recovery');
edgeLoc.traffic.recoveryTarget=recoveryFor(edgeLoc);edgeLoc.traffic.corridorOwner='new-owner';
assert.equal(edgeLoc.continueTrafficRecovery(1/120),false,'traffic ownership changes invalidate recovery');
const tangentAgent=makeAgent('npc-tangent',edgeHuman,edgeWorld,[-1.2,0,.17+edgeRadius+.06+1e-8]);
tangentAgent.pos=[-.08,0,.17+edgeRadius+.06+1e-8];tangentAgent.yaw=-1.884;
const tangentLoc=new api.NaturalLocomotion(tangentAgent);tangentAgent.locomotion=tangentLoc;
const tangentResult=run(tangentAgent,tangentLoc,2400);
assert(tangentResult.completed,'a tangent route must not stall inside the turn completion tolerance');
assert(tangentLoc.traffic.recoveries<=2,'tangent recovery must not repeatedly hit the same edge');
// Exact browser stance, including the already active right-foot swing. A
// standing-only test misses a deadlock caused by switching turning modes here.
const sample=JSON.parse(read('tools/traffic-recovery-fixture.json'));
const recipes=vm.runInNewContext(read('control/NPCPopulation.js')+'\n({npcMotherVariant})',{npcCopy:structuredClone,validateNPCDefinition:v=>v});
const replayHuman=makeHuman(recipes.npcMotherVariant({character:{appearance:{skin:{}}}}).character.shape);
const replayWorld=makeWorld([{id:'AGR_B',shape:'box',p:[11.2,.14,-2.95],w:.4,d:.34,collidable:true}]);
replayWorld.bounds={xMin:-20,xMax:20,zMin:-20,zMax:20};
replayWorld.collision=(p,r)=>Math.hypot(Math.max(Math.abs(p[0]-11.2)-.2,0),Math.max(Math.abs(p[2]+2.95)-.17,0))<r+.06;
const replayAgent=makeAgent('npc-replay',replayHuman,replayWorld,sample.target);replayAgent.pos=sample.root;replayAgent.yaw=sample.yaw;
const replayLoc=new api.NaturalLocomotion(replayAgent);replayAgent.locomotion=replayLoc;
Object.assign(replayLoc.engine.state,{root:sample.root,yaw:sample.yaw,command:sample.command,feet:sample.feet,swing:sample.swing,status:'blocked',speed:0});
replayLoc.engine.state.pose=replayLoc.engine.solve(replayLoc.engine.state);replayLoc.sync();
assert(replayLoc.recoverNavigationBlock('连续碰撞检测发现路线受阻'));
const replayResult=run(replayAgent,replayLoc,1800);
assert(replayResult.completed,'mid-swing browser recovery must finish without switching foot scheduling');
assert.equal(replayLoc.traffic.recoveries,1);
assert(replayResult.maxFootErrorM<1e-7);
console.log(JSON.stringify({passed:true,parkingWait:false,detours:dynamicLoc.traffic.detours,replans:staticLoc.traffic.replans,dynamicTravelAfterOneSecondM:dynamicResult.travelAfterOneSecond,maxFootErrorM:Math.max(dynamicResult.maxFootErrorM,staticResult.maxFootErrorM)}));
console.log(JSON.stringify({recoveryAlignment:true,recoveries:edgeLoc.traffic.recoveries,tangentRecoveries:tangentLoc.traffic.recoveries,midSwingRecoveries:replayLoc.traffic.recoveries,completed:edgeResult.completed,maxFootErrorM:Math.max(edgeResult.maxFootErrorM,replayResult.maxFootErrorM)}));
