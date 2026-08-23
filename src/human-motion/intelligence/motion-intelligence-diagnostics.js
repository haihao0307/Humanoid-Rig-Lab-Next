/** Returns compact, serializable diagnostics without copying per-frame solver data. */
export function createMotionIntelligenceDiagnostics({
  intent = null,
  actorContext = null,
  plan = null,
  skillGraph = null,
  executionSession = null,
} = {}) {
  const nodes = Array.isArray(plan?.nodes) ? plan.nodes : [];
  const graphNodes = Array.isArray(skillGraph?.nodes) ? skillGraph.nodes : nodes;
  return {
    sourceText: String(intent?.sourceText || ''),
    language: String(intent?.language || 'unknown'),
    actorId: actorContext?.actorId || plan?.actorContextRef || executionSession?.actorId || null,
    occupation: actorContext?.occupation?.id || intent?.occupationHint || null,
    parsedActionCount: Array.isArray(intent?.actions) ? intent.actions.length : 0,
    unresolvedTokenCount: Array.isArray(intent?.unresolvedTokens) ? intent.unresolvedTokens.length : 0,
    unresolvedTargetCount: Array.isArray(plan?.unresolvedTargets) ? plan.unresolvedTargets.length : 0,
    planNodeCount: nodes.length,
    planEdgeCount: Array.isArray(plan?.edges) ? plan.edges.length : 0,
    parallelGroupCount: Array.isArray(plan?.parallelGroups) ? plan.parallelGroups.length : 0,
    requiredSkillCount: Array.isArray(plan?.semanticRequiredSkills) ? plan.semanticRequiredSkills.length : (Array.isArray(plan?.requiredSkills) ? plan.requiredSkills.length : 0),
    missingSkillCount: Array.isArray(plan?.missingSkills) ? plan.missingSkills.length : 0,
    requiredAffordanceCount: Array.isArray(plan?.requiredAffordances) ? plan.requiredAffordances.length : 0,
    missingAffordanceCount: Array.isArray(plan?.missingAffordances) ? plan.missingAffordances.length : 0,
    estimatedDuration: finite(plan?.estimatedDuration, 0),
    estimatedDistance: finite(plan?.estimatedDistance, 0),
    executionStatus: executionDisplayStatus(executionSession),
    currentNodeId: executionSession?.currentNodeId || null,
    completedNodeCount: Array.isArray(executionSession?.completedNodeIds) ? executionSession.completedNodeIds.length : graphNodes.filter((node) => node.status === 'completed').length,
    failedNodeCount: Array.isArray(executionSession?.failedNodeIds) ? executionSession.failedNodeIds.length : graphNodes.filter((node) => node.status === 'failed').length,
    progress: finite(executionSession?.progress, 0),
    warningCodes: uniqueStrings([...(intent?.warnings || []), ...(plan?.warnings || []), ...(executionSession?.warnings || [])]),
  };
}

export function executionDisplayStatus(session) {
  if (session?.lastError?.code === 'REQUIRES_SOLVER') return 'requires_solver';
  return String(session?.status || 'idle');
}

function finite(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function uniqueStrings(values) { return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))]; }
