// Explicit runtime regression, separate from the file-only audit. No GPU.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeCompactHuman} from '../reconstruction/codec.mjs';
import {sampleCompactGroup,SurfaceRefinementQueue} from '../reconstruction/mesher.mjs';
import {CanonicalTopology} from '../reconstruction/topology.mjs';

// Reproduce the scheduling failure: a late, large error must be considered
// before recursively refining the first small one in a bounded chart.
const queue=new SurfaceRefinementQueue();
for(let i=0;i<128;i++)queue.push({id:i},2);
queue.push({id:'late-visible-defect'},100);
assert.equal(queue.pop().id,'late-visible-defect');
for(let i=0;i<128;i++)assert.equal(queue.pop().id,i,'equal-priority work stays deterministic');
assert.equal(queue.length,0);

// Reproduce the back-neck stitch: an inserted bridge knot starts without a
// source normal. Its direction must come from the adjacent back-facing skin.
const seam=new CanonicalTopology();
const left=seam.vertex('skin',{p:[0,1.42,0],n:[0,0,-1],regionMask:1});
const right=seam.vertex('skin',{p:[.01,1.42,0],n:[0,.2,-Math.sqrt(.96)],regionMask:2});
const knot=seam.vertex('skin',{p:[.0025,1.42,0],regionMask:1});
assert.equal(seam.hasNormal[knot],false);
seam.split(right,left,knot,.75);
assert.equal(seam.hasNormal[knot],true);
const inherited=seam.normals.slice(knot*3,knot*3+3);
assert(inherited[2]<-.99,'back-neck knot cannot keep the placeholder forward normal');
assert(Math.abs(Math.hypot(...inherited)-1)<1e-12);
assert.equal(seam.stats.inheritedBoundaryNormals,1);

const {data}=await decodeCompactHuman(readFileSync(new URL('../reconstruction/body.chf.gz',import.meta.url)));
const schema=JSON.parse(readFileSync(new URL('../reconstruction/binding-schema.json',import.meta.url)));
const reports=[];
for(const id of [6,293]){
  const domain=data.fields.domains.find(c=>c.id===id);
  const input={...data,fields:{...data.fields,domains:[domain]}};
  const topology=new CanonicalTopology();
  const result=await sampleCompactGroup('body',input,'preview',()=>{},null,schema,topology);
  const [u,v]=domain.projectionAxes;
  let faces=0;
  for(const mesh of result.meshes)for(let i=0;i<mesh.indices.length;i+=3){
    const [a,b,c]=Array.from(mesh.indices.subarray(i,i+3),id=>topology.point(id));
    const ab=b.map((x,k)=>x-a[k]),ac=c.map((x,k)=>x-a[k]);
    const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    assert(cross[domain.heightAxis]*domain.outwardSign>=-1e-20,'source chart winding must not follow a noisy local derivative');
    assert(Number.isFinite((b[u]-a[u])*(c[v]-a[v])-(b[v]-a[v])*(c[u]-a[u])));
    faces++;
  }
  assert(faces>0);
  assert(result.stats.adaptiveSplits<=result.stats.refinementBudget,'priority refinement remains bounded');
  assert(result.stats.maximumSampledInterpolationError<.002,'late chart faces cannot retain centimetre-scale errors');
  reports.push({domain:id,faces,splits:result.stats.adaptiveSplits,maximumErrorM:result.stats.maximumSampledInterpolationError});
}
console.log(JSON.stringify({schema:'human/skin_surface_regression@1',reports,applicationFunctionsExecuted:true,browserExecuted:false,gpuExecuted:false}));
