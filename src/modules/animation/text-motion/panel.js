import { controlSection, escapeHtml } from '../../../workspace-common.js';
import { commitTextMotion, previewTextMotion } from './executor.js';
import { DEMO_MOTION_COMMANDS } from './parser.js';

const QUICK_EXAMPLES = Object.freeze([
  ...DEMO_MOTION_COMMANDS.map((value) => [value, value]),
  ['慢慢向前走并向右观察', '慢慢向前走并向右观察'],
  ['用左手指向右前方', '用左手指向右前方'],
  ['Walk three steps then salute with the right hand', 'Walk three steps then salute with the right hand'],
]);

export function renderTextMotionPanel(state) {
  const last = state.character?.animation?.textMotion || {};
  const command = String(last.lastCommand || QUICK_EXAMPLES[0][1]);
  const options = QUICK_EXAMPLES.map(([label, value]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
  return controlSection('文字生成动作', `
    <div class="text-motion-panel" data-text-motion-panel>
      <textarea id="textMotionInput" rows="3" placeholder="输入中文或基础英文动作，例如：向前走三步后敬礼">${escapeHtml(command)}</textarea>
      <div class="control-row"><label for="textMotionExample">快速示例</label><select id="textMotionExample"><option value="">选择示例</option>${options}</select></div>
      <div class="control-button-grid">
        <button class="control-button" id="parseTextMotion">解析</button>
        <button class="control-button" id="previewTextMotion">预览</button>
        <button class="control-button" id="generateTextMotion">生成并保存</button>
        <button class="control-button" id="stopTextMotion">停止预览</button>
      </div>
      <div class="control-button-grid"><button class="control-button" id="clearTextMotion">清空</button></div>
      <p class="control-note" id="textMotionStatus">${escapeHtml(last.parseStatus ? `上次状态：${last.parseStatus}` : '输入命令后先解析，再预览或生成。')}</p>
      <div class="metric-list compact-metrics" id="textMotionPlan"><div><span>动作步骤</span><b>—</b></div><div><span>技能</span><b>—</b></div></div>
    </div>`);
}

export function bindTextMotionPanel(context, {
  onPreview = () => {},
  onStop = () => {},
} = {}) {
  const root = context.elements.moduleControls;
  if (!root || root.dataset.textMotionBound === 'true') return;
  const input = root.querySelector('#textMotionInput');
  const example = root.querySelector('#textMotionExample');
  const status = root.querySelector('#textMotionStatus');
  const planRoot = root.querySelector('#textMotionPlan');
  let latest = null;

  const runPreview = () => {
    const text = String(input?.value || '').trim();
    if (!text) {
      renderResult({ status: 'empty', warnings: ['EMPTY_COMMAND'] });
      return null;
    }
    latest = previewTextMotion(text, { state: context.getState() });
    renderResult(latest);
    if (latest.clip) onPreview(latest);
    return latest;
  };

  example?.addEventListener('change', () => {
    if (example.value && input) input.value = example.value;
  });
  root.querySelector('#parseTextMotion')?.addEventListener('click', runPreview);
  root.querySelector('#previewTextMotion')?.addEventListener('click', runPreview);
  root.querySelector('#generateTextMotion')?.addEventListener('click', () => {
    const text = String(input?.value || '').trim();
    if (!text) {
      renderResult({ status: 'empty', warnings: ['EMPTY_COMMAND'] });
      return;
    }
    try {
      latest = commitTextMotion(context.hub, text);
      renderResult(latest);
      if (latest.clip) onPreview(latest);
    } catch (error) {
      renderResult({ status: 'error', warnings: [String(error?.message || error)] });
    }
  });
  root.querySelector('#stopTextMotion')?.addEventListener('click', () => {
    onStop();
    if (status) status.textContent = '文字动作预览已停止；未修改 AnimationSession。';
  });
  root.querySelector('#clearTextMotion')?.addEventListener('click', () => {
    if (input) input.value = '';
    latest = null;
    renderResult({ status: 'empty', warnings: [] });
  });
  root.dataset.textMotionBound = 'true';

  function renderResult(result) {
    if (!status || !planRoot) return;
    const statusLabel = result?.status || 'empty';
    const warnings = [...new Set(result?.warnings || [])];
    const intent = result?.intent;
    const plan = result?.plan;
    const steps = plan?.steps || [];
    const skills = plan?.requiredSkills || [];
    status.textContent = `${statusLabel === 'ready' ? '可生成' : statusLabel === 'unsupported' ? '不支持' : statusLabel === 'error' ? '生成失败' : '等待输入'}${warnings.length ? ` · ${warnings.join('，')}` : ''}`;
    planRoot.innerHTML = [
      metric('动作步骤', steps.length),
      metric('方向', steps.map((step) => step.parameters?.direction).filter(Boolean).join(' / ') || intent?.direction || '—'),
      metric('侧别', steps.map((step) => step.parameters?.side).filter(Boolean).join(' / ') || intent?.side || '—'),
      metric('距离 / 步数', steps.map((step) => [step.parameters?.distanceMeters, step.parameters?.stepCount].filter((value) => value != null).join(' m / ')).filter(Boolean).join('；') || '—'),
      metric('速度 / 时长', steps.map((step) => [step.parameters?.speed, Number(step.duration || 0).toFixed(2) + ' s'].join(' / ')).join('；') || '—'),
      metric('技能', skills.join(' → ') || '—'),
      metric('目标', plan?.unresolvedTargets?.join('、') || '相对方向 / 未指定'),
      metric('生成片段', result?.clip?.clipId || result?.generatedClipId || '—'),
    ].join('');
  }
}

export function syncTextMotionPanelDom(context, animation) {
  const root = context.elements.moduleControls;
  const panel = root?.querySelector('[data-text-motion-panel]');
  if (!panel) return;
  const state = animation?.textMotion;
  if (!state) return;
  const status = panel.querySelector('#textMotionStatus');
  const planRoot = panel.querySelector('#textMotionPlan');
  if (status && !panel.dataset.textMotionLocalResult) {
    status.textContent = `已保存：${state.parseStatus || 'ready'} · ${state.generatedClipId || '—'}`;
  }
  if (planRoot && !panel.dataset.textMotionLocalResult) {
    planRoot.innerHTML = [
      metric('动作步骤', state.plan?.steps?.length || 0),
      metric('方向', state.plan?.steps?.map((step) => step.parameters?.direction).filter(Boolean).join(' / ') || '—'),
      metric('技能', state.plan?.requiredSkills?.join(' → ') || '—'),
      metric('生成片段', state.generatedClipId || '—'),
    ].join('');
  }
}

function metric(label, value) {
  return `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value ?? '—'))}</b></div>`;
}
