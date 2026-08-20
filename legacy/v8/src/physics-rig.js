import { BiomechanicsSolver } from './biomechanics.js';
import {
  computePoseWorldPositions,
  computeRestWorldPositions,
  getBoneLength,
  markPoseModified,
} from './skeleton-model.js';

const EPSILON = 1e-10;
const LENGTH_TOLERANCE = 1e-8;
const GROUND_TOLERANCE = 1e-8;
const POSE_SNAPSHOT_SCHEMA = 'humanoid_rig/pose_snapshot@1.0';
const POSE_ROTATION_CONVENTION = 'incoming_bone_bind_delta_zero_twist';
const DEFAULT_OPTIONS = Object.freeze({
  enabled: true,
  paused: false,
  gravityEnabled: false,
  groundEnabled: true,
  groundY: 0,
  gravity: -9.81,
  gravityScale: 0.38,
  damping: 0.92,
  bodyCoupling: 0.8,
  solverIterations: 64,
  jointLimits: true,
  anatomyEnabled: true,
  substeps: 2,
  poseStiffness: 0.18,
  torsoStiffness: 0.86,
  dragStiffness: 0.82,
  friction: 0.86,
  releaseMomentum: 0.22,
  exactTolerance: LENGTH_TOLERANCE,
  exactMaxPasses: 720,
});

/**
 * Full-body position-based dynamics solver.
 *
 * The bind hierarchy and localPosition values are immutable. Runtime posing is
 * stored only in poseWorldPosition. Parent-child segments are projected back to
 * their bind lengths after every drag and simulation step. Drag targets are
 * deliberately compliant, so an unreachable mouse target produces target lag
 * instead of changing a bone's dimensions.
 */
export class PhysicsRig {
  constructor(definition, options = {}) {
    this.definition = null;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    if ('anatomyEnabled' in options && !('jointLimits' in options)) {
      this.options.jointLimits = Boolean(options.anatomyEnabled);
    }
    this.options.anatomyEnabled = this.options.jointLimits !== false;
    this.ids = [];
    this.indexById = new Map();
    this.positions = new Float64Array(0);
    this.previous = new Float64Array(0);
    this.inverseMass = new Float64Array(0);
    this.primaryConstraints = [];
    this.shapeConstraints = [];
    this.biomechanics = null;
    this.pinnedTargets = new Map();
    this.drag = null;
    this.active = true;
    this.lastPoseImportStats = null;
    this.lastProjectionStats = {
      maxBoneError: 0,
      maxGroundPenetration: 0,
      exactPasses: 0,
      dragTargetError: 0,
      maxJointViolation: 0,
      rigidPelvisError: 0,
    };
    this.setDefinition(definition);
  }

  setDefinition(definition, { preservePose = true } = {}) {
    this.definition = definition;
    this.ids = definition.joints.map((joint) => joint.id);
    this.indexById = new Map(this.ids.map((id, index) => [id, index]));

    const count = this.ids.length;
    this.positions = new Float64Array(count * 3);
    this.previous = new Float64Array(count * 3);
    this.inverseMass = new Float64Array(count);
    this.primaryConstraints = [];
    this.shapeConstraints = [];
    this.biomechanics = null;
    this.pinnedTargets = new Map();
    this.drag = null;

    const bindWorld = computeRestWorldPositions(definition);
    const poseWorld = preservePose ? computePoseWorldPositions(definition) : bindWorld;

    definition.joints.forEach((joint, index) => {
      const point = poseWorld.get(joint.id) ?? bindWorld.get(joint.id);
      setArrayPoint(this.positions, index, point);
      setArrayPoint(this.previous, index, point);
      this.inverseMass[index] = inverseMassForJoint(joint);
    });

    for (const joint of definition.joints) {
      if (!joint.parentId || joint.physicalBone === false) {
        continue;
      }
      const a = this.indexById.get(joint.parentId);
      const b = this.indexById.get(joint.id);
      if (a == null || b == null) {
        continue;
      }
      const bindA = bindWorld.get(joint.parentId);
      const bindB = bindWorld.get(joint.id);
      this.primaryConstraints.push({
        a,
        b,
        length: getBoneLength(definition, joint.id),
        type: 'bone',
        jointId: joint.id,
        fallbackDirection: normalizedDirection(bindA, bindB),
      });
    }

    this.buildShapeConstraintTopology();
    this.biomechanics = new BiomechanicsSolver(this);
    this.capturePoseTargets();
    this.projectConstraints(Math.max(48, this.options.solverIterations));
    this.refreshPinTargets();
    this.projectPrimaryExact({
      tolerance: this.options.exactTolerance,
      maxPasses: this.options.exactMaxPasses,
      includeGround: this.options.groundEnabled,
    });
    this.zeroVelocities({ capturePose: true });
    this.writePoseToDefinition(false);
    this.active = false;
  }

  setOptions(partial = {}) {
    const defined = Object.fromEntries(
      Object.entries(partial).filter(([, value]) => value !== undefined),
    );
    const next = { ...this.options, ...defined };
    next.damping = clamp(next.damping, 0, 0.9995);
    next.bodyCoupling = clamp(next.bodyCoupling, 0, 1);
    next.solverIterations = Math.round(clamp(next.solverIterations, 4, 128));
    next.substeps = Math.round(clamp(next.substeps, 1, 6));
    next.poseStiffness = clamp(next.poseStiffness, 0, 1);
    next.torsoStiffness = clamp(next.torsoStiffness, 0, 1);
    next.dragStiffness = clamp(next.dragStiffness, 0.05, 0.98);
    next.gravityScale = clamp(next.gravityScale, 0, 3);
    next.friction = clamp(next.friction, 0, 1);
    next.exactTolerance = clamp(next.exactTolerance, 1e-12, 1e-4);
    next.exactMaxPasses = Math.round(clamp(next.exactMaxPasses, 64, 1600));
    if ('jointLimits' in defined) {
      next.jointLimits = Boolean(defined.jointLimits);
    } else if ('anatomyEnabled' in defined) {
      next.jointLimits = Boolean(defined.anatomyEnabled);
    }
    next.anatomyEnabled = next.jointLimits !== false;
    this.options = next;

    if (this.definition) {
      this.definition.physics = {
        ...(this.definition.physics ?? {}),
        enabled: Boolean(next.enabled),
        gravityEnabled: Boolean(next.gravityEnabled),
        groundEnabled: Boolean(next.groundEnabled),
        poseStiffness: next.poseStiffness,
        bodyCoupling: next.bodyCoupling,
        damping: next.damping,
        solverIterations: next.solverIterations,
        jointLimits: next.jointLimits,
        anatomyEnabled: next.anatomyEnabled,
      };
      this.definition.biomechanics = {
        ...(this.definition.biomechanics ?? {}),
        enabled: true,
        hardLimits: next.jointLimits,
      };
    }
    this.active = Boolean(this.drag) || Boolean(next.gravityEnabled);
  }

  getOptions() {
    return { ...this.options };
  }

  step(deltaSeconds = 1 / 60) {
    if (!this.definition || !this.options.enabled) {
      return false;
    }
    if (this.options.paused && !this.drag) {
      return false;
    }

    const dt = clamp(Number(deltaSeconds) || 1 / 60, 1 / 240, 1 / 20);
    const substeps = this.options.substeps;
    const subDt = dt / substeps;
    let moved = false;

    for (let substep = 0; substep < substeps; substep += 1) {
      moved = this.integrate(subDt) || moved;
      this.projectConstraints(this.options.solverIterations);
    }

    this.writePoseToDefinition(true);
    const speed = this.getMaximumSpeed(dt);
    this.active = Boolean(this.drag)
      || Boolean(this.options.gravityEnabled)
      || speed > 2e-5;
    return moved || this.active;
  }

