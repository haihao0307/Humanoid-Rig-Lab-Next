import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  HumanCoreRuntime,
  PROCEDURAL_BODY_DNA_PRESETS_V5,
  ProceduralDeformRuntimeV5,
  analyzeSurfaceGeometryV5,
  createBodyDNA,
  createProceduralDeformValidationPoseV5,
  findSurfaceSelfIntersectionsV5,
} from '../src/modules/human-core-v5/index.js';

const OUTPUT_PATH = resolve('artifacts/qa/task14c-projection-visual-pilot/metrics.json');
const RESOLUTION = 48;
const MODES = Object.freeze([
  Object.freeze({ mode: 'legacy', projectionMode: 'legacy' }),
  Object.freeze({ mode: 'candidate', projectionMode: 'collision-aware-pilot' }),
]);
const PILOT_TARGET_REGION_PAIRS = Object.freeze(new Set([
  'leftThigh/lowerTorso',
  'leftThigh/pelvis',
  'lowerTorso/pelvis',
  'lowerTorso/rightThigh',
  'pelvis/pelvis',
  'pelvis/rightThigh',
]));

const scenarios = [];
const surfaceDiagnostics = [];
for (const preset of ['Reference', 'Muscular']) {
  for (const configuration of MODES) {
    console.error(`[projection-visual-pilot] generating ${preset}/${configuration.mode}`);
    const bodyDNA = createBodyDNA({
      ...structuredClone(PROCEDURAL_BODY_DNA_PRESETS_V5[preset]),
      bodyDNAId: `task14c-projection-pilot-${preset.toLowerCase()}-${configuration.mode}`,
      identity: { humanId: `task14c-projection-pilot-${preset.toLowerCase()}-${configuration.mode}`, label: preset },
      proportionRevision: 14,
    });
    const human = new HumanCoreRuntime();
    human.createHuman(bodyDNA);
    const rigCore = human.getRigCore();
    const runtime = new ProceduralDeformRuntimeV5();
    runtime.compileHuman({ bodyDNA, rigCore });
    const metadata = await runtime.generateCanonicalSurface({
      resolution: RESOLUTION,
      worker: false,
      projectionMode: configuration.projectionMode,
    });
    const topology = analyzeSurfaceGeometryV5(runtime.surface.positions, runtime.surface.indices);
    const common = {
      preset,
      mode: configuration.mode,
      projectionMode: configuration.projectionMode,
      resolution: RESOLUTION,
      connectedComponentCount: topology.connectedComponentCount,
      boundaryEdgeCount: topology.boundaryEdgeCount,
      nonManifoldEdgeCount: topology.nonManifoldEdgeCount,
      degenerateTriangleRatio: topology.degenerateTriangleRatio,
      maximumAbsoluteFieldError: metadata.generationDiagnostics.fairing.maximumAbsoluteFieldError,
      height: metadata.measurements.height,
      shoulderWidth: metadata.measurements.shoulderWidth,
      hipWidth: metadata.measurements.hipWidth,
      vertexCount: runtime.surface.positions.length / 3,
      triangleCount: runtime.surface.indices.length / 3,
      generationTimeMs: metadata.generationDiagnostics.generationTimeMs,
    };
    surfaceDiagnostics.push({
      ...common,
      collisionAwarePilot: metadata.generationDiagnostics.fairing.collisionAwarePilot,
    });

    const poses = preset === 'Reference' ? ['t-pose'] : ['t-pose', 'a-pose'];
    for (const poseId of poses) {
      const pose = createProceduralDeformValidationPoseV5({ poseId, rigCore, bodyDNA, timestamp: 1 });
      human.updatePose(pose);
      const frame = runtime.update({ finalPose: pose, anatomyState: human.getAnatomyState(), timestamp: 1 });
      const intersections = findSurfaceSelfIntersectionsV5({
        positions: frame.deformedPositions,
        indices: frame.indices,
        regionIds: frame.regionIds,
        regionNames: runtime.surface.regionNames,
      });
      const histogram = sortedHistogram(intersections.pairs.map((pair) => canonicalRegionPair(pair.leftRegion, pair.rightRegion)));
      scenarios.push({
        ...common,
        poseId,
        totalPenetratingCount: intersections.penetratingIntersectionCount,
        targetRegionPairCount: intersections.pairs.filter((pair) => (
          PILOT_TARGET_REGION_PAIRS.has(canonicalRegionPair(pair.leftRegion, pair.rightRegion))
        )).length,
        regionPairHistogram: histogram,
      });
    }
    runtime.dispose();
  }
}

