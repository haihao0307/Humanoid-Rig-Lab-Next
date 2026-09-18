import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL('../clothing/'+file,import.meta.url),'utf8');
const {Contact,features,closest,createDofs}=new Function(read('ShortsStitchDofs.js')+'\n'+read('ShortsTriangleBodyContact.js')+';return {Contact:ShortsTriangleBodyContact,features:shortsTriangleBodyFeatures,closest:stbcClosestTriangle,createDofs:createShortsStitchDofs};')();
const distance=(a,b)=>Math.hypot(...a.map((x,k)=>x-b[k]));
const mix=(ps,w)=>[0,1,2].map(k=>ps.reduce((s,p,i)=>s+w[i]*p[k],0));
const particle=(pos,mass=1)=>({pos:[...pos],previous:pos.map((v,k)=>v+(k===2?.00001:0)),uv:pos.slice(0,2),mass,invMass:1/mass});
const cloth=()=>[[-.2,-.2,0],[.2,-.2,0],[0,.2,0]].map(p=>particle(p));
const records=[{indices:[0,1,2],pieceId:'original'}];
function boxBody(min=[.035,.015,-.03],max=[.055,.035,.015]){
 const points=[[min[0],min[1],min[2]],[max[0],min[1],min[2]],[max[0],max[1],min[2]],[min[0],max[1],min[2]],[min[0],min[1],max[2]],[max[0],min[1],max[2]],[max[0],max[1],max[2]],[min[0],max[1],max[2]]];
 const tris=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]].map(ids=>({ids})),leaf={min:[...min],max:[...max],ids:tris.map((_,i)=>i)},block={min:[...min],max:[...max],tree:leaf};
 const body={poseVersion:1,alpha:1,triangles:tris,blocks:[block],tree:{min:[...min],max:[...max],blocks:[0]},sample(alpha){this.alpha=alpha;},prepareBlock(){},poseNode(i){return points[i];},closest(point){let best=null;for(let i=0;i<tris.length;i++){const p=tris[i].ids.map(j=>points[j]),c=closest(point,p);if(!best||c.distance<best.distance)best={...c,triangleId:i,skin:p};}const inside=point.every((x,k)=>x>min[k]&&x<max[k]),normal=point.map((x,k)=>x-best.point[k]);if(best.distance>1e-12)for(let k=0;k<3;k++)normal[k]/=inside?-best.distance:best.distance;else{const a=best.skin[1].map((x,k)=>x-best.skin[0][k]),b=best.skin[2].map((x,k)=>x-best.skin[0][k]);normal.splice(0,3,a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]);const n=Math.hypot(...normal);for(let k=0;k<3;k++)normal[k]/=n;}return {distance:best.distance,signedDistance:inside?-best.distance:best.distance,normal,triangleId:best.triangleId,sideUncertain:false};}};
 return body;
}

