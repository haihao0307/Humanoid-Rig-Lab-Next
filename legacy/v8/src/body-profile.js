import {
  applyPosePresetToDefinition,
  createJointAxisContract,
  createStandardHumanoidPreset,
} from './skeleton-presets.js';
import { computePoseWorldPositions, computeRestWorldPositions, getBoneLength } from './skeleton-model.js';

export const REFERENCE_BODY_PROFILE = Object.freeze({
  preset: 'smpl-male-surface-fit-1796-v3',
  height: 1.795672,
  shoulderWidth: 0.420,
  hipWidth: 0.200,
  upperArmLength: 0.277218,
  forearmLength: 0.241402,
  handControlLength: 0.070774,
  thighLength: 0.425348,
  lowerLegLength: 0.403133,
});

const LIMITS = Object.freeze({
  height: [1.40, 2.15],
  shoulderWidth: [0.28, 0.58],
  hipWidth: [0.14, 0.38],
  upperArmLength: [0.20, 0.40],
  forearmLength: [0.18, 0.36],
  handControlLength: [0.04, 0.12],
  thighLength: [0.30, 0.56],
  lowerLegLength: [0.30, 0.54],
});

const PROFILE_DIMENSION_KEYS = Object.freeze(Object.keys(LIMITS));
const CENTRAL_HEIGHT_CHAIN = Object.freeze(['spine', 'chest', 'upperChest', 'neck', 'head', 'headTop']);
const LEG_ENDPOINTS = Object.freeze(['leftFoot', 'leftToes', 'leftToesEnd', 'rightFoot', 'rightToes', 'rightToesEnd']);

export function normalizeBodyProfile(input = {}) {
  const profile = { ...REFERENCE_BODY_PROFILE, ...(input || {}) };
  const result = { preset: String(profile.preset || 'custom') };
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    result[key] = clampNumber(profile[key], min, max, REFERENCE_BODY_PROFILE[key]);
  }
  result.requiresRebind = !profilesEqual(result, REFERENCE_BODY_PROFILE);
  result.draftRevision = Math.max(1, Number(profile.draftRevision || 1));
  return result;
}

export function bodyProfileRequiresSkinRebind(input = {}) {
  return normalizeBodyProfile(input).requiresRebind;
}

/**
 * Rebuilds the bind skeleton from the immutable reference preset and applies
 * one BodyProfile. The operation changes bind dimensions only. It never
 * stretches the current pose bones in place.
 */
export function applyBodyProfileToDefinition(currentDefinition, rawProfile, options = {}) {
  const profile = normalizeBodyProfile(rawProfile);
  const preservePose = options.preservePose !== false;
  const currentPoseName = String(currentDefinition?.pose || 'A').toUpperCase();
  const presetPose = currentPoseName === 'T' ? 'T' : 'A';
  const next = createStandardHumanoidPreset('A');
  const isReferenceProfile = !profile.requiresRebind;

  if (!isReferenceProfile) {
    const scale = profile.height / REFERENCE_BODY_PROFILE.height;
    scaleReferenceDefinition(next, scale);
    const referenceFootClearance = minimumLegEndpointHeight(next);

    applyShoulderWidth(next, profile.shoulderWidth);
    applyHipWidth(next, profile.hipWidth);
    setBoneLength(next, 'leftLowerArm', profile.upperArmLength);
    setBoneLength(next, 'rightLowerArm', profile.upperArmLength);
    setBoneLength(next, 'leftHand', profile.forearmLength);
    setBoneLength(next, 'rightHand', profile.forearmLength);
    setBoneLength(next, 'leftHandEnd', profile.handControlLength);
    setBoneLength(next, 'rightHandEnd', profile.handControlLength);
    setBoneLength(next, 'leftLowerLeg', profile.thighLength);
    setBoneLength(next, 'rightLowerLeg', profile.thighLength);
    setBoneLength(next, 'leftFoot', profile.lowerLegLength);
    setBoneLength(next, 'rightFoot', profile.lowerLegLength);

    anchorFeetToGround(next, referenceFootClearance);
    fitCentralHeight(next, profile.height);
  }
  applyPosePresetToDefinition(next, presetPose);

  if (preservePose && currentDefinition && !['A', 'T'].includes(currentPoseName)) {
    transferPoseDirections(currentDefinition, next);
    next.pose = 'CUSTOM';
  }

  next.anthropometry = {
    ...(next.anthropometry || {}),
    profile: profile.preset,
    label: isReferenceProfile ? 'SMPL 男性示例体 · 1.796 m' : '自定义绑定比例草案',
    referenceStature: REFERENCE_BODY_PROFILE.height,
    requested: { ...profile },
    shoulderJointWidth: profile.shoulderWidth,
    hipJointWidth: profile.hipWidth,
    hipJointHeight: getRestPoint(next, 'hips').y,
    kneeJointHeight: getRestPoint(next, 'leftLowerLeg').y,
    ankleJointHeight: getRestPoint(next, 'leftFoot').y,
    segments: {
      ...(next.anthropometry?.segments || {}),
      upperArm: getBoneLength(next, 'leftLowerArm'),
      forearm: getBoneLength(next, 'leftHand'),
      wristToHandJoint: getBoneLength(next, 'leftHandEnd'),
      thigh: getBoneLength(next, 'leftLowerLeg'),
      shank: getBoneLength(next, 'leftFoot'),
    },
  };
  next.jointAxes = createJointAxisContract(next.joints);
  next.profilePreview = {
    source: 'host-body-profile',
    requiresSkinRebind: profile.requiresRebind,
    updatedAt: new Date().toISOString(),
  };
  next.updatedAt = new Date().toISOString();
  return next;
}

