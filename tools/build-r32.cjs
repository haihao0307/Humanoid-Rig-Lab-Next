'use strict';
// R32 builds on the retained R31 body. Only display sampling/compositing and
// current workbench wording are changed; parameter and archive logic is reused.
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const T=require('./research/r32/render-integration.cjs');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),source=f=>fs.readFileSync(f,'utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const save=(f,s)=>{fs.writeFileSync(f+'.building',s);fs.renameSync(f+'.building',f);};
const write=(f,x)=>save(f,JSON.stringify(x,null,2)+'\n');
const fileInfo=(file,html)=>({file,sha256:sha(Buffer.from(html)),bytes:Buffer.byteLength(html)});
const previousSource=read('BUILD-SOURCE-R31.json'),previousWorkbench=read('BUILD-R31.json'),previousStudy=read('BUILD-TORSO-P1.json'),previousPose=read('BUILD-POSE-R29.json');
const helper=source('src/BodyEdgeAA32.js'),integrator='tools/research/r32/render-integration.cjs';
const currentInputs=['src/BodyEdgeAA32.js',integrator,'tools/build-r32.cjs','tools/build.cjs','tools/preview-body.cjs'];
const added=currentInputs.map(file=>({file,sha256:sha(fs.readFileSync(file))}));
const updatedSources=old=>[...old.filter(entry=>!currentInputs.includes(entry.file)),...added];

let html=source(previousSource.file);
html=T.replace(html,source('src/BodyOriginalSkinR26.js'),helper+'\n'+T.skin(source('src/BodyOriginalSkinR26.js')));
html=T.replace(html,source('src/BodyAtlasRayR26.js'),T.source(source('src/BodyAtlasRayR26.js')));
html=T.replace(html,source('src/BodyAtlasPrecisionR26.js'),T.precision(source('src/BodyAtlasPrecisionR26.js')));
html=html.replace('<title>身体 R31','<title>身体 R32').replace('SOURCE FORM / R31','BODY / R32');
const srcInfo=fileInfo('delivery/身体_R32_平滑轮廓.html',html);save(srcInfo.file,html);
const sourceBuild={...previousSource,...srcInfo,version:'R32',canonicalFile:srcInfo.file,builtUTC:new Date().toISOString(),sources:updatedSources(previousSource.sources),inheritedSourceImplementation:{file:'BUILD-SOURCE-R31.json',sha256:previousSource.sha256,geometryUnchanged:true,displayEdgeFiltering:true},edgeAntialiasing:'display-only edge filter and bounded device-aware supersampling'};
write('BUILD-SOURCE-R32.json',sourceBuild);

html=source(previousStudy.file);
const beforeSkin=source('src/research/p1/BodyPoseRaySkinP1.js').replace('sourceAveragedNormalsImplemented:false,normalMethod:frame.normalMethod',"sourceAveragedNormalsImplemented:frame.normalMethod.startsWith('original ordered'),normalMethod:frame.normalMethod");
html=T.replace(html,beforeSkin,helper+'\n'+T.pose(beforeSkin));
html=html.replace('<title>身体 P1 · 连续身体隔离研究','<title>身体 R32 · 连续体型与动作');
const studyInfo=fileInfo('delivery/身体_R32_连续体型.html',html);save(studyInfo.file,html);
write('BUILD-STUDY-R32.json',{...previousStudy,...studyInfo,version:'R32',builtUTC:new Date().toISOString(),sources:updatedSources(previousStudy.sources),edgeAntialiasing:'display-only edge filter and bounded device-aware supersampling'});

html=source(previousPose.file);
html=T.replace(html,source('src/research/r29/BodyPoseRayR29.js'),helper+'\n'+T.pose(source('src/research/r29/BodyPoseRayR29.js')));
const poseInfo=fileInfo('delivery/身体_R32_连续动作.html',html);save(poseInfo.file,html);
write('BUILD-POSE-R32.json',{...previousPose,...poseInfo,version:'R32',builtUTC:new Date().toISOString(),sources:updatedSources(previousPose.sources),edgeAntialiasing:'display-only edge filter and bounded device-aware supersampling'});

html=source(previousWorkbench.file);
html=T.replace(html,source('src/BodyRayAdaptiveR24.js'),helper+'\n'+T.adaptive(source('src/BodyRayAdaptiveR24.js')));
let surface=source('src/BodyWorkbenchSurfaceR31.js');
const captionStart=surface.indexOf(' function caption(){'),captionEnd=surface.indexOf('\n function removeChild()',captionStart);
if(captionStart<0||captionEnd<0)throw Error('R32 surface caption anchor missing');
surface=surface.slice(0,captionStart)+" function caption(){window.__BODY_REFRESH_LOOK_CONTROLS_R27__?.();retry.hidden=!(error||precisionState?.lastError);label.textContent=error?'显示未能载入，上一人物和参数已保留，可重试。':kind==='source'?'当前身体已显示，可直接调整参数。':kind==='dynamic-body-p1'?(precisionState?.lastError?'身体更新失败，上一人物已保留。':'身体、四肢与颈口已联动。'):kind==='pose-functions'?'身体动作已联动。':kind==='loading'?'正在更新身体，上一画面会暂时保留…':'连续参数研究画面';}"+surface.slice(captionEnd);
html=T.replace(html,source('src/BodyWorkbenchSurfaceR31.js'),surface);
html=html.replaceAll(path.basename(previousWorkbench.sourceViewer.file),path.basename(srcInfo.file)).replaceAll(previousWorkbench.sourceViewer.sha256,srcInfo.sha256);
html=html.replaceAll(path.basename(previousStudy.file),path.basename(studyInfo.file));
html=html.replaceAll(path.basename(previousPose.file),path.basename(poseInfo.file)).replaceAll(previousPose.sha256,poseInfo.sha256);
html=html.replace('<title>人物身体 R31','<title>人物身体 R32').replace('BODY STUDY / R31','BODY STUDY / R32');
html=html.replace('从原轮廓状态调整时，尚未接入的参数组合不会自动替换成简化表面。如需查看未验收结果，可切换到连续参数研究候选；原有研究档案仍可载入。','基于当前身体继续调整体型、局部参数与动作；尚未接通的组合会保留当前人物并给出提示。');
for(const [oldText,newText] of [
 ['带当前人物查看原貌','单独查看当前身体'],
 ['另开原版对照','在新窗口打开'],
 ['原数据复刻<br>待验收候选','身体三维<br>参数工作台'],
 ['原数据响应对照','身体参数与校准'],
 ['打开连续关节原轮廓候选','打开连续动作画面'],
 ['已核对状态优先显示原貌','当前身体（自动选择）'],
 ['连续四肢、六种 Anny 原体型的根关节与五段躯干，以及 B 明确关闭修正时的根关节与脊柱已接通。头颈边界随原绑定更新；任意体型与原皮肤仍待完成。','可调整身体体型、局部参数与动作；暂不支持的组合会保留当前人物。'],
 ['进入时保留原人物的全部默认体型与局部调整。当前函数表面仍未通过一比一复刻验收。','进入时保留当前人物的体型与局部调整。'],
 ['校准档把当前人物的体重和肌肉设为 0.5，并清零身体局部控制；年龄、性别、身高、比例、动作、驱动和头部参数保留。它仍待验收，原绑定与软组织尚未分离。仅已接入原轮廓的状态可以使用；其他组合会保留当前人物。切换前的人物会随档案保存，可随时恢复。','校准档把体重和肌肉设为 0.5，并清零身体局部控制；年龄、性别、身高、比例、动作、驱动和头部参数保留。暂不支持的组合会保留当前人物；切换前的人物随档案保存，可随时恢复。'],
 ['原貌显示保留原始细节；表面精度选项用于连续研究候选。','表面精度选项用于连续参数研究画面。'],
 ['身体由函数、变量和噪波构成；只处理身体，头部接入口保留。R24保留完整参数和原颈部流程，加入原参数校准档及对应边界。原貌页与连续参数页的完整人物可往返；连续表面迁移仍待验收。连续参数页的隐式表面仍未通过原数据复刻验收；原貌对照页继续保留。','身体由函数、变量和噪波构成；当前页面用于调整身体，头部设置与完整人物档案会保留。']
]) html=html.replaceAll(oldText,newText);
const wbInfo=fileInfo('delivery/人物身体_R32_平滑轮廓.html',html);save(wbInfo.file,html);
const wb={...previousWorkbench,...wbInfo,version:'R32',builtUTC:new Date().toISOString(),stage:'current body refinement: antialiased silhouette with adjustable body and pose',sources:updatedSources(previousWorkbench.sources),sourceViewer:{...previousWorkbench.sourceViewer,file:srcInfo.file,sha256:srcInfo.sha256},edgeAntialiasing:'display-only edge filter and bounded device-aware supersampling'};
write('BUILD-R32.json',wb);
write('BUILD.json',{...sourceBuild,selectedVersion:'R32',companionBuild:'BUILD-R32.json',companionWorkbench:'BUILD-R32.json',researchBuild:'BUILD-POSE-R32.json',selection:'R32 retains the existing adjustable body and its construction history, improves displayed edge sampling, and continues visual refinement without requiring a new source-data comparison.'});
save('delivery/index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url='+path.basename(wbInfo.file)+'"><title>身体三维工作页 R32</title><p><a href="'+path.basename(wbInfo.file)+'">打开身体三维工作页</a></p></html>\n');
console.log(JSON.stringify({version:'R32',source:srcInfo,workbench:wbInfo,study:studyInfo,pose:poseInfo}));
