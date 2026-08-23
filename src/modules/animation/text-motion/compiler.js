import {
  createEmptyClip,
  normalizeAnimationState,
  normalizeClip,
  sampleAnimationClip,
  upsertTrackKeyframe,
  validateAnimationClip,
} from '../model.js';
import { mirrorSemanticMotionChannels } from '../asset-metadata.js';
import { createRigContext, resolveAnatomicalRotation } from '../runtime.js';
import { solveDirectedLocalRotations } from '../anatomical-motion.js';
import { mirrorQuaternionSagittal } from '../quaternion.js';
import { createDefaultMotionSkillRegistry } from './skill-registry.js';

const IDENTITY = Object.freeze([0, 0, 0, 1]);
const ROOT_JOINT_ID = 'hips';
const MIRROR_JOINTS = Object.freeze({
  leftShoulder: 'rightShoulder', rightShoulder: 'leftShoulder',
  leftUpperArm: 'rightUpperArm', rightUpperArm: 'leftUpperArm',
  leftLowerArm: 'rightLowerArm', rightLowerArm: 'leftLowerArm',
  leftHand: 'rightHand', rightHand: 'leftHand',
  leftHandEnd: 'rightHandEnd', rightHandEnd: 'leftHandEnd',
  leftUpperLeg: 'rightUpperLeg', rightUpperLeg: 'leftUpperLeg',
  leftLowerLeg: 'rightLowerLeg', rightLowerLeg: 'leftLowerLeg',
  leftFoot: 'rightFoot', rightFoot: 'leftFoot',
  leftToes: 'rightToes', rightToes: 'leftToes',
  leftToesEnd: 'rightToesEnd', rightToesEnd: 'leftToesEnd',
});

