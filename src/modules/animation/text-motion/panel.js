import { controlSection, escapeHtml } from '../../../workspace-common.js';
import { createActorMotionContext } from '../../../human-motion/intelligence/actor-motion-context.js';
import { executionDisplayStatus } from '../../../human-motion/intelligence/motion-intelligence-diagnostics.js';
import { createWWIIAirbaseActorContext, createWWIIAirbaseWorldContext } from '../../../human-motion/intelligence/wwii-airbase-context.js';
import { RelativeWorldContextAdapter } from '../../../human-motion/world/world-context.js';
import {
  commitTextMotion,
  executeTextMotion,
  parseAndPlanTextMotion,
  previewTextMotion,
  saveTextMotionPlan,
} from './executor.js';
import { DEMO_MOTION_COMMANDS } from './parser.js';

const OCCUPATIONS = Object.freeze([
  ['civilian', '默认人物'],
  ['pilot', '飞行员'],
  ['aircraft_mechanic', '地勤机械师'],
  ['commander', '指挥员'],
  ['guard', '警卫'],
  ['radio_operator', '通讯员'],
  ['ground_crew', '地勤人员'],
]);

const QUICK_EXAMPLES = Object.freeze([
  ...DEMO_MOTION_COMMANDS.map((value) => [value, value]),
  ['慢慢向前走两米，同时向右观察。', '慢慢向前走两米，同时向右观察。'],
  ['用左手指向右前方。', '用左手指向右前方。'],
  ['Walk three steps then salute with the right hand.', 'Walk three steps then salute with the right hand.'],
]);

