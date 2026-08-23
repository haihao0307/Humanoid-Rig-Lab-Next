import { applyBodyProfileToDefinition, normalizeBodyProfile } from '../../legacy/v8/src/body-profile.js';
import { computeRestWorldPositions, getBoneLength } from '../../legacy/v8/src/skeleton-model.js';
import {
  createStandardHumanoidPreset,
  normalizeSkeletonDefinition,
} from '../../legacy/v8/src/skeleton-presets.js';
import {
  addVectors,
  conjugateQuaternion,
  crossVectors,
  dotVectors,
  multiplyQuaternions,
  normalizeQuaternion,
  normalizeVector3,
  quaternionFromAnatomicalChannels,
  quaternionFromTo,
  rotateVectorByQuaternion,
  subtractVectors,
  vectorLength,
} from '../modules/animation/quaternion.js';

export const HUMAN_COORDINATE_SYSTEM = Object.freeze({
  handedness: 'right',
  upAxis: '+Y',
  forwardAxis: '+Z',
  rightAxis: '+X',
  leftJointSign: -1,
  rightJointSign: 1,
});

export const CANONICAL_POSE_SCHEMA = 'humanoid_rig/pose_snapshot@1.0';
export const OUTGOING_ROTATION_CONVENTION = 'outgoing_joint_local_quaternion';
export const INCOMING_ROTATION_CONVENTION_FULL = 'incoming_bone_bind_delta_full_quaternion';
export const INCOMING_ROTATION_CONVENTION_ZERO_TWIST = 'incoming_bone_bind_delta_zero_twist';

export const CORE_MOTION_JOINT_IDS = Object.freeze([
  'hips',
  'spine',
  'chest',
  'upperChest',
  'neck',
  'head',
  'leftShoulder',
  'rightShoulder',
  'leftUpperArm',
  'rightUpperArm',
  'leftLowerArm',
  'rightLowerArm',
  'leftHand',
  'rightHand',
  'leftUpperLeg',
  'rightUpperLeg',
  'leftLowerLeg',
  'rightLowerLeg',
  'leftFoot',
  'rightFoot',
  'leftToes',
  'rightToes',
]);

export const ROUND_TRIP_JOINT_IDS = Object.freeze([
  ...CORE_MOTION_JOINT_IDS,
]);

const IDENTITY = Object.freeze([0, 0, 0, 1]);
const ZERO = Object.freeze([0, 0, 0]);
const AXIS_TOLERANCE = 1e-6;
const QUATERNION_TOLERANCE = 1e-8;

/**
 * Creates the shared, immutable-input kinematic view used by Pose and Animation.
 * It reuses the active RigDefinition and its bind-local jointAxes; no skeleton
 * definition or runtime state is stored in this module.
 */
export function createHumanKinematicContext(bodyProfile = {}, {
  rigVersion = 'rig@0.4.0',
  definition = null,
} = {}) {
  const normalizedProfile = normalizeBodyProfile(bodyProfile);
  const activeDefinition = definition
    ? normalizeSkeletonDefinition(structuredClone(definition))
    : applyBodyProfileToDefinition(
      createStandardHumanoidPreset('A'),
      normalizedProfile,
      { preservePose: false },
    );
  const joints = activeDefinition.joints.map((joint) => ({
    id: joint.id,
    parentId: joint.parentId,
    localPosition: vector3(joint.localPosition),
    physicalBone: joint.physicalBone !== false,
    isControl: Boolean(joint.isControl),
    role: String(joint.role || (joint.isControl ? 'control' : 'deform')),
    rigTier: String(joint.rigTier || 'core'),
    category: String(joint.category || 'body'),
  }));
  const jointMap = new Map(joints.map((joint) => [joint.id, joint]));
  const children = new Map(joints.map((joint) => [joint.id, []]));
  for (const joint of joints) {
    if (joint.parentId && children.has(joint.parentId)) children.get(joint.parentId).push(joint.id);
  }
  const rest = computeRestWorldPositions(activeDefinition);
  const restPositions = new Map(
    [...rest.entries()].map(([jointId, point]) => [jointId, [point.x, point.y, point.z]]),
  );
  const boneLengths = new Map();
  for (const joint of joints) {
    if (!joint.parentId || joint.physicalBone === false) continue;
    boneLengths.set(joint.id, getBoneLength(activeDefinition, joint.id));
  }
  const jointAxes = structuredClone(activeDefinition.jointAxes ?? {
    schema: 'humanoid_rig/joint_axes@1.0',
    entries: {},
  });
  // The axis values still come exclusively from RigDefinition. This runtime
  // annotation records that the shared Pose/Animation foundation actually
  // consumes them; it does not introduce or derive a second axis profile.
  jointAxes.runtimeApplied = true;
  jointAxes.runtimeConsumer = 'human-motion-canonical-foundation@3';
  for (const [jointId, entry] of Object.entries(jointAxes.entries ?? {})) {
    jointAxes.entries[jointId] = { ...entry, runtimeApplied: true };
  }
  activeDefinition.jointAxes = structuredClone(jointAxes);
  const jointAxisMap = new Map(Object.entries(jointAxes.entries ?? {}));
  const jointTierMap = new Map(joints.map((joint) => [joint.id, classifyJointTier(joint)]));

  return {
    rigVersion: String(rigVersion),
    bodyProfile: normalizedProfile,
    bodyHeight: normalizedProfile.height,
    definition: activeDefinition,
    joints,
    jointMap,
    children,
    restPositions,
    boneLengths,
    jointAxes,
    jointAxisMap,
    jointTierMap,
    coordinateSystem: HUMAN_COORDINATE_SYSTEM,
  };
}

