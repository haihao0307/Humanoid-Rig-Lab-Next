import { applyBodyProfileToDefinition } from '../../../legacy/v8/src/body-profile.js';
import { PhysicsRig } from '../../../legacy/v8/src/physics-rig.js';
import {
  buildPosePayload,
  computePoseWorldPositions,
  computeRestWorldPositions,
  getBoneLength,
  vectorDistance,
} from '../../../legacy/v8/src/skeleton-model.js';
import {
  createStandardHumanoidPreset,
  normalizeSkeletonDefinition,
} from '../../../legacy/v8/src/skeleton-presets.js';

export const IMAGE_POSE_ASSET_SCHEMA = 'humanoid_rig/image_pose_asset@1.0';
export const IMAGE_POSE_LIBRARY_SCHEMA = 'humanoid_rig/image_pose_library@1.0';

const MIRROR_INDEX = Object.freeze({
  1: 4, 2: 5, 3: 6, 4: 1, 5: 2, 6: 3,
  7: 8, 8: 7, 9: 10, 10: 9,
  11: 12, 12: 11, 13: 14, 14: 13, 15: 16, 16: 15,
  17: 18, 18: 17, 19: 20, 20: 19, 21: 22, 22: 21,
  23: 24, 24: 23, 25: 26, 26: 25, 27: 28, 28: 27,
  29: 30, 30: 29, 31: 32, 32: 31,
});

const TARGET_SOURCE_INDEX = Object.freeze({
  leftUpperArm: 11,
  rightUpperArm: 12,
  leftLowerArm: 13,
  rightLowerArm: 14,
  leftHand: 15,
  rightHand: 16,
  leftHandEnd: 19,
  rightHandEnd: 20,
  leftUpperLeg: 23,
  rightUpperLeg: 24,
  leftLowerLeg: 25,
  rightLowerLeg: 26,
  leftFoot: 27,
  rightFoot: 28,
  leftToes: 31,
  rightToes: 32,
  leftToesEnd: 31,
  rightToesEnd: 32,
  head: 0,
  headTop: 0,
});

const DIRECTION_PAIRS = Object.freeze([
  ['leftUpperArm', 'leftLowerArm'],
  ['leftLowerArm', 'leftHand'],
  ['leftHand', 'leftHandEnd'],
  ['rightUpperArm', 'rightLowerArm'],
  ['rightLowerArm', 'rightHand'],
  ['rightHand', 'rightHandEnd'],
  ['leftUpperLeg', 'leftLowerLeg'],
  ['leftLowerLeg', 'leftFoot'],
  ['leftFoot', 'leftToes'],
  ['rightUpperLeg', 'rightLowerLeg'],
  ['rightLowerLeg', 'rightFoot'],
  ['rightFoot', 'rightToes'],
  ['spine', 'chest'],
  ['chest', 'upperChest'],
  ['upperChest', 'neck'],
  ['neck', 'head'],
]);

const CRITICAL_LANDMARK_INDICES = Object.freeze([11, 12, 23, 24, 25, 26, 27, 28]);
const IMAGE_POSE_QUALITY_THRESHOLDS = Object.freeze({
  minimumOverallConfidence: 0.35,
  minimumCriticalConfidence: 0.30,
  minimumReliableCriticalLandmarks: 6,
  severeDirectionErrorDegrees: 45,
});

export function createDefinitionForBodyProfile(bodyProfile = {}) {
  const base = normalizeSkeletonDefinition(createStandardHumanoidPreset('A'));
  return normalizeSkeletonDefinition(applyBodyProfileToDefinition(base, bodyProfile, {
    preservePose: false,
  }));
}

