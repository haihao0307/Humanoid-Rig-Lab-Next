import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../body/FaceIdentity.js',import.meta.url),'utf8');
const {warp,proportions}=vm.runInNewContext(source+'\n({warp:faceIdentityWarp,proportions:faceIdentityProportions})');
const determinant=j=>j[0][0]*(j[1][1]*j[2][2]-j[1][2]*j[2][1])-j[0][1]*(j[1][0]*j[2][2]-j[1][2]*j[2][0])+j[0][2]*(j[1][0]*j[2][1]-j[1][1]*j[2][0]);
let minDet=Infinity,maxError=0,samples=0;
const e=1e-7;
for(let bits=0;bits<32;bits++){
 const weights=[0,1,2,3,4].map(k=>bits&(1<<k)?1:-1);
 for(let x=-.09;x<=.091;x+=.009)for(let y=1.38;y<=1.701;y+=.009)for(let z=.08;z<=.211;z+=.013){
  const p=[x,y,z],out=warp(p,weights),det=determinant(out.jacobian);minDet=Math.min(minDet,det);assert(det>.35,'head identity folded');samples++;
  for(let axis=0;axis<3;axis++){
   const a=[...p],b=[...p];a[axis]+=e;b[axis]-=e;
   const qa=warp(a,weights).point,qb=warp(b,weights).point;
   for(let component=0;component<3;component++)maxError=Math.max(maxError,Math.abs((qa[component]-qb[component])/(2*e)-out.jacobian[component][axis]));
  }
 }
}
assert(maxError<1e-5,'normal Jacobian disagrees with actual surface movement');
const identity=[[1,0,0],[0,1,0],[0,0,1]],zero=[0,0,0,0,0];
let protectedSamples=0,neutralSamples=0;
for(const x of [-.15,-.06,0,.06,.15])for(const y of [.5,1.30,1.39,1.395])for(const z of [-.1,.1,.3])for(const sign of [-1,1]){
 const lower=[x,y,z],out=warp(lower,[sign,sign,sign,sign,sign]);
 assert.deepEqual(Array.from(out.point),lower,'lower body must be untouched');
 assert.deepEqual(Array.from(out.jacobian,row=>Array.from(row,value=>value===0?0:value)),identity,'lower body normals must be untouched');protectedSamples++;
}
for(const p of [[.035,1.525,.16],[.052,1.443,.10],[-.052,1.443,.10],[0,1.432,.184],[.09,1.67,.16]]){
 const out=warp(p,zero);assert.deepEqual(Array.from(out.point),p,'old neutral identity must remain unchanged');
 assert.deepEqual(Array.from(out.jacobian,row=>Array.from(row,value=>value===0?0:value)),identity,'neutral normals must remain unchanged');neutralSamples++;
 assert.deepEqual(Array.from(warp(p,[.3,-.4,.2,-.5]).point),Array.from(warp(p,[.3,-.4,.2,-.5,0]).point),'legacy four-value callers must equal zero jaw width');
}
assert.deepEqual(Array.from(proportions({headWidth:.25,headHeight:-.5,headDepth:.75,eyeSpacing:-1,jawWidth:.5})),[.25,-.5,.75,-1,.5],'jaw width must be fifth, after the four existing macro parameters');
assert(warp([.03,1.518,.166],[0,0,0,1]).point[0]>.0324,'eye spacing did not move the eye region');
let minimumJawContourMotion=Infinity;
for(const side of [-1,1])for(const p of [[side*.052,1.443,.10],[side*.050,1.442,.110],[side*.059,1.455,.139]]){
 const expanded=warp(p,[0,0,0,0,1]).point,narrowed=warp(p,[0,0,0,0,-1]).point;
 const motion=side*(expanded[0]-p[0]);minimumJawContourMotion=Math.min(minimumJawContourMotion,motion);
 assert(motion>.001,'jaw width must visibly move the broad lateral contour, not only a control-point patch');
 assert(side*(narrowed[0]-p[0])<-.001,'negative jaw width must narrow both sides');
 for(const axis of [1,2])assert.equal(expanded[axis],p[axis],'jaw width must not lengthen or project the jaw');
}
for(const side of [-1,1]){
 const rear=[side*.050,1.449,.123],front=[side*.042,1.446,.170];
 const shift=p=>Math.abs(warp(p,[0,0,0,0,1]).point[0]-p[0]);
 assert(shift(front)<shift(rear)*.10,'jaw widening belongs at the rear angle, not the front mouth-side cheek');
}
for(const p of [[.03,1.518,.166],[0,1.50,.195],[.04,1.486,.16]])assert.deepEqual(Array.from(warp(p,[0,0,0,0,1]).point),p,'jaw field must leave eyes and upper midface untouched');
for(const y of [1.41,1.432,1.446,1.47])assert.equal(warp([0,y,.15],[0,0,0,0,1]).point[0],0,'paired jaw field must preserve the facial midline');
console.log(JSON.stringify({samples,parameterCorners:32,minimumJacobian:minDet,maximumDerivativeError:maxError,protectedSamples,neutralSamples,minimumJawContourMotionM:minimumJawContourMotion,legacyFourWeightsCompatible:true,neutralExact:true,bodyProtected:true,visualAcceptance:false}));
