import { createHash } from 'node:crypto';
import {
  FEMUR_LOD_SPECS_V1,
  LONG_BONE_GENERATOR_V1_ID,
  generateFemurV1,
  getFemurLandmarksV1,
} from '../../src/core/human-core-v5/longBoneGeneratorV1.js';

export const POLICY_ID = 'human_system/procedural_originality_policy@1.0.0';
export const GENERATOR_VERSION = 'anatomical-skeleton-s1@1.1.0';
export const COORDINATE_SYSTEM = Object.freeze({ handedness: 'right-handed', upAxis: '+Y', forwardAxis: '+Z', rightAxis: '+X', unit: 'meter' });
export const VARIANT_SPECS = Object.freeze([
  Object.freeze({ variantId: 'baseline', revision: 1, fileName: 'baseline-skeleton-s1.hrlbone', label: 'Baseline' }),
  Object.freeze({ variantId: 'long_femur_plus_08_percent', revision: 2, fileName: 'long-femur-plus-08.hrlbone', label: 'Femur length +0.8%' }),
  Object.freeze({ variantId: 'anteversion_plus_10_degrees', revision: 3, fileName: 'anteversion-plus-10.hrlbone', label: 'Anteversion +10 degrees' }),
  Object.freeze({ variantId: 'left_right_asymmetry_02', revision: 4, fileName: 'asymmetry-02.hrlbone', label: 'Left/right asymmetry 0.2%' }),
]);

const SOURCE_IDS = Object.freeze({
  internalBodyDna: 'hrl-bodydna-v5-2026',
  openStax: 'openstax-long-bone-2022',
  proximal: 'verma-proximal-femur-2017',
  curvature: 'thiesen-femoral-antecurvation-2018',
  distal: 'hussain-distal-femur-2013',
  angles: 'meier-hip-morphology-2022',
  pendingDetail: 'hrl-femur-pilot-detail-pending',
});

const CORE_JOINT_TO_HUMAN_RIG = Object.freeze({
  pelvis: 'hips', spine_low: 'spine', spine_mid: 'chest', spine_high: 'upperChest', chest: 'upperChest', neck: 'neck', head: 'head',
  left_clavicle: 'leftShoulder', right_clavicle: 'rightShoulder', left_shoulder: 'leftUpperArm', right_shoulder: 'rightUpperArm',
  left_elbow: 'leftLowerArm', right_elbow: 'rightLowerArm', left_wrist: 'leftHand', right_wrist: 'rightHand', left_hand: 'leftHand', right_hand: 'rightHand',
  left_hip: 'leftUpperLeg', right_hip: 'rightUpperLeg', left_knee: 'leftLowerLeg', right_knee: 'rightLowerLeg',
  left_ankle: 'leftFoot', right_ankle: 'rightFoot', left_foot: 'leftFoot', right_foot: 'rightFoot',
});

const SEMANTIC_GROUPS = Object.freeze([
  Object.freeze({ semanticGroupId: 1, semanticId: 'core_skeleton_lines' }),
  Object.freeze({ semanticGroupId: 2, semanticId: 'joint_centers' }),
  Object.freeze({ semanticGroupId: 10, semanticId: 'left_femur' }),
  Object.freeze({ semanticGroupId: 11, semanticId: 'right_femur' }),
]);

export function createVariantPackage(variantId = 'baseline') {
  const spec = VARIANT_SPECS.find((candidate) => candidate.variantId === variantId);
  if (!spec) throw new Error(`Unknown anatomical skeleton variant ${variantId}.`);
  const skeletalDNA = createSkeletalDNA(spec);
  const graph = createAnatomicalGraph(skeletalDNA);
  const profile = compileAnatomicalProfile(skeletalDNA, graph);
  const mapping = createHumanRigCoreMapping(profile);
  const geometry = createCompiledGeometry(skeletalDNA, graph);
  return { spec, skeletalDNA, graph, profile, mapping, geometry };
}

