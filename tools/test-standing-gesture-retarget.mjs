// A source recording's static posture must not become a target neck offset.
// Compare world rotation matrices independently from the quaternion adapter.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('reconstruction/motion-reference.json'),motion=JSON.parse(source);
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const api=vm.runInNewContext(math+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',source)+
 '\n({sample:r2SampleMotion,retarget:r2StandingCaptureMotion,descriptor:r2StandingGestureDescriptor,qx,qy,qz,qm,qi})',
 {degrees:r=>r*180/Math.PI});
const keys=['lumbarQ','thoraxQ','cervicalQ','headQ'];
const matrix=q=>{const[x,y,z,w]=q;return[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];};
const mm=(a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((s,v,k)=>s+v*b[k][j],0)));
const tr=a=>a[0].map((_,i)=>a.map(row=>row[i]));
const error=(a,b)=>Math.max(...a.flat().map((v,i)=>Math.abs(v-b.flat()[i])));
const first=api.sample('wave',0),firstJSON=JSON.stringify(first),h={bodyMetrics:{restHipHeightM:.9,rig:{femurLengthM:.4,tibiaLengthM:.4}}};
let checked=0,maxWorldMatrixError=0,oldStaticHeadTiltRad=0;
for(const start of [0,.12,-.2]){
 const from={...api.sample('wave',0),rootQ:api.qy(start),lumbarQ:api.qx(start*.2),thoraxQ:api.qz(start*.4),cervicalQ:api.qy(-start*.3),headQ:api.qx(start*.5)};
 const original=JSON.stringify(from);
 for(const raw of motion.clips.wave.sampleBlocks.flat()){
  const untouched=JSON.stringify(raw),out=api.retarget(raw,from);
  let a=matrix(first.rootQ),b=matrix(raw.rootQ),base=matrix(from.rootQ),actual=matrix(from.rootQ);
  for(const key of keys){
   a=mm(a,matrix(first[key]));b=mm(b,matrix(raw[key]));base=mm(base,matrix(from[key]));actual=mm(actual,matrix(out[key]));
   const expected=mm(mm(b,tr(a)),base),e=error(actual,expected);maxWorldMatrixError=Math.max(maxWorldMatrixError,e);
   assert(e<1e-6,'Preserve the captured world rotation change: '+key);checked++;
  }
  for(const key of Object.keys(raw).filter(k=>!keys.includes(k)&&!/(UpperArm|Forearm|Hand|Clavicle)/.test(k)))assert.deepEqual(out[key],raw[key],'Do not modify lower-body or original root channels');
  for(const side of ['left','right'])for(const part of ['UpperArm','Forearm','Hand']){
   const key=side+part,delta=mm(matrix(raw[key+'Q']),tr(matrix(first[key+'Q']))),expected=mm(delta,matrix(from[key+'Q']));
   assert(error(matrix(out[key+'Q']),expected)<1e-6,'Preserve captured segment and palm frame changes');
   if(part!=='Hand')for(let i=0;i<3;i++)assert(Math.abs(out[key][i]-delta[i].reduce((s,v,k)=>s+v*from[key][k],0))<1e-6,'Bone directions follow the same calibrated rotation');
  }
  assert.equal(JSON.stringify(raw),untouched);
 }
 const neutral=api.retarget(first,from);
 for(const key of keys)assert(error(matrix(neutral[key]),matrix(from[key]))<1e-6,'First capture sample maps onto committed target posture');
 for(const weight of [0,.25,.5,1]){
  const g={time:0,duration:3,origin:[0,.9,0],base:{position:[0,.9,0]},fromMotion:from};
  const d=api.descriptor(h,g,.7,weight);
  assert.deepEqual(d.reference.rootQ,from.rootQ);assert(d.controlledFeet);assert.equal(d.floorMode,false);
  for(const key of keys)assert(error(matrix(d.reference[key]),matrix(from[key]))<1e-6,'Fade-in cannot introduce the static recording bias');
 }
 assert.equal(JSON.stringify(from),original);
 if(start===0){let old=matrix(from.rootQ);for(const key of keys)old=mm(old,matrix(first[key]));oldStaticHeadTiltRad=Math.acos(Math.min(1,Math.max(-1,old[1][1])));assert(oldStaticHeadTiltRad>.5,'Regression source actually exposes a large old static tilt');}
}
assert.equal(JSON.stringify(first),firstJSON);
console.log(JSON.stringify({samples:motion.clips.wave.sampleCount,worldFramesChecked:checked,maxWorldMatrixError,oldStaticHeadTiltDegrees:oldStaticHeadTiltRad*180/Math.PI,rawCaptureModified:false,skinValidation:false}));
