import {
  cross3,
  dot3,
  finiteVector3,
  normalize3,
  normalizeQuaternion,
  quaternionFromBasis,
  rotateVector,
  subtract3,
} from '../production-rig-v1/rig-quality-metrics-v1.js';

export const HYBRID_SKELETON_TRANSFORM_RESOLVER_V1_SCHEMA = 'humanoid_rig/hybrid_skeleton_transform_resolver@1.0';

const IDENTITY_MATRIX = Object.freeze([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

export function identityMatrix4() {
  return [...IDENTITY_MATRIX];
}

export function createFrameMatrix(position, quaternion) {
  const [x, y, z, w] = normalizeQuaternion(quaternion);
  const [tx, ty, tz] = finiteVector3(position);
  const xx = x * x; const xy = x * y; const xz = x * z; const xw = x * w;
  const yy = y * y; const yz = y * z; const yw = y * w;
  const zz = z * z; const zw = z * w;
  return [
    1 - 2 * (yy + zz), 2 * (xy + zw), 2 * (xz - yw), 0,
    2 * (xy - zw), 1 - 2 * (xx + zz), 2 * (yz + xw), 0,
    2 * (xz + yw), 2 * (yz - xw), 1 - 2 * (xx + yy), 0,
    tx, ty, tz, 1,
  ];
}

export function multiplyMatrix4(left, right) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let index = 0; index < 4; index += 1) {
        result[column * 4 + row] += left[index * 4 + row] * right[column * 4 + index];
      }
    }
  }
  return result;
}

export function invertRigidFrameMatrix(position, quaternion) {
  const source = normalizeQuaternion(quaternion);
  const inverse = [-source[0], -source[1], -source[2], source[3]];
  const translated = rotateVector(finiteVector3(position).map((value) => -value), inverse);
  return createFrameMatrix(translated, inverse);
}

export function transformPoint3(matrix, point) {
  const [x, y, z] = finiteVector3(point);
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

export function transformDirection3(matrix, direction) {
  const [x, y, z] = finiteVector3(direction);
  return normalize3([
    matrix[0] * x + matrix[4] * y + matrix[8] * z,
    matrix[1] * x + matrix[5] * y + matrix[9] * z,
    matrix[2] * x + matrix[6] * y + matrix[10] * z,
  ]);
}

export function determinantMatrix3(matrix) {
  const a = matrix[0]; const b = matrix[4]; const c = matrix[8];
  const d = matrix[1]; const e = matrix[5]; const f = matrix[9];
  const g = matrix[2]; const h = matrix[6]; const i = matrix[10];
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

export function resolveHybridSkeletonTransformsV1(moduleMap, simulationRigFrame) {
  if (!Array.isArray(moduleMap) || !moduleMap.length) throw new Error('Hybrid Skeleton module map is empty.');
  if (!simulationRigFrame?.joints) throw new Error('Hybrid Skeleton requires a SimulationRig frame.');
  return moduleMap.map((record) => {
    const currentFrame = resolveHybridSkeletonSourceFrameV1(record, simulationRigFrame);
    const currentWorldMatrix = multiplyMatrix4(currentFrame.matrix, record.restLocalMatrix);
    return {
      schema: HYBRID_SKELETON_TRANSFORM_RESOLVER_V1_SCHEMA,
      moduleId: record.moduleId,
      transformMode: record.transformMode,
      authority: 'display-derived',
      writesHumanRigCore: false,
      writesFinalPose: false,
      currentWorldMatrix,
      determinant: determinantMatrix3(currentWorldMatrix),
      framePosition: [...currentFrame.position],
      frameQuaternion: [...currentFrame.quaternion],
      frameDiagnostics: currentFrame.diagnostics,
    };
  });
}

export function resolveHybridSkeletonSourceFrameV1(record, simulationRigFrame) {
  const joints = simulationRigFrame?.joints ?? {};
  const get = (jointId) => {
    const joint = joints[jointId];
    if (!joint) throw new Error(`Hybrid Skeleton cannot resolve source joint ${jointId} for ${record.moduleId}.`);
    return joint;
  };
  if (record.frameKind === 'joint') {
    const joint = get(record.originJointId);
    return frame(joint.worldPosition, joint.worldRotation, { frameKind: 'joint', originJointId: record.originJointId });
  }
  if (record.frameKind === 'segment') {
    const start = get(record.startJointId);
    const end = get(record.endJointId);
    return frame(start.worldPosition, start.worldRotation, {
      frameKind: 'segment',
      startJointId: record.startJointId,
      endJointId: record.endJointId,
      segmentDirection: normalize3(subtract3(end.worldPosition, start.worldPosition)),
    });
  }
  if (record.frameKind === 'thorax') {
    const chest = get('chest');
    const upperChest = get('upperChest');
    const yAxis = normalize3(subtract3(upperChest.worldPosition, chest.worldPosition), [0, 1, 0]);
    const xSeed = rotateVector([1, 0, 0], upperChest.worldRotation);
    const xAxis = orthogonalized(xSeed, yAxis, [1, 0, 0]);
    const zAxis = normalize3(cross3(xAxis, yAxis), [0, 0, 1]);
    return frame(chest.worldPosition, quaternionFromBasis(xAxis, yAxis, zAxis), {
      frameKind: 'thorax', sourceJointIds: ['chest', 'upperChest'], xAxis, yAxis, zAxis,
    });
  }
  if (record.frameKind === 'scapula') {
    const upperChest = get('upperChest');
    const shoulder = get(record.shoulderJointId);
    const upperArm = get(record.upperArmJointId);
    const upperArmDirection = normalize3(subtract3(upperArm.worldPosition, shoulder.worldPosition));
    const expectedLateral = rotateVector(record.side === 'left' ? [-1, 0, 0] : [1, 0, 0], upperChest.worldRotation);
    const lateralHemisphere = dot3(expectedLateral, upperArmDirection) >= 0 ? 'expected' : 'opposed';
    return frame(shoulder.worldPosition, upperChest.worldRotation, {
      frameKind: 'scapula',
      sourceJointIds: ['upperChest', record.shoulderJointId, record.upperArmJointId],
      upperArmDirection,
      lateralHemisphere,
      side: record.side,
    });
  }
  throw new Error(`Unknown Hybrid Skeleton frame kind ${record.frameKind} for ${record.moduleId}.`);
}

function frame(position, quaternion, diagnostics) {
  const normalizedPosition = finiteVector3(position);
  const normalizedQuaternion = normalizeQuaternion(quaternion);
  return {
    position: normalizedPosition,
    quaternion: normalizedQuaternion,
    matrix: createFrameMatrix(normalizedPosition, normalizedQuaternion),
    diagnostics,
  };
}

function orthogonalized(seed, axis, fallback) {
  const projection = dot3(seed, axis);
  const candidate = seed.map((value, index) => value - axis[index] * projection);
  if (Math.hypot(...candidate) > 1e-9) return normalize3(candidate, fallback);
  const secondary = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return normalize3(cross3(secondary, axis), fallback);
}
