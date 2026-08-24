import { createMotionClipV4 } from './motion-clip-v4.js';

const I = Object.freeze([0, 0, 0, 1]);
const BEND_FORWARD = Object.freeze([0.173648178, 0, 0, 0.984807753]);
const BEND_BACK = Object.freeze([-0.173648178, 0, 0, 0.984807753]);
const KNEE_BEND = Object.freeze([0.258819045, 0, 0, 0.965925826]);

export const MOTION_FOUNDATION_V4_ASSET_IDS = Object.freeze([
  'foundation-idle-v4',
  'foundation-walk-v4',
  'foundation-stop-v4',
  'foundation-turn-v4',
  'foundation-sit-v4',
  'foundation-stand-v4',
  'foundation-reach-v4',
]);

/**
 * Small deterministic contract fixtures for the first Motion Foundation
 * families. They are not mocap and deliberately report visualAcceptance=false.
 */
export function createMotionFoundationAssetsV4({
  sourceRigVersion = 'rig@0.4.0',
  sourceProportionRevision = 0,
} = {}) {
  return [
    idleClip(sourceRigVersion, sourceProportionRevision),
    walkClip(sourceRigVersion, sourceProportionRevision),
    stopClip(sourceRigVersion, sourceProportionRevision),
    turnClip(sourceRigVersion, sourceProportionRevision),
    sitClip(sourceRigVersion, sourceProportionRevision),
    standClip(sourceRigVersion, sourceProportionRevision),
    reachClip(sourceRigVersion, sourceProportionRevision),
  ];
}

function idleClip(rig, revision) {
  return fixture({
    clipId: 'foundation-idle-v4', name: 'Foundation Idle', duration: 2, rig, revision, loopMode: 'repeat',
    tracks: [track('spine', [[0, I], [2, I]])],
    contacts: [foot('idle-left', 'leftFoot', 0, 2), foot('idle-right', 'rightFoot', 0, 2)],
    phaseData: phase(false, [sample(0, 0, 'stance', 'stance', 'double_support')], []),
  });
}

function walkClip(rig, revision) {
  return fixture({
    clipId: 'foundation-walk-v4', name: 'Foundation Walk Forward', duration: 1.2, rig, revision, loopMode: 'repeat',
    rootMotionMode: 'root_motion',
    rootPositions: [[0, [0, 0, 0]], [0.3, [0, 0.015, 0.225]], [0.6, [0, 0, 0.45]], [0.9, [0, 0.015, 0.675]], [1.2, [0, 0, 0.9]]],
    tracks: [
      track('leftUpperLeg', [[0, BEND_BACK], [0.3, I], [0.6, BEND_FORWARD], [0.9, I], [1.2, BEND_BACK]]),
      track('rightUpperLeg', [[0, BEND_FORWARD], [0.3, I], [0.6, BEND_BACK], [0.9, I], [1.2, BEND_FORWARD]]),
      track('leftLowerLeg', [[0, I], [0.3, KNEE_BEND], [0.6, I], [0.9, I], [1.2, I]]),
      track('rightLowerLeg', [[0, I], [0.3, I], [0.6, I], [0.9, KNEE_BEND], [1.2, I]]),
      track('leftFoot', [[0, I], [0.6, BEND_BACK], [1.2, I]]),
      track('rightFoot', [[0, BEND_BACK], [0.6, I], [1.2, BEND_BACK]]),
    ],
    contacts: [
      foot('walk-left-a', 'leftFoot', 0, 0.36),
      foot('walk-right', 'rightFoot', 0.3, 0.9),
      foot('walk-left-b', 'leftFoot', 0.84, 1.2),
    ],
    events: [
      marker('walk-right-heel', 0.3, 'heel_strike', { foot: 'right' }),
      marker('walk-left-toe', 0.36, 'toe_off', { foot: 'left' }),
      marker('walk-left-heel', 0.84, 'heel_strike', { foot: 'left' }),
      marker('walk-right-toe', 0.9, 'toe_off', { foot: 'right' }),
    ],
    phaseData: phase(true, [
      sample(0, 0, 'stance', 'swing', 'left'),
      sample(0.3, 0.25, 'stance', 'stance', 'double_support'),
      sample(0.36, 0.3, 'swing', 'stance', 'right'),
      sample(0.84, 0.7, 'stance', 'stance', 'double_support'),
      sample(0.9, 0.75, 'stance', 'swing', 'left'),
      sample(1.2, 1, 'stance', 'swing', 'left'),
    ], [
      phaseMarker('walk-right-heel-phase', 'heel_strike', 0.3, 'right'),
      phaseMarker('walk-left-toe-phase', 'toe_off', 0.36, 'left'),
      phaseMarker('walk-left-heel-phase', 'heel_strike', 0.84, 'left'),
      phaseMarker('walk-right-toe-phase', 'toe_off', 0.9, 'right'),
    ]),
  });
}

