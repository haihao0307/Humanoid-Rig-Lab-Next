import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath,pathToFileURL} from 'node:url';
const R=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),U=path.join(R,'_unit'),host=process.env.GARMENT_HOST;if(!host)throw Error('GARMENT_HOST_REQUIRED');fs.mkdirSync(U,{recursive:true});
for(const [src,name]of [[path.join(R,'joint-guard.mjs'),'joint-guard.mjs'],[path.join(R,'../hc-s3-7/contact-probe.mjs'),'rf37-contact-probe.mjs'],[path.join(host,'mesh-contact.mjs'),'mesh-contact.mjs']])fs.copyFileSync(src,path.join(U,name));
const {jointDecision:D,JointMoveGuard:G,TOLERANCE_M}=await import(pathToFileURL(path.join(U,'joint-guard.mjs'))),{triangleCrossing}=await import(pathToFileURL(path.join(U,'rf37-contact-probe.mjs')));
const tests=[];function test(name,f){f();tests.push({name,passed:true});console.log('PASS',name);}
function shape(values,pairs=[]){return {samples:values.map((v,i)=>({id:i===values.length-1?'c0':'v'+i,distanceM:v})),crossingPairs:pairs};}
test('safe centroid and vertices accepted',()=>assert(D(shape([.005,.002]),shape([.005,.004]),.004,'c0').allowed));
test('positive corner must not become negative',()=>assert(!D(shape([.002,-.00005]),shape([-.00067,.001]),.001,'c0').allowed));
test('existing penetration cannot worsen',()=>assert(!D(shape([-.003,-.004]),shape([-.004,-.002]),.001,'c0').allowed));
test('clearance above margin may decrease without a false conflict',()=>assert(D(shape([.02,-.001]),shape([.005,.004]),.004,'c0').allowed));
test('progress is required at acted centroid',()=>assert(!D(shape([.005,.002]),shape([.006,.002]),.004,'c0').allowed));
test('new intersection pair is rejected even with positive samples',()=>assert(!D(shape([.005,.002]),shape([.005,.004],['0:6']),.004,'c0').allowed));
test('old intersections remaining are labelled residual not certified',()=>{const r=D(shape([.005,.002],['0:6']),shape([.005,.004],['0:6']),.004,'c0');assert(r.allowed);assert.equal(r.remainingCrossingPairs,1);});
test('pair identity matters, not just equal intersection counts',()=>assert(!D(shape([.005,.002],['0:6']),shape([.005,.004],['0:9']),.004,'c0').allowed));
test('nonfinite input rejected',()=>assert.throws(()=>D(shape([.005,NaN]),shape([.006,.004]),.004,'c0')));
test('sample identity drift rejected',()=>{const a=shape([.005,.002]),b=shape([.005,.004]);b.samples[0].id='wrong';assert.throws(()=>D(a,b,.004,'c0'));});
test('missing centroid rejected',()=>assert.throws(()=>D(shape([.005,.002]),shape([.005,.004]),.004,'not-found')));
test('invalid margin rejected',()=>assert.throws(()=>D(shape([.005,.002]),shape([.005,.004]),0,'c0')));
test('tolerance is numerical 0.0001mm, not enlarged clearance',()=>assert.equal(TOLERANCE_M,1e-7));
function fixture(){const p=new Float64Array([-.1,.002,-.1,.1,.002,-.1,0,.002,.1]),s={p,faces:new Int32Array([0,1,2]),count:3};const positions=new Float64Array([-1,0,-1,1,0,-1,1,0,1,-1,0,1]),faces=new Int32Array([0,2,1,0,3,2]);return {model:{source:s},world:{actor:{positions},body:{faces}},bodyMotionClock:0};}
const args={faceOffset:0,ids:[0,1,2],movable:[0,1,2],scale:1,guide:[0,.002,0],normal:[0,-.003,0],margin:.004,pass:31};
test('geometry gate accepts original safe full guide',()=>{const c=fixture(),g=new G(c,'guarded');g.begin(1);assert.deepEqual(g.choose(args),args.guide);assert.equal(g.stats.guideAccepted,1);});
test('all proposal trials leave actual solver arrays unchanged',()=>{const c=fixture(),before=Buffer.from(c.model.source.p.buffer).toString('hex'),g=new G(c,'guarded');g.begin(1);g.choose(args);assert.equal(Buffer.from(c.model.source.p.buffer).toString('hex'),before);});
test('unsafe guide uses already available normal when jointly safe',()=>{const c=fixture(),g=new G(c,'guarded');g.begin(1);const normal=[0,.002,0];assert.deepEqual(g.choose({...args,guide:[0,-.003,0],normal}),normal);assert.equal(g.stats.normalAccepted,1);});
test('both unsafe yields explicit block not a zero-distance solve',()=>{const c=fixture(),g=new G(c,'guarded');g.begin(1);assert.equal(g.choose({...args,guide:[0,-.003,0],normal:[0,-.002,0]}),null);assert.equal(g.stats.blocked,1);});
test('unknown mode rejected',()=>assert.throws(()=>new G(fixture(),'live')));
test('nonfinite proposal rejected before source mutation',()=>{const c=fixture(),old=Array.from(c.model.source.p),g=new G(c,'guarded');g.begin(1);assert.throws(()=>g.choose({...args,guide:[NaN,0,0]}));assert.deepEqual(Array.from(c.model.source.p),old);});
test('baseline nonregression calls do not evaluate or rewrite',()=>{const c=fixture(),g=new G(c,'baseline');g.begin(1);assert.equal(g.choose(args),args.guide);assert.equal(g.stats.calls,0);});
test('same-frame reports account for all decisions',()=>{const g=new G(fixture(),'guarded');g.begin(1);g.choose(args);g.choose({...args,guide:[0,-.003,0],normal:[0,-.002,0]});const r=g.end();assert.equal(r.calls,r.guideAccepted+r.normalAccepted+r.blocked);assert.equal(g.report().fitCertified,false);});
test('strict triangle crossing example is detected',()=>assert(triangleCrossing([[-1,0,-1],[1,0,-1],[0,0,1]],[[0,-1,0],[0,1,0],[.3,1,.3]])));
test('separated triangles not reported crossing',()=>assert.equal(triangleCrossing([[-1,0,-1],[1,0,-1],[0,0,1]],[[-1,1,-1],[1,1,-1],[0,1,1]]),null));
fs.mkdirSync(path.join(R,'qa/source'),{recursive:true});fs.writeFileSync(path.join(R,'qa/source/UNIT.json'),JSON.stringify({passed:true,count:tests.length,tests,syntheticOnly:true,physicalCertification:false},null,2));
