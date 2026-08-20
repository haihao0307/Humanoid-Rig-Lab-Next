# Humanoid Rig Lab Next 共享数据协议

当前项目协议版本：`schemaVersion: 11`
当前合并构建：`four-module-v002-20260819`

## 1. ProjectState

ProjectState 是多窗口共享的结构化项目状态。SharedWorker 在同源窗口中维护当前副本，BroadcastChannel 和 localStorage 提供兼容回退。

```json
{
  "schemaVersion": 11,
  "projectId": "humanoid-rig-lab-next",
  "revision": 12,
  "buildId": "four-module-v002-20260819",
  "moduleRevisions": {
    "proportion": 3,
    "skin": 3,
    "pose": 3,
    "animation": 4,
    "clothing": 1,
    "integration": 2
  },
  "moduleUpdatedAt": {},
  "activeVersions": {
    "rig": "rig@0.4.0",
    "skin": "skin@0.5.1",
    "pose": "pose@0.4.0",
    "animation": "anim@0.4.0",
    "clothing": "clothing@0.1.0",
    "appearance": "appearance@0.1.0",
    "generator": "character-generator@0.1.0",
    "character": "character@0.6.4"
  },
  "modules": {},
  "character": {},
  "characterCore": {},
  "bodyShape": {},
  "faceSystem": {},
  "clothingSystem": {},
  "appearanceSystem": {},
  "characterGenerator": {},
  "operationEvents": [],
  "activity": [],
  "reviews": []
}
```

`revision` 记录项目整体正式变更。`moduleRevisions` 记录各模块自己的修改节奏。每个工作台只提交本模块拥有的数据切片，其他模块在接近同时产生的变化会被保留。

