// Reconstruct the live detail parameters and test the facial source join.
// No browser, generated mesh file, or visual-acceptance claim is involved.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {decodeCompactHuman} from '../reconstruction/codec.mjs';
import {sampleCompactGroup,smoothAndQuantize} from '../reconstruction/mesher.mjs';
import {createCompactNormalField} from '../reconstruction/normal-field.mjs';
import {CanonicalTopology} from '../reconstruction/topology.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const load=async name=>(await decodeCompactHuman(readFileSync(new URL('../reconstruction/'+name+'.chf.gz',import.meta.url)))).data;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>mul(a,1/(Math.hypot(...a)||1)),influences=8,head=7;
const context=vm.createContext({add,sub,mul,cross,norm,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),COMPACT_INFLUENCES:influences});
new vm.Script(['body/EyeAnatomy.js','body/PerioralSurface.js','body/BrowAnatomy.js','body/BeardAnatomy.js','body/FaceAnatomy.js'].map(read).join('\n')+
  '\nglobalThis.api={sample:compactFaceRaySampler,create:compactCreateFaceAnatomy,parameters:COMPACT_FACE_ANATOMY};').runInContext(context);
const api=context.api,rig={jointIds:new Map([['head',head]])};
const [cx,cy,rx,ry]=api.parameters.ellipse;
const radius=(x,y)=>Math.hypot((x-cx)/rx,(y-cy)/ry);
const fittedSkin=meshes=>{
  const skin=api.create(meshes,rig,1).meshes.find(m=>m.name==='faceSkin');
  assert(skin&&skin.vertices>1000&&skin.triangles>1000,'source-fitted facial skin was not generated');
  return skin;
};

const [detail,normalData]=await Promise.all([load('detail'),load('normal-field')]);
const field=createCompactNormalField(normalData),topology=new CanonicalTopology(JSON.parse(read('reconstruction/rig-reference.json')));
const sampled=await sampleCompactGroup('detail',detail,'balanced',()=>{},field,JSON.parse(read('reconstruction/binding-schema.json')),topology);
const settled=topology.finalize(sampled.meshes);
const source=smoothAndQuantize(settled.meshes.map(m=>topology.materialize(m)),field).meshes.map(m=>({...m,canonicalPositions:m.positions}));
const sourceSample=api.sample(source),ellipseSamples=1440;
let minimumBoundaryDepthM=Infinity;
for(let i=0;i<ellipseSamples;i++){
  const angle=i*Math.PI*2/ellipseSamples,x=cx+rx*Math.cos(angle),y=cy+ry*Math.sin(angle),z=sourceSample(x,y);
  assert(z!==null&&Number.isFinite(z),'ellipse has no source support at angle '+angle);
  minimumBoundaryDepthM=Math.min(minimumBoundaryDepthM,z);
}

