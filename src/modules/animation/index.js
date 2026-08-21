import {
  bindToggle,
  controlSection,
  escapeHtml,
  rangeControl,
  toggleControl,
} from '../../workspace-common.js';
import { downloadJson, readJsonFile } from '../../project-hub.js';
import {
  MOTION_CLIP_SCHEMA,
  addClip,
  addClipContact,
  addClipEvent,
  addPoseSnapshotKey,
  clearClipContent,
  compressAnimationClip,
  computeTransportRawTime,
  computeTransportTime,
  createEmptyClip,
  getActiveClip,
  importMotionClip,
  isNormalizedAnimationState,
  mirrorAnimationClip,
  normalizeAnimationState,
  normalizeClip,
  removeNearestPoseSnapshotKey,
  replaceClip,
  resolveTransportPlaybackStart,
  sampleAnimationClip,
  samplePoseSnapshotClip,
  serializeMotionClip,
  setActiveClip,
  setAnimationLayer,
  setGraphParameter,
  setTransport,
  syncLegacyAnimationFields,
  upsertTrackKeyframe,
  validateAnimationClip,
} from './model.js';
import {
  collectAnimationEvents,
  createPoseSnapshotFromLocalPose,
  createRigContext,
  deriveLocalPoseFromV8Payload,
  diagnoseRetargetCompatibility,
  retargetAnimationClip,
  sampleAnimationRuntime,
} from './runtime.js';
import { evaluateAnimationGraph } from './graph.js';
import { bakeAnimationSessionToMotionClip } from './bake.js';
import { exportAnimationSkeletonGlb } from './glb.js';

const HOST_PROTOCOL = 'humanoid-rig-lab-next:viewport';
const MODULE_VERSION = 'anim@0.4.0';
let playbackFrame = null;
let playbackContext = null;
let endingCommit = false;
let graphCommitPending = false;
let previousRuntimePose = null;
let previousPreviewAt = 0;
let lastPlaybackRawTime = null;
let lastPlaybackClipId = null;
let lastRuntimeFrame = null;
let lastRuntimeEvent = null;

