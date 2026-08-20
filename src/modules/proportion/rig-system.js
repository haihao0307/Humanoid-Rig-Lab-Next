const TWIST_SEGMENTS = Object.freeze([
  ['leftUpperArmTwist', 'leftUpperArm', 'leftLowerArm'],
  ['rightUpperArmTwist', 'rightUpperArm', 'rightLowerArm'],
  ['leftForearmTwist', 'leftLowerArm', 'leftHand'],
  ['rightForearmTwist', 'rightLowerArm', 'rightHand'],
  ['leftThighTwist', 'leftUpperLeg', 'leftLowerLeg'],
  ['rightThighTwist', 'rightUpperLeg', 'rightLowerLeg'],
  ['leftCalfTwist', 'leftLowerLeg', 'leftFoot'],
  ['rightCalfTwist', 'rightLowerLeg', 'rightFoot'],
]);

const CONTROL_SPECS = Object.freeze([
  ['centerOfMass', 'root', 'copy-bind-world', 'hips'],
  ['leftHandIK', 'root', 'copy-bind-world', 'leftHandEnd'],
  ['rightHandIK', 'root', 'copy-bind-world', 'rightHandEnd'],
  ['leftElbowPole', 'root', 'bend-plane-offset', 'leftLowerArm'],
  ['rightElbowPole', 'root', 'bend-plane-offset', 'rightLowerArm'],
  ['leftFootIK', 'root', 'copy-bind-world', 'leftFoot'],
  ['rightFootIK', 'root', 'copy-bind-world', 'rightFoot'],
  ['leftKneePole', 'root', 'bend-plane-offset', 'leftLowerLeg'],
  ['rightKneePole', 'root', 'bend-plane-offset', 'rightLowerLeg'],
  ['leftFootRoll', 'root', 'surface-grounded-foot-pivot', 'leftFoot'],
  ['rightFootRoll', 'root', 'surface-grounded-foot-pivot', 'rightFoot'],
  ['gazeTarget', 'root', 'head-forward-target', 'head'],
]);

const CONTACT_MARKER_SPECS = Object.freeze([
  ['leftHeelContact', 'leftFoot', 'surface-extreme', 'heel'],
  ['rightHeelContact', 'rightFoot', 'surface-extreme', 'heel'],
  ['leftBallContact', 'leftFoot', 'project-joint-to-sole', 'leftToes'],
  ['rightBallContact', 'rightFoot', 'project-joint-to-sole', 'rightToes'],
  ['leftPalmGrip', 'leftHandEnd', 'surface-center', 'palm'],
  ['rightPalmGrip', 'rightHandEnd', 'surface-center', 'palm'],
]);

const FINGER_NAMES = Object.freeze(['Thumb', 'Index', 'Middle', 'Ring', 'Little']);
const SIDES = Object.freeze(['left', 'right']);

export const BODY_PRODUCTION_NODE_DEFINITIONS = deepFreeze([
  ...TWIST_SEGMENTS.map(([id, parentId, endJointId]) => ({
    id,
    parentId,
    role: 'deform',
    visibilityLayer: 'deform-hidden',
    deformInfluence: true,
    solverParticipation: 'derived',
    collisionRole: 'none',
    exportPolicy: 'skin',
    placement: {
      mode: 'segment-fraction',
      startJointId: parentId,
      endJointId,
      fraction: 0.5,
    },
    driver: {
      mode: 'swing-twist-distribution',
      sourceJointId: parentId,
      endJointId,
      twistWeight: 0.5,
      preserveSwingOnSource: true,
    },
  })),
  ...CONTROL_SPECS.map(([id, parentId, placementMode, sourceJointId]) => ({
    id,
    parentId,
    role: 'control',
    visibilityLayer: 'controls',
    deformInfluence: false,
    solverParticipation: 'none',
    collisionRole: 'none',
    exportPolicy: 'rig',
    placement: {
      mode: placementMode,
      sourceJointId,
      scaleWithBodyHeight: true,
    },
  })),
  ...CONTACT_MARKER_SPECS.map(([id, parentId, placementMode, source]) => ({
    id,
    parentId,
    role: 'marker',
    visibilityLayer: 'measurements',
    deformInfluence: false,
    solverParticipation: 'passive-endpoint',
    collisionRole: 'contact-marker',
    exportPolicy: 'editor',
    placement: {
      mode: placementMode,
      source,
      resolveFromBoundSurface: true,
    },
  })),
]);

