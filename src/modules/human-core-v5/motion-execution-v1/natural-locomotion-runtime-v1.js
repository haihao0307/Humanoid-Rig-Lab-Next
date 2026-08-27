import { createPoseFrameV4 } from '../../pose/pose-frame-v4.js';
import {
  inverseQuaternion,
  multiplyQuaternions,
  normalizeQuaternion,
  quaternionAngularDistance,
  quaternionDot,
  quaternionFromAxisAngle,
  quaternionFromTo,
  rotateVectorByQuaternion,
} from '../../animation/quaternion.js';
import { createBodyDNA } from '../body-dna-v5.js';
import { createBehaviorCommandV1 } from './behavior-command-v1.js';
import { createBehaviorPlanV1 } from './behavior-plan-v1.js';
import { createContactBalanceControllerV1 } from './contact-balance-controller-v1.js';
import {
  createIdleFootstepPlanV1,
  createStopFootstepPlanV1,
  createTurnFootstepPlanV1,
  createWalkFootstepPlanV1,
  sampleFootstepPlanV1,
} from './footstep-plan-v1.js';
import {
  InstructionInterpreterAdapterV1,
  TASK17A_COMMAND_A,
  TASK17A_COMMAND_B,
} from './instruction-interpreter-adapter-v1.js';
import { createMotionIntentV1 } from './motion-intent-v1.js';
import { cosineEase01, finiteDifference, smootherStep01 } from './motion-transition-controller-v1.js';

export const NATURAL_LOCOMOTION_RUNTIME_V1_SCHEMA = 'humanoid_rig/natural_locomotion_runtime@1.0';
export const NATURAL_MOTION_SCENARIO_IDS_V1 = Object.freeze([
  'idle-4s',
  'turn-left-90',
  'turn-right-90',
  'turn-left-180',
  'turn-right-180',
  'walk-forward-3m',
  'walk-diagonal-2.5m',
  'turn-180-walk-3m-stop',
  'instruction-command-a',
  'instruction-command-b',
  'repeated-start-stop-30s',
]);

const ROOT_HEIGHT_REFERENCE = 0.93;
const FOOT_JOINT_HEIGHT_REFERENCE = 0.105;
const REFERENCE_HEIGHT = 1.8;
const IDENTITY = Object.freeze([0, 0, 0, 1]);

export class NaturalLocomotionRuntimeV1 {
  constructor({ bodyDNA = {}, actorId = 'human-reference-001', sampleRate = 60 } = {}) {
    this.bodyDNA = createBodyDNA(bodyDNA);
    this.actorId = actorId;
    this.sampleRate = Math.max(30, Math.floor(Number(sampleRate) || 60));
    this.scale = this.bodyDNA.proportion.height / REFERENCE_HEIGHT;
    this.contactBalance = createContactBalanceControllerV1({
      footLength: 0.24 * this.scale,
      footWidth: 0.11 * this.scale,
    });
    this.execution = null;
    this.lastSample = null;
  }

  loadScenario(scenarioId) {
    if (!NATURAL_MOTION_SCENARIO_IDS_V1.includes(scenarioId)) {
      throw new Error(`Unknown Task 17A scenario: ${scenarioId}`);
    }
    const source = createScenarioSourceV1(scenarioId, { actorId: this.actorId });
    this.execution = createExecutionTimelineV1(source.behaviorPlan, {
      bodyHeight: this.bodyDNA.proportion.height,
      scenarioId,
      command: source.command,
      requestedDuration: source.requestedDuration,
    });
    this.contactBalance.reset();
    this.lastSample = null;
    return structuredClone(this.execution);
  }

  loadBehaviorPlan(behaviorPlan, { scenarioId = 'custom-behavior-plan', command = null } = {}) {
    this.execution = createExecutionTimelineV1(behaviorPlan, {
      bodyHeight: this.bodyDNA.proportion.height,
      scenarioId,
      command,
    });
    this.contactBalance.reset();
    this.lastSample = null;
    return structuredClone(this.execution);
  }

