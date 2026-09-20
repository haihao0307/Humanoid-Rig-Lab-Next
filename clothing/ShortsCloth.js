// Project-owned cloth primitives, adapted from the clothing workbench.
// All material rest measurements are original 2D pattern coordinates in metres.
// Original material coordinates are measured paper/cut UVs in metres,
// not stretched render texture coordinates. F = Ds inverse(Dm); no rest
// coordinates, triangle topology, bending angle or 3D shape target is changed.
// Formulas: Mueller et al., Strain Based Dynamics (2014), sections 3.3-3.5;
// https://matthias-research.github.io/pages/publications/strainBasedDynamics.pdf
// Macklin et al., XPBD (2016), equations 18 and 17;
// https://matthias-research.github.io/pages/publications/XPBD.pdf
const SC_STRAIN_VERSION='shorts-original-uv-metric-1';
const scStrainFail=message=>{throw Error(`assembly-strain: ${message}`);};
const scFiniteArray=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);

function scCreateMetric(triangles,particles){
  if(!Array.isArray(triangles)||!triangles.length||!Array.isArray(particles))scStrainFail('triangles and original material particles required');
  return triangles.map((triangle,triangleIndex)=>{
    const indices=Array.isArray(triangle)?triangle:triangle?.indices;
    if(!Array.isArray(indices)||indices.length!==3||new Set(indices).size!==3||indices.some(i=>!Number.isInteger(i)||!particles[i]||!scFiniteArray(particles[i].uv,2)||!scFiniteArray(particles[i].pos,3)||!Number.isFinite(particles[i].invMass)||particles[i].invMass<0))scStrainFail('invalid material triangle');
    const [a,b,c]=indices.map(i=>particles[i].uv),x=b[0]-a[0],y=b[1]-a[1],u=c[0]-a[0],v=c[1]-a[1],det=x*v-y*u;
    if(!Number.isFinite(det)||Math.abs(det)<1e-16)scStrainFail('degenerate original material triangle');
    return {version:SC_STRAIN_VERSION,triangleIndex,pieceId:triangle.pieceId??null,indices:Object.freeze([...indices]),
      gradientU:Object.freeze([(y-v)/det,v/det,-y/det]),gradientV:Object.freeze([(u-x)/det,-u/det,x/det]),
      restAreaM2:Math.abs(det)/2,lambda:[0,0,0],scratch:new Float64Array(9)};
  });
}

// Three scalar constraints have the same zero set as F^T F = I:
// |Fu|-1, |Fv|-1, and dot(Fu,Fv)/(|Fu||Fv|). The last is the
// normalized shear form, with its complete derivative (including lengths).
// The caller resets c.lambda once at the start of each integration substep.
// membraneCompliance is the inverse coefficient of area-integrated strain
// energy, NOT a distance-spring compliance silently used with a new unit.
// alpha = membraneCompliance / (original area * h^2). It is uncalibrated.
function scSolveMetric(c,particles,h,membraneCompliance=0,dofs=null){
  if(!Number.isFinite(h)||h<=0||!Number.isFinite(membraneCompliance)||membraneCompliance<0)scStrainFail('invalid step or membrane compliance');
  const alpha=membraneCompliance/(c.restAreaM2*h*h),g=c.scratch;
  // These associations stay fixed throughout one projection. Cache scalar UV
  // coefficients instead of repeatedly indexing frozen material arrays; all
  // modes still recompute the deformed gradient after the preceding correction.
  const p0=particles[c.indices[0]],p1=particles[c.indices[1]],p2=particles[c.indices[2]],a0=c.gradientU[0],a1=c.gradientU[1],a2=c.gradientU[2],b0=c.gradientV[0],b1=c.gradientV[1],b2=c.gradientV[2];
  for(let mode=0;mode<3;mode++){
    let ux=0,uy=0,uz=0,vx=0,vy=0,vz=0;
    const origin=p0.pos,one=p1.pos,two=p2.pos;
    // Preserve the original j=1 then j=2 accumulation, including its initial
    // zero, so this lookup optimization leaves floating-point results intact.
    const x1=one[0]-origin[0],y1=one[1]-origin[1],z1=one[2]-origin[2];ux+=a1*x1;uy+=a1*y1;uz+=a1*z1;vx+=b1*x1;vy+=b1*y1;vz+=b1*z1;
    const x2=two[0]-origin[0],y2=two[1]-origin[1],z2=two[2]-origin[2];ux+=a2*x2;uy+=a2*y2;uz+=a2*z2;vx+=b2*x2;vy+=b2*y2;vz+=b2*z2;
    const lu=Math.hypot(ux,uy,uz),lv=Math.hypot(vx,vy,vz);
    if(!Number.isFinite(lu)||!Number.isFinite(lv))scStrainFail('nonfinite deformed material triangle');
    // A collapsed axis has no unique length gradient. Do not invent a normal
    // or restore a target shape; the material report rejects this state.
    if(lu<1e-12||lv<1e-12)return false;
    const shear=(ux*vx+uy*vy+uz*vz)/(lu*lv),value=mode===0?lu-1:mode===1?lv-1:shear;
    let denominator=0;
    for(let j=0;j<3;j++){
      const a=j===0?a0:j===1?a1:a2,b=j===0?b0:j===1?b1:b2,p=j===0?p0:j===1?p1:p2;
      if(!Number.isFinite(p.invMass)||p.invMass<0)scStrainFail('invalid particle inverse mass');
      let au=0,av=0;
      if(mode===0)au=a/lu;
      else if(mode===1)av=b/lv;
      else {au=b/(lu*lv)-shear*a/(lu*lu);av=a/(lu*lv)-shear*b/(lv*lv);}
      const x=au*ux+av*vx,y=au*uy+av*vy,z=au*uz+av*vz;
      g[j*3]=x;g[j*3+1]=y;g[j*3+2]=z;denominator+=p.invMass*(x*x+y*y+z*z);
    }
    if(dofs){const gradients=c.dofGradients||(c.dofGradients=[[0,0,0],[0,0,0],[0,0,0]]);for(let j=0;j<3;j++)for(let k=0;k<3;k++)gradients[j][k]=g[j*3+k];const result=dofs.project(c.indices,gradients,value,{alpha,lambda:c.lambda[mode]});c.lambda[mode]=result.lambda;continue;}
    if(denominator<=1e-30)continue;
    const delta=(-value-alpha*c.lambda[mode])/(denominator+alpha);c.lambda[mode]+=delta;
    for(let j=0;j<3;j++){const p=j===0?p0:j===1?p1:p2,factor=p.invMass*delta;if(factor===0)continue;const offset=j*3;p.pos[0]+=factor*g[offset];p.pos[1]+=factor*g[offset+1];p.pos[2]+=factor*g[offset+2];}
  }
  return true;
}

// Read-only, instantaneous triangle metric. Edge strains cannot bound this on
// a skinny element: a large transverse stretch can barely change its edges.
// This intrinsic metric cannot establish orientation, self-contact or fitting.
function scMetricReport(constraints,particles){
  if(!Array.isArray(constraints)||!constraints.length)scStrainFail('material constraints required');
  let minPrincipalStretch=Infinity,maxPrincipalStretch=0,maxAbsPrincipalStrain=0,minAreaRatio=Infinity,maxAreaRatio=0,degenerateTriangleCount=0,worstTriangle=null;
  for(const c of constraints){
    let ux=0,uy=0,uz=0,vx=0,vy=0,vz=0;
    const origin=particles[c.indices[0]].pos;
    for(let j=1;j<3;j++){const p=particles[c.indices[j]].pos,a=c.gradientU[j],b=c.gradientV[j],x=p[0]-origin[0],y=p[1]-origin[1],z=p[2]-origin[2];ux+=a*x;uy+=a*y;uz+=a*z;vx+=b*x;vy+=b*y;vz+=b*z;}
    const a=ux*ux+uy*uy+uz*uz,b=ux*vx+uy*vy+uz*vz,d=vx*vx+vy*vy+vz*vz;
    if(!Number.isFinite(a)||!Number.isFinite(b)||!Number.isFinite(d))scStrainFail('nonfinite deformed material triangle');
    const disc=Math.hypot(a-d,2*b),maxEigen=(a+d+disc)/2;
    // Cross product area avoids catastrophic subtraction for thin deformed
    // triangles when evaluating the smaller eigenvalue of the 2 by 2 tensor.
    const cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx,areaSquared=cx*cx+cy*cy+cz*cz;
    const maximum=Math.sqrt(Math.max(0,maxEigen)),minimum=maximum>0?Math.sqrt(Math.max(0,areaSquared/maxEigen)):0;
    const strain=Math.max(Math.abs(minimum-1),Math.abs(maximum-1)),areaRatio=Math.sqrt(areaSquared);
    if(minimum<=1e-9)degenerateTriangleCount++;
    minPrincipalStretch=Math.min(minPrincipalStretch,minimum);maxPrincipalStretch=Math.max(maxPrincipalStretch,maximum);minAreaRatio=Math.min(minAreaRatio,areaRatio);maxAreaRatio=Math.max(maxAreaRatio,areaRatio);
    if(worstTriangle===null||strain>maxAbsPrincipalStrain){maxAbsPrincipalStrain=strain;worstTriangle={triangleIndex:c.triangleIndex,pieceId:c.pieceId,indices:[...c.indices],minimumStretch:minimum,maximumStretch:maximum,areaRatio,maxAbsPrincipalStrain:strain};}
  }
  return {version:SC_STRAIN_VERSION,method:'singular_values_of_original_uv_to_current_triangle_gradient',triangleCount:constraints.length,valid:degenerateTriangleCount===0,minPrincipalStretch,maxPrincipalStretch,maxAbsPrincipalStrain,minAreaRatio,maxAreaRatio,degenerateTriangleCount,worstTriangle,physicalCalibration:false,orientationOrContactVerified:false,reportMutatesSolverState:false};
}

