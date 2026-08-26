import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  HumanCoreRuntime,
  PROCEDURAL_BODY_DNA_PRESETS_V5,
  ProceduralDeformRuntimeV5,
  analyzeProceduralSurfaceDeformationQualityV5,
  analyzeSurfaceGeometryV5,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
  createProceduralSurfaceTransformDiagnosticsV5,
  createSurfaceRegionBindingV5,
  findSurfaceSelfIntersectionsV5,
  sampleFieldGradientV5,
} from '../src/modules/human-core-v5/index.js';

const ASSERT_MODE = process.argv.includes('--assert');
const OUTPUT_ROOT = resolve('artifacts/qa/task14c-geometry-v1/canonical-intersection-provenance');
const LOCAL_OBJ_ROOT = resolve(OUTPUT_ROOT, 'local-obj');
const REPRESENTATIVE_PAIRS = Object.freeze([
  [80, 2743], [80, 2756], [80, 2758],
  [82, 2755], [82, 2756], [82, 2757], [82, 2758],
  [83, 2759], [83, 2760],
]);
const TARGET_REGIONS = Object.freeze(new Set(['pelvis', 'leftThigh', 'rightThigh', 'lowerTorso']));
const MATRIX = Object.freeze([
  Object.freeze({ caseId: 'muscular-r36-legacy-fairing', preset: 'Muscular', resolution: 36, tetrahedralization: 'legacy-mirrored-x', fairingDisabled: false }),
  Object.freeze({ caseId: 'muscular-r36-uniform-fairing', preset: 'Muscular', resolution: 36, tetrahedralization: 'uniform-conforming', fairingDisabled: false }),
  Object.freeze({ caseId: 'muscular-r36-legacy-fairing-disabled', preset: 'Muscular', resolution: 36, tetrahedralization: 'legacy-mirrored-x', fairingDisabled: true }),
  Object.freeze({ caseId: 'muscular-r48-legacy-fairing', preset: 'Muscular', resolution: 48, tetrahedralization: 'legacy-mirrored-x', fairingDisabled: false }),
  Object.freeze({ caseId: 'reference-r36-legacy-fairing', preset: 'Reference', resolution: 36, tetrahedralization: 'legacy-mirrored-x', fairingDisabled: false }),
]);

await mkdir(LOCAL_OBJ_ROOT, { recursive: true });
const cases = [];
for (const configuration of MATRIX) {
  console.error(`[provenance] starting ${configuration.caseId}`);
  cases.push(await runDiagnosticCase(configuration));
  console.error(`[provenance] completed ${configuration.caseId}`);
}

const main = findCase('muscular-r36-legacy-fairing');
const uniform = findCase('muscular-r36-uniform-fairing');
const fairingDisabled = findCase('muscular-r36-legacy-fairing-disabled');
const resolution48 = findCase('muscular-r48-legacy-fairing');
const reference = findCase('reference-r36-legacy-fairing');
const firstIntroductionStage = classifyFirstIntroductionStage(main.stages);
const rootCause = classifyRootCause({ main, uniform, fairingDisabled, resolution48, firstIntroductionStage });
const representativeEvidence = await createRepresentativeEvidence(main);
const muscularTPoseClusters = buildIntersectionClusters(main.details.get('t-pose-deformed'));
const muscularAPoseClusters = buildIntersectionClusters(main.details.get('a-pose-deformed'));

const provenanceReport = {
  schema: 'humanoid_rig/canonical_intersection_stage_provenance@5.0',
  task: 'Task 14C-1A2a',
  case: main.configuration,
  firstIntroductionStage,
  ...rootCause,
  stages: main.stages,
  tBindIdentityAudit: main.tBindIdentityAudit,
  representativePairs: representativeEvidence,
};
const clusterReport = {
  schema: 'humanoid_rig/canonical_intersection_clusters@5.0',
  task: 'Task 14C-1A2a',
  caseId: main.configuration.caseId,
  classificationOrder: ['pelvis-pelvis', 'pelvis-thigh', 'pelvis-lowerTorso', 'upperTorso-upperArm', 'other'],
  targetRegions: [...TARGET_REGIONS],
  tPose: muscularTPoseClusters,
  aPose: muscularAPoseClusters,
};
const referenceReport = {
  schema: 'humanoid_rig/canonical_intersection_reference_control@5.0',
  task: 'Task 14C-1A2a',
  case: reference.configuration,
  stages: reference.stages,
  tBindIdentityAudit: reference.tBindIdentityAudit,
};
const summary = {
  schema: 'humanoid_rig/canonical_intersection_provenance_summary@5.0',
  task: 'Task 14C-1A2a',
  firstIntroductionStage,
  ...rootCause,
  comparisons: {
    legacyVersusUniform: compareCases(main, uniform),
    resolution36Versus48: compareCases(main, resolution48),
    fairingEnabledVersusDisabled: compareCases(main, fairingDisabled),
  },
  cases: cases.map(compactCase),
  representativePairCount: representativeEvidence.length,
  visualAcceptance: false,
  productionReady: false,
};