export function measureBodyProfile(definition) {
  const rest = computeRestWorldPositions(definition);
  const point = (id) => rest.get(id) || { x: 0, y: 0, z: 0 };
  const ys = [...rest.values()].map((item) => item.y);
  return {
    height: round(Math.max(...ys) - Math.min(...ys), 6),
    shoulderWidth: round(Math.abs(point('rightUpperArm').x - point('leftUpperArm').x), 6),
    hipWidth: round(Math.abs(point('rightUpperLeg').x - point('leftUpperLeg').x), 6),
    upperArmLength: round(getBoneLength(definition, 'leftLowerArm'), 6),
    forearmLength: round(getBoneLength(definition, 'leftHand'), 6),
    handControlLength: round(getBoneLength(definition, 'leftHandEnd'), 6),
    thighLength: round(getBoneLength(definition, 'leftLowerLeg'), 6),
    lowerLegLength: round(getBoneLength(definition, 'leftFoot'), 6),
  };
}

export function bodyProfileKey(profile) {
  const normalized = normalizeBodyProfile(profile);
  return [
    normalized.height,
    normalized.shoulderWidth,
    normalized.hipWidth,
    normalized.upperArmLength,
    normalized.forearmLength,
    normalized.handControlLength,
    normalized.thighLength,
    normalized.lowerLegLength,
  ].map((value) => Number(value).toFixed(6)).join('|');
}

function scaleReferenceDefinition(definition, scale) {
  for (const joint of definition.joints) {
    joint.localPosition = joint.localPosition.map((value) => Number(value) * scale);
    if (Array.isArray(joint.controlOffset)) {
      joint.controlOffset = joint.controlOffset.map((value) => Number(value) * scale);
    }
    joint.jointRadius = Number(joint.jointRadius) * scale;
    joint.boneRadius = Number(joint.boneRadius) * scale;
  }
}

function applyShoulderWidth(definition, width) {
  const byId = new Map(definition.joints.map((joint) => [joint.id, joint]));
  const half = width / 2;
  const collarShare = 0.100 / 0.210;
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1;
    const collar = byId.get(`${side}Shoulder`);
    const shoulder = byId.get(`${side}UpperArm`);
    if (!collar || !shoulder) continue;
    collar.localPosition[0] = sign * half * collarShare;
    shoulder.localPosition[0] = sign * half * (1 - collarShare);
  }
}

function applyHipWidth(definition, width) {
  const byId = new Map(definition.joints.map((joint) => [joint.id, joint]));
  const half = width / 2;
  byId.get('leftUpperLeg').localPosition[0] = -half;
  byId.get('rightUpperLeg').localPosition[0] = half;
}

function setBoneLength(definition, jointId, targetLength) {
  const joint = definition.joints.find((item) => item.id === jointId);
  if (!joint) return;
  const vector = joint.localPosition.map(Number);
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  const scale = targetLength / length;
  joint.localPosition = vector.map((value) => value * scale);
}

function minimumLegEndpointHeight(definition) {
  const rest = computeRestWorldPositions(definition);
  return Math.min(...LEG_ENDPOINTS.map((id) => rest.get(id)?.y ?? 0));
}

function anchorFeetToGround(definition, targetClearance = 0) {
  const hips = definition.joints.find((joint) => joint.id === 'hips');
  if (!hips) return;
  hips.localPosition[1] = 0;
  const relativeMinimum = minimumLegEndpointHeight(definition);
  hips.localPosition[1] = Number(targetClearance) - relativeMinimum;
  const root = definition.joints.find((joint) => joint.id === 'root');
  if (root?.controlOffset) root.controlOffset[1] = -hips.localPosition[1];
}

