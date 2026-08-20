const TWIST_SEGMENTS = Object.freeze([
  { id: 'leftUpperArmTwist', label: '左上臂扭转', parentId: 'leftUpperArm', endJointId: 'leftLowerArm', side: 'left', category: 'arm' },
  { id: 'rightUpperArmTwist', label: '右上臂扭转', parentId: 'rightUpperArm', endJointId: 'rightLowerArm', side: 'right', category: 'arm' },
  { id: 'leftForearmTwist', label: '左前臂扭转', parentId: 'leftLowerArm', endJointId: 'leftHand', side: 'left', category: 'arm' },
  { id: 'rightForearmTwist', label: '右前臂扭转', parentId: 'rightLowerArm', endJointId: 'rightHand', side: 'right', category: 'arm' },
  { id: 'leftThighTwist', label: '左大腿扭转', parentId: 'leftUpperLeg', endJointId: 'leftLowerLeg', side: 'left', category: 'leg' },
  { id: 'rightThighTwist', label: '右大腿扭转', parentId: 'rightUpperLeg', endJointId: 'rightLowerLeg', side: 'right', category: 'leg' },
  { id: 'leftCalfTwist', label: '左小腿扭转', parentId: 'leftLowerLeg', endJointId: 'leftFoot', side: 'left', category: 'leg' },
  { id: 'rightCalfTwist', label: '右小腿扭转', parentId: 'rightLowerLeg', endJointId: 'rightFoot', side: 'right', category: 'leg' },
]);

const CONTROL_SPECS = Object.freeze([
  { id: 'centerOfMass', label: '重心控制', sourceJointId: 'hips', placementMode: 'copy-bind-world', offset: [0, 0.08, 0] },
  { id: 'leftHandIK', label: '左手 IK', sourceJointId: 'leftHandEnd', placementMode: 'copy-bind-world', offset: [0, 0, 0], side: 'left' },
  { id: 'rightHandIK', label: '右手 IK', sourceJointId: 'rightHandEnd', placementMode: 'copy-bind-world', offset: [0, 0, 0], side: 'right' },
  { id: 'leftElbowPole', label: '左肘极向', sourceJointId: 'leftLowerArm', placementMode: 'bend-plane-offset', offset: [-0.05, 0.02, 0.26], side: 'left' },
  { id: 'rightElbowPole', label: '右肘极向', sourceJointId: 'rightLowerArm', placementMode: 'bend-plane-offset', offset: [0.05, 0.02, 0.26], side: 'right' },
  { id: 'leftFootIK', label: '左脚 IK', sourceJointId: 'leftFoot', placementMode: 'copy-bind-world', offset: [0, -0.075, 0.04], side: 'left' },
  { id: 'rightFootIK', label: '右脚 IK', sourceJointId: 'rightFoot', placementMode: 'copy-bind-world', offset: [0, -0.075, 0.04], side: 'right' },
  { id: 'leftKneePole', label: '左膝极向', sourceJointId: 'leftLowerLeg', placementMode: 'bend-plane-offset', offset: [-0.035, 0.02, 0.32], side: 'left' },
  { id: 'rightKneePole', label: '右膝极向', sourceJointId: 'rightLowerLeg', placementMode: 'bend-plane-offset', offset: [0.035, 0.02, 0.32], side: 'right' },
  { id: 'leftFootRoll', label: '左脚滚动', sourceJointId: 'leftFoot', placementMode: 'surface-grounded-foot-pivot', offset: [0, -0.085, 0.08], side: 'left' },
  { id: 'rightFootRoll', label: '右脚滚动', sourceJointId: 'rightFoot', placementMode: 'surface-grounded-foot-pivot', offset: [0, -0.085, 0.08], side: 'right' },
  { id: 'gazeTarget', label: '视线目标', sourceJointId: 'head', placementMode: 'head-forward-target', offset: [0, 0.03, 0.52] },
]);

