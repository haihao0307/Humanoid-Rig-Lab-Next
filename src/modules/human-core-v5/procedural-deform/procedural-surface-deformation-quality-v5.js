const EPSILON = 1e-9;
const MICRO_TRIANGLE_RELATIVE_AREA = 1e-4;
const FLIP_ALIGNMENT_EPSILON = -1e-4;
const DEFAULT_CRITICAL_REGIONS = Object.freeze(new Set([
  'leftUpperArm', 'rightUpperArm', 'leftForearm', 'rightForearm',
  'leftThigh', 'rightThigh', 'leftCalf', 'rightCalf',
  'leftFoot', 'rightFoot', 'pelvis', 'upperTorso',
]));

export function analyzeProceduralSurfaceDeformationQualityV5({
  canonicalPositions,
  deformedPositions,
  indices,
  expectedPositions = null,
  expectedNormals = null,
  regionIds = null,
  regionNames = [],
  detectSelfIntersections = true,
} = {}) {
  assertInputs(canonicalPositions, deformedPositions, indices);
  if (expectedPositions !== null && (!(expectedPositions instanceof Float32Array) || expectedPositions.length !== canonicalPositions.length)) {
    throw new Error('Expected deformation positions must match the canonical surface.');
  }
  const triangleCount = indices.length / 3;
  let triangleFlipCount = 0;
  let triangleAreaRatioMinimum = Number.POSITIVE_INFINITY;
  let triangleAreaRatioMaximum = 0;
  let triangleAreaRatioMinimumTriangle = -1;
  let triangleAreaRatioMaximumTriangle = -1;
  const deformedFaceNormals = new Float32Array(triangleCount * 3);
  const canonicalFaceNormals = new Float32Array(triangleCount * 3);
  const canonicalDoubleAreas = new Float64Array(triangleCount);

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    canonicalDoubleAreas[triangle] = Math.hypot(...triangleVector(canonicalPositions, indices, triangle));
  }
  const positiveCanonicalAreas = [...canonicalDoubleAreas].filter((area) => area > EPSILON).sort((left, right) => left - right);
  const canonicalMedianDoubleArea = percentile(positiveCanonicalAreas, 0.5);
  const evaluableAreaFloor = Math.max(EPSILON, canonicalMedianDoubleArea * MICRO_TRIANGLE_RELATIVE_AREA);
  const evaluableTriangles = new Uint8Array(triangleCount);
  let excludedMicroTriangleCount = 0;
  let evaluableTriangleCount = 0;
  let faceNormalAlignmentMinimum = Number.POSITIVE_INFINITY;

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const canonicalFace = triangleVector(canonicalPositions, indices, triangle);
    const deformedFace = triangleVector(deformedPositions, indices, triangle);
    const canonicalArea2 = canonicalDoubleAreas[triangle];
    const deformedArea2 = Math.hypot(...deformedFace);
    writeUnit(canonicalFaceNormals, triangle, canonicalFace);
    writeUnit(deformedFaceNormals, triangle, deformedFace);
    if (canonicalArea2 < evaluableAreaFloor) {
      excludedMicroTriangleCount += 1;
      continue;
    }
    evaluableTriangles[triangle] = 1;
    evaluableTriangleCount += 1;
    const ratio = deformedArea2 / canonicalArea2;
    if (ratio < triangleAreaRatioMinimum) { triangleAreaRatioMinimum = ratio; triangleAreaRatioMinimumTriangle = triangle; }
    if (ratio > triangleAreaRatioMaximum) { triangleAreaRatioMaximum = ratio; triangleAreaRatioMaximumTriangle = triangle; }
    const expected = expectedPositions instanceof Float32Array
      ? normalize(triangleVector(expectedPositions, indices, triangle), readVec3(canonicalFaceNormals, triangle))
      : expectedFaceNormal(expectedNormals, canonicalFaceNormals, indices, triangle);
    const actual = readVec3(deformedFaceNormals, triangle);
    const alignment = deformedArea2 > EPSILON ? dot(actual, expected) : -1;
    faceNormalAlignmentMinimum = Math.min(faceNormalAlignmentMinimum, alignment);
    if (deformedArea2 <= EPSILON || alignment < FLIP_ALIGNMENT_EPSILON) triangleFlipCount += 1;
  }

  const edgeQuality = analyzeAdjacentFaces(indices, canonicalFaceNormals, deformedFaceNormals, evaluableTriangles);
  const intersections = detectSelfIntersections
    ? findSurfaceSelfIntersectionsV5({ positions: deformedPositions, indices, regionIds, regionNames })
    : { selfIntersectionPairCount: 0, criticalRegionSelfIntersectionCount: 0, rawContactCount: 0, penetratingIntersectionCount: 0, criticalPenetratingCount: 0, broadPhasePairCount: 0, pairs: [], classifiedContacts: [] };
  return {
    triangleFlipCount,
    triangleAreaRatioMinimum: evaluableTriangleCount ? triangleAreaRatioMinimum : 0,
    triangleAreaRatioMaximum,
    triangleAreaRatioMinimumTriangle,
    triangleAreaRatioMaximumTriangle,
    evaluableTriangleCount,
    excludedMicroTriangleCount,
    canonicalMedianTriangleArea: canonicalMedianDoubleArea * 0.5,
    evaluableTriangleAreaFloor: evaluableAreaFloor * 0.5,
    faceNormalAlignmentMinimum: evaluableTriangleCount ? faceNormalAlignmentMinimum : 0,
    localFoldoverCount: edgeQuality.localFoldoverCount,
    localFoldoverPairs: edgeQuality.localFoldoverPairs,
    selfIntersectionPairCount: intersections.selfIntersectionPairCount,
    criticalRegionSelfIntersectionCount: intersections.criticalRegionSelfIntersectionCount,
    rawContactCount: intersections.rawContactCount,
    penetratingIntersectionCount: intersections.penetratingIntersectionCount,
    criticalPenetratingCount: intersections.criticalPenetratingCount,
    normalDiscontinuityP95: edgeQuality.normalDiscontinuityP95,
    broadPhasePairCount: intersections.broadPhasePairCount,
    intersectingPairs: intersections.pairs,
    classifiedIntersectionContacts: intersections.classifiedContacts,
  };
}

