// Real population/Agent lifecycle and Cannon steps; a synthetic held contact.
// Complete grasp/transport/placement is tested separately in the browser.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../world/physics/vendor/cannon-es.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const api=vm.runInNewContext(math+'\n'+['world/PhysicsContract.js','world/PhysicsWorld.js','control/TaskAgent.js','control/NPCPopulation.js'].map(read).join('\n')+'\n({Agent,NPCPopulation,PhysicsWorld,npcIdleBehavior})',{
 WorkbenchPhysicsEngine:C,structuredClone,parse:()=>({steps:[{type:'wave'}]})
});
const object=(id,x)=>({id,shape:'box',w:.3,h:.4,d:.3,mass:.5,friction:.2,restitution:0,movable:true,collidable:true,p:[x,4,0],q:[0,0,0,1],v:[.3,.4,-.2],angularVelocity:[.1,-.05,.02]});
const held=object('BOX',0),free=object('FREE',-3),world={objects:[held,free],bounds:{xMin:-13,xMax:13,zMin:-9,zMax:9},physicsSettings:{gravityMps2:9.81,groundFriction:.65},revision:0,get:id=>world.objects.find(o=>o.id===id)};
world.physics=new api.PhysicsWorld(world);
const pop=Object.assign(Object.create(api.NPCPopulation.prototype),{lab:{world,setAuto(){}},actors:new Map(),claims:new Map(),stationClaims:new Map(),physicsOwner:null,isReserved:()=>false,changed(){}});world.population=pop;
const a=Object.assign(Object.create(api.Agent.prototype),{w:world,npcId:'owner',h:{byId:new Map([['head',{world:{p:[0,1.5,-4]}}]]),bodyMetrics:{headRadiusM:.1,torsoRadiusM:.15,armRadiusM:.04,legRadiusM:.07}},pos:[0,0,-4],held,skill:{type:'carry',objectId:'BOX',targetId:'Z1'},plan:{steps:[{type:'carry'},{type:'wave'}]},index:0,paused:false,error:null,log(){},locomotion:{releaseIntersection(){}},activity(){return{physicalBusy:true,readyForTask:false};}});
const actor={id:'owner',agent:a,queue:[],running:{text:'carry',source:'manual'},behavior:api.npcIdleBehavior()};pop.actors.set(actor.id,actor);
held.held=true;held.heldOwner=a.npcId;pop.claimObject(a,held.id,'Z1');world.physics.setManipulation(held,{p:[...held.p],q:[...held.q]},'carry',{ownerId:a.npcId,maxForceN:20,maxHorizontalForceN:20,maxTorqueNm:2});
const before={p:[...held.p],q:[...held.q],v:[...held.v]},owners=()=>{assert.equal(pop.claims.get(held.id),a.npcId);assert.equal(pop.stationClaims.get('Z1'),a.npcId);assert.equal(pop.physicsOwner,a.npcId);assert.equal(held.heldOwner,a.npcId);};
let checks=0;
const peer={npcId:'peer',h:a.h,pos:[3,0,-4],paused:false};
const step=()=>world.physics.step(1/120,[a,peer]);
pop.control('pause',[a.npcId]);
assert.equal(pop.dispatch('挥手',{targets:[a.npcId],mode:'append'})[0].accepted,true);
assert.equal(a.paused,true,'queue edits must preserve held pause');assert.equal(actor.queue.length,1);
for(let i=0;i<120;i++)step();owners();
assert.deepEqual(Array.from(held.p),before.p);assert.deepEqual(Array.from(held.q),before.q);assert(free.p[1]<1,'unowned free body still falls');assert.equal(world.physics.stepCount,120);checks++;
const queued=actor.queue,skill=a.skill,plan=a.plan;
assert.equal(pop.dispatch('挥手',{targets:[a.npcId],mode:'replace'})[0].accepted,false);assert.equal(actor.queue,queued);assert.equal(a.skill,skill);assert.equal(a.plan,plan);owners();checks++;
const stop=pop.control('stop',[a.npcId])[0];assert(stop.accepted&&stop.requiresRelease&&stop.paused&&!stop.stopped);assert.equal(a.held,held);assert.equal(a.skill,skill);assert.equal(a.plan.steps.length,1);assert.equal(actor.queue.length,0);owners();
for(let i=0;i<120;i++)step();assert.deepEqual(Array.from(held.p),before.p);assert(world.physics.manipulations.has(held.id));checks++;
assert.equal(pop.control('resume',[a.npcId])[0].accepted,true);world.physics.syncFrozen([a]);owners();
const body=world.physics.bodies.get(held.id).body;assert.equal(body.type,C.Body.DYNAMIC);assert.deepEqual([body.velocity.x,body.velocity.y,body.velocity.z],before.v);checks++;
// Model the task executor's verified-release notification, not a real placement.
a.held=null;held.held=false;held.heldOwner=null;pop.releaseObjects(a);
assert.equal(pop.claims.size,0);assert.equal(pop.stationClaims.size,0);assert.equal(pop.physicsOwner,null);assert(!world.physics.manipulations.has(held.id));checks++;
console.log(JSON.stringify({checks,realCannonSteps:240,realPopulationAndCancel:true,syntheticHeldContact:true,fullCarryVerified:false}));
