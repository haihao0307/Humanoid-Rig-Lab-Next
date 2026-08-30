import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileAnatomicalSkeletonS1 } from './compile-anatomical-skeleton.mjs';
import { VARIANT_SPECS, createVariantPackage, sha256Stable } from './anatomical-model-v1.mjs';
import { parseHrlBone } from './read-hrlbone.mjs';
import { encodeHrlBone } from './write-hrlbone.mjs';
import { auditFemurS1A3 } from './qa-femur-s1a3.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, '../..');
const assetRoot = path.join(repositoryRoot, 'assets/human/anatomical-skeleton-s1');
const qaRoot = path.join(repositoryRoot, 'artifacts/qa/anatomical-skeleton-s1');
const STARTING_REMOTE_BRANCH = 'origin/feature/human-core-v5-procedural-skeleton-agent-foundation-v1';
const STARTING_REMOTE_HEAD = '174c9f5e5708a5e090fb2d4170f127708ceedd91';
const TASK_BRANCH = 'experiment/human-core-v5-anatomical-skeleton-s1-femur-visual-refinement-v1';
const TASK_BASE_HEAD = 'b41482b8e7b87a47445a8aaf593d19727d589429';

export async function runAnatomicalSkeletonQa({ writeArtifacts = true, createReviewPackage = true } = {}) {
  const registry = await readJson(path.join(assetRoot, 'VARIANT_REGISTRY_S1.json'));
  const graph = await readJson(path.join(assetRoot, 'ANATOMICAL_GRAPH_S1.json'));
  const baselineDNA = await readJson(path.join(assetRoot, 'SKELETAL_DNA_BASELINE.json'));
  const baselineProfile = await readJson(path.join(assetRoot, 'ANATOMICAL_PROFILE_S1.json'));
  const baselineMapping = await readJson(path.join(assetRoot, 'HUMANRIGCORE_MAPPING_S1.json'));
  const receipts = await readJson(path.join(assetRoot, 'ANATOMICAL_REFERENCE_RECEIPTS.json'));
  const generatorRegistry = await readJson(path.join(assetRoot, 'GENERATOR_REGISTRY_S1.json'));
  const browserEvidencePath = path.join(qaRoot, 'browser-review-s1a3/browser-run-report.json');
  const browserEvidence = await readOptionalJson(browserEvidencePath);

  const graphAudit = auditGraph(graph, baselineProfile);
  const binaryRoundtripAudit = await auditBinaryRoundtrip(registry);
  const geometryAudit = await auditGeometry(registry);
  const deterministicReplay = await auditDeterminism(registry);
  const variantAudit = await auditVariants(registry);
  const sourceAudit = auditSources(receipts, baselineDNA);
  const policyAudit = await auditPolicyScope(registry, baselineProfile, baselineMapping);
  const femurS1A3Audit = auditFemurS1A3();
  const allReportsPassed = [graphAudit, binaryRoundtripAudit, geometryAudit, deterministicReplay, variantAudit, sourceAudit, policyAudit, femurS1A3Audit].every((report) => report.passed);
  if (!allReportsPassed) throw new Error(`Anatomical Skeleton S1 QA failed: ${JSON.stringify({ graphAudit, binary: binaryRoundtripAudit.passed, geometry: geometryAudit.passed, determinism: deterministicReplay.passed, variantAudit, sources: sourceAudit.passed, policyAudit })}`);

  let reviewPackage = null;
  if (writeArtifacts) {
    await mkdir(qaRoot, { recursive: true });
    await writeJson(path.join(qaRoot, 'graph-audit.json'), graphAudit);
    await writeJson(path.join(qaRoot, 'binary-roundtrip-audit.json'), binaryRoundtripAudit);
    await writeJson(path.join(qaRoot, 'geometry-audit.json'), geometryAudit);
    await writeJson(path.join(qaRoot, 'deterministic-replay.json'), deterministicReplay);
    await writeJson(path.join(qaRoot, 'variant-audit.json'), variantAudit);
    await writeJson(path.join(qaRoot, 'source-audit.json'), sourceAudit);
    await writeJson(path.join(qaRoot, 'policy-audit.json'), policyAudit);
    await writeJson(path.join(qaRoot, 'femur-s1a3-regional-geometry-audit.json'), femurS1A3Audit);
    if (createReviewPackage) reviewPackage = await buildReviewPackage({ includeBrowserEvidence: Boolean(browserEvidence) });
  }

  const baseline = registry.variants.find(({ variantId }) => variantId === 'baseline');
  const finalStatus = {
    schema: 'humanoid_rig/anatomical_skeleton_s1_final_status@1.0',
    type: 'TaskS1AFinalStatus', task: 'Task S1A.3 Femur Visual Refinement V1',
    status: 'awaiting-user-visual-acceptance', passed: allReportsPassed,
    startingRemoteBranch: STARTING_REMOTE_BRANCH, startingRemoteHead: STARTING_REMOTE_HEAD,
    branch: TASK_BRANCH, taskBaseHead: TASK_BASE_HEAD, worktree: repositoryRoot,
    policyId: 'human_system/procedural_originality_policy@1.0.0', policyAccepted: true,
    proceduralGenerationOnly: true, externalGeometrySourceCount: 0, loadedExternalHumanModelCount: 0,
    generatedGlbCount: 0, glbLoaderUseCount: 0, runtimeBoneScaleCount: 0,
    humanRigCoreWriteCount: 0, finalPoseWriteCount: 0, authorityWriteViolationCount: 0,
    bodyDnaHash: sha256Stable({
      bodyHeight: baselineDNA.bodyHeight, shoulderWidth: baselineDNA.shoulderWidth, pelvisWidth: baselineDNA.pelvisWidth,
      upperArmLength: baselineDNA.upperArmLength, forearmLength: baselineDNA.forearmLength, thighLength: baselineDNA.thighLength, calfLength: baselineDNA.calfLength,
    }),
    skeletalDnaHash: baseline.skeletalDnaHash,
    anatomicalGraphHash: sha256Stable(graph),
    generatorRegistryHash: generatorRegistry.generatorRegistryHash,
    anatomicalProfileHash: baselineProfile.anatomyProfileHash,
    jointBasisHash: baselineProfile.jointBasisHash,
    landmarkSetHash: baselineProfile.landmarkSetHash,
    binaryGeometrySha256: baseline.sha256,
    deterministicReplayPassed: deterministicReplay.passed,
    baselineRestoreHashPassed: deterministicReplay.baselineRestoreHashPassed,
    baselineBinary: { path: baseline.binaryPath, byteLength: baseline.byteLength, sha256: baseline.sha256 },
    variants: registry.variants.map(({ variantId, revision, binaryPath, byteLength, sha256, anatomicalProfileHash, meshes }) => ({ variantId, revision, binaryPath, byteLength, sha256, anatomicalProfileHash, meshes })),
    graph: { boneIds: graph.bones.map(({ boneId }) => boneId), jointIds: graph.joints.map(({ jointId }) => jointId) },
    skeletalDnaParameterNames: Object.keys(baselineDNA).filter((key) => !['schema', 'schemaVersion', 'type', 'boneParameters'].includes(key)),
    femurGeneratorParameterNames: Object.keys(baselineDNA.boneParameters.find(({ boneId }) => boneId === 'left_femur').generatorParameters),
    humanRigCoreMapping: { status: baselineMapping.status, exactCount: baselineMapping.exactCount, derivedCount: baselineMapping.derivedCount, unmappedCount: baselineMapping.unmappedCount },
    hrlBoneFormat: { magic: 'HRLBONE1', byteOrder: 'little-endian', positions: 'Float32', normals: 'Float32', indices: 'Uint32', primitives: ['TRIANGLES', 'LINES', 'POINTS'] },
    fileQa: { graphAudit: graphAudit.passed, binaryRoundtripAudit: binaryRoundtripAudit.passed, geometryAudit: geometryAudit.passed, variantAudit: variantAudit.passed, sourceAudit: sourceAudit.passed, policyAudit: policyAudit.passed, femurS1A3Audit: femurS1A3Audit.passed },
    performanceAdvisory: {
      baselineUnder4MiB: baseline.byteLength <= 4 * 1024 * 1024,
      defaultDrawCallBudget: { estimated: 5, maximum: 24, passed: true },
      targetFps: 60, decodeAndUploadTargetMs: 100,
      runtimePerformanceEvidence: browserEvidence
        ? 'real local Chromium evidence captured; no runtime performance certification claimed'
        : 'not-run; browser/computer effect validation reserved for the user',
    },
    httpEntry: 'http://127.0.0.1:4173/human-core-v5-anatomical-skeleton-s1-binary-v1.html',
    browserEvidence: browserEvidence ? {
      path: path.relative(repositoryRoot, browserEvidencePath).replaceAll('\\', '/'),
      status: browserEvidence.status,
      browser: browserEvidence.browser,
      screenshotCount: browserEvidence.screenshots.length,
      contactSheet: browserEvidence.evidence.contactSheet,
    } : 'not-run-by-repository-rule',
    consoleErrors: browserEvidence?.errors.consoleErrors ?? [],
    pageErrors: browserEvidence?.errors.pageErrors ?? [],
    startupErrors: browserEvidence?.errors.startupErrors ?? [],
    failedRequests: browserEvidence?.errors.failedRequests ?? [],
    visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending',
    reviewPackage,
  };
  if (writeArtifacts) await writeJson(path.join(qaRoot, 'TASK_S1A_FINAL_STATUS.json'), finalStatus);
  return { passed: allReportsPassed, graphAudit, binaryRoundtripAudit, geometryAudit, deterministicReplay, variantAudit, sourceAudit, policyAudit, femurS1A3Audit, finalStatus };
}

