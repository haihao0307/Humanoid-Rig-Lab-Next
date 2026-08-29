import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTask17A3BodyDNA, createTask17A3Scenario } from '../apps/human-core-v5-production-rig-detail-v1/scenario.js';
import { createHumanRigCoreV5 } from '../src/modules/human-core-v5/human-rig-core-v5.js';
import { createProceduralSimulationRigFrameV5 } from '../src/modules/human-core-v5/procedural-deform/procedural-simulation-rig-fk-v5.js';
import { createCoreRigContractV1 } from '../src/modules/human-core-v5/production-rig-v1/core-rig-contract-v1.js';
import {
  compareRigInvariantSnapshotsV1,
  createRigInvariantSnapshotV1,
} from '../src/modules/human-core-v5/production-rig-v1/rig-quality-metrics-v1.js';
import {
  createHybridSkeletonFinalPoseRuntimeV1,
  createHybridSkeletonModuleMapV1,
  createHybridSkeletonPoseMetricsV1,
  fingerprintFinalPoseV1,
  interpolateFinalPoseV1,
} from '../src/modules/human-core-v5/production-skeleton-runtime-v2/index.js';
import { inspectGlb } from '../src/modules/human-core-v5/production-skeleton-p1-hybrid-static/glb-writer.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactDirectory = resolve(root, 'artifacts/qa/task17a3-p2-finalpose');
const assetPath = resolve(root, 'assets/human/production-skeleton-v2/hybrid-static-v1/hybrid-production-skeleton-static-v1.glb');
const sourcePath = resolve(root, 'assets/human/production-skeleton-v2/hybrid-static-v1/skeleton-source.json');
const expectedAssetSha256 = 'ffef1a04df026f576c9b5af5867b1dbd585145578cde465998a0ef56e32fbdcd';
const poseIds = Object.freeze([
  'reference-t', 'reference-a', 'locomotion-neutral',
  'walk-left-support', 'walk-right-support', 'turn-mid',
]);
const sequencePoseIds = Object.freeze([
  'reference-t', 'reference-a', 'locomotion-neutral',
  'walk-left-support', 'walk-right-support', 'turn-mid', 'locomotion-neutral',
]);
const requiredBrowserArtifacts = Object.freeze([
  'reference-t.png', 'reference-a.png', 'locomotion-neutral.png',
  'walk-left-support.png', 'walk-right-support.png', 'turn-mid.png',
  'reference-t-overlay.png', 'reference-a-overlay.png', 'locomotion-neutral-overlay.png',
  'walk-left-support-overlay.png', 'walk-right-support-overlay.png', 'turn-mid-overlay.png',
  'shoulder-turn-mid-closeup.png', 'pelvis-walk-support-closeup.png',
  'hand-walk-support-closeup.png', 'foot-walk-support-closeup.png',
  'contact-sheet.png', 'pose-connection-cycle.webm',
]);
const visualReviewItems = Object.freeze([
  'Reference T 与 P1.1 静态资产一致。',
  'Reference A 双臂方向正确。',
  'Locomotion Neutral 双臂自然下垂。',
  'Left Support 左右侧身份正确。',
  'Right Support 左右侧身份正确。',
  'Turn Mid 胸廓与骨盆方向正确。',
  '头颈没有脱离。',
  '胸廓没有脱离脊柱。',
  '骨盆没有脱离腿部。',
  '锁骨与肩关节保持连接。',
  '肩胛没有翻转。',
  '上臂模块没有断裂。',
  '前臂双轨没有交换。',
  '手掌方向正确。',
  '大腿没有脱离髋部。',
  '小腿双轨没有交换。',
  '足部方向正确。',
  '没有模块爆炸。',
  '没有左右互换。',
  '动态序列没有明显矩阵跳变。',
  'Core Overlay 与视觉骨架中心一致。',
  '视觉达到进入敬礼和跳跃动作研发的价值。',
]);

