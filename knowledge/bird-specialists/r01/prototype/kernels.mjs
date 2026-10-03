/* Original, dependency-free numerical prototypes. Inherits repository MIT license.
 * NOT a bird simulator; NOT an implementation of AVES/ORCA/DER/DQS/PRSSM.
 * Units: metres, seconds, radians, kilograms, newtons. Caller supplies calibration.
 * Arrays are copied; no hidden state, assets, network requests or species defaults.
 */
const finite = (x, name) => { if (!Number.isFinite(x)) throw new TypeError(`${name}: finite number required`); return x; };
const nonneg = (x, name) => { finite(x,name); if (x < 0) throw new RangeError(`${name}: must be nonnegative`); return x; };
const positive = (x, name) => { finite(x,name); if (x <= 0) throw new RangeError(`${name}: must be positive`); return x; };
const vec = (a, name) => { if (!Array.isArray(a) || a.length !== 3) throw new TypeError(`${name}: [x,y,z] required`); a.forEach(x=>finite(x,name)); return a; };
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,s)=>a.map(x=>x*s);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const unit=(a)=>{const n=norm(a); if(n<1e-12)throw new RangeError('degenerate direction');return mul(a,1/n);};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const limit=(a,m)=>norm(a)>m?mul(a,m/norm(a)):a;

/** Endpoint-flat quintic; derivatives are with respect to normalized u, not time. */
export function smoothTransition(u) {
  finite(u,'u'); const x=clamp(u,0,1);
  return {value:x*x*x*(10+x*(-15+6*x)), derivative:30*x*x*(x-1)*(x-1)};
}

/** Coefficients describe one scalar anatomical axis; never add quaternions. */
export function sampleFourier(phase, {offset=0,sin=[],cos=[]}) {
  finite(phase,'phase');finite(offset,'offset');
  if(!Array.isArray(sin)||!Array.isArray(cos)||sin.length!==cos.length)throw new TypeError('coefficient arrays must have equal length');
  let value=offset,dPhase=0;
  for(let i=0;i<sin.length;i++) {const a=finite(sin[i],'sin'),b=finite(cos[i],'cos'),k=i+1;
    value+=a*Math.sin(k*phase)+b*Math.cos(k*phase);
    dPhase+=k*(a*Math.cos(k*phase)-b*Math.sin(k*phase));
  }
  return {value,dPhase};
}

/** Exact critical damping for a CONSTANT target over this step. omega is rad/s. */
export function criticalSpring(x,v,target,omega,dt) {
  [x,v,target].forEach(a=>finite(a,'state'));positive(omega,'omega');nonneg(dt,'dt');
  const y=x-target,j=v+omega*y,e=Math.exp(-omega*dt);
  return {x:target+(y+j*dt)*e,v:(v-omega*j*dt)*e};
}

export function bezier3(points,u) {
  if(!Array.isArray(points)||points.length!==4)throw new TypeError('four control points required');
  points.forEach(p=>vec(p,'control'));finite(u,'u');if(u<0||u>1)throw new RangeError('u outside [0,1]');
  const b=[(1-u)**3,3*(1-u)**2*u,3*(1-u)*u*u,u**3];
  return [0,1,2].map(j=>points.reduce((s,p,i)=>s+b[i]*p[j],0));
}

/** Discrete minimal-rotation transport, NOT the full DER or double-reflection algorithm.
 * Exact tangent reversals have no unique minimal rotation: explicitly reject.
 */
export function transportedFrames(tangents,normal0) {
  if(!Array.isArray(tangents)||!tangents.length)throw new TypeError('nonempty tangents required');vec(normal0,'normal0');
  const ts=tangents.map(t=>unit(vec(t,'tangent'))), out=[];
  let n=unit(sub(normal0,mul(ts[0],dot(normal0,ts[0]))));
  for(let i=0;i<ts.length;i++) {
    const t=ts[i];
    if(i) {const a=ts[i-1],c=clamp(dot(a,t),-1,1),ax=cross(a,t),s=norm(ax);
      if(c<-1+1e-10)throw new RangeError('antiparallel tangents: resample or supply a frame boundary');
      if(s>1e-12) {const k=mul(ax,1/s);n=add(add(mul(n,c),mul(cross(k,n),s)),mul(k,dot(k,n)*(1-c)));}
      n=unit(sub(n,mul(t,dot(n,t))));
    }
    out.push({t:[...t],n:[...n],b:unit(cross(t,n))});
  }
  return out;
}

/** A feather blade point from a supplied rachis/frame and asymmetric width.
 * This is geometry only: no barbules, optics, collisions or anatomical validation.
 */
export function featherPoint(rachis,normal,binormal,leftWidth,rightWidth,v,camber) {
  vec(rachis,'rachis');const n=unit(vec(normal,'normal')),b=unit(vec(binormal,'binormal'));
  nonneg(leftWidth,'leftWidth');nonneg(rightWidth,'rightWidth');finite(v,'v');finite(camber,'camber');
  if(v<-1||v>1||Math.abs(dot(n,b))>1e-6)throw new RangeError('invalid feather coordinates/frame');
  const w=v<0?leftWidth:rightWidth;
  return add(add(rachis,mul(n,v*w)),mul(b,camber*16*v*v*(1-Math.abs(v))**2));
}

/** Planar IK: caller constructs an anatomical 3D plane and chooses bend sign.
 * Unreachable targets return achieved position/error; lengths are never changed.
 */
