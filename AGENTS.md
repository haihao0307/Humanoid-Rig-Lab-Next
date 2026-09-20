每次只验证文件内容，不要操作用户鼠标。先联网调研，再修改代码。

人体只保存生成函数、参数、关系和来源。不提交扫描网格、预制模型、图片贴图、烘焙顶点数组或历史构建副本。

编辑 source/assembly.json 指向的源码，用 node tools/build-pure.mjs 装配 index.html；用 node tools/check-pure.mjs 做文件检查。不要运行网页、人物模拟或 GPU 来代替文件验证，除非用户另行授权。

采用 body/HumanDNAContract.json 中固定来源的靠谱/Object DNA 方法。该适配器仍为 Candidate；源文件检查不能升级为视觉验收或生产就绪。不要把其他聊天的判断当作独立观测。

## 所有 Mother 共用视觉产出规则

本仓库及相关人物/动物/动作 Mother 默认禁止调用图像生成或图像编辑工具。禁止生成概念图、效果图、预览图、参考图、海报、缩略图，也禁止用静态图片替代真实三维成果。

只有用户在当前对话中明确要求“生成图片”“做图片”“修改图片”“给截图”等图片输出时，才允许进入图片工具流程。用户提出“做一个看看”“试试做一个”“给我看成果”“参考这个形状做一个”时，默认交付真实三维文件、程序化几何、可交互 HTML、Three.js/WebGPU 工作台或相应生产源码。

浏览器自动化可以内部保存 QA 截图作为检查证据；未经用户明确要求，不把 QA 截图作为创作成果发送。

## 真实三维工作台硬门禁

任何“做一版”“重新做”“继续做”“给我看”“按参考做”的任务，都必须落实到真实人体/动物生成源码、骨骼、动作、程序化几何和可交互三维工作台。未经用户在当前对话中明确要求图片，严禁调用图像生成或图像编辑工具，严禁用概念图、效果图、静态截图、视频、Canvas 假画面或占位页代替三维实现。

如果还没有可运行的三维版本，继续修改源码并明确尚未形成可验收成果；不得生成图片填补进度。只有截图而没有工作台，本轮自动判定失败。

每一份规划、任务卡、README、START_HERE、交接包、会议纪要和验收清单都必须包含：

- [ ] 没有用生成图片代替真实三维实现；
- [ ] 已实际修改生产源码；
- [ ] 用户看到的是可交互三维工作台；
- [ ] 人物/动物几何、骨骼和动作来自真实运行时；
- [ ] 镜头、选择、动作或参数控制可以实际操作；
- [ ] 公网固定链接和真实浏览器已验证；
- [ ] 如果只有截图而没有工作台，本轮判定失败。


## KAOPU Mother Production OS R2 — 跨仓库强制规则

本仓库全部 Mother / Codex / 子执行端同时遵守 KAOPU 中央生产制度：
`haihao0307/guilin-dem-pipeline/knowledge/MOTHER_PRODUCTION_OPERATING_SYSTEM_R2_ZH.md`

相关中央硬门禁：
- `REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE.md`
- `TASK_FRESHNESS_AND_NO_STALE_DELIVERY_GATE.md`

默认流程固定为：`LOCK → EXECUTE → VERIFY → PROMOTE`。

任何“按参考做 / 复刻 / 学习 / 照着做 / 不要想象补画”任务默认：
- `TASK_MODE=REPLICATION_LOCKED`
- `CREATIVE_AUTHORIZATION=false`

未经用户当前任务明确授权，不得自行简化、补画、重新设计、做 generic/toy/placeholder，也不得为了“先给用户看”制造一个差不多的可见替身。未知区域保持 UNKNOWN / SOURCE_ENTRY_REQUIRED / MEASUREMENT_REQUIRED。被拒绝的创作替代不得成为下一版父节点。

任何“这是最新结果 / 昨晚做的 / 本轮修改后的效果”必须证明发生在当前任务 dispatch 之后，并绑定当前 head。旧模型、旧页面、旧截图、旧 release 只能作为 BASELINE/BEFORE；没有新成果时必须报告 `NO_NEW_ARTIFACT`，不得拿旧产物填空。最新构建失败时不得 silent fallback 后把旧版冒充当前版。

每个明确任务只处理一个 primary defect，并记录最小 Task Anchor：target、baseSha、accepted baseline、reference set、protected invariants、forbidden routes、acceptance gates。Producer 不能批准自己；候选在进入用户视野前至少通过 Contract / Freshness / Reference Fidelity / Machine gates。两次内部失败仍未解决同一 bounded task 时进入 ROOT_CAUSE_REVIEW，不继续凭感觉微调。

用户的重要纠正必须进入 regression case，避免同类错误再次由用户发现。评估进展只看目标相关 fresh delta、实际测试和门禁，不看 branch/Issue/README/截图数量。

以上为生产制度，不覆盖本仓库更严格的领域专用规则；如有冲突，用户当前明确指令与更严格冻结/安全/真值规则优先。