mkdirSync(artifactDirectory, { recursive: true });
const glbBefore = readFileSync(assetPath);
const assetSha256Before = sha256(glbBefore);
assert.equal(assetSha256Before, expectedAssetSha256, 'Frozen P1.1 GLB SHA256 drifted before audit.');
const { json: gltf } = inspectGlb(glbBefore);
const identity = inspectAssetIdentity(glbBefore, gltf);
assert.deepEqual({ vertices: identity.vertexCount, triangles: identity.triangleCount, modules: identity.moduleIds.length }, {
  vertices: 1863, triangles: 3418, modules: 24,
});
assert.equal(identity.nonIdentityNodeTransformCount, 0, 'Frozen GLB module nodes must retain identity rest transforms.');
assert.equal(new Set(identity.moduleIds).size, 24, 'Frozen GLB module IDs must be unique.');

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const bodyDNA = createTask17A3BodyDNA();
const rigCore = createHumanRigCoreV5({ bodyDNA, rigId: 'human-rig-core-task17a3-p2-finalpose' });
const contract = createCoreRigContractV1({ rigCore, bodyDNA });
const fixtures = Object.fromEntries(poseIds.map((poseId) => [poseId, createTask17A3Scenario({ poseId, rigCore, bodyDNA }).finalPose]));
const fixtureFingerprintsBefore = Object.fromEntries(poseIds.map((poseId) => [poseId, fingerprintFinalPoseV1(fixtures[poseId])]));
const coreBefore = createRigInvariantSnapshotV1({ rigCore, contract, finalPose: fixtures['reference-t'] });
const restSimulationFrame = createProceduralSimulationRigFrameV5({
  finalPose: fixtures['reference-t'], rigCore, bodyDNA,
});
const moduleMap = createHybridSkeletonModuleMapV1({ restSimulationFrame });
const runtime = createHybridSkeletonFinalPoseRuntimeV1({ rigCore, bodyDNA, moduleMap });

assert.deepEqual(moduleMap.map(({ moduleId }) => moduleId).sort(), source.modules.map(({ moduleId }) => moduleId).sort(), 'Module map does not match the frozen GLB modules.');
const referenceFrame = runtime.update(fixtures['reference-t']);
const maximumReferenceMatrixDifference = Math.max(...referenceFrame.transforms.flatMap(({ currentWorldMatrix }) => currentWorldMatrix
  .map((value, index) => Math.abs(value - (index % 5 === 0 ? 1 : 0)))));
assert.ok(maximumReferenceMatrixDifference <= 1e-12, `Reference T must reproduce the P1.1 identity rest nodes; received ${maximumReferenceMatrixDifference}.`);
const sequenceContinuity = auditSequenceContinuity({ sequencePoseIds, fixtures, runtime });
const maximumJumpByArrivalPose = Object.fromEntries(poseIds.map((poseId) => [poseId, 0]));
for (const transition of sequenceContinuity.transitions) {
  maximumJumpByArrivalPose[transition.toPoseId] = Math.max(maximumJumpByArrivalPose[transition.toPoseId] ?? 0, transition.maximumFrameToFrameModuleJump);
}

const sceneMetrics = poseIds.map((poseId) => {
  const runtimeFrame = runtime.update(fixtures[poseId]);
  const repeatFrame = runtime.update(fixtures[poseId]);
  assert.deepEqual(repeatFrame.transforms.map(({ currentWorldMatrix }) => currentWorldMatrix),
    runtimeFrame.transforms.map(({ currentWorldMatrix }) => currentWorldMatrix), `${poseId} is not deterministic.`);
  const metrics = createHybridSkeletonPoseMetricsV1({
    poseId,
    moduleMap,
    runtimeFrame,
    restSimulationFrame,
    geometryHash: identity.geometryHash,
    indexHash: identity.indexHash,
    loadedModuleIds: identity.moduleIds,
    maximumFrameToFrameModuleJump: maximumJumpByArrivalPose[poseId],
  });
  assert.equal(metrics.passed, true, `${poseId} failed its Hybrid Skeleton numerical gate.`);
  return metrics;
});

assert.equal(new Set(sceneMetrics.map(({ geometryHash }) => geometryHash)).size, 1, 'Geometry hash changed across scenes.');
assert.equal(new Set(sceneMetrics.map(({ indexHash }) => indexHash)).size, 1, 'Index hash changed across scenes.');
const fixtureFingerprintsAfter = Object.fromEntries(poseIds.map((poseId) => [poseId, fingerprintFinalPoseV1(fixtures[poseId])]));
assert.deepEqual(fixtureFingerprintsAfter, fixtureFingerprintsBefore, 'A source finalPose fixture was mutated.');
const coreAfter = createRigInvariantSnapshotV1({ rigCore, contract, finalPose: fixtures['reference-t'] });
const coreInvariant = compareRigInvariantSnapshotsV1(coreBefore, coreAfter);
assert.equal(coreInvariant.passed, true, 'HumanRigCore contract changed during audit.');
const glbAfter = readFileSync(assetPath);
const assetSha256After = sha256(glbAfter);
assert.equal(assetSha256After, assetSha256Before, 'Frozen P1.1 GLB changed during audit.');

