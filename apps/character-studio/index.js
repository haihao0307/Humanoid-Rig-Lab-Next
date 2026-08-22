import { ProjectHubClient } from '../../src/project-hub.js';
import { BUILD_ID, BUILD_VERSION } from '../../src/default-state.js';
import {
  computeTransportRawTime,
  normalizeAnimationState,
} from '../../src/modules/animation/model.js';
import {
  createPoseSnapshotFromLocalPose,
  sampleAnimationRuntime,
} from '../../src/modules/animation/runtime.js';
import { followAppearanceAttachments, createAppearanceRuntimeDescriptor } from '../../packages/appearance-system/index.js';
import { followSimulationRig } from '../../packages/clothing-system/index.js';
import { mountCharacterStudioSidebar } from './components/character-studio-sidebar.js';
import {
  IndexedDbCharacterStudioPersistence,
  MemoryCharacterStudioPersistence,
} from './character-studio-persistence.js';
import {
  CharacterStudioSession,
  CHARACTER_STUDIO_WINDOW_ROLES,
} from './character-studio-session.js';
import { serializeCharacterProfileExport } from './character-profile-export.js';
import {
  createFaceAnimationLayer,
  createFacePreviewFrame,
  FACE_EXPRESSION_CHANNEL_DEFINITIONS,
} from '../../packages/face-system/index.js';
import { CHARACTER_PROFILE_SCHEMA } from '../../packages/character-core/index.js';

const HOST_PROTOCOL = 'humanoid-rig-lab-next:viewport';
const CHARACTER_STUDIO_HOST_MODULE = 'character-studio';

export const CHARACTER_STUDIO_DISPLAY_MODES = Object.freeze({
  character: Object.freeze({
    label: '仅人物',
    legacyMode: 'skin',
    skinVisible: true,
    skeletonVisible: false,
    skinOpacity: 1,
    surfaceMode: 'solid',
  }),
  characterSkeleton: Object.freeze({
    label: '人物 + 骨架',
    legacyMode: 'both',
    skinVisible: true,
    skeletonVisible: true,
    skinOpacity: 1,
    surfaceMode: 'solid',
  }),
  xray: Object.freeze({
    label: 'X-Ray',
    legacyMode: 'both',
    skinVisible: true,
    skeletonVisible: true,
    skinOpacity: 0.55,
    surfaceMode: 'translucent',
  }),
  transparentSkin: Object.freeze({
    label: '透明表皮',
    legacyMode: 'both',
    skinVisible: true,
    skeletonVisible: true,
    skinOpacity: 0.3,
    surfaceMode: 'translucent',
  }),
});

const LEFT_PANEL_SLOTS = Object.freeze([
  ['identity', 'Identity', 'Character 身份与命名挂载点'],
  ['bodyShape', 'BodyShape', '身体形态参数挂载点'],
  ['face', 'Face', 'Face System 参数挂载点'],
  ['clothing', 'Clothing', 'Clothing System 附件挂载点'],
  ['appearance', 'Appearance', 'Hair / Accessory 外观挂载点'],
  ['proportion', 'Proportion', '比例版本与骨架引用挂载点'],
  ['pose', 'Pose', 'PoseSnapshot 与姿势挂载点'],
  ['animation', 'Animation', '动画片段与播放挂载点'],
]);

const RIGHT_PANEL_SLOTS = Object.freeze([
  ['characterProfile', 'CharacterProfile', 'Character Core profile 只读摘要'],
  ['expressionState', 'Expression State', 'Face Expression 当前状态只读摘要'],
  ['revisionSummary', 'Revision Summary', '模块 revision 与构建版本摘要'],
  ['activeReferences', 'Active References', 'Skin / Clothing / Hair / Accessory 引用'],
  ['exportSummary', 'Export Summary', '导出入口与后续集成摘要'],
]);

export class CharacterStudioLayout {
  constructor(root) {
    this.root = root;
    this.layout = required(root, '#characterStudioLayout');
    this.leftPanel = required(root, '#leftPanelHost');
    this.viewport = required(root, '#characterViewportHost');
    this.rightPanel = required(root, '#rightPanelHost');
    this.buildBadge = required(root, '#characterStudioBuild');
    this.syncStatus = required(root, '#characterStudioSync');
  }

  setBuild(build = {}) {
    const version = String(build.version || BUILD_VERSION);
    const id = String(build.id || BUILD_ID);
    this.buildBadge.textContent = `build ${id} · v${version}`;
  }

  setSync(connected, transport = 'local') {
    this.syncStatus.classList.toggle('offline', !connected);
    const label = connected ? `已连接 · ${transport}` : '仅本窗口';
    this.syncStatus.querySelector('b').textContent = label;
  }
}

export class LeftPanelHost {
  constructor(host) {
    this.host = host;
    this.renderShell();
  }

