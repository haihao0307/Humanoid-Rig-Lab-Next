// Real Cannon steps around the existing per-held-object freeze lifecycle.
// No pose solver, geometry generation or browser is required.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../world/physics/vendor/cannon-es.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const Physics=vm.runInNewContext(math+'\n'+read('world/PhysicsContract.js')+'\n'+read('world/PhysicsWorld.js')+'\nPhysicsWorld',{WorkbenchPhysicsEngine:C,structuredClone});
const dt=1/120;
function fixture(){
 const make=(id,x)=>({id,shape:'box',w:.3,h:.4,d:.3,mass:.5,friction:.2,restitution:0,movable:true,collidable:true,p:[x,4,0],q:[0,0,0,1],v:[.3,.4,-.2],angularVelocity:[.1,-.05,.02]});
 const held=make('held',0),otherHeld=make('other-held',3),free=make('free',-3);
 const world={objects:[held,otherHeld,free],bounds:{xMin:-13,xMax:13,zMin:-9,zMax:9},physicsSettings:{gravityMps2:9.81,groundFriction:.65},revision:0};
 const physics=new Physics(world),human=x=>({byId:new Map([['head',{world:{p:[x,1.5,-4]}}]]),bodyMetrics:{headRadiusM:.1,torsoRadiusM:.15,armRadiusM:.04,legRadiusM:.07}});
 const a={npcId:'one',h:human(0),pos:[0,0,-4],held,preflightWaiting:true},b={npcId:'two',h:human(3),pos:[3,0,-4],held:otherHeld};
 for(const [actor,o]of [[a,held],[b,otherHeld]]){o.held=true;o.heldOwner=actor.npcId;physics.setManipulation(o,{p:[...o.p],q:[...o.q]},'carry',{ownerId:actor.npcId,maxForceN:20,maxHorizontalForceN:20,maxTorqueNm:2});}
 return{physics,world,held,otherHeld,free,a,b};
}
const array=v=>[v.x,v.y,v.z],same=(a,b,message)=>assert.deepEqual(Array.from(a),Array.from(b),message);
let cases=0,steps=0;
{
 const {physics,held,otherHeld,free,a,b}=fixture(),p=[...held.p],q=[...held.q],v=[...held.v],w=[...held.angularVelocity];
 for(let i=0;i<30;i++){physics.step(dt,[a,b]);steps++;same(held.p,p);same(held.q,q);assert.equal(physics.objectState(held.id).supported,false);assert.equal(physics.objectState(held.id).settled,false);assert.equal(physics.objectState(held.id).appliedForceN,0);}
 assert.equal(physics.stepCount,30,'waiting owner cannot stop the shared world');
 assert(free.p[1]<3.9,'free object continues under gravity');assert(otherHeld.p[0]>3,'other held object remains dynamic');
 assert.equal(physics.frozen.size,1);assert.equal(physics.bodies.get(otherHeld.id).body.type,C.Body.DYNAMIC);
 a.preflightWaiting=false;physics.syncFrozen([a,b]);
 const body=physics.bodies.get(held.id).body;assert.equal(body.type,C.Body.DYNAMIC);assert.equal(body.mass,.5);same(array(body.velocity),v);same(array(body.angularVelocity),w);assert.equal(physics.states.has(held.id),false,'thaw invalidates cached support');
 physics.clearManipulation(held.id);a.held=null;physics.step(dt,[a,b]);steps++;assert(held.p[0]>p[0],'restored velocity resumes on the next real step');cases++;
}
{
 const {physics,free,a,b}=fixture();a.held=null;b.held=null;b.preflightWaiting=true;
 for(let i=0;i<20;i++){physics.step(dt,[a,b]);steps++;}
 assert.equal(physics.frozen.size,0,'waiting without a held object freezes nothing');assert(physics.stepCount===20&&free.p[1]<4);cases++;
}
for(const reason of ['paused','error','characterEditInProgress']){
 const {physics,held,a,b}=fixture(),v=[...held.v],w=[...held.angularVelocity];physics.step(dt,[a,b]);steps++;
 a.preflightWaiting=false;a[reason]=reason==='error'?'controlled failure':true;
 for(let i=0;i<3;i++){physics.step(dt,[a,b]);steps++;assert(physics.frozen.has(held.id));}
 a[reason]=false;physics.syncFrozen([a,b]);assert(!physics.frozen.has(held.id));
 const body=physics.bodies.get(held.id).body;same(array(body.velocity),v,'reason changes must retain the original velocity');same(array(body.angularVelocity),w);cases++;
}
{
 const {physics,held,a,b}=fixture(),v=[...held.v];physics.step(dt,[a,b]);steps++;
 // Destroying the owner removes it from the supplied live population.
 physics.syncFrozen([b]);same(array(physics.bodies.get(held.id).body.velocity),v);assert(!physics.frozen.has(held.id));
 physics.step(dt,[b]);steps++;assert(!physics.manipulations.has(held.id));assert.equal(physics.bodies.get(held.id).body.type,C.Body.DYNAMIC);assert(held.p[0]>0);cases++;
}
{
 const {physics,world,held,a,b}=fixture();physics.step(dt,[a,b]);steps++;
 const oldBody=physics.bodies.get(held.id).body;world.objects=world.objects.filter(o=>o!==held);physics.syncScene();
 assert(!physics.frozen.has(held.id));assert(!physics.bodies.has(held.id));assert(!physics.engine.bodies.includes(oldBody));
 const replacement={...held,p:[0,5,0],v:[-.2,0,0],angularVelocity:[0,0,0]};world.objects.push(replacement);a.held=null;a.preflightWaiting=false;physics.syncScene();physics.syncFrozen([a,b]);
 same(array(physics.bodies.get(held.id).body.velocity),replacement.v,'reused ID must not restore destroyed body velocity');cases++;
}
{
 const {physics,held,a,b}=fixture();physics.clearManipulation(held.id);a.held=null;a.preflightWaiting=false;
 held.p=[0,.2,0];held.v=[0,0,0];held.angularVelocity=[0,0,0];held.held=false;held.heldOwner=null;
 for(let i=0;i<180;i++){physics.step(dt,[a,b]);steps++;}
 assert(physics.objectState(held.id).supported&&physics.objectState(held.id).settled);
 a.held=held;a.preflightWaiting=true;physics.step(dt,[a,b]);steps++;
 assert.equal(physics.objectState(held.id).supported,false);assert.equal(physics.objectState(held.id).settled,false,'frozen rest cannot count as completion');
 a.preflightWaiting=false;physics.syncFrozen([a,b]);assert.equal(physics.objectState(held.id).supported,false,'support stays unverified immediately after thaw');
 physics.step(dt,[a,b]);steps++;assert(physics.objectState(held.id).supported,'a fresh physical contact can restore support evidence');cases++;
}
console.log(JSON.stringify({cases,steps,engine:'cannon-es',onlyHeldObjectFrozen:true,velocitiesRestored:true,otherActorsAndObjectsContinue:true,invalidatesSupportEvidence:true,ownerAndObjectDestructionCovered:true,vendorModified:false,browserExecuted:false}));
