import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const controllerPath = resolve(root, 'apps/human-core-v5-production-surface-v1/camera-safety-controller-v1.js');
const runtimePath = resolve(root, 'apps/human-core-v5-production-surface-v1/runtime.js');
const assetPath = resolve(root, 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface');
const outputPath = resolve(root, 'artifacts/qa/task16a-r2b-production-surface-v1/camera-safety-static-audit.json');
const [controllerSource, runtimeSource, asset] = await Promise.all([readFile(controllerPath, 'utf8'), readFile(runtimePath, 'utf8'), readFile(assetPath)]);
const context = {};
vm.runInNewContext(controllerSource, context, { filename: controllerPath });
const api = context.HRLCameraSafetyControllerV1; const positions = parsePositions(asset); const full = api.computeRegionBoundsFromPositions(positions, 'full-body');
const views = { Front: [0, 0.02], Side: [Math.PI / 2, 0.02], Back: [Math.PI, 0.02], 'Three Quarter': [Math.PI / 4, 0.02] };
const scenarios = [];
for (const [view, [yaw, pitch]] of Object.entries(views)) {
  scenarios.push(simulate(`${view} full-body minimum distance`, 'full-body', 1600 / 900, yaw, pitch, 'minimum'));
  scenarios.push(simulate(`${view} full-body maximum distance`, 'full-body', 1600 / 900, yaw, pitch, 'maximum'));
}
scenarios.push(simulate('Front head-face minimum distance', 'head-face', 1000 / 800, 0, 0.02, 'minimum'));
scenarios.push(simulate('Front shoulder-axilla minimum distance', 'left-axilla', 1000 / 800, 0, 0.02, 'minimum'));
scenarios.push(simulate('Front pelvis-groin minimum distance', 'pelvis-groin', 1000 / 800, 0, 0.02, 'minimum'));
scenarios.push(simulate('Small viewport current-region fit', 'full-body', 600 / 856, Math.PI / 4, 0.02, 'fit'));
scenarios.push(simulate('Large viewport current-region fit', 'full-body', 2220 / 1400, 0, 0.02, 'fit'));

const regionCatalog = Object.fromEntries(api.REGION_IDS.map((region) => {
  const computed = api.computeRegionBoundsFromPositions(positions, region); const limits = api.computeDistanceLimits(computed.bounds); const clipAtMinimum = api.computeClipPlanes(limits.minimumDistance, limits.bodyRadius);
  return [region, { pointCount: computed.pointIndices.length, localTarget: center(computed.bounds), localBoundingBox: computed.bounds, localBoundingSphere: { center: center(computed.bounds), radius: limits.bodyRadius }, localMinimumDistance: limits.minimumDistance, localMaximumDistance: limits.maximumDistance, localNear: clipAtMinimum.near, localFar: clipAtMinimum.far }];
}));
const checks = {
  independentControllerModuleExists: /class CameraSafetyControllerV1/.test(controllerSource),
  allRequiredRegionsImplemented: ['full-body','head-face','neck-shoulder','left-axilla','right-axilla','left-elbow','right-elbow','left-hand','right-hand','pelvis-groin','left-knee','right-knee','left-ankle-foot','right-ankle-foot','back-centerline','front-centerline'].every((region) => api.REGION_IDS.includes(region)),
  minimumDistanceFormulaExact: /Math\.max\(metrics\.radius \* 1\.08, metrics\.height \* 0\.48\)/.test(controllerSource),
  maximumDistanceFormulaExact: /metrics\.radius \* 8/.test(controllerSource),
  nearFormulaExact: /Math\.max\(0\.005, cameraDistanceToTarget - bodyRadius \* 1\.3\)/.test(controllerSource),
  farFormulaExact: /Math\.max\(cameraDistanceToTarget \+ bodyRadius \* 4, bodyRadius \* 12\)/.test(controllerSource),
  frontSidePreserved: !/DoubleSide/.test(controllerSource) && !/DoubleSide/.test(runtimeSource),
  cameraInsideBodyFalseForAllScenarios: scenarios.every((scenario) => !scenario.cameraInsideBody),
  nearPlaneSafeForAllScenarios: scenarios.every((scenario) => !scenario.nearPlaneIntersectsBody && scenario.modelBehindNearPlaneVertexCount === 0),
  farPlaneSafeForAllScenarios: scenarios.every((scenario) => !scenario.farPlaneExcludesBody && scenario.modelBeyondFarPlaneVertexCount === 0),
  modelVisibleForAllScenarios: scenarios.every((scenario) => scenario.modelVisible),
  maximumDistanceKeepsTwelvePercentHeight: scenarios.filter((scenario) => /full-body maximum/.test(scenario.name)).every((scenario) => scenario.projectedModelHeight >= 0.12),
  lockedFullBodyUsesFramingMinimum: /this\.effectiveMinimumDistance = this\.lockVisible && this\.region === 'full-body'/.test(controllerSource) && /Math\.max\(this\.minimumDistance, this\.framingMinimumDistance\)/.test(controllerSource),
  targetClampImplemented: /allowedTargetBounds\.containsPoint/.test(controllerSource) && /平移目标已限制在人体附近/.test(controllerSource),
  lastValidCameraRecoveryImplemented: /saveLastValidCameraState/.test(controllerSource) && /restoreLastValidCameraState/.test(controllerSource) && /相机状态已恢复/.test(controllerSource),
  realResizeSequenceImplemented: /getBoundingClientRect/.test(controllerSource) && /renderer\.setSize\(width, height, false\)/.test(controllerSource) && /camera\.aspect = width \/ height/.test(controllerSource) && /projected-next-frame/.test(controllerSource) && /backing-next-frame/.test(controllerSource),
  visibilityGuardMetricsImplemented: ['projectedBoundingBox','visibleProjectedCornerCount','modelBehindNearPlaneVertexCount','modelBeyondFarPlaneVertexCount','modelScreenBounds','nonBackgroundPixelCount'].every((token) => controllerSource.includes(token)),
  publicCameraSafetyMetricsImplemented: ['region','cameraDistance','minimumDistance','maximumDistance','cameraNear','cameraFar','cameraInsideBody','nearPlaneIntersectsBody','farPlaneExcludesBody','targetInsideAllowedBounds','visibleProjectedCornerCount','modelScreenBounds','modelVisible','lastValidCameraStateAvailable','cameraRecoveryCount'].every((token) => runtimeSource.includes(token) || controllerSource.includes(token)),
};
const report = {
  schema: 'humanoid_rig/task16a_r2b_camera_safety_static_audit@1.0',
  method: 'file-only projection and clipping simulation against the unchanged HRLFullBilateralSurfaceV1 POSITION data; no browser visual claim',
  controllerPath: 'apps/human-core-v5-production-surface-v1/camera-safety-controller-v1.js',
  assetSha256: sha256(asset), sourceVertexCount: positions.length / 3, fullBodyBounds: full.bounds,
  formulas: { minimumDistance: 'max(bodyRadius * 1.08, bodyHeight * 0.48)', maximumDistance: 'bodyRadius * 8', near: 'max(0.005, cameraDistanceToTarget - bodyRadius * 1.3)', far: 'max(cameraDistanceToTarget + bodyRadius * 4, bodyRadius * 12)' },
  regionCatalog, scenarios, checks, passed: Object.values(checks).every(Boolean),
  cameraNavigationVisualGate: 'failed', fullBodyReviewReliable: false,
  cameraNavigationVisualGateNote: 'awaiting user real-browser file-protocol retest',
  visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending',
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (!report.passed) throw new Error(`Camera safety static audit failed: ${JSON.stringify(checks)}`);
process.stdout.write(`${JSON.stringify({ passed: report.passed, scenarioCount: scenarios.length, checks, scenarios }, null, 2)}\n`);

function simulate(name, region, aspect, yaw, pitch, distanceMode) {
  const computed = api.computeRegionBoundsFromPositions(positions, region); const limits = api.computeDistanceLimits(computed.bounds);
  const fit = api.computeFitDistanceForBounds(computed.bounds, { aspect, yaw, pitch, verticalFovDegrees: 32, sideMargin: region === 'full-body' ? 0.05 : 0.08, verticalMargin: region === 'full-body' ? 0.07 : 0.1 });
  const distance = distanceMode === 'minimum' ? limits.minimumDistance : distanceMode === 'maximum' ? limits.maximumDistance : Math.max(limits.minimumDistance, Math.min(limits.maximumDistance, fit.distance));
  const clip = api.computeClipPlanes(distance, limits.bodyRadius); const projection = api.projectBoundsForLayout(computed.bounds, { aspect, yaw, pitch, verticalFovDegrees: 32, distance });
  const basis = projection.fit.basis; const target = projection.fit.center; let behind = 0; let beyond = 0;
  for (const vertex of computed.pointIndices) { const offset = vertex * 3; const relative = [positions[offset] - target[0], positions[offset + 1] - target[1], positions[offset + 2] - target[2]]; const depth = distance - dot(relative, basis.backward); if (depth < clip.near) behind += 1; if (depth > clip.far) beyond += 1; }
  return {
    name, viewRegion: region, distanceMode, aspect, cameraDistance: distance, minimumDistance: limits.minimumDistance, maximumDistance: limits.maximumDistance,
    cameraNear: clip.near, cameraFar: clip.far, cameraInsideBody: distance <= limits.bodyRadius,
    nearPlaneIntersectsBody: clip.nearPlaneIntersectsBody || behind > 0, farPlaneExcludesBody: clip.farPlaneExcludesBody || beyond > 0,
    modelBehindNearPlaneVertexCount: behind, modelBeyondFarPlaneVertexCount: beyond,
    modelScreenBounds: roundObject(projection.modelScreenBounds), visibleProjectedCornerCount: projection.visibleProjectedCornerCount,
    projectedModelHeight: projection.modelScreenBounds.maxY - projection.modelScreenBounds.minY, modelVisible: projection.modelVisible,
  };
}

function parsePositions(bytes) { if (bytes.subarray(0, 8).toString('utf8') !== 'HRLSURF1') throw new Error('Unexpected HRLSurface magic.'); const jsonLength = bytes.readUInt32LE(8); const dataOffset = bytes.readUInt32LE(12); const header = JSON.parse(bytes.subarray(16, 16 + jsonLength).toString('utf8')); const descriptor = header.chunks.basePositions; const data = bytes.subarray(dataOffset + descriptor.byteOffset, dataOffset + descriptor.byteOffset + descriptor.byteLength); return new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)); }
function center(bounds) { return bounds.min.map((value, axis) => (value + bounds.max[axis]) * 0.5); }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function roundObject(object) { return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, Number(value.toFixed(6))])); }
function sha256(value) { return createHash('sha256').update(value).digest('hex').toUpperCase(); }
