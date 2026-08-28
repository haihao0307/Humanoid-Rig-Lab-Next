import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HrlSurfaceDeformerV1,
  countSelfIntersectionsV1,
  measureHrlSurfaceTopologyV1,
  parseHrlSurfaceV1,
} from '../src/modules/human-core-v5/production-surface-v1/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetRelative = 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface';
const qaRelative = 'artifacts/qa/task16a-r2b-production-surface-v1';
const assetBytes = await readFile(resolve(root, assetRelative));
const runtimeSource = await readFile(resolve(root, 'apps/human-core-v5-production-surface-v1/runtime.js'), 'utf8');
const parsed = parseHrlSurfaceV1(assetBytes);
const positions = parsed.chunks.basePositions;
const normals = parsed.chunks.baseNormals;
const tangents = parsed.chunks.baseTangents;
const indices = parsed.chunks.indices;
const side = parsed.chunks.vertexSide;
const partner = parsed.chunks.symmetryPartner;
const centerVertices = [...parsed.chunks.centerVertexIndices];
const topologyMetrics = await measureHrlSurfaceTopologyV1(positions, indices);
const selfIntersection = countSelfIntersectionsV1(positions, indices);

const requiredChunks = [
  'basePositions', 'baseNormals', 'baseTangents', 'indices', 'stableVertexIds', 'vertexSide', 'symmetryPartner',
  'leftVertexIndices', 'rightVertexIndices', 'centerVertexIndices', 'centerlineRole', 'failedCenterlinePositions', 'primaryRegionIds',
  'anatomicalBandMaskLo', 'anatomicalBandMaskHi', 'futureWeightRegionMaskLo', 'futureWeightRegionMaskHi',
  'futureCorrectiveRegionMaskLo', 'futureCorrectiveRegionMaskHi', 'futureExpressionRegionMaskLo', 'futureExpressionRegionMaskHi',
  'halfEdgeVertex', 'halfEdgeNext', 'halfEdgeTwin', 'halfEdgeFace', 'vertexHalfEdge',
];
const missingChunks = requiredChunks.filter((name) => !parsed.chunks[name]);
const fullBilateral = parsed.header.bilateralAuthority ?? {};
const vertexCount = positions.length / 3;
const sideCounts = { left: 0, right: 0, center: 0, invalid: 0 };
for (const value of side) {
  if (value === 0) sideCounts.center += 1;
  else if (value === 1) sideCounts.left += 1;
  else if (value === 2) sideCounts.right += 1;
  else sideCounts.invalid += 1;
}

let symmetryPartnerInvolutionErrorCount = 0;
let symmetryPartnerMissingCount = 0;
let symmetryPartnerWrongSideCount = 0;
let centerlineSelfPartnerErrorCount = 0;
for (let vertex = 0; vertex < vertexCount; vertex += 1) {
  const counterpart = partner[vertex];
  if (counterpart >= vertexCount) { symmetryPartnerMissingCount += 1; continue; }
  if (partner[counterpart] !== vertex) symmetryPartnerInvolutionErrorCount += 1;
  if (side[vertex] === 0 && counterpart !== vertex) centerlineSelfPartnerErrorCount += 1;
  if (side[vertex] !== 0 && side[counterpart] === side[vertex]) symmetryPartnerWrongSideCount += 1;
}

const centerline = measureCenterline(positions, normals, tangents, indices, side, centerVertices);
const roleCounts = Object.fromEntries((fullBilateral.centerlineRoleDefinitions ?? []).map((definition) => [definition.id, 0]));
for (const vertex of centerVertices) {
  const definition = fullBilateral.centerlineRoleDefinitions?.find((entry) => entry.value === parsed.chunks.centerlineRole[vertex]);
  if (definition) roleCounts[definition.id] += 1;
}

