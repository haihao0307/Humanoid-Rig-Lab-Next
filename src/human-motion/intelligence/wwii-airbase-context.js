import { createActorMotionContext, normalizeOccupationId } from './actor-motion-context.js';
import { planMotionIntent } from './motion-planner.js';
import { parseMotionText } from './rule-based-motion-language-adapter.js';
import { InMemoryWorldContextAdapter } from '../world/world-context.js';

export const WWII_AIRBASE_ROLES = Object.freeze([
  'pilot', 'aircraft_mechanic', 'commander', 'guard', 'radio_operator', 'ground_crew',
]);

export const WWII_AIRBASE_DEMOS = Object.freeze([
  { id: 'pilot-salute', role: 'pilot', command: '飞行员向前走三步，停下，用右手敬礼。' },
  { id: 'mechanic-inspection', role: 'aircraft_mechanic', command: '地勤机械师走到发动机旁边，弯腰检查发动机。' },
  { id: 'commander-briefing', role: 'commander', command: '指挥员转向右侧，用左手指向跑道，同时观察飞机。' },
  { id: 'guard-patrol', role: 'guard', command: '警卫缓慢向前巡逻，同时左右观察。' },
  { id: 'radio-operator', role: 'radio_operator', command: '通讯员走到无线电台旁，坐下并操作无线电。' },
]);

const ROLE_TEMPLATES = Object.freeze({
  pilot: { label: '飞行员', rank: 'pilot_officer', alertness: 0.72, fatigue: 0.12, equipment: [{ id: 'pilot-sidearm', type: 'sidearm', carriedBy: 'belt' }] },
  aircraft_mechanic: { label: '地勤机械师', rank: null, alertness: 0.58, fatigue: 0.2, equipment: [{ id: 'mechanic-toolbox', type: 'toolbox', carriedBy: 'rightHand' }] },
  commander: { label: '指挥员', rank: 'commander', alertness: 0.82, fatigue: 0.1, equipment: [{ id: 'command-map', type: 'map', carriedBy: 'leftHand' }] },
  guard: { label: '警卫', rank: 'guard', alertness: 0.9, fatigue: 0.08, equipment: [{ id: 'guard-rifle', type: 'rifle', carriedBy: 'back' }] },
  radio_operator: { label: '通讯员', rank: 'radio_operator', alertness: 0.74, fatigue: 0.16, equipment: [{ id: 'radio-headset', type: 'headset', carriedBy: 'belt' }] },
  ground_crew: { label: '地勤人员', rank: null, alertness: 0.68, fatigue: 0.18, equipment: [] },
});

export function createWWIIAirbaseActorContext(role, overrides = {}) {
  const occupationId = normalizeOccupationId(role);
  const template = ROLE_TEMPLATES[occupationId] || ROLE_TEMPLATES.ground_crew;
  return createActorMotionContext({
    actorId: `wwii-${occupationId}-001`,
    characterId: 'character_001',
    identity: { displayName: template.label, ageGroup: 'adult', tags: ['wwii', 'airbase', occupationId] },
    occupation: { id: occupationId, label: template.label, period: 'wwii' },
    rank: template.rank,
    dominantSide: 'right',
    equipment: template.equipment,
    currentPosture: 'standing',
    currentMotion: 'idle',
    currentPosition: [0, 0, 0],
    currentFacing: [0, 0, 1],
    fatigue: template.fatigue,
    alertness: template.alertness,
    metadata: { scenario: 'wwii-airbase-v1' },
    ...overrides,
  });
}

