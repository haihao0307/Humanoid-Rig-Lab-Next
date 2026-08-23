import { quaternionFromAxisAngle } from '../../modules/animation/quaternion.js';
import { createMotionGoal } from '../goals/motion-goal.js';
import { normalizeMotionStyle } from '../goals/motion-style.js';
import {
  addVectors,
  clamp,
  crossVectors,
  normalizeVector3,
  scaleVector,
  unit,
  vector3,
  vectorLength,
} from '../solver/motion-math.js';
import {
  FootstepPlanner,
  computeStepFrequency,
  computeStrideLength,
} from './footstep-planner.js';

export const LOCOMOTION_MODES = Object.freeze(['idle', 'start', 'walk', 'stop', 'turn']);

export class LocomotionController {
  constructor({ bodyProfile = {}, compatibleRig = 'rig@0.4.0' } = {}) {
    this.bodyProfile = normalizeBodyProfile(bodyProfile);
    this.compatibleRig = compatibleRig;
    this.mode = 'idle';
    this.modeTime = 0;
    this.time = 0;
    this.phase = 0;
    this.currentSpeed = 0;
    this.rootPosition = [0, 0, 0];
    this.facingYaw = 0;
    this.planner = new FootstepPlanner({ bodyHeight: this.bodyProfile.height });
    this.lastOutput = null;
  }