  integrate(dt) {
    const gravityY = this.options.gravityEnabled
      ? this.options.gravity * this.options.gravityScale
      : 0;
    let moved = false;

    for (let index = 0; index < this.ids.length; index += 1) {
      const joint = this.definition.joints[index];
      if (joint?.isControl || this.isPinnedAndNotDragged(index)) {
        continue;
      }
      const offset = index * 3;
      const x = this.positions[offset];
      const y = this.positions[offset + 1];
      const z = this.positions[offset + 2];
      const vx = (x - this.previous[offset]) * this.options.damping;
      const vy = (y - this.previous[offset + 1]) * this.options.damping;
      const vz = (z - this.previous[offset + 2]) * this.options.damping;

      this.previous[offset] = x;
      this.previous[offset + 1] = y;
      this.previous[offset + 2] = z;
      this.positions[offset] = x + vx;
      this.positions[offset + 1] = y + vy + gravityY * dt * dt;
      this.positions[offset + 2] = z + vz;
      moved = moved || Math.abs(vx) + Math.abs(vy) + Math.abs(vz) > 1e-8;
    }
    return moved;
  }

  /**
   * Runs soft whole-body coupling, target attraction, floor contact, then an
   * adaptive exact-length projection. The final pass never reapplies a drag
   * target, which prevents the mouse from stretching a segment.
   */
  projectConstraints(iterations = this.options.solverIterations) {
    if (!this.definition) {
      return this.lastProjectionStats;
    }

    const count = Math.max(1, Math.round(iterations));
    const poseIterationStiffness = iterationStiffness(
      this.options.poseStiffness * this.options.bodyCoupling,
      count,
    );
    const torsoIterationStiffness = iterationStiffness(this.options.torsoStiffness, count);
    const dragIterationStiffness = clamp(0.08 + this.options.dragStiffness * 0.24, 0.08, 0.32);

    for (let iteration = 0; iteration < count; iteration += 1) {
      this.applyPinnedTargets();
      this.applyDragTargetsSoft(dragIterationStiffness);

      for (const constraint of this.shapeConstraints) {
        const stiffness = constraint.group === 'torso'
          ? torsoIterationStiffness * constraint.strength
          : poseIterationStiffness * constraint.strength;
        if (stiffness > 0) {
          this.solveDistanceConstraint(constraint, stiffness, 'dynamic');
        }
      }

      this.solvePrimarySweep(iteration % 2 === 0);
      this.solvePrimarySweep(iteration % 2 !== 0);

      // Anatomical envelopes are hard constraints. Re-run the fixed-length
      // chain immediately afterwards so joint-limit corrections never stretch
      // a segment.
      this.biomechanics?.solve(0.92);
      this.solvePrimarySweep(iteration % 2 !== 0);
      this.solvePrimarySweep(iteration % 2 === 0);

      if (this.options.groundEnabled) {
        this.solveGroundCollision();
      }
      this.applyPinnedTargets();
      this.syncControlNodes();
    }

    const stats = this.projectPrimaryExact({
      tolerance: this.options.exactTolerance,
      maxPasses: this.options.exactMaxPasses,
      includeGround: this.options.groundEnabled,
    });
    stats.dragTargetError = this.getDragTargetError();
    this.lastProjectionStats = stats;
    return stats;
  }

  /**
   * Adaptive hard projection for bind bone lengths. Drag targets are excluded
   * here, so infeasible targets yield naturally while all dimensions stay fixed.
   */
  projectPrimaryExact({
    tolerance = LENGTH_TOLERANCE,
    maxPasses = 720,
    includeGround = this.options.groundEnabled,
  } = {}) {
    const minimumPasses = 12;
    const jointToleranceDegrees = 0.05;
    let maxError = Infinity;
    let maxGroundPenetration = Infinity;
    let maxJointViolation = Infinity;
    let rigidPelvisError = Infinity;
    let pass = 0;

    for (; pass < maxPasses; pass += 1) {
      this.applyPinnedTargets();

      const forwardFirst = pass % 2 === 0;
      this.solvePrimarySweep(forwardFirst);
      this.solvePrimarySweep(!forwardFirst);

      // Angle and pelvis constraints can move both ends of a segment. The
      // following structural sweeps absorb those corrections while retaining
      // the anatomical solution.
      this.biomechanics?.solve(1);
      this.solvePrimarySweep(!forwardFirst);
      this.solvePrimarySweep(forwardFirst);

      if (includeGround) {
        this.solveGroundCollision();
      }
      this.applyPinnedTargets();
      this.biomechanics?.solve(1);
      this.solvePrimarySweep(forwardFirst);
      this.solvePrimarySweep(!forwardFirst);
      this.applyPinnedTargets();
      this.syncControlNodes();

      if (pass + 1 >= minimumPasses && (pass + 1) % 4 === 0) {
        maxError = this.getMaxBoneError();
        maxGroundPenetration = includeGround ? this.getMaxGroundPenetration() : 0;
        maxJointViolation = this.getMaxJointLimitViolation();
        rigidPelvisError = this.getRigidPelvisError();
        if (
          maxError <= tolerance
          && maxGroundPenetration <= GROUND_TOLERANCE
          && maxJointViolation <= jointToleranceDegrees
          && rigidPelvisError <= tolerance
        ) {
          break;
        }
      }
    }

    if (!Number.isFinite(maxError)) {
      maxError = this.getMaxBoneError();
    }
    if (!Number.isFinite(maxGroundPenetration)) {
      maxGroundPenetration = includeGround ? this.getMaxGroundPenetration() : 0;
    }
    if (!Number.isFinite(maxJointViolation)) {
      maxJointViolation = this.getMaxJointLimitViolation();
    }
    if (!Number.isFinite(rigidPelvisError)) {
      rigidPelvisError = this.getRigidPelvisError();
    }

    this.syncControlNodes();
    return {
      maxBoneError: maxError,
      maxGroundPenetration,
      exactPasses: Math.min(maxPasses, pass + 1),
      dragTargetError: this.getDragTargetError(),
      maxJointViolation,
      rigidPelvisError,
    };
  }

  solvePrimarySweep(forward = true) {
    if (forward) {
      for (let index = 0; index < this.primaryConstraints.length; index += 1) {
        this.solveDistanceConstraint(this.primaryConstraints[index], 1, 'dynamic');
      }
      return;
    }
    for (let index = this.primaryConstraints.length - 1; index >= 0; index -= 1) {
      this.solveDistanceConstraint(this.primaryConstraints[index], 1, 'dynamic');
    }
  }

  solveDistanceConstraint(constraint, stiffness, massMode = 'dynamic') {
    const aOffset = constraint.a * 3;
    const bOffset = constraint.b * 3;
    let dx = this.positions[bOffset] - this.positions[aOffset];
    let dy = this.positions[bOffset + 1] - this.positions[aOffset + 1];
    let dz = this.positions[bOffset + 2] - this.positions[aOffset + 2];
    const measuredLength = Math.hypot(dx, dy, dz);

    if (measuredLength < EPSILON) {
      const direction = constraint.fallbackDirection ?? { x: 1, y: 0, z: 0 };
      dx = direction.x;
      dy = direction.y;
      dz = direction.z;
    } else {
      dx /= measuredLength;
      dy /= measuredLength;
      dz /= measuredLength;
    }

    const weightA = massMode === 'equal'
      ? (this.isPinnedAndNotDragged(constraint.a) ? 0 : 1)
      : this.getEffectiveInverseMass(constraint.a);
    const weightB = massMode === 'equal'
      ? (this.isPinnedAndNotDragged(constraint.b) ? 0 : 1)
      : this.getEffectiveInverseMass(constraint.b);
    const weightTotal = weightA + weightB;
    if (weightTotal < EPSILON) {
      return;
    }

    const error = measuredLength - constraint.length;
    const correction = error * stiffness;
    const shareA = weightA / weightTotal;
    const shareB = weightB / weightTotal;

    this.positions[aOffset] += dx * correction * shareA;
    this.positions[aOffset + 1] += dy * correction * shareA;
    this.positions[aOffset + 2] += dz * correction * shareA;
    this.positions[bOffset] -= dx * correction * shareB;
    this.positions[bOffset + 1] -= dy * correction * shareB;
    this.positions[bOffset + 2] -= dz * correction * shareB;
  }

