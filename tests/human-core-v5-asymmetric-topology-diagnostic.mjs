import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  BodyFieldCompilerV5,
  HumanCoreRuntime,
  PROCEDURAL_BODY_DNA_PRESETS_V5,
  V4Adapter,
  analyzeSurfaceGeometryV5,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
  createProceduralSimulationRigFrameV5,
  extractStableProceduralSurfaceV5,
} from '../src/modules/human-core-v5/index.js';

const OUTPUT_URL = new URL('../artifacts/qa/task14c-geometry-v1/asymmetric-topology-diagnostic.json', import.meta.url);
const FORMAL_RESOLUTION = 40;
const HIGH_RESOLUTION = 56;
const MODES = ['legacy-mirrored-x', 'uniform-conforming'];

const bodyDNA = createPresetDNA('Asymmetric', PROCEDURAL_BODY_DNA_PRESETS_V5.Asymmetric);
const human = new HumanCoreRuntime();
human.createHuman(bodyDNA);
const rigCore = human.getRigCore();
const field = new BodyFieldCompilerV5().compile({ bodyDNA, rigCore });
const provenanceOnly = process.argv.includes('--provenance-only');
const matrix = provenanceOnly
  ? JSON.parse(await readFile(OUTPUT_URL, 'utf8')).matrix
  : [];

if (!provenanceOnly) {
  for (const resolution of [FORMAL_RESOLUTION, HIGH_RESOLUTION]) {
    for (const mode of MODES) {
      const surface = extractStableProceduralSurfaceV5(field, {
        resolution,
        tetrahedralization: mode,
        topologyDiagnostics: true,
      });
      matrix.push(analyzeExtraction({ surface, field, requestedResolution: resolution, mode }));
    }
  }
}

const asymmetryProvenance = createAsymmetryProvenance({ bodyDNA, rigCore, field });
const report = {
  schema: 'humanoid_rig/asymmetric_topology_diagnostic@5.0',
  bodyDNAId: bodyDNA.bodyDNAId,
  proportionRevision: bodyDNA.proportionRevision,
  internalFieldSign: 'negative',
  formalResolution: FORMAL_RESOLUTION,
  highResolution: HIGH_RESOLUTION,
  productionModeBeforeDiagnosis: 'legacy-mirrored-x',
  matrix,
  asymmetryProvenance,
};

await mkdir(new URL('.', OUTPUT_URL), { recursive: true });
await writeFile(OUTPUT_URL, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summarize(report)));
console.log(`Asymmetric topology diagnostic written to ${OUTPUT_URL.pathname}${provenanceOnly ? ' (provenance only)' : ''}`);

function analyzeExtraction({ surface, field, requestedResolution, mode }) {
  const geometry = analyzeSurfaceGeometryV5(surface.positions, surface.indices);
  const components = analyzeComponents({ surface, field });
  const boundaryEdges = analyzeBoundaryEdges({ surface, field });
  const detached = components[1] ?? null;
  const implicitFieldPath = detached
    ? sampleImplicitFieldPath(field, detached.closestPointOnLargestComponent, detached.closestPointOnDetachedComponent, 65)
    : null;
  return {
    requestedResolution,
    resolvedResolution: surface.metadata.resolution,
    tetrahedralization: mode,
    connectedComponentCount: geometry.connectedComponentCount,
    boundaryEdgeCount: geometry.boundaryEdgeCount,
    nonManifoldEdgeCount: geometry.nonManifoldEdgeCount,
    nonFiniteVertexCount: geometry.nonFiniteVertexCount,
    outOfRangeIndexCount: geometry.outOfRangeIndexCount,
    degenerateTriangleRatio: geometry.degenerateTriangleRatio,
    topologyFingerprint: surface.metadata.topologyFingerprint,
    topologyProvenance: surface.metadata.generationDiagnostics.topologyProvenance,
    components,
    boundaryEdges,
    implicitFieldPath,
  };
}

