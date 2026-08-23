import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createMotionGoal,
  mergeMotionGoals,
  mirrorMotionGoal,
  normalizeMotionGoal,
  resolveRelativeMotionGoal,
  scaleMotionGoalToBody,
  validateMotionGoal,
} from '../src/human-motion/goals/motion-goal.js';
import { createCurrentKinematicAdapter } from '../src/human-motion/solver/current-kinematic-adapter.js';
import { quaternionFromAxisAngle } from '../src/modules/animation/quaternion.js';

const schema = JSON.parse(await readFile(new URL('../schemas/motion-goal.schema.json', import.meta.url), 'utf8'));
const styleSchema = JSON.parse(await readFile(new URL('../schemas/motion-style.schema.json', import.meta.url), 'utf8'));
assert.equal(schema.$id, 'humanoid_rig/motion_goal@1.0');
assert.equal(styleSchema.$id, 'humanoid_rig/motion_style@1.0');

const adapter = createCurrentKinematicAdapter();
const base = createMotionGoal({
  goalId: 'goal_right_reach',
  createdAt: 'test:motion-goal',
  space: 'character',
  orientation: { forward: [0, 0, 3], up: [0, 2, 0] },
  endEffectors: [{
    id: 'right_hand_target',
    jointId: 'rightHand',
    targetPosition: [0.5, 1.1, 0.4],
    poleTarget: [0.4, 1, 0.7],
    priority: 30,
  }],
  contacts: [{
    id: 'left_foot_support',
    jointId: 'leftFoot',
    position: [-0.1, 0.1, 0],
    normal: [0, 4, 0],
    priority: 100,
  }],
  style: { energy: 0.8, tempo: 1.2 },
});
assert.equal(base.schema, 'humanoid_rig/motion_goal@1.0');
assert.deepEqual(base.orientation.forward, [0, 0, 1]);
assert.deepEqual(base.contacts[0].normal, [0, 1, 0]);
assert.equal(base.style.energy, 0.8);
assert.equal(base.constraints.fixedBoneLengths, true);
assert.equal(validateMotionGoal(base, { jointIds: adapter.getJointIds() }).valid, true);

const mirrored = mirrorMotionGoal(base);
assert.equal(mirrored.endEffectors[0].jointId, 'leftHand');
assert.equal(mirrored.endEffectors[0].targetPosition[0], -0.5);
assert.equal(mirrored.contacts[0].jointId, 'rightFoot');
assert.equal(mirrored.contacts[0].targetPosition[0], 0.1);

const scaled = scaleMotionGoalToBody(base, { height: 2.0 }, 1.0);
assert.deepEqual(scaled.endEffectors[0].targetPosition, [1, 2.2, 0.8]);
assert.equal(scaled.balance.supportMargin, base.balance.supportMargin * 2);

const relative = resolveRelativeMotionGoal({
  ...base,
  root: { mode: 'position', targetPosition: [0, 0, 1] },
  endEffectors: [{ jointId: 'rightHand', targetPosition: [1, 0, 0] }],
}, {
  position: [2, 0, 3],
  rotation: quaternionFromAxisAngle([0, 1, 0], Math.PI / 2),
});
assert.equal(relative.space, 'world');
assert.ok(Math.abs(relative.root.targetPosition[0] - 3) < 1e-9);
assert.ok(Math.abs(relative.root.targetPosition[2] - 3) < 1e-9);
assert.ok(Math.abs(relative.endEffectors[0].targetPosition[0] - 2) < 1e-9);
assert.ok(Math.abs(relative.endEffectors[0].targetPosition[2] - 2) < 1e-9);

const merged = mergeMotionGoals(
  createMotionGoal({ goalId: 'a', endEffectors: [{ id: 'hand', jointId: 'leftHand', targetPosition: [-0.3, 1.1, 0.2], priority: 20 }] }),
  createMotionGoal({
    goalId: 'b',
    endEffectors: [
      { id: 'hand', jointId: 'leftHand', targetPosition: [-0.4, 1.2, 0.3], priority: 50 },
      { id: 'foot', jointId: 'rightFoot', targetPosition: [0.1, 0.1, 0.2], priority: 80 },
    ],
  }),
);
assert.equal(merged.endEffectors.length, 2);
assert.equal(merged.endEffectors[0].id, 'foot');
assert.deepEqual(merged.endEffectors.find((item) => item.id === 'hand').targetPosition, [-0.4, 1.2, 0.3]);

const unknownJoint = normalizeMotionGoal({ goalId: 'bad-joint', endEffectors: [{ jointId: 'leftTentacle', targetPosition: [0, 1, 0] }] });
assert.equal(validateMotionGoal(unknownJoint, { jointIds: adapter.getJointIds() }).valid, false);
assert.match(validateMotionGoal(unknownJoint, { jointIds: adapter.getJointIds() }).errors.join(' '), /Unknown jointId/);

const invalidNumber = structuredClone(base);
invalidNumber.timing.duration = Number.NaN;
assert.equal(validateMotionGoal(invalidNumber).valid, false);
const invalidDirection = structuredClone(base);
invalidDirection.orientation.forward = [0, 0, 2];
assert.match(validateMotionGoal(invalidDirection).errors.join(' '), /normalized/);
const forbiddenScale = structuredClone(base);
forbiddenScale.metadata.boneScale = [1, 1, 1];
assert.match(validateMotionGoal(forbiddenScale).errors.join(' '), /forbidden/);
assert.equal(JSON.stringify(base).includes('"boneScale"'), false);
assert.equal(JSON.stringify(base).includes('"boneMatrix"'), false);

assert.equal(normalizeMotionGoal(base).endEffectors[0].priority, 30);
console.log('PASS MotionGoal schema, normalization, mirror, body scaling, relative space, merge priority, and validation');
