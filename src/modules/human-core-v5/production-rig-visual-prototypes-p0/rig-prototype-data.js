export const RIG_PROTOTYPE_DATA_SCHEMA = 'humanoid_rig/production_rig_visual_prototype_data@p0';

export const P0_SOURCE = Object.freeze({
  baselineCommit: 'e342f0a3eed8d0c185c46814e663c497b0b8d47a',
  coreRigFingerprint: 'fnv1a-8f257f74',
  referencePose: 'reference-t',
  sourcePoseSchema: 'humanoid_rig/pose_frame@4.0',
  staticSnapshot: true,
  connectsRuntimeFinalPose: false,
  modifiesHumanRigCore: false,
  modifiesFinalPose: false,
});

export const P0_BODY_INPUT = Object.freeze({
  height: 1.795672,
  shoulderWidth: 0.42,
  hipWidth: 0.20,
  units: 'meters',
});

export const P0_CORE_JOINTS = Object.freeze([
  joint('hips', 'root', [0, 0.93, 0.016]),
  joint('spine', 'hips', [0, 1.06, 0.04]),
  joint('chest', 'spine', [0, 1.195, 0.021]),
  joint('upperChest', 'chest', [0, 1.34, 0.002]),
  joint('neck', 'upperChest', [0, 1.495, -0.01]),
  joint('head', 'neck', [0, 1.635, 0.055]),
  joint('leftShoulder', 'upperChest', [-0.105, 1.401481704596, 0.014]),
  joint('rightShoulder', 'upperChest', [0.105, 1.401481704596, 0.014]),
  joint('leftUpperArm', 'leftShoulder', [-0.21, 1.328680605703, -0.001]),
  joint('rightUpperArm', 'rightShoulder', [0.21, 1.328680605703, -0.001]),
  joint('leftLowerArm', 'leftUpperArm', [-0.487218325513, 1.328680605703, -0.001]),
  joint('rightLowerArm', 'rightUpperArm', [0.487218325513, 1.328680605703, -0.001]),
  joint('leftHand', 'leftLowerArm', [-0.728620479604, 1.328680605703, -0.001]),
  joint('rightHand', 'rightLowerArm', [0.728620479604, 1.328680605703, -0.001]),
  joint('leftUpperLeg', 'hips', [-0.1, 0.93, 0.016]),
  joint('rightUpperLeg', 'hips', [0.1, 0.93, 0.016]),
  joint('leftLowerLeg', 'leftUpperLeg', [-0.11, 0.505, 0.002]),
  joint('rightLowerLeg', 'rightUpperLeg', [0.11, 0.505, 0.002]),
  joint('leftFoot', 'leftLowerLeg', [-0.16, 0.105, -0.002]),
  joint('rightFoot', 'rightLowerLeg', [0.16, 0.105, -0.002]),
]);

export const P0_CORE_SEGMENTS = Object.freeze([
  segment('hips', 'spine'), segment('spine', 'chest'), segment('chest', 'upperChest'), segment('upperChest', 'neck'), segment('neck', 'head'),
  segment('upperChest', 'leftShoulder'), segment('leftShoulder', 'leftUpperArm'), segment('leftUpperArm', 'leftLowerArm'), segment('leftLowerArm', 'leftHand'),
  segment('upperChest', 'rightShoulder'), segment('rightShoulder', 'rightUpperArm'), segment('rightUpperArm', 'rightLowerArm'), segment('rightLowerArm', 'rightHand'),
  segment('hips', 'leftUpperLeg'), segment('leftUpperLeg', 'leftLowerLeg'), segment('leftLowerLeg', 'leftFoot'),
  segment('hips', 'rightUpperLeg'), segment('rightUpperLeg', 'rightLowerLeg'), segment('rightLowerLeg', 'rightFoot'),
]);