export function validateHumanKinematicContext(contextInput) {
  const context = contextInput?.jointMap
    ? contextInput
    : createHumanKinematicContext(contextInput?.bodyProfile || {});
  const errors = [];
  const warnings = [];
  const ids = new Set();
  let axisCount = 0;
  let invalidAxisCount = 0;

  for (const joint of context.joints || []) {
    if (!joint.id || ids.has(joint.id)) errors.push(`JOINT_ID_INVALID_OR_DUPLICATE:${joint.id || '<empty>'}`);
    ids.add(joint.id);
    if (joint.parentId && !context.jointMap.has(joint.parentId)) {
      errors.push(`PARENT_MISSING:${joint.id}:${joint.parentId}`);
    }
    const axis = context.jointAxisMap.get(joint.id);
    if (!axis) {
      errors.push(`JOINT_AXES_MISSING:${joint.id}`);
      continue;
    }
    axisCount += 1;
    if (!validAxisEntry(axis)) {
      errors.push(`JOINT_AXES_INVALID:${joint.id}`);
      invalidAxisCount += 1;
    }
  }

  const left = context.restPositions.get('leftUpperArm');
  const right = context.restPositions.get('rightUpperArm');
  if (!left || left[0] >= 0) errors.push('LEFT_JOINT_SIGN_INVALID');
  if (!right || right[0] <= 0) errors.push('RIGHT_JOINT_SIGN_INVALID');
  if (context.jointAxes?.handedness !== 'right') errors.push('JOINT_AXES_HANDEDNESS_INVALID');
  if (context.jointAxes?.space !== 'joint-local-at-bind') errors.push('JOINT_AXES_SPACE_INVALID');
  if (context.jointAxes?.runtimeApplied !== true) {
    warnings.push('JOINT_AXES_METADATA_NOT_RUNTIME_APPLIED');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      jointCount: context.joints.length,
      axisCount,
      invalidAxisCount,
      coreJointCount: countTier(context, 'core'),
      performanceJointCount: countTier(context, 'performance'),
    },
  };
}

export function getHumanJointTier(contextInput, jointId) {
  const context = contextInput?.jointMap
    ? contextInput
    : createHumanKinematicContext(contextInput?.bodyProfile || {});
  return context.jointTierMap.get(String(jointId)) || null;
}

export function listHumanJointsByTier(contextInput, tier) {
  const context = contextInput?.jointMap
    ? contextInput
    : createHumanKinematicContext(contextInput?.bodyProfile || {});
  return context.joints
    .filter((joint) => context.jointTierMap.get(joint.id) === tier)
    .map((joint) => joint.id);
}

export function createIdentityOutgoingPose({
  compatibleRig = 'rig@0.4.0',
  name = 'Neutral Pose',
  context = null,
} = {}) {
  const joints = {};
  for (const joint of context?.joints || []) {
    joints[joint.id] = { rotation: [...IDENTITY] };
  }
  return {
    schema: 'humanoid_rig/outgoing_local_pose@1.0',
    name: String(name),
    compatibleRig: String(compatibleRig),
    rotationSpace: 'joint-local-at-bind',
    rotationConvention: OUTGOING_ROTATION_CONVENTION,
    root: {
      position: [...ZERO],
      rotation: [...IDENTITY],
    },
    joints,
  };
}

