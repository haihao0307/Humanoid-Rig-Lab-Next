import { PROCEDURAL_DEFORM_POLICY_V5 } from './procedural-deform-policy-v5.js';

export const PROCEDURAL_DEFORM_FRAME_V5_SCHEMA = 'humanoid_rig/procedural_deform_frame@5.0';
export const RENDERER_ADAPTER_INPUT_V5_SCHEMA = 'humanoid_rig/renderer_adapter_input@5.0';

export function createProceduralDeformFrameV5({
  metadata, deformedPositions, deformedNormals, indices, regionIds, regionBlendWeights,
  regionDiagnostics = {}, deformationDiagnostics = {}, timestamp = Date.now(),
} = {}) {
  const vertexCount = metadata?.vertexCount ?? 0;
  if (!(deformedPositions instanceof Float32Array) || deformedPositions.length !== vertexCount * 3) throw new Error('ProceduralDeformFrame positions are invalid.');
  if (!(deformedNormals instanceof Float32Array) || deformedNormals.length !== vertexCount * 3) throw new Error('ProceduralDeformFrame normals are invalid.');
  if (!(indices instanceof Uint32Array)) throw new Error('ProceduralDeformFrame indices must be Uint32Array.');
  const frame = {
    schema: PROCEDURAL_DEFORM_FRAME_V5_SCHEMA,
    schemaVersion: 5,
    type: 'ProceduralDeformFrame',
    surfaceCacheKey: metadata.cacheKey,
    topologyFingerprint: metadata.topologyFingerprint,
    poseAuthority: 'finalPose.localRotations',
    deformationPolicy: PROCEDURAL_DEFORM_POLICY_V5.policyId,
    deformedPositions,
    deformedNormals,
    indices,
    regionIds,
    regionBlendWeights,
    bounds: calculateBounds(deformedPositions),
    regionDiagnostics,
    deformationDiagnostics,
    timestamp: Number(timestamp) || 0,
  };
  assertProceduralDeformFrameV5(frame);
  return frame;
}
export function assertProceduralDeformFrameV5(value) {
  if (value?.schema !== PROCEDURAL_DEFORM_FRAME_V5_SCHEMA) throw new Error('Invalid ProceduralDeformFrame V5 schema.');
  if (value.poseAuthority !== 'finalPose.localRotations') throw new Error('ProceduralDeformFrame pose authority must be finalPose.localRotations.');
  if (value.deformedPositions.some((item) => !Number.isFinite(item))) throw new Error('ProceduralDeformFrame contains non-finite positions.');
  for (let offset = 0; offset < value.deformedNormals.length; offset += 3) {
    const length = Math.hypot(value.deformedNormals[offset], value.deformedNormals[offset + 1], value.deformedNormals[offset + 2]);
    if (!Number.isFinite(length) || Math.abs(length - 1) > 2e-3) throw new Error(`ProceduralDeformFrame normal ${offset / 3} is not normalized.`);
  }
  return value;
}

export function createRendererAdapterInputV5(frame) {
  assertProceduralDeformFrameV5(frame);
  return {
    schema: RENDERER_ADAPTER_INPUT_V5_SCHEMA,
    schemaVersion: 5,
    type: 'RendererAdapterInput',
    cacheKey: frame.surfaceCacheKey,
    topologyFingerprint: frame.topologyFingerprint,
    positions: frame.deformedPositions,
    normals: frame.deformedNormals,
    indices: frame.indices,
    regionIds: frame.regionIds,
    bounds: frame.bounds,
    poseAuthority: frame.poseAuthority,
  };
}

function calculateBounds(positions) {
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (let offset = 0; offset < positions.length; offset += 3) for (let axis = 0; axis < 3; axis += 1) { min[axis] = Math.min(min[axis], positions[offset + axis]); max[axis] = Math.max(max[axis], positions[offset + axis]); }
  return { min, max, size: max.map((value, axis) => value - min[axis]) };
}
