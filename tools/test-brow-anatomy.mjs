// Isolated procedural groom checks. These do not constitute visual approval.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../body/BrowAnatomy.js',import.meta.url),'utf8');
const context=vm.createContext({});
new vm.Script(source+'\n;globalThis.api={create:compactCreateBrows,profile:compactBrowProfile,parameters:COMPACT_BROW_ANATOMY};').runInContext(context);
const {create,profile,parameters}=context.api;
const skin=(x,y)=>.170-.6*x*x-1.3*(y-1.53)**2+.07*x;
const mesh=create(skin),again=create(skin),different=create(skin,{seed:731}),p=mesh.report.parameters;
assert.deepEqual(mesh.positions,again.positions,'fixed seed is reproducible');
assert.notDeepEqual(mesh.positions,different.positions,'seed changes root locations');
assert.equal(mesh.report.hairs,p.strandsPerSide*2);
assert.equal(mesh.positions.length/3,mesh.normals.length/2);
assert(mesh.positions.length/3<65535,'fits existing Uint16 assembly');
assert(mesh.positions.every(Number.isFinite),'finite coordinates');
assert(mesh.normals.every(v=>Number.isInteger(v)&&v>=-32767&&v<=32767),'valid encoded normals');
assert.equal(mesh.indices.length/3,2*p.strandsPerSide*(2*p.sides*p.segments+2*p.sides));
const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>{const d=Math.hypot(...a);return a.map(v=>v/d);};
function decode(x,y){x/=32767;y/=32767;const z=1-Math.abs(x)-Math.abs(y);if(z<0){const old=x;x=(1-Math.abs(y))*(old<0?-1:1);y=(1-Math.abs(old))*(y<0?-1:1);}return norm([x,y,z]);}
let minimumArea=Infinity,minNormalAgreement=1,maxRootDepthError=0,headRise=0,tailAdvance=0;
const edges=new Map();
for(let i=0;i<mesh.indices.length;i+=3){
  const ids=mesh.indices.slice(i,i+3),points=ids.map(id=>mesh.positions.slice(id*3,id*3+3));
  for(const id of ids)assert(id>=0&&id<mesh.positions.length/3,'in-range index');
  const a=cross(sub(points[1],points[0]),sub(points[2],points[0])),area=Math.hypot(...a)/2;
  assert(area>1e-15,'nondegenerate fibre triangle');minimumArea=Math.min(minimumArea,area);
  const normals=ids.map(id=>decode(...mesh.normals.slice(id*2,id*2+2))),average=norm(normals[0].map((v,k)=>v+normals[1][k]+normals[2][k]));
  const agreement=dot(norm(a),average);assert(agreement>0,'normals match outward winding');minNormalAgreement=Math.min(minNormalAgreement,agreement);
  for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=a<b?a+','+b:b+','+a;edges.set(key,(edges.get(key)||0)+1);}
}
assert([...edges.values()].every(v=>v===2),'each fibre is a closed manifold');
assert.equal(mesh.report.vertices-edges.size+mesh.report.triangles,mesh.report.hairs*2,'one genus-zero component per fibre');
for(const r of mesh.roots){
  const expected=-r.radiusM*.35,actual=r.point[2]-skin(r.point[0],r.point[1]);maxRootDepthError=Math.max(maxRootDepthError,Math.abs(actual-expected));
  assert(Math.abs(actual-expected)<1e-12,'root emerges from skin');
  assert(r.side*(r.tip[0]-r.point[0])>0,'hair follows side outward');
  if(r.t<.06){assert(r.tip[1]>r.point[1],'head hairs incline upwards');headRise++;}
  if(r.t>.8){assert(Math.abs(r.tip[0]-r.point[0])>Math.abs(r.tip[1]-r.point[1]),'tail hairs run mainly outward');tailAdvance++;}
}
assert(headRise>10&&tailAdvance>50,'groom actually exercises head and tail');
const centre=profile(.5,p),head=profile(0,p),tail=profile(1,p);
assert(centre.y-head.y<.00135&&centre.y-tail.y<.0018,'low arc avoids earlier high triangle');
assert(centre.half>tail.half*3,'body retains a tapered tail');
const budget=create(skin,{strandsPerSide:10000,segments:20,sides:20});
assert(budget.report.vertices<65535,'parameter bounds cannot overflow Uint16');
assert.throws(()=>create(skin,{centreYM:NaN}),/Non-finite/);
console.log(JSON.stringify({hairs:mesh.report.hairs,vertices:mesh.report.vertices,triangles:mesh.report.triangles,minimumArea,minNormalAgreement,maxRootDepthError,regions:mesh.report.regionCounts,bounds:mesh.report.bounds,parameterBudgetVertices:budget.report.vertices,visualAcceptance:false},null,2));
