import assert from 'node:assert/strict';
import {
  BodyFieldCompilerV5,
  analyzeSurfaceOrientationV5,
  assertSurfaceOrientationGateV5,
  createBodyDNA,
  createHumanRigCoreV5,
  extractStableProceduralSurfaceV5,
  orientTrianglesOutwardV5,
} from '../src/modules/human-core-v5/index.js';

const bodyDNA = createBodyDNA({
  bodyDNAId: 'procedural-surface-orientation',
  identity: { humanId: 'procedural-surface-orientation' },
  proportionRevision: 14,
});
const rigCore = createHumanRigCoreV5({ bodyDNA });
const field = new BodyFieldCompilerV5().compile({ bodyDNA, rigCore });
const surface = extractStableProceduralSurfaceV5(field, { resolution: 36, timestamp: 1 });
const diagnostics = analyzeSurfaceOrientationV5({
  positions: surface.positions,
  normals: surface.normals,
  indices: surface.indices,
  field,
});

assert.doesNotThrow(() => assertSurfaceOrientationGateV5(diagnostics));
assert.equal(diagnostics.inconsistentSharedEdgeCount, 0);
assert.equal(diagnostics.inwardFacingTriangleCount, 0);
assert.equal(diagnostics.nonManifoldEdgeCount, 0);
assert.equal(diagnostics.boundaryEdgeCount, 0);
assert.ok(diagnostics.signedVolume > 0);
assert.ok(diagnostics.faceGradientAlignmentMean >= 0.95);
assert.ok(diagnostics.faceVertexNormalAlignmentMean >= 0.85);

const generated = surface.metadata.generationDiagnostics.orientation;
assert.equal(generated.inconsistentSharedEdgeCount, diagnostics.inconsistentSharedEdgeCount);
assert.equal(generated.inwardFacingTriangleCount, diagnostics.inwardFacingTriangleCount);
assert.equal(generated.nonManifoldEdgeCount, diagnostics.nonManifoldEdgeCount);
assert.ok(generated.signedVolume > 0);
assert.ok(generated.faceGradientAlignmentMean >= 0.95);

const invertedIndices = new Uint32Array(surface.indices);
for (let offset = 0; offset < invertedIndices.length; offset += 3) {
  const temporary = invertedIndices[offset + 1];
  invertedIndices[offset + 1] = invertedIndices[offset + 2];
  invertedIndices[offset + 2] = temporary;
}
const inverted = analyzeSurfaceOrientationV5({
  positions: surface.positions,
  normals: surface.normals,
  indices: invertedIndices,
  field,
});
assert.ok(inverted.signedVolume < 0, 'The deliberately inverted fixture must have negative signed volume.');
assert.equal(inverted.inwardFacingTriangleCount, surface.indices.length / 3);

const repaired = orientTrianglesOutwardV5({ positions: surface.positions, indices: invertedIndices, field });
assert.doesNotThrow(() => assertSurfaceOrientationGateV5(repaired.diagnostics));
assert.deepEqual(repaired.indices, surface.indices, 'Orientation repair must deterministically recover the canonical winding.');

const repeated = extractStableProceduralSurfaceV5(field, { resolution: 36, timestamp: 2 });
assert.equal(repeated.metadata.topologyFingerprint, surface.metadata.topologyFingerprint);
assert.deepEqual(repeated.indices, surface.indices);
assert.deepEqual(repeated.positions, surface.positions);

console.log(JSON.stringify({
  triangleCount: surface.indices.length / 3,
  signedVolume: diagnostics.signedVolume,
  faceGradientAlignmentMinimum: diagnostics.faceGradientAlignmentMinimum,
  faceGradientAlignmentMean: diagnostics.faceGradientAlignmentMean,
  gradientOpposedTriangleCount: diagnostics.gradientOpposedTriangleCount,
}));
console.log('Human Core V5 procedural surface orientation: deterministic outward winding and strict orientation gate passed.');
