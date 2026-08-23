import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { LocomotionController } from '../../../src/human-motion/controllers/locomotion-controller.js';
import { WholeBodyMotionSolver } from '../../../src/human-motion/solver/whole-body-motion-solver.js';
import { buildMotionEngineV8Payload, solverFrameToAnimationPose } from '../../../src/modules/animation/motion-engine-adapter.js';
import { buildAnimationPoseSnapshot } from '../../../src/modules/animation/index.js';
import { createStandardHumanoidPreset, normalizeSkeletonDefinition } from '../src/skeleton-presets.js';
import { computePoseWorldPositions } from '../src/skeleton-model.js';
import { PhysicsRig } from '../src/physics-rig.js';

const locomotion = new LocomotionController();
const solver = new WholeBodyMotionSolver();
let frame;
for (let index = 0; index < 150; index += 1) {
  const output = locomotion.update({ desiredVelocity: [0, 0, 0.65], desiredFacing: [0, 0, 1], speed: 0.65 }, 1 / 60);
  solver.setGoal(output.goal);
  frame = solver.solve({ deltaTime: 1 / 60, time: index / 60 });
}

const animationPose = solverFrameToAnimationPose(frame);
assert.deepEqual(animationPose.root, frame.outgoingPose.root);
assert.deepEqual(animationPose.joints, frame.outgoingPose.joints);
const bridge = buildMotionEngineV8Payload(frame, { updatedAt: 'test:whole-body-motion-bridge' });
assert.deepEqual(bridge.animationPose, animationPose);
assert.equal(bridge.v8Payload.rotationConventions.incomingBoneLocalRotations, 'incoming_bone_bind_delta_full_quaternion');
assert.ok(Object.keys(bridge.v8Payload.incomingBoneLocalRotations).length >= 24);
assert.equal(bridge.v8Payload.joints.length, 89);
for (const joint of bridge.v8Payload.joints) {
  const expected = frame.positions[joint.id];
  const actual = joint.poseWorldPosition;
  assert.ok(distance(expected, [actual.x, actual.y, actual.z]) < 1e-8, `${joint.id} differs before PoseSnapshot`);
}

const poseSnapshot = buildAnimationPoseSnapshot(
  bridge.animationPose,
  { activeVersions: { rig: frame.compatibleRig } },
  bridge.v8Payload,
);
assert.equal(poseSnapshot.rotationConvention, 'incoming_bone_bind_delta_full_quaternion');
assert.deepEqual(poseSnapshot.localRotations, bridge.v8Payload.incomingBoneLocalRotations);
const definition = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
const physics = new PhysicsRig(definition, { groundEnabled: false, gravityEnabled: false });
physics.applyPoseSnapshot(poseSnapshot, {
  project: false,
  applyConstraintSettings: false,
  preservePinTargets: false,
});
let maximumError = 0;
const compatibilityTerminalMarkers = new Set(['headTop', 'leftToesEnd', 'rightToesEnd']);
for (const joint of definition.joints) {
  if (joint.physicalBone === false || joint.isControl || compatibilityTerminalMarkers.has(joint.id)) continue;
  maximumError = Math.max(maximumError, distance(physics.getPoint(joint.id), frame.positions[joint.id]));
}
assert.ok(maximumError < 1e-6, `V8 bridge position error ${maximumError} m`);
const terminalMarkerError = Math.max(...[...compatibilityTerminalMarkers].map((jointId) => (
  distance(physics.getPoint(jointId), frame.positions[jointId])
)));
assert.ok(terminalMarkerError < 0.015, `legacy terminal marker compatibility error ${terminalMarkerError} m`);
const appliedWorld = computePoseWorldPositions(definition);
for (const jointId of ['hips', 'leftHand', 'rightHand', 'leftFoot', 'rightFoot']) {
  assert.ok(distance(appliedWorld.get(jointId), frame.positions[jointId]) < 1e-6, `${jointId} final pose was not written to the skin-facing definition`);
}

const adapterSource = await readFile(new URL('../../../src/modules/animation/motion-engine-adapter.js', import.meta.url), 'utf8');
assert.equal(adapterSource.includes('buildIncomingBoneLocalRotations'), false, 'motion adapter created a second incoming converter');
assert.equal(adapterSource.includes('buildV8PosePayload'), true, 'motion adapter does not delegate to the existing V8 payload path');
const threeViewSource = await readFile(new URL('../src/three-view.js', import.meta.url), 'utf8');
assert.match(threeViewSource, /skinLayer\.refresh\(definition/);
assert.ok(frame.diagnostics.maxBoneLengthError < 1e-8);
assert.ok(frame.diagnostics.maxContactError < 0.015);

console.log(`PASS MotionSolverFrame → AnimationPose → existing V8/PoseSnapshot/PhysicsRig/Skin definition bridge (core max ${maximumError} m, legacy terminal markers ${terminalMarkerError} m)`);

function distance(a, b) {
  const left = Array.isArray(a) ? a : [a.x, a.y, a.z];
  const right = Array.isArray(b) ? b : [b.x, b.y, b.z];
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}
