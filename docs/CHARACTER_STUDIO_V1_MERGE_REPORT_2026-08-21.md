# Character Studio v1 合并记录

日期：2026-08-21

基线：`origin/main` @ `d149cda`

整合分支：`integration/character-studio-v1`

## 合并来源

- `feature/character-studio-shell`：三栏页面、模块挂载槽、单一 simulationRig 视口。
- `feature/character-studio-panels`：Identity、BodyShape、Face、Clothing、Hair、Accessory、Proportion、Pose、Animation 九面板。
- `feature/character-studio-state`：session、ProjectState、Revision、OperationEvent、IndexedDB、OPFS、多窗口同步、导出和测试。

远端和本地最初没有已提交的 shell 分支；其三份源文件只存在于发布工作树的未跟踪改动中。整合时在独立 worktree 中按原文件内容建立 `feature/character-studio-shell`，没有触碰发布工作树内其他未提交改动。

## 冲突处理

- `apps/character-studio/index.js`：保留 shell 的页面与视口生命周期、panels 的九面板挂载、state 的统一 session/persistence/export；页面只创建一个 ProjectHubClient。
- `apps/character-studio/character-studio.css`：合并三栏布局与面板样式，不复制第二套页面结构。
- `package.json`：统一 `test:character-studio`，串联面板、状态、多窗口和最终装配测试。
- 构建清单：Character Studio 作为集成应用记录在 `characterStudio` 节点，不进入原模块 `activeVersions`。

Schema 没有合并冲突。CharacterProfile 保持引用式数据结构；`character_revision` 与 `appearance_revision` 进入 Studio session/export 摘要，不允许 Character 直接拥有骨骼、骨长、父子关系或动画轨道。

## 最终数据流

```text
用户操作
→ Character Studio Panel
→ Character Core 或现有模块接口
→ ProjectHubClient / ProjectState
→ Revision / OperationEvent
→ IndexedDB 保存
→ SharedWorker 广播
```

Clothing 与 Appearance 只读取 `simulationRig` 附件变换。BodyShape 只影响 Skin。Proportion、Pose、Animation 保持各自模块边界。动画逐帧采样和时间轴拖动预览属于临时态，不写项目历史。

## 自动验收

`npm test` 通过：131 个必需文件、ProjectState schema 11、Character 全链路、九面板、四窗口同步、单状态中心、单视口、资源消息边界、原四模块、动画专项和 V8.5 回归均为 0 失败。

按项目协作规则，本轮没有代替用户操作桌面浏览器；WebGPU 画面、鼠标交互和多窗口长时间运行仍由用户人工验收。
