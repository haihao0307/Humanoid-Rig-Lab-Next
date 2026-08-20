import { downloadJson } from '../../project-hub.js';
import { escapeHtml } from '../../workspace-common.js';
import {
  createDefinitionForBodyProfile,
  createImagePoseAsset,
  normalizeImagePoseLibrary,
  retargetPoseObservation,
} from './image-pose-retarget.js';
import {
  estimatePoseFromImage,
  getPoseEstimatorStatus,
  MEDIAPIPE_TASKS_VISION_VERSION,
} from './image-pose-estimator.js';
import {
  deleteImagePoseSource,
  loadImagePoseSource,
  saveImagePoseSource,
} from './image-pose-store.js';

const CONNECTIONS = Object.freeze([
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
  [0, 7], [0, 8], [7, 11], [8, 12],
]);

const runtime = {
  operationToken: 0,
  status: 'idle',
  statusText: '选择一张全身人物图片后开始分析。',
  error: '',
  file: null,
  fileHashPromise: null,
  image: null,
  imageUrl: '',
  observation: null,
  candidate: null,
  selectedAssetId: null,
  draftAssetId: null,
  name: '',
  settings: {
    mirror: false,
    invertDepth: false,
    depthScale: 1,
    autoPinFeet: true,
    footContactThreshold: 0.045,
    preserveRootPosition: true,
  },
};

