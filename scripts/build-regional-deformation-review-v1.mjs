import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadGeneratedV1, root } from './natural-skinning-v1-io.mjs';

const qaDirectory = resolve(root, 'artifacts/qa/task16b-regional-deformation-v1');
const screenshotDirectory = resolve(qaDirectory, 'screenshots');
const reviewDirectory = resolve(root, 'artifacts/review/task16b-regional-deformation-v1');
const standalonePath = resolve(reviewDirectory, 'regional-natural-deformation-standalone.html');
const rootEntryPath = resolve(root, 'human-core-v5-regional-natural-deformation-v1.html');
const paths = {
  three: resolve(root, 'artifacts/review/task16a-r2b-production-surface-v1/vendor/three.iife.min.js'),
  cameraSafety: resolve(root, 'apps/human-core-v5-production-surface-v1/camera-safety-controller-v1.js'),
  runtime: resolve(root, 'apps/human-core-v5-regional-deformation-v1/runtime.js'),
  styles: resolve(root, 'apps/human-core-v5-regional-deformation-v1/styles.css'),
  cache: resolve(qaDirectory, 'pose-cache-round-2.json'),
  summary: resolve(qaDirectory, 'summary-round-2.json'),
  standard: resolve(qaDirectory, 'standard-poses-round-2.json'),
  sweeps: resolve(qaDirectory, 'progressive-sweeps-round-2.json'),
  implementation: resolve(qaDirectory, 'implementation-round-2.json'),
};

