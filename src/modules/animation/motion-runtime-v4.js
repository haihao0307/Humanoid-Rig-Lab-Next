import { createPoseFrameV4, isPoseFrameV4 } from '../pose/pose-frame-v4.js';
import {
  adaptLegacyMotionClipV1,
  assertMotionClipV4,
  createMotionClipV4,
  isMotionClipV4,
} from './motion-clip-v4.js';
import { PhaseLocomotionRuntime } from './phase-locomotion-v4.js';
import {
  additiveQuaternion,
  lerpVector,
  multiplyQuaternions,
  normalizeQuaternion,
  slerpQuaternion,
} from './quaternion.js';
import {
  buildMotionContactIkTargets,
  createMotionRetargetProfile,
  retargetMotionClipV4,
} from './motion-retarget-v4.js';

export const MOTION_RUNTIME_V4_FRAME_SCHEMA = 'humanoid_rig/motion_runtime_frame@4.0';
const IDENTITY = Object.freeze([0, 0, 0, 1]);

/**
 * AnimationRig-only V4 runtime. It owns clip sampling, layers, and action
 * state, then emits desiredPose. It never writes Skin or simulationRig.
 */
export class AnimationRigRuntime {
  constructor({
    rigVersion = 'rig@0.4.0',
    proportionRevision = 0,
    rootJointId = 'hips',
  } = {}) {
    this.rigVersion = String(rigVersion);
    this.proportionRevision = revision(proportionRevision);
    this.rootJointId = String(rootJointId);
    this.clips = new Map();
    this.activeClipId = null;
    this.layers = new Map();
    this.phaseRuntime = new PhaseLocomotionRuntime();
    this.retargetProfile = null;
    this.desiredPose = null;
    this.lastFrame = null;
  }

  loadClip(input, { activate = true, retargetProfile = null } = {}) {
    if (isMotionClipV4(input)) assertMotionClipV4(input);
    let clip = isMotionClipV4(input) ? createMotionClipV4(input) : adaptLegacyMotionClipV1(input);
    assertMotionClipV4(clip);
    if (clip.sourceRigVersion !== this.rigVersion) {
      throw new Error(`MotionClip rig ${clip.sourceRigVersion} is incompatible with AnimationRig ${this.rigVersion}.`);
    }
    if (retargetProfile) {
      this.retargetProfile = createMotionRetargetProfile(retargetProfile);
      if (this.retargetProfile.targetRigVersion !== this.rigVersion) {
        throw new Error(`Motion retarget target rig ${this.retargetProfile.targetRigVersion} does not match AnimationRig ${this.rigVersion}.`);
      }
      if (this.retargetProfile.sourceProportionRevision !== clip.sourceProportionRevision) {
        throw new Error(`Motion retarget source proportion r${this.retargetProfile.sourceProportionRevision} does not match clip r${clip.sourceProportionRevision}.`);
      }
      clip = retargetMotionClipV4(clip, this.retargetProfile);
    }
    this.clips.set(clip.clipId, clip);
    if (activate || !this.activeClipId) this.setActiveClip(clip.clipId);
    return structuredClone(clip);
  }

  setActiveClip(clipId) {
    if (!this.clips.has(clipId)) throw new Error(`MotionClip ${clipId} is not loaded.`);
    this.activeClipId = clipId;
    const clip = this.clips.get(clipId);
    this.phaseRuntime.load(clip.phaseData, clip.duration);
    return clipId;
  }

  setLayer(layerId, input = {}) {
    const clipId = String(input.clipId || '');
    if (clipId && !this.clips.has(clipId)) throw new Error(`Motion layer clip ${clipId} is not loaded.`);
    const layer = {
      layerId: String(layerId),
      clipId,
      enabled: input.enabled !== false,
      weight: clamp(Number(input.weight), 0, 1, 1),
      blendMode: input.blendMode === 'additive' ? 'additive' : 'override',
      mask: Array.isArray(input.mask) && input.mask.length ? input.mask.map(String) : ['*'],
      timeScale: finite(input.timeScale, 1),
      timeOffset: finite(input.timeOffset, 0),
      affectsRoot: input.affectsRoot === true,
      priority: Math.floor(finite(input.priority, 0)),
    };
    this.layers.set(layer.layerId, layer);
    return structuredClone(layer);
  }

  setPhase(phase = null) {
    return this.phaseRuntime.setPhase(phase);
  }

