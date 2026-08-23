import {
  HUMAN_COORDINATE_SYSTEM,
  buildCanonicalPoseSnapshot,
  buildCanonicalV8PosePayload,
  createHumanKinematicContext,
  createIdentityOutgoingPose,
  diagnoseCanonicalPose,
  forwardKinematicsOutgoingPose,
  rotationFromAnatomicalChannels,
} from './kinematic-contract.js';
import {
  addVectors,
  conjugateQuaternion,
  dotVectors,
  multiplyQuaternions,
  normalizeQuaternion,
  normalizeVector3,
  quaternionFromTo,
  rotateVectorByQuaternion,
  scaleVector,
  subtractVectors,
  vectorLength,
} from '../modules/animation/quaternion.js';

const IDENTITY = Object.freeze([0, 0, 0, 1]);
const PRESET_ALIASES = Object.freeze({
  neutral: 'neutral',
  bind: 'neutral',
  a: 'a',
  'a pose': 'a',
  'a-pose': 'a',
  t: 't',
  't pose': 't',
  't-pose': 't',
  reach: 'reach',
  'reach left': 'reach',
  'reach-left': 'reach',
  step: 'step',
  'step pose': 'step',
  'step-pose': 'step',
});

export function createCanonicalNeutralPose(options = {}) {
  return createCanonicalPosePreset('neutral', options).poseSnapshot;
}

export function createCanonicalAPose(options = {}) {
  return createCanonicalPosePreset('a', options).poseSnapshot;
}

export function createCanonicalTPose(options = {}) {
  return createCanonicalPosePreset('t', options).poseSnapshot;
}

export function createCanonicalReachPose(options = {}) {
  return createCanonicalPosePreset('reach', options).poseSnapshot;
}

export function createCanonicalStepPose(options = {}) {
  return createCanonicalPosePreset('step', options).poseSnapshot;
}

/**
 * Returns the serializable PoseSnapshot plus ephemeral FK/outgoing data used by
 * the host bridge and numerical tests. Only poseSnapshot/v8Payload enter state.
 */
export function createCanonicalPosePreset(presetInput, optionsInput = {}) {
  const preset = PRESET_ALIASES[String(presetInput || '').toLowerCase()] || 'a';
  const options = normalizeBuilderOptions(optionsInput);
  const context = options.context?.jointMap
    ? options.context
    : createHumanKinematicContext(options.bodyProfile, {
      rigVersion: options.rigVersion,
      definition: options.definition,
    });
  const descriptor = buildOutgoingPreset(preset, context, options);
  const fk = forwardKinematicsOutgoingPose(descriptor.outgoingPose, context);
  const updatedAt = options.updatedAt || new Date().toISOString();
  const poseSnapshot = buildCanonicalPoseSnapshot(descriptor.outgoingPose, context, {
    name: descriptor.name,
    source: 'canonical-pose-builder-v3',
    sourceRepresentation: 'outgoing_local_quaternion_fk',
    solverVersion: 'human-motion-canonical-foundation@3',
    ikTargets: descriptor.ikTargets,
    pinnedJoints: descriptor.pinnedJoints,
    constraints: options.constraints,
    updatedAt,
    fk,
  });
  poseSnapshot.diagnostics = {
    ...diagnoseCanonicalPose({
      context,
      outgoingPose: descriptor.outgoingPose,
      fk,
      poseSnapshot,
      poseName: descriptor.name,
    }),
    presetId: preset,
    anatomicalChannelsUsed: true,
    targetErrorM: descriptor.targetErrorM,
    targetClamped: descriptor.targetClamped,
    parameters: descriptor.parameters,
  };
  const pinnedIds = new Set(Object.keys(poseSnapshot.pinnedJoints || {}));
  const v8Payload = buildCanonicalV8PosePayload(fk, {
    poseName: descriptor.name,
    pinned: pinnedIds,
    updatedAt,
  });
  return {
    presetId: preset,
    name: descriptor.name,
    coordinateSystem: HUMAN_COORDINATE_SYSTEM,
    context,
    outgoingPose: descriptor.outgoingPose,
    fk,
    poseSnapshot,
    v8Payload,
    diagnostics: poseSnapshot.diagnostics,
  };
}

