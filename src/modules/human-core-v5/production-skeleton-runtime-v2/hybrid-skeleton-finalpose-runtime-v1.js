import { createPoseFrameV4 } from '../../pose/pose-frame-v4.js';
import { slerpQuaternions } from '../production-rig-v1/rig-quality-metrics-v1.js';
import { createProceduralSimulationRigFrameV5 } from '../procedural-deform/procedural-simulation-rig-fk-v5.js';
import { stableFingerprint } from '../core-utils.js';
import { resolveHybridSkeletonTransformsV1 } from './hybrid-skeleton-transform-resolver-v1.js';

export const HYBRID_SKELETON_FINALPOSE_RUNTIME_V1_SCHEMA = 'humanoid_rig/hybrid_skeleton_finalpose_runtime@1.0';

export class HybridSkeletonFinalPoseRuntimeV1 {
  constructor({ rigCore, bodyDNA, moduleMap, applyTransform = null } = {}) {
    if (!rigCore || !bodyDNA || !Array.isArray(moduleMap)) throw new Error('Hybrid Skeleton runtime requires rigCore, bodyDNA, and moduleMap.');
    this.rigCore = rigCore;
    this.bodyDNA = bodyDNA;
    this.moduleMap = moduleMap;
    this.applyTransform = typeof applyTransform === 'function' ? applyTransform : null;
    this.lastFrame = null;
  }

  update(finalPose) {
    const fingerprintBefore = fingerprintFinalPoseV1(finalPose);
    const simulationRigFrame = createProceduralSimulationRigFrameV5({ finalPose, rigCore: this.rigCore, bodyDNA: this.bodyDNA });
    const transforms = resolveHybridSkeletonTransformsV1(this.moduleMap, simulationRigFrame);
    if (this.applyTransform) {
      for (const transform of transforms) this.applyTransform(transform.moduleId, [...transform.currentWorldMatrix], transform);
    }
    const fingerprintAfter = fingerprintFinalPoseV1(finalPose);
    const frame = {
      schema: HYBRID_SKELETON_FINALPOSE_RUNTIME_V1_SCHEMA,
      type: 'HybridSkeletonFinalPoseFrame',
      authority: 'display-derived',
      poseAuthority: 'finalPose',
      writesHumanRigCore: false,
      writesFinalPose: false,
      finalPoseFingerprintBefore: fingerprintBefore,
      finalPoseFingerprintAfter: fingerprintAfter,
      finalPoseReadOnlyPassed: fingerprintBefore === fingerprintAfter,
      moduleCount: transforms.length,
      simulationRigFrame,
      transforms,
    };
    if (!frame.finalPoseReadOnlyPassed) throw new Error('Hybrid Skeleton runtime detected a finalPose mutation.');
    this.lastFrame = frame;
    return frame;
  }
}

export function createHybridSkeletonFinalPoseRuntimeV1(options) {
  return new HybridSkeletonFinalPoseRuntimeV1(options);
}

export function interpolateFinalPoseV1(fromPose, toPose, alpha, timestamp = 0) {
  const t = Math.min(1, Math.max(0, Number(alpha) || 0));
  if (fromPose.compatibleRig !== toPose.compatibleRig || fromPose.proportionRevision !== toPose.proportionRevision) {
    throw new Error('Hybrid Skeleton sequence requires compatible finalPose fixtures.');
  }
  const jointIds = [...new Set([...Object.keys(fromPose.localRotations), ...Object.keys(toPose.localRotations)])].sort();
  const localRotations = Object.fromEntries(jointIds.map((jointId) => [
    jointId,
    slerpQuaternions(fromPose.localRotations[jointId] ?? [0, 0, 0, 1], toPose.localRotations[jointId] ?? [0, 0, 0, 1], t),
  ]));
  return createPoseFrameV4({
    compatibleRig: fromPose.compatibleRig,
    rootJointId: fromPose.rootJointId,
    rootPosition: fromPose.rootPosition.map((value, index) => value + (toPose.rootPosition[index] - value) * t),
    rootRotation: slerpQuaternions(fromPose.rootRotation, toPose.rootRotation, t),
    localRotations,
    contacts: t < 0.5 ? fromPose.contacts : toPose.contacts,
    ikTargets: [],
    constraintState: { source: 'task17a3-p2-read-only-diagnostic-interpolation', alpha: t },
    proportionRevision: fromPose.proportionRevision,
    timestamp,
  });
}

export function fingerprintFinalPoseV1(finalPose) {
  return stableFingerprint({
    rootPosition: finalPose?.rootPosition,
    rootRotation: finalPose?.rootRotation,
    localRotations: finalPose?.localRotations,
  });
}
