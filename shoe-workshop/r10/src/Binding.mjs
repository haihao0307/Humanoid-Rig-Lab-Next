import * as T from 'three';
import {add,sub,mul,unit,cross,dot,dist,mix,resample,inward} from '../../r07/src/geometry.mjs';
import {inside} from '../../r03b/src/surface.mjs';
import {MeshRay} from '../../r07/src/ray.mjs';
/** Closed ribbon solids wrap the real cut wall and return on the lining.
 * Source charts remain authoritative. No centroid-derived strip direction,
 * screen-space outline, closed eyelet bore or unsupported bridging segment. */
function split(loop,flags){if(flags.every(Boolean))return [{points:loop,closed:true}];const start=flags.findIndex(v=>!v),out=[];let run=[];for(let j=1;j<=loop.length;j++){const i=(start+j)%loop.length;if(flags[i])run.push(loop[i]);else if(run.length){if(run.length>3)out.push({points:run,closed:false});run=[];}}return out;}
function sealSurface(P,uv,nr,closed){const n=P.length/3/nr,I=[];for(let a=0;a<(closed?n:n-1);a++)for(let j=0;j<nr;j++){const b=(a+1)%n,k=(j+1)%nr;I.push(a*nr+j,b*nr+j,a*nr+k,a*nr+k,b*nr+j,b*nr+k);}if(!closed)for(let j=1;j<nr-1;j++){I.push(0,j,j+1);I.push((n-1)*nr,(n-1)*nr+j+1,(n-1)*nr+j);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(I);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;}
export function createBindings(model,state,parts){
 const rays=parts.filter(p=>![19,29].includes(p.id)).map(p=>({id:p.id,ray:new MeshRay({positions:Array.from(p.geometry.attributes.position.array),indices:Array.from(p.geometry.index.array).slice(0,p.geometry.groups[0].count)})}));const result=[],report=[];
 for(const id of [22,23,24,25,27,28,21,20]){const D=model.domains[id],L=resample(D.loop,q=>D.at(q).p,.8,true),inner=inward(L,q=>D.at(q).p,2.6);const rows=L.map((q,i)=>{const h=model.sample(id,q,state),near=model.fields[id].sample(h.outer).distance,width=near<3.0?1.25:2.6;let qi=mix(q,inner[i],width/2.6);if(!inside(qi,D.loop)||D.sourceHoles.some(H=>inside(qi,H)))qi=mix(q,qi,.35);const b=model.sample(id,qi,state),side=unit(sub(b.outer,h.outer)),projected=unit(sub(side,mul(h.n,dot(side,h.n)))),origin=add(h.outer,mul(h.n,1.3));const blocked=rays.some(r=>r.id!==id&&(()=>{const x=r.ray.ray(origin,mul(h.n,-1));return x&&x.distance<1.23;})());const low=h.outer[1]<model.craftLipAt(h.outer)+3;return {q,h,b,side:projected,width,visible:!blocked&&!low};});
  // Only fill isolated sub-millimetre visibility speckles on the same high edge.
  let flags=rows.map(r=>r.visible);for(let i=0;i<L.length;i++)if(!flags[i]&&flags[(i+L.length-1)%L.length]&&flags[(i+1)%L.length]&&rows[i].h.outer[1]>model.craftLipAt(rows[i].h.outer)+4)flags[i]=true;const byQ=new Map(rows.map(r=>[r.q,r]));
  for(const [runIndex,run]of split(L,flags).entries()){const A=run.points.map(q=>byQ.get(q));let length=0;for(let j=1;j<A.length;j++)length+=dist(A[j-1].h.outer,A[j].h.outer);if(length<9)continue;const P=[],uv=[];let arc=0,nr=0;
   for(let i=0;i<A.length;i++){const {h,b,side}=A[i];if(i)arc+=dist(A[i-1].h.outer,h.outer);const center=mix(h.outer,h.inner,.5),n=unit(sub(h.outer,h.inner)),r=dist(h.outer,h.inner)/2,section=[];
    section.push(add(b.outer,mul(n,.07)),add(b.outer,mul(n,.29)));for(let j=0;j<=8;j++){const a=j*Math.PI/8;section.push(add(center,add(mul(n,Math.cos(a)*(r+.29)),mul(side,-Math.sin(a)*.40))));}section.push(add(b.inner,mul(n,-.29)),add(b.inner,mul(n,-.07)));for(let j=8;j>=0;j--){const a=j*Math.PI/8;section.push(add(center,add(mul(n,Math.cos(a)*(r+.07)),mul(side,-Math.sin(a)*.08))));}nr=section.length;let across=0;for(let j=0;j<nr;j++){if(j)across+=dist(section[j-1],section[j]);P.push(...section[j]);uv.push(arc/8,across/8);}}
   const g=sealSurface(P,uv,nr,run.closed),tag=`binding-${id}-${runIndex}`,record={id:tag,partId:id,stations:A.length,lengthMm:length,minWidthMm:Math.min(...A.map(x=>x.width)),maxWidthMm:Math.max(...A.map(x=>x.width)),wrapsCutWall:true,liningReturn:true,closedSolid:true,source:'actual R09 cut boundary and receiving triangle sampler',forceSolved:false};g.userData=record;result.push({id:tag,partId:id,kind:'binding',geometry:g});report.push(record);
  }
 }return {meshes:result,report};
}
