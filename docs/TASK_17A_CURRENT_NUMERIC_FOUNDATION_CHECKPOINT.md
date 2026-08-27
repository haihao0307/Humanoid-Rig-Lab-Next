# Task 17A 当前数值基础检查点

日期：2026-08-27

分支：`feature/human-core-v5-natural-motion-execution-v1`

基线提交：`be40c0197d91957fbc89c5cbf4aac95d231d3853`

## 检查点目的

此检查点只保存 Task 17A 第一阶段已经完成的数值执行基础，作为进入“语义指令编译器 + 自然步态修正”前的可追溯父提交。它不是视觉验收，也不代表生产就绪。

## 已保存的数值基础

- 11 个确定性场景全部通过数值门禁，共记录 2868 帧，采样率为 30 FPS。
- 最大骨长误差为 `3.885780586188048e-16`。
- 最终位置误差、朝向误差和转向 yaw 误差均为 `0`。
- 支撑脚最大滑移与平均滑移均为 `0`。
- 11 个场景均通过接触、转向、步行、停止收束与平衡门禁；`fallDetected=false`。
- 有限开发语法已经能够生成 BehaviorPlan；两种等价指令得到等价计划与等价执行结果。
- 权威执行链已经建立：`BehaviorCommand -> BehaviorPlan -> MotionIntent -> desiredPose -> contact and balance -> joint limits -> fixed bone lengths -> finalPose -> Renderer`。

## 已知限制与用户视觉反馈

- 当前文本入口只覆盖有限开发语法，不构成一般自然语言理解。
- 用户已经确认当前走路的左右手臂摆动方向错误；已有相关性数值不能替代基于 `finalPose` 独立 FK 的世界空间验证。
- 当前指令差异产生的动作效果有限，尚不足以证明语义组合能够稳定地产生显著不同的动作结果。
- 因上述可见问题，自然动作视觉结论记为 `FAIL`；第一阶段数值通过不能覆盖该失败。
- 浏览器视频、关键帧、接触表和用户主观观感证据尚未生成，由用户后续亲自操作浏览器采集。

## 验收状态

- `visualAcceptance = false`
- `productionReady = false`
- `userVisualAcceptance = pending`
- 当前总体结论：`INCONCLUSIVE`。数值执行基础可保存，但自然语言语义覆盖与自然步态均需第二阶段修正，正式视觉证据仍待用户补充。

## 冻结边界

本检查点不修改 BodyDNA、HumanRigCore、joint IDs、mesh、skin weights、inverse bind matrices、SurfaceCarrierV2、Native Surface、BUILD_MANIFEST，也不修改 Task 15B、Task 16A 或 Pilot D 的已冻结实现与证据。
