# 动画资产说明

本目录保存动画模块可独立导入、导出和版本化的动作资产。结构化动作统一使用 `humanoid_rig/motion_clip@1.0`，动画会话使用 `humanoid_rig/animation_session@0.4`。

当前基础动作库包含：

| 文件 | 动作 | 循环 | 根运动 | 接触与事件 |
| --- | --- | --- | --- | --- |
| `idle-breathe.motion.json` | 待机呼吸 | repeat | in_place | 呼吸阶段事件 |
| `wave-right.motion.json` | 右手挥手 | repeat | in_place | 手势开始、摆动和结束事件 |
| `head-nod.motion.json` | 点头 | once | in_place | 点头方向事件 |
| `squat.motion.json` | 下蹲与起身 | once | in_place | 双脚接触区间与下蹲事件 |
| `walk-in-place.motion.json` | 原地行走 | repeat | in_place | 左右脚支撑、脚跟触地和脚尖离地事件 |
| `walk-forward.motion.json` | 向前行走 | repeat | root_motion | 根节点位移与左右脚接触事件 |
| `basic-animation-session.json` | 基础动画会话 | 多片段 | 混合 | 动画层、状态机、运行设置与烘焙设置 |

动作旋转轨道只保存稳定关节 ID 对应的局部四元数。位置轨道只允许根节点。普通动作不保存骨骼缩放、绑定局部位置、父子层级、蒙皮权重或逆绑定矩阵。

跨人物比例播放时，局部四元数直接应用到目标绑定骨架，根运动按身高缩放，脚底接触通过目标骨长和两段腿 IK 重新求解。来源动作继续保留，重定向结果以独立动作版本保存。

内置动作统一以 `+Y` 为向上、`+Z` 为人物向前方向。挥手、下蹲和行走手臂不再直接复用易混淆的左右 Euler 符号，而是先声明目标骨段方向，再按父子链求出局部四元数。回归测试同时检查挥手抬高手臂、点头前后、下蹲膝盖与躯干朝向、行走左右步序、对侧摆臂和支撑脚世界朝向，防止动作在边界适配后再次整体反向。
