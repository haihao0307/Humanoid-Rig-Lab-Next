# 动画系统 v002 交接记录

## 1. 基本信息

```text
模块：animation
工作包基线：Humanoid Rig Lab Next 0.5.0
模块版本：anim@0.4.0
兼容骨架：rig@0.4.0
来源姿势版本：pose@0.3.1 及带局部四元数的 PoseSnapshot
AnimationSession：humanoid_rig/animation_session@0.4
AnimationClip：humanoid_rig/animation_clip@0.4
MotionClip：humanoid_rig/motion_clip@1.0
AnimationGraph：humanoid_rig/animation_graph@0.1
建议分支：work/animation
补丁编号：animation-patch-v002
完成时间：2026-08-19T09:15:30Z
模块进度：82%
```

## 2. 修改边界

本轮严格遵守 `MODULE_SCOPE.json`。

动画模块只修改下列授权范围：

```text
src/modules/animation/**
assets/animations/**
tests/animation*.mjs
control/active-tasks/animation.md
control/module-status/animation.json
```

以下共享内容保持只读：

```text
绑定骨骼 ID
父子层级
绑定局部位置
绑定骨长
BodyProfile 与比例参数
蒙皮索引与权重
inverseBindMatrices
表皮网格与材质
ProjectHub 与 SharedWorker 核心
动作物理求解器
V8 主入口与 Three.js 视口核心
package.json
```

根目录 `HANDOFF.md`、`changed-files.txt` 和 `test-results.txt` 只作为交付记录更新，不参与产品运行时。

## 3. 本轮目标与完成状态

本轮将 v001 的时间轴与协议基础扩展为可运行、可混合、可重定向、可烘焙和可导出的动画纵向闭环。

已经完成：

1. 双姿势运行时结构，包含隐藏目标姿势 `animationRig`、`desiredPose`、约束后 `finalPose` 和 `simulationRig` 交接帧。
2. 28 关节局部四元数前向运动学，按照当前 BodyProfile 重建世界姿势。
3. 精确动画、物理跟随和全身物理交接三种模式。
4. 基础层、上半身覆盖层、呼吸加法层、骨链遮罩、层权重和交叉过渡。
5. AnimationGraph 状态、参数、触发器、条件和过渡。
6. 根运动、原地动作、循环区间、反向速度、逐帧步进和播放锚点数据。
7. 动作事件、循环事件、往返循环事件和反向播放事件检测。
8. 脚底接触区间、支撑脚锁定、骨盆可达域修正、腿部双段 IK 和接触误差诊断。
9. 同拓扑跨比例重定向、根运动身高缩放、兼容检查和警告。
10. 关键帧创建、更新、移动、复制、删除、区间缩放、镜像和压缩。
11. PoseSnapshot 局部四元数捕获、引用、内容哈希、去重、迁移和插值。
12. `desiredPose` 与 `finalPose` 固定采样率烘焙。
13. MotionClip JSON 导入导出。
14. 标准 glTF 2.0 骨架动画 GLB 导出。
15. 六个可复用动作资产和一个自定义编辑草案。
16. 动画工作台三维预览与全部主要运行控制。
17. 三种人物比例的跨比例纵向验证。
18. 动画专项测试、性能测试、全项目回归和本地 HTTP 资源检查。

## 4. 动画运行链路

每帧执行顺序如下：

```text
活动片段采样
动画层采样与混合
状态过渡与交叉淡化
用户覆盖层
关节活动范围限制
脚底接触与支撑脚锁定
固定骨长前向运动学
物理跟随或全身物理交接
生成 finalPose
生成 28 关节 V8 PoseSnapshot 预览负载
骨架与表皮宿主读取最终姿势
```

动画轨道允许：

```text
稳定关节 ID 的局部四元数旋转
根节点位置
根节点旋转
动作事件
脚底和手部接触区间
动画层权重与骨链遮罩
```

动画轨道拒绝：

