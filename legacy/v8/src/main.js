import {
  applyPosePresetToDefinition,
  cloneValue,
  createStandardHumanoidPreset,
  normalizePosePresetId,
  normalizeSkeletonDefinition,
  summarizeRigDefinition,
} from './skeleton-presets.js';
import {
  applyBodyProfileToDefinition,
  bodyProfileKey,
  measureBodyProfile,
  normalizeBodyProfile,
} from './body-profile.js';
import {
  applyPosePayload,
  buildExportPayload,
  buildPosePayload,
  calculateRigHeight,
  canonicalDefinition,
  computePoseWorldPositions,
  computeRestWorldPositions,
  formatNumber,
  getBoneLength,
  getCurrentBoneLength,
  getJointDepths,
  roundNumber,
} from './skeleton-model.js';
import { PhysicsRig } from './physics-rig.js';
import { SvgSkeletonView } from './svg-view.js';
import { createThreeSkeletonView } from './three-view.js';

const STORAGE_KEY = 'humanoid-skeleton-editor:v8.5-performance-rig';
const LEGACY_KEYS = ['humanoid-skeleton-editor:v8.4-3d-proportion', 'humanoid-skeleton-editor:v8.3-anatomical-fit', 'humanoid-skeleton-editor:v8.2-unified-surface', 'humanoid-skeleton-editor:v8.1-single-surface', 'humanoid-skeleton-editor:v8-human-surface', 'humanoid-skeleton-editor:v7.2-surface-fixed', 'humanoid-skeleton-editor:v7.1-smpl-interaction', 'humanoid-skeleton-editor:v6-biomechanics', 'humanoid-skeleton-editor:v5-fixed-physics', 'humanoid-skeleton-editor:v2', 'humanoid-skeleton-editor:v1'];
const HISTORY_LIMIT = 100;
const THREE_VERSION = '0.185.1';
const HOST_PROTOCOL = 'humanoid-rig-lab-next:viewport';
const URL_PARAMS = new URLSearchParams(window.location.search);
const EMBED_MODE = URL_PARAMS.get('embed') === '1';
const HOST_READ_ONLY = URL_PARAMS.get('readOnly') === '1';
const HOST_MODULE = URL_PARAMS.get('hostModule') || 'integration';
let hostApplyingState = false;
let hostConnected = false;
let lastHostPoseStamp = '';
let lastHostBodyProfileKey = '';
let lastProfileMetrics = null;

document.documentElement.classList.toggle('embed-mode', EMBED_MODE);
document.body.classList.toggle('embed-mode', EMBED_MODE);
document.body.classList.toggle('embed-readonly', HOST_READ_ONLY);

const dom = {
  viewportShell: document.querySelector('#viewport-shell'),
  fallbackLayer: document.querySelector('#fallback-layer'),
  threeLayer: document.querySelector('#three-layer'),
  rendererState: document.querySelector('#renderer-state'),
  surfaceState: document.querySelector('#surface-state'),
  surfaceRetryButton: document.querySelector('#surface-retry-button'),
  surfaceReloadToolbarButton: document.querySelector('#surface-reload-toolbar-button'),
  displayModeButtons: [...document.querySelectorAll('[data-display-mode]')],
  selectionLabel: document.querySelector('#selection-label'),
  errorPanel: document.querySelector('#error-panel'),
  retryRendererButton: document.querySelector('#retry-renderer-button'),
  dropOverlay: document.querySelector('#drop-overlay'),
  jointList: document.querySelector('#joint-list'),
  jointSearch: document.querySelector('#joint-search'),
  poseName: document.querySelector('#pose-name'),
  jointCount: document.querySelector('#joint-count'),
  deformCount: document.querySelector('#deform-count'),
  helperCount: document.querySelector('#helper-count'),
  rigHeight: document.querySelector('#rig-height'),
  lengthError: document.querySelector('#length-error'),
  jointLimitError: document.querySelector('#joint-limit-error'),
  proportionProfile: document.querySelector('#proportion-profile'),
  physicsState: document.querySelector('#physics-state'),
  physicsToggle: document.querySelector('#physics-toggle'),
  gravityToggle: document.querySelector('#gravity-toggle'),
  groundToggle: document.querySelector('#ground-toggle'),
  poseStiffness: document.querySelector('#pose-stiffness'),
  poseStiffnessValue: document.querySelector('#pose-stiffness-value'),
  dampingRange: document.querySelector('#damping-range'),
  dampingValue: document.querySelector('#damping-value'),
  solverSelect: document.querySelector('#solver-select'),
  clearPinsButton: document.querySelector('#clear-pins-button'),
  skinToggle: document.querySelector('#skin-toggle'),
  skeletonToggle: document.querySelector('#skeleton-toggle'),
  skeletonXrayToggle: document.querySelector('#skeleton-xray-toggle'),
  skeletonDetail: document.querySelector('#skeleton-detail'),
  skinOpacity: document.querySelector('#skin-opacity'),
  skinOpacityValue: document.querySelector('#skin-opacity-value'),
  skinMode: document.querySelector('#skin-mode'),
  surfaceSource: document.querySelector('#surface-source'),
  gridToggle: document.querySelector('#grid-toggle'),
  axesToggle: document.querySelector('#axes-toggle'),
  spaceSelect: document.querySelector('#space-select'),
  statusMessage: document.querySelector('#status-message'),
  statusSelection: document.querySelector('#status-selection'),
  statusBackend: document.querySelector('#status-backend'),
  undoButton: document.querySelector('#undo-button'),
  redoButton: document.querySelector('#redo-button'),
  resetPoseButton: document.querySelector('#reset-pose-button'),
  poseAButton: document.querySelector('#pose-a-button'),
  poseTButton: document.querySelector('#pose-t-button'),
  freezeButton: document.querySelector('#freeze-button'),
  saveButton: document.querySelector('#save-button'),
  importLabel: document.querySelector('#import-label'),
  importInput: document.querySelector('#import-input'),
  exportButton: document.querySelector('#export-button'),
  dataButton: document.querySelector('#data-button'),
  jsonButton: document.querySelector('#json-button'),
  viewButtons: [...document.querySelectorAll('[data-view]')],
  inspectorEmpty: document.querySelector('#inspector-empty'),
  inspectorContent: document.querySelector('#inspector-content'),
  selectedLabel: document.querySelector('#selected-label'),
  selectedSide: document.querySelector('#selected-side'),
  selectedId: document.querySelector('#selected-id'),
  selectedParent: document.querySelector('#selected-parent'),
  selectedStandardName: document.querySelector('#selected-standard-name'),
  selectedStandardIndex: document.querySelector('#selected-standard-index'),
  bindLocalX: document.querySelector('#bind-local-x'),
  bindLocalY: document.querySelector('#bind-local-y'),
  bindLocalZ: document.querySelector('#bind-local-z'),
  selectedBoneLength: document.querySelector('#selected-bone-length'),
  poseWorldX: document.querySelector('#pose-world-x'),
  poseWorldY: document.querySelector('#pose-world-y'),
  poseWorldZ: document.querySelector('#pose-world-z'),
  selectedPinState: document.querySelector('#selected-pin-state'),
  selectedSpeed: document.querySelector('#selected-speed'),
  selectedLengthError: document.querySelector('#selected-length-error'),
  selectedJointType: document.querySelector('#selected-joint-type'),
  selectedJointRange: document.querySelector('#selected-joint-range'),
  selectedJointAngle: document.querySelector('#selected-joint-angle'),
  selectedLimitState: document.querySelector('#selected-limit-state'),
  pinJointButton: document.querySelector('#pin-joint-button'),
  returnJointButton: document.querySelector('#return-joint-button'),
  modal: document.querySelector('#data-modal'),
  modalClose: document.querySelector('#modal-close'),
  modalBody: document.querySelector('#data-table-body'),
  modalTabs: [...document.querySelectorAll('[data-modal-tab]')],
  modalPanels: [...document.querySelectorAll('[data-modal-panel]')],
  jsonEditor: document.querySelector('#json-editor'),
  jsonError: document.querySelector('#json-error'),
  formatJsonButton: document.querySelector('#format-json-button'),
  resetJsonTextButton: document.querySelector('#reset-json-text-button'),
  applyJsonButton: document.querySelector('#apply-json-button'),
  copyJsonButton: document.querySelector('#copy-json-button'),
  exportCsvButton: document.querySelector('#export-csv-button'),
  toastLayer: document.querySelector('#toast-layer'),
};

let definition = createStandardHumanoidPreset('A');
let physicsRig = null;
let selectedJointId = null;
let hoveredJointId = null;
let hoveredKind = null;
let currentViewType = 'front';
let currentDisplayMode = 'both';
let currentSurfaceSource = 'detail';
let activeModalTab = 'table';
let jsonDirty = false;
let dragStartCanonical = null;
let rendererLoading = false;
let rendererLoadAttempt = 0;
let dragEnterDepth = 0;
let fallbackView = null;
let threeView = null;
let simulationRigFrame = null;
let animationFrameId = 0;
let lastAnimationTime = performance.now();
let lastUiRefreshTime = 0;

