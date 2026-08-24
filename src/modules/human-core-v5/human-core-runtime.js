import { createStandardHumanoidPreset } from '../../../legacy/v8/src/skeleton-presets.js';
import { createBodyDNA } from './body-dna-v5.js';
import { createHumanRigCoreV5 } from './human-rig-core-v5.js';
import {
  cloneHumanCoreStateV5,
  createHumanCoreStateV5,
  withHumanCoreMotionStateV5,
  withHumanCorePoseFrameV5,
} from './human-core-state-v5.js';
import { assertPoseFrameV4 } from '../pose/pose-frame-v4.js';
import { cloneValue } from './core-utils.js';

export const HUMAN_CORE_RUNTIME_V5_SCHEMA = 'humanoid_rig/human_core_runtime@5.0';

/**
 * Phase-one Human Core runtime: it owns only an in-memory V5 state projection.
 * ProjectState remains the application's persistence authority, while Skin,
 * Three.js, and MotionClip assets remain outside this runtime.
 */
export class HumanCoreRuntime {
  constructor({ rigDefinition = null } = {}) {
    this.rigDefinition = rigDefinition ? cloneValue(rigDefinition) : null;
    this.state = null;
    this.rigCore = null;
  }

  createHuman(bodyDNAInput = {}, {
    rigDefinition = this.rigDefinition ?? createStandardHumanoidPreset('A'),
    motionState = {},
    appearanceState = {},
    timestamp = Date.now(),
  } = {}) {
    const bodyDNA = createBodyDNA(bodyDNAInput);
    const rigCore = createHumanRigCoreV5({ definition: rigDefinition, bodyDNA });
    this.rigDefinition = cloneValue(rigDefinition);
    this.rigCore = rigCore;
    this.state = createHumanCoreStateV5({
      bodyDNA,
      rigCore,
      motionState,
      appearanceState,
      timestamp,
    });
    return this.getState();
  }

  updatePose(poseFrame, { timestamp = Date.now() } = {}) {
    this.assertReady();
    assertPoseFrameV4(poseFrame);
    this.state = withHumanCorePoseFrameV5(this.state, poseFrame, { timestamp });
    return this.getState();
  }

  updateMotion(motionState, { timestamp = Date.now() } = {}) {
    this.assertReady();
    this.state = withHumanCoreMotionStateV5(this.state, motionState, { timestamp });
    return this.getState();
  }

  evaluateConstraints() {
    this.assertReady();
    const knownJointIds = new Set(this.rigCore.joints.map((joint) => joint.jointId));
    const pose = this.state.poseState.currentPose;
    const violations = [];
    const warnings = [];
    if (pose) {
      for (const jointId of Object.keys(pose.localRotations)) {
        if (!knownJointIds.has(jointId)) violations.push({ code: 'unknown-pose-joint', jointId });
      }
      for (const contact of pose.contacts) {
        if (!knownJointIds.has(contact.jointId)) warnings.push({ code: 'unknown-contact-joint', jointId: contact.jointId });
      }
      if (pose.proportionRevision !== this.state.bodyDNA.proportionRevision) {
        violations.push({
          code: 'proportion-revision-mismatch',
          poseRevision: pose.proportionRevision,
          bodyDNARevision: this.state.bodyDNA.proportionRevision,
        });
      }
    }
    const report = {
      schema: HUMAN_CORE_RUNTIME_V5_SCHEMA,
      type: 'HumanCoreConstraintReport',
      humanId: this.state.humanId,
      rigId: this.rigCore.rigId,
      valid: violations.length === 0,
      stage: pose ? 'pose-observed' : 'no-pose',
      violations,
      warnings,
      checked: {
        topologyStable: this.rigCore.diagnostics.projectionOnly === true,
        axisContractComplete: this.rigCore.diagnostics.axisContractComplete,
        axisContractOrthonormal: this.rigCore.diagnostics.axisContractOrthonormal,
        poseAuthority: pose ? 'local-quaternion-v4' : 'not-yet-sampled',
        rendererMutation: false,
      },
    };
    this.state.balanceState = {
      ...this.state.balanceState,
      constraintStatus: report.valid ? 'valid' : 'degraded',
      lastConstraintReport: {
        valid: report.valid,
        violationCount: report.violations.length,
        warningCount: report.warnings.length,
      },
    };
    return cloneValue(report);
  }

  getRigState() {
    this.assertReady();
    return cloneValue(this.state.rigState);
  }

  getState() {
    this.assertReady();
    return cloneHumanCoreStateV5(this.state);
  }

  getRigCore() {
    this.assertReady();
    return cloneValue(this.rigCore);
  }

  assertReady() {
    if (!this.state || !this.rigCore) throw new Error('HumanCoreRuntime requires createHuman() before use.');
  }
}
