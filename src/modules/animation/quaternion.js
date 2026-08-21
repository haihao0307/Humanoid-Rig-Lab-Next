const EPSILON = 1e-8;
const IDENTITY = Object.freeze([0, 0, 0, 1]);

export function normalizeQuaternion(value, fallback = IDENTITY) {
  const source = Array.isArray(value) || ArrayBuffer.isView(value) ? value : fallback;
  const x = finite(source[0], fallback[0]);
  const y = finite(source[1], fallback[1]);
  const z = finite(source[2], fallback[2]);
  const w = finite(source[3], fallback[3]);
  const length = Math.hypot(x, y, z, w);
  if (length < EPSILON) return [...fallback];
  return [x / length, y / length, z / length, w / length];
}

export function quaternionDot(a, b) {
  return Number(a?.[0] || 0) * Number(b?.[0] || 0)
    + Number(a?.[1] || 0) * Number(b?.[1] || 0)
    + Number(a?.[2] || 0) * Number(b?.[2] || 0)
    + Number(a?.[3] ?? 1) * Number(b?.[3] ?? 1);
}

export function multiplyQuaternions(left, right) {
  const a = normalizeQuaternion(left);
  const b = normalizeQuaternion(right);
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return normalizeQuaternion([
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]);
}

export function conjugateQuaternion(value) {
  const [x, y, z, w] = normalizeQuaternion(value);
  return [-x, -y, -z, w];
}

export function inverseQuaternion(value) {
  return conjugateQuaternion(value);
}

export function slerpQuaternion(from, to, alpha) {
  const a = normalizeQuaternion(from);
  let b = normalizeQuaternion(to);
  const t = clamp(Number(alpha), 0, 1);
  let dot = quaternionDot(a, b);

  if (dot < 0) {
    b = b.map((component) => -component);
    dot = -dot;
  }

  if (dot > 0.9995) {
    return normalizeQuaternion(a.map((component, index) => component + (b[index] - component) * t));
  }

  const theta0 = Math.acos(clamp(dot, -1, 1));
  const sinTheta0 = Math.sin(theta0);
  if (Math.abs(sinTheta0) < EPSILON) return [...a];

  const theta = theta0 * t;
  const scaleA = Math.sin(theta0 - theta) / sinTheta0;
  const scaleB = Math.sin(theta) / sinTheta0;
  return normalizeQuaternion(a.map((component, index) => component * scaleA + b[index] * scaleB));
}

export function ensureQuaternionContinuity(values) {
  const result = [];
  for (const raw of values || []) {
    let current = normalizeQuaternion(raw);
    const previous = result.at(-1);
    if (previous && quaternionDot(previous, current) < 0) current = current.map((component) => -component);
    result.push(current);
  }
  return result;
}

export function lerpVector(from, to, alpha, size = 3) {
  const t = clamp(Number(alpha), 0, 1);
  return Array.from({ length: size }, (_, index) => {
    const a = finite(from?.[index], 0);
    const b = finite(to?.[index], a);
    return a + (b - a) * t;
  });
}

export function addVectors(a, b, size = 3) {
  return Array.from({ length: size }, (_, index) => finite(a?.[index], 0) + finite(b?.[index], 0));
}

export function subtractVectors(a, b, size = 3) {
  return Array.from({ length: size }, (_, index) => finite(a?.[index], 0) - finite(b?.[index], 0));
}

export function scaleVector(value, scalar, size = 3) {
  const scale = finite(scalar, 0);
  return Array.from({ length: size }, (_, index) => finite(value?.[index], 0) * scale);
}

export function vectorLength(value) {
  return Math.hypot(finite(value?.[0], 0), finite(value?.[1], 0), finite(value?.[2], 0));
}

export function normalizeVector3(value, fallback = [0, 1, 0]) {
  const source = [finite(value?.[0], 0), finite(value?.[1], 0), finite(value?.[2], 0)];
  const length = vectorLength(source);
  if (length < EPSILON) return [...fallback];
  return source.map((component) => component / length);
}

export function dotVectors(a, b) {
  return finite(a?.[0], 0) * finite(b?.[0], 0)
    + finite(a?.[1], 0) * finite(b?.[1], 0)
    + finite(a?.[2], 0) * finite(b?.[2], 0);
}

