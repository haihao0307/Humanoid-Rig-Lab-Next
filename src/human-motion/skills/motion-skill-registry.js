const SKILL_MODES = new Set(['goal', 'clip', 'composite', 'condition', 'wait', 'procedural_pose', 'procedural_motion']);
const ROOT_MOTION_POLICIES = new Set(['in_place', 'root_motion']);
const CONTACT_POLICIES = new Set(['preserve', 'ignore', 'generate']);

export const DEFAULT_MOTION_SKILLS = Object.freeze([
  skill('idle', { aliases: ['idle', 'stand still', '待机'], mode: 'clip', category: 'posture', sourceClipId: 'idle-breathe', legacyCompiler: 'clip:idle-breathe', legacySkillId: 'idle', requiredChains: ['spine'], defaultDuration: 3.2, layer: 'base' }),
  skill('stand', { aliases: ['stand', '站立'], mode: 'clip', category: 'posture', sourceClipId: 'idle-breathe', legacyCompiler: 'clip:idle-breathe', legacySkillId: 'idle', requiredChains: ['spine'], defaultDuration: 0.6, layer: 'base' }),
  skill('stop', { aliases: ['stop', '停下', '停止', '停住'], mode: 'clip', category: 'posture', legacyCompiler: 'pose:stop', legacySkillId: 'stop', requiredChains: ['root', 'spine'], defaultDuration: 0.25, layer: 'base' }),
  skill('walk', { aliases: ['walk', 'move', '走', '行走', '移动'], mode: 'clip', category: 'locomotion', sourceClipId: 'walk-forward', legacyCompiler: 'clip:walk-forward', legacySkillId: 'walk', requiredChains: ['root', 'left_leg', 'right_leg', 'left_arm', 'right_arm'], defaultDuration: 1.2, rootMotionPolicy: 'root_motion', layer: 'base' }),
  skill('walk_backward', { aliases: ['walk backward', 'backward walk', '后退', '向后走'], mode: 'clip', category: 'locomotion', sourceClipId: 'walk-forward', legacyCompiler: 'motion:walk-backward', legacySkillId: 'walk_backward', requiredChains: ['root', 'left_leg', 'right_leg'], defaultDuration: 1.2, rootMotionPolicy: 'root_motion', layer: 'base' }),
  skill('enter', { aliases: ['enter', '进入'], mode: 'composite', category: 'locomotion', legacyCompiler: 'clip:walk-forward', legacySkillId: 'walk', requiredChains: ['root', 'left_leg', 'right_leg'], defaultDuration: 1.2, rootMotionPolicy: 'root_motion', layer: 'base' }),
  skill('leave', { aliases: ['leave', '离开'], mode: 'composite', category: 'locomotion', legacyCompiler: 'motion:walk-backward', legacySkillId: 'walk_backward', requiredChains: ['root', 'left_leg', 'right_leg'], defaultDuration: 1.2, rootMotionPolicy: 'root_motion', layer: 'base' }),
  skill('sidestep_left', { aliases: ['sidestep left', '左侧移'], mode: 'goal', category: 'locomotion', requiredChains: ['root', 'left_leg', 'right_leg'], defaultDuration: 1, rootMotionPolicy: 'root_motion', requiresSolver: true, layer: 'base' }),
  skill('sidestep_right', { aliases: ['sidestep right', '右侧移'], mode: 'goal', category: 'locomotion', requiredChains: ['root', 'left_leg', 'right_leg'], defaultDuration: 1, rootMotionPolicy: 'root_motion', requiresSolver: true, layer: 'base' }),
  // Generic legacy identifiers remain resolvable so existing V1 plans and clips stay valid.
  skill('turn', { aliases: ['turn', '转向', '转身'], mode: 'goal', category: 'locomotion', legacyCompiler: 'motion:turn', legacySkillId: 'turn', requiredChains: ['root', 'spine'], defaultDuration: 0.8, layer: 'base' }),
  skill('turn_left', { aliases: ['turn left', '左转'], mode: 'goal', category: 'locomotion', legacyCompiler: 'motion:turn', legacySkillId: 'turn', requiredChains: ['root', 'spine'], defaultDuration: 0.8, layer: 'base' }),
  skill('turn_right', { aliases: ['turn right', '右转'], mode: 'goal', category: 'locomotion', legacyCompiler: 'motion:turn', legacySkillId: 'turn', requiredChains: ['root', 'spine'], defaultDuration: 0.8, layer: 'base' }),
  skill('turn_to', { aliases: ['turn to', '转向目标'], mode: 'goal', category: 'locomotion', legacyCompiler: 'motion:turn', legacySkillId: 'turn', requiredChains: ['root', 'spine'], defaultDuration: 0.8, layer: 'base' }),
  skill('look', { aliases: ['look', 'observe', '观察', '看'], mode: 'goal', category: 'gaze', legacyCompiler: 'motion:look', legacySkillId: 'look', requiredChains: ['head'], defaultDuration: 0.8, layer: 'head', contactPolicy: 'ignore' }),
  skill('look_at', { aliases: ['look', 'look at', 'observe', '观察', '看向', '查看'], mode: 'goal', category: 'gaze', legacyCompiler: 'motion:look', legacySkillId: 'look', requiredChains: ['head'], defaultDuration: 0.8, layer: 'head', contactPolicy: 'ignore' }),
  skill('look_left', { aliases: ['look left', '向左观察'], mode: 'goal', category: 'gaze', legacyCompiler: 'motion:look', legacySkillId: 'look', requiredChains: ['head'], defaultDuration: 0.8, layer: 'head', contactPolicy: 'ignore' }),
  skill('look_right', { aliases: ['look right', '向右观察'], mode: 'goal', category: 'gaze', legacyCompiler: 'motion:look', legacySkillId: 'look', requiredChains: ['head'], defaultDuration: 0.8, layer: 'head', contactPolicy: 'ignore' }),
  skill('look_up', { aliases: ['look up', '向上看'], mode: 'goal', category: 'gaze', legacyCompiler: 'motion:look', legacySkillId: 'look', requiredChains: ['head'], defaultDuration: 0.8, layer: 'head', contactPolicy: 'ignore' }),
  skill('look_down', { aliases: ['look down', '向下看'], mode: 'goal', category: 'gaze', legacyCompiler: 'motion:look', legacySkillId: 'look', requiredChains: ['head'], defaultDuration: 0.8, layer: 'head', contactPolicy: 'ignore' }),
  skill('reach', { aliases: ['reach', '伸手'], mode: 'goal', category: 'interaction', legacyCompiler: 'motion:reach', legacySkillId: 'reach', requiredChains: ['left_arm', 'right_arm'], requiredAffordances: ['reachPoints'], defaultDuration: 0.9, layer: 'upper-body', contactPolicy: 'ignore', failurePolicy: 'recover_to_stand' }),
  skill('reach_left', { aliases: ['reach left', '左手伸手'], mode: 'goal', category: 'interaction', legacyCompiler: 'motion:reach', legacySkillId: 'reach', requiredChains: ['left_arm'], requiredAffordances: ['reachPoints'], defaultDuration: 0.9, layer: 'upper-body', contactPolicy: 'ignore', failurePolicy: 'recover_to_stand' }),
  skill('reach_right', { aliases: ['reach right', '右手伸手'], mode: 'goal', category: 'interaction', legacyCompiler: 'motion:reach', legacySkillId: 'reach', requiredChains: ['right_arm'], requiredAffordances: ['reachPoints'], defaultDuration: 0.9, layer: 'upper-body', contactPolicy: 'ignore', failurePolicy: 'recover_to_stand' }),
  skill('point', { aliases: ['point', '指向'], mode: 'goal', category: 'gesture', legacyCompiler: 'motion:point', legacySkillId: 'point', requiredChains: ['left_arm', 'right_arm'], defaultDuration: 0.75, layer: 'upper-body', contactPolicy: 'ignore' }),
  skill('point_left', { aliases: ['point left', '左手指向'], mode: 'goal', category: 'gesture', legacyCompiler: 'motion:point', legacySkillId: 'point', requiredChains: ['left_arm'], defaultDuration: 0.75, layer: 'upper-body', contactPolicy: 'ignore' }),
  skill('point_right', { aliases: ['point right', '右手指向'], mode: 'goal', category: 'gesture', legacyCompiler: 'motion:point', legacySkillId: 'point', requiredChains: ['right_arm'], defaultDuration: 0.75, layer: 'upper-body', contactPolicy: 'ignore' }),
  skill('wave', { aliases: ['wave', '挥手', '招手'], mode: 'clip', category: 'gesture', sourceClipId: 'wave', legacyCompiler: 'clip:wave', legacySkillId: 'wave', requiredChains: ['right_arm'], defaultDuration: 1.6, layer: 'upper-body', contactPolicy: 'ignore' }),
  skill('wave_left', { aliases: ['wave left', '左手挥手'], mode: 'clip', category: 'gesture', sourceClipId: 'wave', legacyCompiler: 'clip:wave', legacySkillId: 'wave', requiredChains: ['left_arm'], defaultDuration: 1.6, layer: 'upper-body', contactPolicy: 'ignore' }),
  skill('wave_right', { aliases: ['wave right', '右手挥手'], mode: 'clip', category: 'gesture', sourceClipId: 'wave', legacyCompiler: 'clip:wave', legacySkillId: 'wave', requiredChains: ['right_arm'], defaultDuration: 1.6, layer: 'upper-body', contactPolicy: 'ignore' }),
  skill('salute', { aliases: ['salute', '敬礼'], mode: 'clip', category: 'gesture', sourceClipId: 'wave', legacyCompiler: 'clip:salute', legacySkillId: 'salute', requiredChains: ['right_arm'], defaultDuration: 1.1, layer: 'upper-body', contactPolicy: 'ignore' }),
  skill('salute_left', { aliases: ['salute left', '左手敬礼'], mode: 'clip', category: 'gesture', sourceClipId: 'wave', legacyCompiler: 'clip:salute', legacySkillId: 'salute', requiredChains: ['left_arm'], defaultDuration: 1.1, layer: 'upper-body', contactPolicy: 'ignore' }),
  skill('salute_right', { aliases: ['salute right', '右手敬礼'], mode: 'clip', category: 'gesture', sourceClipId: 'wave', legacyCompiler: 'clip:salute', legacySkillId: 'salute', requiredChains: ['right_arm'], defaultDuration: 1.1, layer: 'upper-body', contactPolicy: 'ignore' }),
  skill('bend', { aliases: ['bend', '弯腰', '俯身'], mode: 'goal', category: 'posture', legacyCompiler: 'motion:bend', legacySkillId: 'bend', requiredChains: ['root', 'spine'], defaultDuration: 0.9, layer: 'base', failurePolicy: 'recover_to_stand' }),
  skill('squat', { aliases: ['squat', '下蹲'], mode: 'clip', category: 'posture', sourceClipId: 'squat', legacyCompiler: 'clip:squat', legacySkillId: 'squat', requiredChains: ['root', 'left_leg', 'right_leg'], defaultDuration: 2.5, layer: 'base' }),
  skill('crouch', { aliases: ['crouch', '低身'], mode: 'clip', category: 'posture', sourceClipId: 'squat', legacyCompiler: 'clip:squat', legacySkillId: 'crouch', requiredChains: ['root', 'left_leg', 'right_leg'], defaultDuration: 1.8, layer: 'base' }),
  skill('sit', { aliases: ['sit', '坐下'], mode: 'goal', category: 'posture', requiredChains: ['root', 'spine', 'left_leg', 'right_leg'], requiredAffordances: ['seatPoints'], defaultDuration: 1.5, requiresSolver: true, layer: 'base', failurePolicy: 'recover_to_stand' }),
  skill('stand_up', { aliases: ['stand up', '起立', '站起来'], mode: 'goal', category: 'posture', legacyCompiler: 'motion:stand-up', legacySkillId: 'stand_up', requiredChains: ['root', 'spine', 'left_leg', 'right_leg'], defaultDuration: 1.4, layer: 'base' }),
  skill('grasp', { aliases: ['grasp', 'grab', '抓住'], mode: 'goal', category: 'manipulation', requiredChains: ['left_arm', 'right_arm'], requiredAffordances: ['graspPoints'], defaultDuration: 0.8, requiresSolver: true, layer: 'upper-body', failurePolicy: 'replan' }),
  skill('release', { aliases: ['release', '松开'], mode: 'goal', category: 'manipulation', requiredChains: ['left_arm', 'right_arm'], defaultDuration: 0.45, requiresSolver: true, layer: 'upper-body', failurePolicy: 'stop' }),
  skill('carry', { aliases: ['carry', '搬运'], mode: 'composite', category: 'manipulation', requiredChains: ['root', 'left_leg', 'right_leg', 'left_arm', 'right_arm'], requiredCapabilities: ['dual_hand_contact'], defaultDuration: 2, requiresSolver: true, layer: 'base', failurePolicy: 'recover_to_stand' }),
  skill('lift', { aliases: ['lift', '抬起'], mode: 'goal', category: 'manipulation', requiredChains: ['left_arm', 'right_arm'], requiredAffordances: ['graspPoints'], defaultDuration: 1.2, requiresSolver: true, layer: 'upper-body', failurePolicy: 'recover_to_stand' }),
  skill('place', { aliases: ['place', '放下'], mode: 'goal', category: 'manipulation', requiredChains: ['left_arm', 'right_arm'], requiredAffordances: ['placePoints'], defaultDuration: 1, requiresSolver: true, layer: 'upper-body', failurePolicy: 'replan' }),
  skill('push', { aliases: ['push', '推动'], mode: 'goal', category: 'manipulation', requiredChains: ['root', 'left_arm', 'right_arm'], requiredAffordances: ['pushPoints'], defaultDuration: 1.2, requiresSolver: true, layer: 'base', failurePolicy: 'recover_to_stand' }),
  skill('pull', { aliases: ['pull', '拉动'], mode: 'goal', category: 'manipulation', requiredChains: ['root', 'left_arm', 'right_arm'], requiredAffordances: ['pullPoints'], defaultDuration: 1.2, requiresSolver: true, layer: 'base', failurePolicy: 'recover_to_stand' }),
  skill('climb', { aliases: ['climb', '攀爬', '登上'], mode: 'goal', category: 'locomotion', requiredChains: ['root', 'left_arm', 'right_arm', 'left_leg', 'right_leg'], requiredAffordances: ['climbPoints'], defaultDuration: 2, requiresSolver: true, layer: 'base', failurePolicy: 'stop' }),
  skill('step_up', { aliases: ['step up', '迈上'], mode: 'goal', category: 'locomotion', requiredChains: ['root', 'left_leg', 'right_leg'], defaultDuration: 1.1, requiresSolver: true, layer: 'base', failurePolicy: 'recover_to_stand' }),
  skill('inspect', { aliases: ['inspect', 'check', '检查', '查看'], mode: 'goal', category: 'interaction', legacyCompiler: 'motion:inspect', legacySkillId: 'inspect', requiredChains: ['root', 'spine', 'head'], requiredAffordances: ['inspectPoints'], defaultDuration: 1.2, layer: 'base', failurePolicy: 'recover_to_stand' }),
  skill('wait', { aliases: ['wait', '等待'], mode: 'wait', category: 'control', legacyCompiler: 'clip:idle-breathe', legacySkillId: 'idle', requiredChains: ['spine'], defaultDuration: 1, layer: 'base' }),
  skill('patrol', { aliases: ['patrol', '巡逻'], mode: 'composite', category: 'security', legacyCompiler: 'clip:walk-forward', legacySkillId: 'walk', requiredChains: ['root', 'left_leg', 'right_leg'], defaultDuration: 2.4, rootMotionPolicy: 'root_motion', layer: 'base' }),
  skill('guard', { aliases: ['guard', '警戒', '守卫'], mode: 'composite', category: 'security', legacyCompiler: 'clip:idle-breathe', legacySkillId: 'idle', requiredChains: ['spine', 'head'], defaultDuration: 2, layer: 'base' }),
  skill('recover', { aliases: ['recover', '恢复'], mode: 'composite', category: 'recovery', legacyCompiler: 'clip:idle-breathe', legacySkillId: 'idle', requiredChains: ['root', 'spine'], defaultDuration: 0.8, layer: 'base' }),
  skill('release_contacts', { aliases: ['release contacts'], mode: 'goal', category: 'recovery', legacyCompiler: 'pose:stop', legacySkillId: 'stop', requiredChains: ['root'], defaultDuration: 0.2, layer: 'base' }),
  skill('recover_to_stand', { aliases: ['recover to stand'], mode: 'goal', category: 'recovery', legacyCompiler: 'motion:stand-up', legacySkillId: 'stand_up', requiredChains: ['root', 'spine', 'left_leg', 'right_leg'], defaultDuration: 1.2, layer: 'base' }),
  skill('return_to_idle', { aliases: ['return to idle'], mode: 'clip', category: 'recovery', sourceClipId: 'idle-breathe', legacyCompiler: 'clip:idle-breathe', legacySkillId: 'idle', requiredChains: ['spine'], defaultDuration: 0.5, layer: 'base' }),
  skill('operate', { aliases: ['operate', '操作'], mode: 'goal', category: 'manipulation', requiredChains: ['left_arm', 'right_arm'], defaultDuration: 1.4, requiresSolver: true, layer: 'upper-body', failurePolicy: 'stop' }),
]);