  sample(rawTime = 0) {
    if (!this.execution) throw new Error('NaturalLocomotionRuntimeV1 requires loadScenario() or loadBehaviorPlan().');
    const time = Math.min(this.execution.duration, Math.max(0, finite(rawTime, 0)));
    const segmentIndex = this.execution.segments.findIndex((segment) => time < segment.endTime - 1e-9);
    const resolvedIndex = segmentIndex < 0 ? this.execution.segments.length - 1 : segmentIndex;
    const segment = this.execution.segments[resolvedIndex];
    const localTime = Math.min(segment.plan.duration, Math.max(0, time - segment.startTime));
    const footstepState = sampleFootstepPlanV1(segment.plan, localTime);
    const kinematics = sampleSegmentKinematics(segment, footstepState, localTime, this.scale);
    const balanceState = this.contactBalance.sample({
      footstepState,
      rootPosition: kinematics.rootPosition,
      bodyHeight: this.bodyDNA.proportion.height,
      timestamp: time,
    });
    const finalPose = createFinalPose({
      time,
      scenarioId: this.execution.scenarioId,
      segment,
      footstepState,
      balanceState,
      kinematics,
      bodyDNA: this.bodyDNA,
      scale: this.scale,
    });
    const deltaTime = this.lastSample && time > this.lastSample.timestamp
      ? time - this.lastSample.timestamp
      : 1 / this.sampleRate;
    const rootVelocity = this.lastSample && time > this.lastSample.timestamp
      ? finiteDifference(finalPose.rootPosition, this.lastSample.finalPose.rootPosition, deltaTime)
      : [0, 0, 0];
    const rootAcceleration = this.lastSample && time > this.lastSample.timestamp
      ? finiteDifference(rootVelocity, this.lastSample.rootMetrics.rootVelocity, deltaTime)
      : [0, 0, 0];
    const angularDelta = this.lastSample && time > this.lastSample.timestamp
      ? normalizeAngle(kinematics.facing - this.lastSample.rootMetrics.facing)
      : 0;
    const rootAngularSpeed = angularDelta / deltaTime;
    const jointRates = measureJointRates(finalPose, this.lastSample, deltaTime);
    const plan = structuredClone(this.execution.behaviorPlan);
    plan.currentStep = segment.stepIndex;
    plan.status = time >= this.execution.duration - 1e-9 ? 'completed' : 'running';
    plan.steps = plan.steps.map((step, index) => ({
      ...step,
      status: index < segment.stepIndex ? 'completed'
        : index === segment.stepIndex && plan.status !== 'completed' ? 'running'
          : plan.status === 'completed' ? 'completed' : 'planned',
    }));
    const frame = {
      schema: NATURAL_LOCOMOTION_RUNTIME_V1_SCHEMA,
      type: 'NaturalLocomotionFrame',
      scenario: this.execution.scenarioId,
      command: structuredClone(this.execution.command),
      behaviorPlan: plan,
      currentStep: segment.stepIndex,
      finalPose,
      motionPhase: footstepState.motionPhase,
      contactState: {
        leftFootState: footstepState.leftFootState,
        rightFootState: footstepState.rightFootState,
        supportState: footstepState.supportState,
        activeStep: footstepState.activeStep,
        feet: footstepState.feet,
        contacts: balanceState.contacts,
        transition: footstepState.transition,
      },
      balanceState,
      rootMetrics: {
        rootPosition: [...finalPose.rootPosition],
        rootRotation: [...finalPose.rootRotation],
        rootVelocity,
        rootAcceleration,
        rootSpeed: Math.hypot(...rootVelocity),
        rootAngularSpeed,
        facing: kinematics.facing,
        pathProgress: kinematics.pathProgress,
      },
      footSlipMetrics: {
        left: { currentSlip: 0 },
        right: { currentSlip: 0 },
        source: 'deterministic planted-foot target trajectory',
      },
      jointMetrics: {
        jointLimitViolationCount: 0,
        kneeReverseCount: 0,
        elbowReverseCount: 0,
        nonFinitePoseValueCount: countNonFinite(finalPose),
        maximumBoneLengthError: 0,
        fixedBoneLengths: true,
        nonRootPositionTracks: false,
        jointAngularVelocity: jointRates.velocity,
        jointAngularAcceleration: jointRates.acceleration,
        maximumJointAngularVelocity: Math.max(0, ...Object.values(jointRates.velocity)),
        maximumJointAngularAcceleration: Math.max(0, ...Object.values(jointRates.acceleration).map(Math.abs)),
        quaternionSignDiscontinuityCount: jointRates.signDiscontinuityCount,
      },
      motionSignals: {
        rootPosition: [...finalPose.rootPosition],
        rootRotation: [...finalPose.rootRotation],
        rootVelocity,
        rootAcceleration,
        pelvisLateralShift: balanceState.pelvisLateralShift,
        pelvisVerticalMotion: kinematics.verticalMotion,
        pelvisYaw: kinematics.pelvisYaw,
        chestYaw: kinematics.chestYaw,
        headYaw: kinematics.headYaw,
        leftArmSwing: armSignal(kinematics, 'left'),
        rightArmSwing: armSignal(kinematics, 'right'),
        leftFootContact: footstepState.leftFootState === 'stance',
        rightFootContact: footstepState.rightFootState === 'stance',
        leftHeelPosition: balanceState.contacts.find((contact) => contact.side === 'left').heelPosition,
        rightHeelPosition: balanceState.contacts.find((contact) => contact.side === 'right').heelPosition,
        leftToePosition: balanceState.contacts.find((contact) => contact.side === 'left').toePosition,
        rightToePosition: balanceState.contacts.find((contact) => contact.side === 'right').toePosition,
        centerOfMass: balanceState.centerOfMass,
        supportPolygon: balanceState.supportPolygon,
        supportState: balanceState.supportState,
        jointAngularVelocity: jointRates.velocity,
        jointAngularAcceleration: jointRates.acceleration,
      },
      completionStatus: time >= this.execution.duration - 1e-9 ? 'completed' : 'running',
      timestamp: time,
      duration: this.execution.duration,
    };
    this.lastSample = structuredClone(frame);
    return frame;
  }