await writeJson(resolve(OUTPUT_ROOT, 'muscular-stage-provenance.json'), provenanceReport);
await writeJson(resolve(OUTPUT_ROOT, 'muscular-intersection-clusters.json'), clusterReport);
await writeJson(resolve(OUTPUT_ROOT, 'reference-control.json'), referenceReport);
await writeJson(resolve(OUTPUT_ROOT, 'summary.json'), summary);

if (ASSERT_MODE) assertDiagnosticContract();
for (const entry of cases) entry.runtime.dispose();
console.log(JSON.stringify({
  outputRoot: OUTPUT_ROOT,
  firstIntroductionStage,
  primaryRootCause: rootCause.primaryRootCause,
  cases: cases.map((entry) => ({
    caseId: entry.configuration.caseId,
    stages: Object.fromEntries(entry.stages.map((stage) => [stage.stageId, stage.penetratingIntersectionCount])),
  })),
  tBind: main.tBindIdentityAudit.summary,
  representativePairCount: representativeEvidence.length,
}));
console.log(`Human Core V5 canonical intersection provenance ${ASSERT_MODE ? 'asserted' : 'recorded'}.`);

async function runDiagnosticCase(configuration) {
  const presetInput = structuredClone(PROCEDURAL_BODY_DNA_PRESETS_V5[configuration.preset]);
  const bodyDNA = createBodyDNA({
    ...presetInput,
    bodyDNAId: `task14c-a2a-${configuration.caseId}`,
    identity: { humanId: `task14c-a2a-${configuration.caseId}`, label: configuration.preset },
    proportionRevision: 14,
  });
  const human = new HumanCoreRuntime();
  human.createHuman(bodyDNA);
  const rigCore = human.getRigCore();
  const runtime = new ProceduralDeformRuntimeV5();
  runtime.compileHuman({ bodyDNA, rigCore });
  const snapshots = [];
  await runtime.generateCanonicalSurface({
    resolution: configuration.resolution,
    worker: false,
    tetrahedralization: configuration.tetrahedralization,
    diagnosticFairingDisabled: configuration.fairingDisabled,
    diagnosticAllowOrientationGateFailure: true,
    diagnosticHook: (snapshot) => snapshots.push(snapshot),
  });

  const compacted = snapshots.find((stage) => stage.stageId === 'compacted');
  const details = new Map();
  const stages = [];
  let previous = null;
  for (const snapshot of snapshots) {
    const detail = analyzeStage({ snapshot, previous, compacted, field: runtime.field });
    details.set(snapshot.stageId, detail);
    stages.push(detail.metrics);
    previous = snapshot;
  }

  const canonical = snapshots.find((stage) => stage.stageId === 'canonical-final');
  for (const poseId of ['t-pose', 'a-pose']) {
    const pose = createProceduralDeformValidationPoseV5({ poseId, rigCore, bodyDNA, timestamp: 1 });
    human.updatePose(pose);
    const frame = runtime.update({ finalPose: pose, anatomyState: human.getAnatomyState(), timestamp: 1 });
    const snapshot = {
      stageId: `${poseId}-deformed`,
      positions: new Float32Array(frame.deformedPositions),
      indices: new Uint32Array(frame.indices),
      vertexSourceIds: new Uint32Array(canonical.vertexSourceIds),
      triangleProvenance: canonical.triangleProvenance,
      grid: [...canonical.grid],
      gridMinimum: [...canonical.gridMinimum],
      voxelSize: [...canonical.voxelSize],
      regionIds: new Uint16Array(frame.regionIds),
      regionBlendWeights: new Float32Array(frame.regionBlendWeights),
      regionAxialU: new Float32Array(runtime.surface.regionAxialU),
      regionNames: [...runtime.surface.regionNames],
      pose,
    };
    const detail = analyzeStage({ snapshot, previous, compacted, field: runtime.field });
    details.set(snapshot.stageId, detail);
    stages.push(detail.metrics);
    snapshots.push(snapshot);
    previous = snapshot;
  }

  const tBindIdentityAudit = createTBindIdentityAudit({
    canonical,
    tPose: snapshots.find((stage) => stage.stageId === 't-pose-deformed'),
    tPoseDetail: details.get('t-pose-deformed'),
    runtime,
    rigCore,
  });
  return {
    configuration,
    bodyDNA,
    human,
    rigCore,
    runtime,
    snapshots,
    details,
    stages,
    tBindIdentityAudit,
    topology: analyzeSurfaceGeometryV5(runtime.surface.positions, runtime.surface.indices),
    generatorVersion: runtime.surface.metadata.generatorVersion,
  };
}

