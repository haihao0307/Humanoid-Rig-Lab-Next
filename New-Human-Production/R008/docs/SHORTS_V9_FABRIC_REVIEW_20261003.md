# V9 独立二维裁剪数学审查

状态：V9 `createShortsPattern(m,{finalRiseBudget:true})` 已完成独立二维程序验证，11/11 有限测试通过。没有生成新人体、运行穿衣求解、调用 GPU 或移动鼠标。原版 A 不参与改写。

## 已证实的预算问题

现 `createShortsPattern` 先令完整 `makeRise(extension)` 的折线弧长等于前/后量体 rise 加设计松量，随后删去最后一个 rise 段及第一个 inseam 段，再用 cut edge 与独立裆宽构造菱形裆片。因此最终真实路径是 **remaining main rise + diamond height**，不是先前求根的完整 main rise。删去的 rise 长度一般不等于新增 diamond height。用形成后的三维衣物重设 rest 无法修复这个二维预算错误。

量体输入须明确为新版下腰口到实际裆部的独立前/后 tape，分别加已声明的前/后 ease；原裤脚目标独立冻结。腰头宽度不应重复计入下腰口起算的 main rise。

## 唯一未知量与合法根

每个前/后主片单独令原 `extension` 为 q。保持旧 cubic 公式、原 hip/depth 与 inseam 定义。设 c 为 crotch row，n 为 rows−c，w 为裆宽的一半：

- R(q)：`length(makeRise(q).slice(0,-1))`，即实际被裁后保留的 main rise。
- A(q)：`inseamTaper/n − (1−f*)q`，其中 `t*=(c−1−hipRow)/(c−hipRow)`，`f*=.96*t*²+.04*t*³`。
- B：`depth−riseEndY+verticalInseam/n`，与 q 无关。
- L(q)：实际 cut edge 长度，平方为 A(q)²+B²。
- H(q)：`sqrt(L(q)²−w²)`，须为正且有限。
- D：独立 body lower-waist→crotch tape + 声明 ease。

直接求 **R(q)+H(q)−D=0**，不要再先求完整 rise 长度。

令 a=1−f*，b=inseamTaper/n。R 的变动部分是若干 `sqrt((Δf*q)²+Δy²)`，因此 R′ 非负。当 B²>w² 时：

`F'' = Σ (Δf²*Δy²)/(q²*Δf²+Δy²)^(3/2) + a²*(B²−w²)/H³ > 0`

F=R+H 为凸函数。若 F′(0)≥0，则 qmin=0；否则在原合法 extension 域内对 F′ 求唯一极小点。选其右侧单调支路，先检查目标 D 的端点 bracket，再有界二分；不存在 bracket 就显式 HOLD。固定 60 次二分是确定性数值精度，不是物理参数扫描。

若 B²≤w²，不能套用上述凸性证明。可选择 `q > max(0,(b+sqrt(max(0,w²−B²)))/a)` 的正 extension 合法单调支路，但“没有根”仅指这个声明支路，不能冒称整个二维域无解。H=0 的边界不构成合法裆片。禁止用 clamp/sqrt(abs(...)) 将非法宽度伪造为合法根。

最后还必须检查原所有二维三角有向面积、row width、原 source boundary arc、19 条接缝的整边和半边 notch；长度求根本身不证明纸样不折叠。

## 四条裆边与保持项

按解出的前、后 L 分别计算 H，裆片 corners 为 `[0,-Hfront]`, `[w,0]`, `[0,Hback]`, `[-w,0]`。四条边及 1/2 弧长 notch 仍与主片实际 cut edges 等长；左右使用既有 mirror，不从三维坐标取材质 reference。

原始 2D 裆宽的风格输入保持。它与新的独立高度共同确定二维菱形；不是将形状外推到身体之后反烘 rest。

