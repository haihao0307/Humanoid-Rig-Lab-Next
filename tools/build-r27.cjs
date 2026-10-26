'use strict';
const fs=require('fs'),crypto=require('crypto'),H=b=>crypto.createHash('sha256').update(b).digest('hex');
function save(file,data){fs.writeFileSync(file+'.building',data);fs.renameSync(file+'.building',file);}
require('./build-field-worker-r27.cjs');
require('./pack-body-dependencies-r27.cjs');
require('./pack-lazy-body-r27.cjs');
const priorSource=JSON.parse(fs.readFileSync('BUILD-SOURCE-R26.json')),priorWorkbench=JSON.parse(fs.readFileSync('BUILD-R26.json'));
const sourceFile='delivery/身体_R27_原形体与参数衔接.html',workbenchFile='delivery/人物身体_R27_连续计算与原形体.html';
let html=fs.readFileSync(priorSource.file,'utf8').replaceAll('人物身体_R26_原形体与参数工作页.html',workbenchFile.split('/').pop()).replace('<title>身体 R26','<title>身体 R27').replace('SOURCE FORM / R26','SOURCE FORM / R27');
save(sourceFile,html);
const source={...priorSource,version:'R27',file:sourceFile,canonicalFile:sourceFile,builtUTC:new Date().toISOString(),sha256:H(Buffer.from(html)),bytes:Buffer.byteLength(html),sources:[...priorSource.sources,{file:'tools/build-r27.cjs',sha256:H(fs.readFileSync('tools/build-r27.cjs'))},{file:'tools/build.cjs',sha256:H(fs.readFileSync('tools/build.cjs'))}],inheritedSourceImplementation:{file:'BUILD-SOURCE-R26.json',sha256:priorSource.sha256,geometryAndMaterialCodeUnchanged:true}};
save('BUILD-SOURCE-R27.json',JSON.stringify(source,null,2)+'\n');
html=fs.readFileSync(priorWorkbench.file,'utf8');
function once(a,b){if(html.split(a).length!==2)throw Error('R27 substitution not unique '+a.slice(0,100));html=html.replace(a,()=>b);}
const escape=s=>JSON.stringify(s).replace(/<\/script/gi,'<\\/script').slice(1,-1);
const worker=['BodySourceFieldsR27','BodyProgramStorageR27','BodyFieldSamplerR27','BodyFieldPoolR27','BodyFieldWorkerBundleR27','BodyImplicitWorkerR27'].map(n=>fs.readFileSync('src/'+n+'.js','utf8')).join('\n');
once(escape(fs.readFileSync('src/BodyImplicitWorkerR26.js','utf8')),escape(worker));
once(fs.readFileSync('src/BodyImplicitAppR26.js','utf8'),fs.readFileSync('src/BodyImplicitAppR27.js','utf8'));
once(fs.readFileSync('src/BodyWorkbenchSurfaceR26.js','utf8'),fs.readFileSync('src/BodyWorkbenchSurfaceR27.js','utf8'));
once('<label>原皮肤粗糙程度','<p id="original-material-status-r27" class="small"></p><label>原皮肤粗糙程度');
const packet=JSON.parse(fs.readFileSync('data/body-lazy-packet-r27.json')),packetStart=html.indexOf('window.__BODY_FUNCTION_PACKAGE__='),packetEnd=html.indexOf(';window.__BODY_FUNCTION_PACKAGE__.url=',packetStart);
if(packetStart<0||packetEnd<0)throw Error('R27 packet insertion point missing');
html=html.slice(0,packetStart)+'window.__BODY_FUNCTION_PACKAGE__='+JSON.stringify({...packet,file:undefined,sourcePackage:undefined,lazyAssets:undefined})+html.slice(packetEnd);
once('window.__BODY_PACKAGE_SHA256__='+JSON.stringify(priorWorkbench.data.sha256),'window.__BODY_PACKAGE_SHA256__='+JSON.stringify(packet.rawSHA256));
html=html.replaceAll(priorSource.file.split('/').pop(),sourceFile.split('/').pop()).replaceAll(priorSource.sha256,source.sha256).replace('<title>人物身体 R26','<title>人物身体 R27').replace('BODY STUDY / R26','BODY STUDY / R27');
save(workbenchFile,html);
const added=['src/BodyProgramStorageR27.js','src/BodySourceFieldsR27.js','src/BodyFieldSamplerR27.js','src/BodyFieldPoolR27.js','src/BodyFieldTaskR27.js','src/BodyFieldWorkerBundleR27.js','src/BodyImplicitWorkerR27.js','src/BodyImplicitAppR27.js','src/BodyWorkbenchSurfaceR27.js','tools/build-r27.cjs','tools/build.cjs','tools/build-field-worker-r27.cjs','tools/pack-body-dependencies-r27.cjs','tools/body-dependency-slice-r27.cjs','data/body-program-packet-r27.json','data/body-dependency-reduction-r27.json','tools/pack-lazy-body-r27.cjs','tools/body-packet-codec-r27.cjs','data/body-lazy-packet-r27.json'];
const wb={...priorWorkbench,version:'R27',file:workbenchFile,builtUTC:new Date().toISOString(),sha256:H(Buffer.from(html)),bytes:Buffer.byteLength(html),sources:[...priorWorkbench.sources,...added.map(file=>({file,sha256:H(fs.readFileSync(file))}))],data:{file:'data/body-lazy-packet-r27.json',sha256:H(fs.readFileSync('data/body-lazy-packet-r27.json')),bytes:fs.statSync('data/body-lazy-packet-r27.json').size},bytePacket:packet,sourceViewer:{...priorWorkbench.sourceViewer,file:source.file,sha256:source.sha256},parallelContinuousSampling:{maximumWorkers:3,lowCoreSerialFallback:true,maximumResultSlabBytes:8*1024*1024,workerLifetime:'one build; terminated on completion/failure',fieldPrecisionChanged:false,sourceSurfaceAccepted:false}};
save('BUILD-R27.json',JSON.stringify(wb,null,2)+'\n');
const selected={...source,selectedVersion:'R27',companionBuild:'BUILD-R27.json',companionWorkbench:'BUILD-R27.json',selection:'R26 original fixed-state functions retained; bounded parallel evaluation of unchanged continuous research fields; arbitrary continuous source fidelity remains unfinished'};
if(!global.__BODY_DEFER_R28_SELECTION__){fs.writeFileSync('BUILD.json.building',JSON.stringify(selected,null,2));fs.renameSync('BUILD.json.building','BUILD.json');}
console.log(JSON.stringify({source:source.sha256,workbench:wb.sha256,maximumWorkers:3}));
