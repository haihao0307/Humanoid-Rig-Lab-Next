import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  HumanAnatomyRuntimeV5,
  HumanCoreRuntime,
  V4Adapter,
  createAnatomyDeformationSignalV5,
  createBodyDNA,
  createHumanAnatomyStateV5,
  createHumanCoreStateV5,
  createHumanRigCoreV5,
  createMassDistributionModelV5,
  validateHumanAnatomyStateV5,
} from '../src/modules/human-core-v5/index.js';
import { createPoseFrameV4 } from '../src/modules/pose/pose-frame-v4.js';
import { PhysicsRig } from '../legacy/v8/src/physics-rig.js';
import { ProductionSkinRuntime } from '../legacy/v8/src/production-skin-runtime.js';

const alphaDNA = createBodyDNA({
  bodyDNAId: 'body-dna-anatomy-alpha',
  identity: { humanId: 'human-anatomy-alpha', characterId: 'character-anatomy-alpha', label: 'Anatomy Alpha' },
  proportionRevision: 12,
  proportion: {
    height: 1.86,
    shoulderWidth: 0.48,
    hipWidth: 0.23,
    headToBodyRatio: 7.8,
    limbLengths: { upperArm: 0.31, forearm: 0.27, handControl: 0.075, thigh: 0.46, lowerLeg: 0.43 },
    bodyThickness: { chest: 0.30, waist: 0.23, hip: 0.27 },
  },
  mass: { weightKg: 88, distribution: { torso: 0.58, upperLimbs: 0.13, lowerLimbs: 0.29 } },
  bodyType: { category: 'mesomorph', label: 'Athletic tall', morphology: 'athletic' },
  fitnessProfile: { muscle: 0.72, fat: 0.20, distribution: { upperBody: 0.62, lowerBody: 0.48 } },
});

const betaDNA = createBodyDNA({
  bodyDNAId: 'body-dna-anatomy-beta',
  identity: { humanId: 'human-anatomy-beta', label: 'Anatomy Beta' },
  proportionRevision: 13,
  proportion: {
    height: 1.56,
    shoulderWidth: 0.34,
    hipWidth: 0.27,
    headToBodyRatio: 6.8,
    limbLengths: { upperArm: 0.22, forearm: 0.20, handControl: 0.058, thigh: 0.35, lowerLeg: 0.33 },
    bodyThickness: { chest: 0.23, waist: 0.27, hip: 0.31 },
  },
  mass: { weightKg: 63, distribution: { torso: 0.43, upperLimbs: 0.16, lowerLimbs: 0.41 } },
  bodyType: { category: 'endomorph', label: 'Compact lower-mass', morphology: 'compact' },
  fitnessProfile: { muscle: 0.34, fat: 0.42, distribution: { upperBody: 0.38, lowerBody: 0.58 } },
});

const alphaMass = createMassDistributionModelV5(alphaDNA);
const betaMass = createMassDistributionModelV5(betaDNA);
assert.equal(alphaMass.totalMassKg, 88);
assert.equal(betaMass.totalMassKg, 63);
assert.notEqual(alphaMass.centerOfMass.position[1], betaMass.centerOfMass.position[1], 'Different BodyDNA must produce a distinct COM estimate.');
assert.notEqual(alphaMass.torsoMass / alphaMass.totalMassKg, betaMass.torsoMass / betaMass.totalMassKg);
assert.equal(alphaMass.assumptions.usesWorldPositions, false);
assert.equal(alphaMass.headMass + alphaMass.torsoMass + alphaMass.armMass.total + alphaMass.legMass.total, alphaMass.totalMassKg);

