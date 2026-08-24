import {
  ensureQuaternionContinuity,
  normalizeQuaternion,
  quaternionLength,
} from './quaternion.js';

export const MOTION_CLIP_V4_SCHEMA = 'humanoid_rig/motion_clip@4.0';
export const MOTION_CONTACT_DATA_V4_SCHEMA = 'humanoid_rig/motion_contact_data@4.0';

const IDENTITY = Object.freeze([0, 0, 0, 1]);
const ZERO = Object.freeze([0, 0, 0]);
const STABLE_ID = /^[A-Za-z][A-Za-z0-9._-]*$/;
const LOOP_MODES = new Set(['once', 'repeat']);
const TRACK_TYPES = new Set(['joint_local_quaternion']);
const CONTACT_TYPES = new Set(['foot_contact', 'hand_contact']);
const INTERPOLATIONS = new Set(['slerp', 'step']);
const ROOT_INTERPOLATIONS = new Set(['linear', 'slerp', 'step']);
const FOOT_STATES = new Set(['stance', 'swing']);
const SUPPORT_STATES = new Set(['left', 'right', 'double_support', 'flight']);
const PHASE_MARKERS = new Set(['stance_start', 'swing_start', 'heel_strike', 'toe_off', 'double_support_start', 'double_support_end']);
const FORBIDDEN_FIELDS = new Set([
  'boneLength',
  'boneLengths',
  'bindLocalPosition',
  'bindLocalPositions',
  'bindWorldPosition',
  'bindWorldPositions',
  'inverseBindMatrices',
  'jointPosition',
  'jointPositions',
  'localPosition',
  'localPositions',
  'parent',
  'parentId',
  'parents',
  'scale',
  'scales',
  'scaleTrack',
]);

export function createMotionClipV4(input = {}) {
  assertNoForbiddenMotionFields(input);
  const duration = positiveNumber(input.duration, 1);
  const rootJointId = stableId(input.rootJointId, 'hips');
  const tracks = Array.isArray(input.tracks)
    ? input.tracks.map((track, index) => normalizeJointTrack(track, duration, index))
    : [];
  const rootMotion = normalizeRootMotion(input.rootMotion, duration, rootJointId);
  const contacts = Array.isArray(input.contacts)
    ? input.contacts.map((contact, index) => normalizeContact(contact, duration, index))
    : [];
  const events = Array.isArray(input.events)
    ? input.events.map((event, index) => normalizeEvent(event, duration, index))
    : [];
  const phaseData = normalizePhaseData(input.phaseData, duration);
  const sourceRigVersion = String(input.sourceRigVersion || input.compatibleRig || 'rig@0.4.0');

  return {
    schema: MOTION_CLIP_V4_SCHEMA,
    schemaVersion: 4,
    type: 'MotionClip',
    clipId: stableId(input.clipId, 'motion-v4'),
    name: String(input.name || 'Motion V4'),
    duration,
    sourceRigVersion,
    sourceProportionRevision: revision(input.sourceProportionRevision),
    loopMode: LOOP_MODES.has(input.loopMode) ? input.loopMode : 'once',
    rootJointId,
    rootMotion,
    tracks,
    contacts,
    events,
    phaseData,
    quality: normalizeQuality(input.quality),
    metadata: plainObject(input.metadata) ? structuredClone(input.metadata) : {},
  };
}

export function isMotionClipV4(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && value.schema === MOTION_CLIP_V4_SCHEMA
    && value.type === 'MotionClip',
  );
}

