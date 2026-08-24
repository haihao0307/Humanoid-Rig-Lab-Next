import {
  assertHumanAnatomyStateV5,
  cloneHumanAnatomyStateV5,
} from './human-anatomy-state-v5.js';
import { AnatomyPoseEvaluatorV5 } from './anatomy-pose-evaluator-v5.js';
import { assertHumanRigCoreV5, cloneHumanRigCoreV5 } from './human-rig-core-v5.js';
import { assertHumanCoreStateV5 } from './human-core-state-v5.js';

export const HUMAN_ANATOMY_RUNTIME_V5_SCHEMA = 'humanoid_rig/human_anatomy_runtime@5.0';

/**
 * Small observer runtime for the V5 anatomy projection. It owns no Rig,
 * ProjectState, mesh, or solver; it only caches the latest derived result.
 */
export class HumanAnatomyRuntimeV5 {
  constructor({ rigCore = null, evaluator = new AnatomyPoseEvaluatorV5() } = {}) {
    this.rigCore = rigCore ? cloneHumanRigCoreV5(rigCore) : null;
    this.evaluator = evaluator;
    this.lastState = null;
  }

  setRigCore(rigCore) {
    this.rigCore = cloneHumanRigCoreV5(rigCore);
    assertHumanRigCoreV5(this.rigCore);
    return this.getDiagnostics();
  }

  evaluate(humanCoreState, { poseFrame = null, timestamp = Date.now() } = {}) {
    assertHumanCoreStateV5(humanCoreState);
    if (!this.rigCore) throw new Error('HumanAnatomyRuntimeV5 requires a HumanRigCore before evaluate().');
    const anatomyState = this.evaluator.evaluate({
      humanCoreState,
      rigCore: this.rigCore,
      poseFrame,
      timestamp,
    });
    assertHumanAnatomyStateV5(anatomyState);
    this.lastState = anatomyState;
    return cloneHumanAnatomyStateV5(anatomyState);
  }

  getState() {
    return this.lastState ? cloneHumanAnatomyStateV5(this.lastState) : null;
  }

  getDiagnostics() {
    return {
      schema: HUMAN_ANATOMY_RUNTIME_V5_SCHEMA,
      rigId: this.rigCore?.rigId ?? null,
      hasAnatomyState: Boolean(this.lastState),
      stateAuthority: 'body-dna-plus-pose-frame-v4',
      writesMesh: false,
      writesSkin: false,
      replacesWholeBodySolver: false,
    };
  }
}
