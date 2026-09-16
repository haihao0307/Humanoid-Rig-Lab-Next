const EPSILON = 1e-8;
const DEFAULT_TOLERANCE = 1e-6;

export const CHICKEN_PHASE1_REQUIRED_JOINT_IDS = Object.freeze([
  'body_root',
  'pelvis',
  'chest',
  'neck_c0',
  'neck_c1',
  'head',
  'wing_l',
  'wing_r',
  'hip_l',
  'knee_l',
  'ankle_l',
  'toe_l',
  'hip_r',
  'knee_r',
  'ankle_r',
  'toe_r',
  'tail'
]);

const DEFAULT_ALIASES = Object.freeze({
  body_root: ['body_root', 'BodyRoot', 'root', 'Root', 'chicken_root'],
  pelvis: ['pelvis', 'Pelvis', 'body', 'Body'],
  chest: ['chest', 'Chest', 'thorax', 'Thorax'],
  neck_c0: ['neck_c0', 'NeckC0', 'neck0', 'Neck0', 'neck_base'],
  neck_c1: ['neck_c1', 'NeckC1', 'neck1', 'Neck1', 'neck_tip'],
  head: ['head', 'Head'],
  wing_l: ['wing_l', 'Wing_L', 'left_wing', 'LeftWing'],
  wing_r: ['wing_r', 'Wing_R', 'right_wing', 'RightWing'],
  hip_l: ['hip_l', 'Hip_L', 'left_hip', 'LeftHip'],
  knee_l: ['knee_l', 'Knee_L', 'left_knee', 'LeftKnee'],
  ankle_l: ['ankle_l', 'Ankle_L', 'left_ankle', 'LeftAnkle'],
  toe_l: ['toe_l', 'Toe_L', 'left_toe', 'LeftToe'],
  hip_r: ['hip_r', 'Hip_R', 'right_hip', 'RightHip'],
  knee_r: ['knee_r', 'Knee_R', 'right_knee', 'RightKnee'],
  ankle_r: ['ankle_r', 'Ankle_R', 'right_ankle', 'RightAnkle'],
  toe_r: ['toe_r', 'Toe_R', 'right_toe', 'RightToe'],
  tail: ['tail', 'Tail', 'tail_root', 'TailRoot']
});

export class ChickenRigAdapterError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ChickenRigAdapterError';
    this.code = code;
    this.details = details;
  }
}

const finite = (value) => Number.isFinite(value);

function assertFiniteNumber(value, label) {
  if (!finite(value)) {
    throw new ChickenRigAdapterError('INVALID_NUMBER', `${label} must be finite`, { label, value });
  }
}

function readVector3(value, label) {
  if (!value || !finite(value.x) || !finite(value.y) || !finite(value.z)) {
    throw new ChickenRigAdapterError('INVALID_VECTOR3', `${label} must expose finite x/y/z values`, { label });
  }
  return [value.x, value.y, value.z];
}

function writeVector3(target, value) {
  if (typeof target.set === 'function') target.set(value[0], value[1], value[2]);
  else {
    target.x = value[0];
    target.y = value[1];
    target.z = value[2];
  }
}

function readQuaternion(value, label) {
  if (!value || !finite(value.x) || !finite(value.y) || !finite(value.z) || !finite(value.w)) {
    throw new ChickenRigAdapterError('INVALID_QUATERNION', `${label} must expose finite x/y/z/w values`, { label });
  }
  return normalizeQuaternion([value.x, value.y, value.z, value.w], label);
}

function writeQuaternion(target, value) {
  const normalized = normalizeQuaternion(value, 'quaternion write');
  if (typeof target.set === 'function') target.set(normalized[0], normalized[1], normalized[2], normalized[3]);
  else {
    target.x = normalized[0];
    target.y = normalized[1];
    target.z = normalized[2];
    target.w = normalized[3];
  }
}

function normalizeQuaternion(value, label = 'quaternion') {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  if (!finite(length) || length < EPSILON) {
    throw new ChickenRigAdapterError('DEGENERATE_QUATERNION', `${label} has zero or invalid length`, { label, value });
  }
  return value.map((component) => component / length);
}

function multiplyQuaternion(a, b) {
  return normalizeQuaternion([
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ]);
}

function quaternionFromAxisAngle(axis, angle) {
  assertFiniteNumber(angle, 'axis-angle rotation');
  const length = Math.hypot(axis[0], axis[1], axis[2]);
  if (!finite(length) || length < EPSILON) {
    throw new ChickenRigAdapterError('INVALID_AXIS', 'rotation axis must be non-zero and finite', { axis });
  }
  const half = angle * 0.5;
  const scale = Math.sin(half) / length;
  return normalizeQuaternion([axis[0] * scale, axis[1] * scale, axis[2] * scale, Math.cos(half)]);
}

