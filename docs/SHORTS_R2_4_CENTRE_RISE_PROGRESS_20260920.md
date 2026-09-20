# 亚麻短裤 R2.4 前后裆中心缝阶段进度

日期：2026-09-20

分支：`fix/shorts-two-leg-assembly-r2-20260919`

通过构建、专项测试与真实浏览器门禁的源码提交：`c595390448b7c307ebf1fcd26566bd947411c319`

## 阶段目标

R2.4 在已经通过的 R2.3b 左右双裤筒基础上，连接两条原始中心缝：

- `center-front`
- `center-back`

本阶段同时继续保留四条已完成裤腿接缝：

- `outseam-left`
- `inseam-left`
- `outseam-right`
- `inseam-right`

本阶段明确不连接：

- 独立裆补片 `G` 的四条边；
- 左侧穿脱开口 `side-opening-left`；
- 四段主裤片到腰头的连接；
- 四段腰头环连接。

因此，R2.4 证明的是“两只独立裤筒已通过前后中心缝形成一个短裤主体”，并不等于完整短裤验收。

## 实际实现

1. 读取当前人物最终姿势的骨盆局部坐标系与真实身体测量。
2. 延续 R2.3b 双裤筒状态，不重新建立人物、骨架或裁片。
3. 将裆线以上 `FL / FR / BR / BL` 四块主裤片的同一材料行，按各自原始纸样弧长依次放到同一骨盆椭圆包络上。
4. 环向顺序固定为：前中心 → 右前片 → 右后片 → 后中心 → 左后片 → 左侧开口 → 左前片 → 前中心。
5. `center-front` 与 `center-back` 只合并真实源针脚对应的空间自由度。
6. 左侧开口仍保持未启动状态；它只与已经完成的左外侧缝共享一个真实缝端交点。
7. 独立裆补片和四段腰头保持锁定工作片，不参与本阶段布—布碰撞，也不作为不可见障碍。
8. 布—布连续碰撞、离散自碰撞和布—身体接触，只作用于四块活动主裤片。
9. 源 UV、三角拓扑、质量、纸样边界、人物比例和 Human rig 均未修改。

## 测试中发现并纠正的问题

第一轮测试错误地要求未启动的左侧开口与其他任何缝都不能共享自由度。实际纸样中，`side-opening-left` 与已经完成的 `outseam-left` 在开口末端共用一个真实缝端点。测试已经改为：

- 左侧开口所有针脚保持 `started = false`；
- 只允许唯一的开口端点与真实左外侧缝端点重合；
- 开口其余针脚不得提前闭合。

第二轮失败来自 Node VM 上下文中的空数组原型差异。数组内容实际为空，但 `deepStrictEqual` 因跨上下文原型不同而误报。该检查已改为明确比较针脚数量，不改变任何缝合门禁。

## 真实浏览器结果

```text
actualBrowser = true
assemblyState = rise-ready
riseValid = true
topologyGate = true

closedSeamIds:
  outseam-left
  inseam-left
  outseam-right
  inseam-right
  center-front
  center-back

centerFront.pairCount = 8
centerFront.maximumGapM = 0
centerFront.maximumLateralOffsetM = 0.016692122493200675

centerBack.pairCount = 8
centerBack.maximumGapM = 0
centerBack.maximumLateralOffsetM = 0.009577430839084716

leftCuff.projectedAreaM2 = 0.02651524675489017
leftCuff.closureGapM = 0

rightCuff.projectedAreaM2 = 0.024237836418088486
rightCuff.closureGapM = 0

cuffsValid = true
expectedCrossSideDofs = true
strictUnexpectedIntersectionFree = true
strictUnexpectedIntersections.detected = 0
strictUnexpectedIntersections.checkedCandidatePairs = 196

maximumPrincipalStrain = 0.04959485666227348
relaxationSteps = 35
bodyContactValidated = true
selfContactValidated = true
materialWithinCheckpoint = true
browserErrors = 0
```

工作流证据：

```text
workflow: Shorts R2.4 centre-rise review
run id: 35502420412
job id: 106056448547
artifact id: 10602662555
artifact: shorts-r2-4-centre-rise-progress
```

证据文件：

```text
01-angle.png
02-front.png
03-back.png
04-left-side.png
05-right-side.png
06-front-rise-close.png
07-back-rise-close.png
08-crotch-below.png
09-mobile-front.png
rise-report.json
review-status.json
browser-errors.json
build-and-test.log
```

## 人工视觉审查

本阶段通过的部分：

- 前中心缝已经由腰部连续到裆部开口上缘，左右前片不再是两只彼此分离的裤筒。
- 后中心缝已经连续连接，左右后片方向正确，没有互换。
- 两个裤脚仍为独立、闭合且面积为正的开口。
- 正面、背面、侧面和下视角均未发现活动主裤片的严格三角面交叉。
- 身体接触门禁通过，没有被数值门禁遗漏的人体穿透。
- 390 × 844 手机视口可以显示本阶段形态。

当前仍可见、但属于后续未完成结构的部分：

- 左侧腰胯处存在张开的布片边缘，因为 `side-opening-left` 仍保持穿脱开口；不能将它误判为已经闭合的侧缝。
- 前后裆下端仍出现缺口和折角，因为独立裆补片 `G` 尚未连接。
- 四段腰头仍悬置在人物周围。
- 当前蓝、橙、红色为裁片身份审查色，不是最终统一亚麻材质。
- 主裤片网格仍是源纸样的低分辨率结构，当前阶段不代表最终曲面细化和视觉验收。

## 重要风险

本轮最大主应变为：

```text
4.959485666%
```

阶段限制为 5%，因此数值上通过，但只剩约 `0.0405` 个百分点的余量。这个安全边界过薄，不能据此宣称整裤已经稳定。R2.5 安装裆补片时必须避免继续拉长现有主裤片，并应优先把下一阶段的目标应变压回更安全的范围，而不是简单继续增加缝合力。

## 当前验收状态

```text
sourceContract = true
rigidPlacementValidated = true
leftTubeCheckpoint = true
rightTubeCheckpoint = true
dualTubeGate = true
centerFrontConnected = true
centerBackConnected = true
gussetConnected = false
waistbandConnected = false
sideOpeningClosed = false
assemblyValidated = false
visualAcceptance = false
motionValidated = false
productionReady = false
```

## 下一阶段

R2.5 安装独立裆补片 `G` 的四条有向边：

- `gusset-FL`
- `gusset-FR`
- `gusset-BL`
- `gusset-BR`

验收重点：

1. `G` 的前、后、左、右方向不能接反；
2. 四个三缝交汇点必须使用原始独立材料点，不额外焊死；
3. 两个裤脚继续保持独立；
4. 前后中心缝保持闭合；
5. 裆补片不得翻转、折叠、穿体或跨腿；
6. 不启动腰头和左侧开口；
7. 严格布面交叉数量保持为 0；
8. 材料应变需要保留足够安全余量。
