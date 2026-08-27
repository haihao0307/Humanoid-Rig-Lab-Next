import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  assertCanonicalReferenceStaticStructureV1,
  buildCanonicalReferenceStaticGlbV1,
  compareCanonicalReferenceFidelityV1,
  extractCanonicalReferenceStaticDataV1,
  findCanonicalReferenceBodyV1,
  measureCanonicalReferenceGeometryV1,
  parseCanonicalReferenceGlbV1,
} from '../src/modules/human-core-v5/canonical-reference-v1/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRelative = 'assets/human/production-surface-v2/candidate-a/neutral-body-candidate-a.glb';
const receiptRelative = 'assets/human/production-surface-v2/candidate-a/ASSET_RECEIPT.json';
const sourceLockRelative = 'assets/human/production-surface-v2/candidate-a/SOURCE_LOCK.json';
const licenseRelative = 'assets/human/production-surface-v2/candidate-a/LICENSE-ASSET.txt';
const conversionRelative = 'artifacts/qa/task15a-production-surface-v2/conversion-report.json';
const canonicalRelative = 'assets/human/canonical-reference-v1/makehuman-reference-neutral-static-v1.glb';
const assetDirectory = resolve(root, 'assets/human/canonical-reference-v1');
const artifactDirectory = resolve(root, 'artifacts/qa/task16a-r2a-canonical-reference-v1');
const expected = Object.freeze({
  [sourceRelative]: { sha256: '8E62AE9FBDCDF40F0B3B294ACC8DE1FE0360A838B4E9351604114AFAED94D38E', bytes: 974268 },
  [receiptRelative]: { sha256: 'F6030FD862D66ED87F02993D99EE0A3D1684DB06D4159C496B49F638B154ECBC' },
  [sourceLockRelative]: { sha256: 'BFA1E051AD3B7B25772CBF37E1AC8D14641C56FC8C09B966C7974BEFCF5A4CB5' },
  [licenseRelative]: { sha256: '5F3AB0CF6F7EBE92EFE4B83213131C617D308D164EEEFD5DA230373640B0C226' },
  [conversionRelative]: { sha256: '8E077FF5394FC64D607508E72B02874828CFBD1B654A53410ABC9882681FF627' },
});

await mkdir(assetDirectory, { recursive: true });
await mkdir(artifactDirectory, { recursive: true });

const sourceFiles = {};
for (const [relativePath, lock] of Object.entries(expected)) {
  const bytes = await readFile(resolve(root, relativePath));
  const measured = { path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) };
  measured.hashMatches = measured.sha256 === lock.sha256;
  measured.bytesMatch = lock.bytes == null || measured.bytes === lock.bytes;
  sourceFiles[relativePath] = measured;
}
const receipt = JSON.parse(await readFile(resolve(root, receiptRelative), 'utf8'));
const sourceLock = JSON.parse(await readFile(resolve(root, sourceLockRelative), 'utf8'));
const conversion = JSON.parse(await readFile(resolve(root, conversionRelative), 'utf8'));
const sourceIntegrity = {
  schema: 'humanoid_rig/task16a_r2a_source_integrity@1.0',
  files: sourceFiles,
  receiptChecks: {
    sourceProject: receipt.sourceProject === 'MakeHuman Community MPFB2',
    sourceCommit: receipt.sourceCommit === '437dd513888a92399d1d3200d2e80859fae55abc',
    sourceMesh: receipt.sourceFiles?.includes('src/mpfb/data/3dobjs/base.obj'),
    originalMeshSha256: receipt.originalHashes?.mesh === '8E761E6624B8F54536409135D1636DA63B32486A90D4897F84E121D144F6FB4C',
    convertedGlbSha256: receipt.convertedHash === expected[sourceRelative].sha256,
    convertedGlbBytes: receipt.convertedSize === expected[sourceRelative].bytes,
    license: receipt.license === 'CC0-1.0',
  },
  sourceLockChecks: {
    sourceProject: sourceLock.sourceProject === receipt.sourceProject,
    sourceRepository: sourceLock.sourceRepository === receipt.sourceRepository,
    sourceCommit: sourceLock.sourceCommit === receipt.sourceCommit,
    originalMeshSha256: sourceLock.originalHashes?.mesh === receipt.originalHashes?.mesh,
    license: sourceLock.license === receipt.license,
  },
  conversionChecks: {
    sourceCommit: conversion.sourceCommit === receipt.sourceCommit,
    convertedGlbSha256: conversion.convertedHash === receipt.convertedHash,
    convertedGlbBytes: conversion.convertedSize === receipt.convertedSize,
    convertedVertexCount: conversion.convertedVertexCount === 13380,
    convertedTriangleCount: conversion.convertedTriangleCount === 26756,
  },
};
sourceIntegrity.passed = Object.values(sourceFiles).every((entry) => entry.hashMatches && entry.bytesMatch)
  && Object.values(sourceIntegrity.receiptChecks).every(Boolean)
  && Object.values(sourceIntegrity.sourceLockChecks).every(Boolean)
  && Object.values(sourceIntegrity.conversionChecks).every(Boolean);
