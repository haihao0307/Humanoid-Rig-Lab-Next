import {
  ensureQuaternionContinuity,
  lerpVector,
  mirrorQuaternionSagittal,
  normalizeQuaternion,
  quaternionAngularDistance,
  quaternionLength,
  slerpQuaternion,
} from './quaternion.js';
import {
  createBuiltInAnimationClips,
  createDefaultAnimationGraph,
  createDefaultAnimationLayers,
  createWaveRightPreset,
} from './presets.js';
import {
  mirrorSemanticMotionChannels,
  normalizeAnimationAssetMetadata,
  normalizeSemanticMotionChannels,
  validateAnimationAssetMetadata,
  validateSemanticMotionChannels,
} from './asset-metadata.js';

export {
  ANIMATION_ASSET_CATEGORIES,
  ANIMATION_ASSET_METADATA_SCHEMA,
  SEMANTIC_MOTION_CHANNELS,
  inferSemanticMotionChannels,
  mapSemanticMotionValues,
  normalizeAnimationAssetMetadata,
  normalizeSemanticMotionChannels,
  resolveSemanticMotionChannel,
  validateAnimationAssetMetadata,
  validateSemanticMotionChannels,
} from './asset-metadata.js';

export const ANIMATION_SESSION_SCHEMA = 'humanoid_rig/animation_session@0.4';
export const ANIMATION_CLIP_SCHEMA = 'humanoid_rig/animation_clip@0.4';
export const MOTION_CLIP_SCHEMA = 'humanoid_rig/motion_clip@1.0';
export const POSE_SNAPSHOT_REF_SCHEMA = 'humanoid_rig/pose_snapshot_ref@1.0';
export const ANIMATION_GRAPH_SCHEMA = 'humanoid_rig/animation_graph@0.1';

const LOOP_MODES = new Set(['once', 'repeat', 'pingpong']);
const ROOT_MOTION_MODES = new Set(['in_place', 'root_motion']);
const CHANNELS = new Set(['rotation', 'position']);
const ROOT_JOINT_IDS = new Set(['root', 'hips', 'pelvis']);
const STABLE_JOINT_ID = /^[A-Za-z][A-Za-z0-9_-]*$/;
const TIME_EPSILON = 0.0005;
const BLEND_MODES = new Set(['override', 'additive']);
const GRAPH_CONTROL_MODES = new Set(['clip', 'graph']);
const CONTACT_MODES = new Set(['world_lock', 'position', 'orientation']);
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


export function isNormalizedAnimationState(value) {
  return Boolean(value)
    && value.schema === ANIMATION_SESSION_SCHEMA
    && Array.isArray(value.clips)
    && isPlainObject(value.transport)
    && Array.isArray(value.layers)
    && isPlainObject(value.graph)
    && isPlainObject(value.runtime)
    && isPlainObject(value.retarget);
}

export function isNormalizedAnimationClip(value) {
  return Boolean(value)
    && value.schema === ANIMATION_CLIP_SCHEMA
    && Array.isArray(value.tracks)
    && Array.isArray(value.semanticChannels)
    && Array.isArray(value.poseKeys)
    && Array.isArray(value.poseSnapshots)
    && Array.isArray(value.events)
    && Array.isArray(value.contacts)
    && isPlainObject(value.assetMetadata)
    && isPlainObject(value.retargetPolicy)
    && isPlainObject(value.quality);
}

export function createEmptyClip({
  clipId = 'custom',
  name = 'Custom Draft',
  duration = 2,
  compatibleRig = 'rig@0.4.0',
  sourceProportionRevision = 0,
  loopMode = 'once',
  rootMotionMode = 'in_place',
  rootJointId = 'hips',
  metadata = {},
  retargetPolicy = {},
  assetMetadata = {},
  semanticChannels = [],
} = {}) {
  const clip = {
    schema: ANIMATION_CLIP_SCHEMA,
    type: 'AnimationClip',
    clipId: sanitizeId(clipId, 'custom'),
    name: String(name || 'Untitled Clip'),
    clipRevision: 1,
    compatibleRig: String(compatibleRig || 'unknown-rig'),
    sourceProportionRevision: Math.max(0, Math.trunc(finiteNumber(sourceProportionRevision, 0))),
    duration: clampFinite(duration, 0.01, 3600, 2),
    sampleRateHint: 30,
    loopMode: LOOP_MODES.has(loopMode) ? loopMode : 'once',
    rootMotionMode: ROOT_MOTION_MODES.has(rootMotionMode) ? rootMotionMode : 'in_place',
    rootJointId: sanitizeId(rootJointId, 'hips'),
    tracks: [],
    semanticChannels: [],
    poseKeys: [],
    poseSnapshots: [],
    events: [],
    contacts: [],
    retargetPolicy: normalizeRetargetPolicy(retargetPolicy),
    quality: {
      validated: false,
      maxBoneLengthError: null,
      maxContactError: null,
      warnings: [],
    },
    metadata: {
      workspaceAlias: 'AnimationClip',
      motionClipExport: MOTION_CLIP_SCHEMA,
      sourceBodyHeight: 1.795672,
      ...clone(metadata),
    },
  };
  return refreshClipAssetDescriptors(clip, { assetMetadata, semanticChannels });
}

export function createBuiltInClips({ compatibleRig = 'rig@0.4.0' } = {}) {
  return createBuiltInAnimationClips({ compatibleRig }).map((clip) => normalizeClip(clip, { compatibleRig }));
}

export function createWaveRightClip({ compatibleRig = 'rig@0.4.0' } = {}) {
  return normalizeClip(createWaveRightPreset({ compatibleRig }), { compatibleRig });
}

export function normalizeAnimationState(input, {
  compatibleRig = 'rig@0.4.0',
  sourcePoseVersion = 'pose@unknown',
  targetProportionRevision = 0,
} = {}) {
  const source = isPlainObject(input) ? clone(input) : {};
  const builtIns = createBuiltInClips({ compatibleRig });
  let clips = Array.isArray(source.clips) && source.clips.length
    ? source.clips.map((clip) => normalizeClip(clip, { compatibleRig }))
    : builtIns;
  if (source.schema !== ANIMATION_SESSION_SCHEMA) {
    const existingIds = new Set(clips.map((clip) => clip.clipId));
    for (const builtIn of builtIns) {
      if (!existingIds.has(builtIn.clipId)) clips.push(builtIn);
    }
  }

  const requestedClipId = String(source.activeClipId || source.clip || 'idle-breathe');
  let activeClipId = clips.some((clip) => clip.clipId === requestedClipId)
    ? requestedClipId
    : clips[0]?.clipId || 'custom';

  if (!clips.length) {
    clips = [createEmptyClip({ compatibleRig })];
    activeClipId = clips[0].clipId;
  }

  const activeIndex = clips.findIndex((clip) => clip.clipId === activeClipId);
  const activeClip = clips[activeIndex];

  if (Number.isFinite(Number(source.duration)) && !Array.isArray(source.clips)) {
    activeClip.duration = clampFinite(source.duration, 0.01, 3600, activeClip.duration);
  }

  if (Array.isArray(source.keyframes) && source.keyframes.length && !activeClip.poseKeys.length) {
    const migrated = migrateLegacyPoseKeys(activeClip, source.keyframes, {
      compatibleRig,
      sourcePoseVersion,
    });
    clips[activeIndex] = migrated;
  }

  const selectedClip = clips.find((clip) => clip.clipId === activeClipId) || clips[0];
  const rawTransport = isPlainObject(source.transport) ? source.transport : {};
  const rawPlaying = rawTransport.playing ?? source.playing;
  const rawTime = rawTransport.time ?? source.time;
  const rawSpeed = rawTransport.speed ?? source.speed;
  const rawLoop = rawTransport.loop ?? source.loop;
  const loopEnabled = rawLoop == null ? selectedClip.loopMode !== 'once' : rawLoop !== false;
  const transport = {
    playing: Boolean(rawPlaying),
    time: resolveClipTime(rawTime, selectedClip.duration, loopEnabled ? selectedClip.loopMode : 'once'),
    rawTime: finiteNumber(rawTransport.rawTime, Number(rawTime || 0)),
    speed: clampFinite(rawSpeed, -4, 4, 1),
    loop: loopEnabled,
    loopStart: clampFinite(rawTransport.loopStart, 0, selectedClip.duration, 0),
    loopEnd: clampFinite(rawTransport.loopEnd, 0, selectedClip.duration, selectedClip.duration),
    anchorTime: clampFinite(rawTransport.anchorTime, 0, selectedClip.duration, Number(rawTime || 0)),
    anchorRawTime: finiteNumber(rawTransport.anchorRawTime, Number(rawTransport.anchorTime ?? rawTime ?? 0)),
    anchorIssuedAt: Math.max(0, finiteNumber(rawTransport.anchorIssuedAt, 0)),
    syncGroup: String(rawTransport.syncGroup || 'animation-editor-default'),
    frameStep: clampFinite(rawTransport.frameStep, 1 / 240, 1, 1 / 30),
  };
  if (transport.loopEnd <= transport.loopStart + TIME_EPSILON) {
    transport.loopStart = 0;
    transport.loopEnd = selectedClip.duration;
  }

  const layers = normalizeAnimationLayers(source.layers, clips);
  const graph = normalizeAnimationGraph(source.graph, clips);
  const rawRuntime = isPlainObject(source.runtime) ? source.runtime : {};
  const runtime = {
    mode: ['exact', 'physical_follow', 'full_physics'].includes(rawRuntime.mode) ? rawRuntime.mode : 'exact',
    previewSource: ['desired_pose', 'final_pose'].includes(rawRuntime.previewSource) ? rawRuntime.previewSource : 'final_pose',
    followStiffness: clampFinite(rawRuntime.followStiffness, 0, 1, 0.86),
    followDamping: clampFinite(rawRuntime.followDamping, 0, 1, 0.92),
    footLockEnabled: rawRuntime.footLockEnabled !== false,
    jointLimitsEnabled: rawRuntime.jointLimitsEnabled !== false,
    rootMotionEnabled: rawRuntime.rootMotionEnabled !== false,
    userOverrideReleaseSeconds: clampFinite(rawRuntime.userOverrideReleaseSeconds, 0.05, 2, 0.25),
  };
  const rawRetarget = isPlainObject(source.retarget) ? source.retarget : {};
  const retarget = {
    enabled: rawRetarget.enabled !== false,
    targetRig: String(rawRetarget.targetRig || compatibleRig),
    targetProportionRevision: Math.max(0, Math.trunc(finiteNumber(rawRetarget.targetProportionRevision, targetProportionRevision))),
    scaleRootMotionByHeight: rawRetarget.scaleRootMotionByHeight !== false,
    preserveContacts: rawRetarget.preserveContacts !== false,
    clampJointLimits: rawRetarget.clampJointLimits !== false,
    mapping: isPlainObject(rawRetarget.mapping) ? clone(rawRetarget.mapping) : {},
  };

  const state = {
    ...source,
    schema: ANIMATION_SESSION_SCHEMA,
    activeClipId,
    clips,
    transport,
    layers,
    graph,
    runtime,
    retarget,
    selection: normalizeSelection(source.selection, activeClipId),
    bake: normalizeBakeSettings(source.bake),
  };
  return syncLegacyAnimationFields(state);
}

