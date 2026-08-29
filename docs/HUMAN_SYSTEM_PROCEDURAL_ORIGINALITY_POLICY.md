# Humanoid Rig Lab Next 人体系统原创生成与骨骼智能体永久规则

生效日期：2026-08-29

规则 ID：`human_system/procedural_originality_policy@1.0.0`

状态：`APPROVED_BY_USER`

## 0. 用户原始意图

项目不能直接把别人的模型搬过来使用。外部内容可以作为数据和知识参考。项目需要新建自己的骨骼智能体。这个智能体脱离传统固定模型逻辑，后续可以按照人物、任务和设计要求自由修改，并能够重新生成和重新编译人体结构。

## 1. 规则适用范围

本规则适用于：

1. 人体比例与 BodyDNA。
2. 骨骼、关节、骨性标志点和人体 Rig。
3. 肌肉、筋膜、脂肪和其他软组织。
4. 人物表面、固定拓扑、蒙皮、权重和 Corrective。
5. 姿势、动作、动画、物理、平衡和接触。
6. 图片驱动人体重建。
7. 人体生成、编辑、导出、缓存和版本管理。
8. 所有 GPT、Codex、Luna、Copilot 和人工开发任务。

服装、道具和环境资产继续遵守各自的来源和许可规则。任何服装或道具资产都不能成为人体结构权威。

## 2. 原创生成边界

### 2.1 正式生产路线禁止内容

正式人体生产路线禁止：

1. 直接导入第三方人体或解剖模型。
2. 复制第三方网格的顶点、三角形和拓扑。
3. 复制第三方骨骼层级、绑定矩阵、蒙皮权重和 Corrective 数据，随后作为自研真值。
4. 将第三方模型执行格式转换后作为项目母版。
5. 将第三方模型重拓扑、减面、加密、雕刻、融合或分件后作为项目母版。
6. 从第三方模型烘焙形状、法线、位移或体积场，随后作为正式生成源。
7. 在网页运行时远程加载第三方人体模型。
8. 在仓库中隐藏 base64 模型、压缩模型或未登记模型。

### 2.2 研究参考允许内容

项目可以使用来源明确、许可明确、版本明确的：

1. 解剖名称和标准分类。
2. 身高、骨长、宽度、厚度和角度测量。
3. 人群统计分布和合理范围。
4. 骨干曲率、扭转、骨端和关节面规律。
5. 骨性标志点和肌肉附着关系。
6. 关节活动范围、质量分布和惯性研究。
7. 数学公式、参数拟合、误差模型和验证方法。
8. 隔离环境中的视觉对照。

参考记录至少包含：

```text
sourceId
sourceTitle
rightsHolder
version
publicationDate
license
population
sampleSize
sex
ageRange
units
originalValue
normalizedValue
derivation
confidence
useInSystem
```

缺少关键来源信息时，数据状态只能为 `pending` 或 `blocked`。

