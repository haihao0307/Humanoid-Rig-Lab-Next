import { createBehaviorCommandV1 } from './behavior-command-v1.js';
import { createBehaviorPlanV1 } from './behavior-plan-v1.js';
import { createMotionIntentV1 } from './motion-intent-v1.js';
import { resolveWorldTargetV1, TASK17A_WORLD_TARGETS_V1 } from './world-target-v1.js';

export const INSTRUCTION_INTERPRETER_ADAPTER_V1_SCHEMA = 'humanoid_rig/instruction_interpreter_adapter@1.0';
export const TASK17A_COMMAND_A = '向后转，走到黄色标记点，然后停下';
export const TASK17A_COMMAND_B = '转过身去，走到黄点停住';

export class InstructionInterpreterAdapterV1 {
  constructor({ worldTargets = TASK17A_WORLD_TARGETS_V1 } = {}) {
    this.worldTargets = worldTargets;
    this.schema = INSTRUCTION_INTERPRETER_ADAPTER_V1_SCHEMA;
    this.generalNaturalLanguageSupport = false;
    this.developmentGrammarOnly = true;
  }

  interpret(commandInput, context = {}) {
    const command = commandInput?.schema
      ? createBehaviorCommandV1(commandInput)
      : createBehaviorCommandV1({
        commandId: context.commandId || 'task17a-command',
        actorId: context.actorId || 'human-reference-001',
        text: commandInput,
        locale: 'zh-CN',
        issuedAt: context.issuedAt ?? 0,
        worldContextRevision: context.worldContextRevision ?? 0,
        targetReferences: referencesInText(commandInput),
      });
    const normalized = normalizeText(command.text);
    const startPosition = vec3(context.startPosition);
    const startFacing = finite(context.startFacing, 0);
    const steps = [];

    const turn = parseTurn(normalized);
    let facingAfterTurn = startFacing;
    if (turn) {
      const sign = turn.direction === 'left' ? -1 : 1;
      facingAfterTurn = normalizeAngle(startFacing + sign * radians(turn.angleDegrees));
      steps.push({
        stepId: 'turn-in-place',
        stepType: 'turn_in_place',
        intent: createMotionIntentV1({
          intentType: 'turn_in_place', startPosition, startFacing,
          targetPosition: startPosition, targetFacing: facingAfterTurn,
          turnDirection: turn.direction, turnAngleDegrees: turn.angleDegrees,
          groundNormal: context.groundNormal,
        }),
      });
    }

    const walkRequested = /(走到|到那里|目标点|标记点|黄点)/u.test(normalized);
    let target = null;
    if (walkRequested) {
      target = resolveWorldTargetV1(/黄|黄色/u.test(normalized) ? 'yellow-marker' : '目标点', this.worldTargets);
      const targetFacing = Number.isFinite(Number(context.targetFacing)) ? Number(context.targetFacing) : target.facing;
      steps.push({
        stepId: 'walk-to-target',
        stepType: 'walk_to_target',
        intent: createMotionIntentV1({
          intentType: 'walk_to_target', startPosition, startFacing: facingAfterTurn,
          targetPosition: target.position, targetFacing,
          preferredSpeed: context.preferredSpeed ?? 0.9,
          stopRadius: context.stopRadius ?? 0.03,
          groundNormal: target.groundNormal,
          targetId: target.targetId,
        }),
      });
    }

    const stopRequested = /(停下|停住|停止)/u.test(normalized);
    if (stopRequested) {
      const stopPosition = target?.position ?? startPosition;
      const stopFacing = target?.facing ?? facingAfterTurn;
      steps.push({
        stepId: 'stop-and-settle',
        stepType: 'stop_and_settle',
        intent: createMotionIntentV1({
          intentType: 'stop_and_settle', startPosition: stopPosition, startFacing: stopFacing,
          targetPosition: stopPosition, targetFacing: stopFacing,
          preferredSpeed: context.preferredSpeed ?? 0.9,
          stopRadius: context.stopRadius ?? 0.03,
          groundNormal: target?.groundNormal ?? context.groundNormal,
          targetId: target?.targetId,
        }),
      });
    }

    if (!steps.length) throw new Error(`Unsupported Task 17A development command: ${command.text}`);
    return {
      schema: this.schema,
      command,
      normalizedText: normalized,
      recognizedGrammar: grammarTokens(normalized),
      generalNaturalLanguageSupport: false,
      developmentGrammarOnly: true,
      behaviorPlan: createBehaviorPlanV1({
        planId: `plan-${command.commandId}`,
        sourceCommandId: command.commandId,
        steps,
        preconditions: ['actor-ready', 'flat-ground', 'clear-straight-path'],
        completionCriteria: ['all-steps-completed', 'final-double-support', 'settled-for-one-second'],
        failurePolicy: 'stop-safe-and-report',
      }),
    };
  }
}

export function interpretInstructionV1(text, context = {}) {
  return new InstructionInterpreterAdapterV1(context).interpret(text, context);
}

function parseTurn(text) {
  if (/向左转/u.test(text)) return { direction: 'left', angleDegrees: /180|一百八十/u.test(text) ? 180 : 90 };
  if (/向右转/u.test(text)) return { direction: 'right', angleDegrees: /180|一百八十/u.test(text) ? 180 : 90 };
  if (/(向后转|转过身去)/u.test(text)) return { direction: 'left', angleDegrees: 180 };
  return null;
}

function referencesInText(text) {
  return /黄|黄色/u.test(String(text)) ? ['yellow-marker'] : /目标点/u.test(String(text)) ? ['target'] : [];
}

function grammarTokens(text) {
  return [
    parseTurn(text) ? 'turn' : null,
    /(走到|到那里)/u.test(text) ? 'walk_to_target' : null,
    /(停下|停住|停止)/u.test(text) ? 'stop_and_settle' : null,
  ].filter(Boolean);
}

function normalizeText(value) {
  return String(value || '').trim().replace(/[\s，,。；;！!]+/gu, '');
}

function vec3(value) {
  return [0, 1, 2].map((index) => finite(value?.[index], 0));
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function radians(degrees) { return degrees * Math.PI / 180; }
function normalizeAngle(value) { return Math.atan2(Math.sin(value), Math.cos(value)); }