export function createSkeletalDNA(spec = VARIANT_SPECS[0]) {
  const values = {
    bodyHeight: 1.78, shoulderWidth: 0.44, pelvisWidth: 0.21, spineLength: 0.51,
    upperArmLength: 0.29, forearmLength: 0.25, thighLength: 0.43,
    calfLength: 0.41, handLength: 0.18, footLength: 0.255,
  };
  if (spec.variantId === 'long_femur_plus_08_percent') values.thighLength = f32(values.thighLength * 1.008);
  const jointSpecs = createJointSpecs(values);
  const segmentSpecs = createSegmentSpecs(jointSpecs);
  const boneParameters = segmentSpecs.map((segment) => segment.boneId.endsWith('_femur')
    ? createFemurBoneParameter(segment, spec)
    : createLineBoneParameter(segment));
  return {
    schema: 'humanoid_rig/skeletal_dna@1.0', schemaVersion: 1, type: 'SkeletalDNA',
    profileId: `anatomical-skeleton-s1-${spec.variantId.replaceAll('_', '-')}`, revision: spec.revision,
    seed: 7312026, precision: 'float32-deterministic', coordinateSystem: COORDINATE_SYSTEM,
    ...values,
    leftRightAsymmetry: spec.variantId === 'left_right_asymmetry_02' ? 0.002 : 0,
    globalDetailLevel: 2, variantId: spec.variantId, generatorVersion: GENERATOR_VERSION,
    boneParameters,
    sourceReceiptIds: Object.values(SOURCE_IDS),
  };
}

export function createAnatomicalGraph(skeletalDNA) {
  const joints = createJointSpecs(skeletalDNA);
  const jointById = new Map(joints.map((joint) => [joint.jointId, joint]));
  const segments = createSegmentSpecs(joints);
  const boneByDistal = new Map(segments.map((bone) => [bone.distalJointId, bone.boneId]));
  const bones = segments.map((segment) => {
    const parentJoint = jointById.get(segment.proximalJointId);
    const parentBoneId = segment.proximalJointId === 'pelvis' ? (segment.boneId === 'pelvis' ? null : 'pelvis') : boneByDistal.get(segment.proximalJointId) ?? null;
    const childBoneIds = segments.filter((candidate) => candidate.proximalJointId === segment.distalJointId && candidate.boneId !== segment.boneId).map((candidate) => candidate.boneId);
    return {
      boneId: segment.boneId,
      jointId: segment.distalJointId,
      parentBoneId,
      childBoneIds,
      symmetryPairId: mirrorId(segment.boneId),
      proximalJointId: segment.proximalJointId,
      distalJointId: segment.distalJointId,
      landmarkIds: segment.boneId.endsWith('_femur') ? femurLandmarkIds(sideOf(segment.boneId)) : [],
      muscleAttachmentAnchorIds: [],
      generatorDependencies: segment.boneId.endsWith('_femur') ? ['LongBoneGeneratorV1', 'skeletal_dna', segment.proximalJointId, segment.distalJointId] : ['SkeletonLineGeneratorV1', 'skeletal_dna'],
      humanRigCoreJointId: CORE_JOINT_TO_HUMAN_RIG[segment.distalJointId] ?? CORE_JOINT_TO_HUMAN_RIG[parentJoint?.jointId] ?? null,
      invalidatedBy: segment.boneId.endsWith('_femur')
        ? ['thighLength', 'leftRightAsymmetry', 'boneParameters.left_femur', 'boneParameters.right_femur']
        : dimensionDependencies(segment.boneId),
    };
  });
  const children = new Map(joints.map((joint) => [joint.jointId, []]));
  for (const joint of joints) if (joint.parentJointId) children.get(joint.parentJointId).push(joint.jointId);
  return {
    schema: 'humanoid_rig/anatomical_graph@1.0', schemaVersion: 1, type: 'AnatomicalGraph',
    graphId: 'anatomical-graph-s1', revision: skeletalDNA.revision, rootJointId: 'pelvis', coordinateSystem: COORDINATE_SYSTEM,
    bones,
    joints: joints.map((joint) => ({
      ...joint,
      childJointIds: children.get(joint.jointId),
      jointBasis: identityBasis(),
      symmetryPairId: mirrorId(joint.jointId),
      humanRigCoreJointId: CORE_JOINT_TO_HUMAN_RIG[joint.jointId] ?? null,
    })),
  };
}

