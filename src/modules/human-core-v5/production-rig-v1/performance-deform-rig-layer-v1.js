import {
  countNonFinite,
  distance3,
  mix3,
  normalize3,
  quaternionFromBasis,
  slerpQuaternions,
  subtract3,
} from './rig-quality-metrics-v1.js';

export const PERFORMANCE_DEFORM_RIG_LAYER_V1_SCHEMA = 'humanoid_rig/performance_deform_rig_layer@1.0';

export const PERFORMANCE_DEFORM_NODE_SPECS_V1 = Object.freeze([
  spec('leftClavicle', 'leftShoulder', 'clavicle', 'core-alias', null),
  spec('rightClavicle', 'rightShoulder', 'clavicle', 'core-alias', null),
  spec('leftScapula', 'leftShoulder', 'scapula', 'scapula-derived', null),
  spec('rightScapula', 'rightShoulder', 'scapula', 'scapula-derived', null),
  twist('leftUpperArmTwist01', 'leftUpperArm', 'leftLowerArm', 1 / 3),
  twist('leftUpperArmTwist02', 'leftUpperArm', 'leftLowerArm', 2 / 3),
  twist('rightUpperArmTwist01', 'rightUpperArm', 'rightLowerArm', 1 / 3),
  twist('rightUpperArmTwist02', 'rightUpperArm', 'rightLowerArm', 2 / 3),
  twist('leftForearmTwist01', 'leftLowerArm', 'leftHand', 1 / 3),
  twist('leftForearmTwist02', 'leftLowerArm', 'leftHand', 2 / 3),
  twist('rightForearmTwist01', 'rightLowerArm', 'rightHand', 1 / 3),
  twist('rightForearmTwist02', 'rightLowerArm', 'rightHand', 2 / 3),
  twist('leftThighTwist01', 'leftUpperLeg', 'leftLowerLeg', 1 / 3),
  twist('leftThighTwist02', 'leftUpperLeg', 'leftLowerLeg', 2 / 3),
  twist('rightThighTwist01', 'rightUpperLeg', 'rightLowerLeg', 1 / 3),
  twist('rightThighTwist02', 'rightUpperLeg', 'rightLowerLeg', 2 / 3),
  twist('leftCalfTwist01', 'leftLowerLeg', 'leftFoot', 0.5),
  twist('rightCalfTwist01', 'rightLowerLeg', 'rightFoot', 0.5),
  spec('leftPalmFrame', 'leftHand', 'palm-frame', 'joint-frame', null),
  spec('rightPalmFrame', 'rightHand', 'palm-frame', 'joint-frame', null),
  spec('leftFootFrame', 'leftFoot', 'foot-frame', 'joint-frame', null),
  spec('rightFootFrame', 'rightFoot', 'foot-frame', 'joint-frame', null),
]);

export function createPerformanceDeformRigLayerV1({ coreLayer } = {}) {
  if (coreLayer?.type !== 'CoreRigLayerV1') throw new Error('PerformanceDeformRigLayerV1 requires CoreRigLayerV1.');
  const nodes = PERFORMANCE_DEFORM_NODE_SPECS_V1.map((definition) => deriveNode(definition, coreLayer));
  const nonFiniteTransformCount = countNonFinite(nodes.map((node) => ({ position: node.worldPosition, quaternion: node.worldQuaternion })));
  const reflectionCount = nodes.filter((node) => node.determinant < 0).length;
  const maximumTwistNodePositionError = Math.max(0, ...nodes.filter((node) => node.derivedRole === 'twist-distribution')
    .map((node) => distance3(node.worldPosition, mix3(
      coreLayer.jointTransforms[node.coreJointSource].worldPosition,
      coreLayer.jointTransforms[node.targetJointId].worldPosition,
      node.segmentRatio,
    ))));
  const maximumParentConsistencyError = maximumTwistNodePositionError;
  const leftRightSymmetryError = measureNodeSymmetry(nodes);
  return {
    schema: PERFORMANCE_DEFORM_RIG_LAYER_V1_SCHEMA,
    type: 'PerformanceDeformRigLayerV1',
    authority: 'derived',
    poseAuthority: 'finalPose-read-only',
    writesHumanRigCore: false,
    writesFinalPose: false,
    skinWeightsAvailable: false,
    productionDeformApproved: false,
    status: ['derived-transform', 'diagnostic', 'contract-ready', 'skin-weight-pending'],
    nodes,
    metrics: {
      nodeCount: nodes.length,
      nonFiniteTransformCount,
      reflectionCount,
      maximumParentConsistencyError,
      maximumTwistNodePositionError,
      leftRightSymmetryError,
      passed: nonFiniteTransformCount === 0
        && reflectionCount === 0
        && maximumParentConsistencyError <= 1e-6
        && maximumTwistNodePositionError <= 1e-6
        && leftRightSymmetryError <= 1e-5,
    },
  };
}

