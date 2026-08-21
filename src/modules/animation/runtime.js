import { applyBodyProfileToDefinition, bodyProfileKey, normalizeBodyProfile } from '../../../legacy/v8/src/body-profile.js';
import { computeRestWorldPositions, getBoneLength } from '../../../legacy/v8/src/skeleton-model.js';
import { createStandardHumanoidPreset } from '../../../legacy/v8/src/skeleton-presets.js';
import {
  addClip,
  beginGraphTransition,
  compressAnimationClip,
  createEmptyClip,
  finishGraphTransition,
  getActiveClip,
  isNormalizedAnimationClip,
  isNormalizedAnimationState,
  normalizeAnimationState,
  normalizeClip,
  replaceClip,
  resolveClipPhase,
  sampleAnimationClip,
  setActiveClip,
  upsertTrackKeyframe,
} from './model.js';
import {
  addVectors,
  additiveQuaternion,
  clampQuaternionAngle,
  conjugateQuaternion,
  crossVectors,
  dotVectors,
  inverseQuaternion,
  lerpVector,
  multiplyQuaternions,
  normalizeQuaternion,
  normalizeVector3,
  quaternionAngularDistance,
  quaternionFromTo,
  rotateVectorByQuaternion,
  scaleVector,
  slerpQuaternion,
  subtractVectors,
  vectorLength,
} from './quaternion.js';

export const ANIMATION_POSE_SCHEMA = 'humanoid_rig/animation_pose@0.2';
export const ANIMATION_RUNTIME_FRAME_SCHEMA = 'humanoid_rig/animation_runtime_frame@0.2';

const IDENTITY = Object.freeze([0, 0, 0, 1]);
const ZERO = Object.freeze([0, 0, 0]);
const EPSILON = 1e-7;
const RIG_CONTEXT_CACHE = new Map();
const MAX_RIG_CONTEXT_CACHE = 12;
const ROOT_IDS = new Set(['root', 'hips', 'pelvis']);

