# 亚麻短裤 R2.3b 双裤筒阶段进度

日期：2026-09-20

分支：`fix/shorts-two-leg-assembly-r2-20260919`

通过浏览器门禁的源码提交：`cbedce869a540b70fe8ae3d874255208c7d1d176`

## 阶段目标

本阶段在已经通过的左裤筒基础上，使用原始 `FR + BR` 裁片形成右裤筒，并对左右两只裤筒执行中间门禁。

本阶段只闭合四条真实源接缝：

- `outseam-left`
- `inseam-left`
- `outseam-right`
- `inseam-right`

`center-front`、`center-back`、独立裆补片 `G` 的四条边、左侧开口、四段腰头以及腰头环仍保持未缝状态。因此这一阶段证明的是两只独立裤筒已经形成，不是完整短裤验收。

## 实际实现

1. 读取最终人物姿势的骨盆局部坐标和左右实测大腿中心。
2. 将 `FL/BL/FR/BR` 各材料行按原纸样弧长分别围绕左右大腿建立椭圆截面，不修改源 UV、三角拓扑、质量、边界或人物骨架。
3. 左右裤筒只合并各自真实的内侧缝和外侧缝空间自由度；左右两腿之间不存在共享 stitch DOF。
4. 在前后裆仍敞开的作者态，为完整材料行施加同量横向平移，使两只开放裤筒保留至少 12 mm 工作间隙；该平移不改变纸样尺度和已闭合缝端点关系。
5. 布—布连续碰撞只作用于当前活动的 `FL/BL/FR/BR`。未安装的 `G` 和四段腰头保持锁定，且不作为不可见碰撞障碍。
6. 身体接触同样只审查四块活动主裤片。
7. 对两个裤脚环分别检查闭合、面积、左右归属、独立自由度和严格跨腿三角面交会。

## 发现并修复的问题

第一轮真实浏览器审查中，左右裤筒均已形成，但后裆内侧出现一处 `BL ↔ BR` 严格布面交会。该结果没有被标记为通过。

随后增加活动主裤片的连续和离散布—布碰撞域，同时排除尚未安装的裆补片与腰头。重新松弛后，严格跨腿三角面交会降为 0，浏览器门禁通过。

另外，早期单元测试曾在“无人体、无支撑、无自碰撞”的情况下释放软布，再要求裤脚椭圆永久保持张开。该条件在物理上不成立：自由软布会塌扁。测试已拆分为：

- 单元测试负责源裁片身份、真实针脚、裤脚拓扑和左右自由度；
- 真实浏览器负责人体支撑下的松弛、布—布接触、布—身接触和视觉截图。

## 实际浏览器结果

```text
actualBrowser = true
assemblyState = dual-tube-ready
dualTubeValid = true
closedSeamIds = outseam-left, inseam-left, outseam-right, inseam-right

leftCuff.pointCount = 16
leftCuff.projectedAreaM2 = 0.02193454841128926
leftCuff.closureGapM = 0

rightCuff.pointCount = 16
rightCuff.projectedAreaM2 = 0.02532845762620121
rightCuff.closureGapM = 0

cuffsValid = true
leftRightOwnership = true
independentLegDofs = true
strictCrossTubeIntersectionFree = true
strictCrossTube.detected = 0
maximumPrincipalStrain = 0.02327456743854117
relaxationSteps = 16
bodyContactValidated = true
materialWithinCheckpoint = true
browserErrors = 0
```

GitHub Actions：

```text
workflow: Shorts R2.3b dual-tube review
run id: 35501232268
job id: 106053234234
artifact id: 10602482331
artifact: shorts-r2-3-dual-tube-progress
```

证据文件：

```text
01-angle.png
02-front.png
03-back.png
04-left-side.png
05-right-side.png
06-both-cuffs-below.png
07-crotch-below.png
08-mobile-front.png
dual-tube-report.json
review-status.json
browser-errors.json
build-and-test.log
```

## 人工视觉审查

通过本阶段的部分：

- 蓝色 `FL/BL` 已形成左裤筒，橙红色 `FR/BR` 已形成右裤筒。
- 两只裤脚分别围绕对应大腿，裤脚环独立、闭合且面积为正。
- 正面、背面和两侧视图中没有出现左右裤腿互换或整片跨到另一条腿的情况。
- 下视图可看见两个独立裤脚开口。
- 后裆第一轮发现的 `BL ↔ BR` 交会已消除。

尚未通过的部分：

- 前裆与后裆仍敞开，所以两只裤筒上方尚未成为一个短裤主体。
- 绿色独立裆补片 `G` 仍处于工作区，没有连接四条有向边。
- 四段腰头仍悬置，没有连接到主裤片，也没有闭合腰头环。
- 左侧穿脱开口仍未关闭。
- 当前使用裁片身份调试色，不是最终统一亚麻外观。
- 尚未进行整裤静态视觉、步行、下蹲、坐下和起身验收。

## 当前验收状态

```text
sourceContract = true
rigidPlacementValidated = true
leftTubeCheckpoint = true
rightTubeCheckpoint = true
dualTubeGate = true
centerRiseConnected = false
gussetConnected = false
waistbandConnected = false
assemblyValidated = false
visualAcceptance = false
motionValidated = false
productionReady = false
```

## 下一阶段

R2.4 连接 `center-front` 与 `center-back`，将两只独立裤筒合成为短裤主体。该阶段仍不连接 `G` 或腰头，并继续检查：

1. 左右裤脚保持独立；
2. 中心前后缝完全闭合；
3. 前后裆方向正确；
4. 不出现布面翻转、跨腿交会或身体穿透；
5. 材料应变保持在阶段阈值内。

R2.4 通过后，依次进入独立裆补片、腰头与侧开口、完整静态视觉以及人物动作验收。
