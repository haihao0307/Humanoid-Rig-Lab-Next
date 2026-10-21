import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath,pathToFileURL} from 'node:url';
const R=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),U=path.join(R,'_unit'),host=process.env.GARMENT_HOST;if(!host)throw Error('GARMENT_HOST_REQUIRED');fs.mkdirSync(U,{recursive:true});
for(const [src,name]of [[path.join(R,'local-solve.mjs'),'local-solve.mjs'],[path.join(R,'../hc-s3-11/joint-guard.mjs'),'rf311-joint-guard.mjs'],[path.join(R,'../hc-s3-7/contact-probe.mjs'),'rf37-contact-probe.mjs'],[path.join(host,'mesh-contact.mjs'),'mesh-contact.mjs']])fs.copyFileSync(src,path.join(U,name));
const {LocalContactSolver:G,minimumNormHalfspaces:qp,edgeIntegrity,POLICY}=await import(pathToFileURL(path.join(U,'local-solve.mjs')));
const tests=[];function test(name,f){f();tests.push({name,passed:true});console.log('PASS',name);}
test('orthogonal halfspaces solved',()=>{const q=qp([{a:[1,0],b:2},{a:[0,1],b:3}],2);assert(q.feasible);assert.deepEqual(q.delta,[2,3]);});
test('minimum norm diagonal projection',()=>{const q=qp([{a:[1,1],b:2}],2);assert(q.feasible);assert.deepEqual(q.delta,[1,1]);});
test('already feasible origin stays unchanged',()=>assert.deepEqual(qp([{a:[1],b:-2}],1).delta,[0]));
test('contradictory constraints not certified',()=>assert(!qp([{a:[1],b:2},{a:[-1],b:-1}],1).feasible));
test('zero gradient contradiction not certified',()=>assert(!qp([{a:[0],b:1}],1).feasible));
test('nonfinite row rejected',()=>assert.throws(()=>qp([{a:[NaN],b:1}],1)));
test('wrong row width rejected',()=>assert.throws(()=>qp([{a:[1,1],b:1}],1)));
test('zero DOF rejected',()=>assert.throws(()=>qp([],0)));
test('too-large scope rejected',()=>assert.throws(()=>qp([],99)));
test('invalid iteration budget rejected',()=>assert.throws(()=>qp([],1,0)));
function fixture(){const p=new Float64Array([-.1,.002,-.1,.1,.002,-.1,0,.002,.1]),s={p,faces:new Int32Array([0,1,2]),count:3,w:new Float64Array([1,1,1])};const positions=new Float64Array([-1,0,-1,1,0,-1,1,0,1,-1,0,1]),faces=new Int32Array([0,2,1,0,3,2]);return {model:{source:s},world:{actor:{positions},body:{faces}},bodyMotionClock:0};}
const args={faceOffset:0,ids:[0,1,2],movable:[0,1,2],scale:1,guide:[0,-.003,0],normal:[0,-.002,0],margin:.004,pass:31};
test('local solve finds move when both original proposals fail',()=>{const c=fixture(),g=new G(c,'local');g.begin(1);const r=g.choose(args);assert(r?.nodeMoves);assert.equal(g.stats.localAccepted,1);assert.equal(g.stats.blocked,0);assert(r.nodeMoves.every(m=>Math.abs(m.delta[1]-.002)<1e-7));});
test('preview leaves native positions byte-identical',()=>{const c=fixture(),before=Buffer.from(c.model.source.p.buffer).toString('hex'),g=new G(c,'local');g.begin(1);g.choose(args);assert.equal(Buffer.from(c.model.source.p.buffer).toString('hex'),before);});
test('old safe guide path stays unchanged',()=>{const c=fixture(),g=new G(c,'local');g.begin(1);const guide=[0,.002,0];assert.deepEqual(g.choose({...args,guide}),guide);assert.equal(g.stats.localAttempts,0);});
test('failed capped solve preserves original state',()=>{const c=fixture(),g=new G(c,'local'),before=Array.from(c.model.source.p);g.begin(1);assert.equal(g.choose({...args,margin:.2}),null);assert.equal(g.stats.localRejected,1);assert.deepEqual(Array.from(c.model.source.p),before);});
test('frame accounting includes local accepted category',()=>{const g=new G(fixture(),'local');g.begin(1);g.choose(args);const s=g.end();assert.equal(s.calls,s.guideAccepted+s.normalAccepted+s.blocked+s.localAccepted);assert(s.guardWallMS>=s.localMS);});
test('reference ordinary calls never apply new solve',()=>{const g=new G(fixture(),'reference');g.begin(1);assert.equal(g.choose(args),null);assert.equal(g.stats.localAccepted,0);});
test('invalid mode rejected',()=>assert.throws(()=>new G(fixture(),'production')));
test('explicit finite search and motion bounds retained',()=>{assert.equal(POLICY.maxNodes,24);assert.equal(POLICY.outerIterations,12);assert.equal(POLICY.maxMoveM,.02);assert.equal(POLICY.linearToleranceM,1e-7);});
test('edge check rejects severe local distortion',()=>{const a=new Float64Array([0,0,0,1,0,0,0,1,0]),b=a.slice();b[3]=2;assert(!edgeIntegrity(a,b,new Int32Array([0,1,2]),[0]).passed);});
test('rigid translation preserves edge ratios',()=>{const a=new Float64Array([0,0,0,1,0,0,0,1,0]),b=a.map(v=>v+1);assert(edgeIntegrity(a,b,new Int32Array([0,1,2]),[0]).passed);});
test('local endpoint checks are not CCD certification',()=>{const g=new G(fixture(),'local');assert.equal(g.report().continuousCollision,false);assert.equal(g.report().fitCertified,false);});
fs.mkdirSync(path.join(R,'qa/source'),{recursive:true});fs.writeFileSync(path.join(R,'qa/source/UNIT.json'),JSON.stringify({passed:true,count:tests.length,tests,syntheticOnly:true},null,2));
