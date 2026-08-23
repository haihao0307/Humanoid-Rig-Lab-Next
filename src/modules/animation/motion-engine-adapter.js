import { normalizeOutgoingPose } from '../../human-motion/solver/motion-math.js';
import { createCurrentKinematicAdapter } from '../../human-motion/solver/current-kinematic-adapter.js';

/** Keeps MotionSolverFrame on the existing outgoing AnimationPose contract. */
export function solverFrameToAnimationPose(frame) {
  if (frame?.schema !== 'humanoid_rig/motion_solver_frame@1.0') {
    throw new TypeError('Expected humanoid_rig/motion_solver_frame@1.0.');
  }
  return normalizeOutgoingPose(frame.outgoingPose, frame.compatibleRig);
}

/** Delegates the incoming-bone conversion to the existing animation runtime. */
export function buildMotionEngineV8Payload(frame, {
  bodyProfile = {},
  rigVersion = frame?.compatibleRig || 'rig@0.4.0',
  kinematicAdapter = null,
  poseName = 'Whole Body Motion Solver',
  updatedAt = null,
} = {}) {
  const adapter = kinematicAdapter || createCurrentKinematicAdapter({ bodyProfile, rigVersion });
  const animationPose = solverFrameToAnimationPose(frame);
  const fk = adapter.forwardKinematics(animationPose);
  const v8Payload = adapter.buildV8PosePayload(fk, {
    poseName,
    pinned: new Set((frame.contacts || []).filter((contact) => contact.active !== false).map((contact) => contact.jointId)),
    updatedAt: updatedAt || `motion-solver:${frame.goalId || 'none'}:${Number(frame.time).toFixed(4)}`,
  });
  return { animationPose, fk, v8Payload };
}
