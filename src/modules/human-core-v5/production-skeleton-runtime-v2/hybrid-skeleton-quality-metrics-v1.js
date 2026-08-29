import {
  distance3,
  dot3,
  normalize3,
  subtract3,
} from '../production-rig-v1/rig-quality-metrics-v1.js';
import {
  transformDirection3,
  transformPoint3,
} from './hybrid-skeleton-transform-resolver-v1.js';

export const HYBRID_SKELETON_QUALITY_METRICS_V1_SCHEMA = 'humanoid_rig/hybrid_skeleton_quality_metrics@1.0';

export const HYBRID_SKELETON_P2_THRESHOLDS = Object.freeze({
  moduleCount: 24,
  missingModuleCount: 0,
  nonFiniteTransformCount: 0,
  reflectionCount: 0,
  maximumJointCenterError: 1e-6,
  maximumSegmentAxisError: 0.1,
  maximumSegmentLengthError: 1e-8,
  maximumModuleAttachmentError: 0.003,
  leftRightSymmetryError: 1e-5,
});

const MIRRORED_MODULE_PAIRS = Object.freeze([
  ['leftClavicle', 'rightClavicle'], ['leftScapula', 'rightScapula'],
  ['leftUpperArm', 'rightUpperArm'], ['leftForearmRadius', 'rightForearmRadius'],
  ['leftForearmUlna', 'rightForearmUlna'], ['leftHand', 'rightHand'],
  ['leftThigh', 'rightThigh'], ['leftTibia', 'rightTibia'],
  ['leftFibula', 'rightFibula'], ['leftFoot', 'rightFoot'],
]);