const CONTACT_MARKER_SPECS = Object.freeze([
  { id: 'leftHeelContact', label: '左脚跟接触', parentId: 'leftFoot', sourceJointId: 'leftFoot', placementMode: 'surface-extreme', offset: [0, -0.075, -0.075], side: 'left', source: 'heel' },
  { id: 'rightHeelContact', label: '右脚跟接触', parentId: 'rightFoot', sourceJointId: 'rightFoot', placementMode: 'surface-extreme', offset: [0, -0.075, -0.075], side: 'right', source: 'heel' },
  { id: 'leftBallContact', label: '左前掌接触', parentId: 'leftToes', sourceJointId: 'leftToes', placementMode: 'project-joint-to-sole', offset: [0, -0.035, 0.02], side: 'left', source: 'leftToes' },
  { id: 'rightBallContact', label: '右前掌接触', parentId: 'rightToes', sourceJointId: 'rightToes', placementMode: 'project-joint-to-sole', offset: [0, -0.035, 0.02], side: 'right', source: 'rightToes' },
  { id: 'leftPalmGrip', label: '左掌抓握点', parentId: 'leftHandEnd', sourceJointId: 'leftHandEnd', placementMode: 'surface-center', offset: [-0.008, -0.008, 0.018], side: 'left', source: 'palm' },
  { id: 'rightPalmGrip', label: '右掌抓握点', parentId: 'rightHandEnd', sourceJointId: 'rightHandEnd', placementMode: 'surface-center', offset: [0.008, -0.008, 0.018], side: 'right', source: 'palm' },
]);

const FINGER_CHAINS = Object.freeze([
  { finger: 'thumb', names: ['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal'], labels: ['拇指掌骨', '拇指近节', '拇指末节'], lengths: [0.034, 0.029, 0.024] },
  { finger: 'index', names: ['IndexProximal', 'IndexIntermediate', 'IndexDistal'], labels: ['食指近节', '食指中节', '食指末节'], lengths: [0.040, 0.026, 0.021] },
  { finger: 'middle', names: ['MiddleProximal', 'MiddleIntermediate', 'MiddleDistal'], labels: ['中指近节', '中指中节', '中指末节'], lengths: [0.044, 0.029, 0.023] },
  { finger: 'ring', names: ['RingProximal', 'RingIntermediate', 'RingDistal'], labels: ['无名指近节', '无名指中节', '无名指末节'], lengths: [0.041, 0.027, 0.021] },
  { finger: 'little', names: ['LittleProximal', 'LittleIntermediate', 'LittleDistal'], labels: ['小指近节', '小指中节', '小指末节'], lengths: [0.034, 0.023, 0.018] },
]);

const SIDES = Object.freeze(['left', 'right']);
const SIDE_LABEL = Object.freeze({ left: '左', right: '右' });

export const BODY_PRODUCTION_NODE_DEFINITIONS = deepFreeze([
  ...TWIST_SEGMENTS.map((spec) => ({
    id: spec.id,
    label: spec.label,
    parentId: spec.parentId,
    side: spec.side,
    category: spec.category,
    role: 'deform',
    rigTier: 'body-production',
    visualShape: 'twist',
    visibilityLayer: 'deform-hidden',
    deformInfluence: true,
    physicalBone: false,
    solverParticipation: 'derived',
    collisionRole: 'none',
    exportPolicy: 'skin',
    placement: {
      mode: 'segment-fraction',
      startJointId: spec.parentId,
      endJointId: spec.endJointId,
      fraction: 0.5,
    },
    driver: {
      mode: 'swing-twist-distribution',
      sourceJointId: spec.parentId,
      endJointId: spec.endJointId,
      twistWeight: 0.5,
      preserveSwingOnSource: true,
    },
  })),
  ...CONTROL_SPECS.map((spec) => ({
    id: spec.id,
    label: spec.label,
    parentId: 'root',
    side: spec.side ?? 'center',
    category: 'control',
    role: 'control',
    rigTier: 'body-production',
    visualShape: spec.id.includes('Pole') ? 'pole' : spec.id.includes('FootRoll') ? 'foot-roll' : 'control',
    visibilityLayer: 'controls',
    deformInfluence: false,
    physicalBone: false,
    isControl: true,
    followJointId: spec.sourceJointId,
    controlOffset: spec.offset,
    solverParticipation: 'none',
    collisionRole: 'none',
    exportPolicy: 'rig',
    placement: {
      mode: spec.placementMode,
      sourceJointId: spec.sourceJointId,
      offset: spec.offset,
      scaleWithBodyHeight: true,
    },
  })),
  ...CONTACT_MARKER_SPECS.map((spec) => ({
    id: spec.id,
    label: spec.label,
    parentId: spec.parentId,
    side: spec.side,
    category: 'marker',
    role: 'marker',
    rigTier: 'body-production',
    visualShape: 'contact',
    visibilityLayer: 'measurements',
    deformInfluence: false,
    physicalBone: false,
    followJointId: spec.sourceJointId,
    controlOffset: spec.offset,
    solverParticipation: 'passive-endpoint',
    collisionRole: 'contact-marker',
    exportPolicy: 'editor',
    placement: {
      mode: spec.placementMode,
      sourceJointId: spec.sourceJointId,
      source: spec.source,
      offset: spec.offset,
      resolveFromBoundSurface: true,
    },
  })),
]);