export function retargetPoseObservation({
  definition,
  observation,
  compatibleRig = 'rig@0.4.0',
  name = '图片动作',
  assetId = 'image-pose-candidate',
  physics = {},
  settings = {},
} = {}) {
  if (!definition?.joints?.length) throw new Error('缺少目标人物骨架定义。');
  validateObservation(observation);

  const sourceDefinition = normalizeSkeletonDefinition(clone(definition));
  const immutableBind = bindSignature(sourceDefinition);
  const rest = computeRestWorldPositions(sourceDefinition);
  const current = computePoseWorldPositions(sourceDefinition);
  const source = buildSourcePose(observation, settings);
  const target = buildTargetPose(sourceDefinition, rest, current, source, settings);
  alignTargetToGround(target, settings);

  for (const joint of sourceDefinition.joints) {
    if (joint.isControl) continue;
    const point = target.points.get(joint.id);
    if (point) joint.poseWorldPosition = [point.x, point.y, point.z];
    joint.pinned = false;
  }
  sourceDefinition.pose = 'CUSTOM';
  sourceDefinition.updatedAt = new Date().toISOString();

  const rig = new PhysicsRig(sourceDefinition, {
    solverIterations: 96,
    exactMaxPasses: 960,
    exactTolerance: 1e-8,
    gravityEnabled: false,
    groundEnabled: settings.groundEnabled !== false,
    groundY: finite(settings.groundY, 0),
    bodyCoupling: clamp(physics.bodyCoupling, 0, 1, 0.8),
    damping: clamp(physics.damping, 0, 0.9995, 0.92),
    jointLimits: physics.jointLimits !== false,
    poseStiffness: 0.12,
    torsoStiffness: 0.9,
  });
  rig.projectConstraints(96);
  rig.projectPrimaryExact({
    tolerance: 1e-8,
    maxPasses: 960,
    includeGround: settings.groundEnabled !== false,
  });
  rig.zeroVelocities({ capturePose: true });
  rig.writePoseToDefinition(true);

  const contacts = settings.autoPinFeet === false
    ? []
    : inferFootContacts(observation, settings);
  for (const contact of contacts) rig.setPinned(contact.jointId, true);
  rig.commitCurrentPose();

  if (bindSignature(sourceDefinition) !== immutableBind) {
    throw new Error('图片姿势重定向触碰了绑定尺寸，结果已拒绝。');
  }

  const quality = buildQualityReport({
    rig,
    source,
    target,
    observation,
    contacts,
  });
  const imageTargets = buildImageIKTargets(target, source, assetId);
  const legacyWorldPose = buildPosePayload(sourceDefinition);
  const timestamp = new Date().toISOString();
  legacyWorldPose.pose = 'CUSTOM';
  legacyWorldPose.updatedAt = timestamp;
  legacyWorldPose.source = 'image-pose-retarget';
  legacyWorldPose.imagePoseAssetId = assetId;
  legacyWorldPose.compatibleRig = compatibleRig;

  const poseSnapshot = rig.buildPoseSnapshot({
    compatibleRig,
    name,
    source: 'image-pose-retarget',
  });
  poseSnapshot.updatedAt = timestamp;
  poseSnapshot.sourceLegacyUpdatedAt = timestamp;
  poseSnapshot.imagePoseAssetId = assetId;
  poseSnapshot.ikTargets = imageTargets;
  poseSnapshot.contacts = contacts.map((contact) => ({ ...contact }));
  poseSnapshot.diagnostics = {
    ...poseSnapshot.diagnostics,
    imagePose: quality,
    warningCodes: [...new Set([
      ...(poseSnapshot.diagnostics?.warningCodes ?? []),
      ...quality.warningCodes,
    ])],
  };

  return {
    schema: 'humanoid_rig/image_pose_candidate@1.0',
    candidateId: `${assetId}:candidate`,
    assetId,
    name,
    compatibleRig,
    observation: clone(observation),
    settings: normalizeSettings(settings),
    poseSnapshot,
    legacyWorldPose,
    preview2D: buildPreview2D(observation, settings),
    quality,
    contacts,
    createdAt: timestamp,
  };
}

export function createImagePoseAsset(candidate, sourceImage = {}) {
  if (!candidate?.poseSnapshot || !candidate?.legacyWorldPose) {
    throw new Error('没有可保存的图片姿势候选。');
  }
  const id = String(candidate.assetId || `image-pose-${cryptoId()}`);
  return {
    schema: IMAGE_POSE_ASSET_SCHEMA,
    id,
    name: String(candidate.name || '图片动作'),
    createdAt: candidate.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    compatibleRig: candidate.compatibleRig,
    sourceImage: {
      fileName: String(sourceImage.fileName || ''),
      mimeType: String(sourceImage.mimeType || ''),
      byteLength: Math.max(0, Number(sourceImage.byteLength || 0)),
      width: Math.max(0, Number(sourceImage.width || candidate.observation?.image?.width || 0)),
      height: Math.max(0, Number(sourceImage.height || candidate.observation?.image?.height || 0)),
      contentHash: String(sourceImage.contentHash || ''),
      storage: sourceImage.storage || 'indexeddb',
    },
    estimator: {
      provider: candidate.observation?.provider || 'unknown',
      packageVersion: candidate.observation?.packageVersion || null,
      model: candidate.observation?.model || null,
      delegate: candidate.observation?.delegate || null,
      inferenceMs: candidate.observation?.inferenceMs ?? null,
    },
    observation: clone(candidate.observation),
    settings: clone(candidate.settings),
    poseSnapshot: clone(candidate.poseSnapshot),
    legacyWorldPose: clone(candidate.legacyWorldPose),
    preview2D: clone(candidate.preview2D),
    contacts: clone(candidate.contacts),
    quality: clone(candidate.quality),
  };
}

