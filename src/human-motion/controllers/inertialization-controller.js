import { quaternionDot, slerpQuaternion } from '../../modules/animation/quaternion.js';
import {
  IDENTITY,
  distance,
  lerpVector,
  normalizeOutgoingPose,
  normalizeQuaternion,
  quaternionAngularDistance,
  smootherstep,
  subtractVectors,
  vector3,
} from '../solver/motion-math.js';

export class InertializationController {
  constructor({ defaultDuration = 0.22 } = {}) {
    this.defaultDuration = Math.max(1e-4, Number(defaultDuration) || 0.22);
    this.transition = null;
    this.previousPose = null;
    this.previousPosition = null;
    this.previousVelocity = [0, 0, 0];
    this.previousRotation = null;
    this.previousAngularVelocity = 0;
  }

  beginTransition(fromPose, toPose, { duration = this.defaultDuration, reason = 'pose_to_pose' } = {}) {
    this.transition = {
      from: normalizeOutgoingPose(fromPose),
      to: normalizeOutgoingPose(toPose),
      elapsed: 0,
      duration: Math.max(1e-4, Number(duration) || this.defaultDuration),
      reason,
      progress: 0,
    };
    return this.getState();
  }

  applyTransition(targetPose, options = {}) {
    const deltaTime = typeof options === 'number' ? options : Number(options.deltaTime ?? 1 / 60);
    const target = makePoseContinuous(
      normalizeOutgoingPose(targetPose),
      this.previousPose || this.transition?.from || null,
    );
    if (!this.transition) {
      this.observe(target, deltaTime);
      return target;
    }
    this.transition.to = target;
    const raw = this.transition.elapsed / this.transition.duration;
    const alpha = smootherstep(raw);
    const result = blendPose(this.transition.from, this.transition.to, alpha);
    this.transition.progress = Math.min(1, raw);
    this.transition.elapsed += Math.max(0, deltaTime);
    if (this.transition.elapsed >= this.transition.duration + 1e-8) {
      this.transition = null;
      this.observe(target, deltaTime);
    } else {
      this.observe(result, deltaTime);
    }
    return result;
  }

  observe(poseInput, deltaTime = 1 / 60) {
    const pose = normalizeOutgoingPose(poseInput);
    const dt = Math.max(1e-8, Number(deltaTime) || 1 / 60);
    if (this.previousPosition) this.previousVelocity = subtractVectors(pose.root.position, this.previousPosition).map((value) => value / dt);
    if (this.previousRotation) this.previousAngularVelocity = quaternionAngularDistance(this.previousRotation, pose.root.rotation) / dt;
    this.previousPosition = [...pose.root.position];
    this.previousRotation = [...pose.root.rotation];
    this.previousPose = pose;
  }

  isTransitionActive() {
    return Boolean(this.transition);
  }

  clearTransition() {
    this.transition = null;
  }

  getState() {
    return {
      active: Boolean(this.transition),
      progress: this.transition?.progress ?? 1,
      reason: this.transition?.reason ?? null,
      previousPosition: this.previousPosition ? [...this.previousPosition] : null,
      previousVelocity: [...this.previousVelocity],
      previousRotation: this.previousRotation ? [...this.previousRotation] : null,
      previousAngularVelocity: this.previousAngularVelocity,
    };
  }

  reset() {
    this.transition = null;
    this.previousPose = null;
    this.previousPosition = null;
    this.previousVelocity = [0, 0, 0];
    this.previousRotation = null;
    this.previousAngularVelocity = 0;
  }
}

function blendPose(fromInput, toInput, alpha) {
  const from = normalizeOutgoingPose(fromInput);
  const to = normalizeOutgoingPose(toInput, from.compatibleRig);
  const joints = {};
  const jointIds = new Set([...Object.keys(from.joints), ...Object.keys(to.joints)]);
  for (const jointId of jointIds) {
    joints[jointId] = {
      rotation: slerpQuaternion(from.joints[jointId]?.rotation || IDENTITY, to.joints[jointId]?.rotation || IDENTITY, alpha),
    };
  }
  return {
    ...to,
    root: {
      position: lerpVector(from.root.position, to.root.position, alpha),
      rotation: slerpQuaternion(from.root.rotation, to.root.rotation, alpha),
    },
    joints,
  };
}

function makePoseContinuous(poseInput, referenceInput) {
  const pose = normalizeOutgoingPose(poseInput);
  if (!referenceInput) return pose;
  const reference = normalizeOutgoingPose(referenceInput, pose.compatibleRig);
  pose.root.rotation = continuousQuaternion(pose.root.rotation, reference.root.rotation);
  for (const jointId of Object.keys(pose.joints)) {
    pose.joints[jointId].rotation = continuousQuaternion(
      pose.joints[jointId].rotation,
      reference.joints[jointId]?.rotation || IDENTITY,
    );
  }
  return pose;
}

function continuousQuaternion(value, reference) {
  const normalized = normalizeQuaternion(value);
  return quaternionDot(normalized, normalizeQuaternion(reference)) < 0
    ? normalized.map((component) => -component)
    : normalized;
}
