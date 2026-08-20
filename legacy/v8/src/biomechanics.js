import { computeRestWorldPositions, getBoneLength } from './skeleton-model.js';

const EPSILON = 1e-9;
const DEG = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Position-based anatomical limit layer for the standard humanoid profile.
 * It adds rigid pelvis geometry, ball-joint envelopes, hinge planes, and
 * spine/neck cones on top of the fixed-length PBD skeleton.
 */
export class BiomechanicsSolver {
  constructor(rig) {
    this.rig = rig;
    this.constraints = [];
    this.rigidConstraints = [];
    this.byReportJoint = new Map();
    this.lastForward = { x: 0, y: 0, z: 1 };
    this.rebuild();
  }

  rebuild() {
    this.constraints = [];
    this.rigidConstraints = [];
    this.byReportJoint.clear();

    const definition = this.rig.definition;
    if (!definition?.biomechanics?.enabled) {
      return;
    }
    const limits = definition.biomechanics.limits ?? {};
    const has = (...ids) => ids.every((id) => this.rig.indexById.has(id));
    const add = (constraint) => {
      if (!has(...constraint.ids)) {
        return;
      }
      this.constraints.push(constraint);
      const reportId = constraint.reportJointId;
      if (reportId && !this.byReportJoint.has(reportId)) {
        this.byReportJoint.set(reportId, constraint);
      }
    };

    this.addRigidPair('leftUpperLeg', 'rightUpperLeg', 'pelvis');
    this.addRigidCluster(['hips', 'spine', 'leftUpperLeg', 'rightUpperLeg'], 'pelvis');

    for (const side of ['left', 'right']) {
      const shoulder = limits.shoulder ?? {};
      const elbow = limits.elbow ?? {};
      const hip = limits.hip ?? {};
      const knee = limits.knee ?? {};
      const ankle = limits.ankle ?? {};
      const toes = limits.toes ?? {};
      const wrist = limits.wrist ?? {};
      const clavicle = limits.clavicle ?? {};

      add({
        type: 'bodyDirection',
        ids: ['upperChest', `${side}Shoulder`],
        originId: 'upperChest',
        childId: `${side}Shoulder`,
        side,
        reference: 'clavicle',
        maxAngle: finite(clavicle.cone, 35),
        reportJointId: `${side}Shoulder`,
        typeLabel: '锁骨复合关节',
      });
      add({
        type: 'bodyDirection',
        ids: [`${side}Shoulder`, `${side}UpperArm`],
        originId: `${side}Shoulder`,
        childId: `${side}UpperArm`,
        side,
        reference: 'shoulderOffset',
        maxAngle: finite(clavicle.cone, 35),
        reportJointId: null,
        typeLabel: '肩带位置约束',
      });
      add({
        type: 'limbRoot',
        profile: 'shoulder',
        ids: [`${side}UpperArm`, `${side}LowerArm`],
        originId: `${side}UpperArm`,
        childId: `${side}LowerArm`,
        side,
        flexMin: -finite(shoulder.extension, 55),
        flexMax: finite(shoulder.flexion, 170),
        lateralMin: -finite(shoulder.adduction, 35),
        lateralMax: finite(shoulder.abduction, 95),
        reportJointId: `${side}UpperArm`,
        typeLabel: '肩球窝关节',
      });
      add({
        type: 'hinge',
        ids: [`${side}UpperArm`, `${side}LowerArm`, `${side}Hand`],
        parentId: `${side}UpperArm`,
        jointId: `${side}LowerArm`,
        childId: `${side}Hand`,
        bend: 'forward',
        min: -finite(elbow.hyperextension, 5),
        max: finite(elbow.flexion, 145),
        reportJointId: `${side}LowerArm`,
        typeLabel: '肘铰链关节',
      });
      add({
        type: 'wrist',
        ids: [`${side}LowerArm`, `${side}Hand`, `${side}HandEnd`],
        parentId: `${side}LowerArm`,
        jointId: `${side}Hand`,
        childId: `${side}HandEnd`,
        flexMin: -finite(wrist.extension, 70),
        flexMax: finite(wrist.flexion, 80),
        deviationMin: -finite(wrist.ulnarDeviation, 30),
        deviationMax: finite(wrist.radialDeviation, 20),
        reportJointId: `${side}Hand`,
        typeLabel: '腕双轴关节',
      });

      add({
        type: 'limbRoot',
        profile: 'hip',
        ids: [`${side}UpperLeg`, `${side}LowerLeg`],
        originId: `${side}UpperLeg`,
        childId: `${side}LowerLeg`,
        side,
        flexMin: -finite(hip.extension, 20),
        flexMax: finite(hip.flexion, 130),
        lateralMin: -finite(hip.adduction, 30),
        lateralMax: finite(hip.abduction, 50),
        reportJointId: `${side}UpperLeg`,
        typeLabel: '髋球窝关节',
      });
      add({
        type: 'hinge',
        ids: [`${side}UpperLeg`, `${side}LowerLeg`, `${side}Foot`],
        parentId: `${side}UpperLeg`,
        jointId: `${side}LowerLeg`,
        childId: `${side}Foot`,
        bend: 'backward',
        min: -finite(knee.hyperextension, 3),
        max: finite(knee.flexion, 140),
        reportJointId: `${side}LowerLeg`,
        typeLabel: '膝铰链关节',
      });
      add({
        type: 'foot',
        ids: [`${side}LowerLeg`, `${side}Foot`, `${side}Toes`],
        parentId: `${side}LowerLeg`,
        jointId: `${side}Foot`,
        childId: `${side}Toes`,
        pitchMin: -finite(ankle.plantarFlexion, 55),
        pitchMax: finite(ankle.dorsiflexion, 15),
        yawMax: finite(ankle.yaw, 20),
        reportJointId: `${side}Foot`,
        typeLabel: '踝双轴关节',
      });
      add({
        type: 'toe',
        ids: [`${side}Foot`, `${side}Toes`, `${side}ToesEnd`],
        parentId: `${side}Foot`,
        jointId: `${side}Toes`,
        childId: `${side}ToesEnd`,
        min: -finite(toes.flexion, 35),
        max: finite(toes.extension, 45),
        reportJointId: `${side}Toes`,
        typeLabel: '跖趾铰链',
      });
    }

    const lumbar = finite(limits.lumbar?.cone, 22);
    const thoracic = finite(limits.thoracic?.cone, 18);
    const neckBase = finite(limits.neckBase?.cone, 45);
    const head = finite(limits.head?.cone, 60);
    addCone('hips', 'spine', 'chest', lumbar, 'spine', '腰椎');
    addCone('spine', 'chest', 'upperChest', thoracic, 'chest', '胸椎');
    addCone('chest', 'upperChest', 'neck', thoracic, 'upperChest', '上胸');
    addCone('upperChest', 'neck', 'head', neckBase, 'neck', '颈根');
    addCone('neck', 'head', 'headTop', head, 'head', '头颈复合关节');

    function addCone(parentId, jointId, childId, maxAngle, reportJointId, typeLabel) {
      add({
        type: 'cone',
        ids: [parentId, jointId, childId],
        parentId,
        jointId,
        childId,
        maxAngle,
        reportJointId,
        typeLabel,
      });
    }
  }