function auditGraph(graph, profile) {
  const boneIds = graph.bones.map(({ boneId }) => boneId);
  const jointIds = graph.joints.map(({ jointId }) => jointId);
  const boneSet = new Set(boneIds);
  const jointSet = new Set(jointIds);
  const jointById = new Map(graph.joints.map((joint) => [joint.jointId, joint]));
  const reachable = new Set();
  const visiting = new Set();
  let cycleCount = 0;
  const visit = (jointId) => {
    if (visiting.has(jointId)) { cycleCount += 1; return; }
    if (reachable.has(jointId)) return;
    visiting.add(jointId);
    reachable.add(jointId);
    for (const childId of jointById.get(jointId)?.childJointIds ?? []) visit(childId);
    visiting.delete(jointId);
  };
  visit(graph.rootJointId);
  const parentChildErrors = [];
  for (const joint of graph.joints) {
    if (joint.parentJointId && !jointSet.has(joint.parentJointId)) parentChildErrors.push(`missing parent ${joint.parentJointId}`);
    for (const childId of joint.childJointIds) if (jointById.get(childId)?.parentJointId !== joint.jointId) parentChildErrors.push(`${joint.jointId}/${childId}`);
  }
  for (const bone of graph.bones) {
    if (bone.parentBoneId && !boneSet.has(bone.parentBoneId)) parentChildErrors.push(`missing bone parent ${bone.parentBoneId}`);
    for (const childId of bone.childBoneIds) if (!boneSet.has(childId)) parentChildErrors.push(`missing bone child ${childId}`);
    if (!jointSet.has(bone.proximalJointId) || !jointSet.has(bone.distalJointId)) parentChildErrors.push(`bone joint ${bone.boneId}`);
  }
  const symmetryErrors = [];
  for (const record of graph.joints) {
    const pair = record.symmetryPairId;
    if ((record.jointId.startsWith('left_') || record.jointId.startsWith('right_')) && !pair) symmetryErrors.push(`${record.jointId}:missing`);
    if (pair && !jointSet.has(pair)) symmetryErrors.push(`${record.jointId}:${pair}`);
  }
  for (const record of graph.bones) {
    const pair = record.symmetryPairId;
    if ((record.boneId.startsWith('left_') || record.boneId.startsWith('right_')) && !pair) symmetryErrors.push(`${record.boneId}:missing`);
    if (pair && !boneSet.has(pair)) symmetryErrors.push(`${record.boneId}:${pair}`);
  }
  let nonNormalizedQuaternionCount = 0;
  let invalidBasisCount = 0;
  let negativeBoneLengthCount = 0;
  let nonFiniteValueCount = countNonFinite({ graph, profile });
  for (const joint of profile.joints) {
    if (Math.abs(Math.hypot(...joint.bindLocalRotation) - 1) > 1e-6) nonNormalizedQuaternionCount += 1;
    if (!(joint.boneLength >= 0)) negativeBoneLengthCount += 1;
    const { x, y, z } = joint.jointBasis;
    const determinant = dot(x, cross(y, z));
    const orthogonality = Math.max(Math.abs(dot(x, y)), Math.abs(dot(x, z)), Math.abs(dot(y, z)), Math.abs(length(x) - 1), Math.abs(length(y) - 1), Math.abs(length(z) - 1));
    if (Math.abs(determinant - 1) > 1e-6 || orthogonality > 1e-6) invalidBasisCount += 1;
  }
  const result = {
    schema: 'humanoid_rig/anatomical_graph_audit@1.0',
    boneCount: boneIds.length, jointCount: jointIds.length,
    boneIdsUnique: boneSet.size === boneIds.length, jointIdsUnique: jointSet.size === jointIds.length,
    namespaceAwareIdsUnique: boneSet.size === boneIds.length && jointSet.size === jointIds.length,
    cycleCount, reachableJointCount: reachable.size, allJointsReachableFromPelvis: reachable.size === jointIds.length,
    parentChildErrorCount: parentChildErrors.length, parentChildErrors,
    symmetryErrorCount: symmetryErrors.length, symmetryErrors,
    nonNormalizedQuaternionCount, invalidBasisCount, negativeBoneLengthCount, nonFiniteValueCount,
  };
  result.passed = result.boneIdsUnique && result.jointIdsUnique && cycleCount === 0 && result.allJointsReachableFromPelvis
    && parentChildErrors.length === 0 && symmetryErrors.length === 0 && nonNormalizedQuaternionCount === 0
    && invalidBasisCount === 0 && negativeBoneLengthCount === 0 && nonFiniteValueCount === 0;
  return result;
}

