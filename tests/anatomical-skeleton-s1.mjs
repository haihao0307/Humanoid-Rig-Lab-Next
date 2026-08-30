import assert from 'node:assert/strict';
import { runAnatomicalSkeletonQa } from '../tools/anatomical-skeleton-v1/qa-anatomical-skeleton.mjs';

const result = await runAnatomicalSkeletonQa({ writeArtifacts: false, createReviewPackage: false });
assert.equal(result.passed, true);
assert.equal(result.graphAudit.passed, true);
assert.equal(result.binaryRoundtripAudit.passed, true);
assert.equal(result.geometryAudit.passed, true);
assert.equal(result.deterministicReplay.passed, true);
assert.equal(result.variantAudit.passed, true);
assert.equal(result.sourceAudit.passed, true);
assert.equal(result.policyAudit.passed, true);
assert.equal(result.femurS1A3Audit.passed, true);
assert.equal(result.finalStatus.visualAcceptance, false);
assert.equal(result.finalStatus.productionReady, false);
assert.equal(result.finalStatus.userVisualAcceptance, 'pending');

console.log('Anatomical Skeleton S1: contracts, graph, geometry, variants, determinism, sources, and policy gates passed.');
