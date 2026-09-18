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

const faceSample=api.sample([{...skin,name:'skin'}]);
for(const y of [1.490,1.500,1.510,1.520]){const samples=[];for(let k=0;k<=16;k++){const x=k*.002;samples.push([k*2,...[-1,1].map(side=>{const z=faceSample(side*x,y);return z===null?null:+(z*1000).toFixed(2);})]);}console.log(JSON.stringify({y,samples}));}
