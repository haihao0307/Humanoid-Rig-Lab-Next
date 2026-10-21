const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const R=path.resolve(__dirname,'..'),C=require('../review.js'),data=JSON.parse(fs.readFileSync(R+'/EVIDENCE.json')),checks=[];
function test(name,f){f();checks.push({name,passed:true});}const clone=x=>JSON.parse(JSON.stringify(x)),x=data.cases.walk;
for(const [k,v]of Object.entries(data.cases))test('actual '+k+' validates',()=>assert(C.validate(v)));
test('repeat native hash proof',()=>assert(data.validation.repeatWalkIdentical&&data.validation.samePostFitState&&data.validation.samePostRegionalState));
test('findings derive first reported margin crossing',()=>{for(const f of C.findings(x)){const r=x.records.find(r=>C.channel(r,f.key).beyondMargin>0);assert.equal(f.firstStage,r?.stage||null);assert.equal(f.initialResidual,C.channel(x.records[0],f.key).beyondMargin>0);}});
test('inspection does not mutate evidence',()=>{const s=JSON.stringify(x);C.findings(x);assert.equal(JSON.stringify(x),s);});
for(const [name,fn]of [
 ['wrong source',x=>x.sourceCommit='0'.repeat(40)],['claim full fit',x=>x.dynamicFitCertified=true],['changed margin',x=>x.epsilonM=.01],['invent automatic frames',x=>x.automaticAppFramesBeforeMeasurement=1],['wrong step time',x=>x.records[3].simulationSeconds=99],['bad units in witness',x=>x.records[0].body[0].minimumM*=1000],['bad triangle',x=>x.records[0].body[0].witness.targetTriangle[0][0]='0'],['forged source frame',x=>x.records[0].frame=0],['missing stage',x=>x.records.splice(1,1)],['inconsistent counts',x=>x.records[0].body[0].negative=999999],['fake continuous certificate',x=>x.records[0].continuousCollision=true]
])test('reject '+name,()=>{const v=clone(x);fn(v);assert.throws(()=>C.validate(v));});
fs.mkdirSync(R+'/qa/review',{recursive:true});fs.writeFileSync(R+'/qa/review/PROTOCOL.json',JSON.stringify({passed:true,count:checks.length,checks,syntheticNegativeCases:true},null,2));console.log(checks.length+' review checks passed');
