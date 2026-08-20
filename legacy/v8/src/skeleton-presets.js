const STANDARD_STATURE = 1.795672;

const SMPL_SOURCE = Object.freeze({
  family: 'SMPL',
  topology: 'SMPL male sample body',
  jointLayout: 'SMPL 24',
  surfaceAsset: 'assets/smpl/smpl-male-surface.glb',
  surfaceVertexCount: 27578,
  surfaceTriangleCount: 55152,
  license: 'CC BY 4.0',
  attribution: 'Meshcapade / Max Planck Institute for Intelligent Systems',
  fittingMethod: 'SMPL 24 hierarchy fitted to the distributed CC BY sample surface',
});

export const JOINT_ROLES = Object.freeze({
  DEFORM: 'deform',
  CONTROL: 'control',
  MARKER: 'marker',
  CORRECTIVE: 'corrective',
  SOCKET: 'socket',
});

export const JOINT_VISIBILITY_LAYERS = Object.freeze({
  PRIMARY: 'primary',
  DEFORM_HIDDEN: 'deform-hidden',
  CONTROLS: 'controls',
  MEASUREMENTS: 'measurements',
  ATTACHMENTS: 'attachments',
});

export const JOINT_SOLVER_PARTICIPATION = Object.freeze({
  FULL_BODY: 'full-body',
  GLOBAL_ROOT: 'global-root',
  PASSIVE_ENDPOINT: 'passive-endpoint',
  DERIVED: 'derived',
  NONE: 'none',
});

export const JOINT_EXPORT_POLICIES = Object.freeze({
  SKIN: 'skin',
  RIG: 'rig',
  EDITOR: 'editor',
  OPTIONAL: 'optional',
});

export const CURRENT_RIG_PROFILE = deepFreeze({
  id: 'smpl24-controls28@1',
  compatibleRig: 'rig@0.4.0',
  maturity: 'compatibility-core',
  roleSchema: 'humanoid_rig/joint_roles@1.0',
  axisSchema: 'humanoid_rig/joint_axes@1.0',
  topologyPolicy: 'append-only',
  localAxisStatus: 'declared-not-runtime-applied',
  twistDataStatus: 'missing',
  productionReady: false,
  expectedCounts: {
    total: 28,
    deform: 24,
    control: 1,
    marker: 3,
    corrective: 0,
    socket: 0,
  },
  roleIds: {
    control: ['root'],
    marker: ['headTop', 'leftToesEnd', 'rightToesEnd'],
    hiddenDeform: ['leftShoulder', 'rightShoulder'],
  },
  visibilityPolicy: {
    defaultHiddenJointIds: [
      'root',
      'headTop',
      'leftShoulder',
      'rightShoulder',
      'leftToesEnd',
      'rightToesEnd',
    ],
    measurementMarkersVisibleOnlyIn: ['proportion', 'diagnostics'],
    clavicleBonesVisibleWithJointHandlesHidden: true,
  },
});

const DEFAULT_META = {
  schemaVersion: 6,
  name: 'SMPL-Compatible Adult Humanoid 3D Proportion Rig',
  unit: 'meter',
  dimensionsLocked: true,
  rigProfile: cloneValue(CURRENT_RIG_PROFILE),
  bindPose: 'A',
  coordinateSystem: {
    handedness: 'right',
    upAxis: '+Y',
    forwardAxis: '+Z',
    rightAxis: '+X',
  },
  standard: { ...SMPL_SOURCE },
  surface: {
    enabled: true,
    asset: SMPL_SOURCE.surfaceAsset,
    source: SMPL_SOURCE.topology,
    license: SMPL_SOURCE.license,
    bindPose: 'A',
    groundOffset: 0.006509,
    weighting: 'region-isolated adjacency-smoothed four-influence CPU dual-quaternion weights with exact bind-pose protection',
  },
  anthropometry: {
    profile: 'smpl-male-surface-fit-1796-v3',
    label: 'SMPL 男性示例体 · 1.796 m',
    referenceStature: STANDARD_STATURE,
    surfaceBounds: {
      min: [-0.478589, -0.006509, -0.128986],
      max: [0.480980, 1.789163, 0.212537],
    },
    shoulderJointWidth: 0.420,
    hipJointWidth: 0.200,
    hipJointHeight: 0.925,
    kneeJointHeight: 0.500,
    ankleJointHeight: 0.100,
    segments: {
      clavicleToShoulder: 0.128647,
      upperArm: 0.277218,
      forearm: 0.241402,
      wristToHandJoint: 0.070774,
      thigh: 0.425348,
      shank: 0.403133,
      ankleToFootJoint: 0.139158,
      pelvisToSpine3: 0.410239,
      spine3ToNeck: 0.155464,
      neckToHead: 0.154353,
    },
    ratios: {
      upperArmToForearm: 1.1484,
      thighToShank: 1.0551,
    },
  },
  biomechanics: {
    enabled: true,
    profile: 'adult-normal-rom-v1',
    label: '成人正常活动范围',
    hardLimits: true,
    limits: {
      shoulder: {
        extension: 55,
        flexion: 170,
        adduction: 35,
        abduction: 95,
      },
      elbow: { hyperextension: 5, flexion: 145 },
      wrist: { flexion: 80, extension: 70, radialDeviation: 20, ulnarDeviation: 30 },
      hip: {
        extension: 18,
        flexion: 130,
        adduction: 30,
        abduction: 50,
      },
      knee: { hyperextension: 2, flexion: 140 },
      ankle: { plantarFlexion: 55, dorsiflexion: 15, yaw: 20 },
      toes: { flexion: 35, extension: 45 },
      lumbar: { cone: 22 },
      thoracic: { cone: 18 },
      neckBase: { cone: 45 },
      head: { cone: 60 },
      clavicle: { cone: 35 },
    },
  },
  physics: {
    enabled: true,
    gravityEnabled: false,
    groundEnabled: true,
    anatomyEnabled: true,
    poseStiffness: 0.20,
    damping: 0.92,
    solverIterations: 64,
  },
};

