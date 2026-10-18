# 人物与服装研究框架 · 跨窗口总入口

档案版本：RF-HANDOFF-20261018-R1。文档整理日期：2026-10-18。

这份文件解决“对话间隔太久，忘记研究框架、原因与下一步”的问题。它保存原排名及第2—7名的项目化实施指南，不是六个已开发完成的系统，也不授权六条支线同时开工。

## 新窗口先读哪里

先读 [完整排名与导航](docs/research-frameworks/README.md)，再读 [现有事实与保护边界](docs/research-frameworks/00_CONTEXT_AND_BOUNDARIES.md)。选定一个 RF 编号后，读取该项专项文件和 [可复制任务指令](docs/research-frameworks/09_WINDOW_TASKS.md)。

| 原排名 / ID | 框架 | 专项入口 |
|---|---|---|
| 1 / RF01 | 现实世界契约与验证实验室，当前称世界规范/世界基准 | 原实现 [S3状态](reality-lab/hc-s3/TASK_STATE.json)，不在本轮重复开发 |
| 2 / RF02 | OpenUSD + MaterialX + OpenPBR：资产与材质交换 | [资产、变体与材质](docs/research-frameworks/02_ASSET_MATERIAL_INTERCHANGE.md) |
| 3 / RF03 | 因子图 + Ceres / GTSAM：证据驱动逆向求解 | [从证据求参数](docs/research-frameworks/03_EVIDENCE_INVERSE_SOLVING.md) |
| 4 / RF04 | 材质尺度空间 | [近远景连续材质表达](docs/research-frameworks/04_MATERIAL_SCALE_SPACE.md) |
| 5 / RF05 | 世界语义 / Affordance | [人物与物件能做什么](docs/research-frameworks/05_SEMANTICS_AFFORDANCE.md) |
| 6 / RF06 | XPBD统一约束物理 | [先统一接口，再评估求解器](docs/research-frameworks/06_CONSTRAINT_PHYSICS_XPBD.md) |
| 7 / RF07 | ECS / 流式加载大世界运行时 | [人物与服装运行调度；大世界暂缓](docs/research-frameworks/07_ECS_STREAMING_RUNTIME.md) |

原排名通过历史检索恢复；本档案的详细工程说明是本轮重新整理并核对来源的设计稿，不是旧回答逐字转录。排名表示当时对本项目的预期价值，不是行业排名或已测收益。原始全文未完整恢复，未伪造原评分、原链接或原引文。

## 一句话交给其他窗口

> 请读取 haihao0307/Humanoid-Rig-Lab-Next 的 RESEARCH_FRAMEWORKS_START_HERE.md（必须使用本档案所在分支或固定提交，不要只搜索 main）。本次只接续 RF02；完整读取对应专项、共同边界与任务条，先核对相关工作台最新 README、BUILD_MANIFEST、TASK_STATE、源码、PR与活动分支，再执行第一轮最小实验。不能把文档当已实现、把旧回执当本轮新测试，不能覆盖其他窗口。

把 RF02 改为选定的 RF03、RF04、RF05、RF06 或 RF07 即可。后两项尤其不能未经验证替换现有求解器或启动整个大世界。

## 其他必要文件

[依赖与验收](docs/research-frameworks/08_DEPENDENCIES_AND_ACCEPTANCE.md) · [来源与阅读顺序](docs/research-frameworks/10_SOURCES.md) · [机器可读登记](docs/research-frameworks/framework-registry.json) · [任务状态模板](docs/research-frameworks/task-state.template.json)

本次只新增文档和元数据。旧网页、人物、裁片、布料、鞋、灯光、shader、几何、物理、依赖和工作流不修改。保持独立 Draft，不合并、不强推、不改写历史。跨窗口可读不等于已经进入默认分支；请保存固定提交链接。