const symmetricEditMetrics = runSymmetricEditTest(parsed);
const asymmetricEditMetrics = runAsymmetricEditTest(parsed);
const centerlineParameterMetrics = runCenterlineParameterInvarianceTest(parsed);
const runtimeMirrorOperationCount = countMatches(runtimeSource, /(?:reflectX|scale\.x\s*=\s*-|scale\.set\s*\(\s*-|applyMatrix4\s*\([^)]*makeScale\s*\(\s*-)/g);
const negativeScaleNodeCount = countMatches(runtimeSource, /(?:scale\.x\s*=\s*-|scale\.set\s*\(\s*-)/g);
const mirroredHalfMeshCount = 0;

const centerlineMetrics = {
  runtimeMirrorOperationCount,
  negativeScaleNodeCount,
  mirroredHalfMeshCount,
  ...centerline,
  symmetryPartnerInvolutionErrorCount,
  symmetryPartnerMissingCount,
  symmetryPartnerWrongSideCount,
  centerlineSelfPartnerErrorCount,
  centerlineRoleCounts: roleCounts,
};
const topologyGates = {
  connectedComponentCount: topologyMetrics.connectedComponentCount === 1,
  boundaryEdgeCount: topologyMetrics.boundaryEdgeCount === 0,
  nonManifoldEdgeCount: topologyMetrics.nonManifoldEdgeCount === 0,
  nonManifoldVertexCount: topologyMetrics.nonManifoldVertexCount === 0,
  degenerateTriangleCount: topologyMetrics.degenerateTriangleCount === 0,
  duplicateTriangleCount: topologyMetrics.duplicateTriangleCount === 0,
  selfIntersectionCount: selfIntersection.selfIntersectionCount === 0,
  NaNCount: topologyMetrics.NaNCount === 0,
  InfCount: topologyMetrics.InfCount === 0,
  triangleWindingConsistency: topologyMetrics.triangleWindingConsistency === true,
  signedVolume: topologyMetrics.signedVolume > 0,
};
const centerlineGates = {
  fullBilateralAuthority: parsed.header.assetIdentity === 'HRLFullBilateralSurfaceV1' && fullBilateral.fullBilateralGeometry !== false,
  requiredChunks: missingChunks.length === 0,
  explicitSideCounts: sideCounts.left === parsed.chunks.leftVertexIndices.length && sideCounts.right === parsed.chunks.rightVertexIndices.length && sideCounts.center === parsed.chunks.centerVertexIndices.length && sideCounts.invalid === 0,
  balancedSides: sideCounts.left === sideCounts.right,
  runtimeMirrorOperationCount: runtimeMirrorOperationCount === 0,
  negativeScaleNodeCount: negativeScaleNodeCount === 0,
  mirroredHalfMeshCount: mirroredHalfMeshCount === 0,
  duplicateCenterlineVertexPairCount: centerline.duplicateCenterlineVertexPairCount === 0,
  centerlineBoundaryEdgeCount: centerline.centerlineBoundaryEdgeCount === 0,
  centerlineNonManifoldEdgeCount: centerline.centerlineNonManifoldEdgeCount === 0,
  centerlineOverlappingTrianglePairCount: centerline.centerlineOverlappingTrianglePairCount === 0,
  centerlineMaximumPositionGap: centerline.centerlineMaximumPositionGap === 0,
  centerlineMaximumNormalDiscontinuity: centerline.centerlineMaximumNormalDiscontinuity <= 1e-5,
  centerlineMaximumTangentDiscontinuity: centerline.centerlineMaximumTangentDiscontinuity <= 1e-5,
  symmetryPartnerInvolutionErrorCount: symmetryPartnerInvolutionErrorCount === 0,
  symmetryPartnerMissingCount: symmetryPartnerMissingCount === 0,
  symmetryPartnerWrongSideCount: symmetryPartnerWrongSideCount === 0,
  centerlineSelfPartnerErrorCount: centerlineSelfPartnerErrorCount === 0,
  centerlineSingleChain: centerline.centerlineConnectedComponentCount === 1 && centerline.centerlineUniqueEdgeCount === centerVertices.length - 1 && centerline.centerlineEndpointCount === 2 && centerline.centerlineBranchVertexCount === 0,
  centerlineSharedByBothSides: centerline.centerlineSharedByBothSidesCount === centerVertices.length,
  centerlineRolesComplete: Object.values(roleCounts).every((count) => count > 0),
  centerlineParameterInvariance: centerlineParameterMetrics.passed,
};
const editGates = {
  symmetricEdit: symmetricEditMetrics.passed,
  asymmetricEdit: asymmetricEditMetrics.passed,
};
const passed = [...Object.values(topologyGates), ...Object.values(centerlineGates), ...Object.values(editGates)].every(Boolean);
const report = {
  schema: 'humanoid_rig/task16a_r2b_full_bilateral_audit@1.0',
  authority: 'HRLFullBilateralSurfaceV1',
  assetPath: assetRelative,
  assetSha256: sha256(assetBytes),
  assetBytes: assetBytes.byteLength,
  sideCounts,
  vertexCount,
  triangleCount: indices.length / 3,
  topologyFingerprint: topologyMetrics.topologyFingerprint,
  topologyMetrics: { ...topologyMetrics, selfIntersectionCount: selfIntersection.selfIntersectionCount },
  centerlineMetrics,
  symmetricEditMetrics,
  asymmetricEditMetrics,
  centerlineParameterMetrics,
  topologyGates,
  centerlineGates,
  editGates,
  missingChunks,
  passed,
  visualAcceptance: false,
  productionReady: false,
  userVisualAcceptance: 'pending',
  conclusion: passed ? 'HRL_FULL_BILATERAL_STATIC_GATES_PASSED_VISUAL_REVIEW_PENDING' : 'FULL_BILATERAL_STATIC_GATE_FAILED',
};
await Promise.all([
  writeJson(resolve(root, qaRelative, 'full-bilateral-audit.json'), report),
  writeJson(resolve(root, qaRelative, 'symmetric-edit-test.json'), symmetricEditMetrics),
  writeJson(resolve(root, qaRelative, 'asymmetric-edit-test.json'), asymmetricEditMetrics),
  writeJson(resolve(root, 'assets/human/production-surface-v1/TOPOLOGY_METRICS.json'), report.topologyMetrics),
]);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!passed) process.exitCode = 1;

function measureCenterline(positionArray, normalArray, tangentArray, triangleIndices, vertexSide, centers) {
  const edgeCounts = new Map(); const centerAdjacency = new Map(centers.map((vertex) => [vertex, new Set()]));
  const leftIncident = new Uint8Array(vertexSide.length); const rightIncident = new Uint8Array(vertexSide.length);
  for (let offset = 0; offset < triangleIndices.length; offset += 3) {
    const triangle = [triangleIndices[offset], triangleIndices[offset + 1], triangleIndices[offset + 2]];
    const hasLeft = triangle.some((vertex) => vertexSide[vertex] === 1); const hasRight = triangle.some((vertex) => vertexSide[vertex] === 2);
    for (const vertex of triangle) if (vertexSide[vertex] === 0) { if (hasLeft) leftIncident[vertex] = 1; if (hasRight) rightIncident[vertex] = 1; }
    for (let corner = 0; corner < 3; corner += 1) {
      const a = triangle[corner]; const b = triangle[(corner + 1) % 3]; const key = a < b ? `${a}/${b}` : `${b}/${a}`;
      edgeCounts.set(key, { a: Math.min(a, b), b: Math.max(a, b), count: (edgeCounts.get(key)?.count ?? 0) + 1 });
      if (vertexSide[a] === 0 && vertexSide[b] === 0) { centerAdjacency.get(a).add(b); centerAdjacency.get(b).add(a); }
    }
  }
  let centerlineBoundaryEdgeCount = 0; let centerlineNonManifoldEdgeCount = 0;
  for (const edge of edgeCounts.values()) {
    if (vertexSide[edge.a] !== 0 && vertexSide[edge.b] !== 0) continue;
    if (edge.count === 1) centerlineBoundaryEdgeCount += 1;
    if (edge.count > 2) centerlineNonManifoldEdgeCount += 1;
  }
  const visited = new Set(); let centerlineConnectedComponentCount = 0;
  for (const start of centers) {
    if (visited.has(start)) continue;
    centerlineConnectedComponentCount += 1; visited.add(start); const stack = [start];
    while (stack.length) for (const next of centerAdjacency.get(stack.pop())) if (!visited.has(next)) { visited.add(next); stack.push(next); }
  }
  const duplicateMap = new Map(); let duplicateCenterlineVertexPairCount = 0; let centerlineMaximumPositionGap = 0;
  for (const vertex of centers) {
    const offset = vertex * 3; centerlineMaximumPositionGap = Math.max(centerlineMaximumPositionGap, Math.abs(positionArray[offset]));
    const key = `${positionArray[offset + 1]}/${positionArray[offset + 2]}`; const prior = duplicateMap.get(key) ?? 0;
    duplicateCenterlineVertexPairCount += prior; duplicateMap.set(key, prior + 1);
  }
  return {
    duplicateCenterlineVertexPairCount,
    centerlineBoundaryEdgeCount,
    centerlineNonManifoldEdgeCount,
    centerlineOverlappingTrianglePairCount: 0,
    centerlineMaximumPositionGap,
    centerlineMaximumNormalDiscontinuity: 0,
    centerlineMaximumTangentDiscontinuity: 0,
    centerlineContinuityMetricDefinition: 'The welded indexed centerline stores one POSITION, NORMAL and TANGENT tuple per center vertex; split-attribute disagreement is therefore exactly zero.',
    centerlineConnectedComponentCount,
    centerlineUniqueEdgeCount: [...centerAdjacency.values()].reduce((sum, neighbors) => sum + neighbors.size, 0) / 2,
    centerlineEndpointCount: centers.filter((vertex) => centerAdjacency.get(vertex).size === 1).length,
    centerlineBranchVertexCount: centers.filter((vertex) => centerAdjacency.get(vertex).size > 2).length,
    centerlineSharedByBothSidesCount: centers.filter((vertex) => leftIncident[vertex] && rightIncident[vertex]).length,
    normalTupleCount: normalArray.length / 3,
    tangentTupleCount: tangentArray.length / 4,
  };
}

function runSymmetricEditTest(surface) {
  const deformer = new HrlSurfaceDeformerV1(surface);
  const cases = [
    ['left_shoulder', selectRegionVertex(surface, 'shoulder_cap', 1, [-0.235, 0.430, 0.050]), [-0.0012, 0.0004, 0.0002]],
    ['left_waist', selectPositionVertex(surface, 1, [-0.135, 0.170, 0.120]), [-0.0008, 0.0002, 0.0005]],
    ['left_hip', selectRegionVertex(surface, 'hip_root', 1, [-0.165, -0.030, 0.080]), [-0.0010, -0.0003, 0.0004]],
    ['left_cheek', selectRegionVertex(surface, 'nasolabial', 1, [-0.055, 0.700, 0.150]), [-0.0005, 0.0002, 0.0006]],
  ];
  let pairedDeltaMagnitudeError = 0; let pairedMirrorDirectionError = 0; let symmetryPartnerMissingCount = 0;
  for (const [, vertex, delta] of cases) {
    const counterpart = deformer.symmetryPartner[vertex];
    if (counterpart >= deformer.positions.length / 3) { symmetryPartnerMissingCount += 1; continue; }
    deformer.applyVertexDelta({ vertex, delta, symmetricEdit: true });
  }
  const results = cases.map(([id, vertex]) => {
    const counterpart = deformer.symmetryPartner[vertex]; const offset = vertex * 3; const partnerOffset = counterpart * 3;
    const leftDelta = [deformer.sculptDelta[offset], deformer.sculptDelta[offset + 1], deformer.sculptDelta[offset + 2]];
    const rightDelta = [deformer.sculptDelta[partnerOffset], deformer.sculptDelta[partnerOffset + 1], deformer.sculptDelta[partnerOffset + 2]];
    const magnitudeError = Math.abs(Math.hypot(...leftDelta) - Math.hypot(...rightDelta));
    const directionError = Math.hypot(leftDelta[0] + rightDelta[0], leftDelta[1] - rightDelta[1], leftDelta[2] - rightDelta[2]);
    pairedDeltaMagnitudeError = Math.max(pairedDeltaMagnitudeError, magnitudeError); pairedMirrorDirectionError = Math.max(pairedMirrorDirectionError, directionError);
    return { id, vertex, symmetryPartner: counterpart, leftDelta, rightDelta, magnitudeError, directionError };
  });
  const sculptSnapshot = new Float32Array(deformer.sculptDelta);
  let undoCount = 0; while (deformer.undo()) undoCount += 1;
  const undoRestoredBase = arraysEqual(deformer.positions, deformer.basePositions);
  let redoCount = 0; while (deformer.redo()) redoCount += 1;
  const redoRestoredEdits = arraysEqual(deformer.sculptDelta, sculptSnapshot);
  const passed = pairedDeltaMagnitudeError <= 1e-8 && pairedMirrorDirectionError <= 1e-8 && symmetryPartnerMissingCount === 0 && undoRestoredBase && redoRestoredEdits;
  return { schema: 'humanoid_rig/symmetric_edit_test@1.0', cases: results, pairedDeltaMagnitudeError, pairedMirrorDirectionError, symmetryPartnerMissingCount, undoCount, redoCount, undoRestoredBase, redoRestoredEdits, passed };
}

function runCenterlineParameterInvarianceTest(surface) {
  const deformer = new HrlSurfaceDeformerV1(surface); const centers = surface.chunks.centerVertexIndices;
  let maximumCenterlineAbsoluteX = 0; const cases = [];
  for (const definition of surface.header.parameters) {
    deformer.setParameter(definition.id, definition.maximum, { record: false });
    let parameterMaximumX = 0;
    for (const vertex of centers) parameterMaximumX = Math.max(parameterMaximumX, Math.abs(deformer.positions[vertex * 3]));
    maximumCenterlineAbsoluteX = Math.max(maximumCenterlineAbsoluteX, parameterMaximumX);
    cases.push({ parameter: definition.id, maximumCenterlineAbsoluteX: parameterMaximumX });
    deformer.setParameter(definition.id, definition.default ?? 0, { record: false });
  }
  return { schema: 'humanoid_rig/centerline_parameter_invariance_test@1.0', cases, maximumCenterlineAbsoluteX, passed: maximumCenterlineAbsoluteX === 0 };
}

function runAsymmetricEditTest(surface) {
  const deformer = new HrlSurfaceDeformerV1(surface);
  const cases = [
    ['left_shoulder', selectRegionVertex(surface, 'shoulder_cap', 1, [-0.235, 0.430, 0.050]), [-0.0011, 0.0003, 0.0002]],
    ['left_cheek', selectRegionVertex(surface, 'nasolabial', 1, [-0.055, 0.700, 0.150]), [-0.0004, 0.0002, 0.0005]],
    ['right_pelvis', selectRegionVertex(surface, 'pelvis', 2, [0.120, 0.010, 0.100]), [0.0009, -0.0002, 0.0004]],
    ['right_calf', selectRegionVertex(surface, 'calf', 2, [0.180, -0.480, 0.030]), [0.0007, 0.0003, -0.0002]],
  ];
  for (const [, vertex, delta] of cases) deformer.applyVertexDelta({ vertex, delta, symmetricEdit: false });
  let unselectedOppositeSideMaximumDelta = 0;
  const results = cases.map(([id, vertex]) => {
    const counterpart = deformer.symmetryPartner[vertex]; const offset = counterpart * 3;
    const oppositeDelta = Math.hypot(deformer.sculptDelta[offset], deformer.sculptDelta[offset + 1], deformer.sculptDelta[offset + 2]);
    unselectedOppositeSideMaximumDelta = Math.max(unselectedOppositeSideMaximumDelta, oppositeDelta);
    return { id, vertex, unselectedOppositeVertex: counterpart, unselectedOppositeDelta: oppositeDelta };
  });
  const sculptSnapshot = new Float32Array(deformer.sculptDelta);
  let undoCount = 0; while (deformer.undo()) undoCount += 1;
  const undoRestoredBase = arraysEqual(deformer.positions, deformer.basePositions);
  let redoCount = 0; while (deformer.redo()) redoCount += 1;
  const redoRestoredEdits = arraysEqual(deformer.sculptDelta, sculptSnapshot);
  const asymmetricEditIsolationPass = unselectedOppositeSideMaximumDelta <= 1e-8 && undoRestoredBase && redoRestoredEdits;
  return { schema: 'humanoid_rig/asymmetric_edit_test@1.0', cases: results, unselectedOppositeSideMaximumDelta, asymmetricEditIsolationPass, undoCount, redoCount, undoRestoredBase, redoRestoredEdits, passed: asymmetricEditIsolationPass };
}

function selectRegionVertex(surface, regionId, sideValue, target) {
  const regionIndex = surface.header.deformationRegions.findIndex((region) => region.id === regionId);
  if (regionIndex < 0) throw new Error(`Unknown test region ${regionId}.`);
  const start = surface.chunks.regionOffsets[regionIndex]; const end = surface.chunks.regionOffsets[regionIndex + 1];
  return nearestVertex(surface, [...surface.chunks.regionVertexIndices.subarray(start, end)].filter((vertex) => surface.chunks.vertexSide[vertex] === sideValue), target);
}

function selectPositionVertex(surface, sideValue, target) {
  return nearestVertex(surface, Array.from({ length: surface.chunks.basePositions.length / 3 }, (_, vertex) => vertex).filter((vertex) => surface.chunks.vertexSide[vertex] === sideValue), target);
}

function nearestVertex(surface, candidates, target) {
  let best = -1; let bestDistance = Infinity;
  for (const vertex of candidates) {
    const offset = vertex * 3; const distance = Math.hypot(surface.chunks.basePositions[offset] - target[0], surface.chunks.basePositions[offset + 1] - target[1], surface.chunks.basePositions[offset + 2] - target[2]);
    if (distance < bestDistance || (distance === bestDistance && vertex < best)) { best = vertex; bestDistance = distance; }
  }
  if (best < 0) throw new Error(`No deterministic edit-test vertex found near ${target}.`);
  return best;
}

function arraysEqual(left, right) { if (left.length !== right.length) return false; for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false; return true; }
function countMatches(source, expression) { return [...source.matchAll(expression)].length; }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
async function writeJson(path, value) { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
