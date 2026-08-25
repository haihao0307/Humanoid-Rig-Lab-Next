import { assertPoseFrameV4 } from '../../pose/pose-frame-v4.js';
import {
  multiplyQuaternions,
  normalizeQuaternion,
  rotateVectorByQuaternion,
} from '../../animation/quaternion.js';
import { createBodyDNA } from '../body-dna-v5.js';
import { assertHumanRigCoreV5 } from '../human-rig-core-v5.js';
import { adaptHumanRigCoreToExistingRig } from '../v4-adapter.js';
import { REGION_DEFORMATION_SOURCE_JOINTS_V5 } from './region-deformation-driver-v5.js';

export const PROCEDURAL_SIMULATION_RIG_FK_V5_SCHEMA = 'humanoid_rig/procedural_simulation_rig_fk@5.0';

const CRITICAL_ANCHOR_MAP = Object.freeze({
  leftUpperArm: 'leftUpperArm',
  rightUpperArm: 'rightUpperArm',
  leftForearm: 'leftLowerArm',
  rightForearm: 'rightLowerArm',
  leftPalm: 'leftHand',
  rightPalm: 'rightHand',
  leftThigh: 'leftUpperLeg',
  rightThigh: 'rightUpperLeg',
  leftCalf: 'leftLowerLeg',
  rightCalf: 'rightLowerLeg',
  leftFoot: 'leftFoot',
  rightFoot: 'rightFoot',
});

/**
 * Builds an independent forward-kinematics frame from the existing V4
 * RigDefinition adapter. Procedural region anchors are deliberately not used
 * as FK input, so this frame can audit the deform path rather than echo it.
 */
export function createProceduralSimulationRigFrameV5({ finalPose, rigCore, bodyDNA } = {}) {
  assertPoseFrameV4(finalPose);
  assertHumanRigCoreV5(rigCore);
  const dna = createBodyDNA(bodyDNA);
  const adapted = adaptHumanRigCoreToExistingRig(rigCore, { bodyDNA: dna, pose: 'T' });
  const definition = adapted.definition;
  const sourceById = new Map(definition.joints.map((joint) => [joint.id, joint]));
  const bindWorldById = new Map(definition.joints.map((joint) => [joint.id, finiteVector3(joint.poseWorldPosition)]));
  const frameById = new Map();

  function resolve(jointId) {
    if (frameById.has(jointId)) return frameById.get(jointId);
    const source = sourceById.get(jointId);
    if (!source) throw new Error(`SimulationRig FK cannot resolve joint ${jointId}.`);
    const bindWorldPosition = bindWorldById.get(jointId);
    if (jointId === finalPose.rootJointId) {
      const frame = {
        jointId,
        parentId: source.parentId ?? null,
        bindWorldPosition,
        bindLocalPosition: [0, 0, 0],
        worldPosition: finiteVector3(finalPose.rootPosition),
        worldRotation: normalizeQuaternion(finalPose.rootRotation),
      };
      frameById.set(jointId, frame);
      return frame;
    }
    const parentId = source.parentId;
    if (!parentId || !sourceById.has(parentId)) {
      const frame = {
        jointId,
        parentId: parentId ?? null,
        bindWorldPosition,
        bindLocalPosition: bindWorldPosition,
        worldPosition: bindWorldPosition,
        worldRotation: [0, 0, 0, 1],
      };
      frameById.set(jointId, frame);
      return frame;
    }
    const parent = resolve(parentId);
    const parentBind = bindWorldById.get(parentId);
    const bindLocalPosition = subtract(bindWorldPosition, parentBind);
    const worldPosition = add(parent.worldPosition, rotateVectorByQuaternion(bindLocalPosition, parent.worldRotation));
    const localRotation = normalizeQuaternion(finalPose.localRotations[jointId] ?? [0, 0, 0, 1]);
    const worldRotation = multiplyQuaternions(parent.worldRotation, localRotation);
    const frame = { jointId, parentId, bindWorldPosition, bindLocalPosition, worldPosition, worldRotation };
    frameById.set(jointId, frame);
    return frame;
  }

  for (const joint of definition.joints) {
    if (joint.id === 'root' || joint.isControl) continue;
    resolve(joint.id);
  }
  const joints = Object.fromEntries([...frameById]
    .filter(([jointId]) => jointId !== 'root')
    .map(([jointId, frame]) => [jointId, frame]));
  const segments = Object.values(joints)
    .filter((joint) => joint.parentId && joints[joint.parentId])
    .map((joint) => ({ parentId: joint.parentId, jointId: joint.jointId }));
  return {
    schema: PROCEDURAL_SIMULATION_RIG_FK_V5_SCHEMA,
    type: 'ProceduralSimulationRigFrame',
    source: 'finalPose + V4Adapter(T Pose RigDefinition) forward kinematics',
    bindPose: 'T',
    poseAuthority: 'finalPose.localRotations',
    compatibleRig: finalPose.compatibleRig,
    proportionRevision: finalPose.proportionRevision,
    joints,
    segments,
    timestamp: finalPose.timestamp,
  };
}

