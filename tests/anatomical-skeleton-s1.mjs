import assert from 'node:assert/strict';
import { runAnatomicalSkeletonQa } from '../tools/anatomical-skeleton-v1/qa-anatomical-skeleton.mjs';
import { assertIndependentDistalMetricDefinitions } from '../tools/anatomical-skeleton-v1/qa-femur-s1a4.mjs';

const duplicatedDefinition = {
  metricId: 'fixture.duplicated.v1',
  formula: 'distance(point_a, point_b)',
  pointSetIds: ['point_a', 'point_b'],
};
assert.throws(
  () => assertIndependentDistalMetricDefinitions(duplicatedDefinition, { ...duplicatedDefinition }),
  /must be independent/,
  'The negative fixture must fail when condylar separation and notch width reuse the same ID, formula, and points.',
);

const result = await runAnatomicalSkeletonQa({ writeArtifacts: false, createReviewPackage: false });
assert.equal(result.passed, true);
assert.equal(result.graphAudit.passed, true);
assert.equal(result.binaryRoundtripAudit.passed, true);
assert.equal(result.geometryAudit.passed, true);
assert.equal(result.deterministicReplay.passed, true);
assert.equal(result.variantAudit.passed, true);
assert.equal(result.sourceAudit.passed, true);
assert.equal(result.policyAudit.passed, true);
assert.equal(result.femurS1A4Audit.passed, true);
assert.equal(result.finalStatus.visualAcceptance, false);
assert.equal(result.finalStatus.productionReady, false);
assert.equal(result.finalStatus.userVisualAcceptance, 'pending');

console.log('Anatomical Skeleton S1: contracts, graph, geometry, variants, determinism, sources, and policy gates passed.');
