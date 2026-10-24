'use strict';
// Assemble evidence without turning runtime checks into source-fidelity acceptance.
const fs=require('fs'),crypto=require('crypto'),H=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f)),write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');
const source=read('BUILD-SOURCE-R23.json'),workbench=read('BUILD-R23.json'),selected=read('BUILD.json');
if(selected.sha256!==source.sha256||selected.companionBuild!=='BUILD-R23.json')throw Error('R23 selection is inconsistent');
for(const b of [source,workbench])if(H(fs.readFileSync(b.file))!==b.sha256)throw Error('Changed artifact '+b.file);
const evidence={};
for(const [key,file,kind] of [
 ['integrity','release-integrity.json','passed'],
 ['sourceRuntime','source-browser.json','runtimeChecksPassed'],
 ['sourceLifecycle','source-lifecycle-browser.json','passed'],
 ['workbenchPacket','body-packet-browser.json','passed'],
 ['personHandoff','page-handoff-browser.json','passed'],
 ['workerCancellation','worker-cancellation-browser.json','passed'],
 ['httpViewer','http-viewer.json','passed'],
 ['originalProfiles','active-profiles-pixels-browser.json','diagnosticCompleted'],
 ['originalBodyControls','body-surface-source-browser.json','diagnosticCompleted'],
 ['proceduralFields','procedural-field-regeneration.json','passed'],
 ['cleanFieldRebuild','clean-field-rebuild.json','passed']
]){
 const path='qa/fidelity-r23/'+file,q=read(path);
 if(q[kind]!==true||q.failure||q.artifactStable===false||q.errors?.length)throw Error('Incomplete evidence '+path);
 if(q.artifactSHA256&&![source.sha256,workbench.sha256].includes(q.artifactSHA256))throw Error('Stale evidence '+path);
 evidence[key]={file:path,sha256:H(fs.readFileSync(path)),result:kind,artifactSHA256:q.artifactSHA256||null,checks:q.checks?.length||null,cases:q.cases?.length||q.frames?.length||null,finishedUTC:q.finishedUTC||null};
}
const old=read('DELIVERY.json');
if(!fs.existsSync('DELIVERY-R22.json')){if(old.selectedVersion!=='R22')throw Error('Missing frozen R22 delivery');fs.copyFileSync('DELIVERY.json','DELIVERY-R22.json');}
const prior=read('DELIVERY-R22.json'),anchor=read('TASK_ANCHOR.json');
const remaining=[
 {priority:0,status:'incomplete',task:'完成原表面、首交、边界、分层、法线与外观正式复刻验收；仍有边缘和局部像素差异，正式容差未设定。记录顺序下的18幅阴影已复现，任意历史及连续状态的动态阴影尚未完成。'},
 {priority:1,status:'incomplete',task:'原数据基准通过后，完成中性整体校准、胸肩带、腰腹与骨盆体量，并分离支撑骨架与软组织响应；不将R18–R20估算改形当作已验收母体。'},
 {priority:2,status:'incomplete',task:'完成肩髋连接、肘膝腕踝、手足细轮廓与连续动作组合；原貌页目前只有9个记录状态，完整控制仍在另一个未验收的连续函数工作页。'},
 {priority:3,status:'incomplete',task:'建立自主结构函数母体，逐区替换来源分面分区、形态和绑定数据；当前仍保留来源分区信息，不能声称自主母体完成。'},
 {priority:4,status:'partial',task:'已完成按需原貌字段、字节包传输、CPU无损分页与部分皮纹函数重建；全系统局部更新、GPU内存、动态光学、其余肌理仍需继续。'},
 {priority:5,status:'incomplete',task:'完成真实连续头侧边界提供方、身体颈部在连续新表面的整合，以及头部、附件、坐标跟随与总平台联调；头部项目未修改。'}
];
const profiles=read(evidence.originalProfiles.file),controls=read(evidence.originalBodyControls.file),runtime=read(evidence.sourceRuntime.file);
const pixelSummary=q=>({cases:q.cases.length,nonBodyDraws:q.cases.reduce((n,c)=>n+(c.source.nonBodyDraws||0),0),maximumRGBCodeDifference:Math.max(...q.cases.map(c=>c.fullFrame.RGBMaximum)),maximumInteriorRGBCodeDifference:Math.max(...q.cases.map(c=>c.fullFrame.interior.maximum)),maximumCoverageDisagreementPixels:Math.max(...q.cases.map(c=>c.fullFrame.sourceOnly+c.fullFrame.candidateOnly)),accepted:false});
const now=new Date().toISOString();
const delivery={
 schema:'body-function-delivery/8',reviewedUTC:now,selectedVersion:'R23',status:'checked working candidate; source fidelity and full reconstruction incomplete',
 artifact:source.file,sha256:source.sha256,bytes:source.bytes,companionWorkbench:{file:workbench.file,sha256:workbench.sha256,bytes:workbench.bytes},
 prior:{version:'R22',file:prior.artifact,sha256:prior.sha256,delivery:'DELIVERY-R22.json',status:'retained unchanged fallback'},
 scope:'BODY ONLY',characterTriangleFaces:0,characterVertexBuffers:0,rasterPrimitive:'POINTS',headGenerated:false,headBoardModified:false,
 sharedR15ReferenceSHA256:prior.sharedR15ReferenceSHA256,sourceDerivedCalibration:true,sourceFacetPartitionInformationRetained:true,wholeBodySourceIndependent:false,
 completedMotherConversion:false,bodyReconstructionComplete:false,sourceFidelityAccepted:false,visualAccepted:false,acceptanceTolerance:null,
 allOriginalControlCombinationsCertified:false,geometryParameterVariationOnSourceCandidate:false,fixedOriginalStates:9,
 originalBodySurfaceControls:['bodyVariation','bodyPores','jointTone','neckCreases'],originalBodySurfaceControlsImplemented:true,
 continuousHeadProviderImplemented:false,originalNeckNumericStagesImplemented:true,actualOriginalBodySkinPipelineImplemented:true,
 sourceOwnSkinReproduced:false,fullVolumeScattering:false,sourceGraphFieldsByteExact:true,sourceShadowCaches:true,
 shadowCacheScope:'18 original maps and matrices match the nine recorded native update states; arbitrary transition history and continuous dynamic shadows remain incomplete',
 fullControlsRetainedInCompanion:true,controls:prior.controls,mainPlatformMigrated:false,publicWebDeployment:false,
 githubSyncRequested:true,githubRepository:prior.githubRepository,githubBranch:prior.githubBranch,
 implemented:[
  'four original body surface controls use the unchanged original material formula and reuse current exact geometry',
  'source coefficients load by state with compressed/raw hashes, atomic failure preservation and a two-state decoded cache',
  'complete workbench byte packet avoids duplicate bulk base64 and verifies bytes before initializing one current field',
  'both page directions preserve complete-person archives, original head and unknown fields, surface controls and camera',
  'actual precision-worker cancellation and latest-camera coalescing; diagnostic GPU context created only on demand',
  'source WebGL loss recovery and download of retained persons; failed packet and coefficient loads preserve incoming persons',
  'three full RGBA original procedural skin fields and cavity R regenerate bit exactly from the original function and recipe'
 ],
 storage:{...source.data.storage,sourceHTMLBytes:source.bytes,workbenchHTMLBytes:workbench.bytes,initialSourceCoefficientBlobs:6,initialSourceCoefficientCompressedBytes:5278913,maximumDecodedStates:2,workbenchPacketCompressedBytes:workbench.bytePacket.compressedBytes,workbenchPacketRawBytes:workbench.bytePacket.rawBytes,allDeliveryAssets:74,allDeliveryAssetCompressedBytes:196389054,workbenchGPUFieldBytes:352871712,noLossyQuantization:true},
 proceduralRegeneration:{fullRGBA:source.proceduralFields.fullRGBARecreated,cavityR:true,cavityAuxiliaryGBA:'original cached head/appendage channels retained; not claimed regenerated',sourceIndependentSkin:false},
 evidence,
 originalComparison:{profiles:pixelSummary(profiles),bodySurfaceControls:pixelSummary(controls),strictNonBodyDrawExclusion:true,sourceFullSceneShadowVisibilityPreserved:true,sourceShadowCachesAndMatricesMatched:Object.values(profiles.shadowParity).flat().every(x=>x.matched&&x.matrixMatched),crossContextPixelExact:runtime.crossContextPixelExact,pixelComparisonAcceptance:false},
 inheritedEvidence:{release:'DELIVERY-R22.json',scope:'unchanged original neck arithmetic/operator, dense GPU shader, original body program and source surface coefficients; not complete source acceptance',sourceNeckStates:17,sourceNeckChecks:78},
 remaining,localViewer:'http://127.0.0.1:8914/?v=R23-'+source.sha256.slice(0,8),localWorkbench:'http://127.0.0.1:8914/?view=workbench'
};
write('DELIVERY.json',delivery);
Object.assign(anchor,{updatedUTC:now,latestCheckpointUTC:now,latestAuditUTC:now,status:'R23 checked working candidate; GitHub synchronization pending',stageStatus:'local checks complete; reconstruction and source acceptance remain incomplete',latestAudit:'DELIVERY.json',nextPriority:remaining[0].task,remaining,projectComplete:false});write('TASK_ANCHOR.json',anchor);
const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url='+source.file.split('/').pop()+'"><title>身体三维工作页 R23</title><p><a href="'+source.file.split('/').pop()+'">打开身体原貌与表面控制</a></p><p><a href="'+workbench.file.split('/').pop()+'">打开完整参数与人物工作页</a></p></html>\n';fs.writeFileSync('delivery/index.html',html);
console.log(JSON.stringify({version:delivery.selectedVersion,source:source.sha256,workbench:workbench.sha256,evidence:Object.keys(evidence).length,remaining:remaining.length}));
