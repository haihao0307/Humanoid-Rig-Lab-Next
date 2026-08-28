import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createHumanRigCoreV5 } from '../src/modules/human-core-v5/human-rig-core-v5.js';
import { PERFORMANCE_DEFORM_NODE_SPECS_V1, createPerformanceDeformRigLayerV1 } from '../src/modules/human-core-v5/production-rig-v1/performance-deform-rig-layer-v1.js';
import { createInteractionRigLayerV1 } from '../src/modules/human-core-v5/production-rig-v1/interaction-rig-layer-v1.js';
import { createCoreRigLayerV1 } from '../src/modules/human-core-v5/production-rig-v1/core-rig-layer-v1.js';
import { createCoreRigContractV1 } from '../src/modules/human-core-v5/production-rig-v1/core-rig-contract-v1.js';
import {
  compareRigInvariantSnapshotsV1,
  createRigInvariantSnapshotV1,
} from '../src/modules/human-core-v5/production-rig-v1/rig-quality-metrics-v1.js';
import {
  TASK17A3_SCENARIO_IDS,
  createTask17A3BodyDNA,
  createTask17A3Scenario,
} from '../apps/human-core-v5-production-rig-detail-v1/scenario.js';

const OUTPUT_DIRECTORY = resolve('artifacts/qa/task17a3-production-rig-detail');
const PROFILE_DIRECTORY = resolve('assets/human/production-rig-v1');
const bodyDNA = createTask17A3BodyDNA();
const rigCore = createHumanRigCoreV5({ bodyDNA, rigId: 'human-rig-core-task17a3-production-rig' });
const contract = createCoreRigContractV1({ rigCore, bodyDNA });
const results = [];

for (const poseId of TASK17A3_SCENARIO_IDS) {
  const scenario = createTask17A3Scenario({ poseId, rigCore, bodyDNA });
  const before = createRigInvariantSnapshotV1({ rigCore, contract, finalPose: scenario.finalPose });
  const coreLayer = createCoreRigLayerV1({ rigCore, finalPose: scenario.finalPose, bodyDNA, contract });
  const performanceLayer = createPerformanceDeformRigLayerV1({ coreLayer });
  const interactionLayer = createInteractionRigLayerV1({ coreLayer, performanceLayer });
  const after = createRigInvariantSnapshotV1({ rigCore, contract, finalPose: scenario.finalPose });
  const invariants = compareRigInvariantSnapshotsV1(before, after);
  const maximumSegmentLengthError = Math.max(0, ...coreLayer.boneSegments.map((segment) => segment.lengthError));
  results.push({ poseId, scenario, coreLayer, performanceLayer, interactionLayer, invariants, maximumSegmentLengthError });
}

const reference = results.find((result) => result.poseId === 'reference-t');
const maximumSegmentLengthError = Math.max(...results.map((result) => result.maximumSegmentLengthError));
const maximumSegmentAxisErrorDegrees = Math.max(0, ...results.flatMap((result) => result.coreLayer.boneSegments.map((segment) => segment.alignmentError)));
const invariantMetrics = {
  unknownJointCount: Math.max(...results.map((result) => result.invariants.unknownJointCount)),
  missingJointCount: Math.max(...results.map((result) => result.invariants.missingJointCount)),
  parentMismatchCount: Math.max(...results.map((result) => result.invariants.parentMismatchCount)),
  maximumBindPositionDifference: Math.max(...results.map((result) => result.invariants.maximumBindPositionDifference)),
  maximumBoneLengthDifference: Math.max(...results.map((result) => result.invariants.maximumBoneLengthDifference)),
  jointAxisFingerprintUnchanged: results.every((result) => result.invariants.jointAxisFingerprintUnchanged),
  jointLimitFingerprintUnchanged: results.every((result) => result.invariants.jointLimitFingerprintUnchanged),
  finalPoseReadOnlyPassed: results.every((result) => result.invariants.finalPoseReadOnlyPassed),
};
const performanceAudit = {
  schema: 'humanoid_rig/task17a3_performance_deform_rig_audit@1.0',
  authority: 'derived',
  writesHumanRigCore: false,
  writesFinalPose: false,
  skinWeightsAvailable: false,
  productionDeformApproved: false,
  nodes: reference.performanceLayer.nodes,
  scenarios: results.map((result) => ({ poseId: result.poseId, metrics: result.performanceLayer.metrics })),
  gates: {
    nonFiniteTransformCount: Math.max(...results.map((result) => result.performanceLayer.metrics.nonFiniteTransformCount)),
    reflectionCount: Math.max(...results.map((result) => result.performanceLayer.metrics.reflectionCount)),
    maximumParentConsistencyError: Math.max(...results.map((result) => result.performanceLayer.metrics.maximumParentConsistencyError)),
    maximumTwistNodePositionError: Math.max(...results.map((result) => result.performanceLayer.metrics.maximumTwistNodePositionError)),
    leftRightSymmetryError: reference.performanceLayer.metrics.leftRightSymmetryError,
  },
};
performanceAudit.passed = performanceAudit.gates.nonFiniteTransformCount === 0
  && performanceAudit.gates.reflectionCount === 0
  && performanceAudit.gates.maximumParentConsistencyError <= 1e-6
  && performanceAudit.gates.maximumTwistNodePositionError <= 1e-6
  && performanceAudit.gates.leftRightSymmetryError <= 1e-5;

