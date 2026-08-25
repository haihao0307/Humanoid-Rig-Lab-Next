import assert from 'node:assert/strict';
import {
  HumanCoreRuntime,
  ProceduralDeformRuntimeV5,
  StaticValidationPoseCompilerV5,
  analyzeStaticValidationSurfaceContactV5,
  assertProceduralSurfaceDeformationQualityGateV5,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
  createProceduralSimulationRigFrameV5,
} from '../src/modules/human-core-v5/index.js';

const dna = createBodyDNA({
  bodyDNAId: 'static-validation-contact',
  identity: { humanId: 'static-validation-contact' },
  proportionRevision: 14,
});
const human = new HumanCoreRuntime();
human.createHuman(dna);
const rigCore = human.getRigCore();
const deform = new ProceduralDeformRuntimeV5();
deform.compileHuman({ bodyDNA: dna, rigCore });
await deform.generateCanonicalSurface({ resolution: 36, worker: false });
const compiler = new StaticValidationPoseCompilerV5();

assert.equal(compiler.productionWholeBodySolver, false);
assert.equal(compiler.validationFixtureOnly, true);

for (const poseId of ['squat', 'lunge-left']) {
  let pose = createProceduralDeformValidationPoseV5({ poseId, rigCore, bodyDNA: dna, timestamp: 1 });
  assert.equal(pose.constraintState.staticValidation.productionWholeBodySolver, false);
  assert.equal(pose.constraintState.staticValidation.validationFixtureOnly, true);
  assert.equal(pose.contacts.length, 2);

  human.updatePose(pose);
  let frame = deform.update({ finalPose: pose, anatomyState: human.getAnatomyState() });
  pose = compiler.resolveSurfaceContact({ pose, surface: deform.surface, deformFrame: frame });
  human.updatePose(pose);
  frame = deform.update({ finalPose: pose, anatomyState: human.getAnatomyState() });

  const contact = analyzeStaticValidationSurfaceContactV5({ surface: deform.surface, deformFrame: frame });
  assert.equal(contact.passed, true, `${poseId} must satisfy the static surface contact gate`);
  assert.ok(contact.maximumDistanceMeters <= 0.005);
  assert.ok(contact.maximumPenetrationMeters <= 0.003);
  assert.ok(contact.feet.left.sampleCount > 0 && contact.feet.right.sampleCount > 0);
  assert.ok(pose.rootPosition[1] < deform.field.definition.canonicalLayout.rigRootPosition[1]);
  assert.equal(pose.constraintState.staticValidation.rootLoweringResolvedFromSurface, true);
  assert.ok(pose.constraintState.staticValidation.rootLoweringMeters > 0);

  const quality = deform.analyzeCurrentDeformationQuality();
  assert.doesNotThrow(() => assertProceduralSurfaceDeformationQualityGateV5(quality));
  const simulation = createProceduralSimulationRigFrameV5({ finalPose: pose, rigCore, bodyDNA: dna });
  assert.equal(simulation.poseAuthority, 'finalPose.localRotations');
  assert.ok(simulation.joints.leftLowerLeg.worldPosition[0] < 0);
  assert.ok(simulation.joints.rightLowerLeg.worldPosition[0] > 0);

  if (poseId === 'squat') {
    assert.ok(Math.abs(contact.feet.left.minimumY - contact.feet.right.minimumY) < 1e-6);
    assert.ok(pose.rootPosition[2] < deform.field.definition.canonicalLayout.rigRootPosition[2]);
  } else {
    const frontBackSeparation = Math.abs(contact.feet.left.lowestPoint[2] - contact.feet.right.lowestPoint[2]);
    assert.ok(frontBackSeparation > 0.4, 'Lunge front and rear feet must remain separated.');
    const supportMinimum = Math.min(contact.feet.left.lowestPoint[2], contact.feet.right.lowestPoint[2]);
    const supportMaximum = Math.max(contact.feet.left.lowestPoint[2], contact.feet.right.lowestPoint[2]);
    assert.ok(pose.rootPosition[2] >= supportMinimum && pose.rootPosition[2] <= supportMaximum);
  }
}

console.log('Human Core V5 static validation poses: squat and lunge root lowering, ankle dorsiflexion, bilateral contacts, and strict geometry gates passed.');