function buildOutgoingPreset(preset, context, options) {
  const names = {
    neutral: 'Neutral Pose',
    a: 'A Pose',
    t: 'T Pose',
    reach: options.targetHand === 'right' ? 'Reach Right' : 'Reach Left',
    step: options.swingLeg === 'right' ? 'Step Right' : 'Step Left',
  };
  const outgoingPose = createIdentityOutgoingPose({
    compatibleRig: context.rigVersion,
    name: names[preset],
    context,
  });
  alignPoseToGround(outgoingPose, context, finite(options.groundY, 0));
  let details = {
    outgoingPose,
    name: names[preset],
    ikTargets: [],
    pinnedJoints: options.pinnedJoints,
    targetErrorM: 0,
    targetClamped: false,
    parameters: {},
  };
  if (preset === 't') details = applyCanonicalTPose(details, context, options);
  if (preset === 'reach') details = applyCanonicalReachPose(details, context, options);
  if (preset === 'step') details = applyCanonicalStepPose(details, context, options);
  return details;
}

function applyCanonicalTPose(details, context, options) {
  const pose = details.outgoingPose;
  // The torso remains near bind. The compatibility Shoulder segment positions
  // the ball socket; UpperArm supplies the main abduction. Each downstream
  // segment then receives its own direction and explicit axial twist.
  setAnatomicalRotation(pose, context, 'hips', { bend: 0, twist: 0, side: 0 });
  setAnatomicalRotation(pose, context, 'spine', { bend: 0, twist: 0, side: 0 });
  setAnatomicalRotation(pose, context, 'chest', { bend: 0, twist: 0, side: 0 });
  setAnatomicalRotation(pose, context, 'upperChest', {
    bend: finite(options.upperChestBend, 0.004),
    twist: 0,
    side: 0,
  });

  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1;
    orientJointChild(pose, context, `${side}Shoulder`, `${side}UpperArm`, [sign, 0.025, 0.005], {
      twist: sign * finite(options.clavicleTwist, 0.012),
    });
    orientJointChild(pose, context, `${side}UpperArm`, `${side}LowerArm`, [sign, -0.022, 0.018], {
      twist: sign * finite(options.upperArmTwist, 0.075),
    });
    orientJointChild(pose, context, `${side}LowerArm`, `${side}Hand`, [sign, 0.030, 0.014], {
      twist: sign * finite(options.forearmTwist, 0.035),
    });
    orientJointChild(pose, context, `${side}Hand`, `${side}HandEnd`, [sign, 0.004, 0.020], {
      twist: sign * finite(options.handTwist, 0.10),
    });
  }
  return {
    ...details,
    parameters: {
      upperChestBend: finite(options.upperChestBend, 0.004),
      clavicleTwist: finite(options.clavicleTwist, 0.012),
      upperArmTwist: finite(options.upperArmTwist, 0.075),
      forearmTwist: finite(options.forearmTwist, 0.035),
      handTwist: finite(options.handTwist, 0.10),
    },
  };
}