  renderShell() {
    this.host.innerHTML = `
      <div class="character-studio-panel-heading">
        <div>
          <span class="eyebrow">EDITORS</span>
          <h2>Character 编辑面板</h2>
          <p>只提供稳定的模块挂载槽位，具体编辑器由各模块接入。</p>
        </div>
        <span class="character-studio-panel-tag">SLOTS</span>
      </div>
      <section class="character-studio-section" data-panel-section="character-editors">
        <div class="character-studio-section-header">
          <h3>编辑器入口</h3>
          <span>LEFT PANEL</span>
        </div>
        <div class="character-studio-slot-list">
          ${LEFT_PANEL_SLOTS.map(([id, label, note]) => slotMarkup(id, label, note)).join('')}
        </div>
      </section>`;
  }

  getSlot(slotId) {
    return this.host.querySelector(`[data-studio-slot="${String(slotId)}"]`);
  }

  mount(slotId, content) {
    const slot = this.getSlot(slotId);
    if (!slot) throw new Error(`Unknown Character Studio left-panel slot: ${slotId}`);
    slot.replaceChildren(content instanceof Node ? content : textNode(content));
    slot.dataset.mounted = 'true';
    return slot;
  }
}

export class RightPanelHost {
  constructor(host, { onExport = null } = {}) {
    this.host = host;
    this.onExport = onExport;
    this.renderShell();
  }

  renderShell() {
    this.host.innerHTML = `
      <div class="character-studio-panel-heading">
        <div>
          <span class="eyebrow">CHARACTER DATA</span>
          <h2>Character 数据</h2>
          <p>profile、revision、引用和导出摘要。</p>
        </div>
        <span class="character-studio-panel-tag">READ ONLY</span>
      </div>
      ${RIGHT_PANEL_SLOTS.map(([id, label, note]) => `
        <section class="character-studio-section" data-panel-section="${id}">
          <div class="character-studio-section-header"><h3>${label}</h3><span>RIGHT PANEL</span></div>
          ${slotMarkup(id, label, note)}
        </section>`).join('')}`;
  }

  getSlot(slotId) {
    return this.host.querySelector(`[data-studio-slot="${String(slotId)}"]`);
  }

  mount(slotId, content) {
    const slot = this.getSlot(slotId);
    if (!slot) throw new Error(`Unknown Character Studio right-panel slot: ${slotId}`);
    slot.replaceChildren(content instanceof Node ? content : textNode(content));
    slot.dataset.mounted = 'true';
    return slot;
  }

  renderSummary(state, runtime, sessionSnapshot = null) {
    const profile = runtime.characterProfile;
    const expression = runtime.faceExpression || { schema: 'humanoid_rig/face_expression@1.0', expressionRevision: 0, channels: {} };
    const expressionDescriptor = runtime.faceExpressionDescriptor;
    const moduleRevisions = state.moduleRevisions || {};
    const activeVersions = state.activeVersions || {};
    const clothing = runtime.clothingProfile;
    const appearance = runtime.appearanceFrame;
    const references = profile || {};

    this.mount('characterProfile', htmlNode(`
      <div class="character-studio-data-card">
        ${dataRow('Character ID', profile?.character_id || 'character_001')}
        ${dataRow('Name', profile?.name || 'Default Character')}
        ${dataRow('Profile version', `v${Number(profile?.version || 1)}`)}
        ${dataRow('Source', 'Character Core')}
      </div>`));

    const activeExpressionChannels = Object.entries(expression.channels || {})
      .filter(([, value]) => Number(value) > 0.0001)
      .map(([channel, value]) => `${channel}=${Number(value).toFixed(2)}`);
    this.mount('expressionState', htmlNode(`
      <div class="character-studio-data-card character-studio-expression-summary">
        ${dataRow('Schema', expression.schema || 'humanoid_rig/face_expression@1.0')}
        ${dataRow('Expression Revision', `r${Number(expression.expressionRevision || 0)}`)}
        ${dataRow('Active Channels', `${activeExpressionChannels.length} / ${Object.keys(expression.channels || {}).length || FACE_EXPRESSION_CHANNEL_DEFINITIONS.length}`)}
        <span class="character-studio-slot-note">${escapeHtml(activeExpressionChannels.join(' · ') || 'neutral')}</span>
      </div>`));

    this.mount('revisionSummary', htmlNode(`
      <div class="character-studio-revision-list">
        ${revisionRow('Project', `r${Number(state.revision || 1)}`)}
        ${revisionRow('Character', `r${Number(state.characterCore?.revision || 0)}`)}
        ${revisionRow('BodyShape', `r${Number(profile?.body_shape_revision || 0)}`)}
        ${revisionRow('Face', `r${Number(profile?.face_revision || 0)}`)}
        ${revisionRow('Clothing', `r${Number(profile?.clothing_revision || 0)}`)}
        ${revisionRow('Appearance', `r${Number(state.appearanceSystem?.revision || 0)}`)}
        ${revisionRow('Proportion', `r${Number(profile?.proportion_revision || 0)} · ${activeVersions.rig || 'rig@0.4.0'} · m${Number(moduleRevisions.proportion || 0)}`)}
        ${revisionRow('Skin', `r${Number(profile?.skin_revision || 0)} · ${activeVersions.skin || 'skin@0.5.1'} · m${Number(moduleRevisions.skin || 0)}`)}
        ${revisionRow('Pose', `r${Number(profile?.pose_revision || 0)} · ${activeVersions.pose || 'pose@0.4.0'}`)}
        ${revisionRow('Animation', `r${Number(profile?.animation_revision || 0)} · ${activeVersions.animation || 'anim@0.4.0'}`)}
        ${revisionRow('Expression', `r${Number(expression.expressionRevision || 0)} · ${expressionDescriptor?.deformationMode || 'interface-only'}`)}
      </div>`));

    this.mount('activeReferences', htmlNode(`
      <div class="character-studio-reference-list">
        ${referenceRow('Skin', state.character?.skin?.detailAsset || 'pre-bound GLB')}
        ${referenceRow('Clothing', `${clothing?.assets?.length || 0} assets · simulationRig`)}
        ${referenceRow('Hair', appearance?.hair?.hair_id || references.hair?.hair_id || 'slot ready')}
        ${referenceRow('Accessory', `${appearance?.accessories?.length || references.accessory_attachments?.length || 0} · simulationRig`)}
        ${referenceRow('Runtime source', runtime.frame.simulationRig?.rigVersion || 'simulationRig')}
      </div>`));

    this.mount('exportSummary', htmlNode(`
      <div class="character-studio-data-card">
        ${dataRow('Viewport pose', 'finalPose → simulationRig')}
        ${dataRow('Render stack', 'Character → Skin → Clothing → Appearance')}
        ${dataRow('Saved revision', `r${Number(sessionSnapshot?.project_revision || state.revision || 0)}`)}
        ${dataRow('Profile schema', profile?.schema || CHARACTER_PROFILE_SCHEMA)}
        ${dataRow('Face Runtime', expressionDescriptor?.deformationMode || 'interface-only')}
        ${dataRow('Animation Layer', runtime.faceAnimationLayer?.layerType || 'face-expression')}
        ${dataRow('Face Preview', runtime.facePreviewFrame?.schema || 'preview surface')}
        ${dataRow('Build', BUILD_ID)}
        <button class="character-studio-export-button" data-character-studio-export type="button">导出 CharacterProfile JSON</button>
        <span class="character-studio-slot-note">只包含版本、模块引用与资源摘要，不包含二进制资源。</span>
      </div>`));
    this.host.querySelector('[data-character-studio-export]')?.addEventListener('click', () => this.onExport?.());
  }
}

