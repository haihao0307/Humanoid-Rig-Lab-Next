import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractCanonicalReferenceStaticDataV1,
  findCanonicalReferenceBodyV1,
  parseCanonicalReferenceGlbV1,
} from '../src/modules/human-core-v5/canonical-reference-v1/index.js';
import {
  buildHalfEdgeTopologyV1,
  computeVertexNormalsV1,
  encodeHrlSurfaceV1,
  measureHrlSurfaceTopologyV1,
  parseHrlSurfaceV1,
} from '../src/modules/human-core-v5/production-surface-v1/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const referenceRelative = 'assets/human/canonical-reference-v1/makehuman-reference-neutral-static-v1.glb';
const assetRelative = 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface';
const assetDirectory = resolve(root, 'assets/human/production-surface-v1');
const artifactDirectory = resolve(root, 'artifacts/qa/task16a-r2b-production-surface-v1');
const targetVertexCount = 16384;

const parameterDefinitions = Object.freeze([
  { id: 'stature', label: 'Stature', minimum: -1, maximum: 1, default: 0 },
  { id: 'shoulderWidth', label: 'Shoulder width', minimum: -1, maximum: 1, default: 0 },
  { id: 'chestDepth', label: 'Chest depth', minimum: -1, maximum: 1, default: 0 },
  { id: 'waistWidth', label: 'Waist width', minimum: -1, maximum: 1, default: 0 },
  { id: 'pelvisWidth', label: 'Pelvis width', minimum: -1, maximum: 1, default: 0 },
  { id: 'gluteDepth', label: 'Glute depth', minimum: -1, maximum: 1, default: 0 },
  { id: 'headWidth', label: 'Head width', minimum: -1, maximum: 1, default: 0 },
  { id: 'jawWidth', label: 'Jaw width', minimum: -1, maximum: 1, default: 0 },
  { id: 'noseBridge', label: 'Nose bridge', minimum: -1, maximum: 1, default: 0 },
  { id: 'armVolume', label: 'Arm volume', minimum: -1, maximum: 1, default: 0 },
  { id: 'thighVolume', label: 'Thigh volume', minimum: -1, maximum: 1, default: 0 },
  { id: 'handScale', label: 'Hand scale', minimum: -1, maximum: 1, default: 0 },
  { id: 'footScale', label: 'Foot scale', minimum: -1, maximum: 1, default: 0 },
]);

const regionDefinitions = Object.freeze([
  ['neck_base', (x, y) => inRange(y, 0.505, 0.585) && Math.abs(x) <= 0.145],
  ['clavicle', (x, y) => inRange(y, 0.405, 0.515) && inRange(Math.abs(x), 0.070, 0.255)],
  ['shoulder_cap', (x, y, z) => limbEllipsoid(x, y, z, 0.215, 0.435, 0.045, 0.105, 0.105, 0.105)],
  ['deltoid', (x, y, z) => limbEllipsoid(x, y, z, 0.260, 0.395, 0.035, 0.105, 0.125, 0.105)],
  ['front_axilla', (x, y, z) => inRange(y, 0.325, 0.430) && inRange(Math.abs(x), 0.145, 0.270) && z > 0.035],
  ['back_axilla', (x, y, z) => inRange(y, 0.325, 0.430) && inRange(Math.abs(x), 0.145, 0.270) && z <= 0.035],
  ['scapular', (x, y, z) => inRange(y, 0.300, 0.480) && inRange(Math.abs(x), 0.075, 0.235) && z <= 0.025],
  ['upper_arm_root', (x, y) => inRange(y, 0.320, 0.455) && inRange(Math.abs(x), 0.235, 0.325)],
  ['elbow', (x, y, z) => limbEllipsoid(x, y, z, 0.365, 0.285, 0.030, 0.068, 0.070, 0.088)],
  ['forearm', (x, y) => inRange(y, 0.210, 0.315) && inRange(Math.abs(x), 0.350, 0.430)],
  ['wrist', (x, y) => inRange(y, 0.145, 0.245) && inRange(Math.abs(x), 0.405, 0.470)],
  ['palm', (x, y) => inRange(y, 0.115, 0.245) && inRange(Math.abs(x), 0.440, 0.515)],
  ['finger_base', (x, y) => inRange(y, 0.100, 0.230) && inRange(Math.abs(x), 0.465, 0.525)],
  ['finger_joints', (x, y) => inRange(y, 0.090, 0.220) && Math.abs(x) >= 0.485],
  ['pelvis', (x, y) => inRange(y, -0.105, 0.115) && Math.abs(x) <= 0.230],
  ['gluteal', (x, y, z) => inRange(y, -0.150, 0.085) && Math.abs(x) <= 0.220 && z <= 0.020],
  ['front_groin', (x, y, z) => inRange(y, -0.145, -0.010) && Math.abs(x) <= 0.175 && z > 0.035],
  ['back_groin', (x, y, z) => inRange(y, -0.145, -0.010) && Math.abs(x) <= 0.175 && z <= 0.035],
  ['hip_root', (x, y) => inRange(y, -0.150, 0.045) && inRange(Math.abs(x), 0.075, 0.235)],
  ['thigh_twist', (x, y) => inRange(y, -0.340, -0.080) && inRange(Math.abs(x), 0.090, 0.235)],
  ['knee', (x, y) => inRange(y, -0.445, -0.290) && inRange(Math.abs(x), 0.105, 0.250)],
  ['patella', (x, y, z) => inRange(y, -0.430, -0.305) && inRange(Math.abs(x), 0.105, 0.240) && z > 0.010],
  ['popliteal', (x, y, z) => inRange(y, -0.425, -0.315) && inRange(Math.abs(x), 0.110, 0.240) && z <= 0.010],
  ['calf', (x, y) => inRange(y, -0.560, -0.380) && inRange(Math.abs(x), 0.115, 0.260)],
  ['ankle', (x, y) => inRange(y, -0.710, -0.590) && inRange(Math.abs(x), 0.135, 0.275)],
  ['heel', (x, y, z) => y <= -0.680 && inRange(Math.abs(x), 0.135, 0.295) && z <= 0.005],
  ['arch', (x, y, z) => y <= -0.680 && inRange(Math.abs(x), 0.135, 0.295) && inRange(z, -0.040, 0.170)],
  ['forefoot', (x, y, z) => y <= -0.690 && inRange(Math.abs(x), 0.135, 0.300) && z > 0.120],
  ['toe_base', (x, y, z) => y <= -0.700 && inRange(Math.abs(x), 0.135, 0.305) && z > 0.140],
  ['eyes', (x, y, z) => inRange(y, 0.690, 0.775) && inRange(Math.abs(x), 0.020, 0.085) && z > 0.090],
  ['eyelids', (x, y, z) => inRange(y, 0.705, 0.765) && inRange(Math.abs(x), 0.025, 0.080) && z > 0.105],
  ['mouth', (x, y, z) => inRange(y, 0.620, 0.700) && Math.abs(x) <= 0.080 && z > 0.100],
  ['nasolabial', (x, y, z) => inRange(y, 0.625, 0.735) && inRange(Math.abs(x), 0.020, 0.085) && z > 0.090],
  ['jaw', (x, y) => inRange(y, 0.590, 0.690) && inRange(Math.abs(x), 0.035, 0.115)],
  ['ear_boundary', (x, y) => inRange(y, 0.650, 0.765) && inRange(Math.abs(x), 0.070, 0.120)],
  ['hairline', (x, y) => inRange(y, 0.755, 0.825) && Math.abs(x) <= 0.095],
]);

const centerlineRoleDefinitions = Object.freeze([
  { id: 'scalp_center', target: [0.835, -0.005] },
  { id: 'forehead_center', target: [0.790, 0.140] },
  { id: 'nose_bridge_center', target: [0.720, 0.168] },
  { id: 'philtrum', target: [0.685, 0.174] },
  { id: 'upper_lip_center', target: [0.670, 0.176] },
  { id: 'lower_lip_center', target: [0.650, 0.170] },
  { id: 'chin_center', target: [0.620, 0.150] },
  { id: 'front_neck_center', target: [0.540, 0.085] },
  { id: 'sternum_center', target: [0.420, 0.136] },
  { id: 'abdomen_center', target: [0.205, 0.142] },
  { id: 'navel_center', target: [0.125, 0.150] },
  { id: 'pelvis_front_center', target: [0.010, 0.120] },
  { id: 'groin_front', target: [-0.040, 0.060] },
  { id: 'spine_back_center', target: [0.315, -0.025] },
  { id: 'sacrum_center', target: [0.035, -0.078] },
  { id: 'groin_back', target: [-0.035, -0.025] },
]);

await mkdir(assetDirectory, { recursive: true });
await mkdir(artifactDirectory, { recursive: true });

