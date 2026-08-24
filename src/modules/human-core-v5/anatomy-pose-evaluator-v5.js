import { assertHumanCoreStateV5 } from './human-core-state-v5.js';
import { assertHumanRigCoreV5, cloneHumanRigCoreV5 } from './human-rig-core-v5.js';
import { createMassDistributionModelV5 } from './mass-distribution-model-v5.js';
import { createMuscleSemanticProfileV5 } from './muscle-semantic-profile-v5.js';
import { createHumanBalanceStateV5 } from './human-balance-state-v5.js';
import { createAnatomyDeformationSignalV5 } from './anatomy-deformation-signal-v5.js';
import { createHumanAnatomyStateV5 } from './human-anatomy-state-v5.js';
import { assertPoseFrameV4, clonePoseFrameV4 } from '../pose/pose-frame-v4.js';
import { finiteNumber } from './core-utils.js';

/**
 * Converts BodyDNA plus a V4 local-quaternion pose into semantic anatomy
 * observations. No world-position reconstruction, physics correction, or
 * mesh mutation occurs here.
 */
export class AnatomyPoseEvaluatorV5 {
  evaluate({ humanCoreState, rigCore, poseFrame = null, timestamp = Date.now() } = {}) {
    return evaluateHumanAnatomyPoseV5({ humanCoreState, rigCore, poseFrame, timestamp });
  }
}

export function evaluateHumanAnatomyPoseV5({ humanCoreState, rigCore, poseFrame = null, timestamp = Date.now() } = {}) {
  assertHumanCoreStateV5(humanCoreState);
  const core = cloneHumanRigCoreV5(rigCore);
  assertHumanRigCoreV5(core);
  if (core.rigId !== humanCoreState.rigState.rigId) {
    throw new Error(`HumanAnatomy evaluator rig ${core.rigId} does not match HumanCoreState rig ${humanCoreState.rigState.rigId}.`);
  }
  const pose = poseFrame ?? humanCoreState.poseState.currentPose;
  if (pose) {
    assertPoseFrameV4(pose);
    if (pose.compatibleRig !== humanCoreState.rigState.compatibleRig) {
      throw new Error(`PoseFrame rig ${pose.compatibleRig} does not match HumanCoreState rig ${humanCoreState.rigState.compatibleRig}.`);
    }
    if (pose.proportionRevision !== humanCoreState.bodyDNA.proportionRevision) {
      throw new Error(`PoseFrame proportion r${pose.proportionRevision} does not match BodyDNA r${humanCoreState.bodyDNA.proportionRevision}.`);
    }
  }

  const massDistribution = createMassDistributionModelV5(humanCoreState.bodyDNA);
  const muscleProfile = createMuscleSemanticProfileV5(core);
  const postureState = derivePostureState(pose, core);
  const muscleState = deriveMuscleState(muscleProfile, core, pose, humanCoreState.bodyDNA);
  const jointLoad = deriveJointLoad(core, muscleState, postureState);
  const balanceState = createHumanBalanceStateV5({
    massDistribution,
    rigCore: core,
    poseFrame: pose,
    posture: postureState,
  });
  const bodyVolumeState = deriveBodyVolumeState(humanCoreState.bodyDNA, muscleState, postureState);
  const deformationSignal = deriveDeformationSignal(humanCoreState.bodyDNA, muscleState, bodyVolumeState, postureState);
  return createHumanAnatomyStateV5({
    bodyDNA: humanCoreState.bodyDNA,
    rigCore: core,
    poseFrame: pose ? clonePoseFrameV4(pose) : null,
    massDistribution,
    muscleProfile,
    muscleState,
    jointLoad,
    balanceState,
    bodyVolumeState,
    postureState,
    deformationSignal,
    timestamp,
  });
}

function deriveMuscleState(profile, rigCore, pose, bodyDNA) {
  const semanticById = new Map(rigCore.joints.map((joint) => [joint.jointId, joint]));
  return {
    mode: 'semantic-activation-only',
    profileSchema: profile.schema,
    activations: profile.groups.map((group) => {
      const rotationalDemand = average(group.affectedJoints.map((jointId) => jointDemand(pose, semanticById.get(jointId))));
      const fitnessBias = group.muscleGroup.includes('arm') || group.muscleGroup.includes('shoulder')
        ? bodyDNA.fitnessProfile.muscle * bodyDNA.fitnessProfile.distribution.upperBody
        : group.muscleGroup.includes('hip') || group.muscleGroup.includes('knee')
          ? bodyDNA.fitnessProfile.muscle * bodyDNA.fitnessProfile.distribution.lowerBody
          : bodyDNA.fitnessProfile.muscle;
      const activation = pose ? clamp(rotationalDemand * 0.84 + fitnessBias * 0.12, 0, 1) : 0;
      return {
        groupId: group.groupId,
        muscleGroup: group.muscleGroup,
        side: group.side,
        affectedJoints: [...group.affectedJoints],
        activation,
        source: pose ? 'pose-frame-v4-local-quaternion' : 'neutral-no-pose',
      };
    }),
  };
}