```text
非根关节位置关键帧
骨骼缩放关键帧
绑定局部位置修改
父子层级修改
绑定骨长修改
inverseBindMatrices 修改
```

## 5. 数据协议

### 5.1 AnimationSession 0.4

主要字段：

```text
schema
activeClipId
clips[]
transport
layers[]
graph
runtime
retarget
bake
poseSnapshotStore
metadata
```

`transport` 保存播放状态、原始时间、速度、循环区间、锚点时间、锚点签发时间和同步组。正常播放采样不需要生成逐帧项目 revision。

### 5.2 AnimationClip 0.4

主要字段：

```text
clipId
name
clipRevision
compatibleRig
sourceProportionRevision
duration
sampleRateHint
loopMode
rootMotionMode
rootJointId
tracks[]
poseKeys[]
poseSnapshots[]
events[]
contacts[]
retargetPolicy
quality
metadata
```

### 5.3 AnimationPose 与 RuntimeFrame

运行时姿势使用：

```text
humanoid_rig/animation_pose@0.2
humanoid_rig/animation_runtime_frame@0.2
```

运行帧同时保留：

```text
animationRig
simulationRig
desiredPose
finalPose
fk
v8Payload
events
contacts
diagnostics
```

### 5.4 PoseSnapshot 引用

局部姿势快照保存根节点变换和稳定关节 ID 对应的局部四元数。旧 V8 世界坐标 PoseSnapshot 仍可读取，并可通过当前绑定骨架推导局部旋转。引用记录包含兼容骨架、来源姿势版本、内容哈希、关节集合和捕获时间。

## 6. 基础动作资产

工作包包含以下可复用 MotionClip：

1. `idle-breathe.motion.json`，3.2 秒待机呼吸，加法循环。
2. `wave-right.motion.json`，1.6 秒右手挥手，上半身覆盖动作。
3. `head-nod.motion.json`，1.8 秒点头动作。
4. `squat.motion.json`，2.5 秒下蹲与起身，包含双脚接触区间。
5. `walk-in-place.motion.json`，1.2 秒原地行走循环，包含脚步事件和接触区间。
6. `walk-forward.motion.json`，1.2 秒向前行走循环，包含根运动、脚步事件和接触区间。

`basic-animation-session.json` 额外包含 `custom` 草案片段，因此编辑会话共有七个片段。

## 7. 动画层和状态机

默认动画层：

1. `base`，基础站立、行走、下蹲和根运动。
2. `upper-body`，上半身挥手覆盖层。
3. `breathing-additive`，呼吸加法层。

默认状态机：

```text
idle
walk
wave
squat
```

状态机支持布尔触发器、数值参数、条件判断、触发器消费、过渡起止时间和交叉淡化。

已经验证的组合包括：

1. 原地行走叠加右手挥手。
2. 原地行走叠加呼吸。
3. 行走、站立、挥手和下蹲状态切换。
4. 精确动画与物理跟随切换。
5. 全身物理交接时保留上一帧 simulationRig 姿势。

## 8. 跨比例适配

同一动作已经在以下三种 BodyProfile 上测试：

1. 标准比例，身高约 1.796 米。
2. 短臂长腿比例，身高 1.72 米。
3. 长臂短腿比例，身高 1.90 米。

验证结果：

1. 三种比例均生成完整 28 关节姿势。
2. 局部四元数保持复用，世界空间手脚轨迹按照目标骨长变化。
3. 所有测试帧的最大骨长误差小于 `1e-9` 米。
4. 下蹲、原地行走和向前行走的最大脚底接触误差小于 `0.02` 米。
5. 根运动按照目标人物身高缩放。
6. 原地动作不累计根节点世界位移。
7. 未知关节、骨架版本不匹配和无法满足的比例会进入兼容诊断和警告。

当前重定向适用于稳定关节 ID、相同父子拓扑和相同局部轴规范的骨架。局部轴不同或拓扑不同的第三方骨架仍需要显式 RetargetMap。

