import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createMotionGoal } from '../src/human-motion/goals/motion-goal.js';
import { createCurrentKinematicAdapter } from '../src/human-motion/solver/current-kinematic-adapter.js';
import { WholeBodyMotionSolver } from '../src/human-motion/solver/whole-body-motion-solver.js';
import { distance } from '../src/human-motion/solver/motion-math.js';

const frameSchema = JSON.parse(await readFile(new URL('../schemas/motion-solver-frame.schema.json', import.meta.url), 'utf8'));
assert.equal(frameSchema.$id, 'humanoid_rig/motion_solver_frame@1.0');
const kinematic = createCurrentKinematicAdapter();
const restPose = { root: { position: [0, 0, 0], rotation: [0, 0, 0, 1] }, joints: {} };
const restFk = kinematic.forwardKinematics(restPose);

function solveGoal(goal) {
  const solver = new WholeBodyMotionSolver({ kinematicAdapter: kinematic });
  solver.setPose(restPose).setGoal(goal);
  return { solver, frame: solver.solve({ deltaTime: 1 / 60, time: 0 }) };
}

for (const side of ['left', 'right']) {
  const handId = `${side}Hand`;
  const hand = restFk.positions.get(handId);
  const sign = side === 'left' ? -1 : 1;
  const target = [hand[0] + sign * 0.04, hand[1] + 0.12, hand[2] + 0.16];
  const { frame } = solveGoal(createMotionGoal({
    goalId: `${side}_reach`,
    endEffectors: [{ jointId: handId, targetPosition: target, poleTarget: [target[0], target[1] - 0.12, target[2] + 0.3], shoulderParticipation: 0.2 }],
    balance: { enabled: false, mode: 'airborne' },
  }));
  assert.ok(distance(frame.positions[handId], target) < 0.015, `${side} hand missed reachable target`);
  assert.ok(frame.diagnostics.maxBoneLengthError < 1e-8);
  assert.ok(frame.taskReports.some((report) => report.jointId === handId));
}

const leftHand = restFk.positions.get('leftHand');
const rightHand = restFk.positions.get('rightHand');
const double = solveGoal(createMotionGoal({
  goalId: 'double_reach',
  endEffectors: [
    { jointId: 'leftHand', targetPosition: [leftHand[0] - 0.02, leftHand[1] + 0.1, leftHand[2] + 0.12], poleTarget: [-0.5, 1, 0.6] },
    { jointId: 'rightHand', targetPosition: [rightHand[0] + 0.02, rightHand[1] + 0.1, rightHand[2] + 0.12], poleTarget: [0.5, 1, 0.6] },
  ],
  balance: { enabled: false, mode: 'airborne' },
})).frame;
assert.ok(double.diagnostics.maxEndEffectorError < 0.015);

const foot = restFk.positions.get('leftFoot');
const footTarget = [foot[0], foot[1] + 0.04, foot[2] + 0.12];
const footFrame = solveGoal(createMotionGoal({
  goalId: 'left_foot_step',
  endEffectors: [{ jointId: 'leftFoot', targetPosition: footTarget, poleTarget: [-0.1, 0.55, 0.5], groundNormal: [0, 1, 0] }],
  balance: { enabled: false, mode: 'airborne' },
})).frame;
assert.ok(distance(footFrame.positions.leftFoot, footTarget) < 0.015);
assert.ok(footFrame.diagnostics.leftKneeDirectionDot > 0);

const unreachable = solveGoal(createMotionGoal({
  goalId: 'unreachable',
  endEffectors: [{ jointId: 'rightHand', targetPosition: [3, 3, 3], poleTarget: [1, 1, 2] }],
  balance: { enabled: false, mode: 'airborne' },
})).frame;
const clampReport = unreachable.taskReports.find((report) => report.jointId === 'rightHand');
assert.equal(clampReport.clamped, true);
assert.ok(clampReport.reachError < 1e-8);

for (const target of [[-1, 1.5, 1], [1, 1.5, 1], [0, 2.2, 1], [0, 1.3, -2]]) {
  const gaze = solveGoal(createMotionGoal({
    goalId: `gaze_${target.join('_')}`,
    gaze: { targetPosition: target, headWeight: 0.65, neckWeight: 0.35, chestWeight: 0.2 },
    balance: { enabled: false, mode: 'airborne' },
  })).frame;
  const report = gaze.taskReports.find((item) => item.task === 'gaze');
  assert.ok(report && Number.isFinite(report.gazeError));
  assert.equal(report.flipped, false);
  if (target[2] < 0) {
    assert.equal(report.targetBehind, true);
    assert.ok(Math.hypot(...report.upperChestAdditiveRotation.slice(0, 3)) > 1e-5, 'behind gaze did not involve upper chest');
  }
}

assert.equal(double.schema, 'humanoid_rig/motion_solver_frame@1.0');
assert.equal(double.fk.jointCount, 89);
assert.doesNotThrow(() => JSON.stringify(double));
for (const rotation of Object.values(double.jointRotations)) {
  assert.ok(rotation.every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(...rotation) - 1) < 1e-8);
}
assert.ok(Object.values(double.positions).flat().every(Number.isFinite));

const lifecycle = new WholeBodyMotionSolver({ kinematicAdapter: kinematic });
assert.equal(lifecycle.getFrame(), null);
lifecycle.setPose(restPose).setGoal(createMotionGoal({ goalId: 'lifecycle', balance: { enabled: false, mode: 'airborne' } }));
lifecycle.solve({ deltaTime: 1 / 60 });
assert.ok(lifecycle.getDiagnostics());
lifecycle.clearGoal().reset().dispose();
assert.throws(() => lifecycle.solve(), /disposed/);

console.log('PASS WholeBodyMotionSolver reach, foot IK, clamp, gaze, normalized outgoing pose, diagnostics, and lifecycle');
