import assert from 'node:assert/strict';
import {
  cancelSkillGraph,
  createMotionSkillGraph,
  getReadySkillNodes,
  markSkillNodeCompleted,
  markSkillNodeFailed,
  markSkillNodeRunning,
  serializeSkillGraph,
  topologicalSortSkillGraph,
  validateMotionSkillGraph,
} from '../src/human-motion/intelligence/motion-skill-graph.js';
import { createActorMotionContext } from '../src/human-motion/intelligence/actor-motion-context.js';
import { parseMotionText } from '../src/human-motion/intelligence/rule-based-motion-language-adapter.js';
import { planMotionIntent, validateActionPlan } from '../src/human-motion/intelligence/motion-planner.js';
import { InMemoryWorldContextAdapter } from '../src/human-motion/world/world-context.js';
import { createWWIIAirbaseDemoPlans } from '../src/human-motion/intelligence/wwii-airbase-context.js';

const graph = createMotionSkillGraph({
  graphId: 'skill-graph-test',
  planId: 'action-plan-test',
  nodes: [
    { nodeId: 'walk', skillId: 'walk', dependencies: [] },
    { nodeId: 'turn', skillId: 'turn_right', dependencies: ['walk'] },
    { nodeId: 'salute', skillId: 'salute_right', dependencies: ['turn'] },
    { nodeId: 'look', skillId: 'look_at', dependencies: ['turn'], parallelGroup: 'parallel-1' },
  ],
  edges: [
    { edgeId: 'walk-turn', fromNodeId: 'walk', toNodeId: 'turn' },
    { edgeId: 'turn-salute', fromNodeId: 'turn', toNodeId: 'salute' },
    { edgeId: 'turn-look', fromNodeId: 'turn', toNodeId: 'look' },
  ],
  parallelGroups: [{ groupId: 'parallel-1', nodeIds: ['salute', 'look'] }],
});
assert.equal(validateMotionSkillGraph(graph).valid, true);
assert.deepEqual(topologicalSortSkillGraph(graph), ['walk', 'turn', 'look', 'salute']);
assert.deepEqual(getReadySkillNodes(graph).map((node) => node.nodeId), ['walk']);

let progressed = markSkillNodeRunning(graph, 'walk');
assert.equal(progressed.status, 'running');
progressed = markSkillNodeCompleted(progressed, 'walk');
assert.deepEqual(getReadySkillNodes(progressed).map((node) => node.nodeId), ['turn']);
progressed = markSkillNodeCompleted(markSkillNodeRunning(progressed, 'turn'), 'turn');
assert.deepEqual(getReadySkillNodes(progressed).map((node) => node.nodeId).sort(), ['look', 'salute']);
progressed = markSkillNodeCompleted(markSkillNodeRunning(progressed, 'look'), 'look');
progressed = markSkillNodeCompleted(markSkillNodeRunning(progressed, 'salute'), 'salute');
assert.equal(progressed.status, 'completed');

const failed = markSkillNodeFailed(graph, 'turn', new Error('target unavailable'));
assert.equal(failed.status, 'failed');
assert.equal(failed.nodes.find((node) => node.nodeId === 'turn').lastError, 'target unavailable');
const cancelled = cancelSkillGraph(graph, 'operator_stop');
assert.equal(cancelled.status, 'cancelled');
assert.ok(cancelled.nodes.every((node) => node.status === 'cancelled'));
assert.deepEqual(serializeSkillGraph(graph), graph);

const cyclic = createMotionSkillGraph({
  graphId: 'cyclic-graph',
  nodes: [
    { nodeId: 'a', skillId: 'walk', dependencies: ['b'] },
    { nodeId: 'b', skillId: 'turn_right', dependencies: ['a'] },
  ],
});
assert.equal(validateMotionSkillGraph(cyclic).valid, false);
assert.ok(validateMotionSkillGraph(cyclic).errors.includes('MOTION_SKILL_GRAPH_CYCLE'));
assert.deepEqual(topologicalSortSkillGraph(cyclic), []);

