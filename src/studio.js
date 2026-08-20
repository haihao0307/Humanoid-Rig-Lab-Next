import { ProjectHubClient, downloadJson, readJsonFile } from './project-hub.js';
import { BUILD_ID, createDefaultState, SCHEMA_VERSION } from './default-state.js';
import { HumanoidPreview } from './humanoid-preview.js';
import { MODULE_CONFIG, MODULE_ORDER, loadWorkspaceModule, resolveModuleId } from './module-registry.js';
import { bumpPatch, escapeHtml } from './workspace-common.js';

const queryModule = new URLSearchParams(location.search).get('module');
const moduleId = resolveModuleId(queryModule);
const config = MODULE_CONFIG[moduleId];
const workspace = await loadWorkspaceModule(moduleId);
const hub = new ProjectHubClient({ module: moduleId, title: config.title });
let currentState = hub.getState();
let pendingPose = null;
const HOST_PROTOCOL = 'humanoid-rig-lab-next:viewport';
let legacyVisible = true;
let legacySourceKey = '';
let legacyReady = false;
let legacySurfaceState = null;
let legacyRendererState = null;
let legacyProfileMetrics = null;

const elements = {
  moduleSubtitle: document.querySelector('#moduleSubtitle'),
  moduleTabs: document.querySelector('#moduleTabs'),
  syncPill: document.querySelector('#syncPill'),
  moduleEyebrow: document.querySelector('#moduleEyebrow'),
  moduleTitle: document.querySelector('#moduleTitle'),
  moduleDescription: document.querySelector('#moduleDescription'),
  branchName: document.querySelector('#branchName'),
  moduleVersion: document.querySelector('#moduleVersion'),
  rigCompatibility: document.querySelector('#rigCompatibility'),
  moduleControls: document.querySelector('#moduleControls'),
  displayModes: document.querySelector('#displayModes'),
  stageStatus: document.querySelector('#stageStatus'),
  stageRevision: document.querySelector('#stageRevision'),
  stageMetrics: document.querySelector('#stageMetrics'),
  moduleInspector: document.querySelector('#moduleInspector'),
  standardStage: document.querySelector('#standardStage'),
  legacyStage: document.querySelector('#legacyStage'),
  legacyFrame: document.querySelector('#legacyFrame'),
  publishDialog: document.querySelector('#publishDialog'),
  publishForm: document.querySelector('#publishForm'),
  publishVersion: document.querySelector('#publishVersion'),
  publishNotes: document.querySelector('#publishNotes'),
  importModuleInput: document.querySelector('#importModuleInput'),
  interactionHint: document.querySelector('#interactionHint'),
  viewportModeHint: document.querySelector('#viewportModeHint'),
  legacyNote: document.querySelector('#legacyNote'),
};

const preview = new HumanoidPreview(document.querySelector('#studioPreview'), {
  interactive: moduleId === 'pose',
  onPoseChange: (joints, jointId, committed) => {
    pendingPose = structuredClone(joints);
    document.querySelector('#interactionHint').textContent = `正在调整 ${jointId}${committed ? '，已写入动作模块' : ''}`;
    if (!committed) return;
    hub.transaction((state) => {
      state.character.pose.joints = structuredClone(joints);
      state.character.pose.name = 'Custom Pose';
      state.modules.pose.status = 'developing';
      state.modules.pose.statusLabel = '功能开发';
    }, { module: 'pose', summary: `拖动关节 ${jointId}，更新单帧姿势` });
    pendingPose = null;
  },
});

const context = {
  hub,
  moduleId,
  config,
  elements,
  preview,
  getState: () => currentState,
  openPublishDialog,
  showLegacy,
  hideLegacy,
  previewBodyProfile,
  getProfileMetrics: () => legacyProfileMetrics,
};

