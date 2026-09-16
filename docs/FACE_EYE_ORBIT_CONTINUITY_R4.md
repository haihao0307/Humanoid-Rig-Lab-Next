# 眼裂与眼眶连续结构 R4

2026-09-15。本轮只处理上一版近景中最明显的眼部结构问题：眼裂形状缺少内外眼角高度差，宽范围眼眶凹陷过深，程序化眼睑容易像独立厚环贴在眼球外侧。

## 改动

- `body/EyeAnatomy.js` 将中性眼裂升级为 `r12-neutral-fissure-orbital-continuity`。眼裂不再由散落常数定义，而是由半宽、上下高度、内外眼角高度差、颞侧偏置和曲率参数共同生成。
- 当前候选中性眼裂为约 25.6 mm 宽、7.3 mm 高，颞侧眼角相对内侧约抬高 1.4 mm。它是针对当前 R2 头部的受限候选，不是人口统计平均脸，也不是从扫描测得。
- 上眼睑继续保留局部折叠，下眼睑新增最大 0.30 mm 的受限眶下过渡凹陷；CPU 构形与 GLSL 重建使用同一参数。
- `body/FaceAnatomy.js` 将宽范围眼眶和眶下凹陷减弱，并拆出较窄的上睑沟和下睑过渡，避免整圈眼眶同时下陷。
- 保留现有眼球、虹膜、瞳孔、独立眨眼、身份参数、表情通道和单人物审阅入口，不改 Core Rig、骨长、绑定或人物比例。

## 依据与边界

成人眼裂通常呈椭圆形，外眼角高于内眼角；上睑缘与上方角膜缘、下睑缘与下方角膜缘之间具有不对称关系。参考：

- Disney Animation, *Realistic Eye Motion Using Procedural Geometric Methods*。
- Park et al., *Anthropometry of Asian Eyelids by Age*, Plast Reconstr Surg. 2008。
- *Reconstruction of the Eyelids after Mohs Surgery*, PMC2884876。

这些资料只用于约束方向和尺度范围。当前实现仍是程序化几何近似，不是组织仿真、扫描眼睑或个体测量模型。

## 验证

遵守当前 `AGENTS.md`，本轮不运行网页、人物模拟或 GPU。验证只包括：

- `node tools/build-pure.mjs`
- `node tools/check-pure.mjs`
- `node tools/check-eye-anatomy.mjs --parameter-fixtures`
- `node tools/check-face-anatomy.mjs --parameter-fixtures`
- 面部身份分层、启动与装配既有测试

文件检查不能代替视觉验收。`visualAcceptance` 与 `productionReady` 继续保持 `false`。
