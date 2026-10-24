'use strict';
// One-time, reviewable extraction of the unmodified source-response path.
// R20 stays frozen. No anatomy estimates, filling or conditioning enter R21.
const fs=require('fs');
function replace(source,from,to){if(!source.includes(from))throw Error('Extraction marker missing: '+from.slice(0,100));return source.replace(from,to);}
let worker=fs.readFileSync('src/BodyImplicitWorkerR17.js','utf8');
const fast=fs.readFileSync('src/BodyImplicitWorkerR20.js','utf8').match(/ function fastRegion\([\s\S]*?(?= function region\()/)[0]
 .replaceAll('bodyScale','1').replaceAll('globalVariance','.0004').replaceAll('materialRest','baseline');
worker=replace(worker,' function region(box,spacing,maximum=384,isLocal=false){',fast+' function region(box,spacing,maximum=384,isLocal=false){if(!globalThis.__BODY_REFERENCE_REGION__)return fastRegion(box,spacing,maximum,isLocal);');
worker=replace(worker,"version:'BODY-IMPLICIT-R17'","version:'BODY-IMPLICIT-R21'");
worker=replace(worker,"type:'program',catalog:program.catalog","type:'program',originalState:program.baselineState,catalog:program.catalog");
worker=worker.replace("const stats={","const stats={sourceFidelity:{accepted:false,sourceDefaultPreserved:true,intentionalShapeChanges:false,estimatedAnatomy:false,estimatedHandsFeet:false,fieldSmoothing:false,interiorFilling:false,sourceSurfaceEquivalenceCertified:false},");
fs.writeFileSync('src/BodyImplicitWorkerR21.js',worker);
let app=fs.readFileSync('src/BodyImplicitAppR20.js','utf8');
app=replace(app,'BodyCalibrationR18.headLocal',"k=>/cheek|chin|ear-|eyebrow|eye-|forehead|head-|mouth|nose|lip|jaw/i.test(k)");
app=replace(app,"name==='original'?structuredClone(original):BodyAnatomyR20.preset(original,name)","structuredClone(original)");
app=replace(app,"setInspectionLight(\"studio\");","setInspectionLight(\"original\");");
const statusStart="status.textContent=state.bodyCalibration?.enabled?",statusEnd="document.querySelector('#body-count').textContent=";
let a=app.indexOf(statusStart),b=app.indexOf(statusEnd,a);if(a<0||b<0)throw Error('Missing status markers');
app=app.slice(0,a)+"status.textContent='原数据响应候选：原默认值与动作计算已恢复；表面、法线和边界仍待一比一验收。'+(state.bodyCalibration?.enabled?' 本档案的R18–R20研究改形已保留记录，本页不应用。':'');"+app.slice(b);
app=replace(app,"schema:'body-implicit-r20/1'","schema:'body-implicit-r21/1'");
app=replace(app,"headGenerated:false,sourceDerivedData:true","sourceFidelityAccepted:false,intentionalShapeChanges:false,headGenerated:false,sourceDerivedData:true");
app=replace(app,"characterTriangleFaces:0,sourceDerivedCalibration:true,quality","characterTriangleFaces:0,sourceDerivedCalibration:true,sourceFidelityAccepted:false,sourceResponseOnly:true,ignoredResearchCalibration:!!state.bodyCalibration?.enabled,quality");
fs.writeFileSync('src/BodyImplicitAppR21.js',app);
// Keep independently verified viewport, archive and camera ergonomics.
// R21 never provides anatomy/nail data, so these shader branches stay inactive.
let ray=fs.readFileSync('src/BodyRayR20.js','utf8').replaceAll('BODY-RAY-R20','BODY-RAY-R21');
fs.writeFileSync('src/BodyRayR21.js',ray);