await writeJson(resolve(artifactDirectory, 'source-integrity.json'), sourceIntegrity);
if (!sourceIntegrity.passed) throw new Error('SOURCE_ASSET_INTEGRITY_FAILED');

const sourceBytes = await readFile(resolve(root, sourceRelative));
const sourceParsed = parseCanonicalReferenceGlbV1(sourceBytes, { assetPath: sourceRelative });
const sourceBody = findCanonicalReferenceBodyV1(sourceParsed);
const sourceData = await extractCanonicalReferenceStaticDataV1(sourceParsed, sourceBody);
const extracted = buildCanonicalReferenceStaticGlbV1({ sourceParsed, sourceData });
const canonicalPath = resolve(root, canonicalRelative);
await writeFile(canonicalPath, extracted.glbBytes);
await copyFile(resolve(root, licenseRelative), resolve(assetDirectory, 'LICENSE-ASSET.txt'));

const canonicalBytes = await readFile(canonicalPath);
const canonicalSha256 = sha256(canonicalBytes);
const canonicalParsed = parseCanonicalReferenceGlbV1(canonicalBytes, { assetPath: canonicalRelative });
assertCanonicalReferenceStaticStructureV1(canonicalParsed.gltf);
const canonicalData = await extractCanonicalReferenceStaticDataV1(canonicalParsed, findCanonicalReferenceBodyV1(canonicalParsed));
const fidelity = compareCanonicalReferenceFidelityV1(sourceData, canonicalData);
const sourceMetrics = measureCanonicalReferenceGeometryV1(sourceData);
const canonicalMetrics = measureCanonicalReferenceGeometryV1(canonicalData);

