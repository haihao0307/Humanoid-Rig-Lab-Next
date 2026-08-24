import assert from 'node:assert/strict';
import { createStandardHumanoidPreset, normalizeSkeletonDefinition } from '../src/skeleton-presets.js';
import { computeRestWorldPositions, getBoneLength } from '../src/skeleton-model.js';
import { PhysicsRig } from '../src/physics-rig.js';
import {
  createPoseFrameV4,
  validatePoseFrameV4,
} from '../../../src/modules/pose/pose-frame-v4.js';

function quaternionErrorDegrees(a, b) {
  const dot = Math.min(1, Math.max(-1, Math.abs(a.reduce((sum, value, index) => sum + value * b[index], 0))));
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

const definition = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
const bindBefore = bindFingerprint(definition);
const rest = computeRestWorldPositions(definition);
const root = rest.get('root');
const bend = Math.PI / 5;
const source = createPoseFrameV4({
  compatibleRig: 'rig@0.4.0',
  rootJointId: 'hips',
  rootPosition: [root.x, root.y, root.z],
  rootRotation: [0, Math.sin(bend / 4), 0, Math.cos(bend / 4)],
  localRotations: {
    leftUpperArm: [0, 0, Math.sin(bend / 2), Math.cos(bend / 2)],
    rightUpperLeg: [Math.sin(bend / 6), 0, 0, Math.cos(bend / 6)],
  },
  contacts: [{ jointId: 'leftFoot', mode: 'plant' }],
  ikTargets: [],
  constraintState: { stage: 'legacy-v8-physics-v4-test' },
  proportionRevision: 4,
  timestamp: 1_786_000_123_456,
});
assert.equal(validatePoseFrameV4(source).valid, true);

const rig = new PhysicsRig(definition, { gravityEnabled: false, groundEnabled: true });
assert.ok(rig.applyPoseFrame(source, { project: false }) > 0);
const finalPose = rig.getFinalPoseFrame();
assert.ok(finalPose, 'PhysicsRig did not retain finalPose.localRotations.');
assert.equal(validatePoseFrameV4(finalPose).valid, true);
assert.ok(quaternionErrorDegrees(finalPose.rootRotation, source.rootRotation) < 0.1);
for (const [jointId, quaternion] of Object.entries(source.localRotations)) {
  assert.ok(quaternionErrorDegrees(finalPose.localRotations[jointId], quaternion) < 0.1);
}
const simulation = rig.getSimulationRigFrame({ frameId: 'legacy-v8-physics-v4' });
assert.equal(simulation.authority, 'local-quaternion-v4');
assert.deepEqual(simulation.finalPose, finalPose);
assert.ok(simulation.fk.rotationDeltas.leftUpperArm);
assert.equal(bindFingerprint(definition), bindBefore, 'V4 pose changed bind hierarchy or bone lengths.');

console.log('V8 PhysicsRig V4 local-quaternion authority regression passed.');