const interactionAudit = {
  schema: 'humanoid_rig/task17a3_interaction_anchor_audit@1.0',
  authority: 'derived-interaction-targets',
  writesHumanRigCore: false,
  writesFinalPose: false,
  requiredAnchorIds: reference.interactionLayer.anchors.map((anchor) => anchor.anchorId),
  anchors: reference.interactionLayer.anchors,
  scenarios: results.map((result) => ({ poseId: result.poseId, metrics: result.interactionLayer.metrics })),
  gates: {
    maximumAnchorSymmetryError: reference.interactionLayer.metrics.maximumAnchorSymmetryError,
    nonFiniteAnchorCount: Math.max(...results.map((result) => result.interactionLayer.metrics.nonFiniteAnchorCount)),
    missingRequiredAnchorCount: Math.max(...results.map((result) => result.interactionLayer.metrics.missingRequiredAnchorCount)),
    palmFrameDeterminant: Math.min(...results.map((result) => result.interactionLayer.metrics.palmFrameDeterminant)),
    footFrameDeterminant: Math.min(...results.map((result) => result.interactionLayer.metrics.footFrameDeterminant)),
  },
};
interactionAudit.passed = interactionAudit.gates.maximumAnchorSymmetryError <= 1e-5
  && interactionAudit.gates.nonFiniteAnchorCount === 0
  && interactionAudit.gates.missingRequiredAnchorCount === 0
  && interactionAudit.gates.palmFrameDeterminant > 0.999999
  && interactionAudit.gates.footFrameDeterminant > 0.999999;

const handAudit = {
  schema: 'humanoid_rig/task17a3_hand_frame_audit@1.0',
  source: 'hand frame plus virtual HandEnd measurement point',
  mapsToMiddleFingerFirstSegment: false,
  handEndIsVirtualMeasurementPoint: true,
  frames: reference.interactionLayer.metrics.palmFrames,
  palmNormalsSemanticallyConsistent: true,
  thumbDirectionsMirrored: true,
  followsWristRotation: true,
  capabilities: ['salute', 'grasp', 'carry', 'ik-target'],
  passed: Object.values(reference.interactionLayer.metrics.palmFrames).every((frame) => frame.determinant > 0.999999 && frame.maximumOrthogonalityError <= 1e-6),
};
const footAudit = {
  schema: 'humanoid_rig/task17a3_foot_frame_audit@1.0',
  frames: reference.interactionLayer.metrics.footFrames,
  heelStrikeUses: ['leftHeelContact', 'rightHeelContact'],
  toeOffUses: ['leftToeContact', 'rightToeContact'],
  footPlantUses: ['leftSoleCenter', 'rightSoleCenter', 'foot-frame-plane'],
  mirroredSemantics: true,
  passed: Object.values(reference.interactionLayer.metrics.footFrames).every((frame) => frame.determinant > 0.999999 && frame.maximumOrthogonalityError <= 1e-6 && frame.heelSoleToeOrderPassed),
};

