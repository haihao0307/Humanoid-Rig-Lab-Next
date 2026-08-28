import { createBodyDNA } from '../../src/modules/human-core-v5/body-dna-v5.js';
import { createPoseFrameV4 } from '../../src/modules/pose/pose-frame-v4.js';
import { inverseQuaternion, multiplyQuaternions } from '../../src/modules/animation/quaternion.js';
import { createProceduralDeformValidationPoseV5 } from '../../src/modules/human-core-v5/procedural-deform/procedural-deform-validation-poses-v5.js';
import { NaturalLocomotionRuntimeV1 } from '../../src/modules/human-core-v5/motion-execution-v1/natural-locomotion-runtime-v1.js';

export const TASK17A3_SCENARIO_IDS = Object.freeze([
  'reference-t',
  'reference-a',
  'locomotion-neutral',
  'walk-left-support',
  'walk-right-support',
  'turn-mid',
  'salute-ready',
  'jump-preload',
]);

export const TASK17A3_BODY_DNA_INPUT = Object.freeze({
  bodyDNAId: 'task17a3-production-rig-reference',
  identity: Object.freeze({ humanId: 'task17a3-production-rig-reference', label: 'Task 17A.3 Production Rig Reference' }),
  proportionRevision: 17,
});

export function createTask17A3BodyDNA() {
  return createBodyDNA(TASK17A3_BODY_DNA_INPUT);
}

export function createTask17A3Scenario({ poseId, rigCore, bodyDNA = createTask17A3BodyDNA() } = {}) {
  if (!TASK17A3_SCENARIO_IDS.includes(poseId)) throw new Error(`Unknown Task 17A.3 pose ${poseId}.`);
  if (poseId === 'reference-t') return fixture(poseId, createProceduralDeformValidationPoseV5({ poseId: 't-pose', rigCore, bodyDNA, timestamp: 17.3 }));
  if (poseId === 'reference-a') return fixture(poseId, createProceduralDeformValidationPoseV5({ poseId: 'a-pose', rigCore, bodyDNA, timestamp: 17.3 }));
  if (poseId === 'walk-left-support') return fixture(poseId, findSupportPose(bodyDNA, 'left'));
  if (poseId === 'walk-right-support') return fixture(poseId, findSupportPose(bodyDNA, 'right'));
  if (poseId === 'turn-mid') return fixture(poseId, sampleRuntimePose(bodyDNA, 'turn-left-90', 0.5));
  if (poseId === 'jump-preload') {
    const squat = createProceduralDeformValidationPoseV5({ poseId: 'squat', rigCore, bodyDNA, timestamp: 17.3 });
    return fixture(poseId, withStableFootContacts(squat), {
      intent: 'stable-double-support hip-and-knee preload diagnostic only',
      implementsJump: false,
    });
  }
  const idle = sampleRuntimePose(bodyDNA, 'idle-4s', 0.5);
  return fixture(poseId, idle, poseId === 'salute-ready' ? {
    intent: 'stable facing posture with visible right palm anchors',
    implementsSalute: false,
  } : { intent: 'deterministic locomotion-neutral finalPose fixture' });
}

function sampleRuntimePose(bodyDNA, scenarioId, ratio) {
  const runtime = new NaturalLocomotionRuntimeV1({ bodyDNA, sampleRate: 60 });
  const execution = runtime.loadScenario(scenarioId);
  return runtime.sample(execution.duration * ratio).finalPose;
}

function findSupportPose(bodyDNA, requestedSide) {
  const runtime = new NaturalLocomotionRuntimeV1({ bodyDNA, sampleRate: 120 });
  const execution = runtime.loadScenario('walk-forward-3m');
  let fallback = null;
  for (let index = 0; index <= Math.ceil(execution.duration * 120); index += 1) {
    const frame = runtime.sample(Math.min(execution.duration, index / 120));
    fallback = frame.finalPose;
    if (frame.contactState.supportState === requestedSide) return frame.finalPose;
  }
  return fallback;
}

function withStableFootContacts(pose) {
  const localRotations = { ...pose.localRotations };
  for (const side of ['left', 'right']) {
    const upper = localRotations[`${side}UpperLeg`] ?? [0, 0, 0, 1];
    const lower = localRotations[`${side}LowerLeg`] ?? [0, 0, 0, 1];
    localRotations[`${side}Foot`] = inverseQuaternion(multiplyQuaternions(upper, lower));
  }
  return createPoseFrameV4({
    ...pose,
    localRotations,
    contacts: [
      { jointId: 'leftFoot', side: 'left', active: true, role: 'foot-plant', source: 'task17a3-static-fixture' },
      { jointId: 'rightFoot', side: 'right', active: true, role: 'foot-plant', source: 'task17a3-static-fixture' },
    ],
    constraintState: {
      ...pose.constraintState,
      task17a3Fixture: 'jump-preload',
      stableDoubleSupport: true,
      implementsJump: false,
    },
  });
}

function fixture(poseId, finalPose, metadata = {}) {
  return {
    schema: 'humanoid_rig/task17a3_production_rig_scenario@1.0',
    poseId,
    finalPose,
    deterministic: true,
    staticFixture: true,
    writesFinalPose: false,
    ...metadata,
  };
}
