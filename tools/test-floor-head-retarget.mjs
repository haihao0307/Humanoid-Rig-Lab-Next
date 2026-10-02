// The take's initial neck bias must not be imposed on another skeleton.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),source=read('reconstruction/motion-reference.json');
const math=read('source/runtime.template.js').split('// MODULE math')[1].split('function matrix')[0];
const api=vm.runInNewContext(math+'\n'+read('body/ReferenceMotion.js').replace('/*__R2_MOTION_JSON__*/',source)+'\n({sample:r2SampleMotion,adapt:r2FloorCaptureMotion,qm,inv,qangle,rotate,qi,qnorm})');
const world=r=>api.qnorm(['rootQ','lumbarQ','thoraxQ','cervicalQ','headQ'].reduce((q,k)=>api.qm(q,r[k]),api.qi()));
const baseline=api.sample('standToSit',0),adapted=api.adapt(baseline);
const oldTilt=Math.acos(api.rotate(world(baseline),[0,1,0])[1])*180/Math.PI;
assert(oldTilt>20,'Regression take contains a substantial static head tilt');
assert(api.qangle(world(adapted),api.qi())<1e-6,'First standing head maps to upright and forward');
let samples=0,maxWorldDeltaErrorRad=0;
for(const id of ['standToSit','sitToLie','lieToSit','sitToStand']){
 const rows=JSON.parse(source).clips[id].sampleBlocks.flat();
 let previous=null;
 for(const raw of rows){
  const json=JSON.stringify(raw),out=api.adapt(raw);samples++;
  assert.equal(JSON.stringify(raw),json,'Retargeting does not mutate archival motion');
  for(const k of Object.keys(raw).filter(k=>!['headQ','cervicalQ'].includes(k)))assert.deepEqual(out[k],raw[k],'Body and contact channels remain unchanged');
  if(previous){
   const sourceDelta=api.qm(world(raw),api.inv(world(previous.raw))),targetDelta=api.qm(world(out),api.inv(world(previous.out)));
   const error=api.qangle(sourceDelta,targetDelta);maxWorldDeltaErrorRad=Math.max(maxWorldDeltaErrorRad,error);assert(error<1e-6,'Calibration preserves the recorded world-frame change before authored balance');
  }
  previous={raw,out};
 }
}
for(const [a,b]of [['standToSit','sitToLie'],['lieToSit','sitToStand']])assert(api.qangle(world(api.adapt(api.sample(a,1))),world(api.adapt(api.sample(b,0))))<1e-6,'Shared source endpoints retain identical head frames');
console.log(JSON.stringify({samples,oldStandingTiltDegrees:oldTilt,maxWorldDeltaErrorRad,rawCaptureModified:false,visualAcceptance:false}));
