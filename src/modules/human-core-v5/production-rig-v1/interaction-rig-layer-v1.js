import {
  add3,
  countNonFinite,
  cross3,
  distance3,
  dot3,
  mix3,
  normalize3,
  rotateVector,
  scale3,
} from './rig-quality-metrics-v1.js';

export const INTERACTION_RIG_LAYER_V1_SCHEMA = 'humanoid_rig/interaction_rig_layer@1.0';

export const REQUIRED_INTERACTION_ANCHOR_IDS_V1 = Object.freeze([
  'headGazeOrigin', 'headGazeTarget', 'chestFacing', 'pelvisFacing',
  'leftPalmCenter', 'rightPalmCenter', 'leftPalmNormal', 'rightPalmNormal',
  'leftPalmUp', 'rightPalmUp', 'leftThumbSide', 'rightThumbSide',
  'leftGripCenter', 'rightGripCenter', 'twoHandCarryCenter', 'chestCarryAnchor',
  'leftHeelContact', 'rightHeelContact', 'leftSoleCenter', 'rightSoleCenter',
  'leftToeContact', 'rightToeContact', 'leftFootForward', 'rightFootForward',
  'leftFootUp', 'rightFootUp', 'pelvisSeatContact', 'backCarryAnchor',
]);

export function createInteractionRigLayerV1({ coreLayer, performanceLayer } = {}) {
  if (coreLayer?.type !== 'CoreRigLayerV1') throw new Error('InteractionRigLayerV1 requires CoreRigLayerV1.');
  if (performanceLayer?.type !== 'PerformanceDeformRigLayerV1') throw new Error('InteractionRigLayerV1 requires PerformanceDeformRigLayerV1.');
  const anchors = [];
  anchors.push(...createHeadAndBodyAnchors(coreLayer));
  anchors.push(...createHandAnchors(coreLayer));
  anchors.push(...createFootAnchors(coreLayer));
  anchors.push(createPositionAnchor('pelvisSeatContact', 'hips', 'pelvis-frame', offsetPoint(coreLayer, 'hips', [0, -0.12, -0.08]), ['sit-contact'], true));
  anchors.push(createPositionAnchor('backCarryAnchor', 'chest', 'chest-frame', offsetPoint(coreLayer, 'chest', [0, 0.02, -0.16]), ['carry-target', 'ik-target'], true));
  const byId = Object.fromEntries(anchors.map((anchor) => [anchor.anchorId, anchor]));
  const leftGrip = byId.leftGripCenter.worldPosition;
  const rightGrip = byId.rightGripCenter.worldPosition;
  byId.twoHandCarryCenter.worldPosition = mix3(leftGrip, rightGrip, 0.5);
  byId.twoHandCarryCenter.localOffset = [0, 0, 0];
  const nonFiniteAnchorCount = countNonFinite(anchors.map((anchor) => ({
    localOffset: anchor.localOffset,
    localDirection: anchor.localDirection,
    worldPosition: anchor.worldPosition,
    worldDirection: anchor.worldDirection,
  })));
  const missingRequiredAnchorIds = REQUIRED_INTERACTION_ANCHOR_IDS_V1.filter((anchorId) => !byId[anchorId] || !byId[anchorId].supported);
  const referenceSymmetry = measureAnchorSymmetry(byId);
  const palmFrames = createPalmFrameMetrics(byId);
  const footFrames = createFootFrameMetrics(byId);
  return {
    schema: INTERACTION_RIG_LAYER_V1_SCHEMA,
    type: 'InteractionRigLayerV1',
    authority: 'derived-interaction-targets',
    poseAuthority: 'finalPose-read-only',
    writesHumanRigCore: false,
    writesFinalPose: false,
    anchors,
    anchorsById: byId,
    metrics: {
      anchorCount: anchors.length,
      nonFiniteAnchorCount,
      missingRequiredAnchorCount: missingRequiredAnchorIds.length,
      missingRequiredAnchorIds,
      maximumAnchorSymmetryError: referenceSymmetry.maximumAnchorSymmetryError,
      palmFrameDeterminant: Math.min(palmFrames.left.determinant, palmFrames.right.determinant),
      footFrameDeterminant: Math.min(footFrames.left.determinant, footFrames.right.determinant),
      palmFrames,
      footFrames,
      passed: nonFiniteAnchorCount === 0
        && missingRequiredAnchorIds.length === 0
        && palmFrames.left.determinant > 0.999999
        && palmFrames.right.determinant > 0.999999
        && footFrames.left.determinant > 0.999999
        && footFrames.right.determinant > 0.999999,
    },
  };
}

