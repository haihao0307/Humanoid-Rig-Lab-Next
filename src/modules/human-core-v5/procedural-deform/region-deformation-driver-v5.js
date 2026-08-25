import { assertPoseFrameV4 } from '../../pose/pose-frame-v4.js';
import { assertHumanRigCoreV5 } from '../human-rig-core-v5.js';
import { assertHumanAnatomyStateV5 } from '../human-anatomy-state-v5.js';

export const REGION_DEFORMATION_DRIVER_FRAME_V5_SCHEMA = 'humanoid_rig/region_deformation_driver_frame@5.0';
export const REGION_DRIVER_KEYS_V5 = Object.freeze([
  'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist',
  'leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle',
  'chest', 'abdomen', 'pelvis',
]);

export const REGION_DEFORMATION_SOURCE_JOINTS_V5 = Object.freeze({
  leftShoulder: ['leftShoulder', 'leftUpperArm'], rightShoulder: ['rightShoulder', 'rightUpperArm'],
  leftElbow: ['leftLowerArm'], rightElbow: ['rightLowerArm'], leftWrist: ['leftHand'], rightWrist: ['rightHand'],
  leftHip: ['leftUpperLeg'], rightHip: ['rightUpperLeg'], leftKnee: ['leftLowerLeg'], rightKnee: ['rightLowerLeg'],
  leftAnkle: ['leftFoot'], rightAnkle: ['rightFoot'], chest: ['chest', 'upperChest'], abdomen: ['spine'], pelvis: ['hips'],
});

export function createRegionDeformationDriverFrameV5({ finalPose, rigCore, anatomyState, bodyDNA, timestamp = Date.now() } = {}) {
  assertPoseFrameV4(finalPose);
  assertHumanRigCoreV5(rigCore);
  assertHumanAnatomyStateV5(anatomyState);
  if (finalPose.proportionRevision !== bodyDNA.proportionRevision) throw new Error('Region driver requires matching PoseFrame and BodyDNA proportion revisions.');
  const jointById = new Map(rigCore.joints.map((joint) => [joint.jointId, joint]));
  const anatomySignal = anatomyState.deformationSignal;
  const regions = {};
  for (const key of REGION_DRIVER_KEYS_V5) {
    const sourceJointIds = REGION_DEFORMATION_SOURCE_JOINTS_V5[key];
    const primary = sourceJointIds.find((id) => jointById.has(id)) ?? sourceJointIds[0];
    const joint = jointById.get(primary);
    const quaternion = primary === finalPose.rootJointId ? finalPose.rootRotation : finalPose.localRotations[primary] ?? [0, 0, 0, 1];
    const rotationVector = quaternionRotationVector(quaternion);
    const axes = joint?.axisReference ?? {
      bendAxisLocal: [0, 0, 1], twistAxisLocal: [1, 0, 0], sideAxisLocal: [0, 1, 0],
    };
    const bend = dot(rotationVector, axes.bendAxisLocal);
    const twist = dot(rotationVector, axes.twistAxisLocal);
    const side = dot(rotationVector, axes.sideAxisLocal);
    const anatomyRegion = anatomyRegionValue(key, anatomySignal);
    const asymmetry = sideAsymmetry(key, bodyDNA);
    regions[key] = {
      bend, twist, side,
      compression: clamp(Math.abs(bend) / Math.PI * 0.72 + anatomyRegion * 0.18, 0, 1),
      tension: clamp(Math.hypot(bend, side) / Math.PI, 0, 1),
      volume: clamp(0.82 + anatomyRegion * 0.32 + (asymmetry - 1) * 0.45, 0.65, 1.35),
      elevation: key.toLowerCase().includes('shoulder') ? clamp(Math.max(0, Math.abs(side), Math.abs(bend)) / (Math.PI / 2), 0, 1) : 0,
      activation: clamp(anatomyRegion * 0.58 + Math.hypot(...rotationVector) / Math.PI * 0.42, 0, 1),
      confidence: clamp(anatomyState.postureState?.confidence ?? 0.65, 0, 1),
      sourceJointIds,
      sourcePoseAuthority: 'finalPose.localRotations',
    };
  }
  return {
    schema: REGION_DEFORMATION_DRIVER_FRAME_V5_SCHEMA,
    schemaVersion: 5,
    type: 'RegionDeformationDriverFrame',
    humanId: bodyDNA.identity.humanId,
    rigId: rigCore.rigId,
    proportionRevision: bodyDNA.proportionRevision,
    sourcePoseAuthority: 'finalPose.localRotations',
    regions,
    timestamp: Number(timestamp) || 0,
  };
}

export function assertRegionDeformationDriverFrameV5(value) {
  if (value?.schema !== REGION_DEFORMATION_DRIVER_FRAME_V5_SCHEMA) throw new Error('Invalid RegionDeformationDriverFrame V5 schema.');
  if (value.sourcePoseAuthority !== 'finalPose.localRotations') throw new Error('Region drivers must use finalPose.localRotations.');
  for (const key of REGION_DRIVER_KEYS_V5) if (!value.regions?.[key]) throw new Error(`Missing region deformation driver ${key}.`);
  return value;
}

function quaternionRotationVector(value) {
  let q = normalizeQuaternion(value);
  if (q[3] < 0) q = q.map((component) => -component);
  const angle = 2 * Math.acos(clamp(q[3], -1, 1));
  const sin = Math.sqrt(Math.max(0, 1 - q[3] * q[3]));
  if (sin < 1e-8) return [0, 0, 0];
  return [q[0] / sin * angle, q[1] / sin * angle, q[2] / sin * angle];
}
function normalizeQuaternion(value) { const q = Array.from(value, Number); const length = Math.hypot(...q) || 1; return q.map((item) => item / length); }
function dot(a, b) { return a.reduce((sum, value, index) => sum + value * Number(b[index] ?? 0), 0); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function anatomyRegionValue(key, signal) {
  if (/shoulder/i.test(key)) return signal.regions.shoulder;
  if (/elbow|wrist/i.test(key)) return signal.regions.arm;
  if (/hip|pelvis/i.test(key)) return signal.regions.thigh;
  if (/knee|ankle/i.test(key)) return signal.regions.calf;
  if (/chest/i.test(key)) return signal.regions.chest;
  return signal.regions.abdomen;
}
function sideAsymmetry(key, bodyDNA) {
  if (bodyDNA.asymmetry.mode !== 'authored') return 1;
  const category = /shoulder/i.test(key) ? 'shoulder' : /elbow|wrist/i.test(key) ? 'arm' : /hip/i.test(key) ? 'hip' : /knee/i.test(key) ? 'leg' : /ankle/i.test(key) ? 'foot' : null;
  if (!category) return 1;
  const leftScale = bodyDNA.asymmetry.leftRightScale[category];
  return /^left/.test(key) ? leftScale : 2 - leftScale;
}
