// Small synthetic integration of production CPU methods; no character or GPU.
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base=new URL('../',import.meta.url);
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('vendor/three.module.js',base).href,shortCircuit:true}:next(s,c);}});
const THREE=await import('three'),{ShortsClothRuntime}=await import('../ShortsClothRuntime.mjs');
const draft={positions:[0,0,0,.12,0,0,0,.1,0],sourceUV:[0,0,.1,0,0,.1],triangles:[0,1,2],ranges:[{pieceId:'test',offset:0,count:3}],seams:[],waistIndices:[0,1],casing:{stitchPaths:[]}};
const scene=new THREE.Scene(),actor=new THREE.Group();scene.add(actor);actor.updateMatrixWorld(true);
const body={refitExact(){},collide(){return null;},snapshot(){return null;},update(){}};
const material={warpNPerM:1000,weftNPerM:500,shearNPerM:200}; // synthetic values, NOT measured linen
const r=new ShortsClothRuntime(draft,body,actor,scene,{membraneModel:'orthotropic-paper',paperMaterial:material,elasticEnabled:false});
const identity=r.materialIdentity(),initial=r.audit(false).mainStrain;
const centroid=()=>r.positions[0].map((_,k)=>r.positions.reduce((s,p,i)=>s+p[k]*r.mass[i],0)/r.mass.reduce((s,m)=>s+m,0));
const beforeCentroid=centroid();r.resetMaterialMultipliers();
for(let i=0;i<12;i++)r.solveMainMaterial(1/60);
const after=r.audit(false).mainStrain;
assert(after<initial);assert.equal(r.materialIdentity(),identity);assert.equal(r.time,0);assert.equal(r.steps,0);
assert(r.positions.every(p=>p.every(Number.isFinite)));assert(Math.max(...centroid().map((x,k)=>Math.abs(x-beforeCentroid[k])))<1e-12);
assert(Math.abs(r.mass.reduce((s,m)=>s+m,0)-.0011)<1e-12);
assert(r.triangles[0].paperLambdas.some(x=>x!==0));r.resetMaterialMultipliers();assert(r.triangles[0].paperLambdas.every(x=>x===0));
material.warpNPerM=1;assert.equal(r.options.paperMaterial.warpNPerM,1000);
const sha=name=>createHash('sha256').update(readFileSync(new URL(name,base))).digest('hex');
const report={passed:true,scope:'synthetic single triangle invokes actual production membrane methods; no native body, GPU, cloth calibration or complete garment acceptance',initialPrincipalStrain:initial,afterPrincipalStrain:after,sourceMetricMassIdentityRetained:true,massKg:r.mass.reduce((s,m)=>s+m,0),time:r.time,steps:r.steps,productionReady:false,sourceHashes:{runtime:sha('ShortsClothRuntime.mjs'),math:sha('ShortsPaperSurfaceModel.mjs')}};
writeFileSync(new URL('qa/shorts-paper-runtime-20261003.json',base),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));r.dispose();
