import {
  beginGraphTransition,
  computeTransportTime,
  finishGraphTransition,
  normalizeAnimationState,
  setGraphParameter,
  setTransport,
} from './model.js';

export function evaluateAnimationGraph(animationInput, {
  nowMs = Date.now(),
  consumeTriggers = true,
} = {}) {
  let animation = normalizeAnimationState(animationInput);
  const graph = animation.graph;
  const activeState = graph.states.find((state) => state.stateId === graph.activeStateId) || graph.states[0] || null;
  const result = {
    animation,
    activeState,
    changed: false,
    startedTransition: null,
    completedTransition: null,
    consumedTriggers: [],
  };
  if (!activeState) return result;
  if (graph.controlMode !== 'graph') return result;

  if (graph.transition) {
    const elapsed = Math.max(0, Number(nowMs) - graph.transition.startedAt) / 1000;
    const progress = graph.transition.duration <= 0 ? 1 : elapsed / graph.transition.duration;
    if (progress >= 1) {
      const completed = structuredClone(graph.transition);
      const targetState = graph.states.find((state) => state.stateId === completed.toStateId);
      const targetTime = completed.toTime + elapsed * (targetState?.speed || 1);
      result.completedTransition = completed;
      animation = finishGraphTransition(animation);
      animation = setTransport(animation, {
        time: targetTime,
        anchorTime: targetTime,
        anchorRawTime: targetTime,
        anchorIssuedAt: animation.transport.playing ? nowMs : 0,
      }, nowMs);
      result.animation = animation;
      result.activeState = animation.graph.states.find((state) => state.stateId === animation.graph.activeStateId) || activeState;
      result.changed = true;
    }
    return result;
  }

  const clip = animation.clips.find((item) => item.clipId === activeState.clipId);
  const normalizedTime = clip?.duration ? computeTransportTime(animation, nowMs) / clip.duration : 0;
  const candidates = graph.transitions
    .filter((transition) => transition.fromStateId === '*' || transition.fromStateId === activeState.stateId)
    .filter((transition) => transition.toStateId !== activeState.stateId)
    .filter((transition) => transition.exitTime == null || normalizedTime + 1e-6 >= transition.exitTime)
    .filter((transition) => transition.conditions.every((condition) => evaluateCondition(graph.parameters, condition)))
    .sort((a, b) => b.priority - a.priority || a.transitionId.localeCompare(b.transitionId));
  const candidate = candidates[0];
  if (!candidate) return result;

  animation = beginGraphTransition(animation, candidate.toStateId, {
    duration: candidate.duration,
    nowMs,
    fromTime: computeTransportTime(animation, nowMs),
    toTime: 0,
  });
  animation = setTransport(animation, {
    time: 0,
    anchorTime: 0,
    anchorRawTime: 0,
    anchorIssuedAt: animation.transport.playing ? nowMs : 0,
  }, nowMs);
  result.animation = animation;
  result.activeState = animation.graph.states.find((state) => state.stateId === animation.graph.activeStateId) || activeState;
  result.startedTransition = structuredClone(animation.graph.transition);
  result.changed = true;

  if (consumeTriggers) {
    for (const condition of candidate.conditions) {
      if (condition.operator !== 'trigger') continue;
      animation = setGraphParameter(animation, condition.parameter, false);
      result.consumedTriggers.push(condition.parameter);
    }
    result.animation = animation;
  }
  return result;
}

export function evaluateCondition(parameters, condition) {
  const actual = parameters?.[condition.parameter];
  const expected = condition.value;
  switch (condition.operator) {
    case '>': return Number(actual) > Number(expected);
    case '>=': return Number(actual) >= Number(expected);
    case '<': return Number(actual) < Number(expected);
    case '<=': return Number(actual) <= Number(expected);
    case '!=': return actual !== expected;
    case 'truthy': return Boolean(actual);
    case 'falsy': return !actual;
    case 'trigger': return Boolean(actual);
    case '==':
    default: return actual === expected;
  }
}

export function graphTransitionProgress(animationInput, nowMs = Date.now()) {
  const animation = normalizeAnimationState(animationInput);
  const transition = animation.graph.transition;
  if (!transition) return 1;
  if (transition.duration <= 0) return 1;
  return Math.min(1, Math.max(0, (Number(nowMs) - transition.startedAt) / (transition.duration * 1000)));
}
