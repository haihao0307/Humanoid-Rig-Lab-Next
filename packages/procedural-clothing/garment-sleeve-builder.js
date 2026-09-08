import { REGION_IDS } from './constants.js';
import { lerp, normalize3 } from './math.js';
import { sleeveWeights } from './garment-geometry-core.js';

export function generateSleeve(accumulator, garmentDNA, fit, side) {
  const r = fit.resolved;
  const around = garmentDNA.topology.sleeveCircumferenceSegments;
  const along = garmentDNA.topology.sleeveLengthSegments;
  const pitch = r.sleevePitchRadians;
  const sign = side < 0 ? -1 : 1;
  const axis = normalize3(sign * Math.cos(pitch), Math.sin(pitch), 0);
  const vertical = normalize3(-sign * Math.sin(pitch), Math.cos(pitch), 0);
  const depth = [0, 0, 1];
  const startCenter = [
    sign * (r.shoulderSemiWidth - r.sleeveStartRadius * 0.22),
    r.shoulderY - r.shoulderDrop - r.sleeveStartRadius * 0.38,
    0,
  ];
  const grid = Array.from({ length: along + 1 }, () => new Int32Array(around).fill(-1));
  const startRing = [];
  const endRing = [];
  const region = side < 0 ? REGION_IDS.LEFT_SLEEVE : REGION_IDS.RIGHT_SLEEVE;
  for (let j = 0; j <= along; j += 1) {
    const s = j / along;
    const center = [
      startCenter[0] + axis[0] * r.sleeveLength * s,
      startCenter[1] + axis[1] * r.sleeveLength * s,
      startCenter[2],
    ];
    const radius = lerp(r.sleeveStartRadius, r.sleeveEndRadius, s);
    const radiusVertical = radius * lerp(1.02, 0.94, s);
    const radiusDepth = radius * lerp(0.94, 0.88, s);
    for (let i = 0; i < around; i += 1) {
      const q = i / around;
      const theta = q * Math.PI * 2;
      const c = Math.cos(theta);
      const d = Math.sin(theta);
      const x = center[0] + vertical[0] * c * radiusVertical + depth[0] * d * radiusDepth;
      const y = center[1] + vertical[1] * c * radiusVertical + depth[1] * d * radiusDepth;
      const z = center[2] + vertical[2] * c * radiusVertical + depth[2] * d * radiusDepth;
      const influence = sleeveWeights(side, s, accumulator.jointIndexByName);
      const follow = lerp(0.96, 0.72, s);
      const vertex = accumulator.addVertex(
        [x, y, z],
        [q * Math.PI * 2 * radius, s * r.sleeveLength],
        region,
        influence,
        follow,
      );
      grid[j][i] = vertex;
      if (j === 0) startRing.push(vertex);
      if (j === along) endRing.push(vertex);
    }
  }
  for (let j = 0; j < along; j += 1) {
    for (let i = 0; i < around; i += 1) {
      const next = (i + 1) % around;
      const a = grid[j][i];
      const b = grid[j][next];
      const c = grid[j + 1][i];
      const d = grid[j + 1][next];
      if (side < 0) {
        accumulator.addTriangle(a, b, c);
        accumulator.addTriangle(b, d, c);
      } else {
        accumulator.addTriangle(a, c, b);
        accumulator.addTriangle(b, c, d);
      }
    }
  }
  const prefix = side < 0 ? 'left_sleeve' : 'right_sleeve';
  accumulator.setBoundary(`${prefix}.start`, startRing);
  accumulator.setBoundary(`${prefix}.end`, endRing);
}