export function assertProceduralSurfaceDeformationQualityGateV5(diagnostics) {
  const failures = [];
  if (diagnostics.triangleFlipCount !== 0) failures.push('triangle flips');
  if (diagnostics.localFoldoverCount !== 0) failures.push('local foldovers');
  if (diagnostics.criticalRegionSelfIntersectionCount !== 0) failures.push('critical-region self intersections');
  if (!(diagnostics.triangleAreaRatioMinimum >= 0.15)) failures.push('triangle area minimum below 0.15');
  if (!(diagnostics.triangleAreaRatioMaximum <= 6)) failures.push('triangle area maximum above 6.0');
  if (failures.length) throw new Error(`Procedural surface deformation quality gate failed: ${failures.join(', ')}.`);
  return diagnostics;
}

export function findSurfaceSelfIntersectionsV5({ positions, indices, regionIds = null, regionNames = [] }) {
  if (!(positions instanceof Float32Array) || !(indices instanceof Uint32Array)) throw new Error('Self-intersection analysis requires typed surface arrays.');
  const triangleCount = indices.length / 3;
  const bounds = calculateBounds(positions);
  const diagonal = Math.hypot(...bounds.size);
  const cellSize = Math.max(diagonal / Math.max(8, Math.cbrt(Math.max(1, triangleCount)) * 1.8), 1e-4);
  const cells = new Map();
  const triangleBounds = Array.from({ length: triangleCount }, (_, triangle) => calculateTriangleBounds(positions, indices, triangle));
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const box = triangleBounds[triangle];
    const minimum = box.min.map((value, axis) => Math.floor((value - bounds.min[axis]) / cellSize));
    const maximum = box.max.map((value, axis) => Math.floor((value - bounds.min[axis]) / cellSize));
    for (let x = minimum[0]; x <= maximum[0]; x += 1) for (let y = minimum[1]; y <= maximum[1]; y += 1) for (let z = minimum[2]; z <= maximum[2]; z += 1) {
      const key = `${x}:${y}:${z}`;
      const entries = cells.get(key) ?? [];
      entries.push(triangle);
      cells.set(key, entries);
    }
  }

  const candidates = new Set();
  for (const entries of cells.values()) {
    for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const left = entries[leftIndex]; const right = entries[rightIndex];
      if (left === right || trianglesShareVertex(indices, left, right)) continue;
      candidates.add(left < right ? `${left}:${right}` : `${right}:${left}`);
    }
  }

  const topology = createTriangleNeighbors(indices);
  const classifiedContacts = [];
  const pairs = [];
  let criticalRegionSelfIntersectionCount = 0;
  for (const key of [...candidates].sort(comparePairKeys)) {
    const [left, right] = key.split(':').map(Number);
    if (!boxesOverlap(triangleBounds[left], triangleBounds[right], 1e-8)) continue;
    const contact = classifyTriangleContact(positions, indices, left, right, topology);
    if (!contact) continue;
    const leftRegion = triangleRegion(regionIds, regionNames, indices, left);
    const rightRegion = triangleRegion(regionIds, regionNames, indices, right);
    classifiedContacts.push({ leftTriangle: left, rightTriangle: right, leftRegion, rightRegion, ...contact });
    if (!contact.penetrating) continue;
    const critical = isCriticalIntersection(leftRegion, rightRegion);
    if (critical) criticalRegionSelfIntersectionCount += 1;
    pairs.push({ leftTriangle: left, rightTriangle: right, leftRegion, rightRegion, critical, ...contact });
  }
  return {
    selfIntersectionPairCount: pairs.length,
    criticalRegionSelfIntersectionCount,
    rawContactCount: classifiedContacts.length,
    penetratingIntersectionCount: pairs.length,
    criticalPenetratingCount: criticalRegionSelfIntersectionCount,
    broadPhasePairCount: candidates.size,
    pairs,
    classifiedContacts,
  };
}

