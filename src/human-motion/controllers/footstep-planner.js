import { quaternionFromAxisAngle, multiplyQuaternions } from '../../modules/animation/quaternion.js';
import {
  addVectors,
  clamp,
  lerpVector,
  normalizeVector3,
  scaleVector,
  smootherstep,
  unit,
  vector3,
} from '../solver/motion-math.js';

export const GAIT_PHASES = Object.freeze([
  'heel_strike',
  'loading',
  'mid_stance',
  'terminal_stance',
  'toe_off',
  'early_swing',
  'mid_swing',
  'late_swing',
]);

export function resolveGaitPhase(localPhase) {
  const phase = wrap01(localPhase);
  return GAIT_PHASES[Math.min(GAIT_PHASES.length - 1, Math.floor(phase * GAIT_PHASES.length))];
}

export function computeStepFrequency(speed, bodyHeight = 1.795672, style = {}) {
  if (speed < 0.025) return 0;
  const heightScale = Math.sqrt(1.795672 / Math.max(0.8, Number(bodyHeight) || 1.795672));
  return clamp((0.72 + speed * 0.72) * heightScale * (Number(style.tempo) || 1), 0.65, 2.25);
}

export function computeStrideLength(speed, stepFrequency, bodyHeight = 1.795672, strideScale = 1, style = {}) {
  if (speed < 0.025 || stepFrequency <= 0) return 0;
  const physical = speed / stepFrequency;
  const anthropometric = bodyHeight * clamp(0.16 + speed * 0.12, 0.16, 0.42);
  const amplitude = 0.7 + 0.5 * unit(style.amplitude, 0.6);
  return clamp((physical * 0.7 + anthropometric * 0.3) * strideScale * amplitude, bodyHeight * 0.12, bodyHeight * 0.48);
}

export function sampleFootTrajectory(takeoffPosition, landingPosition, phase, clearance = 0.06, groundHeight = 0) {
  const t = clamp(phase, 0, 1);
  const horizontal = smootherstep(t);
  const result = lerpVector(takeoffPosition, landingPosition, horizontal);
  const baseY = Math.max(groundHeight, takeoffPosition[1] + (landingPosition[1] - takeoffPosition[1]) * horizontal);
  result[1] = baseY + Math.max(0, clearance) * Math.sin(Math.PI * t) ** 2;
  return result;
}

export function computeFootRotation({ facingYaw = 0, gaitPhase = 'mid_stance', swingPhase = 0 } = {}) {
  const pitchByPhase = {
    heel_strike: 0.12,
    loading: 0.04,
    mid_stance: 0,
    terminal_stance: -0.08,
    toe_off: -0.16,
    early_swing: 0.09,
    mid_swing: 0.07,
    late_swing: 0.11,
  };
  const yaw = quaternionFromAxisAngle([0, 1, 0], facingYaw);
  const pitch = quaternionFromAxisAngle([1, 0, 0], pitchByPhase[gaitPhase] ?? (0.06 * Math.sin(Math.PI * swingPhase)));
  return multiplyQuaternions(yaw, pitch);
}

export class FootstepPlanner {
  constructor({ bodyHeight = 1.795672, stepWidth = 0.19, groundHeight = 0 } = {}) {
    this.bodyHeight = bodyHeight;
    this.stepWidth = stepWidth;
    this.groundHeight = groundHeight;
    this.feet = {
      left: createFootState('left'),
      right: createFootState('right'),
    };
    this.initialized = false;
  }

  reset({ rootPosition = [0, 0, 0], stepWidth = this.stepWidth, groundHeight = this.groundHeight } = {}) {
    this.stepWidth = stepWidth;
    this.groundHeight = groundHeight;
    for (const side of ['left', 'right']) {
      const sign = side === 'left' ? -1 : 1;
      const point = [rootPosition[0] + sign * stepWidth * 0.5, groundHeight + 0.1, rootPosition[2]];
      this.feet[side] = { ...createFootState(side), position: point, plantedPosition: [...point], landingPosition: [...point], takeoffPosition: [...point] };
    }
    this.initialized = true;
  }