export function normalizeClip(input, { compatibleRig = 'rig@0.4.0' } = {}) {
  const source = isPlainObject(input) ? clone(input) : {};
  const clip = createEmptyClip({
    clipId: source.clipId || source.id || 'custom',
    name: source.name || source.label || 'Untitled Clip',
    duration: source.duration,
    compatibleRig: source.compatibleRig || source.skeletonProfile || compatibleRig,
    sourceProportionRevision: source.sourceProportionRevision ?? source.source_proportion_revision,
    loopMode: source.loopMode,
    rootMotionMode: source.rootMotionMode,
    rootJointId: source.rootJointId,
    metadata: source.metadata,
    retargetPolicy: source.retargetPolicy || source.retarget_policy,
  });
  clip.schema = ANIMATION_CLIP_SCHEMA;
  clip.type = String(source.type || 'AnimationClip');
  clip.clipRevision = Math.max(1, Math.trunc(finiteNumber(source.clipRevision, 1)));
  clip.sampleRateHint = clampFinite(source.sampleRateHint, 1, 240, 30);
  clip.tracks = Array.isArray(source.tracks) ? source.tracks.map(normalizeTrack) : [];
  clip.poseSnapshots = Array.isArray(source.poseSnapshots)
    ? source.poseSnapshots.map(normalizePoseSnapshotReference)
    : [];
  clip.poseKeys = Array.isArray(source.poseKeys)
    ? source.poseKeys.map((key) => normalizePoseKey(key, clip.duration)).sort(byTimeThenId)
    : [];
  clip.events = Array.isArray(source.events)
    ? source.events.map((event) => normalizeEvent(event, clip.duration)).sort(byTimeThenId)
    : [];
  clip.contacts = Array.isArray(source.contacts)
    ? source.contacts.map((contact) => normalizeContact(contact, clip.duration)).sort(byContactTimeThenId)
    : [];
  clip.retargetPolicy = normalizeRetargetPolicy(source.retargetPolicy || source.retarget_policy || clip.retargetPolicy);
  clip.quality = normalizeQuality(source.quality);
  return refreshClipAssetDescriptors(clip, {
    assetMetadata: source.assetMetadata || source.asset_metadata,
    semanticChannels: source.semanticChannels || source.semantic_channels,
  });
}

export function getActiveClip(animationState) {
  const animation = isNormalizedAnimationState(animationState)
    ? animationState
    : normalizeAnimationState(animationState);
  return animation.clips.find((clip) => clip.clipId === animation.activeClipId) || animation.clips[0];
}

export function replaceClip(animationState, replacement) {
  const animation = normalizeAnimationState(animationState, {
    compatibleRig: replacement?.compatibleRig,
  });
  const clip = normalizeClip(replacement, { compatibleRig: replacement?.compatibleRig });
  const index = animation.clips.findIndex((item) => item.clipId === clip.clipId);
  if (index >= 0) animation.clips[index] = clip;
  else animation.clips.push(clip);
  animation.activeClipId = clip.clipId;
  animation.transport.time = Math.min(animation.transport.time, clip.duration);
  animation.transport.anchorTime = animation.transport.time;
  animation.transport.anchorRawTime = animation.transport.time;
  animation.transport.anchorIssuedAt = animation.transport.playing ? Date.now() : 0;
  return syncLegacyAnimationFields(animation);
}

export function setActiveClip(animationState, clipId) {
  const animation = normalizeAnimationState(animationState);
  const nextId = animation.clips.some((clip) => clip.clipId === clipId)
    ? clipId
    : animation.activeClipId;
  animation.activeClipId = nextId;
  const clip = animation.clips.find((item) => item.clipId === nextId);
  animation.transport.playing = false;
  animation.transport.time = 0;
  animation.transport.rawTime = 0;
  animation.transport.anchorTime = 0;
  animation.transport.anchorRawTime = 0;
  animation.transport.anchorIssuedAt = 0;
  animation.transport.loopStart = 0;
  animation.transport.loopEnd = clip.duration;
  animation.transport.loop = clip.loopMode !== 'once';
  if (animation.selection) {
    animation.selection.clipId = nextId;
    animation.selection.jointId = null;
    animation.selection.trackId = null;
    animation.selection.keyframeIds = [];
    animation.selection.eventId = null;
  }
  // Direct clip selection is an editor preview operation. Keep the state
  // machine's last state independent so it cannot silently transition a
  // manually selected one-shot clip back to its entry state.
  animation.graph.controlMode = 'clip';
  animation.graph.transition = null;
  return syncLegacyAnimationFields(animation);
}

export function addClip(animationState, clipInput) {
  const animation = normalizeAnimationState(animationState, {
    compatibleRig: clipInput?.compatibleRig,
  });
  let clip = normalizeClip(clipInput, { compatibleRig: clipInput?.compatibleRig });
  const existingIds = new Set(animation.clips.map((item) => item.clipId));
  if (existingIds.has(clip.clipId)) {
    const base = clip.clipId;
    let suffix = 2;
    while (existingIds.has(`${base}-${suffix}`)) suffix += 1;
    clip.clipId = `${base}-${suffix}`;
  }
  animation.clips.push(clip);
  return setActiveClip(animation, clip.clipId);
}

export function clearClipContent(clipInput) {
  const clip = normalizeClip(clipInput);
  clip.tracks = [];
  clip.semanticChannels = [];
  clip.poseKeys = [];
  clip.poseSnapshots = [];
  clip.events = [];
  clip.contacts = [];
  clip.clipRevision += 1;
  clip.metadata = { ...clip.metadata, status: 'editable-draft' };
  return refreshClipAssetDescriptors(clip, { semanticChannels: [] });
}

export function upsertTrackKeyframe(clipInput, {
  jointId,
  channel = 'rotation',
  time = 0,
  value,
  interpolation,
  keyframeId,
  sourceSnapshotId = null,
} = {}) {
  const clip = normalizeClip(clipInput);
  const safeJointId = sanitizeId(jointId, 'unknownJoint');
  const safeChannel = String(channel || 'rotation');
  const trackId = `${safeJointId}:${safeChannel}`;
  let track = clip.tracks.find((item) => item.trackId === trackId);
  if (!track) {
    track = {
      trackId,
      jointId: safeJointId,
      channel: safeChannel,
      space: safeChannel === 'rotation' ? 'local' : 'root',
      interpolation: interpolation || (safeChannel === 'rotation' ? 'slerp' : 'linear'),
      keyframes: [],
    };
    clip.tracks.push(track);
  }

  const safeTime = clampFinite(time, 0, clip.duration, 0);
  const existing = track.keyframes.find((key) => Math.abs(key.time - safeTime) <= TIME_EPSILON);
  const normalizedValue = safeChannel === 'rotation'
    ? normalizeQuaternion(value)
    : normalizeVector(value, 3);
  const key = {
    id: String(keyframeId || existing?.id || createId('key')),
    time: safeTime,
    value: normalizedValue,
    sourceSnapshotId: sourceSnapshotId ? String(sourceSnapshotId) : null,
  };
  track.keyframes = [
    ...track.keyframes.filter((item) => Math.abs(item.time - safeTime) > TIME_EPSILON),
    key,
  ].sort(byTimeThenId);
  if (safeChannel === 'rotation') {
    const continuous = ensureQuaternionContinuity(track.keyframes.map((item) => item.value));
    track.keyframes = track.keyframes.map((item, index) => ({ ...item, value: continuous[index] }));
  }
  clip.clipRevision += 1;
  return refreshClipAssetDescriptors(clip);
}

export function createPoseSnapshotReference(pose, {
  compatibleRig = 'rig@0.4.0',
  sourcePoseVersion = 'pose@unknown',
  capturedAt = new Date().toISOString(),
  snapshotId = null,
} = {}) {
  const source = isPlainObject(pose) ? clone(pose) : {};
  const localPose = extractLocalQuaternionPose(source);
  const v8Payload = !localPose && isPlainObject(source.v8Payload) && Array.isArray(source.v8Payload.joints)
    ? clone(source.v8Payload)
    : null;
  const previewJoints = !localPose && isPlainObject(source.joints) ? clone(source.joints) : null;
  const format = localPose ? 'local-quaternion@1' : v8Payload ? 'v8-world-position@1' : 'preview-2d@1';
  const cache = localPose
    ? {
      type: 'PoseSnapshot',
      format,
      poseName: String(source.name || 'Local Quaternion Pose'),
      pinned: Array.isArray(source.pinned) ? [...source.pinned] : [],
      root: localPose.root,
      joints: localPose.joints,
    }
    : v8Payload
      ? {
        type: 'PoseSnapshot',
        format,
        poseName: String(source.name || v8Payload.pose || 'Custom Pose'),
        pinned: Array.isArray(source.pinned) ? [...source.pinned] : [],
        payload: v8Payload,
      }
      : {
        type: 'PoseSnapshot',
        format,
        poseName: String(source.name || 'Custom Pose'),
        pinned: Array.isArray(source.pinned) ? [...source.pinned] : [],
        joints: previewJoints || {},
      };
  const contentHash = simpleHash(stableStringify(cache));
  const sourceUpdatedAt = String(source.updatedAt || source.v8Payload?.updatedAt || capturedAt);
  const resolvedSnapshotId = String(snapshotId || `pose-${simpleHash(`${sourcePoseVersion}|${sourceUpdatedAt}|${contentHash}`)}`);
  const jointIds = localPose
    ? Object.keys(localPose.joints)
    : v8Payload
      ? v8Payload.joints.map((joint) => String(joint?.id || '')).filter(Boolean)
      : Object.keys(previewJoints || {});

  return {
    schema: POSE_SNAPSHOT_REF_SCHEMA,
    type: 'PoseSnapshotRef',
    snapshotId: resolvedSnapshotId,
    compatibleRig: String(compatibleRig || 'unknown-rig'),
    sourcePoseVersion: String(sourcePoseVersion || 'pose@unknown'),
    sourceUpdatedAt,
    capturedAt: String(capturedAt),
    poseName: cache.poseName,
    format,
    jointIds,
    contentHash: `fnv1a:${contentHash}`,
    storage: 'embedded-readonly-cache',
    cache,
  };
}