  sample(rawTime = 0, {
    timestamp = Number(rawTime) * 1000,
    proportionRevision = this.retargetProfile?.targetProportionRevision ?? this.proportionRevision,
    ikTargets = [],
  } = {}) {
    if (!this.activeClipId) throw new Error('AnimationRigRuntime requires loadClip() before sample().');
    const baseClip = this.clips.get(this.activeClipId);
    const base = sampleMotionClipV4(baseClip, rawTime, { phaseRuntime: this.phaseRuntime });
    const layerSamples = [...this.layers.values()]
      .filter((layer) => layer.enabled && layer.clipId && layer.clipId !== this.activeClipId)
      .sort((left, right) => left.priority - right.priority)
      .map((layer) => ({
        ...sampleMotionClipV4(this.clips.get(layer.clipId), rawTime * layer.timeScale + layer.timeOffset),
        layer,
      }));
    const blended = blendMotionSamples([{ ...base, layer: { weight: 1, blendMode: 'override', mask: ['*'], affectsRoot: true } }, ...layerSamples]);
    const contactTargets = buildMotionContactIkTargets(blended.contacts);
    const desiredPose = createPoseFrameV4({
      compatibleRig: this.rigVersion,
      rootJointId: this.rootJointId,
      rootPosition: blended.rootPosition,
      rootRotation: blended.rootRotation,
      localRotations: blended.localRotations,
      contacts: blended.contacts,
      ikTargets: [...contactTargets, ...structuredClone(ikTargets)],
      constraintState: {
        stage: 'animation-rig-desired-pose',
        sourceClipId: baseClip.clipId,
        sourceSchema: baseClip.schema,
        phaseLocomotion: base.phase,
        rootMotionOwner: 'motion-runtime-v4',
        contactOwner: 'motion-runtime-v4',
        balanceApplied: false,
        physicsFollowApplied: false,
      },
      proportionRevision: revision(proportionRevision),
      timestamp,
    });
    this.desiredPose = desiredPose;
    this.lastFrame = {
      schema: MOTION_RUNTIME_V4_FRAME_SCHEMA,
      schemaVersion: 4,
      type: 'MotionRuntimeFrame',
      rawTime: Number(rawTime) || 0,
      sampledTime: base.time,
      activeClipId: baseClip.clipId,
      animationRig: {
        rigVersion: this.rigVersion,
        input: { type: 'MotionClip', schema: baseClip.schema, clipId: baseClip.clipId },
        desiredPose,
      },
      desiredPose,
      phase: base.phase,
      contacts: structuredClone(blended.contacts),
      events: structuredClone(base.events),
      diagnostics: {
        poseAuthority: 'local-quaternion-v4',
        rootSpace: 'character_local',
        layerCount: layerSamples.length + 1,
        normalizedQuaternionCount: Object.keys(desiredPose.localRotations).length + 1,
        writesSkin: false,
        writesSimulationRig: false,
      },
    };
    return structuredClone(this.lastFrame);
  }

  blend(inputs, options = {}) {
    const samples = inputs.map((input, index) => {
      const pose = isPoseFrameV4(input?.pose ?? input) ? (input.pose ?? input) : null;
      if (!pose) throw new Error(`Motion blend input ${index} must contain PoseFrame V4.`);
      return {
        rootPosition: [...pose.rootPosition],
        rootRotation: [...pose.rootRotation],
        localRotations: structuredClone(pose.localRotations),
        contacts: structuredClone(pose.contacts),
        layer: {
          weight: clamp(Number(input?.weight), 0, 1, index === 0 ? 1 : 0.5),
          blendMode: input?.blendMode === 'additive' ? 'additive' : 'override',
          mask: Array.isArray(input?.mask) ? input.mask : ['*'],
          affectsRoot: input?.affectsRoot === true || index === 0,
        },
      };
    });
    const blended = blendMotionSamples(samples);
    return createPoseFrameV4({
      ...blended,
      compatibleRig: this.rigVersion,
      rootJointId: this.rootJointId,
      ikTargets: options.ikTargets ?? [],
      constraintState: { stage: 'animation-rig-layer-blend' },
      proportionRevision: options.proportionRevision ?? this.proportionRevision,
      timestamp: options.timestamp ?? 0,
    });
  }

  getDesiredPose() {
    return this.desiredPose ? structuredClone(this.desiredPose) : null;
  }
}

export class MotionRuntimeV4 extends AnimationRigRuntime {}

