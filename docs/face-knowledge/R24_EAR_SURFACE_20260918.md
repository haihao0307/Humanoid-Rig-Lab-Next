# R24 外耳源曲面定位与局部修复

日期：2026-09-18。本研究者实际查看了 `G:\Three.js\Human\face-r24-sculpt-c-20260918\world-profile.png`：耳廓内侧和耳垂附近存在明显三角折面，耳轮外缘相对连续。C 入口 SHA-256 为 `534e58e0073ceaaa986176699b7a056554ab679854869617c06e53627ce913df`。这次不是整耳解剖重做，而是定位并修正可确定的曲面插值与采样问题。**局部生产修改已完成；随后独立查看 E 侧面，大块三角折面明显减轻，局部小棱和贴缝感仍在，可以保留这项局部改进，但不能宣布整耳自然或达到 3A。** E 实际为 balanced 档，其完整源网格为 587,504 三角形，详见后面的档位更正；此前 preview 数值不是 E 截图预算。

所有数值证据和仓库外候选位于 `G:\Three.js\Human\face-r24-validation-20260918`。未修改原始系数、导入第三方资产或用静态图替代三维实现。研究原则见 [R24 研究](R24_SCULPT_RESEARCH_20260918.md)，主过程见 [R24 执行记录](R24_SCULPT_EXECUTION_20260918.md)。

## 真正的三层所有者

| 层 | 已确认事实 | 含义 |
|---|---|---|
| 原始高度场 | 可见外耳属于 `features.chf.gz` 的 `FJ2811`，共 272 域、663 条相关 canonical 边界。features 全组共 4,279 域；其中大量域属于别的特征 | `detail/head_face_ears` 只包括相邻头侧皮肤。移除 `headInteriorBlend` 的耳区保护不会改变 FJ2811，不能用该实验声称修好外耳 |
| 插值 | 原 `surface-kernel.mjs` 只对 `head_face_ears` 开启 bounded cubic；FJ2811 保留逐层 bilinear，内部系数网格处可以发生斜率跳变 | 应针对 FJ2811 的内部函数连续性；不能整耳平滑、删掉耳轮/耳甲腔边界 |
| 网格采样 | preview 的 features 基础额度 2,000 次 split 平分给 4,279 域；FJ2814 另有脸部额度，既有耳额度只给 detail 下垫皮肤。FJ2811 全部 272 域实际仅分得 93 次，用 85 次 | 可见外耳没有获得既有耳加密逻辑。只改光照或插值仍会留下大三角形 |
| 着色法线 | `normal-field.mjs` 存在 FJ2811 独立 0.25 mm 稀疏场，40,596 方向项；结果依赖几何 hint，稀疏无值时退回 hint | 不能误报“耳部没有平滑法线”。有数据区域通常已平滑，覆盖边界和 fallback 仍可能跳变 |

初版 preview 单组耳网格在全局 finalize 前为 5,055 三角形、3,338 顶点，2,479 个三角形仍触发细分条件但受配额限制。边长中位数 2.228 mm、p95 8.335 mm、最大 29.162 mm。features 全组剩余 1,763 次额度，并没有流给耳部。证据：`ear-feature-mesh-baseline-preview.json`。这些是实际运行源采样器得到的值，未运行整个浏览器工作台。

## 拒绝直接全域 cubic，保留耳轮边界

先做了仓库外 FJ2811 全域 bounded cubic 实验，沿用原系数和 canonical trim。29,472 个实际内部 knot 两侧探针中，几何法线跳变 p99 从 10.639°降至 .004832°，最大从 46.337°降至 .047759°；高度位移 p95 .03532 mm、最大 .161713 mm。6,630 个边界位置完全不变。但**边界几何法线最大改变 42.668°，经 normal-field 后个别最大改变 73.906°**。共边位置没裂开不等于耳轮转向被保留，故拒绝直接整合这个版本。证据保留为 `ear-feature-diagnostic-unprotected.json`、`ear-feature-full-source-unprotected.json`。

最后采用 FJ2811 内部 bounded cubic，同时在每条 trim 边界内侧 .25 mm 范围乘上五次 C2 窗口。边上回到原线性高度和原导数；远离边界后才进入 cubic。多个窗口相乘并解析计算梯度，耳轮和耳甲腔角点同样保留。这个宽度是自主实现设定，取现有法线场一个单元宽度，不是人体测量。`headInteriorBlend` 原来的头侧耳保护 mask 保持原样。

保护版本的同组检查：

- 29,472 个 knot 探针：几何法线跳变 p99 10.639°→1.321°；着色场跳变 p99 .9984°→.05148°。原边界附近的最大值被有意保留，不能写成所有斜率跳变均消失。
- 6,630 个 canonical 边界点：位置差为零，几何/着色法线角差最大约 .00000191°，属于角度计算的舍入量级。
- 1,530 个非 knot 位置的差分导数检查：解析法线与数值法线最大差 .00007152°，包含新窗口的梯度。
- 其他 features 的 12,021 个位置/法线检查：误差均为零。
- 最终高度变化 p95 .03486 mm、最大 .161713 mm；这是窄范围的插值调整，没有抹平整个耳廓。

