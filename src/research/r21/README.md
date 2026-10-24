# 未采用研究候选

这些候选不进入默认构建。保留失败结果，不能当作迁移完成。

- `BodyHermiteR21.js`：带位置/法线约束的核插值。约束点不能代表点间等价，手足仍有偏差。
- `BodyCardinalR21.js`：cardinal 修正同样未通过点间与法线检查。
- `BodySourcePositionsR21.js`：精确插值源采样位置，点间仍不等于原表面。
- `BodyRayPackedCandidateR21.js`、`BodyRayIntervalsR21.glsl`：区间/立方求交和打包实验。出现漏交或着色器启动超时；参数工作页已回退到可靠的旧求交器，仍如实标记其表面未验收。

`tools/prepare-fidelity-r21.cjs`、`install-intervals-r21.cjs`、`pack-field-textures-r21.cjs`、`simplify-ray-traversal-r21.cjs`、`add-ray-probe-r21.cjs`、`atomic-archives-r21.cjs` 和各 `enable-*-r21.cjs` 是本轮一次性编辑迁移记录，不是日常构建或检查入口。不要对当前源码重复运行这些脚本；它们使用当时源码标记，部分会覆盖候选。日常构建只运行根目录 README 的入口。

拟合脚本和来源对照工具依赖本机 `qa/fidelity-r21/offline/` 中的冻结来源。该目录包含离线原几何及大型中间数据，不进入在线运行包。在线提供汇总报告与最终函数包；没有离线来源时不能重新声称完成来源验收。
