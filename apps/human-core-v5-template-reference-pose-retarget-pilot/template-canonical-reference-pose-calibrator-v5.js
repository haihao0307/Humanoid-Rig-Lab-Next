const IDENTITY = Object.freeze([0, 0, 0, 1]);

const JOINT_ORDER = Object.freeze([
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'rightShoulder',
  'leftUpperArm', 'rightUpperArm',
  'leftLowerArm', 'rightLowerArm',
  'leftHand', 'rightHand', 'leftHandEnd', 'rightHandEnd',
  'leftUpperLeg', 'rightUpperLeg',
  'leftLowerLeg', 'rightLowerLeg',
  'leftFoot', 'rightFoot', 'leftToes', 'rightToes',
]);

const PRIMARY_CHILD = Object.freeze({
  spine: 'chest',
  chest: 'upperChest',
  neck: 'head',
  leftShoulder: 'leftUpperArm',
  rightShoulder: 'rightUpperArm',
  leftUpperArm: 'leftLowerArm',
  rightUpperArm: 'rightLowerArm',
  leftLowerArm: 'leftHand',
  rightLowerArm: 'rightHand',
  leftHand: 'leftHandEnd',
  rightHand: 'rightHandEnd',
  leftUpperLeg: 'leftLowerLeg',
  rightUpperLeg: 'rightLowerLeg',
  leftLowerLeg: 'leftFoot',
  rightLowerLeg: 'rightFoot',
  leftFoot: 'leftToes',
  rightFoot: 'rightToes',
});

const BRANCH_CHILDREN = Object.freeze({
  hips: Object.freeze(['spine', 'leftUpperLeg', 'rightUpperLeg']),
  upperChest: Object.freeze(['neck', 'leftShoulder', 'rightShoulder']),
});

export const TEMPLATE_CANONICAL_REFERENCE_POSE_CALIBRATOR_V5_SCHEMA =
  'humanoid_rig/template_canonical_reference_pose_calibrator@5.0';

/**
 * Pilot-only Target Reference Pose calibration. It computes runtime bone
 * rotations and a carrier translation while preserving GLB local positions,
 * local scales, inverse bind matrices, skin weights, and topology.
 */
export class TemplateCanonicalReferencePoseCalibratorV5 {
  constructor({ THREE, templateLayer, rigCore, sourceReferenceFrame } = {}) {
    if (!THREE || !templateLayer?.mesh || !templateLayer?.skeleton) {
      throw new Error('TemplateCanonicalReferencePoseCalibratorV5 requires a loaded template layer.');
    }
    if (!sourceReferenceFrame?.joints?.hips || !Array.isArray(rigCore?.joints)) {
      throw new Error('TemplateCanonicalReferencePoseCalibratorV5 requires a Human Core Reference frame.');
    }
    this.THREE = THREE;
    this.layer = templateLayer;
    this.rigCore = rigCore;
    this.sourceReferenceFrame = sourceReferenceFrame;
    this.sourceJointById = new Map(rigCore.joints.map((joint) => [joint.jointId, joint]));
    this.original = new Map();
    this.reference = new Map();
    this.fullBasis = new Map();
    this.solverRecords = new Map();
    this.originalCarrier = captureTransform(templateLayer.group);
    this.originalInverseBindBytes = copyViewBytes(templateLayer.inverseBindMatrices);
    this.originalWeightBytes = copyViewBytes(templateLayer.skinWeights);
    this.captureOriginalAssetState();
    this.precomputeTargetReferencePose();
    this.fullBasisGate = this.runFullBasisProbeGate();
    this.restoreAsset();
  }

  captureOriginalAssetState() {
    this.layer.group.updateMatrixWorld(true);
    for (const jointId of this.layer.orderedJointIds) {
      const bone = this.layer.bonesById.get(jointId);
      this.original.set(jointId, {
        localPosition: bone.position.clone(),
        localQuaternion: bone.quaternion.clone(),
        localScale: bone.scale.clone(),
        worldPosition: bone.getWorldPosition(new this.THREE.Vector3()),
        worldQuaternion: bone.getWorldQuaternion(new this.THREE.Quaternion()),
        worldMatrix: bone.matrixWorld.clone(),
      });
    }
  }

