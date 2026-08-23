import { MotionLanguageAdapter } from '../../modules/animation/text-motion/adapters.js';
import {
  createMotionIntent,
  stableHash,
  stableStringify,
  validateMotionIntent,
} from '../../modules/animation/text-motion/intent.js';
import {
  createActorMotionContext,
  normalizeActorMotionContext,
  normalizeOccupationId,
} from './actor-motion-context.js';

const NUMBER_WORDS = Object.freeze({
  零: 0, 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 半: 0.5,
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5,
});

const CHINESE_UNITS = Object.freeze({ 十: 10, 百: 100, 千: 1000, 万: 10000 });
const NUMBER_PATTERN = '(?:\\d+(?:\\.\\d+)?|[零一两二三四五六七八九十百千万半]+|zero|one|two|three|four|five|six|seven|eight|nine|ten|half)';

const ACTION_PATTERNS = Object.freeze([
  action('stand_up', 'stand_up', /站起来|起立|stand\s+up/ig),
  action('walk_backward', 'walk_backward', /后退|向后走|朝后走|walk\s+backward|move\s+backward|backward/ig),
  action('sidestep_left', 'sidestep', /向左侧移|左侧移|sidestep\s+left/ig),
  action('sidestep_right', 'sidestep', /向右侧移|右侧移|sidestep\s+right/ig),
  action('stand', 'stand', /站立|待机|stand|idle/ig),
  action('stop', 'stop', /停下|停止|停住|stop/ig),
  action('walk', 'walk', /慢走|快走|行走|走到|走向|走|移动|move|walk|step|run/ig),
  action('turn', 'turn', /转身|转向|左转|右转|turn/ig),
  action('look', 'look', /看向|观察|查看|看|look\s+at|observe|watch|look/ig),
  action('reach', 'reach', /伸手|拿取|拿|reach|take/ig),
  action('grasp', 'grasp', /抓住|抓取|抓|grasp|grab/ig),
  action('release', 'release', /松开|释放|release/ig),
  action('point', 'point', /指向|指着|point/ig),
  action('wave', 'wave', /挥手|招手|wave/ig),
  action('salute', 'salute', /敬礼|salute/ig),
  action('bend', 'bend', /弯腰|俯身|bend/ig),
  action('inspect', 'inspect', /检查|检视|查看|inspect|check/ig),
  action('squat', 'squat', /下蹲|蹲下|squat/ig),
  action('crouch', 'crouch', /低身|半蹲|crouch/ig),
  action('sit', 'sit', /坐下|坐到|坐|sit/ig),
  action('carry', 'carry', /搬运|携带|carry/ig),
  action('lift', 'lift', /抬起|举起|lift/ig),
  action('place', 'place', /放下|放置|place/ig),
  action('push', 'push', /推动|推开|push/ig),
  action('pull', 'pull', /拉动|拉开|pull/ig),
  action('climb', 'climb', /攀爬|登上|爬上|climb/ig),
  action('enter', 'enter', /进入|enter/ig),
  action('leave', 'leave', /离开|leave/ig),
  action('wait', 'wait', /等待|等候|wait/ig),
  action('patrol', 'patrol', /巡逻|patrol/ig),
  action('guard', 'guard', /警戒|守卫|guard/ig),
  action('operate', 'operate', /操作|operate|use\s+(?:the\s+)?radio/ig),
]);

const TARGET_TERMS = Object.freeze([
  ['aircraft_engine', /发动机|engine/ig], ['aircraft', /飞机|航空器|aircraft|airframe/ig],
  ['runway', /跑道|runway/ig], ['radio_station', /无线电台|无线电|radio\s*station|radio/ig],
  ['chair', /椅子|座椅|chair|seat/ig], ['cockpit', /驾驶舱|cockpit/ig], ['ladder', /梯子|ladder/ig],
  ['toolbox', /工具箱|toolbox/ig], ['fuel_cart', /燃料车|fuel\s*cart/ig], ['bomb_cart', /炸弹车|bomb\s*cart/ig],
  ['map_table', /地图桌|地图台|map\s*table/ig], ['checkpoint', /检查点|哨点|checkpoint/ig],
  ['target', /目标|对象|target|object/ig], ['door', /门|door/ig],
]);

