# 人物任务 R2.5：运行时装配与浏览器闭环

- 完整源码基线：`upload/human-workbench-20260915@2c10eda`
- 工作分支：`feature/human-task-workbench-adjustment-v2-fullbase`
- 装配提交：`77328b00f7e9e9c4a1d1da63bf7b3f9820ecc8c1`
- 生成入口 SHA-256：`23eed223a6d1ec72a6eb1bb720185de3439011daf03c28c1ea28adcfb1bf89cb`

## 本轮目的

前面已经分别完成勾选派单、预测绕行、目标站位、交叉通行、狭窄通道和共享资源机动，但独立的 `NPCTaskSelectionBridge` 尚未进入最终装配入口。源码模块存在不等于网页已经使用它；本轮把任务选择桥正式接入 `source/runtime.template.js`、`source/assembly.json` 和生成后的 `index.html`。

## 运行时变化

人物勾选集合 `population.selected` 现在是任务接收者的唯一权威来源。原面板中的“已选人物 / 全体人物”第二套范围选择仍保留为隐藏兼容元素，但不再作为可见交互。

面板增加：

- `仅当前人物`
- `反选`
- 实时任务接收者文本

任务桥只包装原有 `installNPCPopulationControls()`，不建立新的队列、人物注册表、任务时钟或身体控制权。

## 文件装配结果

集中构建完成：

- Runtime：2,923,813 字节
- Entrypoint：1,701,721 字节
- 未解析标识符：0
- `sourceAssemblyMatches`：`true`
- 旧模型依赖：0
- 模型文件：0
- 图片文件：0

静态审计、动作协议、NPC 日常、重建、MotionLab、角色、毛发、皮肤、面部、体型、NPC 人口和物理文件检查全部通过。静态审计仍保持 `visualAcceptance:false` 与 `productionReady:false`，不能由文件检查替代视觉验收。

## 浏览器闭环

浏览器测试使用最终生成的 `index.html`，并等待真实身体 iframe 建立 `HumanLab.population`、生成母体双人和安装任务选择桥。

结果：

```json
{
  "passed": true,
  "startupMilestone": "population",
  "population": 2,
  "selected": ["npc-1"],
  "recipientText": "任务接收者（1）：R2 参考人物",
  "selectedTaskAccepted": true,
  "unselectedQueueChanges": 0,
  "pageErrors": 0
}
```

测试证明：

1. 生成入口可以在无头 Chromium 中建立两位真实 NPC 实例。
2. 任务选择桥已经进入最终网页，而不是只存在于源码目录。
3. 旧范围选择已隐藏并固定为 `selected`。
4. 单选一个人物后，界面显示唯一任务接收者。
5. 向已选人物派发“挥手”时，仅返回一个接受者。
6. 未勾选人物的队列和运行状态没有变化。
7. 测试过程没有页面脚本错误。

浏览器实拍保存在 GitHub Actions 产物 `task-runtime-browser-r25`，保留 14 天。

## 为什么没有等待完整六人启动

完整启动在生成母体双人后，还会依次生成四位外观对照角色。第一轮浏览器测试等待全部启动，在无头软件渲染环境中超过四分钟。

这不等于程序发生逻辑错误，但说明“等待完整作者态场景”不是高效的任务接线冒烟测试。本轮将验收点收敛到：

```text
HumanLab.population 已建立
+ 母体双人已存在
+ 任务选择桥已进入页面
+ 单人派单只改变被选人物
```

四位外观对照角色、完整皮肤完成时间和长期帧率另属性能与视觉验收，不能混入基础任务接线测试。

## 回归规则

永久 `Task Traffic Checks` 现在额外执行：

- `ui/NPCTaskSelectionBridge.js` 语法检查
- `node tools/build-pure.mjs --check`

因此后续任何源码修改如果忘记重建 `index.html`，或装配清单与生成入口不一致，CI 会直接失败。

完整浏览器冒烟测试保留为手动工作流 `Task Runtime Browser Smoke`。它不会在每一次小提交上重复消耗三分钟以上，但在合并前可以重新执行并输出截图证据。

## 当前边界

本轮已验证最终网页中的人物选择与单人派单接线，但尚未证明：

- 八个完整表皮人物长期运行性能；
- 浏览器内四路交叉和狭窄通道的视觉自然度；
- 多人同时搬运不同刚体；
- 桌面浏览器以外的平台表现；
- 用户视觉接受与生产就绪。

下一轮应在已装配网页上建立四人交通与共享资源的浏览器场景测试，重点观察路线摆动、绕行长度和任务是否在动态冲突中保持连续。
