import * as THREE from 'three';
export const SECTION_BASELINE='c4cad2026f10b656a4bc00568be11dcf7429c44f';
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
export const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
// Fitted sculpting constraints in metres, not measured human anatomy. The two
// eyes remain independent; neither the globe nor the first-stage XY curves move.
export const SECTION_FIT=Object.freeze({
 right:{creaseDistance:.00465,creaseInset:.00056,pretarsalLift:.00012,tearTroughDepth:.00048},
 left:{creaseDistance:.00448,creaseInset:.00048,pretarsalLift:.00010,tearTroughDepth:.00042}
});
/** Shape-preserving scalar cubic; x is actual projected surface distance. */
export function hermite(nodes,x){
 const n=nodes.length,d=[],h=[],m=[];
 for(let i=0;i<n-1;i++){h[i]=nodes[i+1][0]-nodes[i][0];if(h[i]<=0)throw Error('Nonmonotone sectional nodes');d[i]=(nodes[i+1][1]-nodes[i][1])/h[i];}
 m[0]=d[0];m[n-1]=d[n-2];for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:(3*(h[i-1]+h[i]))/((2*h[i]+h[i-1])/d[i-1]+(h[i]+2*h[i-1])/d[i]);
 let i=0;while(i<n-2&&x>nodes[i+1][0])i++;const t=clamp((x-nodes[i][0])/h[i],0,1),t2=t*t,t3=t2*t;
 return (2*t3-3*t2+1)*nodes[i][1]+(t3-2*t2+t)*h[i]*m[i]+(-2*t3+3*t2)*nodes[i+1][1]+(t3-t2)*h[i]*m[i+1];
}
function pinNormals(lid,baseNormals,closure){
 const P=lid.mesh.geometry.attributes.position;lid.mesh.geometry.computeVertexNormals();
 const N=lid.mesh.geometry.attributes.normal,EN=lid.edge.geometry.attributes.normal,IN=lid.inside.geometry.attributes.normal;
 for(let i=0;i<P.count;i++){
  const q=lid.entries[i],w=smooth((q.t-.68)/.32),b=smooth(closure);
  let x=lerp(N.getX(i),baseNormals[3*i],b),y=lerp(N.getY(i),baseNormals[3*i+1],b),z=lerp(N.getZ(i),baseNormals[3*i+2],b);
  const len=Math.hypot(x,y,z)||1;x=lerp(x/len,q.src.n.x,w);y=lerp(y/len,q.src.n.y,w);z=lerp(z/len,q.src.n.z,w);const l=Math.hypot(x,y,z)||1;N.setXYZ(i,x/l,y/l,z/l);
 }
 for(let a=0;a<=lid.A;a++){
  const k=a*(lid.es+1)+lid.es;let x=N.getX(a)*.82+EN.getX(k)*.18,y=N.getY(a)*.82+EN.getY(k)*.18,z=N.getZ(a)*.82+EN.getZ(k)*.18,l=Math.hypot(x,y,z)||1;
  N.setXYZ(a,x/l,y/l,z/l);EN.setXYZ(k,x/l,y/l,z/l);
  const first=a*(lid.es+1);x=EN.getX(first)*.75+IN.getX(a)*.25;y=EN.getY(first)*.75+IN.getY(a)*.25;z=EN.getZ(first)*.75+IN.getZ(a)*.25;l=Math.hypot(x,y,z)||1;EN.setXYZ(first,x/l,y/l,z/l);IN.setXYZ(a,x/l,y/l,z/l);
 }
 N.needsUpdate=true;EN.needsUpdate=true;IN.needsUpdate=true;
}
export function reconstructSection(rig,e,closure){
 const {lid,c,section}=e,P=lid.mesh.geometry.attributes.position,E=lid.edge.geometry.attributes.position,S=lid.A+1,R=lid.R;
 const old=section.beforePositions;old.set(P.array);section.beforeNormals.set(lid.mesh.geometry.attributes.normal.array);
 const fit=SECTION_FIT[c.name],open=1-smooth(closure),endRow=Math.floor(R*.79);
 let maxCorrection=0,protectedVertices=0;
 rig._fittingEye=e;
 if(open>0){
  for(let a=0;a<=lid.A;a++){
   const theta=a/lid.A*Math.PI*2,upper=Math.sin(theta)>=0,s=(Math.cos(theta)*c.sign+1)*.5;
   const arc=Math.pow(Math.abs(Math.sin(theta)),.70),root=old[a*3+2],end=endRow*S+a;
   const rx=old[a*3],ry=old[a*3+1],span=Math.hypot(old[end*3]-rx,old[end*3+1]-ry);
   if(span<.0001)continue;
   const zEnd=old[end*3+2],crest=clamp(fit.creaseDistance*(.80+.20*arc),span*.28,span*.57);
   const nodes=upper?[
    [0,root],[crest*.34,root+.00014*arc],[crest*.67,root+.00008*arc],
    [crest,root-fit.creaseInset*arc],[lerp(crest,span,.38),lerp(root,zEnd,.48)],[span,zEnd]
   ]:[
    [0,root],[span*.07,lerp(root,zEnd,.07)+fit.pretarsalLift*arc],
    [span*.26,lerp(root,zEnd,.26)-.00017*arc],[span*.57,lerp(root,zEnd,.57)-.00010*arc],[span,zEnd]
   ];
   const startBlend=smooth(Math.min(s,1-s)/.13);
   for(let j=1;j<endRow;j++){
    const k=j*S+a,q=lid.entries[k],d=Math.hypot(P.getX(k)-rx,P.getY(k)-ry),envelope=1-smooth((q.t-.57)/.22);
    let target=hermite(nodes,d);
    if(!upper){
     const nasal=Math.exp(-Math.pow((s-.23)/.25,2)),centre=span*(.44+.24*s);
     target-=fit.tearTroughDepth*nasal*Math.exp(-Math.pow((d-centre)/(span*.16),2));
    }
    const w=open*envelope*startBlend;let z=lerp(old[k*3+2],target,w);
    const front=rig.eyeFront(c,P.getX(k),P.getY(k));if(front!==null&&z<front+.00010){z=front+.00010;protectedVertices++;}
    P.setZ(k,z);maxCorrection=Math.max(maxCorrection,Math.abs(P.getZ(k)-old[k*3+2]));
   }
  }
  P.needsUpdate=true;
  // Rounded cross-section; the shared anterior and posterior endpoints stay.
  for(let a=0;a<=lid.A;a++){
   const theta=a/lid.A*Math.PI*2,arc=Math.pow(Math.abs(Math.sin(theta)),.65),upper=Math.sin(theta)>=0;
   for(let j=1;j<lid.es;j++){
    const k=a*(lid.es+1)+j,t=j/lid.es,round=Math.sin(Math.PI*t)*(upper?.000045:.000020)*arc*open;
    let z=E.getZ(k)+round;const front=rig.eyeFront(c,E.getX(k),E.getY(k));if(front!==null)z=Math.max(z,front+.000085);E.setZ(k,z);
   }
  }
  E.needsUpdate=true;lid.edge.geometry.computeVertexNormals();pinNormals(lid,section.beforeNormals,closure);
 }
 let boundaryError=0,outlineError=0,nonfinite=0,minClearance=Infinity,penetrations=0;
 for(let k=0;k<P.count;k++){
  const x=P.getX(k),y=P.getY(k),z=P.getZ(k),q=lid.entries[k];
  if(![x,y,z].every(Number.isFinite))nonfinite++;
  const error=Math.hypot(x-old[k*3],y-old[k*3+1],z-old[k*3+2]);
  if(q.t===0)outlineError=Math.max(outlineError,error);if(q.t===1)boundaryError=Math.max(boundaryError,error);
  const front=rig.eyeFront(c,x,y);if(front!==null){minClearance=Math.min(minClearance,z-front);if(z<front-1e-7)penetrations++;}
 }
 section.report={maxSurfaceCorrectionMM:maxCorrection*1000,outlineDeviationMM:outlineError*1000,boundaryDeviationMM:boundaryError*1000,outerPenetrations:penetrations,outerMinAxialGapMM:minClearance*1000,nonfiniteVertices:nonfinite,protectedVertices,closure,completeClosedSurfaceDeltaMM:closure===1?maxCorrection*1000:null,fitParameters:fit,physicalSimulation:false};
 rig._fittingEye=null;
}