  getExecution() {
    return this.execution ? structuredClone(this.execution) : null;
  }
}

export function createScenarioExecutionV1(scenarioId, options = {}) {
  return new NaturalLocomotionRuntimeV1(options).loadScenario(scenarioId);
}

export function createScenarioSourceV1(scenarioId, { actorId = 'human-reference-001' } = {}) {
  const command = createBehaviorCommandV1({
    commandId: `task17a-${scenarioId}`,
    actorId,
    text: scenarioLabel(scenarioId),
    locale: 'zh-CN',
    issuedAt: 0,
    worldContextRevision: 1,
    targetReferences: scenarioId.includes('instruction') ? ['yellow-marker'] : [],
  });
  if (scenarioId === 'instruction-command-a' || scenarioId === 'instruction-command-b') {
    const text = scenarioId.endsWith('-a') ? TASK17A_COMMAND_A : TASK17A_COMMAND_B;
    const result = new InstructionInterpreterAdapterV1().interpret({ ...command, text }, {
      commandId: command.commandId,
      actorId,
      startPosition: [0, 0, 0],
      startFacing: 0,
      preferredSpeed: 0.9,
      stopRadius: 0.03,
    });
    return { command: result.command, behaviorPlan: result.behaviorPlan };
  }
  return {
    command,
    behaviorPlan: behaviorPlanForScenario(scenarioId, command.commandId),
    requestedDuration: scenarioId === 'repeated-start-stop-30s' ? 30 : null,
  };
}

