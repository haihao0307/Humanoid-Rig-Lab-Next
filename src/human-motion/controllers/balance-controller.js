import { HUMAN_SEGMENT_MASS_WEIGHTS } from './mass-profile.js';
import {
  addVectors,
  clamp,
  distance,
  scaleVector,
  subtractVectors,
  vector3,
} from '../solver/motion-math.js';

const FOOT_HALF_WIDTH = 0.055;
const FOOT_HEEL = 0.07;
const FOOT_TOE = 0.15;

export function estimateCenterOfMass(fk, massWeights = HUMAN_SEGMENT_MASS_WEIGHTS) {
  let weighted = [0, 0, 0];
  let total = 0;
  for (const [jointId, weight] of Object.entries(massWeights)) {
    const point = fk?.positions?.get(jointId);
    if (!point || !Number.isFinite(weight) || weight <= 0) continue;
    weighted = addVectors(weighted, scaleVector(point, weight));
    total += weight;
  }
  return total > 0 ? scaleVector(weighted, 1 / total) : [0, 0, 0];
}

export function buildSupportPolygon(contacts = [], mode = null) {
  const active = contacts.filter((contact) => contact.active !== false && contact.positionWeight > 1e-5);
  const resolvedMode = mode || inferSupportMode(active);
  if (resolvedMode === 'airborne' || !active.length) return [];
  const points = [];
  for (const contact of active) {
    const center = vector3(contact.targetPosition);
    if (/Foot$/.test(contact.jointId)) {
      points.push(
        [center[0] - FOOT_HALF_WIDTH, center[1], center[2] - FOOT_HEEL],
        [center[0] + FOOT_HALF_WIDTH, center[1], center[2] - FOOT_HEEL],
        [center[0] + FOOT_HALF_WIDTH, center[1], center[2] + FOOT_TOE],
        [center[0] - FOOT_HALF_WIDTH, center[1], center[2] + FOOT_TOE],
      );
    } else {
      const radius = contact.mode === 'seat' ? 0.12 : 0.035;
      points.push(
        [center[0] - radius, center[1], center[2] - radius],
        [center[0] + radius, center[1], center[2] - radius],
        [center[0] + radius, center[1], center[2] + radius],
        [center[0] - radius, center[1], center[2] + radius],
      );
    }
  }
  return convexHullXZ(points);
}

export function isCenterOfMassSupported(centerOfMass, supportPolygon, margin = 0) {
  if (!supportPolygon?.length) return false;
  const bounds = polygonBounds(supportPolygon);
  const x = centerOfMass[0];
  const z = centerOfMass[2];
  return x >= bounds.minX + margin && x <= bounds.maxX - margin
    && z >= bounds.minZ + margin && z <= bounds.maxZ - margin;
}

export function projectCenterOfMassToSupport(centerOfMass, supportPolygon, margin = 0) {
  if (!supportPolygon?.length) return [...centerOfMass];
  const bounds = polygonBounds(supportPolygon);
  const minX = Math.min(bounds.maxX, bounds.minX + margin);
  const maxX = Math.max(bounds.minX, bounds.maxX - margin);
  const minZ = Math.min(bounds.maxZ, bounds.minZ + margin);
  const maxZ = Math.max(bounds.minZ, bounds.maxZ - margin);
  return [clamp(centerOfMass[0], minX, maxX), centerOfMass[1], clamp(centerOfMass[2], minZ, maxZ)];
}

export function computePelvisBalanceCorrection({
  centerOfMass,
  supportPolygon,
  supportMode = 'double_support',
  centerOfMassTarget = null,
  supportMargin = 0.02,
  gain = 1,
} = {}) {
  if (supportMode === 'airborne' || !supportPolygon?.length) return [0, 0, 0];
  const desired = centerOfMassTarget || projectCenterOfMassToSupport(centerOfMass, supportPolygon, supportMargin);
  const delta = subtractVectors(desired, centerOfMass);
  return [delta[0] * gain, 0, delta[2] * gain];
}

export function evaluateBalance(fk, contacts, balanceGoal = {}) {
  const supportMode = balanceGoal.mode || inferSupportMode(contacts);
  const centerOfMass = estimateCenterOfMass(fk);
  const supportPolygon = buildSupportPolygon(contacts, supportMode);
  const margin = Math.max(0, Number(balanceGoal.supportMargin) || 0);
  const insideSupport = supportMode === 'airborne' || isCenterOfMassSupported(centerOfMass, supportPolygon, margin);
  const projected = supportMode === 'airborne'
    ? [...centerOfMass]
    : projectCenterOfMassToSupport(balanceGoal.centerOfMassTarget || centerOfMass, supportPolygon, margin);
  const pelvisCorrection = balanceGoal.enabled === false
    ? [0, 0, 0]
    : computePelvisBalanceCorrection({
      centerOfMass,
      supportPolygon,
      supportMode,
      centerOfMassTarget: balanceGoal.centerOfMassTarget,
      supportMargin: margin,
    });
  return {
    estimatedCOM: centerOfMass,
    supportPolygon,
    supportMode,
    insideSupport,
    balanceError: supportMode === 'airborne' ? 0 : distance(centerOfMass, projected),
    pelvisCorrection,
  };
}

export class BalanceController {
  evaluate(fk, contacts, goal = {}) {
    return evaluateBalance(fk, contacts, goal);
  }
}

function inferSupportMode(contacts) {
  const ids = new Set((contacts || []).filter((contact) => contact.active !== false).map((contact) => contact.jointId));
  const left = ids.has('leftFoot');
  const right = ids.has('rightFoot');
  if (left && right) return 'double_support';
  if (left) return 'left_support';
  if (right) return 'right_support';
  if (ids.has('hips')) return 'seated';
  if ([...ids].some((id) => /Hand$/.test(id))) return 'hand_support';
  return 'airborne';
}

function polygonBounds(points) {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point[0]),
    maxX: Math.max(bounds.maxX, point[0]),
    minZ: Math.min(bounds.minZ, point[2]),
    maxZ: Math.max(bounds.maxZ, point[2]),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
}

function convexHullXZ(points) {
  const unique = [...new Map(points.map((point) => [`${point[0]}|${point[2]}`, point])).values()]
    .sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  if (unique.length <= 2) return unique;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[2] - o[2]) - (a[2] - o[2]) * (b[0] - o[0]);
  const lower = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (const point of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
