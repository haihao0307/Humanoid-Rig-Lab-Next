import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const api=new Function(fs.readFileSync(new URL('../clothing/ShortsContinuousContact.js',import.meta.url),'utf8')+';return {shortsSweptVertexFace,shortsSweptEdgeEdge,createShortsContinuousContact,sccCubicRoots};')();
const {shortsSweptVertexFace:vf,shortsSweptEdgeEdge:ee,createShortsContinuousContact:create}=api;
const createDofs=new Function(fs.readFileSync(new URL('../clothing/ShortsStitchDofs.js',import.meta.url),'utf8')+';return createShortsStitchDofs;')();
const triangle=[[-.2,-.2,0],[.2,-.2,0],[0,.2,0]],copy=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const particle=(previous,pos=previous,invMass=1)=>({previous:[...previous],pos:[...pos],invMass});
test('vertex crosses a whole face despite current distance far beyond thickness',()=>{
 const hit=vf([0,0,.2],[0,0,-.2],triangle,triangle);assert.ok(hit.hit);near(hit.toi,.5);assert.deepEqual(hit.weights,[1,-.25,-.25,-.5]);assert.ok(hit.normal[2]>.99);
});
test('coplanarity root outside finite face is rejected',()=>assert.equal(vf([1,1,.2],[1,1,-.2],triangle,triangle),null));
test('moving face is included, not treated as static',()=>{
 const before=triangle.map(p=>[p[0],p[1],-.2]),after=triangle.map(p=>[p[0],p[1],.2]);near(vf([0,0,0],[0,0,0],before,after).toi,.5);
});
test('rigid world transform preserves time and rotates collision normal',()=>{
 const transform=p=>[p[2]+.7,p[0]-.4,p[1]+1.2],face=triangle.map(transform),hit=vf(transform([0,0,.2]),transform([0,0,-.2]),face,face);near(hit.toi,.5);assert.ok(hit.normal[0]>.999);near(hit.normal[1],0);near(hit.normal[2],0);
});
test('edge-edge crossing is detected with final separation 200mm',()=>{
 const a=[[-.2,0,0],[.2,0,0]],b=[[0,-.2,.2],[0,.2,.2]],end=b.map(p=>[p[0],p[1],-.2]),hit=ee(a,a,b,end);assert.ok(hit.hit);near(hit.toi,.5);near(hit.s,.5);near(hit.t,.5);
});
test('edge coplanarity without finite edge overlap is rejected',()=>{
 const a=[[-.2,0,0],[.2,0,0]],b=[[1,-.2,.2],[1,.2,.2]];assert.equal(ee(a,a,b,b.map(p=>[p[0],p[1],-.2])),null);
});
test('coplanar sliding point entering face is detected conservatively',()=>{
 const hit=vf([-.4,0,0],[.1,0,0],triangle,triangle);assert.ok(hit.hit);assert.equal(hit.method,'conservative_coplanar_distance');near(hit.toi,.6,1e-6);assert.ok(hit.normal[0]<0);
});
test('coplanar separated stationary primitives are clear',()=>assert.equal(vf([.3,.3,0],[.3,.3,0],triangle,triangle),null));
test('initial coincident domain point is explicitly uncertain',()=>{
 const hit=vf([0,0,0],[0,0,0],triangle,triangle);assert.equal(hit.uncertain,true);assert.equal(hit.reason,'initial_coincident_contact');
});
test('collapsed triangle impact is not silently cleared',()=>{
 const collapsed=[[-.2,0,0],[0,0,0],[.2,0,0]],hit=vf([0,0,.2],[0,0,-.2],collapsed,collapsed);assert.ok(hit.uncertain);assert.equal(hit.reason,'degenerate_impact_normal');
});
test('root isolation finds three roots and tangent repeated roots',()=>{
 const roots=api.sccCubicRoots([-.08,.66,-1.5,1]).roots;assert.equal(roots.length,3);roots.forEach((x,i)=>near(x,[.2,.5,.8][i]));const tangent=api.sccCubicRoots([.25,-1,1,0]).roots;assert.equal(tangent.length,1);near(tangent[0],.5);
});
test('swept broadphase and projection retain original side across many cells',()=>{
 const ps=[particle([0,0,.2],[0,0,-.2]),...triangle.map(p=>particle(p,p,0))],before=copy(ps),contact=create(ps,[{indices:[1,2,3]}],[],{thickness:.0025,cellSize:.04});const r=contact.solve();assert.equal(r.detectedCrossingCount,1);assert.ok(r.projectedCount);near(ps[0].pos[2],.0025);for(let i=1;i<4;i++)assert.deepEqual(ps[i],before[i]);assert.deepEqual(ps[0].previous,before[0].previous);assert.equal(r.unresolvedCount,0);
});
test('contact correction respects inverse mass and conserves weighted centre',()=>{
 const ps=[particle([0,0,.2],[0,0,-.2],2),...triangle.map(p=>particle(p,p,1))],before=copy(ps),contact=create(ps,[{indices:[1,2,3]}],[],{thickness:.0025});contact.solve();const weights=[1,-.25,-.25,-.5],ratios=ps.map((p,i)=>(p.pos[2]-before[i].pos[2])/(p.invMass*weights[i]));ratios.forEach(x=>near(x,ratios[0]));near(ps.reduce((s,p,i)=>s+(p.pos[2]-before[i].pos[2])/p.invMass,0),0);
});
test('fixed collision remains unresolved instead of being reported resolved',()=>{
 const ps=[particle([0,0,.2],[0,0,-.2],0),...triangle.map(p=>particle(p,p,0))],r=create(ps,[{indices:[1,2,3]}],[]).solve();assert.equal(r.unresolvedCount,1);assert.ok(r.maxPenetrationM>.2);
});
test('candidate exhaustion cannot report a successful clear step',()=>{
 const ps=[particle([0,0,.2],[0,0,-.2]),particle([.01,0,.2],[.01,0,-.2]),...triangle.map(p=>particle(p,p,0))],r=create(ps,[{indices:[2,3,4]}],[],{maxCandidates:1}).solve();assert.equal(r.budgetExceeded,true);assert.ok(r.unresolvedCount>0);
});
test('distant started seam endpoints do not exempt incident faces',()=>{
 const ps=[particle([0,0,.2],[0,0,-.2]),...triangle.map(p=>particle(p,p,0))],r=create(ps,[{indices:[1,2,3]}],[]).solve({seamMates:new Map([[0,new Set([1])]])});assert.equal(r.detectedCrossingCount,1);
});
test('started nearby needle endpoint allows only its incident contact',()=>{
 const ps=[particle([-.2,-.2,.0025]),...triangle.map(p=>particle(p,p,0))],r=create(ps,[{indices:[1,2,3]}],[]).solve({seamMates:new Map([[0,new Set([1])]])});assert.equal(r.candidateCount,0);
});
test('shared original source indices are topology adjacency, not self collision',()=>{
 const ps=triangle.map(p=>particle(p));assert.equal(create(ps,[{indices:[0,1,2]}],[]).solve().candidateCount,0);
});

