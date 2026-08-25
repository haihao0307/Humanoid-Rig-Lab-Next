const EPSILON = 1e-12;

export function orientTrianglesOutwardV5({ positions, indices, field, fullDiagnostics = true }) {
  assertSurfaceInput(positions, indices, field);
  const oriented = new Uint32Array(indices);
  const topology = buildTriangleTopology(oriented);
  const visited = new Uint8Array(oriented.length / 3);
  const parity = new Uint8Array(oriented.length / 3);
  const components = [];
  let propagationConflictCount = 0;

  for (let start = 0; start < visited.length; start += 1) {
    if (visited[start]) continue;
    const component = [];
    const queue = [start];
    visited[start] = 1;
    while (queue.length) {
      const triangle = queue.shift();
      component.push(triangle);
      for (const relation of topology.adjacency[triangle]) {
        const requiredParity = parity[triangle] ^ (relation.sameDirection ? 1 : 0);
        if (!visited[relation.triangle]) {
          visited[relation.triangle] = 1;
          parity[relation.triangle] = requiredParity;
          queue.push(relation.triangle);
        } else if (parity[relation.triangle] !== requiredParity) {
          propagationConflictCount += 1;
        }
      }
    }
    components.push(component);
  }

  for (let triangle = 0; triangle < parity.length; triangle += 1) {
    if (parity[triangle]) flipTriangle(oriented, triangle);
  }

  let outwardComponentFlipCount = 0;
  const epsilon = gradientEpsilon(positions);
  for (const component of components) {
    let alignmentSum = 0;
    let usableFaces = 0;
    const stride = Math.max(1, Math.floor(component.length / 512));
    for (let componentIndex = 0; componentIndex < component.length; componentIndex += stride) {
      const triangle = component[componentIndex];
      const alignment = faceGradientAlignment(positions, oriented, triangle, field, epsilon);
      if (!Number.isFinite(alignment)) continue;
      alignmentSum += alignment;
      usableFaces += 1;
    }
    if (usableFaces && alignmentSum / usableFaces < 0) {
      for (const triangle of component) flipTriangle(oriented, triangle);
      outwardComponentFlipCount += 1;
    }
  }

  const diagnostics = fullDiagnostics
    ? analyzeSurfaceOrientationV5({ positions, indices: oriented, field })
    : summarizeTopologyOrientation(positions, buildTriangleTopology(oriented), oriented);
  return {
    indices: oriented,
    diagnostics: {
      ...diagnostics,
      connectedComponentCount: components.length,
      propagationConflictCount,
      outwardComponentFlipCount,
    },
  };
}

function summarizeTopologyOrientation(positions, topology, indices) {
  let inconsistentSharedEdgeCount = 0;
  for (const occurrences of topology.edges.values()) {
    if (occurrences.length === 2 && occurrences[0].direction === occurrences[1].direction) inconsistentSharedEdgeCount += 1;
  }
  return {
    inconsistentSharedEdgeCount,
    inwardFacingTriangleCount: 0,
    inwardFacingTriangleRatio: 0,
    gradientOpposedTriangleCount: null,
    signedVolume: calculateSignedVolumeFromIndices(positions, indices),
    faceGradientAlignmentMinimum: null,
    faceGradientAlignmentMean: null,
    faceVertexNormalAlignmentMean: null,
    boundaryEdgeCount: [...topology.edges.values()].filter((entries) => entries.length === 1).length,
    nonManifoldEdgeCount: [...topology.edges.values()].filter((entries) => entries.length > 2).length,
  };
}

function calculateSignedVolumeFromIndices(positions, indices) {
  let volume = 0;
  for (let triangle = 0; triangle < indices.length / 3; triangle += 1) {
    const [a, b, c] = readTrianglePositions(positions, indices, triangle);
    volume += dot(a, cross(b, c)) / 6;
  }
  return volume;
}

