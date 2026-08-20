# Humanoid Rig Lab Next 共享数据协议

当前项目协议版本：`schemaVersion: 5`
当前合并构建：`four-module-v002-20260819`

## 1. ProjectState

ProjectState 是多窗口共享的结构化项目状态。SharedWorker 在同源窗口中维护当前副本，BroadcastChannel 和 localStorage 提供兼容回退。

```json
{
  "schemaVersion": 5,
  "projectId": "humanoid-rig-lab-next",
  "revision": 12,
  "buildId": "four-module-v002-20260819",
  "moduleRevisions": {
    "proportion": 3,
    "skin": 3,
    "pose": 3,
    "animation": 4,
    "integration": 2
  },
  "moduleUpdatedAt": {},
  "activeVersions": {
    "rig": "rig@0.4.0",
    "skin": "skin@0.5.1",
    "pose": "pose@0.4.0",
    "animation": "anim@0.4.0",
    "character": "character@0.5.0"
  },
  "modules": {},
  "character": {},
  "activity": [],
  "reviews": []
}
```

`revision` 记录项目整体正式变更。`moduleRevisions` 记录各模块自己的修改节奏。每个工作台只提交本模块拥有的数据切片，其他模块在接近同时产生的变化会被保留。

当前 schema 迁移会补齐今日四个模块的最低 revision、活动版本、构建身份和新增字段。旧项目内容继续保留，版本字段不会回退到历史模块版本。

## 2. ModulePatch

ModulePatch 是正式多窗口增量同步单位。

```json
{
  "module": "proportion",
  "moduleRevision": 4,
  "moduleUpdatedAt": "2026-08-19T10:00:00.000Z",
  "optimisticRevision": 12,
  "writer": "proportion:client-id",
  "moduleState": {},
  "bodyProfile": {},
  "rigRules": {},
  "activeVersion": "rig@0.4.0"
}
```

接收端比较对应模块的 revision 和更新时间。新 Patch 只合并该模块拥有的数据切片，过期 Patch 会被拒绝。正式 Patch 会增加 ProjectState revision，并进入保存和活动记录。

## 3. 临时消息总线

动画播放锚点、时间轴拖动预览和其他高频临时信息使用：

```text
humanoid_rig/transient_bus@1.0
```

示例：

```json
{
  "type": "TRANSIENT",
  "protocol": "humanoid_rig/transient_bus@1.0",
  "projectId": "humanoid-rig-lab-next",
  "channel": "motion.transport.anchor",
  "source": "animation:client-id",
  "issuedAt": 1787146200000,
  "payload": {
    "clipId": "walk-forward",
    "playing": true,
    "position": 0.72,
    "speed": 1,
    "loopStart": 0,
    "loopEnd": 1.2,
    "syncGroup": "editor-group-1"
  }
}
```

临时消息具备以下规则：

1. 不写入 ProjectState。
2. 不增加项目 revision 或 moduleRevision。
3. 不进入全局撤销和重做。
4. SharedWorker 会转发给同一项目的其他端口。
5. BroadcastChannel 回退使用相同协议。
6. 松开时间指针、保存关键帧或修改动作结构时，需要另行提交正式 ModulePatch。

## 4. HumanoidRigModuleBundle

模块更新包用于离线交接和不同代码对话之间传递成果。

```json
{
  "type": "HumanoidRigModuleBundle",
  "schemaVersion": 5,
  "module": "proportion",
  "moduleRevision": 3,
  "compatibleRig": "rig@0.4.0",
  "generatedAt": "2026-08-19T10:00:00.000Z",
  "data": {
    "bodyProfile": {},
    "rigRules": {}
  }
}
```

模块包只能导入同名工作台。导入后产生新的本地模块 revision，并同步到其他窗口。执行包的可写范围由 `control/module-scopes/<module>.json` 和对应交接记录共同确认。

## 5. BodyProfile

骨骼比例模块使用以下核心字段：

