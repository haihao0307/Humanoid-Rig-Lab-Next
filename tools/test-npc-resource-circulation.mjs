import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../control/NPCPopulation.js',import.meta.url),'utf8');
assert(!source.includes("resourceWait"),'resource parking state must not return');
const plans={
 sameObject:{steps:[{type:'carry',objectId:'A',targetId:'ZA'}]},
 sameStation:{steps:[{type:'carry',objectId:'B',targetId:'ZA'}]},
 otherObject:{steps:[{type:'carry',objectId:'B',targetId:'ZB'}]},
 walk:{steps:[{type:'walk',targetId:'ZC'}]}
};
const sandbox={
 console,structuredClone,Map,Set,WeakMap,Array,Object,String,Number,Math,JSON,Error,
 parse:text=>structuredClone(plans[text]||plans.walk),
 npcCopy:value=>structuredClone(value),
 horizontal:(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),
 globalThis:null
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source+'\n;globalThis.__resourceApi={NPCPopulation,npcResourceDirectionOrder};',sandbox,{filename:'NPCPopulation.js'});
const {NPCPopulation,npcResourceDirectionOrder}=sandbox.__resourceApi;
assert.equal(new Set(npcResourceDirectionOrder('npc-b',3)).size,4,'diversion order must cover four directions');

const objects=[{id:'A',held:true,heldOwner:'npc-a'},{id:'B',held:false,heldOwner:null}];
const zones=[{id:'ZA',p:[0,0,0]},{id:'ZB',p:[2,0,0]},{id:'ZC',p:[-2,0,0]}];
const population=Object.create(NPCPopulation.prototype);
Object.assign(population,{
 lab:{world:{objects,zones,get(id){return [...objects,...zones].find(item=>item.id===id)||null;},physics:{clearManipulation(){}}}},
 claims:new Map([['A','npc-a']]),stationClaims:new Map([['ZA','npc-a']]),physicsOwner:'npc-a',actors:new Map(),
 observation:{events:[],event(type,actor,detail){this.events.push({type,id:actor.id,detail});}}
});
function makeActor(id,pos=[0,0,-1]){
 const agent={
  npcId:id,lastObject:null,pos:[...pos],yaw:0,held:null,submitted:[],logs:[],
  submitPlan(plan){this.submitted.push(structuredClone(plan));return plan;},
  log(message){this.logs.push(message);}
 };
 return{id,label:id,agent,queue:[],running:null,behavior:{status:'scheduled'},resource:{mode:'clear',requestKey:null,attempts:0,diversions:0,conflict:null,anchor:null}};
}
const actor=makeActor('npc-b');
population.actors.set(actor.id,actor);
const objectConflict=population.resourceConflict(actor.agent,{text:'sameObject',source:'manual'});
assert.equal(objectConflict.kind,'object');
assert.equal(objectConflict.id,'A');
const stationConflict=population.resourceConflict(actor.agent,{text:'sameStation',source:'manual'});
assert.equal(stationConflict.kind,'station');
assert.equal(stationConflict.id,'ZA');
const globalConflict=population.resourceConflict(actor.agent,{text:'otherObject',source:'manual'});
assert.equal(globalConflict.kind,'manipulation');

const original={text:'sameObject',source:'manual'};
population.startResourceCirculation(actor,original,objectConflict);
assert.equal(actor.running.source,'resource-circulation');
assert.equal(actor.resource.mode,'circulating');
assert.equal(actor.queue[0],original,'original task remains first in the personal queue');
assert.equal(actor.agent.submitted.length,1,'one real movement plan must be submitted');
assert.equal(actor.agent.submitted[0].steps[0].type,'walk');
assert(!Object.hasOwn(actor.resource,'waitS'),'resource state must not contain a parking timer');
assert(population.observation.events.some(event=>event.type==='resource-circulation'));

// TaskAgent.finish() releases ordinary claims before the population pump sees
// the completed diversion. The active diversion identity must preserve the
// retry counter or a permanently occupied resource would circulate forever.
population.releaseObjects(actor.agent);
assert.equal(actor.resource.attempts,1,'movement completion must preserve the bounded retry counter');
const retry=actor.queue.shift();
actor.running=null;
population.releaseObjects(actor.agent,{preserveResource:true});
population.startResourceCirculation(actor,retry,objectConflict);
assert.equal(actor.resource.attempts,2,'the next diversion must advance the same request counter');
assert.equal(actor.agent.submitted.length,2);

objects[0].held=false;objects[0].heldOwner=null;
population.releaseObjects({npcId:'npc-a',held:null});
assert.equal(population.physicsOwner,null);
assert.equal(population.claims.size,0);
assert.equal(population.stationClaims.size,0);
assert.equal(population.resourceConflict(actor.agent,{text:'sameObject',source:'manual'}),null);

console.log(JSON.stringify({passed:true,parkingWait:false,objectConflict:true,stationConflict:true,activeDiversion:true,boundedRetries:actor.resource.attempts,globalManipulationSerialized:true,diversion:actor.agent.submitted[0].steps[0]}));
