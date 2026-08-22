import { createFaceIdentity } from './face-profile.js';
import { normalizeFaceExpression } from './face-expression.js';
import { createFaceExpressionRuntimeDescriptor } from './face-runtime-descriptor.js';

export const FACE_PREVIEW_FRAME_SCHEMA = 'humanoid_rig/face_preview_frame@1.0';

export function createFacePreviewFrame(expressionInput = {}, profileInput = {}) {
  const expression = normalizeFaceExpression(expressionInput);
  const profile = createFaceIdentity(toFaceIdentityInput(profileInput));
  const runtimeDescriptor = createFaceExpressionRuntimeDescriptor(expression);
  const channels = expression.channels;
  const left = sidePreview(channels, 'Left');
  const right = sidePreview(channels, 'Right');
  const mouthSmile = average(channels.mouthSmileLeft, channels.mouthSmileRight);
  const mouthFrown = average(channels.mouthFrownLeft, channels.mouthFrownRight);
  const mouthOpen = Math.max(channels.mouthOpen, channels.jawOpen * 0.72);
  const mouthPucker = average(channels.mouthPuckerLeft, channels.mouthPuckerRight);
  const cheekPuff = Math.max(channels.cheekPuff, channels.cheekPuffLeft, channels.cheekPuffRight);

  return {
    schema: FACE_PREVIEW_FRAME_SCHEMA,
    expressionRevision: expression.expressionRevision,
    source: 'face-system-expression-runtime',
    runtimeDescriptor,
    profile: {
      face_id: profile.face_id,
      face_shape: structuredClone(profile.face_shape),
      eye_shape: structuredClone(profile.eye_shape),
      mouth_shape: structuredClone(profile.mouth_shape),
    },
    surface: {
      faceScaleX: clamp(0.9 + profile.face_shape.width * 0.2 + cheekPuff * 0.055, 0.8, 1.18),
      faceScaleY: clamp(0.92 + profile.face_shape.height * 0.18 + channels.jawOpen * 0.04, 0.82, 1.2),
      jawDrop: clamp(channels.jawOpen * 0.18, 0, 0.2),
      jawShift: clamp((channels.jawRight - channels.jawLeft) * 0.12, -0.12, 0.12),
      cheekPuffLeft: clamp(Math.max(channels.cheekPuff, channels.cheekPuffLeft), 0, 1),
      cheekPuffRight: clamp(Math.max(channels.cheekPuff, channels.cheekPuffRight), 0, 1),
    },
    eyes: { left, right },
    brows: {
      left: browPreview(channels, 'Left'),
      right: browPreview(channels, 'Right'),
    },
    mouth: {
      smile: clamp(mouthSmile, 0, 1),
      frown: clamp(mouthFrown, 0, 1),
      open: clamp(mouthOpen, 0, 1),
      pucker: clamp(mouthPucker, 0, 1),
      tightener: average(channels.lipTightenerLeft, channels.lipTightenerRight),
      shift: clamp((channels.mouthSmileRight - channels.mouthSmileLeft) * 0.12, -0.12, 0.12),
    },
    morphWeights: structuredClone(channels),
    correctiveWeights: {
      smileOpen: clamp(mouthSmile * mouthOpen, 0, 1),
      angryBrow: clamp(average(channels.browAngryLeft, channels.browAngryRight) + average(channels.browDownLeft, channels.browDownRight) * 0.5, 0, 1),
      cheekSmile: clamp(mouthSmile * cheekPuff * 0.5, 0, 1),
      jawMouth: clamp(channels.jawOpen * mouthOpen, 0, 1),
    },
  };
}

function sidePreview(channels, side) {
  const prefix = side === 'Left' ? 'Left' : 'Right';
  const blink = channels[`eyeBlink${prefix}`];
  const closure = channels[`eyeClosure${prefix}`];
  const squint = channels[`eyeSquint${prefix}`];
  const wide = channels[`eyeWide${prefix}`];
  const upperLidRaise = channels[`eyeUpperLidRaise${prefix}`];
  const lowerLid = channels[`eyeLowerLid${prefix}`];
  return {
    closure: clamp(Math.max(blink, closure), 0, 1),
    openness: clamp(0.56 + wide * 0.28 + upperLidRaise * 0.12 - Math.max(blink, closure) * 0.56 - squint * 0.26 - lowerLid * 0.12, 0.06, 1),
    squint: clamp(squint, 0, 1),
    wide: clamp(wide, 0, 1),
  };
}

function browPreview(channels, side) {
  const prefix = `brow`;
  const suffix = side === 'Left' ? 'Left' : 'Right';
  return {
    raise: clamp(channels[`${prefix}Raise${suffix}`] + channels.browInnerUp * 0.45, 0, 1),
    down: clamp(channels[`${prefix}Down${suffix}`], 0, 1),
    angry: clamp(channels[`${prefix}Angry${suffix}`], 0, 1),
    inner: clamp(channels[`${prefix}Inner${suffix}`], 0, 1),
  };
}

function average(left, right) {
  return (Number(left) + Number(right)) / 2;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function toFaceIdentityInput(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const result = {};
  for (const key of ['face_id', 'version', 'age', 'face_shape', 'eye_shape', 'mouth_shape', 'expression_profile']) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}
