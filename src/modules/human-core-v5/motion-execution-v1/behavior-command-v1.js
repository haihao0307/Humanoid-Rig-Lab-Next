export const BEHAVIOR_COMMAND_V1_SCHEMA = 'humanoid_rig/behavior_command@1.0';

export function createBehaviorCommandV1(input = {}) {
  const issuedAt = Number(input.issuedAt);
  const command = {
    schema: BEHAVIOR_COMMAND_V1_SCHEMA,
    type: 'BehaviorCommand',
    commandId: stableId(input.commandId, 'behavior-command-v1'),
    actorId: stableId(input.actorId, 'human-reference-001'),
    text: String(input.text ?? '').trim(),
    locale: String(input.locale || 'zh-CN'),
    issuedAt: Number.isFinite(issuedAt) ? issuedAt : 0,
    worldContextRevision: nonNegativeInteger(input.worldContextRevision),
    targetReferences: Array.isArray(input.targetReferences)
      ? [...new Set(input.targetReferences.map((value) => stableId(value, 'target')))]
      : [],
  };
  assertBehaviorCommandV1(command);
  return command;
}

export function validateBehaviorCommandV1(value) {
  const errors = [];
  if (!value || value.schema !== BEHAVIOR_COMMAND_V1_SCHEMA || value.type !== 'BehaviorCommand') {
    errors.push(`schema must be ${BEHAVIOR_COMMAND_V1_SCHEMA} and type must be BehaviorCommand.`);
    return { valid: false, errors };
  }
  if (!isStableId(value.commandId)) errors.push('commandId must be stable.');
  if (!isStableId(value.actorId)) errors.push('actorId must be stable.');
  if (!String(value.text || '').trim()) errors.push('text is required.');
  if (value.locale !== 'zh-CN') errors.push('Task 17A supports locale zh-CN only.');
  if (!Number.isFinite(Number(value.issuedAt))) errors.push('issuedAt must be finite.');
  if (!Number.isInteger(value.worldContextRevision) || value.worldContextRevision < 0) {
    errors.push('worldContextRevision must be a non-negative integer.');
  }
  if (!Array.isArray(value.targetReferences) || value.targetReferences.some((id) => !isStableId(id))) {
    errors.push('targetReferences must contain stable IDs.');
  }
  return { valid: errors.length === 0, errors };
}

export function assertBehaviorCommandV1(value) {
  const result = validateBehaviorCommandV1(value);
  if (!result.valid) throw new Error(`Invalid BehaviorCommandV1: ${result.errors.join(' ')}`);
  return value;
}

function stableId(value, fallback) {
  const resolved = String(value || fallback);
  return isStableId(resolved) ? resolved : fallback;
}

function isStableId(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9._-]*$/.test(value);
}

function nonNegativeInteger(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}