export function renderControls(context, state) {
  const animation = normalizeForState(state);
  const activeClip = getActiveClip(animation);
  const validation = validateAnimationClip(activeClip);
  const currentTime = computeTransportTime(animation);
  const rawTime = computeTransportRawTime(animation);
  const trackKeyCount = activeClip.tracks.reduce((total, track) => total + track.keyframes.length, 0);
  const controlsRoot = context.elements.moduleControls;
  const controlsMounted = controlsRoot?.dataset.animationControlsMounted === 'true'
    && controlsRoot.querySelector('#clipSelect');
  if (controlsMounted) {
    syncAnimationControlsDom(context, animation, activeClip);
    syncPlaybackLoop(context, animation);
    queueMicrotask(() => previewAtTime(context, animation, currentTime, { rawTime }));
    return;
  }
  const markerHtml = renderTimelineMarkers(activeClip);
  const clipOptions = animation.clips.map((clip) => (
    `<option value="${escapeHtml(clip.clipId)}">${escapeHtml(clip.name)}</option>`
  )).join('');
  const rig = createRigContext(state.character.bodyProfile, { rigVersion: state.activeVersions.rig });
  const compatibility = diagnoseRetargetCompatibility(activeClip, rig, { mapping: animation.retarget.mapping });
  const upperLayer = animation.layers.find((layer) => layer.layerId === 'upper-body');
  const breathingLayer = animation.layers.find((layer) => layer.layerId === 'breathing-additive');

  context.elements.moduleControls.innerHTML =
    controlSection('动画片段与播放', `
      <div class="control-row"><label for="clipSelect">当前片段</label><select id="clipSelect">${clipOptions}</select></div>
      <div class="control-button-grid"><button class="control-button" id="playAnimation">${animation.transport.playing ? '暂停' : '播放'}</button><button class="control-button" id="stopAnimation">停止</button></div>
      <div class="control-button-grid"><button class="control-button" id="previousFrame">上一帧</button><button class="control-button" id="nextFrame">下一帧</button></div>
      <div class="control-button-grid"><button class="control-button" id="newAnimationClip">新建片段</button><button class="control-button" id="clearClipContent">清空片段</button></div>
      <div class="control-button-grid"><button class="control-button" id="importAnimationClip">导入 MotionClip</button><button class="control-button" id="exportAnimationClip">导出 MotionClip</button></div>
      <input id="importAnimationClipInput" type="file" accept="application/json,.json" hidden>`) +
    controlSection('时间轴', `
      ${rangeControl('animationTimeControl', '当前时间', 0, activeClip.duration, .001, currentTime.toFixed(3), ' s')}
      ${rangeControl('animationSpeedControl', '播放速度', -2, 2, .05, animation.transport.speed, '×')}
      <div class="control-row"><label for="clipLoopMode">片段循环</label><select id="clipLoopMode"><option value="once">单次</option><option value="repeat">循环</option><option value="pingpong">往返</option></select></div>
      <div class="control-row"><label for="rootMotionMode">根运动</label><select id="rootMotionMode"><option value="in_place">原地</option><option value="root_motion">根运动</option></select></div>
      ${toggleControl('animationLoop', '启用播放循环区间', animation.transport.loop)}
      <div style="position:relative;height:38px;margin-top:10px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(255,255,255,.035);overflow:hidden">
        <div id="animationTimelineMarkers" style="position:absolute;inset:0;pointer-events:none">${markerHtml}</div>
        <i id="animationTimelineCursor" style="position:absolute;top:0;bottom:0;left:${timelinePercent(currentTime, activeClip.duration)}%;width:2px;background:currentColor;pointer-events:none"></i>
      </div>
      <div class="metric-list compact-metrics" style="margin-top:8px">
        <div><span>局部轨道</span><b>${activeClip.tracks.length}</b></div>
        <div><span>轨道关键帧</span><b>${trackKeyCount}</b></div>
        <div><span>PoseSnapshot 键</span><b>${activeClip.poseKeys.length}</b></div>
        <div><span>事件与接触</span><b>${activeClip.events.length + activeClip.contacts.length}</b></div>
      </div>`) +
    controlSection('双骨架运行模式', `
      <div class="control-row"><label for="runtimeMode">求解模式</label><select id="runtimeMode"><option value="exact">精确动画</option><option value="physical_follow">物理跟随</option><option value="full_physics">全身物理交接</option></select></div>
      <div class="control-row"><label for="previewSource">预览姿势</label><select id="previewSource"><option value="desired_pose">desiredPose</option><option value="final_pose">finalPose</option></select></div>
      ${toggleControl('footLockEnabled', '脚底接触锁定', animation.runtime.footLockEnabled)}
      ${toggleControl('jointLimitsEnabled', '关节活动范围', animation.runtime.jointLimitsEnabled)}
      ${toggleControl('rootMotionEnabled', '应用根节点位移', animation.runtime.rootMotionEnabled)}
      ${rangeControl('followStiffness', '跟随刚度', 0, 1, .01, animation.runtime.followStiffness, '')}
      ${rangeControl('followDamping', '跟随阻尼', 0, 1, .01, animation.runtime.followDamping, '')}
      <p class="control-note">局部四元数先驱动隐藏 animationRig，再经过关节限制、脚底接触和物理跟随形成 finalPose。统一三维人物直接读取按当前比例重建的 28 关节世界姿势。</p>`) +
    controlSection('动画层与状态机', `
      ${toggleControl('upperBodyLayer', '上半身挥手覆盖层', Boolean(upperLayer?.enabled))}
      ${rangeControl('upperBodyWeight', '上半身层权重', 0, 1, .01, upperLayer?.weight ?? 1, '')}
      ${toggleControl('breathingLayer', '呼吸加法层', Boolean(breathingLayer?.enabled))}
      ${rangeControl('breathingWeight', '呼吸层权重', 0, 1, .01, breathingLayer?.weight ?? .35, '')}
      <div class="control-button-grid"><button class="control-button" data-graph-action="idle">站立</button><button class="control-button" data-graph-action="walk">行走</button></div>
      <div class="control-button-grid"><button class="control-button" data-graph-action="wave">挥手过渡</button><button class="control-button" data-graph-action="squat">下蹲过渡</button></div>
      <p class="control-note" id="animationGraphStatus">${escapeHtml(graphStatusText(animation))}</p>`) +
    controlSection('关键帧制作与资产处理', `
      <div class="control-button-grid"><button class="control-button" id="capturePoseKey">记录当前三维姿势</button><button class="control-button" id="removeNearestPoseKey">删除最近姿势键</button></div>
      <div class="control-button-grid"><button class="control-button" id="addAnimationEvent">加入事件标记</button><button class="control-button" id="addFootContact">加入左脚接触</button></div>
      <div class="control-button-grid"><button class="control-button" id="mirrorAnimationClip">生成左右镜像</button><button class="control-button" id="compressAnimationClip">压缩轨道</button></div>
      <div class="control-button-grid"><button class="control-button" id="retargetAnimationClip">生成当前比例版本</button><button class="control-button" id="bakeAnimationClip">烘焙 finalPose</button></div>
      <div class="control-button-grid"><button class="control-button" id="exportBakedMotion">导出烘焙 JSON</button><button class="control-button" id="exportAnimationGlb">导出骨架动画 GLB</button></div>
      <p class="control-note" id="animationRuntimeStatus">${runtimeStatus(activeClip, currentTime)}</p>`) +
    controlSection('运行诊断与协议', `
      <div class="metric-list compact-metrics">
        <div><span>动画 schema</span><b>${escapeHtml(animation.schema)}</b></div>
        <div><span>片段 schema</span><b>${escapeHtml(activeClip.schema)}</b></div>
        <div><span>兼容骨架</span><b>${escapeHtml(activeClip.compatibleRig)}</b></div>
        <div><span>当前比例高度</span><b>${rig.bodyHeight.toFixed(3)} m</b></div>
        <div><span>根运动缩放</span><b>${compatibility.rootMotionScale.toFixed(3)}×</b></div>
        <div><span>未知关节</span><b class="${compatibility.compatible ? 'success-text' : 'warning-text'}">${compatibility.unknownJoints.length}</b></div>
        <div><span>片段校验</span><b class="${validation.valid ? 'success-text' : 'warning-text'}">${validation.valid ? '通过' : `${validation.errors.length} 项错误`}</b></div>
        <div><span>原始播放时间</span><b>${Number(rawTime).toFixed(3)} s</b></div>
      </div>
      <p class="control-note">${escapeHtml(validation.errors[0] || validation.warnings[0] || '局部旋转、根节点通道、事件、接触和 PoseSnapshot 引用均通过协议检查。')}</p>`);

  setSelectValue('#clipSelect', activeClip.clipId);
  setSelectValue('#clipLoopMode', activeClip.loopMode);
  setSelectValue('#rootMotionMode', activeClip.rootMotionMode);
  setSelectValue('#runtimeMode', animation.runtime.mode);
  setSelectValue('#previewSource', animation.runtime.previewSource);

  bindClipAndTransportControls(context);
  bindRuntimeControls(context);
  bindLayerAndGraphControls(context);
  bindEditingAndAssetControls(context);
  controlsRoot.dataset.animationControlsMounted = 'true';
  const clipSelect = controlsRoot.querySelector('#clipSelect');
  if (clipSelect) clipSelect.dataset.optionsKey = animationClipOptionsKey(animation);
  const markerRoot = controlsRoot.querySelector('#animationTimelineMarkers');
  if (markerRoot) markerRoot.dataset.structureKey = animationControlsStructureKey(animation);
  syncPlaybackLoop(context, animation);
  queueMicrotask(() => previewAtTime(context, animation, currentTime, { rawTime }));
}

export function exportData(state) {
  const animation = normalizeForState(state);
  return { animation: structuredClone(animation) };
}

export function resetData(state, defaults) {
  resetRuntimeCache();
  state.character.animation = normalizeAnimationState(defaults.character.animation, {
    compatibleRig: state.activeVersions.rig,
    sourcePoseVersion: state.activeVersions.pose,
    targetProportionRevision: currentProportionRevision(state),
  });
}

export function publishData(state, version = MODULE_VERSION) {
  state.character.animation = normalizeAnimationState(state.character.animation, {
    compatibleRig: state.activeVersions.rig,
    sourcePoseVersion: state.activeVersions.pose,
    targetProportionRevision: currentProportionRevision(state),
  });
  const reports = state.character.animation.clips.map(validateAnimationClip);
  if (reports.some((report) => !report.valid)) throw new Error('存在未通过协议校验的动画片段，当前不能发布。');
  state.modules.animation.version = version;
  state.modules.animation.status = 'testing';
  state.modules.animation.statusLabel = '集成测试';
  state.modules.animation.progress = Math.max(state.modules.animation.progress, 82);
  state.modules.animation.completed = Math.max(state.modules.animation.completed, 16);
  state.modules.animation.passed = Math.max(state.modules.animation.passed, 48);
  state.modules.animation.currentTask = '接入共享临时播放锚点、动作物理求解器和带 SkinnedMesh 的最终 GLB 合并导出';
  state.modules.animation.compatibleRig = state.activeVersions.rig;
  state.activeVersions.animation = version;
}

