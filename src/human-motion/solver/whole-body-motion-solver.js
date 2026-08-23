import { createMotionGoal, normalizeMotionGoal, validateMotionGoal } from '../goals/motion-goal.js';
import { BalanceController } from '../controllers/balance-controller.js';
import { ContactManager } from '../controllers/contact-manager.js';
import { EndEffectorController, END_EFFECTOR_CHAINS } from '../controllers/end-effector-controller.js';
import { GazeController } from '../controllers/gaze-controller.js';
import { InertializationController } from '../controllers/inertialization-controller.js';
import { PostureController } from '../controllers/posture-controller.js';
import { buildMotionSolverDiagnostics } from '../diagnostics/motion-solver-diagnostics.js';
import { createCurrentKinematicAdapter } from './current-kinematic-adapter.js';
import {
  IDENTITY,
  addVectors,
  mapToObject,
  normalizeOutgoingPose,
  normalizeQuaternion,
  unit,
} from './motion-math.js';

export const MOTION_SOLVER_FRAME_SCHEMA = 'humanoid_rig/motion_solver_frame@1.0';

export class WholeBodyMotionSolver {
  constructor({ bodyProfile = {}, rigVersion = 'rig@0.4.0', kinematicAdapter = null } = {}) {
    this.kinematic = kinematicAdapter || createCurrentKinematicAdapter({ bodyProfile, rigVersion });
    this.rigVersion = this.kinematic.context.rigVersion;
    this.contactManager = new ContactManager();
    this.balanceController = new BalanceController();
    this.endEffectorController = new EndEffectorController({ kinematicAdapter: this.kinematic });
    this.gazeController = new GazeController({ kinematicAdapter: this.kinematic });
    this.postureController = new PostureController({ kinematicAdapter: this.kinematic });
    this.inertialization = new InertializationController();
    this.initialPose = normalizeOutgoingPose({}, this.rigVersion);
    this.pose = normalizeOutgoingPose(this.initialPose, this.rigVersion);
    this.goal = null;
    this.frame = null;
    this.diagnostics = null;
    this.pendingTransition = null;
    this.disposed = false;
  }

  setPose(pose) {
    this.assertUsable();
    this.pose = normalizeOutgoingPose(pose, this.rigVersion);
    this.inertialization.observe(this.pose);
    return this;
  }

  setGoal(goalInput, { transitionDuration = 0.22 } = {}) {
    this.assertUsable();
    const goal = normalizeMotionGoal(goalInput);
    const validation = validateMotionGoal(goal, { jointIds: this.kinematic.getJointIds() });
    if (!validation.valid) throw new TypeError(validation.errors.join(' '));
    if (this.goal && (this.goal.goalId !== goal.goalId || this.goal.goalRevision !== goal.goalRevision)) {
      this.pendingTransition = { duration: transitionDuration, reason: 'goal_replacement' };
    }
    this.goal = goal;
    return this;
  }

  clearGoal({ transitionDuration = 0.18 } = {}) {
    this.assertUsable();
    if (this.goal) this.pendingTransition = { duration: transitionDuration, reason: 'goal_clear' };
    this.goal = null;
    this.contactManager.clear({ immediate: false });
    return this;
  }

