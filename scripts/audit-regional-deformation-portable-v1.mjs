import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root } from './natural-skinning-v1-io.mjs';

const qaDirectory = resolve(root, 'artifacts/qa/task16b-regional-deformation-v1');
const reviewDirectory = resolve(root, 'artifacts/review/task16b-regional-deformation-v1');
const sourceRuntimePath = resolve(root, 'apps/human-core-v5-regional-deformation-v1/runtime.js');
const standalonePath = resolve(reviewDirectory, 'regional-natural-deformation-standalone.html');
const httpEntryPath = resolve(root, 'human-core-v5-regional-natural-deformation-v1.html');
const [runtime, standalone, httpEntry, cache, round1, round2, standard2, sweeps2, implementation2, screenshots, portable, browserQa] = await Promise.all([
  readFile(sourceRuntimePath, 'utf8'), readFile(standalonePath, 'utf8'), readFile(httpEntryPath, 'utf8'), readJson('pose-cache-round-2.json'),
  readJson('summary-round-1.json'), readJson('summary-round-2.json'), readJson('standard-poses-round-2.json'), readJson('progressive-sweeps-round-2.json'), readJson('implementation-round-2.json'),
  readJson('screenshots/screenshot-manifest.json'), readReviewJson('portable-review-manifest.json'), readJson('browser-qa.json'),
]);
await import(`../apps/human-core-v5-regional-deformation-v1/runtime.js?audit=${Date.now()}`);
const api = globalThis.HRLRegionalDeformationReviewAppV1;
const requiredPoseIds = api.POSES.map(([id]) => id); const requiredModes = api.MODES.map(([id]) => id);
const checks = {
  standaloneAndHttpByteIdentical: standalone === httpEntry,
  standaloneShaMatchesManifest: sha256(Buffer.from(standalone)) === portable.standaloneSha256,
  httpEntryShaMatchesManifest: sha256(Buffer.from(httpEntry)) === portable.httpEntrySha256,
  contentSecurityPolicyPresent: standalone.includes("connect-src 'none'"),
  externalRuntimeReferenceCount: countMatches(standalone, /<(?:script|link|img)\b[^>]*(?:src|href)\s*=\s*["'][^"']+["']/gi),
  fetchCallCount: countMatches(standalone, /\bfetch\s*\(/g),
  moduleScriptCount: countMatches(standalone, /type\s*=\s*["']module["']/gi),
  cameraSafetyEmbedded: standalone.includes('CameraSafetyControllerV1'),
  threeEmbedded: standalone.includes('project-local IIFE build'),
  regionalDataEmbedded: standalone.includes('globalThis.__HRL_REGIONAL_DATA__='),
  frontSideSourcePresent: runtime.includes('side: THREE.FrontSide'),
  sourceMeshConstructionCount: countMatches(runtime, /new THREE\.Mesh\s*\(/g),
  interfacePoseCount: api.POSES.length,
  interfaceModeCount: api.MODES.length,
  everyInterfacePoseCached: requiredPoseIds.every((id) => cache.poses[id]),
  exactRequiredModes: arraysEqual(requiredModes, ['surface','surface-wireframe','skeleton-overlay','base-skinning','regional-deformation','before-after','true-inversion-map','intersection-map','volume-map','strain-map','lattice-debug']),
  screenshotManifestCount: screenshots.screenshots.length,
  generatedScreenshotCount: screenshots.generatedScreenshotCount,
  fabricatedPlaceholderCount: screenshots.fabricatedPlaceholderCount,
  contactSheetCount: screenshots.contactSheets.length,
  browserQaNotFabricated: ['consoleErrors','pageErrors','startupErrors','failedRequests','externalHumanAssetRequests','externalRigAssetRequests','visibleMeshCount','humanSurfaceCount','firstFrameRendered'].every((key) => browserQa[key] === null),
  canonicalVertexCount: cache.vertexCount,
  canonicalTriangleCount: cache.triangleCount,
  task16bVisualAcceptance: round2.task16bVisualAcceptance,
  visualAcceptance: round2.visualAcceptance,
  productionReady: round2.productionReady,
  userVisualAcceptance: round2.userVisualAcceptance,
};
const passed = checks.standaloneAndHttpByteIdentical && checks.standaloneShaMatchesManifest && checks.httpEntryShaMatchesManifest && checks.contentSecurityPolicyPresent && checks.externalRuntimeReferenceCount === 0 && checks.fetchCallCount === 0 && checks.moduleScriptCount === 0 && checks.cameraSafetyEmbedded && checks.threeEmbedded && checks.regionalDataEmbedded && checks.frontSideSourcePresent && checks.sourceMeshConstructionCount === 1 && checks.interfacePoseCount === 21 && checks.interfaceModeCount === 11 && checks.everyInterfacePoseCached && checks.exactRequiredModes && checks.screenshotManifestCount === 30 && checks.generatedScreenshotCount === 0 && checks.fabricatedPlaceholderCount === 0 && checks.contactSheetCount === 3 && checks.browserQaNotFabricated && checks.canonicalVertexCount === 16384 && checks.canonicalTriangleCount === 32764 && checks.task16bVisualAcceptance === false && checks.visualAcceptance === false && checks.productionReady === false && checks.userVisualAcceptance === 'pending';
const staticAudit = { schema: 'humanoid_rig/task16b_r3_portable_static_audit@1.0', passed, scope: 'file-content-only; no browser execution', checks, browserEvidenceStatus: browserQa.status, conclusion: round2.conclusion };
await writeFile(resolve(qaDirectory, 'portable-static-audit.json'), `${JSON.stringify(staticAudit, null, 2)}\n`, 'utf8');

const rounds = {
  schema: 'humanoid_rig/task16b_r3_two_round_summary@1.0', maximumImplementationRounds: 2, roundsExecuted: 2, thirdRoundProhibitedAndNotRun: true,
  round1, round2,
  delta: { standardPosePassedCount: round2.standardPosePassedCount - round1.standardPosePassedCount, standardPoseFailedCount: round2.standardPoseFailedCount - round1.standardPoseFailedCount, sweepFailedSampleCount: round2.sweepFailedSampleCount - round1.sweepFailedSampleCount, hipTrueTriangleInversionCount: round2.hipTrueTriangleInversionCount - round1.hipTrueTriangleInversionCount, hipCriticalSelfIntersectionCount: round2.hipCriticalSelfIntersectionCount - round1.hipCriticalSelfIntersectionCount, spineCriticalSelfIntersectionCount: round2.spineCriticalSelfIntersectionCount - round1.spineCriticalSelfIntersectionCount },
  conclusion: round2.conclusion,
};
await writeFile(resolve(qaDirectory, 'two-round-summary.json'), `${JSON.stringify(rounds, null, 2)}\n`, 'utf8');

const screenshotPaths = screenshots.screenshots.map((item) => item.expectedPath); const contactSheetPaths = screenshots.contactSheets.map((item) => item.expectedPath);
const orientationResult = aggregateBarrier(standard2.poses, 'orientationBarrier'); const collisionResult = aggregateBarrier(standard2.poses, 'collisionBarrier');
const delivery = {
  schema: 'humanoid_rig/task16b_r3_delivery_report@1.0',
  items: {
    '1_TASK16B_R2A_FORENSICS_HEAD': '3189b4d3828a88200fcf2b645ed3e706e90a3007',
    '2_forensics_checkpoint_commit': { hash: '3189b4d3828a88200fcf2b645ed3e706e90a3007', message: 'experiment(v5): record calibrated skinning failure forensics', parent: '48eb4df8bd87ca3bfdd1110a047cf77e5cdb8c7b' },
    '3_push_or_bundle': { pushAttemptCount: 1, pushResult: 'transport-blocked-before-process-launch', remoteUploadOccurred: false, bundlePath: 'G:/Three.js/NEW/Humanoid-Rig-Lab-Next-task16b-r2a-forensics-3189b4d-all-refs.bundle', bundleBytes: 63940580, bundleSha256: '5C74D6B7C3D160FD053D1CD12DBB27F738F08E36E2B28F2E29CF99B7F9D47CD8', bundleVerified: true },
    '4_repair_branch': 'experiment/human-core-v5-regional-natural-deformation-v1',
    '5_repair_worktree': 'G:/Three.js/NEW/Humanoid-Rig-Lab-Next-task16b-regional-deformation-v1',
    '6_four_regional_modules': implementation2.fourRegionalSystems,
    '7_spine_lattice': { latticeId: implementation2.spineLattice.latticeId, ringCount: implementation2.spineLattice.ringCount, controlsPerRing: implementation2.spineLattice.controlsPerRing, ringIds: implementation2.spineLattice.rings.map((ring) => ring.id), hidden: implementation2.spineLattice.hidden },
    '8_pelvis_hip_groin_lattice': { latticeId: implementation2.pelvisHipGroinLattice.latticeId, sectionCount: implementation2.pelvisHipGroinLattice.sectionCount, sectionIds: implementation2.pelvisHipGroinLattice.sections.map((section) => section.id), hidden: implementation2.pelvisHipGroinLattice.hidden },
    '9_elbow_corrective_curve': implementation2.profile.elbow.curve,
    '10_knee_corrective_curve': implementation2.profile.knee.curve,
    '11_orientation_barrier_result': orientationResult,
    '12_collision_barrier_result': collisionResult,
    '13_two_round_results': rounds,
    '14_standard_poses': { count: round2.standardPoseCount, passed: round2.standardPosePassedCount, failed: round2.standardPoseFailedCount, failedPoseIds: standard2.failedPoseIds },
    '15_progressive_sweeps': sweeps2.sweeps.map((sweep) => ({ sweepId: sweep.sweepId, sampleCount: sweep.samples.length, firstTrueInversionAngle: sweep.firstTrueInversionAngle, firstCriticalIntersectionAngle: sweep.firstCriticalIntersectionAngle, elbowVolumeRange: sweep.elbowVolumeRange, kneeVolumeRange: sweep.kneeVolumeRange, passed: sweep.passed })),
    '16_hip_true_triangle_inversion_count': round2.hipTrueTriangleInversionCount,
    '17_hip_critical_self_intersection_count': round2.hipCriticalSelfIntersectionCount,
    '18_spine_critical_self_intersection_count': round2.spineCriticalSelfIntersectionCount,
    '19_elbow_volume_range': round2.elbowVolumeRange,
    '20_knee_volume_range': round2.kneeVolumeRange,
    '21_return_to_rest_error': round2.returnToRestError,
    '22_all_screenshot_paths': screenshotPaths,
    '23_three_contact_sheets': contactSheetPaths,
    '24_http_page_entry': 'human-core-v5-regional-natural-deformation-v1.html',
    '25_standalone_path': 'artifacts/review/task16b-regional-deformation-v1/regional-natural-deformation-standalone.html',
    '26_console_errors': browserQa.consoleErrors,
    '27_page_errors': browserQa.pageErrors,
    '28_startup_errors': browserQa.startupErrors,
    '29_failed_requests': browserQa.failedRequests,
    '30_external_human_asset_requests': browserQa.externalHumanAssetRequests,
    '31_external_rig_asset_requests': browserQa.externalRigAssetRequests,
    '32_final_conclusion': round2.conclusion,
    '33_task16b_visual_acceptance': false,
    '34_visual_acceptance': false,
    '35_production_ready': false,
    '36_user_visual_acceptance': 'pending',
    '37_worktree_status': 'uncommitted R3 implementation and evidence artifacts; no final pass commit created',
  },
  browserEvidenceStatus: browserQa.status, staticAuditPassed: staticAudit.passed,
};
await writeFile(resolve(qaDirectory, 'delivery-report-37-items.json'), `${JSON.stringify(delivery, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ staticAudit, rounds, deliveryReportPath: 'artifacts/qa/task16b-regional-deformation-v1/delivery-report-37-items.json' }, null, 2)}\n`);

function aggregateBarrier(poses, key) { return poses.reduce((result, pose) => { const value = pose.barrierMetrics?.[key] || {}; result.poseCount += 1; result.passedPoseCount += value.passed ? 1 : 0; result.failedPoseCount += value.passed ? 0 : 1; result.iterationCount += value.iterations?.length || 0; result.finalViolationCount += Number(value.finalViolationCount || 0); result.criticalSelfIntersectionCount += Number(value.criticalSelfIntersectionCount || 0); return result; }, { poseCount: 0, passedPoseCount: 0, failedPoseCount: 0, iterationCount: 0, finalViolationCount: 0, criticalSelfIntersectionCount: 0 }); }
async function readJson(name) { return JSON.parse(await readFile(resolve(qaDirectory, name), 'utf8')); }
async function readReviewJson(name) { return JSON.parse(await readFile(resolve(reviewDirectory, name), 'utf8')); }
function countMatches(value, pattern) { return [...value.matchAll(pattern)].length; }
function arraysEqual(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