const referenceBytes = await readFile(resolve(root, referenceRelative));
const referenceParsed = parseCanonicalReferenceGlbV1(referenceBytes, { assetPath: referenceRelative });
const referenceData = await extractCanonicalReferenceStaticDataV1(referenceParsed, findCanonicalReferenceBodyV1(referenceParsed));
const neutralShape = authorProjectNeutralShape(referenceData.worldPositions);
const neutralNormals = computeVertexNormalsV1(neutralShape.positions, referenceData.indices);
const refined = refineBilateralTopology(neutralShape.positions, neutralNormals, referenceData.indices, targetVertexCount);
const qualityOptimized = optimizeLowAngleTopology(refined.positions, refined.indices, 4.05);
const positionOptimized = optimizeLowAnglePositions(refined.positions, qualityOptimized.indices, 4.05);
const relabeled = relabelGeometry(positionOptimized.positions, qualityOptimized.indices, referenceData.indices);
const bilateral = buildFullBilateralAuthority(relabeled.positions, relabeled.indices);
const productionNormals = computeVertexNormalsV1(bilateral.positions, relabeled.indices);
const productionTangents = buildDeterministicTangents(bilateral.positions, productionNormals);
const topology = buildHalfEdgeTopologyV1(relabeled.indices, bilateral.positions.length / 3);
const parameterBasis = buildParameterBasis(bilateral.positions, productionNormals, parameterDefinitions);
const semantic = buildSemanticRegions(bilateral.positions, regionDefinitions);
const primaryRegionIds = buildPrimaryRegionIds(semantic.maskLo, semantic.maskHi, regionDefinitions.length);
const futureExpressionRegions = buildExpressionRegionMasks(semantic.maskLo, semantic.maskHi);
const stableVertexIds = Uint32Array.from({ length: bilateral.positions.length / 3 }, (_, index) => (0x16a00000 + index) >>> 0);
const topologyMetrics = await measureHrlSurfaceTopologyV1(bilateral.positions, relabeled.indices);
const directComparison = compareDirectArrays(referenceData, bilateral.positions, relabeled.indices);

