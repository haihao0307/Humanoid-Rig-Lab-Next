import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseGlbMesh, parseGlbSkin } from '../src/glb-geometry.js';

const sourceAssetUrl = new URL('../assets/smpl/smpl-male-surface.glb', import.meta.url);
const skinnedAssetUrl = new URL('../assets/smpl/smpl-male-surface-skinned.glb', import.meta.url);
const metadataUrl = new URL('../assets/smpl/SKIN_BINDING_METADATA.json', import.meta.url);
const sourceBytes = await readFile(sourceAssetUrl);
const skinnedBytes = await readFile(skinnedAssetUrl);
const bindingMetadata = JSON.parse(await readFile(metadataUrl, 'utf8'));

assert.equal(sourceBytes.byteLength, 1_435_300);
assert.equal(skinnedBytes.byteLength, 2_104_780);

const sourceBuffer = sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength);
const skinnedBuffer = skinnedBytes.buffer.slice(skinnedBytes.byteOffset, skinnedBytes.byteOffset + skinnedBytes.byteLength);
const sourceMesh = parseGlbMesh(sourceBuffer);
const skinnedMesh = parseGlbSkin(skinnedBuffer);

for (const mesh of [sourceMesh, skinnedMesh]) {
  assert.equal(mesh.mode, 4);
  assert.equal(mesh.vertexCount, 27_578);
  assert.equal(mesh.triangleCount, 55_152);
  assert.equal(mesh.attributes.position.itemSize, 3);
  assert.equal(mesh.attributes.position.count, 27_578);
  assert.equal(mesh.attributes.normal.itemSize, 3);
  assert.equal(mesh.attributes.normal.count, 27_578);
  assert.equal(mesh.attributes.color.itemSize, 4);
  assert.equal(mesh.attributes.color.count, 27_578);
  assert.equal(mesh.attributes.color.normalized, true);
  assert.equal(mesh.index.itemSize, 1);
  assert.equal(mesh.index.count, 165_456);
  assert.ok(mesh.index.array instanceof Uint32Array);
}

assert.equal(skinnedMesh.attributes.skinIndex.itemSize, 4);
assert.equal(skinnedMesh.attributes.skinIndex.count, 27_578);
assert.equal(skinnedMesh.attributes.skinIndex.componentType, 5123);
assert.ok(skinnedMesh.attributes.skinIndex.array instanceof Uint16Array);
assert.equal(skinnedMesh.attributes.skinWeight.itemSize, 4);
assert.equal(skinnedMesh.attributes.skinWeight.count, 27_578);
assert.equal(skinnedMesh.attributes.skinWeight.componentType, 5126);
assert.ok(skinnedMesh.attributes.skinWeight.array instanceof Float32Array);
assert.equal(skinnedMesh.skin.inverseBindMatrices.itemSize, 16);
assert.equal(skinnedMesh.skin.inverseBindMatrices.count, 24);
assert.equal(skinnedMesh.skin.joints.length, 24);
assert.equal(skinnedMesh.skin.jointIds.length, 24);
assert.equal(skinnedMesh.skin.joints.filter((joint) => joint.parentId == null).length, 1);
assert.equal(skinnedMesh.skin.joints.find((joint) => joint.parentId == null)?.id, 'hips');
assert.equal(skinnedMesh.skinValidation.native, true);
assert.equal(skinnedMesh.skinValidation.jointCount, 24);
assert.equal(skinnedMesh.skinValidation.maxJointIndex, 23);
assert.ok(skinnedMesh.skinValidation.maxWeightSumError < 1e-6);
assert.ok(skinnedMesh.skinValidation.minWeightSum > 0.999999);
assert.ok(skinnedMesh.skinValidation.maxWeightSum < 1.000001);

