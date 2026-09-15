// Whole-plan control-flow equivalence and cancellation. Geometric solvers are
// isolated here; their full-body equivalence is tested independently.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const drain=iterator=>{while(true){const step=iterator.next();if(step.done)return step.value;}};
class Capacity{
 constructor(state){this.state={...state};}static fromSnapshot(state){return new Capacity(state);}
 advance(dt){this.state.energy-=dt*.01;}recover(dt){this.state.energy+=dt*.02;}project(_assessment,dt){this.state.energy-=dt*.1;}
 activityAssessment(){return {};}
 export(){return {...this.state};}
}
const profile={nominalWalkMps:.5};
const physical=function*(world,actor,step){
 yield {stage:'contact-sample'};
 const pos=[...actor.pos];if(step.type==='walk')pos[0]+=step.distanceM;
 const updates=step.type==='carry'?[{id:step.objectId,p:[...world.get(step.targetId).p],q:[0,0,0,1]}]:[];
 return {feasible:!step.fail,reasons:step.fail?['fixture refusal']:[],estimates:{predictedDurationS:step.duration??2,routeLengthM:step.distanceM||0,effortScore:step.type==='carry'?2:0,minClearanceM:.1},strength:step.type==='carry'?{feasible:true}:null,predictedEffects:{bodyPosition:pos,bodyYaw:actor.yaw+(step.type==='turn'?.2:0),posture:actor.posture,heldObject:null,objectUpdates:updates}};
};
const context=vm.createContext({structuredClone,PHYSICAL_REASONING_PROFILE:profile,StrengthModel:Capacity,motionDrainPreflight:drain,physical,profile});
vm.runInContext(read('control/PlanForecast.js')+`
bodyPhysicalProfile=()=>profile;
actorForReasoning=(agent,override={})=>({...structuredClone(agent.actor),...override});
physicalAnalyzeStep=(...args)=>motionDrainPreflight(physical(...args));
physicalAnalyzeStepSteps=(...args)=>physical(...args);
globalThis.api={sync:simulateSemanticPlan,steps:simulateSemanticPlanSteps};`,context);
const api=context.api;
const world={sceneId:'fixture',revision:0,bounds:{xMin:-10,xMax:10,zMin:-10,zMax:10},objects:[{id:'box',p:[0,.3,0],q:[0,0,0,1],movable:true}],zones:[{id:'Z1',p:[2,.3,3],shape:'square',r:1}],get(id){return [...this.objects,...this.zones].find(o=>o.id===id);},snapshot(){return {sceneId:this.sceneId,revision:this.revision,objects:structuredClone(this.objects),zones:structuredClone(this.zones)};}};
const actor={pos:[0,0,0],yaw:0,posture:'standing',heldObject:null,strength:{energy:10},geometryKey:'fixture'},agent={actor,h:{bodyMetrics:{geometryKey:'fixture'}}};
const action=(id,step)=>({id,kind:'action',step});
const plans=[
 {steps:[{type:'walk',distanceM:1},{type:'carry',objectId:'box',targetId:'Z1'},{type:'wait',duration:3}]},
 {nodes:[{id:'if-present',kind:'condition',predicate:{type:'exists',ids:['box']},then:[action('take',{type:'carry',objectId:'box',targetId:'Z1'})],else:[action('reject',{type:'walk',fail:true})]},action('turn',{type:'turn'})]},
 {nodes:[{id:'if-absent',kind:'condition',predicate:{type:'exists',ids:['missing']},then:[action('reject',{type:'walk',fail:true})],else:[action('wait',{type:'wait',duration:4})]}]},
 {steps:[{type:'walk',distanceM:2},{type:'carry',objectId:'box',targetId:'Z1',fail:true},{type:'walk',distanceM:99}]},
 {steps:[]},
 {steps:[{type:'wait',duration:7201}]}
];
const before=JSON.stringify({world:world.snapshot(),actor});let chunks=0;
for(const [index,plan] of plans.entries()){
 const expected=api.sync(world,agent,plan),iterator=api.steps(world,agent,plan);let actual;
 while(true){const step=iterator.next();assert.equal(JSON.stringify({world:world.snapshot(),actor}),before,'forecast must leave the live world and capacity unchanged');if(step.done){actual=step.value;break;}chunks++;}
 assert.equal(JSON.stringify(actual),JSON.stringify(expected),`plan ${index}: stepped forecast preserves all effects, branches and refusal details`);
}
const successful=api.sync(world,agent,plans[0]);assert(successful.feasible,JSON.stringify(successful.reasons));assert.equal(successful.predictedActor.pos[0],1);assert.equal(successful.predictedWorld.objects[0].p[2],3);assert(Math.abs(successful.predictedStrength.energy-9.84)<1e-12);
const failed=api.sync(world,agent,plans[3]);assert.equal(failed.failedStep.stepNumber,2);assert.equal(failed.analyses.length,2);assert.equal(failed.predictedActor.pos[0],2);
const selected=api.sync(world,agent,plans[1]);assert.equal(selected.branches[0].value,true);assert.equal(JSON.stringify(selected.selectedNodeIds),JSON.stringify(['take','turn']));
const cancelled=api.steps(world,agent,plans[0]);cancelled.next();cancelled.next();cancelled.return();assert.equal(cancelled.next().done,true);assert.equal(JSON.stringify({world:world.snapshot(),actor}),before);
// A not-yet-committed submission is busy even without an Agent plan/skill.
const activity=vm.runInNewContext(read('control/CharacterActivity.js')+';characterActivity');
const pending={preflightWaiting:true,basic:{posture:'standing'},locomotion:{isSettled:()=>true,engine:{state:{}}},time:0};
assert.equal(activity(pending).readyForTask,false);assert.equal(activity(pending).canEdit,false);assert.equal(activity(pending).phase,'checking');pending.preflightWaiting=false;assert.equal(activity(pending).readyForTask,true);
console.log(JSON.stringify({plans:plans.length,chunks,wholePlanEquivalence:true,branchesAndFailurePosition:true,liveInputsUnchanged:true,cancellation:true,pendingSubmissionBusy:true,geometrySolversIsolated:true}));
