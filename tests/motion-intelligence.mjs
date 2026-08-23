import assert from 'node:assert/strict';

import {
  ACTOR_MOTION_CONTEXT_SCHEMA,
  createActorMotionContext,
  deriveMotionStyleFromActor,
  mergeActorMotionContext,
  validateActorMotionContext,
} from '../src/human-motion/intelligence/actor-motion-context.js';
import {
  DEMO_MOTION_COMMANDS,
  RemoteLanguageModelAdapter,
  RuleBasedMotionLanguageAdapter,
  parseNumber,
  parseMotionText,
} from '../src/modules/animation/text-motion/parser.js';
import { validateMotionIntent } from '../src/modules/animation/text-motion/intent.js';
import { WWII_AIRBASE_ROLES, createWWIIAirbaseActorContext } from '../src/human-motion/intelligence/wwii-airbase-context.js';

const defaults = createActorMotionContext();
assert.equal(defaults.schema, ACTOR_MOTION_CONTEXT_SCHEMA);
assert.equal(defaults.dominantSide, 'right');
assert.equal(defaults.currentPosture, 'standing');
assert.equal(validateActorMotionContext(defaults).valid, true);

const pilot = createActorMotionContext({
  actorId: 'pilot_001',
  occupation: { id: 'pilot', label: '飞行员', period: 'wwii' },
  dominantSide: 'left',
  fatigue: 0.2,
  alertness: 0.7,
  equipment: [{ id: 'sidearm_001', type: 'sidearm', carriedBy: 'belt' }],
});
const pilotStyle = deriveMotionStyleFromActor(pilot);
assert.equal(pilotStyle.occupationId, 'pilot');
assert.equal(pilotStyle.dominantSide, 'left');
assert.ok(pilotStyle.precision >= 0.8);

const mechanic = mergeActorMotionContext(pilot, {
  occupation: { id: 'aircraft_mechanic', label: '地勤机械师' },
  dominantSide: 'right',
  equipment: [{ id: 'toolbox_001', type: 'toolbox', carriedBy: 'rightHand' }],
  fatigue: 0.35,
});
const mechanicStyle = deriveMotionStyleFromActor(mechanic);
assert.equal(mechanic.occupation.id, 'aircraft_mechanic');
assert.ok(mechanicStyle.preferredSkills.includes('inspect'));
assert.ok(mechanicStyle.speedScale < 1);

for (const role of WWII_AIRBASE_ROLES) {
  const actor = createWWIIAirbaseActorContext(role);
  assert.equal(actor.occupation.id, role);
  assert.equal(validateActorMotionContext(actor).valid, true);
  assert.ok(actor.alertness >= 0 && actor.alertness <= 1);
  assert.ok(actor.fatigue >= 0 && actor.fatigue <= 1);
  assert.ok(deriveMotionStyleFromActor(actor).preferredSkills.length > 0);
}

const parser = new RuleBasedMotionLanguageAdapter();
const chinese = parser.parse('向前走三步，停下，向左转九十度，然后用右手敬礼。', { actorContext: pilot });
assert.equal(validateMotionIntent(chinese).valid, true);
assert.deepEqual(chinese.actions.map((item) => item.skillId), ['walk', 'stop', 'turn', 'salute']);
assert.equal(chinese.actions[0].stepCount, 3);
assert.equal(chinese.actions[2].angleDegrees, 90);
assert.equal(chinese.actions[3].side, 'right');
assert.equal(chinese.sequenceRelations.length, 3);
assert.equal(chinese.actorContextRef, 'pilot_001');

const english = parseMotionText('Walk two meters while looking right, then salute with the left hand.', { actorContext: pilot });
assert.equal(english.language, 'en');
assert.deepEqual(english.actions.map((item) => item.skillId), ['walk', 'look', 'salute']);
assert.equal(english.actions[0].distanceMeters, 2);
assert.equal(english.actions[1].direction, 'right');
assert.equal(english.actions[2].side, 'left');
assert.equal(english.parallelRelations.length, 1);

const chineseNumbers = parseMotionText('缓慢向前走半米，右转一百八十度，等待两秒。');
assert.equal(chineseNumbers.actions[0].distanceMeters, 0.5);
assert.equal(chineseNumbers.actions[1].angleDegrees, 180);
assert.equal(chineseNumbers.actions[2].durationSeconds, 2);
assert.ok(chineseNumbers.styleHints.some((item) => item.value === 'slow'));

const conditioned = parseMotionText('如果跑道空闲，慢慢向前巡逻，同时左右观察，直到收到命令。', { actorContext: createActorMotionContext({ occupation: { id: 'guard', label: '警卫' } }) });
assert.ok(conditioned.conditions.some((item) => item.type === 'if'));
assert.ok(conditioned.conditions.some((item) => item.type === 'until'));
assert.ok(conditioned.parallelRelations.length >= 1);
assert.ok(conditioned.actions.some((item) => item.skillId === 'patrol'));

const unresolved = parseMotionText('跳跃后空翻');
assert.equal(unresolved.status, 'unsupported');
assert.ok(unresolved.unresolvedTokens.includes('jump'));
assert.ok(unresolved.unresolvedTokens.includes('backflip'));
assert.equal(DEMO_MOTION_COMMANDS.length, 5);

const travel = parseMotionText('向左侧移两步，然后进入驾驶舱，最后离开驾驶舱。');
assert.deepEqual(travel.actions.map((item) => item.skillId), ['sidestep_left', 'enter', 'leave']);
assert.equal(parseNumber('半'), 0.5);
assert.equal(parseNumber('十'), 10);
assert.equal(parseNumber('一百八十'), 180);

const remoteAdapter = new RemoteLanguageModelAdapter({
  request: async () => ({ sourceText: 'remote test', language: 'en', actions: [{ actionId: 'action-1', verb: 'walk', skillId: 'walk' }] }),
});
assert.equal((await remoteAdapter.parse('remote test')).actions[0].skillId, 'walk');

console.log('PASS actor context, six occupation templates, style hints, deterministic bilingual language parsing, Chinese measurements, directions, sequential/parallel clauses, and unresolved tokens');