function bindClipAndTransportControls(context) {
  const clipSelect = document.querySelector('#clipSelect');
  clipSelect?.addEventListener('change', () => {
    resetRuntimeCache();
    transactionAnimation(context, `切换动画片段 ${clipSelect.value}`, (next) => setActiveClip(next, clipSelect.value));
  });

  document.querySelector('#playAnimation')?.addEventListener('click', () => {
    const now = Date.now();
    const current = normalizeForState(context.getState());
    const nextPlaying = !current.transport.playing;
    const start = resolveTransportPlaybackStart(current, now);
    const raw = start.rawTime;
    const display = start.time;
    if (nextPlaying) resetRuntimeCache({ preserveEventTime: !start.restarted });
    transactionAnimation(context, `${nextPlaying ? '播放' : '暂停'}动画片段`, (next) => setTransport(next, {
      playing: nextPlaying,
      time: display,
      anchorTime: display,
      anchorRawTime: raw,
      anchorIssuedAt: nextPlaying ? now : 0,
    }, now));
    publishTransportAnchor(context, normalizeForState(context.getState()), now);
  });

  document.querySelector('#stopAnimation')?.addEventListener('click', () => {
    resetRuntimeCache();
    transactionAnimation(context, '停止动画并返回起点', (next) => setTransport(next, {
      playing: false,
      time: 0,
      rawTime: 0,
      anchorTime: 0,
      anchorRawTime: 0,
      anchorIssuedAt: 0,
    }));
    publishTransportAnchor(context, normalizeForState(context.getState()));
  });

  document.querySelector('#previousFrame')?.addEventListener('click', () => stepTimeline(context, -1));
  document.querySelector('#nextFrame')?.addEventListener('click', () => stepTimeline(context, 1));

  bindTimelineInput(context);
  bindSpeedInput(context);

  document.querySelector('#clipLoopMode')?.addEventListener('change', (event) => {
    transactionAnimation(context, `片段循环模式改为 ${event.target.value}`, (next) => {
      const clip = getActiveClip(next);
      clip.loopMode = event.target.value;
      clip.clipRevision += 1;
      next = replaceClip(next, clip);
      return setTransport(next, { loop: event.target.value !== 'once' });
    });
  });

  document.querySelector('#rootMotionMode')?.addEventListener('change', (event) => {
    resetRuntimeCache();
    transactionAnimation(context, `根运动模式改为 ${event.target.value}`, (next) => {
      const clip = getActiveClip(next);
      clip.rootMotionMode = event.target.value;
      clip.clipRevision += 1;
      return replaceClip(next, clip);
    });
  });

  bindToggle('animationLoop', (value) => {
    const now = Date.now();
    const current = normalizeForState(context.getState());
    const raw = computeTransportRawTime(current, now);
    const display = computeTransportTime(current, now);
    transactionAnimation(context, `${value ? '开启' : '关闭'}播放循环区间`, (next) => setTransport(next, {
      loop: value,
      time: display,
      anchorTime: display,
      anchorRawTime: raw,
      anchorIssuedAt: next.transport.playing ? now : 0,
    }, now));
  });

  document.querySelector('#newAnimationClip')?.addEventListener('click', () => {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    transactionAnimation(context, '创建新的动画片段草案', (next, projectState) => addClip(next, createEmptyClip({
      clipId: `custom-${stamp}`,
      name: `Custom ${stamp}`,
      duration: 2,
      compatibleRig: projectState.activeVersions.rig,
      sourceProportionRevision: currentProportionRevision(projectState),
      loopMode: 'once',
      metadata: { status: 'editable-draft', createdAt: new Date().toISOString() },
    })));
  });

  document.querySelector('#clearClipContent')?.addEventListener('click', () => transactionAnimation(context, '清空当前动画片段内容', (next) => (
    replaceClip(next, clearClipContent(getActiveClip(next)))
  )));

  document.querySelector('#exportAnimationClip')?.addEventListener('click', () => {
    const projectState = context.getState();
    const current = normalizeForState(projectState);
    const clip = getActiveClip(current);
    downloadJson(`${clip.clipId}-motion-clip-r${clip.clipRevision}.json`, serializeMotionClip(clip, {
      projectId: projectState.projectId,
      subjectId: 'default-character',
    }));
  });

  const importInput = document.querySelector('#importAnimationClipInput');
  document.querySelector('#importAnimationClip')?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    importInput.value = '';
    if (!file) return;
    try {
      const raw = await readJsonFile(file);
      const clip = raw?.schema === MOTION_CLIP_SCHEMA ? importMotionClip(raw) : normalizeClip(raw);
      const report = validateAnimationClip(clip);
      if (!report.valid) throw new Error(report.errors.join(', '));
      transactionAnimation(context, `导入动画片段 ${clip.name}`, (next) => addClip(next, clip));
    } catch (error) {
      alert(`导入动画片段失败：${error.message}`);
    }
  });
}

function bindRuntimeControls(context) {
  document.querySelector('#runtimeMode')?.addEventListener('change', (event) => {
    resetRuntimeCache();
    updateRuntime(context, { mode: event.target.value }, `切换动画运行模式 ${event.target.value}`);
  });
  document.querySelector('#previewSource')?.addEventListener('change', (event) => {
    updateRuntime(context, { previewSource: event.target.value }, `切换动画预览来源 ${event.target.value}`);
  });
  bindToggle('footLockEnabled', (value) => updateRuntime(context, { footLockEnabled: value }, `${value ? '开启' : '关闭'}脚底接触锁定`));
  bindToggle('jointLimitsEnabled', (value) => updateRuntime(context, { jointLimitsEnabled: value }, `${value ? '开启' : '关闭'}关节活动范围`));
  bindToggle('rootMotionEnabled', (value) => {
    resetRuntimeCache();
    updateRuntime(context, { rootMotionEnabled: value }, `${value ? '开启' : '关闭'}根节点位移`);
  });
  bindRangeCommit('followStiffness', '', (value) => updateRuntime(context, { followStiffness: value }, `物理跟随刚度调整为 ${value.toFixed(2)}`));
  bindRangeCommit('followDamping', '', (value) => updateRuntime(context, { followDamping: value }, `物理跟随阻尼调整为 ${value.toFixed(2)}`));
}

