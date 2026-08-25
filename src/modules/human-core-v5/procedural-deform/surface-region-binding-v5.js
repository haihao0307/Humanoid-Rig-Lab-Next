import { stableFingerprint } from '../core-utils.js';

export const SURFACE_REGION_BINDING_V5_SCHEMA = 'humanoid_rig/surface_region_binding@5.0';
export const MAX_SURFACE_REGION_INFLUENCES_V5 = 4;

export function createSurfaceRegionBindingV5(field, positions, { contributionPositions = positions } = {}) {
  if (!(positions instanceof Float32Array)) throw new Error('SurfaceRegionBinding V5 requires Float32Array positions.');
  if (!(contributionPositions instanceof Float32Array) || contributionPositions.length !== positions.length) {
    throw new Error('SurfaceRegionBinding V5 contribution positions must match the canonical surface.');
  }
  const regionNames = field.definition.regions.map((region) => region.regionId);
  const regionIndex = new Map(regionNames.map((name, index) => [name, index]));
  const vertexCount = positions.length / 3;
  const regionIds = new Uint16Array(vertexCount * MAX_SURFACE_REGION_INFLUENCES_V5);
  const regionBlendWeights = new Float32Array(vertexCount * MAX_SURFACE_REGION_INFLUENCES_V5);
  const regionAxialU = new Float32Array(vertexCount * MAX_SURFACE_REGION_INFLUENCES_V5);
  const bindLocalData = new Float32Array(vertexCount * 3);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const point = [positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]];
    const contributionPoint = [contributionPositions[vertex * 3], contributionPositions[vertex * 3 + 1], contributionPositions[vertex * 3 + 2]];
    const result = field.sample(contributionPoint, { contributions: true });
    const contributions = selectStableAnatomicalContributions(result, contributionPoint, field.definition.canonicalLayout)
      .slice(0, MAX_SURFACE_REGION_INFLUENCES_V5);
    const total = contributions.reduce((sum, entry) => sum + entry.weight, 0) || 1;
    for (let influence = 0; influence < MAX_SURFACE_REGION_INFLUENCES_V5; influence += 1) {
      const entry = contributions[influence];
      const fallback = entry ?? contributions[0];
      const offset = vertex * MAX_SURFACE_REGION_INFLUENCES_V5 + influence;
      regionIds[offset] = regionIndex.get(fallback?.regionId) ?? 0;
      regionBlendWeights[offset] = entry ? entry.weight / total : 0;
      const influenceRegion = field.definition.regions[regionIds[offset]];
      regionAxialU[offset] = primitiveAxialCoordinate(influenceRegion?.primitive, point);
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
    regionAxialU,
    bindLocalData,
    fingerprint: stableFingerprint({
      regionNames,
      regionIds: Array.from(regionIds),
      weights: Array.from(regionBlendWeights, (value) => Number(value.toFixed(6))),
      axialU: Array.from(regionAxialU, (value) => Number(value.toFixed(6))),
    }),
  };
}

export function validateSurfaceRegionBindingV5(binding, vertexCount) {
  const errors = [];
  const flattenedSurface = Boolean(binding?.metadata?.regionBindingFingerprint && binding?.regionNames);
  if (binding?.schema !== SURFACE_REGION_BINDING_V5_SCHEMA && !flattenedSurface) errors.push('Invalid SurfaceRegionBinding schema.');
  if (!(binding?.regionIds instanceof Uint16Array) || binding.regionIds.length !== vertexCount * 4) errors.push('regionIds length is invalid.');
  if (!(binding?.regionBlendWeights instanceof Float32Array) || binding.regionBlendWeights.length !== vertexCount * 4) errors.push('regionBlendWeights length is invalid.');
  if (!(binding?.regionAxialU instanceof Float32Array) || binding.regionAxialU.length !== vertexCount * 4) errors.push('regionAxialU length is invalid.');
  if (!(binding?.bindLocalData instanceof Float32Array) || binding.bindLocalData.length !== vertexCount * 3) errors.push('bindLocalData length is invalid.');
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    let total = 0;
    for (let influence = 0; influence < 4; influence += 1) total += binding.regionBlendWeights?.[vertex * 4 + influence] ?? 0;
    if (Math.abs(total - 1) > 1e-4) errors.push(`Vertex ${vertex} region weights are not normalized.`);
  }
  return { valid: errors.length === 0, errors };
}

export function rebaseSurfaceRegionBindingV5(binding, positions, fieldDefinition) {
  if (!(positions instanceof Float32Array) || positions.length !== binding.regionIds.length / 4 * 3) {
    throw new Error('SurfaceRegionBinding rebase positions do not match the binding vertex count.');
  }
  const regionById = new Map(fieldDefinition.regions.map((region) => [region.regionId, region]));
  const bindLocalData = new Float32Array(positions.length);
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const regionName = binding.regionNames[binding.regionIds[vertex * 4]];
    const region = regionById.get(regionName);
    const center = primitiveCenter(region.primitive);
    bindLocalData.set([
      positions[vertex * 3] - center[0],
      positions[vertex * 3 + 1] - center[1],
      positions[vertex * 3 + 2] - center[2],
    ], vertex * 3);
  }
  return { ...binding, bindLocalData };
}

