# Humanoid Rig Lab Next 四板块 V002 合并报告

合并日期：2026 年 8 月 19 日  
母项目版本：`0.5.0`  
合并构建 ID：`four-module-v002-20260819`  
内置编辑器：`V8.4 / 0.8.4`

## 1. 合并目标

本次工作将骨骼比例、人物蒙皮、动作与物理、动画系统四个独立执行对话在 2026 年 8 月 19 日交付的 V002 内容合入同一母项目，并补齐只有总控母体可以修改的共享状态、三维视口桥接、构建身份和跨模块测试。

合并继续遵守四板块所有权规则。执行包只修改各自允许范围，共享核心由母项目统一调整。正式依赖顺序为：

```text
骨骼比例
→ 人物蒙皮
→ 动作与物理
→ 动画系统
→ 共享整合与综合回归
```

## 2. 输入基线与来源校验

```text
母项目
文件：Humanoid-Rig-Lab-Next-v0.5.0-3d-modular (1)(1).zip
SHA 256：95c7bd935b4491e7695c1d47c4db710abf37207a5b550af15404ebf23b9ebbb8

骨骼比例 V002
文件：Humanoid-Rig-Lab-Next-proportion-v002-preview(1).zip
SHA 256：59d975dccae208ea7cdd7ae4610ee626e6ffd521bbec48ba91995ac89ba2a08b

人物蒙皮 V002
文件：skin-workspace-v0.5.0-skin-v002(1).zip
SHA 256：ff09bceeed2a90b0ddd9c2e63f27278ea8630fe32f839a0d1724e65c7f888f63

动作与物理 V002
文件：pose-workspace-v0.5.0-pose-v002(1).zip
SHA 256：12a4a813e07a53b8d0d9067388fc081e944c7db86e7f2d57e3603672e16f5c0f

动画系统 V002 Complete
文件：animation-workspace-v0.5.0-anim-v002-complete(1).zip
SHA 256：2d9e659e5ef86e644d69257ed91d0e6184abc570cef278accc5beb066e3d1953
```

四个执行包均已解压、审阅 `MODULE_SCOPE.json`、核对交接记录，并按模块拥有目录提取真实修改。工作包中的只读共享文件副本没有直接覆盖母项目。

## 3. 合并后的版本矩阵

| 层级 | 活动版本 | moduleRevision | 状态 |
| --- | --- | ---: | --- |
| Rig | `rig@0.4.0` | 3 | V002 角色与绑定轴审计完成，准备后续追加式升级评审 |
| Skin | `skin@0.5.1` | 3 | 原生预绑定单一 SkinnedMesh 已接入，等待桌面实机和专业权重复核 |
| Pose | `pose@0.4.0` | 3 | 图片姿势与 PoseSnapshot 闭环完成，等待模型发布审查和视觉校准 |
| Animation | `anim@0.4.0` | 4 | 动画纵向闭环完成，等待外部 simulationRig 和最终人物动画 GLB 联调 |
| Character | `character@0.5.0` | 2 | 四模块共享整合完成 |

ProjectState 继续使用 schema 5，Rig 导出继续使用 schema 6，Three.js 锁定为 0.185.1。

## 4. 骨骼比例 V002

合入内容：

1. 新增 `src/modules/proportion/rig-system.js`。
2. 对 28 个编辑器节点建立明确的角色分类，包括变形关节、隐藏控制点、测量标记和全身控制节点。
3. 为 28 个节点建立完整绑定轴契约，并验证比例重建后能够保持一致。
4. 增加当前骨架审计和升级清单导出。
5. 冻结 `rig@0.5.0` 身体生产版的追加节点蓝图，包括前臂、上臂、大腿和小腿扭转节点、IK 控制器、Pole 控制器、脚滚控制器、接触标记和可选肩胛修正。
6. 冻结 `rig@0.6.0` 完整表现版的手指、眼睛和下颌追加蓝图。
7. 保持现有稳定骨骼 ID、父子层级、绑定骨长和 SMPL 24 顺序不变。

