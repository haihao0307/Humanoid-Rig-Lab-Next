import {
  addVectors,
  assertFiniteTree,
  clamp,
  normalizeQuaternion,
  normalizeVector3,
  rotateVectorByQuaternion,
  scaleVector,
  unit,
  vector3,
  vectorLength,
} from '../solver/motion-math.js';
import { mirrorQuaternionAcrossX } from '../../modules/animation/quaternion.js';
import { createMotionStyle, normalizeMotionStyle, validateMotionStyle } from './motion-style.js';

export const MOTION_GOAL_SCHEMA = 'humanoid_rig/motion_goal@1.0';

const DEFAULT_PRIORITIES = Object.freeze({ contact: 100, balance: 80, endEffector: 30, gaze: 20, posture: 10 });
const FORBIDDEN_KEYS = new Set(['scale', 'boneScale', 'boneMatrix', 'boneMatrices', 'vertices', 'skinVertices', 'parentId', 'children', 'localPosition']);

export function createMotionGoal(input = {}) {
  const normalized = normalizeMotionGoal(input);
  const validation = validateMotionGoal(normalized);
  if (!validation.valid) throw new TypeError(validation.errors.join(' '));
  return normalized;
}

export function normalizeMotionGoal(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const now = source.createdAt == null ? new Date().toISOString() : String(source.createdAt);
  const orientation = source.orientation || {};
  const root = source.root || {};
  const balance = source.balance || {};
  const posture = source.posture || {};
  const timing = source.timing || {};
  const constraints = source.constraints || {};
  const priorities = source.priorities || {};
  const result = {
    schema: MOTION_GOAL_SCHEMA,
    goalId: String(source.goalId || `goal_${Date.now().toString(36)}`),
    goalRevision: Math.max(1, Math.trunc(finite(source.goalRevision, 1))),
    compatibleRig: String(source.compatibleRig || 'rig@0.4.0'),
    source: String(source.source || 'runtime'),
    createdAt: now,
    space: source.space === 'character' ? 'character' : 'world',
    root: {
      mode: ['maintain', 'position', 'trajectory'].includes(root.mode) ? root.mode : 'maintain',
      targetPosition: root.targetPosition == null ? null : vector3(root.targetPosition),
      targetRotation: root.targetRotation == null ? null : normalizeQuaternion(root.targetRotation),
    },
    orientation: {
      forward: normalizeVector3(orientation.forward, [0, 0, 1]),
      up: normalizeVector3(orientation.up, [0, 1, 0]),
    },
    trajectory: normalizeTrajectory(source.trajectory),
    endEffectors: (source.endEffectors || []).map(normalizeEndEffector).sort(descendingPriority),
    contacts: (source.contacts || []).map(normalizeContact).sort(descendingPriority),
    gaze: normalizeGaze(source.gaze),
    balance: {
      enabled: balance.enabled !== false,
      mode: ['double_support', 'left_support', 'right_support', 'hand_support', 'seated', 'airborne'].includes(balance.mode)
        ? balance.mode
        : 'double_support',
      centerOfMassTarget: balance.centerOfMassTarget == null ? null : vector3(balance.centerOfMassTarget),
      supportMargin: Math.max(0, finite(balance.supportMargin, 0.02)),
      priority: finite(balance.priority, priorities.balance ?? DEFAULT_PRIORITIES.balance),
    },
    posture: {
      pelvisHeight: posture.pelvisHeight == null ? null : finite(posture.pelvisHeight, null),
      torsoLean: finite(posture.torsoLean, 0),
      spineTwist: finite(posture.spineTwist, 0),
      symmetryWeight: unit(posture.symmetryWeight, 0.2),
    },
    timing: {
      duration: Math.max(1e-6, finite(timing.duration, 1)),
      elapsed: Math.max(0, finite(timing.elapsed, 0)),
      phase: unit(timing.phase, 0),
    },
    style: normalizeMotionStyle(source.style || createMotionStyle()),
    constraints: {
      fixedBoneLengths: true,
      jointLimits: constraints.jointLimits !== false,
      groundContact: constraints.groundContact !== false,
      selfCollision: Boolean(constraints.selfCollision),
    },
    priorities: {
      contact: finite(priorities.contact, DEFAULT_PRIORITIES.contact),
      balance: finite(priorities.balance, DEFAULT_PRIORITIES.balance),
      endEffector: finite(priorities.endEffector, DEFAULT_PRIORITIES.endEffector),
      gaze: finite(priorities.gaze, DEFAULT_PRIORITIES.gaze),
      posture: finite(priorities.posture, DEFAULT_PRIORITIES.posture),
    },
    metadata: cloneData(source.metadata || {}),
  };
  return result;
}