function bindLayerAndGraphControls(context) {
  bindToggle('upperBodyLayer', (value) => transactionAnimation(context, `${value ? '开启' : '关闭'}上半身覆盖层`, (next) => (
    setAnimationLayer(next, 'upper-body', { enabled: value, clipId: 'wave' })
  )));
  bindRangeCommit('upperBodyWeight', '', (value) => transactionAnimation(context, `上半身层权重调整为 ${value.toFixed(2)}`, (next) => (
    setAnimationLayer(next, 'upper-body', { weight: value, clipId: 'wave' })
  )));
  bindToggle('breathingLayer', (value) => transactionAnimation(context, `${value ? '开启' : '关闭'}呼吸加法层`, (next) => (
    setAnimationLayer(next, 'breathing-additive', { enabled: value, clipId: 'idle-breathe' })
  )));
  bindRangeCommit('breathingWeight', '', (value) => transactionAnimation(context, `呼吸层权重调整为 ${value.toFixed(2)}`, (next) => (
    setAnimationLayer(next, 'breathing-additive', { weight: value, clipId: 'idle-breathe' })
  )));

  document.querySelectorAll('[data-graph-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.graphAction;
    if (action === 'walk') requestGraphParameter(context, 'speed', 1, '状态机进入行走');
    else if (action === 'idle') requestGraphParameter(context, 'speed', 0, '状态机返回站立');
    else if (action === 'wave') requestGraphParameter(context, 'wave', true, '状态机触发挥手');
    else if (action === 'squat') requestGraphParameter(context, 'squat', true, '状态机触发下蹲');
  }));
}

function bindEditingAndAssetControls(context) {
  document.querySelector('#capturePoseKey')?.addEventListener('click', () => recordCurrentPose(context));
  document.querySelector('#removeNearestPoseKey')?.addEventListener('click', () => {
    const current = normalizeForState(context.getState());
    const time = computeTransportTime(current);
    transactionAnimation(context, '删除时间轴中最近的 PoseSnapshot 键', (next) => (
      replaceClip(next, removeNearestPoseSnapshotKey(getActiveClip(next), time))
    ));
  });

  document.querySelector('#addAnimationEvent')?.addEventListener('click', () => {
    const current = normalizeForState(context.getState());
    const time = computeTransportTime(current);
    transactionAnimation(context, '加入动画事件标记', (next) => replaceClip(next, addClipEvent(getActiveClip(next), {
      time,
      type: 'marker',
      payload: { label: `Marker ${getActiveClip(next).events.length + 1}` },
    })));
  });

  document.querySelector('#addFootContact')?.addEventListener('click', () => {
    const current = normalizeForState(context.getState());
    const clip = getActiveClip(current);
    const time = computeTransportTime(current);
    transactionAnimation(context, '加入左脚接触区间', (next) => replaceClip(next, addClipContact(getActiveClip(next), {
      jointId: 'leftFoot',
      start: time,
      end: Math.min(clip.duration, time + 0.35),
      mode: 'world_lock',
      positionWeight: 1,
      rotationWeight: 0.65,
    })));
  });

  document.querySelector('#mirrorAnimationClip')?.addEventListener('click', () => transactionAnimation(context, '生成当前动作的左右镜像副本', (next) => (
    addClip(next, mirrorAnimationClip(getActiveClip(next)))
  )));

  document.querySelector('#compressAnimationClip')?.addEventListener('click', () => transactionAnimation(context, '压缩当前动画轨道', (next) => (
    replaceClip(next, compressAnimationClip(getActiveClip(next), next.bake))
  )));

  document.querySelector('#retargetAnimationClip')?.addEventListener('click', () => {
    resetRuntimeCache();
    transactionAnimation(context, '生成当前人物比例的重定向动作版本', (next, projectState) => addClip(next, retargetAnimationClip(getActiveClip(next), {
      targetRig: projectState.activeVersions.rig,
      targetProportionRevision: currentProportionRevision(projectState),
      targetBodyProfile: projectState.character.bodyProfile,
      mapping: next.retarget.mapping,
    })));
  });

  document.querySelector('#bakeAnimationClip')?.addEventListener('click', () => {
    resetRuntimeCache();
    transactionAnimation(context, '烘焙约束后的 finalPose 动作', (next, projectState) => {
      const result = bakeAnimationSessionToMotionClip(next, projectState.character.bodyProfile, {
        ...next.bake,
        targetRig: projectState.activeVersions.rig,
        targetProportionRevision: currentProportionRevision(projectState),
      });
      return addClip(next, result.clip);
    });
  });

  document.querySelector('#exportBakedMotion')?.addEventListener('click', () => {
    const projectState = context.getState();
    const animation = normalizeForState(projectState);
    const result = bakeAnimationSessionToMotionClip(animation, projectState.character.bodyProfile, {
      ...animation.bake,
      targetRig: projectState.activeVersions.rig,
      targetProportionRevision: currentProportionRevision(projectState),
      projectId: projectState.projectId,
      subjectId: 'default-character',
    });
    downloadJson(`${result.clip.clipId}.motion.json`, result.asset);
  });

  document.querySelector('#exportAnimationGlb')?.addEventListener('click', () => {
    const projectState = context.getState();
    const animation = normalizeForState(projectState);
    const clip = getActiveClip(animation);
    const result = exportAnimationSkeletonGlb(clip, projectState.character.bodyProfile, {
      rigVersion: projectState.activeVersions.rig,
    });
    downloadBlob(`${clip.clipId}-skeleton-animation.glb`, result.glb, 'model/gltf-binary');
  });
}

function normalizeForState(state) {
  if (isNormalizedAnimationState(state.character.animation)) return state.character.animation;
  return normalizeAnimationState(state.character.animation, {
    compatibleRig: state.activeVersions.rig,
    sourcePoseVersion: state.activeVersions.pose,
    targetProportionRevision: currentProportionRevision(state),
  });
}

