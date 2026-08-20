import {
  compressAnimationClip,
  createEmptyClip,
  getActiveClip,
  normalizeAnimationState,
  serializeMotionClip,
  upsertTrackKeyframe,
  validateAnimationClip,
} from './model.js';
import { sampleAnimationRuntime } from './runtime.js';
import { identityQuaternion, quaternionAngularDistance } from './quaternion.js';

const IDENTITY_EPSILON = 1e-10;

/**
 * Samples the animation session after layer blending, joint limits, foot locks,
 * and the selected runtime mode, then writes a deterministic local-quaternion
 * clip. Binding lengths, hierarchy, skin weights, and inverse bind matrices
 * remain outside this operation.
 */
export function bakeAnimationSession(animationInput, bodyProfile = {}, {
  source = 'final_pose',
  sampleRate = 30,
  includeRootMotion = true,
  includeEvents = true,
  includeContacts = true,
  quaternionToleranceDegrees = 0.35,
  positionToleranceMeters = 0.001,
  clipId = null,
  name = null,
  targetRig = 'rig@0.4.0',
  targetProportionRevision = 0,
} = {}) {
  const animation = normalizeAnimationState(animationInput, {
    compatibleRig: targetRig,
    targetProportionRevision,
  });
  const sourceClip = getActiveClip(animation);
  const rate = clamp(Number(sampleRate) || 30, 1, 120);
  const frameCount = Math.max(1, Math.ceil(sourceClip.duration * rate));
  let baked = createEmptyClip({
    clipId: clipId || `${sourceClip.clipId}-baked`,
    name: name || `${sourceClip.name} Baked`,
    duration: sourceClip.duration,
    compatibleRig: targetRig,
    sourceProportionRevision: targetProportionRevision,
    loopMode: sourceClip.loopMode,
    rootMotionMode: includeRootMotion ? sourceClip.rootMotionMode : 'in_place',
    rootJointId: sourceClip.rootJointId,
    metadata: {
      status: 'baked',
      bakedFrom: sourceClip.clipId,
      bakeSource: source,
      sampleRate: rate,
      sourceBodyHeight: Number(bodyProfile?.height || sourceClip.metadata?.sourceBodyHeight || 1.795672),
      generatedAt: new Date().toISOString(),
    },
    retargetPolicy: sourceClip.retargetPolicy,
  });

  let previousFinalPose = null;
  let maxBoneLengthError = 0;
  let maxContactError = 0;
  let maxJointLimitClampCount = 0;
  for (let frameIndex = 0; frameIndex <= frameCount; frameIndex += 1) {
    const time = frameIndex === frameCount ? sourceClip.duration : Math.min(sourceClip.duration, frameIndex / rate);
    const runtimeFrame = sampleAnimationRuntime(animation, {
      rawTime: time,
      nowMs: time * 1000,
      bodyProfile,
      rigVersion: targetRig,
      previousFinalPose,
      deltaTime: 1 / rate,
    });
    previousFinalPose = runtimeFrame.finalPose;
    const pose = source === 'desired_pose' ? runtimeFrame.desiredPose : runtimeFrame.finalPose;
    maxBoneLengthError = Math.max(maxBoneLengthError, runtimeFrame.diagnostics.maxBoneLengthError || 0);
    maxContactError = Math.max(maxContactError, runtimeFrame.diagnostics.maxContactError || 0);
    maxJointLimitClampCount = Math.max(maxJointLimitClampCount, runtimeFrame.diagnostics.jointLimitClampCount || 0);

    for (const [jointId, joint] of Object.entries(pose.joints)) {
      const sourceHasTrack = sourceClip.tracks.some((track) => track.jointId === jointId && track.channel === 'rotation');
      if (!sourceHasTrack && quaternionAngularDistance(joint.rotation, identityQuaternion()) < IDENTITY_EPSILON) continue;
      baked = upsertTrackKeyframe(baked, {
        jointId,
        channel: 'rotation',
        time,
        value: joint.rotation,
        keyframeId: `${jointId}-baked-${frameIndex + 1}`,
      });
    }
    if (quaternionAngularDistance(pose.root.rotation, identityQuaternion()) >= IDENTITY_EPSILON
      || sourceClip.tracks.some((track) => track.jointId === sourceClip.rootJointId && track.channel === 'rotation')) {
      baked = upsertTrackKeyframe(baked, {
        jointId: sourceClip.rootJointId,
        channel: 'rotation',
        time,
        value: pose.root.rotation,
        keyframeId: `${sourceClip.rootJointId}-rotation-baked-${frameIndex + 1}`,
      });
    }
    if (includeRootMotion && pose.root.position) {
      baked = upsertTrackKeyframe(baked, {
        jointId: sourceClip.rootJointId,
        channel: 'position',
        time,
        value: pose.root.position,
        keyframeId: `${sourceClip.rootJointId}-position-baked-${frameIndex + 1}`,
      });
    }
  }

  baked.events = includeEvents ? structuredClone(sourceClip.events) : [];
  baked.contacts = includeContacts ? structuredClone(sourceClip.contacts) : [];
  baked.quality = {
    validated: true,
    maxBoneLengthError,
    maxContactError,
    maxJointAngularVelocity: measureMaxAngularVelocity(baked),
    warnings: maxJointLimitClampCount
      ? [`Joint limits clamped up to ${maxJointLimitClampCount} joints in a sampled frame.`]
      : [],
  };
  baked = compressAnimationClip(baked, {
    quaternionToleranceDegrees,
    positionToleranceMeters,
  });
  const report = validateAnimationClip(baked);
  if (!report.valid) throw new Error(`Baked clip failed validation: ${report.errors.join(', ')}`);
  return {
    clip: baked,
    report,
    stats: {
      sourceFrames: frameCount + 1,
      outputTracks: baked.tracks.length,
      outputKeyframes: baked.tracks.reduce((total, track) => total + track.keyframes.length, 0),
      maxBoneLengthError,
      maxContactError,
      maxJointLimitClampCount,
      maxJointAngularVelocity: baked.quality.maxJointAngularVelocity,
    },
  };
}

export function bakeAnimationSessionToMotionClip(animationInput, bodyProfile = {}, options = {}) {
  const result = bakeAnimationSession(animationInput, bodyProfile, options);
  return {
    ...result,
    asset: serializeMotionClip(result.clip, {
      projectId: options.projectId || 'humanoid-rig-lab-next',
      subjectId: options.subjectId || 'default-character',
    }),
  };
}

export function measureMaxAngularVelocity(clip) {
  let maximum = 0;
  for (const track of clip.tracks || []) {
    if (track.channel !== 'rotation') continue;
    for (let index = 1; index < track.keyframes.length; index += 1) {
      const previous = track.keyframes[index - 1];
      const current = track.keyframes[index];
      const delta = Math.max(1e-6, current.time - previous.time);
      maximum = Math.max(maximum, quaternionAngularDistance(previous.value, current.value) / delta);
    }
  }
  return maximum;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