async function auditBinaryRoundtrip(registry) {
  const records = [];
  for (const variant of registry.variants) {
    const bytes = await readFile(path.join(assetRoot, variant.binaryPath));
    const parsed = parseHrlBone(bytes);
    const rewritten = encodeHrlBone(parsed);
    records.push({
      variantId: variant.variantId, headerComplete: parsed.header.magic === 'HRLBONE1' && parsed.header.major === 1,
      chunkCount: parsed.header.chunkCount, expectedChunkCount: 7, chunkComplete: parsed.header.chunkCount === 7,
      contentChecksumPassed: parsed.header.contentChecksum === parsed.header.computedContentChecksum,
      originalSha256: parsed.sha256, rewrittenSha256: rewritten.sha256, roundtripSha256Passed: parsed.sha256 === rewritten.sha256,
    });
  }
  return { schema: 'humanoid_rig/hrl_bone_binary_roundtrip_audit@1.0', records, passed: records.every((record) => record.headerComplete && record.chunkComplete && record.contentChecksumPassed && record.roundtripSha256Passed) };
}

async function auditGeometry(registry) {
  const variants = [];
  for (const variant of registry.variants) {
    const parsed = parseHrlBone(await readFile(path.join(assetRoot, variant.binaryPath)));
    const groups = [];
    for (let ordinal = 0; ordinal < parsed.primitiveGroups.length; ordinal += 1) {
      const group = parsed.primitiveGroups[ordinal];
      const manifestGroup = (await readJson(path.join(assetRoot, variant.manifestPath))).primitiveGroups[ordinal];
      if (group.primitive !== 'TRIANGLES') continue;
      groups.push(auditTriangleGroup(parsed, group, manifestGroup));
    }
    variants.push({
      variantId: variant.variantId, byteLength: variant.byteLength, under4MiB: variant.byteLength <= 4 * 1024 * 1024,
      groups,
      boundaryEdgeCount: sum(groups, 'boundaryEdgeCount'), nonManifoldEdgeCount: sum(groups, 'nonManifoldEdgeCount'),
      degenerateTriangleCount: sum(groups, 'degenerateTriangleCount'), invertedNormalCount: sum(groups, 'invertedNormalCount'),
      closedComponentGatePassed: groups.every(({ connectedComponentCount }) => connectedComponentCount === 1),
      passed: groups.every(({ passed }) => passed),
    });
  }
  return { schema: 'humanoid_rig/anatomical_geometry_audit@1.0', variants, passed: variants.every((variant) => variant.passed && variant.under4MiB) };
}