const joint = (
  id,
  label,
  parentId,
  localPosition,
  {
    side = 'center',
    category = 'body',
    jointRadius = 0.035,
    boneRadius = 0.018,
    visualJoint = true,
    visualBone = true,
    physicalBone = true,
    isControl = false,
    followJointId = null,
    controlOffset = null,
    jointType = 'free',
    limitLabel = '自由关节',
    standardIndex = null,
    standardName = null,
    standardHelper = false,
    role = null,
    visibilityLayer = null,
    deformInfluence = null,
    solverParticipation = null,
    collisionRole = null,
    retargetSemantic = null,
    exportPolicy = null,
  } = {},
) => {
  const standard = {
    family: standardHelper ? 'editor-helper' : 'SMPL',
    index: Number.isInteger(standardIndex) ? standardIndex : null,
    name: standardName ?? id,
    helper: Boolean(standardHelper),
  };
  const resolvedRole = inferJointRole({ role, isControl, standard });
  return {
    id,
    label,
    parentId,
    localPosition: [...localPosition],
    poseWorldPosition: [0, 0, 0],
    side,
    category,
    jointRadius,
    boneRadius,
    visualJoint,
    visualBone,
    physicalBone,
    isControl,
    followJointId,
    controlOffset: controlOffset ? [...controlOffset] : null,
    jointType,
    limitLabel,
    role: resolvedRole,
    visibilityLayer: visibilityLayer ?? inferVisibilityLayer(resolvedRole, visualJoint),
    deformInfluence: deformInfluence == null
      ? resolvedRole === JOINT_ROLES.DEFORM || resolvedRole === JOINT_ROLES.CORRECTIVE
      : Boolean(deformInfluence),
    solverParticipation: solverParticipation ?? inferSolverParticipation(resolvedRole),
    collisionRole: collisionRole ?? inferCollisionRole(id, category, resolvedRole),
    retargetSemantic: retargetSemantic ?? standard.name,
    exportPolicy: exportPolicy ?? inferExportPolicy(resolvedRole),
    standard,
  };
};

/**
 * SMPL 24 compatible hierarchy fitted to Meshcapade's distributable male
 * sample surface. The local bind data is an A pose and stays read-only.
 * Three editor-only endpoints preserve the existing interaction solver.
 */
