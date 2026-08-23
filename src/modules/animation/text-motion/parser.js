import { MotionLanguageAdapter } from './adapters.js';
import {
  createMotionIntent,
  stableHash,
  stableStringify,
} from './intent.js';

const NUMBER_WORDS = Object.freeze({
  零: 0, 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
});

const CHINESE_NUMBER_PATTERN = '[零一两二三四五六七八九十百千万]+';
const CHINESE_NUMBER_UNITS = Object.freeze({ 十: 10, 百: 100, 千: 1000, 万: 10000 });

const UNSUPPORTED_PATTERNS = Object.freeze([
  { pattern: /后空翻|空翻|翻跟头|back\s*flip|somersault|flip/i, skill: 'backflip' },
  { pattern: /跳跃|跳起来|jump|leap/i, skill: 'jump' },
]);

const ACTION_PATTERNS = Object.freeze([
  { skillId: 'stand_up', verb: 'stand_up', regex: /站起来|起立|stand\s+up/ig },
  { skillId: 'stop', verb: 'stop', regex: /停下|停止|停住|stop/ig },
  { skillId: 'walk', verb: 'walk', regex: /(?:向前|向后|向左|向右|朝前|朝后)?(?:走|行走|移动|巡逻)|walk|move|patrol/ig },
  { skillId: 'turn', verb: 'turn', regex: /转身|转向|左转|右转|turn/ig },
  { skillId: 'look', verb: 'look', regex: /观察|看向|看|look|observe|watch/ig },
  { skillId: 'reach', verb: 'reach', regex: /伸手|拿取|拿|抓取|reach|grab|take/ig },
  { skillId: 'point', verb: 'point', regex: /指向|指着|point/ig },
  { skillId: 'wave', verb: 'wave', regex: /挥手|招手|wave/ig },
  { skillId: 'salute', verb: 'salute', regex: /敬礼|salute/ig },
  { skillId: 'inspect', verb: 'inspect', regex: /检查|查看|inspect|check/ig },
  { skillId: 'bend', verb: 'bend', regex: /弯腰|俯身|bend/ig },
  { skillId: 'squat', verb: 'squat', regex: /下蹲|蹲下|蹲|squat|crouch/ig },
  { skillId: 'sit', verb: 'sit', regex: /坐下|坐|sit/ig },
  { skillId: 'idle', verb: 'stand', regex: /站立|待机|stand|idle/ig },
]);

export const DEMO_MOTION_COMMANDS = Object.freeze([
  '飞行员向前走三步，停下后用右手敬礼。',
  '地勤人员弯腰检查左前方的发动机。',
  '指挥员转向右侧并用左手指向跑道。',
  '警卫缓慢向前巡逻，同时左右观察。',
]);

export class RuleBasedMotionLanguageAdapter extends MotionLanguageAdapter {
  parse(text, context = {}) {
    return parseMotionText(text, context);
  }
}

export function parseMotionText(input, context = {}) {
  const sourceText = String(input || '').replace(/[，。！？；,!?;]+/g, ' ').replace(/\s+/g, ' ').trim();
  const language = detectLanguage(sourceText);
  const warnings = [];
  const missingSkills = [];
  for (const item of UNSUPPORTED_PATTERNS) {
    if (item.pattern.test(sourceText)) {
      missingSkills.push(item.skill);
      warnings.push(`UNSUPPORTED_ACTION:${item.skill}`);
    }
  }

  const actor = parseActor(sourceText);
  const actions = [];
  const sequenceRelations = [];
  const parallelRelations = [];
  let actionIndex = 0;
  let previousClauseActions = [];
  let sequenceIndex = 0;
  const clauses = splitSequenceClauses(sourceText);

  for (const clause of clauses) {
    const parallelParts = splitParallelClauses(clause.text);
    const groupActions = [];
    const groupId = parallelParts.length > 1 ? `parallel-${sequenceIndex + 1}` : null;
    for (const part of parallelParts) {
      const candidates = parseClauseActions(part, context);
      for (const candidate of candidates) {
        const action = normalizeParsedAction(candidate, actionIndex, part);
        actionIndex += 1;
        actions.push(action);
        groupActions.push(action.actionId);
      }
    }
    if (groupId && groupActions.length > 1) {
      parallelRelations.push({ groupId, actionIds: groupActions });
    }
    const firstAction = groupActions[0];
    if (clause.sequenceBoundary && previousClauseActions.length && firstAction) {
      sequenceRelations.push({
        beforeActionId: previousClauseActions.at(-1),
        afterActionId: firstAction,
      });
    }
    if (!groupId && groupActions.length > 1) {
      for (let index = 1; index < groupActions.length; index += 1) {
        sequenceRelations.push({
          beforeActionId: groupActions[index - 1],
          afterActionId: groupActions[index],
        });
      }
    }
    if (groupActions.length) previousClauseActions = groupActions;
    sequenceIndex += 1;
  }

  if (!actions.length && sourceText) warnings.push('NO_SUPPORTED_ACTION');
  if (!sourceText) warnings.push('EMPTY_COMMAND');
  const parsedStatus = missingSkills.length || (!actions.length && sourceText) ? 'unsupported' : sourceText ? 'ready' : 'empty';
  const intent = createMotionIntent({
    sourceText,
    language,
    actor,
    actions,
    sequenceRelations,
    parallelRelations,
    constraints: {
      coordinateSystem: 'Y_UP_Z_FORWARD_X_RIGHT',
      ...(context.constraints || {}),
    },
    confidence: actions.length ? missingSkills.length ? 0.35 : 0.88 : 0,
    warnings: [...warnings, ...actions.flatMap((action) => action.warnings || [])],
    status: parsedStatus,
    missingSkills,
  });
  return {
    ...intent,
    intentId: `motion-intent-${stableHash(stableStringify({
      sourceText: intent.sourceText,
      language: intent.language,
      actor: intent.actor,
      actions: intent.actions,
      sequenceRelations: intent.sequenceRelations,
      parallelRelations: intent.parallelRelations,
    }))}`,
  };
}