test('a connecting cloth edge does not exempt a distinct vertex from crossing a neighbouring face',()=>{
 const ps=[particle([0,0,.2],[0,0,-.2]),...triangle.map(p=>particle(p,p,0))],previous=ps.map(p=>p.previous.slice());
 const neighbours=[new Set([1]),new Set([0,2,3]),new Set([1,3]),new Set([1,2])];
 const r=create(ps,[{indices:[1,2,3]}],[],{thickness:.0025}).solve({neighbours});
 assert.equal(r.detectedCrossingCount,1);assert.equal(r.unresolvedCount,0);near(ps[0].pos[2],.0025);
 assert.deepEqual(ps.map(p=>p.previous),previous);
});

test('edges connected by a third material edge still collide unless they share a vertex',()=>{
 const ps=[particle([-.2,0,0],[-.2,0,0],0),particle([.2,0,0],[.2,0,0],0),particle([0,-.2,.2],[0,-.2,-.2]),particle([0,.2,.2],[0,.2,-.2])];
 const neighbours=[new Set([1,2]),new Set([0]),new Set([0,3]),new Set([2])];
 const r=create(ps,[],[{a:0,b:1},{a:2,b:3}],{thickness:.0025}).solve({neighbours});
 assert.equal(r.detectedCrossingCount,1);assert.equal(r.unresolvedCount,0);
 near(ps[2].pos[2],.0025);near(ps[3].pos[2],.0025);
});

