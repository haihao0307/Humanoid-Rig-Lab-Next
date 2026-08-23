import assert from 'node:assert/strict';
import { createDefaultState } from '../src/default-state.js';
import {
  commitTextMotion,
  executeTextMotion,
  parseAndPlanTextMotion,
  previewTextMotion,
  saveTextMotionExecutionSummary,
  saveTextMotionPlan,
} from '../src/modules/animation/text-motion/executor.js';
import { createMotionGoalAdapter } from '../src/human-motion/intelligence/motion-goal-adapter.js';
import { MockWholeBodyExecutionAdapter } from '../src/human-motion/intelligence/motion-execution-adapter.js';
import { MotionExecutionScheduler, validateMotionExecutionSession } from '../src/human-motion/intelligence/motion-execution-scheduler.js';
import { createWWIIAirbaseActorContext, createWWIIAirbaseWorldContext } from '../src/human-motion/intelligence/wwii-airbase-context.js';

let persisted = createDefaultState();
let transactionCount = 0;
const hub = {
  getState: () => structuredClone(persisted),
  transaction(mutator) {
    transactionCount += 1;
    const next = structuredClone(persisted);
    mutator(next);
    next.revision += 1;
    persisted = next;
    return structuredClone(next);
  },
};

const initial = hub.getState();
const beforeTransientWork = JSON.stringify(initial);
const parsed = parseAndPlanTextMotion('向前走三步，停下，用右手敬礼。', { state: initial });
assert.equal(parsed.plan.status, 'ready');
assert.ok(parsed.skillGraph.nodes.length >= 3);
assert.equal(JSON.stringify(initial), beforeTransientWork, 'parse must not mutate ProjectState');
const preview = previewTextMotion('向前走三步，停下，用右手敬礼。', { state: initial });
assert.equal(preview.status, 'ready');
assert.ok(preview.clip);
assert.equal(transactionCount, 0, 'preview must not create a revision');

const savedPlan = saveTextMotionPlan(hub, '向前走三步，停下，用右手敬礼。');
assert.equal(savedPlan.status, 'ready');
assert.equal(transactionCount, 1, 'save plan must create exactly one revision');
assert.ok(persisted.character.animation.textMotion.skillGraph);
assert.equal(persisted.character.animation.textMotion.generatedClipId, null);

const committed = commitTextMotion(hub, '向前走三步，停下，用右手敬礼。');
assert.equal(committed.status, 'ready');
assert.equal(transactionCount, 2, 'commit generated motion must create exactly one revision');
assert.equal(persisted.character.animation.textMotion.generatedClipId, committed.clip.clipId);
assert.ok(persisted.character.animation.textMotion.skillGraph.nodes.length >= 3);

let clipReadyCount = 0;
const legacyExecution = executeTextMotion('向前走三步，停下，用右手敬礼。', {
  state: hub.getState(),
  onClipReady: () => { clipReadyCount += 1; },
});
assert.equal(legacyExecution.status, 'running');
assert.equal(legacyExecution.session.status, 'running');
assert.ok(legacyExecution.clip);
assert.equal(clipReadyCount, 1);
assert.equal(validateMotionExecutionSession(legacyExecution.session).valid, true);
const afterStartRevision = persisted.revision;
legacyExecution.scheduler.update(0.1);
const paused = legacyExecution.scheduler.pause();
assert.equal(paused.session.status, 'paused');
const resumed = legacyExecution.scheduler.resume();
assert.equal(resumed.session.status, 'running');
const completed = legacyExecution.scheduler.update(10);
assert.equal(completed.session.status, 'completed');
assert.equal(completed.session.progress, 1);
assert.equal(completed.session.completedNodeIds.length, completed.plan.nodes.length);
assert.equal(persisted.revision, afterStartRevision, 'playback progress must not create per-frame revisions');

const savedSummary = saveTextMotionExecutionSummary(hub, completed);
assert.equal(transactionCount, 3, 'saving an execution summary is an explicit one-revision boundary');
assert.equal(savedSummary.character.animation.textMotion.executionSession.status, 'completed');
assert.equal(savedSummary.character.animation.textMotion.intent.sourceText, '向前走三步，停下，用右手敬礼。');

const mockPlan = parseAndPlanTextMotion('慢慢向前走两米，同时向右观察。', { state: hub.getState() });
let clock = 0;
let summaryCount = 0;
const mockScheduler = new MotionExecutionScheduler({
  adapter: new MockWholeBodyExecutionAdapter(),
  summaryHz: 5,
  now: () => clock,
  onSummary: () => { summaryCount += 1; },
});
assert.equal(mockScheduler.prepare(mockPlan).session.status, 'prepared');
assert.equal(mockScheduler.start().session.status, 'running');
for (let index = 0; index < 4; index += 1) {
  clock += 10;
  mockScheduler.update(0.05);
}
assert.ok(summaryCount <= 2, 'low-frequency summaries must not publish every update');
const cancelled = mockScheduler.cancel();
assert.equal(cancelled.session.status, 'cancelled');

const recoveringPlan = parseAndPlanTextMotion('弯腰检查左前方的发动机。', { state: hub.getState() });
const recoveryScheduler = new MotionExecutionScheduler({
  adapter: new MockWholeBodyExecutionAdapter({ failureNodeId: 'step-1' }),
});
recoveryScheduler.prepare(recoveringPlan);
recoveryScheduler.start();
assert.equal(recoveryScheduler.update(0.1).session.status, 'recovering');
const recoveredFailure = recoveryScheduler.update(1);
assert.equal(recoveredFailure.session.status, 'failed');
assert.equal(recoveredFailure.session.recoveryState.status, 'completed');
assert.ok(recoveredFailure.session.warnings.includes('RECOVERY_COMPLETED'));

const missingAffordancePlan = parseAndPlanTextMotion('检查发动机。', { state: hub.getState() });
const preconditionScheduler = new MotionExecutionScheduler({ adapter: new MockWholeBodyExecutionAdapter() });
preconditionScheduler.prepare(missingAffordancePlan);
const preconditionFailure = preconditionScheduler.start();
assert.equal(preconditionFailure.session.status, 'recovering');
assert.equal(preconditionFailure.session.lastError.code, 'PRECONDITION_FAILED');

const goalRequest = parsed.plan.nodes[0].goalRequests[0];
const goalAdapter = createMotionGoalAdapter({
  goalFactory: (request) => ({ accepted: true, requestId: request.requestId, target: request.target }),
});
assert.equal(goalAdapter.createGoal(goalRequest).accepted, true);

const airbaseWorld = createWWIIAirbaseWorldContext();
const radioActor = createWWIIAirbaseActorContext('radio_operator');
const solverBlocked = executeTextMotion('通讯员走到无线电台旁，坐下并操作无线电。', {
  state: hub.getState(),
  actorContext: radioActor,
  worldContext: airbaseWorld,
});
assert.equal(solverBlocked.status, 'requires_solver');
assert.equal(solverBlocked.session.status, 'failed');
assert.equal(solverBlocked.session.lastError.code, 'REQUIRES_SOLVER');
assert.equal(solverBlocked.clip, null);

console.log('PASS execution prepare/start/update/pause/resume/cancel/complete, failure recovery, semantic goal injection, solver-blocked status, and explicit revision boundaries');
