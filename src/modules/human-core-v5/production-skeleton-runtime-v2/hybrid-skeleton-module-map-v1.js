import {
  identityMatrix4,
  invertRigidFrameMatrix,
  resolveHybridSkeletonSourceFrameV1,
} from './hybrid-skeleton-transform-resolver-v1.js';

export const HYBRID_SKELETON_MODULE_MAP_V1_SCHEMA = 'humanoid_rig/hybrid_skeleton_module_map@1.0';

const SPECS = Object.freeze([
  joint('pelvis', 'axial', 'hips', ['hips'], ['hips', 'leftUpperLeg', 'rightUpperLeg']),
  thorax(),
  joint('neck', 'axial', 'neck', ['neck']),
  joint('head', 'axial', 'head', ['head']),
  segment('leftClavicle', 'shoulder-girdle', 'upperChest', 'leftShoulder'),
  segment('rightClavicle', 'shoulder-girdle', 'upperChest', 'rightShoulder'),
  scapula('left'),
  scapula('right'),
  segment('leftUpperArm', 'long-bone', 'leftUpperArm', 'leftLowerArm'),
  segment('rightUpperArm', 'long-bone', 'rightUpperArm', 'rightLowerArm'),
  segment('leftForearmRadius', 'paired-rail', 'leftLowerArm', 'leftHand'),
  segment('leftForearmUlna', 'paired-rail', 'leftLowerArm', 'leftHand'),
  segment('rightForearmRadius', 'paired-rail', 'rightLowerArm', 'rightHand'),
  segment('rightForearmUlna', 'paired-rail', 'rightLowerArm', 'rightHand'),
  joint('leftHand', 'extremity', 'leftHand', ['leftHand']),
  joint('rightHand', 'extremity', 'rightHand', ['rightHand']),
  segment('leftThigh', 'long-bone', 'leftUpperLeg', 'leftLowerLeg'),
  segment('rightThigh', 'long-bone', 'rightUpperLeg', 'rightLowerLeg'),
  segment('leftTibia', 'paired-rail', 'leftLowerLeg', 'leftFoot'),
  segment('leftFibula', 'paired-rail', 'leftLowerLeg', 'leftFoot'),
  segment('rightTibia', 'paired-rail', 'rightLowerLeg', 'rightFoot'),
  segment('rightFibula', 'paired-rail', 'rightLowerLeg', 'rightFoot'),
  joint('leftFoot', 'extremity', 'leftFoot', ['leftFoot']),
  joint('rightFoot', 'extremity', 'rightFoot', ['rightFoot']),
]);

export function createHybridSkeletonModuleMapV1({ restSimulationFrame } = {}) {
  if (!restSimulationFrame?.joints) throw new Error('Hybrid Skeleton module map requires the Reference T SimulationRig frame.');
  const records = SPECS.map((spec) => {
    const restFrame = resolveHybridSkeletonSourceFrameV1(spec, restSimulationFrame);
    const restWorldMatrix = identityMatrix4();
    const restLocalMatrix = invertRigidFrameMatrix(restFrame.position, restFrame.quaternion);
    return Object.freeze({
      schema: HYBRID_SKELETON_MODULE_MAP_V1_SCHEMA,
      ...spec,
      restWorldMatrix: Object.freeze(restWorldMatrix),
      restLocalMatrix: Object.freeze(restLocalMatrix),
      restFramePosition: Object.freeze([...restFrame.position]),
      restFrameQuaternion: Object.freeze([...restFrame.quaternion]),
      authority: 'display-derived',
      writesHumanRigCore: false,
      writesFinalPose: false,
    });
  });
  const ids = new Set(records.map(({ moduleId }) => moduleId));
  if (records.length !== 24 || ids.size !== records.length) {
    throw new Error(`Hybrid Skeleton module map must contain 24 unique modules; received ${records.length}/${ids.size}.`);
  }
  return Object.freeze(records);
}

export function getHybridSkeletonModuleSpecsV1() {
  return SPECS.map((spec) => structuredClone(spec));
}

function joint(moduleId, moduleClass, originJointId, sourceJointIds, attachmentJointIds = sourceJointIds) {
  return Object.freeze({
    moduleId, moduleClass, sourceJointIds: Object.freeze(sourceJointIds), attachmentJointIds: Object.freeze(attachmentJointIds),
    transformMode: 'joint-frame', frameKind: 'joint', originJointId,
  });
}

function segment(moduleId, moduleClass, startJointId, endJointId) {
  return Object.freeze({
    moduleId, moduleClass,
    sourceJointIds: Object.freeze([startJointId, endJointId]),
    attachmentJointIds: Object.freeze([startJointId, endJointId]),
    transformMode: 'segment-frame', frameKind: 'segment', originJointId: startJointId, startJointId, endJointId,
  });
}

function thorax() {
  return Object.freeze({
    moduleId: 'thorax', moduleClass: 'axial', sourceJointIds: Object.freeze(['chest', 'upperChest']),
    attachmentJointIds: Object.freeze(['chest', 'upperChest']), transformMode: 'joint-frame', frameKind: 'thorax', originJointId: 'chest',
  });
}

function scapula(side) {
  const shoulderJointId = `${side}Shoulder`;
  const upperArmJointId = `${side}UpperArm`;
  return Object.freeze({
    moduleId: `${side}Scapula`, moduleClass: 'shoulder-girdle', side,
    sourceJointIds: Object.freeze(['upperChest', shoulderJointId, upperArmJointId]),
    attachmentJointIds: Object.freeze(['upperChest', shoulderJointId]),
    transformMode: 'diagnostic-frame', frameKind: 'scapula', originJointId: shoulderJointId,
    shoulderJointId, upperArmJointId,
  });
}