  addRigidCluster(jointIds, group) {
    const ids = jointIds.filter((id) => this.rig.indexById.has(id));
    if (ids.length < 3) {
      return;
    }
    const rest = computeRestWorldPositions(this.rig.definition);
    for (let first = 0; first < ids.length; first += 1) {
      for (let second = first + 1; second < ids.length; second += 1) {
        this.addRigidPair(ids[first], ids[second], group, rest);
      }
    }
  }

  addRigidPair(idA, idB, group, rest = computeRestWorldPositions(this.rig.definition)) {
    const a = this.rig.indexById.get(idA);
    const b = this.rig.indexById.get(idB);
    if (a == null || b == null) {
      return;
    }
    if (this.rigidConstraints.some((constraint) => (
      (constraint.a === a && constraint.b === b)
      || (constraint.a === b && constraint.b === a)
    ))) {
      return;
    }
    const pointA = rest.get(idA);
    const pointB = rest.get(idB);
    if (!pointA || !pointB) {
      return;
    }
    this.rigidConstraints.push({
      a,
      b,
      idA,
      idB,
      length: distance(pointA, pointB),
      type: 'anatomy-rigid',
      group,
      fallbackDirection: direction(pointA, pointB, { x: 1, y: 0, z: 0 }),
    });
  }