export function compileActionPlan(plan, {
  animationInput = {},
  bodyProfile = {},
  rigVersion = 'rig@0.4.0',
  sourceText = '',
  registry = createDefaultMotionSkillRegistry(),
  targetProportionRevision = 0,
} = {}) {
  if (!plan || plan.status === 'unsupported' || !Array.isArray(plan.steps) || !plan.steps.length) {
    return {
      status: plan?.status === 'unsupported' ? 'unsupported' : 'empty',
      clip: null,
      report: null,
      warnings: [...(plan?.warnings || [])],
    };
  }

  const animation = normalizeAnimationState(animationInput, {
    compatibleRig: rigVersion,
    targetProportionRevision,
  });
  const rig = createRigContext(bodyProfile, { rigVersion });
  const compiledSteps = plan.steps.map((step) => ({
    step,
    clip: compileSkillClip(step, animation, rig, registry),
    layerPriority: layerPriority(step.layer),
  }));
  const duration = Math.max(0.05, Number(plan.estimatedDuration || Math.max(...plan.steps.map((step) => step.startTime + step.duration))).toFixed(6));
  const clipId = `text-motion-${String(plan.planId || 'plan').replace(/[^A-Za-z0-9_-]/g, '-')}`;
  let clip = createEmptyClip({
    clipId,
    name: sourceText ? `Text Motion · ${sourceText.slice(0, 42)}` : 'Text Motion Generated',
    duration,
    compatibleRig: rigVersion,
    sourceProportionRevision: targetProportionRevision,
    loopMode: 'once',
    rootMotionMode: plan.rootMotionPolicy === 'root_motion' ? 'root_motion' : 'in_place',
    rootJointId: ROOT_JOINT_ID,
    metadata: {
      source: 'text-motion-v1',
      sourceText: String(sourceText || ''),
      actionPlanId: plan.planId,
      motionIntentId: plan.sourceIntentId,
      requiredSkills: [...(plan.requiredSkills || [])],
      requiredChains: [...(plan.requiredChains || [])],
      warnings: [...(plan.warnings || [])],
      sourceBodyHeight: Number(bodyProfile.height) || 1.795672,
      category: 'interaction',
    },
  });

  const times = collectSampleTimes(compiledSteps, duration);
  const jointIds = new Set(compiledSteps.flatMap(({ clip: source }) => source.tracks
    .filter((track) => track.channel === 'rotation' && track.jointId !== ROOT_JOINT_ID)
    .map((track) => track.jointId)));
  const currentJoints = new Map([...jointIds].map((jointId) => [jointId, [...IDENTITY]]));
  let currentRootRotation = [...IDENTITY];
  let currentRootPosition = [0, 0, 0];

  for (const time of times) {
    const active = compiledSteps
      .filter(({ step }) => time >= step.startTime - 1e-6 && time <= step.startTime + step.duration + 1e-6)
      .sort((a, b) => a.layerPriority - b.layerPriority || a.step.stepId.localeCompare(b.step.stepId));
    const jointCandidates = new Map();
    let rootCandidate = null;
    for (const item of active) {
      const localTime = Math.max(0, Math.min(item.step.duration, time - item.step.startTime));
      const sample = sampleCompiledStep(item, localTime);
      for (const [jointId, value] of Object.entries(sample.joints || {})) {
        const candidate = { rotation: value.rotation || value, priority: item.layerPriority, stepId: item.step.stepId };
        const previous = jointCandidates.get(jointId);
        if (!previous || candidate.priority < previous.priority || (candidate.priority === previous.priority && candidate.stepId < previous.stepId)) {
          jointCandidates.set(jointId, candidate);
        }
      }
      if (sample.root?.rotation) {
        const candidate = { rotation: sample.root.rotation, priority: item.layerPriority, stepId: item.step.stepId };
        if (!rootCandidate || candidate.priority < rootCandidate.priority || (candidate.priority === rootCandidate.priority && candidate.stepId < rootCandidate.stepId)) {
          rootCandidate = candidate;
        }
      }
    }
    for (const jointId of jointIds) {
      if (jointCandidates.has(jointId)) currentJoints.set(jointId, [...jointCandidates.get(jointId).rotation]);
      clip = upsertTrackKeyframe(clip, {
        jointId,
        channel: 'rotation',
        time,
        value: currentJoints.get(jointId) || IDENTITY,
        keyframeId: `text-motion-${jointId}-${time.toFixed(6)}`,
      });
    }
    if (rootCandidate) currentRootRotation = [...rootCandidate.rotation];
    currentRootPosition = resolveRootPosition(compiledSteps, active, time, currentRootPosition);
    clip = upsertTrackKeyframe(clip, {
      jointId: ROOT_JOINT_ID,
      channel: 'rotation',
      time,
      value: currentRootRotation,
      keyframeId: `text-motion-${ROOT_JOINT_ID}-rotation-${time.toFixed(6)}`,
    });
    clip = upsertTrackKeyframe(clip, {
      jointId: ROOT_JOINT_ID,
      channel: 'position',
      time,
      value: currentRootPosition,
      keyframeId: `text-motion-${ROOT_JOINT_ID}-position-${time.toFixed(6)}`,
    });
  }

  clip.events = collectEvents(compiledSteps);
  clip.contacts = collectContacts(compiledSteps);
  clip.quality = {
    validated: true,
    maxBoneLengthError: 0,
    maxContactError: null,
    maxJointAngularVelocity: null,
    warnings: [...(plan.warnings || [])],
  };
  clip = normalizeClip(clip, { compatibleRig: rigVersion });
  const report = validateAnimationClip(clip);
  return {
    status: report.valid ? 'ready' : 'error',
    clip: report.valid ? clip : null,
    report,
    warnings: [...(plan.warnings || []), ...report.warnings],
    compiledSkills: compiledSteps.map(({ step, clip: source }) => ({ stepId: step.stepId, skillId: step.skillId, clipId: source.clipId })),
  };
}