function transactionAnimation(context, summary, mutator) {
  context.hub.transaction((projectState) => {
    let animation = normalizeForState(projectState);
    animation = mutator(animation, projectState) || animation;
    projectState.character.animation = syncLegacyAnimationFields(animation);
    projectState.modules.animation.status = 'developing';
    projectState.modules.animation.statusLabel = '功能开发';
    projectState.modules.animation.progress = Math.max(projectState.modules.animation.progress, 82);
    projectState.modules.animation.completed = Math.max(projectState.modules.animation.completed, 16);
    projectState.modules.animation.passed = Math.max(projectState.modules.animation.passed, 48);
    projectState.modules.animation.currentTask = '验证双骨架采样、动画层、状态机、脚底接触、跨比例重定向和动作烘焙';
    projectState.modules.animation.compatibleRig = projectState.activeVersions.rig;
  }, { module: 'animation', summary });
}

function bindTimelineInput(context) {
  const input = document.querySelector('#animationTimeControl');
  const output = document.querySelector('#animationTimeControlOutput');
  if (!input) return;
  input.addEventListener('input', () => {
    const time = Number(input.value);
    if (output) output.value = `${time.toFixed(3)} s`;
    updateTimelineDom(time, Number(input.max));
    resetRuntimeCache({ preserveEventTime: true });
    const animation = normalizeForState(context.getState());
    previewAtTime(context, animation, time, { rawTime: time, deltaTime: 1 / 30 });
    context.hub.publishTransient('motion.scrub.preview', {
      clipId: getActiveClip(animation).clipId,
      time,
    }, {
      resource: `motion_clip:${getActiveClip(animation).clipId}`,
      syncGroup: animation.transport.syncGroup,
    });
  });
  input.addEventListener('change', () => {
    const time = Number(input.value);
    transactionAnimation(context, `时间轴移动到 ${time.toFixed(3)} s`, (next) => setTransport(next, {
      playing: false,
      time,
      rawTime: time,
      anchorTime: time,
      anchorRawTime: time,
      anchorIssuedAt: 0,
    }));
    publishTransportAnchor(context, normalizeForState(context.getState()));
  });
}

function bindSpeedInput(context) {
  const input = document.querySelector('#animationSpeedControl');
  const output = document.querySelector('#animationSpeedControlOutput');
  if (!input) return;
  input.addEventListener('input', () => {
    if (output) output.value = `${Number(input.value).toFixed(2)}×`;
  });
  input.addEventListener('change', () => {
    const now = Date.now();
    const current = normalizeForState(context.getState());
    const raw = computeTransportRawTime(current, now);
    const display = computeTransportTime(current, now);
    const speed = Number(input.value);
    transactionAnimation(context, `动画速度调整为 ${speed.toFixed(2)}×`, (next) => setTransport(next, {
      speed,
      time: display,
      anchorTime: display,
      anchorRawTime: raw,
      anchorIssuedAt: next.transport.playing ? now : 0,
    }, now));
    publishTransportAnchor(context, normalizeForState(context.getState()), now);
  });
}

function stepTimeline(context, direction) {
  const animation = normalizeForState(context.getState());
  const clip = getActiveClip(animation);
  const time = computeTransportTime(animation);
  const nextTime = Math.min(clip.duration, Math.max(0, time + animation.transport.frameStep * direction));
  resetRuntimeCache({ preserveEventTime: true });
  transactionAnimation(context, `${direction < 0 ? '后退' : '前进'}一帧`, (next) => setTransport(next, {
    playing: false,
    time: nextTime,
    rawTime: nextTime,
    anchorTime: nextTime,
    anchorRawTime: nextTime,
    anchorIssuedAt: 0,
  }));
  publishTransportAnchor(context, normalizeForState(context.getState()));
}

function publishTransportAnchor(context, animationInput, nowMs = Date.now()) {
  const animation = isNormalizedAnimationState(animationInput)
    ? animationInput
    : normalizeAnimationState(animationInput);
  const clip = getActiveClip(animation);
  const position = computeTransportTime(animation, nowMs);
  const rawPosition = computeTransportRawTime(animation, nowMs);
  context.hub.publishTransient('motion.transport.anchor', {
    clipId: clip.clipId,
    playing: animation.transport.playing,
    position,
    rawPosition,
    speed: animation.transport.speed,
    loopStart: animation.transport.loopStart,
    loopEnd: animation.transport.loopEnd,
    issuedAt: nowMs,
  }, {
    resource: `motion_clip:${clip.clipId}`,
    syncGroup: animation.transport.syncGroup,
  });
}

function updateRuntime(context, patch, summary) {
  transactionAnimation(context, summary, (next) => {
    next.runtime = { ...next.runtime, ...structuredClone(patch) };
    return normalizeAnimationState(next);
  });
}

function bindRangeCommit(id, suffix, onCommit) {
  const input = document.querySelector(`#${id}`);
  const output = document.querySelector(`#${id}Output`);
  if (!input) return;
  input.addEventListener('input', () => {
    if (output) output.value = `${Number(input.value).toFixed(2)}${suffix}`;
  });
  input.addEventListener('change', () => onCommit(Number(input.value)));
}

function requestGraphParameter(context, parameter, value, summary) {
  const now = Date.now();
  resetRuntimeCache();
  transactionAnimation(context, summary, (next) => {
    let evaluated = setGraphParameter(next, parameter, value);
    const result = evaluateAnimationGraph(evaluated, { nowMs: now, consumeTriggers: true });
    evaluated = result.animation;
    if (result.startedTransition) {
      evaluated = setTransport(evaluated, {
        playing: true,
        time: 0,
        rawTime: 0,
        anchorTime: 0,
        anchorRawTime: 0,
        anchorIssuedAt: now,
      }, now);
    }
    return evaluated;
  });
}

