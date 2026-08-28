import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reviewDirectory = resolve(root, 'artifacts/review/task16a-r2b-production-surface-v1');
const outputPath = resolve(reviewDirectory, 'production-surface-review-standalone.html');
const rootEntryPath = resolve(root, 'human-core-v5-production-surface-v1.html');
const httpDebugPath = resolve(root, 'human-core-v5-production-surface-v1-http-debug.html');
const paths = {
  three: resolve(reviewDirectory, 'vendor/three.iife.min.js'),
  cameraSafety: resolve(root, 'apps/human-core-v5-production-surface-v1/camera-safety-controller-v1.js'),
  runtime: resolve(root, 'apps/human-core-v5-production-surface-v1/runtime.js'),
  styles: resolve(root, 'apps/human-core-v5-production-surface-v1/styles.css'),
  production: resolve(root, 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface'),
  reference: resolve(root, 'assets/human/canonical-reference-v1/makehuman-reference-neutral-static-v1.glb'),
  fullBilateralAudit: resolve(root, 'artifacts/qa/task16a-r2b-production-surface-v1/full-bilateral-audit.json'),
};
await mkdir(reviewDirectory, { recursive: true });
const [three, cameraSafety, runtime, styles, production, reference, fullBilateralAudit] = await Promise.all([
  readFile(paths.three, 'utf8'), readFile(paths.cameraSafety, 'utf8'), readFile(paths.runtime, 'utf8'), readFile(paths.styles, 'utf8'), readFile(paths.production), readFile(paths.reference), readFile(paths.fullBilateralAudit, 'utf8'),
]);
const productionSha256 = sha256(production);
const referenceSha256 = sha256(reference);
const offlineThree = three.replace(/\bfetch\s*\(/g, '__HRL_DISABLED_NETWORK_READ__(');
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'"><title>HRLFullBilateralSurfaceV1 — 完整双侧人体离线验收</title><style>${styles}</style></head>
<body><div id="app"></div><script>globalThis.__HRL_DISABLED_NETWORK_READ__=function(){return Promise.reject(new Error('Offline standalone network reads are disabled.'))};${safeScript(offlineThree)}</script><script>globalThis.__HRL_EMBEDDED_ASSETS__={production:${JSON.stringify(production.toString('base64'))},reference:${JSON.stringify(reference.toString('base64'))}};globalThis.__HRL_EMBEDDED_ASSET_META__={productionSha256:${JSON.stringify(productionSha256)},referenceSha256:${JSON.stringify(referenceSha256)}};globalThis.__HRL_FULL_BILATERAL_AUDIT__=${fullBilateralAudit.trim()};</script><script>${safeScript(cameraSafety)}</script><script>${safeScript(runtime)}</script><script>HRLProductionSurfaceApp.start({rootSelector:'#app',productionSha256:${JSON.stringify(productionSha256)}});</script></body></html>\n`;
await Promise.all([writeFile(outputPath, html, 'utf8'), writeFile(rootEntryPath, html, 'utf8')]);
await writeFile(httpDebugPath, `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HRLSurface V1 HTTP Debug</title><link rel="stylesheet" href="./apps/human-core-v5-production-surface-v1/styles.css"></head><body><div id="app"></div><script src="./artifacts/review/task16a-r2b-production-surface-v1/vendor/three.iife.min.js"></script><script>globalThis.__HRL_DEBUG_ASSET_READER__=async function(url){const response=await fetch(url);if(!response.ok)throw new Error(response.status+' '+url);return new Uint8Array(await response.arrayBuffer())};</script><script src="./apps/human-core-v5-production-surface-v1/camera-safety-controller-v1.js"></script><script src="./apps/human-core-v5-production-surface-v1/runtime.js"></script><script>HRLProductionSurfaceApp.start({rootSelector:'#app',productionUrl:'./assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface',referenceUrl:'./assets/human/canonical-reference-v1/makehuman-reference-neutral-static-v1.glb',productionSha256:${JSON.stringify(productionSha256)}});</script></body></html>\n`, 'utf8');
await writeFile(resolve(reviewDirectory, 'OPEN_REVIEW.cmd'), '@echo off\r\nstart "" "%~dp0production-surface-review-standalone.html"\r\n', 'utf8');
await writeFile(resolve(root, 'OPEN_HRLSURFACE_REVIEW.cmd'), '@echo off\r\nstart "" "%~dp0artifacts\\review\\task16a-r2b-production-surface-v1\\production-surface-review-standalone.html"\r\n', 'utf8');
const readme = [
  'HRLFullBilateralSurfaceV1 — 完整双侧人体离线验收页面',
  '',
  '1. 双击仓库根目录 OPEN_HRLSURFACE_REVIEW.cmd。',
  '2. 或双击 production-surface-review-standalone.html。',
  '3. 不需要启动服务器，不需要网络、CDN、扩展或命令行参数。',
  '4. 页面空白时查看右侧错误码。',
  '5. 将错误码和截图返回。',
  '',
  '页面已内嵌 HRLSurface、锁定 CC0 Reference、Three.js、样式和全部运行逻辑。',
  '拖动视口可旋转，滚轮可缩放；视角与表面工具用于正面、侧面、背面、四分之三和实体/线框检查。',
  'F=适应全身，H=显示或隐藏参数，R=重置到正面，Esc=退出全屏或关闭抽屉。',
  '桌面参数栏停靠；中等窗口为右侧覆盖抽屉；小窗口为底部抽屉。',
  'CameraSafetyControllerV1 限制最近/最远距离，动态更新 near/far，并提供全身与 15 个局部检查区域。',
  'Shift 或右键拖动可受限平移；相机离开合法状态时会恢复最近相机状态。',
  '验收模式包含 production-full、production-wireframe、centerline、symmetry-map、symmetric-edit-test、asymmetric-edit-test、reference-compare、failed-mirror-compare。',
  '连续形态参数、Sculpt、对称编辑、真实非对称编辑、撤销、重做和重置均在右侧面板。',
  '',
  'Approval remains pending: visualAcceptance=false, productionReady=false, userVisualAcceptance=pending.',
  '',
].join('\r\n');
await Promise.all([writeFile(resolve(reviewDirectory, 'README_请先打开.txt'), readme, 'utf8'), writeFile(resolve(reviewDirectory, 'README.txt'), readme, 'utf8')]);
const outputBytes = await readFile(outputPath);
const rootEntryBytes = await readFile(rootEntryPath);
const manifest = {
  schema: 'humanoid_rig/hrlsurface_portable_review@1.0',
  standalonePath: 'artifacts/review/task16a-r2b-production-surface-v1/production-surface-review-standalone.html',
  standaloneSha256: sha256(outputBytes),
  standaloneBytes: outputBytes.byteLength,
  rootEntryPath: 'human-core-v5-production-surface-v1.html',
  rootEntrySha256: sha256(rootEntryBytes),
  rootEntryBytes: rootEntryBytes.byteLength,
  rootAndStandaloneByteIdentical: Buffer.compare(outputBytes, rootEntryBytes) === 0,
  productionAssetSha256: productionSha256,
  authority: 'HRLFullBilateralSurfaceV1',
  fullBilateralAuditEmbedded: true,
  runtimeMirrorOperationCount: 0,
  negativeScaleNodeCount: 0,
  mirroredHalfMeshCount: 0,
  referenceAssetSha256: referenceSha256,
  threeBundleRevision: '185',
  sourceType: 'ordinary scripts; no ES module imports',
  embeddedProductionAsset: true,
  embeddedReferenceAsset: true,
  contentSecurityPolicyConnectSrc: 'none',
  externalRequestsExpected: 0,
  fileProtocolDesign: 'fully embedded; no relative resources',
  portableReviewPassed: false,
  rootFileEntryPassed: false,
  modelVisibleToUser: false,
  visualEvidenceComplete: false,
  browserEvidenceStatus: 'pending user file-protocol execution',
  responsiveLayoutAuditPath: 'artifacts/qa/task16a-r2b-production-surface-v1/responsive-layout-audit.json',
  responsivePanelModes: ['docked-right', 'overlay-right', 'drawer-bottom'],
  fitUsesVerticalAndHorizontalFov: true,
  cameraSafetyController: 'CameraSafetyControllerV1',
  cameraSafetyStaticAuditPath: 'artifacts/qa/task16a-r2b-production-surface-v1/camera-safety-static-audit.json',
  screenshotManifestPath: 'artifacts/qa/task16a-r2b-production-surface-v1/responsive-ui-screenshot-manifest.json',
  visualAcceptance: false,
  productionReady: false,
  userVisualAcceptance: 'pending',
};
await writeFile(resolve(reviewDirectory, 'portable-review-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);

function safeScript(source) { return source.replace(/<\/script/gi, '<\\/script'); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
