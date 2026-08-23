import { normalizeMotionIntent, stableHash, stableStringify } from '../../modules/animation/text-motion/intent.js';
import { createActorMotionContext, deriveMotionStyleFromActor, normalizeActorMotionContext } from './actor-motion-context.js';
import { createMotionSkillGraph } from './motion-skill-graph.js';
import { createDefaultMotionSkillRegistry } from '../skills/motion-skill-registry.js';
import { RelativeWorldContextAdapter } from '../world/world-context.js';

export const ACTION_PLAN_SCHEMA = 'humanoid_rig/action_plan@1.0';
export const MOTION_COORDINATE_SYSTEM = Object.freeze({
  handedness: 'right', upAxis: '+Y', forwardAxis: '+Z', rightAxis: '+X',
});

/** Compatibility API: returns the serializable ActionPlan while V3 exposes its Skill Graph alongside it. */
export function createActionPlan(intentInput, options = {}) {
  return planMotionIntent(intentInput, options).plan;
}

export function planMotionIntent(intentInput, {
  registry = createDefaultMotionSkillRegistry(),
  worldContext = new RelativeWorldContextAdapter(),
  actorContext = null,
  defaultSide = null,
} = {}) {
  const intent = normalizeMotionIntent(intentInput);
  const actor = normalizeActorMotionContext(actorContext || createActorMotionContext({
    actorId: intent.actorContextRef || 'actor_default',
    occupation: intent.occupationHint ? { id: intent.occupationHint, label: intent.occupationHint } : undefined,
  }));
  const style = deriveMotionStyleFromActor(actor);
  const warnings = [...intent.warnings];
  const missingSkills = [...intent.missingSkills];
  const unresolvedTargets = new Set();
  const missingAffordances = new Set();
  const requiredAffordances = new Set();
  const requiredCapabilities = new Set();
  const requiredChains = new Set();
  const legacyRequiredSkills = new Set();
  const semanticRequiredSkills = new Set();
  const requiresSolverCapabilities = new Set();
  const expanded = expandContextualActions(intent, actor);
  const nodes = [];
  const actionToNode = new Map();
  let estimatedDistance = 0;

  for (const action of expanded.actions) {
    const selection = resolveSkillForAction(action, registry);
    if (!selection) {
      const missing = action.skillId || action.verb || action.actionId;
      missingSkills.push(missing);
      warnings.push(`MISSING_SKILL:${missing}`);
      continue;
    }
    const { semanticSkill, legacySkill } = selection;
    const availability = checkSkillAvailability(actor, semanticSkill, legacySkill);
    if (!availability.available) {
      missingSkills.push(semanticSkill.skillId);
      warnings.push(`${availability.code}:${semanticSkill.skillId}`);
      continue;
    }
    const parameters = normalizeParameters(action, semanticSkill, actor, {
      defaultSide: defaultSide || actor.dominantSide,
      warnings,
    });
    const targetInfo = resolveActionTarget(parameters, actor, worldContext, unresolvedTargets, warnings);
    if (targetInfo.resolved) parameters.resolvedTarget = targetInfo.resolved;
    if (targetInfo.relative) parameters.relativeTarget = targetInfo.relative;
    if (targetInfo.path) {
      parameters.path = targetInfo.path;
      if (semanticSkill.category === 'locomotion') estimatedDistance += Number(targetInfo.path.distance || 0);
    } else if (semanticSkill.skillId === 'walk' || semanticSkill.skillId === 'walk_backward') {
      estimatedDistance += Number(parameters.distanceMeters || 0);
    }

    const affordance = targetInfo.resolved ? worldContext?.queryAffordances?.(targetInfo.resolved.objectId) : null;
    const preconditions = buildPreconditions(semanticSkill, parameters, affordance, requiredAffordances, missingAffordances);
    const duration = resolveDuration(parameters, semanticSkill, style);
    const nodeId = `step-${nodes.length + 1}`;
    const goalRequests = buildGoalRequests({ nodeId, skill: semanticSkill, parameters, actor, style, duration });
    const node = {
      nodeId,
      actionId: action.actionId,
      skillId: semanticSkill.skillId,
      legacySkillId: legacySkill.skillId,
      mode: semanticSkill.mode,
      parameters,
      dependencies: [],
      parallelGroup: null,
      preconditions,
      successConditions: structuredClone(semanticSkill.successConditions),
      failurePolicy: semanticSkill.failurePolicy,
      timeout: Number((duration * 1.8 + 0.5).toFixed(3)),
      layer: semanticSkill.layer,
      priority: semanticSkill.priority,
      requiredChains: structuredClone(semanticSkill.requiredChains),
      requiredCapabilities: structuredClone(semanticSkill.requiredCapabilities),
      goalRequests,
      requiresSolver: semanticSkill.requiresSolver,
      metadata: {
        source: action.actionId.startsWith('implicit-') ? 'occupation_context' : 'text',
        occupation: actor.occupation.id,
        targetType: action.targetType || null,
      },
      startTime: 0,
      duration,
    };
    nodes.push(node);
    actionToNode.set(action.actionId, node);
    legacyRequiredSkills.add(legacySkill.skillId);
    semanticRequiredSkills.add(semanticSkill.skillId);
    semanticSkill.requiredChains.forEach((chain) => requiredChains.add(chain));
    semanticSkill.requiredCapabilities.forEach((capability) => requiredCapabilities.add(capability));
    if (semanticSkill.requiresSolver) requiresSolverCapabilities.add(semanticSkill.skillId);
    semanticSkill.requiredCapabilities.forEach((capability) => requiresSolverCapabilities.add(capability));
  }

  const relations = normalizeRelations(expanded.sequenceRelations, actionToNode);
  for (const relation of relations) {
    const target = actionToNode.get(relation.afterActionId);
    const source = actionToNode.get(relation.beforeActionId);
    if (!target || !source) continue;
    target.dependencies = uniqueStrings([...target.dependencies, source.nodeId]);
  }
  const parallelGroups = mapParallelGroups(expanded.parallelRelations, actionToNode, relations);
  for (const group of parallelGroups) {
    for (const nodeId of group.nodeIds) {
      const node = nodes.find((item) => item.nodeId === nodeId);
      if (node) node.parallelGroup = group.groupId;
    }
  }
  scheduleNodes(nodes);

  const edges = nodes.flatMap((node) => node.dependencies.map((dependency) => ({
    edgeId: `edge-${dependency}-to-${node.nodeId}`,
    fromNodeId: dependency,
    toNodeId: node.nodeId,
    type: 'sequence',
    metadata: {},
  })));
  const estimatedDuration = nodes.length
    ? Number(Math.max(...nodes.map((node) => node.startTime + node.duration)).toFixed(3))
    : 0;
  const steps = nodes.map((node) => toLegacyStep(node));
  const planContent = {
    sourceIntentId: intent.intentId,
    actorContextRef: actor.actorId,
    nodes,
    edges,
    parallelGroups,
    estimatedDuration,
    estimatedDistance,
  };
  const plan = {
    schema: ACTION_PLAN_SCHEMA,
    planId: `action-plan-${stableHash(stableStringify(planContent))}`,
    sourceIntentId: intent.intentId,
    status: missingSkills.length ? 'unsupported' : nodes.length ? 'ready' : 'empty',
    coordinateSystem: structuredClone(MOTION_COORDINATE_SYSTEM),
    actorContextRef: actor.actorId,
    worldContextRef: String(worldContext?.id || 'relative-world'),
    styleHints: structuredClone(style),
    steps,
    nodes,
    edges,
    parallelGroups,
    requiredSkills: [...legacyRequiredSkills].sort(),
    semanticRequiredSkills: [...semanticRequiredSkills].sort(),
    requiredChains: [...requiredChains].sort(),
    requiredAffordances: [...requiredAffordances].sort(),
    requiredCapabilities: [...requiredCapabilities].sort(),
    preconditions: nodes.flatMap((node) => node.preconditions.map((condition) => ({ nodeId: node.nodeId, ...condition }))),
    successConditions: nodes.flatMap((node) => node.successConditions.map((condition) => ({ nodeId: node.nodeId, ...condition }))),
    failurePolicies: nodes.map((node) => ({ nodeId: node.nodeId, policy: node.failurePolicy })),
    estimatedDuration,
    estimatedDistance: Number(estimatedDistance.toFixed(3)),
    rootMotionPolicy: steps.some((step) => step.rootMotionPolicy === 'root_motion') ? 'root_motion' : 'in_place',
    contactPolicy: 'preserve',
    unresolvedTargets: [...unresolvedTargets].sort(),
    missingAffordances: [...missingAffordances].sort(),
    missingSkills: uniqueStrings(missingSkills),
    requiresSolverCapabilities: [...requiresSolverCapabilities].sort(),
    warnings: uniqueStrings([
      ...warnings,
      ...[...missingAffordances].map((item) => `MISSING_AFFORDANCE:${item}`),
      ...[...requiresSolverCapabilities].map((item) => `REQUIRES_SOLVER:${item}`),
    ]),
  };
  const skillGraph = createMotionSkillGraph({
    graphId: `skill-graph-${plan.planId.replace(/^action-plan-/, '')}`,
    planId: plan.planId,
    nodes: nodes.map((node) => ({
      ...node,
      dependencies: [...node.dependencies],
      status: 'pending',
    })),
    edges,
    parallelGroups,
    warnings: plan.warnings,
    metadata: { actorId: actor.actorId, occupation: actor.occupation.id, sourceIntentId: intent.intentId },
  });
  plan.skillGraphId = skillGraph.graphId;
  return { intent, actorContext: actor, style, plan, skillGraph };
}

