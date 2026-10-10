import * as THREE from 'three';
import {smooth} from './BrowMedial.js';
const clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp;
const STATIC=['s3Rest','s3Chart','s3AssetUV','s3DonorUV','s3Region'];
function checksum(a){let h=2166136261;const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);for(const v of b){h^=v;h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function at(P,i){return [P.getX(i),P.getY(i),P.getZ(i)];}
function length(P,a,b){return Math.hypot(P.getX(a)-P.getX(b),P.getY(a)-P.getY(b),P.getZ(a)-P.getZ(b));}
function donorFrame(e){
 const x=e.c.x,y=e.c.y-.017,origin=e.sample(x,y),rx=e.sample(x+.001,y),ry=e.sample(x,y+.001);
 return {origin:[origin.u,origin.v],du:[rx.u-origin.u,rx.v-origin.v],dv:[ry.u-origin.u,ry.v-origin.v],centre:[e.c.x*1000,e.c.y*1000]};
}
function mapDonor(frame,chart){
 const x=chart[0]-frame.centre[0],y=chart[1]-frame.centre[1];
 return [frame.origin[0]+frame.du[0]*x+frame.dv[0]*y,frame.origin[1]+frame.du[1]*x+frame.dv[1]*y];
}
function allocate(mesh,label,frame,cols,rows,regionAt,chartAt){
 const g=mesh.geometry,P=g.attributes.position,uv=g.attributes.uv,n=P.count,rest=P.array.slice(),chart=new Float32Array(n*2),asset=new Float32Array(n*2),donor=new Float32Array(n*2),region=new Float32Array(n*4),strain=new Float32Array(n*4);
 for(let i=0;i<n;i++){
  const p=at(P,i),r=chartAt?chartAt(i,p):[p[0]*1000,p[1]*1000];chart.set(r,i*2);
  asset.set(uv?[uv.getX(i),uv.getY(i)]:frame.origin,i*2);donor.set(mapDonor(frame,r),i*2);region.set(regionAt(i),i*4);strain.set([1,1,0,1],i*4);
 }
 for(const [name,a,size]of[['s3Rest',rest,3],['s3Chart',chart,2],['s3AssetUV',asset,2],['s3DonorUV',donor,2],['s3Region',region,4],['s3Strain',strain,4]])g.setAttribute(name,new THREE.BufferAttribute(a,size));
 const neighbours=new Int32Array(n*4),metric=new Float64Array(n*3),valid=new Uint8Array(n);
 for(let i=0;i<n;i++){
  const row=Math.floor(i/cols),col=i%cols,a=row*cols+Math.max(0,col-1),b=row*cols+Math.min(cols-1,col+1),c=Math.max(0,row-1)*cols+col,d=Math.min(rows-1,row+1)*cols+col;
  neighbours.set([a,b,c,d],i*4);const u=at(P,b).map((x,j)=>x-at(P,a)[j]),v=at(P,d).map((x,j)=>x-at(P,c)[j]);
  const A=u.reduce((s,x)=>s+x*x,0),B=u.reduce((s,x,j)=>s+x*v[j],0),C=v.reduce((s,x)=>s+x*x,0);metric.set([A,B,C],i*3);valid[i]=A*C-B*B>1e-23?1:0;
 }
 const item={mesh,label,cols,rows,frame,neighbours,metric,valid,staticHash:null};g.userData.s3Binding=item;return item;
}
function copyAttributes(dst,k,src,j,names=STATIC.filter(n=>n!=='s3Rest')){
 for(const name of names){const a=dst.attributes[name],b=src.attributes[name];for(let c=0;c<a.itemSize;c++)a.array[k*a.itemSize+c]=b.array[j*b.itemSize+c];a.needsUpdate=true;}
}
function setChart(g,i,r,frame){g.attributes.s3Chart.setXY(i,...r);g.attributes.s3DonorUV.setXY(i,...mapDonor(frame,r));}
export function bindTissueCoordinates(rig){
 rig.chartBindings=[];
 const head=rig.mesh.geometry,P=head.attributes.position;
 // Existing facial atlas is retained outside the reconstructed eye region.
 const h=allocate(rig.mesh,'head',donorFrame(rig.eyes[0]),P.count,1,()=>[0,0,0,0]);rig.chartBindings.push(h);
 for(const e of rig.eyes){
  const {lid}=e,F=donorFrame(e),S=lid.A+1,G=lid.mesh.geometry,P=G.attributes.position,charts=new Float32Array(P.count*2);
  // Develop each meridian by its neutral 3D arc length. Blend the outer collar
  // into the unchanged head chart. This is not the old closed crease UV.
  for(let a=0;a<=lid.A;a++){
   const p0=at(P,a),end=at(P,lid.R*S+a),dx=end[0]-p0[0],dy=end[1]-p0[1],len=Math.hypot(dx,dy)||1;let distance=0;
   for(let j=0;j<=lid.R;j++){
    const k=j*S+a;if(j)distance+=length(P,k,k-S)*1000;const fade=smooth((j/lid.R-.60)/.40);
    charts[k*2]=mix(p0[0]*1000+dx/len*distance,P.getX(k)*1000,fade);charts[k*2+1]=mix(p0[1]*1000+dy/len*distance,P.getY(k)*1000,fade);
   }
  }
  const outer=allocate(lid.mesh,e.c.name+'/outer',F,S,lid.R+1,i=>{const q=lid.entries[i];return [1-smooth((q.t-.20)/.58),0,(q.ny>=0?1:0)*(1-smooth(q.t/.65)),0];},i=>[charts[i*2],charts[i*2+1]]);
  const edge=allocate(lid.edge,e.c.name+'/margin',F,lid.es+1,S,i=>[1,1-(i%(lid.es+1))/lid.es,0,1]);
  const inside=allocate(lid.inside,e.c.name+'/mucosa',F,S,lid.ni+1,()=>[1,1,0,1]);
  const E=lid.edge.geometry,I=lid.inside.geometry;
  for(let a=0;a<=lid.A;a++){
   const upper=Math.sin(a/lid.A*Math.PI*2)>=0,rr=[G.attributes.s3Chart.getX(a),G.attributes.s3Chart.getY(a)];let arc=0;
   for(let j=lid.es;j>=0;j--){
    const k=a*(lid.es+1)+j;if(j<lid.es)arc+=length(E.attributes.position,k,k+1)*1000;
    copyAttributes(E,k,G,a);setChart(E,k,[rr[0],rr[1]+(upper?-arc:arc)],F);E.attributes.s3Region.setY(k,1-j/lid.es);E.attributes.s3Region.setW(k,1);
   }
   copyAttributes(I,a,E,a*(lid.es+1));
   const base=[I.attributes.s3Chart.getX(a),I.attributes.s3Chart.getY(a)];arc=0;
   for(let j=1;j<=lid.ni;j++){const k=j*S+a;arc+=length(I.attributes.position,k,k-S)*1000;setChart(I,k,[base[0],base[1]+(upper?-arc:arc)],F);I.attributes.s3AssetUV.setXY(k,E.attributes.s3AssetUV.getX(a*(lid.es+1)),E.attributes.s3AssetUV.getY(a*(lid.es+1)));}
  }
  rig.chartBindings.push(outer,edge,inside);
  for(const kind of ['medial','lateral']){
   const part=e.section[kind],g=part.mesh.geometry,item=allocate(part.mesh,e.c.name+'/'+kind,F,part.V+1,part.U+1,()=>[1,1,0,kind==='medial'?2:3]);
   for(let i=0;i<=part.U;i++){
    const from=kind==='medial'?i:lid.A/2-i,top=e.c.sign<0?from:lid.A/2-from,bottom=lid.A-top;
    for(let j=0;j<=part.V;j++){
     const v=j/part.V,k=i*(part.V+1)+j;
     for(const name of ['s3AssetUV','s3DonorUV','s3Chart','s3Region']){const dst=g.attributes[name],src=I.attributes[name];for(let c=0;c<dst.itemSize;c++)dst.array[k*dst.itemSize+c]=mix(src.array[top*dst.itemSize+c],src.array[bottom*dst.itemSize+c],v);}
     if(j>0&&j<part.V)g.attributes.s3Region.setW(k,kind==='medial'?2:3);
    }
   }rig.chartBindings.push(item);
  }
 }
 for(const b of rig.chartBindings)b.staticHash=Object.fromEntries(STATIC.map(n=>[n,checksum(b.mesh.geometry.attributes[n].array)]));
 updateTissueStrain(rig);
}
export function updateTissueStrain(rig){
 if(!rig.chartBindings)return;
 for(const b of rig.chartBindings){
  if(b.label==='head')continue;const P=b.mesh.geometry.attributes.position,T=b.mesh.geometry.attributes.s3Strain;let valid=0,degenerate=0,min=Infinity,max=0;const samples=[];
  for(let i=0;i<P.count;i++){
   if(!b.valid[i]){degenerate++;T.setXYZW(i,1,1,0,1);continue;}
   const [a,d,c,f]=b.neighbours.subarray(i*4,i*4+4),ux=P.getX(d)-P.getX(a),uy=P.getY(d)-P.getY(a),uz=P.getZ(d)-P.getZ(a),vx=P.getX(f)-P.getX(c),vy=P.getY(f)-P.getY(c),vz=P.getZ(f)-P.getZ(c);
   const A=ux*ux+uy*uy+uz*uz,B=ux*vx+uy*vy+uz*vz,C=vx*vx+vy*vy+vz*vz,[a0,b0,c0]=b.metric.subarray(i*3,i*3+3),det0=a0*c0-b0*b0;
   const tr=(c0*A+a0*C-2*b0*B)/det0,det=Math.max(0,(A*C-B*B)/det0),disc=Math.sqrt(Math.max(0,tr*tr-4*det));
   const small=Math.sqrt(Math.max(0,(tr-disc)/2)),large=Math.sqrt(Math.max(0,(tr+disc)/2)),theta=.5*Math.atan2(2*(B-b0),A-a0-C+c0);
   T.setXYZW(i,small,large,theta,Math.sqrt(det));valid++;min=Math.min(min,small);max=Math.max(max,large);samples.push(large);
  }
  samples.sort((a,b)=>a-b);b.strainReport={samples:valid,degenerateReferenceSamples:degenerate,minStretch:Number.isFinite(min)?min:null,maxStretch:max,p95MaxStretch:samples[Math.floor(samples.length*.95)]??null};T.needsUpdate=true;
 }
}
export function tissueReport(rig){
 const entries=(rig.chartBindings||[]).map(b=>({name:b.label,vertices:b.mesh.geometry.attributes.position.count,immutableRestAttributes:STATIC.every(n=>checksum(b.mesh.geometry.attributes[n].array)===b.staticHash[n]),finiteAttributes:STATIC.every(n=>Array.from(b.mesh.geometry.attributes[n].array).every(Number.isFinite)),strain:b.strainReport||null}));
 let seam=0;
 for(const e of rig.eyes)for(let a=0;a<=e.lid.A;a++)for(const [g,k,h,j]of[[e.lid.mesh.geometry,a,e.lid.edge.geometry,a*(e.lid.es+1)+e.lid.es],[e.lid.inside.geometry,a,e.lid.edge.geometry,a*(e.lid.es+1)]]){
  for(const n of ['s3Chart','s3AssetUV','s3DonorUV']){const x=g.attributes[n],y=h.attributes[n];for(let c=0;c<x.itemSize;c++)seam=Math.max(seam,Math.abs(x.array[k*x.itemSize+c]-y.array[j*y.itemSize+c]));}
 }
 return {schema:'kaopu/neutral-tissue-chart@1',units:'millimetres for developed chart; unitless strain',reference:'neutral open ET10 geometric rest surface, captured once',newClosedScanUVUsedForMobileSkin:false,restAttributesNeverReprojectedDuringAnimation:true,sharedCoordinateAndMaskForColorNormalRoughness:true,materialBoundaryMaxError:seam,entries,poreDensityConservationClaim:false,limitation:'A fixed material chart cannot erase stretch in a non-isometric geometric animation. Strain is exposed, not hidden by sliding UVs; dynamic folding remains stage four.'};
}