const UNSUPPORTED = Object.freeze([
  { regex: /后空翻|空翻|翻跟头|back\s*flip|somersault|flip/ig, skill: 'backflip' },
  { regex: /跳跃|跳起来|jump|leap/ig, skill: 'jump' },
]);

export const DEMO_MOTION_COMMANDS = Object.freeze([
  '飞行员向前走三步，停下后用右手敬礼。',
  '地勤机械师走到发动机旁边，弯腰检查发动机。',
  '指挥员转向右侧，用左手指向跑道，同时观察飞机。',
  '警卫缓慢向前巡逻，同时左右观察。',
  '通讯员走到无线电台旁，坐下并操作无线电。',
]);

export class RuleBasedMotionLanguageAdapter extends MotionLanguageAdapter {
  parse(text, context = {}) {
    return parseMotionText(text, context);
  }
}

/** Interface-only adapter for a future local or remote LLM. No network/API key is used here. */
export class RemoteLanguageModelAdapter extends MotionLanguageAdapter {
  constructor({ request = null } = {}) {
    super();
    this.request = typeof request === 'function' ? request : null;
  }

  async parse(text, context = {}) {
    if (!this.request) throw new Error('RemoteLanguageModelAdapter requires an injected request function.');
    const result = await this.request(String(text ?? ''), structuredClone(context));
    const intent = createMotionIntent(result);
    const validation = validateMotionIntent(intent);
    if (!validation.valid) throw new Error(`RemoteLanguageModelAdapter returned invalid MotionIntent: ${validation.errors.join(', ')}`);
    return intent;
  }
}