export function createStandardHumanoidPreset(pose = 'A') {
  const normalizedPose = String(pose).toUpperCase() === 'T' ? 'T' : 'A';

  const joints = [
    joint('root', '全身根控制', null, [0, 0, 0], {
      category: 'root',
      jointRadius: 0.022,
      boneRadius: 0.012,
      visualJoint: false,
      visualBone: false,
      physicalBone: false,
      isControl: true,
      followJointId: 'hips',
      controlOffset: [0, -0.925, -0.016],
      jointType: 'control',
      limitLabel: '全身控制节点',
      standardHelper: true,
      standardName: 'global_control',
    }),
    joint('hips', '骨盆中心', 'root', [0, 0.925, 0.016], {
      category: 'torso',
      jointRadius: 0.044,
      boneRadius: 0.024,
      visualBone: false,
      physicalBone: false,
      jointType: 'pelvis',
      limitLabel: 'SMPL 骨盆根节点与刚性髋距',
      standardIndex: 0,
      standardName: 'pelvis',
    }),
    joint('spine', '腰椎', 'hips', [0, 0.130, 0.024], {
      category: 'torso',
      jointRadius: 0.032,
      boneRadius: 0.022,
      jointType: 'spine',
      limitLabel: '腰椎分段弯曲 ≤ 22°',
      standardIndex: 3,
      standardName: 'spine1',
    }),
    joint('chest', '胸椎', 'spine', [0, 0.135, -0.019], {
      category: 'torso',
      jointRadius: 0.035,
      boneRadius: 0.023,
      jointType: 'spine',
      limitLabel: '胸椎分段弯曲 ≤ 18°',
      standardIndex: 6,
      standardName: 'spine2',
    }),
    joint('upperChest', '上胸', 'chest', [0, 0.145, -0.019], {
      category: 'torso',
      jointRadius: 0.038,
      boneRadius: 0.024,
      jointType: 'spine',
      limitLabel: '上胸分段弯曲 ≤ 18°',
      standardIndex: 9,
      standardName: 'spine3',
    }),
    joint('neck', '颈根', 'upperChest', [0, 0.155, -0.012], {
      category: 'head',
      jointRadius: 0.028,
      boneRadius: 0.018,
      jointType: 'neck',
      limitLabel: '颈部综合摆动 ≤ 45°',
      standardIndex: 12,
      standardName: 'neck',
    }),
    joint('head', '头部中心', 'neck', [0, 0.140, 0.065], {
      category: 'head',
      jointRadius: 0.047,
      boneRadius: 0.020,
      jointType: 'neck',
      limitLabel: '头部综合摆动 ≤ 60°',
      standardIndex: 15,
      standardName: 'head',
    }),
    joint('headTop', '头顶测量点', 'head', [0, 0.165672, -0.010], {
      category: 'head',
      jointRadius: 0.020,
      boneRadius: 0.012,
      visualJoint: false,
      visualBone: false,
      jointType: 'endpoint',
      limitLabel: '表皮顶部辅助点',
      standardHelper: true,
      standardName: 'head_top_helper',
    }),

    joint('leftShoulder', '左锁骨控制点', 'upperChest', [-0.100, 0.070, -0.007], {
      side: 'left',
      category: 'arm',
      jointRadius: 0.018,
      boneRadius: 0.015,
      visualJoint: false,
      jointType: 'clavicle',
      limitLabel: '锁骨摆动 ≤ 35°',
      standardIndex: 13,
      standardName: 'left_collar',
    }),
    joint('leftUpperArm', '左肩关节', 'leftShoulder', [-0.110, -0.065, -0.015], {
      side: 'left',
      category: 'arm',
      jointRadius: 0.034,
      boneRadius: 0.017,
      jointType: 'ball',
      limitLabel: '肩球窝关节：屈曲 170°，伸展 55°',
      standardIndex: 16,
      standardName: 'left_shoulder',
    }),
    joint('leftLowerArm', '左肘', 'leftUpperArm', [-0.140, -0.235, 0.045], {
      side: 'left',
      category: 'arm',
      jointRadius: 0.027,
      boneRadius: 0.015,
      jointType: 'hinge',
      limitLabel: '肘铰链：伸展 5°，屈曲 145°',
      standardIndex: 18,
      standardName: 'left_elbow',
    }),
    joint('leftHand', '左腕', 'leftLowerArm', [-0.085, -0.205, 0.095], {
      side: 'left',
      category: 'arm',
      jointRadius: 0.025,
      boneRadius: 0.013,
      jointType: 'wrist',
      limitLabel: '腕：屈曲 80°，伸展 70°，桡偏 20°，尺偏 30°',
      standardIndex: 20,
      standardName: 'left_wrist',
    }),
    joint('leftHandEnd', '左掌中心', 'leftHand', [-0.028, -0.060, 0.025], {
      side: 'left',
      category: 'arm',
      jointRadius: 0.020,
      boneRadius: 0.011,
      jointType: 'endpoint',
      limitLabel: 'SMPL 手部节点',
      standardIndex: 22,
      standardName: 'left_hand',
    }),

    joint('rightShoulder', '右锁骨控制点', 'upperChest', [0.100, 0.070, -0.007], {
      side: 'right',
      category: 'arm',
      jointRadius: 0.018,
      boneRadius: 0.015,
      visualJoint: false,
      jointType: 'clavicle',
      limitLabel: '锁骨摆动 ≤ 35°',
      standardIndex: 14,
      standardName: 'right_collar',
    }),
    joint('rightUpperArm', '右肩关节', 'rightShoulder', [0.110, -0.065, -0.015], {
      side: 'right',
      category: 'arm',
      jointRadius: 0.034,
      boneRadius: 0.017,
      jointType: 'ball',
      limitLabel: '肩球窝关节：屈曲 170°，伸展 55°',
      standardIndex: 17,
      standardName: 'right_shoulder',
    }),
    joint('rightLowerArm', '右肘', 'rightUpperArm', [0.140, -0.235, 0.045], {
      side: 'right',
      category: 'arm',
      jointRadius: 0.027,
      boneRadius: 0.015,
      jointType: 'hinge',
      limitLabel: '肘铰链：伸展 5°，屈曲 145°',
      standardIndex: 19,
      standardName: 'right_elbow',
    }),
    joint('rightHand', '右腕', 'rightLowerArm', [0.085, -0.205, 0.095], {
      side: 'right',
      category: 'arm',
      jointRadius: 0.025,
      boneRadius: 0.013,
      jointType: 'wrist',
      limitLabel: '腕：屈曲 80°，伸展 70°，桡偏 20°，尺偏 30°',
      standardIndex: 21,
      standardName: 'right_wrist',
    }),
    joint('rightHandEnd', '右掌中心', 'rightHand', [0.028, -0.060, 0.025], {
      side: 'right',
      category: 'arm',
      jointRadius: 0.020,
      boneRadius: 0.011,
      jointType: 'endpoint',
      limitLabel: 'SMPL 手部节点',
      standardIndex: 23,
      standardName: 'right_hand',
    }),

    joint('leftUpperLeg', '左髋关节', 'hips', [-0.100, 0, 0], {
      side: 'left',
      category: 'leg',
      jointRadius: 0.036,
      boneRadius: 0.021,
      visualBone: false,
      jointType: 'ball',
      limitLabel: '髋球窝关节：屈曲 130°，伸展 18°',
      standardIndex: 1,
      standardName: 'left_hip',
    }),
    joint('leftLowerLeg', '左膝', 'leftUpperLeg', [-0.010, -0.425, -0.014], {
      side: 'left',
      category: 'leg',
      jointRadius: 0.032,
      boneRadius: 0.020,
      jointType: 'hinge',
      limitLabel: '膝铰链：伸展 2°，屈曲 140°',
      standardIndex: 4,
      standardName: 'left_knee',
    }),
    joint('leftFoot', '左踝', 'leftLowerLeg', [-0.050, -0.400, -0.004], {
      side: 'left',
      category: 'leg',
      jointRadius: 0.027,
      boneRadius: 0.017,
      jointType: 'ankle',
      limitLabel: '踝：背屈 15°，跖屈 55°，侧偏 20°',
      standardIndex: 7,
      standardName: 'left_ankle',
    }),
    joint('leftToes', '左前脚掌', 'leftFoot', [-0.016, -0.065, 0.122], {
      side: 'left',
      category: 'leg',
      jointRadius: 0.023,
      boneRadius: 0.013,
      jointType: 'toe',
      limitLabel: 'SMPL 足部节点；前脚掌屈曲 35°，伸展 45°',
      standardIndex: 10,
      standardName: 'left_foot',
    }),
    joint('leftToesEnd', '左脚趾测量点', 'leftToes', [0, -0.015, 0.075], {
      side: 'left',
      category: 'leg',
      jointRadius: 0.018,
      boneRadius: 0.010,
      visualJoint: false,
      visualBone: false,
      jointType: 'endpoint',
      limitLabel: '脚趾表皮辅助点',
      standardHelper: true,
      standardName: 'left_toe_tip_helper',
    }),

    joint('rightUpperLeg', '右髋关节', 'hips', [0.100, 0, 0], {
      side: 'right',
      category: 'leg',
      jointRadius: 0.036,
      boneRadius: 0.021,
      visualBone: false,
      jointType: 'ball',
      limitLabel: '髋球窝关节：屈曲 130°，伸展 18°',
      standardIndex: 2,
      standardName: 'right_hip',
    }),
    joint('rightLowerLeg', '右膝', 'rightUpperLeg', [0.010, -0.425, -0.014], {
      side: 'right',
      category: 'leg',
      jointRadius: 0.032,
      boneRadius: 0.020,
      jointType: 'hinge',
      limitLabel: '膝铰链：伸展 2°，屈曲 140°',
      standardIndex: 5,
      standardName: 'right_knee',
    }),
    joint('rightFoot', '右踝', 'rightLowerLeg', [0.050, -0.400, -0.004], {
      side: 'right',
      category: 'leg',
      jointRadius: 0.027,
      boneRadius: 0.017,
      jointType: 'ankle',
      limitLabel: '踝：背屈 15°，跖屈 55°，侧偏 20°',
      standardIndex: 8,
      standardName: 'right_ankle',
    }),
    joint('rightToes', '右前脚掌', 'rightFoot', [0.016, -0.065, 0.122], {
      side: 'right',
      category: 'leg',
      jointRadius: 0.023,
      boneRadius: 0.013,
      jointType: 'toe',
      limitLabel: 'SMPL 足部节点；前脚掌屈曲 35°，伸展 45°',
      standardIndex: 11,
      standardName: 'right_foot',
    }),
    joint('rightToesEnd', '右脚趾测量点', 'rightToes', [0, -0.015, 0.075], {
      side: 'right',
      category: 'leg',
      jointRadius: 0.018,
      boneRadius: 0.010,
      visualJoint: false,
      visualBone: false,
      jointType: 'endpoint',
      limitLabel: '脚趾表皮辅助点',
      standardHelper: true,
      standardName: 'right_toe_tip_helper',
    }),
  ];

  const definition = {
    ...cloneValue(DEFAULT_META),
    pose: normalizedPose,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    joints,
  };

  definition.jointAxes = createJointAxisContract(joints);

  applyPosePresetToDefinition(definition, normalizedPose);
  return definition;
}

