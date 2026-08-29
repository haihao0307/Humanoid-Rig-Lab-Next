import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  P2_FIXED_POSE_IDS,
  P2_SEQUENCE_POSE_ID,
  buildP2ReviewUrl,
  createP2PoseSynchronizationSnapshot,
  isP2SequenceRequest,
} from '../apps/human-core-v5-production-skeleton-p2-finalpose/p2-review-state-v1.js';
import { projectWorldPositionToViewportV1 } from '../apps/human-core-v5-production-skeleton-p2-finalpose/overlay-projection-v1.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselineCommit = 'e6ea131143a43bf261cac24c028b7c42f7269674';
const outputPath = resolve(root, 'artifacts/qa/task17a3-p2-finalpose/review-ui-audit.json');
const applicationPath = 'apps/human-core-v5-production-skeleton-p2-finalpose/index.js';
const htmlPath = 'human-core-v5-production-skeleton-p2-finalpose.html';
const capturePath = 'scripts/capture-task17a3-p2-finalpose.mjs';
const projectionPath = 'apps/human-core-v5-production-skeleton-p2-finalpose/overlay-projection-v1.js';
const protectedPaths = Object.freeze([
  'assets/human/production-skeleton-v2/hybrid-static-v1/hybrid-production-skeleton-static-v1.glb',
  'apps/human-core-v5-production-rig-detail-v1/scenario.js',
  'src/modules/human-core-v5/human-rig-core-v5.js',
  'src/modules/pose/pose-frame-v4.js',
  'src/modules/human-core-v5/production-skeleton-runtime-v2/index.js',
  'src/modules/human-core-v5/production-skeleton-runtime-v2/hybrid-skeleton-finalpose-runtime-v1.js',
  'src/modules/human-core-v5/production-skeleton-runtime-v2/hybrid-skeleton-module-map-v1.js',
  'src/modules/human-core-v5/production-skeleton-runtime-v2/hybrid-skeleton-quality-metrics-v1.js',
  'src/modules/human-core-v5/production-skeleton-runtime-v2/hybrid-skeleton-transform-resolver-v1.js',
  'apps/human-core-v5-production-skeleton-p2-finalpose/p2-review-state-v1.js',
  'human-core-v5-production-skeleton-p2-finalpose.html',
]);

const applicationSource = readText(applicationPath);
const htmlSource = readText(htmlPath);
const captureSource = readText(capturePath);
const projectionSource = readText(projectionPath);

const cameraChecks = {
  orbitControls: includes(applicationSource, 'new OrbitControls(camera, canvas)'),
  leftRotate: includes(applicationSource, 'controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE'),
  wheelZoom: includes(applicationSource, 'controls.enableZoom = true'),
  rightPan: includes(applicationSource, 'controls.mouseButtons.RIGHT = THREE.MOUSE.PAN'),
  minimumDistance: includes(applicationSource, 'controls.minDistance = 0.38'),
  maximumDistance: includes(applicationSource, 'controls.maxDistance = 7.5'),
  frameKey: includes(applicationSource, "event.key.toLowerCase() === 'f'"),
  resetKey: includes(applicationSource, "event.key.toLowerCase() === 'r'"),
  doubleClickFocus: includes(applicationSource, "elements.viewport.addEventListener('dblclick'"),
  pelvisThoraxTarget: includes(applicationSource, 'midpoint(joints.hips.worldPosition, thoraxCenter)'),
  resizeFramesPerson: includes(applicationSource, 'resize({ preserveReview: true })'),
  windowOnlyState: includes(applicationSource, "authority: 'window-only'"),
  noRigWrites: includes(applicationSource, 'writesHumanRigCore: false'),
  noFinalPoseWrites: includes(applicationSource, 'writesFinalPose: false'),
  noProjectStateWrites: includes(applicationSource, 'writesProjectState: false'),
  visibleHelp: includes(htmlSource, '左键旋转 · 滚轮缩放 · 右键平移 · F 完整人物 · R 默认相机 · 双击聚焦'),
};
assertAll(cameraChecks, 'camera');