export const OPTIONAL_BODY_CORRECTIVE_NODE_DEFINITIONS = deepFreeze([
  {
    id: 'leftScapulaCorrective',
    parentId: 'upperChest',
    role: 'corrective',
    visibilityLayer: 'deform-hidden',
    deformInfluence: true,
    solverParticipation: 'derived',
    collisionRole: 'none',
    exportPolicy: 'skin',
    placement: {
      mode: 'surface-anatomical-landmark',
      landmark: 'left-scapula-body',
    },
    driver: {
      mode: 'shoulder-girdle-corrective',
      clavicleJointId: 'leftShoulder',
      upperArmJointId: 'leftUpperArm',
    },
  },
  {
    id: 'rightScapulaCorrective',
    parentId: 'upperChest',
    role: 'corrective',
    visibilityLayer: 'deform-hidden',
    deformInfluence: true,
    solverParticipation: 'derived',
    collisionRole: 'none',
    exportPolicy: 'skin',
    placement: {
      mode: 'surface-anatomical-landmark',
      landmark: 'right-scapula-body',
    },
    driver: {
      mode: 'shoulder-girdle-corrective',
      clavicleJointId: 'rightShoulder',
      upperArmJointId: 'rightUpperArm',
    },
  },
]);

export const FULL_PERFORMANCE_NODE_DEFINITIONS = deepFreeze([
  ...SIDES.flatMap((side) => FINGER_NAMES.flatMap((finger) => [1, 2, 3].map((segment) => ({
    id: `${side}${finger}${segment}`,
    parentId: segment === 1 ? `${side}HandEnd` : `${side}${finger}${segment - 1}`,
    role: 'deform',
    visibilityLayer: 'deform-hidden',
    deformInfluence: true,
    solverParticipation: 'full-body',
    collisionRole: 'none',
    exportPolicy: 'skin',
    placement: {
      mode: segment === 1 ? 'palm-ray-root' : 'finger-chain-segment',
      side,
      finger: finger.toLowerCase(),
      segment,
      resolveFromBoundSurface: true,
    },
  })))),
  {
    id: 'leftEye',
    parentId: 'head',
    role: 'deform',
    visibilityLayer: 'deform-hidden',
    deformInfluence: true,
    solverParticipation: 'derived',
    collisionRole: 'none',
    exportPolicy: 'skin',
    placement: { mode: 'surface-anatomical-landmark', landmark: 'left-eye-center' },
  },
  {
    id: 'rightEye',
    parentId: 'head',
    role: 'deform',
    visibilityLayer: 'deform-hidden',
    deformInfluence: true,
    solverParticipation: 'derived',
    collisionRole: 'none',
    exportPolicy: 'skin',
    placement: { mode: 'surface-anatomical-landmark', landmark: 'right-eye-center' },
  },
  {
    id: 'jaw',
    parentId: 'head',
    role: 'deform',
    visibilityLayer: 'deform-hidden',
    deformInfluence: true,
    solverParticipation: 'full-body',
    collisionRole: 'none',
    exportPolicy: 'skin',
    placement: { mode: 'surface-anatomical-landmark', landmark: 'jaw-hinge-center' },
  },
]);