function setupStaticUi() {
  document.title = `Humanoid Rig Lab Next · ${config.title}`;
  elements.moduleSubtitle.textContent = config.subtitle;
  elements.moduleEyebrow.textContent = config.eyebrow;
  elements.moduleTitle.textContent = config.title;
  elements.moduleDescription.textContent = config.description;
  elements.branchName.textContent = config.branch;
  elements.moduleTabs.innerHTML = MODULE_ORDER
    .map((id) => `<a href="./studio.html?module=${id}" class="${id === moduleId ? 'active' : ''}">${MODULE_CONFIG[id].title}</a>`)
    .join('');
  document.querySelector('#openDashboardButton').addEventListener('click', () => { location.href = './index.html'; });
  elements.standardStage.hidden = true;
  elements.legacyStage.hidden = false;
  legacyVisible = true;
  if (moduleId === 'proportion') {
    const labels = { skin: '表皮参考', skeleton: '3D 骨架', both: '同时' };
    elements.displayModes.querySelectorAll('button[data-mode]').forEach((button) => {
      button.textContent = labels[button.dataset.mode] || button.textContent;
    });
  }
}

function getViewportDisplay(state) {
  if (moduleId === 'proportion') {
    const mode = ['skin', 'skeleton', 'both'].includes(state.character.bodyProfile.viewportMode)
      ? state.character.bodyProfile.viewportMode
      : 'skeleton';
    return {
      ...state.character.display,
      mode,
      skinVisible: mode !== 'skeleton',
      skeletonVisible: mode !== 'skin',
    };
  }
  return state.character.display;
}

function renderDisplayMode(state) {
  const activeMode = getViewportDisplay(state).mode;
  elements.displayModes.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === activeMode);
  });
}

function renderInspector(state) {
  const module = moduleId === 'integration' ? null : state.modules[moduleId];
  const poseLabel = currentPoseLabel(state);
  const reviews = (state.reviews || []).filter((review) => review.module === moduleId || moduleId === 'integration').slice(0, 4);
  const writable = config.writable.map((item) => `<div class="task-item"><i></i><span>${escapeHtml(item)}</span></div>`).join('');
  const blockers = module?.blockers?.length
    ? module.blockers.map((item) => `<div class="blocker-item"><i></i><span>${escapeHtml(item)}</span></div>`).join('')
    : '<div class="task-item"><i></i><span>当前没有登记阻塞问题</span></div>';
  const moduleRevision = state.moduleRevisions[moduleId] || state.moduleRevisions.integration;
  const moduleTime = state.moduleUpdatedAt[moduleId] || state.moduleUpdatedAt.integration;
  elements.moduleInspector.innerHTML = `
    <section class="inspector-card">
      <h3>当前状态</h3>
      <div class="inspector-kv">
        <div><span>全局修订</span><b>r${state.revision}</b></div>
        <div><span>模块修订</span><b>m${moduleRevision}</b></div>
        <div><span>模块更新时间</span><b>${new Date(moduleTime).toLocaleTimeString('zh-CN')}</b></div>
        <div><span>同步方式</span><b>${escapeHtml(hub.transport)}</b></div>
        <div><span>当前姿势</span><b>${escapeHtml(poseLabel)}</b></div>
        <div><span>显示模式</span><b>${escapeHtml(getViewportDisplay(state).mode)}</b></div>
        <div><span>三维渲染</span><b>${escapeHtml(legacyRendererState?.backend || (legacyReady ? '正在初始化' : '连接中'))}</b></div>
        <div><span>表皮来源</span><b>${escapeHtml(state.character.skin.source)}</b></div>
        ${moduleId === 'proportion' ? `<div><span>三维实际身高</span><b>${Number(legacyProfileMetrics?.height || state.character.bodyProfile.height).toFixed(3)} m</b></div><div><span>新表皮绑定</span><b>${state.character.bodyProfile.requiresRebind ? '需要' : '无需'}</b></div>` : ''}
        ${module ? `<div><span>模块进度</span><b>${module.progress}%</b></div><div><span>测试结果</span><b>${module.passed} / ${module.failed}</b></div>` : ''}
      </div>
    </section>
    <section class="inspector-card"><h3>本模块拥有的数据</h3><div class="task-list">${writable}</div></section>
    <section class="inspector-card"><h3>阻塞问题</h3><div class="blocker-list">${blockers}</div></section>
    <section class="inspector-card"><h3>最近审查</h3><div class="review-list">${reviews.length ? reviews.map((review) => `<div class="review-item"><p>${escapeHtml(review.text)}</p><small>${escapeHtml(review.verdict)} · ${new Date(review.createdAt).toLocaleString('zh-CN')}</small></div>`).join('') : '<p>当前模块尚无审查记录。</p>'}</div></section>`;
}