const overlayProjectionChecks = {
  projectionReadyState: includes(applicationSource, 'overlayProjectionReady: false'),
  explicitActivation: includes(applicationSource, 'activateOverlayProjection()'),
  publicReadyReceipt: includes(applicationSource, 'overlayProjectionReady: state.overlayProjectionReady'),
  finiteViewportGuard: includes(applicationSource, 'isFinitePositiveViewportRect(rect)'),
  cameraWorldMatrixUpdate: includes(applicationSource, 'camera.updateMatrixWorld(true)'),
  finiteCameraMatrices: includes(applicationSource, 'isFiniteMatrix4(camera.matrixWorldInverse)'),
  finiteClipCoordinates: includes(projectionSource, 'clip.every(Number.isFinite)'),
  clipSpaceWEpsilon: includes(projectionSource, 'Math.abs(clip[3]) <= clipEpsilon'),
  cameraFrontGuard: includes(projectionSource, 'cameraSpace[2] >= -clipEpsilon'),
  finitePixelCoordinates: includes(projectionSource, 'Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null'),
  invalidLineHidden: includes(applicationSource, 'if (!a || !b) { setOverlayElementVisible(line, false); continue; }'),
  invalidPointHidden: includes(applicationSource, 'if (!projected) { setOverlayElementVisible(point, false); continue; }'),
  overlayRecovery: includes(applicationSource, 'setOverlayElementVisible(point, true)'),
  finiteViewBoxOrder: applicationSource.indexOf('isFinitePositiveViewportRect(rect)')
    < applicationSource.indexOf("elements.coreOverlay.setAttribute('viewBox'"),
};
assertAll(overlayProjectionChecks, 'overlay projection');

const identityMatrix = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const projectionFixtureInput = Object.freeze({
  viewportWidth: 200,
  viewportHeight: 100,
  matrixWorldInverse: identityMatrix,
  projectionMatrix: identityMatrix,
});
const overlayProjectionFixtures = {
  valid: projectWorldPositionToViewportV1({ ...projectionFixtureInput, position: [0, 0, -1] }),
  cameraBehind: projectWorldPositionToViewportV1({ ...projectionFixtureInput, position: [0, 0, 1] }),
  nonFinitePosition: projectWorldPositionToViewportV1({ ...projectionFixtureInput, position: [Number.NaN, 0, -1] }),
  positiveInfinityPosition: projectWorldPositionToViewportV1({ ...projectionFixtureInput, position: [Number.POSITIVE_INFINITY, 0, -1] }),
  negativeInfinityPosition: projectWorldPositionToViewportV1({ ...projectionFixtureInput, position: [Number.NEGATIVE_INFINITY, 0, -1] }),
  zeroViewport: projectWorldPositionToViewportV1({ ...projectionFixtureInput, position: [0, 0, -1], viewportWidth: 0 }),
  singularClipW: projectWorldPositionToViewportV1({
    ...projectionFixtureInput,
    position: [0, 0, -1],
    projectionMatrix: Array(16).fill(0),
  }),
};
assert.deepEqual(overlayProjectionFixtures.valid, [100, 50]);
assert.equal(overlayProjectionFixtures.cameraBehind, null);
assert.equal(overlayProjectionFixtures.nonFinitePosition, null);
assert.equal(overlayProjectionFixtures.positiveInfinityPosition, null);
assert.equal(overlayProjectionFixtures.negativeInfinityPosition, null);
assert.equal(overlayProjectionFixtures.zeroViewport, null);
assert.equal(overlayProjectionFixtures.singularClipW, null);

const routeCases = [
  ...P2_FIXED_POSE_IDS.map((poseId) => ({ poseId, sequence: false })),
  { poseId: P2_SEQUENCE_POSE_ID, sequence: true },
];
const poseSynchronizationChecks = routeCases.map(({ poseId, sequence }) => {
  const path = buildP2ReviewUrl('http://127.0.0.1:4186/review.html?overlay=1&closeup=hand#review', {
    poseId,
    overlay: true,
    sequence,
    closeup: 'hand',
  });
  const url = new URL(path, 'http://127.0.0.1:4186/');
  const snapshot = createP2PoseSynchronizationSnapshot({
    poseId,
    urlPoseId: url.searchParams.get('pose'),
    selectPoseId: poseId,
    summaryPoseId: poseId,
  });
  assert.equal(snapshot.consistent, true, `Pose synchronization fixture failed for ${poseId}.`);
  assert.equal(url.searchParams.get('sequence') === '1', sequence, `Sequence URL state failed for ${poseId}.`);
  assert.equal(url.searchParams.get('overlay'), '1');
  assert.equal(url.searchParams.get('closeup'), 'hand');
  assert.equal(url.hash, '#review');
  return { poseId, path, consistent: snapshot.consistent };
});

const poseSourceChecks = {
  nonReloadingHistory: includes(applicationSource, 'history.replaceState'),
  locationInitialization: includes(applicationSource, "const requestedPoseId = POSE_IDS.includes(search.get('pose'))"),
  dropdownSynchronization: includes(applicationSource, 'elements.poseSelect.value = normalized'),
  summarySynchronization: includes(applicationSource, 'state.summaryPoseId = normalized'),
  publicSynchronization: includes(applicationSource, 'poseSynchronization: synchronization'),
  sequencePresentation: includes(applicationSource, 'state.summaryPoseId = P2_SEQUENCE_POSE_ID'),
  directSequenceCanonicalization: includes(applicationSource, 'state.poseId = P2_SEQUENCE_POSE_ID'),
  popstateSynchronization: includes(applicationSource, "addEventListener('popstate', synchronizeFromLocation)"),
  summaryEvidenceHook: includes(applicationSource, 'data-metric="${key}"'),
  captureAssertion: includes(captureSource, 'assertPoseSynchronization(page, expectedPoseId)'),
  sequenceCaptureAssertion: includes(captureSource, "assertPoseSynchronization(page, 'sequence')"),
};
assertAll(poseSourceChecks, 'pose synchronization');

