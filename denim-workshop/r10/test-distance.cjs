'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('./core.js'),N=require('./natural-yarn.js'),B=require('./runtime-budget.js'),LOD=require('./distance-lod.js');
let last=1,checks=0;for(let p=.001;p<30;p+=.001){const q=LOD.plan(p);A.ok(q.filtered<=last+1e-12);A.ok(q.micro>=0&&q.micro<=1&&q.filtered>=0&&q.filtered<=1);last=q.filtered;checks++;}
const g=C.compile({slub:.55,cotton:.78}),whole=N.generate(C,g,0),micro=N.generate(C,g,0,1,{boundary:false}),edge=N.generate(C,g,0,1,{micro:false});
const expected=whole.fibers.filter(c=>c.role==='surface'||c.role==='sheath');A.equal(expected.length,micro.fibers.length);A.equal(whole.fibers.length,edge.fibers.length+micro.fibers.length);A.equal(edge.tubes.length,whole.tubes.length);
const x=B.packFibers(expected),y=B.packFibers(micro.fibers);A.deepEqual(x.data,y.data);A.deepEqual(x.meta,y.meta);A.deepEqual(x.bounds,y.bounds);
A.ok(!edge.fibers.some(c=>c.role==='surface'||c.role==='sheath'));
const oldDynamics=fs.readFileSync(path.join(__dirname,'../r09/dynamics.js')),newDynamics=fs.readFileSync(path.join(__dirname,'dynamics.js'));A.deepEqual(oldDynamics,newDynamics);
const report={passed:true,footprintSamples:checks,settings:LOD.settings,fullCurves:whole.fibers.length,boundaryCurves:edge.fibers.length,onDemandMicroCurves:micro.fibers.length,byteIdenticalMicroPack:true,solverUnchanged:true,microTextureBytes:x.data.byteLength+x.meta.byteLength,microIndexCapacityBytes:x.indexCapacity*4,limits:['Swatch-level micro residency, not per-patch virtual geometry','Numeric tests are not motion image evidence or an alias-free proof']};
fs.writeFileSync(path.join(__dirname,'distance-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