export function applyPosePresetToDefinition(definition, pose = 'A') {
  const normalizedPose = String(pose).toUpperCase() === 'T' ? 'T' : 'A';
  const restWorld = calculateWorldFromLocals(definition.joints);

  for (const jointItem of definition.joints) {
    const point = restWorld.get(jointItem.id) ?? [0, 0, 0];
    jointItem.poseWorldPosition = [...point];
  }

  // The distributed sample mesh is already in its fitted A pose. T pose only
  // rotates each arm chain while preserving every bind segment length.
  if (normalizedPose === 'T') {
    poseArmChain(definition, 'left', [-1, 0, 0]);
    poseArmChain(definition, 'right', [1, 0, 0]);
  }

  definition.pose = normalizedPose;
  definition.updatedAt = new Date().toISOString();
  return definition;
}

function poseArmChain(definition, side, direction) {
  const byId = new Map(definition.joints.map((item) => [item.id, item]));
  const ids = [
    `${side}UpperArm`,
    `${side}LowerArm`,
    `${side}Hand`,
    `${side}HandEnd`,
  ];

  const shoulderJoint = byId.get(ids[0]);
  if (!shoulderJoint) {
    return;
  }

  let parentPosition = [...shoulderJoint.poseWorldPosition];
  const normalized = normalize3(direction);
  for (let i = 1; i < ids.length; i += 1) {
    const current = byId.get(ids[i]);
    if (!current) {
      continue;
    }
    const length = Math.hypot(...current.localPosition);
    current.poseWorldPosition = [
      parentPosition[0] + normalized[0] * length,
      parentPosition[1] + normalized[1] * length,
      parentPosition[2] + normalized[2] * length,
    ];
    parentPosition = [...current.poseWorldPosition];
  }
}

