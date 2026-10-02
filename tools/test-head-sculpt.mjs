import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

// Sample the actual authored map, including space around the head. Numerical
// validity is independent of whether the resulting character looks good.
const source=readFileSync(new URL('../body/HeadSculpt.js',import.meta.url),'utf8');
const api=vm.runInNewContext(source+'\n({warp:compactHeadSculptPoint,config:HEAD_SCULPT})');
const strokes=api.config.strokes,identity=[[1,0,0],[0,1,0],[0,0,1]],failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message);};
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),sub=(a,b)=>a.map((v,k)=>v-b[k]);
const norm=a=>Math.hypot(...a),unit=a=>a.map(v=>v/norm(a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const det=j=>j[0][0]*(j[1][1]*j[2][2]-j[1][2]*j[2][1])-j[0][1]*(j[1][0]*j[2][2]-j[1][2]*j[2][0])+j[0][2]*(j[1][0]*j[2][1]-j[1][1]*j[2][0]);
const mul=(j,v)=>j.map(row=>dot(row,v));
const cofactor=j=>{const c=[0,1,2].map(k=>j.map(r=>r[k]));return [cross(c[1],c[2]),cross(c[2],c[0]),cross(c[0],c[1])];};
const inverseNormal=(j,n)=>{const c=cofactor(j),d=det(j);return unit([0,1,2].map(k=>n.reduce((s,v,a)=>s+v*c[a][k],0)/d));};
const numericalJacobian=(p,e=1e-7)=>{
 const cols=[0,1,2].map(axis=>{const lo=p.slice(),hi=p.slice();lo[axis]-=e;hi[axis]+=e;return sub(api.warp(hi).point,api.warp(lo).point).map(v=>v/(2*e));});
 return [0,1,2].map(row=>cols.map(c=>c[row]));
};
let minimumJacobian=Infinity,minimumAt=null,nonPositive=0,nonFinite=0,samples=0,movedSamples=0,maximumMotionM=0;
let maximumDerivativeError=0,maximumDerivativeAt=null,maximumNormalError=0,normalChecks=0,derivativeChecks=0;
let maximumSymmetryErrorM=0,maximumJacobianSymmetryError=0,symmetryChecks=0;
const foldedExamples=[],normal=unit([.31,-.27,.83]);
function sample(p,derivative=false){
 const out=api.warp(p),j=out.jacobian,d=det(j);samples++;
 if(![...out.point,...j.flat(),d].every(Number.isFinite))nonFinite++;
 if(d<minimumJacobian){minimumJacobian=d;minimumAt=p.slice();}
 if(d<=0){nonPositive++;if(foldedExamples.length<12)foldedExamples.push({point:p.slice(),determinant:d});}
 const motion=norm(sub(out.point,p));maximumMotionM=Math.max(maximumMotionM,motion);if(motion>1e-6)movedSamples++;
 if(derivative){
  const measured=numericalJacobian(p);derivativeChecks++;
  for(let row=0;row<3;row++)for(let col=0;col<3;col++){
   const error=Math.abs(j[row][col]-measured[row][col]);
   if(error>maximumDerivativeError){maximumDerivativeError=error;maximumDerivativeAt=p.slice();}
  }
  // Compare independently differentiated tangent geometry and inverse transpose.
  if(Math.abs(d)>1e-4&&Math.abs(det(measured))>1e-4){
   const a=inverseNormal(j,normal),b=inverseNormal(measured,normal);
   maximumNormalError=Math.max(maximumNormalError,norm(sub(a,b)));normalChecks++;
  }
 }
 return out;
}
// 2 mm lattice covers the complete supported volume and a surrounding shell.
for(let ix=-47;ix<=47;ix++)for(let iy=0;iy<=70;iy++)for(let iz=0;iz<=95;iz++){
 const p=[ix*.002,1.390+iy*.002,.040+iz*.002];
 sample(p,ix%5===0&&iy%5===0&&iz%5===0);
}
// Fixed seed jitter avoids relying only on axis-aligned grid intersections.
let randomState=240918;
const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
for(let i=0;i<30000;i++){
 const p=[-.094+random()*.188,1.390+random()*.140,.040+random()*.190],out=sample(p,i%113===0);
 const mirrored=api.warp([-p[0],p[1],p[2]]),sign=[-1,1,1];symmetryChecks++;
 for(let k=0;k<3;k++)maximumSymmetryErrorM=Math.max(maximumSymmetryErrorM,Math.abs(mirrored.point[k]-sign[k]*out.point[k]));
 for(let row=0;row<3;row++)for(let col=0;col<3;col++)maximumJacobianSymmetryError=Math.max(maximumJacobianSymmetryError,Math.abs(mirrored.jacobian[row][col]-sign[row]*sign[col]*out.jacobian[row][col]));
}
check(nonFinite===0,`Non-finite outputs: ${nonFinite}`);
check(nonPositive===0,`Folded volume: ${nonPositive} sampled determinants <= 0; minimum ${minimumJacobian} at ${minimumAt}`);
check(maximumDerivativeError<1e-5,`Analytic Jacobian mismatch ${maximumDerivativeError}`);
check(maximumNormalError<1e-5,`Inverse-transpose normal mismatch ${maximumNormalError}`);
check(maximumSymmetryErrorM<1e-12&&maximumJacobianSymmetryError<1e-10,'Bilateral symmetry is not preserved');
check(movedSamples>1000,'The sculpt map is inactive or only affects isolated points');

let bodySamples=0,eyeCentreSamples=0,centralFeatureSamples=0,maximumProtectedMotionM=0,maximumProtectedJacobianError=0;
function protect(p,group){
 const out=api.warp(p),motion=norm(sub(out.point,p));maximumProtectedMotionM=Math.max(maximumProtectedMotionM,motion);
 const error=Math.max(...out.jacobian.flatMap((row,i)=>row.map((v,j)=>Math.abs(v-identity[i][j]))));
 maximumProtectedJacobianError=Math.max(maximumProtectedJacobianError,error);
 check(motion<1e-10&&error<1e-9,`${group} must be unaffected at ${p}: motion ${motion}, Jacobian error ${error}`);
}
for(const x of [-.5,-.09,0,.09,.5])for(const y of [-.2,.4,1.1,1.39,1.40])for(const z of [-.2,.045,.15,.3]){protect([x,y,z],'body');bodySamples++;}
const eyeCentres=[[.029181616,1.518095373,.152055491],[-.030466569,1.518094244,.151979130]];
for(const centre of eyeCentres)for(const dx of [-.002,0,.002])for(const dy of [-.002,0,.002])for(const dz of [-.002,0,.002]){protect(centre.map((v,k)=>v+[dx,dy,dz][k]),'optical eye centre');eyeCentreSamples++;}
for(const x of [-.008,-.004,0,.004,.008])for(const y of [1.435,1.449,1.462,1.478,1.495,1.510,1.540])for(const z of [.17,.19,.215]){protect([x,y,z],'central nose/lips');centralFeatureSamples++;}

// Isolate each authored plane only inside this VM. Verify geometric behavior:
// broad support, unchanged tangent displacement, planar core contraction,
// boundary continuity, and support contained inside the fast-reject box.
const strokeReports=[],integrationSteps=api.config.steps;
check(Number.isInteger(integrationSteps)&&integrationSteps>=1,'Integration step count must be a positive integer');
try{
 for(const stroke of strokes){
  api.config.strokes=[stroke];const n=unit(Array.from(stroke.normal)),report={id:stroke.id,strength:stroke.strength,integrationSteps,minimumIsolatedJacobian:Infinity,minimumAt:null,coreSamples:0,falloffPathSamples:0,flowSamples:0,boundarySamples:0,maximumBoundaryDerivativeError:0,maximumCoreProjectionErrorM:0,maximumTangentialMotionM:0,maximumDistanceIncreaseM:0,maximumTraceErrorM:0,minimumStepJacobian:Infinity};
  for(let ix=-10;ix<=10;ix++)for(let iy=-10;iy<=10;iy++)for(let iz=-10;iz<=10;iz++){
   const p=stroke.centre.map((v,k)=>v+[ix,iy,iz][k]/10*stroke.radii[k]),d=det(api.warp(p).jacobian);
   if(d<report.minimumIsolatedJacobian){report.minimumIsolatedJacobian=d;report.minimumAt=Array.from(p);}
  }
  let broadMoved=0;
  for(const axis of [0,1,2])for(const sign of [-1,1])for(const fraction of [.15,.30,.40,.65,.85]){
   const p=Array.from(stroke.centre);p[axis]+=sign*stroke.radii[axis]*fraction;
   const out=api.warp(p),delta=sub(out.point,p),distance=dot(sub(p,stroke.anchor),n),expected=distance*(1-stroke.strength);
   // Observe the actual production step repeatedly, without reimplementing its
   // falloff. A path leaving the core no longer has the full-core closed form.
   const stepStrength=1-Math.pow(1-stroke.strength,1/integrationSteps);
   const inCore=q=>q.reduce((sum,v,k)=>sum+((v-stroke.centre[k])/stroke.radii[k])**2,0)<=.18+1e-13;
   let cursor=p.slice(),allInCore=inCore(cursor),previousDistance=distance;
   try{
    api.config.steps=1;api.config.strokes=[{...stroke,strength:stepStrength}];
    for(let step=0;step<integrationSteps;step++){
     const next=api.warp(cursor),stepDelta=sub(next.point,cursor),nextDistance=dot(sub(next.point,stroke.anchor),n);
     report.minimumStepJacobian=Math.min(report.minimumStepJacobian,det(next.jacobian));
     report.maximumTangentialMotionM=Math.max(report.maximumTangentialMotionM,norm(sub(stepDelta,n.map(v=>v*dot(stepDelta,n)))));
     report.maximumDistanceIncreaseM=Math.max(report.maximumDistanceIncreaseM,Math.abs(nextDistance)-Math.abs(previousDistance));
     check(previousDistance*nextDistance>=-1e-15,`${stroke.id}: a flow step crossed its target plane`);
     cursor=Array.from(next.point);previousDistance=nextDistance;allInCore=allInCore&&inCore(cursor);
    }
   }finally{api.config.steps=integrationSteps;api.config.strokes=[stroke];}
   report.maximumTraceErrorM=Math.max(report.maximumTraceErrorM,norm(sub(cursor,out.point)));report.flowSamples++;
   if(allInCore){report.maximumCoreProjectionErrorM=Math.max(report.maximumCoreProjectionErrorM,Math.abs(dot(sub(out.point,stroke.anchor),n)-expected));report.coreSamples++;}
   else report.falloffPathSamples++;
   report.maximumTangentialMotionM=Math.max(report.maximumTangentialMotionM,norm(sub(delta,n.map(v=>v*dot(delta,n)))));
   if(norm(delta)>1e-4)broadMoved++;
  }
  check(report.coreSamples>0,`${stroke.id}: no complete core paths were tested`);
  check(report.falloffPathSamples>0,`${stroke.id}: no falloff paths were tested`);
  check(report.maximumCoreProjectionErrorM<1e-12,`${stroke.id}: complete core paths disagree with the total analytic contraction`);
  check(report.maximumTraceErrorM<1e-12,`${stroke.id}: repeated production steps disagree with the integrated map`);
  check(report.maximumTangentialMotionM<1e-12,`${stroke.id}: flow moves tangentially to its plane`);
  check(report.maximumDistanceIncreaseM<1e-12,`${stroke.id}: flow moves away from its target plane`);
  check(report.minimumStepJacobian>0,`${stroke.id}: an observed integration step folded`);
  check(broadMoved>=12,`${stroke.id}: broad support has too few moving interior samples`);
  for(let i=0;i<80;i++){
   const z=1-2*(i+.5)/80,theta=i*Math.PI*(3-Math.sqrt(5)),direction=[Math.sqrt(1-z*z)*Math.cos(theta),Math.sqrt(1-z*z)*Math.sin(theta),z];
   const p=stroke.centre.map((v,k)=>v+direction[k]*stroke.radii[k]),out=api.warp(p),j=numericalJacobian(p,1e-7);
   check(norm(sub(out.point,p))<1e-11,`${stroke.id}: position discontinuity at support boundary`);
   report.maximumBoundaryDerivativeError=Math.max(report.maximumBoundaryDerivativeError,...j.flatMap((row,r)=>row.map((v,c)=>Math.abs(v-identity[r][c]))));report.boundarySamples++;
  }
  check(report.maximumBoundaryDerivativeError<1e-5,`${stroke.id}: first derivative discontinuity at support boundary`);
  check(stroke.radii.every(v=>v>=.015),`${stroke.id}: support has become a small local bump`);
  const low=stroke.centre.map((v,k)=>v-stroke.radii[k]),high=stroke.centre.map((v,k)=>v+stroke.radii[k]);
  check(low[0]>=0&&high[0]<.09&&low[1]>1.40&&high[1]<1.52&&low[2]>.045&&high[2]<.225,`${stroke.id}: support crosses the hard early-out boundary`);
  strokeReports.push(report);
 }
}finally{api.config.strokes=strokes;api.config.steps=integrationSteps;}

const report={sourceSha256:createHash('sha256').update(source).digest('hex'),revision:api.config.revision,integrationSteps,defaultStrengths:strokes.map(s=>({id:s.id,strength:s.strength})),samples,minimumJacobian,minimumAt,nonPositive,nonFinite,foldedExamples,movedSamples,maximumMotionM,derivativeChecks,maximumDerivativeError,maximumDerivativeAt,normalChecks,maximumNormalError,symmetryChecks,maximumSymmetryErrorM,maximumJacobianSymmetryError,bodySamples,eyeCentreSamples,centralFeatureSamples,maximumProtectedMotionM,maximumProtectedJacobianError,strokeReports,failures,passed:failures.length===0,visualAcceptance:false};
const outputIndex=process.argv.indexOf('--output');
if(outputIndex>=0){const output=resolve(process.argv[outputIndex+1]);mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
assert.equal(failures.length,0,failures.join('\n'));