  solve(stiffness = 1) {
    if (!this.isEnabled()) {
      return;
    }
    const amount = clamp(stiffness, 0, 1);
    for (const rigid of this.rigidConstraints) {
      this.rig.solveDistanceConstraint(rigid, amount, 'dynamic');
    }

    if (!this.areJointLimitsEnabled()) {
      return;
    }
    const frame = this.getBodyFrame();
    for (const constraint of this.constraints) {
      this.solveConstraint(constraint, frame, amount);
    }
  }

  solveConstraint(constraint, frame, stiffness) {
    switch (constraint.type) {
      case 'bodyDirection':
        this.solveBodyDirection(constraint, frame, stiffness);
        break;
      case 'limbRoot':
        this.solveLimbRoot(constraint, frame, stiffness);
        break;
      case 'hinge':
        this.solveHinge(constraint, frame, stiffness);
        break;
      case 'cone':
        this.solveCone(constraint, stiffness);
        break;
      case 'wrist':
        this.solveWrist(constraint, frame, stiffness);
        break;
      case 'foot':
        this.solveFoot(constraint, frame, stiffness);
        break;
      case 'toe':
        this.solveToe(constraint, frame, stiffness);
        break;
      default:
        break;
    }
  }

  solveBodyDirection(constraint, frame, stiffness) {
    const outward = constraint.side === 'left' ? scale(frame.right, -1) : frame.right;
    let reference;
    if (constraint.reference === 'clavicle') {
      reference = normalize(add(scale(outward, 0.884), scale(frame.up, 0.468)), outward);
    } else {
      reference = normalize(add(scale(outward, 0.999), scale(frame.up, -0.048)), outward);
    }
    const current = this.segmentDirection(constraint.originId, constraint.childId);
    const desired = clampToCone(current, reference, constraint.maxAngle * DEG);
    this.applySegmentDirection(constraint.originId, constraint.childId, desired, stiffness);
  }

  solveLimbRoot(constraint, frame, stiffness) {
    const current = this.segmentDirection(constraint.originId, constraint.childId);
    const desired = limitLimbRootDirection(current, frame, constraint);
    this.applySegmentDirection(constraint.originId, constraint.childId, desired, stiffness);
  }

  solveHinge(constraint, frame, stiffness) {
    const parent = this.point(constraint.parentId);
    const joint = this.point(constraint.jointId);
    const child = this.point(constraint.childId);
    if (!parent || !joint || !child) {
      return;
    }
    const straight = direction(parent, joint, frame.down);
    const preferredRaw = constraint.bend === 'backward' ? scale(frame.forward, -1) : frame.forward;
    let preferred = normalize(projectOnPlane(preferredRaw, straight), null);
    if (!preferred) {
      const side = this.rig.definition.joints[this.rig.indexById.get(constraint.jointId)]?.side;
      const outward = side === 'left' ? scale(frame.right, -1) : frame.right;
      preferred = normalize(projectOnPlane(outward, straight), frame.forward);
    }
    const planeNormal = normalize(cross(straight, preferred), frame.right);
    const current = direction(joint, child, straight);
    const inPlane = normalize(projectOnPlane(current, planeNormal), straight);
    const signed = Math.atan2(dot(inPlane, preferred), dot(inPlane, straight));
    const clamped = clamp(signed, constraint.min * DEG, constraint.max * DEG);
    const desired = normalize(add(scale(straight, Math.cos(clamped)), scale(preferred, Math.sin(clamped))), straight);
    this.applySegmentDirection(constraint.jointId, constraint.childId, desired, stiffness);
  }