  solveGroundCollision() {
    const floor = Number(this.options.groundY) || 0;
    for (let index = 0; index < this.ids.length; index += 1) {
      if (this.definition.joints[index]?.isControl || this.isPinnedAndNotDragged(index)) {
        continue;
      }
      const offset = index * 3;
      if (this.positions[offset + 1] >= floor) {
        continue;
      }
      this.positions[offset + 1] = floor;
      this.previous[offset] = this.positions[offset]
        - (this.positions[offset] - this.previous[offset]) * this.options.friction;
      this.previous[offset + 2] = this.positions[offset + 2]
        - (this.positions[offset + 2] - this.previous[offset + 2]) * this.options.friction;
      this.previous[offset + 1] = floor;
    }
  }

  beginDrag({ jointId, kind = 'joint', anchorWorld = null } = {}) {
    const childIndex = this.indexById.get(jointId);
    if (childIndex == null || this.definition.joints[childIndex]?.isControl) {
      return false;
    }

    const now = performanceNow();
    const current = this.getPointByIndex(childIndex);
    if (kind === 'bone') {
      const joint = this.definition.joints[childIndex];
      const parentIndex = joint?.parentId ? this.indexById.get(joint.parentId) : null;
      if (parentIndex == null) {
        return this.beginDrag({ jointId, kind: 'joint', anchorWorld });
      }
      const parentPoint = this.getPointByIndex(parentIndex);
      const anchor = anchorWorld
        ? normalizePoint(anchorWorld, midpoint(parentPoint, current))
        : midpoint(parentPoint, current);
      this.drag = {
        kind: 'bone',
        jointId,
        indices: [parentIndex, childIndex],
        anchor,
        target: clonePoint(anchor),
        offsets: [subtract(parentPoint, anchor), subtract(current, anchor)],
        lastTarget: clonePoint(anchor),
        lastTime: now,
        velocity: { x: 0, y: 0, z: 0 },
      };
    } else {
      const anchor = anchorWorld ? normalizePoint(anchorWorld, current) : current;
      this.drag = {
        kind: 'joint',
        jointId,
        indices: [childIndex],
        anchor,
        target: clonePoint(anchor),
        offsets: [subtract(current, anchor)],
        lastTarget: clonePoint(anchor),
        lastTime: now,
        velocity: { x: 0, y: 0, z: 0 },
      };
    }

    this.active = true;
    return true;
  }

  updateDragTarget(point) {
    if (!this.drag) {
      return false;
    }
    const target = normalizePoint(point, this.drag.target);
    const now = performanceNow();
    const elapsed = Math.max(1 / 240, (now - this.drag.lastTime) / 1000);
    this.drag.velocity = {
      x: (target.x - this.drag.lastTarget.x) / elapsed,
      y: (target.y - this.drag.lastTarget.y) / elapsed,
      z: (target.z - this.drag.lastTarget.z) / elapsed,
    };
    this.drag.target = target;
    this.drag.lastTarget = clonePoint(target);
    this.drag.lastTime = now;
    this.projectConstraints(Math.max(32, this.options.solverIterations));
    this.writePoseToDefinition(true);
    this.active = true;
    return true;
  }

  endDrag({ keepMomentum = true } = {}) {
    if (!this.drag) {
      return false;
    }

    // One final exact solve is performed while the drag indices are still known,
    // allowing a moved pinned joint to be treated as part of the handle.
    this.projectConstraints(Math.max(40, this.options.solverIterations));
    const released = this.drag;
    this.drag = null;

    for (const index of released.indices) {
      const point = this.getPointByIndex(index);
      if (this.pinnedTargets.has(index)) {
        this.pinnedTargets.set(index, clonePoint(point));
      }
    }

    // Reconcile any remaining support constraints without reapplying the mouse
    // target. This is the dimension-locking step for unreachable targets.
    this.projectPrimaryExact({
      tolerance: this.options.exactTolerance,
      maxPasses: this.options.exactMaxPasses,
      includeGround: this.options.groundEnabled,
    });

    if (keepMomentum) {
      const velocity = released.velocity;
      const momentum = this.options.releaseMomentum;
      for (const index of released.indices) {
        const offset = index * 3;
        if (this.pinnedTargets.has(index)) {
          const point = this.getPointByIndex(index);
          setArrayPoint(this.previous, index, point);
          continue;
        }
        this.previous[offset] = this.positions[offset] - velocity.x * (1 / 60) * momentum;
        this.previous[offset + 1] = this.positions[offset + 1] - velocity.y * (1 / 60) * momentum;
        this.previous[offset + 2] = this.positions[offset + 2] - velocity.z * (1 / 60) * momentum;
      }
    } else {
      this.previous.set(this.positions);
    }

    this.capturePoseTargets();
    this.writePoseToDefinition(true);
    this.active = Boolean(keepMomentum && this.options.gravityEnabled);
    return true;
  }

  moveJointTo(jointId, point) {
    if (!this.beginDrag({ jointId, kind: 'joint' })) {
      return false;
    }
    this.updateDragTarget(point);
    this.endDrag({ keepMomentum: false });
    this.zeroVelocities({ capturePose: true });
    this.writePoseToDefinition(true);
    return true;
  }

  moveBoneTo(jointId, point) {
    if (!this.beginDrag({ jointId, kind: 'bone' })) {
      return false;
    }
    this.updateDragTarget(point);
    this.endDrag({ keepMomentum: false });
    this.zeroVelocities({ capturePose: true });
    this.writePoseToDefinition(true);
    return true;
  }

  togglePin(jointId) {
    const index = this.indexById.get(jointId);
    if (index == null) {
      return false;
    }
    const nextPinned = !this.pinnedTargets.has(index);
    this.setPinned(jointId, nextPinned);
    return nextPinned;
  }

  setPinned(jointId, pinned) {
    const index = this.indexById.get(jointId);
    if (index == null || this.definition.joints[index]?.isControl) {
      return false;
    }
    const joint = this.definition.joints[index];
    joint.pinned = Boolean(pinned);
    if (joint.pinned) {
      const point = this.getPointByIndex(index);
      this.pinnedTargets.set(index, clonePoint(point));
      setArrayPoint(this.previous, index, point);
    } else {
      this.pinnedTargets.delete(index);
    }
    // Pinning the current point must be a state change only. Reprojecting here
    // can introduce a new over-constrained solve when a second support is added.
    // Subsequent drag, gravity, import and explicit solve paths already enforce
    // every structural and anatomical constraint against the stored target.
    this.capturePoseTargets();
    this.writePoseToDefinition(false);
    this.active = Boolean(this.options.gravityEnabled);
    return joint.pinned;
  }

  clearPins() {
    this.pinnedTargets.clear();
    for (const joint of this.definition.joints) {
      joint.pinned = false;
    }
    this.capturePoseTargets();
    this.active = Boolean(this.options.gravityEnabled);
  }

