/* Versioned control adapter for the unchanged V1.10 HumanLab. No geometry writes.
 * Every quaternion is projected by the existing HumanJointConstraintSystem.
 * Unsupported body interfaces fail closed rather than inventing a skeleton.
 */
window.HumanJointControlAdapter={install(api){
'use strict';if(api.jointControl)return api.jointControl;
const C=window.JarvisJointContract,h=api.human,a=api.agent;
if(!C||!h?.byId||!h.constraints?.limitCandidate||!h.constraints?._project||!h.constraints?._temporary||!h.fk)throw Error('身体缺少 joint_goal@1.0 适配接口');
const clone=v=>JSON.parse(JSON.stringify(v)),rad=n=>n*Math.PI/180;
const axis=(i,v)=>{const q=[0,0,0,Math.cos(v/2)];q[i]=Math.sin(v/2);return q};
const angle=(x,y)=>2*Math.acos(Math.min(1,Math.abs(x.reduce((s,v,i)=>s+v*y[i],0))))*180/Math.PI;
const blend=(x,y,t)=>{let d=x.reduce((s,v,i)=>s+v*y[i],0),q=y;if(d<0){q=y.map(v=>-v);d=-d}let u=1-t,v=t;if(d<.9995){const th=Math.acos(Math.min(1,d)),sn=Math.sin(th);u=Math.sin((1-t)*th)/sn;v=Math.sin(t*th)/sn}const r=x.map((w,i)=>u*w+v*q[i]),n=Math.hypot(...r);return r.map(w=>w/n)};
const neutral=new Map(h.joints.map(j=>[j.id,[...j.q]]));let active=null,hold=false,trace=null,lastTrace=null,lastSample=-Infinity,lastResolvedGoal=null;
const raw={tick:a.tick.bind(a),cancel:a.cancel.bind(a),reset:a.reset.bind(a),validate:api.validatePlan,submit:api.submitPlan,analyze:api.analyzeStep,simulate:api.simulatePlan};
function measuredAngle(side,region,motion){
 const ids=region==='elbow'?[side+'_forearm']:motion==='abduction'?[side+'_SC',side+'_AC',side+'_upperArm']:[side+'_upperArm'];
 const index=motion==='abduction'?2:0,sign=motion==='abduction'?(side==='left'?-1:1):-1;
 return ids.reduce((sum,id)=>{const q=h.byId.get(id).q;return sum+sign*2*Math.atan2(q[index],q[3])*180/Math.PI},0);
}
function angles(){const out={};for(const side of ['left','right'])for(const region of ['shoulder','elbow'])for(const motion of region==='elbow'?['flexion']:['flexion','abduction'])out[`${side}:${region}:${motion}`]=measuredAngle(side,region,motion);return out;}
function resolveGoal(step,actor={}){
 const result=clone(step);if(!result.relative)return result;
 const sides=step.side==='both'?['left','right']:[step.side],values=sides.map(side=>actor.jointAngles?.[`${side}:${step.region}:${step.motion}`]??measuredAngle(side,step.region,step.motion));
 if(values.some(v=>!Number.isFinite(v)))throw Error('缺少可靠的当前关节角度');
 if(values.length===2&&Math.abs(values[0]-values[1])>.5)throw Error('双臂当前角度不同，请分别指定左手和右手的相对调整');
 result.angleDeg=values[0]+step.angleDeg;delete result.relative;const check=C.validate(result);if(!check.ok)throw Error('相对调整会超出控制范围：'+check.errors.join('；'));return result;
}
function targets(step){
 const out={};for(const side of step.side==='both'?['left','right']:[step.side]){
  const s=side==='left'?-1:1,put=(suffix,q)=>{const id=side+'_'+suffix,j=h.byId.get(id);if(!j)throw Error('新身体缺少关节：'+id);out[id]=h.constraints._project(j,q,h.constraints._temporary());};
  if(step.region==='elbow')put('forearm',axis(0,-rad(step.angleDeg)));
  else if(step.motion==='rest'){for(const suffix of ['SC','AC','upperArm','forearm','radiusRotation','hand'])put(suffix,[...neutral.get(side+'_'+suffix)])}
  else{const theta=rad(step.angleDeg),girdle=step.motion==='abduction'?.15:0;
   put('SC',axis(2,s*theta*girdle*.45));put('AC',axis(2,s*theta*girdle*.55));
   put('upperArm',axis(step.motion==='abduction'?2:0,step.motion==='abduction'?s*theta*(1-girdle):-theta));
   put('forearm',axis(0,-rad(8)));put('radiusRotation',neutral.get(side+'_radiusRotation'));put('hand',neutral.get(side+'_hand'));
  }
 }return out;
}
function validate(plan){
 if(!plan?.steps?.some(s=>s?.type==='joint_pose'))return raw.validate(plan);
 const errors=[];if(plan.schema!=='knowledge_human/checked_semantic_plan@1.0'||plan.steps.length>64)errors.push('计划版本或长度无效');
 for(const step of plan.steps){const r=step?.type==='joint_pose'?C.validate(step):raw.validate({...plan,steps:[step]});errors.push(...r.errors)}return{ok:!errors.length,errors};
}
function analyze(step,actor={}){
 if(step?.type!=='joint_pose')return raw.analyze(step,actor);
 const reasons=[...C.validate(step).errors],posture=actor.posture||a.basic.posture;
 if(actor.heldObject||a.held)reasons.push('当前保持抓握，不能用独立关节目标抢占手臂');
 if(posture!=='standing')reasons.push('本版独立肩肘控制需要先站起来');
 let resolved=null;if(!reasons.length)try{resolved=resolveGoal(step,actor);targets(resolved)}catch(e){reasons.push(e.message)}
 return{schema:'knowledge_human/physical_reasoning@1.0',step:clone(step),resolvedGoal:resolved,feasible:!reasons.length,reasons,alternatives:[],facts:['使用当前身体的稳定关节 ID 与原有关节活动范围','只改变局部旋转；保持根节点、双脚和绑定骨长','本项为运动学预检，尚未进行全身碰撞及动力学验证'],estimates:{routeLengthM:0,effortScore:0,predictedDurationS:step.duration,minClearanceM:null},predictedEffects:{bodyPosition:[...(actor.pos||actor.position||a.pos)],bodyYaw:actor.yaw??a.yaw,posture,objectUpdates:[]}};
}
function simulate(plan,actor={}){
 if(!plan?.steps?.some(s=>s?.type==='joint_pose'))return raw.simulate(plan,actor);
 const analyses=[],reasons=[],prefix=[];let native=null,extraDuration=0,at={...actor,posture:actor.posture||a.basic.posture,jointAngles:angles()};
 for(const step of plan.steps){let r;if(step.type==='joint_pose'){r=analyze(step,at);if(r.feasible){const g=r.resolvedGoal||step;for(const side of g.side==='both'?['left','right']:[g.side])at.jointAngles[`${side}:${g.region}:${g.motion==='rest'?'flexion':g.motion}`]=g.angleDeg;}extraDuration+=step.duration||0}else{prefix.push(step);native=raw.simulate({...plan,steps:prefix},actor);r=native.analyses.at(-1);at={...native.predictedActor,jointAngles:angles()}}
 analyses.push(r);if(!r?.feasible){reasons.push(...(r?.reasons||['推演失败']));break}}
 return{schema:'knowledge_human/physical_plan_simulation@1.0',feasible:!reasons.length,reasons,analyses,score:native?.score||0,totalDurationS:(native?.totalDurationS||0)+extraDuration,minClearanceM:native?.minClearanceM??null,predictedWorld:native?.predictedWorld||api.world.snapshot(),predictedActor:at,plan:clone(plan),jointGoalKinematicsOnly:true};
}
function beginTrace(ticket){trace={ticketId:ticket,startedAt:Date.now(),samples:0,peaks:{},start:Object.fromEntries(h.joints.map(j=>[j.id,[...j.q]])),maxBoneLengthErrorM:0};lastSample=-Infinity;sample(true)}
function sample(force=false){if(!trace||(!force&&a.time-lastSample<.1))return;lastSample=a.time;trace.samples++;
 for(const j of h.joints){const d=angle(j.q,trace.start[j.id]);if(d>.15)trace.peaks[j.id]=Math.max(trace.peaks[j.id]||0,d)}
 for(const b of h.bindLengths){if(/_patella$/.test(b.id))continue;const j=h.byId.get(b.id);const d=Math.abs(Math.hypot(...j.world.p.map((v,i)=>v-j.parent.world.p[i]))-b.length);trace.maxBoneLengthErrorM=Math.max(trace.maxBoneLengthErrorM,d)}
}
function traceReport(){const t=trace||lastTrace;if(!t)return null;return{ticketId:t.ticketId,samples:t.samples,changedJoints:Object.entries(t.peaks).map(([id,peakRotationDeg])=>({id,peakRotationDeg})).sort((x,y)=>y.peakRotationDeg-x.peakRotationDeg),maxBoneLengthErrorM:t.maxBoneLengthErrorM,source:'actual-final-joint-quaternions',geometryModified:false};}
function finishTrace(){sample(true);const r=traceReport();lastTrace=trace;trace=null;return r}
function start(plan){
 if(!plan.steps.some(s=>s.type==='joint_pose')){hold=false;return raw.submit(plan)}
 const v=validate(plan);if(!v.ok)throw Error(v.errors.join('；'));
 if(plan.steps.length!==1)throw Error('独立关节步骤由上层任务队列逐项派发');
 if(active||a.plan||a.skill||a.basic.busy)throw Error('身体仍在执行其他任务');
 const step=plan.steps[0],pre=analyze(step);if(!pre.feasible)throw Error(pre.reasons.join('；'));
 const resolved=resolveGoal(step),goals=targets(resolved),feet=['left','right'].map(side=>[...h.legs[side].wrist.world.p]);
 active={step:clone(step),resolvedGoal:clone(resolved),goals,start:Object.fromEntries(Object.keys(goals).map(id=>[id,[...h.byId.get(id).q]])),feet,root:[...h.root.p],elapsed:0};
 lastResolvedGoal=clone(resolved);hold=false;a.error=null;a.paused=false;a.plan=clone(plan);a.skill=clone(step);a.phase='joint_pose';a.phaseT=0;
 // Remove obsolete hand IK residuals. This command has angular goals instead.
 const controlled=step.side==='both'?['left','right']:[step.side];h.lastErrors=h.lastErrors.filter(e=>!controlled.some(side=>e.id===side+'_hand'));
 return{accepted:true,goal:clone(step),controlledJoints:Object.keys(goals)};
}
function tick(dt){
 if(a.paused){sample();return}
 if(active){const r=active;r.elapsed+=dt;a.time+=dt;a.phaseT+=dt;const t=Math.min(1,r.elapsed/r.step.duration),u=t*t*t*(10+t*(-15+6*t));
  h.constraints.beginFrame(dt);for(const [id,q] of Object.entries(r.goals))h.byId.get(id).q=blend(r.start[id],q,u);h.constraints.enforceAll();h.fk();h.refreshEffectorErrors();sample();
  if(t>=1){const residual=Math.max(0,...Object.entries(r.goals).map(([id,q])=>angle(h.byId.get(id).q,q)));const feetDrift=Math.max(...['left','right'].map((side,k)=>Math.hypot(...h.legs[side].wrist.world.p.map((v,i)=>v-r.feet[k][i]))));
   const audit=h.constraints.audit();if(residual>.5||feetDrift>.001||!audit.valid){a.error='关节到位或支撑点验收失败';a.stats.failed++;a.paused=true;a.evidence.push({type:'joint_pose',completion:'failed',residualDeg:residual,feetDriftM:feetDrift})}
   else{a.stats.completed++;a.evidence.push({type:'joint_pose',completion:'verified',time:a.time,goal:clone(r.step),resolvedGoal:clone(r.resolvedGoal),controlledJoints:Object.keys(r.goals),maxAngularErrorDeg:residual,footAnchorDriftM:feetDrift,hardLimitCompliance:audit.valid})}
   active=null;hold=true;a.plan=null;a.skill=null;a.index=0;a.phase='joint_hold';
  }return;
 }
 if(hold&&!a.plan&&!a.skill&&!a.basic.busy){a.time+=dt;sample();return}
 hold=false;raw.tick(dt);sample();
}
function cancel(){const r=raw.cancel();if(!r.requiresRelease){active=null;hold=true;a.paused=true;r.paused=true;r.freezePose=true}sample(true);return r}
a.tick=tick;a.cancel=cancel;a.reset=(...args)=>{active=null;hold=false;trace=null;lastTrace=null;lastResolvedGoal=null;return raw.reset(...args)};
api.validatePlan=validate;api.submitPlan=start;api.analyzeStep=analyze;api.simulatePlan=simulate;
api.jointControl={schema:C.SCHEMA,version:'1.1.0',beginTrace,finishTrace,traceReport,snapshot(){return{schema:C.SCHEMA,status:active?(a.paused?'paused':'moving'):hold?'holding':'native',goal:active?.step||null,resolvedGoal:active?.resolvedGoal||null,lastResolvedGoal,angles:angles(),trace:traceReport(),jointCount:h.joints.length,bodyVersion:api.version,bindingUnchanged:true}}};return api.jointControl;
}};
