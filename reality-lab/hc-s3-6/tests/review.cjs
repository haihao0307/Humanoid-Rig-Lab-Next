const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=path.resolve(__dirname,'..'),V=require('../review.js'),P=require('../../hc-s2-1/protocol.js'),D=require('../../hc-s2-1/measurement-dictionary.json'),DATA=JSON.parse(fs.readFileSync(R+'/EVIDENCE_SUMMARY.json','utf8')),checks=[],clone=x=>JSON.parse(JSON.stringify(x));
function test(name,fn){fn();checks.push({name,passed:true});console.log('PASS',name);}
for(const r of DATA.records)test('actual '+r.case+' report resolves',()=>{assert(V.validate(r,DATA.facts));assert.equal(V.object(r,DATA.facts,D).sourceMode,'fixed_snapshot');});
const base=DATA.records.find(r=>r.case==='baseline'),full=DATA.records.find(r=>r.case==='progressive'),cancel=DATA.records.find(r=>r.case==='cancel'),fault=DATA.records.find(r=>r.case==='fault');
test('old baseline still rejects step11',()=>{assert.equal(base.result.failedStep,11);assert.equal(base.result.status,'NATIVE_FAILED');});
test('full gradual trajectory recorded',()=>{assert.equal(full.result.status,'COMMITTED');assert.equal(full.result.steps.length,48);assert.equal(full.result.steps[0].fraction,1/32);});
test('real cancellation restores and does not commit',()=>{assert.equal(cancel.result.status,'CANCELLED');assert.equal(cancel.result.committedSteps,0);assert(cancel.result.independentRollback.equal);assert.equal(cancel.result.independentRollback.beforeSHA256,cancel.result.independentRollback.afterSHA256);});
test('injected real-step error has independent rollback hashes',()=>{assert.equal(fault.result.status,'FAILED_ROLLED_BACK');assert.equal(fault.result.failure.code,'INJECTED_TEST_FAILURE');assert.equal(fault.result.independentRollback.beforeSHA256,fault.result.independentRollback.afterSHA256);});
test('import cannot promote itself to a live source',()=>{const o=V.object(full,DATA.facts,D,true);assert.equal(o.sourceMode,'imported_unverified');assert.equal(o.checks.find(c=>c.id==='evidence:source').status,'UNKNOWN');});
test('import rollback self-claim remains unverified',()=>{const o=V.object(cancel,DATA.facts,D,true);assert.equal(o.checks.find(c=>c.id==='transaction:restore').status,'UNKNOWN');});
test('cancellation test is not a failed try-on requirement',()=>assert.equal(V.object(cancel,DATA.facts,D).checks.find(c=>c.id==='fit:initialization').status,'NOT_APPLICABLE'));
test('prior dynamic contact failure stays explicit historical data',()=>{assert(DATA.facts.previousContact.bodyMinimumSampleMM<0);assert.equal(DATA.facts.previousContact.retestedInS36,false);assert.equal(V.object(full,DATA.facts,D).checks.find(c=>c.id==='fit:dynamic').status,'UNKNOWN');});
test('observer normalization is pure',()=>{const b=JSON.stringify(DATA);DATA.records.forEach(r=>V.object(r,DATA.facts,D));assert.equal(JSON.stringify(DATA),b);});
test('defect bundle never authorizes repair',()=>{const b=P.defectBundle(DATA.records.map(r=>V.object(r,DATA.facts,D)),D);assert(b.defects.length);assert(b.defects.every(d=>!d.repairAuthorized&&d.verificationRequired));});
function bad(name,fn,rx){test(name,()=>{const r=clone(full);fn(r);assert.throws(()=>V.validate(r,DATA.facts),rx);});}
bad('source mismatch rejected',r=>r.source.commit='0'.repeat(40),/SOURCE_PIN/);
bad('module revision mismatch rejected',r=>r.moduleSHA256='0'.repeat(64),/VERSION/);
bad('false production authority rejected',r=>r.productionInstalled=true,/AUTHORITY/);
bad('changed gate rejected',r=>r.result.originalGate=2,/GATE/);
bad('missing final steps cannot claim commit',r=>r.result.steps.pop(),/INCOMPLETE/);
bad('wrong schedule rejected',r=>r.result.steps[0].fraction=1,/SCHEDULE/);
bad('body continuity mismatch rejected',r=>r.result.steps[0].bodyPreviousErrorM=.001,/COHERENCE/);
bad('nonfinite ratios rejected',r=>r.result.steps[0].maxActiveRatios[0]=Infinity,/STEP/);
test('bad rollback cannot validate as restored',()=>{const r=clone(cancel);r.result.independentRollback.equal=false;assert.throws(()=>V.validate(r,DATA.facts),/ROLLBACK/);});
const q=R+'/qa/review';fs.mkdirSync(q,{recursive:true});fs.writeFileSync(q+'/PROTOCOL.json',JSON.stringify({passed:true,count:checks.length,checks},null,2));
