'use strict';
// Promote the checked motion workbench while retaining R36 as a rollback.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const read=f=>fs.readFileSync(f,'utf8'),json=f=>JSON.parse(read(f)),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const save=(f,data)=>{fs.writeFileSync(f+'.building',data);fs.renameSync(f+'.building',f);},write=(f,data)=>save(f,JSON.stringify(data,null,2)+'\n'),entry=(file,text)=>({file,sha256:hash(Buffer.from(text)),bytes:Buffer.byteLength(text)});
const sourceBase=json('BUILD-SOURCE-R36.json'),studyBase=json('BUILD-STUDY-R36.json'),workBase=json('BUILD-R36.json');
// The reference setting is solely for the visual performance comparison.
delete process.env.BODY_R37_REFERENCE_SHADOWS;
delete process.env.BODY_R37_TEST_SHADOW_SIZE;
delete process.env.BODY_R37_TEST_DISABLE_REDUCER;
delete process.env.BODY_R37_VERIFY_REDUCER;
require('./research/r37/build-candidate.cjs');
const dynamicFile='delivery/身体_R37_连续动作.html',workFile='delivery/人物身体_R37_连续动作.html';
const dynamic=read('delivery/身体_R37_动作候选.html');
let work=read('delivery/人物身体_R37_动作候选.html');
const oldDynamic='身体_R37_动作候选.html';if(work.split(oldDynamic).length-1!==2)throw Error('R37 dynamic viewer reference mismatch');
work=work.replaceAll(oldDynamic,path.basename(dynamicFile));
const dynamicEntry=entry(dynamicFile,dynamic),workEntry=entry(workFile,work);save(dynamicFile,dynamic);save(workFile,work);
const added=['tools/build-r37.cjs','tools/build.cjs','tools/preview-body.cjs','tools/research/r37/build-candidate.cjs','tools/research/r37/patch-pose-renderer.cjs','tools/research/r37/patch-shadow-validation.cjs',...fs.readdirSync('src/research/r37').filter(f=>f.endsWith('.js')).map(f=>'src/research/r37/'+f)];
const withSources=old=>old.filter(x=>!added.includes(x.file)).concat(added.map(file=>({file,sha256:hash(fs.readFileSync(file))})));
const builtUTC=new Date().toISOString(),motion={presetCount:6,customTwoPoseClip:true,customClipSavedInPersonArchive:true,bothBodyRigs:true,previewSamples:9,previewIntermediate:'interpolated body function coefficients and normals',pausedPose:'full current body evaluation',previewShadowPixels:1024,pausedShadowPixels:2048,shadowVerification:'exact GPU reduction, full pixel readback fallback',previewNotExactIntermediate:true};
const source={...sourceBase,builtUTC,version:'R37',sources:withSources(sourceBase.sources),fixedViewInheritedR35:true,sourceFidelityAccepted:false,visualAccepted:false};
const study={...studyBase,...dynamicEntry,builtUTC,version:'R37',sources:withSources(studyBase.sources),motion,bodyAttachmentFrames:{schema:'body-attachment-frames-r37/1',rigs:['A','B'],unit:'metres',headOrAccessoriesGenerated:false},legacyDigitAndFootFields:false,characterTriangleFaces:0,sourceFidelityAccepted:false,visualAccepted:false};
const workbench={...workBase,...workEntry,builtUTC,version:'R37',sources:withSources(workBase.sources),stage:'continuous motion preview, custom two-pose action, grouped hand and foot controls, pose cache and body attachment frames',handFootControls:{pairedParameters:7,asymmetricEdits:true,optionalSymmetry:true,batchApply:true},dynamicBody:{...workBase.dynamicBody,build:'BUILD-STUDY-R37.json',motion,bodyAttachmentFrames:'body-attachment-frames-r37/1'},previousWorkbench:{file:workBase.file,sha256:workBase.sha256},characterTriangleFaces:0};
write('BUILD-SOURCE-R37.json',source);write('BUILD-STUDY-R37.json',study);write('BUILD-R37.json',workbench);
write('BUILD.json',{...source,selectedVersion:'R37',companionBuild:'BUILD-R37.json',companionWorkbench:'BUILD-R37.json',researchBuild:'BUILD-POSE-R32.json',selection:'R37 retains the current body and skin and adds six body motion previews, saved two-pose custom actions, faster pose updates and body-side attachment frames.'});
save('delivery/index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url='+path.basename(workFile)+'"><title>身体三维工作页 R37</title><p><a href="'+path.basename(workFile)+'">打开身体三维工作页</a></p></html>\n');
console.log(JSON.stringify({version:'R37',workbench:workEntry,dynamic:dynamicEntry,source:sourceBase.file}));