export function createHybridSkeletonPoseMetricsV1({
  poseId,
  moduleMap,
  runtimeFrame,
  restSimulationFrame,
  geometryHash,
  indexHash,
  loadedModuleIds = [],
  maximumFrameToFrameModuleJump = 0,
} = {}) {
  const transforms = runtimeFrame?.transforms ?? [];
  const currentSimulationFrame = runtimeFrame?.simulationRigFrame;
  if (!currentSimulationFrame?.joints || !restSimulationFrame?.joints) throw new Error('Hybrid Skeleton metrics require rest and current SimulationRig frames.');
  const loaded = new Set(loadedModuleIds);
  const missingModuleIds = moduleMap.map(({ moduleId }) => moduleId).filter((moduleId) => !loaded.has(moduleId));
  const transformById = new Map(transforms.map((transform) => [transform.moduleId, transform]));
  const attachmentErrorByModuleId = {};
  let maximumJointCenterError = 0;
  let maximumSegmentAxisError = 0;
  let maximumSegmentLengthError = 0;
  let maximumModuleAttachmentError = 0;

  for (const record of moduleMap) {
    const transform = transformById.get(record.moduleId);
    if (!transform) continue;
    const restOrigin = restSimulationFrame.joints[record.originJointId]?.worldPosition;
    const currentOrigin = currentSimulationFrame.joints[record.originJointId]?.worldPosition;
    if (restOrigin && currentOrigin) {
      maximumJointCenterError = Math.max(maximumJointCenterError, distance3(transformPoint3(transform.currentWorldMatrix, restOrigin), currentOrigin));
    }
    let moduleAttachmentError = 0;
    for (const jointId of record.attachmentJointIds ?? []) {
      const restJoint = restSimulationFrame.joints[jointId];
      const currentJoint = currentSimulationFrame.joints[jointId];
      if (!restJoint || !currentJoint) continue;
      moduleAttachmentError = Math.max(moduleAttachmentError,
        distance3(transformPoint3(transform.currentWorldMatrix, restJoint.worldPosition), currentJoint.worldPosition));
    }
    attachmentErrorByModuleId[record.moduleId] = moduleAttachmentError;
    maximumModuleAttachmentError = Math.max(maximumModuleAttachmentError, moduleAttachmentError);
    if (record.frameKind === 'segment' || record.frameKind === 'thorax') {
      const startJointId = record.frameKind === 'thorax' ? 'chest' : record.startJointId;
      const endJointId = record.frameKind === 'thorax' ? 'upperChest' : record.endJointId;
      const restVector = subtract3(restSimulationFrame.joints[endJointId].worldPosition, restSimulationFrame.joints[startJointId].worldPosition);
      const currentVector = subtract3(currentSimulationFrame.joints[endJointId].worldPosition, currentSimulationFrame.joints[startJointId].worldPosition);
      const transformedDirection = transformDirection3(transform.currentWorldMatrix, normalize3(restVector));
      const axisError = radiansToDegrees(Math.acos(clamp(dot3(transformedDirection, normalize3(currentVector)), -1, 1)));
      maximumSegmentAxisError = Math.max(maximumSegmentAxisError, axisError);
      maximumSegmentLengthError = Math.max(maximumSegmentLengthError, Math.abs(Math.hypot(...restVector) - Math.hypot(...currentVector)));
    }
  }

  const pairErrors = MIRRORED_MODULE_PAIRS.map(([left, right]) => ({
    left,
    right,
    errorDifferenceMeters: Math.abs((attachmentErrorByModuleId[left] ?? Number.POSITIVE_INFINITY)
      - (attachmentErrorByModuleId[right] ?? Number.NEGATIVE_INFINITY)),
  }));
  const leftRightSymmetryError = Math.max(0, ...pairErrors.map(({ errorDifferenceMeters }) => errorDifferenceMeters));
  const nonFiniteTransformCount = transforms.reduce((sum, transform) => sum
    + transform.currentWorldMatrix.filter((value) => !Number.isFinite(value)).length, 0);
  const reflectionCount = transforms.filter(({ determinant }) => !(determinant > 0)).length;
  const result = {
    schema: HYBRID_SKELETON_QUALITY_METRICS_V1_SCHEMA,
    poseId,
    moduleCount: transforms.length,
    missingModuleCount: missingModuleIds.length,
    missingModuleIds,
    nonFiniteTransformCount,
    reflectionCount,
    geometryHash,
    indexHash,
    finalPoseFingerprintBefore: runtimeFrame.finalPoseFingerprintBefore,
    finalPoseFingerprintAfter: runtimeFrame.finalPoseFingerprintAfter,
    finalPoseReadOnlyPassed: runtimeFrame.finalPoseReadOnlyPassed,
    maximumJointCenterError,
    maximumSegmentAxisError,
    maximumSegmentLengthError,
    maximumModuleAttachmentError,
    leftRightSymmetryError,
    maximumFrameToFrameModuleJump,
    attachmentErrorByModuleId,
    leftRightPairErrorDefinition: 'absolute difference between same-side module attachment residuals; the posed body itself is not required to be symmetric',
    pairErrors,
    thresholds: HYBRID_SKELETON_P2_THRESHOLDS,
  };
  result.passed = validateHybridSkeletonPoseMetricsV1(result).passed;
  return result;
}

export function validateHybridSkeletonPoseMetricsV1(metrics) {
  const t = HYBRID_SKELETON_P2_THRESHOLDS;
  const gates = {
    moduleCount: metrics.moduleCount === t.moduleCount,
    missingModuleCount: metrics.missingModuleCount === t.missingModuleCount,
    nonFiniteTransformCount: metrics.nonFiniteTransformCount === t.nonFiniteTransformCount,
    reflectionCount: metrics.reflectionCount === t.reflectionCount,
    finalPoseReadOnlyPassed: metrics.finalPoseReadOnlyPassed === true,
    maximumJointCenterError: metrics.maximumJointCenterError <= t.maximumJointCenterError,
    maximumSegmentAxisError: metrics.maximumSegmentAxisError <= t.maximumSegmentAxisError,
    maximumSegmentLengthError: metrics.maximumSegmentLengthError <= t.maximumSegmentLengthError,
    maximumModuleAttachmentError: metrics.maximumModuleAttachmentError <= t.maximumModuleAttachmentError,
    leftRightSymmetryError: metrics.leftRightSymmetryError <= t.leftRightSymmetryError,
  };
  return { passed: Object.values(gates).every(Boolean), gates };
}

function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
function radiansToDegrees(value) { return value * 180 / Math.PI; }
