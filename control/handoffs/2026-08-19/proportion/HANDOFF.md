# 骨骼比例模块交接记录 v002

## 基本信息

```text
模块：骨骼比例 proportion
增量补丁：proportion-patch-v002
工作基础：Humanoid Rig Lab Next 0.5.0 + proportion-patch-v001
当前活动 Rig：rig@0.4.0
当前骨架配置：SMPL 24 + 4 编辑辅助节点，共 28 节点
RigDefinition：schemaVersion 6
ProjectState：schemaVersion 5
模块 revision：3
完成日期：2026-08-19
```

## 本轮目标

本轮把骨架系统评估转化为可执行的兼容基础，完成以下工作：

1. 明确当前 28 节点各自承担变形、控制或测量职责。
2. 清理主视图中不应长期显示的头顶和脚趾末端辅助节点。
3. 为全部节点建立局部关节轴数据契约，为后续动作四元数、扭转分解和重定向提供依据。
4. 冻结追加式 `rig@0.5.0` 与 `rig@0.6.0` 升级蓝图，同时维持当前活动骨架完全兼容。
5. 在比例工作台直接显示当前骨架能力与缺口，并支持导出审计结果。

本轮没有启用新的变形骨、IK 控制器、手指或面部关节。新增活动节点会同时影响 SkinBinding、逆绑定矩阵、姿势映射、动画轨道和共享导出协议，需要经过总控与其他模块的兼容评审。

## 工作边界

源码修改严格限定在 `MODULE_SCOPE.json` 允许写入的比例路径：

```text
src/modules/proportion/**
legacy/v8/src/body-profile.js
legacy/v8/src/skeleton-presets.js
legacy/v8/tests/body-profile.mjs
legacy/v8/tests/validate-data.mjs
control/active-tasks/proportion.md
control/module-status/proportion.json
```

以下共享协议和其他模块文件保持只读：

```text
src/state-schema.js
src/project-hub.js
src/studio.js
src/default-state.js
src/module-registry.js
workers/project-hub.shared.js
legacy/v8/src/main.js
legacy/v8/src/three-view.js
package.json
.github/workflows/**
```

源码边界审计结果：修改 8 个允许路径，越界修改 0 个。

## 当前骨架审计结果

```text
总节点：28
SMPL 变形关节：24
全身控制节点：1
测量标记：3
校正关节：0
挂点：0
默认可见关节：22
默认隐藏节点：6
可见骨杆：21
参与现有物理骨长约束的骨段：26
变形影响关节：24
关节轴契约：28 / 28
关节轴正交检查：通过
关节轴运行时应用：尚未启用
```

默认隐藏节点为：

```text
root
headTop
leftShoulder
rightShoulder
leftToesEnd
rightToesEnd
```

其中左右 `leftShoulder` 和 `rightShoulder` 对应 SMPL 锁骨关节。锁骨骨杆继续显示，锁骨关节球继续隐藏，左右 `leftUpperArm` 和 `rightUpperArm` 继续作为真正肩关节显示。

## 节点角色调整

### 变形关节

现有 24 个 SMPL 节点全部保留稳定 ID、顺序、父子关系和标准索引。它们继续承担当前表皮蒙皮和身体主链变形。

### 控制节点

`root` 明确标记为全身控制器：

```text
role: control
visibilityLayer: controls
solverParticipation: global-root
exportPolicy: rig
```

### 测量标记

以下三个编辑辅助节点明确标记为测量节点：

```text
headTop
leftToesEnd
rightToesEnd
```

它们的主视图关节球和骨杆均已隐藏。当前求解器行为保持兼容，新的 `solverParticipation: passive-endpoint` 先作为数据契约保存，待共享求解器正式消费。

### 手部命名

现有 `leftHandEnd` 和 `rightHandEnd` 属于 SMPL 手部中心节点，继续参与变形。界面标签更新为：

```text
左掌中心
右掌中心
```

这样可以避免将手掌中心误解为手指末端。

## 关节轴契约

新增：

