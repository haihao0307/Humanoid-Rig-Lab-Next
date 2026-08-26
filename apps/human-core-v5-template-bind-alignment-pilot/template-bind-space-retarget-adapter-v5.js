const IDENTITY = Object.freeze([0, 0, 0, 1]);

export const TEMPLATE_BIND_SPACE_RETARGET_ADAPTER_V5_SCHEMA =
  'humanoid_rig/template_bind_space_retarget_adapter@5.0';

/**
 * Pilot-only deterministic bind-basis adapter. It consumes PoseFrame V4
 * bind-relative local deltas and never mutates HumanRigCore, bind positions,
 * bind scales, skin weights, or inverse bind matrices.
 */
export class TemplateBindSpaceRetargetAdapterV5 {
  constructor({ THREE, templateLayer, rigCore, sourceBindFrame } = {}) {
    if (!THREE || !templateLayer?.mesh || !templateLayer?.skeleton) {
      throw new Error('TemplateBindSpaceRetargetAdapterV5 requires a loaded template layer.');
    }
    if (!sourceBindFrame?.joints?.hips || !Array.isArray(rigCore?.joints)) {
      throw new Error('TemplateBindSpaceRetargetAdapterV5 requires Human Core source bind data.');
    }
    this.THREE = THREE;
    this.layer = templateLayer;
    this.rigCore = rigCore;
    this.sourceBindFrame = sourceBindFrame;
    this.sourceRootPosition = [...sourceBindFrame.joints.hips.bindWorldPosition];
    this.targetBind = new Map();
    this.corrections = new Map();
    this.mappings = [];
    this.captureTargetBind();
    this.precomputeCorrections();
  }

  captureTargetBind() {
    for (const targetJointId of this.layer.orderedJointIds) {
      const bone = this.layer.bonesById.get(targetJointId);
      bone.position.copy(this.layer.bindLocalPositions.get(targetJointId));
      bone.quaternion.copy(this.layer.bindLocalQuaternions.get(targetJointId));
      bone.scale.copy(this.layer.bindLocalScales.get(targetJointId));
    }
    this.layer.mesh.updateMatrixWorld(true);
    for (const targetJointId of this.layer.orderedJointIds) {
      const bone = this.layer.bonesById.get(targetJointId);
      const sourceJoint = this.sourceBindFrame.joints[targetJointId] ?? null;
      this.targetBind.set(targetJointId, {
        position: bone.position.clone(),
        quaternion: bone.quaternion.clone(),
        scale: bone.scale.clone(),
        worldPosition: bone.getWorldPosition(new this.THREE.Vector3()),
        worldQuaternion: bone.getWorldQuaternion(new this.THREE.Quaternion()),
      });
      this.mappings.push({
        sourceJointId: sourceJoint ? targetJointId : null,
        targetJointId,
        sourceParentId: sourceJoint?.parentId ?? null,
        targetParentId: this.layer.parentIdById.get(targetJointId) ?? null,
      });
    }
  }

  precomputeCorrections() {
    for (const mapping of this.mappings) {
      const { sourceJointId, targetJointId } = mapping;
      if (!sourceJointId) {
        this.corrections.set(targetJointId, this.identityCorrection('unmapped-target-joint'));
        continue;
      }
      const sourceChildId = primarySourceChild(this.sourceBindFrame, sourceJointId);
      const targetChildId = this.layer.primaryChildById.get(targetJointId) ?? null;
      const sourceDirection = sourceChildId
        ? normalized(this.THREE, this.sourceBindFrame.joints[sourceChildId]?.bindLocalPosition)
        : null;
      const targetDirection = targetChildId
        ? normalized(this.THREE, this.targetBind.get(targetChildId)?.position)
        : null;
      if (!sourceDirection || !targetDirection) {
        this.corrections.set(targetJointId, this.identityCorrection('mapped-terminal-no-primary-axis'));
        continue;
      }
      const quaternion = new this.THREE.Quaternion()
        .setFromUnitVectors(sourceDirection, targetDirection)
        .normalize();
      this.corrections.set(targetJointId, {
        quaternion,
        inverse: quaternion.clone().invert(),
        sourceChildId,
        targetChildId,
        sourceDirection: sourceDirection.toArray(),
        targetDirection: targetDirection.toArray(),
        axisBasisDifferenceDegrees: radiansToDegrees(sourceDirection.angleTo(targetDirection)),
        mappingStatus: 'mapped-primary-axis-basis',
      });
    }
  }