export function parseMotionText(input, context = {}) {
  const sourceText = normalizeText(input);
  const language = detectLanguage(sourceText);
  const actorContext = resolveActorContext(sourceText, context);
  const warnings = [];
  const missingSkills = [];
  const unresolvedTokens = [];

  for (const unsupported of UNSUPPORTED) {
    unsupported.regex.lastIndex = 0;
    if (unsupported.regex.test(sourceText)) {
      missingSkills.push(unsupported.skill);
      warnings.push(`UNSUPPORTED_ACTION:${unsupported.skill}`);
      unresolvedTokens.push(unsupported.skill);
    }
  }

  const clauses = splitSequenceClauses(sourceText);
  const actions = [];
  const sequenceRelations = [];
  const parallelRelations = [];
  let previousActions = [];
  let actionIndex = 0;

  for (const [clauseIndex, clause] of clauses.entries()) {
    const parts = splitParallelClauses(clause.text);
    const groupedActionIds = [];
    const parallelId = parts.length > 1 ? `parallel-${clauseIndex + 1}` : null;
    for (const part of parts) {
      const candidates = parseClauseActions(part, actorContext);
      for (const candidate of candidates) {
        const parsed = normalizeAction(candidate, actionIndex, part, actorContext);
        actionIndex += 1;
        actions.push(parsed);
        groupedActionIds.push(parsed.actionId);
      }
    }
    if (parallelId && groupedActionIds.length > 1) parallelRelations.push({ groupId: parallelId, actionIds: groupedActionIds });
    if (clause.sequenceBoundary && previousActions.length && groupedActionIds.length) {
      sequenceRelations.push({ beforeActionId: previousActions.at(-1), afterActionId: groupedActionIds[0] });
    }
    if (!parallelId && groupedActionIds.length > 1) {
      for (let index = 1; index < groupedActionIds.length; index += 1) {
        sequenceRelations.push({ beforeActionId: groupedActionIds[index - 1], afterActionId: groupedActionIds[index] });
      }
    }
    if (groupedActionIds.length) previousActions = groupedActionIds;
  }

  if (!actions.length && sourceText) warnings.push('NO_SUPPORTED_ACTION');
  if (!sourceText) warnings.push('EMPTY_COMMAND');
  const conditions = parseConditions(sourceText);
  const styleHints = parseStyleHints(sourceText);
  const targets = uniqueTargets(actions);
  const status = missingSkills.length || (!actions.length && sourceText)
    ? 'unsupported'
    : sourceText ? 'ready' : 'empty';
  const actor = actorContext.occupation.id === 'civilian' ? null : actorContext.occupation.label;
  const intent = createMotionIntent({
    sourceText,
    language,
    actor,
    actorContextRef: actorContext.actorId,
    occupationHint: actorContext.occupation.id === 'civilian' ? null : actorContext.occupation.id,
    taskType: inferTaskType(actions),
    actions,
    targets,
    spatialRelations: actions.filter((item) => item.direction).map((item) => ({ actionId: item.actionId, relation: item.direction, source: 'explicit_text' })),
    sequenceRelations,
    parallelRelations,
    conditions,
    constraints: { coordinateSystem: 'Y_UP_Z_FORWARD_X_RIGHT', ...(cloneObject(context.constraints)) },
    styleHints,
    equipmentHints: actorContext.equipment.map((item) => ({ id: item.id, type: item.type, source: 'actor_context' })),
    safetyHints: sourceText.includes('小心') || /careful/i.test(sourceText) ? ['cautious'] : [],
    confidenceByField: buildConfidenceByField(actions, actorContext, styleHints),
    unresolvedTokens: uniqueStrings(unresolvedTokens),
    confidence: actions.length ? missingSkills.length ? 0.35 : 0.9 : 0,
    warnings: uniqueStrings([...warnings, ...actions.flatMap((item) => item.warnings || [])]),
    status,
    missingSkills: uniqueStrings(missingSkills),
  });
  return {
    ...intent,
    intentId: `motion-intent-${stableHash(stableStringify({
      sourceText: intent.sourceText, language: intent.language, actor: intent.actor,
      actions: intent.actions, sequenceRelations: intent.sequenceRelations, parallelRelations: intent.parallelRelations,
      occupationHint: intent.occupationHint, conditions: intent.conditions,
    }))}`,
  };
}

function action(skillId, verb, regex) { return { skillId, verb, regex }; }

function parseClauseActions(clause, actorContext) {
  const normalized = String(clause || '').trim();
  if (!normalized) return [];
  if (/左右观察|左右看|左顾右盼|look\s+left\s+and\s+right|scan/i.test(normalized)) {
    return [
      { skillId: 'look_left', verb: 'look', index: 0, length: 1, direction: 'left', phrase: normalized },
      { skillId: 'look_right', verb: 'look', index: 1, length: 1, direction: 'right', phrase: normalized },
    ];
  }
  const candidates = [];
  for (const pattern of ACTION_PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of normalized.matchAll(pattern.regex)) {
      candidates.push({
        skillId: pattern.skillId, verb: pattern.verb, index: match.index ?? 0,
        length: match[0].length, phrase: match[0],
      });
    }
  }
  candidates.sort((left, right) => left.index - right.index || right.length - left.length || left.skillId.localeCompare(right.skillId));
  const result = [];
  for (const candidate of candidates) {
    if (result.some((item) => candidate.index >= item.index && candidate.index < item.index + item.length)) continue;
    // "walk three steps" legitimately contains both a walk verb and the word "step".
    // Preserve a standalone "step forward" command, but do not turn a measurement into
    // a second locomotion action in the same clause.
    if (candidate.skillId === 'walk' && result.some((item) => item.skillId === 'walk')) continue;
    const local = normalized.slice(Math.max(0, candidate.index - 14), Math.min(normalized.length, candidate.index + candidate.length + 28));
    const target = parseTarget(normalized);
    const measurements = parseMeasurements(normalized);
    result.push({
      ...candidate,
      direction: parseDirection(local, normalized),
      side: parseSide(local, normalized),
      target: target?.name ?? null,
      targetType: target?.type ?? null,
      modifiers: parseModifiers(normalized),
      ...measurements,
      actorContext,
    });
  }
  return result;
}

