export const WORLD_AFFORDANCE_SCHEMA = 'humanoid_rig/world_affordance@1.0';

export function createWorldAffordance(input = {}) {
  return normalizeWorldAffordance({
    schema: WORLD_AFFORDANCE_SCHEMA,
    objectId: 'world_object',
    objectType: 'generic',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
    bounds: null,
    standingZones: [], inspectPoints: [], reachPoints: [], graspPoints: [], placePoints: [],
    pushPoints: [], pullPoints: [], climbPoints: [], seatPoints: [], lookPoints: [],
    accessRules: [], metadata: {},
    ...cloneObject(input),
  });
}

export function normalizeWorldAffordance(input = {}) {
  const source = cloneObject(input);
  return {
    ...source,
    schema: WORLD_AFFORDANCE_SCHEMA,
    objectId: text(source.objectId ?? source.object_id, 'world_object'),
    objectType: text(source.objectType ?? source.object_type, 'generic'),
    transform: {
      position: vector3(source.transform?.position ?? source.position, [0, 0, 0]),
      rotation: quaternion(source.transform?.rotation ?? source.rotation, [0, 0, 0, 1]),
    },
    bounds: source.bounds == null ? null : clone(source.bounds),
    standingZones: normalizePoints(source.standingZones ?? source.standing_zones, 'standing-zone'),
    inspectPoints: normalizePoints(source.inspectPoints ?? source.inspect_points, 'inspect-point'),
    reachPoints: normalizePoints(source.reachPoints ?? source.reach_points, 'reach-point'),
    graspPoints: normalizePoints(source.graspPoints ?? source.grasp_points, 'grasp-point'),
    placePoints: normalizePoints(source.placePoints ?? source.place_points, 'place-point'),
    pushPoints: normalizePoints(source.pushPoints ?? source.push_points, 'push-point'),
    pullPoints: normalizePoints(source.pullPoints ?? source.pull_points, 'pull-point'),
    climbPoints: normalizePoints(source.climbPoints ?? source.climb_points, 'climb-point'),
    seatPoints: normalizePoints(source.seatPoints ?? source.seat_points, 'seat-point'),
    lookPoints: normalizePoints(source.lookPoints ?? source.look_points, 'look-point'),
    accessRules: Array.isArray(source.accessRules ?? source.access_rules) ? clone(source.accessRules ?? source.access_rules) : [],
    metadata: cloneObject(source.metadata),
  };
}

export function validateWorldAffordance(input) {
  const affordance = normalizeWorldAffordance(input);
  const errors = [];
  if (affordance.schema !== WORLD_AFFORDANCE_SCHEMA) errors.push('WORLD_AFFORDANCE_SCHEMA_INVALID');
  if (!affordance.objectId) errors.push('WORLD_AFFORDANCE_OBJECT_ID_MISSING');
  if (!affordance.objectType) errors.push('WORLD_AFFORDANCE_OBJECT_TYPE_MISSING');
  if (!affordance.transform.position.every(Number.isFinite)) errors.push('WORLD_AFFORDANCE_POSITION_INVALID');
  if (!affordance.transform.rotation.every(Number.isFinite)) errors.push('WORLD_AFFORDANCE_ROTATION_INVALID');
  return { valid: errors.length === 0, errors, affordance };
}

export class MotionWorldContextAdapter {
  constructor({ id = 'world-context' } = {}) {
    this.id = String(id);
  }

  resolveTarget() { return null; }
  resolveSpatialRelation() { return null; }
  getActorTransform() { return null; }
  getGroundInfo() { return null; }
  getInteractionPoints() { return []; }
  getStandingZones() { return []; }
  getReachablePoints() { return []; }
  getPathToTarget() { return null; }
  queryAffordances() { return null; }
}

/**
 * A deterministic fallback for commands such as "左前方走两米". Named objects
 * deliberately remain unresolved so a caller can request a real world adapter.
 */
export class RelativeWorldContextAdapter extends MotionWorldContextAdapter {
  constructor(options = {}) {
    super({ id: options.id || 'relative-world' });
    this.actorTransforms = new Map(Object.entries(options.actorTransforms || {}).map(([id, transform]) => [id, normalizeTransform(transform)]));
  }

  resolveTarget() {
    return null;
  }

