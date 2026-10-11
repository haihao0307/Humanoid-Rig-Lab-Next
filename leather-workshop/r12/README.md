# R12-S1A：等效源码迁移与独立构建

本目录交付第一步的第一子阶段：可重放的53文件迁移、42模块的独立清单构建与数值/字节验收。它不是新皮革视觉版本，也不是完整S1已经结束。

## 先读与恢复

上级 `START_HERE.md` 是入口，`ROADMAP.md` 保存全部迭代计划，`TASK_STATE.json` 保存当前和下一任务。基线R10构建为 `af389cc216ddd01e3b1aa66c972f42b2587bc797`，基线分支头 `864caaa5fc324547c0aff64ef830d6de1eae6e6a`。R11实验不参与本轮，立领夹克不恢复。

GitHub持久保存迁移器、完整逐文件锁、装配图、独立构建器和验收器。首次运行 materialize.py 会从仓库已存在、哈希冻结的R10产物和历史原文件生成可编辑的 src/、vendor/、native/、assets/、compat/、ui/ 及数值测试文件；只读旧文件，不运行旧构建器。53个物化文件在这个S1A提交中作为可精确重建的源码集合管理，尚未全部逐文件登记进Git；S1B首先审核并登记这些规范源码，然后逐个去掉晚期函数覆盖。

常规 build.py 不调用 materialize.py，不读历史目录，不运行历史Python脚本。迁移时的固定字符区间仅用于一次性提取锁定版本；它们不是常规构建时的业务代码替换规则。源文件发生本地修改时，迁移器拒绝覆盖。普通构建只装配独立目录，修改或缺失源码都不能回退到R10旧页面蒙混通过。

## 从仓库根目录复验

```sh
python -m pip install -r leather-workshop/r12/requirements-build.txt
python leather-workshop/r12/materialize.py
python leather-workshop/r12/build.py
python leather-workshop/r12/verify.py
```

Python/Node属于开发和复验工具，不是用户打开工作台的前提。已测试Python3.13.5、Node22.16.0、Pillow12.3.0、NumPy2.3.5。纹理编解码或压缩库若输出不同字节，必须显式失败，禁止自动更新黄金哈希。

输出为 `out/reproduced-r10.html` 与 `node-lib.cjs`。HTML刻意仍显示R10.0，保留原来源身份；它是本轮新构建器重新装配出的完全等效文件，不是通过改版本号冒充新画面。新的架构身份与证据位于BUILD_RESULT和qa/SUMMARY中。

## S1A已解决与未解决

独立构建器基于assembly.json的明确模块/Worker/模板/资产节点工作；不执行exec/eval/runpy，不逐次替换历史业务函数。必要的import/export语法降级属于受限静态链接，不解析旧import路径。物理、材质、剖分、缝线、厚度、蒙皮、UI和兼容页面的装配顺序保持原样。

为保留严格等效，原有作用域包装、部分历史import拼写、后置prototype/函数覆盖尚保留；S1B负责正式接口化和去覆盖。R05兼容页面仍是明确标记的只读归档，WASM沿用已认可二进制，本阶段不声称重新编译原生内核。本轮不是第三方清零、许可放行或随机算法改造。

已做的验收包括完整HTML哈希一致、两段Worker字节一致、53物化文件来源检查、隔离目录独立构建、五段JavaScript语法、故意改源码/删除源码失败测试，以及18项旧数值用例在新链接核心上的实际重跑。准确结果以qa/SUMMARY为准。没有开启浏览器或触发工作流，没有新增公网部署，不借旧浏览器记录冒充本轮记录；遵守此前R11遇到的管理策略限制。

## 下一子阶段S1B

先将物化源码逐文件审核并登记为规范源文件；第一处接口改造选src/geometry/panels.js及surface-integrity/closed-shell/pattern-physics/assembly-contract/yarn-host之间的显式构建流水线。每改一个接口就比较形体、厚度、孔洞、缝线及受控轨迹。接着处理src/app下的late overrides。不能在这一步增加黏弹、改变迭代数、优化碰撞或调整外观。新浏览器和公网验收只有实际完成才登记，不绕过平台限制。

## 交付门禁

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际编写可执行的迁移、构建和验收源码。
- [x] 构建对象为真实可交互三维R10；不是截图或占位。
- [x] 皮革几何与物理由真实运行时提供；不涉及人物骨骼更换。
- [ ] 本轮新浏览器镜头/选择/参数控制验收，未执行。
- [ ] 本轮新公网固定链接与真实浏览器验收，未部署。
- [x] 只有截图不算完成；S1A为源码与等效构建阶段，不冒称完整S1或新网页验收。