  solveCone(constraint, stiffness) {
    const parent = this.point(constraint.parentId);
    const joint = this.point(constraint.jointId);
    const child = this.point(constraint.childId);
    if (!parent || !joint || !child) {
      return;
    }
    const reference = direction(parent, joint, { x: 0, y: 1, z: 0 });
    const current = direction(joint, child, reference);
    const desired = clampToCone(current, reference, constraint.maxAngle * DEG);
    this.applySegmentDirection(constraint.jointId, constraint.childId, desired, stiffness);
  }

  solveWrist(constraint, frame, stiffness) {
    const parent = this.point(constraint.parentId);
    const joint = this.point(constraint.jointId);
    const child = this.point(constraint.childId);
    if (!parent || !joint || !child) {
      return;
    }
    const axis = direction(parent, joint, frame.right);
    const basis = wristBasis(axis, frame);
    const current = direction(joint, child, axis);
    const values = dualAxisAngles(current, axis, basis.flex, basis.deviation);
    const flex = clamp(values.flex, constraint.flexMin * DEG, constraint.flexMax * DEG);
    const deviation = clamp(
      values.deviation,
      constraint.deviationMin * DEG,
      constraint.deviationMax * DEG,
    );
    const desired = directionFromDualAxis(axis, basis.flex, basis.deviation, flex, deviation);
    this.applySegmentDirection(constraint.jointId, constraint.childId, desired, stiffness);
  }

  solveFoot(constraint, frame, stiffness) {
    const parent = this.point(constraint.parentId);
    const joint = this.point(constraint.jointId);
    const child = this.point(constraint.childId);
    if (!parent || !joint || !child) {
      return;
    }
    const shank = direction(parent, joint, frame.down);
    const basis = ankleBasis(shank, frame);
    const current = direction(joint, child, basis.neutral);
    const values = dualAxisAngles(current, basis.neutral, basis.pitch, basis.yaw);
    const pitch = clamp(values.flex, constraint.pitchMin * DEG, constraint.pitchMax * DEG);
    const yaw = clamp(values.deviation, -constraint.yawMax * DEG, constraint.yawMax * DEG);
    const desired = directionFromDualAxis(basis.neutral, basis.pitch, basis.yaw, pitch, yaw);
    this.applySegmentDirection(constraint.jointId, constraint.childId, desired, stiffness);
  }

  solveToe(constraint, frame, stiffness) {
    const parent = this.point(constraint.parentId);
    const joint = this.point(constraint.jointId);
    const child = this.point(constraint.childId);
    if (!parent || !joint || !child) {
      return;
    }
    const straight = direction(parent, joint, frame.forward);
    let preferred = normalize(projectOnPlane(frame.up, straight), null);
    if (!preferred) {
      preferred = normalize(projectOnPlane(frame.forward, straight), frame.up);
    }
    const planeNormal = normalize(cross(straight, preferred), frame.right);
    const current = direction(joint, child, straight);
    const inPlane = normalize(projectOnPlane(current, planeNormal), straight);
    const signed = Math.atan2(dot(inPlane, preferred), dot(inPlane, straight));
    const clamped = clamp(signed, constraint.min * DEG, constraint.max * DEG);
    const desired = normalize(add(scale(straight, Math.cos(clamped)), scale(preferred, Math.sin(clamped))), straight);
    this.applySegmentDirection(constraint.jointId, constraint.childId, desired, stiffness);
  }

