import { quaternionAngularDistance } from '../../animation/quaternion.js';

export const MOTION_QUALITY_METRICS_V1_SCHEMA = 'humanoid_rig/motion_quality_metrics@1.0';

export const TASK17A_NUMERIC_THRESHOLDS_V1 = Object.freeze({
  maximumBoneLengthError: 1e-6,
  finalYawErrorDegrees: 2,
  targetPositionError: 0.05,
  targetFacingErrorDegrees: 3,
  supportFootMaximumSlip: 0.015,
  supportFootMeanSlip: 0.005,
  leftRightMirrorError: 0.02,
  maximumFrozenDurationDuringWalk: 0.35,
  rootSpeedAfterSettle: 0.03,
  rootAngularSpeedAfterSettleDegrees: 2,
  footDriftAfterSettle: 0.005,
});

export function analyzeMotionScenarioV1({
  scenarioId,
  execution,
  frames,
  maximumBoneLengthError = 0,
  leftRightMirrorError = null,
} = {}) {
  if (!Array.isArray(frames) || frames.length < 2) throw new Error(`${scenarioId} requires at least two frames.`);
  const thresholds = TASK17A_NUMERIC_THRESHOLDS_V1;
  const first = frames[0];
  const final = frames.at(-1);
  const finalSegment = execution.segments.at(-1);
  const targetPosition = finalSegment.plan.targetPosition;
  const targetFacing = finalSegment.plan.targetFacing;
  const finalPositionError = Math.hypot(
    final.finalPose.rootPosition[0] - targetPosition[0],
    final.finalPose.rootPosition[2] - targetPosition[2],
  );
  const finalFacingErrorDegrees = degrees(angleDifference(final.rootMetrics.facing, targetFacing));
  const slip = measureFootSlip(frames);
  const phases = measureFootPhases(execution);
  const rootTeleportCount = countRootTeleports(frames);
  const nonFinitePoseValueCount = Math.max(...frames.map((frame) => frame.jointMetrics.nonFinitePoseValueCount));
  const jointLimitViolationCount = Math.max(...frames.map((frame) => frame.jointMetrics.jointLimitViolationCount));
  const kneeReverseCount = Math.max(...frames.map((frame) => frame.jointMetrics.kneeReverseCount));
  const elbowReverseCount = Math.max(...frames.map((frame) => frame.jointMetrics.elbowReverseCount));
  const quaternionSignDiscontinuityCount = frames.reduce((sum, frame) => sum + frame.jointMetrics.quaternionSignDiscontinuityCount, 0);
  const settle = measureSettle(frames);
  const balance = measureBalance(frames);
  const naturalness = measureNaturalness(execution, frames);
  const hasTurn = execution.segments.some((segment) => segment.stepType === 'turn_in_place');
  const hasWalk = execution.segments.some((segment) => segment.stepType === 'walk_to_target');
  const allGate = maximumBoneLengthError <= thresholds.maximumBoneLengthError
    && jointLimitViolationCount === 0
    && nonFinitePoseValueCount === 0
    && rootTeleportCount === 0
    && kneeReverseCount === 0
    && elbowReverseCount === 0
    && quaternionSignDiscontinuityCount === 0;
  const contactGate = slip.combined.maximum <= thresholds.supportFootMaximumSlip
    && slip.combined.mean <= thresholds.supportFootMeanSlip;
  const turnGate = !hasTurn || (
    finalFacingErrorDegrees <= thresholds.finalYawErrorDegrees
    && contactGate
    && (leftRightMirrorError == null || leftRightMirrorError <= thresholds.leftRightMirrorError)
  );
  const walkGate = !hasWalk || (
    finalPositionError <= thresholds.targetPositionError
    && finalFacingErrorDegrees <= thresholds.targetFacingErrorDegrees
    && contactGate
    && phases.left.stancePhaseCount >= 1
    && phases.left.swingPhaseCount >= 1
    && phases.left.heelStrikeCount >= 1
    && phases.left.toeOffCount >= 1
    && phases.right.stancePhaseCount >= 1
    && phases.right.swingPhaseCount >= 1
    && phases.right.heelStrikeCount >= 1
    && phases.right.toeOffCount >= 1
    && naturalness.maximumFrozenDurationDuringWalk < thresholds.maximumFrozenDurationDuringWalk
  );
  const settleGate = settle.rootSpeedAfterSettle <= thresholds.rootSpeedAfterSettle
    && settle.rootAngularSpeedAfterSettleDegrees <= thresholds.rootAngularSpeedAfterSettleDegrees
    && settle.footDriftAfterSettle <= thresholds.footDriftAfterSettle;
  const balanceGate = balance.fallDetected === false
    && balance.doubleSupportOutsideCount === 0
    && balance.uncontrolledSingleSupportOutsideDuration === 0;
  return {
    schema: MOTION_QUALITY_METRICS_V1_SCHEMA,
    scenarioId,
    duration: execution.duration,
    frameCount: frames.length,
    sampleRate: estimateSampleRate(frames),
    finalPositionError,
    finalFacingErrorDegrees,
    finalYawErrorDegrees: hasTurn ? finalFacingErrorDegrees : null,
    supportFootSlip: slip,
    footPhases: phases,
    maximumBoneLengthError,
    jointLimitViolationCount,
    nonFinitePoseValueCount,
    rootTeleportCount,
    kneeReverseCount,
    elbowReverseCount,
    quaternionSignDiscontinuityCount,
    leftRightMirrorError,
    settle,
    balance,
    naturalness,
    gates: {
      allGate,
      contactGate,
      turnGate,
      walkGate,
      settleGate,
      balanceGate,
      numericPassed: allGate && contactGate && turnGate && walkGate && settleGate && balanceGate,
    },
    visualStatus: 'unsupported',
    thresholds,
  };
}

