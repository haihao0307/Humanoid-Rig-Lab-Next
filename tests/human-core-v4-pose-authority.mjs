import assert from 'node:assert/strict';
import { normalizeAnimationState, setActiveClip } from '../src/modules/animation/model.js';
import {
  sampleAnimationPose,
  sampleAnimationRuntime,
} from '../src/modules/animation/runtime.js';
import { validatePoseFrameV4 } from '../src/modules/pose/pose-frame-v4.js';
import {
  createStandardHumanoidPreset,
  normalizeSkeletonDefinition,
} from '../legacy/v8/src/skeleton-presets.js';
import { getBoneLength } from '../legacy/v8/src/skeleton-model.js';
import { PhysicsRig } from '../legacy/v8/src/physics-rig.js';

const PROFILE = {
  height: 1.795672,
  shoulderWidth: 0.42,
  hipWidth: 0.20,
  upperArmLength: 0.277218,
  forearmLength: 0.241402,
  thighLength: 0.425348,
  lowerLegLength: 0.403133,
};

function angleDegrees(a, b) {
  const dot = Math.min(1, Math.max(-1, Math.abs(
    Number(a[0]) * Number(b[0])
      + Number(a[1]) * Number(b[1])
      + Number(a[2]) * Number(b[2])
      + Number(a[3]) * Number(b[3]),
  )));
  return (2 * Math.acos(dot) * 180) / Math.PI;
}

function bindFingerprint(definition) {
  return JSON.stringify({
    hierarchy: definition.joints.map((joint) => ({
      id: joint.id,
      parentId: joint.parentId,
      localPosition: [...joint.localPosition],
    })),
    boneLengths: definition.joints
      .filter((joint) => joint.parentId)
      .map((joint) => [joint.id, getBoneLength(definition, joint.id)]),
  });
}

const animation = setActiveClip(normalizeAnimationState({}, {
  compatibleRig: 'rig@0.4.0',
  targetProportionRevision: 17,
}), 'wave');
const runtime = sampleAnimationRuntime(animation, {
  rawTime: 0.42,
  nowMs: 1_786_000_123_456,
  bodyProfile: PROFILE,
  rigVersion: 'rig@0.4.0',
  proportionRevision: 17,
});

assert.equal(validatePoseFrameV4(runtime.desiredPoseFrame).valid, true);
assert.equal(validatePoseFrameV4(runtime.finalPoseFrame).valid, true);
assert.equal(runtime.animationRig.input.type, 'MotionClip');
assert.equal(runtime.simulationRig.frame.authority, 'local-quaternion-v4');
assert.equal(runtime.simulationRig.frame.finalPose, runtime.finalPoseFrame);
assert.equal(runtime.desiredPoseFrame.proportionRevision, 17);
assert.deepEqual(runtime.desiredPoseFrame.rootPosition, runtime.desiredPose.root.position);
assert.ok(angleDegrees(runtime.desiredPoseFrame.rootRotation, runtime.desiredPose.root.rotation) < 0.1);
for (const [jointId, value] of Object.entries(runtime.desiredPose.joints)) {
  assert.ok(runtime.desiredPoseFrame.localRotations[jointId], `Missing desired local rotation for ${jointId}.`);
  assert.ok(
    angleDegrees(runtime.desiredPoseFrame.localRotations[jointId], value.rotation) < 0.1,
    `Desired local rotation changed for ${jointId}.`,
  );
}

const animationOnlySample = sampleAnimationPose(animation, {
  rawTime: 0.42,
  nowMs: 1_786_000_123_456,
  bodyProfile: PROFILE,
  rigVersion: 'rig@0.4.0',
  proportionRevision: 17,
});
assert.deepEqual(animationOnlySample.rootTransform.position, runtime.desiredPoseFrame.rootPosition);
assert.ok(angleDegrees(animationOnlySample.rootTransform.rotation, runtime.desiredPoseFrame.rootRotation) < 0.1);
assert.deepEqual(animationOnlySample.localRotations, runtime.desiredPoseFrame.localRotations);

const definition = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
const fingerprintBefore = bindFingerprint(definition);
const physics = new PhysicsRig(definition, {
  gravityEnabled: false,
  groundEnabled: true,
  jointLimits: true,
});
const applied = physics.applyPoseFrame(runtime.finalPoseFrame, { project: false });
assert.ok(applied > 0);
assert.equal(physics.getPoseAuthority().authority, 'local-quaternion-v4');
const finalPose = physics.getFinalPoseFrame();
assert.ok(finalPose);
assert.equal(validatePoseFrameV4(finalPose).valid, true);
assert.deepEqual(finalPose.rootPosition, runtime.finalPoseFrame.rootPosition);
assert.ok(angleDegrees(finalPose.rootRotation, runtime.finalPoseFrame.rootRotation) < 0.1);
for (const [jointId, quaternion] of Object.entries(runtime.finalPoseFrame.localRotations)) {
  assert.ok(finalPose.localRotations[jointId], `PhysicsRig dropped final local rotation ${jointId}.`);
  assert.ok(
    angleDegrees(finalPose.localRotations[jointId], quaternion) < 0.1,
    `PhysicsRig round-trip exceeded 0.1 degrees for ${jointId}.`,
  );
}
const simulationFrame = physics.getSimulationRigFrame({ frameId: runtime.simulationRigFrame.frameId });
assert.equal(simulationFrame.schema, 'humanoid_rig/simulation_rig_frame@4.0');
assert.equal(simulationFrame.authority, 'local-quaternion-v4');
assert.deepEqual(simulationFrame.finalPose, finalPose);
assert.ok(Object.keys(simulationFrame.fk.rotationDeltas).length >= 24);
assert.equal(bindFingerprint(definition), fingerprintBefore, 'Pose authority changed bind hierarchy, local offsets, or bone lengths.');

const serialized = JSON.stringify(finalPose);
for (const forbidden of ['boneLength', 'bindLocalPosition', 'inverseBindMatrices', 'parentId']) {
  assert.equal(serialized.includes(forbidden), false, `PoseFrame persisted forbidden ${forbidden} data.`);
}

console.log('Human Core V4 Pose Authority: animation -> SimulationRig -> PhysicsRig local-quaternion round-trip passed.');
