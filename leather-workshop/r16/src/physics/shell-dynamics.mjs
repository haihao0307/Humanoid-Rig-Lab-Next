/** KAOPU R04: SI-unit elastic leather surface, not the discarded R03.2 spring demo.
 * Membrane W: Nakahara/Matsuda 2020 Eq14–17 and R03.1 constants, 3x2 objective extension.
 * Solver: implicit Euler variational energy minimization, preconditioned L-BFGS with line search.
 * Bending: signed dihedral quadratic shell energy; coefficient is an UNMEASURED input.
 * Sphere/triangle normal penalty potential solved jointly with inertia on BOTH bodies.
 * Density/bending/damping/impact inputs are NOT leather measurements; normal contact is frictionless.
 */
import {PROFILES} from '../../r03/site/physics.mjs';
export const DYNAMIC_VERSION='R04.0';
export const DEFAULT_DYNAMICS=Object.freeze({case:'stone',profile:'NL',angle:0,size:.24,thickness:0.00139,density:700,
  stoneMass:.045,stoneRadius:.016,dropHeight:.04,dropX:0,dropZ:0,gravity:9.81,damping:2.5,
  bendRigidity:.002,dt:1/240,iterations:150,n:12,clampStrain:.08});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const length3=(a)=>Math.hypot(a[0],a[1],a[2]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const read3=(a,i)=>[a[3*i],a[3*i+1],a[3*i+2]];

/** F = [Fu.x,Fu.y,Fu.z,Fv.x,Fv.y,Fv.z], W Pa and P Pa. */
export class SurfaceLaw{
 constructor(profile='NL',angle=0){
  if(!['AL','NL','PNL'].includes(profile)||!Number.isFinite(angle))throw Error('Unsupported dynamic leather profile');
  this.id=profile;this.angle=angle;this.data=PROFILES[profile];
  this.fibers=this.data.fibers.map(([a,k,t])=>{const th=(t-angle)*Math.PI/180;return [a*1e6,k,Math.cos(th),Math.sin(th)];});
  this.C=this.data.C.map(v=>v*1e6);
  const c=this.C[0],K=[8*c,4*c,0,8*c,0,2*c];for(const [alpha,k,a,b] of this.fibers){const x=2*(1-3*k)*a*a,y=2*(1-3*k)*b*b,z=2*(1-3*k)*a*b;K[0]+=alpha*x*x;K[1]+=alpha*x*y;K[2]+=alpha*x*z;K[3]+=alpha*y*y;K[4]+=alpha*y*z;K[5]+=alpha*z*z;}
  this.tangent0=K;

 }
 evaluate(F,out=new Float64Array(7)){
  const ux=F[0],uy=F[1],uz=F[2],vx=F[3],vy=F[4],vz=F[5];
  const A=ux*ux+uy*uy+uz*uz,B=vx*vx+vy*vy+vz*vz,C=ux*vx+uy*vy+uz*vz,D=A*B-C*C;
  if(D<=1e-8||!Number.isFinite(D)){out[0]=Infinity;return out;}
  const q=Math.max(0,A+B+1/D-3),[c1,c2,c3]=this.C;
  let W=c1*q+c2*q*q/2+c3*q*q*q/3,coef=c1+c2*q+c3*q*q;
  let p0=0,p1=0,p2=0,p3=0,p4=0,p5=0;
  for(const [alpha,k,a,b]of this.fibers){
   const fx=ux*a+vx*b,fy=uy*a+vy*b,fz=uz*a+vz*b,e=k*q+(1-3*k)*(fx*fx+fy*fy+fz*fz-1);
   W+=.5*alpha*e*e;coef+=alpha*e*k;const s=2*alpha*e*(1-3*k);
   p0+=s*fx*a;p1+=s*fy*a;p2+=s*fz*a;p3+=s*fx*b;p4+=s*fy*b;p5+=s*fz*b;
  }
  const z=2/(D*D);
  out[0]=W;out[1]=p0+coef*(2*ux-z*(B*ux-C*vx));out[2]=p1+coef*(2*uy-z*(B*uy-C*vy));out[3]=p2+coef*(2*uz-z*(B*uz-C*vz));
  out[4]=p3+coef*(2*vx-z*(A*vx-C*ux));out[5]=p4+coef*(2*vy-z*(A*vy-C*uy));out[6]=p5+coef*(2*vz-z*(A*vz-C*uz));return out;
 }
}

/** Signed angle and exact gradient for two triangles sharing edge (c,d).
 * Invariant under rigid motion. Sign and scale verified by finite differences.
 */
export function hinge(x,a,b,c,d,out=new Float64Array(13)){
 const p0=read3(x,a),p1=read3(x,b),p2=read3(x,c),p3=read3(x,d),e=sub(p3,p2),L=length3(e);
 const N0=cross(sub(p2,p0),sub(p3,p0)),N1=cross(sub(p3,p1),sub(p2,p1)),l0=length3(N0),l1=length3(N1);
 if(L<1e-9||l0<1e-12||l1<1e-12){out.fill(0);return out;}
 const n0=N0.map(v=>v/l0),n1=N1.map(v=>v/l1);
 const theta=Math.atan2(dot(cross(n0,n1),e)/L,clamp(dot(n0,n1),-1,1));out[0]=theta;
 const k0=dot(sub(p0,p3),e)/L,k1=dot(sub(p1,p3),e)/L,k2=dot(sub(p2,p0),e)/L,k3=dot(sub(p2,p1),e)/L;
 for(let j=0;j<3;j++){
  const t0=N0[j]/(l0*l0),t1=N1[j]/(l1*l1);
  out[1+j]=-L*t0;out[4+j]=-L*t1;out[7+j]=-(k0*t0+k1*t1);out[10+j]=-(k2*t0+k3*t1);
 }
 return out;
}

/** Exact closest point on triangle, including all edge/vertex Voronoi regions. */
export function closestBary(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
 if(d1<=0&&d2<=0)return [1,0,0];
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return [0,1,0];
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return [1-v,v,0];}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return[0,0,1];
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return[1-w,0,w];}
 const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return[0,1-w,w];}
 const den=va+vb+vc;if(Math.abs(den)<1e-30)return[1/3,1/3,1/3];const v=vb/den,w=vc/den;return[1-v-w,v,w];
}