export function validateMotionGoal(input, { jointIds = null, directionTolerance = 1e-5 } = {}) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, errors: ['MotionGoal must be an object.'] };
  }
  if (input.schema != null && input.schema !== MOTION_GOAL_SCHEMA) errors.push(`Unsupported MotionGoal schema: ${String(input.schema)}.`);
  assertFiniteTree(input, '$', errors);
  inspectForbidden(input, '$', errors);
  inspectFunctions(input, '$', errors);
  validateUnitDirection(input.orientation?.forward, '$.orientation.forward', errors, directionTolerance);
  validateUnitDirection(input.orientation?.up, '$.orientation.up', errors, directionTolerance);
  validateUnitQuaternion(input.root?.targetRotation, '$.root.targetRotation', errors, directionTolerance);
  const allowed = jointIds instanceof Set ? jointIds : Array.isArray(jointIds) ? new Set(jointIds) : null;
  for (const [collectionName, collection] of [['endEffectors', input.endEffectors], ['contacts', input.contacts]]) {
    if (collection != null && !Array.isArray(collection)) errors.push(`${collectionName} must be an array.`);
    for (const item of collection || []) {
      if (!item?.jointId || typeof item.jointId !== 'string') errors.push(`${collectionName} entry requires jointId.`);
      else if (allowed && !allowed.has(item.jointId)) errors.push(`Unknown jointId: ${item.jointId}.`);
      if (item.normal != null) validateUnitDirection(item.normal, `${collectionName}.${item.jointId}.normal`, errors, directionTolerance);
      if (item.groundNormal != null) validateUnitDirection(item.groundNormal, `${collectionName}.${item.jointId}.groundNormal`, errors, directionTolerance);
      if (item.targetRotation != null) validateUnitQuaternion(item.targetRotation, `${collectionName}.${item.jointId}.targetRotation`, errors, directionTolerance);
      validateVector(item.targetPosition ?? item.position, `${collectionName}.${item.jointId}.targetPosition`, errors, true);
      if (item.poleTarget != null) validateVector(item.poleTarget, `${collectionName}.${item.jointId}.poleTarget`, errors, true);
    }
  }
  if (input.gaze?.targetPosition != null) validateVector(input.gaze.targetPosition, '$.gaze.targetPosition', errors, true);
  const styleResult = validateMotionStyle(input.style || {});
  errors.push(...styleResult.errors.map((error) => `style.${error}`));
  return { valid: errors.length === 0, errors };
}

export function mergeMotionGoals(...inputs) {
  const goals = inputs.flat().filter(Boolean).map(normalizeMotionGoal);
  if (!goals.length) return createMotionGoal();
  let merged = goals[0];
  for (const goal of goals.slice(1)) {
    merged = normalizeMotionGoal({
      ...merged,
      ...goal,
      root: mergeNullableTarget(merged.root, goal.root),
      orientation: { ...merged.orientation, ...goal.orientation },
      trajectory: goal.trajectory ?? merged.trajectory,
      endEffectors: mergeByKey(merged.endEffectors, goal.endEffectors, 'id'),
      contacts: mergeByKey(merged.contacts, goal.contacts, 'contactId'),
      gaze: goal.gaze ?? merged.gaze,
      balance: { ...merged.balance, ...goal.balance },
      posture: { ...merged.posture, ...goal.posture },
      timing: { ...merged.timing, ...goal.timing },
      style: { ...merged.style, ...goal.style },
      constraints: { ...merged.constraints, ...goal.constraints },
      priorities: { ...merged.priorities, ...goal.priorities },
      metadata: { ...merged.metadata, ...goal.metadata },
      goalRevision: Math.max(merged.goalRevision, goal.goalRevision) + 1,
    });
  }
  return merged;
}

