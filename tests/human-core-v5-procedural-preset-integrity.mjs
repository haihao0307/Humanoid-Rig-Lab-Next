import assert from 'node:assert/strict';
import {
  HumanCoreRuntime,
  PROCEDURAL_BODY_DNA_PRESETS_V5,
  ProceduralDeformRuntimeV5,
  V4Adapter,
  analyzeSurfaceGeometryV5,
  bodyDNAFingerprint,
  compareProceduralRigSurfaceAnchorsV5,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
  createProceduralSimulationRigFrameV5,
} from '../src/modules/human-core-v5/index.js';

const results = {};
for (const [preset, input] of Object.entries(PROCEDURAL_BODY_DNA_PRESETS_V5)) {
  const bodyDNA = createBodyDNA({
    bodyDNAId: `preset-integrity-${preset.toLowerCase()}`,
    identity: { humanId: `preset-integrity-${preset.toLowerCase()}`, label: preset },
    proportionRevision: 14,
    ...structuredClone(input),
  });
  const human = new HumanCoreRuntime();
  human.createHuman(bodyDNA);
  const rigCore = human.getRigCore();
  const adapted = V4Adapter.humanRigCoreToExistingRig(rigCore, { bodyDNA, pose: 'T' });
  const fingerprint = bodyDNAFingerprint(bodyDNA);
  assert.equal(adapted.sourceBodyDNAId, bodyDNA.bodyDNAId, `${preset} V4Adapter lost the active BodyDNA id.`);
  assert.equal(adapted.bodyDNAFingerprint, fingerprint, `${preset} V4Adapter lost the active BodyDNA content.`);
  assert.equal(adapted.proportionRevision, bodyDNA.proportionRevision, `${preset} V4Adapter lost proportionRevision.`);

  const runtime = new ProceduralDeformRuntimeV5();
  runtime.compileHuman({ bodyDNA, rigCore });
  await runtime.generateCanonicalSurface({ resolution: 40, worker: false });
  const geometry = analyzeSurfaceGeometryV5(runtime.surface.positions, runtime.surface.indices);
  assert.equal(geometry.connectedComponentCount, 1, `${preset} surface must have one connected component.`);
  assert.equal(geometry.boundaryEdgeCount, 0, `${preset} surface must be closed.`);
  assert.equal(geometry.nonManifoldEdgeCount, 0, `${preset} surface must be manifold.`);
  assert.equal(geometry.nonFiniteVertexCount, 0, `${preset} surface contains non-finite vertices.`);
  assert.equal(geometry.outOfRangeIndexCount, 0, `${preset} surface contains invalid indices.`);
  assert.ok(geometry.degenerateTriangleRatio < 0.001, `${preset} degenerate triangle ratio exceeded 0.001.`);

  const pose = createProceduralDeformValidationPoseV5({
    poseId: 'a-pose',
    rigCore,
    bodyDNA,
    timestamp: 1,
  });
  human.updatePose(pose);
  const deformFrame = runtime.update({
    finalPose: pose,
    anatomyState: human.getAnatomyState(),
  });
  const simulationRig = createProceduralSimulationRigFrameV5({ finalPose: pose, rigCore, bodyDNA });
  assert.equal(simulationRig.bodyDNAFingerprint, fingerprint, `${preset} SimulationRig FK used a different BodyDNA.`);
  assert.equal(simulationRig.expectedBodyDNAFingerprint, fingerprint, `${preset} SimulationRig provenance mismatched.`);
  assert.equal(simulationRig.proportionRevision, bodyDNA.proportionRevision, `${preset} SimulationRig proportionRevision mismatched.`);
  assert.equal(simulationRig.v4AdapterProportionRevision, bodyDNA.proportionRevision, `${preset} V4Adapter proportionRevision mismatched.`);
  const rigSurfaceAudit = compareProceduralRigSurfaceAnchorsV5(simulationRig, deformFrame.regionDiagnostics);
  assert.equal(rigSurfaceAudit.passed, true, `${preset} Rig/Surface anchors exceeded 2 cm maximum or 1 cm mean.`);

  results[preset] = {
    ...geometry,
    maximumErrorMeters: rigSurfaceAudit.maximumErrorMeters,
    meanErrorMeters: rigSurfaceAudit.meanErrorMeters,
    bodyDNAFingerprint: fingerprint,
    proportionRevision: bodyDNA.proportionRevision,
  };
}

const asymmetricDNA = PROCEDURAL_BODY_DNA_PRESETS_V5.Asymmetric.asymmetry.leftRightScale;
assert.ok(asymmetricDNA.arm > 1 && asymmetricDNA.leg > 1, 'Asymmetric authored direction must remain left-larger/right-smaller.');

console.log(JSON.stringify(results));
console.log('Human Core V5 procedural preset integrity: all BodyDNA presets are closed, connected, manifold, finite, and audited against their active V4Adapter Rig.');
