import assert from 'node:assert/strict';

import {
  InMemoryWorldContextAdapter,
  RelativeWorldContextAdapter,
  createWorldAffordance,
  validateWorldAffordance,
} from '../src/human-motion/world/world-context.js';
import { createActorMotionContext } from '../src/human-motion/intelligence/actor-motion-context.js';

const engine = createWorldAffordance({
  objectId: 'b24_engine_01',
  objectType: 'aircraft_engine',
  transform: { position: [4.2, 1.35, 8.1], rotation: [0, 0, 0, 1] },
  standingZones: [{ id: 'engine_service_zone', position: [3.4, 0, 7.8], facingTarget: 'b24_engine_01' }],
  inspectPoints: [{ id: 'cowling_inspect', position: [4, 1.25, 7.95] }],
  reachPoints: [{ id: 'cowling_handle', position: [3.92, 1.18, 7.82] }],
  metadata: { label: '发动机', aliases: ['engine', 'B-24 engine'] },
});
assert.equal(validateWorldAffordance(engine).valid, true);

const actor = createActorMotionContext({ actorId: 'mechanic_001', currentPosition: [0, 0, 0], currentFacing: [0, 0, 1] });
const world = new InMemoryWorldContextAdapter({ affordances: [engine] });
const resolved = world.resolveTarget('发动机', actor);
assert.equal(resolved.objectId, 'b24_engine_01');
assert.equal(world.resolveTarget('missing crate', actor), null);
assert.equal(world.getStandingZones(resolved.objectId).length, 1);
assert.equal(world.getInteractionPoints(resolved.objectId).length, 2);
assert.equal(world.getReachablePoints(resolved.objectId).length, 2);
const path = world.getPathToTarget(actor.actorId, resolved.objectId, actor);
assert.equal(path.status, 'ready');
assert.ok(path.distance > 0);

const relative = new RelativeWorldContextAdapter();
assert.equal(relative.resolveTarget('发动机', actor), null, 'relative mode must not invent a named object');
const leftFront = relative.resolveSpatialRelation({ targetName: '发动机', distanceMeters: 2 }, 'left_forward', actor);
assert.equal(leftFront.status, 'relative');
assert.ok(leftFront.position[0] < 0);
assert.ok(leftFront.position[2] > 0);
assert.equal(leftFront.warning, 'WORLD_TARGET_UNRESOLVED_RELATIVE_PREVIEW');

console.log('PASS world affordance normalization, in-memory target resolution, path/interaction lookup, and explicit relative fallback');
