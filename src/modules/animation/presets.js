import { ensureQuaternionContinuity, quaternionFromEuler } from './quaternion.js';
import { ANATOMICAL_MOTION_BASIS, solveDirectedLocalRotations } from './anatomical-motion.js';

const INTERNAL_CLIP_SCHEMA = 'humanoid_rig/animation_clip@0.4';

export const BUILT_IN_CLIP_IDS = Object.freeze([
  'idle-breathe',
  'wave',
  'head-nod',
  'squat',
  'walk-in-place',
  'walk-forward',
  'custom',
]);

export function createBuiltInAnimationClips({ compatibleRig = 'rig@0.4.0' } = {}) {
  return [
    createIdleBreathePreset({ compatibleRig }),
    createWaveRightPreset({ compatibleRig }),
    createHeadNodPreset({ compatibleRig }),
    createSquatPreset({ compatibleRig }),
    createWalkPreset({ compatibleRig, rootMotion: false }),
    createWalkPreset({ compatibleRig, rootMotion: true }),
    createClip({
      clipId: 'custom',
      name: 'Custom Draft',
      duration: 2,
      compatibleRig,
      loopMode: 'once',
      metadata: { status: 'editable-draft', category: 'custom' },
    }),
  ];
}

export function createIdleBreathePreset({ compatibleRig = 'rig@0.4.0' } = {}) {
  return createClip({
    clipId: 'idle-breathe',
    name: 'Idle Breathe',
    duration: 3.2,
    compatibleRig,
    loopMode: 'repeat',
    tracks: [
      rotationTrack('spine', [[0, q(0, 0, 0)], [0.8, q(-1.2, 0, 0)], [1.6, q(-2.2, 0, 0)], [2.4, q(-1.0, 0, 0)], [3.2, q(0, 0, 0)]]),
      rotationTrack('chest', [[0, q(0, 0, 0)], [0.8, q(1.1, 0, 0)], [1.6, q(2.0, 0, 0)], [2.4, q(0.9, 0, 0)], [3.2, q(0, 0, 0)]]),
      rotationTrack('upperChest', [[0, q(0, 0, 0)], [0.8, q(0.8, 0, 0)], [1.6, q(1.5, 0, 0)], [2.4, q(0.7, 0, 0)], [3.2, q(0, 0, 0)]]),
      rotationTrack('leftShoulder', [[0, q(0, 0, 0)], [1.6, q(0, 0, -1.5)], [3.2, q(0, 0, 0)]]),
      rotationTrack('rightShoulder', [[0, q(0, 0, 0)], [1.6, q(0, 0, 1.5)], [3.2, q(0, 0, 0)]]),
    ],
    events: [
      event('breath_in', 0.8),
      event('breath_peak', 1.6),
      event('breath_out', 2.4),
    ],
    metadata: {
      status: 'validated-demo',
      category: 'idle',
      additiveFriendly: true,
      sourceBodyHeight: 1.795672,
    },
  });
}

export function createWaveRightPreset({ compatibleRig = 'rig@0.4.0' } = {}) {
  const waveFrames = [
    [0, solveDirectedLocalRotations()],
    [0.35, solveDirectedLocalRotations({
      rightUpperArm: [0.52, 0.72, 0.08],
      rightLowerArm: [0.12, 0.98, 0.14],
      rightHand: [0.04, 0.99, 0.10],
    })],
    [0.65, solveDirectedLocalRotations({
      rightUpperArm: [0.52, 0.72, 0.08],
      rightLowerArm: [-0.18, 0.97, 0.14],
      rightHand: [-0.25, 0.95, 0.18],
    })],
    [0.95, solveDirectedLocalRotations({
      rightUpperArm: [0.52, 0.72, 0.08],
      rightLowerArm: [0.32, 0.93, 0.16],
      rightHand: [0.42, 0.88, 0.20],
    })],
    [1.25, solveDirectedLocalRotations({
      rightUpperArm: [0.52, 0.72, 0.08],
      rightLowerArm: [-0.18, 0.97, 0.14],
      rightHand: [-0.25, 0.95, 0.18],
    })],
    [1.6, solveDirectedLocalRotations()],
  ];
  return createClip({
    clipId: 'wave',
    name: 'Right Hand Wave',
    duration: 1.6,
    compatibleRig,
    loopMode: 'repeat',
    tracks: [
      ...directedRotationTracks(waveFrames, ['rightUpperArm', 'rightLowerArm', 'rightHand']),
    ],
    events: [
      event('gesture_start', 0.35),
      event('marker', 0.65, { label: 'wave_inward' }),
      event('marker', 0.95, { label: 'wave_outward' }),
      event('gesture_end', 1.6),
    ],
    metadata: {
      status: 'validated-demo',
      category: 'gesture',
      authoritativeChannels: 'local-quaternion',
      authoringBasis: ANATOMICAL_MOTION_BASIS,
      authoringMethod: 'directed-bone-chain',
      sourceBodyHeight: 1.795672,
    },
  });
}

