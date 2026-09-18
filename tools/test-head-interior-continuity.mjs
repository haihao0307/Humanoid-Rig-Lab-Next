// Actual-source A/B of internal height-grid continuity. No browser or mesh
// assets. Synthetic probes independently test interpolation and boundedness.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeCompactHuman} from '../reconstruction/codec.mjs';
import {createHeightFunction,createCompactSurface,headInteriorBlend} from '../reconstruction/surface-kernel.mjs';
import {createCompactNormalField} from '../reconstruction/normal-field.mjs';

const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.reduce((s,v,i)=>s+v*b[i],0)/Math.hypot(...a)/Math.hypot(...b))))*180/Math.PI;
const normal=(c,q)=>{const n=[0,0,0];n[c.heightAxis]=c.outwardSign;n[c.projectionAxes[0]]=-q.qu*c.outwardSign;n[c.projectionAxes[1]]=-q.qv*c.outwardSign;return n;};
const point=(c,q,u,v)=>{const p=[0,0,0];p[c.heightAxis]=q.q;p[c.projectionAxes[0]]=u;p[c.projectionAxes[1]]=v;return p;};
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
let nodeChecks=0,boundsChecks=0,derivativeChecks=0,maximumAnalyticDerivativeError=0;
for(const value of [(i,j)=>.025+.003*i-.002*j,(i,j)=>.022+.005*Math.sin(i*1.3)*Math.cos(j*.7),(i,j)=>i<2&&j>2?0:.020+.001*i*i-.0005*j*j]){
  const nu=5,nv=6,grid=Array.from({length:(nu+1)*(nv+1)},(_,k)=>value(Math.floor(k/(nv+1)),k%(nv+1)));
  const c={uvBoundsMetres:[[0,0],[.06,.08]],unitMetres:1,layers:[{intervals:[nu,nv],basisIndices:Uint32Array.from(grid.map((_,i)=>i)),heightCoefficients:grid}]};
  const cubic=createHeightFunction(c,{cubic:true});
  for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){assert(Math.abs(cubic(i/nu*.06,j/nv*.08).q-grid[i*(nv+1)+j])<1e-14);nodeChecks++;}
  for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){
    const corners=[grid[i*(nv+1)+j],grid[(i+1)*(nv+1)+j],grid[i*(nv+1)+j+1],grid[(i+1)*(nv+1)+j+1]],lo=Math.min(...corners),hi=Math.max(...corners);
    for(const a of [.07,.25,.53,.81,.98])for(const b of [.03,.23,.57,.77,.96]){
      const u=(i+a)/nu*.06,v=(j+b)/nv*.08,q=cubic(u,v),e=1e-7;
      assert(q.q>=lo-1e-14&&q.q<=hi+1e-14,'cubic overshoot outside source cell bounds');boundsChecks++;
      const du=(cubic(u+e,v).q-cubic(u-e,v).q)/(2*e),dv=(cubic(u,v+e).q-cubic(u,v-e).q)/(2*e);
      maximumAnalyticDerivativeError=Math.max(maximumAnalyticDerivativeError,Math.abs(du-q.qu),Math.abs(dv-q.qv));derivativeChecks++;
      assert(Math.abs(du-q.qu)<1e-6&&Math.abs(dv-q.qv)<1e-6,'incorrect metre-valued cubic derivative');
    }
  }
  for(let i=1;i<nu;i++)for(let j=1;j<nv;j++)for(const axis of [0,1]){
    const uv=[(i+(axis? .37:0))/nu*.06,(j+(axis?0:.43))/nv*.08],a=uv.slice(),b=uv.slice();a[axis]-=1e-10;b[axis]+=1e-10;
    const p=cubic(...a),q=cubic(...b);assert(Math.max(Math.abs(p.qu-q.qu),Math.abs(p.qv-q.qv))<1e-6,'synthetic grid derivative discontinuity');
  }
}