export function validateMotionClipV4(value) {
  const errors = [];
  const warnings = [];
  if (!isMotionClipV4(value)) {
    errors.push(`SCHEMA_REQUIRED:${MOTION_CLIP_V4_SCHEMA}`);
    return { valid: false, errors, warnings };
  }
  const forbidden = findForbiddenMotionField(value);
  if (forbidden) errors.push(`FORBIDDEN_MOTION_FIELD:${forbidden}`);
  if (!STABLE_ID.test(String(value.clipId || ''))) errors.push('CLIP_ID_INVALID');
  if (!String(value.name || '').trim()) errors.push('NAME_REQUIRED');
  if (!(Number(value.duration) > 0)) errors.push('DURATION_INVALID');
  if (!String(value.sourceRigVersion || '').trim()) errors.push('SOURCE_RIG_VERSION_REQUIRED');
  if (!Number.isInteger(value.sourceProportionRevision) || value.sourceProportionRevision < 0) {
    errors.push('SOURCE_PROPORTION_REVISION_INVALID');
  }
  if (!LOOP_MODES.has(value.loopMode)) errors.push('LOOP_MODE_INVALID');
  if (!STABLE_ID.test(String(value.rootJointId || ''))) errors.push('ROOT_JOINT_ID_INVALID');

  validateRootMotion(value.rootMotion, value.duration, value.rootJointId, errors);
  const trackIds = new Set();
  for (const track of Array.isArray(value.tracks) ? value.tracks : []) {
    if (trackIds.has(track.trackId)) errors.push(`TRACK_ID_DUPLICATE:${track.trackId}`);
    trackIds.add(track.trackId);
    validateJointTrack(track, value.duration, value.rootJointId, errors);
  }
  if (!Array.isArray(value.tracks)) errors.push('TRACKS_REQUIRED');

  const contactIds = new Set();
  for (const contact of Array.isArray(value.contacts) ? value.contacts : []) {
    if (contactIds.has(contact.contactId)) errors.push(`CONTACT_ID_DUPLICATE:${contact.contactId}`);
    contactIds.add(contact.contactId);
    validateContact(contact, value.duration, errors);
  }
  if (!Array.isArray(value.contacts)) errors.push('CONTACTS_REQUIRED');

  const eventIds = new Set();
  for (const event of Array.isArray(value.events) ? value.events : []) {
    if (eventIds.has(event.eventId)) errors.push(`EVENT_ID_DUPLICATE:${event.eventId}`);
    eventIds.add(event.eventId);
    if (!STABLE_ID.test(String(event.eventId || ''))) errors.push(`EVENT_ID_INVALID:${event.eventId || 'empty'}`);
    if (!inClipTime(event.time, value.duration)) errors.push(`EVENT_TIME_INVALID:${event.eventId || 'empty'}`);
    if (!String(event.eventType || '').trim()) errors.push(`EVENT_TYPE_REQUIRED:${event.eventId || 'empty'}`);
  }
  if (!Array.isArray(value.events)) errors.push('EVENTS_REQUIRED');

  validatePhaseData(value.phaseData, value.duration, errors);
  if (!plainObject(value.quality)) errors.push('QUALITY_REQUIRED');
  else if (value.quality.visualAcceptance !== true) warnings.push('VISUAL_ACCEPTANCE_PENDING');
  if (!plainObject(value.metadata)) errors.push('METADATA_INVALID');
  return { valid: errors.length === 0, errors: unique(errors), warnings: unique(warnings) };
}

export function assertMotionClipV4(value) {
  const result = validateMotionClipV4(value);
  if (!result.valid) throw new Error(`Invalid MotionClip V4: ${result.errors.join(' ')}`);
  return value;
}

export function serializeMotionClipV4(input) {
  const clip = isMotionClipV4(input) ? input : createMotionClipV4(input);
  assertMotionClipV4(clip);
  return structuredClone(clip);
}

export function importMotionClipV4(asset) {
  assertMotionClipV4(asset);
  return createMotionClipV4(asset);
}

/**
 * Builds a read-only V4 runtime view of the existing MotionClip @1.0 shape.
 * The source object is never mutated or re-serialized as V4 in place.
 */
