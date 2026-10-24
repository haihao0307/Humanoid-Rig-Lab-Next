/* Exact interpolation at original observations, not full original acceptance.
 * Source normals remain a separate shading field. No smoothing regularizer.
 */
(()=>{'use strict';
function create(data){
 const p=data.positions,n=data.normals,c=data.offsets,h=data.report.radius,N=p.length/3,grid=new Map(),key=(x,y,z)=>x+','+y+','+z;
 for(let i=0;i<N;i++){const k=key(Math.floor(p[i*3]/h),Math.floor(p[i*3+1]/h),Math.floor(p[i*3+2]/h));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);}
 function near(q){const a=q.map(v=>Math.floor(v/h)),out=[];for(let z=-1;z<=1;z++)for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const list=grid.get(key(a[0]+x,a[1]+y,a[2]+z));if(list)out.push(...list);}return out;}
 function evaluate(q,derivative=false){let F=0,W=0,gx=0,gy=0,gz=0,wx=0,wy=0,wz=0;
  for(const i of near(q)){const k=i*3,dx=q[0]-p[k],dy=q[1]-p[k+1],dz=q[2]-p[k+2],r=Math.hypot(dx,dy,dz)/h;if(r>=1)continue;const t=1-r,phi=t*t*t*t*(4*r+1),plane=n[k]*dx+n[k+1]*dy+n[k+2]*dz+c[i];F+=phi*plane;W+=phi;if(derivative){const d=-20/(h*h)*t*t*t;wx+=d*dx;wy+=d*dy;wz+=d*dz;gx+=phi*n[k]+d*dx*plane;gy+=phi*n[k+1]+d*dy*plane;gz+=phi*n[k+2]+d*dz*plane;}}
  if(!(W>1e-20))return{value:.035,gradient:[0,0,0],mass:0};const value=F/W;return{value,gradient:derivative?[(gx-value*wx)/W,(gy-value*wy)/W,(gz-value*wz)/W]:null,mass:W};
 }
 return{evaluate,value:q=>evaluate(q).value,gradient:q=>evaluate(q,true).gradient,near,data,sourceFidelityAccepted:false};
}
globalThis.BodySourcePositionsR21={create};
})();
