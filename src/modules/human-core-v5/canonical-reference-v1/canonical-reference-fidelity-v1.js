export const CANONICAL_REFERENCE_FIDELITY_V1_SCHEMA = 'humanoid_rig/canonical_reference_fidelity@1.0';

export const CANONICAL_REFERENCE_FIDELITY_THRESHOLDS_V1 = Object.freeze({
  maximumWorldPositionDelta: 1e-7,
  meanWorldPositionDelta: 1e-9,
  maximumWorldNormalDelta: 1e-6,
});

export function compareCanonicalReferenceFidelityV1(source, canonical, thresholds = CANONICAL_REFERENCE_FIDELITY_THRESHOLDS_V1) {
  if (!source?.positions || !canonical?.positions) throw new Error('Canonical fidelity comparison requires source and canonical static data.');
  const vertexCountIdentical = source.vertexCount === canonical.vertexCount;
  const triangleCountIdentical = source.triangleCount === canonical.triangleCount;
  const indexCountIdentical = source.indexCount === canonical.indexCount;
  const indexOrderIdentical = arraysEqual(source.indices, canonical.indices);
  const vertexOrderIdentical = arraysEqual(source.positions, canonical.positions);
  const normalOrderIdentical = arraysEqual(source.normals, canonical.normals);
  const worldPosition = vectorDeltas(source.worldPositions, canonical.worldPositions);
  const worldNormal = vectorDeltas(source.worldNormals, canonical.worldNormals);
  const result = {
    schema: CANONICAL_REFERENCE_FIDELITY_V1_SCHEMA,
    thresholds: { ...thresholds },
    sourceVertexCount: source.vertexCount,
    canonicalVertexCount: canonical.vertexCount,
    sourceTriangleCount: source.triangleCount,
    canonicalTriangleCount: canonical.triangleCount,
    sourceIndexCount: source.indexCount,
    canonicalIndexCount: canonical.indexCount,
    sourcePositionHash: source.positionHash,
    canonicalPositionHash: canonical.positionHash,
    sourceIndexHash: source.indexHash,
    canonicalIndexHash: canonical.indexHash,
    sourceNormalHash: source.normalHash,
    canonicalNormalHash: canonical.normalHash,
    sourceWorldSpacePositionHash: source.worldSpacePositionHash,
    canonicalWorldSpacePositionHash: canonical.worldSpacePositionHash,
    sourceWorldSpaceNormalHash: source.worldSpaceNormalHash,
    canonicalWorldSpaceNormalHash: canonical.worldSpaceNormalHash,
    vertexCountIdentical,
    triangleCountIdentical,
    indexCountIdentical,
    indexOrderIdentical,
    vertexOrderIdentical,
    normalOrderIdentical,
    indexHashIdentical: source.indexHash === canonical.indexHash,
    positionHashIdentical: source.positionHash === canonical.positionHash,
    normalHashIdentical: source.normalHash === canonical.normalHash,
    worldSpacePositionHashIdentical: source.worldSpacePositionHash === canonical.worldSpacePositionHash,
    worldSpaceNormalHashIdentical: source.worldSpaceNormalHash === canonical.worldSpaceNormalHash,
    maximumWorldPositionDelta: worldPosition.maximum,
    meanWorldPositionDelta: worldPosition.mean,
    maximumWorldNormalDelta: worldNormal.maximum,
    meanWorldNormalDelta: worldNormal.mean,
  };
  result.passed = vertexCountIdentical
    && triangleCountIdentical
    && indexCountIdentical
    && indexOrderIdentical
    && vertexOrderIdentical
    && normalOrderIdentical
    && result.indexHashIdentical
    && result.positionHashIdentical
    && result.normalHashIdentical
    && result.worldSpacePositionHashIdentical
    && result.worldSpaceNormalHashIdentical
    && result.maximumWorldPositionDelta <= thresholds.maximumWorldPositionDelta
    && result.meanWorldPositionDelta <= thresholds.meanWorldPositionDelta
    && result.maximumWorldNormalDelta <= thresholds.maximumWorldNormalDelta;
  return result;
}

export function calculateCanonicalReferenceDeviationV1(source, canonical) {
  if (source.vertexCount !== canonical.vertexCount) throw new Error('Deviation requires identical vertex counts.');
  const distances = new Float32Array(source.vertexCount);
  let maximum = 0;
  let sum = 0;
  for (let index = 0; index < source.vertexCount; index += 1) {
    const offset = index * 3;
    const distance = Math.hypot(
      source.worldPositions[offset] - canonical.worldPositions[offset],
      source.worldPositions[offset + 1] - canonical.worldPositions[offset + 1],
      source.worldPositions[offset + 2] - canonical.worldPositions[offset + 2],
    );
    distances[index] = distance;
    maximum = Math.max(maximum, distance);
    sum += distance;
  }
  return { distances, maximum, mean: distances.length ? sum / distances.length : 0 };
}

function vectorDeltas(left, right) {
  if (left.length !== right.length || left.length % 3 !== 0) return { maximum: Infinity, mean: Infinity };
  let maximum = 0;
  let sum = 0;
  for (let offset = 0; offset < left.length; offset += 3) {
    const delta = Math.hypot(left[offset] - right[offset], left[offset + 1] - right[offset + 1], left[offset + 2] - right[offset + 2]);
    maximum = Math.max(maximum, delta);
    sum += delta;
  }
  return { maximum, mean: left.length ? sum / (left.length / 3) : 0 };
}

function arraysEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) if (!Object.is(left[index], right[index])) return false;
  return true;
}
