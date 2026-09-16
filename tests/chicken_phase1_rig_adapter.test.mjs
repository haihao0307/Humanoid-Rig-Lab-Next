import assert from 'node:assert/strict';
import {
  ChickenNpcController,
  ChickenNpcState
} from '../runtime/chicken_phase1_npc_controller.mjs';
import {
  CHICKEN_PHASE1_REQUIRED_JOINT_IDS,
  ChickenRigAdapterError,
  createChickenPhase1RigAdapter,
  validateChickenPhase1Pose
} from '../runtime/chicken_phase1_rig_adapter.mjs';

class FakeVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}

class FakeQuaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }
}

class FakeNode {
  constructor(name, index = 0) {
    this.name = name;
    this.position = new FakeVector3(index * 0.01, index * -0.005, index * 0.002);
    this.quaternion = new FakeQuaternion();
    this.scale = new FakeVector3(1, 1, 1);
    this.children = [];
    this.matrixUpdates = 0;
  }
  add(child) {
    this.children.push(child);
    return this;
  }
  traverse(visitor) {
    visitor(this);
    for (const child of this.children) child.traverse(visitor);
  }
  getObjectByName(name) {
    if (this.name === name) return this;
    for (const child of this.children) {
      const match = child.getObjectByName(name);
      if (match) return match;
    }
    return null;
  }
  updateMatrixWorld() {
    this.matrixUpdates += 1;
  }
}

function buildRig({ omit = [] } = {}) {
  const root = new FakeNode('scene');
  CHICKEN_PHASE1_REQUIRED_JOINT_IDS.forEach((id, index) => {
    if (!omit.includes(id)) root.add(new FakeNode(id, index + 1));
  });
  return root;
}

function vector(node) {
  return [node.position.x, node.position.y, node.position.z];
}

function quaternion(node) {
  return [node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w];
}

function scale(node) {
  return [node.scale.x, node.scale.y, node.scale.z];
}

function snapshotNonRootTransforms(rig) {
  const snapshot = new Map();
  for (const id of CHICKEN_PHASE1_REQUIRED_JOINT_IDS) {
    if (id === 'body_root') continue;
    const node = rig.getObjectByName(id);
    snapshot.set(id, { position: vector(node), scale: scale(node) });
  }
  return snapshot;
}

function assertQuaternionNormalized(node, label) {
  const length = Math.hypot(...quaternion(node));
  assert.ok(Math.abs(length - 1) < 1e-9, `${label} quaternion length ${length}`);
}

{
  const rig = buildRig();
  const adapter = createChickenPhase1RigAdapter(rig);
  assert.deepEqual(adapter.missingJointIds, []);
  assert.deepEqual([...adapter.resolvedJointIds].sort(), [...CHICKEN_PHASE1_REQUIRED_JOINT_IDS].sort());
  assert.equal(adapter.verifyInvariants().passed, true);
}

{
  const rig = buildRig({ omit: ['neck_c1'] });
  assert.throws(
    () => createChickenPhase1RigAdapter(rig),
    (error) => error instanceof ChickenRigAdapterError && error.code === 'MISSING_REQUIRED_JOINTS'
  );
  const relaxed = createChickenPhase1RigAdapter(rig, { strict: false });
  assert.deepEqual(relaxed.missingJointIds, ['neck_c1']);
}

{
  const rig = buildRig();
  const adapter = createChickenPhase1RigAdapter(rig);
  const controller = new ChickenNpcController({ id: 17, seed: 123, position: [0, 0, 0], yaw: Math.PI * 0.8 });
  const before = snapshotNonRootTransforms(rig);
  const rootBefore = vector(rig.getObjectByName('body_root'));
  controller.setIntent({ type: 'moveTo', x: 2.4, z: 0.75, urgency: 0.2 });
  let sawWalk = false;
  let sawChangedLegRotation = false;
  for (let frame = 0; frame < 240; frame++) {
    const pose = controller.update(1 / 60, {});
    sawWalk ||= pose.state === ChickenNpcState.WALK || pose.state === ChickenNpcState.TURN;
    const result = adapter.applyPose(pose);
    assert.equal(result.invariantReport.passed, true);
    const hip = rig.getObjectByName('hip_l');
    sawChangedLegRotation ||= Math.abs(hip.quaternion.x) > 1e-5 || Math.abs(hip.quaternion.w - 1) > 1e-5;
  }
  assert.equal(sawWalk, true);
  assert.equal(sawChangedLegRotation, true);
  assert.notDeepEqual(vector(rig.getObjectByName('body_root')), rootBefore);
  for (const [id, transform] of before) {
    const node = rig.getObjectByName(id);
    assert.deepEqual(vector(node), transform.position, `${id} local position changed`);
    assert.deepEqual(scale(node), transform.scale, `${id} local scale changed`);
    assertQuaternionNormalized(node, id);
  }
  assert.equal(adapter.diagnostics().applyCount, 240);
  assert.equal(adapter.diagnostics().lastInvariantReport.passed, true);
}