export function adaptLegacyMotionClipV1(asset = {}) {
  if (isMotionClipV4(asset)) return importMotionClipV4(asset);
  const duration = positiveNumber(asset.duration, 1);
  const rootJointId = stableId(asset.root_joint_id || asset.rootJointId, 'hips');
  const rootPositionKeys = [];
  const rootRotationKeys = [];
  const tracks = [];

  for (const [index, sourceTrack] of (Array.isArray(asset.tracks) ? asset.tracks : []).entries()) {
    const jointId = stableId(sourceTrack.joint_id || sourceTrack.jointId, `joint-${index + 1}`);
    const channel = String(sourceTrack.channel || 'rotation');
    const keys = readLegacyTrackKeys(sourceTrack);
    const isRoot = jointId === rootJointId || ['root', 'hips', 'pelvis'].includes(jointId);
    if (channel === 'position' && isRoot) {
      rootPositionKeys.push(...keys);
    } else if (channel === 'rotation' && isRoot) {
      rootRotationKeys.push(...keys);
    } else if (channel === 'rotation') {
      tracks.push({
        trackId: sourceTrack.track_id || sourceTrack.trackId || `${jointId}:rotation`,
        jointId,
        type: 'joint_local_quaternion',
        space: 'local',
        interpolation: sourceTrack.interpolation || 'slerp',
        keyframes: keys,
      });
    }
  }

  const contacts = (Array.isArray(asset.contacts) ? asset.contacts : []).map((contact, index) => ({
    contactId: contact.contact_id || contact.id || `legacy-contact-${index + 1}`,
    contactType: String(contact.joint_id || contact.jointId || '').toLowerCase().includes('hand')
      ? 'hand_contact'
      : 'foot_contact',
    jointId: contact.joint_id || contact.jointId,
    time: contact.start,
    endTime: contact.end,
    position: contact.position || ZERO,
    normal: contact.ground_normal || contact.groundNormal || [0, 1, 0],
    confidence: contact.confidence ?? 1,
  }));
  const events = (Array.isArray(asset.events) ? asset.events : []).map((event, index) => ({
    eventId: event.event_id || event.id || `legacy-event-${index + 1}`,
    time: event.time,
    eventType: event.type,
    payload: event.payload,
  }));
  const markers = [];
  for (const contact of contacts) {
    const foot = String(contact.jointId).startsWith('left') ? 'left' : String(contact.jointId).startsWith('right') ? 'right' : 'both';
    markers.push({ markerId: `${contact.contactId}-start`, markerType: 'stance_start', time: contact.time, foot });
    markers.push({ markerId: `${contact.contactId}-end`, markerType: 'toe_off', time: contact.endTime, foot });
  }

  return createMotionClipV4({
    clipId: asset.clip_id || asset.clipId || 'legacy-motion',
    name: asset.name || 'Legacy Motion',
    duration,
    sourceRigVersion: asset.skeleton_profile || asset.compatibleRig || 'rig@0.4.0',
    sourceProportionRevision: asset.source_proportion_revision ?? asset.sourceProportionRevision,
    loopMode: asset.loop_mode || asset.loopMode,
    rootJointId,
    rootMotion: {
      mode: (asset.root_motion_mode || asset.rootMotionMode) === 'root_motion' ? 'root_motion' : 'in_place',
      space: 'character_local',
      positionTrack: { interpolation: 'linear', keyframes: rootPositionKeys },
      rotationTrack: { interpolation: 'slerp', keyframes: rootRotationKeys },
    },
    tracks,
    contacts,
    events,
    phaseData: { cyclic: (asset.loop_mode || asset.loopMode) === 'repeat', samples: [], markers },
    quality: {
      status: 'legacy-compatibility',
      source: 'motion-clip-v1-adapter',
      validated: false,
      visualAcceptance: false,
      warnings: ['Legacy procedural/test asset exposed through a read-only V4 runtime view.'],
    },
    metadata: {
      legacySchema: asset.schema || 'humanoid_rig/motion_clip@1.0',
      adapterMode: 'read-only-runtime-view',
    },
  });
}

function normalizeJointTrack(input = {}, duration, index) {
  const jointId = stableId(input.jointId, `joint-${index + 1}`);
  const keyframes = normalizeQuaternionKeys(input.keyframes, duration);
  return {
    trackId: stableId(input.trackId, `${jointId}-rotation`),
    jointId,
    type: 'joint_local_quaternion',
    space: 'local',
    interpolation: INTERPOLATIONS.has(input.interpolation) ? input.interpolation : 'slerp',
    keyframes,
  };
}

