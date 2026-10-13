'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('./core.js'),N=require('./natural-yarn.js'),F=require('./cotton-surface.js');
let checks=0,periodError=0,minPacking=Infinity,maxPacking=-Infinity,minCrossGap=Infinity;
for(let k=0;k<=4;k++)for(let j=0;j<1200;j++){
 const a=j*.027,t=j*.197,s=j%97,amount=k/4,v=F.packing(t,a,s,amount);
 periodError=Math.max(periodError,Math.abs(v-F.packing(t+2*Math.PI,a,s,amount)));
 minPacking=Math.min(minPacking,v);maxPacking=Math.max(maxPacking,v);checks++;
}
A.ok(periodError<1e-11);A.ok(minPacking>.90&&maxPacking<1.10);
const cross=[];
for(let w=0;w<4;w++)for(const amount of [0,.78,1]){
 const g=C.compile({weave:w,slub:.55,cotton:amount});let minimum=Infinity;
 for(let y=0;y<g.ny;y++)for(let x=0;x<g.nx;x++){
  const over=C.sample(g.d,0,x,y+.5)>0;
  const W=N.sectionPoint(C,g,0,x,y+.5,over?-Math.PI/2:Math.PI/2),V=N.sectionPoint(C,g,1,y,x+.5,over?Math.PI/2:-Math.PI/2);
  const gap=over?W[2]-V[2]:V[2]-W[2];minimum=Math.min(minimum,gap);checks++;
 }
 A.ok(minimum>0,{w,amount,minimum});minCrossGap=Math.min(minCrossGap,minimum);cross.push({weave:w,cotton:amount,minCrossingSurfaceGapMm:minimum});
}
const g=C.compile({slub:.55,cotton:.78});const n=N.generate(C,g,4);
for(const c of [...n.fibers,...n.tubes]){
 A.ok(c.points.every(p=>p.every(Number.isFinite)));A.ok(c.points.length>=2);checks++;
}
A.ok(N.audit(n).maxAnchorErrorMm<1e-9);
const report={passed:true,checks,periodError,minPacking,maxPacking,minCrossingSurfaceGapMm:minCrossGap,cross,damageAudit:N.audit(n),limits:['Crossing-center final surface samples, not a global collision proof','Procedural optical and radius controls are unmeasured','Numeric checks do not certify visual realism']};
fs.writeFileSync(path.join(__dirname,'cotton-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,checks,periodError,minCrossGap}));
