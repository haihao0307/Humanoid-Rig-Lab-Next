import {registerHooks} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const base=new URL('../',import.meta.url);
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(new URL(f,base))).digest('hex');
const sourceHashes=Object.fromEntries(['ShortsSkinContactBody.mjs','ShortsPaperContactStepDomain.mjs'].map(f=>[f,hash(f)]));
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('vendor/three.module.js',base).href,shortCircuit:true}:next(s,c);}});
const THREE=await import('three');
const {createShortsSkinContactBody}=await import('../ShortsSkinContactBody.mjs');
const {paperFormingContactStepDomain:domain}=await import('../ShortsPaperContactStepDomain.mjs');
// Analytic/mock oracles only: no source human, saved clothing XYZ or renderer.
const cases=[],evidence={};
const test=(name,fn)=>{try{fn();cases.push({name,passed:true});}catch(e){cases.push({name,passed:false,error:e.stack});}};
const close=(a,b,t=1e-10)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const V=(a)=>new THREE.Vector3().fromArray(a);
function fixture({nativePoint=[.027293,.005,0],barePoint=[.3,0,0],bareInside=false,bareAmbiguous=false}={}){
 const controls={revision:1,hitRevision:1,bareRevision:1,bareHitRevision:1,nativePoint:V(nativePoint),barePoint:V(barePoint),bareInside,bareAmbiguous,lastBound:null,queryMutation:false,bareQueryMutation:false};
 const native={snapshot:()=>({contactExcludedParts:[9,10,19],revision:controls.revision}),triangles:[{part:15,indices:[0,1,2]},{part:15,indices:[1,2,3]}],positions:new Float64Array([-.04,0,-.05,.04,0,-.05,-.04,1,.05,.04,1,.05]),closestPoint(p,bound){
  controls.lastBound=bound;const delta=p.clone().sub(controls.nativePoint),distance=delta.length();if(distance>=bound)return null;
  const hit={point:controls.nativePoint.clone(),distance,signedDistance:-distance,normal:delta.divideScalar(-distance),part:15,triangleId:0,revision:controls.hitRevision,signAmbiguous:false};
  if(controls.queryMutation)controls.revision++;return hit;
 }};
 const bare={mesh:{isSkinnedMesh:true},report:{closedSolidTopologyCertified:true},queryAPI:{get revision(){return controls.bareRevision;},closestPoint(p){const delta=p.clone().sub(controls.barePoint),distance=delta.length(),sign=controls.bareInside?-1:1;const hit={point:controls.barePoint.clone(),distance,signedDistance:sign*distance,normal:delta.multiplyScalar(sign/distance),closedSolidTopologyCertified:true,signAmbiguous:controls.bareAmbiguous,part:'authored-bare-pelvis',revision:controls.bareHitRevision};if(controls.bareQueryMutation)controls.bareRevision++;return hit;}}};
 return {controls,native,bare,body:createShortsSkinContactBody(native,bare)};
}
test('new actual-wrapper surface API stays unsigned-continuous across 20nm AABB boundary',()=>{
 const {body}=fixture(),a=body.closestSurfacePoint([0,-1e-8,0]),b=body.closestSurfacePoint([0,1e-8,0]);
 assert.ok(a.signedDistance>0&&b.signedDistance>0);assert.equal(a.part,b.part);
 assert.ok(Math.abs(a.signedDistance-b.signedDistance)<=2e-8+1e-14);
 assert.equal(body.snapshot().nativeOutsideCorrections,0);
 evidence.aabb={queryDisplacementM:2e-8,distanceChangeM:Math.abs(a.signedDistance-b.signedDistance),noAabbSignOverride:true};
});
test('true unsigned minimum selects native/bare and bounds native search by bare distance',()=>{
 const {body,controls}=fixture(),p=[0,.2,.02],a=body.closestSurfacePoint(p),expected=Math.hypot(...p.map((v,k)=>v-controls.nativePoint.getComponent(k)));
 close(a.unsignedSurfaceDistanceM,expected);assert.equal(a.part,15);
 close(controls.lastBound,Math.hypot(...p.map((v,k)=>v-controls.barePoint.getComponent(k))));
 controls.nativePoint.set(2,2,2);const b=body.closestSurfacePoint(p);assert.equal(b.part,'authored-bare-pelvis');close(b.unsignedSurfaceDistanceM,controls.lastBound);
});
test('closed bare negative membership is retained even when native unsigned distance is nearer',()=>{
 const {body}=fixture({nativePoint:[.01,0,0],barePoint:[.02,0,0],bareInside:true}),h=body.closestSurfacePoint([0,0,0]);
 assert.equal(h.part,'authored-bare-pelvis');assert.equal(h.bareClosedInsideObserved,true);close(h.signedDistance,-.02);close(h.unsignedSurfaceDistanceM,.01);
 assert.equal(domain(new Float64Array([.01,0,0]),[{indices:[0],weights:[1]}],{minimumDistanceM:h.unsignedSurfaceDistanceM,clearanceM:.004}).status,'SAMPLED_SURFACE_STEP_BOUND');
 assert.equal(domain(new Float64Array([.01,0,0]),[{indices:[0],weights:[1]}],{minimumDistanceM:h.signedDistance,clearanceM:.004}).status,'HOLD');
});
test('radial distance gradient matches FD away from nearest-feature switches',()=>{
 const {body}=fixture(),p=[-.02,.1,.03],h=body.closestSurfacePoint(p),eps=1e-7;
 close(h.normal.length(),1);for(let k=0;k<3;k++){const a=p.slice(),b=p.slice();a[k]+=eps;b[k]-=eps;close((body.closestSurfacePoint(a).signedDistance-body.closestSurfacePoint(b).signedDistance)/(2*eps),h.normal.getComponent(k),2e-9);}
 close(V(p).sub(h.point).dot(h.normal),h.signedDistance);
});
test('bare ambiguity and zero surface distance cannot be accepted as strict sample clearance',()=>{
 const f=fixture({bareAmbiguous:true});assert.equal(f.body.closestSurfacePoint([0,.1,0]).signAmbiguous,true);
 const z=fixture({nativePoint:[0,.1,0]}).body.closestSurfacePoint([0,.1,0]);assert.equal(z.signAmbiguous,true);assert.equal(z.signedDistance,0);
 assert.equal(domain(new Float64Array([0,0,0]),[{indices:[0],weights:[1]}],{minimumDistanceM:0,clearanceM:.004}).status,'HOLD');
});
test('current geometry revision propagates and stale native hit is rejected atomically',()=>{
 const f=fixture();assert.equal(f.body.closestSurfacePoint([0,.1,0]).geometryRevision,1);f.controls.revision=2;f.controls.hitRevision=2;
 assert.equal(f.body.closestSurfacePoint([0,.1,0]).geometryRevision,2);f.controls.hitRevision=1;
 assert.throws(()=>f.body.closestSurfacePoint([0,.1,0]),/revision|stale|changed|rebuilt/i);
});
test('geometry revision changing during one query is rejected',()=>{
 const f=fixture();f.controls.queryMutation=true;assert.throws(()=>f.body.closestSurfacePoint([0,.1,0]),/revision|stale|changed|rebuilt/i);
});
test('native triangle ownership replacement requires a recreated wrapper',()=>{
 const f=fixture();f.native.triangles=f.native.triangles.map(t=>({...t}));assert.throws(()=>f.body.closestSurfacePoint([0,.1,0]),/ownership|changed|rebuilt|recreate/i);
});
test('bare revision remains independently authoritative; stale or mid-query mutation rejects',()=>{
 const f=fixture();f.controls.bareRevision=7;f.controls.bareHitRevision=7;
 const h=f.body.closestSurfacePoint([0,.1,0]);assert.equal(h.geometryRevision,1);assert.equal(h.bareGeometryRevision,7);
 f.controls.bareHitRevision=6;assert.throws(()=>f.body.closestSurfacePoint([0,.1,0]),/revision/i);
 f.controls.bareHitRevision=7;f.controls.bareQueryMutation=true;assert.throws(()=>f.body.closestSurfacePoint([0,.1,0]),/revision/i);
});
test('1-Lipschitz cap protects every sampled point on the complete sphere path',()=>{
 const xyz=[[1.02,0,0],[1.03,.01,0]],delta=new Float64Array([-.1,0,0,-.08,0,0]),samples=[{indices:[0],weights:[1]},{indices:[1],weights:[1]},{indices:[0,1],weights:[.4,.6]}];
 const point=(s,t)=>[0,1,2].map(k=>s.indices.reduce((sum,id,j)=>sum+s.weights[j]*(xyz[id][k]+t*delta[id*3+k]),0));
 const distance=p=>Math.hypot(...p)-1,minimumDistanceM=Math.min(...samples.map(s=>distance(point(s,0)))),r=domain(delta,samples,{minimumDistanceM,clearanceM:.004});
 assert.equal(r.status,'SAMPLED_SURFACE_STEP_BOUND');let minimum=Infinity;
 for(let step=0;step<=200;step++)for(const s of samples){const d=distance(point(s,r.maximumFraction*step/200));minimum=Math.min(minimum,d);assert.ok(d>.004);}
 assert.equal(r.fullTriangleCCD,false);assert.equal(r.solidUnionCertified,false);assert.equal(r.sampledPointPathClearanceOnly,true);
 evidence.sphere={fraction:r.maximumFraction,minimumPathSampledDistanceM:minimum,strictClearanceM:.004};
});
test('plane path cap uses actual barycentric displacement including cancellation and repeated DOFs',()=>{
 const delta=new Float64Array([0,0,-.03,0,0,.01]),samples=[{indices:[0,0,1],weights:[.25,.25,.5]}],r=domain(delta,samples,{minimumDistanceM:.012,clearanceM:.004});
 close(r.maximumSampleDisplacementM,.01);close(r.maximumFraction,.792);
 for(let step=0;step<=200;step++)assert.ok(.012-r.maximumFraction*step/200*.01>.004);
 const cancelled=domain(new Float64Array([.01,0,0,-.01,0,0]),[{indices:[0,1],weights:[.5,.5]}],{minimumDistanceM:.012,clearanceM:.004});
 close(cancelled.maximumSampleDisplacementM,0);assert.equal(cancelled.maximumFraction,1);
});
test('zero proposal remains valid only with strict existing clearance',()=>{
 const delta=new Float64Array(3),samples=[{indices:[0],weights:[1]}];
 assert.equal(domain(delta,samples,{minimumDistanceM:.005,clearanceM:.004}).maximumFraction,1);
 for(const d of [.004,.003,-.01])assert.equal(domain(delta,samples,{minimumDistanceM:d,clearanceM:.004}).status,'HOLD');
});
test('empty sample set grants no whole-surface, solid or motion certificate',()=>{
 const r=domain(new Float64Array([0,0,0]),[],{minimumDistanceM:.012,clearanceM:.004});
 assert.equal(r.maximumSampleDisplacementM,0);assert.equal(r.worstSample,null);
 assert.equal(r.fullTriangleCCD,false);assert.equal(r.solidUnionCertified,false);assert.equal(r.motionValidated,false);assert.equal(r.wearingAccepted,false);
});
test('invalid input and invalid sample authority reject without caller mutation',()=>{
 const delta=new Float64Array([0,0,-.01]),s=[{indices:[0],weights:[1]}],saved=JSON.stringify({delta:Array.from(delta),s}),options={minimumDistanceM:.012,clearanceM:.004};
 for(const d of [[NaN,0,0],[Infinity,0,0],[0,0]])assert.throws(()=>domain(d,s,options));
 for(const sample of [{indices:[1],weights:[1]},{indices:[0],weights:[0]},{indices:[0],weights:[.5]},{indices:[0],weights:[NaN]},{indices:[],weights:[]}])assert.throws(()=>domain(delta,[sample],options));
 for(const o of [{...options,minimumDistanceM:Infinity},{...options,clearanceM:0},{...options,interiorFraction:1},{...options,interiorFraction:0}])assert.throws(()=>domain(delta,s,o));
 const body=fixture().body;for(const p of [[NaN,0,0],[Infinity,0,0],[0,0]])assert.throws(()=>body.closestSurfacePoint(p));
 domain(delta,s,options);assert.equal(JSON.stringify({delta:Array.from(delta),s}),saved);
});
test('pure wrapper calls preserve source geometry, query input and test-bound production SHA',()=>{
 const f=fixture(),input=[0,.1,.01],before=JSON.stringify({input,triangles:f.native.triangles,positions:Array.from(f.native.positions)});
 f.body.closestSurfacePoint(input);f.body.closestSurfacePoint(input);
 assert.equal(JSON.stringify({input,triangles:f.native.triangles,positions:Array.from(f.native.positions)}),before);
 assert.deepEqual(Object.fromEntries(Object.keys(sourceHashes).map(f=>[f,hash(f)])),sourceHashes);
});
const report={schema:'independent-surface-contact-step-domain@1',createdAt:new Date().toISOString(),scope:'PURE_ORACLE_AND_ANALYTIC_FIXTURES_ONLY; no human, renderer, wearing or CCD certificate',sourceHashes,passed:cases.filter(c=>c.passed).length,total:cases.length,cases,evidence,nativeSteps:0,wholeTriangleCCD:false,solidUnionCertified:false,motionValidated:false};
const arg=process.argv.indexOf('--report');if(arg>=0)fs.writeFileSync(path.resolve(process.argv[arg+1]),JSON.stringify(report,null,2),{flag:'wx'});
console.log(JSON.stringify(report,null,2));if(report.passed<report.total)process.exitCode=1;
