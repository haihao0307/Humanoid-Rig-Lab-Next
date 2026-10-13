'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('./core.js'),N=require('./natural-yarn.js'),T=require('./cloth-topology.js'),D=require('./dynamics.js');
const cases=[...[0,1,2,3].map(shape=>({shape,damage:4,thickness:.7})),{shape:1,damage:2,thickness:.45},{shape:1,damage:3,thickness:1.05}];
const report={passed:false,cases:[],sampleEverySeconds:.5,simulationSeconds:5,windSpeedMps:1.1,anchorDrive:true,limits:['Selected loads, not all control combinations','Strain gates detect poor convergence; they do not calibrate fabric elasticity','No self collision, CCD, surface contact or live fracture proof','Node wall time only, not consumer GPU or browser total frame time']};
function fixture(patch){const s={structure:.7,slub:.25,cotton:.78,gsm:450,autoMass:true,warpStiffness:1,weftStiffness:1,bendStiffness:1,...patch},g=C.compile(s),n=N.generate(C,g,s.damage,1,{micro:false});return T.input(N,g,n,s);}
try{
 for(const input of cases){const sim=new D.Cloth({wind:1.1,drive:true},fixture(input));let sheet=0,yarn=0,maxPass=0,passSum=0;const start=performance.now();
  for(let i=0;i<1200;i++){sim.step();maxPass=Math.max(maxPass,sim.lastConstraintPasses);passSum+=sim.lastConstraintPasses;if(i%120===119){const q=sim.report();sheet=Math.max(sheet,q.maxTensileStrain);yarn=Math.max(yarn,q.maxYarnStretch);A.ok(q.maxAttachmentErrorMm<1e-5);A.ok(sim.x.every(Number.isFinite)&&sim.v.every(Number.isFinite));}}
  const row={input,maxSampledSheetTensileStrain:sheet,maxSampledYarnLengthError:yarn,maxSolvePasses:maxPass,meanSolvePasses:passSum/1200,nodeWallMs:performance.now()-start,final:sim.report()};report.cases.push(row);
  A.ok(sheet<.15&&yarn<.18,JSON.stringify(row));A.ok(maxPass<=12);console.log(JSON.stringify({input,sheet,yarn,meanPasses:row.meanSolvePasses}));
 }
 // A sphere moves a surviving sheet support. Re-evaluate algebraically embedded
 // roots after contact projection, not just before it, so no stale root is sent.
 const sim=new D.Cloth({wind:0,gravity:0},fixture({shape:1,damage:4,thickness:.7})),root=sim.topology.attachments[0],support=root.ids.find(i=>sim.inv[i]>0);A.ok(support!==undefined);const p=Array.from(sim.rest.slice(support*3,support*3+3));sim.colliders([[...p,.0007]]);sim.step();A.ok(sim.contacts>0);A.ok(sim.report().maxAttachmentErrorMm<1e-5);report.contactRoot={contacts:sim.contacts,attachmentErrorMm:sim.report().maxAttachmentErrorMm};
 report.passed=true;
}finally{fs.writeFileSync(path.join(__dirname,'load-cases-qa.json'),JSON.stringify(report,null,2));}
