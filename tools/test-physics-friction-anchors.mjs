// Exercise the actual adapter and pinned solver at different world positions.
// Friction anchors must stay local to their owner; scene translation cannot
// turn a small grounded box into a body that slides indefinitely.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../world/physics/vendor/cannon-es.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const Physics=vm.runInNewContext(read('world/PhysicsContract.js')+'\n'+read('world/PhysicsWorld.js')+'\nPhysicsWorld',{WorkbenchPhysicsEngine:C});
let maximumSpeedAfterOneSecond=0,maximumLocalAnchorM=0,cases=0;
for(const [x,z] of [[0,0],[-2,4],[7,-5],[-10,6]])for(const direction of [-1,1]){
 const object={id:'box',shape:'box',w:.3,h:.6,d:.3,mass:.5,friction:.08,restitution:0,movable:true,collidable:true,p:[x,.3,z],q:[0,0,0,1],v:[0,0,0],angularVelocity:[0,0,0]};
 const world={objects:[object],bounds:{xMin:-13,xMax:13,zMin:-9,zMax:9},physicsSettings:{gravityMps2:9.81,groundFriction:.65},revision:0};
 const physics=new Physics(world);
 assert.equal(physics.engine.narrowphase.enableFrictionReduction,false);
 for(let i=0;i<120;i++)physics.step(1/120,[]);
 object.v=[.4*direction,0,0];physics.syncScene();
 for(let i=0;i<120;i++){
  physics.step(1/120,[]);
  for(const f of physics.engine.frictionEquations){
   const anchor=f.bi.workbenchId==='box'?f.ri:f.bj.workbenchId==='box'?f.rj:null;
   if(anchor){maximumLocalAnchorM=Math.max(maximumLocalAnchorM,anchor.length());assert(anchor.length()<.4,'Box-local friction anchor must stay on the box');}
  }
 }
 const state=physics.objectState('box');maximumSpeedAfterOneSecond=Math.max(maximumSpeedAfterOneSecond,state.speedMps);
 assert(state.supported&&state.settled,'Grounded box must settle at every world location');
 assert(state.speedMps<.01);cases++;
}
console.log(JSON.stringify({cases,maximumSpeedAfterOneSecond,maximumLocalAnchorM,engine:'cannon-es 0.20.0',vendorModified:false}));