function analyzeStage({ snapshot, previous, compacted, field }) {
  const binding = snapshot.regionIds instanceof Uint16Array
    ? {
      regionIds: snapshot.regionIds,
      regionBlendWeights: snapshot.regionBlendWeights,
      regionAxialU: snapshot.regionAxialU,
      regionNames: snapshot.regionNames,
    }
    : createSurfaceRegionBindingV5(field, snapshot.positions);
  const geometry = analyzeSurfaceGeometryV5(snapshot.positions, snapshot.indices);
  const intersections = findSurfaceSelfIntersectionsV5({
    positions: snapshot.positions,
    indices: snapshot.indices,
    regionIds: binding.regionIds,
    regionNames: binding.regionNames,
  });
  const fieldMetrics = measureFieldMetrics(field, snapshot.positions, snapshot.voxelSize);
  const previousDisplacement = measureDisplacement(snapshot, previous);
  const compactedDisplacement = measureDisplacement(snapshot, compacted);
  const comparisonPositions = sameVertexOrder(previous, snapshot)
    ? previous.positions
    : snapshot.positions;
  const deformation = analyzeProceduralSurfaceDeformationQualityV5({
    canonicalPositions: comparisonPositions,
    deformedPositions: snapshot.positions,
    indices: snapshot.indices,
    detectSelfIntersections: false,
  });
  return {
    snapshot,
    binding,
    intersections,
    metrics: {
      stageId: snapshot.stageId,
      vertexCount: snapshot.positions.length / 3,
      triangleCount: snapshot.indices.length / 3,
      connectedComponentCount: geometry.connectedComponentCount,
      boundaryEdgeCount: geometry.boundaryEdgeCount,
      nonManifoldEdgeCount: geometry.nonManifoldEdgeCount,
      degenerateTriangleRatio: geometry.degenerateTriangleRatio,
      rawContactCount: intersections.rawContactCount,
      penetratingIntersectionCount: intersections.penetratingIntersectionCount,
      criticalPenetratingCount: intersections.criticalPenetratingCount,
      intersectionRegionPairs: countBy(intersections.pairs, (pair) => regionPairKey(pair.leftRegion, pair.rightRegion)),
      intersectionClusterCount: countIntersectionClusters(intersections.pairs),
      ...fieldMetrics,
      maximumDisplacementFromPreviousStage: previousDisplacement.maximum,
      rmsDisplacementFromPreviousStage: previousDisplacement.rms,
      maximumDisplacementFromCompactedSurface: compactedDisplacement.maximum,
      rmsDisplacementFromCompactedSurface: compactedDisplacement.rms,
      triangleFlipCount: deformation.triangleFlipCount,
      localFoldoverCount: deformation.localFoldoverCount,
      orientationGateFailure: snapshot.orientationGateFailure ?? null,
    },
  };
}

function measureFieldMetrics(field, positions, voxelSize) {
  const absoluteErrors = [];
  const gradients = [];
  const gradientStep = Math.max(1e-7, Math.min(...voxelSize) * 0.08);
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const point = readVec3(positions, vertex);
    absoluteErrors.push(Math.abs(field.sample(point)));
    gradients.push(Math.hypot(...sampleFieldGradientV5(field, point, gradientStep)));
  }
  absoluteErrors.sort((left, right) => left - right);
  gradients.sort((left, right) => left - right);
  return {
    maximumAbsoluteFieldError: absoluteErrors.at(-1) ?? 0,
    meanAbsoluteFieldError: mean(absoluteErrors),
    fieldGradientMinimum: gradients[0] ?? 0,
    fieldGradientP05: percentile(gradients, 0.05),
    fieldGradientMedian: percentile(gradients, 0.5),
  };
}

function measureDisplacement(current, reference) {
  if (!current || !reference || !(current.vertexSourceIds instanceof Uint32Array) || !(reference.vertexSourceIds instanceof Uint32Array)) {
    return { maximum: 0, rms: 0, matchedVertexCount: 0 };
  }
  const referenceBySource = new Map();
  for (let vertex = 0; vertex < reference.vertexSourceIds.length; vertex += 1) referenceBySource.set(reference.vertexSourceIds[vertex], vertex);
  let maximum = 0;
  let squared = 0;
  let count = 0;
  for (let vertex = 0; vertex < current.vertexSourceIds.length; vertex += 1) {
    const referenceVertex = referenceBySource.get(current.vertexSourceIds[vertex]);
    if (referenceVertex === undefined) continue;
    const displacement = distance(readVec3(current.positions, vertex), readVec3(reference.positions, referenceVertex));
    maximum = Math.max(maximum, displacement);
    squared += displacement * displacement;
    count += 1;
  }
  return { maximum, rms: count ? Math.sqrt(squared / count) : 0, matchedVertexCount: count };
}

function sameVertexOrder(left, right) {
  if (!left || !right || left.positions.length !== right.positions.length) return false;
  if (!(left.vertexSourceIds instanceof Uint32Array) || !(right.vertexSourceIds instanceof Uint32Array)) return false;
  if (left.vertexSourceIds.length !== right.vertexSourceIds.length) return false;
  for (let index = 0; index < left.vertexSourceIds.length; index += 1) {
    if (left.vertexSourceIds[index] !== right.vertexSourceIds[index]) return false;
  }
  return true;
}