const load=async name=>(await decodeCompactHuman(readFileSync(new URL('../reconstruction/'+name+'.chf.gz',import.meta.url)))).data;
const [data,normalData]=await Promise.all([load('detail'),load('normal-field')]);
const normalField=createCompactNormalField(normalData),before=createCompactSurface(data,{normalField,smoothHeadInterior:false}),after=createCompactSurface(data,{normalField});
const oldJumps=[],newJumps=[],oldSurfaceJumps=[],newSurfaceJumps=[],deltas=[];
let gridSamples=0,protectedSamples=0,otherRegionSamples=0,maximumProtectedErrorM=0,maximumProtectedNormalDegrees=0,fullBlendSamples=0,transitionDerivativeChecks=0,maximumTransitionDerivativeAngleDegrees=0;
const worst=[];
for(const c of data.fields.domains){
  const a=before.makeChart(data.fields.region+'/'+c.id),b=after.makeChart(data.fields.region+'/'+c.id),[lo,hi]=c.uvBoundsMetres,extent=hi.map((v,i)=>v-lo[i]);
  if(c.semanticRegion!=='head_face_ears'){
    for(const f of [.23,.51,.78]){const uv=lo.map((v,i)=>v+extent[i]*f),x=a.evaluate(...uv),y=b.evaluate(...uv);assert.deepEqual(y,x,'non-head chart changed');otherRegionSamples++;}continue;
  }
  const linear=createHeightFunction(c),cubic=createHeightFunction(c,{cubic:true});
  // Cover actual knot lines from every residual layer, with bounded stride.
  // Offsets avoid chart trim vertices and intersections of the two grid axes.
  const seen=new Set();
  for(const layer of c.layers)for(const axis of [0,1]){
    const n=layer.intervals[axis],stride=Math.max(1,Math.ceil(n/20));
    for(let k=1;k<n;k+=stride)for(const fraction of [.173,.417,.683,.839]){
      const uv=lo.map((v,i)=>v+extent[i]*(i===axis?k/n:fraction)),key=uv.join(',');if(seen.has(key))continue;seen.add(key);
      const e=extent[axis]/n*1e-5,minus=uv.slice(),plus=uv.slice();minus[axis]-=e;plus[axis]+=e;
      if(!a.inside(...minus)||!a.inside(...plus))continue;
      const raw=linear(...uv),p=point(c,raw,...uv),weight=headInteriorBlend(p)[0],x=a.evaluate(...uv),y=b.evaluate(...uv),delta=distance(x.p,y.p);deltas.push(delta);gridSamples++;
      if(weight===0){maximumProtectedErrorM=Math.max(maximumProtectedErrorM,delta);maximumProtectedNormalDegrees=Math.max(maximumProtectedNormalDegrees,angle(x.n,y.n));assert.deepEqual(y,x,'protected height/normal/UV changed');protectedSamples++;}
      if(weight>.02&&weight<.98&&transitionDerivativeChecks<300){
        const q=uv.map((v,i)=>v+extent[i]/layer.intervals[i]*(i?.173:.217)),h=1e-9;
        if(q.every((v,i)=>v>lo[i]+h&&v<hi[i]-h)&&b.inside(...q)){
          const numerical=[0,1].map(axis=>{const left=q.slice(),right=q.slice();left[axis]-=h;right[axis]+=h;return (b.evaluate(...right).p[c.heightAxis]-b.evaluate(...left).p[c.heightAxis])/(2*h);});
          const n=normal(c,{qu:numerical[0],qv:numerical[1]}),error=angle(n,b.evaluate(...q).n);
          maximumTransitionDerivativeAngleDegrees=Math.max(maximumTransitionDerivativeAngleDegrees,error);assert(error<.02,'anatomical gate derivative does not follow actual positions');transitionDerivativeChecks++;
        }
      }
      if(weight<1-1e-12)continue;fullBlendSamples++;
      const old=angle(normal(c,linear(...minus)),normal(c,linear(...plus))),now=angle(normal(c,cubic(...minus)),normal(c,cubic(...plus)));
      const oldSurface=angle(a.evaluate(...minus).n,a.evaluate(...plus).n),newSurface=angle(b.evaluate(...minus).n,b.evaluate(...plus).n);
      oldJumps.push(old);newJumps.push(now);oldSurfaceJumps.push(oldSurface);newSurfaceJumps.push(newSurface);
      if(old>.1)worst.push({chart:c.id,old,new:now,oldSurface,newSurface,p,intervals:layer.intervals});
    }
  }
}
const distribution=values=>{values.sort((a,b)=>a-b);return {max:values.at(-1),p95:values[Math.floor(values.length*.95)],rms:Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length)};};
const report={schema:'human/head_interior_continuity@1',nodeChecks,boundsChecks,derivativeChecks,maximumAnalyticDerivativeError,
  gridSamples,fullBlendSamples,protectedSamples,otherRegionSamples,maximumProtectedErrorM,maximumProtectedNormalDegrees,transitionDerivativeChecks,maximumTransitionDerivativeAngleDegrees,
  oldGridNormalJumpDegrees:distribution(oldJumps),newGridNormalJumpDegrees:distribution(newJumps),
  oldComposedNormalJumpDegrees:distribution(oldSurfaceJumps),newComposedNormalJumpDegrees:distribution(newSurfaceJumps),
  positionDeltaM:distribution(deltas),worst:worst.sort((a,b)=>b.old-a.old).slice(0,6),browserExecuted:false,visualAcceptance:false};
console.log(JSON.stringify(report,null,2));
assert(gridSamples>10000&&fullBlendSamples>2000&&protectedSamples>1000&&otherRegionSamples>100,'insufficient actual source coverage');
assert(maximumProtectedErrorM<1e-10&&maximumProtectedNormalDegrees<1e-5,'protected anatomy changed');
assert(report.newGridNormalJumpDegrees.p95<report.oldGridNormalJumpDegrees.p95*.02,'internal derivative jumps did not decrease');
assert(transitionDerivativeChecks>=100,'insufficient transition derivative probes');
assert(report.positionDeltaM.max<.00025,'broad head deformation exceeded quarter-millimetre bound');
