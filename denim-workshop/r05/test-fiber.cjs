'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('./core.js'),N=require('./natural-yarn.js');let checks=0,rows=[];
const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
for(let weave=0;weave<4;weave++)for(let damage=0;damage<5;damage++){
 const g=C.compile({weave,slub:.55}),d=N.generate(C,g,damage),a=N.audit(d);
 ok(a.finite&&a.maxAnchorErrorMm<1e-9,'Finite pinned release geometry');
 ok(a.sheathCurves===d.spans.flat().length*3,'Three representative outer strands per kept yarn interval');
 ok(a.surfaceFlyaways>7000,'Surface staple population retained');
 ok(a.clumpedFibers>a.strayFibers&&a.strayFibers>100,'Mixed clumps and strays');
 if(damage>=2){ok(a.bridges>0&&a.tails>0&&a.partialBridges>0,'Mixed breakage retained');ok(a.saggedBridges===a.bridges,'Sagged bridges');}
 const tm=N.tubeMesh(d.tubes),hm=N.hairMesh(d.fibers);
 ok(tm.vertices.every(Number.isFinite)&&hm.vertices.every(Number.isFinite),'Finite mesh buffers');
 ok(tm.indices.every(i=>i>=0&&i<tm.vertices.length/12),'Tube indices');
 ok(hm.vertices.length%10===0&&hm.indices.every(i=>i>=0&&i<hm.vertices.length/10),'Tangent ribbon stride and indices');
 for(let i=0;i<hm.vertices.length;i+=10*173){let t=hm.vertices.slice(i+7,i+10);ok(Math.abs(Math.hypot(...t)-1)<1e-5,'Finite unit strand tangent');}
 const structural=C.audit(g);ok(structural.wrongCrossingOrder===0&&structural.crossingCenterClearanceMm>0,'Retained weave center ordering');
 if(weave===0)rows.push({damage,...a,tubeTriangles:tm.indices.length/3,ribbonTriangles:hm.indices.length/3,ribbonBytes:hm.vertices.length*4+hm.indices.length*4});
}
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8'),studio=fs.readFileSync(path.join(__dirname,'studio.js'),'utf8');
ok(!app.includes('edges=mesh'),'Solid sidewall remains removed');
ok(app.includes('state.damage===0')&&app.includes('<180'),'Far-capture-only intact policy');
ok(app.includes('cross(normalize(uCam-vW),vT)'),'Tangent-facing ribbons');
ok(studio.includes('uFog')&&!app.slice(app.indexOf('const fs='),app.indexOf('const surfVS=')).includes('uFog'),'Fog only in studio backdrop');
ok(studio.includes('shadowKey===key'),'Cached shadow');
const report={passed:true,checks,rows,limits:'Finite sampled guide and mesh checks, not full fiber scattering or global collision proof'};
fs.writeFileSync(path.join(__dirname,'fiber-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
