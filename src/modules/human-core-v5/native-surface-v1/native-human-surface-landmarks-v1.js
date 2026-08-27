import { createBodyDNA } from '../body-dna-v5.js';
import { assertHumanRigCoreV5 } from '../human-rig-core-v5.js';
import { adaptHumanRigCoreToExistingRig } from '../v4-adapter.js';
import {
  assertNativeHumanSurfaceTopologyV1,
  createNativeHumanSurfaceTopologyV1,
} from './native-human-surface-topology-v1.js';

export const NATIVE_HUMAN_SURFACE_LANDMARKS_V1_SCHEMA = 'humanoid_rig/native_human_surface_landmarks@1.0';

export const NATIVE_HUMAN_SURFACE_LANDMARK_MAP_V1 = deepFreeze([
  outer('headTop', 'head', [0, 1.795672, 1], 'Superior skin outline; defines stature maximum.'),
  outer('chin', 'head', [0, 1.610, 1], 'Anterior-inferior simplified chin skin outline.'),
  center('neckBase', 'neck', 'Neck anatomical center from HumanRigCore T pose.'),
  center('leftClavicle', 'leftShoulder', 'Left clavicle center; not a skin point.'),
  center('rightClavicle', 'rightShoulder', 'Right clavicle center; not a skin point.'),
  center('leftShoulderCenter', 'leftUpperArm', 'Left glenohumeral center; not a skin point.'),
  center('rightShoulderCenter', 'rightUpperArm', 'Right glenohumeral center; not a skin point.'),
  center('leftElbowCenter', 'leftLowerArm', 'Left elbow center; not a skin point.'),
  center('rightElbowCenter', 'rightLowerArm', 'Right elbow center; not a skin point.'),
  center('leftWristCenter', 'leftHand', 'Left wrist center; not a skin point.'),
  center('rightWristCenter', 'rightHand', 'Right wrist center; not a skin point.'),
  center('sternum', 'upperChest', 'Thoracic center reference used as the sternum anchor in V1.'),
  center('waistCenter', 'spine', 'Waist anatomical center; not a skin point.'),
  center('pelvisCenter', 'hips', 'Pelvis anatomical center; not a skin point.'),
  center('leftHipCenter', 'leftUpperLeg', 'Left hip center; not a skin point.'),
  center('rightHipCenter', 'rightUpperLeg', 'Right hip center; not a skin point.'),
  center('leftKneeCenter', 'leftLowerLeg', 'Left knee center; not a skin point.'),
  center('rightKneeCenter', 'rightLowerLeg', 'Right knee center; not a skin point.'),
  center('leftAnkleCenter', 'leftFoot', 'Left ankle center; not a skin point.'),
  center('rightAnkleCenter', 'rightFoot', 'Right ankle center; not a skin point.'),
  outer('leftHeel', 'foot', [-0.095, 0.020, -1], 'Left posterior heel skin outline.'),
  outer('rightHeel', 'foot', [0.095, 0.020, -1], 'Right posterior heel skin outline.'),
  outer('leftToe', 'foot', [-0.095, 0.045, 1], 'Left anterior toe skin outline.'),
  outer('rightToe', 'foot', [0.095, 0.045, 1], 'Right anterior toe skin outline.'),
]);

export class NativeHumanSurfaceLandmarksV1 {
  constructor({ topology = createNativeHumanSurfaceTopologyV1() } = {}) {
    assertNativeHumanSurfaceTopologyV1(topology);
    this.topology = structuredClone(topology);
  }