export const OPTIONAL_BODY_CORRECTIVE_NODE_DEFINITIONS = deepFreeze(SIDES.map((side) => ({
  id: `${side}ScapulaCorrective`,
  label: `${SIDE_LABEL[side]}肩胛校正`,
  parentId: 'upperChest',
  side,
  category: 'torso',
  role: 'corrective',
  rigTier: 'body-production',
  visualShape: 'corrective',
  visibilityLayer: 'deform-hidden',
  deformInfluence: true,
  physicalBone: false,
  solverParticipation: 'derived',
  collisionRole: 'none',
  exportPolicy: 'skin',
  placement: {
    mode: 'shoulder-girdle-blend',
    sourceJointId: `${side}Shoulder`,
    endJointId: `${side}UpperArm`,
    fraction: 0.45,
  },
  driver: {
    mode: 'shoulder-girdle-corrective',
    clavicleJointId: `${side}Shoulder`,
    upperArmJointId: `${side}UpperArm`,
  },
})));

export const FULL_PERFORMANCE_NODE_DEFINITIONS = deepFreeze([
  ...SIDES.flatMap((side) => FINGER_CHAINS.flatMap((chain) => chain.names.map((name, index) => ({
    id: `${side}${name}`,
    label: `${SIDE_LABEL[side]}${chain.labels[index]}`,
    parentId: index === 0 ? `${side}Hand` : `${side}${chain.names[index - 1]}`,
    side,
    category: 'hand',
    role: 'deform',
    rigTier: 'full-performance',
    visualShape: 'articulation',
    visibilityLayer: 'primary',
    deformInfluence: true,
    physicalBone: true,
    solverParticipation: 'full-body',
    collisionRole: 'none',
    exportPolicy: 'skin',
    retargetSemantic: `${side}${name}`,
    placement: {
      mode: index === 0 ? 'hand-ray-root' : 'finger-chain-segment',
      side,
      finger: chain.finger,
      segment: index,
      length: chain.lengths[index],
      resolveFromBoundSurface: true,
    },
  })))),
  {
    id: 'leftEye', label: '左眼', parentId: 'head', side: 'left', category: 'face', role: 'deform',
    rigTier: 'full-performance', visualShape: 'face', visibilityLayer: 'primary', deformInfluence: true,
    physicalBone: false, solverParticipation: 'derived', collisionRole: 'none', exportPolicy: 'skin',
    retargetSemantic: 'leftEye', placement: { mode: 'surface-anatomical-landmark', landmark: 'left-eye-center' },
  },
  {
    id: 'rightEye', label: '右眼', parentId: 'head', side: 'right', category: 'face', role: 'deform',
    rigTier: 'full-performance', visualShape: 'face', visibilityLayer: 'primary', deformInfluence: true,
    physicalBone: false, solverParticipation: 'derived', collisionRole: 'none', exportPolicy: 'skin',
    retargetSemantic: 'rightEye', placement: { mode: 'surface-anatomical-landmark', landmark: 'right-eye-center' },
  },
  {
    id: 'jaw', label: '下颌', parentId: 'head', side: 'center', category: 'face', role: 'deform',
    rigTier: 'full-performance', visualShape: 'face', visibilityLayer: 'primary', deformInfluence: true,
    physicalBone: true, solverParticipation: 'full-body', collisionRole: 'none', exportPolicy: 'skin',
    retargetSemantic: 'jaw', placement: { mode: 'surface-anatomical-landmark', landmark: 'jaw-hinge-center' },
  },
]);

