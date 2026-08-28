import { conjugateQuaternion, multiplyQuaternions, normalizeQuaternion } from '../../animation/quaternion.js';
import { composeRigidMatrix, invertRigidMatrix, lerp3, normalize3, quaternionPower } from './math-v1.js';

export const HRL_PERFORMANCE_DEFORM_RIG_V1_SCHEMA = 'humanoid_rig/hrl_performance_deform_rig@1.0';
export const HRL_SKIN_BIND_PROFILE_V1_SCHEMA = 'humanoid_rig/hrl_skin_bind_profile@1.0';

const AXIAL_SPECS = [
  ['pelvis', null, 'hips', 0], ['spineLower', 'pelvis', 'spine', 0], ['spineMiddle', 'spineLower', ['spine','chest'], 0.55],
  ['spineUpper', 'spineMiddle', 'chest', 0], ['chest', 'spineUpper', 'upperChest', 0], ['neck', 'chest', 'neck', 0], ['head', 'neck', 'head', 0],
];

const FINGER_SUFFIXES = ['ThumbMetacarpal','ThumbProximal','ThumbDistal','IndexProximal','IndexIntermediate','IndexDistal','MiddleProximal','MiddleIntermediate','MiddleDistal','RingProximal','RingIntermediate','RingDistal','LittleProximal','LittleIntermediate','LittleDistal'];

export class HRLPerformanceDeformRigV1 {
  constructor({ calibration, rigCore }) { this.calibration = calibration; this.rigCore = rigCore; }

  build() {
    const calibrated = this.calibration.calibratedJoints; const joints = [];
    const add = (id, parentId, source, alpha = 0, options = {}) => {
      const bindWorldPosition = Array.isArray(source) ? lerp3(calibrated[source[0]].worldPosition, calibrated[source[1]].worldPosition, alpha) : [...calibrated[source].worldPosition];
      joints.push({ id, parentId, bindWorldPosition, sourceJointId: options.sourceJointId ?? (Array.isArray(source) ? null : source), derived: Boolean(options.derived), derivedRule: options.derivedRule ?? null, rotationGroup: options.rotationGroup ?? null, rotationFraction: options.rotationFraction ?? 1, role: options.role ?? 'deform' });
    };
    for (const [id, parent, source, alpha] of AXIAL_SPECS) add(id, parent, source, alpha);
    for (const side of ['left','right']) {
      add(`${side}Clavicle`, 'chest', `${side}Shoulder`);
      add(`${side}Scapula`, `${side}Clavicle`, [`${side}Shoulder`,`${side}UpperArm`], 0.48, { derived: true, sourceJointId: `${side}Shoulder`, derivedRule: 'read-only scapular follower from finalPose shoulder rotation' });
      add(`${side}UpperArm`, `${side}Scapula`, `${side}UpperArm`, 0, { rotationGroup: `${side}UpperArmTwist`, rotationFraction: 1 / 3 });
      add(`${side}UpperArmTwist01`, `${side}UpperArm`, [`${side}UpperArm`,`${side}LowerArm`], 1 / 3, { derived: true, sourceJointId: `${side}UpperArm`, derivedRule: 'axial swing-twist decomposition fraction 1/3', rotationGroup: `${side}UpperArmTwist`, rotationFraction: 1 / 3 });
      add(`${side}UpperArmTwist02`, `${side}UpperArmTwist01`, [`${side}UpperArm`,`${side}LowerArm`], 2 / 3, { derived: true, sourceJointId: `${side}UpperArm`, derivedRule: 'axial swing-twist decomposition fraction 2/3', rotationGroup: `${side}UpperArmTwist`, rotationFraction: 1 / 3 });
      add(`${side}LowerArm`, `${side}UpperArmTwist02`, `${side}LowerArm`, 0, { rotationGroup: `${side}ForearmTwist`, rotationFraction: 1 / 3 });
      add(`${side}ForearmTwist01`, `${side}LowerArm`, [`${side}LowerArm`,`${side}Hand`], 1 / 3, { derived: true, sourceJointId: `${side}LowerArm`, derivedRule: 'axial swing-twist decomposition fraction 1/3', rotationGroup: `${side}ForearmTwist`, rotationFraction: 1 / 3 });
      add(`${side}ForearmTwist02`, `${side}ForearmTwist01`, [`${side}LowerArm`,`${side}Hand`], 2 / 3, { derived: true, sourceJointId: `${side}LowerArm`, derivedRule: 'axial swing-twist decomposition fraction 2/3', rotationGroup: `${side}ForearmTwist`, rotationFraction: 1 / 3 });
      add(`${side}Hand`, `${side}ForearmTwist02`, `${side}Hand`);
      for (const suffix of FINGER_SUFFIXES) {
        const sourceId = `${side}${suffix}`; const sourceParent = calibrated[sourceId].parentId; const parentId = sourceParent === `${side}Hand` ? `${side}Hand` : sourceParent;
        add(sourceId, parentId, sourceId);
      }
      add(`${side}UpperLeg`, 'pelvis', `${side}UpperLeg`, 0, { rotationGroup: `${side}ThighTwist`, rotationFraction: 1 / 3 });
      add(`${side}ThighTwist01`, `${side}UpperLeg`, [`${side}UpperLeg`,`${side}LowerLeg`], 1 / 3, { derived: true, sourceJointId: `${side}UpperLeg`, derivedRule: 'axial swing-twist decomposition fraction 1/3', rotationGroup: `${side}ThighTwist`, rotationFraction: 1 / 3 });
      add(`${side}ThighTwist02`, `${side}ThighTwist01`, [`${side}UpperLeg`,`${side}LowerLeg`], 2 / 3, { derived: true, sourceJointId: `${side}UpperLeg`, derivedRule: 'axial swing-twist decomposition fraction 2/3', rotationGroup: `${side}ThighTwist`, rotationFraction: 1 / 3 });
      add(`${side}LowerLeg`, `${side}ThighTwist02`, `${side}LowerLeg`, 0, { rotationGroup: `${side}CalfTwist`, rotationFraction: 0.5 });
      add(`${side}CalfTwist01`, `${side}LowerLeg`, [`${side}LowerLeg`,`${side}Foot`], 0.5, { derived: true, sourceJointId: `${side}LowerLeg`, derivedRule: 'axial swing-twist decomposition fraction 1/2', rotationGroup: `${side}CalfTwist`, rotationFraction: 0.5 });
      add(`${side}Foot`, `${side}CalfTwist01`, `${side}Foot`); add(`${side}Toe`, `${side}Foot`, `${side}Toes`);
    }
    const byId = new Map(joints.map((joint) => [joint.id, joint]));
    for (const joint of joints) joint.bindLocalPosition = joint.parentId && byId.has(joint.parentId) ? joint.bindWorldPosition.map((value, axis) => value - byId.get(joint.parentId).bindWorldPosition[axis]) : [...joint.bindWorldPosition];
    const bindLocalMatrices = joints.map((joint) => composeRigidMatrix([0,0,0,1], joint.bindLocalPosition));
    const bindWorldMatrices = joints.map((joint) => composeRigidMatrix([0,0,0,1], joint.bindWorldPosition));
    const inverseBindMatrices = bindWorldMatrices.map(invertRigidMatrix);
    const bonePaletteOrder = joints.map((joint) => joint.id); const paletteIndex = Object.fromEntries(bonePaletteOrder.map((id, index) => [id,index]));
    const twistBoneIds = joints.filter((joint) => /Twist\d+$/.test(joint.id)).map((joint) => joint.id);
    return {
      schema: HRL_PERFORMANCE_DEFORM_RIG_V1_SCHEMA, rigId: 'HRLPerformanceDeformRigV1', sourceHumanRigCoreId: this.rigCore.rigId,
      sourceHumanRigCoreTopologyFingerprint: this.rigCore.topology.fingerprint, poseAuthority: 'finalPose.localRotations', referencePose: 'natural-a-pose',
      joints, bonePaletteOrder, paletteIndex, twistBoneIds, bindLocalMatrices, bindWorldMatrices, inverseBindMatrices,
      rules: { independentAnimationTracksForDerivedBones: false, writesBackToFinalPose: false, boneScaleAllowed: false, sourceParentRelationshipsModified: false },
    };
  }
}

