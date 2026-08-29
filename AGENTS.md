# Humanoid Rig Lab Next Repository Agent Rules

生效日期：2026-08-29

规则版本：`human_system/procedural_originality_policy@1.0.0`

适用范围：仓库内所有人体相关研究、设计、代码、资产、测试、文档和 Codex 任务。

## 1. 启动前强制读取

每次开始人体相关任务前，依次读取：

1. 本文件。
2. `docs/HUMAN_SYSTEM_PROCEDURAL_ORIGINALITY_POLICY.md`。
3. `docs/HUMAN_SYSTEM_PROCEDURAL_ORIGINALITY_POLICY.json`。
4. `HUMANOID_RIG_LAB_NEXT_MASTER_CONTEXT.md`。
5. 当前分支的 `README.md` 与 `BUILD_MANIFEST.json`。
6. 当前任务涉及的源码、测试、证据和远端分支状态。

GitHub 当前远端状态是代码事实。本地未推送成果、恢复 bundle 和历史分支需要单独登记。

## 2. 用户批准的永久原则

项目不能直接搬用第三方人体模型。允许参考来源明确的数据、测量、统计、解剖关系和研究结论。项目需要建立自己的骨骼智能体与人体生成体系。人体结构不以传统固定模型为权威，后续必须能够通过参数、规则、依赖图和版本系统进行局部修改、整体重建、比较、回滚与重新编译。

## 3. 永久禁止

1. 将第三方人体、骨骼、肌肉、软组织或皮肤网格提交到正式生产路线。
2. 复制第三方模型的顶点、三角形、拓扑、骨骼层级、蒙皮权重或逆绑定矩阵，随后宣称为自研资产。
3. 将第三方模型重拓扑、简化、转换、烘焙或局部修改后作为正式人体母版。
4. 让 OBJ、FBX、STL、GLB、Blend 或其他固定模型成为人体结构权威。
5. 通过 `bone.scale`、负缩放或场景整体缩放解决人体比例和骨长问题。
6. 让 AI、语言模型或生成模型直接输出不可审计的正式顶点和三角形。
7. 让显示骨架、肌肉、软组织或皮肤反向写入 HumanRigCore 或 finalPose。
8. 为了通过视觉门而隐藏来源、许可、生成路径、参数、失败条件或版本差异。

## 4. 允许使用的外部参考

允许使用来源、许可和版本明确的：

1. 解剖命名与分类。
2. 人体测量数据和统计范围。
3. 骨长、骨端尺寸、曲率、扭转和关节面规律。
4. 骨性标志点、肌肉起止点和活动范围。
5. 论文中的数学关系、拟合方法和误差范围。
6. 用于研究对照的图片、图表和隔离参考资产。

所有进入仓库的参考数据必须记录来源、版本、单位、适用人群、推导过程、许可和置信度。隔离参考资产不得被运行时加载，也不得进入正式导出。

## 5. 新人体权威链

```text
BodyDNA
→ SkeletalDNA
→ AnatomicalGraph
→ Procedural Bone Generators
→ Skeleton Assembly Solver
→ Compiled AnatomicalProfile
→ HumanRigCore Compiler
→ HumanRigCore
→ finalPose
→ Performance Deform Rig
→ Muscle
→ Fascia and Soft Tissue
→ Surface Carrier
→ Skin
→ Renderer
```

稳定语义、可变参数、可重建几何、可重新编译绑定是这条路线的核心。

## 6. 骨骼智能体最低能力

骨骼智能体需要逐步具备：

1. 结构修改意图解析。
2. SkeletalDNA 管理。
3. AnatomicalGraph 与依赖影响分析。
4. 多类程序化骨生成器。
5. 全身骨骼组装与约束求解。
6. 骨性标志点、关节中心和关节 Basis 计算。
7. AnatomicalProfile 编译。
8. HumanRigCore 绑定版本编译。
9. 局部重建、确定性哈希、版本比较和回滚。
10. 对肌肉、软组织与皮肤的失效通知和重新适配合同。

## 7. 修改和版本规则

1. 相同结构数据、生成器版本、种子和精度必须产生相同几何哈希。
2. 修改一块骨骼时只重建受影响对象和依赖项。
3. 结构修改生成新的 SkeletalDNA revision、AnatomicalProfile revision 和绑定 revision。
4. 同一绑定 revision 的动作运行阶段保持骨长固定。
5. GLB 只允许作为派生缓存、审查资产、兼容输出和导出结果。
6. 删除派生 GLB 后，系统必须能够从结构数据重建相同结果。
7. 所有重大修改必须可追踪、可比较、可回滚。

## 8. 现有成果和既有命令

1. 已下发任务继续遵守原命令、原分支、原允许范围和原停止条件。
2. P1、P1.1、P2 和旧静态骨架保留为历史、兼容、显示、诊断和动作合同对照。
3. 现有第三方兼容表皮和旧资产不得自动升级为新人体结构权威。
4. Task 17A 的语义、行为计划和动作研究成果继续保留。
5. Native Human Surface V1 继续作为并行研究线。
6. 新任务逐步切换到本规则，禁止借规则变更覆盖未提交工作树。

## 9. 任务停止条件

遇到以下任一情况立即停止并汇报：

1. 实现必须依赖第三方固定人体网格。
2. 来源、许可、单位、版本或推导过程无法确认。
3. 生成器必须复制外部顶点、索引或拓扑。
4. 自由修改只能通过缩放固定模型完成。
5. 相同输入无法重现相同结构与几何哈希。
6. 新模块试图建立第二套人体姿势权威。
7. 新模块试图反向修改 HumanRigCore 或 finalPose。
8. 当前任务需要清理、重置或覆盖其他有效工作树。

## 10. 全局状态

```text
visualAcceptance = false
productionReady = false
userVisualAcceptance = pending
externalProductionHumanModelImportAllowed = false
proceduralSkeletonAgentRoute = approved
```
