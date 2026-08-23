import {
  buildIncomingBoneLocalRotations,
  buildV8PosePayload,
  createRigContext,
  forwardKinematics,
  resolveAnatomicalRotation,
} from '../../modules/animation/runtime.js';

/**
 * Temporary boundary around the current runtime kinematics. The Canonical
 * Foundation integration can replace this object without changing controllers.
 */
export class CurrentKinematicAdapter {
  constructor({ bodyProfile = {}, rigVersion = 'rig@0.4.0' } = {}) {
    this.context = createRigContext(bodyProfile, { rigVersion });
  }

  createContext(bodyProfile = this.context.bodyProfile, rigVersion = this.context.rigVersion) {
    this.context = createRigContext(bodyProfile, { rigVersion });
    return this.context;
  }

  forwardKinematics(pose, context = this.context) {
    return forwardKinematics(pose, context);
  }

  resolveAnatomicalRotation(jointId, twist = 0, bend = 0, side = 0, options = {}, context = this.context) {
    return resolveAnatomicalRotation(context, jointId, twist, bend, side, options);
  }

  buildIncomingBoneLocalRotations(fk, options = {}) {
    return buildIncomingBoneLocalRotations(fk, options);
  }

  buildV8PosePayload(fk, options = {}) {
    return buildV8PosePayload(fk, options);
  }

  getJointIds() {
    return new Set(this.context.joints.map((joint) => joint.id));
  }
}

export function createCurrentKinematicAdapter(options = {}) {
  return new CurrentKinematicAdapter(options);
}
