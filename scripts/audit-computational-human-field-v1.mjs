import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIELD_BINARY_MAGIC_V1, FIELD_BRICK_MAGIC_V1, FIELD_REGION_MAGIC_V1, parseFieldBinaryV1 } from '../src/modules/human-core-v5/computational-human-field-v1/field-format-v1.js';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const assets=resolve(root,'assets/human/computational-human-field-v1'),qa=resolve(root,'artifacts/qa/task18a-computational-human-field-v1'),review=resolve(root,'artifacts/review/task18a-computational-human-field-v1');
const [metadata,provenance,articulated,correctives,ninePose,staticFit,stability,staticIso,browser,pngAudit,finalStatus,delivery,portable,coarse,bricks,regions,rootHtml,standalone,runtime,wgsl,zip]=await Promise.all([
  json(resolve(assets,'canonical-anatomy-field-v1.json')),json(resolve(assets,'FIELD_PROVENANCE_AND_AUTHORITY.json')),json(resolve(assets,'ARTICULATED_DEFORMATION_FIELD_V1.json')),json(resolve(assets,'POSE_CORRECTIVE_FIELDS_V1.json')),json(resolve(qa,'nine-pose-field-qa-round-2.json')),json(resolve(qa,'static-field-fit-round-2.json')),json(resolve(qa,'field-stability-round-2.json')),json(resolve(qa,'qa-isosurface-round-2.json')),json(resolve(qa,'browser-field-evidence.json')),json(resolve(qa,'png-content-audit.json')),json(resolve(qa,'TASK18A_FINAL_STATUS.json')),json(resolve(qa,'delivery-report-36-items.json')),json(resolve(review,'portable-review-manifest.json')),readFile(resolve(assets,'canonical-anatomy-field-v1.bin')),readFile(resolve(assets,'field-brick-atlas-v1.bin')),readFile(resolve(assets,'field-region-atlas-v1.bin')),readFile(resolve(root,'human-core-v5-computational-human-field-v1.html')),readFile(resolve(review,'computational-human-field-review-standalone.html')),readFile(resolve(root,'apps/human-core-v5-computational-human-field-v1/index.js')),readFile(resolve(root,'apps/human-core-v5-computational-human-field-v1/field-raymarch-v1.wgsl')),readFile(resolve(review,'review-package.zip')),
]);
const assertions=[];const check=(id,passed,actual,expected)=>assertions.push({id,passed:Boolean(passed),actual,expected});
const coarseParsed=parseFieldBinaryV1(coarse,FIELD_BINARY_MAGIC_V1),brickParsed=parseFieldBinaryV1(bricks,FIELD_BRICK_MAGIC_V1),regionParsed=parseFieldBinaryV1(regions,FIELD_REGION_MAGIC_V1);
check('coarse-magic',coarseParsed.magic===FIELD_BINARY_MAGIC_V1,coarseParsed.magic,FIELD_BINARY_MAGIC_V1);
check('brick-magic',brickParsed.magic===FIELD_BRICK_MAGIC_V1,brickParsed.magic,FIELD_BRICK_MAGIC_V1);
check('region-magic',regionParsed.magic===FIELD_REGION_MAGIC_V1,regionParsed.magic,FIELD_REGION_MAGIC_V1);
check('brick-hash',sha256(bricks)===metadata.fieldBrickHash,sha256(bricks),metadata.fieldBrickHash);
check('provenance-brick-hash',provenance.fieldBrickHash===metadata.fieldBrickHash,provenance.fieldBrickHash,metadata.fieldBrickHash);
check('renderer-hash',sha256(Buffer.concat([runtime,wgsl]))===metadata.rendererProgramHash,sha256(Buffer.concat([runtime,wgsl])),metadata.rendererProgramHash);
check('page-byte-identical',Buffer.compare(rootHtml,standalone)===0,sha256(rootHtml),sha256(standalone));
check('standalone-hash',sha256(standalone)===portable.standaloneSha256,sha256(standalone),portable.standaloneSha256);
check('zip-hash',sha256(zip)===portable.reviewPackage.sha256,sha256(zip),portable.reviewPackage.sha256);
check('field-brick-count',brickParsed.header.activeBrickCount===metadata.sparseSurfaceBricks.activeBrickCount,brickParsed.header.activeBrickCount,metadata.sparseSurfaceBricks.activeBrickCount);
check('field-brick-payload-size',brickParsed.payload.byteLength===metadata.sparseSurfaceBricks.activeBrickCount*metadata.sparseSurfaceBricks.valuesPerBrick*2,brickParsed.payload.byteLength,metadata.sparseSurfaceBricks.activeBrickCount*metadata.sparseSurfaceBricks.valuesPerBrick*2);
check('region-payload-size',regionParsed.payload.byteLength===metadata.sparseSurfaceBricks.activeBrickCount*metadata.sparseSurfaceBricks.valuesPerBrick,regionParsed.payload.byteLength,metadata.sparseSurfaceBricks.activeBrickCount*metadata.sparseSurfaceBricks.valuesPerBrick);
check('runtime-no-position',metadata.runtimeProductionPositionArray===false&&provenance.referencePositionArrayCopiedToRuntime===false,{runtime:metadata.runtimeProductionPositionArray,copied:provenance.referencePositionArrayCopiedToRuntime},false);
check('runtime-no-index',metadata.runtimeProductionIndexArray===false&&provenance.referenceIndexArrayCopiedToRuntime===false,{runtime:metadata.runtimeProductionIndexArray,copied:provenance.referenceIndexArrayCopiedToRuntime},false);
check('runtime-no-mesh',metadata.runtimeMeshAuthority===false&&browser.visibleMeshCount===0,{authority:metadata.runtimeMeshAuthority,visible:browser.visibleMeshCount},false);
check('runtime-no-reference',metadata.runtimeReferenceMeshLoaded===false&&browser.runtimeReferenceMeshLoaded===false,{metadata:metadata.runtimeReferenceMeshLoaded,browser:browser.runtimeReferenceMeshLoaded},false);
check('runtime-no-glb',metadata.externalHumanGlbLoaded===false&&browser.externalHumanAssetRequests.length===0,{loaded:metadata.externalHumanGlbLoaded,requests:browser.externalHumanAssetRequests.length},false);
check('rig-joints',metadata.humanRigCoreMapping.jointCount===69,metadata.humanRigCoreMapping.jointCount,69);
check('rig-twists',metadata.humanRigCoreMapping.twistBoneCount===14,metadata.humanRigCoreMapping.twistBoneCount,14);
check('inverse-iterations',articulated.maximumInverseWarpIterations===4,articulated.maximumInverseWarpIterations,4);
check('corrective-count',correctives.fields.length===5,correctives.fields.length,5);
check('pose-count',ninePose.poseCount===9,ninePose.poseCount,9);
check('mode-count',portable.interfaceModes.length===10,portable.interfaceModes.length,10);
for(const mode of portable.interfaceModes)check(`mode-${mode}`,standalone.includes(mode),mode,'present');
check('public-state',standalone.includes('__HRL_COMPUTATIONAL_HUMAN_FIELD_V1__'),'global','present');
check('offline-csp',standalone.includes("connect-src 'none'"),'connect-src','none');
check('offline-no-http',!/(?:src|href)=["']https?:\/\//i.test(standalone.toString('utf8')),'external src/href',0);
check('file-ready',portable.fileProtocolReady===true,portable.fileProtocolReady,true);
check('browser-ready',browser.ready===true&&browser.firstFrameRendered===true,true,true);
check('browser-errors',browser.consoleErrors.length+browser.pageErrors.length+browser.startupErrors.length+browser.failedRequests.length===0,browser.consoleErrors.length+browser.pageErrors.length+browser.startupErrors.length+browser.failedRequests.length,0);
check('screenshots',browser.screenshotCount===32&&pngAudit.decodedCount===32&&pngAudit.passed===true,{manifest:browser.screenshotCount,decoded:pngAudit.decodedCount,passed:pngAudit.passed},32);
check('static-qa-component',staticIso.qaComponentCount===1,staticIso.qaComponentCount,1);
check('static-qa-boundary',staticIso.qaBoundaryEdgeCount===0,staticIso.qaBoundaryEdgeCount,0);
check('static-distance-targets',staticFit.meanSurfaceDistance<=.004&&staticFit.p95SurfaceDistance<=.010&&staticFit.maximumSurfaceDistance<=.025,{mean:staticFit.meanSurfaceDistance,p95:staticFit.p95SurfaceDistance,max:staticFit.maximumSurfaceDistance},'<= 0.004/0.010/0.025');
check('static-normal-p95-failure',staticFit.p95NormalAngleError>25,staticFit.p95NormalAngleError,'>25 retained as failure');
check('million-samples',stability.sampleCount===1_000_000,stability.sampleCount,1_000_000);
check('dynamic-failure',ninePose.passed===false&&ninePose.failedPoseIds.length===9,ninePose.failedPoseIds,9);
check('final-conclusion',finalStatus.conclusion==='COMPUTATIONAL_FIELD_DYNAMIC_ARCHITECTURE_FAILED',finalStatus.conclusion,'COMPUTATIONAL_FIELD_DYNAMIC_ARCHITECTURE_FAILED');
check('delivery-count',delivery.items.length===36,delivery.items.length,36);
check('visual-flags',finalStatus.task18aVisualAcceptance===false&&finalStatus.visualAcceptance===false&&finalStatus.productionReady===false&&finalStatus.userVisualAcceptance==='pending',{task18aVisualAcceptance:finalStatus.task18aVisualAcceptance,visualAcceptance:finalStatus.visualAcceptance,productionReady:finalStatus.productionReady,userVisualAcceptance:finalStatus.userVisualAcceptance},'false/false/false/pending');
check('no-task18b',finalStatus.prohibitedFollowups.task18bStarted===false,false,false);
check('no-final-commit',finalStatus.prohibitedFollowups.finalPassCommitCreated===false,false,false);
check('no-final-push',finalStatus.prohibitedFollowups.finalBranchPushed===false,false,false);
const pngFiles=(await readdir(resolve(qa,'screenshots'))).filter(name=>name.endsWith('.png'));
check('png-file-count',pngFiles.length===32,pngFiles.length,32);
const report={schema:'humanoid_rig/task18a_computational_field_final_audit@1.0',assertionCount:assertions.length,failedAssertions:assertions.filter(item=>!item.passed).map(item=>item.id),assertions,passed:assertions.every(item=>item.passed),conclusion:finalStatus.conclusion,task18aVisualAcceptance:false,visualAcceptance:false,productionReady:false,userVisualAcceptance:'pending'};
await writeFile(resolve(qa,'final-file-audit.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');
process.stdout.write(`${JSON.stringify({passed:report.passed,assertionCount:report.assertionCount,failedAssertions:report.failedAssertions,conclusion:report.conclusion},null,2)}\n`);
if(!report.passed)process.exitCode=1;

async function json(path){return JSON.parse(await readFile(path,'utf8'));}
function sha256(bytes){return createHash('sha256').update(bytes).digest('hex').toUpperCase();}
