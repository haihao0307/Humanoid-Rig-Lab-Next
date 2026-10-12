# 皮革工作台：从这里接续

更新：2026-10-11。此文件是皮革任务的恢复入口，不依赖聊天记录。

## 当前唯一执行任务

**LEATHER-S1：R10等效源码归一化。** 当前状态为 `S1B1_MACHINE_VERIFIED_S1B2_PENDING`。执行分支：`refactor/leather-r12-source-normalization-20261011`；实现目录：`leather-workshop/r12/`；Draft PR #51；恢复Issue #52。

恢复顺序：本文件 → `ROADMAP.md` → `TASK_STATE.json` → `r12/README.md` → `r12/qa/s1b/MACHINE_RECEIPT.json`。以分支实际文件和测试输出为准，不把聊天摘要或文档复述当作独立验收。

## 受保护基线

- 仓库：`haihao0307/Humanoid-Rig-Lab-Next`；
- R10源码：`9b3dfcc0cd89ff0be6ea459d86aaf71d508a9206`；
- R10固定构建：`af389cc216ddd01e3b1aa66c972f42b2587bc797`；
- R10分支回执头：`864caaa5fc324547c0aff64ef830d6de1eae6e6a`；
- R10 HTML SHA-256：`7da84eec41b6db9fe69c62ea17a3194283522004df92f47f0cd707d11b642622`；
- 旧稳定查看入口：https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/af389cc216ddd01e3b1aa66c972f42b2587bc797/leather-workshop/r10/public-lite.html
- 已认可R09.1质感、观察到的受力和厚度；R10是受保护性能迭代；
- 保留六款成品、十三种外观、六类工艺；立领夹克继续排除。

## 十项路线

完整内容在 `ROADMAP.md`。顺序为：源码归一化 → 实时性能 → 物理收敛 → 外观/物性分离与标定 → 历史效应 → 工艺物理 → 整张皮与磨损历史 → 制造链与共享协议 → 界面分层 → 设备与可靠性矩阵。

来源与许可是横向任务：合法成熟算法继续使用；许可明确的实现保留并带声明；未核实的具体实现先查证，不一概判为公有领域或强制重写。R11整数随机场仅为备用实验。

## 已完成

S1A完成固定哈希迁移和独立构建。S1B1进一步把63个活动输入逐项登记并锁定，把裁片、闭合壳体、纸样物理、装配语义和缝线宿主改为 `PanelAssembly` 的显式服务流水线，不再依靠模块加载顺序暗中覆盖原型。

机器回执：源码提交 `789778753567ccdd5383fd12641737a96eeaf7b4`，复验调度提交 `6fe5ec8baae83c2d8152fabe506d44af349f6184`，回执提交 `053e522c3d3b09d9a500597c8bade7dd204ec68d`，Actions运行 `38128801540`。122项门禁、18项数值、3项接口断言、25项几何案例和六款52步完整轨迹全部通过。

## 下一任务

`S1B2_EXPLICIT_APP_RUNTIME_INTERFACES`：只整理 `runtime.js`、`view-polish.js`、`atelier-controls.js`、`craft-ui.js`、`lifecycle.js`、`input-performance.js` 的晚期函数覆盖。每次只替换一个接口，并继续比较R10相机、选择、输入、产品、材质、厚度、物理和性能行为。不得开始新皮纹、黏弹、碰撞或性能算法。

恢复命令：

```sh
python leather-workshop/r12/build.py
python leather-workshop/r12/verify.py
```

## 当前边界

R01–R11、原公网链接、根LICENSE、其他工作台不改；仅独立分支、Draft PR，不合并、不强推。本阶段没有新浏览器、`file://`、实机或公网验收，R12候选不能替代R10。固定WASM仍按已认可二进制使用，不声称原生源码重编译等效。

## 交付检查

- [x] 没有用生成图片代替真实三维实现；
- [x] 已实际修改生产源码和构建架构；
- [x] 构建对象是真实可交互三维工作台，不是截图或占位页；
- [x] 皮革几何、厚度、针线和物理来自真实运行时并完成差分回归；
- [ ] 本阶段未新增浏览器镜头、选择和参数交互验收；
- [ ] 本阶段未新增公网固定链接与真实浏览器验收；
- [x] 只有截图不算完成；本阶段以规范源码和机器回执为交付。
