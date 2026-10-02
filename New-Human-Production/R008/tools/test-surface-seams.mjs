import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {decodeParameters} from '../parameter-codec.mjs';
import {generateSurface} from '../surface-generator.mjs';
const raw=zlib.gunzipSync(fs.readFileSync(new URL('../parameters.phf.gz',import.meta.url)));
const data=decodeParameters(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
export function auditSurface(s){
 const canonical=new Map(),ids=[],edges=new Map(),used=new Set(),chart=new Map(data.charts.map(c=>[c.id,c]));
 for(let i=0;i<s.positions.length/3;i++){const key=[0,1,2].map(k=>Math.round(s.positions[i*3+k]*1e6)).join(',');if(!canonical.has(key))canonical.set(key,canonical.size);ids.push(canonical.get(key));}
 for(let i=0;i<s.indices.length;i+=3)for(let e=0;e<3;e++){const a=s.indices[i+e],b=s.indices[i+(e+1)%3];used.add(a);const x=ids[a],y=ids[b],key=x<y?`${x}:${y}`:`${y}:${x}`;const row=edges.get(key);if(row)row.count++;else edges.set(key,{a,b,count:1});}
 const open=[],regions={};for(const {a,b,count} of edges.values())if(count===1){const p=Array.from(s.positions.subarray(a*3,a*3+3)),q=Array.from(s.positions.subarray(b*3,b*3+3)),length=Math.hypot(...p.map((v,k)=>v-q[k])),region=chart.get(s.chartIds[a]).anatomy;open.push({a,b,p,q,length,region});regions[region]=(regions[region]||0)+1;}
 const adj=new Map();for(const e of open)for(const [a,b]of [[ids[e.a],ids[e.b]],[ids[e.b],ids[e.a]]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);}const seen=new Set(),components=[];for(const id of adj.keys()){if(seen.has(id))continue;const queue=[id];seen.add(id);for(let at=0;at<queue.length;at++)for(const next of adj.get(queue[at]))if(!seen.has(next)){queue.push(next);seen.add(next);}components.push({size:queue.length,degrees:queue.reduce((o,id)=>(o[adj.get(id).length]=(o[adj.get(id).length]||0)+1,o),{})});}
 return {vertices:s.report.vertices,triangles:s.report.triangles,unused:s.report.vertices-used.size,openEdges:open.length,edgeIncidences:[...edges.values()].reduce((h,e)=>(h[e.count]=(h[e.count]||0)+1,h),{}),openLengthMetres:open.reduce((v,e)=>v+e.length,0),regions,components,longest:open.sort((a,b)=>b.length-a.length).slice(0,10)};
}
const packageHash=()=>crypto.createHash('sha256').update(fs.readFileSync(new URL('../parameters.phf.gz',import.meta.url))).digest('hex');
const before=packageHash();for(const edgeMetres of process.argv.includes('--all')?[.020,.012,.006]:[.012]){const start=performance.now(),s=generateSurface(data,{edgeMetres}),audit=auditSurface(s);assert.equal(audit.openEdges,0);assert.equal(s.report.seams.unresolvedBoundaryEdges,0);assert(s.report.seams.maxCorrectionMetres<.002);assert(s.report.seams.maxPatchAreaSquareMetres<=.0002);assert.equal(s.report.emptyDomains,0);for(const a of [s.positions,s.normals,s.parameters,s.skinWeight])assert(a.every(Number.isFinite));for(const row of s.seamGroups){const a=row[0];for(const b of row){for(let k=0;k<3;k++)assert.equal(s.positions[a*3+k],s.positions[b*3+k]);for(let k=0;k<8;k++){assert.equal(s.skinIndex[a*8+k],s.skinIndex[b*8+k]);assert.equal(s.skinWeight[a*8+k],s.skinWeight[b*8+k]);}}}let sum=0;for(const g of s.groups){assert.equal(g.start,sum);assert(g.materialIndex>=0&&g.materialIndex<data.materials.length);sum+=g.count;}assert.equal(sum,s.indices.length);console.log(JSON.stringify({edgeMetres,milliseconds:performance.now()-start,...audit,seams:s.report.seams,continuousSeamGroups:s.seamGroups.length,passed:true}));}assert.equal(packageHash(),before);