  precomputeTargetReferencePose() {
    this.restoreAsset();
    const sourceHips = this.sourceReferenceFrame.joints.hips.worldPosition;
    const targetHips = this.original.get('hips').worldPosition.toArray();
    this.referenceCarrierOffset = new this.THREE.Vector3(
      sourceHips[0] - targetHips[0],
      sourceHips[1] - targetHips[1],
      sourceHips[2] - targetHips[2],
    );
    this.applyCarrierTransform(this.referenceCarrierOffset, new this.THREE.Vector3());

    for (const jointId of JOINT_ORDER) {
      const bone = this.layer.bonesById.get(jointId);
      const source = this.sourceReferenceFrame.joints[jointId];
      if (!bone || !source) continue;
      let solved;
      const branchChildren = BRANCH_CHILDREN[jointId];
      const primaryChildId = PRIMARY_CHILD[jointId];
      if (branchChildren) solved = this.solveBranchWorldQuaternion(jointId, branchChildren);
      else if (primaryChildId && this.layer.bonesById.has(primaryChildId)) {
        solved = this.solveSingleChainWorldQuaternion(jointId, primaryChildId);
      } else {
        solved = {
          worldQuaternion: new this.THREE.Quaternion().fromArray(source.worldRotation).normalize(),
          basisSource: 'terminal-source-reference-world',
          fitResidualDegrees: 0,
          determinant: 1,
        };
      }

      bone.parent.updateWorldMatrix(true, false);
      const parentWorld = bone.parent.getWorldQuaternion(new this.THREE.Quaternion());
      const localQuaternion = parentWorld.invert().multiply(solved.worldQuaternion).normalize();
      bone.position.copy(this.original.get(jointId).localPosition);
      bone.quaternion.copy(localQuaternion);
      bone.scale.copy(this.original.get(jointId).localScale);
      bone.updateWorldMatrix(false, true);
      this.solverRecords.set(jointId, solved);
    }
    this.updateSkin();

    for (const jointId of this.layer.orderedJointIds) {
      const bone = this.layer.bonesById.get(jointId);
      const source = this.sourceReferenceFrame.joints[jointId] ?? null;
      const semantic = this.sourceJointById.get(jointId) ?? null;
      const worldQuaternion = bone.getWorldQuaternion(new this.THREE.Quaternion());
      const worldPosition = bone.getWorldPosition(new this.THREE.Vector3());
      this.reference.set(jointId, {
        localQuaternion: bone.quaternion.clone(),
        worldQuaternion,
        worldPosition,
      });
      if (!source || !semantic) continue;

      const sourceWorldQuaternion = new this.THREE.Quaternion().fromArray(source.worldRotation).normalize();
      const sourceToTarget = worldQuaternion.clone().invert().multiply(sourceWorldQuaternion).normalize();
      const sourceAxes = orthonormalAxes(this.THREE, semantic.axisReference);
      const targetAxes = {
        twist: sourceAxes.twist.clone().applyQuaternion(sourceToTarget).normalize(),
        bend: sourceAxes.bend.clone().applyQuaternion(sourceToTarget).normalize(),
        side: sourceAxes.side.clone().applyQuaternion(sourceToTarget).normalize(),
      };
      const orthogonalityError = maximumOrthogonalityError(targetAxes);
      const determinant = targetAxes.twist.clone().cross(targetAxes.bend).dot(targetAxes.side);
      this.fullBasis.set(jointId, {
        sourceAxes,
        targetAxes,
        sourceToTarget,
        inverse: sourceToTarget.clone().invert(),
        orthogonalityError,
        determinant,
        basisSource: `${this.solverRecords.get(jointId)?.basisSource ?? 'terminal'}+HumanRigCore-axisReference`,
      });
    }
    this.referenceFingerprintValue = this.createReferenceFingerprint();
  }