  update(input = {}, deltaTime = 1 / 60) {
    const dt = clamp(deltaTime, 0, 0.25);
    this.time += dt;
    this.modeTime += dt;
    const style = normalizeMotionStyle(input.style || {});
    const velocityInput = vector3(input.desiredVelocity, [0, 0, 0]);
    const inputMagnitude = vectorLength([velocityInput[0], 0, velocityInput[2]]);
    const desiredSpeed = Math.max(0, Number.isFinite(Number(input.speed)) ? Number(input.speed) : inputMagnitude);
    const turnRate = Number(input.turnRate) || 0;
    this.updateMode(desiredSpeed, turnRate);
    const response = 1 - Math.exp(-dt * (this.mode === 'stop' ? 5 : 7));
    this.currentSpeed += ((this.mode === 'idle' || this.mode === 'turn' ? 0 : desiredSpeed) - this.currentSpeed) * response;

    const desiredForward = resolveForward(input.desiredFacing, velocityInput, this.facingYaw);
    const travelDirection = inputMagnitude > 1e-6
      ? normalizeVector3([velocityInput[0], 0, velocityInput[2]], desiredForward)
      : desiredForward;
    const desiredYaw = Math.atan2(desiredForward[0], desiredForward[2]);
    const yawError = shortestAngle(this.facingYaw, desiredYaw);
    const requestedTurn = turnRate || yawError * 3;
    this.facingYaw += clamp(requestedTurn, -2.5, 2.5) * dt;
    const forward = [Math.sin(this.facingYaw), 0, Math.cos(this.facingYaw)];
    const right = normalizeVector3(crossVectors([0, 1, 0], forward), [1, 0, 0]);
    const inPlace = Boolean(input.inPlace) || this.mode === 'turn';
    if (!inPlace) this.rootPosition = addVectors(this.rootPosition, scaleVector(travelDirection, this.currentSpeed * dt));

    const stepFrequency = computeStepFrequency(Math.max(this.currentSpeed, this.mode === 'turn' ? Math.abs(turnRate) * 0.12 : 0), this.bodyProfile.height, style);
    const strideLength = computeStrideLength(this.currentSpeed, stepFrequency, this.bodyProfile.height, Number(input.strideScale) || 1, style);
    if (stepFrequency > 0) this.phase = wrap01(this.phase + stepFrequency * dt);
    else if (this.mode === 'idle') this.phase = approachPhase(this.phase, 0, dt * 2.5);

    const stepWidth = clamp(Number(input.stepWidth) || this.bodyProfile.height * 0.105, this.bodyProfile.height * 0.07, this.bodyProfile.height * 0.18);
    const groundHeight = Number(input.groundInfo?.height) || 0;
    const clearance = clamp(this.bodyProfile.height * (0.028 + style.energy * 0.012), 0.035, 0.1);
    const pelvisLateral = Math.sin(this.phase * Math.PI * 2) * stepWidth * 0.12;
    const pelvisVertical = Math.sin(this.phase * Math.PI * 4) * this.bodyProfile.height * 0.006;
    const pelvisYaw = Math.sin(this.phase * Math.PI * 2) * 0.055 * (0.6 + style.amplitude * 0.4);
    const rootTarget = addVectors(this.rootPosition, scaleVector(right, pelvisLateral));
    rootTarget[1] += pelvisVertical;
    const feet = this.planner.update({
      phase: this.phase,
      rootPosition: this.rootPosition,
      forward: travelDirection,
      right,
      strideLength: this.mode === 'turn' ? this.bodyProfile.height * 0.08 : strideLength,
      stepFrequency,
      stepWidth,
      clearance,
      facingYaw: this.facingYaw,
      groundHeight,
      time: this.time,
    });
    const contacts = buildContacts(feet);
    const footTargets = buildFootTargets(feet, this.rootPosition, forward, stepWidth, this.bodyProfile.height);
    const armSwing = Math.sin(this.phase * Math.PI * 2) * strideLength * 0.38 * style.amplitude;
    const armTargets = buildArmTargets(rootTarget, forward, right, armSwing, this.bodyProfile.height);
    const goal = createMotionGoal({
      goalId: `locomotion_${this.mode}`,
      compatibleRig: this.compatibleRig,
      source: 'locomotion-controller-v3',
      root: {
        mode: 'trajectory',
        targetPosition: rootTarget,
        targetRotation: quaternionFromAxisAngle([0, 1, 0], this.facingYaw + pelvisYaw),
      },
      orientation: { forward, up: [0, 1, 0] },
      trajectory: { points: [[...this.rootPosition], addVectors(this.rootPosition, scaleVector(travelDirection, Math.max(0.2, strideLength)))], loop: false },
      endEffectors: [...footTargets, ...armTargets],
      contacts,
      gaze: input.gazeTarget ? {
        targetPosition: vector3(input.gazeTarget),
        headWeight: 0.55 + style.alertness * 0.2,
        neckWeight: 0.3,
        chestWeight: 0.12,
        eyeWeight: 0,
      } : null,
      balance: {
        enabled: contacts.length > 0,
        mode: resolveSupportMode(feet),
        supportMargin: 0.012,
      },
      posture: {
        torsoLean: clamp(this.currentSpeed * 0.035 + style.fatigue * 0.06 + style.weight * 0.03, -0.1, 0.16),
        spineTwist: -pelvisYaw * 1.35,
        symmetryWeight: this.mode === 'idle' ? 0.8 : 0.15,
      },
      timing: { duration: stepFrequency > 0 ? 1 / stepFrequency : 1, elapsed: this.time, phase: this.phase },
      style,
      metadata: {
        locomotion: {
          mode: this.mode,
          speed: this.currentSpeed,
          strideLength,
          stepFrequency,
          supportFoot: feet.supportFoot,
          swingFoot: feet.swingFoot,
          stepPhase: this.phase,
          gaitPhases: { left: feet.left.gaitPhase, right: feet.right.gaitPhase },
          leftSwingClearance: Math.max(clearance, feet.left.maxClearance),
          rightSwingClearance: Math.max(clearance, feet.right.maxClearance),
          leftSupportDrift: 0,
          rightSupportDrift: 0,
          pelvisLateralRange: Math.abs(stepWidth * 0.24),
          pelvisVerticalRange: this.bodyProfile.height * 0.012,
          pelvisYawRange: 0.11 * (0.6 + style.amplitude * 0.4),
          pelvisYaw,
          armSwing,
          leftArmSwing: -armSwing,
          rightArmSwing: armSwing,
          leftLegSwing: feet.left.hipSwingPreference,
          rightLegSwing: feet.right.hipSwingPreference,
          torsoCounterRotation: -pelvisYaw * 1.35,
          rootForwardAxis: '+Z',
          inPlace,
        },
      },
    });
    this.lastOutput = {
      mode: this.mode,
      goal,
      rootTrajectory: goal.trajectory,
      pelvisGoal: goal.root,
      leftFootGoal: footTargets.find((item) => item.jointId === 'leftFoot'),
      rightFootGoal: footTargets.find((item) => item.jointId === 'rightFoot'),
      leftKneePole: footTargets.find((item) => item.jointId === 'leftFoot').poleTarget,
      rightKneePole: footTargets.find((item) => item.jointId === 'rightFoot').poleTarget,
      leftContact: contacts.find((item) => item.jointId === 'leftFoot') || null,
      rightContact: contacts.find((item) => item.jointId === 'rightFoot') || null,
      torsoCounterRotation: -pelvisYaw * 1.35,
      armSwingGoals: armTargets,
      feet,
    };
    return structuredClone(this.lastOutput);
  }

  setBodyProfile(bodyProfile = {}) {
    this.bodyProfile = normalizeBodyProfile(bodyProfile);
    this.planner = new FootstepPlanner({ bodyHeight: this.bodyProfile.height });
  }