export function compileAnatomicalProfile(skeletalDNA, graph) {
  const jointById = new Map(graph.joints.map((joint) => [joint.jointId, joint]));
  const boneByDistal = new Map(graph.bones.map((bone) => [bone.distalJointId, bone]));
  const parameterByBone = new Map(skeletalDNA.boneParameters.map((bone) => [bone.boneId, bone]));
  const joints = graph.joints.map((joint) => {
    const parent = joint.parentJointId ? jointById.get(joint.parentJointId) : null;
    const bone = boneByDistal.get(joint.jointId) ?? graph.bones.find((candidate) => candidate.boneId === 'pelvis');
    const boneParameter = parameterByBone.get(bone.boneId);
    const bindLocalPosition = parent ? subtract(joint.jointCenter, parent.jointCenter) : [...joint.jointCenter];
    const length = parent ? distance(joint.jointCenter, parent.jointCenter) : boneParameter.length;
    const mappingStatus = mappingStatusFor(joint.jointId);
    return {
      boneId: bone.boneId, jointId: joint.jointId, parentJointId: joint.parentJointId,
      bindLocalPosition: bindLocalPosition.map(f32), bindLocalRotation: [0, 0, 0, 1], boneLength: f32(length),
      jointCenter: joint.jointCenter.map(f32), jointBasis: identityBasis(), degreesOfFreedom: degreesOfFreedomFor(joint.jointId),
      softLimits: jointLimits(joint.jointId, false), hardLimits: jointLimits(joint.jointId, true),
      segmentMass: f32(segmentMassFor(joint.jointId)), localCenterOfMass: parent ? bindLocalPosition.map((value) => f32(value * 0.5)) : [0, 0, 0],
      symmetryPairId: mirrorId(joint.jointId), footContactFrame: joint.jointId.endsWith('_foot') ? { position: [0, -0.04, 0.08], rotation: [0, 0, 0, 1] } : null,
      handGripFrame: joint.jointId.endsWith('_hand') ? { position: [0, 0, 0.08], rotation: [0, 0, 0, 1] } : null,
      humanRigCoreJointId: CORE_JOINT_TO_HUMAN_RIG[joint.jointId] ?? null, mappingStatus,
    };
  });
  const bindPoseHash = sha256Stable(joints.map(({ jointId, parentJointId, bindLocalPosition, bindLocalRotation, boneLength }) => ({ jointId, parentJointId, bindLocalPosition, bindLocalRotation, boneLength })));
  const jointBasisHash = sha256Stable(joints.map(({ jointId, jointBasis }) => ({ jointId, jointBasis })));
  const landmarkSetHash = sha256Stable(graph.bones.flatMap(({ boneId, landmarkIds }) => landmarkIds.map((landmarkId) => ({ boneId, landmarkId }))));
  const base = {
    schema: 'humanoid_rig/anatomical_profile@1.0', schemaVersion: 1, type: 'CompiledAnatomicalProfile',
    profileId: `compiled-${skeletalDNA.profileId}`, revision: skeletalDNA.revision, sourceSkeletalDnaId: skeletalDNA.profileId,
    coordinateSystem: COORDINATE_SYSTEM, rootJointId: graph.rootJointId, joints,
    bindPoseHash, jointBasisHash, landmarkSetHash,
    humanRigCoreMappingStatus: joints.some(({ mappingStatus }) => mappingStatus !== 'exact') ? 'mapped-read-only-with-differences' : 'complete-read-only',
    authorityBoundary: { writesHumanRigCore: false, writesFinalPose: false, finalPoseAccess: 'read-only' },
  };
  return { ...base, anatomyProfileHash: sha256Stable(base) };
}