function createHeadAndBodyAnchors(coreLayer) {
  const gazeOrigin = offsetPoint(coreLayer, 'head', [0, 0.08, 0.04]);
  const gazeDirection = worldDirection(coreLayer, 'head', [0, 0, 1]);
  const chestDirection = worldDirection(coreLayer, 'upperChest', [0, 0, 1]);
  const pelvisDirection = worldDirection(coreLayer, 'hips', [0, 0, 1]);
  return [
    createDirectionAnchor('headGazeOrigin', 'head', 'head-frame', gazeOrigin, gazeDirection, ['gaze-origin', 'motion-goal'], true),
    createDirectionAnchor('headGazeTarget', 'head', 'head-frame', add3(gazeOrigin, scale3(gazeDirection, 2)), gazeDirection, ['gaze-target', 'motion-goal'], true),
    createDirectionAnchor('chestFacing', 'upperChest', 'upper-chest-frame', coreLayer.jointTransforms.upperChest.worldPosition, chestDirection, ['facing', 'carry-planning'], true),
    createDirectionAnchor('pelvisFacing', 'hips', 'pelvis-frame', coreLayer.jointTransforms.hips.worldPosition, pelvisDirection, ['facing', 'balance'], true),
    createPositionAnchor('twoHandCarryCenter', 'upperChest', 'world-derived-two-hand', coreLayer.jointTransforms.upperChest.worldPosition, ['carry-target', 'ik-target'], true),
    createPositionAnchor('chestCarryAnchor', 'upperChest', 'upper-chest-frame', offsetPoint(coreLayer, 'upperChest', [0, -0.04, 0.20]), ['carry-target', 'ik-target'], true),
  ];
}

function createHandAnchors(coreLayer) {
  const result = [];
  for (const side of ['left', 'right']) {
    const prefix = side;
    const handId = `${side}Hand`;
    const endId = `${side}HandEnd`;
    const hand = coreLayer.jointTransforms[handId];
    const handEnd = coreLayer.jointTransforms[endId];
    const center = handEnd?.worldPosition ?? offsetPoint(coreLayer, handId, [side === 'left' ? -0.03 : 0.03, -0.055, 0.025]);
    const normal = worldDirection(coreLayer, handId, [0, 0, 1]);
    const up = worldDirection(coreLayer, handId, [0, 1, 0]);
    const thumb = worldDirection(coreLayer, handId, [side === 'left' ? -1 : 1, 0, 0]);
    const grip = add3(center, add3(scale3(normal, 0.025), scale3(up, -0.012)));
    result.push(
      createPositionAnchor(`${prefix}PalmCenter`, handId, 'hand-frame+virtual-hand-end-measurement', center, ['palm-frame', 'salute', 'grasp', 'carry'], true),
      createDirectionAnchor(`${prefix}PalmNormal`, handId, 'hand-frame', center, normal, ['palm-normal', 'salute', 'grasp'], true),
      createDirectionAnchor(`${prefix}PalmUp`, handId, 'hand-frame', center, up, ['palm-up', 'salute', 'carry'], true),
      createDirectionAnchor(`${prefix}ThumbSide`, handId, 'hand-frame', center, thumb, ['thumb-side', 'grasp'], true),
      createPositionAnchor(`${prefix}GripCenter`, handId, 'hand-frame', grip, ['ik-target', 'object-target', 'grasp', 'carry'], false),
    );
  }
  return result;
}

function createFootAnchors(coreLayer) {
  const result = [];
  for (const side of ['left', 'right']) {
    const footId = `${side}Foot`;
    const foot = coreLayer.jointTransforms[footId];
    const heelJoint = coreLayer.jointTransforms[`${side}HeelContact`];
    const toeJoint = coreLayer.jointTransforms[`${side}Toes`] ?? coreLayer.jointTransforms[`${side}BallContact`];
    const heel = heelJoint?.worldPosition ?? offsetPoint(coreLayer, footId, [0, -0.10, -0.075]);
    const toe = toeJoint?.worldPosition ?? offsetPoint(coreLayer, footId, [0, -0.10, 0.13]);
    const up = worldDirection(coreLayer, footId, [0, 1, 0]);
    const sole = mix3(heel, toe, 0.52);
    const heelToToe = normalize3(subtract(toe, heel), worldDirection(coreLayer, footId, [0, 0, 1]));
    const forward = normalize3(
      subtract(heelToToe, scale3(up, dot3(heelToToe, up))),
      worldDirection(coreLayer, footId, [0, 0, 1]),
    );
    result.push(
      createPositionAnchor(`${side}HeelContact`, footId, 'foot-frame', heel, ['heel-strike', 'contact'], true),
      createPositionAnchor(`${side}SoleCenter`, footId, 'foot-frame', sole, ['foot-plant', 'contact', 'support'], true),
      createPositionAnchor(`${side}ToeContact`, footId, 'foot-frame', toe, ['toe-off', 'contact'], true),
      createDirectionAnchor(`${side}FootForward`, footId, 'foot-frame', sole, forward, ['foot-forward', 'locomotion'], true),
      createDirectionAnchor(`${side}FootUp`, footId, 'foot-frame', sole, up, ['foot-up', 'ground-normal'], true),
    );
  }
  return result;
}