function currentPoseLabel(state) {
  if (moduleId !== 'animation') return state.character.pose.name;
  const animation = state.character?.animation;
  const clips = Array.isArray(animation?.clips) ? animation.clips : [];
  const activeId = String(animation?.activeClipId || animation?.clip || '');
  const clip = clips.find((item) => item?.clipId === activeId) || null;
  if (!clip) return state.character.pose.name;
  return `${clip.name} · ${animation.transport?.playing ? '播放中' : '当前帧'}`;
}

function render(state, detail = {}) {
  currentState = state;
  const module = moduleId === 'integration'
    ? { version: state.activeVersions.character, compatibleRig: state.activeVersions.rig }
    : state.modules[moduleId];
  const moduleRevision = state.moduleRevisions[moduleId] || state.moduleRevisions.integration;
  elements.moduleVersion.textContent = module.version;
  elements.rigCompatibility.textContent = module.compatibleRig;
  elements.stageRevision.textContent = `global r${state.revision} · module m${moduleRevision}`;
  const measuredHeight = Number(legacyProfileMetrics?.height || state.character.bodyProfile.height);
  const measuredShoulder = Number(legacyProfileMetrics?.shoulderWidth || state.character.bodyProfile.shoulderWidth);
  elements.stageMetrics.innerHTML = `<span>三维身高 ${measuredHeight.toFixed(3)} m</span><span>肩宽 ${measuredShoulder.toFixed(3)} m</span><span>姿势 ${escapeHtml(currentPoseLabel(state))}</span><span>视口 ${escapeHtml(getViewportDisplay(state).mode)}</span>`;
  renderDisplayMode(state);
  if (!legacyVisible && !pendingPose) preview.setState(state);
  renderInspector(state);
  if (!legacyVisible) {
    workspace.renderControls(context, state);
    elements.stageStatus.textContent = detail.source && detail.source !== 'initial' ? `已同步 · ${detail.source}` : '轻量后备预览';
  } else {
    refreshLegacySource(state);
    if (moduleId === 'animation') {
      // The animation workspace owns the embedded pose while it previews a clip.
      // For clips with preview data, postStateToLegacy sends only static
      // display/profile data; every paused or playing pose travels through the
      // lightweight animation-frame channel.
      postStateToLegacy(state);
      workspace.renderControls(context, state);
    } else {
      workspace.renderControls(context, state);
      postStateToLegacy(state);
    }
    if (!legacySurfaceState) elements.stageStatus.textContent = legacyReady ? '统一人物视口已连接' : '正在连接统一人物视口';
  }
}

function showLegacy(options = {}) {
  legacyVisible = true;
  elements.standardStage.hidden = true;
  elements.legacyStage.hidden = false;
  refreshLegacySource(currentState, options);
  postStateToLegacy(currentState);
  elements.stageStatus.textContent = legacyReady ? '统一人物视口已连接' : '正在连接统一人物视口';
}

function refreshLegacySource(state, options = {}) {
  const source = 'detail';
  const reload = Number(state.character.skin.reloadToken || 0);
  const readOnly = moduleId === 'pose' ? '0' : '1';
  const key = `${BUILD_ID}:${moduleId}:${readOnly}:${reload}`;
  if (elements.legacyFrame.src && key === legacySourceKey) return;
  const url = new URL('./legacy/v8/index.html', location.href);
  url.searchParams.set('embed', '1');
  url.searchParams.set('hostModule', moduleId);
  url.searchParams.set('readOnly', readOnly);
  url.searchParams.set('surfaceSource', source);
  url.searchParams.set('displayMode', getViewportDisplay(state).mode || 'skeleton');
  url.searchParams.set('view', 'perspective');
  url.searchParams.set('hostReload', String(reload));
  url.searchParams.set('build', BUILD_ID);
  url.searchParams.set('skinBuild', state.character.skin.runtimeBuildId || 'skin-v002-single-surface-guard');
  legacyReady = false;
  legacySurfaceState = null;
  elements.legacyFrame.src = url.href;
  legacySourceKey = key;
}

