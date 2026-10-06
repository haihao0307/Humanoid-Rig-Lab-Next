import {evaluatePaperStrainBarrier} from './ShortsPaperStrainBarrier.mjs';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),mul=(H,v)=>H.map(row=>dot(row,v));
export function paperFormingStrainBarrierTerms(positions,triangles,barrier,{withRows=true}={}){
 const gradients=positions.map(()=>[0,0,0]),diagonalXYZ=new Float64Array(positions.length*3),rows=[];let energyM2=0;
 if(barrier===null)return{status:'BARRIER_TERMS_VALID',energyM2,gradients,diagonalXYZ,rows};
 if(!(Number.isFinite(barrier.mu)&&barrier.mu>0))throw Error('Explicit positive finite source strain barrier coefficient required');
 for(let triangle=0;triangle<triangles.length;triangle++){const t=triangles[triangle],F=[[0,0,0],[0,0,0]];for(const[id,g]of t.entries)for(let k=0;k<3;k++){F[0][k]+=g[0]*positions[id][k];F[1][k]+=g[1]*positions[id][k];}
  const b=evaluatePaperStrainBarrier([dot(F[0],F[0]),dot(F[1],F[1]),dot(F[0],F[1])],{areaM2:t.area,mu:barrier.mu});if(!b.domainCertified)return{status:'HOLD',reason:'strict source five-percent barrier domain unresolved',triangle,barrier:b};energyM2+=b.energyM2;
  if(withRows){const entries=t.entries.map(([id,g])=>({id,J:[0,1,2].map(k=>[2*g[0]*F[0][k],2*g[1]*F[1][k],g[0]*F[1][k]+g[1]*F[0][k]])}));for(const e of entries)for(let k=0;k<3;k++){gradients[e.id][k]+=dot(e.J[k],b.gradC);diagonalXYZ[e.id*3+k]+=dot(e.J[k],mul(b.hessianC,e.J[k]));}rows.push({entries,H:b.hessianC});}
 }
 return{status:'BARRIER_TERMS_VALID',energyM2,gradients,diagonalXYZ,rows};
}
export function paperFormingStrainBarrierProduct(rows,vector){const out=new Float64Array(vector.length);for(const r of rows){const differential=[0,0,0];for(const e of r.entries)for(let k=0;k<3;k++)for(let a=0;a<3;a++)differential[a]+=e.J[k][a]*vector[e.id*3+k];const product=mul(r.H,differential);for(const e of r.entries)for(let k=0;k<3;k++)out[e.id*3+k]+=dot(e.J[k],product);}return out;}