function analyzeComponents({ surface, field }) {
  const positions = surface.positions;
  const indices = surface.indices;
  const vertexCount = positions.length / 3;
  const parent = new Int32Array(vertexCount);
  const used = new Uint8Array(vertexCount);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) parent[vertex] = vertex;
  for (let offset = 0; offset < indices.length; offset += 3) {
    const a = indices[offset]; const b = indices[offset + 1]; const c = indices[offset + 2];
    used[a] = 1; used[b] = 1; used[c] = 1;
    union(parent, a, b); union(parent, b, c);
  }
  const records = new Map();
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    if (!used[vertex]) continue;
    const root = find(parent, vertex);
    const record = records.get(root) ?? { vertices: [], triangles: [] };
    record.vertices.push(vertex);
    records.set(root, record);
  }
  for (let triangle = 0; triangle < indices.length / 3; triangle += 1) {
    records.get(find(parent, indices[triangle * 3])).triangles.push(triangle);
  }
  const sorted = [...records.values()].sort((left, right) => right.vertices.length - left.vertices.length);
  const largest = sorted[0];
  const largestTree = buildKDTree(largest.vertices.map((vertex) => ({ vertex, point: readVec3(positions, vertex) })));
  return sorted.map((record, componentId) => {
    const bounds = boundsForVertices(positions, record.vertices);
    const regionHistogram = histogramRegions(surface, record.vertices);
    const nearest = componentId === 0
      ? { distance: 0, largest: readVec3(positions, record.vertices[0]), detached: readVec3(positions, record.vertices[0]) }
      : nearestBetweenComponentAndTree(positions, record.vertices, largestTree);
    return {
      componentId,
      vertexCount: record.vertices.length,
      triangleCount: record.triangles.length,
      boundaryEdgeCount: countComponentBoundaryEdges(indices, record.triangles),
      surfaceArea: record.triangles.reduce((sum, triangle) => sum + triangleArea(positions, indices, triangle), 0),
      bounds,
      centroid: centroidForVertices(positions, record.vertices),
      dominantRegionNames: Object.entries(regionHistogram).sort((left, right) => right[1] - left[1]).slice(0, 6).map(([name]) => name),
      regionHistogram,
      touchesFieldBounds: classifyFieldBoundsTouch(bounds, field.definition.bounds, surface.metadata.resolution),
      minimumDistanceToLargestComponent: nearest.distance,
      closestPointOnLargestComponent: nearest.largest,
      closestPointOnDetachedComponent: nearest.detached,
    };
  });
}

function analyzeBoundaryEdges({ surface, field }) {
  const occurrences = new Map();
  for (let offset = 0; offset < surface.indices.length; offset += 3) {
    const tri = [surface.indices[offset], surface.indices[offset + 1], surface.indices[offset + 2]];
    for (const [left, right] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
      const key = left < right ? `${left}:${right}` : `${right}:${left}`;
      const edges = occurrences.get(key) ?? [];
      edges.push([left, right]);
      occurrences.set(key, edges);
    }
  }
  const boundary = [...occurrences.entries()].filter(([, entries]) => entries.length === 1).map(([key]) => key.split(':').map(Number));
  const points = boundary.flatMap(([left, right]) => [readVec3(surface.positions, left), readVec3(surface.positions, right)]);
  const voxel = field.definition.bounds.max.map((value, axis) => (
    value - field.definition.bounds.min[axis]
  ) / (surface.metadata.resolution[axis] - 1));
  const classifications = {
    centralXPlane: 0,
    fieldBounds: 0,
    wristPalm: 0,
    ankleFoot: 0,
    shoulderUpperArm: 0,
    hipThigh: 0,
    unclassified: 0,
  };
  const edges = boundary.map(([left, right]) => {
    const edgePoints = [readVec3(surface.positions, left), readVec3(surface.positions, right)];
    const regions = [...new Set([primaryRegion(surface, left), primaryRegion(surface, right)])];
    const categories = [];
    if (edgePoints.every((point) => Math.abs(point[0]) <= voxel[0] * 0.75)) categories.push('centralXPlane');
    if (edgePoints.some((point) => point.some((value, axis) => (
      Math.abs(value - field.definition.bounds.min[axis]) <= voxel[axis] * 0.75
      || Math.abs(value - field.definition.bounds.max[axis]) <= voxel[axis] * 0.75
    )))) categories.push('fieldBounds');
    const joined = regions.join('|');
    if (/Forearm|Palm/.test(joined)) categories.push('wristPalm');
    if (/Calf|Foot/.test(joined)) categories.push('ankleFoot');
    if (/UpperArm|upperTorso/.test(joined)) categories.push('shoulderUpperArm');
    if (/Thigh|pelvis/.test(joined)) categories.push('hipThigh');
    if (!categories.length) categories.push('unclassified');
    for (const category of categories) classifications[category] += 1;
    return { vertices: [left, right], points: edgePoints, regions, categories };
  });
  return {
    count: boundary.length,
    coordinateRange: points.length ? boundsForPoints(points) : null,
    classifications,
    edges,
  };
}