自动测试覆盖 256 个边界比例、64 个确定性混合比例、零参考绑定漂移、节点角色和绑定轴重建。

## 5. 人物蒙皮 V002

合入内容：

1. 新增预绑定资产 `legacy/v8/assets/smpl/smpl-male-surface-skinned.glb`。
2. 资产包含 27,578 个顶点、55,152 个三角形、一个 Mesh、一个 Skin、24 个蒙皮关节、原生 `JOINTS_0`、`WEIGHTS_0` 和 24 组逆绑定矩阵。
3. 默认运行时切换为 Three.js 原生单一 `SkinnedMesh`。
4. 同一网格承担渲染、蒙皮变形和三角面拾取。
5. 增加全场景表皮所有权、持续审计和重复人体表面清理。
6. 增加 V002 专用验证页和独立启动入口。
7. 增加 `SKIN_BINDING_METADATA.json`、资产归属说明、构建标识和哈希核验。

预绑定资产 SHA 256：

```text
736cb39c828203eae72f5e5d094f1623c0a4465a31b484737a6e8df02a7ec899
```

当前权重属于过渡性实现，元数据声明 `productionReady: false`。T 姿势回归记录的最大边伸长为 5.006 倍，最大肩部边伸长为 1.673 倍。该结果证明原生蒙皮管线与回归守卫能够运行，专业变形质量仍需后续资产工作。

## 6. 动作与物理 V002

合入内容：

1. 新增图片姿势估计、重定向、控制器和图片存储模块。
2. 首次分析时按需加载 `@mediapipe/tasks-vision@1.0.1` 和 Pose Landmarker Full float16 模型。
3. 支持单张人物图片、33 点观测、可见性、置信度、镜像、深度翻转、深度强度、脚底接触和根位置选项。
4. 将图片观测映射到稳定关节 ID，并通过当前 PhysicsRig 执行固定骨长、刚性骨盆、关节范围和地面约束。
5. 输出 `humanoid_rig/pose_snapshot@1.0`、IK 目标、固定点、接触、质量报告和旧 V8 世界坐标兼容载荷。
6. 图片动作可以应用、保存到浏览器动作库、重新重定向、导出 JSON 和删除。
7. 原图 Blob 存入 IndexedDB，普通项目 JSON 只保存结构化观测和资源标识。

动作模块没有修改绑定局部位置、父子层级、固定骨长、比例、逆绑定矩阵或蒙皮权重。

## 7. 动画系统 V002 Complete

合入内容：

1. 新增动画模型、四元数工具、运行时、状态图、烘焙器、GLB 导出器和预设模块。
2. 建立 `animationRig`、`desiredPose`、`finalPose` 和 `simulationRig` 交接帧。
3. 实现 28 关节局部四元数前向运动学。
4. 实现精确动画、物理跟随和全身物理交接三种模式。
5. 实现基础层、上半身覆盖层、呼吸加法层、骨链遮罩、层权重和交叉淡化。
6. 实现 AnimationGraph 的状态、参数、触发器、条件和过渡。
7. 实现循环、往返循环、反向速度、事件、接触区间、根运动和原地动作。
8. 实现脚底锁定、骨盆可达域修正、腿部双段 IK 和误差诊断。
9. 实现同拓扑跨比例重定向和根运动身高缩放。
10. 实现关键帧创建、更新、移动、复制、删除、区间缩放、镜像和压缩。
11. 实现 PoseSnapshot 捕获、引用、哈希、去重、迁移和插值。
12. 实现 `desiredPose` 与 `finalPose` 固定采样率烘焙。
13. 实现 MotionClip JSON 往返和标准 glTF 2.0 骨架动画 GLB 导出。

内置动作资产：

```text
idle-breathe
wave-right
head-nod
squat
walk-in-place
walk-forward
custom draft
```

## 8. 母项目共享整合

四个执行包遵守共享核心只读约束，因此以下工作由母项目完成。

