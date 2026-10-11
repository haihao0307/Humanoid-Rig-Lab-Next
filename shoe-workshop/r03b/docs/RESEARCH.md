# R03-B 来源、转化、误差和现实约束

核查日期2026-10-11。当前任务为真实裁片形成带厚度的鞋面，不扩展新鞋款，不替换原参考。

## 已读资料及复用范围

Sara Alvarez Vinagre，Symbiotic Shoes 方法与装配：
https://class.textile-academy.org/2021/sara.alvarez/projects/symbiotic-shoes/04-how/
作者流程为楦上画线、提取平片、连接鞋面、绷楦热成形、与中底及鞋底连接。材料是TPE，参数化鞋样仍在制作中。原图核对主片、补片和孔，不将网页图片复制进产品。

原作者GPL-3.0仓库saraalvin/SymbioticShoes，提交69e98e7f2e576cea09ef0bcb117b52d4f1cdabb6。
Parametric shoe last.3dm：SHA256 820284e4e8e8eeb0a80d8aaf9b910c35787280e639f5b09e03fe54201e2ee927。
ClassicDerby_EU39.3dm：SHA256 5fcf227ca1fb8ec4d6fc61c7175a5ec17f8aec98b054d5f11f0bd2aa00076688。
本轮完整读缓存对象清单，复用R02九片和原楦，新增读对象26三维鞋底。使用仓库GPL源数据，网页图片没有打包；GPL文本与声明继续位于r02/licenses。

Rhino8 Squish/SquishBack：
https://docs.mcneel.com/rhino/8/help/en-us/commands/squish.htm
学习2D/3D对应、边界约束、面积／边长误差独立记录；官方明确几何方法不能证明真实片材力学。未执行Rhino命令，未移植商业内核。

Rhino8 OffsetSrf/Shell：
https://docs.mcneel.com/rhino/8/help/en-us/commands/offsetsrf.htm
学习法向偏移与对应边界封闭成体；偏移自交和奇异部位有风险。每片生成内外面与边墙、真实孔壁，不把双面着色当厚度。

iCAD和Romans CAD公开流程仍作为2D/3D联动与工序参考，未取得商业源码：
https://icad.inescopsolutions.com/
https://www.romans-cad.com/en/3d-design-1
原登记的Shoemaster、3DShoemaker、IPC和动态足形论文保留，本轮未执行其完整内核。

## 独立实现

直接TPS拉弯整片的早期探针出现边缘翻折，已弃作主片路径。当前主片：原轮廓与楦面区域边界对应→改善三角化→正权谐波凸盘参数域→双域对应→目标域重三角化→射线落到原楦→内外法向厚度→封闭切边与孔壁。对应锚点来自本项目几何校准和参考图，不是CAD自带工艺语义。后条仍为小范围TPS几何候选。

原轮廓、孔和源文件只读，曲面是派生几何，禁止称全部原顶点原样不动。可逆查原片域，高变形统计保留，不借参数域无翻转宣称皮革无应变。

原鞋底26仅刚性转向和平移，底片19另按原底面对应加入。九片独立变厚，层偏移、接缝路径随主片厚度重算。导入配方不能将物理／制造合格标志改为true。

## 实际约束

现有对应边长变化较大，不是生产纸样。缺材料方向、弯曲／拉伸实测、削薄／缝份、摩擦接触和装配顺序约束。未完成全局自交检查。连续接触求解、裁切验证、授权和桌面／手机计算预算不能靠加厚自动解决。

厚度测实际顶点间距而非配置值。无真人量脚、舒适性或安全性结论。分层检查不等于力学拆装，线管可见不等于张力平衡。下一步在当前可見形态上缩小对应误差并校准工艺接口，再接材料与动态受力。
