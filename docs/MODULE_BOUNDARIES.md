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

## Character Core 总控边界

Character Core 位于四模块之上，通过 `characterCore` 引用各模块 revision，不成为新的骨骼、蒙皮、动作或动画编辑模块。

允许写入：

```text
character_id / name / version
identity、body_shape、face_identity、clothing_attachments、hair 与 accessory_attachments 引用
proportion / skin / face / clothing / hair / accessory / pose / animation revision
CharacterState revision 与 OperationEvent
```

禁止写入：

```text
骨骼定义与骨长
父子层级与绑定姿势
蒙皮权重
PoseSnapshot 的关节变换
动画轨道与关键帧
```

Character Core 通过 integration Patch 参与 SharedWorker、BroadcastChannel 和 localStorage 同步；Proportion、Skin、Pose、Animation Patch 不携带也不覆盖 `characterCore`。Clothing Patch 只携带服装状态及对应的 Character 附件引用，Appearance 则通过 integration Patch 同步外观状态与 Character 引用。

## BodyShape 边界

BodyShape 拥有肉体外观参数、版本历史及生成的 SkinShapeResponse。它读取表皮原始顶点并仅写入 Skin 顶点位置、法线和包围盒。

```text
BodyShape 可写：muscle、fat、区域 volume、Skin 顶点响应
BodyShape 只读：RigDefinition、BoneLengths、Hierarchy、PoseSnapshot、AnimationClip
Proportion 可写：骨架尺寸
BodyShape 不得把体积参数转换成骨长或关节位移
```

BodyShape 通过 integration Patch 与 Character Core 的 `body_shape_revision` 原子同步，现有四模块 Patch 的所有权规则保持不变。

## Face Identity 边界

Face 系统拥有人脸身份参数、草稿、版本历史和后端适配描述符。它不属于 Skin 或 Rig，也不把当前参数直接写入 CharacterProfile。

```text
Face 可写：age、face_shape、eye_shape、nose_shape、mouth_shape、expression_profile
Face Runtime 可写：face.identity_descriptor
Face 只读：Skin、RigDefinition、BoneLengths、Hierarchy、PoseSnapshot、AnimationClip
Character Core 只保存：face_identity.face_id、face_identity.revision、face_revision
```

FLAME、3DMM 与 AI Face Reconstruction 必须通过 `FaceRuntime.registerAdapter()` 接入。Face 保存、创建或恢复版本时通过 integration Patch 与 Character Core 原子同步；其 Patch 不修改现有四模块的数据切片。

## Clothing System 边界

Clothing 是独立的 Character 附件模块，不属于 Skin。Body Skin 只作为只读的内部身体层，Clothing Mesh 是它之后的独立渲染层。

```text
渲染顺序：Character → Body Skin → Clothing Mesh
Clothing 可写：ClothingProfile、ClothingAsset、Clothing Mesh 变换、服装材质
Clothing 只读：Body Skin、身体顶点、SkinWeights、RigDefinition、PoseSnapshot、AnimationClip
动作来源：simulationRig 关节变换
Character Core 只保存：clothing_attachments 与 clothing_revision
```

第一阶段只实现 `static-follow` 上衣、裤子和鞋。服装 Mesh 跟随 simulationRig 更新，但 `physics_profile.enabled` 固定为 `false`；布料动力学和身体碰撞留给后续阶段。添加、删除、保存、恢复操作通过独立 ClothingState revision 和 `clothing` ModulePatch 同步。

## Appearance System 边界

Appearance 是 Character 的独立外观附件域。Hair 使用一个活动槽位，Accessory 使用可并存附件列表，两者均不属于 Skin 或 Clothing。

```text
Appearance 可写：HairProfile、AccessoryProfile、活动发型、外观附件 Mesh 变换与材质
Appearance 只读：Body Skin、Clothing Mesh、RigDefinition、PoseSnapshot、AnimationClip
动作来源：simulationRig 关节变换
Character Core 只保存：hair、accessory_attachments、hair_revision、accessory_revision
禁止：毛发模拟、布料、GPU Hair、身体顶点修改、骨架修改
```

第一阶段运行时只输出 `static-attachments` 绑定帧。添加或切换发型、添加或删除附件、保存和恢复版本都增加 AppearanceState revision，并通过 integration Patch 与 Character Core 原子同步；原四模块及 Clothing 数据切片保持不变。

## Character Generator 边界

Character Generator 是跨模块数据编排入口，不拥有骨架、表皮、脸部、服装或动作算法。

```text
Generator 可写：CharacterGeneratorState、分析元数据、会话版本、CharacterProfile 引用
Generator 调用：HRL-M01 BodyProfile 规范化、HRL-M03 图片姿势重定向、各人物数据模块创建器、CharacterManager
Generator 不拥有：RigDefinition、SkinWeights、Face Mesh、Clothing Mesh、Pose Solver、AnimationTrack
Generator 不保存：原始图片二进制
Generator 不承诺：第一阶段直接生成最终真人模型
```

生成操作可原子写入 Proportion、BodyShape、Face Identity、Clothing、PoseSnapshot 和 Character Core；单独保存 Character Generator 新版本只增加 Character Core 与 integration revision，不虚构其他模块版本。所有持久化数据都通过 ProjectState schema 11 参与现有多窗口同步。