function hideLegacy() {
  legacyVisible = false;
  elements.standardStage.hidden = false;
  elements.legacyStage.hidden = true;
  elements.stageStatus.textContent = '轻量后备预览';
}


function postStateToLegacy(state = currentState) {
  if (!legacyVisible || !elements.legacyFrame.contentWindow) return;
  const animationOwnsPose = moduleId === 'animation' && hasActiveAnimationPreview(state);
  elements.legacyFrame.contentWindow.postMessage({
    protocol: HOST_PROTOCOL,
    type: 'HRL_HOST_STATE',
    revision: state.revision,
    module: moduleId,
    state: {
      display: structuredClone(getViewportDisplay(state)),
      skin: structuredClone(state.character.skin),
      pose: animationOwnsPose
        ? { name: 'Clip Preview', poseSnapshot: null, v8Payload: null }
        : {
          name: state.character.pose.name,
          poseSnapshot: state.character.pose.poseSnapshot || null,
          v8Payload: state.character.pose.v8Payload || null,
          imagePoseAssetId: state.character.pose.imagePoseAssetId || null,
        },
      physics: structuredClone(state.character.physics),
      bodyProfile: structuredClone(state.character.bodyProfile),
      bodyShape: structuredClone(
        state.bodyShape?.profiles?.[state.bodyShape?.active_profile_id] || null,
      ),
      clothing: structuredClone(
        state.clothingSystem?.profiles?.[state.clothingSystem?.active_profile_id] || null,
      ),
    },
  }, window.location.origin);
}

function hasActiveAnimationPreview(state) {
  const animation = state.character?.animation;
  const clips = Array.isArray(animation?.clips) ? animation.clips : [];
  const activeId = String(animation?.activeClipId || animation?.clip || '');
  const clip = clips.find((item) => item?.clipId === activeId) || clips[0] || null;
  if (!clip) return false;
  const hasTrackKeys = Array.isArray(clip.tracks)
    && clip.tracks.some((track) => Array.isArray(track?.keyframes) && track.keyframes.length > 0);
  return hasTrackKeys || (Array.isArray(clip.poseKeys) && clip.poseKeys.length > 0);
}