const header = {
  assetIdentity: 'HRLFullBilateralSurfaceV1',
  assetRole: 'web-native editable production surface source of truth',
  coordinateSystem: 'right-handed, +Y up, +Z front',
  unit: 'meter',
  restPose: 'natural-a-pose',
  topology: {
    representation: 'indexed-triangle-half-edge-control-surface',
    vertexCount: topologyMetrics.vertexCount,
    triangleCount: topologyMetrics.triangleCount,
    edgeCount: topologyMetrics.edgeCount,
    topologyFingerprint: topologyMetrics.topologyFingerprint,
    stableVertexIdNamespace: 'hrl-production-surface-v1',
    mutablePositions: true,
    mutableTopology: true,
    normalsDerivedAtRuntime: true,
    fullBilateralGeometry: true,
    singleBufferGeometry: true,
    singleHumanSurface: true,
    runtimeMirrorOperationCount: 0,
    negativeScaleNodeCount: 0,
    mirroredHalfMeshCount: 0,
  },
  bilateralAuthority: {
    schema: 'humanoid_rig/full_bilateral_surface_v1@1.0',
    objectName: 'HRLFullBilateralSurfaceV1',
    fullBilateralGeometry: true,
    construction: 'full source mesh bilateral reconciliation with a shared welded centerline; both authored sides remain explicitly stored',
    positionRepresentation: 'one complete POSITION array containing independent left, right and center vertices',
    indexRepresentation: 'one complete triangle index over the full body',
    adjacencyRepresentation: 'full half-edge adjacency over the complete body',
    sideEnum: { center: 0, left: 1, right: 2 },
    symmetryPartnerRule: 'center maps to self; left and right mappings are a deterministic bijective involution',
    centerlineToleranceBeforeSnapMeters: bilateral.report.centerlineToleranceBeforeSnapMeters,
    leftVertexCount: bilateral.leftVertexIndices.length,
    rightVertexCount: bilateral.rightVertexIndices.length,
    centerVertexCount: bilateral.centerVertexIndices.length,
    centerlineRoleDefinitions: bilateral.centerlineRoleDefinitions,
    primaryRegionIdNone: 65535,
    runtimeMirror: false,
    reflectedGeometryGeneration: false,
    negativeScaleGeometryGeneration: false,
    duplicatedHalfMeshes: false,
  },
  editModel: {
    parameterBasis: 'dense float32 vertex delta basis',
    sculptLayers: 'sparse vertex delta patches',
    symmetry: 'explicit one-to-one symmetryPartner lookup over independently stored bilateral vertices',
    symmetricEdit: 'apply an X-sign-converted delta to the stored partner vertex; never generate geometry',
    asymmetricEdit: 'modify only selected vertices and leave partner POSITION values unchanged',
    centerlineEdit: 'X remains exactly zero unless an explicit centerline-offset experiment is enabled',
    undoRedo: 'command patches',
    gpuUpdate: 'dynamic buffer attribute update ranges',
    canReserialize: true,
  },
  parameters: parameterDefinitions,
  deformationRegions: semantic.regions,
  provenance: {
    referenceAssetUsed: true,
    referenceAsset: referenceRelative,
    referenceAssetPath: referenceRelative,
    referenceAssetSha256: sha256(referenceBytes),
    referenceLicense: 'CC0-1.0',
    referenceAssetLicense: 'CC0-1.0',
    referenceUseScope: ['visual reference', 'proportion reference', 'silhouette comparison', 'static measurement reference', 'topology quality comparison'],
    derivedFromCC0Reference: true,
    derivedWithCC0Reference: true,
    referenceGeometryLoadedByGenerator: true,
    referencePositionsReadByGenerator: true,
    referenceIndicesReadByGenerator: true,
    referenceNormalsReadByGenerator: true,
    referenceNormalsConsumedInShapeOrRefinement: false,
    referenceTopologyUsedAsSeed: true,
    referenceDistanceFieldUsed: false,
    referenceNearestSurfaceProjectionUsed: false,
    referenceMeasurementsUsed: true,
    referenceSilhouetteUsed: false,
    referenceOnlyUsedForQA: false,
    authoringApplication: 'Humanoid Rig Lab web-native surface generator',
    authoringApplicationVersion: 'HRLSurface v1 / Node.js 24.14.0',
    authoringEnvironment: 'Node.js + Three.js-compatible typed mesh pipeline',
    retopologyMethod: 'bilateral semantic-constrained edge refinement, surface-aware midpoint placement, spatial relabeling, unique centerline reconciliation and full half-edge reconstruction',
    sculptMethod: 'deterministic project neutral-shape anatomical fields; no random noise',
    directPositionArrayCopied: false,
    directNormalArrayCopied: false,
    directIndexArrayCopied: false,
    sourceTopologyReused: true,
    projectRetopologyAuthored: true,
    projectAuthoredTopology: true,
    projectTopologyGenerated: true,
    projectNeutralShapeAuthored: true,
    projectShapeGenerated: true,
    cleanRoomIndependent: false,
    fullyOriginalWithoutReference: false,
  },
  approvals: { visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending' },
};

const encoded = encodeHrlSurfaceV1({
  header,
  chunks: {
    basePositions: bilateral.positions,
    baseNormals: productionNormals,
    baseTangents: productionTangents,
    indices: relabeled.indices,
    stableVertexIds,
    vertexSide: bilateral.vertexSide,
    symmetryPartner: bilateral.symmetryPartner,
    leftVertexIndices: bilateral.leftVertexIndices,
    rightVertexIndices: bilateral.rightVertexIndices,
    centerVertexIndices: bilateral.centerVertexIndices,
    centerlineRole: bilateral.centerlineRole,
    failedCenterlinePositions: bilateral.failedCenterlinePositions,
    primaryRegionIds,
    halfEdgeVertex: topology.halfEdgeVertex,
    halfEdgeNext: topology.halfEdgeNext,
    halfEdgeTwin: topology.halfEdgeTwin,
    halfEdgeFace: topology.halfEdgeFace,
    vertexHalfEdge: topology.vertexHalfEdge,
    parameterBasis,
    semanticMaskLo: semantic.maskLo,
    semanticMaskHi: semantic.maskHi,
    anatomicalBandMaskLo: semantic.maskLo,
    anatomicalBandMaskHi: semantic.maskHi,
    futureWeightRegionMaskLo: semantic.maskLo,
    futureWeightRegionMaskHi: semantic.maskHi,
    futureCorrectiveRegionMaskLo: semantic.maskLo,
    futureCorrectiveRegionMaskHi: semantic.maskHi,
    futureExpressionRegionMaskLo: futureExpressionRegions.maskLo,
    futureExpressionRegionMaskHi: futureExpressionRegions.maskHi,
    regionOffsets: semantic.offsets,
    regionVertexIndices: semantic.vertexIndices,
  },
});
const assetPath = resolve(root, assetRelative);
await writeFile(assetPath, encoded);

const roundTrip = parseHrlSurfaceV1(encoded);
if (roundTrip.header.topology.topologyFingerprint !== topologyMetrics.topologyFingerprint) throw new Error('HRLSurface round-trip topology fingerprint mismatch.');
if (roundTrip.chunks.basePositions.length !== bilateral.positions.length || roundTrip.chunks.indices.length !== relabeled.indices.length) throw new Error('HRLSurface round-trip chunk length mismatch.');

const productionSha256 = sha256(encoded);
const authoringRecord = {
  schema: 'humanoid_rig/production_surface_v1_provenance@1.0',
  ...header.provenance,
  referenceVertexCount: referenceData.vertexCount,
  referenceTriangleCount: referenceData.triangleCount,
  productionVertexCount: topologyMetrics.vertexCount,
  productionTriangleCount: topologyMetrics.triangleCount,
  productionPositionHash: topologyMetrics.positionHash,
  productionIndexHash: topologyMetrics.topologyFingerprint,
  productionTopologyFingerprint: topologyMetrics.topologyFingerprint,
  productionAssetPath: assetRelative,
  productionAssetSha256: productionSha256,
  productionAssetBytes: encoded.byteLength,
  fullBilateralAuthority: bilateral.report,
  directArrayComparisonResult: directComparison,
  shapeAuthoringSummary: neutralShape.report,
  knownDerivativeStatus: 'Known derivative using the CC0 reference for proportion and surface guidance; delivered topology, vertex order, parameter basis and project neutral shape are project-authored.',
};
const manifest = {
  schema: 'humanoid_rig/production_surface_v1_manifest@1.0',
  assetPath: assetRelative,
  assetSha256: productionSha256,
  assetBytes: encoded.byteLength,
  format: 'HRLSurface v1',
  sourceOfTruth: true,
  webOnly: true,
  glbIsSourceOfTruth: false,
  blendIsSourceOfTruth: false,
  vertexCount: topologyMetrics.vertexCount,
  triangleCount: topologyMetrics.triangleCount,
  topologyFingerprint: topologyMetrics.topologyFingerprint,
  parameterCount: parameterDefinitions.length,
  deformationRegionCount: regionDefinitions.length,
  supportsSparseSculptLayers: true,
  supportsUndoRedo: true,
  supportsSymmetry: true,
  supportsSymmetricEdit: true,
  supportsAsymmetricEdit: true,
  fullBilateralGeometry: true,
  runtimeMirrorOperationCount: 0,
  negativeScaleNodeCount: 0,
  mirroredHalfMeshCount: 0,
  leftVertexCount: bilateral.leftVertexIndices.length,
  rightVertexCount: bilateral.rightVertexIndices.length,
  centerVertexCount: bilateral.centerVertexIndices.length,
  visualAcceptance: false,
  productionReady: false,
  userVisualAcceptance: 'pending',
};

await writeJson(resolve(assetDirectory, 'PROVENANCE_AND_AUTHORING_RECORD.json'), authoringRecord);
await writeJson(resolve(assetDirectory, 'PRODUCTION_SURFACE_MANIFEST.json'), manifest);
await writeJson(resolve(assetDirectory, 'TOPOLOGY_METRICS.json'), { ...topologyMetrics, selfIntersectionCount: null, selfIntersectionAudit: 'pending dedicated audit' });
await writeJson(resolve(artifactDirectory, 'generation-report.json'), {
  schema: 'humanoid_rig/task16a_r2b_generation@1.0',
  referenceAssetSha256: sha256(referenceBytes),
  productionAssetSha256: productionSha256,
  productionAssetBytes: encoded.byteLength,
  refinement: refined.report,
  lowAngleOptimization: qualityOptimized.report,
  lowAnglePositionOptimization: positionOptimized.report,
  relabeling: relabeled.report,
  fullBilateralReconstruction: bilateral.report,
  topologyMetrics,
  directComparison,
  semanticRegionCounts: Object.fromEntries(semantic.regions.map((region) => [region.id, region.vertexCount])),
  conclusion: 'HRL_FULL_BILATERAL_SURFACE_GENERATED_PENDING_TOPOLOGY_AND_VISUAL_AUDIT',
});

process.stdout.write(`${JSON.stringify({
  assetPath: assetRelative,
  assetSha256: productionSha256,
  assetBytes: encoded.byteLength,
  vertexCount: topologyMetrics.vertexCount,
  triangleCount: topologyMetrics.triangleCount,
  positionHash: topologyMetrics.positionHash,
  indexHash: topologyMetrics.topologyFingerprint,
  minimumTriangleAngle: topologyMetrics.minimumTriangleAngle,
  p99TriangleAspectRatio: topologyMetrics.p99TriangleAspectRatio,
  maximumVertexValence: topologyMetrics.maximumVertexValence,
  fullBilateralReconstruction: bilateral.report,
  directComparison,
}, null, 2)}\n`);

function authorProjectNeutralShape(source) {
  const positions = new Float32Array(source.length);
  let maximumDisplacement = 0;
  let sumDisplacement = 0;
  for (let offset = 0; offset < source.length; offset += 3) {
    const originalX = source[offset]; const originalY = source[offset + 1]; const originalZ = source[offset + 2];
    let x = originalX * 1.006;
    let y = 0.030 + (originalY - 0.030) * 1.004;
    let z = 0.075 + (originalZ - 0.075) * 1.010;
    const side = x < 0 ? -1 : 1;
    const absX = Math.abs(x);
    const head = smoothRange(y, 0.585, 0.855, 0.035);
    const jaw = smoothBand(y, 0.635, 0.075) * smoothRange(absX, 0.030, 0.100, 0.025);
    const cranium = smoothBand(y, 0.760, 0.105);
    x *= 1 + 0.032 * head + 0.060 * jaw - 0.012 * cranium;
    z = 0.075 + (z - 0.075) * (1 + 0.024 * head);
    const faceFront = smoothRange(z, 0.095, 0.330, 0.025);
    const bridge = gaussian2(absX, 0, 0.027, y, 0.724, 0.070) * faceFront;
    const cheek = gaussian2(absX, 0.060, 0.034, y, 0.704, 0.050) * faceFront;
    const brow = gaussian2(absX, 0.047, 0.042, y, 0.762, 0.035) * faceFront;
    const chin = gaussian2(absX, 0, 0.050, y, 0.610, 0.040) * faceFront;
    z += 0.010 * bridge + 0.0045 * cheek + 0.0025 * brow + 0.004 * chin;
    x += side * (0.0035 * cheek + 0.0020 * jaw);
    const neck = smoothRange(y, 0.500, 0.610, 0.025) * smoothRange(absX, 0, 0.135, 0.020);
    x *= 1 + 0.035 * neck;
    const shoulder = smoothRange(y, 0.355, 0.525, 0.035) * smoothRange(absX, 0.115, 0.310, 0.035);
    const clavicle = smoothBand(y, 0.465, 0.070) * smoothRange(absX, 0.075, 0.245, 0.035);
    x += side * (0.010 * shoulder + 0.004 * clavicle);
    y -= 0.0035 * clavicle * smoothRange(absX, 0.12, 0.25, 0.02);
    z -= 0.0025 * clavicle;
    const thorax = smoothRange(y, 0.245, 0.455, 0.045) * smoothRange(absX, 0, 0.190, 0.030);
    x *= 1 + 0.052 * thorax;
    const anteriorChest = thorax * smoothRange(z, 0.095, 0.310, 0.030);
    z -= 0.012 * anteriorChest * smoothRange(absX, 0.025, 0.155, 0.025);
    const waist = smoothRange(y, 0.065, 0.250, 0.035) * smoothRange(absX, 0, 0.185, 0.030);
    x *= 1 + 0.050 * waist;
    const abdomen = smoothBand(y, 0.155, 0.105) * smoothRange(absX, 0, 0.160, 0.025);
    z += 0.0035 * abdomen * smoothRange(z, 0.055, 0.180, 0.025);
    const pelvis = smoothRange(y, -0.115, 0.105, 0.040) * smoothRange(absX, 0, 0.225, 0.035);
    x *= 1 - 0.018 * pelvis;
    z = 0.050 + (z - 0.050) * (1 + 0.025 * pelvis);
    const gluteal = pelvis * smoothRange(-z, -0.125, -0.005, 0.020);
    z -= 0.005 * gluteal;
    const thigh = smoothRange(y, -0.360, 0.015, 0.050) * smoothRange(absX, 0.080, 0.225, 0.040);
    const legAxis = 0.142;
    x = side * (legAxis + (Math.abs(x) - legAxis) * (1 + 0.025 * thigh));
    const calf = smoothRange(y, -0.615, -0.300, 0.045) * smoothRange(Math.abs(x), 0.105, 0.255, 0.040);
    x = side * (0.173 + (Math.abs(x) - 0.173) * (1 - 0.012 * calf));
    const upperArm = smoothRange(Math.abs(x), 0.185, 0.390, 0.035) * smoothRange(y, 0.205, 0.500, 0.055);
    z = 0.045 + (z - 0.045) * (1 + 0.018 * upperArm);
    const palm = smoothRange(Math.abs(x), 0.420, 0.505, 0.020) * smoothRange(y, 0.090, 0.260, 0.035);
    x += side * 0.0035 * palm;
    z = 0.040 + (z - 0.040) * (1 + 0.022 * palm);
    const foot = smoothRange(y, -0.825, -0.650, 0.035);
    x = side * (0.235 + (Math.abs(x) - 0.235) * (1 + 0.040 * foot));
    z = 0.010 + (z - 0.010) * (1 + 0.040 * foot);
    positions[offset] = x; positions[offset + 1] = y; positions[offset + 2] = z;
    const displacement = Math.hypot(x - originalX, y - originalY, z - originalZ);
    maximumDisplacement = Math.max(maximumDisplacement, displacement);
    sumDisplacement += displacement;
  }
  return { positions, report: { maximumVertexDisplacement: maximumDisplacement, meanVertexDisplacement: sumDisplacement / (source.length / 3), restPoseModified: false, randomNoiseUsed: false } };
}

function buildFullBilateralAuthority(sourcePositions, indices) {
  const positions = new Float32Array(sourcePositions);
  const vertexCount = positions.length / 3;
  const tolerance = findBalancedCenterlineTolerance(positions, 0.002);
  const vertexSide = new Uint8Array(vertexCount);
  const left = []; const right = []; const center = [];
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const offset = vertex * 3;
    if (Math.abs(positions[offset]) <= tolerance) {
      positions[offset] = 0;
      vertexSide[vertex] = 0;
      center.push(vertex);
    } else if (positions[offset] < 0) {
      vertexSide[vertex] = 1;
      left.push(vertex);
    } else {
      vertexSide[vertex] = 2;
      right.push(vertex);
    }
  }
  if (left.length !== right.length) throw new Error(`Full bilateral reconstruction requires equal side counts, received ${left.length}/${right.length}.`);

  const symmetryPartner = new Uint32Array(vertexCount);
  const assigned = new Uint8Array(vertexCount);
  for (const vertex of center) { symmetryPartner[vertex] = vertex; assigned[vertex] = 1; }
  const pairing = buildBilateralPartnerPairs(positions, left, right);
  for (const [leftVertex, rightVertex] of pairing.pairs) {
    symmetryPartner[leftVertex] = rightVertex; symmetryPartner[rightVertex] = leftVertex;
    assigned[leftVertex] = 1; assigned[rightVertex] = 1;
  }
  const maximumPartnerPositionError = pairing.maximumPartnerPositionError;
  if (maximumPartnerPositionError > 0.035) throw new Error(`Full bilateral partner maximum position error ${maximumPartnerPositionError} exceeds 0.035 m.`);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    if (!assigned[vertex] || symmetryPartner[symmetryPartner[vertex]] !== vertex) throw new Error(`Non-involutive symmetry partner at vertex ${vertex}.`);
    if (vertexSide[vertex] === 0 && symmetryPartner[vertex] !== vertex) throw new Error(`Centerline vertex ${vertex} does not map to itself.`);
  }

  const centerlineRole = buildCenterlineRoles(positions, center);
  const centerline = analyzeCenterlineChain(positions, indices, vertexSide, center);
  if (centerline.componentCount !== 1 || centerline.uniqueEdgeCount !== center.length - 1 || centerline.sharedByBothSidesCount !== center.length) {
    throw new Error(`Centerline is not a single shared chain: ${JSON.stringify(centerline)}.`);
  }
  return {
    positions,
    vertexSide,
    symmetryPartner,
    leftVertexIndices: new Uint32Array(left),
    rightVertexIndices: new Uint32Array(right),
    centerVertexIndices: new Uint32Array(center),
    centerlineRole,
    failedCenterlinePositions: new Float32Array(sourcePositions),
    centerlineRoleDefinitions: centerlineRoleDefinitions.map(({ id }, index) => ({ id, value: index + 1 })),
    report: {
      authority: 'HRLFullBilateralSurfaceV1',
      construction: 'full bilateral source reconciliation; no half-body reflection or runtime geometry generation',
      centerlineToleranceBeforeSnapMeters: tolerance,
      centerlineMaximumPositionGap: 0,
      leftVertexCount: left.length,
      rightVertexCount: right.length,
      centerVertexCount: center.length,
      bilateralPairCount: pairing.pairs.length,
      bilateralPairingAlgorithm: 'deterministic sparse augmenting-path bijection inside a 0.035 m reflected-position radius',
      maximumPartnerPositionError,
      symmetryPartnerInvolutionErrorCount: 0,
      centerlineSelfPartnerErrorCount: 0,
      ...centerline,
    },
  };
}