function createAsymmetryProvenance({ bodyDNA, rigCore, field }) {
  const referenceDNA = createPresetDNA('Reference', PROCEDURAL_BODY_DNA_PRESETS_V5.Reference);
  const referenceHuman = new HumanCoreRuntime();
  referenceHuman.createHuman(referenceDNA);
  const referenceRigCore = referenceHuman.getRigCore();
  const referenceRig = V4Adapter.humanRigCoreToExistingRig(referenceRigCore, { bodyDNA: referenceDNA, pose: 'T' });
  const referenceField = new BodyFieldCompilerV5().compile({ bodyDNA: referenceDNA, rigCore: referenceRigCore });
  const adapted = V4Adapter.humanRigCoreToExistingRig(rigCore, { bodyDNA, pose: 'T' });
  const pose = createProceduralDeformValidationPoseV5({ poseId: 't-pose', rigCore, bodyDNA, timestamp: 1 });
  const simulation = createProceduralSimulationRigFrameV5({ finalPose: pose, rigCore, bodyDNA });
  const rigPositions = selectRigPositions(adapted.definition);
  const referenceRigPositions = selectRigPositions(referenceRig.definition);
  const fieldRegions = selectFieldRegions(field.definition.regions);
  const referenceFieldRegions = selectFieldRegions(referenceField.definition.regions);
  const scales = bodyDNA.asymmetry.leftRightScale;
  return {
    requestedLeftRightScale: scales,
    v4AdapterRigDefinition: rigPositions,
    bodyFieldCanonicalLayout: structuredClone(field.definition.canonicalLayout.rigLandmarks),
    bodyFieldRegions: fieldRegions,
    simulationRigFK: selectSimulationPositions(simulation),
    scaleApplications: [
      scaleRecord('shoulder', scales.shoulder,
        bilateral(lateral(rigPositions.left.shoulder), lateral(rigPositions.right.shoulder)),
        bilateral(lateral(referenceRigPositions.left.shoulder), lateral(referenceRigPositions.right.shoulder)),
        bilateral(lateral(fieldRegions.left.upperArm.start), lateral(fieldRegions.right.upperArm.start)),
        bilateral(lateral(referenceFieldRegions.left.upperArm.start), lateral(referenceFieldRegions.right.upperArm.start))),
      scaleRecord('upperArm', scales.arm,
        bilateral(segment(rigPositions.left.shoulder, rigPositions.left.elbow), segment(rigPositions.right.shoulder, rigPositions.right.elbow)),
        bilateral(segment(referenceRigPositions.left.shoulder, referenceRigPositions.left.elbow), segment(referenceRigPositions.right.shoulder, referenceRigPositions.right.elbow)),
        bilateral(segment(fieldRegions.left.upperArm.start, fieldRegions.left.upperArm.end), segment(fieldRegions.right.upperArm.start, fieldRegions.right.upperArm.end)),
        bilateral(segment(referenceFieldRegions.left.upperArm.start, referenceFieldRegions.left.upperArm.end), segment(referenceFieldRegions.right.upperArm.start, referenceFieldRegions.right.upperArm.end))),
      scaleRecord('forearm', scales.arm,
        bilateral(segment(rigPositions.left.elbow, rigPositions.left.wrist), segment(rigPositions.right.elbow, rigPositions.right.wrist)),
        bilateral(segment(referenceRigPositions.left.elbow, referenceRigPositions.left.wrist), segment(referenceRigPositions.right.elbow, referenceRigPositions.right.wrist)),
        bilateral(segment(fieldRegions.left.forearm.start, fieldRegions.left.forearm.end), segment(fieldRegions.right.forearm.start, fieldRegions.right.forearm.end)),
        bilateral(segment(referenceFieldRegions.left.forearm.start, referenceFieldRegions.left.forearm.end), segment(referenceFieldRegions.right.forearm.start, referenceFieldRegions.right.forearm.end))),
      scaleRecord('palm', scales.hand,
        bilateral(segment(rigPositions.left.wrist, rigPositions.left.handEnd), segment(rigPositions.right.wrist, rigPositions.right.handEnd)),
        bilateral(segment(referenceRigPositions.left.wrist, referenceRigPositions.left.handEnd), segment(referenceRigPositions.right.wrist, referenceRigPositions.right.handEnd)),
        bilateral(segment(fieldRegions.left.forearm.end, fieldRegions.left.palm.center), segment(fieldRegions.right.forearm.end, fieldRegions.right.palm.center)),
        bilateral(segment(referenceFieldRegions.left.forearm.end, referenceFieldRegions.left.palm.center), segment(referenceFieldRegions.right.forearm.end, referenceFieldRegions.right.palm.center))),
      scaleRecord('hip', scales.hip,
        bilateral(lateral(rigPositions.left.hip), lateral(rigPositions.right.hip)),
        bilateral(lateral(referenceRigPositions.left.hip), lateral(referenceRigPositions.right.hip)),
        bilateral(lateral(fieldRegions.left.thigh.start), lateral(fieldRegions.right.thigh.start)),
        bilateral(lateral(referenceFieldRegions.left.thigh.start), lateral(referenceFieldRegions.right.thigh.start))),
      scaleRecord('thigh', scales.leg,
        bilateral(segment(rigPositions.left.hip, rigPositions.left.knee), segment(rigPositions.right.hip, rigPositions.right.knee)),
        bilateral(segment(referenceRigPositions.left.hip, referenceRigPositions.left.knee), segment(referenceRigPositions.right.hip, referenceRigPositions.right.knee)),
        bilateral(segment(fieldRegions.left.thigh.start, fieldRegions.left.thigh.end), segment(fieldRegions.right.thigh.start, fieldRegions.right.thigh.end)),
        bilateral(segment(referenceFieldRegions.left.thigh.start, referenceFieldRegions.left.thigh.end), segment(referenceFieldRegions.right.thigh.start, referenceFieldRegions.right.thigh.end))),
      scaleRecord('calf', scales.leg,
        bilateral(segment(rigPositions.left.knee, rigPositions.left.ankle), segment(rigPositions.right.knee, rigPositions.right.ankle)),
        bilateral(segment(referenceRigPositions.left.knee, referenceRigPositions.left.ankle), segment(referenceRigPositions.right.knee, referenceRigPositions.right.ankle)),
        bilateral(segment(fieldRegions.left.calf.start, fieldRegions.left.calf.end), segment(fieldRegions.right.calf.start, fieldRegions.right.calf.end)),
        bilateral(segment(referenceFieldRegions.left.calf.start, referenceFieldRegions.left.calf.end), segment(referenceFieldRegions.right.calf.start, referenceFieldRegions.right.calf.end))),
      scaleRecord('foot', scales.foot,
        bilateral(segment(rigPositions.left.ankle, rigPositions.left.foot), segment(rigPositions.right.ankle, rigPositions.right.foot)),
        bilateral(segment(referenceRigPositions.left.ankle, referenceRigPositions.left.foot), segment(referenceRigPositions.right.ankle, referenceRigPositions.right.foot)),
        bilateral(segment(fieldRegions.left.calf.end, fieldRegions.left.foot.center), segment(fieldRegions.right.calf.end, fieldRegions.right.foot.center)),
        bilateral(segment(referenceFieldRegions.left.calf.end, referenceFieldRegions.left.foot.center), segment(referenceFieldRegions.right.calf.end, referenceFieldRegions.right.foot.center))),
    ],
    authoredAsymmetryApplicationCount: {
      v4AdapterRigDefinition: 0,
      bodyFieldRegionPlacement: 1,
      simulationRigFK: 0,
    },
    singleAuthorityPathSatisfied: false,
  };
}

