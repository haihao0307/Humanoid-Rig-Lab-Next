# Life Motion Environment Lab R01

**状态：隔离实验分支；行为编排和契约测试已实现，尚未接入生产三维运行时，也未通过视觉验收。**

本目录把生活化居民任务扩展为长时闭环：桌边取箱、双手抓握、提起、搬到柜子、放稳、松手；开关窗；开关门并通过门洞；上楼、平台转身、下楼；取书上架；再把箱子和书分别取回原位，最后回到待机位置。单轮 51 个任务，支持重复执行。

## 文件

- routine-engine.mjs：独立的长任务运行器、前置条件/事实、检查点、有限重试、状态日志与验收门禁。
- routine-engine.test.mjs：50 轮长任务契约测试，使用假适配器，不模拟人体或物理。
- motion-trace-audit.mjs：对真实运行时导出的逐帧 trace 计算根/关节速度与加速度、脚滑、手物接触误差、穿透和关节越界。
- motion-trace-audit.test.mjs：正常 trace 加 8 类异常 trace 的回归测试。
- real-controller-environment-soak.test.mjs：直接实例化总台 MotionController、FullBodyMotion 与 FlatWorld；同一组四条路线分别跑基线版和限加速度实验版，输出逐帧审计指标和前后对照。实验版仍在验证中，不因路线跑完就判定自然度通过。
- CI 只读运行人物总台已有的步态相位、足底支撑、动作过渡、蒙皮连接和撤手路径回归脚本；不修改这些生产源码。
- TASK_ANCHOR.json：任务边界、保护项与验收门槛。
- VALIDATION_REPORT.md：测试范围与明确限制。

## 执行测试

在支持 ES modules 的 Node.js 环境运行以下命令：

    node --check routine-engine.mjs
    node --check routine-engine.test.mjs
    node routine-engine.test.mjs

新增的真实控制器环境浸泡测试尚在 CI 执行；在该作业完成前，不把它计入通过结果。测试输出覆盖 51 项任务/轮、50 轮、2,550 个已验证任务回合、静态任务状态图检查及 166 个逐门禁拒绝探针；trace 审计另测脚滑、手物偏差、穿透、关节越界、时间戳与运动速度等 8 类异常，并以 1/120、1/60、1/30、1/15 秒四种步长交替推进、单次失败恢复、碰撞门禁拒绝和持物时延迟取消。

## 适配器边界

宿主必须提供 checkpoint / startTask / stepTask / observe / restore / recover / hasFacts。observe 必须从真实运行时返回脚底滑移、手物接触误差、关节限位、姿态速度/加速度、自身碰撞、环境碰撞、物体支撑和稳定性证据。运行器只接受明确通过的结果；缺失指标也会失败。

此模块不会自行产生人体姿态，不直接写骨骼，不取代现有 IK、物理、蒙皮或动作控制器。当前还没有将该适配器连接到 R05 网页，因此测试通过只证明长任务调度逻辑，不证明人物动作自然、物理正确或网页可用。

## 隔离原则

所有内容仅放在本实验目录；不修改 body/、control/、world/、source/assembly.json 或生产入口。后续只有在单独的集成验证通过并得到明确提升决定后，才讨论接入主系统。