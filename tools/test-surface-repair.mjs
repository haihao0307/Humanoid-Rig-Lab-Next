// Explicit runtime regression; separate from the file-only audit. No GPU.
import assert from 'node:assert/strict';
import {allocateChartRefinementBudget,usableParameterTriangle,longestParameterEdge,canonicalRadialParameter} from '../reconstruction/mesher.mjs';
import {orientSkinFaces} from '../reconstruction/topology.mjs';

const domains=[{id:9,uvBoundsMetres:[[0,0],[1,1]]},{id:2,uvBoundsMetres:[[0,0],[.01,.01]]},{id:4,uvBoundsMetres:[[0,0],[.2,.2]]}];
for(const total of [0,1,2,100,12000]){
 const budgets=allocateChartRefinementBudget(domains,total);
 assert.equal(budgets.reduce((a,b)=>a+b,0),total,'allocation cannot create extra work');
 const reversed=allocateChartRefinementBudget(domains.slice().reverse(),total);
 assert.deepEqual([...budgets],[...reversed].reverse(),'source order cannot change allocation');
 if(total>=100)assert(budgets[0]>budgets[2]&&budgets[2]>budgets[1]&&budgets[1]>0,'large charts get more work while small charts retain coverage');
}
assert.deepEqual([...allocateChartRefinementBudget([],0)],[]);
assert.throws(()=>allocateChartRefinementBudget(domains,-1));

// The former error-driven split repeatedly shortened a sliver's short edge
// while its 65 mm curved chord survived to depth 20. Longest-edge bisection
// must reduce that chord even when the small UV area is still representable.
const sliver=[[0,0],[.065,0],[.025,4.5e-9]],copySliver=structuredClone(sliver);
assert(usableParameterTriangle(...sliver));
assert(!usableParameterTriangle([0,0],[.065,0],[.025,1e-10]));
const edgeIndex=longestParameterEdge(sliver),a=sliver[edgeIndex],b=sliver[(edgeIndex+1)%3],c=sliver[(edgeIndex+2)%3],mid=a.map((x,k)=>(x+b[k])/2);
assert.equal(edgeIndex,0);
for(const child of [[a,mid,c],[mid,b,c]]){
 const edge=longestParameterEdge(child),p=child[edge],q=child[(edge+1)%3];
 assert(Math.hypot(p[0]-q[0],p[1]-q[1])<.065,'both child chords must be shorter');
}
assert.deepEqual(sliver,copySliver,'source parameters must not move');
assert.equal(canonicalRadialParameter(-1.0000000000000002),-1);
assert.equal(canonicalRadialParameter(1.0000000000000002),1);
for(const t of [-1.00000001,-.75,0,.75,1.00000001])assert.equal(canonicalRadialParameter(t),t,'only binary roundoff may snap');

const positions=[0,0,0,1,0,0,0,1,0,1,1,0],normals=[0,0,1,0,0,1,0,0,1,0,0,1];
const edge=(a,b)=>Math.min(a,b)*16777216+Math.max(a,b);
function counts(meshes){const out=new Map();for(const m of meshes)if(m.name==='skin')for(let i=0;i<m.indices.length;i+=3)for(let k=0;k<3;k++){
 const a=m.indices[i+k],b=m.indices[i+(k+1)%3],key=edge(a,b);out.set(key,(out.get(key)||0)+1+(a<b?256:-256));}return out;}
for(const source of [[0,1,2,1,2,3],[0,2,1,1,2,3]]){
 const meshes=[{name:'skin',indices:Uint32Array.from(source)},{name:'eye',indices:Uint32Array.of(0,2,1)}],before=counts(meshes),copy=positions.slice();
 const report=orientSkinFaces(meshes,positions,normals,before),after=counts(meshes);
 assert.equal(report.orientationConstraintConflicts,0);
 for(const [key,value]of before)assert.equal(after.get(key)&255,value&255,'no edge may be filled or removed');
 for(const value of after.values())if((value&255)===2)assert.equal(value>>8,0,'shared edge directions must oppose');
 const ids=meshes[0].indices;for(let i=0;i<ids.length;i+=3){const [a,b,c]=ids.subarray(i,i+3);assert((positions[b*3]-positions[a*3])*(positions[c*3+1]-positions[a*3+1])-(positions[b*3+1]-positions[a*3+1])*(positions[c*3]-positions[a*3])>0,'component must retain source outward direction');}
 assert.deepEqual(positions,copy);assert.deepEqual([...meshes[1].indices],[0,2,1]);
 assert.equal(orientSkinFaces(meshes,positions,normals,counts(meshes)).reorientedSkinTriangles,0,'repair is idempotent');
}
console.log(JSON.stringify({schema:'human/surface_repair_regression@1',allocationAndWindingPassed:true,applicationFunctionsExecuted:true,browserExecuted:false,gpuExecuted:false}));
