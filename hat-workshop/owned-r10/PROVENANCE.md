# 实现与资产来源边界 · HAT-R10.1

本轮从用户提供的 HAT_R10_独立源码与实际检查记录.json 接续。原快照标识 07f2e8890c2cb172a17a1793c822738321c925f145320edf27ff4068cc9fb4c0 不是 Git 提交。新目录不读取 R09 或此前帽子控制网、网格、UV、图片、法线或旧配方；帽子与程序测试头均由本目录数学规则生成。缩略图由同一生成器绘制。

这不是通过删除署名把第三方作品变成自有资产。历史版本中的原有许可、署名与修改记录保留。源代码静态扫描、文件哈希和浏览器网络记录只是工程证据，不是法律零风险证明。

## 学习来源保留，不作为运行输入

沿用上一轮记录的老师体系：Stetson Fit Guide (https://stetson.com/pages/fit-guide) 与 Lock & Co Hat Sizing (https://www.lockhatters.com/pages/hat-sizing) 用于理解头围、佩戴位置和松量的区分；不复制其尺寸表或品牌设计。

Brooklyn Tweed (https://brooklyntweed.com/products/weft-hat) 仅作针织冠体与折返罗纹结构的观察来源，不包含其付费针法图、摄影或具体织法配方。八束双股绞花使用本目录自行设计的曲线和分布。

C-IPC (https://ipc-sim.github.io/C-IPC/) 用于学习厚度与接触间距应区分的原则。本目录不采用它的求解器、代码或数据，不继承其动态无相交保证。

此前参考帽包中的 Mindfront、Elvaerwyn、culturalibre、AEthelraed_Unraed、punkduck 等仍保留在历史来源记录中。新版不包含他们的帽型资产，旧版原授权信息不删除。

## 通用第三方依赖

Three.js 0.179.1 是官方 MIT 渲染引擎，不称为自研引擎；完整许可复制到 THIRD_PARTY_NOTICES.txt 并嵌入发布网页。esbuild 0.25.10 是构建工具，版本及传递依赖由 package-lock.json 固定。GitHub Actions、Playwright 是构建测试设施，不属于自研帽型算法。

渲染实现核对官方资料：https://threejs.org/docs/pages/Material.html 和 https://threejs.org/docs/pages/WebGLRenderer.html 。自定义材质使用明确缓存键与独立 uniform 状态；着色器编译错误必须进入失败记录。

## 不作的声明

此前已接触参考实现，不称人员隔离的正式 clean-room。AI 辅助重写不保证所有输出具有排他版权；外观差异没有可保证合法的固定百分比。专利、外观设计、商标、合同和发行地区仍需商业发行前专业复核。

参考法律说明延续前轮记录：https://www.copyright.gov/register/tx-programs.html 、https://www.copyright.gov/help/faq/faq-fairuse.html 、https://www.uspto.gov/patents/basics/manage 。本轮不提供法律清查或自由实施意见。

试戴使用三种程序测试头形，不是人物总平台扫描头的验收。量配是静态包络约束，不是动态布料或戴入；针织是厚壳、实体绞花和过滤织纹，不是逐纱线物理。最终画质与用户设备性能必须单独验收。
