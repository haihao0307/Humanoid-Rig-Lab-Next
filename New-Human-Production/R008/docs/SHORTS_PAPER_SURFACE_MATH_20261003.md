# 平面纸样、曲率、缝合与完整短裤：确定的数学链路

日期：2026-10-03。状态：**研究与实现约束；当前服装仍 HOLD**。

本轮仅新增本文件。不修改 SurfaceFit、人体、纸样、求解器或材料；不运行新人物、浏览器或穿着实验。原版 A、旧失败和 v8 证据保留。下面的接口是下一步实现规范，不表示已经实现或验收。

## 1. 四个对象必须分别拥有权威

| 对象 | 权威输入 | 允许改变 | 禁止混入 |
| --- | --- | --- | --- |
| 二维材料纸样 P | 实际量体标量、裁剪设计、版本、米制 UV、经纬方向 | 有记录的新裁剪版本 | 当前变形 XYZ、失败应变、碰撞推开量 |
| 缝制关系 S | 原始接缝 ID、两侧材料边界、弧长对应、方向、声明的吃势 | 明确的新裁剪/缝制版本 | 按 XYZ 邻近额外焊点 |
| 制造/曲率指导 H | 合法刚体初态、临时折角、有限缝合力、尺寸目标 | 作者阶段的有限指导 | 偷换成永久固定、骨骼蒙皮或新的材料 rest |
| 物理状态 X | 当前 WORLD 米制位置、正质量、速度、接触、弹力通道 | 有限时间步和已声明约束 | 反向烘焙 UV、rest 长度、面积或质量 |

纸样、裁剪、曲率、接缝分别解决不同问题。把皮肤轮廓插值成漂亮曲面只得到一个候选 X；它必须接受纸样度量与接触检查。Coons 曲面能满足指定边界的插值条件，不能由此推出等距、无交叉、可穿或动力学稳定。完整服装需要这四个对象同时相容。

## 2. 平面纸样怎样变成曲面

每个非退化源三角形的二维材料坐标为 u0,u1,u2，当前三维坐标为 x0,x1,x2。定义：

```text
Dm = [u1-u0, u2-u0]                  (2×2，源二维纸样)
Ds = [x1-x0, x2-x0]                  (3×2，当前三维)
F  = Ds inverse(Dm)
C  = transpose(F) F
E  = (C-I)/2
sigmaMin, sigmaMax = sqrt(eigenvalues(C))
materialError = max(abs(sigmaMin-1), abs(sigmaMax-1))
```

这里 UV 是米制笛卡尔材料坐标，源第一基本形式为 I；若以后换一般参数图，必须使用其源度量，不能仍默认 I。刚体移动或合法等距折叠改变 X 而保持 C=I。各三角形质量来自源面积 A0 与独立面密度 rho：每个顶点收到 rho*A0/3；商 DOF 的质量是成员质量之和。质量不根据当前三维面积重算。

