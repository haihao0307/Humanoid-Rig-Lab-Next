export const MOTION_INTENT_SCHEMA = 'humanoid_rig/motion_intent@1.0';

export const MOTION_DIRECTIONS = Object.freeze([
  'forward', 'backward', 'left', 'right',
  'left_forward', 'right_forward', 'left_backward', 'right_backward',
  'up', 'down', 'left_right',
]);

export const MOTION_SIDES = Object.freeze(['left', 'right', 'both', 'none']);

export function createMotionIntent(input = {}) {
  return normalizeMotionIntent({
    schema: MOTION_INTENT_SCHEMA,
    sourceText: '',
    language: 'unknown',
    actor: null,
    actorContextRef: null,
    occupationHint: null,
    taskType: null,
    actions: [],
    targets: [],
    spatialRelations: [],
    sequenceRelations: [],
    parallelRelations: [],
    conditions: [],
    constraints: {},
    styleHints: [],
    equipmentHints: [],
    safetyHints: [],
    confidenceByField: {},
    unresolvedTokens: [],
    confidence: 0,
    warnings: [],
    ...input,
  });
}

export function normalizeMotionIntent(input = {}) {
  const source = isPlainObject(input) ? structuredClone(input) : {};
  const sourceText = String(source.sourceText ?? source.source_text ?? '').trim();
  const actions = Array.isArray(source.actions)
    ? source.actions.map((action, index) => normalizeAction(action, index))
    : [];
  const sequenceRelations = uniqueRelations(source.sequenceRelations || source.sequence_relations);
  const parallelRelations = uniqueParallelRelations(source.parallelRelations || source.parallel_relations);
  const targets = normalizeTargets(source.targets);
  const spatialRelations = normalizeObjectArray(source.spatialRelations || source.spatial_relations);
  const conditions = normalizeObjectArray(source.conditions);
  const styleHints = normalizeObjectArray(source.styleHints || source.style_hints);
  const equipmentHints = normalizeObjectArray(source.equipmentHints || source.equipment_hints);
  const safetyHints = normalizeStringOrObjectArray(source.safetyHints || source.safety_hints);
  const content = {
    sourceText,
    language: normalizeLanguage(source.language),
    actor: source.actor == null ? null : String(source.actor),
    actions,
    sequenceRelations,
    parallelRelations,
    constraints: isPlainObject(source.constraints) ? source.constraints : {},
  };
  const status = ['ready', 'unsupported', 'empty'].includes(source.status)
    ? source.status
    : actions.length ? 'ready' : 'empty';
  return {
    ...source,
    schema: MOTION_INTENT_SCHEMA,
    intentId: sanitizeId(source.intentId || `motion-intent-${stableHash(stableStringify(content))}`, 'motion-intent'),
    sourceText,
    language: content.language,
    actor: content.actor,
    actorContextRef: source.actorContextRef == null && source.actor_context_ref == null
      ? null
      : String(source.actorContextRef || source.actor_context_ref),
    occupationHint: source.occupationHint == null && source.occupation_hint == null
      ? null
      : String(source.occupationHint || source.occupation_hint),
    taskType: source.taskType == null && source.task_type == null ? null : String(source.taskType || source.task_type),
    actions,
    direction: normalizeNullableDirection(source.direction),
    side: normalizeNullableSide(source.side),
    target: source.target == null ? null : String(source.target),
    distanceMeters: nullableNonNegative(source.distanceMeters),
    stepCount: nullablePositiveInteger(source.stepCount),
    durationSeconds: nullablePositive(source.durationSeconds),
    speed: normalizeSpeed(source.speed),
    angleDegrees: nullableAngle(source.angleDegrees),
    repeatCount: nullablePositiveInteger(source.repeatCount),
    sequenceRelations,
    parallelRelations,
    targets,
    spatialRelations,
    conditions,
    constraints: content.constraints,
    styleHints,
    equipmentHints,
    safetyHints,
    confidenceByField: isPlainObject(source.confidenceByField || source.confidence_by_field)
      ? structuredClone(source.confidenceByField || source.confidence_by_field)
      : {},
    unresolvedTokens: uniqueStrings(source.unresolvedTokens || source.unresolved_tokens),
    confidence: clamp(Number(source.confidence), 0, 1, actions.length ? 0.85 : 0),
    warnings: uniqueStrings(source.warnings),
    status,
    missingSkills: uniqueStrings(source.missingSkills),
  };
}

