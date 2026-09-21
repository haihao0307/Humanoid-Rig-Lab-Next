# 00｜重新开线入口

这是 Bird Mother / Original Bird 的干净交接入口。不要从旧聊天记录、`main`、被拒绝的低品质候选或 R0.16.4 飞行研究页面恢复生产。

## 唯一恢复点

- 仓库：`haihao0307/Humanoid-Rig-Lab-Next`
- 分支：`handoff/bird-mother-original-bird-full-r0171-20260921`
- 交接源提交：`12980b04975b172c88e8ffc3996932d59fa689f1`
- 当前工作台：`Bird-Reconstruction-Lab/original-bird/workbench/original-bird-gull-form-r0171.html`
- 当前运行时：`Bird-Reconstruction-Lab/original-bird/runtime/original-bird-gull-form-r017.mjs`
- 当前状态：`Bird-Reconstruction-Lab/original-bird/CURRENT_STATUS.json`
- 当前合同：`Bird-Reconstruction-Lab/original-bird/distilled/LARID_ORIGINAL_FORM_R017.json`
- 当前浏览器测试：`Bird-Reconstruction-Lab/original-bird/tests/gull-form-r017.spec.cjs`
- 当前静态检查：`.github/workflows/original-bird-reference-measurement.yml`
- 当前浏览器检查：`.github/workflows/original-bird-gull-r017-browser-qa.yml`

## 一按打开

固定提交预览：

`https://raw.githack.com/haihao0307/Humanoid-Rig-Lab-Next/12980b04975b172c88e8ffc3996932d59fa689f1/Bird-Reconstruction-Lab/original-bird/workbench/original-bird-gull-form-r0171.html`

工作台里应当同时具备：

- 明亮灰白背景；
- Original Bird R0.17.1 独立候选；
- BIRD-REF-005 高细形体主参考；
- 静态形体 / 基础拍翼切换；
- 侧面、正面、顶部、三分之四、翼底固定视角；
- 线框、阴影和截图控制；
- 高级飞行关闭状态。

## 生产顺序，不得更改

### 阶段 A：静态形体

先只看：

- 总体海鸥轮廓；
- 胸腹质量；
- 颈—头—喙过渡；
- 眼睛大小和位置；
- 翼根与肩胸连续性；
- 翼展、翼面和翼尖；
- 尾基、尾扇；
- 腿足和蹼足。

侧面、正面、顶部、三分之四和翼底没有形成一致的海鸥形体之前，不做高级动作。

### 阶段 B：基础拍翼变形

基础拍翼只用于检查：

- 翼根是否分离；
- 肩胸是否塌陷；
- 肘腕是否反折或僵硬；
- 左右翼是否镜像错误；
- 翼尖和初级飞羽是否穿插；
- 尾部是否与身体失配。

### 阶段 C：羽层和材质

只有 A、B 通过后才处理：

- 覆羽层次；
- 初级和次级飞羽层次；
- 翼尖和尾缘 Alpha；
- 半透明边缘；
- 写实材质、粗糙度和细节尺度。

### 阶段 D：高级飞行

最后才进入：

- 滑翔；
- 转弯；
- 爬升和下降；
- 起飞和着陆；
- 抗风和阵风；
- 群体飞行；
- 生态和捕食行为。

## 固定源职责

`BIRD-REF-005 / seagull2(2).glb`

- 负责形体与细节观察；
- 负责身体比例、头眼喙、翼面、翼尖、尾部与材质边界；
- 不直接进入最终运行时。

`BIRD-REF-004 / seagull(2).glb`

- 负责基础拍翼相位和粗翼链参考；
- 不负责最终形体、眼睛、喙、羽毛或材质；
- 不直接进入最终运行时。

## 当前门禁

- `visualBirdGenerated=true`
- `continuousSurfaceBirdGenerated=false`
- `staticFormAccepted=false`
- `basicFlapDeformationAccepted=false`
- `advancedFlightAllowed=false`
- `visualAcceptance=false`
- `productionReady=false`

## 新执行端的第一件事

直接打开 R0.17.1 工作台，捕获五个固定视角和基础拍翼相位 0.25 的画面，逐项修形。不要先写新的研究计划、Schema、飞行分类、群体系统或生态系统。
