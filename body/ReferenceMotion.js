/* Captured skeletal motion, retargeted to each character's fixed bind lengths.
 * Interpolation, contact fitting and transitions are engineering adaptations.
 * These records do not measure skin, muscle bulging or contact compression. */
const R2_MOTION=/*__R2_MOTION_JSON__*/;
const r2MotionClips=new Map(Object.entries(R2_MOTION.clips).map(([id,c])=>[id,{...c,samples:c.sampleBlocks.flat()}]));
const r2CaptureProfiles=new WeakMap();
function r2CaptureConstraintProfile(h,source){
 if(source?.kind!=='capture'||!r2MotionClips.has(source.clip))return null;
 let profiles=r2CaptureProfiles.get(h);if(!profiles){profiles=new Map();r2CaptureProfiles.set(h,profiles);}
 const base=r2RecordedConstraintProfile(h,source.clip,profiles);
 if(!source.transitionHingeDegrees)return base;
 // A recorded gesture is blended from a previously committed stance. Its
 // narrow recording range does not describe that starting stance. Include
 // the known starting angles only for the transition, without changing the
 // cached recording profile or accepting angles measured from the candidate.
 const hingeDegrees={...base.hingeDegrees};
 for(const [id,angle]of Object.entries(source.transitionHingeDegrees)){
  if(!Object.hasOwn(hingeDegrees,id)||!Number.isFinite(angle)||angle<0||angle>180)throw Error('动作过渡关节范围无效');
  const alignment=degrees(qangle(h.byId.get(id).bindQ,qi()));
  hingeDegrees[id]=Math.min(180,Math.max(hingeDegrees[id],angle+alignment+.5));
 }
 return {...base,hingeDegrees,includesCommittedStart:true};
}
function r2RecordedConstraintProfile(h,clipId,profiles){
 if(profiles.has(clipId))return profiles.get(clipId);
 const clip=r2MotionClips.get(clipId),hingeDegrees={};
 // ASF/AMC limits describe other animation tools; they must not clip captured
 // channels a second time. Retargeted hinges use the observed recording range
 // plus the atlas's fixed alignment and coefficient precision allowance.
 for(const side of ['left','right'])for(const [joint,a,b]of [['forearm','UpperArm','Forearm'],['tibia','Thigh','Shank']]){
  const id=side+'_'+joint,alignment=degrees(qangle(h.byId.get(id).bindQ,qi()));
  const observed=Math.max(...clip.samples.map(r=>degrees(Math.acos(clamp(dot(r[side+a],r[side+b]),-1,1)))));
  hingeDegrees[id]=Math.min(180,observed+alignment+.5);
 }
 const result={kind:'capture-range',clip:clipId,hingeDegrees,source:R2_MOTION.source.axisDocumentation,
  genericROMReclipping:false,individualMedicalValidation:false};profiles.set(clipId,result);return result;
}
const R2_UNSOURCED_ACTIONS=Object.freeze([]);
function r2RequireMotion(type){if(!MOTION_ACTIONS[type]&&!['wait','observe'].includes(type))throw Error('当前动作系统未实现：'+type);}
function r2BlendMotion(A,B,t){
 const out={};t=clamp(t,0,1);
 for(const [key,b]of Object.entries(B)){
  const a=A[key]??b;
  if(typeof b==='number')out[key]=a+(b-a)*t;
  else if(key.endsWith('Q')){const end=dot(a,b)<0?mul(b,-1):b;out[key]=qnorm(mix(a,end,t));}
  else if(Array.isArray(b))out[key]=key==='rootOffset'?mix(a,b,t):norm(mix(a,b,t));
 }
 return out;
}
function r2SampleMotion(id,progress){
 const clip=r2MotionClips.get(id);if(!clip)throw Error('未安装动作来源：'+id);
 const rows=clip.samples,t=clamp(progress,0,1);let lo=0,hi=rows.length-1;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid].t<=t)lo=mid;else hi=mid;}
 const A=rows[lo],B=rows[hi],u=(t-A.t)/Math.max(1e-9,B.t-A.t);
 return {...r2BlendMotion(A,B,u),leftHandRelaxation:0,rightHandRelaxation:0};
}
function r2NeutralMotion(h){
 const r={rootOffset:[0,0,0],rootHeightRatio:1,rootQ:qi(),lumbarQ:qi(),thoraxQ:qi(),cervicalQ:qi(),headQ:qi()};
 for(const side of ['left','right']){
  const p=id=>h.sourceBind.get(side+'_'+id).p;
  r[side+'UpperArm']=norm(sub(p('forearm'),p('upperArm')));r[side+'Forearm']=norm(sub(p('hand'),p('forearm')));
  r[side+'Thigh']=norm(sub(p('tibia'),p('femur')));r[side+'Shank']=norm(sub(p('foot'),p('tibia')));
  for(const [key,id]of [['UpperArm','upperArm'],['Forearm','forearm'],['Thigh','femur'],['Shank','tibia']])r[side+key+'Q']=h.sourceBind.get(side+'_'+id).q.slice();
  r[side+'HandQ']=h.sourceBind.get(side+'_hand').q.slice();r[side+'FootQ']=qi();r[side+'ClavicleQ']=qi();
  r[side+'AnkleHeightRatio']=h.bodyMetrics.skinSoleHeightM/(h.legs[side].L1+h.legs[side].L2);
 }
 return r;
}
function r2CaptureMotion(h,yaw){
 const r=r2NeutralMotion(h),baseInv=inv(qy(yaw));r.rootQ=qm(baseInv,h.root.q);r.rootHeightRatio=h.root.p[1]/h.bodyMetrics.restHipHeightM;
 for(const [region,key]of [['L','lumbarQ'],['T','thoraxQ'],['C','cervicalQ']]){
  let q=qi();for(const j of h.spine.filter(j=>j.region===region))q=qm(q,relativeToBind(j,j.q));r[key]=q;
 }
 r.headQ=relativeToBind(h.byId.get('head'),h.byId.get('head').q);
 for(const side of ['left','right']){
  const arm=h.arms[side],leg=h.legs[side],d=(a,b)=>norm(rotate(baseInv,sub(b.world.p,a.world.p)));
  r[side+'UpperArm']=d(arm.upper,arm.elbow);r[side+'Forearm']=d(arm.elbow,arm.wrist);
  r[side+'Thigh']=d(leg.upper,leg.elbow);r[side+'Shank']=d(leg.elbow,leg.wrist);
  for(const [key,j]of [['UpperArm',arm.upper],['Forearm',arm.elbow],['Thigh',leg.upper],['Shank',leg.elbow]])r[side+key+'Q']=qm(baseInv,j.world.q);
  r[side+'HandQ']=qm(baseInv,arm.wrist.world.q);r[side+'FootQ']=qm(baseInv,leg.wrist.world.q);
  r[side+'HandRelaxation']=h.motionDriver?.captureHandRelaxation?.(side)??0;
  r[side+'ClavicleQ']=relativeToBind(h.shoulders[side].sc,h.shoulders[side].sc.q);
 }
 return r;
}
function r2ReferenceDescriptor(h,id,t,origin,yaw,from=null,blend=1){
 const raw=r2SampleMotion(id,t),floorHeadBalance=['standToSit','sitToLie','lieToSit','sitToStand'].includes(id);
 const adapted=floorHeadBalance?r2FloorCaptureMotion(raw):raw,reference=from?r2BlendMotion(from,adapted,blend):adapted;
 const transitionHingeDegrees=from&&blend<1?Object.fromEntries(['left','right'].flatMap(side=>[['forearm','UpperArm','Forearm'],['tibia','Thigh','Shank']].map(([joint,a,b])=>[side+'_'+joint,degrees(Math.acos(clamp(dot(from[side+a],from[side+b]),-1,1)))]))):null;
 const scale=(h.bodyMetrics.rig.femurLengthM+h.bodyMetrics.rig.tibiaLengthM),offset=rotate(qy(yaw),mul(raw.rootOffset,scale));
 return {position:[origin[0]+offset[0],h.bodyMetrics.restHipHeightM*reference.rootHeightRatio,origin[2]+offset[2]],
  reference,floorMode:true,groundSupport:['standToSit','sitToLie','lieToSit','sitToStand'].includes(id)?'continuous-floor':null,
  floorHeadBalance,floorHeadWeight:from?blend:1,floorSeatWeight:r2FloorSeatWeight(id,t),floorFootWeight:id==='sitToStand'?smoother((t-.28)/.12):0,kind:id,motionSource:{kind:'capture',clip:id,trial:R2_MOTION.clips[id].sourceTrial,progress:t,transitionHingeDegrees}};
}
function r2FloorCaptureMotion(raw){
 // The four floor clips share one take. Calibrate once against its standing
 // frame, including the thorax basis; per-clip resets would jump at seams.
 // Preserve world-frame changes, without importing the performer's static
 // head roll/yaw. Do not rewrite the published source samples or body motion.
 const first=r2MotionClips.get('standToSit').samples[0],out={...raw};
 let sourceBase=qm(first.rootQ,qm(first.lumbarQ,first.thoraxQ));
 let sourceNow=qm(raw.rootQ,qm(raw.lumbarQ,raw.thoraxQ)),parent=sourceNow;
 for(const key of ['cervicalQ','headQ']){
  sourceBase=qm(sourceBase,first[key]);sourceNow=qm(sourceNow,raw[key]);
  const target=qnorm(qm(sourceNow,inv(sourceBase)));
  out[key]=qnorm(qm(inv(parent),target));parent=target;
 }
 return out;
}
function r2PostureClips(from,target){
 if(from===target)return [];
 return from==='standing'?['standToSit',...(target==='lying'?['sitToLie']:[])]:
  from==='lying'?['lieToSit',...(target==='standing'?['sitToStand']:[])]:target==='lying'?['sitToLie']:['sitToStand'];
}
const R2_SEATED_PREPARATION=Object.freeze({clip:'sitToStand',durationS:.72,revision:'support-transfer/v1'});
// Authored contact intervals inferred from the installed 113_08 recording.
// These are retargeting constraints, not measured force/contact labels.
const R2_FLOOR_PALM_INTERVALS=Object.freeze({standToSit:[.70,.88,1,1],sitToStand:[0,0,.40,.48],sitToLie:[0,0,.12,.25],lieToSit:[.50,.72,1,1]});
function r2FloorPalmWeight(clip,progress){
 const interval=R2_FLOOR_PALM_INTERVALS[clip];if(!interval)return 0;
 const [approach,plant,release,end]=interval;
 return (plant===approach?1:smoother((progress-approach)/(plant-approach)))*(release===end?1:1-smoother((progress-release)/(end-release)));
}
// The seated pelvis keeps support while the legs are being repositioned.
// Release it before the recorded ascent; these are engineering phase labels.
function r2FloorSeatWeight(clip,progress){
 if(clip==='standToSit')return smoother((progress-.78)/.16);
 if(clip==='lieToSit')return smoother((progress-.66)/.20);
 if(clip==='sitToStand')return 1-smoother((progress-.10)/.13);
 if(clip==='sitToLie')return 1-smoother((progress-.10)/.12);
 return 0;
}
function r2ReferenceOriginForPosition(h,id,progress,position,yaw){
 const raw=r2SampleMotion(id,progress),scale=h.bodyMetrics.rig.femurLengthM+h.bodyMetrics.rig.tibiaLengthM;
 const offset=rotate(qy(yaw),mul(raw.rootOffset,scale));
 return [position[0]-offset[0],position[1],position[2]-offset[2]];
}
function r2SeatedPreparationDescriptor(h,frames,feet,yaw,progress,handSupported=false){
 if(!(frames instanceof Map)||!frames.has('hips'))throw Error('起身准备缺少已提交的坐姿骨架');
 const reference=r2FloorCaptureMotion(r2SampleMotion(R2_SEATED_PREPARATION.clip,0)),start=frames.get('hips').p;
 const position=[start[0],h.bodyMetrics.restHipHeightM*reference.rootHeightRatio,start[2]];
 return {position,reference,...(handSupported?{groundSupport:'continuous-floor'}:{controlledFeet:true,feet}),blendFrom:frames,blendAmount:smoother(clamp(progress,0,1)),preserveFootContactsOnBlend:true,
  floorMode:true,floorHeadBalance:true,floorSeatWeight:handSupported?1:0,kind:'seatedPrepare',motionSource:{kind:'engineering-transition',transition:R2_SEATED_PREPARATION.revision,handSupported,
   targetClip:R2_SEATED_PREPARATION.clip,progress:clamp(progress,0,1),measuredMotion:false}};
}
function r2StandingCaptureMotion(raw,from){
 // A greeting borrows motion changes, not the performer's static neck bias.
 // Preserve each captured WORLD-frame change relative to the first sample.
 // Then express it on the committed target posture with its pelvis planted.
 // Simply deleting rootQ left the spine's compensating rotations in place.
 const first=r2MotionClips.get('wave').samples[0],out={...raw};
 let sourceBase=first.rootQ,sourceNow=raw.rootQ,targetBase=from.rootQ,parent=from.rootQ;
 for(const key of ['lumbarQ','thoraxQ','cervicalQ','headQ']){
  sourceBase=qm(sourceBase,first[key]);sourceNow=qm(sourceNow,raw[key]);targetBase=qm(targetBase,from[key]);
  const target=qnorm(qm(qm(sourceNow,inv(sourceBase)),targetBase));
  out[key]=qnorm(qm(inv(parent),target));parent=target;
 }
 // Segment and palm frames use the same neutral-pose calibration. Importing
 // their absolute frames turned the resting hand palm-up during a greeting.
 for(const side of ['left','right']){
  for(const part of ['UpperArm','Forearm','Hand']){
   const key=side+part,delta=qnorm(qm(raw[key+'Q'],inv(first[key+'Q'])));
   out[key+'Q']=qnorm(qm(delta,from[key+'Q']));
   if(part!=='Hand')out[key]=norm(rotate(delta,from[key]));
  }
  const key=side+'ClavicleQ';out[key]=qnorm(qm(qm(raw[key],inv(first[key])),from[key]));
 }
 return out;
}
function r2StandingGestureDescriptor(h,g,yaw,weight){
 const desc=r2ReferenceDescriptor(h,'wave',clamp(g.time/g.duration,0,1),g.origin,yaw,g.fromMotion,weight);
 const calibrated=r2StandingCaptureMotion(r2SampleMotion('wave',clamp(g.time/g.duration,0,1)),g.fromMotion);
 desc.reference=r2BlendMotion(g.fromMotion,calibrated,weight);
 // A standing greeting borrows the captured upper body. Keep the committed
 // pelvis and the locomotion foot anchors, rather than importing the
 // performer's lower-body sway into a differently proportioned skeleton.
 desc.position=g.base.position.slice();desc.controlledFeet=true;desc.floorMode=false;
 for(const key of ['rootQ','rootHeightRatio','rootOffset'])desc.reference[key]=g.fromMotion[key];
 for(const side of ['left','right'])for(const key of ['Thigh','Shank','ThighQ','ShankQ','FootQ'])desc.reference[side+key]=g.fromMotion[side+key];
 desc.motionSource.adaptation='standing-upper-body-with-planted-feet';
 desc.motionSource.upperBodyRetarget='source-world-delta-from-first-frame-on-committed-posture';
 return desc;
}
function r2PostureEnd(h,position,yaw,clips){
 let p=position.slice();const scale=h.bodyMetrics.rig.femurLengthM+h.bodyMetrics.rig.tibiaLengthM;
 for(const id of clips){const row=r2MotionClips.get(id).samples.at(-1),d=rotate(qy(yaw),mul(row.rootOffset,scale));p=[p[0]+d[0],h.bodyMetrics.restHipHeightM*row.rootHeightRatio,p[2]+d[2]];}
 return p;
}
function r2MotionTracking(h,reference,yaw){
 const base=qy(yaw),angles={};
 for(const side of ['left','right'])for(const [channel,a,b]of [
  ['UpperArm','upperArm','forearm'],['Forearm','forearm','hand'],['Thigh','femur','tibia'],['Shank','tibia','foot']]){
  const actual=norm(sub(h.byId.get(side+'_'+b).world.p,h.byId.get(side+'_'+a).world.p));
  angles[side+channel]=degrees(Math.acos(clamp(dot(actual,rotate(base,reference[side+channel])),-1,1)));
 }
 const torso=qm(base,qm(reference.rootQ,qm(reference.lumbarQ,reference.thoraxQ)));
 const legDegrees=Math.max(...Object.entries(angles).filter(([k])=>/Thigh|Shank/.test(k)).map(([,v])=>v));
 const armDegrees=Math.max(...Object.entries(angles).filter(([k])=>/UpperArm|Forearm/.test(k)).map(([,v])=>v));
 const torsoDegrees=degrees(qangle(h.byId.get('T1').world.q,torso));
 const footM=Math.max(0,...h.lastErrors.filter(e=>/_foot$/.test(e.id)).map(e=>e.error));
 const floor=h.motionDriver?.report().floorSupport,contacts=h.lastErrors.filter(e=>e.kind==='floor-palm');
 const contactArms=contacts.filter(e=>e.weight===1&&e.error<=.012&&e.orientationErrorRad<.1).map(e=>e.id.split('_')[0]);
 const unconstrainedArmDegrees=Math.max(0,...Object.entries(angles).filter(([k])=>/UpperArm|Forearm/.test(k)&&!contactArms.some(side=>k.startsWith(side))).map(([,v])=>v));
 const adaptedTorsoDegrees=floor?.active&&contacts.length?degrees(qangle(h.byId.get('T1').world.q,qm(floor.torsoDeltaQ,torso))):torsoDegrees;
 const contactPassed=contacts.every(e=>e.error<=.012&&e.orientationErrorRad<.1);
 const footContacts=h.lastErrors.filter(e=>e.kind==='floor-foot-plant');
 const footContactPassed=footContacts.every(e=>e.error<=.012&&e.orientationErrorRad<.1);
 const contactLegs=footContacts.filter(e=>e.weight===1&&e.error<=.012&&e.orientationErrorRad<.1).map(e=>e.id.split('_')[0]);
 const unconstrainedLegDegrees=Math.max(0,...Object.entries(angles).filter(([k])=>/Thigh|Shank/.test(k)&&!contactLegs.some(side=>k.startsWith(side))).map(([,v])=>v));
 // These are declared animation tolerances, not clinical error bounds.
 return {angles,legDegrees,armDegrees,torsoDegrees,unconstrainedLegDegrees,contactLegs,footContactPassed,unconstrainedArmDegrees,adaptedTorsoDegrees,contactArms,contactPassed,footM,passed:unconstrainedLegDegrees<=12&&unconstrainedArmDegrees<=18&&adaptedTorsoDegrees<=12&&footM<=.05&&contactPassed&&footContactPassed,
  tolerance:{legDegrees:12,armDegrees:18,torsoDegrees:12,footM:.05},scope:'skeletal reference tracking; not soft-tissue or visual acceptance'};
}
function r2MotionReport(){return {revision:R2_MOTION.revision,source:R2_MOTION.source,
 clips:Object.fromEntries(Object.entries(R2_MOTION.clips).map(([id,c])=>[id,{trial:c.sourceTrial,frames:[c.sourceFrameStart,c.sourceFrameEnd],durationS:c.durationS,parameterInterpolationError:c.parameterInterpolationError}])),
 standards:{salute:R2_SALUTE_STANDARD,seatedPreparation:R2_SEATED_PREPARATION},actions:MOTION_ACTIONS,kernel:'Human-Motion-Lab R2.2',unsupportedActions:R2_UNSOURCED_ACTIONS,retargeting:true,softTissueMotionMeasured:false,visualAcceptance:false};}
