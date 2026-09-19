# Original Bird Mother R0.01｜鸟类原始母体结构合同

日期：2026-09-20  
状态：research / schema candidate  
本轮范围：只建立 Bird Mother 的共同生物结构、参数边界、证据门禁和迁移测试；不生成新的可视鸟，不做群飞，不做材质美化，不宣称 3A 或 productionReady。

## 1. Original Bird 的定义

Original Bird 不是某一只“标准鸟”，也不是麻雀、斑鸠、苍鹭或海鸥的平均模型。

它是：

`Bird Instance = Original Bird Kernel + Clade Mother + Species Delta + Individual Delta + Life Stage + Current State`

其中 Original Bird Kernel 只保存广泛可迁移的鸟类共同关系：
- 统一身体坐标与真实单位；
- 骨骼身份和父子关系；
- 关节约束接口；
- 体积/软组织承载接口；
- 羽毛附着域和重叠关系；
- 头、喙、眼、颈、胸带、翼、骨盆、腿足、尾部的稳定语义；
- 成长与动作不能改写骨长/身份的规则；
- 参考证据、未知项、候选值和用户验收严格分层。

Original Bird Kernel 不保存：
- 某一物种的固定比例；
- 某一物种的固定颈椎数量；
- 固定翼展、喙长、腿长；
- 固定飞羽数量；
- 固定趾型；
- 固定步态/飞行策略；
- 用一套网格整体缩放得到全部鸟类的规则。

## 2. 三层结构

### A. Evidence Layer
只读保存模型、照片、视频、论文、博物馆标本、CT/扫描、测量表及来源信息。
每条证据必须记录：
- sourceId / file hash；
- taxonomy；
- sex / age / life stage（未知则 unknown）；
- scale status；
- pose；
- license / usage boundary；
- 可以证明什么；
- 不能证明什么。

### B. Parametric Mother Layer
保存结构、约束和连续函数，不携带外部模型作为最终运行依赖。

### C. Runtime Layer
由同一参数母体编译产生运行表达。性能优化不能改变同一只鸟的身份、骨长、关节关系和主要外形真值。

## 3. 统一坐标

单位默认：metre / radian / second。

局部鸟体坐标：
- +X：鸟体左到右的 lateral 轴；
- +Y：ventral → dorsal；
- +Z：caudal → cranial（尾到头）。

每个部件同时保留：
- anatomical frame；
- parent frame；
- reference/rest frame；
- current pose frame。

世界运动不得覆盖解剖坐标。

## 4. Original Bird 骨架语义

骨架不是固定 22/25/33 骨模板，而是“稳定语义 + 可变链长度”。

### 4.1 中轴与胸带
- root / body frame
- pelvis / synsacrum frame
- thoracic frame
- sternum
- keel/carina（存在/尺度由类群参数控制）
- left/right scapula
- left/right coracoid
- furcula/clavicular frame
- tail base
- pygostyle / caudal terminal frame

胸带不能被简化成两个肩点。肩、喙突、肩胛、胸骨/龙骨共同定义翼根承载关系。

### 4.2 颈部
`cervicalChain[]` 为可变长度结构。
每节至少保存：
- rest length；
- local frame；
- flexion/extension；
- lateral bending；
- axial rotation；
- clade/species range；
- volume carrier radius；
- contact/self-collision proxy。

允许运行时使用 grouped controls，但 grouped controls 必须标为工程抽象，不能伪装成真实逐椎骨记录。

鹭类必须允许独立 cervical specialization；不可由通用鸟颈简单拉长。

### 4.3 头与喙
- skull / cranium
- orbit L/R
- eye L/R
- upper beak / premaxillary region
- lower mandible
- beak hinge/contact line
- nostril region
- head-neck junction

喙不是一个贴在球形头上的锥体；上下喙、口裂和头颅必须分别表达。

### 4.4 翼骨（每侧）
- shoulder/glenoid
- humerus
- elbow
- radius
- ulna
- wrist/carpal frame
- carpometacarpus
- digit/alula frame
- distal digit frame

骨段长度默认不可在动作中改变。

## 5. 羽毛层必须独立于骨架层

外观看见的鸟主要是羽毛包络，因此 Feather Layer 不能只是 body mesh 的贴图。

至少分为：
- body contour feathers；
- scapulars；
- marginal/lesser/median/greater coverts；
- primary coverts；
- primaries；
- secondaries；
- tertials（适用时）；
- alula feathers；
- rectrices；
- down / semiplume（运行时可用统计层表达）。

共同附着合同：
- primaries 绑定 manus/carpometacarpus/digit 区；
- secondaries 沿 ulna 区；
- coverts 覆盖 remiges 与骨骼/皮肤连接区域；
- tail rectrices 绑定尾部/pygostyle 语义域；
- 羽毛展开时允许相邻羽片受约束滑移和重叠，不允许彼此完全独立漂浮。

