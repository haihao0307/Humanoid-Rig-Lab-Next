import { hashTypedArraySha256V1 } from '../canonical-reference-v1/canonical-reference-loader-v1.js';

export function buildHalfEdgeTopologyV1(indices, vertexCount) {
  if (!ArrayBuffer.isView(indices) || indices.length % 3 !== 0) throw new Error('Half-edge topology requires triangular typed indices.');
  const halfEdgeCount = indices.length;
  const halfEdgeVertex = new Uint32Array(halfEdgeCount);
  const halfEdgeNext = new Uint32Array(halfEdgeCount);
  const halfEdgeTwin = new Int32Array(halfEdgeCount).fill(-1);
  const halfEdgeFace = new Uint32Array(halfEdgeCount);
  const vertexHalfEdge = new Int32Array(vertexCount).fill(-1);
  const directed = new Map();
  const undirectedCounts = new Map();

  for (let face = 0; face < indices.length / 3; face += 1) {
    const base = face * 3;
    for (let corner = 0; corner < 3; corner += 1) {
      const halfEdge = base + corner;
      const from = Number(indices[halfEdge]);
      const to = Number(indices[base + ((corner + 1) % 3)]);
      if (from >= vertexCount || to >= vertexCount) throw new Error(`Index exceeds vertex count in face ${face}.`);
      halfEdgeVertex[halfEdge] = from;
      halfEdgeNext[halfEdge] = base + ((corner + 1) % 3);
      halfEdgeFace[halfEdge] = face;
      if (vertexHalfEdge[from] < 0) vertexHalfEdge[from] = halfEdge;
      directed.set(`${from}/${to}`, halfEdge);
      const key = from < to ? `${from}/${to}` : `${to}/${from}`;
      undirectedCounts.set(key, (undirectedCounts.get(key) ?? 0) + 1);
    }
  }
  for (let halfEdge = 0; halfEdge < halfEdgeCount; halfEdge += 1) {
    const from = halfEdgeVertex[halfEdge];
    const to = halfEdgeVertex[halfEdgeNext[halfEdge]];
    const twin = directed.get(`${to}/${from}`);
    if (twin != null) halfEdgeTwin[halfEdge] = twin;
  }

  let boundaryEdgeCount = 0;
  let nonManifoldEdgeCount = 0;
  for (const count of undirectedCounts.values()) {
    if (count === 1) boundaryEdgeCount += 1;
    else if (count > 2) nonManifoldEdgeCount += 1;
  }
  return {
    halfEdgeVertex,
    halfEdgeNext,
    halfEdgeTwin,
    halfEdgeFace,
    vertexHalfEdge,
    edgeCount: undirectedCounts.size,
    boundaryEdgeCount,
    nonManifoldEdgeCount,
  };
}

export function computeVertexNormalsV1(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let offset = 0; offset < indices.length; offset += 3) {
    const a = indices[offset] * 3; const b = indices[offset + 1] * 3; const c = indices[offset + 2] * 3;
    const abx = positions[b] - positions[a]; const aby = positions[b + 1] - positions[a + 1]; const abz = positions[b + 2] - positions[a + 2];
    const acx = positions[c] - positions[a]; const acy = positions[c + 1] - positions[a + 1]; const acz = positions[c + 2] - positions[a + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const vertexOffset of [a, b, c]) {
      normals[vertexOffset] += nx; normals[vertexOffset + 1] += ny; normals[vertexOffset + 2] += nz;
    }
  }
  for (let offset = 0; offset < normals.length; offset += 3) {
    const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2]);
    if (length > 1e-20) {
      normals[offset] /= length; normals[offset + 1] /= length; normals[offset + 2] /= length;
    }
  }
  return normals;
}

