# 本次皮肤材料研究的来源与边界

- [USC：Measurement-Based Synthesis of Facial Microgeometry](https://vgl.ict.usc.edu/Research/Microgeometry/) 的流程是中尺度扫描加高分辨率微结构样本，另以点光源测量反射波瓣；采集依赖偏振和多灯照明。论文的示例把 4K 中尺度位移补充为 16K 微结构。当前单张肖像加生成侧面没有这些本人实测输入，不能把 RGB 拟合、统计毛孔或来源派生系数称为同样的本人微几何/BRDF 采集。
- [Steven Jacques：Skin Optics](https://omlc.org/news/jan98/skinoptics.html) 将表皮的主要吸收与 melanin、真皮的主要吸收与血红蛋白区分，并讨论散射和血液深度分布。文中明确把其平均光学参数当作近似起点；个人局部仍须测量。项目现有 RGB 光学密度方向是 authored 模型先验，不是这些文献中的光谱吸收系数、实测组织边界或该女士的体积分数。
- [NVIDIA：Advanced Techniques for Realistic Real-Time Skin Rendering](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-14-advanced-techniques-realistic-real-time-skin) 将表面镜面反射与皮下散射分别计算；高分辨率颜色、镜面和法线数据仍不能代替合适的散射与反射模型。当前主要异常亮暗来自颜色场与检查照明，不能据此把体散射、微法线和本人油膜标为已恢复。

本轮实现只解决可复核的一部分：把照片派生的中性乘法因子从颜色场中分出，按现有组织/深色吸收层保留颜色，并对照明变量施加反照率能量约束；为皮肤、眼睛和口腔统一提供一份柔和解析环境。没有用上述文献的平均数冒充本人测量，也没有为凑图擅自改头部表面。

后续完整采集/拟合要把相机与曝光、每张照片光照、材料反照率、色素层、微几何、粗糙度/油膜和散射分开记录。换灯与换视角是同一份材料的验证；同照随机留出像素只检查插值误差，不能证明独立真人、多照明或一比一材质复原。