当前 schema 迁移会补齐四个原模块与 Clothing 的最低 revision，以及 Appearance、Character Generator 状态、活动版本、构建身份和新增字段。旧项目内容继续保留，版本字段不会回退到历史模块版本。

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
  "projectSchema": 11,
  "rigExportSchema": 7,
  "activeVersions": {},
  "moduleRevisions": {},
  "moduleDeliveries": {},
  "skinRuntime": {},
  "poseContract": {},
  "transientBus": "humanoid_rig/transient_bus@1.0",
  "characterCore": {},
  "clothingSystem": {},
  "characterGenerator": {}
}
```

Windows 启动器在复用已有 HTTP 端口前请求该文件并核对 `id`。构建 ID 不一致时继续寻找新端口，避免浏览器进入历史目录。

## 12. 兼容与迁移

schemaVersion 11 可以读取旧项目状态键：

```text
project-state:v10
project-state:v9
project-state:v8
project-state:v7
project-state:v6
project-state:v5
project-state:v4
project-state:v3
project-state:v2
project-state:v1
```

迁移会补齐：

```text
schemaVersion 11
当前 buildId
BodyProfile 新字段
RigRules
六个模块 revision
今日活动模块版本
原生预绑定蒙皮字段
标准 poseSnapshot 与图片动作字段
动画会话与关键帧数组
CharacterProfile、CharacterState 与 OperationEvent
BodyShapeProfile、BodyShapeState 与 SkinShapeResponse
FaceIdentity、FaceState 与 Face Runtime Descriptor
ClothingProfile、ClothingState 与 simulationRig 静态跟随描述符
HairProfile、AccessoryProfile、AppearanceState 与静态附件描述符
CharacterImageAnalysis、CharacterGeneratorSession 与 CharacterGeneratorState
```

任何迁移都必须保持以下不变量：

```text
稳定骨骼 ID 不变
父子层级不变
已发布绑定骨长不被姿势覆盖
未知历史字段不会静默写入绑定层
其他模块的数据切片不会被单模块 Patch 删除
```

## 13. Character Core

Character Core 是四模块之上的引用层，不是第五个几何或动画编辑模块。权威结构位于 `packages/character-core/`，JSON 校验规则位于 `schemas/character-profile.schema.json`。

```json
{
  "character_id": "character_001",
  "name": "Default Character",
  "version": 1,
  "identity": { "identity_id": null, "revision": 0, "tags": [] },
  "body_shape": { "profile_id": "body_shape_001", "revision": 1 },
  "face_identity": { "face_id": "face_001", "revision": 1 },
  "clothing_attachments": [],
  "hair": { "hair_id": null, "revision": 0 },
  "accessory_attachments": [],
  "proportion_revision": 3,
  "body_shape_revision": 1,
  "skin_revision": 3,
  "face_revision": 1,
  "clothing_revision": 1,
  "hair_revision": 0,
  "accessory_revision": 1,
  "pose_revision": 3,
  "animation_revision": 4
}
```

保存人物时必须提交当前 `characterCore.revision` 作为 `expected_revision`。成功保存会增加 CharacterState revision 和 CharacterProfile version，并生成 `humanoid_rig/operation_event@1.0`；旧 revision 会被拒绝，避免多窗口静默覆盖。CharacterProfile 只允许上述引用和人物自有元数据，不允许出现骨骼、骨长、父子关系、绑定姿势、动画轨道或关键帧。

## 14. BodyShape

BodyShapeProfile 使用 `humanoid_rig/body_shape_profile@1.0`，八个参数均限制在 `0..1`：

```json
{
  "body_shape_id": "body_shape_001",
  "name": "Neutral Body Shape",
  "version": 1,
  "muscle": 0.5,
  "fat": 0.5,
  "shoulder_volume": 0.5,
  "chest_volume": 0.5,
  "waist_volume": 0.5,
  "hip_volume": 0.5,
  "arm_volume": 0.5,
  "leg_volume": 0.5
}
```

BodyShapeState 保存当前草稿、已发布版本和 `SkinShapeResponse`。参数更新只从原始表皮顶点重新计算区域体积，不修改 RigDefinition、BoneLengths、Hierarchy、PoseSnapshot 或 AnimationClip。保存或恢复版本时，CharacterProfile 的 `body_shape.profile_id`、`body_shape.revision` 与 `body_shape_revision` 必须一致。

## 15. Face Identity

FaceIdentity 使用 `humanoid_rig/face_profile@1.0`，数据由 `packages/face-system/` 独立维护：

```json
{
  "face_id": "face_001",
  "version": 1,
  "age": 30,
  "face_shape": { "width": 0.5, "height": 0.5, "jaw_width": 0.5, "cheekbone": 0.5 },
  "eye_shape": { "size": 0.5, "spacing": 0.5, "tilt": 0.5 },
  "nose_shape": { "width": 0.5, "length": 0.5, "bridge_height": 0.5 },
  "mouth_shape": { "width": 0.5, "fullness": 0.5, "corner_curve": 0.5 },
  "expression_profile": {
    "profile_id": "expression_neutral",
    "revision": 1,
    "default_expression": "neutral"
  }
}
```

FaceState 使用独立 revision 保存当前草稿、历史版本和规范运行时描述符。参数值本身不进入 CharacterProfile；保存、创建或恢复 Face 版本时，只同步 `face_identity.face_id`、`face_identity.revision` 与 `face_revision`。运行时适配器目前预留 FLAME、3DMM 和 AI Face Reconstruction，唯一可写目标是 `face.identity_descriptor`，Skin、Rig、骨长、层级、Pose 与 Animation 继续保持只读。

## 16. Clothing System

ClothingProfile 使用 `humanoid_rig/clothing_profile@1.0`，并通过 `clothingSystem` 独立于 Skin 保存：

```json
{
  "clothing_profile_id": "clothing_profile_001",
  "character_id": "character_001",
  "version": 2,
  "assets": [
    {
      "clothing_id": "top_001",
      "revision": 1,
      "type": "top",
      "rig_profile": {
        "target": "simulationRig",
        "rig_revision": "rig@0.4.0",
        "attachment_points": ["spine", "chest", "upperChest", "leftUpperArm", "rightUpperArm"]
      },
      "material": { "base_color": "#526d9e", "roughness": 0.78, "metalness": 0.02, "opacity": 1 },
      "physics_profile": { "mode": "static-follow", "enabled": false, "collision": "none" },
      "size_profile": { "size": "M", "scale": 1, "body_shape_revision": 1 }
    }
  ]
}
```

第一阶段只支持 `top`、`pants`、`shoes`。Clothing Runtime 读取 simulationRig 的关节位置和旋转，更新独立 Clothing Mesh；渲染顺序是 `Character → Body Skin → Clothing Mesh`。它不得修改 Body Skin、身体顶点、SkinWeights、RigDefinition、PoseSnapshot 或 AnimationClip。

CharacterProfile 不内嵌服装材质或网格，只保存附件引用：

```json
{
  "clothing_attachments": [{ "clothing_id": "top_001", "revision": 1 }],
  "clothing_revision": 2
}
```

添加、删除、保存和恢复服装时，ClothingState、Character 附件引用和 OperationEvent 通过 `clothing` ModulePatch 同步。

## 17. Appearance System

Appearance System 使用独立的 HairProfile、AccessoryProfile 和 AppearanceState。Hair 是单选槽位，支持 `short`、`long`、`ponytail`；Accessory 可并存，支持 `hat`、`glasses`、`ornament`。

```json
{
  "character_id": "character_001",
  "version": 2,
  "active_hair_id": "hair_long_001",
  "hair_profiles": {
    "hair_long_001": {
      "hair_id": "hair_long_001",
      "revision": 1,
      "name": "Long Hair",
      "style": "long",
      "rig_profile": {
        "target": "simulationRig",
        "attachment_points": ["head", "headTop", "neck", "upperChest"]
      },
      "material": { "base_color": "#2b211d", "roughness": 0.72, "metalness": 0, "opacity": 1 },
      "transform": { "offset": [0, 0, 0], "rotation": [0, 0, 0, 1], "scale": 1 }
    }
  },
  "accessories": {
    "glasses_001": {
      "accessory_id": "glasses_001",
      "revision": 1,
      "name": "Glasses",
      "type": "glasses",
      "rig_profile": { "target": "simulationRig", "attachment_point": "head" },
      "material": { "base_color": "#8b96a5", "roughness": 0.55, "metalness": 0.15, "opacity": 1 },
      "transform": { "offset": [0, 0, 0], "rotation": [0, 0, 0, 1], "scale": 1 }
    }
  }
}
```

第一阶段只生成 `static-attachments` 描述符和 simulationRig 绑定帧。毛发模拟、布料和 GPU Hair 均明确关闭。CharacterProfile 不内嵌外观网格或材质，只保存当前 `hair`、`accessory_attachments`、`hair_revision` 和 `accessory_revision`。添加发型、切换发型、添加附件、保存或恢复 Appearance 时，AppearanceState 与 Character 引用通过 integration Patch 原子同步。

## 18. Character Generator

Character Generator 使用 `humanoid_rig/character_image_analysis@1.0`、`humanoid_rig/character_generator_session@1.0` 和 `humanoid_rig/character_generator_state@1.0`。入口是 `character.html`，编排链路如下：

```text
图片文件
→ HRL-M03 PoseObservation
→ HRL-M01 ProportionProfile
→ BodyShapeProfile + FaceIdentity + ClothingProfile + PoseSnapshot
→ CharacterProfile 引用
→ CharacterGeneratorSession 版本历史
```

Generator 只负责编排既有模块接口：比例通过 `normalizeBodyProfile`，姿势通过 `retargetPoseObservation`，人物保存通过 CharacterManager。它不复制 Rig、Skin、Pose 或 Character Core 的实现。ProjectState 只保存文件名、MIME、尺寸、字节数和 SHA-256 内容哈希；图片二进制由 `binary_storage: not-in-project-state` 明确排除。重新加载时以会话中已保存的模块输出和 CharacterProfile 恢复相同结果。
