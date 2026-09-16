// Physical regressions for the pinned Cannon solver through PhysicsWorld.
// These test impulses and Coulomb behaviour, not a restatement of adapter code.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../world/physics/vendor/cannon-es.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const Physics=vm.runInNewContext(read('world/PhysicsContract.js')+'\n'+read('world/PhysicsWorld.js')+'\nPhysicsWorld',{WorkbenchPhysicsEngine:C});
const mu=.08*.65,g=9.81,mass=.5;
function fixture({position=[0,0],yaw=0,tilt=0}={}){
 const q=new C.Quaternion().setFromEuler(tilt,yaw,0,'YXZ');
 const object={id:'box',shape:'box',w:.3,h:.6,d:.3,mass,friction:.08,restitution:0,movable:true,collidable:true,
  p:[position[0],.3,position[1]],q:[q.x,q.y,q.z,q.w],v:[0,0,0],angularVelocity:[0,0,0]};
 const world={objects:[object],bounds:{xMin:-13,xMax:13,zMin:-9,zMax:9},physicsSettings:{gravityMps2:g,groundFriction:.65},revision:0};
 const physics=new Physics(world),body=physics.bodies.get('box').body;body.linearDamping=0;body.angularDamping=0;body.allowSleep=false;
 for(let i=0;i<120;i++)physics.step(1/120,[]);
 if(tilt){body.quaternion.copy(q);const ext=new C.Vec3(.15,.3,.15),matrix=new C.Mat3();matrix.setRotationFromQuaternion(q);const e=matrix.elements;body.position.y=Math.abs(e[3])*ext.x+Math.abs(e[4])*ext.y+Math.abs(e[5])*ext.z;body.velocity.setZero();body.angularVelocity.setZero();body.aabbNeedsUpdate=true;}
 return{physics,body,object};
}
let maxSlidingError=0,maxForceError=0,maxStaticSpeed=0,maxSpinResidual=0,cases=0;
for(const position of [[0,0],[-2,4],[7,-5]])for(const yaw of [0,.71])for(const dt of [1/60,1/120,1/240,1/960])for(const direction of [0,Math.PI/6,Math.PI/4,Math.PI/2]){
 const{physics:p,body:b}=fixture({position,yaw}),speed=.4;
 b.velocity.set(speed*Math.cos(direction),0,speed*Math.sin(direction));p.engine.step(dt);
 const actual=Math.hypot(b.velocity.x,b.velocity.z),expected=speed-mu*g*dt;
 maxSlidingError=Math.max(maxSlidingError,Math.abs(actual-expected));assert(Math.abs(actual-expected)<1e-8,'Sliding deceleration must be mu*g*dt independent of coordinates, heading and solver microstep');
 cases++;
}
for(const dt of [1/120,1/240,1/960])for(const direction of [0,Math.PI/4,1.1])for(const ratio of [.5,2]){
 const{physics:p,body:b}=fixture({position:[-2,4],yaw:.61}),force=mass*mu*g*ratio;
 for(let i=0;i<Math.round(.25/dt);i++){b.applyForce(new C.Vec3(force*Math.cos(direction),0,force*Math.sin(direction)));p.engine.step(dt);}
 const actual=Math.hypot(b.velocity.x,b.velocity.z),expected=Math.max(0,force/mass-mu*g)*.25;
 if(ratio<1){maxStaticSpeed=Math.max(maxStaticSpeed,actual);assert(actual<1e-4,'Force below the friction threshold must remain supported without sliding');}
 else {maxForceError=Math.max(maxForceError,Math.abs(actual-expected));assert(Math.abs(actual-expected)<.004,'Constant force above friction must produce F/m-mu*g acceleration');}
 cases++;
}
for(const tilt of [-.2,.2])for(const yaw of [0,.6]){
 const{physics:p,body:b}=fixture({position:[-2,4],tilt,yaw});b.velocity.set(.4,0,0);p.engine.step(1/120);
 const equations=p.engine.frictionEquations;assert(equations.length>=2,'Tilted box must generate friction contacts');
 const total=equations.reduce((sum,e,i)=>i%2?sum:sum+Math.hypot(e.maxForce,equations[i+1].maxForce),0);
 assert(Math.abs(total-mass*mu*g/120)<1e-10,'One contact plane shares one normal-load budget regardless of corner count');
 assert(b.velocity.x<=.4+1e-8&&b.velocity.x>=.4-mu*g/120-1e-8,'Edge contacts cannot over-brake the centre of mass');cases++;
}
for(const position of [[0,0],[-2,4],[7,-5]]){
 const{physics:p,body:b}=fixture({position,yaw:.37});b.angularVelocity.y=1.5;
 for(let i=0;i<120;i++)p.engine.step(1/120);
 maxSpinResidual=Math.max(maxSpinResidual,Math.abs(b.angularVelocity.y));assert(Math.abs(b.angularVelocity.y)<.02,'Distributed contact friction must stop yaw spin without air damping');
 assert(Math.hypot(b.position.x-position[0],b.position.z-position[1])<1e-4,'A spinning box must not drift because contact anchors use world coordinates');cases++;
}
console.log(JSON.stringify({cases,maxSlidingError,maxForceError,maxStaticSpeed,maxSpinResidual,frictionLoadModel:'upstream mu*gravity*reduced-mass approximation; shared per body-pair plane',vendorModified:false}));