  solveBranchWorldQuaternion(jointId, childIds) {
    const sourceJoint = this.sourceReferenceFrame.joints[jointId];
    const localVectors = [];
    const worldVectors = [];
    for (const childId of childIds) {
      const targetChild = this.original.get(childId);
      const sourceChild = this.sourceReferenceFrame.joints[childId];
      if (!targetChild || !sourceChild) continue;
      localVectors.push(targetChild.localPosition.clone().normalize());
      worldVectors.push(directionVector(this.THREE, sourceJoint.worldPosition, sourceChild.worldPosition));
    }
    if (localVectors.length < 2) throw new Error(`${jointId} branch calibration requires multiple child vectors.`);
    const worldQuaternion = solveDeterministicWahba(this.THREE, localVectors, worldVectors);
    const residuals = localVectors.map((vector, index) => angleDegrees(
      vector.clone().applyQuaternion(worldQuaternion),
      worldVectors[index],
    ));
    return {
      worldQuaternion,
      basisSource: `multi-vector-wahba:${childIds.join('+')}`,
      fitResidualDegrees: Math.max(...residuals),
      determinant: quaternionDeterminant(this.THREE, worldQuaternion),
      childIds: [...childIds],
    };
  }

  solveSingleChainWorldQuaternion(jointId, childId) {
    const sourceJoint = this.sourceReferenceFrame.joints[jointId];
    const sourceChild = this.sourceReferenceFrame.joints[childId];
    const semantic = this.sourceJointById.get(jointId);
    const original = this.original.get(jointId);
    const targetChild = this.original.get(childId);
    const targetTwist = targetChild.localPosition.clone().normalize();
    const sourceTwistWorld = directionVector(this.THREE, sourceJoint.worldPosition, sourceChild.worldPosition);
    const sourceWorldQuaternion = new this.THREE.Quaternion().fromArray(sourceJoint.worldRotation).normalize();
    const sourceBendWorld = new this.THREE.Vector3()
      .fromArray(semantic.axisReference.bendAxisLocal)
      .applyQuaternion(sourceWorldQuaternion);
    const desiredBend = perpendicularUnit(this.THREE, sourceBendWorld, sourceTwistWorld);
    const targetBendSeed = sourceBendWorld.clone().applyQuaternion(original.worldQuaternion.clone().invert());
    const targetBend = perpendicularUnit(this.THREE, targetBendSeed, targetTwist);
    const sourceFrame = rightHandedFrame(this.THREE, sourceTwistWorld, desiredBend);
    const targetFrame = rightHandedFrame(this.THREE, targetTwist, targetBend);
    const worldQuaternion = quaternionFromFrameMapping(this.THREE, targetFrame, sourceFrame);
    return {
      worldQuaternion,
      basisSource: `explicit-primary:${jointId}->${childId}+secondary-anatomical-axis`,
      fitResidualDegrees: angleDegrees(targetTwist.clone().applyQuaternion(worldQuaternion), sourceTwistWorld),
      determinant: quaternionDeterminant(this.THREE, worldQuaternion),
      childIds: [childId],
    };
  }