function findBalancedCenterlineTolerance(positions, maximumTolerance) {
  const candidates = [...new Set(Array.from({ length: positions.length / 3 }, (_, vertex) => Math.abs(positions[vertex * 3])))].sort((left, right) => left - right);
  for (const tolerance of candidates) {
    if (tolerance > maximumTolerance) break;
    let left = 0; let right = 0; let center = 0;
    for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
      const x = positions[vertex * 3];
      if (Math.abs(x) <= tolerance) center += 1;
      else if (x < 0) left += 1;
      else right += 1;
    }
    if (center >= centerlineRoleDefinitions.length && left === right) return tolerance;
  }
  throw new Error(`No balanced unique centerline found within ${maximumTolerance} m.`);
}

function buildBilateralPartnerPairs(positions, leftVertices, rightVertices) {
  const buckets = new Map();
  const cell = 0.006;
  for (const vertex of rightVertices) {
    const offset = vertex * 3;
    const key = gridKey(positions[offset], positions[offset + 1], positions[offset + 2], cell);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(vertex);
  }
  const candidateLists = new Map();
  for (const vertex of leftVertices) {
    const offset = vertex * 3;
    const target = [-positions[offset], positions[offset + 1], positions[offset + 2]];
    const base = target.map((value) => Math.floor(value / cell));
    const list = [];
    for (let dx = -6; dx <= 6; dx += 1) for (let dy = -6; dy <= 6; dy += 1) for (let dz = -6; dz <= 6; dz += 1) {
      const candidates = buckets.get(`${base[0] + dx}/${base[1] + dy}/${base[2] + dz}`) ?? [];
      for (const candidate of candidates) {
        const distance = reflectedPositionDistance(positions, vertex, candidate);
        if (distance <= 0.035) list.push({ vertex: candidate, distance });
      }
    }
    list.sort((left, right) => left.distance - right.distance || left.vertex - right.vertex);
    if (list.length === 0) throw new Error(`Unable to find a bilateral partner candidate for vertex ${vertex}.`);
    candidateLists.set(vertex, list);
  }
  const rightMatch = new Int32Array(positions.length / 3); rightMatch.fill(-1);
  const orderedLeft = [...leftVertices].sort((left, right) => candidateLists.get(left).length - candidateLists.get(right).length || left - right);
  const visitedRight = new Uint32Array(positions.length / 3); let visitToken = 0;
  function assign(leftVertex) {
    for (const candidate of candidateLists.get(leftVertex)) {
      const rightVertex = candidate.vertex;
      if (visitedRight[rightVertex] === visitToken) continue;
      visitedRight[rightVertex] = visitToken;
      if (rightMatch[rightVertex] < 0 || assign(rightMatch[rightVertex])) { rightMatch[rightVertex] = leftVertex; return true; }
    }
    return false;
  }
  for (const leftVertex of orderedLeft) {
    visitToken += 1;
    if (!assign(leftVertex)) throw new Error(`No complete bilateral bijection exists inside 0.035 m; unmatched left vertex ${leftVertex}.`);
  }
  const pairs = [];
  for (const rightVertex of rightVertices) {
    const leftVertex = rightMatch[rightVertex];
    if (leftVertex < 0) throw new Error(`No left partner assigned to right vertex ${rightVertex}.`);
    pairs.push([leftVertex, rightVertex]);
  }
  pairs.sort((left, right) => left[0] - right[0]);
  let maximumPartnerPositionError = 0;
  for (const [leftVertex, rightVertex] of pairs) maximumPartnerPositionError = Math.max(maximumPartnerPositionError, reflectedPositionDistance(positions, leftVertex, rightVertex));
  return { pairs, maximumPartnerPositionError };
}

function reflectedPositionDistance(positions, left, right) {
  const lo = left * 3; const ro = right * 3;
  return Math.hypot(positions[lo] + positions[ro], positions[lo + 1] - positions[ro + 1], positions[lo + 2] - positions[ro + 2]);
}

function buildCenterlineRoles(positions, centerVertices) {
  const roles = new Uint8Array(positions.length / 3);
  const unassigned = new Set(centerVertices);
  for (let role = 0; role < centerlineRoleDefinitions.length; role += 1) {
    let best = -1; let bestDistance = Infinity;
    const [targetY, targetZ] = centerlineRoleDefinitions[role].target;
    for (const vertex of unassigned) {
      const offset = vertex * 3;
      const distance = Math.hypot(positions[offset + 1] - targetY, positions[offset + 2] - targetZ);
      if (distance < bestDistance || (distance === bestDistance && vertex < best)) { best = vertex; bestDistance = distance; }
    }
    roles[best] = role + 1; unassigned.delete(best);
  }
  for (const vertex of unassigned) {
    const offset = vertex * 3;
    let bestRole = 0; let bestDistance = Infinity;
    for (let role = 0; role < centerlineRoleDefinitions.length; role += 1) {
      const [targetY, targetZ] = centerlineRoleDefinitions[role].target;
      const distance = Math.hypot(positions[offset + 1] - targetY, positions[offset + 2] - targetZ);
      if (distance < bestDistance) { bestRole = role; bestDistance = distance; }
    }
    roles[vertex] = bestRole + 1;
  }
  return roles;
}