```json
{
  "preset": "smpl-male-surface-fit-1796-v3",
  "height": 1.795672,
  "shoulderWidth": 0.42,
  "hipWidth": 0.2,
  "upperArmLength": 0.277218,
  "forearmLength": 0.241402,
  "handControlLength": 0.070774,
  "thighLength": 0.425348,
  "lowerLegLength": 0.403133,
  "viewportMode": "skeleton",
  "requiresRebind": false,
  "draftRevision": 1
}
```

这些数据描述绑定骨架尺寸。动作、动画和蒙皮运行时不得覆盖它们。

`viewportMode` 只控制比例工作台视口：

```text
skeleton
both
skin
```

任一绑定尺寸变化会将 `requiresRebind` 设为 `true`。蒙皮模块随后需要发布兼容该绑定版本的 SkinBinding。

## 6. RigRules 与 RigDefinition

```json
{
  "lockBoneIds": true,
  "lockBindPoseAfterPublish": true,
  "mirrorEditing": true
}
```

RigDefinition 由比例模块拥有，包含：

```text
稳定骨骼 ID
父子层级
绑定局部位置
固定骨长
节点角色
绑定轴
关节活动范围
镜像关系
显示和求解角色
比例参数
升级蓝图
```

当前骨架导出 `schemaVersion` 为 `6`，活动版本为 `rig@0.4.0`。SMPL collar 节点继续作为隐藏控制点，每侧 UpperArm 节点承担可见肩关节语义。V002 的角色与绑定轴审计属于 `rig@0.4.0` 的兼容增强，未改变稳定拓扑。

## 7. 三维比例视口协议

母平台和 V8.4 iframe 使用同源 `postMessage`。

母平台发送：

```text
HRL_HOST_STATE
HRL_PREVIEW_BODY_PROFILE
```

V8.4 返回：

```text
HRL_EMBED_READY
HRL_RENDERER_STATUS
HRL_PROFILE_STATUS
HRL_SURFACE_STATUS
HRL_POSE_COMMIT
HRL_HOST_ACK
```

`HRL_PREVIEW_BODY_PROFILE` 用于滑块拖动过程，不增加项目 revision。`HRL_PROFILE_STATUS` 返回实际三维测量值和表皮重新绑定状态。

## 8. SkinBinding 与 SurfaceState

蒙皮模块拥有：

```text
网格资产 ID
兼容骨架版本
JOINTS_0
WEIGHTS_0
逆绑定矩阵
材质
Morph Target
表皮显示参数
表皮所有权与诊断
```

当前合并构建的表面协议：

```json
{
  "source": "detail",
  "activeSource": "detail",
  "singleLayer": true,
  "detailAsset": "legacy/v8/assets/smpl/smpl-male-surface-skinned.glb",
  "bindingMetadata": "legacy/v8/assets/smpl/SKIN_BINDING_METADATA.json",
  "bindingVersion": "skin-transitional@0.5.0",
  "runtimeBuildId": "skin-v002-single-surface-guard",
  "pickingSource": "detailed-smpl-skinned-mesh",
  "deformation": "native-three-skinned-mesh",
  "bindPoseProtection": true,
  "reloadToken": 0
}
```

当前资产约束：

```text
Mesh 1
Skin 1
关节 24
每顶点最多四个权重
24 组 inverseBindMatrices
场景中最多一个基础人体表面
同一 SkinnedMesh 承担显示、变形和拾取
```

合法衣服、头发、眼睛、配件和调试附件需要通过 `humanoidAttachmentRole` 或 `allowAlongsideHumanoidSurface` 明确标注。基础人体表面继续保持唯一所有者。

过渡性权重元数据标记为 `productionReady: false`。BodyProfile 改变后需要生成与新 RigDefinition 兼容的绑定版本。

## 9. PoseSnapshot 与 ConstraintProfile

标准单帧姿势协议：

```text
humanoid_rig/pose_snapshot@1.0
```

核心字段示例：