  apply(finalPose) {
    if (!finalPose?.localRotations || !Array.isArray(finalPose.rootPosition)) {
      throw new Error('Reference retarget requires PoseFrame V4 finalPose data.');
    }
    const sourceRoot = this.sourceReferenceFrame.joints.hips.worldPosition;
    const dynamicRootDelta = new this.THREE.Vector3(
      Number(finalPose.rootPosition[0]) - sourceRoot[0],
      Number(finalPose.rootPosition[1]) - sourceRoot[1],
      Number(finalPose.rootPosition[2]) - sourceRoot[2],
    );
    this.applyCarrierTransform(this.referenceCarrierOffset, dynamicRootDelta);

    const sourceDelta = new this.THREE.Quaternion();
    const convertedDelta = new this.THREE.Quaternion();
    for (const jointId of this.layer.orderedJointIds) {
      const bone = this.layer.bonesById.get(jointId);
      const original = this.original.get(jointId);
      const reference = this.reference.get(jointId);
      const basis = this.fullBasis.get(jointId);
      bone.position.copy(original.localPosition);
      bone.scale.copy(original.localScale);
      if (!reference || !basis) {
        bone.quaternion.copy(original.localQuaternion);
        continue;
      }
      const delta = jointId === finalPose.rootJointId
        ? finalPose.rootRotation
        : finalPose.localRotations[jointId] ?? IDENTITY;
      sourceDelta.fromArray(delta).normalize();
      convertedDelta.copy(basis.sourceToTarget)
        .multiply(sourceDelta)
        .multiply(basis.inverse)
        .normalize();
      bone.quaternion.copy(reference.localQuaternion).multiply(convertedDelta).normalize();
    }
    this.updateSkin();
    return {
      schema: TEMPLATE_CANONICAL_REFERENCE_POSE_CALIBRATOR_V5_SCHEMA,
      applied: true,
      referenceFingerprint: this.referenceFingerprintValue,
      correctionPolicy: 'targetReferenceLocal * (M_source_to_target * sourceBindRelativeDelta * inverse(M_source_to_target))',
      referenceCarrierOffset: this.referenceCarrierOffset.toArray(),
      dynamicRootDelta: dynamicRootDelta.toArray(),
      rootApplicationCount: 1,
      poseSpecificOffsets: false,
    };
  }

  applyReferencePose() {
    return this.apply({
      rootJointId: 'hips',
      rootPosition: [...this.sourceReferenceFrame.joints.hips.worldPosition],
      rootRotation: [...IDENTITY],
      localRotations: {},
    });
  }

  restoreAsset() {
    restoreTransform(this.layer.group, this.originalCarrier);
    for (const [jointId, original] of this.original) {
      const bone = this.layer.bonesById.get(jointId);
      bone.position.copy(original.localPosition);
      bone.quaternion.copy(original.localQuaternion);
      bone.scale.copy(original.localScale);
    }
    this.updateSkin();
  }

  runAssetRestoreGate() {
    this.restoreAsset();
    let maximumQuaternionAngularErrorDegrees = 0;
    let maximumPositionErrorMeters = 0;
    let maximumScaleError = 0;
    let maximumWorldMatrixElementError = 0;
    const joints = [];
    for (const [jointId, original] of this.original) {
      const bone = this.layer.bonesById.get(jointId);
      const quaternionAngularErrorDegrees = quaternionErrorDegrees(bone.quaternion, original.localQuaternion);
      const positionErrorMeters = bone.position.distanceTo(original.localPosition);
      const scaleError = bone.scale.distanceTo(original.localScale);
      const worldMatrixElementError = maximumArrayDifference(bone.matrixWorld.elements, original.worldMatrix.elements);
      maximumQuaternionAngularErrorDegrees = Math.max(maximumQuaternionAngularErrorDegrees, quaternionAngularErrorDegrees);
      maximumPositionErrorMeters = Math.max(maximumPositionErrorMeters, positionErrorMeters);
      maximumScaleError = Math.max(maximumScaleError, scaleError);
      maximumWorldMatrixElementError = Math.max(maximumWorldMatrixElementError, worldMatrixElementError);
      joints.push({ jointId, quaternionAngularErrorDegrees, positionErrorMeters, scaleError, worldMatrixElementError });
    }
    const inverseBindMatricesByteUnchanged = compareBytes(
      this.originalInverseBindBytes,
      copyViewBytes(this.layer.inverseBindMatrices),
    );
    const skinWeightsByteUnchanged = compareBytes(
      this.originalWeightBytes,
      copyViewBytes(this.layer.skinWeights),
    );
    return {
      passed: maximumQuaternionAngularErrorDegrees <= 0.01
        && maximumPositionErrorMeters <= 1e-7
        && maximumScaleError <= 1e-7
        && maximumWorldMatrixElementError <= 1e-7
        && inverseBindMatricesByteUnchanged
        && skinWeightsByteUnchanged,
      maximumQuaternionAngularErrorDegrees,
      maximumPositionErrorMeters,
      maximumScaleError,
      maximumWorldMatrixElementError,
      inverseBindMatricesByteUnchanged,
      skinWeightsByteUnchanged,
      joints,
      thresholds: {
        quaternionAngularErrorDegrees: 0.01,
        positionErrorMeters: 1e-7,
        scaleError: 1e-7,
        worldMatrixElementError: 1e-7,
      },
    };
  }

