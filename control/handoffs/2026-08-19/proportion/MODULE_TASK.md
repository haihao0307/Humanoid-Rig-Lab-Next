# 骨骼比例模块工作包

基线版本：`0.5.0`

建议分支：`work/proportion`

本轮目标：验证八项比例参数真正驱动三维绑定骨架，保持固定骨骼 ID、左右镜像、隐藏锁骨控制点，并生成明确的重新绑定边界。

## 开始步骤

1. 阅读 `MODULE_SCOPE.json`。
2. 阅读 `docs/MODULE_BOUNDARIES.md` 和 `docs/DATA_CONTRACTS.md`。
3. 运行 `npm test`，记录基线。
4. 只修改 `writablePaths` 中的文件。
5. 再次运行 `npm test`。
6. 将实际修改文件打包为 `proportion-patch-v001.zip`。
7. 完成根目录 `HANDOFF.md`。

## 强制边界

共享协议和其他模块保持只读。需要共享协议变化时，在 HANDOFF 中提出，由总控窗口统一修改。
