import {
  addVectors,
  crossVectors,
  dotVectors,
  lerpVector,
  normalizeQuaternion,
  normalizeVector3,
  quaternionAngularDistance,
  rotateVectorByQuaternion,
  scaleVector,
  subtractVectors,
  vectorLength,
} from '../../modules/animation/quaternion.js';

export {
  addVectors,
  crossVectors,
  dotVectors,
  lerpVector,
  normalizeQuaternion,
  normalizeVector3,
  quaternionAngularDistance,
  rotateVectorByQuaternion,
  scaleVector,
  subtractVectors,
  vectorLength,
};

export const EPSILON = 1e-8;
export const ZERO = Object.freeze([0, 0, 0]);
export const IDENTITY = Object.freeze([0, 0, 0, 1]);

export function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, finite(value, minimum)));
}

export function unit(value, fallback = 0) {
  return clamp(finite(value, fallback), 0, 1);
}

export function vector3(value, fallback = ZERO) {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) return [...fallback];
  return [finite(value[0], fallback[0]), finite(value[1], fallback[1]), finite(value[2], fallback[2])];
}

export function distance(a, b) {
  return vectorLength(subtractVectors(a, b));
}

export function smoothstep(value) {
  const t = unit(value);
  return t * t * (3 - 2 * t);
}

export function smootherstep(value) {
  const t = unit(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function projectOnPlane(vector, normal) {
  const n = normalizeVector3(normal, [0, 1, 0]);
  return subtractVectors(vector, scaleVector(n, dotVectors(vector, n)));
}

export function signedAngleAroundAxis(from, to, axis) {
  const n = normalizeVector3(axis, [0, 1, 0]);
  const a = normalizeVector3(projectOnPlane(from, n), [0, 0, 1]);
  const b = normalizeVector3(projectOnPlane(to, n), a);
  return Math.atan2(dotVectors(crossVectors(a, b), n), clamp(dotVectors(a, b), -1, 1));
}

export function mapToObject(map, normalizer = (value) => Array.from(value || [])) {
  return Object.fromEntries([...map.entries()].map(([key, value]) => [key, normalizer(value)]));
}

export function assertFiniteTree(value, path = '$', errors = []) {
  if (typeof value === 'number' && !Number.isFinite(value)) errors.push(`${path} must be finite.`);
  if (Array.isArray(value)) value.forEach((entry, index) => assertFiniteTree(entry, `${path}[${index}]`, errors));
  else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) assertFiniteTree(entry, `${path}.${key}`, errors);
  }
  return errors;
}

export function maxQuaternionVelocity(previous, current, deltaTime) {
  if (!previous || !current) return 0;
  const dt = Math.max(EPSILON, finite(deltaTime, 1 / 60));
  let maximum = quaternionAngularDistance(previous.root?.rotation, current.root?.rotation) / dt;
  const ids = new Set([...Object.keys(previous.joints || {}), ...Object.keys(current.joints || {})]);
  for (const id of ids) {
    const a = previous.joints?.[id]?.rotation || IDENTITY;
    const b = current.joints?.[id]?.rotation || IDENTITY;
    maximum = Math.max(maximum, quaternionAngularDistance(a, b) / dt);
  }
  return maximum;
}

export function maxLinearVelocity(previous, current, deltaTime) {
  if (!previous || !current) return 0;
  return distance(previous.root?.position || ZERO, current.root?.position || ZERO)
    / Math.max(EPSILON, finite(deltaTime, 1 / 60));
}

export function transformPoint(point, origin, rotation) {
  return addVectors(vector3(origin), rotateVectorByQuaternion(vector3(point), normalizeQuaternion(rotation)));
}

export function normalizeOutgoingPose(input = {}, compatibleRig = 'rig@0.4.0') {
  const source = input && typeof input === 'object' ? input : {};
  const joints = {};
  for (const [jointId, value] of Object.entries(source.joints || {})) {
    const rotation = value?.rotation || value;
    if (!Array.isArray(rotation) && !ArrayBuffer.isView(rotation)) continue;
    joints[jointId] = { rotation: normalizeQuaternion(rotation) };
  }
  return {
    schema: 'humanoid_rig/animation_pose@0.2',
    clipId: source.clipId ?? null,
    compatibleRig: source.compatibleRig || compatibleRig,
    time: finite(source.time, 0),
    rawTime: finite(source.rawTime, source.time || 0),
    root: {
      position: vector3(source.root?.position),
      rotation: normalizeQuaternion(source.root?.rotation),
    },
    joints,
  };
}

export function cloneOutgoingPose(input, compatibleRig) {
  return normalizeOutgoingPose(input, compatibleRig);
}