export function addPoseSnapshotKey(clipInput, {
  time = 0,
  pose,
  compatibleRig,
  sourcePoseVersion,
  capturedAt,
  keyframeId,
  snapshotId,
} = {}) {
  const clip = normalizeClip(clipInput, { compatibleRig });
  const snapshot = createPoseSnapshotReference(pose, {
    compatibleRig: compatibleRig || clip.compatibleRig,
    sourcePoseVersion,
    capturedAt,
    snapshotId,
  });
  const existingSnapshotIndex = clip.poseSnapshots.findIndex((item) => item.snapshotId === snapshot.snapshotId);
  if (existingSnapshotIndex >= 0) clip.poseSnapshots[existingSnapshotIndex] = snapshot;
  else clip.poseSnapshots.push(snapshot);

  const safeTime = clampFinite(time, 0, clip.duration, 0);
  const existingKey = clip.poseKeys.find((key) => Math.abs(key.time - safeTime) <= TIME_EPSILON);
  const key = {
    id: String(keyframeId || existingKey?.id || createId('pose-key')),
    time: safeTime,
    snapshotId: snapshot.snapshotId,
  };
  clip.poseKeys = [
    ...clip.poseKeys.filter((item) => Math.abs(item.time - safeTime) > TIME_EPSILON),
    key,
  ].sort(byTimeThenId);
  clip.clipRevision += 1;
  return clip;
}

export function removeNearestPoseSnapshotKey(clipInput, time = 0) {
  const clip = normalizeClip(clipInput);
  if (!clip.poseKeys.length) return clip;

  const safeTime = clampFinite(time, 0, clip.duration, 0);
  let nearest = clip.poseKeys[0];
  for (const key of clip.poseKeys) {
    if (Math.abs(key.time - safeTime) < Math.abs(nearest.time - safeTime)) nearest = key;
  }

  clip.poseKeys = clip.poseKeys.filter((key) => key.id !== nearest.id);
  const referencedSnapshotIds = new Set(clip.poseKeys.map((key) => key.snapshotId));
  for (const track of clip.tracks) {
    for (const key of track.keyframes) {
      if (key.sourceSnapshotId) referencedSnapshotIds.add(key.sourceSnapshotId);
    }
  }
  clip.poseSnapshots = clip.poseSnapshots.filter((snapshot) => referencedSnapshotIds.has(snapshot.snapshotId));
  clip.clipRevision += 1;
  return clip;
}

export function addClipEvent(clipInput, {
  time = 0,
  type = 'marker',
  payload = null,
  eventId = null,
} = {}) {
  const clip = normalizeClip(clipInput);
  const safeTime = clampFinite(time, 0, clip.duration, 0);
  const event = {
    id: String(eventId || createId('event')),
    time: safeTime,
    type: String(type || 'marker'),
    payload: clone(payload),
  };
  clip.events.push(event);
  clip.events.sort(byTimeThenId);
  clip.clipRevision += 1;
  return clip;
}

export function removeClipEvent(clipInput, eventId) {
  const clip = normalizeClip(clipInput);
  const before = clip.events.length;
  clip.events = clip.events.filter((event) => event.id !== String(eventId));
  if (clip.events.length !== before) clip.clipRevision += 1;
  return clip;
}

export function addClipContact(clipInput, contactInput = {}) {
  const clip = normalizeClip(clipInput);
  const contact = normalizeContact(contactInput, clip.duration);
  const index = clip.contacts.findIndex((item) => item.id === contact.id);
  if (index >= 0) clip.contacts[index] = contact;
  else clip.contacts.push(contact);
  clip.contacts.sort(byContactTimeThenId);
  clip.clipRevision += 1;
  return refreshClipAssetDescriptors(clip);
}

export function removeClipContact(clipInput, contactId) {
  const clip = normalizeClip(clipInput);
  const before = clip.contacts.length;
  clip.contacts = clip.contacts.filter((contact) => contact.id !== String(contactId));
  if (clip.contacts.length !== before) clip.clipRevision += 1;
  return refreshClipAssetDescriptors(clip);
}

export function moveTrackKeyframes(clipInput, {
  trackId,
  keyframeIds = [],
  deltaTime = 0,
} = {}) {
  const clip = normalizeClip(clipInput);
  const ids = new Set((keyframeIds || []).map(String));
  const track = clip.tracks.find((item) => item.trackId === String(trackId));
  if (!track || !ids.size) return clip;
  const moved = track.keyframes.map((key) => ids.has(key.id)
    ? { ...key, time: clampFinite(key.time + finiteNumber(deltaTime, 0), 0, clip.duration, key.time) }
    : key);
  const deduped = new Map();
  for (const key of moved.sort(byTimeThenId)) deduped.set(key.time.toFixed(6), key);
  track.keyframes = [...deduped.values()].sort(byTimeThenId);
  if (track.channel === 'rotation') applyTrackContinuity(track);
  clip.clipRevision += 1;
  return refreshClipAssetDescriptors(clip);
}

export function copyTrackKeyframes(clipInput, {
  trackId,
  keyframeIds = [],
  deltaTime = 0,
} = {}) {
  const clip = normalizeClip(clipInput);
  const ids = new Set((keyframeIds || []).map(String));
  const track = clip.tracks.find((item) => item.trackId === String(trackId));
  if (!track || !ids.size) return clip;
  const copies = track.keyframes.filter((key) => ids.has(key.id)).map((key) => ({
    ...clone(key),
    id: createId('key'),
    time: clampFinite(key.time + finiteNumber(deltaTime, 0), 0, clip.duration, key.time),
  }));
  const deduped = new Map(track.keyframes.map((key) => [key.time.toFixed(6), key]));
  for (const key of copies) deduped.set(key.time.toFixed(6), key);
  track.keyframes = [...deduped.values()].sort(byTimeThenId);
  if (track.channel === 'rotation') applyTrackContinuity(track);
  clip.clipRevision += 1;
  return refreshClipAssetDescriptors(clip);
}

export function deleteTrackKeyframes(clipInput, {
  trackId,
  keyframeIds = [],
} = {}) {
  const clip = normalizeClip(clipInput);
  const ids = new Set((keyframeIds || []).map(String));
  const track = clip.tracks.find((item) => item.trackId === String(trackId));
  if (!track || !ids.size) return clip;
  const before = track.keyframes.length;
  track.keyframes = track.keyframes.filter((key) => !ids.has(key.id));
  clip.tracks = clip.tracks.filter((item) => item.keyframes.length > 0);
  if (track.keyframes.length !== before) clip.clipRevision += 1;
  return refreshClipAssetDescriptors(clip);
}

export function scaleClipTimeRange(clipInput, {
  start = 0,
  end = null,
  scale = 1,
  anchor = null,
} = {}) {
  const clip = normalizeClip(clipInput);
  const rangeStart = clampFinite(start, 0, clip.duration, 0);
  const rangeEnd = clampFinite(end ?? clip.duration, rangeStart, clip.duration, clip.duration);
  const factor = clampFinite(scale, 0.05, 20, 1);
  const pivot = clampFinite(anchor ?? rangeStart, 0, clip.duration, rangeStart);
  const transformTime = (time) => {
    if (time < rangeStart - TIME_EPSILON || time > rangeEnd + TIME_EPSILON) return time;
    return Math.max(0, pivot + (time - pivot) * factor);
  };
  let maximum = clip.duration;
  for (const track of clip.tracks) {
    track.keyframes = track.keyframes.map((key) => ({ ...key, time: transformTime(key.time) })).sort(byTimeThenId);
    if (track.channel === 'rotation') applyTrackContinuity(track);
    maximum = Math.max(maximum, ...track.keyframes.map((key) => key.time));
  }
  clip.poseKeys = clip.poseKeys.map((key) => ({ ...key, time: transformTime(key.time) })).sort(byTimeThenId);
  clip.events = clip.events.map((event) => ({ ...event, time: transformTime(event.time) })).sort(byTimeThenId);
  clip.contacts = clip.contacts.map((contact) => ({
    ...contact,
    start: transformTime(contact.start),
    end: transformTime(contact.end),
  })).sort(byContactTimeThenId);
  maximum = Math.max(maximum, ...clip.poseKeys.map((key) => key.time), ...clip.events.map((event) => event.time), ...clip.contacts.map((contact) => contact.end));
  clip.duration = Math.max(0.01, maximum);
  clip.clipRevision += 1;
  return normalizeClip(refreshClipAssetDescriptors(clip));
}

export function mirrorAnimationClip(clipInput, {
  clipId = null,
  name = null,
} = {}) {
  const clip = normalizeClip(clipInput);
  const mirrored = clone(clip);
  mirrored.clipId = sanitizeId(clipId || `${clip.clipId}-mirrored`, `${clip.clipId}-mirrored`);
  mirrored.name = String(name || `${clip.name} Mirrored`);
  mirrored.clipRevision = 1;
  mirrored.tracks = clip.tracks.map((track) => {
    const jointId = MIRROR_JOINTS[track.jointId] || track.jointId;
    return {
      ...clone(track),
      trackId: `${jointId}:${track.channel}`,
      jointId,
      keyframes: track.keyframes.map((key) => ({
        ...clone(key),
        id: createId('key'),
        value: track.channel === 'rotation'
          ? mirrorQuaternionSagittal(key.value)
          : [-finiteNumber(key.value?.[0], 0), finiteNumber(key.value?.[1], 0), finiteNumber(key.value?.[2], 0)],
      })),
    };
  });
  mirrored.events = clip.events.map((event) => ({
    ...clone(event),
    id: createId('event'),
    payload: mirrorPayload(event.payload),
  }));
  mirrored.contacts = clip.contacts.map((contact) => ({
    ...clone(contact),
    id: createId('contact'),
    jointId: MIRROR_JOINTS[contact.jointId] || contact.jointId,
    groundNormal: [-contact.groundNormal[0], contact.groundNormal[1], contact.groundNormal[2]],
  }));
  mirrored.semanticChannels = mirrorSemanticMotionChannels(clip.semanticChannels);
  mirrored.poseKeys = [];
  mirrored.poseSnapshots = [];
  mirrored.metadata = { ...mirrored.metadata, mirroredFrom: clip.clipId };
  return normalizeClip(mirrored);
}

