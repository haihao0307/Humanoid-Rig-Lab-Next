import { stableFingerprint } from '../core-utils.js';

export const PRODUCTION_RIG_QUALITY_METRICS_V1_SCHEMA = 'humanoid_rig/production_rig_quality_metrics@1.0';

export function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function subtract3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale3(value, scalar) {
  return value.map((component) => component * scalar);
}

export function mix3(a, b, alpha) {
  return a.map((component, index) => component + (b[index] - component) * alpha);
}

export function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function length3(value) {
  return Math.hypot(value[0], value[1], value[2]);
}

export function distance3(a, b) {
  return length3(subtract3(a, b));
}

export function normalize3(value, fallback = [1, 0, 0]) {
  const source = finiteVector3(value, fallback);
  const length = length3(source);
  return length > 1e-12 ? scale3(source, 1 / length) : [...fallback];
}

export function finiteVector3(value, fallback = [0, 0, 0]) {
  return [0, 1, 2].map((index) => Number.isFinite(Number(value?.[index])) ? Number(value[index]) : fallback[index]);
}

export function normalizeQuaternion(value) {
  const source = [0, 1, 2, 3].map((index) => Number(value?.[index]));
  if (!source.every(Number.isFinite)) return [0, 0, 0, 1];
  const length = Math.hypot(...source);
  if (length <= 1e-12) return [0, 0, 0, 1];
  const normalized = source.map((component) => component / length);
  return normalized[3] < 0 ? normalized.map((component) => -component) : normalized;
}

export function multiplyQuaternions(a, b) {
  const [ax, ay, az, aw] = normalizeQuaternion(a);
  const [bx, by, bz, bw] = normalizeQuaternion(b);
  return normalizeQuaternion([
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]);
}

export function rotateVector(value, quaternion) {
  const [x, y, z, w] = normalizeQuaternion(quaternion);
  const [vx, vy, vz] = finiteVector3(value);
  const ix = w * vx + y * vz - z * vy;
  const iy = w * vy + z * vx - x * vz;
  const iz = w * vz + x * vy - y * vx;
  const iw = -x * vx - y * vy - z * vz;
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
}

export function slerpQuaternions(a, b, alpha) {
  const left = normalizeQuaternion(a);
  let right = normalizeQuaternion(b);
  let cosine = left.reduce((sum, component, index) => sum + component * right[index], 0);
  if (cosine < 0) {
    cosine = -cosine;
    right = right.map((component) => -component);
  }
  if (cosine > 0.9995) return normalizeQuaternion(left.map((component, index) => component + alpha * (right[index] - component)));
  const theta = Math.acos(Math.min(1, Math.max(-1, cosine)));
  const sine = Math.sin(theta);
  const leftWeight = Math.sin((1 - alpha) * theta) / sine;
  const rightWeight = Math.sin(alpha * theta) / sine;
  return normalizeQuaternion(left.map((component, index) => component * leftWeight + right[index] * rightWeight));
}

export function quaternionFromBasis(xAxis, yAxis, zAxis) {
  const x = normalize3(xAxis, [1, 0, 0]);
  const ySeed = normalize3(yAxis, [0, 1, 0]);
  const z = normalize3(cross3(x, ySeed), normalize3(zAxis, [0, 0, 1]));
  const y = normalize3(cross3(z, x), ySeed);
  const m00 = x[0]; const m01 = y[0]; const m02 = z[0];
  const m10 = x[1]; const m11 = y[1]; const m12 = z[1];
  const m20 = x[2]; const m21 = y[2]; const m22 = z[2];
  const trace = m00 + m11 + m22;
  let quaternion;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    quaternion = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    quaternion = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    quaternion = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    quaternion = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  return normalizeQuaternion(quaternion);
}

