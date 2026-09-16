// Parse sources and validate reference parameters only; never instantiate Human.
export function checkR2RigMotionSources({read,runtime,assert}){
 let checks=0;const check=(ok,message)=>{assert(ok,'R2 rig/motion file contract: '+message);checks++;};
 const rig=JSON.parse(read('reconstruction/rig-reference.json')),regions=JSON.parse(read('reconstruction/binding-schema.json'));
 const motion=JSON.parse(read('reconstruction/motion-reference.json')),nodes=Object.entries(rig.nodes),seen=new Set();
 check(rig.schema==='r2/source_derived_rig@1'&&nodes.length===128,'one 128-node source rig');
 check(rig.functionalCalibration===false&&rig.subjectSpecificMotionAvailable===false,'source estimates remain uncalibrated');
 check(/^[a-f0-9]{64}$/.test(rig.source.sourceFileSHA256)&&/^[a-f0-9]{64}$/.test(rig.source.sourceSurfaceManifestSHA256),'source surface and bone locks');
 for(const [id,n]of nodes){
  check(!seen.has(id)&&(!n.parent||seen.has(n.parent)),'unique parent-first joint: '+id);seen.add(id);
  check(n.positionM.length===3&&n.positionM.every(Number.isFinite),'finite metric position: '+id);
  check(n.sourcePartIds.length>0&&n.sourcePartIds.every(id=>/^FJ\d+$/.test(id))&&typeof n.method==='string','traceable estimator: '+id);
  if(n.target)check(Object.hasOwn(rig.nodes,n.target),'existing segment target: '+id);
  if(n.tipM)check(n.tipM.length===3&&n.tipM.every(Number.isFinite),'finite terminal target: '+id);
 }
 for(const side of ['left','right']){
  const sign=side==='left'?-1:1;
  for(const id of ['upperArm','forearm','hand','femur','tibia','foot'])check(rig.nodes[side+'_'+id].positionM[0]*sign>0,'left/right convention: '+side+'_'+id);
  for(const [a,b]of [['upperArm','forearm'],['forearm','hand'],['femur','tibia'],['tibia','foot']]){
   const A=rig.nodes[side+'_'+a].positionM,B=rig.nodes[side+'_'+b].positionM,L=Math.hypot(...A.map((v,k)=>v-B[k]));check(L>.15&&L<.55,'finite source limb length');
  }
 }
 for(const s of Object.values(rig.sphereFits))check(s.radiusM>.01&&s.radiusM<.04&&s.sampleCount>10&&s.radialRmsM>=0&&s.anatomicalCentreErrorM===null,'sphere residual is not anatomical accuracy');
 check(regions.schema==='r2/anatomical_surface_regions@1'&&regions.regions.left_arm===16&&regions.regions.right_arm===32,'distinct source arm domains');
 check(regions.regions.proximal_thigh_and_pelvic_interface===(regions.regions.pelvis|regions.regions.left_lower_limb),'left pelvis seam membership');
 check(regions.regions.right_ankle_collar===(regions.regions.right_lower_limb|regions.regions.right_foot_toes),'right ankle seam membership');
 check(motion.schema==='r2/public_motion_reference@1'&&motion.containsSurfaceVertices===false&&motion.visualAcceptance===false,'motion parameters only');
 check(Object.keys(motion.clips).join(',')==='walk,standToSit,sitToLie,lieToSit,sitToStand,wave','all installed capture intervals');
 check(motion.source.locks.every(l=>/^https:\/\/mocap.cs.cmu.edu\/subjects\/\d+\/\d+(?:_\d+)?\.(asf|amc)$/.test(l.url)&&/^[a-f0-9]{64}$/.test(l.sha256)&&l.bytes>0),'pinned public source files');
 let samples=0;const channels=['rootOffset','rootHeightRatio','rootQ','lumbarQ','thoraxQ','cervicalQ','headQ',...['left','right'].flatMap(s=>['UpperArm','Forearm','Thigh','Shank','UpperArmQ','ForearmQ','ThighQ','ShankQ','HandQ','FootQ','ClavicleQ','AnkleHeightRatio'].map(k=>s+k))];
 for(const [id,c]of Object.entries(motion.clips)){
  const rows=c.sampleBlocks.flat();samples+=rows.length;
  check(rows.length===c.sampleCount&&rows.length>2&&c.sampleBlocks.every(b=>b.length<=96),'bounded capture samples: '+id);
  check(c.sourceSampleRateHz===120&&Math.abs(c.durationS-(c.sourceFrameEnd-c.sourceFrameStart)/120)<1e-8,'capture timing: '+id);
  check(rows[0].t===0&&rows.at(-1).t===1&&rows.every((r,i)=>i===0||r.t>rows[i-1].t),'monotone source times: '+id);
  check(c.sourceSkeletonSweepXZLegLengths.length===2&&c.sourceSkeletonSweepXZLegLengths.every(b=>b.length===2&&b.every(Number.isFinite)&&b[0]<b[1]),'source skeletal sweep: '+id);
  check(c.posedSurfaceError===null&&c.parameterInterpolationError.maxQuaternionDegrees<=.351&&c.parameterInterpolationError.maxDirectionDegrees<=.351&&c.parameterInterpolationError.maxRootOffsetLegLengths<=.00101,'recorded interpolation bounds: '+id);
  for(const r of rows){
   check(channels.every(k=>Object.hasOwn(r,k))&&Object.keys(r).length===channels.length+1,'complete capture record');
   for(const key of channels){const v=r[key];
    if(Array.isArray(v))check(v.every(Number.isFinite)&&v.length===(key.endsWith('Q')?4:3)&&(key==='rootOffset'||Math.abs(Math.hypot(...v)-1)<1e-5),'finite normalized capture channel: '+key);
    else check(Number.isFinite(v),'finite scalar capture channel');
   }
  }
 }
 const body=read('body/ReconstructionRig.js'),binding=read('reconstruction/binding.mjs'),ref=read('body/ReferenceMotion.js'),gait=read('body/NaturalLocomotion.js'),surface=read('body/CompactWorkbench.js');
 check(/h\.canonicalSourceBind=r2SourceFrames\(\);h\.sourceBind=r2SourceFrames\(reference\)/.test(body)&&/const reference=h\.resolvedRig/.test(body)&&/j\.sourceRestQ=j\.q\.slice\(\)/.test(body),'canonical and personal rest frames come from their corresponding source rigs');
 check(/buildReconstructionRig\(this\)/.test(runtime)&&!/ProceduralTissue|buildConnectedHumanSurface|makeState\(kind|BODY_ARCHETYPES|AdultHumanSpec/.test(runtime),'legacy body construction is absent');
 check(/regionMasks instanceof Uint16Array/.test(binding)&&/mesh\.regionMasks\[i\]/.test(binding),'source membership is required for every display vertex');
 check(/function\s+compactInfluences\(\s*p,\s*rig,\s*mask,\s*ownership,\s*shoulderTransition\s*=\s*null\s*\)/.test(binding)&&/compactInfluences\(\s*p,\s*rig,\s*mask,\s*ownership,\s*shoulder\s*\)/.test(binding),'binding priors receive explicit anatomical ownership and the optional source-surface shoulder transition');
 check(/COMPACT_INFLUENCES\s*=\s*8/.test(binding)&&/COMPACT_WEIGHT_SCALE\s*-\s*quant\.reduce/.test(binding)&&/quant\[order\[k\]\[0\]\]\+\+/.test(binding),'eight influences retain exact quantized normalization');
 check(/this\.controlBind=lab\.human\.sourceBind/.test(surface)&&/t=sub\(j\.world\.p,rotate\(q,source\.p\)\)/.test(surface),'shared source-to-current palette');
 check(/new MotionLab\.MotionController/.test(gait)&&!/r2SampleMotion\('walk'|supportFeet|pelvisYawRad/.test(gait),'the old gait implementation is replaced by the pinned lab controller');
 check(/r2ReferenceDescriptor\(a\.h,current\.clip/.test(runtime)&&/r2StandingGestureDescriptor\(a\.h,g,a\.yaw,weight\)/.test(runtime)&&/r2ReferenceDescriptor\(h,'wave'/.test(ref)&&/desc\.controlledFeet=true/.test(ref),'floor transitions and planted standing gestures reach Human.pose');
 const forecast=read('control/PlanForecast.js');
 check(forecast.includes('motionFloorEnvelopes=new WeakMap()')&&forecast.includes('motionFloorEnvelopes.get(h)')&&forecast.includes('new MotionLab.FullBodyMotion(h.resolvedRig.nodes)'),'floor preflight owns a per-human envelope of the personal skeleton');
 check(forecast.includes('for(const row of clip.samples)')&&forecast.includes('motionBodyPartRadius(h,joint)')&&forecast.includes('p[k]-radius')&&forecast.includes('p[k]+radius')&&!forecast.includes('sourceSkeletonSweepXZLegLengths'),'personal floor envelope resolves all captured samples and part clearances instead of uniformly scaling source sweep bounds');
 check(forecast.includes('floorClipEnvelope(h,id)')&&forecast.includes('envelope.endOffset[1]=0')&&forecast.includes('offset=add(offset,endOffset)'),'floor forecast consumes each personal envelope with accumulated planar root displacement');
 check(/r2PostureClips\(this\.posture,t\.target\)/.test(runtime)&&/r2PostureClips\(from,target\)/.test(read('control/PlanForecast.js')),'forecast and executor share interval order');
 check(/r2RequireMotion\(step\.type\)/.test(read('control/PlanForecast.js'))&&/R2_UNSOURCED_ACTIONS/.test(ref),'unsupported action gate precedes execution');
 check(/softTissueMotionMeasured:false/.test(ref)&&/measuredSoftTissueDeformation:false/.test(read('body/ReconstructionState.js')),'no measured soft-tissue claim');
 return {checks,joints:nodes.length,sourceRegions:Object.keys(regions.regions).length,motionClips:Object.keys(motion.clips).length,motionSamples:samples,functionalCalibration:false,applicationExecuted:false,visualAcceptance:false};
}