const history = [];
let historyIndex = -1;

bootstrap().catch((error) => {
  console.error(error);
  showToast(error instanceof Error ? error.message : '编辑器初始化失败', 'error');
  dom.statusMessage.textContent = '编辑器初始化失败';
});

async function bootstrap() {
  restoreLocalDefinition();
  const requestedSource = URL_PARAMS.get('surfaceSource');
  currentSurfaceSource = normalizeSurfaceSource(requestedSource ?? definition.surface?.displaySource);
  definition.surface = definition.surface || {};
  definition.surface.displaySource = currentSurfaceSource;
  if (dom.surfaceSource) dom.surfaceSource.value = currentSurfaceSource;
  physicsRig = new PhysicsRig(definition, optionsFromDefinition(definition));
  syncPhysicsControls();
  setupUiEvents();
  setupFallbackView();
  selectedJointId = definition.joints.some((joint) => joint.id === 'hips')
    ? 'hips'
    : definition.joints[0]?.id ?? null;
  resetHistory('初始状态');
  setCameraView(URL_PARAMS.get('view') || (EMBED_MODE ? 'perspective' : 'front'), true);
  refreshAll({ fit: true });
  setDisplayMode(URL_PARAMS.get('displayMode') || 'both', { quiet: true });
  dom.statusMessage.textContent = EMBED_MODE && HOST_MODULE === 'proportion'
    ? '三维骨骼比例视口已启动，绑定尺寸由左侧比例控件实时驱动'
    : '唯一精细人物表皮已启用，可直接拖动人体网格或骨架带动全身';
  exposeDebugApi();
  setupHostBridge();
  notifyHostReady();
  animationFrameId = requestAnimationFrame(animationLoop);
  if (URL_PARAMS.get('renderer') === '2d') {
    setRendererState('2D 人体物理模式 · 手动指定', '2d', '2D 人体物理模式');
    dom.statusMessage.textContent = '二维人体关节限制模式已启动，可拖动关节或骨杆';
  } else {
    loadThreeRenderer();
  }
}

function optionsFromDefinition(value) {
  return {
    enabled: value.physics?.enabled ?? true,
    gravityEnabled: value.physics?.gravityEnabled ?? false,
    groundEnabled: value.physics?.groundEnabled ?? true,
    poseStiffness: value.physics?.poseStiffness ?? 0.20,
    damping: value.physics?.damping ?? 0.92,
    solverIterations: value.physics?.solverIterations ?? 64,
    anatomyEnabled: true,
  };
}

function setupFallbackView() {
  fallbackView = new SvgSkeletonView(dom.fallbackLayer, createViewCallbacks());
  fallbackView.setGridVisible(dom.gridToggle.checked);
  fallbackView.setAxesVisible(dom.axesToggle.checked);
  fallbackView.setSpace(dom.spaceSelect.value);
  dom.fallbackLayer.hidden = false;
}

function createViewCallbacks() {
  return {
    onSelect: selectJoint,
    onHover: handleViewHover,
    onDragStart: HOST_READ_ONLY ? handleReadOnlyDragStart : handleViewDragStart,
    onDrag: HOST_READ_ONLY ? () => {} : handleViewDrag,
    onDragEnd: HOST_READ_ONLY ? () => {} : handleViewDragEnd,
    onSurfaceState: updateSurfaceState,
  };
}

function handleReadOnlyDragStart({ jointId }) {
  selectJoint(jointId);
  dom.statusMessage.textContent = '当前模块使用只读人物视口，请在动作与物理工作台调整姿势';
}

function setupUiEvents() {
  dom.undoButton.addEventListener('click', undo);
  dom.redoButton.addEventListener('click', redo);
  dom.resetPoseButton.addEventListener('click', resetToBindPose);
  dom.poseAButton.addEventListener('click', () => applyPosePreset('A'));
  dom.poseTButton.addEventListener('click', () => applyPosePreset('T'));
  dom.freezeButton.addEventListener('click', freezeMotion);
  dom.saveButton.addEventListener('click', () => saveLocalDefinition(false));
  dom.exportButton.addEventListener('click', exportJson);
  dom.importInput.addEventListener('change', importJsonFile);
  dom.importLabel.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dom.importInput.click();
    }
  });

  dom.dataButton.addEventListener('click', () => openDataModal('table'));
  dom.jsonButton.addEventListener('click', () => openDataModal('json'));
  dom.modalClose.addEventListener('click', closeDataModal);
  dom.copyJsonButton.addEventListener('click', copyJsonToClipboard);
  dom.exportCsvButton.addEventListener('click', exportCsv);
  dom.formatJsonButton.addEventListener('click', formatJsonEditor);
  dom.resetJsonTextButton.addEventListener('click', populateJsonEditor);
  dom.applyJsonButton.addEventListener('click', applyJsonEditor);
  dom.jsonEditor.addEventListener('input', () => {
    jsonDirty = true;
    clearJsonError();
  });
  dom.modal.addEventListener('click', (event) => {
    if (event.target === dom.modal) {
      closeDataModal();
    }
  });
  for (const tab of dom.modalTabs) {
    tab.addEventListener('click', () => switchModalTab(tab.dataset.modalTab));
  }
  dom.modalBody.addEventListener('change', onDataTableChange);
  dom.modalBody.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-joint-id]');
    if (row) {
      selectJoint(row.dataset.jointId);
    }
  });
  dom.modalBody.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.target.blur();
    }
  });

  for (const button of dom.viewButtons) {
    button.addEventListener('click', () => setCameraView(button.dataset.view));
  }
  dom.jointSearch.addEventListener('input', renderJointList);

  dom.physicsToggle.addEventListener('change', updatePhysicsOptionsFromControls);
  dom.gravityToggle.addEventListener('change', updatePhysicsOptionsFromControls);
  dom.groundToggle.addEventListener('change', updatePhysicsOptionsFromControls);
  dom.poseStiffness.addEventListener('input', updatePhysicsOptionsFromControls);
  dom.dampingRange.addEventListener('input', updatePhysicsOptionsFromControls);
  dom.solverSelect.addEventListener('change', updatePhysicsOptionsFromControls);
  dom.clearPinsButton.addEventListener('click', clearPins);

  for (const button of dom.displayModeButtons) {
    button.addEventListener('click', () => setDisplayMode(button.dataset.displayMode));
  }
  dom.skinToggle.addEventListener('change', syncDisplayModeFromToggles);
  dom.skeletonToggle.addEventListener('change', syncDisplayModeFromToggles);
  dom.surfaceRetryButton?.addEventListener('click', reloadSurfaceLayer);
  dom.surfaceReloadToolbarButton?.addEventListener('click', reloadSurfaceLayer);
  dom.skeletonXrayToggle.addEventListener('change', () => {
    threeView?.setSkeletonXray(dom.skeletonXrayToggle.checked);
  });
  dom.skeletonDetail?.addEventListener('change', () => {
    threeView?.setSkeletonDetail(dom.skeletonDetail.value);
    dom.statusMessage.textContent = `骨架细节已切换为${dom.skeletonDetail.selectedOptions[0]?.textContent ?? '完整表现层'}`;
  });
  dom.skinOpacity.addEventListener('input', () => {
    const value = Number(dom.skinOpacity.value);
    dom.skinOpacityValue.value = value.toFixed(2);
    threeView?.setSkinOpacity(value);
  });
  dom.skinMode.addEventListener('change', () => {
    threeView?.setSkinMode(dom.skinMode.value);
    if (dom.skinMode.value === 'solid') {
      dom.skinOpacity.value = '1';
      dom.skinOpacityValue.value = '1.00';
      threeView?.setSkinOpacity(1);
    }
  });
  dom.surfaceSource?.addEventListener('change', () => {
    currentSurfaceSource = 'detail';
    dom.surfaceSource.value = 'detail';
    definition.surface = definition.surface || {};
    definition.surface.displaySource = 'detail';
    threeView?.setSkinSource('detail');
    saveLocalDefinition(true);
    dom.statusMessage.textContent = '已锁定唯一精细 SMPL 表皮，人体网格直接承担显示与鼠标拾取';
  });

  dom.gridToggle.addEventListener('change', () => {
    fallbackView?.setGridVisible(dom.gridToggle.checked);
    threeView?.setGridVisible(dom.gridToggle.checked);
  });
  dom.axesToggle.addEventListener('change', () => {
    fallbackView?.setAxesVisible(dom.axesToggle.checked);
    threeView?.setAxesVisible(dom.axesToggle.checked);
  });
  dom.spaceSelect.addEventListener('change', () => {
    fallbackView?.setSpace(dom.spaceSelect.value);
    threeView?.setSpace(dom.spaceSelect.value);
  });

  bindPoseInput(dom.poseWorldX, 'x');
  bindPoseInput(dom.poseWorldY, 'y');
  bindPoseInput(dom.poseWorldZ, 'z');
  dom.pinJointButton.addEventListener('click', toggleSelectedPin);
  dom.returnJointButton.addEventListener('click', returnSelectedJointToBind);
  dom.retryRendererButton.addEventListener('click', loadThreeRenderer);

  window.addEventListener('keydown', onGlobalKeyDown);
  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(animationFrameId);
    saveLocalDefinition(true);
    threeView?.dispose();
  });

  dom.viewportShell.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragEnterDepth += 1;
    dom.dropOverlay.hidden = false;
  });
  dom.viewportShell.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  });
  dom.viewportShell.addEventListener('dragleave', (event) => {
    event.preventDefault();
    dragEnterDepth = Math.max(0, dragEnterDepth - 1);
    if (dragEnterDepth === 0) {
      dom.dropOverlay.hidden = true;
    }
  });
  dom.viewportShell.addEventListener('drop', async (event) => {
    event.preventDefault();
    dragEnterDepth = 0;
    dom.dropOverlay.hidden = true;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      await importJsonFromFile(file);
    }
  });
}

