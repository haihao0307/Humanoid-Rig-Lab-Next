import { sampleFieldGradientV5 } from './orient-procedural-surface-v5.js';

export const CANONICAL_SURFACE_FAIRING_PROFILES_V5 = Object.freeze({
  preview: Object.freeze({ iterations: 1, lambda: 0.10, mu: -0.105, projectionIterations: 2 }),
  validation: Object.freeze({ iterations: 2, lambda: 0.13, mu: -0.136, projectionIterations: 3 }),
  quality: Object.freeze({ iterations: 4, lambda: 0.15, mu: -0.158, projectionIterations: 4 }),
});

export function fairCanonicalSurfaceV5({
  positions,
  indices,
  field,
  quality = 'validation',
  regionIds = null,
  regionNames = [],
  diagnosticHook = null,
}) {
  if (!(positions instanceof Float32Array) || positions.length % 3) throw new Error('Canonical fairing requires packed Float32Array positions.');
  if (!(indices instanceof Uint32Array) || indices.length % 3) throw new Error('Canonical fairing requires packed Uint32Array indices.');
  if (typeof field?.sample !== 'function') throw new Error('Canonical fairing requires the canonical scalar field.');
  const profile = CANONICAL_SURFACE_FAIRING_PROFILES_V5[quality];
  if (!profile) throw new Error(`Unknown canonical fairing quality profile ${quality}.`);
  if (diagnosticHook !== null && typeof diagnosticHook !== 'function') throw new Error('Canonical fairing diagnosticHook must be a function or null.');
  const adjacency = buildAdjacency(positions.length / 3, indices);
  const averageEdgeLength = calculateAverageEdgeLength(positions, indices);
  const constrained = createConstraintMask(positions, field.definition, regionIds, regionNames);
  const result = new Float32Array(positions);
  const initial = new Float32Array(positions);
  const maximumPassDisplacement = Math.max(1e-6, averageEdgeLength * 0.22);
  const gradientStep = Math.max(1e-6, averageEdgeLength * 0.08);
  const projectionDirections = buildProjectionDirections(initial, field, gradientStep);
  const revertedVertices = new Set();
  let bilateralHalfSpaceClampCount = 0;

  for (let iteration = 0; iteration < profile.iterations; iteration += 1) {
    laplacianPass(result, adjacency, constrained, profile.lambda, maximumPassDisplacement);
    emitDiagnosticStage(diagnosticHook, `fairing-iteration-${iteration + 1}-lambda`, result, indices);
    laplacianPass(result, adjacency, constrained, profile.mu, maximumPassDisplacement);
    emitDiagnosticStage(diagnosticHook, `fairing-iteration-${iteration + 1}-mu`, result, indices);
    projectToZeroSet(result, field, constrained, projectionDirections, profile.projectionIterations, averageEdgeLength * 0.75);
    emitDiagnosticStage(diagnosticHook, `fairing-iteration-${iteration + 1}-projected`, result, indices);
    bilateralHalfSpaceClampCount += preserveBilateralHalfSpaces(result, initial);
    emitDiagnosticStage(diagnosticHook, `fairing-iteration-${iteration + 1}-halfspace`, result, indices);
    for (const vertex of repairUnsafeTriangles(result, initial, indices)) revertedVertices.add(vertex);
    emitDiagnosticStage(diagnosticHook, `fairing-iteration-${iteration + 1}-safe-repair`, result, indices);
  }

  let maximumDisplacement = 0;
  let squaredDisplacement = 0;
  let maximumAbsoluteFieldError = 0;
  for (let vertex = 0; vertex < result.length / 3; vertex += 1) {
    const offset = vertex * 3;
    const displacement = Math.hypot(
      result[offset] - initial[offset],
      result[offset + 1] - initial[offset + 1],
      result[offset + 2] - initial[offset + 2],
    );
    maximumDisplacement = Math.max(maximumDisplacement, displacement);
    squaredDisplacement += displacement * displacement;
    maximumAbsoluteFieldError = Math.max(maximumAbsoluteFieldError, Math.abs(field.sample(readVec3(result, vertex))));
  }
  return {
    positions: result,
    diagnostics: {
      profile: quality,
      iterations: profile.iterations,
      constrainedVertexCount: constrained.reduce((sum, value) => sum + value, 0),
      averageEdgeLength,
      maximumDisplacement,
      rmsDisplacement: Math.sqrt(squaredDisplacement / Math.max(1, result.length / 3)),
      maximumAbsoluteFieldError,
      revertedUnsafeVertexCount: revertedVertices.size,
      bilateralHalfSpaceClampCount,
      deterministic: true,
      animationTimeFairing: false,
    },
  };
}

function emitDiagnosticStage(hook, stageId, positions, indices) {
  if (!hook) return;
  hook({
    stageId,
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  });
}