function recordCurrentPose(context) {
  const projectState = context.getState();
  const animation = normalizeForState(projectState);
  const time = computeTransportTime(animation);
  const rawTime = computeTransportRawTime(animation);
  const rig = createRigContext(projectState.character.bodyProfile, { rigVersion: projectState.activeVersions.rig });
  const currentPayload = projectState.character.pose?.v8Payload;
  let localPose = deriveLocalPoseFromV8Payload(currentPayload, rig);
  if (!localPose) {
    localPose = sampleAnimationRuntime(animation, {
      rawTime,
      bodyProfile: projectState.character.bodyProfile,
      rigVersion: projectState.activeVersions.rig,
    }).finalPose;
  }
  const snapshotPose = createPoseSnapshotFromLocalPose(localPose, {
    name: `Recorded ${time.toFixed(3)} s`,
    pinned: projectState.character.pose?.pinned || [],
  });

  transactionAnimation(context, `记录 ${time.toFixed(3)} 秒三维姿势为局部四元数关键帧`, (next, state) => {
    let clip = addPoseSnapshotKey(getActiveClip(next), {
      time,
      pose: snapshotPose,
      compatibleRig: state.activeVersions.rig,
      sourcePoseVersion: state.activeVersions.pose,
    });
    const poseKey = clip.poseKeys.reduce((best, key) => (
      !best || Math.abs(key.time - time) < Math.abs(best.time - time) ? key : best
    ), null);
    const snapshotId = poseKey?.snapshotId || null;
    clip = upsertTrackKeyframe(clip, {
      jointId: clip.rootJointId,
      channel: 'position',
      time,
      value: localPose.root.position,
      sourceSnapshotId: snapshotId,
    });
    clip = upsertTrackKeyframe(clip, {
      jointId: clip.rootJointId,
      channel: 'rotation',
      time,
      value: localPose.root.rotation,
      sourceSnapshotId: snapshotId,
    });
    for (const [jointId, value] of Object.entries(localPose.joints)) {
      clip = upsertTrackKeyframe(clip, {
        jointId,
        channel: 'rotation',
        time,
        value: value.rotation,
        sourceSnapshotId: snapshotId,
      });
    }
    clip.sourceProportionRevision = currentProportionRevision(state);
    return replaceClip(next, clip);
  });
}

function renderTimelineMarkers(clip) {
  const trackTimes = new Set();
  for (const track of clip.tracks) for (const key of track.keyframes) trackTimes.add(key.time.toFixed(4));
  const trackMarkers = [...trackTimes].map(Number).map((time) => marker(time, clip.duration, 9, 10, '轨道关键帧')).join('');
  const poseMarkers = clip.poseKeys.map((key) => marker(key.time, clip.duration, 6, 19, 'PoseSnapshot')).join('');
  const eventMarkers = clip.events.map((event) => marker(event.time, clip.duration, 3, 28, event.type)).join('');
  const contactMarkers = clip.contacts.map((contact) => {
    const left = timelinePercent(contact.start, clip.duration);
    const width = Math.max(.6, timelinePercent(contact.end, clip.duration) - left);
    return `<i title="${escapeHtml(contact.jointId)} 接触 ${contact.start.toFixed(3)} 至 ${contact.end.toFixed(3)} s" style="position:absolute;left:${left}%;width:${width}%;bottom:2px;height:4px;border-radius:3px;background:currentColor;opacity:.55"></i>`;
  }).join('');
  return `${trackMarkers}${poseMarkers}${eventMarkers}${contactMarkers}`;
}

function animationClipOptionsKey(animation) {
  return animation.clips.map((clip) => `${clip.clipId}:${clip.name}:${clip.duration}:${clip.loopMode}:${clip.rootMotionMode}`).join('|');
}

function animationControlsStructureKey(animation) {
  return `${animation.activeClipId}|${animation.clips.map((clip) => `${clip.clipId}:${clip.clipRevision}:${clip.duration}:${clip.tracks.length}:${clip.poseKeys.length}:${clip.events.length}:${clip.contacts.length}`).join('|')}`;
}

function syncAnimationControlsDom(context, animation, activeClip) {
  const root = context.elements.moduleControls;
  if (!root) return;
  const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
  const clipSelect = root.querySelector('#clipSelect');
  const optionsKey = animationClipOptionsKey(animation);
  if (clipSelect && clipSelect.dataset.optionsKey !== optionsKey && activeElement !== clipSelect) {
    clipSelect.innerHTML = animation.clips
      .map((clip) => `<option value="${escapeHtml(clip.clipId)}">${escapeHtml(clip.name)}</option>`)
      .join('');
    clipSelect.dataset.optionsKey = optionsKey;
  }
  if (clipSelect && activeElement !== clipSelect) clipSelect.value = activeClip.clipId;

  const playButton = root.querySelector('#playAnimation');
  if (playButton) playButton.textContent = animation.transport.playing ? '暂停' : '播放';

  const timeInput = root.querySelector('#animationTimeControl');
  if (timeInput) {
    timeInput.max = String(activeClip.duration);
    if (activeElement !== timeInput) timeInput.value = String(computeTransportTime(animation));
  }
  const timeOutput = root.querySelector('#animationTimeControlOutput');
  if (timeOutput && activeElement !== timeInput) timeOutput.value = `${computeTransportTime(animation).toFixed(3)} s`;

  const speedInput = root.querySelector('#animationSpeedControl');
  if (speedInput && activeElement !== speedInput) speedInput.value = String(animation.transport.speed);
  const speedOutput = root.querySelector('#animationSpeedControlOutput');
  if (speedOutput && activeElement !== speedInput) speedOutput.value = `${Number(animation.transport.speed).toFixed(2)}×`;

  syncSelectControl(root, '#clipLoopMode', activeElement, activeClip.loopMode);
  syncSelectControl(root, '#rootMotionMode', activeElement, activeClip.rootMotionMode);
  syncSelectControl(root, '#runtimeMode', activeElement, animation.runtime.mode);
  syncSelectControl(root, '#previewSource', activeElement, animation.runtime.previewSource);
  syncToggleControl(root, '#animationLoop', animation.transport.loop);
  syncToggleControl(root, '#footLockEnabled', animation.runtime.footLockEnabled);
  syncToggleControl(root, '#jointLimitsEnabled', animation.runtime.jointLimitsEnabled);
  syncToggleControl(root, '#rootMotionEnabled', animation.runtime.rootMotionEnabled);
  syncToggleControl(root, '#upperBodyLayer', Boolean(animation.layers.find((layer) => layer.layerId === 'upper-body')?.enabled));
  syncToggleControl(root, '#breathingLayer', Boolean(animation.layers.find((layer) => layer.layerId === 'breathing-additive')?.enabled));
  syncRangeControl(root, '#followStiffness', '#followStiffnessOutput', animation.runtime.followStiffness, activeElement);
  syncRangeControl(root, '#followDamping', '#followDampingOutput', animation.runtime.followDamping, activeElement);
  syncRangeControl(root, '#upperBodyWeight', '#upperBodyWeightOutput', animation.layers.find((layer) => layer.layerId === 'upper-body')?.weight ?? 1, activeElement);
  syncRangeControl(root, '#breathingWeight', '#breathingWeightOutput', animation.layers.find((layer) => layer.layerId === 'breathing-additive')?.weight ?? .35, activeElement);

  const markerRoot = root.querySelector('#animationTimelineMarkers');
  const structureKey = animationControlsStructureKey(animation);
  if (markerRoot && markerRoot.dataset.structureKey !== structureKey) {
    markerRoot.innerHTML = renderTimelineMarkers(activeClip);
    markerRoot.dataset.structureKey = structureKey;
  }
  const cursor = root.querySelector('#animationTimelineCursor');
  if (cursor) cursor.style.left = `${timelinePercent(computeTransportTime(animation), activeClip.duration)}%`;

  const status = root.querySelector('#animationRuntimeStatus');
  if (status) status.textContent = runtimeStatus(activeClip, computeTransportTime(animation));
  const graphStatus = root.querySelector('#animationGraphStatus');
  if (graphStatus) {
    graphStatus.textContent = graphStatusText(animation);
  }
}