export class FacePreviewPanel {
  constructor(root) {
    this.root = root;
  }

  render(state, runtime) {
    const canvas = this.root?.querySelector?.('[data-face-preview-canvas]');
    const status = this.root?.querySelector?.('[data-face-preview-status]');
    if (!canvas) return;
    const faceSystem = state?.faceSystem || {};
    const profile = faceSystem.profiles?.[faceSystem.active_face_id] || {};
    const frame = runtime?.facePreviewFrame || createFacePreviewFrame(runtime?.faceExpression || {}, profile);
    drawFacePreview(canvas, frame);
    const active = Object.values(frame.morphWeights || {}).filter((value) => Number(value) > 0.0001).length;
    if (status) {
      status.textContent = active
        ? `${active} active morph inputs · r${frame.expressionRevision}`
        : `neutral · r${frame.expressionRevision} · preview surface`;
    }
  }
}

export class DisplayModeToolbar {
  constructor(root, onChange) {
    this.root = root;
    this.onChange = onChange;
    this.mode = 'characterSkeleton';
    this.render();
  }

  render() {
    this.root.innerHTML = Object.entries(CHARACTER_STUDIO_DISPLAY_MODES)
      .map(([id, config]) => `<button class="character-studio-display-button" data-character-display-mode="${id}" type="button" aria-pressed="false">${config.label}</button>`)
      .join('');
    this.root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-character-display-mode]');
      if (!button) return;
      this.setMode(button.dataset.characterDisplayMode, true);
    });
    this.setMode(this.mode, false);
  }

  setMode(mode, notify = false) {
    this.mode = CHARACTER_STUDIO_DISPLAY_MODES[mode] ? mode : 'characterSkeleton';
    this.root.querySelectorAll('[data-character-display-mode]').forEach((button) => {
      const active = button.dataset.characterDisplayMode === this.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (notify) this.onChange?.(this.mode);
  }

  getMode() {
    return this.mode;
  }
}

export class CharacterViewportHost {
  constructor(host) {
    this.host = host;
    this.stage = required(host, '#characterViewportStage');
    this.frame = required(host, '#characterStudioViewportFrame');
    this.status = required(host, '#viewportRuntimeStatus');
    this.layerStatus = required(host, '#viewportLayerStatus');
    this.resetButton = required(host, '#resetViewportButton');
    this.currentState = null;
    this.currentRuntime = null;
    this.currentDisplayMode = 'characterSkeleton';
    this.frameReady = false;
    this.sourceKey = '';
    this.pendingHostState = null;

    this.frame.addEventListener('load', () => {
      this.frameReady = true;
      this.status.textContent = 'simulationRig 人物视口已连接';
      this.postPendingState();
    });
    this.resetButton.addEventListener('click', () => this.resetView());
    window.addEventListener('message', (event) => this.handleMessage(event));
  }

  setDisplayMode(mode) {
    this.currentDisplayMode = CHARACTER_STUDIO_DISPLAY_MODES[mode] ? mode : 'characterSkeleton';
    this.postPendingState();
  }

  render(state, runtime, displayMode) {
    this.currentState = state;
    this.currentRuntime = runtime;
    this.currentDisplayMode = CHARACTER_STUDIO_DISPLAY_MODES[displayMode] ? displayMode : 'characterSkeleton';
    this.ensureSource(state);
    this.updateLayerStatus(state, runtime);
    this.pendingHostState = this.createHostState(state, runtime);
    this.postPendingState();
  }

  ensureSource(state) {
    const reloadToken = Number(state.character?.skin?.reloadToken || 0);
    const key = `${BUILD_ID}:${reloadToken}`;
    if (this.sourceKey === key && this.frame.src) return;
    const url = new URL('./legacy/v8/index.html', window.location.href);
    url.searchParams.set('embed', '1');
    url.searchParams.set('hostModule', CHARACTER_STUDIO_HOST_MODULE);
    url.searchParams.set('readOnly', '1');
    url.searchParams.set('surfaceSource', 'detail');
    url.searchParams.set('displayMode', 'both');
    url.searchParams.set('view', 'perspective');
    url.searchParams.set('build', BUILD_ID);
    url.searchParams.set('skinBuild', state.character?.skin?.runtimeBuildId || 'skin-v002-single-surface-guard');
    this.frameReady = false;
    this.sourceKey = key;
    this.frame.src = url.href;
  }

  createHostState(state, runtime) {
    const display = CHARACTER_STUDIO_DISPLAY_MODES[this.currentDisplayMode] || CHARACTER_STUDIO_DISPLAY_MODES.characterSkeleton;
    return {
      display: {
        ...structuredClone(state.character?.display || {}),
        mode: display.legacyMode,
        skinVisible: display.skinVisible,
        skeletonVisible: display.skeletonVisible,
        skinOpacity: display.skinOpacity,
        surfaceMode: display.surfaceMode,
        skinRenderMode: display.surfaceMode,
        skeletonXray: true,
        studioMode: this.currentDisplayMode,
      },
      skin: structuredClone(state.character?.skin || {}),
      bodyProfile: structuredClone(state.character?.bodyProfile || {}),
      bodyShape: structuredClone(runtime.bodyShapeProfile || {}),
      clothing: structuredClone(runtime.clothingProfile || {}),
      appearance: {
        state: structuredClone(state.appearanceSystem || {}),
        runtimeDescriptor: structuredClone(runtime.appearanceDescriptor),
        attachmentFrame: structuredClone(runtime.appearanceFrame),
      },
      face: {
        expression: structuredClone(runtime.faceExpression),
        runtimeDescriptor: structuredClone(runtime.faceExpressionDescriptor),
        animationLayer: structuredClone(runtime.faceAnimationLayer),
        previewFrame: structuredClone(runtime.facePreviewFrame),
      },
      clothingFrame: structuredClone(runtime.clothingFrame),
      simulationRig: structuredClone(runtime.frame.simulationRig),
      physics: structuredClone(state.character?.physics || {}),
      // The exact final pose travels over HRL_ANIMATION_FRAME below. The host
      // state keeps the shared data bridge compatible with the existing V8 view.
      pose: { name: 'Character Studio simulationRig', poseSnapshot: null, v8Payload: null },
    };
  }

  postPendingState() {
    if (!this.pendingHostState || !this.frame.contentWindow) return;
    const state = this.currentState;
    const runtime = this.currentRuntime;
    const targetOrigin = window.location.origin;
    this.frame.contentWindow.postMessage({
      protocol: HOST_PROTOCOL,
      type: 'HRL_HOST_STATE',
      revision: state?.revision,
      module: CHARACTER_STUDIO_HOST_MODULE,
      state: this.pendingHostState,
    }, targetOrigin);

    if (!runtime?.frame || !runtime.frame.v8Payload) return;
    const poseSnapshot = createSimulationPoseSnapshot(runtime.frame, state);
    this.frame.contentWindow.postMessage({
      protocol: HOST_PROTOCOL,
      type: 'HRL_ANIMATION_FRAME',
      revision: state?.revision,
      module: CHARACTER_STUDIO_HOST_MODULE,
      pose: {
        name: 'Character Studio simulationRig',
        poseSnapshot,
        v8Payload: structuredClone(runtime.frame.v8Payload),
        simulationRig: structuredClone(runtime.frame.simulationRig),
      },
    }, targetOrigin);
  }

  updateLayerStatus(state, runtime) {
    const clothingCount = runtime.clothingFrame?.asset_frames?.length || runtime.clothingProfile?.assets?.length || 0;
    const hair = runtime.appearanceFrame?.hair;
    const accessoryCount = runtime.appearanceFrame?.accessories?.length || 0;
    const statuses = {
      simulationRig: `simulationRig · ${runtime.frame?.finalPose ? 'finalPose' : 'waiting'}`,
      skin: `Skin · ${state.character?.skin?.singleLayer ? '单一预绑定表皮' : 'waiting'}`,
      clothing: `Clothing · ${clothingCount} assets · simulationRig`,
      hair: hair ? `Hair · ${hair.hair_id} · simulationRig` : 'Hair · 挂载槽位 · simulationRig',
      accessory: `Accessory · ${accessoryCount} · simulationRig`,
    };
    this.layerStatus.querySelectorAll('[data-viewport-layer-slot]').forEach((element) => {
      const id = element.dataset.viewportLayerSlot;
      element.textContent = statuses[id] || element.textContent;
      element.dataset.layerReady = id === 'simulationRig' || (id === 'skin' && Boolean(state.character?.skin?.singleLayer)) || (id === 'hair' && Boolean(hair)) || (id === 'accessory' && accessoryCount > 0) || (id === 'clothing' && clothingCount > 0) ? 'true' : 'false';
    });
  }

  mountLayer(slotId, content) {
    const slot = this.layerStatus.querySelector(`[data-viewport-layer-slot="${String(slotId)}"]`);
    if (!slot) throw new Error(`Unknown Character Studio viewport layer slot: ${slotId}`);
    slot.replaceChildren(content instanceof Node ? content : textNode(content));
    slot.dataset.layerReady = 'true';
    return slot;
  }

  resetView() {
    this.frameReady = false;
    this.status.textContent = '正在重置 Character Viewport 视角';
    if (this.frame.contentWindow) {
      this.frame.contentWindow.location.reload();
      return;
    }
    if (this.frame.src) this.frame.src = this.frame.src;
  }

  handleMessage(event) {
    if (event.origin !== window.location.origin || event.source !== this.frame.contentWindow) return;
    const message = event.data;
    if (!message || message.protocol !== HOST_PROTOCOL) return;
    if (message.type === 'HRL_EMBED_READY') {
      this.frameReady = true;
      this.status.textContent = 'simulationRig 人物视口已连接';
      this.postPendingState();
      return;
    }
    if (message.type === 'HRL_RENDERER_STATUS') {
      this.status.textContent = message.state === 'ready'
        ? `${message.backend || 'Three.js'} · simulationRig 人物视口已连接`
        : message.state === 'error' ? 'Three.js 视口初始化失败，保留回退视图' : '正在初始化 Three.js 人物视口';
      return;
    }
    if (message.type === 'HRL_SURFACE_STATUS' && message.surface?.state === 'ready') {
      this.status.textContent = 'Skin / Clothing / simulationRig 已接入';
    }
  }
}

export class CharacterStudioApp {
  constructor(root) {
    this.root = root;
    this.layout = new CharacterStudioLayout(root);
    this.hub = new ProjectHubClient({ module: CHARACTER_STUDIO_HOST_MODULE, title: 'Character Studio' });
    this.session = createCharacterStudioSession({
      role: CHARACTER_STUDIO_HOST_MODULE,
      title: 'Humanoid Rig Lab Next · Character Studio',
      hub: this.hub,
    });
    this.sidebar = null;
    this.rightPanel = new RightPanelHost(this.layout.rightPanel, {
      onExport: () => this.exportActiveCharacter(),
    });
    this.displayToolbar = new DisplayModeToolbar(
      required(root, '#displayModeToolbar'),
      (mode) => {
        this.viewport?.setDisplayMode(mode);
        if (this.currentState && this.currentRuntime) this.viewport?.render(this.currentState, this.currentRuntime, mode);
      },
    );
    this.viewport = new CharacterViewportHost(this.layout.viewport);
    this.facePreviewPanel = new FacePreviewPanel(this.layout.leftPanel);
    this.currentState = null;
    this.currentRuntime = null;
    this.previousFinalPose = null;
    this.unsubscribeState = null;
    this.unsubscribeMotion = null;
    this.animationTick = 0;
    this.lastAnimationFrameAt = 0;
  }

  async start() {
    await this.session.initialize();
    this.layout.leftPanel.classList.add('character-studio-sidebar');
    this.sidebar = mountCharacterStudioSidebar({
      root: this.layout.leftPanel,
      hub: this.hub,
      onError: (error) => this.reportError(error),
    });
    this.layout.setSync(this.hub.connected, this.hub.transport);
    this.unsubscribeState = this.hub.subscribe((state, detail) => this.render(state, detail));
    this.unsubscribeMotion = this.hub.subscribeTransient('motion.scrub.preview', (payload) => {
      if (!this.currentState) return;
      const animation = structuredClone(this.currentState.character.animation || {});
      animation.transport = { ...(animation.transport || {}), time: Number(payload?.time || 0), rawTime: Number(payload?.time || 0), playing: false };
      this.render(this.currentState, { source: 'motion.scrub.preview' }, animation);
    });
    return this;
  }

  render(state, detail = {}, animationOverride = null) {
    this.currentState = state;
    this.layout.setBuild(state.build);
    const runtime = this.buildRuntime(state, animationOverride);
    this.currentRuntime = runtime;
    this.facePreviewPanel.render(state, runtime);
    this.rightPanel.renderSummary(state, runtime, this.session.getSnapshot());
    this.viewport.render(state, runtime, this.displayToolbar.getMode());
    this.layout.setSync(this.hub.connected, this.hub.transport);
    this.scheduleAnimationTick(state, runtime, detail);
  }

  buildRuntime(state, animationOverride = null) {
    const bodyProfile = state.character?.bodyProfile || {};
    const rigVersion = state.activeVersions?.rig || 'rig@0.4.0';
    const animation = normalizeAnimationState(animationOverride || state.character?.animation || {}, {
      compatibleRig: rigVersion,
      targetProportionRevision: Number(state.moduleRevisions?.proportion || 0),
    });
    const nowMs = Date.now();
    const rawTime = computeTransportRawTime(animation, nowMs);
    const frame = sampleAnimationRuntime(animation, {
      rawTime,
      nowMs,
      bodyProfile,
      rigVersion,
      previousFinalPose: this.previousFinalPose,
      deltaTime: this.lastAnimationFrameAt ? Math.min(0.25, Math.max(1 / 240, (nowMs - this.lastAnimationFrameAt) / 1000)) : 1 / 60,
    });
    this.lastAnimationFrameAt = nowMs;
    this.previousFinalPose = structuredClone(frame.finalPose);

    const bodyShapeProfile = state.bodyShape?.profiles?.[state.bodyShape?.active_profile_id] || null;
    const clothingProfile = state.clothingSystem?.profiles?.[state.clothingSystem?.active_profile_id] || null;
    const appearanceState = state.appearanceSystem || {};
    const clothingFrame = clothingProfile ? followSimulationRig(clothingProfile, frame.simulationRig) : null;
    const appearanceDescriptor = createAppearanceRuntimeDescriptor(appearanceState);
    const appearanceFrame = followAppearanceAttachments(appearanceState, frame.simulationRig);
    const characterId = state.characterCore?.active_character_id || 'character_001';
    const characterProfile = state.characterCore?.profiles?.[characterId] || null;
    const faceExpression = state.faceSystem?.expression || null;
    const faceExpressionDescriptor = state.faceSystem?.expression_runtime_descriptor || null;
    const faceAnimationLayer = createFaceAnimationLayer(faceExpression || {}, {
      bodyAnimationReference: 'character.animation',
    });
    const faceIdentity = state.faceSystem?.profiles?.[state.faceSystem?.active_face_id] || {};
    const facePreviewFrame = createFacePreviewFrame(faceExpression || {}, faceIdentity);

    return {
      animation,
      frame,
      bodyShapeProfile,
      clothingProfile,
      clothingFrame,
      appearanceDescriptor,
      appearanceFrame,
      characterProfile,
      faceExpression,
      faceExpressionDescriptor,
      faceAnimationLayer,
      facePreviewFrame,
    };
  }

  scheduleAnimationTick(state, runtime, detail) {
    const playing = Boolean(runtime.animation.transport?.playing);
    if (!playing || this.animationTick) return;
    const tick = () => {
      this.animationTick = 0;
      if (this.currentState !== state || !this.currentRuntime?.animation.transport?.playing) return;
      this.render(this.currentState, { source: 'animation-tick', ...detail });
    };
    this.animationTick = window.requestAnimationFrame(tick);
  }

  async exportActiveCharacter() {
    try {
      const exportDocument = await this.session.exportCharacterProfile();
      const serialized = serializeCharacterProfileExport(exportDocument);
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${exportDocument.character_profile.character_id}-character-profile-v${exportDocument.character_profile.version}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      return exportDocument;
    } catch (error) {
      this.reportError(error);
      throw error;
    }
  }

  reportError(error) {
    const message = error?.message || String(error);
    const status = this.root.querySelector('#viewportRuntimeStatus');
    if (status) status.textContent = `Character Studio 错误：${message}`;
    console.error(error);
  }

  async dispose() {
    this.unsubscribeState?.();
    this.unsubscribeMotion?.();
    this.sidebar?.destroy();
    if (this.animationTick) window.cancelAnimationFrame(this.animationTick);
    await this.session.close();
  }
}

function createSimulationPoseSnapshot(frame, state) {
  const localPose = createPoseSnapshotFromLocalPose(frame.finalPose, {
    name: 'Character Studio simulationRig',
    pinned: state.character?.pose?.pinned || [],
  });
  const updatedAt = frame.v8Payload?.updatedAt || `character-studio:${Date.now()}`;
  return {
    schema: 'humanoid_rig/pose_snapshot@1.0',
    schemaVersion: 1,
    type: 'PoseSnapshot',
    compatibleRig: state.activeVersions?.rig || 'rig@0.4.0',
    solverVersion: 'character-studio-runtime@0.1',
    name: 'Character Studio simulationRig',
    unit: 'meter',
    coordinateSystem: {
      handedness: 'right',
      upAxis: '+Y',
      forwardAxis: '+Z',
      rightAxis: '+X',
    },
    source: 'character-studio-simulationRig',
    sourceRepresentation: 'local_quaternion_animation',
    rotationSpace: 'local',
    rotationConvention: 'incoming_bone_bind_delta_zero_twist',
    rootJointId: 'hips',
    rootTranslation: [...localPose.root.position],
    rootRotation: [...localPose.root.rotation],
    localRotations: structuredClone(frame.v8Payload?.incomingBoneLocalRotations || {}),
    ikTargets: [],
    pinnedJoints: {},
    updatedAt,
    sourceLegacyUpdatedAt: updatedAt,
  };
}

function drawFacePreview(canvas, frame) {
  if (!canvas || !frame) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const width = canvas.width;
  const height = canvas.height;
  const surface = frame.surface;
  const profile = frame.profile;
  const leftEye = frame.eyes.left;
  const rightEye = frame.eyes.right;

  context.clearRect(0, 0, width, height);
  const background = context.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, '#081629');
  background.addColorStop(1, '#030914');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.2;
  context.strokeStyle = '#6696c7';
  context.lineWidth = 1;
  for (let x = 20; x < width; x += 32) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 18; y < height; y += 32) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.restore();

  context.save();
  context.translate(width / 2, height / 2 + 4);
  context.scale(0.86 * surface.faceScaleX, 0.86 * surface.faceScaleY);

  const faceWidth = 88 + (Number(profile.face_shape.width) - 0.5) * 18;
  const jawWidth = faceWidth * (0.68 + Number(profile.face_shape.jaw_width) * 0.18);
  const jawBottom = 112 + surface.jawDrop * 80;
  const faceGradient = context.createLinearGradient(0, -112, 0, jawBottom);
  faceGradient.addColorStop(0, '#f4c7aa');
  faceGradient.addColorStop(0.65, '#e7a98d');
  faceGradient.addColorStop(1, '#c77c6f');

  context.fillStyle = '#b56e67';
  context.beginPath();
  context.ellipse(-faceWidth - 4, 4, 12, 28, 0, 0, Math.PI * 2);
  context.ellipse(faceWidth + 4, 4, 12, 28, 0, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.moveTo(-faceWidth, -28);
  context.bezierCurveTo(-faceWidth, -84, -faceWidth * 0.66, -112, 0, -116);
  context.bezierCurveTo(faceWidth * 0.66, -112, faceWidth, -84, faceWidth, -28);
  context.bezierCurveTo(faceWidth, 34, jawWidth, 90, 0, jawBottom);
  context.bezierCurveTo(-jawWidth, 90, -faceWidth, 34, -faceWidth, -28);
  context.closePath();
  context.fillStyle = faceGradient;
  context.fill();
  context.strokeStyle = 'rgba(255, 219, 198, 0.62)';
  context.lineWidth = 2;
  context.stroke();

  drawPreviewCheek(context, -54, 24, surface.cheekPuffLeft);
  drawPreviewCheek(context, 54, 24, surface.cheekPuffRight);
  drawPreviewBrow(context, -36, -60, frame.brows.left, -1);
  drawPreviewBrow(context, 36, -60, frame.brows.right, 1);

  const eyeSpacing = 34 + (Number(profile.eye_shape.spacing) - 0.5) * 10;
  const eyeSize = 20 + Number(profile.eye_shape.size) * 9;
  const eyeTilt = (Number(profile.eye_shape.tilt) - 0.5) * 0.22;
  drawPreviewEye(context, -eyeSpacing, -28, eyeSize, leftEye, eyeTilt, -1);
  drawPreviewEye(context, eyeSpacing, -28, eyeSize, rightEye, eyeTilt, 1);

  context.strokeStyle = 'rgba(130, 74, 67, 0.7)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, -18);
  context.quadraticCurveTo(-5, 5, 0, 20);
  context.quadraticCurveTo(7, 25, 11, 19);
  context.stroke();

  drawPreviewMouth(context, frame.mouth, profile.mouth_shape, surface.jawShift, surface.jawDrop);
  context.restore();

  context.fillStyle = 'rgba(215, 235, 255, 0.76)';
  context.font = '10px ui-monospace, SFMono-Regular, Consolas, monospace';
  context.fillText(`FACE SURFACE  ·  r${frame.expressionRevision}`, 12, 20);
}