const assetIdentity = {
  schema: 'humanoid_rig/hybrid_skeleton_p2_asset_identity@1.0',
  assetPath: 'assets/human/production-skeleton-v2/hybrid-static-v1/hybrid-production-skeleton-static-v1.glb',
  expectedSha256: expectedAssetSha256,
  sha256Before: assetSha256Before,
  sha256After: assetSha256After,
  unchanged: assetSha256Before === assetSha256After,
  ...identity,
  geometryHashDefinition: 'SHA256 over ordered POSITION and NORMAL accessor descriptors and bytes',
  indexHashDefinition: 'SHA256 over ordered index accessor descriptors and bytes',
};
const numericSummary = {
  schema: 'humanoid_rig/hybrid_skeleton_p2_numeric_summary@1.0',
  poseIds,
  allScenesPassed: sceneMetrics.every(({ passed }) => passed),
  geometryHashInvariant: new Set(sceneMetrics.map(({ geometryHash }) => geometryHash)).size === 1,
  indexHashInvariant: new Set(sceneMetrics.map(({ indexHash }) => indexHash)).size === 1,
  finalPoseFixturesReadOnly: JSON.stringify(fixtureFingerprintsBefore) === JSON.stringify(fixtureFingerprintsAfter),
  maximumReferenceMatrixDifference,
  coreInvariant,
  sceneMetrics,
};
const moduleMapReceipt = {
  schema: 'humanoid_rig/hybrid_skeleton_p2_module_map_receipt@1.0',
  moduleCount: moduleMap.length,
  modules: moduleMap,
};
const browserManifest = {
  schema: 'humanoid_rig/hybrid_skeleton_p2_browser_capture_manifest@1.0',
  status: 'pending_user_capture',
  reason: 'Repository AGENTS.md reserves computer/browser effect validation for the user.',
  page: 'human-core-v5-production-skeleton-p2-finalpose.html',
  captureScript: 'scripts/capture-task17a3-p2-finalpose.mjs',
  requiredArtifacts: requiredBrowserArtifacts.map((file) => ({ file, status: 'pending_user_capture' })),
  webgl2: 'pending_user_review',
  consoleErrors: 'pending_user_review',
  pageErrors: 'pending_user_review',
};
const visualReview = {
  schema: 'humanoid_rig/hybrid_skeleton_p2_visual_review@1.0',
  status: 'pending_user_review',
  allowedStatuses: ['pass', 'partial', 'fail', 'pending_user_review'],
  items: visualReviewItems.map((criterion, index) => ({ index: index + 1, criterion, status: 'pending_user_review' })),
  conclusion: 'INCONCLUSIVE',
};

writeJson('asset-identity.json', assetIdentity);
writeJson('module-map.json', moduleMapReceipt);
writeJson('six-scene-numeric-summary.json', numericSummary);
writeJson('sequence-continuity.json', sequenceContinuity);
writeJson('browser-capture-manifest.json', browserManifest);
writeJson('visual-review-status.json', visualReview);

console.log(`PASS Task 17A.3 P2 file/numeric audit: ${sceneMetrics.length}/6 scenes; ${moduleMap.length} modules; finalPose read-only; browser evidence pending user capture.`);

