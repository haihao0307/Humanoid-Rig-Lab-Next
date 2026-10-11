'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const B=require('./runtime-budget.js'),C=require('./core.js'),N=require('./natural-yarn.js'),S=require('./stitches.js');
let checks=0;const g=C.compile({cotton:.78,slub:.55});const nat=N.generate(C,g,4);
// Every selected point must decode to exactly the original Float32 ribbon attributes.
const selection=nat.fibers.filter((_,i)=>i%71===0),old=N.hairMesh(selection),v=new Float32Array(old.vertices),packed=B.packFibers(selection);
let point=0;
for(let i=0;i<selection.length;i++)for(let j=0;j<selection[i].points.length;j++,point++){
 const d=packed.data.subarray(point*8,point*8+8),m=packed.meta.subarray(i*4,i*4+4);
 for(let side=0;side<2;side++){
  const decoded=[d[0],d[1],d[2],side?1:-1,m[1],d[7],m[0],m[2],d[4],d[5],d[6],m[3]],original=v.subarray((point*2+side)*12,(point*2+side+1)*12);
  assert.deepEqual(new Float32Array(decoded),original);checks++;
 }
}
assert.equal(point,packed.points);
const rows=[];
for(let weave=0;weave<4;weave++){
 const graph=C.compile({weave,cotton:.78,slub:.55}),m=S.make(C,N,graph,4);
 assert.ok(m.vertices.every(Number.isFinite));assert.ok(m.indices.every(i=>i<m.vertices.length/12));assert.equal(m.stitches.length,m.audit.stitches);
 for(const s of m.stitches){assert.deepEqual(s.entry.slice(),s.topRoot.slice(0,2));assert.equal(s.topRoot[2],-.028);assert.equal(s.bottomRoot[2],.028);assert.ok(Math.abs(s.bottomRoot[1]-s.topRoot[1]-.06)<1e-10);checks++;}
 rows.push({weave,stitches:m.audit.stitches,triangles:m.indices.length/3,bytes:m.vertices.byteLength+m.indices.byteLength});
}
// Identity clip matrix: an inside box remains, a box entirely outside is rejected.
const eye=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);const visible=B.visibility(eye,{shape:0,structure:0},72,0);
assert.ok(visible(-.1,-.1,.1,.1,.05));assert.ok(!visible(50,50,51,51,.05));

// Storage/cache contract using a minimal GL recording surface; raster checks remain separate.
let indexWrites=0,lastIndex=null,deleted=0;
const gl={MAX_TEXTURE_SIZE:1,TEXTURE_2D:2,RGBA32F:3,RGBA:4,FLOAT:5,TEXTURE_MIN_FILTER:6,TEXTURE_MAG_FILTER:7,TEXTURE_WRAP_S:8,TEXTURE_WRAP_T:9,NEAREST:10,CLAMP_TO_EDGE:11,ELEMENT_ARRAY_BUFFER:12,DYNAMIC_DRAW:13,
getParameter:()=>4096,createTexture:()=>({}),bindTexture:()=>{},texStorage2D:()=>{},texSubImage2D:()=>{},texParameteri:()=>{},createVertexArray:()=>({}),createBuffer:()=>({}),bindVertexArray:()=>{},bindBuffer:()=>{},bufferData:()=>{},bufferSubData:(_t,_o,data)=>{indexWrites++;lastIndex=new Uint32Array(data);},deleteVertexArray:()=>{deleted++;},deleteBuffer:()=>{deleted++;},deleteTexture:()=>{deleted++;}};
const store=B.makeFiberStore(gl,selection),firstIndex=new Uint32Array(lastIndex),firstWrites=indexWrites;
assert.equal(store.update(()=>true),false);assert.equal(indexWrites,firstWrites);
store.update((_x,y)=>y>0);const filteredCount=store.visibleCurves;assert.ok(filteredCount>0&&filteredCount<selection.length);const filteredWrites=indexWrites;
assert.equal(store.update((_x,y)=>y>0),false);assert.equal(indexWrites,filteredWrites);
assert.equal(store.update(()=>true),true);assert.deepEqual(lastIndex,firstIndex);
assert.equal(Array.from(lastIndex).filter(i=>i===0xffffffff).length,selection.length);
store.destroy();assert.equal(deleted,4);checks+=8;
const report={passed:true,unchangedVisibleSetSkipsUpload:true,cacheTests:8,sampledAttributeChecks:checks,selectedCurves:selection.length,selectedPoints:point,oldRibbonBytes:(v.length+old.indices.length)*4,newPointBytes:packed.data.byteLength+packed.meta.byteLength,newIndexUpperBound:packed.indexCapacity*4,stitchVariants:rows,limitations:['Exact Float32 attributes on sampled curves, not universal visual proof','Sewing path is geometry only: no physical needle force, no actual punched hole or guaranteed global contact','Frustum edge and movement image regressions are separate tests']};
fs.writeFileSync(path.join(__dirname,'budget-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
