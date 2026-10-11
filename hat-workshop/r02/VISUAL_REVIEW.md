# R02.0 实际网页与画面复核记录

日期：2026-10-11。本记录发生在实际工作流完成和取回证据之后，不是预填成功，也不是独立专家或用户批准。

## 已验证版本

- 用户冻结的 R01 页面：448f503fe17536583e0c64d58123b67ae578f4d0。
- R02 实际源码及无损资源：3997dec0a153840432cb445b57481707f29d73ea。
- R02 固定网页构建：d56bc8498a152ff501ffaf80ec80a109b2ec4865。
- 公网：https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/d56bc8498a152ff501ffaf80ec80a109b2ec4865/hat-workshop/r02/index.html
- Actions：https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/38106395076。
- artifact 11689682545，ZIP SHA256 ba1c021d21f5bf249d19b62e2cfdda3c88f73f99de9cece136e54dbba06f0dc9；已取回并核对。
- index.html 682698 bytes，SHA256 9e11dfc07e8296ffe80afd7e78b710c074ae9cce285cb4d373f449d83e2b112b。
- standalone.html 46230810 bytes，SHA256 e213676dd83c551a7caa401691bb2db805018d917875f08cb89bcd023832ec1c；取回后重新核对。

## 实际浏览器结果

file:// 96/96检查通过；固定HTTPS 97/97检查通过。两组page exceptions、renderer console errors、failed HTTP均为空。覆盖11款实际三维、11×3静态头形组合、修正开关、原版对照、灯光/配色/检查层/相机、尺寸响应、快速选择的最终对象、非法输入、配方文件导出/导入、R01配方迁移和本地反馈记录。

旧人物三个样本的可见顶点数组保持不变，调帽子不缩小头部。头形组合“能显示”不等于所有帽子贴合合格。

桌面1440×1000；手机390×844只是Chromium视口模拟，不是实机。软件CI本轮首件可操作时刻约本地5.45秒、公网3.91秒，属于该次运行观测，不保证用户设备速度。公网初始只请求cable.bin，没有预先下载全部11款；0.68 MB仅为HTML，不包含所选帽型包。原有贴图未降低尺寸或有损重压缩。

## 实際读取画面后的观察

已打开检查 qa/public/cable-corrected.png、cable-source-r01.png（对应原版画面）、visor-head-0-corrected.png、visor-head-0-r01.png、collection.jpg、wearers.jpg、mobile.png，并读两组report.json。

1. 针织帽翻边上沿原来明显的平滑拉伸亮条，在本轮固定同条件修正版中已被连续织纹取代。保留帽型位置和来源贴图字节，只改连续UV细分；仍不是纱线级几何，也不宣称影视级微观质量。
2. 空顶帽默认头形的额部在R01画面中明显穿出前方帽带，本轮修正版该处不再穿出。另两头形的默认采样校准见CORRECTION_REPORT.json。采样不是精确连续三角形碰撞或动态认证。
3. 11款都实际显示，移动视口可见主体及操作。旧款式的整体外观没有全部重做。
4. 尚存的视觉边界：例如窄檐礼帽试戴高度偏低、帽檐遮脸较多；部分礼帽仍受来源贴图和原形体质量限制。不能把这轮两处缺陷修复或97项机器通过写成全部帽型已达到最终视觉标准。

## 当前状态与下一步

本次交付的是供用户直接审核的R02修复候选。用户对本版的实际意见仍为 pending；已保留原版链接与按住对照，不覆盖R01。未来从用户原话绑定帽型、版本、镜头、配方和保护部分，形成具体缺陷和回归，再把可迁移根因补入框架规则；不把助手自己的观察改写成用户要求。

动态穿戴、头发接触、压力/舒适度、制造纸样、实时36人物接入和手机实机性能均未认证。没有新增付费服务或后台任务，没有合并/强推/改写历史。