function normalizeAction(candidate, index, clause, actorContext) {
  let skillId = candidate.skillId;
  const lower = String(clause).toLowerCase();
  if (skillId === 'walk' && (/慢走|slow/i.test(clause))) candidate.speed = 'slow';
  if (skillId === 'walk' && (/快走|快速|跑|run|fast/i.test(clause))) candidate.speed = 'fast';
  if (skillId === 'walk' && (/后退|向后|朝后|backward|walk\s+back/i.test(clause))) skillId = 'walk_backward';
  if (skillId === 'sidestep') skillId = candidate.direction === 'left' ? 'sidestep_left' : 'sidestep_right';
  if (skillId === 'turn' && (candidate.direction === 'left' || /左转|turn\s+left/i.test(clause))) candidate.side = 'left';
  if (skillId === 'turn' && (candidate.direction === 'right' || /右转|turn\s+right/i.test(clause))) candidate.side = 'right';
  return {
    actionId: `action-${index + 1}`,
    verb: candidate.verb,
    skillId,
    direction: candidate.direction || null,
    side: candidate.side || null,
    target: candidate.target || null,
    targetType: candidate.targetType || null,
    distanceMeters: candidate.distanceMeters ?? null,
    stepCount: candidate.stepCount ?? null,
    durationSeconds: candidate.durationSeconds ?? null,
    speed: candidate.speed || null,
    angleDegrees: candidate.angleDegrees ?? null,
    repeatCount: candidate.repeatCount ?? null,
    modifiers: candidate.modifiers || [],
    warnings: skillId === 'walk' && (lower.includes('run') || /跑(?!道)/.test(clause)) ? ['RUN_MAPPED_TO_FAST_WALK'] : [],
  };
}

function splitSequenceClauses(text) {
  // Keep a comma followed by an explicit parallel connector in the same clause.
  // For example, "指向跑道，同时观察飞机" must retain the Point + Look group.
  const protectedText = String(text).replace(/(?:，|,)\s*(?=(?:同时|一边|一面|并且|while\b|at\s+the\s+same\s+time\b))/ig, '§');
  const parts = protectedText.split(/(?:，|,|。|；|;|\bthen\b|\bafter\b|\bbefore\b|\bfinally\b|然后|接着|随后|再|最后|完成后|之后)/ig)
    .map((value) => value.replace(/§/g, ' ').trim()).filter(Boolean);
  return parts.map((value, index) => ({ text: value, sequenceBoundary: index > 0 }));
}

function splitParallelClauses(text) {
  const scan = String(text).replace(/一边|一面/gi, ' ');
  // "坐下并操作" is a dependent interaction, not concurrent posture and hand
  // control. Retaining it as one clause lets the normal action order produce
  // sit → operate while standalone walk/look commands remain parallel.
  if (/(?:坐下|sit).*(?:并|and).*(?:操作|operate|use\s+(?:the\s+)?radio)/i.test(scan)) return [scan];
  return scan.split(/同时|并且|并|\bwhile\b|\bat\s+the\s+same\s+time\b|\band\b/ig).map((value) => value.trim()).filter(Boolean);
}