  applySegmentDirection(originId, childId, desiredDirection, stiffness) {
    const originIndex = this.rig.indexById.get(originId);
    const childIndex = this.rig.indexById.get(childId);
    if (originIndex == null || childIndex == null) {
      return;
    }
    const origin = this.rig.getPointByIndex(originIndex);
    const child = this.rig.getPointByIndex(childIndex);
    const length = getBoneLength(this.rig.definition, childId) || distance(origin, child);
    if (length < EPSILON) {
      return;
    }
    const desired = scale(normalize(desiredDirection, direction(origin, child)), length);
    const current = subtract(child, origin);
    const delta = subtract(desired, current);

    const weightOrigin = this.rig.getEffectiveInverseMass(originIndex);
    const weightChild = this.rig.getEffectiveInverseMass(childIndex);
    const total = weightOrigin + weightChild;
    if (total < EPSILON) {
      return;
    }
    const originShare = weightOrigin / total;
    const childShare = weightChild / total;
    const amount = clamp(stiffness, 0, 1);
    this.addToPoint(originIndex, scale(delta, -originShare * amount));
    this.addToPoint(childIndex, scale(delta, childShare * amount));
  }

  addToPoint(index, delta) {
    const offset = index * 3;
    this.rig.positions[offset] += delta.x;
    this.rig.positions[offset + 1] += delta.y;
    this.rig.positions[offset + 2] += delta.z;
  }

  segmentDirection(originId, childId) {
    return direction(this.point(originId), this.point(childId), { x: 0, y: 1, z: 0 });
  }

  point(id) {
    const index = this.rig.indexById.get(id);
    return index == null ? null : this.rig.getPointByIndex(index);
  }

  getBodyFrame() {
    const leftHip = this.point('leftUpperLeg');
    const rightHip = this.point('rightUpperLeg');
    const hips = this.point('hips');
    const pelvisTop = this.point('spine');

    let right = direction(leftHip, rightHip, { x: 1, y: 0, z: 0 });
    let up = direction(hips, pelvisTop, { x: 0, y: 1, z: 0 });
    let forward = normalize(cross(right, up), this.lastForward);
    if (dot(forward, this.lastForward) < 0) {
      forward = scale(forward, -1);
    }
    right = normalize(cross(up, forward), right);
    up = normalize(cross(forward, right), up);
    this.lastForward = forward;
    return {
      right,
      up,
      forward,
      down: scale(up, -1),
    };
  }