remaining inseam 仍为原声明 inseam 的 `(n−1)/n`，因为截去的是固定首个 `1/n` 段。前后共享侧缝 profile，左右 mirror，源配对长度继续匹配。

固定 hem circumference 时，原 `sideHemOffset` 会补偿前/后 q 的总变化；这会改变共享 outseam 的绝对长度。应明确报告“前后侧缝配对相容”，不能宣称“旧侧缝绝对长度不变”。若还要求旧 outseam 绝对长度冻结，一般需要第二个独立二维设计自由度或 HOLD，不能用单个 q 同时假称满足所有条件。

## 真实验收与材料边界

二维预算、arc 相容和可达路径必要界通过，只证明 source 裁剪关系。三维仍须按原 source UV 独立计算 F=Ds*Dm^-1 的主伸缩，不得隐藏前版 357.30% 失败，也不得把新 surface preview 称为物理穿着。

面积质量由 `densityKgM2 × source 2D area` 得到；新的二维裁剪应产生新的面积和质量。原 A 保留，但新 B 不是假称新旧质量必须相等。任何 within-piece rest bend 仍为 flat paper；手持初始曲率仅为 placement，跨片 seam hinge 保持独立语义。

材料律的 compliance 必须按约束单位及二维面积积分定义；膜与弯曲参数仍为未标定工程输入。[XPBD 原论文](https://matthias-research.github.io/pages/publications/XPBD.pdf) 给出了能量、compliance 与时间步的关系。[Eurographics 2015 论文元数据](https://diglib.eg.org/items/89b9a1c0-8722-477c-b221-1765f5f43979) 仅作论文出处；本轮未通过工具读取其完整 PDF，不冒称从该全文取得具体公式。

## 独立程序验证记录

工具：`tools/probe-shorts-rise-budget-v9.mjs`。本地强制读取已保存量体数据可运行 `node New-Human-Production/R008/tools/probe-shorts-rise-budget-v9.mjs --require-saved-evidence`；无忽略快照的新克隆默认明确跳过该一项。`--report` 使用独立忽略 QA 文件且不会覆盖旧报告。

验证的生产源码 SHA256：`e2c9e3e2f9d2ebc13b7e95e394f40cffbd501068a3c0c2b0c20e6b404ffc115a`。

11 项包括：从实际二维 rise/G 边重测预算；legacy 关闭选项与原 canonical paper 摘要完全一致；旧算法预算差；双侧镜像与所有正向面积；19 条源接缝及四条半边标记；固定裤脚周长和剩余内缝；二维面积质量；解析导数与有限差分；无根和不合法宽度原子拒绝；三维 placement metadata 无法改变 source UV；仅保存的量体数字重构预算。没有调用人物模块或任何 solver。

| 保存 V8 量体数据回放 | 目标 rise m | 实际 remaining main m | 实际 G height m | V9 残差 m | 相同量体旧裁剪残差 m |
| --- | ---: | ---: | ---: | ---: | ---: |
| 前 | 0.3644599913 | 0.2459231000 | 0.1185368912 | −5.55e−17 | +0.001165689 |
| 后 | 0.2877700035 | 0.2334229230 | 0.0543470805 | +5.55e−17 | +0.007004975 |

这仅是已保存 V8 独立量体数据的二维回放，不是新生成 V9 裸体截面采集。预算差的修复也不证明它是先前 357.30% 三维应变的唯一原因。

合成夹具的裤脚周长保持 0.72 m，全部源接缝相容。其共同侧缝长度由旧 0.432651754 m 变为新 0.432216288 m，按上文已明确报告而不假称旧绝对侧缝长度冻结。新二维面积 0.5834881243 m²、220 g/m² 工程密度下质量 0.1283673873 kg；没有三维 rest 反烘。

## 七项交付检查

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改 V9 生产源码：主工位新增独立二维 final-rise 预算分支；本工位只读验证。
- [ ] 用户看到的是 V9 可交互三维工作台：待主工位新版本验证。
- [ ] V9 人物几何、骨骼和动作来自真实运行时：本轮没有运行人体或动作。
- [ ] 镜头、选择、动作或参数控制可以实际操作：待真实页面验收。
- [ ] 公网固定链接和真实浏览器已验证：本轮未发布或浏览器验证。
- [x] 如果只有截图而没有工作台，本轮判定失败；本审查不以截图作为交付。

## V9 有向曲面材料运输独立审查

工具：`tools/test-shorts-surface-transport-v9.mjs`。`ShortsSurfaceTransport.mjs` SHA256 `3c8b53b5be77fea9dfcd81cd80f8d5ec29ce78d5c85abac0181b1c2823671c16` 的有限数学测试 **10/10 通过**。本项没有读取新人体、运行浏览器或物理步骤。

投影固定 WORLD X 方向到曲面切平面，在内大腿法向接近 ±X 时会退化；退化后选任意备用 WORLD 轴还可能造成前/后条带方向翻转。新函数改用 actual oriented normal n 与 actual meridian t 的叉积：前片 r=n×t，后片 r=t×n。源单位 meridian D=[a,b] 得到 `u=a*t+b*r`, `v=b*t−a*r`。

独立测试证明 u、v 为单位正交切向量，并满足 `a*u+b*v=t` 与 `b*u−a*v=r`；任意 source 横向导数 C=[cx,cy] 实际为 `cx*u+cy*v`，不能省去 source mirror 的负号。任意 proper WORLD 旋转后，输出完整随之旋转，不依赖固定 WORLD X。

| 内大腿裁片 | 实际 n | 向下 meridian | source C 横向符号 | 实际横向导数 |
| --- | --- | --- | ---: | --- |
| FR | −X | −Y | + | +Z，朝前 |
| FL | +X | −Y | − | +Z，朝前 |
| BR | −X | −Y | + | −Z，朝后 |
| BL | +X | −Y | − | −Z，朝后 |

BL 的正 u 基向量本身为 +Z；真正 row-C 导数因左片 source mirror 为负，故沿 −Z。不能为了得到最终方向把该基向量再次反转。

源前片原有 `opposite_uv_normal` 语义对应 `u×v=−n`，后片 `along_uv_normal` 对应 `u×v=+n`。这个前后 chart parity 是有意的，不是将两个 chart 都强制成同一外向 uv 法线。原 source UV、rest 和质量没有改写。

`seamBoundaryBlend(t)=t²(3−2t)` 的值在端点精确为 0/1，导数 `6t(1−t)` 两端为零。测试覆盖闭区间输入、NaN/Infinity、零/平行向量、有限输入但归一化长度 overflow 的原子拒绝，以及所有输入不变。

这只证明局部 frame 和 blending 函数的数学性质。函数不证明 global surface 可积、裁片初形低应变、接缝 target 导数匹配、接触无穿透或 native motion；复构后的实际曲面仍须重新检查原二维主应变及全三角覆盖。helper 的等价重构也不意味着重构前的旧构建快照 SHA 与最终 fresh build 相同。

## V9 只用纸样的形成诊断：不是错误裁片证明

Knowledge Mother 的建议是先隔离源纸样缝合与成形，再讨论穿衣初态。实际 fitted 最大应变约 139% 本身不证明裁片错误，也不能直接推出需要省道、改裆片、补开口或改二维 rest。仍需一个低应变成衣见证，或明确的必要条件矛盾。

专用工具 `tools/probe-shorts-intrinsic-v9.mjs` 只读取 `qa/shorts-v9-coupled-20261003.json` 的量体/设计标量，用当前 `createShortsPattern` 重建 V9 二维纸样。没有读取该失败快照的 XYZ。平面放置不采用人体高度或骨骼目标；裆片明确刚性摆在 XZ 面上，这是原制造函数向外/向上 45° 初态要求的方向前提，既不改变 UV，也不烘焙 rest。未经这个方向前提，直接使用默认 XY 裆片会令制造函数自己的 FL 正交基门禁拒绝。此诊断没有修改生产制造函数。

唯一有界运行：独立九片刚性初态 → 一次完整 19 条 source seam quotient 的真实质量加权合并 → 160 次原边 XPBD（源 h=1/240、原工程边 compliance）及原质量加权 principal 作者投影。仅作 source-only authoring，不运行 `fixedStep`、人体、重力、弯曲、弹力通道、接触或高度引导。全部质量/逆质量为正；原 UV、三角、source seam、质量、previous、velocity、native history、steps 与 time 均受不变断言保护。二十八条独立弹力 source 段保留但明确不激活、工程参数未经标定。

报告：`qa/shorts-intrinsic-v9-e2c9e3e2f9d2-20261003.json`，源裁剪 SHA256 `e2c9e3e2f9d2ebc13b7e95e394f40cffbd501068a3c0c2b0c20e6b404ffc115a`。独立刚性九片最大应变 `6.77236e−15`。瞬时完整 quotient 初态最大应变 **2058.79277%**；160 次后 **15.204653%**，没有通过 5% 门。最坏位于 FL triangle 87、source indices `[49,57,58]`，主片裆附近；G 最大应变 **1.773685%**，四段腰头各小于 1.2%。这种瞬时合并本身是有损初始化，不代表渐进真实缝合已完成。

随后只做一次 exact-barycentric UV 一轮细分。成形 XYZ 只用于 INIT，所有细分 rest 仍取原 2D 域：3392 三角、1751 quotient DOF，原纸样面积 `0.5105412450662485 m²`、质量 `0.11231907391457459 kg`。面积误差 `7.77e−16 m²`，质量误差 `5.41e−16 kg`；细分初态最大应变与粗网格终态差 `4.44e−16`。80 次后 **9.168148%**，仍 HOLD；最坏 FL 子三角 350 `[255,257,58]` 留在相同源域邻近区域，G **3.690886%**。这证明本次细分保持 source cut/area/mass 和初态 F，不证明任意网格求解都收敛。

全程约 **0.59 秒**，上限 20 秒；没有增加次数或参数扫描。面积加权 principal misfit 从 `2.462120599 m²` 降到粗网格 `0.000143345896 m²`，细分终态 `0.0000326226223 m²`；此量是诊断残差，**不是材料能量 J**。另有原工程边 compliance 的弹性势能 J 报告，未经材料标定，不能据此认证真实布料。

结论保持 **HOLD**。局部 source-only solve 失败既不证明错误裁片，也不证明低应变 exterior embedding 不存在。自交、法向朝向、完整 VF/EE/CCD、可穿性、人体覆盖和动作均未检查；所有 physical/production 标记为 false。下一步应处理明确的缝合初态与耦合条件证据，不能把本报告用于改写 source rest 或宣称服装验收通过。

## 已弃用全局轴初态的历史路径见证

专用工具 `tools/probe-shorts-v9-target-witness.mjs` 首轮曾只读 `qa/shorts-v9-initial-20261003.json`，这是 **`REJECTED_GLOBAL_AXIS_MAPPING` 历史初态**，其初始最大应变 577.40304%。该 receipt 没有 553 个完整 source XYZ/UV 数组，只记录最坏 FR 三角的三个实际 WORLD 点 `[187,196,195]`；目标覆盖明确为 **3/553**，审计三种点对。actor-local `initialG.corners` 不与它们混用。这些严格见证仅属于已弃用的全局轴摆放，**不能作为当前 upper-only Darboux 初态或当前 browser 的失败证据**。旧报告保持原样，不覆盖。工具不生成新人体、不运行 solver、不修改历史或生产源码。

必要条件：如果一张连续纸样映射在合法源路径 P 上每处 `sigma_max(F) <= 1.05`，则路径目标的长度不超过 `1.05*lenUV(P)`，而目标端点的欧氏距离又不超过目标路径长度。因此 `targetDistance > 1.05*lenUV(P)` 是该**固定初始映射**不能通过 5% 拉伸门的严格见证。

图只包含同片实际三角边，其成本来自该片 UV 的米制长度；19 条声明 source seam pair 的成本为零。不同 UV chart 不直接相减。Dijkstra 的最短**图边**路径是连续 source geodesic 的上界，不能称为精确连续测地线。用这个合法路径上界证明超长已经足够；本次两项最坏见证恰好都走真实的单条三角边，不需要接缝捷径。

| 实际 source 点对（FR） | 实际 WORLD 端点距离 | 合法源路径长度 | 比值 |
| --- | ---: | ---: | ---: |
| 187 → 195 | 250.315481 mm | 37.882663 mm | 6.607653 |
| 187 → 196 | 252.436204 mm | 56.056036 mm | 4.503283 |

三种点对中的上述两项违反 1.05 上界。第三种的端点收缩不作为失败：端点弦长低于源路径的 0.95 并不排除合法弯曲。只有完整边界映射被逐点强制规定时，才可进一步引用完整映射的弧长必要条件；此处没有这种强制前提。

结果状态 **`INITIAL_MAPPING_INCOMPATIBLE_WITH_5PCT`**。这只证明上述初始端点必须改变，**不是 `PAPER_IMPOSSIBLE`**。有限 compliance、自由布片及临时 guides 可以重新移动；报告不能据此宣称衣服无解，也不能将三个可用点的审计称为 full target PASS。

运行耗时约 19 ms。报告 `qa/shorts-v9-target-witness-e2c9e3e2f9d2-e850ec56f3cc-20261003.json` 包含 input JSON SHA256、当前 source program SHA256、重构纸样几何 SHA256、量体/设计 recipe SHA256、真实每条 path 的 piece/edge/sourceUV/length 和目标 XYZ。当前重构 source3UV 与保存的三点逐一一致，面积与 receipt 一致；保存文件没有完整 UV 或 source SHA，故**不声称全纸样已独立比对**。默认缺失 ignored evidence 明确 SKIP，`--require-saved-evidence` 强制存在，`--report` 用 `wx` 拒绝覆盖旧报告。

## 当前 upper-only Darboux 保存初态的路径见证

工具默认输入已改为 `qa/shorts-v9-coupled-20261003.json`，明确分类为 **`SAVED_COUPLED_UPPER_ONLY_DARBOUX_INITIAL`**。该保存试验的 initial 最大应变 **167.4434359%**、final **138.9574028%**；端点见证只审计其 **initial** 三个 WORLD 点，不把它推广成最终几何或后续 fresh browser 的证明。该 receipt 同样没有完整 553 点数组。

当前可用三角是 FL source indices `[58,67,59]`，三点的保存 UV 与同一量体/设计标量重建的当前 source paper 逐一匹配。三种点对中，仅 `[58,67]` 找到严格上界矛盾：实际端点 **80.980702 mm**，合法 source 三角边路径 **30.448368 mm**，比值 **2.659607 > 1.05**。Dijkstra 返回真实单边 `[58,67]`；没有跨 chart UV 差，没有调用人体或 solver。其他两种点对未违反这个上界，并不等于整个三角或服装 PASS。

新独立 `wx` 报告：`qa/shorts-v9-target-witness-e2c9e3e2f9d2-7e185de20ffb-20261003.json`，约 20 ms。状态仍为 `INITIAL_MAPPING_INCOMPATIBLE_WITH_5PCT`：必须允许这个初始 edge 的两个端点改变，不能将此自由初态当作 5% 以内的已可穿几何。目标覆盖保持 **3/553**；`paperImpossible=false`、`fullTargetPassed=false`、`physicalWearingPassed=false`。源纸样不因这个初始映射矛盾而被判定不可解。