// Allocation-free evaluation of the same signed-dihedral XPBD primitive used
// by cloth-bending.mjs. Shared scratch is safe for synchronous solver calls.
const scBendGradient=new Float64Array(12),scBendCorrection=new Float64Array(12);
function scSolveBending(c,particles,h,compliance,dofs=null){
  if(!Number.isFinite(h)||h<=0||!Number.isFinite(compliance)||compliance<0)throw Error('assembly-bending: invalid timestep or compliance');
  const p0=particles[c.indices[0]],p1=particles[c.indices[1]],p2=particles[c.indices[2]],p3=particles[c.indices[3]],a=p0.pos,b=p1.pos,u=p2.pos,v=p3.pos;
  const ex=v[0]-u[0],ey=v[1]-u[1],ez=v[2]-u[2],e2=ex*ex+ey*ey+ez*ez;
  const ax=u[0]-a[0],ay=u[1]-a[1],az=u[2]-a[2],bx=v[0]-a[0],by=v[1]-a[1],bz=v[2]-a[2];
  const cx=v[0]-b[0],cy=v[1]-b[1],cz=v[2]-b[2],dx=u[0]-b[0],dy=u[1]-b[1],dz=u[2]-b[2];
  const nax=ay*bz-az*by,nay=az*bx-ax*bz,naz=ax*by-ay*bx,nbx=cy*dz-cz*dy,nby=cz*dx-cx*dz,nbz=cx*dy-cy*dx;
  const na2=nax*nax+nay*nay+naz*naz,nb2=nbx*nbx+nby*nby+nbz*nbz,scale2=Math.max(e2,ax*ax+ay*ay+az*az,dx*dx+dy*dy+dz*dz);
  if(!Number.isFinite(scale2)||e2<=1e-20||na2<=1e-20*scale2*scale2||nb2<=1e-20*scale2*scale2)return false;
  const length=Math.sqrt(e2),angle=Math.atan2(((nby*naz-nbz*nay)*ex+(nbz*nax-nbx*naz)*ey+(nbx*nay-nby*nax)*ez)/length,nax*nbx+nay*nby+naz*nbz);
  const error=Math.atan2(Math.sin(angle-c.restAngle),Math.cos(angle-c.restAngle));
  const a2=(-bx*ex-by*ey-bz*ez)/length,b2=(-cx*ex-cy*ey-cz*ez)/length,a3=(ax*ex+ay*ey+az*ez)/length,b3=(dx*ex+dy*ey+dz*ez)/length;
  scBendGradient[0]=nax/na2*length;scBendGradient[1]=nay/na2*length;scBendGradient[2]=naz/na2*length;
  scBendGradient[3]=nbx/nb2*length;scBendGradient[4]=nby/nb2*length;scBendGradient[5]=nbz/nb2*length;
  scBendGradient[6]=nax/na2*a2+nbx/nb2*b2;scBendGradient[7]=nay/na2*a2+nby/nb2*b2;scBendGradient[8]=naz/na2*a2+nbz/nb2*b2;
  scBendGradient[9]=nax/na2*a3+nbx/nb2*b3;scBendGradient[10]=nay/na2*a3+nby/nb2*b3;scBendGradient[11]=naz/na2*a3+nbz/nb2*b3;
  if(dofs){const gradients=c.dofGradients||(c.dofGradients=[[0,0,0],[0,0,0],[0,0,0],[0,0,0]]);for(let i=0;i<4;i++)for(let k=0;k<3;k++)gradients[i][k]=scBendGradient[i*3+k];const result=dofs.project(c.indices,gradients,error,{alpha:compliance/(h*h),lambda:c.lambda});c.lambda=result.lambda;return result.applied;}
  let denominator=0;for(let i=0;i<4;i++){const weight=particles[c.indices[i]].invMass,j=i*3;denominator+=weight*(scBendGradient[j]*scBendGradient[j]+scBendGradient[j+1]*scBendGradient[j+1]+scBendGradient[j+2]*scBendGradient[j+2]);}
  if(denominator<=0)return false;
  const alpha=compliance/(h*h),delta=(-error-alpha*c.lambda)/(denominator+alpha);if(!Number.isFinite(delta)||!Number.isFinite(c.lambda+delta))return false;
  for(let i=0;i<4;i++){const p=particles[c.indices[i]];for(let k=0;k<3;k++){const j=i*3+k;scBendCorrection[j]=scBendGradient[j]*p.invMass*delta;if(!Number.isFinite(p.pos[k]+scBendCorrection[j]))return false;}}
  c.lambda+=delta;for(let i=0;i<4;i++)for(let k=0;k<3;k++)particles[c.indices[i]].pos[k]+=scBendCorrection[i*3+k];return true;
}

