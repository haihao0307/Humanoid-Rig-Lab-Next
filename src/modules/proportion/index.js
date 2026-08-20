import { createDefaultState } from '../../default-state.js';
import { downloadJson } from '../../project-hub.js';
import { bodyProfileRequiresSkinRebind } from '../../../legacy/v8/src/body-profile.js';
import {
  createStandardHumanoidPreset,
  summarizeRigDefinition,
} from '../../../legacy/v8/src/skeleton-presets.js';
import { buildRigCapabilityReport, PRODUCTION_RIG_BLUEPRINT } from './rig-system.js';
import {
  bindNumericRange,
  bindToggle,
  controlSection,
  rangeControl,
  toggleControl,
} from '../../workspace-common.js';

const CORE_RIG_SUMMARY = summarizeRigDefinition(createStandardHumanoidPreset('A'));
const CORE_RIG_CAPABILITY = buildRigCapabilityReport(CORE_RIG_SUMMARY);

const PROFILE_PRESETS = Object.freeze({
  'smpl-male-surface-fit-1796-v3': {
    label: 'SMPL 男性示例参考',
    height: 1.795672,
    shoulderWidth: 0.420,
    hipWidth: 0.200,
    upperArmLength: 0.277218,
    forearmLength: 0.241402,
    handControlLength: 0.070774,
    thighLength: 0.425348,
    lowerLegLength: 0.403133,
  },
  'tall-balanced': {
    label: '高挑均衡成人',
    height: 1.900,
    shoulderWidth: 0.435,
    hipWidth: 0.205,
    upperArmLength: 0.300,
    forearmLength: 0.260,
    handControlLength: 0.075,
    thighLength: 0.465,
    lowerLegLength: 0.440,
  },
  'compact-balanced': {
    label: '紧凑均衡成人',
    height: 1.650,
    shoulderWidth: 0.385,
    hipWidth: 0.190,
    upperArmLength: 0.250,
    forearmLength: 0.220,
    handControlLength: 0.064,
    thighLength: 0.380,
    lowerLegLength: 0.365,
  },
  'broad-shoulder': {
    label: '宽肩成人参考',
    height: 1.800,
    shoulderWidth: 0.500,
    hipWidth: 0.205,
    upperArmLength: 0.285,
    forearmLength: 0.248,
    handControlLength: 0.072,
    thighLength: 0.425,
    lowerLegLength: 0.405,
  },
});

const RANGE_OPTIONS = Object.freeze([
  ['heightControl', 'height', '目标身高', ' m'],
  ['shoulderControl', 'shoulderWidth', '肩关节宽度', ' m'],
  ['hipControl', 'hipWidth', '髋关节宽度', ' m'],
  ['upperArmControl', 'upperArmLength', '上臂长度', ' m'],
  ['forearmControl', 'forearmLength', '前臂长度', ' m'],
  ['handControl', 'handControlLength', '腕到手控制点', ' m'],
  ['thighControl', 'thighLength', '大腿长度', ' m'],
  ['lowerLegControl', 'lowerLegLength', '小腿长度', ' m'],
]);