export function normalizeOutgoingPose(input = {}, contextInput = null) {
  const context = contextInput?.jointMap ? contextInput : null;
  const source = input && typeof input === 'object' ? input : {};
  const pose = createIdentityOutgoingPose({
    compatibleRig: source.compatibleRig || context?.rigVersion || 'rig@0.4.0',
    name: source.name || 'Outgoing Local Pose',
    context,
  });
  pose.root.position = vector3(source.root?.position, ZERO);
  pose.root.rotation = canonicalQuaternion(source.root?.rotation || IDENTITY);
  const sourceJoints = source.joints && typeof source.joints === 'object' ? source.joints : {};
  for (const [jointId, value] of Object.entries(sourceJoints)) {
    const rotation = value?.rotation || value;
    if (!isVector(rotation, 4)) continue;
    pose.joints[jointId] = { rotation: canonicalQuaternion(rotation) };
  }
  if (source.localRotations && typeof source.localRotations === 'object') {
    for (const [jointId, rotation] of Object.entries(source.localRotations)) {
      if (!isVector(rotation, 4)) continue;
      pose.joints[jointId] = { rotation: canonicalQuaternion(rotation) };
    }
  }
  return pose;
}

/**
 * Outgoing joint-local FK. A joint rotation affects the directions of its
 * children; world positions are derived output and never pose authority.
 */
export function forwardKinematicsOutgoingPose(poseInput, contextInput) {
  const context = contextInput?.jointMap
    ? contextInput
    : createHumanKinematicContext(contextInput?.bodyProfile || {});
  const pose = normalizeOutgoingPose(poseInput, context);
  const positions = new Map();
  const rotations = new Map();
  for (const joint of context.joints) {
    const localRotation = joint.id === 'hips'
      ? pose.root.rotation
      : pose.joints[joint.id]?.rotation || IDENTITY;
    if (!joint.parentId) {
      positions.set(joint.id, [...pose.root.position]);
      rotations.set(
        joint.id,
        joint.id === 'root'
          ? canonicalQuaternion(pose.joints.root?.rotation || IDENTITY)
          : canonicalQuaternion(localRotation),
      );
      continue;
    }
    const parentPosition = positions.get(joint.parentId) || ZERO;
    const parentRotation = rotations.get(joint.parentId) || IDENTITY;
    positions.set(
      joint.id,
      addVectors(parentPosition, rotateVectorByQuaternion(joint.localPosition, parentRotation)),
    );
    rotations.set(joint.id, canonicalQuaternion(multiplyQuaternions(parentRotation, localRotation)));
  }
  return { positions, rotations, rig: context, pose };
}

export function rotationFromAnatomicalChannels(contextInput, jointId, channels = {}, {
  order = 'BTS',
} = {}) {
  const context = contextInput?.jointMap
    ? contextInput
    : createHumanKinematicContext(contextInput?.bodyProfile || {});
  const axisEntry = context.jointAxisMap.get(String(jointId));
  if (!axisEntry) throw new Error(`Missing jointAxes entry for ${String(jointId)}.`);
  return canonicalQuaternion(quaternionFromAnatomicalChannels(axisEntry, {
    twist: finite(channels.twist, 0),
    bend: finite(channels.bend, 0),
    side: finite(channels.side, 0),
  }, order));
}

/**
 * The one canonical outgoing-joint -> incoming-bone bridge. The result is keyed
 * by child joint ID because each quaternion rotates that child's bind offset.
 */
export function buildIncomingBoneLocalRotations(fkInput, {
  rootJointId = 'hips',
  rootRotation = null,
} = {}) {
  const fk = fkInput;
  const context = fk?.rig;
  if (!context?.joints || !fk?.positions) return {};

  const children = physicalChildrenByParent(context);
  const localRotations = {};
  const incomingWorldRotations = new Map([[
    rootJointId,
    canonicalQuaternion(rootRotation || fk.rotations?.get(rootJointId) || IDENTITY),
  ]]);

  const visit = (parentId) => {
    const parentPosition = fk.positions.get(parentId);
    const parentIncomingRotation = incomingWorldRotations.get(parentId) || IDENTITY;
    if (!parentPosition) return;
    for (const child of children.get(parentId) || []) {
      const childPosition = fk.positions.get(child.id);
      if (!childPosition) continue;
      const outgoingParentWorldRotation = fk.rotations?.get(parentId);
      let childLocalRotation;
      let childIncomingWorldRotation;
      if (outgoingParentWorldRotation) {
        childIncomingWorldRotation = canonicalQuaternion(outgoingParentWorldRotation);
        childLocalRotation = multiplyQuaternions(
          conjugateQuaternion(parentIncomingRotation),
          childIncomingWorldRotation,
        );
      } else {
        const desiredWorld = subtractVectors(childPosition, parentPosition);
        const desiredParentLocal = rotateVectorByQuaternion(
          desiredWorld,
          conjugateQuaternion(parentIncomingRotation),
        );
        childLocalRotation = quaternionFromTo(child.localPosition, desiredParentLocal);
        childIncomingWorldRotation = multiplyQuaternions(parentIncomingRotation, childLocalRotation);
      }
      localRotations[child.id] = canonicalQuaternion(childLocalRotation);
      incomingWorldRotations.set(child.id, canonicalQuaternion(childIncomingWorldRotation));
      visit(child.id);
    }
  };
  visit(rootJointId);
  return localRotations;
}

