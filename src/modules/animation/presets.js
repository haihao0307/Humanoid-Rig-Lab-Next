import { ensureQuaternionContinuity, quaternionFromEuler } from './quaternion.js';
import { ANATOMICAL_MOTION_BASIS, solveDirectedLocalRotations } from './anatomical-motion.js';
import { mapSemanticMotionValues, resolveSemanticMotionChannel } from './asset-metadata.js';

const INTERNAL_CLIP_SCHEMA = 'humanoid_rig/animation_clip@0.4';
const MOTION = Object.freeze({
  body: resolveSemanticMotionChannel('bodyLean').joints,
  breathing: resolveSemanticMotionChannel('breathing').joints,
  head: resolveSemanticMotionChannel('headGesture').joints,
  leftArm: resolveSemanticMotionChannel('leftArmSwing').joints,
  rightArm: resolveSemanticMotionChannel('rightArmSwing').joints,
  leftLeg: resolveSemanticMotionChannel('leftLegStep').joints,
  rightLeg: resolveSemanticMotionChannel('rightLegStep').joints,
  feet: resolveSemanticMotionChannel('footContact').joints,
});

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
      rotationTrack(MOTION.breathing.lower, [[0, q(0, 0, 0)], [0.8, q(-1.2, 0, 0)], [1.6, q(-2.2, 0, 0)], [2.4, q(-1.0, 0, 0)], [3.2, q(0, 0, 0)]]),
      rotationTrack(MOTION.breathing.middle, [[0, q(0, 0, 0)], [0.8, q(1.1, 0, 0)], [1.6, q(2.0, 0, 0)], [2.4, q(0.9, 0, 0)], [3.2, q(0, 0, 0)]]),
      rotationTrack(MOTION.breathing.upper, [[0, q(0, 0, 0)], [0.8, q(0.8, 0, 0)], [1.6, q(1.5, 0, 0)], [2.4, q(0.7, 0, 0)], [3.2, q(0, 0, 0)]]),
      rotationTrack(MOTION.breathing.leftAnchor, [[0, q(0, 0, 0)], [1.6, q(0, 0, -1.5)], [3.2, q(0, 0, 0)]]),
      rotationTrack(MOTION.breathing.rightAnchor, [[0, q(0, 0, 0)], [1.6, q(0, 0, 1.5)], [3.2, q(0, 0, 0)]]),
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
    [0.35, solveDirectedLocalRotations(mapSemanticMotionValues('rightArmSwing', {
      upper: [0.52, 0.72, 0.08],
      lower: [0.12, 0.98, 0.14],
      hand: [0.04, 0.99, 0.10],
    }))],
    [0.65, solveDirectedLocalRotations(mapSemanticMotionValues('rightArmSwing', {
      upper: [0.52, 0.72, 0.08],
      lower: [-0.18, 0.97, 0.14],
      hand: [-0.25, 0.95, 0.18],
    }))],
    [0.95, solveDirectedLocalRotations(mapSemanticMotionValues('rightArmSwing', {
      upper: [0.52, 0.72, 0.08],
      lower: [0.32, 0.93, 0.16],
      hand: [0.42, 0.88, 0.20],
    }))],
    [1.25, solveDirectedLocalRotations(mapSemanticMotionValues('rightArmSwing', {
      upper: [0.52, 0.72, 0.08],
      lower: [-0.18, 0.97, 0.14],
      hand: [-0.25, 0.95, 0.18],
    }))],
    [1.6, solveDirectedLocalRotations()],
  ];
  return createClip({
    clipId: 'wave',
    name: 'Right Hand Wave',
    duration: 1.6,
    compatibleRig,
    loopMode: 'repeat',
    tracks: [
      ...directedRotationTracks(waveFrames, [MOTION.rightArm.upper, MOTION.rightArm.lower, MOTION.rightArm.hand]),
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
      rotationTrack(MOTION.head.base, [[0, q(0, 0, 0)], [0.35, q(10, 0, 0)], [0.7, q(-7, 0, 0)], [1.05, q(9, 0, 0)], [1.4, q(-4, 0, 0)], [1.8, q(0, 0, 0)]]),
      rotationTrack(MOTION.head.head, [[0, q(0, 0, 0)], [0.35, q(15, 0, 0)], [0.7, q(-11, 0, 0)], [1.05, q(13, 0, 0)], [1.4, q(-6, 0, 0)], [1.8, q(0, 0, 0)]]),
      rotationTrack(MOTION.body.upper, [[0, q(0, 0, 0)], [0.7, q(-2, 0, 0)], [1.4, q(1, 0, 0)], [1.8, q(0, 0, 0)]]),
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
    ...mapSemanticMotionValues('leftLegStep', {
      upper: [-0.03, -0.64, 0.77],
      lower: [-0.02, -0.72, -0.69],
      foot: [0, -0.05, 1],
    }),
    ...mapSemanticMotionValues('rightLegStep', {
      upper: [0.03, -0.64, 0.77],
      lower: [0.02, -0.72, -0.69],
      foot: [0, -0.05, 1],
    }),
    ...mapSemanticMotionValues('leftArmSwing', {
      upper: [-0.15, -0.05, 0.99],
      lower: [-0.08, -0.12, 0.99],
    }),
    ...mapSemanticMotionValues('rightArmSwing', {
      upper: [0.15, -0.05, 0.99],
      lower: [0.08, -0.12, 0.99],
    }),
  }, {
    localRotations: mapSemanticMotionValues('bodyLean', {
      root: q(8, 0, 0),
      lower: q(4, 0, 0),
      middle: q(2, 0, 0),
    }),
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
      positionTrack(MOTION.body.root, [[0, [0, 0, 0]], [down, [0, -0.28, 0.03]], [hold, [0, -0.28, 0.03]], [end, [0, 0, 0]]]),
      ...directedRotationTracks(squatFrames, [
        MOTION.body.root, MOTION.body.lower, MOTION.body.middle,
        MOTION.leftLeg.upper, MOTION.leftLeg.lower, MOTION.leftLeg.foot,
        MOTION.rightLeg.upper, MOTION.rightLeg.lower, MOTION.rightLeg.foot,
        MOTION.leftArm.upper, MOTION.leftArm.lower,
        MOTION.rightArm.upper, MOTION.rightArm.lower,
      ]),
    ],
    events: [
      event('foot_plant', 0, { jointId: MOTION.feet.left, side: 'left' }),
      event('foot_plant', 0, { jointId: MOTION.feet.right, side: 'right' }),
      event('squat_bottom', down),
      event('foot_release', end, { jointId: MOTION.feet.left, side: 'left' }),
      event('foot_release', end, { jointId: MOTION.feet.right, side: 'right' }),
    ],
    contacts: [
      contact(MOTION.feet.left, 0, end),
      contact(MOTION.feet.right, 0, end),
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
  const times = [0, 0.15, 0.3, 0.45, 0.52, 0.6, 0.75, 0.9, 1.05, 1.12, 1.2];
  const walkFrames = times.map((time) => {
    const phase = time / duration;
    const rootPosition = [0, walkPelvisBob(phase), rootDistance * phase];
    const bodyRotations = mapSemanticMotionValues('bodyLean', {
      root: q(0, 1.5 * Math.cos(Math.PI * 2 * phase), 0),
      lower: q(1.25, -2 * Math.cos(Math.PI * 2 * phase), 0),
    });
    const directions = {
      ...mapSemanticMotionValues('leftLegStep', createCanonicalWalkLegDirections({
        side: 'left',
        phase,
        rootPosition,
        rootDistance,
      })),
      ...mapSemanticMotionValues('rightLegStep', createCanonicalWalkLegDirections({
        side: 'right',
        phase,
        rootPosition,
        rootDistance,
      })),
      ...createCanonicalWalkArmDirections(phase),
    };
    return [
      time,
      rootPosition,
      solveDirectedLocalRotations(directions, { localRotations: bodyRotations }),
    ];
  });
  const tracks = [
    positionTrack(MOTION.body.root, walkFrames.map(([time, position]) => [time, position])),
    rotationTrack(MOTION.body.root, walkFrames.map(([time, , rotations]) => [time, rotations[MOTION.body.root]])),
    rotationTrack(MOTION.body.lower, walkFrames.map(([time, , rotations]) => [time, rotations[MOTION.body.lower]])),
    ...directedRotationTracks(walkFrames.map(([time, , rotations]) => [time, rotations]), [
      MOTION.leftLeg.upper, MOTION.leftLeg.lower, MOTION.leftLeg.foot, MOTION.leftLeg.toes,
      MOTION.rightLeg.upper, MOTION.rightLeg.lower, MOTION.rightLeg.foot, MOTION.rightLeg.toes,
      MOTION.leftArm.upper, MOTION.leftArm.lower, MOTION.rightArm.upper, MOTION.rightArm.lower,
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
      event('heel_strike', 0, { jointId: MOTION.feet.left, side: 'left' }),
      event('foot_plant', 0.04, { jointId: MOTION.feet.left, side: 'left' }),
      event('toe_off', 0.48, { jointId: MOTION.feet.left, side: 'left' }),
      event('foot_release', 0.52, { jointId: MOTION.feet.left, side: 'left' }),
      event('heel_strike', 0.6, { jointId: MOTION.feet.right, side: 'right' }),
      event('foot_plant', 0.64, { jointId: MOTION.feet.right, side: 'right' }),
      event('toe_off', 1.08, { jointId: MOTION.feet.right, side: 'right' }),
      event('foot_release', 1.12, { jointId: MOTION.feet.right, side: 'right' }),
    ],
    contacts: [
      contact(MOTION.feet.left, 0, 0.52),
      contact(MOTION.feet.right, 0.6, 1.12),
    ],
    metadata: {
      status: 'validated-demo',
      category: 'locomotion',
      sourceBodyHeight: 1.795672,
      strideLength: rootDistance,
      authoringBasis: ANATOMICAL_MOTION_BASIS,
      authoringMethod: 'canonical-phase-mirrored-directed-leg-chain',
      gait: {
        phases: ['heel_strike', 'loading', 'mid_stance', 'toe_off', 'early_swing', 'mid_swing', 'late_swing'],
        supportContactEnd: 0.52,
        mirroredPhaseOffset: 0.6,
        footTrajectory: 'two-bone-target-with-swing-clearance',
        rootMotionAxis: '+Z',
      },
    },
  });
}

const WALK_CONTACT_END_PHASE = 0.52 / 1.2;
const WALK_STEP_LEAD = 0.30;
const WALK_ANKLE_X = 0.16;
const WALK_ANKLE_Y = 0.15;
const WALK_SWING_BACK = 0.40;
const WALK_IN_PLACE_SWING_BACK = 0.70;
const WALK_SWING_CLEARANCE = 0.075;
const WALK_UPPER_LEG_LENGTH = Math.hypot(0.01, 0.425, 0.014);
const WALK_LOWER_LEG_LENGTH = Math.hypot(0.05, 0.4, 0.004);

function createCanonicalWalkLegDirections({ side, phase, rootPosition, rootDistance }) {
  const sideSign = side === 'right' ? 1 : -1;
  const phaseOffset = side === 'right' ? 0.5 : 0;
  const cycle = phase >= 1 - 1e-8 ? 1 : 0;
  const normalizedPhase = phase - cycle;
  const sidePhase = wrapUnit(normalizedPhase - phaseOffset);
  const rawProgress = sidePhase <= WALK_CONTACT_END_PHASE
    ? 0
    : clampNumber((sidePhase - WALK_CONTACT_END_PHASE) / (1 - WALK_CONTACT_END_PHASE), 0, 1);
  const progress = smoothstep(rawProgress);
  const swingArc = walkSwingArc(rawProgress);
  const contactAdvance = rootDistance;
  const contactBase = WALK_STEP_LEAD + phaseOffset * contactAdvance + cycle * contactAdvance;
  const segmentStart = contactBase - (normalizedPhase < phaseOffset ? contactAdvance : 0);
  const target = [
    sideSign * WALK_ANKLE_X,
    WALK_ANKLE_Y + WALK_SWING_CLEARANCE * Math.sin(Math.PI * progress),
    segmentStart + contactAdvance * progress
      - (contactAdvance > 0 ? WALK_SWING_BACK : WALK_IN_PLACE_SWING_BACK) * swingArc,
  ];
  const hip = [
    sideSign * 0.1,
    0.925 + rootPosition[1],
    rootPosition[2] + 0.016,
  ];
  const knee = solveCanonicalWalkKnee(hip, target, sideSign);
  const upper = normalizeVector(subtractVector(knee, hip));
  const lower = normalizeVector(subtractVector(target, knee));
  const foot = normalizeVector([sideSign * 0.13, -0.53, 1]);
  const toes = normalizeVector([0, -0.05, 1]);
  return { upper, lower, foot, toes };
}

function solveCanonicalWalkKnee(hip, ankle, sideSign) {
  const toAnkle = subtractVector(ankle, hip);
  const rawDistance = vectorLength(toAnkle);
  const maximum = WALK_UPPER_LEG_LENGTH + WALK_LOWER_LEG_LENGTH - 1e-5;
  const minimum = Math.abs(WALK_UPPER_LEG_LENGTH - WALK_LOWER_LEG_LENGTH) + 1e-5;
  const solvedDistance = clampNumber(rawDistance, minimum, maximum);
  const direction = normalizeVector(toAnkle);
  const projected = subtractVector([0, 0, 1], scaleVector(direction, dotVector([0, 0, 1], direction)));
  const fallback = normalizeVector(crossVector([sideSign, 0, 0], direction));
  const bendDirection = vectorLength(projected) > 1e-5 ? normalizeVector(projected) : fallback;
  const along = (WALK_UPPER_LEG_LENGTH ** 2 - WALK_LOWER_LEG_LENGTH ** 2 + solvedDistance ** 2)
    / (2 * solvedDistance);
  const perpendicular = Math.sqrt(Math.max(0, WALK_UPPER_LEG_LENGTH ** 2 - along ** 2));
  return addVector(
    addVector(hip, scaleVector(direction, along)),
    scaleVector(bendDirection, perpendicular),
  );
}

function createCanonicalWalkArmDirections(phase) {
  const swing = -0.42 * Math.cos(Math.PI * 2 * phase);
  return {
    ...mapSemanticMotionValues('leftArmSwing', {
      upper: [-0.23, -0.90, swing],
      lower: [-0.12, -0.95, swing * 0.76],
    }),
    ...mapSemanticMotionValues('rightArmSwing', {
      upper: [0.23, -0.90, -swing],
      lower: [0.12, -0.95, -swing * 0.76],
    }),
  };
}

function walkPelvisBob(phase) {
  return 0.014 * Math.sin(Math.PI * 2 * phase);
}

function wrapUnit(value) {
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

function smoothstep(value) {
  const t = clampNumber(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function walkSwingArc(progress) {
  if (progress <= 0 || progress >= 1) return 0;
  return Math.sin(Math.PI * smoothstep(Math.sqrt(progress)));
}

function subtractVector(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function addVector(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scaleVector(value, scale) {
  return [value[0] * scale, value[1] * scale, value[2] * scale];
}

function dotVector(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function crossVector(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function vectorLength(value) {
  return Math.hypot(value[0], value[1], value[2]);
}

function normalizeVector(value) {
  const length = vectorLength(value);
  return length > 1e-8 ? scaleVector(value, 1 / length) : [0, -1, 0];
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
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
      mask: [
        MOTION.body.upper, MOTION.head.base, MOTION.head.head,
        MOTION.leftArm.anchor, MOTION.leftArm.upper, MOTION.leftArm.lower, MOTION.leftArm.hand,
        MOTION.rightArm.anchor, MOTION.rightArm.upper, MOTION.rightArm.lower, MOTION.rightArm.hand,
      ],
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
      mask: [
        MOTION.breathing.lower, MOTION.breathing.middle, MOTION.breathing.upper,
        MOTION.breathing.leftAnchor, MOTION.breathing.rightAnchor,
      ],
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
  rootJointId = MOTION.body.root,
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
