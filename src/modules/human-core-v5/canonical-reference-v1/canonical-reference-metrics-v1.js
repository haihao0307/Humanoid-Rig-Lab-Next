export const CANONICAL_REFERENCE_METRICS_V1_SCHEMA = 'humanoid_rig/canonical_reference_geometry_metrics@1.0';

export function measureCanonicalReferenceGeometryV1(staticData) {
  const positions = staticData.worldPositions;
  const normals = staticData.worldNormals;
  const indices = staticData.indices;
  if (positions.length !== staticData.vertexCount * 3 || normals.length !== positions.length || indices.length % 3 !== 0) {
    throw new Error('Canonical geometry metrics received inconsistent arrays.');
  }

  const union = new UnionFind(staticData.vertexCount);
  const edges = new Map();
  const duplicateTriangles = new Map();
  const nonManifoldVertices = new Set();
  let degenerateTriangleCount = 0;
  let duplicateTriangleCount = 0;
  let minimumTriangleArea = Infinity;
  let maximumTriangleAspectRatio = 0;
  let signedVolume = 0;
  let windingAligned = 0;
  let windingOpposed = 0;
  let windingIndeterminate = 0;

  for (let offset = 0; offset < indices.length; offset += 3) {
    const a = indices[offset]; const b = indices[offset + 1]; const c = indices[offset + 2];
    if (a >= staticData.vertexCount || b >= staticData.vertexCount || c >= staticData.vertexCount) throw new Error(`Triangle ${offset / 3} has an out-of-range index.`);
    union.union(a, b); union.union(b, c); union.union(c, a);
    addEdge(edges, a, b); addEdge(edges, b, c); addEdge(edges, c, a);
    const triangleKey = [a, b, c].sort((left, right) => left - right).join('/');
    const previous = duplicateTriangles.get(triangleKey) ?? 0;
    if (previous > 0) duplicateTriangleCount += 1;
    duplicateTriangles.set(triangleKey, previous + 1);

    const ax = positions[a * 3]; const ay = positions[a * 3 + 1]; const az = positions[a * 3 + 2];
    const bx = positions[b * 3]; const by = positions[b * 3 + 1]; const bz = positions[b * 3 + 2];
    const cx = positions[c * 3]; const cy = positions[c * 3 + 1]; const cz = positions[c * 3 + 2];
    const abx = bx - ax; const aby = by - ay; const abz = bz - az;
    const acx = cx - ax; const acy = cy - ay; const acz = cz - az;
    const crossX = aby * acz - abz * acy;
    const crossY = abz * acx - abx * acz;
    const crossZ = abx * acy - aby * acx;
    const doubleArea = Math.hypot(crossX, crossY, crossZ);
    const area = doubleArea * 0.5;
    const ab = Math.hypot(abx, aby, abz);
    const bc = Math.hypot(cx - bx, cy - by, cz - bz);
    const ca = Math.hypot(ax - cx, ay - cy, az - cz);
    const longest = Math.max(ab, bc, ca);
    const aspectRatio = doubleArea > 0 ? (longest * longest) / doubleArea : Infinity;
    minimumTriangleArea = Math.min(minimumTriangleArea, area);
    maximumTriangleAspectRatio = Math.max(maximumTriangleAspectRatio, aspectRatio);
    if (a === b || b === c || c === a || doubleArea <= 1e-20) degenerateTriangleCount += 1;
    signedVolume += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
    const nx = normals[a * 3] + normals[b * 3] + normals[c * 3];
    const ny = normals[a * 3 + 1] + normals[b * 3 + 1] + normals[c * 3 + 1];
    const nz = normals[a * 3 + 2] + normals[b * 3 + 2] + normals[c * 3 + 2];
    const dot = crossX * nx + crossY * ny + crossZ * nz;
    if (doubleArea <= 1e-20 || Math.hypot(nx, ny, nz) <= 1e-20) windingIndeterminate += 1;
    else if (dot >= 0) windingAligned += 1;
    else windingOpposed += 1;
  }

  let boundaryEdgeCount = 0;
  let nonManifoldEdgeCount = 0;
  let minimumEdgeLength = Infinity;
  let maximumEdgeLength = 0;
  for (const edge of edges.values()) {
    if (edge.count === 1) boundaryEdgeCount += 1;
    if (edge.count > 2) {
      nonManifoldEdgeCount += 1;
      nonManifoldVertices.add(edge.a); nonManifoldVertices.add(edge.b);
    }
    const length = pointDistance(positions, edge.a, edge.b);
    minimumEdgeLength = Math.min(minimumEdgeLength, length);
    maximumEdgeLength = Math.max(maximumEdgeLength, length);
  }

  const bounds = calculateBounds(positions);
  const positionCounts = new Map();
  let duplicatePositionPairCount = 0;
  let nanCount = 0;
  let infCount = 0;
  for (let index = 0; index < staticData.vertexCount; index += 1) {
    const offset = index * 3;
    const values = [positions[offset], positions[offset + 1], positions[offset + 2]];
    for (const value of values) {
      if (Number.isNaN(value)) nanCount += 1;
      else if (!Number.isFinite(value)) infCount += 1;
    }
    const key = values.join('/');
    const previous = positionCounts.get(key) ?? 0;
    duplicatePositionPairCount += previous;
    positionCounts.set(key, previous + 1);
  }

  let maximumNormalLengthError = 0;
  let sumNormalLengthError = 0;
  for (let offset = 0; offset < normals.length; offset += 3) {
    const error = Math.abs(Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2]) - 1);
    maximumNormalLengthError = Math.max(maximumNormalLengthError, error);
    sumNormalLengthError += error;
    for (let component = 0; component < 3; component += 1) {
      const value = normals[offset + component];
      if (Number.isNaN(value)) nanCount += 1;
      else if (!Number.isFinite(value)) infCount += 1;
    }
  }
  const roots = new Set();
  for (let index = 0; index < staticData.vertexCount; index += 1) roots.add(union.find(index));

  return {
    schema: CANONICAL_REFERENCE_METRICS_V1_SCHEMA,
    assetPath: staticData.assetPath,
    vertexCount: staticData.vertexCount,
    triangleCount: staticData.triangleCount,
    indexCount: staticData.indexCount,
    primitiveCount: staticData.primitiveCount,
    materialCount: staticData.materialCount,
    connectedComponentCount: roots.size,
    boundaryEdgeCount,
    nonManifoldEdgeCount,
    nonManifoldVertexCount: nonManifoldVertices.size,
    degenerateTriangleCount,
    duplicateTriangleCount,
    duplicatePositionPairCount,
    NaNCount: nanCount,
    InfCount: infCount,
    finite: nanCount === 0 && infCount === 0,
    signedVolume,
    boundingBox: { min: bounds.min, max: bounds.max, size: bounds.size },
    boundingSphere: bounds.sphere,
    height: bounds.size[1],
    width: bounds.size[0],
    depth: bounds.size[2],
    minimumTriangleArea: Number.isFinite(minimumTriangleArea) ? minimumTriangleArea : 0,
    maximumTriangleAspectRatio,
    minimumEdgeLength: Number.isFinite(minimumEdgeLength) ? minimumEdgeLength : 0,
    maximumEdgeLength,
    normalLengthError: {
      maximum: maximumNormalLengthError,
      mean: staticData.vertexCount ? sumNormalLengthError / staticData.vertexCount : 0,
    },
    triangleWindingConsistency: {
      alignedTriangleCount: windingAligned,
      opposedTriangleCount: windingOpposed,
      indeterminateTriangleCount: windingIndeterminate,
      alignedRatio: staticData.triangleCount ? windingAligned / staticData.triangleCount : 0,
    },
  };
}

