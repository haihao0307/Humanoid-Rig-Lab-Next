import assert from 'node:assert/strict';
import {
  HumanCoreRuntime,
  ProceduralDeformRuntimeV5,
  assertProceduralSurfaceDeformationQualityGateV5,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
} from '../src/modules/human-core-v5/index.js';

const dna = createBodyDNA({
  bodyDNAId: 'procedural-joint-quality',
  identity: { humanId: 'procedural-joint-quality' },
  proportionRevision: 14,
});
const human = new HumanCoreRuntime();
human.createHuman(dna);
const rigCore = human.getRigCore();
const runtime = new ProceduralDeformRuntimeV5();
runtime.compileHuman({ bodyDNA: dna, rigCore });
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
  const pose = createProceduralDeformValidationPoseV5({ poseId, rigCore, bodyDNA: dna, timestamp: 1 });
  human.updatePose(pose);
  runtime.update({ finalPose: pose, anatomyState: human.getAnatomyState() });
  const diagnostics = runtime.analyzeCurrentDeformationQuality();
  results[poseId] = diagnostics;
  assert.doesNotThrow(
    () => assertProceduralSurfaceDeformationQualityGateV5(diagnostics),
    `${poseId} failed the joint deformation quality gate: ${JSON.stringify(diagnostics)}`,
  );
}

assert.equal(runtime.getDiagnostics().visualAcceptance, false);
assert.equal(runtime.getDiagnostics().productionReady, false);
console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([poseId, diagnostics]) => [poseId, {
  triangleFlipCount: diagnostics.triangleFlipCount,
  triangleAreaRatioMinimum: diagnostics.triangleAreaRatioMinimum,
  triangleAreaRatioMaximum: diagnostics.triangleAreaRatioMaximum,
  localFoldoverCount: diagnostics.localFoldoverCount,
  selfIntersectionPairCount: diagnostics.selfIntersectionPairCount,
  criticalRegionSelfIntersectionCount: diagnostics.criticalRegionSelfIntersectionCount,
}]))));
console.log('Human Core V5 procedural joint quality: T, shoulder, twist, elbow, hip, knee, squat, and lunge geometry gates passed.');
