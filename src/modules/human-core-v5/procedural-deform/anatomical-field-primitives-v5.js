const EPSILON = 1e-9;

export function createEllipsoidPrimitive({ id, region, center, radii, sourceJointId, side = 'center' }) {
  return freezePrimitive({ type: 'ellipsoid', id, region, center, radii, sourceJointId, side });
}

export function createSuperellipsoidPrimitive({ id, region, center, radii, exponent = 2.6, sourceJointId, side = 'center' }) {
  return freezePrimitive({ type: 'superellipsoid', id, region, center, radii, exponent, sourceJointId, side });
}

export function createTaperedEllipticalCapsulePrimitive({
  id, region, start, end, startRadii, endRadii, sourceJointId, side = 'center', sweep = 0,
}) {
  return freezePrimitive({
    type: sweep ? 'swept-elliptical-segment' : 'tapered-elliptical-capsule',
    id, region, start, end, startRadii, endRadii, sourceJointId, side, sweep,
  });
}

export function evaluateAnatomicalPrimitive(primitive, point) {
  switch (primitive.type) {
    case 'ellipsoid': return ellipsoidDistance(point, primitive.center, primitive.radii);
    case 'superellipsoid': return superellipsoidDistance(point, primitive.center, primitive.radii, primitive.exponent);
    case 'tapered-elliptical-capsule':
    case 'swept-elliptical-segment':
      return taperedSegmentDistance(point, primitive);
    default: throw new Error(`Unsupported anatomical field primitive ${primitive.type}.`);
  }
}

export function primitiveBounds(primitive) {
  if (primitive.center) {
    return {
      min: primitive.center.map((value, index) => value - primitive.radii[index]),
      max: primitive.center.map((value, index) => value + primitive.radii[index]),
    };
  }
  const radius = [
    Math.max(primitive.startRadii[0], primitive.endRadii[0]),
    Math.max(primitive.startRadii[1], primitive.endRadii[1]),
    Math.max(primitive.startRadii[2], primitive.endRadii[2]),
  ];
  return {
    min: [0, 1, 2].map((axis) => Math.min(primitive.start[axis], primitive.end[axis]) - radius[axis]),
    max: [0, 1, 2].map((axis) => Math.max(primitive.start[axis], primitive.end[axis]) + radius[axis]),
  };
}

function ellipsoidDistance(point, center, radii) {
  const q = point.map((value, index) => (value - center[index]) / Math.max(EPSILON, radii[index]));
  const k0 = Math.hypot(...q);
  const q2 = q.map((value, index) => value / Math.max(EPSILON, radii[index]));
  const k1 = Math.hypot(...q2);
  return k0 * (k0 - 1) / Math.max(EPSILON, k1);
}

function superellipsoidDistance(point, center, radii, exponent) {
  const power = Math.max(1.4, Number(exponent) || 2.6);
  const normalized = point.map((value, index) => Math.abs((value - center[index]) / Math.max(EPSILON, radii[index])));
  const implicit = Math.pow(normalized.reduce((sum, value) => sum + Math.pow(value, power), 0), 1 / power);
  return (implicit - 1) * Math.min(...radii);
}

function taperedSegmentDistance(point, primitive) {
  const axis = subtract(primitive.end, primitive.start);
  const lengthSquared = dot(axis, axis);
  const relative = subtract(point, primitive.start);
  const t = lengthSquared < EPSILON ? 0 : clamp(dot(relative, axis) / lengthSquared, 0, 1);
  const center = add(primitive.start, scale(axis, t));
  if (primitive.sweep) center[2] += Math.sin(t * Math.PI) * Number(primitive.sweep);
  const radii = primitive.startRadii.map((value, index) => value + (primitive.endRadii[index] - value) * t);
  return ellipsoidDistance(point, center, radii);
}

function freezePrimitive(value) {
  return Object.freeze(structuredClone(value));
}

function subtract(a, b) { return a.map((value, index) => value - b[index]); }
function add(a, b) { return a.map((value, index) => value + b[index]); }
function scale(a, amount) { return a.map((value) => value * amount); }
function dot(a, b) { return a.reduce((sum, value, index) => sum + value * b[index], 0); }
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