  identityCorrection(mappingStatus) {
    const quaternion = new this.THREE.Quaternion();
    return {
      quaternion,
      inverse: quaternion.clone(),
      sourceChildId: null,
      targetChildId: null,
      sourceDirection: null,
      targetDirection: null,
      axisBasisDifferenceDegrees: 0,
      mappingStatus,
    };
  }

  apply(finalPose) {
    if (!finalPose?.localRotations || !Array.isArray(finalPose.rootPosition)) {
      throw new Error('TemplateBindSpaceRetargetAdapterV5 requires PoseFrame V4 data.');
    }
    const qSource = new this.THREE.Quaternion();
    const qConverted = new this.THREE.Quaternion();
    for (const mapping of this.mappings) {
      const { sourceJointId, targetJointId } = mapping;
      const bone = this.layer.bonesById.get(targetJointId);
      const bind = this.targetBind.get(targetJointId);
      bone.position.copy(bind.position);
      bone.quaternion.copy(bind.quaternion);
      bone.scale.copy(bind.scale);
      if (!sourceJointId) continue;
      const sourceDelta = sourceJointId === finalPose.rootJointId
        ? finalPose.rootRotation
        : finalPose.localRotations[sourceJointId] ?? IDENTITY;
      qSource.fromArray(sourceDelta).normalize();
      const correction = this.corrections.get(targetJointId);
      qConverted.copy(correction.quaternion)
        .multiply(qSource)
        .multiply(correction.inverse)
        .normalize();
      bone.quaternion.copy(bind.quaternion).multiply(qConverted).normalize();
    }
    const root = this.layer.bonesById.get(finalPose.rootJointId);
    const rootBind = this.targetBind.get(finalPose.rootJointId);
    if (root && rootBind) {
      root.position.copy(rootBind.position).add(new this.THREE.Vector3(
        Number(finalPose.rootPosition[0]) - this.sourceRootPosition[0],
        Number(finalPose.rootPosition[1]) - this.sourceRootPosition[1],
        Number(finalPose.rootPosition[2]) - this.sourceRootPosition[2],
      ));
    }
    this.updateSkin();
    return {
      schema: TEMPLATE_BIND_SPACE_RETARGET_ADAPTER_V5_SCHEMA,
      applied: true,
      poseAuthority: 'finalPose.localRotations',
      correctionPolicy: 'targetBindLocal * (C * sourceBindRelativeDelta * inverse(C))',
      correctionSetFingerprint: this.correctionSetFingerprint(),
      rootTranslationApplicationCount: 1,
    };
  }

  restoreBind() {
    for (const [jointId, bind] of this.targetBind) {
      const bone = this.layer.bonesById.get(jointId);
      bone.position.copy(bind.position);
      bone.quaternion.copy(bind.quaternion);
      bone.scale.copy(bind.scale);
    }
    this.updateSkin();
  }

  runIdentityGate() {
    this.apply({
      rootJointId: 'hips',
      rootPosition: [...this.sourceRootPosition],
      rootRotation: [...IDENTITY],
      localRotations: {},
    });
    const joints = [];
    let maximumQuaternionAngularErrorDegrees = 0;
    let maximumPositionErrorMeters = 0;
    let maximumScaleError = 0;
    for (const [jointId, bind] of this.targetBind) {
      const bone = this.layer.bonesById.get(jointId);
      const quaternionAngularErrorDegrees = quaternionErrorDegrees(bone.quaternion, bind.quaternion);
      const positionErrorMeters = bone.position.distanceTo(bind.position);
      const scaleError = bone.scale.distanceTo(bind.scale);
      maximumQuaternionAngularErrorDegrees = Math.max(maximumQuaternionAngularErrorDegrees, quaternionAngularErrorDegrees);
      maximumPositionErrorMeters = Math.max(maximumPositionErrorMeters, positionErrorMeters);
      maximumScaleError = Math.max(maximumScaleError, scaleError);
      joints.push({ jointId, quaternionAngularErrorDegrees, positionErrorMeters, scaleError });
    }
    const result = {
      passed: maximumQuaternionAngularErrorDegrees <= 0.01
        && maximumPositionErrorMeters <= 1e-7
        && maximumScaleError <= 1e-7,
      maximumQuaternionAngularErrorDegrees,
      maximumPositionErrorMeters,
      maximumScaleError,
      thresholds: {
        quaternionAngularErrorDegrees: 0.01,
        positionErrorMeters: 1e-7,
        scaleError: 1e-7,
      },
      joints,
    };
    this.restoreBind();
    return result;
  }

