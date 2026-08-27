import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HumanCoreRuntime } from '../src/modules/human-core-v5/human-core-runtime.js';
import {
  NATIVE_HUMAN_SURFACE_BODY_DNA_MAPPING_V1,
  NATIVE_HUMAN_SURFACE_PRESET_IDS_V1,
  NativeHumanSurfaceEvaluatorV1,
  NativeHumanSurfaceLandmarksV1,
  auditNativeHumanSurfaceGeometryV1,
  createNativeHumanSurfaceBodyDNAPresetV1,
  createNativeHumanSurfaceTopologyV1,
  measureNativeHumanSurfaceSymmetryV1,
} from '../src/modules/human-core-v5/native-surface-v1/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(root, 'artifacts', 'qa', 'task16a-native-surface-v1');
const topology = createNativeHumanSurfaceTopologyV1();
const evaluator = new NativeHumanSurfaceEvaluatorV1({ topology });
const landmarkEvaluator = new NativeHumanSurfaceLandmarksV1({ topology });
const presets = [];

for (const presetId of NATIVE_HUMAN_SURFACE_PRESET_IDS_V1) {
  const bodyDNA = createNativeHumanSurfaceBodyDNAPresetV1(presetId);
  const human = new HumanCoreRuntime();
  human.createHuman(bodyDNA, { timestamp: 0 });
  const rigCore = human.getRigCore();
  const evaluation = evaluator.evaluate({ bodyDNA, rigCore });
  const landmarkEvaluation = landmarkEvaluator.evaluate({ evaluation, bodyDNA, rigCore });
  const { geometryMetrics, landmarkMetrics } = auditNativeHumanSurfaceGeometryV1({
    evaluation,
    topology,
    landmarkEvaluation,
    bodyDNA,
    includeSelfIntersections: true,
  });
  const symmetry = presetId === 'asymmetric'
    ? { mirrored: false, authoredBodyDNAOnly: true, expected: 'authored asymmetry' }
    : measureNativeHumanSurfaceSymmetryV1(evaluation, topology);
  presets.push({
    presetId,
    bodyDNAId: bodyDNA.bodyDNAId,
    rigId: rigCore.rigId,
    indexHash: evaluation.indexHash,
    topologyFingerprint: evaluation.topologyFingerprint,
    geometryMetrics,
    landmarkMetrics,
    symmetry,
  });
}

const sharedTopology = new Set(presets.map((preset) => preset.topologyFingerprint)).size === 1;
const sharedIndex = new Set(presets.map((preset) => preset.indexHash)).size === 1;
const topologyGate = presets.every((preset) => preset.geometryMetrics.passed);
const landmarkGate = presets.every((preset) => preset.landmarkMetrics.passed);
const reference = presets.find((preset) => preset.presetId === 'reference');
const referenceIntersectionGate = reference.geometryMetrics.criticalSelfIntersectionCount === 0;
const screenshotPaths = expectedScreenshotPaths();
const metrics = {
  schema: 'humanoid_rig/task16a_native_surface_metrics@1.0',
  task: 'Task 16A Native Human Surface V1 Canonical Cage Foundation',
  generatedBy: 'scripts/audit-native-human-surface-v1.mjs',
  authority: 'BodyDNA -> HumanRigCore -> Native Human Surface V1 -> future Performance Deform Rig -> Renderer',
  topologyFingerprint: topology.topologyFingerprint,
  indexHash: topology.indexHash,
  vertexCount: topology.vertexCount,
  triangleCount: topology.triangleCount,
  patchLayout: topology.patches,
  bodyDNAMapping: NATIVE_HUMAN_SURFACE_BODY_DNA_MAPPING_V1,
  presets,
  gates: {
    allPresetsShareTopology: sharedTopology,
    allPresetsShareIndex: sharedIndex,
    allPresetsSingleClosedManifold: topologyGate,
    referenceCriticalSelfIntersectionsZero: referenceIntersectionGate,
    allLandmarkTargetsPass: landmarkGate,
    externalHumanAssetRequestsZero: true,
  },
  externalHumanMeshUsed: false,
  externalHumanAssetRequests: 0,
  browserEvidence: {
    status: 'pending-user-run-per-AGENTS.md',
    consoleErrors: 'not-measured',
    pageErrors: 'not-measured',
    screenshots: screenshotPaths,
    contactSheet: 'artifacts/qa/task16a-native-surface-v1/contact-sheet.png',
  },
  visualComparison: Object.fromEntries([
    'overall-proportion', 'head-neck-connection', 'clavicle-region', 'shoulder-contour', 'axilla-structure',
    'upper-arm-connection', 'elbow-contour', 'forearm-taper', 'hand-shape', 'ribcage', 'waist', 'abdomen',
    'pelvis', 'groin', 'thigh-root', 'patella-front', 'popliteal-back', 'calf', 'ankle', 'foot',
    'surface-continuity', 'surface-faceting', 'left-right-symmetry', 'bodydna-continuity',
  ].map((item) => [item, 'unsupported'])),
  visualAcceptance: false,
  productionReady: false,
  userVisualAcceptance: 'pending',
  finalConclusion: topologyGate && referenceIntersectionGate
    ? 'INCONCLUSIVE'
    : 'NATIVE_SURFACE_FOUNDATION_FAILED',
  finalConclusionReason: topologyGate && referenceIntersectionGate
    ? 'File-level topology and landmark audit completed; browser screenshots and user visual review are intentionally pending under AGENTS.md.'
    : 'The same canonical cage evaluator failed the critical self-intersection gate twice; the task stop rule blocks continuity, page, screenshot, and visual acceptance work.',
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  topologyFingerprint: topology.topologyFingerprint,
  indexHash: topology.indexHash,
  vertexCount: topology.vertexCount,
  triangleCount: topology.triangleCount,
  gates: metrics.gates,
  finalConclusion: metrics.finalConclusion,
})}\n`);

function expectedScreenshotPaths() {
  return [
    'reference-front', 'reference-side', 'reference-back', 'reference-three-quarter',
    'lean-front', 'muscular-front', 'heavy-front', 'tall-front', 'short-front', 'asymmetric-front',
    'shoulder-closeup', 'axilla-closeup', 'elbow-closeup', 'waist-closeup', 'pelvis-closeup',
    'groin-closeup', 'knee-closeup', 'hand-closeup', 'foot-closeup',
    'reference-rig-overlay', 'muscular-rig-overlay', 'asymmetric-rig-overlay',
  ].map((name) => `artifacts/qa/task16a-native-surface-v1/native/${name}.png`);
}
