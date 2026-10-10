import * as THREE from 'three';
const clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp;
export const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
export const BROW_FIT=Object.freeze({
 right:{x:-.030,sign:-1,span:.024,crestY:.0860,arch:.0018,lift:.0021,sulcus:.00065},
 left:{x:.0217,sign:1,span:.0235,crestY:.0856,arch:.0019,lift:.0019,sulcus:.00058}
});
/** Compact, continuous displacement of the existing head and lid surfaces.
 * Not eyebrow hair, a floating tube, or a claim about the hidden skull. */
export function browField(x,y,z){
 if(z<.040||y<.077||y>.107)return 0;
 let d=0;
 for(const f of Object.values(BROW_FIT)){
  const u=(x-f.x)*f.sign/f.span;if(Math.abs(u)>=1)continue;
  const lateral=1-smooth((Math.abs(u)-.58)/.42),crest=f.crestY+f.arch*(1-u*u)+.00045*u;
  const rise=f.lift*Math.exp(-Math.pow((y-crest)/.0046,2));
  const sulcus=f.sulcus*Math.exp(-Math.pow((y-(crest-.0050))/.0026,2));
  d+=(rise-sulcus)*lateral*smooth((y-.077)/.0035)*(1-smooth((y-.099)/.008));
 }
 return d;
}
function transformedNormal(x,y,z,nx,ny,nz){
 const h=.00002,dx=(browField(x+h,y,z)-browField(x-h,y,z))/(2*h),dy=(browField(x,y+h,z)-browField(x,y-h,z))/(2*h);
 const a=nx-nz*dx,b=ny-nz*dy,l=Math.hypot(a,b,nz)||1;return [a/l,b/l,nz/l];
}
export function prepareBrow(rig){
 const g=rig.mesh.geometry,P=g.attributes.position,N=g.attributes.normal;
 rig.browRest={positions:P.array.slice(),normals:N.array.slice()};
 const delta=new Float32Array(P.count),normal=new Float32Array(N.array.length);let count=0,max=0,min=0;
 for(let i=0;i<P.count;i++){
  const x=P.getX(i),y=P.getY(i),z=P.getZ(i),d=browField(x,y,z);delta[i]=d;
  normal.set(d!==0?transformedNormal(x,y,z,N.getX(i),N.getY(i),N.getZ(i)):[N.getX(i),N.getY(i),N.getZ(i)],i*3);
  if(Math.abs(d)>1e-10)count++;max=Math.max(max,d);min=Math.min(min,d);
 }
 rig.browRest.delta=delta;rig.browRest.fittedNormals=normal;
 rig.browReport={affectedHeadVertices:count,maxForwardMM:max*1000,maxRecessMM:min*1000,sourceAssetChanged:false,runtimeHeadVerticesChanged:true,separateBrowObject:false,fitParameters:BROW_FIT};
}
export function applyBrowHead(rig,on){
 if(!rig.browRest)return;const {positions,normals,delta,fittedNormals}=rig.browRest,g=rig.mesh.geometry,P=g.attributes.position,N=g.attributes.normal;
 P.array.set(positions);N.array.set(on?fittedNormals:normals);
 if(on)for(let i=0;i<P.count;i++)P.setZ(i,positions[i*3+2]+delta[i]);
 P.needsUpdate=true;N.needsUpdate=true;g.computeBoundingSphere();
}
export function applyBrowLid(rig,e){
 const g=e.lid.mesh.geometry,P=g.attributes.position,N=g.attributes.normal;let max=0,outline=0,boundary=0,low=0;
 for(let i=0;i<P.count;i++){
  const x=P.getX(i),y=P.getY(i),z=P.getZ(i),q=e.lid.entries[i],d=browField(x,y,z);
  if(Math.abs(d)>1e-12){const n=transformedNormal(x,y,z,N.getX(i),N.getY(i),N.getZ(i));P.setZ(i,z+d);N.setXYZ(i,...n);}
  max=Math.max(max,Math.abs(P.getZ(i)-z));if(q.t===0)outline=Math.max(outline,Math.abs(d));if(q.ny<0)low=Math.max(low,Math.abs(d));
  if(q.t===1){const expected=q.src.z+browField(q.xs,q.ys,q.src.z);boundary=Math.max(boundary,Math.abs(P.getZ(i)-expected));}
 }
 P.needsUpdate=true;N.needsUpdate=true;
 e.s3Brow={maxLidCorrectionMM:max*1000,freeMarginCorrectionMM:outline*1000,lowerLidCorrectionMM:low*1000,joinedOuterBoundaryErrorMM:boundary*1000};
}
/** Rebuild the interior of the existing medial indexed sheet. The two edge
 * attachments are copied exactly from the posterior free-margin mesh. */
