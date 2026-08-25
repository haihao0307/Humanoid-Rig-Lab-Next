import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ChunkedProceduralHumanAdapterV5,
  PROCEDURAL_HUMAN_SOFTWARE_BUFFER_LIMIT_V5,
  ThreeProceduralHumanAdapterV5,
  shouldUseChunkedProceduralHumanAdapterV5,
} from '../src/renderers/three/three-procedural-human-adapter-v5.js';
import { RENDERER_ADAPTER_INPUT_V5_SCHEMA } from '../src/modules/human-core-v5/procedural-deform/procedural-deform-frame-v5.js';

const input = createRendererInput(5_002);
const single = new ThreeProceduralHumanAdapterV5();
single.update(input);
const singlePosition = single.geometry.getAttribute('position');
const singleNormal = single.geometry.getAttribute('normal');
assert.equal(single.material.side, THREE.FrontSide);
assert.equal(singlePosition.usage, THREE.DynamicDrawUsage);
assert.equal(singleNormal.usage, THREE.DynamicDrawUsage);
const next = cloneInputWithPositionDelta(input, 0.125);
single.update(next);
assert.equal(single.geometry.getAttribute('position'), singlePosition, 'The single-mesh path must retain its BufferAttribute object for stable topology.');
assert.equal(single.geometry.getAttribute('normal'), singleNormal, 'The single-mesh path must retain its normal BufferAttribute object.');
assert.equal(singlePosition.array[0], next.positions[0]);
assert.ok(singlePosition.updateRanges.some((range) => range.start === 0 && range.count === next.positions.length));
single.setDisplayMode('orientation-diagnostic');
assert.equal(single.material.side, THREE.DoubleSide);
single.setDisplayMode('surface');
assert.equal(single.material.side, THREE.FrontSide);

const chunked = new ChunkedProceduralHumanAdapterV5();
chunked.update(input);
const diagnostics = chunked.getDiagnostics();
assert.ok(diagnostics.chunkCount > 1, 'The fallback adapter fixture must be partitioned into multiple renderer chunks.');
assert.equal(diagnostics.vertexCount, input.positions.length / 3);
assert.equal(diagnostics.triangleCount, input.indices.length / 3);
assert.equal(diagnostics.logicalSurfaceLayerCount, 1);
assert.equal(chunked.getObject3D().name, 'HumanCoreV5ProceduralSurface');
assert.ok(diagnostics.maximumBufferByteLength <= PROCEDURAL_HUMAN_SOFTWARE_BUFFER_LIMIT_V5);
assert.ok(diagnostics.duplicatedBoundaryVertexCount > 0, 'Chunk boundaries must explicitly duplicate shared global vertices.');
for (const chunk of chunked.chunks) {
  assert.ok(chunk.geometry.getAttribute('position').array.byteLength <= PROCEDURAL_HUMAN_SOFTWARE_BUFFER_LIMIT_V5);
  assert.ok(chunk.geometry.getAttribute('normal').array.byteLength <= PROCEDURAL_HUMAN_SOFTWARE_BUFFER_LIMIT_V5);
  assert.ok(chunk.geometry.index.array.byteLength <= PROCEDURAL_HUMAN_SOFTWARE_BUFFER_LIMIT_V5);
  assert.ok(chunk.geometry.index.array instanceof Uint16Array);
  assert.equal(chunk.geometry.getAttribute('position').usage, THREE.DynamicDrawUsage);
  assert.equal(chunk.geometry.getAttribute('normal').usage, THREE.DynamicDrawUsage);
  for (let localVertex = 0; localVertex < chunk.globalVertexIndices.length; localVertex += 1) {
    const globalVertex = chunk.globalVertexIndices[localVertex];
    for (let axis = 0; axis < 3; axis += 1) {
      assert.equal(chunk.geometry.getAttribute('position').array[localVertex * 3 + axis], input.positions[globalVertex * 3 + axis]);
      assert.equal(chunk.geometry.getAttribute('normal').array[localVertex * 3 + axis], input.normals[globalVertex * 3 + axis]);
    }
  }
}
const chunkPositionAttributes = chunked.chunks.map((chunk) => chunk.geometry.getAttribute('position'));
chunked.update(next);
assert.deepEqual(chunked.chunks.map((chunk) => chunk.geometry.getAttribute('position')), chunkPositionAttributes);
for (const chunk of chunked.chunks) {
  for (let localVertex = 0; localVertex < chunk.globalVertexIndices.length; localVertex += 1) {
    const globalVertex = chunk.globalVertexIndices[localVertex];
    assert.equal(chunk.geometry.getAttribute('position').array[localVertex * 3], next.positions[globalVertex * 3]);
  }
}

assert.equal(shouldUseChunkedProceduralHumanAdapterV5({ isFallbackAdapter: true }), true);
assert.equal(shouldUseChunkedProceduralHumanAdapterV5({ description: 'Google SwiftShader' }), true);
assert.equal(shouldUseChunkedProceduralHumanAdapterV5({ vendor: 'NVIDIA', isFallbackAdapter: false }), false);

single.dispose();
chunked.dispose();
console.log(JSON.stringify(diagnostics));
console.log('Human Core V5 procedural renderer adapter: FrontSide, stable dynamic attributes, and software-safe chunk uploads passed.');

function createRendererInput(vertexCount) {
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const regionIds = new Uint16Array(vertexCount * 4);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    positions.set([vertex * 0.001, (vertex % 17) * 0.002, (vertex % 13) * 0.003], vertex * 3);
    normals.set([0, 1, 0], vertex * 3);
  }
  const indices = new Uint32Array((vertexCount - 2) * 3);
  for (let triangle = 0; triangle < vertexCount - 2; triangle += 1) indices.set([triangle, triangle + 1, triangle + 2], triangle * 3);
  return {
    schema: RENDERER_ADAPTER_INPUT_V5_SCHEMA,
    topologyFingerprint: 'renderer-adapter-fixture-v1',
    positions,
    normals,
    indices,
    regionIds,
  };
}

function cloneInputWithPositionDelta(input, delta) {
  const positions = new Float32Array(input.positions);
  for (let offset = 0; offset < positions.length; offset += 3) positions[offset] += delta;
  return { ...input, positions };
}