export function createHeadNodPreset({ compatibleRig = 'rig@0.4.0' } = {}) {
  return createClip({
    clipId: 'head-nod',
    name: 'Head Nod',
    duration: 1.8,
    compatibleRig,
    loopMode: 'once',
    tracks: [
      rotationTrack('neck', [[0, q(0, 0, 0)], [0.35, q(10, 0, 0)], [0.7, q(-7, 0, 0)], [1.05, q(9, 0, 0)], [1.4, q(-4, 0, 0)], [1.8, q(0, 0, 0)]]),
      rotationTrack('head', [[0, q(0, 0, 0)], [0.35, q(15, 0, 0)], [0.7, q(-11, 0, 0)], [1.05, q(13, 0, 0)], [1.4, q(-6, 0, 0)], [1.8, q(0, 0, 0)]]),
      rotationTrack('upperChest', [[0, q(0, 0, 0)], [0.7, q(-2, 0, 0)], [1.4, q(1, 0, 0)], [1.8, q(0, 0, 0)]]),
    ],
    events: [event('gesture_start', 0), event('nod_down', 0.35), event('nod_up', 0.7), event('gesture_end', 1.8)],
    metadata: { status: 'validated-demo', category: 'gesture', sourceBodyHeight: 1.795672 },
  });
}

export function createSquatPreset({ compatibleRig = 'rig@0.4.0' } = {}) {
  const down = 1.05;
  const hold = 1.45;
  const end = 2.5;
  const bottomRotations = solveDirectedLocalRotations({
    leftUpperLeg: [-0.03, -0.64, 0.77],
    leftLowerLeg: [-0.02, -0.72, -0.69],
    leftFoot: [0, -0.05, 1],
    rightUpperLeg: [0.03, -0.64, 0.77],
    rightLowerLeg: [0.02, -0.72, -0.69],
    rightFoot: [0, -0.05, 1],
    leftUpperArm: [-0.15, -0.05, 0.99],
    leftLowerArm: [-0.08, -0.12, 0.99],
    rightUpperArm: [0.15, -0.05, 0.99],
    rightLowerArm: [0.08, -0.12, 0.99],
  }, {
    localRotations: {
      hips: q(8, 0, 0),
      spine: q(4, 0, 0),
      chest: q(2, 0, 0),
    },
  });
  const squatFrames = [
    [0, solveDirectedLocalRotations()],
    [down, bottomRotations],
    [hold, bottomRotations],
    [end, solveDirectedLocalRotations()],
  ];
  return createClip({
    clipId: 'squat',
    name: 'Squat And Stand',
    duration: end,
    compatibleRig,
    loopMode: 'once',
    rootMotionMode: 'in_place',
    tracks: [
      positionTrack('hips', [[0, [0, 0, 0]], [down, [0, -0.28, 0.03]], [hold, [0, -0.28, 0.03]], [end, [0, 0, 0]]]),
      ...directedRotationTracks(squatFrames, [
        'hips', 'spine', 'chest',
        'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
        'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
        'leftUpperArm', 'leftLowerArm',
        'rightUpperArm', 'rightLowerArm',
      ]),
    ],
    events: [
      event('foot_plant', 0, { jointId: 'leftFoot', side: 'left' }),
      event('foot_plant', 0, { jointId: 'rightFoot', side: 'right' }),
      event('squat_bottom', down),
      event('foot_release', end, { jointId: 'leftFoot', side: 'left' }),
      event('foot_release', end, { jointId: 'rightFoot', side: 'right' }),
    ],
    contacts: [
      contact('leftFoot', 0, end),
      contact('rightFoot', 0, end),
    ],
    metadata: {
      status: 'validated-demo',
      category: 'locomotion',
      sourceBodyHeight: 1.795672,
      authoringBasis: ANATOMICAL_MOTION_BASIS,
      authoringMethod: 'directed-bone-chain',
    },
  });
}

