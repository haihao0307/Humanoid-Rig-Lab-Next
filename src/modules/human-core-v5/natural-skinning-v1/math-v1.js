import {
  conjugateQuaternion,
  multiplyQuaternions,
  normalizeQuaternion,
  quaternionDot,
  rotateVectorByQuaternion,
  slerpQuaternion,
} from '../../animation/quaternion.js';

export const IDENTITY_QUATERNION = Object.freeze([0, 0, 0, 1]);

export function add3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
export function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function scale3(value, scale) { return [value[0] * scale, value[1] * scale, value[2] * scale]; }
export function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
export function length3(value) { return Math.hypot(value[0], value[1], value[2]); }
export function distance3(a, b) { return length3(sub3(a, b)); }
export function normalize3(value, fallback = [0, 1, 0]) { const length = length3(value); return length > 1e-12 ? scale3(value, 1 / length) : [...fallback]; }
export function lerp3(a, b, alpha) { return [a[0] + (b[0] - a[0]) * alpha, a[1] + (b[1] - a[1]) * alpha, a[2] + (b[2] - a[2]) * alpha]; }
export function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }

export function composeRigidMatrix(rotation = IDENTITY_QUATERNION, translation = [0, 0, 0]) {
  const [x, y, z, w] = normalizeQuaternion(rotation);
  const x2 = x + x; const y2 = y + y; const z2 = z + z;
  const xx = x * x2; const xy = x * y2; const xz = x * z2;
  const yy = y * y2; const yz = y * z2; const zz = z * z2;
  const wx = w * x2; const wy = w * y2; const wz = w * z2;
  return [
    1 - (yy + zz), xy + wz, xz - wy, 0,
    xy - wz, 1 - (xx + zz), yz + wx, 0,
    xz + wy, yz - wx, 1 - (xx + yy), 0,
    translation[0], translation[1], translation[2], 1,
  ];
}

export function multiplyMatrices(a, b) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) for (let row = 0; row < 4; row += 1) {
    for (let index = 0; index < 4; index += 1) result[column * 4 + row] += a[index * 4 + row] * b[column * 4 + index];
  }
  return result;
}

export function invertRigidMatrix(matrix) {
  const rotation = [matrix[0], matrix[1], matrix[2], matrix[4], matrix[5], matrix[6], matrix[8], matrix[9], matrix[10]];
  const translation = [matrix[12], matrix[13], matrix[14]];
  const inverse = [
    rotation[0], rotation[3], rotation[6], 0,
    rotation[1], rotation[4], rotation[7], 0,
    rotation[2], rotation[5], rotation[8], 0,
    0, 0, 0, 1,
  ];
  inverse[12] = -(inverse[0] * translation[0] + inverse[4] * translation[1] + inverse[8] * translation[2]);
  inverse[13] = -(inverse[1] * translation[0] + inverse[5] * translation[1] + inverse[9] * translation[2]);
  inverse[14] = -(inverse[2] * translation[0] + inverse[6] * translation[1] + inverse[10] * translation[2]);
  return inverse;
}

export function transformPoint(matrix, point) {
  return [
    matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
    matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
    matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14],
  ];
}

export function transformDirection(matrix, direction) {
  return normalize3([
    matrix[0] * direction[0] + matrix[4] * direction[1] + matrix[8] * direction[2],
    matrix[1] * direction[0] + matrix[5] * direction[1] + matrix[9] * direction[2],
    matrix[2] * direction[0] + matrix[6] * direction[1] + matrix[10] * direction[2],
  ], direction);
}

export function quaternionPower(quaternion, alpha) {
  return slerpQuaternion(IDENTITY_QUATERNION, quaternion, clamp(alpha, 0, 1));
}

export function rigidMatrixToDualQuaternion(matrix) {
  const rotation = quaternionFromRotationMatrix(matrix);
  const translation = [matrix[12], matrix[13], matrix[14]];
  const dual = multiplyQuaternionRaw([translation[0], translation[1], translation[2], 0], rotation).map((value) => value * 0.5);
  return { real: rotation, dual };
}

export function normalizeDualQuaternion(realInput, dualInput) {
  const length = Math.hypot(...realInput);
  if (length < 1e-12) return { real: [...IDENTITY_QUATERNION], dual: [0, 0, 0, 0] };
  const real = realInput.map((value) => value / length);
  const projection = quaternionDot(real, dualInput) / length;
  const dual = dualInput.map((value, index) => value / length - real[index] * projection);
  return { real, dual };
}

