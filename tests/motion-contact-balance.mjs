import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { ContactManager } from '../src/human-motion/controllers/contact-manager.js';
import {
  buildSupportPolygon,
  computePelvisBalanceCorrection,
  estimateCenterOfMass,
  evaluateBalance,
  isCenterOfMassSupported,
} from '../src/human-motion/controllers/balance-controller.js';
import { createCurrentKinematicAdapter } from '../src/human-motion/solver/current-kinematic-adapter.js';
import { WholeBodyMotionSolver } from '../src/human-motion/solver/whole-body-motion-solver.js';

const contactSchema = JSON.parse(await readFile(new URL('../schemas/motion-contact.schema.json', import.meta.url), 'utf8'));
assert.equal(contactSchema.$id, 'humanoid_rig/motion_contact@1.0');

const manager = new ContactManager({ contactBlendIn: 0.1, contactBlendOut: 0.2 });
manager.createContact({ contactId: 'left', jointId: 'leftFoot', targetPosition: [-0.1, 0.1, 0] });
manager.activateContact('left');
const firstWeight = manager.update(0.01)[0].positionWeight;
assert.ok(firstWeight > 0 && firstWeight < 1, 'contact appeared in one frame');
for (let index = 0; index < 12; index += 1) manager.update(0.01);
assert.ok(manager.getContact('left').positionWeight > 0.99);
manager.releaseContact('left');
const releasedFirst = manager.update(0.01)[0].positionWeight;
assert.ok(releasedFirst > 0 && releasedFirst < 1, 'contact disappeared in one frame');
for (let index = 0; index < 25; index += 1) manager.update(0.01);
assert.equal(manager.getActiveContacts().length, 0);

const kinematic = createCurrentKinematicAdapter();
const pose = { root: { position: [0, 0, 0], rotation: [0, 0, 0, 1] }, joints: {} };
const fk = kinematic.forwardKinematics(pose);
const left = fk.positions.get('leftFoot');
const right = fk.positions.get('rightFoot');
const doubleContacts = [
  { jointId: 'leftFoot', targetPosition: left, positionWeight: 1, active: true },
  { jointId: 'rightFoot', targetPosition: right, positionWeight: 1, active: true },
];
const center = estimateCenterOfMass(fk);
const polygon = buildSupportPolygon(doubleContacts, 'double_support');
assert.ok(polygon.length >= 4);
assert.equal(isCenterOfMassSupported(center, polygon, 0), true);
const doubleBalance = evaluateBalance(fk, doubleContacts, { enabled: true, mode: 'double_support', supportMargin: 0 });
assert.equal(doubleBalance.insideSupport, true);

const singleBalance = evaluateBalance(fk, [doubleContacts[0]], { enabled: true, mode: 'left_support', supportMargin: 0.01 });
assert.ok(singleBalance.pelvisCorrection[0] < 0, 'pelvis did not move toward left support');
const outsideCorrection = computePelvisBalanceCorrection({
  centerOfMass: [2, 1, 2],
  supportPolygon: polygon,
  supportMode: 'double_support',
  supportMargin: 0.01,
});
assert.ok(outsideCorrection[0] < 0 && outsideCorrection[2] < 0);
assert.deepEqual(computePelvisBalanceCorrection({ centerOfMass: [2, 1, 2], supportPolygon: [], supportMode: 'airborne' }), [0, 0, 0]);
assert.ok(buildSupportPolygon([{ jointId: 'leftHand', targetPosition: [-0.4, 1, 0.2], positionWeight: 1, active: true }], 'hand_support').length === 4);
assert.ok(buildSupportPolygon([{ jointId: 'hips', mode: 'seat', targetPosition: [0, 0.7, 0], positionWeight: 1, active: true }], 'seated').length === 4);

const solver = new WholeBodyMotionSolver({ kinematicAdapter: kinematic });
solver.setPose(pose).setGoal({
  goalId: 'contact-lock',
  contacts: [
    { id: 'left_support', jointId: 'leftFoot', position: left, contactBlendIn: 0.02 },
    { id: 'right_support', jointId: 'rightFoot', position: right, contactBlendIn: 0.02 },
  ],
  balance: { enabled: true, mode: 'double_support', supportMargin: 0 },
});
let frame;
for (let index = 0; index < 10; index += 1) frame = solver.solve({ deltaTime: 1 / 60, time: index / 60 });
assert.ok(frame.diagnostics.maxContactError < 0.015);
assert.ok(frame.diagnostics.maxBoneLengthError < 1e-8);
assert.equal(frame.contacts.length, 2);
solver.setGoal({
  goalId: 'left-only',
  contacts: [{ id: 'left_support', jointId: 'leftFoot', position: left, contactBlendIn: 0.02 }],
  balance: { enabled: true, mode: 'left_support', supportMargin: 0 },
});
for (let index = 0; index < 20; index += 1) frame = solver.solve({ deltaTime: 1 / 60, time: 1 + index / 60 });
assert.ok(frame.contacts.some((contact) => contact.jointId === 'leftFoot'));
assert.equal(frame.contacts.some((contact) => contact.jointId === 'rightFoot'), false, 'released swing foot remained locked');

console.log('PASS Contact blend-in/out, world lock, support modes, COM, pelvis correction, and fixed bone lengths');
