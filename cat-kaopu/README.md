# Cat Kaopu — 第一阶段世界环境生物 NPC

Current entry: `workbench/CAT_KAOPU_CURRENT.html`

Runtime payload: `runtime/cat_v440.bin` (unchanged)

当前生产分支：`codex/cat-kaopu-phase1-environment-npc-20260916`

本阶段的产品目标不是继续完成一只猫的全解剖复原，而是建立可复用、低开销、可进入大型场景的基础环境生物 NPC。生产优先级已经固定为：

1. 整体形态与四视图轮廓。
2. 起步、直行、停止、转向和四足接触。
3. 单体地面、墙体和简单障碍碰撞。
4. 实例 DNA 接口与后续群体验证。
5. 生活行为、近景眼部、胡须和毛发细节后置。

V4.46 双眼统一面部载体与 `runtime/cat_v440.bin` 继续保留为历史回滚基线，但不再是下一生产门。V4.32 中性表面从“最终冻结体”调整为“历史稳定基线”；Phase 1 将在不破坏 34 骨架、固定骨长、V4.39 姿势修形和 V4.36 接触链的前提下，重新开放整体体型修正。

阶段定义：`docs/CAT_KAOPU_PHASE1_ENVIRONMENT_NPC_DIRECTION_2026-09-16.md`

当前仍保持：

- `visualAcceptance=false`
- `productionReady=false`
