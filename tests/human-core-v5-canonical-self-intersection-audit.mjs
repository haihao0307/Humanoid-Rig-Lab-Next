import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  HumanCoreRuntime,
  PROCEDURAL_BODY_DNA_PRESETS_V5,
  ProceduralDeformRuntimeV5,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
} from '../src/modules/human-core-v5/index.js';

const ASSERT_MODE = process.argv.includes('--assert');
const OUTPUT_PATH = resolve('artifacts/qa/task14c-geometry-v1/stage2-recovery/canonical-self-intersection-audit.json');
const EVIDENCE_ROOT = resolve('artifacts/qa/task14c-geometry-v1/stage2-recovery/intersections');
const PRESETS = Object.freeze(['Reference', 'Lean', 'Muscular', 'Heavy', 'Tall', 'Short', 'Asymmetric']);
const POSES = Object.freeze(['t-pose', 'a-pose']);
const REPRESENTATIVE_PAIRS = Object.freeze([[80, 2743], [80, 2756], [80, 2758], [82, 2755], [82, 2756], [82, 2757], [82, 2758], [83, 2759], [83, 2760]]);
const EPSILON = 1e-9;
const priorReport = ASSERT_MODE ? JSON.parse(await readFile(OUTPUT_PATH, 'utf8')) : null;

const report = {
  schema: 'humanoid_rig/procedural_canonical_self_intersection_truth_audit@5.0',
  task: 'Task 14C-1B-R0',
  sourceBehavior: '649ab94 canonical procedural surface; production detector unchanged for initial audit',
  resolution: 36,
  poses: [...POSES],
  scenarios: [],
  representativeMuscularPairs: [],
  summary: { rawContactCount: 0, penetratingIntersectionCount: 0, criticalPenetratingCount: 0 },
};

await mkdir(EVIDENCE_ROOT, { recursive: true });
for (const preset of PRESETS) {
  const bodyDNA = createBodyDNA({
    ...PROCEDURAL_BODY_DNA_PRESETS_V5[preset],
    bodyDNAId: `task14c-r0-intersection-${preset.toLowerCase()}`,
    identity: { humanId: `task14c-r0-intersection-${preset.toLowerCase()}`, label: preset },
    proportionRevision: 14,
  });
  const human = new HumanCoreRuntime();
  human.createHuman(bodyDNA);
  const rigCore = human.getRigCore();
  const runtime = new ProceduralDeformRuntimeV5();
  runtime.compileHuman({ bodyDNA, rigCore });
  await runtime.generateCanonicalSurface({ resolution: 36, worker: false });
  const topology = createTriangleTopology(runtime.surface.indices);
  for (const poseId of POSES) {
    const pose = createProceduralDeformValidationPoseV5({ poseId, rigCore, bodyDNA, timestamp: 1 });
    human.updatePose(pose);
    const frame = runtime.update({ finalPose: pose, anatomyState: human.getAnatomyState(), timestamp: 1 });
    const production = runtime.analyzeCurrentDeformationQuality();
    const productionContacts = production.classifiedIntersectionContacts ?? production.intersectingPairs;
    const pairs = productionContacts.map((pair) => classifyPair({
      preset,
      poseId,
      pair,
      positions: frame.deformedPositions,
      indices: frame.indices,
      regionIds: frame.regionIds,
      regionNames: runtime.surface.regionNames,
      topology,
    }));
    const scenario = {
      preset,
      poseId,
      bodyDNAFingerprint: frame.bodyDNAFingerprint,
      topologyFingerprint: frame.topologyFingerprint,
      rawContactCount: pairs.length,
      penetratingIntersectionCount: pairs.filter((pair) => pair.penetrating).length,
      criticalPenetratingCount: pairs.filter((pair) => pair.penetrating && pair.critical).length,
      productionDetectorCounts: {
        rawContactCount: production.rawContactCount ?? production.selfIntersectionPairCount,
        penetratingIntersectionCount: production.penetratingIntersectionCount ?? production.selfIntersectionPairCount,
        criticalPenetratingCount: production.criticalPenetratingCount ?? production.criticalRegionSelfIntersectionCount,
      },
      classifications: countBy(pairs, (pair) => pair.intersectionType),
      pairs,
    };
    report.scenarios.push(scenario);
    report.summary.rawContactCount += scenario.rawContactCount;
    report.summary.penetratingIntersectionCount += scenario.penetratingIntersectionCount;
    report.summary.criticalPenetratingCount += scenario.criticalPenetratingCount;
    if (preset === 'Muscular' && poseId === 't-pose') {
      for (const [leftTriangle, rightTriangle] of REPRESENTATIVE_PAIRS) {
        const existing = pairs.find((entry) => entry.leftTriangle === leftTriangle && entry.rightTriangle === rightTriangle);
        const classified = existing ?? classifyPair({
          preset,
          poseId,
          pair: { leftTriangle, rightTriangle },
          positions: frame.deformedPositions,
          indices: frame.indices,
          regionIds: frame.regionIds,
          regionNames: runtime.surface.regionNames,
          topology,
        });
        const fileName = `muscular-t-pose-triangles-${leftTriangle}-${rightTriangle}.obj`;
        await writeFile(resolve(EVIDENCE_ROOT, fileName), createPairOBJ(classified), 'utf8');
        report.representativeMuscularPairs.push({ ...classified, evidence: `intersections/${fileName}`, reportedByProductionDetector: Boolean(existing) });
      }
    }
  }
  runtime.dispose();
}