function auditTriangleGroup(parsed, group, manifestGroup) {
  const ids = Array.from(parsed.indices.slice(group.indexOffset, group.indexOffset + group.indexCount));
  const edgeCounts = new Map();
  const edgeDirections = new Map();
  const adjacency = new Map();
  let degenerateTriangleCount = 0;
  let signedVolume = 0;
  for (let index = 0; index < ids.length; index += 3) {
    const [a, b, c] = ids.slice(index, index + 3);
    const pa = vertex(parsed.positions, a);
    const pb = vertex(parsed.positions, b);
    const pc = vertex(parsed.positions, c);
    const faceNormal = cross(subtract(pb, pa), subtract(pc, pa));
    if (length(faceNormal) <= 1e-12) degenerateTriangleCount += 1;
    signedVolume += dot(pa, cross(pb, pc)) / 6;
    for (const [left, right] of [[a, b], [b, c], [c, a]]) {
      const key = left < right ? `${left},${right}` : `${right},${left}`;
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
      edgeDirections.set(key, (edgeDirections.get(key) ?? 0) + (left < right ? 1 : -1));
      if (!adjacency.has(left)) adjacency.set(left, new Set());
      if (!adjacency.has(right)) adjacency.set(right, new Set());
      adjacency.get(left).add(right);
      adjacency.get(right).add(left);
    }
  }
  const vertices = new Set(ids);
  const visited = new Set();
  let connectedComponentCount = 0;
  for (const start of vertices) {
    if (visited.has(start)) continue;
    connectedComponentCount += 1;
    const stack = [start];
    visited.add(start);
    while (stack.length) {
      for (const next of adjacency.get(stack.pop()) ?? []) if (!visited.has(next)) { visited.add(next); stack.push(next); }
    }
  }
  const boundaryEdgeCount = [...edgeCounts.values()].filter((count) => count === 1).length;
  const nonManifoldEdgeCount = [...edgeCounts.values()].filter((count) => count > 2).length;
  const invertedNormalCount = [...edgeCounts].filter(([key, count]) => count === 2 && Math.abs(edgeDirections.get(key)) === 2).length;
  const result = {
    groupId: manifestGroup.groupId, boneId: manifestGroup.boneId, side: manifestGroup.side, lod: manifestGroup.lod,
    vertexCount: vertices.size, triangleCount: ids.length / 3, connectedComponentCount,
    boundaryEdgeCount, nonManifoldEdgeCount, degenerateTriangleCount, invertedNormalCount, signedVolume,
  };
  result.passed = connectedComponentCount === 1 && boundaryEdgeCount === 0 && nonManifoldEdgeCount === 0 && degenerateTriangleCount === 0 && invertedNormalCount === 0 && signedVolume > 0;
  return result;
}

