# 皮革工作台：从这里接续

更新：2026-10-13。当前实现是 `leather-workshop/r13/`，版本 **R13.0-S1C**。集成分支仍为 `perf/leather-r10-input-20261011`。PR58已按用户授权合并，合并提交 `cd644dd8d44f57175206fadfb3d24025fef7e03c`；没有推进人物main、没有强推。Issue52仍是总检索入口。

## 当前网页

https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/89f2b71251ec6667c09b1ed043b6714da8fa5094/leather-workshop/r13/public-lite.html

源码：daf7113eea32b156b9565591e29802aefbdf489d；构建：89f2b71251ec6667c09b1ed043b6714da8fa5094；交付回执：65951309b46262784e72bb617ba1ca6cb5ca217f；成功Actions：38338707432。HTML3,628,481字节，SHA256276c0f8d9cc5d038ddfedf870b4c7bef0feffc200afe7b616941d605481bd8cb。

## 恢复顺序

START_HERE → ROADMAP → TASK_STATE → r13/README → r13/DELIVERY。以实际集成分支头和最终交付回执为准；不要把历史S1B1文档或纯构建时BUILD_RESULT当成当前总状态。

S1工程收尾已完成：独立JS/C构建、主要显式装配接口、181条跨模块依赖清单、兼容档案边界和回归/浏览器验证。原生内核由项目C源码在两个独立目录实际编译，均与已接受内核逐字节相同。四处旧扩展赋值明确登记并保留，不声称全部模块都已转换为独立ESM。用户视觉认可、材料标定、全部设备性能和商业法律放行仍未宣布完成。

## 下一任务：S2性能

直接从R13测输入、Worker排队、接触、求解、蒙皮、渲染和垃圾回收，报告设备与P50/P95，再选择一个明确瓶颈优化。不要从S1A重新迁移，不再反复整理已完成接口。S1不是新的性能升级，不把本轮称为更快物理。

## 冻结范围与执行

保留R01–R12、旧固定预览、六款产品、十三外观、六类工艺及已认可皮纹/磨损/厚度/受力；不恢复夹克、不启用R11随机场，不降低碰撞容差、时间步和迭代预算。根LICENSE、第三方署名、其他工作台和人物main不改。通过验证后按用户授权合并到皮革集成分支，失败候选维持Draft。

开发构建：`python leather-workshop/r13/build.py`。复验：`python leather-workshop/r13/verify-closure.py`。开发环境需要锁定clang18/lld18及Python/Node依赖，用户打开最终HTML不需要这些工具或服务器。不要运行旧materialize覆盖规范源码。

## 交付检查

- [x] 真实生产源码、三维几何和物理，不用生成图片、截图或占位代替。
- [x] 本轮单文件与公网实际浏览器、镜头、抓手、选择和参数均已验证。
- [x] 原生源码复建和差分回归完成；本线不修改人物骨骼。
- [x] PR58已合并且旧版保留。
- [ ] 用户视觉与全部设备验收仍待反馈；仅截图不能作为交付。
