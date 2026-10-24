/* Conservative sign ranges for the existing trilinear scalar functions.
 * No surface is changed: the local compositions are convex combinations.
 * A cell whose complete range excludes zero cannot contain a ray root.
 */
(()=>{'use strict';
function create(main,locals,spacing=.028){
 const bounds=main.bounds,dimensions=bounds.map(b=>Math.max(1,Math.ceil((b[1]-b[0])/spacing))),ranges=new Float32Array(dimensions.reduce((a,b)=>a*b,1)*2);
 for(let i=0;i<ranges.length;i+=2){ranges[i]=Infinity;ranges[i+1]=-Infinity;}
 for(const region of[main,...locals]){
  const g=region.dimensions,size=region.bounds.map(b=>b[1]-b[0]);
  for(let z=0;z<dimensions[2];z++)for(let y=0;y<dimensions[1];y++)for(let x=0;x<dimensions[0];x++){
   const cell=[x,y,z],box=bounds.map((b,k)=>[b[0]+cell[k]*(b[1]-b[0])/dimensions[k],b[0]+(cell[k]+1)*(b[1]-b[0])/dimensions[k]]);
   if(region!==main&&box.some((b,k)=>b[1]<region.bounds[k][0]||b[0]>region.bounds[k][1]))continue;
   const indices=box.map((b,k)=>[Math.max(0,Math.min(g[k]-1,Math.floor((b[0]-region.bounds[k][0])/size[k]*g[k]-.5))),Math.max(0,Math.min(g[k]-1,Math.floor((b[1]-region.bounds[k][0])/size[k]*g[k]-.5)+1))]);
   let lo=Infinity,hi=-Infinity;
   for(let iz=indices[2][0];iz<=indices[2][1];iz++)for(let iy=indices[1][0];iy<=indices[1][1];iy++)for(let ix=indices[0][0];ix<=indices[0][1];ix++){const v=region.field[(ix+g[0]*(iy+g[1]*iz))*4];lo=Math.min(lo,v);hi=Math.max(hi,v);}
   const at=(x+dimensions[0]*(y+dimensions[1]*z))*2;ranges[at]=Math.min(ranges[at],lo);ranges[at+1]=Math.max(ranges[at+1],hi);
  }
 }
 const active=new Uint8Array(ranges.length/2);let count=0;for(let i=0;i<active.length;i++){if(ranges[i*2]<=0&&ranges[i*2+1]>=0){active[i]=1;count++;}}
 return{bounds,dimensions,active,activeCells:count,cells:active.length,bytes:active.byteLength,conservativeFor:'unmodified scalar and convex local composition; no normal-based or distance-to-surface assumption'};
}
globalThis.BodyFieldIntervalsR21={create};
})();