function parseDirection(text, fullText = text) {
  const value = `${text} ${fullText}`.toLowerCase();
  if (/左前方|左前|front[- ]?left|left[- ]?forward/.test(value)) return 'left_forward';
  if (/右前方|右前|front[- ]?right|right[- ]?forward/.test(value)) return 'right_forward';
  if (/左后方|左后|back[- ]?left|left[- ]?backward/.test(value)) return 'left_backward';
  if (/右后方|右后|back[- ]?right|right[- ]?backward/.test(value)) return 'right_backward';
  if (/向后|朝后|后方|backward|back/.test(value)) return 'backward';
  if (/向前|朝前|前方|forward|front/.test(value)) return 'forward';
  if (/向左|左侧|左边|left/.test(value)) return 'left';
  if (/向右|右侧|右边|right/.test(value)) return 'right';
  if (/向上|上方|up/.test(value)) return 'up';
  if (/向下|下方|down/.test(value)) return 'down';
  return null;
}

function parseSide(local, fullText) {
  const value = `${local} ${fullText}`;
  if (/左手|用左|\bleft\s+hand\b/i.test(value)) return 'left';
  if (/右手|用右|\bright\s+hand\b/i.test(value)) return 'right';
  if (/双手|两手|both\s+hands/i.test(value)) return 'both';
  return null;
}

function parseTarget(text) {
  for (const [type, regex] of TARGET_TERMS) {
    regex.lastIndex = 0;
    const match = regex.exec(text);
    if (match) return { type, name: match[0] };
  }
  return null;
}

function parseModifiers(text) {
  const result = [];
  const values = [
    ['slow', /慢慢|缓慢|慢速|slowly|slow/i], ['fast', /快速|迅速|匆忙|quickly|fast/i],
    ['gentle', /轻轻|gentle|gently/i], ['forceful', /用力|forceful/i], ['cautious', /小心|careful/i],
    ['natural', /自然|natural/i], ['rigid', /僵硬|rigid/i], ['alert', /警觉|alert/i],
    ['fatigued', /疲劳|tired/i], ['precise', /精准|精确|precise/i],
  ];
  for (const [name, regex] of values) if (regex.test(text)) result.push(name);
  return result;
}

function parseMeasurements(text) {
  const read = (unit) => new RegExp(`(${NUMBER_PATTERN})\\s*(?:${unit})`, 'i').exec(text)?.[1] ?? null;
  const step = read('步|steps?');
  const meter = read('米|m|meters?|metres?');
  const second = read('秒|s|seconds?');
  const degree = read('度|degrees?');
  const repeat = new RegExp(`(?:重复|repeat)\\s*(${NUMBER_PATTERN})\\s*(?:次|times?)`, 'i').exec(text)?.[1] ?? null;
  return {
    stepCount: step == null ? null : positiveInteger(parseNumber(step)),
    distanceMeters: meter == null ? null : nonNegative(parseNumber(meter)),
    durationSeconds: second == null ? null : positive(parseNumber(second)),
    angleDegrees: degree == null ? null : clamp(parseNumber(degree), -360, 360, null),
    repeatCount: repeat == null ? null : positiveInteger(parseNumber(repeat)),
    speed: /慢慢|缓慢|slow/i.test(text) ? 'slow' : /快速|迅速|快走|run|fast/i.test(text) ? 'fast' : null,
  };
}

export function parseNumber(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const normalized = String(value || '').trim().toLowerCase();
  if (NUMBER_WORDS[normalized] != null) return NUMBER_WORDS[normalized];
  if (!normalized || ![...normalized].every((character) => NUMBER_WORDS[character] != null || CHINESE_UNITS[character])) return null;
  let total = 0;
  let section = 0;
  let digit = 0;
  for (const character of normalized) {
    const unit = CHINESE_UNITS[character];
    if (!unit) { digit = NUMBER_WORDS[character]; continue; }
    if (unit === 10000) { section = (section + digit) * unit; total += section; section = 0; }
    else section += (digit || 1) * unit;
    digit = 0;
  }
  return total + section + digit;
}

function parseConditions(text) {
  const values = [];
  if (/如果|\bif\b/i.test(text)) values.push({ type: 'if', source: 'explicit_text', confidence: 1 });
  if (/直到|\buntil\b/i.test(text)) values.push({ type: 'until', source: 'explicit_text', confidence: 1 });
  if (/当|\bwhen\b/i.test(text)) values.push({ type: 'when', source: 'explicit_text', confidence: 1 });
  if (/等待|\bwhile\b/i.test(text)) values.push({ type: 'wait', source: 'explicit_text', confidence: 0.9 });
  return values;
}

