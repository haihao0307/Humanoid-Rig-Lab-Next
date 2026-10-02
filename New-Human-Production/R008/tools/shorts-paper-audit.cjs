'use strict';
// Independent metric/mass/topology audit of explicitly supplied coordinates.
// Importing this helper reads no files and starts no solver or browser.
function paperAudit(d,xyz){
 if(!xyz||xyz.length!==d.mass.length*3)throw Error('Explicit matching actual coordinates required');
 const uv=d.uv,tri=d.triangles,count=d.mass.length,vertexMass=Array(count).fill(0);
 let maximum=0,worst=null,area=0;
 for(let k=0;k<tri.length;k+=3){
  const ids=tri.slice(k,k+3),u=ids.map(i=>uv.slice(i*2,i*2+2)),p=ids.map(i=>xyz.slice(i*3,i*3+3));
  const du=u[1][0]-u[0][0],dv=u[1][1]-u[0][1],eu=u[2][0]-u[0][0],ev=u[2][1]-u[0][1],det=du*ev-dv*eu;
  if(!Number.isFinite(det)||Math.abs(det)<1e-14)throw Error('Degenerate source paper triangle');
  const a=Math.abs(det)/2;area+=a;for(const i of ids)vertexMass[i]+=a*.22/3;
  const A=p[1].map((v,j)=>(ev*(v-p[0][j])-dv*(p[2][j]-p[0][j]))/det),B=p[1].map((v,j)=>(du*(p[2][j]-p[0][j])-eu*(v-p[0][j]))/det);
  const aa=A.reduce((s,v)=>s+v*v,0),bb=B.reduce((s,v)=>s+v*v,0),ab=A.reduce((s,v,j)=>s+v*B[j],0),hi=(aa+bb+Math.hypot(aa-bb,2*ab))/2,lo=hi?Math.max(0,aa*bb-ab*ab)/hi:0;
  const strain=Math.max(Math.abs(Math.sqrt(hi)-1),Math.abs(Math.sqrt(lo)-1));
  if(!Number.isFinite(strain))throw Error('Nonfinite actual paper metric');if(strain>maximum){maximum=strain;worst={triangle:k/3,sourceIndices:ids};}
 }
 const parents=Array.from({length:count},(_,i)=>i),find=i=>parents[i]===i?i:parents[i]=find(parents[i]);
 let gap=0,pairs=0;for(const s of d.seams)for(const p of s.pairs){parents[find(p.b)]=find(p.a);gap=Math.max(gap,Math.hypot(...[0,1,2].map(k=>xyz[p.a*3+k]-xyz[p.b*3+k])));pairs++;}
 const massDiff=Math.max(...vertexMass.map((v,i)=>Math.abs(v-d.mass[i]))),g=d.pieces.find(p=>p.id==='G');
 const width=Math.max(...g.materialCoordinates.map(u=>u[0]))-Math.min(...g.materialCoordinates.map(u=>u[0]));
 const dofs=new Set(parents.map((_,i)=>find(i))).size;
 return {scope:'explicit actual coordinates against same-input original paper; no body or motion acceptance',rawValues:xyz.length,maximumPrincipalStrain:maximum,worst,areaM2:area,massKg:vertexMass.reduce((s,v)=>s+v,0),maximumVertexMassDifferenceKg:massDiff,seams:d.seams.length,sourcePairs:pairs,actualSourceQuotient:dofs,maximumSourcePairGapM:gap,gussetWidthM:width,expectedGussetWidthM:.060*d.receipt.gusset.actualStatureScale,valid:count===553&&maximum<=.05&&gap<=1e-12&&massDiff<=1e-12&&d.seams.length===19&&dofs===451&&Math.abs(width-.060*d.receipt.gusset.actualStatureScale)<1e-12};
}
module.exports={paperAudit};