function preserveBilateralHalfSpaces(positions, canonical) {
  let clampCount = 0;
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const offset = vertex * 3;
    const canonicalX = canonical[offset];
    const currentX = positions[offset];
    if (Math.abs(canonicalX) <= 1e-9) {
      if (currentX !== 0) { positions[offset] = 0; clampCount += 1; }
    } else if (canonicalX < 0 && currentX >= 0) {
      positions[offset] = Math.min(-1e-9, canonicalX * 0.25);
      clampCount += 1;
    } else if (canonicalX > 0 && currentX <= 0) {
      positions[offset] = Math.max(1e-9, canonicalX * 0.25);
      clampCount += 1;
    }
  }
  return clampCount;
}

function repairUnsafeTriangles(positions, canonical, indices) {
  const reverted = new Set();
  for (let pass = 0; pass < 4; pass += 1) {
    const unsafe = new Set();
    for (let offset = 0; offset < indices.length; offset += 3) {
      const vertices = [indices[offset], indices[offset + 1], indices[offset + 2]];
      const canonicalFace = faceVector(canonical, vertices);
      const deformedFace = faceVector(positions, vertices);
      const canonicalArea2 = Math.hypot(...canonicalFace);
      const deformedArea2 = Math.hypot(...deformedFace);
      const alignment = canonicalArea2 && deformedArea2
        ? canonicalFace.reduce((sum, value, axis) => sum + value * deformedFace[axis], 0) / (canonicalArea2 * deformedArea2)
        : -1;
      if (deformedArea2 < canonicalArea2 * 0.20 || alignment < 0.05) for (const vertex of vertices) unsafe.add(vertex);
    }
    if (!unsafe.size) break;
    for (const vertex of unsafe) {
      positions.set(readVec3(canonical, vertex), vertex * 3);
      reverted.add(vertex);
    }
  }
  return reverted;
}

function faceVector(positions, vertices) {
  const a = readVec3(positions, vertices[0]); const b = readVec3(positions, vertices[1]); const c = readVec3(positions, vertices[2]);
  const ab = b.map((value, axis) => value - a[axis]); const ac = c.map((value, axis) => value - a[axis]);
  return [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
}

function laplacianPass(positions, adjacency, constrained, amount, maximumDisplacement) {
  const source = new Float32Array(positions);
  for (let vertex = 0; vertex < adjacency.length; vertex += 1) {
    if (constrained[vertex] || !adjacency[vertex].length) continue;
    const offset = vertex * 3;
    const average = [0, 0, 0];
    for (const neighbor of adjacency[vertex]) {
      average[0] += source[neighbor * 3];
      average[1] += source[neighbor * 3 + 1];
      average[2] += source[neighbor * 3 + 2];
    }
    average[0] /= adjacency[vertex].length;
    average[1] /= adjacency[vertex].length;
    average[2] /= adjacency[vertex].length;
    const delta = [
      (average[0] - source[offset]) * amount,
      (average[1] - source[offset + 1]) * amount,
      (average[2] - source[offset + 2]) * amount,
    ];
    const length = Math.hypot(...delta);
    const scale = length > maximumDisplacement ? maximumDisplacement / length : 1;
    positions[offset] = source[offset] + delta[0] * scale;
    positions[offset + 1] = source[offset + 1] + delta[1] * scale;
    positions[offset + 2] = source[offset + 2] + delta[2] * scale;
  }
}

function projectToZeroSet(positions, field, constrained, projectionDirections, iterations, maximumCorrection) {
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    if (constrained[vertex]) continue;
    const point = readVec3(positions, vertex);
    let correctionTotal = 0;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const distance = field.sample(point);
      if (Math.abs(distance) < 1e-7) break;
      const outward = readVec3(projectionDirections, vertex);
      if (Math.hypot(...outward) < 0.99) break;
      let proposedLength = Math.min(Math.abs(distance), maximumCorrection * 0.5);
      const remaining = Math.max(0, maximumCorrection - correctionTotal);
      proposedLength = Math.min(proposedLength, remaining);
      const direction = outward.map((value) => -Math.sign(distance) * value);
      let accepted = false;
      for (let attempt = 0; attempt < 8 && proposedLength > 1e-9; attempt += 1) {
        const candidate = point.map((value, axis) => value + direction[axis] * proposedLength);
        if (Math.abs(field.sample(candidate)) < Math.abs(distance)) {
          point.splice(0, 3, ...candidate);
          accepted = true;
          break;
        }
        proposedLength *= 0.5;
      }
      if (!accepted) break;
      correctionTotal += proposedLength;
      if (correctionTotal >= maximumCorrection) break;
    }
    positions.set(point, vertex * 3);
  }
}

