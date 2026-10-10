'use strict';
// R09 research adapter. Does not change R08 or assume that the pattern axis is
// a measured collagen direction. Rotation/fibre parameters still require fitting.
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function unit(v){const l=Math.hypot(...v);if(!(l>1e-14))throw Error('Degenerate material tangent');return v.map(x=>x/l);}
const key=ids=>[...ids].sort((a,b)=>a-b).join(':');
function materialReferenceInverse(rest,ids,axisU,axisV){
 const at=i=>Array.from(rest.slice(3*i,3*i+3));
 const e=sub(at(ids[1]),at(ids[0])),f=sub(at(ids[2]),at(ids[0]));
 const n=unit(cross(e,f));
 const u=unit(axisU.map((x,i)=>x-n[i]*dot(axisU,n)));
 let v=unit(cross(n,u));if(dot(v,axisV)<0)v=v.map(x=>-x);
 const a=dot(e,u),b=dot(f,u),c=dot(e,v),d=dot(f,v),det=a*d-b*c;
 if(Math.abs(det)<1e-16)throw Error('Degenerate reference material map');
 return [d/det,-b/det,-c/det,a/det];
}
function applyMaterialFrames(solver,data){
 const records=new Map((data.frameTriangles||[]).map(r=>[key(r.ids),r]));
 if(records.size===0)throw Error('Explicit material-chart metadata required; no first-edge fallback');
 for(const q of solver.tri){const r=records.get(key(q.ids));if(!r)throw Error('Missing chart for triangle '+q.ids);
  const p=r.ids.map(i=>Array.from(solver.rest.slice(3*i,3*i+3))),e=sub(p[1],p[0]),f=sub(p[2],p[0]);
  const u=e.map((x,i)=>x*r.inv[0]+f[i]*r.inv[2]),v=e.map((x,i)=>x*r.inv[1]+f[i]*r.inv[3]);
  q.D=materialReferenceInverse(solver.rest,q.ids,u,v);
 }
 solver.materialFrameProvenance='Pattern chart tangents fixed in rest material coordinates; fibre angles remain unmeasured';
 return solver;
}
function makeMaterialFrameShell(BaseShell){
 return class MaterialFrameShell extends BaseShell{constructor(data,options={}){super(data,options);applyMaterialFrames(this,data);}};
}
module.exports={materialReferenceInverse,applyMaterialFrames,makeMaterialFrameShell};
