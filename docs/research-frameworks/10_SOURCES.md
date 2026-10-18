# 10 · 一手来源、阅读目标与项目证据索引

核对日期：2026-10-18。只采用官方文档、研究作者/团队网站和项目原仓库，不使用中国网站作为搜索来源。下面是本轮查证后的阅读索引，不声称恢复了旧回答的完整链接清单。

不上传论文全文、第三方示例素材、模型或外部源码。每条只保留链接与本项目要学习的能力。正式采用前再次核对版本、LICENSE/NOTICE、数据和依赖；访问成功不是兼容性或商业放行证明。

## 公开研究与官方资料

### S01 · OpenUSD

[Introduction to USD（release）](https://openusd.org/release/intro.html)

阅读目标：组合、引用、变体与payload的职责；用于RF02资产分层和RF07按需内容组织参考。采用release页，不把dev文档当已采用版本；本轮没有安装SDK。

### S02 · MaterialX

[MaterialX官方首页](https://materialx.org/index.html)

阅读目标：外观交换、标准节点、可扩展性与着色生成。官方公告已包含WGSL相关支持，不能沿用“完全不支持WebGPU语言”的旧假设；具体生成物仍需在项目运行时测试。

### S03 · OpenPBR

[OpenPBR Surface规范](https://academysoftwarefoundation.github.io/OpenPBR/index.html) · [原仓库](https://github.com/AcademySoftwareFoundation/OpenPBR)

阅读目标：通用表面模型、分层/混合、元数据及专用高级皮肤/毛发/布料的适用边界。它不是力学模型，也不规定所有renderer必须用相同近似。保留自有专用shader是可讨论路线，不为标准化牺牲现有效果。

### S04 · MaterialX集成边界

[官方第三方支持索引](https://materialx.org/ThirdPartySupport.html)

阅读目标：核对具体工具的集成职责，不能仅凭“某工具支持MaterialX”推断所有节点、纹理空间和外观都无损。不同工具版本在实际任务开始时单独验证。

### S05 · OpenColorIO

[OpenColorIO官方项目](https://opencolorio.org/)

阅读目标：把色彩管理与材质模型分开，为跨renderer比较固定颜色上下文。此项是RF02配套老师，不新增原排名名次，不自动迁移生产灯光或颜色流程。

### S06 · Ceres非线性最小二乘

[Ceres官方文档镜像：Non-linear Least Squares](https://ceres-solver.readthedocs.io/latest/nnls_tutorial.html)

阅读目标：参数块、残差块、鲁棒损失、参数界限及导数。主域本轮抓取返回错误，采用同项目文档镜像；不是第三方教程。框架本身不替我们构建合理的人体/材料残差。

### S07 · GTSAM因子图

[Factor Graphs and GTSAM](https://gtsam.org/tutorials/intro.html)

阅读目标：变量、测量、噪声模型和先验如何组织。主要借鉴估计图设计，不默认与Ceres同时集成，也不将机器人定位示例直接当人体重建完成。

### S08 · 可辨识性与协方差

[Ceres：Covariance Estimation](https://ceres-solver.readthedocs.io/latest/nnls_covariance.html)

阅读目标：噪声归一化、秩亏、规范自由度和协方差计算边界。用于阻止“低残差=真实参数已确定”的错误结论。

### S09 · 材质采样与像素足迹

[PBRT第4版：Texture Sampling and Antialiasing](https://pbr-book.org/4ed/Textures_and_Materials/Texture_Sampling_and_Antialiasing)

阅读目标：屏幕到材料/纹理空间变化率、采样与预滤的关系。作为RF04数学基础，不要求把离线路径追踪器移植到网页。

### S10 · 各向异性统计表达

[NVIDIA研究团队：The SGGX microflake distribution](https://research.nvidia.com/labs/rtr/publication/heitz2015sggx/)

阅读目标：方向性微结构如何用可插值/预滤的统计表达承接。只是RF04后续高级候选老师，不等于已复现或一套即插即用针织材质。

### S11 · BDDL历史方法

[StanfordVL/bddl-100归档](https://github.com/StanfordVL/bddl-100)

阅读目标：对象、初始条件、目标谓词和仿真后端的分离。旧StanfordVL/bddl链接已转向该归档；不能把它当持续维护的当前实现。主要借鉴任务定义与实际检查相分离的方法。

### S12 · 当前BEHAVIOR研究入口

[StanfordVL/BEHAVIOR-1K](https://github.com/StanfordVL/BEHAVIOR-1K)

阅读目标：任务、对象状态与实际仿真的接续结构。只作RF05老师，不把整个仿真平台、数据或环境搬进当前人物/服装项目。

### S13 · XPBD原始论文

[Macklin、Müller、Chentanez：XPBD: Position-Based Simulation of Compliant Constrained Dynamics（2016）](https://mmacklin.com/xpbd.pdf)

阅读目标：柔度、乘子、步长与约束更新；同时读近似条件。此次读取正文并核对第1和第3页图文/公式，不声称完成算法复现。论文链接不等于实现代码授权。

### S14 · IPC原始研究

[Incremental Potential Contact研究主页](https://ipc-sim.github.io/)

阅读目标：接触可行性、轨迹与非线性弹性联合求解的研究边界。不能把论文中的性质直接转授给只取了部分函数的本项目实现。

### S15 · IPC Toolkit

[ipc-sim/ipc-toolkit原仓库](https://github.com/ipc-sim/ipc-toolkit)

阅读目标：距离、接触、连续碰撞与摩擦组件；特别注意它不是完整物理求解器。用于RF06接口/对照设计，而非未经验证替换皮革生产内核。

### S16 · Flecs系统与流水线

[Flecs Systems](https://www.flecs.dev/flecs/Systems.html)

阅读目标：系统查询、处理顺序、读写与同步点。用于RF07明确各阶段职责，不证明移植后必然更快。

### S17 · Flecs查询成本

[Flecs Queries](https://www.flecs.dev/flecs/Queries.html)

阅读目标：组件组织、查询缓存与维护开销；以真实人物/服装工作负载检验，而非仅比较空实体微基准。

## 项目一手锚点

### P01 · 项目母本与长期原则

本项目提供的《GPT_PERSON_PROJECT_MASTER_CONTEXT_Humanoid_Rig_Lab_Next》《Humanoid Rig Lab Next 项目总记录与技术架构说明书母本》《GITHUB_HUMANOID_PROJECT_SYNC_RULES》《World Human System Direction》是架构/方向来源。本轮已读其提供内容；不把历史日期的固定节点数或开发状态当成2026-10-18全部运行事实。新窗口有这些Project文件时先读；没有时至少读取本档案共同边界并在目标仓库复核。

### P02 · S2.1共同协议

[固定protocol.js](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/fba814d4b34147dc637841f4dfe252653f68988c/reality-lab/hc-s2-1/protocol.js) · [固定测量字典](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/fba814d4b34147dc637841f4dfe252653f68988c/reality-lab/hc-s2-1/measurement-dictionary.json)

依据：共同对象0.2、五态、来源与测量规则。它与S3共享原则但不是同一序列化格式。

### P03 · S3固定实现与验收

[DELIVERY.json](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/3d16469ea89c41b29b350bd22a424abfe808dba0/reality-lab/hc-s3/DELIVERY.json) · [contract.js](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/e7df669b97a13ca79ff9b780ea21d20da7acd1d0/reality-lab/hc-s3/contract.js) · [Draft PR95](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/pull/95)

依据：七类固定快照、运行边界与已保存的历史浏览器结果。本次文档核对不冒称重新执行这些三维测试。

### P04 · 牛仔尺度局部先例

[固定scale.mjs](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/22cdb3f4c3bfd101bd86f0ffa246d255b561d915/denim-workshop/r17-scale/scale.mjs) · [PR87](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/pull/87)

依据：显示尺度声明与距离表达候选，不是材料实物测量或整衣物理认证。

### P05 · 皮革保护基线

[PR74](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/pull/74) · [固定R17入口](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/5f455d90273aa717f101c6bd8be6a5cb500c99fb/leather-workshop/r17/public-lite.html)

依据：历史工程与保护范围。具体后续有效版本须由新窗口重新核对，不能自动回退覆盖新工作。

### P06 · 材料集合公开定位

[公开registry](https://github.com/haihao0307/guilin-dem-pipeline/blob/fa5ad06ca9cc2e2fc61cecc304cab2a1e74f2776/kaopu-fabric-workbench/collection/r03-3be635ad51dc/registry.json)

依据：公开材料集合身份与能力声明；原源仓库及访问受保护资源不随此文档公开。公开registry可读不代表私有解密包可转发。

## 来源使用纪律

正式实现时记录采用的tag/commit与相应条款，不靠本页检索日期当版本锁。原始资料若迁移或无法访问，保留旧记录和新核对结果，不能偷偷换成相邻但不同的研究。算法、实现、资产、训练权重与实物证据分别登记；本轮没有复制外部代码或申请新的运行服务。