function compileSkillClip(step, animation, rig, registry) {
  const skill = registry.get(step.skillId);
  if (!skill) throw new Error(`Motion skill is not registered: ${step.skillId}`);
  if (skill.sourceClipId) {
    const source = animation.clips.find((clip) => clip.clipId === skill.sourceClipId)
      || normalizeAnimationState({}, { compatibleRig: animation.retarget.targetRig }).clips.find((clip) => clip.clipId === skill.sourceClipId);
    if (!source) throw new Error(`Source AnimationClip is missing for skill ${skill.skillId}: ${skill.sourceClipId}`);
    let clip = normalizeClip(source);
    if (skill.skillId === 'walk_backward') clip = reverseRootMotion(clip, step);
    if (['wave', 'salute'].includes(skill.skillId) && step.parameters.side === 'left') clip = mirrorClipDeterministic(clip, `${skill.skillId}-left`);
    clip.clipId = `text-skill-${skill.skillId}-${step.stepId}`;
    clip.name = `${skill.skillId} · ${step.stepId}`;
    clip.loopMode = skill.skillId === 'walk' || skill.skillId === 'walk_backward' ? 'repeat' : 'once';
    return normalizeClip(clip);
  }
  return createProceduralSkillClip(step, skill, rig);
}

function createProceduralSkillClip(step, skill, rig) {
  const duration = step.duration;
  const frameTimes = [0, Number((duration * 0.5).toFixed(6)), duration];
  const frameRotations = frameTimes.map((time) => proceduralPose(skill.skillId, time / duration, step.parameters, rig));
  const jointIds = [...new Set(frameRotations.flatMap((frame) => Object.keys(frame)))].sort();
  let clip = createEmptyClip({
    clipId: `text-skill-${skill.skillId}-${step.stepId}`,
    name: `${skill.skillId} · ${step.stepId}`,
    duration,
    compatibleRig: rig.rigVersion,
    rootMotionMode: 'in_place',
    rootJointId: ROOT_JOINT_ID,
    metadata: {
      source: 'text-motion-v1',
      compiler: skill.compiler,
      skillId: skill.skillId,
      sourceBodyHeight: rig.bodyHeight,
      category: 'interaction',
    },
  });
  for (const jointId of jointIds) {
    for (let index = 0; index < frameTimes.length; index += 1) {
      clip = upsertTrackKeyframe(clip, {
        jointId,
        channel: 'rotation',
        time: frameTimes[index],
        value: frameRotations[index][jointId] || IDENTITY,
        keyframeId: `text-skill-${skill.skillId}-${step.stepId}-${jointId}-${index}`,
      });
    }
  }
  clip = upsertTrackKeyframe(clip, {
    jointId: ROOT_JOINT_ID,
    channel: 'position',
    time: 0,
    value: [0, 0, 0],
    keyframeId: `text-skill-${step.stepId}-root-position-0`,
  });
  clip = upsertTrackKeyframe(clip, {
    jointId: ROOT_JOINT_ID,
    channel: 'position',
    time: duration,
    value: [0, 0, 0],
    keyframeId: `text-skill-${step.stepId}-root-position-1`,
  });
  return normalizeClip(clip);
}

