// R07 product-grab shell. SI units; R04 SurfaceLaw and signed hinge are read-only imports.
// XPBD energy constraints, not a prescribed sway curve or a rigid-object animation.
import {SurfaceLaw,hinge} from '../../r04/site/dynamics.mjs';
export const GRIP_VERSION='R07-shell-2';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const pos=(p,i)=>[p[3*i],p[3*i+1],p[3*i+2]];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class ProductShell{
 constructor(data,options={}){
  this.cfg={dt:1/240,substeps:4,iterations:8,gravity:9.81,density:700,damping:.5,profile:'NL',...options};
  this.x=Float64Array.from(data.positions,v=>v*.001);this.rest=this.x.slice();this.prev=this.x.slice();this.v=new Float64Array(this.x.length);this.inv=new Float64Array(this.x.length/3);this.mass=new Float64Array(this.inv.length);
  this.tri=[];this.bends=[];this.links=[];this.surfaceLinks=(data.surfaceLinks||[]).map(q=>({...q,lambda:0}));this.lambdaGrab=[0,0,0];this.law=new SurfaceLaw(this.cfg.profile);this.time=0;this.steps=0;this.grab=null;this.active=false;this.failed=null;this.peakStretch=1;this.contacts=0;this.grabForce=0;this.contactThickness=new Float64Array(this.inv.length);this.adj=Array.from(this.inv,()=>new Set());
  const edges=new Map();
  for(const d of data.triangles){
   const [a,b,c,tmm,formed=1]=d,pa=pos(this.rest,a),pb=pos(this.rest,b),pc=pos(this.rest,c),ab=sub(pb,pa),ac=sub(pc,pa),L=Math.hypot(...ab),u=ab.map(v=>v/L),s=dot(ac,u),h=Math.sqrt(Math.max(0,dot(ac,ac)-s*s)),area=L*h*.5;
   if(area<1e-11)continue;const t=tmm*.001,q={ids:[a,b,c],D:[1/L,-s/(L*h),0,1/h],area,t,lambda:new Float64Array(3)};this.tri.push(q);
   for(const id of q.ids){this.mass[id]+=area*t*this.cfg.density/3;this.contactThickness[id]=Math.max(this.contactThickness[id],t*.5);}
   for(const [i,j,k]of[[a,b,c],[b,c,a],[c,a,b]]){const key=Math.min(i,j)+':'+Math.max(i,j);this.adj[i].add(j);this.adj[j].add(i);if(edges.has(key)){const old=edges.get(key);const ids=[old.opposite,k,old.a,old.b],angle=hinge(this.rest,...ids)[0];const el=Math.hypot(...sub(pos(this.rest,i),pos(this.rest,j)));const shape=Math.max(.1,el*el/Math.max(1e-9,area+old.area));this.bends.push({ids,rest:formed?angle:0,k:.002*(t/.00139)**3*shape,lambda:0});}else edges.set(key,{a:i,b:j,opposite:k,area});}
  }
  for(const [a,b,k=80000]of data.links||[]){if(a===b)continue;this.links.push({a,b,L:Math.hypot(...sub(pos(this.rest,a),pos(this.rest,b))),k,lambda:0});this.adj[a].add(b);this.adj[b].add(a);}
  for(const q of this.surfaceLinks)for(const a of q.ids)for(const b of q.ids)if(a!==b)this.adj[a].add(b);
  for(const [id,m]of data.extraMass||[])this.mass[id]+=m;
  for(let i=0;i<this.inv.length;i++)this.inv[i]=1/Math.max(1e-7,this.mass[i]);
  this.totalMass=this.mass.reduce((a,b)=>a+b,0);this.energyOut=new Float64Array(7);this.hingeOut=new Float64Array(13);this.constraintsFinite=true;
  const K=this.law.tangent0,A=K[0],B=K[1],C=K[2],E=K[3],H=K[4],I=K[5],det=A*(E*I-H*H)-B*(B*I-C*H)+C*(B*H-C*E);
  const inv=[(E*I-H*H)/det,(C*H-B*I)/det,(B*H-C*E)/det,(A*I-C*C)/det,(B*C-A*H)/det,(A*E-B*B)/det];
  for(const q of this.tri){const f=1/(q.area*q.t*(this.cfg.dt/this.cfg.substeps)**2);q.alpha=Float64Array.from([inv[0],inv[1],inv[2],inv[1],inv[3],inv[4],inv[2],inv[4],inv[5]],v=>v*f);}
  this._F=new Float64Array(6);this._G=new Float64Array(27);this._M=new Float64Array(9);this._rhs=new Float64Array(3);
 }
 reset(){this.x.set(this.rest);this.prev.set(this.rest);this.v.fill(0);this.time=0;this.steps=0;this.grab=null;this.active=false;this.failed=null;this.peakStretch=1;}
 pick(ids,weights,point){if(ids.length!==3||weights.length!==3||!point.every(Number.isFinite))throw Error('Invalid grab');this.grab={ids:[...ids],weights:[...weights],target:point.map(v=>v*.001),goal:point.map(v=>v*.001)};this.lambdaGrab.fill(0);this.active=true;return this.grab;}
 move(point){if(this.grab&&point.every(Number.isFinite))this.grab.goal=point.map(v=>v*.001);}
 release(){this.grab=null;this.lambdaGrab.fill(0);}
 membrane(q,dt){
  const a=q.ids[0]*3,b=q.ids[1]*3,c=q.ids[2]*3,D=q.D,x=this.x,F=this._F,G=this._G,M=this._M,rhs=this._rhs,alpha=q.alpha;
  for(let j=0;j<3;j++){const e=x[b+j]-x[a+j],f=x[c+j]-x[a+j];F[j]=e*D[0]+f*D[2];F[j+3]=e*D[1]+f*D[3];
   G[3+j]=F[j]*D[0];G[6+j]=F[j]*D[2];G[j]=-G[3+j]-G[6+j];
   G[12+j]=F[j+3]*D[1];G[15+j]=F[j+3]*D[3];G[9+j]=-G[12+j]-G[15+j];
   G[21+j]=F[j+3]*D[0]+F[j]*D[1];G[24+j]=F[j+3]*D[2]+F[j]*D[3];G[18+j]=-G[21+j]-G[24+j];}
  rhs[0]=-(F[0]*F[0]+F[1]*F[1]+F[2]*F[2]-1)*.5;rhs[1]=-(F[3]*F[3]+F[4]*F[4]+F[5]*F[5]-1)*.5;rhs[2]=-(F[0]*F[3]+F[1]*F[4]+F[2]*F[5]);M.set(alpha);
  for(let k=0;k<3;k++)for(let l=0;l<3;l++){rhs[k]-=alpha[k*3+l]*q.lambda[l];let sum=0;for(let i=0;i<3;i++){const p=k*9+i*3,r=l*9+i*3;sum+=this.inv[q.ids[i]]*(G[p]*G[r]+G[p+1]*G[r+1]+G[p+2]*G[r+2]);}M[k*3+l]+=sum;}
  const l00=Math.sqrt(Math.max(1e-20,M[0])),l10=M[3]/l00,l20=M[6]/l00,l11=Math.sqrt(Math.max(1e-20,M[4]-l10*l10)),l21=(M[7]-l20*l10)/l11,l22=Math.sqrt(Math.max(1e-20,M[8]-l20*l20-l21*l21));
  const y0=rhs[0]/l00,y1=(rhs[1]-l10*y0)/l11,y2=(rhs[2]-l20*y0-l21*y1)/l22,d2=y2/l22,d1=(y1-l21*d2)/l11,d0=(y0-l10*d1-l20*d2)/l00;
  q.lambda[0]+=d0;q.lambda[1]+=d1;q.lambda[2]+=d2;for(let i=0;i<3;i++)for(let j=0;j<3;j++){const k=i*3+j;x[3*q.ids[i]+j]+=this.inv[q.ids[i]]*(d0*G[k]+d1*G[9+k]+d2*G[18+k]);}
 }
 bending(q,dt){const o=hinge(this.x,...q.ids,this.hingeOut),C=Math.atan2(Math.sin(o[0]-q.rest),Math.cos(o[0]-q.rest)),alpha=1/(q.k*dt*dt);let den=alpha;for(let i=0;i<4;i++)for(let j=0;j<3;j++)den+=this.inv[q.ids[i]]*o[1+3*i+j]**2;if(den<1e-20)return;const dl=(-C-alpha*q.lambda)/den;q.lambda+=dl;for(let i=0;i<4;i++)for(let j=0;j<3;j++)this.x[3*q.ids[i]+j]+=this.inv[q.ids[i]]*o[1+3*i+j]*dl;}
 distance(q,dt){const x=this.x,i=q.a*3,j=q.b*3,dx=x[j]-x[i],dy=x[j+1]-x[i+1],dz=x[j+2]-x[i+2],L=Math.hypot(dx,dy,dz);if(L<1e-12)return;const alpha=1/(q.k*dt*dt),dl=(-(L-q.L)-alpha*q.lambda)/(this.inv[q.a]+this.inv[q.b]+alpha);q.lambda+=dl;const k=dl/L;for(let c=0;c<3;c++){let d=[dx,dy,dz][c]*k;x[i+c]-=this.inv[q.a]*d;x[j+c]+=this.inv[q.b]*d;}}
 surfaceJoin(q,dt){
  let dx=0,dy=0,dz=0,den=0;for(let i=0;i<q.ids.length;i++){const id=q.ids[i],w=q.weights[i];dx+=w*this.x[3*id];dy+=w*this.x[3*id+1];dz+=w*this.x[3*id+2];den+=w*w*this.inv[id];}
  const len=Math.hypot(dx,dy,dz);if(len<1e-12)return;const alpha=1/(q.stiffness*dt*dt),dl=(-(len-q.length)-alpha*q.lambda)/(den+alpha);q.lambda+=dl;
  for(let i=0;i<q.ids.length;i++){const id=q.ids[i],f=q.weights[i]*this.inv[id]*dl/len;this.x[3*id]+=dx*f;this.x[3*id+1]+=dy*f;this.x[3*id+2]+=dz*f;}
 }
 grip(dt){if(!this.grab)return;const {ids,weights,target}=this.grab,alpha=2e-8/(dt*dt);let den=alpha;for(let i=0;i<3;i++)den+=this.inv[ids[i]]*weights[i]**2;for(let j=0;j<3;j++){let C=-target[j];for(let i=0;i<3;i++)C+=weights[i]*this.x[ids[i]*3+j];const dl=(-C-alpha*this.lambdaGrab[j])/den;this.lambdaGrab[j]+=dl;for(let i=0;i<3;i++)this.x[ids[i]*3+j]+=this.inv[ids[i]]*weights[i]*dl;}this.grabForce=Math.hypot(...this.lambdaGrab)/(dt*dt);}
 ground(){this.contacts=0;for(let i=0;i<this.inv.length;i++){const k=i*3,y=this.contactThickness[i]+.0005;if(this.x[k+1]<y){this.x[k+1]=y;this.contacts++;}}}
 // Finite-radius non-neighbour particle contacts. Not triangle-level CCD.
 selfContact(){const cell=.008,grid=new Map(),x=this.x;for(let i=0;i<this.inv.length;i++){const p=pos(x,i),c=p.map(v=>Math.floor(v/cell));for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let d=-1;d<=1;d++){const list=grid.get((c[0]+a)+','+(c[1]+b)+','+(c[2]+d));if(!list)continue;for(const j of list){if(this.adj[i].has(j))continue;const dr=[x[3*j]-p[0],x[3*j+1]-p[1],x[3*j+2]-p[2]],L=Math.hypot(...dr),gap=this.contactThickness[i]+this.contactThickness[j]+.00035;const restD=Math.hypot(this.rest[3*i]-this.rest[3*j],this.rest[3*i+1]-this.rest[3*j+1],this.rest[3*i+2]-this.rest[3*j+2]);if(L>=gap||L<1e-8||restD<gap*1.6)continue;const dl=(gap-L)/(this.inv[i]+this.inv[j]);for(let k=0;k<3;k++){x[3*i+k]-=dr[k]/L*dl*this.inv[i];x[3*j+k]+=dr[k]/L*dl*this.inv[j];}this.contacts++;}}
   const key=c.join(',');if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);}}
 step(count=1){return this.integrate(count*this.cfg.substeps);}
 integrate(count=1){if(!this.active||this.failed)return;const dt=this.cfg.dt/this.cfg.substeps;for(let step=0;step<count;step++){
   this.prev.set(this.x);this.constraintsFinite=true;if(this.grab){const d=sub(this.grab.goal,this.grab.target),L=Math.hypot(...d),f=Math.min(1,0.9*dt/Math.max(1e-9,L));for(let j=0;j<3;j++)this.grab.target[j]+=d[j]*f;}
   for(let i=0;i<this.inv.length;i++){const k=3*i;this.v[k+1]-=this.cfg.gravity*dt;for(let j=0;j<3;j++)this.x[k+j]+=this.v[k+j]*dt;}
   for(const q of this.tri)q.lambda.fill(0);for(const q of this.bends)q.lambda=0;for(const q of this.links)q.lambda=0;for(const q of this.surfaceLinks)q.lambda=0;this.lambdaGrab.fill(0);
   for(let it=0;it<this.cfg.iterations;it++){this.grip(dt);for(const q of this.links)this.distance(q,dt);for(const q of this.surfaceLinks)this.surfaceJoin(q,dt);for(const q of this.bends)this.bending(q,dt);for(const q of this.tri)this.membrane(q,dt);this.ground();}
   if(step%2===0){this.selfContact();for(let it=0;it<8;it++){this.grip(dt);for(const q of this.links)this.distance(q,dt);for(const q of this.surfaceLinks)this.surfaceJoin(q,dt);for(const q of this.bends)this.bending(q,dt);for(const q of this.tri)this.membrane(q,dt);this.ground();}}
   this.ground();this.extraIterations=0;for(let batch=0;batch<6&&this.extension()>1.075;batch++){for(let it=0;it<24;it++){this.grip(dt);for(const q of this.links)this.distance(q,dt);for(const q of this.surfaceLinks)this.surfaceJoin(q,dt);for(const q of this.bends)this.bending(q,dt);for(const q of this.tri)this.membrane(q,dt);this.ground();}this.extraIterations+=24;}
   let maxV=0;for(let i=0;i<this.inv.length;i++){const k=i*3,onGround=this.x[k+1]<=this.contactThickness[i]+.00051;for(let j=0;j<3;j++){this.v[k+j]=(this.x[k+j]-this.prev[k+j])/dt*Math.exp(-this.cfg.damping*dt);if(onGround&&j!==1)this.v[k+j]*=.72;maxV=Math.max(maxV,Math.abs(this.v[k+j]));}}
   if(!this.x.every(Number.isFinite)||maxV>60){this.failed='Integration safety stop; reset the product. No clamped mesh fallback.';this.active=false;break;}this.time+=dt;this.steps++;this.peakStretch=Math.max(this.peakStretch,this.extension());
  }return this.report();}
 extension(){let max=1;for(const q of this.tri){const[a,b,c]=q.ids;for(const[i,j]of[[a,b],[b,c],[c,a]]){let R=0,L=0;for(let k=0;k<3;k++){R+=(this.rest[i*3+k]-this.rest[j*3+k])**2;L+=(this.x[i*3+k]-this.x[j*3+k])**2;}if(R>1e-18)max=Math.max(max,Math.sqrt(L/R));}}return max;}
 report(){let maxStretch=1,maxDev=0,com=[0,0,0],minY=Infinity;for(let i=0;i<this.inv.length;i++){for(let j=0;j<3;j++)com[j]+=this.x[3*i+j]*this.mass[i]/this.totalMass;minY=Math.min(minY,this.x[3*i+1]-this.contactThickness[i]);}
  for(const q of this.tri){const[a,b,c]=q.ids;for(const[i,j]of[[a,b],[b,c],[c,a]]){const R=Math.hypot(...sub(pos(this.rest,i),pos(this.rest,j))),L=Math.hypot(...sub(pos(this.x,i),pos(this.x,j)));maxStretch=Math.max(maxStretch,L/R);maxDev=Math.max(maxDev,Math.abs(L-R)*1000);}}
  this.peakStretch=Math.max(this.peakStretch,maxStretch);let grabError=0;if(this.grab){let p=[0,0,0];for(let i=0;i<3;i++)for(let j=0;j<3;j++)p[j]+=this.grab.weights[i]*this.x[this.grab.ids[i]*3+j];grabError=Math.hypot(...sub(p,this.grab.target))*1000;}
  let seamError=0;for(const q of this.surfaceLinks){const d=[0,0,0];for(let i=0;i<q.ids.length;i++)for(let j=0;j<3;j++)d[j]+=q.weights[i]*this.x[3*q.ids[i]+j];seamError=Math.max(seamError,Math.abs(Math.hypot(...d)-q.length)*1000);}
  return{integrationSubstepS:this.cfg.dt/this.cfg.substeps,substepsPerNominalFrameStep:this.cfg.substeps,iterationsPerSubstep:this.cfg.iterations,seamConstraintCount:this.surfaceLinks.length,maxSeamGapErrorMM:seamError,version:GRIP_VERSION,timeS:this.time,steps:this.steps,extraConvergenceIterations:this.extraIterations||0,nodeCount:this.inv.length,triangles:this.tri.length,massG:this.totalMass*1000,centerMM:com.map(v=>v*1000),maxStretch,peakStretch:this.peakStretch,maxEdgeChangeMM:maxDev,groundMinMM:minY*1000,grabErrorMM:grabError,grabForceN:this.grabForce,held:!!this.grab,active:this.active,finite:this.x.every(Number.isFinite),failed:this.failed,membrane:'R04 NL zero-strain tangent, coupled objective Green-strain XPBD in independent R07 integrator; not full nonlinear R04 law',bending:'R04 signed dihedral gradient; D=0.002*(t/1.39mm)^3 N m',selfContact:'non-neighbour particle contacts only; not continuous triangle collision',calibrated:false};}
}
