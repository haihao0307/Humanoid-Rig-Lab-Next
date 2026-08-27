export const WORLD_TARGET_V1_SCHEMA = 'humanoid_rig/world_target@1.0';

export const TASK17A_WORLD_TARGETS_V1 = Object.freeze({
  'yellow-marker': Object.freeze({
    targetId: 'yellow-marker',
    label: '黄色标记点',
    position: Object.freeze([0, 0, -3]),
    facing: Math.PI,
    tags: Object.freeze(['yellow', 'marker', '黄点', '黄色标记点', '目标点']),
  }),
});

export function createWorldTargetV1(input = {}) {
  const target = {
    schema: WORLD_TARGET_V1_SCHEMA,
    type: 'WorldTarget',
    targetId: stableId(input.targetId, 'target'),
    label: String(input.label || input.targetId || '目标点'),
    position: vector3(input.position),
    facing: finite(input.facing, 0),
    groundNormal: normalizedVector3(input.groundNormal, [0, 1, 0]),
    tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
    worldContextRevision: Math.max(0, Math.floor(Number(input.worldContextRevision) || 0)),
  };
  if (target.groundNormal[1] <= 0) throw new Error('WorldTarget groundNormal must point upward.');
  return target;
}

export function resolveWorldTargetV1(reference, worldTargets = TASK17A_WORLD_TARGETS_V1) {
  const token = String(reference || '').trim();
  const direct = worldTargets[token];
  if (direct) return createWorldTargetV1(direct);
  const match = Object.values(worldTargets).find((target) => (
    target.label === token || target.tags?.some((tag) => token.includes(tag) || tag.includes(token))
  ));
  if (!match) throw new Error(`Unknown Task 17A world target: ${token || 'empty'}`);
  return createWorldTargetV1(match);
}

function vector3(value) {
  return [0, 1, 2].map((index) => finite(value?.[index], 0));
}

function normalizedVector3(value, fallback) {
  const result = vector3(value ?? fallback);
  const length = Math.hypot(...result);
  return length > 1e-8 ? result.map((component) => component / length) : [...fallback];
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stableId(value, fallback) {
  const result = String(value || fallback);
  return /^[A-Za-z][A-Za-z0-9._-]*$/.test(result) ? result : fallback;
}
