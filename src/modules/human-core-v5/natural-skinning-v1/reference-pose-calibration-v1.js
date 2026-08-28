import { add3, distance3, length3, normalize3, scale3, sub3 } from './math-v1.js';

export const HRL_REFERENCE_POSE_CALIBRATION_V1_SCHEMA = 'humanoid_rig/hrl_reference_pose_calibration@1.0';

export const SURFACE_LANDMARK_TO_JOINT_V1 = Object.freeze({
  pelvisCenter: 'hips', spineBase: 'spine', waistCenter: 'chest', chestCenter: 'upperChest', neckBase: 'neck', headCenter: 'head',
  leftClavicleRoot: 'leftShoulder', rightClavicleRoot: 'rightShoulder', leftShoulderCenter: 'leftUpperArm', rightShoulderCenter: 'rightUpperArm',
  leftElbowCenter: 'leftLowerArm', rightElbowCenter: 'rightLowerArm', leftWristCenter: 'leftHand', rightWristCenter: 'rightHand',
  leftHipCenter: 'leftUpperLeg', rightHipCenter: 'rightUpperLeg', leftKneeCenter: 'leftLowerLeg', rightKneeCenter: 'rightLowerLeg',
  leftAnkleCenter: 'leftFoot', rightAnkleCenter: 'rightFoot', leftHeel: 'leftHeelContact', rightHeel: 'rightHeelContact', leftToe: 'leftToes', rightToe: 'rightToes',
  leftPalmCenter: 'leftPalmGrip', rightPalmCenter: 'rightPalmGrip',
});

export class HRLReferencePoseCalibrationV1 {
  constructor({ positions, definition, surfaceTopologyFingerprint }) {
    if (!(positions instanceof Float32Array)) throw new Error('HRLReferencePoseCalibrationV1 requires the unchanged Float32 POSITION array.');
    this.positions = positions; this.definition = definition; this.surfaceTopologyFingerprint = surfaceTopologyFingerprint;
  }

  calibrate() {
    const sourceJoints = this.definition.joints.filter((joint) => !joint.isControl && Array.isArray(joint.poseWorldPosition));
    const sourceById = new Map(sourceJoints.map((joint) => [joint.id, joint]));
    const bounds = positionBounds(this.positions); const lowestRigY = Math.min(...['leftBallContact','rightBallContact','leftHeelContact','rightHeelContact'].map((id) => sourceById.get(id)?.poseWorldPosition?.[1] ?? 0));
    const translation = [0, bounds.min[1] - lowestRigY + 0.0025, (bounds.min[2] + bounds.max[2]) * 0.5 - 0.045];
    const provisional = new Map(sourceJoints.map((joint) => [joint.id, add3(joint.poseWorldPosition, translation)]));
    const landmarks = deriveSurfaceLandmarks(this.positions, provisional);
    const calibratedById = new Map(); const relationships = new Map(sourceJoints.map((joint) => [joint.id, joint.parentId ?? null]));

    const resolve = (jointId) => {
      if (calibratedById.has(jointId)) return calibratedById.get(jointId);
      const joint = sourceById.get(jointId); if (!joint) return null;
      const parent = joint.parentId ? resolve(joint.parentId) : null;
      const landmarkName = Object.keys(SURFACE_LANDMARK_TO_JOINT_V1).find((name) => SURFACE_LANDMARK_TO_JOINT_V1[name] === jointId);
      const target = landmarks[landmarkName]?.position ?? provisional.get(jointId);
      let worldPosition; let boneLength = 0;
      if (!parent || !sourceById.has(joint.parentId) || joint.role === 'marker') worldPosition = target;
      else {
        const sourceParent = sourceById.get(joint.parentId); boneLength = distance3(joint.poseWorldPosition, sourceParent.poseWorldPosition);
        worldPosition = add3(parent.worldPosition, scale3(normalize3(sub3(target, parent.worldPosition), sub3(provisional.get(jointId), provisional.get(joint.parentId))), boneLength));
      }
      const result = { jointId, parentId: joint.parentId ?? null, worldPosition, sourceWorldPosition: [...joint.poseWorldPosition], boneLength, fixedBoneLength: joint.role !== 'marker' };
      calibratedById.set(jointId, result); return result;
    };
    for (const joint of sourceJoints) resolve(joint.id);

    const samples = Object.entries(SURFACE_LANDMARK_TO_JOINT_V1).map(([landmarkId, jointId]) => {
      const landmark = landmarks[landmarkId]; const calibrated = calibratedById.get(jointId); const error = landmark && calibrated ? distance3(landmark.position, calibrated.worldPosition) : Number.POSITIVE_INFINITY;
      return { landmarkId, jointId, surfacePosition: landmark?.position ?? null, calibratedJointPosition: calibrated?.worldPosition ?? null, errorMeters: error, sourceVertexIndices: landmark?.sourceVertexIndices ?? [], derivation: landmark?.derivation ?? 'missing' };
    });
    const finiteErrors = samples.map((sample) => sample.errorMeters).filter(Number.isFinite); const metrics = alignmentMetrics(samples);
    const boneLengthErrors = [];
    for (const joint of calibratedById.values()) {
      if (!joint.fixedBoneLength || !joint.parentId || !calibratedById.has(joint.parentId) || !sourceById.has(joint.parentId)) continue;
      const current = distance3(joint.worldPosition, calibratedById.get(joint.parentId).worldPosition); boneLengthErrors.push(Math.abs(current - joint.boneLength));
    }
    return {
      schema: HRL_REFERENCE_POSE_CALIBRATION_V1_SCHEMA, calibrationId: 'HRLReferencePoseCalibrationV1', referencePose: 'natural-a-pose', sourceRigPose: this.definition.bindPose,
      surfaceTopologyFingerprint: this.surfaceTopologyFingerprint, sourceVertexCount: this.positions.length / 3,
      method: 'surface-neighborhood cross-section centers followed by hierarchy-preserving fixed-length projection; no source vertex movement and no bone scaling',
      surfaceBounds: bounds, initialRigidTranslation: translation, landmarkToJoint: SURFACE_LANDMARK_TO_JOINT_V1,
      landmarks, calibratedJoints: Object.fromEntries([...calibratedById].map(([id, value]) => [id, value])), relationships: Object.fromEntries(relationships), samples,
      maximumJointSurfaceAlignmentError: Math.max(...finiteErrors), meanJointSurfaceAlignmentError: finiteErrors.reduce((sum, value) => sum + value, 0) / finiteErrors.length,
      ...metrics, maximumBoneLengthError: Math.max(0, ...boneLengthErrors), boneScaleApplied: false, sourceSurfacePositionsModified: false,
      passed: Math.max(...finiteErrors) <= 0.025 && finiteErrors.reduce((sum, value) => sum + value, 0) / finiteErrors.length <= 0.012
        && metrics.shoulderAlignmentError <= 0.018 && metrics.hipAlignmentError <= 0.018 && metrics.kneeAlignmentError <= 0.015 && Math.max(0, ...boneLengthErrors) <= 1e-12,
    };
  }
}