export function renderImagePosePanel(context, state) {
  const panel = document.querySelector('#imagePosePanel');
  if (!panel) return;
  const library = normalizeImagePoseLibrary(state.modules.pose.imagePose);
  if (!runtime.selectedAssetId || !library.assets.some((asset) => asset.id === runtime.selectedAssetId)) {
    runtime.selectedAssetId = library.activeAssetId;
  }
  const candidate = runtime.candidate;
  const quality = candidate?.quality;
  const candidateReady = candidateCanApply(candidate);
  const estimator = getPoseEstimatorStatus();
  const selectedAsset = library.assets.find((asset) => asset.id === runtime.selectedAssetId) || null;
  const statusTone = runtime.error ? '#ff9b9b' : runtime.status === 'ready' || runtime.status === 'saved' ? '#8ee6b6' : '#b7c8df';
  const sourceLabel = runtime.file?.name || selectedAsset?.sourceImage?.fileName || '尚未选择图片';
  const settings = runtime.settings;

  panel.innerHTML = `
    <div style="display:grid;gap:10px">
      <label style="display:grid;gap:6px;font-size:11px">
        <span>人物动作参考图</span>
        <input id="imagePoseFileInput" type="file" accept="image/png,image/jpeg,image/webp,image/avif" style="width:100%;font-size:10px">
      </label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="control-button" id="analyzeImagePose" ${runtime.image ? '' : 'disabled'}>识别并复刻</button>
        <button class="control-button" id="rebuildImagePose" ${runtime.observation ? '' : 'disabled'}>按当前修正重建</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px">
        <label style="display:flex;gap:6px;align-items:center"><input id="imagePoseMirror" type="checkbox" ${settings.mirror ? 'checked' : ''}>左右镜像修正</label>
        <label style="display:flex;gap:6px;align-items:center"><input id="imagePoseInvertDepth" type="checkbox" ${settings.invertDepth ? 'checked' : ''}>前后深度翻转</label>
        <label style="display:flex;gap:6px;align-items:center"><input id="imagePoseAutoPin" type="checkbox" ${settings.autoPinFeet ? 'checked' : ''}>自动识别脚底接触</label>
        <label style="display:flex;gap:6px;align-items:center"><input id="imagePosePreserveRoot" type="checkbox" ${settings.preserveRootPosition ? 'checked' : ''}>保持人物当前根位置</label>
      </div>
      <label style="display:grid;gap:4px;font-size:10px">
        <span>前后深度强度 <b id="imagePoseDepthValue">${Number(settings.depthScale).toFixed(2)}</b></span>
        <input id="imagePoseDepthScale" type="range" min="0" max="2.5" step="0.05" value="${Number(settings.depthScale)}">
      </label>
      <div style="border:1px solid rgba(160,190,220,.22);border-radius:8px;overflow:hidden;min-height:150px;background:rgba(3,9,18,.45);display:grid;place-items:center">
        <canvas id="imagePoseCanvas" style="display:block;width:100%;height:auto;max-height:280px"></canvas>
        <div id="imagePoseCanvasPlaceholder" style="padding:28px 12px;text-align:center;font-size:10px;color:#8092aa;${runtime.image ? 'display:none' : ''}">上传图片后会在这里显示 33 点人体识别结果。</div>
      </div>
      <div style="font-size:10px;line-height:1.55;color:${statusTone}">
        <b>${escapeHtml(sourceLabel)}</b><br>
        ${escapeHtml(runtime.error || runtime.statusText)}
      </div>
      ${quality ? renderQuality(quality, runtime.observation) : ''}
      <label style="display:grid;gap:4px;font-size:10px">
        <span>动作名称</span>
        <input id="imagePoseName" type="text" value="${escapeHtml(runtime.name || candidate?.name || '')}" placeholder="例如：右手举起" style="width:100%;box-sizing:border-box">
      </label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="control-button" id="applyImagePoseCandidate" ${candidateReady ? '' : 'disabled'}>应用到三维人物</button>
        <button class="control-button" id="saveImagePoseCandidate" ${candidateReady ? '' : 'disabled'}>保存并应用</button>
      </div>
      <div style="border-top:1px solid rgba(160,190,220,.18);padding-top:9px;display:grid;gap:7px">
        <div style="font-size:10px;display:flex;justify-content:space-between"><span>网站动作库</span><b>${library.assets.length} 个</b></div>
        <select id="imagePoseLibrarySelect" style="width:100%;font-size:10px" ${library.assets.length ? '' : 'disabled'}>
          ${library.assets.length ? library.assets.map((asset) => `<option value="${escapeHtml(asset.id)}" ${asset.id === runtime.selectedAssetId ? 'selected' : ''}>${escapeHtml(asset.name)} · ${(Number(asset.quality?.overallConfidence || 0) * 100).toFixed(0)}%</option>`).join('') : '<option>暂无已保存动作</option>'}
        </select>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="control-button" id="applySavedImagePose" ${selectedAsset ? '' : 'disabled'}>使用所选动作</button>
          <button class="control-button" id="loadSavedImageSource" ${selectedAsset ? '' : 'disabled'}>查看源图</button>
          <button class="control-button" id="exportSavedImagePose" ${selectedAsset ? '' : 'disabled'}>导出动作 JSON</button>
          <button class="control-button" id="deleteSavedImagePose" ${selectedAsset ? '' : 'disabled'}>删除</button>
        </div>
      </div>
      <p class="control-note" style="margin:0">识别输入在当前设备内处理，原图只保存到当前网站的 IndexedDB。首次使用会下载 MediaPipe ${MEDIAPIPE_TASKS_VISION_VERSION} 运行库和姿势模型。该 SDK 的供应商说明包含性能与使用指标收集，正式发布前需补充隐私提示与同意机制。单张图片的遮挡、身体扭转和前后方向可能需要使用上方修正选项，并在三维视口中继续微调。</p>
      <p class="control-note" style="margin:0">当前识别运行状态：${escapeHtml(estimator.state === 'ready' ? `${estimator.provider} · ${estimator.delegate}` : estimator.state === 'loading' ? '正在加载模型' : '尚未加载模型')}</p>
    </div>`;

  bindPanelEvents(context, state, library);
  drawImageOverlay();
}