export class MotionSkillRegistry {
  #skills = new Map();
  #aliases = new Map();

  constructor(skills = DEFAULT_MOTION_SKILLS) {
    for (const value of skills) this.register(value);
  }

  register(input) {
    const item = normalizeMotionSkill(input);
    if (this.#skills.has(item.skillId)) throw new Error(`Motion skill already registered: ${item.skillId}`);
    this.#skills.set(item.skillId, item);
    for (const alias of [item.skillId, ...item.aliases]) this.#aliases.set(normalizeAlias(alias), item.skillId);
    return clone(item);
  }

  get(skillId) {
    const value = this.#skills.get(String(skillId));
    return value ? clone(value) : null;
  }

  resolve(value) {
    const key = normalizeAlias(value);
    const skillId = this.#aliases.get(key) || (this.#skills.has(String(value)) ? String(value) : null);
    return skillId ? this.get(skillId) : null;
  }

  has(value) { return Boolean(this.resolve(value)); }
  list() { return [...this.#skills.values()].map(clone); }

  validate() {
    const errors = [];
    for (const item of this.#skills.values()) {
      if (!item.skillId) errors.push('SKILL_ID_MISSING');
      if (!SKILL_MODES.has(item.mode)) errors.push(`SKILL_MODE_INVALID:${item.skillId}`);
      if (!Number.isFinite(item.defaultDuration) || item.defaultDuration <= 0) errors.push(`SKILL_DURATION_INVALID:${item.skillId}`);
      if (!ROOT_MOTION_POLICIES.has(item.rootMotionPolicy)) errors.push(`SKILL_ROOT_MOTION_POLICY_INVALID:${item.skillId}`);
      if (!CONTACT_POLICIES.has(item.contactPolicy)) errors.push(`SKILL_CONTACT_POLICY_INVALID:${item.skillId}`);
    }
    return { valid: errors.length === 0, errors };
  }
}

export function createDefaultMotionSkillRegistry() {
  return new MotionSkillRegistry();
}

export function normalizeMotionSkill(input = {}) {
  const source = cloneObject(input);
  const skillId = String(source.skillId ?? source.skill_id ?? '').trim();
  if (!skillId) throw new TypeError('MotionSkill.skillId is required.');
  const mode = SKILL_MODES.has(source.mode) ? source.mode : 'goal';
  const legacyCompiler = source.legacyCompiler ?? source.legacy_compiler ?? source.compiler ?? null;
  return {
    ...source,
    skillId,
    version: String(source.version || '1.0'),
    aliases: uniqueStrings(source.aliases),
    category: String(source.category || 'general'),
    mode,
    requiredChains: uniqueStrings(source.requiredChains ?? source.required_chains),
    requiredCapabilities: uniqueStrings(source.requiredCapabilities ?? source.required_capabilities),
    requiredAffordances: uniqueStrings(source.requiredAffordances ?? source.required_affordances),
    parameters: cloneObject(source.parameters),
    defaultDuration: positive(source.defaultDuration, 1),
    mirrorSupport: source.mirrorSupport !== false,
    rootMotionPolicy: ROOT_MOTION_POLICIES.has(source.rootMotionPolicy) ? source.rootMotionPolicy : 'in_place',
    contactPolicy: CONTACT_POLICIES.has(source.contactPolicy) ? source.contactPolicy : 'ignore',
    layer: String(source.layer || 'base'),
    priority: Number.isFinite(Number(source.priority)) ? Number(source.priority) : 0,
    preconditions: cloneArray(source.preconditions),
    successConditions: cloneArray(source.successConditions ?? source.success_conditions),
    failurePolicy: String(source.failurePolicy ?? source.failure_policy ?? 'stop'),
    buildGoalRequests: source.buildGoalRequests ?? source.build_goal_requests ?? 'semantic-default',
    legacyCompiler: legacyCompiler == null ? null : String(legacyCompiler),
    compiler: legacyCompiler == null ? `goal:${skillId}` : String(legacyCompiler),
    legacySkillId: source.legacySkillId == null && source.legacy_skill_id == null ? null : String(source.legacySkillId ?? source.legacy_skill_id),
    sourceClipId: source.sourceClipId == null && source.source_clip_id == null ? null : String(source.sourceClipId ?? source.source_clip_id),
    requiresSolver: Boolean(source.requiresSolver ?? source.requires_solver),
    metadata: cloneObject(source.metadata),
  };
}

function skill(skillId, fields) {
  return normalizeMotionSkill({
    skillId,
    aliases: [],
    requiredChains: [],
    requiredCapabilities: [],
    requiredAffordances: [],
    parameters: { direction: true, side: true, target: true, distanceMeters: true, stepCount: true, durationSeconds: true, speed: true, angleDegrees: true, repeatCount: true },
    rootMotionPolicy: 'in_place',
    contactPolicy: 'preserve',
    mirrorSupport: true,
    priority: 0,
    preconditions: [],
    successConditions: [{ type: 'duration_complete' }],
    failurePolicy: 'stop',
    metadata: {},
    ...fields,
  });
}

function normalizeAlias(value) { return String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ''); }
function uniqueStrings(values) { return [...new Set((Array.isArray(values) ? values : []).map(String).map((value) => value.trim()).filter(Boolean))]; }
function positive(value, fallback) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : fallback; }
function cloneObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {}; }
function cloneArray(value) { return Array.isArray(value) ? structuredClone(value) : []; }
function clone(value) { return value === undefined ? undefined : structuredClone(value); }