function deriveJointLoad(rigCore, muscleState, postureState) {
  const activations = muscleState.activations;
  return {
    unit: 'relative-load',
    source: 'body-dna-mass-plus-local-quaternion-demand',
    entries: rigCore.joints
      .filter((joint) => joint.core)
      .map((joint) => {
        const affectedActivation = average(activations
          .filter((group) => group.affectedJoints.includes(joint.jointId))
          .map((group) => group.activation));
        const massInfluence = finiteNumber(joint.massInfluence?.self, 0, 0, 1)
          + finiteNumber(joint.massInfluence?.downstream, 0, 0, 1) * 0.45;
        return {
          jointId: joint.jointId,
          load: clamp(massInfluence * 0.58 + affectedActivation * 0.34 + postureState.lean.magnitude * 0.12, 0, 1),
          activationContribution: affectedActivation,
          massInfluence: clamp(massInfluence, 0, 1),
        };
      }),
  };
}

function derivePostureState(pose, rigCore) {
  if (!pose) {
    return {
      mode: 'local-quaternion-semantic-posture',
      source: 'neutral-body-dna',
      usesWorldPositions: false,
      stance: 'neutral-unobserved',
      lean: { forward: 0, lateral: 0, magnitude: 0, source: 'neutral-no-pose' },
      symmetry: 1,
      confidence: 0.35,
    };
  }
  const semanticById = new Map(rigCore.joints.map((joint) => [joint.jointId, joint]));
  const forward = clamp(average([
    signedAxisDemand(pose, semanticById.get('hips'), 'bendAxisLocal'),
    signedAxisDemand(pose, semanticById.get('spine'), 'bendAxisLocal'),
    signedAxisDemand(pose, semanticById.get('chest'), 'bendAxisLocal'),
    signedAxisDemand(pose, semanticById.get('upperChest'), 'bendAxisLocal'),
  ]) / 1.05, -1, 1);
  const lateral = clamp(average([
    signedAxisDemand(pose, semanticById.get('hips'), 'sideAxisLocal'),
    signedAxisDemand(pose, semanticById.get('spine'), 'sideAxisLocal'),
    signedAxisDemand(pose, semanticById.get('chest'), 'sideAxisLocal'),
  ]) / 1.05, -1, 1);
  const magnitude = Math.min(1, Math.hypot(forward, lateral));
  const supportFeet = new Set((pose.contacts ?? [])
    .filter((contact) => contact?.active !== false && /(?:left|right)(?:Foot|HeelContact|BallContact)$/.test(contact.jointId))
    .map((contact) => contact.jointId.startsWith('left') ? 'left' : 'right'));
  return {
    mode: 'local-quaternion-semantic-posture',
    source: 'pose-frame-v4',
    usesWorldPositions: false,
    stance: supportFeet.size >= 2 ? 'double-support-observed' : supportFeet.size === 1 ? 'single-support-observed' : 'support-unobserved',
    lean: { forward, lateral, magnitude, source: 'joint-local-axis-projection' },
    symmetry: deriveSymmetry(pose),
    confidence: pose.contacts?.length ? 0.82 : 0.66,
  };
}

function deriveBodyVolumeState(bodyDNA, muscleState, postureState) {
  const upperActivation = average(muscleState.activations
    .filter((group) => /shoulder|arm|trunk/.test(group.muscleGroup))
    .map((group) => group.activation));
  const lowerActivation = average(muscleState.activations
    .filter((group) => /hip|knee/.test(group.muscleGroup))
    .map((group) => group.activation));
  const upperFitness = bodyDNA.fitnessProfile.muscle * bodyDNA.fitnessProfile.distribution.upperBody;
  const lowerFitness = bodyDNA.fitnessProfile.muscle * bodyDNA.fitnessProfile.distribution.lowerBody;
  return {
    mode: 'semantic-volume-only',
    writesMesh: false,
    regions: {
      shoulder: clamp((bodyDNA.proportion.shoulderWidth / bodyDNA.proportion.height) * 2.5 + upperActivation * 0.16, 0, 1),
      chest: clamp(bodyDNA.proportion.bodyThickness.chest * 2.75 + upperFitness * 0.18 + Math.abs(postureState.lean.forward) * 0.05, 0, 1),
      abdomen: clamp(bodyDNA.proportion.bodyThickness.waist * 2.75 + bodyDNA.fitnessProfile.fat * 0.14 + Math.abs(postureState.lean.forward) * 0.12, 0, 1),
      hip: clamp(bodyDNA.proportion.bodyThickness.hip * 2.75 + lowerActivation * 0.08, 0, 1),
      arm: clamp(upperFitness * 0.62 + upperActivation * 0.38, 0, 1),
      leg: clamp(lowerFitness * 0.62 + lowerActivation * 0.38, 0, 1),
    },
    source: 'body-dna-plus-semantic-pose-evaluator',
  };
}

