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
/** Fair the existing connected medial basin with fixed boundary attachments.
 * A rejected candidate forced its centre directly onto the distant globe and
 * created a 3-4mm deep wedge. Here movement is bounded to 0.30mm and preserves
 * the already validated tear-lake bank and its finite globe transition. */
export function refineMedial(rig,e,closure){
 const {lid,c,section}=e,part=section.medial,{U,V,mesh}=part,P=mesh.geometry.attributes.position,I=lid.inside.geometry.attributes.position;
 const open=1-smooth(closure),original=P.array.slice(),z=Float64Array.from({length:P.count},(_,i)=>P.getZ(i)),next=z.slice(),fronts=new Float64Array(P.count);fronts.fill(-Infinity);
 let correction=0,attachment=0,nonfinite=0,minGap=Infinity,penetrations=0;rig._fittingEye=e;
 if(open>0){
  for(let k=0;k<P.count;k++){const f=rig.eyeFront(c,P.getX(k),P.getY(k));if(f!==null)fronts[k]=f;}
  for(let pass=0;pass<18;pass++){
   for(let i=1;i<U;i++)for(let j=1;j<V;j++){
    const k=i*(V+1)+j,neighbours=[k-1,k+1,k-V-1,k+V+1],q=(1-Math.cos(i/lid.A*Math.PI*2))/(1-Math.cos(U/lid.A*Math.PI*2)),v=j/V;
    let sum=0,weight=0;
    for(const n of neighbours){const w=1/Math.max(.00004,Math.hypot(P.getX(k)-P.getX(n),P.getY(k)-P.getY(n)));sum+=z[n]*w;weight+=w;}
    const strength=.34*Math.pow(Math.sin(Math.PI*q)*Math.sin(Math.PI*v),.7)*open;
    const candidate=mix(z[k],sum/weight,strength),limit=.00030*open;
    next[k]=Math.max(fronts[k]+.00010,clamp(candidate,original[k*3+2]-limit,original[k*3+2]+limit));
   }
   z.set(next);
  }
  for(let i=1;i<U;i++)for(let j=1;j<V;j++){const k=i*(V+1)+j;P.setZ(k,z[k]);correction=Math.max(correction,Math.abs(P.getZ(k)-original[k*3+2]));}
  P.needsUpdate=true;mesh.geometry.computeVertexNormals();
  // Do not average this anterior surface with inward-facing conjunctival
  // normals: that reverses the lighting along the bank and produces black bands.
 }
 for(let i=0;i<=U;i++)for(let j=0;j<=V;j++){
  const k=i*(V+1)+j,x=P.getX(k),y=P.getY(k),zz=P.getZ(k),top=c.sign<0?i:lid.A/2-i,bottom=lid.A-top;
  if(![x,y,zz].every(Number.isFinite))nonfinite++;
  if(j===0||j===V){const a=j===0?top:bottom;attachment=Math.max(attachment,Math.hypot(x-I.getX(a),y-I.getY(a),zz-I.getZ(a)));}
  const f=rig.eyeFront(c,x,y);if(f!==null){minGap=Math.min(minGap,zz-f);if(zz<f-1e-7)penetrations++;}
 }
 e.s3Medial={maxCorrectionMM:correction*1000,maxAttachmentErrorMM:attachment*1000,nonfiniteVertices:nonfinite,penetrations,minGlobeGapMM:minGap*1000,independentPlugAdded:false,sameIndexedSheet:true,fullyClosedSurfaceChanged:false,boundedToPriorSurfaceMM:.30};rig._fittingEye=null;
}
