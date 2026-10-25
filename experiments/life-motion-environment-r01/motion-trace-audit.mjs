/** Offline audit of traces exported by the isolated life-motion runtime. No pose generation or physics simulation occurs here. */
export const TRACE_SCHEMA='human/life-motion-trace@1';
const finite=n=>Number.isFinite(n), vec=v=>Array.isArray(v)&&v.length===3&&v.every(finite), clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], norm=v=>Math.hypot(...v);
function validQuat(q){return Array.isArray(q)&&q.length===4&&q.every(finite)&&Math.abs(Math.hypot(...q)-1)<.02;}
function quatAngle(a,b){const d=clamp(Math.abs(dot(a,b)),-1,1);return 2*Math.acos(d);}
function fail(code,frameIndex,detail={}){return{code,frameIndex,...detail};}
export const TRACE_LIMITS=Object.freeze({maxRootSpeedMps:1.2,maxRootAccelerationMps2:5,maxJointSpeedMps:2.5,maxJointAccelerationMps2:20,maxAngularSpeedRadS:8,maxAngularAccelerationRadS2:40,maxFootSlipM:.012,maxHandContactErrorM:.025,maxPenetrationM:.001,maxJointLimitViolationDeg:.5,minFrameDtS:1/240,maxFrameDtS:1/15});
export function auditMotionTrace(trace,limits=TRACE_LIMITS){
 const errors=[],warnings=[],metrics={frameCount:0,durationS:0,maxRootSpeedMps:0,maxRootAccelerationMps2:0,maxJointSpeedMps:0,maxJointAccelerationMps2:0,maxAngularSpeedRadS:0,maxAngularAccelerationRadS2:0,maxFootSlipM:0,maxHandContactErrorM:0,maxPenetrationM:0,maxJointLimitViolationDeg:0};
 if(!trace||trace.schema!==TRACE_SCHEMA||!Array.isArray(trace.frames)||trace.frames.length<3)return{ok:false,errors:[{code:'invalid-trace-schema'}],warnings,metrics};
 const frames=trace.frames;metrics.frameCount=frames.length;
 const previous=new Map(),previousVelocity=new Map();let previousTime=null,expectedJointIds=null;
 for(let i=0;i<frames.length;i++){
  const f=frames[i];if(!f||!finite(f.timeS)||!vec(f.root)||!f.joints||typeof f.joints!=='object'){errors.push(fail('invalid-frame',i));continue;}
  const jointIds=Object.keys(f.joints).sort();if(expectedJointIds===null)expectedJointIds=jointIds;else if(jointIds.join('|')!==expectedJointIds.join('|'))errors.push(fail('joint-set-changed',i));
  if(previousTime!==null){const dt=f.timeS-previousTime;if(!(dt>0)){errors.push(fail('non-monotonic-time',i,{dt}));continue;}if(dt<limits.minFrameDtS||dt>limits.maxFrameDtS)errors.push(fail('frame-interval-out-of-range',i,{dt}));}
  const dt=previousTime===null?null:f.timeS-previousTime;if(!(dt>0)&&previousTime!==null)continue;
  const channels=[['root',f.root,null]];
  for(const [id,j] of Object.entries(f.joints)){if(!j||!vec(j.p)||!validQuat(j.q)){errors.push(fail('invalid-joint-transform',i,{joint:id}));continue;}channels.push([id,j.p,j.q]);}
  for(const [id,p,q] of channels){
   const old=previous.get(id);if(old&&dt){
    const v=sub(p,old.p),speed=norm(v)/dt;
    if(id==='root')metrics.maxRootSpeedMps=Math.max(metrics.maxRootSpeedMps,speed);else metrics.maxJointSpeedMps=Math.max(metrics.maxJointSpeedMps,speed);
    if(speed>(id==='root'?limits.maxRootSpeedMps:limits.maxJointSpeedMps))errors.push(fail('linear-speed-limit',i,{channel:id,speedMps:speed}));
    const velocity=v.map(x=>x/dt),oldV=previousVelocity.get(id);
    if(oldV){const acc=norm(sub(velocity,oldV.v))/((dt+oldV.dt)/2);if(id==='root')metrics.maxRootAccelerationMps2=Math.max(metrics.maxRootAccelerationMps2,acc);else metrics.maxJointAccelerationMps2=Math.max(metrics.maxJointAccelerationMps2,acc);if(acc>(id==='root'?limits.maxRootAccelerationMps2:limits.maxJointAccelerationMps2))errors.push(fail('linear-acceleration-limit',i,{channel:id,accelerationMps2:acc}));}
    previousVelocity.set(id,{v:velocity,dt});
    let angularSpeed=0;if(q&&old.q){angularSpeed=quatAngle(q,old.q)/dt;metrics.maxAngularSpeedRadS=Math.max(metrics.maxAngularSpeedRadS,angularSpeed);if(angularSpeed>limits.maxAngularSpeedRadS)errors.push(fail('angular-speed-limit',i,{channel:id,angularSpeedRadS:angularSpeed}));const angularAcc=Math.abs(angularSpeed-old.angularSpeedRadS)/dt;metrics.maxAngularAccelerationRadS2=Math.max(metrics.maxAngularAccelerationRadS2,angularAcc);if(i>1&&angularAcc>limits.maxAngularAccelerationRadS2)errors.push(fail('angular-acceleration-limit',i,{channel:id,angularAccelerationRadS2:angularAcc}));}
    previous.set(id,{p:[...p],q:q?[...q]:null,angularSpeedRadS:angularSpeed});
   }else previous.set(id,{p:[...p],q:q?[...q]:null,angularSpeedRadS:0});
  }
  for(const side of ['left','right']){const foot=f.contacts?.[side+'Foot'];if(!foot)continue;if(foot.active){if(!vec(foot.anchor)||!vec(foot.position)){errors.push(fail('invalid-foot-contact',i,{side}));continue;}const slip=norm(sub(foot.position,foot.anchor));metrics.maxFootSlipM=Math.max(metrics.maxFootSlipM,slip);if(slip>limits.maxFootSlipM)errors.push(fail('foot-slip',i,{side,slipM:slip}));}}
  for(const side of ['left','right']){const hand=f.contacts?.[side+'Hand'];if(!hand)continue;if(hand.active){if(!vec(hand.actualPosition)||!vec(hand.targetPosition)){errors.push(fail('invalid-hand-contact',i,{side}));continue;}const residual=norm(sub(hand.actualPosition,hand.targetPosition));metrics.maxHandContactErrorM=Math.max(metrics.maxHandContactErrorM,residual);if(residual>limits.maxHandContactErrorM)errors.push(fail('hand-contact-error',i,{side,residualM:residual}));}}
  for(const key of ['selfPenetrationM','environmentPenetrationM']){const value=f.collisions?.[key];if(!finite(value)||value<0){errors.push(fail('missing-or-invalid-collision-metric',i,{key}));continue;}metrics.maxPenetrationM=Math.max(metrics.maxPenetrationM,value);if(value>limits.maxPenetrationM)errors.push(fail('penetration',i,{key,penetrationM:value}));}
  const jointLimit=f.jointLimitViolationDeg;if(!finite(jointLimit)||jointLimit<0){errors.push(fail('missing-or-invalid-joint-limit-metric',i));}else{metrics.maxJointLimitViolationDeg=Math.max(metrics.maxJointLimitViolationDeg,jointLimit);if(jointLimit>limits.maxJointLimitViolationDeg)errors.push(fail('joint-limit-violation',i,{degrees:jointLimit}));}
  previousTime=f.timeS;
 }
 metrics.durationS=frames.length>1&&finite(frames.at(-1)?.timeS)&&finite(frames[0]?.timeS)?frames.at(-1).timeS-frames[0].timeS:0;
 return{schema:TRACE_SCHEMA,ok:errors.length===0,errors,warnings,metrics,claimBoundary:'Trace audit only; does not create motion, run physics, or establish visual naturalness.'};
}