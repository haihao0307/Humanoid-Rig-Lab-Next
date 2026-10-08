# KAOPU 皮革物理 R04 — 修复落石失控与夹持假演示

固定公网入口：
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/160054f707c24e1713b3cbe2e3edbac512d8d2e6/leather-workshop/r04/preview.html

固定构建：160054f707c24e1713b3cbe2e3edbac512d8d2e6。
HTML SHA-256：0764949251261a2b6c11fa1a1e7d5da85bb00e963b4cf67565706105efe95c06。
单文件 3094697 字节，可直接离线打开；源码和数值测试与网页同版。本版不覆盖 R02 / R03.1，未修改主分支、人物网格、骨骼或裁缝铺生产代码。

## 修复的是物理，不是隐藏错误画面

用户提供的 R03.2.1 截图中，皮片被拉成长袋，夹点附近极端变细。复核旧源码发现，动态演示没有调用 R03.1 的皮革材料能量，未按皮片面积和厚度建立质量；重力、弹簧和阻尼采用无统一物理单位的数值。石头只把点推开，没有与皮片共同求反作用力，还会在越过某一高度后停掉计算。修复 TypedArray 的索引包装，只解决了显示异常，没有解决这些动力学问题。旧演示应停止作为物理依据。

R04 删除这条独立弹簧演示路径。渲染器只显示求解得到的坐标，不按预设曲线把皮面拉成长袋；没有按屏幕范围截断皮面下垂来伪装正确结果。

## 打开后操作

落石：点击「投放石块」，切到「侧面观察」，等待接触和承重；再点击「取走石块」，皮片继续计算恢复。改变石块质量或落下净高度会重置试验。质量范围 25–70 g，高度范围 20–80 mm，球形石块直径 32 mm。落高以夹持的初始皮面为参考；空载下垂后的中心间隙会比这一设置值略大。

夹子：点击「夹子·准静态」，拖动金色右夹子，或选择目标伸长再点击拉开；「慢拉一轮」可观察加载、保持、回位，「回位／卸载」回到零位移。夹子模式是准静态非线性力平衡，不应理解成惯性回弹试验。

「原 R03.1 / R02」完整保留原工作台。用户可以把其中当前的皮革外观用于新试样。外观换色不改变质量、弹性或已经求出的运动状态；几何绗缝、编织和缝线不通过材质按钮一起传递。

## 材料与求解

动态皮样为 240×240 mm，默认 NL 厚度 1.39 mm，四角采用约 15×15 mm 的夹持区域。该尺寸已经明确写入页面；不是把旧 30 mm 玩具试片的数值当作同条件对照。夹子试样为 240×180 mm，两端整边约束。

膜内弹性继承 R03.1 的 Nakahara / Matsuda（2020）AL、NL、PNL 配方和式14–17的能量转录。新增客观的 3×2 曲面形变梯度表达，使同一皮革应力关系作用于空间变形，不再只作用于独立拉伸图表。默认厚度分别随 AL / NL / PNL 取 1.06 / 1.39 / 1.16 mm。

动态内核使用米、千克、秒、牛顿和帕斯卡。节点质量按参考三角形面积×厚度×密度分配；密度 700 kg/m³ 是未实测的演示输入，默认 NL 皮片总质量为 56.0448 g。

弯曲采用有符号二面角壳能量，梯度以有限差分核验；弯曲刚度 0.002 N·m 是未标定输入，不是从拉伸论文中测得的数值。

固定子步 1/240 s；每步对惯性、膜内弹性、弯曲和接触的总增量势能做隐式最小化，采用预条件 L-BFGS 和能量下降线搜索。参考隐式连续体模拟思想，但不是复制 Baraff/Witkin 的完整求解器。最终交付不是 XPBD。

石块采用球形碰撞体与三角面最近点，接触根据重心坐标分配给皮面节点；石块和皮面共同参与求解、相互施力。当前为无摩擦法向罚势接触，刚度 200000 N/m / 活跃三角面。不能承诺任意尺寸、速度或网格下绝对零穿透。

采用指数速度衰减，阻尼 2.5 s⁻¹ 是演示假设；隐式积分本身还存在数值耗散。本版落石不包含已标定黏弹性、永久折痕或纤维损伤。原 R03.1 的独立松弛/蠕变试验仍保留，不能把它说成已经完整耦合到 R04 曲面。

## 这轮验证了什么

38 项数值一致性检查、3 组完整落石生命周期、19 项文件直开与交互检查、17 项固定公网检查通过。网页测试使用实际 Chromium / SwiftShader，桌面 1440×1000，手机仅 390×844 视口模拟，不是手机实机。