export const PRODUCTION_RIG_BLUEPRINT = deepFreeze({
  schema: 'humanoid_rig/production_rig_blueprint@1.1',
  sourceRig: 'rig@0.4.0',
  compatibilityRule: 'append-only; preserve all current SMPL 24 IDs, helper IDs, ordering, and parent relationships',
  currentCore: {
    profile: 'smpl24-controls28@1',
    totalNodes: 28,
    deformJoints: 24,
    editorHelpers: 4,
    purpose: [
      'eight-dimension body proportion reconstruction',
      'basic body pose editing',
      'simple full-body IK prototype',
    ],
  },
  bodyProduction: {
    targetRig: 'rig@0.5.0',
    topologyPolicy: 'append derived leaf nodes; do not insert nodes into the existing 28-node hierarchy',
    deformJointTarget: 32,
    additiveDeformJoints: TWIST_SEGMENTS.map(([id]) => id),
    additiveControls: CONTROL_SPECS.map(([id]) => id),
    additiveContactMarkers: CONTACT_MARKER_SPECS.map(([id]) => id),
    optionalCorrectiveJoints: OPTIONAL_BODY_CORRECTIVE_NODE_DEFINITIONS.map(({ id }) => id),
    nodeDefinitions: BODY_PRODUCTION_NODE_DEFINITIONS,
    optionalCorrectiveNodeDefinitions: OPTIONAL_BODY_CORRECTIVE_NODE_DEFINITIONS,
    compatibilityInvariants: [
      'retain the existing 28 IDs in their current order',
      'retain every existing parentId',
      'retain SMPL standard indices 0 through 23',
      'retain hidden clavicle handles and visible clavicle bone segments',
      'drive twist nodes from local swing-twist decomposition without pose position tracks',
    ],
    purpose: [
      'axis-aware body animation',
      'distributed limb twist',
      'stable hand and foot IK',
      'foot roll and ground contact',
    ],
  },
  fullPerformance: {
    targetRig: 'rig@0.6.0',
    topologyPolicy: 'append finger, eye, and jaw chains after rig@0.5.0 compatibility is complete',
    deformJointTarget: 65,
    additiveFingerJointCount: 30,
    additiveFaceJoints: ['leftEye', 'rightEye', 'jaw'],
    additiveDeformJoints: FULL_PERFORMANCE_NODE_DEFINITIONS.map(({ id }) => id),
    nodeDefinitions: FULL_PERFORMANCE_NODE_DEFINITIONS,
    optionalCorrectiveJointTarget: 67,
    purpose: [
      'finger articulation and object interaction',
      'gaze and jaw motion',
      'close-up character performance',
    ],
  },
  activationPrerequisites: [
    'publish the local joint-axis and local-quaternion adapter',
    'generate compatible SkinBinding weights and inverse-bind matrices',
    'extend pose and animation retarget maps without renaming existing IDs',
    'add renderer visibility layers for deform, control, marker, corrective, and collision roles',
    'pass cross-module compatibility tests before changing activeVersions.rig',
  ],
});

export function buildRigCapabilityReport(summary) {
  const counts = summary?.counts || {};
  const axisAudit = summary?.axisAudit || {};
  const current = {
    profile: summary?.profile?.id || 'smpl24-controls28@1',
    compatibleRig: summary?.profile?.compatibleRig || 'rig@0.4.0',
    totalNodes: Number(counts.total || 0),
    deformJoints: Number(counts.deform || 0),
    controls: Number(counts.control || 0),
    markers: Number(counts.marker || 0),
    visibleJoints: Number(counts.visibleJoints || 0),
    hiddenJoints: Array.isArray(summary?.hiddenJointIds) ? summary.hiddenJointIds.length : 0,
    jointAxesComplete: axisAudit.complete === true,
    jointAxesOrthonormal: axisAudit.orthonormal === true,
    jointAxesRuntimeApplied: axisAudit.runtimeApplied === true,
  };

  return {
    schema: 'humanoid_rig/rig_capability_report@1.0',
    current,
    capability: {
      proportionReconstruction: summary?.countMatchesProfile ? 'ready' : 'blocked',
      basicBodyPose: current.jointAxesComplete && current.jointAxesOrthonormal
        ? 'ready-for-adapter'
        : 'limited',
      detailedBodyMotion: 'limited-no-twist-joints',
      footGrounding: 'limited-no-foot-ik',
      handPerformance: 'not-covered',
      facePerformance: 'not-covered',
    },
    missing: [
      '8 limb twist deform joints',
      'hand and foot IK controls',
      'heel and forefoot contact markers',
      '30 finger joints',
      'left eye, right eye, and jaw joints',
      'production SkinBinding for the expanded topology',
    ],
    blueprint: PRODUCTION_RIG_BLUEPRINT,
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}