  solve({ deltaTime = 1 / 60, time = 0 } = {}) {
    this.assertUsable();
    const startedAt = nowMs();
    const dt = Math.max(0, Math.min(0.25, Number(deltaTime) || 0));
    const previousPose = normalizeOutgoingPose(this.pose, this.rigVersion);
    const goal = this.goal || createMotionGoal({
      goalId: 'goal_maintain_pose',
      compatibleRig: this.rigVersion,
      root: { mode: 'maintain' },
      balance: { enabled: false, mode: 'airborne' },
    });
    let pose = normalizeOutgoingPose(this.pose, this.rigVersion);
    pose.time = Number(time) || 0;
    pose.rawTime = pose.time;

    pose = applyRootGoal(pose, goal);
    this.contactManager.syncGoalContacts(goal.contacts);
    const contacts = this.contactManager.update(dt);
    const contactTargets = contacts.map(contactToEndEffector);
    const taskReports = [];
    const solveIterations = goal.style.precision >= 0.8 ? 3 : 2;

    let contactResult = this.endEffectorController.solve(pose, contactTargets, { iterations: solveIterations });
    pose = contactResult.pose;
    let contactReports = contactResult.reports;
    taskReports.push(...contactReports);

    let fk = this.kinematic.forwardKinematics(pose);
    let balance = this.balanceController.evaluate(fk, contacts, goal.balance);
    for (let balancePass = 0; balancePass < 4
      && goal.balance.enabled
      && balance.supportMode !== 'airborne'
      && !balance.insideSupport; balancePass += 1) {
      pose.root.position = addVectors(pose.root.position, balance.pelvisCorrection);
      contactResult = this.endEffectorController.solve(pose, contactTargets, { iterations: solveIterations });
      pose = contactResult.pose;
      contactReports = contactResult.reports;
      fk = this.kinematic.forwardKinematics(pose);
      balance = this.balanceController.evaluate(fk, contacts, goal.balance);
    }
    taskReports.push({ task: 'balance', ...balance });

    const targetResult = this.endEffectorController.solve(pose, goal.endEffectors, { iterations: solveIterations });
    pose = targetResult.pose;
    let endEffectorReports = targetResult.reports;
    taskReports.push(...endEffectorReports);

    const gazeResult = this.gazeController.solve(pose, goal.gaze);
    pose = gazeResult.pose;
    if (gazeResult.report) taskReports.push(gazeResult.report);

    const protectedJoints = collectProtectedJoints(contacts, goal.endEffectors);
    const postureResult = this.postureController.solve(pose, goal.posture, goal.style, {
      protectedJoints,
      endEffectors: goal.endEffectors,
    });
    pose = postureResult.pose;
    taskReports.push(postureResult.report);

    // Re-assert high-priority constraints after low-priority posture and gaze.
    contactResult = this.endEffectorController.solve(pose, contactTargets, { iterations: solveIterations });
    pose = contactResult.pose;
    contactReports = contactResult.reports;
    const refinedTargets = this.endEffectorController.solve(pose, goal.endEffectors, { iterations: solveIterations });
    pose = refinedTargets.pose;
    endEffectorReports = refinedTargets.reports;

    if (this.pendingTransition) {
      this.inertialization.beginTransition(previousPose, pose, this.pendingTransition);
      this.pendingTransition = null;
    }
    pose = this.inertialization.applyTransition(pose, { deltaTime: dt });

    // Contact remains authoritative during a transition; free targets are allowed to blend.
    if (contactTargets.length) {
      contactResult = this.endEffectorController.solve(pose, contactTargets, { iterations: solveIterations });
      pose = contactResult.pose;
      contactReports = contactResult.reports;
    }

    fk = this.kinematic.forwardKinematics(pose);
    balance = this.balanceController.evaluate(fk, contacts, goal.balance);
    for (let balancePass = 0; balancePass < 4
      && goal.balance.enabled
      && balance.supportMode !== 'airborne'
      && !balance.insideSupport; balancePass += 1) {
      pose.root.position = addVectors(pose.root.position, balance.pelvisCorrection);
      contactResult = this.endEffectorController.solve(pose, contactTargets, { iterations: solveIterations });
      pose = contactResult.pose;
      contactReports = contactResult.reports;
      fk = this.kinematic.forwardKinematics(pose);
      balance = this.balanceController.evaluate(fk, contacts, goal.balance);
    }
    const transition = this.inertialization.getState();
    const solveTimeMs = nowMs() - startedAt;
    const diagnostics = buildMotionSolverDiagnostics({
      goal,
      fk,
      contacts,
      contactReports,
      endEffectorReports,
      balance,
      transition,
      previousPose,
      currentPose: pose,
      deltaTime: dt,
      solveIterations,
      solveTimeMs,
    });
    const positions = mapToObject(fk.positions);
    const worldRotations = mapToObject(fk.rotations, normalizeQuaternion);
    const jointRotations = Object.fromEntries(
      fk.rig.joints.map((joint) => [joint.id, joint.id === 'hips'
        ? [...pose.root.rotation]
        : [...(pose.joints[joint.id]?.rotation || IDENTITY)]]),
    );
    this.pose = normalizeOutgoingPose(pose, this.rigVersion);
    this.diagnostics = diagnostics;
    this.frame = {
      schema: MOTION_SOLVER_FRAME_SCHEMA,
      goalId: this.goal?.goalId ?? null,
      time: Number(time) || 0,
      deltaTime: dt,
      compatibleRig: this.rigVersion,
      outgoingPose: normalizeOutgoingPose(pose, this.rigVersion),
      root: { position: [...pose.root.position], rotation: [...pose.root.rotation] },
      jointRotations,
      fk: {
        authority: 'current-animation-runtime-fk',
        rigVersion: this.rigVersion,
        jointCount: fk.rig.joints.length,
        maxBoneLengthError: diagnostics.maxBoneLengthError,
      },
      positions,
      worldRotations,
      contacts,
      balance,
      taskReports,
      diagnostics,
    };
    return structuredClone(this.frame);
  }