export function normalizeImagePoseLibrary(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const assets = Array.isArray(raw.assets)
    ? raw.assets.filter((asset) => asset?.schema === IMAGE_POSE_ASSET_SCHEMA && asset.id).map(clone)
    : [];
  const activeAssetId = assets.some((asset) => asset.id === raw.activeAssetId)
    ? raw.activeAssetId
    : assets[0]?.id ?? null;
  return {
    schema: IMAGE_POSE_LIBRARY_SCHEMA,
    activeAssetId,
    assets: assets.slice(0, 24),
  };
}

export function buildPreview2D(observation, settings = {}) {
  validateObservation(observation);
  const landmarks = observation.landmarks;
  const mirror = Boolean(settings.mirror);
  const point = (index) => landmarks[resolvedIndex(index, mirror)] || { x: 0.5, y: 0.5 };
  const leftHip = point(23);
  const rightHip = point(24);
  const leftShoulder = point(11);
  const rightShoulder = point(12);
  const pelvis = average2(leftHip, rightHip);
  const shoulders = average2(leftShoulder, rightShoulder);
  const top = Math.min(point(0).y, point(7).y, point(8).y, shoulders.y);
  const bottom = Math.max(point(29).y, point(30).y, point(31).y, point(32).y, point(27).y, point(28).y);
  const bodyHeight = Math.max(0.15, bottom - top);
  const aspect = clamp(observation.image?.aspectRatio, 0.2, 5, 1);
  const scale = 0.92 / bodyHeight;
  const map = (value) => ({
    x: (value.x - pelvis.x) * aspect * scale,
    y: 0.04 + (bottom - value.y) * scale,
  });
  const head = map(point(0));
  const neck = map(shoulders);
  const pelvis2D = map(pelvis);
  const chestSource = lerp2(pelvis, shoulders, 0.82);
  const spineSource = lerp2(pelvis, shoulders, 0.45);
  const headDirection = normalize2({ x: head.x - neck.x, y: head.y - neck.y }, { x: 0, y: 1 });
  return {
    headTop: { x: head.x + headDirection.x * 0.08, y: head.y + headDirection.y * 0.08 },
    head,
    neck,
    chest: map(chestSource),
    spine: map(spineSource),
    pelvis: pelvis2D,
    leftShoulder: map(leftShoulder),
    leftElbow: map(point(13)),
    leftWrist: map(point(15)),
    leftHand: map(point(19)),
    rightShoulder: map(rightShoulder),
    rightElbow: map(point(14)),
    rightWrist: map(point(16)),
    rightHand: map(point(20)),
    leftHip: map(leftHip),
    leftKnee: map(point(25)),
    leftAnkle: map(point(27)),
    leftToe: map(point(31)),
    rightHip: map(rightHip),
    rightKnee: map(point(26)),
    rightAnkle: map(point(28)),
    rightToe: map(point(32)),
  };
}

