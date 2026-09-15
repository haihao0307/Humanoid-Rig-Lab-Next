// Behavioural regressions for the authored guides, without a browser or GPU.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveHairProfile} from '../reconstruction/hair-profile.mjs';
import {createHairStyle} from '../reconstruction/hair-styles.mjs';
import {scalpBoundary} from '../reconstruction/hair-zones.mjs';
const json=async name=>JSON.parse(await readFile(new URL('../reconstruction/'+name,import.meta.url),'utf8'));
const catalog=await json('hair-presets.json'),rules=await json('hair-rules-r2.json');
const centre=[0,1.54,.09],radius=.10,unit=n=>n.map(v=>v/Math.hypot(...n));
const rootAt=n=>unit(n).map((v,k)=>centre[k]+v*radius);
let checks=0;
for(const preset of catalog.presets.filter(p=>p.design))for(const lengthScale of [.65,1,1.35]){
 const resolved=resolveHairProfile({preset:preset.id,lengthScale},0,catalog,rules);
 const style=createHairStyle(resolved,{centre,thetaMax:Math.PI},()=>radius);
 if(['bob','wavy-bob'].includes(preset.id))for(const u of [.02,.25,.5,.75,.98])for(const v of [.36,.49,.64]){
  const point=style.specs[0].point,epsilon=.0001,p=point(u,v),a=point(u,v-epsilon),b=point(u,v+epsilon);
  const left=p.map((x,k)=>x-a[k]),right=b.map((x,k)=>x-p[k]);
  const agreement=left.reduce((sum,x,k)=>sum+x*right[k],0)/(Math.hypot(...left)*Math.hypot(...right));
  assert(agreement>.995,'The curved crown and hanging bob must meet without a horizontal tangent crease');checks++;
 }
 for(const n of [[.2,.9,.3],[.6,.35,.7],[.65,-.45,-.61],[-.5,-.70,-.5]]){
  const root=rootAt(n),curve=style.curve({id:'guide-regression/'+n.join(','),point:()=>root});
  assert.deepEqual(curve(0),root,'Changing a haircut must not move its follicle attachment');checks++;
  const points=Array.from({length:65},(_,i)=>curve(i/64));
  assert(points.every(p=>p.every(Number.isFinite)),'Every guide must remain finite');checks++;
  if(preset.id==='ponytail'&&n[1]<0){
   assert(Math.max(...points.map(p=>p[1]))<centre[1]+.015,'A low nape strand must gather directly to a low ponytail, without climbing over the crown');checks++;
  }
  if(['bob','wavy-bob'].includes(preset.id)){
   assert(curve(1)[1]<root[1]-.006,'A loose bob must fall below its root, including roots at the nape');checks++;
  }
 }
 const before=style.specs[0].point(.5,.5),rows=16,columns=48,positions=[];
 for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){
  const theta=y/rows*Math.PI,phi=x/columns*2*Math.PI;
  positions.push(...[Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi)].map((v,k)=>centre[k]+v*.11));
 }
 style.attachSupport({rows,columns,positions:new Float32Array(positions)});
 const after=style.specs[0].point(.5,.5);
 assert(Math.hypot(...after.map((v,k)=>v-before[k]))>.009,'Outer locks must clear a raised undergrowth support instead of intersecting it');checks++;
 if(preset.id==='ponytail'){
  const route=Array.from({length:33},(_,i)=>style.specs[2].point(.5+1.30/(2*Math.PI),i/32));
  assert(route.every(p=>{const n=unit(p.map((v,k)=>v-centre[k])),az=Math.atan2(n[0],n[2]);return Math.acos(n[1])<scalpBoundary(Math.abs(az),Math.sign(az),resolved.rules).theta;}),'A tight ponytail must route sideburn locks around the ear notch');checks++;
 }
}
console.log(JSON.stringify({checks,passed:true,scope:'guide attachment, finite coordinates, low gathering, gravity and support clearance; synthetic head only',applicationExecuted:false,visualAcceptance:false}));
