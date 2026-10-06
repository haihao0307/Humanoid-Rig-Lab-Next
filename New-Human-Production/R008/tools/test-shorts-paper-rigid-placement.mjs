import assert from 'node:assert/strict';
import {alignShortsPaperRigid} from '../ShortsPaperRigidPlacement.mjs';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),sub=(a,b)=>a.map((v,k)=>v-b[k]),mat=(R,p)=>R.map(row=>dot(row,p)),place=(R,t,p)=>mat(R,p).map((v,k)=>v+t[k]);
const close=(a,b,tolerance=1e-11)=>assert(Math.abs(a-b)<=tolerance,JSON.stringify({a,b,tolerance}));
const closeXYZ=(a,b)=>a.forEach((v,k)=>close(v,b[k]));
const mapFrame=(f,R,t)=>Object.fromEntries(Object.entries(f).map(([key,p])=>[key,place(R,t,p)]));
const sourceFrame={waist:[.1,1.2,-.2],leftHem:[-.3,.4,-.1],rightHem:[.5,.4,-.1]},positions=[[.1,1.2,-.2],[-.3,.4,-.1],[.5,.4,-.1],[.2,.7,.3],[-.1,.8,.15]];
// Nineteen synthetic sewn variable pairs. These test equivalence preservation;
// they are not a claim to have validated an actual garment or its seam graph.
const seamPairs=Array.from({length:19},(_,i)=>{const a=i%5,b=positions.length;positions.push(positions[a].slice());return{a,b};});
const triangles=[[0,1,3],[0,3,4],[1,2,3],[2,4,3]],inputIdentity=JSON.stringify({sourceFrame,positions}),Q=[[0,0,1],[1,0,0],[0,1,0]],shift=[2,-3,4],targetFrame=mapFrame(sourceFrame,Q,shift),result=alignShortsPaperRigid({positions,sourceFrame,targetFrame});
assert.equal(inputIdentity,JSON.stringify({sourceFrame,positions}));assert(result.sourceInputUnchanged);assert.notEqual(result.positions,positions);assert(result.positions.every((p,i)=>p!==positions[i]));
result.positions.forEach((p,i)=>closeXYZ(p,place(Q,shift,positions[i])));close(result.determinant,1);close(result.error,0);assert.equal(result.scale,1);close(result.frameResidualsM.waist,0);
let maximumTriangleGramDifference=0,maximumEdgeLengthDifference=0;
for(const tri of triangles){const original=tri.map(i=>positions[i]),moved=tri.map(i=>result.positions[i]),oldEdges=[sub(original[1],original[0]),sub(original[2],original[0])],newEdges=[sub(moved[1],moved[0]),sub(moved[2],moved[0])];for(let i=0;i<2;i++)for(let j=0;j<2;j++){const d=Math.abs(dot(oldEdges[i],oldEdges[j])-dot(newEdges[i],newEdges[j]));maximumTriangleGramDifference=Math.max(maximumTriangleGramDifference,d);close(d,0);}for(const [i,j]of [[0,1],[1,2],[2,0]]){const d=Math.abs(Math.hypot(...sub(original[i],original[j]))-Math.hypot(...sub(moved[i],moved[j])));maximumEdgeLengthDifference=Math.max(maximumEdgeLengthDifference,d);close(d,0);}}
for(const {a,b}of seamPairs)assert.deepEqual(result.positions[a],result.positions[b]);
// A barycentric relation remains identical under the affine rigid map.
const weights=[.2,.3,.5],sourceBlend=[0,1,2].map(axis=>weights.reduce((s,w,i)=>s+w*positions[i][axis],0)),targetBlend=[0,1,2].map(axis=>weights.reduce((s,w,i)=>s+w*result.positions[i][axis],0));closeXYZ(place(result.R,result.t,sourceBlend),targetBlend);
// Independent changes of source/target coordinate frame commute with placement.
const A=[[0,-1,0],[1,0,0],[0,0,1]],a=[.7,-.2,1.1],B=[[1,0,0],[0,0,-1],[0,1,0]],b=[-1,.3,.6],covariant=alignShortsPaperRigid({positions:positions.map(p=>place(A,a,p)),sourceFrame:mapFrame(sourceFrame,A,a),targetFrame:mapFrame(targetFrame,B,b)});
covariant.positions.forEach((p,i)=>closeXYZ(p,place(B,b,result.positions[i])));
// Unit changes preserve R and scale t/output. Target sizes are never fitted.
for(const scale of [1e-6,1e3]){const mul=p=>p.map(v=>v*scale),scaled=alignShortsPaperRigid({positions:positions.map(mul),sourceFrame:Object.fromEntries(Object.entries(sourceFrame).map(([k,p])=>[k,mul(p)])),targetFrame:Object.fromEntries(Object.entries(targetFrame).map(([k,p])=>[k,mul(p)]))});scaled.R.forEach((row,i)=>row.forEach((v,j)=>close(v,result.R[i][j])));scaled.positions.forEach((p,i)=>p.forEach((v,j)=>close(v/scale,result.positions[i][j])));assert.equal(scaled.scale,1);}
const enlargedTarget=Object.fromEntries(Object.entries(sourceFrame).map(([key,p])=>[key,p.map((v,k)=>sourceFrame.waist[k]+2*(v-sourceFrame.waist[k]))])),unscaled=alignShortsPaperRigid({positions,sourceFrame,targetFrame:enlargedTarget});unscaled.positions.forEach((p,i)=>closeXYZ(p,positions[i]));assert(unscaled.frameResidualsM.leftHem>.1&&unscaled.frameResidualsM.rightHem>.1);assert.equal(unscaled.scale,1);
assert.throws(()=>alignShortsPaperRigid({positions,sourceFrame:{...sourceFrame,rightHem:sourceFrame.leftHem},targetFrame}),/DEGENERATE_HEM_AXIS/);
assert.throws(()=>alignShortsPaperRigid({positions,sourceFrame:{waist:[0,0,0],leftHem:[-1,0,0],rightHem:[1,0,0]},targetFrame}),/DEGENERATE_WAIST_AXIS/);
assert.throws(()=>alignShortsPaperRigid({positions:[[0,NaN,0]],sourceFrame,targetFrame}),/INVALID_XYZ/);
assert.throws(()=>alignShortsPaperRigid({positions,sourceFrame,targetFrame:{...targetFrame,waist:[Infinity,0,0]}}),/INVALID_XYZ/);
assert.equal(inputIdentity,JSON.stringify({sourceFrame,positions}));
console.log(JSON.stringify({status:'PURE_PROPER_RIGID_CHECKS_PASSED',triangles:triangles.length,syntheticSewnPairs:seamPairs.length,maximumTriangleGramDifference,maximumEdgeLengthDifference,determinant:result.determinant,orthogonalityError:result.orthogonalityError,inputUnchanged:true,independentFrameCovariancePassed:true,unitScaleInvariantPassed:true,unequalTargetDimensionsNotScaled:true,degenerateFrameRejected:true,newNativeInstances:0,solverIterations:0,bodyContactValidated:false,wearingAccepted:false}));
