/* Read-only diagnostics on copies of the native fitted surfaces. No solver calls here. */
import {MeshContact} from './mesh-contact.mjs';
export const EPS_M=0.00005; // 0.05 mm numerical reporting margin, not a manufacturing allowance.
const v=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]],sub=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export function segmentTriangle(p,q,t){
 const d=sub(q,p),e1=sub(t[1],t[0]),e2=sub(t[2],t[0]),h=cross(d,e2),det=dot(e1,h);
 if(Math.abs(det)<1e-16)return null;const a=sub(p,t[0]),u=dot(a,h)/det,k=cross(a,e1),b=dot(d,k)/det,s=dot(e2,k)/det;
 if(u<1e-9||b<1e-9||u+b>1-1e-9||s<1e-9||s>1-1e-9)return null;
 return {point:p.map((x,i)=>x+d[i]*s),segmentFraction:s,barycentric:[1-u-b,u,b]};
}
export function triangleCrossing(a,b){for(const [first,second,role]of [[a,b,'source-edge'],[b,a,'target-edge']])for(let i=0;i<3;i++){const r=segmentTriangle(first[i],first[(i+1)%3],second);if(r)return {...r,role,edge:i};}return null;}
export function windingNumber(point,p,faces){let sum=0;for(let f=0;f<faces.length;f+=3){const a=sub(v(p,faces[f]),point),b=sub(v(p,faces[f+1]),point),c=sub(v(p,faces[f+2]),point),la=Math.hypot(...a),lb=Math.hypot(...b),lc=Math.hypot(...c);sum+=2*Math.atan2(dot(a,cross(b,c)),la*lb*lc+dot(a,b)*lc+dot(b,c)*la+dot(c,a)*lb);}return sum/(4*Math.PI);}
export async function stateDigest(w){
 const parts=[],meta={motion:w.motion,motionTime:w.motionTime,elapsed:w.elapsed,frame:w.frameSequence,bodyRevision:w.bodyRevision,clothRevision:w.clothRevision,localRevision:w.__rfFittingRevision,solver:w.solvers.map(s=>({time:s.time,steps:s.steps,rest:s.edges.map(e=>e.rest)}))};
 const add=a=>{if(a&&ArrayBuffer.isView(a))parts.push(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));};
 add(w.actor.positions);add(w.actor.native);for(const m of w.actor.skin)add(m);for(const s of w.solvers){add(s.p);add(s.v);add(s.old);add(s.output);add(s.normals);}for(const m of w.acceleration.models||[])for(const k of ['delta','velocity','refVelocity','previousRef'])add(m[k]);
 const text=new TextEncoder().encode(JSON.stringify(meta)),len=parts.reduce((n,p)=>n+p.byteLength,0)+text.length,b=new Uint8Array(len);let o=0;for(const p of parts){b.set(p,o);o+=p.length;}b.set(text,o);
 return {sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join(''),bytes:len,meta};
}
function topology(s){
 const labels=Array.from({length:s.count},()=>[]),faceLabels=[],incident=Array.from({length:s.count},()=>[]);let off=0;
 for(const p of s.packet.spec.panels){for(let i=0;i<p.uvMm.length;i++){const n=s.map[off+i];labels[n].push({panel:p.id,localVertex:i});}for(let i=0;i<p.triangles.length;i++){const ids=p.triangles[i].map(j=>s.map[off+j]);if(new Set(ids).size<3)continue;const f=faceLabels.length*3;if(ids.some((v,k)=>v!==s.faces[f+k]))throw Error('FACE_LABEL_MAPPING_MISMATCH');faceLabels.push({panel:p.id,localTriangle:i});}off+=p.uvMm.length;}
 for(let f=0;f<s.faces.length;f+=3)for(let j=0;j<3;j++)incident[s.faces[f+j]].push(f);
 return {labels,faceLabels,incident};
}
function tri(p,faces,f){return [0,1,2].map(j=>v(p,faces[f+j]));}
export class ContactProbe {
 constructor(w){this.w=w;this.topologies=w.solvers.map(topology);this.body=new MeshContact(w.actor.positions.slice(),w.body.faces);this.bottom=new MeshContact(w.solvers[1].p.slice(),w.solvers[1].faces);this.previous=[new Set(),new Set(),new Set()];this.initial=null;}
 sampleSurface(s,topo,target,{pair=false,role,index}){
  const data={count:0,eligible:0,negative:0,beyondMargin:0,minimumM:null,witness:null,newSincePrevious:0,newSinceInitial:0},negativeIds=new Set(),q=new Float64Array(4);
  const inspect=(point,key,kind,ids,sourceFace)=>{
   data.count++;const f=target.nearest(...point,pair ? .025 : Infinity);if(f<0)return;
   target.evaluate(f,...point,q);const bary=Array.from(target.tmp.subarray(4,7));if(pair&&bary.some(x=>x<=.001))return;
   data.eligible++;if(q[0]<0)data.negative++;if(q[0]<-EPS_M){data.beyondMargin++;negativeIds.add(key);}
   if(data.minimumM!==null&&q[0]>=data.minimumM)return;
   data.minimumM=q[0];let localFace=sourceFace;if(localFace==null)localFace=topo.incident[ids[0]][0]??null;
   const targetTriangle=tri(target.p,target.faces,f),sourceTriangle=localFace==null?null:tri(s.p,s.faces,localFace);
   data.witness={id:role+':'+key,role,kind,nodeIds:ids,materialSites:ids.map(i=>({node:i,sites:topo.labels[i]})),sourceFaceOffset:localFace,sourceFace:localFace==null?null:topo.faceLabels[localFace/3],targetFaceOffset:f,targetTriangleId:f/3,point,closest:Array.from(target.tmp.subarray(1,4)),barycentric:bary,queryDirection:Array.from(q.subarray(1,4)),orientedDistanceM:q[0],sourceTriangle,targetTriangle,localIntersection:sourceTriangle?triangleCrossing(sourceTriangle,targetTriangle):null};
   if(pair)data.witness.targetFace=this.topologies[1].faceLabels[f/3];
  };
  for(let i=0;i<s.count;i++)inspect(v(s.p,i),'v'+i,'vertex',[i],null);
  if(pair)for(let i=0;i<s.edges.length;i++){const e=s.edges[i];inspect([0,1,2].map(k=>(s.p[e.a*3+k]+s.p[e.b*3+k])/2),'e'+i,'edge-midpoint',[e.a,e.b],topo.incident[e.a].find(f=>[0,1,2].some(k=>s.faces[f+k]===e.b)));}
  for(let f=0;f<s.faces.length;f+=3){const ids=[s.faces[f],s.faces[f+1],s.faces[f+2]];inspect([0,1,2].map(k=>ids.reduce((sum,i)=>sum+s.p[i*3+k],0)/3),'t'+f/3,'triangle-centroid',ids,f);}
  data.newSincePrevious=Array.from(negativeIds).filter(k=>!this.previous[index].has(k)).length;data.newSinceInitial=this.initial?Array.from(negativeIds).filter(k=>!this.initial[index].has(k)).length:0;
  if(!pair&&data.witness){const winding=windingNumber(data.witness.point,target.p,target.faces);data.witness.windingNumber=winding;data.witness.windingInsideSupport=Math.abs(winding)>.5;}
  this.previous[index]=negativeIds;return data;
 }
 async capture(stage,step){
  const w=this.w,before=await stateDigest(w),start=performance.now();this.body.refit(w.actor.positions.slice());this.bottom.refit(w.solvers[1].p.slice());
  const body=w.solvers.map((s,i)=>this.sampleSurface(s,this.topologies[i],this.body,{role:i?'bottom':'top',index:i})),pair=this.sampleSurface(w.solvers[0],this.topologies[0],this.bottom,{pair:true,role:'top-to-bottom',index:2});
  if(!this.initial)this.initial=this.previous.map(s=>new Set(s));
  const after=await stateDigest(w);if(before.sha256!==after.sha256)throw Error('CONTACT_PROBE_MUTATED_STATE');
  return {stage,step,frame:w.frameSequence,simulationSeconds:w.elapsed,motion:w.motion,motionTime:w.motionTime,backend:w.acceleration.backend||'wasm',stateSHA256:after.sha256,stateBytes:after.bytes,body,pair,measurementMS:performance.now()-start,readOnlyVerified:true,semantics:'oriented closest-triangle distance on physics control surfaces; body witness additionally tested with solid-angle winding; open garment pair requires separate local crossing evidence',continuousCollision:false,fullRenderedYarnCollision:false};
 }
}