function auditSequenceContinuity({ sequencePoseIds: ids, fixtures: poseFixtures, runtime: poseRuntime }) {
  const transitions = [];
  let previousTransforms = null;
  let maximumFrameToFrameModuleJump = 0;
  let maximumFrameToFrameMatrixElementJump = 0;
  for (let transitionIndex = 0; transitionIndex < ids.length - 1; transitionIndex += 1) {
    const fromPoseId = ids[transitionIndex];
    const toPoseId = ids[transitionIndex + 1];
    const fromPose = poseFixtures[fromPoseId];
    const toPose = poseFixtures[toPoseId];
    let transitionJump = 0;
    let transitionMatrixJump = 0;
    for (let frameIndex = 0; frameIndex <= 60; frameIndex += 1) {
      const finalPose = interpolateFinalPoseV1(fromPose, toPose, frameIndex / 60, transitionIndex * 61 + frameIndex);
      const frame = poseRuntime.update(finalPose);
      assert.equal(frame.finalPoseReadOnlyPassed, true);
      assert.equal(frame.transforms.some(({ determinant }) => !(determinant > 0)), false);
      if (previousTransforms) {
        const previousById = new Map(previousTransforms.map((transform) => [transform.moduleId, transform]));
        for (const transform of frame.transforms) {
          const previous = previousById.get(transform.moduleId);
          const jump = Math.hypot(
            transform.currentWorldMatrix[12] - previous.currentWorldMatrix[12],
            transform.currentWorldMatrix[13] - previous.currentWorldMatrix[13],
            transform.currentWorldMatrix[14] - previous.currentWorldMatrix[14],
          );
          const matrixJump = Math.max(...transform.currentWorldMatrix.map((value, index) => Math.abs(value - previous.currentWorldMatrix[index])));
          transitionJump = Math.max(transitionJump, jump);
          transitionMatrixJump = Math.max(transitionMatrixJump, matrixJump);
        }
      }
      previousTransforms = frame.transforms;
    }
    transitions.push({
      fromPoseId, toPoseId,
      sampleCount: 61,
      rootInterpolation: 'independent linear position plus quaternion slerp',
      jointInterpolation: 'finalPose local quaternion slerp',
      maximumFrameToFrameModuleJump: transitionJump,
      maximumFrameToFrameMatrixElementJump: transitionMatrixJump,
    });
    maximumFrameToFrameModuleJump = Math.max(maximumFrameToFrameModuleJump, transitionJump);
    maximumFrameToFrameMatrixElementJump = Math.max(maximumFrameToFrameMatrixElementJump, transitionMatrixJump);
  }
  return {
    schema: 'humanoid_rig/hybrid_skeleton_p2_sequence_continuity@1.0',
    sequencePoseIds: ids,
    samplesPerTransition: 61,
    usesFinalPoseQuaternionInterpolation: true,
    rootChannelInterpolatedIndependently: true,
    usesScale: false,
    writesFinalPose: false,
    maximumFrameToFrameModuleJump,
    maximumFrameToFrameMatrixElementJump,
    transitions,
  };
}

function inspectAssetIdentity(buffer, gltf) {
  const jsonLength = buffer.readUInt32LE(12);
  const binaryOffset = 20 + jsonLength + 8;
  const geometry = createHash('sha256');
  const indices = createHash('sha256');
  let vertexCount = 0;
  let indexCount = 0;
  for (let meshIndex = 0; meshIndex < gltf.meshes.length; meshIndex += 1) {
    const mesh = gltf.meshes[meshIndex];
    for (let primitiveIndex = 0; primitiveIndex < mesh.primitives.length; primitiveIndex += 1) {
      const primitive = mesh.primitives[primitiveIndex];
      for (const semantic of ['POSITION', 'NORMAL']) {
        const accessorIndex = primitive.attributes[semantic];
        const bytes = accessorBytes(buffer, gltf, binaryOffset, accessorIndex);
        geometry.update(`${meshIndex}:${primitiveIndex}:${semantic}:${accessorIndex}:${bytes.length}:`);
        geometry.update(bytes);
        if (semantic === 'POSITION') vertexCount += gltf.accessors[accessorIndex].count;
      }
      const indexAccessorIndex = primitive.indices;
      const indexBytes = accessorBytes(buffer, gltf, binaryOffset, indexAccessorIndex);
      indices.update(`${meshIndex}:${primitiveIndex}:INDEX:${indexAccessorIndex}:${indexBytes.length}:`);
      indices.update(indexBytes);
      indexCount += gltf.accessors[indexAccessorIndex].count;
    }
  }
  return {
    byteSize: buffer.length,
    vertexCount,
    triangleCount: indexCount / 3,
    meshCount: gltf.meshes.length,
    materialCount: gltf.materials.length,
    moduleIds: gltf.nodes.map((node) => node.extras?.moduleId ?? node.name),
    nonIdentityNodeTransformCount: gltf.nodes.filter((node) => node.matrix
      || node.translation || node.rotation || node.scale).length,
    geometryHash: geometry.digest('hex'),
    indexHash: indices.digest('hex'),
  };
}

function accessorBytes(buffer, gltf, binaryOffset, accessorIndex) {
  const accessor = gltf.accessors[accessorIndex];
  const view = gltf.bufferViews[accessor.bufferView];
  const componentBytes = ({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 })[accessor.componentType];
  const components = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 })[accessor.type];
  const start = binaryOffset + Number(view.byteOffset ?? 0) + Number(accessor.byteOffset ?? 0);
  const length = accessor.count * componentBytes * components;
  return buffer.subarray(start, start + length);
}

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function writeJson(file, value) { writeFileSync(resolve(artifactDirectory, file), `${JSON.stringify(value, null, 2)}\n`); }