{
  const rig = buildRig();
  const adapter = createChickenPhase1RigAdapter(rig, {
    rootTranslationMode: 'absolute',
    rootPositionOffset: [0.3, 0.2, -0.4],
    headingOffsetRad: 0.25
  });
  const controller = new ChickenNpcController({ id: 3, seed: 7, position: [1, 0, 2], yaw: 0.7 });
  const pose = controller.update(1 / 60, { groundHeight: 0.1 });
  const result = adapter.applyPose(pose);
  const root = rig.getObjectByName('body_root');
  assert.ok(Math.abs(root.position.x - (pose.root.position[0] + 0.3)) < 1e-10);
  assert.ok(Math.abs(root.position.y - (pose.root.position[1] + pose.body.yOffset + 0.2)) < 1e-10);
  assert.ok(Math.abs(root.position.z - (pose.root.position[2] - 0.4)) < 1e-10);
  assert.deepEqual(result.contacts, pose.contacts);
  assertQuaternionNormalized(root, 'body_root');
}

{
  const rig = buildRig();
  const adapter = createChickenPhase1RigAdapter(rig);
  const original = new Map();
  for (const id of CHICKEN_PHASE1_REQUIRED_JOINT_IDS) {
    const node = rig.getObjectByName(id);
    original.set(id, { position: vector(node), quaternion: quaternion(node), scale: scale(node) });
  }
  const controller = new ChickenNpcController({ id: 8, seed: 12 });
  controller.setIntent({ type: 'peckAt', x: 0.3, z: 0, duration: 0.8 });
  for (let frame = 0; frame < 30; frame++) adapter.applyPose(controller.update(1 / 60, {}));
  assert.notDeepEqual(quaternion(rig.getObjectByName('neck_c0')), original.get('neck_c0').quaternion);
  const report = adapter.reset();
  assert.equal(report.passed, true);
  for (const [id, transform] of original) {
    const node = rig.getObjectByName(id);
    assert.deepEqual(vector(node), transform.position, `${id} reset position mismatch`);
    assert.deepEqual(quaternion(node), transform.quaternion, `${id} reset quaternion mismatch`);
    assert.deepEqual(scale(node), transform.scale, `${id} reset scale mismatch`);
  }
}

{
  const rig = buildRig();
  const adapter = createChickenPhase1RigAdapter(rig);
  const controller = new ChickenNpcController({ id: 9, seed: 4 });
  controller.setIntent({ type: 'peckAt', x: 0.2, z: 0, duration: 0.8 });
  let sawIgnoredExtension = false;
  const before = snapshotNonRootTransforms(rig);
  for (let frame = 0; frame < 70; frame++) {
    const pose = controller.update(1 / 60, {});
    const result = adapter.applyPose(pose);
    sawIgnoredExtension ||= Math.abs(result.ignoredChannels.neckExtend) > 1e-6;
  }
  assert.equal(sawIgnoredExtension, true);
  for (const [id, transform] of before) {
    const node = rig.getObjectByName(id);
    assert.deepEqual(vector(node), transform.position, `${id} moved through a blocked non-root translation channel`);
  }
}

{
  const controller = new ChickenNpcController({ id: 10, seed: 6 });
  const pose = controller.update(1 / 60, {});
  assert.equal(validateChickenPhase1Pose(pose), pose);
  assert.throws(
    () => validateChickenPhase1Pose({ ...pose, version: 'bad' }),
    (error) => error instanceof ChickenRigAdapterError && error.code === 'UNSUPPORTED_POSE_VERSION'
  );
  assert.throws(
    () => validateChickenPhase1Pose({ ...pose, root: { ...pose.root, yaw: Number.NaN } }),
    (error) => error instanceof ChickenRigAdapterError && error.code === 'INVALID_NUMBER'
  );
}

{
  const rig = buildRig();
  const adapter = createChickenPhase1RigAdapter(rig, { throwOnInvariantViolation: false });
  rig.getObjectByName('knee_l').position.x += 0.05;
  const report = adapter.verifyInvariants();
  assert.equal(report.passed, false);
  assert.ok(report.violations.some((violation) => violation.type === 'non_root_position_changed' && violation.joint === 'knee_l'));
}

console.log('Chicken Phase 1 rig adapter tests passed.');
