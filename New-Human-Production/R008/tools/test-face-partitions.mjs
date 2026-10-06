import assert from 'node:assert/strict';
import {SHAPE_REGIONS,normalizeFaceShape,partitionWeights,createFacePartition} from '../FacePartition.mjs';
import {faceMask} from '../FacialBinding.mjs';
assert.equal(SHAPE_REGIONS.length,57);assert.equal(new Set(SHAPE_REGIONS.map(r=>r.id)).size,57);
for(const r of SHAPE_REGIONS){const w=partitionWeights(r.centre,faceMask(r.centre));assert(w.every(x=>Number.isFinite(x)&&x>=0&&x<=1));assert(w.reduce((s,x)=>s+x,0)<=1+1e-12);}
const left=[.04,1.61,.11],right=[-.04,1.61,.11],a=partitionWeights(left),b=partitionWeights(right);
for(const [j,r]of SHAPE_REGIONS.entries()){const id=r.id.replace(/(Left|Right)$/,r.sign===1?'Right':'Left'),mirror=SHAPE_REGIONS.findIndex(q=>q.id===id);assert(Math.abs(a[j]-b[mirror])<1e-12);}
const p=new Float32Array([0,1.624,.15,.04,1.61,.11,.034,1.656,.102]),n=new Float32Array([0,0,1,0,0,1,0,0,1]),atlas=createFacePartition({basePositions:p,baseNormals:n,mask:faceMask});
const recipe={...normalizeFaceShape(),regions:{noseTip:[0,0,1]}};const report=atlas.apply(recipe);assert(report.maxDisplacementMM>0);assert(report.minJacobian>.3);assert.deepEqual(Array.from(atlas.positions.subarray(6,9)),Array.from(p.subarray(6,9)));
atlas.apply(normalizeFaceShape());assert.deepEqual(atlas.positions,p);assert.deepEqual(atlas.normals,n);
for(const bad of [{...recipe,source:'another-character'},{...recipe,regions:{noseTip:[0,0,4]}},{...recipe,regions:{lidUpperLeft:[1,0,0]}},{...recipe,regions:{unknown:[0,0,0]}}])assert.throws(()=>normalizeFaceShape(bad));
console.log(JSON.stringify({passed:true,regions:57,locked:SHAPE_REGIONS.filter(r=>r.locked).length,checks:'range, partition mass, bilateral symmetry, eye protection, actual displacement, exact neutral reset, invalid recipe rejection'}));
