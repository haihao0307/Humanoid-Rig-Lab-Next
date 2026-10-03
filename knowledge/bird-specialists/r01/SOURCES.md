# 来源登记

核查日期：2026-10-03。以下均为非中国网站的作者、出版社、机构论文或官方文档入口。摘要或项目页核查不等于阅读全文或复现算法。完整核查范围、授权状态和作者代码入口见 [sources.json](sources.json)。本库没有搬运第三方源码、模型或论文全文。

## S01
[Flocks, Herds, and Schools: A Distributed Behavioral Model](https://www.red3d.com/cwr/papers/1987/boids.html)

Reynolds，1987。局部鸟群规则；不是单鸟气动力。

## S02
[Interaction ruling animal collective behavior depends on topological rather than metric distance: evidence from a field study](https://pubmed.ncbi.nlm.nih.gov/18227508/)

Ballerini等，2008。特定野外群体的拓扑邻居证据；不是全物种常量。

## S03
[Optimal Reciprocal Collision Avoidance / ORCA](https://gamma-web.iacs.umd.edu/ORCA/)

作者项目。3D源码入口： https://github.com/snape/RVO2-3D 。其LICENSE文件已核查为Apache-2.0；本库未移植求解器。

## S04
[Realistic Modeling of Bird Flight Animations](https://grail.cs.washington.edu/projects/flight/wu2003realistic.html)

Wu与Popovic，2003。鸟类飞行动画的关节、羽毛、力矩和动力学控制优化。

## S05
[Three-dimensional, high-resolution skeletal kinematics of the avian wing and shoulder during ascending flapping flight and uphill flap-running](https://pmc.ncbi.nlm.nih.gov/articles/PMC3655074/)

Baier、Gatesy、Dial，2013。研究对象为石鸡，不能写成蜂鸟/鸽子或目标三鸟的实测关节参数。

## S06
[Birds of a Feather: Capturing Avian Shape Models from Images](https://yufu-wang.github.io/aves/)

Wang等，2021。作者代码： https://github.com/yufu-wang/aves 。代码LICENSE为MIT；数据和模型权利另查。方法使用关节模板与形态基。

## S07
[3D Bird Reconstruction: a Dataset, Model, and Shape Recovery from a Single View](https://www.ecva.net/papers/eccv_2020/papers_ECCV/html/2897_ECCV_2020_paper.php)

Badger等，ECCV2020。出版社论文入口；没有在本库运行其重建器。

## S08
[Discrete Elastic Rods](https://www.cs.columbia.edu/cg/rods/index.html)

Bergou等，2008。细杆、标架、平行传输和弯扭约束。

## S09
[Geometric Skinning with Approximate Dual Quaternion Blending](https://users.cs.utah.edu/~ladislav/dq/index.html)

Kavan等，2008。刚性变换的双四元数混合；不是解剖或防穿插保证。

## S10
[Bounded Biharmonic Weights](https://igl.ethz.ch/projects/bbw/)

Jacobson等，2011。有界平滑权重的离线求解。

## S11
[As-Rigid-As-Possible Surface Modeling](https://igl.ethz.ch/projects/ARAP/)

Sorkine与Alexa，2007。局部刚性表面形变；不保证无翻转。

## S12
[RBFInterpolator](https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.RBFInterpolator.html)

SciPy官方文档。核函数、平滑、多项式条件和局部邻域；实际安装版本后续锁定。

## S13
[XPBD: Position-Based Simulation of Compliant Constrained Dynamics](https://doi.org/10.1145/2994258.2994272)

Macklin、Muller、Chentanez，2016。本库只有独立的距离等式投影原型，不是完整接触系统。

## S14
[Damped Springs](https://www.ryanjuckett.com/damped-springs/)

Ryan Juckett，2012。阻尼系统解析推导；独立原型只实现恒目标临界阻尼。

## S15
[Analytic Two-Bone IK in 2D](https://www.ryanjuckett.com/analytic-two-bone-ik-in-2d/)

Ryan Juckett。平面两骨链；三维解剖平面、脚趾和接触另做。

## S16
[A Biologically-Parameterized Feather Model](https://diglib.eg.org/items/c7dcc8d2-2cdf-478a-93f1-5a29dea1f4b0)

Streit与Heidrich，2002卷期。生物结构参数化单羽与插值；核查出版社摘要，未复制完整实现。

## S17
[Symmetry breaking in the embryonic skin triggers directional and sequential plumage patterning](https://pmc.ncbi.nlm.nih.gov/articles/PMC6791559/)

2019研究论文。羽囊预图案、反应扩散、趋化与增殖；不是成年目标鸟的羽区测量表。

## S18
[Direct Texture Synthesis of Feather Pigmentation Patterns](https://www.scitepress.org/PublishedPapers/2007/20766/)

Franco与Walter，2007。Bezier几何与MCLONE色素图案；不是虹彩光学。

## S19
[Appearance Modeling of Iridescent Feathers with Diverse Nanostructures](https://doi.org/10.1145/3687983)

Yu等，2024。近似波动光学与空间变化BRDF分布，核查出版社摘要和元数据。

## S20
[A Surface-based Appearance Model for Pennaceous Feathers](https://onlinelibrary.wiley.com/doi/10.1111/cgf.15235)

Padron-Griffe等，2024。羽片表面散射近似，不能替代显微几何。

## S21
[Theoretical morphospace reveals mixed optimisation of the avian wing planform for flight style](https://www.nature.com/articles/s41467-026-70692-w)

Walters等，2026。翼平面形态空间与性能权衡；不是通用翼控制器。

## S22
[State-space aerodynamic model reveals high force control authority and predictability in flapping flight](https://pmc.ncbi.nlm.nih.gov/articles/PMC8331236/)

Bayiz与Cheng，2021。动态缩比机械翼数据上的PRSSM。作者代码： https://github.com/yagiz-bayiz/flapping-wing-aerodynamics-prssm 。数据： https://datadryad.org/dataset/doi%3A10.5061/dryad.zgmsbccbs 。未移植、训练或完成代码/数据授权审核。

## S23
[The Function of the Alula in Avian Flight](https://www.nature.com/articles/srep09914)

2015研究论文。小翼羽的高迎角机制；实验条件外推须重验。

## S24
[On the role of tail in stability and energetic cost of bird flapping flight](https://www.nature.com/articles/s41598-022-27179-7)

翼尾协同、稳定与功耗；未在此统一确认出版年份，不从DOI猜测。

## S25
[Electrostatic adhesion mitigates aerodynamic losses from gap formations in feathered wings](https://www.nature.com/articles/s44172-025-00452-z)

Haughn等，2025。人工电黏附羽翼，仅借鉴缝隙控制问题，不把静电写成真实鸟羽机制。

## S26
[Model of Peacock Tail Covert Feather Based on Its Microscopic Structure](https://li01.tci-thaijo.org/index.php/cast/article/view/135597)

Vilasineewan、Siripant、Meckvichai。孔雀尾上覆羽曲线模型，页面2018上线、卷期2012，差异保留。核查出版社摘要。
