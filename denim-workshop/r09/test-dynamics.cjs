'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Cloth}=require('./dynamics.js');const rows=[];
for(let shape=0;shape<4;shape++){
 const a=new Cloth({shape}),b=new Cloth({shape});let start=performance.now(),peak=0;
 for(let i=0;i<720;i++){a.step();if(i%24===0)peak=Math.max(peak,a.report().maxStretch);}
 const elapsed=performance.now()-start;
 for(let j=0;j<30;j++)b.advance(.1);
 assert.deepEqual(a.x,b.x);assert([...a.x,...a.v].every(Number.isFinite));assert(peak<.12,{shape,peak});
 for(let k=(a.ny-1)*a.nx*3;k<a.x.length;k++)assert.equal(a.x[k],a.rest[k]);
 rows.push({shape,peakStretch:peak,cpuMsFor3SimulatedSeconds:elapsed,...a.report()});
}
const still=new Cloth({shape:0,wind:0});for(let i=0;i<480;i++)still.step();
const before=still.sample();still.kick();for(let i=0;i<24;i++)still.step();const after=still.sample();
assert(after.some((v,i)=>Math.abs(v-before[i])>.01),'Impulse must move an unforced cloth');
const energy1=still.report().kineticJ;for(let i=0;i<960;i++)still.step();assert(still.report().kineticJ<energy1,'Released cloth must damp');
const drive=new Cloth({shape:0,wind:0,drive:true});for(let i=0;i<480;i++)drive.step();assert(drive.report().maxDisplacementMm>1);
const offset=Array(75).fill(0);for(let i=2;i<75;i+=3)offset[i]=.001;drive.controls({drive:false});drive.anchors(offset);drive.step();
for(let i=0;i<25;i++)assert(Math.abs(drive.x[((18*25)+i)*3+2]-drive.rest[((18*25)+i)*3+2]-.001)<1e-10);
const contact=new Cloth({shape:0,wind:0});contact.colliders([[0,-.01,-.012,.015]]);for(let i=0;i<240;i++)contact.step();let penetration=0;
for(let i=0;i<contact.n;i++){const k=i*3;penetration=Math.max(penetration,.0155-Math.hypot(contact.x[k],contact.x[k+1]+.01,contact.x[k+2]+.012));}
assert(penetration<1e-9);
const result={passed:true,rows,impulseDamps:true,frameChunkDeterministic:true,anchorsRespond:true,maxProxyNodePenetrationM:penetration,limits:['CPU timings from this machine; not consumer GPU FPS','Distance-bending approximation; unmeasured physical coefficients','Sphere contact checked at proxy nodes only; no render-surface or self-collision proof','Damaged strands not independently simulated']};
fs.writeFileSync(path.join(__dirname,'dynamics-qa.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
