/** R09 variational integration. Retains the R04 nonlinear SurfaceLaw and
 * preconditioned L-BFGS method; adds formed-shell bending, actual seam anchors,
 * finite-thickness surface barriers, swept admissibility and lagged friction.
 * Not the full IPC Newton solver; all unmeasured parameters stay labelled. */
import {ProductShell} from './shell.mjs';
import {closestPT,closestEE,sweptContact} from './contact.mjs';
const dp=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;};
export class ImplicitLeatherShell extends ProductShell{
 constructor(data,options={}){super(data,{substeps:1,implicitIterations:25,dt:1/120,barrierRange:.00010,barrierStiffness:1000,nonlinear:true,...options});this.contactSet=[];this.maxMotion=0;this.lastResidual=0;this.lbfgsSteps=0;this.limitedContactSteps=0;this.energyNative=new NativeEnergy(this);}
 barrier(d){const h=this.cfg.barrierRange;if(d>=h)return[0,0,0];if(d<=0)return[Infinity,0,0];const r=d-h,l=Math.log(d/h),k=this.cfg.barrierStiffness;return[-k*r*r*l,-k*(2*r*l+r*r/d),k*(-2*l-4*r/d+r*r/(d*d))];}
 setPairs(a,b){if(!this.contact){this.contactSet=[];return;}this.contactSet=this.contact.candidates(a,b,.001).filter(p=>!this.contact.sewnNeighbour(p));for(const p of this.contactSet){const q=(p.pt?closestPT:closestEE)(a,p.ids),gap=q.d-p.gap;const force=gap>0?-this.barrier(gap)[1]:0;p.previous=q;p.frictionForce=Math.max(0,force);}}
 objective(x,pred,dt,diagonal=false){return this.energyNative.evaluate(x,diagonal);}
 referenceObjective(x,pred,dt,diagonal=false){const grad=new Float64Array(x.length),diag=diagonal?new Float64Array(x.length):null,F=this._F,hs=this.hingeOut,out=this.energyOut;let energy=0,elasticEnergy=0,contactEnergy=0,normalForce=0;
  for(let i=0;i<this.inv.length;i++)for(let j=0;j<3;j++){const k=3*i+j,m=this.mass[i]/(dt*dt),d=x[k]-pred[k];energy+=.5*m*d*d;grad[k]=m*d;if(diag)diag[k]=m;}
  for(const q of this.tri){const D=q.D,ids=q.ids;for(let j=0;j<3;j++){const e=x[3*ids[1]+j]-x[3*ids[0]+j],f=x[3*ids[2]+j]-x[3*ids[0]+j];F[j]=e*D[0]+f*D[2];F[j+3]=e*D[1]+f*D[3];}const W=this.law.evaluate(F,out),volume=q.area*q.t*this.cfg.stiffnessScale;if(!Number.isFinite(W[0]))return{energy:Infinity,grad,diag};elasticEnergy+=volume*W[0];energy+=volume*W[0];
   const derivatives=[[-D[0]-D[2],-D[1]-D[3]],[D[0],D[1]],[D[2],D[3]]],K=this.law.tangent0;
   for(let z=0;z<3;z++){const [u,v]=derivatives[z];for(let j=0;j<3;j++){const k=3*ids[z]+j;grad[k]+=volume*(W[1+j]*u+W[4+j]*v);if(diag){const a=F[j]*u,b=F[j+3]*v,c=F[j+3]*u+F[j]*v;diag[k]+=volume*(K[0]*a*a+K[3]*b*b+K[5]*c*c+2*K[1]*a*b+2*K[2]*a*c+2*K[4]*b*c);}}}
  }
  for(const q of this.bends){const h=fastHinge(x,...q.ids,hs),C=Math.atan2(Math.sin(h[0]-q.rest),Math.cos(h[0]-q.rest)),f=q.k*C;energy+=.5*f*C;elasticEnergy+=.5*f*C;for(let i=0;i<4;i++)for(let j=0;j<3;j++){const k=3*q.ids[i]+j,g=h[1+3*i+j];grad[k]+=f*g;if(diag)diag[k]+=q.k*g*g;}}
  for(const q of [...this.surfaceLinks,...this.links.map(q=>({ids:[q.a,q.b],weights:[1,-1],length:q.L,stiffness:q.k}))]){const ids=q.ids,w=q.weights,d=[0,0,0];for(let i=0;i<ids.length;i++)for(let j=0;j<3;j++)d[j]+=w[i]*x[3*ids[i]+j];const L=Math.hypot(...d),C=L-q.length;if(L<1e-14)continue;energy+=.5*q.stiffness*C*C;for(let i=0;i<ids.length;i++)for(let j=0;j<3;j++){const k=3*ids[i]+j,g=w[i]*d[j]/L;grad[k]+=q.stiffness*C*g;if(diag)diag[k]+=q.stiffness*g*g;}}
  if(this.grab){const g=this.grab,K=4000;this.grabForce=0;for(let j=0;j<3;j++){let d=-g.target[j];for(let i=0;i<3;i++)d+=g.weights[i]*x[3*g.ids[i]+j];energy+=.5*K*d*d;this.grabForce+=K*K*d*d;for(let i=0;i<3;i++){const k=3*g.ids[i]+j;grad[k]+=K*d*g.weights[i];if(diag)diag[k]+=K*g.weights[i]**2;}}this.grabForce=Math.sqrt(this.grabForce);}
  let active=0,frictionPairs=0;
  for(const p of this.contactSet){const q=(p.pt?closestPT:closestEE)(x,p.ids),d=q.d-p.gap;if(d<=0)return{energy:Infinity,grad,diag};const [B,G,H]=this.barrier(d);energy+=B;contactEnergy+=B;if(B>0){active++;normalForce-=G;for(let i=0;i<4;i++)for(let j=0;j<3;j++){const k=3*p.ids[i]+j,v=q.w[i]*q.n[j];grad[k]+=G*v;if(diag)diag[k]+=Math.max(0,H)*v*v;}}
   if(p.frictionForce>0&&this.cfg.friction>0){const q=p.previous,r=[0,0,0];for(let i=0;i<4;i++)for(let j=0;j<3;j++)r[j]+=q.w[i]*(x[3*p.ids[i]+j]-this.prev[3*p.ids[i]+j]);const nd=r[0]*q.n[0]+r[1]*q.n[1]+r[2]*q.n[2];for(let j=0;j<3;j++)r[j]-=nd*q.n[j];const eps=.00002,L=Math.sqrt(dp(r,r)+eps*eps),f=this.cfg.friction*p.frictionForce;energy+=f*(L-eps);frictionPairs++;for(let i=0;i<4;i++)for(let j=0;j<3;j++){const k=3*p.ids[i]+j;grad[k]+=f*q.w[i]*r[j]/L;if(diag)diag[k]+=f*q.w[i]**2/L;}}
  }
  for(let i=0;i<this.inv.length;i++){const k=3*i+1,y=this.contactThickness[i]+.0005,d=x[k]-y;if(d<0){const K=2e5;energy+=.5*K*d*d;grad[k]+=K*d;if(diag)diag[k]+=K;}}
  let residual=0;for(let i=0;i<this.inv.length;i++)for(let j=0;j<3;j++){const k=3*i+j;if(this.inv[i]===0)grad[k]=0;residual=Math.max(residual,Math.abs(grad[k]));if(diag)diag[k]=1/Math.max(1e-6,diag[k]);}
  return{energy,grad,diag,residual,elasticEnergy,contactEnergy,active,normalForce,frictionPairs};
 }
 safeStep(a,b,pairs){const filtered=pairs===this.contactSet?pairs:pairs.filter(p=>!this.contact.sewnNeighbour(p));let fraction=this.energyNative.clip(a,b,filtered);if(fraction===null){fraction=1;for(const p of filtered){const hit=sweptContact(a,b,p.ids,p.gap,p.pt);if(hit)fraction=Math.min(fraction,hit.t*.9);}}for(let i=0;i<this.inv.length;i++){const k=3*i+1,dy=b[k]-a[k],minimum=this.contactThickness[i]+.0004;if(dy<0&&b[k]<minimum)fraction=Math.min(fraction,.95*Math.max(0,a[k]-minimum)/(-dy));}return fraction;}
 coarsePreconditioner(x,dt,diag){
  const center=[0,0,0],N=this.inv.length;if(this.inv.some(x=>x===0))return v=>Float64Array.from(v,(x,i)=>this.inv[Math.floor(i/3)]?x*diag[i]:0);for(let i=0;i<N;i++)for(let j=0;j<3;j++)center[j]+=this.mass[i]*x[3*i+j]/this.totalMass;
  const bases=new Float64Array(N*18),H=new Float64Array(36);
  function basis(r){return[1,0,0,0,r[2],-r[1],0,1,0,-r[2],0,r[0],0,0,1,r[1],-r[0],0];}
  const outer=(J,k,component=-1)=>{for(let a=0;a<6;a++)for(let b=0;b<6;b++)for(let j=0;j<3;j++)if(component<0||j===component)H[a*6+b]+=k*J[j*6+a]*J[j*6+b];};
  for(let i=0;i<N;i++){const J=basis([x[3*i]-center[0],x[3*i+1]-center[1],x[3*i+2]-center[2]]);bases.set(J,i*18);outer(J,this.mass[i]/(dt*dt));if(x[3*i+1]<this.contactThickness[i]+.0005)outer(J,2e5,1);}
  if(this.grab){const p=[-center[0],-center[1],-center[2]];for(let i=0;i<3;i++)for(let j=0;j<3;j++)p[j]+=this.grab.weights[i]*x[3*this.grab.ids[i]+j];outer(basis(p),4000);}
  const L=new Float64Array(36);for(let i=0;i<6;i++)for(let j=0;j<=i;j++){let a=H[i*6+j];for(let k=0;k<j;k++)a-=L[i*6+k]*L[j*6+k];L[i*6+j]=i===j?Math.sqrt(Math.max(1e-10,a)):a/L[j*6+j];}
  return v=>{const rhs=new Float64Array(6),z=new Float64Array(6),solution=new Float64Array(6),out=new Float64Array(v.length);for(let i=0;i<N;i++)for(let j=0;j<3;j++)for(let k=0;k<6;k++)rhs[k]+=bases[i*18+j*6+k]*v[3*i+j];
   for(let i=0;i<6;i++){let a=rhs[i];for(let j=0;j<i;j++)a-=L[i*6+j]*z[j];z[i]=a/L[i*6+i];}for(let i=5;i>=0;i--){let a=z[i];for(let j=i+1;j<6;j++)a-=L[j*6+i]*solution[j];solution[i]=a/L[i*6+i];}
   for(let i=0;i<N;i++)for(let j=0;j<3;j++){const p=3*i+j;out[p]=v[p]*diag[p];for(let k=0;k<6;k++)out[p]+=bases[i*18+j*6+k]*solution[k];if(this.inv[i]===0)out[p]=0;}return out;};
 }
 integrate(count=1){if(!this.active||this.failed)return;const dt=this.cfg.dt/this.cfg.substeps,N=this.x.length;for(let step=0;step<count;step++){
   this.prev.set(this.x);if(this.grab){const d=this.grab.goal.map((v,i)=>v-this.grab.target[i]),L=Math.hypot(...d),f=Math.min(1,.9*dt/Math.max(L,1e-12));for(let j=0;j<3;j++)this.grab.target[j]+=d[j]*f;}
   const pred=this.x.slice(),damp=Math.exp(-this.cfg.damping*dt);for(let i=0;i<this.inv.length;i++)if(this.inv[i]>0)for(let j=0;j<3;j++){const k=3*i+j;pred[k]+=this.v[k]*damp*dt-(j===1?this.cfg.gravity*dt*dt:0);}
   this.setPairs(this.prev,pred);this.energyNative.begin(pred,dt,this.contactSet);let q=this.x.slice(),st=this.objective(q,pred,dt,true),pre=st.diag,applyPre=this.coarsePreconditioner(q,dt,pre),hist=[],iter=0;
   if(!Number.isFinite(st.energy)){this.failed='Initial contact state invalid; no physics pose accepted';this.active=false;break;}
   for(;iter<this.cfg.implicitIterations;iter++){
    if(st.residual<.0002)break;
    let v=st.grad.slice(),alpha=[];for(let h=hist.length-1;h>=0;h--){alpha[h]=hist[h].rho*dp(hist[h].s,v);for(let i=0;i<N;i++)v[i]-=alpha[h]*hist[h].y[i];}const direction=applyPre(v);for(let h=0;h<hist.length;h++){const beta=hist[h].rho*dp(hist[h].y,direction);for(let i=0;i<N;i++)direction[i]+=hist[h].s[i]*(alpha[h]-beta);}for(let i=0;i<N;i++)direction[i]=-direction[i];let slope=dp(st.grad,direction);if(slope>=0){hist=[];const projected=applyPre(st.grad);for(let i=0;i<N;i++)direction[i]=-projected[i];slope=dp(st.grad,direction);}
    let maxDir=0;for(let i=0;i<N;i+=3)maxDir=Math.max(maxDir,Math.hypot(direction[i],direction[i+1],direction[i+2]));if(maxDir>.002){const scale=.002/maxDir;for(let i=0;i<N;i++)direction[i]*=scale;slope*=scale;}
    let f=1,trial=new Float64Array(N),next=null;for(let j=0;j<N;j++)trial[j]=q[j]+direction[j];if(this.contact){let inside=true;for(let k=0;k<N;k++)if(trial[k]<Math.min(this.prev[k],pred[k])-.0009||trial[k]>Math.max(this.prev[k],pred[k])+.0009){inside=false;break;}const pairs=inside?this.contactSet:this.contact.candidates(q,trial);f=this.safeStep(q,trial,pairs);}
    for(let ls=0;ls<20;ls++){for(let j=0;j<N;j++)trial[j]=q[j]+f*direction[j];next=this.objective(trial,pred,dt);if(Number.isFinite(next.energy)&&next.energy<=st.energy+1e-4*f*slope)break;f*=.5;next=null;}
    if(!next||f<1e-10)break;
    const ss=Float64Array.from(q,(x,i)=>trial[i]-x),yy=Float64Array.from(st.grad,(x,i)=>next.grad[i]-x),sy=dp(ss,yy);if(sy>1e-24){hist.push({s:ss,y:yy,rho:1/sy});if(hist.length>8)hist.shift();}q.set(trial);st=next;
   }
   this.lastResidual=st.residual;this.lastIterations=iter;this.lbfgsSteps+=iter;this.lastEnergy=st.energy;
   let fraction=this.contact?this.safeStep(this.prev,q,this.contact.candidates(this.prev,q)):1;for(let i=0;i<N;i++)this.x[i]=this.prev[i]+fraction*(q[i]-this.prev[i]);if(fraction<.999999)this.limitedContactSteps++;
   const actual=this.objective(this.x,pred,dt);this.lastResidual=actual.residual;this.lastEnergy=actual.energy;st=actual;
   if(this.contact){this.contact.stats.contactPairs=st.active;this.contact.stats.frictionEvents+=st.frictionPairs;this.contact.stats.normalForceN=st.normalForce;this.contact.stats.safeStep=fraction;this.contact.stats.limitedSteps=this.limitedContactSteps;this.contact.stats.minimumClearanceMM=st.minimumClearanceMM;this.contact.stats.maxPenetrationMM=st.minimumClearanceMM===null?0:Math.max(0,-st.minimumClearanceMM);}
   for(let i=0;i<this.inv.length;i++)if(this.inv[i]>0)for(let j=0;j<3;j++){const k=3*i+j;this.v[k]=(this.x[k]-this.prev[k])/dt;}
   for(let i=0;i<this.inv.length;i++)if(this.x[3*i+1]<this.contactThickness[i]+.00051){const k=3*i,speed=Math.hypot(this.v[k],this.v[k+2]),factor=Math.max(0,1-this.cfg.friction*this.cfg.gravity*dt/Math.max(speed,1e-12));this.v[k]*=factor;this.v[k+2]*=factor;}
   if(!this.x.every(Number.isFinite)||!Number.isFinite(this.lastEnergy)){this.failed='Variational solve left admissible finite domain; no animated fallback';this.active=false;break;}
   this.time+=dt;this.steps++;this.peakStretch=Math.max(this.peakStretch,this.extension());
  }return this.report();}
 reset(){super.reset();this.lastResidual=0;this.lastIterations=0;this.lastEnergy=0;this.lbfgsSteps=0;this.limitedContactSteps=0;}
 report(){return{...super.report(),version:'R09-implicit-1',integrationSubstepS:this.cfg.dt/this.cfg.substeps,acceptedPrincipalLimit:null,strainLimit:null,selfContact:'finite-thickness variational barriers with swept point-triangle and edge-edge step filtering',membrane:'full frozen R04 nonlinear SurfaceLaw, fixed material axes',integrator:'R04 preconditioned L-BFGS variational method extended to sewn products and finite-thickness contact barrier',residualN:this.lastResidual,solverIterations:this.lastIterations,lbfgsIterations:this.lbfgsSteps,incrementalPotentialJ:this.lastEnergy,contactRangeMM:this.cfg.barrierRange*1000,convergedToR04Residual:this.lastResidual<.0002,calibrated:false};}
}