function scaleRecord(name, requestedLeft, activeRig, referenceRig, field, referenceField) {
  const requestedRight = 2 - requestedLeft;
  return {
    structure: name,
    requestedScale: { left: requestedLeft, right: requestedRight },
    rigAppliedScale: { left: ratio(activeRig.left, referenceRig.left), right: ratio(activeRig.right, referenceRig.right) },
    fieldAppliedScale: { left: ratio(field.left, activeRig.left), right: ratio(field.right, activeRig.right) },
    effectiveScale: { left: ratio(field.left, referenceField.left), right: ratio(field.right, referenceField.right) },
    lengths: { activeRig, referenceRig, field, referenceField },
  };
}

function selectRigPositions(definition) {
  const byId = new Map(definition.joints.map((joint) => [joint.id, joint.poseWorldPosition]));
  return Object.fromEntries(['left', 'right'].map((side) => [side, {
    shoulder: byId.get(`${side}UpperArm`),
    elbow: byId.get(`${side}LowerArm`),
    wrist: byId.get(`${side}Hand`),
    handEnd: byId.get(`${side}HandEnd`) ?? byId.get(`${side}Hand`),
    hip: byId.get(`${side}UpperLeg`),
    knee: byId.get(`${side}LowerLeg`),
    ankle: byId.get(`${side}Foot`),
    foot: byId.get(`${side}Toes`) ?? byId.get(`${side}Foot`),
  }]));
}