const alphaCore = createHumanRigCoreV5({ bodyDNA: alphaDNA });
const directState = createHumanCoreStateV5({ bodyDNA: alphaDNA, rigCore: alphaCore, timestamp: 10 });
const anatomyRuntime = new HumanAnatomyRuntimeV5({ rigCore: alphaCore });
const neutralAnatomy = anatomyRuntime.evaluate(directState, { timestamp: 11 });
assert.equal(neutralAnatomy.type, 'HumanAnatomyState');
assert.equal(neutralAnatomy.source.usesWorldPositions, false);
assert.equal(neutralAnatomy.balanceState.integration.replacesWholeBodySolver, false);
assert.equal(neutralAnatomy.deformationSignal.application.writesMesh, false);
assert.equal(neutralAnatomy.deformationSignal.shoulderElevation, 0);
assert.throws(() => createHumanAnatomyStateV5({
  bodyDNA: alphaDNA,
  rigCore: alphaCore,
  bodyVolumeState: { meshReference: 'forbidden-body.glb' },
}), /cannot contain/);
assert.throws(() => createAnatomyDeformationSignalV5({ meshReference: 'forbidden-body.glb' }), /cannot contain/);

const runtime = new HumanCoreRuntime();
const createdState = runtime.createHuman(alphaDNA, { timestamp: 20 });
const topologyBefore = runtime.getRigCore().topology;
const pose = createPoseFrameV4({
  compatibleRig: createdState.rigState.compatibleRig,
  rootJointId: 'hips',
  rootPosition: [0, 0.96, 0.02],
  rootRotation: [0, 0, 0, 1],
  localRotations: {
    spine: axisAngle([1, 0, 0], 0.18),
    chest: axisAngle([1, 0, 0], 0.24),
    leftUpperArm: axisAngle([0, 0, 1], 0.92),
    rightUpperArm: axisAngle([0, 0, -1], 0.54),
    leftLowerArm: axisAngle([1, 0, 0], 0.72),
    rightLowerArm: axisAngle([1, 0, 0], 0.38),
    leftUpperLeg: axisAngle([1, 0, 0], 0.45),
    rightUpperLeg: axisAngle([1, 0, 0], -0.22),
    leftLowerLeg: axisAngle([1, 0, 0], 0.84),
    rightLowerLeg: axisAngle([1, 0, 0], 0.18),
  },
  contacts: [{ jointId: 'leftFoot', active: true }, { jointId: 'rightFoot', active: true }],
  ikTargets: [],
  constraintState: { fixture: 'human-core-v5-anatomy-runtime' },
  proportionRevision: alphaDNA.proportionRevision,
  timestamp: 30,
});
const posedState = runtime.updatePose(pose, { timestamp: 31 });
const anatomy = runtime.getAnatomyState();
assert.equal(validateHumanAnatomyStateV5(anatomy).valid, true);
assert.deepEqual(posedState.anatomyState, anatomy);
assert.equal(anatomy.source.poseAuthority, 'local-quaternion-v4');
assert.equal(anatomy.postureState.usesWorldPositions, false);
assert.equal(anatomy.balanceState.supportArea.supportFeet, 2);
assert.equal(anatomy.balanceState.stability.status, 'stable-double-support');
assert.ok(anatomy.deformationSignal.shoulderElevation > neutralAnatomy.deformationSignal.shoulderElevation);
assert.ok(anatomy.deformationSignal.elbowCompression > neutralAnatomy.deformationSignal.elbowCompression);
assert.ok(anatomy.deformationSignal.thighCompression > neutralAnatomy.deformationSignal.thighCompression);
assert.ok(anatomy.jointLoad.entries.some((entry) => entry.jointId === 'leftLowerLeg' && entry.load > 0));
assert.deepEqual(runtime.getRigCore().topology, topologyBefore, 'Anatomy Runtime must not create or alter a second Rig.');
assert.equal(runtime.evaluateConstraints().checked.anatomyWritesPose, false);