function normalizeRootMotion(input = {}, duration, rootJointId) {
  const source = plainObject(input) ? input : {};
  return {
    mode: source.mode === 'root_motion' ? 'root_motion' : 'in_place',
    space: 'character_local',
    rootJointId,
    positionTrack: {
      interpolation: ['linear', 'step'].includes(source.positionTrack?.interpolation)
        ? source.positionTrack.interpolation
        : 'linear',
      keyframes: normalizeVectorKeys(source.positionTrack?.keyframes, duration, ZERO),
    },
    rotationTrack: {
      interpolation: INTERPOLATIONS.has(source.rotationTrack?.interpolation)
        ? source.rotationTrack.interpolation
        : 'slerp',
      keyframes: normalizeQuaternionKeys(source.rotationTrack?.keyframes, duration),
    },
  };
}

function normalizeContact(input = {}, duration, index) {
  const time = clipTime(input.time, duration, 0);
  return {
    schema: MOTION_CONTACT_DATA_V4_SCHEMA,
    contactId: stableId(input.contactId, `contact-${index + 1}`),
    contactType: CONTACT_TYPES.has(input.contactType) ? input.contactType : 'foot_contact',
    jointId: stableId(input.jointId, 'leftFoot'),
    time,
    endTime: clipTime(input.endTime, duration, time),
    position: vector3(input.position, ZERO),
    normal: unitVector3(input.normal, [0, 1, 0]),
    confidence: clamp(Number(input.confidence), 0, 1, 1),
  };
}

function normalizeEvent(input = {}, duration, index) {
  return {
    eventId: stableId(input.eventId, `event-${index + 1}`),
    time: clipTime(input.time, duration, 0),
    eventType: String(input.eventType || 'marker'),
    payload: input.payload == null ? null : structuredClone(input.payload),
  };
}

function normalizePhaseData(input = {}, duration) {
  const source = plainObject(input) ? input : {};
  const samples = (Array.isArray(source.samples) ? source.samples : []).map((sample) => ({
    time: clipTime(sample.time, duration, 0),
    phase: clamp(Number(sample.phase), 0, 1, 0),
    leftFootState: FOOT_STATES.has(sample.leftFootState) ? sample.leftFootState : 'stance',
    rightFootState: FOOT_STATES.has(sample.rightFootState) ? sample.rightFootState : 'stance',
    supportState: SUPPORT_STATES.has(sample.supportState) ? sample.supportState : 'double_support',
  })).sort(byTime);
  const markers = (Array.isArray(source.markers) ? source.markers : []).map((marker, index) => ({
    markerId: stableId(marker.markerId, `phase-marker-${index + 1}`),
    markerType: PHASE_MARKERS.has(marker.markerType) ? marker.markerType : 'stance_start',
    time: clipTime(marker.time, duration, 0),
    foot: ['left', 'right', 'both'].includes(marker.foot) ? marker.foot : 'both',
  })).sort(byTime);
  return { cyclic: source.cyclic === true, samples, markers };
}

function normalizeQuality(input = {}) {
  const source = plainObject(input) ? input : {};
  return {
    status: String(source.status || 'development-interface'),
    source: String(source.source || 'unknown'),
    validated: source.validated === true,
    visualAcceptance: source.visualAcceptance === true,
    warnings: Array.isArray(source.warnings) ? source.warnings.map(String) : [],
  };
}