export function mirrorMotionGoal(input) {
  const goal = normalizeMotionGoal(input);
  const mirrorPoint = (value) => value == null ? null : [-value[0], value[1], value[2]];
  return normalizeMotionGoal({
    ...goal,
    goalId: `${goal.goalId}_mirrored`,
    goalRevision: goal.goalRevision + 1,
    root: {
      ...goal.root,
      targetPosition: mirrorPoint(goal.root.targetPosition),
      targetRotation: goal.root.targetRotation == null ? null : mirrorQuaternionAcrossX(goal.root.targetRotation),
    },
    orientation: { forward: mirrorPoint(goal.orientation.forward), up: mirrorPoint(goal.orientation.up) },
    trajectory: goal.trajectory == null ? null : { ...goal.trajectory, points: goal.trajectory.points.map(mirrorPoint) },
    endEffectors: goal.endEffectors.map((item) => ({
      ...item,
      id: swapSideName(item.id),
      jointId: swapSideName(item.jointId),
      targetPosition: mirrorPoint(item.targetPosition),
      targetRotation: item.targetRotation == null ? null : mirrorQuaternionAcrossX(item.targetRotation),
      poleTarget: mirrorPoint(item.poleTarget),
      groundNormal: mirrorPoint(item.groundNormal),
    })),
    contacts: goal.contacts.map((item) => ({
      ...item,
      contactId: swapSideName(item.contactId),
      jointId: swapSideName(item.jointId),
      targetPosition: mirrorPoint(item.targetPosition),
      targetRotation: item.targetRotation == null ? null : mirrorQuaternionAcrossX(item.targetRotation),
      normal: mirrorPoint(item.normal),
    })),
    gaze: goal.gaze == null ? null : { ...goal.gaze, targetPosition: mirrorPoint(goal.gaze.targetPosition) },
    balance: {
      ...goal.balance,
      mode: swapSupportMode(goal.balance.mode),
      centerOfMassTarget: mirrorPoint(goal.balance.centerOfMassTarget),
    },
  });
}

export function scaleMotionGoalToBody(input, bodyProfile = {}, sourceHeight = 1.795672) {
  const goal = normalizeMotionGoal(input);
  const targetHeight = Math.max(0.1, finite(bodyProfile.height ?? bodyProfile.targetHeight, sourceHeight));
  const scale = targetHeight / Math.max(0.1, finite(sourceHeight, 1.795672));
  const scalePoint = (value) => value == null ? null : scaleVector(value, scale);
  return normalizeMotionGoal({
    ...goal,
    goalRevision: goal.goalRevision + 1,
    root: { ...goal.root, targetPosition: scalePoint(goal.root.targetPosition) },
    trajectory: goal.trajectory == null ? null : { ...goal.trajectory, points: goal.trajectory.points.map(scalePoint) },
    endEffectors: goal.endEffectors.map((item) => ({ ...item, targetPosition: scalePoint(item.targetPosition), poleTarget: scalePoint(item.poleTarget) })),
    contacts: goal.contacts.map((item) => ({ ...item, targetPosition: scalePoint(item.targetPosition) })),
    gaze: goal.gaze == null ? null : { ...goal.gaze, targetPosition: scalePoint(goal.gaze.targetPosition) },
    balance: { ...goal.balance, centerOfMassTarget: scalePoint(goal.balance.centerOfMassTarget), supportMargin: goal.balance.supportMargin * scale },
    posture: { ...goal.posture, pelvisHeight: goal.posture.pelvisHeight == null ? null : goal.posture.pelvisHeight * scale },
    metadata: { ...goal.metadata, targetBodyHeight: targetHeight, spatialScale: scale },
  });
}

