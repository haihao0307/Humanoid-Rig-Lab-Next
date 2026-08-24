import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  HumanCoreRuntime,
  V4Adapter,
  bodyDNAToProportionProfile,
  createBodyDNA,
  createHumanCoreStateV5,
  createHumanRigCoreV5,
  validateBodyDNAV5,
  validateHumanCoreStateV5,
  validateHumanRigCoreV5,
} from '../src/modules/human-core-v5/index.js';
import { createPoseFrameV4 } from '../src/modules/pose/pose-frame-v4.js';
import { PhysicsRig } from '../legacy/v8/src/physics-rig.js';
import { ProductionSkinRuntime } from '../legacy/v8/src/production-skin-runtime.js';

const alphaDNA = createBodyDNA({
  bodyDNAId: 'body-dna-alpha',
  identity: { humanId: 'human-alpha', characterId: 'character-alpha', label: 'Alpha' },
  proportionRevision: 7,
  proportion: {
    height: 1.78,
    shoulderWidth: 0.44,
    hipWidth: 0.21,
    headToBodyRatio: 7.6,
    limbLengths: { upperArm: 0.29, forearm: 0.25, handControl: 0.072, thigh: 0.43, lowerLeg: 0.41 },
    bodyThickness: { chest: 0.27, waist: 0.22, hip: 0.26 },
  },
  mass: { weightKg: 79, distribution: { torso: 0.51, upperLimbs: 0.14, lowerLimbs: 0.35 } },
  bodyType: { category: 'mesomorph', label: 'Athletic reference', morphology: 'balanced' },
  ageProfile: { stage: 'adult', years: 32 },
  genderProfile: { identity: 'unspecified', expression: null },
  fitnessProfile: { muscle: 0.62, fat: 0.24, distribution: { upperBody: 0.55, lowerBody: 0.45 } },
});

const betaDNA = createBodyDNA({
  identity: { humanId: 'human-beta', label: 'Beta' },
  proportionRevision: 8,
  proportion: {
    height: 1.62,
    shoulderWidth: 0.36,
    hipWidth: 0.24,
    limbLengths: { upperArm: 0.23, forearm: 0.21, handControl: 0.06, thigh: 0.36, lowerLeg: 0.35 },
    bodyThickness: { chest: 0.22, waist: 0.23, hip: 0.29 },
  },
  mass: { weightKg: 58, distribution: { torso: 0.48, upperLimbs: 0.16, lowerLimbs: 0.36 } },
  bodyType: { category: 'ectomorph', label: 'Compact reference', morphology: 'compact' },
});

assert.equal(validateBodyDNAV5(alphaDNA).valid, true);
assert.equal(alphaDNA.identity.humanId, 'human-alpha');
assert.equal(alphaDNA.proportionRevision, 7);
assert.notEqual(alphaDNA.proportion.height, betaDNA.proportion.height);
assert.notEqual(alphaDNA.mass.weightKg, betaDNA.mass.weightKg);
assert.notDeepEqual(alphaDNA.proportion.bodyThickness, betaDNA.proportion.bodyThickness);
assert.equal(JSON.stringify(alphaDNA).includes('mesh'), false, 'BodyDNA must not carry mesh data.');
assert.equal(JSON.stringify(alphaDNA).includes('animation'), false, 'BodyDNA must not carry animation data.');
assert.throws(() => createBodyDNA({ identity: { humanId: 'invalid-mesh-human' }, meshReference: 'body.glb' }), /cannot contain/);

const alphaProfile = bodyDNAToProportionProfile(alphaDNA);
assert.equal(alphaProfile.height, alphaDNA.proportion.height);
assert.equal(alphaProfile.shoulderWidth, alphaDNA.proportion.shoulderWidth);
assert.equal(alphaProfile.hipWidth, alphaDNA.proportion.hipWidth);
assert.equal(alphaProfile.upperArmLength, alphaDNA.proportion.limbLengths.upperArm);
assert.equal(alphaProfile.draftRevision, alphaDNA.proportionRevision);
const profileAdapter = V4Adapter.bodyDNAToProportionProfile(alphaDNA);
assert.equal(profileAdapter.proportionRevision, 7, 'V4 adapter must preserve proportion_revision independently.');

const alphaRigCore = createHumanRigCoreV5({ bodyDNA: alphaDNA });
const betaRigCore = createHumanRigCoreV5({ bodyDNA: betaDNA });
assert.equal(validateHumanRigCoreV5(alphaRigCore).valid, true);
assert.equal(alphaRigCore.topology.jointCount, betaRigCore.topology.jointCount);
assert.equal(alphaRigCore.topology.fingerprint, betaRigCore.topology.fingerprint, 'BodyDNA must not alter the Rig hierarchy.');
const leftKnee = alphaRigCore.joints.find((joint) => joint.jointId === 'leftLowerLeg');
const leftShoulder = alphaRigCore.joints.find((joint) => joint.jointId === 'leftUpperArm');
assert.equal(leftKnee.parentId, 'leftUpperLeg');
assert.equal(leftKnee.limitProfile.reverseBendBlocked, true);
assert.ok(leftKnee.mobilityProfile.motions.includes('flexion'));
assert.ok(leftShoulder.mobilityProfile.motions.includes('abduction'));
assert.ok(leftShoulder.affects.includes('leftShoulder'));
assert.equal(leftShoulder.axisReference.schema, 'humanoid_rig/joint_axes@1.0');
assert.equal(leftShoulder.axisReference.space, 'joint-local-at-bind');
assert.throws(() => createHumanCoreStateV5({
  bodyDNA: alphaDNA,
  rigCore: alphaRigCore,
  appearanceState: { glbReference: 'body.glb' },
}), /cannot contain/);

