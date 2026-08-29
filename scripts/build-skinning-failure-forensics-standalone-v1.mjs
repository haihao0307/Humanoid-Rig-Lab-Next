import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSkinWeightsV1 } from '../src/modules/human-core-v5/natural-skinning-v1/skin-weight-generator-v1.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const qaDirectory = resolve(root, 'artifacts/qa/task16b-skinning-forensics-v1');
const screenshotDirectory = resolve(qaDirectory, 'screenshots');
const reviewDirectory = resolve(root, 'artifacts/review/task16b-skinning-forensics-v1');
const standalonePath = resolve(reviewDirectory, 'skinning-failure-forensics-standalone.html');
const rootEntryPath = resolve(root, 'human-core-v5-skinning-failure-forensics-v1.html');
const paths = {
  three: resolve(root, 'artifacts/review/task16a-r2b-production-surface-v1/vendor/three.iife.min.js'),
  cameraSafety: resolve(root, 'apps/human-core-v5-production-surface-v1/camera-safety-controller-v1.js'),
  runtime: resolve(root, 'apps/human-core-v5-skinning-failure-forensics-v1/runtime.js'),
  styles: resolve(root, 'apps/human-core-v5-skinning-failure-forensics-v1/styles.css'),
  cache: resolve(qaDirectory, 'representative-pose-cache.json'),
  summary: resolve(qaDirectory, 'forensics-summary.json'),
  modes: resolve(qaDirectory, 'six-mode-comparison.json'),
  rig: resolve(qaDirectory, 'rig-pose-basis-audit.json'),
  topology: resolve(qaDirectory, 'joint-topology-forensics.json'),
  intersections: resolve(qaDirectory, 'representative-pose-intersections.json'),
  localization: resolve(qaDirectory, 'failure-localization.json'),
  frozen: resolve(qaDirectory, 'FROZEN_INPUTS.json'),
  weights: resolve(root, 'assets/human/natural-skinning-v1/skin-weights-v1.bin'),
};