export class LeatherDynamics{
 constructor(options={}){
  this.cfg={...DEFAULT_DYNAMICS,...options};const c=this.cfg;
  if(options.thickness===undefined&&PROFILES[c.profile])c.thickness=PROFILES[c.profile].thickness/1000;
  for(const key of ['size','thickness','density','stoneMass','stoneRadius','dt','bendRigidity'])if(!(c[key]>0&&Number.isFinite(c[key])))throw Error('Invalid input '+key);
  if(!Number.isInteger(c.n)||c.n<4||c.n>40||c.clampStrain<0||c.clampStrain>.12||c.dropHeight<0||c.dropHeight>.15||Math.abs(c.dropX)>c.size*.32||Math.abs(c.dropZ)>c.size*.32)throw Error('Input outside supported test domain');
  this.law=new SurfaceLaw(c.profile,c.angle);this.time=0;this.steps=0;this.failed=null;this.events=[];this.peakSag=0;this.peakStretch=1;this.peakPenetration=0;
  this.clampPull=0;this.clampTarget=0;this.clampStart=0;this.clampStartTime=0;this.clampDuration=1;
  const n=c.n,N=(n+1)**2;this.N=N;this.x=new Float64Array(N*3);this.rest=new Float64Array(N*3);this.v=new Float64Array(N*3);this.old=new Float64Array(N*3);this.mass=new Float64Array(N);this.inv=new Float64Array(N);this.pinned=new Uint8Array(N);this.target=new Float64Array(N*3);
  this.tri=[];this.elements=[];this.hinges=[];this.boundary=[];this.centerId=Math.round(n/2)*(n+1)+Math.round(n/2);
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const id=j*(n+1)+i,k=id*3;const axis=q=>q===0?-c.size/2:q===n?c.size/2:-c.size/2+.015+(q-1)/(n-2)*(c.size-.03);
   this.rest[k]=axis(i);this.rest[k+1]=0;this.rest[k+2]=axis(j);
   // finite gripping patches, not eight isolated point loads masquerading as jaws
   const pinned=c.case==='stone'?((i<=1||i>=n-1)&&(j<=1||j>=n-1)):(i<=1||i>=n-1);this.pinned[id]=+pinned;
  }
  const map=new Map();
  const add=(ids)=>{
   const[i,j,k]=ids,a=this.rest[3*j]-this.rest[3*i],b=this.rest[3*k]-this.rest[3*i],cc=this.rest[3*j+2]-this.rest[3*i+2],d=this.rest[3*k+2]-this.rest[3*i+2],det=a*d-b*cc;
   const g1=[d/det,-b/det],g2=[-cc/det,a/det],gr=[[-g1[0]-g2[0],-g1[1]-g2[1]],g1,g2],area=det/2;
   const e={ids,gr,area,V:area*c.thickness,lambda:new Float64Array(3)};this.elements.push(e);this.tri.push(...ids);for(const id of ids)this.mass[id]+=area*c.thickness*c.density/3;
   for(let z=0;z<3;z++){const a=ids[z],b=ids[(z+1)%3],opp=ids[(z+2)%3],key=a<b?a+','+b:b+','+a;if(map.has(key)){const prev=map.get(key);this.hinges.push({ids:[prev.opp,opp,prev.a,prev.b],k:c.bendRigidity*3*((this.rest[prev.a*3]-this.rest[prev.b*3])**2+(this.rest[prev.a*3+2]-this.rest[prev.b*3+2])**2)/(prev.area+area),lambda:0});map.delete(key);}else map.set(key,{a,b,opp,area});}
  };
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+1,cc=a+n+1,d=cc+1;if((i+j)%2){add([a,b,d]);add([a,d,cc]);}else{add([a,b,cc]);add([b,d,cc]);}}
  this.boundary=[...map.values()].map(e=>[e.a,e.b]);this.tri=Uint32Array.from(this.tri);this.x.set(this.rest);this.target.set(this.rest);
  for(let i=0;i<N;i++)this.inv[i]=this.pinned[i]?0:1/this.mass[i];
  this.stone={pos:new Float64Array([c.dropX,c.stoneRadius+c.dropHeight+c.thickness*.5,c.dropZ]),vel:new Float64Array(3),old:new Float64Array(3),active:false,visible:c.case==='stone',mass:c.stoneMass,radius:c.stoneRadius,impulse:0};
  this.scratchF=new Float64Array(6);this.scratchLaw=new Float64Array(7);this.grad=new Float64Array(27);this.stressScratch=new Float64Array(3);this.deltaScratch=new Float64Array(3);this.hingeScratch=new Float64Array(13);this.contactImpulse=0;this.contactCount=0;
 }
 deformation(e,out=this.scratchF){out.fill(0);for(let z=0;z<3;z++){const k=e.ids[z]*3,[u,v]=e.gr[z];for(let j=0;j<3;j++){out[j]+=this.x[k+j]*u;out[3+j]+=this.x[k+j]*v;}}return out;}
 contactGeometry(){
  const b=this.stone;if(!b.active)return{penetration:0,count:0,energy:0};const pos=b.pos,R=b.radius+this.cfg.thickness*.5;let maxPen=0,count=0,energy=0;
  for(const e of this.elements){const ids=e.ids;let skip=false;for(let j=0;j<3;j++){const a=this.x[3*ids[0]+j],bb=this.x[3*ids[1]+j],c=this.x[3*ids[2]+j];if(pos[j]<Math.min(a,bb,c)-R||pos[j]>Math.max(a,bb,c)+R){skip=true;break;}}if(skip)continue;
   const a=read3(this.x,ids[0]),bb=read3(this.x,ids[1]),c=read3(this.x,ids[2]),bs=closestBary(pos,a,bb,c),delta=[0,0,0];for(let j=0;j<3;j++)delta[j]=pos[j]-bs[0]*a[j]-bs[1]*bb[j]-bs[2]*c[j];const pen=R-length3(delta);if(pen>0){maxPen=Math.max(maxPen,pen);count++;energy+=1e5*pen*pen;}
  }return{penetration:maxPen,count,energy};
 }
 drop(){
  if(this.cfg.case!=='stone')throw Error('Stone mode required');const b=this.stone,c=this.cfg;b.pos.set([c.dropX,c.stoneRadius+c.dropHeight+c.thickness*.5,c.dropZ]);b.vel.fill(0);b.active=true;b.visible=true;this.events.push({type:'drop',time:this.time,massKg:b.mass,clearanceM:c.dropHeight});
 }
 removeStone(){this.stone.active=false;this.stone.visible=false;this.events.push({type:'remove',time:this.time});}
 setClamp(strain){if(this.cfg.case!=='clamp'||!Number.isFinite(strain)||strain<0||strain>.12)throw Error('Clamp command outside [0,12%]');this.clampStart=this.clampPull;this.clampStartTime=this.time;this.clampTarget=strain*(this.cfg.size-.03);this.events.push({type:'clamp-command',time:this.time,strain});}
 anchors(h){
  const u=clamp((this.time+h-this.clampStartTime)/this.clampDuration,0,1),t=u*u*(3-2*u);this.clampPull=this.clampStart+(this.clampTarget-this.clampStart)*t;
  for(let i=0;i<this.N;i++)if(this.pinned[i]){const k=3*i;this.target[k]=this.rest[k]+(this.cfg.case==='clamp'?Math.sign(this.rest[k])*this.clampPull*.5:0);this.target[k+1]=this.rest[k+1];this.target[k+2]=this.rest[k+2];}
 }
 objective(q,pred,h,gradient=true){
  const N=this.N,grad=new Float64Array(q.length),F=new Float64Array(6),law=new Float64Array(7),hs=new Float64Array(13);let energy=0,membraneEnergy=0,contactCount=0,penetration=0,force=0;
  for(let i=0;i<N+1;i++){const m=i<N?this.mass[i]:this.stone.mass;if(i===N&&!this.stone.active)continue;for(let j=0;j<3;j++){const k=i*3+j,dx=q[k]-pred[k];energy+=.5*m/(h*h)*dx*dx;grad[k]=m/(h*h)*dx;}}
  for(const e of this.elements){F.fill(0);for(let z=0;z<3;z++){const k=e.ids[z]*3,[u,v]=e.gr[z];for(let j=0;j<3;j++){F[j]+=q[k+j]*u;F[3+j]+=q[k+j]*v;}}
   const r=this.law.evaluate(F,law),U=e.V*r[0];if(!Number.isFinite(U)||U< -1e-8)return{energy:Infinity,grad};energy+=U;membraneEnergy+=U;
   for(let z=0;z<3;z++){const k=e.ids[z]*3,[u,v]=e.gr[z];for(let j=0;j<3;j++)grad[k+j]+=e.V*(r[1+j]*u+r[4+j]*v);}
  }
  for(const e of this.hinges){const r=hinge(q,...e.ids,hs),f=e.k*r[0];energy+=.5*f*r[0];for(let z=0;z<4;z++)for(let j=0;j<3;j++)grad[e.ids[z]*3+j]+=f*r[1+z*3+j];}
  if(this.stone.active){const pos=read3(q,N),R=this.stone.radius+this.cfg.thickness*.5,K=2e5;
   for(const e of this.elements){const ids=e.ids;let skip=false;for(let j=0;j<3;j++){const a=q[3*ids[0]+j],b=q[3*ids[1]+j],c=q[3*ids[2]+j];if(pos[j]<Math.min(a,b,c)-R||pos[j]>Math.max(a,b,c)+R){skip=true;break;}}if(skip)continue;
    const a=read3(q,ids[0]),b=read3(q,ids[1]),c=read3(q,ids[2]),bs=closestBary(pos,a,b,c),d=[0,0,0];for(let j=0;j<3;j++)d[j]=pos[j]-(bs[0]*a[j]+bs[1]*b[j]+bs[2]*c[j]);const dist=length3(d),pen=R-dist;if(pen<=0)continue;
    penetration=Math.max(pen,penetration);contactCount++;energy+=.5*K*pen*pen;force+=K*pen;
    for(let j=0;j<3;j++){const f=K*pen*(dist>1e-12?d[j]/dist:(j===1?1:0));grad[3*N+j]-=f;for(let z=0;z<3;z++)grad[3*ids[z]+j]+=f*bs[z];}
   }
  }
  let residual=0;for(let i=0;i<N+1;i++){if(i<N?this.pinned[i]:!this.stone.active){grad[i*3]=grad[i*3+1]=grad[i*3+2]=0;}else for(let j=0;j<3;j++)residual=Math.max(residual,Math.abs(grad[3*i+j]));}
  return{energy,grad,residual,membraneEnergy,contactCount,penetration,force};
 }
 preconditioner(q,h){
 const diag=new Float64Array(q.length),N=this.N,F=new Float64Array(6),K=this.law.tangent0,hs=new Float64Array(13);
 for(let i=0;i<N;i++)for(let j=0;j<3;j++)diag[3*i+j]=this.mass[i]/(h*h);
 for(let j=0;j<3;j++)diag[3*N+j]=this.stone.mass/(h*h);
 for(const e of this.elements){F.fill(0);for(let z=0;z<3;z++){const k=e.ids[z]*3,[u,v]=e.gr[z];for(let j=0;j<3;j++){F[j]+=q[k+j]*u;F[3+j]+=q[k+j]*v;}}
  for(let z=0;z<3;z++){const k=e.ids[z]*3,[u,v]=e.gr[z];for(let j=0;j<3;j++){const a=F[j]*u,b=F[j+3]*v,c=F[j+3]*u+F[j]*v;diag[k+j]+=e.V*(K[0]*a*a+K[3]*b*b+K[5]*c*c+2*K[1]*a*b+2*K[2]*a*c+2*K[4]*b*c);}}
 }
 for(const e of this.hinges){const r=hinge(q,...e.ids,hs);for(let z=0;z<4;z++)for(let j=0;j<3;j++)diag[3*e.ids[z]+j]+=e.k*r[1+3*z+j]**2;}
 if(this.stone.active){const pos=read3(q,N),R=this.stone.radius+this.cfg.thickness*.5,K=2e5;
  for(const e of this.elements){const ids=e.ids,p0=read3(q,ids[0]),p1=read3(q,ids[1]),p2=read3(q,ids[2]);if(Math.min(p0[0],p1[0],p2[0])-R>pos[0]||Math.max(p0[0],p1[0],p2[0])+R<pos[0]||Math.min(p0[2],p1[2],p2[2])-R>pos[2]||Math.max(p0[2],p1[2],p2[2])+R<pos[2])continue;
   const bs=closestBary(pos,p0,p1,p2),d=[0,0,0];for(let j=0;j<3;j++)d[j]=pos[j]-bs[0]*p0[j]-bs[1]*p1[j]-bs[2]*p2[j];const L=length3(d);if(L>R+.002)continue;for(let j=0;j<3;j++){const val=K*(d[j]/Math.max(L,1e-9))**2;diag[3*N+j]+=val;for(let z=0;z<3;z++)diag[3*ids[z]+j]+=val*bs[z]*bs[z];}
  }
 }
 for(let i=0;i<diag.length;i++)diag[i]=1/Math.max(.0001,diag[i]);return diag;
 }
 step(h=this.cfg.dt){
  if(this.failed)return;if(!(h>0&&h<=1/120))throw Error('Invalid implicit substep');
  this.old.set(this.x);this.stone.old.set(this.stone.pos);this.anchors(h);
  const N=this.N,M=(N+1)*3,pred=new Float64Array(M),q=new Float64Array(M),damp=Math.exp(-this.cfg.damping*h);
  for(let i=0;i<N;i++)for(let j=0;j<3;j++){const k=i*3+j;pred[k]=this.old[k]+this.v[k]*damp*h-(j===1?this.cfg.gravity*h*h:0);q[k]=this.pinned[i]?this.target[k]:pred[k];}
  for(let j=0;j<3;j++){const k=N*3+j;pred[k]=this.stone.old[j]+(this.stone.active?this.stone.vel[j]*h-(j===1?this.cfg.gravity*h*h:0):0);q[k]=pred[k];}
  let st=this.objective(q,pred,h),hist=[],iter=0;
  const dp=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;};
  const pre=this.preconditioner(q,h);
  for(;iter<this.cfg.iterations;iter++){
   if(st.residual<2e-4)break;
   let v=st.grad.slice(),alph=[];
   for(let j=hist.length-1;j>=0;j--){alph[j]=hist[j].rho*dp(hist[j].s,v);for(let i=0;i<M;i++)v[i]-=alph[j]*hist[j].y[i];}
   const dir=new Float64Array(M);for(let i=0;i<M;i++)dir[i]=v[i]*pre[i];
   for(let j=0;j<hist.length;j++){const beta=hist[j].rho*dp(hist[j].y,dir);for(let i=0;i<M;i++)dir[i]+=hist[j].s[i]*(alph[j]-beta);}
   for(let i=0;i<M;i++)dir[i]=-dir[i];let slope=dp(st.grad,dir);
   if(slope>=0){hist=[];for(let i=0;i<M;i++)dir[i]=-st.grad[i]*pre[i];slope=dp(st.grad,dir);}
   let step=1,trial,next;for(let ls=0;ls<25;ls++){trial=Float64Array.from(q,(v,i)=>v+step*dir[i]);next=this.objective(trial,pred,h);if(Number.isFinite(next.energy)&&next.energy<=st.energy+1e-4*step*slope)break;step*=.5;next=null;}
   if(!next)break;
   const ss=Float64Array.from(q,(v,i)=>trial[i]-v),yy=Float64Array.from(st.grad,(v,i)=>next.grad[i]-v),sy=dp(ss,yy);
   if(sy>1e-24){hist.push({s:ss,y:yy,rho:1/sy});if(hist.length>8)hist.shift();}
   q.set(trial);st=next;
  }
  if(!Number.isFinite(st.energy)){this.failed='Energy solve failed; no frame accepted';return;}
  this.lastResidual=st.residual;this.lastIterations=iter;this.contactCount=st.contactCount;this.contactImpulse=st.force*h;
  this.x.set(q.subarray(0,N*3));this.stone.pos.set(q.subarray(N*3));
  for(let i=0;i<N*3;i++)this.v[i]=(this.x[i]-this.old[i])/h;
  if(this.stone.active)for(let j=0;j<3;j++)this.stone.vel[j]=(this.stone.pos[j]-this.stone.old[j])/h;
  this.peakSag=Math.max(this.peakSag,-this.x[3*this.centerId+1]);this.peakPenetration=Math.max(this.peakPenetration,st.penetration||0);
  this.time+=h;this.steps++;
  if(this.steps%12===0){const r=this.report();if(!r.finite||r.maxStretch>1.45||r.minAreaRatio<.5){this.failed='Unsupported deformation; no further integration';this.v.fill(0);this.stone.vel.fill(0);}}
 }
 advance(seconds){const count=Math.round(seconds/this.cfg.dt);for(let i=0;i<count&&!this.failed;i++)this.step();return this.report();}
 report(){
  let U=0,maxStretch=1,minAreaRatio=Infinity,kinetic=0,gravitational=0,maxSpeed=0,pinError=0;const nodalStretch=new Float64Array(this.N),counts=new Uint32Array(this.N);
  for(const e of this.elements){const F=this.deformation(e),A=F[0]**2+F[1]**2+F[2]**2,B=F[3]**2+F[4]**2+F[5]**2,C=F[0]*F[3]+F[1]*F[4]+F[2]*F[5],s=Math.sqrt(Math.max(0,(A+B+Math.hypot(A-B,2*C))/2));maxStretch=Math.max(maxStretch,s);minAreaRatio=Math.min(minAreaRatio,Math.sqrt(Math.max(0,A*B-C*C)));U+=e.V*this.law.evaluate(F,this.scratchLaw)[0];for(const id of e.ids){nodalStretch[id]+=s;counts[id]++;}}
  for(const e of this.hinges){const r=hinge(this.x,...e.ids,this.hingeScratch);U+=.5*e.k*r[0]*r[0];}
  for(let i=0;i<this.N;i++){const k=3*i,speed=Math.hypot(this.v[k],this.v[k+1],this.v[k+2]);maxSpeed=Math.max(maxSpeed,speed);kinetic+=.5*this.mass[i]*speed*speed;gravitational+=this.mass[i]*this.cfg.gravity*this.x[k+1];if(this.pinned[i])pinError=Math.max(pinError,Math.hypot(this.x[k]-this.target[k],this.x[k+1]-this.target[k+1],this.x[k+2]-this.target[k+2]));nodalStretch[i]/=Math.max(1,counts[i]);}
  const b=this.stone,contact=this.contactGeometry(),sag=-this.x[3*this.centerId+1];
  if(b.active){kinetic+=.5*b.mass*dot(b.vel,b.vel);gravitational+=b.mass*this.cfg.gravity*b.pos[1];}
  this.peakSag=Math.max(this.peakSag,sag);this.peakStretch=Math.max(this.peakStretch,maxStretch);this.peakPenetration=Math.max(this.peakPenetration,contact.penetration);
  this.nodalStretch=nodalStretch;
  return {version:DYNAMIC_VERSION,timeS:this.time,steps:this.steps,centerSagMM:sag*1000,peakSagMM:this.peakSag*1000,maxStretch,peakStretch:this.peakStretch,minAreaRatio,pinErrorMM:pinError*1000,penetrationMM:contact.penetration*1000,peakPenetrationMM:this.peakPenetration*1000,
   massKg:this.mass.reduce((a,b)=>a+b,0),stoneYMM:b.pos[1]*1000,stoneSpeedMS:b.active?length3(b.vel):0,stoneActive:b.active,stoneVisible:b.visible,contactCount:this.contactCount,contactForceN:this.contactImpulse/this.cfg.dt,clampPullMM:this.clampPull*1000,
   strainCenterPct:(nodalStretch[this.centerId]-1)*100,elasticEnergyJ:U,kineticEnergyJ:kinetic,potentialEnergyJ:gravitational,contactEnergyJ:contact.energy,totalEnergyJ:U+kinetic+gravitational+contact.energy,residualN:this.lastResidual,solverIterations:this.lastIterations,maxSpeedMS:maxSpeed,finite:Array.from(this.x).every(Number.isFinite)&&Number.isFinite(U),failed:this.failed,experimentalCalibration:false};
 }
 snapshot(){return{schema:'kaopu/leather_dynamics@1',version:DYNAMIC_VERSION,config:{...this.cfg},report:this.report(),events:this.events,positionsM:Array.from(this.x),velocitiesMS:Array.from(this.v),restPositionsM:Array.from(this.rest),triangles:Array.from(this.tri),assumptions:['density, bending, damping and friction are unmeasured','spherical stone collider','no self collision, tearing or permanent folds','implicit finite-iteration preview, not experimental certification','frictionless normal contact penalty 200000 N/m per active triangle'],materialSource:'Nakahara/Matsuda 2020, R03.1 inherited constants; objective 3x2 membrane extension'};}
}