function applyCanonicalReachPose(details, context, options) {
  const pose = details.outgoingPose;
  const side = options.targetHand === 'right' ? 'right' : 'left';
  const sign = side === 'left' ? -1 : 1;
  const targetDirection = normalizeVector3(
    options.targetDirection || [sign * 0.72, 0.38, 0.58],
    [sign, 0.2, 0.4],
  );

  setAnatomicalRotation(pose, context, 'hips', {
    twist: -sign * 0.025,
    bend: -0.015,
    side: sign * 0.012,
  });
  setAnatomicalRotation(pose, context, 'spine', {
    twist: -sign * 0.035,
    bend: 0.018,
    side: sign * 0.018,
  });
  setAnatomicalRotation(pose, context, 'chest', {
    twist: -sign * 0.045,
    bend: 0.025,
    side: sign * 0.022,
  });
  setAnatomicalRotation(pose, context, 'upperChest', {
    twist: -sign * 0.035,
    bend: 0.018,
    side: sign * 0.018,
  });
  orientJointChild(
    pose,
    context,
    `${side}Shoulder`,
    `${side}UpperArm`,
    normalizeVector3([targetDirection[0], targetDirection[1] * 0.45, targetDirection[2] * 0.75]),
    { twist: sign * 0.025 },
  );

  let fk = forwardKinematicsOutgoingPose(pose, context);
  const shoulder = fk.positions.get(`${side}UpperArm`);
  const elbow = fk.positions.get(`${side}LowerArm`);
  const hand = fk.positions.get(`${side}Hand`);
  const upperLength = vectorLength(subtractVectors(elbow, shoulder));
  const lowerLength = vectorLength(subtractVectors(hand, elbow));
  const maximumReach = upperLength + lowerLength - 1e-6;
  const minimumReach = Math.abs(upperLength - lowerLength) + 1e-6;
  const requestedDistance = finite(options.targetDistance, maximumReach * 0.90);
  const solvedDistance = clamp(requestedDistance, minimumReach, maximumReach);
  const requestedTarget = addVectors(shoulder, scaleVector(targetDirection, solvedDistance));
  const solution = solveTwoBoneTarget(
    shoulder,
    upperLength,
    lowerLength,
    requestedTarget,
    normalizeVector3([sign * 0.12, 0.55, 1], [0, 0, 1]),
  );

  orientJointChild(pose, context, `${side}UpperArm`, `${side}LowerArm`, subtractVectors(solution.middle, shoulder), {
    twist: sign * 0.10,
  });
  orientJointChild(pose, context, `${side}LowerArm`, `${side}Hand`, subtractVectors(solution.end, solution.middle), {
    twist: sign * 0.05,
  });
  orientJointChild(pose, context, `${side}Hand`, `${side}HandEnd`, targetDirection, {
    twist: sign * 0.08,
  });
  fk = forwardKinematicsOutgoingPose(pose, context);
  const actual = fk.positions.get(`${side}Hand`);
  const targetErrorM = vectorLength(subtractVectors(actual, solution.end));
  return {
    ...details,
    outgoingPose: pose,
    ikTargets: [{
      targetId: `canonical-reach-${side}-hand`,
      jointId: `${side}Hand`,
      kind: 'joint',
      targetWorld: solution.end,
      weight: 1,
      transient: false,
    }],
    targetErrorM,
    targetClamped: solution.clamped || Math.abs(requestedDistance - solvedDistance) > 1e-9,
    parameters: {
      targetHand: side,
      targetDirection,
      targetDistance: requestedDistance,
      solvedDistance,
    },
  };
}

