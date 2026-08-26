import assert from 'node:assert/strict';
import {
  HumanCoreRuntime,
  ProceduralDeformRuntimeV5,
  assertProceduralSurfaceDeformationQualityGateV5,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
  findSurfaceSelfIntersectionsV5,
} from '../src/modules/human-core-v5/index.js';

const bodyDNA = createBodyDNA({
  bodyDNAId: 'procedural-self-intersection',
  identity: { humanId: 'procedural-self-intersection' },
  proportionRevision: 14,
});
const human = new HumanCoreRuntime();
human.createHuman(bodyDNA);
const rigCore = human.getRigCore();
const runtime = new ProceduralDeformRuntimeV5();
runtime.compileHuman({ bodyDNA, rigCore });
await runtime.generateCanonicalSurface({ resolution: 36, worker: false });

const poseIds = [
  't-pose',
  'arm-raise-150-left',
  'forearm-twist-180-left',
  'elbow-bend-140-left',
  'hip-flex-left',
  'knee-bend-left',
  'squat',
  'lunge-left',
];
const results = {};
for (const poseId of poseIds) {
  const pose = createProceduralDeformValidationPoseV5({ poseId, rigCore, bodyDNA, timestamp: 1 });
  human.updatePose(pose);
  runtime.update({ finalPose: pose, anatomyState: human.getAnatomyState() });
  const diagnostics = runtime.analyzeCurrentDeformationQuality();
  results[poseId] = {
    selfIntersectionPairCount: diagnostics.selfIntersectionPairCount,
    criticalRegionSelfIntersectionCount: diagnostics.criticalRegionSelfIntersectionCount,
    broadPhasePairCount: diagnostics.broadPhasePairCount,
  };
  assert.equal(diagnostics.selfIntersectionPairCount, 0, `${poseId} contains a surface self-intersection.`);
  assert.equal(diagnostics.criticalRegionSelfIntersectionCount, 0, `${poseId} contains a critical-region self-intersection.`);
  assert.doesNotThrow(() => assertProceduralSurfaceDeformationQualityGateV5(diagnostics));
}

const crossingFixture = findSurfaceSelfIntersectionsV5({
  positions: new Float32Array([
    -1, -1, 0,
     1, -1, 0,
     0,  1, 0,
     0, -0.5, -1,
     0, -0.5,  1,
     0,  0.5,  0.5,
  ]),
  indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
});
assert.equal(crossingFixture.selfIntersectionPairCount, 1, 'The narrow phase must detect a non-adjacent crossing triangle pair.');
assert.deepEqual(crossingFixture.pairs.map(({ leftTriangle, rightTriangle }) => [leftTriangle, rightTriangle]), [[0, 1]]);

const adjacentFixture = findSurfaceSelfIntersectionsV5({
  positions: new Float32Array([
    -1, -1, 0,
     1, -1, 0,
     0,  1, 0,
     0, -0.5, 1,
  ]),
  indices: new Uint32Array([0, 1, 2, 0, 1, 3]),
});
assert.equal(adjacentFixture.selfIntersectionPairCount, 0, 'Triangles sharing an edge must be excluded from self-intersection results.');

const isolatedPointContact = findSurfaceSelfIntersectionsV5({
  positions: new Float32Array([
    -1, -1, 0,
     1, -1, 0,
     0,  1, 0,
     0,  0.9999997, -1,
     0,  0.9999997,  1,
     0,  3,  1,
  ]),
  indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
});
assert.equal(isolatedPointContact.rawContactCount, 1, 'A strict raw point contact must remain available for truth auditing.');
assert.equal(isolatedPointContact.penetratingIntersectionCount, 0, 'An isolated point contact must not be classified as penetrating.');
assert.equal(isolatedPointContact.classifiedContacts[0].intersectionType, 'numeric-uncertainty');

assert.equal(crossingFixture.rawContactCount, 1);
assert.equal(crossingFixture.penetratingIntersectionCount, 1);
assert.equal(crossingFixture.classifiedContacts[0].intersectionType, 'penetrating');

console.log(JSON.stringify(results));
console.log('Human Core V5 procedural self-intersection: key poses and deterministic broad/narrow phase gates passed.');