const SHORTS_CLOTH_VERSION='original-panel-shorts-cloth-5';
const scDist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],(a[2]||0)-(b[2]||0));
const scDot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const scSub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const scCross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const scClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const scEase=t=>{t=scClamp(t,0,1);return t*t*t*(10+t*(-15+6*t));};
function scRotateDirection(a,b,t,referenceNormal){
  const la=Math.hypot(...a),lb=Math.hypot(...b);if(la<1e-12||lb<1e-12)throw Error('Degenerate original waist handling edge');
  const u=a.map(v=>v/la),v=b.map(v=>v/lb),cos=scClamp(scDot(u,v),-1,1);
  if(cos>1-1e-10){const result=u.map((x,k)=>x+t*(v[k]-x)),length=Math.hypot(...result);return result.map(x=>x/length);}
  if(cos< -1+1e-10){if(!scFiniteArray(referenceNormal,3))throw Error('A half-turn waist grip requires its original material plane normal');const tangent=scCross(referenceNormal,u),length=Math.hypot(...tangent);if(length<1e-12)throw Error('Invalid source plane for waist grip rotation');return u.map((x,k)=>x*Math.cos(Math.PI*t)+tangent[k]/length*Math.sin(Math.PI*t));}
  const angle=Math.acos(cos),den=Math.sin(angle),aWeight=Math.sin((1-t)*angle)/den,bWeight=Math.sin(t*angle)/den;return u.map((x,k)=>x*aWeight+v[k]*bWeight);
}
function scClosestTriangle(p,a,b,c){
  const ab=scSub(b,a),ac=scSub(c,a),ap=scSub(p,a),d1=scDot(ab,ap),d2=scDot(ac,ap);
  if(d1<=0&&d2<=0)return {point:[...a],weights:[1,0,0]};
  const bp=scSub(p,b),d3=scDot(ab,bp),d4=scDot(ac,bp);if(d3>=0&&d4<=d3)return {point:[...b],weights:[0,1,0]};
  const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const t=d1/(d1-d3);return {point:a.map((v,k)=>v+t*ab[k]),weights:[1-t,t,0]};}
  const cp=scSub(p,c),d5=scDot(ab,cp),d6=scDot(ac,cp);if(d6>=0&&d5<=d6)return {point:[...c],weights:[0,0,1]};
  const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const t=d2/(d2-d6);return {point:a.map((v,k)=>v+t*ac[k]),weights:[1-t,0,t]};}
  const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const t=(d4-d3)/(d4-d3+d5-d6);return {point:b.map((v,k)=>v+t*(c[k]-v)),weights:[0,1-t,t]};}
  const den=va+vb+vc;if(Math.abs(den)<1e-24)return null;const v=vb/den,w=vc/den;return {point:a.map((x,k)=>x+v*ab[k]+w*ac[k]),weights:[1-v-w,v,w]};
}
function scSolveDistance(c,particles,h,compliance,target=c.rest,dofs=null){
  const a=particles[c.a],b=particles[c.b],d=scSub(b.pos,a.pos),length=Math.hypot(...d),weight=a.invMass+b.invMass;if(length<1e-12||!weight)return;
  if(dofs){const indices=c.dofIndices||(c.dofIndices=[c.a,c.b]),gradients=c.dofGradients||(c.dofGradients=[[0,0,0],[0,0,0]]);indices[0]=c.a;indices[1]=c.b;for(let k=0;k<3;k++){const normal=d[k]/length;gradients[0][k]=-normal;gradients[1][k]=normal;}const result=dofs.project(indices,gradients,length-target,{alpha:compliance/(h*h),lambda:c.lambda,tensionOnly:!!c.tensionOnly,minimumLambda:c.minimumLambda});c.lambda=result.lambda;return;}
  const alpha=compliance/(h*h),delta=(-(length-target)-alpha*c.lambda)/(weight+alpha),candidate=c.tensionOnly?Math.min(0,c.lambda+delta):c.lambda+delta,next=c.minimumLambda===undefined?candidate:Math.max(c.minimumLambda,candidate),applied=next-c.lambda;c.lambda=next;
  for(let k=0;k<3;k++){const q=d[k]/length*applied;a.pos[k]-=a.invMass*q;b.pos[k]+=b.invMass*q;}
}
function scClosestSegments(p,q,a,b){
  const u=scSub(q,p),v=scSub(b,a),w=scSub(p,a),uu=scDot(u,u),vv=scDot(v,v),uw=scDot(u,w),vw=scDot(v,w),uv=scDot(u,v);let s=0,t=0;
  if(uu<1e-20&&vv<1e-20)return {a:[...p],b:[...a],s,t};
  if(uu<1e-20)t=scClamp(vw/vv,0,1);else if(vv<1e-20)s=scClamp(-uw/uu,0,1);else{const denominator=uu*vv-uv*uv;s=denominator>1e-24?scClamp((uv*vw-uw*vv)/denominator,0,1):0;t=(uv*s+vw)/vv;if(t<0){t=0;s=scClamp(-uw/uu,0,1);}else if(t>1){t=1;s=scClamp((uv-uw)/uu,0,1);}}
  return {a:p.map((n,k)=>n+s*u[k]),b:a.map((n,k)=>n+t*v[k]),s,t};
}
class ShortsCloth {
  constructor(pattern,body,options={}){
    if(!pattern||!Array.isArray(pattern.pieces)||!pattern.pieces.length)throw Error('ShortsCloth requires original 2D pieces');
    this.pattern=pattern;this.body=body;this.options={fixedDt:1/120,substeps:2,iterations:8,contactInterleaveEvery:4,stitchDofs:false,densityKgM2:.22,gravity:9.81,groundY:0,damping:2.5,edgeCompliance:1e-9,membraneCompliance:1e-8,bendCompliance:40,seamCompliance:1e-9,waistCompliance:1e-5,handlingCompliance:.05,handlingMode:'height',thickness:.0025,sewingSeconds:3,waistSupportSeconds:2.4,selfContact:true,selfContactSweeps:2,maxSelfCandidates:12000,...options};
    this.options.waistSupportPath=options.waistSupportPath??'linear';
    this.options.sewingSchedule=options.sewingSchedule??'overlap';this.options.stageSewingSeconds=options.stageSewingSeconds??this.options.sewingSeconds*.5;this.options.handlingPolicy=options.handlingPolicy??'needle-and-time';this.options.waistSupportSlackM=options.waistSupportSlackM??0;
    this.options.maxSeamTensionN=options.maxSeamTensionN??null;if(this.options.maxSeamTensionN!==null&&(!Number.isFinite(this.options.maxSeamTensionN)||this.options.maxSeamTensionN<=0))throw Error('invalid physical thread tension limit');
    this.options.stitchJoinToleranceM=options.stitchJoinToleranceM??.0001;if(!Number.isFinite(this.options.stitchJoinToleranceM)||this.options.stitchJoinToleranceM<0||this.options.stitchJoinToleranceM>.0001)throw Error('completed source stitches require at most 0.1 mm remaining gap');
    this.options.legAssemblyWorkspaces=options.legAssemblyWorkspaces??false;if(typeof this.options.legAssemblyWorkspaces!=='boolean')throw Error('invalid leg assembly workspace option');
    this.options.handlingDamping=options.handlingDamping??null;if(this.options.handlingDamping!==null&&(!Number.isFinite(this.options.handlingDamping)||this.options.handlingDamping<0))throw Error('invalid temporary handling damping');
    this.options.needleSchedule=options.needleSchedule??'overlap';if(!['overlap','sequential'].includes(this.options.needleSchedule)||(this.options.needleSchedule==='sequential'&&!this.options.stitchDofs))throw Error('sequential source needles require persistent completed stitch DOFs');
    this.options.triangleBodyContact=options.triangleBodyContact??false;this.options.triangleBodyMaxCandidates=options.triangleBodyMaxCandidates??200000;this.options.triangleBodyMaxWitnessQueries=options.triangleBodyMaxWitnessQueries??60000;
    this.options.maxMaterialIterations=options.maxMaterialIterations??this.options.iterations;this.options.materialConvergenceStrain=options.materialConvergenceStrain??.02;
    if(!Number.isInteger(this.options.maxMaterialIterations)||this.options.maxMaterialIterations<this.options.iterations||this.options.maxMaterialIterations>512||!Number.isFinite(this.options.materialConvergenceStrain)||this.options.materialConvergenceStrain<=0||this.options.materialConvergenceStrain>.05)throw Error('invalid bounded material convergence controls');
    if(typeof this.options.triangleBodyContact!=='boolean'||(this.options.triangleBodyContact&&!body)||!Number.isInteger(this.options.triangleBodyMaxCandidates)||this.options.triangleBodyMaxCandidates<1||!Number.isInteger(this.options.triangleBodyMaxWitnessQueries)||this.options.triangleBodyMaxWitnessQueries<1)throw Error('invalid actual triangle body contact options');
    if(!Number.isFinite(this.options.waistSupportSlackM)||this.options.waistSupportSlackM<0||this.options.waistSupportSlackM>.008)throw Error('invalid narrow waist support slack');
    if(!['linear','edge-rotation'].includes(this.options.waistSupportPath))throw Error('invalid original waist handling path');
    if(!['overlap','gated'].includes(this.options.sewingSchedule)||!Number.isFinite(this.options.stageSewingSeconds)||this.options.stageSewingSeconds<=0)throw Error('invalid source sewing schedule');
    if(!['needle-and-time','until-waist-stitched'].includes(this.options.handlingPolicy)||(this.options.handlingPolicy==='until-waist-stitched'&&this.options.handlingMode!=='height'))throw Error('invalid physical material handling policy');
    if(typeof this.options.stitchDofs!=='boolean')throw Error('invalid source stitch DOF option');
    if(this.options.groundY!==null&&!Number.isFinite(this.options.groundY))throw Error('invalid cloth ground plane');
    if(!['point','height'].includes(this.options.handlingMode))throw Error('invalid temporary cloth handling mode');
    if(!Number.isInteger(this.options.contactInterleaveEvery)||this.options.contactInterleaveEvery<0)throw Error('invalid contact interleave interval');
    for(const key of ['fixedDt','densityKgM2','thickness','sewingSeconds','waistSupportSeconds'])if(!Number.isFinite(this.options[key])||this.options[key]<=0)throw Error('invalid cloth '+key);
    for(const key of ['substeps','iterations','selfContactSweeps','maxSelfCandidates'])if(!Number.isInteger(this.options[key])||this.options[key]<1)throw Error('invalid cloth '+key);
    this.particles=[];this.edges=[];this.bending=[];this.seams=[];this.pieceRanges=[];this.triangleRecords=[];this.supports=[];this.temporarySupports=[];this.events=[];this.stepIndex=0;this.time=0;this.accumulator=0;this.peakPrincipalStrain=0;this.peakEdgeStrain=0;this.bodyContacts=0;this.selfState={enabled:this.options.selfContact,candidateCount:0,unresolvedCount:0,maxPenetrationM:0,budgetExceeded:false};
    const ranges=new Map(),neighbours=[];
    for(const piece of pattern.pieces){
      const coords=piece.materialCoordinates,placement=piece.placement;if(!Array.isArray(coords)||!placement)throw Error('each original piece needs a rigid placement');
      const origin=placement.origin||placement.translation,u=placement.basisU,v=placement.basisV;
      if(!scFiniteArray(origin,3)||!scFiniteArray(u,3)||!scFiniteArray(v,3)||Math.abs(scDot(u,u)-1)>1e-8||Math.abs(scDot(v,v)-1)>1e-8||Math.abs(scDot(u,v))>1e-8)throw Error('cloth placement must be one unscaled rigid plane');
      const offset=this.particles.length,range={id:piece.id,offset,count:coords.length,triangleOffset:this.triangleRecords.length,triangleCount:piece.triangles.length};ranges.set(piece.id,range);this.pieceRanges.push(range);
      for(const uv of coords){if(!scFiniteArray(uv,2))throw Error('invalid original material coordinate');const pos=origin.map((o,k)=>o+u[k]*uv[0]+v[k]*uv[1]);this.particles.push({uv:[...uv],pos,previous:[...pos],velocity:[0,0,0],mass:0,invMass:0,freeInvMass:0,pieceId:piece.id});neighbours.push(new Set());}
      const edgeMap=new Map();
      for(const local of piece.triangles){const ids=local.map(i=>offset+i),uv=local.map(i=>coords[i]),area=Math.abs((uv[1][0]-uv[0][0])*(uv[2][1]-uv[0][1])-(uv[1][1]-uv[0][1])*(uv[2][0]-uv[0][0]))/2;if(area<1e-12)throw Error('degenerate original cloth triangle');this.triangleRecords.push({indices:ids,pieceId:piece.id});for(const i of ids)this.particles[i].mass+=area*this.options.densityKgM2/3;
        for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],opposite=ids[(k+2)%3],key=a<b?a+':'+b:b+':'+a;neighbours[a].add(b);neighbours[b].add(a);const entry=edgeMap.get(key);if(entry){this.bending.push({indices:[entry.opposite,opposite,entry.a,entry.b],restAngle:0,lambda:0});}else edgeMap.set(key,{a,b,opposite});}
      }
      for(const e of edgeMap.values())this.edges.push({a:e.a,b:e.b,rest:scDist(this.particles[e.a].uv,this.particles[e.b].uv),lambda:0});
      for(const support of piece.waistSupports||[]){const index=offset+support.index,rest=body?.waistRestSectorPoint?.(support.side,support.front,support.t,true),anchor=rest?body.createWaistAttachment(rest):null;this.supports.push({...support,index,anchor,planeNormal:scCross(u,v),lambda:[0,0,0],start:[...this.particles[index].pos]});}
      const handling=piece.handlingPoints??(!piece.id.startsWith('W')?(piece.boundaries?.waist||[]).map(index=>({index})):[]);
      for(const point of handling){const i=point.index;if(!Number.isInteger(i)||i<0||i>=coords.length)throw Error('temporary handling must reference an original material vertex');this.temporarySupports.push({index:offset+i,start:[...this.particles[offset+i].pos],lambda:[0,0,0],active:true,releaseOnNeedleOnly:point.releaseOnNeedleOnly===true,releaseWhenStitched:point.releaseWhenStitched===true});}
    }
    for(const p of this.particles){if(!(p.mass>0))throw Error('unreferenced original material vertex');p.invMass=p.freeInvMass=1/p.mass;}
    this.neighbours=neighbours;this.handlingByIndex=new Map(this.temporarySupports.map(s=>[s.index,s]));this.ranges=ranges;this.metrics=scCreateMetric(this.triangleRecords,this.particles);
    for(const seam of pattern.seams||[]){const a=ranges.get(seam.a.pieceId),b=ranges.get(seam.b.pieceId);if(!a||!b)throw Error('unknown source sewing piece');const stage=seam.stage??(/closure/i.test(seam.kind)?4:/waist|band/i.test(seam.id)?3:/outseam|side/i.test(seam.id)?2:/inseam/i.test(seam.id)?1:0);
      const pairs=seam.pairs.map(pair=>({a:a.offset+pair.a,b:b.offset+pair.b,t:pair.t??0,rest:0,lambda:0,tensionOnly:true,initialGap:null,started:false})),needleOrder=pairs.map((p,i)=>i).sort((i,j)=>pairs[i].t-pairs[j].t);for(let i=0;i<needleOrder.length;i++)pairs[needleOrder[i]].needleRank=i;this.seams.push({id:seam.id,kind:seam.kind,stage,pairs,needleOrder,needleIndex:0,needleStart:null,progress:0,start:stage*this.options.sewingSeconds*.12,duration:this.options.sewingSchedule==='gated'?this.options.stageSewingSeconds:this.options.sewingSeconds*.5});
    }
    const stages=[...new Set(this.seams.map(s=>s.stage))].sort((a,b)=>a-b);this.sewingStage={enabled:this.options.sewingSchedule==='gated',stages,index:0,activeStage:stages[0]??null,complete:!stages.length,blockedReason:null};
    if(this.sewingStage.enabled)for(const seam of this.seams)seam.start=seam.stage===stages[0]?0:Infinity;
    if(this.options.handlingPolicy==='until-waist-stitched')for(const support of this.temporarySupports){const piece=pattern.pieces.find(p=>p.id===this.particles[support.index].pieceId),waistSeam=piece.kind==='leg-panel'?this.seams.find(s=>s.id==='waist-'+piece.id):null;if(piece.kind==='leg-panel'&&!waistSeam)throw Error('A retained panel waist grip needs its actual source waistband seam');support.boundSeamId=waistSeam?.id??null;support.exactStitchRelease=true;support.releaseWhenStitched=true;support.partnerStitches=this.seams.filter(s=>!waistSeam||s===waistSeam).flatMap(seam=>seam.pairs.filter(pair=>pair.a===support.index||pair.b===support.index).map(pair=>({seam,pair,partner:pair.a===support.index?pair.b:pair.a})));if(!support.partnerStitches.length)throw Error('A retained material grip needs an actual paired source stitch');}
    this.positions=new Float32Array(this.particles.length*3);this.materialCoordinates=new Float32Array(this.particles.flatMap(p=>p.uv));this.triangles=new Uint32Array(this.triangleRecords.flatMap(t=>t.indices));this._sync();
    this.dofs=this.options.stitchDofs?createShortsStitchDofs(this.particles,{joinTolerance:this.options.stitchJoinToleranceM}):null;
    this.legAssembly=this.options.legAssemblyWorkspaces?createShortsLegAssembly(this):null;
    this.continuousContact=this.options.selfContact?createShortsContinuousContact(this.particles,this.triangleRecords,this.edges,{thickness:this.options.thickness,maxCandidates:this.options.maxSelfCandidates,dofs:this.dofs,motionLimit:true}):null;
    this.continuousHistory={detectedCrossingCount:0,uncertainCount:0,budgetExceeded:false};
    this.surfaceContact=body?new ShortsSurfaceContact(this.particles,this.triangleRecords,body,{clearanceM:this.options.thickness,toleranceM:.001,dofs:this.dofs}):null;
    this.triangleBodyContact=this.options.triangleBodyContact?new ShortsTriangleBodyContact(this.particles,this.triangleRecords,body,{clearanceM:this.options.thickness,toleranceM:.001,dofs:this.dofs,maxCandidates:this.options.triangleBodyMaxCandidates,maxWitnessQueries:this.options.triangleBodyMaxWitnessQueries}):null;this.triangleBodyScanCount=0;this.knownTriangleBodyState=null;
    this.iterationStats={substepCount:0,totalIterations:0,maximumUsed:0,hitMaximumCount:0,unconvergedAtMaximumCount:0,lastIterations:0,lastPrincipalStrain:0};
    this.events.push({type:'rigid_original_panel_placement',stepIndex:0,pieces:this.pieceRanges.map(p=>p.id)});
    this.events.push({type:'temporary_original_material_handling',stepIndex:0,mode:this.options.handlingMode,compliance:this.options.handlingCompliance,count:this.temporarySupports.length,defaultReleaseTime:this.options.sewingSeconds*.3,materialPoints:this.temporarySupports.map(s=>({pieceId:this.particles[s.index].pieceId,uv:[...this.particles[s.index].uv],releaseOnNeedleOnly:s.releaseOnNeedleOnly,releaseWhenStitched:s.releaseWhenStitched}))});
    this.events.push({type:'constraint_coupling_schedule',stepIndex:0,materialIterations:this.options.iterations,contactInterleaveEvery:this.options.contactInterleaveEvery,previousPositions:'original_substep_start'});
    this.events.push({type:'waist_edge_handling_path',stepIndex:0,method:this.options.waistSupportPath,duration:this.options.waistSupportSeconds,domain:'only_declared_original_upper_waistband_material_points',endTargets:'actual_current_body_triangle_attachments'});
    this.events.push({type:'source_sewing_stage_schedule',stepIndex:0,method:this.options.sewingSchedule,stages,duration:this.options.stageSewingSeconds,handlingPolicy:this.options.handlingPolicy,gate:'actual_closed_stitches_material_peaks_body_ground_and_cloth_contact'});
  }
  _supportTarget(s,alpha){const p=s.anchor?this.body.attachmentPosition(s.anchor,this.options.thickness,alpha):this.body?.waistSectorPoint?.(s.side,s.front,s.t,alpha,true);return p?.point||p?.position||p;}
  _pairProgress(seam,pair,time){
    if(this.options.needleSchedule!=='sequential')return scClamp(scClamp((time-seam.start)/seam.duration,0,1)*1.5-pair.t*.5,0,1);
    if(pair.needleRank<seam.needleIndex)return 1;if(pair.needleRank>seam.needleIndex)return 0;
    return scClamp((time-(seam.needleStart??seam.start))/(seam.duration/seam.pairs.length),0,1);
  }
  _seamProgress(seam,time){return this.options.needleSchedule==='sequential'?(seam.needleIndex>=seam.pairs.length?1:(seam.needleIndex+this._pairProgress(seam,seam.pairs[seam.needleOrder[seam.needleIndex]],time))/seam.pairs.length):scClamp((time-seam.start)/seam.duration,0,1);}
  _completeNeedle(seam,pair,time){if(this.options.needleSchedule!=='sequential'||pair.needleRank!==seam.needleIndex)return;seam.needleIndex++;seam.needleStart=time;seam.progress=this._seamProgress(seam,time);this.events.push({type:'original_source_needle_completed',stepIndex:this.stepIndex,time,seamId:seam.id,needleRank:pair.needleRank,indices:[pair.a,pair.b],nextNeedleRank:seam.needleIndex<seam.pairs.length?seam.needleIndex:null});}
  _applySupports(alpha,time){
    const amount=scEase(time/this.options.waistSupportSeconds);
    for(const s of this.supports){const target=this._supportTarget(s,alpha);s.lambda.fill(0);s.slackLambda=0;if(!scFiniteArray(target,3))continue;s.bodyTarget=[...target];s.target=this.options.waistSupportPath==='edge-rotation'&&amount===1?[...target]:s.start.map((v,k)=>v+amount*(target[k]-v));}
    if(this.options.waistSupportPath==='edge-rotation'&&amount>0&&amount<1){
      // These are the paths of the declared waist-edge grips. Interpolating
      // endpoint positions directly can shorten an original 32mm edge to
      // 26mm midway around the hip. Rotate each grip-to-grip direction while
      // interpolating its length, so the handling itself does not crush it.
      // Only this narrow supported boundary is moved; cloth interiors remain
      // entirely subject to original material, sewing and contact constraints.
      const groups=new Map();for(const s of this.supports){if(!s.bodyTarget)continue;const id=this.particles[s.index].pieceId;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(s);}
      for(const group of groups.values()){for(let j=1;j<group.length;j++){const previous=group[j-1],s=group[j],a=scSub(s.start,previous.start),b=scSub(s.bodyTarget,previous.bodyTarget),direction=scRotateDirection(a,b,amount,s.planeNormal),length=Math.hypot(...a)*(1-amount)+Math.hypot(...b)*amount;s.target=previous.target.map((v,k)=>v+direction[k]*length);}const translation=[0,0,0];for(const s of group)for(let k=0;k<3;k++)translation[k]+=(s.start[k]+amount*(s.bodyTarget[k]-s.start[k])-s.target[k])/group.length;for(const s of group)for(let k=0;k<3;k++)s.target[k]+=translation[k];}
    }
    // These are explicit sewing-table handling points, released before the
    // waistband joins the body; they never follow a leg or an invented shell.
    const held=time<this.options.sewingSeconds*.3;
    for(const seam of this.seams){const progress=this._seamProgress(seam,time);if(!progress)continue;for(const pair of seam.pairs){const closureProgress=this._pairProgress(seam,pair,time);if(!closureProgress)continue;const gap=scDist(this.particles[pair.a].pos,this.particles[pair.b].pos);for(const index of [pair.a,pair.b])for(const touched of [index,...this.neighbours[index]]){const s=this.handlingByIndex.get(touched);if(s&&!s.releasedForNeedle){if((s.boundSeamId&&s.boundSeamId!==seam.id)||(s.exactStitchRelease&&touched!==pair.a&&touched!==pair.b))continue;if(s.releaseWhenStitched&&(!pair.started||closureProgress<1||gap>2*this.options.thickness||(this.dofs&&!this.dofs.same(pair.a,pair.b))))continue;s.releasedForNeedle=true;this.events.push({type:s.releaseWhenStitched?'release_original_handling_for_closed_stitch':'release_original_handling_for_started_stitch',stepIndex:this.stepIndex,seamId:seam.id,pieceId:this.particles[touched].pieceId,materialCoordinate:[...this.particles[touched].uv],closureProgress,gapM:gap});}}}}
    for(const s of this.temporarySupports){s.active=(held||s.releaseOnNeedleOnly||s.releaseWhenStitched)&&!s.releasedForNeedle;s.lambda.fill(0);s.targetHeight=s.start[1];if(s.partnerStitches){let sum=0;for(const {seam,pair,partner} of s.partnerStitches){const amount=scEase(this._pairProgress(seam,pair,time));sum+=s.start[1]+amount*(this.particles[partner].pos[1]-s.start[1]);}s.targetHeight=sum/s.partnerStitches.length;}}
    if(!held&&!this.temporaryReleased){this.temporaryReleased=true;this.events.push({type:'release_original_waist_handling',stepIndex:this.stepIndex,count:this.temporarySupports.filter(s=>!s.releaseOnNeedleOnly&&!s.releaseWhenStitched).length});}
  }
  _solveSupports(h){
    // Cloth retains physical mass. Waist-edge attachments compete with the
    // original material metric instead of teleporting fixed cloth vertices.
    const alpha=this.options.waistCompliance/(h*h);
    for(const s of this.supports){if(!s.target)continue;const p=this.particles[s.index];if(this.options.waistSupportSlackM>0){const delta=scSub(p.pos,s.target),length=Math.hypot(...delta);if(length<1e-12)continue;const normal=delta.map(v=>v/length),value=length-this.options.waistSupportSlackM,lambda=s.slackLambda||0;if(this.dofs)s.slackLambda=this.dofs.project([s.index],[normal],value,{alpha,lambda,tensionOnly:true}).lambda;else{const next=Math.min(0,lambda+(-value-alpha*lambda)/(p.invMass+alpha)),applied=next-lambda;s.slackLambda=next;for(let k=0;k<3;k++)p.pos[k]+=p.invMass*applied*normal[k];}continue;}for(let k=0;k<3;k++){if(this.dofs){const normal=[0,0,0];normal[k]=1;s.lambda[k]=this.dofs.project([s.index],[normal],p.pos[k]-s.target[k],{alpha,lambda:s.lambda[k]}).lambda;}else{const delta=(-(p.pos[k]-s.target[k])-alpha*s.lambda[k])/(p.invMass+alpha);s.lambda[k]+=delta;p.pos[k]+=p.invMass*delta;}}}
    const handlingAlpha=this.options.handlingCompliance/(h*h);
    for(const s of this.temporarySupports){if(!s.active)continue;const p=this.particles[s.index];for(let k=0;k<3;k++){if(this.options.handlingMode==='height'&&k!==1)continue;const target=k===1&&s.targetHeight!==undefined?s.targetHeight:s.start[k];if(this.dofs){const normal=[0,0,0];normal[k]=1;s.lambda[k]=this.dofs.project([s.index],[normal],p.pos[k]-target,{alpha:handlingAlpha,lambda:s.lambda[k]}).lambda;}else{const delta=(-(p.pos[k]-target)-handlingAlpha*s.lambda[k])/(p.invMass+handlingAlpha);s.lambda[k]+=delta;p.pos[k]+=p.invMass*delta;}}}
    this.legAssembly?.solve(h);
  }
  _bodyContact(alpha){
    for(let index=0;index<this.particles.length;index++){const p=this.particles[index];if(!p.invMass)continue;
      if(this.body){const proof=p.bodyFreeBall,versionedPose=Number.isFinite(this.body.poseVersion)&&Number.isFinite(this.body.alpha),unchangedPose=!!proof&&(versionedPose?proof.poseVersion===this.body.poseVersion&&proof.alpha===this.body.alpha:proof.epoch===this.contactEpoch),insideFreeBall=unchangedPose&&scDist(p.pos,proof.origin)+this.options.thickness<proof.radius;
        // Distance to the complete body surface is 1-Lipschitz. Inside this
        // certified exterior ball a particle cannot contact any body face.
        // A changed body pose or interpolation invalidates the certificate.
        // Exactly stationary body geometry permits reuse across substeps.
        if(!insideFreeBall){const point=this.dofs?(p.bodyDofContactPoint??=[...p.pos]):p.pos;if(this.dofs)for(let k=0;k<3;k++)point[k]=p.pos[k];const hit=this.body.projectPoint?this.body.projectPoint(point,p.previous,this.options.thickness,alpha):this.body.project?.(point,this.options.thickness,alpha);if(hit?.sideUncertain){p.bodyFreeBall=null;}else if(hit&&(hit.depth>0||hit.penetration>0)){if(this.dofs){const delta=scSub(point,p.pos),length=Math.hypot(...delta);if(length>0)this.dofs.project([index],[delta.map(v=>v/length)],-length);}this.bodyContacts++;p.bodyFreeBall=null;}else if(hit&&hit.signedDistance>=this.options.thickness&&Number.isFinite(hit.distance))p.bodyFreeBall={epoch:this.contactEpoch,poseVersion:this.body.poseVersion,alpha:this.body.alpha,origin:[...p.pos],radius:hit.distance};else p.bodyFreeBall=null;}
      }
      if(this.options.groundY!==null&&p.pos[1]<this.options.groundY+this.options.thickness){if(this.dofs)this.dofs.project([index],[[0,1,0]],p.pos[1]-this.options.groundY-this.options.thickness);else p.pos[1]=this.options.groundY+this.options.thickness;}
    }
  }
  _selfCandidates(){
    const contactTriangles=this.contactTriangleRecords||this.triangleRecords;
    const particleIndices=this.contactParticleIndices||Array.from({length:this.particles.length},(_,i)=>i);
    const size=.04,pad=this.options.thickness,grid=new Map(),key=(x,y,z)=>x+','+y+','+z;let exceeded=false;
    for(let ti=0;ti<contactTriangles.length;ti++){const points=contactTriangles[ti].indices.map(i=>this.particles[i].pos),lo=[0,1,2].map(k=>Math.floor((Math.min(...points.map(p=>p[k]))-pad)/size)),hi=[0,1,2].map(k=>Math.floor((Math.max(...points.map(p=>p[k]))+pad)/size));if((hi[0]-lo[0]+1)*(hi[1]-lo[1]+1)*(hi[2]-lo[2]+1)>1000){exceeded=true;continue;}
      for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){const hash=key(x,y,z);if(!grid.has(hash))grid.set(hash,[]);grid.get(hash).push(ti);}}
    // A started stitch becomes a local topological neighbour only when the
    // original endpoints have actually reached the narrow seam neighbourhood.
    // A long loose thread cannot exempt its two distant incident cloth faces.
    const stitchGraph=new Map();for(const seam of this.seams)for(const pair of seam.pairs)if(pair.started&&scDist(this.particles[pair.a].pos,this.particles[pair.b].pos)<=2*this.options.thickness){if(!stitchGraph.has(pair.a))stitchGraph.set(pair.a,new Set());if(!stitchGraph.has(pair.b))stitchGraph.set(pair.b,new Set());stitchGraph.get(pair.a).add(pair.b);stitchGraph.get(pair.b).add(pair.a);}
    // Four original crotch corners (and waistband seam junctions) remain
    // separate material vertices. Their actually sewn local equivalence is
    // transitive, while every queried endpoint pair still obeys the narrow
    // spatial bound; a chain cannot exempt a remote region of cloth.
    const seamMates=new Map(),visited=new Set();for(const start of stitchGraph.keys()){if(visited.has(start))continue;const component=[start];visited.add(start);for(let q=0;q<component.length;q++)for(const next of stitchGraph.get(component[q])||[])if(!visited.has(next)){visited.add(next);component.push(next);}for(const a of component)for(const b of component)if(a!==b&&scDist(this.particles[a].pos,this.particles[b].pos)<=2*this.options.thickness){if(!seamMates.has(a))seamMates.set(a,new Set());seamMates.get(a).add(b);}}
    const result=[];
    for(const i of particleIndices){const p=this.particles[i].pos,cell=grid.get(key(...p.map(v=>Math.floor(v/size))))||[];for(const ti of cell){const ids=contactTriangles[ti].indices;if(ids.some(j=>j===i||seamMates.get(i)?.has(j)))continue;result.push({i,ti});if(result.length>=this.options.maxSelfCandidates){exceeded=true;break;}}if(exceeded)break;}
    this._contactSeamMates=seamMates;return {result,exceeded};
  }
  _selfEdgeContact(project,budget){
    const contactEdges=this.contactEdges||this.edges;
    const cell=.04,pad=this.options.thickness,grid=new Map(),seen=new Set();let count=0,unresolved=0,maxPenetration=0,crossings=0,ambiguous=0,exceeded=false;
    for(let ei=0;ei<contactEdges.length;ei++){const edge=contactEdges[ei],ps=[this.particles[edge.a].pos,this.particles[edge.b].pos],lo=[0,1,2].map(k=>Math.floor((Math.min(ps[0][k],ps[1][k])-pad)/cell)),hi=[0,1,2].map(k=>Math.floor((Math.max(ps[0][k],ps[1][k])+pad)/cell));if((hi[0]-lo[0]+1)*(hi[1]-lo[1]+1)*(hi[2]-lo[2]+1)>1000){exceeded=true;continue;}
      for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){const key=x+','+y+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(ei);}}
    outer:for(const list of grid.values())for(let a=0;a<list.length;a++)for(let b=a+1;b<list.length;b++){
      const ia=list[a],ib=list[b],key=ia<ib?ia+':'+ib:ib+':'+ia;if(seen.has(key))continue;seen.add(key);const ea=contactEdges[ia],eb=contactEdges[ib],ids=[ea.a,ea.b,eb.a,eb.b];
      if(ids.slice(0,2).some(i=>ids.slice(2).some(j=>i===j||this._contactSeamMates?.get(i)?.has(j))))continue;
      if(++count>budget){exceeded=true;break outer;}const p=ids.map(i=>this.particles[i]),closest=scClosestSegments(...p.map(v=>v.pos)),delta=scSub(closest.a,closest.b),distance=Math.hypot(...delta);if(distance>pad*1.5)continue;
      const previous=scClosestSegments(...p.map(v=>v.previous)),oldDelta=scSub(previous.a,previous.b),oldDistance=Math.hypot(...oldDelta);if(distance<1e-12&&oldDistance<1e-12){ambiguous++;unresolved++;maxPenetration=Math.max(maxPenetration,pad);continue;}
      const crossed=oldDistance>1e-12&&scDot(delta,oldDelta)<0,normal=(crossed||distance<1e-12)?oldDelta.map(v=>v/oldDistance):delta.map(v=>v/distance),gap=crossed?-distance:distance,penetration=pad-gap;
      if(crossed)crossings++;if(penetration<=1e-6)continue;unresolved++;maxPenetration=Math.max(maxPenetration,penetration);
      if(project){const weights=[1-closest.s,closest.s,-(1-closest.t),-closest.t];if(this.dofs)this.dofs.project(ids,weights.map(w=>normal.map(v=>w*v)),-penetration);else{const den=p.reduce((sum,v,k)=>sum+v.invMass*weights[k]**2,0);if(den>0){const scale=penetration/den;for(let j=0;j<4;j++)for(let k=0;k<3;k++)p[j].pos[k]+=p[j].invMass*weights[j]*scale*normal[k];}}}
    }
    return {count,unresolved,maxPenetration,crossings,ambiguous,exceeded};
  }
  _selfContact(project=true){
    if(!this.options.selfContact)return;const contactTriangles=this.contactTriangleRecords||this.triangleRecords;const candidates=this._selfCandidates();let unresolved=0,maxPenetration=0,crossings=0;
    for(const {i,ti} of candidates.result){const p=this.particles[i],ids=contactTriangles[ti].indices,points=ids.map(j=>this.particles[j].pos),closest=scClosestTriangle(p.pos,...points);if(!closest)continue;const delta=scSub(p.pos,closest.point),distance=Math.hypot(...delta);if(distance>this.options.thickness*1.5)continue;
      const oldClosest=scClosestTriangle(p.previous,...ids.map(j=>this.particles[j].previous)),normal=scCross(scSub(points[1],points[0]),scSub(points[2],points[0])),nLength=Math.hypot(...normal);if(nLength<1e-12)continue;for(let k=0;k<3;k++)normal[k]/=nLength;
      const previousSide=oldClosest?scDot(scSub(p.previous,oldClosest.point),normal):scDot(delta,normal),sign=previousSide<0?-1:1;let gap=scDot(delta,normal)*sign;
      if(distance>1e-9&&gap>=0){for(let k=0;k<3;k++)normal[k]=delta[k]/distance;gap=distance;}else for(let k=0;k<3;k++)normal[k]*=sign;
      if(gap<0)crossings++;const penetration=this.options.thickness-gap;if(penetration<=1e-6)continue;unresolved++;maxPenetration=Math.max(maxPenetration,penetration);
      if(project){if(this.dofs)this.dofs.project([i,...ids],[normal,...closest.weights.map(w=>normal.map(v=>-w*v))],-penetration);else{const denominator=p.invMass+ids.reduce((s,j,k)=>s+this.particles[j].invMass*closest.weights[k]**2,0);if(denominator>0){const scale=penetration/denominator;for(let k=0;k<3;k++){p.pos[k]+=p.invMass*scale*normal[k];ids.forEach((j,q)=>{this.particles[j].pos[k]-=this.particles[j].invMass*closest.weights[q]*scale*normal[k];});}}}}
    }
    const edges=this._selfEdgeContact(project,Math.max(0,this.options.maxSelfCandidates-candidates.result.length));
    this.selfState={enabled:true,method:'bounded_spatial_hash_vertex_face_and_edge_edge',candidateCount:candidates.result.length+edges.count,vertexFaceCandidateCount:candidates.result.length,edgeEdgeCandidateCount:edges.count,unresolvedCount:unresolved+edges.unresolved,maxPenetrationM:Math.max(maxPenetration,edges.maxPenetration),crossingCandidates:crossings+edges.crossings,ambiguousEdgeCount:edges.ambiguous,budgetExceeded:candidates.exceeded||edges.exceeded,edgeEdgeImplemented:true,seamExclusionRule:'only_started_source_stitch_endpoint_neighbours',seamPairExclusionCount:[...this._contactSeamMates.values()].reduce((sum,s)=>sum+s.size,0)/2,continuousCollisionGuaranteed:false};
  }
  _sweptSelfContact(){
    if(!this.continuousContact)return;
    const state=this.continuousContact.solve({seamMates:this._contactSeamMates,neighbours:this.neighbours});
    this.continuousHistory.detectedCrossingCount+=state.detectedCrossingCount;
    this.continuousHistory.uncertainCount+=state.uncertainCount;
    this.continuousHistory.budgetExceeded||=state.budgetExceeded;
  }
  _coupledContact(alpha,fullTriangleBodyScan=false){this._selfContact(true);this._bodyContact(alpha);this.surfaceContact?.solve(alpha);if(this.triangleBodyContact){if(fullTriangleBodyScan){this.triangleBodyContact.solve(alpha);this.triangleBodyScanCount++;}else this.knownTriangleBodyState=this.triangleBodyContact.projectKnown(alpha);}this._sweptSelfContact();}
  _advanceSewingStage(material){
    const state=this.sewingStage;if(!state.enabled||state.complete)return;
    const active=this.seams.filter(s=>s.stage===state.activeStage);
    if(active.some(s=>s.progress!==1||s.pairs.some(p=>!p.started||scDist(this.particles[p.a].pos,this.particles[p.b].pos)>=.004||(this.dofs&&!this.dofs.same(p.a,p.b))))){state.blockedReason='active_source_seams_not_closed';return;}
    if(!material.valid||material.maxAbsPrincipalStrain>.05||this.peakPrincipalStrain>.05){state.blockedReason='original_material_or_history_failed';return;}
    const swept=this.continuousContact?.report();
    if(!this.options.selfContact||this.selfState.budgetExceeded||this.selfState.unresolvedCount||!swept||swept.unresolvedCount||swept.uncertainCount||swept.budgetExceeded||this.continuousHistory.uncertainCount||this.continuousHistory.budgetExceeded){state.blockedReason='actual_cloth_contact_failed';return;}
    if(this.options.groundY!==null&&this.particles.some(p=>p.pos[1]<this.options.groundY+this.options.thickness-1e-6)){state.blockedReason='actual_ground_contact_failed';return;}
    if(!this.surfaceContact?.report(1).passed){state.blockedReason='actual_body_contact_failed';return;}
    if(this.triangleBodyContact&&!this.triangleBodyContact.report(1).passed){state.blockedReason='actual_body_triangle_contact_failed';return;}
    this.events.push({type:'source_sewing_stage_completed',stepIndex:this.stepIndex,time:this.time,stage:state.activeStage,criteria:'closed_actual_stitches_original_material_and_contact'});state.index++;
    if(state.index>=state.stages.length){state.complete=true;state.activeStage=null;state.blockedReason=null;return;}
    state.activeStage=state.stages[state.index];state.blockedReason=null;for(const seam of this.seams)if(seam.stage===state.activeStage)seam.start=this.time;
    this.events.push({type:'source_sewing_stage_started',stepIndex:this.stepIndex,time:this.time,stage:state.activeStage});
  }
  _fixedStep(alphaStart=0,alphaEnd=1){
    const h=this.options.fixedDt/this.options.substeps;
    for(let sub=0;sub<this.options.substeps;sub++){const alpha=alphaStart+(alphaEnd-alphaStart)*(sub+1)/this.options.substeps,time=this.time+h*(sub+1);this.body?.sample?.(alpha);this.contactEpoch=(this.contactEpoch||0)+1;
      const dampingRate=this.options.handlingDamping!==null&&(this.temporarySupports.some(s=>s.active)||this.legAssembly?.hasActive())?this.options.handlingDamping:this.options.damping;
      if(this.activeDampingRate!==dampingRate){this.activeDampingRate=dampingRate;this.events.push({type:'physical_handling_damping',stepIndex:this.stepIndex,ratePerSecond:dampingRate,temporaryMaterialGripsActive:this.temporarySupports.some(s=>s.active)});}
      if(this.dofs)this.dofs.beginStep(h,{gravity:[0,-this.options.gravity,0],damping:dampingRate});else for(const p of this.particles){p.previous=[...p.pos];if(p.invMass){p.velocity[1]-=this.options.gravity*h;const damping=Math.exp(-dampingRate*h);for(let k=0;k<3;k++){p.velocity[k]*=damping;p.pos[k]+=p.velocity[k]*h;}}}
      this._applySupports(alpha,time);for(const c of this.edges)c.lambda=0;for(const c of this.bending)c.lambda=0;for(const c of this.metrics)c.lambda.fill(0);
      for(const seam of this.seams){seam.progress=this._seamProgress(seam,time);for(const c of seam.pairs)c.lambda=0;}
      let iterationLimit=this.options.iterations,iterationsUsed=0,triangleBodyScanned=false,lastCoupledIteration=0;
      for(let iteration=0;iteration<iterationLimit;iteration++){
        this._solveSupports(h);
        for(const c of this.bending)scSolveBending(c,this.particles,h,this.options.bendCompliance,this.dofs);
        for(const seam of this.seams)if(seam.progress>0)for(const c of seam.pairs){const progress=this._pairProgress(seam,c,time);if(!progress)continue;if(c.initialGap===null){c.initialGap=scDist(this.particles[c.a].pos,this.particles[c.b].pos);c.started=true;}if(this.dofs?.same(c.a,c.b)){if(progress===1)this._completeNeedle(seam,c,time);continue;}c.minimumLambda=this.options.maxSeamTensionN===null?undefined:-this.options.maxSeamTensionN*h*h;scSolveDistance(c,this.particles,h,this.options.seamCompliance,c.initialGap*(1-scEase(progress)),this.dofs);if(this.dofs&&progress===1&&this.dofs.join(c.a,c.b,{started:c.started,closureProgress:progress,requirePreviousClosure:true})){c.lambda=0;this.events.push({type:'complete_source_stitch_spatial_equality',stepIndex:this.stepIndex,seamId:seam.id,indices:[c.a,c.b],originalMaterialCoordinates:[[...this.particles[c.a].uv],[...this.particles[c.b].uv]]});this._completeNeedle(seam,c,time);}}
        for(const c of this.edges)scSolveDistance(c,this.particles,h,this.options.edgeCompliance,c.rest,this.dofs);
        for(const c of this.metrics)scSolveMetric(c,this.particles,h,this.options.membraneCompliance,this.dofs);
        this._bodyContact(alpha);
        const coupled=this.options.contactInterleaveEvery>0&&(iteration+1)%this.options.contactInterleaveEvery===0;
        if(coupled){this._coupledContact(alpha,iteration+1===this.options.iterations);lastCoupledIteration=iteration+1;if(iteration+1===this.options.iterations&&this.triangleBodyContact)triangleBodyScanned=true;}
        if(iteration+1===this.options.iterations&&this.triangleBodyContact&&!triangleBodyScanned){this._coupledContact(alpha,true);triangleBodyScanned=true;lastCoupledIteration=iteration+1;}
        iterationsUsed=iteration+1;
        // All original substep histories and XPBD multipliers stay live. The
        // complete discovery pass happens at the base budget so its corrections
        // enter this same material convergence loop, followed by known witnesses.
        if(iterationsUsed===iterationLimit&&iterationLimit<this.options.maxMaterialIterations&&scMetricReport(this.metrics,this.particles).maxAbsPrincipalStrain>this.options.materialConvergenceStrain)iterationLimit=Math.min(this.options.maxMaterialIterations,iterationLimit+8);
      }
      // Keep the original substep previous positions throughout all material,
      // body and cloth corrections. Swept contacts must see the entire actual
      // trajectory, including a stitch pulling a panel through another panel.
      if(this.options.contactInterleaveEvery===0){for(let pass=triangleBodyScanned?1:0;pass<this.options.selfContactSweeps;pass++)this._coupledContact(alpha,!triangleBodyScanned&&pass+1===this.options.selfContactSweeps);}
      else if(lastCoupledIteration!==iterationsUsed)this._coupledContact(alpha,!triangleBodyScanned);
      this._bodyContact(alpha);
      // The final body/ground projection is also a motion of cloth. Run CCD
      // after it, before accepting positions as the next substep history.
      this._sweptSelfContact();this._selfContact(false);
      const finalSubstepStrain=scMetricReport(this.metrics,this.particles).maxAbsPrincipalStrain,stats=this.iterationStats;stats.substepCount++;stats.totalIterations+=iterationsUsed;stats.maximumUsed=Math.max(stats.maximumUsed,iterationsUsed);stats.lastIterations=iterationsUsed;stats.lastPrincipalStrain=finalSubstepStrain;if(iterationsUsed===this.options.maxMaterialIterations){stats.hitMaximumCount++;if(finalSubstepStrain>this.options.materialConvergenceStrain)stats.unconvergedAtMaximumCount++;}
      if(this.dofs)this.dofs.endStep(h);else for(const p of this.particles)for(let k=0;k<3;k++){if(!Number.isFinite(p.pos[k]))throw Error('nonfinite cloth particle');p.velocity[k]=p.invMass?(p.pos[k]-p.previous[k])/h:0;}
    }
    this.time+=this.options.fixedDt;this.stepIndex++;const material=scMetricReport(this.metrics,this.particles);this.peakPrincipalStrain=Math.max(this.peakPrincipalStrain,material.maxAbsPrincipalStrain);for(const e of this.edges)this.peakEdgeStrain=Math.max(this.peakEdgeStrain,Math.abs(scDist(this.particles[e.a].pos,this.particles[e.b].pos)/e.rest-1));this._advanceSewingStage(material);
  }
  advance(dt){if(!Number.isFinite(dt)||dt<0)throw Error('invalid cloth elapsed time');this.accumulator+=Math.min(dt,.1);const steps=Math.min(12,Math.floor(this.accumulator/this.options.fixedDt));for(let i=0;i<steps;i++){this._fixedStep(i/steps,(i+1)/steps);this.accumulator-=this.options.fixedDt;}this._sync();return steps;}
  assemble({maxSteps=420}={}){if(!Number.isInteger(maxSteps)||maxSteps<0||maxSteps>1200)throw Error('invalid bounded assembly steps');const start=typeof performance!=='undefined'?performance.now():Date.now();for(let i=0;i<maxSteps;i++)this._fixedStep(1,1);this._sync();const report=this.report();return {...report,assemblySteps:maxSteps,wallTimeMs:(typeof performance!=='undefined'?performance.now():Date.now())-start};}
  step(count=1){for(let i=0;i<count;i++)this._fixedStep(1,1);this._sync();return this;}
  _sync(){for(let i=0;i<this.particles.length;i++)this.positions.set(this.particles[i].pos,i*3);}
  report(){
    const material=scMetricReport(this.metrics,this.particles),maxEdgeStrain=Math.max(...this.edges.map(e=>Math.abs(scDist(this.particles[e.a].pos,this.particles[e.b].pos)/e.rest-1))),seams=this.seams.map(s=>({id:s.id,kind:s.kind,progress:s.progress,startedPairCount:s.pairs.filter(p=>p.started).length,pairCount:s.pairs.length,needleSchedule:this.options.needleSchedule,completedNeedleCount:this.options.needleSchedule==='sequential'?s.needleIndex:null,activeNeedleRank:this.options.needleSchedule==='sequential'&&s.needleIndex<s.pairs.length?s.needleIndex:null,maxExplicitThreadTensionN:Math.max(0,...s.pairs.map(p=>-p.lambda/(this.options.fixedDt/this.options.substeps)**2)),maxGapM:Math.max(0,...s.pairs.map(p=>scDist(this.particles[p.a].pos,this.particles[p.b].pos)))}));
    const surfaceContact=this.surfaceContact?.report(1),triangleBodyContact=this.triangleBodyContact?.report(1)??{enabled:false},triangleBodyValid=!this.triangleBodyContact||triangleBodyContact.passed,bodyPenetrationM=Math.max(surfaceContact?.maxResidualM??0,triangleBodyContact.maxResidualM??0);
    const swept=this.continuousContact?.report(),sweptValid=!!swept&&!swept.budgetExceeded&&swept.uncertainCount===0&&swept.unresolvedCount===0&&!this.continuousHistory.budgetExceeded&&this.continuousHistory.uncertainCount===0;
    const sewn=seams.length>0&&seams.every(s=>s.progress===1&&s.maxGapM<.004)&&(!this.dofs||this.seams.every(s=>s.pairs.every(p=>this.dofs.same(p.a,p.b)))),materialValid=material.valid&&material.maxAbsPrincipalStrain<=.05&&this.peakPrincipalStrain<=.05,selfContactValid=this.options.selfContact&&!this.selfState.budgetExceeded&&this.selfState.unresolvedCount===0&&sweptValid,waistGapM=Math.max(0,...this.supports.filter(s=>s.bodyTarget).map(s=>scDist(this.particles[s.index].pos,s.bodyTarget))),waistSupportsActive=this.supports.length>0&&this.supports.every(s=>s.bodyTarget),ground={enabled:this.options.groundY!==null,heightM:this.options.groundY,maxPenetrationM:this.options.groundY===null?0:Math.max(0,...this.particles.map(p=>this.options.groundY+this.options.thickness-p.pos[1]))};
    return {version:SHORTS_CLOTH_VERSION,time:this.time,stepIndex:this.stepIndex,particleCount:this.particles.length,triangleCount:this.triangleRecords.length,source:'original_2d_pattern_only',restCoordinatesMutated:false,legSkinning:false,targetGarmentShape:false,seams,sewn,stitchDofs:this.dofs?.report()??{enabled:false},sewingStage:{...this.sewingStage,stages:[...this.sewingStage.stages]},material,materialIterationStats:{...this.iterationStats,minimumIterations:this.options.iterations,maximumIterations:this.options.maxMaterialIterations,convergenceTarget:this.options.materialConvergenceStrain},maxEdgeStrain,peakEdgeStrain:this.peakEdgeStrain,peakPrincipalStrain:this.peakPrincipalStrain,peakSampling:'fixed_step_endpoints',bodyPenetrationM,bodyContactEnabled:!!this.body,bodyContactSampling:'vertices_unique_edge_midpoints_triangle_centroids_finite',bodyContactProjectionCount:this.bodyContacts+(surfaceContact?.projectionCount??0),surfaceContact,triangleBodyContact,triangleBodyContactSchedule:{enabled:!!this.triangleBodyContact,knownOnlyBetweenMaterialIterations:true,fullScanCount:this.triangleBodyScanCount,fullScansPerSubstep:this.triangleBodyContact?1:0,lastKnownState:this.knownTriangleBodyState},ground,selfContact:{...this.selfState,swept,sweptHistory:{...this.continuousHistory}},waistSupportCount:this.supports.length,waistSupportsActive:!!waistSupportsActive,waistSupportMethod:'original_waist_edge_compliant_attachments',waistGapM,temporarySupportCount:this.temporarySupports.filter(s=>s.active).length+(this.legAssembly?.report().activeConstraintCount??0),legAssembly:this.legAssembly?.report()??{enabled:false},engineeringCriteriaMet:(!this.legAssembly||!this.legAssembly.hasActive())&&!!this.body&&surfaceContact?.passed&&triangleBodyValid&&this.temporarySupports.every(s=>!s.active)&&waistSupportsActive&&sewn&&materialValid&&waistGapM<=.008&&bodyPenetrationM<=.001&&ground.maxPenetrationM<=1e-6&&selfContactValid,physicalCalibration:false,fitAccepted:false,limitations:['uncalibrated_fabric','floating_point_cloth_ccd_with_explicit_uncertainty','finite_body_surface_samples_not_complete_triangle_certificate','sewing_around_body_not_dressing_validation']};
  }
  snapshot(){return {
    version:SHORTS_CLOTH_VERSION,purpose:'original_material_audit_and_render_snapshot',resumable:false,stepIndex:this.stepIndex,time:this.time,options:{...this.options},
    pieces:this.pieceRanges.map(r=>({id:r.id,materialCoordinates:this.particles.slice(r.offset,r.offset+r.count).map(p=>[...p.uv]),positions:this.particles.slice(r.offset,r.offset+r.count).map(p=>[...p.pos]),previousPositions:this.particles.slice(r.offset,r.offset+r.count).map(p=>[...p.previous]),velocities:this.particles.slice(r.offset,r.offset+r.count).map(p=>[...p.velocity]),masses:this.particles.slice(r.offset,r.offset+r.count).map(p=>p.mass),triangles:this.triangleRecords.slice(r.triangleOffset,r.triangleOffset+r.triangleCount).map(t=>t.indices.map(i=>i-r.offset))})),
    seamState:this.seams.map(s=>({id:s.id,progress:s.progress,stage:s.stage,start:Number.isFinite(s.start)?s.start:null,startPending:!Number.isFinite(s.start),duration:s.duration,needleIndex:s.needleIndex,needleOrder:[...s.needleOrder],needleStart:s.needleStart,pairs:s.pairs.map(p=>({a:p.a,b:p.b,t:p.t,started:p.started,initialGap:p.initialGap,needleRank:p.needleRank,closureProgress:this._pairProgress(s,p,this.time)}))})),
    waistHandling:this.supports.map(s=>({index:s.index,pieceId:this.particles[s.index].pieceId,materialCoordinate:[...this.particles[s.index].uv],startPosition:[...s.start],currentTarget:s.target?[...s.target]:null,bodyTarget:s.bodyTarget?[...s.bodyTarget]:null,anchor:s.anchor?JSON.parse(JSON.stringify(s.anchor)):null})),
    temporaryHandling:this.temporarySupports.map(s=>({index:s.index,pieceId:this.particles[s.index].pieceId,materialCoordinate:[...this.particles[s.index].uv],active:s.active,releasedForNeedle:s.releasedForNeedle===true,exactStitchRelease:s.exactStitchRelease===true,releaseWhenStitched:s.releaseWhenStitched,releaseOnNeedleOnly:s.releaseOnNeedleOnly,startPosition:[...s.start],heightResidualM:this.particles[s.index].pos[1]-s.start[1],targetHeightM:s.targetHeight??s.start[1],currentHoldingResidualM:this.particles[s.index].pos[1]-(s.targetHeight??s.start[1]),boundSeamId:s.boundSeamId??null,pairedStitches:this.seams.flatMap(seam=>seam.pairs.filter(p=>p.a===s.index||p.b===s.index).map(p=>({seamId:seam.id,started:p.started,closureProgress:this._pairProgress(seam,p,this.time),gapM:scDist(this.particles[p.a].pos,this.particles[p.b].pos)})))})),
    events:JSON.parse(JSON.stringify(this.events)),report:this.report()
  };}
}
