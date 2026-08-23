import assert from 'node:assert/strict';

import { ContactManager } from '../src/human-motion/controllers/contact-manager.js';
import { InertializationController } from '../src/human-motion/controllers/inertialization-controller.js';
import { LocomotionController } from '../src/human-motion/controllers/locomotion-controller.js';
import { WholeBodyMotionSolver } from '../src/human-motion/solver/whole-body-motion-solver.js';
import { quaternionDot, quaternionFromAxisAngle } from '../src/modules/animation/quaternion.js';

const from = {
  root: { position: [0, 0, 0], rotation: quaternionFromAxisAngle([0, 1, 0], 0.1) },
  joints: { head: { rotation: quaternionFromAxisAngle([0, 1, 0], 0.2) } },
};
const toRotation = quaternionFromAxisAngle([0, 1, 0], 1.2);
const to = {
  root: { position: [1, 0.1, 2], rotation: toRotation.map((value) => -value) },
  joints: { head: { rotation: quaternionFromAxisAngle([0, 1, 0], -0.6) } },
};
const inertialization = new InertializationController({ defaultDuration: 0.3 });
inertialization.beginTransition(from, to, { duration: 0.3, reason: 'goal_replacement' });
const first = inertialization.applyTransition(to, { deltaTime: 1 / 60 });
assert.deepEqual(first.root.position, [0, 0, 0], 'goal replacement jumped on its first frame');
const poses = [first];
for (let index = 0; index < 30; index += 1) poses.push(inertialization.applyTransition(to, { deltaTime: 1 / 60 }));
assert.equal(inertialization.isTransitionActive(), false);
assert.ok(Math.hypot(...poses.at(-1).root.position.map((value, index) => value - to.root.position[index])) < 1e-8);
for (let index = 1; index < poses.length; index += 1) {
  assert.ok(quaternionDot(poses[index - 1].root.rotation, poses[index].root.rotation) > 0, 'quaternion path flipped sign');
}

const solver = new WholeBodyMotionSolver();
solver.setGoal({ goalId: 'root-a', root: { mode: 'position', targetPosition: [0, 0, 0] }, balance: { enabled: false, mode: 'airborne' } });
const a = solver.solve({ deltaTime: 1 / 60, time: 0 });
solver.setGoal({ goalId: 'root-b', root: { mode: 'position', targetPosition: [0.8, 0, 0.5] }, balance: { enabled: false, mode: 'airborne' } });
const replacementFirst = solver.solve({ deltaTime: 1 / 60, time: 1 / 60 });
assert.deepEqual(replacementFirst.root.position, a.root.position, 'WholeBodyMotionSolver goal replacement jumped');
let replacementLast;
for (let index = 0; index < 30; index += 1) replacementLast = solver.solve({ deltaTime: 1 / 60, time: (index + 2) / 60 });
assert.ok(Math.abs(replacementLast.root.position[0] - 0.8) < 1e-6);
assert.ok(Math.abs(replacementLast.root.position[2] - 0.5) < 1e-6);

const contactManager = new ContactManager({ contactBlendIn: 0.1, contactBlendOut: 0.2 });
contactManager.createContact({ contactId: 'support', jointId: 'leftFoot', targetPosition: [-0.1, 0.1, 0] });
contactManager.activateContact('support');
for (let index = 0; index < 10; index += 1) contactManager.update(0.02);
contactManager.releaseContact('support');
const weights = [];
for (let index = 0; index < 10; index += 1) weights.push(contactManager.update(0.02)[0]?.positionWeight ?? 0);
for (let index = 1; index < weights.length; index += 1) assert.ok(weights[index] <= weights[index - 1] + 1e-12);
assert.ok(weights[0] > 0 && weights[0] < 1);

const locomotion = new LocomotionController();
const speeds = [];
for (let index = 0; index < 120; index += 1) speeds.push(locomotion.update({ desiredVelocity: [0, 0, 0.8], speed: 0.8 }, 1 / 60).goal.metadata.locomotion.speed);
assert.ok(speeds[1] > speeds[0] && speeds[0] > 0, 'Idle to Walk did not ease in');
const stop = [];
for (let index = 0; index < 120; index += 1) stop.push(locomotion.update({ desiredVelocity: [0, 0, 0], speed: 0 }, 1 / 60).goal.metadata.locomotion.speed);
assert.ok(stop[0] < speeds.at(-1) && stop[0] > 0, 'Walk to Stop froze');
assert.ok(stop.at(-1) < 0.025);

console.log('PASS inertialized pose/goal transitions, quaternion continuity, contact release, Idle→Walk, and Walk→Stop');