const DEFAULT_CHAIN_MASKS = Object.freeze({
  root: ['root', 'hips'],
  spine: ['spine', 'chest', 'upperChest'],
  head: ['neck', 'head', 'headTop'],
  left_arm: ['leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'leftHandEnd'],
  right_arm: ['rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand', 'rightHandEnd'],
  upper_body: ['spine', 'chest', 'upperChest', 'neck', 'head', 'headTop', 'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'leftHandEnd', 'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand', 'rightHandEnd'],
  left_leg: ['leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes', 'leftToesEnd'],
  right_leg: ['rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes', 'rightToesEnd'],
  lower_body: ['hips', 'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes', 'leftToesEnd', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes', 'rightToesEnd'],
  full_body: ['*'],
});

const JOINT_CONE_LIMIT_DEGREES = Object.freeze({
  root: 180,
  hips: 70,
  spine: 28,
  chest: 24,
  upperChest: 24,
  neck: 50,
  head: 65,
  leftShoulder: 35,
  rightShoulder: 35,
  leftUpperArm: 175,
  rightUpperArm: 175,
  leftLowerArm: 150,
  rightLowerArm: 150,
  leftHand: 85,
  rightHand: 85,
  leftUpperLeg: 135,
  rightUpperLeg: 135,
  leftLowerLeg: 145,
  rightLowerLeg: 145,
  leftFoot: 60,
  rightFoot: 60,
  leftToes: 50,
  rightToes: 50,
});

const LEG_CHAINS = Object.freeze({
  leftFoot: { hip: 'leftUpperLeg', knee: 'leftLowerLeg', ankle: 'leftFoot', toes: 'leftToes' },
  rightFoot: { hip: 'rightUpperLeg', knee: 'rightLowerLeg', ankle: 'rightFoot', toes: 'rightToes' },
});

export function createRigContext(bodyProfile = {}, {
  rigVersion = 'rig@0.4.0',
} = {}) {
  const normalizedProfile = normalizeBodyProfile(bodyProfile);
  const cacheKey = `${String(rigVersion)}|${bodyProfileKey(normalizedProfile)}`;
  const cached = RIG_CONTEXT_CACHE.get(cacheKey);
  if (cached) return cached;
  const definition = applyBodyProfileToDefinition(
    createStandardHumanoidPreset('A'),
    normalizedProfile,
    { preservePose: false },
  );
  const joints = definition.joints.map((joint) => ({
    id: joint.id,
    parentId: joint.parentId,
    localPosition: joint.localPosition.map(Number),
    physicalBone: joint.physicalBone !== false,
    isControl: Boolean(joint.isControl),
  }));
  const jointMap = new Map(joints.map((joint) => [joint.id, joint]));
  const children = new Map(joints.map((joint) => [joint.id, []]));
  for (const joint of joints) {
    if (joint.parentId && children.has(joint.parentId)) children.get(joint.parentId).push(joint.id);
  }
  const rest = computeRestWorldPositions(definition);
  const restPositions = new Map([...rest.entries()].map(([id, point]) => [id, [point.x, point.y, point.z]]));
  const boneLengths = new Map();
  for (const joint of joints) {
    if (!joint.parentId || joint.physicalBone === false) continue;
    boneLengths.set(joint.id, getBoneLength(definition, joint.id));
  }
  const context = {
    rigVersion: String(rigVersion),
    bodyProfile: normalizedProfile,
    bodyHeight: normalizedProfile.height,
    definition,
    joints,
    jointMap,
    children,
    restPositions,
    boneLengths,
  };
  RIG_CONTEXT_CACHE.set(cacheKey, context);
  while (RIG_CONTEXT_CACHE.size > MAX_RIG_CONTEXT_CACHE) {
    RIG_CONTEXT_CACHE.delete(RIG_CONTEXT_CACHE.keys().next().value);
  }
  return context;
}

export function clearAnimationRigContextCache() {
  RIG_CONTEXT_CACHE.clear();
}

export function createIdentityAnimationPose({
  clipId = null,
  compatibleRig = 'rig@0.4.0',
  time = 0,
} = {}) {
  return {
    schema: ANIMATION_POSE_SCHEMA,
    clipId,
    compatibleRig,
    time: Number(time) || 0,
    rawTime: Number(time) || 0,
    root: { position: [...ZERO], rotation: [...IDENTITY] },
    joints: {},
  };
}

export function normalizeAnimationPose(input, fallback = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const pose = createIdentityAnimationPose({
    clipId: source.clipId ?? fallback.clipId ?? null,
    compatibleRig: source.compatibleRig || fallback.compatibleRig || 'rig@0.4.0',
    time: source.time ?? fallback.time ?? 0,
  });
  pose.rawTime = finite(source.rawTime, pose.time);
  pose.root.position = vector3(source.root?.position, ZERO);
  pose.root.rotation = normalizeQuaternion(source.root?.rotation || IDENTITY);
  const sourceJoints = source.joints && typeof source.joints === 'object' ? source.joints : {};
  for (const [jointId, value] of Object.entries(sourceJoints)) {
    const rotation = value?.rotation || value;
    if (!Array.isArray(rotation) && !ArrayBuffer.isView(rotation)) continue;
    pose.joints[jointId] = { rotation: normalizeQuaternion(rotation) };
  }
  return pose;
}

export function sampleClipPose(clipInput, rawTime, {
  targetBodyHeight = null,
  rootMotionEnabled = true,
  jointMap = null,
} = {}) {
  const clip = isNormalizedAnimationClip(clipInput) ? clipInput : normalizeClip(clipInput);
  const phase = resolveClipPhase(rawTime, clip.duration, clip.loopMode);
  const sampled = sampleAnimationClip(clip, phase.time, { loopMode: 'once' });
  const pose = normalizeAnimationPose({
    ...sampled,
    rawTime,
  });
  pose.time = phase.time;
  pose.rawTime = rawTime;

  if (clip.rootMotionMode === 'root_motion' && rootMotionEnabled && clip.loopMode === 'repeat') {
    const rootTrack = clip.tracks.find((track) => track.channel === 'position' && ROOT_IDS.has(track.jointId));
    if (rootTrack?.keyframes.length) {
      const start = rootTrack.keyframes[0].value;
      const end = rootTrack.keyframes.at(-1).value;
      const cycleDelta = subtractVectors(end, start);
      pose.root.position = addVectors(pose.root.position, scaleVector(cycleDelta, phase.cycles));
    }
  }

  if (!rootMotionEnabled || clip.rootMotionMode === 'in_place') {
    pose.root.position[0] = 0;
    pose.root.position[2] = 0;
  }

  const sourceHeight = positive(clip.metadata?.sourceBodyHeight, 1.795672);
  const targetHeight = positive(targetBodyHeight, sourceHeight);
  const scale = clip.retargetPolicy?.scaleRootMotionByHeight === false ? 1 : targetHeight / sourceHeight;
  pose.root.position = scaleVector(pose.root.position, scale);

  if (jointMap && typeof jointMap === 'object') {
    const mapped = {};
    for (const [sourceId, value] of Object.entries(pose.joints)) {
      const targetId = jointMap[sourceId] || sourceId;
      mapped[targetId] = value;
    }
    pose.joints = mapped;
  }
  return pose;
}

export function blendAnimationPoses(baseInput, layerInput, weight = 1, {
  blendMode = 'override',
  mask = ['*'],
  referencePose = null,
} = {}) {
  const base = normalizeAnimationPose(baseInput);
  const layer = normalizeAnimationPose(layerInput, base);
  const reference = normalizeAnimationPose(referencePose || createIdentityAnimationPose({ compatibleRig: base.compatibleRig }));
  const alpha = clamp(weight, 0, 1);
  const maskSet = expandMask(mask);
  const includesRoot = maskSet.has('*') || maskSet.has('root') || maskSet.has('hips') || maskSet.has('pelvis');
  const output = normalizeAnimationPose(base);

  if (includesRoot) {
    if (blendMode === 'additive') {
      const delta = subtractVectors(layer.root.position, reference.root.position);
      output.root.position = addVectors(base.root.position, scaleVector(delta, alpha));
      const rotationDelta = multiplyQuaternions(inverseQuaternion(reference.root.rotation), layer.root.rotation);
      output.root.rotation = additiveQuaternion(base.root.rotation, rotationDelta, alpha);
    } else {
      output.root.position = lerpVector(base.root.position, layer.root.position, alpha, 3);
      output.root.rotation = slerpQuaternion(base.root.rotation, layer.root.rotation, alpha);
    }
  }

  const ids = new Set([...Object.keys(base.joints), ...Object.keys(layer.joints)]);
  for (const jointId of ids) {
    if (!maskSet.has('*') && !maskSet.has(jointId)) continue;
    const baseRotation = base.joints[jointId]?.rotation || IDENTITY;
    const layerRotation = layer.joints[jointId]?.rotation || IDENTITY;
    let rotation;
    if (blendMode === 'additive') {
      const referenceRotation = reference.joints[jointId]?.rotation || IDENTITY;
      const delta = multiplyQuaternions(inverseQuaternion(referenceRotation), layerRotation);
      rotation = additiveQuaternion(baseRotation, delta, alpha);
    } else {
      rotation = slerpQuaternion(baseRotation, layerRotation, alpha);
    }
    output.joints[jointId] = { rotation };
  }
  output.clipId = layer.clipId || base.clipId;
  output.time = layer.time;
  output.rawTime = layer.rawTime;
  return output;
}

export function crossFadeAnimationPoses(fromPose, toPose, alpha, options = {}) {
  return blendAnimationPoses(fromPose, toPose, alpha, {
    blendMode: 'override',
    mask: options.mask || ['*'],
  });
}

export function sampleAnimationLayers(animationInput, rawTime, {
  nowMs = Date.now(),
  bodyProfile = {},
} = {}) {
  const animation = isNormalizedAnimationState(animationInput)
    ? animationInput
    : normalizeAnimationState(animationInput);
  const targetHeight = positive(bodyProfile?.height, 1.795672);
  const clips = new Map(animation.clips.map((clip) => [clip.clipId, clip]));
  const activeClip = getActiveClip(animation);
  let basePose = sampleClipPose(activeClip, rawTime, {
    targetBodyHeight: targetHeight,
    rootMotionEnabled: animation.runtime.rootMotionEnabled,
    jointMap: animation.retarget.mapping,
  });
  const diagnostics = [{ layerId: 'base', clipId: activeClip.clipId, weight: 1, blendMode: 'override' }];

  const transition = animation.graph?.transition;
  if (transition) {
    const elapsed = Math.max(0, Number(nowMs) - transition.startedAt) / 1000;
    const duration = Math.max(EPSILON, transition.duration);
    const alpha = clamp(elapsed / duration, 0, 1);
    const fromState = animation.graph.states.find((state) => state.stateId === transition.fromStateId);
    const toState = animation.graph.states.find((state) => state.stateId === transition.toStateId);
    const fromClip = clips.get(fromState?.clipId);
    const toClip = clips.get(toState?.clipId) || activeClip;
    if (fromClip && toClip) {
      const fromPose = sampleClipPose(fromClip, transition.fromTime + elapsed * (fromState?.speed || 1), {
        targetBodyHeight: targetHeight,
        rootMotionEnabled: animation.runtime.rootMotionEnabled,
        jointMap: animation.retarget.mapping,
      });
      const toPose = sampleClipPose(toClip, transition.toTime + elapsed * (toState?.speed || 1), {
        targetBodyHeight: targetHeight,
        rootMotionEnabled: animation.runtime.rootMotionEnabled,
        jointMap: animation.retarget.mapping,
      });
      basePose = crossFadeAnimationPoses(fromPose, toPose, alpha);
      diagnostics[0] = { layerId: 'base-transition', clipId: `${fromClip.clipId}→${toClip.clipId}`, weight: alpha, blendMode: 'override' };
    }
  }

  for (const layer of animation.layers || []) {
    if (layer.layerId === 'base' || !layer.enabled || layer.weight <= EPSILON || !layer.clipId) continue;
    const clip = clips.get(layer.clipId);
    if (!clip) continue;
    const layerTime = rawTime * layer.timeScale + layer.timeOffset;
    const pose = sampleClipPose(clip, layerTime, {
      targetBodyHeight: targetHeight,
      rootMotionEnabled: animation.runtime.rootMotionEnabled,
      jointMap: animation.retarget.mapping,
    });
    let referencePose = null;
    if (layer.blendMode === 'additive') {
      referencePose = sampleClipPose(clip, layer.referenceTime, {
        targetBodyHeight: targetHeight,
        rootMotionEnabled: false,
        jointMap: animation.retarget.mapping,
      });
    }
    basePose = blendAnimationPoses(basePose, pose, layer.weight, {
      blendMode: layer.blendMode,
      mask: layer.mask,
      referencePose,
    });
    diagnostics.push({
      layerId: layer.layerId,
      clipId: layer.clipId,
      weight: layer.weight,
      blendMode: layer.blendMode,
    });
  }

  return { pose: basePose, layers: diagnostics, activeClip };
}

export function clampPoseToJointLimits(poseInput, {
  limits = JOINT_CONE_LIMIT_DEGREES,
} = {}) {
  const pose = normalizeAnimationPose(poseInput);
  const clampedJoints = [];
  for (const [jointId, value] of Object.entries(pose.joints)) {
    const degrees = Number(limits[jointId] ?? 180);
    const maximum = Math.max(0, degrees) * Math.PI / 180;
    const clamped = clampQuaternionAngle(value.rotation, maximum);
    if (quaternionAngularDistance(clamped, value.rotation) > 1e-6) clampedJoints.push(jointId);
    pose.joints[jointId] = { rotation: clamped };
  }
  return { pose, clampedJoints };
}

export function forwardKinematics(poseInput, rigContextInput) {
  const pose = normalizeAnimationPose(poseInput);
  const rig = rigContextInput?.jointMap ? rigContextInput : createRigContext(rigContextInput?.bodyProfile || {});
  const positions = new Map();
  const rotations = new Map();
  for (const joint of rig.joints) {
    const localRotation = joint.id === 'hips'
      ? pose.root.rotation
      : pose.joints[joint.id]?.rotation || IDENTITY;
    if (!joint.parentId) {
      positions.set(joint.id, [...pose.root.position]);
      rotations.set(joint.id, joint.id === 'root' ? (pose.joints.root?.rotation || IDENTITY) : localRotation);
      continue;
    }
    const parentPosition = positions.get(joint.parentId) || ZERO;
    const parentRotation = rotations.get(joint.parentId) || IDENTITY;
    const offset = rotateVectorByQuaternion(joint.localPosition, parentRotation);
    positions.set(joint.id, addVectors(parentPosition, offset));
    rotations.set(joint.id, multiplyQuaternions(parentRotation, localRotation));
  }
  return { positions, rotations, rig };
}

/**
 * Converts the animation runtime's conventional outgoing-bone rotations to
 * the position solver's incoming-bone PoseSnapshot convention. This adapter
 * deliberately lives at the module boundary so existing clips and Three.js
 * joint semantics remain unchanged.
 */
export function buildIncomingBoneLocalRotations(fkInput, {
  rootJointId = 'hips',
  rootRotation = null,
} = {}) {
  const fk = fkInput;
  const rig = fk?.rig;
  if (!rig?.joints || !fk?.positions) return {};

  const children = new Map();
  for (const joint of rig.joints) {
    if (!joint.parentId || !joint.physicalBone || joint.isControl) continue;
    const list = children.get(joint.parentId) ?? [];
    list.push(joint);
    children.set(joint.parentId, list);
  }

  const localRotations = {};
  const worldRotations = new Map([[
    rootJointId,
    normalizeQuaternion(rootRotation || fk.rotations.get(rootJointId) || IDENTITY),
  ]]);
  const visit = (parentId) => {
    const parentPosition = fk.positions.get(parentId);
    const parentRotation = worldRotations.get(parentId) || IDENTITY;
    if (!parentPosition) return;
    for (const child of children.get(parentId) ?? []) {
      const childPosition = fk.positions.get(child.id);
      if (!childPosition) continue;
      const desiredWorld = subtractVectors(childPosition, parentPosition);
      const desiredParentLocal = rotateVectorByQuaternion(
        desiredWorld,
        conjugateQuaternion(parentRotation),
      );
      const childLocalRotation = quaternionFromTo(child.localPosition, desiredParentLocal);
      localRotations[child.id] = normalizeQuaternion(childLocalRotation);
      worldRotations.set(
        child.id,
        multiplyQuaternions(parentRotation, childLocalRotation),
      );
      visit(child.id);
    }
  };
  visit(rootJointId);
  return localRotations;
}

export function getActiveClipContacts(clipInput, rawTime) {
  const clip = isNormalizedAnimationClip(clipInput) ? clipInput : normalizeClip(clipInput);
  const phase = resolveClipPhase(rawTime, clip.duration, clip.loopMode);
  return clip.contacts.filter((contact) => phase.time >= contact.start - EPSILON && phase.time <= contact.end + EPSILON).map((contact) => ({
    ...structuredClone(contact),
    phaseTime: phase.time,
    cycle: phase.cycles,
    direction: phase.direction,
  }));
}

export function applyFootContactLocks(poseInput, clipInput, rawTime, rigContextInput, {
  targetBodyHeight = null,
  rootMotionEnabled = true,
} = {}) {
  const clip = isNormalizedAnimationClip(clipInput) ? clipInput : normalizeClip(clipInput);
  const rig = rigContextInput?.jointMap ? rigContextInput : createRigContext(rigContextInput?.bodyProfile || {});
  let pose = normalizeAnimationPose(poseInput);
  const contacts = getActiveClipContacts(clip, rawTime);
  const targets = [];
  for (const contact of contacts) {
    const chain = LEG_CHAINS[contact.jointId];
    if (!chain) continue;
    const plantRawTime = contactPlantRawTime(clip, rawTime, contact);
    const plantPose = sampleClipPose(clip, plantRawTime, {
      targetBodyHeight: targetBodyHeight || rig.bodyHeight,
      rootMotionEnabled,
    });
    const plantFk = forwardKinematics(plantPose, rig);
    const target = plantFk.positions.get(contact.jointId);
    if (!target) continue;
    targets.push({
      contact,
      chain,
      target: [...target],
      plantPose,
      rotationReferenceWorld: normalizeQuaternion(plantFk.rotations.get(contact.jointId) || IDENTITY),
    });
  }

  // Translate the root just enough to keep every active two-bone leg target
  // inside its reachable annulus. This prevents a support foot from drifting
  // when a proportion profile has unusually long or short legs.
  for (let iteration = 0; iteration < 3 && targets.length; iteration += 1) {
    const fk = forwardKinematics(pose, rig);
    const corrections = [];
    for (const item of targets) {
      const hip = fk.positions.get(item.chain.hip);
      const knee = fk.positions.get(item.chain.knee);
      const ankle = fk.positions.get(item.chain.ankle);
      if (!hip || !knee || !ankle) continue;
      const upper = distance(hip, knee);
      const lower = distance(knee, ankle);
      const delta = subtractVectors(item.target, hip);
      const rawDistance = vectorLength(delta);
      if (rawDistance < EPSILON) continue;
      const direction = normalizeVector3(delta, [0, -1, 0]);
      const minimum = Math.abs(upper - lower) + 1e-5;
      const maximum = upper + lower - 1e-5;
      if (rawDistance > maximum) {
        corrections.push(scaleVector(direction, rawDistance - maximum + 1e-5));
      } else if (rawDistance < minimum) {
        corrections.push(scaleVector(direction, -(minimum - rawDistance + 1e-5)));
      }
    }
    if (!corrections.length) break;
    const correction = corrections.reduce((sum, value) => addVectors(sum, value), [...ZERO]);
    pose.root.position = addVectors(pose.root.position, scaleVector(correction, 1 / corrections.length));
  }

  const beforeFk = forwardKinematics(pose, rig);
  const beforeByJoint = new Map(targets.map((item) => [item.contact.jointId, beforeFk.positions.get(item.contact.jointId)]));
  const clampedByJoint = new Map();
  for (let iteration = 0; iteration < 2; iteration += 1) {
    for (const item of targets) {
      const solved = solveTwoBoneLeg(pose, rig, item.chain, item.target, {
        rotationReferenceWorld: item.rotationReferenceWorld,
        rotationWeight: item.contact.rotationWeight,
      });
      pose = solved.pose;
      clampedByJoint.set(item.contact.jointId, Boolean(clampedByJoint.get(item.contact.jointId) || solved.clamped));
    }
  }

  const afterFk = forwardKinematics(pose, rig);
  const reports = targets.map((item) => ({
    contactId: item.contact.id,
    jointId: item.contact.jointId,
    target: [...item.target],
    beforeError: distance(beforeByJoint.get(item.contact.jointId), item.target),
    afterError: distance(afterFk.positions.get(item.contact.jointId), item.target),
    clamped: Boolean(clampedByJoint.get(item.contact.jointId)),
  }));
  return { pose, contacts, reports };
}

export function followAnimationPose(previousInput, targetInput, {
  deltaTime = 1 / 60,
  stiffness = 0.86,
  damping = 0.92,
} = {}) {
  const target = normalizeAnimationPose(targetInput);
  if (!previousInput) return target;
  const previous = normalizeAnimationPose(previousInput, target);
  const dt = clamp(deltaTime, 0, 0.25);
  const frequency = 2 + clamp(stiffness, 0, 1) * 28;
  const dampingScale = 0.35 + clamp(damping, 0, 1) * 0.65;
  const alpha = clamp((1 - Math.exp(-frequency * dt)) * dampingScale, 0, 1);
  return blendAnimationPoses(previous, target, alpha, { blendMode: 'override', mask: ['*'] });
}

export function sampleAnimationRuntime(animationInput, {
  rawTime = 0,
  nowMs = Date.now(),
  bodyProfile = {},
  rigVersion = 'rig@0.4.0',
  previousFinalPose = null,
  deltaTime = 1 / 60,
} = {}) {
  const animation = normalizeAnimationState(animationInput, { compatibleRig: rigVersion });
  const rig = createRigContext(bodyProfile, { rigVersion });
  const layerSample = sampleAnimationLayers(animation, rawTime, { nowMs, bodyProfile: rig.bodyProfile });

  const desiredPose = normalizeAnimationPose(layerSample.pose);
  const animationFk = forwardKinematics(desiredPose, rig);
  const limitResult = animation.runtime.jointLimitsEnabled
    ? clampPoseToJointLimits(desiredPose)
    : { pose: normalizeAnimationPose(desiredPose), clampedJoints: [] };
  let constrainedPose = limitResult.pose;

  const contactResult = animation.runtime.footLockEnabled && animation.retarget.preserveContacts
    ? applyFootContactLocks(constrainedPose, layerSample.activeClip, rawTime, rig, {
      targetBodyHeight: rig.bodyHeight,
      rootMotionEnabled: animation.runtime.rootMotionEnabled,
    })
    : { pose: constrainedPose, contacts: [], reports: [] };
  constrainedPose = contactResult.pose;

  let finalPose = constrainedPose;
  if (animation.runtime.mode === 'physical_follow') {
    finalPose = followAnimationPose(previousFinalPose, constrainedPose, {
      deltaTime,
      stiffness: animation.runtime.followStiffness,
      damping: animation.runtime.followDamping,
    });
  } else if (animation.runtime.mode === 'full_physics' && previousFinalPose) {
    finalPose = normalizeAnimationPose(previousFinalPose, constrainedPose);
  }

  const simulationFk = forwardKinematics(finalPose, rig);
  const selectedPose = animation.runtime.previewSource === 'desired_pose' ? desiredPose : finalPose;
  const selectedFk = animation.runtime.previewSource === 'desired_pose' ? animationFk : simulationFk;
  const pinned = new Set(contactResult.contacts.map((contact) => contact.jointId));
  const v8Payload = buildV8PosePayload(selectedFk, {
    poseName: `${layerSample.activeClip.name} Animation`,
    pinned,
    updatedAt: `animation:${layerSample.activeClip.clipId}:${Number(rawTime).toFixed(4)}`,
  });
  const maxContactError = contactResult.reports.length
    ? Math.max(...contactResult.reports.map((report) => report.afterError))
    : 0;
  return {
    schema: ANIMATION_RUNTIME_FRAME_SCHEMA,
    rawTime,
    time: selectedPose.time,
    activeClipId: layerSample.activeClip.clipId,
    animationRig: {
      rigVersion,
      pose: desiredPose,
      fk: animationFk,
    },
    simulationRig: {
      rigVersion,
      pose: finalPose,
      fk: simulationFk,
    },
    desiredPose,
    constrainedPose,
    finalPose,
    selectedPose,
    fk: selectedFk,
    v8Payload,
    contacts: contactResult.contacts,
    contactReports: contactResult.reports,
    diagnostics: {
      rigVersion,
      bodyHeight: rig.bodyHeight,
      layers: layerSample.layers,
      jointLimitClampCount: limitResult.clampedJoints.length,
      clampedJoints: limitResult.clampedJoints,
      animationRigBoneLengthError: measureBoneLengthError(animationFk),
      simulationRigBoneLengthError: measureBoneLengthError(simulationFk),
      maxBoneLengthError: measureBoneLengthError(simulationFk),
      maxContactError,
      runtimeMode: animation.runtime.mode,
      previewSource: animation.runtime.previewSource,
      fullPhysicsRequiresPoseSolver: animation.runtime.mode === 'full_physics',
    },
  };
}

export function buildV8PosePayload(fkInput, {
  poseName = 'Animation Preview',
  pinned = new Set(),
  updatedAt = new Date().toISOString(),
} = {}) {
  const fk = fkInput;
  const localRotations = {};
  for (const joint of fk.rig.joints) {
    const worldRotation = normalizeQuaternion(fk.rotations.get(joint.id) || IDENTITY);
    const parentWorldRotation = joint.parentId
      ? normalizeQuaternion(fk.rotations.get(joint.parentId) || IDENTITY)
      : IDENTITY;
    localRotations[joint.id] = normalizeQuaternion(
      multiplyQuaternions(conjugateQuaternion(parentWorldRotation), worldRotation),
    );
  }
  const incomingBoneLocalRotations = buildIncomingBoneLocalRotations(fk, {
    rootJointId: 'hips',
    rootRotation: fk.rotations.get('hips') || IDENTITY,
  });
  return {
    schemaVersion: 2,
    type: 'humanoid-pose',
    rigName: fk.rig.definition.name,
    pose: 'CUSTOM',
    unit: 'meter',
    updatedAt,
    poseName,
    rootJointId: 'root',
    localRotations,
    incomingBoneLocalRotations,
    rotationConventions: {
      localRotations: 'outgoing_bone_parent_rotation',
      incomingBoneLocalRotations: 'incoming_bone_bind_delta_zero_twist',
    },
    joints: fk.rig.joints.map((joint) => {
      const position = fk.positions.get(joint.id) || ZERO;
      return {
        id: joint.id,
        poseWorldPosition: { x: position[0], y: position[1], z: position[2] },
        pinned: pinned.has(joint.id),
      };
    }),
  };
}


export function deriveLocalPoseFromV8Payload(payloadInput, rigContextInput = null) {
  const payload = payloadInput?.payload && Array.isArray(payloadInput.payload.joints)
    ? payloadInput.payload
    : payloadInput;
  if (!Array.isArray(payload?.joints)) return null;
  const rig = rigContextInput?.jointMap ? rigContextInput : createRigContext(rigContextInput?.bodyProfile || {});
  const observed = new Map();
  for (const joint of payload.joints) {
    const point = joint?.poseWorldPosition;
    if (!joint?.id || !point) continue;
    const value = [Number(point.x), Number(point.y), Number(point.z)];
    if (value.every(Number.isFinite)) observed.set(String(joint.id), value);
  }
  const hipsJoint = rig.jointMap.get('hips');
  const observedHips = observed.get('hips');
  if (!hipsJoint || !observedHips) return null;

  const pose = createIdentityAnimationPose({ compatibleRig: rig.rigVersion });
  pose.root.position = observed.has('root')
    ? [...observed.get('root')]
    : subtractVectors(observedHips, hipsJoint.localPosition);

  const encodedLocalRotations = new Map();
  if (payload.localRotations && typeof payload.localRotations === 'object') {
    for (const [jointId, value] of Object.entries(payload.localRotations)) {
      const rotation = readPayloadQuaternion(value);
      if (rotation) encodedLocalRotations.set(jointId, rotation);
    }
  }
  if (encodedLocalRotations.size) {
    for (const joint of rig.joints) {
      const localRotation = encodedLocalRotations.get(joint.id);
      if (!localRotation) continue;
      if (joint.id === 'root') pose.joints.root = { rotation: localRotation };
      else if (joint.id === 'hips') pose.root.rotation = localRotation;
      else pose.joints[joint.id] = { rotation: localRotation };
    }
    pose.metadata = {
      source: `v8-local-quaternion@${Number(payload.schemaVersion) || 2}`,
      observedJointCount: observed.size,
      encodedRotationCount: encodedLocalRotations.size,
      approximation: 'none',
    };
    return pose;
  }

  pose.root.rotation = [...IDENTITY];
  const worldRotations = new Map([['root', [...IDENTITY]]]);

  for (const joint of rig.joints) {
    if (joint.id === 'root') continue;
    const parentWorld = worldRotations.get(joint.parentId) || IDENTITY;
    const childId = selectOrientationChild(joint.id, rig, observed);
    let localRotation = IDENTITY;
    if (childId) {
      const currentWorld = observed.get(joint.id);
      const childWorld = observed.get(childId);
      const childJoint = rig.jointMap.get(childId);
      if (currentWorld && childWorld && childJoint) {
        const desiredWorld = subtractVectors(childWorld, currentWorld);
        const desiredParentLocal = rotateVectorByQuaternion(desiredWorld, conjugateQuaternion(parentWorld));
        localRotation = quaternionFromTo(childJoint.localPosition, desiredParentLocal);
      }
    }
    if (joint.id === 'hips') pose.root.rotation = normalizeQuaternion(localRotation);
    else pose.joints[joint.id] = { rotation: normalizeQuaternion(localRotation) };
    worldRotations.set(joint.id, multiplyQuaternions(parentWorld, localRotation));
  }
  pose.metadata = {
    source: 'v8-world-position@1',
    observedJointCount: observed.size,
    approximation: 'single-child-orientation',
  };
  return pose;
}

export function createPoseSnapshotFromLocalPose(poseInput, {
  name = 'Recorded Local Pose',
  pinned = [],
} = {}) {
  const pose = normalizeAnimationPose(poseInput);
  return {
    name,
    pinned: [...pinned],
    root: structuredClone(pose.root),
    localRotations: Object.fromEntries(
      Object.entries(pose.joints).map(([jointId, value]) => [jointId, [...value.rotation]]),
    ),
  };
}

export function collectAnimationEvents(clipInput, fromRawTime, toRawTime) {
  const clip = isNormalizedAnimationClip(clipInput) ? clipInput : normalizeClip(clipInput);
  const from = finite(fromRawTime, 0);
  const to = finite(toRawTime, from);
  if (!clip.events.length || Math.abs(to - from) < EPSILON) return [];
  const forward = to > from;
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const occurrences = [];

  if (clip.loopMode === 'once') {
    for (const event of clip.events) pushOccurrence(event.time, event, 0, 1);
  } else if (clip.loopMode === 'repeat') {
    const firstCycle = Math.floor(low / clip.duration) - 1;
    const lastCycle = Math.floor(high / clip.duration) + 1;
    for (let cycle = firstCycle; cycle <= lastCycle; cycle += 1) {
      for (const event of clip.events) pushOccurrence(cycle * clip.duration + event.time, event, cycle, 1);
    }
  } else {
    const period = clip.duration * 2;
    const firstCycle = Math.floor(low / period) - 1;
    const lastCycle = Math.floor(high / period) + 1;
    for (let cycle = firstCycle; cycle <= lastCycle; cycle += 1) {
      const base = cycle * period;
      for (const event of clip.events) {
        pushOccurrence(base + event.time, event, cycle, 1);
        if (event.time > EPSILON && event.time < clip.duration - EPSILON) {
          pushOccurrence(base + period - event.time, event, cycle, -1);
        }
      }
    }
  }

  function pushOccurrence(rawTime, event, cycle, playbackDirection) {
    const inside = forward
      ? rawTime > from + EPSILON && rawTime <= to + EPSILON
      : rawTime < from - EPSILON && rawTime >= to - EPSILON;
    if (!inside) return;
    occurrences.push({
      ...structuredClone(event),
      clipId: clip.clipId,
      rawTime,
      cycle,
      playbackDirection: forward ? playbackDirection : -playbackDirection,
    });
  }

  occurrences.sort((a, b) => forward ? a.rawTime - b.rawTime : b.rawTime - a.rawTime);
  return occurrences;
}

export function evaluateAnimationGraph(animationInput, {
  rawTime = 0,
  nowMs = Date.now(),
} = {}) {
  let animation = isNormalizedAnimationState(animationInput)
    ? structuredClone(animationInput)
    : normalizeAnimationState(animationInput);
  const graph = animation.graph;
  let changed = false;
  let transitionStarted = null;
  let transitionFinished = null;

  if (graph.transition) {
    const elapsed = Math.max(0, nowMs - graph.transition.startedAt) / 1000;
    if (elapsed >= graph.transition.duration - EPSILON) {
      transitionFinished = graph.transition.transitionId;
      animation = finishGraphTransition(animation);
      changed = true;
    }
  }

  if (!animation.graph.transition) {
    const state = animation.graph.states.find((item) => item.stateId === animation.graph.activeStateId);
    const clip = animation.clips.find((item) => item.clipId === state?.clipId) || getActiveClip(animation);
    const normalizedTime = clip.duration > EPSILON ? resolveClipPhase(rawTime, clip.duration, clip.loopMode).time / clip.duration : 0;
    const candidates = animation.graph.transitions
      .filter((transition) => transition.fromStateId === '*' || transition.fromStateId === animation.graph.activeStateId)
      .filter((transition) => transition.exitTime == null || normalizedTime >= transition.exitTime)
      .filter((transition) => transition.conditions.every((condition) => evaluateGraphCondition(animation.graph.parameters, condition)))
      .sort((a, b) => b.priority - a.priority || a.transitionId.localeCompare(b.transitionId));
    const selected = candidates[0];
    if (selected && selected.toStateId !== animation.graph.activeStateId) {
      animation = beginGraphTransition(animation, selected.toStateId, {
        duration: selected.duration,
        nowMs,
        fromTime: resolveClipPhase(rawTime, clip.duration, clip.loopMode).time,
        toTime: 0,
      });
      transitionStarted = selected.transitionId;
      changed = true;
    }
  }

  return { animation, changed, transitionStarted, transitionFinished };
}

export function bakeAnimationClip(clipInput, {
  bodyProfile = {},
  rigVersion = 'rig@0.4.0',
  sampleRate = 30,
  includeRootMotion = true,
  includeEvents = true,
  applyContacts = true,
  quaternionToleranceDegrees = 0.35,
  positionToleranceMeters = 0.001,
} = {}) {
  const source = isNormalizedAnimationClip(clipInput)
    ? clipInput
    : normalizeClip(clipInput, { compatibleRig: rigVersion });
  const fps = clamp(sampleRate, 1, 120);
  const animation = normalizeAnimationState({
    activeClipId: source.clipId,
    clips: [source],
    runtime: {
      mode: 'exact',
      previewSource: 'final_pose',
      footLockEnabled: applyContacts,
      jointLimitsEnabled: true,
      rootMotionEnabled: includeRootMotion,
    },
  }, { compatibleRig: rigVersion });
  let baked = createEmptyClip({
    clipId: `${source.clipId}-baked`,
    name: `${source.name} Baked`,
    duration: source.duration,
    compatibleRig: rigVersion,
    sourceProportionRevision: source.sourceProportionRevision,
    loopMode: source.loopMode,
    rootMotionMode: includeRootMotion ? source.rootMotionMode : 'in_place',
    rootJointId: source.rootJointId,
    metadata: {
      ...source.metadata,
      bakedFrom: source.clipId,
      bakedSource: 'final_pose',
      sampleRate: fps,
      bakedAt: new Date().toISOString(),
    },
    retargetPolicy: source.retargetPolicy,
  });
  const frameCount = Math.max(1, Math.round(source.duration * fps));
  let previous = null;
  let maxContactError = 0;
  for (let frame = 0; frame <= frameCount; frame += 1) {
    const time = frame === frameCount ? source.duration : frame / fps;
    const runtimeFrame = sampleAnimationRuntime(animation, {
      rawTime: time,
      nowMs: 0,
      bodyProfile,
      rigVersion,
      previousFinalPose: previous,
      deltaTime: 1 / fps,
    });
    const pose = runtimeFrame.finalPose;
    previous = pose;
    maxContactError = Math.max(maxContactError, runtimeFrame.diagnostics.maxContactError);
    for (const [jointId, value] of Object.entries(pose.joints)) {
      baked = upsertTrackKeyframe(baked, {
        jointId,
        channel: 'rotation',
        time,
        value: value.rotation,
        keyframeId: `baked-${jointId}-${frame}`,
      });
    }
    baked = upsertTrackKeyframe(baked, {
      jointId: source.rootJointId,
      channel: 'rotation',
      time,
      value: pose.root.rotation,
      keyframeId: `baked-root-rotation-${frame}`,
    });
    baked = upsertTrackKeyframe(baked, {
      jointId: source.rootJointId,
      channel: 'position',
      time,
      value: pose.root.position,
      keyframeId: `baked-root-position-${frame}`,
    });
  }
  baked.events = includeEvents ? structuredClone(source.events) : [];
  baked.contacts = structuredClone(source.contacts);
  baked.quality = {
    validated: true,
    maxBoneLengthError: 0,
    maxContactError,
    maxJointAngularVelocity: null,
    warnings: [],
  };
  baked = compressAnimationClip(baked, { quaternionToleranceDegrees, positionToleranceMeters });
  return baked;
}

export function retargetAnimationClip(clipInput, {
  targetRig = 'rig@0.4.0',
  targetProportionRevision = 0,
  targetBodyProfile = {},
  mapping = {},
} = {}) {
  const source = isNormalizedAnimationClip(clipInput) ? clipInput : normalizeClip(clipInput);
  const targetHeight = positive(targetBodyProfile?.height, positive(source.metadata?.sourceBodyHeight, 1.795672));
  const sourceHeight = positive(source.metadata?.sourceBodyHeight, 1.795672);
  const rootScale = source.retargetPolicy.scaleRootMotionByHeight === false ? 1 : targetHeight / sourceHeight;
  const target = structuredClone(source);
  target.clipId = `${source.clipId}-retarget-${targetProportionRevision || 'target'}`;
  target.name = `${source.name} Retargeted`;
  target.clipRevision = 1;
  target.compatibleRig = targetRig;
  target.sourceProportionRevision = Math.max(0, Number(targetProportionRevision) || 0);
  target.tracks = source.tracks.map((track) => {
    const jointId = mapping[track.jointId] || track.jointId;
    return {
      ...structuredClone(track),
      jointId,
      trackId: `${jointId}:${track.channel}`,
      keyframes: track.keyframes.map((key) => ({
        ...structuredClone(key),
        id: `retarget-${key.id}`,
        value: track.channel === 'position' ? scaleVector(key.value, rootScale) : [...key.value],
      })),
    };
  });
  target.contacts = source.contacts.map((contact) => ({
    ...structuredClone(contact),
    jointId: mapping[contact.jointId] || contact.jointId,
  }));
  target.metadata = {
    ...target.metadata,
    retargetedFrom: source.clipId,
    sourceBodyHeight: targetHeight,
    rootMotionScale: rootScale,
    targetProportionRevision,
  };
  target.retargetPolicy = { ...target.retargetPolicy, mapping: structuredClone(mapping) };
  return normalizeClip(target, { compatibleRig: targetRig });
}

export function diagnoseRetargetCompatibility(clipInput, rigContextInput, {
  mapping = {},
} = {}) {
  const clip = isNormalizedAnimationClip(clipInput) ? clipInput : normalizeClip(clipInput);
  const rig = rigContextInput?.jointMap ? rigContextInput : createRigContext(rigContextInput?.bodyProfile || {});
  const unknownJoints = [];
  for (const track of clip.tracks) {
    const targetId = mapping[track.jointId] || track.jointId;
    if (!rig.jointMap.has(targetId)) unknownJoints.push(track.jointId);
  }
  const sourceHeight = positive(clip.metadata?.sourceBodyHeight, 1.795672);
  return {
    compatible: unknownJoints.length === 0,
    sourceRig: clip.compatibleRig,
    targetRig: rig.rigVersion,
    sourceHeight,
    targetHeight: rig.bodyHeight,
    rootMotionScale: clip.retargetPolicy.scaleRootMotionByHeight === false ? 1 : rig.bodyHeight / sourceHeight,
    unknownJoints: [...new Set(unknownJoints)],
    preserveContacts: clip.retargetPolicy.preserveContacts !== false,
    axisProfile: clip.retargetPolicy.axisProfile || 'smpl24_controls28@1',
  };
}

function solveTwoBoneLeg(poseInput, rig, chain, target, {
  rotationReferenceWorld = IDENTITY,
  rotationWeight = 0.65,
} = {}) {
  let pose = normalizeAnimationPose(poseInput);
  let fk = forwardKinematics(pose, rig);
  const hipPosition = fk.positions.get(chain.hip);
  const kneePosition = fk.positions.get(chain.knee);
  const anklePosition = fk.positions.get(chain.ankle);
  if (!hipPosition || !kneePosition || !anklePosition) return { pose, clamped: false };
  const upperLength = distance(hipPosition, kneePosition);
  const lowerLength = distance(kneePosition, anklePosition);
  const toTarget = subtractVectors(target, hipPosition);
  const rawDistance = vectorLength(toTarget);
  const minimum = Math.abs(upperLength - lowerLength) + 1e-5;
  const maximum = upperLength + lowerLength - 1e-5;
  const solvedDistance = clamp(rawDistance, minimum, maximum);
  const direction = normalizeVector3(toTarget, [0, -1, 0]);
  const currentKneeOffset = subtractVectors(kneePosition, hipPosition);
  const projected = subtractVectors(currentKneeOffset, scaleVector(direction, dotVectors(currentKneeOffset, direction)));
  let bendDirection = normalizeVector3(projected, [0, 0, 1]);
  if (vectorLength(projected) < 1e-5) {
    const sideAxis = chain.hip.startsWith('left') ? [-1, 0, 0] : [1, 0, 0];
    bendDirection = normalizeVector3(crossVectors(sideAxis, direction), [0, 0, 1]);
  }
  const along = (upperLength * upperLength - lowerLength * lowerLength + solvedDistance * solvedDistance)
    / (2 * solvedDistance);
  const perpendicular = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const targetKnee = addVectors(
    addVectors(hipPosition, scaleVector(direction, along)),
    scaleVector(bendDirection, perpendicular),
  );
  const clampedTarget = addVectors(hipPosition, scaleVector(direction, solvedDistance));

  pose = orientJointChild(pose, rig, chain.hip, chain.knee, targetKnee);
  fk = forwardKinematics(pose, rig);
  pose = orientJointChild(pose, rig, chain.knee, chain.ankle, clampedTarget);
  fk = forwardKinematics(pose, rig);
  const ankleJoint = rig.jointMap.get(chain.ankle);
  const ankleParentWorld = ankleJoint?.parentId
    ? fk.rotations.get(ankleJoint.parentId) || IDENTITY
    : IDENTITY;
  const rotationReferenceLocal = multiplyQuaternions(
    conjugateQuaternion(ankleParentWorld),
    normalizeQuaternion(rotationReferenceWorld),
  );
  const currentFootRotation = pose.joints[chain.ankle]?.rotation || IDENTITY;
  pose.joints[chain.ankle] = {
    rotation: slerpQuaternion(currentFootRotation, rotationReferenceLocal, clamp(rotationWeight, 0, 1)),
  };
  return { pose, clamped: Math.abs(rawDistance - solvedDistance) > 1e-5 };
}

function orientJointChild(poseInput, rig, jointId, childId, childTargetWorld) {
  const pose = normalizeAnimationPose(poseInput);
  const fk = forwardKinematics(pose, rig);
  const joint = rig.jointMap.get(jointId);
  const child = rig.jointMap.get(childId);
  if (!joint || !child) return pose;
  const jointPosition = fk.positions.get(jointId);
  const parentRotation = joint.parentId ? fk.rotations.get(joint.parentId) || IDENTITY : IDENTITY;
  const desiredWorld = subtractVectors(childTargetWorld, jointPosition);
  const desiredParentLocal = rotateVectorByQuaternion(desiredWorld, conjugateQuaternion(parentRotation));
  pose.joints[jointId] = { rotation: quaternionFromTo(child.localPosition, desiredParentLocal) };
  return pose;
}

function contactPlantRawTime(clip, rawTime, contact) {
  const phase = resolveClipPhase(rawTime, clip.duration, clip.loopMode);
  if (clip.loopMode === 'repeat') return phase.cycles * clip.duration + contact.start;
  if (clip.loopMode === 'pingpong' && phase.direction < 0) {
    return phase.cycles * clip.duration * 2 + (clip.duration * 2 - contact.end);
  }
  return phase.cycles * clip.duration + contact.start;
}

export function measureBoneLengthError(fk) {
  let maximum = 0;
  for (const [jointId, expected] of fk.rig.boneLengths) {
    const joint = fk.rig.jointMap.get(jointId);
    if (!joint?.parentId) continue;
    const actual = distance(fk.positions.get(jointId), fk.positions.get(joint.parentId));
    maximum = Math.max(maximum, Math.abs(actual - expected));
  }
  return maximum;
}

function evaluateGraphCondition(parameters, condition) {
  const value = parameters?.[condition.parameter];
  switch (condition.operator) {
    case '>': return Number(value) > Number(condition.value);
    case '>=': return Number(value) >= Number(condition.value);
    case '<': return Number(value) < Number(condition.value);
    case '<=': return Number(value) <= Number(condition.value);
    case '!=': return value !== condition.value;
    case 'truthy': return Boolean(value);
    case 'falsy': return !value;
    case 'trigger': return Boolean(value);
    case '==':
    default: return value === condition.value;
  }
}

function expandMask(maskInput) {
  const mask = Array.isArray(maskInput) ? maskInput : ['*'];
  const result = new Set();
  for (const item of mask) {
    const key = String(item);
    if (key === '*') {
      result.add('*');
      continue;
    }
    const chain = DEFAULT_CHAIN_MASKS[key];
    if (chain) for (const joint of chain) result.add(joint);
    else result.add(key);
  }
  return result;
}


function selectOrientationChild(jointId, rig, observed) {
  const preferred = {
    hips: ['spine'],
    spine: ['chest'],
    chest: ['upperChest'],
    upperChest: ['neck'],
    neck: ['head'],
    head: ['headTop'],
    leftShoulder: ['leftUpperArm'],
    rightShoulder: ['rightUpperArm'],
    leftUpperArm: ['leftLowerArm'],
    rightUpperArm: ['rightLowerArm'],
    leftLowerArm: ['leftHand'],
    rightLowerArm: ['rightHand'],
    leftHand: ['leftHandEnd'],
    rightHand: ['rightHandEnd'],
    leftUpperLeg: ['leftLowerLeg'],
    rightUpperLeg: ['rightLowerLeg'],
    leftLowerLeg: ['leftFoot'],
    rightLowerLeg: ['rightFoot'],
    leftFoot: ['leftToes'],
    rightFoot: ['rightToes'],
    leftToes: ['leftToesEnd'],
    rightToes: ['rightToesEnd'],
  };
  const candidates = preferred[jointId] || rig.children.get(jointId) || [];
  return candidates.find((childId) => observed.has(jointId) && observed.has(childId)) || null;
}

function distance(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot(
    finite(a[0], 0) - finite(b[0], 0),
    finite(a[1], 0) - finite(b[1], 0),
    finite(a[2], 0) - finite(b[2], 0),
  );
}

function vector3(value, fallback = ZERO) {
  return [finite(value?.[0], fallback[0]), finite(value?.[1], fallback[1]), finite(value?.[2], fallback[2])];
}

function readPayloadQuaternion(value) {
  if ((!Array.isArray(value) && !ArrayBuffer.isView(value)) || value.length < 4) return null;
  const rotation = Array.from(value).slice(0, 4).map(Number);
  if (!rotation.every(Number.isFinite)) return null;
  return normalizeQuaternion(rotation);
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}