export const MIRROR_PAIRS = Object.freeze({
  leftShoulder: 'rightShoulder',
  rightShoulder: 'leftShoulder',
  leftUpperArm: 'rightUpperArm',
  rightUpperArm: 'leftUpperArm',
  leftLowerArm: 'rightLowerArm',
  rightLowerArm: 'leftLowerArm',
  leftHand: 'rightHand',
  rightHand: 'leftHand',
  leftHandEnd: 'rightHandEnd',
  rightHandEnd: 'leftHandEnd',
  leftUpperLeg: 'rightUpperLeg',
  rightUpperLeg: 'leftUpperLeg',
  leftLowerLeg: 'rightLowerLeg',
  rightLowerLeg: 'leftLowerLeg',
  leftFoot: 'rightFoot',
  rightFoot: 'leftFoot',
  leftToes: 'rightToes',
  rightToes: 'leftToes',
  leftToesEnd: 'rightToesEnd',
  rightToesEnd: 'leftToesEnd',
});

export function cloneValue(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function normalizeSkeletonDefinition(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('骨骼文件内容无效。');
  }
  if (!Array.isArray(input.joints) || input.joints.length === 0) {
    throw new Error('骨骼文件中没有 joints 数据。');
  }

  const seen = new Set();
  const normalizedJoints = input.joints.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`第 ${index + 1} 个关节数据无效。`);
    }

    const id = String(item.id ?? '').trim();
    if (!id) {
      throw new Error(`第 ${index + 1} 个关节缺少 id。`);
    }
    if (seen.has(id)) {
      throw new Error(`关节 id 重复：${id}`);
    }
    seen.add(id);

    const parentId = item.parentId == null || item.parentId === ''
      ? null
      : String(item.parentId);
    const localPosition = normalizePosition(item.localPosition, `关节 ${id} 的 localPosition`);
    const isControl = Boolean(item.isControl);
    const standard = item.standard && typeof item.standard === 'object'
      ? cloneValue(item.standard)
      : { family: 'custom', index: null, name: id, helper: false };
    const role = inferJointRole({ role: item.role, isControl, standard });
    const visualJoint = item.visualJoint !== false;
    const category = String(item.category ?? 'body');

    return {
      id,
      label: String(item.label ?? id),
      parentId,
      localPosition,
      poseWorldPosition: null,
      side: ['left', 'right', 'center'].includes(item.side) ? item.side : 'center',
      category,
      jointRadius: clampNumber(item.jointRadius, 0.005, 0.25, 0.035),
      boneRadius: clampNumber(item.boneRadius, 0.003, 0.20, 0.018),
      visualJoint,
      visualBone: item.visualBone !== false,
      physicalBone: item.physicalBone !== false,
      isControl,
      followJointId: item.followJointId ? String(item.followJointId) : null,
      controlOffset: item.controlOffset == null
        ? null
        : normalizePosition(item.controlOffset, `关节 ${id} 的 controlOffset`),
      jointType: String(item.jointType ?? 'free'),
      limitLabel: String(item.limitLabel ?? '自由关节'),
      role,
      visibilityLayer: normalizeEnum(
        item.visibilityLayer,
        Object.values(JOINT_VISIBILITY_LAYERS),
        inferVisibilityLayer(role, visualJoint),
      ),
      deformInfluence: item.deformInfluence == null
        ? role === JOINT_ROLES.DEFORM || role === JOINT_ROLES.CORRECTIVE
        : Boolean(item.deformInfluence),
      solverParticipation: normalizeEnum(
        item.solverParticipation,
        Object.values(JOINT_SOLVER_PARTICIPATION),
        inferSolverParticipation(role),
      ),
      collisionRole: String(item.collisionRole ?? inferCollisionRole(id, category, role)),
      retargetSemantic: String(item.retargetSemantic ?? standard.name ?? id),
      exportPolicy: normalizeEnum(
        item.exportPolicy,
        Object.values(JOINT_EXPORT_POLICIES),
        inferExportPolicy(role),
      ),
      standard,
      pinned: Boolean(item.pinned),
      _rawPose: item.poseWorldPosition ?? item.worldPosition ?? null,
    };
  });

  for (const item of normalizedJoints) {
    if (item.parentId !== null && !seen.has(item.parentId)) {
      throw new Error(`关节 ${item.id} 的父级 ${item.parentId} 不存在。`);
    }
    if (item.followJointId !== null && !seen.has(item.followJointId)) {
      item.followJointId = null;
      item.controlOffset = null;
    }
  }
  if (!normalizedJoints.some((item) => item.parentId === null)) {
    throw new Error('骨骼数据至少需要一个根节点。');
  }
  assertNoCycles(normalizedJoints);

  const restWorld = calculateWorldFromLocals(normalizedJoints);
  for (const item of normalizedJoints) {
    if (item._rawPose != null) {
      item.poseWorldPosition = normalizePosition(item._rawPose, `关节 ${item.id} 的 poseWorldPosition`);
    } else {
      item.poseWorldPosition = [...restWorld.get(item.id)];
    }
    delete item._rawPose;
  }

  return {
    ...cloneValue(DEFAULT_META),
    ...cloneValue(input),
    schemaVersion: 6,
    name: String(input.name ?? DEFAULT_META.name),
    pose: String(input.pose ?? 'CUSTOM').toUpperCase(),
    unit: 'meter',
    dimensionsLocked: true,
    rigProfile: {
      ...cloneValue(CURRENT_RIG_PROFILE),
      ...(input.rigProfile && typeof input.rigProfile === 'object'
        ? cloneValue(input.rigProfile)
        : {}),
      topologyPolicy: 'append-only',
    },
    bindPose: String(input.bindPose ?? DEFAULT_META.bindPose).toUpperCase(),
    coordinateSystem: cloneValue(DEFAULT_META.coordinateSystem),
    standard: {
      ...cloneValue(DEFAULT_META.standard),
      ...(input.standard && typeof input.standard === 'object' ? cloneValue(input.standard) : {}),
    },
    surface: {
      ...cloneValue(DEFAULT_META.surface),
      ...(input.surface && typeof input.surface === 'object' ? cloneValue(input.surface) : {}),
    },
    anthropometry: {
      ...cloneValue(DEFAULT_META.anthropometry),
      ...(input.anthropometry && typeof input.anthropometry === 'object'
        ? cloneValue(input.anthropometry)
        : {}),
    },
    biomechanics: {
      ...cloneValue(DEFAULT_META.biomechanics),
      ...(input.biomechanics && typeof input.biomechanics === 'object'
        ? cloneValue(input.biomechanics)
        : {}),
      limits: {
        ...cloneValue(DEFAULT_META.biomechanics.limits),
        ...(input.biomechanics?.limits && typeof input.biomechanics.limits === 'object'
          ? cloneValue(input.biomechanics.limits)
          : {}),
      },
    },
    physics: {
      ...cloneValue(DEFAULT_META.physics),
      ...(input.physics && typeof input.physics === 'object' ? cloneValue(input.physics) : {}),
      anatomyEnabled: true,
    },
    jointAxes: createJointAxisContract(normalizedJoints),
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    joints: normalizedJoints,
  };
}

