# Bird Mother / Original Bird R0.17.1 全量交接包

日期：2026-09-21

本文件是重新开线时的唯一入口。

## 固定仓库与快照

- 仓库：`haihao0307/Humanoid-Rig-Lab-Next`
- 全量交接分支：`handoff/bird-mother-original-bird-full-r0171-20260921`
- 交接前生产分支：`bird-mother-original-bird-r001-20260920`
- 交接前精确提交：`12980b04975b172c88e8ffc3996932d59fa689f1`
- 现有 Draft PR：`#12`
- PR 基线：`experiment/bird-r57-authoritative-reference-reconstruction-v1`

全量交接分支从上述精确提交直接创建，因此包含当前全部源码、工作台、测试、工作流、蒸馏数据、工作记录和历史候选，没有从 `main` 重建，也没有改写历史。

## 重新开始时只读这里

1. `handoff/FULL_R0171_20260921/00_START_HERE_ZH.md`
2. `handoff/FULL_R0171_20260921/01_FULL_HANDOFF_ZH.md`
3. `handoff/FULL_R0171_20260921/02_RESTART_PROMPT_ZH.txt`
4. `handoff/FULL_R0171_20260921/03_NEXT_EXECUTION_ORDER_ZH.md`
5. `handoff/FULL_R0171_20260921/04_KNOWN_STATE_AND_FAILURES_ZH.md`
6. `handoff/FULL_R0171_20260921/05_FULL_MANIFEST.json`

## 当前唯一生产入口

`Bird-Reconstruction-Lab/original-bird/workbench/original-bird-gull-form-r0171.html`

固定提交在线预览：

`https://raw.githack.com/haihao0307/Humanoid-Rig-Lab-Next/12980b04975b172c88e8ffc3996932d59fa689f1/Bird-Reconstruction-Lab/original-bird/workbench/original-bird-gull-form-r0171.html`

## 顺序锁定

1. 先完成 Original Bird 海鸥静态形体。
2. 同时只接入基础拍翼，用来暴露翼根、肩胸、肘腕、翼尖、尾部和羽毛穿插问题。
3. 静态五视角与基础拍翼变形通过后，再做羽层、透明边缘和材质。
4. 最后才允许滑翔、转弯、起飞、着陆、抗风和群体飞行。

任何新执行端不得把飞行研究工作台、合同、Schema、CI 数量或提交数量当成海鸥形体已经完成。

## 当前真实状态

- 已有独立生成的 R0.17.1 海鸥形体候选。
- 身体—胸腹—颈—头—喙使用连续载体。
- 左右翼各有连续蒙皮翼面和 shoulder / elbow / wrist / tip 四段翼链。
- 已加入基础拍翼、尾基、九枚尾羽、眼睛结构、喙缝、鼻孔、双腿、四趾和蹼足。
- 已修正右侧负缩放导致的法线问题。
- 已建立明亮背景、五个固定视角、并排高细主参考和浏览器 QA。
- 仍未获得静态形体视觉批准。
- 整只鸟仍不是单一连续表面。
- 羽层、Alpha 边缘和 3A 材质尚未完成到当前独立候选。
- 高级飞行保持关闭。
- `visualAcceptance=false`。
- `productionReady=false`。

## 源模型职责

- `BIRD-REF-005 / seagull2(2).glb`：形体与细节主参考。
- `BIRD-REF-004 / seagull(2).glb`：基础动作参考。

两套参考均不得作为最终商业运行时的网格、贴图、骨架或动画依赖。

## 版本管理规则

- 从全量交接分支另建新的工作分支继续。
- 保留现有 Draft PR #12，不另建替代 PR。
- 不合并 `main`。
- 不 force push。
- 不改写历史。
- 每次迭代必须有可直接打开的 HTML、控制台 0 错误检查、固定视角截图和失败证据。