export function analyzeSurfaceOrientationV5({ positions, normals = null, indices, field }) {
  assertSurfaceInput(positions, indices, field);
  const topology = buildTriangleTopology(indices);
  let inconsistentSharedEdgeCount = 0;
  let gradientOpposedTriangleCount = 0;
  let signedVolume = 0;
  let alignmentMinimum = Number.POSITIVE_INFINITY;
  let alignmentSum = 0;
  let alignmentCount = 0;
  let faceVertexNormalAlignmentSum = 0;
  let faceVertexNormalAlignmentCount = 0;
  const epsilon = gradientEpsilon(positions);
  const faceAlignments = new Float64Array(indices.length / 3);
  faceAlignments.fill(Number.NaN);

  for (const occurrences of topology.edges.values()) {
    if (occurrences.length === 2 && occurrences[0].direction === occurrences[1].direction) {
      inconsistentSharedEdgeCount += 1;
    }
  }

  const triangleCount = indices.length / 3;
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const [a, b, c] = readTrianglePositions(positions, indices, triangle);
    const face = triangleNormal(a, b, c);
    const faceLength = Math.hypot(...face);
    if (faceLength <= EPSILON) continue;
    const unitFace = face.map((value) => value / faceLength);
    const centroid = [0, 1, 2].map((axis) => (a[axis] + b[axis] + c[axis]) / 3);
    const gradient = sampleFieldGradientV5(field, centroid, epsilon);
    const gradientLength = Math.hypot(...gradient);
    if (gradientLength > EPSILON) {
      const alignment = dot(unitFace, gradient) / gradientLength;
      alignmentMinimum = Math.min(alignmentMinimum, alignment);
      alignmentSum += alignment;
      alignmentCount += 1;
      faceAlignments[triangle] = alignment;
      if (alignment < -1e-8) gradientOpposedTriangleCount += 1;
    }
    signedVolume += dot(a, cross(b, c)) / 6;

    if (normals instanceof Float32Array && normals.length === positions.length) {
      for (const vertexIndex of [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]]) {
        const normal = readVec3(normals, vertexIndex);
        const normalLength = Math.hypot(...normal);
        if (normalLength <= EPSILON) continue;
        faceVertexNormalAlignmentSum += dot(unitFace, normal) / normalLength;
        faceVertexNormalAlignmentCount += 1;
      }
    }
  }

  const inwardFacingTriangleCount = countInwardComponents(topology.adjacency, faceAlignments);
  return {
    inconsistentSharedEdgeCount,
    inwardFacingTriangleCount,
    inwardFacingTriangleRatio: triangleCount ? inwardFacingTriangleCount / triangleCount : 1,
    gradientOpposedTriangleCount,
    signedVolume,
    faceGradientAlignmentMinimum: alignmentCount ? alignmentMinimum : -1,
    faceGradientAlignmentMean: alignmentCount ? alignmentSum / alignmentCount : -1,
    faceVertexNormalAlignmentMean: faceVertexNormalAlignmentCount
      ? faceVertexNormalAlignmentSum / faceVertexNormalAlignmentCount
      : null,
    boundaryEdgeCount: [...topology.edges.values()].filter((entries) => entries.length === 1).length,
    nonManifoldEdgeCount: [...topology.edges.values()].filter((entries) => entries.length > 2).length,
  };
}

function countInwardComponents(adjacency, alignments) {
  const visited = new Uint8Array(adjacency.length);
  let inwardTriangleCount = 0;
  for (let start = 0; start < adjacency.length; start += 1) {
    if (visited[start]) continue;
    const queue = [start]; visited[start] = 1;
    const component = [];
    let sum = 0; let count = 0;
    while (queue.length) {
      const triangle = queue.shift();
      component.push(triangle);
      if (Number.isFinite(alignments[triangle])) { sum += alignments[triangle]; count += 1; }
      for (const relation of adjacency[triangle]) if (!visited[relation.triangle]) {
        visited[relation.triangle] = 1;
        queue.push(relation.triangle);
      }
    }
    if (count && sum / count < 0) inwardTriangleCount += component.length;
  }
  return inwardTriangleCount;
}