function graphStatusText(animation) {
  if (animation.graph.controlMode !== 'graph') return `手动片段预览：${getActiveClip(animation).name}`;
  return `状态机：${animation.graph.activeStateId}${animation.graph.transition ? `，过渡 ${animation.graph.transition.fromStateId} → ${animation.graph.transition.toStateId}` : ''}`;
}

function syncSelectControl(root, selector, activeElement, value) {
  const element = root.querySelector(selector);
  if (element && element !== activeElement) element.value = String(value);
}

function syncToggleControl(root, selector, enabled) {
  const element = root.querySelector(selector);
  if (!element) return;
  element.classList.toggle('on', Boolean(enabled));
  element.setAttribute('aria-pressed', String(Boolean(enabled)));
}

function syncRangeControl(root, selector, outputSelector, value, activeElement) {
  const element = root.querySelector(selector);
  if (element && element !== activeElement) element.value = String(value);
  const output = root.querySelector(outputSelector);
  if (output && element !== activeElement) output.value = Number(value).toFixed(2);
}

function marker(time, duration, top, height, label) {
  return `<i title="${escapeHtml(label)} · ${Number(time).toFixed(3)} s" style="position:absolute;left:${timelinePercent(time, duration)}%;top:${top}px;width:5px;height:${height}px;border-radius:4px;background:currentColor;opacity:.72;transform:translateX(-50%)"></i>`;
}

function timelinePercent(time, duration) {
  return Math.max(0, Math.min(100, Number(time || 0) / Math.max(.001, Number(duration || 1)) * 100));
}

function runtimeStatus(clip, time) {
  const sampled = sampleAnimationClip(clip, time);
  const localTracks = Object.keys(sampled.joints).length + Number(Boolean(sampled.root.position)) + Number(Boolean(sampled.root.rotation));
  if (lastRuntimeFrame?.activeClipId === clip.clipId) {
    const diagnostics = lastRuntimeFrame.diagnostics;
    const eventText = lastRuntimeEvent ? `，最近事件 ${lastRuntimeEvent.type}` : '';
    return `三维运行中：${localTracks} 条局部目标，骨长误差 ${formatMeters(diagnostics.maxBoneLengthError)}，脚底误差 ${formatMeters(diagnostics.maxContactError)}${eventText}。`;
  }
  if (localTracks) return `当前可采样 ${localTracks} 条局部四元数或根节点目标，并按目标人物比例实时重建三维姿势。`;
  if (clip.poseKeys.length) return '当前片段可使用 PoseSnapshot 插值预览。记录三维姿势后会同步生成局部四元数轨道。';
  return '当前片段尚未包含可播放关键帧。';
}

function syncPlaybackLoop(context, animation) {
  if (!animation.transport.playing) {
    stopPlaybackLoop();
    return;
  }
  playbackContext = context;
  if (playbackFrame == null && typeof requestAnimationFrame === 'function') playbackFrame = requestAnimationFrame(playbackTick);
}

