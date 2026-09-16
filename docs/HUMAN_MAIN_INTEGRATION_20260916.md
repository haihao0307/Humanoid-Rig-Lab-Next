# 人物项目统一入口：动作、任务与面部

后续开发从 `haihao0307/Humanoid-Rig-Lab-Next` 的 `main` 创建工作分支。三个模块使用同一份完整人体源码，不再分别从旧 main 或独立上传包开始。

## 纳入的版本

| 模块 | 来源分支 | 本次核对的提交 |
| --- | --- | --- |
| 完整人体与面部 | upload/human-workbench-20260915 | e32f2f30f6922fc5faded6b4f944d7b33ee893dc |
| 面部原始分支 | feature/human-face-workbench-v1-20260915 | e98cc2a75c78b0eafec1a562592704a5ed94597f，已由 PR #4 纳入完整人体 |
| 动作 | feature/human-motion-workbench-adjustment-v1 | 2cd74ac8142437078a71a38c48a2f73daa72909e |
| 任务系统 | feature/human-task-workbench-adjustment-v2-fullbase | 098319d39f14a915f3d840abe9b9a6f7d1dee636 |
| 旧 main 独有规则 | main | dde5a410fadc2fac5aaa3eb911095ebecdfcba8e |

动作 PR #5 原先只合入独立交接分支，并未合入完整人体分支。本次同时纳入动作和任务 v2，与已合入的面部源码汇合。

## 合并决定

- `NaturalLocomotion.resetFromPose` 同时保留动作的脚锚姿态接管、连续相位和转身过滤器重置，以及任务系统的预约释放和新交通状态。
- `NaturalLocomotion.update` 同时保留转身摆脚重定向和导航阻断恢复。
- 人物独立面部状态、任务接收者选择桥、共享工位预约和资源机动使用同一人口管理模块。
- 装配清单和运行入口取三个模块的并集；`index.html` 从合并后的生产源码重新构建。
- 旧 main 的独有提交只修改 AGENTS.md，真实三维交付规则保留。旧人体运行时已由完整源码基线替代，不重新引入。
- 旧任务 v1 的独立 NPCTaskCoordinator 不采用：任务 v2 文档明确用现有 NPCPopulation 作为队列和人物状态的唯一权威。旧分支历史仍可查询；本次没有删除远程分支。

## 后续编辑入口

- 动作：`body/NaturalLocomotion.js`、`body/ReferenceMotion.js`、`body/MotionLabPose.js`、`body/LightBalanceFeedback.js`、`control/TaskAgent.js`。
- 任务：`control/NPCPopulation.js`、`ui/NPCPopulationControls.js`、`ui/NPCTaskSelectionBridge.js`。
- 面部：`body/FaceIdentity.js`、`body/FaceControls.js`、`body/FaceAnatomy.js`、`body/EyeAnatomy.js`。
- 共享入口：`source/assembly.json`、`source/runtime.template.js`；不要直接修改生成后的 `index.html`。

## 验证及已知边界

本次执行文件构建、源码语法/装配/依赖检查以及文件审计，不启动网页、人物模拟或 GPU。文件检查不能视作动作自然度、多人导航或表情的运行验收。

任务源分支的 `body/CrowdIntersectionCoordinator.js` 与 R2.7 应用脚本尚未加入运行装配。本次原样保留它们作为待完成工作，不自动执行一次性补丁脚本、不声称开放交叉通行 R2.7 已生效。当前生效的是任务 v2 已装配的选择、预测避让、站位预约、狭窄通道和资源机动逻辑。下一步应在单独工作分支检查 R2.7 补丁、接入共享入口并完成相应验收。

原有动作/任务 GitHub Actions 多数仍限定各自开发分支；它们的历史结果不是整合后 main 的验证结果。浏览器与视觉工作流只能在另行授权后运行。

## 三维交付检查

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际合并并修改生产源码。
- [ ] 用户看到的是可交互三维工作台（本轮仅交付源码整合，未启动）。
- [ ] 人物几何、骨骼和动作来自真实运行时（保留代码，未进行运行验收）。
- [ ] 镜头、选择、动作或参数控制可以实际操作（未进行运行验收）。
- [ ] 公网固定链接和真实浏览器已验证（本轮未执行）。
- [x] 如果只有截图而没有工作台，本轮判定失败；本轮交付完整项目源码及生成入口。