function analyzeAdjacentFaces(indices, canonicalNormals, deformedNormals, evaluableTriangles) {
  const edges = new Map();
  for (let triangle = 0; triangle < indices.length / 3; triangle += 1) {
    const vertices = [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]];
    for (const [left, right] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
      const key = left < right ? `${left}:${right}` : `${right}:${left}`;
      const entries = edges.get(key) ?? [];
      entries.push(triangle);
      edges.set(key, entries);
    }
  }
  let localFoldoverCount = 0;
  const localFoldoverPairs = [];
  const discontinuities = [];
  for (const entries of edges.values()) {
    if (entries.length !== 2) continue;
    if (!evaluableTriangles[entries[0]] || !evaluableTriangles[entries[1]]) continue;
    const canonicalDot = clamp(dot(readVec3(canonicalNormals, entries[0]), readVec3(canonicalNormals, entries[1])), -1, 1);
    const deformedDot = clamp(dot(readVec3(deformedNormals, entries[0]), readVec3(deformedNormals, entries[1])), -1, 1);
    const canonicalAngle = Math.acos(canonicalDot);
    const deformedAngle = Math.acos(deformedDot);
    discontinuities.push(deformedAngle * 180 / Math.PI);
    if (deformedAngle - canonicalAngle > Math.PI * 0.70 && deformedDot < -0.1) {
      localFoldoverCount += 1;
      if (localFoldoverPairs.length < 32) localFoldoverPairs.push({
        leftTriangle: entries[0], rightTriangle: entries[1],
        canonicalAngleDegrees: canonicalAngle * 180 / Math.PI,
        deformedAngleDegrees: deformedAngle * 180 / Math.PI,
      });
    }
  }
  discontinuities.sort((left, right) => left - right);
  return {
    localFoldoverCount,
    localFoldoverPairs,
    normalDiscontinuityP95: percentile(discontinuities, 0.95),
  };
}

function trianglesIntersect(positions, indices, leftTriangle, rightTriangle) {
  const left = readTriangle(positions, indices, leftTriangle);
  const right = readTriangle(positions, indices, rightTriangle);
  for (let edge = 0; edge < 3; edge += 1) {
    if (segmentIntersectsTriangle(left[edge], left[(edge + 1) % 3], right)) return true;
    if (segmentIntersectsTriangle(right[edge], right[(edge + 1) % 3], left)) return true;
  }
  return coplanarTrianglesOverlap(left, right);
}

