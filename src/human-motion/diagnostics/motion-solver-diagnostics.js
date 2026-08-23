import {
  IDENTITY,
  distance,
  dotVectors,
  maxLinearVelocity,
  maxQuaternionVelocity,
  normalizeVector3,
  rotateVectorByQuaternion,
  vectorLength,
} from '../solver/motion-math.js';

export function measureSolverBoneLengthError(fk) {
  let maximum = 0;
  for (const joint of fk?.rig?.joints || []) {
    if (!joint.parentId || joint.physicalBone === false) continue;
    const parent = fk.positions.get(joint.parentId);
    const point = fk.positions.get(joint.id);
    if (!parent || !point) continue;
    maximum = Math.max(maximum, Math.abs(distance(parent, point) - vectorLength(joint.localPosition)));
  }
  return maximum;
}

export function buildMotionSolverDiagnostics({
  goal,
  fk,
  contacts = [],
  contactReports = [],
  endEffectorReports = [],
  balance = {},
  transition = {},
  previousPose = null,
  currentPose = null,
  deltaTime = 1 / 60,
  solveIterations = 1,
  solveTimeMs = 0,
  jointLimitClampCount = 0,
  maxJointLimitViolation = 0,
} = {}) {
  const contactErrors = contactReports.map((report) => Number(report.reachError ?? report.error ?? 0)).filter(Number.isFinite);
  const endErrors = endEffectorReports.map((report) => Number(report.reachError ?? 0)).filter(Number.isFinite);
  const warnings = [];
  const maxContactError = contactErrors.length ? Math.max(...contactErrors) : 0;
  const maxEndEffectorError = endErrors.length ? Math.max(...endErrors) : 0;
  const maxBoneLengthError = measureSolverBoneLengthError(fk);
  if (maxContactError > 0.015) warnings.push('CONTACT_ERROR_HIGH');
  if (maxEndEffectorError > 0.015) warnings.push('END_EFFECTOR_ERROR_HIGH');
  if (maxBoneLengthError > 1e-8) warnings.push('BONE_LENGTH_ERROR');
  if (balance.insideSupport === false && balance.supportMode !== 'airborne' && Number(balance.balanceError) > 1e-5) {
    warnings.push('COM_OUTSIDE_SUPPORT');
  }
  const leftKneeDirectionDot = bendDirectionDot(fk, 'leftUpperLeg', 'leftLowerLeg', 'leftFoot', goal?.orientation?.forward);
  const rightKneeDirectionDot = bendDirectionDot(fk, 'rightUpperLeg', 'rightLowerLeg', 'rightFoot', goal?.orientation?.forward);
  const leftElbowDirectionDot = bendDirectionDot(fk, 'leftUpperArm', 'leftLowerArm', 'leftHand', goal?.orientation?.forward);
  const rightElbowDirectionDot = bendDirectionDot(fk, 'rightUpperArm', 'rightLowerArm', 'rightHand', goal?.orientation?.forward);
  const footForwardDots = {
    left: forwardDot(fk, 'leftFoot', goal?.orientation?.forward),
    right: forwardDot(fk, 'rightFoot', goal?.orientation?.forward),
  };
  return {
    goalId: goal?.goalId ?? null,
    solveIterations,
    solveTimeMs,
    contactCount: goal?.contacts?.length ?? contacts.length,
    activeContactCount: contacts.filter((contact) => contact.active !== false).length,
    maxContactError,
    supportMode: balance.supportMode ?? 'airborne',
    centerOfMass: balance.estimatedCOM ?? [0, 0, 0],
    supportPolygon: balance.supportPolygon ?? [],
    balanceError: Number(balance.balanceError) || 0,
    endEffectorCount: goal?.endEffectors?.length ?? endEffectorReports.length,
    maxEndEffectorError,
    jointLimitClampCount,
    maxJointLimitViolation,
    maxBoneLengthError,
    maxPoseVelocity: maxLinearVelocity(previousPose, currentPose, deltaTime),
    maxAngularVelocity: maxQuaternionVelocity(previousPose, currentPose, deltaTime),
    leftKneeDirectionDot,
    rightKneeDirectionDot,
    leftElbowDirectionDot,
    rightElbowDirectionDot,
    footForwardDots,
    transitionActive: Boolean(transition.active),
    transitionProgress: Number(transition.progress ?? 1),
    warningCodes: warnings,
    locomotion: normalizeLocomotionDiagnostics(goal?.metadata?.locomotion),
  };
}

function bendDirectionDot(fk, upperId, middleId, endId, forward = [0, 0, 1]) {
  const upper = fk?.positions?.get(upperId);
  const middle = fk?.positions?.get(middleId);
  const end = fk?.positions?.get(endId);
  if (!upper || !middle || !end) return 0;
  const axis = [end[0] - upper[0], end[1] - upper[1], end[2] - upper[2]];
  const axisLengthSquared = Math.max(1e-12, dotVectors(axis, axis));
  const middleDelta = [middle[0] - upper[0], middle[1] - upper[1], middle[2] - upper[2]];
  const projection = Math.max(0, Math.min(1, dotVectors(middleDelta, axis) / axisLengthSquared));
  const straightPoint = [
    upper[0] + axis[0] * projection,
    upper[1] + axis[1] * projection,
    upper[2] + axis[2] * projection,
  ];
  const bend = [middle[0] - straightPoint[0], 0, middle[2] - straightPoint[2]];
  if (Math.hypot(...bend) < 1e-8) return 1;
  const direction = normalizeVector3(bend, forward);
  return dotVectors(direction, normalizeVector3(forward, [0, 0, 1]));
}

function forwardDot(fk, jointId, desiredForward = [0, 0, 1]) {
  const rotation = fk?.rotations?.get(jointId) || IDENTITY;
  const forward = normalizeVector3(rotateVectorByQuaternion([0, 0, 1], rotation), [0, 0, 1]);
  return dotVectors(forward, normalizeVector3(desiredForward, [0, 0, 1]));
}

function normalizeLocomotionDiagnostics(input = null) {
  if (!input) return null;
  return {
    speed: Number(input.speed) || 0,
    strideLength: Number(input.strideLength) || 0,
    stepFrequency: Number(input.stepFrequency) || 0,
    supportFoot: input.supportFoot ?? null,
    swingFoot: input.swingFoot ?? null,
    stepPhase: Number(input.stepPhase) || 0,
    leftSwingClearance: Number(input.leftSwingClearance) || 0,
    rightSwingClearance: Number(input.rightSwingClearance) || 0,
    leftSupportDrift: Number(input.leftSupportDrift) || 0,
    rightSupportDrift: Number(input.rightSupportDrift) || 0,
    pelvisLateralRange: Number(input.pelvisLateralRange) || 0,
    pelvisVerticalRange: Number(input.pelvisVerticalRange) || 0,
    pelvisYawRange: Number(input.pelvisYawRange) || 0,
  };
}
