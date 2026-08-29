import { detectSelfIntersectionsForensicsV1 } from '../skinning-forensics-v1/self-intersection-detector-v1.js';

export function applyRegionalCollisionBarrierV1({ previousPositions, candidatePositions, indices, affectedMask, adjacency, regionResolver, intentionalContact, profile }) {
  const output = new Float32Array(candidatePositions); const config = profile.collisionBarrier; const iterations = []; let latest = detect(output);
  for (let iteration = 0; iteration < config.maximumIterations && latest.criticalSelfIntersectionCount > 0; iteration += 1) {
    const direct = new Set();
    for (const pair of latest.intersections) for (const triangleId of [pair.triangleA, pair.triangleB]) for (let corner = 0; corner < 3; corner += 1) { const vertex = indices[triangleId * 3 + corner]; if (affectedMask[vertex]) direct.add(vertex); }
    if (!direct.size) { iterations.push({ iteration, criticalBefore: latest.criticalSelfIntersectionCount, correctedVertexCount: 0, reason: 'intersections-outside-regional-mask' }); break; }
    const neighbors = new Set(); for (const vertex of direct) for (const neighbor of adjacency[vertex] || []) if (affectedMask[neighbor] && !direct.has(neighbor)) neighbors.add(neighbor);
    let maximumCorrection = 0; for (const vertex of direct) maximumCorrection = Math.max(maximumCorrection, limitedBlendToward(output, previousPositions, vertex, config.correctionBlend, config.maximumSingleIterationCorrection));
    for (const vertex of neighbors) limitedBlendToward(output, previousPositions, vertex, config.oneRingBlend, config.maximumSingleIterationCorrection * 0.5);
    const before = latest.criticalSelfIntersectionCount; latest = detect(output); iterations.push({ iteration, criticalBefore: before, criticalAfter: latest.criticalSelfIntersectionCount, correctedVertexCount: direct.size, oneRingCorrectedVertexCount: neighbors.size, maximumCorrection });
  }
  return { outputPositions: output, metrics: { barrierId: 'RegionalCollisionBarrierV1', iterations, criticalSelfIntersectionCount: latest.criticalSelfIntersectionCount, intentionalContactCount: intentionalContact ? latest.contactCount : 0, unclassifiedContactCount: intentionalContact ? 0 : latest.contactCount, contacts: latest.contacts, criticalIntersections: latest.intersections, maximumSingleIterationCorrection: config.maximumSingleIterationCorrection, pointAndEdgeContactPushed: false, temporalReferenceUsed: true, passed: latest.criticalSelfIntersectionCount === 0 } };

  function detect(positions) { return detectSelfIntersectionsForensicsV1(positions, indices, { cellSize: config.cellSize, epsilon: config.epsilon, regionResolver }); }
}

function limitedBlendToward(output, target, vertex, alpha, maximum) { const offset = vertex * 3; const delta = [target[offset] - output[offset], target[offset + 1] - output[offset + 1], target[offset + 2] - output[offset + 2]]; const length = Math.hypot(...delta); const scale = length > 1e-12 ? Math.min(alpha, maximum / length) : 0; for (let axis = 0; axis < 3; axis += 1) output[offset + axis] += delta[axis] * scale; return length * scale; }
