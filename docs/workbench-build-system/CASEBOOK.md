# 跨工作台案例：依据、提炼与限制

审查日期：2026-10-10。返回 [总入口](../../WORKBENCH_BUILD_SYSTEM.md)。

本次确实通过GitHub读取以下文件/报告，并抽读人物装配与Emily迁移内核源码。未重新运行所列历史浏览器/物理任务，未重新下载所有历史artifact。下列“报告记录”不是本次独立认证；具体blob身份见registry。样本是代表性取样，不是所有工作台的完整进度普查。

## C01 人物母体：装配入口优于复制整个成品

读取 [source/assembly.json](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/fda12bf2fe0262e4d02f1b08508128d17959e0c8/source/assembly.json) 及根AGENTS。实际装配枚举形体、骨骼、表皮、毛发、动作、物理、NPC和UI模块，JSON引用独立配置。用户提供的人物母本还规定绑定/姿势/动画/窗口状态分层及事务回滚。

提炼：接手先找真实source→build链，避免只改打包HTML；新增能力通过协议、适配器与唯一最终状态接入。母本的设计要求不是所有功能已实现的证明；本次未逐项运行这些模块。

## C02 皮肤：可以迁移的是光照方法，不是另一张脸

读取 [EmilyTransferKernel.js](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/77976497de5dd957fba0fb1eb91918baf9bd46a8/skin-quality-lab/emily-transfer/EmilyTransferKernel.js)。实际内核无人物坐标、网格数组或资产URL，保存来源、wrapped diffuse思路与特征开关，并明确exactXGPort=false；GGX与原XG Phong的差异写出。

提炼：老师能力→独立算子→原目标人物→受控开关对照，是可追溯迁移路径。不能称逐像素复刻、完整皮肤物理或跨人物最终合格；本次是源码审读。

## C03 眼睑：先看整片组织，不只看一条零间隙曲线

读取 [ET08-S1.1交付记录](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/0bad13ebd459ef9c2ef29f06dd35da6807c844b4/skin-quality-lab/emily-transfer/ET08_S11_DELIVERY.md)。记录纠正了“上下对称夹合”的早先猜测：主要问题是把接触位移传给整片皮肤，闭眼表面形成U形兜袋。修复采用原扫描导出的整片闭眼目标，并报告实际调整的眼球深度而不假称完全未变。

提炼：研究→实际源码诊断→整面目标→深仰视和睁眼正控制→重复开闭回归。对拟合目标的残差、有限采样和真实身份恢复要分开；缺少同人物睁眼资料仍是边界。

## C04 裁缝：漂亮缩略图、真实纸样、真实求解必须分开

