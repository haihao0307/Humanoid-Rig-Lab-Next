# 皮革 R13.0-S1C：源码工程收尾交付

当前版本已验证并经PR58合并。用户入口：
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/89f2b71251ec6667c09b1ed043b6714da8fa5094/leather-workshop/r13/public-lite.html

源码daf7113eea32b156b9565591e29802aefbdf489d；构建89f2b71251ec6667c09b1ed043b6714da8fa5094；正式回执65951309b46262784e72bb617ba1ca6cb5ca217f；成功Actions38338707432；合并cd644dd8d44f57175206fadfb3d24025fef7e03c。完整统计及范围见DELIVERY.json。用户视觉确认仍待反馈，productionReady和commercialLegalClearance仍为false。

## 实际构建关系

build.py只读取当前目录的assembly.json、canonical.lock.json和规范输入。PanelAssembly明确组合PatternPhysics、ClosedShell、AssemblyContract和YarnHost；src/app/composition.js明确组织相机、产品选择、厚度检查、资源释放、诊断、抓手和当前求解器API。R13不更改这些业务函数、材质、磨损、厚度、时间步、迭代预算和碰撞精度。

native/contact.c、energy.c、broadphase.c是已审查的有效C源码。native/build.py在两个独立临时目录实际编译，必须生成与已接受内核完全相同的28,697字节，SHA2562f9550559469e184d18bce32989c975aae67da580e95924b1e4f8c0a0f02abb6。native/toolchain.json保存源哈希、顺序、编译器和参数；正常构建不运行历史构建器或适配器，不复制旧WASM当输出。

工具链为Ubuntu clang18.1.3 (1ubuntu1)及LLD18.1.3；临时输出名必须是contact.wasm。名称区会保存basename；恢复原名称后完整哈希一致，无需删元数据、修改编译后的字节或放宽黄金门槛。详见NATIVE_REBUILD_DIAGNOSIS.md。源码缺失、漂移、工具链不符或结果不符都失败，不回退旧内核。

../s1-closure/prepare.py仅为一次性迁移审查记录，不参与常规构建，不覆盖已编辑源码。旧kernel-*.b64仅为审计参考，隔离测试去掉这些块后仍从C生成相同Worker载荷。开发者需要编译器，用户打开最终HTML不需要服务器或开发工具。

## 依赖与兼容边界

qa-dependencies.cjs使用TypeScript5.8.3语义绑定，记录main151、product24、specimen6条跨模块依赖；未知依赖注入会失败。环境能力按模块单列，Three.js/Poly2Tri视为受版本锁保护的第三方库边界，不把其内部符号宣称为自有模块。

四处保留扩展：SeamPath.prototype.frame及SurfaceContact.prototype.referenceCandidates/candidates/sewnNeighbour。在各程序初始化和成品/求解器构造前登记，其来源、顺序及差分结果被锁定。S1完成不等于所有共享作用域和原型扩展都已消除；本阶段按计划完成剩余依赖审核，并没有通过重写公用算法改变画面。

R02兼容工艺按钮按需解压到craftArchiveFrame.srcdoc；R05基线标签按需解压到baselineFrame.srcdoc。二者是明确的档案运行时，不是当前成品Worker；原字节保留，其参考图片和先前记录的许可问题没有被清空。

## 本轮验证

131项源码/构建门禁、18数值、25应用接口、25几何案例和六款各52步轨迹通过；最大位置差0mm、最终穿透0。45离线与16公网浏览器检查通过，9组原始同状态像素比较差0；所有材质、Worker和扫描输入另有字节不变门禁。没有应用或着色器报错。浏览器为Chrome软件渲染，390×844仅视口模拟，不能冒充全部GPU或实机认证。原应用测试套件的历史phase标签不取代R13源码身份和S1C交付回执。

八份交付报告、HTML以及最终Artifact摘要已重新核对。纯BUILD_RESULT在浏览器执行前生成，只证明构建；最终工程收尾状态看DELIVERY及上级TASK_STATE，不从纯构建字段倒推整体未完成。

## 开发与接续

```sh
python -m pip install -r leather-workshop/r13/requirements-build.txt
# Ubuntu24.04开发机需要已审查版本的clang-18、lld-18
python leather-workshop/r13/build.py
# 验证另需Node22、TypeScript5.8.3；TYPESCRIPT_PATH指向该包
python leather-workshop/r13/verify-closure.py
```

S1工程收尾完成，下一任务S2性能基线与瓶颈优化。不要重跑旧materialize覆盖源码，不从S1A重做。R01–R12、旧网页、人物main、其他工作台和根LICENSE保持不变；夹克不恢复、R11随机场不启用。依赖可复建不等于独占权属或商业法律放行。

## 交付检查

- [x] 修改真实生产构建和C源码链，不用生成图片代替三维。
- [x] 真实几何、厚度、物理和接口差分通过；本线不改人物骨骼。
- [x] 新网页镜头、抓手、选择、参数、单文件和固定公网有实际证据。
- [x] PR58已合并，历史版保留。
- [ ] 用户视觉与全部设备验收仍待独立反馈；只有截图不算交付。