function selectFieldRegions(regions) {
  const byId = new Map(regions.map((region) => [region.regionId, region.primitive]));
  return Object.fromEntries(['left', 'right'].map((side) => [side, {
    upperArm: structuredClone(byId.get(`${side}UpperArm`)),
    forearm: structuredClone(byId.get(`${side}Forearm`)),
    palm: structuredClone(byId.get(`${side}Palm`)),
    thigh: structuredClone(byId.get(`${side}Thigh`)),
    calf: structuredClone(byId.get(`${side}Calf`)),
    foot: structuredClone(byId.get(`${side}Foot`)),
  }]));
}

function selectSimulationPositions(frame) {
  return Object.fromEntries(['left', 'right'].map((side) => [side, {
    shoulder: frame.joints[`${side}UpperArm`].worldPosition,
    elbow: frame.joints[`${side}LowerArm`].worldPosition,
    wrist: frame.joints[`${side}Hand`].worldPosition,
    hip: frame.joints[`${side}UpperLeg`].worldPosition,
    knee: frame.joints[`${side}LowerLeg`].worldPosition,
    ankle: frame.joints[`${side}Foot`].worldPosition,
    foot: frame.joints[`${side}Toes`]?.worldPosition ?? frame.joints[`${side}Foot`].worldPosition,
  }]));
}

function sampleImplicitFieldPath(field, start, end, count) {
  const samples = Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    const point = start.map((value, axis) => value + (end[axis] - value) * t);
    return { index, t, point, value: field.sample(point) };
  });
  const interior = samples.slice(1, -1);
  const maximumInteriorValue = Math.max(...interior.map((sample) => sample.value));
  return {
    sampleCount: samples.length,
    maximumInteriorValue,
    minimumInteriorValue: Math.min(...interior.map((sample) => sample.value)),
    continuousNegativeChannel: maximumInteriorValue <= 0,
    samples,
  };
}

function countComponentBoundaryEdges(indices, triangles) {
  const edges = new Map();
  for (const triangle of triangles) {
    const tri = [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]];
    for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  return [...edges.values()].filter((count) => count === 1).length;
}

function histogramRegions(surface, vertices) {
  const counts = new Map();
  for (const vertex of vertices) {
    const name = primaryRegion(surface, vertex);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function primaryRegion(surface, vertex) {
  return surface.regionNames[surface.regionIds[vertex * 4]] ?? 'unclassified';
}

function classifyFieldBoundsTouch(bounds, fieldBounds, resolution) {
  const voxel = fieldBounds.max.map((value, axis) => (value - fieldBounds.min[axis]) / (resolution[axis] - 1));
  const faces = [];
  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(bounds.min[axis] - fieldBounds.min[axis]) <= voxel[axis] * 0.75) faces.push(`min-${'xyz'[axis]}`);
    if (Math.abs(bounds.max[axis] - fieldBounds.max[axis]) <= voxel[axis] * 0.75) faces.push(`max-${'xyz'[axis]}`);
  }
  return { touches: faces.length > 0, faces, voxelSize: voxel };
}

function nearestBetweenComponentAndTree(positions, vertices, tree) {
  let best = { distanceSquared: Number.POSITIVE_INFINITY, largest: null, detached: null };
  for (const vertex of vertices) {
    const detached = readVec3(positions, vertex);
    const nearest = nearestKD(tree, detached, { distanceSquared: Number.POSITIVE_INFINITY, entry: null });
    if (nearest.distanceSquared < best.distanceSquared) best = {
      distanceSquared: nearest.distanceSquared,
      largest: nearest.entry.point,
      detached,
    };
  }
  return { distance: Math.sqrt(best.distanceSquared), largest: best.largest, detached: best.detached };
}

