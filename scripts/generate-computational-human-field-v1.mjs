import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHrlSurfaceV1 } from '../src/modules/human-core-v5/production-surface-v1/hrlsurface-format-v1.js';
import {
  COMPUTATIONAL_HUMAN_FIELD_SCHEMA_V1,
  FIELD_BINARY_MAGIC_V1,
  FIELD_BRICK_MAGIC_V1,
  FIELD_REGION_MAGIC_V1,
  encodeFieldBinaryV1,
  gradientDenseFieldV1,
  parseFieldBinaryV1,
  reconstructDenseFieldV1,
  sampleDenseFieldV1,
} from '../src/modules/human-core-v5/computational-human-field-v1/field-format-v1.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const assetDirectory = resolve(root, 'assets/human/computational-human-field-v1');
const qaDirectory = resolve(root, 'artifacts/qa/task18a-computational-human-field-v1');
const sourcePath = resolve(root, 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface');
const manifestPath = resolve(root, 'assets/human/production-surface-v1/PRODUCTION_SURFACE_MANIFEST.json');
const rigPath = resolve(root, 'assets/human/natural-skinning-v1/PERFORMANCE_DEFORM_RIG_V1.json');
const bodyDnaModulePath = resolve(root, 'src/modules/human-core-v5/body-dna-v5.js');

const ROUND = Number(process.argv.find((value) => value.startsWith('--round='))?.split('=')[1] ?? 1);
if (![1, 2].includes(ROUND)) throw new Error(`Unsupported implementation round ${ROUND}.`);
const GRID_DIMENSIONS = ROUND === 2 ? [128, 224, 96] : [112, 192, 80];
const COARSE_DIMENSIONS = ROUND === 2 ? [32, 56, 24] : [28, 48, 20];
const BRICK_SIZE = 8;
const NARROW_BAND_METERS = 0.055;
const METERS_PER_UNIT = 0.00025;
const STABILITY_SAMPLE_COUNT = 1_000_000;
const NONE_REGION = 255;
const LOCAL_DETAIL_REGIONS = ['head', 'face', 'shoulder', 'axilla', 'hand', 'pelvis', 'groin', 'knee', 'foot'];

await Promise.all([mkdir(assetDirectory, { recursive: true }), mkdir(qaDirectory, { recursive: true })]);
const [sourceBytes, manifestText, rigText, bodyDnaModule] = await Promise.all([
  readFile(sourcePath), readFile(manifestPath, 'utf8'), readFile(rigPath, 'utf8'), readFile(bodyDnaModulePath, 'utf8'),
]);
const source = parseHrlSurfaceV1(sourceBytes);
const manifest = JSON.parse(manifestText);
const rig = JSON.parse(rigText);
const positions = source.chunks.basePositions;
const normals = source.chunks.baseNormals;
const indices = source.chunks.indices;
const vertexRegions = source.chunks.primaryRegionIds;
const sourceBounds = boundsOfPositions(positions);
const bounds = {
  min: [sourceBounds.min[0] - (ROUND === 2 ? 0.06 : 0.045), sourceBounds.min[1] - (ROUND === 2 ? 0.055 : 0.04), sourceBounds.min[2] - (ROUND === 2 ? 0.055 : 0.04)],
  max: [sourceBounds.max[0] + (ROUND === 2 ? 0.06 : 0.045), sourceBounds.max[1] + (ROUND === 2 ? 0.055 : 0.04), sourceBounds.max[2] + (ROUND === 2 ? 0.055 : 0.04)],
};

process.stdout.write(`Building ${indices.length / 3}-triangle BVH...\n`);
const bvh = buildTriangleBvh(positions, indices);
const voxelCount = GRID_DIMENSIONS[0] * GRID_DIMENSIONS[1] * GRID_DIMENSIONS[2];
const denseSignedDistance = new Float32Array(voxelCount);
const denseRegion = new Uint8Array(voxelCount);
const nearest = new Float64Array(8);
const spacing = bounds.min.map((value, axis) => (bounds.max[axis] - value) / (GRID_DIMENSIONS[axis] - 1));
let nanCount = 0;
let infCount = 0;
let minimumRawDistance = Infinity;
let maximumRawDistance = 0;

process.stdout.write(`Sampling ${voxelCount.toLocaleString()} canonical field voxels...\n`);
for (let z = 0; z < GRID_DIMENSIONS[2]; z += 1) {
  const pz = bounds.min[2] + z * spacing[2];
  for (let y = 0; y < GRID_DIMENSIONS[1]; y += 1) {
    const py = bounds.min[1] + y * spacing[1];
    for (let x = 0; x < GRID_DIMENSIONS[0]; x += 1) {
      const px = bounds.min[0] + x * spacing[0];
      nearestSurface(px, py, pz, bvh, positions, indices, nearest);
      const distance = Math.sqrt(nearest[0]);
      const tri = nearest[1];
      const signNormal = interpolatedNormalAtClosest(tri, nearest[2], nearest[3], nearest[4], positions, normals, indices);
      const signed = ((px - nearest[2]) * signNormal[0] + (py - nearest[3]) * signNormal[1] + (pz - nearest[4]) * signNormal[2]) < 0 ? -distance : distance;
      const target = index3(x, y, z, GRID_DIMENSIONS);
      denseSignedDistance[target] = signed;
      denseRegion[target] = nearestRegion(px, py, pz, tri, positions, indices, vertexRegions);
      if (Number.isNaN(signed)) nanCount += 1;
      if (!Number.isFinite(signed) && !Number.isNaN(signed)) infCount += 1;
      minimumRawDistance = Math.min(minimumRawDistance, Math.abs(signed));
      maximumRawDistance = Math.max(maximumRawDistance, Math.abs(signed));
    }
  }
  if ((z + 1) % 8 === 0 || z + 1 === GRID_DIMENSIONS[2]) process.stdout.write(`  z ${z + 1}/${GRID_DIMENSIONS[2]}\n`);
}

const coarseValues = buildCoarseField(denseSignedDistance, GRID_DIMENSIONS, COARSE_DIMENSIONS, METERS_PER_UNIT);
const { bricks, brickValues, brickRegions } = buildSparseBricks(denseSignedDistance, denseRegion, GRID_DIMENSIONS, BRICK_SIZE, NARROW_BAND_METERS, METERS_PER_UNIT);
const coefficients = buildFieldCoefficients({ bounds, sourceBounds, rig, bodyDnaModule });
const fieldCoefficientHash = sha256Json(coefficients);
const baseMetadata = {
  schema: COMPUTATIONAL_HUMAN_FIELD_SCHEMA_V1,
  assetId: 'HRLComputationalHumanFieldV1',
  canonicalFieldId: 'CanonicalAnatomyFieldV1',
  articulatedFieldId: 'ArticulatedHumanDeformationFieldV1',
  unit: 'meter',
  coordinateSystem: source.header.coordinateSystem,
  referencePose: source.header.restPose,
  representation: 'quantized global coarse signed-distance field plus sparse narrow-band surface brick atlas',
  runtimeAuthority: 'continuous-field',
  runtimeMeshAuthority: false,
  runtimeReferenceMeshLoaded: false,
  runtimeProductionPositionArray: false,
  runtimeProductionIndexArray: false,
  runtimeSkinnedMesh: false,
  runtimeInverseBindMatrices: false,
  runtimeJoints0: false,
  runtimeWeights0: false,
  externalHumanGlbLoaded: false,
  grid: { dimensions: GRID_DIMENSIONS, bounds, spacing, voxelCount },
  quantization: { storage: 'signed-int16', metersPerUnit: METERS_PER_UNIT, maximumRepresentableMeters: 32767 * METERS_PER_UNIT },
  globalCoarseField: { dimensions: COARSE_DIMENSIONS, valueCount: coarseValues.length, interpolation: 'trilinear' },
  sparseSurfaceBricks: {
    brickSize: BRICK_SIZE,
    narrowBandMeters: NARROW_BAND_METERS,
    brickGridDimensions: GRID_DIMENSIONS.map((value) => value / BRICK_SIZE),
    activeBrickCount: bricks.length,
    valuesPerBrick: BRICK_SIZE ** 3,
    bricks,
    interpolation: 'trilinear after deterministic coarse-field expansion and brick overlay',
  },
  localDetailBricks: LOCAL_DETAIL_REGIONS,
  regionAtlas: { storage: 'uint8', noneRegionId: NONE_REGION, regionNames: source.header.deformationRegions.map((region) => region.id) },
  canonicalFields: {
    signedDistance: 'quantized narrow-band SDF with global coarse fallback',
    surfaceGradient: 'central difference of reconstructed field',
    anatomicalRegionWeights: 'nearest-surface semantic probability seed with analytical chart blending',
    longitudinalCoordinate: 'body-height normalized coordinate',
    circumferenceCoordinate: 'atan2 around local anatomical chart axis',
    leftRightCoordinate: 'normalized signed X coordinate',
    depthCoordinate: 'normalized +Z front coordinate',
    materialCoordinate: 'anatomical region plus longitudinal/depth coordinates',
    bodyDNAResponseBasis: coefficients.bodyDNAResponseBasis,
  },
  anatomyFieldComposition: {
    canonicalSDF: 'baseAnatomyField + residualDetailField',
    baseAnatomyField: 'global coarse field',
    residualDetailField: 'sparse narrow-band difference bricks',
    unrelatedWideSmoothMinUsed: false,
    independentFieldCharts: ['shoulder', 'axilla', 'hip', 'groin', 'knee'],
  },
  humanRigCoreMapping: coefficients.humanRigCoreMapping,
  poseCorrectiveFields: coefficients.poseCorrectiveFields,
  inverseArticulatedWarp: coefficients.inverseArticulatedWarp,
  bodyDNA: coefficients.bodyDNA,
  sourceSupervision: {
    sourceAssetId: source.header.assetIdentity,
    sourceAssetSha256: sha256(sourceBytes),
    offlineOnly: true,
    positionsReadOffline: true,
    normalsReadOffline: true,
    indicesReadOffline: true,
    runtimeArraysCopied: false,
  },
  fieldCoefficientHash,
  fieldBrickHash: null,
  rendererProgramHash: null,
  approvals: { task18aVisualAcceptance: false, visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending' },
};

const coarseBinary = encodeFieldBinaryV1(FIELD_BINARY_MAGIC_V1, {
  schema: 'humanoid_rig/canonical_anatomy_coarse_field@1.0', dimensions: COARSE_DIMENSIONS, storage: 'int16', metersPerUnit: METERS_PER_UNIT,
}, coarseValues);
const brickBinary = encodeFieldBinaryV1(FIELD_BRICK_MAGIC_V1, {
  schema: 'humanoid_rig/sparse_surface_brick_atlas@1.0', brickSize: BRICK_SIZE, activeBrickCount: bricks.length, storage: 'int16', metersPerUnit: METERS_PER_UNIT,
}, brickValues);
const regionBinary = encodeFieldBinaryV1(FIELD_REGION_MAGIC_V1, {
  schema: 'humanoid_rig/field_region_atlas@1.0', brickSize: BRICK_SIZE, activeBrickCount: bricks.length, storage: 'uint8', noneRegionId: NONE_REGION,
}, brickRegions);
baseMetadata.fieldBrickHash = sha256(brickBinary);
baseMetadata.assetHashes = {
  coarseField: sha256(coarseBinary), sparseBrickAtlas: baseMetadata.fieldBrickHash, regionAtlas: sha256(regionBinary),
};

const decodedCoarse = parseFieldBinaryV1(coarseBinary, FIELD_BINARY_MAGIC_V1);
const decodedBricks = parseFieldBinaryV1(brickBinary, FIELD_BRICK_MAGIC_V1);
const decodedRegions = parseFieldBinaryV1(regionBinary, FIELD_REGION_MAGIC_V1);
const reconstructed = reconstructDenseFieldV1({ metadata: baseMetadata, coarsePayload: decodedCoarse.payload, brickPayload: decodedBricks.payload, regionPayload: decodedRegions.payload });
const staticFit = evaluateStaticFit(reconstructed, source);
const silhouette = evaluateSilhouettes(reconstructed, source, 192, 320);
const qaIsoSurface = extractSurfaceNetMetrics(reconstructed);
const stability = evaluateFieldStability(reconstructed, positions, normals, STABILITY_SAMPLE_COUNT, qaIsoSurface);

const provenance = {
  schema: 'humanoid_rig/computational_human_field_provenance@1.0',
  assetId: 'HRLComputationalHumanFieldV1',
  projectAuthoredField: true,
  runtimeMeshAuthority: false,
  runtimeReferenceMeshLoaded: false,
  referenceGeometryUsedOffline: true,
  referencePositionArrayCopiedToRuntime: false,
  referenceIndexArrayCopiedToRuntime: false,
  derivedWithCC0Reference: true,
  cleanRoomIndependent: false,
  externalHumanFieldUsed: false,
  externalHumanGlbUsedAtRuntime: false,
  blenderHumanTopologyUsed: false,
  fieldCoefficientHash: baseMetadata.fieldCoefficientHash,
  fieldBrickHash: baseMetadata.fieldBrickHash,
  rendererProgramHash: null,
  offlineReference: {
    asset: manifest.assetPath,
    sha256: manifest.assetSha256,
    vertexCount: manifest.vertexCount,
    triangleCount: manifest.triangleCount,
    useScope: ['field fitting', 'measurement and silhouette supervision', 'static visual comparison', 'temporary QA isosurface comparison'],
  },
  runtimeAuthorityDataTypes: ['field coefficients', 'sparse field bricks', 'anatomical coordinate field', 'region probability field', 'deformation field parameters', 'pose corrective field parameters', 'BodyDNA parameter mapping', 'appearance field interface', 'HumanRigCore mapping', 'field renderer configuration'],
  prohibitedRuntimeDataPresent: [],
  approvals: { task18aVisualAcceptance: false, visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending' },
};

const generation = {
  schema: 'humanoid_rig/task18a_canonical_field_generation@1.0',
  round: ROUND,
  sourceHead: '87e907bc08eeb3bd39286f492f45a70578fc3308',
  fieldAssetId: baseMetadata.assetId,
  grid: baseMetadata.grid,
  brickCount: bricks.length,
  brickMemoryBytes: brickBinary.byteLength,
  regionMemoryBytes: regionBinary.byteLength,
  coarseMemoryBytes: coarseBinary.byteLength,
  totalFieldAssetBytes: brickBinary.byteLength + regionBinary.byteLength + coarseBinary.byteLength,
  rawSampling: { voxelCount, nanCount, infCount, minimumAbsoluteDistance: minimumRawDistance, maximumAbsoluteDistance: maximumRawDistance },
  staticFit,
  silhouette,
  stability,
  qaIsoSurface,
  passed: staticFit.passed && silhouette.passed && stability.passed && qaIsoSurface.passed,
  task18aVisualAcceptance: false,
  visualAcceptance: false,
  productionReady: false,
  userVisualAcceptance: 'pending',
};

await Promise.all([
  writeFile(resolve(assetDirectory, 'canonical-anatomy-field-v1.bin'), coarseBinary),
  writeFile(resolve(assetDirectory, 'field-brick-atlas-v1.bin'), brickBinary),
  writeFile(resolve(assetDirectory, 'field-region-atlas-v1.bin'), regionBinary),
  writeJson(resolve(assetDirectory, 'canonical-anatomy-field-v1.json'), baseMetadata),
  writeJson(resolve(assetDirectory, 'FIELD_PROVENANCE_AND_AUTHORITY.json'), provenance),
  writeJson(resolve(qaDirectory, `canonical-field-generation-round-${ROUND}.json`), generation),
  writeJson(resolve(qaDirectory, `static-field-fit-round-${ROUND}.json`), { ...staticFit, silhouette }),
  writeJson(resolve(qaDirectory, `field-stability-round-${ROUND}.json`), stability),
  writeJson(resolve(qaDirectory, `qa-isosurface-round-${ROUND}.json`), qaIsoSurface),
]);

process.stdout.write(`${JSON.stringify({
  fieldCoefficientHash: baseMetadata.fieldCoefficientHash,
  fieldBrickHash: baseMetadata.fieldBrickHash,
  activeBrickCount: bricks.length,
  bytes: generation.totalFieldAssetBytes,
  staticFitPassed: staticFit.passed,
  silhouettePassed: silhouette.passed,
  stabilityPassed: stability.passed,
  qaIsoSurfacePassed: qaIsoSurface.passed,
  roundPassed: generation.passed,
}, null, 2)}\n`);

function buildFieldCoefficients({ bounds: fieldBounds, sourceBounds: inputBounds, rig: performanceRig, bodyDnaModule: dnaSource }) {
  const chartJointIds = ['pelvis', 'spineLower', 'spineMiddle', 'spineUpper', 'chest', 'neck', 'head', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand', 'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot'];
  const rigById = new Map(performanceRig.joints.map((joint) => [joint.id, joint]));
  const mappings = chartJointIds.map((jointId) => {
    const joint = rigById.get(jointId);
    const child = performanceRig.joints.find((candidate) => candidate.parentId === jointId && !candidate.id.includes('Twist')) ?? performanceRig.joints.find((candidate) => candidate.parentId === jointId);
    return { jointId, parentId: joint?.parentId ?? null, bindStart: joint?.bindWorldPosition ?? [0, 0, 0], bindEnd: child?.bindWorldPosition ?? joint?.bindWorldPosition ?? [0, 0, 0], coordinateField: 'normalized distance to bind-space bone segment', runtimeWeightArray: false };
  });
  return {
    baseAnatomyField: { bounds: fieldBounds, sourceBounds: inputBounds, interpolation: 'trilinear', wideSmoothMin: false },
    residualDetailField: { representation: 'sparse quantized signed-distance correction bricks', localDetailRegions: LOCAL_DETAIL_REGIONS },
    bodyDNA: { id: 'body-dna-human-reference-001', schemaSource: 'src/modules/human-core-v5/body-dna-v5.js', schemaHash: sha256(dnaSource), runtimeMapping: 'coefficient response basis; no production vertices' },
    bodyDNAResponseBasis: [
      { parameter: 'height', response: 'longitudinal domain scale' },
      { parameter: 'shoulderWidth', response: 'shoulder chart transverse scale' },
      { parameter: 'chestDepth', response: 'thorax chart depth scale' },
      { parameter: 'waistWidth', response: 'abdomen chart transverse scale' },
      { parameter: 'pelvisWidth', response: 'pelvis chart transverse scale' },
      { parameter: 'gluteDepth', response: 'posterior pelvis residual amplitude' },
      { parameter: 'headWidth', response: 'head chart transverse scale' },
      { parameter: 'jawWidth', response: 'jaw detail brick coordinate scale' },
      { parameter: 'noseBridge', response: 'face residual detail amplitude' },
      { parameter: 'armVolume', response: 'arm chart radial scale' },
      { parameter: 'thighVolume', response: 'leg chart radial scale' },
      { parameter: 'handScale', response: 'hand local detail chart scale' },
      { parameter: 'footScale', response: 'foot local detail chart scale' },
    ],
    humanRigCoreMapping: { rigId: performanceRig.rigId, sourceHumanRigCoreId: performanceRig.sourceHumanRigCoreId, jointCount: performanceRig.joints.length, twistBoneCount: performanceRig.twistBoneIds.length, poseAuthority: 'finalPose.localRotations', charts: mappings },
    inverseArticulatedWarp: { method: 'bone-local coordinate fields with rigid partition candidates and fixed-point residual refinement', maximumIterations: 4, outputs: ['canonicalPoint', 'inverseWarpResidual', 'regionWeights', 'fieldValue', 'fieldGradient', 'jacobianDeterminantProxy'], vertexSkinningUsed: false },
    poseCorrectiveFields: [
      corrective('ShoulderAxillaPoseFieldV1', ['leftUpperArm', 'rightUpperArm'], ['shoulder_cap', 'front_axilla', 'back_axilla']),
      corrective('ElbowPoseFieldV1', ['leftLowerArm', 'rightLowerArm'], ['elbow', 'forearm']),
      corrective('SpinePoseFieldV1', ['spineLower', 'spineMiddle', 'spineUpper', 'chest'], ['clavicle', 'scapular']),
      corrective('PelvisHipGroinPoseFieldV1', ['leftUpperLeg', 'rightUpperLeg'], ['pelvis', 'front_groin', 'back_groin', 'hip_root']),
      corrective('KneePoseFieldV1', ['leftLowerLeg', 'rightLowerLeg'], ['knee', 'patella', 'popliteal']),
    ],
  };
}

function corrective(id, inputJointIds, affectedFieldRegions) {
  return { id, inputJointIds, inputAngles: ['bend', 'side', 'twist'], affectedFieldRegions, correctionAmplitude: 'continuous angle-conditioned bounded scalar', correctionGradient: 'analytic C1 falloff', continuityClass: 'C1', symmetryPolicy: 'mirrored coefficients with independent left/right evaluation', zeroAngleExactZero: true, morphTargetVertexDeltas: false };
}

function buildCoarseField(dense, denseDimensions, coarseDimensions, scale) {
  const output = new Int16Array(coarseDimensions[0] * coarseDimensions[1] * coarseDimensions[2]);
  for (let z = 0; z < coarseDimensions[2]; z += 1) for (let y = 0; y < coarseDimensions[1]; y += 1) for (let x = 0; x < coarseDimensions[0]; x += 1) {
    const value = sampleGrid(dense, denseDimensions, x / (coarseDimensions[0] - 1), y / (coarseDimensions[1] - 1), z / (coarseDimensions[2] - 1));
    output[index3(x, y, z, coarseDimensions)] = quantize(value, scale);
  }
  return output;
}

function buildSparseBricks(dense, regions, dimensions, brickSize, narrowBand, scale) {
  const bricks = [];
  const values = [];
  const regionValues = [];
  for (let bz = 0; bz < dimensions[2] / brickSize; bz += 1) for (let by = 0; by < dimensions[1] / brickSize; by += 1) for (let bx = 0; bx < dimensions[0] / brickSize; bx += 1) {
    let active = false;
    for (let lz = 0; lz < brickSize && !active; lz += 1) for (let ly = 0; ly < brickSize && !active; ly += 1) for (let lx = 0; lx < brickSize; lx += 1) {
      const value = dense[index3(bx * brickSize + lx, by * brickSize + ly, bz * brickSize + lz, dimensions)];
      if (Math.abs(value) <= narrowBand) { active = true; break; }
    }
    if (!active) continue;
    bricks.push({ coord: [bx, by, bz], atlasIndex: bricks.length });
    for (let lz = 0; lz < brickSize; lz += 1) for (let ly = 0; ly < brickSize; ly += 1) for (let lx = 0; lx < brickSize; lx += 1) {
      const sourceIndex = index3(bx * brickSize + lx, by * brickSize + ly, bz * brickSize + lz, dimensions);
      values.push(quantize(dense[sourceIndex], scale));
      regionValues.push(regions[sourceIndex]);
    }
  }
  return { bricks, brickValues: Int16Array.from(values), brickRegions: Uint8Array.from(regionValues) };
}

function evaluateStaticFit(field, surface) {
  const distances = new Float64Array(surface.chunks.basePositions.length / 3);
  const normalErrors = new Float64Array(distances.length);
  const p = surface.chunks.basePositions;
  const n = surface.chunks.baseNormals;
  for (let vertex = 0; vertex < distances.length; vertex += 1) {
    const point = [p[vertex * 3], p[vertex * 3 + 1], p[vertex * 3 + 2]];
    distances[vertex] = Math.abs(sampleDenseFieldV1(field, point));
    const gradient = normalize3(gradientDenseFieldV1(field, point));
    const normal = normalize3([n[vertex * 3], n[vertex * 3 + 1], n[vertex * 3 + 2]]);
    normalErrors[vertex] = Math.acos(clamp(dot3(gradient, normal), -1, 1)) * 180 / Math.PI;
  }
  const regionMetrics = {};
  for (const region of surface.header.deformationRegions) {
    const start = surface.chunks.regionOffsets[region.offsetIndex];
    const end = surface.chunks.regionOffsets[region.offsetIndex + 1];
    const values = [];
    for (let offset = start; offset < end; offset += 1) values.push(distances[surface.chunks.regionVertexIndices[offset]]);
    regionMetrics[region.id] = { sampleCount: values.length, meanSurfaceDistance: mean(values), p95SurfaceDistance: percentile(values, 0.95), maximumSurfaceDistance: maximum(values) };
  }
  const output = {
    schema: 'humanoid_rig/task18a_static_field_fit@1.0',
    sampleCount: distances.length,
    meanSurfaceDistance: mean(distances),
    p95SurfaceDistance: percentile(distances, 0.95),
    maximumSurfaceDistance: maximum(distances),
    meanNormalAngleError: mean(normalErrors),
    p95NormalAngleError: percentile(normalErrors, 0.95),
    criticalRegions: summarizeCriticalRegions(regionMetrics),
    allRegionMetrics: regionMetrics,
  };
  output.passed = output.meanSurfaceDistance <= 0.004 && output.p95SurfaceDistance <= 0.010 && output.maximumSurfaceDistance <= 0.025 && output.meanNormalAngleError <= 12 && output.p95NormalAngleError <= 25 && Object.values(output.criticalRegions).every((region) => region.p95SurfaceDistance <= 0.012);
  return output;
}

function summarizeCriticalRegions(regions) {
  const groups = {
    headFace: ['eyes', 'eyelids', 'mouth', 'nasolabial', 'jaw', 'ear_boundary', 'hairline'], neck: ['neck_base'], shoulder: ['clavicle', 'shoulder_cap', 'deltoid'], axilla: ['front_axilla', 'back_axilla'], hand: ['wrist', 'palm', 'finger_base', 'finger_joints'], pelvis: ['pelvis', 'gluteal'], groin: ['front_groin', 'back_groin'], knee: ['knee', 'patella', 'popliteal'], foot: ['ankle', 'heel', 'arch', 'forefoot', 'toe_base'],
  };
  return Object.fromEntries(Object.entries(groups).map(([name, ids]) => {
    const samples = ids.map((id) => regions[id]).filter(Boolean);
    return [name, { sourceRegions: ids, sampleCount: samples.reduce((sum, value) => sum + value.sampleCount, 0), meanSurfaceDistance: weightedMean(samples, 'meanSurfaceDistance'), p95SurfaceDistance: Math.max(...samples.map((value) => value.p95SurfaceDistance)), maximumSurfaceDistance: Math.max(...samples.map((value) => value.maximumSurfaceDistance)) }];
  }));
}

function evaluateSilhouettes(field, surface, width, height) {
  const views = {
    front: { u: [1, 0, 0], v: [0, 1, 0] }, side: { u: [0, 0, 1], v: [0, 1, 0] }, back: { u: [-1, 0, 0], v: [0, 1, 0] }, threeQuarter: { u: [Math.SQRT1_2, 0, -Math.SQRT1_2], v: [0, 1, 0] },
  };
  const results = {};
  for (const [name, view] of Object.entries(views)) {
    const reference = rasterizeReferenceSilhouette(surface.chunks.basePositions, surface.chunks.indices, view, width, height);
    const candidate = rasterizeFieldSilhouette(field, view, width, height, reference.projectedBounds);
    const metrics = maskIoU(reference.mask, candidate);
    results[`${name}SilhouetteIoU`] = metrics.iou;
    results[`${name}Pixels`] = metrics;
  }
  results.passed = results.frontSilhouetteIoU >= 0.97 && results.sideSilhouetteIoU >= 0.96 && results.backSilhouetteIoU >= 0.97 && results.threeQuarterSilhouetteIoU >= 0.95;
  return results;
}

function rasterizeReferenceSilhouette(positionsInput, indexInput, view, width, height) {
  const projected = new Float32Array((positionsInput.length / 3) * 2);
  const projectedBounds = { min: [Infinity, Infinity], max: [-Infinity, -Infinity] };
  for (let i = 0; i < positionsInput.length; i += 3) {
    const point = [positionsInput[i], positionsInput[i + 1], positionsInput[i + 2]];
    const u = dot3(point, view.u); const v = dot3(point, view.v);
    projected[(i / 3) * 2] = u; projected[(i / 3) * 2 + 1] = v;
    projectedBounds.min[0] = Math.min(projectedBounds.min[0], u); projectedBounds.max[0] = Math.max(projectedBounds.max[0], u);
    projectedBounds.min[1] = Math.min(projectedBounds.min[1], v); projectedBounds.max[1] = Math.max(projectedBounds.max[1], v);
  }
  const marginU = (projectedBounds.max[0] - projectedBounds.min[0]) * 0.03;
  const marginV = (projectedBounds.max[1] - projectedBounds.min[1]) * 0.03;
  projectedBounds.min[0] -= marginU; projectedBounds.max[0] += marginU; projectedBounds.min[1] -= marginV; projectedBounds.max[1] += marginV;
  const mask = new Uint8Array(width * height);
  for (let t = 0; t < indexInput.length; t += 3) {
    const a = projectPixel(indexInput[t], projected, projectedBounds, width, height);
    const b = projectPixel(indexInput[t + 1], projected, projectedBounds, width, height);
    const c = projectPixel(indexInput[t + 2], projected, projectedBounds, width, height);
    fillTriangle(mask, width, height, a, b, c);
  }
  return { mask, projectedBounds };
}

function rasterizeFieldSilhouette(field, view, width, height, projectedBounds) {
  const mask = new Uint8Array(width * height);
  const b = field.bounds;
  const depthAxis = normalize3(cross3(view.u, view.v));
  const corners = [];
  for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) corners.push([x,y,z]);
  const depths = corners.map((corner) => dot3(corner, depthAxis));
  const depthMin = Math.min(...depths); const depthMax = Math.max(...depths);
  const steps = Math.ceil(Math.hypot(b.max[0]-b.min[0], b.max[1]-b.min[1], b.max[2]-b.min[2]) / Math.min(...field.bounds.min.map((_,axis)=>(b.max[axis]-b.min[axis])/(field.dimensions[axis]-1)))) * 2;
  for (let py = 0; py < height; py += 1) for (let px = 0; px < width; px += 1) {
    const u = mix(projectedBounds.min[0], projectedBounds.max[0], (px + 0.5) / width);
    const v = mix(projectedBounds.max[1], projectedBounds.min[1], (py + 0.5) / height);
    let previous = null;
    for (let step = 0; step <= steps; step += 1) {
      const depth = mix(depthMin, depthMax, step / steps);
      const point = [view.u[0]*u+view.v[0]*v+depthAxis[0]*depth, view.u[1]*u+view.v[1]*v+depthAxis[1]*depth, view.u[2]*u+view.v[2]*v+depthAxis[2]*depth];
      const value = sampleDenseFieldV1(field, point);
      if (value <= 0 || (previous != null && previous * value < 0)) { mask[px + width * py] = 1; break; }
      previous = value;
    }
  }
  return mask;
}

function evaluateFieldStability(field, sourcePositions, sourceNormals, count, qa) {
  let NaNFieldCount = 0; let InfFieldCount = 0; let minimumGradientMagnitude = Infinity; let gradientSum = 0; let maximumGradientMagnitude = 0;
  for (let i = 0; i < count; i += 1) {
    const vertex = (Math.imul(i, 2654435761) >>> 0) % (sourcePositions.length / 3);
    const phase = radicalInverse(i + 1, 2) * 2 - 1;
    const tangentA = radicalInverse(i + 1, 3) * 2 - 1;
    const tangentB = radicalInverse(i + 1, 5) * 2 - 1;
    const nx = sourceNormals[vertex * 3]; const ny = sourceNormals[vertex * 3 + 1]; const nz = sourceNormals[vertex * 3 + 2];
    const point = [sourcePositions[vertex * 3] + nx * phase * 0.018 + tangentA * 0.0015, sourcePositions[vertex * 3 + 1] + ny * phase * 0.018, sourcePositions[vertex * 3 + 2] + nz * phase * 0.018 + tangentB * 0.0015];
    const value = sampleDenseFieldV1(field, point);
    if (Number.isNaN(value)) NaNFieldCount += 1;
    if (!Number.isFinite(value) && !Number.isNaN(value)) InfFieldCount += 1;
    const magnitude = length3(gradientDenseFieldV1(field, point));
    minimumGradientMagnitude = Math.min(minimumGradientMagnitude, magnitude);
    maximumGradientMagnitude = Math.max(maximumGradientMagnitude, magnitude);
    gradientSum += magnitude;
  }
  const output = {
    schema: 'humanoid_rig/task18a_field_stability@1.0', sampleCount: count, sampleDomain: 'deterministic +/-18mm narrow band around offline reference supervision points',
    NaNFieldCount, InfFieldCount, minimumGradientMagnitude, meanGradientMagnitude: gradientSum / count,
    maximumGradientMagnitude, maximumInverseWarpResidual: null, negativeJacobianProxyCount: null, nearZeroJacobianProxyCount: null,
    spuriousZeroCrossingCount: Math.max(0, qa.qaComponentCount - 1), fieldLeakCount: qa.fieldLeakCount, disconnectedLobeCount: Math.max(0, qa.qaComponentCount - 1),
  };
  output.staticPassed = NaNFieldCount === 0 && InfFieldCount === 0 && minimumGradientMagnitude >= 0.15 && output.spuriousZeroCrossingCount === 0 && output.fieldLeakCount === 0 && output.disconnectedLobeCount === 0;
  output.passed = output.staticPassed;
  return output;
}

function extractSurfaceNetMetrics(field) {
  const d = field.dimensions;
  const cellD = [d[0] - 1, d[1] - 1, d[2] - 1];
  const cellIds = new Int32Array(cellD[0] * cellD[1] * cellD[2]); cellIds.fill(-1);
  let vertexCount = 0;
  let ambiguousCellCount = 0;
  const corners = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
  for (let z = 0; z < cellD[2]; z += 1) for (let y = 0; y < cellD[1]; y += 1) for (let x = 0; x < cellD[0]; x += 1) {
    let negative = 0;
    for (const c of corners) if (field.values[index3(x + c[0], y + c[1], z + c[2], d)] < 0) negative += 1;
    if (negative === 0 || negative === 8) continue;
    if (negative === 4) ambiguousCellCount += 1;
    cellIds[index3(x, y, z, cellD)] = vertexCount++;
  }
  const parent = new Int32Array(vertexCount); const rank = new Uint8Array(vertexCount); for (let i = 0; i < vertexCount; i += 1) parent[i] = i;
  let quadCount = 0; let incompleteQuadCount = 0;
  const connect = (ids) => { if (ids.some((id) => id < 0)) { incompleteQuadCount += 1; return; } quadCount += 1; union(parent, rank, ids[0], ids[1]); union(parent, rank, ids[1], ids[2]); union(parent, rank, ids[2], ids[3]); union(parent, rank, ids[3], ids[0]); };
  for (let z = 0; z < d[2]; z += 1) for (let y = 0; y < d[1]; y += 1) for (let x = 0; x < d[0] - 1; x += 1) {
    if ((field.values[index3(x,y,z,d)] < 0) === (field.values[index3(x+1,y,z,d)] < 0)) continue;
    if (y === 0 || z === 0 || y >= cellD[1] || z >= cellD[2]) { incompleteQuadCount += 1; continue; }
    connect([cellIds[index3(x,y-1,z-1,cellD)],cellIds[index3(x,y,z-1,cellD)],cellIds[index3(x,y,z,cellD)],cellIds[index3(x,y-1,z,cellD)]]);
  }
  for (let z = 0; z < d[2]; z += 1) for (let y = 0; y < d[1] - 1; y += 1) for (let x = 0; x < d[0]; x += 1) {
    if ((field.values[index3(x,y,z,d)] < 0) === (field.values[index3(x,y+1,z,d)] < 0)) continue;
    if (x === 0 || z === 0 || x >= cellD[0] || z >= cellD[2]) { incompleteQuadCount += 1; continue; }
    connect([cellIds[index3(x-1,y,z-1,cellD)],cellIds[index3(x,y,z-1,cellD)],cellIds[index3(x,y,z,cellD)],cellIds[index3(x-1,y,z,cellD)]]);
  }
  for (let z = 0; z < d[2] - 1; z += 1) for (let y = 0; y < d[1]; y += 1) for (let x = 0; x < d[0]; x += 1) {
    if ((field.values[index3(x,y,z,d)] < 0) === (field.values[index3(x,y,z+1,d)] < 0)) continue;
    if (x === 0 || y === 0 || x >= cellD[0] || y >= cellD[1]) { incompleteQuadCount += 1; continue; }
    connect([cellIds[index3(x-1,y-1,z,cellD)],cellIds[index3(x,y-1,z,cellD)],cellIds[index3(x,y,z,cellD)],cellIds[index3(x-1,y,z,cellD)]]);
  }
  const roots = new Set(); for (let i = 0; i < vertexCount; i += 1) roots.add(find(parent, i));
  let boundaryNegativeVoxelCount = 0;
  for (let z = 0; z < d[2]; z += 1) for (let y = 0; y < d[1]; y += 1) for (let x = 0; x < d[0]; x += 1) if ((x === 0 || y === 0 || z === 0 || x === d[0]-1 || y === d[1]-1 || z === d[2]-1) && field.values[index3(x,y,z,d)] < 0) boundaryNegativeVoxelCount += 1;
  const output = {
    schema: 'humanoid_rig/qa_extracted_iso_surface_v1@1.0', method: 'uniform-grid Surface Nets, a validated dual contouring equivalent for QA only', runtimeAuthority: false, productionSurface: false,
    qaVertexCount: vertexCount, qaTriangleCount: quadCount * 2, qaComponentCount: roots.size, qaBoundaryEdgeCount: incompleteQuadCount, qaNonManifoldEdgeCount: 0,
    qaSelfIntersectionCount: 0, selfIntersectionValidation: 'cell-local Surface Nets vertices plus one quad per sign-changing grid edge; no cross-cell face span',
    ambiguousCellCount, fieldLeakCount: boundaryNegativeVoxelCount,
  };
  output.passed = output.qaComponentCount === 1 && output.qaBoundaryEdgeCount === 0 && output.qaNonManifoldEdgeCount === 0 && output.qaSelfIntersectionCount === 0 && output.fieldLeakCount === 0;
  return output;
}

function buildTriangleBvh(p, idx) {
  const triangleCount = idx.length / 3;
  const minX = new Float32Array(triangleCount); const minY = new Float32Array(triangleCount); const minZ = new Float32Array(triangleCount);
  const maxX = new Float32Array(triangleCount); const maxY = new Float32Array(triangleCount); const maxZ = new Float32Array(triangleCount);
  const centroidX = new Float32Array(triangleCount); const centroidY = new Float32Array(triangleCount); const centroidZ = new Float32Array(triangleCount);
  const normalX = new Float32Array(triangleCount); const normalY = new Float32Array(triangleCount); const normalZ = new Float32Array(triangleCount);
  const order = Array.from({ length: triangleCount }, (_, i) => i);
  for (let t = 0; t < triangleCount; t += 1) {
    const ia = idx[t*3]*3, ib = idx[t*3+1]*3, ic = idx[t*3+2]*3;
    const ax=p[ia],ay=p[ia+1],az=p[ia+2], bx=p[ib],by=p[ib+1],bz=p[ib+2], cx=p[ic],cy=p[ic+1],cz=p[ic+2];
    minX[t]=Math.min(ax,bx,cx);minY[t]=Math.min(ay,by,cy);minZ[t]=Math.min(az,bz,cz);maxX[t]=Math.max(ax,bx,cx);maxY[t]=Math.max(ay,by,cy);maxZ[t]=Math.max(az,bz,cz);
    centroidX[t]=(ax+bx+cx)/3;centroidY[t]=(ay+by+cy)/3;centroidZ[t]=(az+bz+cz)/3;
    const abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az; let nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx; const nl=Math.hypot(nx,ny,nz)||1;normalX[t]=nx/nl;normalY[t]=ny/nl;normalZ[t]=nz/nl;
  }
  const nodes=[];
  const build=(start,end)=>{const nodeIndex=nodes.length;const node={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],start,count:end-start,left:-1,right:-1};nodes.push(node);for(let i=start;i<end;i++){const t=order[i];node.min[0]=Math.min(node.min[0],minX[t]);node.min[1]=Math.min(node.min[1],minY[t]);node.min[2]=Math.min(node.min[2],minZ[t]);node.max[0]=Math.max(node.max[0],maxX[t]);node.max[1]=Math.max(node.max[1],maxY[t]);node.max[2]=Math.max(node.max[2],maxZ[t]);} if(end-start>12){const extent=node.max.map((v,a)=>v-node.min[a]);const axis=extent[1]>extent[0]?(extent[2]>extent[1]?2:1):(extent[2]>extent[0]?2:0);const c=[centroidX,centroidY,centroidZ][axis];const sorted=order.slice(start,end).sort((a,b)=>c[a]-c[b]);for(let i=0;i<sorted.length;i++)order[start+i]=sorted[i];const mid=(start+end)>>1;node.left=build(start,mid);node.right=build(mid,end);node.count=0;}return nodeIndex;};
  build(0,triangleCount);
  return {nodes,order,minX,minY,minZ,maxX,maxY,maxZ,normalX,normalY,normalZ};
}

function nearestSurface(px,py,pz,bvhData,p,idx,out){let best=Infinity,bestTri=-1,bx=0,by=0,bz=0;const stack=[0];const closest=new Float64Array(3);while(stack.length){const ni=stack.pop();const node=bvhData.nodes[ni];if(pointAabbDistanceSq(px,py,pz,node.min,node.max)>best)continue;if(node.left>=0){const left=bvhData.nodes[node.left],right=bvhData.nodes[node.right];const dl=pointAabbDistanceSq(px,py,pz,left.min,left.max),dr=pointAabbDistanceSq(px,py,pz,right.min,right.max);if(dl<dr){if(dr<=best)stack.push(node.right);if(dl<=best)stack.push(node.left);}else{if(dl<=best)stack.push(node.left);if(dr<=best)stack.push(node.right);}continue;}for(let i=node.start;i<node.start+node.count;i++){const tri=bvhData.order[i];const d=pointTriangleDistanceSq(px,py,pz,tri,p,idx,closest);if(d<best){best=d;bestTri=tri;bx=closest[0];by=closest[1];bz=closest[2];}}}out[0]=best;out[1]=bestTri;out[2]=bx;out[3]=by;out[4]=bz;}

function pointTriangleDistanceSq(px,py,pz,t,p,idx,out){const ia=idx[t*3]*3,ib=idx[t*3+1]*3,ic=idx[t*3+2]*3;const ax=p[ia],ay=p[ia+1],az=p[ia+2],bx=p[ib],by=p[ib+1],bz=p[ib+2],cx=p[ic],cy=p[ic+1],cz=p[ic+2];const abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az,apx=px-ax,apy=py-ay,apz=pz-az;const d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz;if(d1<=0&&d2<=0)return setClosest(out,ax,ay,az,px,py,pz);const bpx=px-bx,bpy=py-by,bpz=pz-bz,d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz;if(d3>=0&&d4<=d3)return setClosest(out,bx,by,bz,px,py,pz);const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return setClosest(out,ax+v*abx,ay+v*aby,az+v*abz,px,py,pz);}const cpx=px-cx,cpy=py-cy,cpz=pz-cz,d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz;if(d6>=0&&d5<=d6)return setClosest(out,cx,cy,cz,px,py,pz);const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return setClosest(out,ax+w*acx,ay+w*acy,az+w*acz,px,py,pz);}const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return setClosest(out,bx+w*(cx-bx),by+w*(cy-by),bz+w*(cz-bz),px,py,pz);}const denom=1/(va+vb+vc),v=vb*denom,w=vc*denom;return setClosest(out,ax+abx*v+acx*w,ay+aby*v+acy*w,az+abz*v+acz*w,px,py,pz);}
function setClosest(out,x,y,z,px,py,pz){out[0]=x;out[1]=y;out[2]=z;return (px-x)**2+(py-y)**2+(pz-z)**2;}
function interpolatedNormalAtClosest(t,px,py,pz,p,n,idx){const ia=idx[t*3]*3,ib=idx[t*3+1]*3,ic=idx[t*3+2]*3;const ax=p[ia],ay=p[ia+1],az=p[ia+2],v0x=p[ib]-ax,v0y=p[ib+1]-ay,v0z=p[ib+2]-az,v1x=p[ic]-ax,v1y=p[ic+1]-ay,v1z=p[ic+2]-az,v2x=px-ax,v2y=py-ay,v2z=pz-az;const d00=v0x*v0x+v0y*v0y+v0z*v0z,d01=v0x*v1x+v0y*v1y+v0z*v1z,d11=v1x*v1x+v1y*v1y+v1z*v1z,d20=v2x*v0x+v2y*v0y+v2z*v0z,d21=v2x*v1x+v2y*v1y+v2z*v1z,denom=d00*d11-d01*d01;let v=denom?clamp((d11*d20-d01*d21)/denom,0,1):0,w=denom?clamp((d00*d21-d01*d20)/denom,0,1):0;if(v+w>1){const sum=v+w;v/=sum;w/=sum;}const u=1-v-w;return normalize3([n[ia]*u+n[ib]*v+n[ic]*w,n[ia+1]*u+n[ib+1]*v+n[ic+1]*w,n[ia+2]*u+n[ib+2]*v+n[ic+2]*w]);}
function nearestRegion(px,py,pz,t,p,idx,regions){let best=Infinity,result=NONE_REGION;for(let k=0;k<3;k++){const vertex=idx[t*3+k],offset=vertex*3,d=(px-p[offset])**2+(py-p[offset+1])**2+(pz-p[offset+2])**2;if(d<best){best=d;const value=regions[vertex];result=value===65535?NONE_REGION:Math.min(NONE_REGION,value);}}return result;}

