// Independent oriented source-chart math tests. No mesh, body, GUI or solver.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {sourceDarbouxFrame,seamBoundaryBlend,sourceBoundaryArcFractions,initialLegContourAngles,initialBoundaryRowPoint} from '../ShortsSurfaceTransport.mjs';
const cases=[],evidence={},dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const l=Math.hypot(...a);return a.map(x=>x/l);},close=(a,b,t=1e-11)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`),closeVector=(a,b,t)=>a.forEach((x,k)=>close(x,b[k],t)),linear=(a,u,b,v)=>u.map((x,k)=>a*x+b*v[k]);
function test(name,fn){try{fn();cases.push({name,passed:true});}catch(error){cases.push({name,passed:false,error:error.message});}}
test('boundary-first row has exact seam limits and retains reference curvature',()=>{
 const start=[0,1,.1],end=[.3,.9,0],referenceStart=[.02,1,.12],referenceEnd=[.28,.9,.04];
 const ref=t=>[.02+.26*t,1-.1*t,.12-.08*t+.05*Math.sin(Math.PI*t)];
 const point=t=>initialBoundaryRowPoint({point:ref(t),referenceStart,referenceEnd,start,end,t});
 closeVector(point(0),start);closeVector(point(1),end);
 for(const e of [1e-3,1e-5,1e-7]){assert.ok(Math.hypot(...point(e).map((v,k)=>v-start[k]))<e);assert.ok(Math.hypot(...point(1-e).map((v,k)=>v-end[k]))<e);}
 close(point(.5)[2]-(start[2]+end[2])/2,.05);
 const shift=[3,-2,7],args={point:ref(.4),referenceStart,referenceEnd,start,end,t:.4},moved={...args};for(const key of ['point','referenceStart','referenceEnd','start','end'])moved[key]=args[key].map((v,k)=>v+shift[k]);closeVector(initialBoundaryRowPoint(moved),initialBoundaryRowPoint(args).map((v,k)=>v+shift[k]));
 const before=JSON.stringify(args);initialBoundaryRowPoint(args);assert.equal(JSON.stringify(args),before);
});
test('boundary-first row rejects invalid coordinates or material fractions',()=>{
 const args={point:[0,0,0],referenceStart:[0,0,0],referenceEnd:[1,0,0],start:[0,0,0],end:[1,0,0],t:.5};for(const invalid of [{...args,t:NaN},{...args,t:-.01},{...args,t:1.01},{...args,point:[0,Infinity,0]},{...args,end:[0,0]}])assert.throws(()=>initialBoundaryRowPoint(invalid));
});
test('shared crotch meridian directs all four initial leg charts through the declared hemisphere to the same side seam',()=>{
 for(const side of ['left','right'])for(const front of [true,false]){const centerX=side==='left'?-.1:.1,startPoint=[0,.77,front?.08:-.08],a=initialLegContourAngles({side,front,startPoint,centerX,centerZ:0});close(Math.sin(a.from),-centerX/Math.hypot(centerX,.08));close(Math.cos(a.from),(front?.08:-.08)/Math.hypot(centerX,.08));close(Math.sin(a.to),side==='left'?-1:1);for(const t of [.1,.4,.8]){const theta=a.from+(a.to-a.from)*t;assert.ok(front?Math.cos(theta)>0:Math.cos(theta)<0);}assert.equal(a.materialRestChanged,false);}
});
test('initial contour chart rejects lateral meridian and undefined pole',()=>{
 const a={side:'left',front:true,startPoint:[0,.77,.08],centerX:-.1,centerZ:0};for(const input of [{...a,startPoint:[-.2,.77,.08]},{...a,startPoint:[-.1,.77,0]},{...a,side:'bad'},{...a,startPoint:[0,.77,NaN]}])assert.throws(()=>initialLegContourAngles(input));
});
test('same medial ray partitions the whole leg circle despite forward/backward axis drift',()=>{
 for(const side of ['left','right'])for(const dz of [-.04,-.00237752,0,.000402852,.08]){
  const centerX=side==='left'?-.1:.1,startPoint=[0,.77,dz],args={side,startPoint,centerX,centerZ:0};
  const f=initialLegContourAngles({...args,front:true}),b=initialLegContourAngles({...args,front:false});
  close(Math.sin(f.from),Math.sin(b.from));close(Math.cos(f.from),Math.cos(b.from));
  close(Math.abs(f.to-f.from)+Math.abs(b.to-b.from),2*Math.PI);
  const wrap=t=>(t%(2*Math.PI)+2*Math.PI)%(2*Math.PI),frontAngles=Array.from({length:99},(_,i)=>wrap(f.from+(f.to-f.from)*(i+1)/100));
  for(let i=1;i<100;i++){const angle=wrap(b.from+(b.to-b.from)*i/100);assert.ok(frontAngles.every(t=>Math.abs(t-angle)>1e-8));}
 }
});
test('paper arc coordinate preserves declared wearing endpoints without treating UV metres as world height',()=>{
 const points=[[0,0],[.2,.03],[.2,.06]],before=JSON.stringify(points),a=sourceBoundaryArcFractions(points),waist=.953,hem=.581,ys=a.fractions.map(t=>waist+(hem-waist)*t);close(a.lengthM,Math.hypot(.2,.03)+.03);assert.equal(a.fractions[0],0);assert.equal(a.fractions.at(-1),1);close(ys[0],waist);close(ys.at(-1),hem);assert.ok(ys[0]>ys[1]&&ys[1]>ys[2]);assert.ok(Math.abs(ys.at(-1)-(waist-points.at(-1)[1]))>.1);assert.equal(JSON.stringify(points),before);
 closeVector(sourceBoundaryArcFractions(points.map(p=>p.map(x=>x*3.7))).fractions,a.fractions);closeVector(sourceBoundaryArcFractions(points.map(([u,v])=>[-u,v])).fractions,a.fractions);evidence.boundaryArc={lengthM:a.lengthM,fractions:a.fractions,declaredEndpointY:[waist,hem],actualInitialY:ys,sourceRestChanged:false};
});
test('source boundary requires finite positive ordered material intervals',()=>{
 for(const points of [[],[[0,0]],[[0,0],[0,0]],[[0,0],[NaN,1]],[[0,0],[1,2,3]],[[0,0],[Number.MAX_VALUE,Number.MAX_VALUE]]])assert.throws(()=>sourceBoundaryArcFractions(points));
});
test('source material basis is orthonormal and uses explicit front/back parity',()=>{
 for(const panelSide of ['front','back']){const f=sourceDarbouxFrame({sourceTangent:[.017,-.006],surfaceTangent:[.004,-.013,.002],normal:[.2,.1,.7],panelSide});close(dot(f.u,f.u),1);close(dot(f.v,f.v),1);close(dot(f.u,f.v),0);close(dot(f.u,f.normal),0);close(dot(f.v,f.normal),0);closeVector(cross(f.u,f.v),f.normal.map(x=>x*(panelSide==='front'?-1:1)));assert.equal(f.sourceRestChanged,false);}
});
test('sourceD meridian and orthogonal sourceC linear-combination identities hold',()=>{
 const d=unit([.6,.8]),f=sourceDarbouxFrame({sourceTangent:d,surfaceTangent:[.2,-.4,.05],normal:[0,0,1],panelSide:'front'});closeVector(linear(d[0],f.u,d[1],f.v),f.meridian);closeVector(linear(d[1],f.u,-d[0],f.v),f.crossMeridian);
 const c=[-.2,.9],eps=1e-7,point=(u,v)=>linear(u,f.u,v,f.v),plus=point(.01+eps*c[0],.02+eps*c[1]),minus=point(.01-eps*c[0],.02-eps*c[1]),fd=plus.map((x,k)=>(x-minus[k])/(2*eps));closeVector(fd,linear(c[0],f.u,c[1],f.v),1e-9);
});
test('all four inner-thigh charts direct source width toward the appropriate front/back surface',()=>{
 const cases=[{id:'FR',panelSide:'front',normal:[-1,0,0],sourceC:1,expectedZ:1},{id:'FL',panelSide:'front',normal:[1,0,0],sourceC:-1,expectedZ:1},{id:'BR',panelSide:'back',normal:[-1,0,0],sourceC:1,expectedZ:-1},{id:'BL',panelSide:'back',normal:[1,0,0],sourceC:-1,expectedZ:-1}];
 evidence.innerThighCharts=cases.map(c=>{const f=sourceDarbouxFrame({sourceTangent:[0,1],surfaceTangent:[0,-1,0],normal:c.normal,panelSide:c.panelSide}),widthDerivative=f.u.map(x=>x*c.sourceC);closeVector(widthDerivative,[0,0,c.expectedZ]);closeVector(f.v,[0,-1,0]);return {...c,u:f.u,v:f.v,widthDerivative};});
});
test('oriented frame is covariant under a proper arbitrary rotation',()=>{
 const n=unit([1,2,3]),angle=.73,rotate=v=>{const q=cross(n,v),along=dot(n,v);return v.map((x,k)=>Math.cos(angle)*x+Math.sin(angle)*q[k]+(1-Math.cos(angle))*along*n[k]);};
 for(const panelSide of ['front','back']){const input={sourceTangent:[-.2,.7],surfaceTangent:[.3,-.8,.2],normal:[-.1,.2,1],panelSide},a=sourceDarbouxFrame(input),b=sourceDarbouxFrame({...input,surfaceTangent:rotate(input.surfaceTangent),normal:rotate(input.normal)});for(const key of ['u','v','meridian','crossMeridian','normal'])closeVector(b[key],rotate(a[key]));}
});
test('simultaneous sourceD/sourceC mirror preserves meridian component and reverses cross component',()=>{
 const D=unit([.6,.8]),C=[.3,-.2],input={surfaceTangent:[0,-1,0],normal:[0,0,1],panelSide:'front'},a=sourceDarbouxFrame({...input,sourceTangent:D}),b=sourceDarbouxFrame({...input,sourceTangent:[-D[0],D[1]]}),ca=linear(C[0],a.u,C[1],a.v),cb=linear(-C[0],b.u,C[1],b.v);close(dot(ca,a.meridian),dot(cb,b.meridian));close(dot(ca,a.crossMeridian),-dot(cb,b.crossMeridian));close(dot(ca,ca),dot(cb,cb));
});
test('finite parallel and zero inputs visibly HOLD rather than manufacture a tangent',()=>{
 const base={sourceTangent:[0,1],surfaceTangent:[0,-1,0],normal:[0,0,1],panelSide:'front'};
 for(const input of [{...base,normal:[0,0,0]},{...base,surfaceTangent:[0,0,1]},{...base,surfaceTangent:[0,0,0]},{...base,sourceTangent:[0,0]}])assert.throws(()=>sourceDarbouxFrame(input),/HOLD/);
});
test('invalid dimensions/panel and NaN/Infinity reject atomically',()=>{
 const base={sourceTangent:[0,1],surfaceTangent:[0,-1,0],normal:[0,0,1],panelSide:'front'};
 for(const input of [{...base,sourceTangent:[0]},{...base,normal:[0,1]},{...base,panelSide:'side'},{...base,normal:[0,0,NaN]},{...base,surfaceTangent:[0,Infinity,0]}])assert.throws(()=>sourceDarbouxFrame(input),/HOLD/);
});
test('overflowed derived unit length rejects even when original entries are finite',()=>assert.throws(()=>sourceDarbouxFrame({sourceTangent:[Number.MAX_VALUE,Number.MAX_VALUE],surfaceTangent:[0,-1,0],normal:[0,0,1],panelSide:'front'}),/HOLD/));
test('smooth source seam blend has exact endpoint values and zero endpoint first derivative',()=>{
 close(seamBoundaryBlend(0),0);close(seamBoundaryBlend(1),1);close(seamBoundaryBlend(.5),.5);const e=1e-6;assert.ok(seamBoundaryBlend(e)<4*e*e);assert.ok(1-seamBoundaryBlend(1-e)<4*e*e);const fd0=(seamBoundaryBlend(e)-seamBoundaryBlend(0))/e,fd1=(seamBoundaryBlend(1)-seamBoundaryBlend(1-e))/e;assert.ok(Math.abs(fd0)<4*e&&Math.abs(fd1)<4*e);evidence.blendEndpointFiniteDifference={epsilon:e,atZero:fd0,atOne:fd1};
 for(const t of [NaN,Infinity,-.001,1.001])assert.throws(()=>seamBoundaryBlend(t),/HOLD/);
});
test('valid and rejected frame calls never modify source or surface inputs',()=>{
 const input={sourceTangent:[.3,.7],surfaceTangent:[.001,-.012,.002],normal:[.1,.05,1],panelSide:'back'},before=JSON.stringify(input);sourceDarbouxFrame(input);assert.equal(JSON.stringify(input),before);const bad={...input,sourceTangent:[0,0]},snapshot=JSON.stringify(bad);assert.throws(()=>sourceDarbouxFrame(bad));assert.equal(JSON.stringify(bad),snapshot);
});
const source=await fs.readFile(new URL('../ShortsSurfaceTransport.mjs',import.meta.url)),failed=cases.filter(c=>!c.passed);console.log(JSON.stringify({schema:'shorts-v9-surface-transport-independent/v1',sourceSHA256:createHash('sha256').update(source).digest('hex'),counts:{total:cases.length,passed:cases.length-failed.length,failed:failed.length},failed,evidence,noBody:true,noBrowser:true,noSolver:true,noSourceRestMutation:true},null,2));if(failed.length)process.exitCode=1;
