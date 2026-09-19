# Original Bird Reference Ledger R0.01

日期：2026-09-20
状态：reference recovery in progress

## 已确认可读取

### 1. R17 珠颈斑鸠工作台
- 文件：BIRD_R17_WORKBENCH_2026-09-09.html
- 类型：程序化候选工作台，不是用户原始 GLB
- 用途：连续体、Rig、羽层、动作和固定 QA 的历史参考
- 风险：不可把其共享/候选比例当 Original Bird 真值

### 2. R17 Delivery Manifest 已恢复
- 文件：BIRD_R17_DELIVERY_MANIFEST_2026-09-09.json
- generator：spotted-dove-procedural@6.1-specimen-profile-r17
- 已确认完整重建包曾封版：
  - BIRD_R17_SPECIMEN_PROFILE_REBUILD_FULL_2026-09-09.zip
  - bytes：5,586,557
  - SHA-256：5940b3c8e41abb00fd0c972bb5f515937c5cfeb7c4cd8651042bdc9382337e7d
- 已确认 QA 包曾封版：
  - BIRD_R17_QA_EVIDENCE_2026-09-09.zip
  - bytes：3,631,892
  - SHA-256：5947ebafa9ef5d6e8420f690a98a66ae5a4e529768605bf223d975f797945de5
- source-lock 文件身份：
  - BIRD_R17_SOURCE_LOCK_2026-09-09.json
  - SHA-256：fafc2f4e58e8b1d175be43099626c78d4b3d0c39623f2137d2080457b131372c
- 当前边界：manifest 可读不等于 ZIP 本体已恢复；不能宣称包内所有原始参考当前可访问。

### 3. Bird Species Registry
- 文件：BIRD_SPECIES_REGISTRY.json
- 已登记：Passer domesticus（active candidate）
- 保留：Spilopelia chinensis（preserved_not_overwritten）
- 用途：物种身份与运行入口登记

### 4. R60-A0R2 / Birdkeeper V07 导入记录
- H1 中明确记录 sourcePackage：BIRDKEEPER_V07_FULL_PROJECT_2026-09-17.zip
- sourceVersion：0.7.0
- 精确导入模块：scene-species-shape.js / scene-species-material.js / scene-hop-pose.js
- 导入内容：species rest-shape deformation、species plumage shader、warm sparrow palette、synchronous ground-hop pose、species locomotion policy
- 排除内容：game economy / care / storage / shop / random events / scenery / camera/UI / absolute display scale
- 当前边界：只恢复到导入记录；File Library 搜索尚未重新定位 ZIP 本体或其完整 manifest。

### 5. R61-H1 苍鹭
- 文件：BIRD_R61_H1_GREY_HERON.html / QA
- 类型：照片约束 + 参数截面 + 程序化候选
- 关键边界：referenceSurfaceMeasured=false / speciesScanImported=false
- 用途：鹭形类群差异、长颈/长腿、独立工作台门禁

### 6. R61-H4 苍鹭
- 文件：BIRD_R61_H4_QA.json
- 类型：后续结构候选
- 已推进：固定长度 grouped cervical controls；sternum/pelvis catalogue bounds；coracoid/scapula/shoulder frame；thoracic/pectoral envelope
- 关键边界：controlsAreLiteralVertebrae=false；fullBodyScanImported=false；visualAcceptance=false
- 用途：Original Bird 胸带、颈链、真值边界的反例/候选

### 7. R57 Authoritative Reconstruction
- GitHub 分支：experiment/bird-r57-authoritative-reference-reconstruction-v1
- 研究参考：AVES CVPR 2021 / 3D Bird Reconstruction ECCV 2020
- 精确物种表面：MooreLab MLZ:Bird:65780 / Spilopelia chinensis 已定位
- 当前边界：精确物种 archive 仍未完成 authenticated acquisition
- 用途：参考模型审计、参数化重构和严格复原流程

## 当前没有重新定位到的内容

目前没有重新定位出用户早先上传的全部原始 Bird GLB 本体。
因此以下状态保持 unknown，不得假称“都还在”：
- 原始 GLB 文件名全集
- 每个原始模型的 SHA-256
- 每个模型的许可
- 每个模型的物种、年龄、性别、真实尺度
- 是否包含 skeleton / skin / animation / morph
- 红嘴鸥用户参考模型的精确 species identity

如果原始文件藏在旧 FULL_PROJECT ZIP 内，先用 package catalog 工具做只读盘点，再把其中 GLB/GLTF 逐个送入 reference measurement；不能让用户重新讲一遍物种要求来替代检索。

## Original Bird Measurement Fields

每个可读取参考统一登记：
- referenceId
- sourceFilename
- sha256
- sourceType: glb / gltf / obj / html-candidate / scan / image / video
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
4. gull reference / 红嘴鸥相关参考（用户模型 identity 未锁前保持 unresolved）

通过标准不是“四种都长得像鸟”，而是四种都能使用同一结构语义和附着合同，同时用不同 Clade/Species 参数表达差异。