  resetFromDefinitionPose({ project = true } = {}) {
    const pose = computePoseWorldPositions(this.definition);
    for (let index = 0; index < this.ids.length; index += 1) {
      const point = pose.get(this.ids[index]);
      setArrayPoint(this.positions, index, point);
      setArrayPoint(this.previous, index, point);
    }
    // Reconcile an imported pose without treating its pin coordinates as hard
    // constraints. Pin flags are restored at the nearest valid fixed-length pose.
    this.pinnedTargets = new Map();
    this.capturePoseTargets();
    if (project) {
      this.projectConstraints(Math.max(48, this.options.solverIterations));
    }
    this.refreshPinTargets();
    this.projectPrimaryExact({
      tolerance: this.options.exactTolerance,
      maxPasses: this.options.exactMaxPasses,
      includeGround: this.options.groundEnabled,
    });
    this.zeroVelocities({ capturePose: true });
    this.writePoseToDefinition(false);
    this.active = false;
  }

  resetToBindPose() {
    const pinnedIds = new Set(
      this.definition.joints.filter((joint) => joint.pinned).map((joint) => joint.id),
    );
    const rest = computeRestWorldPositions(this.definition);
    for (let index = 0; index < this.ids.length; index += 1) {
      const point = rest.get(this.ids[index]);
      setArrayPoint(this.positions, index, point);
      setArrayPoint(this.previous, index, point);
      this.definition.joints[index].pinned = pinnedIds.has(this.ids[index]);
    }
    this.refreshPinTargets();
    this.capturePoseTargets();
    this.projectPrimaryExact({
      tolerance: this.options.exactTolerance,
      maxPasses: this.options.exactMaxPasses,
      includeGround: this.options.groundEnabled,
    });
    markPoseModified(this.definition, this.definition.bindPose || 'BIND');
    this.zeroVelocities({ capturePose: true });
    this.writePoseToDefinition(false);
    this.active = false;
  }

  zeroVelocities({ capturePose = true } = {}) {
    this.previous.set(this.positions);
    if (capturePose) {
      this.capturePoseTargets();
    }
    this.active = Boolean(this.drag) || Boolean(this.options.gravityEnabled);
  }

  /** Captures the current solved pose as the soft full-body reference. */
  capturePoseTargets() {
    for (const constraint of this.shapeConstraints) {
      const a = this.getPointByIndex(constraint.a);
      const b = this.getPointByIndex(constraint.b);
      constraint.length = distance(a, b);
      constraint.fallbackDirection = normalizedDirection(a, b, constraint.fallbackDirection);
    }
  }

  commitCurrentPose() {
    this.projectPrimaryExact({
      tolerance: this.options.exactTolerance,
      maxPasses: this.options.exactMaxPasses,
      includeGround: this.options.groundEnabled,
    });
    this.previous.set(this.positions);
    this.capturePoseTargets();
    this.writePoseToDefinition(false);
    this.active = Boolean(this.options.gravityEnabled);
  }

  /**
   * Builds the canonical single-frame pose contract used by the pose and
   * animation modules. The current V8 solver is position based, so local
   * rotations are reconstructed as hierarchical zero-twist bind deltas and the
   * conversion error is reported explicitly.
   */
  buildPoseSnapshot({
    compatibleRig = this.definition?.rigVersion ?? 'rig@0.4.0',
    name = this.definition?.pose ?? 'CUSTOM',
    includeWorldPositions = false,
    source = 'physics-rig-v8.4',
  } = {}) {
    if (!this.definition) {
      throw new Error('Cannot build a pose snapshot without a rig definition.');
    }
    const rest = computeRestWorldPositions(this.definition);
    const pose = new Map(this.ids.map((id, index) => [id, this.getPointByIndex(index)]));
    const rootJointId = this.indexById.has('hips')
      ? 'hips'
      : this.definition.joints.find((joint) => !joint.isControl)?.id;
    if (!rootJointId) {
      throw new Error('Cannot identify the pose root joint.');
    }

    const rootFrameRotation = computeRootFrameRotation(
      rest,
      pose,
      this.biomechanics?.lastForward,
    );
    const rotations = extractLocalRotations(
      this.definition,
      rest,
      pose,
      rootJointId,
      rootFrameRotation,
    );
    const rootRest = rest.get(rootJointId);
    const rootPose = pose.get(rootJointId);
    const snapshot = {
      schema: POSE_SNAPSHOT_SCHEMA,
      schemaVersion: 1,
      type: 'PoseSnapshot',
      compatibleRig: String(compatibleRig),
      solverVersion: 'physics-rig-position-pbd@0.4.2',
      name: String(name),
      unit: 'meter',
      coordinateSystem: {
        handedness: 'right',
        upAxis: '+Y',
        forwardAxis: '+Z',
        rightAxis: '+X',
      },
      source,
      sourceRepresentation: 'world_position_pbd',
      rotationSpace: 'local',
      rotationConvention: POSE_ROTATION_CONVENTION,
      rootJointId,
      rootTranslation: pointToArray(subtract(rootPose, rootRest)),
      rootRotation: quaternionToArray(rotations.rootRotation),
      localRotations: Object.fromEntries(
        Object.entries(rotations.localRotations).map(([id, quaternion]) => [id, quaternionToArray(quaternion)]),
      ),
      ikTargets: this.getIKTargets(),
      pinnedJoints: this.getPinnedConstraints(),
      constraints: {
        fixedBoneLengths: true,
        rigidPelvis: true,
        jointLimits: this.options.jointLimits !== false,
        bodyCoupling: this.options.bodyCoupling,
        damping: this.options.damping,
        gravity: {
          enabled: Boolean(this.options.gravityEnabled),
          scale: this.options.gravityScale,
        },
        ground: {
          enabled: Boolean(this.options.groundEnabled),
          y: Number(this.options.groundY) || 0,
        },
        solverIterations: this.options.solverIterations,
      },
      updatedAt: new Date().toISOString(),
    };

    const reconstructed = reconstructPoseSnapshot(this.definition, rest, snapshot);
    let maximumReconstructionError = 0;
    let totalReconstructionError = 0;
    let reconstructionCount = 0;
    for (const joint of this.definition.joints) {
      if (joint.isControl || !reconstructed.has(joint.id)) continue;
      const error = distance(reconstructed.get(joint.id), pose.get(joint.id));
      maximumReconstructionError = Math.max(maximumReconstructionError, error);
      totalReconstructionError += error;
      reconstructionCount += 1;
    }
    const rotationReconstructionToleranceM = 1e-4;
    const positionReconstructionLossy = maximumReconstructionError > rotationReconstructionToleranceM;
    snapshot.diagnostics = {
      maxBoneErrorM: this.getMaxBoneError(),
      rigidPelvisErrorM: this.getRigidPelvisError(),
      maxJointLimitViolationDegrees: this.getMaxJointLimitViolation(),
      rotationDataCompleteness: 'bone_direction_only',
      twistDataAvailable: false,
      jointAxisAdapterRequiredForStandardAnimation: true,
      rotationReconstructionToleranceM,
      rotationReconstructionMaxErrorM: maximumReconstructionError,
      rotationReconstructionMeanErrorM: reconstructionCount
        ? totalReconstructionError / reconstructionCount
        : 0,
      positionReconstructionLossy,
      lossyRotationConversion: true,
      warningCodes: ['AXIAL_TWIST_UNAVAILABLE_FROM_WORLD_POSITION_SOURCE'],
    };
    if (includeWorldPositions) {
      snapshot.worldPositions = Object.fromEntries(
        this.definition.joints
          .filter((joint) => !joint.isControl)
          .map((joint) => [joint.id, pointToArray(pose.get(joint.id))]),
      );
    }
    return snapshot;
  }