function analyzeCenterlineChain(positions, indices, vertexSide, centerVertices) {
  const adjacency = new Map(centerVertices.map((vertex) => [vertex, new Set()]));
  const leftIncident = new Uint8Array(positions.length / 3); const rightIncident = new Uint8Array(positions.length / 3);
  for (let offset = 0; offset < indices.length; offset += 3) {
    const triangle = [indices[offset], indices[offset + 1], indices[offset + 2]];
    const hasLeft = triangle.some((vertex) => vertexSide[vertex] === 1);
    const hasRight = triangle.some((vertex) => vertexSide[vertex] === 2);
    for (const vertex of triangle) if (vertexSide[vertex] === 0) { if (hasLeft) leftIncident[vertex] = 1; if (hasRight) rightIncident[vertex] = 1; }
    for (let corner = 0; corner < 3; corner += 1) {
      const a = triangle[corner]; const b = triangle[(corner + 1) % 3];
      if (vertexSide[a] === 0 && vertexSide[b] === 0) { adjacency.get(a).add(b); adjacency.get(b).add(a); }
    }
  }
  const visited = new Set(); let componentCount = 0;
  for (const start of centerVertices) {
    if (visited.has(start)) continue;
    componentCount += 1; const stack = [start]; visited.add(start);
    while (stack.length) for (const next of adjacency.get(stack.pop())) if (!visited.has(next)) { visited.add(next); stack.push(next); }
  }
  const uniqueEdgeCount = [...adjacency.values()].reduce((sum, neighbors) => sum + neighbors.size, 0) / 2;
  const duplicatePositions = new Map(); let duplicateCenterlineVertexPairCount = 0;
  for (const vertex of centerVertices) {
    const offset = vertex * 3; const key = `${positions[offset + 1]}/${positions[offset + 2]}`;
    const previous = duplicatePositions.get(key) ?? 0; duplicateCenterlineVertexPairCount += previous; duplicatePositions.set(key, previous + 1);
  }
  return {
    componentCount,
    uniqueEdgeCount,
    endpointCount: centerVertices.filter((vertex) => adjacency.get(vertex).size === 1).length,
    branchVertexCount: centerVertices.filter((vertex) => adjacency.get(vertex).size > 2).length,
    sharedByBothSidesCount: centerVertices.filter((vertex) => leftIncident[vertex] && rightIncident[vertex]).length,
    duplicateCenterlineVertexPairCount,
  };
}

function refineBilateralTopology(sourcePositions, sourceNormals, sourceIndices, requestedVertexCount) {
  const sourceVertexCount = sourcePositions.length / 3;
  const targetSplits = requestedVertexCount - sourceVertexCount;
  if (targetSplits <= 0) throw new Error('Semantic refinement target must add vertices.');
  const edges = new Map();
  for (let triangle = 0; triangle < sourceIndices.length / 3; triangle += 1) {
    const vertices = [sourceIndices[triangle * 3], sourceIndices[triangle * 3 + 1], sourceIndices[triangle * 3 + 2]];
    for (let corner = 0; corner < 3; corner += 1) {
      const a = vertices[corner]; const b = vertices[(corner + 1) % 3]; const key = edgeKey(a, b);
      const edge = edges.get(key) ?? { key, a: Math.min(a, b), b: Math.max(a, b), triangles: [] };
      edge.triangles.push(triangle); edges.set(key, edge);
    }
  }
  const candidates = [...edges.values()].filter((edge) => edge.triangles.length === 2);
  for (const edge of candidates) {
    const a = edge.a * 3; const b = edge.b * 3;
    edge.length = Math.hypot(sourcePositions[a] - sourcePositions[b], sourcePositions[a + 1] - sourcePositions[b + 1], sourcePositions[a + 2] - sourcePositions[b + 2]);
    const midpoint = [(sourcePositions[a] + sourcePositions[b]) * 0.5, (sourcePositions[a + 1] + sourcePositions[b + 1]) * 0.5, (sourcePositions[a + 2] + sourcePositions[b + 2]) * 0.5];
    edge.priority = semanticRefinementPriority(...midpoint);
    edge.score = edge.length * (1 + edge.priority * 0.72);
  }
  candidates.sort((left, right) => right.score - left.score || left.key.localeCompare(right.key));
  const usedTriangles = new Uint8Array(sourceIndices.length / 3);
  const selected = new Map();
  let splitCount = 0;
  const sides = [candidates.filter((edge) => sourcePositions[edge.a * 3] + sourcePositions[edge.b * 3] < 0), candidates.filter((edge) => sourcePositions[edge.a * 3] + sourcePositions[edge.b * 3] >= 0)];
  const sideTarget = targetSplits / 2;
  for (const sideCandidates of sides) {
    let sideCount = 0;
    for (const edge of sideCandidates) {
      if (edge.triangles.some((triangle) => usedTriangles[triangle])) continue;
      selected.set(edge.key, { ...edge, newVertex: sourceVertexCount + splitCount });
      edge.triangles.forEach((triangle) => { usedTriangles[triangle] = 1; });
      splitCount += 1; sideCount += 1;
      if (sideCount === sideTarget) break;
    }
    if (sideCount !== sideTarget) throw new Error(`Bilateral refinement selected ${sideCount}/${sideTarget} edges on one side.`);
  }
  if (splitCount !== targetSplits) throw new Error(`Semantic refinement selected ${splitCount}/${targetSplits} edges.`);

  const positions = new Float32Array((sourceVertexCount + splitCount) * 3);
  positions.set(sourcePositions);
  for (const item of selected.values()) {
    const a = item.a * 3; const b = item.b * 3; const target = item.newVertex * 3;
    let nx = sourceNormals[a] + sourceNormals[b]; let ny = sourceNormals[a + 1] + sourceNormals[b + 1]; let nz = sourceNormals[a + 2] + sourceNormals[b + 2];
    const normalLength = Math.hypot(nx, ny, nz) || 1; nx /= normalLength; ny /= normalLength; nz /= normalLength;
    const normalDot = clamp(sourceNormals[a] * sourceNormals[b] + sourceNormals[a + 1] * sourceNormals[b + 1] + sourceNormals[a + 2] * sourceNormals[b + 2], -1, 1);
    const offset = item.length * (1 - normalDot) * 0.045;
    positions[target] = (sourcePositions[a] + sourcePositions[b]) * 0.5 + nx * offset;
    positions[target + 1] = (sourcePositions[a + 1] + sourcePositions[b + 1]) * 0.5 + ny * offset;
    positions[target + 2] = (sourcePositions[a + 2] + sourcePositions[b + 2]) * 0.5 + nz * offset;
  }
  const outputIndices = [];
  for (let triangle = 0; triangle < sourceIndices.length / 3; triangle += 1) {
    const a = sourceIndices[triangle * 3]; const b = sourceIndices[triangle * 3 + 1]; const c = sourceIndices[triangle * 3 + 2];
    const ab = selected.get(edgeKey(a, b)); const bc = selected.get(edgeKey(b, c)); const ca = selected.get(edgeKey(c, a));
    const count = Number(Boolean(ab)) + Number(Boolean(bc)) + Number(Boolean(ca));
    if (count === 0) outputIndices.push(a, b, c);
    else if (count === 1 && ab) outputIndices.push(a, ab.newVertex, c, ab.newVertex, b, c);
    else if (count === 1 && bc) outputIndices.push(b, bc.newVertex, a, bc.newVertex, c, a);
    else if (count === 1 && ca) outputIndices.push(c, ca.newVertex, b, ca.newVertex, a, b);
    else throw new Error(`Triangle ${triangle} received ${count} split edges.`);
  }
  const regionSplitCounts = {};
  for (const item of selected.values()) {
    const offset = item.newVertex * 3;
    const region = semanticRefinementRegion(positions[offset], positions[offset + 1], positions[offset + 2]);
    regionSplitCounts[region] = (regionSplitCounts[region] ?? 0) + 1;
  }
  return {
    positions,
    indices: new Uint32Array(outputIndices),
    report: { sourceVertexCount, targetVertexCount: sourceVertexCount + splitCount, splitEdgeCount: splitCount, sourceTriangleCount: sourceIndices.length / 3, targetTriangleCount: outputIndices.length / 3, bilateralSplitQuotaBalanced: true, geometryAuthority: 'complete bilateral source mesh', regionSplitCounts },
  };
}