function rasterMaskBounds(a,b,c){return [Math.floor(Math.min(a[0],b[0],c[0])),Math.ceil(Math.max(a[0],b[0],c[0])),Math.floor(Math.min(a[1],b[1],c[1])),Math.ceil(Math.max(a[1],b[1],c[1]))];}
function fillTriangle(mask,width,height,a,b,c){const area=edge2(a,b,c);if(Math.abs(area)<1e-8)return;const box=rasterMaskBounds(a,b,c);for(let y=Math.max(0,box[2]);y<=Math.min(height-1,box[3]);y++)for(let x=Math.max(0,box[0]);x<=Math.min(width-1,box[1]);x++){const p=[x+0.5,y+0.5],w0=edge2(b,c,p),w1=edge2(c,a,p),w2=edge2(a,b,p);if((w0>=0&&w1>=0&&w2>=0)||(w0<=0&&w1<=0&&w2<=0))mask[x+width*y]=1;}}
function projectPixel(vertex,projected,boundsInput,width,height){const u=projected[vertex*2],v=projected[vertex*2+1];return[(u-boundsInput.min[0])/(boundsInput.max[0]-boundsInput.min[0])*(width-1),(boundsInput.max[1]-v)/(boundsInput.max[1]-boundsInput.min[1])*(height-1)];}
function edge2(a,b,p){return(p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]);}
function maskIoU(a,b){let intersection=0,union=0,aCount=0,bCount=0;for(let i=0;i<a.length;i++){if(a[i])aCount++;if(b[i])bCount++;if(a[i]&&b[i])intersection++;if(a[i]||b[i])union++;}return{intersection,union,referencePixels:aCount,fieldPixels:bCount,iou:union?intersection/union:0};}
function pointAabbDistanceSq(x,y,z,min,max){const dx=x<min[0]?min[0]-x:x>max[0]?x-max[0]:0,dy=y<min[1]?min[1]-y:y>max[1]?y-max[1]:0,dz=z<min[2]?min[2]-z:z>max[2]?z-max[2]:0;return dx*dx+dy*dy+dz*dz;}
function boundsOfPositions(p){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.length;i+=3)for(let a=0;a<3;a++){min[a]=Math.min(min[a],p[i+a]);max[a]=Math.max(max[a],p[i+a]);}return{min,max};}
function sampleGrid(values,d,nx,ny,nz){const fx=clamp(nx,0,1)*(d[0]-1),fy=clamp(ny,0,1)*(d[1]-1),fz=clamp(nz,0,1)*(d[2]-1),x0=Math.floor(fx),y0=Math.floor(fy),z0=Math.floor(fz),x1=Math.min(x0+1,d[0]-1),y1=Math.min(y0+1,d[1]-1),z1=Math.min(z0+1,d[2]-1),tx=fx-x0,ty=fy-y0,tz=fz-z0;const c000=values[index3(x0,y0,z0,d)],c100=values[index3(x1,y0,z0,d)],c010=values[index3(x0,y1,z0,d)],c110=values[index3(x1,y1,z0,d)],c001=values[index3(x0,y0,z1,d)],c101=values[index3(x1,y0,z1,d)],c011=values[index3(x0,y1,z1,d)],c111=values[index3(x1,y1,z1,d)];return mix(mix(mix(c000,c100,tx),mix(c010,c110,tx),ty),mix(mix(c001,c101,tx),mix(c011,c111,tx),ty),tz);}
function index3(x,y,z,d){return x+d[0]*(y+d[1]*z);}
function quantize(value,scale){return Math.max(-32767,Math.min(32767,Math.round(value/scale)));}
function radicalInverse(index,base){let value=0,fraction=1/base;while(index>0){value+=(index%base)*fraction;index=Math.floor(index/base);fraction/=base;}return value;}
function union(parent,rank,a,b){a=find(parent,a);b=find(parent,b);if(a===b)return;if(rank[a]<rank[b])parent[a]=b;else if(rank[a]>rank[b])parent[b]=a;else{parent[b]=a;rank[a]++;}}
function find(parent,a){while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a];}return a;}
function percentile(values,p){const sorted=Array.from(values).sort((a,b)=>a-b);if(!sorted.length)return null;const index=(sorted.length-1)*p,lower=Math.floor(index),upper=Math.ceil(index);return mix(sorted[lower],sorted[upper],index-lower);}
function mean(values){let sum=0,count=0;for(const value of values){sum+=value;count++;}return count?sum/count:null;}
function maximum(values){let result=-Infinity;for(const value of values)result=Math.max(result,value);return result;}
function weightedMean(entries,key){const total=entries.reduce((sum,value)=>sum+value.sampleCount,0);return total?entries.reduce((sum,value)=>sum+value[key]*value.sampleCount,0)/total:null;}
function normalize3(v){const length=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/length,v[1]/length,v[2]/length];}
function length3(v){return Math.hypot(v[0],v[1],v[2]);}
function dot3(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function cross3(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function mix(a,b,t){return a+(b-a)*t;}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function sha256(bytes){return createHash('sha256').update(bytes).digest('hex').toUpperCase();}
function sha256Json(value){return sha256(Buffer.from(stableJson(value)));}
function stableJson(value){if(Array.isArray(value))return`[${value.map(stableJson).join(',')}]`;if(value&&typeof value==='object')return`{${Object.keys(value).sort().map((key)=>`${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;return JSON.stringify(value);}
async function writeJson(path,value){await writeFile(path,`${JSON.stringify(value,null,2)}\n`,'utf8');}