function primitiveCenter(primitive) {
  if (primitive.center) return primitive.center;
  return primitive.start.map((value, axis) => (value + primitive.end[axis]) / 2);
}

function primitiveAxialCoordinate(primitive, point) {
  if (!primitive?.start || !primitive?.end) return 0;
  const axis = primitive.end.map((value, index) => value - primitive.start[index]);
  const lengthSquared = axis.reduce((sum, value) => sum + value * value, 0);
  if (lengthSquared <= 1e-12) return 0;
  const projection = point.reduce((sum, value, index) => sum + (value - primitive.start[index]) * axis[index], 0);
  return Math.min(1, Math.max(0, projection / lengthSquared));
}

function selectStableAnatomicalContributions(result, point, layout) {
  if (!Array.isArray(result?.allContributions) || !layout) {
    return result.contributions;
  }
  const side = point[0] < 0 ? 'left' : 'right';
  if (point[1] > layout.hipY + layout.height * 0.140) {
    const upperBody = result.contributions.map((entry) => ({ ...entry }));
    stabilizeShoulderTorsoWeights(upperBody, point, layout, side);
    return upperBody.sort((left, right) => right.weight - left.weight || left.regionId.localeCompare(right.regionId));
  }
  const allowed = point[1] >= layout.kneeY - layout.height * 0.040
    ? new Set(['pelvis', 'lowerTorso', `${side}Thigh`, `${side}Calf`])
    : new Set([`${side}Thigh`, `${side}Calf`, `${side}Foot`, 'pelvis']);
  const selected = result.allContributions.filter((entry) => allowed.has(entry.regionId)).map((entry) => ({ ...entry }));
  if (selected.length !== MAX_SURFACE_REGION_INFLUENCES_V5) return result.contributions;
  stabilizeLegSegmentWeights(selected, point, layout, side);
  stabilizeMedialGroinWeights(selected, point, layout, side);
  return selected.sort((left, right) => right.weight - left.weight || left.regionId.localeCompare(right.regionId));
}

function stabilizeShoulderTorsoWeights(contributions, point, layout, side) {
  const upperArm = contributions.find((entry) => entry.regionId === `${side}UpperArm`);
  const upperTorso = contributions.find((entry) => entry.regionId === 'upperTorso');
  if (!upperArm || !upperTorso) return;
  // The side chest below the axillary fold is torso tissue. Let arm influence
  // ramp in only as vertices approach the shoulder line so a high arm raise
  // cannot drag lower chest triangles through the stationary torso.
  const armRetention = smoothstep(
    layout.shoulderY - layout.height * 0.075,
    layout.shoulderY - layout.height * 0.025,
    point[1],
  );
  const removed = upperArm.weight * (1 - armRetention);
  upperArm.weight *= armRetention;
  upperTorso.weight += removed;
}

function stabilizeMedialGroinWeights(contributions, point, layout, side) {
  const thigh = contributions.find((entry) => entry.regionId === `${side}Thigh`);
  const pelvis = contributions.find((entry) => entry.regionId === 'pelvis');
  if (!thigh || !pelvis) return;
  const hipX = Math.abs(layout.rigLandmarks?.[side]?.hip?.[0] ?? layout.hipX ?? 0.1);
  const verticalActivation = smoothstep(
    layout.hipY - layout.height * 0.120,
    layout.hipY - layout.height * 0.030,
    point[1],
  );
  if (verticalActivation <= 0) return;
  const medialRetention = smoothstep(0, hipX * 0.45, Math.abs(point[0]));
  const retention = 1 - verticalActivation * (1 - medialRetention);
  const removed = thigh.weight * (1 - retention);
  thigh.weight *= retention;
  pelvis.weight += removed;
}

function stabilizeLegSegmentWeights(contributions, point, layout, side) {
  const thigh = contributions.find((entry) => entry.regionId === `${side}Thigh`);
  const calf = contributions.find((entry) => entry.regionId === `${side}Calf`);
  if (!thigh || !calf) return;
  const highCalfRetention = 1 - smoothstep(
    layout.kneeY,
    layout.kneeY + layout.height * 0.055,
    point[1],
  );
  const lowThighRetention = smoothstep(
    layout.kneeY - layout.height * 0.160,
    layout.kneeY - layout.height * 0.080,
    point[1],
  );
  const removedCalf = calf.weight * (1 - highCalfRetention);
  calf.weight *= highCalfRetention;
  thigh.weight += removedCalf;
  const removedThigh = thigh.weight * (1 - lowThighRetention);
  thigh.weight *= lowThighRetention;
  calf.weight += removedThigh;
}

function smoothstep(edge0, edge1, value) {
  if (!(edge1 > edge0)) return value >= edge1 ? 1 : 0;
  const unit = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return unit * unit * (3 - 2 * unit);
}
