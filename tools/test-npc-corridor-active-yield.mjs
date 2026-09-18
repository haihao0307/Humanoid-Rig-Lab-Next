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
const gaitSource=read('body/NaturalLocomotion.js');
assert(!gaitSource.includes('waitForTraffic('));
const fullBody=read('motion/vendor/full-body.mjs').replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL('../motion/vendor/'+path,import.meta.url).href));
const {FullBodyMotion,blend,relaxedHandRotation}=await import('data:text/javascript;base64,'+Buffer.from(fullBody+'\nexport {blend,relaxedHandRotation};').toString('base64'));
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const code=math+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(rig)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/CharacterShape.js')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js')+'\n'+gaitSource;
const horizontal=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const objectYaw=()=>0;
const objectFootprint=o=>o.shape==='box'?[o.w/2,o.d/2]:[o.r,o.r];
const objectRadius=o=>o.shape==='box'?Math.hypot(o.w,o.d)/2:o.r;
const pointToObjectClearance=(p,o)=>{
 const dx=p[0]-o.p[0],dz=p[2]-o.p[2];
 if(o.shape==='box'){const qx=Math.max(Math.abs(dx)-o.w/2,0),qz=Math.max(Math.abs(dz)-o.d/2,0);return Math.hypot(qx,qz);}
 return Math.max(0,Math.hypot(dx,dz)-o.r);
};
const api=vm.runInNewContext(code+'\n'+read('world/GridNavigation.js')+'\n({resolveCharacterRig,resolveCharacterMetrics,r2SourceFrames,NaturalLocomotion,motionCircleSweep,campGridPath,dist})',{
 structuredClone,SHAPE_SCHEMA,SHAPE_REVISION,normalizeCharacterShape,characterShapeParameterKey,createCharacterShapeField,CHARACTER_DEFORMATION_RULES,HUMAN_GENERATOR_REVISION:'corridor-active-yield-test',
 degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],horizontal,angleDiff:(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),objectTilted:()=>false,objectYaw,objectRadius,objectFootprint,pointToObjectClearance,
 bodyPhysicalProfile:h=>({bodyRadiusM:h.bodyMetrics.bodyRadiusM}),carryRouteRadius:()=>.55,MotionLab:{FullBodyMotion,blend,relaxedHandRotation,solveTwoBone,MotionController,rigFromSource,FlatWorld}});

