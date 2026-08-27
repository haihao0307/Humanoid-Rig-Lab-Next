import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createBodyDNA } from '../src/modules/human-core-v5/body-dna-v5.js';
import { createHumanRigCoreV5 } from '../src/modules/human-core-v5/human-rig-core-v5.js';
import { createProceduralSimulationRigFrameV5 } from '../src/modules/human-core-v5/procedural-deform/procedural-simulation-rig-fk-v5.js';
import {
  NATURAL_MOTION_SCENARIO_IDS_V1,
  NaturalLocomotionRuntimeV1,
} from '../src/modules/human-core-v5/motion-execution-v1/natural-locomotion-runtime-v1.js';
import {
  analyzeMotionScenarioV1,
  areBehaviorPlanExecutionsEquivalentV1,
  compareTurnMirrorErrorV1,
} from '../src/modules/human-core-v5/motion-execution-v1/motion-quality-metrics-v1.js';
import { areBehaviorPlansEquivalentV1 } from '../src/modules/human-core-v5/motion-execution-v1/behavior-plan-v1.js';

const SAMPLE_RATE = 30;
const OUTPUT_DIRECTORY = resolve('artifacts/qa/task17a-natural-motion');
const bodyDNA = createBodyDNA({
  bodyDNAId: 'task17a-natural-motion-reference',
  identity: { humanId: 'task17a-natural-motion-reference', label: 'Task 17A Reference Human' },
  proportionRevision: 17,
});
const rigCore = createHumanRigCoreV5({ bodyDNA });
const traces = {};

for (const scenarioId of NATURAL_MOTION_SCENARIO_IDS_V1) {
  const runtime = new NaturalLocomotionRuntimeV1({ bodyDNA, sampleRate: SAMPLE_RATE });
  const execution = runtime.loadScenario(scenarioId);
  const frameCount = Math.ceil(execution.duration * SAMPLE_RATE);
  const frames = [];
  let maximumBoneLengthError = 0;
  let referenceBoneLengths = null;
  for (let index = 0; index <= frameCount; index += 1) {
    const time = Math.min(execution.duration, index / SAMPLE_RATE);
    const frame = runtime.sample(time);
    const simulationRig = createProceduralSimulationRigFrameV5({ finalPose: frame.finalPose, rigCore, bodyDNA });
    const lengths = boneLengths(simulationRig);
    if (!referenceBoneLengths) referenceBoneLengths = lengths;
    for (const [segmentId, length] of Object.entries(lengths)) {
      maximumBoneLengthError = Math.max(maximumBoneLengthError, Math.abs(length - referenceBoneLengths[segmentId]));
    }
    frames.push(frame);
  }
  traces[scenarioId] = { execution, frames, maximumBoneLengthError };
}

const mirrorErrors = {
  90: compareTurnMirrorErrorV1(traces['turn-left-90'].frames, traces['turn-right-90'].frames),
  180: compareTurnMirrorErrorV1(traces['turn-left-180'].frames, traces['turn-right-180'].frames),
};
const scenarioMetrics = NATURAL_MOTION_SCENARIO_IDS_V1.map((scenarioId) => analyzeMotionScenarioV1({
  scenarioId,
  execution: traces[scenarioId].execution,
  frames: traces[scenarioId].frames,
  maximumBoneLengthError: traces[scenarioId].maximumBoneLengthError,
  leftRightMirrorError: scenarioId.endsWith('-90') ? mirrorErrors[90]
    : scenarioId.endsWith('-180') ? mirrorErrors[180] : null,
}));

const commandA = traces['instruction-command-a'];
const commandB = traces['instruction-command-b'];
const behaviorPlansEquivalent = areBehaviorPlansEquivalentV1(commandA.execution.behaviorPlan, commandB.execution.behaviorPlan);
const executionsEquivalent = areBehaviorPlanExecutionsEquivalentV1(commandA.frames, commandB.frames);
assert.equal(behaviorPlansEquivalent, true, 'Command A and B must produce equivalent BehaviorPlans.');
assert.equal(executionsEquivalent, true, 'Command A and B must produce equivalent final execution.');
for (const metrics of scenarioMetrics) {
  assert.equal(metrics.gates.numericPassed, true, `${metrics.scenarioId} numeric gates failed.`);
}

