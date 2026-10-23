# 身体三维工作页

当前工作版：`delivery/人物身体_R20_结构细节与动作调整.html`。双击即可离线操作；本机运行中的工作页为 http://127.0.0.1:8914/ 。页面刷新后读取最新构建。R17、R18、R19保留对照。

本轮连续推进了躯干和四肢的体积与结构、肩髋动作响应、关节体积补偿，以及手掌/手指和脚跟/足弓/脚趾的局部函数。页面支持旋转、缩放、Shift拖动平移、动作切换、观察光线和完整人物保存载入。交付以实际三维页面为主，不制作截图画廊。

这仍是重构中的身体工作版。原身体形态系数、完整绑定权重及局部尺寸校准保留来源；局部函数替换不等于整个人体已经自主，形体自然度与所有动作组合也没有宣告完成。头部板块不修改。

构建与检查以 `BUILD.json` / `BUILD-R20.json`、`DELIVERY.json` 和 `TASK_ANCHOR.json` 为准。实施记录见 `docs/ANATOMY-AND-REGIONAL-FUNCTIONS-R20.md`，真实浏览器检查记录位于 `qa/anatomy-r20/`。

## 本地操作

- 构建当前工作版：`node tools/build-r20.cjs`
- 启动实际三维工作页：`node tools/preview-body.cjs`
- 身体数值、两套驱动和区域函数检查：`node tools/test-anatomy-r20.cjs`
- 实际网页、动作、完整人物及旧档兼容检查：`node tools/qa-anatomy-r20.cjs`
- 加速前后完整标量/材料/法线场比较：`node tools/check-field-optimization-r20.cjs`

GitHub同步到 `haihao0307/Humanoid-Rig-Lab-Next` 的 `body/reconstruction-r18-20261023` 分支；主分支保持独立。