export async function measureHrlSurfaceTopologyV1(positions, indices) {
  const vertexCount = positions.length / 3;
  const topology = buildHalfEdgeTopologyV1(indices, vertexCount);
  const union = new UnionFind(vertexCount);
  const duplicateTriangles = new Set();
  const valence = new Uint16Array(vertexCount);
  const edgeSet = new Set();
  const aspectRatios = [];
  let duplicateTriangleCount = 0;
  let degenerateTriangleCount = 0;
  let minimumTriangleArea = Infinity;
  let minimumTriangleAngle = Infinity;
  let signedVolume = 0;
  let nanCount = 0;
  let infCount = 0;

  for (const value of positions) {
    if (Number.isNaN(value)) nanCount += 1;
    else if (!Number.isFinite(value)) infCount += 1;
  }
  for (let offset = 0; offset < indices.length; offset += 3) {
    const a = indices[offset]; const b = indices[offset + 1]; const c = indices[offset + 2];
    union.union(a, b); union.union(b, c); union.union(c, a);
    const key = [a, b, c].sort((left, right) => left - right).join('/');
    if (duplicateTriangles.has(key)) duplicateTriangleCount += 1;
    duplicateTriangles.add(key);
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const edgeKey = u < v ? `${u}/${v}` : `${v}/${u}`;
      if (!edgeSet.has(edgeKey)) { edgeSet.add(edgeKey); valence[u] += 1; valence[v] += 1; }
    }

    const ao = a * 3; const bo = b * 3; const co = c * 3;
    const ab = distance3(positions, ao, bo); const bc = distance3(positions, bo, co); const ca = distance3(positions, co, ao);
    const abx = positions[bo] - positions[ao]; const aby = positions[bo + 1] - positions[ao + 1]; const abz = positions[bo + 2] - positions[ao + 2];
    const acx = positions[co] - positions[ao]; const acy = positions[co + 1] - positions[ao + 1]; const acz = positions[co + 2] - positions[ao + 2];
    const crossX = aby * acz - abz * acy; const crossY = abz * acx - abx * acz; const crossZ = abx * acy - aby * acx;
    const doubleArea = Math.hypot(crossX, crossY, crossZ);
    const area = doubleArea * 0.5;
    minimumTriangleArea = Math.min(minimumTriangleArea, area);
    if (a === b || b === c || c === a || area <= 1e-20) degenerateTriangleCount += 1;
    const angles = triangleAngles(ab, bc, ca);
    minimumTriangleAngle = Math.min(minimumTriangleAngle, ...angles);
    const longest = Math.max(ab, bc, ca);
    aspectRatios.push(doubleArea > 0 ? (longest * longest) / doubleArea : Infinity);
    signedVolume += (positions[ao] * (positions[bo + 1] * positions[co + 2] - positions[bo + 2] * positions[co + 1])
      + positions[ao + 1] * (positions[bo + 2] * positions[co] - positions[bo] * positions[co + 2])
      + positions[ao + 2] * (positions[bo] * positions[co + 1] - positions[bo + 1] * positions[co])) / 6;
  }
  const roots = new Set(Array.from({ length: vertexCount }, (_, index) => union.find(index)));
  aspectRatios.sort((a, b) => a - b);
  const p99Index = Math.min(aspectRatios.length - 1, Math.floor(aspectRatios.length * 0.99));
  const maximumVertexValence = valence.reduce((maximum, value) => Math.max(maximum, value), 0);
  return {
    schema: 'humanoid_rig/hrlsurface_topology_metrics@1.0',
    vertexCount,
    triangleCount: indices.length / 3,
    indexCount: indices.length,
    edgeCount: topology.edgeCount,
    connectedComponentCount: roots.size,
    boundaryEdgeCount: topology.boundaryEdgeCount,
    nonManifoldEdgeCount: topology.nonManifoldEdgeCount,
    nonManifoldVertexCount: topology.nonManifoldEdgeCount === 0 ? 0 : countNonManifoldVertices(topology),
    degenerateTriangleCount,
    duplicateTriangleCount,
    NaNCount: nanCount,
    InfCount: infCount,
    triangleWindingConsistency: signedVolume > 0,
    signedVolume,
    minimumTriangleArea: Number.isFinite(minimumTriangleArea) ? minimumTriangleArea : 0,
    minimumTriangleAngle: Number.isFinite(minimumTriangleAngle) ? minimumTriangleAngle : 0,
    maximumTriangleAspectRatio: aspectRatios.at(-1) ?? 0,
    p99TriangleAspectRatio: aspectRatios[p99Index] ?? 0,
    maximumVertexValence,
    EulerCharacteristic: vertexCount - topology.edgeCount + indices.length / 3,
    topologyFingerprint: await hashTypedArraySha256V1(indices),
    positionHash: await hashTypedArraySha256V1(positions),
  };
}

function triangleAngles(a, b, c) {
  const angle = (opposite, left, right) => Math.acos(clamp((left * left + right * right - opposite * opposite) / Math.max(2 * left * right, 1e-30), -1, 1)) * 180 / Math.PI;
  return [angle(a, b, c), angle(b, c, a), angle(c, a, b)];
}

function distance3(values, a, b) {
  return Math.hypot(values[a] - values[b], values[a + 1] - values[b + 1], values[a + 2] - values[b + 2]);
}

function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }

function countNonManifoldVertices(topology) {
  const vertices = new Set();
  for (let edge = 0; edge < topology.halfEdgeTwin.length; edge += 1) if (topology.halfEdgeTwin[edge] < 0) vertices.add(topology.halfEdgeVertex[edge]);
  return vertices.size;
}

class UnionFind {
  constructor(size) { this.parent = Uint32Array.from({ length: size }, (_, index) => index); this.rank = new Uint8Array(size); }
  find(value) { let root = value; while (this.parent[root] !== root) root = this.parent[root]; while (this.parent[value] !== value) { const next = this.parent[value]; this.parent[value] = root; value = next; } return root; }
  union(left, right) { let a = this.find(left); let b = this.find(right); if (a === b) return; if (this.rank[a] < this.rank[b]) [a, b] = [b, a]; this.parent[b] = a; if (this.rank[a] === this.rank[b]) this.rank[a] += 1; }
}
