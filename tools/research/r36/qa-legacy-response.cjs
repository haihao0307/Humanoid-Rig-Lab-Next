'use strict';
// Offline checks for the legacy regional fields, with their original
// torso/structure/anatomy options and no hand/foot/articulation add-ons.
const fs=require('fs'),vm=require('vm'),zlib=require('zlib');
for(const file of ['src/BodyMathR01.js','src/BodyProgramStorageR27.js','src/BodyShapeR01.js','src/BodyMHRFieldsR01.js','src/BodyTargetBindingR01.js','src/BodyMHRAdapterR01.js','src/BodyDriverR01.js','src/BodyCalibrationR18.js','src/BodyTorsoR18.js','src/BodyStructureR19.js','src/BodyArticulationR20.js','src/BodyAnatomyR20.js','src/research/p1/BodyProperRotationP1.js','src/research/r36/BodyPoseFunctionsR36.js','src/research/p1/BodySupportRigP1.js','src/research/r36/BodyBSupportR36.js','src/research/r36/BodySourceScopeR36.js','src/research/r36/BodyLegacyShapeR36.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const readPacket=file=>BodyProgramStorageR27.consume(Uint8Array.from(zlib.gunzipSync(fs.readFileSync(file))).buffer).program;
const source=require('../../program-r17.cjs')(),base=JSON.parse(fs.readFileSync('data/body-torso-continuous-p1.json')),bm=JSON.parse(fs.readFileSync('data/body-b-support-r36.json')),lm=JSON.parse(fs.readFileSync('data/body-legacy-support-r36.json')),mapping=JSON.parse(fs.readFileSync('qa/p1-torso/offline/body-expanded-source-map-p1.json'));
const support=BodySupportRigP1.create(readPacket(base.support.file)),bProvider=BodyBSupportR36.create(readPacket(bm.file),support),legacyProvider=BodyLegacyShapeR36.create(readPacket(lm.file),support);
const tests=[{name:'A neutral',rig:'anny',posed:false},{name:'A bend',rig:'anny',posed:true},{name:'B bend',rig:'mhr',posed:true}],checks=[];
for(const test of tests){
 const state=structuredClone(require('../../../qa/anatomy-r20/final-person.json').person.state);state.owners.rig=test.rig;
 if(test.posed&&test.rig==='anny'){state.anny.pose['upperleg01.L']=[-50,0,0];state.anny.pose['upperleg01.R']=[-50,0,0];state.anny.pose['lowerleg01.L']=[65,0,0];state.anny.pose['lowerleg01.R']=[65,0,0];}
 if(test.posed&&test.rig==='mhr')for(const [i,v]of [[52,-.7],[61,-.7],[53,1.1],[62,1.1],[11,.25]])state.mhr.pose[i]=v;
 const a=structuredClone(state);a.owners.rig='anny';const pose=test.rig==='anny'?Object.fromEntries(Object.entries(state.anny.pose).filter(([,v])=>v.some(x=>x!==0)).map(([k,v])=>[k,{rotation:v}])):{};if(test.rig==='mhr'){a.anny.pose={};a.anny.translations={};}
 const moved=support.original(a,pose),bFrame=test.rig==='mhr'?bProvider.prepare(state,a):null,legacy=legacyProvider.prepare(state,a,pose,moved,bFrame),original=createBodyDriverR01(source).evaluate(state),expected=BodyAnatomyR20.create(source).evaluate(state);
 let max=0,sum=0,n=0;const seen=new Set();
 for(let f=0;f<mapping.length;f++)for(let c=0;c<3;c++){const i=mapping[f].bodyIndices[c];if(seen.has(i))continue;seen.add(i);const rest=Array.from(original.sharedRestVertices.subarray(i*3,i*3+3)),delta=legacy.delta(rest),adjusted=rest.map((v,k)=>Math.fround(v+delta[k])),p0=Array.from(original.vertices.subarray(i*3,i*3+3));let p;if(bFrame)p=bFrame.point(f,c,adjusted);else{const q=legacy.transport(f,c,delta);p=p0.map((v,k)=>Math.fround(v+q[k]));}const joint=legacy.articulation(f,c,adjusted);p=p.map((v,k)=>Math.fround(v+joint[k]));const error=Math.hypot(...p.map((v,k)=>v-expected.vertices[i*3+k]));max=Math.max(max,error);sum+=error*error;n++;}
 checks.push({name:test.name,samples:n,maxMM:max*1000,rmsMM:Math.sqrt(sum/n)*1000,passed:max<.0001});
}
const passed=checks.every(x=>x.passed);console.log(JSON.stringify({passed,checks}));if(!passed)process.exitCode=1;