function applyCanonicalStepPose(details, context, options) {
  const pose = details.outgoingPose;
  const side = options.swingLeg === 'right' ? 'right' : 'left';
  const supportSide = side === 'left' ? 'right' : 'left';
  const sign = side === 'left' ? -1 : 1;
  const stride = clamp(finite(options.stride, 0.28), 0.08, 0.46);
  const lift = clamp(finite(options.footLift, 0.10), 0.02, 0.22);
  pose.root.position = [
    pose.root.position[0],
    pose.root.position[1] + finite(options.rootLift, 0.025),
    pose.root.position[2] + finite(options.rootForward, 0.025),
  ];

  setAnatomicalRotation(pose, context, 'hips', {
    twist: sign * 0.025,
    bend: -0.015,
    side: -sign * 0.028,
  });
  setAnatomicalRotation(pose, context, 'spine', {
    twist: -sign * 0.020,
    bend: 0.012,
    side: sign * 0.018,
  });
  setAnatomicalRotation(pose, context, 'chest', {
    twist: -sign * 0.025,
    bend: 0.015,
    side: sign * 0.012,
  });

  let fk = forwardKinematicsOutgoingPose(pose, context);
  const hip = fk.positions.get(`${side}UpperLeg`);
  const knee = fk.positions.get(`${side}LowerLeg`);
  const ankle = fk.positions.get(`${side}Foot`);
  const upperLength = vectorLength(subtractVectors(knee, hip));
  const lowerLength = vectorLength(subtractVectors(ankle, knee));
  const requestedTarget = options.targetFootPosition
    ? vector3(options.targetFootPosition)
    : addVectors(ankle, [sign * 0.008, lift, stride]);
  const solution = solveTwoBoneTarget(
    hip,
    upperLength,
    lowerLength,
    requestedTarget,
    [0, 0, 1],
  );
  orientJointChild(pose, context, `${side}UpperLeg`, `${side}LowerLeg`, subtractVectors(solution.middle, hip), {
    twist: sign * 0.025,
  });
  orientJointChild(pose, context, `${side}LowerLeg`, `${side}Foot`, subtractVectors(solution.end, solution.middle));
  orientJointChild(pose, context, `${side}Foot`, `${side}Toes`, [0, -0.04, 1]);
  orientJointChild(pose, context, `${side}Toes`, `${side}ToesEnd`, [0, -0.02, 1]);
  orientJointChild(pose, context, `${supportSide}Foot`, `${supportSide}Toes`, [0, -0.05, 1]);
  orientJointChild(pose, context, `${supportSide}Toes`, `${supportSide}ToesEnd`, [0, -0.02, 1]);

  // Counter-swing uses the same outgoing-local directional solve as the legs.
  orientJointChild(pose, context, `${side}UpperArm`, `${side}LowerArm`, [sign * 0.25, -0.95, -0.18], {
    twist: sign * 0.025,
  });
  orientJointChild(pose, context, `${supportSide}UpperArm`, `${supportSide}LowerArm`, [-sign * 0.25, -0.95, 0.18], {
    twist: -sign * 0.025,
  });
  fk = forwardKinematicsOutgoingPose(pose, context);
  const actual = fk.positions.get(`${side}Foot`);
  const supportTarget = fk.positions.get(`${supportSide}Foot`);
  return {
    ...details,
    outgoingPose: pose,
    ikTargets: [{
      targetId: `canonical-step-${side}-foot`,
      jointId: `${side}Foot`,
      kind: 'joint',
      targetWorld: solution.end,
      weight: 1,
      transient: false,
    }],
    pinnedJoints: {
      ...pinnedJointMap(details.pinnedJoints),
      [`${supportSide}Foot`]: {
        jointId: `${supportSide}Foot`,
        targetWorld: supportTarget,
      },
    },
    targetErrorM: vectorLength(subtractVectors(actual, solution.end)),
    targetClamped: solution.clamped,
    parameters: {
      swingLeg: side,
      supportLeg: supportSide,
      stride,
      footLift: lift,
      targetFootPosition: requestedTarget,
      solvedFootPosition: solution.end,
    },
  };
}

function setAnatomicalRotation(pose, context, jointId, channels, order = 'BTS') {
  setJointRotation(
    pose,
    jointId,
    rotationFromAnatomicalChannels(context, jointId, channels, { order }),
  );
}

function alignPoseToGround(pose, context, groundY) {
  const fk = forwardKinematicsOutgoingPose(pose, context);
  const contactIds = ['leftFoot', 'rightFoot', 'leftToes', 'rightToes', 'leftToesEnd', 'rightToesEnd'];
  let minimumY = Infinity;
  for (const jointId of contactIds) {
    const point = fk.positions.get(jointId);
    if (point) minimumY = Math.min(minimumY, point[1]);
  }
  if (Number.isFinite(minimumY) && minimumY < groundY) {
    pose.root.position[1] += groundY - minimumY;
  }
  return pose;
}

