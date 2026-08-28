import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractCanonicalReferenceStaticDataV1,
  findCanonicalReferenceBodyV1,
  parseCanonicalReferenceGlbV1,
} from '../src/modules/human-core-v5/canonical-reference-v1/index.js';
import { parseHrlSurfaceV1 } from '../src/modules/human-core-v5/production-surface-v1/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const referenceRelative = 'assets/human/canonical-reference-v1/makehuman-reference-neutral-static-v1.glb';
const productionRelative = 'assets/human/production-surface-v1/humanoid-rig-production-neutral-v1.hrlsurface';
const generatorRelative = 'scripts/generate-production-surface-v1.mjs';
const provenancePath = resolve(root, 'assets/human/production-surface-v1/PROVENANCE_AND_AUTHORING_RECORD.json');
const outputPath = resolve(root, 'artifacts/qa/task16a-r2b-production-surface-v1/project-authoring-audit.json');

const [referenceBytes, productionBytes, generatorSource, provenanceSource] = await Promise.all([
  readFile(resolve(root, referenceRelative)),
  readFile(resolve(root, productionRelative)),
  readFile(resolve(root, generatorRelative), 'utf8'),
  readFile(provenancePath, 'utf8'),
]);
const referenceParsed = parseCanonicalReferenceGlbV1(referenceBytes, { assetPath: referenceRelative });
const reference = await extractCanonicalReferenceStaticDataV1(referenceParsed, findCanonicalReferenceBodyV1(referenceParsed));
const production = parseHrlSurfaceV1(productionBytes);
const productionPositions = production.chunks.basePositions;
const productionNormals = production.chunks.baseNormals;
const productionIndices = production.chunks.indices;

const referencePositionKeys = makeVectorKeySet(reference.worldPositions);
const referenceNormalKeys = makeVectorKeySet(reference.worldNormals);
let exactCopiedPositionCount = 0; let exactCopiedNormalCount = 0;
for (let offset = 0; offset < productionPositions.length; offset += 3) {
  if (referencePositionKeys.has(vectorKey(productionPositions, offset))) exactCopiedPositionCount += 1;
  if (referenceNormalKeys.has(vectorKey(productionNormals, offset))) exactCopiedNormalCount += 1;
}
const exactCopiedIndexTripletCount = countExactIndexTriplets(reference.indices, productionIndices);
const exactCopiedTriangleCount = countExactCoordinateTriangles(reference.worldPositions, reference.indices, productionPositions, productionIndices);

const kdTree = buildKdTree(reference.worldPositions, Array.from({ length: reference.vertexCount }, (_, index) => index));
const nearestReferenceVertex = new Uint32Array(productionPositions.length / 3);
let nearestReferenceVertexExactMatchCount = 0;
for (let vertex = 0; vertex < nearestReferenceVertex.length; vertex += 1) {
  const offset = vertex * 3; const nearest = findNearestVertex(kdTree, reference.worldPositions, productionPositions[offset], productionPositions[offset + 1], productionPositions[offset + 2]);
  nearestReferenceVertex[vertex] = nearest.index;
  if (nearest.distanceSquared === 0) nearestReferenceVertexExactMatchCount += 1;
}

const triangleBvh = buildTriangleBvh(reference.worldPositions, reference.indices, Array.from({ length: reference.triangleCount }, (_, index) => index));
let productionVerticesOnReferenceSurfaceWithin1e7Count = 0; let productionVerticesOnReferenceSurfaceWithin1e5Count = 0;
let maximumNearestReferenceSurfaceDistance = 0; let sumNearestReferenceSurfaceDistance = 0;
for (let vertex = 0; vertex < productionPositions.length / 3; vertex += 1) {
  const offset = vertex * 3; const squared = nearestTriangleDistanceSquared(triangleBvh, reference.worldPositions, reference.indices, productionPositions[offset], productionPositions[offset + 1], productionPositions[offset + 2]);
  const distance = Math.sqrt(squared); maximumNearestReferenceSurfaceDistance = Math.max(maximumNearestReferenceSurfaceDistance, distance); sumNearestReferenceSurfaceDistance += distance;
  if (distance <= 1e-7) productionVerticesOnReferenceSurfaceWithin1e7Count += 1;
  if (distance <= 1e-5) productionVerticesOnReferenceSurfaceWithin1e5Count += 1;
}
const referenceTriangleKeys = new Set();
for (let offset = 0; offset < reference.indices.length; offset += 3) referenceTriangleKeys.add(unorderedIndexKey(reference.indices[offset], reference.indices[offset + 1], reference.indices[offset + 2]));
let referenceTrianglesTopologicallyReproducedCount = 0;
for (let offset = 0; offset < productionIndices.length; offset += 3) {
  const key = unorderedIndexKey(nearestReferenceVertex[productionIndices[offset]], nearestReferenceVertex[productionIndices[offset + 1]], nearestReferenceVertex[productionIndices[offset + 2]]);
  if (referenceTriangleKeys.has(key)) referenceTrianglesTopologicallyReproducedCount += 1;
}

