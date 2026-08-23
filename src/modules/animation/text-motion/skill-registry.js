const SKILL_MODES = new Set(['clip', 'procedural_pose', 'procedural_motion', 'composite']);
const CONTACT_POLICIES = new Set(['preserve', 'ignore', 'generate']);
const ROOT_MOTION_POLICIES = new Set(['in_place', 'root_motion']);

export const DEFAULT_MOTION_SKILLS = Object.freeze([
  skill('idle', ['stand', 'idle', '站立', '待机'], 'clip', ['spine'], 'clip:idle-breathe', 3.2, 'base', 'preserve', 'in_place', 'idle-breathe'),
  skill('walk', ['walk', 'move', 'patrol', '走', '行走', '移动', '巡逻'], 'clip', ['root', 'left_leg', 'right_leg', 'left_arm', 'right_arm'], 'clip:walk-forward', 1.2, 'base', 'preserve', 'root_motion', 'walk-forward'),
  skill('walk_backward', ['walk backward', 'backward walk', '向后走', '后退'], 'procedural_motion', ['root', 'left_leg', 'right_leg'], 'motion:walk-backward', 1.2, 'base', 'preserve', 'root_motion', 'walk-forward'),
  skill('stop', ['stop', '停下', '停止', '停住'], 'procedural_pose', ['root', 'spine'], 'pose:stop', 0.25, 'base', 'preserve', 'in_place'),
  skill('turn', ['turn', '转身', '转向', '左转', '右转'], 'procedural_motion', ['root', 'spine'], 'motion:turn', 0.8, 'base', 'preserve', 'in_place'),
  skill('look', ['look', 'observe', 'watch', '看', '观察', '查看'], 'procedural_pose', ['head'], 'motion:look', 0.8, 'head', 'ignore', 'in_place'),
  skill('reach', ['reach', 'grab', 'take', '伸手', '拿', '抓取'], 'procedural_pose', ['left_arm', 'right_arm'], 'motion:reach', 0.9, 'upper-body', 'ignore', 'in_place'),
  skill('point', ['point', '指向', '指着'], 'procedural_pose', ['left_arm', 'right_arm'], 'motion:point', 0.75, 'upper-body', 'ignore', 'in_place'),
  skill('wave', ['wave', '挥手', '招手'], 'clip', ['right_arm'], 'clip:wave', 1.6, 'upper-body', 'ignore', 'in_place', 'wave'),
  skill('salute', ['salute', '敬礼'], 'clip', ['right_arm'], 'clip:salute', 1.1, 'upper-body', 'ignore', 'in_place', 'wave'),
  skill('squat', ['squat', '下蹲', '蹲下', '蹲'], 'clip', ['root', 'left_leg', 'right_leg'], 'clip:squat', 2.5, 'base', 'preserve', 'in_place', 'squat'),
  skill('crouch', ['crouch', '低身'], 'clip', ['root', 'left_leg', 'right_leg'], 'clip:squat', 1.8, 'base', 'preserve', 'in_place', 'squat'),
  skill('bend', ['bend', '弯腰', '俯身'], 'procedural_pose', ['root', 'spine'], 'motion:bend', 0.9, 'base', 'preserve', 'in_place'),
  skill('inspect', ['inspect', 'check', '检查', '查看'], 'procedural_pose', ['root', 'spine', 'head'], 'motion:inspect', 1.2, 'base', 'preserve', 'in_place'),
  skill('sit', ['sit', '坐下', '坐'], 'procedural_pose', ['root', 'spine', 'left_leg', 'right_leg'], 'motion:sit', 1.5, 'base', 'preserve', 'in_place'),
  skill('stand_up', ['stand up', '起立', '站起来'], 'procedural_pose', ['root', 'spine', 'left_leg', 'right_leg'], 'motion:stand-up', 1.4, 'base', 'preserve', 'in_place'),
]);

export class MotionSkillRegistry {
  #skills = new Map();
  #aliases = new Map();

