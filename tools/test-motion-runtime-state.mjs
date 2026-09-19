import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const runtimeSource=read('body/MotionRuntimeState.js');
const locomotionSource=read('body/NaturalLocomotion.js');
const assembly=JSON.parse(read('source/assembly.json'));

// The state layer is a production module, loaded immediately before the
// locomotion owner. These checks do not execute the full character runtime.
const stateIndex=assembly.modules.indexOf('body/MotionRuntimeState.js');
const locomotionIndex=assembly.modules.indexOf('body/NaturalLocomotion.js');
assert(stateIndex>=0,'MotionRuntimeState must be registered');
assert.equal(stateIndex+1,locomotionIndex,'MotionRuntimeState must load immediately before NaturalLocomotion');
for(const marker of [
 "new MotionRuntimeState(agent)",
 "runtime:this.runtimeState?.snapshot?.()||null",
 "if(runtime)this.runtimeState.restore(runtime)",
 "this.runtimeState?.setIntent(command,this.engine.state,this.tempo)",
 "this.runtimeState?.observe(this,dt)",
 "runtimeState:this.runtimeState?.report?.()||null"
])assert(locomotionSource.includes(marker),'missing locomotion runtime-state wiring: '+marker);

const {MotionRuntimeState,MOTION_RUNTIME_STATE_CONTRACT}=vm.runInNewContext(
 runtimeSource+'\n({MotionRuntimeState,MOTION_RUNTIME_STATE_CONTRACT})',
 {structuredClone}
);
assert.equal(MOTION_RUNTIME_STATE_CONTRACT.schema,'human/motion-runtime-state@1');

let poseReport={
 poseAuthority:'MotionLabPose.commit',completeHierarchy:true,
 validatedAfterClearance:true,worldContactTargetsPreserved:true,
 footErrorM:.002,handErrorM:.003,boneErrorM:1e-7,attachmentErrorM:2e-7,
 ground:{y:.0005},groundCorrectionM:.004,
 floorSupport:{active:true,side:'right',weight:1},
 floorSeat:null,floorFoot:{active:true,side:'left',weight:1}
};
const agent={
 time:4,phase:'walk',pos:[0,1,0],yaw:.2,held:{id:'box-1'},
 skill:{type:'carry',objectId:'box-1',targetId:'zone-2'},
 h:{motionDriver:{report:()=>poseReport}}
};
const engineState={
 root:[0,1,0],yaw:.2,status:'walking',speed:.4,fault:null,
 command:{type:'walk',target:[0,0,3]},
 motion:{phase:.25,weight:.8,frame:{leftUpperArm:[0,0,1]}},
 swing:{side:'left'},
 feet:{
  left:{position:[-.1,0,.2],yaw:.2,contact:false,rocker:{kind:'forefoot',pitch:.1,world:[-.1,0,.21],ankle:[-.1,.01,.2]}},
  right:{position:[.1,0,0],yaw:.2,contact:true,adoptedOrientation:[0,0,0,1]}
 }
};
const locomotion={
 engine:{state:engineState},speed:.32,tempo:.8,
 traffic:{reason:null,lastError:null},a:agent,pose:agent.h.motionDriver
};
agent.locomotion=locomotion;

const state=new MotionRuntimeState(agent);
const untouched=structuredClone(engineState);
state.setIntent({type:'walk',target:[0,0,3]},engineState,.8);
state.observe(locomotion,1/60);
assert.deepEqual(engineState,untouched,'the runtime mirror must not mutate the motion kernel');

let report=state.report();
assert.equal(report.intent.type,'walk');
assert.deepEqual(report.intent.targetPositionM,[0,0,3]);
assert.equal(report.intent.interactionObjectId,'zone-2');
assert.equal(report.support.activeFootCount,1);
assert.equal(report.support.feet.left.mode,'swing');
assert.equal(report.support.feet.right.mode,'planted');
assert.equal(report.support.feet.left.rockerKind,'forefoot');
assert.equal(report.support.floorPalm.side,'right');
assert.equal(report.support.floorFoot.side,'left');
assert.equal(report.contact.footErrorM,.002);
assert.equal(report.contact.handErrorM,.003);
assert.equal(report.finalPose.committed,true);
assert.equal(report.finalPose.authority,'MotionLabPose.commit');
assert.equal(report.telemetry.kinematicOnly,true);
assert.equal(report.measuredForces,false);
assert.equal(report.fullDynamics,false);
assert.equal(report.visualAcceptance,false);

engineState.root=[.06,1,0];agent.time+=.1;
state.observe(locomotion,.1);report=state.report();
assert(Math.abs(report.telemetry.rootVelocityMps[0]-.6)<1e-12,'root velocity mirrors committed root displacement');
assert.equal(report.desiredPose.commandType,'walk');
assert.equal(report.desiredPose.swingSide,'left');

const checkpoint=state.snapshot(),checkpointReport=state.report();
state.setIntent({type:'turn',yaw:Math.PI/2},engineState,1);
assert.equal(state.report().intent.type,'turn');
state.restore(checkpoint);
assert.deepEqual(state.report(),checkpointReport,'runtime-state rollback must be exact');

state.setIntent({type:'stop'},engineState,1);
assert.equal(state.report().intent.type,'stop');
assert.equal(state.report().intent.targetPositionM,null);

// Final-pose evidence is read from the current pose authority at report time,
// so a later rejected/uncommitted pose cannot be misreported as committed.
poseReport={poseAuthority:null,visualAcceptance:false};
report=state.report();
assert.equal(report.finalPose.committed,false);
assert.equal(report.contact.footErrorM,0);
assert.equal(report.contact.handErrorM,0);

console.log(JSON.stringify({
 schema:'human/motion_runtime_state_test@1',
 sourceWiringChecks:6,
 readOnlyKernel:true,
 rollbackVerified:true,
 finalPoseEvidenceLive:true,
 motionExecuted:false,
 browserExecuted:false,
 gpuExecuted:false,
 visualAcceptance:false
}));