```json
{
  "schema": "humanoid_rig/pose_snapshot@1.0",
  "schemaVersion": 1,
  "type": "PoseSnapshot",
  "compatibleRig": "rig@0.4.0",
  "solverVersion": "physics-rig-position-pbd@0.4.2",
  "unit": "meter",
  "rotationSpace": "local",
  "rootJointId": "hips",
  "rootTranslation": [0, 0, 0],
  "rootRotation": [0, 0, 0, 1],
  "localRotations": {
    "hips": [0, 0, 0, 1],
    "leftUpperArm": [0.1, 0.2, 0.3, 0.92]
  },
  "ikTargets": [],
  "pinnedJoints": {},
  "constraints": {
    "fixedBoneLengths": true,
    "rigidPelvis": true,
    "jointLimits": true
  }
}
```

约束规则：

1. 四元数需要有效并归一化。
2. `localRotations` 以稳定关节 ID 为键。
3. 非根关节位置通道不进入标准姿势。
4. PoseSnapshot 不得包含骨长、绑定位置、父子层级或骨骼缩放。
5. V8.4 三维视口优先调用 `PhysicsRig.applyPoseSnapshot()`。
6. `character.pose.v8Payload` 中的世界坐标姿势继续作为旧项目和旧插件的回退。
7. 新提交可以同时保存 `poseSnapshot` 与同步的 `v8Payload`，时间戳用于防止旧快照覆盖新姿势。

图片姿势资产额外保存 PoseObservation、来源图片摘要、镜像、深度歧义、接触、质量和人工修正。图片二进制保存在 IndexedDB，不进入普通项目 JSON。

## 10. AnimationSession、AnimationClip 与 MotionClip

当前版本：

```text
AnimationSession  humanoid_rig/animation_session@0.4
AnimationClip     humanoid_rig/animation_clip@0.4
MotionClip        humanoid_rig/motion_clip@1.0
AnimationGraph    humanoid_rig/animation_graph@0.1
```

普通动画轨道允许：

```text
稳定关节 ID 的局部四元数
根节点位置
根节点旋转
事件
脚底和手部接触区间
动画层权重和骨链遮罩
PoseSnapshot 引用
```

普通动画轨道拒绝：

```text
非根关节位置
骨骼缩放
绑定局部位置
父子层级
固定骨长
逆绑定矩阵
蒙皮权重
```

AnimationSession 的主要持久字段：

```text
activeClipId
clips
transport 配置
layers
animation graph
runtime 模式
retarget 配置
bake 配置
poseSnapshotStore
metadata
```

播放中的高频时间位置由临时消息总线传递。关键帧、轨道、事件、动作元数据、烘焙结果和重定向结果通过正式模块 Patch 保存。

运行时帧保留：

```text
animationRig
simulationRig
desiredPose
finalPose
FK 缓存
PoseSnapshot
事件
接触
诊断
```

最终骨架、碰撞体和表皮应读取 `finalPose` 或其对应的 simulationRig 矩阵。

## 11. BuildManifest

每个可交付构建包含机器可读清单：

```text
BUILD_MANIFEST.json
```

核心字段：

```json
{
  "schema": "humanoid_rig/build_manifest@1.0",
  "id": "four-module-v002-20260819",
  "version": "0.5.0",
  "projectSchema": 5,
  "rigExportSchema": 6,
  "activeVersions": {},
  "moduleRevisions": {},
  "moduleDeliveries": {},
  "skinRuntime": {},
  "poseContract": {},
  "transientBus": "humanoid_rig/transient_bus@1.0"
}
```

Windows 启动器在复用已有 HTTP 端口前请求该文件并核对 `id`。构建 ID 不一致时继续寻找新端口，避免浏览器进入历史目录。

## 12. 兼容与迁移

V0.5.0 可以读取旧项目状态键：

```text
project-state:v4
project-state:v3
project-state:v2
project-state:v1
```

迁移会补齐：

```text
schemaVersion 5
当前 buildId
BodyProfile 新字段
RigRules
五个模块 revision
今日活动模块版本
原生预绑定蒙皮字段
标准 poseSnapshot 与图片动作字段
动画会话与关键帧数组
```

任何迁移都必须保持以下不变量：

```text
稳定骨骼 ID 不变
父子层级不变
已发布绑定骨长不被姿势覆盖
未知历史字段不会静默写入绑定层
其他模块的数据切片不会被单模块 Patch 删除
```
