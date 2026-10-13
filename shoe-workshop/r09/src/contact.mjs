import {MeshRay} from '../../r07/src/ray.mjs';
import {add,sub,mul,dot,dist,unit,mix,clamp,stats} from '../../r07/src/geometry.mjs';
import {JOIN_RULES} from './join-plan.mjs';
const rayFor=g=>new MeshRay({positions:Array.from(g.attributes.position.array),indices:Array.from(g.index.array).slice(0,g.groups[0].count)});
/** Sample actual piecewise-linear shells. Aperture centres come from their real
 * ring vertices, not a coarse analytic surface. No hole is filled in geometry.
 */
export class ShellSampler{
 constructor(g,holes=[]){this.g=g;this.centres=new Map();const lookup=new Map(g.userData.template.vertices.map((q,i)=>[q.join(','),i]));const P=g.attributes.position.array,NN=g.attributes.normal.array,np=g.userData.vertexPairs;for(const h of holes){const ids=h.loop.map(q=>lookup.get(q.join(',')));if(ids.some(i=>i===undefined))continue;const avg=(v,offset=0)=>[0,1,2].map(k=>ids.reduce((a,i)=>a+v[(i+offset)*3+k],0)/ids.length);this.centres.set(h.q.join(','),{outer:avg(P,np),inner:avg(P),n:unit(avg(NN,np)),actualHoleRing:true});}const v=g.userData.template.vertices;this.v=v;this.cells=new Map();this.size=3;
  this.ts=g.userData.template.triangles.map(ids=>{const [a,b,c]=ids.map(i=>v[i]);const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);const t={ids,a,b,c,det};
   for(let x=Math.floor(Math.min(a[0],b[0],c[0])/this.size);x<=Math.floor(Math.max(a[0],b[0],c[0])/this.size);x++)for(let y=Math.floor(Math.min(a[1],b[1],c[1])/this.size);y<=Math.floor(Math.max(a[1],b[1],c[1])/this.size);y++){const k=x+','+y;if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(t);}return t;
  });
 }
 at(q){const exact=this.centres.get(q.join(','));if(exact)return exact;const x=Math.floor(q[0]/this.size),y=Math.floor(q[1]/this.size);let best=null,penalty=Infinity;
  for(let pass=0;pass<2&&!best;pass++)for(let dx=-pass;dx<=pass;dx++)for(let dy=-pass;dy<=pass;dy++)for(const t of this.cells.get((x+dx)+','+(y+dy))||[]){if(Math.abs(t.det)<1e-15)continue;const {a,b,c}=t,w0=((b[1]-c[1])*(q[0]-c[0])+(c[0]-b[0])*(q[1]-c[1]))/t.det,w1=((c[1]-a[1])*(q[0]-c[0])+(a[0]-c[0])*(q[1]-c[1]))/t.det,w=[w0,w1,1-w0-w1];
   const p=w.reduce((s,v)=>s+Math.max(0,-v),0);if(p<penalty){best={t,w};penalty=p;}if(p<1e-7)break;
  }
  if(!best)throw Error('No actual shell triangle near requested seam coordinate');
  const {t,w}=best,g=this.g,n=g.userData.vertexPairs,p=g.attributes.position.array,ns=g.attributes.normal.array;
  const sample=(arr,offset=0)=>[0,1,2].map(k=>t.ids.reduce((v,id,j)=>v+w[j]*arr[(id+offset)*3+k],0));
  return {outer:sample(p,n),inner:sample(p),n:unit(sample(ns,n)),extrapolated:penalty>1e-7};
 }
}
export function registerLayers(parts){
 const byId=new Map(parts.map(p=>[p.id,p])),rays=new Map(),reports=[];
 for(const [id,parents]of [[22,[28]],[23,[28]],[27,[28]],[24,[22]],[25,[23]],[21,[24,25,22,23]],[20,[21]]]){
  const g=byId.get(id).geometry,{vertexPairs:n,normals,logicalIndices}=g.userData,p=g.attributes.position.array;
  const hs=parents.map(parent=>{if(!rays.has(parent))rays.set(parent,rayFor(byId.get(parent).geometry));return{parent,ray:rays.get(parent)};});
  const moves=[],gaps=[],before=[],support=new Int32Array(n).fill(-1);
  for(let i=0;i<n;i++){const pt=Array.from(p.slice(i*3,i*3+3)),N=normals[i];let hit=null;
   for(const h of hs){const ray=h.ray.ray(add(pt,mul(N,5)),mul(N,-1));if(ray&&ray.distance<9&&(!hit||ray.distance<hit.distance))hit={...ray,parent:h.parent};}
   if(!hit)continue;const oldGap=hit.distance-5,delta=JOIN_RULES.clearanceMm-oldGap;
   if(Math.abs(delta)>1.65)continue;
   support[i]=hit.parent;before.push(oldGap);moves.push(delta);
   for(let k=0;k<3;k++){p[i*3+k]+=N[k]*delta;p[(n+i)*3+k]+=N[k]*delta;}gaps.push(JOIN_RULES.clearanceMm);
  }
  for(let i=n*2;i<logicalIndices.length;i++){const j=logicalIndices[i];for(let k=0;k<3;k++)p[i*3+k]=p[j*3+k];}
  g.attributes.position.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();
  const old=new Float32Array(g.attributes.normal.array);g.computeVertexNormals();const nn=g.attributes.normal.array;
  for(let i=0;i<n*2;i++){const j=i%n,weight=support[j]===-1?0:.35;const N=unit([0,1,2].map(k=>old[i*3+k]*(1-weight)+nn[i*3+k]*weight));nn.set(N,i*3);}g.attributes.normal.needsUpdate=true;
  g.userData.contactSupport=support;g.userData.report.layerContact={parents,supportedVertices:moves.length,shiftMm:stats(moves),oldGapMm:stats(before),targetClearanceMm:JOIN_RULES.clearanceMm,maxShiftMm:1.65,method:'Ordered actual-triangle inner-skin registration, positive thickness retained',physics:false};reports.push({id,...g.userData.report.layerContact});rays.delete(id);
 }
 return reports;
}
