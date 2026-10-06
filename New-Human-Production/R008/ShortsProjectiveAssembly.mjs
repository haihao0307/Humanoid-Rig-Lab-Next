// Source-owned local/global assembly following continuum triangle projections:
// https://www.projectivedynamics.org/projectivedynamics.pdf
// No formed coordinates are adopted as rest material. This is a static solver.
import * as THREE from 'three';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
export function projectPaperFrame(fu,fv,limit=.015){
 const a=dot(fu,fu),b=dot(fu,fv),c=dot(fv,fv),theta=.5*Math.atan2(2*b,a-c),cs=Math.cos(theta),sn=Math.sin(theta),v=[[cs,sn],[-sn,cs]],u=[],sigma=[];
 for(const row of v){const col=fu.map((x,k)=>x*row[0]+fv[k]*row[1]),s=Math.hypot(...col);sigma.push(s);u.push(s>1e-10?col.map(x=>x/s):[0,0,0]);}
 // An exactly collapsed frame has no observed normal; reject instead of
 // inventing a garment orientation or silently accepting zero area.
 if(sigma.some(s=>s<1e-10))return null;
 const s=sigma.map(x=>Math.max(1-limit,Math.min(1+limit,x)));
 return{fu:fu.map((_,k)=>u[0][k]*s[0]*v[0][0]+u[1][k]*s[1]*v[1][0]),fv:fv.map((_,k)=>u[0][k]*s[0]*v[0][1]+u[1][k]*s[1]*v[1][1]),sigma};
}

export class ShortsProjectiveAssembly{
 constructor(cloth,{limit=.015,inertia=.003,contactWeight=150,waistSupport=true,maxStepM=.002,chartBarrier=false,dual=false}={}){
  this.c=cloth;this.options={limit,inertia,contactWeight,waistSupport,maxStepM,chartBarrier,dual};const n=cloth.positions.length;this.rows=Array.from({length:n},()=>new Map());this.waist=new Set(waistSupport?cloth.waist:[]);this.targets=cloth.positions.map(p=>p.slice());this.duals=cloth.triangles.map(()=>[0,0,0,0,0,0]);
  this.chartSigns=cloth.triangles.map(t=>{const[a,b,c]=t.q.map(i=>cloth.positions[i]);return Math.sign((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));});
  for(const t of cloth.triangles){const w=t.paperReference.warpCoefficients,v=t.paperReference.weftCoefficients,A=t.paperReference.areaM2;for(let i=0;i<3;i++)for(let j=0;j<3;j++){const row=this.rows[t.q[i]],k=t.q[j];row.set(k,(row.get(k)||0)+A*(w[i]*w[j]+v[i]*v[j]));}}
  this.rows=this.rows.map(row=>[...row]);this.baseDiagonal=this.rows.map((row,i)=>row.find(x=>x[0]===i)?.[1]??0);
 }
 step(){
  const c=this.c,n=c.positions.length,{inertia,contactWeight,limit}=this.options,b=Array.from({length:3},()=>new Float64Array(n)),diag=Array.from({length:3},()=>new Float64Array(n).fill(inertia));
  const projections=[];
  for(const [tid,t]of c.triangles.entries()){const w=t.paperReference.warpCoefficients,v=t.paperReference.weftCoefficients,A=t.paperReference.areaM2,d=this.duals[tid],fu=[0,1,2].map(k=>t.q.reduce((s,id,i)=>s+c.positions[id][k]*w[i],0)),fv=[0,1,2].map(k=>t.q.reduce((s,id,i)=>s+c.positions[id][k]*v[i],0)),r=projectPaperFrame(fu.map((x,k)=>x+d[k]),fv.map((x,k)=>x+d[k+3]),limit);if(!r)throw Error('Projective assembly collapsed triangle');projections.push(r);for(let i=0;i<3;i++)for(let k=0;k<3;k++)b[k][t.q[i]]+=A*(w[i]*(r.fu[k]-d[k])+v[i]*(r.fv[k]-d[k+3]));}
  for(let id=0;id<n;id++){
   const p=c.positions[id],weight=this.waist.has(id)?1e5:0;diag[1][id]+=weight;
   for(let k=0;k<3;k++)b[k][id]+=inertia*(p[k]-(k===1&&!weight ? .000015 : 0))+(k===1?weight*this.targets[id][k]:0);
   const hit=c.body.collide(new THREE.Vector3(...p),.004);if(hit){const target=hit.point.toArray();for(let k=0;k<3;k++){diag[k][id]+=contactWeight;b[k][id]+=contactWeight*target[k];}}
  }
  const cg=(rhs,axis)=>{const diagonal=diag[axis],apply=x=>Float64Array.from(this.rows,(row,i)=>diagonal[i]*x[i]+row.reduce((s,[j,v])=>s+v*x[j],0));
   const x=Float64Array.from(c.positions,p=>p[axis]),Ax=apply(x),r=Float64Array.from(rhs,(v,i)=>v-Ax[i]),z=Float64Array.from(r,(v,i)=>v/(diagonal[i]+this.baseDiagonal[i]));let p=z.slice(),rz=dot(r,z);
   for(let iter=0;iter<80&&rz>1e-18;iter++){const Ap=apply(p),den=dot(p,Ap);if(!(den>0))break;const alpha=rz/den;for(let i=0;i<n;i++){x[i]+=alpha*p[i];r[i]-=alpha*Ap[i];z[i]=r[i]/(diagonal[i]+this.baseDiagonal[i]);}const next=dot(r,z),beta=next/rz;for(let i=0;i<n;i++)p[i]=z[i]+beta*p[i];rz=next;}return x;
  };
  const solved=[0,1,2].map(k=>cg(b[k],k));let maxMove=Math.max(...c.positions.map((p,i)=>Math.hypot(...p.map((v,k)=>v-solved[k][i])))),fraction=Math.min(1,this.options.maxStepM/Math.max(maxMove,1e-12));
  if(this.options.chartBarrier){for(let attempt=0;attempt<16;attempt++){let valid=true;for(const [tid,t]of c.triangles.entries()){const[a,b,d]=t.q.map(i=>c.positions[i].map((v,k)=>v+(solved[k][i]-v)*fraction)),area=(b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]);if(area*this.chartSigns[tid]<=1e-10){valid=false;break;}}if(valid)break;fraction*=.5;}}
  for(let i=0;i<n;i++)for(let k=0;k<3;k++)c.positions[i][k]+=(solved[k][i]-c.positions[i][k])*fraction;
  if(this.options.dual)for(const [tid,t]of c.triangles.entries()){const w=t.paperReference.warpCoefficients,v=t.paperReference.weftCoefficients,d=this.duals[tid],r=projections[tid];for(let k=0;k<3;k++){d[k]+=.5*(t.q.reduce((s,id,i)=>s+c.positions[id][k]*w[i],0)-r.fu[k]);d[k+3]+=.5*(t.q.reduce((s,id,i)=>s+c.positions[id][k]*v[i],0)-r.fv[k]);}}
  return maxMove*fraction;
 }
}
