# KAOPU 数字皮匠 R06.1 — 产品、皮料与物理试样

从用户指定 e86c36c8c34b1f2b57cc5462459ee2f490e556af 只读继承。R01–R05、anchors 及引用资源不改。TAKEOVER_ANCHOR.json 是接手时历史记录，不回写伪造完成状态。

## 新实现

site/products.js 是尺寸驱动的真实三维源码：卡包、腰带、翻盖肩包、开放帽腔皮帽和弯曲皮样。可旋转、放大、换材料。没有生成图片、静态视频或预制模型代替三维。

13 个材质/涂饰实时三维缩略视窗共用一个 WebGL renderer。原 R02 八种预设完整继承；另显示 R05 精细/原始粒面以及已有漆皮、金属箔、珠光涂饰，不称为 13 种实测皮革。R05 新公网纹理为 1536×768 原像素降采样，3072×1536 原裁切数据不动。镜像重复的法线方向修正只发生在新层。

柔光影棚、中性检验、掠射纹理三套灯光；全貌、正面、背面、细节与转台均为三维相机。材质来自继承程序与许可纹理，不用产品照片盖在平面上。

卡包108×76 mm、1.2 mm皮厚、三层裁片与真实贯穿孔；两条相反相位连续走线展示正背面路径，不是完整线张力、摩擦或针孔接触求解。帽子、肩包和腰带边线仍为展示针脚，不能与冻结 R05 的针路质量混称。

腰带1100×35 mm、3.2 mm皮厚、五个调节孔，按弧长映射放置。长倒角三角形先在参考平面切条细分，再弯曲，面朝向与法线一致，不靠 DoubleSide 隐藏错误。

卡包与腰带可查看并导出1:1 mm SVG试作纸样，带100 mm校准尺；与三维共用尺寸与孔位公式。尚未实物打样，腰带扣头回折、皮圈、削薄、五金规格需单独试配，不是可直接投产清单。肩包、皮帽暂不导出占位纸样。夹克未实现。

## 物理边界

Blob Worker只读装配原R03材料及R04 dynamics.mjs、clamp.mjs、worker.js。新皮样视图显示原求解器输出坐标，不按预设曲线动画。默认NL：240×240 mm、1.39 mm厚、45 g球形石块、40 mm落高；投放、取走、暂停、重置与NL/PNL/AL配方可操作。

材料外观与力学配方独立，换色换皮不改力学。显示质量、时间、接触力、下垂、压入、残差。原R04的自碰撞、人体碰撞、摩擦、永久折痕、整衣耦合缺口仍存在。产品形状不是已经完成整件动力学；皮厚、密度、弯曲、阻尼对应具体皮料仍需实测。

## 保留与构建

原R05.1 public-lite.html以gzip嵌入新单文件，点击原版针路时解压到iframe，解压SHA256必须等于46f44dd298eb33b23d41ec05cfe5b550f343fe5ca37cec424ae92b309012f26a。旧网页和固定链接保持不变。

python build.py 生成 standalone public-lite.html，包含全部核心JS、纹理、物理worker和旧针路。python test-products.py 验证产品坐标/绕序/纸样；python qa.py 做真实file://浏览器；python qa.py --public --url <固定网址> 做公网镜像。

浏览器证据在qa/local/browser.json、qa/public/browser.json及Actions artifact。只有本轮实际通过才可声称已验证。桌面Chromium/SwiftShader不是所有GPU验收；390×844为手机视口模拟，不是实机。最终视觉状态PENDING_USER。

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改独立R06生产源码。
- [x] 交付对象为可交互三维工作台。
- [x] 产品几何来自真实运行时；未修改人物/动物网格、骨骼或动作。
- [x] 镜头、选择、物理与导出有实际程序实现；浏览器结果以报告为准。
- [x] 固定公网网址的本轮完整浏览器测试已通过；当前入口与边界见 CURRENT_DELIVERY.md。视觉仍待用户验收。
- [x] 若只有截图没有工作台，本轮判定失败。

## 来源

Three.js MIT，沿用仓库已包含版本。https://threejs.org/docs/#api/en/materials/MeshPhysicalMaterial

R05粒面：Poly Haven Brown Leather / Rob Tuytel / CC0-1.0。https://polyhaven.com/a/brown_leather 及 https://polyhaven.com/license 。原来源哈希记录在r05，新增降采样哈希见BUILD_MANIFEST.json。不分发Adobe付费材质。

原R04依据：Nakahara/Matsuda 2020 https://www.jstage.jst.go.jp/article/mej/7/4/7_20-00072/_article 与 Fraunhofer ITWM https://www.itwm.fraunhofer.de/en/departments/processes-materials/technical-textiles-nonwoven/aif-project-simulation-mechanical-leather-performance.html 。这些是继承内核的依据，不是本轮新实测或完整复现原论文的声明。