function proceduralPose(skillId, phase, parameters, rig) {
  const factor = skillId === 'stand_up' ? 1 - phase : skillId === 'look' || skillId === 'turn' || skillId === 'bend' || skillId === 'inspect' || skillId === 'sit' || skillId === 'reach' || skillId === 'point'
    ? Math.min(1, phase * 2)
    : Math.sin(Math.PI * Math.min(1, phase));
  const rotations = {};
  if (skillId === 'turn') {
    const sign = parameters.side === 'left' || parameters.direction === 'left' ? -1 : 1;
    const angle = (Number(parameters.angleDegrees) || 90) * Math.PI / 180 * sign * factor;
    rotations.hips = safeAnatomical(rig, 'hips', { twist: angle });
    rotations.spine = safeAnatomical(rig, 'spine', { twist: angle * 0.55 });
    rotations.chest = safeAnatomical(rig, 'chest', { twist: angle * 0.3 });
    rotations.upperChest = safeAnatomical(rig, 'upperChest', { twist: angle * 0.15 });
  } else if (skillId === 'look') {
    const sign = ['left', 'left_forward', 'left_backward'].includes(parameters.direction) || parameters.side === 'left' ? -1 : 1;
    const angle = (Number(parameters.angleDegrees) || 35) * Math.PI / 180 * sign * factor;
    rotations.neck = safeAnatomical(rig, 'neck', { side: angle * 0.5 });
    rotations.head = safeAnatomical(rig, 'head', { side: angle });
  } else if (skillId === 'bend' || skillId === 'inspect') {
    rotations.hips = safeAnatomical(rig, 'hips', { bend: 18 * Math.PI / 180 * factor });
    rotations.spine = safeAnatomical(rig, 'spine', { bend: 24 * Math.PI / 180 * factor });
    rotations.chest = safeAnatomical(rig, 'chest', { bend: 16 * Math.PI / 180 * factor });
    if (skillId === 'inspect') {
      const sign = ['left', 'left_forward', 'left_backward'].includes(parameters.direction) ? -1 : 1;
      rotations.neck = safeAnatomical(rig, 'neck', { side: 15 * Math.PI / 180 * sign * factor });
      rotations.head = safeAnatomical(rig, 'head', { side: 25 * Math.PI / 180 * sign * factor });
    }
  } else if (skillId === 'sit') {
    rotations.hips = safeAnatomical(rig, 'hips', { bend: 38 * Math.PI / 180 * factor });
    rotations.spine = safeAnatomical(rig, 'spine', { bend: 14 * Math.PI / 180 * factor });
    rotations.leftUpperLeg = safeAnatomical(rig, 'leftUpperLeg', { bend: 62 * Math.PI / 180 * factor });
    rotations.rightUpperLeg = safeAnatomical(rig, 'rightUpperLeg', { bend: 62 * Math.PI / 180 * factor });
    rotations.leftLowerLeg = safeAnatomical(rig, 'leftLowerLeg', { bend: -68 * Math.PI / 180 * factor });
    rotations.rightLowerLeg = safeAnatomical(rig, 'rightLowerLeg', { bend: -68 * Math.PI / 180 * factor });
  } else if (skillId === 'stand_up') {
    return proceduralPose('sit', 1 - phase, parameters, rig);
  } else if (skillId === 'reach' || skillId === 'point') {
    const side = parameters.side === 'left' ? 'left' : 'right';
    const sign = side === 'left' ? -1 : 1;
    const direction = directionVector(parameters.direction, sign);
    const solved = solveDirectedLocalRotations({
      [`${side}UpperArm`]: direction,
      [`${side}LowerArm`]: direction,
      [`${side}Hand`]: direction,
    });
    for (const jointId of [`${side}Shoulder`, `${side}UpperArm`, `${side}LowerArm`, `${side}Hand`]) {
      rotations[jointId] = phase <= 0 ? [...IDENTITY] : solved[jointId] || [...IDENTITY];
    }
    if (skillId === 'point') rotations[`${side}Hand`] = solved[`${side}Hand`] || [...IDENTITY];
  }
  return rotations;
}

function safeAnatomical(rig, jointId, channels) {
  try {
    return resolveAnatomicalRotation(
      rig,
      jointId,
      Number(channels.twist) || 0,
      Number(channels.bend) || 0,
      Number(channels.side) || 0,
    );
  } catch (_) {
    return [...IDENTITY];
  }
}

function directionVector(direction, sideSign) {
  const values = {
    forward: [0, 0.35, 0.94],
    backward: [0, 0.35, -0.94],
    left: [-0.94, 0.35, 0.1],
    right: [0.94, 0.35, 0.1],
    left_forward: [-0.65, 0.35, 0.75],
    right_forward: [0.65, 0.35, 0.75],
    left_backward: [-0.65, 0.35, -0.75],
    right_backward: [0.65, 0.35, -0.75],
  };
  const fallback = [0.45 * sideSign, 0.35, 0.82];
  return values[direction] || fallback;
}