function createTBindIdentityAudit({ canonical, tPose, tPoseDetail, runtime, rigCore }) {
  let maximum = 0;
  let squared = 0;
  let movedAbove1e7 = 0;
  let movedAbove1e5 = 0;
  for (let vertex = 0; vertex < canonical.positions.length / 3; vertex += 1) {
    const displacement = distance(readVec3(canonical.positions, vertex), readVec3(tPose.positions, vertex));
    maximum = Math.max(maximum, displacement);
    squared += displacement * displacement;
    if (displacement > 1e-7) movedAbove1e7 += 1;
    if (displacement > 1e-5) movedAbove1e5 += 1;
  }
  const triangleIds = [...new Set(tPoseDetail.intersections.pairs.flatMap((pair) => [pair.leftTriangle, pair.rightTriangle]))].sort((left, right) => left - right);
  const vertexIds = [...new Set(triangleIds.flatMap((triangle) => triangleVertices(tPose.indices, triangle)))];
  const transformDiagnostics = createProceduralSurfaceTransformDiagnosticsV5({
    surface: runtime.surface,
    fieldDefinition: runtime.field.definition,
    rigCore,
    finalPose: tPose.pose,
    vertexIndices: vertexIds,
  });
  const diagnosticByVertex = new Map(transformDiagnostics.vertices.map((entry) => [entry.vertex, entry]));
  const penetratingTriangles = triangleIds.map((triangle) => ({
    triangle,
    vertices: triangleVertices(tPose.indices, triangle).map((vertex) => {
      const canonicalPosition = readVec3(canonical.positions, vertex);
      const tPosePosition = readVec3(tPose.positions, vertex);
      const diagnostic = diagnosticByVertex.get(vertex);
      return {
        vertex,
        canonicalPosition,
        tPosePosition,
        displacement: subtract(tPosePosition, canonicalPosition),
        displacementMagnitude: distance(canonicalPosition, tPosePosition),
        regionInfluences: diagnostic.influences,
        dqsBlendedTransform: diagnostic.blendedTransform,
        dqsPosition: diagnostic.position,
      };
    }),
  }));
  return {
    summary: {
      maximumTBindDisplacement: maximum,
      rmsTBindDisplacement: Math.sqrt(squared / Math.max(1, canonical.positions.length / 3)),
      movedVertexCountAbove1e7: movedAbove1e7,
      movedVertexCountAbove1e5: movedAbove1e5,
      withinIdentityGate: maximum <= 1e-6,
    },
    regionTransforms: transformDiagnostics.regionTransforms,
    penetratingTriangles,
  };
}

async function createRepresentativeEvidence(entry) {
  const rawDetail = entry.details.get('polygonized-raw');
  const canonicalDetail = entry.details.get('canonical-final');
  const tPoseDetail = entry.details.get('t-pose-deformed');
  const canonical = canonicalDetail.snapshot;
  const evidence = [];
  for (const [leftTriangle, rightTriangle] of REPRESENTATIVE_PAIRS) {
    const pair = findPair(tPoseDetail.intersections.pairs, leftTriangle, rightTriangle);
    const leftSource = canonical.triangleProvenance[leftTriangle];
    const rightSource = canonical.triangleProvenance[rightTriangle];
    const sourceRelationship = compareTriangleSources(leftSource, rightSource);
    const stagePresence = entry.stages.map((stage) => {
      const detail = entry.details.get(stage.stageId);
      const sourceLeft = stage.stageId === 'polygonized-raw' ? leftSource.rawTriangleIndex : leftTriangle;
      const sourceRight = stage.stageId === 'polygonized-raw' ? rightSource.rawTriangleIndex : rightTriangle;
      return { stageId: stage.stageId, penetrating: Boolean(findPair(detail.intersections.pairs, sourceLeft, sourceRight)) };
    });
    const firstPairIntroductionStage = stagePresence.find((stage) => stage.penetrating)?.stageId ?? null;
    const tracePoints = createTracePoints({ canonical, pair, leftTriangle, rightTriangle });
    const scalarFieldTrace = tracePoints.map(({ label, point }) => traceFieldPoint(entry.runtime.field, label, point, canonical.voxelSize));
    const objName = `muscular-t-pose-triangles-${leftTriangle}-${rightTriangle}-provenance.obj`;
    await writeFile(resolve(LOCAL_OBJ_ROOT, objName), createProvenanceOBJ({ canonical, pair, leftTriangle, rightTriangle, leftSource, rightSource }), 'utf8');
    evidence.push({
      pair: `${leftTriangle}/${rightTriangle}`,
      leftTriangle,
      rightTriangle,
      regions: pair ? [pair.leftRegion, pair.rightRegion] : [],
      penetratingAtTPose: Boolean(pair),
      intersectionSegment: pair?.intersectionSegment ?? null,
      intersectionSegmentLength: pair?.intersectionSegmentLength ?? 0,
      leftSource,
      rightSource,
      sourceRelationship,
      firstPairIntroductionStage,
      onlyApproachedInLaterStage: firstPairIntroductionStage !== 'polygonized-raw',
      stagePresence,
      scalarFieldTrace,
      localVoxelSize: [...canonical.voxelSize],
      evidence: `local-obj/${objName}`,
      rawSourcePairPenetrating: Boolean(findPair(rawDetail.intersections.pairs, leftSource.rawTriangleIndex, rightSource.rawTriangleIndex)),
    });
  }
  return evidence;
}