羽片数量、长度、宽度、弯曲、扭转、重叠次序和羽轴方向属于 Clade/Species 参数，不属于 Original Bird 固定常数。

## 6. 体积、肌肉和软组织接口

Original Bird 先规定接口，不假装已有完整肌肉学真值。

最低层：
- thoracic carrier；
- pectoral carrier；
- cervical carrier；
- pelvic carrier；
- thigh carrier；
- wing proximal tissue carrier；
- skin/feather surface carrier。

后续可登记 pectoralis、supracoracoideus 等实证肌群，但只有有可靠来源时才进入 anatomical truth。

## 7. 腿与足（每侧）

共同骨链语义：
- hip
- femur
- knee
- tibiotarsus
- intertarsal/ankle region
- tarsometatarsus
- digit roots
- phalanges
- claw tips

趾型不是固定模板。使用 `ToeTopologyProfile`：
- toe count；
- hallux presence/orientation；
- digit segment counts；
- resting spread；
- grasp/contact capability。

雀形、鸽形、鹭形、鸡形等必须允许不同 profile。

## 8. 成长不是 global scale

`LifeStage` 至少允许：
- hatchling / nestling
- fledgling / juvenile
- subadult（适用时）
- adult

随阶段可变化：
- skull/body ratio；
- eye relative size；
- beak proportions；
- cervical proportions；
- wing bone and feather proportions；
- tail length；
- leg/tarsus proportions；
- feather tract maturity；
- plumage/color；
- flight capability；
- gait/perching capability。

仅有成年参考时，幼体字段保持 unknown，不允许把成年鸟整体缩小后标为幼鸟。

## 9. 动作求解顺序

`Behavior Intent → Target Pose → Skeleton Constraints → Tissue Carrier → Feather Layout/Overlap → Contact → Final Surface`

动作不得：
- 改骨长；
- 改父子关系；
- 改物种身份；
- 把翼或颈直接拉伸；
- 用表面变形替代足底/栖枝接触。

## 10. Clade Mother 的责任

Original Bird 只给共同接口，类群差异由 Clade Mother 承担。

首轮迁移考试：
1. Passerine / 家麻雀；
2. Columbid / 珠颈斑鸠；
3. Ardeid / 苍鹭；
4. Gull reference / 红嘴鸥相关参考（物种身份未锁定前不得写死 scientificName）。

若加入一个类群就必须改写 Original Bird 的骨架身份、坐标、羽毛附着合同或动作求解顺序，说明 Kernel 仍不稳定。
若只需替换比例、可变链长度、羽区参数、行为能力和 species delta，则迁移通过。

## 11. 当前项目可复用证据

可复用但不视为最终真值：
- R57 Bird Reconstruction Lab：权威表面重构/严格复原流程；
- AVES CVPR 2021：多物种可变形鸟类形态空间研究，可作为“共享模板 + species-specific shape”研究参考；
- 3D Bird Reconstruction ECCV 2020：关节化鸟模型/多视图重构研究参考；
- R17 珠颈斑鸠：连续体、Rig、羽层与 QA 的历史候选；
- R60 麻雀：现有候选和行为入口；
- R61-H4 苍鹭：已经从纯外形截面推进到固定长度 grouped cervical chain、胸带/胸廓 envelope，但仍不是逐椎骨标本复刻。

这些只能提供方法、候选参数和回归样本；用户未接受的视觉结果不能自动进入 Original Bird truth。

## 12. 权威资料边界

本轮使用的外部知识来源包括：
- Cornell Lab Bird Academy：羽毛类型、翼羽分区、primaries/secondaries/coverts；
- Smithsonian / Science 2020：飞羽重叠、滑移与连续变形翼；
- Oxford / Integrative Organismal Biology 2026：鹭类与蛇鹈类颈椎比较形态；
- AVES (CVPR 2021)；
- 3D Bird Reconstruction (ECCV 2020)。

只引用知识，不把受版权限制的图像复制进生产资产。

## 13. 下一步唯一任务

不做新鸟外观。

下一步只建立 `OriginalBirdReferenceMeasurement`：
- 把现有麻雀、斑鸠、苍鹭、红嘴鸥相关模型/工作台逐项登记；
- 对可读取模型记录 bbox、姿态、mesh 数、骨架、动画、材料、尺度状态、哈希；
- 建立同一套固定测量字段；
- 先确认哪些数据能支持 Kernel，哪些只是 species delta；
- 输出迁移差异矩阵。

在这一步完成前，不再产出新的“漂亮鸟”或群飞工作台。