function splitSequenceClauses(text) {
  const clauses = [];
  const pattern = /然后|接着|最后|之后|完成后|(?<!向)后(?=(?:用|向|敬礼|挥手|站|停|看|观察|指|检查|弯|坐|下蹲|蹲))/gi;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text))) {
    const value = text.slice(lastIndex, match.index).trim();
    if (value) clauses.push({ text: value, sequenceBoundary: clauses.length > 0 });
    lastIndex = pattern.lastIndex;
  }
  const englishParts = text.slice(lastIndex).split(/\b(?:then|after|finally)\b/ig);
  englishParts.forEach((part, index) => {
    const value = part.trim();
    if (value) clauses.push({ text: value, sequenceBoundary: index > 0 || clauses.length > 0 });
  });
  if (!clauses.length && text.trim()) clauses.push({ text: text.trim(), sequenceBoundary: false });
  return clauses;
}

function splitParallelClauses(text) {
  const value = text.replace(/一边|一面/gi, ' ');
  return value.split(/同时|并且|并|\bwhile\b|\bat the same time\b|\band\b/ig).map((part) => part.trim()).filter(Boolean);
}

function parseClauseActions(clause, context) {
  const normalized = clause.trim();
  if (/左右观察|左右看|look\s+left\s+and\s+right/i.test(normalized)) {
    return [
      { skillId: 'look', verb: 'look', index: 0, phrase: normalized, direction: 'left' },
      { skillId: 'look', verb: 'look', index: 1, phrase: normalized, direction: 'right' },
    ];
  }
  const candidates = [];
  for (const pattern of ACTION_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(normalized))) {
      candidates.push({
        skillId: pattern.skillId,
        verb: pattern.verb,
        index: match.index,
        phrase: match[0],
        matchLength: match[0].length,
      });
      if (!pattern.regex.global) break;
    }
  }
  candidates.sort((a, b) => a.index - b.index || b.matchLength - a.matchLength || a.skillId.localeCompare(b.skillId));
  const deduped = [];
  for (const candidate of candidates) {
    if (deduped.some((item) => candidate.index >= item.index && candidate.index < item.index + item.matchLength)) continue;
    const localContext = normalized.slice(
      Math.max(0, candidate.index - 10),
      Math.min(normalized.length, candidate.index + candidate.matchLength + 16),
    );
    deduped.push({
      ...candidate,
      direction: ['stop', 'idle'].includes(candidate.skillId) ? null : parseDirection(localContext, localContext),
      side: parseSide(normalized),
      target: parseTarget(normalized),
      modifiers: parseModifiers(normalized),
      ...parseMeasurements(normalized),
      context,
    });
  }
  return deduped;
}

