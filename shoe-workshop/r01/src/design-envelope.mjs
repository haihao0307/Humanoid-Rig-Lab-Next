import * as T from 'three';
const PI=Math.PI,TAU=PI*2,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=T.MathUtils.clamp,lerp=T.MathUtils.lerp;
/** Authored static design envelope; constrained at native foot samples, not a contact solver. */
export function shoeLast(foot,style,fit={}){
 const toe=clamp((fit.toe??12)/1000,.005,.025),ease=clamp((fit.ease??3.8)/1000,.001,.009),instep=clamp((fit.instep??3)/1000,.001,.012);
 const L=foot.length+toe+.008,scale=foot.length/.261,bottom=style.sole*scale;
 const pts=foot.samples.filter(p=>p[1]<.112*scale).map(p=>[p[0],p[2]+.004+toe*clamp((p[2]/foot.length-.64)/.36,0,1)]);
 function hull(a){a=a.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const lo=[],hi=[];for(const p of a){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}for(const p of a.reverse()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p);}return lo.slice(0,-1).concat(hi.slice(0,-1));}
 const poly=hull(pts),ankleZ=foot.ankleLocal[2]+.004,cx=foot.sign*.005*scale,cz=ankleZ+(style.boot?0:.014*scale);
 const N=360,rx=(style.boot?.041:.038)*scale+ease*.4,rz=(style.boot?.052:.066)*scale;
 let openScale=1;
 for(const p of foot.samples)if(p[1]>((style.boot?.074:style.collar)+.008)*scale){const q=Math.hypot((p[0]-cx)/rx,(p[2]+.004-cz)/rz);openScale=Math.max(openScale,q*1.045);}
 const openingW=rx*openScale,openingZ=rz*openScale,cross=(a,b)=>a[0]*b[1]-a[1]*b[0],radial=[];
 for(let i=0;i<N;i++){const t=i/N*TAU,d=[Math.sin(t),Math.cos(t)];let distance=Infinity;for(let j=0;j<poly.length;j++){const p=poly[j],q=poly[(j+1)%poly.length],a=[p[0]-cx,p[1]-cz],e=[q[0]-p[0],q[1]-p[1]],den=cross(d,e);if(Math.abs(den)<1e-10)continue;const r=cross(a,e)/den,u=cross(a,d)/den;if(r>0&&u>=0&&u<=1)distance=Math.min(distance,r);}if(!Number.isFinite(distance))throw Error('Foot envelope is not star-shaped');radial.push(distance+ease+.0015*scale);}
 const smooth=(arr,r=7)=>arr.map((_,i)=>{let s=0,w=0;for(let k=-r*3;k<=r*3;k++){const a=Math.exp(-.5*(k/r)**2);s+=arr[(i+k+N*3)%N]*a;w+=a;}return s/w;});
 const rb=smooth(radial,5);let correction=0;for(let i=0;i<N;i++)correction=Math.max(correction,radial[i]-rb[i]);for(let i=0;i<N;i++)rb[i]+=correction+.0005*scale;
 const sample=(a,t)=>{const q=((t/TAU%1)+1)%1*N,i=Math.floor(q),f=q-i,p0=a[(i+N-1)%N],p1=a[i%N],p2=a[(i+1)%N],p3=a[(i+2)%N];return .5*((2*p1)+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f*f+(-p0+3*p1-3*p2+p3)*f*f*f);};
 const openR=t=>1/Math.hypot(Math.sin(t)/openingW,Math.cos(t)/openingZ),alpha=t=>.24+.25*Math.pow((Math.cos(t)+1)*.5,2);
 const roof=Array.from({length:N},(_,i)=>{const front=(Math.cos(i/N*TAU)+1)*.5;return((style.boot?.078:style.collar)+.014*(1-front)+.010*front)*scale+instep;}),constraints=[];
 for(const p of foot.samples){const x=p[0]-cx,z=p[2]+.004-cz,t=Math.atan2(x,z),r=Math.hypot(x,z),outer=sample(rb,t),inner=openR(t);if(r<=inner+.0005*scale)continue;const f=clamp((outer-r)/(outer-inner),.002,1),required=(p[1]+instep+.0022*scale)/Math.pow(f,alpha(t));constraints.push({t,required});const k=Math.round(((t/TAU+1)%1)*N);for(let j=-12;j<=12;j++){const a=(k+j+N)%N;roof[a]=Math.max(roof[a],required);}}
 const rh=smooth(roof,7);let delta=0;for(const c of constraints)delta=Math.max(delta,c.required-sample(rh,c.t));for(let i=0;i<N;i++)rh[i]+=delta+.0003*scale;
 function boundary(t,extra=0){const r=sample(rb,t)+extra;return V(cx+Math.sin(t)*r,bottom,cz+Math.cos(t)*r);}
 function heightAt(t,f){const base=sample(rh,t)*Math.pow(f,alpha(t));if(!style.boot)return bottom+base;const u=clamp((f-.82)/.18,0,1),blend=u*u*(3-2*u);return bottom+lerp(base,.18*scale+instep,blend);}
 function surf(t,v){const f=Math.pow(Math.sin(v*PI/2),2),r=lerp(sample(rb,t),openR(t),f);return V(cx+Math.sin(t)*r,heightAt(t,f),cz+Math.cos(t)*r);}
 function upperAt(x,z){const t=Math.atan2(x-cx,z-cz),r=Math.hypot(x-cx,z-cz),f=clamp((sample(rb,t)-r)/(sample(rb,t)-openR(t)),0,1);return heightAt(t,f);}
 const bounds=Array.from({length:N},(_,i)=>boundary(i/N*TAU)),minX=Math.min(...bounds.map(p=>p.x)),maxX=Math.max(...bounds.map(p=>p.x)),W=maxX-minX;
 function range(s){const z=s*L,arr=[];for(let i=0;i<N;i++){const a=bounds[i],b=bounds[(i+1)%N];if((a.z<z)===(b.z<z)||Math.abs(a.z-b.z)<1e-9)continue;arr.push(lerp(a.x,b.x,(z-a.z)/(b.z-a.z)));}return arr.length>=2?[Math.min(...arr),Math.max(...arr)]:[cx,cx];}
 const width=s=>{const a=range(s);return(a[1]-a[0])/2;},center=s=>{const a=range(s);return(a[1]+a[0])/2;};
 let minimumClearance=Infinity;for(const p of foot.samples){const r=Math.hypot(p[0]-cx,p[2]+.004-cz),t=Math.atan2(p[0]-cx,p[2]+.004-cz);if(r>openR(t)+.0005*scale)minimumClearance=Math.min(minimumClearance,upperAt(p[0],p[2]+.004)-bottom-p[1]-.0018*scale);}
 return {L,W,bottom,scale,foot,toe,ease,instep,boundary,surf,width,center,upperAt,ankleZ,openingW,openingZ,openCenter:[cx,cz],minimumSampleClearance:minimumClearance,roofRange:[Math.min(...rh),Math.max(...rh)]};
}
