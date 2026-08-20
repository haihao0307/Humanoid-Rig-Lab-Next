# Humanoid Rig Lab Next

Humanoid Rig Lab Next 是一个基于 WebGPU、Three.js 和多窗口共享状态的人物生产线协作平台。项目将骨骼比例、人物蒙皮、动作与物理、动画系统拆分为独立工作台，并通过统一的骨架版本、PoseSnapshot、ProjectState 和综合预览保持一致。

当前项目版本为 `0.5.0`，今日四板块合并构建 ID 为：

```text
four-module-v002-20260819
```

内置三维编辑器为 `V8.5 / 0.8.5`，采用追加式 89 节点全表现骨架；Three.js 锁定为 `0.185.1`。

## 2026 年 8 月 19 日四板块 V002 合并结果

```text
骨骼比例   rig@0.4.0    moduleRevision 3
人物蒙皮   skin@0.5.1   moduleRevision 3
动作物理   pose@0.4.0   moduleRevision 3
动画系统   anim@0.4.0   moduleRevision 4
人物服装   clothing@0.1.0 moduleRevision 1
综合整合   character@0.6.4 / Character Core + BodyShape + Face Identity + Clothing + Appearance + integration revision 2
```

本构建已完成以下纵向链路：

```text
RigDefinition 与关节轴审计
→ 原生预绑定单一 SkinnedMesh
→ 局部四元数 PoseSnapshot
→ 固定骨长 PhysicsRig
→ AnimationSession、MotionClip、分层混合与烘焙
→ V8.5 分层骨架、表皮和综合工作台预览
```

共享层同时加入构建身份核验、PoseSnapshot 直连、旧世界坐标兼容回退，以及不产生 ProjectState revision 的动画临时消息总线。

## Character Core

`packages/character-core/` 是人物系统的最高级数据入口。它保存人物身份、体型、人脸、服装、当前发型与饰品附件引用，以及 Proportion、BodyShape、Skin、Face、Clothing、Hair、Accessory、Pose 和 Animation revision；骨骼、骨长、父子关系和动画轨道仍由原模块独占。ProjectState schema 11 通过 `characterCore`、乐观 revision 和 `OperationEvent` 支持多窗口保存与同步。

## BodyShape 身体形态

`packages/body-shape/` 管理肌肉、脂肪及肩、胸、腰、髋、手臂、腿部体积参数。第一阶段运行时从不可变原始表皮顶点生成区域径向形变，并更新现有 SkinnedMesh 的顶点、法线和包围盒；它不调用 Proportion engine，也不修改 Rig、骨长、父子层级、Pose 或 Animation。保存和恢复 BodyShape 版本后，CharacterProfile 的 `body_shape_revision` 会同步更新。

## Face Identity 人脸系统

`packages/face-system/` 管理年龄、脸型、眼睛、鼻子、嘴部和表情配置的独立身份数据。FaceState 保存草稿与历史版本，Character Core 只通过 `face_identity` 和 `face_revision` 引用已保存版本。当前运行时只生成规范描述符和 FLAME、3DMM、AI Face Reconstruction 适配器接口，不生成复杂模型，也不读取或修改 Skin、Rig、Pose、Animation。

## Clothing System 服装系统

`packages/clothing-system/` 独立管理上衣、裤子和鞋。服装通过 CharacterProfile 的 `clothing_attachments` 引用，不属于 Skin。第一阶段使用独立 Clothing Mesh 和 `static-follow` 运行时读取 simulationRig 关节变换；动作播放时更新服装变换，但不修改 Body Skin、身体顶点、蒙皮权重、Rig、Pose 或 Animation。

## Appearance System 外观系统

`packages/appearance-system/` 管理短发、长发、马尾，以及帽子、眼镜和饰品。CharacterProfile 通过单一 `hair` 槽位和可并存的 `accessory_attachments` 引用外观资源；AppearanceState 提供添加、切换、保存和历史恢复。第一阶段只读取 simulationRig 绑定点并更新独立 Appearance Mesh 变换，明确不包含毛发模拟、布料或 GPU Hair，也不修改 Skin、Clothing、Rig、Pose 或 Animation。

## Character Generator 人物生成入口

