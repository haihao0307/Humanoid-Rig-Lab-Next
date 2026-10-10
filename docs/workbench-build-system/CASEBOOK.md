# V1.1 近期工作实践为主，较早制度为辅

返回[总入口](../../WORKBENCH_BUILD_SYSTEM.md)。当前取材窗口为2026-10-07至2026-10-10；依据用户本轮明确纠正，旧人物母本、鸟类、环境/地形等不再承担本轮核心方法的论证。

这里归纳的是近期目标、有效学习方式和已暴露的差距，**不是宣称这些工作台都已完成一比一或影视级验收**。旧报告不冒充本轮重跑。V1完整案例保留在[固定历史](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/a0cd098b4a0fcb8b5d5de90200acd0fb1051f543/docs/workbench-build-system/CASEBOOK.md)。

## 皮肤：先保住好效果，再研究它由哪些部分共同构成

已读[Emily迁移README](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/77976497de5dd957fba0fb1eb91918baf9bd46a8/skin-quality-lab/emily-transfer/README.md)和[迁移内核](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/77976497de5dd957fba0fb1eb91918baf9bd46a8/skin-quality-lab/emily-transfer/EmilyTransferKernel.js)。记录有原站配置审读、同模型同光同色的层开关和参数保存；同时明确未完整搬运XG，也不是逐像素相同。说明外观不能只归功于一个shader，资产、几何、光照和映射都需要拆开验证。

本轮新要求补上此前不足：可合法保留老师完整效果时先复刻保真，不要一开始用另一个低质量目标替换；后续再按任务迁移。已经做过迁移不等于原样复刻阶段自动通过。

## 皮革：先学成熟质感，再扩工艺、产品和受力

已读[R06记录](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/feature/leather-atelier-r06-takeover-20261009/leather-workshop/r06/README.md)，其观察blob固定在registry；近期PR32记录继续修复曲面与切边不同源导致的问题。可以借鉴的是：保留已有效的材质/针路基线，在独立候选加产品、参数和受力试样，分别记录真实实现范围。不能把展示针脚说成完整缝线物理，也不能把商业材质目标写成已取得其生产源码。

## 牛仔与布料：研究表达层级，不把着色假称实体结构

已读[R02来源表](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/370c0cfa4098d3027042e5c788f96371095f2518/denim-workshop/r02/SOURCES.md)及PR28/31/33记录。已读的内部织纹/过滤代码与仅取得公开摘要的商业研究分开。近期改进呈现从着色到连续纱线、裁口/损伤表达的学习过程，但未证明已经完整复刻Fibric或达到影视终稿。

方法提炼：一个老师不足以解决细节就主动找下一位；在几何、材质和工艺间选择有依据的表达，保持近中远质量，不能为了“精炼”丢掉决定外观的结构。

## 裁缝：执行端掌握参数，用户审核真实成衣与搭配

已读[学习复核记录](https://github.com/haihao0307/guilin-dem-pipeline/blob/a704386453f7fc10f34a3023bdcbd023d1236c7c/.github/reports/patterngsl-learning-20261009.md)及PR177–181记录。真实纸样、编辑、重新网格化和缝合是同一条需要贯通的链；字段有效条件、裁片语义和完整边界会决定结果是否正确。三维选款预览与真实求解状态不能混称。

当前方向不是让用户理解122个字段，而是执行端把它们映射成可用配方、合适变体和搭配，主动验证与解决失败。数量不是质量；对缺陷的定位和实现责任不能转回用户。

## 眼睛：拆解不应破坏原来的整体关系

已读[ET08-S1.1记录](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/0bad13ebd459ef9c2ef29f06dd35da6807c844b4/skin-quality-lab/emily-transfer/ET08_S11_DELIVERY.md)。只看自由睑缘不能判断整片闭眼表面；复刻后解析参数也必须保留完整组织、接触和恢复关系。缺同人物真实睁眼资料时不称精确身份恢复。

## 鞋履：先静态保真，按当前任务决定物理何时加入

已读[固定源码README](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/043ee50c0956dd2150913e77497ff219f37f98f7/shoe-workshop/r01/README.md)。它在该时点明确NOT DELIVERED，不能把工作意图当作完成。用户本轮重申先复刻后解析的整体方法；鞋履近期要求先做好静态，再逐步加入后续能力，不能用通用阶段表擅自改优先级。

## 本轮证据层级

本轮重新读取方法论主入口、接手规则和上述Emily README，并结合前一轮已读的近期固定文件与当前用户指令修订；没有重跑这些工作台的浏览器/物理，没有把检索到的其他对话摘要当成独立视觉验收。用户本轮原话是本次顺序与分工修订的直接依据；案例用于解释和约束，不用于虚构全面成功。