export const HUMANOID_RETARGET_CHAINS = deepFreeze({
  root: ['hips'],
  spine: ['hips', 'spine', 'chest', 'upperChest'],
  neck: ['neck'],
  head: ['head'],
  leftArm: ['leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand'],
  rightArm: ['rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand'],
  leftLeg: ['leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes'],
  rightLeg: ['rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes'],
  leftThumb: ['leftThumbMetacarpal', 'leftThumbProximal', 'leftThumbDistal'],
  rightThumb: ['rightThumbMetacarpal', 'rightThumbProximal', 'rightThumbDistal'],
  leftIndex: ['leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal'],
  rightIndex: ['rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal'],
  leftMiddle: ['leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal'],
  rightMiddle: ['rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal'],
  leftRing: ['leftRingProximal', 'leftRingIntermediate', 'leftRingDistal'],
  rightRing: ['rightRingProximal', 'rightRingIntermediate', 'rightRingDistal'],
  leftLittle: ['leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal'],
  rightLittle: ['rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal'],
});

export const PRODUCTION_RIG_BLUEPRINT = deepFreeze({
  schema: 'humanoid_rig/production_rig_blueprint@2.0',
  sourceRig: 'rig@0.4.0',
  activeTopology: 'performance89@1',
  compatibilityRule: 'append-only; preserve all SMPL 24 IDs, helper IDs, ordering, and parent relationships',
  currentCore: {
    profile: 'smpl24-controls28@1', totalNodes: 28, deformJoints: 24, editorHelpers: 4,
    purpose: ['eight-dimension body proportion reconstruction', 'legacy body pose compatibility'],
  },
  bodyProduction: {
    targetRig: 'rig@0.5.0',
    topologyPolicy: 'append derived leaf nodes; do not insert nodes into the existing 28-node hierarchy',
    deformJointTarget: 32,
    totalNodeTarget: 54,
    additiveDeformJoints: TWIST_SEGMENTS.map(({ id }) => id),
    additiveControls: CONTROL_SPECS.map(({ id }) => id),
    additiveContactMarkers: CONTACT_MARKER_SPECS.map(({ id }) => id),
    optionalCorrectiveJoints: OPTIONAL_BODY_CORRECTIVE_NODE_DEFINITIONS.map(({ id }) => id),
    nodeDefinitions: BODY_PRODUCTION_NODE_DEFINITIONS,
    optionalCorrectiveNodeDefinitions: OPTIONAL_BODY_CORRECTIVE_NODE_DEFINITIONS,
    purpose: ['distributed limb twist', 'stable hand and foot IK', 'foot roll and contact-aware retargeting'],
  },
  fullPerformance: {
    targetRig: 'rig@0.6.0',
    topologyPolicy: 'append VRM-compatible fingers, eyes, and jaw after the body-production layer',
    deformJointTarget: 65,
    optionalCorrectiveJointTarget: 67,
    totalNodeTarget: 89,
    additiveFingerJointCount: 30,
    additiveFaceJoints: ['leftEye', 'rightEye', 'jaw'],
    additiveDeformJoints: FULL_PERFORMANCE_NODE_DEFINITIONS.map(({ id }) => id),
    nodeDefinitions: FULL_PERFORMANCE_NODE_DEFINITIONS,
    retargetChains: HUMANOID_RETARGET_CHAINS,
    purpose: ['finger articulation and object interaction', 'gaze and jaw motion', 'close-up character performance'],
  },
  ikGoals: [
    { id: 'leftHandIK', effector: 'leftHandEnd', pole: 'leftElbowPole', chain: 'leftArm' },
    { id: 'rightHandIK', effector: 'rightHandEnd', pole: 'rightElbowPole', chain: 'rightArm' },
    { id: 'leftFootIK', effector: 'leftFoot', pole: 'leftKneePole', chain: 'leftLeg' },
    { id: 'rightFootIK', effector: 'rightFoot', pole: 'rightKneePole', chain: 'rightLeg' },
  ],
  compatibilityInvariants: [
    'retain the existing 28 IDs in their current order',
    'retain every existing parentId and SMPL index 0 through 23',
    'keep the pre-bound SMPL surface on its original 24-bone palette',
    'allow legacy poses and clips to omit every additive joint',
  ],
});