function deriveSurfaceLandmarks(positions, provisional) {
  const specifications = {
    pelvisCenter: ['hips', 160, 'center'], spineBase: ['spine', 120, 'center'], waistCenter: ['chest', 96, 'center'], chestCenter: ['upperChest', 72, 'center'], neckBase: ['neck', 80, 'center'], headCenter: ['head', 160, 'center'],
    leftClavicleRoot: ['leftShoulder', 90, 'left'], rightClavicleRoot: ['rightShoulder', 90, 'right'], leftShoulderCenter: ['leftUpperArm', 100, 'left'], rightShoulderCenter: ['rightUpperArm', 100, 'right'],
    leftElbowCenter: ['leftLowerArm', 80, 'left'], rightElbowCenter: ['rightLowerArm', 80, 'right'], leftWristCenter: ['leftHand', 72, 'left'], rightWristCenter: ['rightHand', 72, 'right'],
    leftHipCenter: ['leftUpperLeg', 110, 'left'], rightHipCenter: ['rightUpperLeg', 110, 'right'], leftKneeCenter: ['leftLowerLeg', 88, 'left'], rightKneeCenter: ['rightLowerLeg', 88, 'right'],
    leftAnkleCenter: ['leftFoot', 64, 'left'], rightAnkleCenter: ['rightFoot', 64, 'right'], leftHeel: ['leftHeelContact', 48, 'left'], rightHeel: ['rightHeelContact', 48, 'right'], leftToe: ['leftToes', 56, 'left'], rightToe: ['rightToes', 56, 'right'],
    leftPalmCenter: ['leftPalmGrip', 60, 'left'], rightPalmCenter: ['rightPalmGrip', 60, 'right'],
  };
  return Object.fromEntries(Object.entries(specifications).map(([landmarkId, [jointId, count, side]]) => [landmarkId, neighborhoodCenter(positions, provisional.get(jointId), count, side)]));
}

function neighborhoodCenter(positions, target, count, side) {
  const candidates = [];
  for (let offset = 0; offset < positions.length; offset += 3) {
    const point = [positions[offset], positions[offset + 1], positions[offset + 2]];
    if (side === 'left' && point[0] > 0.015) continue; if (side === 'right' && point[0] < -0.015) continue;
    candidates.push({ index: offset / 3, point, distance: distance3(point, target) });
  }
  candidates.sort((a, b) => a.distance - b.distance || a.index - b.index); const selected = candidates.slice(0, count);
  const minimum = [Infinity, Infinity, Infinity]; const maximum = [-Infinity, -Infinity, -Infinity];
  for (const sample of selected) for (let axis = 0; axis < 3; axis += 1) { minimum[axis] = Math.min(minimum[axis], sample.point[axis]); maximum[axis] = Math.max(maximum[axis], sample.point[axis]); }
  return { position: minimum.map((value, axis) => (value + maximum[axis]) * 0.5), sourceVertexIndices: selected.map((sample) => sample.index), neighborhoodVertexCount: selected.length, derivation: 'axis-aligned center of deterministic nearest surface neighborhood' };
}

function alignmentMetrics(samples) {
  const maximum = (fragments) => Math.max(0, ...samples.filter((sample) => fragments.some((fragment) => sample.landmarkId.toLowerCase().includes(fragment))).map((sample) => sample.errorMeters));
  return { shoulderAlignmentError: maximum(['shoulder','clavicle']), elbowAlignmentError: maximum(['elbow']), wristAlignmentError: maximum(['wrist','palm']), hipAlignmentError: maximum(['hip','pelvis']), kneeAlignmentError: maximum(['knee']), ankleAlignmentError: maximum(['ankle','heel','toe']) };
}

function positionBounds(positions) { const min = [Infinity,Infinity,Infinity]; const max = [-Infinity,-Infinity,-Infinity]; for (let offset=0;offset<positions.length;offset+=3) for(let axis=0;axis<3;axis+=1){min[axis]=Math.min(min[axis],positions[offset+axis]);max[axis]=Math.max(max[axis],positions[offset+axis]);} return { min, max, size: min.map((value,axis)=>max[axis]-value), center: min.map((value,axis)=>(value+max[axis])*0.5) }; }