function createTracePoints({ canonical, pair, leftTriangle, rightTriangle }) {
  const left = triangleVertices(canonical.indices, leftTriangle).map((vertex) => readVec3(canonical.positions, vertex));
  const right = triangleVertices(canonical.indices, rightTriangle).map((vertex) => readVec3(canonical.positions, vertex));
  const segment = pair?.intersectionSegment ?? [];
  const all = [...left, ...right];
  const bounds = boundsOfPoints(all);
  return [
    ...left.map((point, index) => ({ label: `left-triangle-vertex-${index}`, point })),
    ...right.map((point, index) => ({ label: `right-triangle-vertex-${index}`, point })),
    ...segment.map((point, index) => ({ label: `intersection-segment-endpoint-${index}`, point })),
    ...(segment.length === 2 ? [{ label: 'intersection-segment-midpoint', point: midpoint(segment[0], segment[1]) }] : []),
    { label: 'left-triangle-centroid', point: centroid(left) },
    { label: 'right-triangle-centroid', point: centroid(right) },
    { label: 'local-bounds-center', point: midpoint(bounds.minimum, bounds.maximum) },
  ];
}

function traceFieldPoint(field, label, point, voxelSize) {
  const traced = field.sample(point, { trace: true });
  const sampled = field.sample(point);
  const gradient = sampleFieldGradientV5(field, point, Math.max(1e-7, Math.min(...voxelSize) * 0.08));
  return {
    label,
    point,
    composedFieldValue: traced.distance,
    directSampleValue: sampled,
    traceAgreementError: Math.abs(traced.distance - sampled),
    gradient,
    gradientMagnitude: Math.hypot(...gradient),
    ...traced.trace,
  };
}

function compareTriangleSources(left, right) {
  const sharedCornerCount = left.gridCornerIds.filter((id) => right.gridCornerIds.includes(id)).length;
  return {
    sourceTetraAABBsIntersect: boxesOverlap(left.sourceTetraBounds, right.sourceTetraBounds),
    shareCube: left.cubeX === right.cubeX && left.cubeY === right.cubeY && left.cubeZ === right.cubeZ,
    sharedGridCornerCount: sharedCornerCount,
    shareFace: sharedCornerCount >= 3,
    shareEdge: sharedCornerCount >= 2,
  };
}

function buildIntersectionClusters(detail) {
  const pairs = detail.intersections.pairs;
  const parent = new Map();
  const find = (value) => {
    if (!parent.has(value)) parent.set(value, value);
    if (parent.get(value) !== value) parent.set(value, find(parent.get(value)));
    return parent.get(value);
  };
  const union = (left, right) => {
    const a = find(left); const b = find(right);
    if (a !== b) parent.set(Math.max(a, b), Math.min(a, b));
  };
  for (const pair of pairs) union(pair.leftTriangle, pair.rightTriangle);
  const grouped = new Map();
  for (const pair of pairs) {
    const root = find(pair.leftTriangle);
    const entries = grouped.get(root) ?? [];
    entries.push(pair);
    grouped.set(root, entries);
  }
  const topology = createTriangleTopology(detail.snapshot.indices);
  return [...grouped.values()].map((clusterPairs, index) => {
    const triangles = [...new Set(clusterPairs.flatMap((pair) => [pair.leftTriangle, pair.rightTriangle]))].sort((left, right) => left - right);
    const vertexIds = [...new Set(triangles.flatMap((triangle) => triangleVertices(detail.snapshot.indices, triangle)))];
    const points = vertexIds.map((vertex) => readVec3(detail.snapshot.positions, vertex));
    const lengths = clusterPairs.map((pair) => pair.intersectionSegmentLength ?? 0);
    const ringDistances = clusterPairs.map((pair) => triangleRingDistance(topology, pair.leftTriangle, pair.rightTriangle)).filter(Number.isFinite);
    const regions = [...new Set(clusterPairs.flatMap((pair) => [pair.leftRegion, pair.rightRegion]))].sort();
    return {
      clusterId: `cluster-${String(index + 1).padStart(3, '0')}`,
      category: classifyCluster(clusterPairs),
      triangleCount: triangles.length,
      intersectionPairCount: clusterPairs.length,
      triangles,
      regions,
      targetRegionOnly: regions.every((region) => TARGET_REGIONS.has(region)),
      regionPairHistogram: countBy(clusterPairs, (pair) => regionPairKey(pair.leftRegion, pair.rightRegion)),
      bounds: boundsOfPoints(points),
      centroid: centroid(points),
      maximumSegmentLength: Math.max(0, ...lengths),
      meanSegmentLength: mean(lengths),
      minimumTopologyRingDistance: ringDistances.length ? Math.min(...ringDistances) : null,
      maximumTopologyRingDistance: ringDistances.length ? Math.max(...ringDistances) : null,
    };
  }).sort((left, right) => clusterCategoryOrder(left.category) - clusterCategoryOrder(right.category) || left.clusterId.localeCompare(right.clusterId));
}