function animationLoop(now) {
  const delta = Math.min(0.05, Math.max(1 / 240, (now - lastAnimationTime) / 1000));
  lastAnimationTime = now;
  const options = physicsRig.getOptions();
  const shouldStep = physicsRig.active || options.gravityEnabled || Boolean(physicsRig.getDragState());
  let changed = false;
  if (shouldStep) {
    changed = physicsRig.step(delta);
  }
  if (changed || shouldStep) {
    refreshViews();
  }
  if (now - lastUiRefreshTime > 90) {
    updateSummary();
    updateInspectorDynamic();
    if (isDataModalOpen() && activeModalTab === 'table' && document.activeElement?.dataset?.field !== 'pose') {
      renderDataTable();
    }
    lastUiRefreshTime = now;
  }
  animationFrameId = requestAnimationFrame(animationLoop);
}

function updatePhysicsOptionsFromControls() {
  dom.poseStiffnessValue.value = Number(dom.poseStiffness.value).toFixed(2);
  dom.dampingValue.value = Number(dom.dampingRange.value).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  physicsRig.setOptions({
    enabled: dom.physicsToggle.checked,
    gravityEnabled: dom.gravityToggle.checked,
    groundEnabled: dom.groundToggle.checked,
    poseStiffness: Number(dom.poseStiffness.value),
    damping: Number(dom.dampingRange.value),
    solverIterations: Number(dom.solverSelect.value),
  });
  updateSummary();
  dom.statusMessage.textContent = dom.physicsToggle.checked
    ? '固定骨长与人体关节活动限制已启用'
    : '连续模拟已暂停，拖动时仍会执行人体关节限制';
}

function syncPhysicsControls() {
  const options = optionsFromDefinition(definition);
  dom.physicsToggle.checked = Boolean(options.enabled);
  dom.gravityToggle.checked = Boolean(options.gravityEnabled);
  dom.groundToggle.checked = Boolean(options.groundEnabled);
  dom.poseStiffness.value = String(options.poseStiffness);
  dom.poseStiffnessValue.value = Number(options.poseStiffness).toFixed(2);
  dom.dampingRange.value = String(options.damping);
  dom.dampingValue.value = Number(options.damping).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  dom.solverSelect.value = String([16, 40, 64, 96].includes(Number(options.solverIterations))
    ? Number(options.solverIterations)
    : 64);
}

function refreshAll({ fit = false, list = true } = {}) {
  refreshViews();
  updateSummary();
  if (list) {
    renderJointList();
  }
  updateInspector();
  updateModalContent();
  if (fit) {
    fallbackView?.fitToDefinition();
    threeView?.setView(currentViewType);
  }
}

function refreshAfterPoseChange({ list = false, fit = false } = {}) {
  refreshViews();
  updateSummary();
  updateInspector();
  if (list) {
    renderJointList();
  }
  if (isDataModalOpen() && activeModalTab === 'table') {
    renderDataTable();
  }
  if (fit) {
    fallbackView?.fitToDefinition();
    threeView?.setView(currentViewType);
  }
}

function refreshViews() {
  fallbackView?.refresh(definition, selectedJointId, hoveredJointId, hoveredKind);
  simulationRigFrame = physicsRig?.getSimulationRigFrame?.({
    frameId: simulationRigFrame?.frameId ?? null,
  }) ?? null;
  threeView?.setSimulationRigFrame?.(simulationRigFrame);
  threeView?.refresh(definition, selectedJointId, hoveredJointId, hoveredKind);
}

function selectJoint(jointId) {
  const joint = definition.joints.find((item) => item.id === jointId);
  selectedJointId = joint ? joint.id : null;
  if (!selectedJointId) {
    dom.inspectorEmpty.hidden = false;
    dom.inspectorContent.hidden = true;
    dom.statusSelection.textContent = '未选择关节';
  } else {
    dom.inspectorEmpty.hidden = true;
    dom.inspectorContent.hidden = false;
    dom.statusSelection.textContent = `${joint.label} · ${joint.id}`;
  }
  refreshViews();
  updateInspector();
  renderJointList();
  if (isDataModalOpen() && activeModalTab === 'table') {
    renderDataTable();
  }
}

function handleViewHover(jointId, kind, clientX, clientY, axis = null) {
  if (kind === 'gizmo') {
    if (hoveredJointId || hoveredKind) {
      hoveredJointId = null;
      hoveredKind = null;
      refreshViews();
    }
    const axisText = axis === 'free' ? '自由拖动关节' : `${String(axis).toUpperCase()} 轴拖动关节`;
    showInteractionTooltip(axisText, clientX, clientY);
    return;
  }

  const joint = definition.joints.find((item) => item.id === jointId);
  const nextJointId = joint ? joint.id : null;
  const nextKind = nextJointId && (kind === 'joint' || kind === 'bone') ? kind : null;
  const changed = nextJointId !== hoveredJointId || nextKind !== hoveredKind;
  hoveredJointId = nextJointId;
  hoveredKind = nextKind;
  if (changed) {
    refreshViews();
  }

  if (!nextJointId) {
    hideInteractionTooltip();
    return;
  }
  const suffix = nextKind === 'bone'
    ? '骨杆，拖动整段并带动全身'
    : '关节球，拖动时保持全部骨长';
  showInteractionTooltip(`${joint.label} · ${suffix}`, clientX, clientY);
}

function showInteractionTooltip(text, clientX, clientY) {
  const bounds = dom.viewportShell.getBoundingClientRect();
  dom.selectionLabel.textContent = text;
  dom.selectionLabel.hidden = false;
  const desiredX = clientX - bounds.left + 15;
  const desiredY = clientY - bounds.top - 38;
  const maxX = Math.max(8, bounds.width - 260);
  const maxY = Math.max(8, bounds.height - 42);
  dom.selectionLabel.style.transform = `translate(${Math.min(maxX, Math.max(8, desiredX))}px, ${Math.min(maxY, Math.max(8, desiredY))}px)`;
}

function hideInteractionTooltip() {
  dom.selectionLabel.hidden = true;
}

function handleViewDragStart({ jointId, kind, anchorWorld }) {
  selectJoint(jointId);
  dragStartCanonical = canonicalDefinition(definition);
  physicsRig.beginDrag({ jointId, kind, anchorWorld });
  const joint = getSelectedJoint();
  dom.statusMessage.textContent = kind === 'bone'
    ? `正在拖动 ${joint?.label ?? jointId} 对应骨杆，全身约束同步求解`
    : `正在拖动 ${joint?.label ?? jointId}，全身约束同步求解`;
}

function handleViewDrag({ worldPosition }) {
  try {
    physicsRig.updateDragTarget(worldPosition);
    refreshAfterPoseChange();
  } catch (error) {
    console.error(error);
  }
}

function handleViewDragEnd({ jointId, kind, changed }) {
  physicsRig.endDrag({ keepMomentum: dom.gravityToggle.checked });
  if (!dom.gravityToggle.checked) {
    physicsRig.zeroVelocities({ capturePose: true });
  }
  physicsRig.writePoseToDefinition(true);
  refreshAfterPoseChange({ list: true });

  const currentCanonical = canonicalDefinition(definition);
  if (changed && dragStartCanonical !== currentCanonical) {
    pushHistory(kind === 'bone' ? '物理拖动骨杆' : '物理拖动关节');
  }
  dragStartCanonical = null;
  const joint = definition.joints.find((item) => item.id === jointId);
  dom.statusMessage.textContent = `${joint?.label ?? jointId} 已完成全身物理求解，骨长保持锁定`;
}

function bindPoseInput(input, axis) {
  input.addEventListener('change', () => {
    const joint = getSelectedJoint();
    const value = Number(input.value);
    if (!joint || !Number.isFinite(value)) {
      updateInspector();
      return;
    }
    const point = physicsRig.getPoint(joint.id);
    physicsRig.moveJointTo(joint.id, { ...point, [axis]: value });
    refreshAfterPoseChange({ list: true });
    pushHistory(`输入 ${joint.id} 姿势位置`);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      input.blur();
    }
  });
}

