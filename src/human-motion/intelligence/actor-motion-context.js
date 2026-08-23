export const ACTOR_MOTION_CONTEXT_SCHEMA = 'humanoid_rig/actor_motion_context@1.0';

const OCCUPATION_STYLE_PRESETS = Object.freeze({
  pilot: {
    tempo: 'measured', precision: 0.9, amplitude: 0.62, alertnessBias: 0.2,
    postureBias: 'upright', gestureDiscipline: 'formal', preferredSkills: ['walk', 'look_at', 'salute_right'],
  },
  aircraft_mechanic: {
    tempo: 'practical', precision: 0.84, amplitude: 0.54, alertnessBias: 0.05,
    postureBias: 'relaxed_ready', gestureDiscipline: 'functional', preferredSkills: ['bend', 'reach', 'inspect'],
  },
  commander: {
    tempo: 'steady', precision: 0.82, amplitude: 0.78, alertnessBias: 0.18,
    postureBias: 'upright', gestureDiscipline: 'clear', preferredSkills: ['point', 'look_at', 'turn_to'],
  },
  guard: {
    tempo: 'deliberate', precision: 0.72, amplitude: 0.58, alertnessBias: 0.34,
    postureBias: 'ready', gestureDiscipline: 'controlled', preferredSkills: ['patrol', 'guard', 'look_left', 'look_right'],
  },
  radio_operator: {
    tempo: 'focused', precision: 0.86, amplitude: 0.45, alertnessBias: 0.14,
    postureBias: 'seated_ready', gestureDiscipline: 'economical', preferredSkills: ['walk', 'sit', 'operate'],
  },
  ground_crew: {
    tempo: 'practical', precision: 0.76, amplitude: 0.64, alertnessBias: 0.16,
    postureBias: 'mobile_ready', gestureDiscipline: 'functional', preferredSkills: ['walk', 'carry', 'lift', 'inspect'],
  },
});

export function createActorMotionContext(input = {}) {
  return normalizeActorMotionContext({
    schema: ACTOR_MOTION_CONTEXT_SCHEMA,
    actorId: 'actor_default',
    characterId: 'character_001',
    identity: { displayName: 'Default Actor', ageGroup: 'adult' },
    occupation: { id: 'civilian', label: 'Civilian', period: null },
    rank: null,
    dominantSide: 'right',
    equipment: [],
    currentPosture: 'standing',
    currentMotion: 'idle',
    currentPosition: [0, 0, 0],
    currentFacing: [0, 0, 1],
    fatigue: 0,
    injury: null,
    alertness: 0.5,
    carriedObjects: [],
    availableSkills: [],
    disabledSkills: [],
    bodyProfileReference: { compatibleRig: 'rig@0.4.0', proportionRevision: 0 },
    metadata: {},
    ...cloneObject(input),
  });
}

export function normalizeActorMotionContext(input = {}) {
  const source = cloneObject(input);
  const actorId = text(source.actorId ?? source.actor_id, 'actor_default');
  const characterId = text(source.characterId ?? source.character_id, 'character_001');
  const identity = cloneObject(source.identity);
  const occupationInput = typeof source.occupation === 'string'
    ? { id: source.occupation, label: source.occupation }
    : cloneObject(source.occupation);
  const occupationId = normalizeOccupationId(occupationInput.id ?? source.occupationId ?? source.occupation_id);
  const equipment = Array.isArray(source.equipment)
    ? source.equipment.map(normalizeEquipment).filter(Boolean)
    : [];

  return {
    ...source,
    schema: ACTOR_MOTION_CONTEXT_SCHEMA,
    actorId,
    characterId,
    identity: {
      displayName: text(identity.displayName ?? identity.display_name, actorId),
      ageGroup: text(identity.ageGroup ?? identity.age_group, 'adult'),
      tags: uniqueStrings(identity.tags),
      metadata: cloneObject(identity.metadata),
    },
    occupation: {
      id: occupationId,
      label: text(occupationInput.label, occupationId === 'civilian' ? 'Civilian' : occupationId),
      period: nullableText(occupationInput.period),
      metadata: cloneObject(occupationInput.metadata),
    },
    rank: nullableText(source.rank),
    dominantSide: source.dominantSide === 'left' ? 'left' : 'right',
    equipment,
    currentPosture: text(source.currentPosture ?? source.current_posture, 'standing').toLowerCase(),
    currentMotion: text(source.currentMotion ?? source.current_motion, 'idle').toLowerCase(),
    currentPosition: vector3(source.currentPosition ?? source.current_position, [0, 0, 0]),
    currentFacing: normalizeFacing(source.currentFacing ?? source.current_facing),
    fatigue: clamp01(source.fatigue, 0),
    injury: source.injury == null ? null : clone(source.injury),
    alertness: clamp01(source.alertness, 0.5),
    carriedObjects: uniqueStrings(source.carriedObjects ?? source.carried_objects),
    availableSkills: uniqueStrings(source.availableSkills ?? source.available_skills),
    disabledSkills: uniqueStrings(source.disabledSkills ?? source.disabled_skills),
    bodyProfileReference: {
      compatibleRig: text(source.bodyProfileReference?.compatibleRig ?? source.body_profile_reference?.compatible_rig, 'rig@0.4.0'),
      proportionRevision: nonNegativeInteger(source.bodyProfileReference?.proportionRevision ?? source.body_profile_reference?.proportion_revision, 0),
      metadata: cloneObject(source.bodyProfileReference?.metadata ?? source.body_profile_reference?.metadata),
    },
    metadata: cloneObject(source.metadata),
  };
}

