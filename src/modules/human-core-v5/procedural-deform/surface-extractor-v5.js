import { stableFingerprint } from '../core-utils.js';
import { createCanonicalBodyFieldV5 } from './body-field-compiler-v5.js';
import { fairCanonicalSurfaceV5 } from './canonical-surface-fairing-v5.js';
import { assertDeformedSurfaceNormalGateV5, rebuildDeformedSurfaceNormalsV5 } from './deformed-surface-normals-v5.js';
import { assertSurfaceOrientationGateV5, orientTrianglesOutwardV5 } from './orient-procedural-surface-v5.js';
import { createSurfaceRegionBindingV5, rebaseSurfaceRegionBindingV5 } from './surface-region-binding-v5.js';

export const PROCEDURAL_SURFACE_CACHE_METADATA_V5_SCHEMA = 'humanoid_rig/procedural_surface_cache_metadata@5.0';
const TETRAHEDRA = Object.freeze([
  [0, 1, 3, 7], [0, 3, 2, 7], [0, 2, 6, 7],
  [0, 6, 4, 7], [0, 4, 5, 7], [0, 5, 1, 7],
]);
const MIRROR_X_CORNER = Object.freeze([1, 0, 3, 2, 5, 4, 7, 6]);
const MIRRORED_X_TETRAHEDRA = Object.freeze(TETRAHEDRA.map((tetra) => Object.freeze(tetra.map((corner) => MIRROR_X_CORNER[corner]))));
const CUBE_OFFSETS = Object.freeze([
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
  [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
]);

export function createProceduralSurfaceCacheKeyV5(fieldDefinition, resolution) {
  return stableFingerprint({
    bodyDNAFingerprint: fieldDefinition.bodyDNAFingerprint,
    rigTopologyFingerprint: fieldDefinition.rigTopologyFingerprint,
    generatorVersion: fieldDefinition.generatorVersion,
    resolution: normalizeResolution(resolution, fieldDefinition.bounds),
  });
}

export function extractStableProceduralSurfaceV5(fieldInput, { resolution = 28, timestamp = 0 } = {}) {
  const started = performanceNow();
  const field = fieldInput.sample ? fieldInput : createCanonicalBodyFieldV5(fieldInput);
  const definition = field.definition;
  const grid = normalizeResolution(resolution, definition.bounds);
  const [nx, ny, nz] = grid;
  const min = definition.bounds.min;
  const max = definition.bounds.max;
  const step = [
    (max[0] - min[0]) / (nx - 1),
    (max[1] - min[1]) / (ny - 1),
    (max[2] - min[2]) / (nz - 1),
  ];
  const gridCount = nx * ny * nz;
  const values = new Float32Array(gridCount);
  for (let z = 0; z < nz; z += 1) {
    for (let y = 0; y < ny; y += 1) {
      for (let x = 0; x < nx; x += 1) {
        values[gridIndex(x, y, z, nx, ny)] = field.sample([min[0] + x * step[0], min[1] + y * step[1], min[2] + z * step[2]]);
      }
    }
  }
  assertBoundaryOutside(values, nx, ny, nz);
  const vertices = [];
  const triangles = [];
  const edgeVertices = new Map();
  for (let z = 0; z < nz - 1; z += 1) {
    for (let y = 0; y < ny - 1; y += 1) {
      for (let x = 0; x < nx - 1; x += 1) {
        const cubeIds = CUBE_OFFSETS.map(([dx, dy, dz]) => gridIndex(x + dx, y + dy, z + dz, nx, ny));
        const cubeValues = cubeIds.map((index) => values[index]);
        if (cubeValues.every((value) => value >= 0) || cubeValues.every((value) => value < 0)) continue;
        const tetrahedra = x < (nx - 1) / 2 ? TETRAHEDRA : MIRRORED_X_TETRAHEDRA;
        for (const tetra of tetrahedra) polygonizeTetra(tetra.map((corner) => cubeIds[corner]), values, grid, min, step, edgeVertices, vertices, triangles);
      }
    }
  }
  const unreferencedPositions = new Float32Array(vertices.flat());
  const filteredIndices = new Uint32Array(removeTopologicallyInvalidTriangles(triangles));
  const compacted = compactSurfaceVertices(unreferencedPositions, filteredIndices);
  const extractedPositions = compacted.positions;
  const extractedIndices = compacted.indices;
  const initialOrientation = orientTrianglesOutwardV5({ positions: extractedPositions, indices: extractedIndices, field, fullDiagnostics: false });
  const initialBinding = createSurfaceRegionBindingV5(field, extractedPositions);
  const fairingProfile = resolveFairingProfile(grid);
  const fairing = fairCanonicalSurfaceV5({
    positions: extractedPositions,
    indices: initialOrientation.indices,
    field,
    quality: fairingProfile,
    regionIds: initialBinding.regionIds,
    regionNames: initialBinding.regionNames,
  });
  const finalOrientation = orientTrianglesOutwardV5({ positions: fairing.positions, indices: initialOrientation.indices, field });
  const positions = fairing.positions;
  const indices = finalOrientation.indices;
  const normalResult = rebuildDeformedSurfaceNormalsV5({ deformedPositions: positions, indices });
  const normals = normalResult.deformedNormals;
  if (fairingProfile !== 'preview') assertSurfaceOrientationGateV5(finalOrientation.diagnostics);
  assertDeformedSurfaceNormalGateV5(normalResult.normalDiagnostics);
  const binding = rebaseSurfaceRegionBindingV5(initialBinding, positions, definition);
  const geometry = analyzeSurfaceGeometryV5(positions, indices);
  const measurements = measureSurface(definition, positions, binding);
  const topologyFingerprint = hashTypedArrays([indices, binding.regionIds]);
  const cacheKey = createProceduralSurfaceCacheKeyV5(definition, grid);
  const elapsed = performanceNow() - started;
  const metadata = {
    schema: PROCEDURAL_SURFACE_CACHE_METADATA_V5_SCHEMA,
    schemaVersion: 5,
    type: 'StableProceduralSurfaceCache',
    cacheKey,
    fieldFingerprint: definition.fingerprint,
    bodyDNAFingerprint: definition.bodyDNAFingerprint,
    rigTopologyFingerprint: definition.rigTopologyFingerprint,
    generatorVersion: definition.generatorVersion,
    resolution: grid,
    topologyFingerprint,
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
    regionBindingFingerprint: binding.fingerprint,
    bounds: geometry.bounds,
    measurements,
    generationDiagnostics: {
      workerEligible: true,
      generationTimeMs: elapsed,
      gridSampleCount: gridCount,
      connectedComponentCount: geometry.connectedComponentCount,
      boundaryEdgeCount: geometry.boundaryEdgeCount,
      nonManifoldEdgeCount: geometry.nonManifoldEdgeCount,
      nonFiniteVertexCount: geometry.nonFiniteVertexCount,
      outOfRangeIndexCount: geometry.outOfRangeIndexCount,
      degenerateTriangleRatio: geometry.degenerateTriangleRatio,
      orientation: finalOrientation.diagnostics,
      normals: normalResult.normalDiagnostics,
      fairing: fairing.diagnostics,
      timestamp,
    },
    storage: { derivedAsset: true, projectStateAllowed: false, transferableTypedArrays: true },
  };
  return {
    metadata,
    positions,
    normals,
    indices,
    regionIds: binding.regionIds,
    regionBlendWeights: binding.regionBlendWeights,
    regionAxialU: binding.regionAxialU,
    bindLocalData: binding.bindLocalData,
    regionNames: binding.regionNames,
  };
}

export function analyzeSurfaceGeometryV5(positions, indices) {
  const vertexCount = positions.length / 3;
  let nonFiniteVertexCount = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[vertex * 3 + axis];
      if (!Number.isFinite(value)) nonFiniteVertexCount += 1;
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }
  let outOfRangeIndexCount = 0;
  let degenerate = 0;
  const edges = new Map();
  const adjacency = Array.from({ length: vertexCount }, () => []);
  for (let offset = 0; offset < indices.length; offset += 3) {
    const triangle = [indices[offset], indices[offset + 1], indices[offset + 2]];
    if (triangle.some((index) => index >= vertexCount)) { outOfRangeIndexCount += 1; continue; }
    const area = triangleArea(positions, triangle);
    if (area < 1e-12) degenerate += 1;
    for (const [left, right] of [[triangle[0], triangle[1]], [triangle[1], triangle[2]], [triangle[2], triangle[0]]]) {
      const key = left < right ? `${left}:${right}` : `${right}:${left}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
      adjacency[left].push(right); adjacency[right].push(left);
    }
  }
  const used = new Set(indices);
  const visited = new Set();
  let connectedComponentCount = 0;
  for (const start of used) {
    if (visited.has(start)) continue;
    connectedComponentCount += 1;
    const stack = [start]; visited.add(start);
    while (stack.length) {
      for (const next of adjacency[stack.pop()]) if (!visited.has(next)) { visited.add(next); stack.push(next); }
    }
  }
  return {
    bounds: { min, max, size: max.map((value, axis) => value - min[axis]) },
    connectedComponentCount,
    boundaryEdgeCount: [...edges.values()].filter((count) => count === 1).length,
    nonManifoldEdgeCount: [...edges.values()].filter((count) => count > 2).length,
    nonFiniteVertexCount,
    outOfRangeIndexCount,
    degenerateTriangleRatio: indices.length ? degenerate / (indices.length / 3) : 1,
  };
}

function polygonizeTetra(ids, values, grid, min, step, edgeVertices, vertices, triangles) {
  const inside = ids.filter((id) => values[id] < 0);
  const outside = ids.filter((id) => values[id] >= 0);
  if (!inside.length || !outside.length) return;
  const edgeVertex = (left, right) => {
    const key = left < right ? `${left}:${right}` : `${right}:${left}`;
    if (edgeVertices.has(key)) return edgeVertices.get(key);
    const a = gridPosition(left, grid, min, step);
    const b = gridPosition(right, grid, min, step);
    const va = values[left]; const vb = values[right];
    const t = Math.min(1, Math.max(0, va / (va - vb)));
    const index = vertices.length;
    vertices.push(a.map((value, axis) => value + (b[axis] - value) * t));
    edgeVertices.set(key, index);
    return index;
  };
  if (inside.length === 1 || inside.length === 3) {
    const reverse = inside.length === 3;
    const center = reverse ? outside[0] : inside[0];
    const others = reverse ? inside : outside;
    const tri = others.map((id) => edgeVertex(center, id));
    triangles.push(...(reverse ? [tri[0], tri[2], tri[1]] : tri));
    return;
  }
  const [i0, i1] = inside;
  const [o0, o1] = outside;
  const a = edgeVertex(i0, o0); const b = edgeVertex(i0, o1);
  const c = edgeVertex(i1, o0); const d = edgeVertex(i1, o1);
  triangles.push(a, b, c, b, d, c);
}

function removeTopologicallyInvalidTriangles(triangles) {
  const filtered = [];
  for (let offset = 0; offset < triangles.length; offset += 3) {
    const tri = triangles.slice(offset, offset + 3);
    // Marching tetrahedra can produce a geometrically tiny face when the zero
    // set crosses a grid corner. The face is still required to close the two
    // adjacent sheets, and the release contract already bounds its aggregate
    // ratio below 0.1%. Remove only triangles that repeat an index and cannot
    // carry a valid topological edge cycle.
    if (new Set(tri).size === 3) filtered.push(...tri);
  }
  return filtered;
}

function measureSurface(definition, positions, binding) {
  const bounds = analyzeBounds(positions);
  const regionBounds = Object.fromEntries(binding.regionNames.map((name) => [name, { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }]));
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const region = binding.regionNames[binding.regionIds[vertex * 4]];
    const target = regionBounds[region];
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[vertex * 3 + axis]; target.min[axis] = Math.min(target.min[axis], value); target.max[axis] = Math.max(target.max[axis], value);
    }
  }
  const width = (name) => Math.max(0, regionBounds[name].max[0] - regionBounds[name].min[0]);
  const shoulderAnchorWidth = definition.canonicalLayout.shoulderX * 2;
  return {
    height: bounds.max[1] - bounds.min[1],
    // BodyDNA shoulderWidth is the stable bi-acromial Rig landmark span. The
    // deform-only deltoid/scapular helper fields intentionally extend beyond
    // it, so retain the contract value and expose the rendered envelope
    // separately instead of silently redefining the anatomical measurement.
    shoulderWidth: shoulderAnchorWidth,
    surfaceShoulderEnvelopeWidth: width('upperTorso'),
    hipWidth: width('pelvis'),
    targetHeight: definition.canonicalLayout.height,
    targetShoulderWidth: definition.canonicalLayout.shoulderX * 2,
    targetHipWidth: definition.canonicalLayout.hipX * 2,
    limbEndpoints: {
      upperArm: definition.canonicalLayout.upperArmLength,
      forearm: definition.canonicalLayout.forearmLength,
      thigh: definition.canonicalLayout.thighLength,
      lowerLeg: definition.canonicalLayout.lowerLegLength,
    },
  };
}

function normalizeResolution(value, bounds) {
  if (Array.isArray(value)) return value.map((item) => Math.max(8, Math.floor(Number(item) || 8)));
  const ny = Math.max(16, Math.floor(Number(value) || 28));
  const size = bounds.max.map((item, axis) => item - bounds.min[axis]);
  const horizontalQualityScale = ny >= 36 ? 3 : 1;
  const requestedX = Math.max(16, Math.round(ny * size[0] / size[1] * horizontalQualityScale));
  return [
    resolveMirrorSafeXResolution(requestedX, bounds),
    ny,
    Math.max(12, Math.round(ny * size[2] / size[1])),
  ];
}

function resolveMirrorSafeXResolution(requestedX, bounds) {
  const symmetricX = Math.abs(Number(bounds.min[0]) + Number(bounds.max[0]))
    <= Math.max(1e-8, Math.abs(Number(bounds.max[0]) - Number(bounds.min[0])) * 1e-8);
  if (!symmetricX) return requestedX;
  // Keep the bilateral midline between sample columns. The next even density
  // removes the coarse-grid left/right ownership bias without placing an
  // extraction plane directly on the groin subtraction zero set.
  return requestedX + (requestedX % 2 === 0 ? 2 : 1);
}

function compactSurfaceVertices(positions, indices) {
  const remap = new Int32Array(positions.length / 3);
  remap.fill(-1);
  let next = 0;
  for (const index of indices) if (remap[index] < 0) remap[index] = next++;
  const compactedPositions = new Float32Array(next * 3);
  for (let oldIndex = 0; oldIndex < remap.length; oldIndex += 1) {
    const newIndex = remap[oldIndex];
    if (newIndex < 0) continue;
    compactedPositions.set(readPosition(positions, oldIndex), newIndex * 3);
  }
  const compactedIndices = new Uint32Array(indices.length);
  for (let offset = 0; offset < indices.length; offset += 1) compactedIndices[offset] = remap[indices[offset]];
  return { positions: compactedPositions, indices: compactedIndices, removedVertexCount: remap.length - next };
}

function resolveFairingProfile(grid) {
  if (grid[1] >= 52) return 'quality';
  if (grid[1] >= 36) return 'validation';
  return 'preview';
}

function gridIndex(x, y, z, nx, ny) { return x + nx * (y + ny * z); }
function gridPosition(index, [nx, ny], min, step) {
  const z = Math.floor(index / (nx * ny)); const rest = index - z * nx * ny; const y = Math.floor(rest / nx); const x = rest - y * nx;
  return [min[0] + x * step[0], min[1] + y * step[1], min[2] + z * step[2]];
}
function triangleArea(positions, [ia, ib, ic]) {
  const a = readPosition(positions, ia); const b = readPosition(positions, ib); const c = readPosition(positions, ic);
  const ab = b.map((value, axis) => value - a[axis]); const ac = c.map((value, axis) => value - a[axis]);
  const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  return Math.hypot(...cross) * 0.5;
}
function readPosition(positions, index) { return [positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]]; }
function analyzeBounds(positions) {
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (let offset = 0; offset < positions.length; offset += 3) for (let axis = 0; axis < 3; axis += 1) { min[axis] = Math.min(min[axis], positions[offset + axis]); max[axis] = Math.max(max[axis], positions[offset + axis]); }
  return { min, max };
}
function assertBoundaryOutside(values, nx, ny, nz) {
  for (let z = 0; z < nz; z += 1) for (let y = 0; y < ny; y += 1) for (let x = 0; x < nx; x += 1) {
    if ((x === 0 || y === 0 || z === 0 || x === nx - 1 || y === ny - 1 || z === nz - 1) && values[gridIndex(x, y, z, nx, ny)] < 0) {
      throw new Error('Body field intersects extraction bounds; increase canonical field margin.');
    }
  }
}
function hashTypedArrays(arrays) {
  let hash = 0x811c9dc5;
  for (const array of arrays) for (const value of new Uint8Array(array.buffer, array.byteOffset, array.byteLength)) { hash ^= value; hash = Math.imul(hash, 0x01000193); }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
function performanceNow() { return globalThis.performance?.now?.() ?? Date.now(); }
