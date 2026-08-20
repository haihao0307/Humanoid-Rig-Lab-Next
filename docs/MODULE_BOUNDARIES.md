# Humanoid Rig Lab Next 模块边界

V0.5.0 将骨骼比例、人物蒙皮、动作与物理、动画系统拆成独立源码目录、独立状态切片和独立 revision。所有工作台可以观察同一个 V8.4 三维人物视口。

## 骨骼比例

源码目录：

```text
src/modules/proportion/
legacy/v8/src/body-profile.js
legacy/v8/src/skeleton-presets.js
```

拥有：

```text
RigDefinition
BodyProfile
BindPose
JointAxes
BoneLengths
JointLimits
比例预设
RigRules
骨架版本
```

V0.5.0 中比例工作台的正式中央视口是 3D。轻量 Canvas 只作为三维启动失败时的后备。

比例模块可以修改绑定尺寸，并从参考骨架重建新的 RigDefinition。它不能直接修改蒙皮权重、当前动作姿势和动画轨道。

## 人物蒙皮

源码目录：

```text
src/modules/skin/
legacy/v8/src/smpl-skin.js
```

拥有：

```text
SkinAsset
SkinBinding
SkinIndices
SkinWeights
BindMatrices
Materials
MorphTargets
表皮显示参数
```

骨骼 ID、父子层级和绑定骨长保持只读。比例模块产生新绑定草案后，蒙皮模块负责生成兼容表皮版本。

当前运行时自动权重属于实验路径，生产级成果需要预绑定 GLB 或许可明确的专业权重数据。

## 动作与物理

源码目录：

```text
src/modules/pose/
legacy/v8/src/physics-rig.js
legacy/v8/src/biomechanics.js
```

拥有：

```text
PoseSnapshot
IKTargets
PinnedJoints
ConstraintProfile
全身联动
阻尼
地面碰撞
单帧动作导入导出
```

动作求解不能通过修改绑定骨长实现目标。

## 动画系统

源码目录：

```text
src/modules/animation/
```

拥有：

```text
AnimationClip
AnimationGraph
Keyframes
Interpolation
Transitions
RetargetMap
播放状态
```

动画读取动作姿势，不修改绑定骨架和蒙皮权重。

## 综合预览

源码目录：

```text
src/modules/integration/
```

拥有：

```text
ActiveVersions
CompatibilityReport
ReviewRecord
ReleaseCandidate
集成快照
```

综合预览负责组合和验收，不重写各模块内部数据。

## 状态同步边界

比例模块 Patch 包含：

```text
bodyProfile
rigRules
activeVersions.rig
modules.proportion
```

蒙皮模块 Patch 包含：

```text
display
skin
activeVersions.skin
modules.skin
```

动作模块 Patch 包含：

```text
pose
physics
activeVersions.pose
modules.pose
```

动画模块 Patch 包含：

```text
animation
activeVersions.animation
modules.animation
```

多个窗口接近同时提交时，SharedWorker 按各模块 revision 合并，避免一个板块覆盖另一个板块。