export function compareTurnMirrorErrorV1(leftFrames, rightFrames) {
  const count = Math.min(leftFrames.length, rightFrames.length);
  let maximum = 0;
  for (let index = 0; index < count; index += 1) {
    const left = leftFrames[Math.round(index * (leftFrames.length - 1) / Math.max(1, count - 1))];
    const right = rightFrames[Math.round(index * (rightFrames.length - 1) / Math.max(1, count - 1))];
    const leftFeet = left.contactState.feet;
    const rightFeet = right.contactState.feet;
    maximum = Math.max(
      maximum,
      mirrorPointError(leftFeet.left.position, rightFeet.right.position),
      mirrorPointError(leftFeet.right.position, rightFeet.left.position),
      Math.abs(angleDifference(left.rootMetrics.facing, -right.rootMetrics.facing)),
    );
  }
  return maximum;
}

export function areBehaviorPlanExecutionsEquivalentV1(leftFrames, rightFrames, tolerance = 1e-9) {
  const left = leftFrames.at(-1);
  const right = rightFrames.at(-1);
  return horizontalDistance(left.finalPose.rootPosition, right.finalPose.rootPosition) <= tolerance
    && Math.abs(angleDifference(left.rootMetrics.facing, right.rootMetrics.facing)) <= tolerance
    && left.behaviorPlan.steps.map((step) => step.stepType).join('|') === right.behaviorPlan.steps.map((step) => step.stepType).join('|');
}

function measureFootSlip(frames) {
  const samples = { left: [], right: [] };
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    for (const side of ['left', 'right']) {
      if (previous.contactState[`${side}FootState`] !== 'stance' || current.contactState[`${side}FootState`] !== 'stance') continue;
      samples[side].push(horizontalDistance(previous.contactState.feet[side].position, current.contactState.feet[side].position));
    }
  }
  const summarize = (values) => ({
    sampleCount: values.length,
    maximum: Math.max(0, ...values),
    mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
  });
  const combined = [...samples.left, ...samples.right];
  return { left: summarize(samples.left), right: summarize(samples.right), combined: summarize(combined) };
}

