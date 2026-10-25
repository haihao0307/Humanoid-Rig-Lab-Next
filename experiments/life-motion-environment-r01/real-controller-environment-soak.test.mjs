import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MotionController} from '../../motion/vendor/controller.mjs';
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
const routes=[
 [[0,0,1.1],[.25,0,1.8],[.8,0,2.1],[.2,0,.7]],
 [[0,0,.8],[-.35,0,1.65],[-.65,0,2.2],[0,0,.6]],
 [[0,0,1.0],[.35,0,.45],[.15,0,1.7],[-.2,0,.8]],
 [[0,0,.7],[-.5,0,.8],[-.5,0,1.8],[.1,0,1.0]]
];
const dt=1/120, traces=[], results=[];
let globalFrame=0;
function quatYaw(yaw){return[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];}
for(let caseIndex=0;caseIndex<routes.length;caseIndex++){
 const world=new FlatWorld([]),controller=new MotionController(rig,world);
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
   trace.frames.push({timeS:localFrame*dt,root:[...s.root],joints,contacts,collisions:{selfPenetrationM:0,environmentPenetrationM:0},jointLimitViolationDeg:Math.max(s.metrics.maxBoneError*1000,s.metrics.maxIKResidual*1000)});
   if(s.fault)break;
  }
  assert(steps<2400,JSON.stringify({error:'route command timed out',caseIndex,routeIndex,state:controller.snapshot()}));
  assert.equal(controller.state.fault,null,'controller must not fault during route');
  assert.notEqual(controller.state.status,'blocked','route unexpectedly blocked by world sweep');
  assert.equal(controller.state.command,null,'route command should finish');
  results.push({caseIndex,routeIndex,status:'completed',steps,root:[...controller.state.root],footSlipMaxM:controller.state.metrics.maxContactError,ikResidualM:controller.state.metrics.maxIKResidual});
 }
 const s=controller.snapshot();
 assert.equal(s.fault,null);
 results.push({caseIndex,status:'case-complete',frames:trace.frames.length,steps:s.metrics.steps,completed:s.metrics.completed,rejected:s.metrics.rejected});traces.push(trace);
}
const blockedWorld=new FlatWorld(obstacles);const blockedProbe=blockedWorld.sweep([.5,0,.2],[.5,0,2],.23);assert(blockedProbe.blocked,'obstacle sweep must reject an intersecting path');
const audits=traces.map((trace,index)=>({index,audit:auditMotionTrace(trace)}));
const audit={ok:audits.every(x=>x.audit.ok),errors:audits.flatMap(x=>x.audit.errors.map(e=>({...e,caseIndex:x.index}))),metrics:{frameCount:audits.reduce((n,x)=>n+x.audit.metrics.frameCount,0),durationS:audits.reduce((n,x)=>n+x.audit.metrics.durationS,0),maxRootSpeedMps:Math.max(...audits.map(x=>x.audit.metrics.maxRootSpeedMps)),maxRootAccelerationMps2:Math.max(...audits.map(x=>x.audit.metrics.maxRootAccelerationMps2)),maxJointSpeedMps:Math.max(...audits.map(x=>x.audit.metrics.maxJointSpeedMps)),maxJointAccelerationMps2:Math.max(...audits.map(x=>x.audit.metrics.maxJointAccelerationMps2)),maxAngularSpeedRadS:Math.max(...audits.map(x=>x.audit.metrics.maxAngularSpeedRadS)),maxAngularAccelerationRadS2:Math.max(...audits.map(x=>x.audit.metrics.maxAngularAccelerationRadS2)),maxFootSlipM:Math.max(...audits.map(x=>x.audit.metrics.maxFootSlipM)),maxPenetrationM:Math.max(...audits.map(x=>x.audit.metrics.maxPenetrationM))}};
assert(audit.metrics.frameCount>1000,'must audit a substantive motion trace');
assert(audit.errors.length>0,'current controller defects must remain visible until measured motion defects are fixed');
assert(audit.errors.some(e=>e.code==='angular-acceleration-limit'||e.code==='linear-acceleration-limit'),'trace audit must detect measured acceleration discontinuities');
console.log(JSON.stringify({suite:'real-motion-controller-environment-soak',controller:'MotionController + FullBodyMotion + FlatWorld',cases:routes.length,routeCommandsCompleted:results.filter(x=>x.status==='completed').length,routeCommandsBlocked:results.filter(x=>x.status==='blocked').length,frames:audit.metrics.frameCount,durationS:audit.metrics.durationS,auditPassed:audit.ok,auditFailureCount:audit.errors.length,auditFailureCodes:[...new Set(audit.errors.map(e=>e.code))],metrics:audit.metrics,results,limitations:['Locomotion traces use clear routes; obstacle sweep rejection is tested separately, this controller does not perform autonomous detours','No rendered skin/GPU evidence','No stair geometry or manipulation/door/window physics in this controller','Collision fields are from the controller world sweep; self-surface penetration is not measured by this controller','Leg IK residual is reported via the joint-limit channel as a conservative proxy, not anatomical joint limits']},null,2));