export function renderControls(context, state) {
  const profile = state.character.bodyProfile;
  const rules = state.character.rigRules;
  const metrics = context.getProfileMetrics?.() || null;
  const requiresRebind = bodyProfileRequiresSkinRebind(profile);
  const measured = metrics || profile;
  const maximumErrorMm = calculateMaximumMetricError(profile, measured) * 1000;

  context.elements.moduleControls.innerHTML =
    controlSection('三维比例预览', `
      <div class="control-row"><label for="bodyPreset">人体参考</label><select id="bodyPreset">
        ${Object.entries(PROFILE_PRESETS).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('')}
        <option value="custom">自定义体型</option>
      </select></div>
      <div class="control-row"><label for="proportionViewportMode">中央视口</label><select id="proportionViewportMode">
        <option value="skeleton">三维骨架</option>
        <option value="both">骨架和当前表皮参考</option>
        <option value="skin">当前表皮参考</option>
      </select></div>
      <p class="control-note">比例滑块直接驱动中央 WebGPU 或 WebGL 2 三维骨架，并实时重定位对应蒙皮骨骼，让表皮按骨段长度和关节间距同步变化。当前仍使用过渡权重，肩髋等极端姿势需要正式重新绑定版本继续修正。</p>`) +
    controlSection('整体尺度', `
      ${rangeControl('heightControl', '目标身高', 1.40, 2.15, .005, profile.height, ' m')}
      ${rangeControl('shoulderControl', '肩关节宽度', .28, .58, .002, profile.shoulderWidth, ' m')}
      ${rangeControl('hipControl', '髋关节宽度', .14, .38, .002, profile.hipWidth, ' m')}`) +
    controlSection('上肢比例', `
      ${rangeControl('upperArmControl', '上臂长度', .20, .40, .001, profile.upperArmLength, ' m')}
      ${rangeControl('forearmControl', '前臂长度', .18, .36, .001, profile.forearmLength, ' m')}
      ${rangeControl('handControl', '腕到手控制点', .04, .12, .001, profile.handControlLength, ' m')}`) +
    controlSection('下肢比例', `
      ${rangeControl('thighControl', '大腿长度', .30, .56, .001, profile.thighLength, ' m')}
      ${rangeControl('lowerLegControl', '小腿长度', .30, .54, .001, profile.lowerLegLength, ' m')}`) +
    controlSection('三维测量结果', `
      <div class="metric-list compact-metrics">
        <div><span>实际三维身高</span><b>${formatMetric(measured.height)} m</b></div>
        <div><span>实际肩关节宽度</span><b>${formatMetric(measured.shoulderWidth)} m</b></div>
        <div><span>实际髋关节宽度</span><b>${formatMetric(measured.hipWidth)} m</b></div>
        <div><span>实际上臂长度</span><b>${formatMetric(measured.upperArmLength)} m</b></div>
        <div><span>实际前臂长度</span><b>${formatMetric(measured.forearmLength)} m</b></div>
        <div><span>实际手部控制段</span><b>${formatMetric(measured.handControlLength)} m</b></div>
        <div><span>实际大腿长度</span><b>${formatMetric(measured.thighLength)} m</b></div>
        <div><span>实际小腿长度</span><b>${formatMetric(measured.lowerLegLength)} m</b></div>
        <div><span>目标最大误差</span><b class="${maximumErrorMm <= 0.001 ? 'success-text' : 'warning-text'}">${maximumErrorMm.toFixed(3)} mm</b></div>
        <div><span>绑定草案</span><b>draft ${profile.draftRevision || 1}</b></div>
        <div><span>表皮重新绑定</span><b class="${requiresRebind ? 'warning-text' : 'success-text'}">${requiresRebind ? '需要' : '无需'}</b></div>
      </div>`) +
    controlSection('骨架系统能力', `
      <div class="metric-list compact-metrics">
        <div><span>稳定变形关节</span><b>${CORE_RIG_SUMMARY.counts.deform}</b></div>
        <div><span>编辑控制节点</span><b>${CORE_RIG_SUMMARY.counts.control}</b></div>
        <div><span>测量标记</span><b>${CORE_RIG_SUMMARY.counts.marker}</b></div>
        <div><span>默认可见关节</span><b>${CORE_RIG_SUMMARY.counts.visibleJoints}</b></div>
        <div><span>隐藏节点</span><b>${CORE_RIG_SUMMARY.hiddenJointIds.length}</b></div>
        <div><span>关节轴契约</span><b class="${CORE_RIG_SUMMARY.axisAudit.complete && CORE_RIG_SUMMARY.axisAudit.orthonormal ? 'success-text' : 'warning-text'}">${CORE_RIG_SUMMARY.axisAudit.presentEntryCount}/${CORE_RIG_SUMMARY.axisAudit.requiredEntryCount}</b></div>
        <div><span>基础身体动作</span><b class="success-text">可接入轴适配器</b></div>
        <div><span>精细肢体扭转</span><b class="warning-text">等待 8 个扭转骨</b></div>
        <div><span>手指与面部</span><b class="warning-text">尚未覆盖</b></div>
        <div><span>身体生产版目标</span><b>${PRODUCTION_RIG_BLUEPRINT.bodyProduction.deformJointTarget} 变形关节</b></div>
        <div><span>完整表现版目标</span><b>${PRODUCTION_RIG_BLUEPRINT.fullPerformance.deformJointTarget} 变形关节</b></div>
      </div>
      <p class="control-note">当前活动骨架继续使用 rig@0.4.0，并保持原有 24 个 SMPL ID 与 28 节点拓扑。头顶和脚趾末端只作为测量标记，默认不出现在主骨架视图。新增扭转骨、IK、手指和面部节点需在蒙皮、动作和动画板块完成兼容后再启用。</p>
      <div class="control-button-grid"><button class="control-button" id="exportRigAudit">导出当前骨架审计</button><button class="control-button" id="exportRigBlueprint">导出升级清单</button></div>`) +
    controlSection('绑定数据规则', `
      ${toggleControl('lockBoneIds', '锁定骨骼 ID', rules.lockBoneIds, '防止模块间骨骼映射失效')}
      ${toggleControl('lockBindPose', '发布后锁定绑定姿势', rules.lockBindPoseAfterPublish)}
      ${toggleControl('mirrorEditing', '左右镜像比例', rules.mirrorEditing)}
      <div class="control-button-grid"><button class="control-button" id="restoreReference">恢复参考比例</button><button class="control-button" id="generateRigDraft">生成新绑定草案</button></div>`);

  const bodyPreset = document.querySelector('#bodyPreset');
  if (bodyPreset) bodyPreset.value = PROFILE_PRESETS[profile.preset] ? profile.preset : 'custom';
  bodyPreset?.addEventListener('change', () => {
    if (bodyPreset.value === 'custom') {
      context.hub.transaction((next) => {
        next.character.bodyProfile.preset = 'custom';
        next.character.bodyProfile.requiresRebind = bodyProfileRequiresSkinRebind(next.character.bodyProfile);
        markDeveloping(next);
      }, { module: 'proportion', summary: '切换为自定义人体比例' });
      return;
    }
    const preset = PROFILE_PRESETS[bodyPreset.value];
    context.hub.transaction((next) => {
      next.character.bodyProfile = {
        ...next.character.bodyProfile,
        ...structuredClone(preset),
        preset: bodyPreset.value,
      };
      next.character.bodyProfile.requiresRebind = bodyProfileRequiresSkinRebind(next.character.bodyProfile);
      markDeveloping(next);
    }, { module: 'proportion', summary: `应用比例预设 ${preset.label}` });
  });

  const viewportMode = document.querySelector('#proportionViewportMode');
  if (viewportMode) viewportMode.value = profile.viewportMode || 'skeleton';
  viewportMode?.addEventListener('change', () => context.hub.transaction((next) => {
    next.character.bodyProfile.viewportMode = viewportMode.value;
  }, { module: 'proportion', summary: `比例工作台切换为 ${viewportMode.options[viewportMode.selectedIndex].text}` }));

  for (const [id, key, label, suffix] of RANGE_OPTIONS) {
    bindNumericRange({
      id,
      path: `character.bodyProfile.${key}`,
      label,
      suffix,
      module: 'proportion',
      hub: context.hub,
      onInput: (value) => {
        const previewProfile = { ...context.getState().character.bodyProfile, [key]: value, preset: 'custom' };
        previewProfile.requiresRebind = bodyProfileRequiresSkinRebind(previewProfile);
        context.previewBodyProfile?.(previewProfile);
      },
      onMutate: (next) => {
        next.character.bodyProfile.preset = 'custom';
        next.character.bodyProfile.requiresRebind = bodyProfileRequiresSkinRebind(next.character.bodyProfile);
        markDeveloping(next);
      },
    });
  }

  bindToggle('lockBoneIds', (value) => context.hub.transaction((next) => {
    next.character.rigRules.lockBoneIds = value;
  }, { module: 'proportion', summary: `${value ? '锁定' : '解锁'}骨骼 ID` }));
  bindToggle('lockBindPose', (value) => context.hub.transaction((next) => {
    next.character.rigRules.lockBindPoseAfterPublish = value;
  }, { module: 'proportion', summary: `${value ? '开启' : '关闭'}发布后绑定姿势锁定` }));
  bindToggle('mirrorEditing', (value) => context.hub.transaction((next) => {
    next.character.rigRules.mirrorEditing = value;
  }, { module: 'proportion', summary: `${value ? '开启' : '关闭'}左右镜像比例` }));

  document.querySelector('#exportRigAudit')?.addEventListener('click', () => downloadJson(
    `rig-system-audit-${Date.now()}.json`,
    {
      generatedAt: new Date().toISOString(),
      activeRig: state.activeVersions.rig,
      summary: CORE_RIG_SUMMARY,
      capability: CORE_RIG_CAPABILITY,
    },
  ));

  document.querySelector('#exportRigBlueprint')?.addEventListener('click', () => downloadJson(
    `rig-production-blueprint-${Date.now()}.json`,
    {
      generatedAt: new Date().toISOString(),
      activeRig: state.activeVersions.rig,
      blueprint: PRODUCTION_RIG_BLUEPRINT,
    },
  ));

  document.querySelector('#restoreReference')?.addEventListener('click', () => {
    const defaults = createDefaultState().character.bodyProfile;
    context.hub.transaction((next) => {
      next.character.bodyProfile = structuredClone(defaults);
      markDeveloping(next);
    }, { module: 'proportion', summary: '恢复 SMPL 男性示例参考比例' });
  });

  document.querySelector('#generateRigDraft')?.addEventListener('click', () => {
    context.hub.transaction((next) => {
      next.character.bodyProfile.draftRevision = Math.max(1, Number(next.character.bodyProfile.draftRevision || 1)) + 1;
      next.character.bodyProfile.requiresRebind = bodyProfileRequiresSkinRebind(next.character.bodyProfile);
      next.modules.proportion.currentTask = next.character.bodyProfile.requiresRebind
        ? '新绑定草案已生成，等待蒙皮模块重新绑定表皮并执行兼容检查'
        : '参考绑定草案已生成，当前表皮绑定继续兼容';
      next.modules.proportion.progress = Math.max(next.modules.proportion.progress, 62);
    }, { module: 'proportion', summary: '生成新的三维绑定比例草案' });
  });
}