function stopPlaybackLoop() {
  if (playbackFrame != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(playbackFrame);
  playbackFrame = null;
  playbackContext = null;
  endingCommit = false;
  graphCommitPending = false;
}

function playbackTick(frameTimestamp) {
  playbackFrame = null;
  const context = playbackContext;
  if (!context) return;
  const projectState = context.getState();
  const animation = normalizeForState(projectState);
  if (!animation.transport.playing) {
    stopPlaybackLoop();
    return;
  }

  const clip = getActiveClip(animation);
  const now = Date.now();
  const rawTime = computeTransportRawTime(animation, now);
  const time = computeTransportTime(animation, now);
  const deltaTime = previousPreviewAt ? Math.min(.1, Math.max(1 / 240, (frameTimestamp - previousPreviewAt) / 1000)) : 1 / 60;
  previousPreviewAt = frameTimestamp;

  const graphResult = evaluateAnimationGraph(animation, { nowMs: now, consumeTriggers: true });
  if (graphResult.changed && !graphCommitPending) {
    graphCommitPending = true;
    transactionAnimation(context, graphResult.startedTransition ? '动画状态机开始交叉过渡' : '动画状态机完成交叉过渡', (next) => {
      let evaluated = graphResult.animation;
      if (graphResult.startedTransition) {
        evaluated = setTransport(evaluated, {
          playing: true,
          time: 0,
          rawTime: 0,
          anchorTime: 0,
          anchorRawTime: 0,
          anchorIssuedAt: now,
        }, now);
      }
      return evaluated;
    });
    queueMicrotask(() => { graphCommitPending = false; });
    return;
  }

  updateTimelineDom(time, clip.duration);
  previewAtTime(context, animation, time, { rawTime, deltaTime, nowMs: now });
  dispatchPlaybackEvents(clip, rawTime);

  const shouldStop = !animation.transport.loop
    && animation.transport.speed >= 0
    && rawTime >= animation.transport.loopEnd - 1e-6
    && !animation.graph.transition;
  const shouldStopReverse = !animation.transport.loop
    && animation.transport.speed < 0
    && rawTime <= animation.transport.loopStart + 1e-6
    && !animation.graph.transition;
  if ((shouldStop || shouldStopReverse) && !endingCommit) {
    endingCommit = true;
    const endpoint = shouldStop ? animation.transport.loopEnd : animation.transport.loopStart;
    transactionAnimation(context, '动画播放到循环区间端点', (next) => setTransport(next, {
      playing: false,
      time: endpoint,
      rawTime: endpoint,
      anchorTime: endpoint,
      anchorRawTime: endpoint,
      anchorIssuedAt: 0,
    }, now));
    return;
  }
  playbackFrame = requestAnimationFrame(playbackTick);
}

function dispatchPlaybackEvents(clip, rawTime) {
  if (lastPlaybackClipId !== clip.clipId || lastPlaybackRawTime == null) {
    lastPlaybackClipId = clip.clipId;
    lastPlaybackRawTime = rawTime;
    return;
  }
  const events = collectAnimationEvents(clip, lastPlaybackRawTime, rawTime);
  if (events.length) {
    lastRuntimeEvent = events.at(-1);
    const status = document.querySelector('#animationRuntimeStatus');
    if (status) status.textContent = `事件 ${lastRuntimeEvent.type}，时间 ${lastRuntimeEvent.rawTime.toFixed(3)} s，方向 ${lastRuntimeEvent.playbackDirection > 0 ? '正向' : '反向'}。`;
  }
  lastPlaybackRawTime = rawTime;
}

function updateTimelineDom(time, duration) {
  const input = document.querySelector('#animationTimeControl');
  const output = document.querySelector('#animationTimeControlOutput');
  const cursor = document.querySelector('#animationTimelineCursor');
  if (input && document.activeElement !== input) input.value = String(time);
  if (output && document.activeElement !== input) output.value = `${Number(time).toFixed(3)} s`;
  if (cursor) cursor.style.left = `${timelinePercent(time, duration)}%`;
}

function previewAtTime(context, animationInput, time, {
  rawTime = time,
  deltaTime = 1 / 60,
  nowMs = Date.now(),
} = {}) {
  const animation = isNormalizedAnimationState(animationInput)
    ? animationInput
    : normalizeAnimationState(animationInput);
  const clip = getActiveClip(animation);
  const state = context.getState();
  const localSample = sampleAnimationClip(clip, time, { loopMode: animation.transport.loop ? clip.loopMode : 'once' });
  const localTrackCount = Object.keys(localSample.joints).length + Number(Boolean(localSample.root.position)) + Number(Boolean(localSample.root.rotation));
  const status = document.querySelector('#animationRuntimeStatus');

  if (localTrackCount > 0) {
    const runtimeFrame = sampleAnimationRuntime(animation, {
      rawTime,
      nowMs,
      bodyProfile: state.character.bodyProfile,
      rigVersion: state.activeVersions.rig,
      previousFinalPose: previousRuntimePose,
      deltaTime,
    });
    previousRuntimePose = runtimeFrame.finalPose;
    lastRuntimeFrame = runtimeFrame;
    postPosePreview(context, runtimeFrame.v8Payload, runtimeFrame.finalPose);
    if (status) status.textContent = runtimeStatus(clip, time);
    return;
  }

  const poseSample = samplePoseSnapshotClip(clip, time, { loopMode: animation.transport.loop ? clip.loopMode : 'once' });
  if (poseSample?.format === 'v8-world-position@1' && poseSample.payload?.payload) {
    postPosePreview(context, poseSample.payload.payload);
    if (status) status.textContent = '世界坐标 PoseSnapshot 过渡预览已发送。正式动作建议记录为局部四元数轨道。';
    return;
  }
  if (poseSample?.format === 'preview-2d@1') {
    if (status) status.textContent = '已采样二维 PoseSnapshot。三维播放需要局部四元数或 V8 三维姿势快照。';
    return;
  }
  if (status) status.textContent = runtimeStatus(clip, time);
}

function postPosePreview(context, v8Payload, localPose = null) {
  const frameWindow = context.elements.legacyFrame?.contentWindow;
  if (!frameWindow || typeof window === 'undefined') return;
  const state = context.getState();
  const poseSnapshot = localPose ? buildAnimationPoseSnapshot(localPose, state, v8Payload) : null;
  frameWindow.postMessage({
    protocol: HOST_PROTOCOL,
    type: 'HRL_ANIMATION_FRAME',
    revision: state.revision,
    module: 'animation',
    pose: {
      name: 'Animation Preview',
      poseSnapshot,
      v8Payload: structuredClone(v8Payload),
    },
  }, window.location.origin);
}

function buildAnimationPoseSnapshot(localPose, state, v8Payload) {
  const updatedAt = v8Payload?.updatedAt || new Date().toISOString();
  return {
    schema: 'humanoid_rig/pose_snapshot@1.0',
    schemaVersion: 1,
    type: 'PoseSnapshot',
    compatibleRig: state.activeVersions.rig,
    solverVersion: 'animation-runtime@0.4.0',
    name: 'Animation Preview',
    unit: 'meter',
    coordinateSystem: {
      handedness: 'right',
      upAxis: '+Y',
      forwardAxis: '+Z',
      rightAxis: '+X',
    },
    source: 'animation-runtime-v0.4',
    sourceRepresentation: 'local_quaternion_animation',
    rotationSpace: 'local',
    rotationConvention: v8Payload?.rotationConventions?.incomingBoneLocalRotations
      ?? 'incoming_bone_bind_delta_full_quaternion',
    rootJointId: 'hips',
    rootTranslation: [...localPose.root.position],
    rootRotation: [...localPose.root.rotation],
    localRotations: structuredClone(v8Payload?.incomingBoneLocalRotations ?? {}),
    ikTargets: [],
    pinnedJoints: {},
    diagnostics: {
      rotationDataCompleteness: 'full_quaternion',
      twistDataAvailable: true,
      jointAxisAdapterRequiredForStandardAnimation: false,
      lossyRotationConversion: false,
      warningCodes: [],
    },
    updatedAt,
    sourceLegacyUpdatedAt: updatedAt,
  };
}

function resetRuntimeCache({ preserveEventTime = false } = {}) {
  previousRuntimePose = null;
  previousPreviewAt = 0;
  lastRuntimeFrame = null;
  lastRuntimeEvent = null;
  if (!preserveEventTime) {
    lastPlaybackRawTime = null;
    lastPlaybackClipId = null;
  }
}

function currentProportionRevision(state) {
  return Math.max(
    0,
    Number(state.character?.bodyProfile?.draftRevision || 0),
    Number(state.moduleRevisions?.proportion || 0),
  );
}

function setSelectValue(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.value = String(value);
}

function formatMeters(value) {
  const number = Number(value || 0);
  if (number < .000001) return `${(number * 1000000).toFixed(3)} µm`;
  if (number < .001) return `${(number * 1000).toFixed(3)} mm`;
  return `${number.toFixed(4)} m`;
}

function downloadBlob(filename, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