const repeatAnatomy = runtime.refreshAnatomy({ poseFrame: pose, timestamp: 32 });
assert.deepEqual(repeatAnatomy.massDistribution.centerOfMass, anatomy.massDistribution.centerOfMass, 'COM must be deterministic for a fixed BodyDNA and pose.');
assert.deepEqual(repeatAnatomy.deformationSignal, anatomy.deformationSignal, 'Anatomy signals must be deterministic for a fixed pose.');

const v4Rig = V4Adapter.humanRigCoreToExistingRig(alphaCore, { bodyDNA: alphaDNA, pose: 'A' });
const physics = new PhysicsRig(v4Rig.definition, { gravityEnabled: false, groundEnabled: true, jointLimits: true });
physics.applyPoseFrame(pose, { project: false });
const simulationFrame = physics.getSimulationRigFrame({ frameId: 'human-core-v5-anatomy-v4-compatibility' });
assertQuaternionMapsEquivalent(
  simulationFrame.finalPose.localRotations,
  pose.localRotations,
  0.1,
  'V4 PhysicsRig must preserve incoming local quaternion authority within 0.1 degrees.',
);

const metadata = JSON.parse(await readFile(new URL('../legacy/v8/assets/smpl/SKIN_BINDING_METADATA.json', import.meta.url), 'utf8'));
const bindingProfile = JSON.parse(await readFile(new URL('../legacy/v8/assets/smpl/SKIN_BINDING_PROFILE_V4.json', import.meta.url), 'utf8'));
const skinRuntime = new ProductionSkinRuntime({ bindingProfile });
skinRuntime.bindCharacter({
  skinAsset: {
    assetReference: bindingProfile.assetReference,
    compatibleRig: metadata.compatibleRig,
    vertexCount: metadata.vertexCount,
    jointIds: metadata.jointIds,
    attributes: metadata.attributes,
    inverseBindMatrixCount: metadata.inverseBindMatrices.count,
    productionReady: metadata.weights.productionReady,
  },
  sourceRootPosition: pose.rootPosition,
});
const stateBeforeSkin = runtime.getState();
const skinResult = skinRuntime.updatePose(simulationFrame);
assert.equal(skinResult.applied, true, skinResult.reason ?? 'ProductionSkinRuntime rejected the V4 finalPose.');
assert.equal(skinResult.authority, 'finalPose.localRotations');
assert.deepEqual(runtime.getState(), stateBeforeSkin, 'Production Skin must not write Anatomy Runtime or HumanCoreState.');

const legacyMain = await readFile(new URL('../legacy/v8/src/main.js', import.meta.url), 'utf8');
const motionRuntimeSource = await readFile(new URL('../src/modules/animation/motion-runtime-v4.js', import.meta.url), 'utf8');
assert.match(legacyMain, /PhysicsRig/);
assert.match(legacyMain, /createThreeSkeletonView/);
assert.match(motionRuntimeSource, /desiredPose/);
assert.match(motionRuntimeSource, /writesSkin:\s*false/);

console.log('Human Core V5 Anatomy Runtime: BodyDNA mass, PoseFrame anatomy evaluation, balance semantics, deformation signals, and V4 Skin compatibility passed.');

function axisAngle(axis, angle) {
  const half = angle / 2;
  return [axis[0] * Math.sin(half), axis[1] * Math.sin(half), axis[2] * Math.sin(half), Math.cos(half)];
}

function assertQuaternionMapsEquivalent(actual, expected, maximumErrorDegrees, message) {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${message} Joint sets differ.`);
  for (const jointId of Object.keys(expected)) {
    const error = quaternionAngularErrorDegrees(actual[jointId], expected[jointId]);
    assert.ok(error < maximumErrorDegrees, `${message} ${jointId} error was ${error.toFixed(6)} degrees.`);
  }
}

function quaternionAngularErrorDegrees(left, right) {
  const dot = Math.abs(left.reduce((sum, value, index) => sum + value * right[index], 0));
  return (2 * Math.acos(Math.min(1, Math.max(-1, dot)))) * 180 / Math.PI;
}
