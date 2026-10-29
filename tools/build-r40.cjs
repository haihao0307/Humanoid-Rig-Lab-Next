'use strict';
// Promote the checked body-only skin controls and conservative performance work.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const read=f=>fs.readFileSync(f,'utf8'),json=f=>JSON.parse(read(f)),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const save=(f,data)=>{fs.writeFileSync(f+'.building',data);fs.renameSync(f+'.building',f);},write=(f,data)=>save(f,JSON.stringify(data,null,2)+'\n'),entry=(file,text)=>({file,sha256:hash(Buffer.from(text)),bytes:Buffer.byteLength(text)});
if(process.env.BODY_R40_EXPERIMENTAL_MRT==='1')throw Error('未验收的皮肤多目标试验不能发布');
const sourceBase=json('BUILD-SOURCE-R39.json'),studyBase=json('BUILD-STUDY-R39.json'),workBase=json('BUILD-R39.json');
require('./research/r40/build-candidate.cjs');
const sourceFile='delivery/身体_R40_固定皮肤.html',dynamicFile='delivery/身体_R40_皮肤与性能.html',workFile='delivery/人物身体_R40_皮肤与性能.html';
const source=read('delivery/身体_R40_固定皮肤候选.html'),dynamic=read('delivery/身体_R40_皮肤候选.html');let work=read('delivery/人物身体_R40_皮肤候选.html');
for(const [from,to,count] of [['身体_R40_固定皮肤候选.html',path.basename(sourceFile),3],['身体_R40_皮肤候选.html',path.basename(dynamicFile),2]]){if(work.split(from).length-1!==count)throw Error('R40 工作页引用不匹配：'+from);work=work.replaceAll(from,to);}
const sourceEntry=entry(sourceFile,source),dynamicEntry=entry(dynamicFile,dynamic),workEntry=entry(workFile,work);save(sourceFile,source);save(dynamicFile,dynamic);save(workFile,work);
const added=['tools/build-r40.cjs','tools/build.cjs','tools/preview-body.cjs','tools/research/r40/build-candidate.cjs','tools/research/r40/patch-skin-mrt.cjs','tools/research/r40/patch-boot-handoff.cjs','src/research/r40/BodySkinFieldsR40.js','src/research/r40/BodyShadowValidationR40.js','src/research/r40/BodySkinStylesR40.js'];
const withSources=old=>old.filter(x=>!added.includes(x.file)).concat(added.map(file=>({file,sha256:hash(fs.readFileSync(file))})));
const builtUTC=new Date().toISOString(),skin={bodyControls:22,bodyOnlyStyleImportExport:true,bodyOnlyStyleRestore:true,roughnessOilPresets:3,adjustableDuringMotion:true,previousSkinShaderPreserved:true,screenSpaceDiffusion:true,fullVolumeScattering:false};
const performance={sharedSkinFields:{sameOriginParent:true,byteHashesRechecked:true,expiryMS:120000,maximumFields:4},initialDynamicHandoff:{actualPersonEvaluations:1,standaloneOrInaccessibleParent:'original initialization and handoff',invalidArchive:'retain previous person'},shadowValidation:{bothMapsChecked:true,pairedReadbacks:1,unequalMapsOrShaderFailure:'separate exact reductions',integerTargetUnavailable:'full pixel readback'},experimentalMRTSelected:false,performanceDeviceDependent:true};
const sourceBuild={...sourceBase,...sourceEntry,builtUTC,version:'R40',sources:withSources(sourceBase.sources),skin,performance,sourceFidelityAccepted:false,visualAccepted:false};
const study={...studyBase,...dynamicEntry,builtUTC,version:'R40',sources:withSources(studyBase.sources),skin,performance,characterTriangleFaces:0,sourceFidelityAccepted:false,visualAccepted:false};
const workbench={...workBase,...workEntry,builtUTC,version:'R40',sources:withSources(workBase.sources),stage:'body skin styles, verified field reuse, and conservative shadow validation performance',dynamicBody:{...workBase.dynamicBody,build:'BUILD-STUDY-R40.json'},previousWorkbench:{file:workBase.file,sha256:workBase.sha256},skin,performance,characterTriangleFaces:0};
write('BUILD-SOURCE-R40.json',sourceBuild);write('BUILD-STUDY-R40.json',study);write('BUILD-R40.json',workbench);
write('BUILD.json',{...sourceBuild,selectedVersion:'R40',companionBuild:'BUILD-R40.json',companionWorkbench:'BUILD-R40.json',researchBuild:'BUILD-POSE-R32.json',selection:'R40 retains the current body and skin, adds body-only skin styles and playback controls, and reduces repeated skin and shadow checking work.'});
save('delivery/index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url='+path.basename(workFile)+'"><title>身体三维工作页 R40</title><p><a href="'+path.basename(workFile)+'">打开身体三维工作页</a></p></html>\n');
console.log(JSON.stringify({version:'R40',workbench:workEntry,source:sourceEntry,dynamic:dynamicEntry}));
