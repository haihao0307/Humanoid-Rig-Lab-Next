# 00 · 当前代码事实、共同边界与架构欠账

本文件的事实快照日期为2026-10-18。它是恢复线索，不会自动随代码变化。文件内标为“建议/拟议”的接口不是现有API。

## 1. 当前世界规范锚点

仓库：haihao0307/Humanoid-Rig-Lab-Next。
S3分支：feature/reality-contract-hc-s3-direct-20261018。
本档案基于该线已核对的提交：e7df669b97a13ca79ff9b780ea21d20da7acd1d0。

S3源实现：69be784d83a611a9368094ba677007673a917092。
S3固定网页：e7c6b20566f872723b7156b2a78f0dfac6bf7685。
S3公网回执：3d16469ea89c41b29b350bd22a424abfe808dba0。
Draft PR：[95](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/pull/95)。本轮核对时open、draft=true、merged=false。

固定入口：[S3材料规范页](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/e7c6b20566f872723b7156b2a78f0dfac6bf7685/reality-lab/hc-s3/preview.html)。
历史阶段：S2.1固定网页提交553eb76103068ae76cb39995eba227b5d7497c10，源分支基线fba814d4b34147dc637841f4dfe252653f68988c。

正式来源应读[DELIVERY](../../reality-lab/hc-s3/DELIVERY.json)、[TASK_STATE](../../reality-lab/hc-s3/TASK_STATE.json)、[BUILD_MANIFEST](../../reality-lab/hc-s3/BUILD_MANIFEST.json)、[材料快照](../../reality-lab/hc-s3/material-snapshots.json)及[公网报告](../../reality-lab/hc-s3/qa/public/BROWSER_REPORT.json)。构建前生成的manifest可能仍有publicCommit=null、publicBrowserVerified=false；交付回执与实际公网报告是补充证据，不应只读单个布尔值判成败。

S3回执记录27项协议、37项公网浏览器检查；这是此前S3运行结果，不是本次文档整理新跑了64个测试。S3是七类固定证据规范化；成衣仍registered-only。未建立全部材料实时导出、实物标定、动态试穿或真机认证。

## 2. 真实的协议差异，不能用“统一”二字盖掉

[S2.1 protocol.js](../../reality-lab/hc-s2-1/protocol.js)采用kaopu/reality-object@0.2与kaopu/reality-foundation-bundle@0.2；[S3 contract.js](../../reality-lab/hc-s3/contract.js)采用kaopu/reality-material-snapshot-set@1，运行时合同版本0.3.0。

它们共享五态词表，但对象身份字段、测量ID、依据分类、单位集合和缺陷封装并不相同。S2.1字典中的fabric.thickness也不能只靠改名就与S3的material.thickness_m等同：前者强调明确测量方法/条件，后者可能承载求解器工程估计。

后续建议建立显式、可测试的桥接层：保留原schema与原始basis；映射有语义对应的字段；工程估计不能变成physical_measured；kg/m2到g/m2等换算须保留原值、原单位和变换；未知不填0；不可表达的信息进入命名空间扩展或报告unsupported。迁移前后应比较缺陷、出处和未知项，不能靠减少警告“提高完成度”。

本轮只登记欠账，不修改上述两个协议。RF02—RF07不得各再发明一套不兼容的最终世界真值对象。

## 3. 当前可用的项目接入锚点

牛仔R17.2：Humanoid-Rig-Lab-Next@22cdb3f4c3bfd101bd86f0ffa246d255b561d915，denim-workshop/r17-scale/scale.mjs、runtime.js、preview-v3.html；PR87。用于现实显示尺度/距离表达的局部案例，不代表整衣物理已经合入。

皮革R17：Humanoid-Rig-Lab-Next@5f455d90273aa717f101c6bd8be6a5cb500c99fb，leather-workshop/r17/public-lite.html；PR74保留了工程证据与限制。不要把皮革集成分支与人物主线混为一谈。

材料集合R03：Human-Fabric-Workbench@7fad8b62fa0358718d74742f689d3c448429aa48的fabric-workbench/r03为证据线索；公开运行资源在guilin-dem-pipeline@fa5ad06ca9cc2e2fc61cecc304cab2a1e74f2776的kaopu-fabric-workbench/collection/r03-3be635ad51dc/。不同仓库的职责、权限、源与构建不能互换。

人物/鞋/裁片：从S2.1现有adapters.js和对应固定来源进入，再实时核对各原工作台的最新任务状态。不能把本档案中的R07/R12身份永远当成最新人物或鞋，也不能把8月母本的28控制节点强行套到后续实际骨架。

这些锚点的可追溯材料见[项目来源P01—P06](10_SOURCES.md)。本轮未重新打开所有原三维工作台，不声称它们均完成新一轮浏览器检查。

## 4. 权威分层

人物比例/BodyDNA、HumanRigCore、Pose、Animation、最终finalPose、表现变形、Skin继续分层。普通姿势、行为、显示调度不能改绑定骨长、父子层级、人物比例版本。表皮与碰撞必须知道自己引用的最终姿势版本。

材料身份与工艺配方、材料空间/结构、光学、力学、磨损状态和观察条件分别管理。颜色参数不是生理测量；针脚显示宽度不是纱线Tex；相对厚度倍率不是绝对厚度；显示网格、物理网格和材料参考面不一定同一拓扑。

程序化配方和谱仍是权威；USD/glTF/GLB等用于交换或派生展示，不得变成反向覆盖自有生成器的真值。不得为验证新框架导入不获准的外部人物/服装网格替换本体。

## 5. 权限与公开边界

本次授权仅为保存研究路线文档。未来实施需要用户指定框架/任务后再开始。测试观察器不得具有对生产资产的write/set权限；独立候选实现也不得因此获得生产合并权。

所有源内修复回到责任工作台。保持Draft、不合并、不强推、不改写历史；不能覆盖别的活动分支，不自动移动canonical指针。其他领域，尤其建筑、飞机、地形、动物、植被和完整大世界，当前不接入。

私有仓库名与已批准公开元数据可以作为定位线索；不得把私有代码、解密后的运行包、人物照片、访问key、token或私人链接片段复制进本公共文档。只读导出不天然等于允许公开，导出时须另列字段白名单与可见性。论文、代码、模型权重、素材各自核对来源和条款；本档案只给原始链接与自写说明，不打包论文或复制外部资产。

## 6. 两种“多窗口”不同

浏览器工作台中的SharedWorker/BroadcastChannel解决同源运行页面状态，不会让不同ChatGPT/Codex对话自动共享记忆。对话开发窗口依靠本GitHub入口、任务状态、分支/提交和占用记录接续。

浏览器同源状态中心也不是跨域、跨设备或多人权限服务器。Git分支中的任务占用记录只是协作约定，不是自动原子分布式锁。写入前仍需刷新远端HEAD、检查其他PR与活动运行，版本不符即停止发布。

## 7. 共同禁止捷径

不得为了比较变好而偷偷换灯光、镜头、曝光、网格、材质默认值或遮住缺陷。固定距离档位/整件高低模切换不是用户接受的材质优化路线；当前不开发动作缓存。连续资源调度也必须承认底层请求和任务是离散的，不能宣传任意距离无穷细节与零成本。

未提供测量就保持UNKNOWN；已知不适用才是NOT_APPLICABLE。工程估计有值仍需显示依据和局限。正确的单位换算只证明换算，不证明输入是真实测量。测试通过与用户视觉接受、真实设备速度、制造合格是不同结论。