export function validateMotionIntent(input) {
  const intent = normalizeMotionIntent(input);
  const errors = [];
  if (intent.schema !== MOTION_INTENT_SCHEMA) errors.push('MOTION_INTENT_SCHEMA_INVALID');
  if (!intent.intentId) errors.push('MOTION_INTENT_ID_MISSING');
  if (!Array.isArray(intent.actions)) errors.push('MOTION_INTENT_ACTIONS_INVALID');
  for (const action of intent.actions) {
    if (!action.actionId) errors.push('MOTION_INTENT_ACTION_ID_MISSING');
    if (!action.verb) errors.push(`MOTION_INTENT_VERB_MISSING:${action.actionId}`);
    if (action.distanceMeters != null && action.distanceMeters < 0) errors.push(`MOTION_INTENT_DISTANCE_INVALID:${action.actionId}`);
    if (action.stepCount != null && action.stepCount < 1) errors.push(`MOTION_INTENT_STEP_COUNT_INVALID:${action.actionId}`);
    if (action.durationSeconds != null && action.durationSeconds <= 0) errors.push(`MOTION_INTENT_DURATION_INVALID:${action.actionId}`);
    if (action.angleDegrees != null && Math.abs(action.angleDegrees) > 360) errors.push(`MOTION_INTENT_ANGLE_INVALID:${action.actionId}`);
  }
  if (!Array.isArray(intent.targets)) errors.push('MOTION_INTENT_TARGETS_INVALID');
  if (!Array.isArray(intent.conditions)) errors.push('MOTION_INTENT_CONDITIONS_INVALID');
  return { valid: errors.length === 0, errors: uniqueStrings(errors), warnings: intent.warnings };
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function stableHash(value) {
  const text = String(value || '');
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalizeAction(input, index) {
  const source = isPlainObject(input) ? input : {};
  return {
    ...source,
    actionId: sanitizeId(source.actionId || source.action_id || `action-${index + 1}`, `action-${index + 1}`),
    verb: String(source.verb || source.action || '').trim(),
    skillId: source.skillId == null && source.skill_id == null
      ? null
      : String(source.skillId || source.skill_id),
    direction: normalizeNullableDirection(source.direction),
    side: normalizeNullableSide(source.side),
    target: source.target == null ? null : String(source.target),
    targetType: source.targetType == null && source.target_type == null
      ? null
      : String(source.targetType || source.target_type),
    distanceMeters: nullableNonNegative(source.distanceMeters ?? source.distance_meters),
    stepCount: nullablePositiveInteger(source.stepCount ?? source.step_count),
    durationSeconds: nullablePositive(source.durationSeconds ?? source.duration_seconds),
    speed: normalizeSpeed(source.speed),
    angleDegrees: nullableAngle(source.angleDegrees ?? source.angle_degrees),
    repeatCount: nullablePositiveInteger(source.repeatCount ?? source.repeat_count),
    modifiers: uniqueStrings(source.modifiers),
    warnings: uniqueStrings(source.warnings),
  };
}

function uniqueRelations(input) {
  const seen = new Set();
  return (Array.isArray(input) ? input : []).map((relation) => ({
    beforeActionId: String(relation?.beforeActionId || relation?.before_action_id || ''),
    afterActionId: String(relation?.afterActionId || relation?.after_action_id || ''),
  })).filter((relation) => {
    if (!relation.beforeActionId || !relation.afterActionId || relation.beforeActionId === relation.afterActionId) return false;
    const key = `${relation.beforeActionId}>${relation.afterActionId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueParallelRelations(input) {
  const seen = new Set();
  return (Array.isArray(input) ? input : []).map((relation, index) => ({
    groupId: sanitizeId(relation?.groupId || relation?.group_id || `parallel-${index + 1}`, `parallel-${index + 1}`),
    actionIds: uniqueStrings(relation?.actionIds || relation?.action_ids),
  })).filter((relation) => {
    if (relation.actionIds.length < 2 || seen.has(relation.groupId)) return false;
    seen.add(relation.groupId);
    return true;
  });
}

function normalizeTargets(input) {
  const seen = new Set();
  return normalizeObjectArray(input).map((target) => ({
    ...target,
    name: String(target.name || target.target || target.objectId || target.object_id || '').trim(),
    type: String(target.type || target.objectType || target.object_type || 'generic').trim(),
    actionIds: uniqueStrings(target.actionIds || target.action_ids),
  })).filter((target) => {
    if (!target.name) return false;
    const key = `${target.type}:${target.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeObjectArray(input) {
  return (Array.isArray(input) ? input : []).map((value) => (
    isPlainObject(value) ? structuredClone(value) : {}
  )).filter((value) => Object.keys(value).length > 0);
}

function normalizeStringOrObjectArray(input) {
  return (Array.isArray(input) ? input : []).map((value) => (
    isPlainObject(value) ? structuredClone(value) : String(value)
  ));
}

function normalizeLanguage(value) {
  return ['zh', 'en', 'mixed', 'unknown'].includes(value) ? value : 'unknown';
}

function normalizeNullableDirection(value) {
  return value == null || value === '' ? null : MOTION_DIRECTIONS.includes(value) ? value : String(value);
}

function normalizeNullableSide(value) {
  return value == null || value === '' ? null : MOTION_SIDES.includes(value) ? value : 'none';
}

function normalizeSpeed(value) {
  return value == null || value === '' || value === 'normal' ? value == null ? null : 'normal' : ['slow', 'fast', 'gentle', 'large', 'small'].includes(value) ? value : 'normal';
}

function nullableNonNegative(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function nullablePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function nullablePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : null;
}

function nullableAngle(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(-360, Math.min(360, number)) : null;
}

function clamp(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function sanitizeId(value, fallback) {
  const text = String(value || fallback).trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  const safe = text || fallback;
  return /^[A-Za-z]/.test(safe) ? safe : `id-${safe}`;
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
