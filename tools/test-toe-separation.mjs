// Pure geometry, normal, canonical packing and local source sampling regression.
// No browser, GPU, locked coefficient writes or full-body regeneration.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createToeSeparation} from '../reconstruction/toe-separation.mjs';
import {decodeCompactHuman} from '../reconstruction/codec.mjs';
import {sampleCompactGroup,smoothAndQuantize} from '../reconstruction/mesher.mjs';
import {CanonicalTopology} from '../reconstruction/topology.mjs';

const reference=JSON.parse(readFileSync(new URL('../reconstruction/rig-reference.json',import.meta.url)));
const correction=createToeSeparation(reference),add=(a,b)=>a.map((v,k)=>v+b[k]),sub=(a,b)=>a.map((v,k)=>v-b[k]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((sum,v,k)=>sum+v*b[k],0),norm=a=>mul(a,1/Math.hypot(...a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],distance=(a,b)=>Math.hypot(...sub(a,b)),mirror=p=>[-p[0],p[1],p[2]];
let positiveJacobianSamples=0,normalSamples=0,preservedLandmarks=0,minimumJacobian=1,maximumJacobianRelativeError=0;
const epsilon=1e-7,normal=norm([.2,.9,.3]),tangent1=norm(cross(normal,[1,0,0])),tangent2=cross(normal,tangent1);
for(const side of ['left','right']){
 const mask=side==='left'?1024:2048;
 for(let toe=1;toe<=5;toe++){
  for(const p of [reference.nodes[side+'_toe_'+toe+'_1'].positionM,reference.nodes[side+'_toe_'+toe+'_'+(toe===1?2:3)].tipM]){
   assert(distance(correction.evaluate(p,mask).point,p)<1e-12,'Toe root and ray tip must remain fixed');preservedLandmarks++;
  }
 }
 for(const c of correction.corridors.get(side)){
  const vertical=norm(cross(c.axis,c.lateral));
  for(const along of [.005,.02,.04,.06])for(const fraction of [-.95,-.5,0,.5,.95])for(const height of [-.008,.008]){
   const p=add(add(add(c.origin,mul(c.axis,along)),mul(c.lateral,c.outerWidth*fraction)),mul(vertical,height)),result=correction.evaluate(p,mask,normal);
   const derivative=d=>mul(sub(correction.evaluate(add(p,mul(d,epsilon)),mask).point,correction.evaluate(sub(p,mul(d,epsilon)),mask).point),.5/epsilon);
   const j=[[1,0,0],[0,1,0],[0,0,1]].map(derivative),det=dot(j[0],cross(j[1],j[2]));
   assert(det>0,'A distal-foot repair must not invert its local map');assert(result.jacobian>0);
   const relative=Math.abs(det-result.jacobian)/result.jacobian;assert(relative<3e-5,'Analytic Jacobian must agree with finite differences');
   maximumJacobianRelativeError=Math.max(maximumJacobianRelativeError,relative);minimumJacobian=Math.min(minimumJacobian,det);positiveJacobianSamples++;
   for(const tangent of [tangent1,tangent2])assert(Math.abs(dot(result.normal,norm(derivative(tangent))))<3e-6,'Corrected normal must remain perpendicular to transformed tangents');normalSamples++;
   const source=correction.evaluateSource(mirror(p),mask,mirror(normal));assert(distance(source.point,mirror(result.point))<1e-12);assert(distance(source.normal,mirror(result.normal))<1e-12);
  }
  const p=add(c.origin,mul(c.axis,.04)),out=correction.evaluate(p,mask).point;
  assert(dot(sub(out,c.origin),c.axis)<.0045,'A 40 mm distal corridor must retract close to its web root');
  const behind=sub(c.origin,mul(c.axis,.08));assert(distance(correction.evaluate(behind,mask).point,behind)<1e-12,'Proximal foot must retain thickness');
 }
}
for(const mask of [1,2,4,8,16,32,64,128,256,512])for(const p of [[0,1,0],[-.12,-.06,.22],[.12,-.06,.22]])assert.deepEqual(correction.evaluate(p,mask).point,p,'Unrelated source regions must not move');

const c=correction.corridors.get('left')[1],sourcePoint=mirror(add(c.origin,mul(c.axis,.035))),positions=Float32Array.from([...sourcePoint,...sourcePoint,...sourcePoint]);
const mesh=()=>({name:'skin',sourceGroup:'detail',positions:positions.slice(),normals:Float32Array.from([0,1,0,0,1,0,0,1,0]),regionMasks:Uint16Array.from([1024,1024,1024]),vertexIds:Uint32Array.from([41,42,43]),indices:Uint32Array.from([0,1,2]),maximumFloat32ErrorM:0});
const packed=smoothAndQuantize([mesh(),mesh()],null,[correction]);
assert.deepEqual(packed.meshes[0].positions,packed.meshes[1].positions,'Shared canonical source coordinates must produce byte-identical corrected positions');
assert.deepEqual(packed.meshes[0].normals,packed.meshes[1].normals,'Shared normals must be transformed and packed deterministically');
assert.equal(packed.correctionStats[0].changedVertexOccurrences,6);assert(packed.correctionStats[0].minimumLocalJacobian>0);

const report={test:'toe-separation',positiveJacobianSamples,normalSamples,preservedLandmarks,minimumJacobian,maximumJacobianRelativeError,canonicalPacking:'byte-identical'};
if(process.argv.includes('--sample')||process.argv.includes('--feet')){
 const decoded=await decodeCompactHuman(readFileSync(new URL('../reconstruction/detail.chf.gz',import.meta.url))),schema=JSON.parse(readFileSync(new URL('../reconstruction/binding-schema.json',import.meta.url)));
 const fullFeet=process.argv.includes('--feet'),ids=new Set([939,985,1161,1242]);decoded.data.fields.domains=decoded.data.fields.domains.filter(c=>fullFeet?/foot_toes/.test(c.semanticRegion):ids.has(c.id));
 assert.equal(decoded.data.fields.domains.length,fullFeet?436:4);
 const topology=new CanonicalTopology(reference),sample=await sampleCompactGroup('detail',decoded.data,'preview',()=>{},null,schema,topology,[correction]);
 const stat=sample.stats;assert(stat.correctionRefinementSplits>0,'Interdigital deformation must drive local refinement');
 assert(stat.maximumCorrectionInterpolationError<=correction.parameters.positionToleranceM,'Selected distal charts must meet the corrected position tolerance');
 assert(stat.maximumCorrectionSourceEdge<=correction.parameters.maximumSourceEdgeM,'Selected distal charts must meet the local source edge bound');
 assert.equal(stat.correctionLimitedTriangles,0,'The local refinement quota must resolve selected toe charts');
 report.localSampling={charts:stat.domains,triangles:stat.triangles,correctionRefinementSplits:stat.correctionRefinementSplits,maximumInterpolationErrorMm:stat.maximumCorrectionInterpolationError*1000,maximumSourceEdgeMm:stat.maximumCorrectionSourceEdge*1000,limitedTriangles:stat.correctionLimitedTriangles};
}
console.log(JSON.stringify(report,null,2));
