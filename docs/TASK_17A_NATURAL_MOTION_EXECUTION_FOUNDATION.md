# Task 17A Human Core Natural Motion Execution Foundation

## 1. 用户最高目标

让 NPC 准确执行“转身、走到目标、停止”类行为指令，同时保持人的平衡、固定骨长、关节逻辑、脚底接触、节奏、重量感和全身协调。本轮不实现敬礼、抓取、搬运或放置。

## 2. 现有 Motion Foundation Audit

正式审计位于 `artifacts/qa/task17a-natural-motion/existing-motion-foundation-audit.json`。原有七个 Motion Foundation V4 资产全部保留且未修改；七个资产均是 `development-contract-fixture`，`visualAcceptance=false`。只有 Foundation Walk 同时具有左右腿支撑/摆动、Heel Strike 和 Toe Off；现有资产没有骨盆横向重心转移、胸盆反向旋转或双臂摆动，因此只作为比较基线，未被提升为生产动作。

## 3. 有限指令语法边界

`InstructionInterpreterAdapterV1` 只实现明确的中文开发语法：向左转、向右转、向后转、转过身去、走到目标点、走到黄色标记点、停下、到那里停住。固定声明：

- `generalNaturalLanguageSupport = false`
- `developmentGrammarOnly = true`

“向后转，走到黄色标记点，然后停下”和“转过身去，走到黄点停住”生成等价计划。适配器未来可以替换，BehaviorPlan 与 Motion Execution 接口保持不变。

## 4. BehaviorCommand

`BehaviorCommandV1` 固定记录 `commandId`、`actorId`、`text`、`locale`、`issuedAt`、`worldContextRevision` 和 `targetReferences`。Task 17A 只接受 `zh-CN`。

## 5. BehaviorPlan

`BehaviorPlanV1` 包含 `planId`、`sourceCommandId`、步骤、前置条件、完成条件、失败策略、当前步骤与状态。指令 A/B 的规范步骤均为：

1. `turn_in_place`
2. `walk_to_target`
3. `stop_and_settle`

## 6. MotionIntent

`MotionIntentV1` 保存起点、起始朝向、目标位置、目标朝向、期望速度、停止半径、地面法线与碰撞策略。Task 17A 的碰撞策略明确限制为平地、直线、无障碍开发场景。

## 7. FootstepPlan

`FootstepPlanV1` 为确定性计划。每个脚步包含侧别、Toe Off、Heel Strike、起止时间、起止位置、脚朝向和离地高度。行走左右脚严格交替，最后两脚分别进入目标位置；转身以交替迈步围绕原地完成，禁止仅旋转 Root。

## 8. 转身策略

支持左/右 90° 与左/右 180°。阶段包括准备、换重心、自由脚离地、旋转放脚、双支撑转移、最终放脚和稳定。Root 朝向使用连续曲线推进，但脚步和固定长度腿部 IK 同时运行；最终角度不通过瞬移纠正。左右轨迹严格镜像，正式数值镜像误差为 0。

## 9. 行走策略

行走以剩余距离决定每侧步数和最终步幅，单步包含双支撑延迟、Toe Off、摆动、足部净空和 Heel Strike。Root 从两脚中心和支撑转移得到，最终精确落在目标。骨盆产生横向/竖向变化，胸腔与骨盆反向旋转，双臂按对侧腿摆动，头部保持目标方向。页面相机跟随 Root。

## 10. 停止策略

步内余弦曲线让最后一步速度连续下降至零；随后进入至少 1.2 秒双脚支撑。Root、骨盆、胸腔和手臂在稳定段保持不漂移，最后支撑脚不移动。

## 11. 接触

`ContactBalanceControllerV1` 从 FootstepPlan 生成左右脚、脚跟与脚尖接触。支撑脚目标在完整 stance episode 中保持不变；摆动脚只在 Toe Off 与 Heel Strike 之间改变位置。正式指标中所有场景左右脚最大和平均滑动均为 0。

## 12. 平衡

控制器从接触脚矩形建立凸支撑区域，记录 COM、COM 投影、支撑状态、支撑切换、恢复次数和跌倒状态。双支撑和单支撑均有显式状态；11 个场景没有 COM 无控制越界，`fallDetected=false`。

