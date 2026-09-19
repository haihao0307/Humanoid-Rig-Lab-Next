/* Bounded start/stop transition for the kinematic Human Core.
 *
 * The pinned Motion-Lab controller remains the locomotion authority. This
 * adapter adds a short double-support preparation before a new walk, mirrors
 * the preparation into the final pose without moving either foot anchor,
 * shortens only terminal placement steps and gives in-place turns a stable
 * outside-foot preference. It is not a COM or inverse-dynamics solver. */
const GAIT_TRANSITION_FEEDBACK=Object.freeze({
 revision:'gait-transition-r1',startPreparationS:.14,firstReleaseM:.045,
 terminalDistanceM:.34,minimumTerminalScale:.28,
 maximumPelvisShiftM:.016,loadedMaximumPelvisShiftM:.008
});
function gaitTransitionFresh(){return{
 revision:GAIT_TRANSITION_FEEDBACK.revision,phase:'idle',elapsedS:0,durationS:GAIT_TRANSITION_FEEDBACK.startPreparationS,
 prepared:false,firstReleaseM:GAIT_TRANSITION_FEEDBACK.firstReleaseM,terminalDistanceM:GAIT_TRANSITION_FEEDBACK.terminalDistanceM,
 minimumTerminalScale:GAIT_TRANSITION_FEEDBACK.minimumTerminalScale,startStep:0,startRoot:null,target:null,supportSide:null,steppingSide:null,
 poseOffsetXM:0,maximumPoseOffsetM:0,firstSwingRootTravelM:null,minimumObservedTerminalScale:1,turnOutsideFoot:null,active:false,
 calibrated:false,fullDynamics:false,visualAcceptance:false
};}
function gaitTransitionRouteTarget(locomotion){const a=locomotion.a;return a.route?.[a.routeIndex]||null;}
function gaitTransitionSameTarget(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===3&&b.length===3&&dist(a,b)<.02;}
function gaitTransitionUpdateSignal(locomotion){
 const g=locomotion.gaitTransition,s=locomotion.engine.state;
 if(!g){return;}
 let amount=0;
 if(g.phase==='preparing')amount=smooth(clamp(g.elapsedS/Math.max(1e-8,g.durationS),0,1));
 else if(g.phase==='release')amount=1;
 else if(g.phase==='first-swing'){
  const swing=s.swing,u=swing?clamp(swing.elapsed/Math.max(1e-8,swing.duration*.62),0,1):1;amount=1-smooth(u);
 }
 const support=g.supportSide&&s.feet[g.supportSide];
 if(amount>0&&support){
  const local=rotate(inv(qy(s.yaw)),sub(support.position,s.root));
  const limit=locomotion.a.held?GAIT_TRANSITION_FEEDBACK.loadedMaximumPelvisShiftM:GAIT_TRANSITION_FEEDBACK.maximumPelvisShiftM;
  g.poseOffsetXM=clamp(local[0]*.42,-limit,limit)*amount;
 }else g.poseOffsetXM=0;
 g.maximumPoseOffsetM=Math.max(g.maximumPoseOffsetM,Math.abs(g.poseOffsetXM));g.active=Math.abs(g.poseOffsetXM)>1e-6;
 locomotion.a.h.__gaitTransitionFeedback=g;
}
(function installGaitTransitionFeedback(){
 if(NaturalLocomotion.prototype.__gaitTransitionR1)return;
 const move=NaturalLocomotion.prototype.move,update=NaturalLocomotion.prototype.update,stop=NaturalLocomotion.prototype.stop,
  turnInPlace=NaturalLocomotion.prototype.turnInPlace,resetFromPose=NaturalLocomotion.prototype.resetFromPose,
  snapshotExecution=NaturalLocomotion.prototype.snapshotExecution,restoreExecution=NaturalLocomotion.prototype.restoreExecution,
  report=NaturalLocomotion.prototype.report;
 NaturalLocomotion.prototype.resetGaitTransition=function(){
  this.gaitTransition=gaitTransitionFresh();this.a.h.__gaitTransitionFeedback=this.gaitTransition;return this.gaitTransition;
 };
 NaturalLocomotion.prototype.snapshotExecution=function(){return{...snapshotExecution.call(this),gaitTransition:structuredClone(this.gaitTransition||gaitTransitionFresh())};};
 NaturalLocomotion.prototype.restoreExecution=function(saved){
  const {gaitTransition,...state}=saved;restoreExecution.call(this,state);this.gaitTransition=structuredClone(gaitTransition||gaitTransitionFresh());
  this.a.h.__gaitTransitionFeedback=this.gaitTransition;
 };
 NaturalLocomotion.prototype.resetFromPose=function(options){
  const value=resetFromPose.call(this,options);this.resetGaitTransition();return value;
 };
 NaturalLocomotion.prototype.move=function(dt,speed=.48){
  const a=this.a,s=this.engine.state,target=gaitTransitionRouteTarget(this);this.gaitTransition??=gaitTransitionFresh();const g=this.gaitTransition;
  if(g.phase==='preparing'&&!gaitTransitionSameTarget(g.target,target))this.resetGaitTransition();
  if(g.phase==='idle'&&target&&horizontal(s.root,target)>.03&&this.kernelSettled()&&!s.command){
   const stepping=s.nextFoot||'left',support=stepping==='left'?'right':'left';Object.assign(g,{phase:'preparing',elapsedS:0,durationS:a.held?.10:GAIT_TRANSITION_FEEDBACK.startPreparationS,
    prepared:false,startStep:s.metrics.steps,startRoot:[...s.root],target:[...target],steppingSide:stepping,supportSide:support,poseOffsetXM:0,
    maximumPoseOffsetM:0,firstSwingRootTravelM:null,minimumObservedTerminalScale:1,active:true});
  }
  if(g.phase==='preparing'){
   const pace=clamp((a.strength?.movementFactor?.()??1)*(a.manipulationPace?.()??1),.05,1);g.elapsedS+=dt*pace;
   this.tempo=clamp(speed/.48*pace,.05,1);this.requested=true;gaitTransitionUpdateSignal(this);
   if(g.elapsedS+1e-9<g.durationS)return true;
   g.phase='release';g.prepared=true;
  }
  const value=move.call(this,dt,speed);gaitTransitionUpdateSignal(this);return value;
 };
 NaturalLocomotion.prototype.update=function(dt,...args){
  this.gaitTransition??=gaitTransitionFresh();gaitTransitionUpdateSignal(this);const value=update.call(this,dt,...args),g=this.gaitTransition,s=this.engine.state;
  if(g.phase==='release'&&s.swing){g.phase='first-swing';g.steppingSide=s.swing.side;
   if(g.startRoot)g.firstSwingRootTravelM=horizontal(g.startRoot,s.root);}
  if(s.swing&&Number.isFinite(s.swing.terminalScale))g.minimumObservedTerminalScale=Math.min(g.minimumObservedTerminalScale,s.swing.terminalScale);
  if(g.phase==='first-swing'&&s.metrics.steps>g.startStep&&!s.swing)g.phase='cruising';
  if((g.phase==='cruising'||g.phase==='release'||g.phase==='first-swing')&&this.kernelSettled()&&!gaitTransitionRouteTarget(this))this.resetGaitTransition();
  gaitTransitionUpdateSignal(this);return value;
 };
 NaturalLocomotion.prototype.stop=function(){
  if(this.gaitTransition?.phase==='preparing'){this.resetGaitTransition();this.requested=true;return;}
  return stop.call(this);
 };
 NaturalLocomotion.prototype.turnInPlace=function(yaw,dt){
  this.gaitTransition??=gaitTransitionFresh();const s=this.engine.state,error=angleDiff(yaw,s.yaw);
  if(this.kernelSettled()&&!s.command&&Math.abs(error)>.08){const outside=error>0?'left':'right';s.nextFoot=outside;this.gaitTransition.turnOutsideFoot=outside;}
  return turnInPlace.call(this,yaw,dt);
 };
 NaturalLocomotion.prototype.report=function(){return{...report.call(this),gaitTransition:structuredClone(this.gaitTransition||gaitTransitionFresh())};};
 NaturalLocomotion.prototype.__gaitTransitionR1=true;

 const prepare=MotionLabPose.prototype.prepare;
 MotionLabPose.prototype.prepare=function(options={}){
  const result=prepare.call(this,options),feedback=this.h.__gaitTransitionFeedback,shift=feedback?.active?feedback.poseOffsetXM:0;
  if(!Number.isFinite(shift)||Math.abs(shift)<1e-7||!result.controlled||options.position||options.feet||options.hands||options.contactHand||options.floorSupport||options.lockedFrames)return result;
  result.state.root=add(result.state.root,rotate(qy(result.yaw),[shift,0,0]));
  result.state.pose=result.state.articulatedPelvis?this.solveControlledState(result.state,result.data):this.engine.solve(result.state);
  result.state.motion={...result.state.motion,frame:result.data,weight:1};return result;
 };
})();
