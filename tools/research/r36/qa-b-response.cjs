'use strict';
// Compare B-rig scalar responses to the prior evaluator using the same state.
// The offline reference point identifiers never enter the runtime packet.
const fs=require('fs'),vm=require('vm'),zlib=require('zlib');
for(const file of ['src/BodyMathR01.js','src/BodyProgramStorageR27.js','src/BodyShapeR01.js','src/BodyMHRFieldsR01.js','src/BodyTargetBindingR01.js','src/BodyMHRAdapterR01.js','src/research/p1/BodyProperRotationP1.js','src/research/r36/BodyPoseFunctionsR36.js','src/research/p1/BodySupportRigP1.js','src/research/r36/BodyBSupportR36.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const readPacket=file=>BodyProgramStorageR27.consume(Uint8Array.from(zlib.gunzipSync(fs.readFileSync(file))).buffer).program;
const source=require('../../program-r17.cjs')(),base=JSON.parse(fs.readFileSync('data/body-torso-continuous-p1.json')),manifest=JSON.parse(fs.readFileSync('data/body-b-support-r36.json')),mapping=JSON.parse(fs.readFileSync('qa/p1-torso/offline/body-expanded-source-map-p1.json'));
const support=BodySupportRigP1.create(readPacket(base.support.file)),provider=BodyBSupportR36.create(readPacket(manifest.file),support),shape=createBodyShapeR01(source.anny),engine=createBodyMHRFieldsR01(source.mhr.engine),reference=createBodyMHRAdapterR01(source.mhr,shape,engine);
const checks=[];
for(const test of [{name:'adult bend',age:.74,sex:0,correctives:true},{name:'adult bend without correction',age:.74,sex:0,correctives:false},{name:'age and sex with bend',age:.45,sex:.6,correctives:true}]){
 const state=structuredClone(source.baselineState);state.owners.rig='mhr';state.anny.phenotypes.age=test.age;state.anny.phenotypes.gender=test.sex;for(const [i,v] of [[52,-.7],[61,-.7],[53,1.1],[62,1.1],[11,.25]])state.mhr.pose[i]=v;state.mhr.correctives=test.correctives;
 const a=structuredClone(state);a.owners.rig='anny';a.anny.pose={};a.anny.translations={};
 const actual=provider.prepare(state,a),expected=reference.evaluate(state.mhr,{phenotypes:state.anny.phenotypes,localChanges:state.anny.localChanges});
 let max=0,sum=0,n=0;const seen=new Set();
 for(let f=0;f<mapping.length;f++)for(let c=0;c<3;c++){const i=mapping[f].bodyIndices[c];if(seen.has(i))continue;seen.add(i);const rest=Array.from(expected.restVertices.subarray(i*3,i*3+3)),p=actual.point(f,c,rest),e=Math.hypot(...p.map((v,k)=>v-expected.vertices[i*3+k]));max=Math.max(max,e);sum+=e*e;n++;}
 const rms=Math.sqrt(sum/n);checks.push({name:test.name,samples:n,maxMM:max*1000,rmsMM:rms*1000,passed:max<.0001});
}
const passed=checks.every(x=>x.passed);console.log(JSON.stringify({passed,checks}));if(!passed)process.exitCode=1;