function quaternionFromEulerXYZ(x, y, z) {
  assertFiniteNumber(x, 'euler x');
  assertFiniteNumber(y, 'euler y');
  assertFiniteNumber(z, 'euler z');
  const qx = quaternionFromAxisAngle([1, 0, 0], x);
  const qy = quaternionFromAxisAngle([0, 1, 0], y);
  const qz = quaternionFromAxisAngle([0, 0, 1], z);
  return multiplyQuaternion(multiplyQuaternion(qx, qy), qz);
}

function approximatelyEqual(a, b, tolerance) {
  return Math.abs(a - b) <= tolerance;
}

function vectorApproximatelyEqual(a, b, tolerance) {
  return a.every((value, index) => approximatelyEqual(value, b[index], tolerance));
}

function discoverNamedNodes(root) {
  const nodes = new Map();
  if (!root) return nodes;
  if (typeof root.traverse === 'function') {
    root.traverse((node) => {
      if (node?.name && !nodes.has(node.name)) nodes.set(node.name, node);
    });
    return nodes;
  }
  const queue = [root];
  const visited = new Set();
  while (queue.length) {
    const node = queue.shift();
    if (!node || visited.has(node)) continue;
    visited.add(node);
    if (node.name && !nodes.has(node.name)) nodes.set(node.name, node);
    for (const child of node.children || []) queue.push(child);
  }
  return nodes;
}

function resolveJoint(canonicalId, rig, options, namedNodes) {
  if (typeof options.resolveJoint === 'function') {
    const resolved = options.resolveJoint(canonicalId, rig);
    if (resolved) return resolved;
  }

  const direct = options.joints instanceof Map
    ? options.joints.get(canonicalId)
    : options.joints?.[canonicalId];
  if (direct) return direct;

  const mapping = options.jointMap?.[canonicalId];
  if (mapping && typeof mapping === 'object' && !Array.isArray(mapping)) return mapping;

  const candidates = [];
  if (typeof mapping === 'string') candidates.push(mapping);
  else if (Array.isArray(mapping)) candidates.push(...mapping);
  candidates.push(...(options.aliases?.[canonicalId] || []));
  candidates.push(...(DEFAULT_ALIASES[canonicalId] || []));
  if (!candidates.includes(canonicalId)) candidates.unshift(canonicalId);

  for (const name of candidates) {
    if (namedNodes.has(name)) return namedNodes.get(name);
    if (typeof rig?.getObjectByName === 'function') {
      const object = rig.getObjectByName(name);
      if (object) return object;
    }
  }
  return null;
}

function validateTransformNode(node, canonicalId) {
  if (!node || !node.position || !node.quaternion) {
    throw new ChickenRigAdapterError(
      'INVALID_RIG_NODE',
      `joint ${canonicalId} must expose position and quaternion transforms`,
      { canonicalId }
    );
  }
  readVector3(node.position, `${canonicalId}.position`);
  readQuaternion(node.quaternion, `${canonicalId}.quaternion`);
  if (node.scale) readVector3(node.scale, `${canonicalId}.scale`);
}

function captureTransform(node, canonicalId) {
  return Object.freeze({
    position: Object.freeze(readVector3(node.position, `${canonicalId}.position`)),
    quaternion: Object.freeze(readQuaternion(node.quaternion, `${canonicalId}.quaternion`)),
    scale: Object.freeze(node.scale ? readVector3(node.scale, `${canonicalId}.scale`) : [1, 1, 1])
  });
}

function validateLeg(value, label) {
  if (!value || typeof value !== 'object') {
    throw new ChickenRigAdapterError('INVALID_POSE', `${label} leg pose is missing`, { label });
  }
  for (const key of ['hipPitch', 'kneePitch', 'footPitch', 'lift']) {
    assertFiniteNumber(value[key], `${label}.${key}`);
  }
  if (typeof value.contact !== 'boolean') {
    throw new ChickenRigAdapterError('INVALID_POSE', `${label}.contact must be boolean`, { label });
  }
}