export function resolveRelativeMotionGoal(input, characterTransform = {}) {
  const goal = normalizeMotionGoal(input);
  if (goal.space !== 'character') return goal;
  const origin = vector3(characterTransform.position);
  const rotation = normalizeQuaternion(characterTransform.rotation);
  const point = (value) => value == null ? null : addVectors(origin, rotateVectorByQuaternion(value, rotation));
  const direction = (value) => value == null ? null : normalizeVector3(rotateVectorByQuaternion(value, rotation), value);
  return normalizeMotionGoal({
    ...goal,
    goalRevision: goal.goalRevision + 1,
    space: 'world',
    root: {
      ...goal.root,
      targetPosition: point(goal.root.targetPosition),
      targetRotation: goal.root.targetRotation == null ? null : multiplyRotation(rotation, goal.root.targetRotation),
    },
    orientation: { forward: direction(goal.orientation.forward), up: direction(goal.orientation.up) },
    trajectory: goal.trajectory == null ? null : { ...goal.trajectory, points: goal.trajectory.points.map(point) },
    endEffectors: goal.endEffectors.map((item) => ({
      ...item,
      targetPosition: point(item.targetPosition),
      targetRotation: item.targetRotation == null ? null : multiplyRotation(rotation, item.targetRotation),
      poleTarget: point(item.poleTarget),
      groundNormal: direction(item.groundNormal),
    })),
    contacts: goal.contacts.map((item) => ({
      ...item,
      targetPosition: point(item.targetPosition),
      targetRotation: item.targetRotation == null ? null : multiplyRotation(rotation, item.targetRotation),
      normal: direction(item.normal),
    })),
    gaze: goal.gaze == null ? null : { ...goal.gaze, targetPosition: point(goal.gaze.targetPosition) },
    balance: { ...goal.balance, centerOfMassTarget: point(goal.balance.centerOfMassTarget) },
  });
}

function normalizeEndEffector(item = {}) {
  return {
    id: String(item.id || `${item.jointId || 'joint'}_target`),
    jointId: String(item.jointId || ''),
    targetPosition: vector3(item.targetPosition),
    targetRotation: item.targetRotation == null ? null : normalizeQuaternion(item.targetRotation),
    positionWeight: unit(item.positionWeight, 1),
    rotationWeight: unit(item.rotationWeight, 0),
    poleTarget: item.poleTarget == null ? null : vector3(item.poleTarget),
    priority: finite(item.priority, DEFAULT_PRIORITIES.endEffector),
    shoulderParticipation: unit(item.shoulderParticipation, 0.2),
    spineParticipation: unit(item.spineParticipation, 0.08),
    groundNormal: item.groundNormal == null ? null : normalizeVector3(item.groundNormal, [0, 1, 0]),
    contactPhase: unit(item.contactPhase, 0),
  };
}

function normalizeContact(item = {}) {
  return {
    contactId: String(item.contactId || item.id || `${item.jointId || 'joint'}_contact`),
    jointId: String(item.jointId || ''),
    mode: ['world_lock', 'position', 'orientation', 'surface', 'grasp', 'seat'].includes(item.mode) ? item.mode : 'world_lock',
    targetPosition: vector3(item.targetPosition ?? item.position),
    targetRotation: item.targetRotation == null ? null : normalizeQuaternion(item.targetRotation),
    normal: normalizeVector3(item.normal, [0, 1, 0]),
    friction: Math.max(0, finite(item.friction, 0.8)),
    positionWeight: unit(item.positionWeight, 1),
    rotationWeight: unit(item.rotationWeight, 0.8),
    phase: unit(item.phase, 0),
    active: item.active !== false,
    releaseProgress: unit(item.releaseProgress, item.active === false ? 1 : 0),
    priority: finite(item.priority, DEFAULT_PRIORITIES.contact),
    contactBlendIn: Math.max(1e-4, finite(item.contactBlendIn, 0.12)),
    contactBlendOut: Math.max(1e-4, finite(item.contactBlendOut, 0.18)),
  };
}

