# 程序化眼球光学与眼睑整合 R6

2026-09-15。本阶段在 R4 眼裂与眼眶连续结构的基础上，将旧低分辨率虹膜替换为同一眼球局部坐标系中的程序化虹膜环与独立瞳孔，并进一步收敛上下睑、眼球和眼眶之间的空间关系。

## 已实施内容

- `body/EyeAnatomy.js` 使用 `r14-procedural-iris-lid-integration`。
- 眼白、程序化虹膜、瞳孔和眼睑使用同一眼球坐标框架、同一眨眼侧别和同一深度校正。
- 虹膜由有界环带生成，外半径 5.85 mm、瞳孔半径 2.10 mm；这些数值是当前 R2 头部的候选参数，不代表统计学平均值或个体扫描数据。
- 旧虹膜绘制片从生产显示中移除，避免新旧虹膜叠加。
- 眼球整体后移、上下睑开口和外缘过渡同时校正，避免只移动眼球而不移动眼睑造成的分离。
- `body/FaceAnatomy.js` 的宽范围眼眶凹陷继续减弱，保留局部上睑沟、下睑过渡和颧部体积。

## 架构边界

本阶段仅属于 Performance Deform / 高级表现层。它不修改 Core Rig、父子层级、骨长、绑定姿势或人物比例。虹膜、瞳孔、眼睑和眼眶仍然是程序化近似，不是扫描眼组织，也没有真实折射、泪膜动力学或眼外肌仿真。

## 验证

- `node tools/build-pure.mjs`
- `node tools/check-pure.mjs`
- `node tools/check-eye-anatomy.mjs --parameter-fixtures`
- 面部身份/表情分层、NPC uniform 隔离与启动测试
- 独立浏览器中完成单人物面部入口、正面、侧面和嘴鼻近景截图

程序与参数检查通过不等于视觉完成。当前仍保持 `visualAcceptance=false`、`productionReady=false`。