export function validateChickenPhase1Pose(pose) {
  if (!pose || typeof pose !== 'object') {
    throw new ChickenRigAdapterError('INVALID_POSE', 'pose must be an object');
  }
  if (pose.version !== 'chicken_phase1_pose@1.0') {
    throw new ChickenRigAdapterError('UNSUPPORTED_POSE_VERSION', 'unsupported chicken pose version', {
      version: pose.version
    });
  }
  if (!pose.root || !Array.isArray(pose.root.position) || pose.root.position.length !== 3) {
    throw new ChickenRigAdapterError('INVALID_POSE', 'pose.root.position must be a three-component array');
  }
  pose.root.position.forEach((value, index) => assertFiniteNumber(value, `root.position[${index}]`));
  for (const [objectName, keys] of [
    ['root', ['yaw', 'speed']],
    ['body', ['yOffset', 'pitch', 'roll']],
    ['neck', ['yaw', 'pitch', 'extend']],
    ['head', ['yaw', 'pitch']],
    ['wings', ['leftOpen', 'rightOpen']]
  ]) {
    const object = pose[objectName];
    if (!object || typeof object !== 'object') {
      throw new ChickenRigAdapterError('INVALID_POSE', `pose.${objectName} is missing`, { objectName });
    }
    for (const key of keys) assertFiniteNumber(object[key], `${objectName}.${key}`);
  }
  validateLeg(pose.legs?.left, 'legs.left');
  validateLeg(pose.legs?.right, 'legs.right');
  for (const key of ['leftFoot', 'rightFoot', 'bill']) {
    if (typeof pose.contacts?.[key] !== 'boolean') {
      throw new ChickenRigAdapterError('INVALID_POSE', `contacts.${key} must be boolean`, { key });
    }
  }
  return pose;
}

function defaultOptions(options) {
  return {
    strict: options.strict !== false,
    requiredJointIds: options.requiredJointIds || CHICKEN_PHASE1_REQUIRED_JOINT_IDS,
    rootJointId: options.rootJointId || 'body_root',
    rootTranslationMode: options.rootTranslationMode || 'relative',
    rootPositionScale: options.rootPositionScale ?? 1,
    rootPositionOffset: options.rootPositionOffset || [0, 0, 0],
    headingOffsetRad: options.headingOffsetRad ?? 0,
    headingSign: options.headingSign ?? 1,
    bodyPitchGain: options.bodyPitchGain ?? 1,
    bodyRollGain: options.bodyRollGain ?? 1,
    neckPitchGain: options.neckPitchGain ?? 1,
    neckYawGain: options.neckYawGain ?? 1,
    headPitchGain: options.headPitchGain ?? 1,
    headYawGain: options.headYawGain ?? 1,
    legPitchGain: options.legPitchGain ?? 1,
    wingOpenAngleRad: options.wingOpenAngleRad ?? 0.82,
    wingLeftSign: options.wingLeftSign ?? -1,
    wingRightSign: options.wingRightSign ?? 1,
    preserveNonRootPositions: options.preserveNonRootPositions !== false,
    preserveScale: options.preserveScale !== false,
    throwOnInvariantViolation: options.throwOnInvariantViolation !== false,
    tolerance: options.tolerance ?? DEFAULT_TOLERANCE,
    joints: options.joints,
    jointMap: options.jointMap,
    aliases: options.aliases,
    resolveJoint: options.resolveJoint
  };
}

function localDeltaFromEuler(x, y, z) {
  return quaternionFromEulerXYZ(x, y, z);
}

function setLocalRotation(node, bindTransform, x = 0, y = 0, z = 0) {
  const delta = localDeltaFromEuler(x, y, z);
  writeQuaternion(node.quaternion, multiplyQuaternion(bindTransform.quaternion, delta));
}

function setRootRotation(node, bindTransform, yaw) {
  const worldYaw = quaternionFromAxisAngle([0, 1, 0], yaw);
  writeQuaternion(node.quaternion, multiplyQuaternion(worldYaw, bindTransform.quaternion));
}