function normalizeGaze(gaze) {
  if (!gaze) return null;
  return {
    targetPosition: vector3(gaze.targetPosition),
    headWeight: unit(gaze.headWeight, 0.65),
    neckWeight: unit(gaze.neckWeight, 0.35),
    chestWeight: unit(gaze.chestWeight, 0.15),
    eyeWeight: unit(gaze.eyeWeight, 0),
    priority: finite(gaze.priority, DEFAULT_PRIORITIES.gaze),
  };
}

function normalizeTrajectory(trajectory) {
  if (!trajectory) return null;
  return { points: (trajectory.points || []).map((point) => vector3(point)), loop: Boolean(trajectory.loop) };
}

function descendingPriority(a, b) {
  return Number(b.priority || 0) - Number(a.priority || 0);
}

function mergeNullableTarget(base, override) {
  return {
    ...base,
    ...override,
    targetPosition: override?.targetPosition ?? base?.targetPosition ?? null,
    targetRotation: override?.targetRotation ?? base?.targetRotation ?? null,
  };
}

function mergeByKey(base, override, key) {
  const entries = new Map((base || []).map((item) => [item[key], item]));
  for (const item of override || []) entries.set(item[key], { ...(entries.get(item[key]) || {}), ...item });
  return [...entries.values()].sort(descendingPriority);
}

function validateUnitDirection(value, path, errors, tolerance) {
  validateVector(value, path, errors, true);
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    const length = vectorLength(value);
    if (Math.abs(length - 1) > tolerance) errors.push(`${path} must be normalized.`);
  }
}

function validateUnitQuaternion(value, path, errors, tolerance) {
  if (value == null) return;
  if ((!Array.isArray(value) && !ArrayBuffer.isView(value)) || value.length !== 4 || ![...value].every((entry) => Number.isFinite(Number(entry)))) {
    errors.push(`${path} must be a finite quaternion.`);
    return;
  }
  if (Math.abs(Math.hypot(...value) - 1) > tolerance) errors.push(`${path} must be normalized.`);
}

function validateVector(value, path, errors, required) {
  if (value == null) {
    if (required) errors.push(`${path} is required.`);
    return;
  }
  if ((!Array.isArray(value) && !ArrayBuffer.isView(value)) || value.length !== 3 || ![...value].every((entry) => Number.isFinite(Number(entry)))) {
    errors.push(`${path} must be a finite vector3.`);
  }
}

function inspectForbidden(value, path, errors) {
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) errors.push(`${path}.${key} is forbidden in MotionGoal.`);
    inspectForbidden(entry, `${path}.${key}`, errors);
  }
}

function inspectFunctions(value, path, errors) {
  if (typeof value === 'function') errors.push(`${path} must contain data only.`);
  else if (Array.isArray(value)) value.forEach((entry, index) => inspectFunctions(entry, `${path}[${index}]`, errors));
  else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) inspectFunctions(entry, `${path}.${key}`, errors);
  }
}

function swapSideName(value) {
  return String(value)
    .replace(/Left/g, '__SIDE_UPPER_A__')
    .replace(/left/g, '__SIDE_LOWER_A__')
    .replace(/Right/g, 'Left')
    .replace(/right/g, 'left')
    .replace(/__SIDE_UPPER_A__/g, 'Right')
    .replace(/__SIDE_LOWER_A__/g, 'right');
}

function swapSupportMode(value) {
  if (value === 'left_support') return 'right_support';
  if (value === 'right_support') return 'left_support';
  return value;
}

function cloneData(value) {
  return value == null ? value : structuredClone(value);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function multiplyRotation(a, b) {
  const [ax, ay, az, aw] = normalizeQuaternion(a);
  const [bx, by, bz, bw] = normalizeQuaternion(b);
  return normalizeQuaternion([
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]);
}