/**
 * Resolves an anatomical region name (for example leftHip) to the concrete
 * SimulationRig joint that drives it (leftUpperLeg). Direct SimulationRig IDs
 * remain valid and take precedence. The mapping is shared with the Region
 * Deformation Driver so browser QA cannot drift onto a second joint vocabulary.
 */
export function resolveProceduralSimulationRigJointV5(simulationRigFrame, requestedJointId) {
  const joints = simulationRigFrame?.joints ?? {};
  const candidates = [...new Set([
    requestedJointId,
    ...(REGION_DEFORMATION_SOURCE_JOINTS_V5[requestedJointId] ?? []),
  ])];
  const resolvedJointId = candidates.find((jointId) => joints[jointId]) ?? null;
  if (!resolvedJointId) return null;
  return {
    requestedJointId,
    resolvedJointId,
    joint: joints[resolvedJointId],
  };
}

export function compareProceduralRigSurfaceAnchorsV5(simulationRigFrame, regionDiagnostics, {
  maximumErrorMeters = 0.02,
  meanErrorMeters = 0.01,
} = {}) {
  const samples = [];
  for (const [regionId, jointId] of Object.entries(CRITICAL_ANCHOR_MAP)) {
    const jointPosition = simulationRigFrame?.joints?.[jointId]?.worldPosition;
    const regionPosition = regionDiagnostics?.[regionId]?.posedAnchor;
    if (!jointPosition || !regionPosition) continue;
    samples.push({
      regionId,
      jointId,
      jointPosition: [...jointPosition],
      regionPosition: [...regionPosition],
      errorMeters: distance(jointPosition, regionPosition),
    });
  }
  const maximum = Math.max(0, ...samples.map((sample) => sample.errorMeters));
  const mean = samples.length
    ? samples.reduce((sum, sample) => sum + sample.errorMeters, 0) / samples.length
    : Number.POSITIVE_INFINITY;
  return {
    schema: 'humanoid_rig/procedural_rig_surface_anchor_audit@5.0',
    simulationRigSource: simulationRigFrame?.source ?? 'missing',
    proceduralRegionAnchorSource: 'ProceduralDeformFrame.regionDiagnostics',
    sampleCount: samples.length,
    maximumErrorMeters: maximum,
    meanErrorMeters: mean,
    thresholds: { maximumErrorMeters, meanErrorMeters },
    passed: samples.length === Object.keys(CRITICAL_ANCHOR_MAP).length
      && maximum <= maximumErrorMeters
      && mean <= meanErrorMeters,
    samples,
  };
}

function finiteVector3(value) {
  return Array.from({ length: 3 }, (_, index) => Number.isFinite(Number(value?.[index])) ? Number(value[index]) : 0);
}
function add(a, b) { return a.map((value, index) => value + b[index]); }
function subtract(a, b) { return a.map((value, index) => value - b[index]); }
function distance(a, b) { return Math.hypot(...subtract(a, b)); }