证据：`ear-feature-diagnostic.json`。探针检查不等于连续空间证明，也没有验证任意新 NPC 或极端变形。

## 专用配额与内部三角质量

| preview 候选 | FJ2811 独立附加额度 | 耳三角形（finalize 前） | 边长中位数 / p95 / 最大 |
|---|---:|---:|---|
| 原始源 | 0 | 5,055 | 2.228 / 8.335 / 29.162 mm |
| cubic，无新额度 | 0 | 5,055 | 2.233 / 8.337 / 29.162 mm |
| cubic + 旧耳额度量级试验 | 979 | 6,036 | 2.277 / 7.180 / 18.140 mm |
| 保护 cubic + 专用额度 | 3,500 | 8,508 | 2.123 / 5.323 / 10.421 mm |
| **选用：保护 cubic + 专用额度 + 已有 trim 质量优化** | **3,500** | **8,494** | **1.881 / 4.587 / 10.287 mm** |

前两个 cubic 试验记录早于最终边界保护，保留为历史对比，不冒称最终生产输出。979 次试验对大三角形改善不够，因此没有为了“最小变更”先去拍一轮。最终在 FJ2811 启用已有 `improveTrimQuality`：只翻转合法内部对角，不移动 trim 的 UV 或 canonical 边界。FJ2811 获得独立 3,500 次额度；其他组配额和 600,000 源三角形硬上限不变。耳部局部目标边长沿用既有 2 mm，close 为 1.5 mm，但额度耗尽时仍可能达不到；不能把目标值写成实际最大边长。

证据分别为 `ear-feature-mesh-baseline-preview.json`、`ear-feature-mesh-cubic-preview.json`、`ear-feature-mesh-cubic-ear-quota-preview.json`、`ear-feature-mesh-cubic-ear-3500-preview.json`、`ear-feature-mesh-cubic-ear-3500-trim-preview.json`。其中某一早期报告的 sourceKernel 字段曾只判断 mode 是否恰好等于 cubic，已在 JSON 明确更正标签；实际候选使用的是 cubic，未改测量结果。

## 完整源人物护栏与生产落点

以下第一组为明确请求 preview 的仓库外 CPU 实验，保留其原始数据。最初执行者从工作台首次加载默认值推断实际截图也是 preview；随后 E 增加 `sourceQuality` 后确认当前真实运行是 balanced。前者是推断错误，不能继续用 preview 报告冒充当前截图检查。原始 preview 运行及其哈希对比本身仍有效，E 应使用下一节的 balanced 结果。

以相同 preview 档、关闭重建头发，实际生成 body、left、detail、features、collar 五组，连接接口后经过完整 `topology.finalize` 和法线打包。基线 **537,849** 源三角形；选用候选 **541,770**，增加 **3,921**，距原 600,000 护栏剩 **58,230**。最终 FJ2811 耳组随全局边细分再增加，不能用上表的 pre-finalize 值代替全源统计。

这与浏览器 C 的 968,432 总三角形不是同一口径：浏览器还显示另外生成的面皮、唇、眼等运行时几何；本检查不生成它们，也不含重建头发。不能拿浏览器总数判断源拓扑是否突破 600,000，或把本检查写成浏览器整脸已经通过。

比较 16 个最终 mesh 记录的 positions/normals/indices 哈希，**仅 FJ2811 改变**；身体、头侧 detail、其他 features、collar 和接口网格均相同。openSkinEdges、nonManifoldSkinEdges、unpairedInterfaceEdges、inconsistentWindingEdges 相对基线增量均为零。原数据仍有未闭合/非流形诊断，结果本身 `fullClosedManifold=false`、`selfIntersectionCheck=false`，不声明已修复整个人物拓扑。

证据：`ear-feature-full-source-baseline.json`、`ear-feature-full-source-cubic-ear-3500-trim.json`、`ear-feature-application.json`。仓库外候选文件为当时的诊断证据；生成脚本使用指定版本源码，生产已经整合后不能不核对输入版本就当成新的 A/B 基线重跑。

获授权后只在以下文件局部合入，没有覆盖全文件：

| 文件 | 修改 | 整合后 SHA-256 |
|---|---|---|
| `reconstruction/surface-kernel.mjs` | FJ2811 cubic 与 trim 窗口；头侧耳 mask 未变 | `4123b837989d4cd9850035b1dff5f1722324bf0b70018bfb3ca4b15c23b3c8ee` |
| `reconstruction/mesher.mjs` | 独立耳额度、FJ2811 局部边长和内部对角优化 | `c67bc356e886b9c6739a75462fd259d4a43f21e4ed87e98469de14d45dff0eb7` |
| `tools/check-surface-refinement.mjs` | 旧检查精确纳入 FJ2811，未放宽其他所有者边界 | `c7ee2572badb8eb51794e575c2861018d191db2e1d880b0f336990a5592089ed` |

