// Navigation must not return segments rejected by the production body sweep.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {FlatWorld} from '../motion/vendor/world.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),runtime=read('source/runtime.template.js');
const code=runtime.split('// MODULE math')[1].split('function matrix')[0]+'\n'+
 runtime.slice(runtime.indexOf('function objectYaw'),runtime.indexOf('/*__SOURCE:world/PhysicsContract.js__*/'))+'\n'+read('world/PhysicsContract.js')+'\n'+read('world/GridNavigation.js')+'\n'+read('body/NaturalLocomotion.js');
const api=vm.runInNewContext(code+'\n({campGridPath,motionWorldSweep,motionCircleSweep,NaturalLocomotion,pointToObjectClearance,qx,qy,rotate})',{MotionLab:{FlatWorld},bodyPhysicalProfile:h=>h.bodyMetrics,horizontal:(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2])});
const box=(yaw)=>({id:'skew',p:[0,.5,0],shape:'box',w:.3,h:1,d:1.8,yaw,q:api.qy(yaw),collidable:true});
let paths=0;
for(const yaw of [0,.37,-.61,1.1]){
 const object=box(yaw),world={objects:[object],bounds:{xMin:-3,xMax:3,zMin:-3,zMax:3}};
 const local=[.45,0,.7],point=api.rotate(api.qy(yaw),local);
 assert(Math.abs(api.pointToObjectClearance(point,object)-.3)<1e-9,'rotated box clearance must use the physical quaternion convention');
 for(let i=0;i<16;i++){
  const angle=i*Math.PI/8,start=[Math.sin(angle)*2,0,Math.cos(angle)*2],end=start.map(v=>-v),route=api.campGridPath(world,start,end,.26);
  let prior=start;
  for(const target of route){const sweep=api.motionWorldSweep(world,prior,target,.26);assert(!sweep.blocked,JSON.stringify({yaw,start,end,prior,target,fraction:sweep.fraction}));prior=target;}
  paths++;
 }
}
for(const object of [{id:'round',shape:'sphere',p:[0,.3,0],r:.3,collidable:true},{...box(.37),q:api.qx(.3)}]){
 const world={objects:[object],bounds:{xMin:-3,xMax:3,zMin:-3,zMax:3}},start=[-2,0,-.2],end=[2,0,.2];
 let prior=start;
 for(const point of api.campGridPath(world,start,end,.26)){assert(!api.motionWorldSweep(world,prior,point,.26).blocked,'round and tilted footprints must agree with the body sweep');prior=point;}
 paths++;
 assert.equal(api.campGridPath(world,start,end,.26,[object.id]).length,1,'ignored interaction objects must not block routing');
}
const parked={id:'parked',human:{bodyMetrics:{bodyRadiusM:.26}},agent:{pos:[0,0,2.75],walkSpeed:0,skill:null,plan:null}};
const world={bounds:{xMin:-5,xMax:5,zMin:-5,zMax:5},objects:[-1,1].map(sign=>({id:'wall'+sign,shape:'box',p:[sign*.68,0,0],w:.18,h:1,d:4.2,collidable:true})),population:{values:()=>[parked]}};
const goal=[0,0,-2.75],agent={w:world,route:[[0,0,2.5],goal],routeIndex:0,time:1};
const loc=Object.assign(Object.create(api.NaturalLocomotion.prototype),{a:agent,engine:{state:{root:[-1.1,0,3.05]}},traffic:{replans:0}}),context={radius:.27,ignore:[]};
assert(loc.replanStationaryRoute({actor:parked},context),'a parked portal owner requires a route around the entire obstruction');
assert.deepEqual([...agent.route.at(-1)],goal,'temporary NPC footprints must preserve the task endpoint');
assert.equal(world.objects.length,2,'planning must not mutate shared world objects');
let prior=loc.engine.state.root;
for(const point of agent.route){assert(!api.motionWorldSweep(world,prior,point,.27).blocked);assert(api.motionCircleSweep(prior,point,parked.agent.pos,.27+.26+.06)>=1-1e-6);prior=point;}
agent.time=2;assert.equal(loc.replanStationaryRoute({actor:parked},context),false,'an already clear route must not trigger repeated replans');
parked.agent.skill={type:'walk'};parked.agent.walkSpeed=.3;
assert.equal(loc.replanStationaryRoute({actor:parked},context),false,'moving traffic is not frozen into a route snapshot');
parked.agent.paused=true;agent.route=[[0,0,2.5],goal];
assert(loc.replanStationaryRoute({actor:parked},context),'paused actors remain planning obstacles');
// Grasping expands the conservative route radius. Navigation already permits
// monotone exits from that extra margin; the runtime sweep must agree without
// allowing an unladen body or a foot to escape through actual occupied space.
for(const yaw of [0,.37,-.61]){
 const object={...box(yaw),d:.3},world={objects:[object],bounds:{xMin:-3,xMax:3,zMin:-3,zMax:3}};
 const point=x=>api.rotate(api.qy(yaw),[x,0,0]),start=point(.55),end=point(2),context={escapeRadius:.26};
 assert(api.motionWorldSweep(world,start,end,.55).blocked,'ordinary collision semantics remain strict');
 assert(!api.motionWorldSweep(world,start,end,.55,[],context).blocked,'loaded clearance expansion must allow a strictly outward exit');
 assert(api.motionWorldSweep(world,start,point(.45),.55,[],context).blocked,'inward motion remains blocked');
 assert(api.motionWorldSweep(world,point(.3),end,.55,[],context).blocked,'actual body overlap remains blocked');
 let prior=start;for(const target of api.campGridPath(world,start,end,.55)){assert(!api.motionWorldSweep(world,prior,target,.55,[],context).blocked);prior=target;}
 const wall={id:'exit-wall',shape:'box',p:point(1.5),q:api.qy(yaw),w:.2,h:1,d:2};world.objects.push(wall);
 assert(api.motionWorldSweep(world,start,end,.55,[],context).blocked,'escaping one margin must still sweep every other obstacle');
}
console.log(JSON.stringify({passed:true,paths,rotatedClearance:true,continuousSegments:true,stationaryPortalRoute:true,loadedMarginExit:true}));