## 9. 烘焙和导出

### 9.1 动作烘焙

烘焙器支持：

1. 烘焙 `desiredPose`。
2. 烘焙约束后的 `finalPose`。
3. 24、30 或其他指定采样率。
4. 根运动保留。
5. 事件与接触区间保留。
6. 四元数符号连续性。
7. 旋转和位置误差阈值压缩。
8. 最大骨长误差、最大接触误差和最大关节角速度报告。

### 9.2 GLB 导出

当前导出器生成标准 glTF 2.0 二进制 GLB，包含：

1. 28 个骨架节点和父子层级。
2. 绑定局部平移。
3. 根节点位置轨道。
4. 局部四元数旋转轨道。
5. 动画采样器、通道和二进制访问器。
6. 动作 ID、根运动模式、兼容骨架和事件摘要。

当前 GLB 的 `mesh_included` 为 `false`。带最终 SkinnedMesh 的 GLB 需要蒙皮模块提供网格、skinIndex、skinWeight 和 inverseBindMatrices，并由总控导出器进行合并。

## 10. 三种运行模式

### 10.1 精确动画

`desiredPose` 直接进入关节限制、接触约束和固定骨长计算，适合关键帧制作、动作检查和标准导出。

### 10.2 物理跟随

`simulationRig` 使用刚度和阻尼追踪 `desiredPose`，产生可控迟滞。当前动画模块完成目标混合与跟随数学，外部碰撞和完整动力学仍由动作物理模块负责。

### 10.3 全身物理交接

动画目标权重降到零，运行帧保留交接标记和上一帧姿势。动作物理模块接收后负责布娃娃、碰撞、失衡和恢复。

## 11. 修改文件

### 11.1 动画运行源码

```text
src/modules/animation/index.js
src/modules/animation/model.js
src/modules/animation/quaternion.js
src/modules/animation/presets.js
src/modules/animation/runtime.js
src/modules/animation/graph.js
src/modules/animation/bake.js
src/modules/animation/glb.js
```

### 11.2 动作资产

```text
assets/animations/README.md
assets/animations/basic-animation-session.json
assets/animations/idle-breathe.motion.json
assets/animations/wave-right.motion.json
assets/animations/head-nod.motion.json
assets/animations/squat.motion.json
assets/animations/walk-in-place.motion.json
assets/animations/walk-forward.motion.json
```

### 11.3 动画专项测试

```text
tests/animation-assets.mjs
tests/animation-bake.mjs
tests/animation-editing.mjs
tests/animation-model.mjs
tests/animation-performance.mjs
tests/animation-runtime.mjs
tests/animation-workspace.mjs
```

### 11.4 模块状态

```text
control/active-tasks/animation.md
control/module-status/animation.json
```

## 12. 测试结果

### 12.1 修改前基线

在原始 `animation-workspace-v0.5.0-anim-v001-complete` 上运行 `npm test`，全部通过。

### 12.2 语法检查

以下八个动画脚本全部通过 `node --check`：

```text
bake.js
glb.js
graph.js
index.js
model.js
presets.js
quaternion.js
runtime.js
```

### 12.3 动画专项测试

以下七套专项测试全部通过：

```text
node tests/animation-assets.mjs
node tests/animation-bake.mjs
node tests/animation-editing.mjs
node tests/animation-model.mjs
node tests/animation-performance.mjs
node tests/animation-runtime.mjs
node tests/animation-workspace.mjs
```

专项测试共包含 221 项 Node 断言，失败数为 0。

覆盖内容：

1. 动作资产结构和文档。
2. 局部四元数、插值、循环和反向播放。
3. 关键帧编辑、镜像、压缩和时间缩放。
4. PoseSnapshot 引用与局部姿势往返转换。
5. 动画层、状态机和交叉过渡。
6. 根运动、脚底接触和事件。
7. 三种目标比例的重定向。
8. 固定骨长和接触误差。
9. 三种运行模式。
10. `desiredPose` 与 `finalPose` 烘焙。
11. MotionClip JSON 往返。
12. glTF 2.0 骨架动画 GLB 结构。
13. 动画工作台控件和三维宿主桥。
14. 模块边界和发布协议。