export function createWalkPreset({ compatibleRig = 'rig@0.4.0', rootMotion = false } = {}) {
  const duration = 1.2;
  const clipId = rootMotion ? 'walk-forward' : 'walk-in-place';
  const name = rootMotion ? 'Walk Forward' : 'Walk In Place';
  const rootDistance = rootMotion ? 0.72 : 0;
  const times = [0, 0.3, 0.6, 0.9, 1.2];
  const walkBaseRotations = [
    { hips: q(0, 1.5, 0), spine: q(1.5, -2, 0) },
    { hips: q(0, 0, 0), spine: q(1, 0, 0) },
    { hips: q(0, -1.5, 0), spine: q(1.5, 2, 0) },
    { hips: q(0, 0, 0), spine: q(1, 0, 0) },
    { hips: q(0, 1.5, 0), spine: q(1.5, -2, 0) },
  ];
  const walkArmDirections = [
    {
      leftUpperArm: [-0.22, -0.88, -0.42], leftLowerArm: [-0.12, -0.94, -0.32],
      rightUpperArm: [0.22, -0.88, 0.42], rightLowerArm: [0.12, -0.94, 0.32],
    },
    {
      leftUpperArm: [-0.25, -0.97, 0], leftLowerArm: [-0.18, -0.98, 0.04],
      rightUpperArm: [0.25, -0.97, 0], rightLowerArm: [0.18, -0.98, 0.04],
    },
    {
      leftUpperArm: [-0.22, -0.88, 0.42], leftLowerArm: [-0.12, -0.94, 0.32],
      rightUpperArm: [0.22, -0.88, -0.42], rightLowerArm: [0.12, -0.94, -0.32],
    },
    {
      leftUpperArm: [-0.25, -0.97, 0], leftLowerArm: [-0.18, -0.98, 0.04],
      rightUpperArm: [0.25, -0.97, 0], rightLowerArm: [0.18, -0.98, 0.04],
    },
    {
      leftUpperArm: [-0.22, -0.88, -0.42], leftLowerArm: [-0.12, -0.94, -0.32],
      rightUpperArm: [0.22, -0.88, 0.42], rightLowerArm: [0.12, -0.94, 0.32],
    },
  ];
  const walkArmFrames = times.map((time, index) => [
    time,
    solveDirectedLocalRotations(walkArmDirections[index], {
      localRotations: walkBaseRotations[index],
    }),
  ]);
  const tracks = [
    positionTrack('hips', times.map((time, index) => [time, [0, index % 2 ? 0.018 : 0, rootDistance * time / duration]])),
    rotationTrack('hips', times.map((time, index) => [time, walkBaseRotations[index].hips])),
    rotationTrack('spine', times.map((time, index) => [time, walkBaseRotations[index].spine])),
    rotationTrack('leftUpperLeg', [[0, q(-25, 0, 0)], [0.3, q(0, 0, 0)], [0.6, q(25, 0, 0)], [0.9, q(5, 0, 0)], [1.2, q(-25, 0, 0)]]),
    rotationTrack('rightUpperLeg', [[0, q(25, 0, 0)], [0.3, q(5, 0, 0)], [0.6, q(-25, 0, 0)], [0.9, q(0, 0, 0)], [1.2, q(25, 0, 0)]]),
    rotationTrack('leftLowerLeg', [[0, q(8, 0, 0)], [0.3, q(45, 0, 0)], [0.6, q(5, 0, 0)], [0.9, q(15, 0, 0)], [1.2, q(8, 0, 0)]]),
    rotationTrack('rightLowerLeg', [[0, q(5, 0, 0)], [0.3, q(15, 0, 0)], [0.6, q(8, 0, 0)], [0.9, q(45, 0, 0)], [1.2, q(5, 0, 0)]]),
    rotationTrack('leftFoot', [[0, q(8, 0, 0)], [0.3, q(-10, 0, 0)], [0.6, q(-6, 0, 0)], [0.9, q(10, 0, 0)], [1.2, q(8, 0, 0)]]),
    rotationTrack('rightFoot', [[0, q(-6, 0, 0)], [0.3, q(10, 0, 0)], [0.6, q(8, 0, 0)], [0.9, q(-10, 0, 0)], [1.2, q(-6, 0, 0)]]),
    ...directedRotationTracks(walkArmFrames, [
      'leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm',
    ]),
  ];
  return createClip({
    clipId,
    name,
    duration,
    compatibleRig,
    loopMode: 'repeat',
    rootMotionMode: rootMotion ? 'root_motion' : 'in_place',
    tracks,
    events: [
      event('heel_strike', 0, { jointId: 'leftFoot', side: 'left' }),
      event('foot_plant', 0.04, { jointId: 'leftFoot', side: 'left' }),
      event('toe_off', 0.48, { jointId: 'leftFoot', side: 'left' }),
      event('foot_release', 0.52, { jointId: 'leftFoot', side: 'left' }),
      event('heel_strike', 0.6, { jointId: 'rightFoot', side: 'right' }),
      event('foot_plant', 0.64, { jointId: 'rightFoot', side: 'right' }),
      event('toe_off', 1.08, { jointId: 'rightFoot', side: 'right' }),
      event('foot_release', 1.12, { jointId: 'rightFoot', side: 'right' }),
    ],
    contacts: [
      contact('leftFoot', 0, 0.52),
      contact('rightFoot', 0.6, 1.12),
    ],
    metadata: {
      status: 'validated-demo',
      category: 'locomotion',
      sourceBodyHeight: 1.795672,
      strideLength: rootDistance,
      authoringBasis: ANATOMICAL_MOTION_BASIS,
      authoringMethod: 'directed-bone-chain',
    },
  });
}

