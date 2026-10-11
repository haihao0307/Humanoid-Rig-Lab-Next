/** Positive-weight harmonic disk correspondence. The convex disk is an intermediate map,
 * not render geometry. Source cut-outs are retained by the shell template, not filled visually.
 * This is a geometric registration, not a leather force solver or Rhino implementation.
 */
import {makeTemplate,clean,norm} from './surface.mjs';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],sub=(a,b)=>a.map((x,k)=>x-b[k]),mix=(a,b,t)=>a.map((v,k)=>v*(1-t)+b[k]*t),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function nearest(loop,q){let best={d:Infinity};for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length],v=sub(b,a),t=clamp(dot(sub(q,a),v)/Math.max(dot(v,v),1e-16),0,1),d=Math.hypot(...sub(q,mix(a,b,t)));if(d<best.d)best={i,t,d};}return best;}
function cg(neighbors,free,fixed,values){const n=free.length,index=new Int32Array(neighbors.length).fill(-1);free.forEach((v,i)=>index[v]=i);const b=new Float64Array(n),degree=new Float64Array(n);for(let i=0;i<n;i++){const v=free[i];degree[i]=neighbors[v].reduce((s,u)=>s+u.w,0);for(const u of neighbors[v])if(fixed[u.i])b[i]+=values[u.i]*u.w;}
 const mul=(x,y)=>{for(let i=0;i<n;i++){let v=degree[i]*x[i];for(const u of neighbors[free[i]])if(index[u.i]>=0)v-=x[index[u.i]]*u.w;y[i]=v;}};
 const x=new Float64Array(n),r=Float64Array.from(b),z=new Float64Array(n),p=new Float64Array(n),ap=new Float64Array(n);let rz=0;for(let i=0;i<n;i++){z[i]=r[i]/degree[i];p[i]=z[i];rz+=r[i]*z[i];}let iter=0;
 for(;iter<6000&&rz>1e-20;iter++){mul(p,ap);let pap=0;for(let i=0;i<n;i++)pap+=p[i]*ap[i];if(Math.abs(pap)<1e-30)break;const alpha=rz/pap;let next=0;for(let i=0;i<n;i++){x[i]+=alpha*p[i];r[i]-=alpha*ap[i];z[i]=r[i]/degree[i];next+=r[i]*z[i];}const beta=next/rz;for(let i=0;i<n;i++)p[i]=z[i]+beta*p[i];rz=next;}
 if(rz>1e-12)throw Error('Harmonic chart did not converge');for(let i=0;i<n;i++)values[free[i]]=x[i];return{iterations:iter,residual:Math.sqrt(rz)};
}
function harmonic(template,loop,circle){const n=template.vertices.length,sets=Array.from({length:n},()=>new Set()),fixed=new Uint8Array(n);for(const t of template.triangles)for(let i=0;i<3;i++){sets[t[i]].add(t[(i+1)%3]);sets[t[(i+1)%3]].add(t[i]);}for(const e of template.boundaryEdges)for(const i of e)fixed[i]=1;const weights=Array.from({length:n},()=>new Map());
 for(const tri of template.triangles)for(let j=0;j<3;j++){const i=tri[j],k=tri[(j+1)%3],o=tri[(j+2)%3],a=sub(template.vertices[i],template.vertices[o]),b=sub(template.vertices[k],template.vertices[o]),cot=dot(a,b)/Math.max(1e-12,Math.abs(a[0]*b[1]-a[1]*b[0]));weights[i].set(k,(weights[i].get(k)||0)+cot*.5);weights[k].set(i,(weights[k].get(i)||0)+cot*.5);}
 const neighbors=sets.map((s,i)=>[...s].map(j=>({i:j,w:clamp(weights[i].get(j)||0,1e-6,1e6)}))),x=new Float64Array(n),y=new Float64Array(n),free=[];
 for(let i=0;i<n;i++){if(!neighbors[i].length)fixed[i]=1;if(fixed[i]){const h=nearest(loop,template.vertices[i]),c=mix(circle[h.i],circle[(h.i+1)%circle.length],h.t);x[i]=c[0];y[i]=c[1];}else free.push(i);}
 const solves=[cg(neighbors,free,fixed,x),cg(neighbors,free,fixed,y)],uv=Array.from(x,(v,i)=>[v,y[i]]);let negative=0,positive=0,min=Infinity;for(const t of template.triangles){const [a,b,c]=t.map(i=>uv[i]),area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(area>1e-15)positive++;if(area< -1e-15)negative++;min=Math.min(min,Math.abs(area));}
 return {uv,report:{solves,positive,negative,flipped:Math.min(positive,negative),minAbsDoubleArea:min}};
}
class Lookup{
 constructor(vertices,triangles){this.v=vertices;this.t=triangles;this.n=40;const xs=vertices.map(v=>v[0]),ys=vertices.map(v=>v[1]);this.min=[Math.min(...xs),Math.min(...ys)];this.size=[Math.max(...xs)-this.min[0]+1e-10,Math.max(...ys)-this.min[1]+1e-10];this.cells=Array.from({length:this.n*this.n},()=>[]);for(let i=0;i<triangles.length;i++){const p=triangles[i].map(j=>vertices[j]);const lo=this.cell([Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1]))]),hi=this.cell([Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))]);for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)this.cells[y*this.n+x].push(i);}}
 cell(q){return q.map((v,k)=>clamp(Math.floor((v-this.min[k])/this.size[k]*this.n),0,this.n-1));}
 locate(q){const cell=this.cell(q),candidates=this.cells[cell[1]*this.n+cell[0]];let best=null,bestError=Infinity;
  const visit=i=>{const t=this.t[i],[a,b,c]=t.map(j=>this.v[j]),den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-20)return null;const u=((b[1]-c[1])*(q[0]-c[0])+(c[0]-b[0])*(q[1]-c[1]))/den,v=((c[1]-a[1])*(q[0]-c[0])+(a[0]-c[0])*(q[1]-c[1]))/den,w=1-u-v,error=Math.max(0,-u,-v,-w);const hit={t,weights:[u,v,w],outside:error};if(error<bestError){best=hit;bestError=error;}return error<1e-6?hit:null;};
  for(const i of candidates){const h=visit(i);if(h)return h;}if(bestError>.01)for(let i=0;i<this.t.length;i++){const h=visit(i);if(h)return h;}
  if(best){best.weights=best.weights.map(v=>Math.max(0,v));const s=best.weights.reduce((a,b)=>a+b);best.weights=best.weights.map(v=>v/s);}return best;
 }
 transfer(q,values){const h=this.locate(q);if(!h)throw Error('Point has no atlas triangle');const v=values[h.t[0]].map((_,k)=>h.t.reduce((s,i,j)=>s+h.weights[j]*values[i][k],0));return {v,outside:h.outside};}
}
export class SurfaceAtlas{
 constructor(sourceLoop,anchors,origin,axis,ray){this.origin=origin;this.axis=axis;this.ray=ray;this.other=[0,1,2].filter(k=>k!==Math.abs(axis)-1);this.k=Math.abs(axis)-1;this.sign=Math.sign(axis);const loop=clean(sourceLoop),lengths=[0];for(let i=0;i<loop.length;i++)lengths.push(lengths.at(-1)+Math.hypot(...sub(loop[(i+1)%loop.length],loop[i])));this.sourceLoop=loop;
  const keyed=anchors.map(a=>{const h=nearest(loop,a.slice(0,2));return{fraction:(lengths[h.i]+(lengths[h.i+1]-lengths[h.i])*h.t)/lengths.at(-1),target:a.slice(2)};}).sort((a,b)=>a.fraction-b.fraction);
  const perspective=p=>{const d=sub(p,origin),den=d[this.k]*this.sign;if(den<=.01)throw Error('Target crosses chart hemisphere');return this.other.map(k=>d[k]/den);};this.project=perspective;
  const targetAt=f=>{let j=keyed.findIndex(a=>a.fraction>f);if(j<0)j=0;const a=keyed[(j+keyed.length-1)%keyed.length],b=keyed[j],span=(b.fraction-a.fraction+1)%1,t=((f-a.fraction+1)%1)/Math.max(1e-12,span);return mix(perspective(a.target),perspective(b.target),t);};
  let fractions=lengths.slice(0,-1).map(v=>v/lengths.at(-1));for(const a of keyed)if(!fractions.some(f=>Math.abs(f-a.fraction)<1e-8))fractions.push(a.fraction);fractions.sort((a,b)=>a-b);
  const at=f=>{const d=f*lengths.at(-1);let i=0;while(lengths[i+1]<d)i++;return mix(loop[i],loop[(i+1)%loop.length],(d-lengths[i])/(lengths[i+1]-lengths[i]));};
  const sourceRing=fractions.map(at),rawTarget=fractions.map(targetAt);this.targetScale=150/Math.max(Math.max(...rawTarget.map(p=>p[0]))-Math.min(...rawTarget.map(p=>p[0])),Math.max(...rawTarget.map(p=>p[1]))-Math.min(...rawTarget.map(p=>p[1])));const targetRing=rawTarget.map(p=>p.map(v=>v*this.targetScale)),circle=fractions.map(f=>[Math.cos(f*Math.PI*2),Math.sin(f*Math.PI*2)]);
  const sm=makeTemplate([{outer:sourceRing,holes:[]}],[],10),tm=makeTemplate([{outer:targetRing,holes:[]}],[],8),s=harmonic(sm,sourceRing,circle),t=harmonic(tm,targetRing,circle);
  this.sourceMesh=sm;this.targetMesh=tm;this.sourceUV=s.uv;this.targetUV=t.uv;this.sourceLookup=new Lookup(sm.vertices,sm.triangles);this.targetDisk=new Lookup(t.uv,tm.triangles);this.targetLookup=new Lookup(tm.vertices,tm.triangles);this.sourceDisk=new Lookup(s.uv,sm.triangles);this.report={source:s.report,target:t.report,sourceVertices:sm.vertices.length,targetVertices:tm.vertices.length};
  if(s.report.flipped||t.report.flipped)throw Error('Atlas fold: '+JSON.stringify(this.report));
 }
 chart(q){const a=this.sourceLookup.transfer(q,this.sourceUV);return this.targetDisk.transfer(a.v,this.targetMesh.vertices).v;}
 unchart(q){const a=this.targetLookup.transfer(q,this.targetUV);return this.sourceDisk.transfer(a.v,this.sourceMesh.vertices).v;}
 mappedLoop(loop){const src=clean(loop),out=[];const rec=(a,b,qa,qb,depth=0)=>{const mid=mix(a,b,.5),qm=this.chart(mid),err=Math.hypot(...sub(qm,mix(qa,qb,.5)));if(depth<10&&(err>.04||Math.hypot(...sub(a,b))>3)){rec(a,mid,qa,qm,depth+1);rec(mid,b,qm,qb,depth+1);}else out.push(qa);};for(let i=0;i<src.length;i++)rec(src[i],src[(i+1)%src.length],this.chart(src[i]),this.chart(src[(i+1)%src.length]));return out;}
 rayPoint(chart){const d=[0,0,0];d[this.k]=this.sign;for(let i=0;i<2;i++)d[this.other[i]]=chart[i]/this.targetScale;return this.ray.ray(this.origin,norm(d));}
 map(x,y){const a=this.sourceLookup.transfer([x,y],this.sourceUV),b=this.targetDisk.transfer(a.v,this.targetMesh.vertices),hit=this.rayPoint(b.v);if(!hit)throw Error('Atlas surface ray miss');return {...hit,chartFallback:a.outside>1e-5||b.outside>1e-5};}
 inverse(p){const uv=this.project(p).map(v=>v*this.targetScale),a=this.targetLookup.transfer(uv,this.targetUV);if(a.outside>.001)return null;const b=this.sourceDisk.transfer(a.v,this.sourceMesh.vertices);return b.v;}
}
