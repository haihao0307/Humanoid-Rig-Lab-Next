/* Shape-preserving differential cage fitting. Opening guides and free crown differ.
 * Actual finite-thickness inner material is built separately after subdivision.
 * Rest geometry/UV belongs to the attributed source. This is NOT yarn dynamics. */
import {subdivision,sample,measurements,normals} from '../core.mjs';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function fitKnit(mesh,meta,s,hp){
 const original=meta.mother;let refined={vertices:original.controls,faces:original.faces};
 const extra=Math.min(2,original.subdivision-1);for(let n=0;n<extra;n++)refined=subdivision(refined.vertices,refined.faces);
 const src={...original,controls:refined.vertices,faces:refined.faces,subdivision:original.subdivision-extra},reference=measurements(hp,.012),sx=reference.widthMM/156.4438032360954,sz=reference.depthMM/197.14621152491912,isCable=meta.id==='cable';
 // These dimensions are the recorded native reference scalp sections, NOT ear-inclusive bounds.
 const baseLift=(isCable?.030:.014)+(s.wearBandMM-12)/1000,pitch=s.wearPitchDeg*Math.PI/180,co=Math.cos(pitch),si=Math.sin(pitch),pivot=s.wearBandMM/1000;
 const rest=src.controls.map(p=>{const x=(p[0]-meta.origin[0])*sx,y=p[1]-meta.origin[1]+baseLift,z=(p[2]-meta.origin[2])*sz;return[x,pivot+co*(y-pivot)-si*z,si*(y-pivot)+co*z];}),N=rest.length,adj=Array.from({length:N},()=>new Set()),edges=new Map();
 for(const face of src.faces)for(let i=0;i<face.length;i++){const a=face[i],b=face[(i+1)%face.length],key=a<b?a+':'+b:b+':'+a;adj[a].add(b);adj[b].add(a);edges.set(key,(edges.get(key)||0)+1);}
 const opening=new Set([...edges].filter(([,n])=>n===1).flatMap(([e])=>e.split(':').map(Number)));
 if(!isCable)for(const i of [...opening]){const p=rest[i];if(p[1]<-.025||Math.hypot(p[0],p[2])<.06)opening.delete(i);}
 const delta=Array.from({length:N},()=>[0,0,0]),targets=new Map(),shell=s.materialMM/1000,margin=(s.clearanceMM+s.hairMM)/1000;
 function target(p,attract=false){
  const y=p[1];if(y<hp.ymin+.001||y>=hp.ymax-.002)return null;
  const c=sample(hp,y,0).center,a=Math.atan2(p[2]-c[1],p[0]-c[0]),h=sample(hp,y,a),r=Math.hypot(p[0]-h.center[0],p[2]-h.center[1]);if(!h.valid||h.r<.006)return null;
  // Finite neighbourhood envelope bridges sharp ear features rather than tracing skin dimples.
  let envelope=h.r;for(const yy of [-.005,0,.005])for(const da of [-.06,0,.06]){const q=sample(hp,clamp(y+yy,hp.ymin,hp.ymax-.001),a+da);if(q.valid)envelope=Math.max(envelope,q.r);}
  const required=envelope+shell+margin+.0007;if(!attract&&r>=required)return null;
  return[h.center[0]+required*Math.cos(a),y,h.center[1]+required*Math.sin(a)];
 }
 for(const i of opening){const q=target(rest[i],true);if(q)targets.set(i,q);}
 let maxMove=0;
 for(let step=0;step<100;step++){
  const next=Array.from({length:N},()=>[0,0,0]);
  for(let i=0;i<N;i++){
   const current=rest[i].map((x,k)=>x+delta[i][k]),collision=target(current),guide=targets.get(i);let w=.12+adj[i].size;
   for(const j of adj[i])for(let k=0;k<3;k++)next[i][k]+=delta[j][k];
   if(guide){w+=14;for(let k=0;k<3;k++)next[i][k]+=14*(guide[k]-rest[i][k]);}
   if(collision){w+=35;for(let k=0;k<3;k++)next[i][k]+=35*(collision[k]-rest[i][k]);}
   for(let k=0;k<3;k++)next[i][k]/=w;
  }
  for(let i=0;i<N;i++){delta[i]=next[i];maxMove=Math.max(maxMove,Math.hypot(...next[i]));}
 }
 const top=Math.max(...rest.map(p=>p[1]));
 const controls=rest.map((p,i)=>{const q=p.map((x,k)=>x+delta[i][k]),u=clamp((p[1]-.030)/Math.max(.03,top-.030)),w=u*u*(3-2*u),bulge=(s.crownFullness-1)*w;
  q[0]*=1+bulge;q[2]*=1+bulge;q[1]+=s.crownMM/1000*w;q[2]-=s.backLeanMM/1000*w;return q.map((x,k)=>x+meta.origin[k]);});
 let evaluated={vertices:controls,faces:src.faces};for(let n=0;n<src.subdivision;n++)evaluated=subdivision(evaluated.vertices,evaluated.faces);
 const out=Float32Array.from(mesh.position,(_,i)=>evaluated.vertices[mesh.groups[Math.floor(i/3)]][i%3]-meta.origin[i%3]),cols=new Float32Array(out.length);let minGap=Infinity,domain=0;
 for(let i=0;i<out.length;i+=3){const y=out[i+1],support=y<.04&&y>-.06,color=support?[.12,.68,.64]:[.80,.53,.27];cols.set(color,i);
  if(y>=hp.ymin&&y<hp.ymax-.001){const c=sample(hp,y,0).center,a=Math.atan2(out[i+2]-c[1],out[i]-c[0]),h=sample(hp,y,a);if(h.valid){minGap=Math.min(minGap,Math.hypot(out[i]-h.center[0],out[i+2]-h.center[1])-h.r);domain++;}}
 }
 const m=measurements(hp,s.wearBandMM/1000);
 return {position:out,normal:normals(mesh,out),colors:cols,measurement:m,diagnostics:{mode:'differential-knit-cage',actualOpeningGuideNodes:targets.size,cageNodes:N,sourceRestShapePreserved:true,maximumCageDisplacementMM:maxMove*1000,scales:[sx,1,sz],materialThicknessMM:s.materialMM,thicknessHasGeometry:true,pointwiseScalpClamp:false,highResolutionScalpProjection:false,contactNeighbourhoodMM:5,contactAngularNeighbourhoodRadians:.06,sampledVertices:domain,minimumRadialClearanceMM:minGap*1000,bandMedianMM:null,bandSampleBins:0,restCircumferenceMM:m.headCircumferenceMM*(1-s.negativeEase),requiredCircumferentialStretch:1/(1-s.negativeEase)-1,scope:'Static differential control-cage deformation with source opening guides and local contact constraints. Free crown rest geometry retained. Not calibrated physical cloth or a continuous collision guarantee.',physicalValidated:false}};
}
