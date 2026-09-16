// CHICKEN_R100_MANUAL_STEP_PATCH
// Adds deterministic, synchronous stepping for technical QA and reproducible
// review captures. It does not change the production controller state machine.
(function installChickenR100ManualStep(){
 let attempts=0;
 const timer=setInterval(()=>{
  attempts++;
  const base=window.__CHICKEN_PHASE1_MOTION__;
  const runtime=__phase1Runtime;
  if(!base||!runtime?.controller||!runtime?.skin){
   if(attempts>1200)clearInterval(timer);
   return;
  }

  const controller=runtime.controller;
  const originalUpdate=controller.update.bind(controller);
  runtime.manualQaPause=false;
  runtime.manualQaStepping=false;
  controller.update=(dt,ctx)=>{
   if(runtime.manualQaPause&&!runtime.manualQaStepping){
    return runtime.lastPose||originalUpdate(dt,ctx);
   }
   return originalUpdate(dt,ctx);
  };

  const pauseRealtime=(value=true)=>{
   runtime.manualQaPause=!!value;
   return runtime.manualQaPause;
  };

  const reset=({yaw=0,clearObserved=false}={})=>{
   controller.position=[0,runtime.variant.collision.hipHeight,0];
   controller.velocity=[0,0,0];
   controller.yaw=yaw;
   controller.yawRate=0;
   controller.speed=0;
   controller.state=runtime.modules.controllerModule.ChickenNpcState.IDLE;
   controller.stateTime=0;
   controller.intent={type:'idle'};
   controller.intentTime=0;
   controller.gaitPhase=runtime.variant.locomotion.phaseOffset;
   controller.blockedTime=0;
   controller.detourSign=1;
   controller.taskComplete=false;
   controller.events=[];
   controller.lastContacts={leftFoot:true,rightFoot:true,bill:false};
   if(clearObserved)runtime.observedStates=new Set();
   runtime.lastPose=null;
   runtime.lastApply=null;
   runtime.manualWingUntil=0;
   runtime.action='idle';
   runtime.manualQaStepping=true;
   const pose=originalUpdate(1/60,{groundHeight:0,obstacles:[]});
   runtime.manualQaStepping=false;
   runtime.lastPose=pose;
   runtime.observedStates.add(pose.state);
   runtime.lastApply=runtime.skin.applyPose(pose);
   requestRender();
   return pose;
  };

  const stepFrames=(count=1,dt=1/60)=>{
   count=Math.max(1,Math.min(600,Math.trunc(count)||1));
   dt=Math.max(1/240,Math.min(1/15,Number(dt)||1/60));
   let pose=null;
   runtime.manualQaStepping=true;
   try{
    for(let frame=0;frame<count;frame++){
     pose=originalUpdate(dt,{groundHeight:0,obstacles:[]});
     if(runtime.action==='wing'){
      const phase=count<=1?1:Math.sin(Math.PI*(frame+1)/(count+1));
      pose.wings.leftOpen=Math.max(pose.wings.leftOpen,.72+.22*phase);
      pose.wings.rightOpen=Math.max(pose.wings.rightOpen,.72+.22*phase);
     }
     runtime.lastPose=pose;
     runtime.observedStates.add(pose.state);
     runtime.lastApply=runtime.skin.applyPose(pose);
    }
   }finally{
    runtime.manualQaStepping=false;
   }
   requestRender();
   return pose;
  };

  const runAction=(name,{frames=1,dt=1/60,resetFirst=true}={})=>{
   if(resetFirst)reset();
   base.setAction(name);
   runtime.action=name;
   return stepFrames(frames,dt);
  };

  const enhanced=Object.freeze({
   get ready(){return base.ready},
   setAction:base.setAction,
   toggleAuto:base.toggleAuto,
   setAuto:base.setAuto,
   pauseRealtime,
   reset,
   stepFrames,
   runAction,
   diagnostics(){
    return{
     ...base.diagnostics(),
     manualStepAvailable:true,
     manualStepPatch:'manual-step-1.1',
     realtimePaused:runtime.manualQaPause
    };
   }
  });
  window.__CHICKEN_PHASE1_MOTION__=enhanced;
  window.__CHICKEN_R100_MANUAL_STEP__=Object.freeze({version:'1.1',pauseRealtime,reset,stepFrames,runAction});
  clearInterval(timer);
 },25);
})();