await Promise.all([mkdir(reviewDirectory, { recursive: true }), mkdir(screenshotDirectory, { recursive: true })]);
const [three, cameraSafety, runtime, styles, cacheText, summaryText, modesText, rigText, topologyText, intersectionsText, localizationText, frozenText, weightBytes] = await Promise.all([
  readFile(paths.three, 'utf8'), readFile(paths.cameraSafety, 'utf8'), readFile(paths.runtime, 'utf8'), readFile(paths.styles, 'utf8'),
  readFile(paths.cache, 'utf8'), readFile(paths.summary, 'utf8'), readFile(paths.modes, 'utf8'), readFile(paths.rig, 'utf8'), readFile(paths.topology, 'utf8'),
  readFile(paths.intersections, 'utf8'), readFile(paths.localization, 'utf8'), readFile(paths.frozen, 'utf8'), readFile(paths.weights),
]);
const cache = JSON.parse(cacheText); const summary = JSON.parse(summaryText); const modes = JSON.parse(modesText); const rig = JSON.parse(rigText);
const topology = JSON.parse(topologyText); const intersections = JSON.parse(intersectionsText); const localization = JSON.parse(localizationText); const frozen = JSON.parse(frozenText);
const parsedWeights = parseSkinWeightsV1(weightBytes);
const dominantBone = new Uint8Array(cache.vertexCount);
for (let vertex = 0; vertex < cache.vertexCount; vertex += 1) {
  let bestWeight = -1; let bestBone = 0;
  for (let slot = 0; slot < 8; slot += 1) {
    const joints = slot < 4 ? parsedWeights.data.joints0 : parsedWeights.data.joints1;
    const weights = slot < 4 ? parsedWeights.data.weights0 : parsedWeights.data.weights1;
    const offset = vertex * 4 + (slot % 4);
    if (weights[offset] > bestWeight) { bestWeight = weights[offset]; bestBone = joints[offset]; }
  }
  dominantBone[vertex] = bestBone;
}
const embeddedData = {
  schema: 'humanoid_rig/task16b_skinning_failure_forensics_embedded_data@1.0',
  cache,
  summary,
  modeMetrics: compactModeMetrics(modes),
  rig: compactRigAudit(rig),
  topology: compactTopology(topology),
  intersections,
  localization,
  frozenInputs: { schema: frozen.schema, surface: frozen.surface, bindPoseHash: frozen.bindPoseHash, inverseBindMatrixHash: frozen.inverseBindMatrixHash, inputsModified: frozen.inputsModified },
  dominantBoneBase64: Buffer.from(dominantBone).toString('base64'),
  bonePaletteOrder: parsedWeights.header.bonePaletteOrder,
};
const offlineThree = three.replace(/\bfetch\s*\(/g, '__HRL_DISABLED_NETWORK_READ__(');
const dataScript = safeScript(`globalThis.__HRL_FORENSICS_DATA__=${JSON.stringify(embeddedData)};`);
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'"><title>Task 16B R2A — Natural Skinning Failure Forensics V1</title><style>${styles}</style></head>
<body><div id="app"></div><script>globalThis.__HRL_DISABLED_NETWORK_READ__=function(){return Promise.reject(new Error('Offline standalone network reads are disabled.'))};${safeScript(offlineThree)}</script><script>${dataScript}</script><script>${safeScript(cameraSafety)}</script><script>${safeScript(runtime)}</script><script>HRLSkinningFailureForensicsAppV1.start({rootSelector:'#app'});</script></body></html>
`;
await Promise.all([writeFile(standalonePath, html, 'utf8'), writeFile(rootEntryPath, html, 'utf8')]);

const screenshotGroups = {
  skeleton: ['skeleton-a-pose.png', 'skeleton-t-pose.png', 'skeleton-shoulder-30.png', 'skeleton-elbow-90.png', 'skeleton-hip-30.png', 'skeleton-knee-90.png', 'skeleton-spine-twist-30.png'],
  topology: ['shoulder-topology-forensics.png', 'axilla-topology-forensics.png', 'elbow-topology-forensics.png', 'hip-groin-topology-forensics.png', 'knee-topology-forensics.png', 'spine-topology-forensics.png'],
  fullBody: ['a-pose-hybrid.png', 't-pose-hybrid.png', 'shoulder-30-hybrid.png', 'elbow-90-hybrid.png', 'hip-30-hybrid.png', 'knee-90-hybrid.png', 'spine-twist-30-hybrid.png'],
  algorithmComparison: ['shoulder-30-six-mode-comparison.png', 'elbow-90-six-mode-comparison.png', 'hip-30-six-mode-comparison.png', 'knee-90-six-mode-comparison.png'],
  failureMaps: ['true-flip-map.png', 'legacy-flip-map.png', 'intersection-map.png', 'strain-map.png'],
  localFailure: ['shoulder-failure-closeup.png', 'axilla-failure-closeup.png', 'elbow-failure-closeup.png', 'hip-groin-failure-closeup.png', 'knee-failure-closeup.png', 'spine-failure-closeup.png'],
  contactSheet: ['skinning-failure-forensics-contact-sheet.png'],
};
const screenshots = Object.entries(screenshotGroups).flatMap(([category, names]) => names.map((name) => ({ category, name, expectedPath: `artifacts/qa/task16b-skinning-forensics-v1/screenshots/${name}`, capture: captureSettings(category, name), status: 'pending-user-capture', fileExists: false, generatedByAutomation: false })));
const screenshotManifest = {
  schema: 'humanoid_rig/task16b_r2a_screenshot_manifest@1.0',
  status: 'pending-user-capture',
  authority: 'user file-protocol visual review',
  standalonePath: 'artifacts/review/task16b-skinning-forensics-v1/skinning-failure-forensics-standalone.html',
  requiredScreenshotCount: screenshots.length,
  generatedScreenshotCount: 0,
  fabricatedPlaceholderCount: 0,
  browserOperatedByCodex: false,
  screenshots,
  contactSheetPath: 'artifacts/qa/task16b-skinning-forensics-v1/screenshots/skinning-failure-forensics-contact-sheet.png',
  contactSheetStatus: 'pending-user-capture-and-assembly',
  visualAcceptance: false,
  productionReady: false,
  userVisualAcceptance: 'pending',
};
await writeFile(resolve(screenshotDirectory, 'screenshot-manifest.json'), `${JSON.stringify(screenshotManifest, null, 2)}\n`, 'utf8');
await writeFile(resolve(screenshotDirectory, 'README_截图门.txt'), screenshotReadme(screenshotGroups), 'utf8');

const standaloneBytes = await readFile(standalonePath); const rootBytes = await readFile(rootEntryPath);
const portableManifest = {
  schema: 'humanoid_rig/task16b_r2a_portable_forensics_review@1.0',
  standalonePath: 'artifacts/review/task16b-skinning-forensics-v1/skinning-failure-forensics-standalone.html',
  standaloneSha256: sha256(standaloneBytes), standaloneBytes: standaloneBytes.byteLength,
  rootEntryPath: 'human-core-v5-skinning-failure-forensics-v1.html', rootEntrySha256: sha256(rootBytes), rootEntryBytes: rootBytes.byteLength,
  rootAndStandaloneByteIdentical: Buffer.compare(standaloneBytes, rootBytes) === 0,
  sourcePoseCacheSha256: sha256(Buffer.from(cacheText)), sourceWeightBinarySha256: sha256(weightBytes),
  frozenSurfacePositionSha256: frozen.surface.positionSha256, frozenSurfaceIndexSha256: frozen.surface.indexSha256,
  embeddedPoseCount: Object.keys(cache.poses).length, embeddedMeshModeCount: Object.keys(cache.poses.reference_a_pose.modes).length,
  interfaceModeCount: 13, frontSideOnly: true, cameraSafetyController: 'CameraSafetyControllerV1',
  sourceType: 'ordinary scripts; no ES module imports at runtime', externalRequestsExpected: 0,
  contentSecurityPolicyConnectSrc: 'none', fileProtocolDesign: 'fully embedded; no relative runtime resources',
  screenshotManifestPath: 'artifacts/qa/task16b-skinning-forensics-v1/screenshots/screenshot-manifest.json',
  visualEvidenceComplete: false, browserEvidenceStatus: 'pending-user-file-protocol-review',
  visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending',
};
await writeFile(resolve(reviewDirectory, 'portable-review-manifest.json'), `${JSON.stringify(portableManifest, null, 2)}\n`, 'utf8');
await writeFile(resolve(reviewDirectory, 'OPEN_SKINNING_FORENSICS_REVIEW.cmd'), '@echo off\r\nstart "" "%~dp0skinning-failure-forensics-standalone.html"\r\n', 'utf8');
await writeFile(resolve(reviewDirectory, 'README_请先打开.txt'), reviewReadme(portableManifest), 'utf8');
process.stdout.write(`${JSON.stringify(portableManifest, null, 2)}\n`);

function compactModeMetrics(report) {
  const keep = ['legacyTriangleFlipCount', 'trueTriangleInversionCount', 'criticalSelfIntersectionCount', 'contactCount', 'maximumSurfaceStrain', 'minimumTriangleAreaRatio', 'maximumTriangleAreaRatio', 'jointVolumeRatio', 'boneSurfaceClearance'];
  return Object.fromEntries(report.poses.map((pose) => [pose.poseId, Object.fromEntries(pose.modes.filter((mode) => mode.mode !== 'skeleton-only').map((mode) => [mode.mode, Object.fromEntries(keep.map((key) => [key, mode[key]]))]))]));
}
function compactRigAudit(report) {
  return { passed: report.passed, conclusion: report.conclusion, maximumBoneLengthError: report.maximumBoneLengthError, nonFiniteMatrixCount: report.nonFiniteMatrixCount, negativeDeterminantCount: report.negativeDeterminantCount, unknownAxisCount: report.unknownAxisCount, leftRightBasisMismatchCount: report.leftRightBasisMismatchCount,
    poses: Object.fromEntries(report.poses.map((pose) => { const joints = pose.joints.map((joint) => ({ jointId: joint.jointId, parentId: joint.parentId, worldMatrix: joint.worldMatrix, worldJointPosition: joint.worldJointPosition, declaredTwistAxis: joint.declaredTwistAxis, declaredBendAxis: joint.declaredBendAxis, declaredSideAxis: joint.declaredSideAxis, appliedRotationAxis: joint.appliedRotationAxis, boneLength: joint.boneLength, determinant: joint.determinant, jointLimitStatus: joint.jointLimitStatus })); return [pose.poseId, { passed: pose.passed, conclusion: pose.conclusion, joints, byId: Object.fromEntries(joints.map((joint) => [joint.jointId, joint])) }]; })) };
}
function compactTopology(report) {
  const summaryKeys = ['regionId', 'ringCount', 'ringVertexCount', 'crossSectionArea', 'edgeFlowDirection', 'jointCenterOffset', 'minimumGeodesicClearance', 'compressionSideVertexDensity', 'extensionSideVertexDensity', 'maximumValence', 'poleCount', 'longEdgeCount', 'needleTriangleCount', 'passed'];
  return { method: report.method, sourceTopologyModified: report.sourceTopologyModified, allRegionsHaveMeasuredVertices: report.allRegionsHaveMeasuredVertices,
    regions: report.regions.map((region) => ({ ...Object.fromEntries(summaryKeys.map((key) => [key, region[key]])), sections: region.sideAudits.flatMap((side) => (side.crossSections || []).map((section) => ({ jointId: side.jointId, offset: section.offset, closed: section.closed, area: section.area, maximumAngularGap: section.maximumAngularGap, points3d: section.points3d }))) })) };
}
function captureSettings(category, name) {
  const poseByStem = {
    'a-pose': 'reference_a_pose', 't-pose': 'reference_t_pose', 'shoulder-30': 'shoulder_abduction_30', 'elbow-90': 'elbow_flexion_90',
    'hip-30': 'hip_flexion_30', 'knee-90': 'knee_flexion_90', 'spine-twist-30': 'spine_twist_30',
  };
  const matchingStem = Object.keys(poseByStem).find((stem) => name.includes(stem));
  if (category === 'skeleton') return { poseId: poseByStem[matchingStem] || 'reference_a_pose', mode: 'skeleton-only', cameraRegion: 'full-body', comparisonBoard: false };
  if (category === 'fullBody') return { poseId: poseByStem[matchingStem] || 'reference_a_pose', mode: 'hybrid', cameraRegion: 'full-body', comparisonBoard: false };
  if (category === 'algorithmComparison') return { poseId: poseByStem[matchingStem], mode: 'hybrid', cameraRegion: 'full-body', comparisonBoard: true, note: 'Use Six-mode board; it shows skeleton-only plus the five surface algorithms and the numeric comparison table.' };
  if (category === 'topology') {
    const mapping = name.startsWith('shoulder') ? ['shoulder', 'neck-shoulder'] : name.startsWith('axilla') ? ['axilla', 'left-axilla'] : name.startsWith('elbow') ? ['elbow', 'left-elbow'] : name.startsWith('hip') ? ['hip', 'pelvis-groin'] : name.startsWith('knee') ? ['knee', 'left-knee'] : ['spine', 'back-centerline'];
    return { poseId: 'reference_a_pose', mode: 'topology-wireframe', topologyRegion: mapping[0], cameraRegion: mapping[1], comparisonBoard: false, note: name.startsWith('hip') ? 'Capture hip, then switch Topology region to groin and include both real views in the same evidence image.' : undefined };
  }
  if (category === 'failureMaps') return { poseId: 'hip_flexion_30', mode: name.replace('.png', ''), cameraRegion: name.startsWith('intersection') ? 'pelvis-groin' : 'full-body', comparisonBoard: false };
  if (category === 'localFailure') {
    const mapping = name.startsWith('shoulder') ? ['shoulder_abduction_30', 'neck-shoulder'] : name.startsWith('axilla') ? ['shoulder_abduction_30', 'left-axilla'] : name.startsWith('elbow') ? ['elbow_flexion_90', 'left-elbow'] : name.startsWith('hip') ? ['hip_flexion_30', 'pelvis-groin'] : name.startsWith('knee') ? ['knee_flexion_90', 'left-knee'] : ['spine_twist_30', 'back-centerline'];
    return { poseId: mapping[0], mode: name.startsWith('spine') || name.startsWith('hip') ? 'intersection-map' : 'strain-map', cameraRegion: mapping[1], comparisonBoard: false, selectFirstFailureIfAvailable: true };
  }
  return { action: 'assemble contact sheet from the completed, real screenshots only', comparisonBoard: false };
}
function screenshotReadme(groups) {
  const lines = ['Task 16B R2A 用户截图门', '', 'Codex 未操作浏览器，未生成 PNG，也未创建占位图。请双击 review 目录中的 OPEN_SKINNING_FORENSICS_REVIEW.cmd，在真实 file:// 页面中逐项切换并截图。', '', '所有截图保存到本目录，文件名必须完全一致：', ''];
  for (const [category, names] of Object.entries(groups)) { lines.push(`[${category}]`, ...names.map((name) => `- ${name}`), ''); }
  lines.push('完成截图并制作 contact sheet 后，请返回视觉决定。当前门状态：visualAcceptance=false, productionReady=false, userVisualAcceptance=pending。', '');
  return lines.join('\r\n');
}
function reviewReadme(manifest) { return [
  'Task 16B R2A — Natural Skinning Catastrophic Failure Forensics V1', '',
  '1. 双击 OPEN_SKINNING_FORENSICS_REVIEW.cmd。',
  '2. 或直接双击 skinning-failure-forensics-standalone.html。',
  '3. 页面完全内嵌 Three.js、七姿势、五种表面算法结果、骨架审计、拓扑环线和交叉对，不需要网络或服务器。',
  '4. 拖动旋转；滚轮缩放；F 适应当前区域；R 重置全身；H 隐藏或显示控制栏。',
  '5. 依次选择 Pose、Mode、Failure triangle、Intersection pair 与局部 Camera region，按截图 manifest 保存真实 PNG。',
  '6. 若页面错误，请返回 Public review state 和 Camera safety 文本。', '',
  `Standalone SHA256: ${manifest.standaloneSha256}`, '',
  '视觉证据尚未完成：visualAcceptance=false, productionReady=false, userVisualAcceptance=pending。', '',
].join('\r\n'); }
function safeScript(source) { return source.replace(/<\/script/gi, '<\\/script'); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
