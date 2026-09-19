# Original Bird R0.01｜四类群迁移差异矩阵

本表不是物种平均值。用途是验证 Original Bird Kernel 是否足够稳定，同时把类群差异留在 Clade Mother / Species Delta。

| 模块 | Original Bird Kernel 固定语义 | 家麻雀 / Passerine | 珠颈斑鸠 / Columbid | 苍鹭 / Ardeid | 红嘴鸥候选 / Larid |
|---|---|---|---|---|---|
| 身体坐标 | cranial/caudal, dorsal/ventral, lateral | 共用 | 共用 | 共用 | 共用 |
| 中轴 | thorax-pelvis-tail/head connection | 共用 | 共用 | 共用，但颈链尺度显著变化 | 共用 |
| 颈链 | variable cervicalChain[] | 短、紧凑 | 中等 | 长且必须允许类群专门化 | 中等 |
| 胸带 | sternum/keel + coracoid + scapula + furcula | 共用 | 共用 | 共用，H4 已开始独立约束 | 共用 |
| 翼骨 | humerus-ulna/radius-wrist-carpometacarpus-digits | 共用 | 共用 | 共用 | 共用 |
| 飞羽附着 | primaries→manus；secondaries→ulna；coverts 覆盖连接区 | 数量/比例为 species delta | 数量/比例为 species delta | 数量/比例为 species delta | 长翼比例为 clade/species delta |
| 腿足 | hip-femur-tibiotarsus-tarsometatarsus-digit chains | anisodactyl 参数候选 | 独立 columbid profile | 长腿/涉水结构不能继承雀形参数 | larid profile 待原模型 |
| 头/喙 | skull + upper/lower beak + jaw/contact | 短厚锥形喙 | 鸠鸽类喙比例 | 长直捕食喙 | 细尖红喙候选 |
| 生命周期 | LifeStage 改比例/羽区/能力，不做 global scale | 必须独立资料 | 必须独立资料 | 必须独立资料 | 必须独立资料 |
| 地面策略 | behavior interface only | hop 为候选 species policy | walk 为独立 policy | long-leg alternating gait | walk/swim/shore behavior 待证据 |
| 飞行策略 | shared flight state interface | 高频振翼 | 独立鸠类节奏 | 起飞/飞行时颈部姿态专门化 | gull flight / glide profile 待测 |
| 当前可信度 | — | 程序候选 + 长度/翼展外部交叉核对 | R17 程序候选；R57 真实物种表面已定位未取回 | H4 证据约束候选，无整身 scan | 外部 taxonomy/biometric 候选；用户模型未恢复 |

## Kernel 通过条件

1. 四类群都不需要改写骨架**语义身份**、坐标系统、羽毛附着合同和动作求解顺序。
2. 类群差异可通过：
   - 可变链长度；
   - 骨段比例；
   - ToeTopologyProfile；
   - FeatherRegionProfile；
   - CladeMotionProfile；
   - Species Delta
   表达。
3. 如果必须把苍鹭的长颈“焊”到雀形身体、把鸥翼当缩放雀翼、或者为每种鸟重写一套互不兼容坐标，则 Original Bird Kernel 判 FAIL。
4. 所有旧候选的 visualAcceptance=false 保持不变；本矩阵不能将旧视觉结果升级为用户已接受。

## 当前最重要的三个缺口

- 用户以前上传的原始 Bird GLB/ZIP 本体尚未全部重新定位；
- R57 MooreLab 珠颈斑鸠精确 glTF 仍未完成 authenticated archive acquisition；
- gull 类群的用户原模型身份、尺度、骨架和材质信息仍是 unknown。

在三个缺口没有补齐前，可以继续完善测量工具和 Kernel，不允许用新造外观模型填补证据空白。