  evaluateConstraint(constraint, frame = this.getBodyFrame()) {
    switch (constraint.type) {
      case 'bodyDirection': {
        const outward = constraint.side === 'left' ? scale(frame.right, -1) : frame.right;
        const reference = constraint.reference === 'clavicle'
          ? normalize(add(scale(outward, 0.884), scale(frame.up, 0.468)), outward)
          : normalize(add(scale(outward, 0.999), scale(frame.up, -0.048)), outward);
        const current = this.segmentDirection(constraint.originId, constraint.childId);
        const angle = angleBetween(current, reference) * RAD_TO_DEG;
        return {
          currentLabel: `偏转 ${round(angle)}°`,
          violation: Math.max(0, angle - constraint.maxAngle),
          values: { angle },
        };
      }
      case 'limbRoot': {
        const current = this.segmentDirection(constraint.originId, constraint.childId);
        const values = limbRootAngles(current, frame, constraint.side);
        const flexViolation = rangeViolation(values.flex * RAD_TO_DEG, constraint.flexMin, constraint.flexMax);
        const lateralViolation = rangeViolation(values.lateral * RAD_TO_DEG, constraint.lateralMin, constraint.lateralMax);
        return {
          currentLabel: `前后 ${round(values.flex * RAD_TO_DEG)}°，内外展 ${round(values.lateral * RAD_TO_DEG)}°`,
          violation: Math.max(flexViolation, lateralViolation),
          values,
        };
      }
      case 'hinge': {
        const result = hingeValues(this, constraint, frame);
        return {
          currentLabel: `${result.angle >= 0 ? '屈曲' : '伸展'} ${round(Math.abs(result.angle))}°`,
          violation: Math.max(rangeViolation(result.angle, constraint.min, constraint.max), result.planeDeviation),
          values: result,
        };
      }
      case 'cone': {
        const parent = this.point(constraint.parentId);
        const joint = this.point(constraint.jointId);
        const child = this.point(constraint.childId);
        const reference = direction(parent, joint, { x: 0, y: 1, z: 0 });
        const current = direction(joint, child, reference);
        const angle = angleBetween(reference, current) * RAD_TO_DEG;
        return {
          currentLabel: `偏转 ${round(angle)}°`,
          violation: Math.max(0, angle - constraint.maxAngle),
          values: { angle },
        };
      }
      case 'wrist': {
        const parent = this.point(constraint.parentId);
        const joint = this.point(constraint.jointId);
        const child = this.point(constraint.childId);
        const axis = direction(parent, joint, frame.right);
        const basis = wristBasis(axis, frame);
        const values = dualAxisAngles(direction(joint, child, axis), axis, basis.flex, basis.deviation);
        const flex = values.flex * RAD_TO_DEG;
        const deviation = values.deviation * RAD_TO_DEG;
        return {
          currentLabel: `屈伸 ${round(flex)}°，偏移 ${round(deviation)}°`,
          violation: Math.max(
            rangeViolation(flex, constraint.flexMin, constraint.flexMax),
            rangeViolation(deviation, constraint.deviationMin, constraint.deviationMax),
          ),
          values,
        };
      }
      case 'foot': {
        const parent = this.point(constraint.parentId);
        const joint = this.point(constraint.jointId);
        const child = this.point(constraint.childId);
        const shank = direction(parent, joint, frame.down);
        const basis = ankleBasis(shank, frame);
        const values = dualAxisAngles(
          direction(joint, child, basis.neutral),
          basis.neutral,
          basis.pitch,
          basis.yaw,
        );
        const pitch = values.flex * RAD_TO_DEG;
        const yaw = values.deviation * RAD_TO_DEG;
        return {
          currentLabel: `背跖屈 ${round(pitch)}°，侧偏 ${round(yaw)}°`,
          violation: Math.max(
            rangeViolation(pitch, constraint.pitchMin, constraint.pitchMax),
            rangeViolation(yaw, -constraint.yawMax, constraint.yawMax),
          ),
          values,
        };
      }
      case 'toe': {
        const result = toeValues(this, constraint, frame);
        return {
          currentLabel: `${result.angle >= 0 ? '伸展' : '屈曲'} ${round(Math.abs(result.angle))}°`,
          violation: Math.max(rangeViolation(result.angle, constraint.min, constraint.max), result.planeDeviation),
          values: result,
        };
      }
      default:
        return { currentLabel: '受限', violation: 0, values: {} };
    }
  }

  getMaxViolationDegrees() {
    if (!this.areJointLimitsEnabled()) {
      return 0;
    }
    const frame = this.getBodyFrame();
    let maximum = 0;
    for (const constraint of this.constraints) {
      maximum = Math.max(maximum, this.evaluateConstraint(constraint, frame).violation);
    }
    return maximum;
  }

  getRigidError() {
    let maximum = 0;
    for (const constraint of this.rigidConstraints) {
      maximum = Math.max(
        maximum,
        Math.abs(distance(this.rig.getPointByIndex(constraint.a), this.rig.getPointByIndex(constraint.b)) - constraint.length),
      );
    }
    return maximum;
  }