  /** Applies a canonical PoseSnapshot without touching bind dimensions. */
  applyPoseSnapshot(
    snapshot,
    { project = true, applyConstraintSettings = true, preservePinTargets = false } = {},
  ) {
    assertSupportedPoseSnapshot(snapshot, this.indexById, this.definition);
    if (applyConstraintSettings && snapshot.constraints) {
      this.setOptions({
        bodyCoupling: snapshot.constraints.bodyCoupling,
        damping: snapshot.constraints.damping,
        jointLimits: snapshot.constraints.jointLimits,
        gravityEnabled: snapshot.constraints.gravity?.enabled,
        gravityScale: snapshot.constraints.gravity?.scale,
        groundEnabled: snapshot.constraints.ground?.enabled,
        groundY: snapshot.constraints.ground?.y,
        solverIterations: snapshot.constraints.solverIterations,
      });
    }

    const rest = computeRestWorldPositions(this.definition);
    const reconstructed = reconstructPoseSnapshot(this.definition, rest, snapshot);
    let applied = 0;
    for (let index = 0; index < this.ids.length; index += 1) {
      const point = reconstructed.get(this.ids[index]);
      if (!point) continue;
      setArrayPoint(this.positions, index, point);
      setArrayPoint(this.previous, index, point);
      applied += 1;
    }
    if (applied === 0) {
      throw new Error('PoseSnapshot does not match the current rig.');
    }

    if (this.biomechanics) {
      const restFrame = computePelvisFrame(rest, { x: 0, y: 0, z: 1 });
      this.biomechanics.lastForward = normalizeVectorPoint(
        rotatePointByQuaternion(arrayToQuaternion(snapshot.rootRotation), restFrame.forward),
      );
    }

    const requestedPins = normalizePinnedConstraints(snapshot.pinnedJoints);
    this.pinnedTargets.clear();
    for (const joint of this.definition.joints) joint.pinned = false;

    // Reconcile the quaternion pose before restoring supports. A source pose can
    // contain tiny residual projection errors, and imposing two exact world
    // targets during that reconciliation can push an extreme pose into a
    // different solver basin. The default import pins each requested joint at
    // its nearest valid reconstructed position. Exact source targets remain an
    // explicit opt-in for workflows that require them.
    if (project) {
      this.projectPrimaryExact({
        tolerance: this.options.exactTolerance,
        maxPasses: this.options.exactMaxPasses,
        includeGround: this.options.groundEnabled,
      });
    }

    let maximumPinRemapError = 0;
    let appliedPins = 0;
    for (const pin of requestedPins) {
      const index = this.indexById.get(String(pin?.jointId ?? ''));
      if (index == null || this.definition.joints[index]?.isControl) continue;
      const current = this.getPointByIndex(index);
      const requested = normalizePoint(pin.targetWorld, current);
      const target = preservePinTargets ? requested : current;
      maximumPinRemapError = Math.max(maximumPinRemapError, distance(current, requested));
      this.definition.joints[index].pinned = true;
      this.pinnedTargets.set(index, clonePoint(target));
      appliedPins += 1;
    }
    if (project && preservePinTargets && appliedPins > 0) {
      this.projectPrimaryExact({
        tolerance: this.options.exactTolerance,
        maxPasses: this.options.exactMaxPasses,
        includeGround: this.options.groundEnabled,
      });
    }
    this.lastPoseImportStats = {
      appliedJoints: applied,
      requestedPins: requestedPins.length,
      appliedPins,
      preservePinTargets: Boolean(preservePinTargets),
      maximumPinRemapErrorM: maximumPinRemapError,
    };
    this.capturePoseTargets();
    this.zeroVelocities({ capturePose: false });
    this.writePoseToDefinition(true);
    return applied;
  }

  getPinnedConstraints() {
    return Object.fromEntries([...this.pinnedTargets.entries()].map(([index, target]) => {
      const jointId = this.ids[index];
      return [jointId, {
        jointId,
        targetWorld: pointToArray(target),
        mode: 'world',
        weight: 1,
      }];
    }));
  }

  getPoseImportStats() {
    return this.lastPoseImportStats ? { ...this.lastPoseImportStats } : null;
  }

  getIKTargets() {
    if (!this.drag) return [];
    return this.drag.indices.map((index, targetIndex) => ({
      targetId: `drag:${this.drag.jointId}:${targetIndex}`,
      jointId: this.ids[index],
      kind: this.drag.kind,
      targetWorld: pointToArray(add(this.drag.target, this.drag.offsets[targetIndex])),
      weight: 1,
      transient: true,
    }));
  }

  getPoint(jointId) {
    const index = this.indexById.get(jointId);
    return index == null ? null : this.getPointByIndex(index);
  }

  getPointByIndex(index) {
    return getArrayPoint(this.positions, index);
  }

  getVelocity(jointId, deltaSeconds = 1 / 60) {
    const index = this.indexById.get(jointId);
    if (index == null) {
      return { x: 0, y: 0, z: 0 };
    }
    const offset = index * 3;
    const dt = Math.max(1e-6, deltaSeconds);
    return {
      x: (this.positions[offset] - this.previous[offset]) / dt,
      y: (this.positions[offset + 1] - this.previous[offset + 1]) / dt,
      z: (this.positions[offset + 2] - this.previous[offset + 2]) / dt,
    };
  }

  getMaximumSpeed(deltaSeconds = 1 / 60) {
    let maximum = 0;
    const dt = Math.max(1e-6, deltaSeconds);
    for (let index = 0; index < this.ids.length; index += 1) {
      const offset = index * 3;
      const speed = Math.hypot(
        this.positions[offset] - this.previous[offset],
        this.positions[offset + 1] - this.previous[offset + 1],
        this.positions[offset + 2] - this.previous[offset + 2],
      ) / dt;
      maximum = Math.max(maximum, speed);
    }
    return maximum;
  }

  getMaxBoneError() {
    let maximum = 0;
    for (const constraint of this.primaryConstraints) {
      const a = this.getPointByIndex(constraint.a);
      const b = this.getPointByIndex(constraint.b);
      maximum = Math.max(maximum, Math.abs(distance(a, b) - constraint.length));
    }
    return maximum;
  }

  getMaxGroundPenetration() {
    if (!this.options.groundEnabled) {
      return 0;
    }
    const floor = Number(this.options.groundY) || 0;
    let maximum = 0;
    for (let index = 0; index < this.ids.length; index += 1) {
      if (this.definition.joints[index]?.isControl) {
        continue;
      }
      const y = this.positions[index * 3 + 1];
      maximum = Math.max(maximum, floor - y);
    }
    return Math.max(0, maximum);
  }

  getMaxJointLimitViolation() {
    return this.biomechanics?.getMaxViolationDegrees() ?? 0;
  }

  getRigidPelvisError() {
    return this.biomechanics?.getRigidError() ?? 0;
  }

  getJointLimitInfo(jointId) {
    return this.biomechanics?.getJointInfo(jointId) ?? null;
  }

  /** Hidden global controls follow their anatomical target and never create a visible bone. */
  syncControlNodes() {
    if (!this.definition) {
      return;
    }
    for (let index = 0; index < this.definition.joints.length; index += 1) {
      const joint = this.definition.joints[index];
      if (!joint?.isControl || !joint.followJointId) {
        continue;
      }
      const targetIndex = this.indexById.get(joint.followJointId);
      if (targetIndex == null) {
        continue;
      }
      const target = this.getPointByIndex(targetIndex);
      const offset = Array.isArray(joint.controlOffset) ? joint.controlOffset : [0, 0, 0];
      const point = {
        x: target.x + (Number(offset[0]) || 0),
        y: target.y + (Number(offset[1]) || 0),
        z: target.z + (Number(offset[2]) || 0),
      };
      setArrayPoint(this.positions, index, point);
      setArrayPoint(this.previous, index, point);
    }
  }