function createPositionAnchor(anchorId, sourceJointId, sourceFrame, worldPosition, capabilities, measurementOnly) {
  return {
    anchorId,
    sourceJointId,
    sourceFrame,
    localOffset: [0, 0, 0],
    localDirection: null,
    worldPosition: [...worldPosition],
    worldDirection: null,
    capabilities,
    supported: true,
    measurementOnly,
    drivesSkin: false,
    drivesPose: false,
  };
}

function createDirectionAnchor(anchorId, sourceJointId, sourceFrame, worldPosition, worldDirectionValue, capabilities, measurementOnly) {
  return {
    ...createPositionAnchor(anchorId, sourceJointId, sourceFrame, worldPosition, capabilities, measurementOnly),
    localDirection: semanticLocalDirection(anchorId),
    worldDirection: normalize3(worldDirectionValue),
  };
}

function semanticLocalDirection(anchorId) {
  if (/PalmNormal/.test(anchorId)) return [0, 0, 1];
  if (/PalmUp|FootUp/.test(anchorId)) return [0, 1, 0];
  if (/leftThumb/.test(anchorId)) return [-1, 0, 0];
  if (/rightThumb/.test(anchorId)) return [1, 0, 0];
  return [0, 0, 1];
}

function offsetPoint(coreLayer, jointId, localOffset) {
  const transform = coreLayer.jointTransforms[jointId];
  if (!transform) throw new Error(`Interaction Rig cannot resolve Core joint ${jointId}.`);
  return add3(transform.worldPosition, rotateVector(localOffset, transform.worldQuaternion));
}

function worldDirection(coreLayer, jointId, localDirection) {
  const transform = coreLayer.jointTransforms[jointId];
  if (!transform) throw new Error(`Interaction Rig cannot resolve Core joint ${jointId}.`);
  return normalize3(rotateVector(localDirection, transform.worldQuaternion), localDirection);
}

function subtract(a, b) {
  return a.map((value, index) => value - b[index]);
}

function createPalmFrameMetrics(byId) {
  return Object.fromEntries(['left', 'right'].map((side) => {
    const normal = byId[`${side}PalmNormal`].worldDirection;
    const up = byId[`${side}PalmUp`].worldDirection;
    const thumb = byId[`${side}ThumbSide`].worldDirection;
    const mirroredThumb = side === 'left' ? scale3(thumb, -1) : thumb;
    const determinant = Math.abs(dot3(cross3(up, normal), mirroredThumb));
    return [side, {
      determinant,
      rawSemanticHandedness: Math.sign(dot3(cross3(up, normal), thumb)) || 0,
      mirrorNormalized: true,
      maximumOrthogonalityError: Math.max(Math.abs(dot3(normal, up)), Math.abs(dot3(normal, thumb)), Math.abs(dot3(up, thumb))),
      palmCenter: byId[`${side}PalmCenter`].worldPosition,
      gripCenter: byId[`${side}GripCenter`].worldPosition,
    }];
  }));
}

function createFootFrameMetrics(byId) {
  return Object.fromEntries(['left', 'right'].map((side) => {
    const forward = byId[`${side}FootForward`].worldDirection;
    const up = byId[`${side}FootUp`].worldDirection;
    const sideAxis = normalize3(cross3(up, forward), side === 'left' ? [-1, 0, 0] : [1, 0, 0]);
    const determinant = Math.abs(dot3(cross3(sideAxis, up), forward));
    const heel = byId[`${side}HeelContact`].worldPosition;
    const sole = byId[`${side}SoleCenter`].worldPosition;
    const toe = byId[`${side}ToeContact`].worldPosition;
    const segmentLength = distance3(heel, toe);
    const orderProjection = segmentLength > 1e-12
      ? dot3(subtract(sole, heel), normalize3(subtract(toe, heel))) / segmentLength : 0;
    return [side, {
      determinant,
      maximumOrthogonalityError: Math.max(Math.abs(dot3(forward, up)), Math.abs(dot3(forward, sideAxis)), Math.abs(dot3(up, sideAxis))),
      heelSoleToeOrderPassed: orderProjection > 0 && orderProjection < 1,
      soleInterpolationRatio: orderProjection,
      groundNormalCompatibility: dot3(up, [0, 1, 0]),
    }];
  }));
}

function measureAnchorSymmetry(byId) {
  let maximumAnchorSymmetryError = 0;
  for (const anchorId of REQUIRED_INTERACTION_ANCHOR_IDS_V1.filter((id) => id.startsWith('left'))) {
    const right = byId[`right${anchorId.slice(4)}`];
    const left = byId[anchorId];
    if (!left || !right) continue;
    const mirrored = [-left.worldPosition[0], left.worldPosition[1], left.worldPosition[2]];
    maximumAnchorSymmetryError = Math.max(maximumAnchorSymmetryError, distance3(mirrored, right.worldPosition));
  }
  return { maximumAnchorSymmetryError };
}
