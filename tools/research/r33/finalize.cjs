'use strict';
const fs=require('fs'),crypto=require('crypto');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const body=read('BUILD.json'),wb=read('BUILD-R33.json'),normal=read('qa/edges-r33/interactive.json'),hidpi=read('qa/edges-r33/high-dpi.json');
if(body.selectedVersion!=='R33'||wb.sha256!==sha(wb.file)||body.sha256!==sha(body.file)||![normal,hidpi].every(q=>q.passed&&q.artifactSHA256===wb.sha256))throw Error('R33 interactive checks or build are incomplete');
const previous=read('DELIVERY.json');if(previous.version==='R32'&&!fs.existsSync('DELIVERY-R32.json'))write('DELIVERY-R32.json',previous);
const route=read('BODY-ROADMAP.json'),task=route.tasks.find(t=>t.id==='P2'),edge=task.subtasks.find(s=>s.id==='P2.edge');
route.currentProductVersion='R33';route.currentMainTask='P2';route.currentSubtask='P2.edge';
task.existing='R33 修复旋转中的边缘着色不一致，延续轮廓抗锯齿；现有体型、局部控制和动作保留。其他连接与动作细节仍需继续完善。';
edge.latestEvidence='实际后台拖动中和停稳后分别检查斜侧、背侧及调整后的身体；常规和高 DPI 画面均通过，详见 qa/edges-r33。';
edge.stillNeeds='请用户在实际三维页检查自己的观察角度；极端形态、其他设备和所有动作组合尚未逐一检查。';
write('BODY-ROADMAP.json',route);
const now=new Date().toISOString(),url='http://127.0.0.1:8914/workbench?v=R33-'+wb.sha256.slice(0,8),remaining=route.tasks.map(t=>({id:t.id,status:t.status,task:t.title}));
write('DELIVERY.json',{...previous,schema:'body-delivery-r33/1',version:'R33',updatedUTC:now,previousDelivery:'DELIVERY-R32.json',selectedBuild:'BUILD.json',
 source:{file:body.file,sha256:body.sha256,bytes:body.bytes,url:'http://127.0.0.1:8914/?v=R33-'+body.sha256.slice(0,8),inheritedGeometryFrom:'BUILD-SOURCE-R32.json'},
 workbench:{file:wb.file,sha256:wb.sha256,bytes:wb.bytes,url},currentMainTask:'P2',currentSubtask:'P2.edge',mainTasksAccepted:route.mainTasksAccepted,
 interactiveEdgeShading:{method:'same derivative neighbourhood at mixed surface-boundary quads during motion and idle',surfaceChanged:false,normalDpiCheck:'qa/edges-r33/interactive.json',highDpiCheck:'qa/edges-r33/high-dpi.json',userVisualReviewPending:true},
 runtimeCharacterTriangleFaces:0,characterVertexBuffers:0,headProjectModified:false,projectComplete:false,bodyReconstructionComplete:false,newDeliveredImageFiles:0,remaining,
 evidence:{...previous.evidence,interactiveEdgeShading:'qa/edges-r33/interactive.json',interactiveEdgeShadingHighDpi:'qa/edges-r33/high-dpi.json'}});
const anchor=read('TASK_ANCHOR.json');Object.assign(anchor,{updatedUTC:now,stageStartedUTC:'2026-10-28T02:53:51Z',hardStopUTC:'2026-10-28T05:53:51Z',latestCheckpointUTC:now,currentBuild:'BUILD.json',workingBuild:'BUILD-SOURCE-R33.json',companionBuild:'BUILD-R33.json',workingViewer:url,currentMainTask:'P2',currentSubtask:'P2.edge',lastVerifiedBuildHash:wb.sha256,lastVerifiedCodeCommit:null,status:'已修复实际转动时的边缘着色，等待用户查看',stageStatus:'常规及高 DPI 的真实拖动、停稳、参数和档案检查通过；其他身体任务仍未完成',remaining});write('TASK_ANCHOR.json',anchor);
const file='EXECUTION-ROUTE.md';let doc=fs.readFileSync(file,'utf8');doc=doc.replace('R32 在默认人物、连续体型及动作画面加入显示采样和边缘抗锯齿','R33 在 R32 的边缘抗锯齿基础上，修复默认人物转动中与停稳后使用不同着色邻域导致的边缘碎齿');fs.writeFileSync(file,doc);
console.log(JSON.stringify({version:'R33',url,normalDpi:normal.passed,highDpi:hidpi.passed}));
