/* Read-only observation of the body's final constrained pose. Never writes joints. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JarvisJointControl=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x));
 function angle(a,b){if(!a||!b||a.length!==4||b.length!==4||![...a,...b].every(Number.isFinite))return null;
  const n=Math.hypot(...a)*Math.hypot(...b);if(n<1e-12)return null;
  const d=Math.min(1,Math.abs(a.reduce((s,x,i)=>s+x*b[i],0)/n));return 2*Math.acos(d)*180/Math.PI;}
 function chain(id){if(/^left_/.test(id))return /hip|femur|tibia|knee|foot|ankle|patella|metatarsal|toe/.test(id)?'左腿':'左臂';if(/^right_/.test(id))return /hip|femur|tibia|knee|foot|ankle|patella|metatarsal|toe/.test(id)?'右腿':'右臂';return /head|mandible|^C/.test(id)?'头颈':'躯干';}
 class Telemetry{
  constructor(api){this.api=api;this.before=new Map();this.previous=new Map();this.peak=new Map();this.ticket=null;this.latest=null;this.frames=0;this.boundHuman=null;this.boundAgent=null;this.rebind();}
  rebind(){const a=this.api();if(this.boundHuman===a.human&&this.boundAgent===a.agent)return;
   this.boundHuman=a.human;this.boundAgent=a.agent;this.before.clear();this.previous.clear();this.peak.clear();this.ticket=null;this.latest=null;this.frames=0;this.cachedContract=this.contract();}
  get contractValue(){this.rebind();return this.cachedContract;}
  contract(){const a=this.api(),h=a.human;return{schema:'jarvis/human_control_contract@1.0',bodyId:'humanoid',bodyVersion:a.version,poseAuthority:'MotionLabPose.commit',units:'metre',rotation:'local_xyzw_quaternion',jointIds:h.joints.map(j=>j.id),jointCount:h.joints.length,hierarchy:h.joints.map(j=>({id:j.id,parentId:j.parent?.id||null,bindLocalPosition:[...j.bind]})),forbiddenWrites:['bindLocalPosition','boneLength','parentId','scale','geometry','material'],directAngleCommands:a.jointControl?.supportsDirectGoals===true,angleContract:a.jointControl?.supportsDirectGoals===true?'jarvis/joint_goal@1.1':null,forceDynamics:false};}
  begin(ticket,step){this.rebind();this.ticket={ticketId:ticket.ticketId,inputId:ticket.inputId||null,planId:ticket.planId,stepId:ticket.stepId,generation:ticket.generation,step:copy(step),goal:{schema:'jarvis/motion_goal@1.0',type:step.type,objectId:step.objectId||null,targetId:step.targetId||null,relation:step.relation||null,referenceFrame:step.referenceFrame||'world',duration:step.duration||null,solverOwner:'MotionLabPose.commit',fixedBoneLengths:true,hardJointROM:false,kinematicJointValidation:true}};this.before.clear();this.peak.clear();this.frames=0;for(const j of this.api().human.joints)this.before.set(j.id,[...j.q]);return this.sample(true);}
  sample(full=false){this.rebind();const a=this.api(),h=a.human;this.frames++;
   const joints=h.joints.map(j=>{const previous=this.previous.get(j.id)||j.q,start=this.before.get(j.id)||j.q,delta=angle(previous,j.q),fromStart=angle(start,j.q),fromBind=angle(j.bindQ||[0,0,0,1],j.q);this.previous.set(j.id,[...j.q]);this.peak.set(j.id,Math.max(this.peak.get(j.id)||0,fromStart||0));return{id:j.id,chain:chain(j.id),parentId:j.parent?.id||null,localRotation:[...j.q],worldPosition:[...j.world.p],deltaDeg:delta,fromBindDeg:fromBind,peakFromStepStartDeg:this.peak.get(j.id),finite:delta!==null&&[...j.world.p].every(Number.isFinite)};});
   const moved=joints.filter(j=>j.peakFromStepStartDeg>.25),currentlyMoving=joints.filter(j=>(j.deltaDeg||0)>.05),d=h.diagnostics();
   this.latest={schema:'jarvis/joint_control_feedback@1.0',timestamp:Date.now(),kind:'measured_final_pose',ticket:copy(this.ticket),sampleCount:this.frames,phase:a.agent.phase,paused:a.agent.paused,rootPosition:[...a.agent.pos],yaw:a.agent.yaw,totalJoints:joints.length,movedJointCount:moved.length,movingJointCount:currentlyMoving.length,activeChains:[...new Set(moved.map(j=>j.chain))],allFinite:joints.every(j=>j.finite),maxBoneLengthErrorM:d.maxBoneLengthErrorM,hardViolationCount:d.jointConstraints?.hardViolationCount??null,poseAuthority:d.poseAuthority,effectorTargets:copy(h.lastErrors||[]),joints};
   return this.view(full);
  }
  view(full=false){this.rebind();if(!this.latest)return null;const value=copy(this.latest);if(!full)value.joints.sort((a,b)=>b.peakFromStepStartDeg-a.peakFromStepStartDeg),value.joints=value.joints.slice(0,16);return value;}
 }
 return{Telemetry,angle,chain};
});