### 8.1 状态与版本迁移

`src/default-state.js` 和 `src/state-schema.js` 已更新为今日活动版本和最低模块 revision。旧 schema 1 至 4 项目会迁移到 schema 5，并补齐新蒙皮字段、标准 PoseSnapshot、图片动作字段、动画会话和构建身份。

### 8.2 PoseSnapshot 直连

母平台和 V8.4 现在优先交换局部四元数 PoseSnapshot。V8.4 使用 `PhysicsRig.applyPoseSnapshot()` 重建姿势，固定骨长和绑定签名保持不变。旧世界坐标载荷继续作为兼容回退。

动画工作台生成的 `finalPose` 会转换为相同 PoseSnapshot 协议，因此动作、图片姿势和动画现在能够使用同一份三维姿势入口。

### 8.3 临时动画消息

`src/project-hub.js` 和 `workers/project-hub.shared.js` 新增：

```text
humanoid_rig/transient_bus@1.0
```

动画播放锚点和时间轴拖动预览通过临时通道广播，不写入 ProjectState，不增加 revision，也不进入撤销历史。

### 8.4 构建身份与启动器

新增机器可读 `BUILD_MANIFEST.json`。`launcher.ps1` 在复用 4173 或其他端口前会请求清单并核对构建 ID。端口属于历史目录时会继续寻找新端口。

### 8.5 边界与交接归档

四个模块的 `MODULE_SCOPE.json` 已复制到：

```text
control/module-scopes/
```

原始交接说明、修改清单和测试记录已复制到：

```text
control/handoffs/2026-08-19/
```

## 9. 自动测试与冒烟检查

完整命令：

```text
npm test
```

结果：全部通过，失败数 0。

主要结果：

```text
53 个必需文件检查通过
ProjectState schema、旧项目迁移和四模块版本升级通过
四模块并行 Patch 合并通过
原生预绑定 GLB、哈希、权重和逆绑定矩阵通过
场景级单表皮守卫通过
图片姿势、固定骨长、PoseSnapshot 和动作库通过
局部四元数 PoseSnapshot 到 PhysicsRig 联合测试通过
七套动画专项测试通过
20,000 次片段采样的单次平均耗时约 0.02 ms
1,000 个完整动画运行时帧的单帧平均耗时约 3 ms
V8.4 比例、物理、蒙皮和静态集成测试通过
```

本地 HTTP 冒烟检查覆盖首页、四模块工作台、V8.4 嵌入页、预绑定 GLB、绑定元数据、动画会话、图片姿势代码、动画运行时代码和蒙皮验证页，全部返回 HTTP 200。

## 10. 未完成的生产验收

1. Windows Chrome 或 Edge 的 WebGPU 可见画面和真实鼠标交互尚未在当前自动化环境中完成。
2. 需要实机确认场景始终只有一层人体表面，并重点检查肩、腋下、髋、膝和腕部变形。
3. 过渡性权重需要替换为许可明确的专业权重，并补充姿势修正形变。
4. MediaPipe 运行库和模型的来源、再分发条款、隐私披露、缓存与离线策略需要发布审查。
5. 单张图片的前后深度存在天然歧义，镜像、骨链深度翻转和三维人工校准仍需保留。
6. 动画全身物理模式需要动作模块提供外部 `simulationRig` 求解器接口。
7. 标准骨架动画 GLB 已经可导出，最终人物 SkinnedMesh 与动画合并 GLB 仍需联合导出测试。
8. 四窗口刷新恢复、后台降频、十分钟连续运行、内存与 GPU 占用仍需桌面浏览器验证。

## 11. 合并结论

四个 V002 模块已经在一份可运行母项目中完成代码合并、共享协议连接、状态迁移、构建身份保护、全套自动测试和本地 HTTP 资源检查。当前构建可以作为下一轮桌面视觉验收、专业蒙皮迭代、图片姿势校准、外部物理解算和最终人物动画 GLB 联调的统一基线。