const runtime = new HumanCoreRuntime();
const createdState = runtime.createHuman(alphaDNA, {
  appearanceState: { skinBindingRef: { id: 'skin-binding-v4-compatibility', revision: 4, assetClass: 'compatibility' } },
  timestamp: 10,
});
assert.equal(createdState.humanId, 'human-alpha');
assert.equal(createdState.rigState.authority, 'rig-definition-v5-projection');
assert.equal(createdState.poseState.authority, 'local-quaternion-v4');

const poseFrame = createPoseFrameV4({
  compatibleRig: createdState.rigState.compatibleRig,
  rootJointId: 'hips',
  rootPosition: [0, 0.925, 0.016],
  rootRotation: [0, 0, 0, 1],
  localRotations: {
    leftUpperArm: axisAngle([0, 0, 1], 0.25),
    rightUpperArm: axisAngle([0, 0, -1], 0.25),
    leftLowerLeg: axisAngle([1, 0, 0], 0.35),
  },
  contacts: [{ jointId: 'leftFoot', active: true }],
  ikTargets: [],
  constraintState: { fixture: 'human-core-v5-pose-authority' },
  proportionRevision: 7,
  timestamp: 20,
});
const posedState = runtime.updatePose(poseFrame, { timestamp: 20 });
assert.equal(validateHumanCoreStateV5(posedState).valid, true);
assert.deepEqual(posedState.poseState.currentPose, poseFrame);
assert.equal(posedState.balanceState.status, 'contact-observed');
assert.deepEqual(posedState.balanceState.supportJointIds, ['leftFoot']);
assert.equal(runtime.evaluateConstraints().valid, true);
runtime.updateMotion({
  intent: { intentId: 'intent-walk', action: 'locomote', priority: 2, constraints: { speed: 1.2 } },
  sourceClipId: 'walk-v4',
  status: 'desired',
  revision: 1,
});
assert.equal(runtime.getState().motionState.intent.action, 'locomote');

const v4Rig = V4Adapter.humanRigCoreToExistingRig(alphaRigCore, { bodyDNA: alphaDNA, pose: 'A' });
assert.equal(v4Rig.proportionRevision, 7);
assert.equal(v4Rig.definition.joints.length, alphaRigCore.topology.jointCount);
assert.equal(v4Rig.definition.jointAxes.schema, 'humanoid_rig/joint_axes@1.0');
const physics = new PhysicsRig(v4Rig.definition, { gravityEnabled: false, groundEnabled: true, jointLimits: true });
const applied = physics.applyPoseFrame(poseFrame, { project: false });
assert.ok(applied > 0, 'Existing V4 PhysicsRig must accept a V5-adapted PoseFrame.');
const simulationFrame = physics.getSimulationRigFrame({ frameId: 'human-core-v5-v4-compatibility' });
assert.equal(simulationFrame.authority, 'local-quaternion-v4');
assert.deepEqual(simulationFrame.finalPose.localRotations, poseFrame.localRotations);

const metadata = JSON.parse(await readFile(new URL('../legacy/v8/assets/smpl/SKIN_BINDING_METADATA.json', import.meta.url), 'utf8'));
const bindingProfile = JSON.parse(await readFile(new URL('../legacy/v8/assets/smpl/SKIN_BINDING_PROFILE_V4.json', import.meta.url), 'utf8'));
const skinAsset = {
  assetReference: bindingProfile.assetReference,
  compatibleRig: metadata.compatibleRig,
  vertexCount: metadata.vertexCount,
  jointIds: metadata.jointIds,
  attributes: metadata.attributes,
  inverseBindMatrixCount: metadata.inverseBindMatrices.count,
  productionReady: metadata.weights.productionReady,
};
const skinRuntime = new ProductionSkinRuntime({ bindingProfile });
skinRuntime.bindCharacter({ skinAsset, sourceRootPosition: poseFrame.rootPosition });
const stateBeforeSkin = runtime.getState();
const skinResult = skinRuntime.updatePose(simulationFrame);
assert.equal(skinResult.applied, true, skinResult.reason ?? 'Production Skin V4 rejected V5-adapted V4 frame.');
assert.equal(skinResult.authority, 'finalPose.localRotations');
assert.deepEqual(runtime.getState(), stateBeforeSkin, 'Skin runtime must not write HumanCoreState.');

const legacyHtml = await readFile(new URL('../legacy/v8/index.html', import.meta.url), 'utf8');
const legacyMain = await readFile(new URL('../legacy/v8/src/main.js', import.meta.url), 'utf8');
const legacySmplSkin = await readFile(new URL('../legacy/v8/src/smpl-skin.js', import.meta.url), 'utf8');
assert.match(legacyHtml, /src\s*=\s*['"]\.\/src\/main\.js(?:\?[^'"]*)?['"]/);
assert.match(legacyMain, /PhysicsRig/);
assert.match(legacyMain, /createThreeSkeletonView/);
assert.match(legacySmplSkin, /ProductionSkinRuntime/);

console.log('Human Core V5 BodyDNA + Intelligent Rig: BodyDNA mapping, semantic rig, PoseFrame V4 adapter, V4 PhysicsRig, and Production Skin compatibility passed.');

function axisAngle(axis, angle) {
  const half = angle / 2;
  return [axis[0] * Math.sin(half), axis[1] * Math.sin(half), axis[2] * Math.sin(half), Math.cos(half)];
}