export function createDefaultAnimationGraph() {
  return {
    schema: 'humanoid_rig/animation_graph@0.1',
    graphId: 'humanoid-basic-locomotion',
    controlMode: 'clip',
    entryStateId: 'idle',
    activeStateId: 'idle',
    parameters: {
      speed: 0,
      wave: false,
      squat: false,
    },
    states: [
      { stateId: 'idle', clipId: 'idle-breathe', loop: true, speed: 1 },
      { stateId: 'walk', clipId: 'walk-in-place', loop: true, speed: 1 },
      { stateId: 'wave', clipId: 'wave', loop: false, speed: 1 },
      { stateId: 'squat', clipId: 'squat', loop: false, speed: 1 },
    ],
    transitions: [
      transition('idle', 'walk', 0.22, [{ parameter: 'speed', operator: '>', value: 0.1 }]),
      transition('walk', 'idle', 0.22, [{ parameter: 'speed', operator: '<=', value: 0.1 }]),
      transition('*', 'wave', 0.16, [{ parameter: 'wave', operator: 'trigger', value: true }], { priority: 10 }),
      transition('wave', 'idle', 0.18, [{ parameter: 'wave', operator: 'falsy', value: false }], { exitTime: 0.92 }),
      transition('*', 'squat', 0.18, [{ parameter: 'squat', operator: 'trigger', value: true }], { priority: 9 }),
      transition('squat', 'idle', 0.2, [{ parameter: 'squat', operator: 'falsy', value: false }], { exitTime: 0.95 }),
    ],
  };
}

