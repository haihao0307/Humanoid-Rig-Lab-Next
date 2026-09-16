// Lease state machine regression. Geometry/locomotion targets are mocked;
// real MotionController completion is covered by the crossing/corridor tests.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const context=vm.createContext({structuredClone,console,horizontal:(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2])});
const api=vm.runInContext(math+'\n'+read('body/CrowdIntersectionCoordinator.js')+'\n'+read('body/NaturalLocomotion.js')+`
 trafficIntersectionOwnerAdvanceTarget=()=>null;
 trafficIntersectionOrbitTarget=()=>[2,0,2];
 trafficCorridorDescriptor=()=>({key:'corridor:test',sign:1,direction:[0,0,1],midpoint:[0,0,0],axisIndex:2,lateralIndex:0,lower:-1,upper:1});
 ({NaturalLocomotion,trafficRuntime,trafficTaskKey,trafficPopulationNow,trafficIntersectionNow,trafficIntersectionAssignOwner,trafficIntersectionSyncMembers,trafficMaintainOpenIntersection,trafficPruneIntersections,trafficPruneCorridors,trafficReleaseIntersection});`,context);
function fixture(){
 const population={elapsedS:0,values:()=>actors};
 const actors=['a','b','c'].map((id,i)=>{
  const agent={npcId:id,time:10+i*90,w:{population},index:0,phase:'walk',skill:{type:'walk'},route:[[0,0,5]],routeIndex:0,pos:[i-1,0,-1]};
  const locomotion=Object.assign(Object.create(api.NaturalLocomotion.prototype),{a:agent,engine:{state:{root:agent.pos}},traffic:{intersectionClaims:0,intersectionYields:0,intersectionRotations:0},world:{free:()=>false},normalizeCorridorRoute:()=>true,corridorPassed:()=>false,corridorAdvanceTarget:()=>[0,0,1],corridorOrbitTarget:()=>[2,0,2]});
  agent.locomotion=locomotion;return{id,agent};
 });
 const runtime=api.trafficRuntime(population),lease={key:'intersection:test',center:[0,0,0],direction:1,ownerId:null,rotations:0,nextOrder:3,members:new Map(actors.map((actor,i)=>[actor.id,{taskKey:api.trafficTaskKey(actor.agent),goal:[0,0,5],joinedAtS:0,order:i}]))};
 runtime.intersections.set(lease.key,lease);api.trafficIntersectionAssignOwner(lease,population,0);api.trafficIntersectionSyncMembers(lease,population);
 return{population,actors,runtime,lease};
}
const ctx={radius:.26,ignore:[]};let checks=0;
const check=fn=>{fn();checks++;};
{
 const {population,actors,lease}=fixture();
 for(let i=0;i<1000;i++)for(const actor of actors)api.trafficMaintainOpenIntersection(actor.agent.locomotion,ctx,actor.agent.route[0]);
 check(()=>assert.equal(lease.rotations,0));check(()=>assert.equal(lease.ownerId,'a'));
 population.elapsedS=1.5;
 for(const actor of actors)api.trafficMaintainOpenIntersection(actor.agent.locomotion,ctx,actor.agent.route[0]);
 check(()=>assert.equal(lease.rotations,1));check(()=>assert.equal(lease.ownerId,'b'));
 for(let i=0;i<100;i++)for(const actor of actors)api.trafficMaintainOpenIntersection(actor.agent.locomotion,ctx,actor.agent.route[0]);
 check(()=>assert.equal(lease.rotations,1));
 // Lease expiry rotates once as well; a later actor cannot consume another
 // attempt in the same shared tick, regardless of its private clock.
 population.elapsedS=20;
 for(const actor of actors)api.trafficMaintainOpenIntersection(actor.agent.locomotion,ctx,actor.agent.route[0]);
 check(()=>assert.equal(lease.rotations,2));check(()=>assert.equal(api.trafficIntersectionNow(actors[2].agent),20));
}
for(const invalidate of [a=>a.agent.paused=true,a=>a.agent.error='failed',a=>a.agent.characterEditInProgress=true,a=>a.disposed=true,a=>a.agent.skill=null,a=>a.agent.routeIndex=1,a=>a.agent.index++]){
 const {population,actors,runtime,lease}=fixture();invalidate(actors[0]);api.trafficPruneIntersections(population,runtime,0);
 check(()=>assert(!lease.members.has('a')));check(()=>assert.equal(actors[0].agent.locomotion.traffic.intersectionKey,null));check(()=>assert.equal(lease.ownerId,'b'));
}
{
 const {actors,runtime}=fixture();for(const actor of actors)api.trafficReleaseIntersection(actor.agent.locomotion);
 check(()=>assert.equal(runtime.intersections.size,0));
}
{
 const {population,actors,runtime}=fixture(),owner=actors[0].agent,other=actors[1].agent,loc=owner.locomotion;
 owner.pos=[0,0,-1];loc.engine.state.root=owner.pos;other.pos=[0,0,1];other.route=[[0,0,-5]];
 population.elapsedS=200;
 check(()=>assert.equal(loc.resolveNarrowCorridor({actor:actors[1]},ctx),'owner'));
 const lease=runtime.corridors.get('corridor:test');check(()=>assert.equal(lease.expiresAtS,206));
 other.locomotion.traffic.corridorKey='corridor:test';other.locomotion.traffic.corridorOwner='a';
 population.elapsedS=201;loc.maintainCorridor(ctx,owner.route[0]);other.locomotion.maintainCorridor(ctx,other.route[0]);
 check(()=>assert.equal(runtime.corridors.get('corridor:test'),lease));check(()=>assert.equal(lease.expiresAtS,207));
 // A paused owner releases shared direction ownership, but remains a body
 // obstacle through NPCPopulation's ordinary collision/sweep methods.
 owner.paused=true;api.trafficPruneCorridors(population,runtime,201);
 check(()=>assert.equal(runtime.corridors.size,0));check(()=>assert.equal(loc.traffic.corridorKey,null));check(()=>assert.equal(other.locomotion.traffic.corridorKey,null));
 check(()=>assert.equal(other.locomotion.resolveNarrowCorridor({actor:actors[0]},ctx),null));
 check(()=>assert.equal(api.trafficPopulationNow(population),201));
}
console.log(JSON.stringify({passed:true,checks,sharedClock:true,sameTickRotationBound:true,geometryMocked:true,physicsExecuted:false}));
