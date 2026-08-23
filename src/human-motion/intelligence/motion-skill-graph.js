export const MOTION_SKILL_GRAPH_SCHEMA = 'humanoid_rig/motion_skill_graph@1.0';

const NODE_STATUSES = new Set(['pending', 'running', 'completed', 'failed', 'cancelled', 'skipped']);

export function createMotionSkillGraph(input = {}) {
  return normalizeMotionSkillGraph({
    schema: MOTION_SKILL_GRAPH_SCHEMA,
    graphId: 'motion-skill-graph',
    planId: null,
    status: 'pending',
    nodes: [],
    edges: [],
    parallelGroups: [],
    warnings: [],
    metadata: {},
    ...cloneObject(input),
  });
}

export function normalizeMotionSkillGraph(input = {}) {
  const source = cloneObject(input);
  const nodes = (Array.isArray(source.nodes) ? source.nodes : []).map(normalizeNode);
  const ids = new Set(nodes.map((node) => node.nodeId));
  const edges = normalizeEdges(source.edges, nodes, ids);
  const dependencies = new Map(nodes.map((node) => [node.nodeId, new Set(node.dependencies)]));
  for (const edge of edges) dependencies.get(edge.toNodeId)?.add(edge.fromNodeId);
  for (const node of nodes) node.dependencies = [...(dependencies.get(node.nodeId) || [])].sort();
  const parallelGroups = normalizeParallelGroups(source.parallelGroups ?? source.parallel_groups, ids);
  const status = ['pending', 'running', 'completed', 'failed', 'cancelled'].includes(source.status)
    ? source.status
    : inferGraphStatus(nodes);
  return {
    ...source,
    schema: MOTION_SKILL_GRAPH_SCHEMA,
    graphId: text(source.graphId ?? source.graph_id, 'motion-skill-graph'),
    planId: source.planId == null && source.plan_id == null ? null : String(source.planId ?? source.plan_id),
    status,
    nodes,
    edges,
    parallelGroups,
    warnings: uniqueStrings(source.warnings),
    metadata: cloneObject(source.metadata),
  };
}

export function validateMotionSkillGraph(input) {
  const graph = normalizeMotionSkillGraph(input);
  const errors = [];
  if (graph.schema !== MOTION_SKILL_GRAPH_SCHEMA) errors.push('MOTION_SKILL_GRAPH_SCHEMA_INVALID');
  if (!graph.graphId) errors.push('MOTION_SKILL_GRAPH_ID_MISSING');
  const ids = new Set();
  for (const node of graph.nodes) {
    if (!node.nodeId || ids.has(node.nodeId)) errors.push(`MOTION_SKILL_GRAPH_NODE_ID_INVALID:${node.nodeId || 'empty'}`);
    ids.add(node.nodeId);
    if (!node.skillId) errors.push(`MOTION_SKILL_GRAPH_SKILL_MISSING:${node.nodeId}`);
    if (!NODE_STATUSES.has(node.status)) errors.push(`MOTION_SKILL_GRAPH_NODE_STATUS_INVALID:${node.nodeId}`);
    for (const dependency of node.dependencies) if (!ids.has(dependency) && !graph.nodes.some((item) => item.nodeId === dependency)) errors.push(`MOTION_SKILL_GRAPH_DEPENDENCY_MISSING:${node.nodeId}:${dependency}`);
  }
  for (const edge of graph.edges) {
    if (!graph.nodes.some((node) => node.nodeId === edge.fromNodeId)) errors.push(`MOTION_SKILL_GRAPH_EDGE_SOURCE_MISSING:${edge.edgeId}`);
    if (!graph.nodes.some((node) => node.nodeId === edge.toNodeId)) errors.push(`MOTION_SKILL_GRAPH_EDGE_TARGET_MISSING:${edge.edgeId}`);
  }
  if (topologicalSortSkillGraph(graph).length !== graph.nodes.length) errors.push('MOTION_SKILL_GRAPH_CYCLE');
  return { valid: errors.length === 0, errors, graph };
}

/** Returns stable node IDs in execution order; an empty result signals a cycle. */
export function topologicalSortSkillGraph(input) {
  const graph = normalizeMotionSkillGraph(input);
  const indegree = new Map(graph.nodes.map((node) => [node.nodeId, 0]));
  const outgoing = new Map(graph.nodes.map((node) => [node.nodeId, []]));
  for (const edge of graph.edges) {
    if (!indegree.has(edge.fromNodeId) || !indegree.has(edge.toNodeId)) continue;
    indegree.set(edge.toNodeId, indegree.get(edge.toNodeId) + 1);
    outgoing.get(edge.fromNodeId).push(edge.toNodeId);
  }
  for (const node of graph.nodes) {
    for (const dependency of node.dependencies) {
      if (graph.edges.some((edge) => edge.fromNodeId === dependency && edge.toNodeId === node.nodeId)) continue;
      if (!indegree.has(dependency)) continue;
      indegree.set(node.nodeId, indegree.get(node.nodeId) + 1);
      outgoing.get(dependency).push(node.nodeId);
    }
  }
  const ready = [...graph.nodes].filter((node) => indegree.get(node.nodeId) === 0).map((node) => node.nodeId).sort();
  const result = [];
  while (ready.length) {
    const nodeId = ready.shift();
    result.push(nodeId);
    for (const targetId of outgoing.get(nodeId) || []) {
      indegree.set(targetId, indegree.get(targetId) - 1);
      if (indegree.get(targetId) === 0) ready.push(targetId);
    }
    ready.sort();
  }
  return result.length === graph.nodes.length ? result : [];
}