export function reconstructIncomingBoneWorldPose(contextInput, snapshot) {
  const context = contextInput?.jointMap
    ? contextInput
    : createHumanKinematicContext(contextInput?.bodyProfile || {}, {
      definition: contextInput?.definition,
      rigVersion: snapshot?.compatibleRig || contextInput?.rigVersion || 'rig@0.4.0',
    });
  const rootJointId = String(snapshot?.rootJointId || 'hips');
  const rootRest = context.restPositions.get(rootJointId);
  if (!rootRest) return { positions: new Map(), rotations: new Map(), rig: context };
  const rootTranslation = vector3(snapshot?.rootTranslation, ZERO);
  const rootRotation = canonicalQuaternion(snapshot?.rootRotation || IDENTITY);
  const localRotations = snapshot?.localRotations && typeof snapshot.localRotations === 'object'
    ? snapshot.localRotations
    : {};
  const children = physicalChildrenByParent(context);
  const positions = new Map([[rootJointId, addVectors(rootRest, rootTranslation)]]);
  const rotations = new Map([[rootJointId, rootRotation]]);
  const visit = (parentId) => {
    const parentPosition = positions.get(parentId);
    const parentIncomingRotation = rotations.get(parentId) || IDENTITY;
    for (const child of children.get(parentId) || []) {
      const childLocal = canonicalQuaternion(localRotations[child.id] || IDENTITY);
      const childIncomingWorld = multiplyQuaternions(parentIncomingRotation, childLocal);
      const childPosition = addVectors(
        parentPosition,
        rotateVectorByQuaternion(child.localPosition, childIncomingWorld),
      );
      positions.set(child.id, childPosition);
      rotations.set(child.id, canonicalQuaternion(childIncomingWorld));
      visit(child.id);
    }
  };
  visit(rootJointId);
  return { positions, rotations, rig: context };
}

export function buildCanonicalPoseSnapshot(outgoingPoseInput, contextInput, {
  name = outgoingPoseInput?.name || 'Canonical Pose',
  solverVersion = 'human-motion-canonical-foundation@3',
  source = 'canonical-pose-builder-v3',
  sourceRepresentation = 'outgoing_local_quaternion_fk',
  ikTargets = [],
  pinnedJoints = {},
  constraints = null,
  updatedAt = new Date().toISOString(),
  fk = null,
} = {}) {
  const context = contextInput?.jointMap
    ? contextInput
    : createHumanKinematicContext(contextInput?.bodyProfile || {});
  const outgoingPose = normalizeOutgoingPose(outgoingPoseInput, context);
  const resolvedFk = fk || forwardKinematicsOutgoingPose(outgoingPose, context);
  const rootJointId = 'hips';
  const rootPosition = resolvedFk.positions.get(rootJointId) || context.restPositions.get(rootJointId) || ZERO;
  const rootRest = context.restPositions.get(rootJointId) || ZERO;
  const incomingRotations = buildIncomingBoneLocalRotations(resolvedFk, {
    rootJointId,
    rootRotation: resolvedFk.rotations.get(rootJointId) || IDENTITY,
  });
  const snapshot = {
    schema: CANONICAL_POSE_SCHEMA,
    schemaVersion: 1,
    type: 'PoseSnapshot',
    compatibleRig: context.rigVersion,
    solverVersion: String(solverVersion),
    name: String(name),
    unit: 'meter',
    coordinateSystem: { ...HUMAN_COORDINATE_SYSTEM },
    source: String(source),
    sourceRepresentation: String(sourceRepresentation),
    rotationSpace: 'local',
    rotationConvention: INCOMING_ROTATION_CONVENTION_FULL,
    rootJointId,
    rootTranslation: subtractVectors(rootPosition, rootRest),
    rootRotation: canonicalQuaternion(resolvedFk.rotations.get(rootJointId) || IDENTITY),
    localRotations: structuredClone(incomingRotations),
    ikTargets: normalizeIkTargets(ikTargets),
    pinnedJoints: normalizePinnedJoints(pinnedJoints, resolvedFk),
    constraints: constraints ? structuredClone(constraints) : defaultPoseConstraints(),
    diagnostics: {},
    updatedAt: String(updatedAt),
  };
  snapshot.diagnostics = diagnoseCanonicalPose({
    context,
    outgoingPose,
    fk: resolvedFk,
    poseSnapshot: snapshot,
    poseName: name,
  });
  return snapshot;
}