export function blendDualQuaternions(entries) {
  if (!entries.length) return { real: [...IDENTITY_QUATERNION], dual: [0, 0, 0, 0] };
  const reference = entries.find((entry) => entry.weight > 0)?.dualQuaternion.real ?? IDENTITY_QUATERNION;
  const real = [0, 0, 0, 0]; const dual = [0, 0, 0, 0];
  for (const entry of entries) {
    const sign = quaternionDot(reference, entry.dualQuaternion.real) < 0 ? -1 : 1;
    for (let index = 0; index < 4; index += 1) {
      real[index] += entry.dualQuaternion.real[index] * entry.weight * sign;
      dual[index] += entry.dualQuaternion.dual[index] * entry.weight * sign;
    }
  }
  return normalizeDualQuaternion(real, dual);
}

export function transformPointByDualQuaternion(dualQuaternion, point) {
  const real = normalizeQuaternion(dualQuaternion.real);
  const translationQuaternion = multiplyQuaternionRaw(dualQuaternion.dual, conjugateQuaternion(real));
  const translation = [translationQuaternion[0] * 2, translationQuaternion[1] * 2, translationQuaternion[2] * 2];
  return add3(rotateVectorByQuaternion(point, real), translation);
}

export function quaternionFromRotationMatrix(matrix) {
  const m00 = matrix[0]; const m11 = matrix[5]; const m22 = matrix[10]; const trace = m00 + m11 + m22;
  let x; let y; let z; let w;
  if (trace > 0) { const s = Math.sqrt(trace + 1) * 2; w = 0.25 * s; x = (matrix[6] - matrix[9]) / s; y = (matrix[8] - matrix[2]) / s; z = (matrix[1] - matrix[4]) / s; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (matrix[6] - matrix[9]) / s; x = 0.25 * s; y = (matrix[4] + matrix[1]) / s; z = (matrix[8] + matrix[2]) / s; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (matrix[8] - matrix[2]) / s; x = (matrix[4] + matrix[1]) / s; y = 0.25 * s; z = (matrix[9] + matrix[6]) / s; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (matrix[1] - matrix[4]) / s; x = (matrix[8] + matrix[2]) / s; y = (matrix[9] + matrix[6]) / s; z = 0.25 * s; }
  return normalizeQuaternion([x, y, z, w]);
}

export function multiplyQuaternionRaw(a, b) {
  const [ax, ay, az, aw] = a; const [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}

export function composeWorldFrames(joints, localRotations = {}, rootTranslation = [0, 0, 0]) {
  const byId = new Map(joints.map((joint) => [joint.id, joint])); const frames = new Map();
  const resolve = (id) => {
    if (frames.has(id)) return frames.get(id);
    const joint = byId.get(id); if (!joint) throw new Error(`Unknown performance joint ${id}.`);
    const localRotation = normalizeQuaternion(localRotations[id] ?? IDENTITY_QUATERNION);
    if (!joint.parentId || !byId.has(joint.parentId)) {
      const worldRotation = localRotation; const worldPosition = add3(joint.bindWorldPosition, rootTranslation);
      const frame = { worldPosition, worldRotation, worldMatrix: composeRigidMatrix(worldRotation, worldPosition) }; frames.set(id, frame); return frame;
    }
    const parent = resolve(joint.parentId); const localPosition = joint.bindLocalPosition;
    const worldPosition = add3(parent.worldPosition, rotateVectorByQuaternion(localPosition, parent.worldRotation));
    const worldRotation = multiplyQuaternions(parent.worldRotation, localRotation);
    const frame = { worldPosition, worldRotation, worldMatrix: composeRigidMatrix(worldRotation, worldPosition) }; frames.set(id, frame); return frame;
  };
  for (const joint of joints) resolve(joint.id);
  return frames;
}

export function pointSegmentDistance(point, start, end) {
  const delta = sub3(end, start); const lengthSquared = dot3(delta, delta); const alpha = lengthSquared > 1e-12 ? clamp(dot3(sub3(point, start), delta) / lengthSquared, 0, 1) : 0;
  const closest = add3(start, scale3(delta, alpha)); return { distance: distance3(point, closest), alpha, closest };
}