async function auditDeterminism(registry) {
  const variants = [];
  for (const record of registry.variants) {
    const hashes = Array.from({ length: 3 }, () => encodeHrlBone(createVariantPackage(record.variantId).geometry).sha256);
    variants.push({ variantId: record.variantId, hashes, expectedSha256: record.sha256, threeRunMatch: new Set(hashes).size === 1, committedMatch: hashes.every((hash) => hash === record.sha256) });
  }
  const baselineBefore = encodeHrlBone(createVariantPackage('baseline').geometry).sha256;
  const variantBetween = encodeHrlBone(createVariantPackage('long_femur_plus_08_percent').geometry).sha256;
  const baselineAfter = encodeHrlBone(createVariantPackage('baseline').geometry).sha256;
  let rebuildFromEmptyOutputPassed = false;
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'hrl-s1-rebuild-'));
  try {
    const result = await compileAnatomicalSkeletonS1({ outputRoot: temporaryRoot });
    rebuildFromEmptyOutputPassed = result.registry.variants.every((variant) => registry.variants.find(({ variantId }) => variantId === variant.variantId)?.sha256 === variant.sha256);
  } finally {
    if (path.dirname(temporaryRoot) !== path.resolve(os.tmpdir()) || !path.basename(temporaryRoot).startsWith('hrl-s1-rebuild-')) throw new Error('Unsafe temporary QA cleanup target.');
    await rm(temporaryRoot, { recursive: true, force: true });
  }
  const result = {
    schema: 'humanoid_rig/anatomical_deterministic_replay@1.0', variants,
    baselineBefore, variantBetween, baselineAfter,
    baselineRestoreHashPassed: baselineBefore === baselineAfter && baselineBefore !== variantBetween,
    rebuildFromEmptyOutputPassed,
  };
  result.passed = variants.every(({ threeRunMatch, committedMatch }) => threeRunMatch && committedMatch) && result.baselineRestoreHashPassed && rebuildFromEmptyOutputPassed;
  return result;
}

