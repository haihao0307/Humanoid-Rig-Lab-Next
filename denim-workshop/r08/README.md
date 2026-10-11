# Denim R08 — 棉纱近景候选

## Task anchor

用户本轮指令：继续处理近景质感。唯一主缺陷是 R07 放大后过于规整、光滑、偏绳束的纱线表面，而不是重新做服装或改变灯光制造观感。父构建 `fa143743b1b0f3d74ff827664d06ff119ef87063/denim-workshop/r07/index.html`，88,792 bytes，SHA-256 `da52a22edc0da2365d25791a46c20c5669cd5ce7df86b51372c7d79291dd2b5a`。父分支头 `d06a8750819185959dc9821f2a15b4b766783552`；新分支 `fix/denim-r08-cotton-near-20261011`。父版并未获得用户影视级认可。

保护 R01–R07、其他工作台、毫米 YarnGraph、四种交织顺序、十二整理预设、五种破损、实体近中景经纬纱、透视、灰棚、背景雾、残留纱桥与成簇毛边。保留 R07 的离屏 MSAA、线性光积分、Gaussian 细曲线覆盖和连续远景过渡。禁止图片替代三维、旧页面冒充本轮结果、强推、合并 main 或擅自改其他台。

## 本轮实际实现

`cotton-surface.js` 把粗而连续的七道螺旋明暗带替换为有限长度、错开起止、局部露出并带像素足迹过滤的短纤维信号。柱面角度用周期身份与正弦/余弦坐标保持接缝连续，未能分辨的纤维聚合为均值，而不是近景整体模糊。局部纱束粒度沿父纱方向变化；磨白与露出程度联系，不是把灯光调亮。

纱体实际截面削弱过大的三瓣/七瓣电缆轮廓。CPU 纤维根部与 GPU 纱体共享同一包络公式。纱体法线取变形截面的差分，不再只按名义椭圆计算。近景截面由 8 边连续过渡到 16 边，避免光滑纱面仍呈硬折面；中远景维持原采样结构。

表面毛羽增加为 18,000 条确定性代表曲线，较短且贴近父纱，根端埋入纱体；外层短纤维缩短并错开。保留原破口的桥、尾、残留纱和成簇散丝。没有声称每一根真实棉纤维都已建模，也没有全局纤维碰撞证明。

新增三个实际控制：纱束非规整度、有限短纤维层次、贴面毛羽显露。导出格式升级为 `kaopu.denim_material_profile@2.6`；不自动迁移其他消费端。移动视口仅调整顶部标题/工具条间距，防止上一版局部重叠。

## 学习来源与边界

- Animal Logic, *Simulating Woven Fabrics with Weave*, SIGGRAPH 2018：父导向曲线、织法、有限纤维、破损与毛羽分层；不是移植其专有 Glimpse 渲染器和 Peter Rabbit 生产资产。
  https://animallogic.com/technology/publications/2018-simulating-woven-fabrics-with-weave/
  https://animallogic.com/wp-content/uploads/2023/08/Simulating-woven-fabrics-with-Weave.pdf
- Zhao et al., *Fitting Procedural Yarn Models for Realistic Cloth Rendering*, 2016：程序纱线的统计差异与 flyaway 对外观的意义。本版没有 CT 拟合参数，不能把自行选择的数值说成测量结果。
  https://research.cs.cornell.edu/ctcloth/
- Wu and Yuksel, *Real-time Fiber-level Cloth Rendering*：内层聚合、外层显式纤维以及尺度处理方向。没有原样实现其全部光学和加速系统。
  https://people.csail.mit.edu/kuiwu/rtfr.html
- Disney Animation, *Creating Curve-Based Garments with Custom Weave Patterns*, SIGGRAPH 2023：曲线结构和非理想织物差异；没有把这一篇等同于已完成的服装系统。
  https://disneyanimation.com/publications/creating-curve-based-garments-with-custom-weave-patterns/

## 重建与验证

首次：`python denim-workshop/r08/bootstrap.py`。迁移在内存中重新装配并核对冻结 R07 的完整字节摘要，拒绝覆盖已存在的 R08 app.js；不修改 R07。生成后修改 R08 的规范源文件，用 `python denim-workshop/r08/build.py` 重建一个无外部运行资源的 HTML。

`node test-layers.cjs`、`node test-stability.cjs` 继承数值与采样回归。`node test-cotton.cjs` 检查角向周期、包络范围、确定性几何和实际交织中心表面间隙。报告的 checks 是采样断言，不是独立场景数；交织中心的有限样本不是全局碰撞证明。

`xvfb-run -a python denim-workshop/r08/qa-near.py` 执行真实 file://，检查按钮、新滑块实际像素变化、十二整理、四织法、参数导出、静止停绘、重复状态像素一致，以及 R07/R08 同镜头同灯光近景截图。相同 1000×780 视口下，对完整布片和破损布片分别进行 8 帧四分之一像素移动，取 13×51 材料位置补丁的重投影残差。预先声明回归容差为 R07 的 1.30 倍或 R07+0.20（取较大者）；这不是绝对零走样标准，更不是近景真实度评分。

`--public <immutable-url>` 验证实际固定公网版本；`--content` 仅是受限开发环境中的 authored-document 测试，不得当成 file:// 或公网证据。最终成功状态、固定构建与测试范围以 DELIVERY_RECEIPT.json 和对应 Actions 为准。

## 代价与尚未通过的项目

近景更多曲线和更密截面带来明显成本。一次本地软件 Chromium 的 1180×860 桌面视口中，近景约 896 万三角形，几何缓冲约 120 MB，离屏目标约 112 MB；这两项不是总内存，另有纹理、临时数组、驱动和浏览器开销，最终值应以已发布运行时诊断为准。HTML 文件小不等于运行内存小。软件渲染的 CPU 提交时间不是真实显卡帧率，390×844 视口模拟也不是手机实测。

第一轮只加毛羽/减粗条纹仍显得光滑，内部未接受；本轮进一步修改了主体短纤维和截面法线，不能仅靠“毛羽更多”自我批准。仍有宏观交织规律性，未实测棉纤维散射/染色参数；没有完整离线光传输、布料力学、真实撕裂或全局自碰撞。用户视觉与影视级批准保持 false。

## 交付检查

- [x] 没有生成图片替代真实三维。
- [x] 本轮已修改实际材质、程序化几何、UI 与导出源码，不是 R07 恢复报告。
- [x] 几何由真实运行时按参数生成，旧版与其他工作台保留。
- [ ] 固定公网与 standalone file:// 的最终浏览器结果：见 DELIVERY_RECEIPT.json。
- [ ] 用户近景视觉验收、影视级验收与真实设备性能未通过。

内部截图只是检验证据；没有固定可交互网页时，交付未完成。
