import {createInheritedHumanCore} from './inherited-core.mjs';
// The only motion authority is the inherited Agent -> MotionLabPose.commit.
// This adapter supplies the new character's surface probes and DQS palette.
export function createSubjectRuntime(reference, supportProbes, log=()=>{}) {
 const core=createInheritedHumanCore(reference),state=core.build(undefined,log),{h,w,a}=state;
 w.bounds={xMin:-12,xMax:12,zMin:-12,zMax:12};
 const palette=new Float32Array(h.joints.length*8),source=h.sourceBind;
 function transforms(frames=null){return h.joints.map(j=>{const f=frames?frames.get(j.id):j.world,s=source.get(j.id),q=core.qm(f.q,core.inv(s.q)),rp=core.rotate(q,s.p),t=f.p.map((v,k)=>v-rp[k]);return{q,d:core.qm([...t,0],q).map(v=>v*.5)};});}
 const support={minimumSupportY(frames=null,jointIds=null){const ts=transforms(frames);let y=Infinity,boneId=null,sampleCount=0;
  for(const probe of supportProbes){const id=h.joints[probe.influences[0][0]].id;if(jointIds&&!jointIds.has(id))continue;sampleCount++;const p=core.r2DeformPoint(probe.p,probe.influences,ts);if(p[1]<y){y=p[1];boneId=id;}}
  return{y,boneId,sampled:true,sampleCount,fullCollisionCertificate:false};}};
 h.tissue.surface=support;
 // Calibrate the ground contact margin from the actual imported soles once.
 // No joint bind, bone length or surface vertex is modified.
 const contactOffsetM=Math.max(0,.002-support.minimumSupportY().y);
 const l=a.locomotion,e=l.engine;
 l.rig.ankleHeight+=contactOffsetM;l.rig.hipHeight+=contactOffsetM;l.standingHipHeightM+=contactOffsetM;
 e.rig.ankleHeight+=contactOffsetM;e.rig.hipHeight+=contactOffsetM;
 e.state.root[1]+=contactOffsetM;for(const s of ['left','right'])e.state.feet[s].position[1]+=contactOffsetM;
 e.state.pose=e.solve(e.state);h.pose();a.pos=[...h.root.p];a.saveSafe();
 h.evidence.externalMeshCount=31;h.evidence.sourceGeometryHash=reference.source.sourceFileSHA256;
 h.evidence.newSurfaceFullyProcedural=false;h.evidence.sourceSurfacePreserved=true;
 function updatePalette(){const ts=transforms();for(let i=0;i<ts.length;i++){palette.set(ts[i].q,8*i);palette.set(ts[i].d,8*i+4);}return palette;}
 function advance(dt){const before=a.time;a.tick(dt);h.tissue.update(a.time,a.time-before);updatePalette();return report();}
 function report(){const d=h.diagnostics();return{phase:a.phase,posture:a.basic?.posture,busy:!!(a.plan||a.skill||a.basic?.busy||a.preflightWaiting),ready:!!a.activity().readyForTask,paused:a.paused,error:a.error,position:[...a.pos],yaw:a.yaw,joints:h.joints.length,maxBoneLengthErrorM:d.maxBoneLengthErrorM,maxFootTargetErrorM:d.maxFootTargetErrorM,completed:a.stats.completed,source:h.lastMotionSource||null,poseAuthority:'inherited MotionLabPose.commit',preflight:a.preflight};}
 updatePalette();return{core,h,w,a,palette,transforms,updatePalette,support,advance,report,submit(text,{cooperative=true}={}){return a.submit(text,{cooperative});}};
}