export function validateActionPlan(input) {
  const plan = input && typeof input === 'object' ? input : {};
  const errors = [];
  if (plan.schema !== ACTION_PLAN_SCHEMA) errors.push('ACTION_PLAN_SCHEMA_INVALID');
  if (!plan.planId) errors.push('ACTION_PLAN_ID_MISSING');
  if (!plan.coordinateSystem || plan.coordinateSystem.forwardAxis !== '+Z') errors.push('ACTION_PLAN_COORDINATE_SYSTEM_INVALID');
  if (!Array.isArray(plan.steps)) errors.push('ACTION_PLAN_STEPS_INVALID');
  if (!Array.isArray(plan.nodes)) errors.push('ACTION_PLAN_NODES_INVALID');
  for (const step of plan.steps || []) {
    if (!step.stepId || !step.skillId) errors.push('ACTION_PLAN_STEP_ID_OR_SKILL_MISSING');
    if (!Number.isFinite(Number(step.duration)) || Number(step.duration) <= 0) errors.push(`ACTION_PLAN_STEP_DURATION_INVALID:${step.stepId}`);
    if (!Array.isArray(step.requiredChains)) errors.push(`ACTION_PLAN_STEP_CHAINS_INVALID:${step.stepId}`);
  }
  for (const node of plan.nodes || []) {
    if (!node.nodeId || !node.skillId) errors.push('ACTION_PLAN_NODE_ID_OR_SKILL_MISSING');
    if (containsForbiddenKinematicData(node)) errors.push(`ACTION_PLAN_NODE_FORBIDDEN_KINEMATIC_DATA:${node.nodeId}`);
  }
  return { valid: errors.length === 0, errors: uniqueStrings(errors), warnings: uniqueStrings(plan.warnings) };
}

