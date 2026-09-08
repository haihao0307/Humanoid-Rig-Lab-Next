import { cross3, distance3, normalize3 } from './math.js';

export function computeNormals(positionArray, indexArray) {
  const normals = new Float32Array(positionArray.length);
  for (let index = 0; index < indexArray.length; index += 3) {
    const ia = indexArray[index] * 3;
    const ib = indexArray[index + 1] * 3;
    const ic = indexArray[index + 2] * 3;
    const abx = positionArray[ib] - positionArray[ia];
    const aby = positionArray[ib + 1] - positionArray[ia + 1];
    const abz = positionArray[ib + 2] - positionArray[ia + 2];
    const acx = positionArray[ic] - positionArray[ia];
    const acy = positionArray[ic + 1] - positionArray[ia + 1];
    const acz = positionArray[ic + 2] - positionArray[ia + 2];
    const normal = cross3(abx, aby, abz, acx, acy, acz);
    for (const offset of [ia, ib, ic]) {
      normals[offset] += normal[0]; normals[offset + 1] += normal[1]; normals[offset + 2] += normal[2];
    }
  }
  for (let index = 0; index < normals.length; index += 3) {
    const normal = normalize3(normals[index], normals[index + 1], normals[index + 2]);
    normals[index] = normal[0]; normals[index + 1] = normal[1]; normals[index + 2] = normal[2];
  }
  return normals;
}

export function extractStructuralEdges(positionArray, indexArray) {
  const edgeSet = new Set();
  const edges = [];
  const add = (a, b) => {
    const low = Math.min(a, b); const high = Math.max(a, b); const key = `${low}:${high}`;
    if (!edgeSet.has(key)) { edgeSet.add(key); edges.push(low, high); }
  };
  for (let index = 0; index < indexArray.length; index += 3) {
    const a = indexArray[index]; const b = indexArray[index + 1]; const c = indexArray[index + 2];
    add(a, b); add(b, c); add(c, a);
  }
  const edgeArray = new Uint32Array(edges);
  const restLengths = new Float32Array(edgeArray.length / 2);
  for (let index = 0; index < edgeArray.length; index += 2) {
    const a = edgeArray[index] * 3; const b = edgeArray[index + 1] * 3;
    restLengths[index / 2] = distance3(
      positionArray[a], positionArray[a + 1], positionArray[a + 2],
      positionArray[b], positionArray[b + 1], positionArray[b + 2],
    );
  }
  return { stretchEdges: edgeArray, restLengths };
}

export function computeInverseMass(positionArray, indexArray, arealDensity) {
  const masses = new Float64Array(positionArray.length / 3);
  for (let index = 0; index < indexArray.length; index += 3) {
    const a = indexArray[index]; const b = indexArray[index + 1]; const c = indexArray[index + 2];
    const ia = a * 3; const ib = b * 3; const ic = c * 3;
    const ab = [positionArray[ib] - positionArray[ia], positionArray[ib + 1] - positionArray[ia + 1], positionArray[ib + 2] - positionArray[ia + 2]];
    const ac = [positionArray[ic] - positionArray[ia], positionArray[ic + 1] - positionArray[ia + 1], positionArray[ic + 2] - positionArray[ia + 2]];
    const cross = cross3(ab[0], ab[1], ab[2], ac[0], ac[1], ac[2]);
    const mass = 0.5 * Math.hypot(cross[0], cross[1], cross[2]) * arealDensity / 3;
    masses[a] += mass; masses[b] += mass; masses[c] += mass;
  }
  const inverseMass = new Float32Array(masses.length);
  for (let index = 0; index < masses.length; index += 1) inverseMass[index] = masses[index] > 1e-12 ? 1 / masses[index] : 0;
  return inverseMass;
}
