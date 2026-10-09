import * as THREE from 'three';
import {sampleContour} from './Contours.mjs';
const clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp;
export const closureWeight=b=>{b=clamp(b,0,1);return b*b*(3-2*b);};
const smooth=closureWeight;
/** Use a constrained fit of the observed CLOSED-eye surface as the endpoint,
 * not a globe-contact rim offset propagated over the whole skin patch. */
export function prepareClosedSurface(lid,c,sample){
 const cache=new Map();
 c.closedScanMargin=s=>{
  const key=s.toFixed(12);if(cache.has(key))return cache.get(key);
  const q=sampleContour(c.name,s,{closure:1}),x=c.x+c.sign*q.temporalXMM/1000,y=c.y+q.closedMM/1000;
  const p={x,y,z:sample(x,y).z};cache.set(key,p);return p;
 };
 const target=new Float64Array(lid.entries.length*3),normals=new Float64Array(target.length);
 for(let i=0;i<lid.entries.length;i++){
  const q=lid.entries[i],s=(q.nx*c.sign+1)*.5,p=c.closedScanMargin(clamp(s,0,1)),w=1-smooth(q.t/.74);
  const seam=c.y-.0035+.0028*Math.pow(Math.abs(q.nx),1.7)-.0007*q.nx*c.sign;
  const x=q.xs+(p.x-(c.x+c.half*q.nx))*w,y=q.ys+(p.y-seam)*w;
  const raw=sample(x,y);target[i*3]=x;target[i*3+1]=y;target[i*3+2]=raw.z;normals.set(raw.n.toArray(),i*3);
 }
 // The captured crease contains overhangs: its frontmost ray samples are
 // discontinuous. Fair the resampled patch, preserving its seam and face edge,
 // rather than triangulating those height jumps into a saw-tooth strip.
 const raw=target.slice(),A=lid.A,R=lid.R,S=A+1;
 for(let pass=0;pass<48;pass++){
  const next=target.slice();
  for(let j=1;j<R;j++)for(let a=0;a<A;a++){
   const k=j*S+a,t=j/R,w=1-smooth((t-.30)/.44);
   if(w===0)continue;
   const z=.40*target[k*3+2]+.15*(target[(j*S+(a+A-1)%A)*3+2]+target[(j*S+(a+1)%A)*3+2]+target[(k-S)*3+2]+target[(k+S)*3+2]);
   next[k*3+2]=mix(target[k*3+2],z,w);
  }
  for(let j=0;j<=R;j++)next[(j*S+A)*3+2]=next[j*S*3+2];target.set(next);
 }
 let fitDeviation=0;for(let i=2;i<raw.length;i+=3)fitDeviation=Math.max(fitDeviation,Math.abs(raw[i]-target[i]));
 const g=lid.mesh.geometry.clone();g.attributes.position.array.set(target);g.computeVertexNormals();normals.set(g.attributes.normal.array);g.dispose();
 lid.closedSurface={target,raw,normals,fitDeviationMM:fitDeviation*1000,source:'boundary-constrained fair fit of the same closed scan',neuralReconstruction:false};
}
/** The inherited fit tested only the inner 0.8r disc. Check the entire
 * observed closed envelope, including peripheral inferior sclera. Move only
 * the minimum necessary depth; never change the radius or XY centre. */