function toggleSelectedPin() {
  const joint = getSelectedJoint();
  if (!joint) {
    return;
  }
  const pinned = physicsRig.togglePin(joint.id);
  physicsRig.writePoseToDefinition(false);
  refreshAfterPoseChange({ list: true });
  pushHistory(pinned ? '固定关节' : '取消固定关节');
  showToast(pinned ? `${joint.label} 已固定` : `${joint.label} 已恢复自由`);
}

function clearPins() {
  physicsRig.clearPins();
  physicsRig.writePoseToDefinition(false);
  refreshAfterPoseChange({ list: true });
  pushHistory('取消全部固定关节');
  showToast('已取消全部固定关节');
}

function returnSelectedJointToBind() {
  const joint = getSelectedJoint();
  if (!joint) {
    return;
  }
  const bind = computeRestWorldPositions(definition).get(joint.id);
  physicsRig.moveJointTo(joint.id, bind);
  refreshAfterPoseChange({ list: true });
  pushHistory('关节拉回绑定位置');
  showToast(`${joint.label} 已在固定骨长约束下拉回绑定位置`);
}

function resetToBindPose() {
  physicsRig.resetToBindPose();
  refreshAll({ fit: true });
  pushHistory('恢复绑定姿势');
  showToast('已恢复绑定姿势，骨架尺寸未改变');
}

function applyPosePreset(pose) {
  applyPosePresetToDefinition(definition, pose);
  physicsRig.resetFromDefinitionPose({ project: true });
  physicsRig.zeroVelocities();
  refreshAll({ fit: true });
  pushHistory(`应用 ${pose} 姿势`);
  showToast(`已应用 ${pose} 姿势，全部骨长保持固定`);
}

function freezeMotion() {
  physicsRig.commitCurrentPose();
  refreshAfterPoseChange();
  dom.statusMessage.textContent = '当前运动已停止，姿势已稳定';
  showToast('物理运动已停止');
}

function updateInspector() {
  const joint = getSelectedJoint();
  if (!joint) {
    dom.inspectorEmpty.hidden = false;
    dom.inspectorContent.hidden = true;
    return;
  }

  dom.inspectorEmpty.hidden = true;
  dom.inspectorContent.hidden = false;
  dom.selectedLabel.textContent = joint.label;
  dom.selectedId.textContent = joint.id;
  dom.selectedSide.textContent = sideLabel(joint.side);
  dom.selectedSide.dataset.side = joint.side;
    const parentJoint = joint.parentId
    ? definition.joints.find((item) => item.id === joint.parentId)
    : null;
  dom.selectedParent.textContent = parentJoint
    ? `${parentJoint.label}${joint.physicalBone === false ? '（无骨杆）' : ''}`
    : '无，根节点';
  const standard = joint.standard ?? {};
  dom.selectedStandardName.textContent = standard.family === 'SMPL'
    ? `SMPL ${standard.name ?? joint.id}`
    : standard.name ?? '编辑器辅助点';
  dom.selectedStandardIndex.textContent = Number.isInteger(standard.index)
    ? String(standard.index)
    : '辅助点';
  setNumberValue(dom.bindLocalX, joint.localPosition[0]);
  setNumberValue(dom.bindLocalY, joint.localPosition[1]);
  setNumberValue(dom.bindLocalZ, joint.localPosition[2]);
  dom.selectedBoneLength.textContent = joint.parentId && joint.physicalBone !== false
    ? `${formatNumber(getBoneLength(definition, joint.id), 5)} m`
    : '无骨杆';
  updateInspectorDynamic();
  dom.statusSelection.textContent = `${joint.label} · ${joint.id}`;
}

function updateInspectorDynamic() {
  const joint = getSelectedJoint();
  if (!joint || dom.inspectorContent.hidden) {
    return;
  }
  const point = physicsRig.getPoint(joint.id);
  if (document.activeElement !== dom.poseWorldX) setNumberValue(dom.poseWorldX, point.x);
  if (document.activeElement !== dom.poseWorldY) setNumberValue(dom.poseWorldY, point.y);
  if (document.activeElement !== dom.poseWorldZ) setNumberValue(dom.poseWorldZ, point.z);

  const pinned = Boolean(joint.pinned);
  dom.selectedPinState.textContent = pinned ? '已固定' : '自由';
  dom.pinJointButton.textContent = pinned ? '取消固定此关节' : '固定此关节';
  const velocity = physicsRig.getVelocity(joint.id);
  dom.selectedSpeed.textContent = formatNumber(Math.hypot(velocity.x, velocity.y, velocity.z), 3);
  const lengthError = joint.parentId && joint.physicalBone !== false
    ? Math.abs(getCurrentBoneLength(definition, joint.id) - getBoneLength(definition, joint.id)) * 1000
    : 0;
  dom.selectedLengthError.textContent = formatNumber(lengthError, 4);

  const limitInfo = physicsRig.getJointLimitInfo(joint.id);
  dom.selectedJointType.textContent = limitInfo?.typeLabel ?? '固定骨段节点';
  dom.selectedJointRange.textContent = limitInfo?.rangeLabel ?? joint.limitLabel ?? '由相邻关节控制';
  dom.selectedJointAngle.textContent = limitInfo?.currentLabel ?? '由相邻关节控制';
  const withinLimits = limitInfo?.withinLimits !== false;
  dom.selectedLimitState.textContent = withinLimits ? '范围内' : '正在校正';
  dom.selectedLimitState.dataset.ok = withinLimits ? 'true' : 'false';
}

function renderJointList() {
  const query = dom.jointSearch.value.trim().toLowerCase();
  dom.jointList.replaceChildren();
  const depths = getJointDepths(definition);
  const matches = definition.joints.filter((joint) => {
    if (!query) return true;
    return joint.id.toLowerCase().includes(query)
      || joint.label.toLowerCase().includes(query)
      || String(joint.role ?? '').toLowerCase().includes(query);
  });

  if (!matches.length) {
    const empty = document.createElement('div');
    empty.className = 'list-empty';
    empty.textContent = '没有匹配的关节';
    dom.jointList.append(empty);
    return;
  }

  for (const joint of matches) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'joint-row';
    row.classList.toggle('is-selected', joint.id === selectedJointId);
    row.classList.toggle('is-pinned', Boolean(joint.pinned));
    row.style.setProperty('--depth', query ? 0 : depths.get(joint.id) ?? 0);
    row.dataset.jointId = joint.id;
    row.dataset.role = joint.role ?? 'deform';
    row.dataset.tier = joint.rigTier ?? 'core';
    row.setAttribute('role', 'treeitem');
    row.setAttribute('aria-selected', joint.id === selectedJointId ? 'true' : 'false');

    const marker = document.createElement('span');
    marker.className = 'joint-side-marker';
    marker.dataset.side = joint.side;

    const text = document.createElement('span');
    text.className = 'joint-row-text';
    const label = document.createElement('strong');
    label.textContent = joint.label;
    const id = document.createElement('small');
    id.textContent = joint.id;
    text.append(label, id);

    const role = document.createElement('span');
    role.className = 'joint-role-badge';
    role.dataset.role = joint.role ?? 'deform';
    role.textContent = ({
      deform: joint.visualShape === 'twist' ? '扭转' : '变形',
      control: '控制',
      marker: '标记',
      corrective: '校正',
      socket: '挂点',
    })[joint.role] ?? '节点';

    const length = document.createElement('span');
    length.className = 'joint-row-length';
    length.textContent = joint.parentId && joint.physicalBone !== false
      ? `${formatNumber(getBoneLength(definition, joint.id), 3)} m`
      : joint.isControl ? '目标' : '派生';

    row.append(marker, text, role, length);
    row.addEventListener('click', () => selectJoint(joint.id));
    dom.jointList.append(row);
  }
}

function updateSummary() {
  const maxErrorMm = physicsRig ? physicsRig.getMaxBoneError() * 1000 : 0;
  const maxJointViolation = physicsRig ? physicsRig.getMaxJointLimitViolation() : 0;
  const options = physicsRig?.getOptions();
  const rigSummary = summarizeRigDefinition(definition);
  const profile = definition.anthropometry;
  dom.poseName.textContent = definition.pose || 'CUSTOM';
  dom.jointCount.textContent = String(rigSummary.counts.total);
  dom.deformCount.textContent = String(rigSummary.counts.deform + rigSummary.counts.corrective);
  dom.helperCount.textContent = `${rigSummary.counts.control} / ${rigSummary.counts.marker}`;
  dom.rigHeight.textContent = `${formatNumber(calculateRigHeight(definition), 3)} m`;
  dom.lengthError.textContent = maxErrorMm < 0.00001
    ? '< 0.00001 mm'
    : `${formatNumber(maxErrorMm, maxErrorMm < 0.01 ? 6 : 3)} mm`;
  dom.lengthError.dataset.ok = maxErrorMm < 0.001 ? 'true' : 'false';
  dom.jointLimitError.textContent = maxJointViolation < 0.01
    ? '< 0.01°'
    : `${formatNumber(maxJointViolation, 2)}°`;
  dom.jointLimitError.dataset.ok = maxJointViolation < 0.05 ? 'true' : 'false';
  dom.proportionProfile.textContent = profile?.label
    ?? (profile?.referenceStature ? `SMPL ${formatNumber(profile.referenceStature, 3)} m` : 'SMPL 标准');

  if (!options?.enabled) {
    dom.physicsState.textContent = '手动约束';
  } else if (physicsRig.getDragState()) {
    dom.physicsState.textContent = '人体求解';
  } else if (options.gravityEnabled) {
    dom.physicsState.textContent = '重力运行';
  } else if (physicsRig.active) {
    dom.physicsState.textContent = '稳定中';
  } else {
    dom.physicsState.textContent = '限制内稳定';
  }
}

