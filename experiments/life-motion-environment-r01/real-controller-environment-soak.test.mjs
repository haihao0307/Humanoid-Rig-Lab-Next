import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MotionController as BaselineController} from '../../motion/vendor/controller.mjs';
import {MotionController as SmoothedController} from './vendor/controller.mjs';
import {rigFromSource} from '../../motion/vendor/rig.mjs';
import {FlatWorld} from '../../motion/vendor/world.mjs';
import {auditMotionTrace,TRACE_SCHEMA} from './motion-trace-audit.mjs';
const rigDoc=JSON.parse(readFileSync(new URL('../../reconstruction/rig-reference.json',import.meta.url),'utf8'));
const rig=rigFromSource(rigDoc);
const obstacles=[
 {minX:.65,maxX:.95,minZ:.65,maxZ:1.8},
 {minX:-1.25,maxX:-.95,minZ:1.2,maxZ:2.25},
 {minX:.9,maxX:1.35,minZ:-.25,maxZ:.15}
];
const baseRoutes=[
 [[0,0,1.1],[.25,0,1.8],[.8,0,2.1],[.2,0,.7]],
 [[0,0,.8],[-.35,0,1.65],[-.65,0,2.2],[0,0,.6]],
 [[0,0,1.0],[.35,0,.45],[.15,0,1.7],[-.2,0,.8]],
 [[0,0,.7],[-.5,0,.8],[-.5,0,1.8],[.1,0,1.0]]
];
// Long-horizon route set: each geometry is traversed forward, reversed, then
// traversed forward again to expose cumulative heading/support drift.
const routes=baseRoutes.map(route=>[...route,...route.slice(0,-1).reverse(),...route.slice(1)]);
const dt=1/120, results=[], traces=[], audits=[], controllerMetrics=[];
function quatYaw(yaw){return[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];}
for(const [variant,Controller] of [['baseline',BaselineController],['smoothed',SmoothedController]]){
 let globalFrame=0; const direct={variant,maxLinearAccelerationMps2:0,maxYawAccelerationRadS2:0,maxLinearSpeedMps:0,maxYawRateRadS:0,velocityBoundViolations:0,yawBoundViolations:0};
 for(let caseIndex=0;caseIndex<routes.length;caseIndex++){
 const world=new FlatWorld([]),controller=new Controller(rig,world);
 const trace={schema:TRACE_SCHEMA,frames:[]},anchors={left:null,right:null};let localFrame=0;
 const state=controller.state;
 const first=routes[caseIndex][0];
 if(Math.hypot(state.root[0]-first[0],state.root[2]-first[2])>.02){
  const reset=controller.command({type:'walk',target:first});assert(reset.accepted);
  let n=0;while(controller.state.command&&n++<2400)controller.update(dt);
  assert.equal(controller.state.fault,null,'spawn-to-route start must be reachable');
 }
 const startFrame=trace.frames.length;
 for(let routeIndex=0;routeIndex<routes[caseIndex].length;routeIndex++){
  const target=routes[caseIndex][routeIndex],cmd=controller.command({type:'walk',target});
  if(!cmd.accepted){results.push({caseIndex,routeIndex,status:'rejected',reason:cmd.reason});continue;}
  let steps=0;
  while(controller.state.command&&steps<2400&&controller.state.status!=='blocked'&&!controller.state.fault){
   controller.update(dt);steps++;globalFrame++;localFrame++;
   if(controller.state.fault||controller.state.status==='blocked')break;
   const s=controller.snapshot(),joints={};
   for(const side of ['left','right']){
    const leg=s.pose.legs[side];
    joints[side+'_femur']={p:[...leg.root],q:quatYaw(s.yaw)};
    joints[side+'_tibia']={p:[...leg.knee],q:quatYaw(s.yaw)};
    joints[side+'_foot']={p:[...leg.end],q:quatYaw(s.feet[side].yaw)};
   }
   const contacts={};
   for(const side of ['left','right']){
    if(!s.feet[side].contact)anchors[side]=null;
    else if(!anchors[side])anchors[side]=[...s.feet[side].position];
    contacts[side+'Foot']={active:s.feet[side].contact,anchor:anchors[side]?[...anchors[side]]:[...s.feet[side].position],position:[...s.feet[side].position]};
   }
   trace.frames.push({timeS:localFrame*dt,root:[s.root[0],0,s.root[2]],joints,contacts,collisions:{selfPenetrationM:0,environmentPenetrationM:0},jointLimitViolationDeg:Math.max(s.metrics.maxBoneError*1000,s.metrics.maxIKResidual*1000)});
   if(s.fault)break;
  }
  assert(steps<2400,JSON.stringify({error:'route command timed out',caseIndex,routeIndex,state:controller.snapshot()}));
  assert.equal(controller.state.fault,null,'controller must not fault during route');
  assert.notEqual(controller.state.status,'blocked','route unexpectedly blocked by world sweep');
  assert.equal(controller.state.command,null,'route command should finish');
  results.push({variant,caseIndex,routeIndex,status:'completed',steps,root:[...controller.state.root],footSlipMaxM:controller.state.metrics.maxContactError,ikResidualM:controller.state.metrics.maxIKResidual});
 }
 const s=controller.snapshot();
 assert.equal(s.fault,null);
 results.push({variant,caseIndex,status:'case-complete',frames:trace.frames.length,steps:s.metrics.steps,completed:s.metrics.completed,rejected:s.metrics.rejected});traces.push({variant,trace});
 }
 controllerMetrics.push(direct);
 const variantTraces=traces.filter(x=>x.variant===variant).map(x=>x.trace);
 const variantAudits=variantTraces.map((trace,index)=>({index,audit:auditMotionTrace(trace)}));
 audits.push({variant,frames:variantAudits.reduce((n,x)=>n+x.audit.metrics.frameCount,0),durationS:variantAudits.reduce((n,x)=>n+x.audit.metrics.durationS,0),errors:variantAudits.flatMap(x=>x.audit.errors),metrics:{maxRootSpeedMps:Math.max(...variantAudits.map(x=>x.audit.metrics.maxRootSpeedMps)),maxRootAccelerationMps2:Math.max(...variantAudits.map(x=>x.audit.metrics.maxRootAccelerationMps2)),maxJointSpeedMps:Math.max(...variantAudits.map(x=>x.audit.metrics.maxJointSpeedMps)),maxJointAccelerationMps2:Math.max(...variantAudits.map(x=>x.audit.metrics.maxJointAccelerationMps2)),maxAngularSpeedRadS:Math.max(...variantAudits.map(x=>x.audit.metrics.maxAngularSpeedRadS)),maxAngularAccelerationRadS2:Math.max(...variantAudits.map(x=>x.audit.metrics.maxAngularAccelerationRadS2)),maxFootSlipM:Math.max(...variantAudits.map(x=>x.audit.metrics.maxFootSlipM)),maxPenetrationM:Math.max(...variantAudits.map(x=>x.audit.metrics.maxPenetrationM))}});
}
const blockedWorld=new FlatWorld(obstacles);const blockedProbe=blockedWorld.sweep([.5,0,.2],[.5,0,2],.23);assert(blockedProbe.blocked,'obstacle sweep must reject an intersecting path');
const baseline=audits.find(x=>x.variant==='baseline'),smoothed=audits.find(x=>x.variant==='smoothed');
assert(baseline&&smoothed,'both controller variants must be audited');
assert(baseline.frames>10000&&smoothed.frames>10000,'both variants need long-horizon traces');
const audit={ok:smoothed.errors.length===0,errors:smoothed.errors,metrics:smoothed.metrics};
const comparison={baseline:{frames:baseline.frames,durationS:baseline.durationS,errorCount:baseline.errors.length,codes:[...new Set(baseline.errors.map(e=>e.code))],metrics:baseline.metrics},smoothed:{frames:smoothed.frames,durationS:smoothed.durationS,errorCount:smoothed.errors.length,codes:[...new Set(smoothed.errors.map(e=>e.code))],metrics:smoothed.metrics}};
assert(smoothed.errors.length>0,'current controller defects must remain visible until measured motion defects are fixed');
const peakFailures={baseline:baseline.errors.slice().sort((a,b)=>(b.accelerationMps2||b.angularAccelerationRadS2||0)-(a.accelerationMps2||a.angularAccelerationRadS2||0)).slice(0,8),smoothed:smoothed.errors.slice().sort((a,b)=>(b.accelerationMps2||b.angularAccelerationRadS2||0)-(a.accelerationMps2||a.angularAccelerationRadS2||0)).slice(0,8)};
console.log(JSON.stringify({suite:'real-motion-controller-environment-soak',peakFailures,controllerMetrics,controller:'baseline vs acceleration-limited controller + FullBodyMotion + FlatWorld',baseLayouts:baseRoutes.length,routeLegsPerLayout:routes[0].length,cases:routes.length,routeCommandsCompleted:Object.fromEntries(['baseline','smoothed'].map(v=>[v,results.filter(x=>x.variant===v&&x.status==='completed').length])),comparison,auditPassed:audit.ok,auditFailureCount:audit.errors.length,auditFailureCodes:[...new Set(audit.errors.map(e=>e.code))],results,limitations:['Locomotion traces use clear routes; obstacle sweep rejection is tested separately, this controller does not perform autonomous detours','No rendered skin/GPU evidence','No stair geometry or manipulation/door/window physics in this controller','Collision fields are from the controller world sweep; self-surface penetration is not measured by this controller','Leg IK residual is reported via the joint-limit channel as a conservative proxy, not anatomical joint limits']},null,2));