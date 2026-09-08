export const EPSILON = 1e-8;
export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function saturate(value) {
  return clamp(value, 0, 1);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = saturate((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function inverseLerp(a, b, value) {
  if (Math.abs(b - a) < EPSILON) return 0;
  return (value - a) / (b - a);
}

export function length3(x, y, z) {
  return Math.hypot(x, y, z);
}

export function normalize3(x, y, z) {
  const length = length3(x, y, z);
  if (length < EPSILON) return [0, 1, 0];
  return [x / length, y / length, z / length];
}

export function cross3(ax, ay, az, bx, by, bz) {
  return [
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx,
  ];
}

export function distance3(ax, ay, az, bx, by, bz) {
  return Math.hypot(ax - bx, ay - by, az - bz);
}

export function align4(value) {
  return (value + 3) & ~3;
}

export function assertFiniteNumber(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  return value;
}

export function assertRange(value, min, max, name) {
  assertFiniteNumber(value, name);
  if (value < min || value > max) {
    throw new RangeError(`${name} must be within [${min}, ${max}]`);
  }
  return value;
}

export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (ArrayBuffer.isView(value)) return Array.from(value);
  if (Array.isArray(value)) return value.map(canonicalize);
  const output = {};
  for (const key of Object.keys(value).sort()) {
    const item = value[key];
    if (item !== undefined) output[key] = canonicalize(item);
  }
  return output;
}

export function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

export function fnv1a32Bytes(bytes, seed = 0x811c9dc5) {
  let hash = seed >>> 0;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function hashString32(value, seed = 0x811c9dc5) {
  return fnv1a32Bytes(new TextEncoder().encode(String(value)), seed);
}

export function hashTypedArrays32(arrays, seed = 0x811c9dc5) {
  let hash = seed >>> 0;
  for (const array of arrays) {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    hash = fnv1a32Bytes(bytes, hash);
  }
  return hash >>> 0;
}

export function hex32(value) {
  return (value >>> 0).toString(16).padStart(8, '0');
}

export function deepFreeze(object) {
  if (!object || typeof object !== 'object' || Object.isFrozen(object)) return object;
  Object.freeze(object);
  for (const value of Object.values(object)) deepFreeze(value);
  return object;
}

export function copyMatrix4(source, sourceOffset, target, targetOffset) {
  for (let index = 0; index < 16; index += 1) {
    target[targetOffset + index] = source[sourceOffset + index];
  }
}

export function transformPointMat4(matrix, offset, x, y, z) {
  const m = matrix;
  return [
    m[offset] * x + m[offset + 4] * y + m[offset + 8] * z + m[offset + 12],
    m[offset + 1] * x + m[offset + 5] * y + m[offset + 9] * z + m[offset + 13],
    m[offset + 2] * x + m[offset + 6] * y + m[offset + 10] * z + m[offset + 14],
  ];
}

export function transformDirectionMat4(matrix, offset, x, y, z) {
  const result = [
    matrix[offset] * x + matrix[offset + 4] * y + matrix[offset + 8] * z,
    matrix[offset + 1] * x + matrix[offset + 5] * y + matrix[offset + 9] * z,
    matrix[offset + 2] * x + matrix[offset + 6] * y + matrix[offset + 10] * z,
  ];
  return normalize3(result[0], result[1], result[2]);
}