function renderQuality(quality, observation) {
  const warnings = quality.warningCodes?.length
    ? quality.warningCodes.map((code) => `<span style="display:inline-block;padding:2px 5px;border:1px solid rgba(255,190,105,.32);border-radius:9px;margin:2px 2px 0 0">${escapeHtml(code)}</span>`).join('')
    : '<span>无额外警告</span>';
  const depthSource = quality.depthMode === 'world_landmarks'
    ? 'MediaPipe 世界坐标'
    : '图像深度估计（需复核）';
  const depthRange = quality.depthRange
    ? `${Number(quality.depthRange.min || 0).toFixed(3)} ~ ${Number(quality.depthRange.max || 0).toFixed(3)}`
    : '—';
  return `<div style="display:grid;gap:5px;border:1px solid rgba(126,224,173,.2);border-radius:8px;padding:8px;font-size:10px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
      <span>识别置信度 <b>${(Number(quality.overallConfidence || 0) * 100).toFixed(1)}%</b></span>
      <span>方向平均误差 <b>${Number(quality.meanDirectionErrorDegrees || 0).toFixed(2)}°</b></span>
      <span>方向最大误差 <b>${Number(quality.maxDirectionErrorDegrees || 0).toFixed(2)}°</b></span>
      <span>骨长误差 <b>${(Number(quality.maxBoneErrorM || 0) * 1000).toFixed(3)} mm</b></span>
      <span>刚性骨盆误差 <b>${(Number(quality.rigidPelvisErrorM || 0) * 1000).toFixed(3)} mm</b></span>
      <span>脚底接触 <b>${quality.inferredFootContacts?.join('、') || '未识别'}</b></span>
      <span>深度来源 <b>${escapeHtml(depthSource)}</b></span>
      <span>深度范围 <b>${escapeHtml(depthRange)}</b></span>
      <span>深度限幅 <b>${Number(quality.depthClampCount || 0)} 点</b></span>
      <span>推理耗时 <b>${Number(observation?.inferenceMs || 0).toFixed(1)} ms</b></span>
    </div>
    <div style="color:${quality.canApply === false ? '#ffb36b' : '#8ee6b6'}">应用状态：<b>${quality.canApply === false ? '已阻止写入人物' : '允许应用'}</b></div>
    ${quality.canApply === false ? `<div style="color:#ffb36b">识别质量不足：${escapeHtml(formatApplyBlockReason(quality))}。候选仅保留用于检查，不会改变当前三维人物。</div>` : ''}
    <div>${warnings}</div>
  </div>`;
}

const APPLY_BLOCK_LABELS = Object.freeze({
  INSUFFICIENT_BODY_CONFIDENCE: '全身关键点整体置信度过低',
  CRITICAL_LANDMARKS_UNRELIABLE: '肩部、骨盆或腿部关键点不可靠',
  SEVERE_DIRECTION_MISMATCH: '骨骼方向与目标姿势严重不一致',
  IMAGE_DEPTH_OUTLIER_CLAMPED: '图像深度出现异常值并已限幅',
});

function candidateCanApply(candidate) {
  return Boolean(candidate) && candidate.quality?.canApply !== false;
}

function formatApplyBlockReason(value) {
  const quality = value?.quality || value || {};
  const reasons = Array.isArray(quality.applyBlockReasons) ? quality.applyBlockReasons : [];
  return reasons.map((code) => APPLY_BLOCK_LABELS[code] || code).join('、') || '未达到动作质量阈值';
}

function rejectBlockedCandidate(context, candidate) {
  runtime.status = 'ready';
  runtime.statusText = `识别质量不足（${formatApplyBlockReason(candidate)}），候选仅用于检查，未写入当前三维人物。`;
  runtime.error = '';
  renderImagePosePanel(context, context.getState());
}

