# R12-S1B1：规范源码登记与显式裁片装配流水线

本目录当前完成源码归一化第一步中的第二个子阶段。R10仍是用户可见的冻结基线；R12是源码候选，不是新视觉版本，也没有替换旧固定网页。

## 恢复入口

依次读取上级 `START_HERE.md`、`ROADMAP.md`、`TASK_STATE.json`，再读取本文件。持久入口是 Issue #52，执行分支是 `refactor/leather-r12-source-normalization-20261011`，Draft PR是 #51。

冻结基线：R10构建 `af389cc216ddd01e3b1aa66c972f42b2587bc797`，HTML SHA-256 `7da84eec41b6db9fe69c62ea17a3194283522004df92f47f0cd707d11b642622`。R11随机场实验不参与本线，立领夹克继续排除。

## S1A基础

S1A建立了固定哈希迁移、独立装配图和不执行历史构建器的构建器。它证明R10可以从整理后的源码完整重建，并把任务路径、路线和恢复命令写入GitHub。

## S1B1实际修改

当前版本把所有活动源码、兼容页、许可文件、扫描纹理和固定原生内核载荷登记为独立、可审查、带哈希的规范输入。`canonical.lock.json`锁定63个活动输入；接受的WASM没有改变，采用八个gzip/base64文本块和描述文件保存，构建时逐块及解码后双重校验。

裁片系统不再依赖若干模块在加载时暗中重写 `PanelAssembly.prototype`。现在由 `PanelAssembly` 明确调用服务边界：

- `add`：先执行 `AssemblyContract.prepare`，再执行 `PatternPhysics.add`；
- `idsAt`、`binding`：由 `PatternPhysics` 提供；
- `buildPanel`：由 `ClosedShell.buildPanel` 提供；
- `connect`：明确执行基础连接并记录 `AssemblyContract` 碰撞缝；
- `yarnBinding`：由 `YarnHost.binding` 提供；
- `finish`：按基础装配、物理帧完成、装配语义完成的固定顺序执行。

旧 `surface-integrity` 后置覆盖不再进入活动装配。保留的外观、蒙皮着色、节点帧更新、产品Worker、试样Worker、扫描数据、R02兼容页和R05归档均有不变门禁。

## 构建与复验

从仓库根目录执行：

```sh
python -m pip install -r leather-workshop/r12/requirements-build.txt
python leather-workshop/r12/build.py
python leather-workshop/r12/verify.py
```

普通构建只读取 `r12` 下声明的规范输入，不运行旧Python构建器，不读取历史目录作为回退，不执行 `exec`、`eval` 或 `runpy`。源码、原生载荷或资源缺失、变更时必须失败。

GitHub Actions运行 `38128801540` 已在提交 `6fe5ec8baae83c2d8152fabe506d44af349f6184` 上完成真实机器复验，并在提交 `053e522c3d3b09d9a500597c8bade7dd204ec68d` 写入回执：

- 122项源码、装配、语法和故障注入门禁通过；
- 18项既有数值用例通过；
- 3项显式接口断言通过，包括零长度连接仍保留碰撞缝语义；
- 25种产品、工艺、针法、厚度和缩略图几何案例与独立重建的冻结R10参考一致；
- 六款保留成品均执行完整52步提起/释放轨迹，候选与参考最大位置差为0，皮面帧一致，最终穿透数为0。

准确数据以 `qa/s1b/SUMMARY.json`、`qa/s1b/equivalence.json` 和 `qa/s1b/MACHINE_RECEIPT.json` 为准。

## 为什么候选HTML哈希不同

候选加入架构来源标记，且活动裁片模块由后置覆盖改为显式服务调用，所以最终文件不再逐字节等同R10。候选HTML SHA-256为 `611fc8f4c40bc45617ba30b399bea66b66c8816bbbe4f58ebe6e68a3fad905fb`，大小3,628,494字节。等效性通过独立冻结参考、模块不变检查、几何数据、厚度、针线、物理输入和完整轨迹比较证明，而不是只比较页面文件哈希。

## 未完成和边界

S1尚未全部结束。应用层仍保留若干晚期函数覆盖，下一步S1B2只整理 `runtime`、`view-polish`、`atelier-controls`、`craft-ui`、`lifecycle` 和 `input-performance` 之间的显式接口；不能趁机修改皮纹、磨损、相机、抓手、厚度、物理参数、碰撞精度或性能策略。

本阶段没有新浏览器检查、没有 `file://` 验收、没有手机实机、没有新公网部署，也没有用户视觉验收。R12候选不能替代R10，`runtimePromotionAllowed=false`。接受的WASM仍是固定二进制，本阶段不声称从原生源码重编译等效。

## 交付门禁

- [x] 没有用生成图片代替真实三维实现；
- [x] 已实际修改生产源码和构建架构；
- [x] 构建对象仍是真实可交互三维皮革工作台，不是截图或占位页；
- [x] 几何、厚度、针线、物理输入和六款完整轨迹均经过差分测试；
- [ ] 本阶段没有新增浏览器镜头、选择和参数交互验收；
- [ ] 本阶段没有新增公网固定链接与真实浏览器验收；
- [x] 没有把截图、旧网页或旧浏览器报告冒充S1B1新交付。