  reset() {
    this.mode = 'idle';
    this.modeTime = 0;
    this.time = 0;
    this.phase = 0;
    this.currentSpeed = 0;
    this.rootPosition = [0, 0, 0];
    this.facingYaw = 0;
    this.planner.reset();
    this.lastOutput = null;
  }

  getState() {
    return {
      mode: this.mode,
      time: this.time,
      phase: this.phase,
      speed: this.currentSpeed,
      rootPosition: [...this.rootPosition],
      facingYaw: this.facingYaw,
    };
  }

  updateMode(desiredSpeed, turnRate) {
    const previous = this.mode;
    if (desiredSpeed > 0.025) {
      if (this.mode === 'idle' || this.mode === 'stop' || this.mode === 'turn') this.mode = 'start';
      if (this.mode === 'start' && this.modeTime > 0.22) this.mode = 'walk';
    } else if (Math.abs(turnRate) > 0.02) {
      this.mode = 'turn';
    } else if (this.currentSpeed > 0.025) {
      this.mode = 'stop';
    } else if (this.mode === 'stop' && this.modeTime > 0.26 || this.mode !== 'idle') {
      this.mode = 'idle';
    }
    if (this.mode !== previous) this.modeTime = 0;
  }
}

function buildContacts(feet) {
  const contacts = [];
  for (const [side, foot] of [['left', feet.left], ['right', feet.right]]) {
    if (foot.swinging || foot.contactWeight <= 1e-4) continue;
    contacts.push({
      id: `${side}_foot_support`,
      jointId: `${side}Foot`,
      mode: 'world_lock',
      position: foot.plantedPosition,
      targetRotation: foot.targetRotation,
      normal: [0, 1, 0],
      positionWeight: foot.contactWeight,
      rotationWeight: foot.contactWeight * 0.75,
      phase: foot.localPhase,
      active: true,
      priority: 100,
      contactBlendIn: 0.08,
      contactBlendOut: 0.1,
    });
  }
  return contacts;
}

function buildFootTargets(feet, root, forward, stepWidth, height) {
  return [['left', feet.left], ['right', feet.right]].map(([side, foot]) => ({
    id: `${side}_foot_motion_target`,
    jointId: `${side}Foot`,
    targetPosition: foot.targetPosition,
    targetRotation: foot.targetRotation,
    positionWeight: 1,
    rotationWeight: 0.65,
    poleTarget: [
      root[0] + (side === 'left' ? -stepWidth * 0.35 : stepWidth * 0.35),
      root[1] + height * 0.48,
      root[2] + forward[2] * height * 0.22,
    ],
    priority: foot.swinging ? 55 : 42,
    groundNormal: [0, 1, 0],
    contactPhase: foot.contactWeight,
  }));
}

function buildArmTargets(root, forward, right, swing, height) {
  return ['left', 'right'].map((side) => {
    const sideSign = side === 'left' ? -1 : 1;
    const forwardSwing = side === 'left' ? -swing : swing;
    const target = addVectors(
      addVectors(root, scaleVector(right, sideSign * height * 0.24)),
      scaleVector(forward, height * 0.075 + forwardSwing),
    );
    target[1] += height * 0.52;
    return {
      id: `${side}_arm_swing`,
      jointId: `${side}Hand`,
      targetPosition: target,
      positionWeight: 0.45,
      rotationWeight: 0,
      poleTarget: addVectors(target, scaleVector(forward, height * 0.18)),
      priority: 18,
      shoulderParticipation: 0.12,
      spineParticipation: 0.04,
    };
  });
}

function resolveSupportMode(feet) {
  if (!feet.left.swinging && !feet.right.swinging) return 'double_support';
  if (!feet.left.swinging) return 'left_support';
  if (!feet.right.swinging) return 'right_support';
  return 'airborne';
}

function normalizeBodyProfile(input) {
  return { ...input, height: clamp(Number(input.height) || 1.795672, 1.2, 2.3) };
}

function resolveForward(desiredFacing, desiredVelocity, yaw) {
  const facing = Array.isArray(desiredFacing) ? desiredFacing : desiredFacing?.forward;
  if (facing && vectorLength([facing[0], 0, facing[2]]) > 1e-6) return normalizeVector3([facing[0], 0, facing[2]], [0, 0, 1]);
  if (vectorLength([desiredVelocity[0], 0, desiredVelocity[2]]) > 1e-6) return normalizeVector3([desiredVelocity[0], 0, desiredVelocity[2]], [0, 0, 1]);
  return [Math.sin(yaw), 0, Math.cos(yaw)];
}

function shortestAngle(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function approachPhase(value, target, amount) {
  const delta = shortestAngle(value * Math.PI * 2, target * Math.PI * 2) / (Math.PI * 2);
  return wrap01(value + clamp(delta, -amount, amount));
}