export function validateActorMotionContext(input) {
  const context = normalizeActorMotionContext(input);
  const errors = [];
  if (context.schema !== ACTOR_MOTION_CONTEXT_SCHEMA) errors.push('ACTOR_MOTION_CONTEXT_SCHEMA_INVALID');
  if (!context.actorId) errors.push('ACTOR_MOTION_CONTEXT_ACTOR_ID_MISSING');
  if (!context.characterId) errors.push('ACTOR_MOTION_CONTEXT_CHARACTER_ID_MISSING');
  if (!['left', 'right'].includes(context.dominantSide)) errors.push('ACTOR_MOTION_CONTEXT_DOMINANT_SIDE_INVALID');
  if (!Array.isArray(context.currentPosition) || context.currentPosition.length !== 3) errors.push('ACTOR_MOTION_CONTEXT_POSITION_INVALID');
  if (!Array.isArray(context.currentFacing) || context.currentFacing.length !== 3) errors.push('ACTOR_MOTION_CONTEXT_FACING_INVALID');
  if (context.fatigue < 0 || context.fatigue > 1) errors.push('ACTOR_MOTION_CONTEXT_FATIGUE_INVALID');
  if (context.alertness < 0 || context.alertness > 1) errors.push('ACTOR_MOTION_CONTEXT_ALERTNESS_INVALID');
  return { valid: errors.length === 0, errors, context };
}

/** Merges a transient UI or world update into the existing actor context without creating another state store. */
export function mergeActorMotionContext(baseInput, patchInput = {}) {
  const base = normalizeActorMotionContext(baseInput);
  const patch = cloneObject(patchInput);
  return normalizeActorMotionContext({
    ...base,
    ...patch,
    identity: { ...base.identity, ...cloneObject(patch.identity) },
    occupation: { ...base.occupation, ...cloneObject(patch.occupation) },
    bodyProfileReference: { ...base.bodyProfileReference, ...cloneObject(patch.bodyProfileReference) },
    metadata: { ...base.metadata, ...cloneObject(patch.metadata) },
  });
}

/**
 * Returns semantic timing/posture hints only. It deliberately contains no
 * joints, rotations, matrices, vertex data, or solver configuration.
 */
export function deriveMotionStyleFromActor(input = {}) {
  const actor = normalizeActorMotionContext(input);
  const occupationStyle = OCCUPATION_STYLE_PRESETS[actor.occupation.id] || {
    tempo: 'natural', precision: 0.6, amplitude: 0.6, alertnessBias: 0,
    postureBias: 'neutral', gestureDiscipline: 'natural', preferredSkills: [],
  };
  const fatigueScale = 1 - actor.fatigue * 0.35;
  const alertness = clamp01(actor.alertness + occupationStyle.alertnessBias, 0.5);
  return {
    source: actor.occupation.id === 'civilian' ? ['actor_context'] : ['actor_context', 'occupation'],
    occupationId: actor.occupation.id,
    tempo: occupationStyle.tempo,
    speedScale: Number(Math.max(0.55, fatigueScale).toFixed(3)),
    precision: Number(occupationStyle.precision.toFixed(3)),
    amplitude: Number((occupationStyle.amplitude * (actor.fatigue > 0.8 ? 0.82 : 1)).toFixed(3)),
    alertness: Number(alertness.toFixed(3)),
    postureBias: occupationStyle.postureBias,
    gestureDiscipline: occupationStyle.gestureDiscipline,
    preferredSkills: [...occupationStyle.preferredSkills],
    dominantSide: actor.dominantSide,
    equipmentIds: actor.equipment.map((item) => item.id),
    prohibitedSkills: [...actor.disabledSkills],
  };
}

export function normalizeOccupationId(value) {
  const normalized = String(value ?? 'civilian').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliases = {
    '飞行员': 'pilot', pilot: 'pilot',
    '地勤机械师': 'aircraft_mechanic', '机械师': 'aircraft_mechanic', aircraftmechanic: 'aircraft_mechanic', aircraft_mechanic: 'aircraft_mechanic', mechanic: 'aircraft_mechanic',
    '地勤人员': 'ground_crew', '地勤': 'ground_crew', groundcrew: 'ground_crew', ground_crew: 'ground_crew',
    '指挥员': 'commander', commander: 'commander',
    '警卫': 'guard', guard: 'guard',
    '通讯员': 'radio_operator', '无线电员': 'radio_operator', radiooperator: 'radio_operator', radio_operator: 'radio_operator',
  };
  return aliases[normalized] || normalized || 'civilian';
}

function normalizeEquipment(input) {
  if (typeof input === 'string') return { id: input, type: input, carriedBy: null, metadata: {} };
  const source = cloneObject(input);
  const id = nullableText(source.id ?? source.equipmentId ?? source.equipment_id);
  if (!id) return null;
  return {
    id,
    type: text(source.type, 'generic'),
    carriedBy: ['leftHand', 'rightHand', 'back', 'belt', null].includes(source.carriedBy ?? source.carried_by)
      ? (source.carriedBy ?? source.carried_by ?? null)
      : null,
    metadata: cloneObject(source.metadata),
  };
}

function normalizeFacing(value) {
  const vector = vector3(value, [0, 0, 1]);
  const length = Math.hypot(...vector);
  return length > 1e-8 ? vector.map((item) => Number((item / length).toFixed(8))) : [0, 0, 1];
}

function vector3(value, fallback) {
  const source = Array.isArray(value) ? value : [];
  return [0, 1, 2].map((index) => finite(source[index], fallback[index]));
}

function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function clamp01(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function text(value, fallback) {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function nullableText(value) {
  const result = String(value ?? '').trim();
  return result || null;
}

function uniqueStrings(input) {
  return [...new Set((Array.isArray(input) ? input : []).map(String).map((item) => item.trim()).filter(Boolean))];
}

function cloneObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {};
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}
