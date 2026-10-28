'use strict';
// Publish the checked skin integration while retaining R34 as the rollback.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const read=f=>fs.readFileSync(f,'utf8');
const json=f=>JSON.parse(read(f));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const save=(f,data)=>{fs.writeFileSync(f+'.building',data);fs.renameSync(f+'.building',f);};
const write=(f,data)=>save(f,JSON.stringify(data,null,2)+'\n');
const entry=(file,content)=>({file,sha256:hash(Buffer.from(content)),bytes:Buffer.byteLength(content)});
const replaceAll=(text,from,to)=>{if(!text.includes(from))throw Error('R35 build anchor missing: '+from);return text.replaceAll(from,to);};
const sourceBase=json('BUILD-SOURCE-R33.json'),studyBase=json('BUILD-STUDY-R32.json'),workBase=json('BUILD-R34.json');
// Always include shadow updates in the release, independently of research flags.
delete process.env.BODY_R35_DISABLE_ATLAS_SHADOW;
require('./research/r35/build-candidate.cjs');
const fixedCandidate='delivery/身体_R35_固定皮肤候选.html';
const dynamicCandidate='delivery/身体_R35_动态皮肤候选.html';
const workCandidate='delivery/人物身体_R35_动态皮肤候选.html';
const fixedFile='delivery/身体_R35_可调皮肤.html';
const dynamicFile='delivery/身体_R35_连续皮肤.html';
const workFile='delivery/人物身体_R35_可调皮肤.html';
const fixed=replaceAll(read(fixedCandidate),'身体 R35 皮肤候选','身体 R35 可调皮肤');
const dynamic=replaceAll(read(dynamicCandidate),'身体 R35 皮肤候选','身体 R35 连续皮肤');
let work=read(workCandidate);
work=replaceAll(work,'身体_R35_固定皮肤候选.html',path.basename(fixedFile));
work=replaceAll(work,'身体_R35_动态皮肤候选.html',path.basename(dynamicFile));
work=replaceAll(work,hash(Buffer.from(read(fixedCandidate))),hash(Buffer.from(fixed)));
work=replaceAll(work,'人物身体 R35 皮肤候选','人物身体 R35 可调皮肤');
work=replaceAll(work,'BODY STUDY / R34','BODY STUDY / R35');
const fixedEntry=entry(fixedFile,fixed),dynamicEntry=entry(dynamicFile,dynamic),workEntry=entry(workFile,work);
save(fixedFile,fixed);save(dynamicFile,dynamic);save(workFile,work);
const added=[
 'tools/build-r35.cjs','tools/build.cjs','tools/preview-body.cjs',
 'tools/research/r35/build-candidate.cjs','tools/research/r35/patch-pose-renderer.cjs',
 'tools/research/r35/patch-source-renderer.cjs','tools/research/r35/skin-controls.cjs',
 ...fs.readdirSync('src/research/r35').filter(f=>f.endsWith('.js')).map(f=>'src/research/r35/'+f)
];
const withSources=old=>old.filter(x=>!added.includes(x.file)).concat(added.map(file=>({file,sha256:hash(fs.readFileSync(file))})));
const builtUTC=new Date().toISOString();
const source={...sourceBase,...fixedEntry,builtUTC,version:'R35',sources:withSources(sourceBase.sources),
 skinControlsR35:22,directionalShadowUpdatesR35:true,fullVolumeScattering:false,
 inheritedSourceImplementation:{file:'BUILD-SOURCE-R33.json',sha256:hash(fs.readFileSync('BUILD-SOURCE-R33.json')),geometryUnchanged:true}};
const study={...studyBase,...dynamicEntry,builtUTC,version:'R35',sources:withSources(studyBase.sources),
 dynamicOriginalSkin:true,dynamicOriginalShadows:true,originalDiffusion:true,fullOriginalOptics:false,fullVolumeScattering:false,
 appearanceOnlyReusesSurface:true,sourceFidelityAccepted:false,visualAccepted:false};
const workbench={...workBase,...workEntry,builtUTC,version:'R35',sources:withSources(workBase.sources),
 stage:'current fixed and supported A-rig bodies share adjustable skin, dynamic directional shadows and screen-space diffusion',
 sourceViewer:{...workBase.sourceViewer,...fixedEntry},
 dynamicBody:{...workBase.dynamicBody,build:'BUILD-STUDY-R35.json',dynamicOriginalSkin:true,dynamicOriginalShadows:true,originalDiffusion:true,fullOriginalOptics:false,fullVolumeScattering:false},
 posePreview:{...workBase.posePreview,supportedARigUsesSkinInspection:false,dynamicOriginalSkin:true,dynamicOriginalShadows:true,screenSpaceDiffusion:true,continuousAnimation:false},
 skinControlsR35:22,previousWorkbench:{file:workBase.file,sha256:workBase.sha256}};
write('BUILD-SOURCE-R35.json',source);write('BUILD-STUDY-R35.json',study);write('BUILD-R35.json',workbench);
write('BUILD.json',{...source,selectedVersion:'R35',companionBuild:'BUILD-R35.json',companionWorkbench:'BUILD-R35.json',researchBuild:'BUILD-POSE-R32.json',selection:'R35 integrates adjustable current skin for fixed and supported A-rig bodies; continuous animation and other unsupported body states remain pending.'});
save('delivery/index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url='+path.basename(workFile)+'"><title>身体三维工作页 R35</title><p><a href="'+path.basename(workFile)+'">打开身体三维工作页</a></p></html>\n');
console.log(JSON.stringify({version:'R35',workbench:workEntry,fixed:fixedEntry,dynamic:dynamicEntry}));