### 12.4 性能测试

最终复现结果：

```text
20000 次动作轨道采样：389.20 ms
单次动作轨道采样平均：0.0195 ms
1000 次完整动画运行帧：2973.79 ms
单个完整运行帧平均：2.9738 ms
```

完整运行帧包含片段采样、动画层、关节限制、脚底接触、前向运动学、物理跟随数学、事件和诊断。当前工作区与全新 v001 基线重放的平均值分别为 2.9738 毫秒和 2.9746 毫秒。该测试未包含 Three.js 绘制、SkinnedMesh 更新、外部碰撞求解和多窗口消息。

### 12.5 全项目回归

最终 `npm test` 全部通过，包含：

1. Humanoid Rig Lab Next 0.5.0 文件和 schema 验证。
2. 模块级 Patch 合并。
3. 比例三维视口与 BodyProfile 桥。
4. 隐藏锁骨控制点与肩关节语义。
5. 现有 SMPL GLB 校验。
6. V8.4 骨架映射、固定尺寸、关节范围和动作物理测试。
7. 双四元数表皮变形和单一精细表面集成测试。
8. 启动器和静态集成检查。

### 12.6 本地资源检查

本地服务器返回 HTTP 200：

```text
/
/studio.html
/studio.html?module=animation
/src/modules/animation/index.js
/src/modules/animation/model.js
/src/modules/animation/quaternion.js
/src/modules/animation/presets.js
/src/modules/animation/runtime.js
/src/modules/animation/graph.js
/src/modules/animation/bake.js
/src/modules/animation/glb.js
/assets/animations/basic-animation-session.json
/assets/animations/idle-breathe.motion.json
/assets/animations/wave-right.motion.json
/assets/animations/head-nod.motion.json
/assets/animations/squat.motion.json
/assets/animations/walk-in-place.motion.json
/assets/animations/walk-forward.motion.json
```

完整原始输出见 `test-results.txt`。

### 12.7 全新 v001 基线补丁重放

将补丁候选覆盖到一份全新解压的 `animation-workspace-v0.5.0-anim-v001-complete` 后，七套动画专项测试、完整 `npm test` 和只读共享文件哈希审计再次通过。

重放性能记录：

```text
20000 次动作轨道采样：377.83 ms
单次动作轨道采样平均：0.0189 ms
1000 次完整动画运行帧：2974.60 ms
单个完整运行帧平均：2.9746 ms
```

补丁中的 25 个产品文件与开发工作区逐字节一致。根目录三份交付记录随后更新为最终版本，不影响产品代码与测试结果。

## 13. 兼容性

```text
项目基线：0.5.0
动画模块：anim@0.4.0
骨架版本：rig@0.4.0
共享 schemaVersion：5
SMPL 映射：SMPL 24
编辑控制节点：28
来源姿势：pose@0.3.1 的 V8 世界坐标负载，以及局部四元数 PoseSnapshot
MotionClip：humanoid_rig/motion_clip@1.0
```

动作会记录 `compatibleRig`、`sourceProportionRevision` 和重定向策略。当前 BodyProfile 的 `draftRevision` 用作目标比例版本引用。

## 14. 已知阻塞问题

### 14.1 多窗口临时播放消息

ProjectHub 当前只提供会产生正式项目 revision 的事务接口。播放锚点、时间轴拖动预览、30 Hz 临时姿势和轨道租约需要共享核心增加临时消息入口。共享核心在本工作包中只读。

### 14.2 外部 simulationRig 求解器

动画模块已经输出 `desiredPose`、物理跟随目标、全身物理交接标记和 `finalPose` 初步结果。完整碰撞、布娃娃、固定点冲突和恢复站立需要动作物理模块开放统一求解器接口。

