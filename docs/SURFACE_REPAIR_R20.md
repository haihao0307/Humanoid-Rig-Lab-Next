# R20：按曲面误差位置修复显示三角形

2026-09-12。针对 R19 查出的曲面采样不足、狭长三角形和几何/着色方向失配，修改显示采样算法。此轮按用户要求只做文件验证。

## 本轮修改

1. **优化初始狭长三角形。** 新增 `reconstruction/trim-quality.mjs`。对 body、left、collar 的裁剪三角形进行最多三轮内部边交换；只有两个面组成严格凸四边形、目标对角线不存在、交换后最差三角形质量改善时才接受。每轮每个面最多参与一次交换。不移动任何 UV/源边界点，不交换开边或非流形边。优化发生在恢复所有裁剪边界节点之后。
2. **直接采样三角形内部偏差。** 当中心位置误差超过阈值，且不小于最差边误差的 80%，使用曲面函数给出的中心点将该面分成三个面。共享边保持原样；内部点使用统一顶点注册表。三子面消耗两个细分预算单位，预算不足时仍可选择一次边细分。此前只切最长边，可能持续细分准确的边界而没有覆盖内部突起。
3. **边细分跟随误差。** 优先选择位置或着色插值误差尚未达标的边；没有这类边时继续采用最长边。共享边仍通过 `topology.split` 登记，保留最终一致补分流程。
4. **检测几何面与曲面着色方向的不一致。** 即使插值法线变化不大，只要面方向与中心方向的无向夹角超过阈值，也纳入细分优先级。阈值至少 20°，并有最小边长保护。没有将“法线存在”当作“方向正确”。
5. **利用未用完的片预算。** 当前片未使用的预算顺序传给后续片，不占用后续片的原始配额；左腿曲面可将剩余额度传入后续径向片。组预算、递归深度和全局顶点/三角形/分裂保护不变，并在组末校验实际细分没有超额。此机制不能回头补充前面已经结束的困难曲面。

`body/CompactWorkbench.js` 仅更新加载修订号为 `r20-surface-error-located`。人体参数包、曲面生成核、皮肤材质、头发、骨架绑定和动作源码未由本轮修改。`index.html` 按现有源码重新装配，会包含当前工作区其他任务已有的改动。

新增组报告字段：`displayRefinement`、`trimQualityFlips`、`interiorRefinementSplits`、`errorDirectedEdgeSplits`、`geometricNormalRefinements`、`reusedChartBudget`、`unusedRefinementBudget`。它们是下次实际生成时才会产生的观测值，本轮没有填入模拟结果。

## 方法依据

- [PBRT：Subdivision Surfaces](https://pbr-book.org/3ed-2018/Shapes/Subdivision_Surfaces)：曲面显示需要合理细分和切向/法线信息，统一细分量会同时造成局部不足与过量。
- [PBRT：Exercises](https://www.pbr-book.org/3ed-2018/Shapes/Exercises)：用面方向变化辅助决定局部细分。
- [CGAL：Meshing and Remeshing](https://cgal.geometryfactory.com/CGAL/doc/main/PMP_Remeshing/index.html)：区分受约束边界与内部重网格操作。

这里实现的是有限、局部的三角形改进，不是引入完整 CGAL 重网格，也没有声称获得 Delaunay、光滑曲面或封闭流形证明。

## 文件验证结果

- `node tools/build-pure.mjs`：通过；装配时未运行应用。
- 生成模块语法解析、局部差异空白检查：通过。
- 单独运行重建文件审查：通过 1,822 项；解析 15 个模块和 17 条模块依赖；其中表面连续性检查 685 项，新增细分文件约束 17 项。只解析源码和参数文件，不导入或执行几何生成函数。
- `node tools/check-pure.mjs`：全项目检查停在 `tools/check-r2-rig-motion.mjs:50` 的 `bounded weights with exact quantized normalization` 检查项。此检查仍寻找 `compactInfluences(p,rig,mask)`，当前绑定模块已包含额外的所有权约束处理。本轮未改写绑定源码或它的检查规则，避免影响并行工作。不能将局部通过描述为全项目通过。

## 验收范围

本轮没有运行网页、人物模拟、GPU 或生成网格的数值测试，没有新截图和新误差测量。R18 的误差/边计数不能作为 R20 的结果。

本轮修复显示采样的具体缺陷；没有更换分片高度函数，也没有建立跨片共同切平面。因此原曲面自身的坡度跳变、尚未定位的开边/非流形连接与自相交仍需后续针对性验证。保持 `precisionLimited` 的实际报告机制和 `visualAcceptance:false`，不将文件检查升级为“所有破碎面已经消失”的视觉结论。