生命周期覆盖：空载重力平衡 → 下落 → 接触 → 承重 → 取走 → 继续恢复；另外验证夹子非线性反力、卸载、材质不改物理、真实导出文件、旧 R03.1 保留与材质传递、控制台零错误和离线核心零 HTTP 请求。

默认 NL / 45 g / 40 mm 试验的数值结果：空载中心下垂 4.0921 mm，承重稳定后 7.0561 mm，取走后 4.0921 mm。接触合力约 0.4421 N，对应石块重力 0.44145 N。三组试验中记录到的最大接触压入小于 0.008 mm。重载 70 g / 80 mm 的稳定下垂约 7.9580 mm；轻载 25 g / 20 mm 约 6.1037 mm。这些全部是当前模型的计算输出，不是实物测量或原论文冲击试验。

数值检查还覆盖膜能量解析梯度、刚体旋转客观性、与 R03 平面材料表达对照、弯曲梯度、双向接触力、质量总和、接触势能计入总能量、夹子方向性等。AL 在同一夹持设置和 8% 伸长下，0°与90°反力不同；中心对称方形皮片旋转90°后，中心落石响应可能相同，不能把夹子方向差异强行类推成中心落石一定差异明显。

测试日志包含固定边界误差、最大局部伸长、面积变化、接触压入、速度、能量和求解残差。尖峰冲击子步在有限迭代预算内不一定达到相同残差；本版没有把「运行不崩溃」当作每一子步工程收敛。未完成原论文完整曲线复现、网格与时间步独立收敛研究和真实皮料标定。

补充本地数值检查：从重置的平皮片直接投放 70 g / 80 mm 石块，未先让皮片空载稳定，推进 1.5 秒后仍建立承重接触；这项不是浏览器实机测试，末状态摘要见 qa/direct-drop.json，可用 direct-drop-test.mjs 复现完整采样。

完整验证运行：
https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/37768553988

## 成本、边界和未完成项

这是计算较重的 CPU / Worker 隐式研究工作台，不保证实时60帧物理。计算不足时物理时钟减慢，并在页面显示实际倍率；不会为了赶上显示帧率放大时间步导致爆炸。相机和界面与求解分开。软件渲染测试机不是用户设备性能基准。

尚未完成：自碰撞、人体碰撞、摩擦、裂口扩展、永久折痕、逐纤维接触、整衣/裁缝铺生产接入，以及材料、密度、弯曲、阻尼的统一实物标定。球形碰撞体不是不规则石块刚体。前述三个研究是材料与验证老师，不意味着已取得 Fraunhofer FISFT / TexMath 源码。

## 源码与复建

主要文件：site/dynamics.mjs、site/clamp.mjs、site/worker.js、site/runtime.js、site/template.html、build.py、test.mjs、test-scenes.mjs、qa.py、THIRD_PARTY.txt。

源码在 site/ 中已经展开。bootstrap/ 仅为本次工具传送文本的一次性校验输入，不参与浏览器运行，不是权威源码；不要覆盖已经展开修正的源码。review_fixes.py 记录了有校验、可重复执行的审核修正。

完整源码包保留需要的相邻 r02、r03 输入。在包含 leather-workshop 的目录执行：

```sh
cd leather-workshop/r04
node test.mjs
node test-scenes.mjs normal
node test-scenes.mjs heavy
node test-scenes.mjs light
python build.py
```

用户只需打开 preview.html，不需要安装 Node、Python 或 Adobe 软件。浏览器 QA 另需 Playwright 与 Pillow。

## 来源与许可

Nakahara / Matsuda 2020：
https://www.jstage.jst.go.jp/article/mej/7/4/7_20-00072/_article

Fraunhofer ITWM / FILK：
https://www.itwm.fraunhofer.de/en/departments/processes-materials/technical-textiles-nonwoven/aif-project-simulation-mechanical-leather-performance.html
https://pmc.ncbi.nlm.nih.gov/articles/PMC8070376/

鞋面静态结构研究：
https://www.mdpi.com/1996-1944/16/22/7203

隐式连续体求解思想参考：Baraff / Witkin, Large Steps in Cloth Simulation (1998)：
https://www.cs.cmu.edu/~baraff/papers/sig98.pdf

二面角导数参考实现：
https://github.com/InteractiveComputerGraphics/PositionBasedDynamics/blob/master/PositionBasedDynamics/PositionBasedDynamics.cpp

Three.js 与 PositionBasedDynamics MIT 声明见 THIRD_PARTY.txt，单体 HTML 也保留声明。未分发 Adobe 付费材质、论文整篇副本或商业求解器代码。