function setDisplayMode(mode, { quiet = false } = {}) {
  const nextMode = ['skin', 'skeleton', 'both'].includes(mode) ? mode : 'both';
  currentDisplayMode = nextMode;
  const showSkin = nextMode === 'skin' || nextMode === 'both';
  const showSkeleton = nextMode === 'skeleton' || nextMode === 'both';

  dom.skinToggle.checked = showSkin;
  dom.skeletonToggle.checked = showSkeleton;
  for (const button of dom.displayModeButtons) {
    const active = button.dataset.displayMode === nextMode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  threeView?.setSkinVisible(showSkin);
  threeView?.setSkeletonVisible(showSkeleton);
  if (!quiet) {
    const labels = {
      skin: '已切换为人物表皮模式，可以直接拖动身体表面',
      skeleton: '已切换为骨架模式',
      both: '已同时显示人物表皮与骨架',
    };
    dom.statusMessage.textContent = labels[nextMode];
  }
}

function syncDisplayModeFromToggles() {
  const showSkin = dom.skinToggle.checked;
  const showSkeleton = dom.skeletonToggle.checked;
  if (!showSkin && !showSkeleton) {
    // The viewport must never become completely empty.
    dom.skinToggle.checked = true;
    setDisplayMode('skin');
    return;
  }
  setDisplayMode(showSkin && showSkeleton ? 'both' : showSkin ? 'skin' : 'skeleton');
}

function setSkinVisibility(visible, { quiet = false } = {}) {
  const showSkin = Boolean(visible);
  if (showSkin) {
    setDisplayMode(currentDisplayMode === 'skeleton' ? 'both' : currentDisplayMode, { quiet });
  } else {
    setDisplayMode('skeleton', { quiet });
  }
}

async function reloadSurfaceLayer() {
  if (!threeView) {
    updateSurfaceState({
      state: 'loading',
      label: '等待三维视图',
      detail: '三维渲染器启动后会自动加载人物表皮',
    });
    if (!rendererLoading) loadThreeRenderer();
    return;
  }
  setDisplayMode(currentDisplayMode === 'skeleton' ? 'both' : currentDisplayMode, { quiet: true });
  updateSurfaceState({
    state: 'loading',
    label: '正在重新加载人物表皮',
    detail: '读取本地 GLB，并重建四关节姿势权重',
  });
  dom.surfaceRetryButton?.setAttribute('disabled', '');
  dom.surfaceReloadToolbarButton?.setAttribute('disabled', '');
  try {
    const layer = await threeView.reloadSkinLayer();
    if (!layer) {
      throw new Error('表皮层没有完成初始化。');
    }
    threeView.setSkinSource(currentSurfaceSource);
    threeView.setSkinVisible(currentDisplayMode !== 'skeleton');
    threeView.setSkinMode(dom.skinMode.value);
    threeView.setSkinOpacity(Number(dom.skinOpacity.value));
    showToast('人物表皮已重新加载');
  } catch (error) {
    console.error(error);
    updateSurfaceState({
      state: 'error',
      label: '人物表皮重新加载失败',
      detail: error instanceof Error ? error.message : String(error),
    });
    showToast(error instanceof Error ? error.message : '人物表皮重新加载失败', 'error');
  } finally {
    dom.surfaceRetryButton?.removeAttribute('disabled');
    dom.surfaceReloadToolbarButton?.removeAttribute('disabled');
  }
}

function setCameraView(viewType, quiet = false) {
  currentViewType = ['front', 'side', 'top', 'perspective'].includes(viewType)
    ? viewType
    : 'front';
  for (const button of dom.viewButtons) {
    button.classList.toggle('is-active', button.dataset.view === currentViewType);
  }
  fallbackView?.setView(currentViewType);
  threeView?.setView(currentViewType);
  if (!quiet) {
    const labels = { front: '正面', side: '侧面', top: '顶部', perspective: '透视' };
    dom.statusMessage.textContent = `已切换到${labels[currentViewType]}视角`;
  }
}

async function loadThreeRenderer() {
  if (rendererLoading) return;
  rendererLoading = true;
  rendererLoadAttempt += 1;
  const attempt = rendererLoadAttempt;
  dom.errorPanel.hidden = true;
  setRendererState('正在寻找 Three.js WebGPU 运行库', 'loading', '加载中');
  updateSurfaceState({ state: 'loading', label: '人物表皮等待三维渲染器', detail: '准备加载本地人体表面' });

  if (threeView) {
    threeView.dispose();
    threeView = null;
  }
  dom.threeLayer.hidden = true;
  dom.fallbackLayer.hidden = false;

  const errors = [];
  for (const candidate of createThreeModuleCandidates(attempt)) {
    try {
      dom.statusMessage.textContent = `正在从${candidate.label}加载三维运行库`;
      const THREE = await importWithTimeout(candidate.url, candidate.timeoutMs);
      if (typeof THREE.WebGPURenderer !== 'function') {
        throw new Error('模块中没有 WebGPURenderer。');
      }
      const view = await createThreeSkeletonView(THREE, dom.threeLayer, createViewCallbacks());
      if (attempt !== rendererLoadAttempt) {
        view.dispose();
        return;
      }
      threeView = view;
      setDisplayMode(currentDisplayMode, { quiet: true });
      threeView.setSkinSource(currentSurfaceSource);
      threeView.setSkeletonXray(dom.skeletonXrayToggle.checked);
      threeView.setSkeletonDetail(dom.skeletonDetail?.value ?? 'performance');
      threeView.setSkinOpacity(Number(dom.skinOpacity.value));
      threeView.setSkinMode(dom.skinMode.value);
      threeView.setGridVisible(dom.gridToggle.checked);
      threeView.setAxesVisible(dom.axesToggle.checked);
      threeView.setSpace(dom.spaceSelect.value);
      threeView.refresh(definition, selectedJointId, hoveredJointId, hoveredKind);
      threeView.setView(currentViewType);
      dom.fallbackLayer.hidden = true;
      dom.threeLayer.hidden = false;
      dom.errorPanel.hidden = true;
      setRendererState(`${view.backendName} · Three.js r${THREE.REVISION ?? '185'}`, normalizeBackendKey(view.backendName), view.backendName);
      dom.statusMessage.textContent = '三维标准骨架已启动，人物表皮正在附着并生成蒙皮权重';
      rendererLoading = false;
      showToast(`三维视图已使用 ${view.backendName} 启动`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${candidate.label}: ${message}`);
      console.warn(`Unable to load Three.js from ${candidate.label}.`, error);
    }
  }

  rendererLoading = false;
  dom.fallbackLayer.hidden = false;
  dom.threeLayer.hidden = true;
  setRendererState('2D 物理模式 · 三维库未连接', '2d', '2D 物理模式');
  dom.errorPanel.hidden = false;
  dom.errorPanel.querySelector('p').textContent = summarizeRendererErrors(errors);
  dom.statusMessage.textContent = '三维库加载失败，二维固定骨长物理编辑仍可使用';
  updateSurfaceState({ state: 'error', label: '人物表皮未启动', detail: '需要通过本地服务器加载 Three.js' });
}

function createThreeModuleCandidates(attempt) {
  const cacheTag = `riglab=${attempt}`;
  return [
    { label: '本地 npm 依赖', url: `/node_modules/three/build/three.webgpu.js?${cacheTag}`, timeoutMs: 1800 },
    { label: '项目 vendor 目录', url: `/vendor/three.webgpu.js?${cacheTag}`, timeoutMs: 1800 },
    { label: 'jsDelivr', url: `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.webgpu.js?${cacheTag}`, timeoutMs: 7000 },
    { label: 'UNPKG', url: `https://unpkg.com/three@${THREE_VERSION}/build/three.webgpu.js?${cacheTag}`, timeoutMs: 7000 },
    { label: 'Three.js 官方构建', url: `https://threejs.org/build/three.webgpu.js?${cacheTag}`, timeoutMs: 7000 },
  ];
}

async function importWithTimeout(url, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`加载超时 ${Math.round(timeoutMs / 1000)} 秒`)), timeoutMs);
  });
  try {
    return await Promise.race([import(/* @vite-ignore */ url), timeout]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function summarizeRendererErrors(errors) {
  if (!errors.length) {
    return '未能加载 Three.js。请关闭页面并双击“安装本地三维库并打开.bat”，安装完成后会从本地启动三维视图。';
  }
  return `已尝试本地依赖和备用地址。可双击“安装本地三维库并打开.bat”建立稳定的本地三维环境。最后错误：${errors.at(-1).replace(/^.*?:\s*/, '')}`;
}

function updateSurfaceState({ state = 'loading', label = '人物表皮', detail = '' } = {}) {
  if (!dom.surfaceState) return;
  dom.surfaceState.dataset.state = state;
  const strong = dom.surfaceState.querySelector('strong');
  const small = dom.surfaceState.querySelector('small');
  if (strong) strong.textContent = label;
  if (small) small.textContent = detail;
  const isBusy = state === 'loading' || state === 'binding';
  dom.surfaceRetryButton?.toggleAttribute('disabled', isBusy);
  if (state === 'ready') {
    dom.statusMessage.textContent = '精细人物表皮已附着，基础表皮已完全移出渲染，只保留隐藏拾取代理';
  } else if (state === 'preview') {
    dom.statusMessage.textContent = '基础人体表皮正在作为加载占位，可立即交互';
  } else if (state === 'fallback') {
    dom.statusMessage.textContent = '基础人体表皮保持可见，可以继续进行全身交互';
  }
  postHostMessage('HRL_SURFACE_STATUS', {
    surface: {
      state,
      label,
      detail,
      diagnostics: threeView?.getSurfaceDiagnostics?.() ?? null,
    },
  });
}

function normalizeSurfaceSource(_value) {
  return 'detail';
}


function setRendererState(text, backendKey, backendLabel) {
  dom.rendererState.textContent = text;
  dom.rendererState.dataset.backend = backendKey;
  dom.statusBackend.textContent = backendLabel;
  postHostMessage('HRL_RENDERER_STATUS', {
    state: backendKey === 'loading' ? 'loading' : backendKey === '2d' ? 'error' : 'ready',
    backend: backendLabel,
    text,
  });
}

function normalizeBackendKey(name) {
  return String(name).toLowerCase().replaceAll(' ', '-');
}

async function importJsonFile(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (file) await importJsonFromFile(file);
}

async function importJsonFromFile(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const applied = applyPosePayload(definition, parsed);
    physicsRig.resetFromDefinitionPose({ project: true });
    physicsRig.projectConstraints(64);
    physicsRig.zeroVelocities();
    physicsRig.writePoseToDefinition(true);
    jsonDirty = false;
    refreshAfterPoseChange({ list: true, fit: true });
    populateJsonEditor();
    pushHistory(`导入姿势 ${file.name}`);
    dom.statusMessage.textContent = `已导入 ${applied} 个关节的姿势，模型尺寸保持锁定`;
    showToast(`已导入 ${applied} 个关节的姿势，父级、绑定坐标和骨长均未改写`);
  } catch (error) {
    console.error(error);
    showToast(error instanceof Error ? error.message : '姿势 JSON 导入失败', 'error');
  }
}

function exportJson() {
  const payload = buildExportPayload(definition);
  downloadText(
    `humanoid-physics-rig-${dateStamp()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json;charset=utf-8',
  );
  dom.statusMessage.textContent = '骨架与姿势 JSON 已导出';
  showToast('已导出只读绑定尺寸、固定骨长和当前姿势数据');
}

function openDataModal(tab = 'table') {
  dom.modal.classList.add('is-open');
  dom.modal.setAttribute('aria-hidden', 'false');
  switchModalTab(tab);
}

function closeDataModal() {
  dom.modal.classList.remove('is-open');
  dom.modal.setAttribute('aria-hidden', 'true');
}

function isDataModalOpen() {
  return dom.modal.classList.contains('is-open');
}

function switchModalTab(tabName) {
  activeModalTab = tabName === 'json' ? 'json' : 'table';
  for (const tab of dom.modalTabs) {
    const active = tab.dataset.modalTab === activeModalTab;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  for (const panel of dom.modalPanels) {
    const active = panel.dataset.modalPanel === activeModalTab;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  }
  if (activeModalTab === 'table') renderDataTable();
  else if (!jsonDirty) populateJsonEditor();
}

function updateModalContent() {
  if (!isDataModalOpen()) return;
  if (activeModalTab === 'table') renderDataTable();
  else if (!jsonDirty && document.activeElement !== dom.jsonEditor) populateJsonEditor();
}

function renderDataTable() {
  if (!isDataModalOpen() || activeModalTab !== 'table') return;
  const pose = computePoseWorldPositions(definition);
  dom.modalBody.replaceChildren();

  for (const joint of definition.joints) {
    if (joint.isControl) {
      continue;
    }
    const row = document.createElement('tr');
    row.dataset.jointId = joint.id;
    row.classList.toggle('is-selected', joint.id === selectedJointId);

    const nameCell = document.createElement('td');
    const nameWrap = document.createElement('div');
    nameWrap.className = 'table-name-wrap';
    const name = document.createElement('strong');
    name.textContent = joint.label;
    const id = document.createElement('code');
    id.textContent = joint.id;
    nameWrap.append(name, id);
    nameCell.append(nameWrap);
    row.append(nameCell);

        const parentJoint = joint.parentId
      ? definition.joints.find((item) => item.id === joint.parentId)
      : null;
    appendTextCell(
      row,
      parentJoint ? `${parentJoint.label}${joint.physicalBone === false ? '（无骨杆）' : ''}` : '无',
      'readonly-cell',
    );
    appendTextCell(row, formatNumber(joint.localPosition[0], 5), 'readonly-cell');
    appendTextCell(row, formatNumber(joint.localPosition[1], 5), 'readonly-cell');
    appendTextCell(row, formatNumber(joint.localPosition[2], 5), 'readonly-cell');
    appendTextCell(row, joint.parentId && joint.physicalBone !== false
      ? `${formatNumber(getBoneLength(definition, joint.id), 5)} m`
      : '无骨杆', 'length-lock-cell');

    const point = pose.get(joint.id);
    appendPoseNumberCell(row, joint.id, 'x', point.x);
    appendPoseNumberCell(row, joint.id, 'y', point.y);
    appendPoseNumberCell(row, joint.id, 'z', point.z);

    const pinCell = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(joint.pinned);
    checkbox.dataset.jointId = joint.id;
    checkbox.dataset.field = 'pinned';
    checkbox.setAttribute('aria-label', `固定 ${joint.label}`);
    pinCell.append(checkbox);
    row.append(pinCell);
    dom.modalBody.append(row);
  }
}

function appendTextCell(row, text, className = '') {
  const cell = document.createElement('td');
  cell.textContent = text;
  if (className) cell.className = className;
  row.append(cell);
}

function appendPoseNumberCell(row, jointId, axis, value) {
  const cell = document.createElement('td');
  const input = document.createElement('input');
  input.className = 'table-number-input';
  input.type = 'number';
  input.step = '0.001';
  input.value = formatNumber(value, 5);
  input.dataset.jointId = jointId;
  input.dataset.field = 'pose';
  input.dataset.axis = axis;
  cell.append(input);
  row.append(cell);
}

function onDataTableChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const jointId = target.dataset.jointId;
  const field = target.dataset.field;
  if (!jointId || !field) return;
  selectJoint(jointId);

  try {
    if (field === 'pose') {
      const value = Number(target.value);
      if (!Number.isFinite(value)) throw new Error('请输入有效数字。');
      const point = physicsRig.getPoint(jointId);
      physicsRig.moveJointTo(jointId, { ...point, [target.dataset.axis]: value });
      pushHistory('数据表修改姿势');
    } else if (field === 'pinned') {
      physicsRig.setPinned(jointId, target.checked);
      physicsRig.writePoseToDefinition(false);
      pushHistory(target.checked ? '数据表固定关节' : '数据表取消固定关节');
    }
    refreshAfterPoseChange({ list: true });
  } catch (error) {
    showToast(error instanceof Error ? error.message : '姿势数据修改失败', 'error');
    renderDataTable();
  }
}

function populateJsonEditor() {
  dom.jsonEditor.value = JSON.stringify(buildPosePayload(definition), null, 2);
  jsonDirty = false;
  clearJsonError();
}

function formatJsonEditor() {
  try {
    const parsed = JSON.parse(dom.jsonEditor.value);
    dom.jsonEditor.value = JSON.stringify(parsed, null, 2);
    jsonDirty = true;
    clearJsonError();
    showToast('姿势 JSON 已格式化');
  } catch (error) {
    showJsonError(error instanceof Error ? error.message : 'JSON 格式错误');
  }
}

function applyJsonEditor() {
  try {
    const parsed = JSON.parse(dom.jsonEditor.value);
    const applied = applyPosePayload(definition, parsed);
    physicsRig.resetFromDefinitionPose({ project: true });
    physicsRig.zeroVelocities();
    refreshAfterPoseChange({ list: true });
    pushHistory('应用姿势 JSON');
    jsonDirty = false;
    clearJsonError();
    showToast(`已应用 ${applied} 个关节的姿势，绑定尺寸未改变`);
  } catch (error) {
    showJsonError(error instanceof Error ? error.message : '姿势 JSON 应用失败');
  }
}

function showJsonError(message) {
  dom.jsonError.hidden = false;
  dom.jsonError.textContent = message;
}

function clearJsonError() {
  dom.jsonError.hidden = true;
  dom.jsonError.textContent = '';
}

async function copyJsonToClipboard() {
  const text = JSON.stringify(buildPosePayload(definition), null, 2);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  showToast('姿势 JSON 已复制');
}

function exportCsv() {
  const payload = buildExportPayload(definition);
  const headers = [
    'id', 'label', 'parentId', 'jointType', 'limitLabel', 'physicalBone', 'visualBone',
    'bindLocalX', 'bindLocalY', 'bindLocalZ', 'fixedBoneLength',
    'poseWorldX', 'poseWorldY', 'poseWorldZ', 'pinned',
  ];
  const rows = payload.joints.filter((item) => !item.isControl).map((item) => [
    item.id, item.label, item.parentId ?? '', item.jointType, item.limitLabel, item.physicalBone, item.visualBone,
    item.localPosition.x, item.localPosition.y, item.localPosition.z, item.boneLength,
    item.poseWorldPosition.x, item.poseWorldPosition.y, item.poseWorldPosition.z, item.pinned,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  downloadText(`humanoid-physics-rig-${dateStamp()}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
  showToast('绑定尺寸与姿势 CSV 已导出');
}

function pushHistory(label) {
  const canonical = canonicalDefinition(definition);
  const current = history[historyIndex];
  if (current?.canonical === canonical) {
    updateHistoryButtons();
    return;
  }
  definition.updatedAt = new Date().toISOString();
  history.splice(historyIndex + 1);
  history.push({ label, canonical, definitionJson: JSON.stringify(definition) });
  if (history.length > HISTORY_LIMIT) history.shift();
  historyIndex = history.length - 1;
  updateHistoryButtons();
  saveLocalDefinition(true);
  notifyHostPose(label);
}

function resetHistory(label) {
  history.length = 0;
  historyIndex = -1;
  pushHistory(label);
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  restoreHistoryEntry(history[historyIndex]);
  showToast(`已撤销：${history[historyIndex + 1]?.label ?? ''}`);
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex += 1;
  restoreHistoryEntry(history[historyIndex]);
  showToast(`已重做：${history[historyIndex]?.label ?? ''}`);
}

function restoreHistoryEntry(entry) {
  const previousSelection = selectedJointId;
  definition = normalizeSkeletonDefinition(JSON.parse(entry.definitionJson));
  physicsRig = new PhysicsRig(definition, optionsFromDefinition(definition));
  syncPhysicsControls();
  selectedJointId = definition.joints.some((joint) => joint.id === previousSelection)
    ? previousSelection
    : definition.joints[0]?.id ?? null;
  hoveredJointId = null;
  hoveredKind = null;
  jsonDirty = false;
  refreshAll({ fit: false });
  updateHistoryButtons();
  exposeDebugApi();
  saveLocalDefinition(true);
  notifyHostPose(entry?.label || '恢复历史姿势');
}

function updateHistoryButtons() {
  dom.undoButton.disabled = historyIndex <= 0;
  dom.redoButton.disabled = historyIndex >= history.length - 1;
}

function saveLocalDefinition(quiet = false) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(definition));
    if (!quiet) {
      showToast('已保存到当前浏览器');
      dom.statusMessage.textContent = '当前固定骨长骨架与姿势已本地保存';
    }
  } catch (error) {
    console.warn(error);
    if (!quiet) showToast('本地保存失败', 'error');
  }
}