function validateJointTrack(track, duration, rootJointId, errors) {
  if (!STABLE_ID.test(String(track.trackId || ''))) errors.push(`TRACK_ID_INVALID:${track.trackId || 'empty'}`);
  if (!STABLE_ID.test(String(track.jointId || ''))) errors.push(`TRACK_JOINT_INVALID:${track.trackId || 'empty'}`);
  if (track.jointId === rootJointId) errors.push(`ROOT_ROTATION_MUST_USE_ROOT_MOTION:${track.trackId || 'empty'}`);
  if (!TRACK_TYPES.has(track.type)) errors.push(`TRACK_TYPE_FORBIDDEN:${track.trackId || 'empty'}`);
  if (track.space !== 'local') errors.push(`TRACK_SPACE_NOT_LOCAL:${track.trackId || 'empty'}`);
  if (!INTERPOLATIONS.has(track.interpolation)) errors.push(`TRACK_INTERPOLATION_INVALID:${track.trackId || 'empty'}`);
  validateKeys(track.keyframes, duration, 4, track.trackId, errors, true);
}

function validateRootMotion(rootMotion, duration, rootJointId, errors) {
  if (!plainObject(rootMotion)) {
    errors.push('ROOT_MOTION_REQUIRED');
    return;
  }
  if (!['in_place', 'root_motion'].includes(rootMotion.mode)) errors.push('ROOT_MOTION_MODE_INVALID');
  if (rootMotion.space !== 'character_local') errors.push('ROOT_MOTION_SPACE_INVALID');
  if (rootMotion.rootJointId !== rootJointId) errors.push('ROOT_MOTION_JOINT_MISMATCH');
  if (!ROOT_INTERPOLATIONS.has(rootMotion.positionTrack?.interpolation)) errors.push('ROOT_POSITION_INTERPOLATION_INVALID');
  if (!INTERPOLATIONS.has(rootMotion.rotationTrack?.interpolation)) errors.push('ROOT_ROTATION_INTERPOLATION_INVALID');
  validateKeys(rootMotion.positionTrack?.keyframes, duration, 3, 'root-position', errors, false);
  validateKeys(rootMotion.rotationTrack?.keyframes, duration, 4, 'root-rotation', errors, true);
}

function validateContact(contact, duration, errors) {
  const id = contact.contactId || 'empty';
  if (contact.schema !== MOTION_CONTACT_DATA_V4_SCHEMA) errors.push(`CONTACT_SCHEMA_INVALID:${id}`);
  if (!STABLE_ID.test(String(contact.contactId || ''))) errors.push(`CONTACT_ID_INVALID:${id}`);
  if (!CONTACT_TYPES.has(contact.contactType)) errors.push(`CONTACT_TYPE_INVALID:${id}`);
  if (!STABLE_ID.test(String(contact.jointId || ''))) errors.push(`CONTACT_JOINT_INVALID:${id}`);
  if (!inClipTime(contact.time, duration) || !inClipTime(contact.endTime, duration) || contact.endTime < contact.time) {
    errors.push(`CONTACT_TIME_INVALID:${id}`);
  }
  validateVector(contact.position, 3, `CONTACT_POSITION_INVALID:${id}`, errors);
  validateVector(contact.normal, 3, `CONTACT_NORMAL_INVALID:${id}`, errors);
  if (!Number.isFinite(Number(contact.confidence)) || contact.confidence < 0 || contact.confidence > 1) {
    errors.push(`CONTACT_CONFIDENCE_INVALID:${id}`);
  }
}

function validatePhaseData(phaseData, duration, errors) {
  if (!plainObject(phaseData)) {
    errors.push('PHASE_DATA_REQUIRED');
    return;
  }
  if (typeof phaseData.cyclic !== 'boolean') errors.push('PHASE_CYCLIC_REQUIRED');
  for (const sample of Array.isArray(phaseData.samples) ? phaseData.samples : []) {
    if (!inClipTime(sample.time, duration) || !(sample.phase >= 0 && sample.phase <= 1)) errors.push('PHASE_SAMPLE_INVALID');
    if (!FOOT_STATES.has(sample.leftFootState) || !FOOT_STATES.has(sample.rightFootState)) errors.push('PHASE_FOOT_STATE_INVALID');
    if (!SUPPORT_STATES.has(sample.supportState)) errors.push('PHASE_SUPPORT_STATE_INVALID');
  }
  for (const marker of Array.isArray(phaseData.markers) ? phaseData.markers : []) {
    if (!PHASE_MARKERS.has(marker.markerType) || !inClipTime(marker.time, duration)) errors.push(`PHASE_MARKER_INVALID:${marker.markerId || 'empty'}`);
  }
  if (!Array.isArray(phaseData.samples)) errors.push('PHASE_SAMPLES_REQUIRED');
  if (!Array.isArray(phaseData.markers)) errors.push('PHASE_MARKERS_REQUIRED');
}