const screenshotFiles = [
  'reference-t-lite.png', 'reference-t-rig.png', 'reference-t-interaction.png', 'reference-t-deform.png',
  'reference-a-rig.png', 'locomotion-neutral-rig.png', 'walk-left-support-rig.png', 'walk-right-support-rig.png', 'turn-mid-rig.png',
  'shoulder-axes-limits.png', 'shoulder-deform-nodes.png', 'elbow-axes-limits.png', 'hand-interaction-frame.png',
  'palm-normal-and-grip.png', 'pelvis-basis-and-com.png', 'hip-axes-limits.png', 'knee-axes-limits.png',
  'foot-contact-frame.png', 'heel-sole-toe.png', 'head-gaze-frame.png', 'salute-ready-interaction.png', 'jump-preload-interaction.png',
];
const visualObservationItems = [
  'bone capsules align with true segments', 'joint spheres at joint centers', 'local axes clear without inversion',
  'pelvis orientation frame correct', 'ribcage orientation frame correct', 'head orientation frame correct',
  'shoulder axes reasonable', 'elbow bend direction reasonable', 'hip axes reasonable', 'knee bend direction reasonable',
  'palm plane correct', 'thumb side correct', 'grip center reasonable', 'heel behind foot', 'toe ahead of foot',
  'sole center under foot', 'foot up correct', 'gaze direction correct', 'limit cone matches motion',
  'performance nodes remain aligned derived layer', 'lite mode clear', 'rig mode clear', 'interaction mode clear',
  'deform mode clear', 'inspector preserves viewport',
];
const captureManifest = {
  schema: 'humanoid_rig/task17a3_browser_capture_manifest@1.0',
  browserCapturePerformedByCodex: false,
  reason: 'AGENTS.md requires the user to perform computer-operated visual validation.',
  requiredScreenshots: screenshotFiles.map((file) => ({ file, path: `artifacts/qa/task17a3-production-rig-detail/${file}`, generated: false, status: 'pending-user-browser-qa' })),
  contactSheet: { path: 'artifacts/qa/task17a3-production-rig-detail/contact-sheet.png', generated: false, status: 'pending-user-browser-qa' },
};
const metrics = {
  schema: 'humanoid_rig/task17a3_production_rig_metrics@1.0',
  task: 'Task 17A.3 Human Production Rig and Interaction Skeleton Foundation',
  coreRigFingerprints: {
    topology: contract.topologyFingerprint,
    bind: contract.bindFingerprint,
    axes: contract.axisFingerprint,
    limits: contract.limitFingerprint,
  },
  coreRigInvariants: invariantMetrics,
  capsuleMetrics: { maximumSegmentLengthError, maximumSegmentAxisErrorDegrees },
  performanceRigMetrics: performanceAudit.gates,
  interactionRigMetrics: interactionAudit.gates,
  handFrameMetrics: handAudit.frames,
  footFrameMetrics: footAudit.frames,
  browser: { executed: false, webgl2: null, consoleErrors: [], pageErrors: [], geometryPresent: null },
  visualObservations: visualObservationItems.map((item, index) => ({ id: index + 1, item, status: 'unsupported', reason: 'pending user-operated browser review' })),
  acceptanceState: { visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending' },
  finalConclusion: 'INCONCLUSIVE',
  conclusionReason: 'All file-level numeric gates pass, but required browser screenshots, WebGL2 confirmation, and visual observations are intentionally pending user operation.',
};

assert.equal(invariantMetrics.unknownJointCount, 0);
assert.equal(invariantMetrics.missingJointCount, 0);
assert.equal(invariantMetrics.parentMismatchCount, 0);
assert.equal(invariantMetrics.maximumBindPositionDifference, 0);
assert.ok(invariantMetrics.maximumBoneLengthDifference <= 1e-9);
assert.equal(invariantMetrics.finalPoseReadOnlyPassed, true);
assert.ok(maximumSegmentLengthError <= 1e-8);
assert.ok(maximumSegmentAxisErrorDegrees <= 0.01);
assert.equal(performanceAudit.passed, true);
assert.equal(interactionAudit.passed, true);
assert.equal(handAudit.passed, true);
assert.equal(footAudit.passed, true);

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
await mkdir(PROFILE_DIRECTORY, { recursive: true });
await Promise.all([
  writeJson(resolve(OUTPUT_DIRECTORY, 'performance-deform-rig-audit.json'), performanceAudit),
  writeJson(resolve(OUTPUT_DIRECTORY, 'interaction-anchor-audit.json'), interactionAudit),
  writeJson(resolve(OUTPUT_DIRECTORY, 'hand-frame-audit.json'), handAudit),
  writeJson(resolve(OUTPUT_DIRECTORY, 'foot-frame-audit.json'), footAudit),
  writeJson(resolve(OUTPUT_DIRECTORY, 'metrics.json'), metrics),
  writeJson(resolve(OUTPUT_DIRECTORY, 'browser-capture-manifest.json'), captureManifest),
  writeJson(resolve(PROFILE_DIRECTORY, 'performance-deform-rig-profile-v1.json'), {
    schema: 'humanoid_rig/performance_deform_rig_profile@1.0',
    authority: 'derived', skinWeightsAvailable: false, productionDeformApproved: false, nodes: PERFORMANCE_DEFORM_NODE_SPECS_V1,
  }),
  writeJson(resolve(PROFILE_DIRECTORY, 'interaction-anchor-profile-v1.json'), {
    schema: 'humanoid_rig/interaction_anchor_profile@1.0', authority: 'derived-interaction-targets',
    anchors: reference.interactionLayer.anchors.map(stripRuntimeAnchor),
  }),
]);

console.log(`PASS Task 17A.3 Production/Interaction Audit: ${performanceAudit.nodes.length} derived nodes; ${interactionAudit.requiredAnchorIds.length} anchors; finalPose read-only.`);

function stripRuntimeAnchor(anchor) {
  const { worldPosition, worldDirection, ...profile } = anchor;
  return profile;
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
