# Ray–Wave Fabric Lab R01

独立研究演示，不修改 `main`、现有人物、服装、布料母体或裁缝铺基线。

## 研究依据

参考论文：Yunchen Yu, Bruce Walter, Steve Marschner, Andrea Weidlich, “Realistic Cloth Rendering with a Ray-Wave Hybrid Shading Model,” ACM Transactions on Graphics / SIGGRAPH Asia 2025。

官方项目页：https://blaire9989.github.io/ray-wave-fabric/
论文 PDF：https://blaire9989.github.io/assets/3_RayWaveFabric/paper.pdf

## R01 已实现

- WebGL2 单文件运行时，零外部模型、零位图贴图。
- 六种研究示例织物预设：聚酯缎、真丝欧根纱、棉斜纹、羊毛斜纹、聚酯平纹、棉缎。
- 反射和透射的混合光学预览。
- 经/纬纱方向的三峰高斯散射混合，表达论文中的 ray-average lobe 思路。
- 相关噪声驱动的峰位、峰宽、能量和闪点扰动，作为论文 wave-calibrated instance variation 的浏览器近似。
- RGB 波长相关 `sinc²` 孔隙衍射近似。
- 屏幕导数驱动的近、中、远尺度收敛。
- 背光窗帘、样布近观和风压鼓动三种展示；仅光线平均 / 混合 / A-B 对照；四套光照。
- 动态褶皱和风脉冲只用于展示着色响应，不是论文的离线织物力学系统。

## 边界

这不是作者代码、论文数值参数或训练/拟合数据的逐项复制。当前公开入口没有提供可直接核对的 RayWaveFabric 源代码和数据集，因此 R01 是研究结构复现和实时视觉近似，`numericalReproduction=false`。离线 ply 级光线/波动仿真、Gaussian-mixture 拟合、实物测量标定、逐图像误差比较及论文全部样例的定量复验仍未完成。

## 验收

- 压缩源载荷 SHA-256：`95a75a5f2d16658493831f86ffb84c800448ba25a82a025b158f30594d7e29f8`
- 执行态 HTML SHA-256：`5fc5647f523037b5f035d109b11773aaa624d84ff87299a56a6c8342a4ef9699`。首轮公网 QA 发现背景着色器局部变量 `floor` 遮蔽 GLSL 内置函数；固定加载器只允许对该唯一锚点改名为 `floorMask`，锚点缺失即拒绝运行。
- 压缩后由四个固定片段载入；完整性在 QA 中重新计算。
- 桌面浏览器检查 WebGL2 编译、画面非空、六个材料、三种场景、三种模式、滑杆变化及截图。
- 390×844 仅为手机视口模拟，不冒充真实手机实机。