export function summarizeRigDefinition(definition) {
  if (!definition || !Array.isArray(definition.joints)) {
    throw new Error('无法统计缺少 joints 的骨架定义。');
  }

  const counts = {
    total: definition.joints.length,
    deform: 0,
    control: 0,
    marker: 0,
    corrective: 0,
    socket: 0,
    visibleJoints: 0,
    visibleBones: 0,
    physicalBones: 0,
    deformInfluences: 0,
  };
  const hiddenJointIds = [];
  const idsByRole = {
    deform: [],
    control: [],
    marker: [],
    corrective: [],
    socket: [],
  };

  for (const item of definition.joints) {
    const role = inferJointRole({
      role: item.role,
      isControl: Boolean(item.isControl),
      standard: item.standard,
    });
    counts[role] = (counts[role] || 0) + 1;
    idsByRole[role]?.push(item.id);
    if (item.visualJoint === false) hiddenJointIds.push(item.id);
    else counts.visibleJoints += 1;
    if (item.parentId && item.visualBone !== false) counts.visibleBones += 1;
    if (item.parentId && item.physicalBone !== false) counts.physicalBones += 1;
    if (item.deformInfluence !== false
      && (role === JOINT_ROLES.DEFORM || role === JOINT_ROLES.CORRECTIVE)) {
      counts.deformInfluences += 1;
    }
  }

  const expected = definition.rigProfile?.expectedCounts ?? CURRENT_RIG_PROFILE.expectedCounts;
  const countMatchesProfile = ['total', 'deform', 'control', 'marker', 'corrective', 'socket']
    .every((key) => Number(expected?.[key] ?? counts[key]) === counts[key]);
  const axisAudit = auditJointAxisContract(definition.jointAxes, definition.joints);

  return {
    profile: cloneValue(definition.rigProfile ?? CURRENT_RIG_PROFILE),
    counts,
    idsByRole,
    hiddenJointIds,
    countMatchesProfile,
    axisAudit,
    productionReady: Boolean(definition.rigProfile?.productionReady),
  };
}

