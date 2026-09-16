# R6 肩顶分配与局部支撑

2026-09-14 复查更正：R7 在当前生成表面的 A/T 隔离姿势中仍复现了实际三角面折叠，不能将下文的局部轮廓改善当作绑定验收。原始 ASF/AMC 此次已取回，锁骨通道在原文件中也近乎为零。详见 `MOTION_LIBRARY_BINDING_REVIEW_R7.md`。

2026-09-13，按用户要求继续检查各动作截图。此修正只处理肩顶凹口；它没有补造肩胛骨节点、肩带录制轨道或把全部动作升级为视觉合格。

## 定位到的原因

R6 开始时导出的 12,859 个肩部顶点中，参考左 GH 支点为 `(-.1645913, 1.3147382, .0757354)`。上肩外侧 `(-.1771044, 1.3490413, .0703381)` 对上臂的权重仅 3.26%，其余几乎全跟随固定 AC 和胸椎；更外下缘 `(-.2367165, 1.2747855, .0725379)` 的上臂权重却达到 90.40%。原 `arm()` 主要用沿肱骨轴的投影判断 AC→上臂，肩头外侧的覆盖组织因此被当作固定胸部。

隔离 T 姿下，胸椎和 AC 都不转。此时改变 AC 与胸椎的相对比例不会改变形体。CPU 的仅 DQS 轮廓也能复现约 30 mm 的低谷，不需要先假定动作文件被清零。

六个已安装 clip 共 1,002 个保留样本，左右 `ClavicleQ` 的最大角度均为 0。`derive-motion-reference.py` 读取原 ASF/AMC 通道，`FullBodyMotion` 和 `MotionLabPose` 再传递给 SC；没有发现这三处显式清零。此次 CMU 原始文件未成功取回，所以没有把恒等轨道归罪于转换脚本，也没有修改录制文件或锁定 vendor。

## 实施

`reconstruction/binding.mjs` 在图扩散后、量化前，按同源 AC、GH 与肱骨头球半径建立平滑的上外侧肩帽权重，最多向同侧上臂转移当前行的 0.6。修正只作用于已有同侧上臂解剖支持的皮肤根，继续通过原支持集合投影和八权重编码。每个共享根只处理一次，CPU 支撑点和 GPU 表面读取同一组权重。垂臂参考几何没有移动。

单改权重会使尖 V 变浅 U，仍不足以支撑帽状外形。因此 `body/CompactMuscles.js` 增加局部软组织支撑：支持区随个人肱骨长度缩放，横向中心比 GH 外移 0.10 倍骨长，最大抬升为 0.08 倍骨长，约 22.6 mm。它复用上臂相对胸廓的抬举激活，参考垂臂为零，左右独立，下腋窝和支持区外为零。此为明确标记的工程近似，不是测量到的肌肉形变。

CPU 支撑与 GPU 都在原肌腹函数中按相同顺序计算此映射，原 GPU 法线 Jacobian 差分覆盖整个合成函数。没有添加顶点属性、实时骨长变化或每帧顶点上传。静态绑定只在生成时计算。

## 已做的局部验证

- `node tools/test-shoulder-cap.mjs`：16 个上肩权重样本的同侧上臂占比最低 21.31%；0.1 mm 相邻点的最大权重变化 0.000839。177,408 个左右、抬举、屈肘及空间样本的合成映射 Jacobian 行列式为 0.4015–1.5364，未翻转；参考垂臂和对侧激活不改变该点。
- `node tools/test-shoulder-geodesic-prior.mjs`、`node tools/test-neck-binding-continuity.mjs`、`node tools/test-axilla-muscles.mjs` 通过。原腋窝及共享界面检查仍保留。
- 后台 Edge 冻结诊断场景对照了 T90、A45、挥手 20/50/80% 及侧面。完全增加肩帽权重会生成突起，未采用；温和权重加外移后的支撑保留较平顺上沿。T 的大凹槽明显减少，A 的上肩凸折减轻。仍可见局部浅起伏及腋窝接缝，因此不声明全身皮肤无自交。

诊断图在任务外部 artifact 目录，前缀 `r6b-`。重点为 `r6b-shoulder-T-before.png` / `r6b-shoulder-T-soft-morph-shift10.png`、`r6b-A-before.png` / `r6b-shoulder-A-soft-morph10.png`、`r6b-wave50-before.png` / `r6b-wave50-cap.png`。这些对照是在同一冻结诊断场景中临时修改 GPU 权重和 shader，正式生成版本的完整动作截图、CPU/GPU 回读及性能记录由 R6 总验收另行给出，不能用诊断图代替。

资料：[OpenStax 肩胛运动](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-5-types-of-body-movements)、[Disney Enhanced DQS](https://www.disneyanimation.com/publications/enhanced-dual-quaternion-skinning-for-production-use/)。前者明确肩带参与抬臂，后者说明骨架蒙皮仍需处理组织形变；它们不提供本项目的肩帽参数，这些参数是工程修正。
