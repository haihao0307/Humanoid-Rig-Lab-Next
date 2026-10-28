'use strict';
// R33 retains R32 controls and adds derivative-consistent shading while moving.
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const r32=require('./research/r32/render-integration.cjs'),r33=require('./research/r33/motion-skin.cjs');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),source=f=>fs.readFileSync(f,'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const save=(f,s)=>{fs.writeFileSync(f+'.building',s);fs.renameSync(f+'.building',f);},write=(f,x)=>save(f,JSON.stringify(x,null,2)+'\n');
const info=(file,html)=>({file,sha256:sha(Buffer.from(html)),bytes:Buffer.byteLength(html)});
const oldSource=read('BUILD-SOURCE-R32.json'),oldWorkbench=read('BUILD-R32.json');
const inputNames=['tools/build.cjs','tools/preview-body.cjs','tools/build-r33.cjs','tools/research/r33/motion-skin.cjs'];
const added=inputNames.map(file=>({file,sha256:sha(fs.readFileSync(file))}));
const sources=old=>[...old.filter(s=>!inputNames.includes(s.file)),...added];

let html=source(oldSource.file),skin=r32.skin(source('src/BodyOriginalSkinR26.js')),atlas=r32.source(source('src/BodyAtlasRayR26.js'));
html=r32.replace(html,skin,r33.skin(skin));html=r32.replace(html,atlas,r33.source(atlas));
html=html.replace('<title>身体 R32','<title>身体 R33').replace('BODY / R32','BODY / R33');
const bodyInfo=info('delivery/身体_R33_实时轮廓.html',html);save(bodyInfo.file,html);
const body={...oldSource,...bodyInfo,version:'R33',canonicalFile:bodyInfo.file,builtUTC:new Date().toISOString(),sources:sources(oldSource.sources),inheritedSourceImplementation:{file:'BUILD-SOURCE-R32.json',sha256:oldSource.sha256,geometryUnchanged:true},interactiveShading:'surface-boundary quads use the same derivative neighbourhood during movement'};write('BUILD-SOURCE-R33.json',body);

html=source(oldWorkbench.file).replaceAll(path.basename(oldSource.file),path.basename(bodyInfo.file)).replaceAll(oldSource.sha256,bodyInfo.sha256);
html=html.replace('<title>人物身体 R32','<title>人物身体 R33').replace('BODY STUDY / R32','BODY STUDY / R33');
const wbInfo=info('delivery/人物身体_R33_实时轮廓.html',html);save(wbInfo.file,html);
const wb={...oldWorkbench,...wbInfo,version:'R33',builtUTC:new Date().toISOString(),stage:'consistent body edge shading during camera movement',sources:sources(oldWorkbench.sources),sourceViewer:{...oldWorkbench.sourceViewer,file:bodyInfo.file,sha256:bodyInfo.sha256},interactiveShading:'surface-boundary quads use the same derivative neighbourhood during movement'};write('BUILD-R33.json',wb);
write('BUILD.json',{...body,selectedVersion:'R33',companionBuild:'BUILD-R33.json',companionWorkbench:'BUILD-R33.json',researchBuild:'BUILD-POSE-R32.json',selection:'R33 retains the adjustable body and R32 antialiasing, and uses consistent surface-boundary shading while the camera is moving.'});
save('delivery/index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url='+path.basename(wbInfo.file)+'"><title>身体三维工作页 R33</title><p><a href="'+path.basename(wbInfo.file)+'">打开身体三维工作页</a></p></html>\n');
console.log(JSON.stringify({version:'R33',source:bodyInfo,workbench:wbInfo}));