  runFullBasisProbeGate() {
    const probes = [];
    let maximumProbeAngularErrorDegrees = 0;
    let maximumOrthogonalityError = 0;
    let minimumDeterminant = Number.POSITIVE_INFINITY;
    const probeAngle = 17 * Math.PI / 180;
    for (const [jointId, basis] of this.fullBasis) {
      maximumOrthogonalityError = Math.max(maximumOrthogonalityError, basis.orthogonalityError);
      minimumDeterminant = Math.min(minimumDeterminant, basis.determinant);
      for (const channel of ['twist', 'bend', 'side']) {
        const sourceProbe = new this.THREE.Quaternion().setFromAxisAngle(basis.sourceAxes[channel], probeAngle);
        const converted = basis.sourceToTarget.clone().multiply(sourceProbe).multiply(basis.inverse).normalize();
        const expected = new this.THREE.Quaternion().setFromAxisAngle(basis.targetAxes[channel], probeAngle);
        const angularErrorDegrees = quaternionErrorDegrees(converted, expected);
        maximumProbeAngularErrorDegrees = Math.max(maximumProbeAngularErrorDegrees, angularErrorDegrees);
        probes.push({ jointId, channel, probeDegrees: 17, angularErrorDegrees });
      }
    }
    return {
      passed: maximumProbeAngularErrorDegrees <= 0.01
        && maximumOrthogonalityError <= 1e-6
        && minimumDeterminant >= 1 - 1e-6,
      referenceTUsesCalibratedReference: true,
      maximumProbeAngularErrorDegrees,
      maximumOrthogonalityError,
      minimumDeterminant,
      reflectionDetected: minimumDeterminant < 0,
      probes,
      thresholds: { probeAngularErrorDegrees: 0.01, orthogonalityError: 1e-6, determinant: 1 - 1e-6 },
    };
  }

  createReferencePoseAudit() {
    return this.layer.orderedJointIds.map((jointId) => {
      const source = this.sourceReferenceFrame.joints[jointId] ?? null;
      const original = this.original.get(jointId);
      const reference = this.reference.get(jointId) ?? null;
      const basis = this.fullBasis.get(jointId) ?? null;
      const childId = PRIMARY_CHILD[jointId] ?? BRANCH_CHILDREN[jointId]?.[0] ?? null;
      const sourceChild = childId ? this.sourceReferenceFrame.joints[childId] : null;
      const targetChild = childId ? this.original.get(childId) : null;
      const sourceLength = source && sourceChild
        ? distanceArrays(source.worldPosition, sourceChild.worldPosition)
        : 0;
      const targetLength = targetChild ? targetChild.localPosition.length() : 0;
      return {
        sourceJointId: source ? jointId : null,
        targetJointId: jointId,
        sourceParentId: source?.parentId ?? null,
        targetParentId: this.layer.parentIdById.get(jointId) ?? null,
        explicitPrimaryChildId: childId,
        branchChildIds: BRANCH_CHILDREN[jointId] ? [...BRANCH_CHILDREN[jointId]] : [],
        originalTargetLocalPosition: original.localPosition.toArray(),
        originalTargetLocalQuaternion: original.localQuaternion.toArray(),
        originalTargetLocalScale: original.localScale.toArray(),
        originalTargetWorldPosition: original.worldPosition.toArray(),
        originalTargetWorldQuaternion: original.worldQuaternion.toArray(),
        sourceReferenceWorldPosition: source ? [...source.worldPosition] : null,
        sourceReferenceWorldQuaternion: source ? [...source.worldRotation] : null,
        targetReferenceLocalQuaternion: reference?.localQuaternion.toArray() ?? null,
        targetReferenceWorldPosition: reference?.worldPosition.toArray() ?? null,
        targetReferenceWorldQuaternion: reference?.worldQuaternion.toArray() ?? null,
        sourceLength,
        targetLength,
        absoluteLengthDelta: Math.abs(sourceLength - targetLength),
        relativeLengthDelta: sourceLength > 1e-12 ? Math.abs(sourceLength - targetLength) / sourceLength : 0,
        sourceDirection: source && sourceChild ? directionVector(this.THREE, source.worldPosition, sourceChild.worldPosition).toArray() : null,
        targetBindDirection: targetChild ? targetChild.localPosition.clone().normalize().toArray() : null,
        targetReferenceDirection: reference && childId && this.reference.get(childId)
          ? directionVector(this.THREE, reference.worldPosition.toArray(), this.reference.get(childId).worldPosition.toArray()).toArray()
          : null,
        solver: serializeSolver(this.solverRecords.get(jointId)),
        mappingStatus: source && reference && basis ? 'mapped-reference-full-basis' : 'asset-only-unmapped',
      };
    });
  }