  getJointInfo(jointId) {
    const joint = this.rig.definition.joints[this.rig.indexById.get(jointId)];
    if (!joint) {
      return null;
    }
    if (joint.jointType === 'control') {
      return {
        typeLabel: '全身控制节点',
        rangeLabel: '跟随骨盆，不参与人体骨杆与关节角度',
        currentLabel: '控制节点',
        violationDegrees: 0,
        withinLimits: true,
      };
    }
    if (joint.jointType === 'pelvis') {
      return {
        typeLabel: '刚性骨盆',
        rangeLabel: '左右髋间距与骨盆三角保持固定',
        currentLabel: '刚性结构',
        violationDegrees: this.getRigidError() * 1000,
        withinLimits: this.getRigidError() < 1e-5,
      };
    }
    if (!this.areJointLimitsEnabled()) {
      return {
        typeLabel: joint.jointType === 'endpoint' ? '肢体末端' : '人体关节',
        rangeLabel: joint.limitLabel ?? '人体活动范围',
        currentLabel: '关节限制已关闭',
        violationDegrees: 0,
        withinLimits: true,
      };
    }
    const constraint = this.byReportJoint.get(jointId);
    if (!constraint) {
      return {
        typeLabel: joint.jointType === 'endpoint' ? '肢体末端' : '固定骨段节点',
        rangeLabel: joint.limitLabel ?? '由相邻关节约束控制',
        currentLabel: '由相邻关节控制',
        violationDegrees: 0,
        withinLimits: true,
      };
    }
    const result = this.evaluateConstraint(constraint);
    return {
      typeLabel: constraint.typeLabel,
      rangeLabel: joint.limitLabel ?? '人体活动范围',
      currentLabel: result.currentLabel,
      violationDegrees: result.violation,
      withinLimits: result.violation < 0.05,
    };
  }

  isEnabled() {
    return Boolean(this.rig.definition?.biomechanics?.enabled);
  }

  areJointLimitsEnabled() {
    return Boolean(
      this.isEnabled()
      && this.rig.definition?.biomechanics?.hardLimits !== false
      && this.rig.definition?.physics?.jointLimits !== false
      && this.rig.definition?.physics?.anatomyEnabled !== false,
    );
  }
}

function limitLimbRootDirection(current, frame, constraint) {
  const values = limbRootAngles(current, frame, constraint.side);
  const flex = clamp(values.flex, constraint.flexMin * DEG, constraint.flexMax * DEG);
  const lateral = clamp(values.lateral, constraint.lateralMin * DEG, constraint.lateralMax * DEG);
  const outward = constraint.side === 'left' ? scale(frame.right, -1) : frame.right;
  const sagittal = add(scale(frame.down, Math.cos(flex)), scale(frame.forward, Math.sin(flex)));
  return normalize(add(scale(sagittal, Math.cos(lateral)), scale(outward, Math.sin(lateral))), frame.down);
}

function limbRootAngles(current, frame, side) {
  const outward = side === 'left' ? scale(frame.right, -1) : frame.right;
  const outwardComponent = clamp(dot(current, outward), -1, 1);
  const sagittal = normalize(subtract(current, scale(outward, outwardComponent)), frame.down);
  return {
    flex: Math.atan2(dot(sagittal, frame.forward), dot(sagittal, frame.down)),
    lateral: Math.asin(outwardComponent),
  };
}

function hingeValues(solver, constraint, frame) {
  const parent = solver.point(constraint.parentId);
  const joint = solver.point(constraint.jointId);
  const child = solver.point(constraint.childId);
  const straight = direction(parent, joint, frame.down);
  const preferredRaw = constraint.bend === 'backward' ? scale(frame.forward, -1) : frame.forward;
  let preferred = normalize(projectOnPlane(preferredRaw, straight), null);
  if (!preferred) {
    preferred = normalize(projectOnPlane(frame.right, straight), frame.forward);
  }
  const normal = normalize(cross(straight, preferred), frame.right);
  const current = direction(joint, child, straight);
  const inPlane = normalize(projectOnPlane(current, normal), straight);
  return {
    angle: Math.atan2(dot(inPlane, preferred), dot(inPlane, straight)) * RAD_TO_DEG,
    planeDeviation: Math.abs(Math.asin(clamp(dot(current, normal), -1, 1))) * RAD_TO_DEG,
  };
}