  evaluate({ evaluation, bodyDNA, rigCore }) {
    const dna = createBodyDNA(bodyDNA);
    assertHumanRigCoreV5(rigCore);
    assertEvaluation(evaluation, this.topology);
    const adapted = adaptHumanRigCoreToExistingRig(rigCore, { bodyDNA: dna, pose: 'T' });
    const joints = new Map(adapted.definition.joints.map((joint) => [joint.id, joint.poseWorldPosition]));
    const landmarks = NATIVE_HUMAN_SURFACE_LANDMARK_MAP_V1.map((definition) => {
      if (definition.landmarkType === 'anatomical-center') {
        const point = requireJoint(joints, definition.rigJointId);
        return { ...definition, point: [...point], rigTarget: [...point], error: 0, vertexWeights: [] };
      }
      const vertexWeights = nearestSurfaceVertices(this.topology, definition.controlCoordinate, 4);
      const point = weightedPoint(evaluation.positions, vertexWeights);
      return { ...definition, point, rigTarget: null, error: null, vertexWeights };
    });
    return {
      schema: NATIVE_HUMAN_SURFACE_LANDMARKS_V1_SCHEMA,
      schemaVersion: 1,
      type: 'NativeHumanSurfaceLandmarkEvaluationV1',
      bodyDNAId: dna.bodyDNAId,
      rigId: rigCore.rigId,
      topologyFingerprint: this.topology.topologyFingerprint,
      definitionsDistinguishSkinAndCenters: true,
      landmarks,
    };
  }
}

export function evaluateNativeHumanSurfaceLandmarksV1(options) {
  return new NativeHumanSurfaceLandmarksV1({ topology: options?.topology }).evaluate(options);
}

function nearestSurfaceVertices(topology, coordinate, count) {
  const [u, v, shellCoordinate] = coordinate;
  const candidates = topology.vertices
    .map((vertex) => {
      const [x, y, shell] = vertex.controlCoordinate;
      const distance = Math.hypot(x - u, y - v, (shell - shellCoordinate) * 0.08);
      return { vertexId: vertex.vertexId, distance };
    })
    .sort((left, right) => left.distance - right.distance)
    .slice(0, count);
  const rawWeights = candidates.map((candidate) => 1 / Math.max(1e-6, candidate.distance));
  const total = rawWeights.reduce((sum, value) => sum + value, 0);
  return candidates.map((candidate, index) => ({ vertexId: candidate.vertexId, weight: rawWeights[index] / total }));
}

function weightedPoint(positions, weights) {
  const point = [0, 0, 0];
  for (const { vertexId, weight } of weights) {
    const offset = vertexId * 3;
    point[0] += positions[offset] * weight;
    point[1] += positions[offset + 1] * weight;
    point[2] += positions[offset + 2] * weight;
  }
  return point;
}

function requireJoint(joints, jointId) {
  const point = joints.get(jointId);
  if (!Array.isArray(point) || point.length !== 3) throw new Error(`Native landmark requires T-pose joint ${jointId}.`);
  return point;
}

function assertEvaluation(evaluation, topology) {
  if (evaluation?.topologyFingerprint !== topology.topologyFingerprint) throw new Error('Native landmark topology mismatch.');
  if (!evaluation.positions || evaluation.positions.length !== topology.vertexCount * 3) throw new Error('Native landmark evaluation has no positions.');
}

function center(landmarkId, rigJointId, definition) {
  return { landmarkId, landmarkType: 'anatomical-center', rigJointId, regionId: regionForJoint(rigJointId), definition };
}

function outer(landmarkId, regionId, controlCoordinate, definition) {
  return { landmarkId, landmarkType: 'skin-outline', rigJointId: null, regionId, controlCoordinate, definition };
}

function regionForJoint(jointId) {
  if (/Shoulder|UpperArm/.test(jointId)) return 'shoulder-junction';
  if (/LowerArm/.test(jointId)) return 'elbow-junction';
  if (/Hand/.test(jointId)) return 'hand';
  if (/UpperLeg/.test(jointId)) return 'hip-junction';
  if (/LowerLeg/.test(jointId)) return 'knee-junction';
  if (/Foot/.test(jointId)) return 'ankle';
  if (jointId === 'neck') return 'neck';
  if (jointId === 'hips') return 'pelvis';
  if (jointId === 'spine') return 'lower-torso';
  return 'upper-torso';
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