  getDragTargetError() {
    if (!this.drag) {
      return 0;
    }
    let maximum = 0;
    this.drag.indices.forEach((index, targetIndex) => {
      const target = add(this.drag.target, this.drag.offsets[targetIndex]);
      maximum = Math.max(maximum, distance(this.getPointByIndex(index), target));
    });
    return maximum;
  }

  getProjectionStats() {
    return { ...this.lastProjectionStats };
  }

  getDragState() {
    return this.drag
      ? {
        ...this.drag,
        indices: [...this.drag.indices],
        offsets: this.drag.offsets.map(clonePoint),
        target: clonePoint(this.drag.target),
      }
      : null;
  }

  writePoseToDefinition(markCustom = true) {
    if (!this.definition) {
      return;
    }
    this.syncControlNodes();
    for (let index = 0; index < this.ids.length; index += 1) {
      const joint = this.definition.joints[index];
      const offset = index * 3;
      joint.poseWorldPosition = [
        this.positions[offset],
        this.positions[offset + 1],
        this.positions[offset + 2],
      ];
    }
    if (markCustom) {
      markPoseModified(this.definition, 'CUSTOM');
    }
  }

  applyPinnedTargets() {
    for (const [index, target] of this.pinnedTargets.entries()) {
      if (this.isDragged(index)) {
        continue;
      }
      setArrayPoint(this.positions, index, target);
    }
  }

  applyDragTargetsSoft(stiffness) {
    if (!this.drag || stiffness <= 0) {
      return;
    }
    this.drag.indices.forEach((index, targetIndex) => {
      const target = add(this.drag.target, this.drag.offsets[targetIndex]);
      const offset = index * 3;
      this.positions[offset] += (target.x - this.positions[offset]) * stiffness;
      this.positions[offset + 1] += (target.y - this.positions[offset + 1]) * stiffness;
      this.positions[offset + 2] += (target.z - this.positions[offset + 2]) * stiffness;
    });
  }

  getEffectiveInverseMass(index) {
    if (this.isPinnedAndNotDragged(index)) {
      return 0;
    }
    return this.inverseMass[index] || 0;
  }

  isDragged(index) {
    return Boolean(this.drag?.indices.includes(index));
  }

  isPinnedAndNotDragged(index) {
    return this.pinnedTargets.has(index) && !this.isDragged(index);
  }

  refreshPinTargets() {
    const next = new Map();
    for (let index = 0; index < this.ids.length; index += 1) {
      if (this.definition.joints[index].isControl) {
        this.definition.joints[index].pinned = false;
        continue;
      }
      if (this.definition.joints[index].pinned) {
        next.set(index, this.getPointByIndex(index));
      }
    }
    this.pinnedTargets = next;
  }

  buildShapeConstraintTopology() {
    const joints = this.definition.joints;
    const byId = new Map(joints.map((joint) => [joint.id, joint]));
    const childrenByParent = new Map();
    const primaryKeys = new Set();

    for (const joint of joints) {
      const parent = joint.parentId ? byId.get(joint.parentId) : null;
      if (!parent || joint.physicalBone === false || joint.isControl || parent.isControl) {
        continue;
      }
      const list = childrenByParent.get(joint.parentId) ?? [];
      list.push(joint.id);
      childrenByParent.set(joint.parentId, list);
      primaryKeys.add(pairKey(this.indexById.get(joint.parentId), this.indexById.get(joint.id)));
    }

    const pairMap = new Map();
    const addPair = (idA, idB, group = 'pose', strength = 1) => {
      const a = this.indexById.get(idA);
      const b = this.indexById.get(idB);
      if (a == null || b == null || a === b) {
        return;
      }
      const key = pairKey(a, b);
      if (primaryKeys.has(key)) {
        return;
      }
      const existing = pairMap.get(key);
      if (existing) {
        if (group === 'torso') {
          existing.group = 'torso';
        }
        existing.strength = Math.max(existing.strength, strength);
        return;
      }
      const pointA = this.getPointByIndex(a);
      const pointB = this.getPointByIndex(b);
      pairMap.set(key, {
        a,
        b,
        type: 'shape',
        group,
        strength,
        length: distance(pointA, pointB),
        fallbackDirection: normalizedDirection(pointA, pointB),
      });
    };

    // Grandparent-to-child distances preserve limb bends while leaving all
    // joints free to rotate.
    for (const child of joints) {
      const parent = child.parentId ? byId.get(child.parentId) : null;
      const grandparent = parent?.parentId ? byId.get(parent.parentId) : null;
      if (
        grandparent
        && child.physicalBone !== false
        && parent.physicalBone !== false
        && !child.isControl
        && !parent.isControl
        && !grandparent.isControl
      ) {
        addPair(grandparent.id, child.id, 'pose', 0.95);
      }
    }

    // Sibling spans couple branches at shoulders and hips.
    for (const siblings of childrenByParent.values()) {
      for (let a = 0; a < siblings.length; a += 1) {
        for (let b = a + 1; b < siblings.length; b += 1) {
          addPair(siblings[a], siblings[b], 'torso', 0.9);
        }
      }
    }

    const torsoPairs = [
      ['leftShoulder', 'rightShoulder', 1],
      ['leftUpperArm', 'rightUpperArm', 0.95],
      ['leftUpperLeg', 'rightUpperLeg', 1],
      ['upperChest', 'leftUpperLeg', 0.9],
      ['upperChest', 'rightUpperLeg', 0.9],
      ['chest', 'leftUpperArm', 0.9],
      ['chest', 'rightUpperArm', 0.9],
      ['hips', 'leftShoulder', 0.9],
      ['hips', 'rightShoulder', 0.9],
      ['hips', 'head', 0.75],
      ['leftShoulder', 'rightUpperLeg', 0.75],
      ['rightShoulder', 'leftUpperLeg', 0.75],
    ];
    for (const [idA, idB, strength] of torsoPairs) {
      addPair(idA, idB, 'torso', strength);
    }

    const longRangePairs = [
      ['leftShoulder', 'leftHand', 0.8],
      ['leftUpperArm', 'leftHandEnd', 0.7],
      ['rightShoulder', 'rightHand', 0.8],
      ['rightUpperArm', 'rightHandEnd', 0.7],
      ['leftUpperLeg', 'leftFoot', 0.8],
      ['leftUpperLeg', 'leftToesEnd', 0.65],
      ['rightUpperLeg', 'rightFoot', 0.8],
      ['rightUpperLeg', 'rightToesEnd', 0.65],
      ['hips', 'leftHand', 0.55],
      ['hips', 'rightHand', 0.55],
      ['upperChest', 'leftFoot', 0.45],
      ['upperChest', 'rightFoot', 0.45],
    ];
    for (const [idA, idB, strength] of longRangePairs) {
      addPair(idA, idB, 'pose', strength);
    }

    this.shapeConstraints = [...pairMap.values()];
  }
}

