// A supported object must not receive a kinematic ejection impulse when its
// contacting arm withdraws and the normal owner collision pair is restored.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../world/physics/vendor/cannon-es.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const Physics=vm.runInNewContext(read('world/PhysicsContract.js')+'\n'+read('world/PhysicsWorld.js')+'\nPhysicsWorld',{WorkbenchPhysicsEngine:C,structuredClone});
let cases=0,maxReleaseTravelM=0,maxPostReleaseSpeedMps=0;
for(const yaw of [0,.7])for(const offset of [[0,0],[-2,4]]){
 const q=new C.Quaternion().setFromAxisAngle(new C.Vec3(0,1,0),yaw),worldPoint=p=>{const v=q.vmult(new C.Vec3(...p));return[v.x+offset[0],v.y,v.z+offset[1]];};
 const object={id:'box',shape:'box',w:.3,h:.6,d:.3,mass:.5,friction:.08,restitution:0,movable:true,collidable:true,p:worldPoint([0,.3,0]),q:[q.x,q.y,q.z,q.w],v:[0,0,0],angularVelocity:[0,0,0]};
 const world={objects:[object],bounds:{xMin:-13,xMax:13,zMin:-9,zMax:9},physicsSettings:{gravityMps2:9.81,groundFriction:.65},revision:0};
 const physics=new Physics(world);for(let i=0;i<120;i++)physics.step(1/120,[]);
 const map=new Map(),set=(id,p)=>map.set(id,{world:{p:worldPoint(p)}});
 set('hips',[0,.9,-1]);set('neck',[0,1.4,-1]);set('head',[0,1.5,-1]);
 set('left_upperArm',[-.2,.7,-.38]);set('left_forearm',[-.15,.40,-.17]);set('left_hand',[-.15,.30,-.15]);
 const human={byId:map,bodyMetrics:{torsoRadiusM:.15,headRadiusM:.10,armRadiusM:.04,legRadiusM:.07}},agent={npcId:'one',h:human,pos:worldPoint([0,0,-1]),held:object};
 physics.prepareActors([agent],1/120);
 const initial=physics.ownerClearance('box',agent);assert(initial.minimumClearanceM<0,'fixture starts with the contacting forearm proxy overlapping');
 physics.setManipulation(object,{p:[...object.p],q:[...object.q]},'carry',{ownerId:'one',maxForceN:20,maxHorizontalForceN:20,maxTorqueNm:2});
 physics.beginRelease('box','one');assert.throws(()=>physics.beginRelease('box','someone-else'),/所有权/);
 const checkpoint=physics.capture(),start=[...object.p],ownerGroup=physics.actorGroups.get('one');
 assert.equal(physics.bodies.get('box').body.collisionFilterMask&ownerGroup,0,'only the established owner pair stays excluded during withdrawal');
 for(let i=1;i<=90;i++){
  const retreat=.35*i/90;set('left_upperArm',[-.2,.7,-.38-retreat]);set('left_forearm',[-.15,.40,-.17-retreat]);set('left_hand',[-.15,.30,-.15-retreat]);
  physics.step(1/120,[agent]);const m=physics.manipulations.get('box');assert.equal(m.appliedForceN,0);assert.equal(m.appliedTorqueNm,0);
  maxReleaseTravelM=Math.max(maxReleaseTravelM,Math.hypot(...object.p.map((v,k)=>v-start[k])));
 }
 const separated=physics.ownerClearance('box',agent,null,true);assert(separated.minimumClearanceM>.008,'rendered and physical proxy positions both have positive clearance');
 physics.clearManipulation('box');agent.held=null;
 assert(physics.bodies.get('box').body.collisionFilterMask&ownerGroup,'normal owner collision is restored');
 for(let i=0;i<120;i++){physics.step(1/120,[agent]);maxPostReleaseSpeedMps=Math.max(maxPostReleaseSpeedMps,physics.objectState('box').speedMps);}
 assert(Math.hypot(...object.p.map((v,k)=>v-start[k]))<.0001,'restoring a separated pair cannot launch the supported object');
 physics.restore(checkpoint);assert.equal(physics.manipulations.get('box').separating,true,'rollback preserves the release phase and zero-force owner contact');
 assert.equal(physics.manipulations.get('box').maxForceN,0);cases++;
}
assert(maxReleaseTravelM<.0001);assert(maxPostReleaseSpeedMps<.001);
console.log(JSON.stringify({cases,maxReleaseTravelM,maxPostReleaseSpeedMps,objectRemainsDynamic:true,poseAssignedByTask:false,vendorModified:false}));