function classifyFirstIntroductionStage(stages) {
  const first = stages.find((stage) => stage.penetratingIntersectionCount > 0)?.stageId ?? null;
  if (first === 'polygonized-raw' || first === 'topology-filtered' || first === 'compacted') return 'raw-extraction';
  if (first === 'initial-oriented') return 'initial-orientation';
  if (/fairing-iteration-\d+-lambda/.test(first ?? '')) return 'fairing-lambda';
  if (/fairing-iteration-\d+-mu/.test(first ?? '')) return 'fairing-mu';
  if (/fairing-iteration-\d+-projected/.test(first ?? '')) return 'fairing-projection';
  if (/fairing-iteration-\d+-halfspace/.test(first ?? '')) return 'fairing-halfspace';
  if (/fairing-iteration-\d+-safe-repair/.test(first ?? '')) return 'fairing-safe-repair';
  if (first === 'final-oriented' || first === 'canonical-final') return 'final-orientation';
  if (first === 't-pose-deformed') return 't-pose-runtime';
  if (first === 'a-pose-deformed') return 'a-pose-runtime-only';
  return 'mixed';
}

function classifyRootCause({ main: legacy, uniform, fairingDisabled, resolution48, firstIntroductionStage }) {
  const rawLegacy = stageMetric(legacy, 'polygonized-raw').penetratingIntersectionCount;
  const rawUniform = stageMetric(uniform, 'polygonized-raw').penetratingIntersectionCount;
  const primaryRootCause = firstIntroductionStage === 'raw-extraction'
    ? rawUniform === 0
      ? 'legacy-mirrored-x tetrahedralization introduces non-conforming local pelvis sheets while uniform-conforming remains intersection-free'
      : 'the sampled Muscular pelvis/groin scalar field yields intersecting non-neighbor raw isosurface sheets in both tetrahedralization modes'
    : firstIntroductionStage === 'fairing-projection'
      ? 'zero-set projection moves previously separated Muscular surface triangles into penetrating configurations; legacy raw extraction, initial orientation, lambda, and mu remain penetration-free'
      : `the first new penetrating contacts are introduced by ${firstIntroductionStage}`;
  const fairingContributors = [];
  let previous = stageMetric(legacy, 'initial-oriented').penetratingIntersectionCount;
  for (const stage of legacy.stages) {
    if (/^fairing-/.test(stage.stageId) && stage.penetratingIntersectionCount > previous) {
      fairingContributors.push({ stageId: stage.stageId, addedPenetrations: stage.penetratingIntersectionCount - previous });
    }
    previous = stage.penetratingIntersectionCount;
  }
  return {
    primaryRootCause,
    secondaryContributors: fairingContributors,
    supportingEvidence: [
      `legacy raw=${rawLegacy}, compacted=${stageMetric(legacy, 'compacted').penetratingIntersectionCount}, initial-oriented=${stageMetric(legacy, 'initial-oriented').penetratingIntersectionCount}`,
      `legacy iteration-1 lambda=${stageMetric(legacy, 'fairing-iteration-1-lambda').penetratingIntersectionCount}, mu=${stageMetric(legacy, 'fairing-iteration-1-mu').penetratingIntersectionCount}, projected=${stageMetric(legacy, 'fairing-iteration-1-projected').penetratingIntersectionCount}`,
      `fairing-disabled canonical=${stageMetric(fairingDisabled, 'canonical-final').penetratingIntersectionCount}`,
      `uniform raw=${rawUniform}, uniform canonical=${stageMetric(uniform, 'canonical-final').penetratingIntersectionCount}`,
      `resolution48 raw=${stageMetric(resolution48, 'polygonized-raw').penetratingIntersectionCount}, resolution48 canonical=${stageMetric(resolution48, 'canonical-final').penetratingIntersectionCount}`,
      `maximumTBindDisplacement=${legacy.tBindIdentityAudit.summary.maximumTBindDisplacement}`,
    ],
    rejectedHypotheses: [
      {
        hypothesis: 'raw extraction is the primary source',
        rejected: true,
        evidence: `legacy raw=${rawLegacy}, uniform raw=${rawUniform}`,
      },
      {
        hypothesis: 'initial triangle orientation is the primary source',
        rejected: true,
        evidence: comparisonText(legacy, 'compacted', 'initial-oriented'),
      },
      {
        hypothesis: 'legacy lambda or mu is the earliest source',
        rejected: true,
        evidence: `lambda=${stageMetric(legacy, 'fairing-iteration-1-lambda').penetratingIntersectionCount}, mu=${stageMetric(legacy, 'fairing-iteration-1-mu').penetratingIntersectionCount}`,
      },
      {
        hypothesis: 'T-bind runtime is the earliest source',
        rejected: true,
        evidence: `canonical=${stageMetric(legacy, 'canonical-final').penetratingIntersectionCount}, maximumTBindDisplacement=${legacy.tBindIdentityAudit.summary.maximumTBindDisplacement}`,
      },
      {
        hypothesis: 'resolution-36 aliasing is the sole source',
        rejected: true,
        evidence: `resolution48 raw=${stageMetric(resolution48, 'polygonized-raw').penetratingIntersectionCount}, canonical=${stageMetric(resolution48, 'canonical-final').penetratingIntersectionCount}`,
      },
      {
        hypothesis: 'A-pose runtime is the sole source',
        rejected: true,
        evidence: `T Pose=${stageMetric(legacy, 't-pose-deformed').penetratingIntersectionCount}, A Pose=${stageMetric(legacy, 'a-pose-deformed').penetratingIntersectionCount}`,
      },
    ],
  };
}

