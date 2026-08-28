import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimePath = resolve(root, 'apps/human-core-v5-production-surface-v1/runtime.js');
const cameraSafetyPath = resolve(root, 'apps/human-core-v5-production-surface-v1/camera-safety-controller-v1.js');
const stylesPath = resolve(root, 'apps/human-core-v5-production-surface-v1/styles.css');
const assetPath = resolve(root, 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface');
const outputPath = resolve(root, 'artifacts/qa/task16a-r2b-production-surface-v1/responsive-layout-audit.json');
const [cameraSafety, runtime, styles, asset] = await Promise.all([readFile(cameraSafetyPath, 'utf8'), readFile(runtimePath, 'utf8'), readFile(stylesPath, 'utf8'), readFile(assetPath)]);
const implementation = `${cameraSafety}\n${runtime}`;
const context = {};
vm.runInNewContext(cameraSafety, context, { filename: cameraSafetyPath });
vm.runInNewContext(runtime, context, { filename: runtimePath });
const app = context.HRLProductionSurfaceApp;
const parsed = parseSurface(asset); const positions = parsed.basePositions; const bounds = positionBounds(positions); const landmarks = findLandmarks(positions);
const requestedWindowSizes = [[2560, 1440], [1920, 1080], [1600, 900], [1366, 768], [1000, 800], [800, 900], [600, 900]];
const views = { front: [0, 0.02], side: [Math.PI / 2, 0.02], back: [Math.PI, 0.02], 'three-quarter': [Math.PI / 4, 0.02] };
const layouts = requestedWindowSizes.map(([windowWidth, windowHeight]) => {
  const panelOpen = windowWidth >= 1280; const viewport = app.computeResponsiveViewport(windowWidth, windowHeight, panelOpen);
  const viewMetrics = Object.fromEntries(Object.entries(views).map(([view, [yaw, pitch]]) => {
    const options = { yaw, pitch, aspect: viewport.viewportWidth / viewport.viewportHeight, verticalFovDegrees: 32, sideMargin: 0.05, verticalMargin: 0.07 };
    const projected = app.projectBoundsForLayout(bounds, options); const landmarkVisibility = projectLandmarks(landmarks, projected.fit);
    const fullBodyFramed = projected.safeMarginPassed && Object.values(landmarkVisibility).every(Boolean);
    return [view, {
      cameraAspect: options.aspect,
      cameraDistance: projected.fit.distance,
      cameraNear: Math.max(0.001, projected.fit.distance - projected.fit.radius * 2.25),
      cameraFar: Math.max(Math.max(0.001, projected.fit.distance - projected.fit.radius * 2.25) + 1, projected.fit.distance + projected.fit.radius * 3.5),
      horizontalFovDegrees: projected.fit.horizontalFov * 180 / Math.PI,
      modelScreenBounds: roundBounds(projected.modelScreenBounds),
      ...landmarkVisibility,
      handsVisible: landmarkVisibility.leftHandVisible && landmarkVisibility.rightHandVisible,
      feetVisible: landmarkVisibility.leftFootVisible && landmarkVisibility.rightFootVisible,
      fullBodyFramed,
      safeMarginPassed: projected.safeMarginPassed,
    }];
  }));
  const front = viewMetrics.front; const allViewsPassed = Object.values(viewMetrics).every((entry) => entry.fullBodyFramed && entry.safeMarginPassed);
  return {
    requestedWindowWidth: windowWidth, requestedWindowHeight: windowHeight,
    viewportWidth: viewport.viewportWidth, viewportHeight: viewport.viewportHeight, devicePixelRatio: 1,
    panelMode: viewport.panelMode, panelOpen: viewport.panelOpen,
    modelScreenBounds: front.modelScreenBounds,
    headVisible: front.headVisible, leftHandVisible: front.leftHandVisible, rightHandVisible: front.rightHandVisible,
    handsVisible: front.handsVisible, leftFootVisible: front.leftFootVisible, rightFootVisible: front.rightFootVisible, feetVisible: front.feetVisible,
    fullBodyFramed: front.fullBodyFramed, safeMarginPassed: front.safeMarginPassed, allFourViewsPassed: allViewsPassed,
    views: viewMetrics,
  };
});

const checks = {
  allSevenWindowSizesCovered: layouts.length === requestedWindowSizes.length,
  allLayoutsPassFrontFraming: layouts.every((entry) => entry.fullBodyFramed && entry.safeMarginPassed),
  allLayoutsPassAllFourViews: layouts.every((entry) => entry.allFourViewsPassed),
  allLandmarksVisible: layouts.every((entry) => entry.headVisible && entry.handsVisible && entry.feetVisible),
  desktopPanelDockedAndOpen: layouts.filter((entry) => entry.requestedWindowWidth >= 1280).every((entry) => entry.panelMode === 'docked-right' && entry.panelOpen),
  mediumPanelOverlayAndClosed: layouts.filter((entry) => entry.requestedWindowWidth >= 800 && entry.requestedWindowWidth < 1280).every((entry) => entry.panelMode === 'overlay-right' && !entry.panelOpen),
  mobilePanelBottomAndClosed: layouts.filter((entry) => entry.requestedWindowWidth < 800).every((entry) => entry.panelMode === 'drawer-bottom' && !entry.panelOpen),
  actualCanvasAspectUsed: /viewport\.clientWidth/.test(implementation) && /viewport\.clientHeight/.test(implementation) && /camera\.aspect\s*=\s*width\s*\/\s*height/.test(implementation),
  resizeObserverEnabled: /new ResizeObserver/.test(cameraSafety) && /resizeObserver\.observe\(this\.viewport\)/.test(cameraSafety),
  nextFrameVerificationEnabled: /projected-next-frame/.test(cameraSafety) && /backing-next-frame/.test(cameraSafety) && /canvasBackingSizeVerified/.test(cameraSafety),
  requestAnimationFrameDebounceEnabled: /resizeFrame/.test(cameraSafety) && /pendingResizeReasons/.test(cameraSafety),
  horizontalFovUsed: /horizontalFov\s*=\s*2\s*\*\s*Math\.atan/.test(cameraSafety) && /horizontalTangent/.test(cameraSafety),
  boundingBoxAndSphereUsed: /worldBoundingBox/.test(cameraSafety) && /getBoundingSphere/.test(cameraSafety),
  requiredResizeSignalsEnabled: ['window-resize', 'visual-viewport-resize', 'fullscreen-change', 'panel-toggle', 'view-change', 'mode-change'].every((token) => implementation.includes(token)),
  bodyScrollDisabled: /html,\s*\nbody,\s*\n#app[\s\S]*overflow:\s*hidden/.test(styles),
  dynamicViewportHeightEnabled: /height:\s*100dvh/.test(styles),
  threeResponsivePanelModesImplemented: /min-width:\s*1280px/.test(styles) && /min-width:\s*800px/.test(styles) && /max-width:\s*799px/.test(styles),
  focusAndFullscreenControlsImplemented: ['data-focus', 'data-enter-fullscreen', 'data-exit-fullscreen'].every((token) => runtime.includes(token)),
  requiredHotkeysImplemented: ["=== 'f'", "=== 'h'", "=== 'r'", "=== 'Escape'"].every((token) => runtime.includes(token)),
  requiredLayoutMetricsImplemented: ['viewportWidth', 'viewportHeight', 'devicePixelRatio', 'panelMode', 'panelOpen', 'focusMode', 'fullscreen', 'cameraAspect', 'modelScreenBounds', 'headVisible', 'leftHandVisible', 'rightHandVisible', 'leftFootVisible', 'rightFootVisible', 'fullBodyFramed', 'safeMarginPassed'].every((token) => runtime.includes(token)),
};
const report = {
  schema: 'humanoid_rig/task16a_r2b_responsive_layout_audit@1.0',
  method: 'deterministic file-only projection of the unchanged default HRLSurface POSITION bounds and landmark extrema; no browser or visual claims',
  safeMargins: { left: 0.05, right: 0.05, top: 0.07, bottom: 0.07 },
  sourceVertexCount: positions.length / 3,
  sourceBounds: bounds,
  layouts,
  checks,
  passed: Object.values(checks).every(Boolean),
  visualAcceptance: false,
  productionReady: false,
  userVisualAcceptance: 'pending',
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (!report.passed) throw new Error(`Responsive layout audit failed: ${JSON.stringify(checks)}`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

function parseSurface(bytes) {
  if (bytes.subarray(0, 8).toString('utf8') !== 'HRLSURF1') throw new Error('Unexpected HRLSurface magic.');
  const jsonLength = bytes.readUInt32LE(8); const dataOffset = bytes.readUInt32LE(12);
  const header = JSON.parse(bytes.subarray(16, 16 + jsonLength).toString('utf8')); const descriptor = header.chunks.basePositions;
  const data = bytes.subarray(dataOffset + descriptor.byteOffset, dataOffset + descriptor.byteOffset + descriptor.byteLength);
  const copied = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  return { header, basePositions: new Float32Array(copied) };
}

function positionBounds(positions) {
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (let offset = 0; offset < positions.length; offset += 3) for (let axis = 0; axis < 3; axis += 1) { min[axis] = Math.min(min[axis], positions[offset + axis]); max[axis] = Math.max(max[axis], positions[offset + axis]); }
  return { min, max };
}

function findLandmarks(positions) {
  const result = { head: null, leftHand: null, rightHand: null, leftFoot: null, rightFoot: null };
  for (let offset = 0; offset < positions.length; offset += 3) {
    const point = [positions[offset], positions[offset + 1], positions[offset + 2]];
    if (!result.head || point[1] > result.head[1]) result.head = point;
    if (point[1] > -0.2 && (!result.leftHand || point[0] < result.leftHand[0])) result.leftHand = point;
    if (point[1] > -0.2 && (!result.rightHand || point[0] > result.rightHand[0])) result.rightHand = point;
    if (point[0] <= 0 && (!result.leftFoot || point[1] < result.leftFoot[1])) result.leftFoot = point;
    if (point[0] >= 0 && (!result.rightFoot || point[1] < result.rightFoot[1])) result.rightFoot = point;
  }
  return result;
}

function projectLandmarks(landmarks, fit) {
  const verticalTangent = Math.tan(fit.verticalFov * 0.5); const horizontalTangent = Math.tan(fit.horizontalFov * 0.5);
  const visible = (point) => {
    const relative = point.map((value, axis) => value - fit.center[axis]); const depth = fit.distance - dot(relative, fit.basis.backward);
    const x = dot(relative, fit.basis.right) / (depth * horizontalTangent) * 0.5 + 0.5; const y = -dot(relative, fit.basis.up) / (depth * verticalTangent) * 0.5 + 0.5;
    return depth > 0 && x >= 0 && x <= 1 && y >= 0 && y <= 1;
  };
  return { headVisible: visible(landmarks.head), leftHandVisible: visible(landmarks.leftHand), rightHandVisible: visible(landmarks.rightHand), leftFootVisible: visible(landmarks.leftFoot), rightFootVisible: visible(landmarks.rightFoot) };
}

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function roundBounds(bounds) { return Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, Number(value.toFixed(6))])); }