test('a small real body feature between all seven conventional probes is detected',()=>{
 const ps=cloth(),body=boxBody(),weights=[[1,0,0],[0,1,0],[0,0,1],[.5,.5,0],[.5,0,.5],[0,.5,.5],[1/3,1/3,1/3]];
 for(const w of weights)assert.ok(body.closest(mix(ps.map(p=>p.pos),w)).signedDistance>.0025);
 const state=new Contact(ps,records,body).report();assert.ok(state.strictCrossingTrianglePairs>0);assert.ok(state.unresolvedWitnessCount>0);assert.equal(state.passed,false);assert.equal(state.outsideBallTriangleCount,0);
});
test('real FL71/skin55380 snapshot regression retains the original interior intersection barycentrics',()=>{
 const panel=[[.0008268689256622345,.8383485950416283,.13118481335468785],[.002891993568390232,.7807098792093353,.13199146805865808],[-.041119614219622624,.791040294960142,.12861705771909707]];
 const skin=[[.00011170912179405692,.8392038226897873,.11387164854806309],[-.0023987206205953668,.8322346180640964,.12380458257281678],[-.0030033775230611758,.8199810696307263,.13222911524059633]];
 const result=features(panel,skin,.0025);assert.equal(result.strictCrossing,true);const witness=result.witnesses.find(w=>w.strictCrossing&&w.kind==='body_edge_cloth_face');assert.ok(witness);assert.ok(distance(witness.clothBarycentric,[.6920449400039522,.20832320011407526,.09963185988197251])<1e-9);assert.ok(distance(mix(panel,witness.clothBarycentric),mix(skin,witness.bodyBarycentric))<1e-12);
});
test('closest features include an edge-edge minimum with all vertices farther away',()=>{
 const a=[[-1,0,0],[1,0,0],[0,-2,0]],b=[[0,-1,.01],[0,1,.01],[0,0,2]],r=features(a,b,.011);
 assert.ok(Math.abs(r.minimumDistanceM-.01)<1e-12);assert.ok(r.witnesses.some(w=>w.kind==='edge_edge'&&w.distanceM<.010001));
});
test('barycentric body projection clears a single escape face without editing original material state',()=>{
 // A unique nearest escape face makes this a projection test, not an assertion
 // that local discrete contact can untangle an arbitrary pre-existing crossing.
 const ps=cloth(),body=boxBody([-.3,-.3,-.1],[.3,.3,.002]),c=new Contact(ps,records,body),uv=structuredClone(ps.map(p=>p.uv)),previous=structuredClone(ps.map(p=>p.previous)),mass=ps.map(p=>p.mass),before=c.report();let state;
 for(let i=0;i<12;i++){c.solve();state=c.report();if(state.passed)break;}
 assert.ok(state.maxResidualM<before.maxResidualM);assert.equal(state.strictCrossingTrianglePairs,0);assert.equal(state.passed,true);assert.deepEqual(ps.map(p=>p.uv),uv);assert.deepEqual(ps.map(p=>p.previous),previous);assert.deepEqual(ps.map(p=>p.mass),mass);
});
test('fixed cloth cannot silently pass or be moved by a triangle-body correction',()=>{
 const ps=cloth();ps.forEach(p=>p.invMass=0);const c=new Contact(ps,records,boxBody()),before=structuredClone(ps.map(p=>p.pos));assert.ok(c.solve().blockedProjectionCount>0);assert.equal(c.report().passed,false);assert.deepEqual(ps.map(p=>p.pos),before);
});
test('a real stitched partner moves with its complete mass, keeping distinct original CCD histories',()=>{
 const ps=cloth();ps.push(particle(ps[0].pos,3));ps[3].previous[2]=-.00002;const dofs=createDofs(ps);dofs.join(0,3,{started:true,closureProgress:1});const previous=structuredClone(ps.map(p=>p.previous)),uv=structuredClone(ps.map(p=>p.uv)),c=new Contact(ps,records,boxBody(),{dofs}),before=structuredClone(ps.map(p=>p.pos)),r=c.solve();
 assert.equal(r.projectionCount,1);assert.deepEqual(ps[0].pos,ps[3].pos);assert.notDeepEqual(ps[0].pos,before[0]);assert.deepEqual(ps.map(p=>p.previous),previous);assert.deepEqual(ps.map(p=>p.uv),uv);assert.equal(dofs.report().totalMass,6);
});
test('unknown body side remains a failed unresolved query and never receives guessed displacement',()=>{
 const ps=cloth(),body=boxBody(),original=body.closest;body.closest=function(p){return {...original.call(this,p),sideUncertain:true};};const c=new Contact(ps,records,body),before=structuredClone(ps.map(p=>p.pos)),r=c.solve();assert.ok(r.sideUncertainCount>0);assert.equal(r.projectionCount,0);assert.equal(r.passed,false);assert.deepEqual(ps.map(p=>p.pos),before);
});
test('candidate and witness exhaustion are explicit failures',()=>{
 assert.equal(new Contact(cloth(),records,boxBody(),{maxCandidates:1}).report().budgetExceeded,true);const r=new Contact(cloth(),records,boxBody(),{maxWitnessQueries:1}).report();assert.equal(r.budgetExceeded,true);assert.equal(r.passed,false);
});
test('a whole-triangle empty ball is used only when every original corner lies within it',()=>{
 const ps=cloth();ps.forEach(p=>p.pos[2]=2);const c=new Contact(ps,records,boxBody()),a=c.report();assert.equal(a.outsideBallTriangleCount,1);assert.equal(a.passed,true);
 ps.forEach(p=>p.pos[2]=0);const b=c.report();assert.equal(b.outsideBallTriangleCount,0);assert.ok(b.strictCrossingTrianglePairs>0);assert.equal(b.passed,false);
});
test('a changed body pose invalidates the entire-triangle empty ball',()=>{
 const body=boxBody(),ps=cloth();ps.forEach(p=>p.pos[2]=2);const c=new Contact(ps,records,body);c.report();body.poseVersion++;let calls=0;const original=body.closest;body.closest=function(p){calls++;return original.call(this,p);};c.report();assert.ok(calls>0);
});
test('a whole cloth face inside a body cannot pass just because no skin AABB overlaps it',()=>{
 const ps=[[0,0,0],[.01,0,0],[0,.01,0]].map(p=>particle(p)),r=new Contact(ps,records,boxBody([-.1,-.1,-.1],[.1,.1,.1])).report();assert.equal(r.narrowPhasePairCount,0);assert.ok(r.maxSkinPenetrationM>.09);assert.equal(r.passed,false);
});
test('read-only reporting leaves all original particle state intact',()=>{
 const ps=cloth(),before=structuredClone(ps),r=new Contact(ps,records,boxBody()).report();assert.equal(r.evaluation,'current_geometry_read_only');assert.deepEqual(ps,before);assert.equal(r.completeTriangleCertificate,false);assert.equal(r.continuousCollisionDetection,false);
});
test('a full feature-distance certificate obeys every corner displacement and the body pose',()=>{
 const ps=cloth();ps.forEach(p=>p.pos[2]=.019);const body=boxBody(),c=new Contact(ps,records,body),first=c.report();assert.equal(first.passed,true);assert.equal(first.outsideBallTriangleCount,0);
 ps.forEach(p=>p.pos[2]-=.0004);const small=c.report();assert.equal(small.clearanceCertificateTriangleCount,1);assert.equal(small.passed,true);
 body.poseVersion++;assert.equal(c.report().clearanceCertificateTriangleCount,0);
 ps.forEach(p=>p.pos[2]=.016);const close=c.report();assert.equal(close.clearanceCertificateTriangleCount,0);assert.equal(close.passed,false);assert.ok(close.maxResidualM>.001);
});
test('conservative BVH half-spaces retain every brute-force triangle crossing',()=>{
 let seed=417;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let iteration=0;iteration<60;iteration++){
  const points=Array.from({length:3},()=>[random()*.16-.04,random()*.12-.04,random()*.10-.06]),body=boxBody(),ps=points.map(p=>particle(p)),expected=body.triangles.filter(t=>features(points,t.ids.map(i=>body.poseNode(i)),.0025).strictCrossing).length,actual=new Contact(ps,records,body).report();
  assert.equal(actual.strictCrossingTrianglePairs,expected,'no crossing can be removed by the conservative pruning planes');assert.equal(actual.budgetExceeded,false);
 }
});
test('an empty known-witness pass never claims that new body contacts are absent',()=>{
 const c=new Contact(cloth(),records,boxBody()),known=c.projectKnown();assert.equal(known.queryCount,0);assert.equal(known.passed,null);assert.equal(known.completeContactCheck,false);assert.equal(c.report().passed,false);
});
test('known witnesses recompute the deformed cloth barycentric point and preserve material history',()=>{
 const ps=cloth(),c=new Contact(ps,records,boxBody([-.3,-.3,-.1],[.3,.3,.002]));c.solve();assert.ok(c.knownWitnesses.size>0);ps.forEach(p=>p.pos[2]-=.01);const before=ps.map(p=>p.pos[2]),uv=structuredClone(ps.map(p=>p.uv)),previous=structuredClone(ps.map(p=>p.previous)),mass=ps.map(p=>p.mass),r=c.projectKnown();assert.ok(r.queryCount>0);assert.ok(r.projectionCount>0);assert.ok(ps.some((p,i)=>p.pos[2]>before[i]));assert.equal(r.passed,null);assert.deepEqual(ps.map(p=>p.uv),uv);assert.deepEqual(ps.map(p=>p.previous),previous);assert.deepEqual(ps.map(p=>p.mass),mass);
});
test('known witnesses re-query the actual moving body instead of using a previous signed distance',()=>{
 const ps=cloth(),body=boxBody([-.3,-.3,-.1],[.3,.3,.002]),c=new Contact(ps,records,body);c.solve();const before=ps.map(p=>p.pos[2]),original=body.closest;body.poseVersion++;let calls=0;body.closest=function(point){calls++;return original.call(this,[point[0],point[1],point[2]-.01]);};const r=c.projectKnown(.4);assert.ok(calls>0);assert.equal(body.alpha,.4);assert.ok(r.projectionCount>0);assert.ok(ps.some((p,i)=>p.pos[2]-before[i]>.009));
});
test('a known witness with newly uncertain side is retained and never pushed using stale normals',()=>{
 const ps=cloth(),body=boxBody([-.3,-.3,-.1],[.3,.3,.002]),c=new Contact(ps,records,body);c.solve();const before=structuredClone(ps),original=body.closest;body.closest=function(point){return {...original.call(this,point),sideUncertain:true};};const r=c.projectKnown();assert.ok(r.sideUncertainCount>0);assert.equal(r.projectionCount,0);assert.equal(r.passed,null);assert.ok(c.knownWitnesses.size>0);assert.deepEqual(ps,before);
});
test('full scans refresh one current deepest contact per face instead of exhausting a history cache',()=>{
 const ps=cloth(),body=boxBody([-.3,-.3,-.1],[.3,.3,.002]),c=new Contact(ps,records,body);c.solve();
 for(let i=0;i<12;i++){ps[i%3].pos[2]-=.002;c.solve();assert.ok(c.knownWitnesses.get(0).length<=1);}
 assert.ok(c.knownReplacementCount>0);assert.equal(c.projectKnown().passed,null);assert.equal(c.report().budgetExceeded,false);
});
test('persistent projection uses the same real stitched mass projector and independent histories',()=>{
 const ps=cloth();ps.push(particle(ps[0].pos,3));ps[3].previous[2]=-.00002;const dofs=createDofs(ps);dofs.join(0,3,{started:true,closureProgress:1});const body=boxBody([-.3,-.3,-.1],[.3,.3,.002]),c=new Contact(ps,records,body,{dofs});c.solve();const previous=structuredClone(ps.map(p=>p.previous)),original=body.closest;body.closest=function(p){return original.call(this,[p[0],p[1],p[2]-.01]);};assert.ok(c.projectKnown().projectionCount>0);assert.deepEqual(ps[0].pos,ps[3].pos);assert.deepEqual(ps.map(p=>p.previous),previous);assert.equal(dofs.report().totalMass,6);
});
