import { ProjectHubClient, downloadJson, readJsonFile } from './project-hub.js';
import { BUILD_VERSION, SCHEMA_VERSION } from './default-state.js';
import { HumanoidPreview } from './humanoid-preview.js';

const hub = new ProjectHubClient({ module: 'dashboard', title: '项目总控' });
const preview = new HumanoidPreview(document.querySelector('#dashboardPreview'));
const moduleOrder = ['proportion', 'skin', 'pose', 'animation'];
const moduleIcons = { proportion: 'R', skin: 'S', pose: 'P', animation: 'A', clothing: 'C', system: '•', integration: 'I' };
let currentState = hub.getState();
let visibleActivity = true;

const elements = {
  syncPill: document.querySelector('#syncPill'),
  projectName: document.querySelector('#projectName'),
  buildVersion: document.querySelector('#buildVersion'),
  revisionValue: document.querySelector('#revisionValue'),
  windowCount: document.querySelector('#windowCount'),
  transportValue: document.querySelector('#transportValue'),
  versionList: document.querySelector('#versionList'),
  moduleGrid: document.querySelector('#moduleGrid'),
  lastUpdate: document.querySelector('#lastUpdate'),
  overallProgress: document.querySelector('#overallProgress'),
  activityList: document.querySelector('#activityList'),
  compatibilityStrip: document.querySelector('#compatibilityStrip'),
  previewPoseName: document.querySelector('#previewPoseName'),
  previewBackend: document.querySelector('#previewBackend'),
  displayModes: document.querySelector('#dashboardDisplayModes'),
  reviewDialog: document.querySelector('#reviewDialog'),
  reviewForm: document.querySelector('#reviewForm'),
  reviewModule: document.querySelector('#reviewModule'),
  reviewVerdict: document.querySelector('#reviewVerdict'),
  reviewText: document.querySelector('#reviewText'),
  reviewIncludeState: document.querySelector('#reviewIncludeState')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function relativeTime(iso) {
  const time = Date.parse(iso || 0);
  if (!time) return '未知时间';
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 15) return '刚刚';
  if (seconds < 60) return `${seconds} 秒前`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} 小时前`;
  return new Date(time).toLocaleString('zh-CN');
}

function moduleCard(module, moduleRevision) {
  const blockers = module.blockers?.length || 0;
  return `
    <article class="module-card" style="--module-color:${module.color};--progress:${module.progress}%">
      <div class="module-card-header">
        <div><div class="eyebrow">${escapeHtml(module.id.toUpperCase())}</div><h3>${escapeHtml(module.title)}</h3></div>
        <span class="status-chip">${escapeHtml(module.statusLabel)}</span>
      </div>
      <div class="module-progress-row"><span>${module.completed} / ${module.total} 项</span><strong>${module.progress}%</strong></div>
      <div class="progress-track"><i></i></div>
      <div class="module-task"><span>当前任务</span><p>${escapeHtml(module.currentTask)}</p></div>
      <div class="module-stats">
        <div><strong>${module.passed}</strong><span>测试通过</span></div>
        <div><strong>${module.failed}</strong><span>测试失败</span></div>
        <div><strong>${blockers}</strong><span>阻塞问题</span></div>
      </div>
      <div class="module-card-footer"><code>${escapeHtml(module.version)} · m${moduleRevision}</code><button class="module-open" data-open-module="${module.id}" type="button">打开工作台</button></div>
    </article>`;
}

function renderVersions(state) {
  const labels = { rig: '骨架', skin: '蒙皮', pose: '动作', animation: '动画', clothing: '服装', appearance: '外观', generator: '人物生成', character: '人物组合' };
  elements.versionList.innerHTML = Object.entries(state.activeVersions)
    .map(([key, value]) => `<div class="version-item"><span>${labels[key] || key}</span><code>${escapeHtml(value)}</code></div>`)
    .join('');
}

function renderModules(state) {
  elements.moduleGrid.innerHTML = moduleOrder.map((id) => moduleCard(state.modules[id], state.moduleRevisions?.[id] || 1)).join('');
  elements.moduleGrid.querySelectorAll('[data-open-module]').forEach((button) => {
    button.addEventListener('click', () => openModule(button.dataset.openModule));
  });
}

function renderActivity(state) {
  if (!visibleActivity) {
    elements.activityList.innerHTML = '<div class="activity-item"><div class="activity-icon">·</div><div><p>活动记录已在当前页面隐藏。</p><small>项目数据没有删除</small></div></div>';
    return;
  }
  const activity = state.activity || [];
  elements.activityList.innerHTML = activity.length
    ? activity.slice(0, 30).map((item) => `
      <div class="activity-item">
        <div class="activity-icon">${escapeHtml(moduleIcons[item.module] || '•')}</div>
        <div><p>${escapeHtml(item.summary)}</p><small>${escapeHtml(item.module)} · ${relativeTime(item.at)}</small></div>
      </div>`).join('')
    : '<div class="activity-item"><div class="activity-icon">·</div><div><p>暂无操作记录</p><small>修改任一模块后会自动记录</small></div></div>';
}

function renderCompatibility(state) {
  const items = [
    ['骨架协议', state.activeVersions.rig],
    ['表皮兼容', state.modules.skin.compatibleRig === state.activeVersions.rig ? '通过' : '待迁移'],
    ['动作兼容', state.modules.pose.compatibleRig === state.activeVersions.rig ? '通过' : '待迁移'],
    ['动画兼容', state.modules.animation.compatibleRig === state.activeVersions.rig ? '通过' : '待迁移'],
    ['多窗口', hub.transport]
  ];
  elements.compatibilityStrip.innerHTML = items.map(([label, value]) => `<span class="compatibility-item"><i></i><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`).join('');
}

function renderDisplayMode(state) {
  elements.displayModes.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === state.character.display.mode);
  });
}

function render(state) {
  currentState = state;
  elements.projectName.textContent = state.projectName;
  elements.buildVersion.textContent = state.build.version;
  elements.revisionValue.textContent = String(state.revision);
  elements.transportValue.textContent = hub.transport;
  elements.lastUpdate.textContent = `最近更新 ${relativeTime(state.updatedAt)}`;
  const average = Math.round(moduleOrder.reduce((sum, id) => sum + Number(state.modules[id].progress || 0), 0) / moduleOrder.length);
  elements.overallProgress.textContent = `${average}%`;
  elements.previewPoseName.textContent = state.character.pose.name;
  elements.previewBackend.textContent = `${hub.transport} · revision ${state.revision}`;
  renderVersions(state);
  renderModules(state);
  renderActivity(state);
  renderCompatibility(state);
  renderDisplayMode(state);
  preview.setState(state);
}

function openModule(module) {
  const url = new URL('./studio.html', location.href);
  url.searchParams.set('module', module);
  window.open(url, `humanoid-rig-${module}`, 'popup=no,width=1480,height=940');
}

function setDisplayMode(mode) {
  hub.transaction((state) => {
    state.character.display.mode = mode;
    state.character.display.skinVisible = mode === 'skin' || mode === 'both';
    state.character.display.skeletonVisible = mode === 'skeleton' || mode === 'both';
  }, { module: 'integration', summary: `总控预览切换为${mode === 'skin' ? '表皮' : mode === 'skeleton' ? '骨架' : '同时'}模式` });
}

elements.displayModes.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-mode]');
  if (button) setDisplayMode(button.dataset.mode);
});

document.querySelector('#openAllButton').addEventListener('click', () => {
  moduleOrder.forEach((module, index) => setTimeout(() => openModule(module), index * 120));
});

document.querySelector('#reviewButton').addEventListener('click', () => {
  elements.reviewDialog.showModal();
});

elements.reviewForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = elements.reviewText.value.trim();
  if (!text) {
    elements.reviewText.focus();
    return;
  }
  const review = {
    id: crypto.randomUUID(),
    module: elements.reviewModule.value,
    verdict: elements.reviewVerdict.value,
    text,
    createdAt: new Date().toISOString(),
    buildVersion: currentState.build.version,
    revision: currentState.revision,
    activeVersions: structuredClone(currentState.activeVersions)
  };
  hub.transaction((state) => {
    state.reviews = [review, ...(state.reviews || [])].slice(0, 100);
  }, { module: 'integration', summary: `新增${review.module}审查记录：${review.verdict}` });

  const bundle = {
    type: 'humanoid-rig-review-bundle',
    schemaVersion: SCHEMA_VERSION,
    review,
    state: elements.reviewIncludeState.checked ? currentState : undefined,
    environment: {
      userAgent: navigator.userAgent,
      url: location.href,
      transport: hub.transport,
      generatedAt: new Date().toISOString()
    }
  };
  downloadJson(`review-${review.module}-${Date.now()}.json`, bundle);
  elements.reviewText.value = '';
  elements.reviewDialog.close();
});

document.querySelector('#exportProjectButton').addEventListener('click', () => {
  downloadJson(`humanoid-rig-project-r${currentState.revision}.json`, currentState);
});

document.querySelector('#importProjectInput').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const state = await readJsonFile(file);
    if (!Number.isInteger(Number(state?.schemaVersion)) || Number(state.schemaVersion) < 1 || Number(state.schemaVersion) > SCHEMA_VERSION || !state?.projectId) {
      throw new Error('项目 JSON 格式不正确');
    }
    hub.replaceState(state, `导入项目文件 ${file.name}`);
  } catch (error) {
    alert(`导入失败：${error.message}`);
  } finally {
    event.target.value = '';
  }
});

document.querySelector('#resetProjectButton').addEventListener('click', () => {
  if (confirm('确定将浏览器中的项目状态恢复为 V0.2 默认状态吗？')) hub.reset();
});

document.querySelector('#clearActivityButton').addEventListener('click', () => {
  visibleActivity = !visibleActivity;
  document.querySelector('#clearActivityButton').textContent = visibleActivity ? '清理显示' : '恢复显示';
  renderActivity(currentState);
});

hub.addEventListener('presence', (event) => {
  elements.windowCount.textContent = String(Math.max(1, event.detail.length));
});

hub.subscribe(render);

elements.syncPill.querySelector('b').textContent = hub.connected ? `已连接 · ${hub.transport}` : '仅本窗口';
elements.syncPill.classList.toggle('offline', !hub.connected);

window.__humanoidRigLab = {
  getState: () => hub.getState(),
  openModule,
  exportState: () => downloadJson(`humanoid-rig-project-r${currentState.revision}.json`, currentState),
  reset: () => hub.reset()
};