function bindPanelEvents(context, state, library) {
  document.querySelector('#imagePoseFileInput')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await selectImageFile(context, file);
  });
  document.querySelector('#analyzeImagePose')?.addEventListener('click', () => analyzeCurrentImage(context));
  document.querySelector('#rebuildImagePose')?.addEventListener('click', () => rebuildCandidate(context));
  document.querySelector('#imagePoseMirror')?.addEventListener('change', (event) => updateSetting(context, 'mirror', event.target.checked));
  document.querySelector('#imagePoseInvertDepth')?.addEventListener('change', (event) => updateSetting(context, 'invertDepth', event.target.checked));
  document.querySelector('#imagePoseAutoPin')?.addEventListener('change', (event) => updateSetting(context, 'autoPinFeet', event.target.checked));
  document.querySelector('#imagePosePreserveRoot')?.addEventListener('change', (event) => updateSetting(context, 'preserveRootPosition', event.target.checked));
  document.querySelector('#imagePoseDepthScale')?.addEventListener('input', (event) => {
    runtime.settings.depthScale = Number(event.target.value);
    const label = document.querySelector('#imagePoseDepthValue');
    if (label) label.textContent = Number(runtime.settings.depthScale).toFixed(2);
  });
  document.querySelector('#imagePoseDepthScale')?.addEventListener('change', () => rebuildCandidate(context));
  document.querySelector('#imagePoseName')?.addEventListener('input', (event) => { runtime.name = event.target.value; });
  document.querySelector('#applyImagePoseCandidate')?.addEventListener('click', () => applyCandidate(context, runtime.candidate, null));
  document.querySelector('#saveImagePoseCandidate')?.addEventListener('click', () => {
    saveCandidate(context).catch((error) => setError(context, `动作保存失败：${errorMessage(error)}`));
  });
  document.querySelector('#imagePoseLibrarySelect')?.addEventListener('change', (event) => {
    runtime.selectedAssetId = event.target.value;
    renderImagePosePanel(context, context.getState());
  });
  document.querySelector('#applySavedImagePose')?.addEventListener('click', () => {
    const asset = library.assets.find((item) => item.id === runtime.selectedAssetId);
    if (asset) applySavedAsset(context, asset);
  });
  document.querySelector('#loadSavedImageSource')?.addEventListener('click', () => {
    const asset = library.assets.find((item) => item.id === runtime.selectedAssetId);
    if (asset) loadSavedSource(context, asset).catch((error) => setError(context, `源图读取失败：${errorMessage(error)}`));
  });
  document.querySelector('#exportSavedImagePose')?.addEventListener('click', () => {
    const asset = library.assets.find((item) => item.id === runtime.selectedAssetId);
    if (asset) downloadJson(`${safeFileName(asset.name)}-${asset.id}.json`, asset);
  });
  document.querySelector('#deleteSavedImagePose')?.addEventListener('click', () => {
    const asset = library.assets.find((item) => item.id === runtime.selectedAssetId);
    if (asset) deleteSavedAsset(context, asset).catch((error) => setError(context, `动作删除失败：${errorMessage(error)}`));
  });
}

async function selectImageFile(context, file) {
  if (!String(file.type || '').startsWith('image/')) {
    setError(context, '请选择 PNG、JPEG、WebP 或 AVIF 图片。');
    return;
  }
  if (file.size > 30 * 1024 * 1024) {
    setError(context, '图片超过 30 MB，请先缩小图片。');
    return;
  }
  const token = ++runtime.operationToken;
  releaseImageUrl();
  runtime.file = file;
  runtime.fileHashPromise = hashBlob(file);
  runtime.imageUrl = URL.createObjectURL(file);
  runtime.image = null;
  runtime.observation = null;
  runtime.candidate = null;
  runtime.draftAssetId = `image-pose-${cryptoId()}`;
  runtime.name = defaultPoseName(file.name);
  runtime.status = 'loading-image';
  runtime.statusText = '正在读取图片。';
  runtime.error = '';
  renderImagePosePanel(context, context.getState());
  try {
    const image = await loadImage(runtime.imageUrl);
    if (token !== runtime.operationToken) return;
    runtime.image = image;
    runtime.status = 'image-ready';
    runtime.statusText = `图片已读取，尺寸 ${image.naturalWidth} × ${image.naturalHeight}。正在启动人体姿势识别。`;
    renderImagePosePanel(context, context.getState());
    await analyzeCurrentImage(context);
  } catch (error) {
    if (token !== runtime.operationToken) return;
    setError(context, `图片读取失败：${errorMessage(error)}`);
  }
}

async function analyzeCurrentImage(context) {
  if (!runtime.image) return;
  const token = ++runtime.operationToken;
  runtime.status = 'analyzing';
  runtime.statusText = '正在加载本地姿势模型并分析 33 个人体关键点。';
  runtime.error = '';
  runtime.candidate = null;
  renderImagePosePanel(context, context.getState());
  try {
    const observation = await estimatePoseFromImage(runtime.image);
    if (token !== runtime.operationToken) return;
    runtime.observation = observation;
    runtime.statusText = `已检测 33 个人体关键点，正在重定向到当前固定骨长人物。`;
    rebuildCandidate(context, { render: false });
    if (token !== runtime.operationToken) return;
    runtime.status = 'ready';
    runtime.statusText = runtime.candidate?.quality?.canApply === false
      ? `识别质量不足（${formatApplyBlockReason(runtime.candidate)}），已生成检查用候选，未允许写入三维人物。`
      : runtime.candidate?.quality?.manualReviewRequired
      ? '动作候选已生成。请检查镜像、前后深度和低置信度提示。'
      : '动作候选已生成，可以应用或保存到网站动作库。';
    renderImagePosePanel(context, context.getState());
  } catch (error) {
    if (token !== runtime.operationToken) return;
    setError(context, errorMessage(error));
  }
}