`character.html` 与 `apps/character-generator/` 将单张人物图片编排成 Character 数据。图片先由现有 HRL-M03 图片姿势识别生成 33 点 PoseObservation，再分别复用 HRL-M01 比例规范化、BodyShape、Face Identity、Clothing 和 PoseSnapshot 契约，最后由 Character Core 保存引用。第一阶段不宣称生成最终真人，不复制现有模块算法，也不把图片二进制写入 ProjectState；只保存图片哈希、分析元数据、模块输出和版本会话，以支持多窗口同步及重载一致性。

## 四个模块

### 骨骼比例

比例工作台现在使用 `performance89@1`：保留原 28 节点和 SMPL 24 映射，再追加 8 个肢体扭转、12 个制作控制、6 个接触标记、2 个肩胛校正、30 个 VRM 手指和 3 个面部关节。完整说明见 `docs/PERFORMANCE_RIG_ARCHITECTURE.md`。

当前八项比例参数继续直接驱动 V8.5 三维绑定骨架：

```text
人物身高
肩关节中心宽度
髋关节中心宽度
上臂长度
前臂长度
腕到手部控制点长度
大腿长度
小腿长度
```

比例更新从不可变参考绑定重新生成骨架。稳定骨骼 ID、父子层级和隐藏锁骨控制点保持不变。

### 人物蒙皮

默认人体表皮已经切换到预绑定 GLB：

```text
legacy/v8/assets/smpl/smpl-male-surface-skinned.glb
```

资产包含原生 `JOINTS_0`、`WEIGHTS_0`、24 组逆绑定矩阵和单一 Three.js `SkinnedMesh`。场景级单表皮守卫会持续检查历史静态人体、程序化人体和重复 SkinnedMesh，人物拾取直接使用同一张精细网格。

当前绑定属于过渡性权重，元数据标记为 `productionReady: false`。生产发布仍需获得许可明确的专业权重、肩髋修正和姿势修正形变。

### 动作与物理

动作模块继续保持固定骨长、刚性骨盆、人体关节范围、双脚固定、地面碰撞、阻尼和全身联动。V002 新增单张图片复刻动作闭环：

```text
图片输入
→ MediaPipe Pose Landmarker 33 点观测
→ 镜像与深度处理
→ 目标骨架映射
→ PhysicsRig 全身求解
→ PoseCandidate
→ PoseSnapshot
→ 三维人物预览与动作库
```

标准姿势协议为：

```text
humanoid_rig/pose_snapshot@1.0
```

三维视口优先读取稳定关节 ID 对应的局部四元数、根节点变换、IK 目标、固定点和约束。旧 V8 世界坐标载荷继续作为兼容回退。

### 动画系统

动画模块已经从关键帧草案扩展为可运行的纵向闭环，包含：

```text
局部四元数轨道
AnimationSession 0.4
AnimationClip 0.4
MotionClip 1.0
AnimationGraph
基础层、上半身层与加法层
循环、反向播放、事件和接触区间
根运动与原地动作
脚底锁定与腿部 IK
跨比例重定向
关键帧编辑、镜像和压缩
finalPose 与 desiredPose 烘焙
标准 glTF 2.0 骨架动画 GLB 导出
```

内置六个可复用动作和一个自定义草案：待机呼吸、右手挥手、点头、下蹲、原地行走、向前行走和自定义编辑片段。

## 页面结构

```text
index.html
项目总控、版本、模块状态、活动记录和审查入口

character.html
图片上传、HRL-M01/HRL-M03 分析、Character 生成、版本保存与重载

face.html
Face Identity 参数、版本历史、Character 引用与未来后端接口

studio.html?module=proportion
三维骨骼比例与骨架系统审计

studio.html?module=skin
预绑定人物蒙皮、材质、单表皮诊断与重载

studio.html?module=pose
动作物理、图片复刻动作、PoseSnapshot 与动作库

studio.html?module=animation
动画片段、时间轴、分层混合、状态机、重定向、烘焙和导出

studio.html?module=clothing
Character 服装附件、上衣/裤子/鞋添加删除、simulationRig 跟随与版本恢复

studio.html?module=integration
当前 Rig、Skin、Pose 和 Animation 组合验收

legacy/v8/index.html
V8.5 89 节点分层骨架、单一 SkinnedMesh 和人体物理编辑器
```

## 本地启动

完整解压后双击：

```text
start.bat
```

备用入口：

```text
START_HERE.cmd
```

启动器要求 Node.js 18 或更高版本。缺少本地 Three.js 时会尝试安装锁定版本 `0.185.1`。浏览器通常打开：

```text
http://127.0.0.1:4173/
```