if (priorReport) {
  const beforeScenarios = priorReport.scenarios.map((scenario) => ({
    preset: scenario.preset,
    poseId: scenario.poseId,
    rawContactCount: scenario.pairs.length,
    penetratingIntersectionCount: scenario.pairs.length,
    criticalPenetratingCount: scenario.pairs.filter((pair) => isCriticalRegionPair(pair.leftRegion, pair.rightRegion)).length,
  }));
  report.detectorComparison = {
    before: aggregateCounts(beforeScenarios),
    after: aggregateCounts(report.scenarios.map((scenario) => scenario.productionDetectorCounts)),
    scenarios: report.scenarios.map((scenario) => ({
      preset: scenario.preset,
      poseId: scenario.poseId,
      before: beforeScenarios.find((entry) => entry.preset === scenario.preset && entry.poseId === scenario.poseId),
      after: scenario.productionDetectorCounts,
    })),
  };
}

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (ASSERT_MODE) {
  assert.equal(report.scenarios.length, PRESETS.length * POSES.length);
  assert.equal(report.representativeMuscularPairs.length, REPRESENTATIVE_PAIRS.length);
  assert.deepEqual(report.detectorComparison?.after, report.summary, 'Production detector counts must match the independently classified audit truth.');
  assert.equal(report.detectorComparison.before.rawContactCount, report.detectorComparison.after.rawContactCount, 'Classification must preserve the raw contact count.');
  assert.ok(report.detectorComparison.after.penetratingIntersectionCount < report.detectorComparison.before.penetratingIntersectionCount, 'False contacts must be removed from penetrating intersections.');
  for (const pair of report.scenarios.flatMap((scenario) => scenario.pairs)) assertPairRecord(pair);
  for (const pair of report.representativeMuscularPairs) assertPairRecord(pair);
}
console.log(JSON.stringify({ output: OUTPUT_PATH, ...report.summary, scenarios: report.scenarios.map(compactScenario), representativeMuscularPairs: report.representativeMuscularPairs.map(compactPair) }));
console.log(`Human Core V5 canonical self-intersection truth audit ${ASSERT_MODE ? 'asserted' : 'recorded'}.`);