async function auditVariants(registry) {
  const records = [];
  for (const spec of VARIANT_SPECS) {
    const record = registry.variants.find(({ variantId }) => variantId === spec.variantId);
    const dna = await readJson(path.join(assetRoot, record.skeletalDnaPath));
    const femora = dna.boneParameters.filter(({ boneId }) => boneId.endsWith('_femur')).map(({ boneId, generatorParameters }) => ({ boneId, ...generatorParameters }));
    records.push({ variantId: spec.variantId, revision: dna.revision, skeletalDnaHash: record.skeletalDnaHash, anatomicalProfileHash: record.anatomicalProfileHash, binarySha256: record.sha256, femora });
  }
  const baseline = records[0];
  const long = records[1];
  const anteversion = records[2];
  const asymmetry = records[3];
  const baselineLeft = baseline.femora.find(({ boneId }) => boneId === 'left_femur');
  const result = {
    schema: 'humanoid_rig/anatomical_variant_audit@1.0', records,
    uniqueRevisions: new Set(records.map(({ revision }) => revision)).size === 4,
    uniqueSkeletalDnaHashes: new Set(records.map(({ skeletalDnaHash }) => skeletalDnaHash)).size === 4,
    uniqueAnatomicalProfileHashes: new Set(records.map(({ anatomicalProfileHash }) => anatomicalProfileHash)).size === 4,
    uniqueBinaryHashes: new Set(records.map(({ binarySha256 }) => binarySha256)).size === 4,
    longFemurDeltaPassed: nearly(long.femora[0].femurLength / baselineLeft.femurLength, 1.008, 1e-6),
    anteversionDeltaPassed: nearly(anteversion.femora[0].femoralAnteversion - baselineLeft.femoralAnteversion, 10, 1e-8),
    asymmetryDeltaPassed: nearly(asymmetry.femora[0].leftRightAsymmetry, 0.002, 1e-8) && nearly(asymmetry.femora[1].leftRightAsymmetry, -0.002, 1e-8),
    localRegenerationProof: {
      lengthVariantChangedParameter: 'femurLength', anteversionVariantChangedParameter: 'femoralAnteversion', asymmetryVariantChangedParameter: 'leftRightAsymmetry',
      regeneratedIds: ['left_femur', 'right_femur'], humanRigCoreWrites: 0, finalPoseWrites: 0,
    },
  };
  result.passed = result.uniqueRevisions && result.uniqueSkeletalDnaHashes && result.uniqueAnatomicalProfileHashes && result.uniqueBinaryHashes && result.longFemurDeltaPassed && result.anteversionDeltaPassed && result.asymmetryDeltaPassed;
  return result;
}