export function createHumanRigCoreMapping(profile) {
  const records = profile.joints.map((joint) => ({
    anatomicalJointId: joint.jointId,
    humanRigCoreJointId: joint.humanRigCoreJointId,
    status: joint.mappingStatus,
    difference: joint.mappingStatus === 'exact' ? null : mappingDifference(joint.jointId),
  }));
  return {
    schema: 'humanoid_rig/anatomical_human_rig_core_mapping@1.0', type: 'HumanRigCoreMappingReport',
    sourceAnatomicalProfileId: profile.profileId, sourceAnatomicalProfileHash: profile.anatomyProfileHash,
    targetSchema: 'humanoid_rig/human_rig_core@5.0', targetAccess: 'read-only', writesHumanRigCore: false, writesFinalPose: false,
    status: profile.humanRigCoreMappingStatus, exactCount: records.filter(({ status }) => status === 'exact').length,
    derivedCount: records.filter(({ status }) => status === 'derived').length, unmappedCount: records.filter(({ status }) => status === 'unmapped').length,
    records,
  };
}

export function createCompiledGeometry(skeletalDNA, graph) {
  const positions = [];
  const normals = [];
  const indices = [];
  const semanticGroupIds = [];
  const primitiveGroups = [];
  const jointById = new Map(graph.joints.map((joint) => [joint.jointId, joint]));

  const lineIndexOffset = indices.length;
  for (const bone of graph.bones.filter(({ boneId }) => boneId !== 'pelvis')) {
    const semantic = bone.boneId === 'left_femur' ? 10 : bone.boneId === 'right_femur' ? 11 : 1;
    const start = positions.length / 3;
    positions.push(...jointById.get(bone.proximalJointId).jointCenter, ...jointById.get(bone.distalJointId).jointCenter);
    normals.push(0, 0, 0, 0, 0, 0);
    semanticGroupIds.push(semantic, semantic);
    indices.push(start, start + 1);
  }
  primitiveGroups.push({ groupId: 'core-skeleton-lines', primitive: 'LINES', indexOffset: lineIndexOffset, indexCount: indices.length - lineIndexOffset, semanticGroupId: 1, lod: null, side: 'center', boneId: null });

  const pointIndexOffset = indices.length;
  for (const joint of graph.joints) {
    const vertex = positions.length / 3;
    positions.push(...joint.jointCenter);
    normals.push(0, 1, 0);
    semanticGroupIds.push(2);
    indices.push(vertex);
  }
  primitiveGroups.push({ groupId: 'joint-centers', primitive: 'POINTS', indexOffset: pointIndexOffset, indexCount: indices.length - pointIndexOffset, semanticGroupId: 2, lod: null, side: 'center', boneId: null });

  const femurParameters = new Map(skeletalDNA.boneParameters.filter(({ boneId }) => boneId.endsWith('_femur')).map((record) => [record.boneId, record.generatorParameters]));
  const meshes = [];
  for (const side of ['left', 'right']) {
    const hip = jointById.get(`${side}_hip`).jointCenter;
    for (const lod of [0, 1, 2]) {
      const mesh = generateFemurV1(femurParameters.get(`${side}_femur`), { side, lod, hipJointCenter: hip });
      const vertexOffset = positions.length / 3;
      const indexOffset = indices.length;
      positions.push(...mesh.positions);
      normals.push(...mesh.normals);
      semanticGroupIds.push(...Array(mesh.vertexCount).fill(side === 'left' ? 10 : 11));
      indices.push(...mesh.indices, ...[]);
      for (let index = indexOffset; index < indices.length; index += 1) indices[index] += vertexOffset;
      primitiveGroups.push({
        groupId: `${side}-femur-lod${lod}`, primitive: 'TRIANGLES', indexOffset, indexCount: mesh.indices.length,
        semanticGroupId: side === 'left' ? 10 : 11, lod, side, boneId: `${side}_femur`,
      });
      meshes.push({ side, lod, vertexCount: mesh.vertexCount, triangleCount: mesh.triangleCount, indexOffset, indexCount: mesh.indices.length, vertexOffset });
    }
  }
  const jointMarkers = graph.joints.map((joint) => ({ id: joint.jointId, semanticGroupId: 2, position: joint.jointCenter }));
  const landmarks = [];
  for (const side of ['left', 'right']) {
    const map = getFemurLandmarksV1(femurParameters.get(`${side}_femur`), { side, hipJointCenter: jointById.get(`${side}_hip`).jointCenter });
    for (const [id, position] of Object.entries(map)) landmarks.push({ id, semanticGroupId: side === 'left' ? 10 : 11, position });
  }
  return {
    positions: Float32Array.from(positions, Math.fround), normals: Float32Array.from(normals, Math.fround), indices: Uint32Array.from(indices),
    semanticGroupIds: Uint32Array.from(semanticGroupIds), primitiveGroups, jointMarkers, landmarks,
    semanticGroups: SEMANTIC_GROUPS.map((entry) => ({ ...entry })), meshes,
  };
}

