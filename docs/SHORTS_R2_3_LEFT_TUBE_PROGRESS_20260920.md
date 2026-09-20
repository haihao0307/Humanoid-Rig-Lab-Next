# 亚麻短裤 R2.3 左裤筒阶段进度

日期：2026-09-20

分支：`fix/shorts-two-leg-assembly-r2-20260919`

源码检查点：`031f575fd58351e8a0c0339a704136c99199ec4f`

## 阶段目标

本阶段只把原始 `FL` 左前片与 `BL` 左后片围绕实测左大腿形成一只真实裤筒，并闭合：

- `outseam-left`
- `inseam-left`

右侧 `FR/BR`、独立裆补片 `G` 和四段腰头全部保持未缝状态。该检查点用于隔离左右腿装配错误，不是完整短裤，也不是最终亚麻视觉验收。

## 实际实现

1. 读取最终人物姿势中的骨盆局部坐标和实测左大腿中心。
2. 将 `FL/BL` 的每一行按原纸样弧长绕到左大腿周围；不缩放原始二维纸样，不修改 UV、三角形、边界和质量。
3. 只把左外侧缝、左内侧缝的真实源针脚合并为空间自由度。
4. 右侧裁片、裆补片和腰头在本阶段使用可撤销作者态锁定，不参与求解。
5. 身体接触审查只统计本阶段活动的 `FL/BL` 三角面，避免未装配的右侧散片污染左裤筒门禁。
6. 完成 14 个松弛步并重新检查裤脚环、材料应变和人体接触。

## 实际浏览器报告

```text
actualBrowser = true
assemblyState = left-tube-ready
leftTubeValid = true
closedSeamIds = outseam-left, inseam-left
cuff.pointCount = 16
cuff.projectedAreaM2 = 0.025067979297479497
cuff.closureGapM = 0
maximumPrincipalStrain = 0.03236162495589889
relaxationSteps = 14
bodyContactValidated = true
bodyRequirementMet = true
materialWithinCheckpoint = true
rightPanelsUntouched = FR, BR
gussetUntouched = true
waistbandsUntouched = true
browserErrors = 0
```

实际证据制品：

```text
artifact id: 10587239873
artifact: shorts-r2-3-left-tube-progress
```

证据文件：

```text
01-angle.png
02-front.png
03-back.png
04-left-side.png
05-right-side.png
06-cuff-below.png
07-crotch-below.png
08-mobile-front.png
left-tube-report.json
review-status.json
browser-errors.json
```

## 人工视觉审查

通过本阶段的部分：

- 浅蓝 `FL` 与深蓝 `BL` 已包围左大腿，不再是两张完全分离的平面布片。
- 左外侧缝和左内侧缝均已闭合。
- 裤脚下视可见独立、面积为正的左裤脚开口，闭合缝隙为 0。
- 左裤筒没有绕到右腿，右侧裁片没有参与左裤筒成形。
- 当前最大主应变约 3.24%，低于本阶段 5% 门槛。

仍未通过的部分：

- 左裤筒上方的前裆、后裆和裆补片边界仍敞开，因此顶部仍呈散开的斜边；这不是最终裤裆形态。
- 右裤筒尚未形成，右侧仍显示为橙色和红色散片。
- 腰头尚未安装。
- 调试配色仍用于辨认裁片，尚未恢复最终统一亚麻外观。
- 尚未进行整裤布—布连续碰撞、完整静态视觉和人物动作验收。

## 当前验收状态

```text
sourceContract = true
rigidPlacementValidated = true
leftTubeCheckpoint = true
rightTubeCheckpoint = false
dualTubeGate = false
assemblyValidated = false
visualAcceptance = false
motionValidated = false
productionReady = false
```

## 下一步

R2.3b 使用相同规则形成 `FR + BR` 右裤筒，并对左右两只裤筒执行中间门禁：两个裤脚环独立、面积为正、左右归属正确、无严格布面交会、无身体穿透且材料应变在阶段阈值内。双裤筒门禁通过前不连接前裆、后裆、`G` 或腰头。
