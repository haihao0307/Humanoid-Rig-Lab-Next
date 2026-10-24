import { canAdvanceLifePhase } from './trajectory.mjs';

export const CARRY_SEQUENCE_REVISION = 'carry-sequence-r06';
export const CARRY_PHASES = Object.freeze([
  'approach', 'settle', 'reach', 'establish-contact', 'lift',
  'carry', 'align', 'lower', 'verify-support', 'release',
  'withdraw', 'recover-stance', 'complete'
]);

const TRANSITIONS = Object.freeze({
  approach: { next: 'settle', gates: ['routeReached', 'pathClear'] },
  settle: { next: 'reach', gates: ['stableSupport', 'jointLimitsValid', 'bodyClearanceValid'] },
  reach: { next: 'establish-contact', gates: ['stableSupport', 'jointLimitsValid', 'bodyClearanceValid'] },
  'establish-contact': { next: 'lift', gates: ['stableSupport', 'jointLimitsValid', 'bodyClearanceValid', 'contactValid'] },
  lift: { next: 'carry', gates: ['stableSupport', 'jointLimitsValid', 'bodyClearanceValid', 'contactValid', 'objectStateValid'] },
  carry: { next: 'align', gates: ['stableSupport', 'jointLimitsValid', 'bodyClearanceValid', 'contactValid', 'objectStateValid', 'routeReached'] },
  align: { next: 'lower', gates: ['stableSupport', 'jointLimitsValid', 'bodyClearanceValid', 'contactValid', 'objectStateValid'] },
  lower: { next: 'verify-support', gates: ['stableSupport', 'jointLimitsValid', 'bodyClearanceValid', 'contactValid'] },
  'verify-support': { next: 'release', gates: ['stableSupport', 'jointLimitsValid', 'bodyClearanceValid', 'objectStateValid', 'objectSettled', 'objectSupported'] },
  release: { next: 'withdraw', gates: ['stableSupport', 'jointLimitsValid', 'bodyClearanceValid', 'objectStateValid', 'gripReleased'] },
  withdraw: { next: 'recover-stance', gates: ['stableSupport', 'jointLimitsValid', 'bodyClearanceValid', 'bodyClearanceAfterWithdraw'] },
  'recover-stance': { next: 'complete', gates: ['stableSupport', 'jointLimitsValid', 'bodyClearanceValid', 'objectStateValid', 'objectSettled', 'objectSupported', 'handsClear'] }
});

export function createCarrySequence() {
  return { revision: CARRY_SEQUENCE_REVISION, phase: CARRY_PHASES[0], history: [], blocked: false };
}

/**
 * Advance exactly one semantic phase. Never infer success from elapsed time.
 * Evidence is collected by the live rig/physics/collision runtime.
 */
export function advanceCarrySequence(state, evidence) {
  if (!state || state.revision !== CARRY_SEQUENCE_REVISION || !CARRY_PHASES.includes(state.phase)) {
    return { ok: false, state, reason: 'invalid sequence state' };
  }
  if (state.blocked || state.phase === 'complete') return { ok: false, state, reason: 'sequence is blocked or complete' };
  const transition = TRANSITIONS[state.phase];
  if (!transition) return { ok: false, state, reason: 'phase has no transition' };
  const common = canAdvanceLifePhase(evidence);
  if (!common.ok) return { ok: false, state, reason: common.reason, failedGate: common.failedGate };
  for (const gate of transition.gates) {
    if (evidence[gate] !== true) return { ok: false, state, reason: 'missing required evidence: ' + gate, failedGate: gate };
  }
  const next = { ...state, phase: transition.next, history: [...state.history, { from: state.phase, to: transition.next }] };
  return { ok: true, state: next, reason: 'phase advanced with evidence' };
}