const lock = {
  schema: 'humanoid_rig/canonical_reference_mesh_lock@1.0',
  sourceProject: receipt.sourceProject,
  sourceRepository: receipt.sourceRepository,
  sourceCommit: receipt.sourceCommit,
  sourceFile: 'src/mpfb/data/3dobjs/base.obj',
  sourceOriginalMeshSha256: receipt.originalHashes.mesh,
  sourceConvertedGlbPath: sourceRelative,
  sourceConvertedGlbSha256: receipt.convertedHash,
  sourceConvertedGlbBytes: receipt.convertedSize,
  license: receipt.license,
  derivedFromCandidateA: true,
  sourceReferencePose: 'makehuman-source-rest-reference',
  sourceReferencePoseClass: 'a-pose-like',
  sourceReferencePoseModified: false,
  shapeModified: false,
  topologyModified: false,
  vertexOrderModified: false,
  indexOrderModified: false,
  normalOrderModified: false,
  skinRemoved: true,
  skeletonRemoved: true,
  animationsRemoved: true,
  canonicalAssetPath: canonicalRelative,
  canonicalAssetSha256: canonicalSha256,
  canonicalAssetBytes: canonicalBytes.byteLength,
  universalNeutralShapeApproved: false,
  canonicalTopologyFoundationApproved: true,
  dynamicSkinningApproved: false,
  bodyDNAApproved: false,
  imageFittingApproved: false,
  visualAcceptance: false,
  productionReady: false,
  userVisualAcceptance: 'pending',
};
const manifest = {
  schema: 'humanoid_rig/canonical_reference_geometry_manifest@1.0',
  sourceAssetPath: sourceRelative,
  canonicalAssetPath: canonicalRelative,
  sourceBodyNodeName: sourceData.nodeName,
  canonicalBodyNodeName: canonicalData.nodeName,
  sourceReferencePose: lock.sourceReferencePose,
  sourceReferencePoseClass: lock.sourceReferencePoseClass,
  coordinateSystem: receipt.coordinateSystem,
  unit: receipt.unit,
  sourceNodeMatrix: sourceData.sourceNodeMatrix,
  sourceWorldMatrix: sourceData.sourceWorldMatrix,
  canonicalNodeMatrix: canonicalData.sourceNodeMatrix,
  canonicalWorldMatrix: canonicalData.sourceWorldMatrix,
  vertexCount: canonicalData.vertexCount,
  triangleCount: canonicalData.triangleCount,
  indexCount: canonicalData.indexCount,
  primitiveCount: canonicalData.primitiveCount,
  materialCount: canonicalData.materialCount,
  attributes: ['POSITION', 'NORMAL'],
  indexComponentType: canonicalData.indexComponentType,
  removed: ['Skeleton', 'Skin', 'inverseBindMatrices', 'JOINTS_0', 'WEIGHTS_0', 'animations', 'rig nodes', 'helper nodes'],
  compression: null,
  fidelityPassed: fidelity.passed,
};
const fidelityRecord = {
  ...fidelity,
  sourceAssetPath: sourceRelative,
  sourceAssetSha256: expected[sourceRelative].sha256,
  canonicalAssetPath: canonicalRelative,
  canonicalAssetSha256: canonicalSha256,
  conclusion: fidelity.passed ? 'EXACT_STATIC_COPY' : 'REFERENCE_GEOMETRY_COPY_MISMATCH',
};

await writeJson(resolve(assetDirectory, 'REFERENCE_MESH_LOCK.json'), lock);
await writeJson(resolve(assetDirectory, 'REFERENCE_GEOMETRY_MANIFEST.json'), manifest);
await writeJson(resolve(assetDirectory, 'REFERENCE_GEOMETRY_FIDELITY.json'), fidelityRecord);
await writeJson(resolve(artifactDirectory, 'source-geometry-metrics.json'), sourceMetrics);
await writeJson(resolve(artifactDirectory, 'canonical-geometry-metrics.json'), canonicalMetrics);
await writeJson(resolve(artifactDirectory, 'geometry-fidelity.json'), fidelityRecord);
if (!fidelity.passed) throw new Error('REFERENCE_GEOMETRY_COPY_MISMATCH');

process.stdout.write(`${JSON.stringify({
  conclusion: 'EXACT_STATIC_COPY',
  canonicalAssetPath: canonicalRelative,
  canonicalAssetSha256: canonicalSha256,
  canonicalAssetBytes: canonicalBytes.byteLength,
  sourceVertexCount: sourceData.vertexCount,
  canonicalVertexCount: canonicalData.vertexCount,
  sourceTriangleCount: sourceData.triangleCount,
  canonicalTriangleCount: canonicalData.triangleCount,
  sourcePositionHash: sourceData.positionHash,
  canonicalPositionHash: canonicalData.positionHash,
  sourceIndexHash: sourceData.indexHash,
  canonicalIndexHash: canonicalData.indexHash,
  sourceNormalHash: sourceData.normalHash,
  canonicalNormalHash: canonicalData.normalHash,
  sourceWorldSpacePositionHash: sourceData.worldSpacePositionHash,
  canonicalWorldSpacePositionHash: canonicalData.worldSpacePositionHash,
  sourceWorldSpaceNormalHash: sourceData.worldSpaceNormalHash,
  canonicalWorldSpaceNormalHash: canonicalData.worldSpaceNormalHash,
  maximumWorldPositionDelta: fidelity.maximumWorldPositionDelta,
  meanWorldPositionDelta: fidelity.meanWorldPositionDelta,
  maximumWorldNormalDelta: fidelity.maximumWorldNormalDelta,
}, null, 2)}\n`);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