读取 [.github/reports/patterngsl-learning-20261009.md](https://github.com/haihao0307/guilin-dem-pipeline/blob/a704386453f7fc10f34a3023bdcbd023d1236c7c/.github/reports/patterngsl-learning-20261009.md)，并读取PR177–181记录。旧针位间距为0的案例，整段裸边仍有约4.185–4.197mm分离；因此旧gate通过并未证明整段闭合。后续PR181记录后片名称分类缺陷及更正，并保留真实失败款，不以代理衣壳代替。

提炼：必须检查最终对象而非代理指标；参数启用条件和裁片语义是一等数据；先修共同根因，再用原求解器重算。仅来自PR的近期数量不在此升级为独立实测，也不称60款已动态通过。

## C05 皮革：材质、工艺、产品与动力学不能混称

读取 [R06 README](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/feature/leather-atelier-r06-takeover-20261009/leather-workshop/r06/README.md)，blob a454861f847b3e8f751efe1c2172cc95cc1e19bd；并读取PR32的R08记录。R06将产品几何、材料预设、原版针路和Worker物理试样分开，说明针路展示不等于完整线张力求解、产品造型不等于整件动力学。R08记录曲面与切边不同源导致漏边，改为同一最终边界生成正背面与孔壁。

提炼：冻结正确基线、保持真实工艺入口，同时测新组合是否仍完整。保留源文件不代表集成没漏能力。R06动态分支链接会移动，复查时必须核对本次记录blob；R08本次只读PR记录，不宣称重新检验视觉。

## C06 牛仔布：表面着色不是逐根纱线

读取 [R02 SOURCES](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/370c0cfa4098d3027042e5c788f96371095f2518/denim-workshop/r02/SOURCES.md) 与PR28/31/33记录。来源文件区分已读内部weave compiler、已读针织shader、Disney仅公开摘要和未取得工业水洗模型。PR记录R01着色基础→R02连续纱线→R03几何裁口/破损的演进，同时承认近景几何成本与未达到影视终稿。

提炼：真实表达层级要有定义，结构、光学、整理工艺分开；近中远同源过滤是一项能力，不许用面数较少的远景指标冒充近景成本。不能把没读到的全文或商业实现记成已学会。

## C07 鞋履：选对老师只是开头

读取 [固定源码README](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/043ee50c0956dd2150913e77497ff219f37f98f7/shoe-workshop/r01/README.md)。该时点明确NOT DELIVERED，记录参数几何、原Anny静态快照、量脚/截面目标及商业CAD只学公开流程。状态是该提交的状态，不是以后版本的最新判断。

提炼：视觉、结构、制造、足部接触与舒适度需要不同老师和不同证据；静态上脚不能升级为动态贴合、工业制楦或真实压力认证。

## C08 鸟类：来源包络是输入合同，不是生物学常数

读取 [Seagull R010 README](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/fda12bf2fe0262e4d02f1b08508128d17959e0c8/BIRD_SEAGULL_A_CHANNEL_EXECUTOR_R010/README_ZH.md)。它将来源通道整理成控制输入输出，锁定缺来源动作，非有限/越界处理并在缺来源时fail-closed；同时明确visualAcceptance与productionReady为false。

提炼：学到多少只开放多少；功能合同、来源运动与空气动力学不能混为一谈。不会飞的候选不能因滑块齐全而成为真实生命行为成品。

## C09 环境：一个权威时钟，而不是多个各自“正确”的系统

读取 [Environment Bridge回执](https://github.com/haihao0307/guilin-dem-pipeline/blob/7fd1745613f12a903011be9be551fe9b89ef2b82/games/survivor-palau/source/v0230/ENVIRONMENT_BRIDGE_R01_RECEIPT.json)。报告14项CPU/VM接口检查，包含共享快照、时钟不匹配拒绝、单位/轴检查、云漂移与风分开、未知物理量不补造；并明确尚未导入场景，无浏览器/公网通过。

提炼：接口核验证与系统接入是不同里程碑。适配器不重复推进上游时钟、不制造不存在的潮流/降雨观测。它可以教会其他工作台如何接入，不证明鱼/树/珊瑚已经全部生产完成。

## C10 地形失败记录：继承知识，不继承被拒绝的假真值

检索读取 [PR123关闭记录](https://github.com/haihao0307/guilin-dem-pipeline/pull/123)。记录明确拒绝把候选/程序化地形冒充严格地理真值、未按权威DEM/地图对齐、自补岸线和故事点的路线，并禁止把失败可见结果作为后续基线。

提炼：所谓继承不是不分好坏全继承；用户原始资料、正确测量与已验证知识保留，明确被拒绝的替代物只留作失败证据。此处依据PR中记录的拒绝，未独立逐帧复审历史地形。

## 共同结论

有效积累来自：真实参考→可运行子能力→原系统适配→受保护增量→能发现错误的测试→真实公开候选→范围化接受。返工常来自：先造外观替身、误读数据语义、混淆验证级别、把未取得源码的演示当实现、把局部测量当全部真值，以及发布身份断链。

本手册尚未在一个全新工作台从S0走到用户最终顶尖认可上完成端到端验证。它是依据以上样本建立并有工具检查的V1生产规范，后续应用应持续补充反例和改进，而不是将V1奉为已证明完美的公式。
