import { bindToggle, controlSection, rangeControl, toggleControl } from '../../workspace-common.js';

const SKIN_BUILD_ID = 'skin-v002-single-surface-guard';

export function renderControls(context, state) {
  const display = state.character.display;
  context.elements.moduleControls.innerHTML =
    controlSection('表皮显示', `
      ${toggleControl('skinVisibleToggle', '显示人物表皮', display.skinVisible)}
      ${toggleControl('skeletonVisibleToggle', '显示内部骨架', display.skeletonVisible)}
      ${rangeControl('skinOpacityControl', '表皮透明度', .2, 1, .01, display.skinOpacity, '')}
      <div class="control-row"><label for="surfaceMode">表皮模式</label><select id="surfaceMode"><option value="solid">实体</option><option value="translucent">半透明</option><option value="wireframe">线框检查</option></select></div>`) +
    controlSection('SKIN V002 唯一预绑定表皮', `
      <div class="toggle-row"><span>当前构建</span><b style="font-size:9px;color:#63dda5">${SKIN_BUILD_ID}</b></div>
      <div class="toggle-row"><span>渲染人体网格</span><b style="font-size:9px;color:#63dda5">原生 SkinnedMesh · 1 套</b></div>
      <div class="toggle-row"><span>鼠标拾取来源</span><b style="font-size:9px">同一蒙皮网格</b></div>
      <div class="toggle-row"><span>全场景重复表皮守卫</span><b style="font-size:9px;color:#63dda5">已启用</b></div>
      <p class="control-note">同一个预绑定 GLB 同时承担显示、三角面拾取和 GPU 蒙皮变形。运行时会扫描整个 Three.js 场景并移除历史程序化人体、旧静态人体和隐藏拾取壳。</p>
      <div class="control-button-grid"><button class="control-button" id="verifySkinBuild">先验证 V002 构建</button><button class="control-button" id="openLegacySkin">打开统一人物视口</button><button class="control-button" id="reloadSurface">重新加载预绑定表皮</button></div>`) +
    controlSection('绑定质量', `
      <div class="toggle-row"><span>原生顶点通道</span><b style="font-size:9px;color:#63dda5">JOINTS_0 / WEIGHTS_0</b></div>
      <div class="toggle-row"><span>逆绑定矩阵</span><b style="font-size:9px;color:#63dda5">24 × MAT4</b></div>
      <div class="toggle-row"><span>每顶点最多影响</span><b style="font-size:9px">4 骨骼</b></div>
      <div class="toggle-row"><span>运行时变形</span><b style="font-size:9px">Three.js GPU LBS</b></div>
      <div class="toggle-row"><span>当前权重等级</span><b style="font-size:9px;color:#ffc36b">过渡实验</b></div>
      <p class="control-note">管线结构已经迁移到标准预绑定 GLB。当前权重用于工程验证，正式人物资产仍需接入许可明确的专业权重和姿势修正形变。</p>`);

  const surfaceMode = document.querySelector('#surfaceMode');
  if (surfaceMode) surfaceMode.value = display.surfaceMode || 'solid';

  bindToggle('skinVisibleToggle', (value) => context.hub.transaction((next) => {
    next.character.display.skinVisible = value;
    if (!value && !next.character.display.skeletonVisible) next.character.display.skeletonVisible = true;
    syncDisplayMode(next);
  }, { module: 'skin', summary: `${value ? '显示' : '隐藏'}人物表皮` }));

  bindToggle('skeletonVisibleToggle', (value) => context.hub.transaction((next) => {
    next.character.display.skeletonVisible = value;
    if (!value && !next.character.display.skinVisible) next.character.display.skinVisible = true;
    syncDisplayMode(next);
  }, { module: 'skin', summary: `${value ? '显示' : '隐藏'}内部骨架` }));

  const opacity = document.querySelector('#skinOpacityControl');
  opacity?.addEventListener('input', () => { document.querySelector('#skinOpacityControlOutput').value = opacity.value; });
  opacity?.addEventListener('change', () => context.hub.transaction((next) => {
    next.character.display.skinOpacity = Number(opacity.value);
  }, { module: 'skin', summary: `表皮透明度调整为 ${opacity.value}` }));

  surfaceMode?.addEventListener('change', () => context.hub.transaction((next) => {
    next.character.display.surfaceMode = surfaceMode.value;
  }, { module: 'skin', summary: `表皮模式切换为 ${surfaceMode.value}` }));

  document.querySelector('#verifySkinBuild')?.addEventListener('click', () => {
    window.open(new URL('./verify.html', import.meta.url).href, '_blank', 'noopener,noreferrer');
  });
  document.querySelector('#openLegacySkin')?.addEventListener('click', () => context.showLegacy({ surfaceSource: 'detail', skinBuild: SKIN_BUILD_ID }));
  document.querySelector('#reloadSurface')?.addEventListener('click', () => context.hub.transaction((next) => {
    next.character.skin.source = 'detail';
    next.character.skin.activeSource = 'detail';
    next.character.skin.singleLayer = true;
    next.character.skin.reloadToken += 1;
    next.modules.skin.status = 'testing';
    next.modules.skin.statusLabel = '内部测试';
    next.modules.skin.currentTask = '重新执行 V002 全场景单表皮审计，并检查原生 SkinnedMesh、直接拾取与肩髋变形';
  }, { module: 'skin', summary: '请求重新加载唯一精细人物表皮' }));
}

function syncDisplayMode(state) {
  const display = state.character.display;
  display.mode = display.skinVisible && display.skeletonVisible ? 'both' : display.skinVisible ? 'skin' : 'skeleton';
}

export function exportData(state) {
  return { display: structuredClone(state.character.display), skin: structuredClone(state.character.skin) };
}

export function resetData(state, defaults) {
  state.character.display = structuredClone(defaults.character.display);
  state.character.skin = structuredClone(defaults.character.skin);
}

export function publishData(state, version) {
  state.modules.skin.version = version;
  state.modules.skin.status = 'published';
  state.modules.skin.statusLabel = '已发布';
  state.modules.skin.progress = Math.max(state.modules.skin.progress, 82);
  state.modules.skin.currentTask = '等待通过 V002 构建验证页完成单表皮实机审查，并继续检查肩、髋、肘和膝变形';
  state.modules.skin.compatibleRig = state.activeVersions.rig;
  state.activeVersions.skin = version;
}