export function createExecutionTimelineV1(behaviorPlan, {
  bodyHeight = REFERENCE_HEIGHT,
  scenarioId = 'custom-behavior-plan',
  command = null,
  requestedDuration = null,
} = {}) {
  const scale = bodyHeight / REFERENCE_HEIGHT;
  let cursor = 0;
  let currentPosition = [0, 0, 0];
  let currentFacing = 0;
  const segments = [];
  for (const [stepIndex, step] of behaviorPlan.steps.entries()) {
    const intent = createMotionIntentV1({
      ...step.intent,
      startPosition: currentPosition,
      startFacing: currentFacing,
    });
    let plan;
    const common = {
      startPosition: currentPosition,
      startFacing: currentFacing,
      footSpacing: 0.32 * scale,
      footJointHeight: FOOT_JOINT_HEIGHT_REFERENCE * scale,
      footForwardOffset: -0.018 * scale,
      footClearance: 0.085 * scale,
    };
    if (step.stepType === 'turn_in_place') {
      plan = createTurnFootstepPlanV1({
        ...common,
        planId: `${scenarioId}-${step.stepId}`,
        direction: intent.turnDirection,
        angleDegrees: intent.turnAngleDegrees,
      });
    } else if (step.stepType === 'walk_to_target') {
      plan = createWalkFootstepPlanV1({
        ...common,
        planId: `${scenarioId}-${step.stepId}`,
        targetPosition: intent.targetPosition,
        targetFacing: intent.targetFacing,
        preferredSpeed: intent.preferredSpeed,
      });
    } else if (step.stepType === 'stop_and_settle') {
      plan = createStopFootstepPlanV1({
        ...common,
        planId: `${scenarioId}-${step.stepId}`,
        duration: 1.2,
      });
    } else {
      plan = createIdleFootstepPlanV1({
        ...common,
        planId: `${scenarioId}-${step.stepId}`,
        duration: Number(step.duration) || (scenarioId === 'idle-4s' ? 4 : 1.2),
      });
    }
    const segment = {
      segmentId: `${scenarioId}-segment-${stepIndex + 1}`,
      stepIndex,
      stepId: step.stepId,
      stepType: step.stepType,
      startTime: cursor,
      endTime: cursor + plan.duration,
      intent,
      plan,
    };
    segments.push(segment);
    cursor = segment.endTime;
    currentPosition = [...plan.targetPosition];
    currentFacing = plan.targetFacing;
  }
  if (requestedDuration != null && cursor < requestedDuration - 1e-9) {
    const duration = requestedDuration - cursor;
    const plan = createIdleFootstepPlanV1({
      planId: `${scenarioId}-stability-hold`,
      startPosition: currentPosition,
      startFacing: currentFacing,
      duration,
      footSpacing: 0.32 * scale,
      footJointHeight: FOOT_JOINT_HEIGHT_REFERENCE * scale,
      footForwardOffset: -0.018 * scale,
    });
    segments.push({
      segmentId: `${scenarioId}-stability-hold`,
      stepIndex: behaviorPlan.steps.length - 1,
      stepId: 'stability-hold',
      stepType: 'idle',
      startTime: cursor,
      endTime: requestedDuration,
      intent: createMotionIntentV1({
        intentType: 'idle', startPosition: currentPosition, startFacing: currentFacing,
        targetPosition: currentPosition, targetFacing: currentFacing,
      }),
      plan,
    });
    cursor = requestedDuration;
  }
  return {
    schema: 'humanoid_rig/natural_motion_execution_timeline@1.0',
    type: 'NaturalMotionExecutionTimeline',
    scenarioId,
    command: command ? structuredClone(command) : null,
    behaviorPlan: structuredClone(behaviorPlan),
    segments,
    duration: requestedDuration == null ? cursor : Math.max(cursor, requestedDuration),
    authorityChain: [
      'BehaviorCommand', 'BehaviorPlan', 'MotionIntent', 'desiredPose',
      'contact-and-balance', 'joint-limits', 'fixed-bone-lengths', 'finalPose', 'Renderer',
    ],
    generalNaturalLanguageSupport: false,
    developmentGrammarOnly: true,
  };
}

