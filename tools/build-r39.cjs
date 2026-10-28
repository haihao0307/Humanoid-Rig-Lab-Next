'use strict';
// Promote the checked editor and continuous preview; keep R38 as a rollback.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const read=f=>fs.readFileSync(f,'utf8'),json=f=>JSON.parse(read(f)),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const save=(f,data)=>{fs.writeFileSync(f+'.building',data);fs.renameSync(f+'.building',f);},write=(f,data)=>save(f,JSON.stringify(data,null,2)+'\n'),entry=(file,text)=>({file,sha256:hash(Buffer.from(text)),bytes:Buffer.byteLength(text)});
const sourceBase=json('BUILD-SOURCE-R38.json'),studyBase=json('BUILD-STUDY-R38.json'),workBase=json('BUILD-R38.json');
require('./research/r39/build-candidate.cjs');
const dynamicFile='delivery/身体_R39_动作与连续变形.html',workFile='delivery/人物身体_R39_动作与连续变形.html',dynamic=read('delivery/身体_R39_动作候选.html');let work=read('delivery/人物身体_R39_动作候选.html');const oldDynamic='身体_R39_动作候选.html';if(work.split(oldDynamic).length-1!==2)throw Error('R39 dynamic viewer reference mismatch');work=work.replaceAll(oldDynamic,path.basename(dynamicFile));
const dynamicEntry=entry(dynamicFile,dynamic),workEntry=entry(workFile,work);save(dynamicFile,dynamic);save(workFile,work);
const added=['tools/build-r39.cjs','tools/build.cjs','tools/preview-body.cjs','tools/research/r39/build-candidate.cjs',...['BodyAnimationClipR39.js','BodyMotionTimelineR39.js','BodyMotionLibraryR39.js','FullBodyStudyWorkerR39.js','TorsoStudyAppR39.js'].map(f=>'src/research/r39/'+f)];
const withSources=old=>old.filter(x=>!added.includes(x.file)).concat(added.map(file=>({file,sha256:hash(fs.readFileSync(file))})));
const builtUTC=new Date().toISOString(),motion={...studyBase.motion,libraryBuiltinCount:16,perKeyframeChannelEdit:true,chineseJointSearchAndSlider:true,draggableKeyframeTimeline:true,perSegmentTransitions:['smooth','linear','hold-before','hold-after'],actionComposition:true,undoRedo:{maximumSteps:30,maximumBytesPerStack:16*1024*1024,sessionOnly:true},sampleReuseWithinPreparation:true,previewIntermediate:'bounded cubic interpolation of function-domain extrema; shared boundaries remain coincident',previewNotExactIntermediate:true,pausedPose:'full current body evaluation',fullGroundContactOrGait:false};
const source={...sourceBase,builtUTC,version:'R39',sources:withSources(sourceBase.sources),sourceFidelityAccepted:false,visualAccepted:false};
const study={...studyBase,...dynamicEntry,builtUTC,version:'R39',sources:withSources(studyBase.sources),motion,characterTriangleFaces:0,sourceFidelityAccepted:false,visualAccepted:false};
const workbench={...workBase,...workEntry,builtUTC,version:'R39',sources:withSources(workBase.sources),stage:'per-joint and per-segment body motion editing, action composition and seam-preserving animation preview',dynamicBody:{...workBase.dynamicBody,build:'BUILD-STUDY-R39.json',motion},previousWorkbench:{file:workBase.file,sha256:workBase.sha256},characterTriangleFaces:0};
write('BUILD-SOURCE-R39.json',source);write('BUILD-STUDY-R39.json',study);write('BUILD-R39.json',workbench);
write('BUILD.json',{...source,selectedVersion:'R39',companionBuild:'BUILD-R39.json',companionWorkbench:'BUILD-R39.json',researchBuild:'BUILD-POSE-R32.json',selection:'R39 retains the current body and skin, adds motion editing tools and preserves shared function boundaries during animation.'});
save('delivery/index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url='+path.basename(workFile)+'"><title>身体三维工作页 R39</title><p><a href="'+path.basename(workFile)+'">打开身体三维工作页</a></p></html>\n');
console.log(JSON.stringify({version:'R39',workbench:workEntry,dynamic:dynamicEntry,source:sourceBase.file}));