```text
schema: humanoid_rig/joint_axes@1.0
profile: smpl24-controls28-bind-frame-v1
space: joint-local-at-bind
quaternionOrder: xyzw
runtimeApplied: false
```

每个节点包含：

```text
twistAxisLocal
bendAxisLocal
sideAxisLocal
jointType
source
runtimeApplied
```

轴数据根据不可变 A 绑定层级、骨段方向和解剖弯曲参考生成。八项 BodyProfile 变化后会重新生成轴契约，确保肩宽、髋宽、四肢长度和身高变化不会留下旧轴数据。

当前动作和动画运行时仍以骨段方向为主要输入，尚未应用完整局部四元数和 swing twist 分解。`runtimeApplied: false` 用于防止其他模块误判为生产可用状态。

## 追加式骨架升级蓝图

### 身体生产版 `rig@0.5.0`

目标为 32 个变形关节，在现有 24 个 SMPL 关节之外追加 8 个隐藏扭转关节：

```text
leftUpperArmTwist    parent: leftUpperArm
rightUpperArmTwist   parent: rightUpperArm
leftForearmTwist     parent: leftLowerArm
rightForearmTwist    parent: rightLowerArm
leftThighTwist       parent: leftUpperLeg
rightThighTwist      parent: rightUpperLeg
leftCalfTwist        parent: leftLowerLeg
rightCalfTwist       parent: rightLowerLeg
```

每个扭转关节按对应长骨中点生成，作为派生叶节点运行。现有肘、腕、膝和踝的父级保持原值，旧动作轨道和蒙皮索引不会因链路插入发生整体迁移。

蓝图同时冻结 12 个非变形控制器：

```text
centerOfMass
leftHandIK
rightHandIK
leftElbowPole
rightElbowPole
leftFootIK
rightFootIK
leftKneePole
rightKneePole
leftFootRoll
rightFootRoll
gazeTarget
```

冻结 6 个接触或抓取标记：

```text
leftHeelContact
rightHeelContact
leftBallContact
rightBallContact
leftPalmGrip
rightPalmGrip
```

保留两个可选肩胛校正关节：

```text
leftScapulaCorrective
rightScapulaCorrective
```

蓝图已经记录每个追加节点的父级、角色、显示层、求解参与方式、导出策略、生成位置规则和驱动方式。

### 完整表现版 `rig@0.6.0`

目标为 65 个变形关节。在身体生产版基础上继续追加：

```text
30 个手指关节
leftEye
rightEye
jaw
```

手指采用左右各五指、每指三段的固定命名与父子链。第一段连接当前左右掌中心节点，后续两段依次连接。完整 33 个追加节点的 ID 与父级已经写入升级蓝图。

## 比例工作台变化

比例板块增加“骨架系统能力”区域，显示：

1. 稳定变形关节数。
2. 控制节点数。
3. 测量标记数。
4. 默认可见和隐藏节点数。
5. 关节轴契约完整度。
6. 基础身体动作接入状态。
7. 精细扭转、手部和面部缺口。
8. 身体生产版与完整表现版目标。

新增两个导出入口：

```text
导出当前骨架审计
导出升级清单
```

这些导出属于比例模块派生数据，没有写入共享 ProjectState schema。

## 修改文件

```text
src/modules/proportion/index.js
src/modules/proportion/rig-system.js
legacy/v8/src/body-profile.js
legacy/v8/src/skeleton-presets.js
legacy/v8/tests/body-profile.mjs
legacy/v8/tests/validate-data.mjs
control/active-tasks/proportion.md
control/module-status/proportion.json
HANDOFF.md
changed-files.txt
test-results.txt
```

## 文件级说明

### `legacy/v8/src/skeleton-presets.js`