export function renderTextMotionPanel(state) {
  const last = state.character?.animation?.textMotion || {};
  const savedActor = last.actorContext || {};
  const command = String(last.lastCommand || QUICK_EXAMPLES[0][1]);
  const occupation = String(savedActor.occupation?.id || 'civilian');
  const dominantSide = savedActor.dominantSide === 'left' ? 'left' : 'right';
  const equipment = (savedActor.equipment || []).map((item) => item.type || item.id).filter(Boolean).join(', ');
  const examples = QUICK_EXAMPLES.map(([label, value]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
  const occupations = OCCUPATIONS.map(([value, label]) => `<option value="${value}"${value === occupation ? ' selected' : ''}>${label}</option>`).join('');
  return controlSection('Human Motion Intelligence', `
    <div class="text-motion-panel" data-text-motion-panel>
      <textarea id="textMotionInput" rows="3" placeholder="输入中文或基础英文动作，例如：向前走三步后敬礼">${escapeHtml(command)}</textarea>
      <div class="control-row"><label for="textMotionExample">快速示例</label><select id="textMotionExample"><option value="">选择示例</option>${examples}</select></div>
      <div class="control-row"><label for="textMotionOccupation">角色职业</label><select id="textMotionOccupation">${occupations}</select></div>
      <div class="control-row"><label for="textMotionDominantSide">主手</label><select id="textMotionDominantSide"><option value="right"${dominantSide === 'right' ? ' selected' : ''}>右手</option><option value="left"${dominantSide === 'left' ? ' selected' : ''}>左手</option></select></div>
      <div class="control-row"><label for="textMotionEquipment">当前装备</label><input id="textMotionEquipment" type="text" value="${escapeHtml(equipment)}" placeholder="例如：toolbox, radio"></div>
      <div class="control-row"><label for="textMotionWorldMode">世界上下文</label><select id="textMotionWorldMode"><option value="relative">相对方向预览</option><option value="wwii_airbase">二战空军基地示例</option></select></div>
      <div class="control-button-grid">
        <button class="control-button" id="parseTextMotion">解析</button>
        <button class="control-button" id="planTextMotion">生成计划</button>
        <button class="control-button" id="previewTextMotion">预览</button>
        <button class="control-button" id="executeTextMotion">执行</button>
      </div>
      <div class="control-button-grid">
        <button class="control-button" id="pauseTextMotion">暂停</button>
        <button class="control-button" id="resumeTextMotion">继续</button>
        <button class="control-button" id="stopTextMotion">停止</button>
      </div>
      <div class="control-button-grid">
        <button class="control-button" id="saveTextMotionPlan">保存计划</button>
        <button class="control-button" id="generateTextMotion">生成并保存动作</button>
        <button class="control-button" id="clearTextMotion">清空</button>
      </div>
      <p class="control-note" id="textMotionStatus">${escapeHtml(last.parseStatus ? `上次状态：${last.parseStatus}` : '输入命令后可解析、规划、预览或执行。')}</p>
      <div class="metric-list compact-metrics" id="textMotionIntent">${renderIntentMetrics(last.intent)}</div>
      <div class="metric-list compact-metrics" id="textMotionPlan">${renderPlanMetrics(last.plan, last.generatedClipId)}</div>
      <div class="metric-list compact-metrics" id="textMotionGraph">${renderGraphMetrics(last.skillGraph)}</div>
      <div class="metric-list compact-metrics" id="textMotionExecution">${renderExecutionMetrics(last.executionSession)}</div>
    </div>`);
}

export function bindTextMotionPanel(context, {
  onPreview = () => {},
  onExecutionFrame = () => {},
  onStop = () => {},
} = {}) {
  const root = context.elements.moduleControls;
  if (!root || root.dataset.textMotionBound === 'true') return;
  const input = root.querySelector('#textMotionInput');
  const example = root.querySelector('#textMotionExample');
  const status = root.querySelector('#textMotionStatus');
  let latest = null;
  let scheduler = null;
  let executionFrame = null;
  let lastExecutionTimestamp = null;

  const optionsForRequest = () => {
    const state = context.getState();
    const occupation = String(root.querySelector('#textMotionOccupation')?.value || 'civilian');
    const dominantSide = root.querySelector('#textMotionDominantSide')?.value === 'left' ? 'left' : 'right';
    const equipment = parseEquipment(root.querySelector('#textMotionEquipment')?.value || '');
    const worldMode = root.querySelector('#textMotionWorldMode')?.value || 'relative';
    const actorContext = worldMode === 'wwii_airbase' && occupation !== 'civilian'
      ? createWWIIAirbaseActorContext(occupation, { dominantSide, equipment })
      : createActorMotionContext({
        actorId: 'actor_default',
        characterId: state.characterCore?.active_character_id || 'character_001',
        occupation: { id: occupation, label: occupation },
        dominantSide,
        equipment,
        metadata: { source: 'text-motion-panel' },
      });
    return {
      actorContext,
      worldContext: worldMode === 'wwii_airbase' ? createWWIIAirbaseWorldContext() : new RelativeWorldContextAdapter(),
    };
  };

  const command = () => String(input?.value || '').trim();
  const render = (result) => {
    latest = result;
    renderTextMotionResult(root, result);
  };
  const parse = () => {
    const text = command();
    if (!text) return render({ status: 'empty', warnings: ['EMPTY_COMMAND'] });
    const result = parseAndPlanTextMotion(text, { state: context.getState(), ...optionsForRequest() });
    return render({
      status: result.plan.status,
      ...result,
      warnings: uniqueStrings([...(result.intent.warnings || []), ...(result.plan.warnings || [])]),
    });
  };
  const preview = () => {
    const text = command();
    if (!text) return render({ status: 'empty', warnings: ['EMPTY_COMMAND'] });
    const result = previewTextMotion(text, { state: context.getState(), ...optionsForRequest() });
    render(result);
    if (result.clip) onPreview(result);
    return result;
  };
  const stopExecutionLoop = () => {
    if (executionFrame != null && typeof globalThis.cancelAnimationFrame === 'function') globalThis.cancelAnimationFrame(executionFrame);
    executionFrame = null;
    lastExecutionTimestamp = null;
  };
  const scheduleExecutionLoop = () => {
    if (!scheduler || typeof globalThis.requestAnimationFrame !== 'function') return;
    executionFrame = globalThis.requestAnimationFrame((timestamp) => {
      const delta = lastExecutionTimestamp == null ? 0 : Math.max(0, (timestamp - lastExecutionTimestamp) / 1000);
      lastExecutionTimestamp = timestamp;
      const snapshot = scheduler.update(delta);
      const frameResult = snapshotToPanelResult(snapshot, latest);
      render(frameResult);
      if (frameResult.clip) onExecutionFrame(frameResult, snapshot.session.elapsed);
      if (['running', 'recovering'].includes(snapshot.session.status)) scheduleExecutionLoop();
      else stopExecutionLoop();
    });
  };
  const execute = () => {
    const text = command();
    if (!text) return render({ status: 'empty', warnings: ['EMPTY_COMMAND'] });
    stopExecutionLoop();
    const result = executeTextMotion(text, { state: context.getState(), ...optionsForRequest() });
    scheduler = result.scheduler;
    render(result);
    if (result.clip) {
      onPreview(result);
      onExecutionFrame(result, 0);
    }
    if (['running', 'recovering'].includes(result.session.status)) scheduleExecutionLoop();
    return result;
  };

  example?.addEventListener('change', () => {
    if (example.value && input) input.value = example.value;
  });
  root.querySelector('#parseTextMotion')?.addEventListener('click', parse);
  root.querySelector('#planTextMotion')?.addEventListener('click', parse);
  root.querySelector('#previewTextMotion')?.addEventListener('click', preview);
  root.querySelector('#executeTextMotion')?.addEventListener('click', execute);
  root.querySelector('#pauseTextMotion')?.addEventListener('click', () => {
    if (scheduler) render(snapshotToPanelResult(scheduler.pause(), latest));
    stopExecutionLoop();
  });
  root.querySelector('#resumeTextMotion')?.addEventListener('click', () => {
    if (scheduler) {
      const snapshot = scheduler.resume();
      render(snapshotToPanelResult(snapshot, latest));
      if (snapshot.session.status === 'running') scheduleExecutionLoop();
    }
  });
  root.querySelector('#stopTextMotion')?.addEventListener('click', () => {
    if (scheduler) render(snapshotToPanelResult(scheduler.cancel(), latest));
    stopExecutionLoop();
    onStop();
  });
  root.querySelector('#saveTextMotionPlan')?.addEventListener('click', () => {
    const text = command();
    if (!text) return render({ status: 'empty', warnings: ['EMPTY_COMMAND'] });
    try {
      render(saveTextMotionPlan(context.hub, text, optionsForRequest()));
    } catch (error) {
      render({ status: 'error', warnings: [String(error?.message || error)] });
    }
  });
  root.querySelector('#generateTextMotion')?.addEventListener('click', () => {
    const text = command();
    if (!text) return render({ status: 'empty', warnings: ['EMPTY_COMMAND'] });
    try {
      const result = commitTextMotion(context.hub, text, optionsForRequest());
      render(result);
      if (result.clip) onPreview(result);
    } catch (error) {
      render({ status: 'error', warnings: [String(error?.message || error)] });
    }
  });
  root.querySelector('#clearTextMotion')?.addEventListener('click', () => {
    stopExecutionLoop();
    scheduler?.dispose?.();
    scheduler = null;
    if (input) input.value = '';
    render({ status: 'empty', warnings: [] });
  });
  root.dataset.textMotionBound = 'true';

  function renderTextMotionResult(panelRoot, result) {
    const panel = panelRoot.querySelector('[data-text-motion-panel]');
    const resultStatus = result?.executionSession ? executionDisplayStatus(result.executionSession) : (result?.status || 'empty');
    const label = statusLabel(resultStatus);
    const warnings = uniqueStrings(result?.warnings || []);
    if (status) status.textContent = `${label}${warnings.length ? ` · ${warnings.join('，')}` : ''}`;
    const intentRoot = panelRoot.querySelector('#textMotionIntent');
    const planRoot = panelRoot.querySelector('#textMotionPlan');
    const graphRoot = panelRoot.querySelector('#textMotionGraph');
    const executionRoot = panelRoot.querySelector('#textMotionExecution');
    if (intentRoot) intentRoot.innerHTML = renderIntentMetrics(result?.intent);
    if (planRoot) planRoot.innerHTML = renderPlanMetrics(result?.plan, result?.clip?.clipId || result?.generatedClipId);
    if (graphRoot) graphRoot.innerHTML = renderGraphMetrics(result?.skillGraph);
    if (executionRoot) executionRoot.innerHTML = renderExecutionMetrics(result?.executionSession);
    if (panel) panel.dataset.textMotionLocalResult = 'true';
  }
}

export function syncTextMotionPanelDom(context, animation) {
  const root = context.elements.moduleControls;
  const panel = root?.querySelector('[data-text-motion-panel]');
  if (!panel || panel.dataset.textMotionLocalResult === 'true') return;
  const saved = animation?.textMotion;
  if (!saved) return;
  const status = panel.querySelector('#textMotionStatus');
  const intentRoot = panel.querySelector('#textMotionIntent');
  const planRoot = panel.querySelector('#textMotionPlan');
  const graphRoot = panel.querySelector('#textMotionGraph');
  const executionRoot = panel.querySelector('#textMotionExecution');
  if (status) status.textContent = `已保存：${saved.parseStatus || 'ready'} · ${saved.generatedClipId || '计划尚未生成片段'}`;
  if (intentRoot) intentRoot.innerHTML = renderIntentMetrics(saved.intent);
  if (planRoot) planRoot.innerHTML = renderPlanMetrics(saved.plan, saved.generatedClipId);
  if (graphRoot) graphRoot.innerHTML = renderGraphMetrics(saved.skillGraph);
  if (executionRoot) executionRoot.innerHTML = renderExecutionMetrics(saved.executionSession);
}

function snapshotToPanelResult(snapshot, previous) {
  return {
    ...(previous || {}),
    plan: snapshot.plan,
    skillGraph: snapshot.skillGraph,
    executionSession: snapshot.session,
    status: executionDisplayStatus(snapshot.session),
    clip: snapshot.adapter?.clip || previous?.clip || null,
    warnings: uniqueStrings([...(previous?.warnings || []), ...(snapshot.session?.warnings || [])]),
  };
}

function renderIntentMetrics(intent) {
  return [
    metric('输入动作', intent?.sourceText || '—'),
    metric('语言', intent?.language || '—'),
    metric('职业', intent?.occupationHint || '默认人物'),
    metric('解析动作', (intent?.actions || []).map((action) => action.skillId).join(' → ') || '—'),
    metric('目标', (intent?.targets || []).map((target) => target.name).join('、') || '—'),
    metric('未解析词', (intent?.unresolvedTokens || []).join('、') || '—'),
  ].join('');
}

function renderPlanMetrics(plan, clipId = null) {
  return [
    metric('计划节点', plan?.nodes?.length || plan?.steps?.length || 0),
    metric('语义技能', (plan?.semanticRequiredSkills || plan?.requiredSkills || []).join(' → ') || '—'),
    metric('预估时长', plan ? `${Number(plan.estimatedDuration || 0).toFixed(2)} s` : '—'),
    metric('预估距离', plan ? `${Number(plan.estimatedDistance || 0).toFixed(2)} m` : '—'),
    metric('目标 / 未解析', plan?.unresolvedTargets?.join('、') || '已解析或相对方向'),
    metric('所需求解器', plan?.requiresSolverCapabilities?.join('、') || 'Legacy Animation 可用'),
    metric('生成片段', clipId || '—'),
  ].join('');
}

function renderGraphMetrics(graph) {
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];
  return [
    metric('Skill Graph', nodes.length ? nodes.map((node) => `${node.skillId}[${node.status || 'pending'}]`).join(' → ') : '—'),
    metric('依赖边', edges.length ? edges.map((edge) => `${edge.fromNodeId}→${edge.toNodeId}`).join('；') : '—'),
    metric('并行动作', graph?.parallelGroups?.length ? graph.parallelGroups.map((group) => group.nodeIds?.join(' + ') || group.actionIds?.join(' + ')).join('；') : '—'),
  ].join('');
}

function renderExecutionMetrics(session) {
  const display = executionDisplayStatus(session);
  return [
    metric('执行状态', statusLabel(display)),
    metric('当前节点', session?.currentNodeId || '—'),
    metric('当前技能', (session?.activeSkills || []).join(' + ') || '—'),
    metric('完成 / 失败', `${session?.completedNodeIds?.length || 0} / ${session?.failedNodeIds?.length || 0}`),
    metric('进度', session ? `${Math.round(Number(session.progress || 0) * 100)}%` : '—'),
    metric('恢复状态', session?.recoveryState?.status || '—'),
  ].join('');
}

function parseEquipment(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean).map((type, index) => ({
    id: `ui-equipment-${index + 1}-${type.replace(/[^A-Za-z0-9_-]/g, '_')}`,
    type,
    carriedBy: null,
  }));
}

function statusLabel(status) {
  return {
    ready: '计划就绪',
    running: '正在执行',
    paused: '已暂停',
    completed: '执行完成',
    failed: '执行失败',
    cancelled: '已停止',
    recovering: '正在恢复站立',
    requires_solver: '需要 Whole Body Solver',
    unsupported: '不支持的动作',
    error: '处理失败',
    empty: '等待输入',
  }[String(status || 'empty')] || String(status || 'empty');
}

function metric(label, value) {
  return `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value ?? '—'))}</b></div>`;
}

function uniqueStrings(values) { return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))]; }