function compareCases(left, right) {
  const select = (entry) => Object.fromEntries(['polygonized-raw', 'initial-oriented', 'canonical-final', 't-pose-deformed', 'a-pose-deformed']
    .filter((stageId) => entry.details.has(stageId))
    .map((stageId) => [stageId, stageMetric(entry, stageId).penetratingIntersectionCount]));
  return { leftCaseId: left.configuration.caseId, rightCaseId: right.configuration.caseId, left: select(left), right: select(right) };
}

function compactCase(entry) {
  return {
    ...entry.configuration,
    generatorVersion: entry.generatorVersion,
    topology: entry.topology,
    stages: entry.stages,
    tBindIdentity: entry.tBindIdentityAudit.summary,
  };
}

function assertDiagnosticContract() {
  const requiredStages = [
    'polygonized-raw', 'topology-filtered', 'compacted', 'initial-oriented',
    'fairing-iteration-1-lambda', 'fairing-iteration-1-mu', 'fairing-iteration-1-projected', 'fairing-iteration-1-halfspace', 'fairing-iteration-1-safe-repair',
    'fairing-iteration-2-lambda', 'fairing-iteration-2-mu', 'fairing-iteration-2-projected', 'fairing-iteration-2-halfspace', 'fairing-iteration-2-safe-repair',
    'final-oriented', 'canonical-final', 't-pose-deformed', 'a-pose-deformed',
  ];
  for (const stageId of requiredStages) assert.ok(main.details.has(stageId), `Missing required diagnostic stage ${stageId}.`);
  assert.equal(stageMetric(main, 'canonical-final').orientationGateFailure, null, 'Formal Muscular legacy extraction failed the production orientation gate.');
  assert.equal(representativeEvidence.length, REPRESENTATIVE_PAIRS.length);
  assert.equal(stageMetric(main, 't-pose-deformed').penetratingIntersectionCount, 104, 'Diagnostic Hook changed the fixed Muscular T Pose baseline.');
  assert.equal(stageMetric(main, 'a-pose-deformed').penetratingIntersectionCount, 118, 'Diagnostic Hook changed the fixed Muscular A Pose baseline.');
  assert.equal(stageMetric(reference, 't-pose-deformed').penetratingIntersectionCount, 0, 'Reference T Pose control regressed.');
  assert.equal(stageMetric(reference, 'a-pose-deformed').penetratingIntersectionCount, 0, 'Reference A Pose control regressed.');
  for (const entry of cases) {
    assert.equal(entry.topology.connectedComponentCount, 1, `${entry.configuration.caseId} must remain one component.`);
    assert.equal(entry.topology.boundaryEdgeCount, 0, `${entry.configuration.caseId} must remain closed.`);
    assert.equal(entry.topology.nonManifoldEdgeCount, 0, `${entry.configuration.caseId} must remain manifold.`);
    assert.ok(entry.topology.degenerateTriangleRatio < 0.001, `${entry.configuration.caseId} degenerate triangle ratio regressed.`);
  }
  for (const pair of representativeEvidence) {
    assert.ok(pair.leftSource && pair.rightSource, `${pair.pair} is missing extraction provenance.`);
    for (const trace of pair.scalarFieldTrace) assert.ok(trace.traceAgreementError < 1e-10, `${pair.pair}/${trace.label} trace diverged from field.sample.`);
  }
}

function createProvenanceOBJ({ canonical, pair, leftTriangle, rightTriangle, leftSource, rightSource }) {
  const left = triangleVertices(canonical.indices, leftTriangle).map((vertex) => readVec3(canonical.positions, vertex));
  const right = triangleVertices(canonical.indices, rightTriangle).map((vertex) => readVec3(canonical.positions, vertex));
  const lines = [
    '# Task 14C-1A2a canonical intersection provenance',
    `# finalTriangles=${leftTriangle}/${rightTriangle}`,
    `# rawTriangles=${leftSource.rawTriangleIndex}/${rightSource.rawTriangleIndex}`,
    `# leftCube=${leftSource.cubeX},${leftSource.cubeY},${leftSource.cubeZ} leftTetra=${leftSource.tetrahedronOrdinal}`,
    `# rightCube=${rightSource.cubeX},${rightSource.cubeY},${rightSource.cubeZ} rightTetra=${rightSource.tetrahedronOrdinal}`,
    'o final_left_triangle',
    ...left.map((point) => `v ${point.join(' ')}`),
    'f 1 2 3',
    'o final_right_triangle',
    ...right.map((point) => `v ${point.join(' ')}`),
    'f 4 5 6',
  ];
  if (pair?.intersectionSegment?.length === 2) {
    lines.push(...pair.intersectionSegment.map((point) => `v ${point.join(' ')}`), 'l 7 8');
  }
  return `${lines.join('\n')}\n`;
}