export function compressAnimationClip(clipInput, {
  quaternionToleranceDegrees = 0.35,
  positionToleranceMeters = 0.001,
} = {}) {
  const clip = normalizeClip(clipInput);
  const angularTolerance = clampFinite(quaternionToleranceDegrees, 0, 30, 0.35) * Math.PI / 180;
  const positionTolerance = clampFinite(positionToleranceMeters, 0, 1, 0.001);
  let removed = 0;
  for (const track of clip.tracks) {
    if (track.keyframes.length <= 2) continue;
    const original = track.keyframes;
    const kept = [original[0]];
    for (let index = 1; index < original.length - 1; index += 1) {
      const previous = kept.at(-1);
      const current = original[index];
      const next = original[index + 1];
      const span = Math.max(TIME_EPSILON, next.time - previous.time);
      const alpha = (current.time - previous.time) / span;
      const predicted = track.channel === 'rotation'
        ? slerpQuaternion(previous.value, next.value, alpha)
        : lerpVector(previous.value, next.value, alpha, 3);
      const error = track.channel === 'rotation'
        ? quaternionAngularDistance(predicted, current.value)
        : Math.hypot(...current.value.map((value, component) => value - predicted[component]));
      const tolerance = track.channel === 'rotation' ? angularTolerance : positionTolerance;
      if (error <= tolerance) removed += 1;
      else kept.push(current);
    }
    kept.push(original.at(-1));
    track.keyframes = kept;
    if (track.channel === 'rotation') applyTrackContinuity(track);
  }
  clip.clipRevision += 1;
  clip.metadata = { ...clip.metadata, compression: { removed, quaternionToleranceDegrees, positionToleranceMeters } };
  return refreshClipAssetDescriptors(clip);
}

export function setAnimationLayer(animationInput, layerId, patch = {}) {
  const animation = normalizeAnimationState(animationInput);
  const index = animation.layers.findIndex((layer) => layer.layerId === String(layerId));
  const available = new Set(animation.clips.map((clip) => clip.clipId));
  const current = index >= 0 ? animation.layers[index] : { layerId: String(layerId), priority: animation.layers.length };
  const normalized = normalizeAnimationLayer({ ...current, ...clone(patch), layerId: String(layerId) }, index >= 0 ? index : animation.layers.length, available);
  if (index >= 0) animation.layers[index] = normalized;
  else animation.layers.push(normalized);
  animation.layers.sort((a, b) => a.priority - b.priority || a.layerId.localeCompare(b.layerId));
  return syncLegacyAnimationFields(animation);
}

export function setGraphParameter(animationInput, parameter, value) {
  const animation = normalizeAnimationState(animationInput);
  if (animation.graph.controlMode !== 'graph') {
    const activeState = animation.graph.states.find((state) => state.stateId === animation.graph.activeStateId)
      || animation.graph.states[0]
      || null;
    const activeClip = animation.clips.find((clip) => clip.clipId === activeState?.clipId) || null;
    animation.graph.controlMode = 'graph';
    animation.graph.transition = null;
    if (activeClip) {
      animation.activeClipId = activeClip.clipId;
      animation.transport.playing = false;
      animation.transport.time = 0;
      animation.transport.rawTime = 0;
      animation.transport.anchorTime = 0;
      animation.transport.anchorRawTime = 0;
      animation.transport.anchorIssuedAt = 0;
      animation.transport.loopStart = 0;
      animation.transport.loopEnd = activeClip.duration;
      animation.transport.loop = activeState?.loop !== false && activeClip.loopMode !== 'once';
    }
  }
  animation.graph.parameters[String(parameter)] = clone(value);
  return syncLegacyAnimationFields(animation);
}

export function beginGraphTransition(animationInput, toStateId, {
  duration = 0.2,
  nowMs = Date.now(),
  fromTime = null,
  toTime = 0,
} = {}) {
  const animation = normalizeAnimationState(animationInput);
  animation.graph.controlMode = 'graph';
  const target = animation.graph.states.find((state) => state.stateId === String(toStateId));
  if (!target || target.stateId === animation.graph.activeStateId) return animation;
  animation.graph.transition = {
    transitionId: `${animation.graph.activeStateId}-to-${target.stateId}-${Math.trunc(nowMs)}`,
    fromStateId: animation.graph.activeStateId,
    toStateId: target.stateId,
    duration: clampFinite(duration, 0, 10, 0.2),
    startedAt: Math.max(0, finiteNumber(nowMs, Date.now())),
    fromTime: fromTime == null ? computeTransportTime(animation, nowMs) : Math.max(0, finiteNumber(fromTime, 0)),
    toTime: Math.max(0, finiteNumber(toTime, 0)),
  };
  animation.graph.activeStateId = target.stateId;
  animation.graph.stateStartedAt = Math.max(0, finiteNumber(nowMs, Date.now()));
  animation.activeClipId = target.clipId || animation.activeClipId;
  return syncLegacyAnimationFields(animation);
}

export function finishGraphTransition(animationInput) {
  const animation = normalizeAnimationState(animationInput);
  animation.graph.transition = null;
  return syncLegacyAnimationFields(animation);
}

export function validateAnimationClip(input) {
  const errors = [];
  const warnings = [];
  const source = isPlainObject(input) ? input : {};
  const duration = Number(source.duration);
  const tracks = Array.isArray(source.tracks) ? source.tracks : [];
  const poseKeys = Array.isArray(source.poseKeys) ? source.poseKeys : [];
  const poseSnapshots = Array.isArray(source.poseSnapshots) ? source.poseSnapshots : [];
  const events = Array.isArray(source.events) ? source.events : [];
  const contacts = Array.isArray(source.contacts) ? source.contacts : [];
  const semanticChannels = normalizeSemanticMotionChannels(
    source.semanticChannels || source.semantic_channels,
    { clip: source },
  );
  const assetMetadata = source.assetMetadata || source.asset_metadata || normalizeAnimationAssetMetadata({}, {
    clip: { ...source, semanticChannels },
  });

  if (!source.clipId || !STABLE_JOINT_ID.test(String(source.clipId))) errors.push('CLIP_ID_INVALID');
  if (!Number.isFinite(duration) || duration <= 0) errors.push('DURATION_INVALID');
  if (!source.compatibleRig) errors.push('COMPATIBLE_RIG_MISSING');
  if (source.loopMode && !LOOP_MODES.has(source.loopMode)) errors.push('LOOP_MODE_INVALID');
  if (source.rootMotionMode && !ROOT_MOTION_MODES.has(source.rootMotionMode)) errors.push('ROOT_MOTION_MODE_INVALID');

  const trackIds = new Set();
  const trackSnapshotRefs = [];
  let keyframeCount = 0;
  for (const track of tracks) {
    const trackId = String(track?.trackId || '');
    const jointId = String(track?.jointId || '');
    const channel = String(track?.channel || '');
    const space = String(track?.space || '');
    if (!trackId) errors.push('TRACK_ID_MISSING');
    else if (trackIds.has(trackId)) errors.push(`TRACK_ID_DUPLICATE:${trackId}`);
    else trackIds.add(trackId);
    if (!STABLE_JOINT_ID.test(jointId)) errors.push(`JOINT_ID_INVALID:${jointId || 'empty'}`);
    if (!CHANNELS.has(channel)) errors.push(`CHANNEL_FORBIDDEN:${channel || 'empty'}`);
    if (channel === 'rotation' && space !== 'local') errors.push(`ROTATION_SPACE_NOT_LOCAL:${trackId}`);
    if (channel === 'position' && !ROOT_JOINT_IDS.has(jointId)) errors.push(`NON_ROOT_POSITION_TRACK:${trackId}`);
    if (channel === 'rotation' && track?.interpolation && !['slerp', 'step'].includes(track.interpolation)) errors.push(`ROTATION_INTERPOLATION_INVALID:${trackId}`);
    if (channel === 'position' && track?.interpolation && !['linear', 'step'].includes(track.interpolation)) errors.push(`POSITION_INTERPOLATION_INVALID:${trackId}`);
    const keys = readRawTrackKeys(track);
    keyframeCount += keys.length;
    let previousTime = -Infinity;
    for (const key of keys) {
      const time = Number(key?.time);
      if (!Number.isFinite(time)) errors.push(`KEYFRAME_TIME_INVALID:${trackId}`);
      else {
        if (time < previousTime) errors.push(`KEYFRAME_TIME_UNSORTED:${trackId}`);
        if (time < -TIME_EPSILON || time > duration + TIME_EPSILON) errors.push(`KEYFRAME_OUT_OF_RANGE:${trackId}:${time}`);
        if (Math.abs(time - previousTime) <= TIME_EPSILON) errors.push(`KEYFRAME_TIME_DUPLICATE:${trackId}:${time}`);
        previousTime = time;
      }
      if (key?.sourceSnapshotId) {
        trackSnapshotRefs.push({
          trackId,
          snapshotId: String(key.sourceSnapshotId),
        });
      }
      const value = key?.value;
      if (channel === 'rotation') {
        if (!Array.isArray(value) || value.length !== 4 || value.some((item) => !Number.isFinite(Number(item)))) {
          errors.push(`QUATERNION_INVALID:${trackId}:${time}`);
        } else {
          const length = quaternionLength(value);
          if (length < 1e-8) errors.push(`QUATERNION_ZERO:${trackId}:${time}`);
          else if (Math.abs(length - 1) > 0.001) warnings.push(`QUATERNION_NOT_NORMALIZED:${trackId}:${time}`);
        }
      } else if (channel === 'position') {
        if (!Array.isArray(value) || value.length !== 3 || value.some((item) => !Number.isFinite(Number(item)))) {
          errors.push(`POSITION_INVALID:${trackId}:${time}`);
        }
      }
    }
  }

  const snapshotIds = new Set();
  for (const snapshot of poseSnapshots) {
    const id = String(snapshot?.snapshotId || '');
    if (!id) errors.push('POSE_SNAPSHOT_ID_MISSING');
    else if (snapshotIds.has(id)) errors.push(`POSE_SNAPSHOT_ID_DUPLICATE:${id}`);
    else snapshotIds.add(id);
    if (snapshot?.compatibleRig && source.compatibleRig && snapshot.compatibleRig !== source.compatibleRig) {
      warnings.push(`POSE_SNAPSHOT_RIG_MISMATCH:${id}`);
    }
  }
  for (const reference of trackSnapshotRefs) {
    if (!snapshotIds.has(reference.snapshotId)) {
      errors.push(`TRACK_SOURCE_SNAPSHOT_REF_MISSING:${reference.trackId}:${reference.snapshotId}`);
    }
  }

  let previousPoseTime = -Infinity;
  for (const key of poseKeys) {
    const time = Number(key?.time);
    if (!snapshotIds.has(String(key?.snapshotId || ''))) errors.push(`POSE_SNAPSHOT_REF_MISSING:${key?.snapshotId || 'empty'}`);
    if (!Number.isFinite(time) || time < -TIME_EPSILON || time > duration + TIME_EPSILON) errors.push(`POSE_KEY_TIME_INVALID:${time}`);
    if (time < previousPoseTime) errors.push('POSE_KEYS_UNSORTED');
    previousPoseTime = time;
  }

  let previousEventTime = -Infinity;
  for (const event of events) {
    const time = Number(event?.time);
    if (!Number.isFinite(time) || time < -TIME_EPSILON || time > duration + TIME_EPSILON) errors.push(`EVENT_TIME_INVALID:${time}`);
    if (time < previousEventTime) warnings.push('EVENTS_UNSORTED');
    if (!event?.type) errors.push('EVENT_TYPE_MISSING');
    previousEventTime = time;
  }


  const contactIds = new Set();
  for (const contact of contacts) {
    const id = String(contact?.id || '');
    const start = Number(contact?.start);
    const end = Number(contact?.end);
    if (!id) errors.push('CONTACT_ID_MISSING');
    else if (contactIds.has(id)) errors.push(`CONTACT_ID_DUPLICATE:${id}`);
    else contactIds.add(id);
    if (!STABLE_JOINT_ID.test(String(contact?.jointId || ''))) errors.push(`CONTACT_JOINT_INVALID:${id || 'empty'}`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < -TIME_EPSILON || end > duration + TIME_EPSILON || end < start) {
      errors.push(`CONTACT_RANGE_INVALID:${id || 'empty'}`);
    }
    if (contact?.mode && !CONTACT_MODES.has(contact.mode)) errors.push(`CONTACT_MODE_INVALID:${id || 'empty'}`);
  }

  const metadataReport = validateAnimationAssetMetadata(assetMetadata, { clip: source });
  errors.push(...metadataReport.errors);
  warnings.push(...metadataReport.warnings);
  const semanticReport = validateSemanticMotionChannels(semanticChannels, { clip: source });
  errors.push(...semanticReport.errors);
  warnings.push(...semanticReport.warnings);

  if (!tracks.length && !poseKeys.length) warnings.push('CLIP_HAS_NO_KEYS');
  return {
    valid: errors.length === 0,
    errors: unique(errors),
    warnings: unique(warnings),
    stats: {
      tracks: tracks.length,
      keyframes: keyframeCount,
      poseKeys: poseKeys.length,
      poseSnapshots: poseSnapshots.length,
      events: events.length,
      contacts: contacts.length,
      semanticChannels: semanticChannels.length,
    },
  };
}

