import assert from 'node:assert/strict';
import {
  ChickenNpcController,
  ChickenNpcState,
  createChickenVariant,
  stepChickenFlock
} from '../runtime/chicken_phase1_npc_controller.mjs';

function finiteDeep(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteDeep);
  if (value && typeof value === 'object') return Object.values(value).every(finiteDeep);
  return true;
}

function copyBoneLengths(variant) {
  return JSON.stringify(variant.boneLengths);
}

for (let seed = 1; seed <= 200; seed++) {
  const a = createChickenVariant(seed);
  const b = createChickenVariant(seed);
  assert.deepEqual(a, b);
  assert.ok(a.morphology.overallScale >= 0.88 && a.morphology.overallScale <= 1.12);
  assert.ok(a.morphology.legScale >= 0.92 && a.morphology.legScale <= 1.09);
  assert.ok(a.locomotion.walkSpeed > 0 && a.locomotion.runSpeed > a.locomotion.walkSpeed);
  assert.ok(a.collision.bodyRadius > a.collision.headRadius);
}

{
  const controller = new ChickenNpcController({ id: 1, seed: 42, position: [0, 0, 0], yaw: Math.PI });
  const boneLengthsBefore = copyBoneLengths(controller.variant);
  controller.setIntent({ type: 'moveTo', x: 2, z: 1, urgency: 0.2 });
  let pose;
  for (let i = 0; i < 600; i++) pose = controller.update(1 / 60, {});
  assert.ok(controller.position[0] > 0.6, `expected forward progress, got ${controller.position[0]}`);
  assert.ok(Math.abs(controller.yaw) < Math.PI * 0.75, 'facing direction did not update');
  assert.equal(copyBoneLengths(controller.variant), boneLengthsBefore);
  assert.ok(finiteDeep(pose));
}

{
  const controller = new ChickenNpcController({ id: 2, seed: 11 });
  controller.setIntent({ type: 'moveTo', x: 10, z: 0, urgency: 0.1 });
  let sawLeftOnly = false;
  let sawRightOnly = false;
  for (let i = 0; i < 360; i++) {
    const pose = controller.update(1 / 60, {});
    if (pose.contacts.leftFoot && !pose.contacts.rightFoot) sawLeftOnly = true;
    if (pose.contacts.rightFoot && !pose.contacts.leftFoot) sawRightOnly = true;
  }
  assert.ok(sawLeftOnly && sawRightOnly, 'walking contacts did not alternate');
}

{
  const controller = new ChickenNpcController({ id: 3, seed: 7 });
  controller.setIntent({ type: 'peckAt', x: 0.2, z: 0, duration: 0.8 });
  let sawBillContact = false;
  for (let i = 0; i < 120; i++) {
    const pose = controller.update(1 / 60, {});
    sawBillContact ||= pose.contacts.bill;
  }
  assert.ok(sawBillContact, 'peck never contacted the ground');
  assert.equal(controller.state, ChickenNpcState.IDLE);
  assert.equal(controller.taskComplete, true);
}

{
  const controller = new ChickenNpcController({ id: 4, seed: 19 });
  controller.setIntent({ type: 'moveTo', x: 1.0, z: 0, radius: 0.05 });
  let sawReplan = false;
  for (let i = 0; i < 240; i++) {
    const pose = controller.update(1 / 60, {
      obstacles: [{ x: 1.0, z: 0, radius: 0.78 }]
    });
    sawReplan ||= pose.events.some((event) => event.type === 'replan_requested');
  }
  assert.equal(controller.taskComplete, false);
  assert.ok(controller.position[0] > 0.2 || Math.abs(controller.position[2]) > 0.1, 'controller made no avoidance progress');
  assert.ok(sawReplan || Math.abs(controller.position[2]) > 0.08, 'no replan or detour behavior detected');
}

{
  const a = new ChickenNpcController({ id: 10, seed: 100, position: [0, 0, 0] });
  const b = new ChickenNpcController({ id: 11, seed: 101, position: [0.01, 0, 0.01] });
  a.setIntent({ type: 'moveTo', x: 3, z: 0 });
  b.setIntent({ type: 'moveTo', x: 3, z: 0 });
  const initialDistance = Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]);
  for (let i = 0; i < 240; i++) stepChickenFlock([a, b], 1 / 60, {});
  const finalDistance = Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]);
  assert.ok(finalDistance > initialDistance + 0.03, `separation failed: ${initialDistance} -> ${finalDistance}`);
}

{
  const controllers = Array.from({ length: 12 }, (_, index) => {
    const controller = new ChickenNpcController({
      id: index,
      seed: 900 + index,
      position: [(index % 4) * 0.22, 0, Math.floor(index / 4) * 0.22]
    });
    controller.setIntent({ type: 'moveTo', x: 4 + (index % 3) * 0.2, z: (index - 6) * 0.12, urgency: index % 5 === 0 ? 0.8 : 0.2 });
    return controller;
  });
  const boneSignatures = controllers.map((controller) => copyBoneLengths(controller.variant));
  for (let frame = 0; frame < 3600; frame++) {
    const poses = stepChickenFlock(controllers, 1 / 60, {
      obstacles: [
        { x: 1.2, z: 0.1, radius: 0.35 },
        { x: 2.1, z: -0.4, radius: 0.28 }
      ]
    });
    assert.ok(poses.every(finiteDeep), `non-finite pose at frame ${frame}`);
  }
  controllers.forEach((controller, index) => {
    assert.equal(copyBoneLengths(controller.variant), boneSignatures[index]);
    assert.ok(Object.values(ChickenNpcState).includes(controller.state));
  });
}

console.log('Chicken Phase 1 NPC controller tests passed.');
