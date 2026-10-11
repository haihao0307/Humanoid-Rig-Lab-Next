/* A measured OPENING is fitted; the complete crown is not projected onto scalp.
 * Positive radial scaling is shared across material folds, retaining their order.
 * Real inner faces are generated after this source-shape deformation. */
import {normals,sample,measurements} from '../core.mjs';
import {sourceFitProfile as sourceDatum} from './datum.mjs';
const TAU=2*Math.PI,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export function fitBeanie(mesh,meta,s,hp){
 const d=sourceDatum(mesh,meta),band=s.wearBandMM/1000,ref=measurements(hp,band),thickness=s.materialMM/1000,gap=(s.clearanceMM+s.hairMM)/1000,c=sample(hp,band,0).center;
 const edges=new Map();for(let i=0;i<mesh.index.length;i+=3)for(let j=0;j<3;j++){const x=mesh.index[i+j],y=mesh.index[i+(j+1)%3],a=mesh.groups[x],b=mesh.groups[y],key=a<b?a+':'+b:b+':'+a,old=edges.get(key);if(old)old.count++;else edges.set(key,{x,y,count:1});}
 const ids=[...new Set([...edges.values()].filter(e=>e.count===1).flatMap(e=>[e.x,e.y]))];
 if(ids.length<32)throw Error('针织母体缺少可核验的完整帽口，拒绝替代为头皮壳');
 let cx=0,cz=0;for(const i of ids){cx+=d.q[i*3]/ids.length;cz+=d.q[i*3+2]/ids.length;}
 const raw=ids.map(i=>{const dx=d.q[i*3]-cx,dz=d.q[i*3+2]-cz;return {a:(Math.atan2(dz,dx)+TAU)%TAU,r:Math.hypot(dx,dz)};}).sort((a,b)=>a.a-b.a);
 const radius=a=>{a=(a+TAU)%TAU;let i=raw.findIndex(p=>p.a>a);if(i<0)i=0;const p=raw[(i+raw.length-1)%raw.length],q=raw[i],delta=(q.a-p.a+TAU)%TAU||1,t=((a-p.a+TAU)%TAU)/delta;return p.r+(q.r-p.r)*t;};
 const sy=(hp.ymax-band+thickness+.018+Math.max(0,s.crownMM)/1000)/d.top,pitch=s.wearPitchDeg*Math.PI/180,co=Math.cos(pitch),si=Math.sin(pitch);
 const out=new Float32Array(mesh.position.length),colors=new Float32Array(out.length);let minRatio=Infinity,maxRatio=0,minGap=Infinity,count=0;
 for(let i=0;i<out.length;i+=3){const dx=d.q[i]-cx,dz=d.q[i+2]-cz,a=Math.atan2(dz,dx),h=sample(hp,band,a),rr=radius(a),ratio=(h.r+thickness+gap+.0015)/rr,t=clamp(d.q[i+1]/d.top),bulge=1+(s.crownFullness-1)*smooth(t);minRatio=Math.min(minRatio,ratio);maxRatio=Math.max(maxRatio,ratio);
  const x=dx*ratio*bulge+c[0],y=d.q[i+1]*sy,z=dz*ratio*bulge+(.020-s.backLeanMM/1000)*smooth(t);
  out[i]=x;out[i+1]=band+co*y-si*z;out[i+2]=c[1]+si*y+co*z;colors.set(d.q[i+1]<.035?[.12,.68,.64]:[.8,.53,.27],i);
  if(out[i+1]>=hp.ymin&&out[i+1]<hp.ymax-.0005){const hc=sample(hp,out[i+1],0).center,aa=Math.atan2(out[i+2]-hc[1],x-hc[0]),hh=sample(hp,out[i+1],aa);if(hh.valid){minGap=Math.min(minGap,Math.hypot(x-hc[0],out[i+2]-hc[1])-hh.r);count++;}}
 }
 return {position:out,normal:normals(mesh,out),colors,measurement:ref,diagnostics:{mode:'opening-guided-preserved-crown',sourceOpeningFrame:d.frame,actualOpeningBoundaryNodes:ids.length,sourceRestFoldRetained:true,positiveRadialScaleRange:[minRatio,maxRatio],verticalScale:sy,materialThicknessMM:s.materialMM,freeCrownAllowanceMM:18+s.crownMM,pointwiseScalpClamp:false,highResolutionScalpProjection:false,sampledVertices:count,minimumRadialClearanceMM:count?minGap*1000:null,bandMedianMM:null,bandSampleBins:0,restCircumferenceMM:ref.headCircumferenceMM*(1-s.negativeEase),requiredCircumferentialStretch:1/(1-s.negativeEase)-1,scope:'static opening-guided geometric fitting with retained source folds and free crown; nominal thickness and fitted clearance tested separately, not textile pressure or continuous collision',physicalValidated:false}};
}
