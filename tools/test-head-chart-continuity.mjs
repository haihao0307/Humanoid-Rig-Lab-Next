// Execute the real procedural head charts; no browser, image, or stored mesh.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeCompactHuman} from '../reconstruction/codec.mjs';
import {createCompactSurface} from '../reconstruction/surface-kernel.mjs';
import {createCompactNormalField} from '../reconstruction/normal-field.mjs';

const load=async name=>(await decodeCompactHuman(readFileSync(new URL('../reconstruction/'+name+'.chf.gz',import.meta.url)))).data;
const [data,normalData]=await Promise.all([load('detail'),load('normal-field')]);
const surface=createCompactSurface(data,{normalField:createCompactNormalField(normalData)});
const original=createCompactSurface(data);
const regions=new Map(data.fields.domains.map(c=>[c.id,c.semanticRegion]));
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.reduce((s,v,i)=>s+v*b[i],0))))*180/Math.PI;
const eligible=p=>p[1]>1.43
  &&!(p[2]>.125&&Math.abs(p[0])<.050&&p[1]>1.445&&p[1]<1.535)
  &&!(Math.abs(p[0])>.072&&p[1]>1.46&&p[1]<1.548&&p[2]<.145);
let samples=0,protectedSamples=0,differentiatedSamples=0,maximumPositionErrorM=0,maximumNormalAngleDegrees=0,maximumDerivativeAngleDegrees=0;
for(const curve of data.boundaries.curves){
  if(curve.owners.length!==2||curve.owners.some(id=>regions.get(id)!=='head_face_ears'))continue;
  const poly=surface.polyline(curve.id),i=Math.floor((poly.length-1)/2),a=poly[i].slice(0,3),b=poly[i+1].slice(0,3),p=a.map((v,k)=>(v+b[k])/2);
  const charts=curve.owners.map(id=>surface.makeChart('detail_extension/'+id));
  const points=charts.map(c=>c.evaluate(...c.c.projectionAxes.map(k=>p[k])));
  if(!eligible(p)){
    // Anatomical openings and ear folds must not become broad smooth seams.
    for(let k=0;k<charts.length;k++){
      const c=original.makeChart(charts[k].id),q=c.evaluate(...c.c.projectionAxes.map(j=>p[j]));
      assert(distance(q.p,points[k].p)<1e-10,'protected fold position changed');
      assert(angle(q.n,points[k].n)<1e-5,'protected fold derivative changed');
    }
    protectedSamples++;continue;
  }
  samples++;
  const error=Math.max(...points.map(q=>distance(q.p,p))),normalAngle=angle(points[0].n,points[1].n);
  maximumPositionErrorM=Math.max(maximumPositionErrorM,error);
  maximumNormalAngleDegrees=Math.max(maximumNormalAngleDegrees,normalAngle);
  assert(error<1e-10,'canonical head boundary moved: '+curve.id);
  assert(normalAngle<1e-5,'head owners retain different tangent planes: '+curve.id);
  // Differentiate actual positions away from segment corners. Matching only
  // a shading normal would not repair the geometric fold that made the seam.
  if(distance(a,b)>.002&&differentiatedSamples<100)for(let k=0;k<charts.length;k++){
    const c=charts[k],uv=c.c.projectionAxes.map(j=>p[j]),e=1e-7;
    const tangent=axis=>{
      const lo=uv.slice(),hi=uv.slice();lo[axis]-=e;hi[axis]+=e;
      const x=c.evaluate(...lo).p,y=c.evaluate(...hi).p;return y.map((v,j)=>v-x[j]);
    };
    let n=cross(tangent(0),tangent(1)),size=Math.hypot(...n);assert(size>0&&Number.isFinite(size));
    n=n.map(v=>v/size);if(n.reduce((s,v,j)=>s+v*points[k].n[j],0)<0)n=n.map(v=>-v);
    const derivativeAngle=angle(n,points[k].n);
    maximumDerivativeAngleDegrees=Math.max(maximumDerivativeAngleDegrees,derivativeAngle);
    assert(derivativeAngle<.05,'position derivatives do not match common plane');
    differentiatedSamples++;
  }
}
assert(samples>500&&protectedSamples>50&&differentiatedSamples>=50,'head coverage regressed');
assert(surface.boundaryReport.cranialSharedPlaneSegments>1000,'cranial continuity was not applied');
assert.equal(surface.boundaryReport.canonicalBoundaryMoved,false);
console.log(JSON.stringify({schema:'human/head_chart_continuity@1',samples,protectedSamples,differentiatedSamples,maximumPositionErrorM,maximumNormalAngleDegrees,maximumDerivativeAngleDegrees,report:surface.boundaryReport,browserExecuted:false,visualAcceptance:false}));