function stopClip(rig, revision) {
  return fixture({
    clipId: 'foundation-stop-v4', name: 'Foundation Stop', duration: 1, rig, revision,
    rootMotionMode: 'root_motion',
    rootPositions: [[0, [0, 0, 0]], [0.25, [0, 0, 0.2]], [0.5, [0, 0, 0.35]], [0.75, [0, 0, 0.45]], [1, [0, 0, 0.5]]],
    tracks: [track('spine', [[0, BEND_FORWARD], [1, I]])],
    contacts: [foot('stop-left', 'leftFoot', 0.45, 1), foot('stop-right', 'rightFoot', 0.7, 1)],
    phaseData: phase(false, [
      sample(0, 0, 'swing', 'stance', 'right'),
      sample(0.45, 0.45, 'stance', 'stance', 'double_support'),
      sample(1, 1, 'stance', 'stance', 'double_support'),
    ], [phaseMarker('stop-double-support', 'double_support_start', 0.45, 'both')]),
  });
}

function turnClip(rig, revision) {
  return fixture({
    clipId: 'foundation-turn-v4', name: 'Foundation Turn Left', duration: 1, rig, revision,
    rootRotations: [
      [0, I],
      [0.333333, [0, 0.130526192, 0, 0.991444861]],
      [0.666667, [0, 0.258819045, 0, 0.965925826]],
      [1, [0, 0.382683432, 0, 0.923879533]],
    ],
    tracks: [track('spine', [[0, I], [1, I]])],
    contacts: [foot('turn-left', 'leftFoot', 0, 0.65), foot('turn-right', 'rightFoot', 0.35, 1)],
    phaseData: phase(false, [
      sample(0, 0, 'stance', 'swing', 'left'),
      sample(0.35, 0.35, 'stance', 'stance', 'double_support'),
      sample(0.65, 0.65, 'swing', 'stance', 'right'),
      sample(1, 1, 'stance', 'stance', 'double_support'),
    ], []),
  });
}

function sitClip(rig, revision) {
  return fixture({
    clipId: 'foundation-sit-v4', name: 'Foundation Sit', duration: 1.4, rig, revision,
    rootPositions: [[0, [0, 0, 0]], [1.4, [0, -0.42, -0.12]]],
    tracks: [
      track('leftUpperLeg', [[0, I], [1.4, [0.5, 0, 0, 0.866025404]]]),
      track('rightUpperLeg', [[0, I], [1.4, [0.5, 0, 0, 0.866025404]]]),
      track('leftLowerLeg', [[0, I], [1.4, [0.5, 0, 0, 0.866025404]]]),
      track('rightLowerLeg', [[0, I], [1.4, [0.5, 0, 0, 0.866025404]]]),
    ],
    contacts: [foot('sit-left', 'leftFoot', 0, 1.4), foot('sit-right', 'rightFoot', 0, 1.4)],
    phaseData: phase(false, [sample(0, 0, 'stance', 'stance', 'double_support'), sample(1.4, 1, 'stance', 'stance', 'double_support')], []),
  });
}