export const P0_VIEW_SPECS = Object.freeze({
  front: view('front', [0, 0, 1]),
  side: view('side', [1, 0, 0]),
  back: view('back', [0, 0, -1]),
  'three-quarter': view('three-quarter', [0.707106781187, 0, 0.707106781187]),
});

export const P0_CANVAS = Object.freeze({
  width: 900,
  height: 1100,
  worldCenter: Object.freeze([0, 0.92, 0]),
  orthographicWidthMeters: 1.82,
  orthographicHeightMeters: 2.04,
  background: '#071018',
  ground: '#29404c',
  edge: '#dce6e5',
  baselineStrokePx: 1.6,
});

export const P0_CANDIDATES = Object.freeze({
  OCTA_TECH: Object.freeze({
    id: 'OCTA_TECH',
    directory: 'candidate-a',
    name: 'Technical Octahedral Rig',
    goal: 'Professional, clear, lightweight, high-NPC-count diagnostic display.',
    strengths: ['root/tip hierarchy', 'roll readability', 'low primitive count', 'stable silhouette'],
    weaknesses: ['limited anatomical recognition', 'minimal shoulder/pelvis semantics'],
    estimatedCost: 'LOW',
    suitable: 'large NPC groups, topology and transform inspection',
    unsuitable: 'fine anatomical motion review and animator-facing control editing',
  }),
  HYBRID_PRODUCTION: Object.freeze({
    id: 'HYBRID_PRODUCTION',
    directory: 'candidate-b',
    name: 'Hybrid Production Rig',
    goal: 'Human-readable semi-anatomical observation with production-friendly cost.',
    strengths: ['strong human recognition', 'open thorax and pelvis semantics', 'dual forearm/lower-leg rails', 'clear palm and foot structure'],
    weaknesses: ['more primitives than A', 'not an animation control surface'],
    estimatedCost: 'MEDIUM-LOW',
    suitable: 'motion observation and future salute, jump, carry research',
    unsuitable: 'dense crowd debugging where the smallest possible rig proxy is required',
  }),
  CONTROL_STUDIO: Object.freeze({
    id: 'CONTROL_STUDIO',
    directory: 'candidate-c',
    name: 'Animation Control Studio Rig',
    goal: 'Clear animator controls for future timeline and motion editing.',
    strengths: ['control intent is explicit', 'IK and pole targets are easy to scan', 'future editor affinity'],
    weaknesses: ['lower anatomical recognition', 'highest overlay density', 'not ideal for large NPC groups'],
    estimatedCost: 'MEDIUM',
    suitable: 'future animation editor and selected-character authoring',
    unsuitable: 'unselected NPC visualization and anatomy-first motion review',
  }),
});

export function createP0RigSnapshot() {
  const joints = P0_CORE_JOINTS.map((item) => ({ ...item, worldPosition: [...item.worldPosition] }));
  const byId = new Map(joints.map((item) => [item.id, item]));
  const segments = P0_CORE_SEGMENTS.map((item) => {
    const start = byId.get(item.parentId).worldPosition;
    const end = byId.get(item.childId).worldPosition;
    return { ...item, start: [...start], end: [...end], length: distance(start, end) };
  });
  return {
    schema: RIG_PROTOTYPE_DATA_SCHEMA,
    source: { ...P0_SOURCE },
    body: { ...P0_BODY_INPUT },
    joints,
    segments,
    jointCount: joints.length,
    segmentCount: segments.length,
  };
}

function joint(id, sourceParentId, worldPosition) {
  return Object.freeze({ id, sourceParentId, worldPosition: Object.freeze(worldPosition), worldQuaternion: Object.freeze([0, 0, 0, 1]) });
}

function segment(parentId, childId) {
  return Object.freeze({ id: `${parentId}->${childId}`, parentId, childId });
}

function view(id, cameraDirection) {
  return Object.freeze({ id, cameraDirection: Object.freeze(cameraDirection), worldUp: Object.freeze([0, 1, 0]) });
}

function distance(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}