  update({
    phase = 0,
    rootPosition = [0, 0, 0],
    forward = [0, 0, 1],
    right = [1, 0, 0],
    strideLength = 0,
    stepFrequency = 0,
    stepWidth = this.stepWidth,
    clearance = 0.06,
    facingYaw = 0,
    groundHeight = this.groundHeight,
    time = 0,
  } = {}) {
    if (!this.initialized) this.reset({ rootPosition, stepWidth, groundHeight });
    this.stepWidth = stepWidth;
    this.groundHeight = groundHeight;
    const output = {};
    for (const side of ['left', 'right']) {
      const state = this.feet[side];
      const sideOffset = side === 'left' ? -stepWidth * 0.5 : stepWidth * 0.5;
      const localPhase = wrap01(phase + (side === 'right' ? 0.5 : 0));
      const stanceEnd = 0.58;
      const swinging = stepFrequency > 0 && localPhase >= stanceEnd;
      const enteredSwing = swinging && !state.swinging;
      const enteredStance = !swinging && state.swinging;
      if (enteredSwing) {
        state.takeoffPosition = [...state.position];
        const lateral = scaleVector(right, sideOffset);
        const forwardLanding = scaleVector(forward, strideLength * 0.62);
        state.landingPosition = addVectors(addVectors(rootPosition, lateral), forwardLanding);
        state.landingPosition[1] = groundHeight + 0.1;
        state.stepStartTime = time;
        state.stepEndTime = time + (1 - stanceEnd) / Math.max(1e-6, stepFrequency);
      }
      if (enteredStance) {
        state.plantedPosition = [...state.landingPosition];
        state.position = [...state.plantedPosition];
      }
      state.swinging = swinging;
      state.localPhase = localPhase;
      state.gaitPhase = resolveGaitPhase(localPhase);
      state.contactWeight = swinging ? 0 : contactEnvelope(localPhase, stanceEnd);
      state.kneeFlexPreference = swinging ? 0.22 + 0.48 * Math.sin(Math.PI * ((localPhase - stanceEnd) / (1 - stanceEnd))) : 0.05;
      state.hipSwingPreference = Math.sin(localPhase * Math.PI * 2) * strideLength * 0.5;
      if (swinging) {
        const swingPhase = clamp((localPhase - stanceEnd) / (1 - stanceEnd), 0, 1);
        state.position = sampleFootTrajectory(state.takeoffPosition, state.landingPosition, swingPhase, clearance, groundHeight + 0.1);
        state.maxClearance = Math.max(state.maxClearance, state.position[1] - (groundHeight + 0.1));
        state.rotation = computeFootRotation({ facingYaw, gaitPhase: state.gaitPhase, swingPhase });
      } else {
        state.position = [...state.plantedPosition];
        state.rotation = computeFootRotation({ facingYaw, gaitPhase: state.gaitPhase });
      }
      output[side] = snapshotFoot(state);
    }
    return {
      left: output.left,
      right: output.right,
      supportFoot: output.left.contactWeight >= output.right.contactWeight ? 'left' : 'right',
      swingFoot: output.left.swinging ? 'left' : output.right.swinging ? 'right' : null,
    };
  }
}

function createFootState(side) {
  return {
    side,
    position: [0, 0.1, 0],
    rotation: [0, 0, 0, 1],
    plantedPosition: [0, 0.1, 0],
    takeoffPosition: [0, 0.1, 0],
    landingPosition: [0, 0.1, 0],
    stepStartTime: 0,
    stepEndTime: 0,
    localPhase: 0,
    gaitPhase: 'heel_strike',
    swinging: false,
    contactWeight: 1,
    kneeFlexPreference: 0.05,
    hipSwingPreference: 0,
    maxClearance: 0,
  };
}

function snapshotFoot(state) {
  return {
    side: state.side,
    targetPosition: [...state.position],
    targetRotation: [...state.rotation],
    plantedPosition: [...state.plantedPosition],
    takeoffPosition: [...state.takeoffPosition],
    landingPosition: [...state.landingPosition],
    stepStartTime: state.stepStartTime,
    stepEndTime: state.stepEndTime,
    localPhase: state.localPhase,
    gaitPhase: state.gaitPhase,
    swinging: state.swinging,
    contactWeight: state.contactWeight,
    kneeFlexPreference: state.kneeFlexPreference,
    hipSwingPreference: state.hipSwingPreference,
    maxClearance: state.maxClearance,
  };
}

function contactEnvelope(phase, stanceEnd) {
  const edge = 0.08;
  if (phase < edge) return smootherstep(phase / edge);
  if (phase > stanceEnd - edge) return smootherstep((stanceEnd - phase) / edge);
  return 1;
}

function wrap01(value) {
  const number = Number(value) || 0;
  return ((number % 1) + 1) % 1;
}
