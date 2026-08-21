import assert from 'node:assert/strict';
import { __surfaceTestUtils } from '../src/smpl-skin.js';
import { EXPERIMENTAL_DQS_RENDERER, ExperimentalDqsRenderer } from '../src/experimental-dqs-renderer.js';

const {
  deformSurfaceLbs,
  deformSurfaceDqs,
  writeFourStrongestInfluences,
  selectWeightCandidates,
  isRestPose,
  translationTimesQuaternion,
  skinMatricesToDualQuaternions,
  buildPoseCorrectiveFields,
  applyPoseCorrectiveFields,
} = __surfaceTestUtils;

{
  const restPositions = new Float32Array([1, 2, 3, -2, 0.5, 4]);
  const outputPositions = new Float32Array(restPositions.length);
  const skinIndices = new Uint16Array([0, 0, 0, 0, 1, 0, 0, 0]);
  const skinWeights = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0]);
  const skinMatrices = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0.5, -0.25, 1, 1,
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    -1, 2, 0.25, 1,
  ]);
  deformSurfaceLbs(restPositions, outputPositions, skinIndices, skinWeights, skinMatrices);
  assert.deepEqual(
    [...outputPositions].map((value) => Number(value.toFixed(6))),
    [1.5, 1.75, 4, -3, 2.5, 4.25],
  );
}

{
  const influences = new Float64Array([0.2, 0.8, 0.5, 0]);
  const touched = new Uint8Array([1, 1, 1, 0]);
  const indices = new Uint16Array(4);
  const weights = new Float32Array(4);
  writeFourStrongestInfluences(influences, touched, indices, weights, 0, 0);
  assert.deepEqual([...indices], [1, 2, 0, 0]);
  assert.ok(Math.abs(weights[0] + weights[1] + weights[2] + weights[3] - 1) < 1e-6);
  assert.ok(weights[0] > weights[1] && weights[1] > weights[2]);
}

{
  const restPositions = new Float32Array([1, 2, 3]);
  const restNormals = new Float32Array([0, 1, 0]);
  const outputPositions = new Float32Array(3);
  const outputNormals = new Float32Array(3);
  const skinIndices = new Uint16Array([0, 0, 0, 0]);
  const skinWeights = new Float32Array([1, 0, 0, 0]);
  const dual = translationTimesQuaternion(0.5, -0.25, 1, 0, 0, 0, 1);
  const transforms = new Float32Array([0, 0, 0, 1, ...dual]);
  deformSurfaceDqs(
    restPositions,
    restNormals,
    outputPositions,
    outputNormals,
    skinIndices,
    skinWeights,
    transforms,
  );
  assert.deepEqual([...outputPositions].map((value) => Number(value.toFixed(6))), [1.5, 1.75, 4]);
  assert.deepEqual([...outputNormals].map((value) => Number(value.toFixed(6))), [0, 1, 0]);
}

{
  const root = Math.sqrt(0.5);
  const restPositions = new Float32Array([1, 0, 0]);
  const restNormals = new Float32Array([1, 0, 0]);
  const outputPositions = new Float32Array(3);
  const outputNormals = new Float32Array(3);
  const skinIndices = new Uint16Array([0, 0, 0, 0]);
  const skinWeights = new Float32Array([1, 0, 0, 0]);
  const transforms = new Float32Array([0, 0, root, root, 0, 0, 0, 0]);
  deformSurfaceDqs(
    restPositions,
    restNormals,
    outputPositions,
    outputNormals,
    skinIndices,
    skinWeights,
    transforms,
  );
  assert.ok(Math.abs(outputPositions[0]) < 1e-6);
  assert.ok(Math.abs(outputPositions[1] - 1) < 1e-6);
  assert.ok(Math.abs(outputNormals[0]) < 1e-6);
  assert.ok(Math.abs(outputNormals[1] - 1) < 1e-6);
}