export function getReadySkillNodes(input) {
  const graph = normalizeMotionSkillGraph(input);
  const byId = new Map(graph.nodes.map((node) => [node.nodeId, node]));
  return graph.nodes.filter((node) => node.status === 'pending' && node.dependencies.every((dependency) => {
    const source = byId.get(dependency);
    return source?.status === 'completed' || source?.status === 'skipped';
  })).map(clone);
}

export function markSkillNodeRunning(input, nodeId) { return markNode(input, nodeId, 'running'); }
export function markSkillNodeCompleted(input, nodeId) { return markNode(input, nodeId, 'completed'); }
export function markSkillNodeSkipped(input, nodeId, reason = null) {
  const graph = markNode(input, nodeId, 'skipped');
  const node = graph.nodes.find((item) => item.nodeId === String(nodeId));
  if (node && reason != null) node.skipReason = String(reason);
  return graph;
}
export function markSkillNodeFailed(input, nodeId, error = null) {
  const graph = markNode(input, nodeId, 'failed');
  const node = graph.nodes.find((item) => item.nodeId === String(nodeId));
  if (node && error != null) node.lastError = String(error?.message || error);
  graph.status = 'failed';
  return graph;
}

export function cancelSkillGraph(input, reason = 'cancelled') {
  const graph = normalizeMotionSkillGraph(input);
  graph.status = 'cancelled';
  graph.nodes = graph.nodes.map((node) => (
    ['pending', 'running'].includes(node.status) ? { ...node, status: 'cancelled', cancellationReason: String(reason) } : node
  ));
  return graph;
}

export function serializeSkillGraph(input) {
  return structuredClone(normalizeMotionSkillGraph(input));
}

function markNode(input, nodeId, status) {
  const graph = normalizeMotionSkillGraph(input);
  const target = graph.nodes.find((node) => node.nodeId === String(nodeId));
  if (!target) throw new Error(`Motion skill graph node is missing: ${String(nodeId)}`);
  target.status = status;
  graph.status = inferGraphStatus(graph.nodes);
  return graph;
}

function normalizeNode(input, index) {
  const source = cloneObject(input);
  return {
    ...source,
    nodeId: text(source.nodeId ?? source.node_id, `node-${index + 1}`),
    skillId: text(source.skillId ?? source.skill_id, 'idle'),
    status: NODE_STATUSES.has(source.status) ? source.status : 'pending',
    dependencies: uniqueStrings(source.dependencies ?? source.startAfter ?? source.start_after),
    parallelGroup: source.parallelGroup == null && source.parallel_group == null ? null : String(source.parallelGroup ?? source.parallel_group),
    conditions: cloneArray(source.conditions),
    timeout: nullablePositive(source.timeout),
    priority: Number.isFinite(Number(source.priority)) ? Number(source.priority) : 0,
    layer: String(source.layer || 'base'),
    metadata: cloneObject(source.metadata),
  };
}

function normalizeEdges(input, nodes, ids) {
  const seen = new Set();
  const result = (Array.isArray(input) ? input : []).map((value, index) => {
    const source = cloneObject(value);
    return {
      edgeId: text(source.edgeId ?? source.edge_id, `edge-${index + 1}`),
      fromNodeId: text(source.fromNodeId ?? source.from_node_id ?? source.from, ''),
      toNodeId: text(source.toNodeId ?? source.to_node_id ?? source.to, ''),
      type: String(source.type || 'sequence'),
      metadata: cloneObject(source.metadata),
    };
  }).filter((edge) => edge.fromNodeId && edge.toNodeId && edge.fromNodeId !== edge.toNodeId && ids.has(edge.fromNodeId) && ids.has(edge.toNodeId));
  for (const node of nodes) {
    for (const dependency of node.dependencies) result.push({ edgeId: `edge-${dependency}-to-${node.nodeId}`, fromNodeId: dependency, toNodeId: node.nodeId, type: 'sequence', metadata: {} });
  }
  return result.filter((edge) => {
    const key = `${edge.fromNodeId}>${edge.toNodeId}:${edge.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeParallelGroups(input, ids) {
  const seen = new Set();
  return (Array.isArray(input) ? input : []).map((value, index) => {
    const source = cloneObject(value);
    const nodeIds = uniqueStrings(source.nodeIds ?? source.node_ids ?? source.actionIds ?? source.action_ids).filter((id) => ids.has(id));
    return { groupId: text(source.groupId ?? source.group_id, `parallel-${index + 1}`), nodeIds, actionIds: [...nodeIds] };
  }).filter((group) => group.nodeIds.length > 1 && !seen.has(group.groupId) && (seen.add(group.groupId) || true));
}

function inferGraphStatus(nodes) {
  if (nodes.some((node) => node.status === 'failed')) return 'failed';
  if (nodes.length && nodes.every((node) => ['completed', 'skipped'].includes(node.status))) return 'completed';
  if (nodes.some((node) => node.status === 'running')) return 'running';
  if (nodes.length && nodes.every((node) => node.status === 'cancelled')) return 'cancelled';
  return 'pending';
}

function uniqueStrings(values) { return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))]; }
function nullablePositive(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null; }
function text(value, fallback) { const result = String(value ?? '').trim(); return result || fallback; }
function cloneObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {}; }
function cloneArray(value) { return Array.isArray(value) ? structuredClone(value) : []; }
function clone(value) { return value === undefined ? undefined : structuredClone(value); }
