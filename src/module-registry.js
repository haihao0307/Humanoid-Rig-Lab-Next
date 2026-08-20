export const MODULE_CONFIG = Object.freeze({
  proportion: {
    title: '骨骼比例', subtitle: '绑定骨架与人体尺度', eyebrow: 'PROPORTION MODULE', branch: 'work/proportion',
    description: '负责骨骼层级、绑定姿势、骨长、身体比例、关节轴和比例预设。该模块发布的 RigDefinition 是其他板块的共同基础。',
    writable: ['RigDefinition', 'BodyProfile', 'BindPose', 'JointAxes'], readonly: ['SkinBinding', 'PoseSnapshot', 'AnimationClip'],
  },
  skin: {
    title: '人物蒙皮', subtitle: '网格、材质与骨架绑定', eyebrow: 'SKIN MODULE', branch: 'work/skin',
    description: '负责人体网格、材质、蒙皮索引、蒙皮权重、绑定矩阵、Morph Target、BodyShape 表皮响应和表皮拾取。骨长和骨骼层级在这里保持只读。',
    writable: ['SkinAsset', 'SkinBinding', 'Materials', 'MorphTargets', 'BodyShapeSkinResponse'], readonly: ['RigDefinition', 'BoneLengths', 'AnimationTimeline'],
  },
  pose: {
    title: '动作与物理', subtitle: '单帧姿势、IK 与全身约束', eyebrow: 'POSE MODULE', branch: 'work/pose',
    description: '负责关节拖动、IK、固定点、地面碰撞、人体关节限制和单帧动作。拖动人物时保持绑定骨长不变。',
    writable: ['PoseSnapshot', 'IKTargets', 'Constraints', 'PinnedJoints'], readonly: ['RigDefinition', 'SkinWeights', 'AnimationCurves'],
  },
  animation: {
    title: '动画系统', subtitle: '时间轴、片段与状态混合', eyebrow: 'ANIMATION MODULE', branch: 'work/animation',
    description: '负责时间轴、关键帧、动画片段、循环、插值、状态切换和动作重定向。单帧姿势来自动作模块。',
    writable: ['AnimationClip', 'AnimationGraph', 'Transitions', 'RetargetMap'], readonly: ['BoneLengths', 'SkinWeights', 'BindPose'],
  },
  clothing: {
    title: '人物服装', subtitle: 'Character 附件与静态跟随', eyebrow: 'CLOTHING MODULE', branch: 'work/clothing',
    description: '负责上衣、裤子和鞋的独立资产、材质、尺码、版本与 simulationRig 静态跟随。服装作为 Character 附件存在，不属于 Skin。',
    writable: ['ClothingProfile', 'ClothingAsset', 'ClothingMesh', 'Material', 'SizeProfile'], readonly: ['BodySkin', 'RigDefinition', 'PoseSnapshot', 'AnimationClip'],
  },
  integration: {
    title: '综合预览', subtitle: '四个模块组合验收', eyebrow: 'INTEGRATION', branch: 'integration',
    description: '组合当前骨架、蒙皮、动作和动画版本，检查兼容性、视觉结果和发布条件。V8.5 统一三维比例与 89 节点人物视口会直接嵌入每个工作台。',
    writable: ['ActiveVersions', 'CharacterCore', 'BodyShapeState', 'FaceIdentity', 'FaceState', 'ReviewRecords', 'ReleaseCandidate'], readonly: ['ModuleInternals'],
  },
});

export const MODULE_ORDER = Object.freeze(['proportion', 'skin', 'pose', 'animation', 'clothing', 'integration']);

const LOADERS = {
  proportion: () => import('./modules/proportion/index.js'),
  skin: () => import('./modules/skin/index.js'),
  pose: () => import('./modules/pose/index.js'),
  animation: () => import('./modules/animation/index.js'),
  clothing: () => import('./modules/clothing/index.js'),
  integration: () => import('./modules/integration/index.js'),
};

export function resolveModuleId(value) {
  return MODULE_CONFIG[value] ? value : 'integration';
}

export function loadWorkspaceModule(moduleId) {
  return LOADERS[resolveModuleId(moduleId)]();
}