function drawPreviewCheek(context, x, y, puff) {
  if (puff <= 0.01) return;
  context.save();
  context.globalAlpha = 0.12 + puff * 0.18;
  context.fillStyle = '#fff0d5';
  context.beginPath();
  context.ellipse(x, y, 19 + puff * 12, 14 + puff * 7, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawPreviewEye(context, x, y, size, eye, tilt, side) {
  context.save();
  context.translate(x, y);
  context.rotate(tilt * side);
  const openness = Math.max(0.08, eye.openness);
  const eyeHeight = 3 + openness * 9;
  const eyeWidth = size + eye.wide * 5;
  context.fillStyle = '#fff6e9';
  context.beginPath();
  context.ellipse(0, 0, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#3b6572';
  context.beginPath();
  context.ellipse(side * 2, 0, 4.5 + eye.squint * 1.5, 4.5 + eye.squint, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#0b1722';
  context.beginPath();
  context.ellipse(side * 2, 0, 2, 3, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#7c4d54';
  context.lineWidth = 2.2 + eye.closure * 1.2;
  context.beginPath();
  context.moveTo(-eyeWidth, -eyeHeight * (0.65 + eye.closure * 0.25));
  context.quadraticCurveTo(0, -eyeHeight * (1.1 - eye.closure * 0.7), eyeWidth, -eyeHeight * (0.65 + eye.closure * 0.25));
  context.stroke();
  context.restore();
}

function drawPreviewBrow(context, x, y, brow, side) {
  const raise = brow.raise * 10 - brow.down * 6;
  const angry = brow.angry * 7 + brow.inner * 3;
  context.save();
  context.translate(x, y - raise);
  context.strokeStyle = '#6e3f3e';
  context.lineWidth = 5;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(-20, side < 0 ? angry : -angry);
  context.quadraticCurveTo(0, -4 - brow.raise * 4, 20, side < 0 ? -angry : angry);
  context.stroke();
  context.restore();
}

function drawPreviewMouth(context, mouth, shape, jawShift, jawDrop) {
  const smile = mouth.smile;
  const frown = mouth.frown;
  const pucker = mouth.pucker;
  const open = mouth.open;
  const width = 24 + Number(shape.width) * 27 + smile * 8 - pucker * 11;
  const y = 45 + jawDrop * 40;
  const cornerOffset = (smile - frown) * 12;
  const centerX = jawShift * 36 + mouth.shift * 34;

  context.save();
  context.translate(centerX, y);
  context.strokeStyle = '#863f4d';
  context.lineWidth = 3;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(-width, cornerOffset);
  context.quadraticCurveTo(0, -open * 14 + (frown - smile) * 4, width, -cornerOffset);
  context.stroke();

  if (open > 0.04 || pucker > 0.04) {
    context.fillStyle = '#521f37';
    context.beginPath();
    context.ellipse(0, open * 5, Math.max(5, width - pucker * 15), 2 + open * 11 + pucker * 4, 0, 0, Math.PI * 2);
    context.fill();
  }

  context.strokeStyle = '#d8787f';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-width, cornerOffset);
  context.quadraticCurveTo(0, -open * 10 + (frown - smile) * 2, width, -cornerOffset);
  context.stroke();
  context.restore();
}

function slotMarkup(id, label, note) {
  return `<div class="character-studio-slot" data-studio-slot="${id}" data-mounted="false"><span class="character-studio-slot-label">${label}</span><span class="character-studio-slot-note">${note}</span></div>`;
}

function dataRow(label, value) {
  return `<div class="character-studio-data-row"><span>${label}</span><strong title="${escapeHtml(value)}">${escapeHtml(value)}</strong></div>`;
}

function referenceRow(label, value) {
  return `<div class="character-studio-reference-item"><span>${label}</span><b title="${escapeHtml(value)}">${escapeHtml(value)}</b></div>`;
}

function revisionRow(label, value) {
  return `<div class="character-studio-revision-item"><span>${label}</span><b title="${escapeHtml(value)}">${escapeHtml(value)}</b></div>`;
}

function htmlNode(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content;
}

function textNode(value) {
  return document.createTextNode(String(value ?? ''));
}

function required(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Character Studio markup is missing ${selector}.`);
  return element;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character]));
}

const characterStudioRoot = typeof document === 'undefined'
  ? null
  : document.querySelector('[data-character-studio-app]');
if (characterStudioRoot) {
  const characterStudioApp = new CharacterStudioApp(characterStudioRoot);
  characterStudioApp.start().catch((error) => characterStudioApp.reportError(error));
  window.__characterStudio = characterStudioApp;
}
export {
  CharacterStudioController,
  buildCharacterStudioSnapshot,
} from './character-studio-controller.js';
export {
  CHARACTER_STUDIO_PANELS,
  CharacterStudioSidebar,
  mountCharacterStudioSidebar,
  renderCharacterStudioSidebar,
} from './components/character-studio-sidebar.js';
export * from './panels/index.js';

export * from './character-studio-session.js';
export * from './character-studio-persistence.js';
export * from './character-profile-export.js';

export function createCharacterStudioSession({
  role = 'character-studio',
  title = 'Humanoid Rig Lab Next · Character Studio',
  hub = null,
  persistence = null,
  now,
} = {}) {
  if (!CHARACTER_STUDIO_WINDOW_ROLES.includes(role)) {
    throw new TypeError(`Unsupported Character Studio window role: ${role}.`);
  }
  const projectHub = hub || new ProjectHubClient({ module: role, title });
  const repository = persistence || (
    globalThis.indexedDB
      ? new IndexedDbCharacterStudioPersistence({ now })
      : new MemoryCharacterStudioPersistence({ now })
  );
  return new CharacterStudioSession({
    hub: projectHub,
    persistence: repository,
    role,
    now,
  });
}