export function createDefaultAnimationLayers() {
  return [
    {
      layerId: 'base',
      name: 'Base Locomotion',
      enabled: true,
      clipId: null,
      weight: 1,
      blendMode: 'override',
      mask: ['*'],
      timeScale: 1,
      timeOffset: 0,
      priority: 0,
    },
    {
      layerId: 'upper-body',
      name: 'Upper Body Override',
      enabled: false,
      clipId: 'wave',
      weight: 1,
      blendMode: 'override',
      mask: ['upperChest', 'neck', 'head', 'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand'],
      timeScale: 1,
      timeOffset: 0,
      priority: 10,
    },
    {
      layerId: 'breathing-additive',
      name: 'Breathing Additive',
      enabled: false,
      clipId: 'idle-breathe',
      weight: 0.35,
      blendMode: 'additive',
      mask: ['spine', 'chest', 'upperChest', 'leftShoulder', 'rightShoulder'],
      timeScale: 1,
      timeOffset: 0,
      priority: 20,
      referenceTime: 0,
    },
  ];
}

function createClip({
  clipId,
  name,
  duration,
  compatibleRig,
  loopMode = 'once',
  rootMotionMode = 'in_place',
  rootJointId = 'hips',
  tracks = [],
  events = [],
  contacts = [],
  metadata = {},
}) {
  return {
    schema: INTERNAL_CLIP_SCHEMA,
    type: 'AnimationClip',
    clipId,
    name,
    clipRevision: 1,
    compatibleRig,
    sourceProportionRevision: Number(metadata.sourceProportionRevision || 0),
    duration,
    sampleRateHint: 30,
    loopMode,
    rootMotionMode,
    rootJointId,
    tracks,
    poseKeys: [],
    poseSnapshots: [],
    events,
    contacts,
    metadata: {
      workspaceAlias: 'AnimationClip',
      motionClipExport: 'humanoid_rig/motion_clip@1.0',
      ...metadata,
    },
    retargetPolicy: {
      mode: 'local_rotation',
      scaleRootMotionByHeight: true,
      preserveContacts: true,
      clampJointLimits: true,
    },
    quality: {
      validated: true,
      maxBoneLengthError: 0,
      warnings: [],
    },
  };
}

function rotationTrack(jointId, entries) {
  const values = ensureQuaternionContinuity(entries.map((entry) => entry[1]));
  return {
    trackId: `${jointId}:rotation`,
    jointId,
    channel: 'rotation',
    space: 'local',
    interpolation: 'slerp',
    keyframes: entries.map((entry, index) => ({
      id: `${jointId}-rotation-${index + 1}`,
      time: entry[0],
      value: values[index],
      sourceSnapshotId: null,
    })),
  };
}

function directedRotationTracks(frames, jointIds) {
  return jointIds.map((jointId) => rotationTrack(
    jointId,
    frames.map(([time, rotations]) => [time, rotations[jointId] || [0, 0, 0, 1]]),
  ));
}

function positionTrack(jointId, entries) {
  return {
    trackId: `${jointId}:position`,
    jointId,
    channel: 'position',
    space: 'root',
    interpolation: 'linear',
    keyframes: entries.map((entry, index) => ({
      id: `${jointId}-position-${index + 1}`,
      time: entry[0],
      value: [...entry[1]],
      sourceSnapshotId: null,
    })),
  };
}

function event(type, time, payload = null) {
  return { id: `event-${type}-${String(time).replace('.', '-')}`, time, type, payload };
}

function contact(jointId, start, end) {
  return {
    id: `contact-${jointId}-${String(start).replace('.', '-')}`,
    jointId,
    start,
    end,
    mode: 'world_lock',
    positionWeight: 1,
    rotationWeight: 0.65,
  };
}

function transition(fromStateId, toStateId, duration, conditions, options = {}) {
  return {
    transitionId: `${fromStateId}-to-${toStateId}`,
    fromStateId,
    toStateId,
    duration,
    conditions,
    priority: options.priority || 0,
    exitTime: options.exitTime ?? null,
  };
}

function q(xDegrees = 0, yDegrees = 0, zDegrees = 0) {
  const scale = Math.PI / 180;
  return quaternionFromEuler([xDegrees * scale, yDegrees * scale, zDegrees * scale], 'XYZ');
}
