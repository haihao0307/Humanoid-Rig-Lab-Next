# 来源、实际阅读范围与适用边界

本页资料于 2026-09-16 阅读或复核。下列摘要是本项目整理，不能代替原文。只保留链接、关系和自主实现所需的原则，不保存参考模型、纹理、图片或论文整篇内容。

## 解剖与动态结构

| 来源与类型 | 本次实际阅读 | 可借鉴的结论与边界 |
|---|---|---|
| [Latham & Deaton, 1976：人中与唇红边肌肉结构](https://pmc.ncbi.nlm.nih.gov/articles/PMC1231826/)，原始组织学研究 | 摘要；研究为 7 份尸体标本，不声称全文图版均已读 | 人中嵴与肌束在皮肤的插入关系有关，中央沟与两侧组织并非两条外贴圆柱。用于理解连续支撑关系，不据此编造统一毫米尺寸。 |
| [Pinskiy & Miller, Disney, 2009：程序化眼部运动](https://disneyanimation.com/publications/realistic-eye-motion-using-procedural-geometric-methods/)，作者论文；[单页全文](https://media.disneyanimation.com/uploads/production/publication_asset/66/asset/realisticEyeMotion.pdf) | 页面和单页正文 | 附着区与牵拉区、球坐标松弛、平滑位移衰减和褶皱展开协同工作；眼睑应沿眼球接触面滑动。该文将部分渲染/虹膜工作列为后续内容，不能引用它证明本项目眼球光学已完成。 |
| [AAO EyeWiki：Eyelid Reconstruction](https://eyewiki.aao.org/Eyelid_Reconstruction)，专业综述 | 解剖与基本结构段 | 外侧皮肤/肌肉、内侧黏膜与支撑层、贴球睑缘和眼角有各自作用。这里只用于解剖交叉核对；不是原始实验研究，也不采用临床操作作为建模步骤。 |
| [Kim / Jeong, 2019：Surgical anatomy for Asian rhinoplasty](https://pubmed.ncbi.nlm.nih.gov/31256550/)，作者解剖综述 | PubMed 摘要和图 14 / 16 说明文字；没有声称看过被阻挡的全文图片 | 鼻底包含鼻柱基部/柱、鼻尖下方三角区、侧壁、鼻翼基部和鼻孔槛等连续亚区；侧壁及鼻孔槛含独立软组织支撑。只借鉴关系，不把特定人群/手术目标作为角色统一比例。 |
| [Demiryurek 等，2003：Three-dimensional structure of the modiolus](https://pubmed.ncbi.nlm.nih.gov/12939669/)，原始组织学重建 | 口角负责人实际阅读 PubMed 摘要的目的、方法、结果与结论；未读全文图版 | 作者通过连续组织切片重建，将 modiolus 描述为由黏膜向真皮延续的钝锥样三维组织。用于理解角部有厚度的连续连接，不照抄为皮肤表面必须出现一个锥体，也不从摘要推导本项目角点半径。 |
| [Sun 等，2018：Anatomical Characterization and Three-Dimensional Modeling of the Muscles at the Corner of the Mouth](https://pubmed.ncbi.nlm.nih.gov/29927831/)，原始碘染色 micro-CT 研究 | 口角负责人实际阅读 PubMed 提供的摘要文字；未观看附属视频或全文图版 | 作者观察到肌束沿自身走向连续，汇合区并非混乱团块；口轮匝肌边缘部与深层颊肌相接。借鉴连续走向和黏膜回折的结构关系，不引入研究网格、图像或临床操作。 |
| [Choi 等，2021：mentalis 尸体与超声研究](https://pubmed.ncbi.nlm.nih.gov/33514053/)，原始解剖研究 | 口角负责人实际阅读 PubMed 摘要与图说明文字；未声称读取完整图版 | 样本中颏肌既有三维穹隆形也有扁平形，左右组织可合并或分离。用于提醒下巴存在连续支撑与个体差异；肌肉厚度和深度不能直接等同于面部表面需要外推的高度，也不采用治疗步骤。 |

上述鼻底综述的 [PMC 全文入口](https://pmc.ncbi.nlm.nih.gov/articles/PMC6615416/) 在知识库整理时受到验证码阻挡，因此阅读范围限定为 PubMed 实际提供的文字。表内口角与颏肌资料由模块负责人补充实际摘要阅读记录，均不冒称已读全文；口角帽的 1.8 mm 作用域、0.177 mm 曲率半径等是项目自主设计，不能归因于这些研究。

## 3A 艺术家的一手制作资料

| 作者来源 | 实际观察 / 阅读 | 项目如何使用 |
|---|---|---|
| [Colin Thomas — Uncharted 4 / Sam](https://colinthomas.artstation.com/projects/xZkOm)；[作者个人站](https://www.formsintris.com/uncharted4) | 原作者页面、灰模与皮肤图；后台浏览器放大图像已查看 | **本项目观察**：鼻翼包覆鼻孔底面，鼻柱延续到人中，唇形受整体口周体积支撑，眼睑有与眼眶相接的厚度。它们是看图所得判断，不是作者公开了这些精确构建公式；不复制角色身份、年龄或素材。 |
| [William Paré-Jobin — Real-time character breakdown](https://marmoset.co/posts/real-time-character-design-creation-and-presentation-breakdown/) | 作者制作过程正文 | 多角度参考和主要比例先行，细节逐层建立，换光检验。作者工作流含外部素材，本项目只学习顺序和检查方法，不采用其中素材。 |
| [Saurabh Jethani — Realistic skin in Toolbag](https://marmoset.co/posts/creating-realistic-skin-toolbag-saurabh-jethani/) | 作者皮肤、粗糙度、尺度、灯光和眼部段 | 区域粗糙度与微小起伏分工；唇部不能直接铺同一皮肤毛孔；鼻唇角过量 AO 会变脏。Toolbag 中的示例数值不是生理测量，不能原样当作本引擎标定。 |

艺术图像中的光照、曝光、相机、扫描或后期条件不完全已知。观察形体关系时优先对照灰模和多角度；不要从成品颜色反推唯一几何或真实皮肤反射率。

## 皮肤和多尺度渲染

| 来源 | 实际阅读 | 方法与限制 |
|---|---|---|
| [d’Eon / Luebke — GPU Gems 3，第 14 章](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-14-advanced-techniques-realistic-real-time-skin) | 表面反射、皮下扩散与区域材质段 | 高光反射与内部散射要分离；只增加毛孔法线仍可能干硬。RGB 扩散尺度不同。`F0≈0.028` 来自所选折射率示例，是当前简化参考值，不是所有皮肤的统一测量。 |
| [Jimenez 等 — Separable Subsurface Scattering](https://www.iryoku.com/separable-sss/) | 作者页面摘要及代码版本说明 | 两次一维卷积近似扩散；其硬件性能不能移作本项目结论。页面旧代码与最终论文存在差别。本项目当前尚未实现该扩散算法。 |
| [Hery / Kass / Ling — Geometry into Shading, Pixar, 2014](https://graphics.pixar.com/library/BumpRoughness/paper.pdf) | 原论文检索正文的摘要与引言；直接打开旧 URL 时重定向到新版资料库 | 子像素几何应影响微表面粗糙度，单纯滤平起伏会丢失外观。当前实现借鉴该统计原则，不称完整重现论文的纹理矩算法。 |
| [Zirr / Kaplanyan — Real-time Rendering of Procedural Multiscale Materials, 2016](https://research.nvidia.com/publication/2016-02_real-time-rendering-procedural-multiscale-materials) | 作者机构页面摘要；皮肤模块负责人另行阅读相关方法 | 多尺度层级与像素足迹用于稳定微细节。本项目没有实现论文的完整双尺度 NDF / glint 系统，也不将其闪烁材质外观直接套到皮肤。 |
| [Adobe 官方：用 Designer 改进墙体并送入 Painter](https://www.adobe.com/learn/substance-3d-painter/web/how-to-improve-a-sculpted-wall-with-designer-and-send-it-to-painter) | 大形、分层噪声、高度/法线/AO/曲率和位移检查段 | 可借鉴主形优先、分频、幅度控制及派生通道关系。教程含手工雕刻输入，不是纯函数从零造墙的证明；本项目不导入其高度图、节点包或输出资产。 |

## 用户自己的 Brick / Tiles 源码

以下读取了固定提交中的实际文本，未在本轮重新运行它们；聊天中“已经成功”的描述只作检索线索。具体函数和限制见 [程序化方法](PROCEDURAL_METHODS.md)。

- **Tiles**：[HOUSE / START_HERE.html，提交 ddbdff0…](https://github.com/haihao0307/HOUSE/blob/ddbdff0aac1a41d77514a9494fa4098780bb17e9/START_HERE.html)。实际阅读 `tilePoint`、`ceramic`、`shapeBand`、`microshape`、`microscopeSurface`、法线及材质接线。源内对 Yohei Nishitsuji 的方法归因保留为上游注释；本次没有独立核对其原始作品，不扩大归因。
- **Brick**：[Brick_Mother_Wall_4x3_R3_6.html，提交 9f60fb9…](https://github.com/haihao0307/HOUSE/blob/9f60fb9e7d288377855d8ba542bdb9a56dd95bdb/yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/Brick_Mother_Wall_4x3_R3_6.html)。包装页实际载入 `experiments/wall-4x3-r3-6/parts/part-01.txt` 至 `part-08.txt`；本次读取并拼接这 8 份源码后检查 `mgeom`、`mobs`、`coreGeom`、SDF、法线、抹灰覆盖和 seed。

固定提交使方法讨论可复查；它们不是当前人物模块的生产依赖。后续链接失效时优先寻找原作者的新官方位置，保留旧出处和失效日期，不下载整套资产填补来源。

## R19 源曲面插值方法复查

2026-09-16 在改源曲面前实际阅读了以下官方方法说明；它们提供数学背景，不是人体解剖证据，也不包含本项目可直接采用的角色资产。

- [PBRT 第三版 8.6.1 — Spline Interpolation](https://www.pbr-book.org/3ed-2018/Reflection_Models/Fourier_Basis_BSDFs#SplineInterpolation)：阅读该小节的 Hermite 端点值/导数约束、Catmull–Rom 中心差分及边界处理；没有声称研读整本书。借鉴的是跨单元共享节点导数与张量形式。项目实际采用自主的有界双三次 Hermite 构造，不复制 PBRT 的 BSDF 或源码。
- [SciPy — PchipInterpolator](https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.PchipInterpolator.html)：阅读 Notes 中的调和斜率、单调性、C1 连续而 C2 未保证等说明。项目借鉴其极值保护原则，并自行加入每个节点统一缩放导数、限制相邻 Bezier 控制点的二维规则；**不是完整二维 PCHIP 的论文实现或全局 C2 证明**。

实际算法与 A/B 范围见 [R19 源曲面修复](PROCEDURAL_METHODS.md#r19源曲面内部格线修复)。新实现仍须经过真实运行图像审查，不能由插值理论直接推断面部达标。

## 眼材质负责人补充阅读记录

以下由眼材质负责人于同日实际阅读并用于下一版自主实现；本知识整理未再逐页复核，不能把新实现视作已获画面验证。

- [Epic Digital Humans — Eye Shading](https://dev.epicgames.com/documentation/unreal-engine/digital-humans?application_version=4.27)：角膜层、虹膜及 limbus 的分工；仅借鉴结构和渲染关系，没有导入示例人头或眼球资产。
- [NIST 发布的 Arun Ross 虹膜结构讲义](https://www.nist.gov/system/files/documents/forensics/Ross-Presentation.pdf)：collarette 与 crypt 等虹膜结构术语；讲义不是本项目的虹膜测量数据，也不意味着本项目复现生物识别模型。

R19 眼部负责人另报告实际重读了上表的 Disney 单页全文与 EyeWiki 睑重建解剖段，并补充以下资料。此处记录其阅读范围；根代理与文档追加者没有逐页复核全部眼部来源。

- [AAO EyeWiki — Eyelash Ptosis](https://eyewiki.aao.org/Eyelash_Ptosis)：实际阅读 Anatomy 与正常睫毛方向段，用于前睑缘附着、向前上方投射的结构关系；不采用疾病治疗步骤。
- [AAO EyeWiki — Madarosis](https://eyewiki.aao.org/Madarosis)：实际阅读 Anatomy 段，用于区分上睫毛向上弯、下睫毛向下弯的方向；不是对本项目根数、长度、曲率或人群尺寸的测量支持。
- [University of Michigan Kellogg Eye Center — External Eye](https://kellogg.umich.edu/theeyeshaveit/anatomy/external-eye.html)：实际阅读该短页标注，用于泪阜、半月襞、内眦汇合及虹膜/巩膜的角色区分。没有导入其图像、网格或纹理。

眼部改动的深度、宽度与弯曲尺度均为自主参数。眼部负责人对 R19b 正/侧、半闭及闭眼实拍的限定观察是：开眼厚拱减弱，但中央闭眼仍呈圆凸盖片，泪湖仍像粉色片；这些来源不能替代失败项或证明达到 3A。

## R20 皮肤专项：2026-09-17 阅读记录

本轮先阅读下列一手说明，再修改材质与光传输。参考内容仅用于方法，不下载作者模型、扫描、纹理、节点包或示例场景。

- [Saurabh Jethani / Marmoset](https://marmoset.co/posts/creating-realistic-skin-toolbag-saurabh-jethani/)：重读 Sculpt、Textures、Skin Material。采用区域粗糙度、浅表面起伏、孔内反光减弱、独立双高光的分工；制作中的精细变化需要换光检查。本项目把这些职责写成独立函数，没有采用作者的贴图或材料数值整套配方。
- [d’Eon / Luebke，GPU Gems 3 第 14 章](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-14-advanced-techniques-realistic-real-time-skin)：重读表面反射、扩散剖面与多高斯近似。表面镜面分量应保留，扩散只处理组织内的漫反射；窄层与宽层组合有助于避免单一大模糊的蜡感。本项目的尺度及 RGB 权重均自主设定，没有复用论文测量表或源码。
- [Epic Digital Humans，UE 4.27](https://dev.epicgames.com/documentation/en-us/unreal-engine/digital-humans?application_version=4.27)：阅读 Skin Shading 中的双高光、微/中尺度法线、粗糙度与散射边界说明。没有导入 Digital Humans 示例。文中微法线链接在工具中返回不支持的媒体类型，未将其计作实际图像观察。
- [Jimenez 等，Separable Subsurface Scattering](https://www.iryoku.com/separable-sss/)：重读作者摘要、限制及旧代码与最终论文差异说明。借鉴两次一维卷积的思路；新 `SkinTransport.js` 是本项目独立的屏幕空间近似，并非完整复现论文。上表“尚未实现”的条目记录的是 R18 阅读时的状态。

本轮研究主要来自实际可读正文。不得把文字阅读写成已经逐张看过上述作者全部渲染图或看过被阻挡的视频。

## R21 外貌数据与结构复查：2026-09-17

以下由本轮主执行者阅读，均只采用方法，没有下载或搬入第三方资产。

- [Epic — MetaHuman DNA, Rig Definition and Rig Operation](https://dev.epicgames.com/documentation/en-us/metahuman/metahuman-dna-rig-definition-and-rig-operation)：阅读数据版本、静态身份与运动求值分工。用于本项目参数配方的职责设计；没有实现或导入 MetaHuman DNA 文件。
- [Saurabh Jethani / Marmoset](https://marmoset.co/posts/creating-realistic-skin-toolbag-saurabh-jethani/)：重读雕刻、纹理、区域粗糙度与光照检查段。R21 减少中频色素斑块，额鼻油脂与脸颊粗糙度分别控制，尚不能因此认定已消除塑料感。
- [Disney — Realistic Eye Motion Using Procedural Geometric Methods](https://media.disneyanimation.com/uploads/production/publication_asset/66/asset/realisticEyeMotion.pdf)：读取单页文字，重点是运动区域、牵拉区域和闭眼展开。PDF 图像截图未成功，不声称本轮看过该图。项目闭眼展开、边界约束是自主近似，不是论文代码复现。
- [Kim / Jeong，鼻底结构](https://pubmed.ncbi.nlm.nih.gov/31256550/)：读取摘要及图 14、16 的文字说明，关注鼻底亚区、鼻翼侧壁与鼻槛；未导入或使用临床图像。所有局部尺寸为自主设定。
- [Elsevier Complete Anatomy — Maxillary Central Incisor Tooth](https://www.elsevier.com/resources/anatomy/skeletal-system/axial-skeleton/maxillary-central-incisor-tooth/23391)：本轮读取 Key Features 与 Function 正文，区分牙冠表面与薄切缘；没有打开或下载其三维模型。牙冠宽度、圆角与牙间距是作者设定，不是该文提供的人体测量。

## R22 自查：2026-09-18 阅读记录

- [Disney — Realistic Eye Motion Using Procedural Geometric Methods](https://media.disneyanimation.com/uploads/production/publication_asset/66/asset/realisticEyeMotion.pdf)：重新读取单页文字中的运动区、牵拉区、皮肤展开和眼球接触段落。尝试共享位移场的自主近似，实际画面未通过，已经撤回。没有复现其球面坐标松弛算法，不把读过文字写成看过作者图像或代码。
- [Kim / Jeong — Surgical anatomy for Asian rhinoplasty](https://pubmed.ncbi.nlm.nih.gov/31256550/)：本轮读取 PubMed 摘要和图注，包括鼻侧软组织、鼻底亚区的文字说明。新的鼻梁曲面、鼻腔方向遮挡均为本项目自主模型及参数，不是文中测量值；没有下载临床图片或模型。

## R23 男性体面与毛发：2026-09-18

- [Proko — 正面头部构建](https://www.proko.com/course-lesson/how-to-draw-the-head-front-view)和[眼部结构](https://www.proko.com/course-lesson/how-to-draw-eyes-anatomy-and-structure)：主执行者实际阅读官方 Lesson Notes，研究眉骨、眼球、睑缘及构建比例；没有打开或下载课程三维模型。
- [Marco Bucci — 头部体面与光照](https://www.proko.com/lesson/painting-the-head-from-imagination-lighting-without-reference-with-marco-bucci)和[Proko — 鼻部结构](https://stanprokopenko.com/2012/09/video-draw-nose-anatomy-structure/)：独立研究执行者读作者文字，强调体面的连续关系、整体比例优先；主执行者未逐页复核这两篇全文。
- [Goldstein / Katowitz 2005](https://pubmed.ncbi.nlm.nih.gov/16052142/)、[Sclafani / Jung 2010](https://pubmed.ncbi.nlm.nih.gov/20231595/)：眉毛执行者读取两份完整摘要，采用较低、较平、眉峰较克制的造型方向；不是完整论文或本角色尺寸来源。
- [Rajput 2021](https://www.thieme-connect.com/products/ejournals/pdf/10.1055/s-0041-1739253.pdf)：眉毛执行者阅读第 490 页毛流文字；PDF 图示未成功查看。另由研究执行者阅读[眉毛形态与方向](https://jcasonline.com/the-science-and-art-of-eyebrow-transplantation-by-follicular-unit-extraction/) anatomy/毛流段。只借鉴眉头、眉体、眉尾的方向关系，不采用临床操作或其审美标准。
- [EMS 2023](https://arxiv.org/abs/2309.12787)：研究执行者仅读摘要，将根点、方向场、终止长度分开；未下载其数据、模型或代码。
- [Dua / Verma / Dua 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8719972/)：胡须执行者读搜索索引返回的区域方向和渐稀边界正文，直接 PMC 打开被 CAPTCHA 阻挡；未查看临床图片。[区域生长研究摘要](https://pubmed.ncbi.nlm.nih.gov/30580453/)、[毛干形态摘要](https://pubmed.ncbi.nlm.nih.gov/2402610/)仅提供区域差异背景，后者有单受试者限制。胡须长度、直径、密度均为本项目美术设定。
- [Epic Digital Humans — Eye Shading](https://dev.epicgames.com/documentation/en-us/unreal-engine/digital-humans?application_version=4.27)：主执行者重读透明角膜、虹膜、湿润表面的分工。只借鉴结构关系，没有采用页面建议的示例眼球、纹理或材质资产；自主球冠不等于实现文中的折射模型。