function standClip(rig, revision) {
  return fixture({
    clipId: 'foundation-stand-v4', name: 'Foundation Stand', duration: 1.4, rig, revision,
    rootPositions: [[0, [0, -0.42, -0.12]], [1.4, [0, 0, 0]]],
    tracks: [
      track('leftUpperLeg', [[0, [0.5, 0, 0, 0.866025404]], [1.4, I]]),
      track('rightUpperLeg', [[0, [0.5, 0, 0, 0.866025404]], [1.4, I]]),
      track('leftLowerLeg', [[0, [0.5, 0, 0, 0.866025404]], [1.4, I]]),
      track('rightLowerLeg', [[0, [0.5, 0, 0, 0.866025404]], [1.4, I]]),
    ],
    contacts: [foot('stand-left', 'leftFoot', 0, 1.4), foot('stand-right', 'rightFoot', 0, 1.4)],
    phaseData: phase(false, [sample(0, 0, 'stance', 'stance', 'double_support'), sample(1.4, 1, 'stance', 'stance', 'double_support')], []),
  });
}

function reachClip(rig, revision) {
  return fixture({
    clipId: 'foundation-reach-v4', name: 'Foundation Reach Right', duration: 1.2, rig, revision,
    tracks: [
      track('rightUpperArm', [[0, I], [0.8, [0, 0, -0.382683432, 0.923879533]], [1.2, [0, 0, -0.382683432, 0.923879533]]]),
      track('rightLowerArm', [[0, I], [0.8, BEND_FORWARD], [1.2, BEND_FORWARD]]),
    ],
    contacts: [
      foot('reach-left-foot', 'leftFoot', 0, 1.2),
      foot('reach-right-foot', 'rightFoot', 0, 1.2),
      hand('reach-right-hand', 'rightHand', 0.8, 1.2, [0.45, 1.15, 0.5]),
    ],
    phaseData: phase(false, [sample(0, 0, 'stance', 'stance', 'double_support'), sample(1.2, 1, 'stance', 'stance', 'double_support')], []),
  });
}

function fixture({
  clipId, name, duration, rig, revision, loopMode = 'once', rootMotionMode = 'in_place',
  rootPositions = [[0, [0, 0, 0]]], rootRotations = [[0, I]], tracks = [], contacts = [], events = [], phaseData,
}) {
  return createMotionClipV4({
    clipId, name, duration, sourceRigVersion: rig, sourceProportionRevision: revision, loopMode,
    rootJointId: 'hips',
    rootMotion: {
      mode: rootMotionMode,
      space: 'character_local',
      positionTrack: { interpolation: 'linear', keyframes: rootPositions.map(([time, value]) => ({ time, value })) },
      rotationTrack: { interpolation: 'slerp', keyframes: rootRotations.map(([time, value]) => ({ time, value })) },
    },
    tracks,
    contacts,
    events,
    phaseData,
    quality: {
      status: 'development-contract-fixture',
      source: 'explicit-local-quaternion-test-data',
      validated: true,
      visualAcceptance: false,
      warnings: ['Not captured motion and not approved as a production human-motion asset.'],
    },
    metadata: {
      family: clipId.replace('foundation-', '').replace('-v4', ''),
      coordinateSystem: { handedness: 'right', upAxis: '+Y', forwardAxis: '+Z', rightAxis: '+X' },
      runtimeRole: 'motion-foundation-contract-fixture',
    },
  });
}

function track(jointId, entries) {
  return {
    trackId: `${jointId}-local-rotation`,
    jointId,
    type: 'joint_local_quaternion',
    space: 'local',
    interpolation: 'slerp',
    keyframes: entries.map(([time, value]) => ({ time, value: [...value] })),
  };
}

function foot(contactId, jointId, time, endTime) {
  return { contactId, contactType: 'foot_contact', jointId, time, endTime, position: [0, 0, 0], normal: [0, 1, 0], confidence: 1 };
}

function hand(contactId, jointId, time, endTime, position) {
  return { contactId, contactType: 'hand_contact', jointId, time, endTime, position, normal: [0, 0, -1], confidence: 0.8 };
}

function marker(eventId, time, eventType, payload) {
  return { eventId, time, eventType, payload };
}

function sample(time, phaseValue, leftFootState, rightFootState, supportState) {
  return { time, phase: phaseValue, leftFootState, rightFootState, supportState };
}

function phaseMarker(markerId, markerType, time, footValue) {
  return { markerId, markerType, time, foot: footValue };
}

function phase(cyclic, samples, markers) {
  return { cyclic, samples, markers };
}
