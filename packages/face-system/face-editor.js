import {
  assertFaceIdentityInput,
  createFaceIdentity,
  mergeFaceIdentity,
} from './face-profile.js';
import { createFaceRuntimeDescriptor } from './face-runtime.js';
import {
  createFaceExpressionState,
  mirrorFaceExpression,
  mirrorFaceExpressionPair,
  updateFaceExpression,
  normalizeFaceExpression,
} from './face-expression.js';
import { createFaceExpressionRuntimeDescriptor } from './face-runtime-descriptor.js';

export const FACE_STATE_SCHEMA = 'humanoid_rig/face_state@1.0';

export class FaceRevisionConflictError extends Error {
  constructor(expected, actual) {
    super(`Face revision conflict: expected ${expected}, current ${actual}.`);
    this.name = 'FaceRevisionConflictError';
    this.expected_revision = expected;
    this.actual_revision = actual;
  }
}

export function createFaceState(profileInput = {}, expressionInput = {}) {
  const identityInput = isPlainObject(profileInput) ? { ...profileInput } : {};
  delete identityInput.expression;
  const profile = createFaceIdentity(identityInput);
  const expression = createFaceExpressionState(
    isPlainObject(profileInput.expression) ? profileInput.expression : expressionInput,
  );
  const now = new Date().toISOString();
  return {
    schema: FACE_STATE_SCHEMA,
    revision: 1,
    updated_at: now,
    active_face_id: profile.face_id,
    dirty: false,
    profiles: { [profile.face_id]: profile },
    versions: { [profile.face_id]: [structuredClone(profile)] },
    runtime_descriptor: createFaceRuntimeDescriptor(profile),
    expression,
    expression_versions: [structuredClone(expression)],
    expression_runtime_descriptor: createFaceExpressionRuntimeDescriptor(expression),
  };
}

export function normalizeFaceState(input, { fallbackProfile = {} } = {}) {
  const source = isPlainObject(input) ? input : {};
  const profiles = {};
  for (const [id, value] of Object.entries(isPlainObject(source.profiles) ? source.profiles : {})) {
    try {
      const profile = createFaceIdentity({ ...value, face_id: value?.face_id || id });
      profiles[profile.face_id] = profile;
    } catch (_) {}
  }
  if (Object.keys(profiles).length === 0) {
    const profile = createFaceIdentity(fallbackProfile);
    profiles[profile.face_id] = profile;
  }
  const requested = String(source.active_face_id || '');
  const activeId = profiles[requested] ? requested : Object.keys(profiles)[0];
  const versions = {};
  const incomingVersions = isPlainObject(source.versions) ? source.versions : {};
  for (const profile of Object.values(profiles)) {
    const snapshots = Array.isArray(incomingVersions[profile.face_id])
      ? incomingVersions[profile.face_id].map((item) => {
          try { return createFaceIdentity({ ...item, face_id: profile.face_id }); } catch (_) { return null; }
        }).filter(Boolean)
      : [];
    versions[profile.face_id] = dedupeVersions(snapshots.length ? snapshots : [structuredClone(profile)]);
  }
  const active = profiles[activeId];
  const expression = normalizeFaceExpression(source.expression);
  const expressionVersions = normalizeExpressionVersions(source.expression_versions, expression);
  return {
    schema: FACE_STATE_SCHEMA,
    revision: nonNegativeInteger(source.revision, 1),
    updated_at: validIso(source.updated_at) ? source.updated_at : new Date().toISOString(),
    active_face_id: activeId,
    dirty: Boolean(source.dirty),
    profiles,
    versions,
    runtime_descriptor: createFaceRuntimeDescriptor(active),
    expression,
    expression_versions: expressionVersions,
    expression_runtime_descriptor: createFaceExpressionRuntimeDescriptor(expression),
  };
}

export class FaceEditor {
  create(stateInput, profileInput, options = {}) {
    const state = normalizeFaceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const profile = createFaceIdentity({ ...profileInput, version: 1 });
    if (state.profiles[profile.face_id]) throw new Error(`FaceIdentity ${profile.face_id} already exists.`);
    const next = structuredClone(state);
    next.revision += 1;
    next.updated_at = operationTime(options.at);
    next.active_face_id = profile.face_id;
    next.dirty = false;
    next.profiles[profile.face_id] = profile;
    next.versions[profile.face_id] = [structuredClone(profile)];
    next.runtime_descriptor = createFaceRuntimeDescriptor(profile);
    return next;
  }

  update(stateInput, patch, options = {}) {
    const state = normalizeFaceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    assertFaceIdentityInput(patch, { partial: true });
    const current = activeProfile(state);
    if (patch.face_id && patch.face_id !== current.face_id) throw new Error('Cannot rename the active face_id.');
    const profile = mergeFaceIdentity(current, { ...patch, face_id: current.face_id, version: current.version });
    return commit(state, profile, true, options.at);
  }

  updateExpression(stateInput, patch, options = {}) {
    const state = normalizeFaceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const expression = updateFaceExpression(state.expression, patch);
    return commitExpression(state, expression, true, options.at);
  }

  mirrorExpression(stateInput, options = {}) {
    const state = normalizeFaceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const expression = updateFaceExpression(state.expression, mirrorFaceExpression(state.expression));
    return commitExpression(state, expression, true, options.at);
  }

  mirrorExpressionPair(stateInput, pair, options = {}) {
    const state = normalizeFaceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const expression = updateFaceExpression(state.expression, mirrorFaceExpressionPair(state.expression, pair));
    return commitExpression(state, expression, true, options.at);
  }