function auditSources(receipts, dna) {
  const requiredFields = ['sourceId', 'title', 'publisher', 'authors', 'version', 'publicationDate', 'license', 'population', 'sampleSize', 'sex', 'ageRange', 'units', 'originalValue', 'normalizedValue', 'derivation', 'confidence', 'useInSystem'];
  const missing = [];
  for (const source of receipts.references) for (const field of requiredFields) if (!(field in source)) missing.push(`${source.sourceId}.${field}`);
  const sourceIds = new Set(receipts.references.map(({ sourceId }) => sourceId));
  const unresolvedReferences = [...new Set(dna.boneParameters.flatMap(({ sourceReceiptIds }) => sourceReceiptIds).filter((sourceId) => !sourceIds.has(sourceId)))];
  const pending = receipts.references.filter(({ confidence }) => confidence === 'pending').map(({ sourceId, originalValue }) => ({ sourceId, originalValue }));
  const external = receipts.references.filter(({ url }) => /^https:\/\//.test(url));
  const result = {
    schema: 'humanoid_rig/anatomical_source_audit@1.0', sourceCount: receipts.references.length,
    externalSourceCount: external.length, externalGeometrySourceCount: receipts.externalGeometrySourceCount,
    loadedExternalHumanModelCount: receipts.loadedExternalHumanModelCount,
    requiredFieldMissingCount: missing.length, missing, unresolvedReferenceCount: unresolvedReferences.length, unresolvedReferences,
    officialUniversityAcademicOrLicensedNonChineseSources: external.every(({ publisher, license }) => publisher && license && !/[\u3400-\u9fff]/u.test(publisher)),
    pendingParameters: pending,
    criticalParameterLockStatus: 'major femur dimensions and angles sourced; local pilot detail parameters pending',
  };
  result.passed = result.externalGeometrySourceCount === 0 && result.loadedExternalHumanModelCount === 0 && missing.length === 0 && unresolvedReferences.length === 0 && result.officialUniversityAcademicOrLicensedNonChineseSources;
  return result;
}

async function auditPolicyScope(registry, profile, mapping) {
  const roots = [
    path.join(repositoryRoot, 'assets/human/anatomical-skeleton-s1'), path.join(repositoryRoot, 'tools/anatomical-skeleton-v1'),
    path.join(repositoryRoot, 'src/core/human-core-v5'), path.join(repositoryRoot, 'apps/human-core-v5-anatomical-skeleton-s1-binary-v1'),
  ];
  const files = (await Promise.all(roots.map(walkFiles))).flat();
  const forbiddenExtensions = new Set(['.glb', '.gltf', '.obj', '.fbx', '.stl', '.blend', '.dae']);
  const forbiddenGeometryFileCount = files.filter((file) => forbiddenExtensions.has(path.extname(file).toLowerCase())).length;
  const sourceFiles = files.filter((file) => ['.js', '.mjs', '.html'].includes(path.extname(file).toLowerCase()) && path.basename(file) !== 'qa-anatomical-skeleton.mjs');
  let gltfLoaderUseCount = 0;
  let runtimeBoneScaleCount = 0;
  let authorityWriteViolationCount = 0;
  for (const file of sourceFiles) {
    const text = await readFile(file, 'utf8');
    gltfLoaderUseCount += (text.match(/\bGLTFLoader\b/g) ?? []).length;
    runtimeBoneScaleCount += (text.match(/\bbone\.scale\b|\.scale\.(?:set|copy)|scale\s*:\s*\[-/g) ?? []).length;
    authorityWriteViolationCount += (text.match(/writesHumanRigCore\s*:\s*true|writesFinalPose\s*:\s*true/g) ?? []).length;
  }
  const manifests = await Promise.all(registry.variants.map(({ manifestPath }) => readJson(path.join(assetRoot, manifestPath))));
  const result = {
    schema: 'humanoid_rig/anatomical_policy_audit@1.0', scopedFileCount: files.length,
    forbiddenGeometryFileCount, gltfLoaderUseCount, runtimeBoneScaleCount, authorityWriteViolationCount,
    externalGeometrySourceCount: Math.max(...manifests.map(({ policy }) => policy.externalGeometrySourceCount)),
    loadedExternalHumanModelCount: Math.max(...manifests.map(({ policy }) => policy.loadedExternalHumanModelCount)),
    generatedGlbCount: Math.max(...manifests.map(({ policy }) => policy.generatedGlbCount)),
    proceduralGenerationOnly: manifests.every(({ policy }) => policy.proceduralGenerationOnly),
    humanRigCoreWriteCount: profile.authorityBoundary.writesHumanRigCore || mapping.writesHumanRigCore ? 1 : 0,
    finalPoseWriteCount: profile.authorityBoundary.writesFinalPose || mapping.writesFinalPose ? 1 : 0,
  };
  result.passed = forbiddenGeometryFileCount === 0 && gltfLoaderUseCount === 0 && runtimeBoneScaleCount === 0 && authorityWriteViolationCount === 0
    && result.externalGeometrySourceCount === 0 && result.loadedExternalHumanModelCount === 0 && result.generatedGlbCount === 0
    && result.proceduralGenerationOnly && result.humanRigCoreWriteCount === 0 && result.finalPoseWriteCount === 0;
  return result;
}

async function buildReviewPackage({ includeBrowserEvidence = false } = {}) {
  const reportNames = ['graph-audit.json', 'binary-roundtrip-audit.json', 'geometry-audit.json', 'deterministic-replay.json', 'variant-audit.json', 'source-audit.json', 'policy-audit.json', 'femur-s1a3-regional-geometry-audit.json'];
  const fixedFiles = [
    'docs/HRL_BONE_BINARY_GEOMETRY_V1.md',
    'schemas/skeletal-dna-v1.schema.json', 'schemas/anatomical-graph-v1.schema.json', 'schemas/anatomical-profile-v1.schema.json', 'schemas/hrl-bone-binary-manifest-v1.schema.json',
    'src/core/human-core-v5/hrlBoneBinaryLoaderV1.js', 'src/core/human-core-v5/longBoneGeneratorV1.js',
    'tools/anatomical-skeleton-v1/write-hrlbone.mjs', 'tools/anatomical-skeleton-v1/read-hrlbone.mjs', 'tools/anatomical-skeleton-v1/anatomical-model-v1.mjs', 'tools/anatomical-skeleton-v1/compile-anatomical-skeleton.mjs', 'tools/anatomical-skeleton-v1/qa-anatomical-skeleton.mjs',
    'human-core-v5-anatomical-skeleton-s1-binary-v1.html',
    'apps/human-core-v5-anatomical-skeleton-s1-binary-v1/index.js', 'apps/human-core-v5-anatomical-skeleton-s1-binary-v1/styles.css',
  ];
  const assetFiles = (await walkFiles(assetRoot)).map((file) => path.relative(repositoryRoot, file).replaceAll('\\', '/'));
  const browserFiles = includeBrowserEvidence
    ? (await walkFiles(path.join(qaRoot, 'browser-review-s1a3'))).map((file) => path.relative(repositoryRoot, file).replaceAll('\\', '/'))
    : [];
  const files = [...fixedFiles, ...assetFiles, ...browserFiles, ...reportNames.map((name) => `artifacts/qa/anatomical-skeleton-s1/${name}`)].sort();
  const manifest = { schema: 'humanoid_rig/anatomical_review_package_manifest@1.0', files: [] };
  for (const relativePath of files) {
    const bytes = await readFile(path.join(repositoryRoot, relativePath));
    manifest.files.push({ path: relativePath, byteLength: bytes.byteLength, sha256: sha256(bytes) });
  }
  manifest.manifestHash = sha256Stable(manifest);
  await writeJson(path.join(qaRoot, 'review-package-manifest.json'), manifest);
  files.push('artifacts/qa/anatomical-skeleton-s1/review-package-manifest.json');
  const entries = await Promise.all(files.sort().map(async (relativePath) => ({ name: relativePath, bytes: await readFile(path.join(repositoryRoot, relativePath)) })));
  const zipBytes = createStoredZip(entries);
  const zipPath = path.join(qaRoot, 'review-package.zip');
  await writeFile(zipPath, zipBytes);
  return { path: path.relative(repositoryRoot, zipPath).replaceAll('\\', '/'), byteLength: zipBytes.byteLength, sha256: sha256(zipBytes), manifestHash: manifest.manifestHash, finalStatusIncluded: false };
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replaceAll('\\', '/'), 'utf8');
    const bytes = Buffer.from(entry.bytes);
    const crc = crc32(bytes);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28); name.copy(local, 30);
    localParts.push(local, bytes);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12); central.writeUInt16LE(0, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38); central.writeUInt32LE(localOffset, 42); name.copy(central, 46);
    centralParts.push(central);
    localOffset += local.length + bytes.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12); end.writeUInt32LE(localOffset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => { let crc = value; for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1); return crc >>> 0; });
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
async function readJson(filePath) { return JSON.parse(await readFile(filePath, 'utf8')); }
async function readOptionalJson(filePath) {
  try { return await readJson(filePath); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}
async function writeJson(filePath, value) { await mkdir(path.dirname(filePath), { recursive: true }); await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
async function walkFiles(root) { const result = []; for (const entry of await readdir(root, { withFileTypes: true })) { const target = path.join(root, entry.name); if (entry.isDirectory()) result.push(...await walkFiles(target)); else result.push(target); } return result; }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function countNonFinite(value) { let count = 0; const visit = (item) => { if (typeof item === 'number' && !Number.isFinite(item)) count += 1; else if (item && typeof item === 'object') Object.values(item).forEach(visit); }; visit(value); return count; }
function vertex(values, index) { return [values[index * 3], values[index * 3 + 1], values[index * 3 + 2]]; }
function add(left, right) { return [left[0] + right[0], left[1] + right[1], left[2] + right[2]]; }
function subtract(left, right) { return [left[0] - right[0], left[1] - right[1], left[2] - right[2]]; }
function cross(left, right) { return [left[1] * right[2] - left[2] * right[1], left[2] * right[0] - left[0] * right[2], left[0] * right[1] - left[1] * right[0]]; }
function dot(left, right) { return left[0] * right[0] + left[1] * right[1] + left[2] * right[2]; }
function length(value) { return Math.hypot(...value); }
function sum(records, field) { return records.reduce((total, record) => total + record[field], 0); }
function nearly(left, right, tolerance) { return Math.abs(left - right) <= tolerance; }

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const result = await runAnatomicalSkeletonQa();
  console.log(`Anatomical Skeleton S1 file QA passed: ${result.passed}`);
  console.log(`Review package: ${result.finalStatus.reviewPackage?.path} ${result.finalStatus.reviewPackage?.sha256}`);
}
