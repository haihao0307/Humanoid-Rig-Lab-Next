# 动画系统模块工作包

基线版本：`0.5.0`

建议分支：`work/animation`

本轮目标：建立时间轴、关键帧、局部四元数轨道、插值、循环、片段、事件和 PoseSnapshot 引用协议。

## 开始步骤

1. 阅读 `MODULE_SCOPE.json`。
2. 阅读 `docs/MODULE_BOUNDARIES.md` 和 `docs/DATA_CONTRACTS.md`。
3. 运行 `npm test`，记录基线。
4. 只修改 `writablePaths` 中的文件。
5. 再次运行 `npm test`。
6. 将实际修改文件打包为 `animation-patch-v001.zip`。
7. 完成根目录 `HANDOFF.md`。

## 强制边界

共享协议和其他模块保持只读。需要共享协议变化时，在 HANDOFF 中提出，由总控窗口统一修改。