function measureFootPhases(execution) {
  const result = {
    left: { stancePhaseCount: 1, swingPhaseCount: 0, heelStrikeCount: 0, toeOffCount: 0 },
    right: { stancePhaseCount: 1, swingPhaseCount: 0, heelStrikeCount: 0, toeOffCount: 0 },
  };
  for (const segment of execution.segments) {
    for (const step of segment.plan.steps) {
      result[step.side].swingPhaseCount += 1;
      result[step.side].stancePhaseCount += 1;
    }
    for (const event of segment.plan.events) {
      if (event.eventType === 'heel_strike') result[event.foot].heelStrikeCount += 1;
      if (event.eventType === 'toe_off') result[event.foot].toeOffCount += 1;
    }
  }
  return result;
}

function measureSettle(frames) {
  const finalTime = frames.at(-1).timestamp;
  const settleFrames = frames.filter((frame) => frame.timestamp >= finalTime - 1 - 1e-9);
  const rootSpeedAfterSettle = Math.max(0, ...settleFrames.map((frame) => frame.rootMetrics.rootSpeed));
  const rootAngularSpeedAfterSettleDegrees = degrees(Math.max(0, ...settleFrames.map((frame) => Math.abs(frame.rootMetrics.rootAngularSpeed))));
  let footDriftAfterSettle = 0;
  for (let index = 1; index < settleFrames.length; index += 1) {
    for (const side of ['left', 'right']) {
      footDriftAfterSettle = Math.max(
        footDriftAfterSettle,
        horizontalDistance(settleFrames[index - 1].contactState.feet[side].position, settleFrames[index].contactState.feet[side].position),
      );
    }
  }
  return { settleDuration: Math.min(1, finalTime), rootSpeedAfterSettle, rootAngularSpeedAfterSettleDegrees, footDriftAfterSettle };
}

function measureBalance(frames) {
  const doubleSupportOutsideCount = frames.filter((frame) => (
    frame.balanceState.supportState === 'double_support' && !frame.balanceState.comInsideSupport
  )).length;
  const uncontrolledSingleSupportOutsideDuration = frames.reduce((sum, frame, index) => {
    if (frame.balanceState.supportState === 'double_support' || frame.balanceState.comInsideSupport) return sum;
    const next = frames[index + 1];
    return sum + (next ? next.timestamp - frame.timestamp : 0);
  }, 0);
  return {
    doubleSupportOutsideCount,
    uncontrolledSingleSupportOutsideDuration,
    balanceRecoveryCount: Math.max(0, ...frames.map((frame) => frame.balanceState.balanceRecoveryCount)),
    supportTransitionCount: Math.max(0, ...frames.map((frame) => frame.balanceState.supportTransitionCount)),
    fallDetected: frames.some((frame) => frame.balanceState.fallDetected),
  };
}

function measureNaturalness(execution, frames) {
  const walkSegments = execution.segments.filter((segment) => segment.stepType === 'walk_to_target');
  const stepRecords = walkSegments.flatMap((segment) => segment.plan.steps);
  const bySide = (side) => stepRecords.filter((step) => step.side === side);
  const stepLengths = (side) => bySide(side).map((step) => horizontalDistance(step.startPosition, step.endPosition));
  const stepDurations = (side) => bySide(side).map((step) => step.endTime - step.startTime);
  const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const walkDuration = walkSegments.reduce((sum, segment) => sum + Math.max(0, segment.plan.movementEndTime - segment.plan.prepareDuration), 0);
  const pelvis = frames.map((frame) => frame.motionSignals.pelvisYaw);
  const chest = frames.map((frame) => frame.motionSignals.chestYaw);
  const leftArm = frames.map((frame) => frame.motionSignals.leftArmSwing);
  const leftLegCounter = frames.map((frame) => {
    const active = frame.contactState.activeStep;
    return active?.side === 'left' ? -Math.sin(Math.PI * active.phase) : active?.side === 'right' ? Math.sin(Math.PI * active.phase) : 0;
  });
  return {
    armLegCounterSwingCorrelation: correlation(leftArm, leftLegCounter),
    pelvisChestCounterRotation: correlation(pelvis, chest),
    stepLengthLeft: mean(stepLengths('left')),
    stepLengthRight: mean(stepLengths('right')),
    stepDurationLeft: mean(stepDurations('left')),
    stepDurationRight: mean(stepDurations('right')),
    stanceRatioLeft: stanceRatio(frames, 'left'),
    stanceRatioRight: stanceRatio(frames, 'right'),
    cadence: walkDuration > 0 ? stepRecords.length / walkDuration * 60 : 0,
    pathDeviation: maximumPathDeviation(execution, frames),
    settleDuration: measureSettle(frames).settleDuration,
    maximumFrozenDurationDuringWalk: maximumFrozenWalkDuration(execution, frames),
  };
}

