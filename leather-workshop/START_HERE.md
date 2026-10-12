# 皮革工作台：从这里接续

更新：2026-10-12。本文件、TASK_STATE.json和Issue #52共同作为恢复入口，不依赖聊天是否完整。

## 当前事实：S1B2已交付并合并

当前状态：`S1B2_DELIVERED_AND_MERGED_USER_REVIEW_PENDING`。
当前集成分支：`perf/leather-r10-input-20261011`。
实现目录：`leather-workshop/r12/`。
PR #51已按用户“改好的就合并提交”的明确授权合并，合并提交为 `2a5a5a69c403372890f99222c5dd4ac9d4fe8ba0`。只合并到该PR原有皮革目标分支，不涉及人物main，不强推或改写历史。旧 `refactor/leather-r12-source-normalization-20261011` 保留为历史来源，不是接续状态权威入口。

可打开的固定网页：
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/5db192b3d34235f5259d0ae5b02ff217f1b9c8f0/leather-workshop/r12/public-lite.html

网页版本：R12.0-S1B2。源 `731e127b63e3b323484459bc0391410ec19e8c1c`；构建 `5db192b3d34235f5259d0ae5b02ff217f1b9c8f0`；交付回执 `b2db61b2eadcb2ecde31c4195fade8eb67095e34`。HTML 3,628,486字节，SHA256 `46cfe2531e1c2c98242a6c1338725fa35ffeb5ec5a913c889287dd46278a398c`。

## 恢复顺序

本文件 → ROADMAP.md → TASK_STATE.json → r12/README.md → r12/DELIVERY.json → r12/qa/s1b2/RECOVERY_20261012.json。先读实际分支头、回执与成功Actions38131944900；不能仅凭旧PR标题、旧聊天或S1B1报告判定当前状态。

上次中断前S1B2源码、离线与公网验证已经成功，漏掉的是对话回报、状态更新与合并收尾。此次恢复复核Artifact、HTML及报告哈希、30组存档原始对照图，并完成真实合并；没有修改已测试的运行时代码。历史失败的截图对照原因记录在r12/qa/VIEWPORT_DIAGNOSIS.md，失败运行未交付。

## 当前实现关系

S1A：独立、清单驱动构建，不执行历史构建器；S1B1：规范源码登记与PanelAssembly显式流水线；S1B2：src/app/composition.js统一相机、选择、详情、配方、资源释放、诊断、抓取初始化及公共API关系，代替晚期函数覆盖。API始终访问当前产品求解器，避免调用已销毁实例。

已完成验证见DELIVERY：120项源码检查、25个应用接口案例、18个数值案例、25个几何案例、六款52步轨迹、109项离线浏览器检查、16项公网浏览器检查，30组同状态视觉对照差0。部分为嵌套检查，不简单累加。390×844只是视口模拟，不是实机。

## 冻结基线与不变量

R10固定构建 `af389cc216ddd01e3b1aa66c972f42b2587bc797`、HTML SHA256 `7da84eec41b6db9fe69c62ea17a3194283522004df92f47f0cd707d11b642622` 保留。
旧R10网页：
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/af389cc216ddd01e3b1aa66c972f42b2587bc797/leather-workshop/r10/public-lite.html

R01–R11、旧固定链接、已认可质感/磨损/厚度/受力、R10交互与性能策略、碰撞容差、时间步、迭代预算不改。保留六款产品、十三外观和六类工艺；立领夹克不恢复。其他工作台、根LICENSE和人物main保持不变。R11整数随机场只是独立备用实验；合法成熟算法继续复用，来源不清先核查，不盲目重写。

## 后续十项路线

完整方案、优先级、风险和门槛保留在ROADMAP.md：源码归一化→实时性能→求解收敛→外观/物性分离与三种母型标定→黏弹/永久折痕等历史效应→填芯/缝线/孔边/编织工艺物理→整张皮与磨损历史→二维裁片/三维装配及共享协议→界面分层→设备与可靠性矩阵。许可来源治理为独立横向任务。

当前S1B2已完成；完整S1仍需复核剩余共享作用域依赖、原生WASM从可审查源码复建的链路及兼容档案边界。不得把S1B2完成扩大为全部架构完成或商用法律放行。下一行动以TASK_STATE.nextAction为准，暂不自动启动新物理、性能或材质功能。

## 开发复验

从仓库根目录运行：

```sh
python -m pip install -r leather-workshop/r12/requirements-build.txt
python leather-workshop/r12/build.py
python leather-workshop/r12/verify.py
```

不要对已经登记、编辑的规范源码运行旧materialize覆盖；它保留用于历史迁移和隔离参考。缺失或损坏源码/资产时构建应报错，不能拿旧HTML代替新构建。后续执行者从当前集成分支新建独立任务分支；除非另有授权，保持Draft，不自行推进人物main。每次更新任务状态和证据，未知项明确标注。

## 交付检查

- [x] 实际运行源码与可交互三维网页，不用生成图片、截图或占位页面代替。
- [x] 几何、材质、厚度和物理的差分证据已经保存。
- [x] 固定公网网页、离线运行及关键交互均有实际浏览器证据。
- [x] PR51已按用户授权真实合并，旧版本与其他工作台保留。
- [ ] 用户对R12的视觉与操作验收仍待反馈。
- [ ] 完整S1、原生源码复建、全部设备性能和商业法律放行未声明完成。
