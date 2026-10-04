// Actual Cannon dynamics for a supported edge tip, hold and return.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../world/physics/vendor/cannon-es.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const api=vm.runInNewContext(math+'\n'+read('world/PhysicsContract.js')+'\n'+read('world/PhysicsWorld.js')+'\n({PhysicsWorld,qx,rotate,sub,qangle,objectWorldHalfExtents})',{WorkbenchPhysicsEngine:C,structuredClone});
const dt=1/120,pivot=[0,-.14,.14],theta=20*Math.PI/180;
function run(torqueLimit){
 const object={id:'box',shape:'box',w:.3,h:.28,d:.28,mass:1.2,friction:.4,restitution:.08,movable:true,collidable:true,p:[0,.14,0],q:[0,0,0,1],v:[0,0,0],angularVelocity:[0,0,0]};
 const world={objects:[object],bounds:{xMin:-10,xMax:10,zMin:-10,zMax:10},physicsSettings:{gravityMps2:9.81,groundFriction:.65},revision:0},physics=new api.PhysicsWorld(world);
 for(let i=0;i<120;i++)physics.step(dt,[]);
 object.held=true;object.heldOwner='test';const actor={npcId:'test',held:object,pos:[0,0,-4],h:{byId:new Map([['head',{world:{p:[0,1.5,-4]}}]]),bodyMetrics:{headRadiusM:.1,torsoRadiusM:.15,armRadiusM:.04,legRadiusM:.07}}};let peakError=null,maximumTorqueNm=0,minimumGroundM=Infinity;
 for(let i=0;i<960;i++){
  const time=i*dt,u=time<2?time/2:time<5?1:Math.max(0,1-(time-5)/2),ease=u*u*(3-2*u),q=api.qx(theta*ease),p=api.sub([0,0,.14],api.rotate(q,pivot));
  physics.setManipulation(object,{p,q},'carry',{ownerId:'test',maxForceN:154,maxHorizontalForceN:154,maxTorqueNm:torqueLimit,supportPivotLocal:pivot});physics.step(dt,[actor]);
  const state=physics.objectState(object.id);maximumTorqueNm=Math.max(maximumTorqueNm,state.appliedTorqueNm);
  minimumGroundM=Math.min(minimumGroundM,object.p[1]-api.objectWorldHalfExtents(object)[1]);
  if(i===599)peakError=api.qangle(object.q,api.qx(theta));
 }
 assert(maximumTorqueNm<=torqueLimit+1e-9,'feed-forward uses the existing bounded torque budget');
 assert(minimumGroundM>-.003,'the supported edge cannot sink through the floor');
 return{peakError,finalError:api.qangle(object.q,[0,0,0,1]),maximumTorqueNm,minimumGroundM};
}
const normal=run(1.9),weak=run(.05);assert(normal.peakError<.025,'ground reaction no longer causes a permanent tip-angle lag');assert(normal.finalError<.025);assert(weak.peakError>.1,'insufficient strength cannot snap the object to its target');
console.log(JSON.stringify({cases:2,steps:2160,normal,weak,engine:'cannon-es',visualAcceptance:false}));