function buildKDTree(entries, depth = 0) {
  if (!entries.length) return null;
  const axis = depth % 3;
  entries.sort((left, right) => left.point[axis] - right.point[axis] || left.vertex - right.vertex);
  const middle = Math.floor(entries.length / 2);
  return {
    axis,
    entry: entries[middle],
    left: buildKDTree(entries.slice(0, middle), depth + 1),
    right: buildKDTree(entries.slice(middle + 1), depth + 1),
  };
}

function nearestKD(node, point, best) {
  if (!node) return best;
  const distanceSquared = squaredDistance(point, node.entry.point);
  let result = distanceSquared < best.distanceSquared ? { distanceSquared, entry: node.entry } : best;
  const delta = point[node.axis] - node.entry.point[node.axis];
  const first = delta < 0 ? node.left : node.right;
  const second = delta < 0 ? node.right : node.left;
  result = nearestKD(first, point, result);
  if (delta * delta < result.distanceSquared) result = nearestKD(second, point, result);
  return result;
}

function union(parent, left, right) {
  const a = find(parent, left); const b = find(parent, right);
  if (a !== b) parent[b] = a;
}
function find(parent, value) {
  let root = value;
  while (parent[root] !== root) root = parent[root];
  while (parent[value] !== value) { const next = parent[value]; parent[value] = root; value = next; }
  return root;
}

function boundsForVertices(positions, vertices) {
  return boundsForPoints(vertices.map((vertex) => readVec3(positions, vertex)));
}
function boundsForPoints(points) {
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (const point of points) for (let axis = 0; axis < 3; axis += 1) {
    min[axis] = Math.min(min[axis], point[axis]); max[axis] = Math.max(max[axis], point[axis]);
  }
  return { min, max, size: max.map((value, axis) => value - min[axis]) };
}
function centroidForVertices(positions, vertices) {
  const centroid = [0, 0, 0];
  for (const vertex of vertices) for (let axis = 0; axis < 3; axis += 1) centroid[axis] += positions[vertex * 3 + axis] / vertices.length;
  return centroid;
}
function triangleArea(positions, indices, triangle) {
  const a = readVec3(positions, indices[triangle * 3]);
  const b = readVec3(positions, indices[triangle * 3 + 1]);
  const c = readVec3(positions, indices[triangle * 3 + 2]);
  const ab = b.map((value, axis) => value - a[axis]); const ac = c.map((value, axis) => value - a[axis]);
  return Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]) * 0.5;
}
function createPresetDNA(name, input) {
  return createBodyDNA({ bodyDNAId: `asymmetric-topology-${name.toLowerCase()}`, identity: { humanId: `asymmetric-topology-${name.toLowerCase()}` }, proportionRevision: 14, ...structuredClone(input) });
}
function summarize(report) {
  return {
    matrix: report.matrix.map((entry) => ({
      resolution: entry.requestedResolution,
      mode: entry.tetrahedralization,
      components: entry.connectedComponentCount,
      boundaryEdges: entry.boundaryEdgeCount,
      nonManifoldEdges: entry.nonManifoldEdgeCount,
      degenerateTriangleRatio: entry.degenerateTriangleRatio,
      detachedRegion: entry.components[1]?.dominantRegionNames?.[0] ?? null,
      implicitChannelContinuous: entry.implicitFieldPath?.continuousNegativeChannel ?? null,
    })),
    asymmetryApplicationCount: report.asymmetryProvenance.authoredAsymmetryApplicationCount,
  };
}
function readVec3(array, vertex) { return [array[vertex * 3], array[vertex * 3 + 1], array[vertex * 3 + 2]]; }
function segment(a, b) { return Math.hypot(...a.map((value, axis) => value - b[axis])); }
function lateral(point) { return Math.abs(point[0]); }
function bilateral(left, right) { return { left, right }; }
function ratio(value, reference) { return value / Math.max(1e-12, reference); }
function squaredDistance(a, b) { return a.reduce((sum, value, axis) => sum + (value - b[axis]) ** 2, 0); }

assert.equal(matrix.length, 4);