function handleLegacyMessage(event) {
  if (event.origin !== window.location.origin || event.source !== elements.legacyFrame.contentWindow) return;
  const message = event.data;
  if (!message || message.protocol !== HOST_PROTOCOL) return;

  if (message.type === 'HRL_EMBED_READY') {
    legacyReady = true;
    elements.interactionHint.textContent = moduleId === 'pose'
      ? '统一人物视口已连接，可以直接拖动表皮、关节或骨杆'
      : '统一人物视口已连接，本模块以只读方式观察同一人物';
    elements.viewportModeHint.textContent = moduleId === 'pose'
      ? '姿势变化会同步到其他三个工作台'
      : '姿势编辑请在动作与物理工作台进行';
    postStateToLegacy(currentState);
    return;
  }

  if (message.type === 'HRL_RENDERER_STATUS') {
    legacyRendererState = message;
    if (message.state === 'ready') {
      elements.stageStatus.textContent = `${message.backend} 三维视口已连接`;
      elements.legacyNote.textContent = moduleId === 'proportion'
        ? '比例控件正在驱动同一个三维绑定骨架，轻量 2D 画布已退出主流程'
        : '统一三维人物视口已连接';
    } else if (message.state === 'error') {
      elements.stageStatus.textContent = '三维运行库加载失败';
      elements.legacyNote.textContent = '请检查 Three.js 本地运行库。当前版本不会把 2D 画布伪装成正式比例编辑器。';
    }
    renderInspector(currentState);
    return;
  }

  if (message.type === 'HRL_PROFILE_STATUS') {
    legacyProfileMetrics = message.metrics || null;
    if (moduleId === 'proportion') {
      elements.stageStatus.textContent = message.preview ? '正在实时预览三维比例' : '三维绑定比例已同步';
      elements.legacyNote.textContent = message.requiresSkinRebind
        ? '骨架比例已经改变，当前表皮仅作参考。生成新绑定版本后由蒙皮模块重新绑定。'
        : '当前比例与参考绑定一致。';
    }
    renderInspector(currentState);
    return;
  }

  if (message.type === 'HRL_SURFACE_STATUS') {
    legacySurfaceState = message.surface || null;
    const label = legacySurfaceState?.label || '人物表皮视口';
    elements.stageStatus.textContent = label;
    const diagnostics = legacySurfaceState?.diagnostics?.layer || legacySurfaceState?.diagnostics;
    const activeSource = diagnostics?.activeSource || diagnostics?.activeVisualSource || currentState.character.skin.activeSource;
    if (activeSource) currentState.character.skin.activeSource = activeSource;
    elements.legacyNote.textContent = legacySurfaceState?.state === 'ready'
      ? '精细表皮已接管 · 基础代理已完全退出渲染 · 当前可见人体 1 层'
      : legacySurfaceState?.detail || '正在准备统一人物表皮';
    return;
  }

  if (message.type === 'HRL_POSE_COMMIT' && moduleId === 'pose' && (message.payload?.joints?.length || message.poseSnapshot)) {
    const incomingStamp = String(message.poseSnapshot?.updatedAt || message.payload?.updatedAt || '');
    const localStamp = String(
      currentState.character.pose.poseSnapshot?.updatedAt
      || currentState.character.pose.v8Payload?.updatedAt
      || '',
    );
    if (incomingStamp && incomingStamp === localStamp) return;
    const previewJoints = message.payload?.joints?.length
      ? convertV8PoseToPreview(message.payload, currentState.character.bodyProfile.height)
      : null;
    hub.transaction((state) => {
      state.character.pose.name = humanPoseLabel(message.poseSnapshot?.name || message.payload?.pose);
      state.character.pose.poseSnapshot = message.poseSnapshot ? structuredClone(message.poseSnapshot) : null;
      state.character.pose.v8Payload = message.payload ? structuredClone(message.payload) : null;
      state.character.pose.imagePoseAssetId = message.poseSnapshot?.imagePoseAssetId
        || message.payload?.imagePoseAssetId
        || state.character.pose.imagePoseAssetId
        || null;
      if (previewJoints) state.character.pose.joints = previewJoints;
      state.modules.pose.status = 'testing';
      state.modules.pose.statusLabel = '局部四元数桥接测试';
      state.modules.pose.currentTask = '统一三维人物视口优先使用 PoseSnapshot，世界坐标姿势保留为兼容回退';
    }, { module: 'pose', summary: `三维人物视口：${message.reason || '更新姿势'}` });
  }
}

function humanPoseLabel(value) {
  const pose = String(value || 'CUSTOM').toUpperCase();
  if (pose === 'A') return 'A Pose';
  if (pose === 'T') return 'T Pose';
  return pose === 'CUSTOM' ? 'Custom Pose' : pose;
}

function convertV8PoseToPreview(payload, height = 1.8) {
  const list = Array.isArray(payload?.joints) ? payload.joints : [];
  if (!list.length) return null;
  const byId = new Map(list.map((item) => [item.id, item.poseWorldPosition]));
  const sourceIds = {
    headTop: 'headTop', head: 'head', neck: 'neck', chest: 'upperChest', spine: 'spine', pelvis: 'hips',
    leftShoulder: 'leftUpperArm', leftElbow: 'leftLowerArm', leftWrist: 'leftHand', leftHand: 'leftHandEnd',
    rightShoulder: 'rightUpperArm', rightElbow: 'rightLowerArm', rightWrist: 'rightHand', rightHand: 'rightHandEnd',
    leftHip: 'leftUpperLeg', leftKnee: 'leftLowerLeg', leftAnkle: 'leftFoot', leftToe: 'leftToesEnd',
    rightHip: 'rightUpperLeg', rightKnee: 'rightLowerLeg', rightAnkle: 'rightFoot', rightToe: 'rightToesEnd',
  };
  const safeHeight = Math.max(0.1, Number(height) || 1.8);
  const result = {};
  for (const [targetId, sourceId] of Object.entries(sourceIds)) {
    const point = byId.get(sourceId);
    if (!point) continue;
    result[targetId] = { x: Number(point.x || 0) / safeHeight, y: Number(point.y || 0) / safeHeight };
  }
  return Object.keys(result).length ? result : null;
}