export function buildRigCapabilityReport(summary) {
  const counts = summary?.counts || {};
  const axisAudit = summary?.axisAudit || {};
  const allIds = new Set(Object.values(summary?.idsByRole || {}).flat());
  const hasAll = (ids) => ids.every((id) => allIds.has(id));
  const twistReady = hasAll(PRODUCTION_RIG_BLUEPRINT.bodyProduction.additiveDeformJoints);
  const ikReady = hasAll(PRODUCTION_RIG_BLUEPRINT.bodyProduction.additiveControls);
  const contactReady = hasAll(PRODUCTION_RIG_BLUEPRINT.bodyProduction.additiveContactMarkers);
  const fingerReady = hasAll(FULL_PERFORMANCE_NODE_DEFINITIONS.filter((item) => item.category === 'hand').map((item) => item.id));
  const faceReady = hasAll(['leftEye', 'rightEye', 'jaw']);
  const current = {
    profile: summary?.profile?.id || 'smpl24-controls28@1',
    nativeRig: summary?.profile?.nativeRig || summary?.profile?.compatibleRig || 'rig@0.4.0',
    compatibleRig: summary?.profile?.compatibleRig || 'rig@0.4.0',
    totalNodes: Number(counts.total || 0),
    deformJoints: Number(counts.deform || 0),
    controls: Number(counts.control || 0),
    markers: Number(counts.marker || 0),
    correctiveJoints: Number(counts.corrective || 0),
    visibleJoints: Number(counts.visibleJoints || 0),
    hiddenJoints: Array.isArray(summary?.hiddenJointIds) ? summary.hiddenJointIds.length : 0,
    jointAxesComplete: axisAudit.complete === true,
    jointAxesOrthonormal: axisAudit.orthonormal === true,
    jointAxesRuntimeApplied: axisAudit.runtimeApplied === true,
  };

  const missing = [];
  if (!twistReady) missing.push('8 limb twist deform joints');
  if (!ikReady) missing.push('hand, foot, pole, foot-roll, center-of-mass, and gaze controls');
  if (!contactReady) missing.push('heel, forefoot, and palm contact markers');
  if (!fingerReady) missing.push('30 VRM-compatible finger joints');
  if (!faceReady) missing.push('left eye, right eye, and jaw joints');
  if (Number(counts.corrective || 0) < 2) missing.push('left and right scapula corrective joints');

  return {
    schema: 'humanoid_rig/rig_capability_report@2.0',
    current,
    capability: {
      proportionReconstruction: summary?.countMatchesProfile ? 'ready' : 'blocked',
      basicBodyPose: current.jointAxesComplete && current.jointAxesOrthonormal ? 'ready' : 'limited',
      detailedBodyMotion: twistReady ? 'ready' : 'limited-no-twist-joints',
      footGrounding: ikReady && contactReady ? 'ready-controls-and-contacts' : 'limited-no-foot-ik',
      handPerformance: fingerReady ? 'ready' : 'not-covered',
      facePerformance: faceReady ? 'ready' : 'not-covered',
      legacyClipCompatibility: 'ready-append-only',
    },
    missing,
    blueprint: PRODUCTION_RIG_BLUEPRINT,
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}