export function skeletalDnaHash(skeletalDNA) { return sha256Stable(skeletalDNA); }
export function sha256Stable(value) { return createHash('sha256').update(stableStringify(value)).digest('hex'); }
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function createJointSpecs(dimensions) {
  const shoulderX = dimensions.shoulderWidth / 2;
  const pelvisX = dimensions.pelvisWidth / 2;
  const pelvisY = 0.965;
  const chestY = pelvisY + dimensions.spineLength;
  const clavicleY = chestY - 0.015;
  const entries = [
    ['pelvis', null, [0, pelvisY, 0]],
    ['spine_low', 'pelvis', [0, pelvisY + dimensions.spineLength * 0.2, 0]],
    ['spine_mid', 'spine_low', [0, pelvisY + dimensions.spineLength * 0.47, 0]],
    ['spine_high', 'spine_mid', [0, pelvisY + dimensions.spineLength * 0.74, 0]],
    ['chest', 'spine_high', [0, chestY, 0]],
    ['neck', 'chest', [0, chestY + 0.105, 0]],
    ['head', 'neck', [0, Math.min(dimensions.bodyHeight - 0.055, chestY + 0.255), 0]],
  ];
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1;
    const sideAsymmetry = side === 'left' ? Number(dimensions.leftRightAsymmetry ?? 0) : -Number(dimensions.leftRightAsymmetry ?? 0);
    const thighLength = dimensions.thighLength * (1 + sideAsymmetry);
    entries.push(
      [`${side}_clavicle`, 'chest', [sign * shoulderX * 0.52, clavicleY, 0]],
      [`${side}_shoulder`, `${side}_clavicle`, [sign * shoulderX, clavicleY - 0.01, 0]],
      [`${side}_elbow`, `${side}_shoulder`, [sign * (shoulderX + dimensions.upperArmLength), clavicleY - 0.02, 0]],
      [`${side}_wrist`, `${side}_elbow`, [sign * (shoulderX + dimensions.upperArmLength + dimensions.forearmLength), clavicleY - 0.025, 0]],
      [`${side}_hand`, `${side}_wrist`, [sign * (shoulderX + dimensions.upperArmLength + dimensions.forearmLength + dimensions.handLength), clavicleY - 0.025, 0.01]],
      [`${side}_hip`, 'pelvis', [sign * pelvisX, pelvisY, 0]],
      [`${side}_knee`, `${side}_hip`, [sign * pelvisX, pelvisY - thighLength, 0]],
      [`${side}_ankle`, `${side}_knee`, [sign * pelvisX, pelvisY - thighLength - dimensions.calfLength, 0]],
      [`${side}_foot`, `${side}_ankle`, [sign * pelvisX, pelvisY - thighLength - dimensions.calfLength - 0.035, dimensions.footLength]],
    );
  }
  return entries.map(([jointId, parentJointId, jointCenter]) => ({ jointId, parentJointId, jointCenter: jointCenter.map(f32) }));
}

function createSegmentSpecs(joints) {
  const result = [{ boneId: 'pelvis', side: 'center', proximalJointId: 'pelvis', distalJointId: 'pelvis', start: [-0.105, 0.965, 0], end: [0.105, 0.965, 0] }];
  const boneIdForJoint = Object.freeze({
    spine_low: 'spine_low', spine_mid: 'spine_mid', spine_high: 'spine_high', chest: 'chest', neck: 'neck', head: 'head',
    left_clavicle: 'left_clavicle', right_clavicle: 'right_clavicle', left_shoulder: 'left_scapular_link', right_shoulder: 'right_scapular_link',
    left_elbow: 'left_humerus', right_elbow: 'right_humerus', left_wrist: 'left_forearm_scaffold', right_wrist: 'right_forearm_scaffold',
    left_hand: 'left_hand_scaffold', right_hand: 'right_hand_scaffold', left_hip: 'left_hip_link', right_hip: 'right_hip_link',
    left_knee: 'left_femur', right_knee: 'right_femur', left_ankle: 'left_tibia_fibula_scaffold', right_ankle: 'right_tibia_fibula_scaffold',
    left_foot: 'left_foot_scaffold', right_foot: 'right_foot_scaffold',
  });
  const byId = new Map(joints.map((joint) => [joint.jointId, joint]));
  for (const joint of joints) {
    if (!joint.parentJointId) continue;
    const boneId = boneIdForJoint[joint.jointId];
    result.push({ boneId, side: sideOf(boneId), proximalJointId: joint.parentJointId, distalJointId: joint.jointId, start: byId.get(joint.parentJointId).jointCenter, end: joint.jointCenter });
  }
  return result;
}

