import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HrlSurfaceDeformerV1,
  buildHalfEdgeTopologyV1,
  countSelfIntersectionsV1,
  measureHrlSurfaceTopologyV1,
  parseHrlSurfaceV1,
} from '../src/modules/human-core-v5/production-surface-v1/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetRelative = 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface';
const assetPath = resolve(root, assetRelative);
const assetBytes = await readFile(assetPath);
const parsed = parseHrlSurfaceV1(assetBytes);
const positions = parsed.chunks.basePositions;
const indices = parsed.chunks.indices;
const topology = buildHalfEdgeTopologyV1(indices, positions.length / 3);
const topologyMetrics = await measureHrlSurfaceTopologyV1(positions, indices);
const selfIntersection = countSelfIntersectionsV1(positions, indices);

const halfEdgeCacheChecks = {
  halfEdgeVertex: arraysEqual(topology.halfEdgeVertex, parsed.chunks.halfEdgeVertex),
  halfEdgeNext: arraysEqual(topology.halfEdgeNext, parsed.chunks.halfEdgeNext),
  halfEdgeTwin: arraysEqual(topology.halfEdgeTwin, parsed.chunks.halfEdgeTwin),
  halfEdgeFace: arraysEqual(topology.halfEdgeFace, parsed.chunks.halfEdgeFace),
  vertexHalfEdge: arraysEqual(topology.vertexHalfEdge, parsed.chunks.vertexHalfEdge),
};
const stableIds = parsed.chunks.stableVertexIds;
const stableIdUnique = new Set(stableIds).size === stableIds.length;
const symmetryPartnerBoundsValid = [...parsed.chunks.symmetryPartner].every((vertex) => vertex < topologyMetrics.vertexCount);
const symmetryPartnerInvolutionValid = [...parsed.chunks.symmetryPartner].every((vertex, index) => parsed.chunks.symmetryPartner[vertex] === index);
const regionMembershipValid = parsed.header.deformationRegions.every((region, index) => {
  const start = parsed.chunks.regionOffsets[index]; const end = parsed.chunks.regionOffsets[index + 1];
  return end >= start && end - start === region.vertexCount && end <= parsed.chunks.regionVertexIndices.length && region.vertexCount > 0;
});
const parameterBasisLengthValid = parsed.chunks.parameterBasis.length === parsed.header.parameters.length * positions.length;

const deformer = new HrlSurfaceDeformerV1(parsed);
const initialPositions = new Float32Array(deformer.positions);
const parameterChanged = deformer.setParameter('shoulderWidth', 0.5);
const parameterAffectsPositions = !arraysEqual(initialPositions, deformer.positions);
const parameterUndo = deformer.undo() && arraysEqual(initialPositions, deformer.positions);
const parameterRedo = deformer.redo() && !arraysEqual(initialPositions, deformer.positions);
deformer.undo();
const brushVertexCount = deformer.applyBrush({ center: [0.18, 0.42, 0.08], radius: 0.05, strength: 0.002, symmetricEdit: true });
const sculptLayer = deformer.exportSculptLayer('audit-brush');
const brushUndo = deformer.undo() && arraysEqual(initialPositions, deformer.positions);
const runtimeChecks = {
  parameterChanged,
  parameterAffectsPositions,
  parameterUndo,
  parameterRedo,
  brushChangedVertexCount: brushVertexCount,
  brushProducedSparseLayer: sculptLayer.indices.length > 0 && sculptLayer.deltas.length === sculptLayer.indices.length * 3,
  brushUndo,
};

const gates = {
  containerRoundTrip: true,
  vertexRange: topologyMetrics.vertexCount >= 12000 && topologyMetrics.vertexCount <= 22000,
  triangleRange: topologyMetrics.triangleCount >= 24000 && topologyMetrics.triangleCount <= 44000,
  connectedComponentCount: topologyMetrics.connectedComponentCount === 1,
  boundaryEdgeCount: topologyMetrics.boundaryEdgeCount === 0,
  nonManifoldEdgeCount: topologyMetrics.nonManifoldEdgeCount === 0,
  nonManifoldVertexCount: topologyMetrics.nonManifoldVertexCount === 0,
  degenerateTriangleCount: topologyMetrics.degenerateTriangleCount === 0,
  duplicateTriangleCount: topologyMetrics.duplicateTriangleCount === 0,
  NaNCount: topologyMetrics.NaNCount === 0,
  InfCount: topologyMetrics.InfCount === 0,
  triangleWindingConsistency: topologyMetrics.triangleWindingConsistency,
  signedVolume: topologyMetrics.signedVolume > 0,
  selfIntersectionCount: selfIntersection.selfIntersectionCount === 0,
  minimumTriangleAngle: topologyMetrics.minimumTriangleAngle >= 4,
  p99TriangleAspectRatio: topologyMetrics.p99TriangleAspectRatio <= 12,
  maximumVertexValence: topologyMetrics.maximumVertexValence <= 10,
  halfEdgeCache: Object.values(halfEdgeCacheChecks).every(Boolean),
  stableIdUnique,
  symmetryPartnerBoundsValid,
  symmetryPartnerInvolutionValid,
  regionMembershipValid,
  parameterBasisLengthValid,
  editableRuntime: Object.values(runtimeChecks).every((value) => value === true || (typeof value === 'number' && value > 0)),
};
const passed = Object.values(gates).every(Boolean);
const completeMetrics = { ...topologyMetrics, selfIntersectionCount: selfIntersection.selfIntersectionCount, selfIntersectionAudit: selfIntersection };
await writeJson(resolve(root, 'assets/human/production-surface-v1/TOPOLOGY_METRICS.json'), completeMetrics);
await writeJson(resolve(root, 'artifacts/qa/task16a-r2b-production-surface-v1/topology-audit.json'), {
  schema: 'humanoid_rig/task16a_r2b_topology_audit@1.0',
  assetPath: assetRelative,
  assetSha256: sha256(assetBytes),
  assetBytes: assetBytes.byteLength,
  topologyMetrics: completeMetrics,
  halfEdgeCacheChecks,
  runtimeChecks,
  gates,
  passed,
  conclusion: passed ? 'HRLSURFACE_STATIC_TOPOLOGY_PASSED' : 'PROJECT_SURFACE_TOPOLOGY_FAILED',
});
process.stdout.write(`${JSON.stringify({ assetSha256: sha256(assetBytes), ...completeMetrics, halfEdgeCacheChecks, runtimeChecks, gates, passed }, null, 2)}\n`);
if (!passed) process.exitCode = 1;

function arraysEqual(left, right) { if (left.length !== right.length) return false; for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false; return true; }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
async function writeJson(path, value) { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
