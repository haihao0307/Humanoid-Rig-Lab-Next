import assert from 'node:assert/strict';
import {LifeRoutineRunner,RESIDENT_ROUTINE_R01,validateObservation} from './routine-engine.mjs';
const goodMetrics={footSlipM:.002,contactErrorM:.004,jointLimitViolationDeg:0,maxPenetrationM:0,maxPoseDeltaMps:.4,maxPoseAccelerationMps2:1.2};
class FakeAdapter{
 constructor({failFirstObservation=false}={}){this.active=null;this.holdingObject=null;this.started=0;this.completed=0;this.restoreCount=0;this.failFirstObservation=failFirstObservation;this.observations=0;this.forceRunning=false;}
 checkpoint(){return{holdingObject:this.holdingObject,active:this.active};}
 startTask(task){this.active=task;this.started++;}
 stepTask(){if(this.forceRunning)return{status:'running',progress:0};this.completed++;if(this.active?.id==='grasp-crate')this.holdingObject='crate-01';if(this.active?.id==='grasp-book')this.holdingObject='book-01';if(this.active?.id==='release-crate'||this.active?.id==='release-book')this.holdingObject=null;return{status:'succeeded',progress:1};}
 observe(){this.observations++;const failed=this.failFirstObservation&&this.observations===1;return{holdingObject:this.holdingObject,contactStable:!failed,gripOwnership:true,noPenetration:true,jointLimits:true,supportStable:true,selfCollisionFree:true,environmentCollisionFree:true,objectSupported:true,objectSettled:true,leftFootContact:true,rightFootContact:true,metrics:{...goodMetrics}};}
 restore(checkpoint){this.holdingObject=checkpoint.holdingObject;this.active=checkpoint.active;this.restoreCount++;}
 recover(){return true;}
 hasFacts(){return false;}
}
assert(RESIDENT_ROUTINE_R01.length>=50,'routine must be materially longer than a single action demo');
assert(RESIDENT_ROUTINE_R01.some(t=>t.skill==='climb-stairs')&&RESIDENT_ROUTINE_R01.some(t=>t.skill==='operate-door')&&RESIDENT_ROUTINE_R01.some(t=>t.skill==='operate-window'));
const adapter=new FakeAdapter(),runner=new LifeRoutineRunner(adapter);runner.start({repeatCount:2});let ticks=0;
while(runner.state==='running'&&ticks<5000){runner.tick(1/60);ticks++;}
assert.equal(runner.state,'completed');assert.equal(runner.cycle,2);assert.equal(runner.snapshot().journal.filter(e=>e.type==='task-verified').length,RESIDENT_ROUTINE_R01.length*2);assert.equal(adapter.holdingObject,null);assert.equal(adapter.started,RESIDENT_ROUTINE_R01.length*2);
const one=[{id:'test-contact',skill:'reach',target:'test-object',requires:['standing'],produces:['contact-ok'],gates:['contactStable','noPenetration']}];
const retryAdapter=new FakeAdapter({failFirstObservation:true}),retryRunner=new LifeRoutineRunner(retryAdapter,{routine:one,maxRetriesPerTask:1});retryRunner.start();
let guard=0;const firstRetry=retryRunner.tick(1/60);assert.equal(firstRetry.retryScheduled,true,'one bounded retry should be scheduled after recoverable failure');
while(retryRunner.state==='running'&&guard++<40)retryRunner.tick(1/60);
assert.equal(retryRunner.state,'completed');assert.equal(retryAdapter.restoreCount,1);assert.equal(retryRunner.snapshot().journal.filter(e=>e.type==='task-verified').length,1);assert.equal(retryRunner.snapshot().journal.filter(e=>e.type==='task-failed').length,1);
const bad=validateObservation({gates:['contactStable']},{contactStable:true,noPenetration:true,jointLimits:true,supportStable:true,selfCollisionFree:true,environmentCollisionFree:true,metrics:{...goodMetrics,maxPenetrationM:.02}});
assert.equal(bad.ok,false);assert(bad.failures.includes('penetration-out-of-range'));
const cancelAdapter=new FakeAdapter(),cancelRunner=new LifeRoutineRunner(cancelAdapter,{routine:one});cancelRunner.start();cancelAdapter.forceRunning=true;cancelRunner.tick(1/60);cancelAdapter.holdingObject='crate-01';assert.equal(cancelRunner.cancel(),false);assert.equal(cancelRunner.state,'paused');assert.equal(cancelRunner.snapshot().journal.at(-1).detail.requiresSafeRelease,true);
console.log(JSON.stringify({suite:'life-motion-environment-r01',routineTasksPerCycle:RESIDENT_ROUTINE_R01.length,cycles:2,verifiedTaskCount:RESIDENT_ROUTINE_R01.length*2,ticks,retryRecovery:'passed',failedGateRejected:'passed',heldObjectCancellationGuard:'passed',live3DAdapterIntegrated:false,visualAcceptance:false},null,2));