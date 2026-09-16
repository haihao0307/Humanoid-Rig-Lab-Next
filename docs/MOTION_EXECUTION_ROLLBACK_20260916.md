# 动作执行失败后的连续状态回滚

基线：整合后的 main `3c3e9a4`。工作分支从该 main 新建，未沿用旧动作分支。

## 问题与修改

源码检查发现，`Agent.saveSafe/fail` 保存并恢复了骨架和 MotionController 内核，但没有恢复内核之外的连续步态相位、转身速度/加速度、平衡反馈的上一帧根位置和速度。候选姿态被拒绝后，这些过滤器仍停留在失败帧；恢复动作时可能出现相位、转向或加速度反馈不连续。本轮尚未通过运行测量量化该现象。

`NaturalLocomotion.snapshotExecution/restoreExecution` 将过滤器与动作诊断状态纳入现有事务。LightBalanceFeedback 通过现有适配器扩展保存/恢复，保留活的 Agent、内核和回调引用。如果首次失败帧才创建平衡反馈，回滚会移除它及人物上的姿态引用。检查点与运行中数组相互独立，可反复恢复。

`TaskAgent.js` 只替换动作检查点的保存和恢复调用。没有新增人物队列，没有修改任务调度、人物选择、外貌或面部。共享避让、目标站位预约、预约释放和阻断恢复算法保持原样；不修改锁定的 `motion/vendor`。

## 共享接口

- 输入：`snapshotExecution()` 读取当前人物的动作执行状态；`restoreExecution(saved)` 接受该人物同一运行实例生成的检查点。
- 输出：检查点包含原有 requestKey/requested/tempo/traffic，以及 phase、turn、动作诊断和可选 balance。恢复保留过滤器实例与内核回调，不创建新内核或任务队列。
- 顺序：Agent 先恢复内核，再恢复动作执行状态，再 sync，最后恢复已提交骨架；调度、物体所有权和共享物理回滚沿用现有实现。
- 兼容性：这是进程内事务接口，不是持久化格式；旧进程的 lastSafe 不跨版本导入。未装配平衡模块时，基础动作快照仍可使用。
- 任务板块配合：无需修改目标、路线或交通约束输入；若新增失败恢复入口，请走现有 Agent.fail，避免只恢复内核而跳过动作过滤器。共享资源预约表仍由任务系统管理。

## 验证边界

- 文件检查：执行 `node tools/build-pure.mjs`、`node tools/check-pure.mjs`、`python tools/audit-files.py`，并检查新增测试语法。index.html 仅通过装配生成。
- 新增 `tools/test-motion-execution-rollback.mjs`：首次执行、行走中、转身中调用真实 Agent.saveSafe/fail；恢复后重放六步，对比内核、相位、脚锚、转身、平衡和姿态候选，并再次恢复同一检查点。物理与可见姿态提交使用桩，步态和 IK 使用生产模块。
- 运行验证：未执行新增测试或已有动作模拟测试。待后台运行授权后，先运行新增用例，再运行 phase/turn/support/standing-height/light-balance 及任务 traffic/target-reservations 回归。
- 浏览器和视觉验收：未执行，不声称动作自然度、平衡动力学或交互工作台已验收。
- 调研依据：[Three.js MathUtils.damp](https://threejs.org/docs/pages/MathUtils.html) 的按时间差平滑说明；本轮保留现有响应参数，只修复失败帧的状态历史。

## 三维交付检查

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改生产源码。
- [ ] 用户看到的是可交互三维工作台（已重建入口，本轮未启动）。
- [ ] 人物/动物几何、骨骼和动作来自真实运行时（保留生产实现，本轮未运行验收）。
- [ ] 镜头、选择、动作或参数控制可以实际操作（本轮未验证）。
- [ ] 公网固定链接和真实浏览器已验证（本轮未执行）。
- [x] 如果只有截图而没有工作台，本轮判定失败；本轮交付源码及生成入口，不用图片代替实现。
