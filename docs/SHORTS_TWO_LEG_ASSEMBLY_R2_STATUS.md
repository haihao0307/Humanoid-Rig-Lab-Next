# 亚麻短裤两裤筒装配 R2 状态

更新时间：2026-09-19

分支：`fix/shorts-two-leg-assembly-r2-20260919`

## R2.1 已完成

- 已冻结详细路线：`docs/SHORTS_TWO_LEG_ASSEMBLY_R2_PLAN.md`。
- 新增源裁片合同：`clothing/ShortsGarmentContract.js`。
- 新增合同测试：`tools/test-shorts-garment-contract.mjs`。
- 九块原始裁片已具有明确的左腿、右腿、裆桥和腰头身份。
- 19 条接缝已转成有向材料边界关系，并检查端点、平衡剪口、局部送料比和阶段归属。
- 新的装配阶段固定为：左右裤筒分别形成并通过中间门禁，再连接前裆、后裆、独立裆补片和腰头。
- 自动工作流 `Shorts two-leg R2 audit` 第 3 次运行成功。
- 源码装配与文件审计通过；短裤专项测试 `163/163` 通过，其中新增合同测试 7 项。

## 验收边界

上述结果只证明源纸样和装配关系现在能够被机器严格检查。它没有运行新的完整布料装配，没有证明身体适配、裆部无穿插或两裤腿视觉正确。

当前状态保持：

```text
sourceContract = true
assemblyValidated = false
visualAcceptance = false
motionValidated = false
productionReady = false
```

没有合格成衣截图，不合并到原短裤分支或 `main`。

## 下一批 R2.2

在最终人物姿势上建立骨盆局部坐标与身体分区：`left_leg`、`right_leg`、`pelvis_front`、`pelvis_back`、`crotch_bridge`。先输出九块刚性原布的固定视角证据，不启用缝合；只有左右与前后摆放全部正确，才进入独立裤筒缝制。