function expandContextualActions(intent, actor) {
  const actions = intent.actions.map((action) => structuredClone(action));
  const inspection = actions.find((action) => action.skillId === 'inspect');
  if (!inspection || !inspection.target || !['aircraft', 'aircraft_engine'].includes(inspection.targetType || inferTargetType(inspection.target))) {
    return { actions, sequenceRelations: intent.sequenceRelations, parallelRelations: intent.parallelRelations };
  }
  const target = inspection.target;
  const targetType = inspection.targetType || inferTargetType(target);
  const walk = actions.find((action) => action.skillId === 'walk' || action.skillId === 'walk_backward');
  const bend = actions.find((action) => action.skillId === 'bend');
  let count = 0;
  const implicit = (skillId, fields = {}) => ({
    actionId: `implicit-${skillId}-${++count}`,
    verb: skillId,
    skillId,
    direction: null,
    side: null,
    target,
    targetType,
    distanceMeters: null,
    stepCount: null,
    durationSeconds: null,
    speed: null,
    angleDegrees: null,
    repeatCount: null,
    modifiers: [], warnings: [],
    ...fields,
  });
  let expanded;
  if (actor.occupation.id === 'aircraft_mechanic') {
    expanded = [walk || implicit('walk'), implicit('turn_to'), implicit('look_at'), bend || implicit('bend'), implicit('reach'), inspection, implicit('recover')];
  } else if (actor.occupation.id === 'pilot') {
    expanded = [walk || implicit('walk'), implicit('look_at'), inspection, implicit('inspect', { target: 'cockpit', targetType: 'cockpit' })];
    expanded = dedupeActions(expanded);
  } else if (actor.occupation.id === 'commander') {
    expanded = [walk || implicit('stand'), implicit('look_at'), implicit('point')];
  } else if (actor.occupation.id === 'guard') {
    expanded = [walk || implicit('walk'), implicit('look_at'), implicit('guard')];
  } else {
    return { actions, sequenceRelations: intent.sequenceRelations, parallelRelations: intent.parallelRelations };
  }
  return {
    actions: expanded,
    sequenceRelations: expanded.slice(1).map((action, index) => ({ beforeActionId: expanded[index].actionId, afterActionId: action.actionId })),
    parallelRelations: [],
  };
}