function markDeveloping(state) {
  state.modules.proportion.status = 'developing';
  state.modules.proportion.statusLabel = '功能开发';
  state.modules.proportion.currentTask = '验证三维比例变化、固定骨长和表皮重新绑定边界';
}

function calculateMaximumMetricError(profile, metrics) {
  return RANGE_OPTIONS.reduce((maximum, [, key]) => {
    const target = Number(profile?.[key]);
    const actual = Number(metrics?.[key]);
    if (!Number.isFinite(target) || !Number.isFinite(actual)) return maximum;
    return Math.max(maximum, Math.abs(target - actual));
  }, 0);
}

function formatMetric(value) {
  return Number(value || 0).toFixed(3);
}

export function exportData(state) {
  return {
    bodyProfile: structuredClone(state.character.bodyProfile),
    rigRules: structuredClone(state.character.rigRules),
    rigSystemAudit: structuredClone(CORE_RIG_CAPABILITY),
    productionRigBlueprint: structuredClone(PRODUCTION_RIG_BLUEPRINT),
  };
}

export function resetData(state, defaults) {
  state.character.bodyProfile = structuredClone(defaults.character.bodyProfile);
  state.character.rigRules = structuredClone(defaults.character.rigRules);
}

export function publishData(state, version) {
  state.modules.proportion.version = version;
  state.modules.proportion.status = 'published';
  state.modules.proportion.statusLabel = '已发布';
  state.modules.proportion.progress = Math.max(state.modules.proportion.progress, 72);
  state.modules.proportion.currentTask = state.character.bodyProfile.requiresRebind
    ? '等待蒙皮模块为新绑定比例生成兼容表皮版本'
    : '参考绑定比例已经发布，可供其他模块继续使用';
  state.activeVersions.rig = version;
}