function createLineBoneParameter(segment) {
  const length = segment.boneId === 'pelvis' ? distance(segment.start, segment.end) : distance(segment.start, segment.end);
  return {
    boneId: segment.boneId, generatorType: 'SkeletonLineGeneratorV1@1.0.0', side: segment.side, length: f32(length), centerline: [segment.start.map(f32), segment.end.map(f32)],
    crossSections: [{ t: 0, major: 0.003, minor: 0.003 }, { t: 1, major: 0.003, minor: 0.003 }], curvature: { kind: 'linear' }, torsion: { degrees: 0 },
    proximalEnd: { jointId: segment.proximalJointId }, distalEnd: { jointId: segment.distalJointId }, articularSurfaces: [], landmarks: [], corticalThickness: 0.002,
    detailLevel: 0, symmetryPolicy: segment.side === 'center' ? 'center' : 'parameter-symmetric', minimum: f32(length * 0.75), maximum: f32(length * 1.25), default: f32(length), units: 'meter',
    parameterRanges: { length: { minimum: f32(length * 0.75), maximum: f32(length * 1.25), default: f32(length), units: 'meter' } },
    generatorParameters: { lineRadius: 0.003 }, sourceReceiptIds: [SOURCE_IDS.internalBodyDna, SOURCE_IDS.openStax], confidence: 'medium',
  };
}

