import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPoseFrameV4 } from '../../../src/modules/pose/pose-frame-v4.js';
import { ProductionSkinRuntime } from '../src/production-skin-runtime.js';
import { PoseCorrectiveRuntime } from '../src/pose-corrective-runtime.js';
import {
  SMPL24_COMPATIBILITY_BINDING_PROFILE_V4,
  createSkinBindingProfileV4,
  validateSkinBindingProfileV4,
} from '../src/skin-binding-profile-v4.js';
import { blendHybridPositions, measureRadiusRetention } from '../src/skin-deformation-v4.js';
import { __surfaceTestUtils } from '../src/smpl-skin.js';
import { PRODUCTION_SKIN_V4_TEST_POSES } from './fixtures/production-skin-v4-poses.js';

const metadata = JSON.parse(await readFile(
  new URL('../assets/smpl/SKIN_BINDING_METADATA.json', import.meta.url),
  'utf8',
));
const sidecarProfile = JSON.parse(await readFile(
  new URL('../assets/smpl/SKIN_BINDING_PROFILE_V4.json', import.meta.url),
  'utf8',
));

const assetDescriptor = {
  assetReference: sidecarProfile.assetReference,
  compatibleRig: metadata.compatibleRig,
  vertexCount: metadata.vertexCount,
  jointIds: metadata.jointIds,
  attributes: metadata.attributes,
  inverseBindMatrixCount: metadata.inverseBindMatrices.count,
  productionReady: metadata.weights.productionReady,
};

assert.equal(sidecarProfile.schema, SMPL24_COMPATIBILITY_BINDING_PROFILE_V4.schema);
assert.equal(sidecarProfile.bindingVersion, SMPL24_COMPATIBILITY_BINDING_PROFILE_V4.bindingVersion);
assert.equal(sidecarProfile.runtimeWeightGeneration, false);
assert.equal(metadata.runtimeExpansion.status, 'legacy-diagnostic-only');
assert.equal(metadata.productionSkinV4.bindingProfile, 'SKIN_BINDING_PROFILE_V4.json');
assert.equal(metadata.productionSkinV4.poseAuthority, 'simulationRig.finalPose.localRotations');
assert.equal(metadata.productionSkinV4.runtimeWeightGeneration, false);
assert.equal(metadata.productionSkinV4.assetClass, 'compatibility');
assert.equal(metadata.productionSkinV4.productionReady, false);
const validation = validateSkinBindingProfileV4(sidecarProfile, assetDescriptor);
assert.equal(validation.valid, true, validation.errors.join(' '));
assert.equal(validation.assetJointCount, 24);
assert.equal(validation.availableDeformJointCount, 6);
assert.match(validation.warnings.join(' '), /compatibility-only/);

const unsafeProfile = createSkinBindingProfileV4({ runtimeWeightGeneration: true });
const unsafeValidation = validateSkinBindingProfileV4(unsafeProfile, assetDescriptor);
assert.equal(unsafeValidation.valid, false);
assert.match(unsafeValidation.errors.join(' '), /runtimeWeightGeneration/);

const productionClaim = createSkinBindingProfileV4({
  productionReady: true,
  assetClass: 'production',
});
const productionClaimValidation = validateSkinBindingProfileV4(productionClaim, assetDescriptor);
assert.equal(productionClaimValidation.valid, false);
assert.match(productionClaimValidation.errors.join(' '), /TEXCOORD_0/);
assert.match(productionClaimValidation.errors.join(' '), /authoredTwistWeights/);

const poseResults = [];
for (const pose of PRODUCTION_SKIN_V4_TEST_POSES) {
  const frame = createPoseFrameV4({
    compatibleRig: 'rig@0.4.0',
    rootJointId: 'hips',
    rootPosition: [0, 0.97, 0],
    rootRotation: [0, 0, 0, 1],
    localRotations: pose.localRotations,
    contacts: pose.id === 'walk' ? [{ jointId: 'rightFoot', active: true }] : [],
    ikTargets: [],
    constraintState: { fixture: pose.id },
    proportionRevision: 12,
    timestamp: 1_786_000_000_000,
  });
  const runtime = new ProductionSkinRuntime({ bindingProfile: sidecarProfile });
  runtime.bindCharacter({
    skinAsset: assetDescriptor,
    sourceRootPosition: [0, 0.97, 0],
  });
  const result = runtime.updatePose({
    type: 'SimulationRigFrame',
    schema: 'humanoid_rig/simulation_rig_frame@4.0',
    finalPose: frame,
  });
  assert.equal(result.applied, true, `${pose.id}: ${result.reason ?? ''}`);
  assert.equal(result.authority, 'finalPose.localRotations');
  assert.deepEqual(result.rootDelta, [0, 0, 0]);
  assert.equal(Object.keys(result.localRotations).length, 24);
  for (const quaternion of Object.values(result.localRotations)) {
    assert.ok(Math.abs(Math.hypot(...quaternion) - 1) < 1e-6, `${pose.id} emitted a non-unit quaternion.`);
  }
  for (const [jointId, quaternion] of Object.entries(pose.localRotations)) {
    if (!metadata.jointIds.includes(jointId)) continue;
    assert.ok(quaternionErrorDegrees(result.localRotations[jointId], quaternion) < 0.1, `${pose.id} changed ${jointId}.`);
  }
  poseResults.push({ id: pose.id, activeRegions: result.correctiveDiagnostics.activeRegions });
}