function restoreLocalDefinition() {
  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const isCurrentProfile = key === STORAGE_KEY
        && Number(parsed.schemaVersion) >= 6
        && ['smpl-male-surface-fit-1796-v3', 'smpl-male-surface-fit-1796-v2'].includes(parsed.anthropometry?.profile);
      if (isCurrentProfile) {
        definition = normalizeSkeletonDefinition(parsed);
        return;
      }

      // Older projects contribute only pose coordinates. V8 always retains
      // the fitted SMPL dimensions, hidden pelvis controls, and anatomical ROM.
      const migrated = normalizeSkeletonDefinition(createStandardHumanoidPreset(
        String(parsed.pose).toUpperCase() === 'T' ? 'T' : 'A',
      ));
      try {
        applyPosePayload(migrated, parsed);
      } catch {
        // A legacy file may not contain pose coordinates. The revised standard
        // A/T pose remains a safe fallback.
      }
      definition = migrated;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(definition));
      return;
    } catch (error) {
      console.warn(`Unable to restore ${key}`, error);
    }
  }
}

function onGlobalKeyDown(event) {
  const command = event.ctrlKey || event.metaKey;
  if (command && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
    return;
  }
  if (command && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    redo();
    return;
  }
  if (!command && !event.altKey && !event.shiftKey && !isTypingTarget(event.target)) {
    if (event.key === '1') {
      setDisplayMode('skin');
      return;
    }
    if (event.key === '2') {
      setDisplayMode('skeleton');
      return;
    }
    if (event.key === '3') {
      setDisplayMode('both');
      return;
    }
  }
  if (event.key === 'Escape' && isDataModalOpen()) {
    closeDataModal();
  }
}