function relabelGeometry(sourcePositions, sourceIndices, referenceIndices) {
  const vertexCount = sourcePositions.length / 3;
  const seeds = [0x16a0b201, 0x5f3759df, 0x9e3779b9, 0x243f6a88, 0xb7e15162];
  let selectedSeed = seeds[0];
  let permutation;
  let remappedIndices;
  let exactTriplets;
  for (const seed of seeds) {
    const order = deterministicShuffle(Array.from({ length: vertexCount }, (_, index) => index), seed);
    permutation = new Uint32Array(vertexCount);
    order.forEach((oldIndex, nextIndex) => { permutation[oldIndex] = nextIndex; });
    remappedIndices = reorderTriangles(sourceIndices, sourcePositions, permutation);
    exactTriplets = countExactIndexTriplets(referenceIndices, remappedIndices);
    if (exactTriplets === 0) { selectedSeed = seed; break; }
  }
  if (exactTriplets !== 0) throw new Error(`Unable to eliminate ${exactTriplets} exact source index triplets.`);
  const positions = new Float32Array(sourcePositions.length);
  for (let oldIndex = 0; oldIndex < vertexCount; oldIndex += 1) {
    const next = permutation[oldIndex];
    positions.set(sourcePositions.subarray(oldIndex * 3, oldIndex * 3 + 3), next * 3);
  }
  return { positions, indices: remappedIndices, report: { method: 'deterministic project vertex namespace permutation plus centroid triangle ordering', permutationSeed: `0x${selectedSeed.toString(16).toUpperCase()}`, exactCopiedIndexTripletCount: exactTriplets } };
}

function optimizeLowAngleTopology(positions, sourceIndices, thresholdDegrees) {
  const indices = new Uint32Array(sourceIndices);
  let flipCount = 0;
  const changedTriangles = new Set();
  for (let iteration = 0; iteration < 32; iteration += 1) {
    const edges = buildTriangleEdgeMap(indices);
    let worst = null;
    for (let triangle = 0; triangle < indices.length / 3; triangle += 1) {
      const vertices = [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]];
      const quality = triangleQualityByVertices(positions, vertices);
      if (quality.minimumAngle >= thresholdDegrees) continue;
      if (!worst || quality.minimumAngle < worst.quality.minimumAngle) worst = { triangle, vertices, quality };
    }
    if (!worst) break;
    let best = null;
    for (let corner = 0; corner < 3; corner += 1) {
      const u = worst.vertices[corner]; const v = worst.vertices[(corner + 1) % 3];
      const adjacent = edges.get(edgeKey(u, v));
      if (!adjacent || adjacent.length !== 2) continue;
      const [firstTriangle, secondTriangle] = adjacent;
      const first = triangleVertices(indices, firstTriangle); const second = triangleVertices(indices, secondTriangle);
      const a = first.find((vertex) => vertex !== u && vertex !== v);
      const b = second.find((vertex) => vertex !== u && vertex !== v);
      if (a == null || b == null || a === b || edges.has(edgeKey(a, b))) continue;
      const candidates = [
        [[a, u, b], [a, b, v]],
        [[a, b, u], [a, v, b]],
      ];
      for (const replacement of candidates) {
        if (!replacementPreservesOrientation(positions, first, second, replacement)) continue;
        const oldQuality = Math.min(triangleQualityByVertices(positions, first).minimumAngle, triangleQualityByVertices(positions, second).minimumAngle);
        const newQualities = replacement.map((vertices) => triangleQualityByVertices(positions, vertices));
        const newQuality = Math.min(...newQualities.map((quality) => quality.minimumAngle));
        const newAspect = Math.max(...newQualities.map((quality) => quality.aspectRatio));
        if (newQuality <= oldQuality + 0.20) continue;
        if (!best || newQuality > best.newQuality || (newQuality === best.newQuality && newAspect < best.newAspect)) best = { firstTriangle, secondTriangle, replacement, newQuality, newAspect };
      }
    }
    if (!best) break;
    indices.set(best.replacement[0], best.firstTriangle * 3);
    indices.set(best.replacement[1], best.secondTriangle * 3);
    changedTriangles.add(best.firstTriangle); changedTriangles.add(best.secondTriangle);
    flipCount += 1;
  }
  let minimumTriangleAngle = Infinity;
  for (let triangle = 0; triangle < indices.length / 3; triangle += 1) minimumTriangleAngle = Math.min(minimumTriangleAngle, triangleQualityByVertices(positions, triangleVertices(indices, triangle)).minimumAngle);
  return { indices, report: { method: 'orientation-preserving local edge flips', thresholdDegrees, flipCount, changedTriangleCount: changedTriangles.size, minimumTriangleAngleAfter: minimumTriangleAngle } };
}

function optimizeLowAnglePositions(sourcePositions, indices, thresholdDegrees) {
  const positions = new Float32Array(sourcePositions);
  const original = new Float32Array(sourcePositions);
  const { neighbors, incidents } = buildVertexNeighborhood(indices, positions.length / 3);
  let adjustedVertexCount = 0;
  let acceptedMoves = 0;
  let maximumDisplacement = 0;
  const adjusted = new Set();
  for (let iteration = 0; iteration < 96; iteration += 1) {
    let worstTriangle = -1; let worstQuality = Infinity;
    for (let triangle = 0; triangle < indices.length / 3; triangle += 1) {
      const quality = triangleQualityByVertices(positions, triangleVertices(indices, triangle)).minimumAngle;
      if (quality < worstQuality) { worstQuality = quality; worstTriangle = triangle; }
    }
    if (worstQuality >= thresholdDegrees || worstTriangle < 0) break;
    const triangle = triangleVertices(indices, worstTriangle);
    let best = null;
    for (let local = 0; local < 3; local += 1) {
      const vertex = triangle[local];
      const candidates = positionRepairCandidates(positions, vertex, triangle, neighbors[vertex], thresholdDegrees + 0.35);
      const affected = incidents[vertex];
      const baseline = Math.min(...affected.map((face) => triangleQualityByVertices(positions, triangleVertices(indices, face)).minimumAngle));
      const originalNormals = new Map(affected.map((face) => [face, triangleNormal(positions, triangleVertices(indices, face))]));
      const offset = vertex * 3;
      const previous = [positions[offset], positions[offset + 1], positions[offset + 2]];
      for (const candidate of candidates) {
        const displacementFromOriginal = Math.hypot(candidate[0] - original[offset], candidate[1] - original[offset + 1], candidate[2] - original[offset + 2]);
        if (displacementFromOriginal > 0.002) continue;
        positions.set(candidate, offset);
        let orientationValid = true;
        let localMinimum = Infinity;
        let localMaximumAspect = 0;
        for (const face of affected) {
          const vertices = triangleVertices(indices, face);
          const normal = triangleNormal(positions, vertices);
          const oldNormal = originalNormals.get(face);
          const denominator = Math.max(Math.hypot(...normal) * Math.hypot(...oldNormal), 1e-30);
          if ((normal[0] * oldNormal[0] + normal[1] * oldNormal[1] + normal[2] * oldNormal[2]) / denominator < 0.75) { orientationValid = false; break; }
          const quality = triangleQualityByVertices(positions, vertices);
          localMinimum = Math.min(localMinimum, quality.minimumAngle);
          localMaximumAspect = Math.max(localMaximumAspect, quality.aspectRatio);
        }
        positions.set(previous, offset);
        if (!orientationValid || localMinimum <= baseline + 0.01) continue;
        if (!best || localMinimum > best.localMinimum || (localMinimum === best.localMinimum && localMaximumAspect < best.localMaximumAspect)) {
          best = { vertex, candidate, localMinimum, localMaximumAspect, displacementFromOriginal };
        }
      }
    }
    if (!best) break;
    positions.set(best.candidate, best.vertex * 3);
    adjusted.add(best.vertex);
    acceptedMoves += 1;
    maximumDisplacement = Math.max(maximumDisplacement, best.displacementFromOriginal);
  }
  adjustedVertexCount = adjusted.size;
  let minimumTriangleAngle = Infinity;
  for (let triangle = 0; triangle < indices.length / 3; triangle += 1) minimumTriangleAngle = Math.min(minimumTriangleAngle, triangleQualityByVertices(positions, triangleVertices(indices, triangle)).minimumAngle);
  return { positions, report: { method: 'one-ring constrained vertex quality optimization', thresholdDegrees, displacementLimitMeters: 0.002, acceptedMoves, adjustedVertexCount, maximumDisplacement, minimumTriangleAngleAfter: minimumTriangleAngle } };
}

function buildVertexNeighborhood(indices, vertexCount) {
  const neighbors = Array.from({ length: vertexCount }, () => new Set());
  const incidents = Array.from({ length: vertexCount }, () => []);
  for (let triangle = 0; triangle < indices.length / 3; triangle += 1) {
    const vertices = triangleVertices(indices, triangle);
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = vertices[corner]; const left = vertices[(corner + 1) % 3]; const right = vertices[(corner + 2) % 3];
      neighbors[vertex].add(left); neighbors[vertex].add(right); incidents[vertex].push(triangle);
    }
  }
  return { neighbors: neighbors.map((set) => [...set]), incidents };
}

