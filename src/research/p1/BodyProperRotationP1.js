/* Source-order proper rotation for the binding-reference research. The
 * normalization and final products retain their original Float64 grouping. */
(()=>{'use strict';
function properRotation(input){
 let scale=0;for(const value of input)scale=Math.max(scale,Math.abs(value));
 if(scale===0)return new Float64Array([1,0,0,0,1,0,0,0,1]);
 if(!Number.isFinite(scale))throw Error('Nonfinite support covariance');
 const[a,b,c,d,e,f,g,h,i]=Array.from(input,value=>value/scale),k=new Float64Array([a-e-i,b+d,c+g,h-f,b+d,e-a-i,f+h,c-g,c+g,f+h,i-a-e,d-b,h-f,c-g,d-b,a+e+i]),v=Float64Array.from(BodyMathR01.I());
 for(let step=0;step<80;step++){
  let p=0,q=1,largest=0;for(let r=0;r<4;r++)for(let col=r+1;col<4;col++){const n=Math.abs(k[r*4+col]);if(n>largest){largest=n;p=r;q=col;}}
  if(largest<2e-15)break;
  const pp=p*4+p,qq=q*4+q,pq=p*4+q,off=k[pq],tau=(k[qq]-k[pp])/(2*off),t=(tau>=0?1:-1)/(Math.abs(tau)+Math.hypot(1,tau)),co=1/Math.hypot(1,t),si=t*co;
  k[pp]-=t*off;k[qq]+=t*off;k[pq]=k[q*4+p]=0;
  for(let r=0;r<4;r++){if(r!==p&&r!==q){const x=k[r*4+p],y=k[r*4+q];k[r*4+p]=k[p*4+r]=co*x-si*y;k[r*4+q]=k[q*4+r]=si*x+co*y;}const x=v[r*4+p],y=v[r*4+q];v[r*4+p]=co*x-si*y;v[r*4+q]=si*x+co*y;}
 }
 let best=3;for(let r=0;r<3;r++)if(k[r*4+r]>k[best*4+best])best=r;
 let x=v[best],y=v[4+best],z=v[8+best],w=v[12+best];const length=Math.hypot(x,y,z,w);x/=length;y/=length;z/=length;w/=length;
 return new Float64Array([1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]);
}
globalThis.BodyProperRotationP1=properRotation;
})();
