/* Read-only joint observation for Motion-Lab integration. This adapter cannot
 * write poses, replace the fixed clock, freeze the locomotor, or bypass tasks. */
window.HumanJointControlAdapter={install(api){
 'use strict';if(api.jointControl)return api.jointControl.rebind();
 let h=api.human,a=api.agent;const C=window.JarvisJointContract,tickBindings=new WeakSet();
 if(!h?.motionDriver||!a?.clock)throw Error('动作实验室关节接口尚未连接');
 const copy=v=>JSON.parse(JSON.stringify(v));
 const angular=(x,y)=>2*Math.acos(Math.min(1,Math.abs(x.reduce((s,v,i)=>s+v*y[i],0))))*180/Math.PI;
 let trace=null,lastTrace=null;
 function bindCurrent(){
  const nextHuman=api.human,nextAgent=api.agent;
  if(!nextHuman?.motionDriver||!nextAgent?.clock)throw Error('动作实验室关节接口尚未连接');
  if(h!==nextHuman||a!==nextAgent){h=nextHuman;a=nextAgent;trace=null;lastTrace=null;}
  if(!tickBindings.has(a)){
   const boundAgent=a,raw={tick:boundAgent.tick.bind(boundAgent)};
   boundAgent.tick=dt=>{const result=raw.tick(dt);if(api.agent===boundAgent)sample();return result;};tickBindings.add(boundAgent);
  }
 }
 function sample(){
  bindCurrent();
  if(!trace)return;trace.samples++;
  for(const j of h.joints)trace.peaks[j.id]=Math.max(trace.peaks[j.id]||0,angular(j.q,trace.start[j.id]));
  trace.maxBoneLengthErrorM=Math.max(trace.maxBoneLengthErrorM,h.diagnostics().maxBoneLengthErrorM);
 }
 function traceReport(){bindCurrent();const t=trace||lastTrace;if(!t)return null;return {ticketId:t.ticketId,samples:t.samples,
  changedJoints:Object.entries(t.peaks).map(([id,peakRotationDeg])=>({id,peakRotationDeg})),
  maxBoneLengthErrorM:t.maxBoneLengthErrorM,source:'MotionLabPose.commit',geometryModified:false};}
 function beginTrace(ticket){bindCurrent();trace={ticketId:ticket?.ticketId||ticket||null,samples:0,peaks:{},start:Object.fromEntries(h.joints.map(j=>[j.id,[...j.q]])),maxBoneLengthErrorM:0};sample();return traceReport();}
 function finishTrace(){sample();lastTrace=trace;trace=null;return traceReport();}
 const raw={validate:api.validatePlan,submit:api.submitPlan,analyze:api.analyzeStep};
 const reason='当前动作实验室通过完整姿态与接触目标控制身体，尚未开放逐关节角度命令。';
 const containsJoint=plan=>(plan?.steps||[]).some(s=>s.type==='joint_pose');
 api.validatePlan=plan=>containsJoint(plan)?{ok:false,errors:[reason]}:raw.validate(plan);
 api.submitPlan=plan=>{if(containsJoint(plan))throw Error(reason);return raw.submit(plan);};
 api.analyzeStep=(step,actor)=>step.type==='joint_pose'?{feasible:false,reasons:[reason]}:raw.analyze(step,actor);
 api.jointControl={schema:C?.SCHEMA||'jarvis/joint_goal@1.1',version:'2.0.0',supportsDirectGoals:false,
  analyze:api.analyzeStep,beginTrace,finishTrace,traceReport,rebind(){bindCurrent();return api.jointControl;},snapshot(){bindCurrent();return{
   schema:C?.SCHEMA,status:a.paused?'paused':'native',goal:null,resolvedGoal:null,lastResolvedGoal:null,angles:{},trace:traceReport(),
   jointCount:h.joints.length,bodyVersion:api.version,bindingUnchanged:true,poseAuthority:'MotionLabPose.commit'};}};
 bindCurrent();return api.jointControl;
}};