function isTypingTarget(target) {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target?.isContentEditable === true;
}

function getSelectedJoint() {
  return definition.joints.find((joint) => joint.id === selectedJointId) ?? null;
}

function setNumberValue(input, value) {
  input.value = formatNumber(value, 5);
}

function sideLabel(side) {
  return side === 'left' ? '左侧' : side === 'right' ? '右侧' : '中轴';
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'is-error' : ''}`;
  toast.textContent = message;
  dom.toastLayer.append(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 220);
  }, type === 'error' ? 5200 : 2600);
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function dateStamp() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '-',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('');
}


function setupHostBridge() {
  if (!EMBED_MODE || window.parent === window) return;
  window.addEventListener('message', handleHostMessage);
}

function postHostMessage(type, payload = {}) {
  if (!EMBED_MODE || window.parent === window) return;
  window.parent.postMessage({
    protocol: HOST_PROTOCOL,
    type,
    module: HOST_MODULE,
    ...payload,
  }, window.location.origin);
}

function notifyHostReady() {
  if (!EMBED_MODE) return;
  hostConnected = true;
  postHostMessage('HRL_EMBED_READY', {
    capabilities: {
      surface: true,
      skeleton: true,
      poseWrite: !HOST_READ_ONLY,
      fixedBoneLengths: true,
      jointLimits: true,
    },
    readOnly: HOST_READ_ONLY,
    surfaceSource: currentSurfaceSource,
    displayMode: currentDisplayMode,
  });
}

function notifyHostPose(reason = '更新人物姿势') {
  if (!EMBED_MODE || HOST_READ_ONLY || hostApplyingState || !hostConnected) return;
  const payload = buildPosePayload(definition);
  let poseSnapshot = null;
  try {
    poseSnapshot = physicsRig.buildPoseSnapshot({
      compatibleRig: definition.rigProfile?.compatibleRig || definition.rigVersion || 'rig@0.4.0',
      name: payload.pose || definition.pose || 'CUSTOM',
      source: 'embedded-v8.5',
    });
    poseSnapshot.updatedAt = payload.updatedAt;
    poseSnapshot.sourceLegacyUpdatedAt = payload.updatedAt;
  } catch (error) {
    console.warn('Unable to build canonical PoseSnapshot for the host.', error);
  }
  lastHostPoseStamp = String(poseSnapshot?.updatedAt || payload.updatedAt || '');
  postHostMessage('HRL_POSE_COMMIT', { reason, payload, poseSnapshot });
}

function handleHostMessage(event) {
  if (!EMBED_MODE || event.source !== window.parent || event.origin !== window.location.origin) return;
  const message = event.data;
  if (!message || message.protocol !== HOST_PROTOCOL) return;
  if (message.type === 'HRL_PREVIEW_BODY_PROFILE') {
    applyHostBodyProfile(message.bodyProfile || {}, { preview: true, preservePose: true });
    return;
  }
  if (message.type === 'HRL_ANIMATION_FRAME') {
    applyAnimationFrame(message.pose || {});
    return;
  }
  if (message.type !== 'HRL_HOST_STATE') return;
  applyHostState(message.state || {}, message.revision);
}

function applyAnimationFrame(poseState) {
  if (HOST_MODULE !== 'animation' && HOST_MODULE !== 'character-studio') return;
  hostApplyingState = true;
  try {
    applyHostPose(poseState, { animationFrame: true });
  } catch (error) {
    console.warn('Unable to apply animation preview frame.', error);
  } finally {
    hostApplyingState = false;
  }
}

function applyHostState(hostState, hostRevision) {
  hostApplyingState = true;
  try {
    if (hostState.bodyProfile) {
      applyHostBodyProfile(hostState.bodyProfile, { preview: false, preservePose: true });
    }
    if (hostState.bodyShape) threeView?.setBodyShape(hostState.bodyShape);
    if (hostState.clothing) threeView?.setClothingProfile(hostState.clothing);
    if (hostState.clothingFrame) threeView?.setClothingFrame(hostState.clothingFrame);
    const display = hostState.display || {};
    const nextMode = ['skin', 'skeleton', 'both'].includes(display.mode) ? display.mode : currentDisplayMode;
    setDisplayMode(nextMode, { quiet: true });

    const nextSource = normalizeSurfaceSource(hostState.skin?.source || display.surfaceSource || currentSurfaceSource);
    if (nextSource !== currentSurfaceSource) {
      currentSurfaceSource = nextSource;
      definition.surface = definition.surface || {};
      definition.surface.displaySource = currentSurfaceSource;
      if (dom.surfaceSource) dom.surfaceSource.value = currentSurfaceSource;
      threeView?.setSkinSource(currentSurfaceSource);
    }

    const opacity = Number(display.skinOpacity);
    if (Number.isFinite(opacity)) {
      const safeOpacity = Math.min(1, Math.max(0.2, opacity));
      dom.skinOpacity.value = String(safeOpacity);
      dom.skinOpacityValue.value = safeOpacity.toFixed(2);
      threeView?.setSkinOpacity(safeOpacity);
    }

    const surfaceMode = ['solid', 'translucent', 'wireframe'].includes(display.surfaceMode)
      ? display.surfaceMode
      : ['solid', 'translucent', 'wireframe'].includes(display.skinRenderMode)
        ? display.skinRenderMode
        : null;
    if (surfaceMode) {
      dom.skinMode.value = surfaceMode;
      threeView?.setSkinMode(surfaceMode);
    }

    if (typeof display.gridVisible === 'boolean') {
      dom.gridToggle.checked = display.gridVisible;
      fallbackView?.setGridVisible(display.gridVisible);
      threeView?.setGridVisible(display.gridVisible);
    }

    const poseApplied = applyHostPose(hostState.pose);
    if (!poseApplied) {
      const requestedPose = String(hostState.pose?.name || '').trim();
      const preset = requestedPose ? normalizePosePresetId(requestedPose) : null;
      if (preset && definition.pose !== preset) {
        applyPosePresetToDefinition(definition, preset);
        physicsRig.resetFromDefinitionPose({ project: true });
        physicsRig.zeroVelocities();
        refreshAll({ fit: false, list: true });
      }
    }
  } catch (error) {
    console.warn('Unable to apply host state to embedded human viewport.', error);
  } finally {
    hostApplyingState = false;
  }
  postHostMessage('HRL_HOST_ACK', {
    revision: hostRevision,
    displayMode: currentDisplayMode,
    surfaceSource: currentSurfaceSource,
    profileMetrics: lastProfileMetrics,
  });
}

function applyHostPose(poseState, { animationFrame = false } = {}) {
  const incomingSimulationRig = poseState?.simulationRig?.finalPose
    ? poseState.simulationRig
    : poseState?.simulationRigFrame?.finalPose
      ? poseState.simulationRigFrame
      : null;
  const poseSnapshot = poseState?.poseSnapshot;
  const posePayload = poseState?.v8Payload;
  const simulationStamp = String(
    incomingSimulationRig?.frameId
    || incomingSimulationRig?.finalPose?.timestamp
    || '',
  );
  if (incomingSimulationRig && simulationStamp && simulationStamp !== lastHostPoseStamp) {
    physicsRig.applyPoseFrame(incomingSimulationRig.finalPose, {
      // The first V4 bridge intentionally derives legacy positions but never
      // projects them back through world-position PBD. That projection waits
      // for the rotation-aware solver phase.
      project: false,
      preservePinTargets: false,
    });
    simulationRigFrame = physicsRig.getSimulationRigFrame({ frameId: incomingSimulationRig.frameId })
      ?? structuredClone(incomingSimulationRig);
    lastHostPoseStamp = simulationStamp;
    if (animationFrame) refreshViews();
    else refreshAll({ fit: false, list: true });
    return true;
  }
  const poseStamp = String(poseSnapshot?.updatedAt || posePayload?.updatedAt || '');
  if (poseSnapshot?.type === 'PoseSnapshot' && poseStamp && poseStamp !== lastHostPoseStamp) {
    simulationRigFrame = null;
    physicsRig.applyPoseSnapshot(poseSnapshot, {
      // Animation frames already contain local quaternion results from the
      // animation runtime. Re-running the 960-pass position solver for every
      // frame introduces latency and can pull a valid pose away from its clip.
      project: !animationFrame,
      applyConstraintSettings: !animationFrame,
      preservePinTargets: false,
    });
    lastHostPoseStamp = poseStamp;
    if (animationFrame) refreshViews();
    else refreshAll({ fit: false, list: true });
    return true;
  }
  if (posePayload?.joints?.length && poseStamp && poseStamp !== lastHostPoseStamp) {
    simulationRigFrame = null;
    applyPosePayload(definition, posePayload);
    physicsRig.resetFromDefinitionPose({ project: true });
    physicsRig.projectConstraints(64);
    physicsRig.zeroVelocities();
    physicsRig.writePoseToDefinition(true);
    lastHostPoseStamp = poseStamp;
    if (animationFrame) refreshViews();
    else refreshAll({ fit: false, list: true });
    return true;
  }
  return false;
}

function applyHostBodyProfile(rawProfile, { preview = false, preservePose = true } = {}) {
  const normalized = normalizeBodyProfile(rawProfile);
  const key = bodyProfileKey(normalized);
  if (!preview && key === lastHostBodyProfileKey) return false;
  const previousSelection = selectedJointId;
  definition = applyBodyProfileToDefinition(definition, normalized, { preservePose });
  physicsRig = new PhysicsRig(definition, optionsFromDefinition(definition));
  simulationRigFrame = null;
  physicsRig.projectConstraints(64);
  physicsRig.zeroVelocities();
  physicsRig.writePoseToDefinition(true);
  selectedJointId = definition.joints.some((joint) => joint.id === previousSelection)
    ? previousSelection
    : 'hips';
  lastHostBodyProfileKey = key;
  lastProfileMetrics = measureBodyProfile(definition);
  syncPhysicsControls();
  refreshAll({ fit: false, list: true });
  dom.proportionProfile.textContent = normalized.preset === 'smpl-male-surface-fit-1796-v3'
    ? 'SMPL 参考体型'
    : '自定义 3D 比例';
  if (HOST_MODULE === 'proportion') {
    dom.statusMessage.textContent = preview
      ? '正在实时预览三维绑定比例，松开滑块后写入共享项目'
      : '三维绑定比例已应用，骨长与关节位置已重新生成';
  }
  postHostMessage('HRL_PROFILE_STATUS', {
    preview,
    bodyProfile: normalized,
    metrics: lastProfileMetrics,
    requiresSkinRebind: Boolean(definition.profilePreview?.requiresSkinRebind),
  });
  return true;
}

function exposeDebugApi() {
  window.__rigLab = {
    getState: () => ({
      jointCount: definition.joints.filter((joint) => !joint.isControl).length,
      rigHeight: calculateRigHeight(definition),
      maxBoneError: physicsRig.getMaxBoneError(),
      maxJointViolation: physicsRig.getMaxJointLimitViolation(),
      rigidPelvisError: physicsRig.getRigidPelvisError(),
      selectedJointId,
      backend: dom.statusBackend.textContent,
      displayMode: currentDisplayMode,
      surface: threeView?.getSurfaceDiagnostics?.() ?? null,
      surfaceSource: currentSurfaceSource,
      bodyProfile: lastProfileMetrics || measureBodyProfile(definition),
      definition: cloneValue(definition),
    }),
    dragJoint: (jointId, delta = { x: 0, y: 0, z: 0 }) => {
      const start = physicsRig.getPoint(jointId);
      if (!start) return false;
      physicsRig.beginDrag({ jointId, kind: 'joint', anchorWorld: start });
      physicsRig.updateDragTarget({ x: start.x + (delta.x || 0), y: start.y + (delta.y || 0), z: start.z + (delta.z || 0) });
      physicsRig.endDrag({ keepMomentum: false });
      physicsRig.zeroVelocities({ capturePose: true });
      physicsRig.writePoseToDefinition(true);
      refreshAfterPoseChange({ list: true });
      return true;
    },
    dragBone: (jointId, delta = { x: 0, y: 0, z: 0 }) => {
      const joint = definition.joints.find((item) => item.id === jointId);
      if (!joint?.parentId) return false;
      const child = physicsRig.getPoint(jointId);
      const parent = physicsRig.getPoint(joint.parentId);
      const anchor = { x: (child.x + parent.x) / 2, y: (child.y + parent.y) / 2, z: (child.z + parent.z) / 2 };
      physicsRig.beginDrag({ jointId, kind: 'bone', anchorWorld: anchor });
      physicsRig.updateDragTarget({ x: anchor.x + (delta.x || 0), y: anchor.y + (delta.y || 0), z: anchor.z + (delta.z || 0) });
      physicsRig.endDrag({ keepMomentum: false });
      physicsRig.zeroVelocities({ capturePose: true });
      physicsRig.writePoseToDefinition(true);
      refreshAfterPoseChange({ list: true });
      return true;
    },
    reloadSurface: reloadSurfaceLayer,
    setDisplayMode,
    reset: resetToBindPose,
  };
}