export function buildCanonicalV8PosePayload(fkInput, {
  poseName = 'Canonical Pose',
  pinned = new Set(),
  updatedAt = new Date().toISOString(),
} = {}) {
  const fk = fkInput;
  const outgoingLocalRotations = {};
  for (const joint of fk.rig.joints) {
    const worldRotation = canonicalQuaternion(fk.rotations.get(joint.id) || IDENTITY);
    const parentWorldRotation = joint.parentId
      ? canonicalQuaternion(fk.rotations.get(joint.parentId) || IDENTITY)
      : IDENTITY;
    outgoingLocalRotations[joint.id] = canonicalQuaternion(
      multiplyQuaternions(conjugateQuaternion(parentWorldRotation), worldRotation),
    );
  }
  const incomingBoneLocalRotations = buildIncomingBoneLocalRotations(fk, {
    rootJointId: 'hips',
    rootRotation: fk.rotations.get('hips') || IDENTITY,
  });
  const pinnedSet = pinned instanceof Set ? pinned : new Set(pinned || []);
  return {
    schemaVersion: 2,
    type: 'humanoid-pose',
    rigName: fk.rig.definition.name,
    pose: 'CUSTOM',
    unit: 'meter',
    updatedAt,
    poseName,
    rootJointId: 'root',
    localRotations: outgoingLocalRotations,
    incomingBoneLocalRotations,
    rotationConventions: {
      localRotations: OUTGOING_ROTATION_CONVENTION,
      incomingBoneLocalRotations: INCOMING_ROTATION_CONVENTION_FULL,
    },
    diagnostics: {
      worldPositionAuthorityUsed: false,
      lossyWorldReconstructionUsed: false,
    },
    joints: fk.rig.joints.map((joint) => {
      const position = fk.positions.get(joint.id) || ZERO;
      return {
        id: joint.id,
        poseWorldPosition: { x: position[0], y: position[1], z: position[2] },
        pinned: pinnedSet.has(joint.id),
      };
    }),
  };
}

export function validateCanonicalPoseSnapshot(snapshot, contextInput = null) {
  const errors = [];
  const warnings = [];
  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, errors: ['POSE_SNAPSHOT_NOT_OBJECT'], warnings };
  }
  if (snapshot.schema !== CANONICAL_POSE_SCHEMA) errors.push('POSE_SCHEMA_INVALID');
  if (snapshot.type !== 'PoseSnapshot') errors.push('POSE_TYPE_INVALID');
  if (snapshot.rotationSpace !== 'local') errors.push('ROTATION_SPACE_INVALID');
  if (snapshot.rotationConvention !== INCOMING_ROTATION_CONVENTION_FULL) {
    errors.push('ROTATION_CONVENTION_NOT_CANONICAL_FULL_QUATERNION');
  }
  if (!coordinateSystemsEqual(snapshot.coordinateSystem, HUMAN_COORDINATE_SYSTEM)) {
    errors.push('COORDINATE_SYSTEM_INVALID');
  }
  validateVector(snapshot.rootTranslation, 3, 'ROOT_TRANSLATION', errors);
  validateQuaternion(snapshot.rootRotation, 'ROOT_ROTATION', errors);
  if (!snapshot.localRotations || typeof snapshot.localRotations !== 'object' || Array.isArray(snapshot.localRotations)) {
    errors.push('LOCAL_ROTATIONS_INVALID');
  } else {
    for (const [jointId, rotation] of Object.entries(snapshot.localRotations)) {
      validateQuaternion(rotation, `LOCAL_ROTATION:${jointId}`, errors);
    }
  }
  const serialized = JSON.stringify(snapshot);
  // PoseSnapshot may legitimately carry a scalar such as gravity.scale inside
  // its solver constraints. What it must never carry is mutable bind data or a
  // joint/skeleton scale channel.
  for (const forbidden of ['"boneLength"', '"localPosition"', '"parentId"', '"jointScale"', '"skeletonScale"']) {
    if (serialized.includes(forbidden)) errors.push(`BIND_DATA_FORBIDDEN:${forbidden.slice(1, -1)}`);
  }
  if (snapshot.diagnostics?.lossyRotationConversion === true) {
    errors.push('CANONICAL_POSE_MARKED_LOSSY');
  }
  if (contextInput?.jointMap) {
    for (const jointId of Object.keys(snapshot.localRotations || {})) {
      const joint = contextInput.jointMap.get(jointId);
      if (!joint || joint.isControl || joint.physicalBone === false) {
        errors.push(`LOCAL_ROTATION_TARGET_INVALID:${jointId}`);
      }
    }
  }
  return { valid: errors.length === 0, errors: unique(errors), warnings: unique(warnings) };
}

