/** Reuse the exact pinned human-workbench Anny forward pass. No shoe mesh imports. */
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIR=path.join(process.env.SHOE_DEPS||'/mnt/data/shoe-deps','human');
const {AnnyModel}=await import(pathToFileURL(path.join(DIR,'AnnyModel.mjs')));
const sha=b=>createHash('sha256').update(b).digest('hex');
const metadata=JSON.parse(fs.readFileSync(path.join(DIR,'anny-model.json')));
const chunks=metadata.binary.compressed.parts.map(x=>{const b=fs.readFileSync(path.join(DIR,path.basename(x.url)));if(sha(b)!==x.sha256)throw Error('Anny part digest mismatch');return b;});
const raw=gunzipSync(Buffer.concat(chunks));if(sha(raw)!==metadata.binary.sha256)throw Error('Anny decoded digest mismatch');
const native=new AnnyModel(metadata,raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
const round=v=>Math.round(v*1e6)/1e6;
const profiles=[
 {id:'standard',name:'标准人台',label:'原生 Anny · 标准成人',phenotypes:{gender:.15,age:2/3,muscle:.5,weight:.5,height:.42,proportions:.5}},
 {id:'slender',name:'纤细人台',label:'原生 Anny · 纤细成人',phenotypes:{gender:.9,age:2/3,muscle:.35,weight:.35,height:.42,proportions:.5}},
 {id:'broad',name:'壮实体型',label:'原生 Anny · 壮实成人',phenotypes:{gender:.1,age:2/3,muscle:.65,weight:.75,height:.40,proportions:.5}}
];
const faces=Array.from(native.arrays.faces);
function section(vertices,foot,ratio){
 const z=foot.heelZ+ratio*foot.length,points=[],segments=[];let perimeter=0;
 for(let i=0;i<faces.length;i+=3){const t=faces.slice(i,i+3).map(k=>vertices.slice(k*3,k*3+3));if(t.some(p=>p[0]*foot.sign<.04))continue;const hit=[];
  for(let e=0;e<3;e++){const a=t[e],b=t[(e+1)%3];if((a[2]<z)===(b[2]<z)||a[2]===b[2])continue;const f=(z-a[2])/(b[2]-a[2]);hit.push(a.map((x,k)=>x+(b[k]-x)*f));}
  if(hit.length===2&&hit.every(p=>p[1]<.18)){perimeter+=Math.hypot(...hit[0].map((x,k)=>x-hit[1][k]));points.push(...hit);segments.push(hit.map(p=>[p[0]-foot.ankleX,p[1],p[2]-foot.heelZ].map(round)));}
 }
 if(!points.length)return null;const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return {ratio,girth:round(perimeter),width:round(Math.max(...xs)-Math.min(...xs)),height:round(Math.max(...ys)),bottom:round(Math.min(...ys)),segments};
}
const bodies=[];
for(const spec of profiles){
 const result=native.forward({phenotypes:spec.phenotypes});const original=result.vertices;let floor=Infinity;for(let i=2;i<original.length;i+=3)floor=Math.min(floor,original[i]);
 const positions=[];for(let i=0;i<original.length;i+=3)positions.push(round(original[i]),round(original[i+2]-floor),round(-original[i+1]));
 const joints=Object.fromEntries(native.boneLabels.map((l,i)=>[l,[result.boneHeads[i*3],result.boneHeads[i*3+2]-floor,-result.boneHeads[i*3+1]].map(round)]));const feet=[];
 for(const [side,sign]of [['L',1],['R',-1]]){
  const pts=[];for(let i=0;i<positions.length;i+=3)if(positions[i]*sign>.06&&positions[i+1]<.11)pts.push(positions.slice(i,i+3));
  const ankle=joints['foot.'+side],heelZ=Math.min(...pts.map(p=>p[2])),toeZ=Math.max(...pts.map(p=>p[2]));
  const f={side,sign,ankleX:ankle[0],ankleZ:ankle[2],ankleY:ankle[1],heelZ:round(heelZ),length:round(toeZ-heelZ),width:round(Math.max(...pts.map(p=>p[0]))-Math.min(...pts.map(p=>p[0])))};
  f.ball=section(positions,f,.72);f.instep=section(positions,f,.48);f.heel=section(positions,f,.14);f.ankleLocal=[0,ankle[1],round(ankle[2]-heelZ)];
  f.samples=[];for(let i=0;i<positions.length;i+=3)if(positions[i]*sign>.06&&positions[i+1]<.22)f.samples.push([round(positions[i]-ankle[0]),positions[i+1],round(positions[i+2]-heelZ)]);
  f.stations=Array.from({length:41},(_,i)=>{const s=i/40;const q=f.samples.filter(p=>Math.abs(p[2]-s*f.length)<f.length/55&&p[1]<.115);return q.length?{s,min:Math.min(...q.map(p=>p[0])),max:Math.max(...q.map(p=>p[0])),top:Math.max(...q.map(p=>p[1]))}:null;});feet.push(f);
 }
 bodies.push({...spec,source:'kaopu-unified-human-workbench/full/source/neck-baseline/src/AnnyModel.js',sourceCommit:'900d68a6206b9f8d220dff5a6c34fb0aa683deb5',proportionRevision:'shoe-r01-native-'+spec.id,positions,positionsSha256:sha(new Float32Array(positions)),joints,height:round(Math.max(...positions.filter((_,i)=>i%3===1))),feet});
}
const pack={schema:'kaopu-shoe-body-pack/1',units:'metre',axes:{up:'Y',forward:'Z',transformFromSource:'(x,y,z)->(x,z-sourceFloor,-y)'},sourceCommit:'900d68a6206b9f8d220dff5a6c34fb0aa683deb5',sourceModelSha256:metadata.binary.sha256,faceSha256:sha(native.arrays.faces),faces,bodies,scope:'Static snapshots of the unchanged Anny body used by the common human workbench. Does not include its GNM face, MHR driver, or live parameter solver.'};
fs.mkdirSync(path.join(ROOT,'assets'),{recursive:true});fs.writeFileSync(path.join(ROOT,'assets/body-pack.json'),JSON.stringify(pack));fs.writeFileSync(path.join(ROOT,'assets/body-pack.json.gz'),gzipSync(JSON.stringify(pack),{level:9}));
fs.writeFileSync(path.join(ROOT,'assets/BODY-PROVENANCE.json'),JSON.stringify({...pack,faces:undefined,bodies:bodies.map(({positions,feet,...b})=>({...b,feet:feet.map(({samples,stations,...f})=>f)}))},null,2));
console.log(JSON.stringify({bodies:bodies.map(b=>({id:b.id,height:b.height,feet:b.feet.map(f=>({side:f.side,length:f.length,width:f.width,ballGirth:f.ball.girth,instepGirth:f.instep.girth}))})),gzipBytes:fs.statSync(path.join(ROOT,'assets/body-pack.json.gz')).size},null,2));