  getFrame() {
    return this.frame ? structuredClone(this.frame) : null;
  }

  getDiagnostics() {
    return this.diagnostics ? structuredClone(this.diagnostics) : null;
  }

  reset() {
    this.assertUsable();
    this.pose = normalizeOutgoingPose(this.initialPose, this.rigVersion);
    this.goal = null;
    this.frame = null;
    this.diagnostics = null;
    this.pendingTransition = null;
    this.contactManager.clear();
    this.inertialization.reset();
    return this;
  }

  dispose() {
    this.contactManager.dispose();
    this.inertialization.reset();
    this.goal = null;
    this.frame = null;
    this.diagnostics = null;
    this.disposed = true;
  }

  assertUsable() {
    if (this.disposed) throw new Error('WholeBodyMotionSolver has been disposed.');
  }
}

function applyRootGoal(poseInput, goal) {
  const pose = normalizeOutgoingPose(poseInput, goal.compatibleRig);
  if (goal.root.mode !== 'maintain' && goal.root.targetPosition) pose.root.position = [...goal.root.targetPosition];
  if (goal.root.targetRotation) pose.root.rotation = [...goal.root.targetRotation];
  if (goal.posture.pelvisHeight != null) pose.root.position[1] = goal.posture.pelvisHeight;
  return pose;
}

function contactToEndEffector(contact) {
  return {
    id: contact.contactId,
    jointId: contact.jointId,
    targetPosition: contact.targetPosition,
    targetRotation: contact.targetRotation,
    positionWeight: contact.positionWeight,
    rotationWeight: contact.rotationWeight,
    poleTarget: contact.jointId.startsWith('left')
      ? [-0.1, contact.targetPosition[1] + 0.45, contact.targetPosition[2] + 0.45]
      : [0.1, contact.targetPosition[1] + 0.45, contact.targetPosition[2] + 0.45],
    priority: contact.priority,
    shoulderParticipation: 0,
    spineParticipation: 0,
  };
}

function collectProtectedJoints(contacts, endEffectors) {
  const protectedJoints = new Set();
  for (const item of [...contacts, ...endEffectors]) {
    const chain = END_EFFECTOR_CHAINS[item.jointId];
    if (chain) for (const id of [chain.assist, chain.upper, chain.middle, chain.end]) protectedJoints.add(id);
    else protectedJoints.add(item.jointId);
  }
  return protectedJoints;
}

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}