export function compareOutgoingAndIncomingPose(outgoingPoseInput, snapshot, contextInput, {
  jointIds = ROUND_TRIP_JOINT_IDS,
} = {}) {
  const context = contextInput?.jointMap
    ? contextInput
    : createHumanKinematicContext(contextInput?.bodyProfile || {});
  const outgoingFk = forwardKinematicsOutgoingPose(outgoingPoseInput, context);
  const incoming = reconstructIncomingBoneWorldPose(context, snapshot);
  const errorsByJoint = {};
  let maximumPositionError = 0;
  for (const jointId of jointIds) {
    const expected = outgoingFk.positions.get(jointId);
    const actual = incoming.positions.get(jointId);
    if (!expected || !actual) continue;
    const error = vectorLength(subtractVectors(expected, actual));
    errorsByJoint[jointId] = error;
    maximumPositionError = Math.max(maximumPositionError, error);
  }
  return {
    maximumPositionError,
    errorsByJoint,
    comparedJointCount: Object.keys(errorsByJoint).length,
    outgoingFk,
    incoming,
  };
}

export function measureKinematicRoundTripError(outgoingPoseInput, contextInput, options = {}) {
  const context = contextInput?.jointMap
    ? contextInput
    : createHumanKinematicContext(contextInput?.bodyProfile || {});
  const snapshot = options.poseSnapshot || buildCanonicalPoseSnapshot(
    outgoingPoseInput,
    context,
    options,
  );
  return compareOutgoingAndIncomingPose(outgoingPoseInput, snapshot, context, options);
}

export function diagnoseCanonicalPose({
  context: contextInput,
  outgoingPose,
  fk: fkInput = null,
  poseSnapshot,
  poseName = poseSnapshot?.name || outgoingPose?.name || 'Canonical Pose',
} = {}) {
  const context = contextInput?.jointMap
    ? contextInput
    : createHumanKinematicContext(contextInput?.bodyProfile || {});
  const fk = fkInput || forwardKinematicsOutgoingPose(outgoingPose, context);
  const incoming = reconstructIncomingBoneWorldPose(context, poseSnapshot);
  const roundTrip = comparePositionMaps(fk.positions, incoming.positions, ROUND_TRIP_JOINT_IDS);
  const quaternionValues = [
    poseSnapshot?.rootRotation,
    ...Object.values(poseSnapshot?.localRotations || {}),
  ];
  let normalizedQuaternionCount = 0;
  let invalidQuaternionCount = 0;
  for (const quaternion of quaternionValues) {
    if (!isVector(quaternion, 4) || quaternion.some((value) => !Number.isFinite(Number(value)))) {
      invalidQuaternionCount += 1;
      continue;
    }
    const length = Math.hypot(...quaternion.map(Number));
    if (Math.abs(length - 1) <= QUATERNION_TOLERANCE) normalizedQuaternionCount += 1;
    else invalidQuaternionCount += 1;
  }

  const shoulder = symmetryPair(fk.positions, 'leftUpperArm', 'rightUpperArm');
  const hands = symmetryPair(fk.positions, 'leftHand', 'rightHand');
  const elbowPlanes = {
    left: elbowPlane(fk.positions, 'leftUpperArm', 'leftLowerArm', 'leftHand'),
    right: elbowPlane(fk.positions, 'rightUpperArm', 'rightLowerArm', 'rightHand'),
  };
  const mirrorError = maximumMirrorError(fk.positions, context.restPositions.get('hips')?.[0] || 0);
  const warningCodes = [];
  if (invalidQuaternionCount) warningCodes.push('INVALID_OR_NON_NORMALIZED_QUATERNION');
  if (roundTrip.maximumPositionError >= 1e-6) warningCodes.push('KINEMATIC_ROUND_TRIP_EXCEEDED');
  if (shoulder.heightDifference >= 0.004) warningCodes.push('SHOULDER_HEIGHT_ASYMMETRY');
  if (shoulder.depthDifference >= 0.004) warningCodes.push('SHOULDER_DEPTH_ASYMMETRY');

  return {
    poseName: String(poseName),
    compatibleRig: context.rigVersion,
    jointCount: context.joints.length,
    coreJointCount: countTier(context, 'core'),
    performanceJointCount: countTier(context, 'performance'),
    coordinateSystem: { ...HUMAN_COORDINATE_SYSTEM },
    rotationConvention: poseSnapshot?.rotationConvention || null,
    normalizedQuaternionCount,
    invalidQuaternionCount,
    maxBoneLengthError: measureFkBoneLengthError(fk),
    maxRoundTripPositionError: roundTrip.maximumPositionError,
    leftRightMirrorError: mirrorError,
    shoulderHeightDifference: shoulder.heightDifference,
    shoulderDepthDifference: shoulder.depthDifference,
    handHeightDifference: hands.heightDifference,
    handDepthDifference: hands.depthDifference,
    leftElbowPlane: elbowPlanes.left,
    rightElbowPlane: elbowPlanes.right,
    leftFootForwardDot: footForwardDot(fk.positions, 'leftFoot', 'leftToes'),
    rightFootForwardDot: footForwardDot(fk.positions, 'rightFoot', 'rightToes'),
    worldPositionAuthorityUsed: false,
    lossyWorldReconstructionUsed: false,
    rotationDataCompleteness: 'full_quaternion',
    twistDataAvailable: true,
    jointAxisAdapterRequiredForStandardAnimation: false,
    lossyRotationConversion: false,
    warningCodes,
  };
}

