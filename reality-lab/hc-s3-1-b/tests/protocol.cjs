const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=path.resolve(__dirname,'..'),K=require('../knit-bridge.js'),P=require('../../hc-s2-1/protocol.js'),A=require('../../hc-s3-1/bridge.js');
const base=require('../../hc-s2-1/measurement-dictionary.json'),history=require('../../hc-s3/material-snapshots.json'),M=JSON.parse(fs.readFileSync(R+'/BUILD_MANIFEST.json','utf8')),D=K.dictionary(base,history),checks=[];
const clone=x=>JSON.parse(JSON.stringify(x));function test(name,f){f();checks.push({name,passed:true});console.log('PASS',name);}
function fixture(){const values=[16,20,.0058,.0029,.00172,.00175,307200,30720,1,.95,.00095,null,null,null];return {schema:'kaopu/reality-workbench-export@1',exporterVersion:'0.3.1-b',fixtureOnly:true,objectId:'fabric-knit-public-p02-c2',family:'knit',domain:'fabric',source:clone(M.sources.knit),capture:{sequence:1,nativeBuild:1,nativeFrame:1,capturedAt:'2026-10-20T00:00:00Z',elapsedMs:1,integrityMode:'metadata_and_samples'},measurements:K.SPECS.map(([id,label,unit,status,basis],i)=>({id,label,unit,status,basis,value:values[i],method:'synthetic contract fixture, not native execution'})),requested:{mode:'fiber',shape:'jersey',pattern:'plain',color:'#d3c4af',fuzz:1,length:.95,detail:1,twist:.55,mottle:.18},shaderInputs:{length:.95,density:1,active:true},geometry:{gridColumns:16,gridRows:20,carrierVertices:270400,carrierTriangles:491520,shortInstances:307200,surfaceInstances:30720,sampleStrand:[.001,0,0],sampleCurve:[0,0,0]},capabilities:{clothPhysics:false,materialSpaceBindingToGarment:false,physicalCalibration:false},preservation:{passed:true,before:'fixture',after:'fixture',scope:'synthetic'},authorities:{sourceWriteAPI:false,repairAuthorized:false,physicalCertification:false,manufacturingCertification:false,productionReady:false}};}
function rejected(name,change,rx){test(name,()=>{const x=fixture();change(x);assert.throws(()=>K.validate(x,M.sources.knit),rx);});}
test('unmodified old protocol version',()=>assert.equal(P.VERSION,'0.2.0'));
test('extended definitions pass old validator',()=>P.validateDictionary(D));
test('source dictionary not mutated',()=>{const b=JSON.stringify(base);K.dictionary(base,history);assert.equal(JSON.stringify(base),b);});
test('known synthetic record validates',()=>assert(K.validate(fixture(),M.sources.knit)));
test('live common object preserves raw identity',()=>{const x=fixture(),o=K.knit(x,D,M.sources.knit);assert.equal(o.schema,P.OBJECT_SCHEMA);assert.equal(o.sourceMode,'live_read_only');assert.deepEqual(o.extensions.originalExport,x);});
test('import cannot be promoted to live by a field',()=>{const x=fixture();x.sourceMode='live_read_only';const o=K.knit(x,D,M.sources.knit,true);assert.equal(o.sourceMode,'imported_unverified');assert(o.checks.some(c=>c.id==='source:transport'&&c.status==='UNKNOWN'));});
test('generated grid never becomes physical measured',()=>{const o=K.knit(fixture(),D,M.sources.knit);assert(o.measurements.every(m=>m.basis!=='physical_measured'));});
test('physics explicitly absent and not certified',()=>{const o=K.knit(fixture(),D,M.sources.knit);assert(o.checks.some(c=>c.id==='physical:solver'&&c.status==='NOT_APPLICABLE'));assert.equal(o.productionReady,false);assert.equal(o.physicalCertification,false);});
test('unknown physical measures remain null',()=>{const o=K.knit(fixture(),D,M.sources.knit);assert.equal(o.measurements.filter(m=>m.status==='UNKNOWN'&&m.value===null).length,3);});
test('defects remain read only',()=>{const o=K.knit(fixture(),D,M.sources.knit);assert(o.defects.length>0);assert(o.defects.every(d=>!d.repairAuthorized&&d.verificationRequired));});
// Full rejected source verified from guilin-dem-pipeline PR291, not reconstructed.
rejected('rejected P03 commit not accepted',x=>x.source.commit='a51a5e4f429b91eb4d9d2d2bfc361863a81f6d9d',/SOURCE_REVISION/);
rejected('truncated commit independently rejected',x=>x.source.commit='a51a5e4f429b91eb4d9d2d2bfc361863a81f6d9',/完整提交/);
rejected('old R15 identity not relabelled current P02',x=>x.objectId='fabric-knit-r15',/IDENTITY/);
rejected('changed source digest rejected',x=>x.source.sha256='0'.repeat(64),/SOURCE_REVISION/);
rejected('other domain not accepted',x=>x.domain='architecture',/IDENTITY/);
rejected('millimetres cannot masquerade as metres',x=>x.measurements[2].value=5.8,/RELATION/);
rejected('linear density cannot be length',x=>x.measurements[2].unit='tex',/SEMANTICS/);
rejected('R15 thickness estimate cannot fill P02',x=>x.measurements[11].value=.002970454374010845,/NULL/);
rejected('mass missing is not zero',x=>x.measurements[12].value=0,/NULL/);
rejected('runtime cannot claim physical measured',x=>x.measurements[3].basis='physical_measured',/SEMANTICS/);
rejected('display carrier diameter cannot claim unqualified pass',x=>x.measurements[4].status='PASS',/SEMANTICS/);
rejected('negative numeric value rejected',x=>x.measurements[5].value=-1,/NUMBER/);
rejected('numeric string rejected',x=>x.measurements[2].value='.0058',/NUMBER/);
rejected('duplicate record rejected',x=>x.measurements[3].id=x.measurements[2].id,/SEMANTICS/);
rejected('extra record rejected',x=>x.measurements.push(x.measurements[0]),/SET/);
rejected('GPU nonfinite rejected',x=>x.shaderInputs.density=Infinity,/GPU_INPUT/);
rejected('active old GPU value rejected',x=>x.shaderInputs.length=.5,/FRAME_PENDING/);
rejected('hidden shader not called active',x=>x.shaderInputs.active=false,/DRAW_ACTIVITY/);
rejected('fictional cloth physics rejected',x=>x.capabilities.clothPhysics=true,/CAPABILITY/);
rejected('repair escalation rejected',x=>x.authorities.repairAuthorized=true,/AUTHORITY/);
rejected('geometry count drift rejected',x=>x.geometry.carrierVertices--,/LAYOUT/);
rejected('incorrect tip formula rejected',x=>x.measurements[10].value=.04,/FORMULA/);
rejected('preservation mismatch rejected',x=>x.preservation.after='different',/PRESERVATION/);
rejected('capture time required',x=>x.capture.capturedAt='bad',/CAPTURE/);
rejected('invalid integrity mode rejected',x=>x.capture.integrityMode='whole-world-certified',/INTEGRITY/);
test('hidden layer retains last GPU upload without false live contribution',()=>{const x=fixture();x.requested.mode='carrier';x.measurements[8].value=0;x.shaderInputs.active=false;assert(K.validate(x,M.sources.knit));assert(K.knit(x,D,M.sources.knit).checks.some(c=>c.id==='native:draw'&&c.status==='NOT_APPLICABLE'));});
for(const old of history.objects)test('history '+old.family+' identity and basis retained',()=>{const o=K.historyObject(old,D);assert.equal(o.sourceMode,'fixed_snapshot');assert.deepEqual(o.extensions.originalS3Object,old);});
test('old native denim normalization unchanged',()=>{const input=JSON.parse(fs.readFileSync(path.join(R,'../hc-s3-1/qa/public/NATIVE_EXPORT.json'),'utf8'));assert.deepEqual(K.normalize(input,D,M.sources),A.live(input,D,M.sources.denim));});
test('oversized malformed JSON rejected',()=>{assert.throws(()=>K.parse(' '.repeat(K.MAX_BYTES+1)));assert.throws(()=>K.parse('{'));});
test('sample export and common bundle are valid JSON',()=>{const o=K.knit(fixture(),D,M.sources.knit);assert.equal(JSON.parse(JSON.stringify(P.aggregate([o],D))).schema,P.BUNDLE_SCHEMA);});
const q=R+'/qa/source';fs.mkdirSync(q,{recursive:true});fs.writeFileSync(q+'/PROTOCOL.json',JSON.stringify({passed:true,count:checks.length,checks,syntheticFixturesOnly:true},null,2));
