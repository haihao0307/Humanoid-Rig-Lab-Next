# Denim R07 — 稳定采样与连续棉纤维

## 接手范围

用户固定输入：`f8a0e0ab75ca5b8ea4dd345d8f3e7b847eccf2b3/denim-workshop/r06/index.html`。旧 HTML SHA-256：`ec4a548a9486e25be2838614cb3bf369590008cb1d85864c80647da3cbb83498`。

独立分支 `fix/denim-r07-stable-fibers-20261011`。只增加 r07 和本版 CI，不改 R01–R06、人物、眼睛、皮革、裁缝或帽子。保留毫米 YarnGraph、经纬交织顺序、实际纱线、透视镜头、灰棚、背景雾、破口纱桥及自然毛边。视觉验收仍由用户决定。

## 本次实现

R06 的默认画布虽然申请 antialias，真正绘制布料的离屏 FBO 没有多重采样。R07 在实际离屏目标上选择受格式支持的 MSAA，随后在线性光中积分一个输出像素，最后只做一次曝光/色调映射。不使用时域累积、抖动随机数或拖影来掩盖闪烁。

细纤维宽度采用透视深度修正的高斯卷积，展宽时相应降低不透明度，使横向覆盖积分保持不变。它是抗走样近似，不是经过标定的散射能量守恒证明。纤维不因距离跨过一个阈值突然成批消失。

中近距仍绘制实体经纬纱。逐像素足迹超过纱线细节时，颜色在这些实体表面上采用同一 YarnGraph 的预过滤结果，微法线逐渐转为平均响应。只有布片投影很小时才使用同源覆盖率捕获，并以连续权重混合两路线性辐亮度。破洞同样保留覆盖率和实际纱桥，不再被完整布片限定条件排除。此双路阶段有额外绘制成本。

近景去掉按 floor(lane) 切换的硬纤维噪声，使用角向周期连续、沿纱线平滑变化的带限纤维信号。松散纱线细节使用毫米弧长，而不是整段固定重复数。较长外层短纤维及破口纱束采用保留端点的 Hermite 插值细分；近表面小毛羽不盲目增加细分。

CPU 短纤维根部与 GPU 纱线截面共用确定性整数哈希、粗细变化、压实轮廓及父线编号，修正原先只贴名义椭圆、容易埋进纱体的做法。短纤维以有限长度埋入/露出，不绘制贯穿整根纱线的三条金属螺旋。细纤维及宽柔光同时受毛羽参数控制。

破损范围切分为 16 个交织单元的绘制块，保持原全局采样格、端点及经纬编号。内部端盖退化为不可见零面积三角形；断口端盖仍保留。避免一小段残留纱线仍重复绘制全长退化网格。上下文丢失会被显式锁存为错误，不能因下一次 getError 返回 0 而冒充渲染成功。

## 老师、出处与迁移边界

1. Animal Logic，SIGGRAPH 2018，*Simulating Woven Fabrics with Weave*。Peter Rabbit 牛仔夹克的原始制作研究，包含导向曲线、织法、针迹、磨损与毛羽。学习其父曲线、有限纤维、变化与分层结构；没有其专有 Glimpse 渲染器或生产资产，也不称本实现为原系统复刻。
   https://animallogic.com/technology/publications/2018-simulating-woven-fabrics-with-weave/
   https://animallogic.com/wp-content/uploads/2023/08/Simulating-woven-fabrics-with-Weave.pdf
2. Disney Animation，SIGGRAPH 2023，*Creating Curve-Based Garments with Custom Weave Patterns*。采用结构曲线和手工织物差异的方向，保留现有交织、破口与缝线；本轮没有重建完整服装裁缝系统。
   https://disneyanimation.com/publications/creating-curve-based-garments-with-custom-weave-patterns/
3. Disney Animation，SIGGRAPH 2022，*Practical Multiple-Scattering Sheen Using Linearly Transformed Cosines*。借鉴微纤维集合应有整体柔光的思想；本版本沿用并调整现有宽布料反射瓣，没有移植论文的 LTC 拟合数据，不冒称实现该论文的完整 BRDF。
   https://disneyanimation.com/publications/practical-volumetric-sheen/
4. Pixar RenderMan 26，*Curves*，Minimum Width 与 Basis。可学习的直接工程依据是曲线像素展宽必须配合 presence 降低，且平滑曲线需要一致切线。本实现是适合本网页的高斯覆盖与 Hermite 细分，不是 RenderMan 的精确实现。
   https://renderman.atlassian.net/wiki/spaces/REN26/pages/19661233/Curves
5. PBRT 第四版，*Texture Sampling and Antialiasing*。按最终像素足迹预过滤，几何与着色信号应分别处理。有限采样不能保证任意极端镜头都无走样。
   https://www.pbr-book.org/4ed/Textures_and_Materials/Texture_Sampling_and_Antialiasing
6. SideFX，Karma Render Properties，曲线基函数、圆管/带状曲线与渲染表达。用于核对 Houdini 路线，不依赖用户购买或安装 Houdini。
   https://www.sidefx.com/docs/houdini/nodes/lop/karmarenderproperties.html

## 验证与重建

新目录首次生成：`python upgrade.py && python refine.py && python build.py`。

生成后 `app.js`、`natural-yarn.js`、`sampling.js` 等为可直接编辑的源码；编辑后运行 `python build.py`。迁移脚本是冻结基线到 R07 的可复现实验记录，重跑会重建其生成文件。CI 以迁移脚本摘要判断是否需要重新迁移，通常只构建现有源码。

`node test-layers.cjs`：继承的光学积分、材料坐标 Jacobian、4 织法 × 5 破损、端点、索引、有限值与交织顺序检查。

`node test-stability.cjs`：覆盖积分、连续 LOD、全局参数采样格、分块端盖、根部与父线、上下文丢失检测。报告中的 checks 是采样断言次数，不能当作独立测试场景数或质量评分。

`xvfb-run -a python qa.py`：真正 file:// 浏览器、预设/控件回归、移动视口、R06/R07 相同亚像素移动实验。`--content` 仅供本地受限环境的 authored-document 测试，不能冒充文件直开或公网测试。

`xvfb-run -a python qa.py --public <immutable-url>`：真正公网浏览器，核对版本、画面、按钮、破口、远近景、移动视口与错误。以 `DELIVERY_RECEIPT.json` 和对应 Actions 为最终交付证据；没有该成功记录时不要宣称公网验收完成。

## 未完成与代价

仍不是逐根完整棉纤维的离线光传输，不具备实测染色/散射参数、真实撕裂、布料求解或全局自碰撞证明。显示的形变只是观察预览。网页渲染和论文中的影视生产预算不同；不能仅凭增加参数或纤维数量认定达到影视级。

MSAA、较密曲线和过渡双路绘制会占用显存与带宽。帧诊断报告的 attachmentBytes 仅计算本渲染目标，不包含几何、贴图、驱动、浏览器及临时分配。软件渲染浏览器的 CPU 提交耗时不是真实显卡 FPS。390×844 是视口模拟，不是手机实测。网页交付不等于已通过用户视觉验收。