function rebuildCandidate(context, options = {}) {
  if (!runtime.observation) return null;
  try {
    const state = context.getState();
    const definition = currentRigDefinition(context, state);
    const name = runtime.name.trim() || '图片动作';
    runtime.candidate = retargetPoseObservation({
      definition,
      observation: runtime.observation,
      compatibleRig: state.activeVersions.rig,
      name,
      assetId: runtime.draftAssetId || `image-pose-${cryptoId()}`,
      physics: state.character.physics,
      settings: {
        ...runtime.settings,
        groundEnabled: state.character.physics.groundEnabled !== false,
        groundY: 0,
      },
    });
    runtime.status = 'ready';
    runtime.error = '';
    if (options.render !== false) renderImagePosePanel(context, state);
    return runtime.candidate;
  } catch (error) {
    setError(context, `姿势重定向失败：${errorMessage(error)}`);
    return null;
  }
}

function updateSetting(context, field, value) {
  runtime.settings[field] = value;
  if (runtime.observation) rebuildCandidate(context);
  else renderImagePosePanel(context, context.getState());
}

async function saveCandidate(context) {
  const candidate = rebuildCandidate(context, { render: false });
  if (!candidate) return;
  if (!candidateCanApply(candidate)) {
    rejectBlockedCandidate(context, candidate);
    return;
  }
  const contentHash = await runtime.fileHashPromise?.catch(() => '') || '';
  const asset = createImagePoseAsset(candidate, {
    fileName: runtime.file?.name || '',
    mimeType: runtime.file?.type || '',
    byteLength: runtime.file?.size || 0,
    width: runtime.image?.naturalWidth || candidate.observation?.image?.width || 0,
    height: runtime.image?.naturalHeight || candidate.observation?.image?.height || 0,
    contentHash,
    storage: runtime.file ? 'indexeddb' : 'metadata-only',
  });
  if (runtime.file) await saveImagePoseSource(asset.id, runtime.file);
  const previousState = context.getState();
  const previousLibrary = normalizeImagePoseLibrary(previousState.modules.pose.imagePose);
  const retained = previousLibrary.assets.filter((item) => item.id !== asset.id);
  const nextAssets = [asset, ...retained].slice(0, 24);
  const removedIds = previousLibrary.assets.filter((item) => !nextAssets.some((next) => next.id === item.id)).map((item) => item.id);
  const stamped = stampCandidate(candidate, asset.id, asset.name);
  context.hub.transaction((state) => {
    state.modules.pose.imagePose = {
      schema: 'humanoid_rig/image_pose_library@1.0',
      activeAssetId: asset.id,
      assets: nextAssets,
    };
    applyCandidateToState(state, stamped, asset.id);
    state.modules.pose.status = 'testing';
    state.modules.pose.statusLabel = '图片动作测试';
    state.modules.pose.currentTask = '复核图片动作的深度歧义、遮挡关节和三维重定向质量';
    state.modules.pose.progress = Math.max(Number(state.modules.pose.progress || 0), 68);
  }, { module: 'pose', summary: `保存并应用图片动作 ${asset.name}` });
  for (const id of removedIds) deleteImagePoseSource(id);
  runtime.selectedAssetId = asset.id;
  runtime.status = 'saved';
  runtime.statusText = `已保存“${asset.name}”，并应用到当前三维人物。`;
  runtime.error = '';
  renderImagePosePanel(context, context.getState());
}

