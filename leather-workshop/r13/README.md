# 皮革 R12.0-S1B2：应用层显式接口，网页已验收并合并

更新：2026-10-12。S1B2已完成，不再停留于S1B1源码候选。PR #51按用户明确授权合并到 `perf/leather-r10-input-20261011`，合并提交 `2a5a5a69c403372890f99222c5dd4ac9d4fe8ba0`。不涉及人物main；旧R10固定网页不覆盖。

## 网页与精确身份

固定公网：
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/5db192b3d34235f5259d0ae5b02ff217f1b9c8f0/leather-workshop/r12/public-lite.html

源：`731e127b63e3b323484459bc0391410ec19e8c1c`。
构建：`5db192b3d34235f5259d0ae5b02ff217f1b9c8f0`。
公网回执：`b2db61b2eadcb2ecde31c4195fade8eb67095e34`。
HTML：3,628,486字节；SHA256 `46cfe2531e1c2c98242a6c1338725fa35ffeb5ec5a913c889287dd46278a398c`。
Actions：`38131944900`，completed/success。

上级START_HERE、ROADMAP、TASK_STATE和Issue52是接续入口。2026-10-12恢复检查发现S1B2早已发布成功，旧状态文件及PR尚未收尾；本轮复核产物后只补记状态和合并，没有再次调整运行时代码或重新宣称旧测试为新执行。

## 第一阶段已经形成的结构

S1A建立独立装配清单和构建器，可从整理后的源码重现冻结R10，不执行历史构建器。S1B1登记规范源码、资产、许可和固定WASM，PanelAssembly通过PatternPhysics、ClosedShell、AssemblyContract、YarnHost显式处理裁片、几何、绑定、连接和收尾。历史证据保留在qa/s1b及qa/SUMMARY，不被新报告冒充。

S1B2新增唯一应用组合入口 `src/app/composition.js`，各模块只提供各自服务，不再通过先捕获旧函数、再覆盖它的方式层层包装。该入口的关系如下：

| 调用 | 固定顺序与职责 |
| --- | --- |
| setView | setViewBase → applyMacroView，保留基础镜头和微距修正 |
| selectProduct | resetThicknessMode → selectProductBase，避免旧检查模式泄漏到新产品 |
| updateDetails | updateDetailsBase → updateShellDetails → updateCraftDetails |
| destroyGeometry | releaseProductMaterials → destroyGeometryBase，释放产品专属资源，不销毁共享材质目录 |
| recipe | recipeBase → appendCraftRecipe → appendPerformanceRecipe |
| updateGrabUI | shouldRefreshGrabUI → 基础诊断 → 慢速提示 → 输入指标 |
| prepareGrab | prepareGrabBase → bindPublicAppAPI |
| initializeAppControls | 重复初始化保护 → 原控件 → 切边检查 → 工艺控件 → 输入/性能事件 |

公共API中的auditContact、stepProduct、performance等始终读取当前productSolver，不捕获已经销毁的上一款产品实例。首次启动即提供完整API；保留旧引用的调用者在切换产品后仍可访问当前求解器。手动步进已通过真实Worker准确执行三步的浏览器检查。

材质参数、皮纹随机算法、磨损、灯光、基本相机参数、几何、厚度、物理模型、时间步、迭代预算、碰撞容差及R10调度策略不在本阶段升级范围；立领夹克不恢复，R11整数随机场不启用。

## 已完成验证及范围

准确记录以DELIVERY.json为准。成功Actions中包含120项源码/装配/故障检查、25个应用接口案例、18个数值案例、25个几何案例、六款完整52步轨迹、109项离线浏览器检查、16项固定公网浏览器检查。部分检查为套件内包含关系，不简单累计成独立案例总数。

30组同状态原始视觉对照，覆盖六款产品、六类工艺、十三材质、正反面/微距/切边和艺术调整；最大平均RGB差为0。六款完整轨迹中最大位置差0毫米、皮面帧相同、最终有限厚度穿透0。真实鼠标提放、跨视口旋转、文本选择边界、Esc释放、产品重建API和首启步进通过；离线核心无HTTP请求。使用Chrome软件渲染，390×844仅视口模拟，不是手机实机。

早期对照失败涉及亚像素视口和阴影刷新帧的采样时机，记录在qa/VIEWPORT_DIAGNOSIS.md。最终按同一稳定绘制阶段比较，未改渲染器或放宽像素阈值，未对截图平移/重采样掩盖差异；失败运行未发布。设备像素对齐仍是独立的后续健壮性事项。

本次恢复重新获取Artifact11699881905，复核ZIP、HTML、六份报告摘要，并直接比较30对存档PNG，最大通道差0。恢复检查不是新浏览器/数值执行；详见qa/s1b2/RECOVERY_20261012.json。合并树与已审查分支头树相同，没有额外代码冲突混入。

## 构建与恢复

```sh
python -m pip install -r leather-workshop/r12/requirements-build.txt
python leather-workshop/r12/build.py
python leather-workshop/r12/verify.py
```

普通构建只读取r12清单声明的规范输入，不执行历史构建器、不以旧HTML回退。源码/资产/原生分块缺失或变更必须显式失败；不要靠移动黄金哈希掩盖回归。materialize.py仅保留用于历史迁移及独立参考，不应覆盖已经编辑的规范目录。Python和Node仅为开发工具，用户打开单体HTML无需安装这些工具。

原生WASM继续使用接受版本的确定字节和完整性检查；本轮没有重新编译原生内核，也不声称完成了原生源码可复建链。完整S1仍需审核剩余共享作用域依赖、原生源码与固定内核的对应关系，以及兼容归档边界。用户视觉验收PENDING；全部硬件性能、材料标定、通用碰撞保证、商业法律放行未认证。

## 交付门禁

- [x] 实际修改运行源码并提供真实三维工作台，没有生成图或占位替代。
- [x] 独立构建、代码关系、几何/厚度/轨迹差分证据保留。
- [x] 完成离线、固定公网和真实浏览器关键交互验收。
- [x] 用户明确授权后PR51实际合并；旧网页、R01–R11、根许可、其他工作台与人物main不改。
- [ ] R12用户视觉验收尚待反馈。
- [ ] 完整S1和商业法律放行未声明完成。
