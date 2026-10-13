'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Ref=require('../r14/bend-cloth.js'),Fast=require('./bend-fast.js'),T=require('./cloth-topology.js'),C=require('./core.js');
const out={passed:false,scope:'same full R14 model, same timestep and projection count; no hardware FPS claim',cases:[],cpu:require('node:os').cpus()[0]?.model,node:process.version};
try{
 for(const t of [.45,.7,1.05]){const state={thickness:t,autoMass:true,gsm:450,warpStiffness:1,weftStiffness:1,bendStiffness:1},g=C.compile(state),cfg={experiment:'fold',widthMm:g.p.width,heightMm:g.p.height,material:T.material(state),released:[]},a=new Ref.Sheet({fold:1,friction:.35},cfg),b=new Fast.Sheet({fold:1,friction:.35},cfg);let oldMs=0,newMs=0,peak=0;const frames=[];
  for(let k=0;k<720;k++){let n=performance.now();a.step();oldMs+=performance.now()-n;n=performance.now();b.step();newMs+=performance.now()-n;if(k%24===23){let err=0;for(let j=0;j<a.x.length;j++)err=Math.max(err,Math.abs(a.x[j]-b.x[j]));peak=Math.max(peak,err);A.ok(err<1e-9,`trajectory deviation ${t} ${k} ${err}`);A.equal(a.steps,b.steps);A.equal(a.time,b.time);A.equal(a.totalMass,b.totalMass);const r=b.report();A.ok(r.maxTensileStrain<.03);frames.push({step:k+1,maxPositionErrorM:err,refContacts:a.contacts,fastContacts:b.contacts});}}
  const ar=a.report(),br=b.report();A.ok(br.curvedSegments>=6&&br.maxNeighbourTurnDegrees<80&&br.upperOpeningDegrees<5);A.equal(br.selfCollision,true);A.equal(br.brokenBonds,0);A.equal(br.nodes,637);
  out.cases.push({thickness:t,sourceSeconds:3,referenceMs:oldMs,acceleratedMs:newMs,ratio:oldMs/newMs,maxPositionErrorM:peak,referenceReport:ar,fastReport:br,frames});console.log('PASS complete 720 steps',t,'JS',oldMs.toFixed(1),'WASM',newMs.toFixed(1),'ratio',(oldMs/newMs).toFixed(2),'error',peak);
 }
 A.equal(require('../r14/dynamics.js').Cloth.toString(),require('./dynamics.js').Cloth.toString());
 const metrics=require('./frame-metrics.js').create();A.equal(metrics.report().completedFrames,0);for(let i=0;i<50;i++)metrics.complete();A.equal(metrics.report().completedFrames,0);metrics.submit(1,0,0,1);metrics.complete();metrics.complete();A.equal(metrics.report().completedFrames,1);metrics.reset();A.equal(metrics.all().length,0);
 out.measurementChecks=['idle/rAF calls do not increment completed frames','one final submitted frame acknowledged once','clearing measurement does not change physical state'];out.passed=true;
}finally{fs.writeFileSync(path.join(__dirname,'PERFORMANCE_NUMERIC.json'),JSON.stringify(out,null,2));}