  createFullBasisAudit() {
    return [...this.fullBasis].map(([jointId, basis]) => ({
      jointId,
      sourceTwistAxis: basis.sourceAxes.twist.toArray(),
      sourceBendAxis: basis.sourceAxes.bend.toArray(),
      sourceSideAxis: basis.sourceAxes.side.toArray(),
      targetTwistAxis: basis.targetAxes.twist.toArray(),
      targetBendAxis: basis.targetAxes.bend.toArray(),
      targetSideAxis: basis.targetAxes.side.toArray(),
      M_source_to_target: basis.sourceToTarget.toArray(),
      orthogonalityError: basis.orthogonalityError,
      determinant: basis.determinant,
      basisSource: basis.basisSource,
    }));
  }

  createReferenceFingerprint() {
    return this.layer.orderedJointIds.map((jointId) => {
      const quaternion = this.reference.get(jointId)?.localQuaternion ?? this.original.get(jointId).localQuaternion;
      return `${jointId}:${quaternion.toArray().map((value) => value.toFixed(12)).join(',')}`;
    }).join('|');
  }

  applyCarrierTransform(referenceOffset, dynamicDelta) {
    this.layer.group.position.copy(this.originalCarrier.position).add(referenceOffset).add(dynamicDelta);
    this.layer.group.quaternion.copy(this.originalCarrier.quaternion);
    this.layer.group.scale.copy(this.originalCarrier.scale);
    this.layer.group.updateMatrixWorld(true);
  }

  updateSkin() {
    this.layer.group.updateMatrixWorld(true);
    this.layer.skeleton.update();
    this.layer.cacheSkinMatrices();
  }
}

function captureTransform(object) {
  return {
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
    scale: object.scale.clone(),
  };
}

function restoreTransform(object, value) {
  object.position.copy(value.position);
  object.quaternion.copy(value.quaternion);
  object.scale.copy(value.scale);
}

function orthonormalAxes(THREE, axisReference) {
  const twist = new THREE.Vector3().fromArray(axisReference.twistAxisLocal).normalize();
  const bend = perpendicularUnit(THREE, new THREE.Vector3().fromArray(axisReference.bendAxisLocal), twist);
  return rightHandedFrame(THREE, twist, bend);
}

function rightHandedFrame(_THREE, twistInput, bendInput) {
  const twist = twistInput.clone().normalize();
  const bend = bendInput.clone().addScaledVector(twist, -bendInput.dot(twist)).normalize();
  const side = twist.clone().cross(bend).normalize();
  bend.copy(side).cross(twist).normalize();
  return { twist, bend, side };
}

