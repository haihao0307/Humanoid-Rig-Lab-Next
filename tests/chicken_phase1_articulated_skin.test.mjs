import assert from 'node:assert/strict';
import {
  CHICKEN_PHASE1_BONE_ORDER,
  computeChickenPhase1VertexWeights,
  computeChickenPhase1SkinAttributes,
  detectGeneratedFootMesh,
  summarizeVertexKinds
} from '../runtime/chicken_phase1_articulated_skin.mjs';

const sum = (values) => values.reduce((total, value) => total + value, 0);
const bone = (id) => CHICKEN_PHASE1_BONE_ORDER.indexOf(id);

for (const [position, kind, options] of [
  [[0.39, 0.95, 0.12], 'body', {}],
  [[-0.32, 0.53, 0.09], 'feather', {}],
  [[0, 0.55, 0.20], 'feather', {}],
  [[0, 0.08, 0.14], 'parts', { vertexKind: 3, localCoord: [0.8, 0, 0], generatedFootMesh: true }],
  [[0.40, 0.95, 0.12], 'iris', {}],
  [[0, 0.52, 0.09], 'body', {}]
]) {
  const result = computeChickenPhase1VertexWeights(...position, kind, options);
  assert.equal(result.indices.length, 4);
  assert.equal(result.weights.length, 4);
  assert.ok(Math.abs(sum(result.weights) - 1) < 1e-6);
  assert.ok(result.indices.every((index) => index >= 0 && index < CHICKEN_PHASE1_BONE_ORDER.length));
  assert.ok(result.weights.every((weight) => weight >= 0 && Number.isFinite(weight)));
}

let result = computeChickenPhase1VertexWeights(0.39, 0.95, 0.12, 'body');
assert.equal(result.indices[0], bone('head'));

result = computeChickenPhase1VertexWeights(0.34, 0.62, 0.12, 'body');
assert.notEqual(result.indices[0], bone('head'));
assert.ok(result.indices.includes(bone('chest')) || result.indices.includes(bone('pelvis')));

result = computeChickenPhase1VertexWeights(-0.34, 0.52, 0.12, 'feather');
assert.equal(result.indices[0], bone('tail'));

result = computeChickenPhase1VertexWeights(0, 0.56, 0.20, 'feather');
assert.equal(result.indices[0], bone('wing_l'));

for (const s of [0, 0.18, 0.44, 0.52, 0.76, 1]) {
  result = computeChickenPhase1VertexWeights(0, 0.28 - s * 0.23, 0.14, 'parts', {
    vertexKind: 3,
    localCoord: [s, 0, 0],
    generatedFootMesh: true
  });
  const active = result.weights.filter((weight) => weight > 1e-7).length;
  assert.ok(active <= 2, `kind 3 at s=${s} used ${active} bones`);
  assert.ok(result.indices.every((index) => [bone('hip_l'), bone('knee_l'), bone('ankle_l'), 0].includes(index)));
}

for (const [x, s] of [[0.006, 0.05], [0.04, 0.45], [0.10, 0.92]]) {
  result = computeChickenPhase1VertexWeights(x, 0.02, 0.14, 'parts', {
    vertexKind: 4,
    localCoord: [s, 0, 0],
    generatedFootMesh: true
  });
  assert.ok(result.indices.every((index) => [bone('ankle_l'), bone('toe_l'), 0].includes(index)));
  assert.ok(!result.indices.includes(bone('hip_l')));
  assert.ok(!result.indices.includes(bone('knee_l')));
}

result = computeChickenPhase1VertexWeights(0.12, 0.01, 0.14, 'parts', {
  vertexKind: 5,
  localCoord: [0.8, 0, 0],
  generatedFootMesh: true
});
assert.equal(result.indices[0], bone('toe_l'));
assert.equal(result.weights[0], 1);

const positions = new Float32Array([
  0, 0.30, 0.14,
  0, 0.12, 0.14,
  0.09, 0.02, 0.14,
  0.12, 0.01, 0.14
]);
const attributes = computeChickenPhase1SkinAttributes(positions, 'parts', {
  vertexKinds: new Float32Array([3, 3, 4, 5]),
  generatedFootMesh: true,
  localCoords: new Float32Array([
    0.05, 0, 0,
    0.72, 0, 0,
    0.86, 0, 0,
    0.92, 0, 0
  ])
});
assert.equal(attributes.count, 4);
assert.equal(attributes.indices.length, 16);
assert.equal(attributes.weights.length, 16);
for (let vertex = 0; vertex < 4; vertex++) {
  assert.ok(Math.abs(sum([...attributes.weights.slice(vertex * 4, vertex * 4 + 4)]) - 1) < 1e-6);
}
assert.equal(attributes.indices[12], bone('toe_l'));
assert.ok(attributes.primaryCounts[bone('toe_l')] >= 1);
assert.throws(() => computeChickenPhase1SkinAttributes(new Float32Array([1, 2]), 'body'));

assert.ok(CHICKEN_PHASE1_BONE_ORDER.includes('neck_base'));
assert.equal(CHICKEN_PHASE1_BONE_ORDER.length, 18);

result = computeChickenPhase1VertexWeights(0.02, 0.28, 0.12, 'body');
assert.ok(!result.indices.includes(bone('hip_l')));
assert.ok(!result.indices.includes(bone('knee_l')));
assert.ok(!result.indices.includes(bone('hip_r')));
assert.ok(!result.indices.includes(bone('knee_r')));

const generatedKinds = new Float32Array([3, 3, 4, 4, 5]);
const genericKinds = new Float32Array([0, 1, 2, 3, 4, 5, 6]);
const coords = new Float32Array(generatedKinds.length * 3);
assert.equal(detectGeneratedFootMesh('parts', generatedKinds, coords), true);
assert.equal(detectGeneratedFootMesh('parts', genericKinds, new Float32Array(genericKinds.length * 3)), false);
assert.equal(detectGeneratedFootMesh('body', generatedKinds, coords), false);
assert.deepEqual(summarizeVertexKinds(generatedKinds), { 3: 2, 4: 2, 5: 1 });

result = computeChickenPhase1VertexWeights(0.39, 0.95, 0.12, 'parts', {
  vertexKind: 3,
  localCoord: [0.8, 0, 0],
  generatedFootMesh: false
});
assert.equal(result.indices[0], bone('head'));

console.log('Chicken Phase 1 articulated skin weight tests passed.');
