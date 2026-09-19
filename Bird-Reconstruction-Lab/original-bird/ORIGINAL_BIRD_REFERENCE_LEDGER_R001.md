# Original Bird Reference Ledger R0.01

日期：2026-09-20
状态：reference recovery in progress

## 已确认可读取

### 1. R17 珠颈斑鸠工作台
- 文件：BIRD_R17_WORKBENCH_2026-09-09.html
- 类型：程序化候选工作台，不是用户原始 GLB
- 用途：连续体、Rig、羽层、动作和固定 QA 的历史参考
- 风险：不可把其共享/候选比例当 Original Bird 真值

### 2. Bird Species Registry
- 文件：BIRD_SPECIES_REGISTRY.json
- 已登记：Passer domesticus（active candidate）
- 保留：Spilopelia chinensis（preserved_not_overwritten）
- 用途：物种身份与运行入口登记

### 3. R61-H1 苍鹭
- 文件：BIRD_R61_H1_GREY_HERON.html / QA
- 类型：照片约束 + 参数截面 + 程序化候选
- 关键边界：referenceSurfaceMeasured=false / speciesScanImported=false
- 用途：鹭形类群差异、长颈/长腿、独立工作台门禁

### 4. R61-H4 苍鹭
- 文件：BIRD_R61_H4_QA.json
- 类型：后续结构候选
- 已推进：固定长度 grouped cervical controls；sternum/pelvis catalogue bounds；coracoid/scapula/shoulder frame；thoracic/pectoral envelope
- 关键边界：controlsAreLiteralVertebrae=false；fullBodyScanImported=false；visualAcceptance=false
- 用途：Original Bird 胸带、颈链、真值边界的反例/候选

### 5. R57 Authoritative Reconstruction
- GitHub 分支：experiment/bird-r57-authoritative-reference-reconstruction-v1
- 研究参考：AVES CVPR 2021 / 3D Bird Reconstruction ECCV 2020
- 用途：参考模型审计、参数化重构和严格复原流程

## 当前没有重新定位到的内容

目前 File Library 的文本/文件搜索没有重新定位出用户早先上传的全部原始 Bird GLB 本体。
因此以下状态保持 unknown，不得假称“都还在”：
- 原始 GLB 文件名全集
- 每个原始模型的 SHA-256
- 每个模型的许可
- 每个模型的物种、年龄、性别、真实尺度
- 是否包含 skeleton / skin / animation / morph
- 红嘴鸥参考的精确 species identity

如果原始文件藏在旧 FULL_PROJECT ZIP 内，则下一步先恢复 ZIP/manifest，再做测量；不能让用户重新讲一遍物种要求来替代检索。

## Original Bird Measurement Fields

每个可读取参考统一登记：
- referenceId
- sourceFilename
- sha256
- sourceType: glb / obj / html-candidate / scan / image / video
- taxonomyStatus
- scientificName
- sexStatus
- ageStatus
- realScaleStatus
- bbox
- meshCount
- vertexCount
- triangleCount
- materialCount
- textureCount
- skeletonPresent
- jointCount
- skinPresent
- animationPresent
- animationClipCount
- morphTargetsPresent
- coordinateFrameStatus
- wingBoneEvidence
- cervicalEvidence
- pectoralGirdleEvidence
- legToeEvidence
- featherRegionEvidence
- usableForKernel[]
- speciesDeltaOnly[]
- unknown[]
- licenseBoundary
- visualAcceptance
- userAccepted

## 迁移考试

Original Bird R0 首轮必须至少接受四种差异很大的参考：
1. passerine / 家麻雀
2. columbid / 珠颈斑鸠
3. ardeid / 苍鹭
4. gull reference / 红嘴鸥相关参考（identity 未锁前保持 unresolved）

通过标准不是“四种都长得像鸟”，而是四种都能使用同一结构语义和附着合同，同时用不同 Clade/Species 参数表达差异。
