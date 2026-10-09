# ET08-S1.1 — 闭眼 U 形修复交付记录

这是第一阶段灰模修复版，等待用户视觉验收；不是完整眼周成品，也不是第二阶段重构。中断前的修复已恢复核对；本次补充了独立的固定公网版本复测，没有重做或替换已验证几何。

## 固定网页

当前修复版（代码、构建、资源版本均可追溯）：
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/c4cad2026f10b656a4bc00568be11dcf7429c44f/skin-quality-lab/emily-transfer/preview.html

修复前 ET08-S1 保留：
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/bbd6de3ed7904429c7720e74c2297d1f04862314/skin-quality-lab/emily-transfer/preview.html

用户最初指定的 ET07.3 保留：
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/5be35195ad40d57507f7ab1785e4eecda6c648de/skin-quality-lab/emily-transfer/preview.html

浏览器点击“完全闭眼 / 检查修复”，随后按住“修复前的 U 形”比较；松开立即回到修复版。再点击“深仰视角 / 检查闭合”，可复查用户指出的下方观察角度。分级闭眼按钮仍保留。始终使用同一个原扫描头、同一个渲染器、同一套灰模材料；没有用截图或新人物替代。

## 源码修正与诊断纠错

核心变更在 `stage1/ClosedSurface.js`、`stage1/ContourEyes.js` 和 `stage1/GrayReview.js`。原问题不是睑缘未相遇，而是把自由睑缘的眼球接触位移传递给整片皮肤；闭眼后整片表面没有回到合理的闭眼目标，形成额外 U 形兜袋。只检验两条边缘之间为零间隙不足以证明闭眼表面正确。

先前文字把原因推测为“上下对称夹合”不准确。源码的中央闭合本已主要由上睑承担；本修复没有套用未经个体测量的固定75%–85%规则，也没有任意拉直已锁定的XY闭合曲线。

整片上下眼皮现在连续回到同一闭眼扫描导出的、边界受约束的平顺闭眼目标。修正后的后侧睑缘跟随前侧表面，避免深仰视时拉出过厚的长带；外围使用原有有限搭接环衔接头部，并在最终法线混合后重新固定边界法线。

眼球半径仍为12.20mm，虹膜参照半径5.307mm，XY中心不变。但完整闭眼包络检测暴露了原先仅检查0.8r中央区域的深度拟合不足，故右眼球向后修正0.89326093mm，左眼球向后修正0.06295602mm。不能再沿用第一版“眼球深度完全未变”的说明。这是同一扫描的模型空间拟合，不是医学或身份标定。

闭眼目标的平顺处理相对原始射线重采样高度场最多偏离约1.696mm（右）/1.305mm（左）。验证中很小的闭眼目标残差仅代表代码贴合这个拟合目标，不能冒充精确恢复真人扫描或生物力学真实性。

## 实际验证

构建与几何回归：
https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/37909927679

已下载并读取该次 artifact `et08-stage1-11`：131项主检查、10种姿态，2949120个后侧与睑缘三角面采样；共享边缘、完整闭眼表面、接触、原资产保持、对照和移动视口检查通过。完全闭眼时配对自由缘最大间隙均为0mm，眼球对象没有隐藏。

中断恢复后的独立固定公网复测：
https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/37912199700

该工作流只读检查上述 `c4cad2026...` 发布，不重构、不推送构建、不写main。已下载并读取实际 artifact：

- `release-identity.json`：公网HTML SHA-256与清单一致，`5d5964901a44230cdc1c3bcbf2642767f8d52e1f8cba44bc6dea2bd6fc3e5e75`，2153563bytes。
- `public-report.json`：11项，真实固定网址、桌面、手机视口、闭眼、对照通过。
- `public-under-report.json`：14项，三种深仰视角、分级闭眼、眼球像素遮挡及睑缘厚度通过。
- `resumed-regression.json`：71项，三轮各21个闭合程度的重复测试、闭眼终点无累积漂移、按住修复前/松开/失焦恢复通过。

本次复测实读截图 `resumed-closed.png`、`resumed-closed-deep-below.png`。完全闭眼的三个深仰视角，眼球可见像素均为0，且眼球对象保持可见；睁眼正控制仍能检测到眼球像素。未通过隐藏眼球或加黑色遮罩实现。

桌面1440×1040，手机390×844仅视口模拟，不是手机实机。此会话本地浏览器被环境策略阻止导航，没有将本地尝试记为通过；上述通过证据来自GitHub Actions中真实公网页面。没有JavaScript运行时错误。有限采样不等于连续碰撞穷尽证明。

## 尚未完成

当前额外U形兜袋及深仰视的过厚内侧带已作专项修正。闭眼边缘仍偏硬，原扫描残留的眼周体积和局部边界细碎痕迹仍可见；睁眼时上睑厚垫、下睑宽隆起、眼角内部层次需要后续第二阶段。未加皮肤细节掩盖这些问题，未宣称弧长/体积守恒、新动态折叠或最终光学已经完成。

同一人物的真实睁眼和多方向注视数据仍缺失。本版是约束拟合与第一阶段问题修复，等待用户视觉确认。Draft PR25继续保留；未合并、未强推、未修改历史提交。