### 14.3 最终 SkinnedMesh GLB

骨架动画 GLB 已经可以独立导出和解析。最终人物 GLB 还需要蒙皮模块的 SkinnedMesh、蒙皮权重和 inverseBindMatrices。相关文件在本工作包中只读。

### 14.4 第三方动作导入

当前完成 MotionClip JSON 和项目骨架 GLB 动画输出。BVH、FBX、外部 GLB 和不同局部轴骨架的自动 RetargetMap 尚未接入。

### 14.5 浏览器视觉验收

代码、数据、HTTP 和 Node 测试已经完成。当前容器中的 Chromium 在页面级 DOM 与截图命令中超时，并持续报告 D-Bus 与进程结束错误，因此没有形成可信的像素级验收记录。集成后需要在普通 Chrome 或 Edge 中检查连续播放、摄像机交互、表皮一致性、脚底视觉滑动和长时间运行。

### 14.6 全身物理恢复

全身物理交接已经存在，自动寻找可站立恢复姿势和恢复过渡动作仍需动作物理模块与状态机共同实现。

## 15. 总控集成需求

1. 为 SharedWorker 和 BroadcastChannel 增加 `motion.transport.anchor`、`motion.scrub.preview` 和轨道租约临时消息。
2. 临时播放消息不得生成正式项目 revision。
3. 动画结构编辑继续使用 `character.animation`、`activeVersions.animation` 和 `modules.animation` 的模块级 Patch。
4. 将共享默认动画版本升级到 `anim@0.4.0`，并增加 AnimationSession 0.3 到 0.4 的迁移测试。
5. 动作物理模块提供 `solveAnimationTarget(desiredPose, previousFinalPose, settings, deltaTime)` 或等价接口。
6. 表皮和碰撞体统一读取动作物理模块确认后的 `finalPose`。
7. 蒙皮导出器接收本补丁的骨架动画通道，并与 SkinnedMesh 合并生成最终 GLB。
8. 多窗口撤销、重做和租约继续由权威状态中心管理。

## 16. 建议集成顺序

1. 在集成分支应用 `animation-patch-v002.zip`。
2. 运行七套动画专项测试。
3. 运行 `npm test`。
4. 打开动画工作台，依次播放待机呼吸、挥手、点头、下蹲、原地行走和向前行走。
5. 切换精确动画、物理跟随和全身物理交接模式。
6. 开启行走基础层、上半身挥手层和呼吸加法层，检查组合姿势。
7. 切换标准、短臂长腿和长臂短腿 BodyProfile，检查同一动作的世界轨迹。
8. 烘焙 `finalPose` 并导出 MotionClip JSON。
9. 导出骨架动画 GLB，在独立 glTF 查看器或 Three.js 页面中播放。
10. 接入共享播放锚点、动作物理求解器和 SkinnedMesh 导出后执行四窗口集成验收。

## 17. 回滚方法

1. 使用补丁前的 `animation-workspace-v0.5.0-anim-v001-complete` 恢复动画模块目录。
2. 删除本轮新增的 `bake.js`、`glb.js`、`graph.js`、`presets.js` 和 `runtime.js`。
3. 恢复 `index.js`、`model.js` 和 `quaternion.js`。
4. 恢复或删除本轮动作资产。
5. 恢复或删除本轮动画专项测试。
6. 恢复动画模块状态文件。
7. 运行 `npm test`，确认返回 v001 基线。

## 18. 结论

`anim@0.4.0` 已经具备第一版动画系统主体能力。时间轴、局部四元数轨道、关键帧编辑、循环、事件、接触、动画层、状态机、跨比例重定向、三种运行模式、烘焙和标准骨架动画 GLB 已形成同一条可测试链路。

剩余工作集中在三个跨模块接口：多窗口临时播放消息、外部 simulationRig 物理求解器、带最终 SkinnedMesh 的 GLB 合并导出。上述接口需要总控、动作物理和蒙皮板块共同完成。