await Promise.all([mkdir(reviewDirectory, { recursive: true }), mkdir(screenshotDirectory, { recursive: true })]);
const [three, cameraSafety, runtime, styles, cacheText, summaryText, standardText, sweepsText, implementationText, generated] = await Promise.all([
  readFile(paths.three, 'utf8'), readFile(paths.cameraSafety, 'utf8'), readFile(paths.runtime, 'utf8'), readFile(paths.styles, 'utf8'),
  readFile(paths.cache, 'utf8'), readFile(paths.summary, 'utf8'), readFile(paths.standard, 'utf8'), readFile(paths.sweeps, 'utf8'), readFile(paths.implementation, 'utf8'), loadGeneratedV1(),
]);
const cache = JSON.parse(cacheText); const summary = JSON.parse(summaryText); const standard = JSON.parse(standardText); const sweeps = JSON.parse(sweepsText); const implementation = JSON.parse(implementationText);
const embeddedData = {
  schema: 'humanoid_rig/task16b_r3_regional_deformation_embedded_data@1.0', cache, summary,
  standardPoseResults: compactStandard(standard), progressiveSweepResults: compactSweeps(sweeps),
  implementation: { round: implementation.round, fourRegionalSystems: implementation.fourRegionalSystems, coordinates: implementation.coordinates, profile: implementation.profile },
  bones: generated.performanceRig.joints.map((joint) => ({ id: joint.id, parentId: joint.parentId })),
  regionNames: generated.surface.header.deformationRegions.map((region) => region.id),
  primaryRegionIdsBase64: typedBase64(generated.surface.chunks.primaryRegionIds),
};
const offlineThree = three.replace(/\bfetch\s*\(/g, '__HRL_DISABLED_NETWORK_READ__(');
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'"><title>Task 16B R3 — Regional Natural Deformation Repair V1</title><style>${styles}</style></head>
<body><div id="app"></div><script>globalThis.__HRL_DISABLED_NETWORK_READ__=function(){return Promise.reject(new Error('Offline standalone network reads are disabled.'))};${safeScript(offlineThree)}</script><script>${safeScript(`globalThis.__HRL_REGIONAL_DATA__=${JSON.stringify(embeddedData)};`)}</script><script>${safeScript(cameraSafety)}</script><script>${safeScript(runtime)}</script><script>HRLRegionalDeformationReviewAppV1.start({rootSelector:'#app'});</script></body></html>
`;
await Promise.all([writeFile(standalonePath, html, 'utf8'), writeFile(rootEntryPath, html, 'utf8')]);

const screenshotNames = [
  'a-pose-front.png', 't-pose-front.png', 'shoulder-90-front.png', 'shoulder-150-front.png',
  'elbow-90-before-after.png', 'elbow-135-before-after.png', 'forearm-pronation.png', 'forearm-supination.png',
  'spine-twist-before-after.png', 'spine-twist-wireframe.png', 'spine-lattice-debug.png', 'spine-intersection-map.png',
  'hip-30-before-after.png', 'hip-90-before-after.png', 'hip-groin-wireframe.png', 'hip-lattice-debug.png', 'hip-inversion-map.png', 'hip-intersection-map.png',
  'knee-90-before-after.png', 'knee-135-before-after.png', 'shallow-squat-side.png', 'deep-squat-side.png', 'large-step-three-quarter.png', 'seated-side.png', 'kneeling-three-quarter.png',
  'finger-curl-closeup.png', 'fist-closeup.png', 'regional-deformation-contact-sheet.png', 'joint-corrective-contact-sheet.png', 'all-33-pose-contact-sheet.png',
];
const screenshots = screenshotNames.map((name) => ({ name, expectedPath: `artifacts/qa/task16b-regional-deformation-v1/screenshots/${name}`, capture: captureSettings(name), status: 'pending-user-capture', fileExists: false, generatedByAutomation: false }));
const screenshotManifest = {
  schema: 'humanoid_rig/task16b_r3_screenshot_manifest@1.0', status: 'pending-user-capture', authority: 'user file-protocol or HTTP visual review',
  standalonePath: 'artifacts/review/task16b-regional-deformation-v1/regional-natural-deformation-standalone.html', httpEntryPath: 'human-core-v5-regional-natural-deformation-v1.html',
  requiredScreenshotCount: screenshots.length, generatedScreenshotCount: 0, fabricatedPlaceholderCount: 0, browserOperatedByCodex: false, screenshots,
  contactSheets: screenshotNames.filter((name) => name.includes('contact-sheet')).map((name) => ({ name, expectedPath: `artifacts/qa/task16b-regional-deformation-v1/screenshots/${name}`, status: 'pending-user-capture-and-assembly', fileExists: false })),
  task16bVisualAcceptance: false, visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending',
};
await writeFile(resolve(screenshotDirectory, 'screenshot-manifest.json'), `${JSON.stringify(screenshotManifest, null, 2)}\n`, 'utf8');
await writeFile(resolve(screenshotDirectory, 'README_截图门.txt'), screenshotReadme(screenshotNames), 'utf8');

const standaloneBytes = await readFile(standalonePath); const rootBytes = await readFile(rootEntryPath);
const portableManifest = {
  schema: 'humanoid_rig/task16b_r3_portable_regional_deformation_review@1.0',
  standalonePath: 'artifacts/review/task16b-regional-deformation-v1/regional-natural-deformation-standalone.html', standaloneSha256: sha256(standaloneBytes), standaloneBytes: standaloneBytes.byteLength,
  httpEntryPath: 'human-core-v5-regional-natural-deformation-v1.html', httpEntrySha256: sha256(rootBytes), httpEntryBytes: rootBytes.byteLength, httpAndStandaloneByteIdentical: Buffer.compare(standaloneBytes, rootBytes) === 0,
  sourcePoseCacheSha256: sha256(Buffer.from(cacheText)), embeddedPoseCount: Object.keys(cache.poses).length, embeddedActionCount: 21, interfaceModeCount: 11,
  vertexCount: cache.vertexCount, triangleCount: cache.triangleCount, visibleSurfaceDesignCount: 1, frontSideOnly: true, cameraSafetyController: 'CameraSafetyControllerV1',
  sourceType: 'ordinary scripts; no ES module imports at runtime', externalRequestsExpected: 0, contentSecurityPolicyConnectSrc: 'none', fileProtocolDesign: 'fully embedded; no relative runtime resources',
  screenshotManifestPath: 'artifacts/qa/task16b-regional-deformation-v1/screenshots/screenshot-manifest.json', browserEvidenceStatus: 'not-run-by-codex-user-computer-operation-required',
  task16bVisualAcceptance: false, visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending',
};
await writeFile(resolve(reviewDirectory, 'portable-review-manifest.json'), `${JSON.stringify(portableManifest, null, 2)}\n`, 'utf8');
await writeFile(resolve(reviewDirectory, 'OPEN_REGIONAL_DEFORMATION_REVIEW.cmd'), '@echo off\r\nstart "" "%~dp0regional-natural-deformation-standalone.html"\r\n', 'utf8');
await writeFile(resolve(reviewDirectory, 'README_请先打开.txt'), reviewReadme(portableManifest), 'utf8');

const browserQa = {
  schema: 'humanoid_rig/task16b_r3_browser_qa@1.0', status: 'not-run-by-codex-user-computer-operation-required', browserOperatedByCodex: false,
  consoleErrors: null, pageErrors: null, startupErrors: null, failedRequests: null, externalHumanAssetRequests: null, externalRigAssetRequests: null,
  visibleMeshCount: null, humanSurfaceCount: null, firstFrameRendered: null,
  staticExpectations: { externalHumanAssetRequests: 0, externalRigAssetRequests: 0, visibleMeshCount: 1, humanSurfaceCount: 1, frontSideOnly: true },
  instruction: 'Open the HTTP entry in Chrome or Edge, inspect globalThis.__HRL_REGIONAL_DEFORMATION_V1__, and record observed counts without replacing null values by assumptions.',
  task16bVisualAcceptance: false, visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending',
};
await writeFile(resolve(qaDirectory, 'browser-qa.json'), `${JSON.stringify(browserQa, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(portableManifest, null, 2)}\n`);

function compactStandard(report) { return { round: report.round, failedPoseIds: report.failedPoseIds, poses: report.poses.map((pose) => ({ poseId: pose.poseId, passed: pose.passed, trueTriangleInversionCount: pose.trueTriangleInversionCount, criticalSelfIntersectionCount: pose.criticalSelfIntersectionCount, intentionalContactCount: pose.intentionalContactCount, elbowVolumeRatio: pose.elbowVolumeRatio, kneeVolumeRatio: pose.kneeVolumeRatio, minimumTriangleAreaRatio: pose.minimumTriangleAreaRatio, maximumSurfaceStrain: pose.maximumSurfaceStrain })) }; }
function compactSweeps(report) { return { round: report.round, failedSamples: report.failedSamples, sweeps: report.sweeps.map((sweep) => ({ sweepId: sweep.sweepId, firstTrueInversionAngle: sweep.firstTrueInversionAngle, firstCriticalIntersectionAngle: sweep.firstCriticalIntersectionAngle, elbowVolumeRange: sweep.elbowVolumeRange, kneeVolumeRange: sweep.kneeVolumeRange, passed: sweep.passed, samples: sweep.samples.map((sample) => ({ degrees: sample.degrees, passed: sample.passed, trueTriangleInversionCount: sample.trueTriangleInversionCount, criticalSelfIntersectionCount: sample.criticalSelfIntersectionCount, elbowVolumeRatio: sample.elbowVolumeRatio, kneeVolumeRatio: sample.kneeVolumeRatio })) })) }; }
function captureSettings(name) {
  const output = { poseId: 'reference_a_pose', mode: 'surface', cameraRegion: 'full-body', cameraView: 'front', timelineFrame: 60 };
  const mapping = [
    ['t-pose', 'reference_t_pose'], ['shoulder-90', 'shoulder_abduction_90'], ['shoulder-150', 'shoulder_abduction_150'], ['elbow-90', 'elbow_flex_90'], ['elbow-135', 'elbow_flex_135'],
    ['forearm-pronation', 'forearm_pronation'], ['forearm-supination', 'forearm_supination'], ['spine-twist', 'spine_twist_left'], ['hip-30', 'hip_flexion_30'], ['hip-90', 'hip_flexion_90'],
    ['hip-groin', 'hip_flexion_90'], ['hip-inversion', 'hip_flexion_90'], ['hip-intersection', 'hip_flexion_90'], ['knee-90', 'knee_flexion_90'], ['knee-135', 'knee_flex_135'],
    ['shallow-squat', 'shallow_squat'], ['deep-squat', 'deep_squat'], ['large-step', 'large_step'], ['seated', 'seated_pose'], ['kneeling', 'kneeling_pose'], ['finger-curl', 'finger_curl'], ['fist', 'fist'],
  ];
  for (const [stem, poseId] of mapping) if (name.includes(stem)) output.poseId = poseId;
  if (name.includes('before-after')) output.mode = 'before-after'; else if (name.includes('wireframe')) output.mode = 'surface-wireframe'; else if (name.includes('lattice-debug')) output.mode = 'lattice-debug'; else if (name.includes('inversion-map')) output.mode = 'true-inversion-map'; else if (name.includes('intersection-map')) output.mode = 'intersection-map';
  if (name.includes('spine')) output.cameraRegion = 'back-centerline'; else if (name.includes('hip') || name.includes('squat') || name.includes('seated') || name.includes('large-step')) output.cameraRegion = 'pelvis-groin'; else if (name.includes('elbow') || name.includes('forearm')) output.cameraRegion = 'left-elbow'; else if (name.includes('knee') || name.includes('kneeling')) output.cameraRegion = 'left-knee';
  if (name.includes('side')) output.cameraView = 'side'; if (name.includes('three-quarter')) output.cameraView = 'three-quarter'; if (name.includes('closeup')) output.cameraRegion = name.includes('finger') || name.includes('fist') ? 'full-body-manual-hand-closeup' : output.cameraRegion;
  if (name.includes('contact-sheet')) return { action: 'assemble from completed real screenshots only', sourceScreenshotsRequired: true };
  return output;
}
function screenshotReadme(names) { return ['Task 16B R3 用户截图门', '', 'Codex 遵守当前 AGENTS 指令：未操作浏览器、未生成 PNG、未创建占位图。请打开 standalone 或 HTTP 入口，按 screenshot-manifest.json 的 pose/mode/camera 设置采集。', '', '必须使用以下精确文件名：', ...names.map((name) => `- ${name}`), '', '三张 Contact Sheet 只能由真实截图拼接。当前：task16bVisualAcceptance=false, visualAcceptance=false, productionReady=false, userVisualAcceptance=pending。', ''].join('\r\n'); }
function reviewReadme(manifest) { return ['Task 16B R3 — Regional Natural Deformation Repair V1', '', '1. 双击 OPEN_REGIONAL_DEFORMATION_REVIEW.cmd，或直接打开 regional-natural-deformation-standalone.html。', '2. 页面完全内嵌 Three.js、21 个动作入口、一个 HRLSurface、骨架、姿态、区域格与第二轮 QA，不需要网络或服务器。', '3. 拖动旋转；滚轮缩放；F 适应当前区域；R 重置全身；H 隐藏或显示控制栏。', '4. Play/Pause、Slow 与逐帧按钮控制 0-60 的动作时间轴；Before/After 使用左半基础蒙皮、右半区域结果，并保持单一表面。', '5. 该实现两轮数值门失败；页面用于检查证据，不代表通过。', '', `Standalone SHA256: ${manifest.standaloneSha256}`, '', '视觉证据尚未执行：task16bVisualAcceptance=false, visualAcceptance=false, productionReady=false, userVisualAcceptance=pending。', ''].join('\r\n'); }
function typedBase64(array) { return Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('base64'); }
function safeScript(source) { return source.replace(/<\/script/gi, '<\\/script'); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