export function fitClosedEnvelope(rig){
 for(const e of rig.eyes){
  if(e.closedDepthFit)continue;
  const {c,lid}=e,old=c.z,saved=e.surfaceInverse;
  e.surfaceInverse=new THREE.Matrix4();rig._fittingEye=e;
  let min=Infinity,samples=0;
  const test=(x,y,z)=>{const front=rig.eyeFront(c,x,y);if(front!==null){min=Math.min(min,z-front);samples++;}};
  for(let i=0;i<lid.closedSurface.target.length;i+=3){const p=lid.closedSurface.target;test(p[i],p[i+1],p[i+2]);}
  for(let i=-64;i<=64;i++)for(let j=-64;j<=64;j++){
   const dx=i/64*c.radius*.995,dy=j/64*c.radius*.995;if(dx*dx+dy*dy>=c.radius*c.radius)continue;
   const x=c.x+dx,y=c.y+dy;test(x,y,c.referenceSurface(x,y).z);
  }
  const shift=Math.max(0,.00012-min);c.z-=shift;e.pivot.position.z=c.z;
  e.closedDepthFit={source:'same captured closed scan; full projected globe support',samples,previousDepthMM:old*1000,fittedDepthMM:c.z*1000,backwardShiftMM:shift*1000,priorMinimumGapMM:min*1000,numericalClearanceMM:.12,radiusUnchanged:true,xyCentreUnchanged:true};
  e.surfaceInverse=saved;rig._fittingEye=null;
 }
}
export function applyClosureCalibration(rig){
 const before=rig.closedRestEnabled===false||rig.contourBaseline;
 for(const e of rig.eyes){if(!e.closedDepthFit)continue;e.c.z=(before?e.closedDepthFit.previousDepthMM:e.closedDepthFit.fittedDepthMM)/1000;e.pivot.position.z=e.c.z;}
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
  const cs=(q.nx*c.sign+1)*.5,canthal=enabled?1-smooth(Math.min(cs,1-cs)/.14):0,strength=1-(1-b)*(1-canthal);
  let z=before;
  if(strength>0&&q.t>0&&q.t<.74){
   const restZ=target[i*3+2]+rimDelta[a]*w;
   z=mix(before,restZ,strength);
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
 if(enabled){
  const I=lid.inside.geometry.attributes.position,E=lid.edge.geometry.attributes.position;
  for(let a=0;a<=lid.A;a++){
   const s=(Math.cos(a/lid.A*Math.PI*2)*c.sign+1)*.5,corner=1-smooth(Math.min(s,1-s)/.16);
   const offset=Math.max(0,P.getZ(a)-.00020-I.getZ(a))*corner;
   for(let j=0;j<=lid.ni;j++){const k=j*stride+a;I.setZ(k,I.getZ(k)+offset*(1-smooth(j/(lid.ni*.18))));}
   for(let j=0;j<=lid.es;j++){
    const t=j/lid.es,k=a*(lid.es+1)+j;let z=mix(I.getZ(a),P.getZ(a),t)+Math.sin(Math.PI*t)*.000025*(1-blink);
    const front=rig.eyeFront(c,E.getX(k),E.getY(k));if(front!==null&&j>0&&j<lid.es)z=Math.max(z,front+.000085);E.setZ(k,z);
   }
  }
  I.needsUpdate=true;E.needsUpdate=true;lid.inside.geometry.computeVertexNormals();lid.edge.geometry.computeVertexNormals();
  if(e.canthus){
   const C=e.canthus.mesh.geometry.attributes.position;
   for(let i=0;i<C.count;i++){
    const x=C.getX(i),y=C.getY(i),nx=clamp((x-c.x)/(c.sign*(c.name==='right'?.0234:.0230)*.5),-1,1);
    const a=Math.acos(clamp(nx*c.sign,-1,1)),u=rig.margin(c,a,blink),l=rig.margin(c,Math.PI*2-a,blink);
    const v=Math.abs(u.y-l.y)>1e-8?clamp((y-l.y)/(u.y-l.y),0,1):.5;
    C.setZ(i,Math.max(C.getZ(i),mix(l.z,u.z,v)-.00014));
   }
   C.needsUpdate=true;e.canthus.mesh.geometry.computeVertexNormals();
  }
  P.needsUpdate=true;lid.mesh.geometry.computeVertexNormals();
  const N=lid.mesh.geometry.attributes.normal,EN=lid.edge.geometry.attributes.normal;
  for(let i=0;i<P.count;i++){
   const q=lid.entries[i],w=smooth((q.t-.72)/.28);if(w===0)continue;
   let x=mix(N.getX(i),q.src.n.x,w),y=mix(N.getY(i),q.src.n.y,w),z=mix(N.getZ(i),q.src.n.z,w),l=Math.hypot(x,y,z)||1;
   N.setXYZ(i,x/l,y/l,z/l);
  }
  for(let i=0;i<P.count;i++){
   const n=closed.normals;let x=mix(N.getX(i),n[3*i],b),y=mix(N.getY(i),n[3*i+1],b),z=mix(N.getZ(i),n[3*i+2],b),len=Math.hypot(x,y,z)||1;
   // Lock the surrounding face normals after the closed-target blend. This
   // prevents a circular lighting seam at the preserved facial boundary.
   const q=lid.entries[i],w=smooth((q.t-.70)/.25);
   x=mix(x/len,q.src.n.x,w);y=mix(y/len,q.src.n.y,w);z=mix(z/len,q.src.n.z,w);len=Math.hypot(x,y,z)||1;
   N.setXYZ(i,x/len,y/len,z/len);
  }
  for(let a=0;a<=lid.A;a++){
   const k=a*(lid.es+1)+lid.es,w=.28*(1-b);let x=N.getX(a)*(1-w)+EN.getX(k)*w,y=N.getY(a)*(1-w)+EN.getY(k)*w,z=N.getZ(a)*(1-w)+EN.getZ(k)*w,l=Math.hypot(x,y,z)||1;
   N.setXYZ(a,x/l,y/l,z/l);EN.setXYZ(k,x/l,y/l,z/l);
  }
  N.needsUpdate=true;EN.needsUpdate=true;
 }
 closed.report={enabled,closure:blink,target:closed.source,maximumFrameCorrectionMM:maximumCorrection*1000,fullClosureLowerRestErrorMM:blink===1?lowerError*1000:null,fullClosureUpperRestErrorMM:blink===1?upperError*1000:null,outerBoundaryErrorMM:boundaryError*1000,outerMinGlobeClearanceMM:minGap*1000,outerPenetratingVertices:penetrations,closedRestTargetAvailable:true,closedTargetMaxDeviationFromRawScanMM:closed.fitDeviationMM,volumeConservationClaim:false};
 if(e.contactReport){e.contactReport.minOuterClearanceMM=minGap*1000;e.contactReport.penetratingTestVertices=penetrations;e.contactReport.closedRestSurface=closed.report;}
 rig._fittingEye=null;
}
/** Use the already present finite outer overlap ring, not an eye mask. */
export function installGrayBoundaryOverlap(rig){
 for(const e of rig.eyes){
  const m=e.lid.mesh.material,oldClip=m.userData.stage1Clip;
  if(!oldClip||!oldClip.includes('>1.000001'))throw Error('Missing gray overlap anchor');
  const clip=oldClip.replace('>1.000001','>1.010025'),before=m.onBeforeCompile,cache=m.customProgramCacheKey();
  m.onBeforeCompile=s=>{before(s);s.fragmentShader=s.fragmentShader.replace(oldClip,clip);};
  m.userData.stage1Clip=clip;m.customProgramCacheKey=()=>cache+'/finite-overlap';
  m.polygonOffset=true;m.polygonOffsetFactor=-.1;m.polygonOffsetUnits=-.2;m.needsUpdate=true;
 }
 const button=document.createElement('button');button.id='s1UnderView';button.className='s1-primary';button.textContent='深仰视角 / 检查闭合';
 button.onclick=()=>{window.__SKIN_LAB__.setView([-.004,-.046,.152],[-.004,.069,.069]);window.__SKIN_LAB__.render();};
 document.getElementById('s1ClosedCheck').after(button);window.__STAGE1__.underView=button.onclick;
}