export function createJointAxisContract(joints) {
  const list = Array.isArray(joints) ? joints : [];
  const byId = new Map(list.map((item) => [item.id, item]));
  const childrenByParent = new Map();
  for (const item of list) {
    if (!item.parentId) continue;
    if (!childrenByParent.has(item.parentId)) childrenByParent.set(item.parentId, []);
    childrenByParent.get(item.parentId).push(item);
  }

  const preferredChildIds = {
    root: 'hips',
    hips: 'spine',
    spine: 'chest',
    chest: 'upperChest',
    upperChest: 'neck',
    neck: 'head',
    head: 'headTop',
    leftShoulder: 'leftUpperArm',
    leftUpperArm: 'leftLowerArm',
    leftLowerArm: 'leftHand',
    leftHand: 'leftHandEnd',
    rightShoulder: 'rightUpperArm',
    rightUpperArm: 'rightLowerArm',
    rightLowerArm: 'rightHand',
    rightHand: 'rightHandEnd',
    leftUpperLeg: 'leftLowerLeg',
    leftLowerLeg: 'leftFoot',
    leftFoot: 'leftToes',
    leftToes: 'leftToesEnd',
    rightUpperLeg: 'rightLowerLeg',
    rightLowerLeg: 'rightFoot',
    rightFoot: 'rightToes',
    rightToes: 'rightToesEnd',
  };

  const entries = {};
  for (const item of list) {
    const preferredChild = byId.get(preferredChildIds[item.id]);
    const firstChild = childrenByParent.get(item.id)?.[0] ?? null;
    const directionSource = preferredChild?.localPosition
      ?? firstChild?.localPosition
      ?? item.localPosition;
    const twistAxisLocal = normalizeAxis(directionSource, [0, 1, 0]);
    const isCentral = item.side === 'center' || ['root', 'torso', 'head'].includes(item.category);
    const bendSeed = isCentral ? [1, 0, 0] : [0, 0, 1];
    let bendAxisLocal = isCentral
      ? projectAxisOntoPlane(bendSeed, twistAxisLocal)
      : crossAxis(bendSeed, twistAxisLocal);
    if (axisLength(bendAxisLocal) < 1e-8) {
      bendAxisLocal = projectAxisOntoPlane([1, 0, 0], twistAxisLocal);
    }
    if (axisLength(bendAxisLocal) < 1e-8) {
      bendAxisLocal = projectAxisOntoPlane([0, 1, 0], twistAxisLocal);
    }
    bendAxisLocal = normalizeAxis(bendAxisLocal, [1, 0, 0]);
    const sideAxisLocal = normalizeAxis(crossAxis(twistAxisLocal, bendAxisLocal), [0, 0, 1]);

    entries[item.id] = {
      twistAxisLocal: roundAxis(twistAxisLocal),
      bendAxisLocal: roundAxis(bendAxisLocal),
      sideAxisLocal: roundAxis(sideAxisLocal),
      jointType: item.jointType ?? 'free',
      source: 'bind-direction-derived',
      runtimeApplied: false,
    };
  }

  return {
    schema: 'humanoid_rig/joint_axes@1.0',
    profile: 'smpl24-controls28-bind-frame-v1',
    space: 'joint-local-at-bind',
    handedness: 'right',
    quaternionOrder: 'xyzw',
    runtimeApplied: false,
    generatedFrom: 'immutable A-bind hierarchy and anatomical bend references',
    entries,
  };
}

export function auditJointAxisContract(contract, joints) {
  const entries = contract?.entries && typeof contract.entries === 'object'
    ? contract.entries
    : {};
  const required = Array.isArray(joints) ? joints : [];
  const missingIds = [];
  const invalidIds = [];

  for (const item of required) {
    const entry = entries[item.id];
    if (!entry) {
      missingIds.push(item.id);
      continue;
    }
    const twist = normalizePositionOrNull(entry.twistAxisLocal);
    const bend = normalizePositionOrNull(entry.bendAxisLocal);
    const side = normalizePositionOrNull(entry.sideAxisLocal);
    const valid = twist && bend && side
      && approximately(axisLength(twist), 1, 1e-6)
      && approximately(axisLength(bend), 1, 1e-6)
      && approximately(axisLength(side), 1, 1e-6)
      && approximately(dotAxis(twist, bend), 0, 1e-6)
      && approximately(dotAxis(twist, side), 0, 1e-6)
      && approximately(dotAxis(bend, side), 0, 1e-6)
      && axesEqual(crossAxis(twist, bend), side, 1e-6);
    if (!valid) invalidIds.push(item.id);
  }

  return {
    schema: contract?.schema ?? null,
    profile: contract?.profile ?? null,
    space: contract?.space ?? null,
    runtimeApplied: contract?.runtimeApplied === true,
    requiredEntryCount: required.length,
    presentEntryCount: required.length - missingIds.length,
    complete: missingIds.length === 0,
    orthonormal: missingIds.length === 0 && invalidIds.length === 0,
    missingIds,
    invalidIds,
  };
}

