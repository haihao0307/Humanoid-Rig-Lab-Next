import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FIELD_BINARY_MAGIC_V1,
  FIELD_BRICK_MAGIC_V1,
  FIELD_REGION_MAGIC_V1,
  parseFieldBinaryV1,
  reconstructDenseFieldV1,
} from '../src/modules/human-core-v5/computational-human-field-v1/field-format-v1.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const assetDirectory = resolve(root, 'assets/human/computational-human-field-v1');
const qaDirectory = resolve(root, 'artifacts/qa/task18a-computational-human-field-v1');
const reviewDirectory = resolve(root, 'artifacts/review/task18a-computational-human-field-v1');
await mkdir(reviewDirectory, { recursive: true });
const paths = {
  metadata: resolve(assetDirectory, 'canonical-anatomy-field-v1.json'),
  provenance: resolve(assetDirectory, 'FIELD_PROVENANCE_AND_AUTHORITY.json'),
  articulated: resolve(assetDirectory, 'ARTICULATED_DEFORMATION_FIELD_V1.json'),
  correctives: resolve(assetDirectory, 'POSE_CORRECTIVE_FIELDS_V1.json'),
  coarse: resolve(assetDirectory, 'canonical-anatomy-field-v1.bin'),
  bricks: resolve(assetDirectory, 'field-brick-atlas-v1.bin'),
  regions: resolve(assetDirectory, 'field-region-atlas-v1.bin'),
  staticQa: resolve(qaDirectory, 'static-field-fit-round-2.json'),
  stability: resolve(qaDirectory, 'field-stability-round-2.json'),
  staticIso: resolve(qaDirectory, 'qa-isosurface-round-2.json'),
  ninePose: resolve(qaDirectory, 'nine-pose-field-qa-round-2.json'),
  runtime: resolve(root, 'apps/human-core-v5-computational-human-field-v1/index.js'),
  styles: resolve(root, 'apps/human-core-v5-computational-human-field-v1/styles.css'),
  wgsl: resolve(root, 'apps/human-core-v5-computational-human-field-v1/field-raymarch-v1.wgsl'),
  cameraSafety: resolve(root, 'apps/human-core-v5-production-surface-v1/camera-safety-controller-v1.js'),
};
const [metadataText, provenanceText, articulatedText, correctivesText, coarse, bricks, regions, staticQaText, stabilityText, staticIsoText, ninePoseText, runtime, styles, wgsl, cameraSafety] = await Promise.all([
  readFile(paths.metadata,'utf8'),readFile(paths.provenance,'utf8'),readFile(paths.articulated,'utf8'),readFile(paths.correctives,'utf8'),readFile(paths.coarse),readFile(paths.bricks),readFile(paths.regions),readFile(paths.staticQa,'utf8'),readFile(paths.stability,'utf8'),readFile(paths.staticIso,'utf8'),readFile(paths.ninePose,'utf8'),readFile(paths.runtime,'utf8'),readFile(paths.styles,'utf8'),readFile(paths.wgsl,'utf8'),readFile(paths.cameraSafety,'utf8'),
]);
const metadata=JSON.parse(metadataText),provenance=JSON.parse(provenanceText),articulated=JSON.parse(articulatedText),correctives=JSON.parse(correctivesText),staticQa=JSON.parse(staticQaText),stability=JSON.parse(stabilityText),staticIso=JSON.parse(staticIsoText),ninePose=JSON.parse(ninePoseText);
const field=reconstructDenseFieldV1({metadata,coarsePayload:parseFieldBinaryV1(coarse,FIELD_BINARY_MAGIC_V1).payload,brickPayload:parseFieldBinaryV1(bricks,FIELD_BRICK_MAGIC_V1).payload,regionPayload:parseFieldBinaryV1(regions,FIELD_REGION_MAGIC_V1).payload});
const denseBytes=Buffer.from(field.values.buffer,field.values.byteOffset,field.values.byteLength);
const rendererProgramHash=sha256(Buffer.concat([Buffer.from(runtime),Buffer.from(wgsl)]));
metadata.rendererProgramHash=rendererProgramHash;
metadata.renderer={id:'HRLComputationalHumanFieldRendererV1',primaryPath:'WebGPU WGSL',fallbackPath:'WebGL2 fragment raymarch',deliveredWgslProgram:'apps/human-core-v5-computational-human-field-v1/field-raymarch-v1.wgsl',offlineEvidencePath:'WebGL2 fragment raymarch',cameraSafetyController:'CameraSafetyControllerV1',humanMeshDrawCalls:0,fullscreenCarrierTriangleCount:1,fullscreenCarrierIsHumanGeometry:false};
provenance.rendererProgramHash=rendererProgramHash;
await Promise.all([writeJson(paths.metadata,metadata),writeJson(paths.provenance,provenance)]);

