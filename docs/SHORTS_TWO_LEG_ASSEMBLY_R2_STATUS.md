# 亚麻短裤两裤筒装配 R2 状态

更新时间：2026-09-19

分支：`fix/shorts-two-leg-assembly-r2-20260919`

## R2.1 已完成：源裁片与有向接缝合同

- 已冻结详细路线：`docs/SHORTS_TWO_LEG_ASSEMBLY_R2_PLAN.md`。
- 新增源裁片合同：`clothing/ShortsGarmentContract.js`。
- 新增合同测试：`tools/test-shorts-garment-contract.mjs`。
- 九块原始裁片已具有明确的左腿、右腿、裆桥和腰头身份。
- 19 条接缝已转成有向材料边界关系，并检查端点、平衡剪口、局部送料比和阶段归属。
- 新的装配阶段固定为：左右裤筒分别形成并通过中间门禁，再连接前裆、后裆、独立裆补片和腰头。
- R2.1 源码装配与文件审计通过；当时短裤专项测试为 `163/163`。

## R2.2 已完成：最终姿势人体坐标与九片原布刚性初摆

新增：

- `clothing/ShortsPlacementR2.js`
- `tools/test-shorts-placement-r2.mjs`
- `tools/apply-shorts-r22-placement.mjs`
- `tools/review-shorts-placement-r2.mjs`
- `.github/workflows/shorts-r2-placement-review.yml`

实现内容：

1. 从最终人物姿势读取骨盆、左右股骨和躯干锚点，建立随人物平移、旋转的正交骨盆坐标；不使用固定世界 X 轴判断左右。
2. 九片原布只执行刚性变换，原始 UV、三角拓扑、边界、接缝、质量和人物骨架保持不变。
3. `FL/BL` 放在人体左侧，`FR/BR` 放在人体右侧；前片位于前方、后片位于后方。
4. `G` 不再作为穿过双腿的竖直盖片，而是在实测裆点下方 33 mm 的水平独立工作区展开。
5. `G.left/right/front/back` 四个剪口在人体骨盆坐标中分别保持左、右、前、后次序。
6. 身体表面被统计为 `left_leg`、`right_leg`、`pelvis_front`、`pelvis_back`、`crotch_bridge` 五个区域；本轮没有未分配表面点。
7. 审查模式强制保持缝制步数为 0，不能从初摆页面误启动缝线。
8. 浏览器审查按原布片使用不同颜色，仅用于识别材料身份；生产亚麻着色与正常缝制入口没有被替换。

### 数值与源码检查

- 短裤专项测试：`168/168` 通过。
- 源码装配、语法和文件审计通过。
- 未解析标识：0。
- 外部模型文件：0。
- 图片文件依赖：0。
- `sourceAssemblyMatches=true`。
- R2.2 规范源码保存提交：`d33c24d8d833b99d37b6ba464d522c1a5e7cd38b`。

### 真实浏览器证据

GitHub Actions 运行：

```text
workflow: Shorts R2.2 placement review
run id: 35438702557
head sha: 451db456e13a36a8095f1c0124f38baa542faef1
artifact id: 10582583962
artifact: shorts-r2-2-placement-progress
```

实际页面报告：

```text
actualBrowser = true
placementValid = true
sewingSteps = 0
sourceUnchanged = true
gussetOrderCorrect = true
pieceOwnershipCorrect = true
browserErrors = 0
visualAcceptance = false
motionValidated = false
```

证据视角：

```text
01-angle.png
02-front.png
03-back.png
04-right-side.png
05-left-side.png
06-crotch-below.png
07-mobile-front.png
placement-report.json
review-status.json
browser-errors.json
```

### 人工截图审查结论

已确认：

- 正面图中左前片与右前片分处人体两侧，没有交叉换边。
- 背面图中左后片与右后片分处人体两侧，前后层次没有互换。
- 两个侧视图可见前片和后片分别位于大腿前后两侧。
- 裆部下视图可见绿色 `G` 位于两腿之间、身体下方，未成为横跨双腿的遮挡盖面。
- 移动端 390×844 页面能够显示主要前片和阶段状态。

尚未通过：

- 四块主裤片仍是与身体保持距离的平面裁片，没有围成左右裤筒。
- 腰头仍是独立悬置条带，没有连接到主裤片。
- `G` 只有方向与工作区正确，尚未沿四条有向边连接。
- 没有进行布料松弛、身体接触、布—布连续碰撞或动作测试。
- 当前截图是 R2.2 工序证据，不是成衣效果图。

## 当前验收状态

```text
sourceContract = true
rigidPlacementValidated = true
assemblyValidated = false
visualAcceptance = false
motionValidated = false
productionReady = false
```

没有合格成衣截图，不合并到原短裤分支或 `main`。

## 下一批 R2.3

分别形成两个裤筒，不同时处理裆部和腰头：

1. 只激活 `FL + BL` 的左外侧缝与左内侧缝；形成左裤筒并通过裤脚环、归属、应变和连续碰撞门禁。
2. 冻结左裤筒通过状态，再用同一套规则形成 `FR + BR` 右裤筒。
3. 两个裤筒必须各自产生非自交、面积为正的裤脚环，并保持位于人体矢状面两侧。
4. 左右裤筒中间门禁通过之前，前裆、后裆、`G` 和腰头全部保持不激活。
5. 每个阶段保存数值报告与固定视角截图；失败回到最近通过检查点，不从坏状态继续累计。
