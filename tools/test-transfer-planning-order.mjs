// Planning control-flow regression: impossible routes must not trigger dense
// skeletal certification; feasible routes still require pickup AND placement.
// Exact production kinematics are tested by test-contact-body-clearance.mjs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const counts={configuration:0,pickup:0,placement:0,approach:0,loaded:0};
let mode='clear',rejectPlacementAt=null;
const config={forwardM:.44,heightM:.86,poleLateralM:.6};
const profile={bodyRadiusM:.26,carryClearanceM:.43,pushClearanceM:.34,nominalWalkMps:.48,nominalCarryMps:.43,nominalPushMps:.22};
const sandbox={
 PHYSICAL_REASONING_PROFILE:profile,
 motionBoxApproachOffsets:()=>[0,Math.PI/2,-Math.PI/2,Math.PI],
 motionBoxHandlingGeometry:o=>({supportGrips:sandbox.graspFrames(),tilted:{q:o.q}}),
 motionPlanBoxHandlingSteps:function*(h,o,position,yaw,world,configuration,pose={p:o.p,q:o.q}){yield {stage:'box-contact'};const contact=sandbox.motionChooseContact(h,position,yaw,null,world,[o.id],{objectPose:pose});return{supportContact:contact};},
 horizontal:(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),
 motionApproachDistance:()=>.46,
 motionChooseCarryConfiguration:()=>{counts.configuration++;return config;},
 motionChooseContact:(_h,position,_yaw,_hands,_world,_ignore,options)=>{
  const atPickup=options.objectPose.p[2]<1;
  counts[atPickup?'pickup':'placement']++;
  if(mode==='bad-grasp'&&atPickup)throw Error('unreachable fixed-bone grip');
  if(!atPickup&&rejectPlacementAt===options.objectPose.p[2])throw Error('blocked placement posture');
  return {carryConfiguration:config};
 },
 rayBoundary:()=>.15,
 objectRadius:o=>o.r,
 objectProjectedRadius:o=>o.r,
 graspFrames:()=>({left:{p:[-.15,.3,0],q:[0,0,0,1]},right:{p:[.15,.3,0],q:[0,0,0,1]}}),
 pointToObjectClearance:()=>10,
 strengthTaskRequest:(type,_o,args)=>({type,...args}),strengthWorldParameters:()=>({}),strengthReason:()=> 'insufficient sustained strength'
};
Object.assign(sandbox,{
 motionDrainPreflight:iterator=>{while(true){const step=iterator.next();if(step.done)return step.value;}},
 motionChooseCarryConfigurationSteps:function*(...args){yield {stage:'configuration'};return sandbox.motionChooseCarryConfiguration(...args);},
 motionChooseContactSteps:function*(...args){yield {stage:'contact'};return sandbox.motionChooseContact(...args);}
});
const api=vm.runInNewContext(math+'\n'+read('world/GridNavigation.js')+'\n'+read('control/PlanForecast.js')+'\n({planObjectTransfer,planObjectTransferSteps,active:w=>navigationBatches.has(w),register:(a,h)=>reasoningHumans.set(a,h)})',sandbox);
const object={id:'box',shape:'box',p:[0,.3,0],q:[0,0,0,1],w:.3,h:.6,d:.3,r:.2122,mass:.5,collidable:true};
const target={id:'Z1',p:[0,0,3],shape:'square',r:.7};
const actor={pos:[0,0,-1],yaw:0};api.register(actor,{});
const makeWorld=()=>({objects:[object],bounds:{xMin:-20,xMax:20,zMin:-20,zMax:20},physics:{bodyObjectClearance:true},
 collision:(p,r)=>mode==='endpoint-blocked'&&p[2]>1&&r>=profile.carryClearanceM,
 inside:()=>true,
 path:(start,end,r)=>{
  counts[r===profile.bodyRadiusM?'approach':'loaded']++;
  if(r!==profile.bodyRadiusM){assert(r>=profile.carryClearanceM);if(mode==='route-blocked')throw Error('no loaded route');}
  return [[...end]];
 }
});
const capacity={movementFactor:()=>1,assess:()=>({feasible:mode!=='weak'})};
const reset=next=>{mode=next;rejectPlacementAt=null;for(const k of Object.keys(counts))counts[k]=0;};
const run=(world=makeWorld(),type='carry')=>api.planObjectTransfer(world,actor,{type},object,target,profile,capacity);
const results=[];
for(const scenario of ['endpoint-blocked','route-blocked','weak','bad-grasp']){
 reset(scenario);const world=makeWorld(),before=JSON.stringify({actor,object,target});
 assert.throws(()=>run(world),new RegExp({'endpoint-blocked':'站位被占用','route-blocked':'no loaded route',weak:'insufficient sustained strength','bad-grasp':'unreachable fixed-bone grip'}[scenario]));
 assert.equal(JSON.stringify({actor,object,target}),before,'rejection must leave live inputs unchanged');
 if(scenario==='endpoint-blocked'){assert.equal(counts.configuration,0);assert.equal(counts.pickup,0);}
 if(scenario==='route-blocked'||scenario==='weak')assert.equal(counts.pickup+counts.placement,0,'route/strength rejection should not construct dense contact poses');
 if(scenario==='bad-grasp')assert.equal(counts.pickup,24,'each distinct approach may fail once, not once per landing');
 assert.equal(counts.placement,0);assert(counts.approach<=48,'one call shares its repeated approach paths');
 results.push({scenario,...counts});
}
reset('clear');const accepted=run();assert.equal(counts.pickup,1);assert.equal(counts.placement,1);
assert.equal(accepted.destination[2],3);assert.equal(accepted.carryConfiguration,config);assert.equal(accepted.rejectedCandidates,0);
results.push({scenario:'feasible',...counts});
reset('clear');rejectPlacementAt=3;const alternate=run();assert.notEqual(alternate.destination[2],3,'a failed placement cannot be accepted with pickup alone');
assert.equal(counts.pickup,24);assert.equal(counts.placement,25);assert.equal(alternate.rejectedCandidates,24);
results.push({scenario:'alternate-landing',...counts});
reset('clear');const sameWorld=makeWorld();run(sameWorld);mode='route-blocked';assert.throws(()=>run(sameWorld),'world changes between analyses must invalidate all local route results');
assert.equal(counts.pickup,1);assert.equal(counts.placement,1);
results.push({scenario:'world-change',...counts});
reset('clear');const pushed=run(makeWorld(),'push');assert.equal(counts.pickup,1);assert.equal(counts.placement,0);assert.equal(counts.configuration,0);assert.equal(pushed.destination[2],3);
results.push({scenario:'push',...counts});
reset('clear');const steppedWorld=makeWorld(),expected=JSON.stringify(run(steppedWorld));reset('clear');
const pending=api.planObjectTransferSteps(steppedWorld,actor,{type:'carry'},object,target,profile,capacity);let chunks=0,actual;
while(true){const step=pending.next();assert.equal(api.active(steppedWorld),false,'suspended analysis must not expose navigation cache to another task');if(step.done){actual=step.value;break;}chunks++;}
assert.equal(JSON.stringify(actual),expected);assert(chunks>=4,'candidate, configuration, pickup and placement are cooperative');
results.push({scenario:'stepped-equivalence',chunks});
reset('clear');const changed=makeWorld(),stale=api.planObjectTransferSteps(changed,actor,{type:'carry'},object,target,profile,capacity);
assert.equal(stale.next().done,false);const previous=[...object.p];object.p[0]+=.1;
assert.throws(()=>stale.next(),e=>e.code==='PREFLIGHT_WORLD_CHANGED');object.p=previous;
assert.equal(api.active(changed),false);assert.equal(counts.pickup+counts.placement,0,'changed scene must not reach stale dense certification');
results.push({scenario:'suspended-world-change-rejected'});
reset('clear');const cancelled=makeWorld(),cancel=api.planObjectTransferSteps(cancelled,actor,{type:'carry'},object,target,profile,capacity);
cancel.next();cancel.return();assert.equal(cancel.next().done,true);assert.equal(api.active(cancelled),false);assert.equal(counts.pickup+counts.placement,0);
results.push({scenario:'suspended-cancellation'});
console.log(JSON.stringify({cases:results.length,source:'production planObjectTransfer; isolated geometric/strength fixtures',results},null,2));
