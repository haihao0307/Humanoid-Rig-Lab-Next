import {createInheritedHumanCore} from './inherited-core.mjs';

// Surface-only bridge. Motion and contact states are exclusively committed by
// the inherited Agent -> NaturalLocomotion -> MotionLabPose kernel.
export function createSubjectRuntime(reference, supportProbes, log=()=>{}) {
 const core=createInheritedHumanCore(reference), state=core.build(undefined,log), {h,w,a}=state;
 const palette=new Float32Array(h.joints.length*8);
 const source=h.sourceBind;
 function transforms(frames=null){
  return h.joints.map(j=>{
   const f=frames?frames.get(j.id):j.world,s=source.get(j.id);
   const q=core.qm(f.q,core.inv(s.q)),rp=core.rotate(q,s.p),t=f.p.map((v,k)=>v-rp[k]);
   const d=core.qm([...t,0],q).map(v=>v*.5);
   return {q,d};
  });
 }
 const support={
  // Same DQS palette and same selected-surface support protocol as CompactWorkbench.
  // No original-body muscle warp is applied to this different source surface.
  minimumSupportY(frames=null,jointIds=null){
   const ts=transforms(frames);let y=Infinity,boneId=null,sampleCount=0;
   for(const probe of supportProbes){
    const id=h.joints[probe.influences[0][0]].id;
    if(jointIds&&!jointIds.has(id))continue;
    sampleCount++;const p=core.r2DeformPoint(probe.p,probe.influences,ts);
    if(p[1]<y){y=p[1];boneId=id;}
   }
   return {y,boneId,sampled:true,sampleCount,fullCollisionCertificate:false};
  }
 };
 h.tissue.surface=support;
 const surfaceMinimum=support.minimumSupportY();
 // Neutral stand must be solved again now that actual skin support exists.
 h.pose();
 function updatePalette(){const ts=transforms();for(let i=0;i<ts.length;i++){palette.set(ts[i].q,8*i);palette.set(ts[i].d,8*i+4);}return palette;}
 function advance(dt){const before=a.time;a.tick(dt);h.tissue.update(a.time,a.time-before);updatePalette();return report();}
 function report(){const d=h.diagnostics();return{phase:a.phase,posture:a.basic?.posture,busy:!!(a.plan||a.skill||a.basic?.busy||a.preflightWaiting),paused:a.paused,error:a.error,position:[...a.pos],yaw:a.yaw,joints:h.joints.length,maxBoneLengthErrorM:d.maxBoneLengthErrorM,maxFootTargetErrorM:d.maxFootTargetErrorM,source:a.h.lastMotionSource||null,poseAuthority:'inherited MotionLabPose.commit',preflight:a.preflight};}
 const api={core,h,w,a,palette,transforms,updatePalette,support,advance,report,submit(text){return a.submit(text,{cooperative:true});}};
 updatePalette();return api;
}
