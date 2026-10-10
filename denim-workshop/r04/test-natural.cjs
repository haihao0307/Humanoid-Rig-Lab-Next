const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const p=__dirname,C=require('./core.js'),N=require('./natural-yarn.js');let checks=0,results=[];
function ok(condition,message){assert.ok(condition,message);checks++;}
for(let weave=0;weave<4;weave++)for(let damage=0;damage<5;damage++){
 const g=C.compile({weave,slub:.55}),d=N.generate(C,g,damage),a=N.audit(d),tm=N.tubeMesh(d.tubes),hm=N.hairMesh(d.fibers);
 ok(a.finite,'Finite guide geometry');ok(a.maxAnchorErrorMm<1e-9,'Exact pinned endpoints');
 ok(a.edgeClumps>50 && a.clumpedFibers>a.strayFibers && a.strayFibers>100,'Cluster + stray mixture');
 ok(tm.vertices.every(Number.isFinite)&&hm.vertices.every(Number.isFinite),'Finite mesh data');ok(tm.indices.every(i=>i<tm.vertices.length/12),'Valid tube indices');
 if(damage>=2){ok(a.bridges>0&&a.tails>0,'Both retained and broken yarns');ok(a.saggedBridges===a.bridges,'Every connected bridge has sag');ok(a.partialBridges>0,'Partial remaining yarn bundles');}
 for(let kind=0;kind<2;kind++)for(const row of d.spans[kind]){ok(row[1]>row[0]&&row[0]>=0&&row[1]<=(kind?g.nx:g.ny),'Scaffold interval');}
 for(const r of d.released){for(const t of r.parents){let q=N.organicPoint(C,g,r.kind,r.id,t),point=t===r.parents[0]?r.points[0]:r.points.at(-1);ok(Math.hypot(...q.map((x,i)=>x-point[i]))<1e-9,'Release endpoint bound to actual parent');}}
 if(weave===0)results.push({damage,...a,tubeTriangles:tm.indices.length/3,hairTriangles:hm.indices.length/3});
}
let g=C.compile(),a=N.generate(C,g,4),b=N.generate(C,g,4);ok(JSON.stringify(a.stats)===JSON.stringify(b.stats),'Deterministic regeneration');ok(JSON.stringify(a.tubes)===JSON.stringify(b.tubes),'Stable guides');
const app=fs.readFileSync(path.join(p,'app.js'),'utf8');ok(!app.includes('edges=mesh'),'No solid wall');ok(app.includes("state.damage===0"),'Only intact distant cloth uses capture');ok(app.includes("projection:'perspective'")||app.includes("'perspective'"),'Perspective retained');
const report={passed:true,checks,results,limits:'Guide/mesh/anchor checks only, not all-yarn collision proof or film-grade approval'};fs.writeFileSync(path.join(p,'natural-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