export function sampleAnimationClip(clipInput, time, { loopMode = null } = {}) {
  const clip = isNormalizedAnimationClip(clipInput) ? clipInput : normalizeClip(clipInput);
  const resolvedTime = resolveClipTime(time, clip.duration, loopMode || clip.loopMode);
  const joints = {};
  const root = { jointId: clip.rootJointId, position: null, rotation: null };
  for (const track of clip.tracks) {
    const value = sampleTrack(track, resolvedTime);
    if (!value) continue;
    const isRootTrack = track.jointId === clip.rootJointId || ROOT_JOINT_IDS.has(track.jointId);
    if (track.channel === 'position' && isRootTrack) {
      root.jointId = track.jointId;
      root.position = value;
    } else if (track.channel === 'rotation' && isRootTrack) {
      root.jointId = track.jointId;
      root.rotation = value;
    } else if (track.channel === 'rotation') {
      joints[track.jointId] = { rotation: value };
    }
  }
  return {
    clipId: clip.clipId,
    compatibleRig: clip.compatibleRig,
    time: resolvedTime,
    root,
    joints,
    localRotations: Object.fromEntries(Object.entries(joints).map(([id, value]) => [id, clone(value.rotation)])),
  };
}

export function sampleTrack(trackInput, time) {
  const track = isNormalizedTrack(trackInput) ? trackInput : normalizeTrack(trackInput);
  const keys = track.keyframes;
  if (!keys.length) return null;
  if (keys.length === 1 || time <= keys[0].time) return clone(keys[0].value);
  if (time >= keys.at(-1).time) return clone(keys.at(-1).value);
  let rightIndex = 1;
  while (rightIndex < keys.length && keys[rightIndex].time < time) rightIndex += 1;
  const left = keys[rightIndex - 1];
  const right = keys[rightIndex];
  const span = Math.max(TIME_EPSILON, right.time - left.time);
  const alpha = (time - left.time) / span;
  if (track.interpolation === 'step') return clone(left.value);
  if (track.channel === 'rotation') return slerpQuaternion(left.value, right.value, alpha);
  return lerpVector(left.value, right.value, alpha, 3);
}

export function samplePoseSnapshotClip(clipInput, time, { loopMode = null } = {}) {
  const clip = isNormalizedAnimationClip(clipInput) ? clipInput : normalizeClip(clipInput);
  const keys = clip.poseKeys;
  if (!keys.length) return null;
  const resolvedTime = resolveClipTime(time, clip.duration, loopMode || clip.loopMode);
  const lookup = new Map(clip.poseSnapshots.map((snapshot) => [snapshot.snapshotId, snapshot]));
  if (keys.length === 1 || resolvedTime <= keys[0].time) return poseSnapshotResult(clip, resolvedTime, lookup.get(keys[0].snapshotId));
  if (resolvedTime >= keys.at(-1).time) return poseSnapshotResult(clip, resolvedTime, lookup.get(keys.at(-1).snapshotId));

  let rightIndex = 1;
  while (rightIndex < keys.length && keys[rightIndex].time < resolvedTime) rightIndex += 1;
  const leftKey = keys[rightIndex - 1];
  const rightKey = keys[rightIndex];
  const left = lookup.get(leftKey.snapshotId);
  const right = lookup.get(rightKey.snapshotId);
  if (!left || !right) return poseSnapshotResult(clip, resolvedTime, left || right || null);
  const span = Math.max(TIME_EPSILON, rightKey.time - leftKey.time);
  const alpha = (resolvedTime - leftKey.time) / span;
  return interpolatePoseSnapshots(clip, resolvedTime, left, right, alpha);
}

export function getEventsBetween(clipInput, fromTime, toTime, { loopMode = null } = {}) {
  const clip = isNormalizedAnimationClip(clipInput) ? clipInput : normalizeClip(clipInput);
  if (!clip.events.length || toTime === fromTime) return [];
  const mode = loopMode || clip.loopMode;
  if (mode !== 'repeat' || toTime >= fromTime) {
    const start = Math.min(fromTime, toTime);
    const end = Math.max(fromTime, toTime);
    return clip.events.filter((event) => event.time > start + TIME_EPSILON && event.time <= end + TIME_EPSILON).map(clone);
  }
  return [
    ...clip.events.filter((event) => event.time > fromTime + TIME_EPSILON),
    ...clip.events.filter((event) => event.time <= toTime + TIME_EPSILON),
  ].map(clone);
}

export function resolveClipTime(time, duration, loopMode = 'once') {
  return resolveClipPhase(time, duration, loopMode).time;
}

export function resolveClipPhase(time, duration, loopMode = 'once') {
  const safeDuration = clampFinite(duration, 0.01, 3600, 1);
  const raw = finiteNumber(time, 0);
  if (loopMode === 'repeat') {
    const cycles = Math.floor(raw / safeDuration);
    return { time: positiveModulo(raw, safeDuration), cycles, direction: 1, rawTime: raw };
  }
  if (loopMode === 'pingpong') {
    const halfCycles = Math.floor(raw / safeDuration);
    const cycle = positiveModulo(raw, safeDuration * 2);
    return {
      time: cycle <= safeDuration ? cycle : safeDuration * 2 - cycle,
      cycles: Math.floor(halfCycles / 2),
      direction: cycle <= safeDuration ? 1 : -1,
      rawTime: raw,
    };
  }
  return {
    time: Math.min(safeDuration, Math.max(0, raw)),
    cycles: 0,
    direction: raw < 0 ? -1 : 1,
    rawTime: raw,
  };
}

export function computeTransportRawTime(animationInput, nowMs = Date.now()) {
  const animation = isNormalizedAnimationState(animationInput)
    ? animationInput
    : normalizeAnimationState(animationInput);
  const transport = animation.transport;
  if (!transport.playing || !transport.anchorIssuedAt) {
    return finiteNumber(transport.anchorRawTime ?? transport.time, transport.time || 0);
  }
  const elapsed = (Number(nowMs) - transport.anchorIssuedAt) / 1000;
  return finiteNumber(transport.anchorRawTime ?? transport.anchorTime, 0) + elapsed * transport.speed;
}

export function computeTransportTime(animationInput, nowMs = Date.now()) {
  const animation = isNormalizedAnimationState(animationInput)
    ? animationInput
    : normalizeAnimationState(animationInput);
  const clip = getActiveClip(animation);
  const raw = computeTransportRawTime(animation, nowMs);
  return resolveTransportTime(raw, clip, animation.transport);
}

export function resolveTransportPlaybackStart(animationInput, nowMs = Date.now()) {
  const animation = isNormalizedAnimationState(animationInput)
    ? animationInput
    : normalizeAnimationState(animationInput);
  const transport = animation.transport;
  const rawTime = computeTransportRawTime(animation, nowMs);
  const time = computeTransportTime(animation, nowMs);
  if (transport.playing || transport.loop) return { time, rawTime, restarted: false };
  if (transport.speed >= 0 && time >= transport.loopEnd - TIME_EPSILON) {
    return { time: transport.loopStart, rawTime: transport.loopStart, restarted: true };
  }
  if (transport.speed < 0 && time <= transport.loopStart + TIME_EPSILON) {
    return { time: transport.loopEnd, rawTime: transport.loopEnd, restarted: true };
  }
  return { time, rawTime, restarted: false };
}