function createFemurBoneParameter(segment, variantSpec) {
  const baseLength = distance(segment.start, segment.end);
  const isAsymmetry = variantSpec.variantId === 'left_right_asymmetry_02';
  const asymmetry = isAsymmetry ? (segment.side === 'left' ? 0.002 : -0.002) : 0;
  const femurLength = f32(baseLength * (1 + asymmetry));
  const anteversion = 11 + (variantSpec.variantId === 'anteversion_plus_10_degrees' ? 10 : 0) + (isAsymmetry ? (segment.side === 'left' ? 0.2 : -0.2) : 0);
  const generatorParameters = {
    femurLength,
    shaftCenterlineKnots: [
      { t: 0, anteriorOffset: 0, medialLateralOffset: 0 }, { t: 0.35, anteriorOffset: 0.0015, medialLateralOffset: 0.0005 },
      { t: 0.7, anteriorOffset: 0.001, medialLateralOffset: -0.0004 }, { t: 1, anteriorOffset: 0, medialLateralOffset: 0 },
    ],
    shaftAnteriorBow: 0.0245, shaftMedialLateralBow: 0.0035, shaftCrossSectionMajor: 0.0155, shaftCrossSectionMinor: 0.0135,
    headRadius: 0.022, neckLength: 0.04475, neckShaftAngle: 129.9, femoralAnteversion: anteversion,
    greaterTrochanterSize: 0.018, lesserTrochanterSize: 0.010, distalCondyleWidth: 0.06972, distalCondyleDepth: 0.06068,
    intercondylarNotchWidth: 0.018, corticalThickness: 0.0045, surfaceDetail: 0.6, leftRightAsymmetry: asymmetry,
  };
  const ranges = createFemurParameterRanges(generatorParameters);
  return {
    boneId: segment.boneId, generatorType: LONG_BONE_GENERATOR_V1_ID, side: segment.side, length: femurLength,
    centerline: generatorParameters.shaftCenterlineKnots.map(({ t, medialLateralOffset, anteriorOffset }) => [f32(medialLateralOffset), f32(t * femurLength), f32(anteriorOffset)]),
    crossSections: [
      { t: 0.03, major: f32(generatorParameters.distalCondyleWidth / 2), minor: f32(generatorParameters.distalCondyleDepth / 2) },
      { t: 0.35, major: generatorParameters.shaftCrossSectionMajor, minor: generatorParameters.shaftCrossSectionMinor },
      { t: 0.75, major: f32(generatorParameters.shaftCrossSectionMajor * 1.2), minor: f32(generatorParameters.shaftCrossSectionMinor * 1.18) },
      { t: 0.97, major: generatorParameters.headRadius, minor: generatorParameters.headRadius },
    ],
    curvature: { anteriorBow: generatorParameters.shaftAnteriorBow, medialLateralBow: generatorParameters.shaftMedialLateralBow, referenceRadius: 0.943 },
    torsion: { femoralAnteversion: generatorParameters.femoralAnteversion, units: 'degree' },
    proximalEnd: { headRadius: generatorParameters.headRadius, neckLength: generatorParameters.neckLength, neckShaftAngle: generatorParameters.neckShaftAngle, greaterTrochanterSize: generatorParameters.greaterTrochanterSize, lesserTrochanterSize: generatorParameters.lesserTrochanterSize },
    distalEnd: { distalCondyleWidth: generatorParameters.distalCondyleWidth, distalCondyleDepth: generatorParameters.distalCondyleDepth, intercondylarNotchWidth: generatorParameters.intercondylarNotchWidth },
    articularSurfaces: [{ id: `${segment.side}_femoral_head_surface`, kind: 'spherical-pilot' }, { id: `${segment.side}_distal_condylar_surface`, kind: 'paired-condyle-pilot' }],
    landmarks: femurLandmarkIds(segment.side).map((landmarkId) => ({ landmarkId })), corticalThickness: generatorParameters.corticalThickness,
    detailLevel: 2, symmetryPolicy: 'parameter-symmetric', minimum: ranges.femurLength.minimum, maximum: ranges.femurLength.maximum, default: ranges.femurLength.default, units: 'meter',
    parameterRanges: ranges, generatorParameters, sourceReceiptIds: [SOURCE_IDS.proximal, SOURCE_IDS.curvature, SOURCE_IDS.distal, SOURCE_IDS.angles, SOURCE_IDS.openStax, SOURCE_IDS.pendingDetail], confidence: 'medium',
  };
}

function createFemurParameterRanges(values) {
  const range = (minimum, maximum, defaultValue, units) => ({ minimum, maximum, default: defaultValue, units });
  return {
    femurLength: range(0.34, 0.52, values.femurLength, 'meter'), shaftAnteriorBow: range(0, 0.05, values.shaftAnteriorBow, 'meter'),
    shaftMedialLateralBow: range(-0.02, 0.02, values.shaftMedialLateralBow, 'meter'), shaftCrossSectionMajor: range(0.01, 0.024, values.shaftCrossSectionMajor, 'meter'),
    shaftCrossSectionMinor: range(0.009, 0.022, values.shaftCrossSectionMinor, 'meter'), headRadius: range(0.018, 0.029, values.headRadius, 'meter'),
    neckLength: range(0.03, 0.065, values.neckLength, 'meter'), neckShaftAngle: range(116, 143, values.neckShaftAngle, 'degree'),
    femoralAnteversion: range(-12, 38.4, values.femoralAnteversion, 'degree'), greaterTrochanterSize: range(0.01, 0.03, values.greaterTrochanterSize, 'meter'),
    lesserTrochanterSize: range(0.005, 0.018, values.lesserTrochanterSize, 'meter'), distalCondyleWidth: range(0.055, 0.085, values.distalCondyleWidth, 'meter'),
    distalCondyleDepth: range(0.05, 0.075, values.distalCondyleDepth, 'meter'), intercondylarNotchWidth: range(0.01, 0.028, values.intercondylarNotchWidth, 'meter'),
    corticalThickness: range(0.002, 0.008, values.corticalThickness, 'meter'), surfaceDetail: range(0, 1, values.surfaceDetail, 'level'),
    leftRightAsymmetry: range(-0.02, 0.02, values.leftRightAsymmetry, 'ratio'),
  };
}

