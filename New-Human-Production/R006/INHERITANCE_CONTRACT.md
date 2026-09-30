# 新人物 001 · R006 原人物工作台继承契约

## 基线

- 分支：`work/human-character-surface-001-r006-inherit-original-core-20260930`
- 直接基线：`archive/human-r2-original-system-20260930`
- 基线提交：`3c3e9a4b7b250f4c8db20c15e2e5fab4ca9ce568`
- 用户源表面：`human+figure+3d+model (1).usdz`
- SHA-256：`b0435f3f30e0d63b6d4527000b7995b16fa91ca0ba8cb16b811be285e4fe7567`

## R005 判定

R005 的自建简化骨架、按高度带划区、质心关节、四权重直接 LBS 和手写正弦动作全部停止使用。截图已经证明该路线会产生跨肢体拉伸、肩腋撕裂、前臂长带、腿部断层和错误关节轴。

R005 只作为失败证据保存，不作为后续代码基线。

## 必须直接继承的原系统

### Core Rig

- `body/ReconstructionRig.js`
- `reconstruction/rig-reference.json`
- `body/CharacterShape.js`
- `reconstruction/shape-deform.mjs`

使用原 R2 关节 ID、父子层级、固定骨长、源绑定帧和左右肢体解剖轴。不得另建一套 24 骨或根据包围盒猜骨架。

### Surface Binding

- `reconstruction/binding-schema.json`
- `reconstruction/anatomy-rules.mjs`
- `reconstruction/binding.mjs`
- `body/CompactBinding.js`

使用原系统的解剖区域掩码、允许关节集合、同源表面图、绑定根、肩部过渡、骨盆中线保护、最多八影响和归一化 DQS。不得继续使用按高度阈值给整块表面分配四个骨骼的办法。

### Pose / Animation

- `body/MotionLabPose.js`
- `body/ReferenceMotion.js`
- `body/StandardsMotion.js`
- `body/NaturalLocomotion.js`
- `body/MotionLabActions.js`
- `body/ContactHandPose.js`

继续使用原系统的 `desiredPose → 约束/IK/接触 → finalPose` 链、固定骨长、脚底锚定、局部四元数、动作重定向和过渡。不得再写一套独立的正弦挥手、走路、下蹲和坐下。

### Behavior / Task

- `control/TaskAgent.js`
- `control/NPCPopulation.js`
- `control/PlanForecast.js`
- `language/HumanoidSemanticBridge.js`
- `language/JarvisSemanticPlanner.js`

行为仍进入原任务与动作规划系统，不让表皮适配层成为第二个行为权威。

## 新人物只新增的桥梁

新人物只允许新增一个 `SampledSurfaceAdapter`：

1. 读取 USDZ 全部表面、拓扑、法线、UV、材质和纹理；
2. 把源表面统一到原工作台坐标契约：右手系、Y 向上、Z 向前、X 左负；
3. 从源表面生成该人物的 `ProportionProfile` 和原 R2 关节的个人化绑定位置；
4. 生成与原 `binding-schema` 一致的区域掩码、绑定根和表面邻接图；
5. 调用原 `buildCompactBinding` / DQS 运行路径；
6. 表皮只读取原系统最终 `simulationRig` 矩阵；
7. 短裤现阶段保留，后续作为服装独立处理，不允许影响人体 Core Rig。

## 第一验收门

在加入任何行为前，必须先通过：

- 中性站姿无表面位移；
- A/T 姿势肩腋不出现跨身体长带；
- 单侧屈肘不牵动躯干和对侧肢体；
- 单侧抬腿不撕开骨盆中线；
- 手掌、前臂和腕部不脱节；
- 骨长、父子层级和绑定比例保持不变；
- 表皮、骨架和碰撞体读取同一个 finalPose。

通过该门后，才接回原工作台的挥手、行走、转身、下蹲、坐起和任务行为。