function collectSampleTimes(compiledSteps, duration) {
  const values = new Set([0, Number(duration)]);
  for (const { step, clip } of compiledSteps) {
    values.add(Number(step.startTime.toFixed(6)));
    values.add(Number((step.startTime + step.duration).toFixed(6)));
    const isWalk = step.skillId === 'walk' || step.skillId === 'walk_backward';
    if (isWalk) {
      const cycles = Math.ceil(step.duration / clip.duration) + 1;
      for (let cycle = 0; cycle <= cycles; cycle += 1) {
        for (const track of clip.tracks) {
          for (const key of track.keyframes) {
            const time = step.startTime + cycle * clip.duration + key.time;
            if (time >= step.startTime - 1e-6 && time <= step.startTime + step.duration + 1e-6) values.add(Number(time.toFixed(6)));
          }
        }
      }
    } else {
      for (const track of clip.tracks) {
        for (const key of track.keyframes) {
          const time = step.startTime + (key.time / Math.max(0.001, clip.duration)) * step.duration;
          if (time >= step.startTime - 1e-6 && time <= step.startTime + step.duration + 1e-6) values.add(Number(time.toFixed(6)));
        }
      }
    }
  }
  return [...values].filter((time) => time >= -1e-6 && time <= duration + 1e-6).sort((a, b) => a - b);
}

function sampleCompiledStep(item, localTime) {
  const { step, clip } = item;
  const isWalk = step.skillId === 'walk' || step.skillId === 'walk_backward';
  const rawTime = isWalk ? localTime : localTime * clip.duration / Math.max(0.001, step.duration);
  const loopMode = isWalk ? 'repeat' : 'once';
  const sample = sampleAnimationClip(clip, rawTime, { loopMode });
  if (clip.rootMotionMode === 'root_motion') {
    const rootTrack = clip.tracks.find((track) => track.channel === 'position' && (track.jointId === clip.rootJointId || track.jointId === ROOT_JOINT_ID));
    if (rootTrack?.keyframes.length) {
      const start = rootTrack.keyframes[0].value;
      const end = rootTrack.keyframes.at(-1).value;
      const cycles = isWalk ? Math.floor(Math.max(0, rawTime) / clip.duration) : 0;
      const delta = subtractVector(end, start);
      sample.root.position = addVector(sample.root.position || [0, 0, 0], scaleVector(delta, cycles));
    }
  }
  return sample;
}

function resolveRootPosition(compiledSteps, active, time, fallback) {
  const activeRoot = active
    .filter((item) => item.clip.rootMotionMode === 'root_motion')
    .sort((a, b) => a.layerPriority - b.layerPriority || a.step.stepId.localeCompare(b.step.stepId))[0];
  if (activeRoot) {
    const prefix = compiledSteps
      .filter((item) => item.clip.rootMotionMode === 'root_motion' && item.step.startTime < activeRoot.step.startTime && item.step.startTime + item.step.duration <= activeRoot.step.startTime + 1e-6)
      .sort((a, b) => a.step.startTime - b.step.startTime)
      .reduce((sum, item) => addVector(sum, rootDeltaAtEnd(item)), [0, 0, 0]);
    return addVector(prefix, sampleCompiledStep(activeRoot, Math.max(0, Math.min(activeRoot.step.duration, time - activeRoot.step.startTime))).root.position || [0, 0, 0]);
  }
  const completed = compiledSteps
    .filter((item) => item.clip.rootMotionMode === 'root_motion' && item.step.startTime + item.step.duration <= time + 1e-6)
    .sort((a, b) => a.step.startTime - b.step.startTime)
    .reduce((sum, item) => addVector(sum, rootDeltaAtEnd(item)), [0, 0, 0]);
  return completed.some((value) => Math.abs(value) > 1e-8) ? completed : fallback;
}

function rootDeltaAtEnd(item) {
  const sample = sampleCompiledStep(item, item.step.duration);
  return sample.root.position || [0, 0, 0];
}

