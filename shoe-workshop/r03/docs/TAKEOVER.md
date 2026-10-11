# 接手核查与边界｜2026-10-11

## 参考并没有全部丢失

用户锚点 R02 已有 docs/RESEARCH.md、docs/OBSERVER_AND_METHOD.md、SOURCES_LOCK.json、SOURCE_IMPORT_RECEIPT.json、assets/GH-SOURCE-AUDIT.json 以及 vendor/leather、vendor/tailor。原作者 CAD/GH 的导入与来源在原锁文件中。

在 R02 RESEARCH 中确实列出的七项：Symbiotic Shoes、iCAD/INESCOP、Romans CAD、Shoemaster、3DShoemaker、IPC、Dynamic foot morphology explained through 4D scanning and shape modeling。此清单不宣称穷尽用户所有历史参考；也不把列有网址等同于代码集成。Shoemaster 与 3DShoemaker 的旧记录标明当时访问失败。观察员的六个能力系统与仓库方法论也已登记。

本次重新读取的原始官方资料：

- Symbiotic Shoes 作者方法：https://class.textile-academy.org/2021/sara.alvarez/projects/symbiotic-shoes/04-how/
- iCAD：https://icad.inescopsolutions.com/
- Romans CAD 3D：https://www.romans-cad.com/en/3d-design-1
- 工作台方法论固定入口：https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/a0cd098b4a0fcb8b5d5de90200acd0fb1051f543/WORKBENCH_BUILD_SYSTEM.md

## 容易造成错误方向的前提

Symbiotic Shoes 原例使用 TPE 平片与热成型；作者说明参数化鞋样仍在进行中。不能把它直接描述为成熟的皮革成鞋内核。iCAD 和 Romans CAD 官方公开说明展示 3D/2D、款式线、部件与展开流程；公开产品能力说明不是取得商业源码或完成移植的证据。

R02 显示了原鞋楦、设计线和九块平面部件，并复用了皮革针路与裁缝校验器，但针路试片没有绑定原鞋片真实缝边；参数鞋楦仍为独立研究场，不是全 GH 等价复现。旧分支后续五个提交增加了发布/检查记录和 R03 上楦任务文档，没有新增上楦实现。本轮保留这些内容，不覆盖已有固定网页。

## 本轮真实增量

R03-A 只补边界配缝这一小段：原片身份 → 原外轮廓 → 有方向起止点 → 毫米弧长 → 同序定位点 → 长度/间距差 → 配方保存/恢复。源顶点、三角索引、孔和厚度不改变。自动候选使用原顺序前两块 Uppers 与最大弦偏差不超过 0.75 mm 的局部直边研究规则；这个阈值是选择启发式，不是制造公差。P22/P23 不被自动认定为应当互缝的部件。

来源键为来源提交加边界指纹；构建另外记录 SHA-256。导入拒绝异源、异单位、退化边段、缺失部件与异常参数，不能通过 JSON 升级验收状态。改楦后原片仍只读，显式显示未重新适配。新对象可见性与参数能被测试，不伪装成影视效果提升。

## 接下来的方向

继续既有 R03_UPPER_LAST_MAPPING 任务，不先扩款：先把一块有真实语义的鞋面和原楦区域对应起来，保存部件边界、材料方向、接缝配对、缝份与展开/包覆误差，再接绷楦。之后独立推进脚—鞋—地接触及形变，与真实皮革表面精修；最后接人物实时上脚。鞋外观、材料力学和动作适配分开验收。

目前仍缺部件到楦面的标定、工艺方向/缝份、材料伸缩弯曲实测、可靠接触求解。商业 CAD 内核并未取得；原 TPE 工艺不能直接填成皮革材料参数；网页计算与真机性能也需单独验证。这些是无法靠多加几个按钮快速补齐的实际约束。现有参考足以继续本阶段研究，无须用户重发已经登记的七项；若进入指定皮鞋款式的一比一验收，再补那个款式的多视角结构及尺寸参考。

- [x] 没有生成图片代替真实三维。
- [x] 本轮实际修改源码，原 R02 及其他工作台不动。
- [ ] 公网交互工作台：以本次 public/QA.json 为准，不以本文自证。
- [x] 使用真实运行时原片几何，未改人物骨骼/动作。
- [ ] 镜头、选择、参数控制：以本次 browser/QA.json 为准。
- [ ] 固定 HTTPS 与真实公网浏览器：以本次 public/QA.json 为准。
- [x] 只有截图而没有工作台即交付失败。