const trace = [
  traceEntry('parseCanonicalReferenceGlbV1(referenceBytes', 'Reference GLB JSON and binary container parsed.'),
  traceEntry('extractCanonicalReferenceStaticDataV1(referenceParsed', 'POSITION, NORMAL and index accessors read; positions and normals transformed to world space.'),
  traceEntry('authorProjectNeutralShape(referenceData.worldPositions)', 'Reference world positions used as the input surface for the project neutral-shape field.'),
  traceEntry('computeVertexNormalsV1(neutralShape.positions, referenceData.indices)', 'Reference index connectivity used to recompute normals after project shape fields.'),
  traceEntry('refineBilateralTopology(neutralShape.positions, neutralNormals, referenceData.indices', 'Reference connectivity used as the seed for full bilateral semantic-constrained edge refinement.'),
  traceEntry('optimizeLowAngleTopology(refined.positions, refined.indices', 'Refined project connectivity locally optimized; no nearest-reference projection.'),
  traceEntry('relabelGeometry(positionOptimized.positions, qualityOptimized.indices', 'Final project vertex and triangle order deterministically relabelled.'),
];

const provenanceTruth = {
  referenceAssetUsed: true,
  referenceAssetPath: referenceRelative,
  referenceAssetLicense: 'CC0-1.0',
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
  directPositionArrayCopied: false,
  directIndexArrayCopied: false,
  directNormalArrayCopied: false,
  oneToOneVertexMappingAvailable: false,
  projectTopologyGenerated: true,
  projectShapeGenerated: true,
  projectAuthoredTopology: true,
  cleanRoomIndependent: false,
  derivedWithCC0Reference: true,
};
const report = {
  schema: 'humanoid_rig/task16a_r2b_project_authoring_audit@1.0',
  ...provenanceTruth,
  referenceAssetSha256: sha256(referenceBytes),
  productionAssetSha256: sha256(productionBytes),
  referenceVertexCount: reference.vertexCount,
  productionVertexCount: productionPositions.length / 3,
  referenceTriangleCount: reference.triangleCount,
  productionTriangleCount: productionIndices.length / 3,
  exactCopiedPositionCount,
  exactCopiedNormalCount,
  exactCopiedTriangleCount,
  exactCopiedIndexTripletCount,
  nearestReferenceVertexExactMatchCount,
  productionVerticesOnReferenceSurfaceWithin1e7Count,
  productionVerticesOnReferenceSurfaceWithin1e5Count,
  maximumNearestReferenceSurfaceDistance,
  meanNearestReferenceSurfaceDistance: sumNearestReferenceSurfaceDistance / (productionPositions.length / 3),
  referenceTrianglesTopologicallyReproducedCount,
  referenceTrianglesTopologicallyReproducedMetricDefinition: 'Production triangles whose three nearest reference-vertex IDs form an unordered reference triangle. This is a transparency metric, not a copyright threshold.',
  topologyGraphIsomorphismStatus: 'NOT_ISOMORPHIC_VERTEX_AND_TRIANGLE_COUNTS_DIFFER',
  generatorReferenceReadTrace: trace,
  positionHash: sha256(typedBytes(productionPositions)),
  indexHash: sha256(typedBytes(productionIndices)),
  fullBilateralReconstructionAgainstCommit7dc897e: {
    rejectedPositionHash: '7CFD43193343554105E20AB5C211B48DC2BE5CCAE4D28A200189B5EBA1974742',
    preservedIndexHash: '9DF6A9E20CEEF14A97697F53E7D691FF236FC25681F85A0E35A7F4B2B0CC8AF8',
    positionHashChangedFromRejectedSurface: sha256(typedBytes(productionPositions)) !== '7CFD43193343554105E20AB5C211B48DC2BE5CCAE4D28A200189B5EBA1974742',
    closedFullBodyConnectivityPreserved: sha256(typedBytes(productionIndices)) === '9DF6A9E20CEEF14A97697F53E7D691FF236FC25681F85A0E35A7F4B2B0CC8AF8',
    authorityIsFullBilateral: production.header.assetIdentity === 'HRLFullBilateralSurfaceV1',
    changeAuthorization: 'Task 16A R2B Full Bilateral Reconstruction explicitly replaces the rejected centerline positions and symmetry authority while preserving valid closed-body connectivity.',
  },
  conclusion: 'PROJECT_AUTHORING_PROVENANCE_COMPLETE_DERIVED_WITH_CC0_REFERENCE',
};
const previousProvenance = JSON.parse(provenanceSource);
await Promise.all([
  writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  writeFile(provenancePath, `${JSON.stringify({ ...previousProvenance, ...provenanceTruth, sourceTopologyReused: true, directArrayComparisonResult: { ...previousProvenance.directArrayComparisonResult, exactCopiedPositionCount, exactCopiedNormalCount, exactCopiedTriangleCount, exactCopiedIndexTripletCount, nearestReferenceVertexExactMatchCount, productionVerticesOnReferenceSurfaceWithin1e7Count, productionVerticesOnReferenceSurfaceWithin1e5Count, referenceTrianglesTopologicallyReproducedCount, topologyGraphIsomorphismStatus: report.topologyGraphIsomorphismStatus } }, null, 2)}\n`, 'utf8'),
]);
if (!report.fullBilateralReconstructionAgainstCommit7dc897e.positionHashChangedFromRejectedSurface || !report.fullBilateralReconstructionAgainstCommit7dc897e.closedFullBodyConnectivityPreserved || !report.fullBilateralReconstructionAgainstCommit7dc897e.authorityIsFullBilateral) throw new Error('Full bilateral reconstruction provenance gate failed.');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

