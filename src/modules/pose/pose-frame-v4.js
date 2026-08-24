/**
 * The V4 runtime pose frame is deliberately small: it records motion state,
 * never bind state.  The rig definition remains the sole authority for joint
 * hierarchy, rest offsets, bone lengths, and inverse bind matrices.
 */
export const POSE_FRAME_V4_SCHEMA = 'humanoid_rig/pose_frame@4.0';
export const POSE_FRAME_V4_ROTATION_CONVENTION = 'outgoing_bone_parent_rotation';

const IDENTITY = Object.freeze([0, 0, 0, 1]);
const ZERO = Object.freeze([0, 0, 0]);
const FORBIDDEN_TOPOLOGY_FIELDS = new Set([
  'boneLength',
  'boneLengths',
  'bindLocalPosition',
  'bindLocalPositions',
  'bind_local_position',
  'bindWorldPosition',
  'bindWorldPositions',
  'inverseBindMatrices',
  'localPosition',
  'localPositions',
  'parent',
  'parentId',
  'parents',
]);

/**
 * Creates the single-frame local-quaternion authority shared by AnimationRig,
 * SimulationRig, and Skin. `rootRotation` represents `rootJointId` (hips for
 * the current V8 hierarchy); that joint is intentionally omitted from
 * `localRotations` so there is only one root rotation source.
 */
export function createPoseFrameV4(input = {}) {
  assertNoTopologyData(input);
  const rootJointId = String(input.rootJointId || 'hips');
  const sourceRotations = input.localRotations && typeof input.localRotations === 'object'
    ? input.localRotations
    : {};
  const localRotations = {};
  for (const [jointId, value] of Object.entries(sourceRotations)) {
    if (!jointId || jointId === rootJointId) continue;
    localRotations[jointId] = normalizeQuaternion(value?.rotation ?? value);
  }

  return {
    schema: POSE_FRAME_V4_SCHEMA,
    schemaVersion: 4,
    type: 'PoseFrame',
    compatibleRig: String(input.compatibleRig || 'rig@0.4.0'),
    rotationConvention: POSE_FRAME_V4_ROTATION_CONVENTION,
    rootJointId,
    rootPosition: normalizeVector(input.rootPosition, ZERO),
    rootRotation: normalizeQuaternion(input.rootRotation ?? IDENTITY),
    localRotations,
    contacts: normalizeArray(input.contacts),
    ikTargets: normalizeArray(input.ikTargets),
    constraintState: normalizeObject(input.constraintState),
    proportionRevision: normalizeRevision(input.proportionRevision),
    timestamp: normalizeTimestamp(input.timestamp),
  };
}

export function isPoseFrameV4(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && value.type === 'PoseFrame'
    && value.schema === POSE_FRAME_V4_SCHEMA,
  );
}

export function validatePoseFrameV4(value) {
  const errors = [];
  if (!isPoseFrameV4(value)) {
    errors.push(`schema 必须为 ${POSE_FRAME_V4_SCHEMA}，type 必须为 PoseFrame。`);
    return { valid: false, errors };
  }
  if (!String(value.compatibleRig ?? '').trim()) errors.push('缺少 compatibleRig。');
  if (!String(value.rootJointId ?? '').trim()) errors.push('缺少 rootJointId。');
  if (value.rotationConvention !== POSE_FRAME_V4_ROTATION_CONVENTION) {
    errors.push(`rotationConvention 必须为 ${POSE_FRAME_V4_ROTATION_CONVENTION}。`);
  }
  validateVector(value.rootPosition, 3, 'rootPosition', errors);
  validateQuaternion(value.rootRotation, 'rootRotation', errors);
  if (!value.localRotations || typeof value.localRotations !== 'object' || Array.isArray(value.localRotations)) {
    errors.push('localRotations 必须是以稳定关节 ID 为键的对象。');
  } else {
    for (const [jointId, quaternion] of Object.entries(value.localRotations)) {
      if (!jointId) errors.push('localRotations 包含空关节 ID。');
      if (jointId === value.rootJointId) errors.push('rootJointId 的旋转必须只写入 rootRotation。');
      validateQuaternion(quaternion, `localRotations.${jointId}`, errors);
    }
  }
  if (!Array.isArray(value.contacts)) errors.push('contacts 必须是数组。');
  if (!Array.isArray(value.ikTargets)) errors.push('ikTargets 必须是数组。');
  if (!value.constraintState || typeof value.constraintState !== 'object' || Array.isArray(value.constraintState)) {
    errors.push('constraintState 必须是对象。');
  }
  if (!Number.isInteger(value.proportionRevision) || value.proportionRevision < 0) {
    errors.push('proportionRevision 必须是非负整数。');
  }
  if (!Number.isFinite(Number(value.timestamp))) errors.push('timestamp 必须是有限数值。');
  if (containsTopologyData(value)) errors.push('PoseFrame V4 不能携带绑定、骨长或父子层级数据。');
  return { valid: errors.length === 0, errors };
}

export function assertPoseFrameV4(value) {
  const result = validatePoseFrameV4(value);
  if (!result.valid) throw new Error(`Invalid PoseFrame V4: ${result.errors.join(' ')}`);
  return value;
}

export function clonePoseFrameV4(value) {
  assertPoseFrameV4(value);
  return structuredClone(value);
}

function normalizeVector(value, fallback) {
  const source = Array.isArray(value) || ArrayBuffer.isView(value) ? value : fallback;
  return [0, 1, 2].map((index) => Number.isFinite(Number(source[index])) ? Number(source[index]) : fallback[index]);
}

function normalizeQuaternion(value) {
  const source = Array.isArray(value) || ArrayBuffer.isView(value) ? value : IDENTITY;
  const quaternion = [0, 1, 2, 3].map((index) => Number(source[index]));
  if (!quaternion.every(Number.isFinite)) return [...IDENTITY];
  const length = Math.hypot(...quaternion);
  if (length < 1e-12) return [...IDENTITY];
  const normalized = quaternion.map((component) => component / length);
  return normalized[3] < 0 ? normalized.map((component) => -component) : normalized;
}

function normalizeArray(value) {
  return Array.isArray(value) ? structuredClone(value) : [];
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {};
}

function normalizeRevision(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function normalizeTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function validateVector(value, length, path, errors) {
  if (!Array.isArray(value) || value.length !== length || value.some((item) => !Number.isFinite(Number(item)))) {
    errors.push(`${path} 必须包含 ${length} 个有限数值。`);
  }
}

function validateQuaternion(value, path, errors) {
  validateVector(value, 4, path, errors);
  if (!Array.isArray(value) || value.length !== 4) return;
  const length = Math.hypot(...value.map(Number));
  if (!Number.isFinite(length) || Math.abs(length - 1) > 1e-5) {
    errors.push(`${path} 必须是归一化四元数。`);
  }
}

function assertNoTopologyData(value) {
  if (containsTopologyData(value)) {
    throw new Error('PoseFrame V4 cannot contain bind, bone-length, inverse-bind, or parent hierarchy data.');
  }
}

function containsTopologyData(value) {
  const visit = (item) => {
    if (!item || typeof item !== 'object') return false;
    if (Array.isArray(item) || ArrayBuffer.isView(item)) return Array.from(item).some(visit);
    for (const [key, child] of Object.entries(item)) {
      if (FORBIDDEN_TOPOLOGY_FIELDS.has(key)) return true;
      if (visit(child)) return true;
    }
    return false;
  };
  return visit(value);
}
