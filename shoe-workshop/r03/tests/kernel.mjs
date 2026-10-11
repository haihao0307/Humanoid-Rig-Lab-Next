import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as K from '../src/edge-kernel.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),data=JSON.parse(fs.readFileSync(path.join(root,'../r02/assets/teacher.json'))),checks=[];
function test(name,fn){fn();checks.push({name,passed:true});}
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),before=hash(data),zero=Object.fromEntries(['toe','ball','waist','instep','ankle','sole'].map(k=>[k,0]));
const square=K.boundary([[0,0],[10,0],[10,10],[0,10],[0,0]]),state=K.propose(data,zero);
test('closed boundary perimeter and exact corner',()=>{assert.equal(square.length,40);assert.deepEqual(K.pointAt(square,20),[10,10]);});
test('wraparound arc',()=>assert.ok(Math.abs(K.edgeLength(square,{start:.9,end:.1,forward:true})-8)<1e-12));
test('nearest point lies on actual boundary',()=>{const q=K.closest(square,[4,-2]);assert.equal(q.arcMm,4);assert.equal(q.distance,2);});
test('duplicate points do not create division by zero',()=>assert.equal(K.boundary([[0,0],[0,0],[10,0],[10,10],[0,10]]).length,40));
test('reject zero area',()=>assert.throws(()=>K.boundary([[0,0],[1,0],[2,0]])));
test('reject nonfinite points',()=>assert.throws(()=>K.boundary([[0,0],[NaN,0],[1,1]])));
test('reject coincident endpoints',()=>assert.throws(()=>K.edgeLength(square,{start:.1,end:.1,forward:true})));
test('default uses two actual Uppers not a fabricated mesh or sole',()=>{assert.notEqual(state.a.panelId,state.b.panelId);for(const k of ['a','b'])assert.match(data.panels.find(p=>p.objectIndex===state[k].panelId).layer,/Upper/);});
for(const p of data.panels)for(let c=0;c<p.footprints.length;c++){
 test(`P${p.objectIndex} component ${c}: original-boundary sampling and reversal`,()=>{
  const b=K.boundary(p.footprints[c].outer),e=K.suggestEdge(b),r=K.reverseEdge(e);assert.ok(K.edgeLength(b,e)>0);
  assert.ok(Math.abs(K.edgeLength(b,e)-K.edgeLength(b,r))<1e-7);
  for(let i=0;i<=20;i++){const q=K.edgePoint(b,e,i/20);assert.ok(K.closest(b,q).distance<1e-6);const z=K.edgePoint(b,r,1-i/20);assert.ok(Math.hypot(q[0]-z[0],q[1]-z[1])<1e-6);}
  const pts=K.edgePolyline(b,e),len=pts.slice(1).reduce((s,q,i)=>s+Math.hypot(q[0]-pts[i][0],q[1]-pts[i][1]),0);assert.ok(Math.abs(len-K.edgeLength(b,e))<1e-6);
 });
}
test('all displayed registration marks on native boundaries',()=>{const r=K.audit(data,state,zero);for(const k of ['a','b']){const b=K.getBoundary(data,state[k]);for(const m of r.marks)assert.ok(K.closest(b,m[k]).distance<1e-6);}});
test('actual intervals expose unequal pitches',()=>{const r=K.audit(data,state,zero);assert.ok(Math.abs(r.pitchAmm*r.intervals-r.aLengthMm)<1e-6);assert.ok(Math.abs(r.pitchBmm*r.intervals-r.bLengthMm)<1e-6);});
test('last modification invalidates source-pattern assumption',()=>{const r=K.audit(data,state,{...zero,toe:1});assert.equal(r.lastStale,true);assert.equal(r.lastDeformed,true);assert.equal(r.assemblyReady,false);});
test('saving against a changed last cannot certify raw patterns',()=>{const d={...zero,toe:1},r=K.audit(data,K.propose(data,d),d);assert.equal(r.lastStale,false);assert.equal(r.lastDeformed,true);assert.equal(r.status,'LAST_CHANGED_REVIEW_REQUIRED');});
test('same length is never a manufacturing certificate',()=>{const r=K.audit(data,state,zero);assert.equal(r.manufacturable,false);assert.equal(r.assemblyReady,false);});
test('save restore exact state',()=>assert.deepEqual(K.validate(data,JSON.parse(JSON.stringify(state))),state));
for(const [name,edit]of Object.entries({missingPanel:s=>s.a.panelId=999,missingComponent:s=>s.a.component=99,wrongSource:s=>s.sourceKey='other',wrongUnits:s=>s.units='m',nonfinitePitch:s=>s.pitchMm=Infinity,samePanel:s=>s.b.panelId=s.a.panelId})){test('reject '+name,()=>{const s=structuredClone(state);edit(s);assert.throws(()=>K.validate(data,s));});}
test('import cannot promote acceptance flags',()=>{const s=K.validate(data,{...state,semantics:'CERTIFIED',manufacturable:true,assembly:'READY'});assert.equal(s.semantics,'UNCONFIRMED');assert.equal(s.assembly,'NOT_IMPLEMENTED');assert.equal(s.manufacturable,undefined);});
test('native mesh, indices, holes and source coordinates remain byte-equivalent',()=>assert.equal(hash(data),before));
fs.mkdirSync(path.join(root,'evidence/numerics'),{recursive:true});fs.writeFileSync(path.join(root,'evidence/numerics/QA.json'),JSON.stringify({version:'R03-A',sourceBuild:process.env.GITHUB_SHA||'local',checks,sourceDataBefore:before,sourceDataAfter:hash(data),defaultAudit:K.audit(data,state,zero),scope:'native edge registration; not assembly, leather quality or physical validation'},null,2));
console.log(JSON.stringify({passed:checks.length,defaultA:state.a,defaultB:state.b,audit:K.audit(data,state,zero)},null,2));
