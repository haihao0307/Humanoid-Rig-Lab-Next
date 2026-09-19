/* Read-only convergence state for the motion pipeline.
 *
 * This object mirrors intent, desired-pose metadata, support/contact evidence
 * and the committed final-pose report. It never writes the motion kernel,
 * skeleton, task queue, physics world, skin or clothing. The first revision
 * exists to make ownership and rollback explicit without changing motion.
 */
const MOTION_RUNTIME_STATE_CONTRACT=Object.freeze({
 schema:'human/motion-runtime-state@1',
 revision:'motion-runtime-state-r1',
 pipeline:['MotionIntent','DesiredPose','Contact/IK','JointLimits','Balance/Load','FinalPose','Skin/Clothing/Collision']
});
function motionRuntimeFinite(value,fallback=null){return Number.isFinite(value)?value:fallback;}
function motionRuntimeVec3(value){return Array.isArray(value)&&value.length===3&&value.every(Number.isFinite)?[...value]:null;}
function motionRuntimeClone(value){return value==null?value:structuredClone(value);}
function motionRuntimeObjectId(value){return value?.id??value?.objectId??value?.targetId??null;}
class MotionRuntimeState{
 constructor(agent){this.a=agent;this.reset();}
 reset(){
  const a=this.a,root=motionRuntimeVec3(a?.locomotion?.engine?.state?.root)||motionRuntimeVec3(a?.pos)||[0,0,0];
  this.sequence=0;this.intentSequence=0;this.lastRoot=[...root];
  this.intent={type:'idle',targetPositionM:null,targetYawRad:null,requestedAtS:motionRuntimeFinite(a?.time,0),activityPhase:a?.phase||'idle',interactionObjectId:null,heldObjectId:motionRuntimeObjectId(a?.held)};
  this.desiredPose={status:'idle',source:'motion-lab',sourcePhase:0,blend:0,swingSide:null};
  this.support={feet:{left:null,right:null},activeFootCount:0,floorPalm:null,floorSeat:null,floorFoot:null,heldObjectId:motionRuntimeObjectId(a?.held)};
  this.contact={footErrorM:0,handErrorM:0,boneErrorM:0,attachmentErrorM:0,groundY:null,groundCorrectionM:0,blockedReason:null,fault:null};
  this.finalPose={authority:null,committed:false,completeHierarchy:false,validatedAfterClearance:false,worldContactTargetsPreserved:false};
  this.telemetry={sequence:0,observedAtS:motionRuntimeFinite(a?.time,0),dtS:0,rootPositionM:[...root],rootVelocityMps:[0,0,0],actualSpeedMps:0,yawRad:motionRuntimeFinite(a?.yaw,0),activityPhase:a?.phase||'idle',kernelStatus:'idle',tempo:1,kinematicOnly:true,measuredForces:false,visualAcceptance:false};
 }
 setIntent(command,state=null,tempo=1){
  const a=this.a,type=command?.type||'idle';this.intentSequence++;
  this.intent={type,targetPositionM:motionRuntimeVec3(command?.target),targetYawRad:motionRuntimeFinite(command?.yaw,null),requestedAtS:motionRuntimeFinite(a?.time,0),activityPhase:a?.phase||type,
   interactionObjectId:a?.skill?.targetId??a?.skill?.objectId??motionRuntimeObjectId(a?.skill?.o),heldObjectId:motionRuntimeObjectId(a?.held),kernelStatus:state?.status||null,tempo:motionRuntimeFinite(tempo,1),sequence:this.intentSequence};
  return this.report();
 }
 readPoseEvidence(){
  const pose=this.a?.h?.motionDriver?.report?.()||null;
  const support={floorPalm:motionRuntimeClone(pose?.floorSupport)||null,floorSeat:motionRuntimeClone(pose?.floorSeat)||null,floorFoot:motionRuntimeClone(pose?.floorFoot)||null};
  const contact={footErrorM:motionRuntimeFinite(pose?.footErrorM,0),handErrorM:motionRuntimeFinite(pose?.handErrorM,0),boneErrorM:motionRuntimeFinite(pose?.boneErrorM,0),attachmentErrorM:motionRuntimeFinite(pose?.attachmentErrorM,0),groundY:motionRuntimeFinite(pose?.ground?.y,null),groundCorrectionM:motionRuntimeFinite(pose?.groundCorrectionM,0)};
  const finalPose={authority:pose?.poseAuthority||null,committed:pose?.poseAuthority==='MotionLabPose.commit',completeHierarchy:pose?.completeHierarchy===true,validatedAfterClearance:pose?.validatedAfterClearance===true,worldContactTargetsPreserved:pose?.worldContactTargetsPreserved===true};
  return{support,contact,finalPose};
 }
 observe(locomotion,dt=0){
  const a=this.a,state=locomotion?.engine?.state||{},root=motionRuntimeVec3(state.root)||motionRuntimeVec3(a?.pos)||[0,0,0],step=Number.isFinite(dt)&&dt>0?dt:0;
  const velocity=step&&this.lastRoot?root.map((value,index)=>(value-this.lastRoot[index])/step):[0,0,0];
  const feet={};let activeFootCount=0;
  for(const side of ['left','right']){
   const foot=state.feet?.[side];if(!foot){feet[side]=null;continue;}
   const contact=foot.contact!==false;if(contact)activeFootCount++;
   feet[side]={contact,mode:contact?'planted':'swing',anchorM:motionRuntimeVec3(foot.rocker?.world)||motionRuntimeVec3(foot.position),ankleM:motionRuntimeVec3(foot.rocker?.ankle),yawRad:motionRuntimeFinite(foot.yaw,null),rockerKind:foot.rocker?.kind||'sole',rockerPitchRad:motionRuntimeFinite(foot.rocker?.pitch,0),adoptedOrientation:!!foot.adoptedOrientation};
  }
  const pose=this.readPoseEvidence();this.sequence++;
  this.desiredPose={status:state.status||'idle',source:state.motion?.frame?'motion-frame':'motion-lab',sourcePhase:motionRuntimeFinite(state.motion?.phase,0),blend:motionRuntimeFinite(state.motion?.weight,0),swingSide:state.swing?.side||null,commandType:state.command?.type||null};
  this.support={feet,activeFootCount,...pose.support,heldObjectId:motionRuntimeObjectId(a?.held)};
  this.contact={...this.contact,...pose.contact,blockedReason:state.status==='blocked'?(locomotion?.traffic?.reason||'blocked'):locomotion?.traffic?.lastError||null,fault:state.fault||null};
  this.finalPose=pose.finalPose;
  this.telemetry={sequence:this.sequence,observedAtS:motionRuntimeFinite(a?.time,0),dtS:step,rootPositionM:[...root],rootVelocityMps:velocity,actualSpeedMps:motionRuntimeFinite(locomotion?.speed,motionRuntimeFinite(state.speed,0)),yawRad:motionRuntimeFinite(state.yaw,motionRuntimeFinite(a?.yaw,0)),activityPhase:a?.phase||state.status||'idle',kernelStatus:state.status||'idle',tempo:motionRuntimeFinite(locomotion?.tempo,1),kinematicOnly:true,measuredForces:false,visualAcceptance:false};
  this.lastRoot=[...root];return this.report();
 }
 snapshot(){const {a,...state}=this;return structuredClone(state);}
 restore(saved){
  if(!saved||typeof saved!=='object')throw Error('动作运行状态快照无效');
  const clone=structuredClone(saved),agent=this.a;Object.assign(this,clone);this.a=agent;
  if(!Array.isArray(this.lastRoot)||this.lastRoot.length!==3)this.lastRoot=motionRuntimeVec3(agent?.pos)||[0,0,0];
  return this.report();
 }
 report(){
  const pose=this.readPoseEvidence(),support={...motionRuntimeClone(this.support),...pose.support},contact={...motionRuntimeClone(this.contact),...pose.contact},finalPose={...motionRuntimeClone(this.finalPose),...pose.finalPose};
  return{schema:MOTION_RUNTIME_STATE_CONTRACT.schema,revision:MOTION_RUNTIME_STATE_CONTRACT.revision,pipeline:[...MOTION_RUNTIME_STATE_CONTRACT.pipeline],intent:motionRuntimeClone(this.intent),desiredPose:motionRuntimeClone(this.desiredPose),support,contact,finalPose,telemetry:motionRuntimeClone(this.telemetry),kinematicOnly:true,measuredForces:false,fullDynamics:false,visualAcceptance:false};
 }
}