export function twoBoneIK(x,y,l1,l2,bend=1) {
  finite(x,'x');finite(y,'y');positive(l1,'l1');positive(l2,'l2');
  if(bend!==1&&bend!==-1)throw new RangeError('bend must be +1 or -1');
  const r=Math.hypot(x,y),lo=Math.abs(l1-l2),hi=l1+l2,used=clamp(r,lo,hi);
  const q2=bend*Math.acos(clamp((used*used-l1*l1-l2*l2)/(2*l1*l2),-1,1));
  const q1=Math.atan2(y,x)-Math.atan2(l2*Math.sin(q2),l1+l2*Math.cos(q2));
  const elbow=[l1*Math.cos(q1),l1*Math.sin(q1)],end=[elbow[0]+l2*Math.cos(q1+q2),elbow[1]+l2*Math.sin(q1+q2)];
  return {q1,q2,elbow,end,reachable:r>=lo&&r<=hi,ambiguous:r<1e-12,error:Math.hypot(end[0]-x,end[1]-y)};
}

/** Boids-like desired ACCELERATION, not actual trajectory or collision guarantee.
 * k=null -> metric radius; k=integer -> topological subset inside supplied radius.
 * Duplicate positions require a separate contact solver, not invented random forces.
 */
export function flockSteering(self,neighbors,{radius,k=null,responseTime,separationRadius,separationWeight,alignmentWeight,cohesionWeight,maxAcceleration}) {
  vec(self.position,'position');vec(self.velocity,'velocity');positive(radius,'radius');positive(responseTime,'responseTime');
  positive(separationRadius,'separationRadius');[separationWeight,alignmentWeight,cohesionWeight,maxAcceleration].forEach(v=>nonneg(v,'gain'));
  if(!Array.isArray(neighbors))throw new TypeError('neighbors must be an array');
  if(k!==null&&(!Number.isInteger(k)||k<1))throw new RangeError('invalid k');
  let near=neighbors.map((n,i)=>{vec(n.position,'neighbor.position');vec(n.velocity,'neighbor.velocity');return {n,i,d:norm(sub(n.position,self.position))};}).filter(n=>n.d<=radius);
  if(k!==null)near=near.sort((a,b)=>a.d-b.d||a.i-b.i).slice(0,k);
  let a=[0,0,0],coincident=0;
  for(const {n,d} of near) {
    if(d<1e-12)coincident++;
    else if(d<separationRadius)a=add(a,mul(sub(self.position,n.position),separationWeight*(separationRadius-d)/(d*responseTime**2)));
  }
  if(near.length) {
    const avgV=mul(near.reduce((s,{n})=>add(s,n.velocity),[0,0,0]),1/near.length);
    const avgP=mul(near.reduce((s,{n})=>add(s,n.position),[0,0,0]),1/near.length);
    a=add(a,mul(sub(avgV,self.velocity),alignmentWeight/responseTime));
    a=add(a,mul(sub(avgP,self.position),cohesionWeight/responseTime**2));
  }
  return {acceleration:limit(a,maxAcceleration),neighborCount:near.length,coincident};
}

/** Relative linear-motion closest approach over a finite horizon; no avoidance. */
export function closestApproach(relativePosition,relativeVelocity,horizon,combinedRadius) {
  vec(relativePosition,'relativePosition');vec(relativeVelocity,'relativeVelocity');nonneg(horizon,'horizon');nonneg(combinedRadius,'combinedRadius');
  const vv=dot(relativeVelocity,relativeVelocity),t=vv<1e-20?0:clamp(-dot(relativePosition,relativeVelocity)/vv,0,horizon);
  const distance=norm(add(relativePosition,mul(relativeVelocity,t)));
  return {time:t,distance,clearance:distance-combinedRadius,risk:distance<=combinedRadius};
}

/** Coordinated level-turn approximation; not a general flapping-flight controller. */
export function bankAngle(speed,signedCurvature,gravity) {
  nonneg(speed,'speed');finite(signedCurvature,'curvature');positive(gravity,'gravity');
  return Math.atan(speed*speed*signedCurvature/gravity);
}

/** Quasi-steady one-strip magnitudes. CL/CD must come from valid polar data.
 * spanWidth and chord define area; no induced/unsteady/rotational force included.
 */
export function bladeElement({density,speed,chord,spanWidth,cl,cd}) {
  positive(density,'density');nonneg(speed,'speed');positive(chord,'chord');positive(spanWidth,'spanWidth');finite(cl,'cl');nonneg(cd,'cd');
  const q=0.5*density*speed*speed,area=chord*spanWidth;
  return {lift:q*area*cl,drag:q*area*cd};
}

/** One XPBD equality-distance projection. Not a collision or membrane solver.
 * Retain lambda across solver iterations; reset at each new time step unless
 * implementing explicit dt-aware warm starting. invMass=0 pins a point.
 */
export function xpbdDistance(a,b,invMassA,invMassB,rest,compliance,dt,lambda=0) {
  vec(a,'a');vec(b,'b');[invMassA,invMassB,rest,compliance].forEach(v=>nonneg(v,'constraint'));positive(dt,'dt');finite(lambda,'lambda');
  const d=sub(a,b),length=norm(d),C=length-rest,w=invMassA+invMassB;
  if(w===0)return {a:[...a],b:[...b],lambda,status:'PINNED',residual:C};
  if(length<1e-12)return {a:[...a],b:[...b],lambda,status:'DEGENERATE',residual:C};
  const alpha=compliance/(dt*dt),dl=(-C-alpha*lambda)/(w+alpha),n=mul(d,1/length);
  const aa=add(a,mul(n,invMassA*dl)),bb=sub(b,mul(n,invMassB*dl));
  return {a:aa,b:bb,lambda:lambda+dl,status:'PROJECTED',residual:norm(sub(aa,bb))-rest};
}