function buildSourcePose(observation, settings) {
  const mirror = Boolean(settings.mirror);
  const useWorld = hasUsableWorldLandmarks(observation.worldLandmarks);
  const values = useWorld ? observation.worldLandmarks : observation.landmarks;
  const aspect = clamp(observation.image?.aspectRatio, 0.2, 5, 1);
  const raw = Array.from({ length: 33 }, (_, index) => {
    const value = values[resolvedIndex(index, mirror)] || {};
    if (useWorld) return vector(value.x, value.y, value.z);
    return vector(
      finite(value.x, 0.5) * aspect,
      finite(value.y, 0.5),
      finite(value.z, 0) * aspect,
    );
  });
  const hipCenterRaw = average(raw[23], raw[24]);
  const shoulderCenterRaw = average(raw[11], raw[12]);
  const xSign = raw[23].x <= raw[24].x ? 1 : -1;
  // MediaPipe image coordinates grow downward, while the rig grows upward.
  // Do not infer this sign from the current pose: a crouch or forward bend can
  // put the shoulders below the hips and would mirror the entire reconstruction.
  const ySign = -1;
  const depthScale = clamp(settings.depthScale, 0, 2.5, 1);
  const zSign = settings.invertDepth ? 1 : -1;
  const torsoReference = Math.max(distance(shoulderCenterRaw, hipCenterRaw), 1e-4);
  const depthLimit = Math.max(torsoReference * (useWorld ? 2.25 : 1.35), 0.08);
  let depthClampCount = 0;
  const points = raw.map((value) => {
    const scaledDepth = (value.z - hipCenterRaw.z) * zSign * depthScale;
    const depth = clamp(scaledDepth, -depthLimit, depthLimit, 0);
    if (Math.abs(depth - scaledDepth) > 1e-9) depthClampCount += 1;
    return {
      x: (value.x - hipCenterRaw.x) * xSign,
      y: (value.y - hipCenterRaw.y) * ySign,
      z: depth,
    };
  });
  const confidence = Array.from({ length: 33 }, (_, index) => landmarkConfidence(
    observation.landmarks[resolvedIndex(index, mirror)],
  ));
  const minDirectionConfidence = clamp(settings.minLandmarkConfidence, 0, 1, 0.35);

  const hipCenter = average(points[23], points[24]);
  const shoulderCenter = average(points[11], points[12]);
  const earCenter = average(points[7], points[8]);
  const handEndLeft = average(points[17], points[19]);
  const handEndRight = average(points[18], points[20]);
  const torso = subtract(shoulderCenter, hipCenter);
  const headAnchor = blend(earCenter, points[0], 0.55);
  const headDirection = normalized(subtract(headAnchor, shoulderCenter), { x: 0, y: 1, z: 0 });
  const sourcePoints = new Map([
    ['hips', hipCenter],
    ['spine', add(hipCenter, scale(torso, 0.25))],
    ['chest', add(hipCenter, scale(torso, 0.55))],
    ['upperChest', add(hipCenter, scale(torso, 0.86))],
    ['neck', add(shoulderCenter, scale(headDirection, Math.max(length(torso) * 0.12, 0.02)))],
    ['head', headAnchor],
    ['headTop', add(headAnchor, scale(headDirection, Math.max(length(torso) * 0.35, 0.08)))],
    ['leftShoulder', blend(add(hipCenter, scale(torso, 0.86)), points[11], 0.48)],
    ['leftUpperArm', points[11]],
    ['leftLowerArm', points[13]],
    ['leftHand', points[15]],
    ['leftHandEnd', handEndLeft],
    ['rightShoulder', blend(add(hipCenter, scale(torso, 0.86)), points[12], 0.48)],
    ['rightUpperArm', points[12]],
    ['rightLowerArm', points[14]],
    ['rightHand', points[16]],
    ['rightHandEnd', handEndRight],
    ['leftUpperLeg', points[23]],
    ['leftLowerLeg', points[25]],
    ['leftFoot', points[27]],
    ['leftToes', blend(points[27], points[31], 0.72)],
    ['leftToesEnd', points[31]],
    ['rightUpperLeg', points[24]],
    ['rightLowerLeg', points[26]],
    ['rightFoot', points[28]],
    ['rightToes', blend(points[28], points[32], 0.72)],
    ['rightToesEnd', points[32]],
  ]);

  const frame = buildSourceFrame(sourcePoints, points);
  return {
    points: sourcePoints,
    rawPoints: points,
    confidence,
    minDirectionConfidence,
    minTargetConfidence: minDirectionConfidence,
    frame,
    usesWorldLandmarks: useWorld,
    depthMode: useWorld ? 'world_landmarks' : 'image_depth_heuristic',
    depthRange: range(points.map((point) => point.z)),
    depthClampCount,
  };
}