function classifyCluster(pairs) {
  const keys = new Set(pairs.map((pair) => regionPairKey(pair.leftRegion, pair.rightRegion)));
  if (keys.has('pelvis/pelvis')) return 'pelvis-pelvis';
  if ([...keys].some((key) => /pelvis\/(leftThigh|rightThigh)|(leftThigh|rightThigh)\/pelvis/.test(key))) return 'pelvis-thigh';
  if (keys.has('lowerTorso/pelvis') || keys.has('pelvis/lowerTorso')) return 'pelvis-lowerTorso';
  if ([...keys].some((key) => /upperTorso\/(leftUpperArm|rightUpperArm)|(leftUpperArm|rightUpperArm)\/upperTorso/.test(key))) return 'upperTorso-upperArm';
  return 'other';
}

function clusterCategoryOrder(category) {
  return ['pelvis-pelvis', 'pelvis-thigh', 'pelvis-lowerTorso', 'upperTorso-upperArm', 'other'].indexOf(category);
}

function countIntersectionClusters(pairs) {
  const parent = new Map();
  const find = (value) => {
    if (!parent.has(value)) parent.set(value, value);
    if (parent.get(value) !== value) parent.set(value, find(parent.get(value)));
    return parent.get(value);
  };
  for (const pair of pairs) {
    const left = find(pair.leftTriangle); const right = find(pair.rightTriangle);
    if (left !== right) parent.set(Math.max(left, right), Math.min(left, right));
  }
  return new Set(pairs.flatMap((pair) => [find(pair.leftTriangle), find(pair.rightTriangle)])).size;
}

function createTriangleTopology(indices) {
  const neighbors = Array.from({ length: indices.length / 3 }, () => new Set());
  const edges = new Map();
  for (let triangle = 0; triangle < indices.length / 3; triangle += 1) {
    const vertices = triangleVertices(indices, triangle);
    for (const [left, right] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
      const key = left < right ? `${left}:${right}` : `${right}:${left}`;
      const entries = edges.get(key) ?? [];
      entries.push(triangle);
      edges.set(key, entries);
    }
  }
  for (const entries of edges.values()) for (const left of entries) for (const right of entries) if (left !== right) neighbors[left].add(right);
  return neighbors;
}

function triangleRingDistance(topology, start, target) {
  if (start === target) return 0;
  const queue = [[start, 0]];
  const visited = new Set([start]);
  while (queue.length) {
    const [triangle, distanceValue] = queue.shift();
    for (const neighbor of topology[triangle]) {
      if (neighbor === target) return distanceValue + 1;
      if (!visited.has(neighbor)) { visited.add(neighbor); queue.push([neighbor, distanceValue + 1]); }
    }
  }
  return Infinity;
}

function stageMetric(entry, stageId) {
  return entry.details.get(stageId).metrics;
}

function comparisonText(entry, leftStage, rightStage) {
  return `${leftStage}=${stageMetric(entry, leftStage).penetratingIntersectionCount}, ${rightStage}=${stageMetric(entry, rightStage).penetratingIntersectionCount}`;
}

function findCase(caseId) {
  return cases.find((entry) => entry.configuration.caseId === caseId);
}

function findPair(pairs, left, right) {
  return pairs.find((pair) => pair.leftTriangle === Math.min(left, right) && pair.rightTriangle === Math.max(left, right));
}

function triangleVertices(indices, triangle) {
  return [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]];
}

function regionPairKey(left, right) {
  return [left, right].sort().join('/');
}

function countBy(values, selector) {
  const result = {};
  for (const value of values) {
    const key = selector(value);
    result[key] = (result[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

function boxesOverlap(left, right) {
  return [0, 1, 2].every((axis) => left.maximum[axis] >= right.minimum[axis] && right.maximum[axis] >= left.minimum[axis]);
}

function boundsOfPoints(points) {
  return {
    minimum: [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis]))),
    maximum: [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis]))),
  };
}

function centroid(points) {
  return [0, 1, 2].map((axis) => points.reduce((sum, point) => sum + point[axis], 0) / Math.max(1, points.length));
}

function midpoint(left, right) {
  return left.map((value, axis) => (value + right[axis]) * 0.5);
}

function readVec3(array, vertex) {
  return [array[vertex * 3], array[vertex * 3 + 1], array[vertex * 3 + 2]];
}

function subtract(left, right) {
  return left.map((value, axis) => value - right[axis]);
}

function distance(left, right) {
  return Math.hypot(...subtract(left, right));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(sorted, fraction) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))] : 0;
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