function femurLandmarkIds(side) { return ['head_center', 'neck_center', 'greater_trochanter', 'lesser_trochanter', 'medial_condyle', 'lateral_condyle', 'intercondylar_notch'].map((name) => `${side}_femur_${name}`); }
function sideOf(id) { return id.startsWith('left_') ? 'left' : id.startsWith('right_') ? 'right' : 'center'; }
function mirrorId(id) { if (id.startsWith('left_')) return `right_${id.slice(5)}`; if (id.startsWith('right_')) return `left_${id.slice(6)}`; return null; }
function dimensionDependencies(id) { if (id.includes('arm') || id.includes('humerus')) return ['upperArmLength']; if (id.includes('forearm')) return ['forearmLength']; if (id.includes('hand')) return ['handLength']; if (id.includes('tibia') || id.includes('fibula')) return ['calfLength']; if (id.includes('foot')) return ['footLength']; if (id.includes('spine') || id === 'chest' || id === 'neck' || id === 'head') return ['spineLength', 'bodyHeight']; return ['shoulderWidth', 'pelvisWidth']; }
function mappingStatusFor(id) { return ['pelvis', 'spine_low', 'spine_mid', 'spine_high', 'neck', 'head', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'].includes(id) ? 'exact' : CORE_JOINT_TO_HUMAN_RIG[id] ? 'derived' : 'unmapped'; }
function mappingDifference(id) { if (id === 'chest') return 'Anatomical chest and spine_high both project to HumanRigCore upperChest; no HumanRigCore joint is created.'; if (id.includes('clavicle')) return 'Anatomical clavicle center projects to the existing shoulder control.'; if (id.endsWith('_hand') || id.endsWith('_foot')) return 'Distal anatomical endpoint shares the existing HumanRigCore hand/foot joint.'; return 'No one-to-one HumanRigCore joint; retained as a read-only anatomical scaffold point.'; }
function degreesOfFreedomFor(id) { if (id === 'pelvis') return ['swingX', 'swingZ', 'twist']; if (id.includes('knee') || id.includes('elbow')) return ['swingX']; if (id.includes('wrist') || id.includes('ankle')) return ['swingX', 'swingZ']; if (id.includes('shoulder') || id.includes('hip') || id === 'neck') return ['swingX', 'swingZ', 'twist']; return []; }
function jointLimits(id, hard) { const scale = hard ? 1 : 0.85; if (id.includes('knee')) return limits([-5, 145], [-3, 3], [-8, 8], scale); if (id.includes('elbow')) return limits([0, 145], [-8, 8], [-80, 80], scale); if (id.includes('shoulder') || id.includes('hip')) return limits([-120, 120], [-100, 100], [-80, 80], scale); if (id.includes('ankle') || id.includes('wrist')) return limits([-55, 55], [-35, 35], [-30, 30], scale); if (id === 'neck') return limits([-50, 50], [-45, 45], [-70, 70], scale); return limits([0, 0], [0, 0], [0, 0], 1); }
function limits(x, z, twist, scale) { return { swingX: x.map((value) => f32(value * scale)), swingZ: z.map((value) => f32(value * scale)), twist: twist.map((value) => f32(value * scale)) }; }
function segmentMassFor(id) { if (id === 'pelvis') return 0.142; if (id.includes('hip') || id.includes('knee')) return 0.1; if (id.includes('ankle')) return 0.0465; if (id.includes('foot')) return 0.0145; if (id.includes('shoulder') || id.includes('elbow')) return 0.027; if (id.includes('wrist')) return 0.016; if (id.includes('hand')) return 0.006; if (['spine_low', 'spine_mid', 'spine_high', 'chest'].includes(id)) return 0.08; return 0.02; }
function identityBasis() { return { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }; }
function subtract(left, right) { return [left[0] - right[0], left[1] - right[1], left[2] - right[2]]; }
function distance(left, right) { return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]); }
function f32(value) { return Math.fround(Number(value)); }

export { FEMUR_LOD_SPECS_V1, LONG_BONE_GENERATOR_V1_ID };