function cloneDiagnostic(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export function createChickenPhase1RigAdapter(rig, userOptions = {}) {
  if (!rig || typeof rig !== 'object') {
    throw new ChickenRigAdapterError('INVALID_RIG', 'rig root must be an object');
  }
  const options = defaultOptions(userOptions);
  for (const [index, value] of options.rootPositionOffset.entries()) {
    assertFiniteNumber(value, `rootPositionOffset[${index}]`);
  }
  if (!Array.isArray(options.rootPositionOffset) || options.rootPositionOffset.length !== 3) {
    throw new ChickenRigAdapterError('INVALID_ROOT_OFFSET', 'rootPositionOffset must be a three-component array');
  }
  if (!['relative', 'absolute'].includes(options.rootTranslationMode)) {
    throw new ChickenRigAdapterError('INVALID_ROOT_TRANSLATION_MODE', 'rootTranslationMode must be relative or absolute', {
      rootTranslationMode: options.rootTranslationMode
    });
  }
  assertFiniteNumber(options.rootPositionScale, 'rootPositionScale');
  assertFiniteNumber(options.headingOffsetRad, 'headingOffsetRad');
  assertFiniteNumber(options.headingSign, 'headingSign');
  assertFiniteNumber(options.tolerance, 'tolerance');

  const namedNodes = discoverNamedNodes(rig);
  const joints = new Map();
  const missingJoints = [];
  for (const canonicalId of options.requiredJointIds) {
    const node = resolveJoint(canonicalId, rig, options, namedNodes);
    if (!node) {
      missingJoints.push(canonicalId);
      continue;
    }
    validateTransformNode(node, canonicalId);
    joints.set(canonicalId, node);
  }

  if (!joints.has(options.rootJointId)) {
    const rootNode = resolveJoint(options.rootJointId, rig, options, namedNodes);
    if (rootNode) {
      validateTransformNode(rootNode, options.rootJointId);
      joints.set(options.rootJointId, rootNode);
    } else if (!missingJoints.includes(options.rootJointId)) {
      missingJoints.push(options.rootJointId);
    }
  }

  if (options.strict && missingJoints.length) {
    throw new ChickenRigAdapterError(
      'MISSING_REQUIRED_JOINTS',
      `rig is missing required chicken joints: ${missingJoints.join(', ')}`,
      { missingJoints: [...missingJoints] }
    );
  }

  const bindTransforms = new Map();
  for (const [canonicalId, node] of joints) {
    bindTransforms.set(canonicalId, captureTransform(node, canonicalId));
  }

  const rootNode = joints.get(options.rootJointId);
  if (!rootNode) {
    throw new ChickenRigAdapterError('MISSING_ROOT', `root joint ${options.rootJointId} could not be resolved`);
  }
  const rootBind = bindTransforms.get(options.rootJointId);
  let lastPose = null;
  let lastInvariantReport = null;
  let applyCount = 0;

  function getJoint(canonicalId) {
    return joints.get(canonicalId) || null;
  }

  function applyJointRotation(canonicalId, x, y, z) {
    const node = getJoint(canonicalId);
    const bind = bindTransforms.get(canonicalId);
    if (!node || !bind) return false;
    setLocalRotation(node, bind, x, y, z);
    return true;
  }

  function verifyInvariants({ throwOnFailure = options.throwOnInvariantViolation } = {}) {
    const violations = [];
    for (const [canonicalId, node] of joints) {
      const bind = bindTransforms.get(canonicalId);
      const isRoot = canonicalId === options.rootJointId;
      const currentPosition = readVector3(node.position, `${canonicalId}.position`);
      const currentScale = node.scale ? readVector3(node.scale, `${canonicalId}.scale`) : [1, 1, 1];
      let quaternionLength;
      try {
        const rawQuaternion = [node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w];
        if (!rawQuaternion.every(finite)) throw new Error('quaternion contains a non-finite component');
        quaternionLength = Math.hypot(...rawQuaternion);
        if (quaternionLength < EPSILON) throw new Error('quaternion has zero length');
      } catch (error) {
        violations.push({ type: 'invalid_quaternion', joint: canonicalId, message: error.message });
        continue;
      }
      if (!approximatelyEqual(quaternionLength, 1, options.tolerance * 10)) {
        violations.push({ type: 'quaternion_not_normalized', joint: canonicalId, quaternionLength });
      }
      if (!isRoot && options.preserveNonRootPositions && !vectorApproximatelyEqual(currentPosition, bind.position, options.tolerance)) {
        violations.push({ type: 'non_root_position_changed', joint: canonicalId, expected: bind.position, actual: currentPosition });
      }
      if (options.preserveScale && !vectorApproximatelyEqual(currentScale, bind.scale, options.tolerance)) {
        violations.push({ type: 'scale_changed', joint: canonicalId, expected: bind.scale, actual: currentScale });
      }
    }
    const report = Object.freeze({
      passed: violations.length === 0,
      violationCount: violations.length,
      violations: Object.freeze(violations.map((violation) => Object.freeze(violation)))
    });
    lastInvariantReport = report;
    if (!report.passed && throwOnFailure) {
      throw new ChickenRigAdapterError('RIG_INVARIANT_VIOLATION', 'chicken rig invariants were violated', {
        violations
      });
    }
    return report;
  }

  function applyPose(rawPose) {
    const pose = validateChickenPhase1Pose(rawPose);
    const rootPosition = pose.root.position.map((value) => value * options.rootPositionScale);
    const targetRootPosition = options.rootTranslationMode === 'absolute'
      ? [
          rootPosition[0] + options.rootPositionOffset[0],
          rootPosition[1] + pose.body.yOffset + options.rootPositionOffset[1],
          rootPosition[2] + options.rootPositionOffset[2]
        ]
      : [
          rootBind.position[0] + rootPosition[0] + options.rootPositionOffset[0],
          rootBind.position[1] + rootPosition[1] + pose.body.yOffset + options.rootPositionOffset[1],
          rootBind.position[2] + rootPosition[2] + options.rootPositionOffset[2]
        ];
    writeVector3(rootNode.position, targetRootPosition);
    setRootRotation(
      rootNode,
      rootBind,
      options.headingOffsetRad + pose.root.yaw * options.headingSign
    );

    applyJointRotation('pelvis', pose.body.pitch * options.bodyPitchGain * 0.45, 0, pose.body.roll * options.bodyRollGain * 0.42);
    applyJointRotation('chest', pose.body.pitch * options.bodyPitchGain * 0.55, 0, pose.body.roll * options.bodyRollGain * 0.58);

    const neckPitch = pose.neck.pitch * options.neckPitchGain;
    const neckYaw = pose.neck.yaw * options.neckYawGain;
    applyJointRotation('neck_c0', neckPitch * 0.55, neckYaw * 0.46, 0);
    applyJointRotation('neck_c1', neckPitch * 0.45, neckYaw * 0.54, 0);
    applyJointRotation('head', pose.head.pitch * options.headPitchGain, pose.head.yaw * options.headYawGain, 0);

    applyJointRotation('hip_l', pose.legs.left.hipPitch * options.legPitchGain, 0, 0);
    applyJointRotation('knee_l', pose.legs.left.kneePitch * options.legPitchGain, 0, 0);
    applyJointRotation('ankle_l', pose.legs.left.footPitch * options.legPitchGain, 0, 0);
    applyJointRotation('hip_r', pose.legs.right.hipPitch * options.legPitchGain, 0, 0);
    applyJointRotation('knee_r', pose.legs.right.kneePitch * options.legPitchGain, 0, 0);
    applyJointRotation('ankle_r', pose.legs.right.footPitch * options.legPitchGain, 0, 0);

    applyJointRotation('wing_l', 0, 0, pose.wings.leftOpen * options.wingOpenAngleRad * options.wingLeftSign);
    applyJointRotation('wing_r', 0, 0, pose.wings.rightOpen * options.wingOpenAngleRad * options.wingRightSign);

    if (typeof rig.updateMatrixWorld === 'function') rig.updateMatrixWorld(true);
    const invariantReport = verifyInvariants();
    lastPose = cloneDiagnostic(pose);
    applyCount += 1;

    return Object.freeze({
      applied: true,
      applyCount,
      state: pose.state,
      rootPosition: Object.freeze([...targetRootPosition]),
      contacts: Object.freeze({ ...pose.contacts }),
      ignoredChannels: Object.freeze({
        neckExtend: pose.neck.extend,
        leftLegLift: pose.legs.left.lift,
        rightLegLift: pose.legs.right.lift,
        reason: 'non-root translation channels are intentionally blocked; the rendered chain must realize motion through rotations'
      }),
      invariantReport
    });
  }

  function reset() {
    for (const [canonicalId, node] of joints) {
      const bind = bindTransforms.get(canonicalId);
      writeVector3(node.position, bind.position);
      writeQuaternion(node.quaternion, bind.quaternion);
      if (node.scale) writeVector3(node.scale, bind.scale);
    }
    if (typeof rig.updateMatrixWorld === 'function') rig.updateMatrixWorld(true);
    lastPose = null;
    lastInvariantReport = verifyInvariants();
    return lastInvariantReport;
  }

  function diagnostics() {
    return Object.freeze({
      schema: 'life_ecosystem/chicken_phase1_rig_adapter_diagnostics@1.0',
      applyCount,
      strict: options.strict,
      rootJointId: options.rootJointId,
      resolvedJointIds: Object.freeze([...joints.keys()]),
      missingJointIds: Object.freeze([...missingJoints]),
      lastState: lastPose?.state ?? null,
      lastContacts: lastPose?.contacts ? Object.freeze({ ...lastPose.contacts }) : null,
      lastEvents: lastPose?.events ? Object.freeze(lastPose.events.map((event) => Object.freeze({ ...event }))) : Object.freeze([]),
      lastInvariantReport,
      nonRootTranslationPolicy: 'blocked',
      scalePolicy: 'preserved'
    });
  }

  return Object.freeze({
    applyPose,
    reset,
    verifyInvariants,
    diagnostics,
    getJoint,
    resolvedJointIds: Object.freeze([...joints.keys()]),
    missingJointIds: Object.freeze([...missingJoints])
  });
}
