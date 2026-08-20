import assert from 'node:assert/strict';
import { __surfaceTestUtils } from '../src/smpl-skin.js';

const {
  deformSurfaceLbs,
  deformSurfaceDqs,
  writeFourStrongestInfluences,
  selectWeightCandidates,
  isRestPose,
  translationTimesQuaternion,
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

console.log('V8.4 native LBS sampling, transitional weight regression, bind-pose protection, and four-influence normalization passed.');