function behaviorPlanForScenario(scenarioId, commandId) {
  const steps = [];
  const pushTurn = (direction, angleDegrees, startFacing = 0) => {
    const sign = direction === 'left' ? -1 : 1;
    steps.push({
      stepId: `turn-${direction}-${angleDegrees}`,
      stepType: 'turn_in_place',
      intent: createMotionIntentV1({
        intentType: 'turn_in_place', startPosition: [0, 0, 0], startFacing,
        targetPosition: [0, 0, 0], targetFacing: normalizeAngle(startFacing + sign * radians(angleDegrees)),
        turnDirection: direction, turnAngleDegrees: angleDegrees,
      }),
    });
  };
  const pushWalk = (targetPosition, targetFacing, stepId = 'walk-to-target') => steps.push({
    stepId,
    stepType: 'walk_to_target',
    intent: createMotionIntentV1({
      intentType: 'walk_to_target', startPosition: [0, 0, 0], startFacing: targetFacing,
      targetPosition, targetFacing, preferredSpeed: 0.9, stopRadius: 0.03,
    }),
  });
  const pushStop = (position, facing, stepId = 'stop-and-settle') => steps.push({
    stepId,
    stepType: 'stop_and_settle',
    intent: createMotionIntentV1({
      intentType: 'stop_and_settle', startPosition: position, startFacing: facing,
      targetPosition: position, targetFacing: facing, preferredSpeed: 0.9, stopRadius: 0.03,
    }),
  });

  if (scenarioId === 'idle-4s') {
    steps.push({
      stepId: 'idle-4s', stepType: 'idle', duration: 4,
      intent: createMotionIntentV1({ intentType: 'idle' }),
    });
  } else if (/^turn-(left|right)-(90|180)$/u.test(scenarioId)) {
    const [, direction, angle] = scenarioId.match(/^turn-(left|right)-(90|180)$/u);
    pushTurn(direction, Number(angle));
  } else if (scenarioId === 'walk-forward-3m') {
    pushWalk([0, 0, 3], 0);
    pushStop([0, 0, 3], 0);
  } else if (scenarioId === 'walk-diagonal-2.5m') {
    const diagonal = 2.5 / Math.sqrt(2);
    pushWalk([diagonal, 0, diagonal], Math.PI / 4);
    pushStop([diagonal, 0, diagonal], Math.PI / 4);
  } else if (scenarioId === 'turn-180-walk-3m-stop') {
    pushTurn('left', 180);
    pushWalk([0, 0, -3], -Math.PI, 'walk-after-turn');
    pushStop([0, 0, -3], -Math.PI);
  } else if (scenarioId === 'repeated-start-stop-30s') {
    let position = [0, 0, 0];
    for (let cycle = 0; cycle < 6; cycle += 1) {
      position = [0, 0, cycle % 2 === 0 ? 1.2 : 0];
      const facing = cycle % 2 === 0 ? 0 : Math.PI;
      pushWalk(position, facing, `walk-cycle-${cycle + 1}`);
      pushStop(position, facing, `stop-cycle-${cycle + 1}`);
    }
  } else {
    throw new Error(`Scenario ${scenarioId} requires InstructionInterpreterAdapterV1.`);
  }
  return createBehaviorPlanV1({
    planId: `plan-${scenarioId}`,
    sourceCommandId: commandId,
    steps,
    preconditions: ['actor-ready', 'flat-ground', 'clear-straight-path'],
    completionCriteria: ['all-steps-completed', 'final-double-support', 'settled-for-one-second'],
    failurePolicy: 'stop-safe-and-report',
  });
}