const world = new InMemoryWorldContextAdapter({
  id: 'test-airbase',
  affordances: [{
    objectId: 'aircraft-01',
    objectType: 'aircraft',
    transform: { position: [0, 0, 5], rotation: [0, 0, 0, 1] },
    standingZones: [{ id: 'aircraft-service', position: [0, 0, 3.5] }],
    inspectPoints: [{ id: 'aircraft-inspect', position: [0, 1.2, 4.2] }],
    reachPoints: [{ id: 'aircraft-reach', position: [0, 1.1, 4] }],
    metadata: { aliases: ['飞机', 'aircraft'] },
  }],
});
const mechanic = createActorMotionContext({
  actorId: 'mechanic-001',
  occupation: { id: 'aircraft_mechanic', label: 'Mechanic', period: 'wwii' },
  dominantSide: 'left',
});
const pilot = createActorMotionContext({
  actorId: 'pilot-001',
  occupation: { id: 'pilot', label: 'Pilot', period: 'wwii' },
});
const mechanicPlan = planMotionIntent(parseMotionText('检查飞机', { actorContext: mechanic }), { actorContext: mechanic, worldContext: world });
const pilotPlan = planMotionIntent(parseMotionText('检查飞机', { actorContext: pilot }), { actorContext: pilot, worldContext: world });
assert.equal(validateActionPlan(mechanicPlan.plan).valid, true);
assert.equal(validateMotionSkillGraph(mechanicPlan.skillGraph).valid, true);
assert.deepEqual(mechanicPlan.plan.nodes.map((node) => node.skillId), ['walk', 'turn_to', 'look_at', 'bend', 'reach', 'inspect', 'recover']);
assert.ok(!pilotPlan.plan.nodes.some((node) => node.skillId === 'bend'));
assert.ok(!pilotPlan.plan.nodes.some((node) => node.skillId === 'recover'));
assert.notDeepEqual(mechanicPlan.plan.semanticRequiredSkills, pilotPlan.plan.semanticRequiredSkills);
assert.ok(mechanicPlan.plan.requiredAffordances.includes('inspectPoints'));
assert.ok(mechanicPlan.plan.requiredAffordances.includes('reachPoints'));
assert.ok(mechanicPlan.plan.nodes.every((node) => !/quaternion|matrix|vertex|bindoffset|bone(scale|length)|skin/i.test(JSON.stringify(node.goalRequests))));
assert.equal(mechanicPlan.plan.nodes.find((node) => node.skillId === 'reach').parameters.side, 'left');

const disabledActor = createActorMotionContext({ actorId: 'disabled-actor', disabledSkills: ['salute_right'] });
const disabledPlan = planMotionIntent(parseMotionText('用右手敬礼。', { actorContext: disabledActor }), { actorContext: disabledActor, worldContext: world });
assert.equal(disabledPlan.plan.status, 'unsupported');
assert.ok(disabledPlan.plan.warnings.includes('DISABLED_SKILL:salute_right'));
const restrictedActor = createActorMotionContext({ actorId: 'restricted-actor', availableSkills: ['walk'] });
const restrictedPlan = planMotionIntent(parseMotionText('敬礼。', { actorContext: restrictedActor }), { actorContext: restrictedActor, worldContext: world });
assert.equal(restrictedPlan.plan.status, 'unsupported');
assert.ok(restrictedPlan.plan.warnings.includes('UNAVAILABLE_SKILL:salute'));

const demos = createWWIIAirbaseDemoPlans();
assert.equal(demos.length, 5);
for (const demo of demos) {
  assert.equal(validateActionPlan(demo.plan).valid, true, demo.id);
  assert.equal(validateMotionSkillGraph(demo.skillGraph).valid, true, demo.id);
}
const byDemoId = new Map(demos.map((demo) => [demo.id, demo]));
assert.deepEqual(byDemoId.get('pilot-salute').plan.nodes.map((node) => node.skillId), ['walk', 'stop', 'salute_right']);
assert.deepEqual(byDemoId.get('mechanic-inspection').plan.nodes.map((node) => node.skillId), ['walk', 'turn_to', 'look_at', 'bend', 'reach', 'inspect', 'recover']);
assert.ok(byDemoId.get('commander-briefing').plan.semanticRequiredSkills.includes('point_left'));
assert.ok(byDemoId.get('commander-briefing').plan.parallelGroups.some((group) => group.nodeIds.length === 2));
assert.ok(byDemoId.get('guard-patrol').plan.semanticRequiredSkills.includes('patrol'));
assert.ok(byDemoId.get('guard-patrol').plan.semanticRequiredSkills.includes('look_left'));
assert.ok(byDemoId.get('guard-patrol').plan.semanticRequiredSkills.includes('look_right'));
assert.deepEqual(byDemoId.get('radio-operator').plan.requiresSolverCapabilities.sort(), ['operate', 'sit']);

console.log('PASS DAG validation, sequence/parallel readiness, lifecycle state, cancellation, cycle rejection, contextual planning, disabled skills, semantic GoalRequests, and five WWII airbase plans');