function collectEvents(compiledSteps) {
  const events = [];
  for (const { step, clip } of compiledSteps) {
    for (const event of clip.events || []) {
      const time = step.skillId === 'walk' || step.skillId === 'walk_backward'
        ? step.startTime + event.time
        : step.startTime + event.time / Math.max(0.001, clip.duration) * step.duration;
      if (time > step.startTime + step.duration + 1e-6) continue;
      events.push({
        ...structuredClone(event),
        id: `text-motion-event-${step.stepId}-${event.id}`,
        time: Number(Math.min(step.startTime + step.duration, time).toFixed(6)),
        payload: event.payload ? structuredClone(event.payload) : null,
      });
    }
  }
  return events.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}

function collectContacts(compiledSteps) {
  const contacts = [];
  for (const { step, clip } of compiledSteps) {
    for (const contact of clip.contacts || []) {
      const scale = step.skillId === 'walk' || step.skillId === 'walk_backward' ? 1 : step.duration / Math.max(0.001, clip.duration);
      const jointId = MIRROR_JOINTS[contact.jointId] || contact.jointId;
      contacts.push({
        ...structuredClone(contact),
        id: `text-motion-contact-${step.stepId}-${contact.id}`,
        jointId,
        start: Number((step.startTime + contact.start * scale).toFixed(6)),
        end: Number(Math.min(step.startTime + step.duration, step.startTime + contact.end * scale).toFixed(6)),
      });
    }
  }
  return contacts.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

function mirrorClipDeterministic(source, suffix) {
  const mirrored = structuredClone(source);
  mirrored.clipId = `${source.clipId}-${suffix}`;
  mirrored.name = `${source.name} ${suffix}`;
  mirrored.clipRevision = 1;
  mirrored.tracks = source.tracks.map((track) => {
    const jointId = MIRROR_JOINTS[track.jointId] || track.jointId;
    return {
      ...structuredClone(track),
      trackId: `${jointId}:${track.channel}`,
      jointId,
      keyframes: track.keyframes.map((key, index) => ({
        ...structuredClone(key),
        id: `mirror-${suffix}-${jointId}-${index + 1}`,
        value: track.channel === 'rotation'
          ? mirrorQuaternionSagittal(key.value)
          : [-Number(key.value?.[0] || 0), Number(key.value?.[1] || 0), Number(key.value?.[2] || 0)],
      })),
    };
  });
  mirrored.semanticChannels = mirrorSemanticMotionChannels(source.semanticChannels);
  mirrored.events = (source.events || []).map((event, index) => ({
    ...structuredClone(event),
    id: `mirror-${suffix}-event-${index + 1}`,
  }));
  mirrored.contacts = (source.contacts || []).map((contact, index) => ({
    ...structuredClone(contact),
    id: `mirror-${suffix}-contact-${index + 1}`,
    jointId: MIRROR_JOINTS[contact.jointId] || contact.jointId,
    groundNormal: [-contact.groundNormal[0], contact.groundNormal[1], contact.groundNormal[2]],
  }));
  mirrored.metadata = { ...mirrored.metadata, mirroredFrom: source.clipId };
  return normalizeClip(mirrored);
}

function reverseRootMotion(clip, step) {
  const reversed = structuredClone(clip);
  reversed.metadata = { ...reversed.metadata, rootMotionDirection: 'backward', sourceSkill: step.skillId };
  reversed.tracks = reversed.tracks.map((track) => {
    if (track.channel !== 'position' || track.jointId !== ROOT_JOINT_ID) return track;
    return {
      ...track,
      keyframes: track.keyframes.map((key) => ({
        ...key,
        value: [key.value[0], key.value[1], -key.value[2]],
      })),
    };
  });
  return normalizeClip(reversed);
}

function layerPriority(layer) {
  return { base: 0, 'lower-body': 10, 'upper-body': 20, head: 30, additive: 40 }[layer] ?? 50;
}

function addVector(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtractVector(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scaleVector(value, factor) {
  return [value[0] * factor, value[1] * factor, value[2] * factor];
}