两模块语法解析、21 项 surface-refinement 源码检查和 `git diff --check` 通过。生产 kernel 与通过数值检查的候选逻辑一致，注释和 import 路径不同。未在本子任务重建 index 或运行新的浏览器捕获，避免与 E 集成工作冲突。

## E 档位更正与 balanced 完整源检查

E 捕获记录 `G:\Three.js\Human\face-r24-sculpt-e-20260918\capture.json` 于 2026-09-18 15:21:04（Asia/Shanghai）完成，入口 SHA-256 为 `add31ad664f6293863ee2cfd4e6684950a5e037700b08b03042f65a737ca9224`。六个样本均明确记录 `sourceQuality=balanced`、`glError=0`、渲染总三角形 989,933；`errors=[]`、`productionModified=false`。耳部 kernel、mesher 哈希与上表的整合版本一致。

为匹配该实际档位，另外直接导入当前生产 `assembly.mjs`，以 `quality:'balanced'`、`includeHair:false` 运行五源组、接口连接、完整 finalize 和法线打包；没有使用旧 preview 候选模块替代当前生产。验证前后 assembly、surface-kernel、mesher、normal-field、topology 的源码哈希均保持一致，进程退出码 0。证据为 `ear-feature-full-source-balanced-production.json`，执行日志为 `ear-feature-balanced-production.log`。

| 同一 balanced 档的统计口径 | 数量 | 证据 |
|---|---:|---|
| body / left / detail / features / collar 整理前三角形 | 184,888 / 101,146 / 175,811 / 82,547 / 3,414 | 与 E capture 的五组逐项相同 |
| 五组整理前合计 | 547,806 | CPU 报告与 E capture 相同；不含随后接口与拓扑整理增量 |
| 完整接口连接、finalize 后源三角形 | **587,504** | 当前生产 balanced CPU 全源检查 |
| 距 600,000 源三角形硬上限 | **12,496** | 没有提高护栏；不能沿用 preview 的 58,230 余量 |
| 最终打包顶点数 | 320,941 | 含 draw-chunk 打包口径，不是新增五官顶点总数 |
| 最终 FJ2811 耳组 | 11,009 三角形 / 6,469 顶点 | 同一完整源检查 |
| E 浏览器渲染总三角形 | 989,933 | 包含运行时另生成的五官等显示几何，不能和源护栏直接相比 |

此轮没有再修改生产。preview 的“非耳组哈希不变”属于同档 A/B 实验；本次 balanced 检查确认当前整合源在实际运行档位下仍满足护栏，没有重新生成一个独立 balanced 旧基线，因此不杜撰跨版本哈希对比。

## 尚未解决与 E 实际观察

独立法线场存在真实的稀疏覆盖切换：例如 FJ2811 的 3921 域在 `y≈1.510125 m` 附近，一侧有插值值、一侧回退到几何 hint，原跳变约 4.45°。不加边界保护的 cubic 仍约 4.47°，证明它不是仅靠 cubic 能解决的问题。本轮不修改 `normal-field.mjs`，也不关闭 hint 选择去平均耳廓正反面。该问题仍保留，必须看 E 是否形成可见接线后再单独处理。

本研究者实际查看 E 的 `world-profile.png`，PNG SHA-256 为 `ef0ff495f1b190c975a7d5dd4c9b294c4278fb57dd8803b370c259c313028a27`：与 C 相比，耳内和耳垂的大块三角明暗明显消退，外耳轮保持；但耳内仍偏简化平面，局部小棱和细斜线/贴缝感没有全部消失。判断为可以保留的局部改进，不是自然耳或整脸验收。该结论来自实际图像，不是三角形数量。

本子任务只独立看过 E 这一张侧面，未独立查看 E 其他五张图。后续还需三分之四和灰模检查耳内结构、沿 trim 亮线、裂隙及轮廓；不能用一张侧面证明所有角度、NPC 和表情均正确。数值护栏与视觉结论继续分开记录。

## 真实三维清单

- [x] 没有用生成图片代替真实三维实现；只查看 C 实拍并修改自主曲面/采样逻辑。
- [x] 已实际修改生产源码；仅上述耳部拥有者及对应检查。
- [ ] 用户看到的是可交互三维工作台；E 已构建捕获，用户是否刷新到 E 未验证。
- [x] 人物/动物几何、骨骼和动作来自真实运行时；本子任务实际生成并 finalize 完整源人物几何，未替换骨骼或动作。
- [ ] 镜头、选择、动作或参数控制可以实际操作；本子任务未运行 E 浏览器交互。
- [ ] 公网固定链接和真实浏览器已验证；已核对 E 本地浏览器捕获，公网未发布或验证。
- [x] 如果只有截图而没有工作台，本轮判定失败；源码实现已合入，E 有真实工作台捕获证据，截图不能替代它。