function deriveNode(definition, coreLayer) {
  const source = requiredTransform(coreLayer, definition.coreJointSource);
  let position = [...source.worldPosition];
  let quaternion = [...source.worldQuaternion];
  let determinant = 1;
  if (definition.derivedRole === 'twist-distribution') {
    const target = requiredTransform(coreLayer, definition.targetJointId);
    position = mix3(source.worldPosition, target.worldPosition, definition.segmentRatio);
    quaternion = slerpQuaternions(source.worldQuaternion, target.worldQuaternion, definition.segmentRatio);
  } else if (definition.derivedRole === 'scapula-derived') {
    const chest = requiredTransform(coreLayer, 'upperChest');
    const upperArm = requiredTransform(coreLayer, definition.coreJointSource.replace('Shoulder', 'UpperArm'));
    const lateral = normalize3(subtract3(source.worldPosition, chest.worldPosition), definition.nodeId.startsWith('left') ? [-1, 0, 0] : [1, 0, 0]);
    const arm = normalize3(subtract3(upperArm.worldPosition, source.worldPosition), lateral);
    const forward = normalize3([0, 0, 1]);
    const up = normalize3([
      forward[1] * lateral[2] - forward[2] * lateral[1],
      forward[2] * lateral[0] - forward[0] * lateral[2],
      forward[0] * lateral[1] - forward[1] * lateral[0],
    ], [0, 1, 0]);
    quaternion = quaternionFromBasis(lateral, up, normalize3(arm, forward));
    position = mix3(chest.worldPosition, source.worldPosition, 0.72);
  }
  return {
    ...definition,
    worldPosition: position,
    worldQuaternion: quaternion,
    determinant,
    authority: 'derived',
    writesFinalPose: false,
    writesHumanRigCore: false,
    skinWeightsAvailable: false,
    productionDeformApproved: false,
    status: ['derived-transform', 'diagnostic', 'contract-ready', 'skin-weight-pending'],
  };
}

function requiredTransform(coreLayer, jointId) {
  const transform = coreLayer.jointTransforms[jointId];
  if (!transform) throw new Error(`Performance Deform Rig cannot resolve Core joint ${jointId}.`);
  return transform;
}

function measureNodeSymmetry(nodes) {
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  let maximum = 0;
  for (const node of nodes.filter((item) => item.nodeId.startsWith('left'))) {
    const right = byId.get(`right${node.nodeId.slice(4)}`);
    if (!right) continue;
    const mirrored = [-node.worldPosition[0], node.worldPosition[1], node.worldPosition[2]];
    maximum = Math.max(maximum, distance3(mirrored, right.worldPosition));
  }
  return maximum;
}

function spec(nodeId, coreJointSource, deformRole, derivedRole, targetJointId) {
  return Object.freeze({
    nodeId, coreJointSource, targetJointId, derivedRole, deformRole,
    interactionRole: deformRole.endsWith('-frame') ? 'frame-source' : 'none',
    segmentRatio: null,
  });
}

function twist(nodeId, sourceJointId, targetJointId, segmentRatio) {
  return Object.freeze({
    nodeId,
    coreJointSource: sourceJointId,
    targetJointId,
    derivedRole: 'twist-distribution',
    deformRole: 'twist-weight-contract',
    interactionRole: 'none',
    segmentRatio,
  });
}