function perpendicularUnit(THREE, input, normal) {
  const value = input.clone().addScaledVector(normal, -input.dot(normal));
  if (value.lengthSq() <= 1e-14) {
    const seed = Math.abs(normal.x) < 0.8
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
    value.copy(seed).addScaledVector(normal, -seed.dot(normal));
  }
  return value.normalize();
}

function quaternionFromFrameMapping(THREE, sourceFrame, targetFrame) {
  const sourceMatrix = new THREE.Matrix4().makeBasis(sourceFrame.twist, sourceFrame.bend, sourceFrame.side);
  const targetMatrix = new THREE.Matrix4().makeBasis(targetFrame.twist, targetFrame.bend, targetFrame.side);
  const rotation = targetMatrix.multiply(sourceMatrix.transpose());
  return new THREE.Quaternion().setFromRotationMatrix(rotation).normalize();
}

function solveDeterministicWahba(THREE, localVectors, worldVectors) {
  const localPrimary = localVectors[0].clone().normalize();
  const worldPrimary = worldVectors[0].clone().normalize();
  const localSecondary = perpendicularUnit(THREE, localVectors[2].clone().sub(localVectors[1]), localPrimary);
  const worldSecondary = perpendicularUnit(THREE, worldVectors[2].clone().sub(worldVectors[1]), worldPrimary);
  const quaternion = quaternionFromFrameMapping(
    THREE,
    rightHandedFrame(THREE, localPrimary, localSecondary),
    rightHandedFrame(THREE, worldPrimary, worldSecondary),
  );
  const torque = new THREE.Vector3();
  const predicted = new THREE.Vector3();
  for (let iteration = 0; iteration < 96; iteration += 1) {
    torque.set(0, 0, 0);
    let alignment = 0;
    for (let index = 0; index < localVectors.length; index += 1) {
      predicted.copy(localVectors[index]).applyQuaternion(quaternion).normalize();
      torque.add(predicted.clone().cross(worldVectors[index]));
      alignment += predicted.dot(worldVectors[index]);
    }
    const magnitude = torque.length();
    if (magnitude <= 1e-13) break;
    const step = Math.min(0.12, Math.atan2(magnitude, Math.max(1e-12, alignment)) * 0.5);
    const delta = new THREE.Quaternion().setFromAxisAngle(torque.normalize(), step);
    quaternion.premultiply(delta).normalize();
  }
  return quaternion;
}

function directionVector(THREE, start, end) {
  return new THREE.Vector3(
    end[0] - start[0],
    end[1] - start[1],
    end[2] - start[2],
  ).normalize();
}

function maximumOrthogonalityError(axes) {
  return Math.max(
    Math.abs(axes.twist.dot(axes.bend)),
    Math.abs(axes.twist.dot(axes.side)),
    Math.abs(axes.bend.dot(axes.side)),
    Math.abs(axes.twist.length() - 1),
    Math.abs(axes.bend.length() - 1),
    Math.abs(axes.side.length() - 1),
  );
}

function quaternionDeterminant(THREE, quaternion) {
  return new THREE.Matrix4().makeRotationFromQuaternion(quaternion).determinant();
}

function quaternionErrorDegrees(left, right) {
  return 2 * Math.acos(Math.min(1, Math.max(-1, Math.abs(left.dot(right))))) * 180 / Math.PI;
}

function angleDegrees(left, right) {
  return Math.acos(Math.min(1, Math.max(-1, left.clone().normalize().dot(right.clone().normalize())))) * 180 / Math.PI;
}

function copyViewBytes(value) {
  if (!value?.buffer) return new Uint8Array();
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice();
}

function compareBytes(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false;
  return true;
}

function maximumArrayDifference(left, right) {
  let maximum = 0;
  for (let index = 0; index < left.length; index += 1) maximum = Math.max(maximum, Math.abs(left[index] - right[index]));
  return maximum;
}

function distanceArrays(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

function serializeSolver(value) {
  if (!value) return null;
  return {
    basisSource: value.basisSource,
    fitResidualDegrees: value.fitResidualDegrees,
    determinant: value.determinant,
    childIds: value.childIds ?? [],
  };
}