const comparisons = ['Reference/t-pose', 'Muscular/t-pose', 'Muscular/a-pose'].map((id) => {
  const [preset, poseId] = id.split('/');
  const legacy = findScenario(preset, poseId, 'legacy');
  const candidate = findScenario(preset, poseId, 'candidate');
  const legacyPairs = Object.keys(legacy.regionPairHistogram);
  const candidatePairs = Object.keys(candidate.regionPairHistogram);
  return {
    preset,
    poseId,
    legacy: compactComparisonScenario(legacy),
    candidate: compactComparisonScenario(candidate),
    newRegionPairs: candidatePairs.filter((pair) => !legacyPairs.includes(pair)).sort(),
    deltas: {
      totalPenetratingCount: candidate.totalPenetratingCount - legacy.totalPenetratingCount,
      targetRegionPairCount: candidate.targetRegionPairCount - legacy.targetRegionPairCount,
      maximumAbsoluteFieldError: candidate.maximumAbsoluteFieldError - legacy.maximumAbsoluteFieldError,
      height: candidate.height - legacy.height,
      shoulderWidth: candidate.shoulderWidth - legacy.shoulderWidth,
      hipWidth: candidate.hipWidth - legacy.hipWidth,
      generationTimeMs: candidate.generationTimeMs - legacy.generationTimeMs,
    },
  };
});

const failures = [];
const referenceCandidate = findScenario('Reference', 't-pose', 'candidate');
if (referenceCandidate.totalPenetratingCount !== 0) failures.push(`Reference candidate T penetrations=${referenceCandidate.totalPenetratingCount}`);
for (const poseId of ['t-pose', 'a-pose']) {
  const muscularCandidate = findScenario('Muscular', poseId, 'candidate');
  if (muscularCandidate.targetRegionPairCount !== 0) failures.push(`Muscular candidate ${poseId} target pairs=${muscularCandidate.targetRegionPairCount}`);
}
for (const scenario of scenarios) {
  if (scenario.connectedComponentCount !== 1) failures.push(`${scenario.preset}/${scenario.poseId}/${scenario.mode} components=${scenario.connectedComponentCount}`);
  if (scenario.boundaryEdgeCount !== 0) failures.push(`${scenario.preset}/${scenario.poseId}/${scenario.mode} boundary=${scenario.boundaryEdgeCount}`);
  if (scenario.nonManifoldEdgeCount !== 0) failures.push(`${scenario.preset}/${scenario.poseId}/${scenario.mode} nonManifold=${scenario.nonManifoldEdgeCount}`);
  if (!(scenario.degenerateTriangleRatio < 0.001)) failures.push(`${scenario.preset}/${scenario.poseId}/${scenario.mode} degenerate=${scenario.degenerateTriangleRatio}`);
}
for (const comparison of comparisons) {
  if (comparison.newRegionPairs.length) failures.push(`${comparison.preset}/${comparison.poseId} new Region Pairs=${comparison.newRegionPairs.join(',')}`);
  for (const measurement of ['height', 'shoulderWidth', 'hipWidth']) {
    if (Math.abs(comparison.deltas[measurement]) > 0.002) failures.push(`${comparison.preset}/${comparison.poseId} ${measurement} delta=${comparison.deltas[measurement]}`);
  }
}

const report = {
  schema: 'humanoid_rig/task14c_projection_visual_pilot@5.0',
  task: 'Task 14C Projection Visual Pilot A',
  resolution: RESOLUTION,
  status: failures.length ? 'FAILED' : 'NUMERIC_PASS_VISUAL_PENDING',
  experimental: true,
  notForAcceptance: true,
  scenarios,
  surfaceDiagnostics,
  comparisons,
  gates: {
    passed: failures.length === 0,
    failures,
    visualAcceptance: false,
    productionReady: false,
  },
};

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output: OUTPUT_PATH, status: report.status, failures, scenarios: scenarios.map(compactComparisonScenario) }));
if (failures.length) process.exitCode = 1;

function findScenario(preset, poseId, mode) {
  const scenario = scenarios.find((entry) => entry.preset === preset && entry.poseId === poseId && entry.mode === mode);
  if (!scenario) throw new Error(`Missing pilot scenario ${preset}/${poseId}/${mode}.`);
  return scenario;
}

function canonicalRegionPair(left, right) {
  return left.localeCompare(right) <= 0 ? `${left}/${right}` : `${right}/${left}`;
}

function sortedHistogram(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));
}

function compactComparisonScenario(scenario) {
  return Object.fromEntries([
    'preset', 'poseId', 'mode', 'totalPenetratingCount', 'targetRegionPairCount', 'regionPairHistogram',
    'connectedComponentCount', 'boundaryEdgeCount', 'nonManifoldEdgeCount', 'degenerateTriangleRatio',
    'maximumAbsoluteFieldError', 'height', 'shoulderWidth', 'hipWidth', 'vertexCount', 'triangleCount', 'generationTimeMs',
  ].map((key) => [key, scenario[key]]));
}