export function axisBasisMetrics(axisReference) {
  const twist = finiteVector3(axisReference?.twistAxisLocal, [1, 0, 0]);
  const bend = finiteVector3(axisReference?.bendAxisLocal, [0, 1, 0]);
  const side = finiteVector3(axisReference?.sideAxisLocal, [0, 0, 1]);
  const values = [...twist, ...bend, ...side];
  const nonFiniteAxisCount = values.filter((value) => !Number.isFinite(value)).length;
  const orthogonalityError = Math.max(
    Math.abs(dot3(twist, bend)),
    Math.abs(dot3(twist, side)),
    Math.abs(dot3(bend, side)),
    Math.abs(length3(twist) - 1),
    Math.abs(length3(bend) - 1),
    Math.abs(length3(side) - 1),
  );
  const determinant = dot3(cross3(twist, bend), side);
  return { orthogonalityError, determinant, nonFiniteAxisCount };
}

export function createRigInvariantSnapshotV1({ rigCore, contract, finalPose = null } = {}) {
  const jointIds = rigCore.joints.map((joint) => joint.jointId);
  const parentByJointId = Object.fromEntries(rigCore.joints.map((joint) => [joint.jointId, joint.parentId ?? null]));
  const jointAxes = Object.fromEntries(rigCore.joints.map((joint) => [joint.jointId, joint.axisReference]));
  const jointLimits = Object.fromEntries(rigCore.joints.map((joint) => [joint.jointId, joint.limitProfile]));
  return {
    jointIds,
    parentByJointId,
    bindLocalPositions: contract.bindLocalPositions,
    boneLengths: contract.boneLengths,
    jointAxes,
    jointLimits,
    fingerprints: {
      topology: stableFingerprint({ jointIds, parentByJointId }),
      bind: stableFingerprint({ bindLocalPositions: contract.bindLocalPositions, boneLengths: contract.boneLengths }),
      axes: stableFingerprint(jointAxes),
      limits: stableFingerprint(jointLimits),
      finalPose: finalPose ? stableFingerprint({
        rootPosition: finalPose.rootPosition,
        rootRotation: finalPose.rootRotation,
        localRotations: finalPose.localRotations,
      }) : null,
    },
  };
}

export function compareRigInvariantSnapshotsV1(before, after) {
  const beforeIds = new Set(before.jointIds);
  const afterIds = new Set(after.jointIds);
  const allIds = [...new Set([...before.jointIds, ...after.jointIds])];
  let maximumBindPositionDifference = 0;
  let maximumBoneLengthDifference = 0;
  for (const jointId of allIds) {
    const left = before.bindLocalPositions[jointId] ?? [Number.POSITIVE_INFINITY, 0, 0];
    const right = after.bindLocalPositions[jointId] ?? [Number.NEGATIVE_INFINITY, 0, 0];
    maximumBindPositionDifference = Math.max(maximumBindPositionDifference, distance3(left, right));
    maximumBoneLengthDifference = Math.max(
      maximumBoneLengthDifference,
      Math.abs(Number(before.boneLengths[jointId]) - Number(after.boneLengths[jointId])),
    );
  }
  const result = {
    unknownJointCount: after.jointIds.filter((jointId) => !beforeIds.has(jointId)).length,
    missingJointCount: before.jointIds.filter((jointId) => !afterIds.has(jointId)).length,
    parentMismatchCount: allIds.filter((jointId) => before.parentByJointId[jointId] !== after.parentByJointId[jointId]).length,
    maximumBindPositionDifference,
    maximumBoneLengthDifference,
    jointAxisFingerprintUnchanged: before.fingerprints.axes === after.fingerprints.axes,
    jointLimitFingerprintUnchanged: before.fingerprints.limits === after.fingerprints.limits,
    finalPoseReadOnlyPassed: before.fingerprints.finalPose === after.fingerprints.finalPose,
  };
  result.passed = result.unknownJointCount === 0
    && result.missingJointCount === 0
    && result.parentMismatchCount === 0
    && result.maximumBindPositionDifference === 0
    && result.maximumBoneLengthDifference <= 1e-9
    && result.jointAxisFingerprintUnchanged
    && result.jointLimitFingerprintUnchanged
    && result.finalPoseReadOnlyPassed;
  return result;
}

export function countNonFinite(value) {
  let count = 0;
  const visit = (item) => {
    if (typeof item === 'number') { if (!Number.isFinite(item)) count += 1; return; }
    if (Array.isArray(item)) { item.forEach(visit); return; }
    if (item && typeof item === 'object') Object.values(item).forEach(visit);
  };
  visit(value);
  return count;
}
