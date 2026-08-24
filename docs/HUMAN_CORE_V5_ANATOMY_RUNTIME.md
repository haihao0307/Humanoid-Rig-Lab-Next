# Human Core V5 Anatomy Runtime

## 定位

Anatomy Runtime 是 Human Core V5 的第二阶段：它把稳定的 `BodyDNA` 与 V4 的局部四元数 `PoseFrame` 投影为**人体语义状态**。它不是网格生成器、GLB 替代物、Skin Runtime 或 WholeBodySolver。

```text
BodyDNA + HumanRigCore + PoseFrame V4
                 |
                 v
        AnatomyPoseEvaluatorV5
                 |
                 v
       HumanAnatomyState V5
          |        |        |
          |        |        +-- AnatomyDeformationSignal (仅信号)
          |        +----------- HumanBalanceState (仅观察)
          +-------------------- MassDistributionModel
```

数据保持在 `HumanCoreState.anatomyState` 中，运行时由 `HumanAnatomyRuntimeV5` 缓存最近一次评估结果。它不创建第二套 Rig、ProjectState、渲染器或物理解算器。

## HumanAnatomyState V5

Schema：`humanoid_rig/human_anatomy_state@5.0`

| 字段 | 责任 |
| --- | --- |
| `muscleState` | 以肌肉组激活度表达当前姿态需求，不模拟肌肉纤维。 |
| `massDistribution` | 由 BodyDNA 推导的头、躯干、双臂、双腿质量和根局部重心。 |
| `jointLoad` | 基于质量影响、局部旋转需求与姿态倾斜的归一化语义负荷。 |
| `balanceState` | 支撑区域、稳定度、倾斜与纠正提示；只观察，不替换 WholeBodySolver。 |
| `bodyVolumeState` | 肩、胸、腹、髋、手臂、腿的 0–1 语义体积参数。 |
| `postureState` | 来自局部四元数与接触数据的姿态分类、对称性和倾斜。 |
| `deformationSignal` | 面向未来 Procedural Deform / Skin Corrective 的只读信号。 |

状态明确拒绝 `mesh`、GLB、纹理、顶点、权重、`inverseBindMatrices`、动画轨道等渲染或绑定数据；也不保存骨长或父子关系。

## 质量模型与平衡接口

`MassDistributionModel` 由 `BodyDNA.mass`、比例和左右不对称参数生成：

- `headMass`、`torsoMass`、`armMass`、`legMass`；
- 左右分配，支持不同人物的重心差异；
- `centerOfMass.position` 为**根局部语义坐标**，不是 V8 世界位置。

`HumanBalanceState` 根据 V4 `contacts` 和上述重心给出 `supportArea`、`stability`、`lean` 与 `correctionHint`。它不会写入 PoseFrame、Animation、PhysicsRig 或 Skin。

## 肌肉语义层

`MuscleSemanticProfile` 复用现有 `HumanRigCore` 的核心关节 ID。当前覆盖：

- 躯干核心：`hips`、`spine`、`chest`、`upperChest`；
- 左右肩复合体：胸廓、肩、上臂；
- 左右臂链：上臂、前臂、手；
- 左右髋复合体：骨盆、躯干、上腿；
- 左右膝链：上腿、下腿、脚。

它只声明 `affectedJoints`、激活范围与 `deformationInfluence`；不改变关节层级、轴定义或控制器。

## V4 兼容边界

- 输入仍为 `PoseFrame V4`：`rootPosition`、`rootRotation`、`localRotations`、contacts、IK/constraint 状态；
- 不修改 Pose、MotionClip 或 Skin schema；
- Production Skin 继续从 `simulationRig.finalPose.localRotations` 读取姿态；
- Motion Runtime 仍只产生 `desiredPose`；
- WholeBodySolver / PhysicsRig 保有解算职责，Anatomy Runtime 仅消费最终可用的 V4 姿态。

## 未来 Procedural Deform 接口

`AnatomyDeformationSignal` 当前可产生：

```js
{
  shoulderElevation,
  chestExpansion,
  abdominalCompression,
  elbowCompression,
  thighCompression,
  armVolume,
  legVolume
}
```

所有值均限制在 `0..1`，并标记 `writesMesh: false`。未来的 Skin Corrective 或 Procedural Deform Adapter 可以显式消费这些信号；在那个阶段之前，它们不能更改网格、权重或绑定矩阵。

## 验证范围与风险

自动测试验证不同 BodyDNA 的质量/重心差异、PoseFrame 驱动、局部四元数权威链、双足支撑语义、稳定性、信号确定性，以及 V4 PhysicsRig / ProductionSkinRuntime 的非侵入兼容。

当前数值是可解释的语义估计，并非医学级人体生物力学或真实肌肉模拟。质量比例、负荷与体积公式后续需要真人动作和视觉验收数据校准；该校准应通过版本化参数进行，不应把网格或蒙皮修改塞回 Anatomy Runtime。
