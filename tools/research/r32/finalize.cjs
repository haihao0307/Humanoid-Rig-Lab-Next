'use strict';
const fs=require('fs'),crypto=require('crypto');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const body=read('BUILD.json'),workbench=read('BUILD-R32.json'),study=read('BUILD-STUDY-R32.json'),pose=read('BUILD-POSE-R32.json'),qa=read('qa/edges-r32/workbench.json'),route=read('BODY-ROADMAP.json');
if(body.selectedVersion!=='R32'||!qa.passed||qa.artifactSHA256!==workbench.sha256||workbench.sha256!==sha(workbench.file)||body.sha256!==sha(body.file)||study.sha256!==sha(study.file)||pose.sha256!==sha(pose.file))throw Error('R32 build or off-screen workbench checks incomplete');
const previous=read('DELIVERY.json');if(previous.version==='R31'&&!fs.existsSync('DELIVERY-R31.json'))write('DELIVERY-R31.json',previous);
const now=new Date().toISOString(),url='http://127.0.0.1:8914/workbench?v=R32-'+workbench.sha256.slice(0,8),remaining=route.tasks.map(t=>({id:t.id,status:t.status,task:t.title}));
const delivery={...previous,schema:'body-delivery-r32/1',version:'R32',updatedUTC:now,selectedBuild:'BUILD.json',previousDelivery:'DELIVERY-R31.json',
 source:{file:body.file,sha256:body.sha256,bytes:body.bytes,url:'http://127.0.0.1:8914/?v=R32-'+body.sha256.slice(0,8),inheritedGeometryFrom:'BUILD-SOURCE-R31.json'},
 workbench:{file:workbench.file,sha256:workbench.sha256,bytes:workbench.bytes,url},
 direction:'当前人物由参考、既有数据与多轮迭代形成；以当前效果与参数可调为基准继续改进，不再要求原数据表面分析或一比一对照作为前置条件。历史来源记录保留。',
 edgeAntialiasing:{method:'bounded device-aware supersampling and display-only edge-aware filtering',changesCharacterSurface:false,sourceState:true,continuousBody:true,continuousPose:true,legacyContinuous:true,qa:'qa/edges-r32/workbench.json',testedViewAngles:['front','side','back','half'],testedShapePoseAndArchive:true,userVisualReviewPending:true},
 currentMainTask:route.currentMainTask,currentSubtask:route.currentSubtask,mainTasksAccepted:route.mainTasksAccepted,
 runtimeCharacterTriangleFaces:0,characterVertexBuffers:0,headProjectModified:false,projectComplete:false,bodyReconstructionComplete:false,newDeliveredImageFiles:0,
 remaining,evidence:{...previous.evidence,edgeAntialiasing:'qa/edges-r32/workbench.json'}};
write('DELIVERY.json',delivery);
const anchor=read('TASK_ANCHOR.json');Object.assign(anchor,{updatedUTC:now,latestCheckpointUTC:now,currentBuild:'BUILD.json',workingBuild:'BUILD-SOURCE-R32.json',companionBuild:'BUILD-R32.json',workingViewer:url,lastVerifiedBuildHash:workbench.sha256,lastVerifiedCodeCommit:null,stageStatus:'轮廓显示改进及参数/档案检查完成，等待用户观察；其他身体任务仍未完成',remaining});write('TASK_ANCHOR.json',anchor);
console.log(JSON.stringify({version:'R32',url,qaPassed:qa.passed,remaining:remaining.map(x=>x.id)}));
