import { evaluateAnatomicalPrimitive } from './anatomical-field-primitives-v5.js';

export const ANATOMICAL_JUNCTION_POLICIES_V5 = Object.freeze({
  ShoulderFieldJunctionV5: junction(0.075, 0.52, [0, -1, 0], 0.96, 'upperTorso'),
  HipFieldJunctionV5: junction(0.085, 0.58, [0, 1, 0], 0.97, 'pelvis'),
  NeckTorsoFieldJunctionV5: junction(0.055, 0.46, [0, -1, 0], 0.98, 'upperTorso'),
  WristPalmFieldJunctionV5: junction(0.025, 0.35, [1, 0, 0], 0.92, 'palm'),
  AnkleFootFieldJunctionV5: junction(0.035, 0.40, [0, 0, 1], 0.94, 'foot'),
});

export function evaluateComposedBodyField(fieldDefinition, point, { contributions = false } = {}) {
  const values = fieldDefinition.regions.map((region) => ({
    regionId: region.regionId,
    side: region.side,
    sourceJointId: region.sourceJointId,
    value: evaluateAnatomicalPrimitive(region.primitive, point),
  }));
  const helperValues = (fieldDefinition.deformHelpers ?? []).map((helper) => ({
    helper,
    value: evaluateAnatomicalPrimitive(helper.primitive, point),
  }));
  let distance = Number.POSITIVE_INFINITY;
  let owner = null;
  const orderedValues = [...values].sort((left, right) => compareFieldEntries(left, right, point));
  for (const entry of orderedValues) {
    const blend = resolveBlendRadius(fieldDefinition, owner, entry.regionId);
    const merged = smoothMinimum(distance, entry.value, blend);
    if (entry.value < distance) owner = entry.regionId;
    distance = merged;
  }
  for (const { helper, value } of helperValues) {
    distance = smoothMinimum(
      distance,
      value,
      helper.blendRadius ?? fieldDefinition.compositionPolicy.defaultBlendRadius,
    );
  }
  for (const subtraction of fieldDefinition.subtractions ?? []) {
    const cutterDistance = evaluateAnatomicalPrimitive(subtraction.primitive, point);
    distance = smoothSubtraction(distance, cutterDistance, subtraction.blendRadius);
  }
  if (!contributions) return distance;
  const rankedAll = values
    .map((entry) => ({ ...entry, score: Math.exp(-Math.max(-0.02, entry.value) * 28) }))
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


function compareFieldEntries(left, right, point) {
  const delta = left.value - right.value;
  if (Math.abs(delta) > 1e-12) return delta;
  return compareSideAffinity(left, right, point);
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
