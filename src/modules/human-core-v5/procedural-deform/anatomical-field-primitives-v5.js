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
  return ellipsoidDistanceComponents(
    point[0], point[1], point[2],
    center[0], center[1], center[2],
    radii[0], radii[1], radii[2],
  );
}

function ellipsoidDistanceComponents(px, py, pz, cx, cy, cz, radiusX, radiusY, radiusZ) {
  const rx = Math.max(EPSILON, radiusX);
  const ry = Math.max(EPSILON, radiusY);
  const rz = Math.max(EPSILON, radiusZ);
  const qx = (px - cx) / rx;
  const qy = (py - cy) / ry;
  const qz = (pz - cz) / rz;
  const k0 = Math.hypot(qx, qy, qz);
  const k1 = Math.hypot(qx / rx, qy / ry, qz / rz);
  return k0 * (k0 - 1) / Math.max(EPSILON, k1);
}

function superellipsoidDistance(point, center, radii, exponent) {
  const power = Math.max(1.4, Number(exponent) || 2.6);
  const x = Math.abs((point[0] - center[0]) / Math.max(EPSILON, radii[0]));
  const y = Math.abs((point[1] - center[1]) / Math.max(EPSILON, radii[1]));
  const z = Math.abs((point[2] - center[2]) / Math.max(EPSILON, radii[2]));
  const implicit = Math.pow(Math.pow(x, power) + Math.pow(y, power) + Math.pow(z, power), 1 / power);
  return (implicit - 1) * Math.min(radii[0], radii[1], radii[2]);
}

function taperedSegmentDistance(point, primitive) {
  const axisX = primitive.end[0] - primitive.start[0];
  const axisY = primitive.end[1] - primitive.start[1];
  const axisZ = primitive.end[2] - primitive.start[2];
  const lengthSquared = axisX * axisX + axisY * axisY + axisZ * axisZ;
  const relativeX = point[0] - primitive.start[0];
  const relativeY = point[1] - primitive.start[1];
  const relativeZ = point[2] - primitive.start[2];
  const projection = relativeX * axisX + relativeY * axisY + relativeZ * axisZ;
  const t = lengthSquared < EPSILON ? 0 : clamp(projection / lengthSquared, 0, 1);
  const centerX = primitive.start[0] + axisX * t;
  const centerY = primitive.start[1] + axisY * t;
  const centerZ = primitive.start[2] + axisZ * t + (primitive.sweep ? Math.sin(t * Math.PI) * Number(primitive.sweep) : 0);
  const radiusX = primitive.startRadii[0] + (primitive.endRadii[0] - primitive.startRadii[0]) * t;
  const radiusY = primitive.startRadii[1] + (primitive.endRadii[1] - primitive.startRadii[1]) * t;
  const radiusZ = primitive.startRadii[2] + (primitive.endRadii[2] - primitive.startRadii[2]) * t;
  return ellipsoidDistanceComponents(
    point[0], point[1], point[2], centerX, centerY, centerZ, radiusX, radiusY, radiusZ,
  );
}

function freezePrimitive(value) {
  return Object.freeze(structuredClone(value));
}

function subtract(a, b) { return a.map((value, index) => value - b[index]); }
function add(a, b) { return a.map((value, index) => value + b[index]); }
function scale(a, amount) { return a.map((value) => value * amount); }
function dot(a, b) { return a.reduce((sum, value, index) => sum + value * b[index], 0); }
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