  constructor(skills = DEFAULT_MOTION_SKILLS) {
    for (const item of skills) this.register(item);
  }

  register(input) {
    const skill = normalizeSkill(input);
    if (this.#skills.has(skill.skillId)) throw new Error(`Motion skill already registered: ${skill.skillId}`);
    this.#skills.set(skill.skillId, skill);
    for (const alias of [skill.skillId, ...skill.aliases]) this.#aliases.set(normalizeAlias(alias), skill.skillId);
    return structuredClone(skill);
  }

  get(skillId) {
    const skill = this.#skills.get(String(skillId));
    return skill ? structuredClone(skill) : null;
  }

  resolve(value) {
    const key = normalizeAlias(value);
    const skillId = this.#aliases.get(key) || (this.#skills.has(String(value)) ? String(value) : null);
    return skillId ? this.get(skillId) : null;
  }

  has(value) {
    return Boolean(this.resolve(value));
  }

  list() {
    return [...this.#skills.values()].map((item) => structuredClone(item));
  }

  validate() {
    const errors = [];
    for (const item of this.#skills.values()) {
      if (!item.skillId) errors.push('SKILL_ID_MISSING');
      if (!SKILL_MODES.has(item.mode)) errors.push(`SKILL_MODE_INVALID:${item.skillId}`);
      if (!Number.isFinite(item.defaultDuration) || item.defaultDuration <= 0) errors.push(`SKILL_DURATION_INVALID:${item.skillId}`);
      if (!CONTACT_POLICIES.has(item.contactPolicy)) errors.push(`SKILL_CONTACT_POLICY_INVALID:${item.skillId}`);
      if (!ROOT_MOTION_POLICIES.has(item.rootMotionPolicy)) errors.push(`SKILL_ROOT_MOTION_POLICY_INVALID:${item.skillId}`);
    }
    return { valid: errors.length === 0, errors };
  }
}

export function createDefaultMotionSkillRegistry() {
  return new MotionSkillRegistry();
}

function skill(skillId, aliases, mode, requiredChains, compiler, defaultDuration, layer, contactPolicy, rootMotionPolicy, sourceClipId = null) {
  return {
    skillId,
    aliases,
    mode,
    requiredChains,
    parameters: {
      direction: true,
      side: true,
      target: true,
      distanceMeters: true,
      stepCount: true,
      durationSeconds: true,
      speed: true,
      angleDegrees: true,
      repeatCount: true,
    },
    compiler,
    defaultDuration,
    mirrorSupport: true,
    contactPolicy,
    rootMotionPolicy,
    sourceClipId,
    layer,
  };
}

function normalizeSkill(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const skillId = String(source.skillId || source.skill_id || '').trim();
  if (!skillId) throw new TypeError('MotionSkill.skillId is required.');
  return {
    ...structuredClone(source),
    skillId,
    aliases: [...new Set((Array.isArray(source.aliases) ? source.aliases : []).map(String).filter(Boolean))],
    mode: SKILL_MODES.has(source.mode) ? source.mode : 'procedural_pose',
    requiredChains: [...new Set((Array.isArray(source.requiredChains) ? source.requiredChains : []).map(String).filter(Boolean))],
    parameters: source.parameters && typeof source.parameters === 'object' ? structuredClone(source.parameters) : {},
    compiler: String(source.compiler || `motion:${skillId}`),
    defaultDuration: Number.isFinite(Number(source.defaultDuration)) && Number(source.defaultDuration) > 0 ? Number(source.defaultDuration) : 1,
    mirrorSupport: source.mirrorSupport !== false,
    contactPolicy: CONTACT_POLICIES.has(source.contactPolicy) ? source.contactPolicy : 'ignore',
    rootMotionPolicy: ROOT_MOTION_POLICIES.has(source.rootMotionPolicy) ? source.rootMotionPolicy : 'in_place',
    sourceClipId: source.sourceClipId == null ? null : String(source.sourceClipId),
    layer: String(source.layer || 'base'),
  };
}

function normalizeAlias(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}