export function refineMedial(rig,e,closure){
 const {lid,c,section}=e,part=section.medial,{U,V,mesh}=part,P=mesh.geometry.attributes.position,I=lid.inside.geometry.attributes.position,IN=lid.inside.geometry.attributes.normal;
 const open=1-smooth(closure);let correction=0,attachment=0,nonfinite=0,minGap=Infinity,penetrations=0;rig._fittingEye=e;
 if(open>0){
  for(let i=0;i<=U;i++){
   const topIndex=c.sign<0?i:lid.A/2-i,bottomIndex=lid.A-topIndex,q=(1-Math.cos(i/lid.A*Math.PI*2))/(1-Math.cos(U/lid.A*Math.PI*2));
   for(let j=0;j<=V;j++){
    const v=j/V,k=i*(V+1)+j,old=P.getZ(k),bank=Math.sin(Math.PI*v),interior=Math.pow(bank,1.6);
    let x=mix(I.getX(topIndex),I.getX(bottomIndex),v),y=mix(I.getY(topIndex),I.getY(bottomIndex),v),z=mix(I.getZ(topIndex),I.getZ(bottomIndex),v);
    x-=c.sign*.00016*smooth(q)*interior*open;
    const front=rig.eyeFront(c,x,y);
    // A broad, recessed basin meets the globe gradually, instead of two
    // separate spikes sticking forward from a flat triangular flap.
    if(front!==null)z=mix(z,front+.000105,smooth((q-.12)/.88)*Math.pow(bank,.80)*open);
    const support=Math.pow(Math.sin(Math.PI*q),2)*interior*open;
    const car=.00046*Math.exp(-Math.pow((q-.28)/.22,2)-Math.pow((v-.57)/.29,2));
    const plica=.00026*Math.exp(-Math.pow((q-(.66+.045*Math.sin(Math.PI*v)))/.115,2));
    const lake=.00015*Math.exp(-Math.pow((q-.49)/.17,2));
    z+=(car+plica-lake)*support;
    if(front!==null)z=Math.max(z,front+.00010);
    if(j===0){x=I.getX(topIndex);y=I.getY(topIndex);z=I.getZ(topIndex);}
    if(j===V){x=I.getX(bottomIndex);y=I.getY(bottomIndex);z=I.getZ(bottomIndex);}
    P.setXYZ(k,x,y,z);correction=Math.max(correction,Math.abs(P.getZ(k)-old));
   }
  }
  P.needsUpdate=true;mesh.geometry.computeVertexNormals();
  const N=mesh.geometry.attributes.normal;
  for(let i=0;i<=U;i++){
   const top=c.sign<0?i:lid.A/2-i,bottom=lid.A-top;
   for(let j=0;j<=V;j++){
    const k=i*(V+1)+j,w=1-smooth(Math.min(j,V-j)/3),a=j<V/2?top:bottom;if(w<=0)continue;
    const x=mix(N.getX(k),IN.getX(a),w*.85),y=mix(N.getY(k),IN.getY(a),w*.85),z=mix(N.getZ(k),IN.getZ(a),w*.85),l=Math.hypot(x,y,z)||1;N.setXYZ(k,x/l,y/l,z/l);
   }
  }N.needsUpdate=true;
 }
 for(let i=0;i<=U;i++)for(let j=0;j<=V;j++){
  const k=i*(V+1)+j,x=P.getX(k),y=P.getY(k),z=P.getZ(k),top=c.sign<0?i:lid.A/2-i,bottom=lid.A-top;
  if(![x,y,z].every(Number.isFinite))nonfinite++;
  if(j===0||j===V){const a=j===0?top:bottom;attachment=Math.max(attachment,Math.hypot(x-I.getX(a),y-I.getY(a),z-I.getZ(a)));}
  const f=rig.eyeFront(c,x,y);if(f!==null){minGap=Math.min(minGap,z-f);if(z<f-1e-7)penetrations++;}
 }
 e.s3Medial={maxCorrectionMM:correction*1000,maxAttachmentErrorMM:attachment*1000,nonfiniteVertices:nonfinite,penetrations,minGlobeGapMM:minGap*1000,independentPlugAdded:false,sameIndexedSheet:true,fullyClosedSurfaceChanged:false};rig._fittingEye=null;
}