function wristBasis(axis, frame) {
  const flex = normalize(projectOnPlane(frame.forward, axis), frame.up);
  let deviation = normalize(cross(axis, flex), frame.up);
  if (dot(deviation, frame.up) < 0) {
    deviation = scale(deviation, -1);
  }
  return { flex, deviation };
}

function ankleBasis(shank, frame) {
  const neutral = normalize(projectOnPlane(frame.forward, shank), frame.forward);
  let pitch = normalize(projectOnPlane(scale(shank, -1), neutral), frame.up);
  if (dot(pitch, frame.up) < 0) {
    pitch = scale(pitch, -1);
  }
  let yaw = normalize(cross(pitch, neutral), frame.right);
  if (dot(yaw, frame.right) < 0) {
    yaw = scale(yaw, -1);
  }
  return { neutral, pitch, yaw };
}

function dualAxisAngles(current, neutral, firstAxis, secondAxis) {
  const axial = dot(current, neutral);
  return {
    flex: Math.atan2(dot(current, firstAxis), axial),
    deviation: Math.atan2(dot(current, secondAxis), axial),
  };
}

function directionFromDualAxis(neutral, firstAxis, secondAxis, firstAngle, secondAngle) {
  return normalize(add(
    neutral,
    add(scale(firstAxis, Math.tan(firstAngle)), scale(secondAxis, Math.tan(secondAngle))),
  ), neutral);
}

function toeValues(solver, constraint, frame) {
  const parent = solver.point(constraint.parentId);
  const joint = solver.point(constraint.jointId);
  const child = solver.point(constraint.childId);
  const straight = direction(parent, joint, frame.forward);
  let preferred = normalize(projectOnPlane(frame.up, straight), null);
  if (!preferred) {
    preferred = normalize(projectOnPlane(frame.forward, straight), frame.up);
  }
  const normal = normalize(cross(straight, preferred), frame.right);
  const current = direction(joint, child, straight);
  const inPlane = normalize(projectOnPlane(current, normal), straight);
  return {
    angle: Math.atan2(dot(inPlane, preferred), dot(inPlane, straight)) * RAD_TO_DEG,
    planeDeviation: Math.abs(Math.asin(clamp(dot(current, normal), -1, 1))) * RAD_TO_DEG,
  };
}

function clampToCone(current, reference, maxAngle) {
  const angle = angleBetween(reference, current);
  if (angle <= maxAngle + 1e-9) {
    return current;
  }
  const tangent = normalize(projectOnPlane(current, reference), null);
  if (!tangent) {
    return reference;
  }
  return normalize(add(scale(reference, Math.cos(maxAngle)), scale(tangent, Math.sin(maxAngle))), reference);
}

function projectOnPlane(vector, normal) {
  return subtract(vector, scale(normal, dot(vector, normal)));
}

function direction(a, b, fallback = { x: 1, y: 0, z: 0 }) {
  if (!a || !b) {
    return clone(fallback);
  }
  return normalize(subtract(b, a), fallback);
}

function normalize(vector, fallback = { x: 1, y: 0, z: 0 }) {
  const length = Math.hypot(vector?.x ?? 0, vector?.y ?? 0, vector?.z ?? 0);
  if (length < EPSILON) {
    return fallback ? clone(fallback) : null;
  }
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function angleBetween(a, b) {
  return Math.acos(clamp(dot(normalize(a), normalize(b)), -1, 1));
}

function distance(a, b) {
  if (!a || !b) {
    return 0;
  }
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(vector, amount) {
  return { x: vector.x * amount, y: vector.y * amount, z: vector.z * amount };
}

function clone(value) {
  return { x: value.x, y: value.y, z: value.z };
}

function rangeViolation(value, min, max) {
  if (value < min) {
    return min - value;
  }
  if (value > max) {
    return value - max;
  }
  return 0;
}

function finite(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function round(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}
