import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {ShoeAssembly,defaultState} from '../src/model.mjs';import {MeshRay} from '../../r07/src/ray.mjs';import {add,sub,mul,unit,dist} from '../../r07/src/geometry.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),load=p=>JSON.parse(fs.readFileSync(path.join(root,p))),out=path.join(root,'evidence/numerics');fs.mkdirSync(out,{recursive:true});
const manifest=load('BUILD_MANIFEST.json'),sourceBuild=manifest.sourceBuild,testCommit=process.env.GITHUB_SHA||'local';
const m=new ShoeAssembly(load('../r02/assets/teacher.json'),load('../r04/vendor/outsole.json')),s=defaultState(),parts=m.build(s),rays=parts.filter(p=>![19,29].includes(p.id)).map(p=>({id:p.id,ray:new MeshRay({positions:Array.from(p.geometry.attributes.position.array),indices:Array.from(p.geometry.index.array).slice(0,p.geometry.groups[0].count)})}));
const sole=m.fittedSole.userData.seating.finalWallContact;
// Preserve actual observations before assertions so a failed gate remains auditable.
fs.writeFileSync(path.join(out,'SOLE_CONTACT.json'),JSON.stringify({sourceBuild,testCommit,...sole},null,2));
const core=sole.measurements.filter(x=>Math.sin(x.angle)>=.92);
assert.ok(core.length>=200);assert.equal(core.length,sole.coreSamples);
assert.ok(core.every(x=>Number.isFinite(x.gapMm)&&Number.isFinite(x.finalGapMm)),'No missing final sole rays');
// R08 required an old defect (>0) as a fixture. R09 changed the actual cut, so
// zero prior defects is valid. Count raw measurements rather than trust a flag.
assert.equal(sole.detectedOldProtrusions,core.filter(x=>x.gapMm<0).length);
assert.equal(sole.remainingSampledProtrusions,core.filter(x=>x.finalGapMm<-.005).length);
assert.equal(sole.remainingSampledProtrusions,0);assert.ok(sole.maxMoveMm<=.8);assert.ok(sole.minSampledJacobian>0);
assert.equal(sole.affineSubdivision.reversedSourceChildren,0);assert.ok(sole.affineSubdivision.maxSourceAreaRelativeError<1e-6);
const rails=[];for(const id of [22,23]){const a=m.seams.filter(j=>j.id.startsWith('back-binding-'+id));assert.equal(a.length,1,'Native rear rail still has a phantom seam break');const j=a[0],st=m.stations(j,s);assert.ok(st.length>=18);const lengths=st.slice(1).map((h,i)=>dist(h.outer,st[i].outer));assert.ok(Math.max(...lengths)<3);rails.push({id:j.id,stations:st.length,maxStepMm:Math.max(...lengths),first:st[0].outer,last:st.at(-1).outer});}
const result=[];for(const j of m.seams.filter(j=>!j.buried))for(let i=0;i<j.qa.length-1;i++)for(const fraction of [.25,.5,.75]){const h=m.frame(j,i+fraction,s),N=unit(sub(h.outer,h.inner)),origin=add(h.outer,mul(N,.75)),blocked=[];for(const r of rays){const hit=r.ray.ray(origin,mul(N,-1));if(hit&&hit.distance<.70)blocked.push({id:r.id,distance:hit.distance});}result.push({join:j.id,index:i,fraction,blocked});}
const occluded=result.filter(r=>r.blocked.length),report={sourceBuild,testCommit,rails,samples:result.length,occluded,result,success:result.length>600&&occluded.length===0,scope:'Default thickness only; quarter/midpoint normal rays against all upper shells. Retained exposed spans, not every viewpoint, silhouette, yarn volume or full-shell collision proof.'};
fs.writeFileSync(path.join(out,'EXPOSURE.json'),JSON.stringify(report,null,2));assert.ok(result.length>600);assert.equal(occluded.length,0);
console.log('EXPOSURE PASS',result.length,'normal-ray samples, no blocker; continuous native rear rails; actual sampled forefoot wall clear');
