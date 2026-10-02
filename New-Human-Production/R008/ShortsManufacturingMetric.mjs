// Geometric cut-paper authoring projector, never called by native fixedStep.
// Reference singular stretches remain exactly one. Physical source mass and
// shared stitched ownership determine the minimum-movement correction.
const dot=(a,b)=>a.reduce((sum,x,k)=>sum+x*b[k],0);
export function paperPrincipal(cloth,t,mode=0){
 const [a,b,c]=t.q.map(i=>cloth.positions[i]),m=t.inv,ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]),u=ab.map((v,k)=>v*m[0]+ac[k]*m[2]),v=ab.map((x,k)=>x*m[1]+ac[k]*m[3]),angle=.5*Math.atan2(2*dot(u,v),dot(u,u)-dot(v,v)),e=mode===0?[Math.cos(angle),Math.sin(angle)]:[-Math.sin(angle),Math.cos(angle)],f=u.map((x,k)=>x*e[0]+v[k]*e[1]),sigma=Math.hypot(...f);
 if(sigma<1e-12)return {sigma,gradients:null};
 const coefficients=[-(m[0]+m[2])*e[0]-(m[1]+m[3])*e[1],m[0]*e[0]+m[1]*e[1],m[2]*e[0]+m[3]*e[1]];
 return {sigma,gradients:coefficients.map(g=>f.map(x=>x/sigma*g))};
}
export function projectManufacturingPaper(cloth,t){
 for(const mode of [0,1]){
  const {sigma,gradients}=paperPrincipal(cloth,t,mode);if(!gradients)throw Error('Collapsed cut-paper material direction');
  const combined=new Map();t.q.forEach((id,j)=>{if(!combined.has(id))combined.set(id,[0,0,0]);const g=combined.get(id);for(let k=0;k<3;k++)g[k]+=gradients[j][k];});
  let denominator=0;for(const [id,g]of combined)denominator+=cloth.invMass[id]*dot(g,g);if(!(denominator>0))return;
  const delta=-(sigma-1)/denominator;
  for(const [id,g]of combined)for(let k=0;k<3;k++)cloth.positions[id][k]+=cloth.invMass[id]*delta*g[k];
 }
}
