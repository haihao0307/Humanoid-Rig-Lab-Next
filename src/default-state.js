import { createCharacterProfile, createCharacterState } from '../packages/character-core/index.js';
import { createBodyShapeProfile, createBodyShapeState } from '../packages/body-shape/index.js';
import { createFaceIdentity, createFaceState } from '../packages/face-system/index.js';
import { createClothingProfile, createClothingState } from '../packages/clothing-system/index.js';
import { createAppearanceState, getAppearanceCharacterReferences } from '../packages/appearance-system/index.js';
import { createCharacterGeneratorState } from '../apps/character-generator/character-generator.js';

export const BUILD_VERSION = '0.5.0';
export const BUILD_ID = 'four-module-v002-20260819';
export const BUILD_DATE = '2026-08-19';
export const SCHEMA_VERSION = 11;
export const MODULE_IDS = Object.freeze(['proportion', 'skin', 'pose', 'animation', 'clothing', 'integration']);
export const MODULE_BASE_REVISIONS = Object.freeze({ proportion: 3, skin: 3, pose: 3, animation: 4, clothing: 1, integration: 2 });
export const ACTIVE_VERSIONS = Object.freeze({
  rig: 'rig@0.4.0',
  skin: 'skin@0.5.1',
  pose: 'pose@0.4.0',
  animation: 'anim@0.4.0',
  clothing: 'clothing@0.1.0',
  appearance: 'appearance@0.1.0',
  generator: 'character-generator@0.1.0',
  character: 'character@0.6.4',
});

const JOINTS = {
  headTop: { x: 0, y: 0.985 },
  head: { x: 0, y: 0.925 },
  neck: { x: 0, y: 0.855 },
  chest: { x: 0, y: 0.755 },
  spine: { x: 0, y: 0.645 },
  pelvis: { x: 0, y: 0.525 },
  leftShoulder: { x: -0.145, y: 0.79 },
  leftElbow: { x: -0.275, y: 0.675 },
  leftWrist: { x: -0.365, y: 0.575 },
  leftHand: { x: -0.405, y: 0.54 },
  rightShoulder: { x: 0.145, y: 0.79 },
  rightElbow: { x: 0.275, y: 0.675 },
  rightWrist: { x: 0.365, y: 0.575 },
  rightHand: { x: 0.405, y: 0.54 },
  leftHip: { x: -0.075, y: 0.505 },
  leftKnee: { x: -0.08, y: 0.285 },
  leftAnkle: { x: -0.085, y: 0.075 },
  leftToe: { x: -0.125, y: 0.025 },
  rightHip: { x: 0.075, y: 0.505 },
  rightKnee: { x: 0.08, y: 0.285 },
  rightAnkle: { x: 0.085, y: 0.075 },
  rightToe: { x: 0.125, y: 0.025 }
};