1. 增加关节角色、显示层、求解参与方式和导出策略枚举。
2. 增加 `CURRENT_RIG_PROFILE`，声明当前 28 节点兼容核心、预期数量和显示规则。
3. 为所有关节补充 `role`、`visibilityLayer`、`deformInfluence`、`solverParticipation`、`collisionRole`、`retargetSemantic` 和 `exportPolicy`。
4. 将头顶与脚趾末端改为隐藏测量标记。
5. 保留隐藏锁骨关节球和可见锁骨骨杆。
6. 增加 `createJointAxisContract()`、`auditJointAxisContract()` 和 `summarizeRigDefinition()`。
7. `normalizeSkeletonDefinition()` 可以补齐旧骨架缺失的角色字段，并重新生成完整轴契约。
8. 清理镜像表中重复的 `leftShoulder` 键。

### `legacy/v8/src/body-profile.js`

每次八项比例生成新绑定后重新计算 28 个关节的轴契约。参考比例零漂移、八项三维精度和重新绑定判定继续沿用 v001 修复。

### `src/modules/proportion/rig-system.js`

1. 新增当前骨架能力报告。
2. 新增 `rig@0.5.0` 身体生产版的完整追加节点定义。
3. 新增 `rig@0.6.0` 手指、眼球和下颌的完整追加节点定义。
4. 固定追加式兼容规则，不插入或重排现有 28 节点。
5. 记录所有跨模块启用前置条件。

### `src/modules/proportion/index.js`

增加能力审计面板、当前限制说明、审计 JSON 导出和升级蓝图 JSON 导出。现有八项比例控制与三维测量功能保持不变。

### 自动测试

`legacy/v8/tests/validate-data.mjs` 新增：

```text
28 节点角色数量精确检查
6 个默认隐藏节点精确检查
28 个关节轴完整性与正交性检查
追加节点 ID 唯一性与旧 ID 冲突检查
rig@0.5.0 追加节点父级均指向现有兼容骨架
8 个扭转节点驱动和中点放置规则检查
rig@0.6.0 30 个手指链父级顺序检查
双眼与下颌追加定义检查
```

`legacy/v8/tests/body-profile.mjs` 新增或强化：

```text
参考与自定义比例角色数量保持稳定
参考与自定义比例测量标记持续隐藏
全部 28 个关节轴在比例重建后重新生成
256 组边界组合轴契约完整且正交
64 组确定性混合比例轴契约完整且正交
肩宽变化会更新对应肩带轴数据
```

## 测试结果

在完成全部修改后运行：

```text
npm test
```

结果：全部测试通过，失败数 0。

通过范围包括：

```text
顶层 0.5.0 schema、迁移和模块 Patch
多窗口模块补丁合并
三维比例桥接和八项实测反馈
隐藏锁骨与真正肩关节显示语义
SMPL 24 映射和 28 节点角色分类
28 节点绑定轴契约
rig@0.5.0 与 rig@0.6.0 升级蓝图
参考绑定零漂移
256 组八项边界组合
64 组确定性混合比例
固定骨长、全身传播和人体活动范围
GLB 解析、DQS 表皮和单层精细表皮集成
```

T 姿势表皮质量测试仍记录：

```text
最大位移：0.6531 m
最大局部边拉伸：5.632x
最大肩部拉伸：1.645x
```

该结果继续通过现有测试阈值，但仍说明当前蒙皮属于过渡版本，无法代表新增扭转骨后的生产质量。

## 兼容性结论

```text
当前活动版本：rig@0.4.0
兼容骨架：SMPL 24 + 4 辅助节点
总节点：28
节点 ID：无变化
节点顺序：无变化
父子层级：无变化
SMPL 索引：无变化
ProjectState schema：无变化
共享消息协议：无变化
SkinBinding：无变化
动作轨道：无变化
```

因此，现有比例、蒙皮、姿势和动画模块可以继续读取当前骨架。主视图会减少头顶和脚趾末端的辅助球与骨杆。

## 已知问题

