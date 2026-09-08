import { clamp, inverseLerp, lerp, smoothstep } from './math.js';
import { sampleTorsoShape } from './pattern-graph.js';

export function appendTopFourWeights(weightMap, jointIndexByName) {
  const sorted = [...weightMap.entries()]
    .filter(([, weight]) => weight > 1e-7)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const total = sorted.reduce((sum, [, weight]) => sum + weight, 0) || 1;
  const joints = [0, 0, 0, 0];
  const weights = [0, 0, 0, 0];
  for (let index = 0; index < sorted.length; index += 1) {
    const [name, rawWeight] = sorted[index];
    joints[index] = jointIndexByName.get(name) ?? 0;
    weights[index] = rawWeight / total;
  }
  return { joints, weights };
}

export function torsoWeights(x, y, fit, side, jointIndexByName) {
  const r = fit.resolved;
  const t = clamp(inverseLerp(r.hemY, r.shoulderY, y), 0, 1);
  const weights = new Map();
  const add = (name, value) => weights.set(name, (weights.get(name) ?? 0) + value);
  if (t < 0.27) {
    const q = smoothstep(0, 0.27, t);
    add('pelvis', 1 - q); add('spine1', q);
  } else if (t < 0.58) {
    const q = smoothstep(0.27, 0.58, t);
    add('spine1', 1 - q); add('spine2', q);
  } else if (t < 0.84) {
    const q = smoothstep(0.58, 0.84, t);
    add('spine2', 1 - q); add('spine3', q);
  } else {
    const q = smoothstep(0.84, 1, t);
    add('spine3', 1 - q * 0.55); add('neck', q * 0.55);
  }
  const xFactor = smoothstep(0.34, 0.95, Math.abs(x) / Math.max(r.shoulderSemiWidth, 1e-5));
  const yFactor = smoothstep(r.underarmY - 0.02, r.shoulderY, y);
  const shoulderWeight = xFactor * yFactor * 0.78;
  if (shoulderWeight > 0) {
    for (const name of [...weights.keys()]) weights.set(name, weights.get(name) * (1 - shoulderWeight));
    add(side < 0 ? 'left_shoulder' : 'right_shoulder', shoulderWeight * 0.82);
    add(side < 0 ? 'left_upper_arm' : 'right_upper_arm', shoulderWeight * 0.18);
  }
  return appendTopFourWeights(weights, jointIndexByName);
}

export function sleeveWeights(side, s, jointIndexByName) {
  const shoulder = side < 0 ? 'left_shoulder' : 'right_shoulder';
  const upper = side < 0 ? 'left_upper_arm' : 'right_upper_arm';
  const lower = side < 0 ? 'left_lower_arm' : 'right_lower_arm';
  const shoulderWeight = (1 - smoothstep(0, 0.28, s)) * 0.42;
  const lowerWeight = smoothstep(0.58, 1, s) * 0.34;
  const upperWeight = Math.max(0, 1 - shoulderWeight - lowerWeight);
  return appendTopFourWeights(new Map([
    [shoulder, shoulderWeight], [upper, upperWeight], [lower, lowerWeight],
  ]), jointIndexByName);
}

export function collarWeights(theta, jointIndexByName) {
  const lateral = Math.cos(theta);
  const sideStrength = smoothstep(0.45, 0.98, Math.abs(lateral)) * 0.28;
  const weights = new Map([
    ['spine3', 0.44 * (1 - sideStrength)], ['neck', 0.56 * (1 - sideStrength)],
  ]);
  if (sideStrength > 0) weights.set(lateral < 0 ? 'left_shoulder' : 'right_shoulder', sideStrength);
  return appendTopFourWeights(weights, jointIndexByName);
}

export class MeshAccumulator {
  constructor(jointIndexByName) {
    this.jointIndexByName = jointIndexByName;
    this.positions = []; this.materialCoords = []; this.regionIds = [];
    this.skinJoints = []; this.skinWeights = []; this.followWeights = [];
    this.indices = []; this.seamPairs = []; this.boundaries = new Map();
  }
  addVertex(position, materialCoord, regionId, influence, followWeight = 0.75) {
    const index = this.positions.length / 3;
    this.positions.push(position[0], position[1], position[2]);
    this.materialCoords.push(materialCoord[0], materialCoord[1]);
    this.regionIds.push(regionId);
    this.skinJoints.push(...influence.joints);
    this.skinWeights.push(...influence.weights);
    this.followWeights.push(clamp(followWeight, 0, 1));
    return index;
  }
  addTriangle(a, b, c) { if (a !== b && b !== c && c !== a) this.indices.push(a, b, c); }
  addSeamPair(a, b) {
    if (a !== undefined && b !== undefined && a >= 0 && b >= 0 && a !== b) this.seamPairs.push(a, b);
  }
  setBoundary(name, indices) {
    this.boundaries.set(name, indices.filter((value) => Number.isInteger(value) && value >= 0));
  }
}

export function panelHalfWidth(fit, y) {
  const r = fit.resolved;
  if (y <= r.underarmY) return sampleTorsoShape(fit, y).semiWidth;
  return lerp(r.chestSemiWidth, r.shoulderSemiWidth, Math.pow(smoothstep(r.underarmY, r.shoulderY, y), 0.72));
}

export function panelSemiDepth(fit, y) {
  const r = fit.resolved;
  if (y <= r.underarmY) return sampleTorsoShape(fit, y).semiDepth;
  return lerp(r.chestSemiDepth, r.chestSemiDepth * 0.76, smoothstep(r.underarmY, r.shoulderY, y));
}

export function panelTopY(fit, x, isFront) {
  const r = fit.resolved;
  const absX = Math.abs(x);
  const neckHalf = r.neckInnerSemiWidth;
  if (absX <= neckHalf) {
    const q = clamp(absX / Math.max(neckHalf, 1e-6), 0, 1);
    return r.shoulderY - (isFront ? r.frontNeckDrop : r.backNeckDrop) * (1 - q * q);
  }
  const q = clamp((absX - neckHalf) / Math.max(r.shoulderSemiWidth - neckHalf, 1e-6), 0, 1);
  return r.shoulderY - r.shoulderDrop * Math.pow(q, 1.18);
}
