import { evaluateAnatomicalPrimitive } from './anatomical-field-primitives-v5.js';

export const ANATOMICAL_JUNCTION_POLICIES_V5 = Object.freeze({
  ShoulderFieldJunctionV5: junction(0.075, 0.52, [0, -1, 0], 0.96, 'upperTorso'),
  HipFieldJunctionV5: junction(0.085, 0.58, [0, 1, 0], 0.97, 'pelvis'),
  NeckTorsoFieldJunctionV5: junction(0.055, 0.46, [0, -1, 0], 0.98, 'upperTorso'),
  WristPalmFieldJunctionV5: junction(0.025, 0.35, [1, 0, 0], 0.92, 'palm'),
  AnkleFootFieldJunctionV5: junction(0.035, 0.40, [0, 0, 1], 0.94, 'foot'),
});

export function evaluateComposedBodyField(fieldDefinition, point, { contributions = false } = {}) {
  return createComposedBodyFieldEvaluator(fieldDefinition)(point, { contributions });
}

export function createComposedBodyFieldEvaluator(fieldDefinition) {
  const regions = fieldDefinition.regions;
  const values = new Float64Array(regions.length);
  const orderedRegionIndices = new Uint16Array(regions.length);
  const blendRadii = createBlendRadiusLookup(fieldDefinition, regions);

  return function evaluate(point, { contributions = false } = {}) {
    for (let index = 0; index < regions.length; index += 1) {
      values[index] = evaluateAnatomicalPrimitive(regions[index].primitive, point);
      orderedRegionIndices[index] = index;
    }
    sortRegionIndices(orderedRegionIndices, values, regions, point);

    let distance = Number.POSITIVE_INFINITY;
    let ownerIndex = -1;
    for (const regionIndex of orderedRegionIndices) {
      const region = regions[regionIndex];
      const value = values[regionIndex];
      const blend = blendRadii[(ownerIndex + 1) * regions.length + regionIndex];
      const merged = smoothMinimum(distance, value, blend);
      if (value < distance) ownerIndex = regionIndex;
      distance = merged;
    }
    for (const helper of fieldDefinition.deformHelpers ?? []) {
      distance = smoothMinimum(
        distance,
        evaluateAnatomicalPrimitive(helper.primitive, point),
        helper.blendRadius ?? fieldDefinition.compositionPolicy.defaultBlendRadius,
      );
    }
    for (const subtraction of fieldDefinition.subtractions ?? []) {
      const cutterDistance = evaluateAnatomicalPrimitive(subtraction.primitive, point);
      distance = smoothSubtraction(distance, cutterDistance, subtraction.blendRadius);
    }
    if (!contributions) return distance;
    const rankedAll = regions
      .map((region, index) => ({
        regionId: region.regionId,
        side: region.side,
        sourceJointId: region.sourceJointId,
        value: values[index],
        score: Math.exp(-Math.max(-0.02, values[index]) * 28),
      }))
      .sort((left, right) => compareContributionEntries(left, right, point));
    const ranked = rankedAll.slice(0, 4);
    const total = ranked.reduce((sum, entry) => sum + entry.score, 0) || 1;
    return {
      distance,
      contributions: ranked.map((entry) => ({
        regionId: entry.regionId,
        side: entry.side,
        sourceJointId: entry.sourceJointId,
        weight: entry.score / total,
        fieldDistance: entry.value,
      })),
      allContributions: rankedAll.map((entry) => ({
        regionId: entry.regionId,
        side: entry.side,
        sourceJointId: entry.sourceJointId,
        weight: entry.score,
        fieldDistance: entry.value,
      })),
    };
  };
}

function createBlendRadiusLookup(fieldDefinition, regions) {
  const lookup = new Float64Array((regions.length + 1) * regions.length);
  for (let ownerIndex = -1; ownerIndex < regions.length; ownerIndex += 1) {
    const ownerId = ownerIndex < 0 ? null : regions[ownerIndex].regionId;
    for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
      lookup[(ownerIndex + 1) * regions.length + regionIndex] = resolveBlendRadius(
        fieldDefinition,
        ownerId,
        regions[regionIndex].regionId,
      );
    }
  }
  return lookup;
}

function sortRegionIndices(indices, values, regions, point) {
  for (let index = 1; index < indices.length; index += 1) {
    const current = indices[index];
    let insertion = index - 1;
    while (insertion >= 0 && compareRegionIndices(current, indices[insertion], values, regions, point) < 0) {
      indices[insertion + 1] = indices[insertion];
      insertion -= 1;
    }
    indices[insertion + 1] = current;
  }
}

function compareRegionIndices(leftIndex, rightIndex, values, regions, point) {
  const delta = values[leftIndex] - values[rightIndex];
  if (Math.abs(delta) > 1e-12) return delta;
  return compareSideAffinity(regions[leftIndex], regions[rightIndex], point);
}

export function smoothMinimum(left, right, radius) {
  if (!Number.isFinite(left)) return right;
  const k = Math.max(1e-6, Number(radius) || 0.03);
  const h = Math.max(k - Math.abs(left - right), 0) / k;
  return Math.min(left, right) - h * h * k * 0.25;
}

export function smoothSubtraction(baseDistance, cutterDistance, radius) {
  return -smoothMinimum(-baseDistance, cutterDistance, radius);
}

function resolveBlendRadius(fieldDefinition, leftId, rightId) {
  const left = String(leftId ?? '');
  const right = String(rightId ?? '');
  const pair = `${left}|${right}`.toLowerCase();
  if (/upperarm/.test(pair) && /uppertorso/.test(pair)) return fieldDefinition.junctions.shoulder.blendRadius;
  if (/thigh/.test(pair) && /pelvis/.test(pair)) return fieldDefinition.junctions.hip.blendRadius;
  if (/neck/.test(pair) && /uppertorso/.test(pair)) return fieldDefinition.junctions.neckTorso.blendRadius;
  if (/forearm/.test(pair) && /palm/.test(pair)) return fieldDefinition.junctions.wristPalm.blendRadius;
  if (/calf/.test(pair) && /foot/.test(pair)) return fieldDefinition.junctions.ankleFoot.blendRadius;
  return fieldDefinition.compositionPolicy.defaultBlendRadius;
}


function compareContributionEntries(left, right, point) {
  const delta = right.score - left.score;
  if (Math.abs(delta) > 1e-12) return delta;
  return compareSideAffinity(left, right, point);
}

function compareSideAffinity(left, right, point) {
  const affinity = (entry) => {
    if (Math.abs(point[0]) < 1e-12) return entry.side === 'center' ? 0 : 1;
    const preferred = point[0] < 0 ? 'left' : 'right';
    if (entry.side === preferred) return 0;
    if (entry.side === 'center') return 1;
    return 2;
  };
  return affinity(left) - affinity(right) || left.regionId.localeCompare(right.regionId);
}

function junction(blendRadius, blendFalloff, compressionDirection, volumePreservationTarget, regionOwnership) {
  return Object.freeze({ blendRadius, blendFalloff, compressionDirection, volumePreservationTarget, regionOwnership });
}