function traceEntry(needle, effect) { const index = generatorSource.indexOf(needle); return { file: generatorRelative, line: index < 0 ? null : generatorSource.slice(0, index).split('\n').length, call: needle, effect }; }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
function typedBytes(array) { return new Uint8Array(array.buffer, array.byteOffset, array.byteLength); }
function vectorKey(array, offset) { return `${array[offset]}/${array[offset + 1]}/${array[offset + 2]}`; }
function makeVectorKeySet(array) { const result = new Set(); for (let offset = 0; offset < array.length; offset += 3) result.add(vectorKey(array, offset)); return result; }
function unorderedIndexKey(a, b, c) { const values = [a, b, c].sort((left, right) => left - right); return `${values[0]}/${values[1]}/${values[2]}`; }
function countExactIndexTriplets(referenceIndices, productionIndices) { const keys = new Set(); for (let offset = 0; offset < referenceIndices.length; offset += 3) keys.add(`${referenceIndices[offset]}/${referenceIndices[offset + 1]}/${referenceIndices[offset + 2]}`); let count = 0; for (let offset = 0; offset < productionIndices.length; offset += 3) if (keys.has(`${productionIndices[offset]}/${productionIndices[offset + 1]}/${productionIndices[offset + 2]}`)) count += 1; return count; }
function countExactCoordinateTriangles(referencePositions, referenceIndices, productionPositionsValue, productionIndicesValue) { const keys = new Set(); for (let offset = 0; offset < referenceIndices.length; offset += 3) keys.add(coordinateTriangleKey(referencePositions, referenceIndices[offset], referenceIndices[offset + 1], referenceIndices[offset + 2])); let count = 0; for (let offset = 0; offset < productionIndicesValue.length; offset += 3) if (keys.has(coordinateTriangleKey(productionPositionsValue, productionIndicesValue[offset], productionIndicesValue[offset + 1], productionIndicesValue[offset + 2]))) count += 1; return count; }
function coordinateTriangleKey(positions, a, b, c) { return [vectorKey(positions, a * 3), vectorKey(positions, b * 3), vectorKey(positions, c * 3)].sort().join('|'); }

function buildKdTree(positions, vertices, depth = 0) { if (!vertices.length) return null; const axis = depth % 3; vertices.sort((left, right) => positions[left * 3 + axis] - positions[right * 3 + axis]); const middle = vertices.length >> 1; return { index: vertices[middle], axis, left: buildKdTree(positions, vertices.slice(0, middle), depth + 1), right: buildKdTree(positions, vertices.slice(middle + 1), depth + 1) }; }
function findNearestVertex(rootNode, positions, x, y, z) { let bestIndex = -1; let bestDistanceSquared = Infinity; visit(rootNode); return { index: bestIndex, distanceSquared: bestDistanceSquared }; function visit(node) { if (!node) return; const offset = node.index * 3; const dx = positions[offset] - x; const dy = positions[offset + 1] - y; const dz = positions[offset + 2] - z; const squared = dx * dx + dy * dy + dz * dz; if (squared < bestDistanceSquared) { bestDistanceSquared = squared; bestIndex = node.index; } const delta = [x - positions[offset], y - positions[offset + 1], z - positions[offset + 2]][node.axis]; const first = delta <= 0 ? node.left : node.right; const second = delta <= 0 ? node.right : node.left; visit(first); if (delta * delta < bestDistanceSquared) visit(second); } }

