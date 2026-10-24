'use strict';
// Independent CPU evaluation of the same cached function; not original fidelity.
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(t*(t*6-15)+10);};
module.exports=function(field){
 function sample(r,p){const g=r.dimensions,q=p.map((x,k)=>(x-r.bounds[k][0])/(r.bounds[k][1]-r.bounds[k][0])*g[k]-.5),lo=q.map(Math.floor),f=q.map((x,k)=>x-lo[k]);let value=0;
 for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){const a=Math.max(0,Math.min(g[0]-1,lo[0]+x)),b=Math.max(0,Math.min(g[1]-1,lo[1]+y)),c=Math.max(0,Math.min(g[2]-1,lo[2]+z));value+=r.field[(a+g[0]*(b+g[1]*c))*4]*(x?f[0]:1-f[0])*(y?f[1]:1-f[1])*(z?f[2]:1-f[2]);}
 const outside=Math.hypot(...p.map((x,k)=>Math.max(r.bounds[k][0]-x,x-r.bounds[k][1],0)));return outside>0?Math.max(value,outside):value;
 }
 function value(p){let v=sample(field,p);for(let i=0;i<field.locals.length;i++){const local=field.locals[i],depth=Math.min(...p.flatMap((x,k)=>[x-local.bounds[k][0],local.bounds[k][1]-x]));if(depth<=0)continue;const origin=field.refinement.origins[i],axis=field.refinement.axes[i],distance=p.reduce((s,x,k)=>s+(x-origin[k])*axis[k],0),range=field.refinement.ranges[i],t=Math.max(0,Math.min(1,depth/.008)),w=t*t*(3-2*t)*smooth(range[0],range[1],distance);v=v*(1-w)+sample(local,p)*w;}return v;}
 function gradient(p,e=.0001){return[0,1,2].map(k=>{const a=p.slice(),b=p.slice();a[k]+=e;b[k]-=e;return(value(a)-value(b))/(2*e);});}
 function project(p){let q=p.slice(),residual=value(q),iterations=0;for(;iterations<16&&Math.abs(residual)>1e-7;iterations++){const g=gradient(q),gg=g.reduce((s,x)=>s+x*x,0);if(!(gg>1e-12))break;const amount=Math.max(-.02,Math.min(.02,residual/gg));q=q.map((x,k)=>x-amount*g[k]);residual=value(q);}return{p:q,residual,iterations,converged:Math.abs(residual)<=1e-7};}
 return{value,gradient,project};
};