function dedupeActions(actions) {
  const seen = new Set();
  return actions.filter((action) => {
    const key = `${action.actionId}:${action.skillId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveSkillForAction(action, registry) {
  // Prefer an exact legacy ID before consulting aliases. This keeps an input
  // "look" semantic until the planner can select look_left/look_right/look_at.
  const base = registry.get(action.skillId) || registry.resolve(action.skillId) || registry.resolve(action.verb);
  if (!base) return null;
  let canonicalId = base.skillId;
  if (canonicalId === 'turn') canonicalId = action.target ? 'turn_to' : action.side === 'left' || action.direction === 'left' ? 'turn_left' : action.side === 'right' || action.direction === 'right' ? 'turn_right' : 'turn_to';
  if (canonicalId === 'look') canonicalId = action.target ? 'look_at' : action.direction === 'left' ? 'look_left' : action.direction === 'right' ? 'look_right' : 'look_at';
  if (canonicalId === 'walk' && action.direction === 'backward') canonicalId = 'walk_backward';
  if (canonicalId === 'walk' && action.direction === 'left') canonicalId = 'sidestep_left';
  if (canonicalId === 'walk' && action.direction === 'right') canonicalId = 'sidestep_right';
  if (['salute', 'point', 'reach', 'wave'].includes(canonicalId) && ['left', 'right'].includes(action.side)) canonicalId = `${canonicalId}_${action.side}`;
  const semanticSkill = registry.get(canonicalId) || base;
  const legacySkill = registry.get(semanticSkill.legacySkillId || semanticSkill.skillId) || semanticSkill;
  return { semanticSkill, legacySkill };
}

function checkSkillAvailability(actor, semanticSkill, legacySkill) {
  const candidates = [semanticSkill.skillId, legacySkill.skillId].filter(Boolean);
  const disabled = new Set((actor.disabledSkills || []).map(String));
  if (candidates.some((skillId) => disabled.has(skillId))) return { available: false, code: 'DISABLED_SKILL' };
  const available = new Set((actor.availableSkills || []).map(String));
  if (available.size && !candidates.some((skillId) => available.has(skillId))) return { available: false, code: 'UNAVAILABLE_SKILL' };
  return { available: true, code: null };
}

function normalizeParameters(action, skill, actor, { defaultSide, warnings }) {
  const parameters = {
    direction: action.direction || null,
    side: action.side || null,
    target: action.target || null,
    targetType: action.targetType || null,
    distanceMeters: finiteOrNull(action.distanceMeters),
    stepCount: positiveIntegerOrNull(action.stepCount),
    durationSeconds: positiveOrNull(action.durationSeconds),
    speed: action.speed || 'normal',
    angleDegrees: finiteOrNull(action.angleDegrees),
    repeatCount: positiveIntegerOrNull(action.repeatCount) || 1,
    modifiers: [...(action.modifiers || [])],
    provenance: {},
  };
  if (['walk', 'walk_backward', 'patrol'].includes(skill.skillId) && !parameters.direction) {
    parameters.direction = skill.skillId === 'walk_backward' ? 'backward' : 'forward';
    parameters.provenance.direction = { source: 'system_default', confidence: 0.55 };
    warnings.push('DEFAULT_DIRECTION_APPLIED');
  }
  if (['walk', 'walk_backward', 'patrol'].includes(skill.skillId) && !parameters.distanceMeters && !parameters.stepCount) {
    parameters.distanceMeters = skill.skillId === 'patrol' ? 1.44 : 0.72;
    parameters.provenance.distanceMeters = { source: 'system_default', confidence: 0.5 };
    warnings.push('DEFAULT_DISTANCE_APPLIED');
  }
  if (['walk', 'walk_backward', 'patrol'].includes(skill.skillId) && !parameters.distanceMeters && parameters.stepCount) {
    parameters.distanceMeters = Number((parameters.stepCount * 0.36).toFixed(3));
    parameters.provenance.distanceMeters = { source: 'derived_from_steps', confidence: 0.92 };
    warnings.push('STEP_DISTANCE_INFERRED');
  }
  if (['wave', 'salute', 'reach', 'point'].some((value) => skill.skillId === value || skill.skillId.startsWith(`${value}_`)) && !parameters.side) {
    parameters.side = defaultSide || actor.dominantSide;
    parameters.provenance.side = { source: 'actor_context', confidence: 0.75 };
    warnings.push('DEFAULT_SIDE_APPLIED');
  }
  if (parameters.direction && !parameters.provenance.direction) parameters.provenance.direction = { source: 'explicit_text', confidence: 1 };
  if (parameters.side && !parameters.provenance.side) parameters.provenance.side = { source: 'explicit_text', confidence: 1 };
  return parameters;
}

function resolveActionTarget(parameters, actor, worldContext, unresolvedTargets, warnings) {
  if (!parameters.target) return { resolved: null, relative: null, path: null };
  const resolved = worldContext?.resolveTarget?.(parameters.target, actor) || null;
  if (!resolved) {
    unresolvedTargets.add(parameters.target);
    warnings.push(`UNRESOLVED_TARGET:${parameters.target}`);
    const relative = worldContext?.resolveSpatialRelation?.({ targetName: parameters.target, distanceMeters: parameters.distanceMeters }, parameters.direction || 'forward', actor) || null;
    return { resolved: null, relative, path: null };
  }
  const path = worldContext?.getPathToTarget?.(actor.actorId, resolved.objectId, actor) || null;
  return { resolved, relative: null, path };
}

function buildPreconditions(skill, parameters, affordance, requiredAffordances, missingAffordances) {
  const conditions = structuredClone(skill.preconditions || []);
  if (parameters.target) conditions.push({ type: 'target_resolved_or_relative', target: parameters.target });
  for (const requirement of skill.requiredAffordances || []) {
    requiredAffordances.add(requirement);
    const points = affordance?.[requirement];
    if (!Array.isArray(points) || !points.length) missingAffordances.add(requirement);
    conditions.push({ type: 'affordance', affordance: requirement, available: Boolean(Array.isArray(points) && points.length) });
  }
  if (skill.skillId === 'sit') conditions.push({ type: 'posture', value: 'standing' });
  if (skill.skillId === 'grasp') conditions.push({ type: 'hand_available' });
  return conditions;
}

function resolveDuration(parameters, skill, style) {
  const requested = Number(parameters.durationSeconds);
  let duration = Number.isFinite(requested) && requested > 0 ? requested : skill.defaultDuration;
  if (['walk', 'walk_backward', 'patrol'].includes(skill.skillId)) {
    const steps = parameters.stepCount || Math.max(1, Math.round((parameters.distanceMeters || 0.72) / 0.36));
    duration = Number.isFinite(requested) && requested > 0 ? requested : steps * 0.6;
  }
  if (parameters.speed === 'slow') duration *= 1.35;
  if (parameters.speed === 'fast') duration *= 0.7;
  duration /= Math.max(0.55, Number(style.speedScale || 1));
  duration *= Math.max(1, Number(parameters.repeatCount || 1));
  return Number(Math.max(0.05, duration).toFixed(3));
}

function buildGoalRequests({ nodeId, skill, parameters, actor, style, duration }) {
  const goalType = skill.category === 'locomotion' ? 'locomotion'
    : skill.category === 'gaze' ? 'gaze'
      : ['reach', 'reach_left', 'reach_right', 'point', 'point_left', 'point_right', 'grasp', 'release'].includes(skill.skillId) ? 'end_effector'
        : skill.category === 'posture' ? 'posture' : skill.category === 'interaction' ? 'interaction' : 'task';
  const side = parameters.side === 'left' ? 'left' : 'right';
  const target = parameters.resolvedTarget
    ? { type: 'world_object', objectId: parameters.resolvedTarget.objectId, objectType: parameters.resolvedTarget.objectType }
    : parameters.relativeTarget
      ? { type: 'world_point', position: [...parameters.relativeTarget.position], relation: parameters.relativeTarget.relation }
      : parameters.target
        ? { type: 'unresolved_target', name: parameters.target, objectType: parameters.targetType || 'generic' }
        : { type: 'relative_direction', direction: parameters.direction || 'forward', distanceMeters: parameters.distanceMeters ?? null };
  return [{
    requestId: `goal-request-${nodeId}`,
    goalType,
    jointRole: goalType === 'end_effector' ? `${side}_hand` : null,
    target,
    constraints: {
      maintainFootContacts: skill.contactPolicy === 'preserve',
      maintainBalance: true,
      dominantSide: actor.dominantSide,
      requiredAffordances: [...(skill.requiredAffordances || [])],
    },
    timing: { duration },
    style: {
      tempo: style.tempo, precision: style.precision, amplitude: style.amplitude,
      alertness: style.alertness, postureBias: style.postureBias,
    },
    priority: skill.priority,
    metadata: { skillId: skill.skillId, actorId: actor.actorId },
  }];
}

function normalizeRelations(relations, actionToNode) {
  const seen = new Set();
  return (Array.isArray(relations) ? relations : []).map((relation) => ({
    beforeActionId: String(relation?.beforeActionId || relation?.before_action_id || ''),
    afterActionId: String(relation?.afterActionId || relation?.after_action_id || ''),
  })).filter((relation) => {
    const key = `${relation.beforeActionId}>${relation.afterActionId}`;
    return actionToNode.has(relation.beforeActionId) && actionToNode.has(relation.afterActionId)
      && relation.beforeActionId !== relation.afterActionId && !seen.has(key) && (seen.add(key) || true);
  });
}

function mapParallelGroups(groups, actionToNode, relations) {
  const sourceRelations = new Set(relations.map((relation) => `${relation.beforeActionId}>${relation.afterActionId}`));
  return (Array.isArray(groups) ? groups : []).map((group, index) => {
    let actionIds = uniqueStrings(group?.actionIds || group?.action_ids).filter((id) => actionToNode.has(id));
    actionIds = actionIds.filter((actionId) => !actionIds.some((otherId) => sourceRelations.has(`${actionId}>${otherId}`)));
    const nodeIds = actionIds.map((actionId) => actionToNode.get(actionId).nodeId);
    return { groupId: String(group?.groupId || group?.group_id || `parallel-${index + 1}`), actionIds, nodeIds };
  }).filter((group) => group.nodeIds.length > 1);
}

function scheduleNodes(nodes) {
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  for (let pass = 0; pass <= nodes.length; pass += 1) {
    for (const node of nodes) {
      const start = Math.max(0, ...node.dependencies.map((dependency) => {
        const source = byId.get(dependency);
        return source ? source.startTime + source.duration : 0;
      }));
      node.startTime = Math.max(node.startTime, Number(start.toFixed(3)));
    }
  }
}

function toLegacyStep(node) {
  const mode = node.legacySkillId === 'walk' || node.legacySkillId === 'walk_backward' || ['idle', 'wave', 'salute', 'squat', 'crouch'].includes(node.legacySkillId)
    ? 'clip'
    : ['turn', 'look', 'reach', 'point', 'bend', 'inspect', 'sit', 'stand_up', 'stop'].includes(node.legacySkillId)
      ? 'procedural_pose'
      : 'composite';
  return {
    stepId: node.nodeId,
    actionId: node.actionId,
    skillId: node.legacySkillId,
    semanticSkillId: node.skillId,
    mode,
    parameters: structuredClone(node.parameters),
    startAfter: [...node.dependencies],
    startTime: node.startTime,
    duration: node.duration,
    blendIn: Math.min(0.12, Number((node.duration * 0.15).toFixed(3))),
    blendOut: Math.min(0.12, Number((node.duration * 0.15).toFixed(3))),
    layer: node.layer,
    requiredChains: structuredClone(node.requiredChains || []),
    rootMotionPolicy: ['walk', 'walk_backward'].includes(node.legacySkillId) ? 'root_motion' : 'in_place',
    requiresSolver: node.requiresSolver,
  };
}

function inferTargetType(target) {
  const value = String(target || '').toLowerCase();
  if (/发动机|engine/.test(value)) return 'aircraft_engine';
  if (/飞机|aircraft|airframe/.test(value)) return 'aircraft';
  return 'generic';
}

function containsForbiddenKinematicData(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsForbiddenKinematicData);
  return Object.entries(value).some(([key, child]) => /quaternion|matrix|vertex|bindoffset|bone(scale|length)|skin/i.test(key) || containsForbiddenKinematicData(child));
}

function finiteOrNull(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function positiveOrNull(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null; }
function positiveIntegerOrNull(value) { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : null; }
function uniqueStrings(values) { return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))]; }