export function setTransport(animationInput, patch = {}, nowMs = Date.now()) {
  const animation = normalizeAnimationState(animationInput);
  const clip = getActiveClip(animation);
  const currentRaw = computeTransportRawTime(animation, nowMs);
  const currentTime = resolveTransportTime(currentRaw, clip, animation.transport);
  animation.transport = {
    ...animation.transport,
    ...clone(patch),
  };
  animation.transport.speed = clampFinite(animation.transport.speed, -4, 4, 1);
  animation.transport.loop = animation.transport.loop !== false;
  animation.transport.loopStart = clampFinite(animation.transport.loopStart, 0, clip.duration, 0);
  animation.transport.loopEnd = clampFinite(animation.transport.loopEnd, 0, clip.duration, clip.duration);
  if (animation.transport.loopEnd <= animation.transport.loopStart + TIME_EPSILON) {
    animation.transport.loopStart = 0;
    animation.transport.loopEnd = clip.duration;
  }
  const requestedRaw = finiteNumber(patch.anchorRawTime ?? patch.time ?? currentRaw, currentRaw);
  animation.transport.anchorRawTime = requestedRaw;
  animation.transport.time = resolveTransportTime(
    finiteNumber(patch.time ?? requestedRaw, currentTime),
    clip,
    animation.transport,
  );
  animation.transport.anchorTime = resolveTransportTime(
    finiteNumber(patch.anchorTime ?? requestedRaw, animation.transport.time),
    clip,
    animation.transport,
  );
  animation.transport.anchorIssuedAt = animation.transport.playing
    ? Math.max(0, finiteNumber(patch.anchorIssuedAt, nowMs))
    : 0;
  return syncLegacyAnimationFields(animation);
}

export function resolveTransportTime(rawTime, clipInput, transportInput = {}) {
  const clip = isNormalizedAnimationClip(clipInput) ? clipInput : normalizeClip(clipInput);
  const transport = isPlainObject(transportInput) ? transportInput : {};
  const loopEnabled = transport.loop !== false;
  if (!loopEnabled) return resolveClipTime(rawTime, clip.duration, 'once');
  const start = clampFinite(transport.loopStart, 0, clip.duration, 0);
  const end = clampFinite(transport.loopEnd, start, clip.duration, clip.duration);
  const length = Math.max(TIME_EPSILON, end - start);
  const relative = finiteNumber(rawTime, start) - start;
  if (clip.loopMode === 'pingpong') {
    const cycle = positiveModulo(relative, length * 2);
    return start + (cycle <= length ? cycle : length * 2 - cycle);
  }
  if (clip.loopMode === 'repeat') return start + positiveModulo(relative, length);
  return Math.min(end, Math.max(start, finiteNumber(rawTime, start)));
}

export function serializeMotionClip(clipInput, {
  projectId = 'humanoid-rig-lab-next',
  subjectId = 'default-character',
} = {}) {
  const clip = isNormalizedAnimationClip(clipInput) ? clipInput : normalizeClip(clipInput);
  return {
    schema: MOTION_CLIP_SCHEMA,
    project_id: String(projectId),
    subject_id: String(subjectId),
    clip_id: clip.clipId,
    name: clip.name,
    clip_revision: clip.clipRevision,
    skeleton_profile: clip.compatibleRig,
    source_proportion_revision: clip.sourceProportionRevision,
    duration: clip.duration,
    sample_rate_hint: clip.sampleRateHint,
    loop_mode: clip.loopMode,
    root_motion_mode: clip.rootMotionMode,
    root_joint_id: clip.rootJointId,
    asset_metadata: clone(clip.assetMetadata),
    semantic_channels: clip.semanticChannels.map((channel) => clone(channel)),
    tracks: clip.tracks.map((track) => ({
      track_id: track.trackId,
      joint_id: track.jointId,
      channel: track.channel,
      space: track.space,
      interpolation: track.interpolation,
      keyframe_ids: track.keyframes.map((key) => key.id),
      times: track.keyframes.map((key) => key.time),
      values: track.keyframes.map((key) => clone(key.value)),
      source_snapshot_ids: track.keyframes.map((key) => key.sourceSnapshotId),
    })),
    events: clip.events.map((event) => ({
      event_id: event.id,
      time: event.time,
      type: event.type,
      payload: clone(event.payload),
    })),
    contacts: clip.contacts.map((contact) => ({
      contact_id: contact.id,
      joint_id: contact.jointId,
      start: contact.start,
      end: contact.end,
      mode: contact.mode,
      position_weight: contact.positionWeight,
      rotation_weight: contact.rotationWeight,
      ground_normal: clone(contact.groundNormal),
      metadata: clone(contact.metadata),
    })),
    pose_snapshot_keys: clip.poseKeys.map((key) => ({
      keyframe_id: key.id,
      time: key.time,
      snapshot_id: key.snapshotId,
    })),
    pose_snapshot_refs: clip.poseSnapshots.map((snapshot) => clone(snapshot)),
    retarget_policy: clone(clip.retargetPolicy),
    quality: clone(clip.quality),
    metadata: clone(clip.metadata),
  };
}

export function importMotionClip(asset) {
  if (!isPlainObject(asset)) throw new Error('MotionClip asset must be an object.');
  const tracks = Array.isArray(asset.tracks) ? asset.tracks.map((track) => {
    const times = Array.isArray(track.times) ? track.times : [];
    const values = Array.isArray(track.values) ? track.values : [];
    const ids = Array.isArray(track.keyframe_ids) ? track.keyframe_ids : [];
    const sources = Array.isArray(track.source_snapshot_ids) ? track.source_snapshot_ids : [];
    return {
      trackId: track.track_id,
      jointId: track.joint_id,
      channel: track.channel,
      space: track.space,
      interpolation: track.interpolation,
      keyframes: times.map((time, index) => ({
        id: ids[index] || `key-${index + 1}`,
        time,
        value: values[index],
        sourceSnapshotId: sources[index] || null,
      })),
    };
  }) : [];
  const clip = {
    schema: ANIMATION_CLIP_SCHEMA,
    type: 'AnimationClip',
    clipId: asset.clip_id,
    name: asset.name,
    clipRevision: asset.clip_revision,
    compatibleRig: asset.skeleton_profile,
    sourceProportionRevision: asset.source_proportion_revision,
    duration: asset.duration,
    sampleRateHint: asset.sample_rate_hint,
    loopMode: asset.loop_mode,
    rootMotionMode: asset.root_motion_mode,
    rootJointId: asset.root_joint_id,
    assetMetadata: asset.asset_metadata,
    semanticChannels: asset.semantic_channels,
    tracks,
    events: Array.isArray(asset.events) ? asset.events.map((event) => ({
      id: event.event_id,
      time: event.time,
      type: event.type,
      payload: event.payload,
    })) : [],
    contacts: Array.isArray(asset.contacts) ? asset.contacts.map((contact) => ({
      id: contact.contact_id,
      jointId: contact.joint_id,
      start: contact.start,
      end: contact.end,
      mode: contact.mode,
      positionWeight: contact.position_weight,
      rotationWeight: contact.rotation_weight,
      groundNormal: contact.ground_normal,
      metadata: contact.metadata,
    })) : [],
    poseKeys: Array.isArray(asset.pose_snapshot_keys) ? asset.pose_snapshot_keys.map((key) => ({
      id: key.keyframe_id,
      time: key.time,
      snapshotId: key.snapshot_id,
    })) : [],
    poseSnapshots: Array.isArray(asset.pose_snapshot_refs) ? asset.pose_snapshot_refs : [],
    retargetPolicy: asset.retarget_policy,
    quality: asset.quality,
    metadata: asset.metadata,
  };
  return normalizeClip(clip, { compatibleRig: asset.skeleton_profile });
}

export function syncLegacyAnimationFields(animationInput) {
  const animation = isPlainObject(animationInput) ? animationInput : {};
  const clips = Array.isArray(animation.clips) ? animation.clips : [];
  const active = clips.find((clip) => clip.clipId === animation.activeClipId) || clips[0] || createEmptyClip();
  animation.activeClipId = active.clipId;
  animation.clip = active.clipId;
  animation.playing = Boolean(animation.transport?.playing);
  animation.time = finiteNumber(animation.transport?.time, 0);
  animation.duration = active.duration;
  animation.speed = finiteNumber(animation.transport?.speed, 1);
  animation.loop = animation.transport?.loop !== false;
  animation.keyframes = active.poseKeys.map((key) => {
    const snapshot = active.poseSnapshots.find((item) => item.snapshotId === key.snapshotId);
    return {
      id: key.id,
      time: key.time,
      poseName: snapshot?.poseName || 'Pose Snapshot',
      snapshotId: key.snapshotId,
      sourcePoseVersion: snapshot?.sourcePoseVersion || 'pose@unknown',
    };
  });
  return animation;
}