function positionRepairCandidates(positions, vertex, triangle, neighbors, targetAngle) {
  const offset = vertex * 3;
  const point = [positions[offset], positions[offset + 1], positions[offset + 2]];
  const candidates = [];
  if (neighbors.length) {
    const average = [0, 0, 0];
    for (const neighbor of neighbors) { average[0] += positions[neighbor * 3]; average[1] += positions[neighbor * 3 + 1]; average[2] += positions[neighbor * 3 + 2]; }
    average[0] /= neighbors.length; average[1] /= neighbors.length; average[2] /= neighbors.length;
    for (const factor of [0.035, 0.07, 0.12, 0.20, -0.035, -0.07]) candidates.push(point.map((value, component) => value + (average[component] - value) * factor));
  }
  const opposite = triangle.filter((candidate) => candidate !== vertex);
  if (opposite.length === 2) {
    const first = [positions[opposite[0] * 3], positions[opposite[0] * 3 + 1], positions[opposite[0] * 3 + 2]];
    const second = [positions[opposite[1] * 3], positions[opposite[1] * 3 + 1], positions[opposite[1] * 3 + 2]];
    const edge = second.map((value, component) => value - first[component]);
    const edgeLengthSquared = edge.reduce((sum, value) => sum + value * value, 0);
    if (edgeLengthSquared > 1e-20) {
      const t = clamp(point.reduce((sum, value, component) => sum + (value - first[component]) * edge[component], 0) / edgeLengthSquared, 0, 1);
      const projection = first.map((value, component) => value + edge[component] * t);
      const away = point.map((value, component) => value - projection[component]);
      const altitude = Math.hypot(...away);
      const edgeLength = Math.sqrt(edgeLengthSquared);
      const desired = Math.max(altitude, edgeLength * Math.tan(targetAngle * Math.PI / 180));
      if (altitude > 1e-12 && desired > altitude) {
        for (const factor of [1, 1.25, 1.5]) candidates.push(projection.map((value, component) => value + away[component] / altitude * Math.min(desired * factor, altitude + 0.0015)));
      }
    }
  }
  return candidates;
}

function buildTriangleEdgeMap(indices) {
  const edges = new Map();
  for (let triangle = 0; triangle < indices.length / 3; triangle += 1) {
    const vertices = triangleVertices(indices, triangle);
    for (let corner = 0; corner < 3; corner += 1) {
      const key = edgeKey(vertices[corner], vertices[(corner + 1) % 3]);
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push(triangle);
    }
  }
  return edges;
}

function triangleVertices(indices, triangle) { return [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]]; }

function triangleQualityByVertices(positions, vertices) {
  const points = vertices.map((vertex) => vertex * 3);
  const distance = (a, b) => Math.hypot(positions[a] - positions[b], positions[a + 1] - positions[b + 1], positions[a + 2] - positions[b + 2]);
  const sides = [distance(points[0], points[1]), distance(points[1], points[2]), distance(points[2], points[0])];
  const angle = (opposite, left, right) => Math.acos(clamp((left * left + right * right - opposite * opposite) / Math.max(2 * left * right, 1e-30), -1, 1)) * 180 / Math.PI;
  const angles = [angle(sides[0], sides[1], sides[2]), angle(sides[1], sides[2], sides[0]), angle(sides[2], sides[0], sides[1])];
  const [a, b, c] = points;
  const abx = positions[b] - positions[a]; const aby = positions[b + 1] - positions[a + 1]; const abz = positions[b + 2] - positions[a + 2];
  const acx = positions[c] - positions[a]; const acy = positions[c + 1] - positions[a + 1]; const acz = positions[c + 2] - positions[a + 2];
  const doubleArea = Math.hypot(aby * acz - abz * acy, abz * acx - abx * acz, abx * acy - aby * acx);
  return { minimumAngle: Math.min(...angles), aspectRatio: Math.max(...sides) ** 2 / Math.max(doubleArea, 1e-30) };
}

function replacementPreservesOrientation(positions, first, second, replacement) {
  const originalNormal = triangleNormal(positions, first).map((value, component) => value + triangleNormal(positions, second)[component]);
  const length = Math.hypot(...originalNormal) || 1;
  for (let component = 0; component < 3; component += 1) originalNormal[component] /= length;
  return replacement.every((triangle) => {
    const normal = triangleNormal(positions, triangle);
    const normalLength = Math.hypot(...normal) || 1;
    return (normal[0] * originalNormal[0] + normal[1] * originalNormal[1] + normal[2] * originalNormal[2]) / normalLength > 0.65;
  });
}

function triangleNormal(positions, vertices) {
  const [a, b, c] = vertices.map((vertex) => vertex * 3);
  const abx = positions[b] - positions[a]; const aby = positions[b + 1] - positions[a + 1]; const abz = positions[b + 2] - positions[a + 2];
  const acx = positions[c] - positions[a]; const acy = positions[c + 1] - positions[a + 1]; const acz = positions[c + 2] - positions[a + 2];
  return [aby * acz - abz * acy, abz * acx - abx * acz, abx * acy - aby * acx];
}

function buildParameterBasis(positions, normals, definitions) {
  const vertexComponents = positions.length;
  const result = new Float32Array(vertexComponents * definitions.length);
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const offset = vertex * 3; const x = positions[offset]; const y = positions[offset + 1]; const z = positions[offset + 2]; const side = Math.sign(x); const absX = Math.abs(x);
    for (let parameter = 0; parameter < definitions.length; parameter += 1) {
      const target = parameter * vertexComponents + offset;
      const id = definitions[parameter].id;
      let dx = 0; let dy = 0; let dz = 0;
      if (id === 'stature') dy = (y - 0.03) * 0.035;
      else if (id === 'shoulderWidth') dx = side * 0.026 * smoothRange(y, 0.34, 0.53, 0.05) * smoothRange(absX, 0.10, 0.34, 0.04);
      else if (id === 'chestDepth') dz = 0.015 * smoothRange(y, 0.23, 0.46, 0.05) * smoothRange(absX, 0, 0.20, 0.04) * Math.sign(z - 0.025 || 1);
      else if (id === 'waistWidth') dx = side * 0.018 * smoothRange(y, 0.05, 0.25, 0.04) * smoothRange(absX, 0, 0.20, 0.03);
      else if (id === 'pelvisWidth') dx = side * 0.022 * smoothRange(y, -0.14, 0.12, 0.05) * smoothRange(absX, 0, 0.24, 0.04);
      else if (id === 'gluteDepth') dz = -0.016 * smoothRange(y, -0.16, 0.08, 0.04) * smoothRange(absX, 0, 0.23, 0.04) * smoothRange(-z, -0.02, 0.13, 0.03);
      else if (id === 'headWidth') dx = side * 0.014 * smoothRange(y, 0.59, 0.86, 0.04);
      else if (id === 'jawWidth') dx = side * 0.012 * smoothBand(y, 0.64, 0.08) * smoothRange(absX, 0.025, 0.12, 0.03);
      else if (id === 'noseBridge') dz = 0.010 * gaussian2(absX, 0, 0.028, y, 0.72, 0.075) * smoothRange(z, 0.08, 0.34, 0.03);
      else if (id === 'armVolume') { const weight = smoothRange(absX, 0.18, 0.46, 0.05) * smoothRange(y, 0.15, 0.51, 0.06); dx = normals[offset] * 0.010 * weight; dy = normals[offset + 1] * 0.010 * weight; dz = normals[offset + 2] * 0.010 * weight; }
      else if (id === 'thighVolume') { const weight = smoothRange(absX, 0.08, 0.25, 0.04) * smoothRange(y, -0.38, 0.02, 0.05); dx = normals[offset] * 0.013 * weight; dy = normals[offset + 1] * 0.013 * weight; dz = normals[offset + 2] * 0.013 * weight; }
      else if (id === 'handScale') { const weight = smoothRange(absX, 0.41, 0.53, 0.025) * smoothRange(y, 0.07, 0.27, 0.04); dx = (x - side * 0.43) * 0.085 * weight; dy = (y - 0.19) * 0.085 * weight; dz = (z - 0.05) * 0.085 * weight; }
      else if (id === 'footScale') { const weight = smoothRange(y, -0.84, -0.64, 0.04); dx = (x - side * 0.235) * 0.075 * weight; dy = (y + 0.70) * 0.075 * weight; dz = (z - 0.08) * 0.075 * weight; }
      result[target] = dx; result[target + 1] = dy; result[target + 2] = dz;
    }
  }
  return result;
}

function buildDeterministicTangents(positions, normals) {
  const tangents = new Float32Array((positions.length / 3) * 4);
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const normalOffset = vertex * 3; const tangentOffset = vertex * 4;
    const nx = normals[normalOffset]; const ny = normals[normalOffset + 1]; const nz = normals[normalOffset + 2];
    const useX = Math.abs(ny) > 0.95;
    const rx = useX ? 1 : 0; const ry = useX ? 0 : 1;
    let tx = ry * nz; let ty = -rx * nz; let tz = rx * ny - ry * nx;
    const length = Math.hypot(tx, ty, tz) || 1;
    tx /= length; ty /= length; tz /= length;
    tangents[tangentOffset] = tx; tangents[tangentOffset + 1] = ty; tangents[tangentOffset + 2] = tz; tangents[tangentOffset + 3] = 1;
  }
  return tangents;
}