function classifyTriangleContact(positions, indices, leftTriangle, rightTriangle, topology) {
  if (!trianglesIntersect(positions, indices, leftTriangle, rightTriangle)) return null;
  const left = readTriangle(positions, indices, leftTriangle);
  const right = readTriangle(positions, indices, rightTriangle);
  const leftNormal = normalize(cross(subtract(left[1], left[0]), subtract(left[2], left[0])), [0, 0, 0]);
  const rightNormal = normalize(cross(subtract(right[1], right[0]), subtract(right[2], right[0])), [0, 0, 0]);
  const scale = Math.max(1e-6, localPairScale(left, right));
  const tolerance = scale * 1e-7;
  const coplanar = Math.hypot(...cross(leftNormal, rightNormal)) <= 1e-6
    && right.every((point) => Math.abs(dot(leftNormal, subtract(point, left[0]))) <= tolerance);
  const topologicalRingDistance = triangleRingDistance(topology, leftTriangle, rightTriangle, 2);
  if (topologicalRingDistance <= 2) return { intersectionType: 'same-surface-neighbor', penetrating: false, coplanar, contactOnly: true, topologicalRingDistance, intersectionSegment: null, intersectionSegmentLength: 0 };
  if (coplanar) return { intersectionType: 'coplanar-area-overlap', penetrating: false, coplanar: true, contactOnly: true, topologicalRingDistance: null, intersectionSegment: null, intersectionSegmentLength: 0 };
  const segment = transverseIntersectionSegment(left, right, tolerance);
  const length = segment ? Math.hypot(...subtract(segment[1], segment[0])) : 0;
  const midpoint = segment?.[0].map((value, axis) => (value + segment[1][axis]) * 0.5) ?? null;
  const penetrating = Boolean(segment && length > tolerance
    && pointStrictlyInsideTriangle(midpoint, left, 1e-7)
    && pointStrictlyInsideTriangle(midpoint, right, 1e-7));
  return {
    intersectionType: penetrating ? 'penetrating' : 'numeric-uncertainty',
    penetrating,
    coplanar: false,
    contactOnly: !penetrating,
    topologicalRingDistance: null,
    intersectionSegment: segment?.map((point) => [...point]) ?? null,
    intersectionSegmentLength: length,
  };
}

function transverseIntersectionSegment(left, right, tolerance) {
  const points = [...trianglePlaneContacts(left, right, tolerance), ...trianglePlaneContacts(right, left, tolerance)];
  const unique = [];
  for (const point of points) if (!unique.some((entry) => Math.hypot(...subtract(entry, point)) <= tolerance)) unique.push(point);
  if (unique.length < 2) return null;
  let result = null; let maximum = 0;
  for (let a = 0; a < unique.length; a += 1) for (let b = a + 1; b < unique.length; b += 1) {
    const length = Math.hypot(...subtract(unique[a], unique[b]));
    if (length > maximum) { maximum = length; result = [unique[a], unique[b]]; }
  }
  return result;
}

function trianglePlaneContacts(source, target, tolerance) {
  const normal = normalize(cross(subtract(target[1], target[0]), subtract(target[2], target[0])), [0, 0, 0]);
  const distances = source.map((point) => dot(normal, subtract(point, target[0])));
  const contacts = [];
  for (let edge = 0; edge < 3; edge += 1) {
    const next = (edge + 1) % 3;
    const a = source[edge]; const b = source[next]; const da = distances[edge]; const db = distances[next];
    if (Math.abs(da) <= tolerance && pointInsideTriangle(a, target, tolerance)) contacts.push(a);
    if (da * db < 0) {
      const t = da / (da - db);
      const point = a.map((value, axis) => value + (b[axis] - value) * t);
      if (pointInsideTriangle(point, target, tolerance)) contacts.push(point);
    }
  }
  return contacts;
}

