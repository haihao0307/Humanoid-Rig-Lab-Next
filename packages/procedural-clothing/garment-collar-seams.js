import { REGION_IDS } from './constants.js';
import { distance3 } from './math.js';
import { collarWeights } from './garment-geometry-core.js';

export function generateCollar(accumulator, garmentDNA, fit) {
  const r = fit.resolved;
  const around = garmentDNA.topology.collarSegments;
  const radial = garmentDNA.topology.collarRadialSegments;
  const bandWidth = garmentDNA.construction.collarBandWidth;
  const grid = Array.from({ length: radial + 1 }, () => new Int32Array(around).fill(-1));
  const inner = [];
  const outer = [];
  for (let j = 0; j <= radial; j += 1) {
    const s = j / radial;
    const a = r.neckInnerSemiWidth + bandWidth * s;
    const b = r.neckInnerSemiDepth + bandWidth * s * 0.84;
    for (let i = 0; i < around; i += 1) {
      const q = i / around;
      const theta = q * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      const frontness = Math.max(0, sin);
      const backness = Math.max(0, -sin);
      const drop = r.frontNeckDrop * frontness * frontness
        + r.backNeckDrop * backness * backness
        + r.shoulderDrop * Math.abs(cos) * 0.12;
      const x = a * cos;
      const y = r.shoulderY - drop - s * 0.002;
      const z = b * sin;
      const influence = collarWeights(theta, accumulator.jointIndexByName);
      const vertex = accumulator.addVertex(
        [x, y, z],
        [q * Math.PI * 2 * ((a + b) * 0.5), s * bandWidth],
        REGION_IDS.COLLAR,
        influence,
        0.995,
      );
      grid[j][i] = vertex;
      if (j === 0) inner.push(vertex);
      if (j === radial) outer.push(vertex);
    }
  }
  for (let j = 0; j < radial; j += 1) {
    for (let i = 0; i < around; i += 1) {
      const next = (i + 1) % around;
      const a = grid[j][i];
      const b = grid[j][next];
      const c = grid[j + 1][i];
      const d = grid[j + 1][next];
      accumulator.addTriangle(a, c, b);
      accumulator.addTriangle(b, c, d);
    }
  }
  accumulator.setBoundary('collar.inner', inner);
  accumulator.setBoundary('collar.outer', outer);
}

function pairEquivalentBoundaries(accumulator, nameA, nameB) {
  const a = accumulator.boundaries.get(nameA) ?? [];
  const b = accumulator.boundaries.get(nameB) ?? [];
  const count = Math.min(a.length, b.length);
  for (let index = 0; index < count; index += 1) accumulator.addSeamPair(a[index], b[index]);
}

function nearestVertex(positionArray, vertex, candidates) {
  const offset = vertex * 3;
  let best = -1;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const candidateOffset = candidate * 3;
    const distance = distance3(
      positionArray[offset], positionArray[offset + 1], positionArray[offset + 2],
      positionArray[candidateOffset], positionArray[candidateOffset + 1], positionArray[candidateOffset + 2],
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

function pairByProximity(accumulator, sourceName, candidateNames) {
  const source = accumulator.boundaries.get(sourceName) ?? [];
  const candidates = candidateNames.flatMap((name) => accumulator.boundaries.get(name) ?? []);
  if (candidates.length === 0) return;
  for (const vertex of source) {
    accumulator.addSeamPair(vertex, nearestVertex(accumulator.positions, vertex, candidates));
  }
}

export function buildSeams(accumulator) {
  pairEquivalentBoundaries(accumulator, 'front.left_side', 'back.left_side');
  pairEquivalentBoundaries(accumulator, 'front.right_side', 'back.right_side');
  pairByProximity(accumulator, 'left_sleeve.start', ['front.top', 'back.top', 'front.left_side', 'back.left_side']);
  pairByProximity(accumulator, 'right_sleeve.start', ['front.top', 'back.top', 'front.right_side', 'back.right_side']);
  pairByProximity(accumulator, 'collar.outer', ['front.neck', 'back.neck', 'front.top', 'back.top']);
  const frontTop = accumulator.boundaries.get('front.top') ?? [];
  const backTop = accumulator.boundaries.get('back.top') ?? [];
  const count = Math.min(frontTop.length, backTop.length);
  for (let index = 0; index < count; index += 1) {
    const a = frontTop[index];
    const b = backTop[index];
    const x = accumulator.positions[a * 3];
    if (Math.abs(x) > 0.04) accumulator.addSeamPair(a, b);
  }
}