function buildTargetPose(definition, rest, current, source, settings) {
  const points = new Map();
  const root = settings.preserveRootPosition === false
    ? clonePoint(rest.get('hips'))
    : clonePoint(current.get('hips') || rest.get('hips'));
  points.set('hips', root);

  const restFrame = buildRigPelvisFrame(rest);
  const sourceFrame = source.frame;
  for (const childId of ['spine', 'leftUpperLeg', 'rightUpperLeg']) {
    const restOffset = subtract(rest.get(childId), rest.get('hips'));
    points.set(childId, add(root, rotateBetweenFrames(restOffset, restFrame, sourceFrame)));
  }

  const fallbackDirection = (jointId) => {
    const joint = definition.joints.find((item) => item.id === jointId);
    if (!joint?.parentId) return { x: 0, y: 1, z: 0 };
    return normalized(
      rotateBetweenFrames(subtract(rest.get(jointId), rest.get(joint.parentId)), restFrame, sourceFrame),
      { x: 0, y: 1, z: 0 },
    );
  };
  const place = (parentId, childId) => {
    const parent = points.get(parentId);
    if (!parent) return;
    const sourceParent = source.points.get(parentId);
    const sourceChild = source.points.get(childId);
    const parentIndex = TARGET_SOURCE_INDEX[parentId];
    const childIndex = TARGET_SOURCE_INDEX[childId];
    const directionConfidence = [parentIndex, childIndex]
      .filter((index) => Number.isInteger(index))
      .map((index) => finite(source.confidence[index], 0));
    const canUseObservedDirection = Boolean(sourceParent && sourceChild)
      && directionConfidence.every((value) => value >= source.minDirectionConfidence);
    const direction = normalized(
      canUseObservedDirection ? subtract(sourceChild, sourceParent) : null,
      fallbackDirection(childId),
    );
    points.set(childId, add(parent, scale(direction, getBoneLength(definition, childId))));
  };

  for (const [parent, child] of [
    ['spine', 'chest'], ['chest', 'upperChest'], ['upperChest', 'neck'], ['neck', 'head'], ['head', 'headTop'],
    ['upperChest', 'leftShoulder'], ['leftShoulder', 'leftUpperArm'], ['leftUpperArm', 'leftLowerArm'], ['leftLowerArm', 'leftHand'], ['leftHand', 'leftHandEnd'],
    ['upperChest', 'rightShoulder'], ['rightShoulder', 'rightUpperArm'], ['rightUpperArm', 'rightLowerArm'], ['rightLowerArm', 'rightHand'], ['rightHand', 'rightHandEnd'],
    ['leftUpperLeg', 'leftLowerLeg'], ['leftLowerLeg', 'leftFoot'], ['leftFoot', 'leftToes'], ['leftToes', 'leftToesEnd'],
    ['rightUpperLeg', 'rightLowerLeg'], ['rightLowerLeg', 'rightFoot'], ['rightFoot', 'rightToes'], ['rightToes', 'rightToesEnd'],
  ]) place(parent, child);

  return { points, restFrame, sourceFrame };
}

function alignTargetToGround(target, settings) {
  if (settings.groundEnabled === false) return;
  const groundY = finite(settings.groundY, 0);
  const ids = ['leftFoot', 'leftToes', 'leftToesEnd', 'rightFoot', 'rightToes', 'rightToesEnd'];
  const values = ids.map((id) => target.points.get(id)?.y).filter(Number.isFinite);
  if (!values.length) return;
  const delta = groundY - Math.min(...values);
  for (const [id, point] of target.points) target.points.set(id, { x: point.x, y: point.y + delta, z: point.z });
}

function buildImageIKTargets(target, source, assetId) {
  const ids = [
    'head', 'leftUpperArm', 'rightUpperArm',
    'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand', 'leftHandEnd', 'rightHandEnd',
    'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot', 'leftToesEnd', 'rightToesEnd',
  ];
  return ids.flatMap((jointId) => {
    const point = target.points.get(jointId);
    if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) return [];
    const index = TARGET_SOURCE_INDEX[jointId];
    const weight = index == null ? 0.75 : finite(source.confidence[index], 0);
    if (index != null && weight < source.minTargetConfidence) return [];
    return [{
      targetId: `image:${assetId}:${jointId}`,
      jointId,
      kind: 'image_landmark',
      targetWorld: [point.x, point.y, point.z],
      weight,
      transient: false,
      sourceLandmarkIndex: index ?? null,
    }];
  });
}

