import * as T from 'three';
import {inside} from '../../r03b/src/surface.mjs';
import {add,sub,mul,unit,dot,dist,mix,inward,resample} from '../../r07/src/geometry.mjs';
import {MeshRay} from '../../r07/src/ray.mjs';
function segments(loop,test){const flags=loop.map(test),first=flags.indexOf(false);if(first<0)return [[...loop,loop[0]]];const out=[];let run=[];for(let j=1;j<=loop.length;j++){const i=(first+j)%loop.length;if(flags[i])run.push(loop[i]);else if(run.length){if(run.length>2)out.push(run);run=[];}}return out;}
/** Folded solid binding around actual outer/inner skin walls. It is not a tube,
 * darkened edge texture or a replacement panel. Source R09 is unchanged. */
export function createBindings(model,state,parts){
 const rays=parts.filter(p=>[22,23,24,25,21,28].includes(p.id)).map(p=>new MeshRay({positions:Array.from(p.geometry.attributes.position.array),indices:Array.from(p.geometry.index.array).slice(0,p.geometry.groups[0].count)}));
 const outermost=h=>{let best=null;for(const ray of rays){const r=ray.ray(add(h.outer,mul(h.n,4)),mul(h.n,-1));if(r&&r.distance<4.2&&r.distance>.5&&(!best||r.distance<best.distance))best=r;}return best?best.p:h.outer;};
 const out=[];
 for(const id of [22,23,28,21]){
  const D=model.domains[id],raw=D.loop,inner=inward(raw,q=>D.at(q).p,3),widths=[];
  const rows=raw.map((q,i)=>{let v=inner[i];if(!inside(v,raw)){let a=0,b=1;for(let j=0;j<15;j++){const t=(a+b)/2;if(inside(mix(q,v,t),raw))a=t;else b=t;}v=mix(q,v,a*.99);}return {q,qi:v,p:D.at(q).p};});
  const keep=r=>id===28?r.p[1]>79:id===21?r.p[1]>93:(r.p[2]>-50?r.p[1]>70:r.p[1]>87);
  const runs=segments(rows,keep);
  for(const [j,run]of runs.entries()){
   const total=run.slice(1).reduce((n,r,i)=>n+dist(r.p,run[i].p),0);if(total<5)continue;
   const poses=[],U=[],indices=[],P=[];let length=0;
   for(let i=0;i<run.length;i++){
    const {q,qi}=run[i],h=model.sample(id,q,state),f=model.sample(id,qi,state),N=unit(sub(h.outer,h.inner));const O=[28,21].includes(id)?h.outer:outermost(h),I=h.inner,OI=[28,21].includes(id)?f.outer:outermost(f),II=f.inner,W=unit(sub(OI,O));
    const sec=[add(OI,mul(N,.48)),add(O,mul(N,.48)),add(O,add(mul(W,-.32),mul(N,.22))),add(I,add(mul(W,-.32),mul(N,-.22))),add(I,mul(N,-.48)),add(II,mul(N,-.48)),add(II,mul(N,-.12)),add(I,mul(N,-.12)),add(I,mul(W,-.08)),add(O,mul(W,-.08)),add(O,mul(N,.12)),add(OI,mul(N,.12))];
    if(i)length+=dist(h.outer,model.sample(id,run[i-1].q,state).outer);
    sec.forEach((p,k)=>{P.push(...p);U.push(length/96,k/12*.08)});poses.push({sec,N,W,O});widths.push(dist(OI,O));
   }
   const n=12;for(let i=0;i<run.length-1;i++)for(let k=0;k<n;k++){const a=i*n+k,b=i*n+(k+1)%n,c=a+n,d=b+n;indices.push(a,c,b,b,c,d);}
   for(const row of [0,run.length-1]){const f=poses[row],q=f.sec.map(p=>new T.Vector2(dot(sub(p,f.O),f.W),dot(sub(p,f.O),f.N)));const ts=T.ShapeUtils.triangulateShape(q,[]);for(const t of ts)indices.push(...(row===0?t:t.slice().reverse()).map(k=>row*n+k));}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
   g.userData={partId:id,kind:'folded-binding',zone:id===28?'tongue':id===21?'heel-rim':'collar-and-facing',stations:run.length,lengthMm:length,widthMm:{min:Math.min(...widths),max:Math.max(...widths)},materialThicknessMm:.36,usesActualInnerAndOuter:true,physics:false};
   out.push({id:`binding-${id}-${j}`,partId:id,kind:'trim',geometry:g,report:g.userData});
  }
 }
 return out;
}
