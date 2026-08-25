import { stableFingerprint } from '../core-utils.js';

export const SURFACE_REGION_BINDING_V5_SCHEMA = 'humanoid_rig/surface_region_binding@5.0';
export const MAX_SURFACE_REGION_INFLUENCES_V5 = 4;

export function createSurfaceRegionBindingV5(field, positions) {
  if (!(positions instanceof Float32Array)) throw new Error('SurfaceRegionBinding V5 requires Float32Array positions.');
  const regionNames = field.definition.regions.map((region) => region.regionId);
  const regionIndex = new Map(regionNames.map((name, index) => [name, index]));
  const vertexCount = positions.length / 3;
  const regionIds = new Uint16Array(vertexCount * MAX_SURFACE_REGION_INFLUENCES_V5);
  const regionBlendWeights = new Float32Array(vertexCount * MAX_SURFACE_REGION_INFLUENCES_V5);
  const bindLocalData = new Float32Array(vertexCount * 3);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const point = [positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]];
    const result = field.sample(point, { contributions: true });
    const contributions = result.contributions.slice(0, MAX_SURFACE_REGION_INFLUENCES_V5);
    let total = contributions.reduce((sum, entry) => sum + entry.weight, 0) || 1;
    for (let influence = 0; influence < MAX_SURFACE_REGION_INFLUENCES_V5; influence += 1) {
      const entry = contributions[influence] ?? contributions[0];
      const offset = vertex * MAX_SURFACE_REGION_INFLUENCES_V5 + influence;
      regionIds[offset] = regionIndex.get(entry?.regionId) ?? 0;
      regionBlendWeights[offset] = entry ? entry.weight / total : influence === 0 ? 1 : 0;
    }
    const primaryRegion = field.definition.regions[regionIds[vertex * MAX_SURFACE_REGION_INFLUENCES_V5]];
    const center = primitiveCenter(primaryRegion.primitive);
    bindLocalData.set(point.map((value, axis) => value - center[axis]), vertex * 3);
  }
  return {
    schema: SURFACE_REGION_BINDING_V5_SCHEMA,
    type: 'SurfaceRegionBinding',
    maximumInfluences: MAX_SURFACE_REGION_INFLUENCES_V5,
    source: 'canonical-body-field-contributions',
    runtimeNearestBoneSearch: false,
    modifiesRig: false,
    regionNames,
    regionIds,
    regionBlendWeights,
    bindLocalData,
    fingerprint: stableFingerprint({
      regionNames,
      regionIds: Array.from(regionIds),
      weights: Array.from(regionBlendWeights, (value) => Number(value.toFixed(6))),
    }),
  };
}

export function validateSurfaceRegionBindingV5(binding, vertexCount) {
  const errors = [];
  const flattenedSurface = Boolean(binding?.metadata?.regionBindingFingerprint && binding?.regionNames);
  if (binding?.schema !== SURFACE_REGION_BINDING_V5_SCHEMA && !flattenedSurface) errors.push('Invalid SurfaceRegionBinding schema.');
  if (!(binding?.regionIds instanceof Uint16Array) || binding.regionIds.length !== vertexCount * 4) errors.push('regionIds length is invalid.');
  if (!(binding?.regionBlendWeights instanceof Float32Array) || binding.regionBlendWeights.length !== vertexCount * 4) errors.push('regionBlendWeights length is invalid.');
  if (!(binding?.bindLocalData instanceof Float32Array) || binding.bindLocalData.length !== vertexCount * 3) errors.push('bindLocalData length is invalid.');
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    let total = 0;
    for (let influence = 0; influence < 4; influence += 1) total += binding.regionBlendWeights?.[vertex * 4 + influence] ?? 0;
    if (Math.abs(total - 1) > 1e-4) errors.push(`Vertex ${vertex} region weights are not normalized.`);
  }
  return { valid: errors.length === 0, errors };
}

function primitiveCenter(primitive) {
  if (primitive.center) return primitive.center;
  return primitive.start.map((value, axis) => (value + primitive.end[axis]) / 2);
}