function inferFootContacts(observation, settings) {
  const mirror = Boolean(settings.mirror);
  const point = (index) => observation.landmarks[resolvedIndex(index, mirror)] || {};
  const leftY = Math.max(finite(point(27).y, 0), finite(point(29).y, 0), finite(point(31).y, 0));
  const rightY = Math.max(finite(point(28).y, 0), finite(point(30).y, 0), finite(point(32).y, 0));
  const ground = Math.max(leftY, rightY);
  const threshold = clamp(settings.footContactThreshold, 0.01, 0.12, 0.045);
  const contacts = [];
  const maybeAdd = (side, y, indices) => {
    const confidence = indices.reduce((sum, index) => sum + landmarkConfidence(point(index)), 0) / indices.length;
    if (ground - y > threshold || confidence < 0.35) return;
    contacts.push({
      type: 'foot_contact',
      jointId: `${side}Foot`,
      active: true,
      confidence,
      source: 'image_ground_inference',
    });
  };
  maybeAdd('left', leftY, [27, 29, 31]);
  maybeAdd('right', rightY, [28, 30, 32]);
  return contacts;
}

function buildQualityReport({ rig, source, target, observation, contacts }) {
  const errors = [];
  for (const [parentId, childId] of DIRECTION_PAIRS) {
    const desiredParent = target.points.get(parentId);
    const desiredChild = target.points.get(childId);
    const actualParent = rig.getPoint(parentId);
    const actualChild = rig.getPoint(childId);
    if (!desiredParent || !desiredChild || !actualParent || !actualChild) continue;
    const desiredDirection = normalized(subtract(desiredChild, desiredParent), null);
    const actualDirection = normalized(subtract(actualChild, actualParent), null);
    if (!desiredDirection || !actualDirection) continue;
    errors.push(angleDegrees(desiredDirection, actualDirection));
  }
  const reportedLowConfidenceIndices = Array.isArray(observation.confidence?.lowConfidenceIndices)
    ? observation.confidence.lowConfidenceIndices
    : [];
  const computedLowConfidenceIndices = source.confidence
    .map((value, index) => value < 0.55 ? index : -1)
    .filter((index) => index >= 0);
  const lowConfidenceIndices = [...new Set([
    ...reportedLowConfidenceIndices,
    ...computedLowConfidenceIndices,
  ])];
  const overallConfidence = clamp(
    observation.confidence?.overall,
    0,
    1,
    averageNumber(source.confidence),
  );
  const criticalConfidence = CRITICAL_LANDMARK_INDICES.map((index) => finite(source.confidence[index], 0));
  const minimumCriticalConfidence = criticalConfidence.length ? Math.min(...criticalConfidence) : 0;
  const reliableCriticalLandmarks = criticalConfidence.filter(
    (value) => value >= IMAGE_POSE_QUALITY_THRESHOLDS.minimumCriticalConfidence,
  ).length;
  const maxDirectionErrorDegrees = errors.length ? Math.max(...errors) : 0;
  const warningCodes = [];
  if (!source.usesWorldLandmarks) warningCodes.push('WORLD_LANDMARKS_UNAVAILABLE_USING_IMAGE_DEPTH');
  if (source.depthClampCount > 0) warningCodes.push('IMAGE_DEPTH_OUTLIER_CLAMPED');
  if (lowConfidenceIndices.length) warningCodes.push('LOW_CONFIDENCE_LANDMARKS');
  if (!contacts.length) warningCodes.push('NO_FOOT_CONTACT_INFERRED');
  if (maxDirectionErrorDegrees > 20) warningCodes.push('POSE_DIRECTION_CLAMPED_BY_HUMAN_CONSTRAINTS');
  if (rig.getMaxJointLimitViolation() > 0.05) warningCodes.push('JOINT_LIMIT_RESIDUAL');
  if (overallConfidence < IMAGE_POSE_QUALITY_THRESHOLDS.minimumOverallConfidence) {
    warningCodes.push('INSUFFICIENT_BODY_CONFIDENCE');
  }
  if (
    minimumCriticalConfidence < IMAGE_POSE_QUALITY_THRESHOLDS.minimumCriticalConfidence
    || reliableCriticalLandmarks < IMAGE_POSE_QUALITY_THRESHOLDS.minimumReliableCriticalLandmarks
  ) {
    warningCodes.push('CRITICAL_LANDMARKS_UNRELIABLE');
  }
  if (maxDirectionErrorDegrees > IMAGE_POSE_QUALITY_THRESHOLDS.severeDirectionErrorDegrees) {
    warningCodes.push('SEVERE_DIRECTION_MISMATCH');
  }
  const applyBlockReasons = [];
  if (overallConfidence < IMAGE_POSE_QUALITY_THRESHOLDS.minimumOverallConfidence) {
    applyBlockReasons.push('INSUFFICIENT_BODY_CONFIDENCE');
  }
  if (
    minimumCriticalConfidence < IMAGE_POSE_QUALITY_THRESHOLDS.minimumCriticalConfidence
    || reliableCriticalLandmarks < IMAGE_POSE_QUALITY_THRESHOLDS.minimumReliableCriticalLandmarks
  ) {
    applyBlockReasons.push('CRITICAL_LANDMARKS_UNRELIABLE');
  }
  if (maxDirectionErrorDegrees > IMAGE_POSE_QUALITY_THRESHOLDS.severeDirectionErrorDegrees) {
    applyBlockReasons.push('SEVERE_DIRECTION_MISMATCH');
  }
  return {
    overallConfidence,
    lowConfidenceIndices,
    criticalConfidence,
    minimumCriticalConfidence,
    reliableCriticalLandmarks,
    usesWorldLandmarks: source.usesWorldLandmarks,
    depthMode: source.depthMode,
    depthRange: source.depthRange,
    depthClampCount: source.depthClampCount,
    sourceFrame: clone(source.frame),
    meanDirectionErrorDegrees: errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : 0,
    maxDirectionErrorDegrees,
    maxBoneErrorM: rig.getMaxBoneError(),
    rigidPelvisErrorM: rig.getRigidPelvisError(),
    maxJointLimitViolationDegrees: rig.getMaxJointLimitViolation(),
    inferredFootContacts: contacts.map((contact) => contact.jointId),
    warningCodes,
    canApply: applyBlockReasons.length === 0,
    applyBlocked: applyBlockReasons.length > 0,
    applyBlockReasons,
    manualReviewRequired: warningCodes.some((code) => (
      code === 'LOW_CONFIDENCE_LANDMARKS'
      || code === 'WORLD_LANDMARKS_UNAVAILABLE_USING_IMAGE_DEPTH'
      || code === 'IMAGE_DEPTH_OUTLIER_CLAMPED'
      || code === 'POSE_DIRECTION_CLAMPED_BY_HUMAN_CONSTRAINTS'
      || code === 'INSUFFICIENT_BODY_CONFIDENCE'
      || code === 'CRITICAL_LANDMARKS_UNRELIABLE'
      || code === 'SEVERE_DIRECTION_MISMATCH'
    )),
  };
}

