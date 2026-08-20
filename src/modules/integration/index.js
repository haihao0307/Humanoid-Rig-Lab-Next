import { SCHEMA_VERSION } from '../../default-state.js';
import { controlSection, escapeHtml } from '../../workspace-common.js';
import { downloadJson } from '../../project-hub.js';

export function renderControls(context, state) {
  context.elements.moduleControls.innerHTML =
    controlSection('预览来源', `
      <div class="control-button-grid"><button class="control-button active" id="unifiedPreviewButton">统一三维人物</button><button class="control-button" id="fallbackPreviewButton">轻量后备预览</button></div>
      <p class="control-note">所有模块默认使用同一个 V8.4 统一三维人物视口。轻量预览只在三维运行库故障时使用。</p>`) +
    controlSection('兼容组合', `
      <div class="toggle-row"><span>骨架</span><b style="font-size:9px">${escapeHtml(state.activeVersions.rig)}</b></div>
      <div class="toggle-row"><span>蒙皮</span><b style="font-size:9px">${escapeHtml(state.activeVersions.skin)}</b></div>
      <div class="toggle-row"><span>动作</span><b style="font-size:9px">${escapeHtml(state.activeVersions.pose)}</b></div>
      <div class="toggle-row"><span>动画</span><b style="font-size:9px">${escapeHtml(state.activeVersions.animation)}</b></div>`) +
    controlSection('集成操作', `<div class="control-button-grid"><button class="control-button" id="exportReviewSnapshot">导出集成快照</button><button class="control-button" id="openLegacyWindow">全屏打开 V8.4</button></div>`);

  document.querySelector('#unifiedPreviewButton')?.addEventListener('click', () => context.showLegacy({ surfaceSource: 'detail' }));
  document.querySelector('#fallbackPreviewButton')?.addEventListener('click', context.hideLegacy);
  document.querySelector('#openLegacyWindow')?.addEventListener('click', () => {
    const url = new URL('./legacy/v8/index.html', location.href);
    url.searchParams.set('surfaceSource', 'detail');
    window.open(url, 'humanoid-rig-v8-2', 'width=1500,height=940');
  });
  document.querySelector('#exportReviewSnapshot')?.addEventListener('click', () => downloadJson(`integration-snapshot-r${state.revision}.json`, {
    type: 'IntegrationSnapshot', schemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), state,
  }));
}

export function exportData(state) {
  return { activeVersions: structuredClone(state.activeVersions), modules: structuredClone(state.modules) };
}

export function resetData(state, defaults) {
  state.activeVersions = structuredClone(defaults.activeVersions);
  state.character.display = structuredClone(defaults.character.display);
}

export function publishData(state, version) {
  state.activeVersions.character = version;
}
