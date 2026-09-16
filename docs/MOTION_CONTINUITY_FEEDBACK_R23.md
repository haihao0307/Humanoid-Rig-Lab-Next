# 动作连续性与方向反馈 R23

日期：2026-09-15。基线为 `upload/human-workbench-20260915` 的提交 `2c10edaec6e8515bc64f9df8b3da78cb34c89e61`，开发分支为 `feature/human-motion-workbench-adjustment-v1`。

本轮只处理动作连续性和力量反馈，不修改肩胸表面、蒙皮权重、重建参数，也不修改锁定的 `motion/vendor/` Motion-Lab R2.2 文件。

## 已完成

### 起身后的脚锚继承

`NaturalLocomotion.resetFromPose({preservePoseContacts:true})` 现在读取已经提交的左右髋中心和左右脚世界位置，将它们作为新的根节点与脚锚，并重新求解双腿。不可达残差超过 12 mm 时拒绝采用。诊断保存 `poseAdoption`。

`BasicController` 在 `sitToStand` 完成后采用上述真实脚锚；返回实验室站姿的 0.4 秒混合继续保留脚部接触，而不是重建标准站距。

### 混合期间保留接触证据

`MotionLabPose` 不再在 `blendFrom` 中清空接触误差。受控双腿会针对现有世界脚锚重新执行固定骨长 IK，然后重新测量脚和手的位置、方向误差，再进入原有骨长、附着与接触阈值验证。

### 显式坐卧支撑状态

`BasicController` 保存 `seatedStable` / `lyingStable`，内容包括根节点、朝向、左右脚、左右手和动作来源。离开坐卧状态时读取该支撑状态。现有采集片段仍未被替换，因此这只是状态接线修复，不代表坐起来源已经完全匹配。

### 三维力量反馈

`StrengthModel` 与 `StrengthBridge` 保留 `accelerationVectorMps2`。竖直分量进入 `m(g+a_y)`，水平分量形成独立惯性力；推动只使用水平惯性增量。旧规划请求只有标量时，搬运仍按保守向上增载解释，推动仍按原有水平增载解释。

运行时蹲姿优先读取最终提交的 `agent.h.root.p[1]`，仅在其无效时回退导航根。诊断新增 `postureInput` 和实测加速度向量。

10 kg 专项算例：静止竖直控制力 98.1 N；向上 2 m/s² 为 118.1 N；向下 2 m/s² 为 78.1 N；纯水平 2 m/s² 保持 98.1 N 的竖直控制力，并产生 20 N 水平惯性力。

### 连续路线经过点

`NaturalLocomotion` 对不超过 45°、身体扫掠无碰撞的中间点采用 45–160 mm 经过半径，不再把每个中间点当成最终停止点。连续两个语义 `walk` 在下一方向不超过 60°时可保留出口速度；90°显著转向仍完成制动和换脚。

## 验证

新增：

- `tools/test-motion-support-continuity.mjs`
- `tools/test-strength-vector-feedback.mjs`
- `tools/test-walk-route-continuity.mjs`

结果：

- 起身混合 16 个脚样本，最大脚锚漂移与脚目标误差约 `1.11e-16 m`。
- 方向力量算例与最终骨盆输入通过。
- 三个共线路点通过两个中间点，最低中段速度 `0.48 m/s`；90°语义转向拒绝连续交接。
- 原有蒙皮附着、动作范围、地面接触和箱体接触手形专项回归继续通过。
- `build-pure --check`、`audit-files.py` 与 `check-pure.mjs` 通过；生成入口 SHA-256 为 `fb2bf937e4d7918e7c84704b01b0c60d7c46a6ccd4d9019c230f341ceb279244`。

全部验证均为文件或 Node 级运动学检查；没有运行浏览器、人物模拟或 GPU，`visualAcceptance=false`、`productionReady=false`。

## 尚未解决

1. `standToSit` 末帧与 `sitToStand` 起点仍不是同一来源坐姿。
2. 转身仍沿用 Motion-Lab R2.2 的硬角速度和支撑脚扭转闸。
3. 步态上体相位仍由摆脚事件重定位，尚未改为连续展开相位。
4. 箱体手形仍是工程净空配方，不是真实逐指闭合。
5. 人物仍是运动学角色，物体反作用力尚未形成重心、支撑面和主动换脚反馈。
6. 肩腋 A45/T90 折叠属于表面、权重和补形问题，本轮未修改共享绑定文件。

下一轮应处理坐姿准备状态、连续步态相位和角速度连续转身，然后建立轻量重心与支撑面反馈。