function validateKeys(keys, duration, valueSize, id, errors, quaternion) {
  if (!Array.isArray(keys) || !keys.length) {
    errors.push(`KEYFRAMES_REQUIRED:${id}`);
    return;
  }
  let previous = -Infinity;
  for (const key of keys) {
    if (!inClipTime(key.time, duration) || key.time < previous) errors.push(`KEYFRAME_TIME_INVALID:${id}`);
    previous = Number(key.time);
    validateVector(key.value, valueSize, `KEYFRAME_VALUE_INVALID:${id}`, errors);
    if (quaternion && Array.isArray(key.value) && Math.abs(quaternionLength(key.value) - 1) > 1e-5) {
      errors.push(`QUATERNION_NOT_NORMALIZED:${id}`);
    }
  }
}

function normalizeQuaternionKeys(input, duration) {
  const source = Array.isArray(input) && input.length ? input : [{ time: 0, value: IDENTITY }];
  const keys = source.map((key) => ({ time: clipTime(key.time, duration, 0), value: normalizeQuaternion(key.value) })).sort(byTime);
  const continuous = ensureQuaternionContinuity(keys.map((key) => key.value));
  return keys.map((key, index) => ({ time: key.time, value: continuous[index] }));
}

function normalizeVectorKeys(input, duration, fallback) {
  const source = Array.isArray(input) && input.length ? input : [{ time: 0, value: fallback }];
  return source.map((key) => ({ time: clipTime(key.time, duration, 0), value: vector3(key.value, fallback) })).sort(byTime);
}

function readLegacyTrackKeys(track) {
  if (Array.isArray(track.keyframes)) return track.keyframes.map((key) => ({ time: key.time, value: key.value }));
  const times = Array.isArray(track.times) ? track.times : [];
  const values = Array.isArray(track.values) ? track.values : [];
  return times.map((time, index) => ({ time, value: values[index] }));
}

function findForbiddenMotionField(value, path = '') {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenMotionField(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_FIELDS.has(key)) return childPath;
    const found = findForbiddenMotionField(child, childPath);
    if (found) return found;
  }
  return null;
}

function assertNoForbiddenMotionFields(value) {
  const path = findForbiddenMotionField(value);
  if (path) throw new Error(`MotionClip V4 cannot contain bind, topology, non-root position, or scale data: ${path}`);
}

function validateVector(value, length, code, errors) {
  if (!Array.isArray(value) || value.length !== length || value.some((item) => !Number.isFinite(Number(item)))) errors.push(code);
}

function vector3(value, fallback) {
  const source = Array.isArray(value) || ArrayBuffer.isView(value) ? value : fallback;
  return [0, 1, 2].map((index) => Number.isFinite(Number(source[index])) ? Number(source[index]) : fallback[index]);
}

function unitVector3(value, fallback) {
  const vector = vector3(value, fallback);
  const length = Math.hypot(...vector);
  return length > 1e-9 ? vector.map((item) => item / length) : [...fallback];
}

function stableId(value, fallback) {
  const id = String(value || fallback);
  return STABLE_ID.test(id) ? id : String(fallback);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function revision(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function clipTime(value, duration, fallback) {
  return clamp(Number(value), 0, duration, fallback);
}

function inClipTime(value, duration) {
  return Number.isFinite(Number(value)) && Number(value) >= -1e-7 && Number(value) <= Number(duration) + 1e-7;
}

function clamp(value, minimum, maximum, fallback) {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !ArrayBuffer.isView(value);
}

function byTime(left, right) {
  return Number(left.time) - Number(right.time);
}

function unique(values) {
  return [...new Set(values)];
}
