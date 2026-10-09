import * as THREE from 'three';
import {sampleContour} from './Contours.mjs';
const clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp;
export const closureWeight=b=>{b=clamp(b,0,1);return b*b*(3-2*b);};
const smooth=closureWeight;
/** The original asset is a CLOSED-eye scan. Use its observed outer envelope
 * as the closed endpoint instead of propagating a globe-contact rim offset
 * over the entire skin patch. No new head, texture, ocular scale or hidden eye.
 */
export function prepareClosedSurface(lid,c,sample){
 const cache=new Map();
 c.closedScanMargin=s=>{
  const key=s.toFixed(12);if(cache.has(key))return cache.get(key);
  const q=sampleContour(c.name,s,{closure:1}),x=c.x+c.sign*q.temporalXMM/1000,y=c.y+q.closedMM/1000;
  const p={x,y,z:sample(x,y).z};cache.set(key,p);return p;
 };
 const target=new Float64Array(lid.entries.length*3);
 for(let i=0;i<lid.entries.length;i++){
  const q=lid.entries[i],s=(q.nx*c.sign+1)*.5,p=c.closedScanMargin(clamp(s,0,1)),w=1-smooth(q.t/.74);
  const seam=c.y-.0035+.0028*Math.pow(Math.abs(q.nx),1.7)-.0007*q.nx*c.sign;
  const x=q.xs+(p.x-(c.x+c.half*q.nx))*w,y=q.ys+(p.y-seam)*w;
  target[i*3]=x;target[i*3+1]=y;target[i*3+2]=sample(x,y).z;
 }
 lid.closedSurface={target,source:'same original closed-scan geometry',neuralReconstruction:false};
}
export function repairClosedSurface(rig,e,blink){
 const {lid,c}=e,closed=lid.closedSurface;if(!closed)return;
 blink=clamp(blink,0,1);
 const enabled=rig.closedRestEnabled!==false&&!rig.contourBaseline,b=enabled?closureWeight(blink):0;
 const P=lid.mesh.geometry.attributes.position,target=closed.target,stride=lid.A+1;
 rig._fittingEye=e;
 const rimDelta=Float64Array.from({length:stride},(_,a)=>P.getZ(a)-target[a*3+2]);
 let maximumCorrection=0,minGap=Infinity,penetrations=0,lowerError=0,upperError=0,boundaryError=0;
 for(let i=0;i<P.count;i++){
  const q=lid.entries[i],a=i%stride,w=1-smooth(q.t/.74),before=P.getZ(i);
  let z=before;
  if(b>0&&q.t>0&&q.t<.74){
   // Keep the current contour exact. Its depth difference is distributed
   // smoothly over the captured closed envelope; at full closure it is zero.
   const restZ=target[i*3+2]+rimDelta[a]*w;
   z=mix(before,restZ,b);
   const eye=rig.eyeFront(c,P.getX(i),P.getY(i));
   if(eye!==null)z=Math.max(z,eye+.00010);
   P.setZ(i,z);
  }
  maximumCorrection=Math.max(maximumCorrection,Math.abs(P.getZ(i)-before));
  const eye=rig.eyeFront(c,P.getX(i),P.getY(i));
  if(eye!==null){const gap=P.getZ(i)-eye;minGap=Math.min(minGap,gap);if(gap<-.0000001)penetrations++;}
  if(blink===1){
   const error=Math.hypot(P.getX(i)-target[i*3],P.getY(i)-target[i*3+1],P.getZ(i)-target[i*3+2]);
   if(q.ny<0)lowerError=Math.max(lowerError,error);else upperError=Math.max(upperError,error);
  }
  if(q.t===1)boundaryError=Math.max(boundaryError,Math.hypot(P.getX(i)-q.xs,P.getY(i)-q.ys,P.getZ(i)-q.src.z));
 }
 if(b>0){
  P.needsUpdate=true;lid.mesh.geometry.computeVertexNormals();
  const N=lid.mesh.geometry.attributes.normal,EN=lid.edge.geometry.attributes.normal;
  // Match the preserved face at the patch boundary, and share free-edge normals.
  for(let i=0;i<P.count;i++){
   const q=lid.entries[i],w=smooth((q.t-.72)/.28);if(w===0)continue;
   let x=mix(N.getX(i),q.src.n.x,w),y=mix(N.getY(i),q.src.n.y,w),z=mix(N.getZ(i),q.src.n.z,w),l=Math.hypot(x,y,z)||1;
   N.setXYZ(i,x/l,y/l,z/l);
  }
  for(let a=0;a<=lid.A;a++){
   const k=a*(lid.es+1)+lid.es;let x=N.getX(a)*.72+EN.getX(k)*.28,y=N.getY(a)*.72+EN.getY(k)*.28,z=N.getZ(a)*.72+EN.getZ(k)*.28,l=Math.hypot(x,y,z)||1;
   N.setXYZ(a,x/l,y/l,z/l);EN.setXYZ(k,x/l,y/l,z/l);
  }
  N.needsUpdate=true;EN.needsUpdate=true;
 }
 closed.report={enabled,closure:blink,target:closed.source,maximumFrameCorrectionMM:maximumCorrection*1000,fullClosureLowerRestErrorMM:blink===1?lowerError*1000:null,fullClosureUpperRestErrorMM:blink===1?upperError*1000:null,outerBoundaryErrorMM:boundaryError*1000,outerMinGlobeClearanceMM:minGap*1000,outerPenetratingVertices:penetrations,closedRestTargetAvailable:true,volumeConservationClaim:false};
 if(e.contactReport){e.contactReport.minOuterClearanceMM=minGap*1000;e.contactReport.penetratingTestVertices=penetrations;e.contactReport.closedRestSurface=closed.report;}
 rig._fittingEye=null;
}