  resolveSpatialRelation(target, relation, actorContext = {}) {
    const transform = this.getActorTransform(actorContext.actorId, actorContext);
    const relationKey = normalizeRelation(relation);
    const vector = relationVector(relationKey, transform);
    const distance = Math.max(0, Number(target?.distanceMeters ?? target?.distance ?? 1) || 1);
    return {
      status: 'relative',
      relation: relationKey,
      targetName: target?.targetName ?? target?.name ?? null,
      position: add(transform.position, scale(vector, distance)),
      direction: vector,
      distance,
      warning: target?.targetName ? 'WORLD_TARGET_UNRESOLVED_RELATIVE_PREVIEW' : null,
    };
  }

  getActorTransform(actorId, actorContext = {}) {
    const stored = this.actorTransforms.get(String(actorId || actorContext?.actorId || ''));
    if (stored) return clone(stored);
    const position = vector3(actorContext?.currentPosition, [0, 0, 0]);
    const forward = normalizeVector(actorContext?.currentFacing, [0, 0, 1]);
    return {
      position,
      forward,
      right: normalizeVector([forward[2], 0, -forward[0]], [1, 0, 0]),
      up: [0, 1, 0],
    };
  }

  getGroundInfo() { return { height: 0, normal: [0, 1, 0], source: 'relative-ground' }; }

  getPathToTarget(actorId, targetId, actorContext = {}) {
    if (!targetId || typeof targetId !== 'object') return null;
    const actor = this.getActorTransform(actorId, actorContext);
    const destination = targetId.position || targetId.transform?.position;
    if (!Array.isArray(destination)) return null;
    return makePath(actor.position, destination, 'relative');
  }
}

export class InMemoryWorldContextAdapter extends MotionWorldContextAdapter {
  constructor({ id = 'in-memory-world', affordances = [], actorTransforms = {} } = {}) {
    super({ id });
    this.affordances = new Map();
    this.aliases = new Map();
    this.actorTransforms = new Map(Object.entries(actorTransforms).map(([actorId, transform]) => [actorId, normalizeTransform(transform)]));
    for (const affordance of affordances) this.registerAffordance(affordance);
  }

  registerAffordance(input) {
    const affordance = normalizeWorldAffordance(input);
    this.affordances.set(affordance.objectId, affordance);
    for (const alias of affordanceAliases(affordance)) this.aliases.set(normalizeName(alias), affordance.objectId);
    return clone(affordance);
  }

  resolveTarget(name) {
    const needle = normalizeName(name);
    const objectId = this.aliases.get(needle) || (this.affordances.has(String(name)) ? String(name) : null);
    const affordance = objectId ? this.affordances.get(objectId) : null;
    if (!affordance) return null;
    return {
      objectId: affordance.objectId,
      objectType: affordance.objectType,
      name: affordance.metadata?.label || affordance.objectId,
      transform: clone(affordance.transform),
      position: [...affordance.transform.position],
      affordance: clone(affordance),
    };
  }

  resolveSpatialRelation(target, relation, actorContext = {}) {
    const supplied = target && typeof target === 'object' ? target : null;
    const resolved = supplied?.objectId && Array.isArray(supplied.position)
      ? supplied
      : this.resolveTarget(typeof target === 'string' ? target : (supplied?.targetName || supplied?.name || supplied?.objectId), actorContext);
    if (!resolved) return null;
    const zones = this.getStandingZones(resolved.objectId);
    if (zones.length) return { status: 'resolved', relation: normalizeRelation(relation), target: clone(resolved), position: [...zones[0].position], standingZoneId: zones[0].id };
    return { status: 'resolved', relation: normalizeRelation(relation), target: clone(resolved), position: [...resolved.position] };
  }

  getActorTransform(actorId, actorContext = {}) {
    const stored = this.actorTransforms.get(String(actorId || actorContext?.actorId || ''));
    if (stored) return clone(stored);
    return new RelativeWorldContextAdapter().getActorTransform(actorId, actorContext);
  }

  getGroundInfo() { return { height: 0, normal: [0, 1, 0], source: 'in-memory-ground' }; }

  getInteractionPoints(targetId) {
    const affordance = this.queryAffordances(targetId);
    if (!affordance) return [];
    return clone([
      ...affordance.inspectPoints, ...affordance.reachPoints, ...affordance.graspPoints,
      ...affordance.placePoints, ...affordance.pushPoints, ...affordance.pullPoints,
      ...affordance.climbPoints, ...affordance.seatPoints, ...affordance.lookPoints,
    ]);
  }

