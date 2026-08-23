# Human Motion Canonical Foundation V3

## 单一运动学事实链

正式人物运动统一遵循：

```text
RigDefinition
→ bind local offsets
→ jointAxes
→ outgoing joint-local rotations
→ shared forward kinematics
→ incoming bone bind delta
→ canonical PoseSnapshot
→ PhysicsRig
→ finalPose
→ Skin
```

`src/human-motion/kinematic-contract.js` 是无状态纯函数层。它读取现有 `RigDefinition` 和 `jointAxes`，不保存 ProjectState、不创建新状态中心，也不复制 89 节点定义。Animation Runtime 保留原导出名作为兼容包装；Pose 与 Animation 由此复用同一套 FK 和 incoming bridge。

## 坐标合同

```text
handedness  right
up           +Y
forward      +Z
right        +X
left joints  -X
right joints +X
```

关节解剖轴唯一来源仍是 RigDefinition 中 bind-local 的：

```text
twistAxisLocal
bendAxisLocal
sideAxisLocal
```

三轴单位化、互相正交，并满足 `cross(twist, bend) = side`。Canonical Builder 通过 `rotationFromAnatomicalChannels()` 使用这些轴；不会建立第二套 axis profile，也不会对普通 XYZ 四元数做 basis conjugation。

## 三种旋转语义

### Outgoing joint-local rotation

Animation、后续 Motion Solver 和 Canonical Pose Builder 的内部权威数据。关节旋转影响其子骨链：

```text
worldRotation[joint] = worldRotation[parent] × outgoingLocalRotation[joint]
worldPosition[child] = worldPosition[parent]
                     + rotate(bindLocalOffset[child], worldRotation[parent])
```

### Incoming bone bind delta

Canonical `humanoid_rig/pose_snapshot@1.0` 的 `localRotations` 语义。数据以子关节 ID 为键，旋转父节点到该子节点的 bind offset：

```text
incoming_bone_bind_delta_full_quaternion
```

唯一转换函数为 `buildIncomingBoneLocalRotations()`。Animation Runtime 的同名导出只是共享实现的兼容包装。

### Legacy world-position view

世界位置仅用于 FK 输出、视口缓存、调试和旧 V8 文件读取。世界位置重建局部旋转无法恢复轴向 twist，必须标记：

```text
sourceRepresentation: world_position_pbd
lossyRotationConversion: true
```

它不能成为新 Pose、Animation 或 Motion Skill 的权威数据。

## Canonical Pose Builder

`src/human-motion/canonical-pose-builder.js` 提供：

```text
createCanonicalNeutralPose()
createCanonicalAPose()
createCanonicalTPose()
createCanonicalReachPose()
createCanonicalStepPose()
createCanonicalPosePreset()
```

所有 Builder 先创建 outgoing local pose，再执行共享 FK 和 incoming bridge；输出稳定的 PoseSnapshot 以及只用于旧视口缓存的 V8 payload。

- A Pose：使用 RigDefinition 的 A bind local structure，所有正式关节都有显式单位局部旋转。
- T Pose：胸椎只做轻微稳定补偿；Shoulder 兼容段定位肩球窝；UpperArm 负责主要外展并明确 twist；LowerArm 保留轻微自然屈曲；Hand 明确掌面方向。
- Reach：肩带、胸椎和骨盆参与，解析式两段 IK 的结果写回 outgoing local rotation，世界目标只用于误差检查。
- Step：骨盆和脊柱参与平衡，髋、膝、踝、脚掌完整参与，支撑脚以 canonical pin 保存。

`src/modules/pose/index.js` 的 A/T/Reach/Step 按钮会写入 `character.pose.poseSnapshot` 和同源 `v8Payload`。原 `character.pose.joints` 及 `posePreset()` 仅保留为二维预览和旧 UI 兼容缓存。

## PhysicsRig 应用规则

`PhysicsRig.applyPoseSnapshot()` 对坐标系、rotation space、rotation convention 和 source representation 做显式校验。完整 incoming 四元数通过共享重建函数精确还原；若骨长与地面误差已经满足容差，则跳过高迭代 PBD，避免合法的肩、手和脚目标被再次拉动。

世界位置或 zero-twist 快照继续进入有损兼容路径，并保留必要的约束投影。`getPoseImportStats()` 报告是否 lossless、是否使用世界位置重建、是否请求/跳过投影及投影前误差。

## Core 与 Performance 边界

- `core`：基础躯干、肩臂、腿、足和趾，决定站立、Reach 与 Step 等基础运动。
- `performance`：twist、finger 和其他高质量细节节点。
- `derived`：scapula corrective 等派生变形节点。
- `control`：制作/求解控制节点。
- `marker`：接触和诊断标记。

Performance、Derived、Control 和 Marker 不得改变 Core Rig 的 bind 骨长。即使 Skin 尚无对应权重，Core Rig 的 canonical 运动仍保持稳定。

## 公开接口与后续 Solver 边界

Whole Body Motion Solver 后续可直接复用：

```text
createHumanKinematicContext()
validateHumanKinematicContext()
rotationFromAnatomicalChannels()
forwardKinematicsOutgoingPose()
buildIncomingBoneLocalRotations()
buildCanonicalPoseSnapshot()
compareOutgoingAndIncomingPose()
measureKinematicRoundTripError()
diagnoseCanonicalPose()
```

本层不实现 Locomotion Controller、Walk/Run、Text Motion Parser、Skill Graph 或第二个 Whole Body Solver。

## 资产限制

本次没有修改 `smpl-male-surface-skinned.glb`，也没有新增 Shoulder Skin Corrective。运动学 round-trip 和 T Pose 对称性已由数值测试通过；表面视觉质量仍受现有 SMPL 24 关节过渡权重限制，最终资产仍标记 `productionReady: false`。如浏览器人工验收确认肩峰、三角肌或腋窝仍塌陷，应在独立 Skin 任务中基于不可变 base vertex 增加非累积 corrective，而不是修改 canonical Rig 或 FK。