function createRotationTrack(jointId, entries) {
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

function isNormalizedTrack(value) {
  return Boolean(value)
    && typeof value.trackId === 'string'
    && typeof value.jointId === 'string'
    && Array.isArray(value.keyframes)
    && value.keyframes.every((key) => Array.isArray(key?.value) && Number.isFinite(Number(key?.time)));
}

function normalizeTrack(input) {
  const source = isPlainObject(input) ? input : {};
  const channel = String(source.channel || 'rotation');
  const jointId = sanitizeId(source.jointId || source.joint_id, 'unknownJoint');
  const rawKeys = readRawTrackKeys(source);
  const keyframes = rawKeys.map((key, index) => ({
    id: String(key?.id || key?.keyframeId || createStableFallbackId(`${jointId}-${channel}`, index)),
    time: finiteNumber(key?.time, 0),
    value: channel === 'rotation' ? normalizeQuaternion(key?.value) : normalizeVector(key?.value, 3),
    sourceSnapshotId: key?.sourceSnapshotId ? String(key.sourceSnapshotId) : null,
  })).sort(byTimeThenId);
  if (channel === 'rotation') {
    const continuous = ensureQuaternionContinuity(keyframes.map((key) => key.value));
    keyframes.forEach((key, index) => { key.value = continuous[index]; });
  }
  return {
    trackId: String(source.trackId || source.track_id || `${jointId}:${channel}`),
    jointId,
    channel,
    space: String(source.space || (channel === 'rotation' ? 'local' : 'root')),
    interpolation: String(source.interpolation || (channel === 'rotation' ? 'slerp' : 'linear')),
    keyframes,
  };
}

function readRawTrackKeys(track) {
  if (Array.isArray(track?.keyframes)) return track.keyframes;
  const times = Array.isArray(track?.times) ? track.times : [];
  const values = Array.isArray(track?.values) ? track.values : [];
  return times.map((time, index) => ({
    id: track?.keyframeIds?.[index] || track?.keyframe_ids?.[index],
    time,
    value: values[index],
    sourceSnapshotId: track?.sourceSnapshotIds?.[index] || track?.source_snapshot_ids?.[index] || null,
  }));
}

function normalizePoseSnapshotReference(input) {
  const source = isPlainObject(input) ? clone(input) : {};
  return {
    ...source,
    schema: String(source.schema || POSE_SNAPSHOT_REF_SCHEMA),
    type: String(source.type || 'PoseSnapshotRef'),
    snapshotId: String(source.snapshotId || createId('pose')),
    compatibleRig: String(source.compatibleRig || 'unknown-rig'),
    sourcePoseVersion: String(source.sourcePoseVersion || 'pose@unknown'),
    sourceUpdatedAt: String(source.sourceUpdatedAt || source.capturedAt || new Date(0).toISOString()),
    capturedAt: String(source.capturedAt || source.sourceUpdatedAt || new Date(0).toISOString()),
    poseName: String(source.poseName || 'Pose Snapshot'),
    format: String(source.format || source.cache?.format || 'unknown'),
    jointIds: Array.isArray(source.jointIds) ? source.jointIds.map(String) : [],
    contentHash: String(source.contentHash || ''),
    storage: String(source.storage || 'embedded-readonly-cache'),
    cache: isPlainObject(source.cache) ? clone(source.cache) : null,
  };
}

function normalizePoseKey(input, duration) {
  const source = isPlainObject(input) ? input : {};
  return {
    id: String(source.id || createId('pose-key')),
    time: clampFinite(source.time, 0, duration, 0),
    snapshotId: String(source.snapshotId || ''),
  };
}

function normalizeEvent(input, duration) {
  const source = isPlainObject(input) ? input : {};
  return {
    id: String(source.id || source.eventId || createId('event')),
    time: clampFinite(source.time, 0, duration, 0),
    type: String(source.type || 'marker'),
    payload: clone(source.payload ?? null),
  };
}

function migrateLegacyPoseKeys(clipInput, legacyKeys, { compatibleRig, sourcePoseVersion }) {
  let clip = normalizeClip(clipInput, { compatibleRig });
  for (const legacy of legacyKeys) {
    const pose = {
      name: legacy?.poseName || 'Legacy Pose Snapshot',
      joints: isPlainObject(legacy?.pose) ? legacy.pose : {},
      pinned: [],
      v8Payload: isPlainObject(legacy?.v8Payload) ? legacy.v8Payload : null,
    };
    clip = addPoseSnapshotKey(clip, {
      time: legacy?.time,
      pose,
      compatibleRig,
      sourcePoseVersion: legacy?.sourcePoseVersion || sourcePoseVersion,
      capturedAt: legacy?.capturedAt || new Date(0).toISOString(),
      keyframeId: legacy?.id,
      snapshotId: legacy?.snapshotId || `legacy-${legacy?.id || simpleHash(stableStringify(legacy))}`,
    });
  }
  return clip;
}

function poseSnapshotResult(clip, time, snapshot) {
  if (!snapshot) return null;
  return {
    clipId: clip.clipId,
    time,
    format: snapshot.format,
    snapshotIds: [snapshot.snapshotId],
    alpha: 0,
    payload: clone(snapshot.cache),
  };
}

function interpolatePoseSnapshots(clip, time, left, right, alpha) {
  if (left.format === 'local-quaternion@1' && right.format === 'local-quaternion@1') {
    const leftJoints = left.cache?.joints || {};
    const rightJoints = right.cache?.joints || {};
    const ids = new Set([...Object.keys(leftJoints), ...Object.keys(rightJoints)]);
    const joints = {};
    for (const id of ids) {
      const a = leftJoints[id]?.rotation || leftJoints[id] || [0, 0, 0, 1];
      const b = rightJoints[id]?.rotation || rightJoints[id] || a;
      joints[id] = { rotation: slerpQuaternion(a, b, alpha) };
    }
    return {
      clipId: clip.clipId,
      time,
      format: 'local-quaternion@1',
      snapshotIds: [left.snapshotId, right.snapshotId],
      alpha,
      payload: {
        type: 'PoseSnapshot',
        format: 'local-quaternion@1',
        poseName: `${clip.name} Preview`,
        pinned: alpha < 0.5 ? clone(left.cache?.pinned || []) : clone(right.cache?.pinned || []),
        root: {
          position: lerpVector(left.cache?.root?.position, right.cache?.root?.position, alpha, 3),
          rotation: slerpQuaternion(left.cache?.root?.rotation, right.cache?.root?.rotation, alpha),
        },
        joints,
      },
    };
  }
  if (left.format === 'v8-world-position@1' && right.format === 'v8-world-position@1') {
    const leftPayload = left.cache?.payload;
    const rightPayload = right.cache?.payload;
    if (!Array.isArray(leftPayload?.joints) || !Array.isArray(rightPayload?.joints)) return poseSnapshotResult(clip, time, alpha < 0.5 ? left : right);
    const rightById = new Map(rightPayload.joints.map((joint) => [String(joint?.id || ''), joint]));
    const leftIds = new Set();
    const joints = [];
    for (const leftJoint of leftPayload.joints) {
      const id = String(leftJoint?.id || '');
      if (!id) continue;
      leftIds.add(id);
      const rightJoint = rightById.get(id);
      const a = objectVectorToArray(leftJoint?.poseWorldPosition);
      const b = objectVectorToArray(rightJoint?.poseWorldPosition || leftJoint?.poseWorldPosition);
      const value = lerpVector(a, b, alpha, 3);
      joints.push({
        id,
        poseWorldPosition: { x: value[0], y: value[1], z: value[2] },
        pinned: alpha < 0.5 ? Boolean(leftJoint?.pinned) : Boolean(rightJoint?.pinned),
      });
    }
    for (const rightJoint of rightPayload.joints) {
      const id = String(rightJoint?.id || '');
      if (!id || leftIds.has(id)) continue;
      joints.push(clone(rightJoint));
    }
    return {
      clipId: clip.clipId,
      time,
      format: 'v8-world-position@1',
      snapshotIds: [left.snapshotId, right.snapshotId],
      alpha,
      payload: {
        type: 'PoseSnapshot',
        format: 'v8-world-position@1',
        poseName: `${clip.name} Preview`,
        pinned: [],
        payload: {
          schemaVersion: 1,
          type: 'humanoid-pose',
          rigName: leftPayload.rigName || rightPayload.rigName || 'Humanoid Rig',
          pose: 'CUSTOM',
          unit: 'meter',
          updatedAt: `animation:${clip.clipId}:${time.toFixed(4)}`,
          joints,
        },
      },
    };
  }

  if (left.format === 'preview-2d@1' && right.format === 'preview-2d@1') {
    const leftJoints = left.cache?.joints || {};
    const rightJoints = right.cache?.joints || {};
    const ids = new Set([...Object.keys(leftJoints), ...Object.keys(rightJoints)]);
    const joints = {};
    for (const id of ids) {
      const a = leftJoints[id] || rightJoints[id] || { x: 0, y: 0 };
      const b = rightJoints[id] || a;
      joints[id] = {
        x: finiteNumber(a.x, 0) + (finiteNumber(b.x, finiteNumber(a.x, 0)) - finiteNumber(a.x, 0)) * alpha,
        y: finiteNumber(a.y, 0) + (finiteNumber(b.y, finiteNumber(a.y, 0)) - finiteNumber(a.y, 0)) * alpha,
      };
    }
    return {
      clipId: clip.clipId,
      time,
      format: 'preview-2d@1',
      snapshotIds: [left.snapshotId, right.snapshotId],
      alpha,
      payload: {
        type: 'PoseSnapshot',
        format: 'preview-2d@1',
        poseName: `${clip.name} Preview`,
        pinned: [],
        joints,
      },
    };
  }

  return poseSnapshotResult(clip, time, alpha < 0.5 ? left : right);
}


function extractLocalQuaternionPose(source) {
  const raw = source.localRotations || source.local_rotations || source.v8Payload?.localRotations || source.v8Payload?.local_rotations;
  const joints = {};
  if (isPlainObject(raw)) {
    for (const [jointId, value] of Object.entries(raw)) {
      const rotation = isPlainObject(value) ? value.rotation : value;
      if ((Array.isArray(rotation) || ArrayBuffer.isView(rotation)) && rotation.length === 4) {
        joints[sanitizeId(jointId, 'joint')] = { rotation: normalizeQuaternion(rotation) };
      }
    }
  } else if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item?.id) continue;
      const rotation = item.rotation || item.value;
      if ((Array.isArray(rotation) || ArrayBuffer.isView(rotation)) && rotation.length === 4) {
        joints[sanitizeId(item.id, 'joint')] = { rotation: normalizeQuaternion(rotation) };
      }
    }
  }
  if (Array.isArray(source.joints)) {
    for (const item of source.joints) {
      if (!item?.id || !Array.isArray(item.rotation) || item.rotation.length !== 4) continue;
      joints[sanitizeId(item.id, 'joint')] = { rotation: normalizeQuaternion(item.rotation) };
    }
  }
  if (!Object.keys(joints).length) return null;
  const rootSource = source.root || {};
  return {
    root: {
      position: normalizeVector(rootSource.position || source.rootPosition || source.root_position || [0, 0, 0], 3),
      rotation: normalizeQuaternion(rootSource.rotation || source.rootRotation || source.root_rotation || [0, 0, 0, 1]),
    },
    joints,
  };
}

function refreshClipAssetDescriptors(clip, {
  assetMetadata = clip.assetMetadata,
  semanticChannels = clip.semanticChannels,
} = {}) {
  clip.semanticChannels = normalizeSemanticMotionChannels(semanticChannels, { clip });
  clip.assetMetadata = normalizeAnimationAssetMetadata(assetMetadata, { clip });
  return clip;
}

function normalizeRetargetPolicy(input) {
  const source = isPlainObject(input) ? input : {};
  return {
    mode: ['local_rotation', 'mapped_local_rotation'].includes(source.mode) ? source.mode : 'local_rotation',
    scaleRootMotionByHeight: source.scaleRootMotionByHeight ?? source.scale_root_motion_by_height ?? true,
    preserveContacts: source.preserveContacts ?? source.preserve_contacts ?? true,
    clampJointLimits: source.clampJointLimits ?? source.clamp_joint_limits ?? true,
    axisProfile: String(source.axisProfile || source.axis_profile || 'smpl24_controls28@1'),
    mapping: isPlainObject(source.mapping) ? clone(source.mapping) : {},
  };
}