function buildSourceFrame(sourcePoints, rawPoints) {
  let right = normalized(subtract(sourcePoints.get('rightUpperLeg'), sourcePoints.get('leftUpperLeg')), { x: 1, y: 0, z: 0 });
  let up = normalized(subtract(sourcePoints.get('upperChest'), sourcePoints.get('hips')), { x: 0, y: 1, z: 0 });
  let forward = normalized(cross(right, up), { x: 0, y: 0, z: 1 });
  const faceHint = subtract(rawPoints[0], average(rawPoints[11], rawPoints[12]));
  if (Math.abs(dot(faceHint, forward)) > 1e-5) {
    if (dot(faceHint, forward) < 0) forward = scale(forward, -1);
  } else if (forward.z < 0) {
    forward = scale(forward, -1);
  }
  right = normalized(cross(up, forward), right);
  up = normalized(cross(forward, right), up);
  return { right, up, forward };
}

function buildRigPelvisFrame(points) {
  let right = normalized(subtract(points.get('rightUpperLeg'), points.get('leftUpperLeg')), { x: 1, y: 0, z: 0 });
  let up = normalized(subtract(points.get('spine'), points.get('hips')), { x: 0, y: 1, z: 0 });
  let forward = normalized(cross(right, up), { x: 0, y: 0, z: 1 });
  if (forward.z < 0) forward = scale(forward, -1);
  right = normalized(cross(up, forward), right);
  up = normalized(cross(forward, right), up);
  return { right, up, forward };
}

function rotateBetweenFrames(value, from, to) {
  const x = dot(value, from.right);
  const y = dot(value, from.up);
  const z = dot(value, from.forward);
  return add(add(scale(to.right, x), scale(to.up, y)), scale(to.forward, z));
}

function validateObservation(value) {
  if (!value || typeof value !== 'object') throw new Error('图片姿势观测为空。');
  if (!Array.isArray(value.landmarks) || value.landmarks.length !== 33) {
    throw new Error('图片姿势观测必须包含 33 个标准人体关键点。');
  }
  for (const [index, point] of value.landmarks.entries()) {
    if (![point?.x, point?.y, point?.z].every((item) => Number.isFinite(Number(item)))) {
      throw new Error(`关键点 ${index} 含有非法数值。`);
    }
  }
}