export function sampleMotionClipV4(clipInput, rawTime = 0, { phaseRuntime = null } = {}) {
  if (isMotionClipV4(clipInput)) assertMotionClipV4(clipInput);
  const clip = createMotionClipV4(clipInput);
  assertMotionClipV4(clip);
  const phase = resolveMotionTime(rawTime, clip.duration, clip.loopMode);
  const rootPosition = sampleRootPosition(clip, phase);
  const rootRotation = sampleKeyframes(clip.rootMotion.rotationTrack.keyframes, phase.time, 'slerp');
  const localRotations = {};
  for (const track of clip.tracks) {
    localRotations[track.jointId] = sampleKeyframes(track.keyframes, phase.time, track.interpolation);
  }
  const contacts = clip.contacts
    .filter((contact) => phase.time >= contact.time - 1e-7 && phase.time <= contact.endTime + 1e-7)
    .map((contact) => ({ ...structuredClone(contact), phaseTime: phase.time, cycle: phase.cycle }));
  const events = clip.events.filter((event) => Math.abs(event.time - phase.time) <= 1e-6);
  const phaseState = phaseRuntime
    ? phaseRuntime.sample(rawTime)
    : new PhaseLocomotionRuntime().load(clip.phaseData, clip.duration).sample(rawTime);
  return {
    clipId: clip.clipId,
    time: phase.time,
    cycle: phase.cycle,
    rootPosition,
    rootRotation,
    localRotations,
    contacts,
    events,
    phase: phaseState,
  };
}

export function blendMotionSamples(samples) {
  if (!samples.length) throw new Error('At least one motion sample is required for blending.');
  const base = samples[0];
  let rootPosition = [...base.rootPosition];
  let rootRotation = [...base.rootRotation];
  const localRotations = structuredClone(base.localRotations);
  const contacts = new Map((base.contacts ?? []).map((contact) => [contact.contactId, structuredClone(contact)]));

  for (const sample of samples.slice(1)) {
    const layer = sample.layer ?? {};
    const weight = clamp(Number(layer.weight), 0, 1, 1);
    const mask = new Set(Array.isArray(layer.mask) ? layer.mask : ['*']);
    for (const [jointId, rotation] of Object.entries(sample.localRotations ?? {})) {
      if (!mask.has('*') && !mask.has(jointId)) continue;
      const current = localRotations[jointId] ?? IDENTITY;
      localRotations[jointId] = layer.blendMode === 'additive'
        ? normalizeQuaternion(multiplyQuaternions(current, additiveQuaternion(IDENTITY, rotation, weight)))
        : slerpQuaternion(current, rotation, weight);
    }
    if (layer.affectsRoot) {
      rootPosition = lerpVector(rootPosition, sample.rootPosition, weight, 3);
      rootRotation = slerpQuaternion(rootRotation, sample.rootRotation, weight);
    }
    for (const contact of sample.contacts ?? []) contacts.set(contact.contactId, structuredClone(contact));
  }
  return { rootPosition, rootRotation, localRotations, contacts: [...contacts.values()] };
}

function sampleRootPosition(clip, phase) {
  const current = sampleKeyframes(clip.rootMotion.positionTrack.keyframes, phase.time, clip.rootMotion.positionTrack.interpolation);
  if (clip.rootMotion.mode === 'in_place') return [0, current[1], 0];
  if (clip.loopMode !== 'repeat' || phase.cycle === 0) return current;
  const keys = clip.rootMotion.positionTrack.keyframes;
  const start = keys[0].value;
  const end = keys.at(-1).value;
  return current.map((value, index) => value + (end[index] - start[index]) * phase.cycle);
}

function sampleKeyframes(keys, time, interpolation) {
  if (keys.length === 1 || time <= keys[0].time) return [...keys[0].value];
  if (time >= keys.at(-1).time) return [...keys.at(-1).value];
  let rightIndex = 1;
  while (rightIndex < keys.length && keys[rightIndex].time < time) rightIndex += 1;
  const left = keys[rightIndex - 1];
  const right = keys[rightIndex];
  if (interpolation === 'step') return [...left.value];
  const alpha = (time - left.time) / Math.max(1e-8, right.time - left.time);
  return left.value.length === 4
    ? slerpQuaternion(left.value, right.value, alpha)
    : lerpVector(left.value, right.value, alpha, 3);
}

function resolveMotionTime(rawTime, duration, loopMode) {
  const time = Number(rawTime) || 0;
  if (loopMode !== 'repeat') return { time: Math.min(duration, Math.max(0, time)), cycle: 0 };
  return { time: positiveModulo(time, duration), cycle: Math.floor(time / duration) };
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function revision(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum, fallback) {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}