  saveExpressionVersion(stateInput, options = {}) {
    const state = normalizeFaceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const next = commitExpression(state, normalizeFaceExpression(state.expression), false, options.at);
    next.expression_versions = appendExpressionVersion(next.expression_versions, next.expression);
    return next;
  }

  restoreExpressionVersion(stateInput, expressionRevision, options = {}) {
    const state = normalizeFaceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const snapshot = (state.expression_versions || [])
      .find((item) => item.expressionRevision === Number(expressionRevision));
    if (!snapshot) throw new Error(`Face Expression revision ${expressionRevision} does not exist.`);
    const expression = updateFaceExpression(state.expression, { channels: snapshot.channels });
    return commitExpression(state, expression, true, options.at);
  }

  loadExpressionVersion(stateInput, expressionRevision = null) {
    const state = normalizeFaceState(stateInput);
    if (expressionRevision == null) return structuredClone(state.expression);
    const snapshot = (state.expression_versions || [])
      .find((item) => item.expressionRevision === Number(expressionRevision));
    if (!snapshot) throw new Error(`Face Expression revision ${expressionRevision} does not exist.`);
    return structuredClone(snapshot);
  }

  saveVersion(stateInput, options = {}) {
    const state = normalizeFaceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const current = activeProfile(state);
    const profile = mergeFaceIdentity(current, { version: current.version + 1 });
    const next = commit(state, profile, false, options.at);
    next.versions[profile.face_id] = [...(next.versions[profile.face_id] || []), structuredClone(profile)].slice(-100);
    return next;
  }

  restoreVersion(stateInput, version, options = {}) {
    const state = normalizeFaceState(stateInput);
    assertExpectedRevision(state, options.expected_revision);
    const current = activeProfile(state);
    const snapshot = (state.versions[current.face_id] || []).find((item) => item.version === Number(version));
    if (!snapshot) throw new Error(`FaceIdentity ${current.face_id} version ${version} does not exist.`);
    const restored = createFaceIdentity({ ...snapshot, face_id: current.face_id, version: current.version + 1 });
    const next = commit(state, restored, false, options.at);
    next.versions[restored.face_id] = [...(next.versions[restored.face_id] || []), structuredClone(restored)].slice(-100);
    return next;
  }

  loadVersion(stateInput, version = null, { face_id = null } = {}) {
    const state = normalizeFaceState(stateInput);
    const id = String(face_id || state.active_face_id);
    if (version == null) {
      if (!state.profiles[id]) throw new Error(`FaceIdentity ${id} does not exist.`);
      return structuredClone(state.profiles[id]);
    }
    const snapshot = (state.versions[id] || []).find((item) => item.version === Number(version));
    if (!snapshot) throw new Error(`FaceIdentity ${id} version ${version} does not exist.`);
    return structuredClone(snapshot);
  }
}

export function getActiveFaceIdentity(stateInput) {
  return structuredClone(activeProfile(normalizeFaceState(stateInput)));
}

export function getActiveFaceExpression(stateInput) {
  return structuredClone(normalizeFaceState(stateInput).expression);
}

function commit(state, profile, dirty, at) {
  const next = structuredClone(state);
  next.revision += 1;
  next.updated_at = operationTime(at);
  next.active_face_id = profile.face_id;
  next.dirty = dirty;
  next.profiles[profile.face_id] = profile;
  next.runtime_descriptor = createFaceRuntimeDescriptor(profile);
  return next;
}

function commitExpression(state, expression, dirty, at) {
  const next = structuredClone(state);
  next.revision += 1;
  next.updated_at = operationTime(at);
  next.dirty = dirty;
  next.expression = normalizeFaceExpression(expression);
  next.expression_runtime_descriptor = createFaceExpressionRuntimeDescriptor(next.expression);
  return next;
}

function appendExpressionVersion(versions, expression) {
  return dedupeExpressionVersions([...(Array.isArray(versions) ? versions : []), structuredClone(expression)]);
}

function activeProfile(state) {
  const profile = state.profiles[state.active_face_id];
  if (!profile) throw new Error('Face state has no active identity.');
  return profile;
}

function assertExpectedRevision(state, expected) {
  if (expected == null) return;
  const value = Number(expected);
  if (!Number.isInteger(value) || value !== state.revision) throw new FaceRevisionConflictError(expected, state.revision);
}

function dedupeVersions(items) {
  const byVersion = new Map();
  for (const item of items) byVersion.set(item.version, item);
  return [...byVersion.values()].sort((left, right) => left.version - right.version).slice(-100);
}

function normalizeExpressionVersions(input, fallback) {
  const snapshots = Array.isArray(input)
    ? input.map((item) => {
        try { return normalizeFaceExpression(item); } catch (_) { return null; }
      }).filter(Boolean)
    : [];
  return dedupeExpressionVersions(snapshots.length ? snapshots : [fallback]);
}

function dedupeExpressionVersions(items) {
  const byRevision = new Map();
  for (const item of items) byRevision.set(item.expressionRevision, structuredClone(item));
  return [...byRevision.values()]
    .sort((left, right) => left.expressionRevision - right.expressionRevision)
    .slice(-100);
}

function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function operationTime(value) {
  return validIso(value) ? value : new Date().toISOString();
}

function validIso(value) {
  return Number.isFinite(Date.parse(value || ''));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