for (const requiredPose of ['t-pose', 'a-pose', 'arm-raise', 'forearm-twist', 'squat', 'lunge', 'walk']) {
  assert.ok(poseResults.some((result) => result.id === requiredPose));
}
assert.ok(poseResults.find((result) => result.id === 'arm-raise').activeRegions.includes('shoulder'));
assert.ok(poseResults.find((result) => result.id === 'squat').activeRegions.includes('hip'));
assert.ok(poseResults.find((result) => result.id === 'squat').activeRegions.includes('knee'));

const twistProfile = createSkinBindingProfileV4({ expectedJointCount: 25 });
const twistAsset = {
  ...assetDescriptor,
  jointIds: [...assetDescriptor.jointIds, 'leftForearmTwist'],
  inverseBindMatrixCount: 25,
};
const twistRuntime = new ProductionSkinRuntime({ bindingProfile: twistProfile });
twistRuntime.bindCharacter({ skinAsset: twistAsset, sourceRootPosition: [0, 0.97, 0] });
const fullForearmTwist = createPoseFrameV4({
  compatibleRig: 'rig@0.4.0',
  rootPosition: [0, 0.97, 0],
  localRotations: { leftLowerArm: axisAngle([1, 0, 0], Math.PI) },
  proportionRevision: 12,
});
const twistResult = twistRuntime.updatePose(fullForearmTwist);
assert.ok(
  quaternionErrorDegrees(twistResult.localRotations.leftForearmTwist, axisAngle([1, 0, 0], Math.PI / 2)) < 0.1,
  'Fractional Deform Rig twist must use a true half-angle quaternion.',
);

const wristRuntime = new PoseCorrectiveRuntime(sidecarProfile.correctiveMap);
const wristFrame = createPoseFrameV4({
  compatibleRig: 'rig@0.4.0',
  rootPosition: [0, 0.97, 0],
  localRotations: { leftHand: axisAngle([0, 0, 1], 1.0) },
  proportionRevision: 12,
});
const wristResult = wristRuntime.applyCorrectives(wristFrame, null);
assert.ok(wristResult.diagnostics.activeRegions.includes('wrist'));
assert.equal(wristResult.diagnostics.source, 'finalPose.localRotations');
assert.equal(wristResult.diagnostics.modifiesRig, false);

const lockedRuntime = new ProductionSkinRuntime({ bindingProfile: sidecarProfile });
lockedRuntime.bindCharacter({ skinAsset: assetDescriptor, sourceRootPosition: [0, 0.97, 0] });
const revision12 = createPoseFrameV4({
  compatibleRig: 'rig@0.4.0', rootPosition: [0, 0.97, 0], proportionRevision: 12,
});
assert.equal(lockedRuntime.updatePose(revision12).applied, true);
const revision13 = createPoseFrameV4({
  compatibleRig: 'rig@0.4.0', rootPosition: [0, 0.97, 0], proportionRevision: 13,
});
const blocked = lockedRuntime.updatePose(revision13);
assert.equal(blocked.applied, false);
assert.match(blocked.reason, /rebound skin asset/);
assert.equal(lockedRuntime.getDiagnostics().proportionCompatible, false);

const experiment = runHybridExperiment();
for (const region of Object.values(experiment.regions)) {
  assert.ok(region.dqs.retention >= region.lbs.retention - 1e-6);
  assert.ok(region.hybrid.retention >= region.lbs.retention - 1e-6);
  assert.ok(region.hybrid.retention <= region.dqs.retention + 1e-6);
}
assert.ok(experiment.performance.lbsMs >= 0);
assert.ok(experiment.performance.dqsMs >= 0);
assert.ok(experiment.performance.hybridBlendMs >= 0);

console.log(`Production Skin V4 local-quaternion binding, ${poseResults.length} pose fixtures, proportion gate, and corrective drivers passed.`);
console.log(`SKIN_V4_EXPERIMENT ${JSON.stringify(experiment)}`);