export function crossVectors(a, b) {
  const ax = finite(a?.[0], 0);
  const ay = finite(a?.[1], 0);
  const az = finite(a?.[2], 0);
  const bx = finite(b?.[0], 0);
  const by = finite(b?.[1], 0);
  const bz = finite(b?.[2], 0);
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

export function rotateVectorByQuaternion(value, rotation) {
  const q = normalizeQuaternion(rotation);
  const vectorQuaternion = [finite(value?.[0], 0), finite(value?.[1], 0), finite(value?.[2], 0), 0];
  const rotated = multiplyRaw(multiplyRaw(q, vectorQuaternion), conjugateQuaternion(q));
  return [rotated[0], rotated[1], rotated[2]];
}

export function quaternionFromAxisAngle(axis, angleRadians) {
  const direction = normalizeVector3(axis, [1, 0, 0]);
  const half = finite(angleRadians, 0) * 0.5;
  const sine = Math.sin(half);
  return normalizeQuaternion([
    direction[0] * sine,
    direction[1] * sine,
    direction[2] * sine,
    Math.cos(half),
  ]);
}

/**
 * Builds a local joint rotation from the rig's anatomical axis contract.
 * Channels are radians and are composed in bend/twist/side order by default.
 * This keeps authored motion independent from mirrored bind-space XYZ signs.
 */
export function quaternionFromAnatomicalChannels(axisEntry, channels = {}, order = 'BTS') {
  const axes = {
    T: normalizeVector3(axisEntry?.twistAxisLocal, [0, 1, 0]),
    B: normalizeVector3(axisEntry?.bendAxisLocal, [1, 0, 0]),
    S: normalizeVector3(axisEntry?.sideAxisLocal, [0, 0, 1]),
  };
  const angles = {
    T: finite(channels?.twist, 0),
    B: finite(channels?.bend, 0),
    S: finite(channels?.side, 0),
  };
  let result = [...IDENTITY];
  for (const channel of String(order || 'BTS').toUpperCase()) {
    if (!axes[channel]) continue;
    result = multiplyQuaternions(
      result,
      quaternionFromAxisAngle(axes[channel], angles[channel]),
    );
  }
  return normalizeQuaternion(result);
}

export function quaternionFromEuler(xRadians = 0, yRadians = 0, zRadians = 0, order = 'XYZ') {
  let x = xRadians;
  let y = yRadians;
  let z = zRadians;
  let resolvedOrder = order;
  if (Array.isArray(xRadians) || ArrayBuffer.isView(xRadians)) {
    x = xRadians[0] || 0;
    y = xRadians[1] || 0;
    z = xRadians[2] || 0;
    resolvedOrder = typeof yRadians === 'string' ? yRadians : order;
  }
  const rotations = {
    X: quaternionFromAxisAngle([1, 0, 0], x),
    Y: quaternionFromAxisAngle([0, 1, 0], y),
    Z: quaternionFromAxisAngle([0, 0, 1], z),
  };
  let result = [...IDENTITY];
  for (const axis of String(resolvedOrder || 'XYZ').toUpperCase()) {
    if (rotations[axis]) result = multiplyQuaternions(result, rotations[axis]);
  }
  return result;
}

export function quaternionFromTo(fromDirection, toDirection) {
  const from = normalizeVector3(fromDirection, [0, 1, 0]);
  const to = normalizeVector3(toDirection, from);
  const dot = clamp(dotVectors(from, to), -1, 1);
  if (dot > 1 - 1e-7) return [...IDENTITY];
  if (dot < -1 + 1e-7) {
    const fallbackAxis = Math.abs(from[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const axis = normalizeVector3(crossVectors(from, fallbackAxis), [0, 0, 1]);
    return quaternionFromAxisAngle(axis, Math.PI);
  }
  const axis = crossVectors(from, to);
  return normalizeQuaternion([axis[0], axis[1], axis[2], 1 + dot]);
}

export function quaternionAngle(value) {
  const q = normalizeQuaternion(value);
  return 2 * Math.acos(clamp(Math.abs(q[3]), -1, 1));
}

export function quaternionAngularDistance(a, b) {
  const dot = clamp(Math.abs(quaternionDot(normalizeQuaternion(a), normalizeQuaternion(b))), -1, 1);
  return 2 * Math.acos(dot);
}

export function clampQuaternionAngle(value, maxAngleRadians) {
  const q = normalizeQuaternion(value);
  const maximum = Math.max(0, finite(maxAngleRadians, Math.PI));
  const angle = quaternionAngle(q);
  if (angle <= maximum + EPSILON) return q;
  return slerpQuaternion(IDENTITY, q, maximum / Math.max(EPSILON, angle));
}

export function additiveQuaternion(base, delta, weight = 1) {
  return multiplyQuaternions(normalizeQuaternion(base), slerpQuaternion(IDENTITY, delta, clamp(weight, 0, 1)));
}

export function mirrorQuaternionSagittal(value) {
  const [x, y, z, w] = normalizeQuaternion(value);
  return normalizeQuaternion([x, -y, -z, w]);
}


export function identityQuaternion() {
  return [...IDENTITY];
}

export function blendOverrideQuaternion(base, override, weight = 1) {
  return slerpQuaternion(base, override, clamp(Number(weight), 0, 1));
}

export function blendAdditiveQuaternion(base, delta, weight = 1) {
  return additiveQuaternion(base, delta, weight);
}

export function mirrorQuaternionAcrossX(value) {
  return mirrorQuaternionSagittal(value);
}

export function quaternionLength(value) {
  return Math.hypot(
    Number(value?.[0] || 0),
    Number(value?.[1] || 0),
    Number(value?.[2] || 0),
    Number(value?.[3] || 0),
  );
}

function multiplyRaw(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function finite(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