const MODULES = {
  proportion: {
    id: 'proportion', title: '骨骼比例', shortTitle: '比例', status: 'testing', statusLabel: '内部测试',
    progress: 74, version: 'rig@0.4.0', compatibleRig: 'rig@0.4.0',
    currentTask: '验证关节角色与绑定轴契约，并准备追加式 rig@0.5.0 跨模块兼容评审', completed: 15, total: 20, passed: 40, failed: 0,
    blockers: [], color: '#58c7ff'
  },
  skin: {
    id: 'skin', title: '人物蒙皮', shortTitle: '蒙皮', status: 'testing', statusLabel: 'V002 单表皮实机复核',
    progress: 84, version: 'skin@0.5.1', compatibleRig: 'rig@0.4.0',
    currentTask: '使用 V002 构建验证入口复核全场景唯一 SkinnedMesh、肩髋权重与材质模式', completed: 17, total: 20, passed: 41, failed: 0,
    blockers: [
      '运行时稀疏姿势修正已接入；正式 SMPL 或等效专业权重与雕刻级修正形变仍待许可资产',
      'Windows WebGPU 实机视觉验收需要使用 V002 专用入口完成'
    ], color: '#ff9f68'
  },
  pose: {
    id: 'pose', title: '动作与物理', shortTitle: '动作', status: 'testing', statusLabel: '图片动作测试',
    progress: 74, version: 'pose@0.4.0', compatibleRig: 'rig@0.4.0',
    currentTask: '在统一三维人物中复核单张图片姿势的镜像、深度歧义、脚底接触和动作库复用', completed: 17, total: 24, passed: 39, failed: 0,
    blockers: [
      '首次自动识别需要联网下载 MediaPipe Tasks Vision 运行库和 Pose Landmarker 模型',
      '单张图片的关节前后深度需要通过镜像、深度翻转与人工微调确认'
    ], color: '#7fe0ad'
  },
  animation: {
    id: 'animation', title: '动画系统', shortTitle: '动画', status: 'testing', statusLabel: '动画核心纵向闭环完成，跨模块联调中',
    progress: 82, version: 'anim@0.4.0', compatibleRig: 'rig@0.4.0',
    currentTask: '联调共享临时播放消息、外部 simulationRig 求解器与最终 SkinnedMesh GLB 合并导出', completed: 19, total: 23, passed: 221, failed: 0,
    blockers: [
      '全身物理模式需要动作与物理模块开放 simulationRig 外部求解器接口',
      '带最终 SkinnedMesh 的 GLB 合并需要蒙皮运行时与导出器联调',
      '视觉点击验收需在普通桌面 Chrome 或 Edge 完成'
    ], color: '#c6a6ff'
  },
  clothing: {
    id: 'clothing', title: '人物服装', shortTitle: '服装', status: 'developing', statusLabel: '静态服装阶段',
    progress: 35, version: 'clothing@0.1.0', compatibleRig: 'rig@0.4.0',
    currentTask: '验证上衣、裤子和鞋的 simulationRig 静态跟随、Character 附件引用与版本恢复',
    completed: 7, total: 20, passed: 0, failed: 0,
    blockers: ['布料动力学与身体碰撞属于后续阶段，当前只实现静态跟随'], color: '#d9a56f'
  }
};

