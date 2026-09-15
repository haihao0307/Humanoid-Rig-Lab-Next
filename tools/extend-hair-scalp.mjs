// Extend only the lower angular band from the locked head functions. No mesh
// or image is read or stored. Existing upper-head sample values are unchanged.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeCompactHuman} from '../reconstruction/codec.mjs';
import {createCompactSurface} from '../reconstruction/surface-kernel.mjs';
const root=new URL('../reconstruction/',import.meta.url),file=new URL('hair-scalp-radius-r2.json',root);
const scalp=JSON.parse(await fs.readFile(file,'utf8')),bytes=await fs.readFile(new URL('detail.chf.gz',root));
const decoded=await decodeCompactHuman(bytes),surface=createCompactSurface(decoded.data);
const domains=JSON.parse(await fs.readFile(new URL('hair-domains-r2.json',root),'utf8')).domains;
const centre=scalp.centre,np=128,nt=76,step=2.22/64,charts=new Map();
if(scalp.schema!=='function-derived-scalp-radius/v1'||scalp.np!==np||Math.abs(scalp.thetaMax/scalp.nt-step)>1e-12||scalp.radii.length!==(scalp.nt+1)*np)throw Error('Expected the original R2 angular grid or its compatible extension');
const radii=scalp.radii.slice(0,65*np),extended=scalp.extendedDirections.filter(p=>p[0]<=64),misses=[];
let hits=0,maximumResidual=0;
function intersect(n,d){
 let lo=.025,hi=.24;
 for(let k=0;k<3;k++){
  const lower=d.boundsMetres[0][k]-.001,upper=d.boundsMetres[1][k]+.001;
  if(Math.abs(n[k])<1e-10){if(centre[k]<lower||centre[k]>upper)return null;continue;}
  const a=(lower-centre[k])/n[k],b=(upper-centre[k])/n[k];lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
 }
 if(!(hi>lo))return null;
 let chart=charts.get(d.id);if(!chart){chart=surface.makeChart('detail_extension/'+d.id);charts.set(d.id,chart);}
 const uvAt=r=>d.projectionAxes.map(k=>centre[k]+n[k]*r);
 const evaluate=r=>{const uv=uvAt(r),q=chart.evaluate(...uv);return {q,uv,f:centre[d.heightAxis]+n[d.heightAxis]*r-q.p[d.heightAxis]};};
 let a=lo,qa=evaluate(a),best=null;
 for(let i=1;i<=16;i++){
  const b=lo+(hi-lo)*i/16,qb=evaluate(b);
  if(qa.f*qb.f<=0){
   let left=a,right=b,fl=qa.f;
   for(let j=0;j<26;j++){const mid=(left+right)/2,fm=evaluate(mid).f;if(fl*fm<=0)right=mid;else{left=mid;fl=fm;}}
   const r=(left+right)/2,q=evaluate(r);
   if(chart.inside(...q.uv)&&q.q.n.reduce((s,v,k)=>s+v*n[k],0)>0){best=Math.max(best||0,r);maximumResidual=Math.max(maximumResidual,Math.abs(q.f));}
  }
  a=b;qa=qb;
 }
 return best;
}
for(let i=65;i<=nt;i++)for(let j=0;j<np;j++){
 const theta=i*step,phi=j/np*Math.PI*2,n=[Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi)];
 let radius=null;for(const d of domains){const r=intersect(n,d);if(r!==null)radius=Math.max(radius||0,r);}
 if(radius===null){radius=radii[(i-1)*np+j];extended.push([i,j]);misses.push([i,j]);}else hits++;
 if(!Number.isFinite(radius)||radius<=0||radius>=.3)throw Error('Invalid extended radius');radii.push(radius);
}
const result={...scalp,nt,np,thetaMax:nt*step,radii,extendedDirections:extended,
 lowerBandSource:{method:'ray intersections with locked R2 head functions',sourceSHA256:createHash('sha256').update(bytes).digest('hex'),firstExtendedRow:65,intersections:hits,nearestPreviousRowFallbacks:misses,maximumIntersectionResidualM:maximumResidual}};
await fs.writeFile(file,JSON.stringify(result)+'\n');
console.log(JSON.stringify({nt,np,thetaMax:result.thetaMax,hits,misses,maximumResidual,cachedCharts:charts.size}));
