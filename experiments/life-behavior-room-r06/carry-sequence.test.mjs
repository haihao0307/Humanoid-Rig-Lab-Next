import assert from 'node:assert/strict';
import { createCarrySequence, advanceCarrySequence, CARRY_PHASES } from './carry-sequence.mjs';

const good = {
  stableSupport: true, jointLimitsValid: true, bodyClearanceValid: true,
  contactValid: true, objectStateValid: true,
  routeReached: true, pathClear: true, objectSettled: true, objectSupported: true,
  gripReleased: true, bodyClearanceAfterWithdraw: true, handsClear: true
};
let state = createCarrySequence();
assert.equal(state.phase, 'approach');

const blocked = advanceCarrySequence(state, { ...good, stableSupport: false });
assert.equal(blocked.ok, false);
assert.equal(blocked.state, state, 'failed evidence must not mutate the committed state');

const noRoute = advanceCarrySequence(state, { ...good, routeReached: false });
assert.equal(noRoute.ok, false);
assert.equal(noRoute.failedGate, 'routeReached');

for (let i = 1; i < CARRY_PHASES.length; i++) {
  const result = advanceCarrySequence(state, good);
  assert.equal(result.ok, true, 'phase transition ' + state.phase);
  state = result.state;
  assert.equal(state.phase, CARRY_PHASES[i]);
}
assert.equal(state.phase, 'complete');
assert.equal(state.history.length, CARRY_PHASES.length - 1);
assert.equal(advanceCarrySequence(state, good).ok, false);

console.log(JSON.stringify({
  suite: 'life-behavior-room-r06-carry-sequence',
  phases: CARRY_PHASES,
  transitionsPassed: state.history.length,
  failedEvidenceDoesNotAdvance: true,
  elapsedTimeCannotAdvancePhase: true,
  livePhysicsIntegrated: false,
  browserVisualAcceptance: false
}));
