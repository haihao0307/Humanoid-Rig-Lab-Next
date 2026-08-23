import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDefaultState } from '../src/default-state.js';
import { renderTextMotionPanel } from '../src/modules/animation/text-motion/panel.js';

const state = createDefaultState();
state.character.animation.textMotion = {
  lastCommand: '飞行员向前走三步，停下，用右手敬礼。',
  parseStatus: 'ready',
  actorContext: { occupation: { id: 'pilot' }, dominantSide: 'right', equipment: [{ id: 'helmet', type: 'helmet' }] },
  intent: { language: 'zh', occupationHint: 'pilot', actions: [{ skillId: 'walk' }, { skillId: 'salute' }], targets: [], unresolvedTokens: [] },
  plan: {
    nodes: [{ nodeId: 'step-1', skillId: 'walk' }, { nodeId: 'step-2', skillId: 'salute_right' }],
    semanticRequiredSkills: ['walk', 'salute_right'],
    estimatedDuration: 2.4,
    estimatedDistance: 1.08,
    unresolvedTargets: [],
    requiresSolverCapabilities: [],
  },
  skillGraph: {
    nodes: [{ nodeId: 'step-1', skillId: 'walk', status: 'completed' }, { nodeId: 'step-2', skillId: 'salute_right', status: 'running' }],
    edges: [{ fromNodeId: 'step-1', toNodeId: 'step-2' }],
    parallelGroups: [],
  },
  executionSession: { status: 'running', currentNodeId: 'step-2', activeSkills: ['salute_right'], completedNodeIds: ['step-1'], failedNodeIds: [], progress: 0.5, recoveryState: null },
  generatedClipId: 'text-motion-example',
};

const html = renderTextMotionPanel(state);
for (const id of [
  'textMotionInput', 'textMotionOccupation', 'textMotionDominantSide', 'textMotionEquipment', 'textMotionWorldMode',
  'parseTextMotion', 'planTextMotion', 'previewTextMotion', 'executeTextMotion',
  'pauseTextMotion', 'resumeTextMotion', 'stopTextMotion',
  'saveTextMotionPlan', 'generateTextMotion', 'clearTextMotion',
  'textMotionIntent', 'textMotionPlan', 'textMotionGraph', 'textMotionExecution',
]) {
  assert.ok(html.includes(`id="${id}"`), `panel is missing #${id}`);
}
assert.ok(html.includes('Human Motion Intelligence'));
assert.ok(html.includes('二战空军基地示例'));
assert.ok(html.includes('salute_right'));
assert.ok(html.includes('执行状态'));
assert.ok(html.includes('飞行员'));

const unsafeState = createDefaultState();
unsafeState.character.animation.textMotion = { lastCommand: '<script>alert(1)</script>' };
const safeHtml = renderTextMotionPanel(unsafeState);
assert.ok(safeHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
assert.ok(!safeHtml.includes('<script>alert(1)</script>'));

const animationModuleSource = await readFile(new URL('../src/modules/animation/index.js', import.meta.url), 'utf8');
assert.ok(animationModuleSource.indexOf('renderTextMotionPanel(state)') < animationModuleSource.indexOf("controlSection('动画片段与播放'"), 'Text Motion panel must render before clip controls');

console.log('PASS Text Motion panel controls, saved-plan rendering, status/graph placeholders, escaping, and early Animation module placement');