export function createDefaultState() {
  const now = new Date().toISOString();
  const moduleRevisions = Object.fromEntries(MODULE_IDS.map((id) => [id, MODULE_BASE_REVISIONS[id] ?? 1]));
  const moduleUpdatedAt = Object.fromEntries(MODULE_IDS.map((id) => [id, now]));
  const defaultBodyShapeProfile = createBodyShapeProfile({
    body_shape_id: 'body_shape_001',
    name: 'Neutral Body Shape',
  });
  const defaultFaceIdentity = createFaceIdentity({
    face_id: 'face_001',
    age: 30,
  });
  const defaultFaceState = createFaceState(defaultFaceIdentity);
  const defaultClothingProfile = createClothingProfile({
    clothing_profile_id: 'clothing_profile_001',
    character_id: 'character_001',
    assets: [],
  });
  const defaultAppearanceState = createAppearanceState({
    character_id: 'character_001',
    hair_profiles: [],
    accessories: [],
  });
  const defaultAppearanceReferences = getAppearanceCharacterReferences(defaultAppearanceState);
  const defaultCharacterProfile = createCharacterProfile({
    character_id: 'character_001',
    name: 'Default Character',
    identity: { identity_id: null, revision: 0, tags: [] },
    body_shape: { profile_id: defaultBodyShapeProfile.body_shape_id, revision: defaultBodyShapeProfile.version },
    body_shape_revision: defaultBodyShapeProfile.version,
    face_identity: { face_id: defaultFaceIdentity.face_id, revision: defaultFaceIdentity.version },
    face_revision: defaultFaceIdentity.version,
    expression_revision: defaultFaceState.expression.expressionRevision,
    expression_runtime_descriptor: defaultFaceState.expression_runtime_descriptor,
    clothing_attachments: [],
    clothing_revision: defaultClothingProfile.version,
    hair: defaultAppearanceReferences.hair,
    accessory_attachments: defaultAppearanceReferences.accessory_attachments,
    hair_revision: defaultAppearanceReferences.hair_revision,
    accessory_revision: defaultAppearanceReferences.accessory_revision,
  }, moduleRevisions);
  return {
    schemaVersion: SCHEMA_VERSION,
    projectId: 'humanoid-rig-lab-next',
    projectName: 'Humanoid Rig Lab Next',
    revision: 1,
    updatedAt: now,
    moduleRevisions,
    moduleUpdatedAt,
    build: {
      id: BUILD_ID,
      version: BUILD_VERSION,
      date: BUILD_DATE,
      channel: 'four-module-merged-review',
      source: 'four module v002 integration',
      commit: 'not-synced',
      modules: { proportion: 2, skin: 2, pose: 2, animation: 2, clothing: 1, appearance: 1, generator: 1 }
    },
    activeVersions: structuredClone(ACTIVE_VERSIONS),
    modules: structuredClone(MODULES),
    character: {
      bodyProfile: {
        preset: 'smpl-male-surface-fit-1796-v3', height: 1.795672, shoulderWidth: 0.42, hipWidth: 0.20,
        upperArmLength: 0.277218, forearmLength: 0.241402, handControlLength: 0.070774,
        thighLength: 0.425348, lowerLegLength: 0.403133,
        viewportMode: 'skeleton', requiresRebind: false, draftRevision: 1
      },
      rigRules: {
        lockBoneIds: true, lockBindPoseAfterPublish: true, mirrorEditing: true
      },
      display: {
        mode: 'both', skinVisible: true, skeletonVisible: true, skinOpacity: 0.92,
        surfaceMode: 'solid', gridVisible: true
      },
      skin: {
        source: 'detail',
        activeSource: 'detail',
        singleLayer: true,
        detailAsset: 'legacy/v8/assets/smpl/smpl-male-surface-skinned.glb',
        bindingMetadata: 'legacy/v8/assets/smpl/SKIN_BINDING_METADATA.json',
        bindingVersion: 'skin-transitional@0.5.0',
        runtimeBuildId: 'skin-v002-single-surface-guard',
        pickingSource: 'detailed-smpl-skinned-mesh',
        deformation: 'native-three-skinned-mesh',
        bindPoseProtection: true,
        reloadToken: 0
      },
      pose: {
        name: 'A Pose', joints: structuredClone(JOINTS), pinned: ['leftAnkle', 'rightAnkle'],
        poseSnapshot: null, v8Payload: null, imagePoseAssetId: null
      },
      physics: {
        bodyCoupling: 0.8, damping: 0.92, jointLimits: true, groundEnabled: true
      },
      animation: {
        clip: 'idle-breathe', playing: false, time: 0, duration: 3.2, speed: 1, loop: true,
        keyframes: []
      }
    },
    characterCore: createCharacterState({
      profiles: [defaultCharacterProfile],
      active_character_id: defaultCharacterProfile.character_id,
      revision: 1,
      updated_at: now,
    }),
    bodyShape: createBodyShapeState(defaultBodyShapeProfile),
    faceSystem: defaultFaceState,
    clothingSystem: createClothingState(defaultClothingProfile),
    appearanceSystem: defaultAppearanceState,
    characterGenerator: createCharacterGeneratorState(),
    operationEvents: [],
    collaboration: {
      onlineWindows: 1,
      lastWriter: 'initial-state',
      lastWriterByModule: Object.fromEntries(MODULE_IDS.map((id) => [id, null])),
      lock: null
    },
    activity: [{
      id: crypto.randomUUID(), at: now, module: 'system',
      summary: '创建四板块 V002 合并基线，统一比例、原生蒙皮、图片姿势和动画运行时'
    }],
    reviews: []
  };
}