function pointInsideTriangle(point, triangle, tolerance) {
  return barycentric(point, triangle).every((value) => value >= -tolerance && value <= 1 + tolerance);
}
function pointStrictlyInsideTriangle(point, triangle, tolerance) {
  return barycentric(point, triangle).every((value) => value > tolerance && value < 1 - tolerance);
}
function barycentric(point, [a, b, c]) {
  const v0 = subtract(b, a); const v1 = subtract(c, a); const v2 = subtract(point, a);
  const d00 = dot(v0, v0); const d01 = dot(v0, v1); const d11 = dot(v1, v1); const d20 = dot(v2, v0); const d21 = dot(v2, v1);
  const denominator = d00 * d11 - d01 * d01;
  if (Math.abs(denominator) <= EPSILON) return [-Infinity, -Infinity, -Infinity];
  const v = (d11 * d20 - d01 * d21) / denominator; const w = (d00 * d21 - d01 * d20) / denominator;
  return [1 - v - w, v, w];
}

function createTriangleNeighbors(indices) {
  const neighbors = Array.from({ length: indices.length / 3 }, () => new Set());
  const edges = new Map();
  for (let triangle = 0; triangle < indices.length / 3; triangle += 1) {
    const vertices = [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]];
    for (const [a, b] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`; const entries = edges.get(key) ?? []; entries.push(triangle); edges.set(key, entries);
    }
  }
  for (const entries of edges.values()) for (const left of entries) for (const right of entries) if (left !== right) neighbors[left].add(right);
  return neighbors;
}
function triangleRingDistance(topology, start, target, maximum) {
  let frontier = new Set([start]); const visited = new Set(frontier);
  for (let distance = 1; distance <= maximum; distance += 1) {
    const next = new Set();
    for (const triangle of frontier) for (const neighbor of topology[triangle]) {
      if (neighbor === target) return distance;
      if (!visited.has(neighbor)) { visited.add(neighbor); next.add(neighbor); }
    }
    frontier = next;
  }
  return Infinity;
}
function localPairScale(left, right) {
  const points = [...left, ...right];
  return Math.hypot(...[0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis])) - Math.min(...points.map((point) => point[axis]))));
}

function segmentIntersectsTriangle(start, end, triangle) {
  const direction = subtract(end, start);
  const edge1 = subtract(triangle[1], triangle[0]);
  const edge2 = subtract(triangle[2], triangle[0]);
  const p = cross(direction, edge2);
  const determinant = dot(edge1, p);
  if (Math.abs(determinant) < 1e-10) return false;
  const inverse = 1 / determinant;
  const tvec = subtract(start, triangle[0]);
  const u = dot(tvec, p) * inverse;
  if (u <= EPSILON || u >= 1 - EPSILON) return false;
  const q = cross(tvec, edge1);
  const v = dot(direction, q) * inverse;
  if (v <= EPSILON || u + v >= 1 - EPSILON) return false;
  const t = dot(edge2, q) * inverse;
  return t > 1e-7 && t < 1 - 1e-7;
}

function coplanarTrianglesOverlap(left, right) {
  const normal = cross(subtract(left[1], left[0]), subtract(left[2], left[0]));
  const normalLength = Math.hypot(...normal);
  if (normalLength < EPSILON) return false;
  const rightNormal = cross(subtract(right[1], right[0]), subtract(right[2], right[0]));
  if (Math.hypot(...cross(normal, rightNormal)) > normalLength * Math.hypot(...rightNormal) * 1e-6) return false;
  if (Math.abs(dot(normal, subtract(right[0], left[0]))) > normalLength * 1e-7) return false;
  const dropAxis = dominantAxis(normal);
  const left2 = left.map((point) => project2(point, dropAxis));
  const right2 = right.map((point) => project2(point, dropAxis));
  for (let a = 0; a < 3; a += 1) for (let b = 0; b < 3; b += 1) {
    if (segmentsIntersect2D(left2[a], left2[(a + 1) % 3], right2[b], right2[(b + 1) % 3])) return true;
  }
  return pointInTriangle2D(left2[0], right2) || pointInTriangle2D(right2[0], left2);
}

function expectedFaceNormal(expectedNormals, canonicalFaceNormals, indices, triangle) {
  if (!(expectedNormals instanceof Float32Array)) return readVec3(canonicalFaceNormals, triangle);
  const expected = [0, 0, 0];
  for (const vertex of [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]]) {
    expected[0] += expectedNormals[vertex * 3];
    expected[1] += expectedNormals[vertex * 3 + 1];
    expected[2] += expectedNormals[vertex * 3 + 2];
  }
  return normalize(expected, readVec3(canonicalFaceNormals, triangle));
}

function triangleRegion(regionIds, regionNames, indices, triangle) {
  if (!(regionIds instanceof Uint16Array) || !regionNames.length) return 'unclassified';
  const counts = new Map();
  for (const vertex of [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]]) {
    const name = regionNames[regionIds[vertex * 4]] ?? 'unclassified';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0][0];
}

function isCriticalIntersection(left, right) {
  if (DEFAULT_CRITICAL_REGIONS.has(left) || DEFAULT_CRITICAL_REGIONS.has(right)) return true;
  return (left === 'pelvis' && /Thigh/.test(right)) || (right === 'pelvis' && /Thigh/.test(left));
}

function readTriangle(positions, indices, triangle) {
  return [0, 1, 2].map((corner) => readVec3(positions, indices[triangle * 3 + corner]));
}

function triangleVector(positions, indices, triangle) {
  const [a, b, c] = readTriangle(positions, indices, triangle);
  return cross(subtract(b, a), subtract(c, a));
}

function writeUnit(target, index, value) {
  target.set(normalize(value, [0, 1, 0]), index * 3);
}

function calculateTriangleBounds(positions, indices, triangle) {
  const points = readTriangle(positions, indices, triangle);
  return {
    min: [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis]))),
  };
}

function calculateBounds(positions) {
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (let offset = 0; offset < positions.length; offset += 3) for (let axis = 0; axis < 3; axis += 1) {
    min[axis] = Math.min(min[axis], positions[offset + axis]); max[axis] = Math.max(max[axis], positions[offset + axis]);
  }
  return { min, max, size: max.map((value, axis) => value - min[axis]) };
}

function trianglesShareVertex(indices, left, right) {
  const leftVertices = new Set([indices[left * 3], indices[left * 3 + 1], indices[left * 3 + 2]]);
  return leftVertices.has(indices[right * 3]) || leftVertices.has(indices[right * 3 + 1]) || leftVertices.has(indices[right * 3 + 2]);
}

function boxesOverlap(left, right, epsilon) {
  return [0, 1, 2].every((axis) => left.max[axis] + epsilon >= right.min[axis] && right.max[axis] + epsilon >= left.min[axis]);
}

function segmentsIntersect2D(a, b, c, d) {
  const abC = orientation2D(a, b, c); const abD = orientation2D(a, b, d);
  const cdA = orientation2D(c, d, a); const cdB = orientation2D(c, d, b);
  return abC * abD < -1e-12 && cdA * cdB < -1e-12;
}

function pointInTriangle2D(point, triangle) {
  const signs = [0, 1, 2].map((index) => orientation2D(triangle[index], triangle[(index + 1) % 3], point));
  const scale = Math.max(1, ...triangle.flatMap((entry) => entry.map(Math.abs)));
  const margin = scale * scale * 1e-12;
  return signs.every((value) => value > margin) || signs.every((value) => value < -margin);
}

function orientation2D(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function dominantAxis(normal) { const values = normal.map(Math.abs); return values.indexOf(Math.max(...values)); }
function project2(point, dropAxis) { return point.filter((_, axis) => axis !== dropAxis); }
function comparePairKeys(left, right) { const a = left.split(':').map(Number); const b = right.split(':').map(Number); return a[0] - b[0] || a[1] - b[1]; }
function readVec3(array, index) { return [array[index * 3], array[index * 3 + 1], array[index * 3 + 2]]; }
function normalize(value, fallback) { const length = Math.hypot(...value); return length > EPSILON ? value.map((item) => item / length) : [...fallback]; }
function subtract(a, b) { return a.map((value, axis) => value - b[axis]); }
function dot(a, b) { return a.reduce((sum, value, axis) => sum + value * b[axis], 0); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
function percentile(sorted, value) { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * value))] : 0; }

function assertInputs(canonicalPositions, deformedPositions, indices) {
  if (!(canonicalPositions instanceof Float32Array) || !(deformedPositions instanceof Float32Array)) throw new Error('Quality analysis requires typed canonical and deformed positions.');
  if (canonicalPositions.length !== deformedPositions.length) throw new Error('Canonical and deformed vertex counts differ.');
  if (!(indices instanceof Uint32Array) || indices.length % 3) throw new Error('Quality analysis requires packed Uint32Array indices.');
}
