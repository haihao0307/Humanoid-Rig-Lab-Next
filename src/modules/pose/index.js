import { createDefaultState, SCHEMA_VERSION } from '../../default-state.js';
import {
  bindNumericRange,
  bindToggle,
  controlSection,
  escapeHtml,
  rangeControl,
  toggleControl,
} from '../../workspace-common.js';
import { downloadJson } from '../../project-hub.js';
import { renderImagePosePanel } from './image-pose-controller.js';
import {
  buildPoseModuleData,
  buildStandalonePoseExport,
  canonicalPinId,
  inspectPoseContract,
  normalizePinnedJointIds,
  updateLegacyPin,
  updatePoseSnapshotPin,
} from './pose-contract.js';

export function renderControls(context, state) {
  const physics = state.character.physics;
  const pinned = normalizePinnedJointIds(state.character.pose.pinned);
  const contract = inspectPoseContract(state);
  context.elements.moduleControls.innerHTML =
    controlSection('图片复刻动作', `<div id="imagePosePanel"></div>`) +
    controlSection('动作预设', `
      <div class="control-button-grid">
        <button class="control-button" data-pose="a">A 姿势</button><button class="control-button" data-pose="t">T 姿势</button>
        <button class="control-button" data-pose="reach">向左伸手</button><button class="control-button" data-pose="step">迈步姿势</button>
      </div>`) +
    controlSection('物理与约束', `
      ${rangeControl('bodyCouplingControl', '全身联动', 0, 1, .01, physics.bodyCoupling, '')}
      ${rangeControl('dampingControl', '运动阻尼', 0, 1, .01, physics.damping, '')}
      ${toggleControl('leftFootPin', '固定左脚', pinned.includes('leftFoot'))}
      ${toggleControl('rightFootPin', '固定右脚', pinned.includes('rightFoot'))}
      ${toggleControl('jointLimits', '人体关节限制', physics.jointLimits)}
      ${toggleControl('groundEnabled', '地面碰撞', physics.groundEnabled)}
      <p class="control-note">脚部固定会同步写入现有 V8.4 世界坐标姿势。全身联动、阻尼、关节限制和地面碰撞已经进入共享动作状态，嵌入式求解器参数桥接仍需总控接线。</p>`) +
    controlSection('姿势数据协议', `
      <div class="toggle-row"><span>当前输出</span><b style="font-size:9px">${escapeHtml(contract.statusLabel)}</b></div>
      <p class="control-note">${escapeHtml(contract.detail)}</p>`) +
    controlSection('操作说明', `<p class="control-note">在中央统一三维人物上直接拖动表皮、关节或骨杆。松开鼠标后，动作模块 revision 会独立增加，并同步到其他工作台。</p><div class="control-button-grid"><button class="control-button" id="openLegacyPose">打开 V8.4 全屏物理编辑器</button><button class="control-button" id="exportPose">导出当前动作</button></div>`);

  document.querySelectorAll('[data-pose]').forEach((button) => button.addEventListener('click', () => {
    const preset = posePreset(button.dataset.pose);
    context.hub.transaction((next) => {
      next.character.pose.joints = preset.joints;
      next.character.pose.name = preset.label;
      next.character.pose.v8Payload = null;
      next.character.pose.poseSnapshot = null;
      next.character.pose.imagePoseAssetId = null;
      next.modules.pose.status = 'developing';
      next.modules.pose.statusLabel = '功能开发';
    }, { module: 'pose', summary: `应用动作预设 ${preset.label}` });
  }));

  bindNumericRange({ id: 'bodyCouplingControl', hub: context.hub, path: 'character.physics.bodyCoupling', module: 'pose', label: '全身联动' });
  bindNumericRange({ id: 'dampingControl', hub: context.hub, path: 'character.physics.damping', module: 'pose', label: '运动阻尼' });
  bindToggle('leftFootPin', (value) => updatePin(context, 'leftFoot', value));
  bindToggle('rightFootPin', (value) => updatePin(context, 'rightFoot', value));
  bindToggle('jointLimits', (value) => updatePhysicsToggle(context, 'jointLimits', value, '人体关节限制'));
  bindToggle('groundEnabled', (value) => updatePhysicsToggle(context, 'groundEnabled', value, '地面碰撞'));

  document.querySelector('#openLegacyPose')?.addEventListener('click', () => context.showLegacy({ surfaceSource: 'detail' }));
  document.querySelector('#exportPose')?.addEventListener('click', () => {
    const payload = buildStandalonePoseExport(context.getState(), SCHEMA_VERSION);
    downloadJson(`pose-module-${Date.now()}.json`, payload);
  });

  renderImagePosePanel(context, state);
}