function addEdge(edges, a, b) {
  const low = Math.min(a, b); const high = Math.max(a, b); const key = `${low}/${high}`;
  const edge = edges.get(key);
  if (edge) edge.count += 1;
  else edges.set(key, { a: low, b: high, count: 1 });
}

function pointDistance(positions, a, b) {
  return Math.hypot(positions[a * 3] - positions[b * 3], positions[a * 3 + 1] - positions[b * 3 + 1], positions[a * 3 + 2] - positions[b * 3 + 2]);
}

function calculateBounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let offset = 0; offset < positions.length; offset += 3) {
    for (let component = 0; component < 3; component += 1) {
      min[component] = Math.min(min[component], positions[offset + component]);
      max[component] = Math.max(max[component], positions[offset + component]);
    }
  }
  const size = max.map((value, index) => value - min[index]);
  const center = max.map((value, index) => (value + min[index]) * 0.5);
  let radius = 0;
  for (let offset = 0; offset < positions.length; offset += 3) radius = Math.max(radius, Math.hypot(positions[offset] - center[0], positions[offset + 1] - center[1], positions[offset + 2] - center[2]));
  return { min, max, size, sphere: { center, radius } };
}

class UnionFind {
  constructor(size) {
    this.parent = Uint32Array.from({ length: size }, (_, index) => index);
    this.rank = new Uint8Array(size);
  }
  find(value) {
    let root = value;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[value] !== value) { const next = this.parent[value]; this.parent[value] = root; value = next; }
    return root;
  }
  union(left, right) {
    let a = this.find(left); let b = this.find(right);
    if (a === b) return;
    if (this.rank[a] < this.rank[b]) [a, b] = [b, a];
    this.parent[b] = a;
    if (this.rank[a] === this.rank[b]) this.rank[a] += 1;
  }
}