export function createHRLSkinBindProfileV1(performanceRig, hashes = {}) {
  return {
    schema: HRL_SKIN_BIND_PROFILE_V1_SCHEMA, bindProfileId: 'HRLSkinBindProfileV1', referencePose: 'natural-a-pose',
    bonePaletteOrder: performanceRig.bonePaletteOrder, bindLocalMatrices: performanceRig.bindLocalMatrices, bindWorldMatrices: performanceRig.bindWorldMatrices,
    inverseBindMatrices: performanceRig.inverseBindMatrices, surfaceToRigLandmarks: 'REFERENCE_POSE_CALIBRATION_V1.json#samples',
    bindPoseHash: hashes.bindPoseHash ?? null, inverseBindMatrixHash: hashes.inverseBindMatrixHash ?? null,
    externalInverseBindMatricesUsed: false, boneScaleApplied: false,
  };
}

export function compilePerformanceLocalRotations(performanceRig, finalPose) {
  const localRotations = {}; const sourceRotations = finalPose?.localRotations ?? {};
  for (const joint of performanceRig.joints) localRotations[joint.id] = [0,0,0,1];
  const handledGroups = new Set();
  for (const joint of performanceRig.joints) {
    if (!joint.sourceJointId || !sourceRotations[joint.sourceJointId]) continue;
    if (!joint.rotationGroup) { localRotations[joint.id] = normalizeQuaternion(sourceRotations[joint.sourceJointId]); continue; }
    if (handledGroups.has(joint.rotationGroup)) continue; handledGroups.add(joint.rotationGroup);
    const group = performanceRig.joints.filter((entry) => entry.rotationGroup === joint.rotationGroup); const source = normalizeQuaternion(sourceRotations[joint.sourceJointId]);
    const axis = normalize3(group[1]?.bindLocalPosition ?? group[0].bindLocalPosition, [1,0,0]); const { swing, twist } = swingTwist(source, axis);
    group.forEach((entry, index) => { const fractionalTwist = quaternionPower(twist, entry.rotationFraction); localRotations[entry.id] = index === 0 ? multiplyQuaternions(swing, fractionalTwist) : fractionalTwist; });
  }
  return localRotations;
}

function swingTwist(rotation, axis) {
  const q = normalizeQuaternion(rotation); const projection = q[0] * axis[0] + q[1] * axis[1] + q[2] * axis[2];
  const twist = normalizeQuaternion([axis[0] * projection, axis[1] * projection, axis[2] * projection, q[3]]);
  return { twist, swing: multiplyQuaternions(q, conjugateQuaternion(twist)) };
}
