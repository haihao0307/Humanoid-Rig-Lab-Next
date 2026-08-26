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
  assert.equal(
    adapted.authoredAsymmetryApplicationCount,
    preset === 'Asymmetric' ? 1 : 0,
    `${preset} V4Adapter authored asymmetry application count is invalid.`,
  );
  if (preset === 'Asymmetric') assertAsymmetricRigScales(adapted.definition, bodyDNA.asymmetry.leftRightScale);

  const runtime = new ProceduralDeformRuntimeV5();
  runtime.compileHuman({ bodyDNA, rigCore });
  if (preset === 'Asymmetric') assertAsymmetricFieldAuthority(runtime.field, adapted.definition);
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
  assert.equal(
    simulationRig.authoredAsymmetryApplicationCount,
    preset === 'Asymmetric' ? 1 : 0,
    `${preset} SimulationRig did not consume the V4Adapter asymmetry authority.`,
  );
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

function assertAsymmetricRigScales(definition, requested) {
  const joints = new Map(definition.joints.map((joint) => [joint.id, joint]));
  const expectedRatio = (key) => requested[key] / (2 - requested[key]);
  const segmentRatio = (leftId, rightId) => vectorLength(joints.get(leftId).localPosition)
    / vectorLength(joints.get(rightId).localPosition);
  const chainRatio = (leftIds, rightIds) => leftIds.reduce((sum, id) => sum + vectorLength(joints.get(id).localPosition), 0)
    / rightIds.reduce((sum, id) => sum + vectorLength(joints.get(id).localPosition), 0);
  assertClose(chainRatio(['leftShoulder', 'leftUpperArm'], ['rightShoulder', 'rightUpperArm']), expectedRatio('shoulder'), 'shoulder scale');
  assertClose(segmentRatio('leftLowerArm', 'rightLowerArm'), expectedRatio('arm'), 'upper-arm scale');
  assertClose(segmentRatio('leftHand', 'rightHand'), expectedRatio('arm'), 'forearm scale');
  assertClose(segmentRatio('leftHandEnd', 'rightHandEnd'), expectedRatio('hand'), 'hand scale');
  assertClose(Math.abs(joints.get('leftUpperLeg').localPosition[0]) / Math.abs(joints.get('rightUpperLeg').localPosition[0]), expectedRatio('hip'), 'hip scale');
  assertClose(segmentRatio('leftLowerLeg', 'rightLowerLeg'), expectedRatio('leg'), 'thigh scale');
  assertClose(segmentRatio('leftFoot', 'rightFoot'), expectedRatio('leg'), 'calf scale');
  assertClose(segmentRatio('leftToes', 'rightToes'), expectedRatio('foot'), 'foot scale');
}

function assertAsymmetricFieldAuthority(field, adaptedDefinition) {
  const definition = field.definition;
  assert.equal(definition.canonicalLayout.authoredAsymmetryAuthority.applicationCount, 1, 'Body Field must consume one authored asymmetry application.');
  assert.equal(definition.canonicalLayout.authoredAsymmetryAuthority.regionPlacementReappliesAuthoredScale, false, 'Body Field must not reapply authored positional scales.');
  const adapted = new Map(adaptedDefinition.joints.map((joint) => [joint.id, joint.poseWorldPosition]));
  const region = new Map(definition.regions.map((item) => [item.regionId, item.primitive]));
  for (const side of ['left', 'right']) {
    const landmarks = definition.canonicalLayout.rigLandmarks[side];
    for (const [landmark, jointId] of Object.entries({
      shoulder: `${side}UpperArm`, elbow: `${side}LowerArm`, wrist: `${side}Hand`,
      hip: `${side}UpperLeg`, knee: `${side}LowerLeg`, ankle: `${side}Foot`,
    })) assertVectorClose(landmarks[landmark], adapted.get(jointId), `${side} ${landmark} canonical landmark`);
    assertClose(distance(region.get(`${side}UpperArm`).start, region.get(`${side}UpperArm`).end), distance(landmarks.shoulder, landmarks.elbow), `${side} upper-arm field length`);
    assertClose(distance(region.get(`${side}Forearm`).start, region.get(`${side}Forearm`).end), distance(landmarks.elbow, landmarks.wrist), `${side} forearm field length`);
    assertVectorClose(region.get(`${side}Calf`).end, landmarks.ankle, `${side} calf endpoint`);
  }
}

function assertVectorClose(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label} dimension mismatch.`);
  for (let axis = 0; axis < actual.length; axis += 1) assertClose(actual[axis], expected[axis], `${label}[${axis}]`);
}

function assertClose(actual, expected, label, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${label}: expected ${expected}, received ${actual}.`);
}

function vectorLength(value) { return Math.hypot(...value); }
function distance(left, right) { return Math.hypot(...left.map((value, axis) => value - right[axis])); }