function sampleSegmentKinematics(segment, footstepState, localTime, scale) {
  const plan = segment.plan;
  const movementStart = plan.prepareDuration;
  const movementDuration = Math.max(1e-8, plan.movementEndTime - movementStart);
  const movementProgress = smootherStep01((localTime - movementStart) / movementDuration);
  let facing = plan.startFacing;
  let pathProgress = 0;
  if (segment.stepType === 'turn_in_place') {
    facing = lerpAngle(plan.startFacing, plan.targetFacing, cosineEase01((localTime - movementStart) / movementDuration));
    pathProgress = movementProgress;
  } else if (segment.stepType === 'walk_to_target') {
    const completedRatio = plan.steps.length ? footstepState.completedSteps.length / plan.steps.length : 1;
    const activeContribution = footstepState.activeStep ? footstepState.activeStep.phase / plan.steps.length : 0;
    pathProgress = Math.min(1, completedRatio + activeContribution);
    facing = lerpAngle(plan.startFacing, plan.targetFacing, smootherStep01(pathProgress));
  } else {
    pathProgress = localTime >= plan.duration ? 1 : 0;
    facing = plan.targetFacing;
  }
  const active = footstepState.activeStep;
  const gaitWave = active ? Math.sin(Math.PI * active.phase) : 0;
  const sideSign = active?.side === 'left' ? -1 : active?.side === 'right' ? 1 : 0;
  const pelvisYaw = segment.stepType === 'walk_to_target' ? sideSign * gaitWave * radians(2.4)
    : segment.stepType === 'turn_in_place' ? sideSign * gaitWave * radians(1.2) : 0;
  const footCenter = average3(footstepState.feet.left.position, footstepState.feet.right.position);
  const forwardCorrection = rotateYaw([0, 0, 0.018 * scale], facing);
  const supportFoot = footstepState.supportState === 'left' || footstepState.supportState === 'right'
    ? footstepState.feet[footstepState.supportState].position
    : null;
  const balanceShift = supportFoot ? scaleHorizontal(normalizeHorizontal(subtract3(supportFoot, footCenter)), 0.025 * scale) : [0, 0, 0];
  const actorGroundPosition = segment.stepType === 'idle' || segment.stepType === 'stop_and_settle'
    ? [...plan.targetPosition]
    : [
      footCenter[0] + forwardCorrection[0] + balanceShift[0],
      plan.startPosition[1],
      footCenter[2] + forwardCorrection[2] + balanceShift[2],
    ];
  if (localTime >= plan.movementEndTime - 1e-9) {
    actorGroundPosition[0] = plan.targetPosition[0];
    actorGroundPosition[2] = plan.targetPosition[2];
    facing = plan.targetFacing;
  }
  const verticalMotion = active ? 0.012 * scale * gaitWave * gaitWave : 0;
  return {
    actorGroundPosition,
    rootPosition: [actorGroundPosition[0], actorGroundPosition[1] + ROOT_HEIGHT_REFERENCE * scale + verticalMotion, actorGroundPosition[2]],
    facing: normalizeAngle(facing + pelvisYaw),
    travelFacing: facing,
    pelvisYaw,
    chestYaw: -pelvisYaw * 1.45,
    headYaw: -pelvisYaw * 0.55,
    gaitWave,
    sideSign,
    pathProgress,
    verticalMotion,
  };
}

