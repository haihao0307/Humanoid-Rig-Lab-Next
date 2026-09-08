import { REGION_IDS } from './constants.js';
import { lerp, smoothstep } from './math.js';
import { panelHalfWidth, panelSemiDepth, panelTopY, torsoWeights } from './garment-geometry-core.js';

export function generateTorsoPanel(accumulator, garmentDNA, fit, isFront) {
  const nx = Math.floor(garmentDNA.topology.torsoCircumferenceSegments / 2) + 1;
  const ny = garmentDNA.topology.torsoLengthSegments + 1;
  const r = fit.resolved;
  const grid = Array.from({ length: ny }, () => new Int32Array(nx).fill(-1));
  const sideLeft = [];
  const sideRight = [];
  const topBoundary = [];
  const neckBoundary = [];
  const region = isFront ? REGION_IDS.TORSO_FRONT : REGION_IDS.TORSO_BACK;
  const signZ = isFront ? 1 : -1;

  for (let j = 0; j < ny; j += 1) {
    const v = j / (ny - 1);
    const y = lerp(r.hemY, r.shoulderY, v);
    const halfWidth = panelHalfWidth(fit, y);
    const semiDepth = panelSemiDepth(fit, y);
    for (let i = 0; i < nx; i += 1) {
      const u = lerp(-1, 1, i / (nx - 1));
      const x = u * halfWidth;
      const topY = panelTopY(fit, x, isFront);
      if (y > topY + 1e-7) continue;
      const zProfile = Math.sqrt(Math.max(0, 1 - u * u));
      const chestBias = isFront ? 1.035 : 0.965;
      const z = signZ * semiDepth * zProfile * chestBias;
      const influence = torsoWeights(x, y, fit, x < 0 ? -1 : 1, accumulator.jointIndexByName);
      const upperAnchor = smoothstep(r.underarmY, r.shoulderY, y);
      const follow = 0.62 + upperAnchor * 0.34;
      const vertex = accumulator.addVertex([x, y, z], [x, y - r.hemY], region, influence, follow);
      grid[j][i] = vertex;
      if (i === 0) sideLeft.push(vertex);
      if (i === nx - 1) sideRight.push(vertex);
    }
  }
  for (let j = 0; j < ny - 1; j += 1) {
    for (let i = 0; i < nx - 1; i += 1) {
      const a = grid[j][i];
      const b = grid[j][i + 1];
      const c = grid[j + 1][i];
      const d = grid[j + 1][i + 1];
      if (a >= 0 && b >= 0 && c >= 0) {
        if (isFront) accumulator.addTriangle(a, c, b);
        else accumulator.addTriangle(a, b, c);
      }
      if (b >= 0 && c >= 0 && d >= 0) {
        if (isFront) accumulator.addTriangle(b, c, d);
        else accumulator.addTriangle(b, d, c);
      }
    }
  }
  for (let i = 0; i < nx; i += 1) {
    let highest = -1;
    for (let j = ny - 1; j >= 0; j -= 1) {
      if (grid[j][i] >= 0) {
        highest = grid[j][i];
        break;
      }
    }
    if (highest >= 0) {
      topBoundary.push(highest);
      const x = accumulator.positions[highest * 3];
      if (Math.abs(x) <= r.neckInnerSemiWidth * 1.18) neckBoundary.push(highest);
    }
  }
  const prefix = isFront ? 'front' : 'back';
  accumulator.setBoundary(`${prefix}.left_side`, sideLeft);
  accumulator.setBoundary(`${prefix}.right_side`, sideRight);
  accumulator.setBoundary(`${prefix}.top`, topBoundary);
  accumulator.setBoundary(`${prefix}.neck`, neckBoundary);
  return grid;
}
