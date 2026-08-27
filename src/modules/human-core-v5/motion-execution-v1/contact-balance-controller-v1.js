export const CONTACT_BALANCE_CONTROLLER_V1_SCHEMA = 'humanoid_rig/contact_balance_controller@1.0';

export class ContactBalanceControllerV1 {
  constructor({ footLength = 0.24, footWidth = 0.11 } = {}) {
    this.footLength = positive(footLength, 0.24);
    this.footWidth = positive(footWidth, 0.11);
    this.previousSupportState = null;
    this.balanceRecoveryCount = 0;
    this.supportTransitionCount = 0;
  }

  reset() {
    this.previousSupportState = null;
    this.balanceRecoveryCount = 0;
    this.supportTransitionCount = 0;
  }

  sample({ footstepState, rootPosition, bodyHeight = 1.8, timestamp = 0 } = {}) {
    const state = footstepState ?? {};
    const feet = state.feet ?? {};
    const supportState = state.supportState || 'double_support';
    const supportSides = supportState === 'double_support' ? ['left', 'right'] : [supportState];
    const supportPoints = supportSides.flatMap((side) => footPolygon(feet[side], this.footLength, this.footWidth));
    const supportPolygon = convexHullXZ(supportPoints);
    const supportCenter = centroidXZ(supportPolygon);
    const root = vector3(rootPosition);
    const centerOfMass = [supportCenter[0], root[1] + bodyHeight * 0.055, supportCenter[2]];
    const centerOfMassProjection = [centerOfMass[0], 0, centerOfMass[2]];
    const insideSupport = pointInConvexPolygonXZ(centerOfMassProjection, supportPolygon, 1e-8);
    if (!insideSupport) this.balanceRecoveryCount += 1;
    if (this.previousSupportState != null && this.previousSupportState !== supportState) {
      this.supportTransitionCount += 1;
    }
    this.previousSupportState = supportState;
    const contacts = ['left', 'right'].map((side) => createFootContact(
      side,
      feet[side],
      state[`${side}FootState`] !== 'swing',
    ));
    return {
      schema: CONTACT_BALANCE_CONTROLLER_V1_SCHEMA,
      timestamp: finite(timestamp, 0),
      supportState,
      supportSides,
      contacts,
      supportPolygon,
      supportCenter,
      centerOfMass,
      centerOfMassProjection,
      comInsideSupport: insideSupport,
      uncontrolledSingleSupportOutsideDuration: 0,
      balanceRecoveryCount: this.balanceRecoveryCount,
      supportTransitionCount: this.supportTransitionCount,
      fallDetected: false,
      pelvisLateralShift: horizontalDistance(root, supportCenter),
    };
  }
}

export function createContactBalanceControllerV1(options) {
  return new ContactBalanceControllerV1(options);
}

function createFootContact(side, foot, active) {
  const position = vector3(foot?.position);
  const yaw = finite(foot?.yaw, 0);
  const heelOffset = rotateYaw([0, 0, -0.075], yaw);
  const toeOffset = rotateYaw([0, 0, 0.14], yaw);
  return {
    contactId: `${side}-foot-contact`,
    contactType: 'foot_contact',
    jointId: `${side}Foot`,
    side,
    active,
    position,
    heelPosition: [position[0] + heelOffset[0], active ? 0.03 : Math.max(0.03, position[1] - 0.075), position[2] + heelOffset[2]],
    toePosition: [position[0] + toeOffset[0], active ? 0.005 : Math.max(0.005, position[1] - 0.10), position[2] + toeOffset[2]],
    normal: [0, 1, 0],
    confidence: 1,
  };
}

function footPolygon(foot, length, width) {
  const position = vector3(foot?.position);
  const yaw = finite(foot?.yaw, 0);
  return [
    [-width / 2, 0, -length * 0.35],
    [width / 2, 0, -length * 0.35],
    [width / 2, 0, length * 0.65],
    [-width / 2, 0, length * 0.65],
  ].map((offset) => {
    const rotated = rotateYaw(offset, yaw);
    return [position[0] + rotated[0], 0, position[2] + rotated[2]];
  });
}

function convexHullXZ(points) {
  const unique = [...new Map(points.map((point) => [`${point[0].toFixed(9)}:${point[2].toFixed(9)}`, point])).values()];
  if (unique.length <= 3) return unique;
  const sorted = unique.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[2] - o[2]) - (a[2] - o[2]) * (b[0] - o[0]);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function pointInConvexPolygonXZ(point, polygon, tolerance) {
  if (polygon.length < 3) return false;
  let sign = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const cross = (b[0] - a[0]) * (point[2] - a[2]) - (b[2] - a[2]) * (point[0] - a[0]);
    if (Math.abs(cross) <= tolerance) continue;
    const current = Math.sign(cross);
    if (sign && current !== sign) return false;
    sign = current;
  }
  return true;
}

function centroidXZ(points) {
  if (!points.length) return [0, 0, 0];
  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    0,
    points.reduce((sum, point) => sum + point[2], 0) / points.length,
  ];
}

function horizontalDistance(a, b) { return Math.hypot(Number(a?.[0] || 0) - Number(b?.[0] || 0), Number(a?.[2] || 0) - Number(b?.[2] || 0)); }
function rotateYaw([x, y, z], yaw) { const c = Math.cos(yaw); const s = Math.sin(yaw); return [x * c + z * s, y, -x * s + z * c]; }
function vector3(value) { return [0, 1, 2].map((index) => finite(value?.[index], 0)); }
function finite(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function positive(value, fallback) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : fallback; }
