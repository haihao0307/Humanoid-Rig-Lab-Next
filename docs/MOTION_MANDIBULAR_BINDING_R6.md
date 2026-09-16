# R6 下颌与颈部绑定补修

2026-09-13。全动作复核在两种体型的 `sit-to-stand-00078` 发现下巴拉成向下的尖片。本次补修针对这一可重复的缺陷；正式生成后的坐起、挥手及站立近景均已重新截图。

## 原因与修正

原连续颅颈权重场解决了头颈源分块交界的硬跳变，但其 C5→C4 高度门控仍把下颌最低端当作颈部。实际源点 `(0.001859772950410843, 1.4139022827148438, 0.17679716646671295)` 属于 torso 域 `mask=4`，低于 C4。旧绑定为 head 43.076%、C5 33.370%、C4 23.554%。坐起时躯干前倾且头部侧倾，皮肤同时受到头与中颈两套旋转牵引，形成尖垂。相邻源点也保留约 59% 的颈椎影响。

诊断中移除程序化 `faceSkin` / `faceLip` 并关闭 compact face masking 后，尖片仍存在。问题来自原始身体皮肤的绑定，不能通过修改面部覆盖层解决。

`reconstruction/anatomy-rules.mjs` 将前向下颌壳与原颅颈场作平滑并集。这个壳采用 head→C7 的参考长度，沿前后、高度、横向三个方向连续衰减，让闭嘴下颌随 head 整体转动，并跨 head、neck、torso 源域使用同一函数。后颈和颈椎核心保持原场。没有调整录制动作、夹住头部角度或改动骨长；肩帽权重及支撑保留。

该包络是显式记录的工程参数，不是测量标定，也不是张嘴控制器。解剖依据仅是下颌与颅骨相接，不能把下颌当作 C4/C5 的延伸；资料不提供本实现的数值参数。[OpenStax：颅骨与下颌](https://openstax.org/books/anatomy-and-physiology/pages/7-2-the-skull)。

生成缓存版本为 `r27-continuous-mandible-neck-shoulder-cap-contact-standing`。`binding.mjs` 的元数据改为 `continuous-cranial-cervical-mandibular-shell/v2`，DNA contract 与 binding schema 同步描述闭嘴下颌约束。

## 绑定与数值验证

- `node tools/test-neck-binding-continuity.mjs` 通过：96,248 个测试点，96,064 个邻接对，最大相邻权重 L1 差为 0.024444953；编码行和为 65,535，无 ownership fallback。
- 四个真实源下颌坐标分别使用六种相邻域组合，共 24 个 witness，正式 `buildCompactBinding` 输出 head 权重均为 65,535。
- 2,220 个后颈及颈椎核心样本与补修前连续场的差值小于 1e-14。肩关节处头权重仍为零。
- `node tools/test-shoulder-cap.mjs` 仍通过：177,408 个合成映射样本的 Jacobian 行列式为 0.4015–1.5364，无翻转。
- `node tools/build-pure.mjs` 与 `node tools/check-pure.mjs` 通过。总验收随后会重新构建并记录整合入口 hash，因此这里不把本地中间构建 hash 当作最终发布 hash。

独立冻结的后台 Edge 页面从正式源码重新生成两个人物，未装载候选权重替换函数。原始 `mask=4` 的上述关键点及邻点，在两个人物的 worker 输出中均为 head=65,535，其余为零；`r6-final-neck-v2-generated-witnesses.json` 记录了实际网格权重和 v2 元数据。这一步确认新规则经过正式的 skin/pinned/support 路径生效。

GPU transform feedback 使用当前顶点着色器计算结果，比较 CPU 的同一绑定与软组织变形。每次覆盖四个 skin 块的颈部、上胸及腋窝选择域，不代表全模型碰撞证明。法线只核验有限值与单位长度，没有声称 CPU/GPU 法线方向逐点一致。

| 人物 / 动作采样 | 实际阶段与时间 | 点数 | 最大 CPU/GPU 位置误差 |
| --- | --- | ---: | ---: |
| npc-1 / sit78 | standUp:sitToStand，clip 1.3 s，进度 0.503226 | 62,165 | 3.33964e-7 m |
| npc-2 / sit78 | standUp:sitToStand，clip 1.3 s，进度 0.503226 | 62,091 | 4.87423e-7 m |
| npc-1 / wave90 | greet，gesture 1.5 s，进度 0.505618 | 62,165 | 5.72396e-7 m |
| npc-2 / wave90 | greet，gesture 1.5 s，进度 0.505618 | 62,091 | 5.25191e-7 m |

四次法线长度总范围为 0.9999996208–1.0000003666，无非有限输出或 GL 错误。结果分别存为 `r6-final-neck-v2-gpu-npc{1,2}-{sit78,wave90}.json`，每个文件带实际 phase、clip/gesture elapsed、来源进度和体型参数。

## 正式视觉证据与边界

输出目录为任务外部 artifact 目录：`C:/Users/Administrator/.codex/visualizations/2026/09/12/01a0944f-e5fe-7a31-82ea-3fe8e3e4df98`。

修复前对照为 `r6-chin-sit78-before-close.png`、`r6-chin-sit78-before-side.png` 及 `r6-chin-npc2-sit78-before.png`。正式修复后共 12 张近景，命名为 `r6-final-neck-v2-npc{1,2}-{sit78,wave90,rest}-{front,side}.png`。两种体型、三个姿态及两个视角均已实际查看：坐起的长尖片消失；挥手和参考站立未出现新的颈部脱节。近看仍有浅三角面着色、侧倾时的压缩颈褶以及肩腋交界细线，不把这些图描述为全身无瑕疵或无自交。

截图和回读页面在完成后已关闭。全动作矩阵及性能记录由 R6 总验收另行完成，这 12 张有针对性的近景不能替代全部动作的验收。

冻结源的关键 SHA-256：

- anatomy-rules.mjs：`606535ab96ae5eab9c72aa6af93136578e2f08a98e61ff72ad5b3839c09721fb`
- binding.mjs：`97ad546524be348ba71c2d3a956536ca8f96b6c6b037ef4519f27c3e06998ba6`
- CompactWorkbench.js 原始源：`e1a411840c8acc2714e812479f18ac29c4313d4d90d5bd47b3a441e9ac5b41dc`
- CompactMuscles.js：`8e4c1788b9ab517583ad6a494dff0c5f0c4afe482ebda194a76d978187264bc5`

`r6-final-neck-v2-sources.json` 记录注入前源 hash；`r6-final-neck-v2-frozen-hashes.json` 记录服务器实际提供的文件。诊断 Workbench 增加 qaData 保留与 qaLbs/qaMuscle 开关，因此其 served hash 不等于原始 hash；两开关全程为默认 1，保持正式混合及肌肉支撑逻辑。该差异不来自源码漂移，也没有上传候选 GPU 权重。