function assertSupportedPoseSnapshot(snapshot, indexById, definition) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Invalid PoseSnapshot: payload must be an object.');
  }
  if (snapshot.type !== 'PoseSnapshot') errors.push('type must be PoseSnapshot');
  if (snapshot.schema !== POSE_SNAPSHOT_SCHEMA) errors.push(`schema must be ${POSE_SNAPSHOT_SCHEMA}`);
  if (snapshot.rotationSpace !== 'local') errors.push('rotationSpace must be local');
  if (snapshot.rotationConvention !== POSE_ROTATION_CONVENTION) {
    errors.push(`rotationConvention must be ${POSE_ROTATION_CONVENTION}`);
  }

  const rootJointId = String(snapshot.rootJointId ?? '');
  const rootIndex = indexById.get(rootJointId);
  if (!rootJointId || rootIndex == null || definition.joints[rootIndex]?.isControl) {
    errors.push(`rootJointId ${rootJointId || '<empty>'} is not a physical joint in this rig`);
  }
  validateFiniteArray(snapshot.rootTranslation, 3, 'rootTranslation', errors);
  validateQuaternionArray(snapshot.rootRotation, 'rootRotation', errors);

  if (!snapshot.localRotations || typeof snapshot.localRotations !== 'object' || Array.isArray(snapshot.localRotations)) {
    errors.push('localRotations must be an object keyed by stable joint ID');
  } else {
    for (const [jointId, quaternion] of Object.entries(snapshot.localRotations)) {
      const index = indexById.get(jointId);
      if (index == null || definition.joints[index]?.isControl) {
        errors.push(`localRotations.${jointId} does not target a physical joint in this rig`);
        continue;
      }
      validateQuaternionArray(quaternion, `localRotations.${jointId}`, errors);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid PoseSnapshot: ${errors.join('; ')}.`);
  }
}

function validateFiniteArray(value, expectedLength, path, errors) {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    errors.push(`${path} must contain ${expectedLength} values`);
    return;
  }
  if (value.some((item) => !Number.isFinite(Number(item)))) {
    errors.push(`${path} contains a non-finite value`);
  }
}

function validateQuaternionArray(value, path, errors) {
  const before = errors.length;
  validateFiniteArray(value, 4, path, errors);
  if (errors.length !== before) return;
  const length = Math.hypot(...value.map(Number));
  if (!Number.isFinite(length) || Math.abs(length - 1) > 1e-5) {
    errors.push(`${path} must be a normalized quaternion`);
  }
}

function normalizePinnedConstraints(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== 'object') {
    return [];
  }
  return Object.entries(value).map(([jointId, constraint]) => ({
    jointId,
    ...(constraint && typeof constraint === 'object' ? constraint : {}),
  }));
}

function extractLocalRotations(
  definition,
  rest,
  pose,
  rootJointId,
  rootRotationValue = identityQuaternion(),
) {
  const childrenByParent = new Map();
  for (const joint of definition.joints) {
    if (!joint.parentId || joint.physicalBone === false || joint.isControl) continue;
    const children = childrenByParent.get(joint.parentId) ?? [];
    children.push(joint);
    childrenByParent.set(joint.parentId, children);
  }

  const rootRotation = normalizeQuaternion(rootRotationValue);
  const localRotations = {};
  const visit = (parentId, parentWorldRotation) => {
    const parentPose = pose.get(parentId);
    const inverseParent = inverseQuaternion(parentWorldRotation);
    for (const child of childrenByParent.get(parentId) ?? []) {
      const bindOffset = normalizePoint(child.localPosition, { x: 0, y: 1, z: 0 });
      const posedDirectionWorld = subtract(pose.get(child.id), parentPose);
      const posedDirectionParent = rotatePointByQuaternion(inverseParent, posedDirectionWorld);
      const localRotation = quaternionFromTo(bindOffset, posedDirectionParent);
      const childWorldRotation = multiplyQuaternions(parentWorldRotation, localRotation);
      localRotations[child.id] = localRotation;
      visit(child.id, childWorldRotation);
    }
  };
  visit(rootJointId, rootRotation);
  return { rootRotation, localRotations };
}

function computeRootFrameRotation(rest, pose, forwardHint) {
  const restFrame = computePelvisFrame(rest, { x: 0, y: 0, z: 1 });
  const posedFrame = computePelvisFrame(pose, forwardHint ?? restFrame.forward);
  return quaternionFromBasisFrames(restFrame, posedFrame);
}

function computePelvisFrame(points, forwardHint) {
  const leftHip = points.get('leftUpperLeg');
  const rightHip = points.get('rightUpperLeg');
  const hips = points.get('hips');
  const pelvisTop = points.get('spine');
  if (!leftHip || !rightHip || !hips || !pelvisTop) {
    return {
      right: { x: 1, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      forward: { x: 0, y: 0, z: 1 },
    };
  }
  let right = normalizeVectorPoint(subtract(rightHip, leftHip));
  let up = normalizeVectorPoint(subtract(pelvisTop, hips));
  let forward = normalizeVectorPoint(crossPoints(right, up));
  const hint = normalizeVectorPoint(forwardHint ?? { x: 0, y: 0, z: 1 });
  if (dotPoints(forward, hint) < 0) forward = scalePoint(forward, -1);
  right = normalizeVectorPoint(crossPoints(up, forward));
  up = normalizeVectorPoint(crossPoints(forward, right));
  return { right, up, forward };
}

function quaternionFromBasisFrames(fromFrame, toFrame) {
  const from = [fromFrame.right, fromFrame.up, fromFrame.forward];
  const to = [toFrame.right, toFrame.up, toFrame.forward];
  const matrix = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      matrix[row][column] = (
        to[0][axisKey(row)] * from[0][axisKey(column)]
        + to[1][axisKey(row)] * from[1][axisKey(column)]
        + to[2][axisKey(row)] * from[2][axisKey(column)]
      );
    }
  }
  return quaternionFromRotationMatrix(matrix);
}

function quaternionFromRotationMatrix(matrix) {
  const m00 = matrix[0][0];
  const m01 = matrix[0][1];
  const m02 = matrix[0][2];
  const m10 = matrix[1][0];
  const m11 = matrix[1][1];
  const m12 = matrix[1][2];
  const m20 = matrix[2][0];
  const m21 = matrix[2][1];
  const m22 = matrix[2][2];
  const trace = m00 + m11 + m22;
  let quaternion;
  if (trace > 0) {
    const scaleValue = Math.sqrt(trace + 1) * 2;
    quaternion = {
      w: 0.25 * scaleValue,
      x: (m21 - m12) / scaleValue,
      y: (m02 - m20) / scaleValue,
      z: (m10 - m01) / scaleValue,
    };
  } else if (m00 > m11 && m00 > m22) {
    const scaleValue = Math.sqrt(1 + m00 - m11 - m22) * 2;
    quaternion = {
      w: (m21 - m12) / scaleValue,
      x: 0.25 * scaleValue,
      y: (m01 + m10) / scaleValue,
      z: (m02 + m20) / scaleValue,
    };
  } else if (m11 > m22) {
    const scaleValue = Math.sqrt(1 + m11 - m00 - m22) * 2;
    quaternion = {
      w: (m02 - m20) / scaleValue,
      x: (m01 + m10) / scaleValue,
      y: 0.25 * scaleValue,
      z: (m12 + m21) / scaleValue,
    };
  } else {
    const scaleValue = Math.sqrt(1 + m22 - m00 - m11) * 2;
    quaternion = {
      w: (m10 - m01) / scaleValue,
      x: (m02 + m20) / scaleValue,
      y: (m12 + m21) / scaleValue,
      z: 0.25 * scaleValue,
    };
  }
  return normalizeQuaternion(quaternion);
}

function axisKey(index) {
  return index === 0 ? 'x' : index === 1 ? 'y' : 'z';
}

function reconstructPoseSnapshot(definition, rest, snapshot) {
  const rootJointId = String(snapshot.rootJointId ?? 'hips');
  const rootRest = rest.get(rootJointId);
  if (!rootRest) return new Map();
  const rootTranslation = arrayToPoint(snapshot.rootTranslation, { x: 0, y: 0, z: 0 });
  const rootRotation = arrayToQuaternion(snapshot.rootRotation);
  const localRotations = snapshot.localRotations && typeof snapshot.localRotations === 'object'
    ? snapshot.localRotations
    : {};
  const childrenByParent = new Map();
  for (const joint of definition.joints) {
    if (!joint.parentId || joint.physicalBone === false || joint.isControl) continue;
    const children = childrenByParent.get(joint.parentId) ?? [];
    children.push(joint);
    childrenByParent.set(joint.parentId, children);
  }

  const positions = new Map([[rootJointId, add(rootRest, rootTranslation)]]);
  const worldRotations = new Map([[rootJointId, rootRotation]]);
  const visit = (jointId) => {
    const parentPoint = positions.get(jointId);
    const parentRotation = worldRotations.get(jointId) ?? identityQuaternion();
    for (const child of childrenByParent.get(jointId) ?? []) {
      const bindOffset = normalizePoint(child.localPosition, { x: 0, y: 0, z: 0 });
      const childLocal = arrayToQuaternion(localRotations[child.id]);
      const childWorldRotation = multiplyQuaternions(parentRotation, childLocal);
      const childPoint = add(parentPoint, rotatePointByQuaternion(childWorldRotation, bindOffset));
      positions.set(child.id, childPoint);
      worldRotations.set(child.id, childWorldRotation);
      visit(child.id);
    }
  };
  visit(rootJointId);
  return positions;
}

function quaternionFromTo(fromValue, toValue) {
  const from = normalizeVectorPoint(fromValue);
  const to = normalizeVectorPoint(toValue);
  const cosine = clamp(from.x * to.x + from.y * to.y + from.z * to.z, -1, 1);
  if (cosine > 1 - 1e-10) return identityQuaternion();
  if (cosine < -1 + 1e-10) {
    const reference = Math.abs(from.x) < 0.8 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const axis = normalizeVectorPoint(crossPoints(from, reference));
    return { x: axis.x, y: axis.y, z: axis.z, w: 0 };
  }
  const axis = crossPoints(from, to);
  return normalizeQuaternion({ x: axis.x, y: axis.y, z: axis.z, w: 1 + cosine });
}

function multiplyQuaternions(aValue, bValue) {
  const a = normalizeQuaternion(aValue);
  const b = normalizeQuaternion(bValue);
  return normalizeQuaternion({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  });
}

function inverseQuaternion(value) {
  const quaternion = normalizeQuaternion(value);
  return { x: -quaternion.x, y: -quaternion.y, z: -quaternion.z, w: quaternion.w };
}

function rotatePointByQuaternion(value, point) {
  const quaternion = normalizeQuaternion(value);
  const vector = normalizePoint(point, { x: 0, y: 0, z: 0 });
  const unit = { x: quaternion.x, y: quaternion.y, z: quaternion.z };
  const scalar = quaternion.w;
  const unitDotVector = unit.x * vector.x + unit.y * vector.y + unit.z * vector.z;
  const unitDotUnit = unit.x * unit.x + unit.y * unit.y + unit.z * unit.z;
  const cross = crossPoints(unit, vector);
  return {
    x: 2 * unitDotVector * unit.x + (scalar * scalar - unitDotUnit) * vector.x + 2 * scalar * cross.x,
    y: 2 * unitDotVector * unit.y + (scalar * scalar - unitDotUnit) * vector.y + 2 * scalar * cross.y,
    z: 2 * unitDotVector * unit.z + (scalar * scalar - unitDotUnit) * vector.z + 2 * scalar * cross.z,
  };
}

function normalizeQuaternion(value) {
  const quaternion = {
    x: Number(value?.x) || 0,
    y: Number(value?.y) || 0,
    z: Number(value?.z) || 0,
    w: Number.isFinite(Number(value?.w)) ? Number(value.w) : 1,
  };
  const length = Math.hypot(quaternion.x, quaternion.y, quaternion.z, quaternion.w) || 1;
  quaternion.x /= length;
  quaternion.y /= length;
  quaternion.z /= length;
  quaternion.w /= length;
  if (quaternion.w < 0) {
    quaternion.x *= -1;
    quaternion.y *= -1;
    quaternion.z *= -1;
    quaternion.w *= -1;
  }
  return quaternion;
}

function identityQuaternion() {
  return { x: 0, y: 0, z: 0, w: 1 };
}

function arrayToQuaternion(value) {
  if (Array.isArray(value)) {
    return normalizeQuaternion({ x: value[0], y: value[1], z: value[2], w: value[3] });
  }
  return normalizeQuaternion(value);
}

function quaternionToArray(value) {
  const quaternion = normalizeQuaternion(value);
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

function pointToArray(value) {
  const point = normalizePoint(value, { x: 0, y: 0, z: 0 });
  return [point.x, point.y, point.z];
}

function arrayToPoint(value, fallback = { x: 0, y: 0, z: 0 }) {
  if (Array.isArray(value)) return normalizePoint(value, fallback);
  return normalizePoint(value, fallback);
}

function normalizeVectorPoint(value) {
  const point = normalizePoint(value, { x: 0, y: 1, z: 0 });
  const length = Math.hypot(point.x, point.y, point.z) || 1;
  return { x: point.x / length, y: point.y / length, z: point.z / length };
}

function dotPoints(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function scalePoint(value, amount) {
  return { x: value.x * amount, y: value.y * amount, z: value.z * amount };
}

function crossPoints(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function inverseMassForJoint(joint) {
  if (joint.isControl) {
    return 0;
  }
  if (joint.category === 'root') {
    return 0.24;
  }
  if (joint.id === 'hips') {
    return 0.30;
  }
  if (joint.category === 'torso') {
    return 0.42;
  }
  if (joint.category === 'head') {
    return 0.58;
  }
  if (joint.category === 'leg') {
    return /Foot|Toes/.test(joint.id) ? 0.86 : 0.64;
  }
  if (joint.category === 'arm') {
    return /Hand/.test(joint.id) ? 1 : 0.84;
  }
  return 0.72;
}

function setArrayPoint(array, index, point) {
  const offset = index * 3;
  array[offset] = Number(point?.x ?? point?.[0]) || 0;
  array[offset + 1] = Number(point?.y ?? point?.[1]) || 0;
  array[offset + 2] = Number(point?.z ?? point?.[2]) || 0;
}

function getArrayPoint(array, index) {
  const offset = index * 3;
  return { x: array[offset], y: array[offset + 1], z: array[offset + 2] };
}

function normalizePoint(value, fallback) {
  if (Array.isArray(value)) {
    return {
      x: finite(value[0], fallback.x),
      y: finite(value[1], fallback.y),
      z: finite(value[2], fallback.z),
    };
  }
  return {
    x: finite(value?.x, fallback.x),
    y: finite(value?.y, fallback.y),
    z: finite(value?.z, fallback.z),
  };
}

function finite(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number(fallback) || 0;
}

function distance(a, b) {
  if (!a || !b) {
    return 0;
  }
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function clonePoint(point) {
  return { x: point.x, y: point.y, z: point.z };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function normalizedDirection(a, b, fallback = { x: 1, y: 0, z: 0 }) {
  if (!a || !b) {
    return clonePoint(fallback);
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dy, dz);
  if (length < EPSILON) {
    return clonePoint(fallback);
  }
  return { x: dx / length, y: dy / length, z: dz / length };
}

function pairKey(a, b) {
  return `${Math.min(a, b)}:${Math.max(a, b)}`;
}

function iterationStiffness(stiffness, iterations) {
  const normalized = clamp(stiffness, 0, 1);
  if (normalized <= 0 || normalized >= 1) {
    return normalized;
  }
  return 1 - Math.pow(1 - normalized, 1 / Math.max(1, iterations));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function performanceNow() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}
