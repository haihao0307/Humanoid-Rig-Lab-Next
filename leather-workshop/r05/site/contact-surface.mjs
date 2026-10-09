/** R05.1 local elastic skin response; mm, N. Does not import or modify R04.
 * Quadratic plate-on-foundation model: (K + S*L + D*L^2) w = contact load.
 * Thread turning points provide paired contact loads, not a painted wrinkle map.
 * Parameters below are uncalibrated local-surface approximations, not leather tests.
 */
export const CONTACT_PARAMETERS={foundation:2.8,skinBending:.025,skinTension:.055,lateralFoundation:1.8,lateralMembrane:.6,nu:.32,gridMM:.25};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function applyL(v,out,nx,nz,h){
 const inv=1/(h*h);out.fill(0);
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const k=j*nx+i;
  if(i+1<nx){const d=(v[k]-v[k+1])*inv;out[k]+=d;out[k+1]-=d;}
  if(j+1<nz){const d=(v[k]-v[k+nx])*inv;out[k]+=d;out[k+nx]-=d;}
 }
}
function solvePlate(load,nx,nz,h,k,s,d){
 const n=load.length,x=new Float64Array(n),r=Float64Array.from(load),p=r.slice(),Ap=new Float64Array(n),L=new Float64Array(n),LL=new Float64Array(n);
 const dot=(a,b)=>{let q=0;for(let i=0;i<n;i++)q+=a[i]*b[i];return q;};
 const rr0=dot(r,r);let rr=rr0,iterations=0;
 if(rr0<1e-30)return {x,iterations,residual:0};
 for(;iterations<180;iterations++){
  applyL(p,L,nx,nz,h);if(d)applyL(L,LL,nx,nz,h);
  for(let i=0;i<n;i++)Ap[i]=k*p[i]+s*L[i]+d*LL[i];
  const alpha=rr/dot(p,Ap);for(let i=0;i<n;i++){x[i]+=alpha*p[i];r[i]-=alpha*Ap[i];}
  const rn=dot(r,r);if(rn<rr0*1e-14){rr=rn;break;}
  const beta=rn/rr;for(let i=0;i<n;i++)p[i]=r[i]+beta*p[i];rr=rn;
 }
 return {x,iterations:iterations+1,residual:Math.sqrt(rr/rr0)};
}
export function buildContactField(model,enabled=true){
 const p=model.params,c=CONTACT_PARAMETERS,step=c.gridMM;
 const nx=Math.ceil(model.width/step)+1,nz=Math.ceil(model.depth/step)+1,n=nx*nz,h=step;
 const x0=-model.width/2,z0=-model.depth/2;
 const pressure=new Float64Array(n),fx=new Float64Array(n),fz=new Float64Array(n);
 const tension=enabled?(p.tensionN??.8)*p.tightness:0;
 const activeHole=(h)=>{if(!model.process)return 1;return h.index<model.process.hole?1:h.index===model.process.hole?clamp((model.process.phase-.75)/.25,0,1):0;};
 const deposit=(dst,x,z,force,radius)=>{
  const a=clamp(Math.floor((x-x0-3*radius)/h),0,nx-1),b=clamp(Math.ceil((x-x0+3*radius)/h),0,nx-1),c0=clamp(Math.floor((z-z0-3*radius)/h),0,nz-1),d0=clamp(Math.ceil((z-z0+3*radius)/h),0,nz-1);
  let sum=0;
  for(let j=c0;j<=d0;j++)for(let i=a;i<=b;i++)sum+=Math.exp(-((x0+i*h-x)**2+(z0+j*h-z)**2)/(2*radius*radius));
  for(let j=c0;j<=d0;j++)for(let i=a;i<=b;i++){const w=Math.exp(-((x0+i*h-x)**2+(z0+j*h-z)**2)/(2*radius*radius));dst[j*nx+i]+=force*w/(sum*h*h);}
 };
 // Balanced normal dipoles approximate a compressible surface bonded to an elastic substrate.
 // Broad return traction prevents inventing volume loss at the compressed grain layer.
 for(const hole of model.holes){
  const t=tension*activeHole(hole),D=p.diameter;
  for(const sign of [-1,1]){
   const a=hole.axis,x=hole.x+sign*hole.rx*.70*a[0],z=hole.z+sign*hole.rx*.70*a[1];
   deposit(pressure,x,z,-.24*t,.20+D*.30);
   deposit(pressure,x,z,.24*t,.80+D*.5);
   deposit(fx,x,z,-sign*t*.10*a[0],.32);deposit(fz,x,z,-sign*t*.10*a[1],.32);
  }
  // Small local line-contact load follows the stitch, fades into the neighboring patch.
  if(hole.index<p.count-1){const x=hole.x+p.pitch*.5,z=hole.z;deposit(pressure,x,z,-t*.028,.42);deposit(pressure,x,z,t*.028,1.0);}
 }
 const k=c.foundation*(1.4/p.layerThickness),D=c.skinBending;
 const w=solvePlate(pressure,nx,nz,h,k,c.skinTension,D);
 const u=solvePlate(fx,nx,nz,h,c.lateralFoundation,c.lateralMembrane,0),v=solvePlate(fz,nx,nz,h,c.lateralFoundation,c.lateralMembrane,0);
 function sample(a,x,z){const xx=clamp((x-x0)/h,0,nx-1.000001),zz=clamp((z-z0)/h,0,nz-1.000001),i=Math.floor(xx),j=Math.floor(zz),tx=xx-i,tz=zz-j,k=j*nx+i;return (a[k]*(1-tx)+a[k+1]*tx)*(1-tz)+(a[k+nx]*(1-tx)+a[k+nx+1]*tx)*tz;}
 let min=0,max=0,maxUV=0;
 for(let i=0;i<n;i++){min=Math.min(min,w.x[i]);max=Math.max(max,w.x[i]);maxUV=Math.max(maxUV,Math.hypot(u.x[i],v.x[i]));}
 const stats={model:'local elastic plate on foundation',units:{length:'mm',tension:'N'},tensionN:tension,minDisplacementMM:min,maxDisplacementMM:max,maxLateralMM:maxUV,relativeResidual:Math.max(w.residual,u.residual,v.residual),iterations:Math.max(w.iterations,u.iterations,v.iterations),calibrated:false,fullStitchMechanics:false};
 return {sample:(x,z)=>[sample(u.x,x,z),sample(w.x,x,z),sample(v.x,x,z)],stats,parameters:{...c,foundation:k},arrays:{w:w.x,u:u.x,v:v.x},nx,nz,h};
}
export function mapSurfacePoint(model,point){
 const [x,y,z]=point,field=model.contact;if(!field)return [...point];
 const d=field.sample(x,z),t=model.params.layerThickness;
 return [x+d[0],y+d[1]*clamp(y/t,-1,1),z+d[2]];
}