function buildTriangleBvh(positions, indices, triangles) { const bounds = triangleBounds(positions, indices, triangles); if (triangles.length <= 12) return { ...bounds, triangles }; const extents = [bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ]; const axis = extents.indexOf(Math.max(...extents)); triangles.sort((left, right) => triangleCentroid(positions, indices, left, axis) - triangleCentroid(positions, indices, right, axis)); const middle = triangles.length >> 1; return { ...bounds, left: buildTriangleBvh(positions, indices, triangles.slice(0, middle)), right: buildTriangleBvh(positions, indices, triangles.slice(middle)) }; }
function triangleBounds(positions, indices, triangles) { let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity; for (const triangle of triangles) for (let corner = 0; corner < 3; corner += 1) { const offset = indices[triangle * 3 + corner] * 3; minX=Math.min(minX,positions[offset]);minY=Math.min(minY,positions[offset+1]);minZ=Math.min(minZ,positions[offset+2]);maxX=Math.max(maxX,positions[offset]);maxY=Math.max(maxY,positions[offset+1]);maxZ=Math.max(maxZ,positions[offset+2]); } return {minX,minY,minZ,maxX,maxY,maxZ}; }
function triangleCentroid(positions, indices, triangle, axis) { return (positions[indices[triangle * 3] * 3 + axis] + positions[indices[triangle * 3 + 1] * 3 + axis] + positions[indices[triangle * 3 + 2] * 3 + axis]) / 3; }
function nearestTriangleDistanceSquared(rootNode, positions, indices, x, y, z) { let best = Infinity; visit(rootNode); return best; function visit(node) { if (!node || pointBoxDistanceSquared(node, x, y, z) > best) return; if (node.triangles) { for (const triangle of node.triangles) best = Math.min(best, pointTriangleDistanceSquared(positions, indices, triangle, x, y, z)); return; } const leftDistance = pointBoxDistanceSquared(node.left, x, y, z); const rightDistance = pointBoxDistanceSquared(node.right, x, y, z); if (leftDistance <= rightDistance) { visit(node.left); visit(node.right); } else { visit(node.right); visit(node.left); } } }
function pointBoxDistanceSquared(box, x, y, z) { const dx = x < box.minX ? box.minX - x : x > box.maxX ? x - box.maxX : 0; const dy = y < box.minY ? box.minY - y : y > box.maxY ? y - box.maxY : 0; const dz = z < box.minZ ? box.minZ - z : z > box.maxZ ? z - box.maxZ : 0; return dx * dx + dy * dy + dz * dz; }
function pointTriangleDistanceSquared(positions, indices, triangle, px, py, pz) { const ao=indices[triangle*3]*3,bo=indices[triangle*3+1]*3,co=indices[triangle*3+2]*3; const ax=positions[ao],ay=positions[ao+1],az=positions[ao+2],bx=positions[bo],by=positions[bo+1],bz=positions[bo+2],cx=positions[co],cy=positions[co+1],cz=positions[co+2]; const abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az,apx=px-ax,apy=py-ay,apz=pz-az; const d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz; if(d1<=0&&d2<=0)return apx*apx+apy*apy+apz*apz; const bpx=px-bx,bpy=py-by,bpz=pz-bz,d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz; if(d3>=0&&d4<=d3)return bpx*bpx+bpy*bpy+bpz*bpz; const vc=d1*d4-d3*d2; if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return squared(px-(ax+v*abx),py-(ay+v*aby),pz-(az+v*abz));} const cpx=px-cx,cpy=py-cy,cpz=pz-cz,d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz; if(d6>=0&&d5<=d6)return cpx*cpx+cpy*cpy+cpz*cpz; const vb=d5*d2-d1*d6; if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return squared(px-(ax+w*acx),py-(ay+w*acy),pz-(az+w*acz));} const va=d3*d6-d5*d4; if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return squared(px-(bx+w*(cx-bx)),py-(by+w*(cy-by)),pz-(bz+w*(cz-bz)));} const denominator=1/(va+vb+vc),v=vb*denominator,w=vc*denominator;return squared(px-(ax+abx*v+acx*w),py-(ay+aby*v+acy*w),pz-(az+abz*v+acz*w)); }
function squared(x, y, z) { return x * x + y * y + z * z; }