## 3. 新人体结构权威链

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
→ Muscle System
→ Fascia and Soft Tissue System
→ Surface Carrier
→ Skin
→ Renderer
```

### 3.1 BodyDNA

描述整个人体的设计和个体意图，例如身高、年龄、总体比例、肩宽、骨盆宽、四肢比例、左右差异、肌肉量和脂肪量。

### 3.2 SkeletalDNA

描述每块骨骼可以修改的生成参数，例如骨长、骨干截面、曲率、扭转、骨端尺寸、关节面、骨性突起、皮质厚度、左右差异和细节精度。

### 3.3 AnatomicalGraph

保存稳定语义关系，包括骨 ID、关节 ID、父子关系、左右关系、骨性标志点、关节候选、肌肉附着关系、生成器依赖和未来 HumanRigCore 映射。

### 3.4 Procedural Generators

所有正式骨骼、肌肉、软组织和表面几何由项目自己的参数、算法和约束生成。生成器需要确定性、可测试、可版本化，并能输出来源和参数证明。

### 3.5 Compiled AnatomicalProfile

保存某一人体 revision 的完整解剖快照。它由结构数据编译产生，不能由固定 GLB 反向推导成为权威。

### 3.6 HumanRigCore 与 finalPose

HumanRigCore 继续管理运行时稳定关节、绑定位置、固定骨长、局部 Basis 和限制。finalPose 继续作为实际姿势权威。显示骨骼、肌肉、软组织和皮肤只读取这些结果。

## 4. 骨骼智能体架构

骨骼智能体逐步包含：

```text
SkeletonIntentParser
SkeletalDNAManager
AnatomicalDependencyGraph
BoneGeneratorRegistry
SkeletonAssemblySolver
JointSurfaceSolver
AnatomicalValidator
AnatomicalProfileCompiler
HumanRigCoreCompiler
SkeletonRevisionManager
```

执行链：

```text
用户结构指令
→ 结构化 SkeletonEditIntent
→ SkeletalDNA Patch
→ 依赖影响分析
→ 局部骨骼重新生成
→ 标志点与关节候选重新计算
→ 组装与解剖验证
→ 预览 revision
→ 用户确认
→ 正式 revision
→ HumanRigCore 新绑定版本
→ 动作重定向
→ 肌肉皮肤重新适配通知
```

语言模型可以理解修改意图和推荐参数。语言模型不能直接写入正式顶点和三角形。

## 5. 可自由修改的工程含义

“可以随意更改”需要通过结构化方式实现：

1. 语义 ID 稳定。
2. 参数可以修改。
3. 几何可以重新生成。
4. 受影响依赖可以自动失效和重算。
5. 每一次结构变化形成新的 revision。
6. 旧 revision 保留并可以恢复。
7. 动作可以重定向到新绑定版本。
8. 肌肉、软组织和皮肤可以读取新的 Anatomy Contract。
9. 同一 revision 的动作运行期间继续保持骨长固定。
10. 极端参数必须触发明确停止条件，禁止产生静默损坏。

允许的修改示例：

```text
改变人物身高
改变前臂长度
改变肩带宽度
改变股骨前倾角
改变骨盆形态
增加左右不对称
改变脊柱曲率
改变骨端和关节面尺寸
生成年龄相关骨骼 revision
生成损伤或病理研究 revision
```

## 6. 确定性与版本门

每个正式生成结果至少记录：

```text
bodyDNAHash
skeletalDNAHash
anatomicalGraphHash
generatorRegistryHash
anatomicalProfileHash
jointBasisHash
landmarkSetHash
bindPoseHash
humanRigCoreBindingRevision
finalPoseSchemaVersion
muscleAttachmentContractVersion
surfaceCarrierVersion
skinBindingVersion
```

相同输入、相同生成器版本、相同种子和相同精度必须产生相同几何哈希。

局部修改需要记录：

```text
changedIds
regeneratedIds
invalidatedDependencyIds
previousHashes
nextHashes
```

## 7. GLB 与固定资产的地位

GLB 可以用于：

1. 派生缓存。
2. 浏览器审查。
3. 性能 LOD。
4. 兼容运行时。
5. 标准导出。
6. 历史对照。

GLB 不能用于：

1. 保存人体结构唯一真值。
2. 反向覆盖 SkeletalDNA。
3. 反向覆盖 AnatomicalGraph。
4. 反向覆盖 HumanRigCore。
5. 反向覆盖 finalPose。

派生资产必须携带生成 revision 和全部关键哈希。删除派生资产后，系统需要能够从结构数据重建。

## 8. 骨骼线与肌肉皮肤线

两条线并行工作，通过统一合同汇合。

骨骼动作线负责：

```text
SkeletalDNA
AnatomicalGraph
骨骼生成
关节中心
关节 Basis
HumanRigCore 编译
平衡
动作
行为
```

肌肉皮肤线负责：

```text
肌肉生成
附着点
筋膜
脂肪和软组织
Surface Carrier
固定拓扑皮肤
蒙皮和 Corrective
```

肌肉皮肤线不能另建人体关节真值。两条线至少共享：

```text
anatomyProfileHash
jointBasisHash
landmarkSetHash
bindPoseHash
finalPoseFixtureHash
performanceDeformProfileVersion
muscleAttachmentContractVersion
surfaceCarrierVersion
skinBindingVersion
```

版本不一致时联合 QA 直接阻断。

## 9. 旧资产与历史成果

1. 已有 P1、P1.1、P2 生产骨架保留为历史显示和诊断资产。
2. 已有兼容表皮、旧 SMPL 映射和第三方研究资产保留原历史身份。
3. 旧资产不能自动成为新 SkeletalDNA、AnatomicalGraph 或 AnatomicalProfile 的来源。
4. 已完成的 HumanRigCore、finalPose、Command Understanding、BehaviorPlan 和动作 QA 工具继续保留。
5. 已下发任务保持原命令和原停止条件。
6. 新路线不得通过 reset、clean、stash、rebase 或覆盖操作破坏未提交成果。

## 10. 新任务编写规则

每条人体任务必须明确写出：

1. 是否读取并遵守本规则。
2. 外部几何来源数量，正式门槛为 0。
3. 加载第三方人体模型数量，正式门槛为 0。
4. 结构权威输入和派生输出。
5. 允许修改范围。
6. 冻结范围。
7. 生成器版本。
8. 依赖失效范围。
9. 确定性重放测试。
10. HumanRigCore 和 finalPose 写入边界。
11. 用户视觉门。
12. 停止条件。

推荐公开状态字段：

```text
policyId
policyAccepted
externalGeometrySourceCount
loadedExternalHumanModelCount
proceduralGenerationOnly
runtimeBoneScaleCount
deterministicReplayPassed
authorityWriteViolationCount
```

## 11. 冲突处理

任何任务与本规则冲突时：

```text
停止修改
保留工作树
记录冲突文件和请求
返回 HUMAN_SYSTEM_POLICY_CONFLICT
等待用户决定
```

禁止以兼容、临时、测试、快速验证或视觉参考为理由绕过正式生产边界。

## 12. 当前批准状态

```text
OLD_CANONICAL_ASSET_TASK_WITHDRAWN
EXTERNAL_MESH_IMPORT_FORBIDDEN
PROCEDURAL_SKELETON_AGENT_ROUTE_ACCEPTED
externalProductionHumanModelImportAllowed = false
proceduralSkeletonAgentRoute = approved
visualAcceptance = false
productionReady = false
userVisualAcceptance = pending
```