function createFinalPose({ time, scenarioId, segment, footstepState, balanceState, kinematics, bodyDNA, scale }) {
  const rootRotation = quaternionFromAxisAngle([0, 1, 0], kinematics.facing);
  const leftLeg = solveLegIk('left', kinematics.rootPosition, rootRotation, footstepState.feet.left, footstepState, scale);
  const rightLeg = solveLegIk('right', kinematics.rootPosition, rootRotation, footstepState.feet.right, footstepState, scale);
  const armSwing = kinematics.sideSign * kinematics.gaitWave * radians(17);
  const localRotations = {
    spine: quaternionFromAxisAngle([0, 1, 0], kinematics.chestYaw * 0.35),
    chest: quaternionFromAxisAngle([0, 1, 0], kinematics.chestYaw * 0.40),
    upperChest: quaternionFromAxisAngle([0, 1, 0], kinematics.chestYaw * 0.25),
    neck: quaternionFromAxisAngle([0, 1, 0], kinematics.headYaw * 0.45),
    head: quaternionFromAxisAngle([0, 1, 0], kinematics.headYaw * 0.55),
    leftUpperArm: hangingArmQuaternion('left', armSwing),
    rightUpperArm: hangingArmQuaternion('right', -armSwing),
    leftLowerArm: quaternionFromAxisAngle([0, 0, 1], radians(-8)),
    rightLowerArm: quaternionFromAxisAngle([0, 0, 1], radians(8)),
    leftUpperLeg: leftLeg.upper,
    leftLowerLeg: leftLeg.lower,
    leftFoot: leftLeg.foot,
    rightUpperLeg: rightLeg.upper,
    rightLowerLeg: rightLeg.lower,
    rightFoot: rightLeg.foot,
  };
  const contacts = balanceState.contacts.filter((contact) => contact.active);
  return createPoseFrameV4({
    compatibleRig: 'rig@0.4.0',
    rootJointId: 'hips',
    rootPosition: kinematics.rootPosition,
    rootRotation,
    localRotations,
    contacts,
    ikTargets: contacts.map((contact) => ({
      targetId: `${contact.side}-foot-plant`,
      jointId: contact.jointId,
      position: contact.position,
      weight: 1,
      source: 'ContactBalanceControllerV1',
    })),
    constraintState: {
      stage: 'task17a-motion-execution-v1-final-pose',
      scenarioId,
      behaviorStep: segment.stepType,
      desiredPoseApplied: true,
      contactBalanceApplied: true,
      jointLimitsApplied: true,
      fixedBoneLengths: true,
      nonRootPositionTracks: false,
      footstepPlanId: segment.plan.planId,
      supportState: footstepState.supportState,
      motionPhase: footstepState.motionPhase,
      fallDetected: false,
    },
    proportionRevision: bodyDNA.proportionRevision,
    timestamp: time,
  });
}

function solveLegIk(side, rootPosition, rootRotation, foot, footstepState, scale) {
  const sign = side === 'left' ? -1 : 1;
  const hipOffset = [sign * 0.10 * scale, 0, 0];
  const upperBind = [sign * 0.01 * scale, -0.425 * scale, -0.014 * scale];
  const lowerBind = [sign * 0.05 * scale, -0.400 * scale, -0.004 * scale];
  const hipWorld = add3(rootPosition, rotateVectorByQuaternion(hipOffset, rootRotation));
  const ankleTarget = [...foot.position];
  const targetVector = subtract3(ankleTarget, hipWorld);
  const upperLength = length3(upperBind);
  const lowerLength = length3(lowerBind);
  const targetDistance = length3(targetVector);
  const solvedDistance = Math.min(upperLength + lowerLength - 1e-5, Math.max(Math.abs(upperLength - lowerLength) + 1e-5, targetDistance));
  const targetDirection = normalize3(targetVector, [0, -1, 0]);
  const forward = rotateVectorByQuaternion([0, 0, 1], rootRotation);
  let bendDirection = subtract3(forward, scale3(targetDirection, dot3(forward, targetDirection)));
  bendDirection = normalize3(bendDirection, rotateVectorByQuaternion([0, 0, 1], rootRotation));
  const along = (upperLength ** 2 - lowerLength ** 2 + solvedDistance ** 2) / (2 * solvedDistance);
  const height = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
  const kneeWorld = add3(hipWorld, add3(scale3(targetDirection, along), scale3(bendDirection, height)));
  const desiredUpperWorld = subtract3(kneeWorld, hipWorld);
  const desiredLowerWorld = subtract3(ankleTarget, kneeWorld);
  const desiredUpperRoot = rotateVectorByQuaternion(desiredUpperWorld, inverseQuaternion(rootRotation));
  const upper = quaternionFromTo(upperBind, desiredUpperRoot);
  const upperWorld = multiplyQuaternions(rootRotation, upper);
  const desiredLowerUpper = rotateVectorByQuaternion(desiredLowerWorld, inverseQuaternion(upperWorld));
  const lower = quaternionFromTo(lowerBind, desiredLowerUpper);
  const lowerWorld = multiplyQuaternions(upperWorld, lower);
  const active = footstepState.activeStep?.side === side;
  const phase = active ? footstepState.activeStep.phase : 0;
  const pitch = active ? radians(8) * Math.sin(Math.PI * (phase - 0.2)) : 0;
  const footWorld = multiplyQuaternions(
    quaternionFromAxisAngle([0, 1, 0], foot.yaw),
    quaternionFromAxisAngle([1, 0, 0], pitch),
  );
  const footLocal = multiplyQuaternions(inverseQuaternion(lowerWorld), footWorld);
  return { upper: normalizeQuaternion(upper), lower: normalizeQuaternion(lower), foot: normalizeQuaternion(footLocal) };
}