function normalizeParsedAction(candidate, index, clause) {
  const action = {
    actionId: `action-${index + 1}`,
    verb: candidate.verb,
    skillId: candidate.skillId,
    direction: candidate.direction || null,
    side: candidate.side || null,
    target: candidate.target || null,
    distanceMeters: candidate.distanceMeters ?? null,
    stepCount: candidate.stepCount ?? null,
    durationSeconds: candidate.durationSeconds ?? null,
    speed: candidate.speed || null,
    angleDegrees: candidate.angleDegrees ?? null,
    repeatCount: candidate.repeatCount ?? null,
    modifiers: candidate.modifiers || [],
    warnings: [],
  };
  if (action.skillId === 'walk' && /向后|朝后|backward|back/i.test(clause)) action.direction = 'backward';
  if (action.skillId === 'turn' && /左转|向左|left/i.test(clause)) action.side = 'left';
  if (action.skillId === 'turn' && /右转|向右|right/i.test(clause)) action.side = 'right';
  return action;
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
  return null;
}

function parseSide(text) {
  if (/左手|用左|左侧|左边|\bleft\b/i.test(text)) return 'left';
  if (/右手|用右|右侧|右边|\bright\b/i.test(text)) return 'right';
  if (/双手|两手|both\s+hands/i.test(text)) return 'both';
  return null;
}

function parseTarget(text) {
  const match = /(?:的|向|指向|看向|观察|检查|inspect|point(?:\s+to)?|look(?:\s+at)?|check)\s*(?:左前方|右前方|左侧|右侧|前方|后方|front[- ]?(?:left|right)|back[- ]?(?:left|right))?\s*(?:的|of)?\s*(发动机|跑道|目标|对象|椅子|门|engine|runway|target|object|chair|door)/i.exec(text);
  return match ? match[1] : null;
}

function parseModifiers(text) {
  const modifiers = [];
  if (/慢慢|缓慢|慢速|slowly|slow/i.test(text)) modifiers.push('slow');
  if (/快速|快|快速地|quickly|fast/i.test(text)) modifiers.push('fast');
  if (/轻轻|gentle|gently/i.test(text)) modifiers.push('gentle');
  if (/大幅|large/i.test(text)) modifiers.push('large');
  if (/小幅|small/i.test(text)) modifiers.push('small');
  return modifiers;
}

function parseMeasurements(text) {
  const number = `(\\d+(?:\\.\\d+)?|${CHINESE_NUMBER_PATTERN}|zero|one|two|three|four|five|six|seven|eight|nine|ten)`;
  const stepsMatch = new RegExp(`${number}\\s*(?:步|steps?)`, 'i').exec(text);
  const distanceMatch = new RegExp(`${number}\\s*(?:米|m|meters?|metres?)`, 'i').exec(text);
  const durationMatch = new RegExp(`(?:持续|for|持续时间)?\\s*${number}\\s*(?:秒|s|seconds?)`, 'i').exec(text);
  const angleMatch = new RegExp(`${number}\\s*(?:度|degrees?)`, 'i').exec(text);
  const repeatMatch = new RegExp(`(?:重复|repeat)\\s*${number}\\s*(?:次|times?)`, 'i').exec(text);
  return {
    stepCount: stepsMatch ? parseNumber(stepsMatch[1]) : null,
    distanceMeters: distanceMatch ? parseNumber(distanceMatch[1]) : null,
    durationSeconds: durationMatch ? parseNumber(durationMatch[1]) : null,
    angleDegrees: angleMatch ? parseNumber(angleMatch[1]) : null,
    repeatCount: repeatMatch ? parseNumber(repeatMatch[1]) : null,
    speed: parseModifiers(text)[0] || null,
  };
}

function parseNumber(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const normalized = String(value).toLowerCase();
  if (NUMBER_WORDS[normalized] != null) return NUMBER_WORDS[normalized];
  if (![...normalized].every((character) => NUMBER_WORDS[character] != null || CHINESE_NUMBER_UNITS[character])) return null;

  let total = 0;
  let section = 0;
  let digit = 0;
  for (const character of normalized) {
    const unit = CHINESE_NUMBER_UNITS[character];
    if (!unit) {
      digit = NUMBER_WORDS[character];
      continue;
    }
    if (unit === 10000) {
      section = (section + digit) * unit;
      total += section;
      section = 0;
    } else {
      section += (digit || 1) * unit;
    }
    digit = 0;
  }
  return total + section + digit;
}

function parseActor(text) {
  const known = /^(飞行员|地勤人员|指挥员|警卫|演员|pilot|ground\s+crew|commander|guard|actor)\b/i.exec(text);
  return known ? known[1] : null;
}

function detectLanguage(text) {
  const hasChinese = /[\u3400-\u9fff]/.test(text);
  const hasEnglish = /[A-Za-z]/.test(text);
  return hasChinese && hasEnglish ? 'mixed' : hasChinese ? 'zh' : hasEnglish ? 'en' : 'unknown';
}