function inferJointRole({ role, isControl, standard }) {
  if (Object.values(JOINT_ROLES).includes(role)) return role;
  if (isControl) return JOINT_ROLES.CONTROL;
  if (standard?.helper) return JOINT_ROLES.MARKER;
  return JOINT_ROLES.DEFORM;
}

function inferVisibilityLayer(role, visualJoint) {
  if (role === JOINT_ROLES.CONTROL) return JOINT_VISIBILITY_LAYERS.CONTROLS;
  if (role === JOINT_ROLES.MARKER) return JOINT_VISIBILITY_LAYERS.MEASUREMENTS;
  if (role === JOINT_ROLES.SOCKET) return JOINT_VISIBILITY_LAYERS.ATTACHMENTS;
  if (visualJoint === false) return JOINT_VISIBILITY_LAYERS.DEFORM_HIDDEN;
  return JOINT_VISIBILITY_LAYERS.PRIMARY;
}

function inferSolverParticipation(role) {
  if (role === JOINT_ROLES.CONTROL) return JOINT_SOLVER_PARTICIPATION.GLOBAL_ROOT;
  if (role === JOINT_ROLES.MARKER) return JOINT_SOLVER_PARTICIPATION.PASSIVE_ENDPOINT;
  if (role === JOINT_ROLES.CORRECTIVE) return JOINT_SOLVER_PARTICIPATION.DERIVED;
  if (role === JOINT_ROLES.SOCKET) return JOINT_SOLVER_PARTICIPATION.NONE;
  return JOINT_SOLVER_PARTICIPATION.FULL_BODY;
}

function inferCollisionRole(id, category, role) {
  if (role !== JOINT_ROLES.DEFORM) return 'none';
  if (id === 'head') return 'head';
  if (id === 'hips') return 'pelvis';
  if (['torso', 'head'].includes(category)) return 'torso';
  if (category === 'arm') return 'upper-limb';
  if (category === 'leg') return 'lower-limb';
  return 'body';
}

function inferExportPolicy(role) {
  if (role === JOINT_ROLES.DEFORM || role === JOINT_ROLES.CORRECTIVE) return JOINT_EXPORT_POLICIES.SKIN;
  if (role === JOINT_ROLES.CONTROL) return JOINT_EXPORT_POLICIES.RIG;
  if (role === JOINT_ROLES.MARKER) return JOINT_EXPORT_POLICIES.EDITOR;
  return JOINT_EXPORT_POLICIES.OPTIONAL;
}

function normalizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeAxis(value, fallback) {
  const source = Array.isArray(value) && value.length === 3
    ? value.map(Number)
    : [...fallback];
  const length = axisLength(source);
  if (!Number.isFinite(length) || length < 1e-10) return [...fallback];
  return source.map((item) => item / length);
}

function projectAxisOntoPlane(axis, planeNormal) {
  const dot = dotAxis(axis, planeNormal);
  return [
    axis[0] - planeNormal[0] * dot,
    axis[1] - planeNormal[1] * dot,
    axis[2] - planeNormal[2] * dot,
  ];
}

function crossAxis(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function dotAxis(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function axisLength(value) {
  return Math.hypot(Number(value?.[0]) || 0, Number(value?.[1]) || 0, Number(value?.[2]) || 0);
}

function roundAxis(value) {
  return value.map((item) => Math.abs(item) < 1e-12 ? 0 : Number(item.toFixed(9)));
}

function normalizePositionOrNull(value) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => !Number.isFinite(Number(item)))) {
    return null;
  }
  return value.map(Number);
}

function approximately(left, right, tolerance) {
  return Math.abs(Number(left) - Number(right)) <= tolerance;
}

function axesEqual(left, right, tolerance) {
  return left.every((value, index) => approximately(value, right[index], tolerance));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function normalizePosition(value, label) {
  const values = Array.isArray(value)
    ? value
    : [value?.x, value?.y, value?.z];
  if (values.length !== 3 || values.some((entry) => !Number.isFinite(Number(entry)))) {
    throw new Error(`${label} 无效。`);
  }
  return values.map(Number);
}

function assertNoCycles(joints) {
  const parentById = new Map(joints.map((item) => [item.id, item.parentId]));
  for (const item of joints) {
    const path = new Set();
    let current = item.id;
    while (current !== null) {
      if (path.has(current)) {
        throw new Error(`检测到骨骼层级循环：${item.id}`);
      }
      path.add(current);
      current = parentById.get(current) ?? null;
    }
  }
}

function calculateWorldFromLocals(joints) {
  const byId = new Map(joints.map((item) => [item.id, item]));
  const cache = new Map();
  const resolve = (id) => {
    if (cache.has(id)) {
      return cache.get(id);
    }
    const item = byId.get(id);
    if (!item) {
      throw new Error(`关节 ${id} 不存在。`);
    }
    const parent = item.parentId ? resolve(item.parentId) : [0, 0, 0];
    const world = [
      parent[0] + Number(item.localPosition[0]),
      parent[1] + Number(item.localPosition[1]),
      parent[2] + Number(item.localPosition[2]),
    ];
    cache.set(id, world);
    return world;
  };
  for (const item of joints) {
    resolve(item.id);
  }
  return cache;
}

function normalize3(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}