export function measureFkBoneLengthError(fk) {
  let maximum = 0;
  for (const joint of fk?.rig?.joints || []) {
    if (!joint.parentId || joint.physicalBone === false) continue;
    const parent = fk.positions.get(joint.parentId);
    const child = fk.positions.get(joint.id);
    const expected = fk.rig.boneLengths.get(joint.id);
    if (!parent || !child || !Number.isFinite(expected)) continue;
    maximum = Math.max(maximum, Math.abs(vectorLength(subtractVectors(child, parent)) - expected));
  }
  return maximum;
}

function physicalChildrenByParent(context) {
  const children = new Map();
  for (const joint of context.joints) {
    if (!joint.parentId || joint.physicalBone === false || joint.isControl) continue;
    const list = children.get(joint.parentId) || [];
    list.push(joint);
    children.set(joint.parentId, list);
  }
  return children;
}

function classifyJointTier(joint) {
  if (joint.role === 'control' || joint.isControl) return 'control';
  if (joint.role === 'marker') return 'marker';
  if (joint.role === 'corrective') return 'derived';
  if (joint.rigTier === 'core') return 'core';
  return 'performance';
}

function countTier(context, tier) {
  let count = 0;
  for (const value of context.jointTierMap.values()) if (value === tier) count += 1;
  return count;
}

function validAxisEntry(entry) {
  const twist = vector3(entry?.twistAxisLocal);
  const bend = vector3(entry?.bendAxisLocal);
  const side = vector3(entry?.sideAxisLocal);
  if (![twist, bend, side].every((axis) => Math.abs(vectorLength(axis) - 1) <= AXIS_TOLERANCE)) return false;
  if (Math.abs(dotVectors(twist, bend)) > AXIS_TOLERANCE) return false;
  if (Math.abs(dotVectors(twist, side)) > AXIS_TOLERANCE) return false;
  if (Math.abs(dotVectors(bend, side)) > AXIS_TOLERANCE) return false;
  return vectorLength(subtractVectors(normalizeVector3(crossVectors(twist, bend)), side)) <= AXIS_TOLERANCE;
}

function normalizePinnedJoints(input, fk) {
  const result = {};
  const entries = Array.isArray(input)
    ? input.map((jointId) => [jointId, { jointId }])
    : Object.entries(input || {});
  for (const [key, value] of entries) {
    const jointId = String(value?.jointId || key);
    const point = value?.targetWorld || fk.positions.get(jointId);
    if (!jointId || !point) continue;
    result[jointId] = {
      jointId,
      targetWorld: vector3(point),
      mode: 'world',
      weight: 1,
    };
  }
  return result;
}