function parseStyleHints(text) {
  return parseModifiers(text).map((value) => ({ value, source: 'explicit_text', confidence: 1 }));
}

function inferTaskType(actions) {
  if (actions.some((item) => item.skillId === 'inspect')) return 'inspection';
  if (actions.some((item) => item.skillId === 'patrol' || item.skillId === 'guard')) return 'security';
  if (actions.some((item) => item.skillId === 'salute' || item.skillId.startsWith('salute_'))) return 'gesture';
  if (actions.some((item) => item.skillId === 'carry' || item.skillId === 'lift')) return 'manipulation';
  return actions.length ? 'motion' : null;
}

function buildConfidenceByField(actions, actorContext, styleHints) {
  return {
    actorContextRef: { value: actorContext.actorId, source: 'context', confidence: 1 },
    occupationHint: { value: actorContext.occupation.id, source: actorContext.occupation.id === 'civilian' ? 'system_default' : 'explicit_or_context', confidence: actorContext.occupation.id === 'civilian' ? 0.5 : 0.9 },
    actions: actions.map((item) => ({ actionId: item.actionId, skillId: { value: item.skillId, source: 'explicit_text', confidence: 0.95 } })),
    styleHints: styleHints.map((item) => ({ value: item.value, source: item.source, confidence: item.confidence })),
  };
}

function resolveActorContext(text, context) {
  const supplied = context.actorContext || context.actor_motion_context || null;
  const occupation = parseOccupation(text) || supplied?.occupation?.id || context.occupationHint || context.occupation || null;
  const dominantSide = context.dominantSide || context.dominant_side || supplied?.dominantSide || 'right';
  return normalizeActorMotionContext(supplied || createActorMotionContext({
    actorId: context.actorId || 'actor_default',
    characterId: context.characterId || 'character_001',
    occupation: occupation ? { id: normalizeOccupationId(occupation), label: String(occupation) } : undefined,
    dominantSide,
    equipment: context.equipment || [],
  }));
}

function parseOccupation(text) {
  const values = [
    ['aircraft_mechanic', /地勤机械师|机械师|aircraft\s*mechanic|mechanic/i], ['pilot', /飞行员|pilot/i],
    ['commander', /指挥员|commander/i], ['guard', /警卫|guard/i], ['radio_operator', /通讯员|无线电员|radio\s*operator/i],
    ['ground_crew', /地勤人员|地勤|ground\s*crew/i],
  ];
  return values.find(([, regex]) => regex.test(text))?.[0] ?? null;
}

function uniqueTargets(actions) {
  const result = new Map();
  for (const action of actions) {
    if (!action.target) continue;
    result.set(`${action.targetType || 'generic'}:${action.target}`, { name: action.target, type: action.targetType || 'generic', actionIds: [action.actionId] });
  }
  return [...result.values()];
}

function detectLanguage(text) {
  const zh = /[\u3400-\u9fff]/.test(text);
  const en = /[A-Za-z]/.test(text);
  return zh && en ? 'mixed' : zh ? 'zh' : en ? 'en' : 'unknown';
}

// Keep punctuation intact because it carries sequencing and parallel-clause
// boundaries. Action regexes naturally ignore it, while the clause splitter
// needs it to avoid leaking a later target onto an earlier action.
function normalizeText(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function positive(value) { return Number.isFinite(value) && value > 0 ? value : null; }
function positiveInteger(value) { return Number.isInteger(value) && value > 0 ? value : null; }
function nonNegative(value) { return Number.isFinite(value) && value >= 0 ? value : null; }
function clamp(value, min, max, fallback) { return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback; }
function uniqueStrings(values) { return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))]; }
function cloneObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) : {}; }
