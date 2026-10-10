// R09 material-chart structural base. All dynamics use implicit.mjs.
// Read-only R08 supplies topology/mass/hinge data; its particle contact and
// XPBD integration are NOT called by the new production integrator.
import {ProductShell as BaseProductShell} from '../../r08/site/grip.mjs';
import {SurfaceContact} from './contact.mjs';
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const pos=(x,i)=>Array.from(x.slice(i*3,i*3+3));
export class ProductShell extends BaseProductShell{
 constructor(data,options={}){super(data,{iterations:25,dt:1/120,substeps:1,damping:2.5,friction:.38,nonlinear:true,contact:true,...options});for(const b of this.bends)b.k*=3;
  // The material chart is attached to the hide, never to triangle enumeration.
  const charts=new Map((data.frameTriangles||[]).map(r=>[[...r.ids].sort((a,b)=>a-b).join(':'),r]));
  for(const q of this.tri){const r=charts.get([...q.ids].sort((a,b)=>a-b).join(':'));if(r){const P=r.ids.map(i=>pos(this.rest,i)),e=sub(P[1],P[0]),f=sub(P[2],P[0]),u=e.map((v,j)=>v*r.inv[0]+f[j]*r.inv[2]),v=e.map((a,j)=>a*r.inv[1]+f[j]*r.inv[3]),a=pos(this.rest,q.ids[0]),E=sub(pos(this.rest,q.ids[1]),a),F=sub(pos(this.rest,q.ids[2]),a);const n=cross(E,F);let L=Math.hypot(...n);for(let j=0;j<3;j++)n[j]/=L;const nu=dot(u,n),U=u.map((x,j)=>x-nu*n[j]);L=Math.hypot(...U);for(let j=0;j<3;j++)U[j]/=L;let V=cross(n,U);if(dot(V,v)<0)V=V.map(x=>-x);const A=dot(E,U),B=dot(F,U),C=dot(E,V),D=dot(F,V),det=A*D-B*C;q.D=[D/det,-B/det,-C/det,A/det];}else if(data.frameTriangles?.length)throw Error('Missing material chart');q.nlambda=0;}
  this.contact=this.cfg.contact?new SurfaceContact(this,data):null;
 }
 step(count=1){return this.integrate(count*this.cfg.substeps);}
 selfContact(){throw Error('Surface contact belongs to the coupled variational step, not an isolated particle projection');}
 reset(){super.reset();if(this.contact){for(const k of ['ccdEvents','ptEvents','eeEvents','frictionEvents','limitedSteps'])this.contact.stats[k]=0;}}
 report(){return{...super.report(),version:'R09-material-base',membrane:'full R04 nonlinear law in material charts; evaluated by production implicit integrator',bending:'Restored R04 3*D*l²/(A0+A1), thickness cubed',surfaceContact:this.contact?.report(),dampingPerSecond:this.cfg.damping,gripStiffnessNPerM:4000,calibrated:false};}
}
