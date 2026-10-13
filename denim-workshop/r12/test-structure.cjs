'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const C=require('./core.js'),N=require('./natural-yarn.js'),T=require('./cloth-topology.js'),D=require('./dynamics.js');
const OldN=require('../r11/natural-yarn.js');
const state0={shape:1,structure:.7,damage:0,thickness:.7,slub:.25,cotton:.78,gsm:450,autoMass:true,warpStiffness:1,weftStiffness:1,bendStiffness:1};
const hash=a=>crypto.createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
function fixture(patch={}){const s={...state0,...patch},g=C.compile(s),n=N.generate(C,g,s.damage,1,{micro:false}),cfg=T.input(N,g,n,s);return {s,g,n,cfg};}
function sim(patch={},controls={}){const f=fixture(patch);return {...f,sim:new D.Cloth({wind:.7,...controls},f.cfg)};}
const report={passed:false,scope:'R12 structure-physics first increment, not measured material validation',staticGeometry:[],topologies:[],motion:[],materials:[],limits:['No self collision or swept surface collision','No force-driven new tears','Sewing still visual; no needle opening or seam tension','Representative released-yarn chains, not every cotton fiber','CPU timing is Node wall time, not browser or consumer-GPU FPS']};
try{
 for(const damage of [0,2,3,4]){
  const f=fixture({damage}),old=OldN.generate(C,f.g,damage,1,{micro:false});
  A.deepEqual(f.n.tubes.map(c=>c.points),old.tubes.map(c=>c.points));A.deepEqual(f.n.fibers.map(c=>c.points),old.fibers.map(c=>c.points));
  const t=T.compile(f.cfg);for(let i=0;i<t.nGrid;i++)if(!t.active[i]){A.equal(t.mass[i],0);A.equal(t.area[i],0);A.equal(t.inv[i],0);A.equal(t.tetherAnchor[i],-1);}
  for(let k=0;k<t.audit.sheetConstraints*5;k+=5){const a=t.links[k],b=t.links[k+1];A.ok(t.active[a]&&t.active[b]);A.ok(T.clearSegment(f.cfg.hole,t.uv[a],t.uv[b]),'No sheet stretch, shear or bending constraint crosses missing material');}
  A.equal(t.audit.retainedBridgeCount,f.n.stats.bridges);A.equal(t.audit.tailCount,f.n.stats.tails);
  for(const r of t.rods){const roots=t.attachments.filter(a=>a.node>=r.first&&a.node<r.first+r.count);A.equal(roots.length,r.type==='bridge'?2:1);for(const a of roots){A.ok(Math.abs(a.weights.reduce((x,y)=>x+y,0)-1)<1e-12);A.ok(a.ids.every(i=>t.active[i]&&i<t.nGrid));}}
  report.staticGeometry.push({damage,tubes:old.tubes.length,fibers:old.fibers.length,positionsByteIdentical:true});report.topologies.push(t.audit);
 }
 const t0=report.topologies[0],t4=report.topologies.at(-1);A.ok(t4.totalMassKg<t0.totalMassKg);A.ok(t4.removedSheetConstraints>500);A.ok(t4.inactiveHoleNodes>50);
 // Zero-load invariant: restoring a rest specimen does not generate an impulse.
 const rest=sim({damage:4},{wind:0,gravity:0}).sim;for(let i=0;i<48;i++)rest.step();A.ok(rest.report().maxDisplacementMm<1e-6);report.zeroLoad=rest.report();
 // Select an actual empty material-space location (away from retained rod nodes),
 // then put the same sphere in the intact specimen. This is a discrete contact
 // probe, not continuous/surface collision validation.
 const hole=sim({damage:4},{wind:0,gravity:0}).sim,solid=sim({}, {wind:0,gravity:0}).sim;let probe=-1;
 for(let i=0;i<hole.topology.nGrid;i++)if(!hole.topology.active[i]){const p=Array.from(hole.rest.slice(i*3,i*3+3));let distance=Infinity;for(let j=hole.topology.nGrid;j<hole.n;j++)distance=Math.min(distance,Math.hypot(...p.map((v,k)=>v-hole.rest[j*3+k])));if(distance>.0015){probe=i;break;}}
 A.ok(probe>=0);const sphere=[...hole.rest.slice(probe*3,probe*3+3),.0008];solid.colliders([sphere]);hole.colliders([sphere]);solid.step();hole.step();A.ok(solid.contacts>0);A.equal(hole.contacts,0);report.contactProbe={node:probe,sphere,intactContacts:solid.contacts,damagedContacts:hole.contacts};
 // Deterministic loads: geometry/physics topology must materially change response.
 for(const damage of [0,2,4]){const f=sim({damage}),s=f.sim;const start=performance.now();let maxT=0,maxY=0;for(let i=0;i<720;i++){s.step();if(i%120===119){const r=s.report();maxT=Math.max(maxT,r.maxTensileStrain);maxY=Math.max(maxY,r.maxYarnStretch);}}
  const elapsed=performance.now()-start,r=s.report();A.ok(s.x.every(Number.isFinite)&&s.v.every(Number.isFinite));A.ok(maxT<.15,JSON.stringify({damage,maxT}));A.ok(maxY<.18,JSON.stringify({damage,maxY}));A.ok(r.maxAttachmentErrorMm<1e-6);
  report.motion.push({damage,seconds:3,nodeHash:hash(s.x),sampledMaxTensileStrain:maxT,sampledMaxYarnStretch:maxY,nodeWallMs:elapsed,...r});
 }
 A.notEqual(report.motion[0].nodeHash,report.motion[2].nodeHash);
 // Only actual material inputs are coupled. Finish color/wash is not silently
 // called a measured mechanical property. Auto mass is a declared assumption.
 for(const patch of [{thickness:.45},{thickness:1.05},{autoMass:false,gsm:250},{autoMass:false,gsm:700},{warpStiffness:.3,weftStiffness:2.5},{warpStiffness:2.5,weftStiffness:.3}]){const {sim:s}=sim(patch);for(let i=0;i<240;i++)s.step();report.materials.push({input:patch,positionHash:hash(s.x),...s.report()});}
 A.notEqual(report.materials[0].positionHash,report.materials[1].positionHash);A.notEqual(report.materials[4].positionHash,report.materials[5].positionHash);A.ok(report.materials[0].topology.totalMassKg<report.materials[1].topology.totalMassKg);
 // An isolated retained bridge couples two portions of the sheet through actual
 // yarn endpoints; a cut/tail has no second attached endpoint.
 const f=fixture({damage:4}),bridge=f.cfg.released.find(r=>r.type==='bridge'),cfg={...f.cfg,released:[{...bridge,index:1}]},s=new D.Cloth({wind:0,gravity:0},cfg),r=s.topology.rods[0],node=r.first+Math.floor(r.count/2);s.v[node*3+2]=.06;
 for(let i=0;i<24;i++)s.step();let sheetChange=0;for(let i=0;i<s.topology.nGrid*3;i++)sheetChange=Math.max(sheetChange,Math.abs(s.x[i]-s.rest[i]));A.ok(sheetChange>1e-10);report.twoWayBridge={sheetDisplacementM:sheetChange,bridgeNodes:r.count,attachmentErrorMm:s.report().maxAttachmentErrorMm};
 const m=JSON.parse(fs.readFileSync(path.join(__dirname,'../r11/BUILD_MANIFEST.json')));for(const file of ['noise-kernel.js','sampling.js','cotton-surface.js','stitches.js','distance-lod.js'])A.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,file))).digest('hex'),m.sourceHashes[file]);
 report.preserved=['R11 noise/appearance sampling, cotton material, needle geometry and distance thresholds unchanged'];report.passed=true;
}finally{fs.writeFileSync(path.join(__dirname,'structure-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,motion:report.motion.map(r=>({damage:r.damage,nodes:r.nodes,strain:r.sampledMaxTensileStrain,yarn:r.sampledMaxYarnStretch,ms:r.nodeWallMs}))}));}