function runHybridExperiment() {
  const cases = {
    shoulder: { axis: 'z', first: 85, second: -15, mask: 0.70 },
    elbow: { axis: 'z', first: 120, second: 0, mask: 0.72 },
    forearm: { axis: 'x', first: 135, second: -45, mask: 0.82 },
    hip: { axis: 'z', first: 75, second: -10, mask: 0.65 },
    knee: { axis: 'z', first: 110, second: 0, mask: 0.68 },
  };
  const regions = {};
  let lbsMs = 0;
  let dqsMs = 0;
  let hybridBlendMs = 0;
  for (const [region, settings] of Object.entries(cases)) {
    const fixture = createRingFixture(settings.axis);
    const matrices = new Float32Array([
      ...rotationMatrix(settings.axis, settings.first),
      ...rotationMatrix(settings.axis, settings.second),
    ]);
    const dualQuaternions = __surfaceTestUtils.skinMatricesToDualQuaternions(matrices);
    const lbs = new Float32Array(fixture.rest.length);
    const dqs = new Float32Array(fixture.rest.length);
    const dqsNormals = new Float32Array(fixture.normals.length);
    let start = performance.now();
    for (let pass = 0; pass < 120; pass += 1) {
      __surfaceTestUtils.deformSurfaceLbs(
        fixture.rest, lbs, fixture.indices, fixture.weights, matrices,
      );
    }
    lbsMs += performance.now() - start;
    start = performance.now();
    for (let pass = 0; pass < 120; pass += 1) {
      __surfaceTestUtils.deformSurfaceDqs(
        fixture.rest, fixture.normals, dqs, dqsNormals,
        fixture.indices, fixture.weights, dualQuaternions,
      );
    }
    dqsMs += performance.now() - start;
    const mask = new Float32Array(fixture.rest.length / 3).fill(settings.mask);
    start = performance.now();
    let hybrid = null;
    for (let pass = 0; pass < 120; pass += 1) {
      hybrid = blendHybridPositions(lbs, dqs, mask, hybrid);
    }
    hybridBlendMs += performance.now() - start;
    regions[region] = {
      lbs: compactRetention(measureRadiusRetention(fixture.rest, lbs, settings.axis)),
      dqs: compactRetention(measureRadiusRetention(fixture.rest, dqs, settings.axis)),
      hybrid: compactRetention(measureRadiusRetention(fixture.rest, hybrid, settings.axis)),
      hybridMask: settings.mask,
    };
  }
  return {
    schema: 'humanoid_rig/skin_deformation_experiment@4.0',
    fixture: 'two-joint-32-vertex-ring',
    iterationsPerRegion: 120,
    regions,
    performance: {
      lbsMs: round(lbsMs),
      dqsMs: round(dqsMs),
      hybridBlendMs: round(hybridBlendMs),
      note: 'Node CPU reference only; not a GPU renderer benchmark',
    },
  };
}

function createRingFixture(axis) {
  const vertexCount = 32;
  const rest = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const indices = new Uint16Array(vertexCount * 4);
  const weights = new Float32Array(vertexCount * 4);
  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    const angle = (vertexIndex / vertexCount) * Math.PI * 2;
    const a = Math.cos(angle) * 0.1;
    const b = Math.sin(angle) * 0.1;
    const offset = vertexIndex * 3;
    const point = axis === 'x' ? [0, a, b] : axis === 'y' ? [a, 0, b] : [a, b, 0];
    rest.set(point, offset);
    normals.set(point.map((value) => value / 0.1), offset);
    const skinOffset = vertexIndex * 4;
    indices.set([0, 1, 0, 0], skinOffset);
    weights.set([0.5, 0.5, 0, 0], skinOffset);
  }
  return { rest, normals, indices, weights };
}

function rotationMatrix(axis, degrees) {
  const angle = degrees * Math.PI / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (axis === 'x') return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
  if (axis === 'y') return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function compactRetention(value) {
  return {
    meanRadius: round(value.meanDeformedRadius),
    retention: round(value.retention),
  };
}

function axisAngle(axis, angle) {
  const half = angle * 0.5;
  return [axis[0] * Math.sin(half), axis[1] * Math.sin(half), axis[2] * Math.sin(half), Math.cos(half)];
}

function quaternionErrorDegrees(left, right) {
  const dot = Math.min(1, Math.max(-1, Math.abs(
    left[0] * right[0] + left[1] * right[1] + left[2] * right[2] + left[3] * right[3]
  )));
  return 2 * Math.acos(dot) * 180 / Math.PI;
}

function round(value) {
  return Number(value.toFixed(6));
}