{
  const restPositions = new Float32Array([1, 0, 0]);
  const restNormals = new Float32Array([1, 0, 0]);
  const skinIndices = new Uint16Array([0, 0, 0, 0]);
  const skinWeights = new Float32Array([1, 0, 0, 0]);
  const skinMatrices = new Float32Array([
    0, 1, 0, 0,
    -1, 0, 0, 0,
    0, 0, 1, 0,
    0.5, 0.25, 0, 1,
  ]);
  const dualQuaternions = skinMatricesToDualQuaternions(skinMatrices);
  const lbsPositions = new Float32Array(3);
  const dqsPositions = new Float32Array(3);
  const dqsNormals = new Float32Array(3);
  deformSurfaceLbs(restPositions, lbsPositions, skinIndices, skinWeights, skinMatrices);
  deformSurfaceDqs(
    restPositions,
    restNormals,
    dqsPositions,
    dqsNormals,
    skinIndices,
    skinWeights,
    dualQuaternions,
  );
  assert.deepEqual([...lbsPositions].map((value) => Number(value.toFixed(6))), [0.5, 1.25, 0]);
  assert.deepEqual(
    [...dqsPositions].map((value) => Number(value.toFixed(6))),
    [...lbsPositions].map((value) => Number(value.toFixed(6))),
  );
  assert.equal(EXPERIMENTAL_DQS_RENDERER.defaultRenderer, false);
  assert.equal(EXPERIMENTAL_DQS_RENDERER.defaultSkinningMode, 'lbs');
  assert.throws(() => new ExperimentalDqsRenderer().deform({
    restPositions,
    restNormals,
    skinIndices,
    skinWeights,
    boneTransforms: skinMatrices,
  }), /explicitly enabled/);
  const experimental = new ExperimentalDqsRenderer({ enabled: true }).deform({
    restPositions,
    restNormals,
    skinIndices,
    skinWeights,
    boneTransforms: skinMatrices,
  });
  assert.deepEqual(
    [...experimental.positions].map((value) => Number(value.toFixed(6))),
    [...dqsPositions].map((value) => Number(value.toFixed(6))),
  );
}

{
  const basePositions = new Float32Array([
    0.5, 0, 0,
    -0.5, 0, 0,
    0, 0, 0.5,
    1.2, 0, 0,
  ]);
  const bindPoints = new Map([
    ['joint', { x: 0, y: 0, z: 0 }],
    ['child', { x: 0, y: 1, z: 0 }],
  ]);
  const fields = buildPoseCorrectiveFields(basePositions, bindPoints, [{
    id: 'volume', category: 'test', jointId: 'joint', childId: 'child',
    parentSpan: 1, childSpan: 1, radius: 1, radialGain: 0.2,
  }]);
  assert.equal(fields.length, 1);
  assert.equal(fields[0].indices.length, 3);
  const inactive = new Float32Array(basePositions.length);
  const inactiveStats = applyPoseCorrectiveFields(
    basePositions,
    inactive,
    fields,
    new Map([['volume', 0]]),
  );
  assert.deepEqual([...inactive], [...basePositions]);
  assert.equal(inactiveStats.correctedVertexCount, 0);
  const active = new Float32Array(basePositions.length);
  const activeStats = applyPoseCorrectiveFields(
    basePositions,
    active,
    fields,
    new Map([['volume', 1]]),
  );
  assert.ok(active[0] > basePositions[0]);
  assert.ok(active[3] < basePositions[3]);
  assert.ok(active[8] > basePositions[8]);
  assert.equal(active[9], basePositions[9]);
  assert.equal(activeStats.activeRegionCount, 1);
  assert.equal(activeStats.correctedVertexCount, 3);
  assert.equal(activeStats.outwardCorrectionSampleCount, 3);
}

{
  const chains = ['torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'].map((name) => ({ name }));
  const chest = selectWeightCandidates(0.05, 1.30, 0, chains).map((item) => item.chain.name);
  assert.ok(chest.includes('torso'));
  assert.ok(!chest.includes('rightArm'));
  const leftWrist = selectWeightCandidates(-0.43, 0.90, 0.12, chains).map((item) => item.chain.name);
  assert.ok(leftWrist.includes('leftArm'));
  assert.ok(!leftWrist.includes('rightArm'));
  const leftShin = selectWeightCandidates(-0.14, 0.28, 0, chains).map((item) => item.chain.name);
  assert.deepEqual(leftShin, ['leftLeg']);
}

{
  const rest = new Map([['hips', { x: 0, y: 1, z: 0 }], ['head', { x: 0, y: 2, z: 0 }]]);
  const same = new Map([['hips', { x: 0, y: 1, z: 0 }], ['head', { x: 0, y: 2, z: 0 }]]);
  const changed = new Map([['hips', { x: 0, y: 1, z: 0 }], ['head', { x: 0.01, y: 2, z: 0 }]]);
  assert.equal(isRestPose(rest, same, ['hips', 'head']), true);
  assert.equal(isRestPose(rest, changed, ['hips', 'head']), false);
}

console.log('V8.5 native LBS, DQS reference conversion, sparse pose correctives, bind-pose protection, and four-influence normalization passed.');