  createBindAudit() {
    const rigJointById = new Map(this.rigCore.joints.map((joint) => [joint.jointId, joint]));
    return this.mappings.map((mapping) => {
      const source = mapping.sourceJointId ? this.sourceBindFrame.joints[mapping.sourceJointId] : null;
      const semantic = mapping.sourceJointId ? rigJointById.get(mapping.sourceJointId) : null;
      const bind = this.targetBind.get(mapping.targetJointId);
      const correction = this.corrections.get(mapping.targetJointId);
      const inverseIndex = this.layer.boneIndexById.get(mapping.targetJointId);
      return {
        ...mapping,
        sourceBindLocalPosition: source ? [...source.bindLocalPosition] : null,
        targetBindLocalPosition: bind.position.toArray(),
        sourceBindLocalQuaternion: source ? [...IDENTITY] : null,
        targetBindLocalQuaternion: bind.quaternion.toArray(),
        targetBindLocalScale: bind.scale.toArray(),
        sourceBindWorldPosition: source ? [...source.bindWorldPosition] : null,
        targetBindWorldPosition: bind.worldPosition.toArray(),
        sourceBindWorldQuaternion: source ? [...IDENTITY] : null,
        targetBindWorldQuaternion: bind.worldQuaternion.toArray(),
        sourceJointAxisDeclaration: semantic?.axisReference ?? null,
        sourceBoneLength: sourceBoneLength(this.sourceBindFrame, mapping.sourceJointId),
        targetBoneLength: targetBoneLength(this.layer, mapping.targetJointId),
        axisBasisDifference: {
          degrees: correction.axisBasisDifferenceDegrees,
          sourceDirection: correction.sourceDirection,
          targetDirection: correction.targetDirection,
        },
        candidateCorrectionQuaternion: correction.quaternion.toArray(),
        mappingStatus: correction.mappingStatus,
        inverseBindMatrix: inverseIndex == null
          ? null
          : Array.from(this.layer.inverseBindMatrices.slice(inverseIndex * 16, inverseIndex * 16 + 16)),
        skinJointIndex: inverseIndex ?? null,
      };
    });
  }

  correctionSetFingerprint() {
    return this.mappings.map(({ targetJointId }) => {
      const q = this.corrections.get(targetJointId).quaternion;
      return `${targetJointId}:${q.toArray().map((value) => value.toFixed(12)).join(',')}`;
    }).join('|');
  }

  updateSkin() {
    this.layer.mesh.updateMatrixWorld(true);
    this.layer.skeleton.update();
    this.layer.cacheSkinMatrices();
  }
}

function primarySourceChild(frame, parentId) {
  return Object.values(frame.joints).find((joint) => joint.parentId === parentId)?.jointId ?? null;
}

function sourceBoneLength(frame, jointId) {
  const childId = jointId ? primarySourceChild(frame, jointId) : null;
  return childId ? Math.hypot(...frame.joints[childId].bindLocalPosition) : 0;
}

function targetBoneLength(layer, jointId) {
  const childId = layer.primaryChildById.get(jointId);
  return childId ? layer.bindLocalPositions.get(childId)?.length() ?? 0 : 0;
}

function normalized(THREE, value) {
  if (!value) return null;
  const vector = value.isVector3 ? value.clone() : new THREE.Vector3().fromArray(value);
  return vector.lengthSq() > 1e-14 ? vector.normalize() : null;
}

function quaternionErrorDegrees(left, right) {
  return radiansToDegrees(2 * Math.acos(Math.min(1, Math.max(-1, Math.abs(left.dot(right))))));
}

function radiansToDegrees(value) {
  return value * 180 / Math.PI;
}