const metricsReport = {
  schema: 'humanoid_rig/task17a_natural_motion_metrics@1.0',
  task: 'Task 17A Human Core Natural Motion Execution Foundation',
  sampleRate: SAMPLE_RATE,
  authorityChain: traces['instruction-command-a'].execution.authorityChain,
  generalNaturalLanguageSupport: false,
  developmentGrammarOnly: true,
  behaviorPlansEquivalent,
  executionsEquivalent,
  mirrorErrors,
  scenarioCount: scenarioMetrics.length,
  numericPassedScenarioCount: scenarioMetrics.filter((item) => item.gates.numericPassed).length,
  scenarios: scenarioMetrics,
  visualEvidence: {
    browserCapturePerformedByCodex: false,
    requiredVideoCount: 6,
    generatedVideoCount: 0,
    requiredKeyFrameCount: 12,
    generatedKeyFrameCount: 0,
    visualReviewStatus: 'pending-user-browser-qa',
  },
  acceptanceState: {
    visualAcceptance: false,
    productionReady: false,
    userVisualAcceptance: 'pending',
  },
  finalConclusion: 'INCONCLUSIVE',
  conclusionReason: 'Numeric execution foundation passes, but AGENTS.md reserves real browser video, screenshots, and visual naturalness review for the user.',
};

const frameTrace = {
  schema: 'humanoid_rig/task17a_final_pose_sequence@1.0',
  sampleRate: SAMPLE_RATE,
  scenarios: Object.fromEntries(Object.entries(traces).map(([scenarioId, trace]) => [scenarioId, {
    duration: trace.execution.duration,
    frameCount: trace.frames.length,
    frames: trace.frames.map((frame) => ({
      timestamp: frame.timestamp,
      currentStep: frame.currentStep,
      motionPhase: frame.motionPhase,
      finalPose: frame.finalPose,
      rootMetrics: frame.rootMetrics,
      jointMetrics: frame.jointMetrics,
      motionSignals: frame.motionSignals,
      completionStatus: frame.completionStatus,
    })),
  }])),
};

const contactTrace = {
  schema: 'humanoid_rig/task17a_contact_trace@1.0',
  sampleRate: SAMPLE_RATE,
  scenarios: Object.fromEntries(Object.entries(traces).map(([scenarioId, trace]) => [scenarioId, trace.frames.map((frame) => ({
    timestamp: frame.timestamp,
    motionPhase: frame.motionPhase,
    supportState: frame.contactState.supportState,
    leftFootState: frame.contactState.leftFootState,
    rightFootState: frame.contactState.rightFootState,
    activeStep: frame.contactState.activeStep,
    transition: frame.contactState.transition,
    feet: frame.contactState.feet,
    contacts: frame.contactState.contacts,
  }))])),
};

const balanceTrace = {
  schema: 'humanoid_rig/task17a_balance_trace@1.0',
  sampleRate: SAMPLE_RATE,
  scenarios: Object.fromEntries(Object.entries(traces).map(([scenarioId, trace]) => [scenarioId, trace.frames.map((frame) => ({
    timestamp: frame.timestamp,
    supportState: frame.balanceState.supportState,
    centerOfMass: frame.balanceState.centerOfMass,
    centerOfMassProjection: frame.balanceState.centerOfMassProjection,
    supportPolygon: frame.balanceState.supportPolygon,
    comInsideSupport: frame.balanceState.comInsideSupport,
    balanceRecoveryCount: frame.balanceState.balanceRecoveryCount,
    supportTransitionCount: frame.balanceState.supportTransitionCount,
    fallDetected: frame.balanceState.fallDetected,
  }))])),
};

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
await Promise.all([
  writeJson('behavior-plan-a.json', {
    schema: 'humanoid_rig/task17a_behavior_plan_evidence@1.0',
    command: commandA.execution.command,
    normalizedPlan: commandA.execution.behaviorPlan,
    equivalentToCommandB: behaviorPlansEquivalent,
  }),
  writeJson('behavior-plan-b.json', {
    schema: 'humanoid_rig/task17a_behavior_plan_evidence@1.0',
    command: commandB.execution.command,
    normalizedPlan: commandB.execution.behaviorPlan,
    equivalentToCommandA: behaviorPlansEquivalent,
  }),
  writeJson('metrics.json', metricsReport),
  writeJson('frame-trace.json', frameTrace),
  writeJson('contact-trace.json', contactTrace),
  writeJson('balance-trace.json', balanceTrace),
]);

console.log(`PASS Task 17A numeric motion metrics: ${scenarioMetrics.length}/${scenarioMetrics.length} scenarios, A/B plans equivalent, finalPose FK bone lengths fixed.`);

function boneLengths(frame) {
  return Object.fromEntries(frame.segments.map(({ parentId, jointId }) => {
    const parent = frame.joints[parentId];
    const joint = frame.joints[jointId];
    return [`${parentId}->${jointId}`, Math.hypot(
      joint.worldPosition[0] - parent.worldPosition[0],
      joint.worldPosition[1] - parent.worldPosition[1],
      joint.worldPosition[2] - parent.worldPosition[2],
    )];
  }));
}

async function writeJson(name, value) {
  await writeFile(resolve(OUTPUT_DIRECTORY, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
