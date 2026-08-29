export function applyRegionalOrientationBarrierV1({ restPositions, previousPositions, candidatePositions, indices, affectedMask, adjacency, profile }) {
  const output = new Float32Array(candidatePositions); const config = profile.orientationBarrier; const iterations = [];
  for (let iteration = 0; iteration < config.maximumIterations; iteration += 1) {
    const violations = findOrientationViolations(restPositions, previousPositions, output, indices, config.minimumAreaRatio); if (!violations.length) break;
    const direct = new Set(); for (const triangleId of violations) for (let corner = 0; corner < 3; corner += 1) { const vertex = indices[triangleId * 3 + corner]; if (affectedMask[vertex]) direct.add(vertex); }
    if (!direct.size) { iterations.push({ iteration, violationCount: violations.length, correctedVertexCount: 0, reason: 'violations-outside-regional-mask' }); break; }
    const neighbors = new Set(); for (const vertex of direct) for (const neighbor of adjacency[vertex] || []) if (affectedMask[neighbor] && !direct.has(neighbor)) neighbors.add(neighbor);
    for (const vertex of direct) blendVertexToward(output, previousPositions, vertex, config.correctionBlend); for (const vertex of neighbors) blendVertexToward(output, previousPositions, vertex, config.oneRingBlend);
    iterations.push({ iteration, violationCount: violations.length, correctedVertexCount: direct.size, oneRingCorrectedVertexCount: neighbors.size });
  }
  const finalViolations = findOrientationViolations(restPositions, previousPositions, output, indices, config.minimumAreaRatio); const minimumTriangleAreaRatio = minimumAreaRatio(restPositions, output, indices);
  return { outputPositions: output, metrics: { barrierId: 'RegionalOrientationBarrierV1', minimumAreaRatioThreshold: config.minimumAreaRatio, iterations, correctedTriangleCount: new Set(iterations.flatMap((record) => record.violationCount ? [record.violationCount] : [])).size, finalViolationCount: finalViolations.length, finalViolationTriangleIds: finalViolations, minimumTriangleAreaRatio, indexOrderModified: false, restPoseFreezeUsed: false, passed: finalViolations.length === 0 } };
}

export function findOrientationViolations(rest, previous, candidate, indices, minimumRatio = 0.08) {
  const result = [];
  for (let triangleId = 0; triangleId < indices.length / 3; triangleId += 1) {
    const ids = [indices[triangleId * 3], indices[triangleId * 3 + 1], indices[triangleId * 3 + 2]]; const r = ids.map((id) => read3(rest, id)); const p = ids.map((id) => read3(previous, id)); const c = ids.map((id) => read3(candidate, id));
    const restCross = cross(subtract(r[1], r[0]), subtract(r[2], r[0])); const previousCross = cross(subtract(p[1], p[0]), subtract(p[2], p[0])); const candidateCross = cross(subtract(c[1], c[0]), subtract(c[2], c[0]));
    const ratio = Math.hypot(...candidateCross) / Math.max(1e-20, Math.hypot(...restCross)); const continuity = dot(previousCross, candidateCross) / Math.max(1e-20, Math.hypot(...previousCross) * Math.hypot(...candidateCross));
    if (ratio < minimumRatio || continuity < -0.02) result.push(triangleId);
  }
  return result;
}

function minimumAreaRatio(rest, candidate, indices) { let minimum = Infinity; for (let offset = 0; offset < indices.length; offset += 3) { const ids = [indices[offset], indices[offset + 1], indices[offset + 2]]; const r = ids.map((id) => read3(rest, id)); const c = ids.map((id) => read3(candidate, id)); minimum = Math.min(minimum, triangleArea(...c) / Math.max(1e-20, triangleArea(...r))); } return Number.isFinite(minimum) ? minimum : 1; }
function blendVertexToward(output, target, vertex, alpha) { const offset = vertex * 3; for (let axis = 0; axis < 3; axis += 1) output[offset + axis] += (target[offset + axis] - output[offset + axis]) * alpha; }
function triangleArea(a, b, c) { return Math.hypot(...cross(subtract(b, a), subtract(c, a))) * 0.5; }
function read3(values, vertex) { const offset = vertex * 3; return [values[offset], values[offset + 1], values[offset + 2]]; }
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