连续曲面 X(u,v) 的第一基本形式 g 衡量长度/角度，第二基本形式 b 衡量法向变化；高斯方程要求 K(g)=det(b)/det(g)，另有 Codazzi 微分相容条件。正定 g、对称 b 满足这些条件时，在适当的局部域内可恢复曲面，唯一性只到刚体运动。它不保证全局无自交、接缝闭合或人体可穿。[Georgia Tech：曲面基本定理讲义](https://ghomi.math.gatech.edu/Classes/Math497C/LectureNotes12.pdf)

因此：光滑平面布片在严格等距条件下 K=0；可以卷成圆柱、在合法域内形成锥面，不能无伸缩地直接贴成具有非零高斯曲率的球面或鞍面。褶皱和折线属于分片光滑情形，要用离散铰链处理；拼缝、剪口、省道会改变整体内在结构，不能对整件缝制服装简单宣称处处 K=0。

**实现原则：先声明要保留的 g0，再检查曲率目标能否与它共存。** 如果需要非零内在曲率，必须由已声明的有限材料应变、吃势、省道或新裁片结构承担，不能让插值器无记录地产生几倍拉伸。研究中的服装制版也把面料方向、变形限制、接缝和省道作为制造条件，而非仅要求几何表面连续。[Pietroni 等，Computational Pattern Making from 3D Garment Models](https://arxiv.org/abs/2202.10272)

## 3. 曲率的离散实现：铰链，而不是把身体形状写成 rest

每条内边有两个材料三角形；使用一致朝向计算带符号二面折角 theta。弯曲能量采用与源几何相关的权重，例如：

```text
Eb = sum_edges kb * (length0 / h0) * (theta-theta0)^2
```

h0 按所选离散壳模型从两侧源三角形高度定义；实现时冻结其定义和单位。平织亚麻的未加工参考态 theta0=0；临时制造折角属于 H，不等于永久弯曲 rest。只有明确声明的压褶/热定型等制造工艺才可生成独立的参考折角，不能直接取当前穿着形状。[Grinspun 等，Discrete Shells](https://hirani.github.io/papers/GrHiDeSc2003_SCA_lowres.pdf)

确定的初态构造：先将一个源三角形以 proper 刚体放置（R^T R=I、det R=+1）；沿共享边依制造角旋转相邻三角形。生成树上的每一步保留三角形度量，但所有非树边必须再检查同一顶点的位置一致性和循环刚体变换闭合。循环旋转/平移残差非零说明给定铰链场没有生成一致的离散嵌入；不能对多份顶点强制平均后声称等距。

循环闭合、离散角亏和 source 度量检查都是必要诊断；任一项通过都不证明全局单射。强折叠使相邻法向变化很大，本身不是“翻面”证据；还要检查退化面积、源朝向一致性、折角分支和真实三角形交叉。

## 4. 接缝：按材料弧长粘合，再检查整体

设两条二维边界为 gammaA(s)、gammaB(s)，s 是物理弧长。无吃势接缝必须具有相同总长度和对应的分段长度；边界绕向决定匹配是否反向。闭合条件为 XA(s)=XB(phi(s))，其中 phi 来自源接缝的方向和弧长对应，不由当前 XYZ 临时猜测。若有吃势，必须单独记录材料送进比例、允许褶皱和制造方式；不能静默拉短长边。

当前 source 19 个实际接缝是唯一等价关系来源。应保留每个成员、方向和弧长 witness。完整粗纸样为 9 块、553 点、848 三角形，source 商应为 451 DOF、单分量、Euler 特征数 -1、三个边界环。拓扑正确只说明连接关系正确，不证明空间形态正确。

制造阶段以有限 soft-sew 指导逐渐减小 gap，同时检查材料度量；达到真实闭合标准后再合并对应 DOF。不要把相距很远的九张刚性布片直接 hard-mean 到一起。对共享 DOF 的多个目标必须先比较原始目标差异；mass-average 是折中解，不能消除“同一 DOF 被要求到两个位置”的矛盾。

全接缝闭合仍可能发生以下失败：衣片内应变过大、铰链循环不闭合、整件衣服自交、左右腿错侧或人体穿出。这些应作为独立结果保留。

## 5. 下裆裁剪预算必须在二维构造时闭合

R008 当前旧衣物量体与补造裸胯的裆底不同；旧衣物外表面不能继续冒称当前可见裸身。补造裸胯也只能标为估计解剖，不是恢复了被遮挡的精确身体。每份 measure 保存 surface scope、形体 token、实际源 hash、pose revision、actor frame 和截面 witness。

对每条最终前/后中心路线，先独立确定实际身体带状量体长度 Bf/Bb 与设计松量 ef/eb，得到 Rf=Bf+ef、Rb=Bb+eb。再显式分配“主片余下裆弧 + G 中线”预算：

```text
Rf = remainingFrontMainRise + gussetFrontHeight
Rb = remainingBackMainRise  + gussetBackHeight
Efront = hypot(gussetFrontHeight, gussetWidth/2)
Eback  = hypot(gussetBackHeight,  gussetWidth/2)
```

这是当前菱形 G 纸样的关系，不能不加说明用于任意 G。G 四条 cut 边必须与四主片实际切边逐段匹配。可以保留原版 A 的二维设计比例和经纬方向；不能借失败 X 反算 E、G 高或新的 UV。现有算法先求未剪开的 rise，再切掉一段并加入 G 的中心路线；下一版应审计最终总预算，避免剪切后无记录地增加裆长。

裤脚保持用户指定标高；新腰口和裆底改变时，不能再用“裆底减固定长度”隐式移动裤脚。固定 hem 与当前实际 body tape 共同决定新的长度裁剪记录。源 G 宽来自已声明的原版设计与身高适配；实测腿隙用于 fit audit，不能把净腿隙自动当作 G 布料宽上限。

二维构造需要正面积、合法根区间、19 条源接缝兼容和完整设计预算。求解无合法解时返回裁剪失败 witness；不得通过改变 gate 或从三维回烘 rest 消除失败。

## 6. 求解前先产生可证明的失败证据

下面是本项目可直接实现的必要条件算子；它们可以拒绝一个目标场，但不能由失败泛化“任何方式都穿不了这份纸样”。

| 算子 | 确定检查 | 失败 witness |
| --- | --- | --- |
| paperMetric | Dm 可逆、源面积正、当前 F/C 主伸长 | piece、source 三角、UV、XYZ、两主伸长 |
| seamArc | 总弧长、逐段匹配、绕向、声明吃势 | seam ID、对应参数、源分段长度 |
| quotient | 仅 source 19 等价、质量聚合、三边界环 | 非流形边、异常分量/环、成员列表 |
| sharedGuide | 同 quotient 的原目标一致性 | 全部原目标、最大距离，不能只给平均值 |
| sourcePathBound | 目标端点距离是否超出允许材料路径预算 | 源路径和长度 L、目标间距 d、比例 d/L |
| hingeClosure | 源刚性展开后非树边/循环是否一致 | 循环 source 边、旋转/平移残差 |
| wholeSurfaceContact | 真三角面、边与连续运动是否交叉 | cloth/body 源索引、WORLD XYZ、交线、时间区间 |

sourcePathBound 的推导：当每个三角形 sigmaMax<=1.05 时，一条跨材料片/零长度源接缝的路径三维长度至多 1.05L；端点欧氏距离不超过路径长度。因此 exact 目标 d>1.05L 是这个目标场的确定矛盾。使用图路径给出保守上界已经可以生成拒绝 witness；未超界不构成充分条件。若目标具有声明 slack，先扣除允许端点偏移再做此检查。

曲率诊断检查 g/b 的局部相容；离散实现优先检查可恢复的三角形度量、铰链闭合和角亏。不要从单个失败 solver、有限次数未收敛或局部 G 条件数推导全局不可穿结论。

## 7. 物理架构与接受规则

连续体布料把经纬伸缩/剪切与约束求解分开；本项目应继续保留完整材料矩阵、独立弯曲和接触，而不是仅用边长代表所有面内行为。[Baraff/Witkin，Large Steps in Cloth Simulation](https://publications.ri.cmu.edu/large-steps-in-cloth-simulation)

XPBD 使用 alphaTilde=alpha/dt^2，将 compliance 放进约束增量和累积 lambda。标量形式为 deltaLambda=(-C-alphaTilde*lambda)/(gradC M^-1 gradC^T+alphaTilde)。它提供材料刚度/时间步的明确关系，不提供纸样可行性或有限迭代内收敛保证；低迭代仍会产生额外柔软性。[Macklin 等，XPBD](https://matthias-research.github.io/pages/publications/XPBD.pdf)

完整状态的必要物理项为膜能、弯曲能、独立弹力腰圈、重力/惯性、摩擦、身体和布料自接触。松紧条可采用单独的拉伸能 0.5*EA/L0*(L-L0)^2，L0 来源为明确的弹带缩率；亚麻 casing 和主片仍保持自身材料限制。EA、面密度、厚度、body clearance 的工程输入和实测输入分开标注。弹带有限力不等于把腰圈绑骨固定。

每个候选接受需要独立记录：最大主应变、非退化/源方向、接缝 gap、body/cloth self-contact、连续 CCD、目标 slack、能量/残差与数值审查。标量 merit 下降不能掩盖最坏主应变升高。当前生产 Gram 实验曾出现这种回归；本文件不授权重新启用该路径。平滑残差 C11-1、C22-1、sqrt(2)*C12 虽与 C=I 同零集合，也不能替代实际 principal 验收或未经证明的归一化。

接触是完整几何约束，顶点、中点、质心采样均不能证明整面无穿插；每个时间步还需检查连续轨迹。IPC 的研究将几何可行性与动力学准确度分开控制，说明这两项应各自拥有 gate；本项目目前没有实现或继承它的完整保证。[Li 等，Incremental Potential Contact](https://ipc-sim.github.io/)

物理 5% 面内门槛与现有 4mm body clearance、8mm 腰目标标准不因作者预览改变。2.5mm 腰头预览仅是几何作者指标。静态可行之后再测真实人体动作；原人物部分开放皮肤与补造裸胯的 union 尚不能整体冒称认证 closed solid。

## 8. 下一步固定程序流水线

| 顺序 | 新算子/阶段建议 | 输入 → 输出 | 何时停止 |
| --- | --- | --- | --- |
| 1 | captureMeasuredBodyContract | 当前实际表面/骨架 → 带 provenance 的米制截面与带状量体 | 旧衣物/裸胯 authority 或 frame 混淆 |
| 2 | buildPaperFromMeasureAndStyle | 独立量体 + 原版二维风格 + 固定 hem → UV/rest/area/mass/切边预算 | 二维预算、正面积或 source 接缝不合法 |
| 3 | buildSeamQuotient | exact 19 源关系 → 原成员、quotient、三环拓扑 | 非流形、额外 union、质量不守恒 |
| 4 | preflightGuideAndCurvature | 目标曲线/铰链 + 原 paper → 源路径、共享目标、局部相容证据 | 明确目标矛盾；无优化器试跑 |
| 5 | initializeFoldedSheets | proper rigid + 声明的有限 fold schedule → 接近等距的 X0 | 度量或铰链闭合失败 |
| 6 | assembleBounded | 有限 staged sewing + membrane/bend + 实际 contact → 每阶段 raw 状态/审计 | 任一 gate 超限或达到预定预算 |
| 7 | validateStatic | 原 paper 与全当前 mesh → 度量、接缝、真实 body/self、外形检查 | 任一独立未通过项保持 HOLD |
| 8 | validateNativeMotion | 静态通过态 + 实际人物运动 → 连续接触/CCD/材料/弹力报告 | 不通过不得公开宣称完成 |

这些算子必须无随机角度、无参数扫描，使用同一 recipe、固定阶段顺序和预先声明的迭代上限。错误标签应分为 PAPER_SOURCE_INVALID、MEASUREMENT_AUTHORITY_MISMATCH、SEAM_ARCLENGTH_MISMATCH、SHARED_GUIDE_CONTRADICTION、GUIDE_SOURCE_LENGTH_CERTIFICATE、HINGE_CLOSURE_FAILED、MATERIAL_LIMIT_EXCEEDED、STATIC_BODY_INTERSECTION、CONTACT_SIGN_UNCERTAIN、SELF_OR_CCD_FAILED，以及 HOLD_BOUNDED_SOLVER_NO_CERTIFICATE。最后一项只说明本次没有得到证书。

建议先实现第 2–4 项的纯数据审计，然后用现有冻结失败 fixture 验证错误定位，再实现第 5–6 项。不要先产生另一版外观再补理论解释。

## 9. 冻结的实际 v8 证据与回归范围

本轮只读取既有 JSON，不重新运行人体或求解器：

| 文件（相对 R008） | 本轮读取结果 | SHA256 |
| --- | --- | --- |
| qa/shorts-surface-refinement-20261003.json | 7273 源点、13568 真三角、6895 DOF；面积/质量/source 19 接缝细分守恒；最大接缝差 2.289e-16m；WORLD frame 差 2.355e-16m | 3eb8b1b821d82cd75d85126ba02c92bb5b1608efc9228bb06c0fa6c3ec9cf003 |
| 同一报告的 material | FR [1593,2559,2566]：sigmaMin=0.5938231774、sigmaMax=4.5746883986，即最大相对应变 357.46884%；time=0、step=0；未通过 | 同上 |
| qa/shorts-surface-independent-v8-20261003/ACTUAL_STATIC_TRIANGLE_CROSSINGS.json | 198 条真实交线 witness；cloth 零退化，native 120 个退化面另记；报告未做 self/CCD 或完整 solid membership 认证 | 34a3c23f6c21aba6a7ab2238d90dfd36ce95d710a82b51cb7f9f26b3e241e7c2 |
| ShortsSurfaceFit.mjs | 旧 @1 保持；本轮未重写 @2 | db2655061c187dc6cd699733be3eb2a701bce633d9134024cb415058986ca4a0 |

细分报告顶层 passed 只覆盖该报告声明的源守恒/frame 范围，不能覆盖其独立 material.valid=false；交线报告的“exactcrossings”是字段名，predicate 明确为双精度测试，不代表 exact arithmetic。细分能够改善表示曲率的自由度，但不自动修复源裁剪与目标场不相容。

下一步纯数据回归应包括：刚体三角/圆柱等距、双三角非零合法 hinge、球面目标与平面 metric 相容失败、接缝方向/分段长度、循环 hinge 不闭合、共享 DOF 冲突、目标距离超 source path、非单位 actor frame、细分面积/质量/19 接缝守恒、采样通过但面内部穿插，以及 v8 最大主伸长/198 交线的复现。以上是计划，**本轮未执行这些新回归**。

## 仓库七项交付清单

这是研究文件的未完成生产交付清单；未勾选项不能由数学文档或旧截图代替。本轮没有交付新的合格可穿短裤。

- [ ] 没有用生成图片代替真实三维实现；
- [ ] 已实际修改生产源码；
- [ ] 用户看到的是可交互三维工作台；
- [ ] 人物/动物几何、骨骼和动作来自真实运行时；
- [ ] 镜头、选择、动作或参数控制可以实际操作；
- [ ] 公网固定链接和真实浏览器已验证；
- [ ] 如果只有截图而没有工作台，本轮判定失败。