function makeHuman(){
 const resolvedRig=api.resolveCharacterRig({}),bodyMetrics=api.resolveCharacterMetrics(resolvedRig),sourceBind=api.r2SourceFrames(resolvedRig),h={resolvedRig,bodyMetrics,sourceBind,arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 return h;
}

const referenceHuman=makeHuman(),bodyRadiusM=referenceHuman.bodyMetrics.bodyRadiusM,corridorHalf=bodyRadiusM+.42;
const walls=[
 {id:'corridor-left',shape:'box',p:[-corridorHalf,0,0],w:.18,d:2.8,held:false,collidable:true},
 {id:'corridor-right',shape:'box',p:[corridorHalf,0,0],w:.18,d:2.8,held:false,collidable:true}
];
const blockedRetreat=process.argv.includes('--blocked-retreat');
if(blockedRetreat)walls.push(...[-1,1].map(side=>({id:'blocked-bay-'+side,shape:'box',p:[side*1.1,0,-2.8],w:1.2,d:.5,held:false,collidable:true})));
const world={objects:walls,bounds:{xMin:-6,xMax:6,zMin:-6,zMax:6},get:()=>null,population:null};
world.collision=(p,r,ignore=[])=>walls.some(o=>!ignore.includes(o.id)&&pointToObjectClearance(p,o)<r+.06);
const clearSegment=(start,end,r,ignore)=>{const steps=Math.max(1,Math.ceil(horizontal(start,end)/.05));for(let i=1;i<=steps;i++){const t=i/steps,p=[start[0]+(end[0]-start[0])*t,0,start[2]+(end[2]-start[2])*t];if(world.collision(p,r,ignore))return false;}return true;};
world.path=(start,end,r=.3,ignore=[])=>{
 if(blockedRetreat)return api.campGridPath(world,start,end,r,ignore);
 if(clearSegment(start,end,r,ignore))return[[...end]];
 const gate=1.72,route=start[2]>=0&&end[2]<0?[[0,0,gate],[0,0,-gate],[...end]]:start[2]<=0&&end[2]>0?[[0,0,-gate],[0,0,gate],[...end]]:null;
 if(!route)throw Error('static route blocked');let from=start;
 for(const point of route){if(!clearSegment(from,point,r,ignore))throw Error('static route blocked');from=point;}
 return route;
};
const specs=[['npc-a',[0,0,-2.5],[0,0,2.5],0],['npc-b',[0,0,2.5],[0,0,-2.5],Math.PI]];
const skewClocks=process.argv.includes('--skew-clocks');
const actors=specs.map(([id,start,goal,yaw],index)=>{
 const human=index===0?referenceHuman:makeHuman(),agent={npcId:id,h:human,pos:[start[0],0,start[2]],yaw,time:0,index:0,phase:'walk',held:null,skill:{type:'walk'},route:[[...goal]],routeIndex:0,manipulationPace:()=>1,strength:{movementFactor:()=>1},walkSpeed:0,w:world,logs:[],log(message){this.logs.push(message);}};
 if(skewClocks)agent.time=index?100:10;
 const actor={id,label:id,human,agent,goal,disposed:false,done:false};actor.locomotion=new api.NaturalLocomotion(agent);agent.locomotion=actor.locomotion;return actor;
});
world.population={
 elapsedS:0,
 values:()=>actors,
 collisionFor:(agent,p,r)=>actors.some(other=>other.agent!==agent&&!other.disposed&&horizontal(p,other.agent.pos)<r+other.human.bodyMetrics.bodyRadiusM+.06),
 sweepFor:(agent,start,end,r)=>actors.filter(other=>other.agent!==agent&&!other.disposed).reduce((fraction,other)=>Math.min(fraction,api.motionCircleSweep(start,end,other.agent.pos,r+other.human.bodyMetrics.bodyRadiusM+.06)),1)
};
const stateRows=()=>actors.map(actor=>({id:actor.id,done:actor.done,position:actor.agent.pos,goal:actor.goal,targetErrorM:horizontal(actor.agent.pos,actor.goal),routeIndex:actor.agent.routeIndex,route:actor.agent.route,command:actor.locomotion.engine.state.command,status:actor.locomotion.engine.state.status,fault:actor.locomotion.engine.state.fault,traffic:actor.locomotion.traffic,logs:actor.agent.logs.slice(-12)}));
const debug=(failed,error)=>({failed,error:error.message,frame:frames,bodyRadiusM,corridorHalf,actors:stateRows()});
let minSeparation=Infinity,frames=0,maxConcurrentOwners=0,circulationTravelM=0,ownerHeldAtArrival=false;
for(;frames<10000&&!actors.every(actor=>actor.done);frames++){
 world.population.elapsedS+=1/120;
 const before=new Map(actors.map(actor=>[actor.id,[...actor.agent.pos]]));
 const order=frames%2?actors:[...actors].reverse();
 for(const actor of order){
  if(actor.done)continue;const a=actor.agent,l=actor.locomotion;a.time+=1/120;
  // Mirror TaskAgent.finish's semantic completion. Leaving a mock walk skill
  // live after arrival would retain its lease until expiry, unlike production.
  try{const moving=l.move(1/120,.48);l.update(1/120);l.pose.validate(l.pose.build());if(!moving){actor.done=true;a.skill=null;}}catch(error){console.error('CORRIDOR_DEBUG '+JSON.stringify(debug(actor.id,error)));throw error;}
 }
 const owners=actors.filter(actor=>actor.locomotion.traffic.mode==='corridor-owner'&&actor.locomotion.traffic.corridorOwner===actor.id);
 if(owners.some(actor=>horizontal(actor.agent.pos,actor.goal)<.05))ownerHeldAtArrival=true;
 maxConcurrentOwners=Math.max(maxConcurrentOwners,owners.length);
 assert(owners.length<=1,'one narrow corridor cannot have two simultaneous direction owners');
 for(const actor of actors)if(actor.locomotion.traffic.mode==='corridor-circulation')circulationTravelM+=horizontal(before.get(actor.id),actor.agent.pos);
 minSeparation=Math.min(minSeparation,horizontal(actors[0].agent.pos,actors[1].agent.pos));
}
if(!actors.every(actor=>actor.done))console.error('CORRIDOR_FINAL '+JSON.stringify({frames,minSeparation,bodyRadiusM,corridorHalf,maxConcurrentOwners,circulationTravelM,actors:stateRows()}));
assert(actors.every(actor=>actor.done),'both corridor users must complete their original routes');
for(const actor of actors){assert(horizontal(actor.agent.pos,actor.goal)<.025);assert(!Object.hasOwn(actor.locomotion.traffic,'waitS'));}
assert(minSeparation>.50,'continuous sweep must retain body clearance');
const claims=actors.reduce((n,a)=>n+a.locomotion.traffic.corridorClaims,0),yields=actors.reduce((n,a)=>n+a.locomotion.traffic.corridorYields,0);
assert(claims>=1,'one direction must obtain corridor ownership');
assert.equal(maxConcurrentOwners,1,'the exclusive direction owner must be observable during passage');
assert(ownerHeldAtArrival,'a goal at the exit must retain direction ownership through arrival');
assert(yields>=1,'the opposite direction must actively retreat or side-step');
assert(circulationTravelM>.1,'the non-owner must keep circulating instead of parking');
assert(actors.some(actor=>actor.agent.logs.some(message=>message.includes('循环路线'))));
const recoveries=actors.reduce((n,actor)=>n+actor.locomotion.traffic.recoveries,0),ownerManeuvers=actors.reduce((n,actor)=>n+(actor.locomotion.traffic.corridorManeuvers||0),0);
assert(recoveries<128,'corridor must not repeatedly recover without route completion');
if(blockedRetreat)assert(actors.some(actor=>actor.agent.logs.some(message=>message.includes('本侧出口缺少撤离空间'))),'blocked retreat must negotiate direction ownership');
console.log(JSON.stringify({passed:true,agents:2,frames,skewClocks,blockedRetreat,bodyRadiusM,corridorHalf,minSeparationM:minSeparation,corridorClaims:claims,corridorYields:yields,maxConcurrentOwners,ownerHeldAtArrival,circulationTravelM,recoveries,ownerManeuvers,parkingWait:false}));