const expectedJointIds = [
  'hips',
  'leftUpperLeg', 'rightUpperLeg',
  'spine',
  'leftLowerLeg', 'rightLowerLeg',
  'chest',
  'leftFoot', 'rightFoot',
  'upperChest',
  'leftToes', 'rightToes',
  'neck',
  'leftShoulder', 'rightShoulder',
  'head',
  'leftUpperArm', 'rightUpperArm',
  'leftLowerArm', 'rightLowerArm',
  'leftHand', 'rightHand',
  'leftHandEnd', 'rightHandEnd',
];
assert.deepEqual(skinnedMesh.skin.jointIds, expectedJointIds);
assert.equal(skinnedMesh.skin.extras.rigProfile, 'smpl24-controls28@rig-0.4.0');
assert.equal(skinnedMesh.skin.extras.weightStatus, 'experimental-transitional');
assert.equal(skinnedMesh.metadata.extras.humanoidRigLab.productionReady, false);
assert.deepEqual(
  skinnedMesh.metadata.extras.humanoidRigLab.nativeAttributes,
  ['JOINTS_0', 'WEIGHTS_0'],
);
assert.equal(skinnedMesh.metadata.extras.humanoidRigLab.inverseBindMatrices, true);
assert.equal(
  skinnedMesh.metadata.extras.humanoidRigLab.sourceSha256,
  '68ae60197947ae4581bfd7066b34117d4a3cf7f488b9f676d0ea7fba98a25f03',
);

const expectedMin = [-0.4785889983177185, -0.006508999969810247, -0.12898600101470947];
const expectedMax = [0.4809800088405609, 1.7891629934310913, 0.2125370055437088];
for (let axis = 0; axis < 3; axis += 1) {
  assert.ok(Math.abs(skinnedMesh.attributes.position.min[axis] - expectedMin[axis]) < 1e-8);
  assert.ok(Math.abs(skinnedMesh.attributes.position.max[axis] - expectedMax[axis]) < 1e-8);
}

assert.deepEqual(
  Array.from(sourceMesh.attributes.position.array),
  Array.from(skinnedMesh.attributes.position.array),
  'The transitional bind must preserve every source surface vertex.',
);
assert.deepEqual(
  Array.from(sourceMesh.index.array),
  Array.from(skinnedMesh.index.array),
  'The transitional bind must preserve source topology.',
);

for (const attribute of Object.values(skinnedMesh.attributes)) {
  const values = attribute.decodedArray ?? attribute.array;
  const stride = Math.max(1, Math.floor(values.length / 997));
  for (let index = 0; index < values.length; index += stride) {
    assert.ok(Number.isFinite(values[index]), 'GLB contains a non-finite attribute value.');
  }
}
for (const value of skinnedMesh.skin.inverseBindMatrices.array) {
  assert.ok(Number.isFinite(value), 'GLB contains a non-finite inverse bind matrix value.');
}

const sourceDigest = createHash('sha256').update(sourceBytes).digest('hex');
const skinnedDigest = createHash('sha256').update(skinnedBytes).digest('hex');
assert.equal(sourceDigest, '68ae60197947ae4581bfd7066b34117d4a3cf7f488b9f676d0ea7fba98a25f03');
assert.equal(skinnedDigest, '736cb39c828203eae72f5e5d094f1623c0a4465a31b484737a6e8df02a7ec899');
assert.equal(bindingMetadata.schema, 'humanoid_rig/skin_binding_metadata@1.0');
assert.equal(bindingMetadata.asset, 'smpl-male-surface-skinned.glb');
assert.equal(bindingMetadata.compatibleRig, 'rig@0.4.0');
assert.equal(bindingMetadata.assetSha256, skinnedDigest);
assert.equal(bindingMetadata.sourceSha256, sourceDigest);
assert.equal(bindingMetadata.vertexCount, skinnedMesh.vertexCount);
assert.equal(bindingMetadata.triangleCount, skinnedMesh.triangleCount);
assert.deepEqual(bindingMetadata.jointIds, skinnedMesh.skin.jointIds);
assert.equal(bindingMetadata.inverseBindMatrices.count, skinnedMesh.skin.inverseBindMatrices.count);
assert.equal(bindingMetadata.weights.productionReady, false);

console.log('V8.4 native skinned GLB topology, JOINTS_0, WEIGHTS_0, inverse-bind matrices, and checksums passed.');
