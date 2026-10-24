/* Source Hermite interpolation research. No triangles, surface smoothing,
 * anatomy guesses or character buffers. Points/normals retain source provenance.
 * Source shading-normal interpolation is not a proof of original PL curvature.
 */
(()=>{'use strict';
function create(data){
 const p=data.positions,n=data.normals,c=data.coefficients,h=data.report.radius,grid=new Map(),N=p.length/3,sqrt20=Math.sqrt(20),key=(x,y,z)=>x+','+y+','+z;
 for(let i=0;i<N;i++){const k=key(Math.floor(p[i*3]/h),Math.floor(p[i*3+1]/h),Math.floor(p[i*3+2]/h));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);}
 function near(q){const cell=q.map(v=>Math.floor(v/h)),ids=[];for(let z=-1;z<=1;z++)for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const list=grid.get(key(cell[0]+x,cell[1]+y,cell[2]+z));if(list)ids.push(...list);}return ids;}
 function evaluate(q,derivative=false){let F=0,W=0,gx=0,gy=0,gz=0,wx=0,wy=0,wz=0;
  for(const i of near(q)){
   const k=i*3,j=i*4,dx=(q[0]-p[k])/h,dy=(q[1]-p[k+1])/h,dz=(q[2]-p[k+2])/h,r=Math.hypot(dx,dy,dz);if(r>=1)continue;
   const t=1-r,t2=t*t,t3=t2*t,phi=t3*t*(4*r+1),plane=h*(n[k]*dx+n[k+1]*dy+n[k+2]*dz)+c[j],beta=c[j+1]*dx+c[j+2]*dy+c[j+3]*dz;
   F+=phi*plane+sqrt20*t3*beta;W+=phi;
   if(derivative){const w=-20/h*t3,b=r>1e-20?-3*t2*beta/r:0;wx+=w*dx;wy+=w*dy;wz+=w*dz;gx+=phi*n[k]+w*dx*plane+sqrt20/h*(t3*c[j+1]+b*dx);gy+=phi*n[k+1]+w*dy*plane+sqrt20/h*(t3*c[j+2]+b*dy);gz+=phi*n[k+2]+w*dz*plane+sqrt20/h*(t3*c[j+3]+b*dz);}
  }
  if(W<1e-20)return{value:.035,gradient:[0,0,0],mass:W};const value=F/W;return{value,gradient:derivative?[(gx-value*wx)/W,(gy-value*wy)/W,(gz-value*wz)/W]:null,mass:W};
 }
 return{evaluate,value:q=>evaluate(q).value,gradient:q=>evaluate(q,true).gradient,near,data,sourceFidelityAccepted:false};
}
globalThis.BodyHermiteR21={create};
})();