const captureFailClosedChecks = {
  finiteOverlayAssertion: includes(captureSource, 'async function assertFiniteOverlayCoordinates(page)'),
  finiteViewBoxAssertion: includes(captureSource, "failures.push(`invalid viewBox="),
  visibleLineAssertion: includes(captureSource, "failures.push('Overlay has no valid visible line.')"),
  visiblePointAssertion: includes(captureSource, "failures.push('Overlay has no valid visible point.')"),
  consoleErrorsGate: includes(captureSource, 'consoleErrorsEmpty: consoleErrors.length === 0'),
  pageErrorsGate: includes(captureSource, 'pageErrorsEmpty: pageErrors.length === 0'),
  overlayGate: includes(captureSource, 'overlaysFinite:'),
  poseGate: includes(captureSource, 'poseSynchronization:'),
  sequenceStartGate: includes(captureSource, 'sequenceStartSynchronization:'),
  sequenceEndGate: includes(captureSource, 'sequenceEndSynchronization:'),
  failedRuntimeStatus: includes(captureSource, "'failed_runtime_validation'"),
  nonZeroExit: includes(captureSource, 'process.exitCode = 1'),
  failureManifestWrittenFirst: captureSource.indexOf('const manifest = updateManifest(evidence, runFailures)')
    < captureSource.indexOf('process.exitCode = 1'),
  successSummaryGuarded: includes(captureSource, "if (manifest.status === 'captured_pending_user_visual_review')"),
};
assertAll(captureFailClosedChecks, 'capture fail-closed');

const inconsistentFixture = createP2PoseSynchronizationSnapshot({
  poseId: 'reference-t',
  urlPoseId: 'turn-mid',
  selectPoseId: 'reference-t',
  summaryPoseId: 'reference-t',
});
assert.equal(inconsistentFixture.consistent, false, 'Synchronization detector must reject mismatched states.');
assert.equal(isP2SequenceRequest(new URLSearchParams('sequence=1')), true);
assert.equal(isP2SequenceRequest(new URLSearchParams('pose=sequence')), true);
assert.equal(isP2SequenceRequest(new URLSearchParams('pose=reference-t')), false);

const protectedFiles = protectedPaths.map((path) => {
  const current = readFileSync(resolve(root, path));
  const baseline = execFileSync('git', ['show', `${baselineCommit}:${path}`], {
    cwd: root,
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
  });
  const currentComparable = path.endsWith('.glb') ? current : normalizeTextLineEndings(current);
  const baselineComparable = path.endsWith('.glb') ? baseline : normalizeTextLineEndings(baseline);
  const currentSha256 = sha256(currentComparable);
  const baselineSha256 = sha256(baselineComparable);
  assert.equal(currentSha256, baselineSha256, `Frozen file changed: ${path}`);
  return { path, baselineSha256, currentSha256, unchanged: true };
});

const receipt = {
  schema: 'humanoid_rig/hybrid_skeleton_p2_review_ui_audit@1.0',
  baselineCommit,
  result: 'PASS_FILE_ONLY',
  auditScope: 'static structure plus executable pure projection fixtures; not browser validation',
  cameraChecks,
  overlayProjectionChecks,
  overlayProjectionFixtures,
  captureFailClosedChecks,
  poseSourceChecks,
  poseSynchronizationChecks,
  inconsistentFixtureDetected: inconsistentFixture.consistent === false,
  protectedFiles,
  protectedFilesUnchanged: protectedFiles.every(({ unchanged }) => unchanged),
  browserOperationPerformed: false,
  mediaStatus: 'pending_user_recapture',
  captureCommand: 'node scripts/capture-task17a3-p2-finalpose.mjs',
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`PASS P2 review UI file audit: ${Object.keys(cameraChecks).length} camera checks; ${Object.keys(overlayProjectionChecks).length} overlay checks; ${poseSynchronizationChecks.length} pose states; ${protectedFiles.length} frozen files unchanged; browser recapture pending user.`);

function readText(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function includes(source, token) {
  return source.includes(token);
}

function assertAll(checks, label) {
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  assert.deepEqual(failed, [], `${label} checks failed: ${failed.join(', ')}`);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function normalizeTextLineEndings(buffer) {
  return Buffer.from(buffer.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
}
