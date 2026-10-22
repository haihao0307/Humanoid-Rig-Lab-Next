import assert from 'node:assert/strict';import fs from 'node:fs';
import {LocalContactSolver as G} from './_runtime/adaptive-solver.mjs';
const tests=[];function test(n,fn){fn();tests.push({name:n,passed:true});}
function fixture(){const p=new Float64Array([-.1,.002,-.1,.1,.002,-.1,0,.002,.1]),s={p,faces:new Int32Array([0,1,2]),count:3,w:new Float64Array([1,1,1])};
return{model:{source:s},world:{actor:{positions:new Float64Array([-1,0,-1,1,0,-1,1,0,1,-1,0,1])},body:{faces:new Int32Array([0,2,1,0,3,2])}},bodyMotionClock:0};}
const args={faceOffset:0,ids:[0,1,2],movable:[0,1,2],scale:1,guide:[0,-.003,0],normal:[0,-.002,0],margin:.004,pass:31};
test('feasible synthetic contact can still be accepted after preflight',()=>{const g=new G(fixture(),'local');g.begin(1);const r=g.choose(args);assert(r?.nodeMoves);assert(r.nodeMoves.every(m=>Math.abs(m.delta[1]-.002)<1e-7));assert.equal(g.stats.localAccepted,1);});
test('successful preview still does not write native arrays',()=>{const c=fixture(),p=Array.from(c.model.source.p),g=new G(c,'local');g.begin(1);g.choose(args);assert.deepEqual(Array.from(c.model.source.p),p);});
test('safe existing proposal bypasses unnecessary solve',()=>{const g=new G(fixture(),'local');g.begin(1);const guide=[0,.002,0];assert.deepEqual(g.choose({...args,guide}),guide);assert.equal(g.stats.localAttempts,0);});
test('unreachable synthetic clearance rejected without writes',()=>{const c=fixture(),p=Array.from(c.model.source.p),g=new G(c,'local');g.begin(1);assert.equal(g.choose({...args,margin:.2}),null);assert.deepEqual(Array.from(c.model.source.p),p);});
test('accepted synthetic experiment does not claim real garment success',()=>{const g=new G(fixture(),'local');assert.equal(g.report().fitCertified,false);});
const out={passed:true,count:tests.length,tests,syntheticOnly:true,realNativeCandidateAccepted:false};fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2));console.log(out);
