'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const C=require('./core.js'),N=require('./natural-yarn.js'),F=require('./compact-fibers.js'),S=require('./lockstitch.js');
const oldC=require('../r08/core.js'),oldN=require('../r08/natural-yarn.js');
let checks=0;
function accumulator(){const h=crypto.createHash('sha256');let curves=0,points=0;return {add(c){h.update(JSON.stringify([c.kind,c.role,c.parentId??23,c.radius]));h.update(Buffer.from(new Float32Array(c.points.flat()).buffer));curves++;points+=c.points.length;},done(){return {sha:h.digest('hex'),curves,points};}};}
const rows=[];
for(let weave=0;weave<4;weave++)for(let damage=0;damage<5;damage++){
 const params={weave,slub:.55,cotton:.78,width:16,height:12},a=oldC.compile(params),b=C.compile({...params,compact:true});
 A.ok(b.curves.every(c=>c.points===null));A.deepEqual(C.audit(b),oldC.audit(a));
 const na=oldN.generate(oldC,a,damage),aa=accumulator();na.fibers.forEach(c=>aa.add(c));const ha=aa.done();
 const bb=accumulator();const nb=N.generate(C,b,damage,1,{onFiber:c=>bb.add(c)}),hb=bb.done();A.deepEqual(ha,hb);A.deepEqual(na.stats,nb.stats);A.deepEqual(N.audit(nb),oldN.audit(na));
 rows.push({weave,damage,...ha});checks++;
}
const writer=new F.Builder(),g=C.compile({slub:.55,cotton:.78,compact:true});N.generate(C,g,0,1,{onFiber:c=>writer.add(c)});
A.equal(writer.curves,39096);A.ok(writer.maxTangentError<.0001);A.ok(writer.maxLifeError<1/65535);const fiberBytes=Math.ceil(writer.count/1024)*1024*24;A.ok(fiberBytes<25000000);checks++;
let seed=812;for(let i=0;i<20000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;let z=seed/4294967296*2-1;seed=(Math.imul(seed,1664525)+1013904223)>>>0;let a=seed/4294967296*Math.PI*2,r=Math.sqrt(1-z*z),v=[Math.cos(a)*r,Math.sin(a)*r,z],d=F.decode(...F.oct(v));A.ok(Math.hypot(...v.map((x,k)=>x-d[k]))<.0001);checks++;}
const stitchRows=[];
for(const stitchCells of [4,7,10])for(const threadDiameter of [.06,.14,.18]){
 const s=S.generate(g,{stitchCells,threadDiameter},N);A.equal(s.stats.continuousThreads,4);A.equal(s.stats.needleSites,s.stats.stitches+2);A.ok(s.vertices.every(Number.isFinite));A.ok(s.indices.every(i=>i<s.vertices.length/11));
 for(const c of s.guides){let zs=c.points.map(p=>p[2]);A.ok(c.lower?Math.max(...zs)>-.03:Math.min(...zs)<-.2);}
 let gap=Infinity;for(const upper of s.guides.filter(c=>!c.lower))for(const lower of s.guides.filter(c=>c.lower&&c.row===upper.row))for(const p of upper.points)for(const q of lower.points)if(Math.abs(p[0]-q[0])<.4)gap=Math.min(gap,Math.hypot(...p.map((x,i)=>x-q[i])));
 // Report sampled guide separation; no assertion of cloth contact/global collision proof.
 stitchRows.push({...s.stats,minSampledThreadGuideDistanceMm:gap});checks++;
}
const report={passed:true,checks,matchedOldCurves:rows,defaultFiber:{curves:writer.curves,encodedPoints:writer.count,textureBytes:fiberBytes,maxTangentVectorError:writer.maxTangentError,maxLifeError:writer.maxLifeError},stitches:stitchRows,limits:['Guide position/count equality is not pixel or performance validation','Sampled thread centers do not certify global surface collision freedom','No real cloth sewing mechanics or wind-force solver']};
fs.writeFileSync(path.join(__dirname,'budget-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,checks,fiberBytes,stitchDefault:stitchRows[4]}));