test('optional stitched DOFs receive actual collision gradients and a blocked projection stays unresolved',()=>{
 const ps=[particle([0,0,.2],[0,0,-.2]),...triangle.map(p=>particle(p,p,0))],before=copy(ps),calls=[];
 const dofs={project(indices,gradients,C,settings){calls.push({indices:[...indices],gradients:copy(gradients),C,settings:{...settings}});return{applied:false,lambda:0,deltaLambda:0,denominator:0,aggregatedDegrees:0};}};
 const r=create(ps,[{indices:[1,2,3]}],[],{thickness:.0025,dofs}).solve();
 assert.equal(r.detectedCrossingCount,1);assert.equal(r.projectedCount,0);assert.equal(r.unresolvedCount,1);
 assert.equal(calls.length,2);assert.deepEqual(ps,before);
 for(const c of calls){assert.deepEqual(c.indices,[0,1,2,3]);assert.deepEqual(c.gradients,[[0,0,1],[0,0,-.25],[0,0,-.25],[0,0,-.5]]);near(c.C,-.2025);assert.deepEqual(c.settings,{alpha:0,lambda:0,tensionOnly:false});}
});

test('omitting or explicitly disabling stitched DOFs gives the identical original trajectory and report',()=>{
 const initial=[particle([0,0,.2],[0,0,-.2],2),...triangle.map(p=>particle(p,p,1))],a=copy(initial),b=copy(initial);
 const ra=create(a,[{indices:[1,2,3]}],[],{thickness:.0025}).solve(),rb=create(b,[{indices:[1,2,3]}],[],{thickness:.0025,dofs:null}).solve();
 assert.deepEqual(a,b);assert.deepEqual(ra,rb);
 assert.throws(()=>create(copy(initial),[{indices:[1,2,3]}],[],{dofs:{}}),/project method/);
});

test('real stitched contact shares correction by total group mass and keeps every original swept trajectory',()=>{
 const ps=[particle([0,0,.2],[0,0,-.2],2),...triangle.map(p=>particle(p,p,1)),particle([0,0,.3],[0,0,-.2],1)];
 for(const p of ps)p.mass=1/p.invMass;
 const before=copy(ps),dofs=createDofs(ps,{joinTolerance:.005});
 assert.equal(dofs.join(0,4,{started:true,closureProgress:1}),true);
 near(dofs.effectiveInverseMass([0,1,2,3],[[0,0,1],[0,0,-.25],[0,0,-.25],[0,0,-.5]]),1/1.5+.375);
 const r=create(ps,[{indices:[1,2,3]}],[],{thickness:.0025,dofs}).solve();
 assert.equal(r.detectedCrossingCount,2);assert.equal(r.unresolvedCount,0);assert.ok(r.projectedCount);
 assert.deepEqual(ps[0].pos,ps[4].pos);
 near(ps[0].pos[2]-before[0].pos[2],.1296);
 near(ps[1].pos[2]-before[1].pos[2],-.0486);
 near(ps.reduce((sum,p,i)=>sum+p.mass*(p.pos[2]-before[i].pos[2]),0),0);
 for(let i=0;i<ps.length;i++)assert.deepEqual(ps[i].previous,before[i].previous);
 assert.notDeepEqual(ps[0].previous,ps[4].previous);
});

test('a fixed member of a real stitched group blocks the whole CCD correction without hiding the crossing',()=>{
 const ps=[particle([0,0,.2],[0,0,-.2]),...triangle.map(p=>particle(p,p,0)),particle([0,0,.3],[0,0,-.2],0)];
 for(const p of ps)p.mass=1;
 const before=copy(ps),dofs=createDofs(ps,{joinTolerance:.005});dofs.join(0,4,{started:true,closureProgress:1});
 const r=create(ps,[{indices:[1,2,3]}],[],{thickness:.0025,dofs}).solve();
 assert.equal(r.detectedCrossingCount,2);assert.equal(r.projectedCount,0);assert.equal(r.unresolvedCount,2);
 assert.deepEqual(ps,before);
});