function deriveDeformationSignal(bodyDNA, muscleState, volume, posture) {
  const group = (id) => muscleState.activations.find((item) => item.groupId === id)?.activation ?? 0;
  const shoulder = average([group('shoulder-complex-left'), group('shoulder-complex-right')]);
  const arms = average([group('arm-chain-left'), group('arm-chain-right')]);
  const knees = average([group('knee-chain-left'), group('knee-chain-right')]);
  const hips = average([group('hip-complex-left'), group('hip-complex-right')]);
  return createAnatomyDeformationSignalV5({
    humanId: bodyDNA.identity.humanId,
    bodyDNAId: bodyDNA.bodyDNAId,
    proportionRevision: bodyDNA.proportionRevision,
    shoulderElevation: shoulder,
    chestExpansion: clamp(volume.regions.chest * 0.48 + Math.max(0, -posture.lean.forward) * 0.22, 0, 1),
    abdominalCompression: clamp(Math.abs(posture.lean.forward) * 0.68 + hips * 0.18, 0, 1),
    elbowCompression: arms,
    thighCompression: clamp(knees * 0.72 + hips * 0.28, 0, 1),
    armVolume: volume.regions.arm,
    legVolume: volume.regions.leg,
    regions: {
      shoulder,
      chest: volume.regions.chest,
      abdomen: volume.regions.abdomen,
      arm: volume.regions.arm,
      thigh: clamp(knees * 0.72 + hips * 0.28, 0, 1),
      calf: knees,
    },
    sourcePoseAuthority: 'local-quaternion-v4',
  });
}

function jointDemand(pose, joint) {
  if (!pose || !joint) return 0;
  const quaternion = jointQuaternion(pose, joint.jointId);
  return clamp(quaternionAngle(quaternion) / 1.45, 0, 1);
}

function signedAxisDemand(pose, joint, axisKey) {
  if (!pose || !joint) return 0;
  const quaternion = jointQuaternion(pose, joint.jointId);
  const axis = joint.axisReference?.[axisKey] ?? [1, 0, 0];
  const vectorLength = Math.hypot(quaternion[0], quaternion[1], quaternion[2]);
  if (vectorLength < 1e-8) return 0;
  const direction = quaternion.slice(0, 3).map((value) => value / vectorLength);
  const sign = direction[0] * axis[0] + direction[1] * axis[1] + direction[2] * axis[2];
  return clamp((quaternionAngle(quaternion) * sign) / Math.PI, -1, 1);
}

function jointQuaternion(pose, jointId) {
  if (jointId === pose.rootJointId) return pose.rootRotation;
  return pose.localRotations?.[jointId] ?? [0, 0, 0, 1];
}

function quaternionAngle(quaternion) {
  const w = Math.min(1, Math.max(-1, Number(quaternion?.[3]) || 1));
  return 2 * Math.acos(w);
}

function deriveSymmetry(pose) {
  const pairs = [
    ['leftUpperArm', 'rightUpperArm'], ['leftLowerArm', 'rightLowerArm'],
    ['leftUpperLeg', 'rightUpperLeg'], ['leftLowerLeg', 'rightLowerLeg'], ['leftFoot', 'rightFoot'],
  ];
  const differences = pairs.map(([left, right]) => Math.abs(quaternionAngle(jointQuaternion(pose, left)) - quaternionAngle(jointQuaternion(pose, right))));
  return clamp(1 - average(differences) / Math.PI, 0, 1);
}

function average(values) {
  const finiteValues = values.filter((value) => Number.isFinite(Number(value)));
  if (!finiteValues.length) return 0;
  return finiteValues.reduce((sum, value) => sum + Number(value), 0) / finiteValues.length;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, finiteNumber(value, 0, minimum, maximum)));
}