function fitCentralHeight(definition, targetHeight) {
  const rest = computeRestWorldPositions(definition);
  const hipsY = rest.get('hips')?.y ?? 0;
  const headTopY = rest.get('headTop')?.y ?? targetHeight;
  const currentAboveHips = Math.max(0.1, headTopY - hipsY);
  const desiredAboveHips = Math.max(0.1, targetHeight - hipsY);
  const factor = desiredAboveHips / currentAboveHips;
  const byId = new Map(definition.joints.map((joint) => [joint.id, joint]));
  for (const id of CENTRAL_HEIGHT_CHAIN) {
    const joint = byId.get(id);
    if (joint) joint.localPosition[1] *= factor;
  }
}

function transferPoseDirections(previous, next) {
  const previousPose = computePoseWorldPositions(previous);
  const previousRest = computeRestWorldPositions(previous);
  const nextRest = computeRestWorldPositions(next);
  const nextById = new Map(next.joints.map((joint) => [joint.id, joint]));
  const previousById = new Map(previous.joints.map((joint) => [joint.id, joint]));
  const ordered = [...next.joints].sort((a, b) => depthOf(a.id, nextById) - depthOf(b.id, nextById));
  const pose = new Map();
  const oldHips = previousPose.get('hips');
  const oldRestHips = previousRest.get('hips');
  const translation = oldHips && oldRestHips
    ? { x: oldHips.x - oldRestHips.x, y: oldHips.y - oldRestHips.y, z: oldHips.z - oldRestHips.z }
    : { x: 0, y: 0, z: 0 };

  for (const joint of ordered) {
    const restPoint = nextRest.get(joint.id) || { x: 0, y: 0, z: 0 };
    if (!joint.parentId) {
      const point = { x: restPoint.x + translation.x, y: restPoint.y + translation.y, z: restPoint.z + translation.z };
      pose.set(joint.id, point);
      joint.poseWorldPosition = [point.x, point.y, point.z];
      continue;
    }
    const parentPoint = pose.get(joint.parentId) || nextRest.get(joint.parentId) || { x: 0, y: 0, z: 0 };
    if (joint.physicalBone === false || joint.isControl) {
      const parentRest = nextRest.get(joint.parentId) || { x: 0, y: 0, z: 0 };
      const offset = { x: restPoint.x - parentRest.x, y: restPoint.y - parentRest.y, z: restPoint.z - parentRest.z };
      const point = { x: parentPoint.x + offset.x, y: parentPoint.y + offset.y, z: parentPoint.z + offset.z };
      pose.set(joint.id, point);
      joint.poseWorldPosition = [point.x, point.y, point.z];
      continue;
    }

    const oldJoint = previousPose.get(joint.id);
    const oldParent = previousPose.get(joint.parentId);
    const oldRestJoint = previousRest.get(joint.id);
    const oldRestParent = previousRest.get(joint.parentId);
    const direction = normalizeVector(
      oldJoint && oldParent
        ? { x: oldJoint.x - oldParent.x, y: oldJoint.y - oldParent.y, z: oldJoint.z - oldParent.z }
        : oldRestJoint && oldRestParent
          ? { x: oldRestJoint.x - oldRestParent.x, y: oldRestJoint.y - oldRestParent.y, z: oldRestJoint.z - oldRestParent.z }
          : { x: restPoint.x - (nextRest.get(joint.parentId)?.x || 0), y: restPoint.y - (nextRest.get(joint.parentId)?.y || 0), z: restPoint.z - (nextRest.get(joint.parentId)?.z || 0) },
    );
    const length = Math.hypot(...joint.localPosition);
    const point = {
      x: parentPoint.x + direction.x * length,
      y: parentPoint.y + direction.y * length,
      z: parentPoint.z + direction.z * length,
    };
    pose.set(joint.id, point);
    joint.poseWorldPosition = [point.x, point.y, point.z];
  }
}

function getRestPoint(definition, id) {
  return computeRestWorldPositions(definition).get(id) || { x: 0, y: 0, z: 0 };
}

function profilesEqual(a, b) {
  return PROFILE_DIMENSION_KEYS.every((key) => Math.abs(Number(a[key]) - Number(b[key])) < 1e-6);
}

function depthOf(id, byId) {
  let depth = 0;
  let current = byId.get(id);
  const visited = new Set();
  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    depth += 1;
    current = byId.get(current.parentId);
  }
  return depth;
}

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function round(value, digits) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}