function normalizeQuality(input) {
  const source = isPlainObject(input) ? input : {};
  return {
    validated: Boolean(source.validated),
    maxBoneLengthError: nullableFinite(source.maxBoneLengthError ?? source.max_bone_length_error),
    maxContactError: nullableFinite(source.maxContactError ?? source.max_contact_error),
    maxJointAngularVelocity: nullableFinite(source.maxJointAngularVelocity ?? source.max_joint_angular_velocity),
    warnings: Array.isArray(source.warnings) ? source.warnings.map(String) : [],
  };
}

function normalizeContact(input, duration) {
  const source = isPlainObject(input) ? input : {};
  const start = clampFinite(source.start ?? source.startTime ?? source.start_time, 0, duration, 0);
  const end = clampFinite(source.end ?? source.endTime ?? source.end_time, start, duration, duration);
  return {
    id: String(source.id || source.contactId || source.contact_id || createId('contact')),
    jointId: sanitizeId(source.jointId || source.joint_id, 'leftFoot'),
    start,
    end,
    mode: CONTACT_MODES.has(source.mode) ? source.mode : 'world_lock',
    positionWeight: clampFinite(source.positionWeight ?? source.position_weight, 0, 1, 1),
    rotationWeight: clampFinite(source.rotationWeight ?? source.rotation_weight, 0, 1, 0.65),
    groundNormal: normalizeVector(source.groundNormal ?? source.ground_normal ?? [0, 1, 0], 3),
    metadata: isPlainObject(source.metadata) ? clone(source.metadata) : {},
  };
}

function normalizeAnimationLayers(input, clips) {
  const available = new Set((clips || []).map((clip) => clip.clipId));
  const source = Array.isArray(input) && input.length ? input : createDefaultAnimationLayers();
  const normalized = source.map((layer, index) => normalizeAnimationLayer(layer, index, available));
  if (!normalized.some((layer) => layer.layerId === 'base')) {
    normalized.unshift(normalizeAnimationLayer(createDefaultAnimationLayers()[0], 0, available));
  }
  return normalized.sort((a, b) => a.priority - b.priority || a.layerId.localeCompare(b.layerId));
}

function normalizeAnimationLayer(input, index, availableClipIds) {
  const source = isPlainObject(input) ? input : {};
  const layerId = sanitizeId(source.layerId || source.layer_id || `layer-${index + 1}`, `layer-${index + 1}`);
  const clipId = source.clipId ?? source.clip_id ?? null;
  return {
    layerId,
    name: String(source.name || layerId),
    enabled: source.enabled !== false,
    clipId: clipId && availableClipIds.has(String(clipId)) ? String(clipId) : null,
    weight: clampFinite(source.weight, 0, 1, layerId === 'base' ? 1 : 0),
    blendMode: BLEND_MODES.has(source.blendMode || source.blend_mode) ? (source.blendMode || source.blend_mode) : 'override',
    mask: Array.isArray(source.mask) && source.mask.length ? unique(source.mask.map(String)) : ['*'],
    timeScale: clampFinite(source.timeScale ?? source.time_scale, -4, 4, 1) || 1,
    timeOffset: finiteNumber(source.timeOffset ?? source.time_offset, 0),
    priority: Math.trunc(finiteNumber(source.priority, index)),
    referenceTime: Math.max(0, finiteNumber(source.referenceTime ?? source.reference_time, 0)),
  };
}

function normalizeAnimationGraph(input, clips) {
  const availableClips = new Set((clips || []).map((clip) => clip.clipId));
  const source = isPlainObject(input) ? input : createDefaultAnimationGraph();
  const states = Array.isArray(source.states) ? source.states.map((state, index) => ({
    stateId: sanitizeId(state?.stateId || state?.state_id || `state-${index + 1}`, `state-${index + 1}`),
    clipId: availableClips.has(String(state?.clipId || state?.clip_id || '')) ? String(state.clipId || state.clip_id) : null,
    loop: state?.loop !== false,
    speed: clampFinite(state?.speed, -4, 4, 1) || 1,
    metadata: isPlainObject(state?.metadata) ? clone(state.metadata) : {},
  })) : [];
  const stateIds = new Set(states.map((state) => state.stateId));
  const fallbackState = states[0]?.stateId || 'idle';
  const entryStateId = stateIds.has(String(source.entryStateId || source.entry_state_id))
    ? String(source.entryStateId || source.entry_state_id)
    : fallbackState;
  const activeStateId = stateIds.has(String(source.activeStateId || source.active_state_id))
    ? String(source.activeStateId || source.active_state_id)
    : entryStateId;
  const transitions = Array.isArray(source.transitions) ? source.transitions.map((transition, index) => ({
    transitionId: String(transition?.transitionId || transition?.transition_id || `transition-${index + 1}`),
    fromStateId: String(transition?.fromStateId || transition?.from_state_id || '*'),
    toStateId: String(transition?.toStateId || transition?.to_state_id || entryStateId),
    duration: clampFinite(transition?.duration, 0, 10, 0.2),
    conditions: Array.isArray(transition?.conditions) ? transition.conditions.map((condition) => ({
      parameter: String(condition?.parameter || ''),
      operator: ['>', '>=', '<', '<=', '==', '!=', 'truthy', 'falsy', 'trigger'].includes(condition?.operator) ? condition.operator : '==',
      value: clone(condition?.value),
    })) : [],
    priority: Math.trunc(finiteNumber(transition?.priority, 0)),
    exitTime: transition?.exitTime == null && transition?.exit_time == null
      ? null
      : clampFinite(transition.exitTime ?? transition.exit_time, 0, 1, 1),
  })).filter((transition) => stateIds.has(transition.toStateId)) : [];
  return {
    schema: ANIMATION_GRAPH_SCHEMA,
    graphId: String(source.graphId || source.graph_id || 'humanoid-basic-locomotion'),
    controlMode: GRAPH_CONTROL_MODES.has(source.controlMode || source.control_mode)
      ? (source.controlMode || source.control_mode)
      : 'clip',
    entryStateId,
    activeStateId,
    parameters: isPlainObject(source.parameters) ? clone(source.parameters) : {},
    states,
    transitions,
    transition: normalizeGraphTransition(source.transition, stateIds),
    stateStartedAt: Math.max(0, finiteNumber(source.stateStartedAt ?? source.state_started_at, 0)),
  };
}

function normalizeGraphTransition(input, stateIds) {
  if (!isPlainObject(input)) return null;
  const fromStateId = String(input.fromStateId || input.from_state_id || '');
  const toStateId = String(input.toStateId || input.to_state_id || '');
  if (!stateIds.has(fromStateId) || !stateIds.has(toStateId)) return null;
  return {
    transitionId: String(input.transitionId || input.transition_id || `${fromStateId}-to-${toStateId}`),
    fromStateId,
    toStateId,
    duration: clampFinite(input.duration, 0, 10, 0.2),
    startedAt: Math.max(0, finiteNumber(input.startedAt ?? input.started_at, 0)),
    fromTime: Math.max(0, finiteNumber(input.fromTime ?? input.from_time, 0)),
    toTime: Math.max(0, finiteNumber(input.toTime ?? input.to_time, 0)),
  };
}

function normalizeSelection(input, activeClipId) {
  const source = isPlainObject(input) ? input : {};
  return {
    clipId: String(source.clipId || source.clip_id || activeClipId),
    jointId: source.jointId == null && source.joint_id == null ? null : sanitizeId(source.jointId || source.joint_id, 'hips'),
    trackId: source.trackId == null && source.track_id == null ? null : String(source.trackId || source.track_id),
    keyframeIds: Array.isArray(source.keyframeIds || source.keyframe_ids) ? unique((source.keyframeIds || source.keyframe_ids).map(String)) : [],
    eventId: source.eventId == null && source.event_id == null ? null : String(source.eventId || source.event_id),
  };
}

function normalizeBakeSettings(input) {
  const source = isPlainObject(input) ? input : {};
  return {
    source: ['desired_pose', 'final_pose'].includes(source.source) ? source.source : 'final_pose',
    sampleRate: clampFinite(source.sampleRate ?? source.sample_rate, 1, 120, 30),
    includeRootMotion: source.includeRootMotion ?? source.include_root_motion ?? true,
    includeEvents: source.includeEvents ?? source.include_events ?? true,
    quaternionToleranceDegrees: clampFinite(source.quaternionToleranceDegrees ?? source.quaternion_tolerance_degrees, 0, 15, 0.35),
    positionToleranceMeters: clampFinite(source.positionToleranceMeters ?? source.position_tolerance_meters, 0, 0.2, 0.001),
  };
}

function byContactTimeThenId(a, b) {
  return Number(a.start || 0) - Number(b.start || 0) || String(a.id || '').localeCompare(String(b.id || ''));
}

function nullableFinite(value) {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function applyTrackContinuity(track) {
  const continuous = ensureQuaternionContinuity(track.keyframes.map((key) => key.value));
  track.keyframes = track.keyframes.map((key, index) => ({ ...key, value: continuous[index] }));
}

function mirrorPayload(payload) {
  if (!isPlainObject(payload)) return clone(payload);
  const next = clone(payload);
  if (next.jointId) next.jointId = MIRROR_JOINTS[next.jointId] || next.jointId;
  if (next.joint_id) next.joint_id = MIRROR_JOINTS[next.joint_id] || next.joint_id;
  if (next.side === 'left') next.side = 'right';
  else if (next.side === 'right') next.side = 'left';
  return next;
}

function normalizeVector(value, size) {
  return Array.from({ length: size }, (_, index) => finiteNumber(value?.[index], 0));
}

function objectVectorToArray(value) {
  return [finiteNumber(value?.x, 0), finiteNumber(value?.y, 0), finiteNumber(value?.z, 0)];
}

function byTimeThenId(a, b) {
  return Number(a.time || 0) - Number(b.time || 0) || String(a.id || '').localeCompare(String(b.id || ''));
}

function sanitizeId(value, fallback) {
  const text = String(value || fallback).trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  const safe = text || fallback;
  return /^[A-Za-z]/.test(safe) ? safe : `id-${safe}`;
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createStableFallbackId(prefix, index) {
  return `${sanitizeId(prefix, 'key')}-${index + 1}`;
}

function clone(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampFinite(value, min, max, fallback) {
  const numeric = finiteNumber(value, fallback);
  return Math.min(max, Math.max(min, numeric));
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function simpleHash(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function unique(items) {
  return [...new Set(items)];
}