function normalizeIkTargets(input) {
  return (Array.isArray(input) ? input : []).map((target, index) => ({
    targetId: String(target?.targetId || `canonical-target-${index}`),
    jointId: String(target?.jointId || ''),
    kind: String(target?.kind || 'joint'),
    targetWorld: vector3(target?.targetWorld),
    weight: finite(target?.weight, 1),
    transient: Boolean(target?.transient),
  })).filter((target) => target.jointId);
}

function defaultPoseConstraints() {
  return {
    fixedBoneLengths: true,
    rigidPelvis: true,
    jointLimits: true,
    bodyCoupling: 0.8,
    damping: 0.92,
    gravity: { enabled: false, scale: 0.38 },
    ground: { enabled: true, y: 0 },
    solverIterations: 64,
  };
}

function comparePositionMaps(expectedMap, actualMap, jointIds) {
  let maximumPositionError = 0;
  const errorsByJoint = {};
  for (const jointId of jointIds) {
    const expected = expectedMap.get(jointId);
    const actual = actualMap.get(jointId);
    if (!expected || !actual) continue;
    const error = vectorLength(subtractVectors(expected, actual));
    errorsByJoint[jointId] = error;
    maximumPositionError = Math.max(maximumPositionError, error);
  }
  return { maximumPositionError, errorsByJoint };
}

function symmetryPair(positions, leftId, rightId) {
  const left = positions.get(leftId) || ZERO;
  const right = positions.get(rightId) || ZERO;
  return {
    heightDifference: Math.abs(left[1] - right[1]),
    depthDifference: Math.abs(left[2] - right[2]),
  };
}

function maximumMirrorError(positions, centerX) {
  const pairs = [
    ['leftShoulder', 'rightShoulder'],
    ['leftUpperArm', 'rightUpperArm'],
    ['leftLowerArm', 'rightLowerArm'],
    ['leftHand', 'rightHand'],
    ['leftUpperLeg', 'rightUpperLeg'],
    ['leftLowerLeg', 'rightLowerLeg'],
    ['leftFoot', 'rightFoot'],
    ['leftToes', 'rightToes'],
  ];
  let maximum = 0;
  for (const [leftId, rightId] of pairs) {
    const left = positions.get(leftId);
    const right = positions.get(rightId);
    if (!left || !right) continue;
    maximum = Math.max(maximum, Math.hypot(
      (left[0] - centerX) + (right[0] - centerX),
      left[1] - right[1],
      left[2] - right[2],
    ));
  }
  return maximum;
}

function elbowPlane(positions, shoulderId, elbowId, handId) {
  const shoulder = positions.get(shoulderId);
  const elbow = positions.get(elbowId);
  const hand = positions.get(handId);
  if (!shoulder || !elbow || !hand) return [0, 0, 0];
  return normalizeVector3(
    crossVectors(subtractVectors(elbow, shoulder), subtractVectors(hand, elbow)),
    [0, 0, 0],
  ).map(roundDiagnostic);
}

function footForwardDot(positions, footId, toesId) {
  const foot = positions.get(footId);
  const toes = positions.get(toesId);
  if (!foot || !toes) return 0;
  return dotVectors(normalizeVector3(subtractVectors(toes, foot), [0, 0, 1]), [0, 0, 1]);
}

function coordinateSystemsEqual(value, expected) {
  return value?.handedness === expected.handedness
    && value?.upAxis === expected.upAxis
    && value?.forwardAxis === expected.forwardAxis
    && value?.rightAxis === expected.rightAxis;
}

function validateVector(value, length, code, errors) {
  if (!isVector(value, length) || value.some((item) => !Number.isFinite(Number(item)))) errors.push(code);
}

function validateQuaternion(value, code, errors) {
  if (!isVector(value, 4) || value.some((item) => !Number.isFinite(Number(item)))) {
    errors.push(code);
    return;
  }
  if (Math.abs(Math.hypot(...value.map(Number)) - 1) > QUATERNION_TOLERANCE) errors.push(code);
}

function canonicalQuaternion(value) {
  const normalized = normalizeQuaternion(value || IDENTITY);
  return normalized[3] < 0 ? normalized.map((component) => -component) : normalized;
}

function vector3(value, fallback = ZERO) {
  const source = Array.isArray(value) || ArrayBuffer.isView(value)
    ? value
    : [value?.x, value?.y, value?.z];
  return [0, 1, 2].map((index) => finite(source?.[index], fallback[index]));
}

function isVector(value, length) {
  return (Array.isArray(value) || ArrayBuffer.isView(value)) && value.length === length;
}

function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function unique(values) {
  return [...new Set(values)];
}

function roundDiagnostic(value) {
  return Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(9));
}