export function createWWIIAirbaseWorldContext({ id = 'wwii-airbase-v1', actorTransforms = {} } = {}) {
  return new InMemoryWorldContextAdapter({ id, actorTransforms, affordances: [
    affordance('aircraft-b24-01', 'aircraft', [0, 0, 8], {
      standingZones: points('aircraft-service', [[0, 0, 5.8]]),
      inspectPoints: points('aircraft-inspect', [[0, 1.4, 7.1]]),
      lookPoints: points('aircraft-look', [[0, 1.65, 5.6]]),
      aliases: ['飞机', 'aircraft', 'airframe'],
    }),
    affordance('b24-engine-01', 'aircraft_engine', [3.8, 1.25, 7.8], {
      standingZones: points('engine-service', [[3.1, 0, 7.45]]),
      inspectPoints: points('engine-inspect', [[3.55, 1.22, 7.72]]),
      reachPoints: points('engine-reach', [[3.45, 1.12, 7.62]]),
      lookPoints: points('engine-look', [[3.15, 1.6, 7.3]]),
      aliases: ['发动机', 'engine'],
    }),
    affordance('b24-cockpit-01', 'cockpit', [0, 1.8, 7.35], {
      standingZones: points('cockpit-service', [[0, 0, 6.25]]),
      inspectPoints: points('cockpit-inspect', [[0, 1.65, 6.6]]),
      lookPoints: points('cockpit-look', [[0, 1.7, 6.15]]),
      aliases: ['驾驶舱', 'cockpit'],
    }),
    affordance('ladder-01', 'ladder', [-1.8, 0, 6.8], { climbPoints: points('ladder-climb', [[-1.8, 0.9, 6.8]]), aliases: ['梯子', 'ladder'] }),
    affordance('toolbox-01', 'toolbox', [2.1, 0, 6.4], { graspPoints: points('toolbox-grasp', [[2.1, 0.45, 6.4]]), aliases: ['工具箱', 'toolbox'] }),
    affordance('fuel-cart-01', 'fuel_cart', [-4.1, 0, 7.1], { pushPoints: points('fuel-push', [[-4.1, 1, 7.1]]), aliases: ['燃料车', 'fuel cart'] }),
    affordance('bomb-cart-01', 'bomb_cart', [-5.3, 0, 6.3], { pushPoints: points('bomb-push', [[-5.3, 1, 6.3]]), aliases: ['炸弹车', 'bomb cart'] }),
    affordance('runway-01', 'runway', [0, 0, 28], { lookPoints: points('runway-look', [[0, 1.65, 12]]), aliases: ['跑道', 'runway'] }),
    affordance('map-table-01', 'map_table', [4.5, 0, 2.8], { standingZones: points('map-standing', [[4.5, 0, 2]]), lookPoints: points('map-look', [[4.5, 1.55, 2.45]]), aliases: ['地图桌', '地图台', 'map table'] }),
    affordance('radio-station-01', 'radio_station', [5.4, 0, -2.2], {
      standingZones: points('radio-standing', [[5.4, 0, -3.15]]),
      reachPoints: points('radio-reach', [[5.4, 1.05, -2.4]]),
      seatPoints: points('radio-seat', [[5.4, 0, -2.85]]),
      aliases: ['无线电台', '无线电', 'radio station', 'radio'],
    }),
    affordance('chair-01', 'chair', [5.4, 0, -2.85], { seatPoints: points('chair-seat', [[5.4, 0, -2.85]]), aliases: ['椅子', '座椅', 'chair', 'seat'] }),
    affordance('checkpoint-01', 'checkpoint', [-2.8, 0, 1.8], { standingZones: points('checkpoint-standing', [[-2.8, 0, 1.8]]), lookPoints: points('checkpoint-look', [[-2.8, 1.6, 2.2]]), aliases: ['检查点', '哨点', 'checkpoint'] }),
  ] });
}

export function createWWIIAirbaseDemoPlans({ worldContext = createWWIIAirbaseWorldContext(), plannerOptions = {} } = {}) {
  return WWII_AIRBASE_DEMOS.map((demo) => {
    const actorContext = createWWIIAirbaseActorContext(demo.role);
    const intent = parseMotionText(demo.command, { actorContext });
    const planned = planMotionIntent(intent, { actorContext, worldContext, ...plannerOptions });
    return {
      ...demo,
      actorContext,
      intent: planned.intent,
      plan: planned.plan,
      skillGraph: planned.skillGraph,
    };
  });
}

function affordance(objectId, objectType, position, fields = {}) {
  return {
    objectId,
    objectType,
    transform: { position, rotation: [0, 0, 0, 1] },
    standingZones: [], inspectPoints: [], reachPoints: [], graspPoints: [], placePoints: [],
    pushPoints: [], pullPoints: [], climbPoints: [], seatPoints: [], lookPoints: [],
    accessRules: [],
    ...fields,
    metadata: { label: objectType, aliases: fields.aliases || [], scenario: 'wwii-airbase-v1' },
  };
}

function points(prefix, positions) {
  return positions.map((position, index) => ({ id: `${prefix}-${index + 1}`, position }));
}
