import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CHICKEN_PHASE1_CENTERLINE_SWEEP_REVISION,
  CHICKEN_PHASE1_CENTERLINE_CURVE_REVISION,
  buildChickenPhase1AnatomicalNeckShell,
  computeChickenPhase1NeckSectorGate,
  createChickenPhase1Pchip,
  createChickenPhase1ArcLengthMap,
  filterChickenPhase1TorsoTriangles,
  phaseAlignChickenPhase1ClosedRings
} from '../runtime/chicken_phase1_centerline_sweep_adapter.mjs';

assert.equal(CHICKEN_PHASE1_CENTERLINE_SWEEP_REVISION, 'anatomical-topology-split-and-centerline-sweep-v7');
assert.equal(CHICKEN_PHASE1_CENTERLINE_CURVE_REVISION, 'bone-centerline-pchip-volume-preserving-v1');

const html = fs.readFileSync(new URL('../CHICKEN_V46_R9_9_1_GAMEPLAY_HEAD.html', import.meta.url), 'utf8');
function decodeFloat(id) {
  const match = html.match(new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([^<]+)</script>`));
  assert.ok(match, `missing ${id}`);
  const buffer = Buffer.from(match[1].trim(), 'base64');
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}
function decodeUint(id) {
  const match = html.match(new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([^<]+)</script>`));
  assert.ok(match, `missing ${id}`);
  const buffer = Buffer.from(match[1].trim(), 'base64');
  return new Uint32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}

const xs = decodeFloat('carrier-x');
const centers = decodeFloat('carrier-center');
const coefficients = decodeFloat('carrier-coef');
const indices = decodeUint('carrier-index');
const harmonics = Math.round((coefficients.length / xs.length - 1) / 2);
const ringSize = 96;
const positions = new Float32Array(xs.length * ringSize * 3 + 6);
for (let station = 0; station < xs.length; station++) {
  const x = xs[station];
  const cy = centers[station * 2];
  const cz = centers[station * 2 + 1];
  const offset = station * (1 + 2 * harmonics);
  for (let sample = 0; sample < ringSize; sample++) {
    const theta = -Math.PI + 2 * Math.PI * sample / ringSize;
    let radius = coefficients[offset];
    for (let harmonic = 1; harmonic <= harmonics; harmonic++) {
      radius += coefficients[offset + harmonic] * Math.cos(harmonic * theta);
      radius += coefficients[offset + harmonics + harmonic] * Math.sin(harmonic * theta);
    }
    const q = (station * ringSize + sample) * 3;
    positions[q] = x;
    positions[q + 1] = cy + radius * Math.cos(theta);
    positions[q + 2] = cz + radius * Math.sin(theta);
  }
}
const posterior = xs.length * ringSize * 3;
positions.set([xs[0], centers[0], centers[1]], posterior);
positions.set([xs[xs.length - 1], centers[centers.length - 2], centers[centers.length - 1]], posterior + 3);

const shell = buildChickenPhase1AnatomicalNeckShell(positions);
assert.equal(shell.ringSize, 32);
assert.ok(shell.ringCount >= 25, `expected substantial neck/head shell, got ${shell.ringCount}`);
assert.equal(shell.positions.length, shell.ringCount * shell.ringSize * 3);
assert.equal(shell.indices.length, (shell.ringCount - 1) * shell.ringSize * 6);
assert.ok([...shell.positions].every(Number.isFinite));
assert.ok(shell.stationXs[0] >= 0.075 - 1e-6);
assert.ok(shell.stationXs.at(-1) > 0.42);

const torso = filterChickenPhase1TorsoTriangles(positions, indices);
assert.ok(torso.length > indices.length * 0.45, 'torso should retain the majority of the low body');
assert.ok(torso.length < indices.length * 0.90, 'torso should remove the independent neck/head sector');
for (let i = 0; i < torso.length; i += 3) {
  let maxGate = 0;
  let meanX = 0;
  for (const id of [torso[i], torso[i + 1], torso[i + 2]]) {
    const q = id * 3;
    meanX += positions[q];
    maxGate = Math.max(maxGate, computeChickenPhase1NeckSectorGate(positions[q], positions[q + 1]));
  }
  meanX /= 3;
  assert.ok(maxGate < 0.72 + 1e-6 || meanX < 0.085 + 1e-6);
}

const pchip = createChickenPhase1Pchip(
  [0, 1, 2, 3],
  [[0, 0, 0], [1, 1, 0], [2, 0.5, 0.2], [3, 1.5, 0.4]]
);
for (let i = 0; i < 4; i++) {
  const point = pchip.evaluate(i);
  assert.ok(Math.abs(point[0] - i) < 1e-9);
}
for (const x of [0, 0.25, 1.5, 2.75, 3]) {
  assert.ok(pchip.evaluate(x).every(Number.isFinite));
  assert.ok(pchip.derivative(x).every(Number.isFinite));
}

const arc = createChickenPhase1ArcLengthMap(pchip, 0, 3, 256);
assert.ok(arc.totalLength > 3);
for (const x of [0, 0.5, 1.25, 2.5, 3]) {
  const fraction = arc.fractionAtX(x);
  const recovered = arc.xAtFraction(fraction);
  assert.ok(Math.abs(recovered - x) < 0.025, `arc inversion drift at ${x}: ${recovered}`);
}

const originalRings = [
  [[0, 1, 0], [0, 0, 1], [0, -1, 0], [0, 0, -1]],
  [[1, 0, -1], [1, 1, 0], [1, 0, 1], [1, -1, 0]]
];
const aligned = phaseAlignChickenPhase1ClosedRings(originalRings);
let alignedCost = 0;
for (let i = 0; i < 4; i++) {
  const dy = aligned[1][i][1] - aligned[0][i][1];
  const dz = aligned[1][i][2] - aligned[0][i][2];
  alignedCost += dy * dy + dz * dz;
}
assert.ok(alignedCost < 1e-9, `ring phase alignment failed: ${alignedCost}`);

console.log(JSON.stringify({
  revision: CHICKEN_PHASE1_CENTERLINE_SWEEP_REVISION,
  shellRings: shell.ringCount,
  shellVertices: shell.positions.length / 3,
  shellTriangles: shell.indices.length / 3,
  torsoTriangles: torso.length / 3,
  originalTriangles: indices.length / 3
}, null, 2));