function classifyPair({ preset, poseId, pair, positions, indices, regionIds, regionNames, topology }) {
  const leftTriangle = pair.leftTriangle;
  const rightTriangle = pair.rightTriangle;
  const leftVertices = triangleVertexIndices(indices, leftTriangle);
  const rightVertices = triangleVertexIndices(indices, rightTriangle);
  const sharedVertices = leftVertices.filter((vertex) => rightVertices.includes(vertex));
  const left = leftVertices.map((vertex) => readPoint(positions, vertex));
  const right = rightVertices.map((vertex) => readPoint(positions, vertex));
  const leftNormal = unit(cross(subtract(left[1], left[0]), subtract(left[2], left[0])));
  const rightNormal = unit(cross(subtract(right[1], right[0]), subtract(right[2], right[0])));
  const normalAngle = Math.acos(clamp(Math.abs(dot(leftNormal, rightNormal)), -1, 1)) * 180 / Math.PI;
  const scale = Math.max(1e-6, diagonal(unionBounds([...left, ...right])));
  const planeTolerance = scale * 1e-7;
  const parallel = Math.hypot(...cross(leftNormal, rightNormal)) <= 1e-6;
  const coplanar = parallel && right.every((point) => Math.abs(dot(leftNormal, subtract(point, left[0]))) <= planeTolerance);
  const coplanarOverlapArea = coplanar ? coplanarTriangleOverlapArea(left, right, leftNormal) : 0;
  const intersectionSegment = coplanar ? null : transverseIntersectionSegment(left, right, planeTolerance);
  const segmentLength = intersectionSegment ? distance(intersectionSegment[0], intersectionSegment[1]) : 0;
  const strictInteriorSegment = Boolean(intersectionSegment && segmentLength > scale * 1e-7
    && pointStrictlyInsideTriangle(midpoint(intersectionSegment[0], intersectionSegment[1]), left, scale * 1e-7)
    && pointStrictlyInsideTriangle(midpoint(intersectionSegment[0], intersectionSegment[1]), right, scale * 1e-7));
  const topologicalRingDistance = triangleRingDistance(topology, leftTriangle, rightTriangle, 3);
  const sharedEdge = sharedVertices.length >= 2;
  const duplicate = trianglesNearDuplicate(left, right, scale * 1e-7);
  let intersectionType = 'numeric-uncertainty';
  if (duplicate) intersectionType = 'duplicate-triangle';
  else if (sharedEdge) intersectionType = 'edge-contact';
  else if (sharedVertices.length) intersectionType = 'vertex-contact';
  else if (topologicalRingDistance <= 2) intersectionType = 'same-surface-neighbor';
  else if (coplanarOverlapArea > scale * scale * 1e-10) intersectionType = 'coplanar-area-overlap';
  else if (strictInteriorSegment) intersectionType = 'penetrating';
  else if (minimumVertexDistance(left, right) <= scale * 1e-7) intersectionType = 'near-contact';
  const penetrating = intersectionType === 'penetrating';
  const leftRegion = triangleRegion(regionIds, regionNames, leftVertices);
  const rightRegion = triangleRegion(regionIds, regionNames, rightVertices);
  return {
    preset,
    poseId,
    leftTriangle,
    rightTriangle,
    leftRegion,
    rightRegion,
    leftVertices: leftVertices.map((vertex, corner) => ({ vertex, position: roundVector(left[corner]) })),
    rightVertices: rightVertices.map((vertex, corner) => ({ vertex, position: roundVector(right[corner]) })),
    sharedVertexCount: sharedVertices.length,
    sharedEdge,
    minimumVertexDistance: round(minimumVertexDistance(left, right)),
    intersectionType,
    coplanar,
    coplanarOverlapArea: round(coplanarOverlapArea),
    contactOnly: !penetrating,
    penetrating,
    critical: penetrating && isCriticalRegionPair(leftRegion, rightRegion),
    intersectionSegment: intersectionSegment?.map(roundVector) ?? null,
    intersectionSegmentLength: round(segmentLength),
    strictInteriorSegment,
    localBounds: roundBounds(unionBounds([...left, ...right])),
    localSurfaceNormalAngle: round(normalAngle),
    topologicalRingDistance: Number.isFinite(topologicalRingDistance) ? topologicalRingDistance : null,
    sameContinuousSurfacePatch: topologicalRingDistance <= 2,
  };
}

function transverseIntersectionSegment(left, right, tolerance) {
  const points = [
    ...trianglePlaneContacts(left, right, tolerance),
    ...trianglePlaneContacts(right, left, tolerance),
  ];
  const unique = [];
  for (const point of points) if (!unique.some((entry) => distance(entry, point) <= tolerance)) unique.push(point);
  if (unique.length < 2) return null;
  let result = null;
  let maximum = 0;
  for (let leftIndex = 0; leftIndex < unique.length; leftIndex += 1) for (let rightIndex = leftIndex + 1; rightIndex < unique.length; rightIndex += 1) {
    const length = distance(unique[leftIndex], unique[rightIndex]);
    if (length > maximum) { maximum = length; result = [unique[leftIndex], unique[rightIndex]]; }
  }
  return result;
}