const fitted=api.create(source,rig,1),skin=fitted.meshes.find(m=>m.name==='faceSkin');
// Vertex agreement alone misses cracks where a dense triangle straddles a
// coarse source edge. Probe the rendered, linearly interpolated triangle
// interiors at the actual shader cut boundary as well.
const displaySample=api.sample([{...skin,name:'skin'}]);
let maximumBoundaryTriangleErrorM=0,maximumBoundaryNormalAngleDeg=0;
for(let i=0;i<ellipseSamples;i++){
  const angle=i*Math.PI*2/ellipseSamples,x=cx+rx*Math.cos(angle),y=cy+ry*Math.sin(angle),z=displaySample(x,y),original=sourceSample(x,y);
  assert(z!==null,'source-conforming join leaves a triangle-interior hole');
  const error=Math.abs(z-original);maximumBoundaryTriangleErrorM=Math.max(maximumBoundaryTriangleErrorM,error);
  assert(error<2e-6,'triangle-interior join separates from source by '+error+' m');
  const n=displaySample.normal(x,y),sn=sourceSample.normal(x,y),dot=n.reduce((sum,v,k)=>sum+v*sn[k],0),degrees=Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI;
  maximumBoundaryNormalAngleDeg=Math.max(maximumBoundaryNormalAngleDeg,degrees);
  assert(degrees<.25,'triangle-interior join has a shading-normal discontinuity');
}
// The old radial fade created a second central-chin peak after a local
// minimum. The authored lower-chin transition must have one rounded peak,
// followed by one labiomental valley, before entering the lower lip.
const chinSample=api.sample(fitted.meshes.filter(m=>m.name==='faceSkin'||(m.name==='faceLip'&&m.lipSurface==='vermilion')).map(m=>({...m,name:'skin'}))),chinProfile=[];
for(let i=0;i<=100;i++){const y=1.427+i*.00020,z=chinSample(cx,y);assert(z!==null,'visible lower-chin profile has a hole');chinProfile.push({y,z});}
let chinPeaks=0,chinValleys=0,previousSign=0;const chinExtrema=[];
for(let i=1;i<chinProfile.length;i++){
  const dz=chinProfile[i].z-chinProfile[i-1].z,sign=Math.abs(dz)<1e-7?previousSign:Math.sign(dz);
  if(previousSign&&sign!==previousSign){const kind=sign<0?'peak':'valley';if(sign<0)chinPeaks++;else chinValleys++;chinExtrema.push({kind,y:chinProfile[i-1].y,z:chinProfile[i-1].z});}
  previousSign=sign;
}
assert.equal(chinPeaks,1,'lower chin has extra geometric peaks');
assert.equal(chinValleys,1,'lower chin has extra geometric valleys');
assert(chinExtrema.find(p=>p.kind==='valley').y>1.443,'labiomental valley moved below its anatomical support');
// A smooth midline can coexist with vertical grooves between adjacent rails.
// Check the actual encoded/interpolated normals in two dimensions, not only
// the one-dimensional sagittal profile.
let maximumChinTransverseNormalStepDeg=0,chinTransverseSamples=0;
for(let y=1.432;y<=1.442;y+=.0005)for(let x=-.014;x<=.014;x+=.0005){
  const a=chinSample.normal(x,y),b=chinSample.normal(x+.00025,y);assert(a&&b,'chin normal probe has a hole');
  const dot=a.reduce((sum,v,k)=>sum+v*b[k],0),angle=Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI;
  maximumChinTransverseNormalStepDeg=Math.max(maximumChinTransverseNormalStepDeg,angle);chinTransverseSamples++;
}
assert(maximumChinTransverseNormalStepDeg<4,'source endpoint jets created sharp transverse shading grooves');
let boundaryVertices=0,maximumSourcePositionErrorM=0;
for(let i=0;i<skin.vertices;i++){
  const [x,y,z]=skin.canonicalPositions.subarray(i*3,i*3+3),r=radius(x,y);
  assert([x,y,z].every(Number.isFinite),'nonfinite generated face vertex '+i);
  if(r<.99||r>1.01)continue;
  const original=sourceSample(x,y);
  assert(original!==null&&Number.isFinite(original),'generated boundary vertex has no source support: '+i);
  const error=Math.abs(z-original);
  assert(error<2e-6,'generated boundary separates from source by '+error+' m at vertex '+i);
  maximumSourcePositionErrorM=Math.max(maximumSourcePositionErrorM,error);
  boundaryVertices++;
}
assert(boundaryVertices>500,'generated boundary sampling coverage regressed');
let reversedTriangles=0,degenerateTriangles=0;
for(let i=0;i<skin.indices.length;i+=3){
  const ids=Array.from(skin.indices.subarray(i,i+3));
  assert(ids.every(id=>id<skin.vertices),'invalid facial triangle index');
  const p=ids.map(id=>Array.from(skin.canonicalPositions.subarray(id*3,id*3+3))),n=cross(sub(p[1],p[0]),sub(p[2],p[0]));
  if(n[2]<0)reversedTriangles++;
  if(Math.hypot(...n)<1e-13)degenerateTriangles++;
}
assert.equal(reversedTriangles,0,'source-fitted face has reversed triangles');
assert.equal(degenerateTriangles,0,'source-fitted face has degenerate triangles');

// The three joint weights vary affinely across both source triangles. Rotate
// their slots at every corner so interpolation must combine joint identities.
const plane={name:'skin',canonicalPositions:Float32Array.from([-.09,1.40,.19,.09,1.40,.19,.09,1.62,.19,-.09,1.62,.19]),indices:Uint16Array.from([0,1,2,0,2,3]),
  binding:{ids:new Uint16Array(4*influences),weights:new Uint16Array(4*influences)}};