启动器会读取 `BUILD_MANIFEST.json`。端口上已有服务器时，只有构建 ID 与当前包一致才会复用；历史构建占用端口时会继续寻找可用端口。命令窗口需要保持开启。

请通过 HTTP 地址运行页面。直接双击 HTML 会受到 ES Modules、SharedWorker、GLB 和 WebGPU 的本地文件限制。

## 多窗口共享

同步优先级：

```text
SharedWorker
BroadcastChannel
localStorage storage event
```

正式模块修改通过 `ModulePatch` 进入 ProjectState，并增加模块 revision。动画播放锚点、时间轴拖动预览等高频临时消息使用：

```text
humanoid_rig/transient_bus@1.0
```

临时消息不会写入项目历史，也不会增加 ProjectState revision。各窗口独立保存摄像机和 GPU 资源。

## 项目数据版本

```text
母平台 buildVersion      0.5.0
构建 ID                  four-module-v002-20260819
ProjectState schema      9
绑定骨架导出 schema      7
PoseSnapshot             humanoid_rig/pose_snapshot@1.0
内置编辑器               V8.5 / 0.8.5
Three.js                 0.185.1
```

完整构建身份与资产摘要见：

```text
BUILD_MANIFEST.json
BUILD_MANIFEST.txt
```

## 测试

运行：

```text
npm test
```

当前测试覆盖：

```text
ProjectState schema 11、旧项目迁移、原四模块、Clothing、Appearance 与 Character Generator 版本升级
模块 Patch 并行合并与过期 Patch 拒绝
比例参数、关节角色、绑定轴、隐藏锁骨和升级蓝图
原生预绑定 GLB、JOINTS_0、WEIGHTS_0 和逆绑定矩阵
场景级单表皮守卫、直接拾取和绑定姿势保护
图片关键点、重定向、固定骨长和 PoseSnapshot
局部四元数姿势应用到 PhysicsRig
动画轨道、关键帧、事件、接触、层、状态机和重定向
动画运行时、性能、烘焙、MotionClip 和 GLB 导出
构建身份、启动器、共享临时消息和本地 HTTP 资源
Face Identity 创建、参数编辑、保存、加载、恢复、Character 引用与模块隔离
Clothing 添加、删除、保存、恢复、simulationRig 动作跟随与 Body Skin 隔离
Hair 添加与短发/长发/马尾切换、Accessory 添加、Appearance 保存恢复与 simulationRig 静态绑定
图片分析生成 Proportion、BodyShape、Face、Clothing、Pose 与 Character，保存后序列化重载一致
```

完整结果见 `VALIDATION.md` 和 `docs/FOUR_MODULE_V002_MERGE_REPORT_2026-08-19.md`。

## 当前生产边界

1. 过渡性蒙皮权重已经验证原生 SkinnedMesh 管线，专业发布仍需许可明确的权重与姿势修正形变。
2. MediaPipe 运行库和 Pose Landmarker 模型在首次图片分析时按需下载，发布前需要完成来源、再分发条款、隐私披露和离线策略审查。
3. 动画系统已经生成 `simulationRig` 交接帧，全身物理模式仍需动作模块开放外部求解器接口。
4. 当前能够导出标准骨架动画 GLB，最终 SkinnedMesh 与动画合并导出仍需蒙皮运行时和动画导出器联合验证。
5. 新增的扭转、手指、眼睛、下颌和肩胛节点已进入骨架、姿势、动画和导出拓扑；当前 SMPL 表皮仍绑定原 24 骨，精细表面形变需要后续重新绑定权重。
6. 自动测试与本地 HTTP 冒烟检查已经通过。Windows Chrome 或 Edge 的 WebGPU 画面、鼠标交互、肩髋变形和多窗口长时间运行仍属于发布前人工验收项。

## 四对话协作与交接记录

模块源码边界和合并顺序见：

```text
docs/FOUR_MODULE_COLLABORATION.md
control/module-scopes/
control/handoffs/2026-08-19/
```

四个执行包的原始交接说明、修改清单和测试结果均已归档，便于后续追溯和回滚。

## 许可

平台代码采用 MIT License。Three.js、参考人体表面、过渡性绑定资产、MediaPipe 运行库和远程模型保留各自许可与来源要求。详见：

```text
THIRD_PARTY_NOTICES.md
legacy/v8/THIRD_PARTY_NOTICES.md
legacy/v8/assets/smpl/ATTRIBUTION.md
legacy/v8/assets/smpl/SKIN_BINDING_METADATA.json
```