function applyCandidate(context, candidate, activeAssetId) {
  if (!candidate) return;
  if (!candidateCanApply(candidate)) {
    rejectBlockedCandidate(context, candidate);
    return;
  }
  const name = runtime.name.trim() || candidate.name || '图片动作';
  const stamped = stampCandidate(candidate, activeAssetId || candidate.assetId, name);
  context.hub.transaction((state) => {
    applyCandidateToState(state, stamped, activeAssetId);
    if (activeAssetId) {
      const library = normalizeImagePoseLibrary(state.modules.pose.imagePose);
      library.activeAssetId = activeAssetId;
      state.modules.pose.imagePose = library;
    }
    state.modules.pose.status = 'testing';
    state.modules.pose.statusLabel = '图片动作测试';
    state.modules.pose.currentTask = '在统一三维人物中校准图片重建姿势';
  }, { module: 'pose', summary: `应用图片动作 ${name}` });
  runtime.status = 'ready';
  runtime.statusText = `已将“${name}”应用到当前三维人物。`;
  renderImagePosePanel(context, context.getState());
}

function applyCandidateToState(state, candidate, activeAssetId) {
  state.character.pose.name = candidate.name;
  state.character.pose.joints = clone(candidate.preview2D);
  state.character.pose.v8Payload = clone(candidate.legacyWorldPose);
  state.character.pose.poseSnapshot = clone(candidate.poseSnapshot);
  state.character.pose.pinned = candidate.contacts.map((contact) => contact.jointId);
  state.character.pose.imagePoseAssetId = activeAssetId || candidate.assetId || null;
}

async function applySavedAsset(context, asset) {
  runtime.status = 'retargeting-saved';
  runtime.statusText = `正在把“${asset.name}”重定向到当前人物版本。`;
  runtime.error = '';
  renderImagePosePanel(context, context.getState());
  try {
    runtime.observation = clone(asset.observation);
    runtime.settings = { ...runtime.settings, ...clone(asset.settings) };
    runtime.draftAssetId = asset.id;
    runtime.name = asset.name;
    const candidate = rebuildCandidate(context, { render: false });
    if (!candidate) return;
    applyCandidate(context, candidate, asset.id);
  } catch (error) {
    setError(context, `已保存动作应用失败：${errorMessage(error)}`);
  }
}

async function loadSavedSource(context, asset) {
  runtime.selectedAssetId = asset.id;
  runtime.observation = clone(asset.observation);
  runtime.settings = { ...runtime.settings, ...clone(asset.settings) };
  runtime.draftAssetId = asset.id;
  runtime.name = asset.name;
  runtime.candidate = null;
  runtime.status = 'loading-image';
  runtime.statusText = '正在读取网站内保存的源图。';
  runtime.error = '';
  renderImagePosePanel(context, context.getState());
  const blob = await loadImagePoseSource(asset.id);
  if (!blob) {
    runtime.status = 'ready';
    runtime.statusText = '该动作的姿势数据仍可使用，源图在当前浏览器中没有找到。';
    rebuildCandidate(context);
    return;
  }
  releaseImageUrl();
  runtime.file = new File([blob], asset.sourceImage?.fileName || `${asset.name}.image`, { type: blob.type || asset.sourceImage?.mimeType || 'image/png' });
  runtime.imageUrl = URL.createObjectURL(blob);
  runtime.image = await loadImage(runtime.imageUrl);
  runtime.fileHashPromise = Promise.resolve(asset.sourceImage?.contentHash || '');
  runtime.status = 'ready';
  runtime.statusText = `已载入“${asset.name}”的源图和识别关键点。`;
  rebuildCandidate(context);
}

async function deleteSavedAsset(context, asset) {
  await deleteImagePoseSource(asset.id);
  context.hub.transaction((state) => {
    const library = normalizeImagePoseLibrary(state.modules.pose.imagePose);
    library.assets = library.assets.filter((item) => item.id !== asset.id);
    library.activeAssetId = library.assets[0]?.id || null;
    state.modules.pose.imagePose = library;
    if (state.character.pose.imagePoseAssetId === asset.id) state.character.pose.imagePoseAssetId = null;
  }, { module: 'pose', summary: `删除图片动作 ${asset.name}` });
  runtime.selectedAssetId = null;
  if (runtime.draftAssetId === asset.id) {
    runtime.observation = null;
    runtime.candidate = null;
    runtime.draftAssetId = null;
  }
  runtime.status = 'idle';
  runtime.statusText = `已删除“${asset.name}”。`;
  runtime.error = '';
  renderImagePosePanel(context, context.getState());
}

