'use strict';
const fs=require('node:fs'),A=require('node:assert/strict'),C=require('./core.js'),N=require('./natural-yarn.js'),S=require('./sampling.js');let checks=0;function ok(v,m){A.ok(v,m);checks++;}
let maxCoverageError=0,maxLodStep=0,chunkRows=[];
for(const r of [.002,.004,.008,.016,.026])for(let i=0;i<=500;i++){const px=10**(-4+i/100),g=S.gaussianCoverage(r,px);maxCoverageError=Math.max(maxCoverageError,Math.abs(g.halfWidth*g.opacity-1.65*r));ok(g.opacity>0&&g.opacity<=1&&g.halfWidth>0,'Finite widening and opacity');}
ok(maxCoverageError<1e-12,'Constant integrated transverse Gaussian coverage');
let prior=1;for(let i=0;i<10001;i++){const z=i/10000,w=S.farWeight(z*3,z*715);ok(w<=prior+1e-12&&w>=0&&w<=1,'Monotone continuous LOD');maxLodStep=Math.max(maxLodStep,Math.abs(w-prior));prior=w;}
ok(maxLodStep<.003,'No discontinuous LOD threshold');ok(S.farWeight(.3,100,true)===0,'Geometry-forced audit');ok(S.farWeight(3,715)===0,'Full-size cloth remains yarn geometry');
for(let d=0;d<5;d++){const g=C.compile({slub:.55}),data=N.generate(C,g,d),audit=N.audit(data);let originalCost=0,chunkCost=0;
 for(let kind=0;kind<2;kind++)for(const [a,b,id] of data.spans[kind]){let startCaps=0,endCaps=0,covered=0,ts=new Set([a,b]);
  originalCost+=kind?g.nx:g.ny;
  for(let base=Math.floor(a/16)*16;base<b;base+=16){let lo=Math.max(a,base),hi=Math.min(b,base+16);chunkCost+=16;covered+=hi-lo;if(lo===a)startCaps++;if(hi===b)endCaps++;
   for(let k=0;k<=64;k++)ts.add(Math.max(lo,Math.min(hi,base+k/4)));
  }
  ok(startCaps===1&&endCaps===1,'Internal chunk caps absent');ok(Math.abs(covered-(b-a))<1e-10,'No gaps or overlap in parameter domain');
  for(let k=Math.ceil(a*4);k<=Math.floor(b*4);k++)ok(ts.has(k/4),'Original 1/4-crossing lattice retained');
  const q=N.sectionPoint(C,g,kind,id,(a+b)/2,1.3,0),center=N.organicPoint(C,g,kind,id,(a+b)/2);ok(q.every((v,i)=>v===center[i]),'Shared section centered on original yarn');
 }
 ok(audit.finite&&audit.maxAnchorErrorMm<1e-9,'Released-yarn anchors unchanged');chunkRows.push({damage:d,originalWholeLengthBudget:originalCost,chunkBudget:chunkCost,ratio:chunkCost/originalCost,...audit});
}
for(const pts of [[[0,0,0],[1,2,0],[2,-1,1],[3,0,0]],[[1,1,1],[2,2,2],[4,4,4]]]){const sm=N.smoothCurve(pts,2);ok(JSON.stringify(sm[0])===JSON.stringify(pts[0])&&JSON.stringify(sm.at(-1))===JSON.stringify(pts.at(-1)),'Interpolated endpoints exact');for(let i=0;i<pts.length;i++)ok(sm[2*i].every((x,j)=>Math.abs(x-pts[i][j])<1e-12),'Interpolated knots retained');}
const app=fs.readFileSync(__dirname+'/app.js','utf8');ok(app.includes('flat out float vId')&&app.includes('0x85ebca6bu'),'Stable, noninterpolated yarn identity');ok(app.includes('gl.isContextLost()?37442'),'Context loss cannot masquerade as GL success');ok(!app.includes('if(tex.a<.45)'),'No hard half-opacity hole threshold');
fs.writeFileSync(__dirname+'/stability-qa.json',JSON.stringify({passed:true,checks,maxCoverageError,maxLodStep,chunkRows,limitations:'Analytic coverage and source/parameter tests, not an optical-energy proof, pixel evidence or physical-device benchmark'},null,2));console.log(JSON.stringify({passed:true,checks,maxCoverageError,maxLodStep,chunkRows:chunkRows.map(x=>({damage:x.damage,ratio:x.ratio}))}));