const jointIds=[head,3,2],cornerWeights=[[20000,30000,15535],[30000,20000,15535],[40000,15000,10535],[30000,25000,10535]];
for(let vertex=0;vertex<4;vertex++)for(let slot=0;slot<3;slot++){
  const j=(slot+vertex)%3,index=vertex*influences+slot;
  plane.binding.ids[index]=jointIds[j];plane.binding.weights[index]=cornerWeights[vertex][j];
}
const x0=plane.canonicalPositions[0],x1=plane.canonicalPositions[3],y0=plane.canonicalPositions[1],y1=plane.canonicalPositions[7];
const expectedBinding=(x,y)=>{
  const u=(x-x0)/(x1-x0),v=(y-y0)/(y1-y0);
  return new Map([[head,(20000+10000*u+10000*v)/65535],[3,(30000-10000*u-5000*v)/65535],[2,(15535-5000*v)/65535]]);
};
const planeSample=api.sample([plane]);
let bindingSamples=0;
for(const u of [.1,.3,.7,.9])for(const v of [.1,.3,.7,.9]){
  const x=x0+(x1-x0)*u,y=y0+(y1-y0)*v,actual=planeSample.binding(x,y),expected=expectedBinding(x,y);
  assert(actual&&actual.size===3,'source binding must retain all three joint identities');
  for(const [id,weight] of expected)assert(Math.abs(actual.get(id)-weight)<1e-12,'barycentric binding interpolation changed joint '+id);
  assert(Math.abs([...actual.values()].reduce((sum,w)=>sum+w,0)-1)<1e-12,'source binding is not normalized');
  bindingSamples++;
}
assert.equal(planeSample.binding(.10,1.51),null,'unsupported sample fabricated binding');
const unbound={name:plane.name,canonicalPositions:plane.canonicalPositions,indices:plane.indices};
assert.equal(api.sample([unbound]).binding(0,1.51),null,'unbound source fabricated binding');

const fixtureSkin=fittedSkin([plane]);
let retainedEdgeBindings=0,pureHeadCentreBindings=0,maximumEdgeWeightError=0;
for(let i=0;i<fixtureSkin.vertices;i++){
  const row=new Map(),offset=i*influences;
  let sum=0;
  for(let j=0;j<influences;j++){
    const id=fixtureSkin.binding.ids[offset+j],weight=fixtureSkin.binding.weights[offset+j];
    sum+=weight;if(weight)row.set(id,(row.get(id)||0)+weight);
  }
  assert.equal(sum,65535,'generated binding does not sum to 65535 at vertex '+i);
  const [x,y]=fixtureSkin.canonicalPositions.subarray(i*3,i*3+2),r=radius(x,y);
  if(r<=.5){
    assert.equal(row.size,1,'central facial skin retains non-head support');
    assert.equal(row.get(head),65535,'central facial skin is not rigidly head-bound');
    pureHeadCentreBindings++;
  }
  if(r<.99||r>1.01)continue;
  const expected=expectedBinding(x,y);
  assert.equal(row.size,3,'source boundary lost a joint influence');
  for(const [id,weight] of expected){
    // Float32 storage slightly moves x/y; allow two quantization units for
    // that resampling plus integer normalization of the largest influence.
    const error=Math.abs((row.get(id)||0)/65535-weight);
    assert(error<2/65535,'source binding changed at edge vertex '+i+', joint '+id);
    maximumEdgeWeightError=Math.max(maximumEdgeWeightError,error);
  }
  retainedEdgeBindings++;
}
assert(retainedEdgeBindings>500&&pureHeadCentreBindings>1000,'binding fixture coverage regressed');
console.log(JSON.stringify({schema:'human/face_source_boundary@1',ellipse:Array.from(api.parameters.ellipse),ellipseSamples,minimumBoundaryDepthM,
  vertices:skin.vertices,triangles:skin.triangles,boundaryVertices,maximumSourcePositionErrorM,maximumBoundaryTriangleErrorM,maximumBoundaryNormalAngleDeg,chinExtrema,maximumChinTransverseNormalStepDeg,chinTransverseSamples,reversedTriangles,degenerateTriangles,
  bindingSamples,retainedEdgeBindings,pureHeadCentreBindings,normalizedBindingVertices:fixtureSkin.vertices,maximumEdgeWeightError,
  browserExecuted:false,visualAcceptance:false}));
