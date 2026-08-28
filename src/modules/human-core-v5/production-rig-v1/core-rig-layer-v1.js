import { assertPoseFrameV4 } from '../../pose/pose-frame-v4.js';
import { assertHumanRigCoreV5 } from '../human-rig-core-v5.js';
import { createBodyDNA } from '../body-dna-v5.js';
import { createProceduralSimulationRigFrameV5 } from '../procedural-deform/procedural-simulation-rig-fk-v5.js';
import { assertCoreRigContractV1 } from './core-rig-contract-v1.js';
import { distance3, normalize3, subtract3 } from './rig-quality-metrics-v1.js';

export const CORE_RIG_LAYER_V1_SCHEMA = 'humanoid_rig/core_rig_layer@1.0';

export function createCoreRigLayerV1({ rigCore, finalPose, bodyDNA = {}, contract } = {}) {
  assertHumanRigCoreV5(rigCore);
  assertPoseFrameV4(finalPose);
  const dna = createBodyDNA(bodyDNA);
  assertCoreRigContractV1(contract, { rigCore, bodyDNA: dna });
  const simulationFrame = createProceduralSimulationRigFrameV5({ finalPose, rigCore, bodyDNA: dna });
  const semanticById = new Map(rigCore.joints.map((joint) => [joint.jointId, joint]));
  const jointTransforms = Object.fromEntries(Object.entries(simulationFrame.joints).map(([jointId, frame]) => [jointId, {
    jointId,
    parentId: frame.parentId,
    worldPosition: [...frame.worldPosition],
    worldQuaternion: [...frame.worldRotation],
    bindLocalPosition: [...frame.bindLocalPosition],
    bindWorldPosition: [...frame.bindWorldPosition],
    basis: semanticById.get(jointId)?.axisReference ?? null,
    limits: semanticById.get(jointId)?.limitProfile ?? null,
    authority: 'HumanRigCore+finalPose',
  }]));
  const coreJointIds = new Set(rigCore.coreJointIds);
  const boneSegments = simulationFrame.segments
    .filter(({ jointId }) => coreJointIds.has(jointId))
    .map(({ parentId, jointId }) => {
    const start = jointTransforms[parentId].worldPosition;
    const end = jointTransforms[jointId].worldPosition;
    const length = distance3(start, end);
    return {
      segmentId: `${parentId}->${jointId}`,
      parentJointId: parentId,
      childJointId: jointId,
      start: [...start],
      end: [...end],
      direction: normalize3(subtract3(end, start), [0, 1, 0]),
      length,
      contractLength: Number(contract.boneLengths[jointId]),
      radius: segmentRadius(jointId, length, dna),
      worldTransform: {
        position: start.map((value, index) => (value + end[index]) / 2),
        longAxis: normalize3(subtract3(end, start), [0, 1, 0]),
        scale: [1, 1, 1],
      },
      alignmentError: 0,
      lengthError: Math.abs(length - Number(contract.boneLengths[jointId])),
      diagnosticOnly: true,
    };
    });
  return {
    schema: CORE_RIG_LAYER_V1_SCHEMA,
    type: 'CoreRigLayerV1',
    rigCore,
    finalPose,
    contract,
    simulationFrame,
    jointTransforms,
    boneSegments,
    authority: 'HumanRigCore',
    poseAuthority: 'finalPose',
    writesHumanRigCore: false,
    writesFinalPose: false,
    jointCount: Object.keys(jointTransforms).length,
    segmentCount: boneSegments.length,
  };
}

function segmentRadius(jointId, length, bodyDNA) {
  const heightScale = Number(bodyDNA?.proportion?.height ?? 1.8) / 1.8;
  let radius = 0.022 * heightScale;
  if (/UpperLeg|LowerLeg/.test(jointId)) radius = 0.045 * heightScale;
  else if (/UpperArm|LowerArm/.test(jointId)) radius = 0.032 * heightScale;
  else if (/spine|chest|upperChest|neck|head|Shoulder/.test(jointId)) radius = 0.038 * heightScale;
  else if (/Hand|Foot|Toes/.test(jointId)) radius = 0.018 * heightScale;
  return Math.min(radius, Math.max(0.004, length * 0.22));
}