function updatePhysicsToggle(context, field, value, label) {
  context.hub.transaction((next) => {
    next.character.physics[field] = value;
  }, { module: 'pose', summary: `${value ? '开启' : '关闭'}${label}` });
}

function updatePin(context, joint, pinned) {
  const canonicalJoint = canonicalPinId(joint);
  context.hub.transaction((state) => {
    const set = new Set(normalizePinnedJointIds(state.character.pose.pinned));
    if (pinned) set.add(canonicalJoint); else set.delete(canonicalJoint);
    state.character.pose.pinned = [...set];
    const legacyPayload = updateLegacyPin(
      state.character.pose.v8Payload,
      canonicalJoint,
      pinned,
    );
    state.character.pose.v8Payload = legacyPayload;
    state.character.pose.poseSnapshot = updatePoseSnapshotPin(
      state.character.pose.poseSnapshot,
      canonicalJoint,
      pinned,
      legacyPayload,
    );
  }, { module: 'pose', summary: `${pinned ? '固定' : '释放'} ${canonicalJoint}` });
}

function posePreset(name) {
  const joints = structuredClone(createDefaultState().character.pose.joints);
  if (name === 't') {
    joints.leftElbow = { x: -.31, y: .79 }; joints.leftWrist = { x: -.43, y: .79 }; joints.leftHand = { x: -.47, y: .79 };
    joints.rightElbow = { x: .31, y: .79 }; joints.rightWrist = { x: .43, y: .79 }; joints.rightHand = { x: .47, y: .79 };
  } else if (name === 'reach') {
    joints.leftShoulder = { x: -.14, y: .79 }; joints.leftElbow = { x: -.29, y: .76 }; joints.leftWrist = { x: -.41, y: .74 }; joints.leftHand = { x: -.46, y: .73 };
    joints.rightElbow = { x: .23, y: .67 }; joints.rightWrist = { x: .29, y: .57 }; joints.rightHand = { x: .31, y: .53 };
    joints.chest.x = -.025; joints.spine.x = -.015;
  } else if (name === 'step') {
    joints.leftKnee = { x: -.14, y: .31 }; joints.leftAnkle = { x: -.19, y: .12 }; joints.leftToe = { x: -.25, y: .07 };
    joints.rightKnee = { x: .11, y: .27 }; joints.rightAnkle = { x: .16, y: .07 }; joints.rightToe = { x: .22, y: .03 };
    joints.leftElbow = { x: -.22, y: .64 }; joints.rightElbow = { x: .29, y: .71 };
  }
  return { joints, label: name === 'a' ? 'A Pose' : name === 't' ? 'T Pose' : name === 'reach' ? 'Reach Left' : 'Step Pose' };
}

export function exportData(state) {
  return buildPoseModuleData(state);
}

export function resetData(state, defaults) {
  state.character.pose = structuredClone(defaults.character.pose);
  state.character.pose.pinned = normalizePinnedJointIds(state.character.pose.pinned);
  state.character.physics = structuredClone(defaults.character.physics);
  if (state.modules?.pose) {
    state.modules.pose.imagePose = {
      schema: 'humanoid_rig/image_pose_library@1.0',
      activeAssetId: null,
      assets: [],
    };
  }
}

export function publishData(state, version) {
  const contract = inspectPoseContract(state);
  if (contract.status !== 'canonical') {
    state.modules.pose.status = 'developing';
    state.modules.pose.statusLabel = '桥接待完成';
    state.modules.pose.currentTask = '将 V8.4 局部四元数 PoseSnapshot 接入主平台 v8Payload 与物理参数桥接';
    state.modules.pose.blockers = [...new Set([
      ...(state.modules.pose.blockers ?? []),
      '主平台仍接收旧版世界坐标姿势，需由总控窗口修改只读桥接文件',
    ])];
    return;
  }
  state.modules.pose.version = version;
  state.modules.pose.status = 'published';
  state.modules.pose.statusLabel = '已发布';
  state.modules.pose.progress = Math.max(state.modules.pose.progress, 65);
  state.modules.pose.currentTask = '等待动画板块引用局部四元数动作快照并进行连续播放测试';
  state.modules.pose.compatibleRig = state.activeVersions.rig;
  state.modules.pose.blockers = [];
  state.activeVersions.pose = version;
}