function buildProjectionDirections(positions, field, gradientStep) {
  const directions = new Float32Array(positions.length);
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const gradient = sampleFieldGradientV5(field, readVec3(positions, vertex), gradientStep);
    const length = Math.hypot(...gradient);
    directions.set(length > 1e-9 ? gradient.map((value) => value / length) : [0, 0, 0], vertex * 3);
  }
  return directions;
}

function createConstraintMask(positions, definition, regionIds, regionNames) {
  const vertexCount = positions.length / 3;
  const constrained = new Uint8Array(vertexCount);
  const bounds = calculateBounds(positions);
  const extent = bounds.max.map((value, axis) => value - bounds.min[axis]);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const point = readVec3(positions, vertex);
    for (let axis = 0; axis < 3; axis += 1) {
      const tolerance = Math.max(1e-7, extent[axis] * 0.0025);
      if (Math.abs(point[axis] - bounds.min[axis]) <= tolerance || Math.abs(point[axis] - bounds.max[axis]) <= tolerance) {
        constrained[vertex] = 1;
      }
    }
  }
  const anchors = [];
  for (const region of definition?.regions ?? []) {
    anchors.push(...primitiveConstraintPoints(region.primitive));
  }
  for (const anchor of anchors) constrained[nearestVertex(positions, anchor)] = 1;
  if (regionIds instanceof Uint16Array && regionIds.length === vertexCount * 4 && regionNames.length) {
    constrainRegionExtrema(positions, constrained, regionIds, regionNames);
  }
  return constrained;
}

function constrainRegionExtrema(positions, constrained, regionIds, regionNames) {
  const records = new Map(regionNames.map((name) => [name, {
    min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity],
    minVertex: [-1, -1, -1], maxVertex: [-1, -1, -1],
  }]));
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const name = regionNames[regionIds[vertex * 4]];
    const record = records.get(name);
    if (!record) continue;
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[vertex * 3 + axis];
      if (value < record.min[axis]) { record.min[axis] = value; record.minVertex[axis] = vertex; }
      if (value > record.max[axis]) { record.max[axis] = value; record.maxVertex[axis] = vertex; }
    }
  }
  for (const record of records.values()) for (const vertex of [...record.minVertex, ...record.maxVertex]) {
    if (vertex >= 0) constrained[vertex] = 1;
  }
}

function primitiveConstraintPoints(primitive) {
  const points = [];
  if (primitive.center) {
    points.push(primitive.center);
    for (let axis = 0; axis < 3; axis += 1) for (const sign of [-1, 1]) {
      const point = [...primitive.center];
      point[axis] += primitive.radii[axis] * sign;
      points.push(point);
    }
    return points;
  }
  for (const [center, radii] of [[primitive.start, primitive.startRadii], [primitive.end, primitive.endRadii]]) {
    points.push(center);
    for (let axis = 0; axis < 3; axis += 1) for (const sign of [-1, 1]) {
      const point = [...center];
      point[axis] += radii[axis] * sign;
      points.push(point);
    }
  }
  return points;
}

function buildAdjacency(vertexCount, indices) {
  const sets = Array.from({ length: vertexCount }, () => new Set());
  for (let offset = 0; offset < indices.length; offset += 3) {
    const vertices = [indices[offset], indices[offset + 1], indices[offset + 2]];
    for (const [left, right] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
      sets[left].add(right);
      sets[right].add(left);
    }
  }
  return sets.map((set) => [...set].sort((left, right) => left - right));
}

function calculateAverageEdgeLength(positions, indices) {
  const edges = new Set();
  let total = 0;
  for (let offset = 0; offset < indices.length; offset += 3) {
    const vertices = [indices[offset], indices[offset + 1], indices[offset + 2]];
    for (const [left, right] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
      const minimum = Math.min(left, right); const maximum = Math.max(left, right);
      const key = `${minimum}:${maximum}`;
      if (edges.has(key)) continue;
      edges.add(key);
      total += distance(readVec3(positions, minimum), readVec3(positions, maximum));
    }
  }
  return total / Math.max(1, edges.size);
}

function nearestVertex(positions, point) {
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const candidate = readVec3(positions, vertex);
    const value = squaredDistance(candidate, point);
    if (value < nearestDistance) { nearestDistance = value; nearest = vertex; }
  }
  return nearest;
}

function calculateBounds(positions) {
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (let offset = 0; offset < positions.length; offset += 3) for (let axis = 0; axis < 3; axis += 1) {
    min[axis] = Math.min(min[axis], positions[offset + axis]);
    max[axis] = Math.max(max[axis], positions[offset + axis]);
  }
  return { min, max };
}

function readVec3(array, vertex) { return [array[vertex * 3], array[vertex * 3 + 1], array[vertex * 3 + 2]]; }
function distance(a, b) { return Math.sqrt(squaredDistance(a, b)); }
function squaredDistance(a, b) { return a.reduce((sum, value, axis) => sum + (value - b[axis]) ** 2, 0); }