function trianglePlaneContacts(source, target, tolerance) {
  const normal = unit(cross(subtract(target[1], target[0]), subtract(target[2], target[0])));
  const distances = source.map((point) => dot(normal, subtract(point, target[0])));
  const contacts = [];
  for (let edge = 0; edge < 3; edge += 1) {
    const next = (edge + 1) % 3;
    const a = source[edge]; const b = source[next];
    const da = distances[edge]; const db = distances[next];
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
  const barycentric = barycentricCoordinates(point, triangle);
  return barycentric.every((value) => value >= -tolerance && value <= 1 + tolerance);
}
function pointStrictlyInsideTriangle(point, triangle, tolerance) {
  const barycentric = barycentricCoordinates(point, triangle);
  return barycentric.every((value) => value > tolerance && value < 1 - tolerance);
}
function barycentricCoordinates(point, [a, b, c]) {
  const v0 = subtract(b, a); const v1 = subtract(c, a); const v2 = subtract(point, a);
  const d00 = dot(v0, v0); const d01 = dot(v0, v1); const d11 = dot(v1, v1);
  const d20 = dot(v2, v0); const d21 = dot(v2, v1);
  const denominator = d00 * d11 - d01 * d01;
  if (Math.abs(denominator) <= EPSILON) return [-Infinity, -Infinity, -Infinity];
  const v = (d11 * d20 - d01 * d21) / denominator;
  const w = (d00 * d21 - d01 * d20) / denominator;
  return [1 - v - w, v, w];
}

function coplanarTriangleOverlapArea(left, right, normal) {
  const axis = dominantAxis(normal);
  let subject = orientPolygon(left.map((point) => project2(point, axis)));
  const clip = orientPolygon(right.map((point) => project2(point, axis)));
  for (let edge = 0; edge < clip.length && subject.length; edge += 1) {
    const a = clip[edge]; const b = clip[(edge + 1) % clip.length];
    const input = subject; subject = [];
    for (let index = 0; index < input.length; index += 1) {
      const current = input[index]; const previous = input[(index + input.length - 1) % input.length];
      const currentInside = orientation2D(a, b, current) >= -1e-12;
      const previousInside = orientation2D(a, b, previous) >= -1e-12;
      if (currentInside !== previousInside) subject.push(lineIntersection2D(previous, current, a, b));
      if (currentInside) subject.push(current);
    }
  }
  const projectedArea = polygonArea(subject);
  return projectedArea * Math.hypot(...normal) / Math.max(Math.abs(normal[axis]), EPSILON);
}

function createTriangleTopology(indices) {
  const neighbors = Array.from({ length: indices.length / 3 }, () => new Set());
  const edges = new Map();
  for (let triangle = 0; triangle < indices.length / 3; triangle += 1) {
    const vertices = triangleVertexIndices(indices, triangle);
    for (const [a, b] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const entries = edges.get(key) ?? [];
      entries.push(triangle); edges.set(key, entries);
    }
  }
  for (const entries of edges.values()) for (const left of entries) for (const right of entries) if (left !== right) neighbors[left].add(right);
  return neighbors;
}
function triangleRingDistance(topology, start, target, maximum) {
  if (start === target) return 0;
  let frontier = new Set([start]); const visited = new Set(frontier);
  for (let distance = 1; distance <= maximum; distance += 1) {
    const next = new Set();
    for (const triangle of frontier) for (const neighbor of topology[triangle] ?? []) {
      if (neighbor === target) return distance;
      if (!visited.has(neighbor)) { visited.add(neighbor); next.add(neighbor); }
    }
    frontier = next;
  }
  return Infinity;
}

function createPairOBJ(pair) {
  const positions = [...pair.leftVertices, ...pair.rightVertices].map((entry) => entry.position);
  const lines = [
    '# Task 14C-1B-R0 canonical self-intersection local evidence',
    `# preset=${pair.preset} poseId=${pair.poseId} triangles=${pair.leftTriangle}/${pair.rightTriangle}`,
    `# classification=${pair.intersectionType} penetrating=${pair.penetrating} strictInteriorSegment=${pair.strictInteriorSegment}`,
    `# sharedVertexCount=${pair.sharedVertexCount} sharedEdge=${pair.sharedEdge} ringDistance=${pair.topologicalRingDistance}`,
    `# segmentLength=${pair.intersectionSegmentLength} normalAngle=${pair.localSurfaceNormalAngle}`,
    'o left_triangle',
    ...positions.slice(0, 3).map((point) => `v ${point.join(' ')}`),
    'f 1 2 3',
    'o right_triangle',
    ...positions.slice(3).map((point) => `v ${point.join(' ')}`),
    'f 4 5 6',
  ];
  if (pair.intersectionSegment) lines.push(...pair.intersectionSegment.map((point) => `v ${point.join(' ')}`), 'l 7 8');
  return `${lines.join('\n')}\n`;
}

function assertPairRecord(pair) {
  for (const key of ['preset', 'poseId', 'leftTriangle', 'rightTriangle', 'leftRegion', 'rightRegion', 'leftVertices', 'rightVertices', 'sharedVertexCount', 'sharedEdge', 'minimumVertexDistance', 'intersectionType', 'coplanar', 'contactOnly', 'penetrating', 'intersectionSegment', 'intersectionSegmentLength', 'localBounds', 'localSurfaceNormalAngle', 'topologicalRingDistance']) {
    assert.ok(Object.hasOwn(pair, key), `Intersection pair is missing ${key}.`);
  }
}
function compactScenario(scenario) { return { preset: scenario.preset, poseId: scenario.poseId, rawContactCount: scenario.rawContactCount, penetratingIntersectionCount: scenario.penetratingIntersectionCount, criticalPenetratingCount: scenario.criticalPenetratingCount, classifications: scenario.classifications }; }
function compactPair(pair) { return { pair: `${pair.leftTriangle}/${pair.rightTriangle}`, regions: `${pair.leftRegion}/${pair.rightRegion}`, intersectionType: pair.intersectionType, penetrating: pair.penetrating, segmentLength: pair.intersectionSegmentLength, normalAngle: pair.localSurfaceNormalAngle, ringDistance: pair.topologicalRingDistance }; }
function countBy(values, selector) { const result = {}; for (const value of values) { const key = selector(value); result[key] = (result[key] ?? 0) + 1; } return result; }
function aggregateCounts(values) { return values.reduce((total, value) => ({ rawContactCount: total.rawContactCount + value.rawContactCount, penetratingIntersectionCount: total.penetratingIntersectionCount + value.penetratingIntersectionCount, criticalPenetratingCount: total.criticalPenetratingCount + value.criticalPenetratingCount }), { rawContactCount: 0, penetratingIntersectionCount: 0, criticalPenetratingCount: 0 }); }
function triangleVertexIndices(indices, triangle) { return [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]]; }
function readPoint(positions, vertex) { return [positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]]; }
function triangleRegion(regionIds, regionNames, vertices) { const counts = new Map(); for (const vertex of vertices) { const name = regionNames[regionIds[vertex * 4]] ?? 'unclassified'; counts.set(name, (counts.get(name) ?? 0) + 1); } return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]; }
function isCriticalRegionPair(left, right) { return ['leftUpperArm', 'rightUpperArm', 'leftForearm', 'rightForearm', 'leftThigh', 'rightThigh', 'leftCalf', 'rightCalf', 'leftFoot', 'rightFoot', 'pelvis', 'upperTorso'].includes(left) || ['leftUpperArm', 'rightUpperArm', 'leftForearm', 'rightForearm', 'leftThigh', 'rightThigh', 'leftCalf', 'rightCalf', 'leftFoot', 'rightFoot', 'pelvis', 'upperTorso'].includes(right); }
function trianglesNearDuplicate(left, right, tolerance) { return left.every((point) => right.some((candidate) => distance(point, candidate) <= tolerance)); }
function minimumVertexDistance(left, right) { return Math.min(...left.flatMap((a) => right.map((b) => distance(a, b)))); }
function unionBounds(points) { return { minimum: [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis]))), maximum: [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis]))) }; }
function roundBounds(bounds) { return { minimum: roundVector(bounds.minimum), maximum: roundVector(bounds.maximum) }; }
function diagonal(bounds) { return Math.hypot(...bounds.maximum.map((value, axis) => value - bounds.minimum[axis])); }
function orientPolygon(points) { return polygonSignedArea(points) >= 0 ? points : [...points].reverse(); }
function polygonSignedArea(points) { return points.reduce((sum, point, index) => sum + point[0] * points[(index + 1) % points.length][1] - points[(index + 1) % points.length][0] * point[1], 0) * 0.5; }
function polygonArea(points) { return Math.abs(polygonSignedArea(points)); }
function lineIntersection2D(a, b, c, d) { const r = subtract2(b, a); const s = subtract2(d, c); const denominator = cross2(r, s); if (Math.abs(denominator) <= EPSILON) return midpoint2(a, b); const t = cross2(subtract2(c, a), s) / denominator; return [a[0] + r[0] * t, a[1] + r[1] * t]; }
function dominantAxis(normal) { const values = normal.map(Math.abs); return values.indexOf(Math.max(...values)); }
function project2(point, dropAxis) { return point.filter((_, axis) => axis !== dropAxis); }
function orientation2D(a, b, c) { return cross2(subtract2(b, a), subtract2(c, a)); }
function subtract2(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function cross2(a, b) { return a[0] * b[1] - a[1] * b[0]; }
function midpoint2(a, b) { return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5]; }
function midpoint(a, b) { return a.map((value, axis) => (value + b[axis]) * 0.5); }
function subtract(a, b) { return a.map((value, axis) => value - b[axis]); }
function dot(a, b) { return a.reduce((sum, value, axis) => sum + value * b[axis], 0); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function unit(value) { const length = Math.hypot(...value); return length > EPSILON ? value.map((entry) => entry / length) : [0, 0, 0]; }
function distance(a, b) { return Math.hypot(...subtract(a, b)); }
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
function round(value) { return Number.isFinite(value) ? Number(value.toFixed(10)) : null; }
function roundVector(value) { return value.map(round); }