export function assertSurfaceOrientationGateV5(diagnostics) {
  const failures = [];
  if (diagnostics.inconsistentSharedEdgeCount !== 0) failures.push('inconsistent shared edges');
  if (diagnostics.inwardFacingTriangleCount !== 0) failures.push('inward-facing triangles');
  if (diagnostics.nonManifoldEdgeCount !== 0) failures.push('non-manifold edges');
  if (!(diagnostics.signedVolume > 0)) failures.push('non-positive signed volume');
  if (!(diagnostics.faceGradientAlignmentMean >= 0.95)) failures.push('mean field-gradient alignment below 0.95');
  if (failures.length) throw new Error(`Procedural surface orientation gate failed: ${failures.join(', ')}. ${JSON.stringify(diagnostics)}`);
  return diagnostics;
}

export function sampleFieldGradientV5(field, point, epsilon = 1e-4) {
  const sample = typeof field === 'function' ? field : field?.sample?.bind(field);
  if (!sample) throw new Error('Surface orientation requires a sampleable scalar field.');
  const step = Math.max(1e-7, Number(epsilon) || 1e-4);
  return [0, 1, 2].map((axis) => {
    const plus = [...point];
    const minus = [...point];
    plus[axis] += step;
    minus[axis] -= step;
    return (sample(plus) - sample(minus)) / (2 * step);
  });
}

function buildTriangleTopology(indices) {
  const triangleCount = indices.length / 3;
  const edges = new Map();
  const adjacency = Array.from({ length: triangleCount }, () => []);
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const vertices = [indices[offset], indices[offset + 1], indices[offset + 2]];
    for (const [from, to] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
      const minimum = Math.min(from, to);
      const maximum = Math.max(from, to);
      const key = `${minimum}:${maximum}`;
      const occurrence = { triangle, direction: from === minimum ? 1 : -1 };
      const existing = edges.get(key) ?? [];
      for (const other of existing) {
        adjacency[triangle].push({ triangle: other.triangle, sameDirection: occurrence.direction === other.direction });
        adjacency[other.triangle].push({ triangle, sameDirection: occurrence.direction === other.direction });
      }
      existing.push(occurrence);
      edges.set(key, existing);
    }
  }
  return { edges, adjacency };
}

function faceGradientAlignment(positions, indices, triangle, field, epsilon) {
  const [a, b, c] = readTrianglePositions(positions, indices, triangle);
  const normal = triangleNormal(a, b, c);
  const normalLength = Math.hypot(...normal);
  if (normalLength <= EPSILON) return Number.NaN;
  const centroid = [0, 1, 2].map((axis) => (a[axis] + b[axis] + c[axis]) / 3);
  const gradient = sampleFieldGradientV5(field, centroid, epsilon);
  const gradientLength = Math.hypot(...gradient);
  return gradientLength <= EPSILON ? Number.NaN : dot(normal, gradient) / (normalLength * gradientLength);
}

function gradientEpsilon(positions) {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const value of positions) {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  return Math.max(1e-6, (maximum - minimum) * 1e-5);
}

function readTrianglePositions(positions, indices, triangle) {
  const offset = triangle * 3;
  return [
    readVec3(positions, indices[offset]),
    readVec3(positions, indices[offset + 1]),
    readVec3(positions, indices[offset + 2]),
  ];
}

function readVec3(array, index) {
  return [array[index * 3], array[index * 3 + 1], array[index * 3 + 2]];
}

function triangleNormal(a, b, c) {
  return cross(subtract(b, a), subtract(c, a));
}

function flipTriangle(indices, triangle) {
  const offset = triangle * 3;
  const temporary = indices[offset + 1];
  indices[offset + 1] = indices[offset + 2];
  indices[offset + 2] = temporary;
}

function assertSurfaceInput(positions, indices, field) {
  if (!(positions instanceof Float32Array) || positions.length % 3) throw new Error('Surface positions must be a packed Float32Array.');
  if (!(indices instanceof Uint32Array) || indices.length % 3) throw new Error('Surface indices must be a packed Uint32Array.');
  if (!(typeof field === 'function' || typeof field?.sample === 'function')) throw new Error('A sampleable scalar field is required.');
}

function subtract(a, b) { return a.map((value, axis) => value - b[axis]); }
function dot(a, b) { return a.reduce((sum, value, axis) => sum + value * b[axis], 0); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
