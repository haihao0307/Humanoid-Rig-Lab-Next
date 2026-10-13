/* Independently measured support cross-sections of generated geometry.
 * The fixed head origin, not a decorative band bounding box, defines ray origins.
 * These are sampled geometry measurements. A gap is NOT pressure or comfort.
 */
import {sample} from './core.mjs';
const TAU=2*Math.PI;
export function bearingSection(position,index,hp,bandY,{rows=5,depth=.018,angles=96}={}){
 const gaps=new Array(angles).fill(Infinity),coverage=new Array(angles).fill(0);let sampled=0;
 for(let k=0;k<rows;k++){
  const y=bandY+.002+k*depth/(rows-1),hc=sample(hp,y,0).center,segs=[];
  for(let t=0;t<index.length;t+=3){const ids=[index[t]*3,index[t+1]*3,index[t+2]*3],ys=ids.map(i=>position[i+1]);if(y<Math.min(...ys)||y>Math.max(...ys))continue;const hit=[];
   for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],dy=position[b+1]-position[a+1];if(Math.abs(dy)<1e-12)continue;const u=(y-position[a+1])/dy;if(u>=0&&u<1)hit.push([position[a]+u*(position[b]-position[a])-hc[0],position[a+2]+u*(position[b+2]-position[a+2])-hc[1]]);}if(hit.length===2)segs.push(hit);
  }
  for(let j=0;j<angles;j++){const a=j*TAU/angles,dx=Math.cos(a),dz=Math.sin(a),head=sample(hp,y,a);let best=Infinity;
   for(const [p,q]of segs){const ex=q[0]-p[0],ez=q[1]-p[1],d=dx*ez-dz*ex;if(Math.abs(d)<1e-12)continue;const r=(p[0]*ez-p[1]*ex)/d,u=(p[0]*dz-p[1]*dx)/d;if(r>.001&&u>=-1e-8&&u<=1+1e-8)best=Math.min(best,r);}
   if(Number.isFinite(best)&&head.valid){gaps[j]=Math.min(gaps[j],best-head.r);coverage[j]++;sampled++;}
  }
 }
 const good=gaps.filter(Number.isFinite).sort((a,b)=>a-b);
 return {method:'head-centered actual triangle cuts, nearest inner crossing, five heights; free crown excluded',directions:angles,coveredDirections:good.length,raySamples:sampled,minimumMM:good.length?good[0]*1000:null,medianMM:good.length?good[Math.floor(good.length*.5)]*1000:null,p95MM:good.length?good[Math.min(good.length-1,Math.floor(good.length*.95))]*1000:null,coverage,allDirectionsCovered:good.length===angles};
}
export function attachSupportReport(mesh,meta,s,hp,src,out){
 const band=s.wearBandMM/1000,knit=meta.id==='cable'||meta.id==='sherpa',thick=knit?s.materialMM/1000:0;
 const pp=out.sweatband?.position||(thick?Float32Array.from(out.position,(v,i)=>v-out.normal[i]*thick):out.position),ix=out.sweatband?.index||mesh.index;
 const report=bearingSection(pp,ix,hp,out.sweatband?.supportY??band,{depth:meta.id==='sherpa'?.025:.018});
 out.diagnostics.supportSection=report;out.diagnostics.categoryMethodFixed=true;out.diagnostics.startsFromUnfittedSource=true;
 out.diagnostics.hairCompressionImplemented=false;out.diagnostics.donningPathVerified=false;
 if(!Number.isFinite(report.medianMM))throw Error('实际承托区缺少可测截面，拒绝本次适配');
 return out;
}

/* Actual finite material sweatband, not a transparent collision proxy.
 * Its upper edge attaches to a head-centered ray cut of the generated cavity.
 * Only designated tailored/blocked categories receive this added inner part. */
export function cavityRadiusReference(position,index,y,c,a){
 const dx=Math.cos(a),dz=Math.sin(a);let best=Infinity;
 for(let t=0;t<index.length;t+=3){const ids=[index[t]*3,index[t+1]*3,index[t+2]*3],Y=ids.map(i=>position[i+1]);if(y<Math.min(...Y)||y>Math.max(...Y))continue;const hit=[];
  for(let j=0;j<3;j++){const u=ids[j],v=ids[(j+1)%3],dy=position[v+1]-position[u+1];if(Math.abs(dy)<1e-12)continue;const w=(y-position[u+1])/dy;if(w>=0&&w<1)hit.push([position[u]+w*(position[v]-position[u])-c[0],position[u+2]+w*(position[v+2]-position[u+2])-c[1]]);}if(hit.length!==2)continue;
  const [p,q]=hit,ex=q[0]-p[0],ez=q[1]-p[1],den=dx*ez-dz*ex;if(Math.abs(den)<1e-12)continue;const r=(p[0]*ez-p[1]*ex)/den,w=(p[0]*dz-p[1]*dx)/den;if(r>0&&w>=0&&w<=1)best=Math.min(best,r);
 }
 return best;
}

export {cavityRadius,invalidateCavity} from './cavity.mjs';
