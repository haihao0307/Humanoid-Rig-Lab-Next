# ET03 — 接触约束眼球与眼睑工作台

本轮任务：学习 AniEyelid 与 ShellNeRF，修正原 ET02.1 的眼球位置、薄片眼睑和眼周接触关系。保留现有 Lee 人头、皮肤资源、灯光能量、材质对照和注视交互，不另造一个无关演示。

## 固定版本

已构建的页面及模块提交：`ccaa73ff5a5cbcfdd3db88ee85dc9859bbcc0022`。

固定网页：
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/ccaa73ff5a5cbcfdd3db88ee85dc9859bbcc0022/skin-quality-lab/emily-transfer/preview.html

保留的 ET02.1：
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/06b92744537caf0709b9bb73e4917453bc238294/skin-quality-lab/emily-transfer/preview.html

源码回归通过后才发布以上构建。公网检查为单独步骤，不以源码回归代替；完整任务记录在 Actions `37771469727`，最终公网结果应以该步骤和对应 `public/report.json` 为准。不能单凭本 README 认定公网验收通过或视觉已达到论文水平。

## 实际实现

`ResearchEyes.js` 生成有内侧接触面、外侧皮肤、睑缘、泪膜和内眼角组织的眼睑系统。外侧支持边界继承原扫描位置和法线，接触约束根据旋转后的双球面角膜/巩膜形状计算。闭眼目标参考本人的原闭眼扫描；闭眼时没有隐藏眼球来制造覆盖成立的假象。

`ReferenceRails.js` 保存从 MakeHuman CC0 hm08 网格提取的 33 组归一化轮廓。它是模板先验，不是这个人的睁眼真值。`extract_reference.py` 保存提取方式、固定来源与摘要。

运行时眼球深度用原闭眼扫描的内侧空间做保守约束。每只眼使用 437 个表面采样，假设闭眼时为中性视线，只估计深度而非复现论文的多视角标定。

转眼、眨眼和眯眼分别控制；左右眼各自对准同一世界目标，保持原本的镜头注视、鼠标跟随和目标锁定。新增慢动作闭眼检查与眯眼滑块。保存恢复继续包括皮肤与眼部配方。

眼球材质明确绑定与皮肤相同的环境图，使眼球自己的反射强度生效。阴影选用实际对照中更稳定的 Three.js PCF：2048 深度图、17 次采样、半径 10，并让眼睑阴影使用与可见表面一致的位移及裁剪区域。`SoftOcularShadows.js` 是被视觉评审淘汰的实验方案，不被最终应用导入；不要把它误认为已交付算法。

## 研究对应关系

AniEyelid 的关键指导是先校准眼球，再利用接触关系和视线相关形变重建眼睑。ShellNeRF 的关键指导是眼周细节与可变形表面的对应关系，以及显式眼球的反射/折射处理。详细论文、代码阅读、数据来源与许可记录见 `RESEARCH.md`。

本页没有训练 AniEyelid，也没有运行 ShellNeRF。当前是对部分原理的实时几何适配，不是神经 SDF 或壳层辐射场的完整复现。研究数据不等于无条件可商用；AniEyelid 官方预处理数据限定学术用途，本页未打包该数据或研究人物的检查点。

## 重建与后续开发

接受后的模块源码已保存，不需要每次重新回放历史补丁。

```sh
NODE_PATH=<esbuild所在node_modules目录> \
ASSET_COMMIT=<包含r01/r02资源的40位Git提交> \
node skin-quality-lab/emily-transfer/research/bundle.cjs
```

`bundle.cjs` 直接打包当前 ET03 源码，固定资源版本，并检查最终 HTML 内联脚本。`build.cjs`、`refine.cjs`、`closure.cjs`、`finish.cjs` 等保留为本轮实验过程的可追溯记录，不应拿历史初始版本覆盖已经验收的当前模块。

`accept.cjs` 是扩展回归；`quick.cjs` 包含 45 组闭合/视线组合。接触检查限于程序声明的外侧采样区域，不等于任意姿态、全部三角形或渲染位移下的绝对无穿插保证。手机检查为浏览器视口，不是手机实机。

## 尚未达到的目标

眼角组织、薄睑缘、动态细皱纹及上眼皮纹理拉伸仍有人工拟合痕迹。所用眼图的单虹膜有效直径约 230 像素，不是高分辨率真人虹膜扫描。原始闭眼头模没有提供本人睁眼后的隐藏表面资料，因此当前外观不能称为这个人物的准确睁眼重建，更不能称为顶尖质量最终母体。

进一步逼近论文级结果需要同一被摄者的睁眼、闭眼、转眼多视角记录、相机参数与分割、使用权确认、离线优化以及网页端导出或蒸馏。当前无需新增收费服务或摄像头权限；也未把多张 4K 皮肤资源的整页成本宣称为极小开销。