const embedded={
  schema:'humanoid_rig/task18a_computational_human_field_embedded_review@1.0',
  metadata,
  articulated,
  correctives,
  poses:articulated.poses,
  denseFieldBase64:denseBytes.toString('base64'),
  denseFieldBytes:denseBytes.byteLength,
  staticQa,
  stability,
  staticIso,
  ninePose,
  wgsl,
  authority:{runtimeProductionPositionArray:false,runtimeProductionIndexArray:false,runtimeMeshAuthority:false,runtimeReferenceMeshLoaded:false,externalHumanGlbLoaded:false,visibleMeshCount:0,visibleHumanFieldCount:1},
  conclusion:'COMPUTATIONAL_FIELD_DYNAMIC_ARCHITECTURE_FAILED',
  approvals:{task18aVisualAcceptance:false,visualAcceptance:false,productionReady:false,userVisualAcceptance:'pending'},
};
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'"><title>Task 18A — Computational Human Field V1</title><style>${styles}</style></head><body><div id="app"></div><script>${safeScript(`globalThis.__HRL_COMPUTATIONAL_FIELD_EMBEDDED__=${JSON.stringify(embedded)};`)}</script><script>${safeScript(cameraSafety)}</script><script>${safeScript(runtime)}</script><script>HRLComputationalHumanFieldReviewAppV1.start({rootSelector:'#app'}).catch(function(error){document.body.dataset.startupError=String(error&&error.stack||error)});</script></body></html>`;
const standalonePath=resolve(reviewDirectory,'computational-human-field-review-standalone.html');
const rootPath=resolve(root,'human-core-v5-computational-human-field-v1.html');
await Promise.all([writeFile(standalonePath,html,'utf8'),writeFile(rootPath,html,'utf8')]);
const manifest={
  schema:'humanoid_rig/task18a_computational_field_portable_review@1.0',
  standalonePath:'artifacts/review/task18a-computational-human-field-v1/computational-human-field-review-standalone.html',
  standaloneSha256:sha256(Buffer.from(html)),standaloneBytes:Buffer.byteLength(html),
  httpEntryPath:'human-core-v5-computational-human-field-v1.html',
  httpAndStandaloneByteIdentical:true,
  fileProtocolReady:true,networkRequired:false,cdnRequired:false,externalHumanGlbRequired:false,externalFetchRequired:false,
  fieldCoefficientsEmbedded:true,fieldBricksExpandedAndEmbedded:true,denseExpandedFieldBytes:denseBytes.byteLength,
  cameraSafetyController:'CameraSafetyControllerV1',
  rendererProgramHash,
  rendererPaths:{webgpu:{programDelivered:true,renderEvidencePending:true},webgl2:{programDelivered:true,renderEvidencePending:true}},
  interfaceModes:['field-surface','field-normal','field-regions','field-gradient','field-distance-slice','inverse-warp-debug','jacobian-debug','pose-corrective-debug','qa-isosurface','reference-compare'],
  poseIds:ninePose.poseIds,
  runtimeProductionPositionArray:false,runtimeProductionIndexArray:false,runtimeMeshAuthority:false,runtimeReferenceMeshLoaded:false,visibleMeshCount:0,
  conclusion:'COMPUTATIONAL_FIELD_DYNAMIC_ARCHITECTURE_FAILED',
  task18aVisualAcceptance:false,visualAcceptance:false,productionReady:false,userVisualAcceptance:'pending',
};
await Promise.all([
  writeJson(resolve(reviewDirectory,'portable-review-manifest.json'),manifest),
  writeFile(resolve(reviewDirectory,'OPEN_COMPUTATIONAL_HUMAN_FIELD_REVIEW.cmd'),'@echo off\r\nstart "" "%~dp0computational-human-field-review-standalone.html"\r\n','utf8'),
  writeFile(resolve(reviewDirectory,'README_请先打开.txt'),readme(manifest),'utf8'),
]);
process.stdout.write(`${JSON.stringify(manifest,null,2)}\n`);

function readme(manifest){return['Task 18A — Computational Human Field V1','',`双击 OPEN_COMPUTATIONAL_HUMAN_FIELD_REVIEW.cmd，或直接打开 ${manifest.standalonePath.split('/').at(-1)}。`,'页面完全内嵌最终连续场、九姿势状态、WebGL2 场 raymarch 和 WGSL 程序，不加载人体 GLB、不使用生产人体 Mesh。','qa-isosurface 模式必须理解为 QA TEMPORARY EXTRACTION / NOT RUNTIME AUTHORITY / NOT PRODUCTION SURFACE。','两轮结果为 COMPUTATIONAL_FIELD_DYNAMIC_ARCHITECTURE_FAILED；本页面用于复核失败，不代表通过。','',`Standalone SHA256: ${manifest.standaloneSha256}`,'','task18aVisualAcceptance=false','visualAcceptance=false','productionReady=false','userVisualAcceptance=pending',''].join('\r\n');}
function safeScript(source){return source.replace(/<\/script/gi,'<\\/script');}
function sha256(bytes){return createHash('sha256').update(bytes).digest('hex').toUpperCase();}
async function writeJson(path,value){await writeFile(path,`${JSON.stringify(value,null,2)}\n`,'utf8');}
