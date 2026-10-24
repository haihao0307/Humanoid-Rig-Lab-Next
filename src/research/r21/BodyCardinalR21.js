/* Source-cardinal Hermite candidate. All observed positions and shading
 * directions are interpolation constraints; none are smoothed or discarded.
 * Between-observation shape, boundaries, layers and first hits need review.
 */
(()=>{'use strict';
function create(data){
 const p=data.positions,n=data.normals,h=data.radius||.05,N=p.length/3,grid=new Map(),key=(x,y,z)=>x+','+y+','+z;
 for(let i=0;i<N;i++){const k=key(Math.floor(p[i*3]/h),Math.floor(p[i*3+1]/h),Math.floor(p[i*3+2]/h));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);}
 function near(q){const a=q.map(v=>Math.floor(v/h)),out=[];for(let z=-1;z<=1;z++)for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const list=grid.get(key(a[0]+x,a[1]+y,a[2]+z));if(list)out.push(...list);}return out;}
 function evaluate(q,derivative=false){const ids=near(q),rows=[];let minimum=Infinity,F=0,W=0;
  for(const i of ids){const k=i*3,dx=q[0]-p[k],dy=q[1]-p[k+1],dz=q[2]-p[k+2],d2=dx*dx+dy*dy+dz*dz;if(d2===0)return{value:0,gradient:[n[k],n[k+1],n[k+2]],sourceNormal:[n[k],n[k+1],n[k+2]],mass:1,exactObservation:true};if(d2>=h*h)continue;minimum=Math.min(minimum,d2);rows.push({i,dx,dy,dz,d2});}
  for(const r of rows){const s=Math.sqrt(r.d2)/h,t=1-s,w=(minimum/r.d2)**2*t**4*(4*s+1),k=r.i*3,plane=n[k]*r.dx+n[k+1]*r.dy+n[k+2]*r.dz;r.w=w;r.s=s;r.t=t;r.plane=plane;F+=w*plane;W+=w;}
  if(!(W>0))return{value:.035,gradient:[0,0,0],sourceNormal:[0,0,0],mass:0};const value=F/W;let gradient=null,sourceNormal=null;
  if(derivative){gradient=[0,0,0];sourceNormal=[0,0,0];for(const r of rows){const k=r.i*3,log=-4/r.d2-20/(h*h*r.t*(4*r.s+1)),d=[r.dx,r.dy,r.dz];for(let j=0;j<3;j++){gradient[j]+=r.w*(n[k+j]+(r.plane-value)*log*d[j])/W;sourceNormal[j]+=r.w*n[k+j]/W;}}}
  return{value,gradient,sourceNormal,mass:W};
 }
 return{evaluate,value:q=>evaluate(q).value,gradient:q=>evaluate(q,true).gradient,near,data,sourceFidelityAccepted:false};
}
globalThis.BodyCardinalR21={create};
})();