## 13. Root Motion

Root 平移和 Root 旋转为独立通道。非根骨骼只有局部单位四元数，不存在位置或缩放轨道。链路保持：`BehaviorCommand → BehaviorPlan → MotionIntent → desiredPose → contact and balance → joint limits → fixed bone lengths → finalPose → Renderer`。

正式 30 FPS 指标：11/11 场景数值通过；最终位置误差均为 0，最终朝向误差均为 0，最大固定骨长误差为 `3.885780586188048e-16 m`，远低于 `1e-6 m`。

## 14. 六段正式视频

根据仓库 `AGENTS.md`，真实浏览器操作和视觉效果验收由用户执行。以下视频当前尚未生成：

- `artifacts/qa/task17a-natural-motion/videos/turn-left-180.webm`
- `artifacts/qa/task17a-natural-motion/videos/turn-right-180.webm`
- `artifacts/qa/task17a-natural-motion/videos/walk-forward-3m.webm`
- `artifacts/qa/task17a-natural-motion/videos/turn-180-walk-3m-stop.webm`
- `artifacts/qa/task17a-natural-motion/videos/instruction-command-a.webm`
- `artifacts/qa/task17a-natural-motion/videos/instruction-command-b.webm`

逐项 URL、时长、关键帧时间和输出路径见 `browser-capture-manifest.json`。

## 15. 数值结果

输出：

- `metrics.json`：11 个场景的门限、自然度和汇总。
- `frame-trace.json`：30 FPS 完整 finalPose 序列。
- `contact-trace.json`：脚、脚跟、脚尖、支撑与事件。
- `balance-trace.json`：COM、支撑区域、切换和跌倒状态。
- `behavior-plan-a.json` / `behavior-plan-b.json`：等价计划证据。

全部场景：骨长、关节限制、非有限值、Root 瞬移、膝/肘反向和四元数符号连续性通过。行走中的最长 Root 静止间隔为约 `0.10 s`，低于 `0.35 s`。停止后 Root 速度、Root 角速度和双脚漂移均为 0。

## 16. 视觉结果

当前 19 项视觉审查全部为 `unsupported`，不是 `pass`。原因是本轮遵守 `AGENTS.md`，未替用户操作浏览器、录制视频或判断视觉自然度。页面和采集清单已准备完成，但只有用户生成真实媒体并逐项复核后才能更新这些状态。

## 17. 已知限制

- 只支持有限中文开发语法，不是通用自然语言系统。
- 只覆盖平地、直线路径与已知目标；没有导航网格和障碍物规避。
- 动作为程序化执行基础，不是动作捕捉资产。
- 数值通过不等于视觉自然。
- 主显示为 HumanRigCore 骨架；不依赖 Task 16A Native Surface。
- 没有修改人体网格、蒙皮、IBM、BodyDNA 权威、HumanRigCore 层级或表面算法。

实现依据包括 Three.js 单位四元数与 SLERP 接口、人体步态的 Heel Strike/Toe Off 与 COM 相位关系、以及支撑区域内 COM/CoP 的稳定性原则：

- https://threejs.org/docs/pages/Quaternion.html
- https://pmc.ncbi.nlm.nih.gov/articles/PMC5558990/
- https://web.eecs.umich.edu/~grizzle/papers/Westervelt_biped_control_book_15_May_2007.pdf

## 18. 后续 Task 17B 接口

Task 17B 可以新增 `salute`、`reach`、`grasp`、`lift`、`carry` 和 `place` BehaviorPlan 步骤。InstructionInterpreterAdapter 可替换为更强解释器，但仍必须输出相同 BehaviorPlan/MotionIntent 合同；物体交互不能修改 HumanRigCore 层级、骨长或 finalPose 权威链。

## 19. 最终结论

当前结论：`INCONCLUSIVE`。

原因不是数值执行失败：11/11 场景、指令 A/B 等价性、脚底接触、平衡、固定骨长、目标位置/朝向和 30 秒稳定性均通过。阻塞项是六段真实浏览器视频、12 张关键帧、三张诊断图、Contact Sheet 和 19 项用户视觉审查尚未完成。在这些证据完成前，必须保持：

- `visualAcceptance = false`
- `productionReady = false`
- `userVisualAcceptance = pending`
