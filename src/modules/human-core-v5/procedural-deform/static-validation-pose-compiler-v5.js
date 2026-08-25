import { quaternionFromAnatomicalChannels } from '../../animation/quaternion.js';
import { createPoseFrameV4 } from '../../pose/pose-frame-v4.js';
import { getHumanRigJointV5 } from '../human-rig-core-v5.js';

export const STATIC_VALIDATION_POSE_COMPILER_V5_SCHEMA = 'humanoid_rig/static_validation_pose_compiler@5.0';
export const STATIC_VALIDATION_POSE_IDS_V5 = Object.freeze(new Set(['squat', 'lunge-left']));

export class StaticValidationPoseCompilerV5 {
  constructor() {
    this.productionWholeBodySolver = false;
    this.validationFixtureOnly = true;
  }

  compile({ poseId, pose, rigCore } = {}) {
    if (!STATIC_VALIDATION_POSE_IDS_V5.has(poseId)) return pose;
    const localRotations = structuredClone(pose.localRotations);
    const ankleBends = poseId === 'squat'
      ? { leftFoot: 30, rightFoot: 30 }
      : { leftFoot: 30, rightFoot: 0 };
    for (const [jointId, degrees] of Object.entries(ankleBends)) {
      const joint = getHumanRigJointV5(rigCore, jointId);
      localRotations[jointId] = quaternionFromAnatomicalChannels(joint.axisReference, {
        bend: degrees * Math.PI / 180,
        twist: 0,
        side: 0,
      });
    }
    const rootPosition = [...pose.rootPosition];
    if (poseId === 'squat') rootPosition[2] -= 0.035;
    return createPoseFrameV4({
      ...pose,
      rootPosition,
      localRotations,
      contacts: ['leftFoot', 'rightFoot'].map((jointId) => ({
        jointId,
        active: true,
        mode: 'plant',
        normal: [0, 1, 0],
        confidence: 1,
        source: 'StaticValidationPoseCompilerV5',
      })),
      constraintState: {
        ...pose.constraintState,
        staticValidation: {
          schema: STATIC_VALIDATION_POSE_COMPILER_V5_SCHEMA,
          poseId,
          productionWholeBodySolver: this.productionWholeBodySolver,
          validationFixtureOnly: this.validationFixtureOnly,
          ankleBendDegrees: ankleBends,
          rootLoweringResolvedFromSurface: false,
        },
      },
    });
  }

  resolveSurfaceContact({ pose, surface, deformFrame, groundY = 0 } = {}) {
    const state = pose?.constraintState?.staticValidation;
    if (!state?.validationFixtureOnly) return pose;
    const before = analyzeStaticValidationSurfaceContactV5({ surface, deformFrame, groundY });
    if (!Number.isFinite(before.lowestSurfaceY)) throw new Error('Static validation contact requires both procedural foot regions.');
    const rootPosition = [...pose.rootPosition];
    const rootLoweringMeters = before.lowestSurfaceY - groundY;
    rootPosition[1] -= rootLoweringMeters;
    const contacts = Object.entries(before.feet).map(([side, foot]) => ({
      jointId: `${side}Foot`,
      active: true,
      mode: 'plant',
      position: [foot.lowestPoint[0], groundY, foot.lowestPoint[2]],
      normal: [0, 1, 0],
      confidence: 1,
      source: 'StaticValidationPoseCompilerV5:surface-contact',
    }));
    return createPoseFrameV4({
      ...pose,
      rootPosition,
      contacts,
      constraintState: {
        ...pose.constraintState,
        staticValidation: {
          ...state,
          rootLoweringResolvedFromSurface: true,
          rootLoweringMeters,
          preResolveContact: before,
        },
      },
    });
  }
}

export function analyzeStaticValidationSurfaceContactV5({ surface, deformFrame, groundY = 0 } = {}) {
  if (!(surface?.regionIds instanceof Uint16Array) || !(surface?.regionBlendWeights instanceof Float32Array)) {
    throw new Error('Static validation contact analysis requires procedural surface region bindings.');
  }
  if (!(deformFrame?.deformedPositions instanceof Float32Array)) {
    throw new Error('Static validation contact analysis requires a ProceduralDeformFrame.');
  }
  const feet = Object.fromEntries(['left', 'right'].map((side) => [side, findFootMinimum({
    side,
    surface,
    positions: deformFrame.deformedPositions,
    groundY,
  })]));
  const values = Object.values(feet);
  const maximumDistanceMeters = Math.max(...values.map((foot) => foot.distanceToGroundMeters));
  const maximumPenetrationMeters = Math.max(...values.map((foot) => foot.penetrationMeters));
  return {
    schema: 'humanoid_rig/static_validation_contact_diagnostics@5.0',
    feet,
    lowestSurfaceY: Math.min(...values.map((foot) => foot.minimumY)),
    maximumDistanceMeters,
    maximumPenetrationMeters,
    thresholds: { maximumDistanceMeters: 0.005, maximumPenetrationMeters: 0.003 },
    passed: maximumDistanceMeters <= 0.005 && maximumPenetrationMeters <= 0.003,
  };
}

function findFootMinimum({ side, surface, positions, groundY }) {
  const regionIndex = surface.regionNames.indexOf(`${side}Foot`);
  if (regionIndex < 0) throw new Error(`Missing ${side}Foot procedural region.`);
  let minimumY = Number.POSITIVE_INFINITY;
  let lowestPoint = null;
  let sampleCount = 0;
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    let regionWeight = 0;
    for (let influence = 0; influence < 4; influence += 1) {
      const offset = vertex * 4 + influence;
      if (surface.regionIds[offset] === regionIndex) regionWeight += surface.regionBlendWeights[offset];
    }
    if (regionWeight <= 0.2) continue;
    sampleCount += 1;
    const positionOffset = vertex * 3;
    const y = positions[positionOffset + 1];
    if (y >= minimumY) continue;
    minimumY = y;
    lowestPoint = [positions[positionOffset], y, positions[positionOffset + 2]];
  }
  if (!lowestPoint) throw new Error(`No bound surface samples found for ${side}Foot.`);
  return {
    jointId: `${side}Foot`,
    sampleCount,
    minimumY,
    lowestPoint,
    distanceToGroundMeters: Math.max(0, minimumY - groundY),
    penetrationMeters: Math.max(0, groundY - minimumY),
  };
}
