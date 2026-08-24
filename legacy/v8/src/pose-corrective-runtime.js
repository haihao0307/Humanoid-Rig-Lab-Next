import { assertPoseFrameV4 } from '../../../src/modules/pose/pose-frame-v4.js';

const EPSILON = 1e-8;

export class PoseCorrectiveRuntime {
  constructor(correctiveMap = {}) {
    this.correctiveMap = structuredClone(correctiveMap);
    this.lastDiagnostics = inactiveDiagnostics(this.correctiveMap);
  }

  evaluate(finalPose) {
    assertPoseFrameV4(finalPose);
    const activations = {};
    const activeRegions = new Set();
    let maximumActivation = 0;

    for (const [correctiveId, definition] of Object.entries(this.correctiveMap)) {
      const quaternion = finalPose.localRotations?.[definition.driverJointId] ?? [0, 0, 0, 1];
      const angle = quaternionAngle(quaternion);
      const activation = smoothstep(
        Number(definition.startAngle) || 0,
        Math.max(Number(definition.fullAngle) || Math.PI, EPSILON),
        angle,
      );
      activations[correctiveId] = activation;
      maximumActivation = Math.max(maximumActivation, activation);
      if (activation > 1e-4) activeRegions.add(definition.region);
    }

    this.lastDiagnostics = {
      schema: 'humanoid_rig/pose_corrective_diagnostics@4.0',
      mode: 'bone-driven-local-quaternion',
      correctiveCount: Object.keys(this.correctiveMap).length,
      activeCorrectiveCount: Object.values(activations).filter((value) => value > 1e-4).length,
      activeRegions: [...activeRegions],
      maximumActivation,
      activations: structuredClone(activations),
      source: 'finalPose.localRotations',
      modifiesRig: false,
    };
    return { activations, diagnostics: this.getDiagnostics() };
  }

  applyCorrectives(finalPose, mesh) {
    const result = this.evaluate(finalPose);
    const applied = typeof mesh?.applyCorrectiveWeights === 'function'
      ? Boolean(mesh.applyCorrectiveWeights(result.activations))
      : false;
    this.lastDiagnostics = {
      ...this.lastDiagnostics,
      applied,
      target: applied ? 'mesh-corrective-adapter' : 'coefficient-output-only',
    };
    return { ...result, applied };
  }

  getDiagnostics() {
    return structuredClone(this.lastDiagnostics);
  }
}

function inactiveDiagnostics(correctiveMap) {
  return {
    schema: 'humanoid_rig/pose_corrective_diagnostics@4.0',
    mode: 'bone-driven-local-quaternion',
    correctiveCount: Object.keys(correctiveMap).length,
    activeCorrectiveCount: 0,
    activeRegions: [],
    maximumActivation: 0,
    activations: {},
    source: 'finalPose.localRotations',
    modifiesRig: false,
    applied: false,
    target: 'coefficient-output-only',
  };
}

function quaternionAngle(value) {
  const quaternion = normalizeQuaternion(value);
  return 2 * Math.acos(clamp(Math.abs(quaternion[3]), 0, 1));
}

function normalizeQuaternion(value) {
  const source = Array.isArray(value) || ArrayBuffer.isView(value) ? Array.from(value, Number) : [0, 0, 0, 1];
  const length = Math.hypot(...source) || 1;
  const normalized = source.map((component) => component / length);
  return normalized[3] < 0 ? normalized.map((component) => -component) : normalized;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(EPSILON, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