function orientJointChild(pose, context, jointId, childId, targetWorldDirection, {
  twist = 0,
} = {}) {
  const joint = context.jointMap.get(jointId);
  const child = context.jointMap.get(childId);
  if (!joint || !child || child.parentId !== jointId) {
    throw new Error(`Cannot orient ${jointId} -> ${childId}; chain is not present in the active RigDefinition.`);
  }
  const fk = forwardKinematicsOutgoingPose(pose, context);
  const parentWorld = joint.parentId ? fk.rotations.get(joint.parentId) || IDENTITY : IDENTITY;
  const desiredWorld = normalizeVector3(targetWorldDirection, child.localPosition);
  const desiredParentLocal = rotateVectorByQuaternion(desiredWorld, conjugateQuaternion(parentWorld));
  const alignment = quaternionFromTo(child.localPosition, desiredParentLocal);
  const axial = rotationFromAnatomicalChannels(context, jointId, { twist, bend: 0, side: 0 }, { order: 'T' });
  setJointRotation(pose, jointId, multiplyQuaternions(alignment, axial));
  return pose;
}

function setJointRotation(pose, jointId, rotation) {
  const value = stableQuaternion(rotation);
  if (jointId === 'hips') pose.root.rotation = value;
  else pose.joints[jointId] = { rotation: value };
}

function solveTwoBoneTarget(root, firstLength, secondLength, requestedEnd, poleDirection) {
  const toTarget = subtractVectors(requestedEnd, root);
  const rawDistance = vectorLength(toTarget);
  const minimum = Math.abs(firstLength - secondLength) + 1e-6;
  const maximum = firstLength + secondLength - 1e-6;
  const distance = clamp(rawDistance, minimum, maximum);
  const direction = normalizeVector3(toTarget, [0, 0, 1]);
  let pole = subtractVectors(
    normalizeVector3(poleDirection, [0, 0, 1]),
    scaleVector(direction, dotVectors(normalizeVector3(poleDirection, [0, 0, 1]), direction)),
  );
  if (vectorLength(pole) < 1e-6) pole = [0, 1, 0];
  pole = normalizeVector3(pole, [0, 0, 1]);
  const along = (firstLength * firstLength - secondLength * secondLength + distance * distance)
    / (2 * distance);
  const perpendicular = Math.sqrt(Math.max(0, firstLength * firstLength - along * along));
  const end = addVectors(root, scaleVector(direction, distance));
  const middle = addVectors(
    addVectors(root, scaleVector(direction, along)),
    scaleVector(pole, perpendicular),
  );
  return {
    middle,
    end,
    clamped: Math.abs(rawDistance - distance) > 1e-9,
  };
}

function normalizeBuilderOptions(input) {
  const source = input && typeof input === 'object' ? input : {};
  const bodyProfile = source.bodyProfile && typeof source.bodyProfile === 'object'
    ? source.bodyProfile
    : looksLikeBodyProfile(source)
      ? source
      : {};
  return {
    ...source,
    bodyProfile,
    rigVersion: String(source.rigVersion || 'rig@0.4.0'),
    targetHand: source.targetHand === 'right' ? 'right' : 'left',
    swingLeg: source.swingLeg === 'right' ? 'right' : 'left',
    pinnedJoints: source.pinnedJoints || {},
  };
}

function pinnedJointMap(input) {
  if (!Array.isArray(input)) return input && typeof input === 'object' ? input : {};
  return Object.fromEntries(input.map((jointId) => [String(jointId), { jointId: String(jointId) }]));
}

function looksLikeBodyProfile(value) {
  return ['height', 'shoulderWidth', 'hipWidth', 'upperArmLength', 'forearmLength', 'thighLength', 'lowerLegLength']
    .some((key) => Number.isFinite(Number(value?.[key])));
}

function stableQuaternion(value) {
  const quaternion = normalizeQuaternion(value);
  return quaternion[3] < 0 ? quaternion.map((component) => -component) : quaternion;
}

function vector3(value) {
  const source = Array.isArray(value) || ArrayBuffer.isView(value)
    ? value
    : [value?.x, value?.y, value?.z];
  return [0, 1, 2].map((index) => finite(source?.[index], 0));
}

function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, finite(value, minimum)));
}