  getStandingZones(targetId) { return clone(this.queryAffordances(targetId)?.standingZones || []); }
  getReachablePoints(targetId) {
    const affordance = this.queryAffordances(targetId);
    return clone(affordance ? [...affordance.reachPoints, ...affordance.graspPoints, ...affordance.inspectPoints] : []);
  }

  getPathToTarget(actorId, targetId, actorContext = {}) {
    const target = typeof targetId === 'string' ? this.resolveTarget(targetId) : targetId;
    if (!target) return null;
    const actor = this.getActorTransform(actorId, actorContext);
    const standing = this.getStandingZones(target.objectId);
    const destination = standing[0]?.position || target.position || target.transform?.position;
    if (!Array.isArray(destination)) return null;
    return makePath(actor.position, destination, 'in-memory');
  }

  queryAffordances(targetId) {
    const id = typeof targetId === 'object' ? targetId.objectId : targetId;
    const affordance = this.affordances.get(String(id || ''));
    return affordance ? clone(affordance) : null;
  }
}

function normalizePoints(values, prefix) {
  return (Array.isArray(values) ? values : []).map((value, index) => {
    const source = cloneObject(value);
    return {
      ...source,
      id: text(source.id, `${prefix}-${index + 1}`),
      position: vector3(source.position, [0, 0, 0]),
    };
  });
}

function affordanceAliases(affordance) {
  return [
    affordance.objectId,
    affordance.objectType,
    affordance.metadata?.label,
    ...(Array.isArray(affordance.metadata?.aliases) ? affordance.metadata.aliases : []),
  ].filter(Boolean);
}

function normalizeTransform(value) {
  const source = cloneObject(value);
  const forward = normalizeVector(source.forward ?? source.facing, [0, 0, 1]);
  return {
    position: vector3(source.position, [0, 0, 0]),
    forward,
    right: normalizeVector(source.right, [forward[2], 0, -forward[0]]),
    up: normalizeVector(source.up, [0, 1, 0]),
  };
}

function normalizeRelation(value) {
  const source = String(value ?? 'forward').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliases = {
    '前': 'forward', '前方': 'forward', forward: 'forward', front: 'forward',
    '后': 'backward', '后方': 'backward', backward: 'backward', back: 'backward',
    '左': 'left', '左侧': 'left', left: 'left',
    '右': 'right', '右侧': 'right', right: 'right',
    '左前': 'left_forward', '左前方': 'left_forward', left_forward: 'left_forward', front_left: 'left_forward',
    '右前': 'right_forward', '右前方': 'right_forward', right_forward: 'right_forward', front_right: 'right_forward',
    '左后': 'left_backward', '左后方': 'left_backward', left_backward: 'left_backward', back_left: 'left_backward',
    '右后': 'right_backward', '右后方': 'right_backward', right_backward: 'right_backward', back_right: 'right_backward',
  };
  return aliases[source] || 'forward';
}

function relationVector(relation, transform) {
  const forward = transform.forward || [0, 0, 1];
  const right = transform.right || [1, 0, 0];
  const vectors = {
    forward,
    backward: scale(forward, -1),
    left: scale(right, -1),
    right,
    left_forward: add(scale(right, -1), forward),
    right_forward: add(right, forward),
    left_backward: add(scale(right, -1), scale(forward, -1)),
    right_backward: add(right, scale(forward, -1)),
  };
  return normalizeVector(vectors[relation] || forward, [0, 0, 1]);
}

function makePath(start, end, source) {
  const distance = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
  return { status: 'ready', source, points: [[...start], [...end]], distance: Number(distance.toFixed(6)) };
}

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_\-，。,.!！?？]/g, '');
}

function vector3(value, fallback) {
  const source = Array.isArray(value) ? value : [];
  return [0, 1, 2].map((index) => finite(source[index], fallback[index]));
}

function quaternion(value, fallback) {
  const source = Array.isArray(value) ? value : [];
  return [0, 1, 2, 3].map((index) => finite(source[index], fallback[index]));
}

function normalizeVector(value, fallback) {
  const vector = vector3(value, fallback);
  const length = Math.hypot(...vector);
  return length > 1e-8 ? vector.map((item) => Number((item / length).toFixed(8))) : [...fallback];
}

function add(left, right) { return left.map((value, index) => value + right[index]); }
function scale(value, factor) { return value.map((item) => item * factor); }
function finite(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function text(value, fallback) { const result = String(value ?? '').trim(); return result || fallback; }
function cloneObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {}; }
function clone(value) { return value === undefined ? undefined : structuredClone(value); }