function currentRigDefinition(context, state) {
  try {
    const frameState = context.elements.legacyFrame?.contentWindow?.__rigLab?.getState?.();
    if (frameState?.definition?.joints?.length) return clone(frameState.definition);
  } catch (error) {
    console.warn('Unable to read the embedded rig definition. Falling back to the active BodyProfile.', error);
  }
  return createDefinitionForBodyProfile(state.character.bodyProfile);
}

function stampCandidate(candidate, assetId, name) {
  const stamped = clone(candidate);
  const timestamp = new Date().toISOString();
  stamped.assetId = assetId || stamped.assetId;
  stamped.name = name || stamped.name;
  stamped.legacyWorldPose.updatedAt = timestamp;
  stamped.legacyWorldPose.imagePoseAssetId = stamped.assetId;
  stamped.poseSnapshot.updatedAt = timestamp;
  stamped.poseSnapshot.sourceLegacyUpdatedAt = timestamp;
  stamped.poseSnapshot.imagePoseAssetId = stamped.assetId;
  return stamped;
}

function drawImageOverlay() {
  const canvas = document.querySelector('#imagePoseCanvas');
  if (!(canvas instanceof HTMLCanvasElement) || !runtime.image) return;
  const image = runtime.image;
  const maximumWidth = 720;
  const sourceWidth = image.naturalWidth || image.width || 1;
  const sourceHeight = image.naturalHeight || image.height || 1;
  const scale = Math.min(1, maximumWidth / sourceWidth);
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const landmarks = runtime.observation?.landmarks;
  if (!Array.isArray(landmarks) || landmarks.length !== 33) return;
  context.lineWidth = Math.max(1.5, canvas.width / 360);
  context.strokeStyle = 'rgba(111, 232, 184, .92)';
  context.fillStyle = 'rgba(255, 213, 116, .96)';
  context.shadowColor = 'rgba(0,0,0,.75)';
  context.shadowBlur = 3;
  for (const [aIndex, bIndex] of CONNECTIONS) {
    const a = landmarks[aIndex];
    const b = landmarks[bIndex];
    if (!a || !b || landmarkConfidence(a) < 0.2 || landmarkConfidence(b) < 0.2) continue;
    context.beginPath();
    context.moveTo(a.x * canvas.width, a.y * canvas.height);
    context.lineTo(b.x * canvas.width, b.y * canvas.height);
    context.stroke();
  }
  const radius = Math.max(2.5, canvas.width / 180);
  landmarks.forEach((point) => {
    if (landmarkConfidence(point) < 0.15) return;
    context.globalAlpha = Math.max(0.3, landmarkConfidence(point));
    context.beginPath();
    context.arc(point.x * canvas.width, point.y * canvas.height, radius, 0, Math.PI * 2);
    context.fill();
  });
  context.globalAlpha = 1;
  context.shadowBlur = 0;
}

function setError(context, message) {
  runtime.status = 'error';
  runtime.error = message;
  runtime.statusText = '';
  renderImagePosePanel(context, context.getState());
}

function releaseImageUrl() {
  if (runtime.imageUrl) URL.revokeObjectURL(runtime.imageUrl);
  runtime.imageUrl = '';
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('浏览器无法解码该图片。'));
    image.src = url;
  });
}

async function hashBlob(blob) {
  if (!globalThis.crypto?.subtle) return '';
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return `sha256:${[...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function landmarkConfidence(value) {
  const visibility = Number(value?.visibility);
  const presence = Number(value?.presence);
  if (Number.isFinite(visibility) && Number.isFinite(presence)) return Math.min(visibility, presence);
  if (Number.isFinite(visibility)) return visibility;
  if (Number.isFinite(presence)) return presence;
  return 1;
}

function defaultPoseName(fileName) {
  const base = String(fileName || '图片动作').replace(/\.[^.]+$/, '').trim();
  return `${base || '图片动作'} · 复刻姿势`;
}

function safeFileName(value) {
  return String(value || 'image-pose').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80);
}

function cryptoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function clone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || '未知错误');
}