function hasUsableWorldLandmarks(values) {
  if (!Array.isArray(values) || values.length !== 33) return false;
  const required = [11, 12, 23, 24, 25, 26, 27, 28];
  if (!required.every((index) => [values[index]?.x, values[index]?.y, values[index]?.z].every((item) => Number.isFinite(Number(item))))) return false;
  const shoulderSpan = distance(vectorFrom(values[11]), vectorFrom(values[12]));
  const hipSpan = distance(vectorFrom(values[23]), vectorFrom(values[24]));
  return shoulderSpan + hipSpan > 1e-4;
}

function bindSignature(definition) {
  return JSON.stringify(definition.joints.map((joint) => ({
    id: joint.id,
    parentId: joint.parentId,
    localPosition: [...joint.localPosition],
    physicalBone: joint.physicalBone,
    visualBone: joint.visualBone,
    isControl: joint.isControl,
  })));
}

function resolvedIndex(index, mirror) {
  return mirror ? (MIRROR_INDEX[index] ?? index) : index;
}

function landmarkConfidence(value) {
  const visibility = Number(value?.visibility);
  const presence = Number(value?.presence);
  if (Number.isFinite(visibility) && Number.isFinite(presence)) return clamp(Math.min(visibility, presence), 0, 1, 1);
  if (Number.isFinite(visibility)) return clamp(visibility, 0, 1, 1);
  if (Number.isFinite(presence)) return clamp(presence, 0, 1, 1);
  return 0;
}

function normalizeSettings(value = {}) {
  return {
    mirror: Boolean(value.mirror),
    invertDepth: Boolean(value.invertDepth),
    depthScale: clamp(value.depthScale, 0, 2.5, 1),
    autoPinFeet: value.autoPinFeet !== false,
    footContactThreshold: clamp(value.footContactThreshold, 0.01, 0.12, 0.045),
    minLandmarkConfidence: clamp(value.minLandmarkConfidence, 0, 1, 0.35),
    preserveRootPosition: value.preserveRootPosition !== false,
    groundEnabled: value.groundEnabled !== false,
    groundY: finite(value.groundY, 0),
  };
}

function vectorFrom(value) {
  return vector(value?.x, value?.y, value?.z);
}

function vector(x = 0, y = 0, z = 0) {
  return { x: finite(x, 0), y: finite(y, 0), z: finite(z, 0) };
}

function clonePoint(value) {
  return vector(value?.x, value?.y, value?.z);
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a, b) {
  if (!a || !b) return { x: 0, y: 0, z: 0 };
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(value, amount) {
  return { x: value.x * amount, y: value.y * amount, z: value.z * amount };
}

function average(a, b) {
  return scale(add(a, b), 0.5);
}

function blend(a, b, amount) {
  return add(scale(a, 1 - amount), scale(b, amount));
}

function length(value) {
  return Math.hypot(value?.x || 0, value?.y || 0, value?.z || 0);
}

function distance(a, b) {
  return vectorDistance(a, b);
}

function normalized(value, fallback) {
  if (!value) return fallback ? clonePoint(fallback) : null;
  const magnitude = length(value);
  if (magnitude < 1e-9) return fallback ? clonePoint(fallback) : null;
  return scale(value, 1 / magnitude);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function angleDegrees(a, b) {
  return Math.acos(clamp(dot(a, b), -1, 1, 1)) * 180 / Math.PI;
}

function averageNumber(values) {
  const finiteValues = values.filter(Number.isFinite);
  return finiteValues.length ? finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length : 0;
}

function range(values) {
  const finiteValues = values.filter(Number.isFinite);
  if (!finiteValues.length) return { min: 0, max: 0, span: 0 };
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  return { min, max, span: max - min };
}

function average2(a, b) {
  return { x: (finite(a?.x, 0) + finite(b?.x, 0)) / 2, y: (finite(a?.y, 0) + finite(b?.y, 0)) / 2 };
}

function lerp2(a, b, amount) {
  return { x: finite(a?.x, 0) * (1 - amount) + finite(b?.x, 0) * amount, y: finite(a?.y, 0) * (1 - amount) + finite(b?.y, 0) * amount };
}

function normalize2(value, fallback) {
  const magnitude = Math.hypot(value?.x || 0, value?.y || 0);
  if (magnitude < 1e-9) return { ...fallback };
  return { x: value.x / magnitude, y: value.y / magnitude };
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function cryptoId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
