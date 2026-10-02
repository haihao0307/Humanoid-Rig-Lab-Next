// The visible lower-chin line was below the procedural face: actual GPU
// source triangles at y=1.4196..1.4200. Check the source function AND the final
// whole-body topology, never merely the generated face's ellipse boundary.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeCompactHuman} from '../reconstruction/codec.mjs';
import {createCompactSurface,cranialInterfaceCollarWidth} from '../reconstruction/surface-kernel.mjs';
import {createCompactNormalField} from '../reconstruction/normal-field.mjs';
import {generateCompactHuman} from '../reconstruction/assembly.mjs';

const load=name=>readFileSync(new URL('../reconstruction/'+name,import.meta.url));
const body=(await decodeCompactHuman(load('body.chf.gz'))).data;
const normalData=(await decodeCompactHuman(load('normal-field.chf.gz'))).data;
const surface=createCompactSurface(body,{normalField:createCompactNormalField(normalData)});
const collars=body.fields.domains.filter(c=>cranialInterfaceCollarWidth(c)!==null);
assert.deepEqual(collars.map(c=>c.id),[540],'collar selection must not affect other torso charts');
const collar=collars[0],chart=surface.makeChart(body.fields.region+'/'+collar.id);
assert(Math.abs(cranialInterfaceCollarWidth(collar)-.0024250198364258)<1e-10);
let analyticSamples=0,minimumCentralSlope=Infinity;
// This band is anterior chin support, not the labiomental groove. The former
// 12 mm plane influence produced a -2.355 slope where the raw field ascended.
for(let ix=0;ix<=32;ix++)for(let iy=0;iy<=240;iy++){
  const x=-.016+ix*.001,y=1.4188+iy*.000005,q=chart.evaluate(x,y),slope=-q.n[1]/q.n[2];
  assert(q.p.every(Number.isFinite)&&q.n.every(Number.isFinite));
  assert(slope>.30,'anterior collar acquired a reverse longitudinal slope');
  minimumCentralSlope=Math.min(minimumCentralSlope,slope);analyticSamples++;
}
let boundarySamples=0,maximumBoundaryErrorM=0;
for(const c of body.boundaries.curves.filter(c=>c.owners.includes(collar.id))){
  const points=surface.polyline(c.id);
  for(let i=1;i<points.length;i++)for(const t of [.2,.5,.8]){
    const p=points[i-1].slice(0,3).map((v,k)=>v+(points[i][k]-v)*t);
    for(const owner of c.owners.filter(id=>id>=0)){
      const other=surface.makeChart(body.fields.region+'/'+owner),q=other.evaluate(...other.c.projectionAxes.map(k=>p[k]));
      const error=Math.hypot(...q.p.map((v,k)=>v-p[k]));
      assert(error<1e-8,'collar repair moved a canonical shared/open edge');
      maximumBoundaryErrorM=Math.max(maximumBoundaryErrorM,error);boundarySamples++;
    }
  }
}
surface.clearBoundaryCache();
const {meshes,report}=await generateCompactHuman({load:async name=>load(name),quality:'balanced',includeHair:false});
assert(report.triangles<600000,'unchanged whole-body topology guard');
const remesh=report.groups.find(g=>g.name==='body').cranialCollarRemeshing;
assert(remesh&&remesh.flips>0&&remesh.addedSampleBudget===0,'collar must reuse its existing samples');
assert.equal(remesh.trianglesBefore,remesh.trianglesAfter,'this source needs internal diagonal changes, not extra triangles');
const audits=Object.fromEntries(['wholeVisibleBand','centralVisible'].map(name=>[name,{triangles:0,reverseSlopeTriangles:0,reverseSlopeProjectedAreaM2:0,projectedAreaM2:0,wrongUvWinding:0,degenerate:0,minimumSlope:Infinity}]));
const clip=(poly,axis,value,keepGreater)=>{
  const out=[];for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-value)*(keepGreater?1:-1),db=(b[axis]-value)*(keepGreater?1:-1);
    if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));}
  }return out;
};
const roiArea=(triangle,x0,x1)=>{
  let p=triangle.map(p=>p.slice(0,2));for(const [axis,value,greater] of [[0,x0,true],[0,x1,false],[1,1.419,true],[1,1.420,false]])p=clip(p,axis,value,greater);
  if(p.length<3)return 0;const origin=p[0];let area=0;for(let i=1;i<p.length-1;i++)area+=(p[i][0]-origin[0])*(p[i+1][1]-origin[1])-(p[i][1]-origin[1])*(p[i+1][0]-origin[0]);
  return Math.abs(area)*.5;
};
for(const mesh of meshes.filter(m=>m.name==='skin'&&m.sourceGroup==='body'))for(let at=0;at<mesh.indices.length;at+=3){
  const p=Array.from(mesh.indices.subarray(at,at+3),id=>Array.from(mesh.positions.subarray(id*3,id*3+3)));
  const centre=[0,1,2].map(k=>(p[0][k]+p[1][k]+p[2][k])/3);
  if(Math.max(...p.map(p=>p[1]))<1.419||Math.min(...p.map(p=>p[1]))>=1.420||centre[2]<.15||!chart.inside(centre[0],centre[1]))continue;
  const a=p[1].map((v,k)=>v-p[0][k]),b=p[2].map((v,k)=>v-p[0][k]);
  const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],slope=-n[1]/n[2];
  for(const name of ['wholeVisibleBand','centralVisible']){
    const [x0,x1]=name==='centralVisible'?[-.018,.018]:[collar.uvBoundsMetres[0][0],collar.uvBoundsMetres[1][0]],area=roiArea(p,x0,x1);
    if(area<1e-16)continue;
    const q=audits[name];q.triangles++;q.projectedAreaM2+=area;q.minimumSlope=Math.min(q.minimumSlope,slope);
    if(n[2]<=0)q.wrongUvWinding++;if(Math.hypot(...n)<1e-13)q.degenerate++;
    if(slope<0){q.reverseSlopeTriangles++;q.reverseSlopeProjectedAreaM2+=area;}
  }
}
for(const q of Object.values(audits)){assert(q.triangles>20);assert.equal(q.wrongUvWinding,0);assert.equal(q.degenerate,0);}
assert.equal(audits.centralVisible.reverseSlopeTriangles,0,'finalize reintroduced visible thin fan reverse slopes');
// The canonical GPU positions are Float32: y=1.420 rounds down by 42.9 nm.
// Compare against that actual boundary, rather than declaring the resulting
// 0.001545 mm² area difference to be a hole.
const expectedCentralAreaM2=.036*(Math.fround(1.420)-1.419);
assert(Math.abs(audits.centralVisible.projectedAreaM2-expectedCentralAreaM2)<1e-10,
  'central clipped area '+audits.centralVisible.projectedAreaM2+' differs from Float32 ROI '+expectedCentralAreaM2);
console.log(JSON.stringify({analyticSamples,minimumCentralSlope,boundarySamples,maximumBoundaryErrorM,remesh,audits,
  roi:{y:[1.419,1.420],wholeVisibleBandX:collar.uvBoundsMetres.map(p=>p[0]),centralVisibleX:[-.018,.018],areaMethod:'exact UV triangle clipping'},
  wholeBodyTriangles:report.triangles,headroom:600000-report.triangles,topology:report.topology,
  note:'Reverse longitudinal slope is distinct from UV winding and does not itself prove self-intersection.',
  browserExecuted:false,visualAcceptance:false},null,2));