function maximumFrozenWalkDuration(execution, frames) {
  let maximum = 0;
  for (const segment of execution.segments.filter((item) => item.stepType === 'walk_to_target')) {
    const relevant = frames.filter((frame) => (
      frame.timestamp >= segment.startTime + segment.plan.prepareDuration - 1e-9
      && frame.timestamp <= segment.startTime + segment.plan.movementEndTime + 1e-9
    ));
    let start = null;
    for (const frame of relevant) {
      if (frame.rootMetrics.rootSpeed < 0.015) {
        if (start == null) start = frame.timestamp;
        maximum = Math.max(maximum, frame.timestamp - start);
      } else start = null;
    }
  }
  return maximum;
}

function maximumPathDeviation(execution, frames) {
  let maximum = 0;
  for (const segment of execution.segments.filter((item) => item.stepType === 'walk_to_target')) {
    const start = segment.plan.startPosition;
    const end = segment.plan.targetPosition;
    for (const frame of frames.filter((item) => item.timestamp >= segment.startTime && item.timestamp <= segment.endTime)) {
      maximum = Math.max(maximum, pointLineDistanceXZ(frame.finalPose.rootPosition, start, end));
    }
  }
  return maximum;
}

function countRootTeleports(frames) {
  let count = 0;
  for (let index = 1; index < frames.length; index += 1) {
    const delta = horizontalDistance(frames[index - 1].finalPose.rootPosition, frames[index].finalPose.rootPosition);
    const dt = Math.max(1e-8, frames[index].timestamp - frames[index - 1].timestamp);
    if (delta > Math.max(0.25, dt * 3)) count += 1;
  }
  return count;
}

function stanceRatio(frames, side) {
  if (!frames.length) return 0;
  return frames.filter((frame) => frame.contactState[`${side}FootState`] === 'stance').length / frames.length;
}

function correlation(a, b) {
  if (a.length !== b.length || a.length < 2) return 0;
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  let numerator = 0;
  let sumA = 0;
  let sumB = 0;
  for (let index = 0; index < a.length; index += 1) {
    const da = a[index] - meanA;
    const db = b[index] - meanB;
    numerator += da * db;
    sumA += da * da;
    sumB += db * db;
  }
  const denominator = Math.sqrt(sumA * sumB);
  return denominator > 1e-12 ? numerator / denominator : 0;
}

function mirrorPointError(left, right) { return Math.hypot(left[0] + right[0], left[1] - right[1], left[2] - right[2]); }
function horizontalDistance(a, b) { return Math.hypot(Number(a?.[0] || 0) - Number(b?.[0] || 0), Number(a?.[2] || 0) - Number(b?.[2] || 0)); }
function angleDifference(a, b) { return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))); }
function degrees(radians) { return radians * 180 / Math.PI; }
function estimateSampleRate(frames) { const duration = frames.at(-1).timestamp - frames[0].timestamp; return duration > 0 ? (frames.length - 1) / duration : 0; }
function pointLineDistanceXZ(point, start, end) {
  const dx = end[0] - start[0];
  const dz = end[2] - start[2];
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq < 1e-12) return horizontalDistance(point, start);
  const t = Math.min(1, Math.max(0, ((point[0] - start[0]) * dx + (point[2] - start[2]) * dz) / lengthSq));
  return Math.hypot(point[0] - (start[0] + dx * t), point[2] - (start[2] + dz * t));
}
