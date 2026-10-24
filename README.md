# 身体三维工作页 · R21

本机三维入口：[原数据对照](http://127.0.0.1:8914/) · [完整参数与动作](http://127.0.0.1:8914/workbench)。也可以离线打开 delivery 下的两个 R21 HTML；不需要联网下载人物或皮肤资产。

R21 优先纠正来源复刻：恢复原人物默认值，隔离 R18–R20 的估算改形；新建保留原表面、开口、法线和首交的固定状态对照，接回原肤色、固定坐标微表面、干湿分布及原 GGX 反射公式。以实际三维网页交付，不制作截图画廊。拖动旋转，滚轮缩放，Shift 拖动平移，对照页双击身体可查看局部。

**整个重构仍未完成。** 对照页有九个原版固定状态，仍保留来源分面分区信息，不是自主母体，也尚未接入连续参数。完整参数工作页保留 1916 项目录、965 项身体控制、34 对左右联动、两套动作驱动及完整人物档案，但它的旧隐式表面仍未通过来源复刻验收。完整原光照、环境、散射、头身整合及所有动作组合也未完成。详见[当前能力、证据与剩余任务](docs/SOURCE-FIDELITY-R21.md)。

运行时直接求交数学函数，没有人物网格显示。来源对照的分区信息及形态/绑定来源依赖均如实保留；不能因运行正确、压缩或更换数据形式而声称来源独立。R17–R20 文件保留对照和回退。共享 R15 和独立头部板块不修改。

## 构建与检查

- `node tools/build.cjs`：构建当前对照页和完整参数工作页，更新三个 BUILD 清单。
- `node tools/preview-body.cjs`：在本机 8914 端口打开当前三维入口。
- `node tools/check-release-r21.cjs`：核对构建、全部压缩函数数组、来源标记和交付文件。
- `node tools/qa-fidelity-workbench-r21.cjs`：实际无窗口浏览器检查批量参数、两套驱动、真实人物保存/重复载入、旧字段及失败回退。
- `node tools/qa-field-cache-r21.cjs`：将完整函数场与缓存前版本逐数组比较，再验证传输后无损恢复、元数据和缓存容量。
- `node tools/qa-source-atlas-viewer-r21.cjs`、`qa-source-profiles-r21.cjs`、`qa-source-precision-r21.cjs`、`qa-source-albedo-r21.cjs`、`qa-source-skin-r21.cjs`：实际三维显示与来源对照。
- `node tools/qa-source-coverage-r21.cjs`：独立重建每个来源分区的覆盖域，检查面积、边界及源平面。

浏览器检查使用本机 Chrome 与 Playwright，均在无窗口浏览器内执行，不操作桌面鼠标。涉及来源对照的检查另需本机 qa/fidelity-r21/offline 冻结资料；它包含原几何及大型中间数据，只用于离线核对，不进入在线运行包。最终函数包和已有汇总证据随仓库保留；不能在缺少原资料时重新声称完成来源验收。普通构建只需仓库内文件和 Node.js。

当前清单为 BUILD.json、BUILD-SOURCE-R21.json、BUILD-R21.json、DELIVERY.json，本轮记录在 TASK_ANCHOR.json。研究失败候选见 src/research/r21/README.md，其中列明了一次性迁移脚本，不是日常构建入口。

GitHub 同步到 haihao0307/Humanoid-Rig-Lab-Next 的 body/reconstruction-r18-20261023 独立分支。源代码同步与公网网站部署是两件事；本项目当前提供本机和离线三维网页，未部署公网成品。
