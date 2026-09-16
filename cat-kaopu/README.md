# Cat Kaopu — 第一阶段世界环境生物 NPC

Phase 1 entry: `phase1/index.html`

Fixed Gate A workbench: `phase1/CAT_KAOPU_PHASE1_GATE_A_SINGLE_NPC_2026-09-16.html`

Historical V4.46 entry: `workbench/CAT_KAOPU_CURRENT.html`

Runtime payload: `runtime/cat_v440.bin`（保持不变）

当前生产分支：`codex/cat-kaopu-phase1-environment-npc-20260916`

本阶段的产品目标不是继续完成一只猫的全解剖复原，而是建立可复用、低开销、可进入大型场景的基础环境生物 NPC。生产优先级已经固定为：

1. 整体形态与正面、侧面、顶部、三分之四轮廓。
2. 站立、起步、直行、停止、左右转向和四足接触。
3. 单体地面、墙体和简单障碍碰撞。
4. 单体通过后再进入实例 DNA、6–12 只群体、空间索引和局部避让。
5. 生活行为、近景眼部、胡须和毛发细节后置。

## 当前生产门

`Gate A · 单体形态 / 核心运动 / 简化碰撞代理`

当前 Gate A 工作台在 V4.46 稳定运行时之外增加：

- 四个固定形态检查视角；
- 站立、直行和左右转向的直接测试入口；
- 骨盆、胸腔、头部三个低成本碰撞代理；
- 一面可配置静态测试墙；
- 有界穿透修正、步态减速和碰撞诊断；
- 面向自动 QA 的 Phase 1 状态与障碍配置接口。

本轮没有启用逐三角形全表面碰撞，也没有宣称群体、个体差异或局部避让已经完成。数量增加不能代替单体质量，个体差异也不能由无约束的部位随机缩放实现。

V4.46 双眼统一面部载体与 `runtime/cat_v440.bin` 继续保留为历史回滚基线，但不再是下一生产门。V4.32 中性表面从“最终冻结体”调整为“历史稳定基线”；Phase 1 将在不破坏 34 骨架、固定骨长、V4.39 姿势修形和 V4.36 接触链的前提下，重新开放整体体型修正。

相关文件：

- 阶段定义：`docs/CAT_KAOPU_PHASE1_ENVIRONMENT_NPC_DIRECTION_2026-09-16.md`
- Gate A 合同：`phase1/PHASE1_NPC_CONTRACT.json`
- Gate A 清单：`phase1/PHASE1_GATE_A_MANIFEST.json`
- 执行报告：`docs/CAT_KAOPU_PHASE1_GATE_A_EXECUTION_REPORT_2026-09-16.md`

当前仍保持：

- `visualAcceptance=false`
- `productionReady=false`