1. `jointAxes` 已完成数据契约和测试，动作运行时尚未消费该数据。精细前臂翻掌、上臂内旋和腿部轴向扭转仍会缺失。
2. 共享 `legacy/v8/src/three-view.js` 当前只读取 `visualJoint` 与 `visualBone`。新 `role` 与 `visibilityLayer` 尚未形成可切换显示层，因此测量标记当前在现有视口中保持隐藏，诊断模式暂时无法单独打开它们。
3. 共享 `legacy/v8/src/skeleton-model.js` 的导出器会保留顶层 `rigProfile` 与 `jointAxes`，其重建关节对象时尚未逐项序列化新增角色字段。当前 28 节点导入时可以依据 SMPL 和 helper 信息重新推断角色；未来 corrective、socket 和复杂控制节点需要总控扩展导出器。
4. 当前没有实际增加 8 个扭转变形骨，也没有生成对应蒙皮权重和逆绑定矩阵。`rig@0.5.0` 仍属于待评审蓝图。
5. 当前没有手脚 IK、足底滚动、抓取、手指、眼球和下颌运行时。
6. v001 已记录的滑块预览提交状态与轻量测量刷新问题仍位于共享 `legacy/v8/src/main.js` 和 `src/studio.js`，本轮继续保持只读。
7. 无头 Chromium 在当前容器中无法稳定完成 WebGPU 或 EGL 画面启动，自动化数据测试已经完成，Windows Chrome 或 Edge 视觉验收仍需执行。

## 需要总控与其他模块处理的事项

### 总控

1. 冻结 `rig@0.5.0` 的追加节点清单、命名、父级和版本迁移规则。
2. 扩展共享 RigDefinition 导出器，完整序列化所有角色字段。
3. 扩展共享视口，支持人体主骨架、控制器、变形辅助、测量标记和碰撞体显示层。
4. 在共享 schema 中确定 `jointAxes`、局部四元数和升级骨架版本的正式字段位置。

### 蒙皮板块

1. 为 8 个扭转骨生成 SkinBinding 权重和逆绑定矩阵。
2. 重新检查肩、肘、腕、髋、膝和踝区域的权重分布。
3. 为肩胛与极端关节姿势建立必要的校正形变。

### 动作板块

1. 消费 `jointAxes` 并生成真实局部四元数。
2. 完成 swing twist 分解和长骨扭转分配。
3. 验证 12 个 IK 控制器和 6 个接触标记的求解语义。

### 动画板块

1. 保持旧 24 关节轨道可播放。
2. 新扭转骨使用派生轨道或运行时驱动，避免要求所有旧动作补写轨道。
3. 建立 `rig@0.4.0` 到 `rig@0.5.0` 的重定向和回退测试。

## 推荐集成顺序

1. 总控审查 `rig-production-blueprint.json` 并冻结 `rig@0.5.0`。
2. 动作板块先验证局部轴和四元数适配器。
3. 蒙皮板块生成支持 32 变形关节的实验 SkinBinding。
4. 动画板块验证旧动作兼容与派生扭转。
5. 共享视口加入显示层和新的控制器形状。
6. 四模块共同运行兼容测试。
7. 全部通过后更新 `activeVersions.rig`。

## 本地验收步骤

1. 将补丁覆盖到已经应用 v001 的完整比例工作包。
2. 在根目录运行 `npm test`。
3. 双击 `START_HERE.cmd`，打开 `studio.html?module=proportion`。
4. 检查头顶和左右脚趾末端不再显示辅助球和骨杆。
5. 检查左右锁骨骨杆仍显示，锁骨控制球保持隐藏，左右真正肩关节球继续显示。
6. 在比例面板查看“骨架系统能力”，确认显示 24 个变形关节、1 个控制节点、3 个测量标记和 28 / 28 轴契约。
7. 分别调整八项参数，确认三维骨架、测量值和左右镜像继续正常。
8. 使用两个导出按钮检查当前骨架审计和升级清单。

## 回滚

从 v001 完整工作包恢复以下文件：

```text
src/modules/proportion/index.js
legacy/v8/src/body-profile.js
legacy/v8/src/skeleton-presets.js
legacy/v8/tests/body-profile.mjs
legacy/v8/tests/validate-data.mjs
control/active-tasks/proportion.md
control/module-status/proportion.json
```

删除新增文件：

```text
src/modules/proportion/rig-system.js
```
