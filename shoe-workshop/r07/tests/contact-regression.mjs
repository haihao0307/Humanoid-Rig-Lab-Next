import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {before as beforeModel,bp,after as afterModel,parts as afterParts,state} from './finish.mjs';
import {MeshRay} from '../src/ray.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),source=fs.readFileSync(path.join(root,'../r02/assets/teacher.json')),data=JSON.parse(source),outsole=JSON.parse(fs.readFileSync(path.join(root,'../r04/vendor/outsole.json'))),checks=[];
const check=(name,fn)=>{try{fn();checks.push({name,passed:true});console.log('CONTACT PASS',name);}catch(e){checks.push({name,passed:false,error:String(e)});console.log('CONTACT FAIL',name,String(e));}},hash=b=>createHash('sha256').update(b).digest('hex');
const rayFor=(g,outer=false)=>new MeshRay({positions:Array.from(g.attributes.position.array),indices:Array.from(g.index.array).slice(0,outer?g.groups[0].count:g.index.count)});
function coverage(model,parts){
 const last=rayFor(model.lastGeometry()),rays=parts.filter(p=>[22,23,28].includes(p.id)).map(p=>rayFor(p.geometry)),result=[];
 for(const side of [-1,1]){let tested=0;const misses=[];
  for(let z=-36;z<=42;z++)for(let y=25;y<=88;y++){
   const origin=[side*180,y,z],dir=[-side,0,0],h=last.ray(origin,dir);if(!h)continue;tested++;
   if(!rays.some(r=>{const q=r.ray(origin,dir);return q&&q.distance<=h.distance+.5;}))misses.push({z,y,lastPoint:h.p});
  }
  result.push({side,tested,misses});
 }
 return {model,parts,result};
}
const before=coverage(beforeModel,bp),after=coverage(afterModel,afterParts);
check('R06 baseline remains covered on the same grid',()=>assert.equal(before.result.reduce((s,r)=>s+r.misses.length,0),0));
for(let i=0;i<2;i++)check('R07 preserves repaired quarter-vamp coverage on side '+after.result[i].side,()=>{assert.equal(after.result[i].tested,4878);assert.equal(after.result[i].tested,before.result[i].tested);assert.equal(after.result[i].misses.length,0);});
check('same ten actual sheets; no hidden cover mesh introduced',()=>assert.deepEqual(after.parts.map(p=>p.id),before.parts.map(p=>p.id)));
const stacking=[];
for(const [id,parent]of [[22,28],[23,28],[24,22],[25,23],[27,28]]){
 const child=after.parts.find(p=>p.id===id).geometry,host=rayFor(after.parts.find(p=>p.id===parent).geometry,true),a=child.attributes.position.array,gaps=[];
 for(let i=0;i<child.userData.vertexPairs;i+=3){const p=Array.from(a.slice(i*3,i*3+3)),n=child.userData.normals[i],h=host.ray(p.map((v,k)=>v+n[k]*10),n.map(v=>-v));if(h&&h.distance<14)gaps.push(h.distance-10);}
 gaps.sort((a,b)=>a-b);const record={id,parent,tested:gaps.length,minMm:gaps[0],medianMm:gaps[gaps.length>>1],maxMm:gaps.at(-1),penetratingSamples:gaps.filter(v=>v<-.001).length};stacking.push(record);console.log('LAYER',JSON.stringify(record));
 check(`P${id}/P${parent} tested layer points do not interpenetrate`,()=>{assert.ok(record.tested>100);assert.equal(record.penetratingSamples,0);});
}
check('paired shell seating is bounded and does not counterfeit a collision proof',()=>{for(const r of after.model.seating){assert.ok(r.maxLiftMm<=.6);assert.equal(r.wholeSurfaceCollisionProof,false);}});
check('original pattern records and last bytes are unchanged',()=>{assert.deepEqual(data,JSON.parse(source));assert.equal(hash(source),hash(fs.readFileSync(path.join(root,'../r02/assets/teacher.json'))));});
check('source and target harmonic charts remain nonflipped',()=>{for(const a of Object.values(after.model.atlases)){assert.equal(a.report.source.flipped,0);assert.equal(a.report.target.flipped,0);}});
check('manufacturing and force solving remain explicitly unapproved',()=>{const r=after.model.report(state,after.parts);assert.equal(r.physicalSolver,false);assert.equal(r.manufacturingApproved,false);assert.equal(r.fullShellSelfIntersectionVerified,false);});
const report={version:'R07.0',sourceBuild:process.env.GITHUB_SHA||'local',checks,coverage:{sampling:'world millimetres; z=-36..42,y=25..88,1mm grid; side rays x=+/-180; only two bounded quarter-vamp regions',before:before.result,after:after.result},stacking,seating:after.model.seating,sourceSHA256:hash(source),limits:'Finite rays and selected layer points only, not full-edge/whole-triangle collision freedom, material force solve, lace-rim tension, or manufacturing validation.'};
fs.mkdirSync(path.join(root,'evidence/numerics'),{recursive:true});fs.writeFileSync(path.join(root,'evidence/numerics/CONTACT.json'),JSON.stringify(report,null,2));
assert.equal(checks.filter(c=>!c.passed).length,0);console.log('CONTACT PASS',checks.length);
