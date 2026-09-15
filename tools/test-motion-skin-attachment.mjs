// Exercise the real pose adapter on captured gestures and contact IK. Bone
// lengths alone cannot detect a skinning pivot that misses the joint centre.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {MotionController} from '../motion/vendor/controller.mjs';
import {rigFromSource} from '../motion/vendor/rig.mjs';
import {solveTwoBone} from '../motion/vendor/math.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const fullBody=read('motion/vendor/full-body.mjs').replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL('../motion/vendor/'+path,import.meta.url).href));
const {blend,relaxedHandRotation}=await import('data:text/javascript;base64,'+Buffer.from(fullBody+'\nexport {blend,relaxedHandRotation};').toString('base64'));
const rig=JSON.parse(read('reconstruction/rig-reference.json'));
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const code=math+'\n'+read('body/ReconstructionRig.js').replace('/*__R2_RIG_JSON__*/',JSON.stringify(rig)).replace('/*__R2_REGIONS_JSON__*/','{}')+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',read('reconstruction/motion-reference.json'))+'\n'+read('body/ContactHandPose.js')+'\n'+read('body/MotionLabPose.js')+'\n'+read('body/CompactBinding.js')+'\n'+read('body/CompactMuscles.js');
const api=vm.runInNewContext(code+'\n({r2SourceFrames,r2SampleMotion,r2StandingGestureDescriptor,r2NeutralMotion,MotionLabPose,r2DeformPoint,r2DeformTissuePoint,qm,inv,rotate,sub,add,mul,dist,qi,qy,qx,qslerp,frame})',{structuredClone,degrees:r=>r*180/Math.PI,DOWN:[0,-1,0],MotionLab:{blend,relaxedHandRotation,solveTwoBone}});
let samples=0,maxWristErrorM=0,previousPivotErrorM=0,maxDqsDifferenceM=0;
let attachmentSamples=0,maxAttachmentErrorM=0,walkingSamples=0,previousHipErrorM=0,previousRegionalErrorM=0;
for(const stature of [.95,1,1.06]){
 const resolved=structuredClone(rig);for(const n of Object.values(resolved.nodes)){n.positionM=n.positionM.map(v=>v*stature);if(n.tipM)n.tipM=n.tipM.map(v=>v*stature);}resolved.sourceFloorM*=stature;
 const sourceBind=api.r2SourceFrames(resolved),engine=new MotionController(rigFromSource(resolved));
 const h={resolvedRig:resolved,sourceBind,bodyMetrics:{palmContact:[0,-.045*stature,0],armReachM:{left:1,right:1},reference:{armReachM:{left:1,right:1}}},arms:{}};
 h.joints=[...sourceBind.keys()].map(id=>({id,bindQ:[0,0,0,1]}));h.byId=new Map(h.joints.map(j=>[j.id,j]));
 for(const side of ['left','right'])h.arms[side]={s:side==='left'?-1:1,L1:api.dist(sourceBind.get(side+'_upperArm').p,sourceBind.get(side+'_forearm').p),L2:api.dist(sourceBind.get(side+'_forearm').p,sourceBind.get(side+'_hand').p)};
 const pose=new api.MotionLabPose(h,engine);
 const attachmentError=(frames,id)=>{
  const n=resolved.nodes[id],source=sourceBind.get(n.parent),parent=frames.get(n.parent),child=frames.get(id);
  const delta=api.qm(parent.q,api.inv(source.q));
  return api.dist(api.add(parent.p,api.rotate(delta,api.sub(n.positionM,source.p))),child.p);
 };
 const verifyAttachments=frames=>{for(const [id,n]of Object.entries(resolved.nodes))if(n.parent){
  const error=attachmentError(frames,id);maxAttachmentErrorM=Math.max(maxAttachmentErrorM,error);attachmentSamples++;
  // Source hip midpoint is rounded to 0.1 micrometres; the kernel centres it
  // symmetrically. This bound keeps that known rounding separate from drift.
  assert(error<1e-7,'Parent skinning transform must reach its child: '+id+' ('+error+' m)');
 }};
 const verify=frames=>{for(const side of ['left','right']){
  const id=side+'_radiusRotation',source=sourceBind.get(id),f=frames.get(id),wrist=frames.get(side+'_hand'),restWrist=sourceBind.get(side+'_hand');
  const q=api.qm(f.q,api.inv(source.q)),point=api.add(f.p,api.rotate(q,api.sub(restWrist.p,source.p)));
  const error=api.dist(point,wrist.p);maxWristErrorM=Math.max(maxWristErrorM,error);assert(error<1e-10,'Radial deformation must map the source wrist to the committed wrist');
  const old=api.qm(wrist.q,api.inv(restWrist.q)),oldPoint=api.add(f.p,api.rotate(old,api.sub(restWrist.p,source.p)));previousPivotErrorM=Math.max(previousPivotErrorM,api.dist(oldPoint,wrist.p));samples++;
 }};
 for(const yaw of [0,.7,-1.9])for(let k=0;k<=30;k++){const c=pose.build({reference:api.r2SampleMotion('wave',k/30),yaw});pose.validate(c);verify(c.frames);verifyAttachments(c.frames);}
 // A different interpolation for positions and rotations used to pass bone
 // lengths while moving the sternum/clavicle attachment by millimetres.
 const currentRegional=pose.regionalRotation;
 pose.regionalRotation=(q,count)=>api.qslerp(api.qi(),q,1/count);
 for(let k=0;k<=30;k++){
  const old=pose.build({reference:api.r2SampleMotion('sitToStand',k/30)});
  previousRegionalErrorM=Math.max(previousRegionalErrorM,attachmentError(old.frames,'sternum'));
 }
 pose.regionalRotation=currentRegional;
 for(const clip of ['standToSit','sitToLie','lieToSit','sitToStand'])for(let k=0;k<=20;k++){
  const candidate=pose.build({reference:api.r2SampleMotion(clip,k/20)});pose.validate(candidate);verifyAttachments(candidate.frames);
 }
 for(const yaw of [0,.7,-1.9]){
  engine.reset();engine.state.yaw=yaw;
  for(const side of ['left','right'])engine.state.feet[side]={position:engine.stance(engine.state,side),yaw,contact:true};
  engine.state.pose=engine.solve(engine.state);engine.command({type:'walk',target:api.rotate(api.qy(yaw),[0,0,3])});
  for(let k=0;k<300;k++){
   engine.update(1/120);assert.equal(engine.state.fault,null);const before=JSON.stringify(engine.state),candidate=pose.build();
   pose.validate(candidate);verifyAttachments(candidate.frames);walkingSamples++;
   assert.equal(JSON.stringify(engine.state),before,'Pose adapter must not change navigation or contact state');
   for(const side of ['left','right'])for(const [joint,key]of [['femur','root'],['tibia','knee'],['foot','end']])assert(api.dist(candidate.frames.get(side+'_'+joint).p,engine.state.pose.legs[side][key])<1e-12,'Controlled joints retain the kernel solution');
   const raw=pose.frameData(engine.state,null),previous=new Map(candidate.frames),hips=candidate.frames.get('hips');
   previous.set('hips',api.frame(hips.p,api.qm(api.qy(yaw),raw.rootQ)));
   previousHipErrorM=Math.max(previousHipErrorM,attachmentError(previous,'left_femur'));
  }
 }
 engine.reset();
 const bad=pose.build({reference:api.r2SampleMotion('wave',.4)}),hand=bad.frames.get('right_hand'),radial=bad.frames.get('right_radiusRotation');
 radial.q=api.qm(api.qm(hand.q,api.inv(sourceBind.get('right_hand').q)),sourceBind.get('right_radiusRotation').q);
 assert.throws(()=>pose.validate(bad),/前臂蒙皮轴/,'Same bone lengths with a wrong radial axis must be rejected');
 for(const parent of ['hips','T1','left_SC']){
  const corrupted=pose.build(),f=corrupted.frames.get(parent);f.q=api.qm(api.qx(.12),f.q);
  assert.throws(()=>pose.validate(corrupted),/蒙皮变换未连接到子关节/,'Rotating a skinning pivot away from its children must be rejected: '+parent);
 }
 h.bodyMetrics.restHipHeightM=engine.state.root[1];h.bodyMetrics.rig={femurLengthM:engine.rig.legs.left.upper,tibiaLengthM:engine.rig.legs.left.lower};
 const start=api.r2SampleMotion('wave',0);start.rootQ=[0,0,0,1];start.rootHeightRatio=1;
 const g={fromMotion:start,origin:engine.state.root.slice(),base:{position:engine.state.root.slice()},duration:3};
 for(let k=0;k<=30;k++){
  g.time=k*.1;const descriptor=api.r2StandingGestureDescriptor(h,g,0,Math.min(1,k/3,(30-k)/3));
  const candidate=pose.build(descriptor);pose.validate(candidate);
  verifyAttachments(candidate.frames);
  for(const side of ['left','right'])assert(api.dist(candidate.frames.get(side+'_foot').p,engine.state.feet[side].position)<1e-10,'Standing wave must keep both original world foot anchors');
  assert(api.dist(candidate.frames.get('hips').p,g.base.position)<1e-10);
 }
 // Hands constrained by carried objects must use the same radial correction.
 for(const yaw of [0,1.1]){
  engine.state.yaw=yaw;engine.state.pose=engine.solve(engine.state);const frames=pose.build({yaw}).frames,hands={};
  for(const side of ['left','right']){const f=frames.get(side+'_hand'),q=api.qm(api.qy(yaw),api.qx(.8));hands[side]={p:api.add(f.p,api.rotate(q,h.bodyMetrics.palmContact)),q};}
  const contact=pose.build({hands,yaw});pose.validate(contact);verify(contact.frames);
  verifyAttachments(contact.frames);
 }
 const end=pose.build({reference:api.r2SampleMotion('sitToStand',1)}).frames;
 for(const amount of [0,.1,.25,.5,.75,.9]){const candidate=pose.build({blendFrom:end,blendAmount:amount});pose.validate(candidate);verifyAttachments(candidate.frames);}
}
assert(previousPivotErrorM>.08,'Regression must reproduce the old displaced wrist pivot');
assert(previousHipErrorM>.01,'Regression must reproduce captured pelvis skin missing the controlled hip by over 1 cm');
assert(previousRegionalErrorM>.001,'Regression must reproduce different regional interpolation moving torso attachments by over 1 mm');
// Independently retain the vector implementation as the numerical oracle.
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],{add,sub,mul,rotate}=api;
function original(p,rows,transforms){let r=[0,0,0,0],d=[0,0,0,0];const ref=transforms[rows[0][0]].q;
 for(const [id,weight]of rows){const t=transforms[id],w=weight*(dot(ref,t.q)<0?-1:1);r=add(r,mul(t.q,w));d=add(d,mul(t.d,w));}
 const n=Math.hypot(...r);r=mul(r,1/n);d=mul(d,1/n);d=sub(d,mul(r,dot(r,d)));return add(rotate(r,p),mul(add(sub(mul(d.slice(0,3),r[3]),mul(r.slice(0,3),d[3])),cross(r.slice(0,3),d.slice(0,3))),2));
}
for(let k=0;k<2000;k++){
 const transforms=Array.from({length:8},(_,i)=>{let q=api.qm(api.qy((k+i)*.13),api.qx((k-i)*.07));if(i%3===0)q=mul(q,-1);const t=[Math.sin(k+i),Math.cos(k-i),i*.01];return {q,d:mul(api.qm([...t,0],q),.5)};});
 const weights=transforms.map((_,i)=>1+(k*i)%17),sum=weights.reduce((a,b)=>a+b),rows=weights.map((w,i)=>[i,w/sum]),p=[Math.sin(k),Math.cos(k),k*.001];
 const error=api.dist(original(p,rows,transforms),api.r2DeformPoint(p,rows,transforms));maxDqsDifferenceM=Math.max(maxDqsDifferenceM,error);assert(error<1e-12);
}
console.log(JSON.stringify({poseAttachmentSamples:samples,maxWristErrorM,previousPivotErrorM,attachmentSamples,maxAttachmentErrorM,walkingSamples,previousHipErrorM,previousRegionalErrorM,dqsParitySamples:2000,maxDqsDifferenceM}));