function previewBodyProfile(bodyProfile) {
  if (!legacyVisible || !elements.legacyFrame.contentWindow) return;
  elements.legacyFrame.contentWindow.postMessage({
    protocol: HOST_PROTOCOL,
    type: 'HRL_PREVIEW_BODY_PROFILE',
    module: moduleId,
    bodyProfile: structuredClone(bodyProfile),
  }, window.location.origin);
}

function openPublishDialog() {
  const currentVersion = moduleId === 'integration' ? currentState.activeVersions.character : currentState.modules[moduleId].version;
  elements.publishVersion.value = bumpPatch(currentVersion);
  elements.publishNotes.value = '';
  elements.publishDialog.showModal();
}

elements.displayModes.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-mode]');
  if (!button) return;
  const mode = button.dataset.mode;
  if (moduleId === 'proportion') {
    hub.transaction((state) => {
      state.character.bodyProfile.viewportMode = mode;
    }, { module: 'proportion', summary: `比例工作台切换为${mode === 'skin' ? '表皮参考' : mode === 'skeleton' ? '三维骨架' : '骨架与表皮参考'}显示` });
    return;
  }
  const owner = moduleId === 'skin' ? 'skin' : 'integration';
  hub.transaction((state) => {
    state.character.display.mode = mode;
    state.character.display.skinVisible = mode !== 'skeleton';
    state.character.display.skeletonVisible = mode !== 'skin';
  }, { module: owner, summary: `${config.title}切换为${mode === 'skin' ? '表皮' : mode === 'skeleton' ? '骨架' : '同时'}显示` });
});

document.querySelector('#resetViewButton').addEventListener('click', () => {
  const defaults = createDefaultState();
  hub.transaction((state) => workspace.resetData(state, defaults), { module: moduleId, summary: `恢复${config.title}默认数据` });
});

document.querySelector('#exportModuleButton').addEventListener('click', () => {
  const bundle = {
    type: 'HumanoidRigModuleBundle',
    schemaVersion: SCHEMA_VERSION,
    module: moduleId,
    moduleRevision: currentState.moduleRevisions[moduleId] || currentState.moduleRevisions.integration,
    compatibleRig: currentState.activeVersions.rig,
    generatedAt: new Date().toISOString(),
    data: workspace.exportData(currentState),
  };
  downloadJson(`${moduleId}-module-m${bundle.moduleRevision}.json`, bundle);
});

elements.importModuleInput?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const bundle = await readJsonFile(file);
    hub.importModuleBundle(bundle, moduleId);
    elements.stageStatus.textContent = `已导入 ${file.name}`;
  } catch (error) {
    alert(`导入模块更新包失败：${error.message}`);
  }
});

document.querySelector('#publishButton').addEventListener('click', openPublishDialog);

elements.publishForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const version = elements.publishVersion.value.trim();
  if (!version) return;
  const notes = elements.publishNotes.value.trim() || '发布模块快照';
  hub.transaction((state) => workspace.publishData(state, version, notes), {
    module: moduleId,
    summary: `${config.title}发布 ${version}：${notes}`,
  });
  elements.publishDialog.close();
});

elements.legacyFrame.addEventListener('load', () => {
  legacyReady = true;
  legacyRendererState = null;
  elements.stageStatus.textContent = '统一人物视口正在初始化';
  postStateToLegacy(currentState);
  if (moduleId === 'animation') workspace.renderControls(context, currentState);
});
window.addEventListener('message', handleLegacyMessage);
setupStaticUi();
hub.subscribe(render);
elements.syncPill.querySelector('b').textContent = hub.connected ? `已连接 · ${hub.transport}` : '仅本窗口';
elements.syncPill.classList.toggle('offline', !hub.connected);

window.__humanoidRigStudio = {
  module: moduleId,
  getState: () => hub.getState(),
  getModuleRevision: () => hub.getModuleRevision(moduleId),
  showLegacy,
  hideLegacy,
  publish: openPublishDialog,
};