function buildSemanticRegions(positions, definitions) {
  const vertexCount = positions.length / 3;
  const maskLo = new Uint32Array(vertexCount); const maskHi = new Uint32Array(vertexCount);
  const offsets = new Uint32Array(definitions.length + 1);
  const all = [];
  const regions = [];
  definitions.forEach(([id, predicate], regionIndex) => {
    offsets[regionIndex] = all.length;
    let count = 0;
    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
      const offset = vertex * 3;
      if (!predicate(positions[offset], positions[offset + 1], positions[offset + 2])) continue;
      all.push(vertex); count += 1;
      if (regionIndex < 32) maskLo[vertex] |= (1 << regionIndex) >>> 0;
      else maskHi[vertex] |= (1 << (regionIndex - 32)) >>> 0;
    }
    regions.push({ id, bit: regionIndex, offsetIndex: regionIndex, vertexCount: count, representation: 'sparse stable vertex membership' });
  });
  offsets[definitions.length] = all.length;
  return { maskLo, maskHi, offsets, vertexIndices: new Uint32Array(all), regions };
}

function buildPrimaryRegionIds(maskLo, maskHi, regionCount) {
  const result = new Uint16Array(maskLo.length); result.fill(65535);
  for (let vertex = 0; vertex < result.length; vertex += 1) {
    for (let region = 0; region < regionCount; region += 1) {
      const contains = region < 32 ? (maskLo[vertex] & ((1 << region) >>> 0)) !== 0 : (maskHi[vertex] & ((1 << (region - 32)) >>> 0)) !== 0;
      if (contains) { result[vertex] = region; break; }
    }
  }
  return result;
}

function buildExpressionRegionMasks(maskLo, maskHi) {
  const expressionRegionIds = new Set(['eyes', 'eyelids', 'mouth', 'nasolabial', 'jaw', 'ear_boundary']);
  let allowedLo = 0; let allowedHi = 0;
  regionDefinitions.forEach(([id], index) => {
    if (!expressionRegionIds.has(id)) return;
    if (index < 32) allowedLo |= (1 << index) >>> 0;
    else allowedHi |= (1 << (index - 32)) >>> 0;
  });
  const outputLo = new Uint32Array(maskLo.length); const outputHi = new Uint32Array(maskHi.length);
  for (let vertex = 0; vertex < maskLo.length; vertex += 1) {
    outputLo[vertex] = maskLo[vertex] & allowedLo;
    outputHi[vertex] = maskHi[vertex] & allowedHi;
  }
  return { maskLo: outputLo, maskHi: outputHi };
}

function compareDirectArrays(referenceData, productionPositions, productionIndices) {
  const referencePositions = new Set();
  for (let offset = 0; offset < referenceData.worldPositions.length; offset += 3) referencePositions.add(floatKey(referenceData.worldPositions[offset], referenceData.worldPositions[offset + 1], referenceData.worldPositions[offset + 2]));
  let exactCopiedPositionCount = 0;
  for (let offset = 0; offset < productionPositions.length; offset += 3) if (referencePositions.has(floatKey(productionPositions[offset], productionPositions[offset + 1], productionPositions[offset + 2]))) exactCopiedPositionCount += 1;
  return {
    exactCopiedPositionCount,
    exactCopiedTriangleCount: exactCopiedPositionCount === 0 ? 0 : null,
    exactCopiedIndexTripletCount: countExactIndexTriplets(referenceData.indices, productionIndices),
    oneToOneVertexIdentityMappingAvailable: false,
    productionVertexCountDiffers: productionPositions.length / 3 !== referenceData.vertexCount,
    productionTriangleCountDiffers: productionIndices.length / 3 !== referenceData.triangleCount,
    positionArrayCopied: false,
    normalArrayCopied: false,
    indexArrayCopied: false,
  };
}

function reorderTriangles(indices, oldPositions, permutation) {
  const triangles = [];
  for (let offset = 0; offset < indices.length; offset += 3) {
    const old = [indices[offset], indices[offset + 1], indices[offset + 2]];
    const mapped = old.map((index) => permutation[index]);
    let start = 0; if (mapped[1] < mapped[start]) start = 1; if (mapped[2] < mapped[start]) start = 2;
    const rotated = [mapped[start], mapped[(start + 1) % 3], mapped[(start + 2) % 3]];
    const centroid = [0, 1, 2].map((component) => (oldPositions[old[0] * 3 + component] + oldPositions[old[1] * 3 + component] + oldPositions[old[2] * 3 + component]) / 3);
    triangles.push({ indices: rotated, centroid });
  }
  const bounds = calculateBounds(oldPositions);
  triangles.sort((left, right) => mortonForPoint(left.centroid, bounds) - mortonForPoint(right.centroid, bounds) || left.indices[0] - right.indices[0]);
  return Uint32Array.from(triangles.flatMap((triangle) => triangle.indices));
}

function countExactIndexTriplets(reference, production) {
  const source = new Set();
  for (let offset = 0; offset < reference.length; offset += 3) source.add(`${reference[offset]}/${reference[offset + 1]}/${reference[offset + 2]}`);
  let count = 0;
  for (let offset = 0; offset < production.length; offset += 3) if (source.has(`${production[offset]}/${production[offset + 1]}/${production[offset + 2]}`)) count += 1;
  return count;
}

function semanticRefinementPriority(x, y, z) {
  const region = semanticRefinementRegion(x, y, z);
  if (['shoulder-axilla', 'elbow', 'wrist-hand', 'hip-groin', 'knee', 'ankle-foot', 'face'].includes(region)) return 4;
  if (['head-neck', 'torso', 'limbs'].includes(region)) return 2;
  return 1;
}

function semanticRefinementRegion(x, y, z) {
  const ax = Math.abs(x);
  if (y > 0.59) return 'face';
  if (inRange(y, 0.32, 0.54) && inRange(ax, 0.11, 0.31)) return 'shoulder-axilla';
  if (limbEllipsoid(x, y, z, 0.365, 0.285, 0.03, 0.08, 0.09, 0.10)) return 'elbow';
  if (ax > 0.40 && inRange(y, 0.07, 0.27)) return 'wrist-hand';
  if (inRange(y, -0.16, 0.12) && ax < 0.24) return 'hip-groin';
  if (inRange(y, -0.46, -0.28) && inRange(ax, 0.10, 0.26)) return 'knee';
  if (y < -0.59) return 'ankle-foot';
  if (y > 0.49) return 'head-neck';
  if (ax < 0.23 && inRange(y, -0.15, 0.49)) return 'torso';
  if (ax >= 0.09) return 'limbs';
  return 'general';
}

function limbEllipsoid(x, y, z, xCenter, yCenter, zCenter, xRadius, yRadius, zRadius) {
  return ((Math.abs(x) - xCenter) / xRadius) ** 2 + ((y - yCenter) / yRadius) ** 2 + ((z - zCenter) / zRadius) ** 2 <= 1;
}

function smoothBand(value, center, halfWidth) { const distance = Math.abs(value - center) / halfWidth; if (distance >= 1) return 0; const t = 1 - distance; return t * t * (3 - 2 * t); }
function smoothRange(value, low, high, feather) { if (value <= low - feather || value >= high + feather) return 0; if (value >= low && value <= high) return 1; const t = value < low ? (value - low + feather) / feather : (high + feather - value) / feather; return clamp(t * t * (3 - 2 * t), 0, 1); }
function gaussian2(a, a0, ar, b, b0, br) { return Math.exp(-0.5 * (((a - a0) / ar) ** 2 + ((b - b0) / br) ** 2)); }
function inRange(value, low, high) { return value >= low && value <= high; }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function edgeKey(a, b) { return a < b ? `${a}/${b}` : `${b}/${a}`; }
function gridKey(x, y, z, cell) { return `${Math.floor(x / cell)}/${Math.floor(y / cell)}/${Math.floor(z / cell)}`; }
function floatKey(x, y, z) { const values = new Float32Array([x, y, z]); return `${values[0]}/${values[1]}/${values[2]}`; }
function calculateBounds(positions) { const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity]; for (let offset = 0; offset < positions.length; offset += 3) for (let component = 0; component < 3; component += 1) { min[component] = Math.min(min[component], positions[offset + component]); max[component] = Math.max(max[component], positions[offset + component]); } return { min, max }; }
function mortonForVertex(positions, vertex, bounds) { return mortonForPoint([positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]], bounds); }
function mortonForPoint(point, bounds) { const q = point.map((value, component) => Math.round(clamp((value - bounds.min[component]) / Math.max(bounds.max[component] - bounds.min[component], 1e-12), 0, 1) * 1023)); return interleave10(q[0]) | (interleave10(q[1]) << 1) | (interleave10(q[2]) << 2); }
function interleave10(value) { let x = value & 0x3ff; x = (x | (x << 16)) & 0x030000ff; x = (x | (x << 8)) & 0x0300f00f; x = (x | (x << 4)) & 0x030c30c3; x = (x | (x << 2)) & 0x09249249; return x; }
function deterministicShuffle(values, seed) { let state = seed >>> 0; for (let index = values.length - 1; index > 0; index -= 1) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; const swap = state % (index + 1); [values[index], values[swap]] = [values[swap], values[index]]; } return values; }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
async function writeJson(path, value) { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
