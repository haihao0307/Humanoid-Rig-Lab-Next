'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),program=require('./program-r17.cjs')();
const load=name=>vm.runInThisContext(fs.readFileSync('src/'+name+'.js','utf8'),{filename:name});
for(const n of['BodyMathR01','BodyShapeR01','BodyMHRFieldsR01','BodyTargetBindingR01','BodyMHRAdapterR01','BodyDriverR01'])load(n);
const legacy=createBodyDriverR01(program);for(const n of['BodyShapeR18','BodyCalibrationR18','BodyTorsoR18'])load(n);
const driver=createBodyDriverR18(program),q={startedUTC:new Date().toISOString(),checks:[],cases:[],measure:'Animation rest-joint positions, not measured internal anatomy',passed:false};
function check(name,fn){fn();q.checks.push({name,passed:true});console.log('PASS',name);}
const maxDelta=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i]))),flat=r=>r.rig.restMatrices.flatMap(m=>Array.from(m));
const original=structuredClone(program.baselineState),adult=BodyCalibrationR18.preset(original);
check('original input and cranial state retained',()=>{assert.deepEqual(original,program.baselineState);assert.deepEqual(adult.gnm,original.gnm);for(const[k,v]of Object.entries(original.anny.localChanges))if(BodyCalibrationR18.headLocal(k))assert.equal(adult.anny.localChanges[k],v);assert.deepEqual(adult.mhr.identity,original.mhr.identity);});
for(const rig of['anny','mhr']){
 const old=structuredClone(original);old.owners.rig=rig;
 check(rig+' legacy archive numeric output exact',()=>{const a=legacy.evaluate(old),b=driver.evaluate(old);assert.deepEqual(a.vertices,b.vertices);assert.deepEqual(a.rig.restMatrices,b.rig.restMatrices);});
 const state=structuredClone(adult);state.owners.rig=rig;const neutral=driver.evaluate(state),support=flat(neutral);
 for(const [name,changes]of[['lean',{weight:.28}],['fuller',{weight:.86}],['low-muscle',{muscle:.15}],['high-muscle',{muscle:1}],['soft-locals',{}]]){
  const s=structuredClone(state);Object.assign(s.anny.phenotypes,changes);if(name==='soft-locals')s.anny.localChanges={...s.anny.localChanges,'l-upperleg-fat-incr':.6,'torso-muscle-dorsi-incr':.7};
  const r=driver.evaluate(s),error=maxDelta(flat(r),support);check(rig+' '+name+' support unchanged with visible response',()=>{assert.ok(error<1e-12,rig+' '+name+' support error '+error);assert.ok(maxDelta(r.vertices,neutral.vertices)>.001);assert.ok(Array.from(r.vertices).every(Number.isFinite));});q.cases.push({rig,name,supportMaxDeltaMetres:error,maxSurfaceResponseMM:maxDelta(r.vertices,neutral.vertices)*1000,calibration:r.calibration});
 }
 for(const axis of['height','proportions']){const s=structuredClone(state);s.anny.phenotypes[axis]=.85;check(rig+' explicit '+axis+' still changes support',()=>assert.ok(maxDelta(flat(driver.evaluate(s)),support)>.001));}
 const uncorrected=structuredClone(state);uncorrected.bodyCalibration.torso=0;const base=driver.evaluate(uncorrected);
 check(rig+' torso correction is bounded and excludes head hands feet',()=>{assert.ok(neutral.calibration.maxRestCorrectionMM<25);let excluded=0;const f=neutral.calibration.torsoFrame;for(let i=0;i<program.bodyCount;i++){const p=Array.from(base.sharedRestVertices.subarray(i*3,i*3+3)),u=(p[2]-f.origin[2])/f.height;if(u>=1||u<=-.42||Math.abs(p[0]-f.origin[0])>=1.02*f.halfWidth){for(let c=0;c<3;c++)assert.equal(base.vertices[i*3+c],neutral.vertices[i*3+c]);excluded++;}}assert.ok(excluded>program.bodyCount/2);});
 const posed=structuredClone(state);if(rig==='anny')posed.anny.pose['spine03']=[0,12,0];else posed.mhr.pose[45]=.2;const poseResult=driver.evaluate(posed);
 check(rig+' complete influence packet reproduces corrected posed samples',()=>{const out=driver.skinAnnyPacket(poseResult.packet,poseResult.rig.skinMatrices);assert.ok(maxDelta(out,poseResult.vertices)<1e-6);});
}
q.passed=true;q.finishedUTC=new Date().toISOString();fs.mkdirSync('qa/calibration-r18',{recursive:true});fs.writeFileSync('qa/calibration-r18/numeric.json',JSON.stringify(q,null,2));