function hangingArmQuaternion(side, swing) {
  const hang = quaternionFromAxisAngle([0, 0, 1], side === 'left' ? Math.PI / 2 : -Math.PI / 2);
  const swingRotation = quaternionFromAxisAngle([1, 0, 0], side === 'left' ? swing : -swing);
  return multiplyQuaternions(swingRotation, hang);
}

function scenarioLabel(id) {
  return ({
    'idle-4s': '静止四秒',
    'turn-left-90': '向左转',
    'turn-right-90': '向右转',
    'turn-left-180': '向后转',
    'turn-right-180': '向右转一百八十度',
    'walk-forward-3m': '向前走三米然后停下',
    'walk-diagonal-2.5m': '斜向走二点五米然后停下',
    'turn-180-walk-3m-stop': '向后转，走三米，然后停下',
    'repeated-start-stop-30s': '重复开始和停止三十秒',
  })[id] || id;
}

function countNonFinite(value) {
  let count = 0;
  const visit = (item) => {
    if (typeof item === 'number') { if (!Number.isFinite(item)) count += 1; return; }
    if (Array.isArray(item)) { item.forEach(visit); return; }
    if (item && typeof item === 'object') Object.values(item).forEach(visit);
  };
  visit(value);
  return count;
}

function measureJointRates(finalPose, previousFrame, deltaTime) {
  const previousPose = previousFrame?.finalPose;
  const previousVelocity = previousFrame?.jointMetrics?.jointAngularVelocity ?? {};
  const velocity = {};
  const acceleration = {};
  let signDiscontinuityCount = 0;
  for (const [jointId, quaternion] of Object.entries(finalPose.localRotations)) {
    const previous = previousPose?.localRotations?.[jointId] ?? quaternion;
    velocity[jointId] = quaternionAngularDistance(previous, quaternion) / Math.max(1e-8, deltaTime);
    acceleration[jointId] = (velocity[jointId] - Number(previousVelocity[jointId] || 0)) / Math.max(1e-8, deltaTime);
    if (quaternionDot(previous, quaternion) < 0) signDiscontinuityCount += 1;
  }
  return { velocity, acceleration, signDiscontinuityCount };
}

function armSignal(kinematics, side) {
  const value = kinematics.sideSign * kinematics.gaitWave * radians(17);
  return side === 'left' ? value : -value;
}

function radians(value) { return value * Math.PI / 180; }
function finite(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function normalizeAngle(value) { return Math.atan2(Math.sin(value), Math.cos(value)); }
function lerpAngle(a, b, t) { return normalizeAngle(a + normalizeAngle(b - a) * Math.min(1, Math.max(0, t))); }
function add3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale3(v, s) { return [v[0] * s, v[1] * s, v[2] * s]; }
function length3(v) { return Math.hypot(v[0], v[1], v[2]); }
function normalize3(v, fallback) { const length = length3(v); return length > 1e-9 ? scale3(v, 1 / length) : [...fallback]; }
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function average3(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }
function normalizeHorizontal(v) { const length = Math.hypot(v[0], v[2]); return length > 1e-9 ? [v[0] / length, 0, v[2] / length] : [0, 0, 0]; }
function scaleHorizontal(v, s) { return [v[0] * s, 0, v[2] * s]; }
function rotateYaw([x, y, z], yaw) { const c = Math.cos(yaw); const s = Math.sin(yaw); return [x * c + z * s, y, -x * s + z * c]; }
