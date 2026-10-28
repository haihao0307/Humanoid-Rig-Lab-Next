'use strict';
// Update the fixed project route only after the delivered workbench checks pass.
const fs=require('fs'),crypto=require('crypto');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const qa=read('qa/skin-r35/summary.json'),source=read('BUILD-SOURCE-R35.json'),work=read('BUILD-R35.json');
if(!qa.passed||qa.checks.length<7||qa.workbenchSHA256!==work.sha256)throw Error('R35 workbench checks have not passed for this build');
const now=new Date().toISOString(),url='http://127.0.0.1:8914/workbench?v=R35-'+work.sha256.slice(0,8);
const route=read('BODY-ROADMAP.json'),find=(task,sub)=>route.tasks.find(t=>t.id===task).subtasks.find(t=>t.id===sub);
route.tasks.find(t=>t.id==='P4').existing='R35 已为固定预设和受支持的 A 骨架体型、姿势接入既有皮肤、22 项调节、动态方向光阴影及屏幕空间柔光；其他身体状态和设备仍需覆盖。';
Object.assign(find('P4','P4.2'),{latestEvidence:'固定预设及受支持的 A 骨架形体和姿势使用既有皮肤、微细纹理、22 项界面调节和动态方向光阴影；屏幕空间扩散可调，实际工作页的滑块、近景、灯光、档案和恢复检查见 qa/skin-r35。',stillNeeds:'继续覆盖年龄、性别、旧档改形和 B 骨架等尚未接入的身体状态，并由用户观察实际效果；完整物理体积散射及目标设备验证未完成。'});
Object.assign(find('P2','P2.edge'),{latestEvidence:'R35 继承 R33 的边缘处理；受支持的动态皮肤在实际工作页的两组拖动和停稳对比见 qa/skin-r35/drag.json。',stillNeeds:'用户在实际三维页检查常用角度；更多设备、极端形态及动作组合尚未逐一覆盖。'});
find('P2','P2.4').latestEvidence='R35 受支持的 A 骨架姿势可使用可调皮肤与动态阴影；六个动作按钮仍是静态姿势。B 骨架默认状态可切换，屈髋膝组合尚未接通。';
write('BODY-ROADMAP.json',route);
if(!fs.existsSync('DELIVERY-R34.json'))fs.copyFileSync('DELIVERY.json','DELIVERY-R34.json');
const delivery=read('DELIVERY-R34.json');
Object.assign(delivery,{schema:'body-delivery-r35/1',version:'R35',updatedUTC:now,
 source:{file:source.file,sha256:source.sha256,bytes:source.bytes,url:'http://127.0.0.1:8914/?v=R35-'+source.sha256.slice(0,8),inheritedGeometryFrom:'BUILD-SOURCE-R33.json'},
 workbench:{file:work.file,sha256:work.sha256,bytes:work.bytes,url},
 previousDelivery:'DELIVERY-R34.json',currentMainTask:'P4',currentSubtask:'P4.2',newDeliveredImageFiles:0,
 capabilityReview:'docs/SURFACE-R35.md',surfaceControls:22,
 platformCapabilities:{...delivery.platformCapabilities,supportedARigPoseSkinPreview:true,supportedDynamicOriginalSkin:true,dynamicFullOriginalSkin:false,dynamicOriginalShadows:true,dynamicOriginalDiffusion:true,screenSpaceDiffusionOnly:true,fullVolumeScattering:false},
 surfaceImplementation:{sourceDerived:true,triangleFree:true,supportedFixedStates:true,supportedARigShapesAndPoses:true,dynamicDirectionalShadows:2,screenSpaceDiffusion:true,appearanceOnlyReusesGeometry:true,visualAccepted:false,otherDevicesVerified:false},
 evidence:{...delivery.evidence,surfaceWorkbench:'qa/skin-r35/workbench.json',surfaceMicroDetails:'qa/skin-r35/micro-details.json',surfaceHandoff:'qa/skin-r35/handoff.json',surfaceDrag:'qa/skin-r35/drag.json',surfaceDragHighDPI:'qa/skin-r35/drag-highdpi.json',surfaceLights:'qa/skin-r35/light-presets.json',surfaceLifecycle:'qa/skin-r35/lifecycle.json',surfaceEquivalence:'qa/skin-r35/equivalence.json',surfaceSummary:'qa/skin-r35/summary.json'}});
write('DELIVERY.json',delivery);
const anchor=read('TASK_ANCHOR.json');
Object.assign(anchor,{updatedUTC:now,stageStartedUTC:'2026-10-28T03:40:32Z',hardStopUTC:'2026-10-28T06:40:32Z',latestCheckpointUTC:now,latestAuditUTC:now,
 status:'R35 已接入受支持固定和 A 骨架身体的可调皮肤、动态阴影及屏幕空间柔光；其余身体状态、连续动作和平台整合未完成。',
 stage:'P4.2 身体体表与前端控制',stageStatus:'已测范围的皮肤功能接入并通过后台检查；其他身体状态和用户视觉验收待完成',
 workingBuild:'BUILD-SOURCE-R35.json',companionBuild:'BUILD-R35.json',workingViewer:url,latestAudit:'docs/SURFACE-R35.md',
 nextPriority:'继续 P4.2 尚未覆盖的身体状态与设备；再按固定路线推进 P3.3 参数及旧档效果、P2.4 连续动作和 P5 平台整合。',projectComplete:false,currentIterationProjectComplete:false});
write('TASK_ANCHOR.json',anchor);
console.log(JSON.stringify({version:'R35',url,workbenchSHA256:work.sha256,qaSHA256:sha('qa/skin-r35/summary.json')}));
